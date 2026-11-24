"""Functional tests: API contract conformance.

Strict shape/type assertions mirroring docs/api/openapi.yaml of each
backend — catches contract drift between the leaf services and the
orchestrator.
"""

PRODUCT_SUMMARY_FIELDS = {
    "productId": str,
    "name": str,
    "category": str,
    "price": (int, float),
    "currency": str,
}

REVIEW_FIELDS = {
    "id": str,
    "productId": str,
    "reviewer": str,
    "text": str,
    "rating": int,
    "createdAt": str,
}

RATING_FIELDS = {
    "productId": str,
    "average": (int, float),
    "count": int,
    "distribution": dict,
}

DETAILS_FIELDS = {
    "productId": str,
    "name": str,
    "description": str,
    "category": str,
    "price": (int, float),
    "currency": str,
    "specifications": dict,
}


def assert_fields(body: dict, fields: dict, ctx: str) -> None:
    for name, kind in fields.items():
        assert name in body, f"{ctx}: missing field {name}"
        assert isinstance(body[name], kind), (
            f"{ctx}: {name} should be {kind}, got {type(body[name])}"
        )


def test_catalog_contract(http, urls):
    products = http.get(f"{urls['product']}/api/v1/products").json()
    for product in products:
        assert_fields(product, PRODUCT_SUMMARY_FIELDS, "ProductSummary")
        assert product["averageRating"] is None or isinstance(
            product["averageRating"], (int, float)
        )


def test_aggregate_contract(http, urls):
    body = http.get(f"{urls['product']}/api/v1/products/SKU-1001").json()
    assert_fields(
        body,
        {
            "productId": str,
            "details": dict,
            "reviews": list,
            "degraded": bool,
        },
        "ProductAggregate",
    )
    assert "rating" in body  # RatingSummary | null
    assert_fields(body["details"], DETAILS_FIELDS, "ProductDetails")
    assert_fields(body["rating"], RATING_FIELDS, "RatingSummary")
    for review in body["reviews"]:
        assert_fields(review, REVIEW_FIELDS, "Review")


def test_details_service_contract(http, urls):
    items = http.get(f"{urls['details']}/api/v1/details").json()
    assert len(items) >= 3
    for item in items:
        assert_fields(item, DETAILS_FIELDS, "ProductDetails")
        assert all(
            isinstance(k, str) and isinstance(v, str)
            for k, v in item["specifications"].items()
        )


def test_reviews_service_contract(http, urls):
    reviews = http.get(f"{urls['reviews']}/api/v1/reviews/SKU-1002").json()
    assert isinstance(reviews, list)
    for review in reviews:
        assert_fields(review, REVIEW_FIELDS, "Review")
        assert 1 <= review["rating"] <= 5


def test_ratings_service_contract(http, urls):
    summaries = http.get(f"{urls['ratings']}/api/v1/ratings").json()
    assert len(summaries) >= 3
    for summary in summaries:
        assert_fields(summary, RATING_FIELDS, "RatingSummary")
        assert set(summary["distribution"]) == {"1", "2", "3", "4", "5"}


def test_error_responses_are_json(http, urls):
    """Clients must never receive an HTML/plaintext error body."""
    for url in (
        f"{urls['product']}/api/v1/products/SKU-9999",
        f"{urls['details']}/api/v1/details/SKU-9999",
    ):
        response = http.get(url)
        assert response.status_code == 404
        assert "json" in response.headers["content-type"]
