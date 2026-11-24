import axios from 'axios';
import { loadConfig } from '../config/configuration';
import { runWithContext } from '../observability/als';
import { DownstreamService } from './downstream.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const config = loadConfig({
  DETAILS_API_URL: 'http://details:1',
  REVIEWS_API_URL: 'http://reviews:2',
  RATINGS_API_URL: 'http://ratings:3',
  DOWNSTREAM_TIMEOUT_MS: '1500',
});

describe('DownstreamService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds the correct downstream URLs', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });
    const service = new DownstreamService(config);

    await service.getDetails('SKU-1001');
    await service.getReviews('SKU-1001');
    await service.getRating('SKU-1001');
    await service.listDetails();
    await service.listRatings();

    const urls = mockedAxios.get.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      'http://details:1/api/v1/details/SKU-1001',
      'http://reviews:2/api/v1/reviews/SKU-1001',
      'http://ratings:3/api/v1/ratings/SKU-1001',
      'http://details:1/api/v1/details',
      'http://ratings:3/api/v1/ratings',
    ]);
    expect(mockedAxios.get.mock.calls[0][1]?.timeout).toBe(1500);
  });

  it('propagates request id and traceparent headers', async () => {
    mockedAxios.get.mockResolvedValue({ data: {} });
    const service = new DownstreamService(config);

    await runWithContext(
      {
        requestId: 'req-xyz',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      () => service.getDetails('SKU-1001'),
    );

    const headers = mockedAxios.get.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers['X-Request-ID']).toBe('req-xyz');
    expect(headers['traceparent']).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/,
    );
  });

  it('ping reports reachability per downstream', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ data: {} });
    const service = new DownstreamService(config);

    const status = await service.ping();

    expect(status).toEqual([
      { name: 'details', reachable: true },
      { name: 'reviews', reachable: false },
      { name: 'ratings', reachable: true },
    ]);
  });
});
