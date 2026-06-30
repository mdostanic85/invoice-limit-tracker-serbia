"use client";

import { Drawer, theme } from "antd";
import type { DrawerProps } from "antd";
import { PrimaryButton, SecondaryButton } from "./AppButton";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";

export type AppDrawerProps = Omit<DrawerProps, "extra" | "footer"> & {
  okText?: string;
  onOk?: () => void;
  okLoading?: boolean;
  okDisabled?: boolean;
  cancelText?: string;
  /** When false, footer shows only cancel. Defaults to true when onOk is provided. */
  showPrimary?: boolean;
  footer?: React.ReactNode;
};

export function AppDrawer({
  okText,
  onOk,
  okLoading = false,
  okDisabled = false,
  cancelText,
  showPrimary,
  footer,
  onClose,
  children,
  styles,
  closable,
  ...drawerProps
}: AppDrawerProps) {
  const { token } = theme.useToken();
  const { t } = useLocale();
  const isMobile = useIsMobile();

  const showOk = showPrimary ?? Boolean(onOk);

  const resolvedClosable =
    closable === false
      ? false
      : typeof closable === "object"
        ? { placement: "end" as const, ...closable }
        : { placement: "end" as const };

  const defaultFooter = (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        flexWrap: "wrap",
        gap: token.marginSM,
      }}
    >
      <SecondaryButton onClick={onClose}>{cancelText ?? t("common.cancel")}</SecondaryButton>
      {showOk && onOk ? (
        <PrimaryButton loading={okLoading} disabled={okDisabled} onClick={onOk}>
          {okText ?? t("common.save")}
        </PrimaryButton>
      ) : null}
    </div>
  );

  const mergedStyles: DrawerProps["styles"] = (info) => {
    const resolved = (typeof styles === "function" ? styles(info) : styles) as
      | {
          body?: React.CSSProperties;
          footer?: React.CSSProperties;
          header?: React.CSSProperties;
          title?: React.CSSProperties;
        }
      | undefined;
    return {
      ...resolved,
      body: {
        paddingTop: token.paddingSM,
        paddingBottom: token.paddingSM,
        ...resolved?.body,
      },
      footer: {
        margin: 0,
        padding: `${token.paddingSM}px ${token.paddingLG}px`,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
        ...resolved?.footer,
      },
      header: {
        flexShrink: 0,
        ...resolved?.header,
      },
      title: {
        textAlign: "left",
        ...resolved?.title,
      },
    };
  };

  return (
    <Drawer
      {...drawerProps}
      size={isMobile ? "100%" : drawerProps.size}
      onClose={onClose}
      closable={resolvedClosable}
      footer={footer ?? defaultFooter}
      styles={mergedStyles}
    >
      {children}
    </Drawer>
  );
}
