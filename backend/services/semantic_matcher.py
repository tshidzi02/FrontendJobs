# =============================================================================
# FILE: backend/services/semantic_matcher.py
# =============================================================================

from openai import OpenAI
import math

client = OpenAI()


def get_embedding(text):
    """Convert text into embedding vector. Truncated to save memory."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text[:500]  # 500 chars is enough for semantic matching
    )
    return response.data[0].embedding


def cosine_similarity(vec1, vec2):
    """Pure Python cosine similarity — no numpy required."""
    dot   = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def semantic_match_score(job_description, cv_text):
    """Compute semantic similarity score between job and CV. Returns 0-100."""
    try:
        job_embedding = get_embedding(job_description)
        cv_embedding  = get_embedding(cv_text)
        similarity    = cosine_similarity(job_embedding, cv_embedding)
        return round(similarity * 100, 2)
    except Exception as e:
        print(f"[SemanticMatcher] Error: {e}")
        return 50.0  # fallback neutral score