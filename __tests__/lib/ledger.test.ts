import { describe, it, expect, beforeEach } from "vitest";
import { prismaMock } from "../mocks/db";
import { Decimal } from "@prisma/client/runtime/library";
import {
  createChargeEntry,
  recordPayment,
  recordReversal,
  createAdjustment,
  periodKeyFromDate,
} from "@/lib/ledger";

// The db mock is set up by __tests__/mocks/db.ts via vi.mock

describe("periodKeyFromDate", () => {
  it("formats January correctly", () => {
    expect(periodKeyFromDate(new Date("2025-01-15"))).toBe("2025-01");
  });

  it("formats December correctly", () => {
    expect(periodKeyFromDate(new Date("2025-12-01"))).toBe("2025-12");
  });

  it("pads single-digit months with zero", () => {
    expect(periodKeyFromDate(new Date("2025-03-05"))).toBe("2025-03");
  });
});

describe("createChargeEntry", () => {
  it("creates a charge with correct balance calculation", async () => {
    const mockEntry = {
      id: "entry-1",
      tenantId: "tenant-1",
      unitId: "unit-1",
      type: "CHARGE",
      amount: new Decimal("1500"),
      balanceAfter: new Decimal("1500"),
      periodKey: "2025-03",
      description: "March rent",
      paymentId: null,
      createdById: null,
      locked: true,
      metadata: null,
      createdAt: new Date(),
    };

    // Mock the transaction — execute the callback with the mock client
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      // Inside the transaction, ledgerEntry.findFirst (idempotency check) returns null
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce(null);
      // getLatestBalance: no previous balance
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce(null);
      // create
      prismaMock.ledgerEntry.create.mockResolvedValueOnce(mockEntry as any);
      return fn(prismaMock);
    });

    const result = await createChargeEntry({
      tenantId: "tenant-1",
      unitId: "unit-1",
      amount: 1500,
      periodKey: "2025-03",
      description: "March rent",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("CHARGE");
    expect(result?.amount.toString()).toBe("1500");
  });

  it("returns null for duplicate charge (idempotency)", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      // Idempotency check returns existing entry
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce({
        id: "existing",
      } as any);
      return fn(prismaMock);
    });

    const result = await createChargeEntry({
      tenantId: "tenant-1",
      unitId: "unit-1",
      amount: 1500,
      periodKey: "2025-03",
    });

    expect(result).toBeNull();
  });

  it("returns null on P2002 unique constraint violation", async () => {
    const p2002 = new Error("Unique constraint");
    (p2002 as any).code = "P2002";
    prismaMock.$transaction.mockRejectedValueOnce(p2002);

    const result = await createChargeEntry({
      tenantId: "tenant-1",
      unitId: "unit-1",
      amount: 1500,
      periodKey: "2025-03",
    });

    expect(result).toBeNull();
  });
});

describe("recordPayment", () => {
  it("creates a payment entry with negative amount", async () => {
    const mockEntry = {
      id: "entry-2",
      tenantId: "tenant-1",
      unitId: "unit-1",
      type: "PAYMENT",
      amount: new Decimal("-1500"),
      balanceAfter: new Decimal("0"),
      periodKey: "2025-03",
      description: "Payment received",
      paymentId: "pay-1",
      createdById: null,
      locked: true,
      metadata: null,
      createdAt: new Date(),
    };

    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      // getLatestBalance returns previous balance of 1500
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce({
        balanceAfter: new Decimal("1500"),
      } as any);
      prismaMock.ledgerEntry.create.mockResolvedValueOnce(mockEntry as any);
      return fn(prismaMock);
    });

    const result = await recordPayment({
      tenantId: "tenant-1",
      unitId: "unit-1",
      paymentId: "pay-1",
      amount: 1500,
      periodKey: "2025-03",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("PAYMENT");
    expect(result?.amount.toString()).toBe("-1500");
    expect(result?.balanceAfter.toString()).toBe("0");
  });
});

describe("recordReversal", () => {
  it("creates a reversal entry with positive amount", async () => {
    const mockEntry = {
      id: "entry-3",
      tenantId: "tenant-1",
      unitId: "unit-1",
      type: "REVERSAL",
      amount: new Decimal("1500"),
      balanceAfter: new Decimal("1500"),
      periodKey: "2025-03",
      description: "Reversal: ACH return",
      paymentId: "pay-1",
      createdById: null,
      locked: true,
      metadata: { reason: "ACH return" },
      createdAt: new Date(),
    };

    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce({
        balanceAfter: new Decimal("0"),
      } as any);
      prismaMock.ledgerEntry.create.mockResolvedValueOnce(mockEntry as any);
      return fn(prismaMock);
    });

    const result = await recordReversal({
      tenantId: "tenant-1",
      unitId: "unit-1",
      paymentId: "pay-1",
      amount: 1500,
      periodKey: "2025-03",
      reason: "ACH return",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("REVERSAL");
    expect(result?.amount.toString()).toBe("1500");
  });
});

describe("createAdjustment", () => {
  it("creates an adjustment entry", async () => {
    const mockEntry = {
      id: "entry-4",
      tenantId: "tenant-1",
      unitId: "unit-1",
      type: "ADJUSTMENT",
      amount: new Decimal("-50"),
      balanceAfter: new Decimal("1450"),
      periodKey: "2025-03",
      description: "Late fee waiver",
      paymentId: null,
      createdById: "admin-1",
      locked: true,
      metadata: { adjustedBy: "admin-1" },
      createdAt: new Date(),
    };

    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      prismaMock.ledgerEntry.findFirst.mockResolvedValueOnce({
        balanceAfter: new Decimal("1500"),
      } as any);
      prismaMock.ledgerEntry.create.mockResolvedValueOnce(mockEntry as any);
      return fn(prismaMock);
    });

    const result = await createAdjustment({
      tenantId: "tenant-1",
      unitId: "unit-1",
      amount: -50,
      periodKey: "2025-03",
      description: "Late fee waiver",
      createdById: "admin-1",
    });

    expect(result).not.toBeNull();
    expect(result?.type).toBe("ADJUSTMENT");
    expect(result?.description).toBe("Late fee waiver");
  });
});
