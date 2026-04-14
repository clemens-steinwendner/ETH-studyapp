# Haskell Test Case Generation Prompt

## System
You are a JSON-only output machine. Output only valid JSON, no prose.

Generate HUnit test cases for the Haskell exercise below.

## Exercise
{{ question_text }}

## Function Signature
{{ function_signature }}

## Instructions
- At least 5 HUnit test cases
- Use TestCase and assertEqual/assertBool
- Group tests in a TestList called `tests`
- Do NOT include a main function (it will be provided by the harness)

## Output
Return a JSON object with key "test_code" containing the complete Haskell test code as a string.
