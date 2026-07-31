import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LimitRadar",
  description:
    "Pratite fakturisani prihod, godišnji limit i plan budućih naplata uz LimitRadar.",
};

export default function AuthRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
