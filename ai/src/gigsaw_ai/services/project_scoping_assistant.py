from __future__ import annotations

import asyncio
import re
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation
from typing import Literal

from pydantic import Field

from gigsaw_ai.core.exceptions import ProviderError
from gigsaw_ai.llm.gemini_client import STANDARD_PROVIDER_RETRY_MESSAGE, GeminiClient
from gigsaw_ai.schemas.common import SchemaModel
from gigsaw_ai.schemas.matching import FreelancerMatchingRequest
from gigsaw_ai.schemas.projects import ProjectAnalysis, ProjectAnalyzeRequest, ProjectAnalyzeResponse, ProjectBudget
from gigsaw_ai.schemas.scoping import (
    ChatMessage,
    ProjectScopingChatRequest,
    ProjectScopingChatResponse,
    ProjectScopingFinalizeRequest,
    ProjectScopingFinalizeResponse,
    ProjectScopingTitleRequest,
    ProjectScopingTitleResponse,
    WorkPackageFreelancerMatch,
)
from gigsaw_ai.services.budget_planner import BudgetPlanner
from gigsaw_ai.services.dependency_planner import DependencyPlanner
from gigsaw_ai.services.freelancer_matcher import FreelancerMatcher
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
    project_name: str
    updated_budget: Decimal | None = None
    currency: str = "USD"
    budget_changed: bool = False
    refined_goal: str = ""
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
    final_budget: Decimal | None = None
    currency: str = "USD"
    business_goal: str = ""
    enriched_brief: str
    extracted_spec: list[_SpecAttribute] = Field(default_factory=list)
    additional_details: list[str] = Field(default_factory=list)
    detected_services: list[str] = Field(min_length=1)


_TRIVIAL_CONFIRMATIONS = {
    "looks good",
    "looks good, ready to finalize",
    "ready",
    "ready to finalize",
    "ok",
    "okay",
    "yes",
    "confirm",
    "confirmed",
    "finalize",
    "finalize details",
    "proceed",
    "go ahead",
}


def _merge_spec(base_spec: dict[str, str], additions: Sequence[_SpecAttribute]) -> dict[str, str]:
    merged = {str(k).strip(): str(v).strip() for k, v in base_spec.items() if str(k).strip() and str(v).strip()}
    for item in additions:
        key = item.key.strip()
        val = item.value.strip()
        if key and val:
            merged[key] = val
    return merged


def _extract_user_chat_notes(messages: Sequence[ChatMessage], initial_goal: str) -> list[str]:
    """Return substantive user clarifications gathered during chat without duplicating confirmations."""
    initial_norm = re.sub(r"\s+", " ", initial_goal).strip().lower()
    seen: set[str] = set()
    notes: list[str] = []
    for msg in messages:
        if msg.role != "user":
            continue
        text = re.sub(r"\s+", " ", msg.content).strip()
        if not text:
            continue
        norm = text.lower().rstrip(".!")
        if norm == initial_norm or norm in _TRIVIAL_CONFIRMATIONS or norm in seen:
            continue
        seen.add(norm)
        notes.append(text)
    return notes


def _format_spec_checklist_lines(
    *,
    project_name: str | None,
    budget: Decimal | None,
    currency: str,
    goal: str | None,
    spec: dict[str, str],
    detected_services: Sequence[str] = (),
) -> list[str]:
    lines: list[str] = []
    if project_name:
        lines.append(f"- Project Name: {project_name}")
    if budget is not None:
        lines.append(f"- Budget: {budget} {currency}")
    if goal and goal.strip():
        lines.append(f"- Project Goal: {goal.strip()}")
    for key, val in spec.items():
        if key in ("project_name", "budget", "refined_goal"):
            continue
        label = key.replace("_", " ").strip().title()
        lines.append(f"- {label}: {val}")
    if detected_services:
        lines.append(f"- Target Services: {', '.join(detected_services)}")
    return lines


