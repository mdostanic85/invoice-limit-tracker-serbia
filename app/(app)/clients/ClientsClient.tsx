"use client";

import {
  Tag,
  Typography,
  App,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  archiveClientAction,
  restoreClientAction,
  deleteClientAction,
} from "@/app/actions/client-actions";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeaderActions } from "@/components/layout/PageHeaderActions";
import { PageStack } from "@/components/layout/PageStack";
import { ListDataTable, ListTableFilterBar, ListTableSearch, ListTableSummaryRow } from "@/components/layout/ListDataTable";
import { PrimaryButton, SecondaryButton, LinkButton } from "@/components/layout/AppButton";
import { TableRowActions } from "@/components/layout/TableRowActions";
import { ClientFormDrawer } from "@/components/domain/ClientFormDrawer";
import type { ClientFormClient } from "@/components/domain/ClientFormFields";
import { useLocale } from "@/components/providers/LocaleProvider";
import { formatCurrency } from "@/lib/utils/format";
import type { ColumnsType } from "antd/es/table";

const { Text } = Typography;

interface Client extends ClientFormClient {
  status: string;
}

interface Props {
  clients: Client[];
  showArchived: boolean;
}

function mapDeleteError(error: unknown, t: (key: string) => string): string {
  const code = typeof error === "string" ? error : "";
  if (code === "CLIENT_HAS_INVOICES") return t("clients.deleteBlockedInvoices");
  if (code === "CLIENT_HAS_FORECASTS") return t("clients.deleteBlockedForecasts");
  if (code === "CLIENT_NOT_ARCHIVED") return t("clients.deleteNotArchived");
  if (code === "CLIENT_NOT_FOUND") return t("clients.saveFailed");
  return t("common.error");
}

