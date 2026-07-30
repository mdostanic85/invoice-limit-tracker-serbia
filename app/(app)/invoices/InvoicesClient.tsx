"use client";

import {
  Typography,
  Tag,
  Tooltip,
  theme,
  App,
} from "antd";
import { CommentOutlined, PlusOutlined } from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { TablePaginationConfig } from "antd";
import type { FilterValue, SorterResult } from "antd/es/table/interface";
import { InvoiceStatusTag } from "@/components/domain/InvoiceStatusTag";
import { PageContent } from "@/components/layout/PageContent";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useFormat } from "@/lib/i18n/use-format";
import { PageHeaderActions } from "@/components/layout/PageHeaderActions";
import { PageStack } from "@/components/layout/PageStack";
import { MobileRecordCard } from "@/components/layout/MobileRecordCard";
import {
  ListDataTable,
  ListTableFilterBar,
  ListTableSearch,
  ListTableSummaryRow,
} from "@/components/layout/ListDataTable";
import { PrimaryButton, LinkButton } from "@/components/layout/AppButton";
import { TableRowActions } from "@/components/layout/TableRowActions";
import { formatCurrency, formatDate, formatRate } from "@/lib/utils/format";
import type { ColumnsType } from "antd/es/table";
import { deleteInvoiceAction, duplicateInvoiceAction } from "@/app/actions/invoice-actions";
import { amountCellStyle } from "@/lib/theme/styles";
import { invoiceStatusLabel, invoiceCountLabel } from "@/lib/i18n/helpers";

const { Text } = Typography;
const { useToken } = theme;

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  paymentDate: Date | null;
  originalAmount: { toString(): string };
  currency: string;
  appliedMiddleRate: { toString(): string };
  rateEffectiveDate: Date;
  rsdAmount: { toString(): string };
  status: string;
  includeInLimit: boolean;
  isFallbackRate: boolean;
  manualOverride: boolean;
  notes: string | null;
  client: { displayName: string } | null;
}

interface ClientOption {
  id: string;
  displayName: string;
  defaultCurrency?: string | null;
  billingModel?: "FIXED" | "HOURLY";
  hourlyRate?: string | null;
  hourlyCurrency?: string | null;
}

interface Props {
  initialData: {
    invoices: Invoice[];
    total: number;
    page: number;
    pageSize: number;
    filteredTotal: string;
  } | null;
  clients: ClientOption[];
  initialFilters: Record<string, string>;
  pageTitle?: string;
}

const YEAR_DEFAULT = String(new Date().getFullYear());

