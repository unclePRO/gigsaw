from __future__ import annotations

from decimal import Decimal

from gigsaw_ai.database.repositories.interfaces import ServiceRepository
from gigsaw_ai.schemas.budget import BudgetAllocation, BudgetPlan
from gigsaw_ai.utils.money import as_money


class BudgetPlanner:
    """Allocates only from the trusted service catalogue; no LLM price generation."""

    def __init__(self, service_repository: ServiceRepository) -> None:
        self.service_repository = service_repository

    async def plan(self, categories: list[str], total_budget: Decimal, currency: str) -> BudgetPlan:
        services = list(await self.service_repository.get_by_categories(categories))
        catalogue = {service.category.lower(): service for service in services}
        trusted = [catalogue[category.lower()] for category in categories if category.lower() in catalogue]
        baseline_total = sum((item.baseline_price for item in trusted), Decimal("0"))
        warnings: list[str] = []
        if len(trusted) != len(set(category.lower() for category in categories)):
            warnings.append("Some requested services are not in the trusted catalogue and were not allocated.")
        if baseline_total == 0:
            return BudgetPlan(currency=currency, total_budget=as_money(total_budget), allocated_total=Decimal("0.00"), allocations=[], warnings=warnings + ["No trusted price data is available."])
        allocations = []
        remaining = as_money(total_budget)
        for position, service in enumerate(trusted):
            amount = as_money(total_budget * service.baseline_price / baseline_total)
            if position == len(trusted) - 1:  # keep exact cents total
                amount = remaining
            remaining -= amount
            allocations.append(BudgetAllocation(
                service_category=service.category, trusted_baseline=as_money(service.baseline_price), recommended_amount=amount,
                rationale="Proportional allocation using the trusted service catalogue baseline.",
            ))
        if total_budget < sum((item.minimum_price for item in trusted), Decimal("0")):
            warnings.append("Customer budget is below the sum of catalogue minimums; reduce scope or increase budget.")
        return BudgetPlan(currency=currency, total_budget=as_money(total_budget), allocated_total=sum((item.recommended_amount for item in allocations), Decimal("0")), allocations=allocations, warnings=warnings)
