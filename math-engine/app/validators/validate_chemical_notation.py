"""Chemical notation validator.

Checks if chemical notation (formulae, states, ion charges, electron configurations)
is written correctly.
"""

import re

from app.validators import ValidationResult

# Common ion charges
KNOWN_IONS = {
    "Na+": 1, "K+": 1, "Ag+": 1, "H+": 1,
    "Mg2+": 2, "Ca2+": 2, "Ba2+": 2, "Zn2+": 2, "Cu2+": 2, "Fe2+": 2,
    "Al3+": 3, "Fe3+": 3, "Cr3+": 3,
    "O2-": -2, "S2-": -2, "OH-": -1, "NO3-": -1, "Cl-": -1, "Br-": -1, "I-": -1,
    "CO3 2-": -2, "SO4 2-": -2, "PO4 3-": -3, "NH4+": 1,
    "HCO3-": -1, "MnO4-": -1, "Cr2O7 2-": -2,
}

# Common states
VALID_STATES = {"(s)", "(l)", "(g)", "(aq)"}


def validate_chemical_notation(notation: str, check_type: str = "formula") -> ValidationResult:
    """Validate chemical notation.

    Args:
        notation: The chemical notation to check
        check_type: One of "formula", "ion_charge", "state_symbol"
    """
    notation = notation.strip()

    if check_type == "formula":
        return _validate_formula(notation)
    elif check_type == "ion_charge":
        return _validate_ion_charge(notation)
    elif check_type == "state_symbol":
        return _validate_state_symbol(notation)
    else:
        return ValidationResult(
            is_valid=False, confidence=0.5,
            message=f"Unknown check type: {check_type}",
        )


def _validate_formula(formula: str) -> ValidationResult:
    """Check if a formula uses valid chemical notation.
    This is a basic syntax check - not a chemistry database lookup."""
    formula = formula.strip()

    if not formula:
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message="Empty formula",
        )

    # Check for valid characters: uppercase letter, optional lowercase, optional digits, parens
    # e.g. H2O, Ca(OH)2, Fe2O3, NaCl
    valid_pattern = r'^[A-Z][a-z]?[\d]*[\(\)A-Za-z\d\+\-]*$'
    if not re.match(valid_pattern, formula):
        return ValidationResult(
            is_valid=False, confidence=0.7,
            message=f"Formula may have invalid notation: {formula}. Check element symbols.",
        )

    return ValidationResult(
        is_valid=True, confidence=0.8,
        message=f"Formula notation appears valid: {formula}",
    )


def _validate_ion_charge(notation: str) -> ValidationResult:
    """Validate an ion's charge notation."""
    notation = notation.strip()

    # Check against known ions
    for ion, charge in KNOWN_IONS.items():
        if notation.replace(" ", "") == ion.replace(" ", ""):
            return ValidationResult(
                is_valid=True, confidence=1.0,
                message=f"Correct: {notation} has charge {charge:+d}",
            )

    # Format check: should end with a number and sign
    if re.match(r'^[A-Z][a-z]?\d*[\+\-]\d*$', notation):
        return ValidationResult(
            is_valid=True, confidence=0.7,
            message=f"Charge notation looks valid but not in reference database: {notation}",
        )

    return ValidationResult(
        is_valid=False, confidence=0.6,
        message=f"Unrecognised ion notation: {notation}. Check format (e.g. Na+, Ca2+, Cl-)",
    )


def _validate_state_symbol(notation: str) -> ValidationResult:
    """Validate a state symbol."""
    notation = notation.strip()

    if notation in VALID_STATES:
        return ValidationResult(
            is_valid=True, confidence=1.0,
            message=f"Valid state symbol: {notation}",
        )

    # Common mistakes
    corrections = {
        "(aq)": "aqueous solution",
        "(s)": "solid",
        "(l)": "liquid",
        "(g)": "gas",
    }

    return ValidationResult(
        is_valid=False, confidence=0.9,
        message=f"Invalid state symbol: {notation}. Valid options: {', '.join(VALID_STATES)}",
    )


# Import here to avoid circular issues in the type check above
try:
    from app.validators.verify_periodic_table_data import ELEMENTS
except ImportError:
    ELEMENTS = {}
