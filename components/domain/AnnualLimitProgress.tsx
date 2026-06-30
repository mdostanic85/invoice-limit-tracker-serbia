"use client";

import { Progress, Statistic, Typography, theme, Space } from "antd";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatRsd, formatPercent } from "@/lib/utils/format";
import {
  getThresholdProgressStatus,
  getThresholdStrokeColor,
  type ThresholdState,
} from "@/lib/theme/threshold-progress";

const { Text } = Typography;
const { useToken } = theme;

interface Props {
  actualTotal: string;
  threshold: string;
  remaining: string;
  percentUsed: number;
  thresholdState: ThresholdState;
  showStats?: boolean;
  strokeWidth?: number;
}

export function AnnualLimitProgress({
  actualTotal,
  threshold,
  remaining,
  percentUsed,
  thresholdState,
  showStats = true,
  strokeWidth,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();

  const progressColor = getThresholdStrokeColor(thresholdState, token);

  const clampedPercent = Math.min(percentUsed, 100);

  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Progress
        percent={clampedPercent}
        strokeColor={progressColor}
        size={strokeWidth ? [-1, strokeWidth] : undefined}
        status={getThresholdProgressStatus(thresholdState)}
        format={() => (
          <Text
            style={{
              color: progressColor,
              fontWeight: 600,
              fontSize: token.fontSizeSM,
            }}
          >
            {formatPercent(percentUsed, 1)}
          </Text>
        )}
      />
      {showStats && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: token.marginXS,
          }}
        >
          <Statistic
            title={t("domain.invoicedYtd")}
            value={formatRsd(actualTotal)}
            styles={{ content: { fontSize: token.fontSizeSM, color: token.colorText } }}
          />
          <Statistic
            title={t("domain.remaining")}
            value={formatRsd(remaining)}
            styles={{
              content: {
                fontSize: token.fontSizeSM,
                color:
                  parseFloat(remaining) === 0
                    ? token.colorError
                    : token.colorSuccess,
              },
            }}
          />
          <Statistic
            title={t("domain.annualLimit")}
            value={formatRsd(threshold)}
            styles={{ content: { fontSize: token.fontSizeSM, color: token.colorTextSecondary } }}
          />
        </div>
      )}
    </Space>
  );
}
