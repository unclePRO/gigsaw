from fastapi import APIRouter, Depends

from gigsaw_ai.api.dependencies import get_container
from gigsaw_ai.schemas.proposals import (
    ConsolidatedProposal,
    CounterofferAnalysis,
    CounterofferAnalyzeRequest,
    ProposalGenerateRequest,
)

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.post("/generate", response_model=ConsolidatedProposal, summary="Draft a consolidated proposal from accepted quotations")
async def generate_proposal(request: ProposalGenerateRequest, container=Depends(get_container)) -> ConsolidatedProposal:
    return container.proposal_generator.generate(request)


@router.post("/counteroffer/analyze", response_model=CounterofferAnalysis, summary="Explain counteroffer impact without approving it")
async def analyze_counteroffer(request: CounterofferAnalyzeRequest, container=Depends(get_container)) -> CounterofferAnalysis:
    return container.counteroffer_assistant.analyze(request)
