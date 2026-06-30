"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/services/audit-service";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  updateThresholdSchema,
} from "@/lib/validation/schemas";
import {
  getCountryFormDefaults,
  getLimitCurrency,
  validateAnnualThreshold,
} from "@/lib/domain/country-tax-rules";
import { auth } from "@clerk/nextjs/server";
import Decimal from "decimal.js";
import { serializeForClient } from "@/lib/utils/serialize";

function mergeCountryChangeDefaults(
  data: Record<string, unknown>,
  previousCountryCode: string
) {
  const nextCountry = data.countryCode as string | undefined;
  if (!nextCountry || nextCountry === previousCountryCode) {
    return data;
  }

  const defaults = getCountryFormDefaults(
    nextCountry,
    (data.taxLimitTierId as string | null | undefined) ?? undefined
  );

  return {
    ...data,
    primaryCurrency: defaults.primaryCurrency,
    timezone: defaults.timezone,
    annualThresholdRsd: defaults.annualThresholdRsd,
    taxLimitTierId: defaults.taxLimitTierId,
  };
}

export async function createOrganizationAction(formData: unknown) {
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHENTICATED");

  const parsed = createOrganizationSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const existing = await prisma.organization.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) return { error: "Organization already exists" };

  const org = await prisma.organization.create({
    data: {
      clerkUserId: userId,
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      countryCode: parsed.data.countryCode,
      primaryCurrency: parsed.data.primaryCurrency,
      annualThresholdRsd: parsed.data.annualThresholdRsd,
      taxLimitTierId: parsed.data.taxLimitTierId ?? null,
    },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: org.id,
      clerkUserId: userId,
      role: "OWNER",
    },
  });

  return { data: serializeForClient(org) };
}

export async function acceptDisclaimerAction() {
  const { userId, organizationId } = await getOrgContext();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { disclaimerAcceptedAt: new Date() },
  });

  await writeAuditEvent({
    organizationId,
    entityType: "Organization",
    entityId: organizationId,
    action: "ORG_SETTINGS_UPDATED",
    actorUserId: userId,
    payload: { event: "DISCLAIMER_ACCEPTED", at: new Date().toISOString() },
  });

  return { data: true };
}

export async function updateOrganizationAction(formData: unknown) {
  const ctx = await getOrgContext();

  const raw = typeof formData === "object" && formData !== null ? { ...formData } : formData;
  const merged =
    typeof raw === "object" && raw !== null
      ? mergeCountryChangeDefaults(raw as Record<string, unknown>, ctx.organization.countryCode)
      : raw;

  const parsed = updateOrganizationSchema.safeParse(merged);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: {
      ...parsed.data,
      taxLimitTierId: parsed.data.taxLimitTierId ?? undefined,
    },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Organization",
    entityId: ctx.organizationId,
    action: "ORG_SETTINGS_UPDATED",
    actorUserId: ctx.userId,
    payload: { changes: parsed.data },
  });

  return { data: serializeForClient(org) };
}

export async function updateThresholdAction(formData: unknown) {
  const ctx = await getOrgContext();

  const parsed = updateThresholdSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const validation = validateAnnualThreshold(
    ctx.organization.countryCode,
    parsed.data.annualThresholdRsd,
    parsed.data.taxLimitTierId ?? ctx.organization.taxLimitTierId
  );
  if (!validation.ok) {
    return { error: validation.message };
  }

  const previous = new Decimal(ctx.organization.annualThresholdRsd.toString());
  const newValue = new Decimal(parsed.data.annualThresholdRsd);

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: {
        annualThresholdRsd: parsed.data.annualThresholdRsd,
        ...(parsed.data.taxLimitTierId !== undefined
          ? { taxLimitTierId: parsed.data.taxLimitTierId }
          : {}),
      },
    });

    await tx.annualLimitHistory.create({
      data: {
        organizationId: ctx.organizationId,
        previousValue: previous.toFixed(4),
        newValue: newValue.toFixed(4),
        reason: parsed.data.reason,
        changedBy: ctx.userId,
      },
    });
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Organization",
    entityId: ctx.organizationId,
    action: "ANNUAL_LIMIT_CHANGED",
    actorUserId: ctx.userId,
    payload: {
      previous: previous.toFixed(4),
      new: newValue.toFixed(4),
      reason: parsed.data.reason,
      limitCurrency: getLimitCurrency(ctx.organization.countryCode),
    },
  });

  return { data: true };
}

export async function updateReportingBasisAction(
  basis: "ISSUE_DATE" | "PAYMENT_DATE"
) {
  const ctx = await getOrgContext();

  await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { defaultReportingBasis: basis },
  });

  return { data: true };
}

export async function updateLocaleAction(locale: "EN" | "SR") {
  const ctx = await getOrgContext();

  const org = await prisma.organization.update({
    where: { id: ctx.organizationId },
    data: { preferredLocale: locale },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "Organization",
    entityId: ctx.organizationId,
    action: "ORG_SETTINGS_UPDATED",
    actorUserId: ctx.userId,
    payload: { preferredLocale: locale },
  });

  return { data: serializeForClient(org) };
}
