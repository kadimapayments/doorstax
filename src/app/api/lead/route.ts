import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { emailStyles, emailHeader, emailFooter } from "@/lib/emails/_layout";
import { publicLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

/** Format 10-digit string as (XXX) XXX-XXXX */
function fmtPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

const KADIMA_WEBROOT = "https://kadimadashboard.com";
const USER_ID = "237862";
const REFERRAL = "1106";

export async function POST(req: Request) {
  try {
    // ─── Rate Limiting (Upstash Redis) ────────────────────────
    const ip = getClientIp(req);
    const rl = await publicLimiter.limit(ip);
    if (!rl.success) return rateLimitResponse(rl.reset);

    const body = await req.json();
    const { name, email, phone, company, productAndService, captchaToken } = body;

    // Validation
    if (!name || !email || !phone || !company) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Parse buildings/units from productAndService string
    const buildingsMatch = productAndService?.match(/Buildings:\s*(\d+)/);
    const unitsMatch = productAndService?.match(/Units:\s*(\d+)/);
    const buildings = buildingsMatch ? parseInt(buildingsMatch[1]) : null;
    const units = unitsMatch ? parseInt(unitsMatch[1]) : null;

    // Create the lead in the database
    const phoneDigits = phone.replace(/\D/g, "").slice(0, 10);
    const lead = await db.lead.create({
      data: {
        name,
        email,
        phone: phoneDigits,
        company,
        buildings,
        units,
        source: "WEBSITE",
      },
    });

    // Notify all admins (in-app + email) — non-blocking
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://doorstax.com"}/admin/leads`;
    const phoneFmt = fmtPhone(phoneDigits);
    const bldgInfo = [buildings && `${buildings} buildings`, units && `${units} units`].filter(Boolean).join(", ");
    (async () => {
      try {
        // Find all admin users to notify
        const admins = await db.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true, email: true },
        });

        const detailRows = [
          { label: "Name", value: name },
          { label: "Email", value: email },
          { label: "Phone", value: phoneFmt },
          { label: "Company", value: company },
          ...(buildings ? [{ label: "Buildings", value: String(buildings) }] : []),
          ...(units ? [{ label: "Units", value: String(units) }] : []),
        ]
          .map(
            (r) => `<tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#888;width:120px;">${r.label}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#333;font-weight:500;">${r.value}</td>
            </tr>`
          )
          .join("");

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${emailStyles("")}</style></head><body>
          <div class="container"><div class="card">
            ${emailHeader()}
            <h1>New Lead Submission</h1>
            <p>A new lead has been submitted through the DoorStax website.</p>
            <div class="highlight"><table style="width:100%;border-collapse:collapse;margin:20px 0;" cellpadding="0" cellspacing="0"><tbody>${detailRows}</tbody></table></div>
            <div class="btn-container"><a href="${dashboardUrl}" class="btn">View in Dashboard</a></div>
            <p style="font-size:13px;color:#64748b;">This lead was captured from the website contact form and has been saved to your CRM.</p>
          </div>${emailFooter()}</div>
        </body></html>`;

        for (const admin of admins) {
          await notify({
            userId: admin.id,
            createdById: admin.id,
            type: "new_lead",
            title: `New Lead: ${company}`,
            message: `${name} from ${company}${bldgInfo ? ` (${bldgInfo})` : ""} — ${phoneFmt} — ${email}`,
            severity: "info",
            email: {
              to: admin.email,
              subject: `New Lead: ${company} — ${name}`,
              html,
            },
          });
        }
      } catch (err) {
        console.error("[Lead API] Notification error:", err);
      }
    })();

    // Kadima submission (best-effort, non-blocking)
    (async () => {
      try {
        // Step 1: Fetch the embed page to get a CSRF token and session cookie
        const embedUrl = `${KADIMA_WEBROOT}/lead/embed?userId=${USER_ID}&referral=${REFERRAL}&title=&subtitle=&terms=&submit=Submit&theme=dark&label=true&redirect=No`;

        const pageResponse = await fetch(embedUrl, {
          method: "GET",
          headers: {
            "User-Agent": "DoorStax Landing Page",
          },
        });

        const pageHtml = await pageResponse.text();
        const csrfMatch = pageHtml.match(/name="_csrf"\s+value="([^"]+)"/);
        const csrf = csrfMatch ? csrfMatch[1] : "";

        // Extract session cookies
        const setCookies = pageResponse.headers.getSetCookie?.() || [];
        const cookieHeader = setCookies
          .map((c: string) => c.split(";")[0])
          .join("; ");

        // Step 2: Submit with correct field names, CSRF, and captcha token
        const formData = new URLSearchParams();
        formData.append("_csrf", csrf);
        formData.append("BoardingApplicationGuestForm[name]", name);
        formData.append("BoardingApplicationGuestForm[email]", email);
        formData.append("BoardingApplicationGuestForm[phone]", phone);
        formData.append("BoardingApplicationGuestForm[company]", company);
        formData.append(
          "BoardingApplicationGuestForm[productAndService]",
          productAndService || ""
        );
        formData.append(
          "BoardingApplicationGuestForm[captcha]",
          captchaToken || ""
        );

        const response = await fetch(embedUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DoorStax Landing Page",
            Referer: embedUrl,
            Cookie: cookieHeader,
          },
          body: formData.toString(),
        });

        if (response.ok || response.status === 302 || response.status === 301) {
          console.log("[Lead API] Kadima submission succeeded");
        } else {
          const responseText = await response.text();
          console.error(
            "[Lead API] Kadima submission failed:",
            response.status,
            responseText.substring(0, 500)
          );
        }
      } catch (err) {
        console.error("[Lead API] Kadima submission error:", err);
      }
    })();

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error("[Lead API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
