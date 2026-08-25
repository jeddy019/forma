"""Vectors generator.

Sub-skills:
- vector_addition: add two column vectors
- vector_subtraction: subtract column vectors
- geometric_problems: find unknown vectors using geometric properties (parallels, midpoints)
- magnitude_direction: find the magnitude of a vector

Each answer is verified from the generated vectors.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class VectorsGenerator(BaseGenerator):
    generator_key = "vectors"
    topic_name = "Vectors"
    supported_sub_skills = [
        "vector_addition",
        "vector_subtraction",
        "geometric_problems",
        "magnitude_direction",
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
        if sub_skill == "vector_addition":
            return self._addition_question(q_num, sub_skill)
        elif sub_skill == "vector_subtraction":
            return self._subtraction_question(q_num, sub_skill)
        elif sub_skill == "geometric_problems":
            return self._geometric_question(q_num, sub_skill)
        else:
            return self._magnitude_question(q_num, sub_skill)

    def _addition_question(self, q_num: int, sub_skill: str) -> Question:
        """Add two column vectors."""
        a1, a2 = self._rand_int(-8, 8), self._rand_int(-8, 8)
        b1, b2 = self._rand_int(-8, 8), self._rand_int(-8, 8)
        r1, r2 = a1 + b1, a2 + b2

        text = (
            f"$\\mathbf{{a}} = \\begin{{pmatrix}} {a1} \\\\ {a2} \\end{{pmatrix}}$ "
            f"and $\\mathbf{{b}} = \\begin{{pmatrix}} {b1} \\\\ {b2} \\end{{pmatrix}}$. "
            f"Find $\\mathbf{{a}} + \\mathbf{{b}}$."
        )
        answer = f"$\\begin{{pmatrix}} {r1} \\\\ {r2} \\end{{pmatrix}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Add x-components: {a1} + {b1} = {r1}",
                A1=answer,
                common_error="Adding in wrong order or sign error",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _subtraction_question(self, q_num: int, sub_skill: str) -> Question:
        """Subtract two column vectors."""
        a1, a2 = self._rand_int(-8, 8), self._rand_int(-8, 8)
        b1, b2 = self._rand_int(-8, 8), self._rand_int(-8, 8)
        r1, r2 = a1 - b1, a2 - b2

        text = (
            f"$\\mathbf{{a}} = \\begin{{pmatrix}} {a1} \\\\ {a2} \\end{{pmatrix}}$ "
            f"and $\\mathbf{{b}} = \\begin{{pmatrix}} {b1} \\\\ {b2} \\end{{pmatrix}}$. "
            f"Find $\\mathbf{{a}} - \\mathbf{{b}}$."
        )
        answer = f"$\\begin{{pmatrix}} {r1} \\\\ {r2} \\end{{pmatrix}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Subtract x-components: {a1} - {b1} = {r1}",
                A1=answer,
                common_error="Subtracting in wrong order",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _geometric_question(self, q_num: int, sub_skill: str) -> Question:
        """Find unknown vectors using geometric properties."""
        # Triangle OAB with midpoint M
        a1, a2 = self._rand_int(2, 10), self._rand_int(2, 10)
        b1, b2 = self._rand_int(2, 10), self._rand_int(2, 10)

        # OA = a, OB = b. Find AB in terms of a and b.
        text = (
            f"In triangle OAB, $\\overrightarrow{{OA}} = \\mathbf{{a}}$ and "
            f"$\\overrightarrow{{OB}} = \\mathbf{{b}}$. "
            f"Express $\\overrightarrow{{AB}}$ in terms of $\\mathbf{{a}}$ and $\\mathbf{{b}}$."
        )
        answer = "$\\mathbf{b} - \\mathbf{a}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="AB = OB - OA (vector subtraction in geometry)",
                A1=answer,
                common_error="Writing a - b instead of b - a",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _magnitude_question(self, q_num: int, sub_skill: str) -> Question:
        """Find the magnitude of a vector."""
        x = self._rand_int(1, 12)
        y = self._rand_choice([3, 4, 5, 8, 9, 12])
        # Make it a Pythagorean triple for a clean answer
        triples = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (6, 8, 10)]
        raw = self._rand_choice(triples)
        x, y = int(raw[0]), int(raw[1])
        mag = int(raw[2])

        text = (
            f"Find the magnitude of $\\mathbf{{v}} = \\begin{{pmatrix}} {x} \\\\ {y} \\end{{pmatrix}}$."
        )
        answer = f"${mag}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"|v| = sqrt({x}^2 + {y}^2) = sqrt({x**2 + y**2})",
                A1=answer,
                common_error="Forgetting to square root at the end",
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
