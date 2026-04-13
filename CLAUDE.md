# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All top-level commands run from `ETH-studyapp/` via `make`. Backend commands must be run from `backend/`.

```bash
# Start everything (FastAPI + Next.js + ARQ worker in parallel)
make dev

# Individual processes
make backend    # FastAPI on http://localhost:8000 (--reload enabled)
make frontend   # Next.js on http://localhost:3000
make worker     # ARQ background worker (required for PDF ingestion)

# Database
make migrate                         # Apply all pending Alembic migrations
make migration MSG="describe change" # Generate a new migration from model changes

# Dependencies
make install    # pip install -e ".[dev]" + npm install

# Testing & linting (run from backend/)
cd backend && pytest                           # all tests
cd backend && pytest tests/unit/test_foo.py   # single file
cd backend && pytest -k "test_name"           # single test by name
cd backend && mypy app/
cd backend && ruff check app/

# Frontend type-check
cd frontend && npx tsc --noEmit
```

Redis must be running before starting the worker: `brew services start redis`.
Alembic reads `DATABASE_URL` from `.env` via `backend/alembic.ini`. Run migrations from `backend/`.

## Architecture

### Three-process model

The app requires three processes running simultaneously:
- **uvicorn** (`app.main:app`) — handles HTTP + WebSocket requests
- **ARQ worker** (`app.tasks.worker.WorkerSettings`) — runs PDF ingestion jobs off a Redis queue
- **Next.js** — serves the frontend; proxies `/api/*` → `http://localhost:8000/api/*` (configured in `frontend/next.config.ts`)

### Backend layer pattern

Every API route is intentionally thin — it validates input and immediately delegates:

```
api/v1/<router>.py  →  services/<service>.py  →  db/repositories/<repo>.py
                    ↘  llm/client.py
                    ↘  vector_db/retriever.py
                    ↘  sandbox_service.py
```

Repositories are the only layer that touches SQLAlchemy directly. Services orchestrate across repositories, the LLM client, and ChromaDB. Routers never call `db` directly.

### Budget guard

Any route that calls the LLM or E2B must include `_: BudgetGuard` as a parameter (defined in `app/dependencies.py`). This `Depends` checks monthly spend against `MONTHLY_BUDGET_USD` and raises HTTP 402 before the route body executes. `BudgetService` writes an `APIUsageRecord` after every successful API call via `budget_service.record_usage()`.

### LLM client

`app/llm/client.py` returns a cached `AsyncOpenAI` instance pointed at the Fireworks AI base URL (`https://api.fireworks.ai/inference/v1`). All LLM calls use this client — the model is selected at call time from `settings.fireworks_model` (text) or `settings.fireworks_vision_model` (vision). `app/llm/streaming.py` handles WebSocket token relay; `app/llm/vision.py` handles image encoding for diagram captioning and proof grading.

### Ingestion pipeline

PDF upload → `api/v1/documents.py` saves file to `data/uploads/` and enqueues an ARQ job → `tasks/ingest_task.py` calls `services/ingestion/pipeline.py` → `pdf_parser` (PyMuPDF) → `latex_cleaner` → `chunker` → `embedder` (local sentence-transformers) → chunks stored in ChromaDB; `diagram_describer` calls Vision LLM for each image block. Document metadata + chapters are written to SQLite via `document_repo`.

### Sandbox execution

`sandbox/languages.py` holds a `LANGUAGE_REGISTRY` dict mapping language IDs to `SandboxConfig` dataclasses. To add a new language, add an entry here and a Jinja2 template in `sandbox/templates/`. `sandbox_service.py` reads this registry — no core logic changes needed. SQL exercises additionally inject a schema from `sql_schemas/` before running assertions.

### Prompt templates

All LLM system/user prompts live as Markdown files in `prompts/` (versioned, outside Python code). Services load and render them with Jinja2 at call time. Modifying prompt behaviour means editing `.md` files, not Python.

### Data stores

