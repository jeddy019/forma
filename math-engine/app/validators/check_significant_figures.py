"""Significant figures validator.

Checks if a number has been correctly rounded to the specified number of significant figures.
"""

import math

from app.validators import ValidationResult


def check_significant_figures(
    value: float,
    claimed_rounded: float,
    num_significant_figures: int,
) -> ValidationResult:
    """Check if claimed_rounded is the correct rounding of value to num_significant_figures sig figs.

    Args:
        value: The original number
        claimed_rounded: The student's rounded answer
        num_significant_figures: Target number of significant figures
    """
    if num_significant_figures < 1:
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message="Number of significant figures must be at least 1",
        )

    # Round using the mathematical definition
    if value == 0:
        correct = 0.0
    else:
        # Determine the order of magnitude
        magnitude = math.floor(math.log10(abs(value)))
        # Round to the required number of significant figures
        decimal_places = num_significant_figures - 1 - magnitude
        correct = round(value, decimal_places)

    # Handle edge cases for display
    # e.g. 2.35 to 2 sig figs should be 2.4, not 2.3
    if abs(correct - claimed_rounded) < 1e-10:
        return ValidationResult(
            is_valid=True, confidence=1.0,
            message=f"Correct: {value} to {num_significant_figures} s.f. is {claimed_rounded}",
        )

    # Check if they're numerically equal but displayed differently
    # e.g. 2.350 vs 2.35
    if abs(correct - claimed_rounded) < 1e-10:
        return ValidationResult(
            is_valid=True, confidence=1.0,
            message=f"Correct: {value} to {num_significant_figures} s.f. is {claimed_rounded}",
        )

    return ValidationResult(
        is_valid=False, confidence=1.0,
        message=f"Incorrect: {value} to {num_significant_figures} s.f. should be {correct}, not {claimed_rounded}",
        expected=str(correct),
        actual=str(claimed_rounded),
    )
