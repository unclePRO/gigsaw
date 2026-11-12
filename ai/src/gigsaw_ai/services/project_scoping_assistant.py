"""Conversational AI scoping assistant managing iterative requirement gathering and brief synthesis."""
from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from pydantic import Field

from gigsaw_ai.core.exceptions import ProviderError
from gigsaw_ai.llm.gemini_client import STANDARD_PROVIDER_RETRY_MESSAGE, GeminiClient
from gigsaw_ai.schemas.common import SchemaModel
from gigsaw_ai.schemas.matching import FreelancerMatchingRequest
from gigsaw_ai.schemas.projects import (
    ProjectAnalysis,
    ProjectAnalyzeRequest,
    ProjectAnalyzeResponse,
    ProjectBudget,
)
from gigsaw_ai.schemas.scoping import (
    ChatMessage,
    ProjectScopingChatRequest,
    ProjectScopingChatResponse,
    ProjectScopingFinalizeRequest,
    ProjectScopingFinalizeResponse,
    ProjectScopingTitleRequest,
    ProjectScopingTitleResponse,
    ScopingRequirementsState,
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
from gigsaw_ai.services.service_registry import (
    build_service_consultation_guidance,
    canonicalize_service,
    detect_services_from_text,
)
from gigsaw_ai.services.task_decomposer import TaskDecomposer

logger = logging.getLogger(__name__)


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
    # Additive structured memory & dynamic consultation fields (safe defaults for existing tests)
    detected_services: list[str] = Field(default_factory=list)
    question_priority: Literal["essential", "quotation", "optional", "confirmation", "none"] = "essential"
    asked_topic: str = ""
    merchant_confirmed_specs: list[_SpecAttribute] = Field(default_factory=list)
    ai_suggested_specs: list[_SpecAttribute] = Field(default_factory=list)
    missing_essential_requirements: list[str] = Field(default_factory=list)
    missing_optional_requirements: list[str] = Field(default_factory=list)
    service_readiness: list[_SpecAttribute] = Field(default_factory=list)
    contradictions_or_changes: list[str] = Field(default_factory=list)
    merchant_confirmed: bool = False


class _GeminiScopingFinalizeOutput(SchemaModel):
    project_name: str
    final_budget: Decimal | None = None
    currency: str = "USD"
    business_goal: str = ""
    enriched_brief: str
    extracted_spec: list[_SpecAttribute] = Field(default_factory=list)
    additional_details: list[str] = Field(default_factory=list)
    detected_services: list[str] = Field(min_length=1)
    merchant_confirmed_specs: list[_SpecAttribute] = Field(default_factory=list)
    ai_suggested_specs: list[_SpecAttribute] = Field(default_factory=list)
    location: str = ""


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
    "just find me freelancers now",
}

_EARLY_PROCEED_PHRASES = (
    "just find me freelancers",
    "find me freelancers now",
    "ready to finalize",
    "looks good, ready",
    "skip questions",
    "match specialists now",
)


def _merge_spec(base_spec: dict[str, str], additions: Sequence[_SpecAttribute]) -> dict[str, str]:
    merged = {str(k).strip(): str(v).strip() for k, v in base_spec.items() if str(k).strip() and str(v).strip()}
    for item in additions:
        key = item.key.strip()
        val = item.value.strip()
        if key and val:
            merged[key] = val
    return merged


def _attrs_to_dict(items: Sequence[_SpecAttribute]) -> dict[str, str]:
    return {
        item.key.strip(): item.value.strip()
        for item in items
        if item.key.strip() and item.value.strip()
    }


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


def _extract_asked_questions(messages: Sequence[ChatMessage]) -> list[str]:
    questions: list[str] = []
    for msg in messages:
        if msg.role != "assistant":
            continue
        cleaned = re.sub(r"\s+", " ", msg.content).strip()
        if cleaned and "?" in cleaned and cleaned not in questions:
            questions.append(cleaned)
    return questions


def _append_unique_question(questions: list[str], candidate: str) -> None:
    clean = re.sub(r"\s+", " ", candidate).strip()
    if not clean:
        return
    clean_lower = clean.lower()
    for existing in questions:
        existing_lower = existing.lower()
        if clean_lower == existing_lower or clean_lower in existing_lower or existing_lower in clean_lower:
            return
    questions.append(clean)


