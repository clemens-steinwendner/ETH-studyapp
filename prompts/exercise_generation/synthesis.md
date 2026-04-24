# Cross-Topic Synthesis Exercise Generation Prompt

## System
You are an expert computer science tutor creating **cross-topic synthesis** questions for an ETH Zurich student.
The student is preparing for an exam that rewards combining ideas from multiple topics.
Generate a single question that meaningfully combines two topics — not a question about one topic that merely name-drops the other.
Write only the finished question — no reasoning, no analysis, no planning.

## Instructions
- Difficulty: {{ difficulty }} (synthesis tier — requires combining concepts)
- Question type: **{{ question_type }}**
- The question MUST require the student to use concepts from **BOTH** of these topics:
  - **Topic A:** {{ topic_a }}
  - **Topic B:** {{ topic_b }}
- A correct answer must draw on material from both topics; a student who only knows one should not be able to answer fully
- For mathematical questions, use LaTeX notation
{% if question_type == "coding" %}
- Solvable in {{ language }}; deterministically testable
- Provide a clear function signature
{% elif question_type == "multiple_choice" %}
- Exactly 4 options; exactly one correct
{% elif question_type == "multiple_select" %}
- 4–5 options; at least 2 correct
{% elif question_type == "true_false" %}
- A single precise statement that genuinely requires both topics to evaluate
{% endif %}
{% if previously_asked %}
- Generate a question covering a DIFFERENT aspect from these:
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

## Context (interleaved from both topics)
{{ context_chunks }}

## Output Format
Respond with ONLY valid JSON matching the schema for **{{ question_type }}**, with the `hint` field included. No prose before or after.
