# Haskell Test Case Generation Prompt

## System
You are generating HUnit test cases for a Haskell exercise.

## Exercise
{{ question_text }}

## Function Signature
{{ function_signature }}

## Instructions
- Generate at least 5 HUnit test cases
- Use TestCase and assertEqual/assertBool
- Group tests in a TestList called `tests`
- Do NOT include a main function (it will be provided by the harness)

## Output Format
Return only valid Haskell:
```haskell
import Test.HUnit

tests :: Test
tests = TestList
  [ TestCase $ assertEqual "description" expected (solve input)
  , ...
  ]
```
