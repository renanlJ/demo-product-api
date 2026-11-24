"""Functional tests: correlation and tracing headers."""

import re


def test_request_id_is_echoed(http, urls):
    response = http.get(
        f"{urls['product']}/api/v1/products",
        headers={"X-Request-ID": "func-req-abc123"},
    )
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "func-req-abc123"


def test_request_id_generated_when_absent(http, urls):
    response = http.get(f"{urls['product']}/api/v1/products")
    assert response.status_code == 200
    request_id = response.headers.get("x-request-id")
    assert request_id and len(request_id) >= 8


def test_traceparent_is_accepted(http, urls):
    """A W3C traceparent must not be rejected; trace_id unifies logs."""
    response = http.get(
        f"{urls['product']}/api/v1/products/SKU-1003",
        headers={"traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"},
    )
    assert response.status_code == 200


def test_content_types(http, urls):
    for path in (
        "/api/v1/products",
        "/api/v1/products/SKU-1001",
        "/healthz",
        "/readyz",
    ):
        response = http.get(f"{urls['product']}{path}")
        assert re.match(r"application/json", response.headers["content-type"]), (
            f"{path}: unexpected content-type {response.headers['content-type']}"
        )


def test_metrics_content_type_is_text(http, urls):
    response = http.get(f"{urls['product']}/metrics")
    assert "text" in response.headers["content-type"]
