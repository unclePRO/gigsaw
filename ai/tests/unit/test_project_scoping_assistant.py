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
    assert "key details:" in result.enriched_brief.lower()
    assert "brand theme: cozy artisan" in result.enriched_brief.lower()
    assert "cozy modern aesthetic" in result.enriched_brief.lower()
    assert result.analysis_result is not None
    assert not result.analysis_result.analysis.business_goal.lower().startswith("i need ")
    assert result.analysis_result.analysis.summary == result.enriched_brief
    assert len(result.analysis_result.work_packages) > 0
    assert "artisan" in result.analysis_result.work_packages[0].description.lower()
    assert result.analysis_result.budget_plan is not None
    assert len(result.freelancer_matches) == len(result.analysis_result.work_packages)


def test_project_scoping_finalize_refines_chat_intent_and_passes_full_brief_to_matcher(container):
    captured_briefs: list[str] = []
    original_match = container.freelancer_matcher.match

    async def _recording_match(req):
        captured_briefs.append(req.brief)
        return await original_match(req)

    container.freelancer_matcher.match = _recording_match
    try:
        assistant = _make_gemini_assistant(
            container,
            [
                _GeminiScopingFinalizeOutput(
                    project_name="Lumina Roast Store",
                    final_budget=Decimal("2200"),
                    currency="USD",
                    business_goal="Launch a specialty coffee e-commerce store with unified branding and subscription checkout within 3 weeks.",
                    enriched_brief=(
                        "Create a conversion-focused e-commerce storefront and minimalist identity for Lumina Roast "
                        "featuring recurring bean subscriptions, warm terracotta visual styling, and mobile-first UX."
                    ),
                    extracted_spec=[
                        _SpecAttribute(key="brand_theme", value="Minimalist warm terracotta"),
                        _SpecAttribute(key="tech_stack", value="Next.js + Stripe subscriptions"),
                        _SpecAttribute(key="target_turnaround", value="3 weeks"),
                    ],
                    additional_details=[
                        "Exclude native mobile app in Phase 1",
                        "Prioritize subscription checkout flow on homepage",
                    ],
                    detected_services=["website development", "logo and branding"],
                ),
            ],
        )

        result = asyncio.run(
            assistant.finalize(
                ProjectScopingFinalizeRequest(
                    initial_goal="i want coffee site",
                    messages=[
                        ChatMessage(role="assistant", content="What style and features do you want?"),
                        ChatMessage(role="user", content="Minimalist terracotta Next.js store with Stripe subscriptions, 3 weeks, no mobile app"),
                    ],
                    extracted_spec={"existing_assets": "Product photos ready"},
                    budget=Decimal("1500"),
                    auto_decompose=True,
                )
            )
        )
    finally:
        container.freelancer_matcher.match = original_match

    assert result.project_name == "Lumina Roast Store"
    assert result.budget == Decimal("2200")
    assert result.extracted_spec["tech_stack"] == "Next.js + Stripe subscriptions"
    assert result.extracted_spec["existing_assets"] == "Product photos ready"
    assert result.additional_details == [
        "Exclude native mobile app in Phase 1",
        "Prioritize subscription checkout flow on homepage",
    ]
    assert result.analysis_result is not None
    # Never copies raw vague opening prompt ("i want coffee site") as business_goal
    assert result.analysis_result.analysis.business_goal.startswith("Launch a specialty coffee e-commerce store")
    assert "i want coffee site" not in result.analysis_result.analysis.business_goal.lower()
    # Enriched brief + summary carry concise improved copy, key chat specs, and extra notes without duplication
    assert "Key Details:" in result.enriched_brief
    assert "Tech Stack: Next.js + Stripe subscriptions" in result.enriched_brief
    assert "Existing Assets: Product photos ready" in result.enriched_brief
    assert "Exclude native mobile app in Phase 1" in result.enriched_brief
    assert result.analysis_result.analysis.summary == result.enriched_brief
    assert len(captured_briefs) == 2
    assert all("Next.js + Stripe subscriptions" in brief for brief in captured_briefs)
    assert all("Exclude native mobile app in Phase 1" in brief for brief in captured_briefs)


