"use client";

import {
  Alert,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Tag,
  Typography,
  Upload,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  InboxOutlined,
  LoadingOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import dayjs from "dayjs";
import { PageContent } from "@/components/layout/PageContent";
import { PageHeaderActions } from "@/components/layout/PageHeaderActions";
import { PrimaryButton, SecondaryButton, TextButton } from "@/components/layout/AppButton";
import { useLocale } from "@/components/providers/LocaleProvider";
import { invoiceStatusLabel } from "@/lib/i18n/helpers";
import type { Translator } from "@/lib/i18n/types";
import {
  extractInvoiceFromPdfAction,
  confirmInvoiceImportAction,
} from "@/app/actions/import-actions";
import {
  INVOICE_CURRENCIES,
  currencySelectOptions,
} from "@/lib/constants/currencies";

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;
const { useToken } = theme;

interface Client {
  id: string;
  displayName: string;
}

interface ExtractedData {
  extracted: {
    invoiceNumber: string | null;
    issueDate: string | null;
    dueDate: string | null;
    paymentDate: string | null;
    originalAmount: string | null;
    currency: string | null;
    status: string | null;
    clientDisplayName: string | null;
    clientLegalName: string | null;
    clientTaxId: string | null;
    clientEmail: string | null;
    clientCountryCode: string | null;
    notes: string | null;
    confidence: "high" | "medium" | "low";
    extractionNotes: string | null;
  };
  clientMatch: {
    clientId: string | null;
    score: number;
    matchedName: string | null;
  };
  clients: Client[];
  duplicateInvoice: { id: string; invoiceNumber: string } | null;
  fileName: string;
}

interface Props {
  clients: Client[];
}

function formatActionError(error: unknown, t: Translator): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "formErrors" in error) {
    const flat = error as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const fieldMsg = Object.values(flat.fieldErrors ?? {})
      .flat()
      .find(Boolean);
    return fieldMsg ?? flat.formErrors?.[0] ?? t("common.validationFailed");
  }
  return t("common.error");
}

function confidenceColor(c: string) {
  if (c === "high") return "green";
  if (c === "medium") return "gold";
  return "red";
}

