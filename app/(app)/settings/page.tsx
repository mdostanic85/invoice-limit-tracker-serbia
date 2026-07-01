import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const ctx = await getOrgContext();

  const limitHistory = await prisma.annualLimitHistory.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { changedAt: "desc" },
    take: 20,
  });

  return (
    <SettingsClient
      organization={{
        name: ctx.organization.name,
        timezone: ctx.organization.timezone,
        countryCode: ctx.organization.countryCode,
        primaryCurrency: ctx.organization.primaryCurrency,
        annualThresholdRsd: ctx.organization.annualThresholdRsd.toString(),
        taxLimitTierId: ctx.organization.taxLimitTierId,
        limitCurrency: getLimitCurrency(ctx.organization.countryCode),
        defaultReportingBasis: ctx.organization.defaultReportingBasis,
        preferredLocale: ctx.organization.preferredLocale,
        issuerLegalName: ctx.organization.issuerLegalName,
        issuerAddress: ctx.organization.issuerAddress,
        issuerTaxId: ctx.organization.issuerTaxId,
        issuerRegistrationNumber: ctx.organization.issuerRegistrationNumber,
        issuerBankAccount: ctx.organization.issuerBankAccount,
        issuerEmail: ctx.organization.issuerEmail,
        issuerPhone: ctx.organization.issuerPhone,
        invoicePdfTemplate: ctx.organization.invoicePdfTemplate,
      }}
      limitHistory={limitHistory.map((h) => ({
        previousValue: h.previousValue.toString(),
        newValue: h.newValue.toString(),
        reason: h.reason ?? null,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
      }))}
    />
  );
}
