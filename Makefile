.PHONY: dev backend frontend worker migrate ingest install

# Start all services (backend + frontend)
dev:
	make -j3 backend frontend worker

# Start FastAPI backend
backend:
	cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start Next.js frontend
frontend:
	cd frontend && npm run dev

# Start ARQ background worker (PDF ingestion)
worker:
	cd backend && python -m arq app.tasks.worker.WorkerSettings

# Run Alembic migrations
migrate:
	cd backend && alembic upgrade head

# Create a new migration (usage: make migration MSG="add sessions table")
migration:
	cd backend && alembic revision --autogenerate -m "$(MSG)"

# Install all dependencies
install:
	cd backend && pip install -e ".[dev]"
	cd frontend && npm install

# Run backend tests
test:
	cd backend && pytest

# Run type checks
typecheck:
	cd backend && mypy app/
	cd frontend && npx tsc --noEmit

# Wipe ChromaDB and re-queue all documents for re-ingestion
# Run this after changing the embedding model. Requires the ARQ worker to be running.
reindex:
	cd backend && python scripts/reindex.py
