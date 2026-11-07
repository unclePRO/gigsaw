from __future__ import annotations

from collections import deque

from gigsaw_ai.core.exceptions import DependencyCycleError, ValidationError
from gigsaw_ai.schemas.work_packages import DependencyPlan, WorkPackage


class DependencyPlanner:
    """Validates dependency IDs and applies Kahn's deterministic topological sort."""

    def create_plan(self, packages: list[WorkPackage]) -> DependencyPlan:
        identifiers = {package.work_package_id for package in packages}
        if len(identifiers) != len(packages):
            raise ValidationError("Work package IDs must be unique.")
        dependencies = {package.work_package_id: list(package.dependencies) for package in packages}
        for package_id, parents in dependencies.items():
            unknown = set(parents) - identifiers
            if unknown:
                raise ValidationError(f"Work package '{package_id}' references unknown dependencies: {sorted(unknown)}")
            if package_id in parents:
                raise DependencyCycleError(f"Work package '{package_id}' cannot depend on itself.")
        indegree = {identifier: len(parents) for identifier, parents in dependencies.items()}
        downstream = {identifier: [] for identifier in identifiers}
        for child, parents in dependencies.items():
            for parent in parents:
                downstream[parent].append(child)
        ready = deque(sorted(identifier for identifier, count in indegree.items() if count == 0))
        order: list[str] = []
        while ready:
            node = ready.popleft()
            order.append(node)
            for child in sorted(downstream[node]):
                indegree[child] -= 1
                if indegree[child] == 0:
                    ready.append(child)
        if len(order) != len(packages):
            cyclic = sorted(identifier for identifier, count in indegree.items() if count > 0)
            raise DependencyCycleError(f"Work package dependencies contain a cycle: {cyclic}")
        return DependencyPlan(execution_order=order, edges=dependencies)
