"use client";

import { Form, Input, Select, Alert, Typography, type FormInstance } from "antd";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  getCountryFormDefaults,
  getCountryTaxProfile,
  getTaxTier,
} from "@/lib/domain/country-tax-rules";
import { COUNTRY_OPTIONS, TIMEZONE_OPTIONS, PRIMARY_CURRENCY_OPTIONS } from "@/lib/constants/currencies";
import { formatCurrency } from "@/lib/utils/format";

const { Text } = Typography;

interface Props {
  form: FormInstance;
  showCountrySelect?: boolean;
  /** When false, tax tier and annual limit fields are omitted (managed elsewhere). */
  showLimitFields?: boolean;
}

export function applyCountryTaxDefaults(form: FormInstance, countryCode: string, tierId?: string | null) {
  const defaults = getCountryFormDefaults(countryCode, tierId);
  form.setFieldsValue({
    countryCode: defaults.countryCode,
    timezone: defaults.timezone,
    primaryCurrency: defaults.primaryCurrency,
    taxLimitTierId: defaults.taxLimitTierId,
    annualThresholdRsd: defaults.annualThresholdRsd,
  });
}

export function CountryLimitFormFields({
  form,
  showCountrySelect = true,
  showLimitFields = true,
}: Props) {
  const { t } = useLocale();
  const countryCode = Form.useWatch("countryCode", form) ?? "RS";
  const tierId = Form.useWatch("taxLimitTierId", form);
  const profile = getCountryTaxProfile(countryCode);
  const tier = getTaxTier(profile, tierId);

  function handleCountryChange(code: string) {
    applyCountryTaxDefaults(form, code);
  }

  function handleTierChange(id: string) {
    applyCountryTaxDefaults(form, countryCode, id);
  }

  return (
    <>
      {showCountrySelect && (
        <Form.Item name="countryCode" label={t("domain.country")} rules={[{ required: true }]}>
          <Select options={COUNTRY_OPTIONS} onChange={handleCountryChange} />
        </Form.Item>
      )}

      <Form.Item name="timezone" label={t("domain.timezone")}>
        <Select options={TIMEZONE_OPTIONS} />
      </Form.Item>

      <Form.Item name="primaryCurrency" label={t("domain.primaryCurrency")}>
        <Select options={PRIMARY_CURRENCY_OPTIONS} />
      </Form.Item>

      {showLimitFields && (
        <>
          {profile.useTierSelector ? (
            <Form.Item
              name="taxLimitTierId"
              label={t("domain.categoryLabel", { regime: profile.regimeName })}
              rules={[{ required: true, message: t("domain.selectTaxCategory") }]}
            >
              <Select
                options={profile.tiers.map((tierOption) => ({
                  value: tierOption.id,
                  label: `${tierOption.label} — ${formatCurrency(tierOption.annualLimit, profile.limitCurrency)}`,
                }))}
                onChange={handleTierChange}
              />
            </Form.Item>
          ) : (
            <Form.Item name="taxLimitTierId" hidden>
              <Input />
            </Form.Item>
          )}

          <Form.Item
            name="annualThresholdRsd"
            label={t("domain.annualLimitGross", { currency: profile.limitCurrency })}
            tooltip={profile.legalReference}
            rules={[{ required: true }]}
          >
            {profile.customThresholdAllowed ? (
              <Input type="number" min="0.01" step="0.01" suffix={profile.limitCurrency} />
            ) : (
              <Input readOnly suffix={profile.limitCurrency} />
            )}
          </Form.Item>

          <Alert
            type="info"
            showIcon
            title={profile.regimeName}
            description={
              <Text type="secondary" style={{ fontSize: 12 }}>
                {profile.legalReference}
                {tier?.description ? ` ${tier.description}` : ""}
                {profile.effectiveFrom
                  ? t("domain.effectiveFromSuffix", { date: profile.effectiveFrom })
                  : ""}
                {t("domain.informationalOnly")}
              </Text>
            }
            style={{ marginBottom: 16 }}
          />
        </>
      )}
    </>
  );
}
