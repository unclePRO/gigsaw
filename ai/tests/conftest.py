import asyncio

import pytest

from gigsaw_ai.core.config import Settings
from gigsaw_ai.main import build_container


@pytest.fixture
def container():
    instance = asyncio.run(build_container(Settings(ai_provider="demo")))
    yield instance
    asyncio.run(instance.close())
