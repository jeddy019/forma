"""Arithmetic generator.

Sub-skills:
- operations: basic +, -, ×, ÷ with integer results
- order_of_operations: BODMAS/PEMDAS expressions
- hcf_lcm: highest common factor and lowest common multiple
- number_properties: prime, factor, multiple identification

Each question has a verified answer computed from the generated values.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class ArithmeticGenerator(BaseGenerator):
    generator_key = "arithmetic"
    topic_name = "Arithmetic"
    supported_sub_skills = [
        "operations",
        "order_of_operations",
        "hcf_lcm",
        "number_properties",
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
        if sub_skill == "operations":
            return self._operations_question(q_num, sub_skill)
        elif sub_skill == "order_of_operations":
            return self._bodmas_question(q_num, sub_skill)
        elif sub_skill == "hcf_lcm":
            return self._hcf_lcm_question(q_num, sub_skill)
        else:
            return self._number_properties_question(q_num, sub_skill)

    def _operations_question(self, q_num: int, sub_skill: str) -> Question:
        """Multi-step arithmetic with integer answers."""
        if self.difficulty == "higher":
            a = self._rand_int(10, 999)
            c = self._rand_int(2, 12)
            op1 = self._rand_choice(["+", "-"])
            op2 = self._rand_choice(["mul", "div"])
            if op2 == "mul":
                b = self._rand_int(2, 20)
                result = a + b * c if op1 == "+" else a - b * c
                text = f"Work out ${a} {op1} {b} \\times {c}$"
                m1 = f"Calculate {b} × {c} = {b * c}"
                a1 = f"Then {a} {op1} {b * c} = {result}"
            else:
                b = self._rand_int(2, 12) * c
                div_result = b // c
                result = a + div_result if op1 == "+" else a - div_result
                text = f"Work out ${a} {op1} {b} \\div {c}$"
                m1 = f"Calculate {b} ÷ {c} = {div_result}"
                a1 = f"Then {a} {op1} {div_result} = {result}"
        else:
            a = self._rand_int(2, 100)
            b = self._rand_int(2, 100)
            op = self._rand_choice(["+", "-"])
            if op == "-":
                while a < b:
                    a = self._rand_int(10, 100)
                    b = self._rand_int(2, 50)
            result = a + b if op == "+" else a - b
            text = f"Work out ${a} {op} {b}$"
            m1 = f"Calculate {a} {op} {b}"
            a1 = str(result)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2 if self.difficulty == "higher" else 1,
            diagram_spec=None,
            working_lines=3 if self.difficulty == "higher" else 2,
            answer=str(result),
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Arithmetic error",
                allow=str(result),
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _bodmas_question(self, q_num: int, sub_skill: str) -> Question:
        """Order of operations expressions."""
        if self.difficulty == "foundation":
            a = self._rand_int(2, 10)
            b = self._rand_int(2, 10)
            c = self._rand_int(1, 5)
            # (a + b) × c
            result = (a + b) * c
            text = f"Work out $({a} + {b}) \\times {c}$"
            m1 = f"Bracket first: {a} + {b} = {a + b}"
            a1 = f"Then {a + b} × {c} = {result}"
        elif self.difficulty == "higher":
            a = self._rand_int(2, 10)
            b = self._rand_int(2, 10)
            c = self._rand_int(2, 5)
            d = self._rand_int(1, 5)
            # a × b + c² - d
            result = a * b + c ** 2 - d
            text = f"Work out ${a} \\times {b} + {c}^{{2}} - {d}$"
            m1 = f"Indices first: {c}² = {c**2}"
            a1 = f"Then {a}×{b} + {c**2} - {d} = {a*b} + {c**2} - {d} = {result}"
        else:
            a = self._rand_int(2, 12)
            b = self._rand_int(2, 12)
            c = self._rand_int(1, 10)
            op = self._rand_choice(["+", "-"])
            # a × b + c  or  a × b - c
            if op == "+":
                result = a * b + c
            else:
                result = a * b - c
                while result < 0:
                    c = self._rand_int(1, a * b - 1)
                    result = a * b - c
            text = f"Work out ${a} \\times {b} {op} {c}$"
            m1 = f"Multiply first: {a} × {b} = {a * b}"
            a1 = f"Then {a * b} {op} {c} = {result}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=str(result),
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Not following BODMAS/PEMDAS order",
                allow=str(result),
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _hcf_lcm_question(self, q_num: int, sub_skill: str) -> Question:
        """Find HCF or LCM of two numbers."""
        a = self._difficulty_range(self._rand_int(4, 20), self._rand_int(12, 60), self._rand_int(30, 200))
        b = self._difficulty_range(self._rand_int(4, 20), self._rand_int(12, 60), self._rand_int(30, 200))
        while b == a:
            b = self._rand_int(4, 60)

        find_hcf = self._rand_choice([True, False])
        if find_hcf:
            answer = math.gcd(a, b)
            text = f"Find the highest common factor (HCF) of ${a}$ and ${b}$."
            m1 = f"List factors of {a}: {self._factors(a)}"
            a1 = f"Largest common factor = {answer}"
        else:
            answer = math.lcm(a, b)
            text = f"Find the lowest common multiple (LCM) of ${a}$ and ${b}$."
            m1 = f"List multiples or use prime factorisation"
            a1 = f"LCM = {answer}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=4,
            answer=str(answer),
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Confusing HCF with LCM",
                allow=str(answer),
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _number_properties_question(self, q_num: int, sub_skill: str) -> Question:
        """Prime numbers, factors, multiples."""
        prop = self._rand_choice(["prime", "factor", "multiple"])

        if prop == "prime":
            # Find the nth prime or list primes in a range
            primes = [n for n in range(2, 100) if self._is_prime(n)]
            n = self._difficulty_range(self._rand_int(1, 5), self._rand_int(1, 8), self._rand_int(6, 10))
            answer = str(primes[n - 1])
            text = f"What is the ${self._ordinal(n)}$ prime number?"
            m1 = f"List primes in order: 2, 3, 5, 7, 11, ..."
            a1 = f"The {self._ordinal(n)} prime is {answer}"
        elif prop == "factor":
            n = self._difficulty_range(self._rand_int(12, 30), self._rand_int(30, 100), self._rand_int(60, 200))
            facs = sorted(self._factors_list(n))
            answer = ", ".join(str(f) for f in facs)
            text = f"List all the factors of ${n}$."
            m1 = f"Test each number up to √{n} ≈ {int(n**0.5) + 1}"
            a1 = f"Factors: {answer}"
        else:
            a = self._difficulty_range(self._rand_int(2, 8), self._rand_int(3, 12), self._rand_int(5, 20))
            b = self._rand_int(2, 5)
            n = a * b
            answer = str(n)
            text = f"${n}$ is a multiple of ${a}$. Write down the next multiple of ${a}$ after ${n}$."
            m1 = f"Add {a} to {n}"
            a1 = f"{n} + {a} = {answer}"

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
                A1=answer,
                common_error="Counting error or definition mix-up",
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

    @staticmethod
    def _is_prime(n: int) -> bool:
        if n < 2:
            return False
        for i in range(2, int(n**0.5) + 1):
            if n % i == 0:
                return False
        return True

    @staticmethod
    def _factors(n: int) -> list[int]:
        return sorted([i for i in range(1, n + 1) if n % i == 0])

    @staticmethod
    def _factors_list(n: int) -> list[int]:
        return [i for i in range(1, n + 1) if n % i == 0]

    @staticmethod
    def _ordinal(n: int) -> str:
        """Return LaTeX ordinal: 1st, 2nd, 3rd, 4th..."""
        if 11 <= n % 100 <= 13:
            return f"{n}^{{\\text{{th}}}}"
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}^{{\\text{{{suffix}}}}}"
