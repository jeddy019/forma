"""Sequences generator.

Sub-skills:
- nth_term_linear: find the nth term formula for a linear sequence
- nth_term_quadratic: find the nth term formula for a quadratic sequence
- term_to_term: find the next terms from a term-to-term rule
- find_term: find a specific term (e.g. 20th term) from a formula or rule

Each answer is verified from the generated sequence.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class SequencesGenerator(BaseGenerator):
    generator_key = "sequences"
    topic_name = "Sequences"
    supported_sub_skills = [
        "nth_term_linear",
        "nth_term_quadratic",
        "term_to_term",
        "find_term",
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
        if sub_skill == "nth_term_linear":
            return self._nth_linear_question(q_num, sub_skill)
        elif sub_skill == "nth_term_quadratic":
            return self._nth_quadratic_question(q_num, sub_skill)
        elif sub_skill == "term_to_term":
            return self._term_to_term_question(q_num, sub_skill)
        else:
            return self._find_term_question(q_num, sub_skill)

    def _nth_linear_question(self, q_num: int, sub_skill: str) -> Question:
        """Find the nth term formula for a linear (arithmetic) sequence."""
        a = self._rand_int(-5, 10)  # first term
        d = self._rand_int(-5, 5)
        while d == 0:
            d = self._rand_int(-5, 5)

        terms = [a + i * d for i in range(5)]
        terms_str = ", ".join(str(t) for t in terms)

        # nth term = a + (n-1)d = dn + (a - d)
        coeff_n = d
        const = a - d

        if const > 0:
            formula = f"${coeff_n}n + {const}$" if coeff_n != 1 else f"$n + {const}$"
        elif const < 0:
            formula = f"${coeff_n}n - {abs(const)}$" if coeff_n != 1 else f"$n - {abs(const)}$"
        else:
            formula = f"${coeff_n}n$" if coeff_n != 1 else "$n$"

        text = f"Find the $n$th term of the sequence: ${terms_str}, \\ldots$"
        answer = formula

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Common difference = {d}. First term = {a}",
                A1=answer,
                common_error="Using dn + a instead of dn + (a - d)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _nth_quadratic_question(self, q_num: int, sub_skill: str) -> Question:
        """Find the nth term formula for a quadratic sequence."""
        # Build from an² + bn + c
        a_coeff = self._rand_choice([1, 1, 2, -1])
        b_coeff = self._rand_int(-3, 3)
        c_coeff = self._rand_int(-3, 3)

        terms = [a_coeff * n * n + b_coeff * n + c_coeff for n in range(1, 6)]
        terms_str = ", ".join(str(t) for t in terms)

        # Format answer
        parts = []
        if a_coeff == 1:
            parts.append("n^2")
        elif a_coeff == -1:
            parts.append("-n^2")
        else:
            parts.append(f"{a_coeff}n^2")

        if b_coeff > 0:
            parts.append(f"+ {b_coeff}n" if b_coeff != 1 else "+ n")
        elif b_coeff < 0:
            parts.append(f"- {abs(b_coeff)}n" if b_coeff != -1 else "- n")

        if c_coeff > 0:
            parts.append(f"+ {c_coeff}")
        elif c_coeff < 0:
            parts.append(f"- {abs(c_coeff)}")

        answer = "$" + " ".join(parts) + "$"

        text = f"Find the $n$th term of the sequence: ${terms_str}, \\ldots$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Second differences are constant → quadratic. Find a, b, c",
                A1=answer,
                common_error="Treating it as linear when second differences are non-zero",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _term_to_term_question(self, q_num: int, sub_skill: str) -> Question:
        """Find next terms from a term-to-term rule."""
        rule_type = self._rand_choice(["add", "multiply", "mixed"])

        if rule_type == "add":
            start = self._rand_int(1, 10)
            step = self._rand_int(2, 8)
            terms = [start + i * step for i in range(4)]
            rule = f"Add {step}"
            next_terms = [terms[-1] + step, terms[-1] + 2 * step]

        elif rule_type == "multiply":
            start = self._rand_int(2, 5)
            factor = self._rand_int(2, 3)
            terms = [start * (factor ** i) for i in range(4)]
            rule = f"Multiply by {factor}"
            next_terms = [terms[-1] * factor, terms[-1] * factor ** 2]

        else:  # mixed
            start = self._rand_int(1, 5)
            add_val = self._rand_int(1, 5)
            mult_val = self._rand_choice([2, 3])
            terms = [start]
            for _ in range(3):
                terms.append(terms[-1] * mult_val + add_val)
            rule = f"Multiply by {mult_val} then add {add_val}"
            next_val = terms[-1] * mult_val + add_val
            next_terms = [next_val, next_val * mult_val + add_val]

        terms_str = ", ".join(str(t) for t in terms)
        next_str = ", ".join(str(n) for n in next_terms)

        text = f"The first four terms of a sequence are ${terms_str}$. The rule is: {rule}. Write down the next two terms."
        answer = next_str

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Apply rule to last term: {terms[-1]}",
                A1=answer,
                common_error="Applying rule once instead of twice",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _find_term_question(self, q_num: int, sub_skill: str) -> Question:
        """Find a specific term from an nth term formula."""
        a = self._rand_int(-3, 8)
        d = self._rand_int(1, 6)
        n = self._rand_int(10, 50)

        term_n = a + (n - 1) * d

        if d > 0:
            formula = f"{d}n + {a - d}" if a - d != 0 else f"{d}n"
        else:
            formula = f"{d}n + {a - d}"

        text = f"The $n$th term of a sequence is ${formula}$. Find the ${n}$th term."
        answer = str(term_n)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Substitute n = {n} into the formula",
                A1=f"{d} x {n} + {a - d} = {term_n}",
                common_error="Using n instead of (n-1) or arithmetic error",
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
