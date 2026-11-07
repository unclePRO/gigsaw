from __future__ import annotations

import logging

from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ConfigurationError, ProviderError
from gigsaw_ai.database.repositories.freelancer_repository import MongoBackendUserRepository, MongoFreelancerRepository
from gigsaw_ai.database.repositories.project_repository import MongoBackendProjectRepository, MongoProjectRepository
from gigsaw_ai.database.repositories.service_repository import MongoBackendServiceRepository, MongoServiceRepository

logger = logging.getLogger(__name__)


class MongoDatabase:
    """Async PyMongo lifecycle owner and repository factory."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.client = None
        self.db = None

    async def connect(self) -> None:
        try:
            from pymongo import AsyncMongoClient
            import certifi
        except ImportError as exc:
            raise ConfigurationError("Install pymongo[srv] and certifi from requirements.txt.") from exc
        try:
            self.client = AsyncMongoClient(
                self.settings.mongodb_uri,
                serverSelectionTimeoutMS=5000,
                tlsCAFile=certifi.where(),
            )
            await self.client.admin.command("ping")
            self.db = self.client[self.settings.mongodb_database]
            await self.ensure_indexes()
            logger.info("Connected to MongoDB database %s", self.settings.mongodb_database)
        except Exception as exc:
            await self.close()
            raise ProviderError("MongoDB connection failed. Check MONGODB_URI and server availability.") from exc

    async def ensure_indexes(self) -> None:
        if self.db is None:
            raise ConfigurationError("MongoDB is not connected.")
        if self.settings.mongodb_schema_mode == "backend_mongoose":
            if self.settings.manage_mongo_indexes:
                await MongoBackendUserRepository(self.db[self.settings.backend_users_collection]).ensure_indexes()
                await MongoBackendServiceRepository(self.db[self.settings.backend_service_catalog_collection]).ensure_indexes()
            return
        await MongoFreelancerRepository(self.db.freelancers).ensure_indexes()
        await MongoServiceRepository(self.db.services).ensure_indexes()
        await MongoProjectRepository(self.db.projects).ensure_indexes()
        await self.db.work_packages.create_index([("project_id", 1), ("work_package_id", 1)], unique=True)
        await self.db.quotations.create_index("quotation_id", unique=True)
        await self.db.proposals.create_index("proposal_id", unique=True)

    def repositories(self):
        if self.db is None:
            raise ConfigurationError("MongoDB is not connected.")
        if self.settings.mongodb_schema_mode == "backend_mongoose":
            return (
                MongoBackendUserRepository(self.db[self.settings.backend_users_collection]),
                MongoBackendServiceRepository(self.db[self.settings.backend_service_catalog_collection]),
                MongoBackendProjectRepository(self.db[self.settings.backend_projects_collection]),
            )
        return (
            MongoFreelancerRepository(self.db.freelancers),
            MongoServiceRepository(self.db.services),
            MongoProjectRepository(self.db.projects),
        )

    async def close(self) -> None:
        if self.client is not None:
            await self.client.close()
            self.client = None
            self.db = None
