"use client";

import { Card, Typography, Tooltip, theme } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";

const { Text } = Typography;

interface KpiCardProps {
  children: ReactNode;
  interactive?: boolean;
}

/** Equal-height KPI shell for dashboard stat rows. */
export function KpiCard({ children, interactive = false }: KpiCardProps) {
  const { token } = theme.useToken();

  return (
    <Card
      className={interactive ? "widget-card widget-card--interactive" : "widget-card"}
      style={{ width: "100%", height: "100%" }}
      styles={{
        body: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: token.paddingMD,
        },
      }}
    >
      {children}
    </Card>
  );
}

interface DashboardKpiStatProps {
  title: string;
  value: ReactNode;
  valueColor?: string;
  valueStyle?: CSSProperties;
  footer?: ReactNode;
  hint?: string;
}

/** Structured KPI layout: label, prominent value, optional footer context. */
export function DashboardKpiStat({
  title,
  value,
  valueColor,
  valueStyle,
  footer,
  hint,
}: DashboardKpiStatProps) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        width: "100%",
        minHeight: 96,
        gap: token.marginSM,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: token.marginXS }}>
        <Text type="secondary" style={{ fontSize: token.fontSizeLG, lineHeight: 1.4, flex: 1 }}>
          {title}
        </Text>
        {hint && (
          <Tooltip title={hint} placement="topLeft">
            <InfoCircleOutlined
              style={{ color: token.colorTextTertiary, fontSize: token.fontSizeLG, marginTop: 2, flexShrink: 0 }}
              aria-label={hint}
            />
          </Tooltip>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          minHeight: 0,
        }}
      >
        <Text
          style={{
            fontSize: "clamp(1.625rem, 2.4vw, 2rem)",
            fontWeight: 700,
            color: valueColor ?? token.colorText,
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            ...valueStyle,
          }}
          className="kpi-stat-value"
        >
          {value}
        </Text>
      </div>

      <div style={{ minHeight: token.fontSizeLG * 1.5, fontSize: token.fontSizeLG }}>
        {footer ?? (
          <Text type="secondary" style={{ fontSize: token.fontSizeLG, visibility: "hidden" }}>
            —
          </Text>
        )}
      </div>
    </div>
  );
}

export const kpiColStyle = { display: "flex" } as const;
