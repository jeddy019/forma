"""Abstract base class for all question generators.

Every generator takes a standard set of inputs and returns Forma-compatible
question data. The base class enforces the contract and provides shared
utilities for difficulty scaling, locale terminology, and diagram generation.
"""

from abc import ABC, abstractmethod
from typing import Any

import numpy as np

from app.localisation import LocaleTerms, get_terms
from app.models import DiagramSpec, GenerationResponse, Question, QuestionPart


class BaseGenerator(ABC):
    """Base class all topic generators inherit from."""

    # Subclasses set these
    generator_key: str = ""
    topic_name: str = ""
    supported_sub_skills: list[str] = []

    def __init__(
        self,
        curriculum: str,
        locale: str,
        difficulty: str,
        year_level: str = "",
        seed: int | None = None,
    ):
        self.curriculum = curriculum
        self.locale = locale
        self.difficulty = difficulty
        self.year_level = year_level
        self.rng = np.random.default_rng(seed)
        self.terms = get_terms(locale)

    @abstractmethod
    def generate_questions(self, count: int) -> list[Question]:
        """Generate `count` questions for this generator's topic."""
        ...

    def generate(
        self, question_count: int, topic: str | None = None
    ) -> GenerationResponse:
        """Build the full GenerationResponse wrapping generated questions."""
        questions = self.generate_questions(question_count)
        return GenerationResponse(
            subject=self.topic_name,
            topic=topic or self.topic_name,
            curriculum=self.curriculum,
            year_level=self.year_level,
            difficulty_overall=self.difficulty,
            alignment_note=self._alignment_note(),
            questions=questions,
        )

    def _alignment_note(self) -> str:
        """Override in subclasses for specific board mentions (England only)."""
        if self.locale == "england":
            return f"Questions are appropriate for {self.year_level} {self.curriculum} Mathematics."
        return f"Questions are appropriate for {self.year_level} {self.curriculum} Mathematics."

    # --- Difficulty helpers ---

    def _difficulty_range(self, low: int, mid: int, high: int) -> int:
        """Return a value scaled by difficulty level."""
        if self.difficulty == "foundation":
            return low
        elif self.difficulty == "higher":
            return high
        return mid

    def _rand_int(self, low: int, high: int) -> int:
        """Random integer in [low, high] inclusive."""
        return int(self.rng.integers(low, high + 1))

    def _rand_choice(self, items: list[Any]) -> Any:
        """Random choice from a list."""
        idx = int(self.rng.integers(0, len(items)))
        return items[idx]

    def _shuffle(self, items: list[Any]) -> list[Any]:
        """Return a shuffled copy."""
        result = list(items)
        self.rng.shuffle(result)
        return result

    # --- KaTeX helpers ---

    @staticmethod
    def frac(num: int, den: int) -> str:
        """LaTeX display fraction."""
        return f"$\\dfrac{{{num}}}{{{den}}}$"

    @staticmethod
    def inline_frac(num: int, den: int) -> str:
        """LaTeX inline fraction."""
        return f"$\\tfrac{{{num}}}{{{den}}}$"

    @staticmethod
    def mixed(whole: int, num: int, den: int) -> str:
        """LaTeX mixed number."""
        return f"${whole}\\dfrac{{{num}}}{{{den}}}$"

    @staticmethod
    def sqrt(val: int) -> str:
        """LaTeX square root."""
        return f"$\\sqrt{{{val}}}$"

    @staticmethod
    def simplify_sqrt(val: int) -> tuple[int, int]:
        """Return (outer, inner) such that sqrt(val) = outer * sqrt(inner)."""
        outer = 1
        inner = val
        for p in range(2, int(val**0.5) + 1):
            while inner % (p * p) == 0:
                outer *= p
                inner //= p * p
        return outer, inner

    @staticmethod
    def surd_form(outer: int, inner: int) -> str:
        """LaTeX simplified surd."""
        if inner == 1:
            return f"${outer}$"
        if outer == 1:
            return f"$\\sqrt{{{inner}}}$"
        return f"${outer}\\sqrt{{{inner}}}$"

    @staticmethod
    def poly(coeffs: list[int], var: str = "x") -> str:
        """LaTeX polynomial from coefficient list [a, b, c] = ax^2 + bx + c."""
        terms = []
        degree = len(coeffs) - 1
        for i, c in enumerate(coeffs):
            if c == 0:
                continue
            power = degree - i
            if power == 0:
                terms.append(f"{c:+d}" if terms else f"{c}")
            elif power == 1:
                if c == 1:
                    terms.append(f"+{var}" if terms else var)
                elif c == -1:
                    terms.append(f"-{var}")
                else:
                    terms.append(f"{c:+d}{var}")
            else:
                if c == 1:
                    terms.append(f"+{var}^{{{power}}}" if terms else f"{var}^{{{power}}}")
                elif c == -1:
                    terms.append(f"-{var}^{{{power}}}")
                else:
                    terms.append(f"{c:+d}{var}^{{{power}}}")
        return "$" + "".join(terms).lstrip("+") + "$"

    # --- Diagram helpers ---

    @staticmethod
    def make_diagram(type_: str, params: dict) -> DiagramSpec:
        """Create a DiagramSpec with JSON-encoded params string."""
        import json
        return DiagramSpec(type=type_, params=json.dumps(params))

    def make_coordinate_grid(
        self,
        x_min: int,
        x_max: int,
        y_min: int,
        y_max: int,
        points: list[dict] | None = None,
        lines: list[dict] | None = None,
    ) -> DiagramSpec:
        return self.make_diagram(
            "coordinate_grid",
            {
                "xMin": x_min,
                "xMax": x_max,
                "yMin": y_min,
                "yMax": y_max,
                "points": points or [],
                "lines": lines or [],
            },
        )

    def make_table(self, headers: list[str], rows: list[list[str]]) -> DiagramSpec:
        return self.make_diagram("table", {"headers": headers, "rows": rows})

    def make_right_angle(
        self, base: int, height: int, hyp: int, labelled: str
    ) -> DiagramSpec:
        return self.make_diagram(
            "right_angle",
            {"base": base, "height": height, "hypotenuse": hyp, "labelledSide": labelled},
        )

    def make_bar_chart(
        self, labels: list[str], values: list[int], colours: list[str] | None = None
    ) -> DiagramSpec:
        return self.make_diagram(
            "bar_chart",
            {
                "labels": labels,
                "values": values,
                "colours": colours or ["primary"] * len(labels),
            },
        )

    def make_number_line(
        self,
        min_val: int,
        max_val: int,
        marked: list[dict] | None = None,
    ) -> DiagramSpec:
        return self.make_diagram(
            "number_line",
            {"min": min_val, "max": max_val, "markedPoints": marked or []},
        )

    def make_triangle(
        self,
        vertices: list[dict],
        labels: list[str] | None = None,
        angle_marks: list[dict] | None = None,
        side_lengths: list[dict] | None = None,
    ) -> DiagramSpec:
        return self.make_diagram(
            "triangle",
            {
                "vertices": vertices,
                "labels": labels or [],
                "angleMarks": angle_marks or [],
                "sideLengths": side_lengths or [],
            },
        )

    def make_pie_chart(
        self, labels: list[str], values: list[int]
    ) -> DiagramSpec:
        return self.make_diagram(
            "pie_chart",
            {"labels": labels, "values": values},
        )

    def make_circle(
        self,
        radius: int,
        label: str = "O",
        angles: list[dict] | None = None,
        sectors: list[dict] | None = None,
    ) -> DiagramSpec:
        return self.make_diagram(
            "circle",
            {
                "radius": radius,
                "label": label,
                "angles": angles or [],
                "sectors": sectors or [],
            },
        )
