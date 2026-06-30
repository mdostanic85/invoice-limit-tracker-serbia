"use client";

import { Typography, theme } from "antd";
import type { ReactNode } from "react";
import { LocaleProvider, useLocale } from "@/components/providers/LocaleProvider";

const { Title } = Typography;

interface AuthLayoutProps {
  title?: string;
  children: ReactNode;
}

function AuthLayoutInner({ title, children }: AuthLayoutProps) {
  const { token } = theme.useToken();
  const { t } = useLocale();
  const displayTitle = title ?? t("domain.authTitle");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: token.colorBgLayout,
        padding: token.paddingMD,
      }}
    >
      <div style={{ textAlign: "center", width: "100%", maxWidth: 420 }}>
        <Title
          level={3}
          style={{
            marginBottom: token.marginLG,
            color: token.colorText,
            fontWeight: 600,
          }}
        >
          {displayTitle}
        </Title>
        {children}
      </div>
    </div>
  );
}

export function AuthLayout(props: AuthLayoutProps) {
  return (
    <LocaleProvider initialLocale="EN">
      <AuthLayoutInner {...props} />
    </LocaleProvider>
  );
}
