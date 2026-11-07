from __future__ import annotations

from typing import Literal

from pydantic import Field

from .common import SchemaModel


class WorkPackage(SchemaModel):
    work_package_id: str
    name: str
    service_category: str
    description: str
    required_skills: list[str] = Field(min_length=1)
    deliverables: list[str] = Field(min_length=1)
    dependencies: list[str] = Field(default_factory=list)
    estimated_days: int = Field(ge=1, le=365)
    delivery_period_days: int | None = Field(default=None, ge=1, le=3650)
    estimate_basis: Literal["working_days", "calendar_period"] = "working_days"
    estimate_status: Literal["initial_estimate", "backend_confirmed"] = "initial_estimate"
    status: Literal["not_started", "in_progress", "blocked", "completed"] = "not_started"


class DependencyPlan(SchemaModel):
    execution_order: list[str]
    edges: dict[str, list[str]]
