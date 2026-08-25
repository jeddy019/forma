"""Unit conversion validator.

Checks if a unit conversion between common science units is numerically correct.
Handles length, mass, volume, time, temperature, and speed conversions.
"""

import re

from app.validators import ValidationResult

# Conversion factors to SI base units
LENGTH_TO_M = {
    "mm": 0.001, "cm": 0.01, "m": 1, "km": 1000,
    "in": 0.0254, "ft": 0.3048, "yd": 0.9144, "mi": 1609.344,
}

MASS_TO_KG = {
    "mg": 0.000001, "g": 0.001, "kg": 1, "tonne": 1000,
    "oz": 0.0283495, "lb": 0.453592,
}

VOLUME_TO_L = {
    "mL": 0.001, "L": 1,
    "cm3": 0.001, "dm3": 1, "m3": 1000,
    "fl oz": 0.0295735, "gal": 3.78541,
}

TIME_TO_S = {
    "ms": 0.001, "s": 1, "min": 60, "hr": 3600, "day": 86400,
}

TEMPERATURE_UNITS = {"C", "F", "K"}

SPEED_TO_MS = {
    "m/s": 1, "km/h": 1 / 3.6, "mph": 0.44704, "knots": 0.514444,
}


def _convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    """Convert between C, F, K."""
    # First convert to Celsius
    if from_unit == "C":
        celsius = value
    elif from_unit == "F":
        celsius = (value - 32) * 5 / 9
    else:  # K
        celsius = value - 273.15

    # Then convert from Celsius to target
    if to_unit == "C":
        return celsius
    elif to_unit == "F":
        return celsius * 9 / 5 + 32
    else:  # K
        return celsius + 273.15


def _find_conversion_factor(from_unit: str, to_unit: str, table: dict) -> float | None:
    """Find the conversion factor between two units in the same table."""
    if from_unit not in table or to_unit not in table:
        return None
    return table[from_unit] / table[to_unit]


def check_unit_conversion(
    value: float,
    from_unit: str,
    to_unit: str,
    claimed_answer: float,
    tolerance: float = 0.02,
) -> ValidationResult:
    """Check if a unit conversion is correct.

    Args:
        value: The original value
        from_unit: Source unit (e.g. "cm", "kg", "C")
        to_unit: Target unit (e.g. "m", "g", "F")
        claimed_answer: The claimed converted value
        tolerance: Fractional tolerance (default 2%)
    """
    from_unit = from_unit.strip()
    to_unit = to_unit.strip()

    # Temperature (special case)
    if from_unit in TEMPERATURE_UNITS and to_unit in TEMPERATURE_UNITS:
        correct = _convert_temperature(value, from_unit, to_unit)
        if abs(correct - claimed_answer) / max(abs(correct), 0.001) <= tolerance:
            return ValidationResult(
                is_valid=True, confidence=1.0,
                message=f"Correct: {value} {from_unit} = {claimed_answer} {to_unit}",
            )
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message=f"Incorrect: {value} {from_unit} should be {round(correct, 4)} {to_unit}, not {claimed_answer}",
            expected=str(round(correct, 4)),
            actual=str(claimed_answer),
        )

    # Try each conversion table
    for table in [LENGTH_TO_M, MASS_TO_KG, VOLUME_TO_L, TIME_TO_S, SPEED_TO_MS]:
        factor = _find_conversion_factor(from_unit, to_unit, table)
        if factor is not None:
            correct = value * factor
            if abs(correct - claimed_answer) / max(abs(correct), 0.001) <= tolerance:
                return ValidationResult(
                    is_valid=True, confidence=1.0,
                    message=f"Correct: {value} {from_unit} = {claimed_answer} {to_unit}",
                )
            return ValidationResult(
                is_valid=False, confidence=1.0,
                message=f"Incorrect: {value} {from_unit} should be {round(correct, 4)} {to_unit}, not {claimed_answer}",
                expected=str(round(correct, 4)),
                actual=str(claimed_answer),
            )

    return ValidationResult(
        is_valid=False, confidence=0.5,
        message=f"Cannot validate: unknown units '{from_unit}' or '{to_unit}'",
    )
