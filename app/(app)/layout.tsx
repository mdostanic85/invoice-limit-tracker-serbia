import { redirect } from "next/navigation";
import { getOrgContextSafe } from "@/lib/auth/get-org-context";
import { AppShell } from "@/components/layout/AppShell";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContextSafe();
  if (!ctx) redirect("/onboarding");

  const org = ctx.organization;
  if (!org.disclaimerAcceptedAt) redirect("/onboarding?step=disclaimer");

  return (
    <LocaleProvider initialLocale={org.preferredLocale}>
      <AppShell orgName={org.name}>{children}</AppShell>
    </LocaleProvider>
  );
}
