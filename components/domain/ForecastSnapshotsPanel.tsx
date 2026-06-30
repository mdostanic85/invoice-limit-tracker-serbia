"use client";

import {
  App,
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  theme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppDrawer } from "@/components/layout/AppDrawer";
import { SecondaryButton } from "@/components/layout/AppButton";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useFormat } from "@/lib/i18n/use-format";
import { forecastScenarioLabel } from "@/lib/i18n/helpers";
import {
  deleteForecastSnapshotAction,
  getForecastSnapshotAction,
  loadForecastSnapshotAction,
  saveForecastSnapshotAction,
} from "@/app/actions/forecast-snapshot-actions";
import {
  FORECAST_SCENARIOS,
  type ForecastScenario,
} from "@/lib/constants/forecast";
import type {
  ForecastSnapshotData,
  ForecastSnapshotMonthCell,
  ForecastSnapshotSummary,
} from "@/lib/domain/forecast-snapshot";

const { Text } = Typography;
const { useToken } = theme;

const SCENARIO_COLORS: Record<ForecastScenario, string> = {
  CONSERVATIVE: "blue",
  EXPECTED: "green",
  OPTIMISTIC: "purple",
};

interface MonthlyPlanCell {
  originalAmount: string;
  currency: string;
}

interface Props {
  year: number;
  monthKeys: string[];
  monthLabels: string[];
  monthlyPlan: Record<ForecastScenario, Record<string, MonthlyPlanCell>>;
  draftPlans: Record<ForecastScenario, Record<string, MonthlyPlanCell>>;
  snapshots: ForecastSnapshotSummary[];
}

function mergePlanForSave(
  monthlyPlan: Props["monthlyPlan"],
  draftPlans: Props["draftPlans"],
  monthKeys: string[]
): Record<ForecastScenario, Record<string, ForecastSnapshotMonthCell>> {
  const merged = {
    CONSERVATIVE: {} as Record<string, ForecastSnapshotMonthCell>,
    EXPECTED: {} as Record<string, ForecastSnapshotMonthCell>,
    OPTIMISTIC: {} as Record<string, ForecastSnapshotMonthCell>,
  };

  for (const scenario of FORECAST_SCENARIOS) {
    for (const monthKey of monthKeys) {
      const draft = draftPlans[scenario][monthKey];
      const saved = monthlyPlan[scenario][monthKey];
      const cell = draft ?? saved ?? { originalAmount: "0", currency: "RSD" };
      merged[scenario][monthKey] = {
        originalAmount: cell.originalAmount || "0",
        currency: cell.currency || "RSD",
      };
    }
  }

  return merged;
}

function SnapshotPlanTable({
  data,
  monthKeys,
  monthLabels,
}: {
  data: ForecastSnapshotData;
  monthKeys: string[];
  monthLabels: string[];
}) {
  const { token } = useToken();
  const { t } = useLocale();
  const { formatRsd } = useFormat();

  const rows = monthKeys.map((monthKey, index) => ({
    key: monthKey,
    monthLabel: monthLabels[index] ?? monthKey,
    plans: FORECAST_SCENARIOS.reduce(
      (acc, scenario) => {
        acc[scenario] = data.monthlyPlan[scenario][monthKey] ?? {
          originalAmount: "0",
          currency: "RSD",
        };
        return acc;
      },
      {} as Record<ForecastScenario, ForecastSnapshotMonthCell>
    ),
  }));

  const columns: ColumnsType<(typeof rows)[number]> = [
    {
      title: t("forecast.columnMonth"),
      key: "month",
      width: 120,
      fixed: "left",
      render: (_: unknown, row) => <Text strong>{row.monthLabel}</Text>,
    },
    ...FORECAST_SCENARIOS.map((scenario) => ({
      title: (
        <Tag color={SCENARIO_COLORS[scenario]} style={{ marginInlineEnd: 0 }}>
          {forecastScenarioLabel(t, scenario)}
        </Tag>
      ),
      key: scenario,
      width: 160,
      render: (_: unknown, row: (typeof rows)[number]) => {
        const cell = row.plans[scenario];
        const amount = Number(cell.originalAmount || 0);
        if (amount <= 0) {
          return <Text type="secondary">{t("common.dash")}</Text>;
        }
        return (
          <Flex vertical gap={2}>
            <Text>
              {amount.toLocaleString("sr-RS", { maximumFractionDigits: 2 })}{" "}
              {cell.currency}
            </Text>
            {cell.currency !== "RSD" ? (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t("forecast.snapshotForeignAmount")}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {formatRsd(amount)}
              </Text>
            )}
          </Flex>
        );
      },
    })),
  ];

  return (
    <Table
      size="small"
      dataSource={rows}
      columns={columns}
      pagination={false}
      scroll={{ x: 680 }}
    />
  );
}

