from fastapi import APIRouter, Depends, Query

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.matching import (
    FreelancerMatchingRequest,
    FreelancerMatchingResponse,
    FreelancerSwapRequest,
    FreelancerSwapResponse,
)
from gigsaw_ai.services.matching_feedback import (
    MatchingFeedbackEvent,
    MatchingFeedbackSummary,
)

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/freelancers", response_model=FreelancerMatchingResponse, summary="Rank suitable freelancers")
async def match_freelancers(request: FreelancerMatchingRequest, container=Depends(get_container)) -> FreelancerMatchingResponse:
    return await container.freelancer_matcher.match(request)


@router.post("/freelancers/swap", response_model=FreelancerSwapResponse, summary="Swap out freelancer for alternative profile")
async def swap_freelancer(request: FreelancerSwapRequest, container=Depends(get_container)) -> FreelancerSwapResponse:
    return await container.freelancer_matcher.swap(request)


@router.post("/feedback", response_model=MatchingFeedbackEvent, summary="Record matching feedback event")
async def record_matching_feedback(
    event: MatchingFeedbackEvent,
    container=Depends(get_container),
) -> MatchingFeedbackEvent:
    return await container.matching_feedback_tracker.record(event)


@router.get("/feedback/summary", response_model=MatchingFeedbackSummary, summary="Summarize recorded matching feedback events")
async def summarize_matching_feedback(
    freelancer_id: str | None = Query(default=None),
    service_category: str | None = Query(default=None),
    container=Depends(get_container),
) -> MatchingFeedbackSummary:
    return await container.matching_feedback_tracker.summarize(
        freelancer_id=freelancer_id,
        service_category=service_category,
    )
