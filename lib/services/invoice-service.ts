/**
 * Invoice service — handles creation, editing, status transitions,
 * rate snapshot persistence, and audit trail.
 */

import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "./audit-service";
import { getExchangeRateProvider } from "@/lib/exchange-rate";
import { suggestNextInvoiceNumber, resolveSuggestedInvoiceNumber } from "@/lib/utils/invoice-number";
import Decimal from "decimal.js";
import dayjs from "dayjs";
import type { RateSource } from "@prisma/client";

function formatDateOnly(value: Date): string {
  return dayjs(value).format("YYYY-MM-DD");
}

function decimalsEqual(
  a: string | Decimal | { toString(): string },
  b: string | Decimal | { toString(): string }
): boolean {
  return new Decimal(a.toString()).equals(new Decimal(b.toString()));
}

function hasRateOverrideChanged(
  existing: { manualOverride: boolean; appliedMiddleRate: { toString(): string } },
  rateOverride: CreateInvoiceInput["rateOverride"] | null | undefined
): boolean {
  if (rateOverride === undefined) return false;
  if (rateOverride === null) return existing.manualOverride;
  if (!existing.manualOverride) return true;
  return !decimalsEqual(rateOverride.ratePerUnit, existing.appliedMiddleRate);
}

interface CreateInvoiceInput {
  organizationId: string;
  actorUserId: string;
  invoiceNumber: string;
  clientId: string;
  issueDate: string; // YYYY-MM-DD
  dueDate?: string | null;
  paymentDate?: string | null;
  originalAmount: string;
  billableHours?: string | null;
  currency: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED";
  includeInLimit: boolean;
  notes?: string | null;
  // Rate — may come pre-computed from previewExchangeRate or be fetched here
  rateOverride?: {
    ratePerUnit: string;
    reason: string;
    originalAutoRate?: string;
    originalAutoRateEffectiveDate?: string;
  };
}

interface RateSnapshot {
  appliedMiddleRate: Decimal;
  rateEffectiveDate: Date;
  rsdAmount: Decimal;
  rateSource: RateSource;
  rateSourceUrl: string | null;
  rateFetchedAt: Date | null;
  isFallbackRate: boolean;
  fallbackReason: string | null;
  manualOverride: boolean;
  overrideReason: string | null;
  originalAutoRate: Decimal | null;
  originalAutoRateEffectiveDate: Date | null;
}

export async function resolveRateSnapshot(
  currency: string,
  issueDate: string,
  originalAmount: string,
  rateOverride?: CreateInvoiceInput["rateOverride"]
): Promise<RateSnapshot> {
  const amount = new Decimal(originalAmount);

  // RSD invoice: no conversion needed
  if (currency === "RSD") {
    return {
      appliedMiddleRate: new Decimal(1),
      rateEffectiveDate: new Date(issueDate),
      rsdAmount: amount,
      rateSource: "NBS_MIDDLE",
      rateSourceUrl: null,
      rateFetchedAt: null,
      isFallbackRate: false,
      fallbackReason: null,
      manualOverride: false,
      overrideReason: null,
      originalAutoRate: null,
      originalAutoRateEffectiveDate: null,
    };
  }

  const provider = getExchangeRateProvider();
  const result = await provider.getMiddleRate({
    currency,
    date: new Date(issueDate),
  });

  const autoRatePerUnit = result.ratePerUnit;
  let appliedRate = autoRatePerUnit;
  let rateSource: RateSource = result.source as RateSource;
  let manualOverride = false;
  let overrideReason: string | null = null;
  let originalAutoRate: Decimal | null = null;
  let originalAutoRateEffectiveDate: Date | null = null;

  if (rateOverride) {
    originalAutoRate = autoRatePerUnit;
    originalAutoRateEffectiveDate = new Date(result.effectiveDate);
    appliedRate = new Decimal(rateOverride.ratePerUnit);
    rateSource = "MANUAL_OVERRIDE";
    manualOverride = true;
    overrideReason = rateOverride.reason;
  }

  const rsdAmount = amount.times(appliedRate);

  return {
    appliedMiddleRate: appliedRate,
    rateEffectiveDate: new Date(result.effectiveDate),
    rsdAmount,
    rateSource,
    rateSourceUrl: result.sourceUrl,
    rateFetchedAt: result.fetchedAt,
    isFallbackRate: result.isFallback && !manualOverride,
    fallbackReason: result.fallbackReason ?? null,
    manualOverride,
    overrideReason,
    originalAutoRate,
    originalAutoRateEffectiveDate,
  };
}