export function InvoicesClient({
  initialData,
  clients,
  initialFilters,
  pageTitle,
}: Props) {
  const { token } = useToken();
  const { modal, message } = App.useApp();
  const { t, locale } = useLocale();
  const { formatRsd } = useFormat();

  const STATUS_OPTIONS = [
    { value: "DRAFT", label: invoiceStatusLabel(t, "DRAFT") },
    { value: "ISSUED", label: invoiceStatusLabel(t, "ISSUED") },
    { value: "PAID", label: invoiceStatusLabel(t, "PAID") },
    { value: "OVERDUE", label: invoiceStatusLabel(t, "OVERDUE") },
    { value: "CANCELLED", label: invoiceStatusLabel(t, "CANCELLED") },
  ];
  const router = useRouter();
  const pathname = usePathname();
  const listBasePath = pathname.startsWith("/reports") ? "/reports" : "/invoices";
  const toastHandled = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [status, setStatus] = useState<string | undefined>(initialFilters.status ?? undefined);
  const [clientId, setClientId] = useState<string | undefined>(initialFilters.clientId ?? undefined);
  const sortField = initialFilters.sortField ?? "issueDate";
  const sortOrder = (initialFilters.sortOrder as "ascend" | "descend" | undefined) ?? "descend";

  useEffect(() => {
    if (toastHandled.current) return;
    const toast = initialFilters.toast;
    if (!toast) return;

    toastHandled.current = true;
    if (toast === "saved") {
      message.success(t("invoices.saved"));
    } else if (toast === "updated") {
      message.success(t("invoices.updated"));
    }

    const params = new URLSearchParams();
    Object.entries(initialFilters).forEach(([key, value]) => {
      if (key !== "toast" && value) params.set(key, value);
    });
    const query = params.toString();
    router.replace(query ? `${listBasePath}?${query}` : listBasePath);
  }, [initialFilters, listBasePath, message, router, t]);

  function openEdit(invoice: Invoice) {
    const from = listBasePath === "/reports" ? "?from=reports" : "";
    router.push(`/invoices/${invoice.id}/edit${from}`);
  }

  function applyFilters(overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    const vals = {
      search,
      status,
      clientId,
      year: initialFilters.year ?? YEAR_DEFAULT,
      sortField,
      sortOrder,
      page: initialFilters.page,
      ...overrides,
    };
    Object.entries(vals).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`${listBasePath}?${params.toString()}`);
  }

  function columnSortOrder(field: string): "ascend" | "descend" | undefined {
    return sortField === field ? sortOrder : undefined;
  }

  function handleTableChange(
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Invoice> | SorterResult<Invoice>[]
  ) {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const next: Record<string, string | undefined> = {};
    let shouldApply = false;

    if (pagination.current && pagination.current !== (initialData?.page ?? 1)) {
      next.page = String(pagination.current);
      shouldApply = true;
    }

    if (s?.field && s.order) {
      next.sortField = String(s.field);
      next.sortOrder = s.order;
      if (!next.page) next.page = "1";
      shouldApply = true;
    } else if (s && "field" in s && !s.order) {
      next.sortField = "issueDate";
      next.sortOrder = "descend";
      if (!next.page) next.page = "1";
      shouldApply = true;
    }

    if (filters.clientId !== undefined) {
      const newClientId = filters.clientId?.[0] ? String(filters.clientId[0]) : undefined;
      if (newClientId !== clientId) {
        next.clientId = newClientId;
        setClientId(newClientId);
        if (!next.page) next.page = "1";
        shouldApply = true;
      }
    }

    if (filters.status !== undefined) {
      const newStatus = filters.status?.[0] ? String(filters.status[0]) : undefined;
      if (newStatus !== status) {
        next.status = newStatus;
        setStatus(newStatus);
        if (!next.page) next.page = "1";
        shouldApply = true;
      }
    }

    if (shouldApply) {
      applyFilters(next);
    }
  }

  function handleDuplicate(invoice: Invoice) {
    startTransition(async () => {
      const result = await duplicateInvoiceAction(invoice.id);
      if ("error" in result && result.error) {
        message.error(String(result.error));
        return;
      }
      message.success(t("invoices.duplicated"));
      router.refresh();
    });
  }

  function handleDelete(invoice: Invoice) {
    modal.confirm({
      title: t("invoices.deleteConfirm"),
      content: t("invoices.deleteDescription", { number: invoice.invoiceNumber }),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true },
      onOk: () =>
        new Promise<void>((resolve, reject) => {
          startTransition(async () => {
            const result = await deleteInvoiceAction(invoice.id);
            if ("error" in result && result.error) {
              message.error(String(result.error));
              reject();
              return;
            }
            message.success(t("invoices.deleted"));
            router.refresh();
            resolve();
          });
        }),
    });
  }

  function actionsForInvoice(invoice: Invoice) {
    return [
      { key: "edit", label: t("common.edit"), onClick: () => openEdit(invoice) },
      {
        key: "duplicate",
        label: t("common.duplicate"),
        onClick: () => handleDuplicate(invoice),
      },
      {
        key: "delete",
        label: t("common.delete"),
        onClick: () => handleDelete(invoice),
        danger: true,
      },
    ];
  }

  const columns: ColumnsType<Invoice> = [
    {
      title: t("invoices.columnNumber"),
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 120,
      sorter: true,
      sortOrder: columnSortOrder("invoiceNumber"),
      render: (v: string, r: Invoice) => {
        const notes = r.notes?.trim();
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: token.marginXXS }}>
            <LinkButton
              style={{ padding: 0 }}
              onClick={() => openEdit(r)}
            >
              {v}
            </LinkButton>
            {notes ? (
              <Tooltip title={notes}>
                <CommentOutlined
                  aria-label={t("common.notes")}
                  style={{ color: token.colorTextDescription, fontSize: token.fontSizeSM }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            ) : null}
          </span>
        );
      },
    },
    {
      title: t("invoices.columnClient"),
      key: "clientId",
      width: 160,
      ellipsis: true,
      filters: clients.map((c) => ({ text: c.displayName, value: c.id })),
      filteredValue: clientId ? [clientId] : null,
      filterMultiple: false,
      filterSearch: true,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: Invoice) => r.client?.displayName ?? t("common.dash"),
    },
    {
      title: t("invoices.columnIssueDate"),
      dataIndex: "issueDate",
      key: "issueDate",
      sorter: true,
      sortOrder: columnSortOrder("issueDate"),
      render: (d: Date) => formatDate(d),
      width: 120,
    },
    {
      title: t("invoices.columnPaymentDate"),
      dataIndex: "paymentDate",
      key: "paymentDate",
      sorter: true,
      sortOrder: columnSortOrder("paymentDate"),
      render: (d: Date | null) => formatDate(d) || t("common.dash"),
      width: 125,
    },
    {
      title: t("invoices.columnStatus"),
      dataIndex: "status",
      key: "status",
      width: 110,
      filters: STATUS_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      filteredValue: status ? [status] : null,
      filterMultiple: false,
      sorter: true,
      sortOrder: columnSortOrder("status"),
      render: (s: string) => <InvoiceStatusTag status={s} />,
    },
    {
      title: t("invoices.columnAmount"),
      dataIndex: "originalAmount",
      key: "originalAmount",
      width: 130,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: Invoice) =>
        formatCurrency(r.originalAmount.toString(), r.currency),
      align: "right",
      sorter: true,
      sortOrder: columnSortOrder("originalAmount"),
    },
    {
      title: t("invoices.columnCcy"),
      dataIndex: "currency",
      key: "currency",
      width: 60,
    },
    {
      title: t("invoices.columnNbsRate"),
      key: "rate",
      width: 115,
      onCell: () => ({ style: { whiteSpace: "nowrap" } }),
      render: (_: unknown, r: Invoice) => (
        <Tooltip
          title={
            r.isFallbackRate
              ? t("invoices.rateFallback")
              : r.manualOverride
              ? t("invoices.rateManual")
              : t("invoices.rateNbs")
          }
        >
          <Text>
            {formatRate(r.appliedMiddleRate.toString(), 4)}
            {r.isFallbackRate && <Tag color="gold" style={{ marginLeft: 2 }}>{t("invoices.tagFallback")}</Tag>}
            {r.manualOverride && <Tag color="orange" style={{ marginLeft: 2 }}>{t("invoices.tagManual")}</Tag>}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: t("invoices.columnRsdAmount"),
      dataIndex: "rsdAmount",
      key: "rsdAmount",
      width: 145,
      sorter: true,
      sortOrder: columnSortOrder("rsdAmount"),
      align: "right",
      render: (v: { toString(): string }) => (
        <Text strong className="amount-cell" style={amountCellStyle}>
          {formatRsd(v.toString())}
        </Text>
      ),
    },
    {
      title: t("invoices.columnInLimit"),
      dataIndex: "includeInLimit",
      key: "includeInLimit",
      width: 90,
      render: (v: boolean, r: Invoice) =>
        r.status === "CANCELLED" ? (
          <Tag color="default">{t("common.no")}</Tag>
        ) : v ? (
          <Tag color="green">{t("common.yes")}</Tag>
        ) : (
          <Tag color="default">{t("common.no")}</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 160,
      fixed: "right",
      render: (_: unknown, r: Invoice) => (
        <TableRowActions actions={actionsForInvoice(r)} />
      ),
    },
  ];

  const data = initialData;

  return (
    <PageContent
      title={pageTitle ?? t("invoices.title")}
      extra={
        <PageHeaderActions
          primary={
            <PrimaryButton
              icon={<PlusOutlined />}
              onClick={() => router.push("/invoices/new")}
            >
              {t("nav.newInvoice")}
            </PrimaryButton>
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
              onSearch={(value) => applyFilters({ search: value, page: "1" })}
              placeholder={t("invoices.searchPlaceholder")}
            />
          </ListTableFilterBar>
        }
        summary={
          data ? (
            <ListTableSummaryRow
              count={invoiceCountLabel(data.total, t, locale)}
              totalLabel={t("invoices.metaTotalLabel")}
              totalAmount={formatRsd(data.filteredTotal)}
            />
          ) : undefined
        }
        dataSource={data?.invoices ?? []}
        columns={columns}
        mobileCard={(invoice) => (
          <MobileRecordCard
            eyebrow={invoice.client?.displayName ?? t("common.dash")}
            title={
              <LinkButton onClick={() => openEdit(invoice)}>
                {invoice.invoiceNumber}
              </LinkButton>
            }
            badge={<InvoiceStatusTag status={invoice.status} />}
            amount={formatCurrency(
              invoice.originalAmount.toString(),
              invoice.currency
            )}
            amountLabel={t("invoices.columnAmount")}
            details={[
              {
                label: t("invoices.columnRsdAmount"),
                value: (
                  <Text strong className="amount-cell">
                    {formatRsd(invoice.rsdAmount.toString())}
                  </Text>
                ),
              },
              {
                label: t("invoices.columnIssueDate"),
                value: formatDate(invoice.issueDate),
              },
              {
                label: t("invoices.columnPaymentDate"),
                value: formatDate(invoice.paymentDate) || t("common.dash"),
              },
              {
                label: t("invoices.columnNbsRate"),
                value: formatRate(invoice.appliedMiddleRate.toString(), 4),
              },
            ]}
            footer={
              <>
                <span>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t("invoices.columnInLimit")}{" "}
                  </Text>
                  <Tag
                    color={
                      invoice.status !== "CANCELLED" && invoice.includeInLimit
                        ? "green"
                        : "default"
                    }
                  >
                    {invoice.status !== "CANCELLED" && invoice.includeInLimit
                      ? t("common.yes")
                      : t("common.no")}
                  </Tag>
                </span>
                <TableRowActions compact actions={actionsForInvoice(invoice)} />
              </>
            }
          />
        )}
        rowKey="id"
        loading={isPending}
        scroll={{ x: 1400 }}
        onChange={handleTableChange}
        showSorterTooltip={{ target: "sorter-icon" }}
        pagination={{
          current: data?.page ?? 1,
          pageSize: data?.pageSize ?? 50,
          total: data?.total ?? 0,
          showTotal: (total) => invoiceCountLabel(total, t, locale),
        }}
        locale={{ emptyText: t("invoices.empty") }}
      />
    </PageStack>
    </PageContent>
  );
}
