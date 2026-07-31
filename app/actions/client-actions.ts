"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/services/audit-service";
import { hasHourlyRateChanged } from "@/lib/services/client-billing";
import { createClientSchema, updateClientSchema } from "@/lib/validation/schemas";
import { serializeForClient } from "@/lib/utils/serialize";
import type { ClientBillingModel } from "@prisma/client";

function clientBillingData(parsed: {
  billingModel?: ClientBillingModel;
  hourlyRate?: string | null;
  hourlyCurrency?: string | null;
}) {
  const isHourly = parsed.billingModel === "HOURLY";
  return {
    billingModel: parsed.billingModel ?? "FIXED",
    hourlyRate: isHourly ? (parsed.hourlyRate ?? null) : null,
    hourlyCurrency: isHourly ? (parsed.hourlyCurrency ?? null) : null,
  };
}

export async function createClientAction(formData: unknown) {
  const ctx = await getOrgContext();

  const parsed = createClientSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const billing = clientBillingData(parsed.data);

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        organizationId: ctx.organizationId,
        displayName: parsed.data.displayName,
        legalName: parsed.data.legalName ?? null,
        countryCode: parsed.data.countryCode ?? null,
        email: parsed.data.email || null,
        taxId: parsed.data.taxId ?? null,
        defaultCurrency: parsed.data.defaultCurrency ?? null,
        notes: parsed.data.notes ?? null,
        ...billing,
      },
    });

    if (billing.billingModel === "HOURLY" && billing.hourlyRate && billing.hourlyCurrency) {
      await tx.clientHourlyRateHistory.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: created.id,
          ratePerHour: billing.hourlyRate,
          currency: billing.hourlyCurrency,
          note: parsed.data.hourlyRateNote ?? "Initial hourly rate",
          changedBy: ctx.userId,
        },
      });
    }

    return created;
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Client",
    entityId: client.id,
    action: "CLIENT_CREATED",
    actorUserId: ctx.userId,
    payload: { displayName: client.displayName, billingModel: client.billingModel },
  });

  return { data: serializeForClient(client) };
}

export async function updateClientAction(id: string, formData: unknown) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "Client not found" };
  }

  const parsed = updateClientSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const billing = clientBillingData({
    billingModel: parsed.data.billingModel ?? client.billingModel,
    hourlyRate:
      parsed.data.hourlyRate !== undefined
        ? parsed.data.hourlyRate
        : client.hourlyRate?.toString() ?? null,
    hourlyCurrency:
      parsed.data.hourlyCurrency !== undefined
        ? parsed.data.hourlyCurrency
        : client.hourlyCurrency,
  });

  const rateChanged = hasHourlyRateChanged(
    {
      rate: client.hourlyRate?.toString() ?? null,
      currency: client.hourlyCurrency,
    },
    { rate: billing.hourlyRate, currency: billing.hourlyCurrency }
  );

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.client.update({
      where: { id },
      data: {
        displayName: parsed.data.displayName,
        legalName: parsed.data.legalName ?? undefined,
        countryCode: parsed.data.countryCode ?? undefined,
        email: parsed.data.email !== undefined ? (parsed.data.email || null) : undefined,
        taxId: parsed.data.taxId ?? undefined,
        defaultCurrency: parsed.data.defaultCurrency ?? undefined,
        notes: parsed.data.notes ?? undefined,
        billingModel: billing.billingModel,
        hourlyRate: billing.hourlyRate,
        hourlyCurrency: billing.hourlyCurrency,
      },
    });

    if (
      billing.billingModel === "HOURLY" &&
      rateChanged &&
      billing.hourlyRate &&
      billing.hourlyCurrency
    ) {
      await tx.clientHourlyRateHistory.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: id,
          ratePerHour: billing.hourlyRate,
          currency: billing.hourlyCurrency,
          note: parsed.data.hourlyRateNote ?? null,
          changedBy: ctx.userId,
        },
      });
    }

    return row;
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Client",
    entityId: id,
    action: "CLIENT_UPDATED",
    actorUserId: ctx.userId,
    payload: { changes: parsed.data, rateChanged },
  });

  return { data: serializeForClient(updated) };
}

export async function archiveClientAction(id: string) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "Client not found" };
  }

  const updated = await prisma.client.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Client",
    entityId: id,
    action: "CLIENT_ARCHIVED",
    actorUserId: ctx.userId,
    payload: { displayName: client.displayName },
  });

  return { data: serializeForClient(updated) };
}

export async function restoreClientAction(id: string) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "Client not found" };
  }

  const updated = await prisma.client.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  return { data: serializeForClient(updated) };
}

export async function deleteClientAction(id: string) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      _count: { select: { invoices: true, forecastEntries: true } },
    },
  });

  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "CLIENT_NOT_FOUND" };
  }
  if (client.status !== "ARCHIVED") {
    return { error: "CLIENT_NOT_ARCHIVED" };
  }
  if (client._count.invoices > 0) {
    return { error: "CLIENT_HAS_INVOICES" };
  }
  if (client._count.forecastEntries > 0) {
    return { error: "CLIENT_HAS_FORECASTS" };
  }

  await prisma.client.delete({ where: { id } });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Client",
    entityId: id,
    action: "CLIENT_DELETED",
    actorUserId: ctx.userId,
    payload: { displayName: client.displayName },
  });

  return { data: true };
}

export async function getClientsAction(includeArchived = false) {
  const ctx = await getOrgContext();

  const clients = await prisma.client.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: includeArchived ? undefined : "ACTIVE",
    },
    orderBy: { displayName: "asc" },
  });

  return { data: serializeForClient(clients) };
}

export async function getClientHourlyRateHistoryAction(clientId: string) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "Client not found" };
  }

  const history = await prisma.clientHourlyRateHistory.findMany({
    where: { clientId, organizationId: ctx.organizationId },
    orderBy: { effectiveFrom: "desc" },
    take: 50,
  });

  return { data: serializeForClient(history) };
}

export async function getClientDetailAction(id: string) {
  const ctx = await getOrgContext();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      invoices: {
        where: { organizationId: ctx.organizationId },
        orderBy: { issueDate: "desc" },
        take: 50,
      },
      forecastEntries: {
        where: { organizationId: ctx.organizationId, status: "ACTIVE" },
        orderBy: { expectedDate: "asc" },
        take: 20,
      },
      hourlyRateHistory: {
        orderBy: { effectiveFrom: "desc" },
        take: 20,
      },
    },
  });

  if (!client || client.organizationId !== ctx.organizationId) {
    return { error: "Client not found" };
  }

  return { data: serializeForClient(client) };
}
