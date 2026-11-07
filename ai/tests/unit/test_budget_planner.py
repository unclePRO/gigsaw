import asyncio
from decimal import Decimal


def test_catalogue_budget_exactly_allocates_customer_total(container):
    plan = asyncio.run(container.budget_planner.plan(["website development", "logo and branding"], Decimal("1000"), "USD"))
    assert plan.allocated_total == Decimal("1000.00")
    assert len(plan.allocations) == 2


def test_budget_warns_below_catalogue_minimums(container):
    plan = asyncio.run(container.budget_planner.plan(["website development", "logo and branding"], Decimal("10"), "USD"))
    assert plan.warnings
