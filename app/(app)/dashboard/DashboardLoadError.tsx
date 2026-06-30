"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

export function DashboardLoadError() {
  const { t } = useLocale();
  return <div>{t("dashboard.loadError")}</div>;
}
