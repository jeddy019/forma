"""Linear equations generator.

Sub-skills:
- one_step: ax = b → x = b/a
- two_step: ax + b = c → x = (c-b)/a
- multi_step: a(x + b) = c
- variable_both_sides: ax + b = cx + d
- forming_equations: word problem → set up and solve

Each question has a verified answer computed from generated values.
Answers are always rational (fractions where needed).
"""

from fractions import Fraction

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class LinearEquationsGenerator(BaseGenerator):
    generator_key = "linear_equations"
    topic_name = "Linear Equations"
    supported_sub_skills = [
        "one_step",
        "two_step",
        "multi_step",
        "variable_both_sides",
        "forming_equations",
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
        if sub_skill == "one_step":
            return self._one_step(q_num, sub_skill)
        elif sub_skill == "two_step":
            return self._two_step(q_num, sub_skill)
        elif sub_skill == "multi_step":
            return self._multi_step(q_num, sub_skill)
        elif sub_skill == "variable_both_sides":
            return self._both_sides(q_num, sub_skill)
        else:
            return self._forming(q_num, sub_skill)

    def _one_step(self, q_num: int, sub_skill: str) -> Question:
        """Solve ax = b for x."""
        # Build from answer backwards to ensure nice numbers
        x_val = self._difficulty_range(
            self._rand_int(1, 10), self._rand_int(2, 20), self._rand_int(5, 50)
        )
        a = self._rand_int(2, 12)
        b = a * x_val

        text = f"Solve ${a}x = {b}$."
        answer = str(x_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Divide both sides by {a}",
                A1=f"x = {answer}",
                common_error="Division error",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _two_step(self, q_num: int, sub_skill: str) -> Question:
        """Solve ax + b = c for x."""
        x_val = self._difficulty_range(
            self._rand_int(1, 10), self._rand_int(2, 20), self._rand_int(5, 50)
        )
        a = self._rand_int(2, 12)
        b = self._rand_int(1, 30)
        c = a * x_val + b

        text = f"Solve ${a}x + {b} = {c}$."
        answer = str(x_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Subtract {b} from both sides: {a}x = {c - b}",
                A1=f"Divide by {a}: x = {answer}",
                common_error="Sign error when subtracting",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _multi_step(self, q_num: int, sub_skill: str) -> Question:
        """Solve a(x + b) = c for x."""
        x_val = self._difficulty_range(
            self._rand_int(1, 10), self._rand_int(2, 15), self._rand_int(5, 30)
        )
        a = self._rand_int(2, 8)
        b = self._rand_int(1, 15)
        c = a * (x_val + b)

        text = f"Solve ${a}(x + {b}) = {c}$."
        answer = str(x_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Divide by {a}: x + {b} = {c // a}",
                A1=f"Subtract {b}: x = {answer}",
                common_error="Forgetting to divide all terms by a",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _both_sides(self, q_num: int, sub_skill: str) -> Question:
        """Solve ax + b = cx + d for x."""
        # Build from answer backwards
        x_val = self._difficulty_range(
            self._rand_int(1, 10), self._rand_int(2, 15), self._rand_int(5, 30)
        )
        a = self._rand_int(2, 10)
        c = self._rand_int(1, a - 1)  # c < a so (a-c) > 0
        b = self._rand_int(1, 20)
        d = (a - c) * x_val + b

        text = f"Solve ${a}x + {b} = {c}x + {d}$."
        answer = str(x_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Collect x terms: {a}x - {c}x = {d} - {b}",
                A1=f"Simplify: {a - c}x = {d - b}, so x = {answer}",
                common_error="Sign error when moving terms across =",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _forming(self, q_num: int, sub_skill: str) -> Question:
        """Word problem that requires forming and solving a linear equation."""
        x_val = self._rand_int(3, 20)
        multiplier = self._rand_int(2, 5)
        offset = self._rand_int(1, 15)
        result = multiplier * x_val + offset

        templates = [
            (
                f"I think of a number. I multiply it by ${multiplier}$ and add ${offset}$. The result is ${result}$. What was my number?",
                f"Set up: {multiplier}x + {offset} = {result}",
                f"Solve: x = {x_val}",
            ),
            (
                f"A rectangle has length ${multiplier}x + {offset}$ cm and perimeter ${2 * (multiplier * x_val + offset + x_val)}$ cm. Find $x$.",
                f"Perimeter = 2(length + width): 2({multiplier}x + {offset} + x) = {2 * (multiplier * x_val + offset + x_val)}",
                f"Simplify and solve: x = {x_val}",
            ),
        ]

        template = self._rand_choice(templates)
        text = template[0]
        m1 = template[1]
        a1 = template[2]
        answer = str(x_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=5,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Setting up the equation incorrectly",
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
