import { getClientsAction } from "@/app/actions/client-actions";
import { ClientsClient } from "./ClientsClient";

interface PageProps {
  searchParams: Promise<{ search?: string; status?: string }>;
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await getClientsAction(params.status === "archived");

  return (
    <ClientsClient
      clients={(result.data ?? []) as Parameters<typeof ClientsClient>[0]["clients"]}
      showArchived={params.status === "archived"}
    />
  );
}
