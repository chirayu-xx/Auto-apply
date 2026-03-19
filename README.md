# Auto-Apply Platform

An intelligent job automation platform that discovers relevant software engineering positions, tailors resumes to each job description, and auto-applies — all from a single dashboard.

## Architecture

```
Frontend (Next.js)  →  Backend API (Node.js)  →  PostgreSQL
                                ↕                      ↕
                        Redis + BullMQ          AI Service (Python/Flask)
                                ↕
                    Playwright Workers (Auto-Apply)
```

## Project Structure

```
auto-apply/
├── apps/
│   ├── web/              # Next.js frontend (port 3000)
│   └── api/              # Node.js backend  (port 5000)
├── services/
│   └── ai-service/       # Python Flask AI   (port 8000)
├── docker-compose.yml    # PostgreSQL + Redis
├── .env.example          # Environment template
└── requirements.md       # Full requirements doc
```

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env
# Edit .env with your OpenRouter API key and generate JWT secrets
```

### 2. Start Infrastructure (PostgreSQL + Redis)

```bash
docker compose up -d postgres redis
```

### 3. Backend API

```bash
cd apps/api
npm install
npx prisma generate
npx prisma db push    # Create tables
npm run dev            # Starts on :5000
```

### 4. AI Service

```bash
cd services/ai-service
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
python app.py              # Starts on :8000
```

### 5. Frontend

```bash
cd apps/web
npm install
npm run dev                # Starts on :3000
```

## Job Sources

| Source | Region | Status |
|--------|--------|--------|
| LinkedIn | Global | 🔲 Planned |
| Indeed | Global | 🔲 Planned |
| Naukri.com | India | 🔲 Planned |
| Glassdoor | Global | 🔲 Planned |

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Prisma ORM
- **AI Service**: Python, Flask, OpenRouter (Qwen 3 235B free)
- **Queue**: BullMQ (Redis)
- **Database**: PostgreSQL
- **Automation**: Playwright
- **Containerization**: Docker
