"use client";

import {
  Card,
  Segmented,
  Typography,
  Space,
  theme,
  Tooltip,
} from "antd";
import { PlusOutlined, SettingOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { PrimaryButton, SecondaryButton, LinkButton } from "@/components/layout/AppButton";
import { PageHeaderActions } from "@/components/layout/PageHeaderActions";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { AnnualLimitProgress } from "@/components/domain/AnnualLimitProgress";
import { ThresholdWarningBanner, hasThresholdAlerts } from "@/components/domain/ThresholdWarningBanner";
import { InvoiceStatusTag } from "@/components/domain/InvoiceStatusTag";
import { PageContent } from "@/components/layout/PageContent";
import {
  ListTableInlineFilter,
  PageFilterPanel,
} from "@/components/layout/ListDataTable";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";
import { DataTable } from "@/components/layout/DataTable";
import { MobileRecordCard } from "@/components/layout/MobileRecordCard";
import { KpiCard, DashboardKpiStat } from "@/components/layout/KpiCard";
import {
  MonthlyRevenueChart,
  ClientRevenueChart,
} from "@/components/charts/DashboardCharts";
import { useLocale } from "@/components/providers/LocaleProvider";
import { forecastScenarioLabel } from "@/lib/i18n/helpers";
import { formatRsd, formatDate, formatCurrency } from "@/lib/utils/format";
import { amountCellStyle } from "@/lib/theme/styles";

const { Text, Link: TextLink } = Typography;
const { useToken } = theme;

interface DashboardData {
  organization: {
    name: string;
    annualThresholdRsd: string;
    defaultReportingBasis: "ISSUE_DATE" | "PAYMENT_DATE";
    disclaimerAcceptedAt: Date | null;
  };
  year: number;
  scenario: string;
  limitStatus: {
    actualTotal: string;
    threshold: string;
    remaining: string;
    percentUsed: number;
    thresholdState: "neutral" | "warning" | "high_warning" | "exceeded";
    excludedCount: number;
  };
  projection: {
    projectedTotal: string;
    projectedRemaining: string;
    projectedPercentUsed: number;
    projectedThresholdState: "neutral" | "warning" | "high_warning" | "exceeded";
    forecastContribution: string;
    crossingMonth: string | null;
  };
  monthlyData: Array<{ month: string; label: string; actual: number }>;
  clientData: Array<{ clientId: string; displayName: string; totalRsd: number }>;
  statusCounts: Record<string, number>;
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    issueDate: Date;
    rsdAmount: { toString(): string };
    currency: string;
    originalAmount: { toString(): string };
    status: string;
    client: { displayName: string } | null;
  }>;
  upcomingForecast: Array<{
    id: string;
    expectedDate: Date;
    originalAmount: { toString(): string };
    currency: string;
    estimatedRsdAmount: { toString(): string };
    scenario: string;
    client: { displayName: string } | null;
  }>;
}

interface Props {
  data: DashboardData;
}

