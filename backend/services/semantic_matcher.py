# =============================================================================
# FILE: backend/services/semantic_matcher.py
# =============================================================================
# PURPOSE: Measures how "semantically similar" a CV summary is to a job description.
#
#          KEYWORD MATCHING vs SEMANTIC MATCHING — what's the difference?
#
#          Keyword matching (in ats_analyzer.py) checks:
#            "Does the word 'python' appear in both the CV and the JD?"
#            Problem: "engineered scalable systems" and "built robust infrastructure"
#            mean the SAME thing but share ZERO keywords.
#
#          Semantic matching (this file) checks:
#            "Do these two texts MEAN similar things?"
#            It converts text into mathematical vectors (lists of numbers) that
#            capture MEANING. Similar meanings → vectors point in similar directions.
#            "engineered scalable systems" ≈ "built robust infrastructure"
#            → high similarity score, even without shared words.
#
#          This is much more powerful and accurate than keyword matching alone.
#          That's why it's weighted at 50% in the ATS score (the biggest weight).
#
# HOW IT FITS IN THE FLOW:
#   app.py (generate route):
#     1. Calls semantic_match_score(job_description, SUMMARY)
#        → THIS FILE sends BOTH texts to OpenAI Embeddings API
#        → Gets back two vectors (lists of ~1536 numbers each)
#        → Calculates cosine similarity between them
#        → Returns a score 0–100
#     2. That score is passed INTO analyze_ats() as semantic_score parameter
#        (semantic_matcher.py result feeds directly into ats_analyzer.py)
# =============================================================================


# =============================================================================
# SECTION 1: IMPORTS
# =============================================================================

from openai import OpenAI
# The official OpenAI Python client library.
# Used here to call the Embeddings API (not the Chat/Completions API).
# Embeddings API converts text → a list of numbers (a "vector").

import numpy as np
# NumPy = Numerical Python.
# The go-to library for mathematical operations on arrays and matrices.
# We use it here for:
#   - Converting Python lists to NumPy arrays (np.array())
#   - Dot product calculation (np.dot())
#   - Vector magnitude/norm calculation (np.linalg.norm())
# Install with: pip install numpy


# =============================================================================
# SECTION 2: CREATE OPENAI CLIENT
# =============================================================================

client = OpenAI()
# Creates the OpenAI client.
# Automatically reads OPENAI_API_KEY from environment variables.
# Same pattern as ai_engine.py — one client per module, reused for all requests.
# Note: This creates a SECOND OpenAI client (ai_engine.py also creates one).
# In a larger app, you'd share one client across modules, but this works fine here.


# =============================================================================
# SECTION 3: EMBEDDING FUNCTION
# =============================================================================

def get_embedding(text):
    """
    Convert text into embedding vector using OpenAI model.
    """
    # PURPOSE: Take any string of text and convert it to a vector (list of numbers)
    #          that represents its MEANING in mathematical space.
    #
    # What is an "embedding"?
    #   Imagine a 3D space where "cat", "dog", "pet" are close together
    #   and "car", "truck", "vehicle" are close together, but "cat" and "car" are far apart.
    #   Embeddings do this in ~1536 DIMENSIONS (not just 3).
    #   The more similar in meaning, the closer together the vectors.
    #
    # PARAMETER:
    #   text (str) - Any text: job description, CV summary, skill list, etc.
    #
    # RETURNS:
    #   A Python list of ~1536 floating point numbers.
    #   e.g. [0.0123, -0.0456, 0.0789, ..., -0.0321]  (1536 numbers total)

    response = client.embeddings.create(
        model="text-embedding-3-small",
        # OpenAI's embedding model.
        # "text-embedding-3-small" is:
        #   - Fast and cheap (much cheaper than GPT models per token)
        #   - High quality (1536 dimensions)
        #   - Good for semantic similarity tasks
        # Other option: "text-embedding-3-large" (3072 dimensions, more accurate, costs more)

        input=text
        # The text we want to embed.
        # OpenAI will process this text and return a vector representing its meaning.
    )
    # FLOW: HTTP request sent to OpenAI Embeddings API
    #       Server processes text → returns response object with the vector inside

    return response.data[0].embedding
    # Breaking this down:
    #   response         → the full API response object
    #   .data            → a list of embedding results (we only sent one text, so one result)
    #   [0]              → the first (and only) result
    #   .embedding       → the actual list of numbers (the vector)
    #
    # Returns: [0.0123, -0.0456, 0.0789, ..., -0.0321]
    # This list has exactly 1536 numbers for "text-embedding-3-small".


# =============================================================================
# SECTION 4: COSINE SIMILARITY FUNCTION
# =============================================================================

