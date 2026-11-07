import pytest

from gigsaw_ai.core.exceptions import DependencyCycleError
from gigsaw_ai.schemas.work_packages import WorkPackage
from gigsaw_ai.services.dependency_planner import DependencyPlanner


def _package(identifier, dependencies=()):
    return WorkPackage(work_package_id=identifier, name=identifier, service_category="graphic design", description="x", required_skills=["design"], deliverables=["asset"], dependencies=list(dependencies), estimated_days=1)


def test_dependency_planner_orders_parents_first():
    plan = DependencyPlanner().create_plan([_package("b", ["a"]), _package("a")])
    assert plan.execution_order == ["a", "b"]


def test_dependency_planner_detects_cycle():
    with pytest.raises(DependencyCycleError):
        DependencyPlanner().create_plan([_package("a", ["b"]), _package("b", ["a"])])