def _hydrate_requirements_state(
    *,
    initial_goal: str,
    messages: Sequence[ChatMessage],
    extracted_spec: dict[str, str],
    existing_state: ScopingRequirementsState | None,
) -> ScopingRequirementsState:
    base = existing_state.model_copy(deep=True) if existing_state else ScopingRequirementsState()
    if not base.original_request:
        base.original_request = initial_goal.strip()

    text_blob = " ".join(
        [initial_goal, *(m.content for m in messages if m.role == "user"), *(str(v) for v in extracted_spec.values())]
    )
    inferred_services = detect_services_from_text(text_blob)
    if not base.detected_services and inferred_services:
        base.detected_services = inferred_services

    asked = _extract_asked_questions(messages)
    for q in asked:
        _append_unique_question(base.asked_questions, q)

    for idx, msg in enumerate(messages):
        if msg.role == "user":
            content = re.sub(r"\s+", " ", msg.content).strip()
            if content:
                turn_key = f"turn_{idx + 1}"
                base.merchant_answers.setdefault(turn_key, content)

    for k, v in extracted_spec.items():
        clean_k = str(k).strip()
        clean_v = str(v).strip()
        if clean_k and clean_v and clean_k not in ("ai_suggested_tech",):
            base.merchant_confirmed_specs[clean_k] = clean_v

    return base


def _format_spec_checklist_lines(
    *,
    project_name: str | None,
    budget: Decimal | None,
    currency: str,
    goal: str | None,
    spec: dict[str, str],
    detected_services: Sequence[str] = (),
    ai_suggested: dict[str, str] | None = None,
) -> list[str]:
    lines: list[str] = []
    if project_name:
        lines.append(f"- Project Name: {project_name}")
    if budget is not None:
        lines.append(f"- Budget: {budget} {currency}")
    if goal and goal.strip():
        lines.append(f"- Project Goal: {goal.strip()}")
    if detected_services:
        lines.append(f"- Requested Services: {', '.join(detected_services)}")
    for key, val in spec.items():
        if key in ("project_name", "budget", "refined_goal"):
            continue
        label = key.replace("_", " ").strip().title()
        lines.append(f"- {label}: {val}")
    if ai_suggested:
        formatted_suggestions = "; ".join(f"{k.replace('_', ' ')}: {v}" for k, v in ai_suggested.items())
        if formatted_suggestions:
            lines.append(f"- AI-Suggested Technical Specs (for confirmation): {formatted_suggestions}")
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
    ai_suggested_specs: dict[str, str] | None = None,
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

    if ai_suggested_specs:
        tech_lines = [
            f"- {k.replace('_', ' ').strip().title()}: {re.sub(r'\s+', ' ', v).strip()}"
            for k, v in ai_suggested_specs.items()
            if v and v.strip()
        ]
        if tech_lines:
            sections.append("Suggested Technical Specs:\n" + "\n".join(tech_lines))

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
    detected_services: Sequence[str] = (),
    ai_suggested_specs: dict[str, str] | None = None,
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
            detected_services=detected_services,
            ai_suggested=ai_suggested_specs,
        )
    )
    lines.append("")
    lines.append(
        'If anything needs to be changed (project name, budget, timeline, or requirements), reply with the update; otherwise click "Finalize Details & Match Specialists" to proceed.'
    )
    return "\n".join(lines)


