import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:landlords")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, phone, password, companyName } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  // Check if email already exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Generate password if not provided
  const pw = password || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const passwordHash = await hash(pw, 12);

  const user = await db.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      role: "PM",
      companyName: companyName || null,
    },
  });

  return NextResponse.json({ success: true, id: user.id, generatedPassword: !password ? pw : undefined });
}
