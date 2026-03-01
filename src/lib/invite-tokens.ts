import { randomBytes } from "crypto";
import { hash, compare } from "bcryptjs";

export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export async function hashToken(token: string): Promise<string> {
  return hash(token, 10);
}

export async function verifyToken(
  token: string,
  hashedToken: string
): Promise<boolean> {
  return compare(token, hashedToken);
}
