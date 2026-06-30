"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { getDashboardData } from "@/lib/services/limit-service";
import { prisma } from "@/lib/db/prisma";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";
import { serializeForClient } from "@/lib/utils/serialize";

export async function getDashboardAction(
  year?: number,
  scenario?: "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC"
) {
  const ctx = await getOrgContext();

  const selectedYear = year ?? new Date().getFullYear();
  const selectedScenario = scenario ?? "EXPECTED";

  const dashData = await getDashboardData(
    ctx.organizationId,
    selectedYear,
    ctx.organization.defaultReportingBasis,
    ctx.organization.annualThresholdRsd.toString(),
    selectedScenario,
    ctx.organization.countryCode
  );

  // Recent 5 invoices
  const recentInvoices = await prisma.invoice.findMany({
    where: { organizationId: ctx.organizationId },
    include: { client: { select: { displayName: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Upcoming forecast (next 5 active entries)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingForecast = await prisma.forecastEntry.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      scenario: selectedScenario,
      expectedDate: { gte: today },
    },
    include: { client: { select: { displayName: true } } },
    orderBy: { expectedDate: "asc" },
    take: 5,
  });

  // Client lookup map for client chart
  const clientIds = dashData.clientData.map((c) => c.clientId);
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, displayName: true },
  });
  const clientMap = Object.fromEntries(clients.map((c: { id: string; displayName: string }) => [c.id, c.displayName]));

  return {
    data: serializeForClient({
      organization: {
        name: ctx.organization.name,
        countryCode: ctx.organization.countryCode,
        annualThresholdRsd: ctx.organization.annualThresholdRsd.toString(),
        limitCurrency: getLimitCurrency(ctx.organization.countryCode),
        defaultReportingBasis: ctx.organization.defaultReportingBasis,
        disclaimerAcceptedAt: ctx.organization.disclaimerAcceptedAt,
      },
      year: selectedYear,
      scenario: selectedScenario,
      limitStatus: {
        actualTotal: dashData.limitStatus.actualTotal.toFixed(4),
        threshold: dashData.limitStatus.threshold.toFixed(4),
        remaining: dashData.limitStatus.remaining.toFixed(4),
        percentUsed: dashData.limitStatus.percentUsed,
        thresholdState: dashData.limitStatus.thresholdState,
        excludedCount: dashData.limitStatus.excludedCount,
      },
      projection: {
        projectedTotal: dashData.projection.projectedTotal.toFixed(4),
        projectedRemaining: dashData.projection.projectedRemaining.toFixed(4),
        projectedPercentUsed: dashData.projection.projectedPercentUsed,
        projectedThresholdState: dashData.projection.projectedThresholdState,
        forecastContribution: dashData.projection.forecastContribution.toFixed(4),
        crossingMonth: dashData.projection.crossingMonth,
      },
      monthlyData: dashData.monthlyData,
      clientData: dashData.clientData.map((c) => ({
        ...c,
        displayName: clientMap[c.clientId] ?? "Unknown",
      })),
      statusCounts: dashData.statusCounts,
      recentInvoices,
      upcomingForecast,
    }),
  };
}

export async function getAuditLogAction(page = 1, pageSize = 50) {
  const ctx = await getOrgContext();

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where: { organizationId: ctx.organizationId } }),
    prisma.auditEvent.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data: serializeForClient({ events, total, page, pageSize }) };
}
