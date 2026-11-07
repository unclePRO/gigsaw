import asyncio

from tests.fixtures.demo_data import CAFE_REQUEST


def test_demo_analysis_finds_cafe_services(container):
    analysis = asyncio.run(container.project_analyzer.analyze(CAFE_REQUEST))
    assert analysis.project_name == "Copper Cup Cafe launch"
    assert {"website development", "logo and branding", "food photography"} <= set(analysis.required_services)
