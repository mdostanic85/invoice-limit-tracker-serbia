"use client";

import {
  BarChartOutlined,
  FileTextOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { Spin } from "antd";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { BrandLogo } from "@/components/layout/BrandLogo";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

function AuthLayoutInner({
  eyebrow,
  title,
  description,
  children,
}: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      <section
        className="auth-shell__story"
        aria-label="Pregled aplikacije LimitRadar"
      >
        <div className="auth-shell__brand">
          <BrandLogo className="auth-shell__brand-logo" />
        </div>

        <div className="auth-shell__story-copy">
          <span className="auth-shell__story-label">Jasna slika prihoda</span>
          <h2>Znajte gde vas svaka faktura vodi.</h2>
          <p>
            Pratite izdate fakture, približavanje godišnjem limitu i plan za
            naredne mesece.
          </p>
          <ul className="auth-shell__features">
            <li>
              <FileTextOutlined aria-hidden />
              Fakture na jednom mestu
            </li>
            <li>
              <BarChartOutlined aria-hidden />
              Pregled godišnjeg limita
            </li>
            <li>
              <LineChartOutlined aria-hidden />
              Planiranje budućih prihoda
            </li>
          </ul>
        </div>

        <p className="auth-shell__trust">
          <SafetyCertificateOutlined aria-hidden />
          Pristup vašim podacima zaštićen je bezbednom prijavom.
        </p>
      </section>

      <main className="auth-shell__main">
        <div className="auth-shell__form-wrap">
          <div className="auth-shell__heading">
            <span className="auth-shell__eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="auth-shell__clerk">
            <ClerkLoading>
              <div
                className="auth-shell__loading"
                role="status"
                aria-label="Učitavanje prijave"
              >
                <Spin />
              </div>
            </ClerkLoading>
            <ClerkLoaded>{children}</ClerkLoaded>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthLayout(props: AuthLayoutProps) {
  return (
    <LocaleProvider initialLocale="SR">
      <AuthLayoutInner {...props} />
    </LocaleProvider>
  );
}
