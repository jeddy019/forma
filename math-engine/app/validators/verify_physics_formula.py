"""Physics formula validator.

Checks if a calculation using a known physics formula is correct.
Supports common GCSE/A-Level formulas for mechanics, waves, electricity, and energy.
"""

import math

from app.validators import ValidationResult

# Formula: (name, formula_fn, units_description)
# formula_fn takes keyword args and returns expected answer
PHYSICS_FORMULAS = {
    # Mechanics
    "speed_distance_time": {
        "name": "Speed = Distance / Time",
        "vars": ["distance", "time"],
        "target": "speed",
        "fn": lambda distance, time: distance / time,
    },
    "distance_speed_time": {
        "name": "Distance = Speed x Time",
        "vars": ["speed", "time"],
        "target": "distance",
        "fn": lambda speed, time: speed * time,
    },
    "force_mass_acceleration": {
        "name": "F = ma",
        "vars": ["mass", "acceleration"],
        "target": "force",
        "fn": lambda mass, acceleration: mass * acceleration,
    },
    "weight_mass_gravity": {
        "name": "W = mg",
        "vars": ["mass", "gravity"],
        "target": "weight",
        "fn": lambda mass, gravity: mass * gravity,
    },
    "momentum_mass_velocity": {
        "name": "p = mv",
        "vars": ["mass", "velocity"],
        "target": "momentum",
        "fn": lambda mass, velocity: mass * velocity,
    },
    "kinetic_energy": {
        "name": "KE = 1/2 mv^2",
        "vars": ["mass", "velocity"],
        "target": "kinetic_energy",
        "fn": lambda mass, velocity: 0.5 * mass * velocity ** 2,
    },
    "gpe": {
        "name": "GPE = mgh",
        "vars": ["mass", "gravity", "height"],
        "target": "gpe",
        "fn": lambda mass, gravity, height: mass * gravity * height,
    },
    "power_energy_time": {
        "name": "P = E/t",
        "vars": ["energy", "time"],
        "target": "power",
        "fn": lambda energy, time: energy / time,
    },
    "work_done_force_distance": {
        "name": "W = Fd",
        "vars": ["force", "distance"],
        "target": "work_done",
        "fn": lambda force, distance: force * distance,
    },
    # Waves
    "wave_speed": {
        "name": "v = f lambda",
        "vars": ["frequency", "wavelength"],
        "target": "wave_speed",
        "fn": lambda frequency, wavelength: frequency * wavelength,
    },
    # Electricity
    "ohms_law": {
        "name": "V = IR",
        "vars": ["current", "resistance"],
        "target": "voltage",
        "fn": lambda current, resistance: current * resistance,
    },
    "power_electrical": {
        "name": "P = IV",
        "vars": ["current", "voltage"],
        "target": "power",
        "fn": lambda current, voltage: current * voltage,
    },
    # Pressure
    "pressure_force_area": {
        "name": "P = F/A",
        "vars": ["force", "area"],
        "target": "pressure",
        "fn": lambda force, area: force / area,
    },
    # Acceleration
    "suvat_constant_acceleration": {
        "name": "s = ut + 1/2 at^2",
        "vars": ["initial_velocity", "time", "acceleration"],
        "target": "displacement",
        "fn": lambda initial_velocity, time, acceleration: initial_velocity * time + 0.5 * acceleration * time ** 2,
    },
}


def verify_physics_formula(
    formula_key: str,
    given_values: dict[str, float],
    claimed_answer: float,
    target_variable: str | None = None,
    tolerance: float = 0.02,
) -> ValidationResult:
    """Verify a physics formula calculation.

    Args:
        formula_key: Key from PHYSICS_FORMULAS dict
        given_values: Dict of variable_name -> value
        claimed_answer: The student's claimed answer
        target_variable: Override which variable is being solved for
        tolerance: Fractional tolerance (default 2%)
    """
    if formula_key not in PHYSICS_FORMULAS:
        return ValidationResult(
            is_valid=False, confidence=0.5,
            message=f"Unknown formula key: {formula_key}",
        )

    formula = PHYSICS_FORMULAS[formula_key]

    try:
        correct = formula["fn"](**given_values)
    except (TypeError, KeyError) as e:
        return ValidationResult(
            is_valid=False, confidence=0.5,
            message=f"Missing variables for {formula['name']}: {e}",
        )

    if abs(correct) < 1e-10:
        if abs(claimed_answer) < 1e-10:
            return ValidationResult(
                is_valid=True, confidence=1.0,
                message=f"Correct: {formula['name']} = {claimed_answer}",
            )
        return ValidationResult(
            is_valid=False, confidence=1.0,
            message=f"Incorrect: {formula['name']} = 0, not {claimed_answer}",
            expected="0",
            actual=str(claimed_answer),
        )

    if abs(correct - claimed_answer) / abs(correct) <= tolerance:
        return ValidationResult(
            is_valid=True, confidence=1.0,
            message=f"Correct: {formula['name']} = {claimed_answer}",
        )

    return ValidationResult(
        is_valid=False, confidence=1.0,
        message=f"Incorrect: {formula['name']} gives {round(correct, 4)}, not {claimed_answer}",
        expected=str(round(correct, 4)),
        actual=str(claimed_answer),
    )
