import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import nock from "nock";
import request from "supertest";
import { AppModule } from "../src/app.module";

const DETAILS = "http://details.test";
const REVIEWS = "http://reviews.test";
const RATINGS = "http://ratings.test";

const detailsBody = {
  productId: "SKU-1001",
  name: "Aurora Coffee Maker",
  description: "desc",
  category: "Home Appliances",
  price: 129.99,
  currency: "USD",
  specifications: { capacity: "1.8L" },
};

describe("demo-product-api (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    nock.cleanAll();
    nock(DETAILS).get("/healthz").reply(200, { status: "ok" });
    nock(REVIEWS).get("/healthz").reply(200, { status: "ok" });
    nock(RATINGS).get("/healthz").reply(200, { status: "ok" });
  });

  it("GET /healthz", () => {
    return request(app.getHttpServer()).get("/healthz").expect(200);
  });

  it("GET /readyz aggregates downstream health", () => {
    return request(app.getHttpServer())
      .get("/readyz")
      .expect(200)
      .expect({ status: "ready" });
  });

  it("GET /readyz fails when a downstream is down", async () => {
    nock.cleanAll();
    nock(DETAILS).get("/healthz").reply(200, { status: "ok" });
    nock(RATINGS).get("/healthz").reply(200, { status: "ok" });
    nock(REVIEWS).get("/healthz").reply(500);

    const res = await request(app.getHttpServer()).get("/readyz").expect(503);
    expect(res.body.unreachable).toContain("reviews");
  });

  it("GET /api/v1/products/:id returns aggregated product", async () => {
    nock(DETAILS).get("/api/v1/details/SKU-1001").reply(200, detailsBody);
    nock(REVIEWS)
      .get("/api/v1/reviews/SKU-1001")
      .reply(200, [
        {
          id: "rev-1",
          productId: "SKU-1001",
          reviewer: "alice",
          text: "great",
          rating: 5,
          createdAt: "2026-09-14T08:32:00Z",
        },
      ]);
    nock(RATINGS)
      .get("/api/v1/ratings/SKU-1001")
      .reply(200, {
        productId: "SKU-1001",
        average: 4.43,
        count: 7,
        distribution: { "5": 4 },
      });

    const res = await request(app.getHttpServer())
      .get("/api/v1/products/SKU-1001")
      .expect(200);

    expect(res.body).toMatchObject({
      productId: "SKU-1001",
      degraded: false,
      details: { name: "Aurora Coffee Maker" },
    });
    expect(res.body.reviews).toHaveLength(1);
    expect(res.body.rating.average).toBe(4.43);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("GET /api/v1/products/:id degrades when reviews are down", async () => {
    nock(DETAILS).get("/api/v1/details/SKU-1001").reply(200, detailsBody);
    nock(REVIEWS).get("/api/v1/reviews/SKU-1001").reply(500);
    nock(RATINGS)
      .get("/api/v1/ratings/SKU-1001")
      .reply(200, { productId: "SKU-1001", average: 4.4, count: 7 });

    const res = await request(app.getHttpServer())
      .get("/api/v1/products/SKU-1001")
      .expect(200);

    expect(res.body.degraded).toBe(true);
    expect(res.body.reviews).toEqual([]);
  });

  it("GET /api/v1/products/:id propagates 404", async () => {
    nock(DETAILS).get("/api/v1/details/SKU-9999").reply(404);

    await request(app.getHttpServer())
      .get("/api/v1/products/SKU-9999")
      .expect(404);
  });

  it("GET /api/v1/products/:id is 502 when details are down", async () => {
    nock(DETAILS).get("/api/v1/details/SKU-1001").reply(500);

    await request(app.getHttpServer())
      .get("/api/v1/products/SKU-1001")
      .expect(502);
  });

  it("GET /metrics exposes prometheus format", async () => {
    const res = await request(app.getHttpServer()).get("/metrics").expect(200);
    expect(res.text).toContain("http_requests_total");
  });
});
