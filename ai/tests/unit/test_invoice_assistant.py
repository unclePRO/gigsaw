from decimal import Decimal

import pytest

from gigsaw_ai.core.exceptions import ValidationError
from gigsaw_ai.schemas.invoices import InvoiceDraftRequest
from gigsaw_ai.schemas.proposals import Quotation
from gigsaw_ai.services.invoice_assistant import InvoiceAssistant


def _quotation(status="accepted"):
    return Quotation(quotation_id="q", freelancer_id="f", work_package_id="w", amount=Decimal("100"), delivery_days=2, scope="Design", status=status)


def test_invoice_calculates_tax_from_accepted_quote():
    invoice = InvoiceAssistant().create_draft(InvoiceDraftRequest(quotation=_quotation(), client_name="Client", freelancer_name="Freelancer", invoice_number="INV-1", tax_rate_percent=Decimal("10")))
    assert invoice.total == Decimal("110.00")
    assert "does not create" in invoice.disclaimer


def test_invoice_rejects_unapproved_quote():
    with pytest.raises(ValidationError):
        InvoiceAssistant().create_draft(InvoiceDraftRequest(quotation=_quotation("pending"), client_name="Client", freelancer_name="Freelancer", invoice_number="INV-1"))
