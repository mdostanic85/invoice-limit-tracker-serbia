"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useThemePreference } from "@/lib/theme/ThemeProvider";
import { getClerkAppearance } from "@/lib/clerk/appearance";
import { clerkSrLatin } from "@/lib/clerk/localization";

export function ClerkAppearanceBridge({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isDark } = useThemePreference();

  return (
    <ClerkProvider
      appearance={getClerkAppearance(isDark)}
      localization={clerkSrLatin}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
    >
      {children}
    </ClerkProvider>
  );
}
