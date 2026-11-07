from __future__ import annotations

from typing import Any

from gigsaw_ai.core.exceptions import ConfigurationError


def _mongo_identifier(value: str) -> Any:
    try:
        from bson import ObjectId
        return ObjectId(value) if ObjectId.is_valid(value) else value
    except ImportError:
        return value


class InMemoryProjectRepository:
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    async def upsert(self, document: dict) -> None:
        self._items[document["project_id"]] = document.copy()

    async def get(self, project_id: str) -> dict | None:
        item = self._items.get(project_id)
        return item.copy() if item else None


class MongoProjectRepository:
    def __init__(self, collection) -> None:
        self.collection = collection

    async def ensure_indexes(self) -> None:
        await self.collection.create_index("project_id", unique=True)

    async def upsert(self, document: dict) -> None:
        await self.collection.replace_one({"project_id": document["project_id"]}, document, upsert=True)

    async def get(self, project_id: str) -> dict | None:
        return await self.collection.find_one({"project_id": project_id}, {"_id": 0})


class MongoBackendProjectRepository:
    """Read-only adapter for the Node.js Mongoose `Project` model."""

    def __init__(self, collection) -> None:
        self.collection = collection

    async def upsert(self, document: dict) -> None:
        raise ConfigurationError("The AI service never writes the backend 'projects' collection.")

    async def get(self, project_id: str) -> dict | None:
        document = await self.collection.find_one({"_id": _mongo_identifier(project_id)})
        if not document:
            return None
        return {
            "project_id": str(document["_id"]),
            "name": document.get("projectName"),
            "customer_request": document.get("merchantPrompt"),
            "budget": document.get("totalBudget"),
            "work_packages": document.get("workPackages", []),
            "status": document.get("status"),
        }
