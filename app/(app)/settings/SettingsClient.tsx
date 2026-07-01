"use client";

import {
  Form,
  Input,
  Select,
  Card,
  Space,
  Typography,
  Alert,
  Divider,
  theme,
} from "antd";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateOrganizationAction,
  updateThresholdAction,
} from "@/app/actions/org-actions";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PageContent } from "@/components/layout/PageContent";
import { useLocale } from "@/components/providers/LocaleProvider";
import { dbLocaleToLocale } from "@/lib/i18n/types";
import { PageStack } from "@/components/layout/PageStack";
import { DataTable } from "@/components/layout/DataTable";
import { PrimaryButton } from "@/components/layout/AppButton";
import {
  CountryLimitFormFields,
  applyCountryTaxDefaults,
} from "@/components/domain/CountryLimitFormFields";
import { getCountryTaxProfile } from "@/lib/domain/country-tax-rules";

const { Title, Text } = Typography;
const { useToken } = theme;

interface Props {
  organization: {
    name: string;
    timezone: string;
    countryCode: string;
    primaryCurrency: string;
    annualThresholdRsd: string;
    taxLimitTierId: string | null;
    limitCurrency: string;
    defaultReportingBasis: "ISSUE_DATE" | "PAYMENT_DATE";
    preferredLocale: "EN" | "SR";
    issuerLegalName: string | null;
    issuerAddress: string | null;
    issuerTaxId: string | null;
    issuerRegistrationNumber: string | null;
    issuerBankAccount: string | null;
    issuerEmail: string | null;
    issuerPhone: string | null;
    invoicePdfTemplate: "MINIMAL" | "AGENCY";
  };
  limitHistory: Array<{
    previousValue: string;
    newValue: string;
    reason: string | null;
    changedBy: string;
    changedAt: Date;
  }>;
}

