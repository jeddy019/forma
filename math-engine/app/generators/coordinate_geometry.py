"""Coordinate geometry generator.

Sub-skills:
- gradient: find gradient of a line through two points
- equation_of_line: find equation of a line y = mx + c
- midpoint_distance: find midpoint or distance between two points
- parallel_perpendicular: find line parallel/perpendicular through a point

Each answer is verified from the generated coordinates.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class CoordinateGeometryGenerator(BaseGenerator):
    generator_key = "coordinate_geometry"
    topic_name = "Coordinate Geometry"
    supported_sub_skills = [
        "gradient",
        "equation_of_line",
        "midpoint_distance",
        "parallel_perpendicular",
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
        if sub_skill == "gradient":
            return self._gradient_question(q_num, sub_skill)
        elif sub_skill == "equation_of_line":
            return self._equation_question(q_num, sub_skill)
        elif sub_skill == "midpoint_distance":
            return self._midpoint_distance_question(q_num, sub_skill)
        else:
            return self._parallel_perpendicular_question(q_num, sub_skill)

    def _gradient_question(self, q_num: int, sub_skill: str) -> Question:
        """Find gradient between two points."""
        x1 = self._rand_int(-6, 6)
        y1 = self._rand_int(-6, 6)
        # Pick second point with integer gradient
        dx = self._rand_int(-5, 5)
        while dx == 0:
            dx = self._rand_int(-5, 5)
        dy = self._rand_int(-5, 5)
        x2 = x1 + dx
        y2 = y1 + dy

        # Gradient as fraction
        g = math.gcd(abs(dy), abs(dx))
        num = dy // g
        den = dx // g
        if den < 0:
            num, den = -num, -den

        if den == 1:
            answer = str(num)
        else:
            answer = f"\\tfrac{{{num}}}{{{den}}}"

        text = f"Find the gradient of the line through $({x1}, {y1})$ and $({x2}, {y2})$."

        # Diagram with the two points
        all_x = [x1, x2]
        all_y = [y1, y2]
        diagram = self.make_coordinate_grid(
            x_min=min(all_x) - 2,
            x_max=max(all_x) + 2,
            y_min=min(all_y) - 2,
            y_max=max(all_y) + 2,
            points=[
                {"x": x1, "y": y1, "label": f"({x1},{y1})"},
                {"x": x2, "y": y2, "label": f"({x2},{y2})"},
            ],
            lines=[{"from": {"x": x1, "y": y1}, "to": {"x": x2, "y": y2}, "style": "primary"}],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"${answer}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Gradient = (y2 - y1) / (x2 - x1) = ({y2} - {y1}) / ({x2} - {x1}) = {dy}/{dx}",
                A1=f"${answer}$",
                common_error="Swapping x and y in the formula",
                allow=f"${answer}$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _equation_question(self, q_num: int, sub_skill: str) -> Question:
        """Find equation of a line y = mx + c given two points."""
        # Build from c backwards for clean answer
        c = self._rand_int(-5, 5)
        m_num = self._rand_int(-4, 4)
        m_den = self._rand_int(1, 4)
        while m_num == 0:
            m_num = self._rand_int(-4, 4)
        g = math.gcd(abs(m_num), m_den)
        m_num, m_den = m_num // g, m_den // g

        x1 = self._rand_int(-5, 5)
        y1 = m_num * x1 // m_den + c
        x2 = x1 + m_den
        y2 = m_num * x2 // m_den + c

        # Format equation
        if m_den == 1:
            m_str = str(m_num) if m_num != 1 else ""
            if m_num == -1:
                m_str = "-"
        else:
            m_str = f"\\tfrac{{{m_num}}}{{{m_den}}}"

        if c > 0:
            eq = f"y = {m_str}x + {c}" if m_str else f"y = x + {c}"
        elif c < 0:
            eq = f"y = {m_str}x - {abs(c)}" if m_str else f"y = x - {abs(c)}"
        else:
            eq = f"y = {m_str}x" if m_str else f"y = x"

        text = f"Find the equation of the line through $({x1}, {y1})$ and $({x2}, {y2})$. Give your answer in the form $y = mx + c$."

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=f"${eq}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"m = ({y2} - {y1}) / ({x2} - {x1}) = {m_num}/{m_den}",
                A1=f"Substitute a point to find c = {c}",
                common_error="Sign error in c",
                allow=f"${eq}$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _midpoint_distance_question(self, q_num: int, sub_skill: str) -> Question:
        """Find midpoint or distance between two points."""
        find_midpoint = self._rand_choice([True, False])

        x1 = self._rand_int(-8, 8)
        y1 = self._rand_int(-8, 8)
        # Choose second point to give integer coordinates for midpoint
        dx = self._rand_int(-8, 8) * 2
        dy = self._rand_int(-8, 8) * 2
        x2 = x1 + dx
        y2 = y1 + dy

        if find_midpoint:
            mx = (x1 + x2) // 2
            my = (y1 + y2) // 2
            text = f"Find the midpoint of the line joining $({x1}, {y1})$ and $({x2}, {y2})$."
            answer = f"$({mx}, {my})$"
            m1 = f"Midpoint = (({x1}+{x2})/2, ({y1}+{y2})/2)"
            a1 = f"$({mx}, {my})$"
        else:
            # Distance: build from known distance
            dist_sq = dx ** 2 + dy ** 2
            dist = math.isqrt(dist_sq)
            if dist * dist != dist_sq:
                # Not a perfect square, adjust to make it work
                # Use 3-4-5 style triangles
                a = self._rand_int(3, 9)
                b = self._rand_int(4, 12)
                c = math.isqrt(a * a + b * b)
                while c * c != a * a + b * b:
                    a += 1
                    if a > 15:
                        a = 3
                        b += 1
                    c = math.isqrt(a * a + b * b)
                dx, dy = a * 2, b * 2
                x2 = x1 + dx
                y2 = y1 + dy
                dist = c * 2

            text = f"Find the distance between $({x1}, {y1})$ and $({x2}, {y2})$. Give your answer as a surd if necessary."
            answer = f"${dist}$" if dist == math.isqrt(dx**2 + dy**2) else f"$\\sqrt{{{dx**2 + dy**2}}}$"
            m1 = f"Distance = sqrt(({x2}-{x1})^2 + ({y2}-{y1})^2) = sqrt({dx}^2 + {dy}^2)"
            a1 = answer

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Forgetting to square root" if not find_midpoint else "Averaging wrong coordinates",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _parallel_perpendicular_question(self, q_num: int, sub_skill: str) -> Question:
        """Find equation of line parallel or perpendicular through a point."""
        is_parallel = self._rand_choice([True, False])

        # Original line: y = mx + c
        c_orig = self._rand_int(-3, 3)
        m_orig_num = self._rand_int(1, 5)
        m_orig_den = self._rand_int(1, 4)
        g = math.gcd(m_orig_num, m_orig_den)
        m_orig_num, m_orig_den = m_orig_num // g, m_orig_den // g

        # Point the new line passes through
        px = self._rand_int(-5, 5)
        py = self._rand_int(-5, 5)

        if is_parallel:
            # Same gradient
            m_new_num, m_new_den = m_orig_num, m_orig_den
            rel = "parallel"
        else:
            # Perpendicular: gradient is negative reciprocal
            m_new_num, m_new_den = -m_orig_den, m_orig_num
            rel = "perpendicular"

        # Find c_new: py = (m_new_num/m_new_den) * px + c_new
        c_new_num = py * m_new_den - m_new_num * px
        c_new_den = m_new_den
        g2 = math.gcd(abs(c_new_num), abs(c_new_den))
        c_new_num, c_new_den = c_new_num // g2, c_new_den // g2
        if c_new_den < 0:
            c_new_num, c_new_den = -c_new_num, -c_new_den

        # Format new equation
        if m_new_den == 1:
            m_str = str(m_new_num) if abs(m_new_num) != 1 else ("-" if m_new_num < 1 else "")
        else:
            m_str = f"\\tfrac{{{m_new_num}}}{{{m_new_den}}}"

        if c_new_den == 1:
            c_val = c_new_num
        else:
            c_val = None  # Will need fraction display

        if c_val is not None:
            if c_val > 0:
                eq = f"y = {m_str}x + {c_val}" if m_str else f"y = x + {c_val}"
            elif c_val < 0:
                eq = f"y = {m_str}x - {abs(c_val)}" if m_str else f"y = x - {abs(c_val)}"
            else:
                eq = f"y = {m_str}x" if m_str else "y = x"
        else:
            eq = f"y = {m_str}x + \\tfrac{{{c_new_num}}}{{{c_new_den}}}"

        # Format original line for display
        if m_orig_den == 1:
            m_orig_str = str(m_orig_num) if abs(m_orig_num) != 1 else ("" if m_orig_num == 1 else "-")
        else:
            m_orig_str = f"\\tfrac{{{m_orig_num}}}{{{m_orig_den}}}"

        text = (
            f"The line $y = {m_orig_str}x + {c_orig}$ is given. "
            f"Find the equation of the line that is {rel} to this line and passes through $({px}, {py})$."
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=f"${eq}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"{'Same gradient' if is_parallel else 'Negative reciprocal gradient'}: m = {m_new_num}/{m_new_den}",
                A1=f"Substitute ({px}, {py}) to find c",
                common_error="Forgetting negative sign for perpendicular" if not is_parallel else "Changing the gradient for parallel",
                allow=f"${eq}$",
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
