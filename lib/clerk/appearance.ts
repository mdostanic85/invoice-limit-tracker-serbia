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
