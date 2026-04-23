import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    tenantProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/kadima/merchant-context", () => ({
  getMerchantCredentialsForTenant: vi.fn(),
}));

vi.mock("@/lib/kadima/merchant-vault", () => ({
  merchantListCards: vi.fn(),
}));

import { syncTenantCardFromVault } from "@/lib/kadima/sync-tenant-card";
import { db } from "@/lib/db";
import { getMerchantCredentialsForTenant } from "@/lib/kadima/merchant-context";
import { merchantListCards } from "@/lib/kadima/merchant-vault";

const findUnique = db.tenantProfile.findUnique as ReturnType<typeof vi.fn>;
const update = db.tenantProfile.update as ReturnType<typeof vi.fn>;
const getCreds = getMerchantCredentialsForTenant as ReturnType<typeof vi.fn>;
const listCards = merchantListCards as ReturnType<typeof vi.fn>;

const FAKE_CREDS = {
  apiKey: "key",
  terminalId: "7000",
  pmUserId: "pm_1",
  source: "database" as const,
};

describe("syncTenantCardFromVault", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns found:false when the tenant has no kadimaCustomerId yet", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: null,
      kadimaCardTokenId: null,
    });

    const result = await syncTenantCardFromVault("tp_1");

    expect(result).toEqual({ found: false, updated: false });
    expect(getCreds).not.toHaveBeenCalled();
    expect(listCards).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("returns found:false when the merchant vault has no cards (mid-poll)", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "cust_42",
      kadimaCardTokenId: null,
    });
    getCreds.mockResolvedValue(FAKE_CREDS);
    listCards.mockResolvedValue({ items: [] });

    const result = await syncTenantCardFromVault("tp_1");

    expect(result).toEqual({
      found: false,
      customerId: "cust_42",
      updated: false,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("persists the latest card with brand+last4 and marks paymentMethodType=card", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "cust_42",
      kadimaCardTokenId: null,
    });
    getCreds.mockResolvedValue(FAKE_CREDS);
    listCards.mockResolvedValue({
      items: [
        { id: 1, token: "tok_old", number: "411111******1111", bin: { brand: "Visa" } },
        { id: 2, token: "tok_new", number: "555555******4444", bin: { brand: "MasterCard" }, lastFour: "4444" },
      ],
    });
    update.mockResolvedValue({});

    const result = await syncTenantCardFromVault("tp_1");

    expect(result.found).toBe(true);
    expect(result.cardId).toBe("2");
    expect(result.brand).toBe("mastercard");
    expect(result.last4).toBe("4444");
    expect(result.updated).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: "tp_1" },
      data: {
        kadimaCardTokenId: "tok_new",
        cardBrand: "mastercard",
        cardLast4: "4444",
        paymentMethodType: "card",
      },
    });
  });

  it("falls back to first-digit brand heuristic when bin.brand is missing", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "cust_42",
      kadimaCardTokenId: null,
    });
    getCreds.mockResolvedValue(FAKE_CREDS);
    listCards.mockResolvedValue({
      items: [{ id: 7, token: "tok_x", number: "4111111111111111" }],
    });
    update.mockResolvedValue({});

    const result = await syncTenantCardFromVault("tp_1");

    expect(result.brand).toBe("visa");
    expect(result.last4).toBe("1111");
  });

  it("does not write to the DB when the card is already in sync", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "cust_42",
      kadimaCardTokenId: "tok_already_here",
    });
    getCreds.mockResolvedValue(FAKE_CREDS);
    listCards.mockResolvedValue({
      items: [{ id: 5, token: "tok_already_here", lastFour: "1234", bin: { brand: "visa" } }],
    });

    const result = await syncTenantCardFromVault("tp_1");

    expect(result.found).toBe(true);
    expect(result.updated).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the card id as the token when the vault returns no token field", async () => {
    findUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "cust_42",
      kadimaCardTokenId: null,
    });
    getCreds.mockResolvedValue(FAKE_CREDS);
    listCards.mockResolvedValue({
      items: [{ id: 9, lastFour: "9999", bin: { brand: "amex" } }],
    });
    update.mockResolvedValue({});

    await syncTenantCardFromVault("tp_1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "tp_1" },
      data: {
        kadimaCardTokenId: "9",
        cardBrand: "amex",
        cardLast4: "9999",
        paymentMethodType: "card",
      },
    });
  });
});
