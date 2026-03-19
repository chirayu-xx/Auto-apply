import io
import json
import re
from flask import Blueprint, request, jsonify
from PyPDF2 import PdfReader
from llm import call_llm

try:
  import pdfplumber
except Exception:
  pdfplumber = None

resume_bp = Blueprint('resume', __name__)

PARSE_PROMPT = """You are a resume parser. Extract structured data from the following resume text.
Return ONLY valid JSON with this exact structure (no markdown, no code fences):
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "phone number",
  "location": "city, state/country",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "startDate": "Mon YYYY",
      "endDate": "Mon YYYY or Present",
      "bullets": ["achievement 1", "achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Type",
      "field": "Field of Study",
      "graduationDate": "Mon YYYY"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "techStack": ["tech1", "tech2"],
      "bullets": ["description 1"]
    }
  ]
}

Resume text:
"""


SECTION_HEADERS = {
  'skills': ['skills', 'technical skills', 'core competencies', 'technologies'],
  'experience': ['experience', 'work experience', 'professional experience', 'employment'],
  'education': ['education', 'academic background', 'academics'],
  'projects': ['projects', 'personal projects', 'key projects'],
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


def _normalize_space(value: str) -> str:
  return re.sub(r'\s+', ' ', value).strip()


def _clean_token(token: str) -> str:
  token = re.sub(r'^[^A-Za-z0-9+#./-]+|[^A-Za-z0-9+#./-]+$', '', token)
  token = token.replace('’', "'")
  return _normalize_space(token)


def _repair_split_words(line: str) -> str:
  line = re.sub(r'\s+', ' ', line).strip()
  if not line:
    return ''

  tokens = line.split(' ')
  repaired: list[str] = []
  index = 0
  while index < len(tokens):
    current = tokens[index]
    if index + 1 < len(tokens):
      nxt = tokens[index + 1]
      if (
        current.isalpha()
        and nxt.isalpha()
        and len(current) >= 4
        and len(nxt) <= 3
      ):
        repaired.append(current + nxt)
        index += 2
        continue
      if (
        current.isalpha()
        and nxt.isalpha()
        and len(current) == 1
        and len(nxt) >= 3
      ):
        repaired.append(current + nxt)
        index += 2
        continue
    repaired.append(current)
    index += 1

  line = ' '.join(repaired)
  line = re.sub(r'\s*([,:;|])\s*', r' \1 ', line)
  line = re.sub(r'\s+', ' ', line)
  return line.strip()


def _normalize_text(text: str) -> str:
  normalized_lines = []
  for raw_line in text.splitlines():
    line = _repair_split_words(raw_line)
    line = line.replace('•', ' • ')
    line = re.sub(r'\s+', ' ', line).strip()
    if line:
      normalized_lines.append(line)
  return '\n'.join(normalized_lines)


def _extract_text_with_pypdf(pdf_bytes: bytes) -> str:
  reader = PdfReader(io.BytesIO(pdf_bytes))
  pages = [page.extract_text() or '' for page in reader.pages]
  return '\n'.join(pages)


def _extract_text_with_pdfplumber(pdf_bytes: bytes) -> str:
  if pdfplumber is None:
    return ''

  pages: list[str] = []
  with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
    for page in pdf.pages:
      pages.append(page.extract_text(x_tolerance=2, y_tolerance=3) or '')
  return '\n'.join(pages)


def _text_quality_score(text: str) -> int:
  if not text.strip():
    return -1

  lines = [line for line in text.splitlines() if line.strip()]
  score = len(lines)
  score += 15 if _find_email(text) else 0
  score += 10 if _find_phone(text) else 0
  score += 5 if any(header in text.lower() for header in ['experience', 'education', 'skills', 'projects']) else 0
  score -= len(re.findall(r'\b[A-Za-z]{1,2}\b', text))
  score -= len(re.findall(r'\b\w+\s+[A-Za-z]{1,2}\b', text))
  return score


def _extract_resume_text(pdf_bytes: bytes) -> str:
  pdfplumber_text = _normalize_text(_extract_text_with_pdfplumber(pdf_bytes))
  pypdf_text = _normalize_text(_extract_text_with_pypdf(pdf_bytes))

  if pdfplumber_text.strip():
    return pdfplumber_text

  return pypdf_text


def _split_lines(text: str) -> list[str]:
  return [line.strip() for line in text.splitlines() if line.strip()]


def _find_name(lines: list[str]) -> str:
  for line in lines[:8]:
    if '@' in line or len(line.split()) < 2:
      continue
    if re.search(r'https?://|linkedin|github|portfolio', line, re.IGNORECASE):
      continue
    if re.fullmatch(r'[A-Za-z][A-Za-z\s\.-]{2,60}', line):
      return _normalize_space(line)
  return ''


def _find_email(text: str) -> str:
  match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
  return match.group(0) if match else ''


def _find_phone(text: str) -> str:
  match = re.search(r'(?:\+?\d[\d\s().-]{8,}\d)', text)
  return _normalize_space(match.group(0)) if match else ''


def _find_location(lines: list[str]) -> str:
  for line in lines[:6]:
    if '@' in line:
      continue
    if '|' in line or re.search(r'\b(?:19|20)\d{2}\b', line):
      continue
    if line.upper() in {'TECHNICAL SKILLS', 'WORK EXPERIENCE', 'PROJECTS', 'EDUCATION'}:
      continue
    if re.search(r'\b(?:india|usa|united states|remote|bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|noida|gurgaon|gurugram|ahmedabad|chandigarh)\b', line, re.IGNORECASE):
      cleaned = re.sub(r'\b(?:email|phone|mobile|linkedin|github)\b.*$', '', line, flags=re.IGNORECASE).strip(' ,|-')
      return _normalize_space(cleaned)
  return ''


def _extract_section(lines: list[str], section_name: str) -> list[str]:
  headers = SECTION_HEADERS[section_name]
  start_index = None
  for index, line in enumerate(lines):
    normalized = line.lower().strip(':')
    if normalized in headers:
      start_index = index + 1
      break

  if start_index is None:
    return []

  values: list[str] = []
  all_headers = {header for names in SECTION_HEADERS.values() for header in names}
  for line in lines[start_index:]:
    normalized = line.lower().strip(':')
    if normalized in all_headers:
      break
    values.append(line)
  return values


def _parse_skills(lines: list[str], text: str) -> list[str]:
  section_lines = _extract_section(lines, 'skills')
  raw_values = section_lines or []

  if not raw_values:
    inline_match = re.search(r'(?:skills|technical skills)\s*[:\-]\s*(.+)', text, re.IGNORECASE)
    if inline_match:
      raw_values = [inline_match.group(1)]

  category_labels = {
    'languages', 'language', 'frontend', 'backend', 'frameworks', 'framework',
    'databases', 'database', 'cloud', 'tools', 'tooling', 'messaging', 'devops',
    'platforms', 'technologies', 'technology', 'apis'
  }
  allowed_short_tokens = {'c', 'c++', 'c#', 'go', 'r'}
  skills: list[str] = []
  for value in raw_values:
    cleaned_value = re.sub(r'\b(?:skills|technical skills)\b\s*:?\s*', '', value, flags=re.IGNORECASE)
    if ':' in cleaned_value:
      cleaned_value = cleaned_value.split(':', 1)[1]
    for part in re.split(r'[,|/•]', cleaned_value):
      candidate = _clean_token(part)
      normalized = candidate.lower().strip(':')
      if normalized.endswith(':'):
        normalized = normalized[:-1]
      if (
        candidate
        and normalized not in {'skills', 'technical skills', '&'}
        and normalized not in category_labels
        and (len(normalized) > 2 or normalized in allowed_short_tokens)
      ):
        skills.append(candidate)

  deduped: list[str] = []
  seen: set[str] = set()
  for skill in skills:
    key = skill.lower()
    if key not in seen:
      seen.add(key)
      deduped.append(skill)
  return deduped[:25]


def _parse_bullets(section_lines: list[str]) -> list[str]:
  bullets: list[str] = []
  for line in section_lines:
    cleaned = re.sub(r'^[\-•*]+\s*', '', line).strip()
    cleaned = _repair_split_words(cleaned)
    cleaned = re.sub(r'^[|:;,.-]+|[|:;,.-]+$', '', cleaned).strip()
    if cleaned and len(cleaned) > 2:
      bullets.append(cleaned)
  return bullets[:6]


def _parse_education(lines: list[str]) -> list[dict]:
  education_lines = _extract_section(lines, 'education')
  if not education_lines:
    return []

  primary_line = _repair_split_words(education_lines[0])
  primary_line = re.sub(r'\s+', ' ', primary_line)
  date_match = re.search(r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2}\s*[–-]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2}))', primary_line, re.IGNORECASE)
  line_without_dates = primary_line.replace(date_match.group(1), '').strip() if date_match else primary_line
  joined = line_without_dates
  institution_match = re.search(
    r'([A-Za-z][A-Za-z\s,&-]{2,}(?:University|College|Institute|School))',
    line_without_dates,
    re.IGNORECASE,
  )
  degree_match = re.search(
    r'\b(?:b\.?(?:tech|e)|m\.?(?:tech|e|s)|bachelor(?:s)?|master(?:s)?|bca|mca|mba|phd)\b[^,\n]*',
    joined,
    re.IGNORECASE,
  )
  year_match = re.search(r'\b(?:19|20)\d{2}\b', joined)

  institution = institution_match.group(1) if institution_match else line_without_dates.split('|')[0]
  institution = _repair_split_words(_normalize_space(institution))
  degree = _repair_split_words(_normalize_space(degree_match.group(0))) if degree_match else ''
  graduation = date_match.group(1) if date_match else (year_match.group(0) if year_match else '')

  return [{
    'institution': institution,
    'degree': degree,
    'field': '',
    'graduationDate': graduation,
  }]


