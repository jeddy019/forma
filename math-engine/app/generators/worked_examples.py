"""Worked examples generator — the key pedagogical differentiator.

Instead of just asking questions, this generator produces a WORKED EXAMPLE
(step-by-step solution) followed by a SIMILAR PRACTICE QUESTION for the
student to try. This mirrors Dr Frost Maths and Cognito's approach.

Sub-skills map to existing generators but add worked example + practice pairs:
- linear_equations_wx: solve a linear equation (worked + practice)
- fractions_wx: add/subtract fractions (worked + practice)
- quadratic_wx: solve a quadratic (worked + practice)
- ratio_wx: share in a ratio (worked + practice)
- Pythagoras_wx: find hypotenuse (worked + practice)
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class WorkedExamplesGenerator(BaseGenerator):
    generator_key = "worked_examples"
    topic_name = "Worked Examples"
    supported_sub_skills = [
        "linear_equations_wx",
        "fractions_wx",
        "quadratic_wx",
        "ratio_wx",
        "pythagoras_wx",
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
        if sub_skill == "linear_equations_wx":
            return self._linear_wx(q_num, sub_skill)
        elif sub_skill == "fractions_wx":
            return self._fractions_wx(q_num, sub_skill)
        elif sub_skill == "quadratic_wx":
            return self._quadratic_wx(q_num, sub_skill)
        elif sub_skill == "ratio_wx":
            return self._ratio_wx(q_num, sub_skill)
        else:
            return self._pythagoras_wx(q_num, sub_skill)

    def _linear_wx(self, q_num: int, sub_skill: str) -> Question:
        """Worked example: solving a two-step linear equation."""
        # Worked example: 3x + 7 = 22
        a, b, c = 3, 7, 22
        x_val = (c - b) // a

        # Practice: similar but different numbers
        a2 = self._rand_int(2, 6)
        b2 = self._rand_int(3, 10)
        x2 = self._rand_int(2, 8)
        c2 = a2 * x2 + b2

        worked = (
            f"**Worked Example**\n\n"
            f"Solve $3x + 7 = 22$\n\n"
            f"Step 1: Subtract 7 from both sides: $3x = 22 - 7 = 15$\n\n"
            f"Step 2: Divide both sides by 3: $x = 15 \\div 3 = 5$\n\n"
            f"**Check:** $3 \\times 5 + 7 = 15 + 7 = 22$ ✓"
        )

        text = f"{worked}\n\n---\n\n**Now try this:** Solve ${a2}x + {b2} = {c2}$."
        answer = f"$x = {x2}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Step 1: {c2} - {b2} = {c2 - b2}. Step 2: {c2 - b2} / {a2}",
                A1=f"$x = {x2}$",
                common_error="Wrong order of operations (dividing before subtracting)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _fractions_wx(self, q_num: int, sub_skill: str) -> Question:
        """Worked example: adding fractions with different denominators."""
        # Worked example: 2/3 + 1/4
        n1, d1, n2, d2 = 2, 3, 1, 4
        lcd = 12
        ans_n = n1 * (lcd // d1) + n2 * (lcd // d2)

        # Practice: similar
        d1p = self._rand_choice([3, 4, 5, 6])
        d2p = self._rand_choice([4, 5, 6, 8])
        while d2p == d1p:
            d2p = self._rand_choice([4, 5, 6, 8])
        n1p = self._rand_int(1, d1p - 1)
        n2p = self._rand_int(1, d2p - 1)
        lcdp = d1p * d2p  # simplified for teaching
        ans_np = n1p * (lcdp // d1p) + n2p * (lcdp // d2p)

        worked = (
            f"**Worked Example**\n\n"
            f"Calculate $\\dfrac{{2}}{{3}} + \\dfrac{{1}}{{4}}$\n\n"
            f"Step 1: Find the lowest common denominator: LCM of 3 and 4 = 12\n\n"
            f"Step 2: Convert each fraction: "
            f"$\\dfrac{{2}}{{3}} = \\dfrac{{8}}{{12}}$, "
            f"$\\dfrac{{1}}{{4}} = \\dfrac{{3}}{{12}}$\n\n"
            f"Step 3: Add: $\\dfrac{{8}}{{12}} + \\dfrac{{3}}{{12}} = \\dfrac{{11}}{{12}}$"
        )

        text = f"{worked}\n\n---\n\n**Now try this:** Calculate $\\dfrac{{{n1p}}}{{{d1p}}} + \\dfrac{{{n2p}}}{{{d2p}}}$."
        answer = f"$\\dfrac{{{ans_np}}}{{{lcdp}}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Find LCM of {d1p} and {d2p} = {lcdp}",
                A1=answer,
                common_error="Adding denominators instead of finding common denominator",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _quadratic_wx(self, q_num: int, sub_skill: str) -> Question:
        """Worked example: factorising and solving a quadratic."""
        # Worked: x² + 5x + 6 = 0 → (x+2)(x+3) = 0
        r1, r2 = 2, 3

        # Practice: different roots
        pr1 = self._rand_int(1, 6)
        pr2 = self._rand_int(1, 6)
        b_val = pr1 + pr2
        c_val = pr1 * pr2

        worked = (
            f"**Worked Example**\n\n"
            f"Solve $x^2 + 5x + 6 = 0$\n\n"
            f"Step 1: Find two numbers that multiply to 6 and add to 5: 2 and 3\n\n"
            f"Step 2: Factorise: $(x + 2)(x + 3) = 0$\n\n"
            f"Step 3: Set each bracket to zero: $x = -2$ or $x = -3$"
        )

        text = f"{worked}\n\n---\n\n**Now try this:** Solve $x^2 + {b_val}x + {c_val} = 0$."
        answer = f"$x = -{pr1}$ or $x = -{pr2}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Factorise: find two numbers that multiply to {c_val} and add to {b_val}",
                A1=answer,
                common_error="Sign error in the brackets",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _ratio_wx(self, q_num: int, sub_skill: str) -> Question:
        """Worked example: sharing in a ratio."""
        # Worked: £60 in ratio 2:3
        total_w = 60
        a_w, b_w = 2, 3
        part_a_w = total_w * a_w // (a_w + b_w)
        part_b_w = total_w - part_a_w

        # Practice
        total = self._rand_int(20, 100)
        r1 = self._rand_int(1, 5)
        r2 = self._rand_int(1, 5)
        parts_total = r1 + r2
        part_a = total * r1 // parts_total
        part_b = total - part_a

        worked = (
            f"**Worked Example**\n\n"
            f"Share £60 in the ratio 2:3\n\n"
            f"Step 1: Total parts = 2 + 3 = 5\n\n"
            f"Step 2: One part = £60 ÷ 5 = £12\n\n"
            f"Step 3: First share = 2 × £12 = £24, Second share = 3 × £12 = £36\n\n"
            f"**Check:** £24 + £36 = £60 ✓"
        )

        text = f"{worked}\n\n---\n\n**Now try this:** Share £{total} in the ratio ${r1}:{r2}$."
        answer = f"£{part_a} and £{part_b}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"Total parts = {parts_total}. One part = {total}/{parts_total}",
                A1=answer,
                common_error="Dividing by the wrong number of parts",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _pythagoras_wx(self, q_num: int, sub_skill: str) -> Question:
        """Worked example: finding the hypotenuse."""
        # Worked: 3, 4, 5
        a_w, b_w, c_w = 3, 4, 5

        # Practice: 5, 12, 13 or 6, 8, 10
        triples = [(5, 12, 13), (6, 8, 10), (8, 15, 17)]
        raw = self._rand_choice(triples)
        ap, bp, cp = int(raw[0]), int(raw[1]), int(raw[2])

        worked = (
            f"**Worked Example**\n\n"
            f"A right-angled triangle has sides 3 cm and 4 cm. Find the hypotenuse.\n\n"
            f"Step 1: Use Pythagoras' theorem: $c^2 = a^2 + b^2$\n\n"
            f"Step 2: $c^2 = 3^2 + 4^2 = 9 + 16 = 25$\n\n"
            f"Step 3: $c = \\sqrt{{25}} = 5$ cm"
        )

        text = f"{worked}\n\n---\n\n**Now try this:** A right-angled triangle has sides ${ap}\\,\\text{{cm}}$ and ${bp}\\,\\text{{cm}}$. Find the hypotenuse."
        answer = f"${cp}\\,\\text{{cm}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"$c^2 = {ap}^2 + {bp}^2 = {ap**2} + {bp**2} = {cp**2}$",
                A1=f"$c = {cp}$ cm",
                common_error="Adding instead of square-rooting at the end",
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
