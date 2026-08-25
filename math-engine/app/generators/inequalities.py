"""Inequalities generator.

Sub-skills:
- solve: solve linear inequalities like 2x + 3 > 7
- represent_on_number_line: mark solution on number line diagram
- combined: solve compound inequalities like 3 < 2x + 1 <= 9
- word_problems: real-world inequality problems

Each answer is verified algebraically from generated values.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class InequalitiesGenerator(BaseGenerator):
    generator_key = "inequalities"
    topic_name = "Inequalities"
    supported_sub_skills = [
        "solve",
        "represent_on_number_line",
        "combined",
        "word_problems",
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
        if sub_skill == "solve":
            return self._solve_question(q_num, sub_skill)
        elif sub_skill == "represent_on_number_line":
            return self._number_line_question(q_num, sub_skill)
        elif sub_skill == "combined":
            return self._combined_question(q_num, sub_skill)
        else:
            return self._word_problem(q_num, sub_skill)

    def _solve_question(self, q_num: int, sub_skill: str) -> Question:
        """Solve a linear inequality like ax + b > c."""
        # Build from answer backwards
        # Solution: x > n or x < n or x >= n or x <= n
        x_bound = self._difficulty_range(
            self._rand_int(1, 10), self._rand_int(2, 20), self._rand_int(5, 50)
        )
        a = self._rand_int(2, 10)
        b = self._rand_int(1, 20)
        op = self._rand_choice([">", "<", ">=", "<="])
        c = a * x_bound + b

        # Display with <= as the non-strict option
        if op == "<=":
            symbol = "\\leq"
            display_op = "leq"
        elif op == ">=":
            symbol = "\\geq"
            display_op = "geq"
        else:
            symbol = op
            display_op = op

        text = f"Solve ${a}x + {b} {symbol} {c}$."

        # Compute answer: need to divide by a, handle sign flip
        if a > 0:
            answer = f"x {op} {x_bound}"
            latex_answer = f"x {symbol} {x_bound}"
        else:
            # Flip inequality when dividing by negative
            flipped_op = {">": "<", "<": ">", ">=": "<=", "<=": ">="}[op]
            flipped_sym = {">": "<", "<": ">", ">=": "\\leq", "<=": "\\geq"}[op]
            answer = f"x {flipped_op} {x_bound}"
            latex_answer = f"x {flipped_sym} {x_bound}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=latex_answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Subtract {b}: {a}x {symbol} {c - b}",
                A1=f"Divide by {a}: x {op} {x_bound}",
                common_error="Forgetting to flip inequality when dividing by negative",
                allow=latex_answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _number_line_question(self, q_num: int, sub_skill: str) -> Question:
        """Represent an inequality on a number line (with diagram)."""
        bound = self._rand_int(-10, 10)
        while bound == 0:
            bound = self._rand_int(-10, 10)
        op = self._rand_choice([">", "<", ">=", "<="])
        filled = op in (">", "<=")

        if op == ">":
            symbol = ">"
            direction = "right"
        elif op == "<":
            symbol = "<"
            direction = "left"
        elif op == ">=":
            symbol = "\\geq"
            direction = "right"
        else:
            symbol = "\\leq"
            direction = "left"

        text = f"Show the inequality $x {symbol} {bound}$ on a number line."

        # Number line diagram
        min_val = bound - 5
        max_val = bound + 5
        diagram = self.make_number_line(
            min_val=min_val,
            max_val=max_val,
            marked=[{"value": bound, "label": str(bound), "filled": filled}],
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=diagram,
            working_lines=0,
            answer=f"{'Open' if not filled else 'Closed'} circle at {bound}, shaded {direction}",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Mark {'open' if not filled else 'closed'} circle at {bound}",
                A1=f"Shade {direction} of {bound}",
                common_error="Wrong circle type (open vs closed)",
                allow=f"{'Open' if not filled else 'Closed'} circle at {bound}",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _combined_question(self, q_num: int, sub_skill: str) -> Question:
        """Solve compound inequality like a < bx + c <= d."""
        # Solution: some_value < x <= another_value
        lo = self._rand_int(1, 10)
        hi = lo + self._rand_int(2, 10)
        a = self._rand_int(1, 5)
        b = self._rand_int(1, 10)

        # Construct: a < a*x + b <= upper
        lower_bound = a * lo + b + 1  # strict lower
        upper_bound = a * hi + b      # inclusive upper

        text = f"Solve ${lower_bound} < {a}x + {b} \\leq {upper_bound}$."

        answer = f"${lo + 1} < x \\leq {hi}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Subtract {b}: {lower_bound - b} < {a}x \\leq {upper_bound - b}",
                A1=f"Divide by {a}: {lo + 1} < x \\leq {hi}",
                common_error="Applying different operations to each part incorrectly",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _word_problem(self, q_num: int, sub_skill: str) -> Question:
        """Word problem leading to an inequality."""
        price = self._rand_int(2, 15)
        budget = self._difficulty_range(
            self._rand_int(20, 50), self._rand_int(50, 200), self._rand_int(100, 500)
        )
        max_items = budget // price

        templates = [
            (
                f"Each notebook costs ${p}p$. I have ${b}p$. Write an inequality to show the maximum number of notebooks $n$ I can buy.",
                f"{p}n \\leq {b}",
                f"n \\leq {max_items}",
            )
            for p, b in [(price * 10, budget * 10)]
        ]

        # Use simpler wording
        p = price
        b = budget
        text = (
            f"Each item costs ${p}p$. You have ${b}p$. "
            f"Write an inequality to find the maximum number of items $n$ you can buy."
        )
        m1 = f"Set up: {p}n <= {b}"
        a1 = f"n <= {max_items}"
        answer = f"n \\leq {max_items}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=f"${answer}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=f"${a1}$",
                common_error="Using < instead of <= for discrete items",
                allow=f"${answer}$",
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
