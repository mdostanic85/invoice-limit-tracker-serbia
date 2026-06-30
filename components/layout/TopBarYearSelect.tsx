"use client";

import { Select, Typography } from "antd";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { YEAR_AWARE_ROUTES, YEAR_OPTIONS } from "@/lib/constants/years";
import { useLocale } from "@/components/providers/LocaleProvider";

const { Text } = Typography;

export function TopBarYearSelect() {
  const { t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const show = YEAR_AWARE_ROUTES.some((route) => pathname.startsWith(route));
  if (!show) return null;

  const year = searchParams.get("year") ?? String(new Date().getFullYear());

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", value);
    if (params.has("page")) {
      params.set("page", "1");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="app-topbar-year">
      <Text type="secondary" className="app-topbar-year__label">
        {t("common.year")}
      </Text>
      <Select
        value={year}
        options={YEAR_OPTIONS}
        onChange={handleChange}
        aria-label={t("common.year")}
        className="app-topbar-year__select"
        popupMatchSelectWidth={false}
        style={{ width: 96 }}
      />
    </div>
  );
}
