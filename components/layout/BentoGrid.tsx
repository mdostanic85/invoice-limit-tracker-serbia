"use client";

import type { CSSProperties, ReactNode } from "react";

interface BentoGridProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** 12-column bento grid with uniform cell gaps. */
export function BentoGrid({ children, className, style }: BentoGridProps) {
  return (
    <div className={["bento-grid", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}

type BentoSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface BentoCellProps {
  children: ReactNode;
  /** Default span (mobile-first, &lt;576px) */
  span?: BentoSpan;
  /** Span from 576px */
  sm?: BentoSpan;
  /** Span from 992px */
  lg?: BentoSpan;
  className?: string;
  style?: CSSProperties;
}

/** Grid cell with responsive column spans. Children stretch to fill cell height. */
export function BentoCell({
  children,
  span = 12,
  sm,
  lg,
  className,
  style,
}: BentoCellProps) {
  const cellStyle = {
    "--bento-span": span,
    ...(sm !== undefined ? { "--bento-span-sm": sm } : {}),
    ...(lg !== undefined ? { "--bento-span-lg": lg } : {}),
    ...style,
  } as CSSProperties;

  return (
    <div
      className={["bento-cell", className].filter(Boolean).join(" ")}
      style={cellStyle}
    >
      {children}
    </div>
  );
}

/** Renders a full-width cell only when children are present (avoids empty grid rows). */
export function BentoSlot({ children }: { children: ReactNode }) {
  if (children === null || children === undefined || children === false) {
    return null;
  }
  return <BentoCell span={12}>{children}</BentoCell>;
}
