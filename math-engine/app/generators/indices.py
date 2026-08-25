"""Indices (exponents) generator.

Sub-skills:
- laws: apply laws of indices (a^m x a^n = a^(m+n), etc.)
- negative_indices: simplify with negative indices (a^(-n) = 1/a^n)
- fractional_indices: simplify with fractional indices (a^(1/n) = root)
- mixed_expressions: combine multiple index laws

Each answer is verified from the generated values.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class IndicesGenerator(BaseGenerator):
    generator_key = "indices"
    topic_name = "Indices"
    supported_sub_skills = [
        "laws",
        "negative_indices",
        "fractional_indices",
        "mixed_expressions",
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
        if sub_skill == "laws":
            return self._laws_question(q_num, sub_skill)
        elif sub_skill == "negative_indices":
            return self._negative_question(q_num, sub_skill)
        elif sub_skill == "fractional_indices":
            return self._fractional_question(q_num, sub_skill)
        else:
            return self._mixed_question(q_num, sub_skill)

    def _laws_question(self, q_num: int, sub_skill: str) -> Question:
        """Apply a single index law: multiply, divide, or power of power."""
        base = self._rand_int(2, 8)
        law = self._rand_choice(["multiply", "divide", "power"])

        if law == "multiply":
            m = self._rand_int(2, 6)
            n = self._rand_int(2, 6)
            text = f"Simplify ${base}^{{{m}}} \\times {base}^{{{n}}}$."
            answer = f"${base}^{{{m + n}}}$"
            numeric = str(base ** (m + n))
            m1 = f"Add exponents: {m} + {n} = {m + n}"
            a1 = f"${base}^{{{m + n}}}$"
        elif law == "divide":
            m = self._rand_int(3, 8)
            n = self._rand_int(1, m - 1)
            text = f"Simplify $\\dfrac{{{base}^{{{m}}}}}{{{base}^{{{n}}}}}$."
            answer = f"${base}^{{{m - n}}}$"
            m1 = f"Subtract exponents: {m} - {n} = {m - n}"
            a1 = f"${base}^{{{m - n}}}$"
        else:
            a = self._rand_int(2, 6)
            m = self._rand_int(2, 4)
            n = self._rand_int(2, 4)
            text = f"Simplify $({base}^{{{a}}})^{{{n}}}$."
            answer = f"${base}^{{{a * n}}}$"
            m1 = f"Multiply exponents: {a} x {n} = {a * n}"
            a1 = f"${base}^{{{a * n}}}$"

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
                common_error="Wrong index law applied",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _negative_question(self, q_num: int, sub_skill: str) -> Question:
        """Simplify expressions with negative indices."""
        base = self._rand_int(2, 8)
        n = self._rand_int(1, 4)

        form = self._rand_choice(["single", "fraction"])

        if form == "single":
            text = f"Simplify ${base}^{{-{n}}}$."
            answer = f"$\\dfrac{{1}}{{{base}^{{{n}}}}}$"
            m1 = f"a^(-n) = 1/a^n"
            a1 = f"$\\dfrac{{1}}{{{base}^{{{n}}}}}$"
        else:
            num = self._rand_int(2, 6)
            text = f"Simplify $\\dfrac{{{num}}}{{{base}^{{{n}}}}}$."
            answer = f"${num} \\times {base}^{{-{n}}}$"
            m1 = f"Rewrite denominator with negative index"
            a1 = f"${num}{base}^{{-{n}}}$"

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
                common_error="Treating negative index as making the number negative",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _fractional_question(self, q_num: int, sub_skill: str) -> Question:
        """Simplify expressions with fractional indices."""
        # Use perfect powers so answers are nice integers
        bases_powers = [
            (4, 2), (9, 2), (16, 2), (25, 2), (36, 2),
            (8, 3), (27, 3), (64, 3),
            (16, 4), (81, 4),
        ]
        base, power = self._rand_choice(bases_powers)
        n = self._rand_int(1, power - 1)

        # base^(n/power) = (base^(1/power))^n = root^n
        root_val = int(round(base ** (1/power)))
        answer_val = root_val ** n

        if n == 1:
            text = f"Simplify ${base}^{{\\tfrac{{1}}{{{power}}}}}$."
            answer = str(root_val)
        else:
            text = f"Simplify ${base}^{{\\tfrac{{{n}}}{{{power}}}}}$."
            answer = str(answer_val)

        m1 = f"{base}^(1/{power}) = {root_val}"
        a1 = f"{root_val}^{n} = {answer}"

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
                common_error="Confusing fractional index with multiplication",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _mixed_question(self, q_num: int, sub_skill: str) -> Question:
        """Combine multiple index laws in one expression."""
        base = self._rand_int(2, 5)
        m = self._rand_int(2, 5)
        n = self._rand_int(2, 4)
        p = self._rand_int(2, 3)

        # (a^m x a^n) / a^p = a^(m+n-p)
        exp = m + n - p
        text = f"Simplify $\\dfrac{{{base}^{{{m}}} \\times {base}^{{{n}}}}}{{{base}^{{{p}}}}}$."

        if exp >= 0:
            answer = f"${base}^{{{exp}}}$"
        else:
            answer = f"$\\dfrac{{1}}{{{base}^{{{-exp}}}}}$"

        m1 = f"Numerator: {base}^({m}+{n}) = {base}^{m+n}. Then divide: {m+n} - {p} = {exp}"
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
                common_error="Applying laws in wrong order",
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
