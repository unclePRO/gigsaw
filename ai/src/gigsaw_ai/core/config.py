from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration, loaded from environment variables or `.env`."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gigsaw_env: str = Field(default="development", alias="GIGSAW_ENV")
    ai_provider: Literal["demo", "gemini"] = Field(default="demo", alias="AI_PROVIDER")
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY", repr=False)
    gemini_model: str = Field(default="gemini-3.5-flash-lite", alias="GEMINI_MODEL")
    gemini_fallback_models: list[str] = Field(default_factory=lambda: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"], alias="GEMINI_FALLBACK_MODELS")
    gemini_embedding_model: str = Field(default="gemini-embedding-001", alias="GEMINI_EMBEDDING_MODEL")
    mongodb_uri: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URI", repr=False)
    mongodb_database: str = Field(
        default="gigsaw",
        validation_alias=AliasChoices("MONGODB_DATABASE", "MONGODB_DB_NAME"),
    )
    mongodb_schema_mode: Literal["native", "backend_mongoose"] = Field(default="native", alias="MONGODB_SCHEMA_MODE")
    manage_mongo_indexes: bool = Field(default=False, alias="MANAGE_MONGO_INDEXES")
    backend_users_collection: str = Field(default="users", alias="BACKEND_USERS_COLLECTION")
    backend_projects_collection: str = Field(default="projects", alias="BACKEND_PROJECTS_COLLECTION")
    backend_service_catalog_collection: str = Field(default="ai_service_catalog", alias="BACKEND_SERVICE_CATALOG_COLLECTION")
    chroma_persist_directory: str = Field(default="./storage/chroma", alias="CHROMA_PERSIST_DIRECTORY")
    chroma_collection: str = Field(
        default="freelancer_portfolios",
        validation_alias=AliasChoices("CHROMA_COLLECTION", "CHROMA_COLLECTION_NAME"),
    )
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8001, validation_alias=AliasChoices("PORT", "API_PORT"))
    cors_origins: list[str] = Field(default_factory=lambda: ["*"], alias="CORS_ORIGINS")
    request_timeout_seconds: float = Field(default=15.0, alias="REQUEST_TIMEOUT_SECONDS")
    max_llm_retries: int = Field(default=1, alias="MAX_LLM_RETRIES")

    @field_validator("gemini_api_key", mode="before")
    @classmethod
    def blank_key_is_none(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) and value.strip() else None

    @property
    def is_demo(self) -> bool:
        return self.ai_provider == "demo"


@lru_cache
def get_settings() -> Settings:
    return Settings()
