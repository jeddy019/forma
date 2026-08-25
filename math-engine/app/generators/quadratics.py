"""Quadratics generator.

Sub-skills:
- factorise: factorise quadratic expressions
- quadratic_formula: solve using the formula
- completing_square: solve by completing the square
- graph_sketching: sketch/interpret quadratic graphs
- forming_equations: form quadratics from word problems

Generates quadratics with known roots so answers are verified.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class QuadraticsGenerator(BaseGenerator):
    generator_key = "quadratics"
    topic_name = "Quadratics"
    supported_sub_skills = [
        "factorise",
        "quadratic_formula",
        "completing_square",
        "graph_sketching",
        "forming_equations",
    ]

    def _alignment_note(self) -> str:
        if self.locale == "england":
            return f"Questions are suitable for {self.year_level} {self.curriculum} Mathematics (AQA and Edexcel)."
        return f"Questions are suitable for {self.year_level} {self.curriculum} Mathematics."

    def generate_questions(self, count: int) -> list[Question]:
        questions = []
        sub_skills = self._shuffle(self.supported_sub_skills)
        for i in range(count):
            sub_skill = sub_skills[i % len(sub_skills)]
            q = self._make_question(i + 1, sub_skill)
            questions.append(q)
        return questions

    def _make_question(self, q_num: int, sub_skill: str) -> Question:
        if sub_skill == "factorise":
            return self._factorise_question(q_num, sub_skill)
        elif sub_skill == "quadratic_formula":
            return self._formula_question(q_num, sub_skill)
        elif sub_skill == "completing_square":
            return self._completing_square_question(q_num, sub_skill)
        elif sub_skill == "graph_sketching":
            return self._graph_question(q_num, sub_skill)
        else:
            return self._forming_question(q_num, sub_skill)

    def _factorise_question(self, q_num: int, sub_skill: str) -> Question:
        """Factorise x^2 + bx + c where roots are integers."""
        r1 = self._rand_int(-8, 8)
        r2 = self._rand_int(-8, 8)
        # Ensure non-trivial
        while r1 == 0 or r2 == 0 or r1 == r2:
            r2 = self._rand_int(-8, 8)

        # (x - r1)(x - r2) = x^2 - (r1+r2)x + r1*r2
        b = -(r1 + r2)
        c = r1 * r2

        expr = self._format_quadratic(1, b, c)

        # Build factorised answer
        factors = []
        for r in sorted([r1, r2]):
            if r > 0:
                factors.append(f"(x - {r})")
            else:
                factors.append(f"(x + {abs(r)})")
        answer = "".join(factors)

        text = f"Factorise ${expr}$."

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=2,
                    working_lines=3,
                    answer=answer,
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1="Find two numbers that multiply to give c and add to give b",
                        A1=f"${answer}$",
                        common_error="Sign errors when writing factors",
                        allow="Any correct factorisation order",
                    ),
                )
            ],
        )

    def _formula_question(self, q_num: int, sub_skill: str) -> Question:
        """Solve using the quadratic formula — may have non-integer roots."""
        a_coeff = self._rand_int(1, 3)
        b_coeff = self._rand_int(-10, 10)
        c_coeff = self._rand_int(-10, 10)

        while b_coeff == 0 or c_coeff == 0:
            b_coeff = self._rand_int(-10, 10)
            c_coeff = self._rand_int(-10, 10)

        disc = b_coeff * b_coeff - 4 * a_coeff * c_coeff

        expr = self._format_quadratic(a_coeff, b_coeff, c_coeff)

        if disc < 0:
            answer = "No real solutions"
            m1 = f"Calculate the discriminant: {b_coeff}^2 - 4({a_coeff})({c_coeff}) = {disc}"
            a1 = "No real solutions"
            common = "Forgetting to check the discriminant is negative"
        elif disc == 0:
            x = -b_coeff / (2 * a_coeff)
            if x == int(x):
                answer = f"x = {int(x)}"
            else:
                answer = f"x = {b_coeff}/{2 * a_coeff}"
            m1 = f"Apply formula: x = ({-b_coeff} +/- sqrt({disc})) / {2 * a_coeff}"
            a1 = answer
            common = "Arithmetic errors when discriminant is zero"
        else:
            sqrt_disc = math.isqrt(disc)
            if sqrt_disc * sqrt_disc == disc:
                # Perfect square — integer roots
                x1 = (-b_coeff + sqrt_disc) // (2 * a_coeff)
                x2 = (-b_coeff - sqrt_disc) // (2 * a_coeff)
                if 2 * a_coeff * x1 == -b_coeff + sqrt_disc and 2 * a_coeff * x2 == -b_coeff - sqrt_disc:
                    answer = f"x = {x1} or x = {x2}"
                else:
                    answer = f"x = ({-b_coeff} + sqrt({disc})) / {2 * a_coeff} or x = ({-b_coeff} - sqrt({disc})) / {2 * a_coeff}"
            else:
                answer = f"x = ({-b_coeff} + sqrt({disc})) / {2 * a_coeff} or x = ({-b_coeff} - sqrt({disc})) / {2 * a_coeff}"
            m1 = f"Apply formula: x = ({-b_coeff} +/- sqrt({disc})) / {2 * a_coeff}"
            a1 = answer
            common = "Sign errors with -b or when simplifying the fraction"

        text = f"Solve ${expr} = 0$ using the quadratic formula. {'Give your answer in surd form.' if disc > 0 and sqrt_disc * sqrt_disc != disc else 'Give your answers as integers or fractions where appropriate.'}"

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=6,
                    answer=answer,
                    answer_format="extended" if "sqrt" in answer else "numerical",
                    mark_scheme=MarkScheme(
                        M1=m1,
                        A1=a1,
                        common_error=common,
                        allow="Simplified surd form or exact fractions",
                    ),
                )
            ],
        )

    def _completing_square_question(self, q_num: int, sub_skill: str) -> Question:
        """Complete the square on x^2 + bx + c."""
        b = self._rand_int(-10, 10)
        while b == 0:
            b = self._rand_int(-10, 10)
        c = self._rand_int(-10, 10)

        expr = self._format_quadratic(1, b, c)

        half_b = b / 2
        if half_b == int(half_b):
            half_b_str = str(int(half_b))
        else:
            half_b_str = f"\\tfrac{{{b}}}{{2}}"

        const = c - (b / 2) ** 2
        if const == int(const):
            const_str = str(int(const))
        else:
            const_str = f"\\tfrac{{{int(4 * c - b * b)}}}{{4}}"

        answer = f"$(x {self._signed(half_b)})^2 {self._signed(const)}$"

        text = f"Write ${expr}$ in the form $(x + a)^2 + b$."

        return Question(
            id=f"q{q_num}",
            type="challenge",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=5,
                    answer=f"(x {self._signed(half_b)})^2 {self._signed(const)}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Half the coefficient of x: {b}/2 = {half_b}, then square it: {half_b}^2 = {half_b ** 2}",
                        A1=f"$(x {self._signed(half_b)})^2 {self._signed(const)}$",
                        common_error="Sign errors when completing the square, or forgetting to subtract the squared half-coefficient",
                        allow="Equivalent expanded forms",
                    ),
                )
            ],
        )

    def _graph_question(self, q_num: int, sub_skill: str) -> Question:
        """Sketch/interpret a quadratic graph."""
        r1 = self._rand_int(-5, 5)
        r2 = self._rand_int(-5, 5)
        while r1 == r2 or r1 == 0 or r2 == 0:
            r2 = self._rand_int(-5, 5)

        # y = (x - r1)(x - r2)
        b = -(r1 + r2)
        c = r1 * r2

        # Vertex at x = -b/2
        vx = -b / 2
        vy = (vx - r1) * (vx - r2)

        x_min = min(r1, r2) - 2
        x_max = max(r1, r2) + 2
        y_min = min(0, int(vy)) - 2
        y_max = max(0, int(vy)) + 2

        roots_sorted = sorted([r1, r2])
        text = (
            f"The quadratic $y = (x - {roots_sorted[0]})(x - {roots_sorted[1]})$ "
            f"is sketched on the grid. Write down the coordinates of the turning point "
            f"and the values of x where the graph crosses the x-axis."
        )

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    diagram_spec=self.make_coordinate_grid(x_min, x_max, y_min, y_max),
                    working_lines=4,
                    answer=f"Turning point: ({vx}, {vy}); x-intercepts: {r1} and {r2}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1="Identify x-intercepts from factors, find vertex x-coordinate as midpoint or using -b/2a",
                        A1=f"Turning point: ({vx}, {vy}), crosses x-axis at x = {r1} and x = {r2}",
                        common_error="Confusing the vertex coordinates or misidentifying intercepts",
                        allow="Accept equivalent coordinate notation",
                    ),
                )
            ],
        )

    def _forming_question(self, q_num: int, sub_skill: str) -> Question:
        """Form a quadratic equation from a word problem."""
        # Simple area problem: rectangle with sides (x + a) and (x + b), area = target
        a = self._rand_int(1, 4)
        b = self._rand_int(1, 4)
        # (x+a)(x+b) = x^2 + (a+b)x + ab = target
        # Pick x value and compute target
        x_val = self._rand_int(2, 6)
        target = (x_val + a) * (x_val + b)

        text = (
            f"A rectangle has sides of length $({self._x_plus(a)})$ cm and $({self._x_plus(b)})$ cm. "
            f"The area of the rectangle is ${target}$ cm$^2$. "
            f"Form and solve a quadratic equation to find the value of x."
        )

        return Question(
            id=f"q{q_num}",
            type="challenge",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=4,
                    working_lines=6,
                    answer=f"x = {x_val}",
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Form equation: ({self._x_plus(a)})({self._x_plus(b)}) = {target}",
                        A1=f"x = {x_val} (reject negative root)",
                        common_error="Forgetting to reject the negative root or expanding incorrectly",
                        allow="Rejecting x = {negative root} with explanation",
                    ),
                )
            ],
        )

    def _format_quadratic(self, a: int, b: int, c: int) -> str:
        """Format ax^2 + bx + c as LaTeX."""
        parts = []
        if a == 1:
            parts.append("x^2")
        elif a == -1:
            parts.append("-x^2")
        else:
            parts.append(f"{a}x^2")

        if b != 0:
            if b > 0:
                if b == 1:
                    parts.append("+ x")
                else:
                    parts.append(f"+ {b}x")
            else:
                if b == -1:
                    parts.append("- x")
                else:
                    parts.append(f"- {abs(b)}x")

        if c != 0:
            if c > 0:
                parts.append(f"+ {c}")
            else:
                parts.append(f"- {abs(c)}")

        return " ".join(parts)

    def _x_plus(self, n: int) -> str:
        return f"x + {n}" if n > 0 else f"x - {abs(n)}"

    def _signed(self, val) -> str:
        if val > 0:
            return f"+ {val}"
        elif val < 0:
            return f"- {abs(val)}"
        return ""
