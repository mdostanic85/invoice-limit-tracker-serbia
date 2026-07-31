"use client";

/* eslint-disable react-hooks/set-state-in-effect -- Edit snapshots and refreshed client props intentionally hydrate local form state. */

import {
  Form,
  Input,
  Select,
  DatePicker,
  Card,
  Space,
  Typography,
  Divider,
  Switch,
  Spin,
  Modal,
  Alert,
  Row,
  Col,
  Flex,
  App,
  theme,
} from "antd";
import {
  SaveOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { ExchangeRateDisplay } from "@/components/domain/ExchangeRateDisplay";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeaderActions } from "@/components/layout/PageHeaderActions";
import { PageStack } from "@/components/layout/PageStack";
import { BentoGrid, BentoCell } from "@/components/layout/BentoGrid";
import { PrimaryButton, SecondaryButton, TextButton, APP_CONTROL_SIZE } from "@/components/layout/AppButton";
import { ClientFormDrawer } from "@/components/domain/ClientFormDrawer";
import type { ClientFormClient } from "@/components/domain/ClientFormFields";
import {
  previewExchangeRateAction,
  createInvoiceAction,
  createInvoiceConfirmedAction,
  getSuggestedInvoiceNumberAction,
  updateInvoiceAction,
  updateInvoiceConfirmedAction,
} from "@/app/actions/invoice-actions";
import { formatRsd, formatPercent, formatCurrency } from "@/lib/utils/format";
import {
  calculateDailyAmount,
  calculateBillableDays,
} from "@/lib/utils/hourly-billing";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";
import { invoiceStatusLabel } from "@/lib/i18n/helpers";
import type { Translator } from "@/lib/i18n/types";
import {
  INVOICE_CURRENCIES,
  currencySelectOptions,
} from "@/lib/constants/currencies";

const { Text } = Typography;
const { useToken } = theme;

const CURRENCIES = INVOICE_CURRENCIES;

function formatActionError(error: unknown, t: Translator, isEdit: boolean): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const fieldMsg = Object.values(flat.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    return fieldMsg ?? flat.formErrors?.[0] ?? t("common.validationFailed");
  }
  return isEdit ? t("invoices.updateFailed") : t("invoices.createFailed");
}

interface RatePreview {
  currency: string;
  ratePerUnit: string;
  effectiveDate: string;
  requestedDate: string;
  isFallback: boolean;
  fallbackReason: string | null;
  source: string;
  sourceUrl: string | null;
}

type Client = ClientFormClient;

interface InitialInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
  paymentDate: string | null;
  billableHours: string | null;
  originalAmount: string;
  currency: string;
  includeInLimit: boolean;
  notes: string | null;
  manualOverride: boolean;
  appliedMiddleRate: string;
  overrideReason: string | null;
  rateEffectiveDate: string;
  isFallbackRate: boolean;
  fallbackReason: string | null;
  rateSource: string;
  rateSourceUrl: string | null;
}

interface Props {
  clients: Client[];
  suggestedInvoiceNumber?: string;
  invoiceId?: string;
  initialInvoice?: InitialInvoice;
  returnPath?: string;
}