export function SettingsClient({ organization, limitHistory }: Props) {
  const { token } = useToken();
  const { t, setLocale } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [orgForm] = Form.useForm();
  const [thresholdForm] = Form.useForm();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taxProfile = getCountryTaxProfile(organization.countryCode);

  const formatLimit = (value: string) =>
    formatCurrency(value, organization.limitCurrency);

  async function handleOrgSave(values: Record<string, unknown>) {
    startTransition(async () => {
      const result = await updateOrganizationAction(values);
      if ("error" in result) {
        setError(t("settings.saveFailed"));
      } else {
        setSuccess(t("settings.saved"));
        if (values.preferredLocale) {
          await setLocale(dbLocaleToLocale(values.preferredLocale as "EN" | "SR"));
        }
        router.refresh();
      }
    });
  }

  async function handleThresholdSave(values: Record<string, unknown>) {
    startTransition(async () => {
      const result = await updateThresholdAction(values);
      if ("error" in result) {
        setError(t("settings.thresholdFailed"));
      } else {
        setSuccess(t("settings.thresholdUpdated"));
        router.refresh();
      }
    });
  }

  const historyColumns = [
    { title: t("common.date"), key: "changedAt", width: 120, onCell: () => ({ style: { whiteSpace: "nowrap" } }), render: (_: unknown, r: typeof limitHistory[0]) => formatDate(r.changedAt) },
    { title: t("settings.columnPrevious"), dataIndex: "previousValue", key: "prev", width: 145, onCell: () => ({ style: { whiteSpace: "nowrap" } }), render: (v: string) => formatLimit(v) },
    { title: t("settings.columnNew"), dataIndex: "newValue", key: "new", width: 145, onCell: () => ({ style: { whiteSpace: "nowrap" } }), render: (v: string) => <Text strong>{formatLimit(v)}</Text> },
    { title: t("settings.columnReason"), dataIndex: "reason", key: "reason", width: 280, ellipsis: true, onCell: () => ({ style: { whiteSpace: "nowrap" } }), render: (v: string | null) => v ?? t("common.dash") },
  ];

  return (
    <PageContent title={t("settings.title")}>
      <PageStack>
        {success && (
          <Alert
            type="success"
            title={success}
            showIcon
            closable
            onClose={() => setSuccess(null)}
          />
        )}
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
            closable
            onClose={() => setError(null)}
          />
        )}

        <Form
          form={orgForm}
          layout="vertical"
          onFinish={handleOrgSave}
          initialValues={{
            name: organization.name,
            timezone: organization.timezone,
            countryCode: organization.countryCode,
            primaryCurrency: organization.primaryCurrency,
            defaultReportingBasis: organization.defaultReportingBasis,
            preferredLocale: organization.preferredLocale,
            issuerLegalName: organization.issuerLegalName ?? "",
            issuerAddress: organization.issuerAddress ?? "",
            issuerTaxId: organization.issuerTaxId ?? "",
            issuerRegistrationNumber: organization.issuerRegistrationNumber ?? "",
            issuerBankAccount: organization.issuerBankAccount ?? "",
            issuerEmail: organization.issuerEmail ?? "",
            issuerPhone: organization.issuerPhone ?? "",
            invoicePdfTemplate: organization.invoicePdfTemplate,
          }}
        >
        <PageStack>
        <Card title={t("settings.organization")}>
            <Form.Item name="name" label={t("settings.orgName")} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <CountryLimitFormFields form={orgForm} showLimitFields={false} />
            <Form.Item name="defaultReportingBasis" label={t("settings.reportingBasis")}>
              <Select
                options={[
                  { value: "ISSUE_DATE", label: t("settings.reportingIssue") },
                  { value: "PAYMENT_DATE", label: t("settings.reportingPayment") },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="preferredLocale"
              label={t("settings.language")}
              extra={t("settings.languageHint")}
            >
              <Select
                options={[
                  { value: "EN", label: t("common.english") },
                  { value: "SR", label: t("common.serbian") },
                ]}
              />
            </Form.Item>
        </Card>

        <Card
          title={t("settings.sectionIssuerProfile")}
          extra={
            <Text type="secondary" style={{ fontWeight: 400, maxWidth: 360 }}>
              {t("settings.sectionIssuerProfileHint")}
            </Text>
          }
        >
            <Form.Item name="issuerLegalName" label={t("settings.issuerLegalName")}>
              <Input placeholder={t("settings.placeholderIssuerLegal")} />
            </Form.Item>
            <Form.Item name="issuerAddress" label={t("settings.issuerAddress")}>
              <Input.TextArea rows={2} placeholder={t("settings.placeholderIssuerAddress")} />
            </Form.Item>
            <Form.Item name="issuerTaxId" label={t("settings.issuerTaxId")}>
              <Input placeholder={t("settings.placeholderIssuerTaxId")} />
            </Form.Item>
            <Form.Item
              name="issuerRegistrationNumber"
              label={t("settings.issuerRegistrationNumber")}
            >
              <Input placeholder={t("settings.placeholderIssuerMb")} />
            </Form.Item>
            <Form.Item name="issuerBankAccount" label={t("settings.issuerBankAccount")}>
              <Input placeholder={t("settings.placeholderIssuerBank")} />
            </Form.Item>
            <Form.Item name="issuerEmail" label={t("settings.issuerEmail")}>
              <Input type="email" placeholder={t("settings.placeholderIssuerEmail")} />
            </Form.Item>
            <Form.Item name="issuerPhone" label={t("settings.issuerPhone")}>
              <Input placeholder={t("settings.placeholderIssuerPhone")} />
            </Form.Item>
            <Form.Item name="invoicePdfTemplate" label={t("settings.invoicePdfTemplate")}>
              <Select
                options={[
                  { value: "MINIMAL", label: t("settings.templateMinimal") },
                  { value: "AGENCY", label: t("settings.templateAgency") },
                ]}
              />
            </Form.Item>
            <PrimaryButton htmlType="submit" loading={isPending}>
              {t("common.saveSettings")}
            </PrimaryButton>
        </Card>
        </PageStack>
        </Form>

        <Card
          title={t("settings.sectionAnnualLimit")}
          extra={
            <Text type="secondary" style={{ fontWeight: 400 }}>
              {taxProfile.regimeName}
            </Text>
          }
        >
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Text type="secondary">{t("settings.currentThreshold")}</Text>
              <Title level={3} style={{ margin: `${token.marginXS}px 0 0` }}>
                {formatLimit(organization.annualThresholdRsd)}
              </Title>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {taxProfile.legalReference}
              </Text>
            </div>

            <Form
              form={thresholdForm}
              layout="vertical"
              onFinish={handleThresholdSave}
              initialValues={{
                annualThresholdRsd: organization.annualThresholdRsd,
                taxLimitTierId: organization.taxLimitTierId,
              }}
            >
              {taxProfile.useTierSelector && (
                <Form.Item
                  name="taxLimitTierId"
                  label={t("domain.categoryLabel", { regime: taxProfile.regimeName })}
                  rules={[{ required: true }]}
                >
                  <Select
                    options={taxProfile.tiers.map((tier) => ({
                      value: tier.id,
                      label: `${tier.label} — ${formatCurrency(tier.annualLimit, organization.limitCurrency)}`,
                    }))}
                    onChange={(tierId) =>
                      applyCountryTaxDefaults(thresholdForm, organization.countryCode, tierId)
                    }
                  />
                </Form.Item>
              )}
              <Form.Item
                name="annualThresholdRsd"
                label={`${t("domain.annualRevenueLimit")} (${organization.limitCurrency})`}
                rules={[{ required: true }]}
                extra={t("settings.manualLimitHint")}
              >
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  suffix={organization.limitCurrency}
                />
              </Form.Item>
              <Form.Item name="reason" label={t("settings.reasonForChange")}>
                <Input placeholder={t("settings.placeholderReason")} />
              </Form.Item>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: token.marginMD }}
                title={t("settings.thresholdAlert")}
                description={t("settings.thresholdInfo")}
              />
              <PrimaryButton htmlType="submit" loading={isPending}>
                {t("settings.updateThreshold")}
              </PrimaryButton>
            </Form>

            {limitHistory.length > 0 && (
              <>
                <Divider style={{ margin: 0 }} />
                <div>
                  <Title level={5} style={{ marginTop: 0 }}>
                    {t("settings.thresholdHistory")}
                  </Title>
                  <DataTable
                    dataSource={limitHistory}
                    columns={historyColumns}
                    rowKey={(r) => r.changedAt.toString()}
                    pagination={false}
                  />
                </div>
              </>
            )}
          </Space>
        </Card>
      </PageStack>
    </PageContent>
  );
}
