import { getClientsAction } from "@/app/actions/client-actions";
import { getSuggestedInvoiceNumberAction } from "@/app/actions/invoice-actions";
import { InvoiceFormClient } from "../InvoiceFormClient";

export default async function NewInvoicePage() {
  const [clientsResult, suggestedResult] = await Promise.all([
    getClientsAction(),
    getSuggestedInvoiceNumberAction(),
  ]);

  return (
    <InvoiceFormClient
      clients={(clientsResult.data ?? []) as Parameters<typeof InvoiceFormClient>[0]["clients"]}
      suggestedInvoiceNumber={suggestedResult.data}
    />
  );
}
