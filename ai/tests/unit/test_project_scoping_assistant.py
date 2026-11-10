import asyncio
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ProviderError
from gigsaw_ai.llm.gemini_client import STANDARD_PROVIDER_RETRY_MESSAGE
from gigsaw_ai.main import create_app
from gigsaw_ai.schemas.scoping import (
    ChatMessage,
    ProjectScopingChatRequest,
    ProjectScopingFinalizeRequest,
)
from gigsaw_ai.services.project_scoping_assistant import (
    ProjectScopingAssistant,
    _GeminiScopingChatOutput,
    _GeminiScopingFinalizeOutput,
    _SpecAttribute,
)


def _make_gemini_assistant(container, side_effect):
    fake_llm = type("FakeLLM", (), {})()
    fake_llm.settings = Settings(ai_provider="gemini", gemini_api_key="test-key")
    fake_llm.generate_structured = AsyncMock(side_effect=side_effect)
    return ProjectScopingAssistant(
        llm=fake_llm,
        project_analyzer=container.project_analyzer,
        task_decomposer=container.task_decomposer,
        dependency_planner=container.dependency_planner,
        budget_planner=container.budget_planner,
    )


def test_project_scoping_chat_uses_gemini_and_accumulates_spec(container):
    assistant = _make_gemini_assistant(
        container,
        [
            _GeminiScopingChatOutput(
                reply="What features should your SaaS dashboard support first?",
                clarifying_question="What features should your SaaS dashboard support first?",
                suggested_replies=["Analytics & Billing", "User Management", "API Webhooks"],
                extracted_spec=[_SpecAttribute(key="domain", value="B2B SaaS")],
                completeness_score=0.4,
                is_ready_to_finalize=False,
                ready_for_decomposition=False,
                recommended_action="continue_asking",
            ),
            _GeminiScopingChatOutput(
                reply="Great! I have captured your SaaS dashboard scope and 3-week timeline.",
                clarifying_question=None,
                suggested_replies=["Finalize Details & Build Team"],
                extracted_spec=[_SpecAttribute(key="target_turnaround", value="3 weeks")],
                completeness_score=0.85,
                is_ready_to_finalize=True,
                ready_for_decomposition=True,
                recommended_action="ready_to_finalize",
            ),
        ],
    )

    res1 = asyncio.run(
        assistant.chat(
            ProjectScopingChatRequest(
                initial_goal="I need a B2B SaaS analytics web app",
                messages=[],
            )
        )
    )
    assert res1.reply == "What features should your SaaS dashboard support first?"
    assert res1.extracted_spec == {"domain": "B2B SaaS"}
    assert not res1.is_ready_to_finalize
    assert res1.recommended_action == "continue_asking"

    res2 = asyncio.run(
        assistant.chat(
            ProjectScopingChatRequest(
                initial_goal="I need a B2B SaaS analytics web app",
                messages=[
                    ChatMessage(role="assistant", content=res1.reply),
                    ChatMessage(role="user", content="Analytics & Billing, launching in 3 weeks"),
                ],
                extracted_spec=res1.extracted_spec,
            )
        )
    )
    assert res2.extracted_spec == {"domain": "B2B SaaS", "target_turnaround": "3 weeks"}
    assert res2.is_ready_to_finalize
    assert res2.ready_for_decomposition
    assert res2.recommended_action == "ready_to_finalize"
    assert res2.clarifying_question is None


def test_project_scoping_chat_raises_standardized_retry_error_on_gemini_failure(container):
    assistant = _make_gemini_assistant(
        container,
        ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE),
    )

    with pytest.raises(ProviderError) as exc_info:
        asyncio.run(
            assistant.chat(
                ProjectScopingChatRequest(
                    initial_goal="I need a website for my coffee shop",
                    messages=[
                        ChatMessage(role="user", content="1"),
                        ChatMessage(role="user", content="2"),
                        ChatMessage(role="user", content="3"),
                    ],
                )
            )
        )
    msg = str(exc_info.value).lower()
    assert "wait" in msg
    assert "retry" in msg


def test_project_scoping_chat_rejects_demo_mode_without_gemini(container):
    with pytest.raises(ProviderError):
        asyncio.run(
            container.project_scoping_assistant.chat(
                ProjectScopingChatRequest(
                    initial_goal="I need a website for my coffee shop",
                    messages=[],
                )
            )
        )


def test_scoping_chat_api_returns_503_standardized_error_when_gemini_fails(container):
    app = create_app()
    assistant = _make_gemini_assistant(container, ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE))
    original_assistant = container.project_scoping_assistant
    container.project_scoping_assistant = assistant
    app.dependency_overrides[get_container] = lambda: container
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/projects/scoping/chat",
            json={"initial_goal": "I need a website for my bakery", "messages": []},
        )
    finally:
        container.project_scoping_assistant = original_assistant
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.headers.get("retry-after") == "5"
    payload = response.json()
    assert payload["error"] == "ai_service_unavailable"
    assert payload["retryable"] is True
    assert payload["retry_after_seconds"] == 5
    assert "wait" in payload["message"].lower()
    assert "retry" in payload["message"].lower()
    assert "is_ready_to_finalize" not in payload


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
