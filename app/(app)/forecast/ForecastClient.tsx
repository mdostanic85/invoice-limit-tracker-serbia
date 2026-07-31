"use client";

import {
  Alert,
  Card,
  Flex,
  InputNumber,
  Progress,
  Select,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
import { PageContent } from "@/components/layout/PageContent";
import { PageStack } from "@/components/layout/PageStack";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";
import { ListDataTable } from "@/components/layout/ListDataTable";
import { ForecastSnapshotsPanel } from "@/components/domain/ForecastSnapshotsPanel";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useFormat } from "@/lib/i18n/use-format";
import { forecastScenarioLabel, reportingBasisLabel } from "@/lib/i18n/helpers";
import { upsertMonthlyForecastAction } from "@/app/actions/forecast-actions";
import {
  FORECAST_SCENARIOS,
  type ForecastScenario,
} from "@/lib/constants/forecast";
import {
  FORECAST_CURRENCIES,
  currencySelectOptions,
} from "@/lib/constants/currencies";
import { amountCellStyle } from "@/lib/theme/styles";
import {
  getThresholdProgressStatus,
  getThresholdStrokeColor,
  type ThresholdState,
} from "@/lib/theme/threshold-progress";
import type { ForecastSnapshotSummary } from "@/lib/domain/forecast-snapshot";
import Decimal from "decimal.js";

const { Text } = Typography;
const { useToken } = theme;

const SCENARIO_COLORS: Record<ForecastScenario, string> = {
  CONSERVATIVE: "blue",
  EXPECTED: "green",
  OPTIMISTIC: "purple",
};

interface MonthlyActual {
  month: string;
  label: string;
  actual: number;
}

interface MonthlyDraft {
  month: string;
  label: string;
  draft: number;
}

interface MonthlyPlanCell {
  originalAmount: string;
  currency: string;
  amountRsd: string;
  entryId: string | null;
  source: "manual" | "stilt" | null;
  billableDays: number | null;
}

interface StiltAutoInfo {
  clientName: string;
  hourlyRate: string;
  currency: string;
}

interface ExchangeRateInfo {
  ratePerUnit: string;
  effectiveDate: string;
  label: string;
}

interface ScenarioProjection {
  projectedTotal: string;
  projectedRemaining: string;
  projectedPercent?: number;
  projectedPercentUsed: number;
  projectedThresholdState: string;
  forecastContribution: string;
  crossingMonth: string | null;
}

interface DraftCell {
  originalAmount: string;
  currency: string;
}

export interface ForecastPageData {
  year: number;
  threshold: string;
  basis: "ISSUE_DATE" | "PAYMENT_DATE";
  limitStatus: {
    actualTotal: string;
    remaining: string;
    percentUsed: number;
    thresholdState: string;
    excludedCount: number;
  };
  monthlyActuals: MonthlyActual[];
  monthlyDrafts: MonthlyDraft[];
  monthlyPlan: Record<ForecastScenario, Record<string, MonthlyPlanCell>>;
  exchangeRates: Record<string, ExchangeRateInfo>;
  projections: Record<ForecastScenario, ScenarioProjection>;
  snapshots: ForecastSnapshotSummary[];
  editableFromMonth: number;
  stiltAuto: StiltAutoInfo | null;
}

interface Props {
  data: ForecastPageData;
}

interface MonthRow {
  key: string;
  monthIndex: number;
  monthLabel: string;
  actual: number;
  expectedDraft: number;
  isEditable: boolean;
  plans: Record<ForecastScenario, MonthlyPlanCell>;
}

function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function convertToRsd(
  originalAmount: string,
  currency: string,
  exchangeRates: Record<string, ExchangeRateInfo>
): number {
  const amount = parseAmount(originalAmount);
  if (amount <= 0) return 0;
  if (currency === "RSD") return amount;

  const rate = exchangeRates[currency]?.ratePerUnit;
  if (!rate || parseFloat(rate) <= 0) return 0;

  return new Decimal(amount).times(rate).toNumber();
}

