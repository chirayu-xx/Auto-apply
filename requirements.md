# Auto-Apply Platform — Requirements Document

## 1. Overview

An intelligent job automation platform that **discovers** relevant software engineering positions, **tailors** resumes to each job description, and **auto-applies** on behalf of the user — all from a single dashboard.

---

## 2. Goals

| # | Goal | Success Metric |
|---|------|---------------|
| G1 | Reduce manual job-hunting time | < 5 min/day user involvement |
| G2 | Increase resume-JD match rate | ≥ 85% keyword alignment score |
| G3 | Maximize application volume | 50+ targeted applications/day |
| G4 | Track every application | 100% visibility into status & history |

---

## 3. User Personas

| Persona | Description |
|---------|-------------|
| **Job Seeker (Primary)** | Software engineer who uploads their master resume, sets preferences, and lets the platform apply on their behalf. |
| **Admin (Future)** | Platform admin who manages job source integrations and monitors system health. |

---

## 4. Functional Requirements

### 4.1 User Management

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | User registration & login (email + password, OAuth/Google) | P0 |
| FR-02 | User profile: name, email, phone, location, desired role, salary range, remote/onsite/hybrid preference | P0 |
| FR-03 | Upload master resume (PDF) | P0 |
| FR-04 | Parse and store resume content (skills, experience, education, projects) | P0 |
| FR-05 | Store cover letter template (optional) | P1 |

### 4.2 Job Discovery

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06 | Scrape/fetch jobs from multiple sources (LinkedIn, Indeed, Naukri.com, Glassdoor, Wellfound, company career pages) | P0 |
| FR-07 | Filter jobs by: role, location, remote/hybrid, experience level, salary range, date posted | P0 |
| FR-08 | Deduplicate jobs across sources | P0 |
| FR-09 | Score each job against user profile (relevance score 0–100) | P0 |
| FR-10 | Allow user to set auto-apply threshold (e.g., apply if score ≥ 75) | P1 |
| FR-11 | Blacklist companies or keywords | P1 |

### 4.3 Resume Tailoring (AI-Powered)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-12 | Extract key requirements from job description (skills, qualifications, keywords) | P0 |
| FR-13 | Generate a tailored resume emphasizing matching skills & reordering bullet points | P0 |
| FR-14 | Ensure no fabrication — only rephrase/reorder existing content, never invent experience | P0 (Critical) |
| FR-15 | Generate tailored cover letter from template + JD context | P1 |
| FR-16 | Output tailored resume as PDF | P0 |
| FR-17 | Allow user to review/approve tailored resume before apply (optional manual mode) | P1 |

### 4.4 Auto-Apply Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-18 | Automate form-filling on job portals (name, email, resume upload, cover letter) | P0 |
| FR-19 | Handle common application questions (work authorization, sponsorship, experience years) | P0 |
| FR-20 | Support "Easy Apply" flows (LinkedIn, Indeed, Naukri.com) | P0 |
| FR-21 | Support redirect-to-company-site applications via browser automation | P1 |
| FR-22 | Rate-limit applications to avoid detection/bans (configurable delay) | P0 |
| FR-23 | Retry failed applications with exponential backoff | P1 |

### 4.5 Application Tracking Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-24 | Dashboard showing all applications: company, role, date, status | P0 |
| FR-25 | Statuses: Queued → Applied → Viewed → Interview → Offer → Rejected | P0 |
| FR-26 | Filter/search applications by status, company, date | P0 |
| FR-27 | Daily/weekly summary email with stats | P2 |
| FR-28 | Analytics: applications/day, response rate, top matching skills | P1 |

### 4.6 Scheduling & Automation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-29 | Scheduled job scans (configurable: every 6h, 12h, 24h) | P0 |
| FR-30 | Queue-based application processing (async) | P0 |
| FR-31 | Pause/resume automation | P0 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Category |
|----|-------------|----------|
| NFR-01 | Response time < 2s for dashboard pages | Performance |
| NFR-02 | Support 10,000+ stored jobs without degradation | Scalability |
| NFR-03 | All credentials encrypted at rest (AES-256) | Security |
| NFR-04 | API keys and tokens stored in environment variables, never in code | Security |
| NFR-05 | Rate limiting on all public endpoints | Security |
| NFR-06 | GDPR-friendly: user can delete all their data | Compliance |
| NFR-07 | Structured logging for every job scan, tailor, and apply action | Observability |
| NFR-08 | Resume tailoring must complete in < 30s per job | Performance |

---

## 6. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js + TypeScript + Tailwind CSS | SSR, fast UI, matches your skill set |
| **Backend API** | Node.js (Express/Fastify) | REST API, matches your stack |
| **AI/LLM Service** | Python (Flask) + OpenAI/Gemini API | Resume tailoring, JD parsing |
| **Task Queue** | BullMQ (Redis-backed) | Async job processing (you know RabbitMQ/Celery — same pattern) |
| **Database** | PostgreSQL | Relational data, your expertise |
| **Browser Automation** | Playwright (TypeScript) | Auto-apply form filling, you have Playwright experience |
| **PDF Generation** | Puppeteer / pdf-lib | Tailored resume output |
| **Auth** | NextAuth.js (JWT) | OAuth + credentials, matches your IAM experience |
| **Storage** | AWS S3 / Local filesystem | Resume PDFs |
| **Containerization** | Docker + Docker Compose | Local dev & deployment |

---

## 7. Job Sources & Integration Strategy

| Source | Method | Notes |
|--------|--------|-------|
| LinkedIn | Playwright automation + LinkedIn API (limited) | "Easy Apply" automation |
| Indeed | Playwright automation | Form-fill + resume upload |
| Glassdoor | Playwright automation | Scrape listings |
| Wellfound (AngelList) | API + Playwright | Startup jobs |
| Naukri.com | Playwright automation + Naukri API | India-focused, resume upload + quick apply |
| Company Career Pages | Configurable Playwright scripts | Custom per-company |
| RemoteOK / We Work Remotely | Public API / RSS | Remote-first jobs |

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Job portal TOS violations / IP bans | Application flow blocked | Rate limiting, proxy rotation, human-like delays |
| AI hallucination in resume | Credibility damage | Strict prompt guardrails — rephrase only, never fabricate |
| Portal UI changes break automation | Apply failures | Modular Playwright selectors, alerting on failures |
| API rate limits (OpenAI/Gemini) | Tailoring delays | Caching, batching, fallback models |
| Data privacy (resume + credentials) | Security breach | Encryption at rest, minimal data retention, no plain-text secrets |

---

## 9. MVP Scope (Phase 1)

The MVP focuses on a **single-user local tool** before scaling to a hosted platform:

1. **Upload & parse resume** (PDF → structured JSON)
2. **Job discovery** from 3 sources (LinkedIn + Indeed + Naukri.com)
3. **AI resume tailoring** per job description
4. **Auto-apply** via Playwright (LinkedIn Easy Apply)
5. **Application tracker** dashboard (Next.js)
6. **Scheduled scans** (every 12h)

---

## 10. Future Phases

| Phase | Features |
|-------|----------|
| **Phase 2** | Multi-user support, more job sources, cover letter generation, email notifications |
| **Phase 3** | Interview prep module, salary negotiation insights, company research summaries |
| **Phase 4** | Mobile app, Chrome extension for one-click apply, referral network integration |
