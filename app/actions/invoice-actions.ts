"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { createInvoice, updateInvoice, updateInvoiceStatus, duplicateInvoice, getSuggestedInvoiceNumber } from "@/lib/services/invoice-service";
import { writeAuditEvent } from "@/lib/services/audit-service";
import { getExchangeRateProvider } from "@/lib/exchange-rate";
import { getLimitStatus } from "@/lib/services/limit-service";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";
import { wouldExceedLimit } from "@/lib/domain/limit-calculations";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  ratePreviewSchema,
  invoiceFilterSchema,
} from "@/lib/validation/schemas";
import { isEligible } from "@/lib/domain/limit-calculations";
import Decimal from "decimal.js";
import { serializeForClient } from "@/lib/utils/serialize";

type InvoiceListPath = "/invoices" | "/reports";
type InvoiceSaveToast = "saved" | "updated";

function resolveInvoiceReturnPath(returnPath?: string): InvoiceListPath {
  return returnPath === "/reports" ? "/reports" : "/invoices";
}

function redirectAfterInvoiceSave(returnPath: string | undefined, toast: InvoiceSaveToast): never {
  const path = resolveInvoiceReturnPath(returnPath);
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath(path);
  redirect(`${path}?toast=${toast}`);
}

export async function previewExchangeRateAction(formData: unknown) {
  await getOrgContext(); // auth check

  const parsed = ratePreviewSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const { currency, date } = parsed.data;

  if (currency === "RSD") {
    return {
      data: {
        currency: "RSD",
        ratePerUnit: "1",
        effectiveDate: date,
        requestedDate: date,
        isFallback: false,
        fallbackReason: null,
        source: "NBS_MIDDLE" as const,
        sourceUrl: null,
      },
    };
  }

  try {
    const provider = getExchangeRateProvider();
    const result = await provider.getMiddleRate({ currency, date: new Date(date) });

    return {
      data: {
        currency: result.currency,
        ratePerUnit: result.ratePerUnit.toFixed(6),
        effectiveDate: result.effectiveDate,
        requestedDate: result.requestedDate,
        isFallback: result.isFallback,
        fallbackReason: result.fallbackReason ?? null,
        source: result.source,
        sourceUrl: result.sourceUrl,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Rate fetch failed";
    return { error: message };
  }
}

export async function getSuggestedInvoiceNumberAction(year?: number) {
  const ctx = await getOrgContext();
  const suggested = await getSuggestedInvoiceNumber(
    ctx.organizationId,
    year ?? new Date().getFullYear()
  );
  return { data: suggested };
}

export async function createInvoiceAction(formData: unknown, returnPath?: string) {
  const ctx = await getOrgContext();

  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  // Pre-check limit for non-draft invoices
  if (parsed.data.status !== "DRAFT" && parsed.data.status !== "CANCELLED") {
    try {
      const limitStatus = await getLimitStatus(
        ctx.organizationId,
        new Date(parsed.data.issueDate).getFullYear(),
        ctx.organization.defaultReportingBasis,
        ctx.organization.annualThresholdRsd.toString(),
        ctx.organization.countryCode
      );

      const limitCurrency = getLimitCurrency(ctx.organization.countryCode);
      let estimatedLimitAmount = new Decimal(parsed.data.originalAmount);
      if (limitCurrency === "RSD" && parsed.data.currency !== "RSD") {
        try {
          const provider = getExchangeRateProvider();
          const rate = await provider.getMiddleRate({
            currency: parsed.data.currency,
            date: new Date(parsed.data.issueDate),
          });
          estimatedLimitAmount = new Decimal(parsed.data.originalAmount).times(
            rate.ratePerUnit
          );
        } catch {
          // Cannot estimate — proceed and let the final save compute it
        }
      }

      const check = wouldExceedLimit(
        limitStatus.actualTotal,
        estimatedLimitAmount,
        limitStatus.threshold
      );

      if (check.exceeds) {
        // Return warning data so the client can show the blocking modal
        return {
          warning: {
            type: "EXCEEDS_LIMIT" as const,
            currentActual: limitStatus.actualTotal.toFixed(4),
            newAmount: estimatedLimitAmount.toFixed(4),
            newTotal: check.newTotal.toFixed(4),
            threshold: limitStatus.threshold.toFixed(4),
            overage: check.overage.toFixed(4),
            percentUsed: check.percentUsed,
            basis: ctx.organization.defaultReportingBasis,
          },
        };
      }
    } catch {
      // Limit check failed — proceed and save anyway
    }
  }

  try {
    const rateOverride =
      parsed.data.manualOverride && parsed.data.overrideReason
        ? {
            ratePerUnit: parsed.data.appliedMiddleRate ?? "1",
            reason: parsed.data.overrideReason,
          }
        : undefined;

    await createInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      invoiceNumber: parsed.data.invoiceNumber,
      clientId: parsed.data.clientId,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      paymentDate: parsed.data.paymentDate,
      originalAmount: parsed.data.originalAmount,
      billableHours: parsed.data.billableHours ?? null,
      currency: parsed.data.currency,
      status: parsed.data.status,
      includeInLimit: parsed.data.includeInLimit,
      notes: parsed.data.notes,
      rateOverride,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return { error: message };
  }

  redirectAfterInvoiceSave(returnPath, "saved");
}

export async function createInvoiceConfirmedAction(formData: unknown, returnPath?: string) {
  // Called after user confirms the blocking modal — skip limit pre-check
  const ctx = await getOrgContext();

  const parsed = createInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  try {
    const rateOverride =
      parsed.data.manualOverride && parsed.data.overrideReason
        ? {
            ratePerUnit: parsed.data.appliedMiddleRate ?? "1",
            reason: parsed.data.overrideReason,
          }
        : undefined;

    await createInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      invoiceNumber: parsed.data.invoiceNumber,
      clientId: parsed.data.clientId,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      paymentDate: parsed.data.paymentDate,
      originalAmount: parsed.data.originalAmount,
      billableHours: parsed.data.billableHours ?? null,
      currency: parsed.data.currency,
      status: parsed.data.status,
      includeInLimit: parsed.data.includeInLimit,
      notes: parsed.data.notes,
      rateOverride,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invoice";
    return { error: message };
  }

  redirectAfterInvoiceSave(returnPath, "saved");
}

async function persistInvoiceUpdate(
  invoiceId: string,
  parsed: ReturnType<typeof updateInvoiceSchema.parse>
) {
  const ctx = await getOrgContext();

  const rateOverride =
    parsed.manualOverride && parsed.appliedMiddleRate
      ? {
          ratePerUnit: parsed.appliedMiddleRate,
          reason: parsed.overrideReason ?? "Manual rate override",
        }
      : parsed.manualOverride === false
        ? null
        : undefined;

  const invoice = await updateInvoice(invoiceId, {
    organizationId: ctx.organizationId,
    actorUserId: ctx.userId,
    invoiceNumber: parsed.invoiceNumber,
    clientId: parsed.clientId,
    issueDate: parsed.issueDate,
    dueDate: parsed.dueDate,
    paymentDate: parsed.paymentDate,
    originalAmount: parsed.originalAmount,
    billableHours: parsed.billableHours ?? null,
    currency: parsed.currency,
    status: parsed.status,
    includeInLimit: parsed.includeInLimit,
    notes: parsed.notes,
    rateOverride,
  });

  return invoice;
}

export async function updateInvoiceAction(
  invoiceId: string,
  formData: unknown,
  returnPath?: string
) {
  const ctx = await getOrgContext();

  const parsed = updateInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      organizationId: true,
      issueDate: true,
      paymentDate: true,
      status: true,
      includeInLimit: true,
      rsdAmount: true,
      currency: true,
      originalAmount: true,
    },
  });

  if (!existing || existing.organizationId !== ctx.organizationId) {
    return { error: "Invoice not found" };
  }

  const nextStatus = parsed.data.status ?? existing.status;

  if (nextStatus !== "DRAFT" && nextStatus !== "CANCELLED") {
    try {
      const issueDate = parsed.data.issueDate ?? existing.issueDate.toISOString().split("T")[0];
      const year = new Date(issueDate).getFullYear();
      const basis = ctx.organization.defaultReportingBasis;

      const limitStatus = await getLimitStatus(
        ctx.organizationId,
        year,
        basis,
        ctx.organization.annualThresholdRsd.toString(),
        ctx.organization.countryCode
      );

      const oldSummary = {
        id: existing.id,
        rsdAmount: existing.rsdAmount.toString(),
        issueDate: existing.issueDate,
        paymentDate: existing.paymentDate,
        status: existing.status,
        includeInLimit: existing.includeInLimit,
        currency: existing.currency,
        originalAmount: existing.originalAmount.toString(),
        clientId: "",
        invoiceNumber: "",
      };

      let adjustedActual = limitStatus.actualTotal;
      if (isEligible(oldSummary, basis, year)) {
        adjustedActual = adjustedActual.minus(existing.rsdAmount.toString());
      }

      const limitCurrency = getLimitCurrency(ctx.organization.countryCode);
      const currency = parsed.data.currency ?? existing.currency;
      let estimatedLimitAmount = new Decimal(
        parsed.data.originalAmount ?? existing.originalAmount.toString()
      );

      if (limitCurrency === "RSD" && currency !== "RSD") {
        try {
          const provider = getExchangeRateProvider();
          const rate = await provider.getMiddleRate({
            currency,
            date: new Date(issueDate),
          });
          estimatedLimitAmount = estimatedLimitAmount.times(rate.ratePerUnit);
        } catch {
          // Cannot estimate — proceed and let the final save compute it
        }
      }

      const check = wouldExceedLimit(
        adjustedActual,
        estimatedLimitAmount,
        limitStatus.threshold
      );

      if (check.exceeds) {
        return {
          warning: {
            type: "EXCEEDS_LIMIT" as const,
            currentActual: adjustedActual.toFixed(4),
            newAmount: estimatedLimitAmount.toFixed(4),
            newTotal: check.newTotal.toFixed(4),
            threshold: limitStatus.threshold.toFixed(4),
            overage: check.overage.toFixed(4),
            percentUsed: check.percentUsed,
            basis,
          },
        };
      }
    } catch {
      // Limit check failed — proceed and save anyway
    }
  }

  try {
    await persistInvoiceUpdate(invoiceId, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update invoice";
    return { error: message };
  }

  redirectAfterInvoiceSave(returnPath, "updated");
}

