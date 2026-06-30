"use client";

import { Flex, theme } from "antd";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AppUserButton } from "@/components/layout/AppUserButton";

export function TopBarToolbar() {
  const { token } = theme.useToken();

  return (
    <Flex align="center" gap={token.marginSM} className="app-topbar-toolbar">
      <ThemeToggle className="app-topbar-toolbar__theme" />
      <div
        className="app-topbar-toolbar__divider"
        style={{ background: token.colorBorderSecondary }}
        aria-hidden
      />
      <AppUserButton />
    </Flex>
  );
}
