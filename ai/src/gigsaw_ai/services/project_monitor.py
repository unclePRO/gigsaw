from __future__ import annotations

from datetime import date

from gigsaw_ai.schemas.progress import ProgressSummary, ProgressSummaryRequest


class ProjectMonitor:
    def summarize(self, request: ProgressSummaryRequest, today: date | None = None) -> ProgressSummary:
        today = today or date.today()
        completed = [task for task in request.tasks if task.status == "completed"]
        in_progress = [task for task in request.tasks if task.status == "in_progress"]
        blocked = [task for task in request.tasks if task.status == "blocked"]
        overdue = [task for task in request.tasks if task.due_date and task.due_date < today and task.status != "completed"]
        percentage = round(len(completed) / len(request.tasks) * 100, 2)
        actions = []
        if blocked:
            actions.append("Resolve blockers with the assigned freelancers before dependent work proceeds.")
        if overdue:
            actions.append("Review overdue work packages and confirm a revised delivery plan.")
        if not actions:
            actions.append("Continue tracking milestones and confirm completed deliverables with the customer.")
        summary = f"{len(completed)} of {len(request.tasks)} work packages are complete; {len(blocked)} are blocked."
        return ProgressSummary(
            project_name=request.project_name, completion_percentage=percentage, completed_count=len(completed),
            in_progress_count=len(in_progress), blocked_tasks=[task.work_package_id for task in blocked],
            overdue_tasks=[task.work_package_id for task in overdue], summary=summary, recommended_actions=actions,
        )
