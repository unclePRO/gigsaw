from __future__ import annotations

import logging
from collections.abc import Sequence
from pathlib import Path

from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ConfigurationError, ProviderError

logger = logging.getLogger(__name__)


class InMemoryPortfolioStore:
    """Deterministic semantic-ish fallback used only in demo and tests."""

    def __init__(self) -> None:
        self._documents: dict[str, str] = {}

    async def upsert(self, freelancer_id: str, document: str) -> None:
        self._documents[freelancer_id] = document

    async def delete(self, freelancer_id: str) -> None:
        self._documents.pop(freelancer_id, None)

    async def search(self, query: str, limit: int = 20) -> list[tuple[str, float]]:
        terms = {term.lower().strip(".,!? ") for term in query.split() if len(term) > 2}
        scored = []
        for identifier, document in self._documents.items():
            haystack = document.lower()
            overlap = sum(1 for term in terms if term in haystack)
            score = overlap / max(len(terms), 1)
            scored.append((identifier, score))
        return sorted(scored, key=lambda item: item[1], reverse=True)[:limit]


class ChromaPortfolioStore:
    """Chroma adapter for portfolio retrieval; metadata contains only freelancer ID."""

    def __init__(self, settings: Settings, embedding_function=None) -> None:
        self.settings = settings
        self.embedding_function = embedding_function
        self.collection = None
        self.collection_name = settings.chroma_collection

    async def connect(self) -> None:
        try:
            import chromadb
        except ImportError as exc:
            raise ConfigurationError("chromadb is not installed; install requirements.txt.") from exc
        try:
            path = Path(self.settings.chroma_persist_directory)
            client = chromadb.PersistentClient(path=str(path))
            # Chroma versions before 1.x may have created this collection with
            # its legacy default embedding configuration. Keep it intact and
            # use a fresh, explicitly named collection for Gemini embeddings.
            try:
                existing = client.get_collection(name=self.collection_name)
                embedding_config = existing.configuration_json.get("embedding_function", {})
                if embedding_config.get("type") == "legacy":
                    candidate = f"{self.collection_name}-gemini"
                    self.collection_name = candidate[:63]
                    logger.warning("Using migrated Chroma collection %s for the Gemini embedding function.", self.collection_name)
            except Exception:
                pass
            self.collection = client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self.embedding_function,
                metadata={"purpose": "GigSaw freelancer portfolio retrieval"},
            )
        except Exception as exc:
            raise ProviderError("ChromaDB initialization failed. Check the storage directory and embedding model.") from exc

    async def upsert(self, freelancer_id: str, document: str) -> None:
        if self.collection is None:
            raise ConfigurationError("ChromaDB is not initialized.")
        self.collection.upsert(ids=[freelancer_id], documents=[document], metadatas=[{"freelancer_id": freelancer_id}])

    async def delete(self, freelancer_id: str) -> None:
        if self.collection is None:
            raise ConfigurationError("ChromaDB is not initialized.")
        self.collection.delete(ids=[freelancer_id])

    async def search(self, query: str, limit: int = 20) -> list[tuple[str, float]]:
        if self.collection is None:
            raise ConfigurationError("ChromaDB is not initialized.")
        try:
            result = self.collection.query(query_texts=[query], n_results=limit, include=["distances", "metadatas"])
            metadata = result.get("metadatas", [[]])[0]
            distances = result.get("distances", [[]])[0]
            return [
                (str(item["freelancer_id"]), max(0.0, min(1.0, 1.0 - float(distance))))
                for item, distance in zip(metadata, distances, strict=True)
            ]
        except Exception as exc:
            raise ProviderError("ChromaDB portfolio search failed.") from exc
