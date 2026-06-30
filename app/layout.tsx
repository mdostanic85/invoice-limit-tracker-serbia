import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ClerkAppearanceBridge } from "@/components/providers/ClerkAppearanceBridge";
import { ThemeInitScript } from "@/components/providers/ThemeInitScript";
import { APP_FONT_FAMILY } from "@/lib/theme/tokens";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice Limit Tracker Serbia",
  description:
    "Track invoiced revenue in RSD, monitor your annual threshold, and plan future billing — for Serbian entrepreneurs and agencies.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: APP_FONT_FAMILY }}>
        <ThemeInitScript />
        <AntdRegistry>
          <ThemeProvider>
            <ClerkAppearanceBridge>{children}</ClerkAppearanceBridge>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
