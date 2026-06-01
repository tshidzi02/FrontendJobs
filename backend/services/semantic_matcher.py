# =============================================================================
# FILE: backend/services/semantic_matcher.py
# =============================================================================

from openai import OpenAI
import numpy as np

client = OpenAI()


def get_embedding(text):
    """Convert text into embedding vector using OpenAI model."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding


def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (
        np.linalg.norm(vec1) * np.linalg.norm(vec2)
    )


def semantic_match_score(job_description, cv_text):
    """Compute semantic similarity score between job and CV. Returns 0–100."""
    job_embedding = get_embedding(job_description)
    cv_embedding  = get_embedding(cv_text)
    similarity    = cosine_similarity(job_embedding, cv_embedding)
    return round(similarity * 100, 2)