"""Initialize a separate AI-owned catalogue with clearly marked starter prices.

Run only for a development database and have the marketplace team review every
amount before treating it as trusted production pricing.
"""
import argparse
import asyncio

from gigsaw_ai.core.config import get_settings
from gigsaw_ai.core.exceptions import ConfigurationError
from gigsaw_ai.database.mongo import MongoDatabase
from gigsaw_ai.database.seed import demo_services


async def main() -> None:
    arguments = argparse.ArgumentParser(description="Create a starter AI service catalogue.")
    arguments.add_argument("--confirm-starter-prices", action="store_true", help="Confirm that these are starter development prices, not approved marketplace prices.")
    args = arguments.parse_args()
    settings = get_settings()
    if settings.is_demo or settings.mongodb_schema_mode != "backend_mongoose":
        raise ConfigurationError("Set AI_PROVIDER=gemini and MONGODB_SCHEMA_MODE=backend_mongoose first.")
    if not args.confirm_starter_prices:
        raise SystemExit("Nothing was written. Re-run with --confirm-starter-prices after reviewing the values in database/seed.py.")
    mongo = MongoDatabase(settings)
    await mongo.connect()
    try:
        _, services, _ = mongo.repositories()
        await services.upsert_many(demo_services())
        print(f"Created starter catalogue in '{settings.backend_service_catalog_collection}'. Review prices before production use.")
    finally:
        await mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
