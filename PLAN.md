# ETH AI Study Assistant — Implementation Plan

**Last updated:** 2026-04-12  
**Status legend:** ✅ Done · 🚧 In Progress · ⬜ Not Started

---

## Current State

The project scaffold (145 files) exists. The following are fully implemented:

- ✅ PDF ingestion pipeline (parse → clean → chunk → embed → ChromaDB)
- ✅ Fireworks AI LLM client (DeepSeek V3 text, Llama 3.2 Vision)
- ✅ Budget enforcement guard (HTTP 402 on overage, usage recording)
- ✅ Document upload, listing, deletion API
- ✅ SQLAlchemy models (Document, Chapter, StudySession, Exercise, Submission, APIUsageRecord)
- ✅ Language registry + sandbox configs (Python, SQL, Haskell)
- ✅ Monaco code editor component
- ✅ Zustand stores, typed API wrapper, Zustand stores

Everything else below is stubbed (`raise NotImplementedError` or empty shells).

---

## Phase 1 — RAG Retriever + Session Creation

*Goal: A user can select documents/chapters, configure a session, and get a session ID back.*

### 1.1 RAG Retriever `backend/app/vector_db/retriever.py`
- [ ] Implement `retrieve_chunks(query: str, document_ids: list[int], chapter_ids: list[int], top_k: int) -> list[ChunkResult]`
  - Build ChromaDB `where` filter from `document_ids` / `chapter_ids`
  - Embed query with local sentence-transformers (same model used at ingestion)
  - Query both `DOCUMENT_CHUNKS` and `DIAGRAM_DESCRIPTIONS` collections
  - Return ranked list of `ChunkResult(text, source, score)` dataclasses

### 1.2 Session Service `backend/app/services/session_service.py`
- [ ] Implement `create_session(db, body: SessionCreateRequest) -> StudySession`
  - Validate document/chapter IDs exist and are ingested
  - Create `StudySession` DB record via `session_repo.create()`
  - Return ORM object

### 1.3 Sessions API `backend/app/api/v1/sessions.py`
- [ ] `POST /api/v1/sessions` — call `session_service.create_session`, return `SessionOut`
- [ ] `GET /api/v1/sessions/{session_id}` — return session + its exercises list
- [ ] Wire into `api/v1/router.py`

### 1.4 Session Repository `backend/app/db/repositories/session_repo.py`
- [ ] `create(db, data) -> StudySession`
- [ ] `get_by_id(db, session_id) -> StudySession | None`
- [ ] `list_all(db) -> list[StudySession]`

### 1.5 Dashboard Frontend — Context Selection
- [ ] `frontend/src/components/dashboard/DocumentSelector.tsx` — render fetched documents + chapters with checkboxes
- [ ] `frontend/src/components/dashboard/SessionConfigForm.tsx` — difficulty, question types (multi-select), num_questions, hints toggle
- [ ] `frontend/src/app/dashboard/page.tsx` — wire up selectors, call `POST /api/v1/sessions` on submit, redirect to `/session/[sessionId]`
- [ ] `frontend/src/hooks/useDocuments.ts` — already stubbed; implement fetch + SWR/useState

**Acceptance:** Clicking "Start Session" creates a session record in SQLite and navigates to the session page.

---

## Phase 2 — Exercise Generation

*Goal: The session page loads and the first question is generated and displayed.*

### 2.1 Prompt Templates `prompts/exercise_generation/`
- [ ] `coding_question.md` — system + user templates with slots: `{context_chunks}`, `{language}`, `{difficulty}`, `{subject}`
- [ ] `multiple_choice_question.md` — same slots + instructions to produce 4 options with one correct
- [ ] `open_ended_question.md`
- [ ] `test_cases_{language}.md` — per-language test generation template (pytest / SQL assertions / HUnit)

### 2.2 Exercise Service `backend/app/services/exercise_service.py`
- [ ] Implement `generate_exercise(db, body: ExerciseGenerateRequest) -> ExerciseOut`:
  1. Retrieve top-k context chunks via `retriever.retrieve_chunks()` keyed on session context
  2. Render prompt template (Jinja2) with chunks + session config
  3. Call LLM (non-streaming first, streaming in Phase 6)
  4. Parse LLM JSON response: `{ question_text, test_cases, language, question_type }`
  5. Persist `Exercise` record via `exercise_repo.create()`
  6. Return `ExerciseOut`

