"use client";

import React, { Suspense, useState, useEffect } from "react";
import { Layout, Menu, Typography, Avatar, theme, Flex } from "antd";
import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  LineChartOutlined,
  CalendarOutlined,
  BarChartOutlined,
  AuditOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { TopBarToolbar } from "@/components/layout/TopBarToolbar";
import { TopBarYearSelect } from "@/components/layout/TopBarYearSelect";
import { TextButton } from "@/components/layout/AppButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useLocale } from "@/components/providers/LocaleProvider";

const { Sider, Content, Header } = Layout;
const { Text } = Typography;
const { useToken } = theme;

const NAV_KEYS = [
  { key: "/dashboard", icon: <DashboardOutlined /> },
  { key: "/invoices", icon: <FileTextOutlined /> },
  { key: "/clients", icon: <TeamOutlined /> },
  { key: "/forecast", icon: <LineChartOutlined /> },
  { key: "/annual-plan", icon: <CalendarOutlined /> },
  { key: "/audit", icon: <AuditOutlined /> },
  { key: "/settings", icon: <SettingOutlined /> },
] as const;

const NAV_LABEL_KEYS: Record<(typeof NAV_KEYS)[number]["key"], string> = {
  "/dashboard": "nav.dashboard",
  "/invoices": "nav.invoices",
  "/clients": "nav.clients",
  "/forecast": "nav.forecast",
  "/annual-plan": "nav.annualPlan",
  "/audit": "nav.audit",
  "/settings": "nav.settings",
};

const HEADER_HEIGHT = 48;

interface Props {
  children: React.ReactNode;
  orgName?: string;
}

export function AppShell({ children, orgName }: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = () => {
      setMobile(mq.matches);
      if (mq.matches) {
        setCollapsed(true);
        setMobileNavOpen(false);
      }
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const selectedKey = NAV_KEYS.find(
    (item) => pathname.startsWith(item.key)
  )?.key ?? "/dashboard";

  const navItems = NAV_KEYS.map((item) => ({
    ...item,
    label: t(NAV_LABEL_KEYS[item.key]),
  }));

  const contentMarginLeft = mobile ? 0 : collapsed ? 64 : 220;
  const navCollapsed = mobile ? false : collapsed;
  const headerTopOffset = "env(safe-area-inset-top, 0px)";
  const headerTotalHeight = `calc(${HEADER_HEIGHT}px + ${headerTopOffset})`;

  function toggleNav() {
    if (mobile) setMobileNavOpen((open) => !open);
    else setCollapsed((c) => !c);
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {mobile && mobileNavOpen && (
        <button
          type="button"
          aria-label={t("common.closeNav")}
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            border: "none",
            background: "rgba(0, 0, 0, 0.45)",
            zIndex: 99,
            cursor: "pointer",
          }}
        />
      )}

      <Sider
        className={[
          "app-shell-sider",
          mobileNavOpen ? "app-shell-sider--mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        width={mobile ? 288 : 220}
        collapsedWidth={64}
        collapsed={navCollapsed}
        collapsible
        trigger={null}
        style={{
          backgroundColor: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          position: "fixed",
          height: "100vh",
          overflow: "auto",
          left: 0,
          top: 0,
          zIndex: 100,
          transform:
            mobile && !mobileNavOpen ? "translateX(-100%)" : "translateX(0)",
          transition: "transform 0.2s, width 0.2s",
        }}
      >
        {/* Logo / brand */}
        <div
          className="app-shell-sider__brand"
          style={{
            padding: navCollapsed
              ? `${token.paddingMD}px ${token.paddingSM}px`
              : token.paddingMD,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: "flex",
            alignItems: "center",
            gap: token.marginSM,
            overflow: "hidden",
          }}
        >
          <Avatar
            style={{ backgroundColor: token.colorPrimary, flexShrink: 0 }}
            icon={<BarChartOutlined />}
          />
          {!navCollapsed && (
            <Text
              style={{
                flex: 1,
                fontWeight: 700,
                fontSize: token.fontSizeSM,
                lineHeight: 1.2,
                color: token.colorText,
                whiteSpace: "nowrap",
              }}
            >
              {t("layout.appName")}
              <br />
              <Text
                type="secondary"
                style={{ fontSize: 11, fontWeight: 400 }}
              >
                {orgName ?? t("layout.countryFallback")}
              </Text>
            </Text>
          )}
          {mobile ? (
            <TextButton
              icon={<MenuFoldOutlined />}
              onClick={() => setMobileNavOpen(false)}
              aria-label={t("common.closeNav")}
            />
          ) : null}
        </div>

        <Menu
          className="app-shell-sider__menu"
          mode="inline"
          selectedKeys={[selectedKey]}
          inlineCollapsed={navCollapsed}
          style={{
            border: "none",
            marginTop: token.marginXS,
          }}
          items={navItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => {
              router.push(item.key);
              if (mobile) setMobileNavOpen(false);
            },
          }))}
        />

        {mobile ? (
          <div
            className="app-shell-sider__footer"
            style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
          >
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("common.theme")}
            </Text>
            <ThemeToggle />
          </div>
        ) : null}
      </Sider>

      <Layout
        className="app-shell-main"
        style={{
          marginLeft: contentMarginLeft,
          transition: "margin 0.2s",
          minWidth: 0,
          width: mobile ? "100%" : undefined,
        }}
      >
        {/* Top bar */}
        <Header
          className="app-shell-header"
          style={{
            backgroundColor: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            padding: `0 ${token.paddingMD}px`,
            paddingTop: headerTopOffset,
            height: headerTotalHeight,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "fixed",
            top: 0,
            right: 0,
            left: contentMarginLeft,
            width: `calc(100% - ${contentMarginLeft}px)`,
            zIndex: 99,
            minWidth: 0,
            transition: "left 0.2s, width 0.2s",
          }}
        >
          <Flex
            align="center"
            gap={token.marginMD}
            className="app-shell-header__start"
            style={{ minWidth: 0 }}
          >
            <TextButton
              icon={
                mobile
                  ? mobileNavOpen
                    ? <MenuFoldOutlined />
                    : <MenuUnfoldOutlined />
                  : collapsed
                  ? <MenuUnfoldOutlined />
                  : <MenuFoldOutlined />
              }
              onClick={toggleNav}
              aria-label={t("common.toggleNav")}
            />
            <Suspense fallback={null}>
              <TopBarYearSelect />
            </Suspense>
          </Flex>

          <div className="app-shell-header__end">
            <TopBarToolbar />
          </div>
        </Header>

        <Content
          className="app-content-inner"
          style={{
            padding: token.paddingMD,
            paddingTop: `calc(${token.paddingMD}px + ${headerTotalHeight})`,
            minHeight: `calc(100vh - ${headerTotalHeight})`,
            background: token.colorBgLayout,
          }}
        >
          <div className="page-container" style={{ width: "100%" }}>
            {children}
          </div>

          {/* Legal footer */}
          <div
            style={{
              marginTop: token.marginXL,
              paddingTop: token.paddingSM,
              borderTop: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("layout.legalFooter")}
            </Text>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
