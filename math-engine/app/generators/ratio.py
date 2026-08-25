"""Ratio and proportion generator.

Sub-skills:
- simplify: simplify a ratio to lowest terms
- sharing_in_ratio: divide an amount in a given ratio
- direct_proportion: y = kx problems
- inverse_proportion: y = k/x problems

Each answer is verified from the generated values.
"""

from math import gcd

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class RatioGenerator(BaseGenerator):
    generator_key = "ratio"
    topic_name = "Ratio and Proportion"
    supported_sub_skills = [
        "simplify",
        "sharing_in_ratio",
        "direct_proportion",
        "inverse_proportion",
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
        if sub_skill == "simplify":
            return self._simplify_question(q_num, sub_skill)
        elif sub_skill == "sharing_in_ratio":
            return self._sharing_question(q_num, sub_skill)
        elif sub_skill == "direct_proportion":
            return self._direct_question(q_num, sub_skill)
        else:
            return self._inverse_question(q_num, sub_skill)

    def _simplify_question(self, q_num: int, sub_skill: str) -> Question:
        """Simplify a ratio to its lowest terms."""
        # Generate two parts with a common factor
        factor = self._rand_int(2, 12)
        a = self._rand_int(1, 15) * factor
        b = self._rand_int(1, 15) * factor
        while b == a:
            b = self._rand_int(1, 15) * factor

        g = gcd(a, b)
        sa, sb = a // g, b // g

        text = f"Simplify the ratio ${a} : {b}$."
        answer = f"{sa} : {sb}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Find HCF of {a} and {b} = {g}",
                A1=f"{a} \\div {g} : {b} \\div {g} = {sa} : {sb}",
                common_error="Not fully simplifying",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _sharing_question(self, q_num: int, sub_skill: str) -> Question:
        """Divide an amount in a given ratio."""
        ratio_a = self._rand_int(1, 8)
        ratio_b = self._rand_int(1, 8)
        while ratio_b == ratio_a:
            ratio_b = self._rand_int(1, 8)
        g = gcd(ratio_a, ratio_b)
        ratio_a_s, ratio_b_s = ratio_a // g, ratio_b // g

        total_parts = ratio_a + ratio_b
        multiplier = self._difficulty_range(
            self._rand_int(1, 5), self._rand_int(2, 10), self._rand_int(5, 20)
        )
        total = total_parts * multiplier

        a_shares = ratio_a * multiplier
        b_shares = ratio_b * multiplier

        text = f"Divide ${total}$ in the ratio ${ratio_a} : {ratio_b}$."
        answer = f"${a_shares}$ and ${b_shares}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Total parts = {ratio_a} + {ratio_b} = {total_parts}. Value of 1 part = {total} / {total_parts} = {multiplier}",
                A1=f"Shares: {ratio_a} x {multiplier} = {a_shares}, {ratio_b} x {multiplier} = {b_shares}",
                common_error="Dividing by number of people instead of total parts",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _direct_question(self, q_num: int, sub_skill: str) -> Question:
        """Direct proportion: y = kx."""
        k_num = self._rand_int(1, 10)
        k_den = self._rand_int(1, 5)
        # Simplify k
        g = gcd(k_num, k_den)
        k_num, k_den = k_num // g, k_den // g

        x1 = self._rand_int(1, 10) * k_den
        y1 = k_num * (x1 // k_den)

        x2 = self._rand_int(1, 10) * k_den
        while x2 == x1:
            x2 = self._rand_int(1, 10) * k_den
        y2 = k_num * (x2 // k_den)

        # Format k nicely
        if k_den == 1:
            k_str = str(k_num)
        else:
            k_str = f"\\tfrac{{{k_num}}}{{{k_den}}}"

        item = self._rand_choice(["apples", "pencils", "books", "tiles", "carrots"])
        text = (
            f"${x1}$ {item} cost ${y1}p$. "
            f"How much do ${x2}$ {item} cost?"
        )
        answer = f"{y2}p"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Unit cost = {y1}p / {x1} = {k_str}p per item",
                A1=f"{x2} x {k_str} = {y2}p",
                common_error="Finding unit cost but forgetting to multiply",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _inverse_question(self, q_num: int, sub_skill: str) -> Question:
        """Inverse proportion: y = k/x."""
        k = self._rand_int(6, 60)
        # Find factor pairs of k
        factors = [(i, k // i) for i in range(1, int(k**0.5) + 1) if k % i == 0]
        if len(factors) < 2:
            k = 12
            factors = [(1, 12), (2, 6), (3, 4)]

        x1, y1 = self._rand_choice(factors)
        x2_options = [f[0] for f in factors if f[0] != x1]
        if not x2_options:
            x2 = y1
            y2 = x1
        else:
            x2 = self._rand_choice(x2_options)
            y2 = k // x2

        workers = self._rand_choice(["workers", "machines", "people"])
        task = self._rand_choice(["days", "hours", "minutes"])
        text = (
            f"${x1}$ {workers} can complete a job in ${y1}$ {task}. "
            f"How long would ${x2}$ {workers} take?"
        )
        answer = f"{y2} {task}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Total work = {x1} x {y1} = {k}",
                A1=f"{k} / {x2} = {y2} {task}",
                common_error="Using direct proportion instead of inverse",
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
