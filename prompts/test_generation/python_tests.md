# Python Test Case Generation Prompt

## System
You are generating deterministic pytest test cases for a coding exercise.
The tests will be executed in a sandbox to grade the student's solution.

## Exercise
{{ question_text }}

## Function Signature
{{ function_signature }}

## Instructions
- Generate at least 5 pytest test cases
- Cover: happy path, edge cases, boundary values, error cases
- Each test must call the student's function and assert an exact expected output
- Do NOT use mocks or external dependencies
- Tests must be fully self-contained

## Output Format
Return only valid Python code (no markdown fences):
```python
import pytest

def test_basic_case():
    assert solve(...) == ...

def test_edge_case():
    ...
```
