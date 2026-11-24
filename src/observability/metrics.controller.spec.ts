import { MetricsController } from "./metrics.controller";
import { httpRequestsTotal } from "./metrics";

describe("MetricsController", () => {
  it("renders the prometheus registry", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/x", status: "200" });
    const body = await new MetricsController().metrics();

    expect(body).toContain("http_requests_total");
    expect(body).toContain('route="/x"');
  });
});
