"""Locale-aware terminology and measurement conventions.

One shared policy consumed by every generator. England uses "Surds",
"Simultaneous Equations", "Factorise", "Indices", UK spelling, metric.
US uses "Radicals", "Systems of Equations", "Factorize", "Exponents",
US spelling, customary units. Ontario uses "Systems of Equations" and
"Radicals" with Canadian spelling and metric.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class LocaleTerms:
    radicals: str
    systems_of_equations: str
    factorize: str
    exponents: str
    show_working: str
    units_system: str  # "metric" | "us_customary"
    spelling: str  # "uk" | "us" | "canadian"


TERMS: dict[str, LocaleTerms] = {
    "england": LocaleTerms(
        radicals="Surds",
        systems_of_equations="Simultaneous Equations",
        factorize="Factorise",
        exponents="Indices",
        show_working="show your working",
        units_system="metric",
        spelling="uk",
    ),
    "united_states": LocaleTerms(
        radicals="Radicals",
        systems_of_equations="Systems of Equations",
        factorize="Factorize",
        exponents="Exponents",
        show_working="show your work",
        units_system="us_customary",
        spelling="us",
    ),
    "canada_ontario": LocaleTerms(
        radicals="Radicals",
        systems_of_equations="Systems of Equations",
        factorize="Factorise",
        exponents="Exponents",
        show_working="show your work",
        units_system="metric",
        spelling="canadian",
    ),
}

# Curriculum level mappings per country
CURRICULUM_LEVELS: dict[str, list[str]] = {
    "england": ["KS2", "KS3", "GCSE", "A-Level"],
    "canada_ontario": ["Ontario Elementary", "Ontario Secondary"],
    "united_states": ["US Common Core"],
}


def get_terms(locale: str) -> LocaleTerms:
    """Return locale terms, defaulting to England if unknown."""
    return TERMS.get(locale, TERMS["england"])


def get_valid_curriculum_levels(locale: str) -> list[str]:
    """Return curriculum levels valid for a locale."""
    return CURRICULUM_LEVELS.get(locale, [])
