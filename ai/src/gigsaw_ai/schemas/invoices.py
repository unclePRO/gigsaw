from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from .common import SchemaModel
from .proposals import Quotation


class InvoiceDraftRequest(SchemaModel):
    quotation: Quotation
    client_name: str = Field(min_length=1)
    freelancer_name: str = Field(min_length=1)
    invoice_number: str = Field(min_length=1)
    tax_rate_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class InvoiceDraft(SchemaModel):
    invoice_number: str
    client_name: str
    freelancer_name: str
    currency: str
    line_items: list[dict[str, str]]
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    payment_note: str
    disclaimer: str
