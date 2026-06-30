"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useThemePreference } from "@/lib/theme/ThemeProvider";
import { getClerkAppearance } from "@/lib/clerk/appearance";

export function ClerkAppearanceBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isDark } = useThemePreference();

  return (
    <ClerkProvider
      appearance={getClerkAppearance(isDark)}
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
