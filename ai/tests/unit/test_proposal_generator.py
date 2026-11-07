from decimal import Decimal

from gigsaw_ai.schemas.proposals import ProposalGenerateRequest, Quotation
from gigsaw_ai.services.proposal_generator import ProposalGenerator


def test_proposal_preserves_accepted_quotation_totals():
    result = ProposalGenerator().generate(ProposalGenerateRequest(project_id="p1", project_name="Launch", quotations=[
        Quotation(quotation_id="q1", freelancer_id="f1", work_package_id="w1", amount=Decimal("100.20"), delivery_days=3, scope="Logo", status="accepted"),
        Quotation(quotation_id="q2", freelancer_id="f2", work_package_id="w2", amount=Decimal("55.35"), delivery_days=3, scope="Photo", status="declined"),
    ]))
    assert result.total == Decimal("100.20")
    assert len(result.accepted_quotations) == 1
