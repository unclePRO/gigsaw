import asyncio
from datetime import date, timedelta
from decimal import Decimal

from gigsaw_ai.schemas.invoices import InvoiceDraftRequest
from gigsaw_ai.schemas.matching import FreelancerMatchingRequest
from gigsaw_ai.schemas.progress import ProgressSummaryRequest, ProgressTask
from gigsaw_ai.schemas.proposals import ProposalGenerateRequest, Quotation
from tests.fixtures.demo_data import CAFE_REQUEST


def test_complete_demo_cafe_workflow(container):
    analysis = asyncio.run(container.project_analyzer.analyze(CAFE_REQUEST))
    packages = asyncio.run(container.task_decomposer.decompose(analysis))
    plan = container.dependency_planner.create_plan(packages)
    budget = asyncio.run(container.budget_planner.plan(analysis.required_services, Decimal("2000"), "USD"))
    website = next(package for package in packages if package.service_category == "website development")
    matches = asyncio.run(container.freelancer_matcher.match(FreelancerMatchingRequest(service_category=website.service_category, required_skills=website.required_skills, brief=CAFE_REQUEST.customer_request, budget=Decimal("900"))))
    quote = Quotation(quotation_id="q1", freelancer_id=matches.matches[0].freelancer.freelancer_id, work_package_id=website.work_package_id, amount=Decimal("760"), delivery_days=14, scope="Cafe website", status="accepted")
    proposal = container.proposal_generator.generate(ProposalGenerateRequest(project_id="demo-cafe-launch", project_name=analysis.project_name, quotations=[quote]))
    invoice = container.invoice_assistant.create_draft(InvoiceDraftRequest(quotation=quote, client_name="Copper Cup", freelancer_name=matches.matches[0].freelancer.name, invoice_number="INV-DEMO"))
    progress = container.project_monitor.summarize(ProgressSummaryRequest(project_name=analysis.project_name, tasks=[ProgressTask(work_package_id=packages[0].work_package_id, name=packages[0].name, status="in_progress", due_date=date.today() + timedelta(days=4))]))
    assert plan.execution_order
    assert budget.allocated_total == Decimal("2000.00")
    assert proposal.total == Decimal("760.00")
    assert invoice.total == Decimal("760.00")
    assert progress.completion_percentage == 0
