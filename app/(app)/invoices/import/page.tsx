import { getClientsAction } from "@/app/actions/client-actions";
import { ImportInvoiceClient } from "./ImportInvoiceClient";

export default async function ImportInvoicePage() {
  const clientsResult = await getClientsAction();

  return <ImportInvoiceClient clients={clientsResult.data ?? []} />;
}