def _infer_context_tags(text: str) -> list[str]:
    lowered = text.lower()
    known_tags = (
        "cafe", "coffee shop", "bakery", "restaurant", "hospitality",
        "ecommerce", "saas", "retail", "stationery", "subscription", "local business",
    )
    return [tag for tag in known_tags if tag in lowered]


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
        starting_budget = (
            request.current_budget
            if request.current_budget is not None
            else _parse_decimal(request.extracted_spec.get("budget"))
        )
        memory_state = _hydrate_requirements_state(
            initial_goal=request.initial_goal,
            messages=request.messages,
            extracted_spec=request.extracted_spec,
            existing_state=request.requirements_state,
        )
        service_guidance = build_service_consultation_guidance(memory_state.detected_services)

        context = {
            "initial_goal": request.initial_goal,
            "current_project_name": current_title,
            "messages": [m.model_dump() for m in request.messages],
            "current_budget": str(starting_budget) if starting_budget is not None else None,
            "currency": request.currency,
            "extracted_spec": request.extracted_spec,
            "scoping_memory": memory_state.model_dump(mode="json"),
            "already_asked_questions": memory_state.asked_questions,
            "service_guidance": service_guidance,
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

        # Update structured scoping memory transparently without breaking legacy clients
        detected = canonical_service_categories(
            res.detected_services or memory_state.detected_services
        )
        memory_state.detected_services = detected
        if res.refined_goal.strip():
            memory_state.ai_interpretation = res.refined_goal.strip()

        confirmed_additions = _attrs_to_dict(res.merchant_confirmed_specs)
        for k, v in _attrs_to_dict(res.extracted_spec).items():
            if k not in ("project_name", "budget", "refined_goal", "ai_suggested_tech"):
                memory_state.merchant_confirmed_specs[k] = v
        memory_state.merchant_confirmed_specs.update(confirmed_additions)

        suggested_additions = _attrs_to_dict(res.ai_suggested_specs)
        memory_state.ai_suggested_specs.update(suggested_additions)
        memory_state.ai_inferred_info.update(suggested_additions)

        if res.contradictions_or_changes:
            for change in res.contradictions_or_changes:
                cleaned_change = change.strip()
                if cleaned_change and cleaned_change not in memory_state.contradictions_or_changes:
                    memory_state.contradictions_or_changes.append(cleaned_change)

        readiness_map: dict[str, Literal["needs_info", "ready_for_matching"]] = {}
        for attr in res.service_readiness:
            svc_key = canonicalize_service(attr.key)
            val_norm = attr.value.strip().lower()
            readiness_map[svc_key] = (
                "ready_for_matching" if "ready" in val_norm else "needs_info"
            )
        for svc in detected:
            readiness_map.setdefault(
                svc,
                "ready_for_matching" if res.completeness_score >= 0.75 else "needs_info",
            )
        memory_state.service_readiness = readiness_map
        memory_state.missing_requirements = [
            item.strip() for item in res.missing_essential_requirements if item.strip()
        ]
        memory_state.optional_refinements = [
            item.strip() for item in res.missing_optional_requirements if item.strip()
        ]

        user_messages = [m for m in request.messages if m.role == "user"]
        has_user_reply = bool(user_messages)
        latest_user_text = user_messages[-1].content.strip().lower() if user_messages else ""
        explicit_early_proceed = any(phrase in latest_user_text for phrase in _EARLY_PROCEED_PHRASES) or (
            latest_user_text.rstrip(".!") in _TRIVIAL_CONFIRMATIONS
        )

        # Check whether essential matching blockers (e.g., on-site location or essential scope) remain
        all_services_ready = (
            all(status == "ready_for_matching" for status in readiness_map.values())
            if readiness_map
            else True
        )
        llm_wants_finalize = bool(
            res.is_ready_to_finalize
            or res.ready_for_decomposition
            or res.recommended_action == "ready_to_finalize"
        )
        # Never pre-finalize on Turn 0; allow ready_to_finalize when services are ready or user explicitly confirms
        is_ready = bool(
            has_user_reply
            and (
                explicit_early_proceed
                or (
                    llm_wants_finalize
                    and (not memory_state.missing_requirements or all_services_ready)
                )
            )
        )

        action: Literal["continue_asking", "ready_to_finalize"] = (
            "ready_to_finalize" if is_ready else "continue_asking"
        )
        clarifying_q = None if is_ready else (res.clarifying_question or res.reply)
        if clarifying_q:
            _append_unique_question(memory_state.asked_questions, clarifying_q)

        memory_state.awaiting_confirmation = is_ready and not (res.merchant_confirmed or explicit_early_proceed)
        memory_state.merchant_confirmed = bool(res.merchant_confirmed or (latest_user_text.rstrip(".!") in _TRIVIAL_CONFIRMATIONS))

        final_reply = (
            _format_gathered_review(
                initial_goal=request.initial_goal,
                project_name=resolved_project_name,
                budget=resolved_budget,
                currency=resolved_currency,
                spec=merged_spec,
                refined_goal=res.refined_goal,
                detected_services=detected,
                ai_suggested_specs=memory_state.ai_suggested_specs or None,
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
            requirements_state=memory_state,
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
    ) -> tuple[str, str, str, list[str], dict[str, str], list[str], dict[str, str], str]:
        goal = request.initial_goal.strip()
        user_notes = _extract_user_chat_notes(request.messages, goal)
        spec = dict(request.extracted_spec)
        combined_text = (
            goal + " " + " ".join(user_notes) + " " + " ".join(str(v) for v in spec.values())
        ).lower()

        detected = detect_services_from_text(combined_text)
        if not detected:
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

        ai_suggested = (
            dict(request.requirements_state.ai_suggested_specs)
            if request.requirements_state
            else {}
        )
        location = spec.get("location", "")

        full_brief = _compose_confirmed_brief(
            executive_brief=executive_brief,
            refined_goal=refined_goal,
            project_name=title,
            budget=budget,
            currency=currency,
            spec=updated_spec,
            detected_services=detected,
            additional_details=user_notes,
            ai_suggested_specs=ai_suggested or None,
        )
        return title, refined_goal, full_brief, detected, updated_spec, user_notes, ai_suggested, location

    async def finalize(self, request: ProjectScopingFinalizeRequest) -> ProjectScopingFinalizeResponse:
        spec_budget = _parse_decimal(request.extracted_spec.get("budget"))
        has_explicit_budget = request.budget is not None or spec_budget is not None
        fallback_budget = request.budget if request.budget is not None else (spec_budget or Decimal("1200"))

        memory_state = _hydrate_requirements_state(
            initial_goal=request.initial_goal,
            messages=request.messages,
            extracted_spec=request.extracted_spec,
            existing_state=request.requirements_state,
        )

        if self.llm.settings.is_demo:
            currency = (request.currency or "USD").strip().upper() or "USD"
            budget = fallback_budget
            (
                title,
                refined_goal,
                enriched_brief,
                detected,
                updated_spec,
                additional_details,
                ai_suggested,
                location,
            ) = self._synthesize_demo_brief(request, budget=budget, currency=currency)
        else:
            requested_title = request.project_name or request.extracted_spec.get("project_name")
            context = {
                "initial_goal": request.initial_goal,
                "messages": [m.model_dump() for m in request.messages],
                "extracted_spec": request.extracted_spec,
                "scoping_memory": memory_state.model_dump(mode="json"),
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
            if synthesized.final_budget is not None:
                budget = synthesized.final_budget
                has_explicit_budget = True
            else:
                budget = fallback_budget
            currency = (synthesized.currency or request.currency or "USD").strip().upper() or "USD"
            updated_spec = _merge_spec(request.extracted_spec, synthesized.extracted_spec)
            confirmed_map = _attrs_to_dict(synthesized.merchant_confirmed_specs)
            if confirmed_map:
                updated_spec.update(confirmed_map)
            updated_spec["project_name"] = title
            updated_spec["budget"] = str(budget)

            ai_suggested = dict(memory_state.ai_suggested_specs)
            ai_suggested.update(_attrs_to_dict(synthesized.ai_suggested_specs))
            location = synthesized.location.strip() or updated_spec.get("location", "")
            if location and not updated_spec.get("location"):
                updated_spec["location"] = location

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
                ai_suggested_specs=ai_suggested or None,
            )

        memory_state.detected_services = detected
        memory_state.ai_interpretation = refined_goal
        memory_state.ai_suggested_specs = ai_suggested
        memory_state.merchant_confirmed = True
        memory_state.awaiting_confirmation = False
        memory_state.service_readiness = {svc: "ready_for_matching" for svc in detected}

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
                context_tags = _infer_context_tags(f"{title} {enriched_brief} {request.initial_goal}")
                resolved_location = (location or updated_spec.get("location") or "").strip() or None
                assigned_top_ids: list[str] = []

                for pkg in packages:
                    alloc_amt = alloc_by_cat.get(pkg.service_category.lower()) if has_explicit_budget else None
                    match_brief = (
                        f"{pkg.description}\n\n{enriched_brief}"
                        if pkg.description
                        else enriched_brief
                    )
                    # Coordinate across multiple services in the same project to avoid duplicate top assignments
                    match_res = await self.freelancer_matcher.match(
                        FreelancerMatchingRequest(
                            service_category=pkg.service_category,
                            required_skills=pkg.required_skills,
                            brief=match_brief,
                            budget=alloc_amt,
                            max_delivery_days=pkg.estimated_days,
                            location=resolved_location,
                            project_context_tags=context_tags,
                            exclude_freelancer_ids=list(assigned_top_ids),
                            limit=3,
                        )
                    )
                    # If exclusion emptied the pool (small pool), re-run without excluding prior top picks
                    if not match_res.matches and assigned_top_ids:
                        match_res = await self.freelancer_matcher.match(
                            FreelancerMatchingRequest(
                                service_category=pkg.service_category,
                                required_skills=pkg.required_skills,
                                brief=match_brief,
                                budget=alloc_amt,
                                max_delivery_days=pkg.estimated_days,
                                location=resolved_location,
                                project_context_tags=context_tags,
                                limit=3,
                            )
                        )
                    if match_res.matches:
                        assigned_top_ids.append(match_res.matches[0].freelancer.freelancer_id)

                    freelancer_matches.append(
                        WorkPackageFreelancerMatch(
                            work_package_id=pkg.work_package_id,
                            service_category=pkg.service_category,
                            allocated_amount=alloc_amt,
                            match_result=match_res,
                        )
                    )

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
            requirements_state=memory_state,
        )