export function DashboardClient({ data }: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => params.set(k, v));
    router.push(`${pathname}?${params.toString()}`);
  }

  const { limitStatus, projection, organization, year, scenario } = data;

  const recentCols = [
    { title: t("dashboard.columnNumber"), dataIndex: "invoiceNumber", key: "invoiceNumber", width: 120 },
    {
      title: t("dashboard.columnClient"),
      key: "client",
      width: 200,
      ellipsis: true,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["recentInvoices"][0]) =>
        r.client?.displayName ?? t("common.dash"),
    },
    {
      title: t("dashboard.columnDate"),
      key: "date",
      width: 115,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["recentInvoices"][0]) => formatDate(r.issueDate),
    },
    {
      title: t("dashboard.columnAmountRsd"),
      key: "rsd",
      width: 145,
      render: (_: unknown, r: DashboardData["recentInvoices"][0]) => (
        <span className="amount-cell" style={amountCellStyle}>
          {formatRsd(r.rsdAmount.toString())}
        </span>
      ),
      align: "right" as const,
    },
    {
      title: t("common.status"),
      key: "status",
      width: 100,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["recentInvoices"][0]) => (
        <InvoiceStatusTag status={r.status} />
      ),
    },
  ];

  const forecastCols = [
    {
      title: t("dashboard.columnDate"),
      key: "date",
      width: 115,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["upcomingForecast"][0]) =>
        formatDate(r.expectedDate),
    },
    {
      title: t("dashboard.columnClient"),
      key: "client",
      width: 200,
      ellipsis: true,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["upcomingForecast"][0]) =>
        r.client?.displayName ?? t("common.dash"),
    },
    {
      title: t("common.amount"),
      key: "amount",
      width: 130,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: DashboardData["upcomingForecast"][0]) =>
        formatCurrency(r.originalAmount.toString(), r.currency),
    },
    {
      title: t("dashboard.columnEstRsd"),
      key: "rsd",
      width: 145,
      render: (_: unknown, r: DashboardData["upcomingForecast"][0]) => (
        <span className="amount-cell" style={amountCellStyle}>
          {formatRsd(r.estimatedRsdAmount.toString())}
        </span>
      ),
      align: "right" as const,
    },
  ];

  const scenarioLabel = forecastScenarioLabel(t, scenario);

  const basisLabel =
    organization.defaultReportingBasis === "ISSUE_DATE"
      ? t("dashboard.issueDate")
      : t("dashboard.paymentDate");

  return (
    <PageContent
      title={t("dashboard.title")}
      extra={
        <PageHeaderActions
          secondary={
            <SecondaryButton onClick={() => router.push("/annual-plan")}>
              {t("nav.annualPlan")}
            </SecondaryButton>
          }
          primary={
            <PrimaryButton
              icon={<PlusOutlined />}
              onClick={() => router.push("/invoices/new")}
            >
              {t("nav.newInvoice")}
            </PrimaryButton>
          }
        />
      }
    >
    <BentoGrid>
      <BentoCell span={12}>
      <PageFilterPanel
        meta={
          <>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("dashboard.basisMeta", { basis: basisLabel })}
            </Text>
            <TextLink href="/settings" style={{ fontSize: token.fontSizeSM }}>
              <SettingOutlined aria-hidden="true" /> {t("dashboard.changeInSettings")}
            </TextLink>
          </>
        }
      >
        <ListTableInlineFilter label={t("dashboard.forecastScenario")}>
          <Segmented
            size="middle"
            value={scenario}
            options={[
              { label: t("scenario.CONSERVATIVE"), value: "CONSERVATIVE" },
              { label: t("scenario.EXPECTED"), value: "EXPECTED" },
              { label: t("scenario.OPTIMISTIC"), value: "OPTIMISTIC" },
            ]}
            onChange={(v) => updateParams({ scenario: v as string })}
            aria-label={t("dashboard.forecastScenario")}
          />
        </ListTableInlineFilter>
      </PageFilterPanel>
      </BentoCell>

      {hasThresholdAlerts({
        thresholdState: limitStatus.thresholdState,
        crossingMonth: projection.crossingMonth,
        projectedThresholdState: projection.projectedThresholdState,
        basis: organization.defaultReportingBasis,
        excludedCount: limitStatus.excludedCount,
      }) && (
      <BentoCell span={12}>
      <ThresholdWarningBanner
        thresholdState={limitStatus.thresholdState}
        percentUsed={limitStatus.percentUsed}
        actualTotal={limitStatus.actualTotal}
        threshold={limitStatus.threshold}
        crossingMonth={projection.crossingMonth}
        projectedThresholdState={projection.projectedThresholdState}
        projectedPercentUsed={projection.projectedPercentUsed}
        projectedTotal={projection.projectedTotal}
        basis={organization.defaultReportingBasis}
        year={year}
        excludedCount={limitStatus.excludedCount}
      />
      </BentoCell>
      )}

      <BentoCell sm={6} lg={3}>
          <KpiCard>
            <DashboardKpiStat
              title={t("dashboard.invoicedYtd")}
              hint={t("dashboard.kpiInvoicedHint")}
              value={formatRsd(limitStatus.actualTotal)}
              footer={
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("dashboard.percentOfLimit", {
                    percent: limitStatus.percentUsed.toFixed(1),
                    currency: formatRsd(limitStatus.threshold),
                  })}
                </Text>
              }
            />
          </KpiCard>
      </BentoCell>
      <BentoCell sm={6} lg={3}>
          <KpiCard>
            <DashboardKpiStat
              title={t("dashboard.remaining")}
              hint={t("dashboard.kpiRemainingHint")}
              value={formatRsd(limitStatus.remaining)}
              valueColor={
                parseFloat(limitStatus.remaining) === 0
                  ? token.colorError
                  : token.colorSuccess
              }
              footer={
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                  {t("dashboard.annualLimit")} {formatRsd(limitStatus.threshold)}
                </Text>
              }
            />
          </KpiCard>
      </BentoCell>
      <BentoCell sm={6} lg={3}>
          <KpiCard>
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
                <Text type="secondary" style={{ fontSize: token.fontSizeSM, lineHeight: 1.4, flex: 1 }}>
                  {t("dashboard.limitUsed")}
                </Text>
                <Tooltip title={t("dashboard.kpiLimitUsedHint")} placement="topLeft">
                  <InfoCircleOutlined
                    style={{ color: token.colorTextTertiary, fontSize: 12, marginTop: 2 }}
                    aria-label={t("dashboard.kpiLimitUsedHint")}
                  />
                </Tooltip>
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: token.marginSM,
                  minHeight: 0,
                }}
              >
                <AnnualLimitProgress
                  actualTotal={limitStatus.actualTotal}
                  threshold={limitStatus.threshold}
                  remaining={limitStatus.remaining}
                  percentUsed={limitStatus.percentUsed}
                  thresholdState={limitStatus.thresholdState}
                  showStats={false}
                  strokeWidth={12}
                />
              </div>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("dashboard.percentOfLimit", {
                  percent: limitStatus.percentUsed.toFixed(1),
                  currency: formatRsd(limitStatus.threshold),
                })}
              </Text>
            </div>
          </KpiCard>
      </BentoCell>
      <BentoCell sm={6} lg={3}>
          <KpiCard>
            <DashboardKpiStat
              title={t("dashboard.projected", { scenario: scenarioLabel })}
              hint={t("dashboard.kpiProjectedHint")}
              value={formatRsd(projection.projectedTotal)}
              valueColor={
                projection.projectedThresholdState === "exceeded"
                  ? token.colorError
                  : projection.projectedThresholdState !== "neutral"
                  ? token.colorWarning
                  : token.colorText
              }
              footer={
                projection.crossingMonth ? (
                  <Text type="warning" style={{ fontSize: token.fontSizeSM }}>
                    {t("dashboard.crossesLimit")} {projection.crossingMonth}
                  </Text>
                ) : parseFloat(projection.forecastContribution) > 0 ? (
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("dashboard.fromForecast", {
                      amount: formatRsd(projection.forecastContribution),
                    })}
                  </Text>
                ) : (
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("dashboard.percentOfLimit", {
                      percent: projection.projectedPercentUsed.toFixed(1),
                      currency: formatRsd(limitStatus.threshold),
                    })}
                  </Text>
                )
              }
            />
          </KpiCard>
      </BentoCell>

      <BentoCell lg={7}>
          <Card className="widget-card" title={
              <Text style={{ fontSize: token.fontSizeSM }}>
                {t(
                  scenario === "EXPECTED"
                    ? "dashboard.monthlyExpectedRevenue"
                    : "dashboard.monthlyRevenue",
                  { year }
                )}
              </Text>
            }
          >
            <MonthlyRevenueChart data={data.monthlyData} year={year} />
          </Card>
      </BentoCell>

      <BentoCell lg={5}>
          <Card className="widget-card" title={
              <Text style={{ fontSize: token.fontSizeSM }}>
                {t("dashboard.revenueByClient")}
              </Text>
            }
          >
            {data.clientData.length === 0 ? (
              <Text type="secondary">{t("dashboard.noData")}</Text>
            ) : (
              <ClientRevenueChart data={data.clientData} />
            )}
          </Card>
      </BentoCell>

      <BentoCell lg={6}>
          <Card className="widget-card" title={<Text style={{ fontSize: token.fontSizeSM }}>{t("dashboard.recentInvoices")}</Text>}
            extra={
              <LinkButton onClick={() => router.push("/invoices")}>
                {t("dashboard.viewAll")}
              </LinkButton>
            }
          >
            <DataTable
              dataSource={data.recentInvoices}
              columns={recentCols}
              mobileCard={(invoice) => (
                <MobileRecordCard
                  eyebrow={invoice.client?.displayName ?? t("common.dash")}
                  title={invoice.invoiceNumber}
                  badge={<InvoiceStatusTag status={invoice.status} />}
                  amount={formatRsd(invoice.rsdAmount.toString())}
                  amountLabel={t("dashboard.columnAmountRsd")}
                  details={[
                    {
                      label: t("dashboard.columnDate"),
                      value: formatDate(invoice.issueDate),
                    },
                  ]}
                />
              )}
              pagination={false}
              rowKey="id"
              locale={{ emptyText: t("dashboard.noInvoices") }}
            />
          </Card>
      </BentoCell>

      <BentoCell lg={6}>
          <Card className="widget-card" title={<Text style={{ fontSize: token.fontSizeSM }}>{t("dashboard.upcomingForecast")}</Text>}
            extra={
              <LinkButton onClick={() => router.push("/forecast")}>
                {t("dashboard.viewAll")}
              </LinkButton>
            }
          >
            <DataTable
              dataSource={data.upcomingForecast}
              columns={forecastCols}
              mobileCard={(forecast) => (
                <MobileRecordCard
                  eyebrow={formatDate(forecast.expectedDate)}
                  title={forecast.client?.displayName ?? t("common.dash")}
                  amount={formatCurrency(
                    forecast.originalAmount.toString(),
                    forecast.currency
                  )}
                  amountLabel={t("common.amount")}
                  details={[
                    {
                      label: t("dashboard.columnEstRsd"),
                      value: (
                        <Text strong className="amount-cell">
                          {formatRsd(forecast.estimatedRsdAmount.toString())}
                        </Text>
                      ),
                    },
                  ]}
                />
              )}
              pagination={false}
              rowKey="id"
              locale={{ emptyText: t("dashboard.noForecast") }}
            />
          </Card>
      </BentoCell>

      <BentoCell span={12}>
      <Card>
        <Space wrap>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("dashboard.invoiceStatus")}
          </Text>
          {Object.entries(data.statusCounts).map(([status, count]) => (
            <Space key={status} size={token.marginXS}>
              <InvoiceStatusTag status={status} />
              <Text style={{ fontSize: token.fontSizeSM }}>{count}</Text>
            </Space>
          ))}
        </Space>
      </Card>
      </BentoCell>
    </BentoGrid>
    </PageContent>
  );
}
