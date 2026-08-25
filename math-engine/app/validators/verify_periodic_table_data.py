"""Periodic table data validator.

Checks facts about elements against a built-in reference table.
Covers the most common elements needed at GCSE/A-Level.
"""

from app.validators import ValidationResult

# Element data: (symbol, atomic_number, mass_number, group, period, category)
ELEMENTS = {
    "H":  {"name": "Hydrogen",  "number": 1,  "mass": 1.008,   "group": 1,  "period": 1, "category": "non-metal"},
    "He": {"name": "Helium",    "number": 2,  "mass": 4.003,   "group": 18, "period": 1, "category": "noble gas"},
    "Li": {"name": "Lithium",   "number": 3,  "mass": 6.941,   "group": 1,  "period": 2, "category": "alkali metal"},
    "Be": {"name": "Beryllium", "number": 4,  "mass": 9.012,   "group": 2,  "period": 2, "category": "alkaline earth"},
    "B":  {"name": "Boron",     "number": 5,  "mass": 10.81,   "group": 13, "period": 2, "category": "metalloid"},
    "C":  {"name": "Carbon",    "number": 6,  "mass": 12.011,  "group": 14, "period": 2, "category": "non-metal"},
    "N":  {"name": "Nitrogen",  "number": 7,  "mass": 14.007,  "group": 15, "period": 2, "category": "non-metal"},
    "O":  {"name": "Oxygen",    "number": 8,  "mass": 15.999,  "group": 16, "period": 2, "category": "non-metal"},
    "F":  {"name": "Fluorine",  "number": 9,  "mass": 18.998,  "group": 17, "period": 2, "category": "halogen"},
    "Ne": {"name": "Neon",      "number": 10, "mass": 20.180,  "group": 18, "period": 2, "category": "noble gas"},
    "Na": {"name": "Sodium",    "number": 11, "mass": 22.990,  "group": 1,  "period": 3, "category": "alkali metal"},
    "Mg": {"name": "Magnesium", "number": 12, "mass": 24.305,  "group": 2,  "period": 3, "category": "alkaline earth"},
    "Al": {"name": "Aluminium", "number": 13, "mass": 26.982,  "group": 13, "period": 3, "category": "metal"},
    "Si": {"name": "Silicon",   "number": 14, "mass": 28.086,  "group": 14, "period": 3, "category": "metalloid"},
    "P":  {"name": "Phosphorus","number": 15, "mass": 30.974,  "group": 15, "period": 3, "category": "non-metal"},
    "S":  {"name": "Sulphur",   "number": 16, "mass": 32.065,  "group": 16, "period": 3, "category": "non-metal"},
    "Cl": {"name": "Chlorine",  "number": 17, "mass": 35.453,  "group": 17, "period": 3, "category": "halogen"},
    "Ar": {"name": "Argon",     "number": 18, "mass": 39.948,  "group": 18, "period": 3, "category": "noble gas"},
    "K":  {"name": "Potassium", "number": 19, "mass": 39.098,  "group": 1,  "period": 4, "category": "alkali metal"},
    "Ca": {"name": "Calcium",   "number": 20, "mass": 40.078,  "group": 2,  "period": 4, "category": "alkaline earth"},
    "Fe": {"name": "Iron",      "number": 26, "mass": 55.845,  "group": 8,  "period": 4, "category": "transition metal"},
    "Cu": {"name": "Copper",    "number": 29, "mass": 63.546,  "group": 11, "period": 4, "category": "transition metal"},
    "Zn": {"name": "Zinc",      "number": 30, "mass": 65.38,   "group": 12, "period": 4, "category": "transition metal"},
    "Br": {"name": "Bromine",   "number": 35, "mass": 79.904,  "group": 17, "period": 4, "category": "halogen"},
    "Ag": {"name": "Silver",    "number": 47, "mass": 107.868, "group": 11, "period": 5, "category": "transition metal"},
    "I":  {"name": "Iodine",    "number": 53, "mass": 126.904, "group": 17, "period": 5, "category": "halogen"},
    "Au": {"name": "Gold",      "number": 79, "mass": 196.967, "group": 11, "period": 6, "category": "transition metal"},
    "Pb": {"name": "Lead",      "number": 82, "mass": 207.2,   "group": 14, "period": 6, "category": "metal"},
}


def verify_periodic_table_data(
    symbol: str,
    property_name: str,
    claimed_value,
) -> ValidationResult:
    """Verify a fact about an element.

    Args:
        symbol: Element symbol (e.g. "Fe")
        property_name: One of "name", "number", "mass", "group", "period", "category"
        claimed_value: The claimed value for that property
    """
    symbol = symbol.strip().capitalize()
    # Handle two-letter symbols
    if len(symbol) > 1:
        symbol = symbol[0].upper() + symbol[1].lower()

    if symbol not in ELEMENTS:
        return ValidationResult(
            is_valid=False, confidence=0.5,
            message=f"Unknown element symbol: {symbol}",
        )

    element = ELEMENTS[symbol]
    valid_properties = {"name", "number", "mass", "group", "period", "category"}

    if property_name not in valid_properties:
        return ValidationResult(
            is_valid=False, confidence=0.5,
            message=f"Unknown property: {property_name}. Valid: {', '.join(sorted(valid_properties))}",
        )

    correct = element[property_name]

    if property_name == "mass":
        # Allow 1% tolerance for mass
        if abs(correct - claimed_value) / correct <= 0.01:
            return ValidationResult(
                is_valid=True, confidence=1.0,
                message=f"Correct: {symbol} has mass {claimed_value}",
            )
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message=f"Incorrect: {symbol} has mass {correct}, not {claimed_value}",
            expected=str(correct),
            actual=str(claimed_value),
        )
    else:
        if str(correct).lower() == str(claimed_value).lower():
            return ValidationResult(
                is_valid=True, confidence=1.0,
                message=f"Correct: {symbol} {property_name} = {claimed_value}",
            )
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message=f"Incorrect: {symbol} {property_name} = {correct}, not {claimed_value}",
            expected=str(correct),
            actual=str(claimed_value),
        )
