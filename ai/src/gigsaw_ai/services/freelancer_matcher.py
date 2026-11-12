"""Hybrid two-stage freelancer search, filtering, and deterministic weighted ranking."""
from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence
from decimal import Decimal
from typing import Any, Literal

from gigsaw_ai.database.repositories.interfaces import FreelancerRepository
from gigsaw_ai.retrieval.freelancer_retriever import FreelancerRetriever
from gigsaw_ai.schemas.freelancers import Freelancer
from gigsaw_ai.schemas.matching import (
    FreelancerMatch,
    FreelancerMatchingRequest,
    FreelancerMatchingResponse,
    FreelancerSwapRequest,
    FreelancerSwapResponse,
    MatchingWeights,
)
from gigsaw_ai.services.service_registry import (
    classify_category_match,
    expand_matching_query,
    normalize_token,
    score_skill_match,
)

_UNKNOWN_LOCATION_VALUES = {"", "not specified", "unknown", "n/a", "none"}
_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "your", "our",
    "will", "have", "need", "want", "build", "create", "project", "service",
    "services", "merchant", "small", "business", "launch",
}


def _extract_keywords(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]{3,}", normalize_token(text))
    return {tok for tok in tokens if tok not in _STOPWORDS}


def _location_tokens(value: str) -> set[str]:
    cleaned = normalize_token(value)
    if cleaned in _UNKNOWN_LOCATION_VALUES:
        return set()
    return {tok for tok in re.split(r"[\s,/|()-]+", cleaned) if len(tok) >= 2}


def _evaluate_location(
    *,
    requested_location: str | None,
    onsite_required: bool,
    freelancer: Freelancer,
) -> tuple[bool, float, str | None, str | None]:
    """Return (eligible, normalized_score_0_1, positive_reason, gap_note)."""
    if not requested_location or not requested_location.strip():
        if onsite_required and normalize_token(freelancer.location) in _UNKNOWN_LOCATION_VALUES:
            return True, 0.55, None, "Freelancer location is unspecified for an on-site service; confirm local availability."
        if onsite_required:
            return True, 0.85, f"Based in {freelancer.location}; confirm on-site scheduling.", None
        return True, 1.0 if freelancer.remote_ok else 0.7, f"Available remotely ({freelancer.location}).", None

    req_tokens = _location_tokens(requested_location)
    cand_norm = normalize_token(freelancer.location)
    cand_tokens = _location_tokens(freelancer.location)
    is_remote_label = any(word in cand_norm for word in ("remote", "global", "worldwide", "anywhere"))

    if not onsite_required:
        if req_tokens & cand_tokens:
            return True, 1.0, f"Located in matching area ({freelancer.location}).", None
        if freelancer.remote_ok or is_remote_label:
            return True, 0.90, f"Supports remote delivery ({freelancer.location}).", None
        return True, 0.65, None, f"Located in {freelancer.location}; remote preference differs from {requested_location}."

    # On-site required + specific requested location
    if req_tokens & cand_tokens:
        return True, 1.0, f"Local match in {freelancer.location} for on-site work.", None
    if cand_norm in _UNKNOWN_LOCATION_VALUES:
        if freelancer.travel_radius_km and freelancer.travel_radius_km > 0:
            return True, 0.65, None, "Confirm exact travel coverage for on-site work."
        return False, 0.0, None, f"Location missing for on-site requirement in {requested_location}."
    if freelancer.travel_radius_km and freelancer.travel_radius_km >= 50:
        return True, 0.65, f"Willing to travel up to {freelancer.travel_radius_km} km from {freelancer.location}.", f"Located in {freelancer.location}; confirm travel to {requested_location}."
    return False, 0.0, None, f"Located in {freelancer.location}, incompatible with on-site {requested_location}."


