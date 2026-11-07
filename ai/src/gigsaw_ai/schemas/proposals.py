from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import Field

from .common import SchemaModel


class Quotation(SchemaModel):
    quotation_id: str
    freelancer_id: str
    work_package_id: str
    amount: Decimal = Field(ge=0)
    currency: str = "USD"
    delivery_days: int = Field(ge=1)
    scope: str
    status: Literal["pending", "accepted", "declined", "counteroffer"] = "pending"


class ProposalGenerateRequest(SchemaModel):
    project_id: str
    project_name: str
    quotations: list[Quotation] = Field(min_length=1)
    currency: str = "USD"


class ConsolidatedProposal(SchemaModel):
    proposal_id: str
    project_id: str
    project_name: str
    currency: str
    accepted_quotations: list[Quotation]
    total: Decimal = Field(ge=0)
    summary: str
    assumptions: list[str]


class CounterofferAnalyzeRequest(SchemaModel):
    original_quotation: Quotation
    proposed_amount: Decimal = Field(ge=0)
    proposed_delivery_days: int = Field(ge=1)
    message: str = Field(min_length=3)
    project_budget_remaining: Decimal | None = Field(default=None, ge=0)


class CounterofferAnalysis(SchemaModel):
    amount_delta: Decimal
    percentage_delta: float
    delivery_days_delta: int
    budget_impact: str
    recommendation: str
    approval_required: bool = True
