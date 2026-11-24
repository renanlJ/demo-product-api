import { Inject, Injectable } from "@nestjs/common";
import axios from "axios";
import { APP_CONFIG, AppConfig } from "../config/configuration";
import { getRequestContext, outboundTraceparent } from "../observability/als";

export interface ProductDetails {
  productId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  specifications: Record<string, string>;
}

export interface Review {
  id: string;
  productId: string;
  reviewer: string;
  text: string;
  rating: number;
  createdAt: string;
}

export interface RatingSummary {
  productId: string;
  average: number;
  count: number;
  distribution: Record<string, number>;
}

export interface DownstreamStatus {
  name: string;
  reachable: boolean;
}

/** Typed HTTP client for the details, reviews and ratings services. */
@Injectable()
export class DownstreamService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private headers(): Record<string, string> {
    const ctx = getRequestContext();
    const headers: Record<string, string> = {
      traceparent: outboundTraceparent(ctx),
    };
    if (ctx?.requestId) {
      headers["X-Request-ID"] = ctx.requestId;
    }
    return headers;
  }

  private async get<T>(url: string): Promise<T> {
    const response = await axios.get<T>(url, {
      headers: this.headers(),
      timeout: this.config.requestTimeoutMs,
    });
    return response.data;
  }

  listDetails(): Promise<ProductDetails[]> {
    return this.get(`${this.config.detailsApiUrl}/api/v1/details`);
  }

  getDetails(productId: string): Promise<ProductDetails> {
    return this.get(`${this.config.detailsApiUrl}/api/v1/details/${productId}`);
  }

  getReviews(productId: string): Promise<Review[]> {
    return this.get(`${this.config.reviewsApiUrl}/api/v1/reviews/${productId}`);
  }

  getRating(productId: string): Promise<RatingSummary> {
    return this.get(`${this.config.ratingsApiUrl}/api/v1/ratings/${productId}`);
  }

  listRatings(): Promise<RatingSummary[]> {
    return this.get(`${this.config.ratingsApiUrl}/api/v1/ratings`);
  }

  /** Probes each downstream /healthz endpoint for the readiness check. */
  async ping(): Promise<DownstreamStatus[]> {
    const targets = [
      { name: "details", url: this.config.detailsApiUrl },
      { name: "reviews", url: this.config.reviewsApiUrl },
      { name: "ratings", url: this.config.ratingsApiUrl },
    ];
    const results = await Promise.allSettled(
      targets.map((t) =>
        axios.get(`${t.url}/healthz`, {
          timeout: Math.min(this.config.requestTimeoutMs, 1000),
        }),
      ),
    );
    return targets.map((t, i) => ({
      name: t.name,
      reachable: results[i].status === "fulfilled",
    }));
  }
}
