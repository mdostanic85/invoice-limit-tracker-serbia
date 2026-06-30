"use client";

import { Descriptions, Tag, Tooltip, theme, Typography, Alert, Space } from "antd";
import { InfoCircleOutlined, WarningOutlined } from "@ant-design/icons";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatRate, rsdConversionFormula } from "@/lib/utils/format";

const { Text, Paragraph } = Typography;
const { useToken } = theme;

interface Props {
  currency: string;
  originalAmount: string;
  ratePerUnit: string;
  rsdAmount: string;
  effectiveDate: string;
  requestedDate?: string;
  source: string;
  sourceUrl?: string | null;
  isFallback: boolean;
  fallbackReason?: string | null;
  manualOverride?: boolean;
  overrideReason?: string | null;
  originalAutoRate?: string | null;
  /** Compact layout for drawers and side panels */
  compact?: boolean;
}

export function ExchangeRateDisplay({
  currency,
  originalAmount,
  ratePerUnit,
  rsdAmount,
  sourceUrl,
  isFallback,
  manualOverride,
  overrideReason,
  originalAutoRate,
  compact = false,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();

  const sourceLabel = manualOverride
    ? t("domain.manualOverride")
    : isFallback
    ? t("domain.nbsFallback")
    : t("domain.nbsMiddle");

  const sourceColor = manualOverride ? "orange" : isFallback ? "gold" : "green";

  if (compact) {
    return (
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          padding: `${token.paddingMD}px ${token.paddingLG}px`,
          backgroundColor: token.colorFillAlter,
        }}
      >
        {(isFallback && !manualOverride) || manualOverride ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: token.marginSM }}
            title={
              manualOverride
                ? t("domain.manualOverrideTitle")
                : t("domain.fallbackRateTitle")
            }
          />
        ) : null}
        <Text strong style={{ display: "block", fontSize: token.fontSize }}>
          {currency !== "RSD"
            ? rsdConversionFormula(originalAmount, currency, ratePerUnit, rsdAmount)
            : `${parseFloat(originalAmount).toLocaleString("en-RS")} RSD`}
        </Text>
        <Space size="small" wrap style={{ marginTop: token.marginXXS }}>
          <Tag color={sourceColor} style={{ margin: 0 }}>
            {sourceLabel}
          </Tag>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {formatRate(ratePerUnit, 4)} RSD
          </Text>
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("domain.nbsOfficialList")}
            </a>
          )}
        </Space>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        padding: token.paddingMD,
        backgroundColor: token.colorFillAlter,
      }}
    >
      {isFallback && !manualOverride && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: token.marginSM }}
          title={
            <span>
              <strong>{t("domain.fallbackRateTitle")}</strong>
            </span>
          }
        />
      )}

      {manualOverride && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: token.marginSM }}
          title={
            <span>
              <strong>{t("domain.manualOverrideTitle")}</strong>
              {overrideReason && `: ${overrideReason}`}
              {originalAutoRate && (
                <span style={{ color: token.colorTextSecondary }}>
                  {t("domain.originalNbsRate", { rate: formatRate(originalAutoRate) })}
                </span>
              )}
            </span>
          }
        />
      )}

      <Paragraph
        style={{
          fontFamily: "monospace",
          fontSize: token.fontSizeLG,
          fontWeight: 600,
          margin: 0,
          marginBottom: token.marginSM,
          color: token.colorText,
        }}
      >
        {currency !== "RSD"
          ? rsdConversionFormula(originalAmount, currency, ratePerUnit, rsdAmount)
          : `${parseFloat(originalAmount).toLocaleString("en-RS")} RSD`}
      </Paragraph>

      <Descriptions
        column={2}
        items={[
          {
            key: "source",
            label: t("domain.source"),
            children: (
              <Tag color={sourceColor} icon={<InfoCircleOutlined />}>
                {sourceLabel}
              </Tag>
            ),
          },
          {
            key: "rate",
            label: t("domain.ratePerUnit", { currency }),
            children: (
              <Text code>
                {formatRate(ratePerUnit, 4)} RSD
              </Text>
            ),
          },
          ...(sourceUrl
            ? [
                {
                  key: "url",
                  label: t("domain.sourceUrl"),
                  children: (
                    <Tooltip title={sourceUrl}>
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: token.colorPrimary }}
                      >
                        {t("domain.nbsOfficialList")}
                      </a>
                    </Tooltip>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
