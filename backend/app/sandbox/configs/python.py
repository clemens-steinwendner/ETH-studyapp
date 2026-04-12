"""Python sandbox execution configuration."""

SETUP_COMMANDS = [
    "pip install pytest --quiet",
]

RUNNER_COMMAND = "pytest solution_test.py -v --tb=short"
