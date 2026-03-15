/**
 * RentSpree API client for tenant screening integration.
 *
 * RentSpree provides TransUnion-powered tenant screening:
 *   - Credit report & score (ResidentScore)
 *   - Criminal background check
 *   - Eviction history
 *
 * The tenant pays ~$40 for the screening. PM initiates by
 * generating an "ApplyLink" which is emailed to the applicant.
 *
 * Environment variables:
 *   RENTSPREE_API_KEY       — Partner API key from RentSpree dashboard
 *   RENTSPREE_API_URL       — API base URL (default: https://api.rentspree.com/v2)
 *   RENTSPREE_WEBHOOK_SECRET — Secret for verifying webhook signatures
 */

const API_URL = process.env.RENTSPREE_API_URL || "https://api.rentspree.com/v2";
const API_KEY = process.env.RENTSPREE_API_KEY || "";
const WEBHOOK_SECRET = process.env.RENTSPREE_WEBHOOK_SECRET || "";

/** Whether RentSpree is configured and ready to use */
export function isRentSpreeConfigured(): boolean {
  return !!API_KEY;
}

interface ApplyLinkRequest {
  applicantEmail: string;
  applicantName: string;
  propertyAddress: string;
  unitNumber?: string;
  landlordEmail: string;
  landlordName: string;
}

interface ApplyLinkResponse {
  id: string;
  applyLink: string;
  status: string;
}

/**
 * Create a RentSpree ApplyLink for tenant screening.
 * The tenant receives an email with the link to complete screening.
 */
export async function createApplyLink(data: ApplyLinkRequest): Promise<ApplyLinkResponse> {
  if (!API_KEY) {
    throw new Error("RentSpree API key is not configured");
  }

  const response = await fetch(`${API_URL}/screening-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      applicant: {
        email: data.applicantEmail,
        firstName: data.applicantName.split(" ")[0],
        lastName: data.applicantName.split(" ").slice(1).join(" ") || data.applicantName,
      },
      property: {
        address: data.propertyAddress,
        unit: data.unitNumber || undefined,
      },
      landlord: {
        email: data.landlordEmail,
        name: data.landlordName,
      },
      // Tenant pays for screening (default model)
      paymentModel: "APPLICANT_PAYS",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`RentSpree API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    applyLink: result.applyLink || result.apply_link || result.url,
    status: result.status || "PENDING",
  };
}

interface ScreeningStatusResponse {
  id: string;
  status: string;
  creditScore?: number;
  creditResult?: string;
  criminalResult?: string;
  evictionResult?: string;
  completedAt?: string;
}

/**
 * Check the status of a screening request.
 */
export async function getScreeningStatus(rentspreeId: string): Promise<ScreeningStatusResponse> {
  if (!API_KEY) {
    throw new Error("RentSpree API key is not configured");
  }

  const response = await fetch(`${API_URL}/screening-requests/${rentspreeId}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`RentSpree API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    status: result.status,
    creditScore: result.creditScore ?? result.credit_score,
    creditResult: result.creditResult ?? result.credit_result,
    criminalResult: result.criminalResult ?? result.criminal_result,
    evictionResult: result.evictionResult ?? result.eviction_result,
    completedAt: result.completedAt ?? result.completed_at,
  };
}

/**
 * Verify a webhook payload from RentSpree using HMAC signature.
 */
export function verifyWebhook(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;

  // RentSpree typically uses HMAC-SHA256 for webhook verification
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Map RentSpree webhook event status to our ScreeningStatus enum.
 */
export function mapRentSpreeStatus(status: string): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "CANCELLED" {
  const normalized = status.toUpperCase().replace(/[_-]/g, "");
  switch (normalized) {
    case "PENDING":
    case "SENT":
    case "INVITED":
      return "PENDING";
    case "INPROGRESS":
    case "STARTED":
    case "PROCESSING":
      return "IN_PROGRESS";
    case "COMPLETED":
    case "COMPLETE":
    case "READY":
      return "COMPLETED";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}
