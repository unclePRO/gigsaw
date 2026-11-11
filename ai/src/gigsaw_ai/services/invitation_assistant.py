from __future__ import annotations

from decimal import Decimal

from gigsaw_ai.core.exceptions import ProviderError
from gigsaw_ai.database.repositories.interfaces import ServiceRepository
from gigsaw_ai.llm.gemini_client import STANDARD_PROVIDER_RETRY_MESSAGE, GeminiClient
from gigsaw_ai.schemas.invitations import (
    FreelancerInvitationReviewRequest,
    FreelancerInvitationReviewResponse,
)


class InvitationAssistant:
    """AI Assistant providing invitation feasibility analysis and guidance for freelancers."""

    def __init__(self, service_repository: ServiceRepository, llm: GeminiClient | None = None) -> None:
        self.service_repository = service_repository
        self.llm = llm

    async def _get_catalog_item(self, service_category: str):
        catalog_items = await self.service_repository.get_by_categories([service_category])
        return catalog_items[0] if catalog_items else None

    async def _demo_review(self, request: FreelancerInvitationReviewRequest) -> FreelancerInvitationReviewResponse:
        catalog_item = await self._get_catalog_item(request.service_category)

        baseline = catalog_item.baseline_price if catalog_item else Decimal("500")
        min_p = catalog_item.minimum_price if catalog_item else Decimal("250")
        allocated = request.allocated_price

        estimated_hours = max(8, request.estimated_days * 5)

        if allocated >= baseline:
            market_eval = f"Offered price of ${allocated} meets or exceeds standard market baseline of ${baseline}."
            feasibility_score = 92.0
            feasibility = "high"
            suggested_decision = "accept"
            counteroffer_amt = None
            counteroffer_days = None
            rationale = "Scope is well proportioned to compensation and timeline."
        elif allocated >= min_p:
            market_eval = f"Offered price of ${allocated} is within acceptable range (${min_p} - ${baseline}), but below baseline."
            feasibility_score = 78.0
            feasibility = "moderate"
            suggested_decision = "accept"
            counteroffer_amt = baseline
            counteroffer_days = request.estimated_days
            rationale = "Acceptable budget. If scope is high-fidelity, consider counteroffering closer to baseline."
        else:
            market_eval = f"Offered price of ${allocated} is below market minimum of ${min_p}."
            feasibility_score = 55.0
            feasibility = "low"
            suggested_decision = "counteroffer"
            counteroffer_amt = baseline
            counteroffer_days = request.estimated_days + 3
            rationale = f"Work package scope requires at least ${min_p} to ensure viable delivery."

        pros = [
            f"Escrow backed by PayPal payment protection for milestone: '{request.work_package_title}'.",
            f"Realistic delivery window of {request.estimated_days} days for specified deliverables.",
        ]
        watchouts = [
            f"Requires clear merchant feedback on {len(request.deliverables)} deliverables.",
        ]
        if allocated < baseline:
            watchouts.append("Offered budget is below typical marketplace baseline.")

        return FreelancerInvitationReviewResponse(
            feasibility_score=feasibility_score,
            feasibility_assessment=feasibility,
            market_rate_evaluation=market_eval,
            estimated_hours=estimated_hours,
            pros=pros,
            watchouts=watchouts,
            suggested_decision=suggested_decision,
            recommended_counteroffer_amount=counteroffer_amt,
            recommended_counteroffer_days=counteroffer_days,
            counteroffer_rationale=rationale,
        )

    async def review(self, request: FreelancerInvitationReviewRequest) -> FreelancerInvitationReviewResponse:
        if self.llm is None or self.llm.settings.is_demo:
            return await self._demo_review(request)

        catalog_item = await self._get_catalog_item(request.service_category)
        context = {
            "freelancer_id": request.freelancer_id,
            "project_name": request.project_name,
            "merchant_name": request.merchant_name,
            "work_package_title": request.work_package_title,
            "service_category": request.service_category,
            "description": request.description,
            "deliverables": request.deliverables,
            "allocated_price": str(request.allocated_price),
            "estimated_days": request.estimated_days,
            "currency": request.currency,
            "catalog_pricing": (
                {
                    "baseline_price": str(catalog_item.baseline_price),
                    "minimum_price": str(catalog_item.minimum_price),
                    "maximum_price": str(catalog_item.maximum_price),
                    "currency": catalog_item.currency,
                }
                if catalog_item
                else None
            ),
        }
        try:
            return await self.llm.generate_structured(
                "invitation_review",
                context,
                FreelancerInvitationReviewResponse,
            )
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE) from exc