def _evaluate_budget(
    *,
    request_budget: Decimal | None,
    soft_margin: float,
    freelancer: Freelancer,
) -> tuple[bool, float, Literal["within_budget", "slightly_above_budget", "above_budget", "hourly_estimate", "negotiable", "unknown"], str | None, str | None]:
    """Evaluate budget fit without falsely failing hourly/negotiable/unknown profiles."""
    price = freelancer.indicative_price
    if price is None or price <= 0:
        return True, 0.50, "unknown", None, "Pricing not set on profile; confirm quote before inviting."

    if freelancer.price_basis == "hour":
        note = f"Indicative rate is {price} {freelancer.currency}/hour; confirm total hours against budget."
        return True, 0.55, "hourly_estimate", note, "Hourly pricing requires scope hours confirmation."

    if request_budget is None or request_budget <= 0:
        return True, 0.60, "unknown", f"Indicative project price is {price} {freelancer.currency}; target budget not specified.", None

    if price <= request_budget:
        return True, 1.0, "within_budget", f"Indicative price ({price} {freelancer.currency}) fits the target budget ({request_budget}).", None

    ratio = float(price / request_budget)
    over_pct = round((ratio - 1.0) * 100)
    if ratio <= 1.0 + soft_margin:
        # Smooth linear decay within configured soft margin (e.g., +30% -> 0.80 down to 0.45)
        score = max(0.45, 0.85 - ((ratio - 1.0) / max(soft_margin, 0.01)) * 0.40)
        gap = f"Indicative price ({price} {freelancer.currency}) is {over_pct}% above target budget ({request_budget})."
        return True, round(score, 4), "slightly_above_budget", None, gap

    if freelancer.negotiable_pricing and ratio <= 2.0:
        return True, 0.55, "negotiable", None, f"Listed price ({price}) exceeds budget by {over_pct}%, marked negotiable."

    if ratio > 2.0 and not freelancer.negotiable_pricing:
        return False, 0.0, "above_budget", None, f"Indicative price ({price}) exceeds target budget ({request_budget}) by more than 2x."

    score = max(0.15, min(0.44, float(request_budget / price)))
    return True, round(score, 4), "above_budget", None, f"Indicative price ({price} {freelancer.currency}) exceeds target budget ({request_budget}) by {over_pct}%."


def _evaluate_availability(
    *,
    max_delivery_days: int | None,
    freelancer: Freelancer,
) -> tuple[bool, float, Literal["available_now", "fits_deadline", "tight_timeline", "unavailable"], str | None, str | None]:
    if not freelancer.availability or freelancer.active_project_count >= freelancer.max_concurrent_projects:
        return False, 0.0, "unavailable", None, "Currently unavailable or at active project capacity."

    capacity_ratio = (freelancer.max_concurrent_projects - freelancer.active_project_count) / max(1, freelancer.max_concurrent_projects)
    effective_days = freelancer.available_from_days + freelancer.delivery_days

    if max_delivery_days is None:
        score = 0.75 + 0.25 * capacity_ratio if freelancer.available_from_days == 0 else 0.65
        status: Literal["available_now", "fits_deadline", "tight_timeline", "unavailable"] = "available_now"
        return True, round(score, 4), status, f"Available now with ~{freelancer.delivery_days}-day typical delivery.", None

    if freelancer.available_from_days >= max_delivery_days:
        return False, 0.0, "unavailable", None, f"Starts in {freelancer.available_from_days} days, exceeding target {max_delivery_days}-day timeline."

    if effective_days <= max_delivery_days:
        score = min(1.0, 0.85 + 0.15 * capacity_ratio)
        return True, round(score, 4), "fits_deadline", f"Estimated {effective_days}-day delivery fits the {max_delivery_days}-day target.", None

    if effective_days <= max_delivery_days * 1.4:
        score = max(0.45, 0.80 * (max_delivery_days / effective_days))
        return True, round(score, 4), "tight_timeline", None, f"Estimated delivery ({effective_days} days) is slightly tighter than the {max_delivery_days}-day target."

    if effective_days > max_delivery_days * 2.5:
        return False, 0.0, "unavailable", None, f"Typical delivery ({effective_days} days) is over 2.5x the {max_delivery_days}-day deadline."

    score = max(0.20, float(max_delivery_days / effective_days))
    return True, round(score, 4), "tight_timeline", None, f"Typical delivery ({effective_days} days) exceeds target {max_delivery_days}-day deadline."


