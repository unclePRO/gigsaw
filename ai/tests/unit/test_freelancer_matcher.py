import asyncio
from decimal import Decimal

from gigsaw_ai.schemas.matching import (
    FreelancerMatchingRequest,
    FreelancerSwapRequest,
)


def test_matcher_combines_rank_factors(container):
    result = asyncio.run(container.freelancer_matcher.match(FreelancerMatchingRequest(
        service_category="website development", required_skills=["responsive design", "seo"],
        brief="Responsive restaurant website with a digital menu", budget=Decimal("900"), limit=3,
    )))
    assert result.matches
    assert result.matches[0].freelancer.freelancer_id == "fre-001"
    assert set(result.matches[0].score_breakdown) == {"semantic_relevance", "skill_overlap", "rating", "availability", "price_compatibility", "delivery_time"}


def test_matcher_excludes_and_swaps(container):
    # Match with fre-001 excluded
    result = asyncio.run(container.freelancer_matcher.match(FreelancerMatchingRequest(
        service_category="website development",
        brief="Responsive restaurant website with a digital menu",
        budget=Decimal("900"),
        limit=3,
        exclude_freelancer_ids=["fre-001"],
    )))
    # If other candidates exist, fre-001 must not be in results
    for m in result.matches:
        assert m.freelancer.freelancer_id != "fre-001"

    # Test swap
    swap_res = asyncio.run(container.freelancer_matcher.swap(FreelancerSwapRequest(
        service_category="website development",
        current_freelancer_id="fre-001",
        budget=Decimal("900"),
    )))
    assert swap_res.previous_freelancer_id == "fre-001"
