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
def test_egress_allow_list_permits_allowed_domain():
    executor = SandboxExecutor(
        network_mode="allow_list", allowed_domains=["httpbin.org"], timeout=15
    )
    code = """
import requests
r = requests.get("https://httpbin.org/get")
print(r.status_code)
"""
    result = executor.run(code)
    assert result["passed"] is True
    assert "200" in result["stdout"]


@pytest.mark.skipif(not docker_available(), reason="Docker not available")
def test_egress_allow_list_blocks_other_domains():
    executor = SandboxExecutor(
        network_mode="allow_list", allowed_domains=["httpbin.org"], timeout=15
    )
    code = """
import requests
r = requests.get("https://google.com")
print(r.status_code)
"""
    result = executor.run(code)
    # Should fail because google.com is not allowed
    assert result["passed"] is False or "denied" in result["stderr"].lower()
