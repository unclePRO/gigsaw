"""Run the complete cafe workflow without a live LLM or database server."""
import asyncio
from decimal import Decimal

from gigsaw_ai.core.config import Settings
from gigsaw_ai.main import build_container
from gigsaw_ai.schemas.matching import FreelancerMatchingRequest
from gigsaw_ai.schemas.projects import ProjectAnalyzeRequest


async def main() -> None:
    container = await build_container(Settings(ai_provider="demo"))
    request = ProjectAnalyzeRequest(
        project_name="Copper Cup Cafe launch",
        customer_request="I need a website, logo, Instagram promotional banners, food photography, digital menu and social media management for a new cafe.",
        budget=Decimal("2000"),
    )
    analysis = await container.project_analyzer.analyze(request)
    packages = await container.task_decomposer.decompose(analysis)
    plan = container.dependency_planner.create_plan(packages)
    budget = await container.budget_planner.plan(analysis.required_services, request.budget, request.currency)
    website = next(package for package in packages if package.service_category == "website development")
    matches = await container.freelancer_matcher.match(FreelancerMatchingRequest(
        service_category=website.service_category, required_skills=website.required_skills,
        brief=request.customer_request, budget=Decimal("900"), limit=3,
    ))
    print(f"Project: {analysis.project_name}")
    print(f"Services: {', '.join(analysis.required_services)}")
    print(f"Work packages: {len(packages)} | Execution order: {', '.join(plan.execution_order)}")
    print(f"Budget allocated: {budget.allocated_total} {budget.currency}")
    print("Top website matches:", ", ".join(match.freelancer.name for match in matches.matches))


if __name__ == "__main__":
    asyncio.run(main())
