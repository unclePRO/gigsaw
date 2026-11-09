from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import Field

from .common import SchemaModel


class FreelancerInvitationReviewRequest(SchemaModel):
    freelancer_id: str
    project_name: str
    merchant_name: str = "Merchant"
    work_package_title: str
    service_category: str
    description: str
    deliverables: list[str] = Field(default_factory=list)
    allocated_price: Decimal = Field(ge=0)
    estimated_days: int = Field(ge=1)
    currency: str = "USD"


class FreelancerInvitationReviewResponse(SchemaModel):
    feasibility_score: float = Field(ge=0.0, le=100.0)
    feasibility_assessment: Literal["high", "moderate", "low"]
    market_rate_evaluation: str
    estimated_hours: int
    pros: list[str]
    watchouts: list[str]
    suggested_decision: Literal["accept", "counteroffer", "request_clarification"]
    recommended_counteroffer_amount: Decimal | None = None
    recommended_counteroffer_days: int | None = None
    counteroffer_rationale: str | None = None
