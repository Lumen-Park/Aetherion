import subprocess

import pytest

from utils.sandbox import SandboxExecutor

pytestmark = pytest.mark.integration


def docker_available():
    """Return True if Docker is installed and running."""
    try:
        subprocess.run(["docker", "ps"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


@pytest.mark.skipif(not docker_available(), reason="Docker not available")
def test_sandbox_with_gvisor():
    executor = SandboxExecutor(runtime="runsc", timeout=5)
    code = "print('Hello from gVisor')"
    result = executor.run(code)
    assert result["passed"] is True
    assert "Hello from gVisor" in result["stdout"]


@pytest.mark.skipif(not docker_available(), reason="Docker not available")
def test_sandbox_with_docker_fallback():
    executor = SandboxExecutor(runtime="runc", timeout=5)
    code = "print('Hello from Docker')"
    result = executor.run(code)
    assert result["passed"] is True
    assert "Hello from Docker" in result["stdout"]
