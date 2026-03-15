/**
 * IP Security Check Service
 * Uses vpnapi.io to detect VPN/proxy/Tor and non-US geolocation.
 * Includes in-memory TTL cache and graceful degradation.
 */
import axios from "axios";

const VPNAPI_KEY = process.env.VPNAPI_KEY;
const VPNAPI_URL = "https://vpnapi.io/api";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REQUEST_TIMEOUT_MS = 5000;

interface IpCheckResult {
  allowed: boolean;
  code?: "VPN_DETECTED" | "GEO_BLOCKED";
  message?: string;
  country?: string;
}

interface CacheEntry {
  result: IpCheckResult;
  timestamp: number;
}

// In-memory cache
const cache = new Map<string, CacheEntry>();

// Clean expired entries every 10 minutes
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of cache) {
      if (now - entry.timestamp > CACHE_TTL_MS) cache.delete(ip);
    }
  }, 10 * 60 * 1000);
  if (timer.unref) timer.unref();
}

/**
 * Extract client IP from Next.js Request headers.
 * Next.js doesn't have req.ip like Express — we read standard proxy headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated; first is the real client
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Normalize IP address (strip IPv4-mapped IPv6 prefix)
 */
function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

/**
 * Check an IP for VPN/proxy/Tor usage and US geolocation.
 */
export async function checkIp(rawIp: string): Promise<IpCheckResult> {
  // No API key configured — skip check
  if (!VPNAPI_KEY) return { allowed: true };

  const ip = normalizeIp(rawIp);

  // Localhost / unknown — always allow (development)
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown") {
    return { allowed: true };
  }

  // Check cache
  const cached = cache.get(ip);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const { data } = await axios.get(`${VPNAPI_URL}/${ip}`, {
      params: { key: VPNAPI_KEY },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const { security, location } = data;
    let result: IpCheckResult;

    // Check VPN / proxy / Tor / relay
    if (security && (security.vpn || security.proxy || security.tor || security.relay)) {
      result = {
        allowed: false,
        code: "VPN_DETECTED",
        message: "VPN or proxy detected. Please disable your VPN and try again.",
      };
    }
    // Check geolocation — must be US
    else if (location && location.country_code && location.country_code !== "US") {
      result = {
        allowed: false,
        code: "GEO_BLOCKED",
        message: "This application is only available within the United States.",
        country: location.country_code,
      };
    }
    // All clear
    else {
      result = { allowed: true };
    }

    cache.set(ip, { result, timestamp: Date.now() });
    return result;
  } catch (err: unknown) {
    // Graceful degradation — if vpnapi.io is down, allow through
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("vpnapi.io check failed (allowing through):", message);
    return { allowed: true };
  }
}
