"use client";

import { Alert, theme } from "antd";
import { ExclamationCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { useLocale } from "@/components/providers/LocaleProvider";
import { reportingBasisLabel } from "@/lib/i18n/helpers";
import { formatRsd, formatPercent } from "@/lib/utils/format";

const { useToken } = theme;

type ThresholdState = "neutral" | "warning" | "high_warning" | "exceeded";

interface Props {
  thresholdState: ThresholdState;
  percentUsed: number;
  actualTotal: string;
  threshold: string;
  crossingMonth?: string | null;
  projectedThresholdState?: ThresholdState;
  projectedPercentUsed?: number;
  projectedTotal?: string;
  basis: "ISSUE_DATE" | "PAYMENT_DATE";
  year: number;
  excludedCount?: number;
}

function formatCrossingMonth(
  yearMonth: string,
  t: (key: string) => string
): string {
  const [y, m] = yearMonth.split("-");
  const monthIndex = String(parseInt(m, 10) - 1);
  const month = t(`annualPlan.monthLong.${monthIndex}`);
  return `${month} ${y}`;
}

export function hasThresholdAlerts({
  thresholdState,
  crossingMonth,
  projectedThresholdState,
  basis,
  excludedCount = 0,
}: Pick<
  Props,
  "thresholdState" | "crossingMonth" | "projectedThresholdState" | "basis" | "excludedCount"
>): boolean {
  if (thresholdState !== "neutral") return true;
  if (
    crossingMonth &&
    projectedThresholdState &&
    projectedThresholdState !== "neutral"
  ) {
    return true;
  }
  return basis === "PAYMENT_DATE" && excludedCount > 0;
}

export function ThresholdWarningBanner({
  thresholdState,
  percentUsed,
  actualTotal,
  threshold,
  crossingMonth,
  projectedThresholdState,
  projectedPercentUsed,
  projectedTotal,
  basis,
  year,
  excludedCount = 0,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const basisLabel = reportingBasisLabel(t, basis);

  const alerts = [];

  if (thresholdState === "exceeded") {
    alerts.push(
      <Alert
        key="exceeded"
        type="error"
        showIcon
        icon={<ExclamationCircleOutlined />}
        title={t("domain.thresholdExceededTitle", { year: String(year), basis: basisLabel })}
        description={t("domain.thresholdExceededBody", {
          actual: formatRsd(actualTotal),
          threshold: formatRsd(threshold),
          percent: formatPercent(percentUsed, 1),
        })}
      />
    );
  } else if (thresholdState === "high_warning") {
    alerts.push(
      <Alert
        key="high_warning"
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title={t("domain.thresholdHighTitle", { percent: formatPercent(percentUsed, 1) })}
        description={t("domain.thresholdHighBody", {
          actual: formatRsd(actualTotal),
          threshold: formatRsd(threshold),
          basis: basisLabel,
          year: String(year),
        })}
      />
    );
  } else if (thresholdState === "warning") {
    alerts.push(
      <Alert
        key="warning"
        type="warning"
        showIcon
        title={t("domain.thresholdWarnTitle", { percent: formatPercent(percentUsed, 1) })}
        description={t("domain.thresholdWarnBody", {
          actual: formatRsd(actualTotal),
          threshold: formatRsd(threshold),
          basis: basisLabel,
          year: String(year),
        })}
      />
    );
  }

  if (
    crossingMonth &&
    projectedThresholdState &&
    projectedThresholdState !== "neutral" &&
    thresholdState !== "exceeded"
  ) {
    alerts.push(
      <Alert
        key="projected"
        type={projectedThresholdState === "exceeded" ? "error" : "warning"}
        showIcon
        title={t("domain.thresholdProjectedTitle", {
          month: formatCrossingMonth(crossingMonth, t),
        })}
        description={
          projectedTotal
            ? t("domain.thresholdProjectedBody", {
                total: formatRsd(projectedTotal),
                percent: formatPercent(projectedPercentUsed ?? 0, 1),
                threshold: formatRsd(threshold),
              })
            : undefined
        }
      />
    );
  }

  if (basis === "PAYMENT_DATE" && excludedCount > 0) {
    alerts.push(
      <Alert
        key="excluded"
        type="info"
        title={t("domain.thresholdExcludedTitle", {
          count: String(excludedCount),
          plural: excludedCount > 1 ? "s" : "",
          year: String(year),
        })}
        style={{ marginTop: alerts.length > 0 ? token.marginXS : 0 }}
      />
    );
  }

  if (alerts.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: token.marginXS }}>
      {alerts}
    </div>
  );
}
