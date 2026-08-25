"""Bounds and accuracy generator.

Sub-skills:
- upper_lower_bounds: find the upper/lower bound of a rounded number
- error_interval: state the error interval for a measurement
- bounds_calculation: use bounds in calculations (area, speed, etc.)

Each answer is verified from the generated values.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class BoundsGenerator(BaseGenerator):
    generator_key = "bounds"
    topic_name = "Bounds"
    supported_sub_skills = [
        "upper_lower_bounds",
        "error_interval",
        "bounds_calculation",
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
        if sub_skill == "upper_lower_bounds":
            return self._bounds_question(q_num, sub_skill)
        elif sub_skill == "error_interval":
            return self._error_interval_question(q_num, sub_skill)
        else:
            return self._bounds_calc_question(q_num, sub_skill)

    def _bounds_question(self, q_num: int, sub_skill: str) -> Question:
        """Find upper/lower bound of a rounded number."""
        rounding = self._rand_choice(["nearest whole", "nearest 10", "nearest 100", "1 d.p."])

        if rounding == "nearest whole":
            value = self._rand_int(5, 99)
            unit = self._rand_choice(["cm", "kg", "m", "s"])
            half = 0.5
            lb = value - half
            ub = value + half
            text = f"A length is measured as ${value}\\,\\text{{{unit}}}$ to the nearest whole number. State the upper bound."
            answer = f"${ub}\\,\\text{{{unit}}}$"
            m1 = f"Degree of accuracy: ±{half}"
            a1 = answer
        elif rounding == "nearest 10":
            value = self._rand_int(1, 10) * 10
            unit = self._rand_choice(["cm", "kg", "m"])
            half = 5
            lb = value - half
            ub = value + half
            text = f"A mass is measured as ${value}\\,\\text{{{unit}}}$ to the nearest 10. State the lower bound."
            answer = f"${lb}\\,\\text{{{unit}}}$"
            m1 = f"Degree of accuracy: ±{half}"
            a1 = answer
        elif rounding == "nearest 100":
            value = self._rand_int(1, 10) * 100
            unit = self._rand_choice(["m", "km"])
            half = 50
            lb = value - half
            ub = value + half
            text = f"A distance is measured as ${value}\\,\\text{{{unit}}}$ to the nearest 100. State the error interval."
            answer = f"${lb} \\leq d < {ub}$"
            m1 = f"Degree of accuracy: ±{half}"
            a1 = answer
        else:  # 1 d.p.
            value = self._rand_int(10, 99) / 10
            unit = self._rand_choice(["cm", "kg", "m", "s"])
            half = 0.05
            lb = value - half
            ub = value + half
            text = f"A time is recorded as ${value}\\,\\text{{{unit}}}$ to 1 decimal place. State the upper bound."
            answer = f"${ub}\\,\\text{{{unit}}}$"
            m1 = f"Degree of accuracy: ±{half}"
            a1 = answer

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Using the wrong degree of accuracy",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _error_interval_question(self, q_num: int, sub_skill: str) -> Question:
        """State the error interval for a measurement."""
        value = self._rand_int(10, 99)
        half = 0.5
        lb = value - half
        ub = value + half

        text = f"A number $x$ is rounded to the nearest whole number and the result is ${value}$. Write down the error interval for $x$."
        answer = f"${lb} \\leq x < {ub}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Degree of accuracy: ±{half}",
                A1=answer,
                common_error="Using < instead of ≤ on the lower bound",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _bounds_calc_question(self, q_num: int, sub_skill: str) -> Question:
        """Use bounds in a calculation (e.g. upper bound of area)."""
        # Rectangle: length and width rounded to nearest whole
        length = self._rand_int(5, 15)
        width = self._rand_int(3, 10)

        length_ub = length + 0.5
        width_ub = width + 0.5
        upper_area = length_ub * width_ub

        # Clean answer
        if upper_area == int(upper_area):
            upper_area = int(upper_area)

        text = (
            f"A rectangle has length ${length}\\,\\text{{cm}}$ and width ${width}\\,\\text{{cm}}$, "
            f"both measured to the nearest whole number. "
            f"Calculate the upper bound of the area of the rectangle."
        )
        answer = f"${upper_area}\\,\\text{{cm}}^2$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Length UB = {length_ub}, Width UB = {width_ub}",
                A1=f"Area UB = {length_ub} x {width_ub} = {upper_area}",
                common_error="Using the measured values instead of the upper bounds",
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
