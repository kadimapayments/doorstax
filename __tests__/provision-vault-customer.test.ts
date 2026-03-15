import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("@/lib/db", () => ({
  db: {
    tenantProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/kadima/customer-vault", () => ({
  createCustomer: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

import { provisionVaultCustomer } from "@/lib/kadima/provision-vault-customer";
import { db } from "@/lib/db";
import { createCustomer } from "@/lib/kadima/customer-vault";

const mockFindUnique = db.tenantProfile.findUnique as ReturnType<typeof vi.fn>;
const mockUpdate = db.tenantProfile.update as ReturnType<typeof vi.fn>;
const mockCreateCustomer = createCustomer as ReturnType<typeof vi.fn>;

describe("provisionVaultCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates vault customer and stores ID on TenantProfile", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: null,
    });
    mockCreateCustomer.mockResolvedValue({
      data: { id: "vault_cust_123" },
    });
    mockUpdate.mockResolvedValue({});

    const result = await provisionVaultCustomer({
      tenantProfileId: "tp_1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    expect(result).toEqual({ customerId: "vault_cust_123", alreadyExisted: false });
    expect(mockCreateCustomer).toHaveBeenCalledWith({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: undefined,
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "tp_1" },
      data: { kadimaCustomerId: "vault_cust_123" },
    });
  });

  it("returns existing ID without calling Kadima API (idempotency)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: "vault_existing_456",
    });

    const result = await provisionVaultCustomer({
      tenantProfileId: "tp_1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    expect(result).toEqual({ customerId: "vault_existing_456", alreadyExisted: true });
    expect(mockCreateCustomer).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns null without throwing on Kadima API failure", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: null,
    });
    mockCreateCustomer.mockRejectedValue(new Error("Kadima API timeout"));

    const result = await provisionVaultCustomer({
      tenantProfileId: "tp_1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    expect(result).toEqual({ customerId: null, alreadyExisted: false });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns null when Kadima returns no customer ID", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: null,
    });
    mockCreateCustomer.mockResolvedValue({ data: {} });

    const result = await provisionVaultCustomer({
      tenantProfileId: "tp_1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    expect(result).toEqual({ customerId: null, alreadyExisted: false });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns null gracefully when TenantProfile not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await provisionVaultCustomer({
      tenantProfileId: "tp_nonexistent",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    expect(result).toEqual({ customerId: null, alreadyExisted: false });
    expect(mockCreateCustomer).not.toHaveBeenCalled();
  });

  it("passes phone when provided", async () => {
    mockFindUnique.mockResolvedValue({
      id: "tp_1",
      kadimaCustomerId: null,
    });
    mockCreateCustomer.mockResolvedValue({
      data: { id: "vault_cust_789" },
    });
    mockUpdate.mockResolvedValue({});

    await provisionVaultCustomer({
      tenantProfileId: "tp_1",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-1234",
    });

    expect(mockCreateCustomer).toHaveBeenCalledWith({
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "555-1234",
    });
  });
});
