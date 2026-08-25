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
    from app.generators.arithmetic import ArithmeticGenerator
    from app.generators.linear_equations import LinearEquationsGenerator
    from app.generators.inequalities import InequalitiesGenerator
    from app.generators.ratio import RatioGenerator
    from app.generators.percentages import PercentagesGenerator
    from app.generators.indices import IndicesGenerator
    from app.generators.coordinate_geometry import CoordinateGeometryGenerator
    from app.generators.shapes import ShapesGenerator
    from app.generators.transformations import TransformationsGenerator
    from app.generators.graphs import GraphsGenerator
    from app.generators.statistics import StatisticsGenerator
    from app.generators.probability import ProbabilityGenerator
    from app.generators.calculus import CalculusGenerator
    from app.generators.trigonometry import TrigonometryGenerator
    from app.generators.sequences import SequencesGenerator
    from app.generators.standard_form import StandardFormGenerator
    from app.generators.bounds import BoundsGenerator
    from app.generators.worked_examples import WorkedExamplesGenerator
    from app.generators.english import EnglishGenerator
    from app.generators.vectors import VectorsGenerator
    from app.generators.circle_theorems import CircleTheoremsGenerator
    from app.generators.sets_venn import SetsVennGenerator

    generators = [
        FractionsGenerator,
        SimultaneousGenerator,
        QuadraticsGenerator,
        SurdsGenerator,
        ArithmeticGenerator,
        LinearEquationsGenerator,
        InequalitiesGenerator,
        RatioGenerator,
        PercentagesGenerator,
        IndicesGenerator,
        CoordinateGeometryGenerator,
        ShapesGenerator,
        TransformationsGenerator,
        GraphsGenerator,
        StatisticsGenerator,
        ProbabilityGenerator,
        CalculusGenerator,
        TrigonometryGenerator,
        SequencesGenerator,
        StandardFormGenerator,
        BoundsGenerator,
        WorkedExamplesGenerator,
        EnglishGenerator,
        VectorsGenerator,
        CircleTheoremsGenerator,
        SetsVennGenerator,
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
        ("arithmetic", "arithmetic"),
        ("order of operations", "arithmetic"),
        ("bodmas", "arithmetic"),
        ("pemdas", "arithmetic"),
        ("hcf", "arithmetic"),
        ("lcm", "arithmetic"),
        ("highest common factor", "arithmetic"),
        ("lowest common multiple", "arithmetic"),
        ("prime", "arithmetic"),
        ("factors", "arithmetic"),
        ("multiples", "arithmetic"),
        ("linear equation", "linear_equations"),
        ("solve for x", "linear_equations"),
        ("solve x", "linear_equations"),
        ("one step equation", "linear_equations"),
        ("two step equation", "linear_equations"),
        ("forming equation", "linear_equations"),
        ("word problem", "linear_equations"),
        ("inequality", "inequalities"),
        ("inequalities", "inequalities"),
        ("solve inequality", "inequalities"),
        ("number line", "inequalities"),
        ("compound inequality", "inequalities"),
        ("ratio", "ratio"),
        ("ratios", "ratio"),
        ("simplify ratio", "ratio"),
        ("share in ratio", "ratio"),
        ("sharing in ratio", "ratio"),
        ("direct proportion", "ratio"),
        ("inverse proportion", "ratio"),
        ("proportion", "ratio"),
        ("percentage", "percentages"),
        ("percentages", "percentages"),
        ("percent", "percentages"),
        ("increase by", "percentages"),
        ("decrease by", "percentages"),
        ("compound", "percentages"),
        ("reverse percentage", "percentages"),
        ("original value", "percentages"),
        ("indices", "indices"),
        ("index laws", "indices"),
        ("laws of indices", "indices"),
        ("negative index", "indices"),
        ("negative indices", "indices"),
        ("fractional index", "indices"),
        ("exponent", "indices"),
        ("exponents", "indices"),
        ("gradient", "coordinate_geometry"),
        ("equation of line", "coordinate_geometry"),
        ("equation of a line", "coordinate_geometry"),
        ("y = mx + c", "coordinate_geometry"),
        ("midpoint", "coordinate_geometry"),
        ("distance between", "coordinate_geometry"),
        ("parallel line", "coordinate_geometry"),
        ("perpendicular line", "coordinate_geometry"),
        ("coordinates", "coordinate_geometry"),
        ("area", "shapes"),
        ("perimeter", "shapes"),
        ("volume", "shapes"),
        ("angle", "shapes"),
        ("angles", "shapes"),
        ("triangle", "shapes"),
        ("rectangle", "shapes"),
        ("circle", "shapes"),
        ("trapezium", "shapes"),
        ("pythagoras", "shapes"),
        ("pythagorean", "shapes"),
        ("hypotenuse", "shapes"),
        ("cuboid", "shapes"),
        ("cylinder", "shapes"),
        ("prism", "shapes"),
        ("reflection", "transformations"),
        ("reflect", "transformations"),
        ("rotation", "transformations"),
        ("rotate", "transformations"),
        ("translation", "transformations"),
        ("translate", "transformations"),
        ("enlargement", "transformations"),
        ("scale factor", "transformations"),
        ("transformation", "transformations"),
        ("graph", "graphs"),
        ("plot", "graphs"),
        ("gradient and intercept", "graphs"),
        ("y = mx + c", "graphs"),
        ("turning point", "graphs"),
        ("vertex", "graphs"),
        ("roots of", "graphs"),
        ("factorise cubic", "graphs"),
        ("asymptote", "graphs"),
        ("asymptotes", "graphs"),
        ("reciprocal", "graphs"),
        ("cubic", "graphs"),
        ("statistics", "statistics"),
        ("mean", "statistics"),
        ("median", "statistics"),
        ("mode", "statistics"),
        ("average", "statistics"),
        ("range", "statistics"),
        ("interquartile", "statistics"),
        ("iqr", "statistics"),
        ("frequency table", "statistics"),
        ("cumulative frequency", "statistics"),
        ("grouped data", "statistics"),
        ("data set", "statistics"),
        ("probability", "probability"),
        ("dice", "probability"),
        ("cards", "probability"),
        ("spinner", "probability"),
        ("tree diagram", "probability"),
        ("combined event", "probability"),
        ("relative frequency", "probability"),
        ("experimental probability", "probability"),
        ("calculus", "calculus"),
        ("differentiat", "calculus"),
        ("dy/dx", "calculus"),
        ("gradient of curve", "calculus"),
        ("integrate", "calculus"),
        ("integral", "calculus"),
        ("area under", "calculus"),
        ("antiderivative", "calculus"),
        ("trigonometry", "trigonometry"),
        ("trig", "trigonometry"),
        ("sohcahtoa", "trigonometry"),
        ("soh cah toa", "trigonometry"),
        ("sine rule", "trigonometry"),
        ("cosine rule", "trigonometry"),
        ("exact trig", "trigonometry"),
        ("trig graph", "trigonometry"),
        ("trigonometric", "trigonometry"),
        ("sequence", "sequences"),
        ("sequences", "sequences"),
        ("nth term", "sequences"),
        ("term to term", "sequences"),
        ("arithmetic sequence", "sequences"),
        ("common difference", "sequences"),
        ("quadratic sequence", "sequences"),
        ("standard form", "standard_form"),
        ("standard notation", "standard_form"),
        ("scientific notation", "standard_form"),
        ("bounds", "bounds"),
        ("upper bound", "bounds"),
        ("lower bound", "bounds"),
        ("error interval", "bounds"),
        ("rounding error", "bounds"),
        ("worked example", "worked_examples"),
        ("worked solution", "worked_examples"),
        ("step by step", "worked_examples"),
        ("show me how", "worked_examples"),
        ("english", "english"),
        ("comprehension", "english"),
        ("reading", "english"),
        ("analysis", "english"),
        ("language analysis", "english"),
        ("metaphor", "english"),
        ("simile", "english"),
        ("personification", "english"),
        ("persuasive writing", "english"),
        ("descriptive writing", "english"),
        ("paragraph", "english"),
        ("spelling", "english"),
        ("punctuation", "english"),
        ("grammar", "english"),
        ("spag", "english"),
        ("semi-colon", "english"),
        ("argumentative", "english"),
        ("informational", "english"),
        ("narrative writing", "english"),
        ("text structure", "english"),
        ("vocabulary", "english"),
        ("homophone", "english"),
        ("run-on", "english"),
        ("comma splice", "english"),
        ("subject and predicate", "english"),
        ("ela", "english"),
        ("common core ela", "english"),
        ("vector", "vectors"),
        ("vectors", "vectors"),
        ("column vector", "vectors"),
        ("add vectors", "vectors"),
        ("magnitude of", "vectors"),
        ("circle theorem", "circle_theorems"),
        ("circle theorems", "circle_theorems"),
        ("angle at centre", "circle_theorems"),
        ("cyclic quadrilateral", "circle_theorems"),
        ("angle in semicircle", "circle_theorems"),
        ("tangent perpendicular", "circle_theorems"),
        ("alternate segment", "circle_theorems"),
        ("set", "sets_venn"),
        ("sets", "sets_venn"),
        ("venn", "sets_venn"),
        ("venn diagram", "sets_venn"),
        ("union of", "sets_venn"),
        ("intersection of", "sets_venn"),
        ("complement", "sets_venn"),
        ("subset", "sets_venn"),
        ("power set", "sets_venn"),
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
