"""Generator registry — maps topic patterns to generator classes.

The registry is consulted by the routing logic to decide which questions
the Python engine can serve deterministically. Each generator declares
the topic patterns and sub-skills it supports.
"""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.generators.base import BaseGenerator

# Lazy imports to avoid circular deps
_registry: dict[str, type["BaseGenerator"]] = {}


def _build_registry() -> dict[str, type["BaseGenerator"]]:
    if _registry:
        return _registry

    from app.generators.fractions import FractionsGenerator
    from app.generators.simultaneous import SimultaneousGenerator
    from app.generators.quadratics import QuadraticsGenerator
    from app.generators.surds import SurdsGenerator

    generators = [
        FractionsGenerator,
        SimultaneousGenerator,
        QuadraticsGenerator,
        SurdsGenerator,
    ]

    for gen_cls in generators:
        _registry[gen_cls.generator_key] = gen_cls

    return _registry


def get_generator(
    key: str,
    curriculum: str,
    locale: str,
    difficulty: str,
    year_level: str = "",
    seed: int | None = None,
) -> "BaseGenerator | None":
    """Get a generator instance by key. Returns None if key not registered."""
    reg = _build_registry()
    cls = reg.get(key)
    if cls is None:
        return None
    return cls(curriculum, locale, difficulty, year_level, seed)


def match_topic_to_keys(topic: str) -> list[str]:
    """Match a freeform topic string to registered generator keys.

    Returns a list of matching keys ordered by relevance (best match first).
    Called by the routing logic in Next.js (via this service) to decide
    which generators to invoke.
    """
    topic_lower = topic.lower()
    matches = []

    # Order matters: more specific patterns first
    pattern_map = [
        ("simultaneous", "simultaneous"),
        ("simultaneous equations", "simultaneous"),
        ("system of equations", "simultaneous"),
        ("systems of equations", "simultaneous"),
        ("quadratic", "quadratics"),
        ("quadratics", "quadratics"),
        ("factorise quadratic", "quadratics"),
        ("factorize quadratic", "quadratics"),
        ("completing the square", "quadratics"),
        ("quadratic formula", "quadratics"),
        ("surds", "surds"),
        ("radicals", "surds"),
        ("rationalise", "surds"),
        ("rationalize", "surds"),
        ("simplify surd", "surds"),
        ("simplify radical", "surds"),
        ("fraction", "fractions"),
        ("fractions", "fractions"),
        ("adding fractions", "fractions"),
        ("subtracting fractions", "fractions"),
        ("multiplying fractions", "fractions"),
        ("dividing fractions", "fractions"),
        ("mixed number", "fractions"),
    ]

    matched_keys = set()
    for pattern, key in pattern_map:
        if pattern in topic_lower and key not in matched_keys:
            matches.append(key)
            matched_keys.add(key)

    return matches


def list_generator_keys() -> list[str]:
    """Return all registered generator keys."""
    return list(_build_registry().keys())
