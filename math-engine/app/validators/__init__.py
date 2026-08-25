"""Shared types for science validators."""

from dataclasses import dataclass


@dataclass
class ValidationResult:
    """Result of a validation check."""
    is_valid: bool
    confidence: float  # 0.0 to 1.0
    message: str
    expected: str | None = None
    actual: str | None = None
