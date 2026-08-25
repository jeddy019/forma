"""Forma Deterministic Maths Engine — FastAPI application.

A private, Render-hosted service that generates verified mathematical
question data. It never generates HTML/PDFs, accesses Supabase, or
receives user credentials. Next.js is the only caller.
"""

import time
import uuid

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth import verify_token
from app.config import settings
from app.generators.registry import get_generator, list_generator_keys, match_topic_to_keys
from app.models import GenerationRequest, GenerationResponse

app = FastAPI(
    title="Forma Math Engine",
    version="1.0.0",
    description="Deterministic question generation for Forma worksheets",
)

# Lock CORS to the Next.js app only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://forma.app",
        "https://www.forma.app",
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0", "generators": list_generator_keys()}


@app.post("/generate", response_model=GenerationResponse)
async def generate(
    request: GenerationRequest,
    _token: str = Depends(verify_token),
):
    """Generate mathematical questions for a worksheet.

    Accepts curriculum context and topic, returns Forma-compatible
    question JSON that passes validateWorksheet() on the Next.js side.
    """
    request_id = str(uuid.uuid4())[:8]
    start = time.monotonic()

    # Match topic to generator(s)
    keys = match_topic_to_keys(request.topic)
    if not keys:
        raise HTTPException(
            status_code=400,
            detail=f"No generator found for topic: {request.topic}. "
            f"Available generators: {list_generator_keys()}",
        )

    # Use the first (best) match
    key = keys[0]
    generator = get_generator(
        key=key,
        curriculum=request.curriculum,
        locale=request.locale,
        difficulty=request.difficulty,
        year_level=request.year_level,
        seed=request.seed,
    )

    if generator is None:
        raise HTTPException(
            status_code=400,
            detail=f"Generator '{key}' exists but could not be instantiated.",
        )

    try:
        response = generator.generate(
            question_count=request.question_count,
            topic=request.topic,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed in generator '{key}': {str(e)}",
        )

    elapsed = time.monotonic() - start
    print(
        f"[{request_id}] Generated {len(response.questions)} questions "
        f"via {key} in {elapsed:.3f}s"
    )

    return response


@app.post("/generate/multi", response_model=list[GenerationResponse])
async def generate_multi(
    requests: list[GenerationRequest],
    _token: str = Depends(verify_token),
):
    """Generate questions for multiple topics in one call.

    Used when a worksheet mixes deterministic and AI-generated slots.
    Each request is processed independently.
    """
    results = []
    for req in requests:
        result = await generate(req, _token)
        results.append(result)
    return results


@app.get("/match")
async def match_topic(topic: str, _token: str = Depends(verify_token)):
    """Check which generator keys match a topic string.

    Used by the Next.js routing logic to decide deterministic vs AI slots.
    """
    keys = match_topic_to_keys(topic)
    return {
        "topic": topic,
        "matched_keys": keys,
        "is_deterministic": len(keys) > 0,
    }
