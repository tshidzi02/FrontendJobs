# =============================================================================
# FILE: backend/services/tools_ai.py  (NEW — Phase 7)
# =============================================================================
# Four AI-powered tools:
#   1. interview_prep     — generates Q&A pairs from job description + profile
#   2. linkedin_optimiser — rewrites LinkedIn summary aligned to role
#   3. salary_estimator   — estimates salary range with reasoning
#   4. skills_gap_report  — detailed breakdown of missing vs present skills
# =============================================================================

from openai import OpenAI
import json

client = OpenAI()


# =============================================================================
# 1. INTERVIEW PREP
# =============================================================================

def generate_interview_prep(job_description, profile):
    """
    Generate 50 interview Q&A pairs tailored to the job description and profile.
    Returns: { questions: [ { question, answer, category, difficulty }, ... ] }
    Categories: Behavioural | Technical | Situational | Role-Specific
    Difficulty: Easy | Medium | Hard
    """

    profile_summary = f"""
Name: {profile.get('name', '')}
Current Role: {profile.get('currentRole', '')}
Skills: {', '.join(profile.get('skills', []))}
Experience: {json.dumps(profile.get('experience', []))}
Education: {json.dumps(profile.get('education', []))}
"""

    prompt = f"""
You are an expert interview coach preparing a candidate for a job interview.

Generate exactly 50 interview questions with model answers based on the job description and candidate profile below.

Cover a mix of:
- Behavioural questions (STAR format answers)
- Technical questions (specific to required skills)
- Situational questions (hypothetical scenarios)
- Role-specific questions (industry/domain knowledge)

Return STRICT JSON only, no markdown, no preamble:
{{
  "questions": [
    {{
      "question": "...",
      "answer": "...",
      "category": "Behavioural|Technical|Situational|Role-Specific",
      "difficulty": "Easy|Medium|Hard"
    }}
  ]
}}

Candidate Profile:
{profile_summary}

Job Description:
{job_description}

Rules:
- Answers must be 3-5 sentences, specific and compelling
- Behavioural answers must follow STAR format (Situation, Task, Action, Result)
- Technical answers must be accurate and demonstrate depth
- Questions must be realistic — things an interviewer would actually ask
- Output valid JSON only
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7
    )

    raw = response.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end])


# =============================================================================
# 2. LINKEDIN BIO OPTIMISER
# =============================================================================

def optimise_linkedin_bio(job_description, profile, current_bio=""):
    """
    Generate 3 LinkedIn summary variations:
      - Professional & formal
      - Conversational & personable
      - Bold & achievement-focused
    Returns: { variations: [ { tone, summary, headline }, ... ] }
    """

    profile_summary = f"""
Name: {profile.get('name', '')}
Current Role: {profile.get('currentRole', '')}
Skills: {', '.join(profile.get('skills', []))}
Years of Experience: {len(profile.get('experience', []))} roles
Key Achievements: extracted from experience bullets
"""

    current_bio_section = f"\nCurrent LinkedIn Bio:\n{current_bio}" if current_bio else ""

    prompt = f"""
You are a professional LinkedIn profile writer and personal branding expert.

Generate 3 LinkedIn summary variations for this candidate, each with a different tone.
Also generate a punchy LinkedIn headline (under 220 characters) for each.

Tailor each summary to the target job description provided.

Return STRICT JSON only, no markdown, no preamble:
{{
  "variations": [
    {{
      "tone": "Professional",
      "headline": "...",
      "summary": "..."
    }},
    {{
      "tone": "Conversational",
      "headline": "...",
      "summary": "..."
    }},
    {{
      "tone": "Bold",
      "headline": "...",
      "summary": "..."
    }}
  ]
}}

Candidate Profile:
{profile_summary}
{current_bio_section}

Target Job Description:
{job_description}

Rules:
- Each summary must be 150-250 words
- Headlines must be under 220 characters and keyword-rich
- Use first person ("I" not "He/She")
- Include quantifiable achievements where possible
- Professional tone: formal, structured, authoritative
- Conversational tone: warm, human, approachable
- Bold tone: punchy, achievement-led, confident
- Output valid JSON only
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8
    )

    raw = response.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end])