export function ClientsClient({ clients: initialClients, showArchived }: Props) {
  const { modal, message } = App.useApp();
  const { t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clients, setClients] = useState(initialClients);

  useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  const filtered = clients.filter((c) => {
    if (!showArchived && c.status === "ARCHIVED") return false;
    if (showArchived && c.status !== "ARCHIVED") return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.taxId?.toLowerCase().includes(q) ||
      c.legalName?.toLowerCase().includes(q)
    );
  });

  function openCreate() {
    setEditingClient(null);
    setDrawerOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setDrawerOpen(true);
  }

  function handleClientSaved(saved: ClientFormClient) {
    setClients((prev) =>
      editingClient
        ? prev.map((c) => (c.id === saved.id ? { ...saved, status: c.status } : c))
        : [...prev, { ...saved, status: saved.status ?? "ACTIVE" }].sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
          )
    );
    setDrawerOpen(false);
    router.refresh();
  }

  async function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreClientAction(id);
      if ("error" in result && result.error) {
        message.error(String(result.error));
        return;
      }
      message.success(t("clients.restored"));
      router.refresh();
    });
  }

  function confirmArchive(client: Client) {
    modal.confirm({
      title: t("clients.archiveConfirm"),
      content: t("clients.archiveDescription"),
      okText: t("common.archive"),
      cancelText: t("common.cancel"),
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            const result = await archiveClientAction(client.id);
            if ("error" in result && result.error) {
              message.error(String(result.error));
              reject();
              return;
            }
            message.success(t("clients.archived"));
            router.refresh();
            resolve();
          });
        }),
    });
  }

  function confirmDelete(client: Client) {
    modal.confirm({
      title: t("clients.deleteConfirm"),
      content: t("clients.deleteDescription"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            const result = await deleteClientAction(client.id);
            if ("error" in result && result.error) {
              message.error(mapDeleteError(result.error, t));
              reject();
              return;
            }
            setClients((prev) => prev.filter((c) => c.id !== client.id));
            message.success(t("clients.deleted"));
            router.refresh();
            resolve();
          });
        }),
    });
  }

  const columns: ColumnsType<Client> = [
    {
      title: t("clients.displayName"),
      key: "displayName",
      width: 220,
      ellipsis: true,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: Client) =>
        showArchived ? (
          <Text>{r.displayName}</Text>
        ) : (
          <LinkButton
            style={{ padding: 0, height: "auto" }}
            onClick={() => openEdit(r)}
          >
            {r.displayName}
          </LinkButton>
        ),
    },
    {
      title: t("clients.legalName"),
      dataIndex: "legalName",
      key: "legalName",
      width: 260,
      ellipsis: true,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (v: string | null) => v ?? t("common.dash"),
    },
    {
      title: t("clients.taxId"),
      dataIndex: "taxId",
      key: "taxId",
      width: 140,
      render: (v: string | null) => v ?? t("common.dash"),
    },
    {
      title: t("clients.country"),
      dataIndex: "countryCode",
      key: "countryCode",
      width: 80,
      render: (v: string | null) => v ?? t("common.dash"),
    },
    {
      title: t("clients.currency"),
      dataIndex: "defaultCurrency",
      key: "defaultCurrency",
      width: 90,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : t("common.dash")),
    },
    {
      title: t("clients.columnBilling"),
      key: "billingModel",
      width: 110,
      render: (_: unknown, r: Client) =>
        (r.billingModel ?? "FIXED") === "HOURLY" ? (
          <Tag color="blue">{t("clients.billingHourlyShort")}</Tag>
        ) : (
          <Tag>{t("clients.billingFixedShort")}</Tag>
        ),
    },
    {
      title: t("clients.hourlyRate"),
      key: "hourlyRate",
      width: 130,
      render: (_: unknown, r: Client) =>
        (r.billingModel ?? "FIXED") === "HOURLY" && r.hourlyRate
          ? formatCurrency(r.hourlyRate, r.hourlyCurrency ?? "EUR")
          : t("common.dash"),
    },
    {
      title: t("clients.status"),
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={s === "ACTIVE" ? "green" : "default"}>
          {s === "ACTIVE" ? t("common.active") : t("common.archived")}
        </Tag>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_: unknown, r: Client) => (
        <TableRowActions
          actions={
            !showArchived
              ? [
                  { key: "edit", label: t("common.edit"), onClick: () => openEdit(r) },
                  {
                    key: "archive",
                    label: t("common.archive"),
                    onClick: () => confirmArchive(r),
                    danger: true,
                  },
                ]
              : [
                  { key: "restore", label: t("common.restore"), onClick: () => handleRestore(r.id) },
                  {
                    key: "delete",
                    label: t("common.delete"),
                    onClick: () => confirmDelete(r),
                    danger: true,
                  },
                ]
          }
        />
      ),
    },
  ];

  return (
    <PageContent
      title={t("clients.title")}
      extra={
        <PageHeaderActions
          secondary={
            <SecondaryButton
              onClick={() =>
                router.push(showArchived ? "/clients" : "/clients?status=archived")
              }
            >
              {showArchived ? t("clients.showActive") : t("clients.showArchived")}
            </SecondaryButton>
          }
          primary={
            !showArchived ? (
              <PrimaryButton icon={<PlusOutlined />} onClick={openCreate}>
                {t("clients.newClient")}
              </PrimaryButton>
            ) : undefined
          }
        />
      }
    >
      <PageStack>
        <ListDataTable
          filters={
            <ListTableFilterBar>
              <ListTableSearch
                value={search}
                onChange={setSearch}
                onSearch={setSearch}
                placeholder={t("clients.searchPlaceholder")}
              />
            </ListTableFilterBar>
          }
          summary={
            <ListTableSummaryRow
              count={t("clients.toolbarMeta", { count: String(filtered.length) })}
            />
          }
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={isPending}
          scroll={{ x: 1050 }}
          locale={{
            emptyText: showArchived
              ? t("clients.emptyArchived")
              : t("clients.empty"),
          }}
          pagination={{
            pageSize: 25,
            showTotal: (total) => t("clients.pagination", { total }),
          }}
        />

        <ClientFormDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          editingClient={editingClient}
          onSuccess={handleClientSaved}
        />
      </PageStack>
    </PageContent>
  );
}