export async function createInvoice(input: CreateInvoiceInput) {
  const snapshot = await resolveRateSnapshot(
    input.currency,
    input.issueDate,
    input.originalAmount,
    input.rateOverride
  );

  // Force cancelled invoices to never count
  const includeInLimit =
    input.status === "CANCELLED" ? false : input.includeInLimit;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        invoiceNumber: input.invoiceNumber,
        issueDate: new Date(input.issueDate),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        paymentDate: input.paymentDate ? new Date(input.paymentDate) : null,
        originalAmount: input.originalAmount,
        billableHours: input.billableHours ?? null,
        currency: input.currency,
        appliedMiddleRate: snapshot.appliedMiddleRate.toFixed(6),
        rateEffectiveDate: snapshot.rateEffectiveDate,
        rsdAmount: snapshot.rsdAmount.toFixed(4),
        rateSource: snapshot.rateSource,
        rateSourceUrl: snapshot.rateSourceUrl,
        rateFetchedAt: snapshot.rateFetchedAt,
        isFallbackRate: snapshot.isFallbackRate,
        fallbackReason: snapshot.fallbackReason,
        manualOverride: snapshot.manualOverride,
        overrideReason: snapshot.overrideReason,
        originalAutoRate: snapshot.originalAutoRate?.toFixed(6) ?? null,
        originalAutoRateEffectiveDate: snapshot.originalAutoRateEffectiveDate,
        status: input.status,
        includeInLimit,
        notes: input.notes,
        createdBy: input.actorUserId,
        updatedBy: input.actorUserId,
      },
    });

    await writeAuditEvent({
      organizationId: input.organizationId,
      entityType: "Invoice",
      entityId: inv.id,
      action: "INVOICE_CREATED",
      actorUserId: input.actorUserId,
      payload: {
        invoiceNumber: inv.invoiceNumber,
        currency: inv.currency,
        originalAmount: input.originalAmount,
        rsdAmount: snapshot.rsdAmount.toFixed(4),
        rateSource: snapshot.rateSource,
        appliedMiddleRate: snapshot.appliedMiddleRate.toFixed(6),
        isFallbackRate: snapshot.isFallbackRate,
        manualOverride: snapshot.manualOverride,
        status: inv.status,
      },
    });

    if (snapshot.isFallbackRate) {
      await writeAuditEvent({
        organizationId: input.organizationId,
        entityType: "Invoice",
        entityId: inv.id,
        action: "RATE_FALLBACK_USED",
        actorUserId: input.actorUserId,
        payload: {
          requestedDate: input.issueDate,
          effectiveDate: snapshot.rateEffectiveDate.toISOString().split("T")[0],
          fallbackReason: snapshot.fallbackReason,
          currency: input.currency,
          appliedRate: snapshot.appliedMiddleRate.toFixed(6),
        },
      });
    }

    if (snapshot.manualOverride) {
      await writeAuditEvent({
        organizationId: input.organizationId,
        entityType: "Invoice",
        entityId: inv.id,
        action: "RATE_MANUALLY_OVERRIDDEN",
        actorUserId: input.actorUserId,
        payload: {
          overrideReason: snapshot.overrideReason,
          originalAutoRate: snapshot.originalAutoRate?.toFixed(6),
          overrideRate: snapshot.appliedMiddleRate.toFixed(6),
          currency: input.currency,
        },
      });
    }

    return inv;
  });

  return invoice;
}

interface UpdateInvoiceInput {
  organizationId: string;
  actorUserId: string;
  invoiceNumber?: string;
  clientId?: string;
  issueDate?: string;
  dueDate?: string | null;
  paymentDate?: string | null;
  originalAmount?: string;
  billableHours?: string | null;
  currency?: string;
  status?: CreateInvoiceInput["status"];
  includeInLimit?: boolean;
  notes?: string | null;
  rateOverride?: CreateInvoiceInput["rateOverride"] | null;
}

function snapshotFromExisting(invoice: {
  appliedMiddleRate: { toString(): string };
  rateEffectiveDate: Date;
  rsdAmount: { toString(): string };
  rateSource: RateSource;
  rateSourceUrl: string | null;
  rateFetchedAt: Date | null;
  isFallbackRate: boolean;
  fallbackReason: string | null;
  manualOverride: boolean;
  overrideReason: string | null;
  originalAutoRate: { toString(): string } | null;
  originalAutoRateEffectiveDate: Date | null;
}): RateSnapshot {
  return {
    appliedMiddleRate: new Decimal(invoice.appliedMiddleRate.toString()),
    rateEffectiveDate: invoice.rateEffectiveDate,
    rsdAmount: new Decimal(invoice.rsdAmount.toString()),
    rateSource: invoice.rateSource,
    rateSourceUrl: invoice.rateSourceUrl,
    rateFetchedAt: invoice.rateFetchedAt,
    isFallbackRate: invoice.isFallbackRate,
    fallbackReason: invoice.fallbackReason,
    manualOverride: invoice.manualOverride,
    overrideReason: invoice.overrideReason,
    originalAutoRate: invoice.originalAutoRate
      ? new Decimal(invoice.originalAutoRate.toString())
      : null,
    originalAutoRateEffectiveDate: invoice.originalAutoRateEffectiveDate,
  };
}

