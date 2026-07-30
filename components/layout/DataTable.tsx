"use client";

import { Empty, Pagination, Spin, Table } from "antd";
import type { TableProps } from "antd";
import type { Key, ReactNode } from "react";
import { useState } from "react";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";

export interface DataTableProps<RecordType extends object = object>
  extends TableProps<RecordType> {
  /** Purpose-built mobile representation of a wide table row. */
  mobileCard?: (record: RecordType, index: number) => ReactNode;
  /** Short instruction shown above tables that must remain horizontally scrollable. */
  mobileTableHint?: ReactNode;
}

function recordKey<RecordType extends object>(
  record: RecordType,
  index: number,
  rowKey: TableProps<RecordType>["rowKey"]
): Key {
  if (typeof rowKey === "function") return rowKey(record);
  if (typeof rowKey === "string") {
    const value = (record as Record<string, unknown>)[rowKey];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  const fallback = (record as { key?: Key }).key;
  return fallback ?? index;
}

export function DataTable<RecordType extends object = object>({
  mobileCard,
  mobileTableHint,
  ...props
}: DataTableProps<RecordType>) {
  const isMobile = useIsMobile();
  const [localMobilePage, setLocalMobilePage] = useState(1);
  const scroll = props.scroll
    ? { x: "max-content" as const, ...props.scroll }
    : { x: "max-content" as const };

  if (isMobile && mobileCard) {
    const records = props.dataSource ?? [];
    const pagination =
      props.pagination && typeof props.pagination === "object"
        ? props.pagination
        : undefined;
    const pageSize = pagination?.pageSize ?? 10;
    const controlledPage = pagination?.current;
    const total = pagination?.total ?? records.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(controlledPage ?? localMobilePage, maxPage);
    const isLoading =
      typeof props.loading === "boolean"
        ? props.loading
        : Boolean(props.loading?.spinning);
    const visibleRecords =
      props.pagination === false || controlledPage
        ? records
        : records.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const showPagination =
      props.pagination !== false && total > pageSize;
    const emptyText =
      typeof props.locale?.emptyText === "function"
        ? props.locale.emptyText()
        : props.locale?.emptyText;

    function handlePageChange(page: number, nextPageSize: number) {
      if (pagination?.onChange) {
        pagination.onChange(page, nextPageSize);
        return;
      }
      if (props.onChange) {
        props.onChange(
          { current: page, pageSize: nextPageSize, total },
          {} as Record<string, FilterValue | null>,
          {} as SorterResult<RecordType>,
          { currentDataSource: records as RecordType[], action: "paginate" }
        );
        return;
      }
      setLocalMobilePage(page);
    }

    return (
      <div className="mobile-record-list" aria-busy={isLoading}>
        <Spin spinning={isLoading}>
          {visibleRecords.length > 0 ? (
            <div className="mobile-record-list__items">
              {visibleRecords.map((record, index) => (
                <div key={recordKey(record, index, props.rowKey)}>
                  {mobileCard(record, index)}
                </div>
              ))}
            </div>
          ) : (
            <div className="mobile-record-list__empty">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={emptyText}
              />
            </div>
          )}
        </Spin>

        {showPagination ? (
          <div className="mobile-record-list__pagination">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              showLessItems
              responsive
              onChange={handlePageChange}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const table = (
    <Table<RecordType>
      bordered={false}
      {...props}
      scroll={scroll}
      className={["app-data-table", props.className].filter(Boolean).join(" ")}
      style={{
        width: "100%",
        maxWidth: "100%",
        ...props.style,
      }}
      pagination={
        props.pagination === false
          ? false
          : {
              showSizeChanger: false,
              ...((typeof props.pagination === "object" && props.pagination) || {}),
          }
      }
    />
  );

  if (isMobile && mobileTableHint) {
    return (
      <div className="mobile-scroll-table">
        <div className="mobile-scroll-table__hint">{mobileTableHint}</div>
        {table}
      </div>
    );
  }

  return table;
}