def _evaluate_reliability(freelancer: Freelancer) -> tuple[float, str, str | None]:
    """Compute honest reliability score (0..1) without faking 5.0 or penalizing new talent to 0."""
    is_new_specialist = freelancer.completed_projects == 0 or freelancer.rating == 0
    if is_new_specialist:
        base = 0.72 if freelancer.verified else 0.65
        reason = "New specialist profile (no completed platform reviews yet; scored neutrally)."
        gap = "No completed projects or client rating history yet."
        return base, reason, gap

    raw_rating = max(0.0, min(5.0, float(freelancer.rating))) / 5.0
    confidence = min(1.0, math.log1p(freelancer.completed_projects) / math.log1p(10))
    rating_component = 0.65 * (1.0 - confidence) + raw_rating * confidence

    optional_signals: list[float] = []
    if freelancer.response_rate is not None:
        optional_signals.append(float(freelancer.response_rate))
    if freelancer.on_time_rate is not None:
        optional_signals.append(float(freelancer.on_time_rate))
    if freelancer.cancellation_rate is not None:
        optional_signals.append(max(0.0, 1.0 - float(freelancer.cancellation_rate)))

    if optional_signals:
        ops_avg = sum(optional_signals) / len(optional_signals)
        score = 0.70 * rating_component + 0.30 * ops_avg
    else:
        score = rating_component

    if freelancer.verified:
        score = min(1.0, score + 0.03)

    reason = f"Rated {freelancer.rating:.1f}/5 across {freelancer.completed_projects} completed projects."
    return round(min(1.0, max(0.0, score)), 4), reason, None