export async function updateInvoiceConfirmedAction(
  invoiceId: string,
  formData: unknown,
  returnPath?: string
) {
  const ctx = await getOrgContext();

  const parsed = updateInvoiceSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, organizationId: true },
  });

  if (!existing || existing.organizationId !== ctx.organizationId) {
    return { error: "Invoice not found" };
  }

  try {
    await persistInvoiceUpdate(invoiceId, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update invoice";
    return { error: message };
  }

  redirectAfterInvoiceSave(returnPath, "updated");
}

export async function updateInvoiceStatusAction(
  invoiceId: string,
  newStatus: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED",
  paymentDate?: string | null
) {
  const ctx = await getOrgContext();

  try {
    const invoice = await updateInvoiceStatus(
      invoiceId,
      ctx.organizationId,
      ctx.userId,
      newStatus,
      paymentDate
    );
    return { data: serializeForClient(invoice) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update invoice";
    return { error: message };
  }
}

export async function duplicateInvoiceAction(sourceId: string) {
  const ctx = await getOrgContext();

  try {
    const invoice = await duplicateInvoice(sourceId, ctx.organizationId, ctx.userId);
    return { data: serializeForClient(invoice) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to duplicate invoice";
    return { error: message };
  }
}

export async function deleteInvoiceAction(invoiceId: string) {
  const ctx = await getOrgContext();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      organizationId: true,
      invoiceNumber: true,
      clientId: true,
      rsdAmount: true,
      status: true,
    },
  });

  if (!invoice || invoice.organizationId !== ctx.organizationId) {
    return { error: "Invoice not found" };
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Invoice",
    entityId: invoiceId,
    action: "INVOICE_DELETED",
    actorUserId: ctx.userId,
    payload: {
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      rsdAmount: invoice.rsdAmount.toString(),
      status: invoice.status,
    },
  });

  return { data: true };
}