function computeLiveProjection(
  actualTotal: string,
  threshold: string,
  monthlyPlan: Record<ForecastScenario, Record<string, MonthlyPlanCell>>,
  serverProjections: Record<ForecastScenario, ScenarioProjection>,
  draftPlans: Record<ForecastScenario, Record<string, DraftCell>>,
  editableMonthKeys: string[],
  exchangeRates: Record<string, ExchangeRateInfo>
) {
  const actual = new Decimal(actualTotal);
  const limit = new Decimal(threshold);

  return FORECAST_SCENARIOS.reduce(
    (acc, scenario) => {
      const serverPlanSum = editableMonthKeys.reduce(
        (sum, monthKey) =>
          sum.plus(
            new Decimal(parseAmount(monthlyPlan[scenario][monthKey]?.amountRsd))
          ),
        new Decimal(0)
      );

      const draftPlanSum = editableMonthKeys.reduce((sum, monthKey) => {
        const draft = draftPlans[scenario]?.[monthKey];
        if (draft) {
          return sum.plus(
            new Decimal(convertToRsd(draft.originalAmount, draft.currency, exchangeRates))
          );
        }
        return sum.plus(
          new Decimal(parseAmount(monthlyPlan[scenario][monthKey]?.amountRsd))
        );
      }, new Decimal(0));

      const serverForecast = new Decimal(
        serverProjections[scenario].forecastContribution
      );
      const forecastSum = serverForecast.minus(serverPlanSum).plus(draftPlanSum);

      const projectedTotal = actual.plus(forecastSum);
      const projectedRemaining = Decimal.max(limit.minus(projectedTotal), 0);
      const projectedPercentUsed = limit.isZero()
        ? 0
        : projectedTotal.div(limit).times(100).toNumber();

      let projectedThresholdState: ScenarioProjection["projectedThresholdState"] =
        "neutral";
      if (projectedPercentUsed >= 100) projectedThresholdState = "exceeded";
      else if (projectedPercentUsed >= 90) projectedThresholdState = "high_warning";
      else if (projectedPercentUsed >= 80) projectedThresholdState = "warning";

      acc[scenario] = {
        projectedTotal: projectedTotal.toFixed(4),
        projectedRemaining: projectedRemaining.toFixed(4),
        projectedPercentUsed,
        projectedThresholdState,
        forecastContribution: forecastSum.toFixed(4),
        crossingMonth: serverProjections[scenario].crossingMonth,
        overBy: projectedTotal.gt(limit)
          ? projectedTotal.minus(limit).toFixed(4)
          : null,
      };
      return acc;
    },
    {} as Record<
      ForecastScenario,
      ScenarioProjection & { overBy: string | null }
    >
  );
}

