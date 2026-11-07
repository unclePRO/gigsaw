from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import Field

from .budget import BudgetPlan
from .common import SchemaModel
from .work_packages import WorkPackage


class ProjectAnalyzeRequest(SchemaModel):
    customer_request: str = Field(min_length=10, examples=["I need a cafe website, logo, food photos, menu and social media for $2,000."])
    budget: Decimal | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    project_name: str | None = Field(default=None, max_length=120)


class ProjectAnalysis(SchemaModel):
    project_name: str
    business_goal: str
    summary: str
    required_services: list[str] = Field(min_length=1)
    assumptions: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)


class ProjectBudget(SchemaModel):
    amount: Decimal = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)
    pricing_status: Literal["pending", "catalogue_planned"] = "pending"


class ProjectAnalyzeResponse(SchemaModel):
    analysis: ProjectAnalysis
    budget: ProjectBudget | None = None
    budget_plan: BudgetPlan | None = None
    work_packages: list[WorkPackage]
    dependency_plan: dict[str, list[str]]
