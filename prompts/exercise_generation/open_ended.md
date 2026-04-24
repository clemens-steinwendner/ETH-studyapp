# Open-Ended Exercise Generation Prompt

## System
You are an expert computer science tutor creating open-ended questions for an ETH Zurich student.
Generate a single open-ended question based on the provided course material context.
Write only the finished question — no reasoning, no analysis, no planning.

## Instructions
- Difficulty: {{ difficulty }}
- The question should require a written explanation, proof, or derivation
- Specify clearly what must be shown or explained
- For mathematical questions use LaTeX notation
{% if selected_topics %}
**Topic (mandatory):** This question MUST test knowledge of **{{ selected_topics | join(" / ") }}**. Every part of the question must directly relate to this topic. Do not generate questions about other topics even if the context mentions them.
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
  "question_text": "Question in Markdown with LaTeX if needed",
  "explanation": "Model answer — key steps, derivations, or points the answer must cover",
  "hint": "One conceptual nudge — what to think about, not how to solve it"
}
