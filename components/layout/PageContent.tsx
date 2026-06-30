"use client";

import { Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Title } = Typography;

interface PageContentProps {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}

/** Full-width page shell — same container on every screen. */
export function PageContent({ title, extra, children }: PageContentProps) {
  const { token } = theme.useToken();

  return (
    <div className="page-content" style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}>
      {(title || extra) && (
        <div
          className="page-content__header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: token.marginMD,
            flexWrap: "wrap",
            gap: token.marginSM,
          }}
        >
          {title &&
            (typeof title === "string" ? (
              <Title level={4} style={{ margin: 0, minWidth: 0 }}>
                {title}
              </Title>
            ) : (
              title
            ))}
          {extra ? <div className="page-content__header-extra">{extra}</div> : null}
        </div>
      )}
      {children}
    </div>
  );
}
