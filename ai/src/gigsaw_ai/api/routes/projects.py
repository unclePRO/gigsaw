from fastapi import APIRouter, Body, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.progress import ProgressSummary, ProgressSummaryRequest
from gigsaw_ai.schemas.projects import ProjectAnalyzeRequest, ProjectAnalyzeResponse, ProjectBudget

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/analyze", response_model=ProjectAnalyzeResponse, summary="Analyze and decompose a customer project request")
async def analyze_project(
    request: ProjectAnalyzeRequest = Body(openapi_examples={"cafe_launch": {"summary": "Cafe launch", "value": {"customer_request": "I need a website, logo, Instagram promotional banners, food photography, digital menu and social media management for a new cafe.", "budget": "2000", "currency": "USD", "project_name": "Copper Cup Cafe launch"}}}),
    container=Depends(get_container),
) -> ProjectAnalyzeResponse:
    analysis = await container.project_analyzer.analyze(request)
    packages = await container.task_decomposer.decompose(analysis)
    plan = container.dependency_planner.create_plan(packages)
    budget_plan = None
    budget = None
    if request.budget is not None:
        budget_plan = await container.budget_planner.plan(analysis.required_services, request.budget, request.currency)
        budget = ProjectBudget(
            amount=request.budget,
            currency=request.currency,
            pricing_status="catalogue_planned" if budget_plan.allocations else "pending",
        )
    return ProjectAnalyzeResponse(
        analysis=analysis,
        budget=budget,
        budget_plan=budget_plan,
        work_packages=packages,
        dependency_plan=plan.edges,
    )


@router.post("/progress-summary", response_model=ProgressSummary, summary="Summarize project task progress and blockers")
async def progress_summary(request: ProgressSummaryRequest, container=Depends(get_container)) -> ProgressSummary:
    return container.project_monitor.summarize(request)
