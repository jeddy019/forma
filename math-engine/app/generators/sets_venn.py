"""Sets and Venn diagrams generator.

Sub-skills:
- set_notation: read/write union, intersection, complement
- venn_two: two-set Venn diagram problems (members, counts)
- venn_three: three-set Venn diagram problems
- subset_power: subsets and power sets

Each answer is verified from the generated sets.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class SetsVennGenerator(BaseGenerator):
    generator_key = "sets_venn"
    topic_name = "Sets and Venn Diagrams"
    supported_sub_skills = [
        "set_notation",
        "venn_two",
        "venn_three",
        "subset_power",
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
        if sub_skill == "set_notation":
            return self._notation_question(q_num, sub_skill)
        elif sub_skill == "venn_two":
            return self._venn_two_question(q_num, sub_skill)
        elif sub_skill == "venn_three":
            return self._venn_three_question(q_num, sub_skill)
        else:
            return self._subset_question(q_num, sub_skill)

    def _notation_question(self, q_num: int, sub_skill: str) -> Question:
        """Union, intersection, complement with number sets."""
        a = self._rand_int(1, 10)
        b = self._rand_int(1, 10)
        c = self._rand_int(a + 1, 20)

        # A = {1..a}, B = {a..c}
        set_a = set(range(1, a + 1))
        set_b = set(range(a, c + 1))
        union = set_a | set_b
        intersect = set_a & set_b

        op = self._rand_choice(["union", "intersect"])
        if op == "union":
            result = sorted(union)
            symbol = "\\cup"
            op_name = "union"
        else:
            result = sorted(intersect)
            symbol = "\\cap"
            op_name = "intersection"

        result_str = ", ".join(str(x) for x in result)
        text = (
            f"$A = \\{{1, 2, \\ldots, {a}\\}}$ and $B = \\{{{a}, {a+1}, \\ldots, {c}\\}}$. "
            f"List the elements of $A {symbol} B$."
        )
        answer = f"$\\{{{result_str}\\}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Identify elements in both sets",
                A1=answer,
                common_error="Confusing union (combine) with intersection (overlap)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _venn_two_question(self, q_num: int, sub_skill: str) -> Question:
        """Two-set Venn diagram counting problem."""
        # Universe of students, some like maths, some like science
        total = self._rand_int(20, 40)
        maths = self._rand_int(10, total - 5)
        science = self._rand_int(10, total - 5)
        both = self._rand_int(3, min(maths, science) - 1)
        maths_only = maths - both
        science_only = science - both
        neither = total - maths - science + both

        text = (
            f"In a class of {total} students: {maths} study Mathematics, "
            f"{science} study Science, and {both} study both subjects. "
            f"How many students study neither Mathematics nor Science?"
        )
        answer = str(neither)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Total = Maths only + Science only + Both + Neither",
                A1=f"{total} - {maths} - {science} + {both} = {neither}",
                common_error="Double-counting the 'both' group",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _venn_three_question(self, q_num: int, sub_skill: str) -> Question:
        """Three-set Venn diagram — fill in the regions."""
        # Simple: give the overlapping regions, find a missing one
        only_a = self._rand_int(3, 8)
        only_b = self._rand_int(3, 8)
        ab = self._rand_int(2, 5)
        bc = self._rand_int(2, 5)
        ac = self._rand_int(2, 5)
        abc = self._rand_int(1, 3)
        total = self._rand_int(30, 50)
        outside = total - only_a - only_b - ab - bc - ac - abc

        text = (
            f"30 students were surveyed about which sports they play: "
            f"Football (F), Tennis (T), and Cricket (C). The results are: "
            f"F only = {only_a}, T only = {only_b}, F and T but not C = {ab}, "
            f"T and C but not F = {bc}, F and C but not T = {ac}, "
            f"all three = {abc}, none = {outside}. "
            f"How many play Football?"
        )
        football = only_a + ab + ac + abc
        answer = str(football)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Add all regions containing F: F only + FT + FC + FTC",
                A1=f"{only_a} + {ab} + {ac} + {abc} = {football}",
                common_error="Double-counting the 'all three' region",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _subset_question(self, q_num: int, sub_skill: str) -> Question:
        """Subsets and power sets."""
        n = self._rand_int(2, 4)
        elements = list(range(1, n + 1))
        total_subsets = 2 ** n

        elements_str = ", ".join(str(x) for x in elements)
        text = (
            f"Set A has {n} elements: $A = \\{{{elements_str}\\}}$. "
            f"How many subsets does A have?"
        )
        answer = str(total_subsets)

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Number of subsets = 2^n = 2^{n}",
                A1=answer,
                common_error="Forgetting the empty set or the set itself",
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
