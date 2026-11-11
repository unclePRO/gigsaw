from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import Field

from .common import SchemaModel
from .matching import FreelancerMatchingResponse
from .projects import ProjectAnalyzeResponse


class ChatMessage(SchemaModel):
    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: str | None = None


class ProjectScopingChatRequest(SchemaModel):
    initial_goal: str = Field(min_length=2, description="Merchant's high-level goal from Step 1")
    messages: list[ChatMessage] = Field(default_factory=list, description="Recent conversation turns")
    current_budget: Decimal | None = Field(default=None, ge=0)
    currency: str = "USD"
    project_name: str | None = None
    extracted_spec: dict[str, str] = Field(default_factory=dict)


class ProjectScopingChatResponse(SchemaModel):
    project_name: str | None = None
    current_budget: Decimal | None = None
    currency: str = "USD"
    budget_changed: bool = False
    reply: str
    clarifying_question: str | None = None
    suggested_replies: list[str] = Field(default_factory=list)
    extracted_spec: dict[str, str] = Field(default_factory=dict)
    completeness_score: float = Field(ge=0.0, le=1.0)
    is_ready_to_finalize: bool = False
    ready_for_decomposition: bool = False
    recommended_action: Literal["continue_asking", "ready_to_finalize"] = "continue_asking"


class ProjectScopingTitleRequest(SchemaModel):
    initial_goal: str = Field(min_length=2)
    messages: list[ChatMessage] = Field(default_factory=list)
    current_project_name: str | None = None
    extracted_spec: dict[str, str] = Field(default_factory=dict)


class ProjectScopingTitleResponse(SchemaModel):
    project_name: str
    source: Literal["user_specified", "ai_generated"] = "ai_generated"


class WorkPackageFreelancerMatch(SchemaModel):
    work_package_id: str
    service_category: str
    allocated_amount: Decimal | None = None
    match_result: FreelancerMatchingResponse


class ProjectScopingFinalizeRequest(SchemaModel):
    initial_goal: str = Field(min_length=2)
    messages: list[ChatMessage] = Field(default_factory=list)
    extracted_spec: dict[str, str] = Field(default_factory=dict)
    budget: Decimal | None = Field(default=None, ge=0)
    currency: str = "USD"
    project_name: str | None = None
    auto_decompose: bool = True


class ProjectScopingFinalizeResponse(SchemaModel):
    project_name: str
    enriched_brief: str
    detected_services: list[str]
    budget: Decimal | None = None
    suggested_budget: Decimal | None = None
    currency: str = "USD"
    extracted_spec: dict[str, str] = Field(default_factory=dict)
    additional_details: list[str] = Field(default_factory=list)
    analysis_result: ProjectAnalyzeResponse | None = None
    freelancer_matches: list[WorkPackageFreelancerMatch] = Field(default_factory=list)
