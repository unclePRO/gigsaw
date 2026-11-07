class GigSawAIError(Exception):
    """Base error safe to expose as an application failure."""


class ConfigurationError(GigSawAIError):
    """Required service configuration is missing or invalid."""


class ProviderError(GigSawAIError):
    """The configured LLM or vector provider failed."""


class NotFoundError(GigSawAIError):
    """A requested resource does not exist."""


class ValidationError(GigSawAIError):
    """A business-level input or state validation failed."""


class DependencyCycleError(ValidationError):
    """Work-package dependencies contain a cycle."""
