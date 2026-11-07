from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.invoices import InvoiceDraft, InvoiceDraftRequest

router = APIRouter(prefix="/freelancer-assistant", tags=["freelancer assistant"])


@router.post("/invoice-draft", response_model=InvoiceDraft, summary="Create a draft invoice from an accepted quotation")
async def invoice_draft(request: InvoiceDraftRequest, container=Depends(get_container)) -> InvoiceDraft:
    return container.invoice_assistant.create_draft(request)
