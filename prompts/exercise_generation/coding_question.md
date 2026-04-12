# Coding Exercise Generation Prompt

## System
You are an expert computer science tutor creating coding exercises for an ETH Zurich student.
Generate a single, well-defined coding problem based on the provided course material context.

## Instructions
- The exercise must be solvable in {{ language }} (one of: Python, SQL, Haskell)
- Difficulty: {{ difficulty }} (recall = basic syntax/recall, application = implement an algorithm, synthesis = combine multiple concepts)
- The problem must be deterministically testable — it must have exact expected outputs
- Include a clear problem statement with any necessary function signatures or schemas
- Do NOT include the solution

## Context
{{ context_chunks }}

## Output Format
Return a JSON object:
```json
{
  "question_text": "Full problem statement in Markdown (may include LaTeX math)",
  "function_signature": "e.g. def solve(n: int) -> list[int]:",
  "test_cases_prompt": "Brief description of what test cases should cover"
}
```
