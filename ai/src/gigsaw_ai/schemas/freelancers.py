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


class ServiceCatalogItem(SchemaModel):
    service_id: str
    category: str
    description: str
    baseline_price: Decimal = Field(ge=0)
    minimum_price: Decimal = Field(ge=0)
    maximum_price: Decimal = Field(ge=0)
    currency: str = "USD"
