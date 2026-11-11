from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from gigsaw_ai.api.routes import (
    chat_room,
    freelancer_assistant,
    health,
    matching,
    projects,
    proposals,
    scoping,
)
from gigsaw_ai.core.config import Settings, get_settings
from gigsaw_ai.core.exceptions import GigSawAIError, ProviderError
from gigsaw_ai.core.logging import configure_logging
from gigsaw_ai.database.chroma import ChromaPortfolioStore, InMemoryPortfolioStore
from gigsaw_ai.database.mongo import MongoDatabase
from gigsaw_ai.database.repositories.freelancer_repository import InMemoryFreelancerRepository
from gigsaw_ai.database.repositories.project_repository import InMemoryProjectRepository
from gigsaw_ai.database.repositories.service_repository import InMemoryServiceRepository
from gigsaw_ai.database.seed import seed_repositories
from gigsaw_ai.llm.gemini_client import GeminiClient
from gigsaw_ai.retrieval.embeddings import GeminiEmbeddingFunction
from gigsaw_ai.retrieval.freelancer_retriever import FreelancerRetriever
from gigsaw_ai.services.budget_planner import BudgetPlanner
from gigsaw_ai.services.counteroffer_assistant import CounterofferAssistant
from gigsaw_ai.services.dependency_planner import DependencyPlanner
from gigsaw_ai.services.freelancer_matcher import FreelancerMatcher
from gigsaw_ai.services.invitation_assistant import InvitationAssistant
from gigsaw_ai.services.invoice_assistant import InvoiceAssistant
from gigsaw_ai.services.project_analyzer import ProjectAnalyzer
from gigsaw_ai.services.project_chat_room_assistant import ProjectChatRoomAssistant
from gigsaw_ai.services.project_monitor import ProjectMonitor
from gigsaw_ai.services.project_scoping_assistant import ProjectScopingAssistant
from gigsaw_ai.services.proposal_generator import ProposalGenerator
from gigsaw_ai.services.task_decomposer import TaskDecomposer

logger = logging.getLogger(__name__)


@dataclass
class ApplicationContainer:
    settings: Settings
    project_analyzer: ProjectAnalyzer
    task_decomposer: TaskDecomposer
    dependency_planner: DependencyPlanner
    budget_planner: BudgetPlanner
    freelancer_matcher: FreelancerMatcher
    proposal_generator: ProposalGenerator
    counteroffer_assistant: CounterofferAssistant
    invoice_assistant: InvoiceAssistant
    project_monitor: ProjectMonitor
    project_scoping_assistant: ProjectScopingAssistant
    project_chat_room_assistant: ProjectChatRoomAssistant
    invitation_assistant: InvitationAssistant
    database_status: dict[str, str]
    mongo: MongoDatabase | None = None

    async def close(self) -> None:
        if self.mongo:
            await self.mongo.close()


async def build_container(settings: Settings) -> ApplicationContainer:
    """Build demo memory infrastructure or require all configured production providers."""
    llm = GeminiClient(settings)
    mongo: MongoDatabase | None = None
    if settings.is_demo:
        freelancer_repository = InMemoryFreelancerRepository()
        service_repository = InMemoryServiceRepository()
        project_repository = InMemoryProjectRepository()
        portfolio_store = InMemoryPortfolioStore()
        await seed_repositories(freelancer_repository, service_repository, portfolio_store, project_repository)
        status = {"mongodb": "demo-memory", "chromadb": "demo-memory"}
    else:
        mongo = MongoDatabase(settings)
        await mongo.connect()
        freelancer_repository, service_repository, project_repository = mongo.repositories()
        embedding_function = GeminiEmbeddingFunction(settings)
        portfolio_store = ChromaPortfolioStore(settings, embedding_function=embedding_function)
        await portfolio_store.connect()
        mongo_status = "connected-backend-mongoose" if settings.mongodb_schema_mode == "backend_mongoose" else "connected"
        status = {"mongodb": mongo_status, "chromadb": "initialized"}

    retriever = FreelancerRetriever(portfolio_store, freelancer_repository)
    project_analyzer = ProjectAnalyzer(llm)
    task_decomposer = TaskDecomposer(llm)
    dependency_planner = DependencyPlanner()
    budget_planner = BudgetPlanner(service_repository)
    freelancer_matcher = FreelancerMatcher(freelancer_repository, retriever)
    proposal_generator = ProposalGenerator()
    counteroffer_assistant = CounterofferAssistant()
    invoice_assistant = InvoiceAssistant()
    project_monitor = ProjectMonitor()

    project_scoping_assistant = ProjectScopingAssistant(
        llm=llm,
        project_analyzer=project_analyzer,
        task_decomposer=task_decomposer,
        dependency_planner=dependency_planner,
        budget_planner=budget_planner,
        freelancer_matcher=freelancer_matcher,
    )
    project_chat_room_assistant = ProjectChatRoomAssistant(llm=llm)
    invitation_assistant = InvitationAssistant(service_repository=service_repository, llm=llm)

    return ApplicationContainer(
        settings=settings,
        project_analyzer=project_analyzer,
        task_decomposer=task_decomposer,
        dependency_planner=dependency_planner,
        budget_planner=budget_planner,
        freelancer_matcher=freelancer_matcher,
        proposal_generator=proposal_generator,
        counteroffer_assistant=counteroffer_assistant,
        invoice_assistant=invoice_assistant,
        project_monitor=project_monitor,
        project_scoping_assistant=project_scoping_assistant,
        project_chat_room_assistant=project_chat_room_assistant,
        invitation_assistant=invitation_assistant,
        database_status=status,
        mongo=mongo,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    container = await build_container(get_settings())
    app.state.container = container
    logger.info("GigSaw AI started in %s provider mode", container.settings.ai_provider)
    try:
        yield
    finally:
        await container.close()


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="GigSaw AI Service",
        version="0.1.0",
        lifespan=lifespan,
        description="AI analysis and recommendation service supporting merchant conversational creation, freelancer matching, and project chat room facilitation.",
    )
    
    settings = get_settings()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins if settings.cors_origins != ["*"] else ["*"],
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Root probe routes for hosting platforms (Render, Railway, Fly.io)
    @app.get("/", tags=["health"], summary="Root status check")
    @app.get("/health", tags=["health"], summary="Cloud probe")
    async def root_health():
        return {
            "status": "ok",
            "service": "gigsaw-ai",
            "provider": settings.ai_provider,
            "message": "GigSaw AI Intelligence Service is running"
        }

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(projects.router, prefix="/api/v1")
    app.include_router(scoping.router, prefix="/api/v1")
    app.include_router(matching.router, prefix="/api/v1")
    app.include_router(chat_room.router, prefix="/api/v1")
    app.include_router(chat_room.alias_router, prefix="/api/v1")
    app.include_router(proposals.router, prefix="/api/v1")
    app.include_router(freelancer_assistant.router, prefix="/api/v1")

    @app.exception_handler(ProviderError)
    async def provider_error(_request: Request, exc: ProviderError) -> JSONResponse:
        return JSONResponse(
            status_code=503,
            headers={"Retry-After": "5"},
            content={
                "error": "ai_service_unavailable",
                "message": str(exc),
                "detail": str(exc),
                "retryable": True,
                "retry_after_seconds": 5,
            },
        )

    @app.exception_handler(GigSawAIError)
    async def handled_error(_request: Request, exc: GigSawAIError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unexpected application error: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Internal AI service error."})

    return app


app = create_app()
