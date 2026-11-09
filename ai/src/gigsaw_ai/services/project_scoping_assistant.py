from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.schemas.projects import ProjectAnalyzeRequest, ProjectAnalyzeResponse
from gigsaw_ai.schemas.scoping import (
    ChatMessage,
    ProjectScopingChatRequest,
    ProjectScopingChatResponse,
    ProjectScopingFinalizeRequest,
    ProjectScopingFinalizeResponse,
)
from gigsaw_ai.services.budget_planner import BudgetPlanner
from gigsaw_ai.services.dependency_planner import DependencyPlanner
from gigsaw_ai.services.project_analyzer import (
    SERVICE_ALIASES,
    ProjectAnalyzer,
    canonical_service_categories,
)
from gigsaw_ai.services.task_decomposer import TaskDecomposer


STANDARD_CLARIFYING_FLOW = [
    {
        "field": "brand_theme",
        "question": "What is the theme or brand aesthetic you have in mind? (e.g., minimalist modern, artisan boutique, bold & vibrant)",
        "suggestions": ["Minimalist & Modern", "Artisan Boutique & Cozy", "Bold & Vibrant", "Corporate Professional"],
    },
    {
        "field": "existing_assets",
        "question": "Do you already have digital assets (like logos, photography, copy, menus) or should our design specialists build them from scratch?",
        "suggestions": ["Have logo & copy ready", "Need everything designed from scratch", "Have food photos & menus", "Starting fresh"],
    },
    {
        "field": "target_turnaround",
        "question": "What is your target launch turnaround time (in weeks or days)?",
        "suggestions": ["1 to 2 weeks (Rush Sprint)", "3 to 4 weeks (Standard)", "6 to 8 weeks (Comprehensive)", "Flexible launch date"],
    },
    {
        "field": "tech_stack",
        "question": "Are there any specific tech stack or platform integrations needed (e.g., Next.js, Stripe, Shopify, Online Ordering)?",
        "suggestions": ["Next.js & Custom Web", "Shopify Storefront", "Online Menu & Ordering", "Recommend best tech stack"],
    },
    {
        "field": "references",
        "question": "Is there any specific reference website or competitor whose vibe you want to match?",
        "suggestions": ["Modern upscale look", "Local neighborhood feel", "Clean SaaS layout", "Open to creative concepts"],
    },
]


