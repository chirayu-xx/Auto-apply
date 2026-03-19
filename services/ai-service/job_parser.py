import json
from flask import Blueprint, request, jsonify
from llm import call_llm

job_bp = Blueprint('job', __name__)

PARSE_JOB_PROMPT = """You are a job description parser. Extract structured requirements from the following job description.
Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "title": "Job Title",
  "requiredSkills": ["skill1", "skill2"],
  "preferredSkills": ["skill1", "skill2"],
  "experienceLevel": "entry/mid/senior",
  "minYearsExperience": 0,
  "qualifications": ["qualification 1", "qualification 2"],
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "keywords": ["keyword1", "keyword2"]
}

Job description:
"""


@job_bp.route('/parse-job', methods=['POST'])
def parse_job():
    data = request.get_json()
    if not data or 'description' not in data:
        return jsonify({'error': 'Job description is required'}), 400

    try:
        result = call_llm(PARSE_JOB_PROMPT + data['description'])

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
