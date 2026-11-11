from __future__ import annotations

from typing import Literal

from pydantic import Field

from .common import SchemaModel


class RoomMember(SchemaModel):
    name: str
    role: Literal["merchant", "freelancer", "ai_assistant"]
    package_title: str | None = None
    freelancer_id: str | None = None


class RoomMessage(SchemaModel):
    sender: str
    role: Literal["merchant", "freelancer", "ai_assistant"]
    text: str
    timestamp: str | None = None


class ProjectChatRoomAssistRequest(SchemaModel):
    project_id: str | None = None
    project_name: str
    merchant_name: str = "Merchant"
    members: list[RoomMember] = Field(default_factory=list)
    messages: list[RoomMessage] = Field(default_factory=list)
    action: Literal["kickoff", "summarize", "action_items", "mediate_scope"] = "kickoff"


class ActionItem(SchemaModel):
    task: str
    assignee: str
    status: Literal["pending", "in_progress", "done"] = "pending"


class ProjectChatRoomAssistResponse(SchemaModel):
    action: str
    message: str
    action_items: list[ActionItem] = Field(default_factory=list)
    summary: str | None = None