export async function updateInvoice(invoiceId: string, input: UpdateInvoiceInput) {
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!existing || existing.organizationId !== input.organizationId) {
    throw new Error("Invoice not found");
  }

  const issueDate =
    input.issueDate ?? formatDateOnly(existing.issueDate);
  const currency = input.currency ?? existing.currency;
  const originalAmount =
    input.originalAmount ?? existing.originalAmount.toString();

  const issueDateStr = formatDateOnly(existing.issueDate);
  const amountChanged =
    input.originalAmount !== undefined &&
    !decimalsEqual(input.originalAmount, existing.originalAmount);
  const currencyChanged =
    input.currency !== undefined && input.currency !== existing.currency;
  const issueDateChanged =
    input.issueDate !== undefined && input.issueDate !== issueDateStr;
  const rateOverrideChanged = hasRateOverrideChanged(existing, input.rateOverride);

  const rateInputsChanged =
    rateOverrideChanged || amountChanged || currencyChanged || issueDateChanged;

  const onlyAmountChanged =
    amountChanged && !currencyChanged && !issueDateChanged && !rateOverrideChanged;

  let snapshot: RateSnapshot;
  if (!rateInputsChanged) {
    snapshot = snapshotFromExisting(existing);
  } else if (
    onlyAmountChanged &&
    input.rateOverride === undefined
  ) {
    const base = snapshotFromExisting(existing);
    snapshot = {
      ...base,
      rsdAmount: new Decimal(originalAmount).times(base.appliedMiddleRate),
    };
  } else {
    snapshot = await resolveRateSnapshot(
      currency,
      issueDate,
      originalAmount,
      input.rateOverride === null ? undefined : input.rateOverride
    );
  }

  const status = input.status ?? existing.status;
  const includeInLimit =
    status === "CANCELLED"
      ? false
      : input.includeInLimit ?? existing.includeInLimit;

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        invoiceNumber: input.invoiceNumber ?? existing.invoiceNumber,
        clientId: input.clientId ?? existing.clientId,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        dueDate:
          input.dueDate !== undefined
            ? input.dueDate
              ? new Date(input.dueDate)
              : null
            : undefined,
        paymentDate:
          input.paymentDate !== undefined
            ? input.paymentDate
              ? new Date(input.paymentDate)
              : null
            : undefined,
        originalAmount: input.originalAmount ?? undefined,
        billableHours:
          input.billableHours !== undefined ? input.billableHours : undefined,
        currency: input.currency ?? undefined,
        appliedMiddleRate: snapshot.appliedMiddleRate.toFixed(6),
        rateEffectiveDate: snapshot.rateEffectiveDate,
        rsdAmount: snapshot.rsdAmount.toFixed(4),
        rateSource: snapshot.rateSource,
        rateSourceUrl: snapshot.rateSourceUrl,
        rateFetchedAt: snapshot.rateFetchedAt,
        isFallbackRate: snapshot.isFallbackRate,
        fallbackReason: snapshot.fallbackReason,
        manualOverride: snapshot.manualOverride,
        overrideReason: snapshot.overrideReason,
        originalAutoRate: snapshot.originalAutoRate?.toFixed(6) ?? null,
        originalAutoRateEffectiveDate: snapshot.originalAutoRateEffectiveDate,
        status,
        includeInLimit,
        notes: input.notes !== undefined ? input.notes : undefined,
        updatedBy: input.actorUserId,
      },
    });

    await writeAuditEvent({
      organizationId: input.organizationId,
      entityType: "Invoice",
      entityId: invoiceId,
      action: "INVOICE_UPDATED",
      actorUserId: input.actorUserId,
      payload: {
        invoiceNumber: inv.invoiceNumber,
        currency: inv.currency,
        originalAmount: inv.originalAmount.toString(),
        rsdAmount: inv.rsdAmount.toString(),
        status: inv.status,
      },
    });

    if (rateInputsChanged && snapshot.isFallbackRate) {
      await writeAuditEvent({
        organizationId: input.organizationId,
        entityType: "Invoice",
        entityId: invoiceId,
        action: "RATE_FALLBACK_USED",
        actorUserId: input.actorUserId,
        payload: {
          requestedDate: issueDate,
          effectiveDate: snapshot.rateEffectiveDate.toISOString().split("T")[0],
          fallbackReason: snapshot.fallbackReason,
          currency,
          appliedRate: snapshot.appliedMiddleRate.toFixed(6),
        },
      });
    }

    if (rateInputsChanged && snapshot.manualOverride) {
      await writeAuditEvent({
        organizationId: input.organizationId,
        entityType: "Invoice",
        entityId: invoiceId,
        action: "RATE_MANUALLY_OVERRIDDEN",
        actorUserId: input.actorUserId,
        payload: {
          overrideReason: snapshot.overrideReason,
          originalAutoRate: snapshot.originalAutoRate?.toFixed(6),
          overrideRate: snapshot.appliedMiddleRate.toFixed(6),
          currency,
        },
      });
    }

    return inv;
  });

  return updated;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  organizationId: string,
  actorUserId: string,
  newStatus: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED",
  paymentDate?: string | null
) {
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!existing || existing.organizationId !== organizationId) {
    throw new Error("Invoice not found");
  }

  const includeInLimit = newStatus === "CANCELLED" ? false : existing.includeInLimit;

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        includeInLimit,
        paymentDate: paymentDate !== undefined
          ? paymentDate ? new Date(paymentDate) : null
          : undefined,
        updatedBy: actorUserId,
      },
    });

    await writeAuditEvent({
      organizationId,
      entityType: "Invoice",
      entityId: invoiceId,
      action: "INVOICE_STATUS_CHANGED",
      actorUserId,
      payload: {
        from: existing.status,
        to: newStatus,
        paymentDate: paymentDate ?? null,
      },
    });

    return inv;
  });

  return updated;
}

