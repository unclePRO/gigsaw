import asyncio

from gigsaw_ai.database.repositories.freelancer_repository import InMemoryFreelancerRepository
from tests.fixtures.demo_data import FREELANCERS


def test_repository_source_of_truth_operations():
    repository = InMemoryFreelancerRepository()
    asyncio.run(repository.upsert_many(FREELANCERS))
    found = asyncio.run(repository.get("fre-001"))
    available = asyncio.run(repository.list_available("website development"))
    assert found and found.name == "Maya Chen"
    assert {item.freelancer_id for item in available} >= {"fre-001", "fre-002", "fre-012"}
