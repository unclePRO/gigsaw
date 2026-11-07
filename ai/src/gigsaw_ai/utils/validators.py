from __future__ import annotations

from collections.abc import Iterable

from gigsaw_ai.core.exceptions import ValidationError


def require_same_currency(currencies: Iterable[str]) -> str:
    values = {currency.upper() for currency in currencies}
    if len(values) != 1:
        raise ValidationError("All monetary values must use the same currency.")
    return values.pop() if values else "USD"


def normalized_terms(values: Iterable[str]) -> set[str]:
    return {value.strip().lower() for value in values if value and value.strip()}