class ProjectScopingAssistant:
    """Conversational AI Project Manager for Step 2 of the Merchant Create Flow."""

    def __init__(
        self,
        llm: GeminiClient,
        project_analyzer: ProjectAnalyzer,
        task_decomposer: TaskDecomposer,
        dependency_planner: DependencyPlanner,
        budget_planner: BudgetPlanner,
    ) -> None:
        self.llm = llm
        self.project_analyzer = project_analyzer
        self.task_decomposer = task_decomposer
        self.dependency_planner = dependency_planner
        self.budget_planner = budget_planner

    def _demo_chat(self, request: ProjectScopingChatRequest) -> ProjectScopingChatResponse:
        user_turns = [m for m in request.messages if m.role == "user"]
        turn_count = len(user_turns)
        spec = dict(request.extracted_spec)

        # Extract basic hints from latest user input
        if user_turns:
            latest = user_turns[-1].content.lower()
            if "minimal" in latest or "modern" in latest or "artisan" in latest or "cozy" in latest or "bold" in latest:
                spec["brand_theme"] = latest
            if "logo" in latest or "photo" in latest or "scratch" in latest or "ready" in latest:
                spec["existing_assets"] = latest
            if "week" in latest or "month" in latest or "day" in latest or "sprint" in latest:
                spec["target_turnaround"] = latest
            if "next" in latest or "react" in latest or "shopify" in latest or "order" in latest:
                spec["tech_stack"] = latest

        # Calculate completeness score based on turns and collected spec
        score = min(1.0, round(0.25 + (turn_count * 0.2) + (len(spec) * 0.1), 2))
        is_ready = turn_count >= 3 or score >= 0.75

        if is_ready:
            return ProjectScopingChatResponse(
                reply="Excellent! I have gathered all necessary details regarding your brand vision, deliverables, and timeline. Click 'Finalize Details' to review the AI team decomposition and budget breakdown.",
                clarifying_question=None,
                suggested_replies=["Finalize Details & Build Team", "Review Requirements", "Add More Details"],
                extracted_spec=spec,
                completeness_score=score,
                is_ready_to_finalize=True,
                ready_for_decomposition=True,
                recommended_action="ready_to_finalize",
            )

        # Select next question from standard flow
        step_index = min(turn_count, len(STANDARD_CLARIFYING_FLOW) - 1)
        next_step = STANDARD_CLARIFYING_FLOW[step_index]

        return ProjectScopingChatResponse(
            reply=next_step["question"],
            clarifying_question=next_step["question"],
            suggested_replies=next_step["suggestions"],
            extracted_spec=spec,
            completeness_score=score,
            is_ready_to_finalize=False,
            ready_for_decomposition=False,
            recommended_action="continue_asking",
        )

    async def chat(self, request: ProjectScopingChatRequest) -> ProjectScopingChatResponse:
        demo = self._demo_chat(request)
        if self.llm.settings.is_demo:
            return demo

        try:
            context = {
                "initial_goal": request.initial_goal,
                "messages": [m.model_dump() for m in request.messages],
                "current_budget": str(request.current_budget) if request.current_budget is not None else None,
                "currency": request.currency,
                "extracted_spec": request.extracted_spec,
            }
            res = await self.llm.generate_structured(
                "project_scoping_chat",
                context,
                ProjectScopingChatResponse,
                demo,
            )
            return res
        except Exception:
            return demo

    def _synthesize_brief(self, request: ProjectScopingFinalizeRequest) -> tuple[str, str, list[str]]:
        goal = request.initial_goal.strip()
        spec_parts = [f"Primary Goal: {goal}."]
        for k, v in request.extracted_spec.items():
            spec_parts.append(f"{k.replace('_', ' ').title()}: {v}.")

        user_messages = [m.content for m in request.messages if m.role == "user"]
        combined_text = (goal + " " + " ".join(user_messages)).lower()

        detected = [category for category, aliases in SERVICE_ALIASES.items() if any(alias in combined_text for alias in aliases)]
        if not detected:
            if "web" in combined_text or "site" in combined_text or "app" in combined_text:
                detected.append("website development")
            if "logo" in combined_text or "brand" in combined_text:
                detected.append("logo and branding")
            if not detected:
                detected = ["website development", "graphic design"]

        detected = canonical_service_categories(detected)
        title = request.project_name or f"{goal.capitalize()} Launch"
        enriched_brief = " ".join(spec_parts) + f" Target Deliverables: {', '.join(detected)}."
        return title, enriched_brief, detected

    async def finalize(self, request: ProjectScopingFinalizeRequest) -> ProjectScopingFinalizeResponse:
        title, enriched_brief, detected = self._synthesize_brief(request)
        budget = request.budget or Decimal("1200")

        analysis_result: ProjectAnalyzeResponse | None = None
        if request.auto_decompose:
            analyze_req = ProjectAnalyzeRequest(
                customer_request=enriched_brief,
                budget=budget,
                currency=request.currency,
                project_name=title,
            )
            analysis = await self.project_analyzer.analyze(analyze_req)
            packages = await self.task_decomposer.decompose(analysis)
            plan = self.dependency_planner.create_plan(packages)
            budget_plan = await self.budget_planner.plan(analysis.required_services, budget, request.currency)

            from gigsaw_ai.schemas.projects import ProjectBudget
            budget_obj = ProjectBudget(
                amount=budget,
                currency=request.currency,
                pricing_status="catalogue_planned" if budget_plan.allocations else "pending",
            )
            analysis_result = ProjectAnalyzeResponse(
                analysis=analysis,
                budget=budget_obj,
                budget_plan=budget_plan,
                work_packages=packages,
                dependency_plan=plan.edges,
            )

        return ProjectScopingFinalizeResponse(
            project_name=title,
            enriched_brief=enriched_brief,
            detected_services=detected,
            suggested_budget=budget,
            currency=request.currency,
            extracted_spec=request.extracted_spec,
            analysis_result=analysis_result,
        )
