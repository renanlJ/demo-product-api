"""Functional tests: health, readiness and metrics endpoints.

Every backend must expose /healthz, /readyz and /metrics per the
platform observability contract.
"""

import pytest

BACKENDS = ["product", "details", "reviews", "ratings"]

# Metric family each stack guarantees (names differ per framework).
EXPECTED_METRIC = {
    "product": "http_requests_total",
    "details": "http_server_requests_seconds",
    "reviews": "http_requests_total",
    "ratings": "http_requests_total",
}


@pytest.mark.parametrize("service", BACKENDS)
def test_healthz_returns_200(http, urls, service):
    response = http.get(f"{urls[service]}/healthz")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body
    assert body["status"].lower() in ("ok", "up", "healthy")


@pytest.mark.parametrize("service", BACKENDS)
def test_readyz_returns_200(http, urls, service):
    response = http.get(f"{urls[service]}/readyz")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body


@pytest.mark.parametrize("service", BACKENDS)
def test_metrics_exposes_prometheus_text(http, urls, service):
    response = http.get(f"{urls[service]}/metrics")
    assert response.status_code == 200
    text = response.text
    # Prometheus exposition must carry the metric family the stack
    # guarantees plus a request-duration histogram/summary family.
    assert EXPECTED_METRIC[service] in text


@pytest.mark.parametrize("service", ["product", "reviews", "ratings"])
def test_metrics_records_request_duration(http, urls, service):
    """Stdlib/prom-client stacks share the http_request_duration_seconds family."""
    http.get(f"{urls[service]}/healthz")
    text = http.get(f"{urls[service]}/metrics").text
    assert "http_request_duration_seconds" in text