function formatAmountInput(value: number | string | undefined): string {
  if (value === undefined || value === null || value === "") return "";
  return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseAmountInput(value: string | undefined): number {
  return Number((value ?? "").replace(/\s/g, ""));
}

export function ForecastClient({ data }: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const { formatRsd, formatPercent } = useFormat();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftPlans, setDraftPlans] = useState<
    Record<ForecastScenario, Record<string, DraftCell>>
  >({
    CONSERVATIVE: {},
    EXPECTED: {},
    OPTIMISTIC: {},
  });
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const currencyOptions = useMemo(
    () => currencySelectOptions(FORECAST_CURRENCIES),
    []
  );

  const basisLabel = reportingBasisLabel(t, data.basis);
  const thresholdValue = parseAmount(data.threshold);
  const actualTotalValue = parseAmount(data.limitStatus.actualTotal);

  const monthRows: MonthRow[] = useMemo(
    () =>
      data.monthlyActuals.map((month, index) => ({
        key: month.month,
        monthIndex: index + 1,
        monthLabel: t(`annualPlan.monthLong.${String(index)}`),
        actual: month.actual,
        expectedDraft:
          data.monthlyDrafts.find((draft) => draft.month === month.month)
            ?.draft ?? 0,
        isEditable: index + 1 >= data.editableFromMonth,
        plans: {
          CONSERVATIVE: data.monthlyPlan.CONSERVATIVE[month.month] ?? {
            originalAmount: "0",
            currency: "RSD",
            amountRsd: "0",
            entryId: null,
            source: null,
            billableDays: null,
          },
          EXPECTED: data.monthlyPlan.EXPECTED[month.month] ?? {
            originalAmount: "0",
            currency: "RSD",
            amountRsd: "0",
            entryId: null,
            source: null,
            billableDays: null,
          },
          OPTIMISTIC: data.monthlyPlan.OPTIMISTIC[month.month] ?? {
            originalAmount: "0",
            currency: "RSD",
            amountRsd: "0",
            entryId: null,
            source: null,
            billableDays: null,
          },
        },
      })),
    [
      data.monthlyActuals,
      data.monthlyDrafts,
      data.monthlyPlan,
      data.editableFromMonth,
      t,
    ]
  );

  const editableMonthKeys = useMemo(
    () => monthRows.filter((row) => row.isEditable).map((row) => row.key),
    [monthRows]
  );

  const monthLabels = useMemo(
    () => monthRows.map((row) => row.monthLabel),
    [monthRows]
  );

  const monthKeys = useMemo(() => monthRows.map((row) => row.key), [monthRows]);

  const liveProjections = useMemo(
    () =>
      computeLiveProjection(
        data.limitStatus.actualTotal,
        data.threshold,
        data.monthlyPlan,
        data.projections,
        draftPlans,
        editableMonthKeys,
        data.exchangeRates
      ),
    [
      data.limitStatus.actualTotal,
      data.threshold,
      data.monthlyPlan,
      data.projections,
      data.exchangeRates,
      draftPlans,
      editableMonthKeys,
    ]
  );

  function getCellDraft(
    scenario: ForecastScenario,
    monthKey: string,
    drafts = draftPlans
  ): DraftCell {
    const draft = drafts[scenario][monthKey];
    if (draft) return draft;

    const saved = data.monthlyPlan[scenario][monthKey];
    return {
      originalAmount: saved?.originalAmount ?? "0",
      currency: saved?.currency ?? "RSD",
    };
  }

  function getCellRsd(
    scenario: ForecastScenario,
    monthKey: string,
    cell?: DraftCell
  ): number {
    const value = cell ?? getCellDraft(scenario, monthKey);
    return convertToRsd(value.originalAmount, value.currency, data.exchangeRates);
  }

  function updateDraft(
    scenario: ForecastScenario,
    monthKey: string,
    patch: Partial<DraftCell>
  ) {
    setDraftPlans((prev) => {
      const saved = data.monthlyPlan[scenario][monthKey];
      const current: DraftCell = prev[scenario][monthKey] ?? {
        originalAmount: saved?.originalAmount ?? "0",
        currency: saved?.currency ?? "RSD",
      };
      return {
        ...prev,
        [scenario]: {
          ...prev[scenario],
          [monthKey]: { ...current, ...patch },
        },
      };
    });
  }

  function saveCell(
    scenario: ForecastScenario,
    monthKey: string,
    monthIndex: number,
    cell: DraftCell
  ) {
    const cellKey = `${scenario}-${monthKey}`;
    setSavingCell(cellKey);

    startTransition(async () => {
      await upsertMonthlyForecastAction({
        year: data.year,
        month: monthIndex,
        scenario,
        originalAmount: cell.originalAmount || "0",
        currency: cell.currency || "RSD",
      });
      setSavingCell(null);
      setDraftPlans((prev) => {
        const next = { ...prev, [scenario]: { ...prev[scenario] } };
        delete next[scenario][monthKey];
        return next;
      });
      router.refresh();
    });
  }

  function handlePlanSave(
    scenario: ForecastScenario,
    monthKey: string,
    monthIndex: number
  ) {
    saveCell(scenario, monthKey, monthIndex, getCellDraft(scenario, monthKey));
  }

  function renderPlanCell(scenario: ForecastScenario, row: MonthRow) {
    const expectedDraft = scenario === "EXPECTED" ? row.expectedDraft : 0;

    if (!row.isEditable) {
      if (expectedDraft > 0) {
        return (
          <Text type="secondary" style={{ fontSize: token.fontSizeLG }}>
            {t("forecast.draftInvoiceOnly", {
              amount: formatRsd(expectedDraft),
            })}
          </Text>
        );
      }
      return (
        <Text type="secondary" style={{ fontSize: token.fontSizeLG }}>
          {t("common.dash")}
        </Text>
      );
    }

    const cellKey = `${scenario}-${row.key}`;
    const cell = getCellDraft(scenario, row.key);
    const saved = data.monthlyPlan[scenario][row.key];
    const amountValue = parseAmount(cell.originalAmount);
    const rsdValue = getCellRsd(scenario, row.key, cell);
    const rateInfo =
      cell.currency !== "RSD" ? data.exchangeRates[cell.currency] : null;
    const isStiltAuto = saved?.source === "stilt" && scenario === "EXPECTED";

    return (
      <Flex vertical gap={4} style={{ minWidth: 190 }}>
        {isStiltAuto && saved.billableDays ? (
          <Tag color="processing" style={{ marginInlineEnd: 0, width: "fit-content" }}>
            {t("forecast.stiltAutoTag", { days: String(saved.billableDays) })}
          </Tag>
        ) : null}
        <Flex gap={4}>
          <InputNumber
            value={amountValue || undefined}
            min={0}
            step={cell.currency === "RSD" ? 1000 : 100}
            controls={false}
            placeholder="0"
            disabled={isPending && savingCell === cellKey}
            style={{ flex: 1, minWidth: 0 }}
            formatter={formatAmountInput}
            parser={parseAmountInput}
            onChange={(next) =>
              updateDraft(scenario, row.key, {
                originalAmount: next && next > 0 ? String(next) : "",
              })
            }
            onBlur={() => handlePlanSave(scenario, row.key, row.monthIndex)}
            onPressEnter={() => handlePlanSave(scenario, row.key, row.monthIndex)}
          />
          <Select
            value={cell.currency}
            options={currencyOptions}
            disabled={isPending && savingCell === cellKey}
            style={{ width: 78 }}
            popupMatchSelectWidth={false}
            onChange={(currency) => {
              const nextCell = { ...cell, currency };
              updateDraft(scenario, row.key, { currency });
              saveCell(scenario, row.key, row.monthIndex, nextCell);
            }}
          />
        </Flex>
        {amountValue > 0 && (
          <Text type="secondary" style={{ fontSize: token.fontSizeLG, lineHeight: 1.4 }}>
            {cell.currency === "RSD"
              ? formatRsd(rsdValue)
              : t("forecast.convertedRsd", {
                  amount: formatRsd(rsdValue),
                  rate: rateInfo?.ratePerUnit ?? t("common.dash"),
                  currency: cell.currency,
                  date: rateInfo?.effectiveDate ?? t("common.dash"),
                })}
          </Text>
        )}
        {expectedDraft > 0 && (
          <Text type="success" style={{ fontSize: token.fontSizeLG, lineHeight: 1.4 }}>
            {t("forecast.draftInvoiceIncluded", {
              draft: formatRsd(expectedDraft),
              total: formatRsd(rsdValue + expectedDraft),
            })}
          </Text>
        )}
      </Flex>
    );
  }

  const planColumns: ColumnsType<MonthRow> = FORECAST_SCENARIOS.map((scenario) => ({
    title: (
      <Tag color={SCENARIO_COLORS[scenario]} style={{ marginInlineEnd: 0 }}>
        {forecastScenarioLabel(t, scenario)}
      </Tag>
    ),
    key: scenario,
    width: 210,
    render: (_: unknown, row: MonthRow) => renderPlanCell(scenario, row),
  }));

  const monthTableColumns: ColumnsType<MonthRow> = [
    {
      title: t("forecast.columnMonth"),
      key: "month",
      width: 130,
      fixed: "left",
      render: (_: unknown, row: MonthRow) => (
        <Text strong={row.isEditable}>{row.monthLabel}</Text>
      ),
    },
    {
      title: t("forecast.columnInvoiced"),
      key: "actual",
      width: 140,
      align: "right",
      render: (_: unknown, row: MonthRow) =>
        row.actual > 0 ? (
          <span className="amount-cell" style={amountCellStyle}>
            {formatRsd(row.actual)}
          </span>
        ) : (
          <Text type="secondary">{t("common.dash")}</Text>
        ),
    },
    ...planColumns,
  ];

  const anyExceeded = FORECAST_SCENARIOS.some(
    (scenario) => liveProjections[scenario].projectedThresholdState === "exceeded"
  );

  return (
    <PageContent title={t("forecast.title")}>
      <PageStack>
        <Alert
          type="info"
          showIcon
          title={t("forecast.planningHint")}
          description={t("forecast.basisMeta", { basis: basisLabel })}
        />

        {data.stiltAuto && (
          <Alert
            type="info"
            showIcon
            title={t("forecast.stiltAutoHint", {
              client: data.stiltAuto.clientName,
              rate: data.stiltAuto.hourlyRate,
              currency: data.stiltAuto.currency,
            })}
          />
        )}

        {anyExceeded && (
          <Alert type="error" showIcon title={t("forecast.limitExceededAlert")} />
        )}

        <ForecastSnapshotsPanel
          year={data.year}
          monthKeys={monthKeys}
          monthLabels={monthLabels}
          monthlyPlan={data.monthlyPlan}
          draftPlans={draftPlans}
          snapshots={data.snapshots}
        />

        <BentoGrid>
          {FORECAST_SCENARIOS.map((scenario) => {
            const projection = liveProjections[scenario];
            const exceeds = parseAmount(projection.projectedTotal) > thresholdValue;
            const remaining = parseAmount(projection.projectedRemaining);
            const clampedPercent = Math.min(projection.projectedPercentUsed, 100);
            const thresholdState = projection.projectedThresholdState as ThresholdState;
            const progressColor = getThresholdStrokeColor(thresholdState, token);

            return (
              <BentoCell key={scenario} lg={4} sm={12}>
                <Card size="small" style={{ height: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: token.marginSM,
                    }}
                  >
                    <Tag color={SCENARIO_COLORS[scenario]}>
                      {forecastScenarioLabel(t, scenario)}
                    </Tag>
                    {exceeds ? (
                      <Tag color="error">{t("forecast.overLimit")}</Tag>
                    ) : (
                      <Tag color="success">{t("forecast.withinLimit")}</Tag>
                    )}
                  </div>

                  <Progress
                    percent={clampedPercent}
                    strokeColor={progressColor}
                    status={getThresholdProgressStatus(thresholdState)}
                    format={() => (
                      <Text
                        style={{
                          color: progressColor,
                          fontWeight: 600,
                          fontSize: token.fontSizeLG,
                        }}
                      >
                        {formatPercent(projection.projectedPercentUsed, 1)}
                      </Text>
                    )}
                    size="small"
                  />

                  <div
                    className="forecast-scenario-stats"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: token.marginSM,
                      marginTop: token.marginMD,
                    }}
                  >
                    <Statistic
                      title={t("forecast.invoicedYtd")}
                      value={formatRsd(actualTotalValue)}
                      styles={{
                        title: { fontSize: token.fontSizeLG },
                        content: { fontSize: "1.25rem" },
                      }}
                    />
                    <Statistic
                      title={t("forecast.plannedRemaining")}
                      value={formatRsd(projection.forecastContribution)}
                      styles={{
                        title: { fontSize: token.fontSizeLG },
                        content: { fontSize: "1.25rem" },
                      }}
                    />
                    <Statistic
                      title={t("forecast.projectedTotal")}
                      value={formatRsd(projection.projectedTotal)}
                      styles={{
                        title: { fontSize: token.fontSizeLG },
                        content: {
                          fontSize: "1.25rem",
                          color: exceeds ? token.colorError : token.colorText,
                        },
                      }}
                    />
                    <Statistic
                      title={exceeds ? t("forecast.overBy") : t("domain.remaining")}
                      value={
                        exceeds
                          ? formatRsd(projection.overBy ?? "0")
                          : formatRsd(remaining)
                      }
                      styles={{
                        title: { fontSize: token.fontSizeLG },
                        content: {
                          fontSize: "1.25rem",
                          color: exceeds ? token.colorError : token.colorSuccess,
                        },
                      }}
                    />
                  </div>
                </Card>
              </BentoCell>
            );
          })}
        </BentoGrid>

        <ListDataTable
          context={
            <Text strong style={{ fontSize: token.fontSizeLG }}>
              {t("forecast.monthlyPlanTitle")}
            </Text>
          }
          dataSource={monthRows}
          columns={monthTableColumns}
          rowKey="key"
          loading={isPending}
          pagination={false}
          scroll={{ x: 920 }}
          mobileTableHint={t("common.swipeTable")}
          locale={{ emptyText: t("forecast.empty") }}
        />
      </PageStack>
    </PageContent>
  );
}
