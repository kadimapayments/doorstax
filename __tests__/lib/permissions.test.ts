import { describe, it, expect } from "vitest";
import { getPermissions, hasPermission, hasAnyPermission } from "@/lib/permissions";

describe("permissions", () => {
  describe("getPermissions", () => {
    it("returns all MANAGER permissions", () => {
      const perms = getPermissions("MANAGER");
      expect(perms).toContain("properties:read");
      expect(perms).toContain("properties:write");
      expect(perms).toContain("payments:write");
      expect(perms).toContain("tickets:assign");
      expect(perms).toContain("leases:write");
      expect(perms).toContain("payouts:approve");
    });

    it("returns ACCOUNTING permissions (no write for properties)", () => {
      const perms = getPermissions("ACCOUNTING");
      expect(perms).toContain("payments:read");
      expect(perms).toContain("payments:write");
      expect(perms).toContain("expenses:write");
      expect(perms).not.toContain("properties:write");
      expect(perms).not.toContain("tenants:write");
    });

    it("returns CARETAKER permissions (limited scope)", () => {
      const perms = getPermissions("CARETAKER");
      expect(perms).toContain("properties:read");
      expect(perms).toContain("tickets:read");
      expect(perms).toContain("tickets:write");
      expect(perms).not.toContain("payments:read");
      expect(perms).not.toContain("leases:read");
    });

    it("returns SERVICE_TECH permissions (tickets only)", () => {
      const perms = getPermissions("SERVICE_TECH");
      expect(perms).toEqual(["tickets:read", "tickets:write"]);
    });

    it("returns empty array for unknown role", () => {
      // @ts-expect-error testing unknown role
      const perms = getPermissions("UNKNOWN_ROLE");
      expect(perms).toEqual([]);
    });
  });

  describe("hasPermission", () => {
    it("returns true for valid permission", () => {
      expect(hasPermission("MANAGER", "payments:write")).toBe(true);
    });

    it("returns false for invalid permission", () => {
      expect(hasPermission("SERVICE_TECH", "payments:write")).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("returns true if at least one permission matches", () => {
      expect(
        hasAnyPermission("CARETAKER", ["payments:write", "tickets:read"])
      ).toBe(true);
    });

    it("returns false if no permissions match", () => {
      expect(
        hasAnyPermission("SERVICE_TECH", ["payments:write", "properties:read"])
      ).toBe(false);
    });

    it("returns false for empty permissions array", () => {
      expect(hasAnyPermission("MANAGER", [])).toBe(false);
    });
  });
});