def test_scoping_chat_tracks_state_non_tech_specs_contradictions_and_readiness(container):
    assistant = _make_gemini_assistant(
        container,
        [
            _GeminiScopingChatOutput(
                project_name="Copper Cup Cafe",
                updated_budget=Decimal("2000"),
                currency="USD",
                refined_goal="Launch website, logo, food photography, and Instagram banners for Copper Cup Cafe.",
                reply="Exciting launch! To start, which city or neighborhood is the cafe in for the food photoshoot, and what website pages do you need?",
                clarifying_question="Which city or neighborhood is the cafe in for the food photoshoot, and what website pages do you need?",
                suggested_replies=["Austin, TX - Menu & Reservations", "Chicago - Online Ordering", "Remote only"],
                detected_services=["website development", "logo and branding", "food photography", "social media creatives"],
                question_priority="essential",
                asked_topic="location_and_website_scope",
                service_readiness=[
                    _SpecAttribute(key="website development", value="needs_info"),
                    _SpecAttribute(key="food photography", value="needs_info"),
                ],
                missing_essential_requirements=["photoshoot location", "website pages"],
                completeness_score=0.35,
                is_ready_to_finalize=False,
            ),
            _GeminiScopingChatOutput(
                project_name="Copper Cup Cafe",
                updated_budget=Decimal("2400"),
                currency="USD",
                budget_changed=True,
                refined_goal="Create an e-commerce coffee website, logo, and 20-dish food photoshoot in Austin within 3 weeks.",
                reply="Got it! Should the food photos and menu designs be used mainly online, printed in-store, or both?",
                clarifying_question="Should the food photos and menu designs be used mainly online, printed in-store, or both?",
                suggested_replies=["Both online and print", "Online only", "No preference, specialist can advise"],
                detected_services=["website development", "logo and branding", "food photography"],
                question_priority="quotation",
                asked_topic="usage_context",
                extracted_spec=[
                    _SpecAttribute(key="location", value="Austin, TX"),
                    _SpecAttribute(key="website_scope", value="E-commerce online ordering + menu"),
                ],
                merchant_confirmed_specs=[
                    _SpecAttribute(key="location", value="Austin, TX"),
                    _SpecAttribute(key="website_scope", value="E-commerce online ordering + menu"),
                ],
                ai_suggested_specs=[
                    _SpecAttribute(key="web_media_format", value="Web-optimized WebP/JPEG plus responsive mobile checkout"),
                ],
                contradictions_or_changes=[
                    "Scope updated from basic website to e-commerce ordering; removed social media banners; budget increased to $2400."
                ],
                service_readiness=[
                    _SpecAttribute(key="website development", value="ready_for_matching"),
                    _SpecAttribute(key="logo and branding", value="ready_for_matching"),
                    _SpecAttribute(key="food photography", value="ready_for_matching"),
                ],
                missing_essential_requirements=[],
                missing_optional_requirements=["preferred brand colors"],
                completeness_score=0.82,
                is_ready_to_finalize=True,
                ready_for_decomposition=True,
                recommended_action="ready_to_finalize",
            ),
        ],
    )

    turn1 = asyncio.run(
        assistant.chat(
            ProjectScopingChatRequest(
                initial_goal="I am opening a cafe. Need website, logo, food photography and Instagram banners. Budget $2000.",
                messages=[],
                current_budget=Decimal("2000"),
            )
        )
    )
    assert not turn1.is_ready_to_finalize
    assert turn1.requirements_state is not None
    assert turn1.requirements_state.original_request.startswith("I am opening a cafe")
    assert "website development" in turn1.requirements_state.detected_services
    assert "food photography" in turn1.requirements_state.detected_services
    assert turn1.clarifying_question in turn1.requirements_state.asked_questions

    # Verify non-blocking optional preference still transitions to confirmation review when essentials are met
    turn2 = asyncio.run(
        assistant.chat(
            ProjectScopingChatRequest(
                initial_goal="I am opening a cafe. Need website, logo, food photography and Instagram banners. Budget $2000.",
                messages=[
                    ChatMessage(role="assistant", content=turn1.reply),
                    ChatMessage(role="user", content="We are in Austin, TX. Actually skip banners and make the website e-commerce with budget $2400. Color? Not sure yet."),
                ],
                current_budget=turn1.current_budget,
                project_name=turn1.project_name,
                extracted_spec=turn1.extracted_spec,
                requirements_state=turn1.requirements_state,
            )
        )
    )
    assert turn2.is_ready_to_finalize is True
    assert turn2.budget_changed is True
    assert turn2.current_budget == Decimal("2400")
    assert turn2.requirements_state is not None
    assert turn2.requirements_state.awaiting_confirmation is True
    assert turn2.requirements_state.ai_suggested_specs["web_media_format"].startswith("Web-optimized")
    assert turn2.requirements_state.contradictions_or_changes
    assert "AI-Suggested Technical Specs" in turn2.reply

    # Inspect the context sent on Turn 2 to confirm already_asked_questions & service_guidance were supplied
    second_call_context = assistant.llm.generate_structured.call_args_list[1].args[1]
    assert second_call_context["already_asked_questions"] == [turn1.clarifying_question]
    assert "food photography" in second_call_context["service_guidance"]["onsite_services"]

