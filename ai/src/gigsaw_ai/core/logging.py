import logging


def configure_logging(level: int = logging.INFO) -> None:
    """Configure concise, secret-safe process logging exactly once."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )
