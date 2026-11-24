import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import axios from "axios";
import {
  DownstreamService,
  ProductDetails,
  RatingSummary,
  Review,
} from "../downstream/downstream.service";

export interface ProductSummary {
  productId: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  averageRating: number | null;
}

export interface ProductAggregate {
  productId: string;
  details: ProductDetails;
  reviews: Review[];
  rating: RatingSummary | null;
  degraded: boolean;
}

/**
 * Orchestration layer: aggregates details, reviews and ratings into a single
 * product view. Details failures are fatal (502/404); reviews and ratings
 * failures degrade gracefully.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly downstream: DownstreamService) {}

  async listProducts(): Promise<ProductSummary[]> {
    const [details, ratings] = await Promise.allSettled([
      this.downstream.listDetails(),
      this.downstream.listRatings(),
    ]);
    if (details.status === "rejected") {
      throw normalizeDownstreamError(details.reason);
    }
    const averageByProduct = new Map<string, number>();
    if (ratings.status === "fulfilled") {
      for (const r of ratings.value) {
        averageByProduct.set(r.productId, r.average);
      }
    }
    return details.value.map((d) => ({
      productId: d.productId,
      name: d.name,
      category: d.category,
      price: d.price,
      currency: d.currency,
      averageRating: averageByProduct.get(d.productId) ?? null,
    }));
  }

  async getProduct(productId: string): Promise<ProductAggregate> {
    let details: ProductDetails;
    try {
      details = await this.downstream.getDetails(productId);
    } catch (err) {
      throw normalizeDownstreamError(err);
    }

    const [reviews, rating] = await Promise.allSettled([
      this.downstream.getReviews(productId),
      this.downstream.getRating(productId),
    ]);

    return {
      productId,
      details,
      reviews: reviews.status === "fulfilled" ? reviews.value : [],
      rating: rating.status === "fulfilled" ? rating.value : null,
      degraded: reviews.status === "rejected" || rating.status === "rejected",
    };
  }
}

function normalizeDownstreamError(err: unknown): Error {
  if (axios.isAxiosError(err) && err.response?.status === 404) {
    return new NotFoundException("product not found");
  }
  return new BadGatewayException("upstream service unavailable");
}
