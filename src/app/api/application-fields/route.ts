import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureApplicationFields } from "@/lib/application-fields";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const fields = await ensureApplicationFields(session.user.id);
    return NextResponse.json(fields);
  } catch (err) {
    console.error("[application-fields] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch fields" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "PM" && session.user.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { label, type, options, required, section, placeholder, helpText, sortOrder } = body;

    if (!label || typeof label !== "string") {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    // Auto sortOrder if not provided
    let order = sortOrder;
    if (order === undefined || order === null) {
      const max = await db.applicationField.aggregate({
        where: { pmId: session.user.id },
        _max: { sortOrder: true },
      });
      order = (max._max.sortOrder ?? 0) + 1;
    }

    const field = await db.applicationField.create({
      data: {
        pmId: session.user.id,
        label,
        type: type || "TEXT",
        options: Array.isArray(options) ? options : [],
        required: required === true,
        section: section || "CUSTOM",
        placeholder: placeholder || null,
        helpText: helpText || null,
        sortOrder: order,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (err) {
    console.error("[application-fields] POST error:", err);
    return NextResponse.json({ error: "Failed to create field" }, { status: 500 });
  }
}