export function InvoiceFormClient({
  clients,
  suggestedInvoiceNumber,
  invoiceId,
  initialInvoice,
  returnPath = "/invoices",
}: Props) {
  const isEdit = Boolean(invoiceId && initialInvoice);
  const { token } = useToken();
  const { message } = App.useApp();
  const { t } = useLocale();
  const isMobile = useIsMobile();

  const STATUS_OPTIONS = isEdit
    ? [
        { value: "DRAFT", label: invoiceStatusLabel(t, "DRAFT") },
        { value: "ISSUED", label: invoiceStatusLabel(t, "ISSUED") },
        { value: "PAID", label: invoiceStatusLabel(t, "PAID") },
        { value: "OVERDUE", label: invoiceStatusLabel(t, "OVERDUE") },
        { value: "CANCELLED", label: invoiceStatusLabel(t, "CANCELLED") },
      ]
    : [
        { value: "DRAFT", label: invoiceStatusLabel(t, "DRAFT") },
        { value: "ISSUED", label: invoiceStatusLabel(t, "ISSUED") },
        { value: "PAID", label: invoiceStatusLabel(t, "PAID") },
      ];

  const router = useRouter();
  const [form] = Form.useForm();
  const invoiceNumberEdited = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(
    () => initialInvoice?.clientId ?? undefined
  );
  const [ratePreview, setRatePreview] = useState<RatePreview | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState({
    originalAmount: "",
    currency: "RSD",
    issueDate: dayjs().format("YYYY-MM-DD"),
  });
  const [limitWarning, setLimitWarning] = useState<{
    currentActual: string;
    newAmount: string;
    newTotal: string;
    threshold: string;
    overage: string;
    percentUsed: number;
    basis: string;
  } | null>(null);
  const [pendingFormData, setPendingFormData] = useState<Record<string, unknown> | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const loadedSnapshotRef = useRef<{
    manualOverride: boolean;
    appliedMiddleRate: string;
    overrideReason: string | null;
  } | null>(null);
  const [useManualRate, setUseManualRate] = useState(false);
  const [manualRate, setManualRate] = useState("");
  const [manualRateReason, setManualRateReason] = useState("");
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [clientList, setClientList] = useState(clients);
  const [clientSearch, setClientSearch] = useState("");
  const [clientDrawerOpen, setClientDrawerOpen] = useState(false);
  const [clientDrawerPrefill, setClientDrawerPrefill] = useState("");

  const selectedClient = clientList.find((c) => c.id === selectedClientId);
  const isHourlyClient = selectedClient?.billingModel === "HOURLY";

  const rsdAmount = ratePreview
    ? (parseFloat(formValues.originalAmount || "0") * parseFloat(ratePreview.ratePerUnit)).toFixed(4)
    : "0";

  useEffect(() => {
    if (!isEdit || !initialInvoice) return;

    invoiceNumberEdited.current = true;
    setSelectedClientId(initialInvoice.clientId ?? undefined);

    const issueDateStr = dayjs(initialInvoice.issueDate).format("YYYY-MM-DD");
    const amount = String(initialInvoice.originalAmount);
    const currency = initialInvoice.currency;

    loadedSnapshotRef.current = {
      manualOverride: initialInvoice.manualOverride,
      appliedMiddleRate: String(initialInvoice.appliedMiddleRate),
      overrideReason: initialInvoice.overrideReason,
    };

    setFormValues({
      originalAmount: amount,
      currency,
      issueDate: issueDateStr,
    });

    if (initialInvoice.manualOverride) {
      setUseManualRate(true);
      setManualRate(String(initialInvoice.appliedMiddleRate));
      setManualRateReason(initialInvoice.overrideReason ?? "");
      setRatePreview({
        currency,
        ratePerUnit: String(initialInvoice.appliedMiddleRate),
        effectiveDate: dayjs(initialInvoice.rateEffectiveDate).format("YYYY-MM-DD"),
        requestedDate: issueDateStr,
        isFallback: initialInvoice.isFallbackRate,
        fallbackReason: initialInvoice.fallbackReason,
        source: "MANUAL_OVERRIDE",
        sourceUrl: initialInvoice.rateSourceUrl,
      });
      return;
    }

    setRatePreview({
      currency,
      ratePerUnit: String(initialInvoice.appliedMiddleRate),
      effectiveDate: dayjs(initialInvoice.rateEffectiveDate).format("YYYY-MM-DD"),
      requestedDate: issueDateStr,
      isFallback: initialInvoice.isFallbackRate,
      fallbackReason: initialInvoice.fallbackReason,
      source: initialInvoice.rateSource,
      sourceUrl: initialInvoice.rateSourceUrl,
    });
  }, [isEdit, initialInvoice]);

  async function fetchRate(currency: string, date: string) {
    if (!currency || !date || currency === "RSD") {
      setRatePreview({
        currency: "RSD",
        ratePerUnit: "1",
        effectiveDate: date,
        requestedDate: date,
        isFallback: false,
        fallbackReason: null,
        source: "NBS_MIDDLE",
        sourceUrl: null,
      });
      return;
    }

    setRateLoading(true);
    setRateError(null);

    const result = await previewExchangeRateAction({ currency, date });

    setRateLoading(false);
    if ("error" in result && result.error) {
      setRateError(typeof result.error === "string" ? result.error : t("invoices.rateFetchFailed"));
    } else if ("data" in result && result.data) {
      setRatePreview(result.data);
    }
  }

  function handleValuesChange(changed: Record<string, unknown>, all: Record<string, unknown>) {
    const currency = (all.currency as string) || "RSD";
    let amount = (all.originalAmount as string) || "";
    let effectiveCurrency = currency;
    const issueDate = all.issueDate ? dayjs(all.issueDate as dayjs.Dayjs).format("YYYY-MM-DD") : "";

    if ("issueDate" in changed && !invoiceNumberEdited.current && !isEdit) {
      const year = dayjs(all.issueDate as dayjs.Dayjs).year();
      void getSuggestedInvoiceNumberAction(year).then((result) => {
        if ("data" in result && result.data) {
          form.setFieldValue("invoiceNumber", result.data);
        }
      });
    }

    if ("billableHours" in changed) {
      const clientId = all.clientId as string | undefined;
      const client = clientList.find((c) => c.id === clientId);
      if (client?.billingModel === "HOURLY" && client.hourlyRate) {
        const days = String(changed.billableHours ?? "");
        if (days && parseFloat(days) > 0) {
          amount = calculateDailyAmount(days, client.hourlyRate);
          effectiveCurrency = client.hourlyCurrency ?? currency;
          form.setFieldsValue({ originalAmount: amount, currency: effectiveCurrency });
        }
      }
    }

    if ("originalAmount" in changed) {
      amount = String(changed.originalAmount ?? "");
      const clientId = all.clientId as string | undefined;
      const client = clientList.find((c) => c.id === clientId);
      if (client?.billingModel === "HOURLY" && client.hourlyRate) {
        if (amount && parseFloat(amount) > 0) {
          const days = calculateBillableDays(amount, client.hourlyRate);
          effectiveCurrency = client.hourlyCurrency ?? currency;
          form.setFieldsValue({ billableHours: days, currency: effectiveCurrency });
        }
      }
    }

    setFormValues({ originalAmount: amount, currency: effectiveCurrency, issueDate });

    const currencyUpdatedByHourly =
      ("billableHours" in changed || "originalAmount" in changed) &&
      effectiveCurrency !== currency;

    if (currencyUpdatedByHourly && effectiveCurrency && issueDate) {
      fetchRate(effectiveCurrency, issueDate);
    } else if ("currency" in changed || "issueDate" in changed) {
      if (effectiveCurrency && issueDate) {
        fetchRate(effectiveCurrency, issueDate);
      }
    }
  }

  useEffect(() => {
    setClientList(clients);
  }, [clients]);

  const clientSearchTrimmed = clientSearch.trim();
  const hasClientSearchMatch = clientSearchTrimmed
    ? clientList.some((c) =>
        c.displayName.toLowerCase().includes(clientSearchTrimmed.toLowerCase())
      )
    : true;

  function openAddClientDrawer(name?: string) {
    setClientDrawerPrefill(name?.trim() ?? clientSearchTrimmed);
    setClientDrawerOpen(true);
  }

  function handleClientCreated(client: ClientFormClient) {
    setClientList((prev) =>
      [...prev, client].sort((a, b) => a.displayName.localeCompare(b.displayName))
    );
    setClientDrawerOpen(false);
    setClientSearch("");
    form.setFieldValue("clientId", client.id);
    handleClientChange(client.id, client);
  }

  function handleClientChange(clientId: string, clientOverride?: Client) {
    setSelectedClientId(clientId);
    const client = clientOverride ?? clientList.find((c) => c.id === clientId);
    if (client?.defaultCurrency) {
      form.setFieldValue("currency", client.defaultCurrency);
      const issueDate = form.getFieldValue("issueDate");
      if (issueDate) {
        fetchRate(client.defaultCurrency, dayjs(issueDate).format("YYYY-MM-DD"));
      }
    }
    if (client?.billingModel === "HOURLY" && client.hourlyCurrency) {
      form.setFieldValue("currency", client.hourlyCurrency);
    }
    form.setFieldValue("billableHours", undefined);
  }

  async function handleSubmit(values: Record<string, unknown>) {
    setGeneralError(null);

    const formData: Record<string, unknown> = {
      invoiceNumber: values.invoiceNumber,
      clientId: values.clientId,
      issueDate: dayjs(values.issueDate as dayjs.Dayjs).format("YYYY-MM-DD"),
      dueDate: values.dueDate ? dayjs(values.dueDate as dayjs.Dayjs).format("YYYY-MM-DD") : null,
      paymentDate: values.paymentDate ? dayjs(values.paymentDate as dayjs.Dayjs).format("YYYY-MM-DD") : null,
      originalAmount: String(values.originalAmount),
      billableHours: values.billableHours ? String(values.billableHours) : null,
      currency: values.currency,
      status: values.status ?? "DRAFT",
      includeInLimit: values.includeInLimit ?? true,
      notes: values.notes ?? null,
    };

    if (useManualRate && ratePreview && manualRate) {
      formData.manualOverride = true;
      formData.appliedMiddleRate = manualRate;
      const trimmedReason = manualRateReason.trim();
      const storedReason = loadedSnapshotRef.current?.overrideReason?.trim();
      formData.overrideReason =
        trimmedReason.length >= 10
          ? trimmedReason
          : storedReason && storedReason.length >= 10
            ? storedReason
            : "Manual rate override";
    } else if (isEdit && loadedSnapshotRef.current?.manualOverride) {
      formData.manualOverride = true;
      formData.appliedMiddleRate = loadedSnapshotRef.current.appliedMiddleRate;
      const storedReason = loadedSnapshotRef.current.overrideReason?.trim();
      formData.overrideReason =
        storedReason && storedReason.length >= 10
          ? storedReason
          : "Manual rate override";
    }

    setIsSubmitting(true);
    try {
      const result = isEdit
        ? await updateInvoiceAction(invoiceId!, formData, returnPath)
        : await createInvoiceAction(formData, returnPath);

      if ("warning" in result && result.warning) {
        setPendingFormData(formData);
        if (isEdit) setPendingEditId(invoiceId!);
        setLimitWarning(result.warning);
        return;
      }

      if ("error" in result && result.error) {
        setGeneralError(formatActionError(result.error, t, isEdit));
        return;
      }

      setGeneralError(t("common.error"));
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setGeneralError(isEdit ? t("invoices.updateFailed") : t("invoices.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmedSubmit() {
    if (!pendingFormData) return;
    setIsSubmitting(true);
    try {
      const result = isEdit && pendingEditId
        ? await updateInvoiceConfirmedAction(pendingEditId, pendingFormData, returnPath)
        : await createInvoiceConfirmedAction(pendingFormData, returnPath);

      if ("error" in result && result.error) {
        setGeneralError(formatActionError(result.error, t, isEdit));
      }
      setLimitWarning(null);
      setPendingEditId(null);
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setGeneralError(isEdit ? t("invoices.updateFailed") : t("invoices.createFailed"));
      setLimitWarning(null);
      setPendingEditId(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageContent
      title={isEdit ? t("invoices.editTitle") : t("invoices.newTitle")}
      extra={
        <PageHeaderActions
          secondary={
            <SecondaryButton
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push(returnPath)}
            >
              {t("common.back")}
            </SecondaryButton>
          }
          primary={
            <PrimaryButton
              icon={<SaveOutlined />}
              loading={isSubmitting}
              onClick={() => form.submit()}
            >
              {t("invoices.saveInvoice")}
            </PrimaryButton>
          }
        />
      }
    >
    <PageStack>
      {generalError && (
        <Alert type="error" title={generalError} showIcon closable onClose={() => setGeneralError(null)} />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={() => message.error(t("common.validationFailed"))}
        onValuesChange={handleValuesChange}
        initialValues={
          isEdit && initialInvoice
            ? {
                invoiceNumber: initialInvoice.invoiceNumber,
                clientId: initialInvoice.clientId ?? undefined,
                status: initialInvoice.status,
                issueDate: dayjs(initialInvoice.issueDate),
                dueDate: initialInvoice.dueDate ? dayjs(initialInvoice.dueDate) : null,
                paymentDate: initialInvoice.paymentDate ? dayjs(initialInvoice.paymentDate) : null,
                billableHours: initialInvoice.billableHours ?? undefined,
                originalAmount: initialInvoice.originalAmount,
                currency: initialInvoice.currency,
                includeInLimit: initialInvoice.includeInLimit,
                notes: initialInvoice.notes ?? undefined,
              }
            : {
                currency: "RSD",
                status: "DRAFT",
                includeInLimit: true,
                issueDate: dayjs(),
                invoiceNumber: suggestedInvoiceNumber ?? "",
              }
        }
      >
        <BentoGrid>
        <BentoCell lg={6}>
            <Card title={t("invoices.sectionIdentity")}>
              <Form.Item
                name="invoiceNumber"
                label={t("invoices.invoiceNumber")}
                rules={[
                  { required: true, message: t("invoices.ruleInvoiceNumber") },
                  { max: 50, message: t("invoices.ruleMaxLength") },
                ]}
              >
                <Input
                  placeholder={t("invoices.placeholderInvoiceNumber")}
                  onChange={() => {
                    invoiceNumberEdited.current = true;
                  }}
                />
              </Form.Item>

              <Form.Item
                name="clientId"
                label={t("common.client")}
                rules={[{ required: true, message: t("invoices.ruleSelectClient") }]}
              >
                <Select
                  showSearch
                  placeholder={t("invoices.placeholderSelectClient")}
                  options={clientList.map((c) => ({ value: c.id, label: c.displayName }))}
                  onChange={(value) => handleClientChange(value)}
                  onSearch={setClientSearch}
                  filterOption={(input, option) =>
                    (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  notFoundContent={
                    clientSearchTrimmed && !hasClientSearchMatch ? (
                      <div style={{ padding: token.paddingSM }}>
                        <TextButton
                          type="link"
                          icon={<PlusOutlined />}
                          style={{ padding: 0, height: "auto" }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openAddClientDrawer(clientSearchTrimmed)}
                        >
                          {t("invoices.addClientNamed", { name: clientSearchTrimmed })}
                        </TextButton>
                      </div>
                    ) : null
                  }
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: `${token.marginXS}px 0` }} />
                      <div style={{ padding: `0 ${token.paddingXS}px ${token.paddingXS}px` }}>
                        <TextButton
                          type="link"
                          icon={<PlusOutlined />}
                          style={{ padding: 0, height: "auto" }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => openAddClientDrawer()}
                        >
                          {t("invoices.addNewClient")}
                        </TextButton>
                      </div>
                    </>
                  )}
                />
              </Form.Item>

              <Form.Item name="status" label={t("common.status")}>
                <Select options={STATUS_OPTIONS} />
              </Form.Item>

              <Form.Item name="notes" label={t("common.notes")}>
                <Input.TextArea rows={2} maxLength={2000} />
              </Form.Item>
            </Card>
        </BentoCell>

        <BentoCell lg={6}>
            <Card title={t("invoices.sectionDates")}>
              <Form.Item
                name="issueDate"
                label={t("common.issueDate")}
                rules={[{ required: true, message: t("invoices.ruleIssueDate") }]}
              >
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item name="dueDate" label={t("invoices.dueDate")}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item name="paymentDate" label={t("common.paymentDate")}>
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Card>
        </BentoCell>

        <BentoCell span={12}>
        <Card title={t("invoices.sectionAmounts")}>
          {isHourlyClient && selectedClient?.hourlyRate && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: token.marginMD }}
              title={
                <Text style={{ fontSize: token.fontSize }}>
                  {t("invoice.dailyClientHintPrefix")}{" "}
                  <Text strong style={{ color: token.colorSuccess }}>
                    {formatCurrency(
                      selectedClient.hourlyRate,
                      selectedClient.hourlyCurrency ?? "EUR"
                    )}{" "}
                    / h
                  </Text>
                  {t("invoice.dailyClientHintSuffix")}
                </Text>
              }
            />
          )}
          <Row gutter={token.marginMD}>
            {isHourlyClient && (
              <Col xs={24} md={8}>
                <Form.Item
                  name="billableHours"
                  label={t("invoice.billableDays")}
                  rules={[
                    { required: true, message: t("common.required") },
                    {
                      validator: (_, v) =>
                        v && parseFloat(v) > 0 ? Promise.resolve() : Promise.reject(t("invoices.rulePositive")),
                    },
                  ]}
                >
                  <Input type="number" min="0.5" step="0.5" placeholder={t("invoices.placeholderAmount")} />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={isHourlyClient ? 8 : 12}>
              <Form.Item
                name="originalAmount"
                label={t("invoices.invoiceAmount")}
                rules={[
                  { required: true, message: t("invoices.ruleAmount") },
                  {
                    validator: (_, v) =>
                      v && parseFloat(v) > 0 ? Promise.resolve() : Promise.reject(t("invoices.rulePositive")),
                  },
                ]}
              >
                <Input type="number" min="0.01" step="0.01" placeholder={t("invoices.placeholderAmount")} />
              </Form.Item>
            </Col>
            <Col xs={24} md={isHourlyClient ? 8 : 12}>
              <Form.Item name="currency" label={t("common.currency")}>
                <Select
                  options={currencySelectOptions(CURRENCIES)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Rate preview */}
          {rateLoading && (
            <div style={{ textAlign: "center", padding: token.paddingMD }}>
              <Spin description={t("invoices.rateFetching")} />
            </div>
          )}

          {rateError && (
            <Alert
              type="error"
              title={t("invoices.rateFetchFailed")}
              description={rateError}
              showIcon
              action={
                <Space orientation="vertical">
                  <SecondaryButton
                    onClick={() => fetchRate(formValues.currency, formValues.issueDate)}
                  >
                    {t("invoices.retry")}
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setUseManualRate(true)}>
                    {t("invoices.enterManually")}
                  </SecondaryButton>
                </Space>
              }
            />
          )}

          {ratePreview && !rateLoading && formValues.originalAmount && parseFloat(formValues.originalAmount) > 0 && (
            <ExchangeRateDisplay
              currency={ratePreview.currency}
              originalAmount={formValues.originalAmount}
              ratePerUnit={useManualRate && manualRate ? manualRate : ratePreview.ratePerUnit}
              rsdAmount={
                useManualRate && manualRate
                  ? String(parseFloat(formValues.originalAmount) * parseFloat(manualRate))
                  : rsdAmount
              }
              effectiveDate={ratePreview.effectiveDate}
              requestedDate={ratePreview.requestedDate}
              source={useManualRate ? "MANUAL_OVERRIDE" : ratePreview.source}
              sourceUrl={ratePreview.sourceUrl}
              isFallback={!useManualRate && ratePreview.isFallback}
              fallbackReason={ratePreview.fallbackReason}
              manualOverride={useManualRate}
              overrideReason={manualRateReason}
            />
          )}

          {/* Manual override */}
          <Divider style={{ margin: `${token.marginSM}px 0` }} />
          <Space align="center">
            <Switch
              checked={useManualRate}
              onChange={setUseManualRate}
            />
            <Text style={{ fontSize: token.fontSizeSM }}>{t("invoices.manualOverride")}</Text>
          </Space>

          {useManualRate && (
            <Row gutter={token.marginSM} style={{ marginTop: token.marginSM }}>
              <Col xs={24} sm={12}>
                <Form.Item label={t("invoices.ratePerUnit", { currency: formValues.currency })}>
                  <Input
                    type="number"
                    step="0.0001"
                    value={manualRate}
                    onChange={(e) => setManualRate(e.target.value)}
                    placeholder={t("invoices.placeholderRate")}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label={t("invoices.overrideReason")}>
                  <Input
                    value={manualRateReason}
                    onChange={(e) => setManualRateReason(e.target.value)}
                    placeholder={t("invoices.placeholderOverrideReason")}
                    minLength={10}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}
        </Card>
        </BentoCell>

        <BentoCell span={12}>
        <Card title={t("invoices.sectionSettings")}>
          <Flex align="center" justify="space-between" gap={token.marginMD}>
            <Text>{t("invoices.includeInLimit")}</Text>
            <Form.Item name="includeInLimit" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </Flex>
        </Card>
        </BentoCell>
        </BentoGrid>
      </Form>

      {/* Blocking limit warning modal */}
      <Modal
        open={!!limitWarning}
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: token.colorError }} />
            {t("invoices.limitModalTitle")}
          </Space>
        }
        onOk={handleConfirmedSubmit}
        onCancel={() => setLimitWarning(null)}
        okText={t("invoices.limitModalConfirm")}
        okButtonProps={{ danger: true, loading: isSubmitting, size: APP_CONTROL_SIZE }}
        cancelButtonProps={{ size: APP_CONTROL_SIZE }}
        cancelText={t("invoices.limitModalBack")}
        width={isMobile ? "100%" : 520}
        style={isMobile ? { maxWidth: "calc(100vw - 16px)", top: 8 } : undefined}
      >
        {limitWarning && (
          <Space orientation="vertical" style={{ width: "100%" }}>
            <Alert
              type="error"
              showIcon
              title={t("invoices.limitModalTitle")}
            />
            <Row gutter={[token.marginMD, token.marginMD]}>
              <Col xs={14} sm={12}>
                <Text type="secondary">{t("invoices.limitCurrentYtd")}</Text>
              </Col>
              <Col xs={10} sm={12} style={{ textAlign: "right" }}>
                <Text>{formatRsd(limitWarning.currentActual)}</Text>
              </Col>
              <Col xs={14} sm={12}>
                <Text type="secondary">{t("invoices.limitThisInvoice")}</Text>
              </Col>
              <Col xs={10} sm={12} style={{ textAlign: "right" }}>
                <Text>{formatRsd(limitWarning.newAmount)}</Text>
              </Col>
              <Col xs={14} sm={12}>
                <Text type="secondary">{t("invoices.limitNewTotal")}</Text>
              </Col>
              <Col xs={10} sm={12} style={{ textAlign: "right" }}>
                <Text strong style={{ color: token.colorError }}>
                  {formatRsd(limitWarning.newTotal)}
                </Text>
              </Col>
              <Col xs={14} sm={12}>
                <Text type="secondary">{t("invoices.limitAnnual")}</Text>
              </Col>
              <Col xs={10} sm={12} style={{ textAlign: "right" }}>
                <Text>{formatRsd(limitWarning.threshold)}</Text>
              </Col>
              <Col xs={14} sm={12}>
                <Text type="secondary">{t("invoices.limitOverBy")}</Text>
              </Col>
              <Col xs={10} sm={12} style={{ textAlign: "right" }}>
                <Text style={{ color: token.colorError }}>
                  {formatRsd(limitWarning.overage)} ({formatPercent(limitWarning.percentUsed - 100, 2)})
                </Text>
              </Col>
            </Row>
            <Alert
              type="warning"
              title={t("invoices.limitDisclaimer")}
            />
          </Space>
        )}
      </Modal>

      <ClientFormDrawer
        open={clientDrawerOpen}
        onClose={() => setClientDrawerOpen(false)}
        initialDisplayName={clientDrawerPrefill}
        onSuccess={handleClientCreated}
      />
    </PageStack>
    </PageContent>
  );
}
