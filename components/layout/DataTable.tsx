"use client";

import { Table } from "antd";
import type { TableProps } from "antd";

export function DataTable<RecordType extends object = object>(
  props: TableProps<RecordType>
) {
  const scroll = props.scroll
    ? { x: "max-content" as const, ...props.scroll }
    : { x: "max-content" as const };

  return (
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
}
