import json
from flask import Blueprint, request, jsonify
from llm import call_llm

scorer_bp = Blueprint('scorer', __name__)

SCORE_PROMPT = """You are a resume-job matching scorer. Compare the resume against the job description
and return a relevance score from 0 to 100.

Consider:
- Skill overlap (40% weight)
- Experience relevance (30% weight)
- Education match (15% weight)
- Project relevance (15% weight)

Return ONLY valid JSON (no markdown, no code fences):
{
  "score": 85,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill3"],
  "reasoning": "Brief explanation of the score"
}

RESUME:
{resume}

JOB DESCRIPTION:
{job_description}
"""


def heuristic_score(resume: dict, job_description: str) -> dict:
    resume_skills = [str(skill).strip() for skill in resume.get('skills', []) if str(skill).strip()]
    normalized_description = job_description.lower()

    matched_skills = [skill for skill in resume_skills if skill.lower() in normalized_description]
    missing_skills = []

    score = 35
    if resume_skills:
        overlap_ratio = len(matched_skills) / max(len(resume_skills), 1)
        score += round(overlap_ratio * 45)

    experience_blob = json.dumps(resume.get('experience', []), ensure_ascii=False).lower()
    project_blob = json.dumps(resume.get('projects', []), ensure_ascii=False).lower()
    if any(keyword in normalized_description for keyword in ['senior', 'lead', 'architect']):
        if any(keyword in experience_blob for keyword in ['lead', 'senior', 'architect']):
            score += 10
    else:
        score += 5

    if any(token in normalized_description for token in ['react', 'node', 'python', 'typescript', 'sql']):
        technical_hits = sum(
            1 for token in ['react', 'node', 'python', 'typescript', 'sql']
            if token in normalized_description and (token in experience_blob or token in project_blob)
        )
        score += min(technical_hits * 2, 10)

    score = max(0, min(score, 100))
    return {
        'score': score,
        'matchedSkills': matched_skills[:12],
        'missingSkills': missing_skills,
        'reasoning': 'Fallback heuristic score based on skill overlap and resume content.',
    }


def _clean_llm_json(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith('```'):
        cleaned = cleaned.split('\n', 1)[1]
    if cleaned.endswith('```'):
        cleaned = cleaned.rsplit('```', 1)[0]
    cleaned = cleaned.strip()

    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1 and end >= start:
        return cleaned[start:end + 1]
    return cleaned


@scorer_bp.route('/score-match', methods=['POST'])
def score_match():
    data = request.get_json()
    if not data or 'resume' not in data or 'jobDescription' not in data:
        return jsonify({'error': 'Both resume and jobDescription are required'}), 400

    try:
        prompt = SCORE_PROMPT.replace('{resume}', json.dumps(data['resume'], indent=2))
        prompt = prompt.replace('{job_description}', data['jobDescription'])

        try:
            result = call_llm(prompt)
            parsed = json.loads(_clean_llm_json(result))
            return jsonify(parsed)
        except Exception as exc:
            print(f'[scorer] Falling back to heuristic scoring: {exc}')
            return jsonify(heuristic_score(data['resume'], data['jobDescription']))

    except Exception as e:
        return jsonify({'error': str(e)}), 500
