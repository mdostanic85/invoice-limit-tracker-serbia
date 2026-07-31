"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Opening a drawer intentionally resets data from the selected client. */

import { App, Form } from "antd";
import { useEffect, useState, useTransition } from "react";
import {
  createClientAction,
  updateClientAction,
  getClientHourlyRateHistoryAction,
} from "@/app/actions/client-actions";
import { AppDrawer } from "@/components/layout/AppDrawer";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  ClientFormFields,
  type ClientFormClient,
  type HourlyRateHistoryRow,
} from "./ClientFormFields";

function formatActionError(error: unknown, t: (key: string) => string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const fieldMsg = Object.values(flat.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    return fieldMsg ?? flat.formErrors?.[0] ?? t("common.validationFailed");
  }
  return t("clients.saveFailed");
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (client: ClientFormClient) => void;
  editingClient?: ClientFormClient | null;
  initialDisplayName?: string;
}

export function ClientFormDrawer({
  open,
  onClose,
  onSuccess,
  editingClient = null,
  initialDisplayName = "",
}: Props) {
  const { message } = App.useApp();
  const { t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const [form] = Form.useForm();
  const [rateHistory, setRateHistory] = useState<HourlyRateHistoryRow[]>([]);
  const billingModel = Form.useWatch("billingModel", form) ?? "FIXED";

  useEffect(() => {
    if (!open) return;

    if (editingClient) {
      form.setFieldsValue({
        ...editingClient,
        hourlyRate: editingClient.hourlyRate ?? undefined,
        hourlyCurrency: editingClient.hourlyCurrency ?? editingClient.defaultCurrency ?? "EUR",
      });

      if (editingClient.billingModel === "HOURLY") {
        void getClientHourlyRateHistoryAction(editingClient.id).then((result) => {
          if ("data" in result && result.data) {
            setRateHistory(result.data as unknown as HourlyRateHistoryRow[]);
          }
        });
      } else {
        setRateHistory([]);
      }
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      billingModel: "FIXED",
      displayName: initialDisplayName.trim() || undefined,
    });
    setRateHistory([]);
  }, [open, editingClient, initialDisplayName, form]);

  function handleSubmit(values: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const result = editingClient
          ? await updateClientAction(editingClient.id, values)
          : await createClientAction(values);

        if ("error" in result && result.error) {
          message.error(formatActionError(result.error, t));
          return;
        }

        if ("data" in result && result.data) {
          const saved = result.data as ClientFormClient;
          message.success(editingClient ? t("clients.updated") : t("clients.created"));
          onSuccess(saved);
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : t("clients.saveFailed"));
      }
    });
  }

  return (
    <AppDrawer
      open={open}
      title={editingClient ? t("clients.editClient") : t("clients.newClient")}
      onClose={onClose}
      size={480}
      destroyOnClose
      okText={editingClient ? t("common.save") : t("common.create")}
      onOk={() => form.submit()}
      okLoading={isPending}
    >
      <ClientFormFields
        form={form}
        billingModel={billingModel}
        editingClient={editingClient}
        rateHistory={rateHistory}
        onFinish={handleSubmit}
      />
    </AppDrawer>
  );
}
