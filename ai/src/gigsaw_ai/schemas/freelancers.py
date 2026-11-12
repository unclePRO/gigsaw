from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import Field

from .common import SchemaModel


class PortfolioReference(SchemaModel):
    title: str
    url: str | None = None


class Freelancer(SchemaModel):
    freelancer_id: str
    name: str
    skills: list[str]
    service_categories: list[str]
    experience_years: int = Field(ge=0)
    rating: float = Field(ge=0, le=5)
    availability: bool
    indicative_price: Decimal = Field(ge=0)
    price_basis: Literal["project", "hour"] = "project"
    currency: str = "USD"
    delivery_days: int = Field(ge=1)
    portfolio_description: str
    location: str
    portfolio_references: list[PortfolioReference] = Field(default_factory=list)
    bio: str | None = None
    completed_projects: int = 0
    category: str | None = None
    email: str | None = None
    title: str = ""
    is_profile_complete: bool = True
    remote_ok: bool = True
    travel_radius_km: int | None = None
    negotiable_pricing: bool = False
    active_project_count: int = 0
    max_concurrent_projects: int = 3
    available_from_days: int = 0
    verified: bool = False
    response_rate: float | None = Field(default=None, ge=0, le=1)
    on_time_rate: float | None = Field(default=None, ge=0, le=1)
    cancellation_rate: float | None = Field(default=None, ge=0, le=1)
    domain_experience_tags: list[str] = Field(default_factory=list)
    rating_count: int = 0


class ServiceCatalogItem(SchemaModel):
    service_id: str
    category: str
    description: str
    baseline_price: Decimal = Field(ge=0)
    minimum_price: Decimal = Field(ge=0)
    maximum_price: Decimal = Field(ge=0)
    currency: str = "USD"
