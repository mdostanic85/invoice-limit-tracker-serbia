"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { theme, Typography } from "antd";
import { formatRsd } from "@/lib/utils/format";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";
import type { Translator } from "@/lib/i18n/types";

const { Text } = Typography;
const { useToken } = theme;

const chartCursor = (token: ReturnType<typeof useToken>["token"]) => ({
  fill: token.colorPrimaryBg ?? token.colorFillTertiary,
  opacity: 0.45,
  radius: 4,
});

function TooltipShell({
  title,
  value,
  hint,
  token,
}: {
  title: string;
  value: string;
  hint: string;
  token: ReturnType<typeof useToken>["token"];
}) {
  return (
    <div
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: `${token.paddingSM}px ${token.paddingMD}px`,
        maxWidth: 280,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <Text strong style={{ display: "block", color: token.colorText, marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ display: "block", color: token.colorPrimary, fontWeight: 600, marginBottom: 6 }}>
        {value}
      </Text>
      <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.45 }}>
        {hint}
      </Text>
    </div>
  );
}

function MonthlyTooltip({
  active,
  payload,
  t,
  token,
  currentMonth,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: MonthlyChartPoint }>;
  t: Translator;
  token: ReturnType<typeof useToken>["token"];
  currentMonth: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as MonthlyChartPoint;
  const amount = formatRsd(String(payload[0].value ?? 0));
  const isCurrent = point.month === currentMonth;

  return (
    <TooltipShell
      token={token}
      title={t("charts.monthlyTitle")}
      value={t("charts.monthlyValue", { amount })}
      hint={
        isCurrent
          ? `${t("charts.monthlyCurrent")} ${t("charts.monthlyHint")}`
          : t("charts.monthlyHint")
      }
    />
  );
}

function ClientTooltip({
  active,
  payload,
  t,
  token,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload?: { fullName: string; totalRsd: number } }>;
  t: Translator;
  token: ReturnType<typeof useToken>["token"];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as { fullName: string; totalRsd: number };
  const amount = formatRsd(String(payload[0].value ?? 0));

  return (
    <TooltipShell
      token={token}
      title={row.fullName}
      value={t("charts.clientValue", { amount })}
      hint={t("charts.clientHint")}
    />
  );
}

function CumulativeTooltip({
  active,
  payload,
  label,
  t,
  token,
  threshold,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: string | number;
  t: Translator;
  token: ReturnType<typeof useToken>["token"];
  threshold: number;
}) {
  if (!active || !payload?.length) return null;
  const amount = formatRsd(String(payload[0].value ?? 0));

  return (
    <TooltipShell
      token={token}
      title={t("charts.cumulativeTitle")}
      value={t("charts.cumulativeValue", { amount, month: String(label ?? "") })}
      hint={`${t("charts.cumulativeHint")} ${t("charts.cumulativeLimit", { amount: formatRsd(String(threshold)) })}`}
    />
  );
}

export interface MonthlyChartPoint {
  month: string;
  label: string;
  actual: number;
}

interface MonthlyRevenueChartProps {
  data: MonthlyChartPoint[];
  year: number;
}

export function MonthlyRevenueChart({ data, year }: MonthlyRevenueChartProps) {
  const { token } = useToken();
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const currentMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke={token.colorBorderSecondary}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: token.colorTextSecondary, fontSize: 11 }}
          axisLine={{ stroke: token.colorBorderSecondary }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fill: token.colorTextSecondary, fontSize: isMobile ? 10 : 11 }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 36 : 44}
        />
        <Tooltip
          cursor={chartCursor(token)}
          content={({ active, payload }) => (
            <MonthlyTooltip
              active={active}
              payload={payload}
              t={t}
              token={token}
              currentMonth={currentMonth}
            />
          )}
        />
        <Bar
          dataKey="actual"
          name={t("charts.revenue")}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
          activeBar={{ fill: token.colorPrimary, opacity: 1 }}
        >
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={
                entry.month === currentMonth
                  ? token.colorPrimary
                  : token.colorFillSecondary
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface ClientChartPoint {
  clientId: string;
  displayName: string;
  totalRsd: number;
}

export function ClientRevenueChart({ data }: { data: ClientChartPoint[] }) {
  const { token } = useToken();
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const chartData = data.map((c) => ({
    name: c.displayName.length > (isMobile ? 12 : 18)
      ? `${c.displayName.slice(0, isMobile ? 10 : 16)}…`
      : c.displayName,
    totalRsd: c.totalRsd,
    fullName: c.displayName,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(isMobile ? 160 : 200, chartData.length * (isMobile ? 32 : 36))}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={false}
          stroke={token.colorBorderSecondary}
        />
        <XAxis
          type="number"
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fill: token.colorTextSecondary, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={isMobile ? 72 : 100}
          tick={{ fill: token.colorText, fontSize: isMobile ? 11 : 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={chartCursor(token)}
          content={({ active, payload }) => (
            <ClientTooltip active={active} payload={payload} t={t} token={token} />
          )}
        />
        <Bar
          dataKey="totalRsd"
          name={t("charts.revenue")}
          fill={token.colorPrimary}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          activeBar={{ fill: token.colorPrimaryActive ?? token.colorPrimary, opacity: 1 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface CumulativeChartPoint {
  month: string;
  label: string;
  cumulative: number;
}

interface CumulativeRevenueChartProps {
  data: CumulativeChartPoint[];
  threshold: number;
}

export function CumulativeRevenueChart({ data, threshold }: CumulativeRevenueChartProps) {
  const { token } = useToken();
  const { t } = useLocale();
  const isMobile = useIsMobile();

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
      <LineChart data={data} margin={{ top: 12, right: isMobile ? 4 : 12, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={token.colorBorderSecondary}
        />
        <XAxis
          dataKey="label"
          tick={{ fill: token.colorTextSecondary, fontSize: 11 }}
          axisLine={{ stroke: token.colorBorderSecondary }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fill: token.colorTextSecondary, fontSize: isMobile ? 10 : 11 }}
          axisLine={false}
          tickLine={false}
          width={isMobile ? 40 : 48}
        />
        <Tooltip
          cursor={{ stroke: token.colorPrimaryBg ?? token.colorFillTertiary, strokeWidth: 1, strokeDasharray: "4 4" }}
          content={({ active, payload, label }) => (
            <CumulativeTooltip
              active={active}
              payload={payload}
              label={label}
              t={t}
              token={token}
              threshold={threshold}
            />
          )}
        />
        <ReferenceLine
          y={threshold}
          stroke={token.colorError}
          strokeDasharray="6 4"
          label={{
            value: formatRsd(String(threshold)),
            position: "insideTopRight",
            fill: token.colorError,
            fontSize: 11,
          }}
        />
        <Line
          type="monotone"
          dataKey="cumulative"
          name={t("charts.cumulative")}
          stroke={token.colorPrimary}
          strokeWidth={2}
          dot={{ r: 3, fill: token.colorPrimary, stroke: token.colorBgContainer, strokeWidth: 2 }}
          activeDot={{
            r: 6,
            fill: token.colorPrimary,
            stroke: token.colorBgContainer,
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
