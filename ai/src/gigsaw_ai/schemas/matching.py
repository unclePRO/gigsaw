from __future__ import annotations

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import Field

from .common import SchemaModel
from .freelancers import Freelancer


class MatchingWeights(SchemaModel):
    """Configurable weighted scoring configuration for deterministic Python ranking."""

    service_relevance: float = Field(default=0.20, ge=0.0)
    skill_compatibility: float = Field(default=0.20, ge=0.0)
    portfolio_relevance: float = Field(default=0.20, ge=0.0)
    project_experience: float = Field(default=0.10, ge=0.0)
    budget_compatibility: float = Field(default=0.10, ge=0.0)
    availability: float = Field(default=0.10, ge=0.0)
    location: float = Field(default=0.05, ge=0.0)
    reliability: float = Field(default=0.05, ge=0.0)

    def normalized(self) -> dict[str, float]:
        raw = {
            "service_relevance": float(self.service_relevance),
            "skill_compatibility": float(self.skill_compatibility),
            "portfolio_relevance": float(self.portfolio_relevance),
            "project_experience": float(self.project_experience),
            "budget_compatibility": float(self.budget_compatibility),
            "availability": float(self.availability),
            "location": float(self.location),
            "reliability": float(self.reliability),
        }
        total = sum(raw.values())
        if total <= 0:
            return {
                "service_relevance": 0.20,
                "skill_compatibility": 0.20,
                "portfolio_relevance": 0.20,
                "project_experience": 0.10,
                "budget_compatibility": 0.10,
                "availability": 0.10,
                "location": 0.05,
                "reliability": 0.05,
            }
        return {key: val / total for key, val in raw.items()}


class FreelancerMatchingRequest(SchemaModel):
    service_category: str
    required_skills: list[str] = Field(default_factory=list)
    mandatory_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    brief: str = Field(default="")
    budget: Decimal | None = Field(default=None, ge=0)
    max_delivery_days: int | None = Field(default=None, ge=1)
    location: str | None = None
    require_onsite: bool | None = None
    project_context_tags: list[str] = Field(default_factory=list)
    allow_related_categories: bool = True
    budget_soft_margin: float = Field(default=0.30, ge=0.0, le=1.0)
    weights: MatchingWeights | None = None
    limit: int = Field(default=5, ge=1, le=20)
    exclude_freelancer_ids: list[str] = Field(default_factory=list)


class FreelancerMatch(SchemaModel):
    freelancer: Freelancer
    score: float = Field(ge=0, le=100)
    score_breakdown: dict[str, float]
    reasons: list[str]
    potential_gaps: list[str] = Field(default_factory=list)
    budget_status: Literal[
        "within_budget",
        "slightly_above_budget",
        "above_budget",
        "hourly_estimate",
        "negotiable",
        "unknown",
    ] = "unknown"
    availability_status: Literal[
        "available_now",
        "fits_deadline",
        "tight_timeline",
        "unavailable",
    ] = "available_now"
    category_match_type: Literal["exact", "related"] = "exact"


class FreelancerMatchingResponse(SchemaModel):
    matches: list[FreelancerMatch]
    search_note: str
    search_metadata: dict[str, Any] = Field(default_factory=dict)


class FreelancerSwapRequest(SchemaModel):
    work_package_id: str | None = None
    service_category: str
    required_skills: list[str] = Field(default_factory=list)
    mandatory_skills: list[str] = Field(default_factory=list)
    brief: str = Field(default="")
    budget: Decimal | None = Field(default=None, ge=0)
    max_delivery_days: int | None = Field(default=None, ge=1)
    location: str | None = None
    require_onsite: bool | None = None
    current_freelancer_id: str
    exclude_freelancer_ids: list[str] = Field(default_factory=list)


class FreelancerSwapResponse(SchemaModel):
    swapped: bool
    work_package_id: str | None = None
    previous_freelancer_id: str
    new_match: FreelancerMatch | None = None
    message: str
