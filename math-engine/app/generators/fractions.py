"""Fractions generator.

Sub-skills:
- adding_fractions: adding with same/different denominators
- subtracting_fractions: subtracting with same/different denominators
- multiplying_fractions: multiplication of fractions
- dividing_fractions: division of fractions
- mixed_numbers: operations with mixed numbers
- equivalent_fractions: finding equivalent fractions

Each question has a verified answer computed from the generated values,
not guessed by an AI.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class FractionsGenerator(BaseGenerator):
    generator_key = "fractions"
    topic_name = "Fractions"
    supported_sub_skills = [
        "adding_fractions",
        "subtracting_fractions",
        "multiplying_fractions",
        "dividing_fractions",
        "mixed_numbers",
        "equivalent_fractions",
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
        if sub_skill == "adding_fractions":
            return self._add_sub_question(q_num, sub_skill, adding=True)
        elif sub_skill == "subtracting_fractions":
            return self._add_sub_question(q_num, sub_skill, adding=False)
        elif sub_skill == "multiplying_fractions":
            return self._mul_question(q_num, sub_skill)
        elif sub_skill == "dividing_fractions":
            return self._div_question(q_num, sub_skill)
        elif sub_skill == "mixed_numbers":
            return self._mixed_question(q_num, sub_skill)
        else:
            return self._equivalent_question(q_num, sub_skill)

    def _add_sub_question(self, q_num: int, sub_skill: str, adding: bool) -> Question:
        """Addition or subtraction of two fractions with different denominators."""
        a_num = self._rand_int(1, self._difficulty_range(5, 9, 12))
        a_den = self._rand_int(2, self._difficulty_range(6, 10, 12))
        b_num = self._rand_int(1, self._difficulty_range(5, 9, 12))
        b_den = self._rand_int(2, self._difficulty_range(6, 10, 12))

        # Ensure different denominators for a meaningful question
        while b_den == a_den:
            b_den = self._rand_int(2, 12)

        op = "+" if adding else "-"
        lcm = math.lcm(a_den, b_den)
        new_a = a_num * (lcm // a_den)
        new_b = b_num * (lcm // b_den)

        if adding:
            result_num = new_a + new_b
        else:
            # Ensure positive result
            if new_b > new_a:
                a_num, b_num = b_num, a_num
                a_den, b_den = b_den, a_den
                new_a, new_b = new_b, new_a
            result_num = new_a - new_b

        gcd = math.gcd(result_num, lcm)
        simp_num = result_num // gcd
        simp_den = lcm // gcd

        # Simplify for answer
        if simp_den == 1:
            answer = str(simp_num)
        else:
            answer = f"{simp_num}/{simp_den}"

        text = f"Work out ${self.frac_inner(a_num, a_den)} {op} {self.frac_inner(b_num, b_den)}$"

        return Question(
            id=f"q{q_num}",
            type="core",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=2,
                    working_lines=4,
                    answer=answer,
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Find a common denominator of {lcm} and convert both fractions",
                        A1=f"${self.frac_inner(simp_num, simp_den)}$ or {answer}",
                        common_error="Adding/subtracting numerators without converting denominators",
                        allow=f"{simp_num}/{simp_den} (not simplified) is also acceptable",
                    ),
                )
            ],
        )

    def _mul_question(self, q_num: int, sub_skill: str) -> Question:
        a_num = self._rand_int(1, self._difficulty_range(5, 8, 12))
        a_den = self._rand_int(2, self._difficulty_range(6, 10, 12))
        b_num = self._rand_int(1, self._difficulty_range(5, 8, 12))
        b_den = self._rand_int(2, self._difficulty_range(6, 10, 12))

        res_num = a_num * b_num
        res_den = a_den * b_den
        gcd = math.gcd(res_num, res_den)
        simp_num = res_num // gcd
        simp_den = res_den // gcd

        answer = str(simp_num) if simp_den == 1 else f"{simp_num}/{simp_den}"

        text = f"Work out ${self.frac_inner(a_num, a_den)} \\times {self.frac_inner(b_num, b_den)}$"

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
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Multiply numerators and denominators: {a_num} x {b_num} / {a_den} x {b_den}",
                        A1=f"${self.frac_inner(simp_num, simp_den)}$ or {answer}",
                        common_error="Cross-multiplying instead of multiplying straight across",
                        allow=f"{simp_num}/{simp_den} (not simplified) is also acceptable",
                    ),
                )
            ],
        )

    def _div_question(self, q_num: int, sub_skill: str) -> Question:
        a_num = self._rand_int(1, self._difficulty_range(3, 7, 12))
        a_den = self._rand_int(2, self._difficulty_range(5, 8, 12))
        b_num = self._rand_int(1, self._difficulty_range(3, 7, 12))
        b_den = self._rand_int(2, self._difficulty_range(5, 8, 12))

        # Dividing by a/b = multiplying by b/a
        res_num = a_num * b_den
        res_den = a_den * b_num
        gcd = math.gcd(res_num, res_den)
        simp_num = res_num // gcd
        simp_den = res_den // gcd

        answer = str(simp_num) if simp_den == 1 else f"{simp_num}/{simp_den}"

        text = f"Work out ${self.frac_inner(a_num, a_den)} \\div {self.frac_inner(b_num, b_den)}$"

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
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Invert the second fraction and multiply: {self.frac_inner(a_num, a_den)} x {self.frac_inner(b_den, b_num)}",
                        A1=f"${self.frac_inner(simp_num, simp_den)}$ or {answer}",
                        common_error="Inverting the wrong fraction or dividing straight across",
                        allow=f"{simp_num}/{simp_den} (not simplified) is also acceptable",
                    ),
                )
            ],
        )

    def _mixed_question(self, q_num: int, sub_skill: str) -> Question:
        """Mixed number to improper fraction conversion."""
        whole = self._rand_int(1, self._difficulty_range(3, 5, 8))
        num = self._rand_int(1, 5)
        den = self._rand_int(2, self._difficulty_range(6, 9, 12))
        while num >= den:
            den = self._rand_int(num + 1, 12)

        improper_num = whole * den + num
        answer = f"{improper_num}/{den}"

        text = f"Convert ${whole}\\dfrac{{{num}}}{{{den}}}$ to an improper fraction."

        return Question(
            id=f"q{q_num}",
            type="warm-up",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=1,
                    working_lines=2,
                    answer=answer,
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Multiply {whole} by {den} and add {num}: {whole} x {den} + {num} = {improper_num}",
                        A1=f"${self.frac_inner(improper_num, den)}$",
                        common_error="Forgetting to multiply the whole number by the denominator",
                        allow=f"{improper_num}/{den} (not simplified) is also acceptable",
                    ),
                )
            ],
        )

    def _equivalent_question(self, q_num: int, sub_skill: str) -> Question:
        """Find an equivalent fraction."""
        num = self._rand_int(1, 8)
        den = self._rand_int(2, 12)
        while den == num:
            den = self._rand_int(2, 12)
        mult = self._rand_int(2, self._difficulty_range(3, 5, 8))

        target_num = num * mult
        target_den = den * mult
        answer = f"{target_num}/{target_den}"

        text = f"Find an equivalent fraction for ${self.frac_inner(num, den)}$ by multiplying both the numerator and denominator by {mult}."

        return Question(
            id=f"q{q_num}",
            type="warm-up",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=1,
                    working_lines=2,
                    answer=answer,
                    answer_format="numerical",
                    mark_scheme=MarkScheme(
                        M1=f"Multiply numerator and denominator by {mult}",
                        A1=f"${self.frac_inner(target_num, target_den)}$",
                        common_error="Only multiplying the numerator, not the denominator",
                        allow=f"{target_num}/{target_den} (not simplified) is also acceptable",
                    ),
                )
            ],
        )

    @staticmethod
    def frac_inner(num: int, den: int) -> str:
        """Inline fraction for use inside other LaTeX (no surrounding $)."""
        return f"\\tfrac{{{num}}}{{{den}}}"