| Store | Location | Contents |
|---|---|---|
| SQLite | `data/app.db` | Sessions, exercises, submissions, budget records, document metadata |
| ChromaDB | `data/chroma/` | Text chunk embeddings + diagram description embeddings |
| Uploads | `data/uploads/` | Raw PDFs (pre-ingestion staging) |
| Assets | `assets/<subject>/` | Course PDFs and old exams — gitignored, never committed |

All three `data/` subdirectories are gitignored. The `assets/` tree is gitignored via per-directory `.gitignore` files (structure tracked via `.gitkeep`, contents never committed).

### Frontend state

Zustand stores (`src/stores/`) hold session config, budget status, and UI state. API calls go through `src/lib/api.ts` (typed fetch wrapper). WebSocket connections for LLM streaming are managed by `src/lib/websocket.ts` + `src/hooks/useStreamingResponse.ts`. Monaco Editor is loaded via `next/dynamic` with `ssr: false` to avoid SSR issues.

---

## UI Design Reference

HTML mockups live in `design/mockups/`. Read the relevant file before implementing or modifying any frontend page or component.

| File | View |
|---|---|
| `design/mockups/01_dashboard.html` | Library dashboard — drag-and-drop ingestion, budget meter, recent document cards, live process log terminal |
| `design/mockups/02_session_config.html` | New study session setup — document/chapter context selection (grouped by subject), difficulty slider, question type checkboxes, N_Questions counter, AI hints toggle |
| `design/mockups/03_study_workspace.html` | Active coding exercise — split pane: exercise instructions + AI hint on left, Monaco-style editor + terminal output on right, sandbox run button, submit CTA |
| `design/mockups/04_review_analytics.html` | Post-session review — success rate/cost summary cards, exercise manifest with PASS/FAIL badges, manual override button (FR-18), LLM tutor feedback panel |
| `design/mockups/05_multimodal_study_view.html` | Multimodal session — MCQ questions, open-ended textarea, handwritten proof drag-and-drop upload zone (FR-12), scratchpad workspace, live LLM hints panel |

**Design system constants** (apply to every page):
- Primary/ETH red: `#A31B1F` (Tailwind alias `primary-container`)
- Fonts: Inter (UI), JetBrains Mono (code, labels, metadata)
- Sidebar: 256px fixed left, neutral-50 background, active item has `border-r-2 border-[#A31B1F] bg-neutral-200`
- Footer: fixed bottom, `h-8`, `bg-neutral-900`, JetBrains Mono 10px uppercase
- All pages use the same shared sidebar + topnav + footer shell

---

## Software Requirements Specification

### 1. Product Scope

ETH AI Study Assistant — a locally-isolated web application for a single CS student at ETH Zurich. Ingests course PDFs and uses generative AI to create interactive study sessions covering Databases, Computer Networks, Probability & Statistics, Formal Methods (FMFP), and Machine Learning. Features sandboxed code execution, text evaluation, and visual math proof grading.

**Budget constraint: $8.00 USD/month hard cap. Generative features lock out above this limit.**

### 2. Operating Environment

- Hardware: Apple Silicon M3 Max (localhost only)
- Backend: Python FastAPI (async)
- Frontend: Next.js SPA
- DBs: SQLite (state) + ChromaDB (vectors) — both local
- External APIs: Fireworks AI (LLM/vision inference) + E2B (sandboxed code execution)

### 3. Functional Requirements

#### FR-01 — PDF Text Parsing (Must Have)
Extract text natively from digital-native PDFs.

#### FR-02 — Metadata Extraction & Storage (Must Have)
Extract filename, detected chapters, upload date → store in SQLite.

#### FR-03 — Math Preservation (Must Have)
Retain mathematical formulas as LaTeX strings during parsing.

#### FR-04 — Diagram Extraction & Processing (Should Have)
Auto-detect and extract image blocks from PDFs. Pass to Vision LLM to generate searchable semantic text descriptions, then embed alongside the image reference.

#### FR-05 — Manual Diagram Override (Must Have)
UI mechanism to manually upload context images/diagrams to a study session when automated extraction fails.

