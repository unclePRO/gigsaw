from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from .common import SchemaModel


class BudgetAllocation(SchemaModel):
    service_category: str
    trusted_baseline: Decimal = Field(ge=0)
    recommended_amount: Decimal = Field(ge=0)
    rationale: str


class BudgetPlan(SchemaModel):
    currency: str
    total_budget: Decimal = Field(ge=0)
    allocated_total: Decimal = Field(ge=0)
    allocations: list[BudgetAllocation]
    warnings: list[str] = Field(default_factory=list)
