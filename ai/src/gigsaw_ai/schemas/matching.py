from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from .common import SchemaModel
from .freelancers import Freelancer


class FreelancerMatchingRequest(SchemaModel):
    service_category: str
    required_skills: list[str] = Field(default_factory=list)
    brief: str = Field(default="")
    budget: Decimal | None = Field(default=None, ge=0)
    max_delivery_days: int | None = Field(default=None, ge=1)
    limit: int = Field(default=5, ge=1, le=20)
    exclude_freelancer_ids: list[str] = Field(default_factory=list)


class FreelancerMatch(SchemaModel):
    freelancer: Freelancer
    score: float = Field(ge=0, le=100)
    score_breakdown: dict[str, float]
    reasons: list[str]


class FreelancerMatchingResponse(SchemaModel):
    matches: list[FreelancerMatch]
    search_note: str


class FreelancerSwapRequest(SchemaModel):
    work_package_id: str | None = None
    service_category: str
    required_skills: list[str] = Field(default_factory=list)
    brief: str = Field(default="")
    budget: Decimal | None = Field(default=None, ge=0)
    max_delivery_days: int | None = Field(default=None, ge=1)
    current_freelancer_id: str
    exclude_freelancer_ids: list[str] = Field(default_factory=list)


class FreelancerSwapResponse(SchemaModel):
    swapped: bool
    work_package_id: str | None = None
    previous_freelancer_id: str
    new_match: FreelancerMatch | None = None
    message: str