### 2.3 Exercise Repository `backend/app/db/repositories/exercise_repo.py`
- [ ] `create(db, data) -> Exercise`
- [ ] `get_by_id(db, exercise_id) -> Exercise | None`
- [ ] `list_by_session(db, session_id) -> list[Exercise]`

### 2.4 Exercises API `backend/app/api/v1/exercises.py`
- [ ] `POST /api/v1/exercises/generate` — body: `{ session_id, question_type?, language? }`; returns `ExerciseOut`
- [ ] Add `BudgetGuard` dependency

### 2.5 Session Page — Question Panel Frontend
- [ ] `frontend/src/app/session/[sessionId]/page.tsx` — fetch session on load, call generate-exercise on mount
- [ ] `frontend/src/components/session/QuestionPanel.tsx` — render question text with KaTeX/markdown
- [ ] `frontend/src/components/session/MultipleChoiceCard.tsx` — radio buttons for MC questions
- [ ] `frontend/src/components/session/OpenEndedInput.tsx` — textarea for text answers
- [ ] `frontend/src/hooks/useExerciseSession.ts` — state machine: loading / question / submitting / graded

**Acceptance:** Visiting `/session/[id]` fetches session config, calls generate-exercise, and renders the question text.

---

## Phase 3 — Code Execution & Deterministic Grading

*Goal: User submits code → E2B runs tests → pass/fail displayed in terminal.*

### 3.1 Sandbox Service `backend/app/services/sandbox_service.py`
- [ ] Implement `execute_code(language: str, user_code: str, test_cases: str, schema_name: str | None) -> ExecutionResult`:
  1. Look up `SandboxConfig` from `LANGUAGE_REGISTRY`
  2. Render Jinja2 test runner template with `user_code` + `test_cases`
  3. For SQL: prepend schema from `sql_schemas/` file
  4. Provision E2B `CodeInterpreter` sandbox
  5. Upload and run; capture stdout/stderr + exit code
  6. Return `ExecutionResult(stdout, stderr, passed: bool, duration_s: float)`
- [ ] Record sandbox cost via `budget_service.record_usage(sandbox_time_seconds=...)`

### 3.2 Sandbox Templates `backend/app/sandbox/templates/`
- [ ] `python_runner.py.j2` — pytest invocation wrapping `{{ user_code }}` + `{{ test_cases }}`
- [ ] `sql_runner.sql.j2` — schema injection + `{{ user_code }}` + assertion queries
- [ ] `haskell_runner.hs.j2` — HUnit test file wrapping `{{ user_code }}` + `{{ test_cases }}`

### 3.3 Grading Service — Code Path `backend/app/services/grading_service.py`
- [ ] Implement `grade_code_submission(db, submission_id, exercise_id, user_code) -> GradingResult`:
  1. Load exercise (test_cases, language)
  2. Call `sandbox_service.execute_code()`
  3. Determine pass/fail from exit code
  4. On fail: call `feedback_service.generate_feedback()` (Phase 5)
  5. Persist `Submission` record: `passed`, `feedback`, `answer_text`
  6. Return `GradingResult`

### 3.4 Execution API `backend/app/api/v1/execution.py`
- [ ] `POST /api/v1/exercises/{exercise_id}/submit/code` — body: `{ user_code }`; returns `GradingResult`
- [ ] Add `BudgetGuard` dependency

### 3.5 Terminal Output Frontend
- [ ] `frontend/src/components/session/TerminalOutput.tsx` — render stdout/stderr in monospace, color-code errors
- [ ] Run button in `CodeEditor.tsx` calls execution endpoint
- [ ] `frontend/src/hooks/useCodeExecution.ts` — POST + handle loading/error/result state

**Acceptance:** Submitting correct Python code passes all tests; incorrect code shows error output and fails.

---

## Phase 4 — Open-Ended & Vision Grading

