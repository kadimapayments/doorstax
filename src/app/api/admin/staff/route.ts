import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { createAdminStaffSchema } from "@/lib/validations/admin-staff";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function GET() {
  try {
    await requireAdminPermission("admin:staff");

    const staff = await db.adminStaff.findMany({
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { invitedAt: "desc" },
    });

    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAdminPermission("admin:staff");

    const body = await req.json();
    const parsed = createAdminStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      // Check if they already have an admin staff record
      const existingStaff = await db.adminStaff.findUnique({
        where: { userId: existingUser.id },
      });
      if (existingStaff) {
        return NextResponse.json(
          { error: "This user already has an admin staff record" },
          { status: 409 }
        );
      }
      // If they exist but not as admin, we can't reuse them
      if (existingUser.role !== "ADMIN") {
        return NextResponse.json(
          { error: "A user with this email already exists with a different role" },
          { status: 409 }
        );
      }
    }

    // Generate password if not provided
    const generatedPassword = data.password ? undefined : crypto.randomBytes(12).toString("base64url");
    const password = data.password || generatedPassword!;
    const passwordHash = await bcrypt.hash(password, 12);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with ADMIN role
      const newUser = await db.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash,
          role: "ADMIN",
          phone: data.phone || null,
        },
      });
      userId = newUser.id;
    }

    // Create admin staff record
    const staffRecord = await db.adminStaff.create({
      data: {
        userId,
        adminRole: data.adminRole,
        customPermissions: data.customPermissions || [],
        invitedById: user.id,
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      id: staffRecord.id,
      generatedPassword: generatedPassword || undefined,
    });
  } catch (error) {
    console.error("Failed to create staff:", error);
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
  }
}
