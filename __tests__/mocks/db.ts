import { PrismaClient } from "@prisma/client";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { beforeEach, vi } from "vitest";

export const prismaMock = mockDeep<PrismaClient>();

// Mock the db module so all imports of `@/lib/db` use the mock
vi.mock("@/lib/db", () => ({
  db: prismaMock,
}));

beforeEach(() => {
  mockReset(prismaMock);
});
