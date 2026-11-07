"""Build or refresh the local Chroma index from safe public freelancer profile fields."""
import asyncio

from gigsaw_ai.core.config import get_settings
from gigsaw_ai.core.exceptions import ConfigurationError
from gigsaw_ai.database.chroma import ChromaPortfolioStore
from gigsaw_ai.database.mongo import MongoDatabase
from gigsaw_ai.retrieval.embeddings import GeminiEmbeddingFunction


async def main() -> None:
    settings = get_settings()
    if settings.is_demo or settings.mongodb_schema_mode != "backend_mongoose":
        raise ConfigurationError("Set AI_PROVIDER=gemini and MONGODB_SCHEMA_MODE=backend_mongoose before indexing backend portfolios.")
    mongo = MongoDatabase(settings)
    await mongo.connect()
    try:
        freelancers, _, _ = mongo.repositories()
        store = ChromaPortfolioStore(settings, GeminiEmbeddingFunction(settings))
        await store.connect()
        count = 0
        for freelancer in await freelancers.list_all():
            document = " ".join([freelancer.portfolio_description, *freelancer.skills, *freelancer.service_categories])
            await store.upsert(freelancer.freelancer_id, document)
            count += 1
        print(f"Indexed {count} freelancer portfolio(s) into '{settings.chroma_collection}'.")
    finally:
        await mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
