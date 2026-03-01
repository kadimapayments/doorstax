import axios, { type AxiosInstance, type AxiosError } from "axios";

const BASE_URL =
  process.env.KADIMA_API_BASE ||
  "https://sandbox-dashboard.maverickpayments.com/api";
const API_TOKEN = process.env.KADIMA_API_TOKEN;

if (!API_TOKEN && process.env.NODE_ENV === "production") {
  throw new Error("KADIMA_API_TOKEN is required");
}

export const kadimaClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

/**
 * Retry wrapper — retries on 5xx or network errors with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 1000
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      // Only retry on 5xx or network errors
      if (status && status < 500) throw err;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error("Retry exhausted"); // unreachable
}

/**
 * Extract error message from Kadima API error response.
 */
export function getKadimaError(err: unknown): string {
  const axiosErr = err as AxiosError<{ error?: string; message?: string }>;
  return (
    axiosErr.response?.data?.error ||
    axiosErr.response?.data?.message ||
    axiosErr.message ||
    "Kadima API error"
  );
}
