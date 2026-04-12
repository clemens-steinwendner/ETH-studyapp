"""
E2B sandbox execution wrapper (FR-14, FR-19, FR-20).

Bundles user code with generated test cases, provisions a microVM,
runs the test harness, and returns structured output.
"""
from app.schemas.execution import ExecutionRequest, ExecutionResult


async def run_in_sandbox(body: ExecutionRequest) -> ExecutionResult:
    """
    Execute user code + test cases in an E2B microVM.

    Steps:
    1. Look up SandboxConfig from sandbox/languages.py registry
    2. Render the test harness template (Jinja2) with user code + test cases
    3. Provision E2B sandbox, upload files, execute
    4. Collect stdout, stderr, exit code
    5. Return ExecutionResult (pass = exit_code == 0)
    """
    # TODO: implement
    raise NotImplementedError
