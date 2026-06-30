"use client";

import { Select } from "antd";
import type { ReactNode } from "react";
import type { SelectProps } from "antd";

/** Column header with optional inline filter control below the label. */
export function TableColumnHeader({
  label,
  filter,
}: {
  label: ReactNode;
  filter?: ReactNode;
}) {
  return (
    <div className="table-column-header">
      <span className="table-column-header__label">{label}</span>
      {filter ? (
        <div
          className="table-column-header__filter"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {filter}
        </div>
      ) : null}
    </div>
  );
}

/** Compact select for table column header filters. */
export function TableColumnFilterSelect(props: SelectProps) {
  return (
    <Select
      size="small"
      allowClear
      className="table-column-filter-select"
      popupMatchSelectWidth={false}
      {...props}
    />
  );
}
