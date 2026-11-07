from decimal import Decimal, ROUND_HALF_UP

CENTS = Decimal("0.01")


def as_money(value: Decimal | int | float | str) -> Decimal:
    """Return a non-binary, two-decimal monetary amount."""
    return Decimal(str(value)).quantize(CENTS, rounding=ROUND_HALF_UP)


def percentage(part: Decimal, whole: Decimal) -> float:
    return float((part / whole * 100).quantize(Decimal("0.01"))) if whole else 0.0
