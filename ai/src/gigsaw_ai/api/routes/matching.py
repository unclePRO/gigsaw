from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.matching import (
    FreelancerMatchingRequest,
    FreelancerMatchingResponse,
    FreelancerSwapRequest,
    FreelancerSwapResponse,
)

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/freelancers", response_model=FreelancerMatchingResponse, summary="Rank suitable freelancers")
async def match_freelancers(request: FreelancerMatchingRequest, container=Depends(get_container)) -> FreelancerMatchingResponse:
    return await container.freelancer_matcher.match(request)


@router.post("/freelancers/swap", response_model=FreelancerSwapResponse, summary="Swap out freelancer for alternative profile")
async def swap_freelancer(request: FreelancerSwapRequest, container=Depends(get_container)) -> FreelancerSwapResponse:
    return await container.freelancer_matcher.swap(request)
