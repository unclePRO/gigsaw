from __future__ import annotations

from gigsaw_ai.core.exceptions import ValidationError
from gigsaw_ai.schemas.invoices import InvoiceDraft, InvoiceDraftRequest
from gigsaw_ai.utils.money import as_money


class InvoiceAssistant:
    """Draft-only invoice support. It neither creates payment objects nor sends invoices."""

    def create_draft(self, request: InvoiceDraftRequest) -> InvoiceDraft:
        quotation = request.quotation
        if quotation.status != "accepted":
            raise ValidationError("An invoice draft may only be created from an accepted quotation.")
        subtotal = as_money(quotation.amount)
        tax = as_money(subtotal * request.tax_rate_percent / 100)
        return InvoiceDraft(
            invoice_number=request.invoice_number, client_name=request.client_name, freelancer_name=request.freelancer_name,
            currency=quotation.currency,
            line_items=[{"description": quotation.scope, "amount": f"{subtotal:.2f}"}],
            subtotal=subtotal, tax=tax, total=as_money(subtotal + tax),
            payment_note="Payment terms and payment processing must be handled by the authorised main backend.",
            disclaimer="Draft only — this document does not create a PayPal invoice, payment obligation, or payment request.",
        )
