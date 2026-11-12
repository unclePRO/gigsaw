from __future__ import annotations

import re
from collections.abc import Sequence
from decimal import Decimal
from typing import Any

from gigsaw_ai.core.exceptions import ConfigurationError
from gigsaw_ai.schemas.freelancers import Freelancer, PortfolioReference


BACKEND_CATEGORY_SERVICES = {
    "dev": ["website development"],
    "designer": ["logo and branding", "graphic design", "social media creatives", "digital menu design"],
    "marketer": ["social media management", "digital marketing"],
}


def _mongo_identifier(value: str) -> Any:
    """Convert an incoming Mongoose ObjectId string when possible."""
    try:
        from bson import ObjectId
        return ObjectId(value) if ObjectId.is_valid(value) else value
    except ImportError:
        return value


def _backend_user_to_freelancer(document: dict[str, Any]) -> Freelancer:
    """Map the Node.js `User` Mongoose schema into the AI's safe read model.

    Password, PayPal email, account email, and other credentials are deliberately
    excluded from this model and from the Chroma portfolio document.
    """
    category = str(document.get("category") or "").lower()
    past_projects = document.get("pastProjects") or []
    portfolio_references = [
        PortfolioReference(title=str(item.get("title", "Past project")), url=item.get("projectUrl"))
        for item in past_projects if isinstance(item, dict)
    ]
    portfolio_sections = [str(document.get("bio") or "").strip()]
    for item in past_projects:
        if isinstance(item, dict):
            portfolio_sections.extend([
                str(item.get("title") or ""), str(item.get("description") or ""),
                " ".join(str(technology) for technology in item.get("technologies", [])),
            ])
    completed = int(document.get("completedProjects") or 0)
    explicit_years = document.get("yearsOfExperience")
    experience = int(explicit_years) if explicit_years is not None else min(20, max(0, completed // 5))

    raw_categories = document.get("serviceCategories")
    if isinstance(raw_categories, list) and raw_categories:
        service_categories = [str(sc).strip().lower() for sc in raw_categories if sc]
    else:
        service_categories = BACKEND_CATEGORY_SERVICES.get(category, [])

    return Freelancer(
        freelancer_id=str(document["_id"]),
        name=str(document.get("name") or "Unnamed freelancer"),
        title=str(document.get("title") or "").strip(),
        skills=[str(skill) for skill in document.get("skills", []) if skill],
        service_categories=service_categories,
        experience_years=experience,
        rating=max(0.0, min(5.0, float(document.get("rating") or 0))),
        availability=document.get("availability", "available") == "available",
        indicative_price=Decimal(str(document.get("indicativeProjectPrice") or document.get("hourlyRate") or 0)),
        price_basis="project" if document.get("indicativeProjectPrice") is not None else "hour",
        delivery_days=max(1, int(document.get("typicalDeliveryDays") or 14)),
        portfolio_description=" ".join(section for section in portfolio_sections if section).strip() or "No portfolio description provided.",
        location=str(document.get("location") or "Not specified"),
        portfolio_references=portfolio_references,
        bio=str(document.get("bio") or "").strip() or None,
        completed_projects=completed,
        category=category or None,
        email=str(document.get("email") or "") if document.get("email") else None,
        is_profile_complete=bool(document["isProfileComplete"]) if "isProfileComplete" in document else True,
        remote_ok=bool(document.get("remoteOk", True)),
        travel_radius_km=document.get("travelRadiusKm"),
        negotiable_pricing=bool(document.get("negotiablePricing", False)),
        active_project_count=int(document.get("activeProjectCount") or 0),
        max_concurrent_projects=max(1, int(document.get("maxConcurrentProjects") or 3)),
        available_from_days=max(0, int(document.get("availableFromDays") or 0)),
        verified=bool(document.get("verified", False)),
        response_rate=document.get("responseRate"),
        on_time_rate=document.get("onTimeRate"),
        cancellation_rate=document.get("cancellationRate"),
        domain_experience_tags=[str(tag) for tag in document.get("domainTags", []) if tag],
        rating_count=int(document.get("ratingCount") or 0),
    )


class InMemoryFreelancerRepository:
    """Demo/test implementation with the same contract as the Mongo repository."""

    def __init__(self, freelancers: Sequence[Freelancer] = ()) -> None:
        self._items = {item.freelancer_id: item for item in freelancers}

    async def get(self, freelancer_id: str) -> Freelancer | None:
        return self._items.get(freelancer_id)

    async def list_available(self, service_category: str | None = None) -> Sequence[Freelancer]:
        return [
            freelancer
            for freelancer in self._items.values()
            if freelancer.availability
            and freelancer.is_profile_complete
            and (
                service_category is None
                or service_category.lower() in {x.lower() for x in freelancer.service_categories}
                or (freelancer.category and service_category.lower() == freelancer.category.lower())
            )
        ]

    async def list_all(self) -> Sequence[Freelancer]:
        return list(self._items.values())

    async def upsert_many(self, freelancers: Sequence[Freelancer]) -> None:
        self._items.update({item.freelancer_id: item for item in freelancers})


class MongoFreelancerRepository:
    """Freelancer source-of-truth adapter; Chroma never substitutes for it."""

    def __init__(self, collection) -> None:
        self.collection = collection

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("freelancer_id", unique=True)
        await self.collection.create_index([("availability", 1), ("service_categories", 1)])
        await self.collection.create_index("rating")

    async def get(self, freelancer_id: str) -> Freelancer | None:
        document = await self.collection.find_one({"freelancer_id": freelancer_id}, {"_id": 0})
        return Freelancer.model_validate(document) if document else None

    async def list_available(self, service_category: str | None = None) -> Sequence[Freelancer]:
        query: dict = {"availability": True, "is_profile_complete": {"$ne": False}}
        if service_category:
            query["service_categories"] = {"$regex": f"^{re.escape(service_category)}$", "$options": "i"}
        cursor = self.collection.find(query, {"_id": 0})
        return [Freelancer.model_validate(item) async for item in cursor]

    async def list_all(self) -> Sequence[Freelancer]:
        cursor = self.collection.find({}, {"_id": 0})
        return [Freelancer.model_validate(item) async for item in cursor]

    async def upsert_many(self, freelancers: Sequence[Freelancer]) -> None:
        for freelancer in freelancers:
            await self.collection.replace_one(
                {"freelancer_id": freelancer.freelancer_id},
                freelancer.model_dump(mode="json"),
                upsert=True,
            )


class MongoBackendUserRepository:
    """Read adapter for the Node.js Mongoose `User` model supplied by the backend.

    It never writes to `users`; user registration and profile ownership remain in
    the Node.js backend. Fields missing from the existing model are represented by
    conservative defaults until the backend adds the recommended optional fields.
    """

    def __init__(self, collection) -> None:
        self.collection = collection

    async def ensure_indexes(self) -> None:
        # Non-unique only: no backend identity or data constraint is changed.
        await self.collection.create_index([("role", 1), ("availability", 1), ("isProfileComplete", 1), ("category", 1)])

    async def get(self, freelancer_id: str) -> Freelancer | None:
        document = await self.collection.find_one({"_id": _mongo_identifier(freelancer_id), "role": "freelancer"})
        return _backend_user_to_freelancer(document) if document else None

    async def list_available(self, service_category: str | None = None) -> Sequence[Freelancer]:
        query: dict[str, Any] = {
            "role": "freelancer",
            "availability": "available",
            "isProfileComplete": True,
        }
        if service_category:
            cat_lower = service_category.lower()
            category_key = next((key for key, services in BACKEND_CATEGORY_SERVICES.items() if cat_lower in services), None)
            matched_categories = [category_key] if category_key else []
            if cat_lower in BACKEND_CATEGORY_SERVICES:
                matched_categories.append(cat_lower)

            or_clauses: list[dict[str, Any]] = [
                {"serviceCategories": {"$regex": f"^{re.escape(service_category)}$", "$options": "i"}}
            ]
            if matched_categories:
                or_clauses.append({"category": {"$in": matched_categories}})
            query["$or"] = or_clauses

        cursor = self.collection.find(query)
        return [_backend_user_to_freelancer(item) async for item in cursor]

    async def list_all(self) -> Sequence[Freelancer]:
        cursor = self.collection.find({"role": "freelancer"})
        return [_backend_user_to_freelancer(item) async for item in cursor]

    async def upsert_many(self, freelancers: Sequence[Freelancer]) -> None:
        raise ConfigurationError("The AI service never seeds or writes the backend 'users' collection.")