*Goal: User uploads a handwritten proof image → Vision LLM grades it → feedback shown.*

### 4.1 Image Upload Endpoint
- [ ] `POST /api/v1/exercises/{exercise_id}/submit/image` — multipart upload; save to `data/uploads/`; call grading service; return `GradingResult`
- [ ] Add `BudgetGuard` dependency

### 4.2 Vision Grading `backend/app/llm/vision.py`
- [ ] Implement `grade_proof(image_path: str, question_text: str, context_chunks: list[str]) -> ProofGradingResult`:
  - Encode image to base64
  - Call `fireworks_vision_model` with image + question + context
  - Parse response: `{ passed: bool, feedback: str, flaws: list[str] }`

### 4.3 Grading Service — Vision Path `backend/app/services/grading_service.py`
- [ ] Implement `grade_image_submission(db, submission_id, exercise_id, image_path) -> GradingResult`:
  1. Retrieve exercise + relevant context chunks
  2. Call `vision.grade_proof()`
  3. Persist `Submission` record
  4. Return `GradingResult`

### 4.4 Open-Ended & Image Upload Frontend
- [ ] `frontend/src/components/session/ImageUploadZone.tsx` — drag-drop zone (reuse react-dropzone), preview thumbnail
- [ ] `frontend/src/components/session/GradingResult.tsx` — pass/fail badge + feedback markdown
- [ ] Wire into `OpenEndedInput.tsx` (text answers POST to a text-grading endpoint; image answers POST to image endpoint)

### 4.5 Text Answer Grading
- [ ] `POST /api/v1/exercises/{exercise_id}/submit/text` — grade free-text answer with LLM
- [ ] Prompt template `prompts/grading/open_ended_grade.md`

**Acceptance:** Uploading a proof image returns a grading result with feedback text rendered below the question.

---

## Phase 5 — Hints, Tutor Feedback & Dispute

*Goal: Hints work, failing code shows LLM tutor feedback, user can dispute a grade.*

### 5.1 Hint Service `backend/app/services/hint_service.py`
- [ ] Implement `generate_hint(db, exercise_id) -> str`:
  - Load exercise + question text
  - Retrieve top-3 relevant context chunks
  - Render `prompts/hints/hint.md` template
  - Stream LLM response (or non-streaming for simplicity)
- [ ] Prompt template `prompts/hints/hint.md` — conceptual nudge, no direct answer

### 5.2 Hints API
- [ ] `GET /api/v1/exercises/{exercise_id}/hint` — returns `{ hint_text: str }`
- [ ] Add `BudgetGuard` dependency

### 5.3 Feedback Service `backend/app/services/feedback_service.py`
- [ ] Implement `generate_feedback(exercise: Exercise, user_code: str, error_output: str) -> str`:
  - Render `prompts/feedback/code_failure.md` with code + error + question
  - Call LLM; return feedback text

### 5.4 Dispute API `backend/app/api/v1/sessions.py`
- [ ] `PATCH /api/v1/submissions/{submission_id}/dispute` — sets `disputed=True`, `passed=True` on submission record

### 5.5 Frontend — Hints & Dispute
- [ ] `frontend/src/components/session/HintDrawer.tsx` — collapsible panel, only rendered if `hints_enabled`; fetches hint lazily on open
- [ ] `frontend/src/components/session/DisputeButton.tsx` — only shown on failed submissions; calls dispute endpoint; re-renders result as passed

**Acceptance:** Clicking "Get Hint" returns a nudge. A failed submission can be disputed and flips to passed.

---

## Phase 6 — WebSocket Streaming

*Goal: LLM responses stream token-by-token to the browser for question generation, hints, and feedback.*

### 6.1 Backend Streaming Relay `backend/app/llm/streaming.py`
- [ ] Implement `stream_to_websocket(ws: WebSocket, stream: AsyncIterator[str])`:
  - Iterate over `AsyncOpenAI` streaming chunks
  - Send each token as `{"type": "token", "content": "..."}` JSON frame
  - Send `{"type": "done"}` when complete
  - Handle disconnect gracefully