def cosine_similarity(vec1, vec2):
    """
    Compute cosine similarity between two vectors.
    """
    # PURPOSE: Given two vectors (lists of numbers), calculate HOW SIMILAR
    #          they are in terms of the ANGLE between them.
    #
    # Why COSINE similarity and not just comparing the numbers directly?
    #   Cosine similarity measures the ANGLE between two vectors, not their length.
    #   Two vectors can have very different magnitudes but point in the same
    #   direction → they're semantically similar.
    #   This makes it robust to text length differences.
    #
    # Formula: cos(θ) = (A · B) / (||A|| × ||B||)
    #   A · B    = dot product (sum of element-wise multiplications)
    #   ||A||    = magnitude (length) of vector A
    #   ||B||    = magnitude (length) of vector B
    #
    # Result range: -1.0 to 1.0
    #   1.0  = identical direction (same meaning)
    #   0.0  = perpendicular (completely unrelated meaning)
    #  -1.0  = opposite direction (opposite meaning)
    # For text, scores are typically 0.0 to 1.0.
    #
    # PARAMETERS:
    #   vec1 (list) - First embedding vector (e.g. from job description)
    #   vec2 (list) - Second embedding vector (e.g. from CV summary)
    #
    # RETURNS:
    #   A float between -1.0 and 1.0

    vec1 = np.array(vec1)
    # Convert the Python list [0.012, -0.045, ...] into a NumPy array.
    # NumPy arrays support mathematical operations that plain Python lists don't.
    # e.g. You can't do list1 * list2 in Python, but numpy_array1 * numpy_array2 works.

    vec2 = np.array(vec2)
    # Same conversion for the second vector.

    return np.dot(vec1, vec2) / (
        np.linalg.norm(vec1) * np.linalg.norm(vec2)
    )
    # This is the cosine similarity formula:
    #
    # np.dot(vec1, vec2):
    #   Computes the DOT PRODUCT of the two vectors.
    #   Dot product = sum of (vec1[i] * vec2[i]) for all i
    #   = vec1[0]*vec2[0] + vec1[1]*vec2[1] + ... + vec1[1535]*vec2[1535]
    #   This measures "how much do these vectors align element by element?"
    #
    # np.linalg.norm(vec1):
    #   Computes the MAGNITUDE (length) of vector 1.
    #   norm = sqrt(vec1[0]² + vec1[1]² + ... + vec1[1535]²)
    #   This normalizes for vector length so we only measure DIRECTION (meaning).
    #
    # np.linalg.norm(vec2):
    #   Same for vector 2.
    #
    # Dividing the dot product by the product of both magnitudes gives us
    # the cosine of the angle between the two vectors.
    # High value (close to 1.0) = vectors point in same direction = similar meaning.


# =============================================================================
# SECTION 5: MAIN SEMANTIC MATCH FUNCTION
# =============================================================================

def semantic_match_score(job_description, cv_text):
    """
    Compute semantic similarity score between job and CV.
    """
    # PURPOSE: The "public" function called from app.py.
    #          Orchestrates the embedding → similarity calculation pipeline
    #          and returns a clean percentage score.
    #
    # PARAMETERS:
    #   job_description (str) - The full job posting text
    #   cv_text         (str) - The AI-generated CV summary text
    #
    # RETURNS:
    #   A float from 0 to ~100 representing semantic similarity percentage.
    #   e.g. 78.42

    job_embedding = get_embedding(job_description)
    # ↑ JUMPS TO: get_embedding() function above (in this same file)
    # Calls OpenAI Embeddings API with the job description text.
    # Returns: [0.012, -0.045, 0.078, ...] — a list of 1536 numbers
    # FLOW: → OpenAI API call → vector returned here

    cv_embedding = get_embedding(cv_text)
    # ↑ JUMPS TO: get_embedding() function above again
    # Calls OpenAI Embeddings API with the CV summary text.
    # Returns: another list of 1536 numbers representing the CV's meaning.
    # FLOW: → second OpenAI API call → second vector returned here
    #
    # NOTE: This means semantic_match_score() makes TWO OpenAI API calls total.
    # Combined with the one call in ai_engine.py, the /api/generate route
    # makes THREE OpenAI API calls in total per CV generation.

    similarity = cosine_similarity(job_embedding, cv_embedding)
    # ↑ JUMPS TO: cosine_similarity() function above (in this same file)
    # Passes both vectors in, gets back a number between -1.0 and 1.0.
    # For real text comparisons, this will typically be 0.6 to 0.95.
    # e.g. similarity = 0.7842

    score = similarity * 100
    # Convert from decimal (0.0–1.0) to percentage (0–100).
    # e.g. 0.7842 * 100 = 78.42

    return round(score, 2)
    # Round to 2 decimal places for clean display.
    # e.g. 78.4200001 → 78.42
    # FLOW: Returns 78.42 → back to app.py
    #       app.py passes this score into analyze_ats() as the semantic_score parameter


