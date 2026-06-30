"use client";

import { Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

interface PageToolbarProps {
  children: ReactNode;
  meta?: ReactNode;
}

/** Filter / control panel shared across list and dashboard pages. */
export function PageToolbar({ children, meta }: PageToolbarProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="page-toolbar"
      style={{
        background: token.colorFillAlter,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
      }}
    >
      <div className="page-toolbar__controls">{children}</div>
      {meta ? (
        <div
          className="page-toolbar__meta"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export function PageToolbarGroup({
  children,
  wide,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        wide ? "page-toolbar__group page-toolbar__group--wide" : "page-toolbar__group",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function PageToolbarLabel({ children }: { children: ReactNode }) {
  return (
    <Text type="secondary" className="page-toolbar__label">
      {children}
    </Text>
  );
}

export function PageToolbarDivider() {
  const { token } = theme.useToken();
  return (
    <div
      className="page-toolbar__divider"
      style={{ background: token.colorBorderSecondary }}
      aria-hidden="true"
    />
  );
}
