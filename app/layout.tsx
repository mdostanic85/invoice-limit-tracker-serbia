import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { ClerkAppearanceBridge } from "@/components/providers/ClerkAppearanceBridge";
import { ThemeInitScript } from "@/components/providers/ThemeInitScript";
import { APP_FONT_FAMILY } from "@/lib/theme/tokens";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://limitradar.vercel.app"),
  applicationName: "LimitRadar",
  title: "LimitRadar",
  description:
    "LimitRadar tracks invoiced revenue in RSD, monitors your annual threshold, and helps you plan future billing.",
  authors: [
    {
      name: "Miloš Dostanić",
      url: "https://github.com/mdostanic85",
    },
  ],
  creator: "Miloš Dostanić",
  publisher: "Miloš Dostanić",
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
