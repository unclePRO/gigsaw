import asyncio

from tests.fixtures.demo_data import CAFE_REQUEST


def test_decomposition_creates_assignable_packages(container):
    analysis = asyncio.run(container.project_analyzer.analyze(CAFE_REQUEST))
    packages = asyncio.run(container.task_decomposer.decompose(analysis))
    assert len(packages) == len(analysis.required_services)
    assert all(package.deliverables and package.required_skills for package in packages)
