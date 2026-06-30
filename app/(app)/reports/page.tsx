import { getInvoicesAction } from "@/app/actions/invoice-actions";
import { getClientsAction } from "@/app/actions/client-actions";
import { getOrgContext } from "@/lib/auth/get-org-context";
import { getMessages } from "@/lib/i18n";
import { createTranslator, dbLocaleToLocale } from "@/lib/i18n/types";
import { InvoicesClient } from "../invoices/InvoicesClient";

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const ctx = await getOrgContext();
  const basis = ctx.organization.defaultReportingBasis;
  const t = createTranslator(getMessages(dbLocaleToLocale(ctx.organization.preferredLocale)));

  const [invoicesResult, clientsResult] = await Promise.all([
    getInvoicesAction({
      year,
      page: params.page ? parseInt(params.page) : 1,
      pageSize: 50,
      search: params.search,
      status: params.status,
      clientId: params.clientId,
      currency: params.currency,
      basis,
      sortField: params.sortField,
      sortOrder: params.sortOrder as "ascend" | "descend" | undefined,
    }),
    getClientsAction(true),
  ]);

  return (
    <InvoicesClient
      pageTitle={t("nav.reports")}
      initialData={invoicesResult.data ?? null}
      clients={(clientsResult.data ?? []) as Parameters<typeof InvoicesClient>[0]["clients"]}
      initialFilters={params}
    />
  );
}
