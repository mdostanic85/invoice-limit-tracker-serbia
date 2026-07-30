"use client";

import { Input, Segmented, theme, Typography } from "antd";
import type { ReactNode } from "react";
import { DataTable } from "./DataTable";
import type { DataTableProps } from "./DataTable";
import { PageToolbarGroup } from "./PageToolbar";

const { Text } = Typography;

export interface ListDataTableProps<RecordType extends object = object>
  extends Omit<DataTableProps<RecordType>, "title" | "summary"> {
  /** Prominent context row above filters (e.g. year selector). */
  context?: ReactNode;
  /** Filter controls rendered as a secondary header attached to the table. */
  filters?: ReactNode;
  /** Totals / meta rendered below the table body. */
  summary?: ReactNode;
}

/** List page table: integrated filter row + data + summary footer. */
export function ListDataTable<RecordType extends object = object>({
  context,
  filters,
  summary,
  className,
  style,
  ...tableProps
}: ListDataTableProps<RecordType>) {
  const { token } = theme.useToken();

  return (
    <div
      className="list-data-table"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        overflow: "hidden",
        background: token.colorBgContainer,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      {context ? (
        <div
          className="list-data-table__context"
          style={{
            padding: `${token.padding}px ${token.paddingLG}px`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          {context}
        </div>
      ) : null}

      {filters ? (
        <div
          className="list-data-table__filters"
          style={{
            padding: `${token.padding}px ${token.paddingLG}px`,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillAlter,
          }}
        >
          {filters}
        </div>
      ) : null}

      <DataTable<RecordType>
        {...tableProps}
        className={["list-data-table__table", className].filter(Boolean).join(" ")}
        style={{ width: "100%", ...style }}
      />

      {summary ? (
        <div
          className="list-data-table__summary"
          style={{
            padding: `${token.padding}px ${token.paddingLG}px`,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillAlter,
          }}
        >
          {summary}
        </div>
      ) : null}
    </div>
  );
}

/** Prominent year selector row inside ListDataTable.context */
export function ListTableYearBar({
  label,
  value,
  options,
  onChange,
  "aria-label": ariaLabel,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  "aria-label"?: string;
}) {
  return (
    <div className="list-data-table__year-bar">
      <Text strong className="list-data-table__year-label">
        {label}
      </Text>
      <Segmented
        className="list-data-table__year-segmented"
        size="middle"
        value={value}
        options={options}
        onChange={(v) => onChange(String(v))}
        aria-label={ariaLabel ?? label}
      />
    </div>
  );
}

/** Horizontal filter layout inside ListDataTable.filters */
export function ListTableFilterBar({
  children,
  searchOnly,
}: {
  children: ReactNode;
  /** Full-width search row without cramped side controls. */
  searchOnly?: boolean;
}) {
  return (
    <div
      className={[
        "list-data-table__filter-bar",
        searchOnly ? "list-data-table__filter-bar--search-only" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

/** Search field — same width and placement as on the invoices list. */
export function ListTableSearch({
  value,
  onChange,
  onSearch,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder: string;
  "aria-label"?: string;
}) {
  return (
    <PageToolbarGroup className="list-data-table__search-group">
      <Input.Search
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSearch={onSearch}
        allowClear
        aria-label={ariaLabel ?? placeholder}
      />
    </PageToolbarGroup>
  );
}

/** Label left, control right — matches top bar year selector inline layout. */
export function ListTableInlineFilter({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["list-data-table__inline-filter", className].filter(Boolean).join(" ")}
    >
      <Text type="secondary" className="list-data-table__inline-filter-label">
        {label}
      </Text>
      {children}
    </div>
  );
}

/** Summary footer row — count left, optional total right (invoices list pattern). */
export function ListTableSummaryRow({
  count,
  totalLabel,
  totalAmount,
  hint,
}: {
  count: ReactNode;
  totalLabel?: ReactNode;
  totalAmount?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="list-data-table__summary-stack">
      <div className="list-data-table__summary-row">
        <Text type="secondary" className="list-data-table__summary-count">
          {count}
        </Text>
        {totalLabel && totalAmount ? (
          <div className="list-data-table__summary-total">
            <Text type="secondary" className="list-data-table__summary-total-label">
              {totalLabel}
            </Text>
            <Text strong className="list-data-table__summary-amount amount-cell">
              {totalAmount}
            </Text>
          </div>
        ) : null}
      </div>
      {hint ? (
        <Text type="secondary" className="list-data-table__summary-hint">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

/** Filter panel for dashboard / plan pages — matches ListDataTable filter row styling. */
export function PageFilterPanel({
  children,
  meta,
}: {
  children: ReactNode;
  meta?: ReactNode;
}) {
  const { token } = theme.useToken();

  return (
    <div
      className="page-filter-panel"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadius,
        background: token.colorBgContainer,
      }}
    >
      <div
        className="page-filter-panel__body"
        style={{
          padding: `${token.padding}px ${token.paddingLG}px`,
          background: token.colorFillAlter,
          borderBottom: meta ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
      >
        <div className="list-data-table__filter-bar">{children}</div>
      </div>
      {meta ? (
        <div
          className="page-filter-panel__meta"
          style={{
            padding: `${token.padding}px ${token.paddingLG}px`,
            background: token.colorFillAlter,
          }}
        >
          {meta}
        </div>
      ) : null}
    </div>
  );
}
