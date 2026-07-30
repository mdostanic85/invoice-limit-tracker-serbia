"use client";

import { Typography, theme } from "antd";
import type { ReactNode } from "react";

const { Text } = Typography;

export interface MobileRecordDetail {
  label: ReactNode;
  value: ReactNode;
  fullWidth?: boolean;
}

interface MobileRecordCardProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  badge?: ReactNode;
  amount?: ReactNode;
  amountLabel?: ReactNode;
  details?: MobileRecordDetail[];
  footer?: ReactNode;
}

/**
 * Compact mobile alternative to a wide data-table row.
 * The accent rule and tabular amount treatment borrow from a paper ledger.
 */
export function MobileRecordCard({
  title,
  eyebrow,
  badge,
  amount,
  amountLabel,
  details = [],
  footer,
}: MobileRecordCardProps) {
  const { token } = theme.useToken();

  return (
    <article
      className="mobile-record-card"
      style={{
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderInlineStart: `3px solid ${token.colorPrimary}`,
        borderRadius: token.borderRadius,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <header className="mobile-record-card__header">
        <div className="mobile-record-card__identity">
          {eyebrow ? (
            <Text type="secondary" className="mobile-record-card__eyebrow">
              {eyebrow}
            </Text>
          ) : null}
          <div className="mobile-record-card__title">{title}</div>
        </div>
        {badge ? <div className="mobile-record-card__badge">{badge}</div> : null}
      </header>

      {amount ? (
        <div
          className="mobile-record-card__amount-block"
          style={{ background: token.colorFillAlter }}
        >
          {amountLabel ? (
            <Text type="secondary" className="mobile-record-card__amount-label">
              {amountLabel}
            </Text>
          ) : null}
          <div className="mobile-record-card__amount amount-cell">{amount}</div>
        </div>
      ) : null}

      {details.length > 0 ? (
        <dl className="mobile-record-card__details">
          {details.map((detail, index) => (
            <div
              className={[
                "mobile-record-card__detail",
                detail.fullWidth ? "mobile-record-card__detail--wide" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={index}
            >
              <dt>
                <Text
                  type="secondary"
                  className="mobile-record-card__detail-label"
                >
                  {detail.label}
                </Text>
              </dt>
              <dd className="mobile-record-card__detail-value">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? (
        <footer
          className="mobile-record-card__footer"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          {footer}
        </footer>
      ) : null}
    </article>
  );
}
