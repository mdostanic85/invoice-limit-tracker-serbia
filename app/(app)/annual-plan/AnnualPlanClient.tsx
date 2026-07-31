"use client";

import {
  Card,
  Statistic,
  Typography,
  Space,
  Tag,
  Alert,
  Divider,
  theme,
  Segmented,
} from "antd";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { PageContent } from "@/components/layout/PageContent";
import {
  ListTableInlineFilter,
  PageFilterPanel,
} from "@/components/layout/ListDataTable";
import { CumulativeRevenueChart } from "@/components/charts/DashboardCharts";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useFormat } from "@/lib/i18n/use-format";
import {
  forecastScenarioLabel,
  reportingBasisLabel,
} from "@/lib/i18n/helpers";

const { Text } = Typography;
const { useToken } = theme;

const SCENARIO_VALUES = ["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"] as const;

interface Props {
  year: number;
  selectedScenario: string;
  threshold: string;
  basis: "ISSUE_DATE" | "PAYMENT_DATE";
  projections: Record<string, { projectedTotal: string; crossingMonth: string | null; forecastContribution: string }>;
  cumulativeData: Array<{ month: string; actual: number; cumulative: number }>;
}

const SCENARIO_COLORS: Record<string, string> = {
  CONSERVATIVE: "blue",
  EXPECTED: "green",
  OPTIMISTIC: "purple",
};

function formatCrossingMonth(
  yearMonth: string,
  t: (key: string) => string
): { month: string; year: string } {
  const [y, m] = yearMonth.split("-");
  const monthIndex = String(parseInt(m, 10) - 1);
  return {
    month: t(`annualPlan.monthLong.${monthIndex}`),
    year: y,
  };
}

