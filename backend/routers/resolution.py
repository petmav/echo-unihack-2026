"""
Resolution router: POST /resolution, GET /resolution/{message_id}

Handles "what helped" advice flow when users resolve issues.

PRIVACY CRITICAL:
- Resolution text goes through Anonymizer SLM 0.6B (same as thoughts)
- Stored verbatim after anonymization (NEVER paraphrased by AI)
- Misconstrued mental health advice is a real harm — we show verbatim only
"""

from fastapi import APIRouter, HTTPException, Depends

from models.resolution import ResolutionSubmit, ResolutionResponse

router = APIRouter(prefix="/resolution", tags=["resolution"])


@router.post("", response_model=dict)
async def submit_resolution(submission: ResolutionSubmit):
    """
    Submit "what helped" advice for a resolved thought.

    Flow:
    1. Receive resolution_text (may contain PII)
    2. Anonymize with SLM 0.6B (strip PII, preserve specificity)
    3. Store verbatim in Elasticsearch linked to message_id
    4. Return success confirmation

    PRIVACY: Raw resolution_text is anonymized immediately and never persisted.
    Anonymized version is stored verbatim and shown verbatim (NOT paraphrased).
    """
    # TODO: Implement resolution submission
    # 1. Call services.anonymiser.anonymize(submission.resolution_text)
    # 2. Call services.elastic.store_resolution(message_id, anonymized_text)
    # 3. Return {"success": True}

    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{message_id}", response_model=dict)
async def get_resolution(message_id: str):
    """
    Retrieve "what helped" advice for a specific thought.

    Returns anonymized resolution text verbatim, or 404 if no resolution exists.

    PRIVACY: Returns only anonymized resolution text, no user identifiers.
    """
    # TODO: Implement resolution retrieval
    # 1. Call services.elastic.get_resolution(message_id)
    # 2. If not found, raise HTTPException(404)
    # 3. Return {"resolution_text": text}

    raise HTTPException(status_code=501, detail="Not implemented")
