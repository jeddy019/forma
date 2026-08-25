"""Circle theorems generator.

Sub-skills:
- angle_at_centre: angle at centre is twice the angle at circumference
- cyclic_quadrilateral: opposite angles sum to 180
- angle_in_semicircle: angle in a semicircle is 90 degrees
- tangent_radius: tangent is perpendicular to radius at point of contact
- alternate_segment: angle between tangent and chord equals angle in alternate segment

Each answer is verified by the relevant theorem.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class CircleTheoremsGenerator(BaseGenerator):
    generator_key = "circle_theorems"
    topic_name = "Circle Theorems"
    supported_sub_skills = [
        "angle_at_centre",
        "cyclic_quadrilateral",
        "angle_in_semicircle",
        "tangent_radius",
        "alternate_segment",
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
        if sub_skill == "angle_at_centre":
            return self._angle_centre_question(q_num, sub_skill)
        elif sub_skill == "cyclic_quadrilateral":
            return self._cyclic_question(q_num, sub_skill)
        elif sub_skill == "angle_in_semicircle":
            return self._semicircle_question(q_num, sub_skill)
        elif sub_skill == "tangent_radius":
            return self._tangent_question(q_num, sub_skill)
        else:
            return self._alternate_question(q_num, sub_skill)

    def _angle_centre_question(self, q_num: int, sub_skill: str) -> Question:
        """Angle at centre is twice the angle at circumference."""
        # Give the angle at circumference, find the angle at centre
        angle_circ = self._rand_choice([25, 30, 35, 40, 45, 50, 55, 60, 65, 70])
        angle_centre = angle_circ * 2

        text = (
            f"O is the centre of the circle. The angle at the circumference is "
            f"${angle_circ}^{{\\circ}}$. Find the angle at the centre."
        )
        answer = f"${angle_centre}^{{\\circ}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Angle at centre = 2 x angle at circumference",
                A1=answer,
                common_error="Dividing by 2 instead of multiplying",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _cyclic_question(self, q_num: int, sub_skill: str) -> Question:
        """Opposite angles in a cyclic quadrilateral sum to 180."""
        angle_a = self._rand_choice([65, 70, 75, 80, 85, 95, 100, 105, 110, 115])
        angle_c = 180 - angle_a

        text = (
            f"ABCD is a cyclic quadrilateral. Angle A = ${angle_a}^{{\\circ}}$. "
            f"Find angle C."
        )
        answer = f"${angle_c}^{{\\circ}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Opposite angles in a cyclic quadrilateral sum to 180",
                A1=f"180 - {angle_a} = {angle_c}",
                common_error="Assuming angles are equal instead of supplementary",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _semicircle_question(self, q_num: int, sub_skill: str) -> Question:
        """Angle in a semicircle is 90 degrees."""
        text = (
            "AB is a diameter of the circle with centre O. C is a point on the "
            "circumference. State the size of angle ACB."
        )
        answer = "$90^{\\circ}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Angle in a semicircle is always 90",
                A1=answer,
                common_error="Confusing with angle at centre theorem",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _tangent_question(self, q_num: int, sub_skill: str) -> Question:
        """Tangent perpendicular to radius at point of contact."""
        # Given the angle between tangent and a chord, find the angle in the alternate segment
        angle_tangent_chord = self._rand_choice([30, 35, 40, 45, 50, 55, 60])

        text = (
            f"TA is a tangent to the circle at point A. AB is a chord. "
            f"Angle TAB = ${angle_tangent_chord}^{{\\circ}}$. "
            f"The radius OA meets the tangent at A. Find angle OAB."
        )
        answer = f"${90 - angle_tangent_chord}^{{\\circ}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Tangent is perpendicular to radius: angle OAT = 90",
                A1=f"Angle OAB = 90 - {angle_tangent_chord} = {90 - angle_tangent_chord}",
                common_error="Not recognising the tangent-radius property",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _alternate_question(self, q_num: int, sub_skill: str) -> Question:
        """Angle between tangent and chord equals angle in alternate segment."""
        angle_tangent_chord = self._rand_choice([30, 35, 40, 45, 50, 55, 60])

        text = (
            f"TA is a tangent at A. AB is a chord. Angle TAB = ${angle_tangent_chord}^{{\\circ}}$. "
            f"C is a point on the circumference in the alternate segment. "
            f"Find angle ACB."
        )
        answer = f"${angle_tangent_chord}^{{\\circ}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Alternate segment theorem: angle between tangent and chord = angle in alternate segment",
                A1=answer,
                common_error="Using a different theorem instead",
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