export function AnnualPlanClient({
  year,
  selectedScenario,
  threshold,
  basis,
  projections,
  cumulativeData,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const { formatRsd, formatPercent } = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    router.push(`${pathname}?${params.toString()}`);
  }

  const thresholdValue = parseFloat(threshold);
  const basisLabel = reportingBasisLabel(t, basis);
  const proj = projections[selectedScenario];

  const remaining = Math.max(thresholdValue - parseFloat(proj.projectedTotal), 0);
  const percentUsed = thresholdValue > 0 ? (parseFloat(proj.projectedTotal) / thresholdValue) * 100 : 0;

  const crossingMonthParts = proj.crossingMonth
    ? formatCrossingMonth(proj.crossingMonth, t)
    : null;

  return (
    <PageContent title={t("annualPlan.title")}>
    <BentoGrid>
      <BentoCell span={12}>
        <PageFilterPanel
          meta={
            <Text type="secondary" style={{ fontSize: token.fontSizeLG }}>
              {t("annualPlan.basisMeta", { basis: basisLabel })}
            </Text>
          }
        >
          <ListTableInlineFilter label={t("annualPlan.scenario")}>
            <Segmented
              value={selectedScenario}
              options={SCENARIO_VALUES.map((value) => ({
                value,
                label: forecastScenarioLabel(t, value),
              }))}
              onChange={(v) => updateParams({ scenario: v as string })}
              aria-label={t("dashboard.forecastScenario")}
            />
          </ListTableInlineFilter>
        </PageFilterPanel>
      </BentoCell>

      {crossingMonthParts && (
        <BentoCell span={12}>
        <Alert
          type={parseFloat(proj.projectedTotal) > thresholdValue ? "error" : "warning"}
          showIcon
          title={t("annualPlan.crossingAlert", {
            month: crossingMonthParts.month,
            year: crossingMonthParts.year,
          })}
          description={t("annualPlan.crossingDescription", {
            scenario: forecastScenarioLabel(t, selectedScenario),
            total: formatRsd(proj.projectedTotal),
            percent: formatPercent(percentUsed, 1),
            limit: formatRsd(threshold),
          })}
        />
        </BentoCell>
      )}

      {Object.entries(projections).map(([scenario, data]) => {
          const pct = thresholdValue > 0 ? (parseFloat(data.projectedTotal) / thresholdValue) * 100 : 0;
          const rem = Math.max(thresholdValue - parseFloat(data.projectedTotal), 0);
          const exceeds = parseFloat(data.projectedTotal) > thresholdValue;
          const isSelected = scenario === selectedScenario;
          return (
            <BentoCell key={scenario} lg={4}>
              <Card
                className={`widget-card widget-card--interactive${isSelected ? " widget-card--hovered" : hoveredScenario === scenario ? " widget-card--hovered" : ""}`}
                style={{
                  border: isSelected ? `2px solid ${token.colorPrimary}` : undefined,
                  cursor: "pointer",
                }}
                onClick={() => updateParams({ scenario })}
                onMouseEnter={() => setHoveredScenario(scenario)}
                onMouseLeave={() => setHoveredScenario(null)}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <Tag color={SCENARIO_COLORS[scenario]}>
                      {forecastScenarioLabel(t, scenario)}
                    </Tag>
                    {isSelected && <Tag color="blue">{t("annualPlan.active")}</Tag>}
                  </div>
                  <Statistic
                    title={t("annualPlan.projectedTotal")}
                    value={formatRsd(data.projectedTotal)}
                    styles={{
                      title: { fontSize: token.fontSizeLG },
                      content: {
                        fontSize: "1.25rem",
                        color: exceeds ? token.colorError : token.colorText,
                      },
                    }}
                  />
                  <Statistic
                    title={t("annualPlan.forecastContribution")}
                    value={formatRsd(data.forecastContribution)}
                    styles={{
                      title: { fontSize: token.fontSizeLG },
                      content: { fontSize: "1.25rem" },
                    }}
                  />
                  <div>
                    <Text type="secondary" style={{ fontSize: token.fontSizeLG }}>
                      {rem > 0
                        ? t("annualPlan.percentUsed", {
                            percent: formatPercent(pct, 1),
                            remaining: formatRsd(rem),
                          })
                        : t("annualPlan.overBy", {
                            amount: formatRsd(Math.abs(rem)),
                          })}
                    </Text>
                  </div>
                  {data.crossingMonth && (
                    <Text style={{ fontSize: token.fontSizeLG, color: token.colorWarning }}>
                      {t("annualPlan.crossing")}{" "}
                      {data.crossingMonth.split("-").reverse().slice(0, 2).join("/")}
                    </Text>
                  )}
                </Space>
              </Card>
            </BentoCell>
          );
        })}

      <BentoCell span={12}>
      <Card
        className="widget-card"
        title={
          <Text style={{ fontSize: token.fontSizeLG }}>
            {t("annualPlan.chartTitle", { year: String(year), basis: basisLabel })}
          </Text>
        }
      >
        <CumulativeRevenueChart
          data={cumulativeData.map((d, idx) => ({
            month: d.month,
            label: t(`annualPlan.monthShort.${idx}`),
            cumulative: d.cumulative,
          }))}
          threshold={thresholdValue}
        />
      </Card>
      </BentoCell>

      <BentoCell span={12}>
      <Card title={t("annualPlan.safeBillingCapacity")}>
        <BentoGrid>
          <BentoCell lg={4}>
            <Statistic
              title={t("annualPlan.remainingActual")}
              value={formatRsd(Math.max(thresholdValue - (thresholdValue - parseFloat(projections.EXPECTED.projectedTotal) - parseFloat(projections.EXPECTED.forecastContribution)), 0))}
              styles={{
                title: { fontSize: token.fontSizeLG },
                content: { fontSize: "1.25rem" },
              }}
            />
          </BentoCell>
          <BentoCell lg={4}>
            <Statistic
              title={t("annualPlan.remainingProjected", {
                scenario: forecastScenarioLabel(t, selectedScenario),
              })}
              value={formatRsd(remaining)}
              styles={{
                title: { fontSize: token.fontSizeLG },
                content: {
                  fontSize: "1.25rem",
                  color: remaining === 0 ? token.colorError : token.colorSuccess,
                },
              }}
            />
          </BentoCell>
          <BentoCell lg={4}>
            <Statistic
              title={t("annualPlan.annualThreshold")}
              value={formatRsd(threshold)}
              styles={{
                title: { fontSize: token.fontSizeLG },
                content: { fontSize: "1.25rem" },
              }}
            />
          </BentoCell>
        </BentoGrid>
        <Divider style={{ margin: `${token.marginSM}px 0` }} />
        <Text type="secondary" style={{ fontSize: token.fontSizeLG }}>
          {t("annualPlan.footer")}{" "}
          {t("annualPlan.footerBasis", { basis: basisLabel, year: String(year) })}
        </Text>
      </Card>
      </BentoCell>
    </BentoGrid>
    </PageContent>
  );
}
