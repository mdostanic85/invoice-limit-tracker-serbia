"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Upload, Image, Button, Space, Typography, App } from "antd";
import type { UploadProps } from "antd";
import { PictureOutlined, DeleteOutlined } from "@ant-design/icons";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  removeOrganizationLogoAction,
  uploadOrganizationLogoAction,
} from "@/app/actions/org-logo-actions";
import { MAX_LOGO_BYTES } from "@/lib/constants/org-logo";

const { Text } = Typography;

interface Props {
  logoUrl?: string | null;
  /** Pending file selected before organization exists (onboarding). */
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  /** When false, only preview/select — parent uploads later. */
  autoUpload?: boolean;
  disabled?: boolean;
}

export function OrganizationLogoUpload({
  logoUrl = null,
  pendingFile = null,
  onPendingFileChange,
  autoUpload = true,
  disabled = false,
}: Props) {
  const { t } = useLocale();
  const { message } = App.useApp();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoUrl);

  useEffect(() => {
    if (pendingFile) {
      const objectUrl = URL.createObjectURL(pendingFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(logoUrl);
  }, [logoUrl, pendingFile]);

  const uploadProps: UploadProps = {
    accept: "image/png,image/jpeg,.png,.jpg,.jpeg",
    showUploadList: false,
    disabled: disabled || isPending,
    beforeUpload: (file) => {
      if (file.size > MAX_LOGO_BYTES) {
        message.error(t("settings.logoTooLarge"));
        return Upload.LIST_IGNORE;
      }

      if (!autoUpload && onPendingFileChange) {
        onPendingFileChange(file);
        return Upload.LIST_IGNORE;
      }

      startTransition(async () => {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadOrganizationLogoAction(formData);
        if ("error" in result && result.error) {
          message.error(String(result.error));
          return;
        }
        if (result.data && typeof result.data === "object" && "logoUrl" in result.data) {
          setPreviewUrl(String((result.data as { logoUrl: string }).logoUrl));
        }
        message.success(t("settings.logoUploaded"));
        onPendingFileChange?.(null);
        router.refresh();
      });

      return Upload.LIST_IGNORE;
    },
  };

  function handleRemove() {
    if (!autoUpload) {
      onPendingFileChange?.(null);
      setPreviewUrl(logoUrl);
      return;
    }

    startTransition(async () => {
      const result = await removeOrganizationLogoAction();
      if ("error" in result && result.error) {
        message.error(String(result.error));
        return;
      }
      message.success(t("settings.logoRemoved"));
      onPendingFileChange?.(null);
      setPreviewUrl(null);
      router.refresh();
    });
  }

  const hasLogo = Boolean(previewUrl);

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {hasLogo ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            padding: 12,
            border: "1px solid var(--ant-color-border-secondary)",
            borderRadius: 8,
            background: "var(--ant-color-bg-container)",
          }}
        >
          <Image
            src={previewUrl ?? undefined}
            alt={t("settings.logoAlt")}
            preview={false}
            style={{ maxHeight: 64, maxWidth: 180, objectFit: "contain" }}
          />
          <Space orientation="vertical" size="small">
            <Upload {...uploadProps}>
              <Button icon={<PictureOutlined />} loading={isPending} disabled={disabled}>
                {t("settings.logoReplace")}
              </Button>
            </Upload>
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={handleRemove}
              loading={isPending}
              disabled={disabled}
            >
              {t("settings.logoRemove")}
            </Button>
          </Space>
        </div>
      ) : (
        <Upload.Dragger {...uploadProps} style={{ padding: "8px 0" }}>
          <p className="ant-upload-drag-icon">
            <PictureOutlined />
          </p>
          <p className="ant-upload-text">{t("settings.logoUploadHint")}</p>
          <p className="ant-upload-hint">{t("settings.logoUploadSubhint")}</p>
        </Upload.Dragger>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t("settings.logoFormatHint")}
      </Text>
    </Space>
  );
}
