from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.matching import FreelancerMatchingRequest, FreelancerMatchingResponse

router = APIRouter(prefix="/matching", tags=["matching"])


@router.post("/freelancers", response_model=FreelancerMatchingResponse, summary="Rank suitable freelancers")
async def match_freelancers(request: FreelancerMatchingRequest, container=Depends(get_container)) -> FreelancerMatchingResponse:
    return await container.freelancer_matcher.match(request)
