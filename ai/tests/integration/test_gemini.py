import asyncio

import pytest
from pydantic import ValidationError

from gigsaw_ai.core.config import Settings
from gigsaw_ai.core.exceptions import ConfigurationError
from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.schemas.projects import ProjectAnalysis


def test_demo_client_validates_structured_response():
    client = GeminiClient(Settings(ai_provider="demo"))
    result = asyncio.run(client.generate_structured("project_analysis", {}, ProjectAnalysis, {
        "project_name": "Demo", "business_goal": "Test", "summary": "Test response", "required_services": ["graphic design"]
    }))
    assert result.project_name == "Demo"


def test_demo_client_rejects_invalid_structured_response():
    client = GeminiClient(Settings(ai_provider="demo"))
    with pytest.raises(ValidationError):
        asyncio.run(client.generate_structured("project_analysis", {}, ProjectAnalysis, {"project_name": "missing required fields"}))


def test_gemini_mode_requires_an_api_key():
    with pytest.raises(ConfigurationError):
        GeminiClient(Settings(ai_provider="gemini", gemini_api_key=None))