export async function getInvoicesAction(filters: unknown) {
  const ctx = await getOrgContext();

  const parsed = invoiceFilterSchema.safeParse(filters);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const f = parsed.data;
  const basis = f.basis ?? ctx.organization.defaultReportingBasis;

  const dateField = basis === "ISSUE_DATE" ? "issueDate" : "paymentDate";
  const yearStart = f.year ? new Date(f.year, 0, 1) : undefined;
  const yearEnd = f.year ? new Date(f.year, 11, 31) : undefined;

  const where = {
    organizationId: ctx.organizationId,
    ...(f.status && { status: f.status }),
    ...(f.clientId && { clientId: f.clientId }),
    ...(f.currency && { currency: f.currency }),
    ...(f.includeInLimit !== undefined && { includeInLimit: f.includeInLimit }),
    ...(f.year && {
      [dateField]: { gte: yearStart, lte: yearEnd },
    }),
    ...(f.dateFrom && { [dateField]: { gte: new Date(f.dateFrom) } }),
    ...(f.dateTo && { [dateField]: { lte: new Date(f.dateTo) } }),
    ...(f.search && {
      OR: [
        { invoiceNumber: { contains: f.search, mode: "insensitive" as const } },
        { notes: { contains: f.search, mode: "insensitive" as const } },
        {
          client: {
            displayName: { contains: f.search, mode: "insensitive" as const },
          },
        },
      ],
    }),
  };

  const sortField = f.sortField ?? "issueDate";
  const sortOrder = f.sortOrder === "ascend" ? "asc" : "desc";
  const validSortFields = [
    "issueDate",
    "paymentDate",
    "invoiceNumber",
    "rsdAmount",
    "originalAmount",
    "status",
  ];
  const orderBy = validSortFields.includes(sortField)
    ? { [sortField]: sortOrder }
    : { issueDate: "desc" as const };

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      include: { client: { select: { displayName: true } } },
      orderBy,
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
    }),
  ]);

  // Compute filtered sum
  const aggregated = await prisma.invoice.aggregate({
    where: { ...where, status: { notIn: ["CANCELLED", "DRAFT"] }, includeInLimit: true },
    _sum: { rsdAmount: true },
  });

  return {
    data: serializeForClient({
      invoices,
      total,
      page: f.page,
      pageSize: f.pageSize,
      filteredTotal: aggregated._sum.rsdAmount?.toString() ?? "0",
    }),
  };
}

export async function getInvoiceDetailAction(id: string) {
  const ctx = await getOrgContext();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      attachments: true,
    },
  });

  if (!invoice || invoice.organizationId !== ctx.organizationId) {
    return { error: "Invoice not found" };
  }

  return { data: serializeForClient(invoice) };
}
