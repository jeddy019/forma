"""Shapes (area, perimeter, volume, angle properties, Pythagoras) generator.

Sub-skills:
- area: area of 2D shapes (rectangle, triangle, circle, trapezium)
- perimeter: perimeter of 2D shapes
- volume: volume of 3D shapes (cuboid, cylinder, triangular prism)
- angle_properties: angles on a straight line, in a triangle, at a point
- pythagoras: Pythagorean theorem problems

Each answer is verified from the generated dimensions.
"""

import math

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class ShapesGenerator(BaseGenerator):
    generator_key = "shapes"
    topic_name = "Shapes"
    supported_sub_skills = [
        "area",
        "perimeter",
        "volume",
        "angle_properties",
        "pythagoras",
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
        if sub_skill == "area":
            return self._area_question(q_num, sub_skill)
        elif sub_skill == "perimeter":
            return self._perimeter_question(q_num, sub_skill)
        elif sub_skill == "volume":
            return self._volume_question(q_num, sub_skill)
        elif sub_skill == "angle_properties":
            return self._angles_question(q_num, sub_skill)
        else:
            return self._pythagoras_question(q_num, sub_skill)

    def _area_question(self, q_num: int, sub_skill: str) -> Question:
        """Area of a 2D shape."""
        shape = self._rand_choice(["rectangle", "triangle", "circle", "trapezium"])

        if shape == "rectangle":
            w = self._rand_int(3, 15)
            h = self._rand_int(3, 15)
            answer = w * h
            text = f"Find the area of a rectangle with length ${w}\\,\\text{{cm}}$ and width ${h}\\,\\text{{cm}}$."
            m1 = "Area = length x width"
            a1 = f"${w} \\times {h} = {answer}\\,\\text{{cm}}^2$"
            diagram = self.make_triangle(
                vertices=[{"x": 0, "y": 0}, {"x": w, "y": 0}, {"x": w, "y": h}],
                labels=["", f"{w} cm", f"{h} cm"],
                angle_marks=[],
                side_lengths=[],
            )

        elif shape == "triangle":
            base = self._rand_int(4, 16)
            height = self._rand_int(3, 14)
            # Ensure integer area
            if (base * height) % 2 != 0:
                base += 1
            answer = base * height // 2
            text = f"Find the area of a triangle with base ${base}\\,\\text{{cm}}$ and perpendicular height ${height}\\,\\text{{cm}}$."
            m1 = "Area = 1/2 x base x height"
            a1 = f"$\\tfrac{{1}}{{2}} \\times {base} \\times {height} = {answer}\\,\\text{{cm}}^2$"
            diagram = self.make_right_angle(
                base=base, height=height, hyp=0,
                labelled="height",
            )

        elif shape == "circle":
            radius = self._rand_int(2, 12)
            # Area as multiple of pi
            area_num = radius ** 2
            answer = f"{area_num}\\pi"
            text = f"Find the area of a circle with radius ${radius}\\,\\text{{cm}}$. Give your answer in terms of $\\pi$."
            m1 = "Area = pi x r^2"
            a1 = f"$\\pi \\times {radius}^2 = {area_num}\\pi\\,\\text{{cm}}^2$"
            diagram = self.make_circle(
                radius=radius, label="O", angles=[], sectors=[],
            )

        else:  # trapezium
            a = self._rand_int(4, 12)
            b = self._rand_int(6, 16)
            h = self._rand_int(3, 10)
            area_val = (a + b) * h / 2
            answer = str(int(area_val)) if area_val == int(area_val) else str(area_val)
            text = (
                f"Find the area of a trapezium with parallel sides of length "
                f"${a}\\,\\text{{cm}}$ and ${b}\\,\\text{{cm}}$, and perpendicular height ${h}\\,\\text{{cm}}$."
            )
            m1 = "Area = (a + b) / 2 x h"
            a1 = f"$\\tfrac{{{a}+{b}}}{{2}} \\times {h} = {answer}\\,\\text{{cm}}^2$"
            diagram = None

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"${answer}\\,\\text{{cm}}^2$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Wrong formula or forgetting to halve for triangle",
                allow=f"${answer}\\,\\text{{cm}}^2$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _perimeter_question(self, q_num: int, sub_skill: str) -> Question:
        """Perimeter of a 2D shape."""
        shape = self._rand_choice(["rectangle", "triangle", "circle"])

        if shape == "rectangle":
            w = self._rand_int(3, 15)
            h = self._rand_int(3, 15)
            answer = 2 * (w + h)
            text = f"Find the perimeter of a rectangle with length ${w}\\,\\text{{cm}}$ and width ${h}\\,\\text{{cm}}$."
            m1 = "Perimeter = 2 x (length + width)"
            a1 = f"$2 \\times ({w} + {h}) = {answer}\\,\\text{{cm}}$"

        elif shape == "triangle":
            a = self._rand_int(5, 12)
            b = self._rand_int(5, 12)
            c = self._rand_int(5, 12)
            # Ensure triangle inequality
            while a + b <= c or a + c <= b or b + c <= a:
                c = self._rand_int(5, 12)
            answer = a + b + c
            text = f"Find the perimeter of a triangle with sides ${a}\\,\\text{{cm}}$, ${b}\\,\\text{{cm}}$, and ${c}\\,\\text{{cm}}$."
            m1 = "Perimeter = sum of all sides"
            a1 = f"${a} + {b} + {c} = {answer}\\,\\text{{cm}}$"

        else:  # circle
            radius = self._rand_int(2, 15)
            circumference = 2 * radius
            answer = f"{circumference}\\pi"
            text = f"Find the circumference of a circle with radius ${radius}\\,\\text{{cm}}$. Give your answer in terms of $\\pi$."
            m1 = "Circumference = 2 x pi x r"
            a1 = f"$2 \\times \\pi \\times {radius} = {circumference}\\pi\\,\\text{{cm}}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=None,
            working_lines=3,
            answer=f"${answer}\\,\\text{{cm}}$" if isinstance(answer, int) else f"${answer}\\,\\text{{cm}}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Wrong formula" if shape != "circle" else "Using pi x r instead of 2 x pi x r",
                allow=f"${answer}\\,\\text{{cm}}$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _volume_question(self, q_num: int, sub_skill: str) -> Question:
        """Volume of a 3D shape."""
        shape = self._rand_choice(["cuboid", "cylinder", "prism"])

        if shape == "cuboid":
            l = self._rand_int(3, 10)
            w = self._rand_int(3, 10)
            h = self._rand_int(3, 10)
            answer = l * w * h
            text = f"Find the volume of a cuboid with length ${l}\\,\\text{{cm}}$, width ${w}\\,\\text{{cm}}$, and height ${h}\\,\\text{{cm}}$."
            m1 = "Volume = length x width x height"
            a1 = f"${l} \\times {w} \\times {h} = {answer}\\,\\text{{cm}}^3$"

        elif shape == "cylinder":
            radius = self._rand_int(2, 8)
            height = self._rand_int(3, 12)
            volume_num = radius ** 2 * height
            answer = f"{volume_num}\\pi"
            text = (
                f"Find the volume of a cylinder with radius ${radius}\\,\\text{{cm}}$ "
                f"and height ${height}\\,\\text{{cm}}$. Give your answer in terms of $\\pi$."
            )
            m1 = "Volume = pi x r^2 x h"
            a1 = f"$\\pi \\times {radius}^2 \\times {height} = {volume_num}\\pi\\,\\text{{cm}}^3$"

        else:  # triangular prism
            base = self._rand_int(4, 10)
            height_tri = self._rand_int(3, 10)
            # Ensure cross-section area is integer
            if base * height_tri % 2 != 0:
                height_tri += 1
            length = self._rand_int(5, 12)
            cross_area = base * height_tri // 2
            volume = cross_area * length
            answer = str(int(volume)) if volume == int(volume) else str(volume)
            text = (
                f"Find the volume of a triangular prism. The triangular cross-section has base "
                f"${base}\\,\\text{{cm}}$ and perpendicular height ${height_tri}\\,\\text{{cm}}$. "
                f"The prism has length ${length}\\,\\text{{cm}}$."
            )
            m1 = "Volume = cross-section area x length"
            a1 = f"$\\tfrac{{1}}{{2}} \\times {base} \\times {height_tri} \\times {length} = {answer}\\,\\text{{cm}}^3$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=None,
            working_lines=4,
            answer=f"${answer}\\,\\text{{cm}}^3$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Forgetting to square radius for cylinder" if shape == "cylinder" else "Wrong formula",
                allow=f"${answer}\\,\\text{{cm}}^3$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _angles_question(self, q_num: int, sub_skill: str) -> Question:
        """Angles on a straight line, in a triangle, or at a point."""
        scenario = self._rand_choice(["straight_line", "triangle", "point"])

        if scenario == "straight_line":
            a = self._rand_int(30, 140)
            b = 180 - a
            text = f"Angles on a straight line are ${a}^{{\\circ}}$ and $x^{{\\circ}}$. Find $x$."
            answer = str(b)
            m1 = "Angles on a straight line sum to 180"
            a1 = f"$x = 180 - {a} = {b}$"

        elif scenario == "triangle":
            a = self._rand_int(40, 80)
            b = self._rand_int(40, 80)
            while a + b >= 170:
                b = self._rand_int(40, 80)
            c = 180 - a - b
            text = f"A triangle has angles ${a}^{{\\circ}}$ and ${b}^{{\\circ}}$. Find the third angle."
            answer = str(c)
            m1 = "Angles in a triangle sum to 180"
            a1 = f"$180 - {a} - {b} = {c}$"

        else:  # angles at a point
            a = self._rand_int(60, 150)
            b = self._rand_int(60, 150)
            while a + b >= 340:
                b = self._rand_int(60, 150)
            c = 360 - a - b
            text = f"Three angles at a point are ${a}^{{\\circ}}$, ${b}^{{\\circ}}$, and $x^{{\\circ}}$. Find $x$."
            answer = str(c)
            m1 = "Angles at a point sum to 360"
            a1 = f"$x = 360 - {a} - {b} = {c}$"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=1,
            diagram_spec=None,
            working_lines=2,
            answer=f"${answer}^{{\\circ}}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=f"${answer}^{{\\circ}}$",
                common_error="Wrong angle sum (180 vs 360)",
                allow=f"${answer}^{{\\circ}}$",
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _pythagoras_question(self, q_num: int, sub_skill: str) -> Question:
        """Pythagorean theorem - find hypotenuse or a side."""
        find_hyp = self._rand_choice([True, False])

        # Generate Pythagorean triple
        triples = [
            (3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25),
            (6, 8, 10), (9, 12, 15), (9, 40, 41), (11, 60, 61),
        ]
        raw = self._rand_choice(triples)
        a, b, c = int(raw[0]), int(raw[1]), int(raw[2])
        scale = self._rand_int(1, 3)
        a, b, c = a * scale, b * scale, c * scale

        if find_hyp:
            text = (
                f"A right-angled triangle has sides ${a}\\,\\text{{cm}}$ and ${b}\\,\\text{{cm}}$. "
                f"The longest side is the hypotenuse. Find the length of the hypotenuse."
            )
            answer = str(c)
            m1 = f"c^2 = {a}^2 + {b}^2 = {a**2} + {b**2} = {c**2}"
            a1 = f"$c = \\sqrt{{{c**2}}} = {c}\\,\\text{{cm}}$"
        else:
            text = (
                f"A right-angled triangle has hypotenuse ${c}\\,\\text{{cm}}$ and one side ${a}\\,\\text{{cm}}$. "
                f"Find the length of the other side."
            )
            answer = str(b)
            m1 = f"b^2 = {c}^2 - {a}^2 = {c**2} - {a**2} = {b**2}"
            a1 = f"$b = \\sqrt{{{b**2}}} = {b}\\,\\text{{cm}}$"

        diagram = self.make_right_angle(
            base=a, height=b if find_hyp else math.isqrt(c**2 - a**2),
            hyp=c, labelled="hypotenuse" if find_hyp else "side",
        )

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=2,
            diagram_spec=diagram,
            working_lines=3,
            answer=f"${answer}\\,\\text{{cm}}$",
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Adding instead of subtracting when finding a side",
                allow=f"${answer}\\,\\text{{cm}}$",
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
