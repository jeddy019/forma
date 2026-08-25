"""Standard form generator.

Sub-skills:
- convert_to_standard: convert ordinary number to standard form
- convert_from_standard: convert standard form to ordinary number
- operations: add/subtract/multiply/divide in standard form
- ordering: order numbers in standard form

Each answer is verified from the generated values.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class StandardFormGenerator(BaseGenerator):
    generator_key = "standard_form"
    topic_name = "Standard Form"
    supported_sub_skills = [
        "convert_to_standard",
        "convert_from_standard",
        "operations",
        "ordering",
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
        if sub_skill == "convert_to_standard":
            return self._to_standard_question(q_num, sub_skill)
        elif sub_skill == "convert_from_standard":
            return self._from_standard_question(q_num, sub_skill)
        elif sub_skill == "operations":
            return self._operations_question(q_num, sub_skill)
        else:
            return self._ordering_question(q_num, sub_skill)

    def _to_standard_question(self, q_num: int, sub_skill: str) -> Question:
        """Convert an ordinary number to standard form."""
        # Generate a number that converts nicely
        power = self._rand_int(2, 6)
        mantissa = self._rand_int(11, 99) / 10  # e.g. 1.1 to 9.9
        value = mantissa * (10 ** power)
        # Make it a whole number for cleanliness
        value = int(mantissa * 10) * (10 ** (power - 1))

        # Format as standard form
        mantissa_int = int(mantissa * 10)
        sf = f"${mantissa_int} \\times 10^{{{power}}}$"

        text = f"Write ${value:,}$ in standard form."
        answer = sf

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Move decimal point {power} places",
                A1=answer,
                common_error="Wrong number of zeros or wrong power",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _from_standard_question(self, q_num: int, sub_skill: str) -> Question:
        """Convert standard form to ordinary number."""
        power = self._rand_int(2, 5)
        mantissa = self._rand_int(12, 98)
        value = mantissa * (10 ** (power - 1))

        text = f"Write ${mantissa} \\times 10^{{{power - 1}}}$ as an ordinary number."
        answer = f"${value:,}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Move decimal point {power - 1} places to the right",
                A1=answer,
                common_error="Wrong number of zeros",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _operations_question(self, q_num: int, sub_skill: str) -> Question:
        """Add, subtract, multiply, or divide in standard form."""
        op = self._rand_choice(["multiply", "divide"])

        a_mant = self._rand_int(20, 80)
        a_exp = self._rand_int(1, 4)
        b_mant = self._rand_int(20, 80)
        b_exp = self._rand_int(1, 4)

        if op == "multiply":
            result_mant = a_mant * b_mant
            result_exp = a_exp + b_exp
            # Normalise to standard form (1 <= mantissa < 10)
            while result_mant >= 100:
                result_mant = result_mant / 10
                result_exp += 1
            result_mant = round(result_mant, 1)
            answer = f"${result_mant} \\times 10^{{{result_exp}}}$"

            text = (
                f"Calculate ${a_mant} \\times 10^{{{a_exp}}} \\times "
                f"{b_mant} \\times 10^{{{b_exp}}}$ Give your answer in standard form."
            )
            m1 = f"Multiply mantissas: {a_mant} x {b_mant} = {a_mant * b_mant}"
            a1 = answer
        else:
            # Division: keep exponents manageable
            a_exp = self._rand_int(3, 6)
            b_exp = self._rand_int(1, 3)
            result_mant = round(a_mant / b_mant, 1)
            result_exp = a_exp - b_exp
            while result_mant < 1:
                result_mant *= 10
                result_exp -= 1
            while result_mant >= 10:
                result_mant /= 10
                result_exp += 1
            result_mant = round(result_mant, 1)
            answer = f"${result_mant} \\times 10^{{{result_exp}}}$"

            text = (
                f"Calculate $\\dfrac{{{a_mant} \\times 10^{{{a_exp}}}}}{{{b_mant} \\times 10^{{{b_exp}}}}}$ "
                f"Give your answer in standard form."
            )
            m1 = f"Divide mantissas: {a_mant} / {b_mant} = {round(a_mant / b_mant, 2)}"
            a1 = answer

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Not normalising to standard form (mantissa must be 1-10)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _ordering_question(self, q_num: int, sub_skill: str) -> Question:
        """Order numbers given in standard form."""
        n = self._difficulty_range(3, 4, 5)
        numbers = []
        for _ in range(n):
            mant = self._rand_int(12, 98) / 10
            exp = self._rand_int(1, 5)
            numbers.append((mant, exp))

        # Sort ascending
        sorted_nums = sorted(numbers, key=lambda x: x[1] * 10 + x[0])
        ascending = ", ".join(f"${m} \\times 10^{{{e}}}$" for m, e in sorted_nums)

        # Shuffle for the question
        shuffled = list(numbers)
        self.rng.shuffle(shuffled)
        question_str = ", ".join(f"${m} \\times 10^{{{e}}}$" for m, e in shuffled)

        text = f"Write these numbers in order of size, smallest first: {question_str}."
        answer = ascending

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Compare the powers of 10 first, then the mantissas",
                A1=answer,
                common_error="Ordering by mantissa ignoring the power",
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