def _parse_experience(lines: list[str]) -> list[dict]:
  experience_lines = _extract_section(lines, 'experience')
  if not experience_lines:
    return []

  entries: list[dict] = []
  current: dict | None = None

  for line in experience_lines:
    cleaned_line = _repair_split_words(line)
    date_match = re.search(
      r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2}\s*[–-]\s*(?:Present|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)?\s*(?:19|20)\d{2}))',
      cleaned_line,
      re.IGNORECASE,
    )
    is_header = '|' in cleaned_line and date_match is not None

    if is_header:
      if current:
        current['bullets'] = _parse_bullets(current['bullets'])
        entries.append(current)

      headline = cleaned_line.replace(date_match.group(1), '').strip(' |-')
      parts = [part.strip() for part in headline.split('|') if part.strip()]
      company = parts[0] if parts else ''
      role = parts[1] if len(parts) > 1 else headline
      date_parts = re.split(r'\s*[–-]\s*', date_match.group(1), maxsplit=1)
      current = {
        'company': company,
        'role': role,
        'startDate': date_parts[0] if date_parts else '',
        'endDate': date_parts[1] if len(date_parts) > 1 else '',
        'bullets': [],
      }
      continue

    if current:
      current['bullets'].append(cleaned_line)

  if current:
    current['bullets'] = _parse_bullets(current['bullets'])
    entries.append(current)

  return entries[:4]


