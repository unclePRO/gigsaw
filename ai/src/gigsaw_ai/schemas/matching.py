from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from .common import SchemaModel
from .freelancers import Freelancer


class FreelancerMatchingRequest(SchemaModel):
    service_category: str
    required_skills: list[str] = Field(min_length=1)
    brief: str = Field(min_length=5)
    budget: Decimal | None = Field(default=None, ge=0)
    max_delivery_days: int | None = Field(default=None, ge=1)
    limit: int = Field(default=5, ge=1, le=20)


class FreelancerMatch(SchemaModel):
    freelancer: Freelancer
    score: float = Field(ge=0, le=100)
    score_breakdown: dict[str, float]
    reasons: list[str]


class FreelancerMatchingResponse(SchemaModel):
    matches: list[FreelancerMatch]
    search_note: str