export function ImportInvoiceClient({ clients }: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const router = useRouter();
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractResult, setExtractResult] = useState<ExtractedData | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [createNewClient, setCreateNewClient] = useState(false);

  const STATUS_OPTIONS = [
    { value: "DRAFT", label: invoiceStatusLabel(t, "DRAFT") },
    { value: "ISSUED", label: invoiceStatusLabel(t, "ISSUED") },
    { value: "PAID", label: invoiceStatusLabel(t, "PAID") },
  ];

  function applyExtractedToForm(data: ExtractedData) {
    const { extracted, clientMatch } = data;
    const useNewClient = !clientMatch.clientId && Boolean(extracted.clientDisplayName);
    setCreateNewClient(useNewClient);

    form.setFieldsValue({
      invoiceNumber: extracted.invoiceNumber ?? "",
      issueDate: extracted.issueDate ? dayjs(extracted.issueDate) : undefined,
      dueDate: extracted.dueDate ? dayjs(extracted.dueDate) : undefined,
      paymentDate: extracted.paymentDate ? dayjs(extracted.paymentDate) : undefined,
      originalAmount: extracted.originalAmount ?? "",
      currency: extracted.currency ?? "EUR",
      status: extracted.status ?? "ISSUED",
      includeInLimit: true,
      notes: extracted.notes ?? "",
      clientId: clientMatch.clientId ?? undefined,
      newClientDisplayName: extracted.clientDisplayName ?? "",
      newClientLegalName: extracted.clientLegalName ?? "",
      newClientTaxId: extracted.clientTaxId ?? "",
      newClientEmail: extracted.clientEmail ?? "",
      newClientCountryCode: extracted.clientCountryCode ?? undefined,
    });
  }

  function handleExtract(file: File) {
    setPdfFile(file);
    setExtractError(null);
    setExtractResult(null);

    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      const result = await extractInvoiceFromPdfAction(fd);
      if ("error" in result && result.error) {
        setExtractError(formatActionError(result.error, t));
        return;
      }

      const data = result.data as ExtractedData;
      setExtractResult(data);
      applyExtractedToForm(data);
      setStep(1);
    });
  }

  function handleImport() {
    form.validateFields().then((values) => {
      if (!pdfFile) return;

      const payload = {
        invoiceNumber: values.invoiceNumber,
        clientId: createNewClient ? undefined : values.clientId,
        createClient: createNewClient,
        newClient: createNewClient
          ? {
              displayName: values.newClientDisplayName,
              legalName: values.newClientLegalName || null,
              taxId: values.newClientTaxId || null,
              email: values.newClientEmail || null,
              countryCode: values.newClientCountryCode || null,
            }
          : undefined,
        issueDate: (values.issueDate as dayjs.Dayjs).format("YYYY-MM-DD"),
        dueDate: values.dueDate
          ? (values.dueDate as dayjs.Dayjs).format("YYYY-MM-DD")
          : null,
        paymentDate: values.paymentDate
          ? (values.paymentDate as dayjs.Dayjs).format("YYYY-MM-DD")
          : null,
        originalAmount: values.originalAmount,
        currency: values.currency,
        status: values.status,
        includeInLimit: values.includeInLimit,
        notes: values.notes || null,
      };

      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("payload", JSON.stringify(payload));

      startTransition(async () => {
        const result = await confirmInvoiceImportAction(fd);
        if ("error" in result && result.error) {
          form.setFields([
            {
              name: "invoiceNumber",
              errors: [formatActionError(result.error, t)],
            },
          ]);
          return;
        }
        router.push("/invoices");
        router.refresh();
      });
    });
  }

  return (
    <PageContent
      title={t("import.title")}
      extra={
        <PageHeaderActions
          secondary={
            <SecondaryButton
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/invoices")}
            >
              {t("import.backToInvoices")}
            </SecondaryButton>
          }
          primary={
            step === 1 ? (
              <PrimaryButton
                icon={<SaveOutlined />}
                loading={isPending}
                onClick={handleImport}
                disabled={Boolean(extractResult?.duplicateInvoice)}
              >
                {t("import.saveInvoice")}
              </PrimaryButton>
            ) : undefined
          }
        />
      }
    >
      <Steps
        current={step}
        items={[
          { title: t("import.stepUpload") },
          { title: t("import.stepReview") },
        ]}
        style={{ marginBottom: token.marginLG, maxWidth: 480 }}
      />

      {step === 0 && (
        <Card style={{ maxWidth: 640 }}>
          <Dragger
            accept=".pdf,application/pdf"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              handleExtract(file);
              return false;
            }}
            disabled={isPending}
          >
            <p className="ant-upload-drag-icon">
              {isPending ? <LoadingOutlined spin /> : <InboxOutlined />}
            </p>
            <p className="ant-upload-text">
              {isPending ? t("import.extracting") : t("import.uploadHint")}
            </p>
            <p className="ant-upload-hint">
              {t("import.uploadSubhint")} Max 10 MB. Requires{" "}
              <Text code>GOOGLE_GENERATIVE_AI_API_KEY</Text> or{" "}
              <Text code>OPENAI_API_KEY</Text>.
            </p>
          </Dragger>

          {extractError && (
            <Alert
              type="error"
              showIcon
              title={t("import.extractionFailed")}
              description={extractError}
              style={{ marginTop: token.marginMD }}
            />
          )}
        </Card>
      )}

      {step === 1 && extractResult && (
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <Alert
            type={extractResult.extracted.confidence === "low" ? "warning" : "info"}
            showIcon
            title={
              <Space>
                <span>{t("import.extractionComplete")}</span>
                <Tag color={confidenceColor(extractResult.extracted.confidence)}>
                  {t("import.confidence", { confidence: extractResult.extracted.confidence })}
                </Tag>
                <Tag icon={<FilePdfOutlined />}>{extractResult.fileName}</Tag>
              </Space>
            }
            description={extractResult.extracted.extractionNotes ?? t("import.uploadSubhint")}
          />

          {extractResult.duplicateInvoice && (
            <Alert
              type="warning"
              showIcon
              title={t("import.duplicateWarning")}
              description={t("import.duplicateWarning")}
            />
          )}

          {extractResult.clientMatch.clientId && !createNewClient && (
            <Alert
              type="success"
              showIcon
              title={t("import.matchedClient", {
                name: extractResult.clientMatch.matchedName ?? "",
              })}
            />
          )}

          <Card>
            <Form form={form} layout="vertical" requiredMark="optional">
              <Title level={5}>{t("import.sectionDetails")}</Title>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="invoiceNumber"
                    label={t("invoices.invoiceNumber")}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="issueDate"
                    label={t("common.issueDate")}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="status" label={t("common.status")}>
                    <Select options={STATUS_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="originalAmount"
                    label={t("common.amount")}
                    rules={[{ required: true, message: t("common.required") }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="currency"
                    label={t("common.currency")}
                    rules={[{ required: true }]}
                  >
                    <Select options={currencySelectOptions(INVOICE_CURRENCIES)} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="includeInLimit" label={t("import.countTowardLimit")} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="dueDate" label={t("invoices.dueDate")}>
                    <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="paymentDate" label={t("common.paymentDate")}>
                    <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="notes" label={t("common.notes")}>
                <Input.TextArea rows={2} />
              </Form.Item>

              <Divider />

              <Title level={5}>{t("import.sectionClient")}</Title>
              <Form.Item label={t("import.useExistingClient")}>
                <Switch
                  checked={!createNewClient}
                  onChange={(useExisting) => setCreateNewClient(!useExisting)}
                  checkedChildren={t("import.existing")}
                  unCheckedChildren={t("import.newClient")}
                />
              </Form.Item>

              {!createNewClient ? (
                <Form.Item
                  name="clientId"
                  label={t("common.client")}
                  rules={[{ required: true, message: t("invoices.ruleSelectClient") }]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={clients.map((c) => ({
                      value: c.id,
                      label: c.displayName,
                    }))}
                    placeholder={t("invoices.placeholderSelectClient")}
                  />
                </Form.Item>
              ) : (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="newClientDisplayName"
                      label={t("import.displayName")}
                      rules={[{ required: true, message: t("common.required") }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item name="newClientLegalName" label={t("import.legalName")}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="newClientTaxId" label={t("clients.taxId")}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="newClientEmail" label={t("clients.email")}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="newClientCountryCode" label={t("clients.country")}>
                      <Input maxLength={2} placeholder={t("clients.placeholderCountry")} />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <TextButton
                icon={<UploadOutlined />}
                onClick={() => {
                  setStep(0);
                  setExtractResult(null);
                  setPdfFile(null);
                  form.resetFields();
                }}
              >
                {t("import.uploadDifferent")}
              </TextButton>
            </Form>
          </Card>

          <Paragraph type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {t("import.footerNote")}
          </Paragraph>
        </Space>
      )}
    </PageContent>
  );
}
