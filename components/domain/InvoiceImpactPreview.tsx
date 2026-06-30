"use client";

import { Card, Statistic, Divider, Typography, Alert, theme } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useLocale } from "@/components/providers/LocaleProvider";
import { reportingBasisLabel } from "@/lib/i18n/helpers";
import { formatRsd, formatPercent } from "@/lib/utils/format";
import { AnnualLimitProgress } from "./AnnualLimitProgress";
import { getThresholdState } from "@/lib/domain/limit-calculations";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";

const { Text } = Typography;
const { useToken } = theme;

interface Props {
  currentActualRsd: string;
  newInvoiceRsd: string;
  threshold: string;
  basis: "ISSUE_DATE" | "PAYMENT_DATE";
  year: number;
  compact?: boolean;
}

export function InvoiceImpactPreview({
  currentActualRsd,
  newInvoiceRsd,
  threshold,
  basis,
  year,
  compact = false,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();

  const current = parseFloat(currentActualRsd);
  const newAmt = parseFloat(newInvoiceRsd);
  const thresh = parseFloat(threshold);
  const newTotal = current + newAmt;
  const overage = Math.max(newTotal - thresh, 0);
  const percentUsed = thresh > 0 ? (newTotal / thresh) * 100 : 0;
  const thresholdState = getThresholdState(percentUsed);
  const remaining = Math.max(thresh - newTotal, 0);
  const exceeds = newTotal > thresh;
  const basisLabel = reportingBasisLabel(t, basis);

  if (compact) {
    return (
      <div>
        {exceeds && (
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: token.marginSM }}
            title={t("domain.limitExceedBy", { amount: formatRsd(overage) })}
          />
        )}
        <AnnualLimitProgress
          actualTotal={String(newTotal)}
          threshold={threshold}
          remaining={String(remaining)}
          percentUsed={percentUsed}
          thresholdState={thresholdState}
          showStats={false}
        />
        <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: "block", marginTop: token.marginXS }}>
          {formatRsd(current)} + {formatRsd(newAmt)} = {formatRsd(newTotal)}
          {" · "}
          {t("domain.percentLimitUsed", {
            percent: formatPercent(percentUsed, 1),
            threshold: formatRsd(thresh),
          })}
          {remaining > 0 && t("domain.remainingSuffix", { remaining: formatRsd(remaining) })}
        </Text>
      </div>
    );
  }

  return (
    <Card
      title={
        <Text style={{ fontSize: token.fontSizeSM }}>
          {t("domain.limitImpact", { basis: basisLabel, year: String(year) })}
        </Text>
      }
      style={{
        borderColor: exceeds
          ? token.colorError
          : thresholdState === "warning" || thresholdState === "high_warning"
          ? token.colorWarning
          : token.colorBorderSecondary,
      }}
    >
      {exceeds && (
        <Alert
          type="error"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: token.marginSM }}
          title={t("domain.limitExceedBy", { amount: formatRsd(overage) })}
        />
      )}

      <BentoGrid>
        <BentoCell lg={4}>
          <Statistic
            title={t("domain.currentYtd")}
            value={formatRsd(current)}
            styles={{ content: { fontSize: token.fontSizeSM } }}
          />
        </BentoCell>
        <BentoCell lg={4}>
          <Statistic
            title={t("domain.thisInvoice")}
            value={formatRsd(newAmt)}
            styles={{
              content: {
                fontSize: token.fontSizeSM,
                color: token.colorPrimary,
              },
            }}
          />
        </BentoCell>
        <BentoCell lg={4}>
          <Statistic
            title={t("domain.newTotal")}
            value={formatRsd(newTotal)}
            styles={{
              content: {
                fontSize: token.fontSizeSM,
                color: exceeds ? token.colorError : token.colorText,
                fontWeight: 600,
              },
            }}
          />
        </BentoCell>
      </BentoGrid>

      <Divider style={{ margin: `${token.marginXS}px 0` }} />

      <AnnualLimitProgress
        actualTotal={String(newTotal)}
        threshold={threshold}
        remaining={String(remaining)}
        percentUsed={percentUsed}
        thresholdState={thresholdState}
        showStats={false}
      />

      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        {t("domain.percentLimitUsed", {
          percent: formatPercent(percentUsed, 1),
          threshold: formatRsd(thresh),
        })}
        {remaining > 0 &&
          t("domain.remainingSuffix", { remaining: formatRsd(remaining) })}
      </Text>
    </Card>
  );
}
