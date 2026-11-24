"""Functional tests: catalog and aggregated product endpoints."""

from conftest import KNOWN_SKUS


def test_catalog_lists_all_products(http, urls):
    response = http.get(f"{urls['product']}/api/v1/products")
    assert response.status_code == 200
    products = response.json()
    assert isinstance(products, list)
    assert {p["productId"] for p in products} == set(KNOWN_SKUS)
    for product in products:
        assert product["name"]
        assert product["category"]
        assert product["price"] > 0
        assert product["currency"] == "USD"
        assert product["averageRating"] > 0


def test_product_detail_aggregates_all_downstreams(http, urls):
    response = http.get(f"{urls['product']}/api/v1/products/SKU-1001")
    assert response.status_code == 200
    body = response.json()

    assert body["productId"] == "SKU-1001"
    assert body["degraded"] is False

    details = body["details"]
    assert details["name"] == "Aurora Coffee Maker"
    assert details["category"]
    assert details["price"] > 0
    assert isinstance(details["specifications"], dict)

    reviews = body["reviews"]
    assert len(reviews) >= 1
    for review in reviews:
        assert review["productId"] == "SKU-1001"
        assert review["reviewer"]
        assert review["text"]
        assert 1 <= review["rating"] <= 5
        assert review["createdAt"]

    rating = body["rating"]
    assert rating["average"] > 0
    assert rating["count"] >= 1
    assert sum(rating["distribution"].values()) == rating["count"]


def test_product_detail_404_for_unknown_sku(http, urls):
    response = http.get(f"{urls['product']}/api/v1/products/SKU-9999")
    assert response.status_code == 404


def test_leaf_services_404_for_unknown_sku(http, urls):
    assert http.get(f"{urls['details']}/api/v1/details/SKU-9999").status_code == 404
    assert http.get(f"{urls['reviews']}/api/v1/reviews/SKU-9999").status_code == 404
    assert http.get(f"{urls['ratings']}/api/v1/ratings/SKU-9999").status_code == 404


def test_nginx_proxies_api_to_product_api(http, urls):
    """The storefront container must expose the API through same-origin /api/."""
    response = http.get(f"{urls['web']}/api/v1/products")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert len(response.json()) == len(KNOWN_SKUS)


def test_storefront_serves_spa(http, urls):
    response = http.get(f"{urls['web']}/")
    assert response.status_code == 200
    assert "<title>Demo Commerce</title>" in response.text
    # Built assets must resolve (Vite bundle is hashed at build time).
    assert "/assets/index-" in response.text


def test_full_chain_through_storefront(http, urls):
    """Browser path: SPA host proxies the aggregate call end-to-end."""
    response = http.get(f"{urls['web']}/api/v1/products/SKU-1002")
    assert response.status_code == 200
    body = response.json()
    assert body["details"]["name"] == "Nimbus Mechanical Keyboard"
    assert body["degraded"] is False
