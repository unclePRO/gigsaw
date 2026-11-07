from __future__ import annotations

from uuid import uuid4

from gigsaw_ai.core.exceptions import ValidationError
from gigsaw_ai.schemas.proposals import ConsolidatedProposal, ProposalGenerateRequest
from gigsaw_ai.utils.money import as_money
from gigsaw_ai.utils.validators import require_same_currency


class ProposalGenerator:
    def generate(self, request: ProposalGenerateRequest) -> ConsolidatedProposal:
        accepted = [quotation for quotation in request.quotations if quotation.status == "accepted"]
        if not accepted:
            raise ValidationError("At least one quotation must be accepted before generating a proposal.")
        currency = require_same_currency([request.currency, *(quotation.currency for quotation in accepted)])
        total = sum((quotation.amount for quotation in accepted), start=as_money(0))
        return ConsolidatedProposal(
            proposal_id=f"proposal-{uuid4().hex[:12]}", project_id=request.project_id, project_name=request.project_name,
            currency=currency, accepted_quotations=accepted, total=as_money(total),
            summary=f"Consolidated proposal for {request.project_name} covering {len(accepted)} accepted work package(s).",
            assumptions=["Amounts preserve the accepted freelancer quotations.", "The main backend remains responsible for final approval and payments."],
        )