def _parse_projects(lines: list[str]) -> list[dict]:
  project_lines = _extract_section(lines, 'projects')
  if not project_lines:
    return []

  entries: list[dict] = []
  current: dict | None = None

  for line in project_lines:
    cleaned_line = _repair_split_words(line)
    is_header = '|' in cleaned_line and not cleaned_line.startswith('•')

    if is_header:
      if current:
        current['bullets'] = _parse_bullets(current['bullets'])
        entries.append(current)

      name_part, tech_part = [part.strip() for part in cleaned_line.split('|', maxsplit=1)]
      tech_stack = [
        _clean_token(part)
        for part in re.split(r'[,/]', tech_part)
        if _clean_token(part)
      ]
      current = {
        'name': name_part,
        'techStack': tech_stack[:8],
        'bullets': [],
      }
      continue

    if current:
      current['bullets'].append(cleaned_line)

  if current:
    current['bullets'] = _parse_bullets(current['bullets'])
    entries.append(current)

  return entries[:4]


def heuristic_parse_resume(text: str) -> dict:
  lines = _split_lines(text)
  return {
    'name': _find_name(lines),
    'email': _find_email(text),
    'phone': _find_phone(text),
    'location': _find_location(lines),
    'skills': _parse_skills(lines, text),
    'experience': _parse_experience(lines),
    'education': _parse_education(lines),
    'projects': _parse_projects(lines),
  }


def _ensure_resume_shape(parsed: dict) -> dict:
  return {
    'name': parsed.get('name', ''),
    'email': parsed.get('email', ''),
    'phone': parsed.get('phone', ''),
    'location': parsed.get('location', ''),
    'skills': parsed.get('skills', []),
    'experience': parsed.get('experience', []),
    'education': parsed.get('education', []),
    'projects': parsed.get('projects', []),
  }


@resume_bp.route('/parse-resume', methods=['POST'])
def parse_resume():
  if 'file' not in request.files:
    return jsonify({'error': 'No file provided'}), 400

  file = request.files['file']
  if not file.filename or not file.filename.lower().endswith('.pdf'):
    return jsonify({'error': 'Only PDF files are supported'}), 400

  try:
    pdf_bytes = file.read()
    text = _extract_resume_text(pdf_bytes)

    if not text.strip():
      return jsonify({'error': 'Could not extract text from PDF'}), 400

    fallback = heuristic_parse_resume(text)

    try:
      result = call_llm(PARSE_PROMPT + text)
      parsed = json.loads(_clean_llm_json(result))
      return jsonify(_ensure_resume_shape(parsed))
    except Exception as exc:
      print(f'[resume-parser] Falling back to heuristic parsing: {exc}')
      return jsonify(_ensure_resume_shape(fallback))

  except Exception as e:
    return jsonify({'error': str(e)}), 500
