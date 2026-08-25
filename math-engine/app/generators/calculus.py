"""Calculus generator (differentiation and integration).

Sub-skills:
- differentiate: find dy/dx of a polynomial
- gradient_at_point: find gradient of a curve at a given x value
- integrate: find the indefinite integral of a polynomial
- area_under_graph: find area under a line or simple curve between two points

Each answer is verified from the generated function.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class CalculusGenerator(BaseGenerator):
    generator_key = "calculus"
    topic_name = "Calculus"
    supported_sub_skills = [
        "differentiate",
        "gradient_at_point",
        "integrate",
        "area_under_graph",
    ]

    def generate_questions(self, count: int) -> list[Question]:
        questions = []
        sub_skills = self._shuffle(self.supported_sub_skills)
        for i in range(count):
            sub_skill = sub_skills[i % len(sub_skills)]
            q = self._make_question(i + 1, sub_skill)
            questions.append(q)
        return questions

    def _make_question(self, q_num: int, sub_skill: str) -> Question:
        if sub_skill == "differentiate":
            return self._differentiate_question(q_num, sub_skill)
        elif sub_skill == "gradient_at_point":
            return self._gradient_question(q_num, sub_skill)
        elif sub_skill == "integrate":
            return self._integrate_question(q_num, sub_skill)
        else:
            return self._area_question(q_num, sub_skill)

    def _poly_terms(self, coeffs: list[int]) -> str:
        """Format polynomial as LaTeX from highest-degree coefficients.
        e.g. [3, -2, 5] -> '3x^2 - 2x + 5'"""
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
                    terms.append(f"+x" if terms else "x")
                elif c == -1:
                    terms.append(f"-x")
                else:
                    terms.append(f"{c:+d}x")
            else:
                if c == 1:
                    terms.append(f"+x^{{{power}}}" if terms else f"x^{{{power}}}")
                elif c == -1:
                    terms.append(f"-x^{{{power}}}")
                else:
                    terms.append(f"{c:+d}x^{{{power}}}")
        return "$" + "".join(terms).lstrip("+") + "$"

    def _diff_poly(self, coeffs: list[int]) -> list[int]:
        """Differentiate polynomial coefficients. [3, -2, 5] -> [6, -2]"""
        degree = len(coeffs) - 1
        result = []
        for i, c in enumerate(coeffs):
            power = degree - i
            if power == 0:
                continue
            result.append(c * power)
        return result

    def _int_poly(self, coeffs: list[int]) -> list[int]:
        """Integrate polynomial coefficients (constant = 0). [3, -2] -> [1, -2, 0]"""
        degree = len(coeffs) - 1
        result = []
        for i, c in enumerate(coeffs):
            power = degree - i
            result.append(c // (power + 1))
        result.append(0)  # constant of integration
        return result

    def _eval_poly(self, coeffs: list[int], x: int) -> int:
        """Evaluate polynomial at x."""
        degree = len(coeffs) - 1
        total = 0
        for i, c in enumerate(coeffs):
            power = degree - i
            total += c * (x ** power)
        return total

    def _differentiate_question(self, q_num: int, sub_skill: str) -> Question:
        """Find dy/dx of a polynomial."""
        degree = self._difficulty_range(2, 3, 4)
        coeffs = [self._rand_int(-5, 5) for _ in range(degree + 1)]
        while coeffs[0] == 0:
            coeffs[0] = self._rand_int(1, 5)

        diff_coeffs = self._diff_poly(coeffs)
        f_str = self._poly_terms(coeffs)
        df_str = self._poly_terms(diff_coeffs)

        text = f"Find $\\dfrac{{dy}}{{dx}}$ when $y = {f_str[1:-1]}$."
        answer = df_str

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Apply power rule: multiply by power, reduce power by 1",
                A1=answer,
                common_error="Forgetting to reduce the power or dropping the constant term",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _gradient_question(self, q_num: int, sub_skill: str) -> Question:
        """Find gradient at a point on y = f(x)."""
        degree = self._difficulty_range(2, 3, 3)
        coeffs = [self._rand_int(-4, 4) for _ in range(degree + 1)]
        while coeffs[0] == 0:
            coeffs[0] = self._rand_int(1, 5)

        x_val = self._rand_int(-3, 3)
        diff_coeffs = self._diff_poly(coeffs)
        gradient = self._eval_poly(diff_coeffs, x_val)
        f_str = self._poly_terms(coeffs)

        text = f"Find the gradient of the curve $y = {f_str[1:-1]}$ at the point where $x = {x_val}$."
        answer = str(gradient)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Find dy/dx, then substitute x = {x_val}",
                A1=f"Gradient = {gradient}",
                common_error="Differentiation error or arithmetic error when substituting",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _integrate_question(self, q_num: int, sub_skill: str) -> Question:
        """Find the indefinite integral of a polynomial."""
        degree = self._difficulty_range(2, 3, 3)
        coeffs = [self._rand_int(-5, 5) for _ in range(degree + 1)]
        while coeffs[0] == 0:
            coeffs[0] = self._rand_int(1, 5)
        # Remove constant term if present
        if len(coeffs) > 1:
            coeffs = coeffs[:-1]

        int_coeffs = self._int_poly(coeffs)
        f_str = self._poly_terms(coeffs)
        int_str = self._poly_terms(int_coeffs)

        text = f"Find $\\displaystyle\\int {f_str[1:-1]}\\,\\mathrm{{d}}x$."
        answer = f"{int_str[1:-1]} + c"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Increase power by 1, divide by new power",
                A1=answer,
                common_error="Forgetting +c or wrong division",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _area_question(self, q_num: int, sub_skill: str) -> Question:
        """Find area under a straight line (trapezium) or simple quadratic between two points."""
        scenario = self._rand_choice(["line", "quadratic"])

        if scenario == "line":
            # y = mx + c, area is a trapezium - ensure line stays above axis
            m = self._rand_choice([-2, -1, 0, 1, 2])
            c = self._rand_int(5, 15)
            x1 = self._rand_int(0, 3)
            x2 = x1 + self._rand_int(2, 4)

            y1 = m * x1 + c
            y2 = m * x2 + c

            # Ensure both y values are positive
            if y1 < 0 or y2 < 0:
                c = abs(m * x2) + self._rand_int(3, 8)
                y1 = m * x1 + c
                y2 = m * x2 + c

            # Area of trapezium: (y1 + y2) * (x2 - x1) / 2
            area_num = (y1 + y2) * (x2 - x1)
            if area_num % 2 != 0:
                # Adjust to get integer area
                x2 += 1
                y2 = m * x2 + c
                area_num = (y1 + y2) * (x2 - x1)
            area = area_num // 2

            eq = f"y = {m}x + {c}" if m != 1 else f"y = x + {c}"
            if m == -1:
                eq = f"y = -x + {c}"

            text = (
                f"Find the area under the line ${eq}$ between $x = {x1}$ and $x = {x2}$."
            )
            answer = str(area)

            part = QuestionPart(
                part_label=None,
                text=text,
                marks=3,
                diagram_spec=None,
                working_lines=4,
                answer=answer,
                answer_format="numerical",
                mark_scheme=MarkScheme(
                    M1=f"Trapezium: (y1 + y2) x width / 2 = ({y1} + {y2}) x {x2 - x1} / 2",
                    A1=f"Area = {area}",
                    common_error="Wrong area formula",
                    allow=answer,
                ),
            )
        else:
            # y = x^2 from x=a to x=b, area = [x^3/3] from a to b
            a = self._rand_int(0, 3)
            b = a + self._rand_int(1, 4)
            # Area = (b^3 - a^3) / 3
            num = b ** 3 - a ** 3
            if num % 3 != 0:
                # Adjust b to make divisible by 3
                b += 1
                while (b ** 3 - a ** 3) % 3 != 0:
                    b += 1
                num = b ** 3 - a ** 3
            area = num // 3

            text = (
                f"Find the area under the curve $y = x^2$ between $x = {a}$ and $x = {b}$."
            )
            answer = str(area)

            part = QuestionPart(
                part_label=None,
                text=text,
                marks=3,
                diagram_spec=None,
                working_lines=4,
                answer=answer,
                answer_format="numerical",
                mark_scheme=MarkScheme(
                    M1=f"Integrate: [x^3/3] from {a} to {b}",
                    A1=f"({b}^3 - {a}^3) / 3 = {area}",
                    common_error="Forgetting to subtract lower limit",
                    allow=answer,
                ),
            )

        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _q_type(self, q_num: int) -> str:
        if q_num <= 2:
            return "warm-up"
        elif q_num <= 8:
            return "core"
        return "challenge"
