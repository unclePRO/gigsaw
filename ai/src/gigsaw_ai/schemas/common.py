from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

Money = Annotated[Decimal, Field(max_digits=12, decimal_places=2, ge=Decimal("0"))]


class SchemaModel(BaseModel):
    """Base response schema: rejects accidental extra backend contract fields."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class HealthResponse(SchemaModel):
    status: str
    environment: str
    ai_provider: str
    databases: dict[str, str]
