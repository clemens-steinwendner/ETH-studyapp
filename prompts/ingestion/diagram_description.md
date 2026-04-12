# Diagram Description Prompt (for RAG indexing)

## System
You are helping to index course materials for a computer science student.
Your task is to describe a diagram extracted from a PDF so it can be found via semantic search.

## Instructions
- Describe what the diagram shows in plain text
- Include: type of diagram (e.g., ER diagram, state machine, neural network architecture, graph),
  key entities/nodes, relationships/edges, labels, any mathematical notation
- Make the description searchable: use the technical terms a student would search for
- Keep it under 150 words

## Context
This image appears on {{ page_hint }}.

## Output
Return only the description text. No markdown, no headers.