def _compose_confirmed_brief(
    *,
    executive_brief: str,
    refined_goal: str,
    project_name: str | None,
    budget: Decimal | None,
    currency: str,
    spec: dict[str, str],
    detected_services: Sequence[str],
    additional_details: Sequence[str],
) -> str:
    """Build a concise, plain-English freelancer brief combining the improved intent, key specs, and extra notes."""
    del project_name, budget, currency, detected_services
    lead = executive_brief.strip() or refined_goal.strip()
    sections: list[str] = [lead] if lead else []

    detail_lines: list[str] = []
    seen_values: set[str] = set()
    lead_lower = lead.lower()
    if refined_goal.strip() and refined_goal.strip().lower() not in lead_lower:
        seen_values.add(refined_goal.strip().lower())

    for key, val in spec.items():
        if key in ("project_name", "budget", "refined_goal"):
            continue
        cleaned_val = re.sub(r"\s+", " ", val).strip()
        if not cleaned_val:
            continue
        val_norm = cleaned_val.lower()
        if val_norm in seen_values:
            continue
        seen_values.add(val_norm)
        label = key.replace("_", " ").strip().title()
        detail_lines.append(f"- {label}: {cleaned_val}")

    existing_text_lower = (lead + "\n" + "\n".join(detail_lines)).lower()
    for item in additional_details:
        cleaned = re.sub(r"\s+", " ", item).strip()
        if not cleaned:
            continue
        norm = cleaned.lower()
        if norm in seen_values or norm in existing_text_lower:
            continue
        seen_values.add(norm)
        detail_lines.append(f"- {cleaned}")

    if detail_lines:
        sections.append("Key Details:\n" + "\n".join(detail_lines))

    return "\n\n".join(sections).strip()


def _parse_decimal(raw: object) -> Decimal | None:
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        return raw if raw >= 0 else None
    text = re.sub(r"[^0-9.]", "", str(raw))
    if not text:
        return None
    try:
        value = Decimal(text)
        return value if value >= 0 else None
    except InvalidOperation:
        return None


def _format_gathered_review(
    initial_goal: str,
    project_name: str | None,
    budget: Decimal | None,
    currency: str,
    spec: dict[str, str],
    refined_goal: str | None = None,
) -> str:
    """Render all gathered scoping fields cleanly for merchant verification before finalizing."""
    lines = ["Here are the gathered project details. Please recheck everything carefully:"]
    resolved_goal = (refined_goal or "").strip() or initial_goal.strip()
    lines.extend(
        _format_spec_checklist_lines(
            project_name=project_name,
            budget=budget,
            currency=currency,
            goal=resolved_goal,
            spec=spec,
        )
    )
    lines.append("")
    lines.append(
        'If anything needs to be changed (project name, budget, timeline, or requirements), reply with the update; otherwise click "Finalize Details & Match Specialists" to proceed.'
    )
    return "\n".join(lines)


