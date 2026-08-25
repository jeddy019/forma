"""Simultaneous equations generator.

Sub-skills:
- elimination_method: two equations, eliminate one variable
- substitution_method: one equation substituted into the other
- equations_with_fractions: coefficients or constants are fractions
- equations_with_decimals: coefficients or constants are decimals
- word_problems: real-world context requiring simultaneous setup
- graph_based: solution via coordinate intersection

Generates systems with integer solutions where possible for cleaner
mark schemes. The answer is computed, not guessed.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class SimultaneousGenerator(BaseGenerator):
    generator_key = "simultaneous"
    topic_name = "Simultaneous Equations"
    supported_sub_skills = [
        "elimination_method",
        "substitution_method",
        "equations_with_fractions",
        "equations_with_decimals",
        "word_problems",
        "graph_based",
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
        # Generate integer solution first, then build equations around it
        x = self._rand_int(-6, 6)
        y = self._rand_int(-6, 6)

        if sub_skill == "elimination_method":
            return self._elimination_question(q_num, x, y, sub_skill)
        elif sub_skill == "substitution_method":
            return self._substitution_question(q_num, x, y, sub_skill)
        elif sub_skill == "equations_with_fractions":
            return self._fraction_question(q_num, x, y, sub_skill)
        elif sub_skill == "equations_with_decimals":
            return self._decimal_question(q_num, x, y, sub_skill)
        elif sub_skill == "word_problems":
            return self._word_problem(q_num, x, y, sub_skill)
        else:
            return self._graph_question(q_num, x, y, sub_skill)

    def _elimination_question(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        a1 = self._rand_int(1, 6)
        b1 = self._rand_int(1, 6)
        c1 = a1 * x + b1 * y

        a2 = self._rand_int(1, 6)
        b2 = self._rand_int(1, 6)
        # Ensure system is solvable (not parallel)
        while a1 * b2 == a2 * b1:
            a2 = self._rand_int(1, 6)
            b2 = self._rand_int(1, 6)
        c2 = a2 * x + b2 * y

        eq1 = self._format_eq(a1, b1, c1)
        eq2 = self._format_eq(a2, b2, c2)

        text = f"Solve the simultaneous equations.\n\n$$\\begin{{align*}}{eq1}\\\\{eq2}\\end{{align*}}$$"

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=6,
                    answer=f"x = {x}, y = {y}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Multiply to make coefficients of one variable equal (e.g. multiply equation 1 by {a2} and equation 2 by {a1})",
                        A1=f"x = {x}, y = {y}",
                        common_error="Sign errors when subtracting equations",
                        allow="x and y values in either order",
                    ),
                )
            ],
        )

    def _substitution_question(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        # Second equation is already solved for y: y = mx + c
        m = self._rand_int(-3, 3)
        c = y - m * x

        a1 = self._rand_int(1, 5)
        b1 = self._rand_int(1, 5)
        c1 = a1 * x + b1 * y

        eq1 = self._format_eq(a1, b1, c1)
        eq2_part = f"y = {self._x_term(m)}{self._const_term(c)}"

        text = f"Solve the simultaneous equations.\n\n$$\\begin{{align*}}{eq1}\\\\{eq2_part}\\end{{align*}}$$"

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=6,
                    answer=f"x = {x}, y = {y}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Substitute y = {self._x_term(m)}{self._const_term(c)} into equation 1",
                        A1=f"x = {x}, y = {y}",
                        common_error="Substituting into the wrong equation or algebraic errors expanding",
                        allow="x and y values in either order",
                    ),
                )
            ],
        )

    def _fraction_question(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        """Equations where coefficients are fractions."""
        # Build with integer coefficients then present as fractions
        a1 = self._rand_int(1, 4)
        b1 = self._rand_int(1, 4)
        c1 = a1 * x + b1 * y

        a2 = self._rand_int(1, 4)
        b2 = self._rand_int(1, 4)
        while a1 * b2 == a2 * b1:
            a2 = self._rand_int(1, 4)
            b2 = self._rand_int(1, 4)
        c2 = a2 * x + b2 * y

        # Present as: (a1/2)x + (b1/2)y = c1/2  etc.
        f_a1 = f"{a1}/2"
        f_b1 = f"{b1}/2"
        f_c1 = f"{c1}/2"
        f_a2 = f"{a2}/2"
        f_b2 = f"{b2}/2"
        f_c2 = f"{c2}/2"

        eq1 = f"\\tfrac{{{a1}}}{{2}}x + \\tfrac{{{b1}}}{{2}}y = \\tfrac{{{c1}}}{{2}}"
        eq2 = f"\\tfrac{{{a2}}}{{2}}x + \\tfrac{{{b2}}}{{2}}y = \\tfrac{{{c2}}}{{2}}"

        text = f"Solve the simultaneous equations.\n\n$$\\begin{{align*}}{eq1}\\\\{eq2}\\end{{align*}}$$"

        return Question(
            id=f"q{q_num}",
            type="challenge",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=4,
                    working_lines=8,
                    answer=f"x = {x}, y = {y}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1="Multiply through by 2 to clear fractions, then solve as a standard pair",
                        A1=f"x = {x}, y = {y}",
                        common_error="Errors when clearing fractions or multiplying through",
                        allow="x and y values in either order",
                    ),
                )
            ],
        )

    def _decimal_question(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        """Equations with decimal coefficients."""
        a1 = round(self.rng.uniform(0.5, 3.0), 1)
        b1 = round(self.rng.uniform(0.5, 3.0), 1)
        c1 = round(a1 * x + b1 * y, 1)

        a2 = round(self.rng.uniform(0.5, 3.0), 1)
        b2 = round(self.rng.uniform(0.5, 3.0), 1)
        while abs(a1 * b2 - a2 * b1) < 0.01:
            a2 = round(self.rng.uniform(0.5, 3.0), 1)
            b2 = round(self.rng.uniform(0.5, 3.0), 1)
        c2 = round(a2 * x + b2 * y, 1)

        eq1 = f"{a1}x + {b1}y = {c1}"
        eq2 = f"{a2}x + {b2}y = {c2}"

        text = f"Solve the simultaneous equations. Give your answers to 1 decimal place.\n\n$$\\begin{{align*}}{eq1}\\\\{eq2}\\end{{align*}}$$"

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=6,
                    answer=f"x = {x}, y = {y}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1="Multiply equations to eliminate one variable (watch decimal places)",
                        A1=f"x = {x}, y = {y}",
                        common_error="Rounding errors during intermediate steps",
                        allow="x and y values in either order",
                    ),
                )
            ],
        )

    def _word_problem(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        """Real-world context requiring simultaneous setup."""
        # Make values positive for a sensible word problem
        x = abs(x) + 1
        y = abs(y) + 1

        a1 = self._rand_int(2, 6)
        b1 = self._rand_int(2, 6)
        c1 = a1 * x + b1 * y

        a2 = self._rand_int(2, 6)
        b2 = self._rand_int(2, 6)
        while a1 * b2 == a2 * b1:
            a2 = self._rand_int(2, 6)
            b2 = self._rand_int(2, 6)
        c2 = a2 * x + b2 * y

        text = (
            f"A shop sells pencils for {a1}p each and pens for {b1}p each. "
            f"Amira buys {x} pencils and {y} pens for {c1}p in total. "
            f"Ben buys {a2 // a1 if a2 % a1 == 0 else a2} pencils and pens "
            f"for {c2}p. "
            f"Write down a pair of simultaneous equations and solve them to find "
            f"the cost of one pencil and one pen."
        )

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=4,
                    working_lines=8,
                    answer=f"x = {x}, y = {y}",
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Form equations: {a1}x + {b1}y = {c1} and {a2}x + {b2}y = {c2}",
                        A1=f"Pencil = {x}p, Pen = {y}p (or x = {x}, y = {y})",
                        common_error="Setting up equations incorrectly from the word context",
                        allow="Accept pence or pounds notation",
                    ),
                )
            ],
        )

    def _graph_question(self, q_num: int, x: int, y: int, sub_skill: str) -> Question:
        """Solution as intersection of two lines."""
        m1 = self._rand_int(-3, 3)
        c1 = y - m1 * x
        m2 = self._rand_int(-3, 3)
        c2 = y - m2 * x
        while m1 == m2:
            m2 = self._rand_int(-3, 3)

        x_min, x_max = min(x - 3, -2), max(x + 3, 2)
        y_min, y_max = min(y - 3, -2), max(y + 3, 2)

        line1 = {"from": {"x": x_min, "y": m1 * x_min + c1}, "to": {"x": x_max, "y": m1 * x_max + c1}, "style": "primary"}
        line2 = {"from": {"x": x_min, "y": m2 * x_min + c2}, "to": {"x": x_max, "y": m2 * x_max + c2}, "style": "secondary"}
        point = {"x": x, "y": y, "label": f"({x}, {y})"}

        diagram = self.make_coordinate_grid(x_min, x_max, y_min, y_max, points=[point], lines=[line1, line2])

        text = (
            f"The diagram shows the lines $y = {self._x_term(m1)}{self._const_term(c1)}$ "
            f"and $y = {self._x_term(m2)}{self._const_term(c2)}$ plotted on the same axes. "
            f"Write down the coordinates of the point where the two lines intersect."
        )

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=2,
                    diagram_spec=diagram,
                    working_lines=2,
                    answer=f"({x}, {y})",
                    answer_format="coordinates",
                    mark_scheme=MarkScheme(
                        M1="Identify the intersection point from the graph or by solving simultaneously",
                        A1=f"({x}, {y})",
                        common_error="Reading the wrong point or swapping x and y",
                        allow="(x, y) with x and y values correct in either position",
                    ),
                )
            ],
        )

    def _format_eq(self, a: int, b: int, c: int) -> str:
        """Format ax + by = c as LaTeX."""
        parts = []
        if a == 1:
            parts.append("x")
        elif a == -1:
            parts.append("-x")
        else:
            parts.append(f"{a}x")

        if b >= 0:
            if b == 1:
                parts.append("+ y")
            else:
                parts.append(f"+ {b}y")
        else:
            if b == -1:
                parts.append("- y")
            else:
                parts.append(f"- {abs(b)}y")

        return f"{' '.join(parts)} &= {c}"

    def _x_term(self, m: int) -> str:
        if m == 0:
            return ""
        if m == 1:
            return "x"
        if m == -1:
            return "-x"
        return f"{m}x"

    def _const_term(self, c: int) -> str:
        if c == 0:
            return ""
        if c > 0:
            return f" + {c}"
        return f" - {abs(c)}"
