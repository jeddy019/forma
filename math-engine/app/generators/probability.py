"""Probability generator.

Sub-skills:
- single_event: probability of a single event (dice, cards, spinner)
- combined_events: probability of combined events (AND, OR, not)
- tree_diagrams: probability from a tree diagram (two-stage)
- experimental: probability from experimental data / relative frequency

Each answer is verified from the generated scenario.
"""

from math import gcd

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class ProbabilityGenerator(BaseGenerator):
    generator_key = "probability"
    topic_name = "Probability"
    supported_sub_skills = [
        "single_event",
        "combined_events",
        "tree_diagrams",
        "experimental",
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
        if sub_skill == "single_event":
            return self._single_event_question(q_num, sub_skill)
        elif sub_skill == "combined_events":
            return self._combined_events_question(q_num, sub_skill)
        elif sub_skill == "tree_diagrams":
            return self._tree_diagram_question(q_num, sub_skill)
        else:
            return self._experimental_question(q_num, sub_skill)

    @staticmethod
    def _frac(num: int, den: int) -> str:
        """Simplified LaTeX fraction."""
        g = gcd(abs(num), abs(den))
        n, d = num // g, den // g
        if d < 0:
            n, d = -n, -d
        if d == 1:
            return f"${n}$"
        return f"$\\tfrac{{{n}}}{{{d}}}$"

    def _single_event_question(self, q_num: int, sub_skill: str) -> Question:
        """Probability of a single event."""
        scenario = self._rand_choice(["dice", "cards", "spinner"])

        if scenario == "dice":
            target = self._rand_choice([6, "even", "odd", "multiple_of_3", "greater_than_4"])
            if isinstance(target, int):
                text = f"A fair six-sided die is rolled. What is the probability of getting a ${target}$?"
                answer = self._frac(1, 6)
                m1 = "1 outcome out of 6"
                a1 = self._frac(1, 6)
            elif target == "even":
                text = f"A fair six-sided die is rolled. What is the probability of getting an even number?"
                answer = self._frac(3, 6)
                m1 = "Even: 2, 4, 6 (3 outcomes)"
                a1 = self._frac(3, 6)
            elif target == "odd":
                text = f"A fair six-sided die is rolled. What is the probability of getting an odd number?"
                answer = self._frac(3, 6)
                m1 = "Odd: 1, 3, 5 (3 outcomes)"
                a1 = self._frac(3, 6)
            elif target == "multiple_of_3":
                text = f"A fair six-sided die is rolled. What is the probability of getting a multiple of 3?"
                answer = self._frac(2, 6)
                m1 = "Multiples of 3: 3, 6 (2 outcomes)"
                a1 = self._frac(2, 6)
            else:
                text = f"A fair six-sided die is rolled. What is the probability of getting a number greater than 4?"
                answer = self._frac(2, 6)
                m1 = "Greater than 4: 5, 6 (2 outcomes)"
                a1 = self._frac(2, 6)

        elif scenario == "cards":
            suit = self._rand_choice(["hearts", "diamonds", "clubs", "spades"])
            text = f"A card is drawn at random from a standard pack of 52 cards. What is the probability that it is a ${suit}$?"
            answer = self._frac(13, 52)
            m1 = f"13 {suit} in 52 cards"
            a1 = self._frac(13, 52)

        else:  # spinner
            n_sections = self._rand_choice([4, 5, 6, 8])
            colours = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "black"]
            sections = colours[:n_sections]
            target_colour = sections[0]
            n_target = self._rand_int(1, n_sections - 1)
            section_colours = [target_colour] * n_target
            for i in range(n_target, n_sections):
                section_colours.append(sections[i])

            text = (
                f"A spinner has {n_sections} equal sections coloured "
                f"{', '.join(section_colours)}. "
                f"What is the probability of spinning ${target_colour}$?"
            )
            answer = self._frac(n_target, n_sections)
            m1 = f"{n_target} {target_colour} sections out of {n_sections}"
            a1 = self._frac(n_target, n_sections)

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
                common_error="Wrong total count or not simplifying",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _combined_events_question(self, q_num: int, sub_skill: str) -> Question:
        """Probability of combined events (AND, OR, not)."""
        operation = self._rand_choice(["and", "or", "not"])

        n_outcomes = self._rand_choice([6, 8, 10, 12])
        target_a = self._rand_int(1, n_outcomes // 2)
        target_b = self._rand_int(n_outcomes // 2 + 1, n_outcomes)

        if operation == "and":
            # P(A and B) - impossible for single die, so use two independent events
            # Simpler: P(A) for two independent events
            # Actually let's do: picking from a bag
            n_total = self._rand_choice([8, 10, 12])
            n_red = self._rand_int(2, n_total // 2)
            n_blue = n_total - n_red

            # Pick two without replacement: P(both red)
            p_first = self._frac(n_red, n_total)
            p_second_num = n_red - 1
            p_second_den = n_total - 1
            combined_num = n_red * p_second_num
            combined_den = n_total * p_second_den

            text = (
                f"A bag contains {n_red} red balls and {n_blue} blue balls. "
                f"Two balls are drawn without replacement. "
                f"What is the probability that both are red?"
            )
            answer = self._frac(combined_num, combined_den)
            m1 = f"First: {n_red}/{n_total}. Second: {p_second_num}/{p_second_den}"
            a1 = self._frac(combined_num, combined_den)

        elif operation == "or":
            # P(A or B) = P(A) + P(B) - P(A and B)
            n_total = self._rand_choice([10, 12, 20])
            n_a = self._rand_int(2, n_total // 3)
            n_b = self._rand_int(2, n_total // 3)
            # Ensure A and B are mutually exclusive for simplicity
            text = (
                f"A bag contains {n_total} balls: {n_a} red, {n_b} blue, and {n_total - n_a - n_b} green. "
                f"One ball is drawn at random. What is the probability it is red or blue?"
            )
            p_num = n_a + n_b
            answer = self._frac(p_num, n_total)
            m1 = f"P(red or blue) = {n_a}/{n_total} + {n_b}/{n_total}"
            a1 = self._frac(p_num, n_total)
        else:  # not
            n_total = self._rand_choice([10, 12, 20])
            n_target = self._rand_int(2, n_total // 2)
            text = (
                f"A bag contains {n_total} balls: {n_target} red and {n_total - n_target} blue. "
                f"One ball is drawn at random. What is the probability it is NOT red?"
            )
            p_not = n_total - n_target
            answer = self._frac(p_not, n_total)
            m1 = f"P(not red) = 1 - {n_target}/{n_total}"
            a1 = self._frac(p_not, n_total)

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
                common_error="For 'and': not multiplying. For 'or': adding without subtracting overlap. For 'not': subtracting from wrong total",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _tree_diagram_question(self, q_num: int, sub_skill: str) -> Question:
        """Probability from a two-stage tree diagram."""
        # Two coin flips or two draws from a bag
        scenario = self._rand_choice(["coins", "bag"])

        if scenario == "coins":
            # P(same), P(different), P(at least one head), etc.
            target = self._rand_choice(["same", "different", "at_least_one_head", "both_heads"])
            if target == "same":
                text = "Two fair coins are flipped. What is the probability of getting the same result on both?"
                answer = self._frac(2, 4)
                m1 = "HH or TT: 2 out of 4"
                a1 = self._frac(2, 4)
            elif target == "different":
                text = "Two fair coins are flipped. What is the probability of getting one head and one tail?"
                answer = self._frac(2, 4)
                m1 = "HT or TH: 2 out of 4"
                a1 = self._frac(2, 4)
            elif target == "at_least_one_head":
                text = "Two fair coins are flipped. What is the probability of getting at least one head?"
                answer = self._frac(3, 4)
                m1 = "HH, HT, TH: 3 out of 4"
                a1 = self._frac(3, 4)
            else:
                text = "Two fair coins are flipped. What is the probability of getting two heads?"
                answer = self._frac(1, 4)
                m1 = "HH: 1 out of 4"
                a1 = self._frac(1, 4)
        else:
            # Two draws from a bag without replacement
            n_total = self._rand_choice([5, 6, 8])
            n_target = self._rand_int(1, n_total // 2)
            n_other = n_total - n_target

            text = (
                f"A bag contains {n_target} red balls and {n_other} blue balls ({n_total} total). "
                f"Two balls are drawn one after the other without replacement. "
                f"What is the probability that both are red?"
            )
            combined_num = n_target * (n_target - 1)
            combined_den = n_total * (n_total - 1)
            answer = self._frac(combined_num, combined_den)
            m1 = f"First: {n_target}/{n_total}. Second: {n_target - 1}/{n_total - 1}"
            a1 = self._frac(combined_num, combined_den)

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
                common_error="Forgetting to reduce denominator for second draw (with replacement vs without)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _experimental_question(self, q_num: int, sub_skill: str) -> Question:
        """Probability from experimental / relative frequency data."""
        n_trials = self._rand_choice([20, 30, 40, 50, 100])
        n_success = self._rand_int(1, n_trials - 1)

        text = (
            f"In {n_trials} trials, an event occurred {n_success} times. "
            f"Estimate the probability of the event."
        )
        answer = self._frac(n_success, n_trials)
        m1 = f"Relative frequency = {n_success}/{n_trials}"
        a1 = self._frac(n_success, n_trials)

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
                common_error="Using success/failure instead of success/total",
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