export function ForecastSnapshotsPanel({
  year,
  monthKeys,
  monthLabels,
  monthlyPlan,
  draftPlans,
  snapshots,
}: Props) {
  const { token } = useToken();
  const { t } = useLocale();
  const { formatDateTime } = useFormat();
  const router = useRouter();
  const { modal, message } = App.useApp();
  const [isPending, startTransition] = useTransition();
  const [listOpen, setListOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewSnapshot, setViewSnapshot] = useState<{
    name: string;
    description: string | null;
    data: ForecastSnapshotData;
    updatedAt: string;
  } | null>(null);
  const [saveForm] = Form.useForm<{ name: string; description?: string }>();

  const snapshotCount = snapshots.length;

  function handleView(id: string) {
    startTransition(async () => {
      const result = await getForecastSnapshotAction(id);
      if (result.error || !result.data) {
        message.error(t("forecast.snapshotError"));
        return;
      }
      setViewSnapshot({
        name: result.data.name,
        description: result.data.description,
        data: result.data.data,
        updatedAt: String(result.data.updatedAt),
      });
      setViewOpen(true);
    });
  }

  function handleLoad(snapshot: ForecastSnapshotSummary) {
    modal.confirm({
      title: t("forecast.snapshotLoadConfirmTitle"),
      content: t("forecast.snapshotLoadConfirm", { name: snapshot.name }),
      okText: t("forecast.snapshotLoad"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await loadForecastSnapshotAction(snapshot.id);
        if (result.error) {
          message.error(t("forecast.snapshotError"));
          return;
        }
        message.success(t("forecast.snapshotLoaded", { name: snapshot.name }));
        setListOpen(false);
        router.refresh();
      },
    });
  }

  function handleDelete(snapshot: ForecastSnapshotSummary) {
    modal.confirm({
      title: t("forecast.snapshotDeleteConfirmTitle"),
      content: t("forecast.snapshotDeleteConfirm", { name: snapshot.name }),
      okText: t("common.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        const result = await deleteForecastSnapshotAction(snapshot.id);
        if (result.error) {
          message.error(t("forecast.snapshotError"));
          return;
        }
        message.success(t("forecast.snapshotDeleted", { name: snapshot.name }));
        router.refresh();
      },
    });
  }

  const listColumns: ColumnsType<ForecastSnapshotSummary> = [
      {
        title: t("forecast.snapshotName"),
        dataIndex: "name",
        key: "name",
        ellipsis: true,
      },
      {
        title: t("forecast.snapshotUpdated"),
        key: "updatedAt",
        width: 170,
        render: (_: unknown, row) => formatDateTime(row.updatedAt),
      },
      {
        title: t("common.actions"),
        key: "actions",
        width: 220,
        render: (_: unknown, row) => (
          <Space size="small" wrap>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(row.id)}
              loading={isPending}
            >
              {t("forecast.snapshotView")}
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<FolderOpenOutlined />}
              onClick={() => handleLoad(row)}
              loading={isPending}
            >
              {t("forecast.snapshotLoad")}
            </Button>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(row)}
              loading={isPending}
            />
          </Space>
        ),
      },
  ];

  function handleSave() {
    saveForm.validateFields().then((values) => {
      startTransition(async () => {
        const result = await saveForecastSnapshotAction({
          name: values.name,
          year,
          description: values.description,
          monthlyPlan: mergePlanForSave(monthlyPlan, draftPlans, monthKeys),
        });

        if (result.error === "SNAPSHOT_NAME_REQUIRED") {
          message.error(t("forecast.snapshotNameRequired"));
          return;
        }
        if (result.error) {
          message.error(t("forecast.snapshotError"));
          return;
        }

        message.success(t("forecast.snapshotSaved", { name: values.name.trim() }));
        setSaveOpen(false);
        saveForm.resetFields();
        router.refresh();
      });
    });
  }

  return (
    <>
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={token.marginSM}
        style={{
          padding: `${token.paddingSM}px ${token.paddingMD}px`,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
        }}
      >
        <Flex vertical gap={2}>
          <Text strong>{t("forecast.snapshotsTitle")}</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
            {snapshotCount > 0
              ? t("forecast.snapshotsCount", { count: String(snapshotCount) })
              : t("forecast.snapshotsEmptyHint")}
          </Text>
        </Flex>
        <Space wrap>
          <SecondaryButton icon={<FolderOpenOutlined />} onClick={() => setListOpen(true)}>
            {t("forecast.snapshotsManage")}
          </SecondaryButton>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>
            {t("forecast.snapshotSave")}
          </Button>
        </Space>
      </Flex>

      <Modal
        title={t("forecast.snapshotSaveTitle")}
        open={saveOpen}
        onCancel={() => {
          setSaveOpen(false);
          saveForm.resetFields();
        }}
        onOk={handleSave}
        okText={t("forecast.snapshotSave")}
        cancelText={t("common.cancel")}
        confirmLoading={isPending}
        destroyOnHidden
      >
        <Form form={saveForm} layout="vertical" style={{ marginTop: token.marginSM }}>
          <Form.Item
            name="name"
            label={t("forecast.snapshotName")}
            rules={[{ required: true, message: t("forecast.snapshotNameRequired") }]}
          >
            <Input maxLength={80} placeholder={t("forecast.snapshotNamePlaceholder")} />
          </Form.Item>
          <Form.Item name="description" label={t("forecast.snapshotDescription")}>
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder={t("forecast.snapshotDescriptionPlaceholder")}
            />
          </Form.Item>
        </Form>
      </Modal>

      <AppDrawer
        title={t("forecast.snapshotsManage")}
        open={listOpen}
        onClose={() => setListOpen(false)}
        size={760}
        showPrimary={false}
        cancelText={t("common.back")}
      >
        {snapshots.length === 0 ? (
          <Empty description={t("forecast.snapshotsListEmpty")} />
        ) : (
          <Table
            size="small"
            rowKey="id"
            dataSource={snapshots}
            columns={listColumns}
            pagination={false}
          />
        )}
      </AppDrawer>

      <AppDrawer
        title={viewSnapshot?.name ?? t("forecast.snapshotView")}
        open={viewOpen}
        onClose={() => {
          setViewOpen(false);
          setViewSnapshot(null);
        }}
        size={900}
        showPrimary={false}
        cancelText={t("common.back")}
      >
        {viewSnapshot ? (
          <Flex vertical gap={token.marginMD}>
            {viewSnapshot.description ? (
              <Text type="secondary">{viewSnapshot.description}</Text>
            ) : null}
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {t("forecast.snapshotViewMeta", {
                date: formatDateTime(viewSnapshot.updatedAt),
              })}
            </Text>
            <SnapshotPlanTable
              data={viewSnapshot.data}
              monthKeys={monthKeys}
              monthLabels={monthLabels}
            />
          </Flex>
        ) : null}
      </AppDrawer>
    </>
  );
}
