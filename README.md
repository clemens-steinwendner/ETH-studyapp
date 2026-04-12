# ETH AI Study Assistant

A locally-hosted AI study assistant for ETH Zurich CS courses. Ingests course PDFs and runs
interactive study sessions with sandboxed code execution, LLM-generated exercises, and
vision-based grading for handwritten proofs.

## Prerequisites

- Python 3.12+ (via pyenv: `pyenv install 3.12`)
- Node.js 20+
- Redis (`brew install redis && brew services start redis`)
- [E2B account](https://e2b.dev) for sandbox API key
- [Fireworks AI account](https://fireworks.ai) for LLM API key (DeepSeek V3)

## Setup

```bash
# 1. Copy environment config
cp .env.example .env
# Edit .env and fill in FIREWORKS_API_KEY and E2B_API_KEY

# 2. Install all dependencies
make install

# 3. Create the local data directory
mkdir -p data/uploads data/chroma

# 4. Run database migrations
make migrate
```

## Running

```bash
# Start backend + frontend + background worker in parallel
make dev
```

Or individually:
```bash
make backend   # FastAPI on http://localhost:8000
make frontend  # Next.js on http://localhost:3000
make worker    # ARQ worker for PDF ingestion
```

## Project Structure

```
ETH-studyapp/
├── backend/        # FastAPI Python backend
├── frontend/       # Next.js frontend
├── prompts/        # Versioned LLM prompt templates
├── sql_schemas/    # Pre-defined SQL schemas for sandbox injection
└── data/           # Local runtime data (gitignored)
    ├── app.db      # SQLite database
    ├── chroma/     # ChromaDB vector store
    └── uploads/    # Uploaded PDFs
```

## Subjects Covered

- Databases (SQL exercises, schema injection)
- Computer Networks
- Probability & Statistics
- Formal Methods / FMFP (Haskell)
- Machine Learning

## API Budget

The system enforces a hard $8.00/month API budget across all LLM and sandbox calls.
Monitor usage at http://localhost:3000/budget.
