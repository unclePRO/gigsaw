from __future__ import annotations

import re
from decimal import Decimal
from typing import Literal

from pydantic import Field

from gigsaw_ai.core.exceptions import ProviderError
from gigsaw_ai.llm.gemini_client import STANDARD_PROVIDER_RETRY_MESSAGE, GeminiClient
from gigsaw_ai.schemas.common import SchemaModel
from gigsaw_ai.schemas.projects import ProjectAnalyzeRequest, ProjectAnalyzeResponse, ProjectBudget
from gigsaw_ai.schemas.scoping import (
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


class _SpecAttribute(SchemaModel):
    """Explicit key/value pair so Gemini response_schema never strips dict properties."""

    key: str
    value: str


class _GeminiScopingChatOutput(SchemaModel):
    reply: str
    clarifying_question: str | None = None
    suggested_replies: list[str] = Field(default_factory=list)
    extracted_spec: list[_SpecAttribute] = Field(default_factory=list)
    completeness_score: float = Field(ge=0.0, le=1.0)
    is_ready_to_finalize: bool = False
    ready_for_decomposition: bool = False
    recommended_action: Literal["continue_asking", "ready_to_finalize"] = "continue_asking"


class _GeminiScopingFinalizeOutput(SchemaModel):
    project_name: str
    enriched_brief: str
    detected_services: list[str] = Field(min_length=1)


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

    async def chat(self, request: ProjectScopingChatRequest) -> ProjectScopingChatResponse:
        if self.llm.settings.is_demo:
            raise ProviderError(
                "Gemini API is required for conversational scoping chat. Set AI_PROVIDER=gemini and retry."
            )

        context = {
            "initial_goal": request.initial_goal,
            "messages": [m.model_dump() for m in request.messages],
            "current_budget": str(request.current_budget) if request.current_budget is not None else None,
            "currency": request.currency,
            "extracted_spec": request.extracted_spec,
        }
        try:
            res = await self.llm.generate_structured(
                "project_scoping_chat",
                context,
                _GeminiScopingChatOutput,
            )
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE) from exc

        merged_spec = dict(request.extracted_spec)
        for item in res.extracted_spec:
            key = item.key.strip()
            val = item.value.strip()
            if key and val:
                merged_spec[key] = val

        is_ready = bool(
            res.is_ready_to_finalize
            or res.ready_for_decomposition
            or res.recommended_action == "ready_to_finalize"
        )
        action: Literal["continue_asking", "ready_to_finalize"] = (
            "ready_to_finalize" if is_ready else "continue_asking"
        )
        clarifying_q = None if is_ready else (res.clarifying_question or res.reply)

        return ProjectScopingChatResponse(
            reply=res.reply,
            clarifying_question=clarifying_q,
            suggested_replies=res.suggested_replies,
            extracted_spec=merged_spec,
            completeness_score=res.completeness_score,
            is_ready_to_finalize=is_ready,
            ready_for_decomposition=is_ready,
            recommended_action=action,
        )

    def _synthesize_demo_brief(self, request: ProjectScopingFinalizeRequest) -> tuple[str, str, list[str]]:
        goal = request.initial_goal.strip()
        spec_parts = [f"Primary Goal: {goal}."]
        for k, v in request.extracted_spec.items():
            spec_parts.append(f"{k.replace('_', ' ').title()}: {v}.")

        user_messages = [m.content for m in request.messages if m.role == "user"]
        combined_text = (goal + " " + " ".join(user_messages)).lower()

        detected = [
            category
            for category, aliases in SERVICE_ALIASES.items()
            if any(alias in combined_text for alias in aliases)
        ]
        if not detected:
            cleaned = re.sub(r"^(i need|looking for|hire|want|build|create)\s+(a|an|some)?\s*", "", goal.lower()).strip()
            detected = [cleaned[:60] if cleaned else "custom service"]

        detected = canonical_service_categories(detected)
        title = request.project_name or f"{goal[:60].capitalize()} Launch"
        enriched_brief = " ".join(spec_parts) + f" Target Deliverables: {', '.join(detected)}."
        return title, enriched_brief, detected

    async def finalize(self, request: ProjectScopingFinalizeRequest) -> ProjectScopingFinalizeResponse:
        if self.llm.settings.is_demo:
            title, enriched_brief, detected = self._synthesize_demo_brief(request)
        else:
            context = {
                "initial_goal": request.initial_goal,
                "messages": [m.model_dump() for m in request.messages],
                "extracted_spec": request.extracted_spec,
                "budget": str(request.budget) if request.budget is not None else None,
                "currency": request.currency,
                "project_name": request.project_name,
            }
            try:
                synthesized = await self.llm.generate_structured(
                    "project_scoping_finalize",
                    context,
                    _GeminiScopingFinalizeOutput,
                )
            except ProviderError:
                raise
            except Exception as exc:
                raise ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE) from exc

            title = request.project_name or synthesized.project_name
            enriched_brief = synthesized.enriched_brief
            detected = canonical_service_categories(synthesized.detected_services)

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
