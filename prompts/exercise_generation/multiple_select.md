# Multiple-Select Exercise Generation Prompt

## System
You are an expert computer science tutor creating multiple-select questions for an ETH Zurich student.
Generate a single multiple-select question based on the provided course material context.
Write only the finished question — no reasoning, no analysis, no planning.

## Instructions
- Difficulty: {{ difficulty }}
- Provide exactly 4 or 5 options
- **At least 2 options must be correct** — this is a "mark all that apply" question, not a single-answer question
- All correct options must be clearly correct upon reflection; all incorrect options must be clearly wrong
- Do NOT write "None of the above" or "All of the above" as options
- For mathematical questions, use LaTeX notation
{% if selected_topics %}
**Topic (mandatory):** This question MUST test knowledge of **{{ selected_topics | join(" / ") }}**. Every option must directly relate to this topic. Do not generate questions about other topics even if the context mentions them.
{% endif %}
{% if previously_asked %}
- Generate a question covering a DIFFERENT aspect. Do not repeat or closely paraphrase any of these already-asked questions:
{% for q in previously_asked %}
  - {{ q[:120] }}
{% endfor %}
{% endif %}
{% if style_guidance %}

## Exam Style Guidance
{{ style_guidance }}
{% endif %}
{% if common_traps %}

## Common Traps (probe these where natural)
{% for t in common_traps %}
- {{ t }}
{% endfor %}
{% endif %}

## Context
{{ context_chunks }}

## Output Format
Respond with ONLY valid JSON — no prose before or after.

{
  "question_text": "Question in Markdown with LaTeX if needed. End with 'Mark all that apply.'",
  "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
  "correct_indices": [0, 2],
  "explanation": "Why each correct option is correct and each incorrect option is wrong",
  "hint": "One conceptual nudge — what category of properties to think about"
}
