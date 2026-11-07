from decimal import Decimal

from gigsaw_ai.schemas.proposals import CounterofferAnalyzeRequest, Quotation
from gigsaw_ai.services.counteroffer_assistant import CounterofferAssistant


def test_counteroffer_is_explained_not_approved():
    original = Quotation(quotation_id="q", freelancer_id="f", work_package_id="w", amount=Decimal("100"), delivery_days=5, scope="Logo", status="counteroffer")
    result = CounterofferAssistant().analyze(CounterofferAnalyzeRequest(
        original_quotation=original, proposed_amount=Decimal("125"), proposed_delivery_days=7,
        message="Expanded revision rounds", project_budget_remaining=Decimal("110"),
    ))
    assert result.amount_delta == Decimal("25.00")
    assert result.approval_required is True
    assert "exceeds" in result.budget_impact
