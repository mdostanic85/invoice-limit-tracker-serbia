"use client";

import { Segmented, Tooltip, theme } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useThemePreference } from "@/lib/theme/ThemeProvider";
import type { ThemePreference } from "@/lib/theme/types";
import { useLocale } from "@/components/providers/LocaleProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useThemePreference();
  const { token } = theme.useToken();
  const { t } = useLocale();

  const options = [
    {
      value: "light" as const,
      label: (
        <Tooltip title={t("common.themeLight")}>
          <SunOutlined aria-label={t("common.themeLight")} />
        </Tooltip>
      ),
    },
    {
      value: "dark" as const,
      label: (
        <Tooltip title={t("common.themeDark")}>
          <MoonOutlined aria-label={t("common.themeDark")} />
        </Tooltip>
      ),
    },
  ];

  return (
    <Segmented
      size="small"
      className={className}
      value={preference}
      options={options}
      onChange={(value) => setPreference(value as ThemePreference)}
      aria-label={t("common.themePreference")}
      style={{ background: token.colorFillSecondary }}
    />
  );
}
