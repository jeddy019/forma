"""Pydantic models mirroring Forma's GeneratedWorksheet schema.

Every field matches the TypeScript interfaces in forma/src/lib/ai/schema.ts
exactly. The Python service returns data that must pass validateWorksheet()
on the Next.js side — these models are the source of truth for the contract.
"""

from pydantic import BaseModel, Field


class MarkScheme(BaseModel):
    M1: str = Field(description="Method mark description")
    A1: str = Field(description="Accuracy mark and acceptable alternatives")
    common_error: str = Field(description="What students typically get wrong")
    allow: str = Field(description="Equivalent acceptable forms")


class DiagramSpec(BaseModel):
    type: str = Field(
        description="coordinate_grid|triangle|bar_chart|number_line|circle|table|right_angle|pie_chart"
    )
    params: str = Field(
        description="JSON-encoded string of type-specific parameters"
    )


class QuestionPart(BaseModel):
    part_label: str | None = None
    text: str = Field(description="Question text, KaTeX math allowed via $...$")
    marks: int = Field(ge=1, le=20)
    diagram_spec: DiagramSpec | None = None
    working_lines: int = Field(ge=0, le=12)
    answer: str = Field(description="Correct answer")
    answer_format: str = Field(
        description="numerical|coordinates|true_false|multiple_choice|extended"
    )
    mark_scheme: MarkScheme


class Question(BaseModel):
    id: str = Field(pattern=r"^q\d+$")
    type: str = Field(description="warm-up|core|challenge")
    sub_skill: str = Field(min_length=1)
    parts: list[QuestionPart] = Field(min_length=1)


class GenerationResponse(BaseModel):
    subject: str = "Mathematics"
    topic: str
    curriculum: str = Field(
        description="KS2|KS3|GCSE|A-Level|Ontario Elementary|Ontario Secondary|US Common Core"
    )
    year_level: str
    difficulty_overall: str = Field(description="foundation|standard|higher")
    alignment_note: str
    questions: list[Question] = Field(min_length=1, max_length=10)


class GenerationRequest(BaseModel):
    curriculum: str
    locale: str = Field(description="england|canada_ontario|united_states")
    topic: str
    difficulty: str = Field(description="foundation|standard|higher")
    question_count: int = Field(ge=5, le=10, default=10)
    year_level: str = ""
    sub_skills: list[str] | None = None
    seed: int | None = None
