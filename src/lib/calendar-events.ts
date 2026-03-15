import { db } from "@/lib/db";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date
  end?: string;  // ISO date (multi-day)
  type:
    | "rent_due"
    | "lease_start"
    | "lease_end"
    | "inspection"
    | "ticket"
    | "expense"
    | "payout"
    | "scheduled_payment";
  color: string;
  meta?: Record<string, unknown>;
}

const COLOR_MAP: Record<CalendarEvent["type"], string> = {
  rent_due: "blue",
  lease_start: "emerald",
  lease_end: "amber",
  inspection: "purple",
  ticket: "orange",
  expense: "red",
  payout: "emerald",
  scheduled_payment: "sky",
};

// ── PM Calendar ──────────────────────────────────────

export async function getPmCalendarEvents(
  landlordId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  // Leases (start & end)
  const leases = await db.lease.findMany({
    where: {
      landlordId,
      OR: [
        { startDate: { gte: rangeStart, lte: rangeEnd } },
        { endDate: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true } },
      property: { select: { name: true } },
    },
  });

  for (const l of leases) {
    const label = `${l.tenant.user.name} — ${l.property.name} #${l.unit.unitNumber}`;
    if (l.startDate >= rangeStart && l.startDate <= rangeEnd) {
      events.push({
        id: `lease-start-${l.id}`,
        title: `Lease Start: ${label}`,
        start: l.startDate.toISOString(),
        type: "lease_start",
        color: COLOR_MAP.lease_start,
        meta: { leaseId: l.id, propertyId: l.propertyId },
      });
    }
    if (l.endDate >= rangeStart && l.endDate <= rangeEnd) {
      events.push({
        id: `lease-end-${l.id}`,
        title: `Lease End: ${label}`,
        start: l.endDate.toISOString(),
        type: "lease_end",
        color: COLOR_MAP.lease_end,
        meta: { leaseId: l.id, propertyId: l.propertyId },
      });
    }
  }

  // Payments (due dates)
  const payments = await db.payment.findMany({
    where: {
      landlordId,
      dueDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  });

  for (const p of payments) {
    events.push({
      id: `rent-${p.id}`,
      title: `Rent Due: ${p.tenant.user.name} — ${p.unit.property.name} #${p.unit.unitNumber}`,
      start: p.dueDate.toISOString(),
      type: "rent_due",
      color: COLOR_MAP.rent_due,
      meta: {
        amount: Number(p.amount),
        status: p.status,
        paymentId: p.id,
      },
    });
  }

  // Inspections
  const inspections = await db.inspection.findMany({
    where: {
      property: { landlordId },
      scheduledAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitNumber: true } },
    },
  });

  for (const insp of inspections) {
    events.push({
      id: `insp-${insp.id}`,
      title: `${insp.type} Inspection: ${insp.property.name}${insp.unit ? ` #${insp.unit.unitNumber}` : ""}`,
      start: insp.scheduledAt!.toISOString(),
      type: "inspection",
      color: COLOR_MAP.inspection,
      meta: { inspectionId: insp.id, status: insp.status },
    });
  }

  // Service Tickets
  const tickets = await db.serviceTicket.findMany({
    where: {
      landlordId,
      scheduledDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  });

  for (const t of tickets) {
    events.push({
      id: `ticket-${t.id}`,
      title: `Ticket: ${t.title} — ${t.unit.property.name} #${t.unit.unitNumber}`,
      start: t.scheduledDate!.toISOString(),
      type: "ticket",
      color: COLOR_MAP.ticket,
      meta: { ticketId: t.id, priority: t.priority, status: t.status },
    });
  }

  // Expenses
  const expenses = await db.expense.findMany({
    where: {
      landlordId,
      date: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      property: { select: { name: true } },
    },
  });

  for (const e of expenses) {
    events.push({
      id: `expense-${e.id}`,
      title: `Expense: ${e.description} — ${e.property.name}`,
      start: e.date.toISOString(),
      type: "expense",
      color: COLOR_MAP.expense,
      meta: { amount: Number(e.amount), category: e.category },
    });
  }

  // Owner Payouts
  const payouts = await db.ownerPayout.findMany({
    where: {
      landlordId,
      OR: [
        { periodEnd: { gte: rangeStart, lte: rangeEnd } },
        { paidAt: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
    include: {
      owner: { select: { name: true } },
    },
  });

  for (const p of payouts) {
    const date = p.paidAt || p.periodEnd;
    events.push({
      id: `payout-${p.id}`,
      title: `Payout: ${p.owner.name} — $${Number(p.netPayout).toLocaleString()}`,
      start: date.toISOString(),
      type: "payout",
      color: COLOR_MAP.payout,
      meta: { amount: Number(p.netPayout), status: p.status },
    });
  }

  // Scheduled Payments
  const scheduled = await db.scheduledPayment.findMany({
    where: {
      landlordId,
      scheduledDate: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      tenant: { include: { user: { select: { name: true } } } },
      unit: { select: { unitNumber: true, property: { select: { name: true } } } },
    },
  });

  for (const s of scheduled) {
    events.push({
      id: `sched-${s.id}`,
      title: `Autopay: ${s.tenant.user.name} — ${s.unit.property.name} #${s.unit.unitNumber}`,
      start: s.scheduledDate.toISOString(),
      type: "scheduled_payment",
      color: COLOR_MAP.scheduled_payment,
      meta: { amount: Number(s.amount), executed: s.executed },
    });
  }

  return events;
}

// ── Tenant Calendar ─────────────────────────────────

export async function getTenantCalendarEvents(
  tenantProfileId: string,
  unitId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  // Payments
  const payments = await db.payment.findMany({
    where: {
      tenantId: tenantProfileId,
      dueDate: { gte: rangeStart, lte: rangeEnd },
    },
  });

  for (const p of payments) {
    events.push({
      id: `rent-${p.id}`,
      title: `Rent Due — $${Number(p.amount).toLocaleString()}`,
      start: p.dueDate.toISOString(),
      type: "rent_due",
      color: COLOR_MAP.rent_due,
      meta: { amount: Number(p.amount), status: p.status },
    });
  }

  // Leases
  const leases = await db.lease.findMany({
    where: {
      tenantId: tenantProfileId,
      OR: [
        { startDate: { gte: rangeStart, lte: rangeEnd } },
        { endDate: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
  });

  for (const l of leases) {
    if (l.startDate >= rangeStart && l.startDate <= rangeEnd) {
      events.push({
        id: `lease-start-${l.id}`,
        title: "Lease Start",
        start: l.startDate.toISOString(),
        type: "lease_start",
        color: COLOR_MAP.lease_start,
      });
    }
    if (l.endDate >= rangeStart && l.endDate <= rangeEnd) {
      events.push({
        id: `lease-end-${l.id}`,
        title: "Lease End",
        start: l.endDate.toISOString(),
        type: "lease_end",
        color: COLOR_MAP.lease_end,
      });
    }
  }

  // Service Tickets
  const tickets = await db.serviceTicket.findMany({
    where: {
      tenantId: tenantProfileId,
      scheduledDate: { gte: rangeStart, lte: rangeEnd },
    },
  });

  for (const t of tickets) {
    events.push({
      id: `ticket-${t.id}`,
      title: `Maintenance: ${t.title}`,
      start: t.scheduledDate!.toISOString(),
      type: "ticket",
      color: COLOR_MAP.ticket,
      meta: { status: t.status },
    });
  }

  // Scheduled Payments (autopay)
  const scheduled = await db.scheduledPayment.findMany({
    where: {
      tenantId: tenantProfileId,
      scheduledDate: { gte: rangeStart, lte: rangeEnd },
    },
  });

  for (const s of scheduled) {
    events.push({
      id: `sched-${s.id}`,
      title: `Autopay — $${Number(s.amount).toLocaleString()}`,
      start: s.scheduledDate.toISOString(),
      type: "scheduled_payment",
      color: COLOR_MAP.scheduled_payment,
      meta: { amount: Number(s.amount), executed: s.executed },
    });
  }

  return events;
}

// ── Owner Calendar ──────────────────────────────────

export async function getOwnerCalendarEvents(
  ownerId: string,
  landlordId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];

  // Payouts
  const payouts = await db.ownerPayout.findMany({
    where: {
      ownerId,
      OR: [
        { periodEnd: { gte: rangeStart, lte: rangeEnd } },
        { paidAt: { gte: rangeStart, lte: rangeEnd } },
      ],
    },
  });

  for (const p of payouts) {
    const date = p.paidAt || p.periodEnd;
    events.push({
      id: `payout-${p.id}`,
      title: `Payout — $${Number(p.netPayout).toLocaleString()}`,
      start: date.toISOString(),
      type: "payout",
      color: COLOR_MAP.payout,
      meta: { amount: Number(p.netPayout), status: p.status },
    });
  }

  // Leases on owner's properties
  const ownerProps = await db.property.findMany({
    where: { ownerId, landlordId },
    select: { id: true, name: true },
  });
  const propIds = ownerProps.map((p) => p.id);
  const propNameMap = new Map(ownerProps.map((p) => [p.id, p.name]));

  if (propIds.length > 0) {
    const leases = await db.lease.findMany({
      where: {
        propertyId: { in: propIds },
        OR: [
          { startDate: { gte: rangeStart, lte: rangeEnd } },
          { endDate: { gte: rangeStart, lte: rangeEnd } },
        ],
      },
      include: {
        unit: { select: { unitNumber: true } },
        tenant: { include: { user: { select: { name: true } } } },
      },
    });

    for (const l of leases) {
      const label = `${propNameMap.get(l.propertyId)} #${l.unit.unitNumber}`;
      if (l.startDate >= rangeStart && l.startDate <= rangeEnd) {
        events.push({
          id: `lease-start-${l.id}`,
          title: `Lease Start: ${label}`,
          start: l.startDate.toISOString(),
          type: "lease_start",
          color: COLOR_MAP.lease_start,
        });
      }
      if (l.endDate >= rangeStart && l.endDate <= rangeEnd) {
        events.push({
          id: `lease-end-${l.id}`,
          title: `Lease End: ${label}`,
          start: l.endDate.toISOString(),
          type: "lease_end",
          color: COLOR_MAP.lease_end,
        });
      }
    }

    // Inspections on owner's properties
    const inspections = await db.inspection.findMany({
      where: {
        propertyId: { in: propIds },
        scheduledAt: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } },
      },
    });

    for (const insp of inspections) {
      events.push({
        id: `insp-${insp.id}`,
        title: `${insp.type} Inspection: ${insp.property.name}${insp.unit ? ` #${insp.unit.unitNumber}` : ""}`,
        start: insp.scheduledAt!.toISOString(),
        type: "inspection",
        color: COLOR_MAP.inspection,
        meta: { status: insp.status },
      });
    }
  }

  return events;
}
