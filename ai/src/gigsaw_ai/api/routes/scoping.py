from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.scoping import (
    ProjectScopingChatRequest,
    ProjectScopingChatResponse,
    ProjectScopingFinalizeRequest,
    ProjectScopingFinalizeResponse,
)

router = APIRouter(prefix="/projects", tags=["projects-scoping"])


@router.post("/scoping/chat", response_model=ProjectScopingChatResponse, summary="Conversational AI project scoping step")
async def scoping_chat(request: ProjectScopingChatRequest, container=Depends(get_container)) -> ProjectScopingChatResponse:
    return await container.project_scoping_assistant.chat(request)


@router.post("/chat", response_model=ProjectScopingChatResponse, summary="Conversational project scoping chat alias")
async def chat_alias(request: ProjectScopingChatRequest, container=Depends(get_container)) -> ProjectScopingChatResponse:
    return await container.project_scoping_assistant.chat(request)


@router.post("/scoping/finalize", response_model=ProjectScopingFinalizeResponse, summary="Finalize project scoping and generate team decomposition")
async def scoping_finalize(request: ProjectScopingFinalizeRequest, container=Depends(get_container)) -> ProjectScopingFinalizeResponse:
    return await container.project_scoping_assistant.finalize(request)