### 6.2 WebSocket Routes `backend/app/api/v1/ws.py`
- [ ] `WS /api/v1/ws/exercise/{session_id}/generate` — streams exercise generation
- [ ] `WS /api/v1/ws/exercise/{exercise_id}/hint` — streams hint
- [ ] `WS /api/v1/ws/submission/{submission_id}/feedback` — streams failure feedback

### 6.3 Frontend WebSocket Client
- [ ] `frontend/src/lib/websocket.ts` — connect, message handler, auto-reconnect on disconnect
- [ ] `frontend/src/hooks/useStreamingResponse.ts` — accumulate tokens into state string
- [ ] Replace polling in `QuestionPanel.tsx` and `HintDrawer.tsx` with streaming hooks

**Acceptance:** Question text appears word-by-word; time-to-first-token < 800ms.

---

## Phase 7 — Session Logging & Spaced Repetition

*Goal: All exercises/submissions persisted; history page shows past sessions; retry session generates from failures.*

### 7.1 Session Logging (ensure complete)
- [ ] Verify `exercise_repo.create()` and `submission_repo` calls happen in every grading path
- [ ] `Submission` stores `answer_text` or `answer_image_path`, `passed`, `feedback`, `disputed`

### 7.2 Submission Repository `backend/app/db/repositories/exercise_repo.py`
- [ ] `create_submission(db, data) -> Submission`
- [ ] `get_submissions_by_exercise(db, exercise_id) -> list[Submission]`
- [ ] `get_failed_exercises(db) -> list[Exercise]` — join through submissions where `passed=False` and `disputed=False`
- [ ] `dispute_submission(db, submission_id) -> Submission`

### 7.3 Spaced Repetition Service `backend/app/services/spaced_repetition.py`
- [ ] `create_retry_session(db, base_session_id: int | None) -> StudySession`:
  - Query all failed exercises (not disputed)
  - Create new `StudySession` with `is_retry_session=True` and `exercise_ids` pre-populated

### 7.4 History API
- [ ] `GET /api/v1/sessions` — list all sessions (newest first) with pass/fail counts
- [ ] `POST /api/v1/sessions/retry` — calls `spaced_repetition.create_retry_session()`

### 7.5 History Frontend
- [ ] `frontend/src/app/history/page.tsx` — table of past sessions (date, subject, score X/N, retry button)
- [ ] `frontend/src/components/history/SessionTable.tsx` — table rows
- [ ] `frontend/src/components/history/RetrySessionButton.tsx` — calls retry endpoint, redirects to new session

**Acceptance:** History page shows all past sessions with scores; "Retry Failures" button creates a new session with only failed questions.

---

## Phase 8 — Budget UI

*Goal: Budget dashboard shows live spend; banner warns when near/over limit.*

### 8.1 Budget API `backend/app/api/v1/budget.py`
- [ ] `GET /api/v1/budget` — returns `{ spent_usd, limit_usd, pct_used, is_exceeded, breakdown: { llm, sandbox } }`
- [ ] Implement `budget_repo.get_monthly_summary()` to aggregate `APIUsageRecord` by model/type for current month

### 8.2 Budget Frontend
- [ ] `frontend/src/app/budget/page.tsx` — spend bar chart (LLM vs sandbox), current month total, per-model breakdown
- [ ] `frontend/src/components/layout/BudgetWarningBanner.tsx` — sticky banner at >80% usage; "Budget Exceeded" error state at 100%
- [ ] `frontend/src/hooks/useBudgetStatus.ts` — poll every 60s; write to `budgetStore`

**Acceptance:** Budget page shows accurate spend. Banner appears when >80% used. All generative actions blocked (HTTP 402 surfaced as UI error) when exceeded.

---

## Phase 9 — Polish, Error Handling & NFR Compliance

### 9.1 Error Handling
- [ ] Global FastAPI exception handler: map common errors to user-friendly JSON
- [ ] Frontend: toast notifications for API errors, 402 budget-exceeded dialog
- [ ] Loading skeletons in all data-fetching components

