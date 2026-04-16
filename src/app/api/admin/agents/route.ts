import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAdminContext, canAdmin } from "@/lib/admin-context";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Users with a referralCode are agents
  const agentUsers = await db.user.findMany({
    where: { referralCode: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      referralCode: true,
      createdAt: true,
      agentProfile: {
        select: { agentId: true, status: true },
      },
      agentRelationsAsParent: {
        include: {
          agentUser: {
            select: {
              id: true,
              properties: {
                where: { archivedAt: null },
                select: { units: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const agents = agentUsers.map((u) => {
    const rels = u.agentRelationsAsParent;
    const totalUnits = rels.reduce(
      (s, r) =>
        s + r.agentUser.properties.reduce((ps, p) => ps + p.units.length, 0),
      0
    );
    const first = rels[0];
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      agentId: u.agentProfile?.agentId ?? null,
      referralCode: u.referralCode,
      referredPmCount: rels.length,
      totalUnits,
      perUnitCost: first ? Number(first.perUnitCost) : 3,
      commissionRate: first ? Number(first.commissionRate) : 0,
      residualSplit: first ? Number(first.residualSplit) : 0,
      isActive: first
        ? first.isActive
        : u.agentProfile?.status !== "INACTIVE" && u.agentProfile?.status !== "SUSPENDED",
      status: u.agentProfile?.status ?? "ACTIVE",
      createdAt: u.createdAt.toISOString(),
    };
  });

  const stats = {
    total: agents.length,
    active: agents.filter((a) => a.isActive).length,
    referredPms: agents.reduce((s, a) => s + a.referredPmCount, 0),
  };

  return NextResponse.json({ agents, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminCtx = await getAdminContext(session.user.id);
  if (!canAdmin(adminCtx, "admin:staff")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, email, phone, company } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Name and email required" },
      { status: 400 }
    );
  }

  let agentUser = await db.user.findUnique({
    where: { email: String(email).toLowerCase() },
  });

  let referralCode = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const dup = await db.user.findUnique({ where: { referralCode } });
    if (!dup) break;
    referralCode = generateReferralCode();
  }

  if (agentUser) {
    if (!agentUser.referralCode) {
      await db.user.update({
        where: { id: agentUser.id },
        data: { referralCode },
      });
    } else {
      referralCode = agentUser.referralCode;
    }
  } else {
    const { hash } = await import("bcryptjs");
    const tempPw =
      randomBytes(12).toString("base64url");
    agentUser = await db.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        phone: phone || null,
        companyName: company || null,
        passwordHash: await hash(tempPw, 12),
        role: "PARTNER",
        referralCode,
      },
    });
  }

  // Create AgentProfile if not exists, with auto-generated 5-digit agent ID
  const existingProfile = await db.agentProfile.findUnique({
    where: { userId: agentUser.id },
  });
  if (!existingProfile) {
    // Generate sequential agent ID (A11231, A11232, ...)
    const lastAgent = await db.agentProfile.findFirst({
      where: { agentId: { not: null } },
      orderBy: { agentId: "desc" },
      select: { agentId: true },
    });
    const lastNum = lastAgent?.agentId
      ? parseInt(lastAgent.agentId.replace("A", ""))
      : 11230;
    const newAgentId = "A" + String(lastNum + 1).padStart(5, "0");

    await db.agentProfile.create({
      data: {
        userId: agentUser.id,
        agentId: newAgentId,
        phone: phone || null,
        company: company || null,
        status: "ACTIVE",
      },
    });
  } else if (!existingProfile.agentId) {
    // Backfill existing agent without ID
    const lastAgent = await db.agentProfile.findFirst({
      where: { agentId: { not: null } },
      orderBy: { agentId: "desc" },
      select: { agentId: true },
    });
    const lastNum = lastAgent?.agentId
      ? parseInt(lastAgent.agentId.replace("A", ""))
      : 11230;
    await db.agentProfile.update({
      where: { id: existingProfile.id },
      data: { agentId: "A" + String(lastNum + 1).padStart(5, "0") },
    });
  }

  // Send invite email
  try {
    const { getResend } = await import("@/lib/email");
    const { emailStyles, emailHeader, emailFooter, emailButton, esc } =
      await import("@/lib/emails/_layout");
    const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com";
    const refLink = `${BASE_URL}/register?ref=${referralCode}`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles()}</style></head><body><div class="container"><div class="card">${emailHeader()}<h1>Welcome to the DoorStax Agent Network</h1><p>Hi ${esc(name)},</p><p>You've been invited to join DoorStax as a sales agent. Earn monthly recurring income on every property manager you bring to the platform.</p><div class="highlight"><p style="margin:0 0 12px 0;font-weight:600;">Your earnings scale with every PM you refer</p><p style="margin:0 0 12px 0;font-size:13px;color:#666;">Earn a flat per-unit kickback every month, automatically adjusted based on the PM's tier. As your referred PMs grow, your earnings grow with them.</p><table style="width:100%;border-collapse:collapse;"><thead><tr style="border-bottom:2px solid #e5e7eb;"><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">PM Tier</th><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">Units</th><th style="text-align:right;padding:8px 0;font-size:12px;color:#666;">Your Kickback</th></tr></thead><tbody><tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;">Starter</td><td style="padding:8px 0;color:#666;">0–99</td><td style="padding:8px 0;text-align:right;font-weight:600;">$2.50/unit/mo</td></tr><tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;">Growth</td><td style="padding:8px 0;color:#666;">100–499</td><td style="padding:8px 0;text-align:right;font-weight:600;">$2.00/unit/mo</td></tr><tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0;">Scale</td><td style="padding:8px 0;color:#666;">500–999</td><td style="padding:8px 0;text-align:right;font-weight:600;">$1.50/unit/mo</td></tr><tr><td style="padding:8px 0;">Enterprise</td><td style="padding:8px 0;color:#666;">1,000+</td><td style="padding:8px 0;text-align:right;font-weight:600;">$1.00/unit/mo</td></tr></tbody></table><p style="margin:12px 0 0 0;font-size:12px;color:#666;">Example: refer a 200-unit PM and earn $400/month — every month they stay on DoorStax.</p></div><p style="text-align:center;font-size:12px;color:#888;">Your referral link</p><p style="text-align:center;font-size:14px;font-weight:600;word-break:break-all;">${esc(refLink)}</p>${emailButton("Get Started", BASE_URL + "/login")}</div>${emailFooter()}</div></body></html>`;

    await getResend().emails.send({
      from: "DoorStax <noreply@doorstax.com>",
      to: email,
      subject: "Welcome to the DoorStax Agent Network",
      html,
    });
  } catch (err) {
    console.error("[admin/agents] invite email failed:", err);
  }

  return NextResponse.json({ ok: true, agentId: agentUser.id, referralCode });
}
