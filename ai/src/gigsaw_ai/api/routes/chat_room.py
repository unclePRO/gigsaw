from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.chat_room import (
    ProjectChatRoomAssistRequest,
    ProjectChatRoomAssistResponse,
)

router = APIRouter(prefix="/projects", tags=["projects-chat-room"])
alias_router = APIRouter(tags=["projects-chat-room"])


@router.post("/chat-room/assist", response_model=ProjectChatRoomAssistResponse, summary="Project Chat Room AI Facilitator")
@alias_router.post("/chat-room/assist", response_model=ProjectChatRoomAssistResponse, summary="Project Chat Room AI Facilitator (direct path)")
async def chat_room_assist(request: ProjectChatRoomAssistRequest, container=Depends(get_container)) -> ProjectChatRoomAssistResponse:
    return await container.project_chat_room_assistant.assist(request)
