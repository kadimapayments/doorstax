import { NextResponse, NextRequest } from "next/server";
import { resolveApiSession } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getEffectiveLandlordId } from "@/lib/team-context";

/** GET — fetch all custom stacks for the landlord */
export async function GET() {
  try {
    const session = await resolveApiSession();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const landlordId = await getEffectiveLandlordId(session.user.id);

    const stacks = await db.propertyStack.findMany({
      where: { landlordId },
      include: {
        properties: {
          include: {
            units: {
              select: { id: true, unitNumber: true, status: true, rentAmount: true },
            },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    // Serialize Decimal → Number
    const serialized = stacks.map((s) => ({
      ...s,
      properties: s.properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        propertyType: p.propertyType,
        units: p.units.map((u) => ({
          ...u,
          rentAmount: Number(u.rentAmount),
        })),
      })),
    }));

    return NextResponse.json({ stacks: serialized });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stacks" }, { status: 500 });
  }
}

/** POST — create a new stack */
export async function POST(req: NextRequest) {
  try {
    const session = await resolveApiSession();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const landlordId = await getEffectiveLandlordId(session.user.id);

    const body = await req.json();
    const { name = "", propertyIds = [] } = body;

    // Count existing stacks for sortOrder
    const count = await db.propertyStack.count({ where: { landlordId } });

    const stack = await db.propertyStack.create({
      data: {
        landlordId,
        name,
        sortOrder: count,
      },
    });

    // Assign properties to this stack (only if they belong to this landlord)
    if (propertyIds.length > 0) {
      await db.property.updateMany({
        where: {
          id: { in: propertyIds },
          landlordId,
        },
        data: { stackId: stack.id },
      });
    }

    return NextResponse.json({ stack });
  } catch {
    return NextResponse.json({ error: "Failed to create stack" }, { status: 500 });
  }
}

/** PUT — rename a stack or move a property between stacks */
export async function PUT(req: NextRequest) {
  try {
    const session = await resolveApiSession();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const landlordId = await getEffectiveLandlordId(session.user.id);

    const body = await req.json();
    const { action } = body;

    if (action === "move") {
      // Move a property to a different stack
      const { propertyId, targetStackId } = body;
      if (!propertyId) {
        return NextResponse.json({ error: "propertyId required" }, { status: 400 });
      }

      // Verify property belongs to this landlord
      const property = await db.property.findFirst({
        where: { id: propertyId, landlordId },
      });
      if (!property) {
        return NextResponse.json({ error: "Property not found" }, { status: 404 });
      }

      // Verify target stack belongs to this landlord (or null to unassign)
      if (targetStackId) {
        const targetStack = await db.propertyStack.findFirst({
          where: { id: targetStackId, landlordId },
        });
        if (!targetStack) {
          return NextResponse.json({ error: "Target stack not found" }, { status: 404 });
        }
      }

      await db.property.update({
        where: { id: propertyId },
        data: { stackId: targetStackId || null },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "reorder") {
      const { stackId: reorderId, direction } = body;
      if (!reorderId || !["up", "down"].includes(direction)) {
        return NextResponse.json(
          { error: "stackId and direction (up|down) required" },
          { status: 400 }
        );
      }

      // Fetch all stacks ordered by sortOrder
      const allStacks = await db.propertyStack.findMany({
        where: { landlordId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true },
      });

      const idx = allStacks.findIndex((s) => s.id === reorderId);
      if (idx === -1) {
        return NextResponse.json({ error: "Stack not found" }, { status: 404 });
      }

      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= allStacks.length) {
        return NextResponse.json({ error: "Cannot move further" }, { status: 400 });
      }

      // Swap sortOrder values
      const [a, b] = [allStacks[idx], allStacks[swapIdx]];
      await db.$transaction([
        db.propertyStack.update({
          where: { id: a.id },
          data: { sortOrder: b.sortOrder },
        }),
        db.propertyStack.update({
          where: { id: b.id },
          data: { sortOrder: a.sortOrder },
        }),
      ]);

      return NextResponse.json({ success: true });
    }

    // Default: rename a stack
    const { stackId, name } = body;
    if (!stackId) {
      return NextResponse.json({ error: "stackId required" }, { status: 400 });
    }

    // Verify stack belongs to this landlord
    const stack = await db.propertyStack.findFirst({
      where: { id: stackId, landlordId },
    });
    if (!stack) {
      return NextResponse.json({ error: "Stack not found" }, { status: 404 });
    }

    const updated = await db.propertyStack.update({
      where: { id: stackId },
      data: { name: name ?? stack.name },
    });

    return NextResponse.json({ stack: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update stack" }, { status: 500 });
  }
}

/** DELETE — delete a stack (unassigns all properties first) */
export async function DELETE(req: NextRequest) {
  try {
    const session = await resolveApiSession();
    if (!session?.user || session.user.role !== "PM") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const landlordId = await getEffectiveLandlordId(session.user.id);

    const { searchParams } = new URL(req.url);
    const stackId = searchParams.get("stackId");
    if (!stackId) {
      return NextResponse.json({ error: "stackId required" }, { status: 400 });
    }

    // Verify stack belongs to this landlord
    const stack = await db.propertyStack.findFirst({
      where: { id: stackId, landlordId },
    });
    if (!stack) {
      return NextResponse.json({ error: "Stack not found" }, { status: 404 });
    }

    // Unassign all properties from this stack
    await db.property.updateMany({
      where: { stackId },
      data: { stackId: null },
    });

    // Delete the stack
    await db.propertyStack.delete({ where: { id: stackId } });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete stack" }, { status: 500 });
  }
}
