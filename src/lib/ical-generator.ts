import type { CalendarEvent } from "./calendar-events";

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcalDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function toIcalDateOnly(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

const TYPE_LABELS: Record<string, string> = {
  rent_due: "Rent Due",
  lease_start: "Lease Start",
  lease_end: "Lease End",
  inspection: "Inspection",
  ticket: "Service Ticket",
  expense: "Expense",
  payout: "Payout",
  scheduled_payment: "Scheduled Payment",
};

export function generateIcalFeed(
  events: CalendarEvent[],
  calendarName = "DoorStax Calendar"
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DoorStax//Calendar//EN",
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const dtStart = toIcalDate(event.start);
    const dtEnd = event.end
      ? toIcalDate(event.end)
      : toIcalDate(
          new Date(new Date(event.start).getTime() + 60 * 60 * 1000).toISOString()
        );

    const description = TYPE_LABELS[event.type] || event.type;
    const metaDesc = event.meta
      ? Object.entries(event.meta)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\\n")
      : "";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@doorstax.com`);
    lines.push(`DTSTAMP:${toIcalDate(new Date().toISOString())}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcal(event.title)}`);
    if (metaDesc) {
      lines.push(`DESCRIPTION:${escapeIcal(`${description}\\n${metaDesc}`)}`);
    } else {
      lines.push(`DESCRIPTION:${escapeIcal(description)}`);
    }
    lines.push(`CATEGORIES:${escapeIcal(description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
