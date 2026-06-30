import type { CSSProperties } from "react";

/** Right-align financial figures with consistent digit width. */
export const tabularNums: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
};

export const amountCellStyle: CSSProperties = {
  ...tabularNums,
  fontWeight: 600,
};
