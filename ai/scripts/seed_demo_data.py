"""Seed explicitly fictional GigSaw demo records into the configured stores."""
import asyncio

from gigsaw_ai.core.config import get_settings
from gigsaw_ai.database.chroma import ChromaPortfolioStore, InMemoryPortfolioStore
from gigsaw_ai.database.mongo import MongoDatabase
from gigsaw_ai.database.repositories.freelancer_repository import InMemoryFreelancerRepository
from gigsaw_ai.database.repositories.project_repository import InMemoryProjectRepository
from gigsaw_ai.database.repositories.service_repository import InMemoryServiceRepository
from gigsaw_ai.database.seed import seed_repositories
from gigsaw_ai.retrieval.embeddings import GeminiEmbeddingFunction


async def main() -> None:
    settings = get_settings()
    if settings.is_demo:
        freelancer_repository = InMemoryFreelancerRepository()
        service_repository = InMemoryServiceRepository()
        project_repository = InMemoryProjectRepository()
        store = InMemoryPortfolioStore()
        await seed_repositories(freelancer_repository, service_repository, store, project_repository)
        print("Demo data validated in memory (demo mode has no persistent database).")
        return
    if settings.mongodb_schema_mode == "backend_mongoose":
        raise SystemExit(
            "Refusing to seed fictional demo data into the Node.js backend schema. "
            "Use scripts/initialize_backend_catalog.py for the separate AI catalogue, then index real portfolios."
        )
    mongo = MongoDatabase(settings)
    await mongo.connect()
    try:
        freelancers, services, projects = mongo.repositories()
        store = ChromaPortfolioStore(settings, GeminiEmbeddingFunction(settings))
        await store.connect()
        await seed_repositories(
            freelancers, services, store, projects,
            work_package_collection=mongo.db.work_packages,
            quotation_collection=mongo.db.quotations,
        )
        print("Seeded fictional demo records into MongoDB and ChromaDB.")
    finally:
        await mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
