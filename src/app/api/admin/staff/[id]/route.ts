import { NextRequest, NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { updateAdminStaffSchema } from "@/lib/validations/admin-staff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminPermission("admin:staff");
    const { id } = await params;

    const staff = await db.adminStaff.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission("admin:staff");
    const { id } = await params;

    const body = await req.json();
    const parsed = updateAdminStaffSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Find the staff record
    const staff = await db.adminStaff.findUnique({
      where: { id },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // Prevent self-demotion
    if (staff.userId === user.id && data.adminRole && data.adminRole !== staff.adminRole) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 403 }
      );
    }

    // Prevent deactivating yourself
    if (staff.userId === user.id && data.isActive === false) {
      return NextResponse.json(
        { error: "You cannot deactivate yourself" },
        { status: 403 }
      );
    }

    // Prevent deactivating the last SUPER_ADMIN
    if (data.isActive === false && staff.adminRole === "SUPER_ADMIN") {
      const superAdminCount = await db.adminStaff.count({
        where: { adminRole: "SUPER_ADMIN", isActive: true },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate the last Super Admin" },
          { status: 403 }
        );
      }
    }

    // Prevent demoting the last SUPER_ADMIN
    if (data.adminRole && data.adminRole !== "SUPER_ADMIN" && staff.adminRole === "SUPER_ADMIN") {
      const superAdminCount = await db.adminStaff.count({
        where: { adminRole: "SUPER_ADMIN", isActive: true },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last Super Admin" },
          { status: 403 }
        );
      }
    }

    const updated = await db.adminStaff.update({
      where: { id },
      data: {
        ...(data.adminRole && { adminRole: data.adminRole }),
        ...(data.customPermissions !== undefined && { customPermissions: data.customPermissions }),
        ...(data.isActive !== undefined && {
          isActive: data.isActive,
          deactivatedAt: data.isActive ? null : new Date(),
        }),
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update staff:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdminPermission("admin:staff");
    const { id } = await params;

    const staff = await db.adminStaff.findUnique({
      where: { id },
    });

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    // Prevent deleting yourself
    if (staff.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 403 }
      );
    }

    // Prevent deleting the last SUPER_ADMIN
    if (staff.adminRole === "SUPER_ADMIN") {
      const superAdminCount = await db.adminStaff.count({
        where: { adminRole: "SUPER_ADMIN", isActive: true },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last Super Admin" },
          { status: 403 }
        );
      }
    }

    // Soft-delete
    await db.adminStaff.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete staff:", error);
    return NextResponse.json({ error: "Failed to remove staff" }, { status: 500 });
  }
}
