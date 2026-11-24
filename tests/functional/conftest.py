"""Fixtures for the Demo Commerce Platform functional tests.

Black-box tests against the running Docker Compose stack. Base URLs are
overridable via environment so the same suite can target Kubernetes
port-forwards or a remote environment:

    WEB_URL=http://host:8080 PRODUCT_API_URL=http://host:3000 \
      pytest tests/functional
"""

from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path

import httpx
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILE = REPO_ROOT / "deploy" / "platform" / "docker-compose.yaml"

BASE_URLS = {
    "web": os.environ.get("WEB_URL", "http://localhost:8080"),
    "product": os.environ.get("PRODUCT_API_URL", "http://localhost:3000"),
    "details": os.environ.get("DETAILS_API_URL", "http://localhost:8081"),
    "reviews": os.environ.get("REVIEWS_API_URL", "http://localhost:8000"),
    "ratings": os.environ.get("RATINGS_API_URL", "http://localhost:8083"),
}

KNOWN_SKUS = ["SKU-1001", "SKU-1002", "SKU-1003"]


def compose(*args: str) -> subprocess.CompletedProcess:
    """Run a docker compose command against the platform stack."""
    return subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE_FILE), *args],
        capture_output=True,
        text=True,
        timeout=120,
    )


def wait_ready(url: str, timeout: float = 30.0) -> None:
    """Block until ``{url}/readyz`` answers 200 or raise."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if httpx.get(f"{url}/readyz", timeout=2).status_code == 200:
                return
        except httpx.TransportError:
            pass
        time.sleep(0.5)
    raise AssertionError(f"{url} did not become ready within {timeout}s")


@pytest.fixture(scope="session")
def urls() -> dict[str, str]:
    return BASE_URLS


@pytest.fixture(scope="session")
def http():
    with httpx.Client(timeout=10.0) as client:
        yield client


@pytest.fixture(scope="session", autouse=True)
def restore_stack():
    """After the whole suite, ensure every compose service is back up."""
    yield
    compose("up", "-d")


@pytest.fixture()
def service_control():
    """Helper that stops a service and always restarts it afterwards."""

    class Control:
        def stop(self, service: str) -> None:
            result = compose("stop", service)
            assert result.returncode == 0, result.stderr

        def start(self, service: str) -> None:
            result = compose("up", "-d", service)
            assert result.returncode == 0, result.stderr

    control = Control()
    stopped: list[str] = []
    original_stop = control.stop

    def tracking_stop(service: str) -> None:
        original_stop(service)
        stopped.append(service)

    control.stop = tracking_stop  # type: ignore[method-assign]
    try:
        yield control
    finally:
        for service in reversed(stopped):
            control.start(service)
            # readiness check per service name
            port_map = {
                "details-api": "details",
                "reviews-api": "reviews",
                "ratings-api": "ratings",
                "product-api": "product",
                "web": "web",
            }
            wait_ready(BASE_URLS[port_map[service]])
