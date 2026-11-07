from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Check AI service readiness")
async def health(container=Depends(get_container)) -> HealthResponse:
    return HealthResponse(
        status="ok", environment=container.settings.gigsaw_env, ai_provider=container.settings.ai_provider,
        databases=container.database_status,
    )
