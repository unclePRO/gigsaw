import asyncio

from gigsaw_ai.schemas.chat_room import (
    ProjectChatRoomAssistRequest,
    RoomMember,
    RoomMessage,
)


def test_chat_room_kickoff(container):
    req = ProjectChatRoomAssistRequest(
        project_name="Copper Cup Cafe Launch",
        merchant_name="Alice Merchant",
        members=[
            RoomMember(name="Alice Merchant", role="merchant"),
            RoomMember(name="Bob Dev", role="freelancer", package_title="Website"),
            RoomMember(name="Carol Designer", role="freelancer", package_title="Brand Identity"),
        ],
        action="kickoff",
    )
    res = asyncio.run(container.project_chat_room_assistant.assist(req))
    assert res.action == "kickoff"
    assert "Copper Cup Cafe" in res.message
    assert "Bob Dev" in res.message or "Carol Designer" in res.message
    assert len(res.action_items) >= 1


def test_chat_room_summarize_and_actions(container):
    messages = [
        RoomMessage(sender="Alice", role="merchant", text="Hi team, looking forward to starting."),
        RoomMessage(sender="Bob", role="freelancer", text="I will upload the Next.js wireframes by tomorrow."),
        RoomMessage(sender="Carol", role="freelancer", text="I am working on the vector logo concepts."),
    ]
    req_summary = ProjectChatRoomAssistRequest(
        project_name="Bakery Storefront",
        merchant_name="Alice",
        messages=messages,
        action="summarize",
    )
    res_summary = asyncio.run(container.project_chat_room_assistant.assist(req_summary))
    assert res_summary.action == "summarize"
    assert res_summary.summary is not None

    req_actions = ProjectChatRoomAssistRequest(
        project_name="Bakery Storefront",
        merchant_name="Alice",
        messages=messages,
        action="action_items",
    )
    res_actions = asyncio.run(container.project_chat_room_assistant.assist(req_actions))
    assert res_actions.action == "action_items"
    assert len(res_actions.action_items) >= 1
