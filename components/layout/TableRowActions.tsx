"use client";

import type { MouseEvent } from "react";
import { Button, Divider, Dropdown, Space } from "antd";
import type { MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useLocale } from "@/components/providers/LocaleProvider";

export interface TableRowAction {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  actions: TableRowAction[];
  compact?: boolean;
}

function stopRowClick(e: MouseEvent) {
  e.stopPropagation();
}

function renderActionButton(action: TableRowAction) {
  return (
    <Button
      key={action.key}
      type="link"
      size="small"
      danger={action.danger}
      onClick={(e) => {
        stopRowClick(e);
        action.onClick();
      }}
    >
      {action.label}
    </Button>
  );
}

export function TableRowActions({ actions, compact = false }: Props) {
  const { t } = useLocale();

  if (actions.length === 0) return null;

  const inlineActions = compact
    ? []
    : actions.length <= 2
      ? actions
      : actions.slice(0, 2);
  const overflowActions = compact
    ? actions
    : actions.length <= 2
      ? []
      : actions.slice(2);

  const overflowItems: MenuProps["items"] = [];
  overflowActions.forEach((action, index) => {
    if (action.danger && index > 0) {
      overflowItems.push({ type: "divider" });
    }
    overflowItems.push({
      key: action.key,
      label: action.label,
      danger: action.danger,
      onClick: () => action.onClick(),
    });
  });

  return (
    <Space separator={<Divider orientation="vertical" />} size={4}>
      {inlineActions.map(renderActionButton)}
      {overflowActions.length > 0 && (
        <Dropdown menu={{ items: overflowItems }} trigger={["click"]}>
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={t("common.actions")}
            onClick={stopRowClick}
          />
        </Dropdown>
      )}
    </Space>
  );
}
