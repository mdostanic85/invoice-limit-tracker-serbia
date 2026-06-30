"use client";

import { Typography, theme } from "antd";
import { formatCurrency, formatRsd } from "@/lib/utils/format";

const { Text } = Typography;
const { useToken } = theme;

interface Props {
  amount: number | string;
  currency: string;
  showRsd?: boolean;
  rsdAmount?: number | string;
  size?: "small" | "default" | "large";
}

export function CurrencyAmount({
  amount,
  currency,
  showRsd = false,
  rsdAmount,
  size = "default",
}: Props) {
  const { token } = useToken();

  const fontSize =
    size === "small"
      ? token.fontSizeSM
      : size === "large"
      ? token.fontSizeLG
      : token.fontSize;

  return (
    <span style={{ fontSize }}>
      <Text strong>{formatCurrency(amount, currency)}</Text>
      {showRsd && rsdAmount !== undefined && currency !== "RSD" && (
        <Text
          type="secondary"
          style={{ marginLeft: token.marginXS, fontSize: token.fontSizeSM }}
        >
          ≈ {formatRsd(rsdAmount)}
        </Text>
      )}
    </span>
  );
}
