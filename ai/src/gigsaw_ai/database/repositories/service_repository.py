from __future__ import annotations

from collections.abc import Sequence
from decimal import Decimal

from gigsaw_ai.schemas.freelancers import ServiceCatalogItem


class InMemoryServiceRepository:
    def __init__(self, services: Sequence[ServiceCatalogItem] = ()) -> None:
        self._items = {item.category.lower(): item for item in services}

    async def get_by_categories(self, categories: Sequence[str]) -> Sequence[ServiceCatalogItem]:
        return [self._items[category.lower()] for category in categories if category.lower() in self._items]

    async def upsert_many(self, services: Sequence[ServiceCatalogItem]) -> None:
        self._items.update({item.category.lower(): item for item in services})


class MongoServiceRepository:
    def __init__(self, collection) -> None:
        self.collection = collection

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("service_id", unique=True)
        await self.collection.create_index("category", unique=True)

    async def get_by_categories(self, categories: Sequence[str]) -> Sequence[ServiceCatalogItem]:
        cursor = self.collection.find({"category": {"$in": list(categories)}}, {"_id": 0})
        items = [ServiceCatalogItem.model_validate(item) async for item in cursor]
        wanted = {category.lower() for category in categories}
        return [item for item in items if item.category.lower() in wanted]

    async def upsert_many(self, services: Sequence[ServiceCatalogItem]) -> None:
        for service in services:
            await self.collection.replace_one(
                {"service_id": service.service_id}, service.model_dump(mode="json"), upsert=True
            )


class MongoBackendServiceRepository:
    """Adapter for the separate AI-owned service catalogue using Node.js-style field names."""

    def __init__(self, collection) -> None:
        self.collection = collection

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("category", unique=True)

    @staticmethod
    def _model(document: dict) -> ServiceCatalogItem:
        return ServiceCatalogItem(
            service_id=str(document.get("serviceId") or document["_id"]),
            category=document["category"],
            description=document.get("description") or "",
            baseline_price=Decimal(str(document["baselinePrice"])),
            minimum_price=Decimal(str(document["minimumPrice"])),
            maximum_price=Decimal(str(document["maximumPrice"])),
            currency=document.get("currency") or "USD",
        )

    async def get_by_categories(self, categories: Sequence[str]) -> Sequence[ServiceCatalogItem]:
        cursor = self.collection.find({"category": {"$in": list(categories)}})
        return [self._model(item) async for item in cursor]

    async def upsert_many(self, services: Sequence[ServiceCatalogItem]) -> None:
        for service in services:
            document = {
                "serviceId": service.service_id,
                "category": service.category,
                "description": service.description,
                "baselinePrice": str(service.baseline_price),
                "minimumPrice": str(service.minimum_price),
                "maximumPrice": str(service.maximum_price),
                "currency": service.currency,
                "managedBy": "gigsaw-ai",
            }
            await self.collection.replace_one({"category": service.category}, document, upsert=True)