class ProjectScopingAssistant:
    """Conversational AI Project Manager for Step 2 of the Merchant Create Flow."""

    def __init__(
        self,
        llm: GeminiClient,
        project_analyzer: ProjectAnalyzer,
        task_decomposer: TaskDecomposer,
        dependency_planner: DependencyPlanner,
        budget_planner: BudgetPlanner,
        freelancer_matcher: FreelancerMatcher | None = None,
    ) -> None:
        self.llm = llm
        self.project_analyzer = project_analyzer
        self.task_decomposer = task_decomposer
        self.dependency_planner = dependency_planner
        self.budget_planner = budget_planner
        self.freelancer_matcher = freelancer_matcher

    async def chat(self, request: ProjectScopingChatRequest) -> ProjectScopingChatResponse:
        if self.llm.settings.is_demo:
            raise ProviderError(
                "Gemini API is required for conversational scoping chat. Set AI_PROVIDER=gemini and retry."
            )

        current_title = request.project_name or request.extracted_spec.get("project_name")
        starting_budget = request.current_budget if request.current_budget is not None else _parse_decimal(request.extracted_spec.get("budget"))
        context = {
            "initial_goal": request.initial_goal,
            "current_project_name": current_title,
            "messages": [m.model_dump() for m in request.messages],
            "current_budget": str(starting_budget) if starting_budget is not None else None,
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

        merged_spec = _merge_spec(request.extracted_spec, res.extracted_spec)

        resolved_project_name = res.project_name.strip() or current_title
        if resolved_project_name:
            merged_spec["project_name"] = resolved_project_name

        resolved_budget = res.updated_budget if res.updated_budget is not None else starting_budget
        if resolved_budget is None:
            resolved_budget = _parse_decimal(merged_spec.get("budget"))
        if resolved_budget is not None:
            merged_spec["budget"] = str(resolved_budget)

        resolved_currency = (res.currency or request.currency or "USD").strip().upper() or "USD"
        budget_changed = bool(
            res.budget_changed
            or (
                resolved_budget is not None
                and starting_budget is not None
                and resolved_budget != starting_budget
            )
            or (resolved_budget is not None and starting_budget is None)
        )

        # Never pre-finalize on the first ever prompt (Turn 0) before conversation begins
        has_user_reply = any(m.role == "user" for m in request.messages)
        is_ready = bool(
            has_user_reply
            and (
                res.is_ready_to_finalize
                or res.ready_for_decomposition
                or res.recommended_action == "ready_to_finalize"
            )
        )
        action: Literal["continue_asking", "ready_to_finalize"] = (
            "ready_to_finalize" if is_ready else "continue_asking"
        )
        clarifying_q = None if is_ready else (res.clarifying_question or res.reply)
        final_reply = (
            _format_gathered_review(
                initial_goal=request.initial_goal,
                project_name=resolved_project_name,
                budget=resolved_budget,
                currency=resolved_currency,
                spec=merged_spec,
                refined_goal=res.refined_goal,
            )
            if is_ready
            else res.reply
        )
        suggestions = (
            res.suggested_replies
            if res.suggested_replies
            else (
                ["Looks good, ready to finalize", "Change project name", "Adjust budget", "Update scope or timeline"]
                if is_ready
                else []
            )
        )

        return ProjectScopingChatResponse(
            project_name=resolved_project_name,
            current_budget=resolved_budget,
            currency=resolved_currency,
            budget_changed=budget_changed,
            reply=final_reply,
            clarifying_question=clarifying_q,
            suggested_replies=suggestions,
            extracted_spec=merged_spec,
            completeness_score=res.completeness_score,
            is_ready_to_finalize=is_ready,
            ready_for_decomposition=is_ready,
            recommended_action=action,
        )

    async def suggest_title(self, request: ProjectScopingTitleRequest) -> ProjectScopingTitleResponse:
        if self.llm.settings.is_demo:
            raise ProviderError(
                "Gemini API is required for AI project title generation. Set AI_PROVIDER=gemini and retry."
            )

        current_title = request.current_project_name or request.extracted_spec.get("project_name")
        context = {
            "initial_goal": request.initial_goal,
            "current_project_name": current_title,
            "messages": [m.model_dump() for m in request.messages],
            "extracted_spec": request.extracted_spec,
        }
        try:
            res = await self.llm.generate_structured(
                "project_scoping_title",
                context,
                ProjectScopingTitleResponse,
            )
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE) from exc

        return ProjectScopingTitleResponse(
            project_name=res.project_name.strip() or current_title or "New Launch Project",
            source=res.source,
        )

    def _synthesize_demo_brief(
        self,
        request: ProjectScopingFinalizeRequest,
        *,
        budget: Decimal,
        currency: str,
    ) -> tuple[str, str, str, list[str], dict[str, str], list[str]]:
        goal = request.initial_goal.strip()
        user_notes = _extract_user_chat_notes(request.messages, goal)
        spec = dict(request.extracted_spec)
        combined_text = (
            goal + " " + " ".join(user_notes) + " " + " ".join(str(v) for v in spec.values())
        ).lower()

        detected = [
            category
            for category, aliases in SERVICE_ALIASES.items()
            if any(alias in combined_text for alias in aliases)
        ]
        if not detected:
            cleaned = re.sub(r"^(i need|looking for|hire|want|build|create)\s+(a|an|some)?\s*", "", goal.lower()).strip()
            detected = [cleaned[:60] if cleaned else "custom service"]

        detected = canonical_service_categories(detected)
        title = (
            request.project_name
            or spec.get("project_name")
            or f"{re.sub(r'^(i need|i want|looking for)\s+', '', goal, flags=re.IGNORECASE).strip()[:50].capitalize()} Launch"
        )
        cleaned_core = re.sub(
            r"^(i need|i want|looking for|please build|create|make)\s+(a|an|some)?\s*",
            "",
            goal,
            flags=re.IGNORECASE,
        ).strip().rstrip(".")
        services_phrase = ", ".join(detected)
        if cleaned_core:
            refined_goal = f"Create {cleaned_core} covering {services_phrase}."
        else:
            refined_goal = f"Deliver {services_phrase} as confirmed during project planning."

        executive_brief = refined_goal

        updated_spec = dict(spec)
        updated_spec["project_name"] = title
        updated_spec["budget"] = str(budget)

        full_brief = _compose_confirmed_brief(
            executive_brief=executive_brief,
            refined_goal=refined_goal,
            project_name=title,
            budget=budget,
            currency=currency,
            spec=updated_spec,
            detected_services=detected,
            additional_details=user_notes,
        )
        return title, refined_goal, full_brief, detected, updated_spec, user_notes

    async def finalize(self, request: ProjectScopingFinalizeRequest) -> ProjectScopingFinalizeResponse:
        spec_budget = _parse_decimal(request.extracted_spec.get("budget"))
        fallback_budget = request.budget if request.budget is not None else (spec_budget or Decimal("1200"))

        if self.llm.settings.is_demo:
            currency = (request.currency or "USD").strip().upper() or "USD"
            budget = fallback_budget
            title, refined_goal, enriched_brief, detected, updated_spec, additional_details = (
                self._synthesize_demo_brief(request, budget=budget, currency=currency)
            )
        else:
            requested_title = request.project_name or request.extracted_spec.get("project_name")
            context = {
                "initial_goal": request.initial_goal,
                "messages": [m.model_dump() for m in request.messages],
                "extracted_spec": request.extracted_spec,
                "budget": str(request.budget) if request.budget is not None else (str(spec_budget) if spec_budget is not None else None),
                "currency": request.currency,
                "project_name": requested_title,
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

            title = synthesized.project_name.strip() or requested_title or "New Launch Project"
            detected = canonical_service_categories(synthesized.detected_services)
            budget = synthesized.final_budget if synthesized.final_budget is not None else fallback_budget
            currency = (synthesized.currency or request.currency or "USD").strip().upper() or "USD"
            updated_spec = _merge_spec(request.extracted_spec, synthesized.extracted_spec)
            updated_spec["project_name"] = title
            updated_spec["budget"] = str(budget)

            refined_goal = synthesized.business_goal.strip() or synthesized.enriched_brief.strip()
            additional_details = [d.strip() for d in synthesized.additional_details if d.strip()] or _extract_user_chat_notes(
                request.messages,
                request.initial_goal,
            )
            enriched_brief = _compose_confirmed_brief(
                executive_brief=synthesized.enriched_brief,
                refined_goal=refined_goal,
                project_name=title,
                budget=budget,
                currency=currency,
                spec=updated_spec,
                detected_services=detected,
                additional_details=additional_details,
            )

        analysis_result: ProjectAnalyzeResponse | None = None
        freelancer_matches: list[WorkPackageFreelancerMatch] = []
        if request.auto_decompose:
            if self.llm.settings.is_demo:
                analyze_req = ProjectAnalyzeRequest(
                    customer_request=enriched_brief,
                    budget=budget,
                    currency=currency,
                    project_name=title,
                )
                base_analysis = await self.project_analyzer.analyze(analyze_req)
                analysis = base_analysis.model_copy(
                    update={
                        "project_name": title,
                        "business_goal": refined_goal,
                        "summary": enriched_brief,
                        "required_services": detected or base_analysis.required_services,
                    }
                )
            else:
                analysis = ProjectAnalysis(
                    project_name=title,
                    business_goal=refined_goal,
                    summary=enriched_brief,
                    required_services=detected,
                    assumptions=[
                        f"Final scoped {currency} budget is {budget}.",
                        "Recommendations require backend validation before any authorised action.",
                    ],
                    risks=["Scope, timeline, and final quotation acceptance must be confirmed by the parties."],
                )

            packages = await self.task_decomposer.decompose(analysis)
            plan = self.dependency_planner.create_plan(packages)
            budget_plan = await self.budget_planner.plan(analysis.required_services, budget, currency)

            budget_obj = ProjectBudget(
                amount=budget,
                currency=currency,
                pricing_status="catalogue_planned" if budget_plan.allocations else "pending",
            )
            analysis_result = ProjectAnalyzeResponse(
                analysis=analysis,
                budget=budget_obj,
                budget_plan=budget_plan,
                work_packages=packages,
                dependency_plan=plan.edges,
            )

            if self.freelancer_matcher is not None:
                alloc_by_cat = {
                    alloc.service_category.lower(): alloc.recommended_amount
                    for alloc in budget_plan.allocations
                }

                async def _match_pkg(pkg):
                    alloc_amt = alloc_by_cat.get(pkg.service_category.lower())
                    match_brief = (
                        f"{pkg.description}\n\n{enriched_brief}"
                        if pkg.description
                        else enriched_brief
                    )
                    match_res = await self.freelancer_matcher.match(
                        FreelancerMatchingRequest(
                            service_category=pkg.service_category,
                            required_skills=pkg.required_skills,
                            brief=match_brief,
                            budget=alloc_amt,
                            max_delivery_days=pkg.estimated_days,
                            limit=3,
                        )
                    )
                    return WorkPackageFreelancerMatch(
                        work_package_id=pkg.work_package_id,
                        service_category=pkg.service_category,
                        allocated_amount=alloc_amt,
                        match_result=match_res,
                    )

                freelancer_matches = list(await asyncio.gather(*(_match_pkg(pkg) for pkg in packages)))

        return ProjectScopingFinalizeResponse(
            project_name=title,
            enriched_brief=enriched_brief,
            detected_services=detected,
            budget=budget,
            suggested_budget=budget,
            currency=currency,
            extracted_spec=updated_spec,
            additional_details=additional_details,
            analysis_result=analysis_result,
            freelancer_matches=freelancer_matches,
        )
