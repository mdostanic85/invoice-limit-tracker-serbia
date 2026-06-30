"use client";

import { Tag } from "antd";
import { useLocale } from "@/components/providers/LocaleProvider";
import { invoiceStatusLabel } from "@/lib/i18n/helpers";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ISSUED: "blue",
  PAID: "green",
  OVERDUE: "orange",
  CANCELLED: "red",
};

interface Props {
  status: string;
}

export function InvoiceStatusTag({ status }: Props) {
  const { t } = useLocale();
  const color = STATUS_COLORS[status] ?? "default";
  return <Tag color={color}>{invoiceStatusLabel(t, status)}</Tag>;
}
