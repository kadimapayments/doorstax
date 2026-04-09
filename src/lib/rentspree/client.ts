import { getRentSpreeToken, isRentSpreeConfigured } from "./auth";

const RENTSPREE_API_BASE = "https://api.rentspree.com/partners/v2";

export interface ScreeningOptions {
  creditReport: boolean;
  criminal: boolean;
  eviction: boolean;
  application: boolean;
  payerType: "landlord" | "renter";
}

export interface ApplyLinkResponse {
  screeningOption: {
    _id: string;
    payerType: string;
    selectedScreeningOption: {
      creditReport: boolean;
      criminal: boolean;
      eviction: boolean;
      application: boolean;
    };
  };
  applyLink: {
    shortenLink: string;
    fullLink: string;
  };
}

export async function generateApplyLink(
  options: ScreeningOptions
): Promise<ApplyLinkResponse> {
  const token = await getRentSpreeToken();
  const res = await fetch(
    RENTSPREE_API_BASE + "/tenant-screening/without-property/link",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        screeningOption: {
          payerType: options.payerType,
          selectedScreeningOption: {
            creditReport: options.creditReport,
            criminal: options.criminal,
            eviction: options.eviction,
            application: options.application,
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[rentspree] Generate link error:", res.status, err);
    throw new Error(
      "RentSpree API error: " + (err.message || err.code || res.status)
    );
  }

  return res.json();
}

export { isRentSpreeConfigured };
