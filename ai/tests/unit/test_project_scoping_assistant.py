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
    ProjectScopingTitleResponse,
)
from gigsaw_ai.services.project_scoping_assistant import (
    ProjectScopingAssistant,
    _GeminiScopingChatOutput,
    _GeminiScopingFinalizeOutput,
    _SpecAttribute,
)
from gigsaw_ai.services.task_decomposer import TaskDecompositionOutput


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
        freelancer_matcher=container.freelancer_matcher,
    )


def test_project_scoping_chat_uses_gemini_tracks_title_and_budget_change(container):
    assistant = _make_gemini_assistant(
        container,
        [
            _GeminiScopingChatOutput(
                project_name="B2B SaaS Analytics Platform",
                updated_budget=Decimal("1500"),
                currency="USD",
                budget_changed=False,
                reply="What features should your SaaS dashboard support first?",
                clarifying_question="What features should your SaaS dashboard support first?",
                suggested_replies=["Analytics & Billing", "User Management", "API Webhooks"],
                extracted_spec=[_SpecAttribute(key="domain", value="B2B SaaS")],
                completeness_score=0.4,
                # Even if an LLM mistakenly tries to pre-finalize on Turn 0, code prevents it
                is_ready_to_finalize=True,
                ready_for_decomposition=True,
                recommended_action="ready_to_finalize",
            ),
            _GeminiScopingChatOutput(
                project_name="PulseMetrics Portal",
                updated_budget=Decimal("2500"),
                currency="USD",
                budget_changed=True,
                reply="Updated project title to PulseMetrics Portal and budget to $2500 USD for your 3-week timeline.",
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
                current_budget=Decimal("1500"),
            )
        )
    )
    assert res1.project_name == "B2B SaaS Analytics Platform"
    assert res1.current_budget == Decimal("1500")
    assert not res1.budget_changed
    assert not res1.is_ready_to_finalize
    assert res1.recommended_action == "continue_asking"

    res2 = asyncio.run(
        assistant.chat(
            ProjectScopingChatRequest(
                initial_goal="I need a B2B SaaS analytics web app",
                messages=[
                    ChatMessage(role="assistant", content=res1.reply),
                    ChatMessage(role="user", content="Let's take project name as PulseMetrics Portal and increase budget to $2500, 3 weeks"),
                ],
                current_budget=res1.current_budget,
                project_name=res1.project_name,
                extracted_spec=res1.extracted_spec,
            )
        )
    )
    assert res2.project_name == "PulseMetrics Portal"
    assert res2.current_budget == Decimal("2500")
    assert res2.budget_changed is True
    assert res2.extracted_spec["budget"] == "2500"
    assert res2.extracted_spec["project_name"] == "PulseMetrics Portal"
    assert res2.is_ready_to_finalize
    assert res2.ready_for_decomposition
    assert "PulseMetrics Portal" in res2.reply
    assert "2500 USD" in res2.reply
    assert "Domain: B2B SaaS" in res2.reply
    assert "Target Turnaround: 3 weeks" in res2.reply
    assert "recheck" in res2.reply.lower()


def test_project_scoping_finalize_uses_updated_chat_budget_and_verifies_freelancers(container):
    assistant = _make_gemini_assistant(
        container,
        [
            _GeminiScopingFinalizeOutput(
                project_name="PulseMetrics Portal",
                final_budget=Decimal("2500"),
                currency="USD",
                enriched_brief="Build PulseMetrics Portal B2B SaaS website and brand identity in 3 weeks.",
                detected_services=["website development", "logo and branding"],
            )
        ],
    )
    # task_decomposer runs in demo mode here with container.llm, returning deterministic packages
    result = asyncio.run(
        assistant.finalize(
            ProjectScopingFinalizeRequest(
                initial_goal="I need a SaaS web app",
                messages=[
                    ChatMessage(role="user", content="Name it PulseMetrics Portal and change budget to $2500"),
                ],
                budget=Decimal("1500"),
                auto_decompose=True,
            )
        )
    )
    assert result.project_name == "PulseMetrics Portal"
    assert result.budget == Decimal("2500")
    assert result.suggested_budget == Decimal("2500")
    assert result.analysis_result is not None
    assert result.analysis_result.budget_plan.total_budget == Decimal("2500.00")
    assert len(result.freelancer_matches) == len(result.analysis_result.work_packages)
    assert all(item.match_result.matches for item in result.freelancer_matches)


def test_project_scoping_title_endpoint(container):
    app = create_app()
    assistant = _make_gemini_assistant(
        container,
        [ProjectScopingTitleResponse(project_name="Copper Cup Cafe", source="user_specified")],
    )
    original_assistant = container.project_scoping_assistant
    container.project_scoping_assistant = assistant
    app.dependency_overrides[get_container] = lambda: container
    try:
        client = TestClient(app)
        response = client.post(
            "/api/v1/projects/scoping/title",
            json={
                "initial_goal": "I need a coffee shop website and branding",
                "messages": [{"role": "user", "content": "title is Copper Cup Cafe"}],
            },
        )
    finally:
        container.project_scoping_assistant = original_assistant
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"project_name": "Copper Cup Cafe", "source": "user_specified"}


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
    assert len(result.freelancer_matches) == len(result.analysis_result.work_packages)
