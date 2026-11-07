from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import Field

from .common import SchemaModel


class ProgressTask(SchemaModel):
    work_package_id: str
    name: str
    status: Literal["not_started", "in_progress", "blocked", "completed"]
    due_date: date | None = None
    blocker: str | None = None


class ProgressSummaryRequest(SchemaModel):
    project_name: str
    tasks: list[ProgressTask] = Field(min_length=1)


class ProgressSummary(SchemaModel):
    project_name: str
    completion_percentage: float = Field(ge=0, le=100)
    completed_count: int
    in_progress_count: int
    blocked_tasks: list[str]
    overdue_tasks: list[str]
    summary: str
    recommended_actions: list[str]
