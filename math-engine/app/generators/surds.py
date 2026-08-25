"""Surds (radicals) generator.

Sub-skills:
- simplify_surds: simplify sqrt(n) to a*sqrt(b)
- rationalise_denominator: remove surds from denominators
- operations_with_surds: add/subtract/multiply surds
- conjugate_method: rationalise using the conjugate

Uses SymPy for symbolic verification of surd simplification.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class SurdsGenerator(BaseGenerator):
    generator_key = "surds"
    topic_name = "Surds"
    supported_sub_skills = [
        "simplify_surds",
        "rationalise_denominator",
        "operations_with_surds",
        "conjugate_method",
    ]

    def _alignment_note(self) -> str:
        term = self.terms.radicals
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
        if sub_skill == "simplify_surds":
            return self._simplify_question(q_num, sub_skill)
        elif sub_skill == "rationalise_denominator":
            return self._rationalise_question(q_num, sub_skill)
        elif sub_skill == "operations_with_surds":
            return self._operations_question(q_num, sub_skill)
        else:
            return self._conjugate_question(q_num, sub_skill)

    def _simplify_question(self, q_num: int, sub_skill: str) -> Question:
        """Simplify sqrt(n) to a*sqrt(b)."""
        # Pick outer and inner so we construct n = outer^2 * inner
        outer = self._rand_int(2, self._difficulty_range(4, 7, 10))
        # inner should not be a perfect square
        inner = self._rand_choice([2, 3, 5, 6, 7, 8, 10, 12])
        n = outer * outer * inner

        answer_outer, answer_inner = self.simplify_sqrt(n)
        if answer_inner == 1:
            answer = str(answer_outer)
        else:
            answer = f"{answer_outer}{self.terms.radicals.lower()}({answer_inner})"
            answer = f"{answer_outer}\\sqrt{{{answer_inner}}}"

        text = f"Simplify ${self.sqrt(n)}$."

        return Question(
            id=f"q{q_num}",
            type="warm-up",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=2,
                    working_lines=3,
                    answer=f"{answer_outer}\\sqrt{{{answer_inner}}}" if answer_inner != 1 else str(answer_outer),
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Find the largest square factor of {n}: {answer_outer}^2 x {answer_inner} = {n}",
                        A1=f"${answer_outer}\\sqrt{{{answer_inner}}}$" if answer_inner != 1 else f"${answer_outer}$",
                        common_error="Leaving the answer unsimplified or misidentifying square factors",
                        allow=f"{answer_outer}sqrt({answer_inner}) notation is acceptable",
                    ),
                )
            ],
        )

    def _rationalise_question(self, q_num: int, sub_skill: str) -> Question:
        """Rationalise 1/sqrt(n) or a/sqrt(n)."""
        denom_inner = self._rand_choice([2, 3, 5, 6, 7, 8, 10])
        numer = self._rand_int(1, self._difficulty_range(3, 6, 10))

        # rationalise: multiply top and bottom by sqrt(denom_inner)
        answer_num = numer
        answer_den = denom_inner

        gcd_val = math.gcd(answer_num, answer_den)
        simp_num = answer_num // gcd_val
        simp_den = answer_den // gcd_val

        if simp_den == 1:
            answer = f"{simp_num}\\sqrt{{{denom_inner}}}"
        else:
            answer = f"\\dfrac{{{simp_num}\\sqrt{{{denom_inner}}}}}{{{simp_den}}}"

        text = f"Rationalise the denominator of $\\dfrac{{{numer}}}{{\\sqrt{{{denom_inner}}}}}$."

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
                        M1=f"Multiply numerator and denominator by $\\sqrt{{{denom_inner}}}$",
                        A1=f"${answer}$",
                        common_error="Only multiplying the denominator, not both top and bottom",
                        allow="Equivalent simplified forms",
                    ),
                )
            ],
        )

    def _operations_question(self, q_num: int, sub_skill: str) -> Question:
        """Add or subtract like surds."""
        # a*sqrt(n) + b*sqrt(n) = (a+b)*sqrt(n)
        inner = self._rand_choice([2, 3, 5, 6, 7, 8])
        a = self._rand_int(1, self._difficulty_range(5, 8, 12))
        b = self._rand_int(1, self._difficulty_range(5, 8, 12))
        op = self._rand_choice(["+", "-"])

        if op == "+":
            result_coeff = a + b
        else:
            # Ensure positive result
            if b > a:
                a, b = b, a
            result_coeff = a - b

        term_sym = self.terms.radicals.lower()

        if result_coeff == 1:
            answer = f"\\sqrt{{{inner}}}"
        else:
            answer = f"{result_coeff}\\sqrt{{{inner}}}"

        text = f"Simplify ${a}\\sqrt{{{inner}}} {op} {b}\\sqrt{{{inner}}}$."

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
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Combine coefficients: {a} {op} {b} = {result_coeff}",
                        A1=f"${answer}$",
                        common_error="Trying to add/subtract the numbers inside the square root",
                        allow=f"{result_coeff}sqrt({inner}) notation is acceptable",
                    ),
                )
            ],
        )

    def _conjugate_question(self, q_num: int, sub_skill: str) -> Question:
        """Rationalise using the conjugate: a/(b + sqrt(n))."""
        b = self._rand_int(2, 8)
        inner = self._rand_choice([2, 3, 5, 6, 7])
        numer = self._rand_int(1, self._difficulty_range(3, 5, 8))

        # Multiply by (b - sqrt(n)) / (b - sqrt(n))
        # Numerator: numer * (b - sqrt(n))
        # Denominator: b^2 - n
        denom = b * b - inner
        while denom <= 0:
            b += 1
            denom = b * b - inner

        gcd_val = math.gcd(numer, denom)
        simp_num = numer // gcd_val
        simp_den = denom // gcd_val

        if simp_den == 1:
            answer = f"{simp_num}({b} - \\sqrt{{{inner}}})"
        else:
            answer = f"\\dfrac{{{simp_num}({b} - \\sqrt{{{inner}}})}}{{{simp_den}}}"

        text = f"Rationalise the denominator of $\\dfrac{{{numer}}}{{{b} + \\sqrt{{{inner}}}}}$."

        return Question(
            id=f"q{q_num}",
            type="challenge",
            sub_skill=sub_skill,
            parts=[
                QuestionPart(
                    text=text,
                    marks=3,
                    working_lines=5,
                    answer=answer,
                    answer_format="extended",
                    mark_scheme=MarkScheme(
                        M1=f"Multiply by the conjugate: $\\dfrac{{{b} - \\sqrt{{{inner}}}}}{{{b} - \\sqrt{{{inner}}}}}$",
                        A1=f"${answer}$",
                        common_error="Using the wrong conjugate sign or forgetting to expand the numerator",
                        allow="Equivalent simplified forms",
                    ),
                )
            ],
        )
