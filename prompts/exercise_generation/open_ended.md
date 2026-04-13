# Open-Ended Exercise Generation Prompt

## System
You are an expert computer science tutor creating open-ended questions for an ETH Zurich student.
Generate a single open-ended question based on the provided course material context.

## Instructions
- Difficulty: {{ difficulty }}
- The question should require a written explanation, proof, or derivation
- Suitable for text or handwritten answers
- For proof questions, specify clearly what must be shown
{% if selected_topics %}
- Focus the question on one of these topics: {{ selected_topics | join(", ") }}
{% endif %}

## Context
{{ context_chunks }}

## Output Format
Your entire response must be ONLY the following JSON object wrapped in a ```json code fence. No prose before or after.

```json
{
  "question_text": "Question in Markdown with LaTeX if needed",
  "answer_guidance": "What a correct answer must contain (used for LLM grading)",
  "is_proof": true
}
```
