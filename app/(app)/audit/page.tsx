import { getAuditLogAction } from "@/app/actions/dashboard-actions";
import { AuditLogClient } from "./AuditLogClient";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const result = await getAuditLogAction(page, 50);

  return <AuditLogClient data={result.data} />;
}
