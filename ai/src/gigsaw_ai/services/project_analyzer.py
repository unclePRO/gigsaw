from __future__ import annotations

import re

from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.schemas.projects import ProjectAnalysis, ProjectAnalyzeRequest
from gigsaw_ai.services.service_registry import SERVICE_ALIASES, canonicalize_service, detect_services_from_text


def canonical_service_category(value: str) -> str:
    """Map Gemini/backend wording to the catalogue's stable category keys."""
    return canonicalize_service(value)


def canonical_service_categories(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        category = canonical_service_category(value)
        if category not in result:
            result.append(category)
    return result


class ProjectAnalyzer:
    def __init__(self, llm: GeminiClient) -> None:
        self.llm = llm

    @staticmethod
    def _demo_analysis(request: ProjectAnalyzeRequest) -> ProjectAnalysis:
        text = request.customer_request.lower()
        services = detect_services_from_text(text) or [
            category for category, aliases in SERVICE_ALIASES.items() if any(alias in text for alias in aliases)
        ]
        if not services:
            services = ["graphic design"]
        # A narrow mention of social content generally implies launch management only when explicitly asked.
        name = request.project_name or ("Cafe launch" if "cafe" in text or "café" in text else "Customer project")
        goal = "Launch a coherent customer-facing presence" if "launch" in text or "open" in text else "Deliver the requested freelance services"
        budget_assumption = f"Customer provided a {request.currency} budget of {request.budget}." if request.budget is not None else "No total budget was supplied."
        return ProjectAnalysis(
            project_name=name,
            business_goal=goal,
            summary=re.sub(r"\s+", " ", request.customer_request).strip(),
            required_services=services,
            assumptions=[budget_assumption, "Recommendations require backend validation before any authorised action."],
            risks=["Scope, timeline, and final quotation acceptance must be confirmed by the parties."],
        )

    async def analyze(self, request: ProjectAnalyzeRequest) -> ProjectAnalysis:
        demo = self._demo_analysis(request)
        result = await self.llm.generate_structured(
            "project_analysis", {"customer_request": request.customer_request, "budget": request.budget, "currency": request.currency}, ProjectAnalysis, demo
        )
        updates = {"required_services": canonical_service_categories(result.required_services)}
        if request.project_name:
            updates["project_name"] = request.project_name
        return result.model_copy(update=updates)
