import { redirect } from "next/navigation";
import { getDashboardAction } from "@/app/actions/dashboard-actions";
import { getOrgContextSafe } from "@/lib/auth/get-org-context";
import { DashboardClient } from "./DashboardClient";
import { DashboardLoadError } from "./DashboardLoadError";

interface PageProps {
  searchParams: Promise<{ year?: string; scenario?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const ctx = await getOrgContextSafe();
  if (!ctx) redirect("/onboarding");
  if (!ctx.organization.disclaimerAcceptedAt) {
    redirect("/onboarding?step=disclaimer");
  }

  const params = await searchParams;
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const scenario = (params.scenario ?? "EXPECTED") as
    | "CONSERVATIVE"
    | "EXPECTED"
    | "OPTIMISTIC";

  const result = await getDashboardAction(year, scenario);

  if (!result.data) {
    return <DashboardLoadError />;
  }

  return <DashboardClient data={result.data} />;
}
