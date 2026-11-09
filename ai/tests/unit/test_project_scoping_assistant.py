import asyncio
from decimal import Decimal

from gigsaw_ai.schemas.scoping import (
    ChatMessage,
    ProjectScopingChatRequest,
    ProjectScopingFinalizeRequest,
)


def test_project_scoping_chat_flow(container):
    req1 = ProjectScopingChatRequest(
        initial_goal="I need a website for my coffee shop",
        messages=[],
    )
    res1 = asyncio.run(container.project_scoping_assistant.chat(req1))
    assert res1.reply
    assert res1.clarifying_question is not None
    assert len(res1.suggested_replies) > 0
    assert not res1.is_ready_to_finalize

    req2 = ProjectScopingChatRequest(
        initial_goal="I need a website for my coffee shop",
        messages=[
            ChatMessage(role="assistant", content=res1.reply),
            ChatMessage(role="user", content="Artisan boutique with warm cozy aesthetic and online menu"),
            ChatMessage(role="assistant", content="Do you have existing assets?"),
            ChatMessage(role="user", content="Logo and food photos are ready, launching in 2 weeks"),
            ChatMessage(role="assistant", content="Any tech stack preference?"),
            ChatMessage(role="user", content="Next.js with modern ordering"),
        ],
    )
    res2 = asyncio.run(container.project_scoping_assistant.chat(req2))
    assert res2.completeness_score >= 0.7
    assert res2.is_ready_to_finalize
    assert res2.recommended_action == "ready_to_finalize"


def test_project_scoping_finalize(container):
    finalize_req = ProjectScopingFinalizeRequest(
        initial_goal="I need an artisan bakery website",
        messages=[
            ChatMessage(role="user", content="Cozy modern aesthetic"),
            ChatMessage(role="user", content="Need logo and branding plus photography"),
        ],
        extracted_spec={"brand_theme": "Cozy artisan", "assets": "Need full suite"},
        budget=Decimal("1500"),
        auto_decompose=True,
    )
    result = asyncio.run(container.project_scoping_assistant.finalize(finalize_req))
    assert result.project_name
    assert "artisan" in result.enriched_brief.lower()
    assert len(result.detected_services) > 0
    assert result.analysis_result is not None
    assert len(result.analysis_result.work_packages) > 0
    assert result.analysis_result.budget_plan is not None
