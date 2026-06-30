import type { ThemeConfig } from "antd";
import { theme } from "antd";

/** Shared spacing and density tokens for light and dark themes. */
const baseToken = {
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  paddingXS: 4,
  paddingSM: 8,
  paddingMD: 16,
  paddingLG: 24,
  paddingXL: 32,
  marginXS: 4,
  marginSM: 8,
  marginMD: 16,
  marginLG: 24,
  marginXL: 32,
  borderRadius: 6,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  lineHeight: 1.5,
  lineHeightLG: 1.4,
  controlHeight: 32,
  controlHeightSM: 24,
  controlHeightLG: 40,
};

export const APP_FONT_FAMILY = baseToken.fontFamily;

const baseComponents: ThemeConfig["components"] = {
  Table: {
    cellPaddingBlock: 12,
    cellPaddingInline: 16,
    headerBg: undefined,
    headerBorderRadius: 6,
  },
  Layout: {
    headerHeight: 48,
    bodyBg: undefined,
    triggerBg: undefined,
  },
  Card: {
    paddingLG: 16,
  },
  Form: {
    itemMarginBottom: 16,
  },
  Statistic: {
    contentFontSize: 16,
  },
};

/** Light theme — calm, data-dense operational workspace. */
export const lightThemeConfig: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...baseToken,
    colorPrimary: "#1565c0",
    colorInfo: "#1565c0",
    colorSuccess: "#2e7d32",
    colorWarning: "#ed6c02",
    colorError: "#c62828",
    colorBgLayout: "#eef1f5",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "#d9dee5",
    colorBorderSecondary: "#e8ecf1",
    colorText: "#1a2332",
    colorTextSecondary: "#4a5568",
    colorTextTertiary: "#6b7280",
    colorFillAlter: "#f6f8fa",
    colorFillSecondary: "#eef1f5",
    boxShadowTertiary:
      "0 1px 2px 0 rgba(16, 24, 40, 0.05), 0 1px 3px 0 rgba(16, 24, 40, 0.08)",
  },
  components: baseComponents,
};

/** Dark theme — readable financial UI, not pure black inversion. */
export const darkThemeConfig: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...baseToken,
    colorPrimary: "#5b9cf5",
    colorInfo: "#5b9cf5",
    colorSuccess: "#4caf7a",
    colorWarning: "#f5a623",
    colorError: "#ef5350",
    colorBgLayout: "#0f1216",
    colorBgContainer: "#181c22",
    colorBgElevated: "#1e2329",
    colorBorder: "#2e3640",
    colorBorderSecondary: "#252b33",
    colorText: "#e8eaed",
    colorTextSecondary: "#a8b0bb",
    colorTextTertiary: "#7a8494",
    colorFillAlter: "#1e2329",
    colorFillSecondary: "#252b33",
    boxShadowTertiary:
      "0 1px 2px 0 rgba(0, 0, 0, 0.35), 0 2px 6px 0 rgba(0, 0, 0, 0.25)",
  },
  components: {
    ...baseComponents,
    Table: {
      ...baseComponents?.Table,
      headerBg: "#1e2329",
      rowHoverBg: "#222830",
      filterDropdownBg: "#1e2329",
      filterDropdownMenuBg: "#1e2329",
      headerFilterHoverBg: "#252b33",
    },
    Layout: {
      ...baseComponents?.Layout,
      siderBg: "#181c22",
      triggerBg: "#1e2329",
    },
  },
};

export function getThemeConfig(isDark: boolean): ThemeConfig {
  return isDark ? darkThemeConfig : lightThemeConfig;
}
