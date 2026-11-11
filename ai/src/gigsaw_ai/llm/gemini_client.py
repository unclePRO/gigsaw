from __future__ import annotations

import asyncio
import copy
import json
import logging
import re
from pathlib import Path
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError as PydanticValidationError

from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ConfigurationError, ProviderError

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

STANDARD_PROVIDER_RETRY_MESSAGE = (
    "AI assistant is temporarily busy or unavailable. Please wait a few seconds and retry."
)


def _safe_provider_detail(exc: Exception) -> str:
    """Keep useful provider diagnostics without echoing credentials."""
    detail = str(exc).replace("\n", " ").strip()
    detail = re.sub(r"(?i)(api[-_ ]?key|key)\s*[:=]\s*[^ ,;]+", r"\1=[redacted]", detail)
    return detail[:600] or type(exc).__name__


def _gemini_response_schema(schema: type[BaseModel]) -> dict:
    """Convert Pydantic JSON Schema to Gemini's supported response-schema subset."""
    source = schema.model_json_schema()
    definitions = source.get("$defs", {})
    unsupported = {"$defs", "$ref", "additionalProperties", "title", "minItems", "maxItems"}

    def clean(value):
        if isinstance(value, dict):
            if "$ref" in value:
                reference = value["$ref"].rsplit("/", 1)[-1]
                return clean(copy.deepcopy(definitions[reference]))
            return {key: clean(item) for key, item in value.items() if key not in unsupported}
        if isinstance(value, list):
            return [clean(item) for item in value]
        return value

    return clean(source)


class GeminiClient:
    """Small reusable structured-output client with explicit demo behavior."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client = None
        if not settings.is_demo:
            if not settings.gemini_api_key:
                raise ConfigurationError("GEMINI_API_KEY must be set when AI_PROVIDER=gemini.")
            try:
                from google import genai
                self._client = genai.Client(api_key=settings.gemini_api_key)
            except ImportError as exc:
                raise ConfigurationError("google-genai is not installed; install requirements.txt.") from exc

    @staticmethod
    def load_prompt(name: str) -> str:
        path = Path(__file__).with_name("prompts") / f"{name}.txt"
        if not path.is_file():
            raise ConfigurationError(f"Prompt template '{name}' was not found.")
        return path.read_text(encoding="utf-8")

    def _candidate_models(self) -> list[str]:
        ordered: list[str] = []
        for model in [self.settings.gemini_model, *self.settings.gemini_fallback_models]:
            if model and model not in ordered:
                ordered.append(model)
        return ordered

    async def generate_structured(self, prompt_name: str, context: dict[str, Any], schema: type[T], demo_value: T | dict | None = None) -> T:
        """Generate and validate JSON. Demo uses caller-provided deterministic output only."""
        if self.settings.is_demo:
            if demo_value is None:
                raise ConfigurationError(f"Demo response for '{prompt_name}' was not provided.")
            return schema.model_validate(demo_value)
        prompt = self.load_prompt(prompt_name).replace("{context}", json.dumps(context, default=str))
        models = self._candidate_models()
        total_attempts = max(len(models), self.settings.max_llm_retries + 1)
        last_error: Exception | None = None
        for attempt in range(total_attempts):
            model_name = models[min(attempt, len(models) - 1)]
            try:
                response = await asyncio.wait_for(
                    asyncio.to_thread(self._generate, prompt, schema, model_name),
                    timeout=self.settings.request_timeout_seconds,
                )
                return schema.model_validate_json(response)
            except (TimeoutError, PydanticValidationError, ValueError, ProviderError) as exc:
                last_error = exc
                logger.warning(
                    "Gemini structured request failed on %s (attempt %s/%s): %s",
                    model_name,
                    attempt + 1,
                    total_attempts,
                    _safe_provider_detail(exc),
                )
                if attempt < total_attempts - 1:
                    await asyncio.sleep(0.25)
        logger.error("Gemini structured output exhausted retries for %s: %s", prompt_name, _safe_provider_detail(last_error) if last_error else "unknown")
        raise ProviderError(STANDARD_PROVIDER_RETRY_MESSAGE) from last_error

    def _generate(self, prompt: str, schema: type[BaseModel], model_name: str | None = None) -> str:
        try:
            from google.genai import types
            timeout_ms = max(2000, int(min(self.settings.request_timeout_seconds, 15.0) * 1000))
            response = self._client.models.generate_content(
                model=model_name or self.settings.gemini_model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_gemini_response_schema(schema),
                    http_options=types.HttpOptions(
                        timeout=timeout_ms,
                        retry_options=types.HttpRetryOptions(attempts=1),
                    ),
                ),
            )
            if not response.text:
                raise ProviderError("Gemini returned an empty response.")
            return response.text
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderError(f"Gemini generation request failed: {_safe_provider_detail(exc)}") from exc
