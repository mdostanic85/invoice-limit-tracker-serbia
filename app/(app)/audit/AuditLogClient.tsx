"use client";

import {
  Typography,
  Space,
  Tag,
  Descriptions,
  Divider,
  theme,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ColumnsType } from "antd/es/table";
import { PageContent } from "@/components/layout/PageContent";
import { PageStack } from "@/components/layout/PageStack";
import { ListDataTable, ListTableSummaryRow } from "@/components/layout/ListDataTable";
import { LinkButton } from "@/components/layout/AppButton";
import { AppDrawer } from "@/components/layout/AppDrawer";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useFormat } from "@/lib/i18n/use-format";
import { auditActionLabel } from "@/lib/i18n/helpers";

const { Text, Title } = Typography;
const { useToken } = theme;

const ACTION_COLORS: Record<string, string> = {
  INVOICE_CREATED: "blue",
  INVOICE_UPDATED: "processing",
  INVOICE_STATUS_CHANGED: "orange",
  INVOICE_CANCELLED: "error",
  INVOICE_DELETED: "red",
  RATE_FETCHED: "default",
  RATE_FALLBACK_USED: "gold",
  RATE_MANUALLY_OVERRIDDEN: "warning",
  FORECAST_CREATED: "purple",
  FORECAST_UPDATED: "purple",
  FORECAST_CANCELLED: "red",
  FORECAST_SNAPSHOT_SAVED: "geekblue",
  FORECAST_SNAPSHOT_LOADED: "geekblue",
  FORECAST_SNAPSHOT_DELETED: "red",
  ANNUAL_LIMIT_CHANGED: "magenta",
  ORG_SETTINGS_UPDATED: "default",
  CLIENT_CREATED: "green",
  CLIENT_UPDATED: "cyan",
  CLIENT_ARCHIVED: "orange",
  CLIENT_DELETED: "red",
};

interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  actorUserId: string;
  payload: unknown;
  createdAt: Date;
}

interface Props {
  data: {
    events: AuditEvent[];
    total: number;
    page: number;
    pageSize: number;
  } | undefined;
}

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "";
  if (typeof payload === "object" && Object.keys(payload as object).length === 0) {
    return "";
  }
  return JSON.stringify(payload, null, 2);
}

function hasPayload(payload: unknown): boolean {
  return formatPayload(payload).length > 0;
}

export function AuditLogClient({ data }: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const { formatDateTime } = useFormat();
  const router = useRouter();
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  function openDetails(event: AuditEvent) {
    setSelectedEvent(event);
  }

  const columns: ColumnsType<AuditEvent> = [
    {
      title: t("audit.columnTime"),
      key: "createdAt",
      width: 160,
      render: (_: unknown, r: AuditEvent) => formatDateTime(r.createdAt),
    },
    {
      title: t("audit.columnAction"),
      key: "action",
      width: 280,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: AuditEvent) => (
        <Tag color={ACTION_COLORS[r.action] ?? "default"}>
          {auditActionLabel(t, r.action)}
        </Tag>
      ),
    },
    {
      title: t("audit.columnEntity"),
      key: "entity",
      width: 200,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: AuditEvent) => (
        <Text>
          {r.entityType}
          {r.entityId && (
            <Text type="secondary">
              {" "}· {r.entityId.slice(0, 8)}…
            </Text>
          )}
        </Text>
      ),
    },
    {
      title: t("audit.columnActor"),
      key: "actor",
      width: 150,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: AuditEvent) => (
        <Text>{r.actorUserId.slice(0, 12)}…</Text>
      ),
    },
    {
      title: "",
      key: "details",
      width: 100,
      fixed: "right",
      render: (_: unknown, r: AuditEvent) => (
        <LinkButton
          onClick={(e) => {
            e.stopPropagation();
            openDetails(r);
          }}
        >
          {t("audit.view")}
        </LinkButton>
      ),
    },
  ];

  const payloadText = selectedEvent ? formatPayload(selectedEvent.payload) : "";

  return (
    <PageContent title={t("audit.title")}>
    <PageStack>
      <ListDataTable
        summary={
          <ListTableSummaryRow
            count={t("audit.description")}
            hint={t("audit.rowHint")}
          />
        }
        dataSource={data?.events ?? []}
        columns={columns}
        rowKey="id"
        loading={false}
        scroll={{ x: 900 }}
        onRow={(record) => ({
          onClick: () => openDetails(record),
          style: { cursor: "pointer" },
        })}
        pagination={{
          current: data?.page ?? 1,
          pageSize: data?.pageSize ?? 50,
          total: data?.total ?? 0,
          showTotal: (total) => t("audit.pagination", { total: String(total) }),
          onChange: (page) => router.push(`/audit?page=${page}`),
        }}
        locale={{ emptyText: t("audit.empty") }}
      />

      <AppDrawer
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        size={520}
        destroyOnClose
        showPrimary={false}
        title={
          selectedEvent ? (
            <Space>
              <Tag color={ACTION_COLORS[selectedEvent.action] ?? "default"}>
                {auditActionLabel(t, selectedEvent.action)}
              </Tag>
            </Space>
          ) : null
        }
      >
        {selectedEvent && (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions
              column={1}
              size="small"
              items={[
                {
                  key: "time",
                  label: t("audit.drawerTime"),
                  children: formatDateTime(selectedEvent.createdAt),
                },
                {
                  key: "entity",
                  label: t("audit.drawerEntity"),
                  children: selectedEvent.entityType,
                },
                {
                  key: "entityId",
                  label: t("audit.drawerEntityId"),
                  children: selectedEvent.entityId ? (
                    <Text copyable={{ text: selectedEvent.entityId }}>
                      {selectedEvent.entityId}
                    </Text>
                  ) : (
                    t("common.dash")
                  ),
                },
                {
                  key: "actor",
                  label: t("audit.drawerActor"),
                  children: (
                    <Text copyable={{ text: selectedEvent.actorUserId }}>
                      {selectedEvent.actorUserId}
                    </Text>
                  ),
                },
                {
                  key: "eventId",
                  label: t("audit.drawerEventId"),
                  children: (
                    <Text copyable={{ text: selectedEvent.id }}>
                      {selectedEvent.id}
                    </Text>
                  ),
                },
              ]}
            />

            <Divider style={{ margin: 0 }} />

            <div>
              <Title level={5} style={{ marginBottom: token.marginSM }}>
                {t("audit.drawerDetails")}
              </Title>
              {hasPayload(selectedEvent.payload) ? (
                <pre
                  style={{
                    margin: 0,
                    backgroundColor: token.colorFillAlter,
                    padding: token.paddingMD,
                    borderRadius: token.borderRadius,
                    overflow: "auto",
                    maxHeight: "calc(100vh - 320px)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {payloadText}
                </pre>
              ) : (
                <Text type="secondary">{t("audit.noPayload")}</Text>
              )}
            </div>
          </Space>
        )}
      </AppDrawer>
    </PageStack>
    </PageContent>
  );
}
