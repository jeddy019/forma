"""Transformations generator.

Sub-skills:
- reflection: reflect a point or shape across an axis or line
- rotation: rotate a point about the origin (90, 180, 270 degrees)
- translation: translate a point by a vector
- enlargement: enlarge a shape by a scale factor from a centre

Each answer is verified from the generated transformation.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class TransformationsGenerator(BaseGenerator):
    generator_key = "transformations"
    topic_name = "Transformations"
    supported_sub_skills = [
        "reflection",
        "rotation",
        "translation",
        "enlargement",
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
        if sub_skill == "reflection":
            return self._reflection_question(q_num, sub_skill)
        elif sub_skill == "rotation":
            return self._rotation_question(q_num, sub_skill)
        elif sub_skill == "translation":
            return self._translation_question(q_num, sub_skill)
        else:
            return self._enlargement_question(q_num, sub_skill)

    def _reflection_question(self, q_num: int, sub_skill: str) -> Question:
        """Reflect a point across an axis or y=x."""
        x = self._rand_int(-6, 6)
        y = self._rand_int(-6, 6)
        line = self._rand_choice(["x-axis", "y-axis", "y = x"])

        if line == "x-axis":
            rx, ry = x, -y
        elif line == "y-axis":
            rx, ry = -x, y
        else:  # y = x
            rx, ry = y, x

        text = f"Point $A({x}, {y})$ is reflected in the {line}. Find the coordinates of the image $A'$."

        diagram = self.make_coordinate_grid(
            x_min=min(x, rx) - 2, x_max=max(x, rx) + 2,
            y_min=min(y, ry) - 2, y_max=max(y, ry) + 2,
            points=[
                {"x": x, "y": y, "label": f"A({x},{y})"},
                {"x": rx, "y": ry, "label": f"A'({rx},{ry})"},
            ],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"$A'({rx}, {ry})$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Reflection in {line}",
                A1=f"$A'({rx}, {ry})$",
                common_error="Reflecting in wrong axis or forgetting to change sign",
                allow=f"$A'({rx}, {ry})$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _rotation_question(self, q_num: int, sub_skill: str) -> Question:
        """Rotate a point about the origin."""
        x = self._rand_int(-6, 6)
        y = self._rand_int(-6, 6)
        angle = self._rand_choice([90, 180, 270])
        direction = self._rand_choice(["clockwise", "anticlockwise"])

        if (angle == 90 and direction == "clockwise") or (angle == 270 and direction == "anticlockwise"):
            rx, ry = y, -x
        elif (angle == 270 and direction == "clockwise") or (angle == 90 and direction == "anticlockwise"):
            rx, ry = -y, x
        else:  # 180
            rx, ry = -x, -y

        text = f"Point $B({x}, {y})$ is rotated ${angle}^{{\\circ}}$ {direction} about the origin. Find the coordinates of $B'$."

        diagram = self.make_coordinate_grid(
            x_min=min(x, rx) - 2, x_max=max(x, rx) + 2,
            y_min=min(y, ry) - 2, y_max=max(y, ry) + 2,
            points=[
                {"x": x, "y": y, "label": f"B({x},{y})"},
                {"x": rx, "y": ry, "label": f"B'({rx},{ry})"},
            ],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=diagram,
            working_lines=4,
            answer=f"$B'({rx}, {ry})$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Rotate {angle}° {direction}: (x, y) -> ({rx}, {ry})",
                A1=f"$B'({rx}, {ry})$",
                common_error="Wrong direction or mixing up coordinates",
                allow=f"$B'({rx}, {ry})$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _translation_question(self, q_num: int, sub_skill: str) -> Question:
        """Translate a point by a vector."""
        x = self._rand_int(-5, 5)
        y = self._rand_int(-5, 5)
        dx = self._rand_int(-6, 6)
        dy = self._rand_int(-6, 6)
        while dx == 0 and dy == 0:
            dx = self._rand_int(-6, 6)

        rx, ry = x + dx, y + dy

        text = f"Point $C({x}, {y})$ is translated by the vector $\\begin{{pmatrix}} {dx} \\\\ {dy} \\end{{pmatrix}}$. Find the coordinates of $C'$."

        diagram = self.make_coordinate_grid(
            x_min=min(x, rx) - 2, x_max=max(x, rx) + 2,
            y_min=min(y, ry) - 2, y_max=max(y, ry) + 2,
            points=[
                {"x": x, "y": y, "label": f"C({x},{y})"},
                {"x": rx, "y": ry, "label": f"C'({rx},{ry})"},
            ],
            lines=[{"from": {"x": x, "y": y}, "to": {"x": rx, "y": ry}, "style": "secondary"}],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"$C'({rx}, {ry})$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Add vector: ({x}+{dx}, {y}+{dy})",
                A1=f"$C'({rx}, {ry})$",
                common_error="Subtracting instead of adding the vector",
                allow=f"$C'({rx}, {ry})$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _enlargement_question(self, q_num: int, sub_skill: str) -> Question:
        """Enlarge a point from the origin by a scale factor."""
        x = self._rand_int(-4, 4)
        y = self._rand_int(-4, 4)
        while x == 0 and y == 0:
            x = self._rand_int(-4, 4)
        sf = self._rand_choice([-3, -2, -1, 2, 3, 4])

        rx, ry = int(sf * x), int(sf * y)

        text = f"Point $D({x}, {y})$ is enlarged by scale factor ${sf}$ from the origin. Find the coordinates of $D'$."

        all_x = [x, rx]
        all_y = [y, ry]
        diagram = self.make_coordinate_grid(
            x_min=min(all_x) - 2, x_max=max(all_x) + 2,
            y_min=min(all_y) - 2, y_max=max(all_y) + 2,
            points=[
                {"x": x, "y": y, "label": f"D({x},{y})"},
                {"x": rx, "y": ry, "label": f"D'({rx},{ry})"},
            ],
            lines=[{"from": {"x": 0, "y": 0}, "to": {"x": rx, "y": ry}, "style": "primary"}],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"$D'({rx}, {ry})$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Multiply each coordinate by {sf}",
                A1=f"$D'({rx}, {ry})$",
                common_error="Forgetting negative scale factor reverses direction",
                allow=f"$D'({rx}, {ry})$",
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
