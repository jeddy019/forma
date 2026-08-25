"""Balance chemical equations validator.

Checks if a chemical equation has equal numbers of each atom on both sides.
Handles simple and moderately complex equations.
"""

import re
from collections import Counter

from app.validators import ValidationResult


def _parse_formula(formula: str) -> Counter:
    """Parse a chemical formula into atom counts.
    Supports: H2O, Ca(OH)2, Mg3(PO4)2, Fe2O3, etc."""
    formula = formula.strip()
    stack: list[Counter] = [Counter()]
    i = 0

    while i < len(formula):
        ch = formula[i]

        if ch == '(':
            stack.append(Counter())
            i += 1
        elif ch == ')':
            i += 1
            # Read multiplier
            num_str = ""
            while i < len(formula) and formula[i].isdigit():
                num_str += formula[i]
                i += 1
            multiplier = int(num_str) if num_str else 1
            group = stack.pop()
            for atom, count in group.items():
                stack[-1][atom] += count * multiplier
        elif ch.isupper():
            # Read element symbol
            atom = ch
            i += 1
            while i < len(formula) and formula[i].islower():
                atom += formula[i]
                i += 1
            # Read count
            num_str = ""
            while i < len(formula) and formula[i].isdigit():
                num_str += formula[i]
                i += 1
            count = int(num_str) if num_str else 1
            stack[-1][atom] += count
        else:
            i += 1

    return stack[0]


def _parse_side(side: str) -> Counter:
    """Parse one side of a chemical equation (may have multiple compounds separated by +)."""
    total = Counter()
    compounds = re.split(r'\s*\+\s*', side.strip())
    for compound in compounds:
        compound = compound.strip()
        if not compound:
            continue
        # Check for coefficient: e.g. "2H2O"
        match = re.match(r'^(\d+)(.+)$', compound)
        if match:
            coeff = int(match.group(1))
            formula = match.group(2)
        else:
            coeff = 1
            formula = compound

        atoms = _parse_formula(formula)
        for atom, count in atoms.items():
            total[atom] += count * coeff

    return total


def balance_equation(equation: str) -> ValidationResult:
    """Check if a chemical equation is balanced (equal atoms on both sides).

    Accepts formats like:
    - "2H2 + O2 = 2H2O"
    - "2H2 + O2 -> 2H2O"
    - "2H2 + O2 --> 2H2O"
    """
    # Split on arrow or equals
    parts = re.split(r'\s*(?:--?>?|={1,2})\s*', equation.strip())
    if len(parts) != 2:
        return ValidationResult(
            is_valid=False,
            confidence=1.0,
            message="Could not parse equation - expected one '=' or '->' separating reactants and products",
        )

    left_atoms = _parse_side(parts[0])
    right_atoms = _parse_side(parts[1])

    if left_atoms == right_atoms:
        return ValidationResult(
            is_valid=True,
            confidence=1.0,
            message="Equation is balanced",
        )

    # Find mismatches
    all_atoms = set(left_atoms.keys()) | set(right_atoms.keys())
    mismatches = []
    for atom in sorted(all_atoms):
        l = left_atoms.get(atom, 0)
        r = right_atoms.get(atom, 0)
        if l != r:
            mismatches.append(f"{atom}: {l} vs {r}")

    return ValidationResult(
        is_valid=False,
        confidence=1.0,
        message=f"Equation is not balanced. Mismatches: {'; '.join(mismatches)}",
        expected="Equal atoms on both sides",
        actual=f"Left: {dict(left_atoms)}, Right: {dict(right_atoms)}",
    )
