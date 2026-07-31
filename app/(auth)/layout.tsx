import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Praćenje limita faktura Srbija",
  description:
    "Pratite fakturisani prihod, godišnji limit i plan budućih naplata.",
};

export default function AuthRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
