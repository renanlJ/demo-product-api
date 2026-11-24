import { Controller, Get, Param } from "@nestjs/common";
import {
  ProductAggregate,
  ProductsService,
  ProductSummary,
} from "./products.service";

/** Public product endpoints consumed by demo-commerce-web. */
@Controller("api/v1/products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  listProducts(): Promise<ProductSummary[]> {
    return this.products.listProducts();
  }

  @Get(":productId")
  getProduct(@Param("productId") productId: string): Promise<ProductAggregate> {
    return this.products.getProduct(productId);
  }
}
