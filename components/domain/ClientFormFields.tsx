"use client";

import { Col, Divider, Form, Input, Row, Segmented, Select, theme, Typography } from "antd";
import type { FormInstance } from "antd";
import { DataTable } from "@/components/layout/DataTable";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  CLIENT_DEFAULT_CURRENCIES,
  currencySelectOptions,
} from "@/lib/constants/currencies";
import { formatCurrency, formatDate } from "@/lib/utils/format";

const CURRENCIES = CLIENT_DEFAULT_CURRENCIES;
const { useToken } = theme;
const { Text } = Typography;

export interface HourlyRateHistoryRow {
  id: string;
  ratePerHour: string;
  currency: string;
  effectiveFrom: string;
  note: string | null;
}

export interface ClientFormClient {
  id: string;
  displayName: string;
  legalName: string | null;
  countryCode: string | null;
  email: string | null;
  taxId: string | null;
  defaultCurrency: string | null;
  billingModel?: "FIXED" | "HOURLY";
  hourlyRate?: string | null;
  hourlyCurrency?: string | null;
  status?: string;
  notes: string | null;
}

interface Props {
  form: FormInstance;
  billingModel: "FIXED" | "HOURLY";
  editingClient?: ClientFormClient | null;
  rateHistory?: HourlyRateHistoryRow[];
  onFinish?: (values: Record<string, unknown>) => void;
}

export function ClientFormFields({
  form,
  billingModel,
  editingClient,
  rateHistory = [],
  onFinish,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();

  return (
    <Form form={form} layout="vertical" requiredMark="optional" onFinish={onFinish}>
      <Form.Item
        name="displayName"
        label={t("clients.displayName")}
        rules={[{ required: true, message: t("common.required") }]}
      >
        <Input placeholder={t("clients.placeholderDisplayName")} />
      </Form.Item>
      <Form.Item name="legalName" label={t("clients.legalName")}>
        <Input placeholder={t("clients.placeholderLegalName")} />
      </Form.Item>

      <Form.Item name="billingModel" label={t("clients.billingModel")}>
        <Segmented
          options={[
            { label: t("clients.billingFixed"), value: "FIXED" },
            { label: t("clients.billingHourly"), value: "HOURLY" },
          ]}
        />
      </Form.Item>

      {billingModel === "HOURLY" && (
        <>
          <Row gutter={token.marginMD}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="hourlyRate"
                label={t("clients.hourlyRate")}
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={t("clients.placeholderHourlyRate")}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="hourlyCurrency"
                label={t("clients.hourlyCurrency")}
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Select options={currencySelectOptions(CURRENCIES)} />
              </Form.Item>
            </Col>
          </Row>
          <Text
            type="secondary"
            style={{
              display: "block",
              marginBottom: token.marginMD,
              fontSize: token.fontSizeSM,
            }}
          >
            {t("clients.hourlyRateHint")}
          </Text>
          {editingClient && (
            <Form.Item name="hourlyRateNote" label={t("clients.rateNoteOptional")}>
              <Input placeholder={t("clients.placeholderRateNote")} maxLength={500} />
            </Form.Item>
          )}
          {rateHistory.length > 0 && (
            <>
              <Divider style={{ margin: `${token.marginSM}px 0` }} />
              <Text strong style={{ display: "block", marginBottom: token.marginSM }}>
                {t("clients.rateHistory")}
              </Text>
              <DataTable
                dataSource={rateHistory}
                rowKey="id"
                pagination={false}
                size="small"
                mobileTableHint={t("common.swipeTable")}
                columns={[
                  {
                    title: t("clients.ratePerHour"),
                    key: "rate",
                    render: (_: unknown, r: HourlyRateHistoryRow) =>
                      formatCurrency(r.ratePerHour, r.currency),
                  },
                  {
                    title: t("clients.effectiveFrom"),
                    dataIndex: "effectiveFrom",
                    render: (d: string) => formatDate(d),
                  },
                  {
                    title: t("clients.notes"),
                    dataIndex: "note",
                    render: (v: string | null) => v ?? t("common.dash"),
                  },
                ]}
              />
            </>
          )}
        </>
      )}

      <Row gutter={token.marginMD}>
        <Col xs={24} sm={12}>
          <Form.Item name="countryCode" label={t("clients.country")}>
            <Input
              maxLength={2}
              placeholder={t("clients.placeholderCountry")}
              style={{ textTransform: "uppercase" }}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="defaultCurrency" label={t("clients.currency")}>
            <Select
              allowClear
              placeholder={t("clients.select")}
              options={currencySelectOptions(CURRENCIES)}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="email" label={t("clients.email")}>
        <Input type="email" placeholder={t("clients.placeholderEmail")} />
      </Form.Item>
      <Form.Item name="taxId" label={t("clients.taxId")}>
        <Input placeholder={t("clients.placeholderTaxId")} />
      </Form.Item>
      <Form.Item name="notes" label={t("clients.notes")}>
        <Input.TextArea rows={3} maxLength={2000} showCount />
      </Form.Item>
    </Form>
  );
}
