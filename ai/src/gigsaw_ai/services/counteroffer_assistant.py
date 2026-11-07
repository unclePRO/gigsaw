from __future__ import annotations

from gigsaw_ai.schemas.proposals import CounterofferAnalysis, CounterofferAnalyzeRequest
from gigsaw_ai.utils.money import as_money, percentage


class CounterofferAssistant:
    """Explains a counteroffer but deliberately cannot approve it."""

    def analyze(self, request: CounterofferAnalyzeRequest) -> CounterofferAnalysis:
        original = request.original_quotation
        delta = as_money(request.proposed_amount - original.amount)
        pct = percentage(delta, original.amount)
        day_delta = request.proposed_delivery_days - original.delivery_days
        if request.project_budget_remaining is None:
            impact = "No remaining project budget was supplied."
        elif request.proposed_amount <= request.project_budget_remaining:
            impact = "The proposed amount fits within the stated remaining budget."
        else:
            impact = f"The proposed amount exceeds the stated remaining budget by {as_money(request.proposed_amount - request.project_budget_remaining)} {original.currency}."
        recommendation = "Review scope changes and approve or decline in the main backend."
        if delta > 0:
            recommendation = "Request scope justification for the increase, then approve or decline in the main backend."
        return CounterofferAnalysis(amount_delta=delta, percentage_delta=pct, delivery_days_delta=day_delta, budget_impact=impact, recommendation=recommendation)
