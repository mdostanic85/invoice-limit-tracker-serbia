"use client";

import type { CSSProperties, ReactNode } from "react";

interface PageStackProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Vertical page sections with the same gap as bento grid cells. */
export function PageStack({ children, className, style }: PageStackProps) {
  return (
    <div className={["page-stack", className].filter(Boolean).join(" ")} style={style}>
      {children}
    </div>
  );
}