# =============================================================================
# 3. SALARY ESTIMATOR
# =============================================================================

def estimate_salary(job_title, location, skills, experience_years, job_description=""):
    """
    Estimate salary range with market context.
    Returns: {
        role, location, currency,
        range_min, range_max, range_mid,
        junior_range, mid_range, senior_range,
        reasoning, market_factors, negotiation_tips
    }
    """

    prompt = f"""
You are a compensation analyst with deep knowledge of global tech salary data.

Estimate a realistic salary range for the following role and provide market context.

Job Title: {job_title}
Location: {location}
Key Skills: {', '.join(skills) if skills else 'Not specified'}
Years of Experience: {experience_years}
Job Description: {job_description[:1000] if job_description else 'Not provided'}

Return STRICT JSON only, no markdown, no preamble:
{{
  "role":            "exact role title",
  "location":        "city/country",
  "currency":        "ZAR|USD|GBP|EUR",
  "currency_symbol": "R|$|£|€",
  "range_min":       integer,
  "range_max":       integer,
  "range_mid":       integer,
  "period":          "monthly|annual",
  "junior_range":    {{ "min": integer, "max": integer, "label": "0-2 years" }},
  "mid_range":       {{ "min": integer, "max": integer, "label": "3-5 years" }},
  "senior_range":    {{ "min": integer, "max": integer, "label": "6+ years" }},
  "reasoning":       "2-3 sentences explaining the estimate",
  "market_factors":  ["factor 1", "factor 2", "factor 3"],
  "negotiation_tips": ["tip 1", "tip 2", "tip 3"],
  "high_demand_skills": ["skill 1", "skill 2"]
}}

Rules:
- Use the local currency for the given location (ZAR for South Africa, USD for US, etc.)
- Provide monthly figures for South Africa, annual for US/UK/EU
- Base estimates on real market data, not guesses
- Be specific — avoid vague ranges
- Output valid JSON only
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4
    )

    raw = response.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end])


# =============================================================================
# 4. SKILLS GAP REPORT
# =============================================================================

def generate_skills_gap(job_description, profile):
    """
    Detailed skills gap analysis comparing profile skills against job requirements.
    Returns: {
        match_score,
        present_skills:  [ { skill, relevance, proficiency_needed } ],
        missing_skills:  [ { skill, importance, how_to_learn, time_to_learn } ],
        nice_to_have:    [ { skill, benefit } ],
        priority_actions: [ string ],
        summary
    }
    """

    profile_skills = profile.get('skills', [])
    experience_text = json.dumps(profile.get('experience', []))

    prompt = f"""
You are a career development expert and technical recruiter.

Perform a detailed skills gap analysis comparing the candidate's profile against the job description.

Candidate Skills: {', '.join(profile_skills) if profile_skills else 'None listed'}
Candidate Experience: {experience_text[:2000]}

Job Description:
{job_description}

Return STRICT JSON only, no markdown, no preamble:
{{
  "match_score": integer 0-100,
  "summary": "2-3 sentence overall assessment",
  "present_skills": [
    {{
      "skill": "...",
      "relevance": "High|Medium|Low",
      "note": "how this skill applies to the role"
    }}
  ],
  "missing_skills": [
    {{
      "skill": "...",
      "importance": "Critical|Important|Nice-to-have",
      "how_to_learn": "specific resource or approach",
      "time_to_learn": "e.g. 2-4 weeks"
    }}
  ],
  "nice_to_have": [
    {{
      "skill": "...",
      "benefit": "why it would help"
    }}
  ],
  "priority_actions": [
    "Specific action 1",
    "Specific action 2",
    "Specific action 3"
  ]
}}

Rules:
- Be honest — if skills are genuinely missing, list them
- Order missing_skills by importance (Critical first)
- priority_actions must be concrete and actionable
- match_score should reflect realistic ATS/recruiter assessment
- Output valid JSON only
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5
    )

    raw = response.choices[0].message.content
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end   = raw.rfind("}") + 1
        return json.loads(raw[start:end])