export async function duplicateInvoice(
  sourceId: string,
  organizationId: string,
  actorUserId: string
) {
  const source = await prisma.invoice.findUnique({
    where: { id: sourceId },
  });

  if (!source || source.organizationId !== organizationId) {
    throw new Error("Source invoice not found");
  }

  const existing = await prisma.invoice.findMany({
    where: { organizationId },
    select: { invoiceNumber: true },
  });

  const newInvoiceNumber = suggestNextInvoiceNumber(
    source.invoiceNumber?.trim() || "1",
    existing.map((inv) => inv.invoiceNumber)
  );

  const includeInLimit =
    source.status === "CANCELLED" ? false : source.includeInLimit;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        organizationId,
        clientId: source.clientId,
        invoiceNumber: newInvoiceNumber,
        issueDate: source.issueDate,
        dueDate: source.dueDate,
        paymentDate: source.paymentDate,
        originalAmount: source.originalAmount,
        billableHours: source.billableHours,
        currency: source.currency,
        appliedMiddleRate: source.appliedMiddleRate,
        rateEffectiveDate: source.rateEffectiveDate,
        rsdAmount: source.rsdAmount,
        rateSource: source.rateSource,
        rateSourceUrl: source.rateSourceUrl,
        rateFetchedAt: source.rateFetchedAt,
        isFallbackRate: source.isFallbackRate,
        fallbackReason: source.fallbackReason,
        manualOverride: source.manualOverride,
        overrideReason: source.overrideReason,
        originalAutoRate: source.originalAutoRate,
        originalAutoRateEffectiveDate: source.originalAutoRateEffectiveDate,
        status: source.status,
        includeInLimit,
        notes: source.notes,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
    });

    await writeAuditEvent({
      organizationId,
      entityType: "Invoice",
      entityId: inv.id,
      action: "INVOICE_CREATED",
      actorUserId,
      payload: {
        invoiceNumber: inv.invoiceNumber,
        duplicatedFrom: source.invoiceNumber,
        currency: inv.currency,
        originalAmount: source.originalAmount.toString(),
        rsdAmount: source.rsdAmount.toString(),
        rateSource: source.rateSource,
        appliedMiddleRate: source.appliedMiddleRate.toString(),
        isFallbackRate: source.isFallbackRate,
        manualOverride: source.manualOverride,
        status: inv.status,
      },
    });

    return inv;
  });

  return invoice;
}

export async function getSuggestedInvoiceNumber(
  organizationId: string,
  year: number = new Date().getFullYear()
) {
  const [invoicesInYear, allInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        organizationId,
        issueDate: {
          gte: new Date(year, 0, 1),
          lte: new Date(year, 11, 31, 23, 59, 59, 999),
        },
      },
      select: { invoiceNumber: true },
    }),
    prisma.invoice.findMany({
      where: { organizationId },
      select: { invoiceNumber: true },
    }),
  ]);

  return resolveSuggestedInvoiceNumber(
    invoicesInYear.map((inv) => inv.invoiceNumber),
    year,
    allInvoices.map((inv) => inv.invoiceNumber)
  );
}
