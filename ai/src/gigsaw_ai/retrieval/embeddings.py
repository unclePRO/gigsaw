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

    @staticmethod
    def name() -> str:
        """ChromaDB 1.x requires a stable embedding-function name."""
        return "gigsaw_gemini"

    def get_config(self) -> dict[str, str]:
        # Never serialize the API key into Chroma metadata.
        return {"model": self.model}
