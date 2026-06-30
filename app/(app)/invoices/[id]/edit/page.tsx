import { getClientsAction } from "@/app/actions/client-actions";
import { getInvoiceDetailAction } from "@/app/actions/invoice-actions";
import { notFound } from "next/navigation";
import { InvoiceFormClient } from "../../InvoiceFormClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

export default async function EditInvoicePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const returnPath = from === "reports" ? "/reports" : "/invoices";

  const [clientsResult, invoiceResult] = await Promise.all([
    getClientsAction(),
    getInvoiceDetailAction(id),
  ]);

  if ("error" in invoiceResult && invoiceResult.error) {
    notFound();
  }

  const invoice = invoiceResult.data;
  if (!invoice) notFound();

  return (
    <InvoiceFormClient
      invoiceId={id}
      returnPath={returnPath}
      initialInvoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        status: invoice.status,
        issueDate: String(invoice.issueDate),
        dueDate: invoice.dueDate ? String(invoice.dueDate) : null,
        paymentDate: invoice.paymentDate ? String(invoice.paymentDate) : null,
        billableHours: invoice.billableHours != null ? String(invoice.billableHours) : null,
        originalAmount: String(invoice.originalAmount),
        currency: invoice.currency,
        includeInLimit: invoice.includeInLimit,
        notes: invoice.notes,
        manualOverride: invoice.manualOverride,
        appliedMiddleRate: String(invoice.appliedMiddleRate),
        overrideReason: invoice.overrideReason,
        rateEffectiveDate: String(invoice.rateEffectiveDate),
        isFallbackRate: invoice.isFallbackRate,
        fallbackReason: invoice.fallbackReason,
        rateSource: invoice.rateSource,
        rateSourceUrl: invoice.rateSourceUrl,
      }}
      clients={(clientsResult.data ?? []) as Parameters<typeof InvoiceFormClient>[0]["clients"]}
    />
  );
}
