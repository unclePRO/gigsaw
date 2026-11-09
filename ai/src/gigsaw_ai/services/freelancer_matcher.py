from __future__ import annotations

from gigsaw_ai.database.repositories.interfaces import FreelancerRepository
from gigsaw_ai.retrieval.freelancer_retriever import FreelancerRetriever
from gigsaw_ai.schemas.matching import (
    FreelancerMatch,
    FreelancerMatchingRequest,
    FreelancerMatchingResponse,
    FreelancerSwapRequest,
    FreelancerSwapResponse,
)
from gigsaw_ai.utils.validators import normalized_terms


class FreelancerMatcher:
    """Explainable, weighted ranking; vectors are one input, never the decision."""

    def __init__(self, freelancer_repository: FreelancerRepository, retriever: FreelancerRetriever) -> None:
        self.freelancer_repository = freelancer_repository
        self.retriever = retriever

    async def match(self, request: FreelancerMatchingRequest) -> FreelancerMatchingResponse:
        structured = list(await self.freelancer_repository.list_available(request.service_category))
        semantic_results = await self.retriever.retrieve(request.brief, limit=40) if request.brief else []
        semantic_scores = {freelancer.freelancer_id: relevance for freelancer, relevance in semantic_results}
        required = normalized_terms(request.required_skills)
        candidates = {freelancer.freelancer_id: freelancer for freelancer in structured}
        # Semantic retrieval may surface valid category candidates omitted by a structured index lag.
        for freelancer, _ in semantic_results:
            if freelancer.availability and request.service_category.lower() in normalized_terms(freelancer.service_categories):
                candidates[freelancer.freelancer_id] = freelancer

        # Exclude explicitly rejected or already assigned freelancers
        excluded_ids = {str(eid).strip() for eid in request.exclude_freelancer_ids if eid}
        filtered_candidates = {fid: fl for fid, fl in candidates.items() if fid not in excluded_ids}

        matches: list[FreelancerMatch] = []
        for freelancer in filtered_candidates.values():
            skill_overlap = (len(required & normalized_terms(freelancer.skills)) / len(required)) if required else 0.5
            semantic = semantic_scores.get(freelancer.freelancer_id, 0.0)
            rating = freelancer.rating / 5
            availability = 1.0 if freelancer.availability else 0.0
            price = 0.5 if freelancer.price_basis == "hour" else (
                1.0 if request.budget is None or freelancer.indicative_price <= request.budget else float(request.budget / freelancer.indicative_price)
            )
            delivery = 1.0 if request.max_delivery_days is None or freelancer.delivery_days <= request.max_delivery_days else max(0.0, request.max_delivery_days / freelancer.delivery_days)
            breakdown = {
                "semantic_relevance": round(semantic * 35, 2),
                "skill_overlap": round(skill_overlap * 25, 2),
                "rating": round(rating * 15, 2),
                "availability": round(availability * 10, 2),
                "price_compatibility": round(price * 10, 2),
                "delivery_time": round(delivery * 5, 2),
            }
            score = round(sum(breakdown.values()), 2)
            reasons = [f"Rated {freelancer.rating:.1f}/5 with {freelancer.experience_years} years of experience."]
            if skill_overlap and required:
                reasons.append(f"Matches {round(skill_overlap * 100)}% of requested skills.")
            if freelancer.price_basis == "hour":
                reasons.append(f"Indicative rate is {freelancer.indicative_price} {freelancer.currency}/hour; confirm scope hours before comparing it with the project budget.")
            elif request.budget is not None:
                reasons.append("Indicative price fits the supplied budget." if price == 1 else "Indicative price exceeds the supplied budget.")
            matches.append(FreelancerMatch(freelancer=freelancer, score=score, score_breakdown=breakdown, reasons=reasons))
        matches.sort(key=lambda match: (-match.score, -match.freelancer.rating, match.freelancer.indicative_price))
        note = "Results combine structured availability/category filters with portfolio relevance, skills, rating, price and delivery time. Recommendations require marketplace confirmation."
        return FreelancerMatchingResponse(matches=matches[:request.limit], search_note=note)

    async def swap(self, request: FreelancerSwapRequest) -> FreelancerSwapResponse:
        """Find the next best alternative freelancer for Step 4 of the merchant flow."""
        excluded = list(set([eid for eid in request.exclude_freelancer_ids if eid] + [request.current_freelancer_id]))
        match_req = FreelancerMatchingRequest(
            service_category=request.service_category,
            required_skills=request.required_skills,
            brief=request.brief or f"Alternative specialist for {request.service_category}",
            budget=request.budget,
            max_delivery_days=request.max_delivery_days,
            limit=1,
            exclude_freelancer_ids=excluded,
        )
        res = await self.match(match_req)
        if res.matches:
            top_alt = res.matches[0]
            return FreelancerSwapResponse(
                swapped=True,
                work_package_id=request.work_package_id,
                previous_freelancer_id=request.current_freelancer_id,
                new_match=top_alt,
                message=f"Successfully swapped with next best specialist {top_alt.freelancer.name}.",
            )
        return FreelancerSwapResponse(
            swapped=False,
            work_package_id=request.work_package_id,
            previous_freelancer_id=request.current_freelancer_id,
            new_match=None,
            message="No alternative specialists available matching this criteria.",
        )
