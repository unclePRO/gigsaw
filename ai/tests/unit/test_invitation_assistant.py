import asyncio
from decimal import Decimal

from gigsaw_ai.schemas.invitations import FreelancerInvitationReviewRequest


def test_invitation_assistant_evaluation(container):
    req_fair = FreelancerInvitationReviewRequest(
        freelancer_id="fre-001",
        project_name="Coffee Shop Online Store",
        merchant_name="Coffee House",
        work_package_title="Responsive Website",
        service_category="website development",
        description="Full stack Next.js website with menu display",
        deliverables=["Responsive website", "Launch-ready pages"],
        allocated_price=Decimal("800"),
        estimated_days=14,
    )
    res_fair = asyncio.run(container.invitation_assistant.review(req_fair))
    assert res_fair.feasibility_assessment in ("high", "moderate")
    assert res_fair.suggested_decision == "accept"
    assert res_fair.feasibility_score >= 70.0
    assert len(res_fair.pros) > 0

    req_low = FreelancerInvitationReviewRequest(
        freelancer_id="fre-001",
        project_name="Coffee Shop Online Store",
        merchant_name="Coffee House",
        work_package_title="Responsive Website",
        service_category="website development",
        description="Full stack Next.js website with menu display",
        deliverables=["Responsive website", "Launch-ready pages"],
        allocated_price=Decimal("150"),
        estimated_days=14,
    )
    res_low = asyncio.run(container.invitation_assistant.review(req_low))
    assert res_low.feasibility_assessment == "low"
    assert res_low.suggested_decision == "counteroffer"
    assert res_low.recommended_counteroffer_amount is not None
