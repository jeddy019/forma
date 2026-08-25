"""Statistics generator.

Sub-skills:
- mean_median_mode: find mean, median, or mode from a data set
- range_interquartile: find range or interquartile range
- frequency_table: find mean or median from a frequency table
- cumulative_frequency: find median or quartiles from cumulative frequency data

Each answer is verified from the generated data.
"""

from app.generators.base import BaseGenerator
from app.models import Question, QuestionPart, MarkScheme


class StatisticsGenerator(BaseGenerator):
    generator_key = "statistics"
    topic_name = "Statistics"
    supported_sub_skills = [
        "mean_median_mode",
        "range_interquartile",
        "frequency_table",
        "cumulative_frequency",
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
        if sub_skill == "mean_median_mode":
            return self._mean_median_mode_question(q_num, sub_skill)
        elif sub_skill == "range_interquartile":
            return self._range_iqr_question(q_num, sub_skill)
        elif sub_skill == "frequency_table":
            return self._frequency_table_question(q_num, sub_skill)
        else:
            return self._cumulative_frequency_question(q_num, sub_skill)

    def _mean_median_mode_question(self, q_num: int, sub_skill: str) -> Question:
        """Find mean, median, or mode from a list."""
        measure = self._rand_choice(["mean", "median", "mode"])

        if measure == "mean":
            # Generate data with a clean integer mean
            n = self._difficulty_range(4, 5, 6)
            target_mean = self._rand_int(5, 20)
            values = [self._rand_int(target_mean - 5, target_mean + 5) for _ in range(n - 1)]
            total_so_far = sum(values)
            last_val = target_mean * n - total_so_far
            values.append(last_val)
            # Ensure all values are reasonable positive integers
            if any(v < 1 for v in values):
                values = [v + abs(min(values)) + 1 for v in values]
                target_mean = sum(values) // n

            text = f"Find the mean of the data set: $\\{{{', '.join(str(v) for v in values)}\\}}$."
            answer = str(target_mean)
            m1 = f"Sum = {sum(values)}, n = {n}"
            a1 = f"Mean = {sum(values)} / {n} = {target_mean}"

        elif measure == "median":
            n = self._difficulty_range(5, 7, 9)
            values = sorted([self._rand_int(2, 30) for _ in range(n)])
            mid = n // 2
            median_val = values[mid]
            text = f"Find the median of: $\\{{{', '.join(str(v) for v in values)}\\}}$."
            answer = str(median_val)
            m1 = f"Ordered: {values}. Middle value (position {mid + 1})"
            a1 = f"Median = {median_val}"

        else:  # mode
            # Create a list with a clear mode
            mode_val = self._rand_int(3, 15)
            n = self._difficulty_range(5, 7, 9)
            values = [mode_val] * (n // 2 + 1)
            remaining = n - len(values)
            for _ in range(remaining):
                v = self._rand_int(1, 20)
                while v == mode_val:
                    v = self._rand_int(1, 20)
                values.append(v)
            # Shuffle
            shuffled = list(values)
            self.rng.shuffle(shuffled)

            text = f"Find the mode of: $\\{{{', '.join(str(v) for v in shuffled)}\\}}$."
            answer = str(mode_val)
            m1 = f"Count frequencies: {mode_val} appears {n // 2 + 1} times"
            a1 = f"Mode = {mode_val}"

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
                common_error="Calculation error" if measure == "mean" else "Not ordering for median" if measure == "median" else "Confusing mode with most common",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _range_iqr_question(self, q_num: int, sub_skill: str) -> Question:
        """Find range or interquartile range."""
        find_iqr = self._rand_choice([True, False])

        n = self._difficulty_range(7, 9, 11)
        values = sorted([self._rand_int(2, 40) for _ in range(n)])

        if find_iqr:
            q1_idx = n // 4
            q3_idx = 3 * n // 4
            q1 = values[q1_idx]
            q3 = values[q3_idx]
            iqr = q3 - q1
            text = (
                f"Find the interquartile range of: $\\{{{', '.join(str(v) for v in values)}\\}}$."
            )
            answer = str(iqr)
            m1 = f"Q1 = {q1} (position {q1_idx + 1}), Q3 = {q3} (position {q3_idx + 1})"
            a1 = f"IQR = {q3} - {q1} = {iqr}"
        else:
            data_range = values[-1] - values[0]
            text = f"Find the range of: $\\{{{', '.join(str(v) for v in values)}\\}}$."
            answer = str(data_range)
            m1 = f"Range = highest - lowest = {values[-1]} - {values[0]}"
            a1 = f"Range = {data_range}"

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
                common_error="Wrong quartile positions" if find_iqr else "Using highest value instead of subtracting",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _frequency_table_question(self, q_num: int, sub_skill: str) -> Question:
        """Find mean or median from a frequency table."""
        find_mean = self._rand_choice([True, False])

        # Generate a frequency table
        n_classes = self._difficulty_range(3, 4, 5)
        class_width = self._rand_choice([2, 5, 10])
        start = self._rand_int(0, 10) * class_width

        classes = []
        frequencies = []
        for i in range(n_classes):
            lower = start + i * class_width
            upper = lower + class_width
            classes.append((lower, upper))
            frequencies.append(self._rand_int(2, 8))

        total_freq = sum(frequencies)

        if find_mean:
            # Mean from frequency table: sum(f * x) / sum(f) where x is midpoint
            midpoints = [(c[0] + c[1]) / 2 for c in classes]
            fx_sum = sum(f * x for f, x in zip(frequencies, midpoints))
            mean_val = fx_sum / total_freq
            # Make it a clean number
            mean_val = round(mean_val, 1)

            table = self.make_table(
                headers=["Class", "Frequency"],
                rows=[[f"${c[0]} \\leq x < {c[1]}$", str(f)] for c, f in zip(classes, frequencies)],
            )

            text = f"The table shows grouped data. Find an estimate for the mean."
            answer = str(mean_val)
            m1 = f"Midpoints: {', '.join(str(x) for x in midpoints)}. Sum of f*x = {fx_sum}"
            a1 = f"Mean = {fx_sum} / {total_freq} = {mean_val}"
        else:
            # Median class
            median_pos = total_freq / 2
            cum_freq = 0
            median_class = classes[0]
            for i, f in enumerate(frequencies):
                cum_freq += f
                if cum_freq >= median_pos:
                    median_class = classes[i]
                    break

            table = self.make_table(
                headers=["Class", "Frequency"],
                rows=[[f"${c[0]} \\leq x < {c[1]}$", str(f)] for c, f in zip(classes, frequencies)],
            )

            text = f"The table shows grouped data. State the class interval containing the median."
            answer = f"${median_class[0]} \\leq x < {median_class[1]}$"
            m1 = f"Total frequency = {total_freq}. Median position = {total_freq / 2}"
            a1 = answer
            table = table  # used for diagram

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=table if find_mean else table,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Wrong midpoints" if find_mean else "Off-by-one in cumulative frequency",
                allow=answer,
            ),
        )
        return Question(
            id=f"q{q_num}",
            type=self._q_type(q_num),
            sub_skill=sub_skill,
            parts=[part],
        )

    def _cumulative_frequency_question(self, q_num: int, sub_skill: str) -> Question:
        """Find median or quartiles from cumulative frequency data."""
        find_median = self._rand_choice([True, False])

        # Generate cumulative frequency data
        n_classes = self._difficulty_range(4, 5, 6)
        class_width = self._rand_choice([5, 10])
        start = self._rand_int(0, 5) * class_width

        upper_bounds = [start + (i + 1) * class_width for i in range(n_classes)]
        freqs = [self._rand_int(3, 12) for _ in range(n_classes)]
        cum_freq = []
        running = 0
        for f in freqs:
            running += f
            cum_freq.append(running)

        total = cum_freq[-1]

        table = self.make_table(
            headers=["Upper bound", "Cumulative frequency"],
            rows=[[str(ub), str(cf)] for ub, cf in zip(upper_bounds, cum_freq)],
        )

        if find_median:
            median_pos = total / 2
            # Find which class the median falls in
            median_ub = upper_bounds[0]
            for i, cf in enumerate(cum_freq):
                if cf >= median_pos:
                    median_ub = upper_bounds[i]
                    break

            text = f"The table shows cumulative frequency data for {total} values. Find an estimate for the median."
            answer = str(median_ub)
            m1 = f"Median position = {total}/2 = {median_pos}"
            a1 = f"Median is in the class ending at {median_ub}"
        else:
            q1_pos = total / 4
            q3_pos = 3 * total / 4

            q1_ub = upper_bounds[0]
            q3_ub = upper_bounds[0]
            for i, cf in enumerate(cum_freq):
                if cf >= q1_pos:
                    q1_ub = upper_bounds[i]
                    break
            for i, cf in enumerate(cum_freq):
                if cf >= q3_pos:
                    q3_ub = upper_bounds[i]
                    break

            iqr = q3_ub - q1_ub
            text = f"The table shows cumulative frequency data for {total} values. Find the interquartile range."
            answer = str(iqr)
            m1 = f"Q1 position = {q1_pos}, Q3 position = {q3_pos}"
            a1 = f"Q1 class ends at {q1_ub}, Q3 class ends at {q3_ub}. IQR = {iqr}"

        part = QuestionPart(
            part_label=None,
            text=text,
            marks=3,
            diagram_spec=table,
            working_lines=4,
            answer=answer,
            answer_format="numerical",
            mark_scheme=MarkScheme(
                M1=m1,
                A1=a1,
                common_error="Wrong position formula" if find_median else "Wrong quartile positions",
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
