from __future__ import annotations

from typing import Any

from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.schemas.chat_room import (
    ActionItem,
    ProjectChatRoomAssistRequest,
    ProjectChatRoomAssistResponse,
)


class ProjectChatRoomAssistant:
    """AI Facilitator and Moderator for the Integrated Project Chat Room (WhatsApp group style)."""

    def __init__(self, llm: GeminiClient) -> None:
        self.llm = llm

    def _demo_response(self, request: ProjectChatRoomAssistRequest) -> ProjectChatRoomAssistResponse:
        action = request.action
        freelancers = [m for m in request.members if m.role == "freelancer"]
        freelancer_names = [f.name for f in freelancers] or ["our assigned specialists"]

        if action == "kickoff":
            team_str = ", ".join(freelancer_names)
            msg = (
                f"👋 Welcome to the project room for {request.project_name}! "
                f"I am your AI Project Coordinator. {request.merchant_name} has connected with {team_str}. "
                f"All milestones and milestone payments are securely held in PayPal Escrow until deliverables are reviewed. "
                f"Please confirm kick-off availability and let's begin collaboration!"
            )
            return ProjectChatRoomAssistResponse(
                action="kickoff",
                message=msg,
                action_items=[
                    ActionItem(task="Confirm initial kickoff and deliverables roadmap", assignee=name, status="pending")
                    for name in freelancer_names
                ],
                summary=f"Project kickoff established with {len(freelancers)} specialist(s). Escrow funded.",
            )

        if action == "summarize":
            recent_texts = [f"{m.sender}: {m.text}" for m in request.messages[-5:]]
            summary_text = (
                f"Recent Discussion Summary ({len(request.messages)} messages): "
                + ("; ".join(recent_texts) if recent_texts else "Team assembled; kickoff underway.")
            )
            return ProjectChatRoomAssistResponse(
                action="summarize",
                message="Here is the latest executive summary of project conversation and milestone decisions.",
                summary=summary_text,
                action_items=[],
            )

        if action == "action_items":
            items = []
            for m in request.messages[-10:]:
                lower = m.text.lower()
                if "will" in lower or "working on" in lower or "finish" in lower or "upload" in lower:
                    items.append(ActionItem(task=m.text[:100], assignee=m.sender, status="in_progress"))
            if not items:
                items = [
                    ActionItem(task="Deliver first milestone preview", assignee=freelancer_names[0] if freelancer_names else "Specialist", status="pending")
                ]
            return ProjectChatRoomAssistResponse(
                action="action_items",
                message=f"Identified {len(items)} current action item(s) from recent room chat.",
                action_items=items,
                summary=f"{len(items)} pending actions tracked.",
            )

        # Mediate scope
        return ProjectChatRoomAssistResponse(
            action="mediate_scope",
            message=(
                "Scope & Timeline Mediation: If adjusting milestone deliverables or deadlines, please record changes "
                "in your work package specifications. Authorized escrow totals will reflect agreed revisions."
            ),
            action_items=[],
            summary="Scope mediation guidance provided.",
        )

    async def assist(self, request: ProjectChatRoomAssistRequest) -> ProjectChatRoomAssistResponse:
        demo = self._demo_response(request)
        if self.llm.settings.is_demo:
            return demo

        try:
            context = {
                "project_name": request.project_name,
                "merchant_name": request.merchant_name,
                "members": [m.model_dump() for m in request.members],
                "messages": [m.model_dump() for m in request.messages],
                "action": request.action,
            }
            return await self.llm.generate_structured(
                "chat_room_assist",
                context,
                ProjectChatRoomAssistResponse,
                demo,
            )
        except Exception:
            return demo
