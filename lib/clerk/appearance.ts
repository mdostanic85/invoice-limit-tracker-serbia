import {
  APP_FONT_FAMILY,
  darkThemeConfig,
  lightThemeConfig,
} from "@/lib/theme/tokens";

function token(isDark: boolean) {
  return (isDark ? darkThemeConfig.token : lightThemeConfig.token)!;
}

/** Clerk UI aligned with app typography and light/dark tokens. */
export function getClerkAppearance(isDark: boolean) {
  const t = token(isDark);

  return {
    variables: {
      fontFamily: APP_FONT_FAMILY,
      fontFamilyButtons: APP_FONT_FAMILY,
      fontSize: "14px",
      colorPrimary: String(t.colorPrimary),
      colorBackground: String(t.colorBgContainer),
      colorForeground: String(t.colorText),
      colorMutedForeground: String(t.colorTextSecondary),
      colorMuted: String(t.colorFillSecondary),
      colorInput: String(t.colorBgContainer),
      colorInputForeground: String(t.colorText),
      colorNeutral: String(t.colorTextTertiary),
      borderRadius: `${t.borderRadius}px`,
    },
    elements: {
      rootBox: {
        width: "100%",
      },
      cardBox: {
        width: "100%",
      },
      card: {
        width: "100%",
        padding: "0",
        border: `1px solid ${String(t.colorBorderSecondary)}`,
        boxShadow: String(t.boxShadowTertiary),
      },
      headerTitle: {
        display: "none",
      },
      headerSubtitle: {
        display: "none",
      },
      main: {
        padding: "24px 32px 20px",
      },
      footer: {
        padding: "0",
      },
      footerAction: {
        padding: "8px 16px",
      },
      footerAction__signIn: {
        padding: "8px 16px",
      },
      footerAction__signUp: {
        padding: "8px 16px",
      },
      footerItem: {
        padding: "8px 16px",
      },
      userButtonBox: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "32px",
        lineHeight: "0",
      },
      userButtonTrigger: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: "32px",
        lineHeight: "0",
      },
      avatarBox: {
        width: "28px",
        height: "28px",
      },
      userButtonPopoverCard: {
        fontFamily: APP_FONT_FAMILY,
      },
      userButtonPopoverActionButton: {
        fontFamily: APP_FONT_FAMILY,
      },
      userButtonPopoverActionButtonText: {
        fontFamily: APP_FONT_FAMILY,
      },
      userButtonPopoverFooter: {
        fontFamily: APP_FONT_FAMILY,
      },
    },
  };
}