#### FR-06 — Vector Embedding (Must Have)
Embed parsed text and diagram descriptions into local ChromaDB vector store.

#### FR-07 — Context Selection (Must Have)
UI: select specific documents, chapters, or past exams to set context boundary for a new study session.

#### FR-08 — Parameter Controls (Must Have)
Configure: number of questions, difficulty (Recall / Application / Synthesis), question types (Coding, MCQ, Open-Ended).

#### FR-09 — Hint Toggle (Must Have)
Toggleable hint feature. If enabled, renders a collapsible button below questions that requests a conceptual nudge from the LLM.

#### FR-10 — Code Editor Integration (Must Have)
Code editor with syntax highlighting for SQL, Haskell, Python, and LaTeX.

#### FR-11 — Terminal Output (Must Have)
Terminal-like view showing stdout, stderr, and test results from the execution sandbox.

#### FR-12 — Image Upload (Must Have)
Drag-and-drop zone for uploading handwritten math proof images as answers to Open-Ended questions.

#### FR-13 — Test Case Generation (Must Have)
When generating a coding exercise, simultaneously prompt the LLM to generate deterministic unit tests (e.g., pytest for Python) to evaluate the user's future submission.

#### FR-14 — Sandbox Routing (Must Have)
Bundle user's code with generated test cases and send to E2B ephemeral sandbox via API.

#### FR-15 — Deterministic Grading (Must Have)
Evaluate code correctness using deterministic test runners in the sandbox. LLM must NOT parse stdout to determine pass/fail.

#### FR-16 — Tutor Feedback Generation (Must Have)
If deterministic test fails, pass error output + user's code to LLM to generate tutor-style feedback on logical/syntax errors.

#### FR-17 — Vision-Based Grading (Must Have)
Uploaded handwritten proofs evaluated by Vision LLM — step-by-step derivation verification, returns text highlighting logical flaws.

#### FR-18 — Grading Dispute / Manual Override (Must Have)
UI mechanism to override an LLM evaluation and manually mark an exercise as 'Passed' (handles hallucination or incorrect vision grading).

#### FR-19 — Database Mocking (Must Have)
For SQL questions, inject a standard pre-defined relational schema into the sandbox before executing user's query and assertion tests.

#### FR-20 — FMFP Support (Must Have)
Support Haskell compilation and execution within the E2B sandbox.

#### FR-21 — Session Logging (Must Have)
Save every generated exercise, user submission, and Boolean pass/fail result to SQLite.

#### FR-22 — Spaced Repetition / Retry (Should Have)
Allow the user to generate a session comprised exclusively of past exercises marked "Failed."

#### FR-23 — API Budget Enforcement (Must Have)
Track cumulative token costs and sandbox runtime costs. If monthly cost exceeds $8.00, disable generative features and show a budget-exceeded warning in UI.

### 4. Non-Functional Requirements

#### NFR-01 — Time-to-First-Token
Begin streaming first text token to frontend within 800ms of initial LLM API response.

#### NFR-02 — Execution Turnaround
MicroVM sandbox provisioning + execution + stdout retrieval: complete within 5.0s at p95.

#### NFR-03 — Local Ingestion Speed
RAG ingestion, PDF parsing, and vector embedding for a 50-page PDF: complete in under 60s.

#### NFR-04 — Code Isolation
User code and LLM-generated test scripts must NEVER execute on the host machine. All execution via E2B microVM.

#### NFR-05 — Data Localization
Data at rest (course materials, embeddings, user state) stays local. Ephemeral transmission to LLM/Sandbox APIs is permitted only if providers guarantee zero-data-retention and no model training.

#### NFR-06 — Decoupled Architecture
Frontend and backend communicate exclusively via documented REST endpoints or WebSockets (for streaming).

#### NFR-07 — Extensibility
Sandbox pipeline modularized so adding a new language requires modifying config files only, not core routing logic (see `sandbox/languages.py` LANGUAGE_REGISTRY).