### 9.2 Performance
- [ ] Verify ingestion < 60s for 50-page PDF (NFR-03): profile embedder bottleneck if slow
- [ ] Verify E2B execution < 5s p95 (NFR-02): log sandbox timing to `APIUsageRecord`
- [ ] Time-to-first-token < 800ms (NFR-01): ensure streaming relay starts immediately

### 9.3 Tests
- [ ] Unit tests for `exercise_service.generate_exercise` (mock LLM + ChromaDB)
- [ ] Unit tests for `grading_service` (mock sandbox + LLM)
- [ ] Unit tests for `budget_service.record_usage` + `is_budget_exceeded`
- [ ] Integration test for `POST /api/v1/sessions` + `POST /api/v1/exercises/generate`
- [ ] Integration test for code submission + E2B (can be skipped in CI with `pytest.mark.e2b`)

### 9.4 Type Safety
- [ ] `cd backend && mypy app/` — fix all type errors
- [ ] `cd frontend && npx tsc --noEmit` — fix all type errors

### 9.5 Missing Schema Files
- [ ] `backend/app/schemas/` — create Pydantic schemas for `ExerciseGenerateRequest`, `ExerciseOut`, `SessionCreateRequest`, `SessionOut`, `GradingResult`, `BudgetStatus` if not already defined

---

## Dependency Order (Build Sequence)

```
Phase 1 (RAG + Session) ──► Phase 2 (Exercise Gen) ──► Phase 3 (Code Execution)
                                                     ──► Phase 4 (Vision Grading)
                        ──► Phase 5 (Hints/Feedback) ── depends on Phase 2 & 3
Phase 2 + 3 + 4 + 5 ──► Phase 6 (Streaming) — can wire in after each phase
Phase 2 + 3 + 4 ──► Phase 7 (Logging/History)
Phase 1-7 ──► Phase 8 (Budget UI)
All phases ──► Phase 9 (Polish)
```

---

## Key Files Quick Reference

| Task | File(s) |
|------|---------|
| RAG retrieval | `backend/app/vector_db/retriever.py` |
| Session creation | `backend/app/services/session_service.py`, `api/v1/sessions.py` |
| Exercise generation | `backend/app/services/exercise_service.py`, `api/v1/exercises.py` |
| Code execution | `backend/app/services/sandbox_service.py`, `api/v1/execution.py` |
| Deterministic grading | `backend/app/services/grading_service.py` |
| Vision grading | `backend/app/llm/vision.py` |
| Tutor feedback | `backend/app/services/feedback_service.py` |
| Hints | `backend/app/services/hint_service.py` |
| Streaming relay | `backend/app/llm/streaming.py`, `api/v1/ws.py` |
| Spaced repetition | `backend/app/services/spaced_repetition.py` |
| Budget summary | `backend/app/db/repositories/budget_repo.py` |
| Prompt templates | `prompts/exercise_generation/`, `prompts/grading/`, `prompts/hints/`, `prompts/feedback/` |
| Sandbox templates | `backend/app/sandbox/templates/` |
| Session page | `frontend/src/app/session/[sessionId]/page.tsx` |
| Question panel | `frontend/src/components/session/QuestionPanel.tsx` |
| Dashboard | `frontend/src/app/dashboard/page.tsx` |
| History page | `frontend/src/app/history/page.tsx` |
| Budget page | `frontend/src/app/budget/page.tsx` |

---

## Open Questions / Decisions Needed

1. **Schemas directory**: Do Pydantic request/response schemas live in `app/schemas/` (separate from ORM models) or inline in route files? The stub imports suggest `app/schemas/exercise.py` — confirm this pattern.
2. **Streaming vs non-streaming first**: Start non-streaming (simpler), add WebSocket streaming in Phase 6, or build streaming from day one in Phase 2?
3. **Multiple-choice grading**: Should MC answers be graded deterministically (compare selected option to stored correct option) or via LLM? Deterministic is simpler and cheaper.
4. **E2B timeout**: Current config value for sandbox timeout — confirm `NFR-02` target of 5s fits within E2B free tier.
5. **Alembic migrations**: Are migrations auto-generated from models, or does `db/engine.py` `create_all()` handle schema? The Makefile has `make migrate` — clarify whether to use `create_all` for dev and Alembic for prod.
