from __future__ import annotations

from collections.abc import Sequence

from gigsaw_ai.database.repositories.interfaces import FreelancerRepository
from gigsaw_ai.schemas.freelancers import Freelancer


class FreelancerRetriever:
    """Resolves Chroma IDs through Mongo/repository before business use."""

    def __init__(self, portfolio_store, freelancer_repository: FreelancerRepository) -> None:
        self.portfolio_store = portfolio_store
        self.freelancer_repository = freelancer_repository

    async def retrieve(self, brief: str, limit: int = 20) -> list[tuple[Freelancer, float]]:
        found = await self.portfolio_store.search(brief, limit)
        resolved: list[tuple[Freelancer, float]] = []
        for freelancer_id, relevance in found:
            freelancer = await self.freelancer_repository.get(freelancer_id)
            if freelancer is not None:
                resolved.append((freelancer, relevance))
        return resolved
