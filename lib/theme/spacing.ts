/** Unified layout spacing — single source for bento grids and page rhythm. */
export const layoutSpacing = {
  /** Gap between bento cells and major page sections */
  grid: 16,
  /** Vertical stack inside cards and dense panels */
  stack: 8,
  /** Tight inline gaps (tags, chart bars) */
  inline: 4,
  /** Compact toolbars and filter bars */
  dense: 12,
} as const;

export const layoutCssVars = {
  grid: "--invoice-tracker-space-grid",
  stack: "--invoice-tracker-space-stack",
  inline: "--invoice-tracker-space-inline",
  dense: "--invoice-tracker-space-dense",
} as const;
