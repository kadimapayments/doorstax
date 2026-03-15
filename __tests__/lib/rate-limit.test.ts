import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Upstash modules BEFORE importing rate-limit
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@upstash/ratelimit", () => {
  const mockLimit = vi.fn();
  return {
    Ratelimit: Object.assign(
      vi.fn().mockImplementation(() => ({ limit: mockLimit })),
      { slidingWindow: vi.fn() }
    ),
    __mockLimit: mockLimit,
  };
});

describe("rate-limit", () => {
  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for header", async () => {
      const { getClientIp } = await import("@/lib/rate-limit");
      const req = new Request("http://localhost/api/test", {
        headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
      });
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("extracts IP from x-real-ip header", async () => {
      const { getClientIp } = await import("@/lib/rate-limit");
      const req = new Request("http://localhost/api/test", {
        headers: { "x-real-ip": "5.6.7.8" },
      });
      expect(getClientIp(req)).toBe("5.6.7.8");
    });

    it("returns 127.0.0.1 when no IP headers present", async () => {
      const { getClientIp } = await import("@/lib/rate-limit");
      const req = new Request("http://localhost/api/test");
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("rateLimitResponse", () => {
    it("returns a 429 response with Retry-After header", async () => {
      const { rateLimitResponse } = await import("@/lib/rate-limit");
      const reset = Date.now() + 30_000;
      const res = rateLimitResponse(reset);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      const body = await res.json();
      expect(body.error).toContain("Too many requests");
    });

    it("sets Retry-After to at least 1 second", async () => {
      const { rateLimitResponse } = await import("@/lib/rate-limit");
      const reset = Date.now() - 1000; // In the past
      const res = rateLimitResponse(reset);
      expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    });
  });

  describe("no-op fallback", () => {
    it("allows requests when Upstash env vars are missing", async () => {
      // Clear any env vars
      const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
      const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      // Re-import to get fresh module state
      vi.resetModules();
      vi.mock("@upstash/redis", () => ({
        Redis: vi.fn().mockImplementation(() => ({})),
      }));
      vi.mock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(vi.fn(), { slidingWindow: vi.fn() }),
      }));

      const mod = await import("@/lib/rate-limit");
      const result = await mod.authLimiter.limit("test-ip");
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(999);

      // Restore
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    });
  });
});