class FreelancerMatcher:
    """Two-stage hybrid retrieval + deterministic configurable weighted ranking."""

    def __init__(
        self,
        freelancer_repository: FreelancerRepository,
        retriever: FreelancerRetriever,
        default_weights: MatchingWeights | None = None,
    ) -> None:
        self.freelancer_repository = freelancer_repository
        self.retriever = retriever
        self.default_weights = default_weights or MatchingWeights()

    async def _collect_candidates(
        self,
        *,
        requested_category: str,
        canonical_category: str,
        related_categories: Sequence[str],
        allow_related: bool,
        expanded_brief: str,
    ) -> tuple[dict[str, Freelancer], dict[str, float]]:
        structured: dict[str, Freelancer] = {}
        categories_to_query = list(dict.fromkeys([canonical_category, requested_category.strip().lower()]))
        if allow_related:
            categories_to_query.extend(related_categories)

        for cat in categories_to_query:
            if not cat:
                continue
            for fl in await self.freelancer_repository.list_available(cat):
                structured[fl.freelancer_id] = fl

        semantic_scores: dict[str, float] = {}
        if expanded_brief.strip():
            semantic_results = await self.retriever.retrieve(expanded_brief, limit=40)
            for fl, relevance in semantic_results:
                semantic_scores[fl.freelancer_id] = max(semantic_scores.get(fl.freelancer_id, 0.0), float(relevance))
                if fl.freelancer_id not in structured:
                    structured[fl.freelancer_id] = fl

        return structured, semantic_scores

    async def match(self, request: FreelancerMatchingRequest) -> FreelancerMatchingResponse:
        query_info = expand_matching_query(
            service_category=request.service_category,
            required_skills=request.required_skills,
            mandatory_skills=request.mandatory_skills,
            preferred_skills=request.preferred_skills,
            brief=request.brief,
            location=request.location,
            context_tags=request.project_context_tags,
        )
        canonical_category = query_info["canonical_category"]
        related_categories = query_info["related_categories"]
        onsite_required = (
            request.require_onsite
            if request.require_onsite is not None
            else bool(query_info["onsite_typical"] and request.location and request.location.strip())
        )

        raw_candidates, semantic_scores = await self._collect_candidates(
            requested_category=request.service_category,
            canonical_category=canonical_category,
            related_categories=related_categories,
            allow_related=request.allow_related_categories,
            expanded_brief=query_info["expanded_brief"],
        )

        excluded_ids = {str(eid).strip() for eid in request.exclude_freelancer_ids if eid}
        rejected_counts: Counter[str] = Counter()
        eligible_candidates: list[tuple[Freelancer, Literal["exact", "related"], dict[str, Any]]] = []

        # Stage 1: Deterministic Hard Eligibility Filtering
        for freelancer in raw_candidates.values():
            if freelancer.freelancer_id in excluded_ids:
                rejected_counts["excluded"] += 1
                continue
            if not freelancer.is_profile_complete:
                rejected_counts["incomplete_profile"] += 1
                continue

            avail_ok, avail_score, avail_status, avail_reason, avail_gap = _evaluate_availability(
                max_delivery_days=request.max_delivery_days,
                freelancer=freelancer,
            )
            if not avail_ok:
                rejected_counts["unavailable_or_timeline"] += 1
                continue

            cat_match = classify_category_match(
                canonical_category,
                freelancer.service_categories,
                freelancer.category,
            )
            if cat_match == "unrelated" or (cat_match == "related" and not request.allow_related_categories):
                rejected_counts["category_mismatch"] += 1
                continue

            all_requested_skills = list(dict.fromkeys([*request.required_skills, *request.preferred_skills]))
            skill_score, exact_skills, syn_skills, missing_skills, mandatory_ok = score_skill_match(
                all_requested_skills,
                freelancer.skills,
                mandatory_skills=request.mandatory_skills,
                portfolio_text=freelancer.portfolio_description,
            )
            if not mandatory_ok:
                rejected_counts["missing_mandatory_skills"] += 1
                continue

            loc_ok, loc_score, loc_reason, loc_gap = _evaluate_location(
                requested_location=request.location,
                onsite_required=onsite_required,
                freelancer=freelancer,
            )
            if not loc_ok:
                rejected_counts["location_incompatible"] += 1
                continue

            budget_ok, budget_score, budget_status, budget_reason, budget_gap = _evaluate_budget(
                request_budget=request.budget,
                soft_margin=request.budget_soft_margin,
                freelancer=freelancer,
            )
            if not budget_ok:
                rejected_counts["budget_incompatible"] += 1
                continue

            eligible_candidates.append(
                (
                    freelancer,
                    cat_match,
                    {
                        "avail_score": avail_score,
                        "avail_status": avail_status,
                        "avail_reason": avail_reason,
                        "avail_gap": avail_gap,
                        "skill_score": skill_score,
                        "exact_skills": exact_skills,
                        "syn_skills": syn_skills,
                        "missing_skills": missing_skills,
                        "loc_score": loc_score,
                        "loc_reason": loc_reason,
                        "loc_gap": loc_gap,
                        "budget_score": budget_score,
                        "budget_status": budget_status,
                        "budget_reason": budget_reason,
                        "budget_gap": budget_gap,
                    },
                )
            )

        # Stage 2: Deterministic Configurable Weighted Ranking (0-100)
        weights = (request.weights or self.default_weights).normalized()
        brief_keywords = _extract_keywords(
            f"{request.brief} {' '.join(request.project_context_tags)} {' '.join(request.required_skills)}"
        )

        matches: list[FreelancerMatch] = []
        for freelancer, cat_match, stage1_ctx in eligible_candidates:
            reasons: list[str] = []
            potential_gaps: list[str] = []

            # 1. Service relevance
            service_rel = 1.0 if cat_match == "exact" else 0.65
            if cat_match == "exact":
                reasons.append(f"Direct specialist in {canonical_category}.")
            else:
                reasons.append(f"Covers related specialty ({', '.join(freelancer.service_categories[:2])}).")
                potential_gaps.append(f"Primary listing is not exact '{canonical_category}' match (related category).")

            # 2. Skill compatibility
            skill_compat = stage1_ctx["skill_score"]
            if stage1_ctx["exact_skills"]:
                reasons.append(f"Direct skill match: {', '.join(stage1_ctx['exact_skills'][:4])}.")
            if stage1_ctx["syn_skills"]:
                reasons.append(f"Related skill coverage: {', '.join(stage1_ctx['syn_skills'][:3])}.")
            if stage1_ctx["missing_skills"]:
                potential_gaps.append(f"Missing listed skills: {', '.join(stage1_ctx['missing_skills'][:4])}.")

            # 3. Portfolio relevance (semantic retrieval blended with concrete domain/portfolio overlap)
            raw_semantic = semantic_scores.get(freelancer.freelancer_id, 0.0)
            portfolio_text = f"{freelancer.title} {freelancer.portfolio_description} {' '.join(freelancer.domain_experience_tags)}"
            portfolio_keywords = _extract_keywords(portfolio_text)
            if brief_keywords:
                keyword_overlap = len(brief_keywords & portfolio_keywords) / min(len(brief_keywords), 6)
                keyword_overlap = min(1.0, keyword_overlap)
            else:
                keyword_overlap = 0.50 if len(portfolio_keywords) >= 5 else 0.30
            # Discount uncalibrated/weak vector matches below 0.15 when there is zero keyword overlap.
            effective_semantic = raw_semantic if (raw_semantic >= 0.15 or keyword_overlap > 0.1) else 0.0
            portfolio_rel = min(1.0, 0.65 * effective_semantic + 0.35 * keyword_overlap)
            if freelancer.portfolio_references:
                portfolio_rel = min(1.0, portfolio_rel + 0.05)
            if portfolio_rel >= 0.55:
                reasons.append("Strong portfolio alignment with project brief and deliverables.")
            elif brief_keywords and portfolio_rel < 0.25:
                potential_gaps.append("Portfolio description shows limited direct examples for this specific brief.")

            # 4. Project & domain experience
            years_score = min(1.0, freelancer.experience_years / 8.0) if freelancer.experience_years > 0 else 0.35
            completed_score = min(1.0, freelancer.completed_projects / 10.0) if freelancer.completed_projects > 0 else 0.35
            context_tags = {normalize_token(t) for t in request.project_context_tags if t}
            tag_bonus = 0.15 if (context_tags & {normalize_token(t) for t in freelancer.domain_experience_tags}) else 0.0
            proj_exp = min(1.0, 0.55 * years_score + 0.45 * completed_score + tag_bonus)
            if freelancer.experience_years > 0:
                reasons.append(f"{freelancer.experience_years} years of experience.")

            # 5. Budget compatibility
            budget_compat = stage1_ctx["budget_score"]
            if stage1_ctx["budget_reason"]:
                reasons.append(stage1_ctx["budget_reason"])
            if stage1_ctx["budget_gap"]:
                potential_gaps.append(stage1_ctx["budget_gap"])

            # 6. Availability & deadline feasibility
            avail_compat = stage1_ctx["avail_score"]
            if stage1_ctx["avail_reason"]:
                reasons.append(stage1_ctx["avail_reason"])
            if stage1_ctx["avail_gap"]:
                potential_gaps.append(stage1_ctx["avail_gap"])

            # 7. Location compatibility
            loc_compat = stage1_ctx["loc_score"]
            if stage1_ctx["loc_reason"]:
                reasons.append(stage1_ctx["loc_reason"])
            if stage1_ctx["loc_gap"]:
                potential_gaps.append(stage1_ctx["loc_gap"])

            # 8. Reliability & track record
            rel_score, rel_reason, rel_gap = _evaluate_reliability(freelancer)
            reasons.append(rel_reason)
            if rel_gap:
                potential_gaps.append(rel_gap)

            breakdown = {
                "service_relevance": round(service_rel * weights["service_relevance"] * 100, 2),
                "skill_compatibility": round(skill_compat * weights["skill_compatibility"] * 100, 2),
                "portfolio_relevance": round(portfolio_rel * weights["portfolio_relevance"] * 100, 2),
                "project_experience": round(proj_exp * weights["project_experience"] * 100, 2),
                "budget_compatibility": round(budget_compat * weights["budget_compatibility"] * 100, 2),
                "availability": round(avail_compat * weights["availability"] * 100, 2),
                "location": round(loc_compat * weights["location"] * 100, 2),
                "reliability": round(rel_score * weights["reliability"] * 100, 2),
            }
            total_score = min(100.0, round(sum(breakdown.values()), 2))

            matches.append(
                FreelancerMatch(
                    freelancer=freelancer,
                    score=total_score,
                    score_breakdown=breakdown,
                    reasons=list(dict.fromkeys(reasons)),
                    potential_gaps=list(dict.fromkeys(potential_gaps)),
                    budget_status=stage1_ctx["budget_status"],
                    availability_status=stage1_ctx["avail_status"],
                    category_match_type=cat_match,
                )
            )

        matches.sort(
            key=lambda m: (
                -m.score,
                -(1 if m.category_match_type == "exact" else 0),
                -m.freelancer.rating,
                m.freelancer.indicative_price,
                m.freelancer.freelancer_id,
            )
        )

        if not matches:
            note = (
                f"No eligible freelancers matched '{canonical_category}' after hard filters "
                f"(checked {len(raw_candidates)} profiles). Try relaxing strict skill, location, or budget constraints."
            )
        else:
            note = (
                f"Evaluated {len(raw_candidates)} candidates via Stage 1 filters ({len(eligible_candidates)} eligible) "
                "and ranked with deterministic 8-factor scoring. Recommendations require marketplace confirmation."
            )

        return FreelancerMatchingResponse(
            matches=matches[: request.limit],
            search_note=note,
            search_metadata={
                "canonical_category": canonical_category,
                "related_categories": related_categories,
                "expanded_terms": query_info["expanded_terms"],
                "onsite_required": onsite_required,
                "raw_candidates_retrieved": len(raw_candidates),
                "eligible_after_filters": len(eligible_candidates),
                "rejected_counts": dict(rejected_counts),
                "weights": {k: round(v, 4) for k, v in weights.items()},
            },
        )

    async def swap(self, request: FreelancerSwapRequest) -> FreelancerSwapResponse:
        excluded = list(set(request.exclude_freelancer_ids) | {request.current_freelancer_id})
        match_req = FreelancerMatchingRequest(
            service_category=request.service_category,
            required_skills=request.required_skills,
            mandatory_skills=request.mandatory_skills,
            brief=request.brief,
            budget=request.budget,
            max_delivery_days=request.max_delivery_days,
            location=request.location,
            require_onsite=request.require_onsite,
            limit=1,
            exclude_freelancer_ids=excluded,
        )
        res = await self.match(match_req)
        if not res.matches:
            return FreelancerSwapResponse(
                swapped=False,
                work_package_id=request.work_package_id,
                previous_freelancer_id=request.current_freelancer_id,
                new_match=None,
                message=f"No alternative available specialists found for {request.service_category}.",
            )
        return FreelancerSwapResponse(
            swapped=True,
            work_package_id=request.work_package_id,
            previous_freelancer_id=request.current_freelancer_id,
            new_match=res.matches[0],
            message=f"Swapped {request.current_freelancer_id} for {res.matches[0].freelancer.name}.",
        )
