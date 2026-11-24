import { BadGatewayException, NotFoundException } from "@nestjs/common";
import { AxiosError } from "axios";
import { DownstreamService } from "../downstream/downstream.service";
import { ProductsService } from "./products.service";

const details = {
  productId: "SKU-1001",
  name: "Aurora Coffee Maker",
  description: "desc",
  category: "Home Appliances",
  price: 129.99,
  currency: "USD",
  specifications: { capacity: "1.8L" },
};

const reviews = [
  {
    id: "rev-1",
    productId: "SKU-1001",
    reviewer: "alice",
    text: "great",
    rating: 5,
    createdAt: "2026-09-14T08:32:00Z",
  },
];

const rating = {
  productId: "SKU-1001",
  average: 4.43,
  count: 7,
  distribution: { "1": 0, "2": 0, "3": 1, "4": 2, "5": 4 },
};

function mockDownstream(overrides: Partial<DownstreamService> = {}) {
  return {
    listDetails: jest.fn().mockResolvedValue([details]),
    getDetails: jest.fn().mockResolvedValue(details),
    getReviews: jest.fn().mockResolvedValue(reviews),
    getRating: jest.fn().mockResolvedValue(rating),
    listRatings: jest.fn().mockResolvedValue([rating]),
    ping: jest.fn(),
    ...overrides,
  } as unknown as DownstreamService;
}

describe("ProductsService", () => {
  it("aggregates details, reviews and rating", async () => {
    const service = new ProductsService(mockDownstream());

    const product = await service.getProduct("SKU-1001");

    expect(product.productId).toBe("SKU-1001");
    expect(product.details.name).toBe("Aurora Coffee Maker");
    expect(product.reviews).toHaveLength(1);
    expect(product.rating?.average).toBe(4.43);
    expect(product.degraded).toBe(false);
  });

  it("degrades gracefully when reviews are down", async () => {
    const downstream = mockDownstream({
      getReviews: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });
    const product = await new ProductsService(downstream).getProduct(
      "SKU-1001",
    );

    expect(product.degraded).toBe(true);
    expect(product.reviews).toEqual([]);
    expect(product.rating).not.toBeNull();
  });

  it("degrades gracefully when ratings are down", async () => {
    const downstream = mockDownstream({
      getRating: jest.fn().mockRejectedValue(new Error("timeout")),
    });
    const product = await new ProductsService(downstream).getProduct(
      "SKU-1001",
    );

    expect(product.degraded).toBe(true);
    expect(product.rating).toBeNull();
    expect(product.reviews).toHaveLength(1);
  });

  it("maps downstream 404 to NotFoundException", async () => {
    const axiosError = new AxiosError("not found");
    axiosError.response = { status: 404 } as never;
    const downstream = mockDownstream({
      getDetails: jest.fn().mockRejectedValue(axiosError),
    });

    await expect(
      new ProductsService(downstream).getProduct("SKU-9999"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("maps downstream outage to BadGatewayException", async () => {
    const downstream = mockDownstream({
      getDetails: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });

    await expect(
      new ProductsService(downstream).getProduct("SKU-1001"),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("lists products with merged average ratings", async () => {
    const service = new ProductsService(mockDownstream());
    const list = await service.listProducts();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      productId: "SKU-1001",
      averageRating: 4.43,
    });
  });

  it("lists products with null rating when ratings are down", async () => {
    const downstream = mockDownstream({
      listRatings: jest.fn().mockRejectedValue(new Error("down")),
    });
    const list = await new ProductsService(downstream).listProducts();

    expect(list[0].averageRating).toBeNull();
  });
});
