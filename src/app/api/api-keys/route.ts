import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-key-auth";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  expiresInDays: z.number().int().positive().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
});

// POST: Create a new API key
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only PM and ADMIN can create API keys
  if (session.user.role !== "PM" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = createKeySchema.parse(body);

    const expiresAt = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const { id, fullKey } = await generateApiKey({
      userId: session.user.id,
      name: data.name,
      permissions: data.permissions,
      expiresAt,
      rateLimitPerMinute: data.rateLimitPerMinute,
    });

    // The full key is returned ONCE — it cannot be retrieved again
    return NextResponse.json({ id, key: fullKey }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: List API keys (no key value exposed)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      prefix: true,
      permissions: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      rateLimitPerMinute: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys);
}
