"use client";

import { useState, useTransition } from "react";
import {
  Card,
  Typography,
  Form,
  Input,
  Alert,
  Steps,
  Modal,
  Space,
  theme,
} from "antd";
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { createOrganizationAction, acceptDisclaimerAction } from "@/app/actions/org-actions";
import { PrimaryButton, APP_CONTROL_SIZE } from "@/components/layout/AppButton";
import { CountryLimitFormFields } from "@/components/domain/CountryLimitFormFields";
import { getCountryFormDefaults } from "@/lib/domain/country-tax-rules";
import { LocaleProvider, useLocale } from "@/components/providers/LocaleProvider";

const { Title, Paragraph, Text } = Typography;
const { useToken } = theme;

function OnboardingContent() {
  const { token } = useToken();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startStep = searchParams.get("step") === "disclaimer" ? 1 : 0;
  const currentStep = startStep;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [orgData, setOrgData] = useState<Record<string, string> | null>(null);
  const [form] = Form.useForm();

  const handleOrgSubmit = (values: Record<string, string>) => {
    setOrgData(values);
    setDisclaimerOpen(true);
  };

  const handleAcceptDisclaimer = () => {
    if (!orgData && currentStep === 0) return;

    startTransition(async () => {
      setError(null);
      try {
        if (orgData) {
          const result = await createOrganizationAction(orgData);
          if ("error" in result && result.error) {
            setError(typeof result.error === "string" ? result.error : t("onboarding.setupFailed"));
            setDisclaimerOpen(false);
            return;
          }
        }

        await acceptDisclaimerAction();
        setDisclaimerOpen(false);
        router.push("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : t("onboarding.errorOccurred"));
        setDisclaimerOpen(false);
      }
    });
  };

  const handleDisclaimerOnly = () => {
    startTransition(async () => {
      await acceptDisclaimerAction();
      router.push("/dashboard");
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: token.colorBgLayout,
        padding: token.paddingLG,
      }}
    >
      <Card
        style={{ width: "100%", maxWidth: 560 }}
        styles={{ body: { padding: token.paddingXL ?? token.paddingLG } }}
      >
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <Title level={3} style={{ marginBottom: token.marginXS }}>
              {t("onboarding.title")}
            </Title>
            <Text type="secondary">
              {t("onboarding.subtitle")}
            </Text>
          </div>

          <Steps
            current={currentStep}
            items={[
              { title: t("onboarding.stepOrg"), icon: <InfoCircleOutlined /> },
              { title: t("onboarding.stepDisclaimer"), icon: <CheckCircleOutlined /> },
            ]}
          />

          {error && (
            <Alert type="error" title={error} showIcon closable onClose={() => setError(null)} />
          )}

          {currentStep === 0 && (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleOrgSubmit}
              initialValues={{
                ...getCountryFormDefaults("RS"),
              }}
            >
              <Form.Item
                name="name"
                label={t("onboarding.orgName")}
                rules={[{ required: true, message: t("common.required") }]}
              >
                <Input placeholder={t("onboarding.placeholderOrg")} />
              </Form.Item>

              <CountryLimitFormFields form={form} />

              <Alert
                type="info"
                showIcon
                style={{ marginBottom: token.marginMD }}
                title={t("onboarding.infoAlert")}
                description={t("onboarding.infoDescription")}
              />

              <PrimaryButton htmlType="submit" block loading={isPending}>
                {t("onboarding.continue")}
              </PrimaryButton>
            </Form>
          )}

          {currentStep === 1 && (
            <Space orientation="vertical" style={{ width: "100%" }}>
              <Alert
                type="warning"
                showIcon
                title={t("onboarding.acknowledgmentRequired")}
                description={t("onboarding.acknowledgmentDescription")}
              />
              <PrimaryButton block onClick={handleDisclaimerOnly} loading={isPending}>
                {t("onboarding.acceptAndContinue")}
              </PrimaryButton>
            </Space>
          )}
        </Space>
      </Card>

      <Modal
        open={disclaimerOpen}
        title={t("onboarding.modalTitle")}
        onOk={handleAcceptDisclaimer}
        onCancel={() => setDisclaimerOpen(false)}
        okText={t("onboarding.modalAccept")}
        cancelText={t("onboarding.modalBack")}
        confirmLoading={isPending}
        okButtonProps={{ size: APP_CONTROL_SIZE }}
        cancelButtonProps={{ size: APP_CONTROL_SIZE }}
        width={560}
      >
        <Space orientation="vertical">
          <Paragraph>{t("onboarding.modalP1")}</Paragraph>
          <Paragraph>{t("onboarding.modalP2")}</Paragraph>
          <Paragraph>{t("onboarding.modalP3")}</Paragraph>
          <Paragraph type="secondary">{t("onboarding.modalP4")}</Paragraph>
        </Space>
      </Modal>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <LocaleProvider initialLocale="EN">
      <OnboardingContent />
    </LocaleProvider>
  );
}
