"""Lightweight matching feedback event tracking (observational only; no auto-retraining)."""
from __future__ import annotations

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import Field

from gigsaw_ai.schemas.common import SchemaModel

logger = logging.getLogger(__name__)

FeedbackEventType = Literal[
    "shown",
    "shortlisted",
    "selected",
    "replaced",
    "rejected",
    "invited",
    "completed",
    "rated",
]


class MatchingFeedbackEvent(SchemaModel):
    event_id: str = Field(default_factory=lambda: uuid4().hex)
    project_id: str | None = None
    work_package_id: str | None = None
    service_category: str = ""
    freelancer_id: str
    event_type: FeedbackEventType
    rank_position: int | None = Field(default=None, ge=1)
    match_score: float | None = Field(default=None, ge=0, le=100)
    rating: float | None = Field(default=None, ge=0, le=5)
    reason: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MatchingFeedbackSummary(SchemaModel):
    total_events: int
    counts_by_type: dict[str, int]
    average_rating: float | None = None
    selection_rate: float | None = None
    replacement_rate: float | None = None


class MatchingFeedbackTracker:
    """Stores AI-owned matching feedback events in memory and optionally in an AI Mongo collection."""

    def __init__(self, collection: Any | None = None) -> None:
        self._events: list[MatchingFeedbackEvent] = []
        self._collection = collection

    async def record(self, event: MatchingFeedbackEvent) -> MatchingFeedbackEvent:
        self._events.append(event)
        if self._collection is not None:
            try:
                await self._collection.insert_one(event.model_dump(mode="json"))
            except Exception as exc:  # pragma: no cover - defensive logging only
                logger.warning("Failed to persist matching feedback event: %s", exc)
        return event

    async def list_events(
        self,
        *,
        freelancer_id: str | None = None,
        service_category: str | None = None,
        limit: int = 100,
    ) -> list[MatchingFeedbackEvent]:
        filtered = [
            ev
            for ev in self._events
            if (freelancer_id is None or ev.freelancer_id == freelancer_id)
            and (service_category is None or ev.service_category.lower() == service_category.lower())
        ]
        return filtered[-limit:]

    async def summarize(
        self,
        *,
        freelancer_id: str | None = None,
        service_category: str | None = None,
    ) -> MatchingFeedbackSummary:
        events = await self.list_events(
            freelancer_id=freelancer_id,
            service_category=service_category,
            limit=10000,
        )
        counts = Counter(ev.event_type for ev in events)
        ratings = [ev.rating for ev in events if ev.rating is not None]
        shown = counts.get("shown", 0)
        selected = counts.get("selected", 0) + counts.get("invited", 0)
        replaced = counts.get("replaced", 0) + counts.get("rejected", 0)
        denom = max(shown, selected + replaced)
        return MatchingFeedbackSummary(
            total_events=len(events),
            counts_by_type=dict(counts),
            average_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
            selection_rate=round(selected / denom, 3) if denom > 0 else None,
            replacement_rate=round(replaced / denom, 3) if denom > 0 else None,
        )
