"""Trigonometry generator.

Sub-skills:
- sohcahtoa: find a missing side or angle using SOH CAH TOA
- sine_rule: use the sine rule to find a side or angle
- cosine_rule: use the cosine rule to find a side or angle
- exact_trig: recall exact trig values (30, 45, 60 degrees)
- trig_graphs: identify properties of sine/cosine/tan graphs

Each answer is verified from the generated triangle/values.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class TrigonometryGenerator(BaseGenerator):
    generator_key = "trigonometry"
    topic_name = "Trigonometry"
    supported_sub_skills = [
        "sohcahtoa",
        "sine_rule",
        "cosine_rule",
        "exact_trig",
        "trig_graphs",
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
        if sub_skill == "sohcahtoa":
            return self._sohcahtoa_question(q_num, sub_skill)
        elif sub_skill == "sine_rule":
            return self._sine_rule_question(q_num, sub_skill)
        elif sub_skill == "cosine_rule":
            return self._cosine_rule_question(q_num, sub_skill)
        elif sub_skill == "exact_trig":
            return self._exact_trig_question(q_num, sub_skill)
        else:
            return self._trig_graphs_question(q_num, sub_skill)

    def _sohcahtoa_question(self, q_num: int, sub_skill: str) -> Question:
        """SOH CAH TOA — find a missing side or angle."""
        find_angle = self._rand_choice([True, False])

        # Use a 3-4-5, 5-12-13, or 8-15-17 triangle scaled
        triples = [(3, 4, 5), (5, 12, 13), (8, 15, 17)]
        raw = self._rand_choice(triples)
        a, b, c = int(raw[0]), int(raw[1]), int(raw[2])
        scale = self._rand_int(1, 3)
        a, b, c = a * scale, b * scale, c * scale

        # Pick which angle to use (not the right angle)
        which = self._rand_choice(["opposite", "adjacent"])

        if find_angle:
            # Give opposite and adjacent, find angle
            if which == "opposite":
                text = (
                    f"A right-angled triangle has opposite side ${a}\\,\\text{{cm}}$ "
                    f"and adjacent side ${b}\\,\\text{{cm}}$. "
                    f"Find the angle $\\theta$ (to 1 decimal place)."
                )
                angle_deg = math.degrees(math.atan(a / b))
                answer = f"${angle_deg:.1f}^{{\\circ}}$"
                m1 = f"tan(θ) = {a}/{b}"
                a1 = f"θ = {angle_deg:.1f}°"
            else:
                text = (
                    f"A right-angled triangle has adjacent side ${a}\\,\\text{{cm}}$ "
                    f"and opposite side ${b}\\,\\text{{cm}}$. "
                    f"Find the angle $\\theta$ (to 1 decimal place)."
                )
                angle_deg = math.degrees(math.atan(b / a))
                answer = f"${angle_deg:.1f}^{{\\circ}}$"
                m1 = f"tan(θ) = {b}/{a}"
                a1 = f"θ = {angle_deg:.1f}°"
        else:
            # Give an angle and one side, find another side
            angle_deg = self._rand_choice([30, 37, 45, 53, 60])
            angle_rad = math.radians(angle_deg)
            given_side = self._rand_choice([a, b, c])
            given_name = self._rand_choice(["opposite", "adjacent", "hypotenuse"])

            # Recalculate from the angle
            if given_name == "hypotenuse":
                hyp = given_side
                opp = round(hyp * math.sin(angle_rad), 1)
                adj = round(hyp * math.cos(angle_rad), 1)
                find_opp = self._rand_choice([True, False])
                if find_opp:
                    text = (
                        f"A right-angled triangle has hypotenuse ${hyp}\\,\\text{{cm}}$ "
                        f"and angle ${angle_deg}^{{\\circ}}$. Find the opposite side (to 1 d.p.)."
                    )
                    answer = f"${opp}\\,\\text{{cm}}$"
                else:
                    text = (
                        f"A right-angled triangle has hypotenuse ${hyp}\\,\\text{{cm}}$ "
                        f"and angle ${angle_deg}^{{\\circ}}$. Find the adjacent side (to 1 d.p.)."
                    )
                    answer = f"${adj}\\,\\text{{cm}}$"
                m1 = f"sin/cos {angle_deg}°"
                a1 = answer
            elif given_name == "opposite":
                opp = given_side
                hyp = round(opp / math.sin(angle_rad), 1)
                adj = round(opp / math.tan(angle_rad), 1)
                text = (
                    f"A right-angled triangle has opposite side ${opp}\\,\\text{{cm}}$ "
                    f"and angle ${angle_deg}^{{\\circ}}$. Find the hypotenuse (to 1 d.p.)."
                )
                answer = f"${hyp}\\,\\text{{cm}}$"
                m1 = f"sin {angle_deg}° = {opp}/hyp"
                a1 = answer
            else:
                adj = given_side
                hyp = round(adj / math.cos(angle_rad), 1)
                opp = round(adj * math.tan(angle_rad), 1)
                text = (
                    f"A right-angled triangle has adjacent side ${adj}\\,\\text{{cm}}$ "
                    f"and angle ${angle_deg}^{{\\circ}}$. Find the hypotenuse (to 1 d.p.)."
                )
                answer = f"${hyp}\\,\\text{{cm}}$"
                m1 = f"cos {angle_deg}° = {adj}/hyp"
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
                common_error="Using wrong trig ratio (sin vs cos vs tan)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _sine_rule_question(self, q_num: int, sub_skill: str) -> Question:
        """Sine rule: a/sin(A) = b/sin(B)."""
        # Build a non-right-angled triangle
        angle_A = self._rand_choice([30, 40, 50, 65, 75])
        angle_B = self._rand_choice([40, 50, 60, 70, 80])
        while angle_A + angle_B >= 170:
            angle_B = self._rand_choice([40, 50, 60])
        angle_C = 180 - angle_A - angle_B

        # Side a (opposite angle A)
        a = self._rand_int(5, 15)
        # Find b using sine rule: b = a * sin(B) / sin(A)
        b = round(a * math.sin(math.radians(angle_B)) / math.sin(math.radians(angle_A)), 1)

        find_side = self._rand_choice([True, False])
        if find_side:
            text = (
                f"In triangle ABC, angle A = ${angle_A}^{{\\circ}}$, angle B = ${angle_B}^{{\\circ}}$, "
                f"and side a = ${a}\\,\\text{{cm}}$. Find side b (to 1 d.p.)."
            )
            answer = f"${b}\\,\\text{{cm}}$"
            m1 = f"a/sin(A) = b/sin(B) → {a}/sin({angle_A}°) = b/sin({angle_B}°)"
            a1 = f"b = {b} cm"
        else:
            text = (
                f"In triangle ABC, angle A = ${angle_A}^{{\\circ}}$, angle C = ${angle_C}^{{\\circ}}$, "
                f"and side a = ${a}\\,\\text{{cm}}$. Find angle B."
            )
            answer = f"${angle_B}^{{\\circ}}$"
            m1 = f"Angles sum to 180°: B = 180 - {angle_A} - {angle_C}"
            a1 = f"B = {angle_B}°"

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
                common_error="Using sine rule when cosine rule needed (or vice versa)",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _cosine_rule_question(self, q_num: int, sub_skill: str) -> Question:
        """Cosine rule: c² = a² + b² - 2ab·cos(C)."""
        a = self._rand_int(5, 12)
        b = self._rand_int(5, 12)
        angle_C = self._rand_choice([40, 50, 60, 70, 80, 100, 120])

        c_squared = a**2 + b**2 - 2 * a * b * math.cos(math.radians(angle_C))
        c = round(math.sqrt(c_squared), 1)

        text = (
            f"In triangle ABC, side a = ${a}\\,\\text{{cm}}$, side b = ${b}\\,\\text{{cm}}$, "
            f"and angle C = ${angle_C}^{{\\circ}}$. Find side c (to 1 d.p.)."
        )
        answer = f"${c}\\,\\text{{cm}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=f"c² = {a}² + {b}² - 2({a})({b})cos({angle_C}°)",
                A1=f"c = {c} cm",
                common_error="Forgetting the minus sign in cosine rule",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _exact_trig_question(self, q_num: int, sub_skill: str) -> Question:
        """Recall exact trig values for 30°, 45°, 60°."""
        angle = self._rand_choice([30, 45, 60])
        func = self._rand_choice(["sin", "cos", "tan"])

        exact_values = {
            ("sin", 30): ("\\tfrac{1}{2}", "0.5"),
            ("sin", 45): ("\\tfrac{\\sqrt{2}}{2}", "\\frac{1}{\\sqrt{2}}"),
            ("sin", 60): ("\\tfrac{\\sqrt{3}}{2}", ""),
            ("cos", 30): ("\\tfrac{\\sqrt{3}}{2}", ""),
            ("cos", 45): ("\\tfrac{\\sqrt{2}}{2}", "\\frac{1}{\\sqrt{2}}"),
            ("cos", 60): ("\\tfrac{1}{2}", "0.5"),
            ("tan", 30): ("\\tfrac{\\sqrt{3}}{3}", "\\frac{1}{\\sqrt{3}}"),
            ("tan", 45): ("1", ""),
            ("tan", 60): ("\\sqrt{3}", ""),
        }

        latex_val, alt = exact_values[(func, angle)]

        text = f"Write down the exact value of ${func}({angle}^{{\\circ}})$."
        answer = f"${latex_val}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=1,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1="Recall exact value from standard triangles",
                A1=answer,
                common_error="Using calculator approximation instead of exact surd form",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _trig_graphs_question(self, q_num: int, sub_skill: str) -> Question:
        """Identify properties of sine/cosine/tan graphs."""
        func = self._rand_choice(["sin", "cos", "tan"])

        if func == "sin":
            text = "State the maximum value of $y = \\sin(x)$ and the smallest positive value of $x$ at which it occurs."
            answer = "$y = 1$ at $x = 90^{\\circ}$"
            m1 = "sin reaches max of 1"
            a1 = answer
        elif func == "cos":
            text = "State the $y$-intercept of the graph $y = \\cos(x)$ and the period of the function."
            answer = "$y$-intercept = $1$, period = $360^{\\circ}$"
            m1 = "cos(0) = 1, period is 360°"
            a1 = answer
        else:
            text = "State the equations of the asymptotes of $y = \\tan(x)$ between $-180^{\\circ}$ and $180^{\\circ}$."
            answer = "$x = -90^{\\circ}$ and $x = 90^{\\circ}$"
            m1 = "tan is undefined at ±90°"
            a1 = answer

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=1,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Confusing sin and cos properties",
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
