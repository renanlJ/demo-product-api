export interface AppConfig {
  port: number;
  logLevel: string;
  failReadiness: boolean;
  detailsApiUrl: string;
  reviewsApiUrl: string;
  ratingsApiUrl: string;
  requestTimeoutMs: number;
}

export const APP_CONFIG = "APP_CONFIG";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: int(env.PORT, 3000),
    logLevel: env.LOG_LEVEL ?? "info",
    failReadiness: env.FAIL_READINESS === "true",
    detailsApiUrl: env.DETAILS_API_URL ?? "http://localhost:8081",
    reviewsApiUrl: env.REVIEWS_API_URL ?? "http://localhost:8000",
    ratingsApiUrl: env.RATINGS_API_URL ?? "http://localhost:8083",
    requestTimeoutMs: int(env.DOWNSTREAM_TIMEOUT_MS, 2000),
  };
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
