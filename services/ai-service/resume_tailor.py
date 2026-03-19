import json
from flask import Blueprint, request, jsonify
from llm import call_llm

tailor_bp = Blueprint('tailor', __name__)

TAILOR_PROMPT = """You are a resume tailoring expert. Given a master resume and a job description,
create a tailored version of the resume that emphasizes relevant skills and experience.

CRITICAL RULES:
1. NEVER fabricate or invent experience, skills, or achievements
2. ONLY rephrase, reorder, or emphasize existing content from the master resume
3. Prioritize bullet points that match the job requirements
4. Use keywords from the job description where they genuinely apply
5. Keep all dates, company names, and factual information unchanged

Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "name": "<unchanged>",
  "email": "<unchanged>",
  "phone": "<unchanged>",
  "location": "<unchanged>",
  "skills": ["reordered skills prioritizing job-relevant ones"],
  "experience": [
    {
      "company": "<unchanged>",
      "role": "<unchanged>",
      "startDate": "<unchanged>",
      "endDate": "<unchanged>",
      "bullets": ["rephrased/reordered bullets emphasizing job-relevant achievements"]
    }
  ],
  "education": [{"<unchanged>"}],
  "projects": [
    {
      "name": "<unchanged>",
      "techStack": ["<unchanged>"],
      "bullets": ["rephrased to highlight job-relevant aspects"]
    }
  ],
  "highlightedSkills": ["skills that match the job description"],
  "matchScore": 85
}

MASTER RESUME:
{resume}

JOB DESCRIPTION:
{job_description}
"""


@tailor_bp.route('/tailor-resume', methods=['POST'])
def tailor_resume():
    data = request.get_json()
    if not data or 'resume' not in data or 'jobDescription' not in data:
        return jsonify({'error': 'Both resume and jobDescription are required'}), 400

    try:
        prompt = TAILOR_PROMPT.replace('{resume}', json.dumps(data['resume'], indent=2))
        prompt = prompt.replace('{job_description}', data['jobDescription'])

        result = call_llm(prompt)

        cleaned = result.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[1]
        if cleaned.endswith('```'):
            cleaned = cleaned.rsplit('```', 1)[0]
        cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
        return jsonify(parsed)

    except json.JSONDecodeError:
        return jsonify({'error': 'Failed to parse LLM response', 'raw': result}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
