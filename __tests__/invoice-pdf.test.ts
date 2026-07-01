import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  generateInvoicePdfBuffer,
  invoicePdfFilename,
} from "@/lib/services/invoice-pdf-service";
import type { Client, Invoice, Organization } from "@prisma/client";

function buildFixture(template: "MINIMAL" | "AGENCY" = "MINIMAL") {
  const organization = {
    id: "org-1",
    clerkUserId: "user-1",
    name: "Marko Petrović PR",
    timezone: "Europe/Belgrade",
    countryCode: "RS",
    primaryCurrency: "RSD",
    annualThresholdRsd: new Decimal("6000000"),
    taxLimitTierId: null,
    defaultReportingBasis: "ISSUE_DATE",
    preferredLocale: "SR",
    disclaimerAcceptedAt: new Date(),
    issuerLegalName: "Marko Petrović PR Beograd",
    issuerAddress: "Knez Mihailova 1, Beograd",
    issuerTaxId: "123456789",
    issuerRegistrationNumber: "12345678",
    issuerBankAccount: "160-123456-78",
    issuerEmail: "marko@example.rs",
    issuerPhone: "+381 60 123 4567",
    invoicePdfTemplate: template,
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Organization;

  const client = {
    id: "client-1",
    organizationId: "org-1",
    displayName: "Acme DOO",
    legalName: "Acme d.o.o. Beograd",
    countryCode: "RS",
    email: "billing@acme.rs",
    taxId: "987654321",
    defaultCurrency: "EUR",
    notes: null,
    billingModel: "FIXED",
    hourlyRate: null,
    hourlyCurrency: null,
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  } satisfies Client;

  const invoice = {
    id: "inv-1",
    organizationId: "org-1",
    clientId: "client-1",
    invoiceNumber: "2026-001",
    issueDate: new Date("2026-03-15"),
    dueDate: new Date("2026-04-15"),
    paymentDate: null,
    originalAmount: new Decimal("1500"),
    billableHours: null,
    currency: "EUR",
    appliedMiddleRate: new Decimal("117.4021"),
    rateEffectiveDate: new Date("2026-03-14"),
    rsdAmount: new Decimal("176103.15"),
    rateSource: "NBS_MIDDLE",
    rateSourceUrl: "https://nbs.rs",
    rateFetchedAt: new Date(),
    isFallbackRate: false,
    fallbackReason: null,
    manualOverride: false,
    overrideReason: null,
    originalAutoRate: null,
    originalAutoRateEffectiveDate: null,
    status: "ISSUED",
    includeInLimit: true,
    notes: "Usluge za mart 2026.",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: "user-1",
    updatedBy: "user-1",
  } satisfies Invoice;

  return { organization, client, invoice };
}

describe("invoice-pdf-service", () => {
  it("generates a valid PDF buffer for minimal template", async () => {
    const input = buildFixture("MINIMAL");
    const buffer = await generateInvoicePdfBuffer(input);

    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generates a valid PDF buffer for agency template", async () => {
    const input = buildFixture("AGENCY");
    const buffer = await generateInvoicePdfBuffer(input);

    expect(buffer.byteLength).toBeGreaterThan(1000);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("sanitizes invoice numbers in filenames", () => {
    expect(invoicePdfFilename("2026/001")).toBe("invoice-2026_001.pdf");
    expect(invoicePdfFilename("INV #42")).toBe("invoice-INV_42.pdf");
  });
});
