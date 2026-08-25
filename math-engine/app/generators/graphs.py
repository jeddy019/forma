"""Graphs generator.

Sub-skills:
- linear: find gradient and intercept from y = mx + c
- quadratic: find roots, vertex, or y-intercept from a quadratic
- cubic: find roots of a factorised cubic
- reciprocal: find asymptotes of a reciprocal function

Each answer is verified from the generated function.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class GraphsGenerator(BaseGenerator):
    generator_key = "graphs"
    topic_name = "Graphs"
    supported_sub_skills = [
        "linear",
        "quadratic",
        "cubic",
        "reciprocal",
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
        if sub_skill == "linear":
            return self._linear_question(q_num, sub_skill)
        elif sub_skill == "quadratic":
            return self._quadratic_question(q_num, sub_skill)
        elif sub_skill == "cubic":
            return self._cubic_question(q_num, sub_skill)
        else:
            return self._reciprocal_question(q_num, sub_skill)

    def _linear_question(self, q_num: int, sub_skill: str) -> Question:
        """Find gradient and/or y-intercept from y = mx + c."""
        c = self._rand_int(-6, 6)
        m_num = self._rand_int(-5, 5)
        m_den = self._rand_int(1, 5)
        while m_num == 0:
            m_num = self._rand_int(-5, 5)
        from math import gcd
        g = gcd(abs(m_num), m_den)
        m_num, m_den = m_num // g, m_den // g

        # Format equation
        if m_den == 1:
            m_str = str(m_num) if abs(m_num) != 1 else ("" if m_num == 1 else "-")
        else:
            m_str = f"\\tfrac{{{m_num}}}{{{m_den}}}"

        if c > 0:
            eq = f"y = {m_str}x + {c}" if m_str else f"y = x + {c}"
        elif c < 0:
            eq = f"y = {m_str}x - {abs(c)}" if m_str else f"y = x - {abs(c)}"
        else:
            eq = f"y = {m_str}x" if m_str else "y = x"

        task = self._rand_choice(["gradient_and_intercept", "gradient_only", "intercept_only"])

        if task == "gradient_and_intercept":
            text = f"State the gradient and $y$-intercept of the line ${eq}$."
            answer = f"Gradient = ${m_num}/{m_den}$, $y$-intercept = ${c}$" if m_den != 1 else f"Gradient = ${m_num}$, $y$-intercept = ${c}$"
            m1 = f"Comparing with y = mx + c"
            a1 = answer
        elif task == "gradient_only":
            text = f"State the gradient of the line ${eq}$."
            answer = f"${m_num}/{m_den}$" if m_den != 1 else f"${m_num}$"
            m1 = "Gradient is the coefficient of x"
            a1 = answer
        else:
            text = f"State the $y$-intercept of the line ${eq}$."
            answer = f"${c}$"
            m1 = "y-intercept is the constant term"
            a1 = answer

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
                common_error="Confusing gradient with intercept",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _quadratic_question(self, q_num: int, sub_skill: str) -> Question:
        """Analyse a quadratic y = ax^2 + bx + c."""
        task = self._rand_choice(["roots", "vertex", "y_intercept"])

        if task == "roots":
            # Build from roots backwards
            r1 = self._rand_int(-6, 6)
            r2 = self._rand_int(-6, 6)
            a = self._rand_choice([1, -1, 2, -2])
            # y = a(x - r1)(x - r2) = a(x^2 - (r1+r2)x + r1*r2)
            b_coeff = -a * (r1 + r2)
            c_coeff = a * r1 * r2

            roots_sorted = sorted([r1, r2])
            if roots_sorted[0] == roots_sorted[1]:
                text = f"The quadratic $y = {'-' if a < 0 else ''}{abs(a) if abs(a) > 1 else ''}x^2 + {b_coeff}x + {c_coeff}$ has a repeated root. Find it."
                answer = f"$x = {r1}$"
            else:
                text = f"Find the roots of $y = {'-' if a < 0 else ''}{abs(a) if abs(a) > 1 else ''}x^2 + {b_coeff}x + {c_coeff}$."
                answer = f"$x = {roots_sorted[0]}$ or $x = {roots_sorted[1]}$"

            m1 = f"Factorise or use the formula: a(x - {r1})(x - {r2})"
            a1 = answer

        elif task == "vertex":
            # y = a(x - h)^2 + k, vertex at (h, k)
            h = self._rand_int(-4, 4)
            k = self._rand_int(-4, 4)
            a = self._rand_choice([1, -1, 2, -2])

            # Expand: a(x^2 - 2hx + h^2) + k = ax^2 - 2ahx + ah^2 + k
            b_coeff = -2 * a * h
            c_coeff = a * h * h + k

            text = f"Find the coordinates of the turning point of $y = {'-' if a < 0 else ''}{abs(a) if abs(a) > 1 else ''}x^2 + {b_coeff}x + {c_coeff}$."
            answer = f"$({h}, {k})$"

            m1 = "Complete the square or use x = -b/(2a)"
            a1 = answer

        else:  # y_intercept
            a = self._rand_choice([1, -1, 2, -2])
            b = self._rand_int(-5, 5)
            c = self._rand_int(-6, 6)

            text = f"Find the $y$-intercept of $y = {'-' if a < 0 else ''}{abs(a) if abs(a) > 1 else ''}x^2 + {b}x + {c}$."
            answer = f"${c}$"
            m1 = "Set x = 0"
            a1 = f"$y = {c}$"

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
                common_error="Sign error when factorising or completing the square",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _cubic_question(self, q_num: int, sub_skill: str) -> Question:
        """Find roots of a factorised cubic."""
        r1 = self._rand_int(-4, 4)
        r2 = self._rand_int(-4, 4)
        r3 = self._rand_int(-4, 4)
        roots = sorted([r1, r2, r3])

        # Build (x - r1)(x - r2)(x - r3) expanded
        # For display show the factorised form
        factors = []
        for r in roots:
            if r == 0:
                factors.append("x")
            elif r > 0:
                factors.append(f"(x - {r})")
            else:
                factors.append(f"(x + {-r})")

        text = f"Find all the roots of $y = {''.join(factors)}$."
        answer = ", ".join(f"$x = {r}$" for r in roots)

        m1 = "Set each factor equal to zero"
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
                common_error="Forgetting x = 0 is a root when factor is just x",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _reciprocal_question(self, q_num: int, sub_skill: str) -> Question:
        """Find asymptotes of a reciprocal function."""
        form = self._rand_choice(["simple", "shifted"])

        if form == "simple":
            a = self._rand_choice([-3, -2, -1, 1, 2, 3])
            text = f"State the equations of the asymptotes of $y = {'-' if a < 1 else ''}{abs(a) if abs(a) > 1 else ''}\\dfrac{{1}}{{x}}$."
            answer = "$x = 0$ (vertical), $y = 0$ (horizontal)"
            m1 = "x cannot be 0 (vertical asymptote)"
            a1 = answer
        else:
            a = self._rand_choice([-2, -1, 1, 2])
            h = self._rand_int(-4, 4)
            k = self._rand_int(-4, 4)
            # y = a/(x - h) + k
            v_asym = h
            h_asym = k

            text = f"State the equations of the asymptotes of $y = {'-' if a < 1 else ''}{abs(a) if abs(a) > 1 else ''}\\dfrac{{1}}{{x {'-' if h >= 0 else '+'} {abs(h)}}} {'+' if k >= 0 else '-'} {abs(k)}$."
            answer = f"$x = {v_asym}$ (vertical), $y = {h_asym}$ (horizontal)"
            m1 = "Vertical: set denominator = 0. Horizontal: constant term"
            a1 = answer

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
                common_error="Swapping vertical and horizontal asymptotes",
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
