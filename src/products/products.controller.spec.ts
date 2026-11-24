import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

describe("ProductsController", () => {
  it("delegates list to the service", async () => {
    const service = {
      listProducts: jest.fn().mockResolvedValue([{ productId: "SKU-1001" }]),
      getProduct: jest.fn(),
    } as unknown as ProductsService;
    const controller = new ProductsController(service);

    const result = await controller.listProducts();

    expect(service.listProducts).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("delegates get by id to the service", async () => {
    const service = {
      listProducts: jest.fn(),
      getProduct: jest
        .fn()
        .mockResolvedValue({ productId: "SKU-1002", degraded: false }),
    } as unknown as ProductsService;
    const controller = new ProductsController(service);

    const result = await controller.getProduct("SKU-1002");

    expect(service.getProduct).toHaveBeenCalledWith("SKU-1002");
    expect(result.productId).toBe("SKU-1002");
  });
});
