"use client";

import { LogoutOutlined } from "@ant-design/icons";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import { TextButton } from "@/components/layout/AppButton";
import { useLocale } from "@/components/providers/LocaleProvider";

export function AppUserButton() {
  const { t } = useLocale();

  return (
    <div className="app-topbar-account">
      <div className="app-topbar-user">
        <UserButton />
      </div>
      <SignOutButton redirectUrl="/sign-in">
        <TextButton
          className="app-topbar-logout"
          icon={<LogoutOutlined />}
          aria-label={t("common.logout")}
        >
          <span className="app-topbar-logout__label">{t("common.logout")}</span>
        </TextButton>
      </SignOutButton>
    </div>
  );
}
