from __future__ import annotations

from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ConfigurationError, ProviderError


class GeminiEmbeddingFunction:
    """Chroma-compatible embedding callable backed by the configured Gemini model."""

    def __init__(self, settings: Settings) -> None:
        if not settings.gemini_api_key:
            raise ConfigurationError("GEMINI_API_KEY is required when AI_PROVIDER=gemini.")
        try:
            from google import genai
        except ImportError as exc:
            raise ConfigurationError("google-genai is not installed; install requirements.txt.") from exc
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = settings.gemini_embedding_model

    def __call__(self, input: list[str]) -> list[list[float]]:
        try:
            response = self.client.models.embed_content(model=self.model, contents=input)
            return [list(item.values) for item in response.embeddings]
        except Exception as exc:
            raise ProviderError("Gemini embedding request failed.") from exc

    def embed_query(self, input: list[str]) -> list[list[float]]:
        """ChromaDB 1.x invokes `embed_query` for similarity search queries."""
        return self.__call__(input)

    @staticmethod
    def name() -> str:
        """ChromaDB 1.x requires a stable embedding-function name."""
        return "gigsaw_gemini"

    def get_config(self) -> dict[str, str]:
        # Never serialize the API key into Chroma metadata.
        return {"model": self.model}

    @staticmethod
    def is_legacy() -> bool:
        return False

    @staticmethod
    def default_space() -> str:
        return "l2"

    @staticmethod
    def supported_spaces() -> list[str]:
        return ["cosine", "l2", "ip"]

    @staticmethod
    def validate_config(config: dict) -> None:
        return

    def validate_config_update(self, old_config: dict, new_config: dict) -> None:
        return
