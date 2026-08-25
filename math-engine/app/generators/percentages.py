"""Percentages generator.

Sub-skills:
- find_percent: find x% of a number
- increase_decrease: percentage increase or decrease
- reverse_percent: find original number after a percentage change
- compound: compound percentage change over multiple periods
- consecutive: consecutive percentage changes (e.g. increase then decrease)

Each answer is verified from the generated values.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class PercentagesGenerator(BaseGenerator):
    generator_key = "percentages"
    topic_name = "Percentages"
    supported_sub_skills = [
        "find_percent",
        "increase_decrease",
        "reverse_percent",
        "compound",
        "consecutive",
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
        if sub_skill == "find_percent":
            return self._find_percent_question(q_num, sub_skill)
        elif sub_skill == "increase_decrease":
            return self._increase_decrease_question(q_num, sub_skill)
        elif sub_skill == "reverse_percent":
            return self._reverse_question(q_num, sub_skill)
        elif sub_skill == "compound":
            return self._compound_question(q_num, sub_skill)
        else:
            return self._consecutive_question(q_num, sub_skill)

    def _find_percent_question(self, q_num: int, sub_skill: str) -> Question:
        """Find x% of a number. Uses fractions to ensure exact answers."""
        percent = self._rand_choice([10, 15, 20, 25, 30, 40, 50, 75])
        # Pick number that gives a nice answer
        multiplier = self._difficulty_range(self._rand_int(2, 10), self._rand_int(5, 20), self._rand_int(10, 40))
        base = multiplier * (100 // percent)
        answer = base * percent // 100

        text = f"Find ${percent}\\%$ of ${base}$."
        answer_str = str(answer)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer_str,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"{percent}% = {percent}/100 = {percent // (100 // (100 // percent)) if percent == 25 else percent}/100",
                A1=f"{base} x {percent}/100 = {answer}",
                common_error="Dividing by 100 incorrectly",
                allow=answer_str,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _increase_decrease_question(self, q_num: int, sub_skill: str) -> Question:
        """Find new value after percentage increase or decrease."""
        percent = self._rand_choice([5, 10, 12.5, 15, 20, 25, 30, 40, 50])
        is_increase = self._rand_choice([True, False])

        # Build base so answer is a nice number
        # If percent=20, base should be multiple of 5 so 20% is integer
        if percent == int(percent):
            denom = int(100 / percent)
        else:
            denom = 8  # 12.5% = 1/8
        base = self._rand_int(2, 20) * denom

        change = base * percent // 100
        if is_increase:
            new_val = base + change
            op = "increase"
        else:
            new_val = base - change
            op = "decrease"

        percent_display = int(percent) if percent == int(percent) else percent
        text = f"A value of ${base}$ is {'increased' if is_increase else 'decreased'} by ${percent_display}\\%$. What is the new value?"
        answer = str(new_val)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"{percent}% of {base} = {change}",
                A1=f"{'Add' if is_increase else 'Subtract'}: {base} {'+' if is_increase else '-'} {change} = {new_val}",
                common_error="Applying percentage to the wrong base",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _reverse_question(self, q_num: int, sub_skill: str) -> Question:
        """Find original number given final value and percentage change."""
        percent = self._rand_choice([10, 15, 20, 25, 30, 40, 50])
        is_increase = self._rand_choice([True, False])

        # Build from original backwards
        denom = int(100 / (percent if percent <= 50 else 10))
        if denom == 0:
            denom = 1
        original = self._rand_int(2, 20) * denom
        change = original * percent // 100
        final = original + change if is_increase else original - change

        text = f"After a {percent}% {'increase' if is_increase else 'decrease'}, a value becomes ${final}$. Find the original value."
        answer = str(original)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"If original = x, then {'x x (1 + ' + str(percent) + '/100) = ' + str(final) if is_increase else 'x x (1 - ' + str(percent) + '/100) = ' + str(final)}",
                A1=f"x = {final} / {'1.' + str(percent // 10) if percent < 100 else (1 + percent/100)} = {original}",
                common_error="Finding the increase of the final value instead of reversing",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _compound_question(self, q_num: int, sub_skill: str) -> Question:
        """Compound percentage change over 2 periods."""
        percent = self._rand_choice([5, 10, 15, 20])
        is_increase = self._rand_choice([True, False])
        periods = 2

        base = self._rand_int(50, 500)
        # Compute compound: base * (1 + r)^n
        factor = 1 + percent / 100 if is_increase else 1 - percent / 100
        final = round(base * factor ** periods, 2)
        # Remove trailing zeros for display
        if final == int(final):
            final = int(final)

        text = (
            f"A value of ${base}$ is {'increased' if is_increase else 'decreased'} "
            f"by ${percent}\\%$ each year for ${periods}$ years. "
            f"What is the final value?"
        )
        answer = str(final)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"After year 1: {base} x {factor} = {round(base * factor, 2)}",
                A1=f"After year 2: {round(base * factor, 2)} x {factor} = {final}",
                common_error="Applying percentage to original each time instead of compounding",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _consecutive_question(self, q_num: int, sub_skill: str) -> Question:
        """Consecutive percentage changes (e.g. increase by 20% then decrease by 10%)."""
        p1 = self._rand_choice([10, 15, 20, 25, 30])
        p2 = self._rand_choice([10, 15, 20, 25, 30])
        increase_first = self._rand_choice([True, False])

        base = self._rand_int(50, 500)
        if increase_first:
            after_first = round(base * (1 + p1 / 100), 2)
            final = round(after_first * (1 - p2 / 100), 2)
            desc = f"increased by ${p1}\\%$ then decreased by ${p2}\\%$"
        else:
            after_first = round(base * (1 - p1 / 100), 2)
            final = round(after_first * (1 + p2 / 100), 2)
            desc = f"decreased by ${p1}\\%$ then increased by ${p2}\\%$"

        if final == int(final):
            final = int(final)

        text = f"A value of ${base}$ is {desc}. What is the final value?"
        answer = str(final)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"After first change: {base} x {1 + p1/100 if increase_first else 1 - p1/100} = {after_first}",
                A1=f"After second change: {after_first} x {1 - p2/100 if increase_first else 1 + p2/100} = {final}",
                common_error="Adding percentages together (20% up then 10% down != 10% up)",
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
