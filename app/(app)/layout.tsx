import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await prisma.organization.findUnique({
    where: { clerkUserId: userId },
  });

  if (!org) redirect("/onboarding");
  if (!org.disclaimerAcceptedAt) redirect("/onboarding?step=disclaimer");

  return (
    <LocaleProvider initialLocale={org.preferredLocale}>
      <AppShell orgName={org.name}>{children}</AppShell>
    </LocaleProvider>
  );
}
