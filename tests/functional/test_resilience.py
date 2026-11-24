"""Functional tests: graceful degradation and failure modes.

These manipulate the live compose stack (stop/start services) and are
therefore marked ``resilience``. The service_control fixture guarantees
restart even on assertion failure, and the session fixture restores the
full stack at suite end.
"""

import time

import pytest
from conftest import wait_ready

pytestmark = pytest.mark.resilience


def test_reviews_down_degrades_gracefully(http, urls, service_control):
    service_control.stop("reviews-api")
    time.sleep(1)  # let the orchestrator observe the failure
    response = http.get(f"{urls['product']}/api/v1/products/SKU-1001")
    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["reviews"] == []
    # Required data still served
    assert body["details"]["productId"] == "SKU-1001"


def test_ratings_down_degrades_gracefully(http, urls, service_control):
    service_control.stop("ratings-api")
    time.sleep(1)
    response = http.get(f"{urls['product']}/api/v1/products/SKU-1001")
    assert response.status_code == 200
    body = response.json()
    assert body["degraded"] is True
    assert body["rating"] is None
    assert len(body["reviews"]) >= 1


def test_details_down_is_fatal(http, urls, service_control):
    service_control.stop("details-api")
    time.sleep(1)
    response = http.get(f"{urls['product']}/api/v1/products/SKU-1001")
    assert response.status_code == 502


def test_stack_recovers_after_restart(http, urls, service_control):
    service_control.stop("reviews-api")
    service_control.stop("ratings-api")
    time.sleep(1)
    degraded = http.get(f"{urls['product']}/api/v1/products/SKU-1001").json()
    assert degraded["degraded"] is True

    service_control.start("reviews-api")
    service_control.start("ratings-api")
    wait_ready(urls["reviews"])
    wait_ready(urls["ratings"])

    recovered = http.get(f"{urls['product']}/api/v1/products/SKU-1001")
    body = recovered.json()
    assert recovered.status_code == 200
    assert body["degraded"] is False
    assert len(body["reviews"]) >= 1
    assert body["rating"]["average"] > 0


def test_fail_readiness_env_flips_readyz(http, urls):
    """FAIL_READINESS is the built-in governance scenario: a container
    started with it must answer /readyz with 503."""
    import subprocess
    import uuid

    name = f"failreadiness-{uuid.uuid4().hex[:8]}"
    subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            name,
            "-p",
            "18083:8083",
            "-e",
            "FAIL_READINESS=true",
            "demo-ratings-api:0.1.0",
        ],
        capture_output=True,
        check=True,
        timeout=30,
    )
    try:
        # container needs a moment to bind
        deadline = time.monotonic() + 15
        code = None
        while time.monotonic() < deadline:
            try:
                code = http.get("http://localhost:18083/readyz", timeout=2).status_code
                break
            except Exception:
                time.sleep(0.5)
        assert code == 503, f"expected 503 from FAIL_READINESS container, got {code}"
        # liveness stays up — only readiness flips
        assert http.get("http://localhost:18083/healthz", timeout=2).status_code == 200
    finally:
        subprocess.run(["docker", "rm", "-f", name], capture_output=True, timeout=30)
