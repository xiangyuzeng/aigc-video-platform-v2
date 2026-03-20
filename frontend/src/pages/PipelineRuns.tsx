import { useState } from 'react';
import {
  Typography,
  Table,
  Button,
  Tag,
  Space,
  Steps,
  Modal,
  Select,
  Radio,
  message,
  Card,
  Tooltip,
  Popconfirm,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listPipelineRuns,
  startPipeline,
  resumePipelineRun,
  cancelPipelineRun,
  deletePipelineRun,
  type PipelineRunData,
} from '../api/pipeline';
import { listProducts, type ProductData } from '../api/products';
import { getProfiles } from '../api/profiles';
import type { Profile } from '../api/profiles';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

// Pipeline stage names in order (must match backend pipeline_state.py stage keys)
const PIPELINE_STAGES = [
  { key: 'init', title: '初始化' },
  { key: 'content_generation', title: '文案生成' },
  { key: 'script_generation', title: '脚本生成' },
  { key: 'image_generation', title: '图片生成' },
  { key: 'tts_generation', title: '语音合成' },
  { key: 'video_assembly', title: '视频合成' },
  { key: 'ai_video_generation', title: 'AI视频生成' },
  { key: 'subtitle_generation', title: '字幕生成' },
  { key: 'video_finalization', title: '视频处理' },
  { key: 'publish', title: '发布' },
  { key: 'completed', title: '完成' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: '草稿' },
  pending: { color: 'default', label: '等待中' },
  running: { color: 'processing', label: '运行中' },
  completed: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'warning', label: '已取消' },
};

const VIDEO_SOURCE_OPTIONS = [
  { label: 'Kie.ai 生成', value: 'kie' },
  { label: 'MoviePy 合成', value: 'moviepy' },
  { label: '上传视频', value: 'upload' },
];

const STYLE_OPTIONS = [
  { label: '产品测评', value: 'product_review' },
  { label: '开箱体验', value: 'unboxing' },
  { label: '生活方式', value: 'lifestyle' },
  { label: '对比评测', value: 'comparison' },
  { label: '使用教程', value: 'tutorial' },
  { label: '痛点解决', value: 'problem_solution' },
];

function parseJsonArray(jsonStr: string | null): unknown[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStageIndex(stage: string): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === stage);
  return idx >= 0 ? idx : 0;
}

function getStageStatus(
  stageIdx: number,
  currentIdx: number,
  pipelineStatus: string,
): 'wait' | 'process' | 'finish' | 'error' {
  if (stageIdx < currentIdx) return 'finish';
  if (stageIdx === currentIdx) {
    if (pipelineStatus === 'failed') return 'error';
    if (pipelineStatus === 'completed') return 'finish';
    return 'process';
  }
  return 'wait';
}

export default function PipelineRuns() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<number[]>([]);

  // Wizard form state
  const [wizardProductId, setWizardProductId] = useState<number | undefined>(undefined);
  const [wizardStyle, setWizardStyle] = useState('product_review');
  const [wizardVideoSource, setWizardVideoSource] = useState('kie');
  const [wizardProfileIds, setWizardProfileIds] = useState<number[]>([]);

  // Queries
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pipeline-runs', statusFilter, page, pageSize],
    queryFn: () =>
      listPipelineRuns({
        status: statusFilter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
    refetchInterval: 10_000, // Auto-refresh every 10s for running pipelines
  });

  const { data: productData } = useQuery({
    queryKey: ['products', '', 1, 100],
    queryFn: () => listProducts({ limit: 100 }),
  });
  const products = productData?.items ?? [];

  const { data: profiles } = useQuery<Profile[]>({
    queryKey: ['profiles-for-pipeline'],
    queryFn: () => getProfiles({}),
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: startPipeline,
    onSuccess: () => {
      messageApi.success('流水线已启动');
      setWizardOpen(false);
      resetWizard();
      void queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
    onError: (err: Error) => {
      messageApi.error(`启动失败: ${err.message}`);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => resumePipelineRun(id),
    onSuccess: () => {
      messageApi.success('已恢复运行');
      void queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
    onError: (err: Error) => {
      messageApi.error(`恢复失败: ${err.message}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelPipelineRun(id),
    onSuccess: () => {
      messageApi.success('已取消');
      void queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
    onError: (err: Error) => {
      messageApi.error(`取消失败: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePipelineRun(id),
    onSuccess: () => {
      messageApi.success('已删除');
      void queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
    onError: (err: Error) => {
      messageApi.error(`删除失败: ${err.message}`);
    },
  });

  // Wizard helpers
  function resetWizard() {
    setWizardStep(0);
    setWizardProductId(undefined);
    setWizardStyle('product_review');
    setWizardVideoSource('kie');
    setWizardProfileIds([]);
  }

  function handleWizardSubmit() {
    if (!wizardProductId) {
      messageApi.warning('请选择商品');
      return;
    }
    startMutation.mutate({
      product_id: wizardProductId,
      style: wizardStyle,
      video_source: wizardVideoSource,
      target_profile_ids: wizardProfileIds.length > 0 ? wizardProfileIds : undefined,
    });
  }

  // Product name lookup
  function getProductName(productId: number | null): string {
    if (productId == null) return '-';
    const p = products.find((prod) => prod.id === productId);
    return p?.name ?? `#${productId}`;
  }

  // Table columns
  const columns: ColumnsType<PipelineRunData> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '商品',
      key: 'product',
      ellipsis: true,
      render: (_: unknown, record: PipelineRunData) => getProductName(record.product_id),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const cfg = STATUS_MAP[status] ?? { color: 'default', label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '当前阶段',
      dataIndex: 'current_stage',
      key: 'current_stage',
      width: 120,
      render: (stage: string) => {
        const s = PIPELINE_STAGES.find((ps) => ps.key === stage);
        return s?.title ?? stage;
      },
    },
    {
      title: '视频来源',
      dataIndex: 'video_source',
      key: 'video_source',
      width: 120,
      render: (val: string) => {
        const opt = VIDEO_SOURCE_OPTIONS.find((o) => o.value === val);
        return <Tag>{opt?.label ?? val}</Tag>;
      },
    },
    {
      title: '风格',
      dataIndex: 'style',
      key: 'style',
      width: 100,
      render: (val: string) => {
        const opt = STYLE_OPTIONS.find((o) => o.value === val);
        return opt?.label ?? val;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val: string) => {
        try {
          return new Date(val).toLocaleString('zh-CN');
        } catch {
          return val;
        }
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: PipelineRunData) => (
        <Space size="small">
          {(record.status === 'failed' || record.status === 'cancelled') && (
            <Tooltip title="恢复运行">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={resumeMutation.isPending && resumeMutation.variables === record.id}
                onClick={() => resumeMutation.mutate(record.id)}
              />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="取消">
              <Button
                type="link"
                size="small"
                danger
                icon={<StopOutlined />}
                loading={cancelMutation.isPending && cancelMutation.variables === record.id}
                onClick={() => cancelMutation.mutate(record.id)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确定删除此流水线？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expanded row: stage-by-stage progress
  function renderExpandedRow(record: PipelineRunData) {
    const currentIdx = getStageIndex(record.current_stage);
    const stages = parseJsonArray(record.stages_json);

    return (
      <div style={{ padding: '8px 0' }}>
        <Steps
          size="small"
          current={currentIdx}
          items={PIPELINE_STAGES.map((stage, idx) => {
            const stageStatus = getStageStatus(idx, currentIdx, record.status);
            let icon: React.ReactNode = undefined;
            if (stageStatus === 'finish') icon = <CheckCircleOutlined />;
            else if (stageStatus === 'process' && record.status === 'running')
              icon = <LoadingOutlined />;
            else if (stageStatus === 'error') icon = <CloseCircleOutlined />;
            else if (stageStatus === 'wait') icon = <ClockCircleOutlined />;

            return {
              title: stage.title,
              status: stageStatus,
              icon,
            };
          })}
        />
        {record.error_message && (
          <Card size="small" style={{ marginTop: 12, borderColor: '#ff4d4f' }}>
            <Text type="danger">
              {record.error_message}
            </Text>
          </Card>
        )}
        {stages.length > 0 && (
          <Descriptions
            size="small"
            bordered
            column={1}
            style={{ marginTop: 12 }}
            title="阶段详情"
          >
            {stages.map((s: unknown, idx: number) => {
              const stageObj = s as Record<string, unknown>;
              return (
                <Descriptions.Item
                  key={idx}
                  label={String(stageObj.name ?? stageObj.stage ?? `Step ${idx + 1}`)}
                >
                  <Tag
                    color={
                      stageObj.status === 'completed'
                        ? 'success'
                        : stageObj.status === 'failed'
                          ? 'error'
                          : stageObj.status === 'running'
                            ? 'processing'
                            : 'default'
                    }
                  >
                    {String(stageObj.status ?? 'pending')}
                  </Tag>
                  {stageObj.message && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {String(stageObj.message)}
                    </Text>
                  )}
                </Descriptions.Item>
              );
            })}
          </Descriptions>
        )}
      </div>
    );
  }

  // Wizard step content
  const wizardSteps = [
    {
      title: '选择商品',
      content: (
        <div style={{ padding: '24px 0' }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            选择要处理的商品
          </Text>
          <Select
            showSearch
            placeholder="搜索并选择商品..."
            value={wizardProductId}
            onChange={setWizardProductId}
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={products.map((p) => ({
              label: `${p.name}${p.category ? ` (${p.category})` : ''}`,
              value: p.id,
            }))}
          />
        </div>
      ),
    },
    {
      title: '视频来源',
      content: (
        <div style={{ padding: '24px 0' }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            选择视频生成方式
          </Text>
          <Radio.Group
            value={wizardVideoSource}
            onChange={(e) => setWizardVideoSource(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            options={VIDEO_SOURCE_OPTIONS}
          />
          <div style={{ marginTop: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              内容风格
            </Text>
            <Radio.Group
              value={wizardStyle}
              onChange={(e) => setWizardStyle(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={STYLE_OPTIONS}
            />
          </div>
        </div>
      ),
    },
    {
      title: '发布目标',
      content: (
        <div style={{ padding: '24px 0' }}>
          <Text strong style={{ display: 'block', marginBottom: 12 }}>
            选择发布设备（可选，留空则不自动发布）
          </Text>
          <Select
            mode="multiple"
            placeholder="搜索并选择设备..."
            value={wizardProfileIds}
            onChange={setWizardProfileIds}
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={(profiles ?? []).map((p) => ({
              label: `${p.profile_name}${p.platform ? ` (${p.platform})` : ''}`,
              value: p.id,
            }))}
          />
        </div>
      ),
    },
    {
      title: '确认启动',
      content: (
        <div style={{ padding: '24px 0' }}>
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="商品">
              {wizardProductId ? getProductName(wizardProductId) : '未选择'}
            </Descriptions.Item>
            <Descriptions.Item label="内容风格">
              {STYLE_OPTIONS.find((o) => o.value === wizardStyle)?.label ?? wizardStyle}
            </Descriptions.Item>
            <Descriptions.Item label="视频来源">
              {VIDEO_SOURCE_OPTIONS.find((o) => o.value === wizardVideoSource)?.label ?? wizardVideoSource}
            </Descriptions.Item>
            <Descriptions.Item label="发布设备">
              {wizardProfileIds.length > 0
                ? wizardProfileIds
                    .map((id) => {
                      const p = (profiles ?? []).find((pr) => pr.id === id);
                      return p?.profile_name ?? `#${id}`;
                    })
                    .join(', ')
                : '不自动发布'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={3}>
        <ThunderboltOutlined style={{ marginRight: 8 }} />
        自动流水线
      </Title>

      {/* Action bar */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            resetWizard();
            setWizardOpen(true);
          }}
        >
          新建流水线
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => void refetch()}
        >
          刷新
        </Button>
        <Select
          placeholder="状态筛选"
          allowClear
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          style={{ width: 140 }}
          options={Object.entries(STATUS_MAP).map(([key, cfg]) => ({
            label: cfg.label,
            value: key,
          }))}
        />
      </Space>

      {/* Pipeline runs table */}
      <Table<PipelineRunData>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as number[]),
          expandedRowRender: renderExpandedRow,
        }}
        size="middle"
      />

      {/* New Pipeline Wizard Modal */}
      <Modal
        title="新建自动流水线"
        open={wizardOpen}
        width={640}
        onCancel={() => {
          setWizardOpen(false);
          resetWizard();
        }}
        footer={
          <Space>
            <Button onClick={() => {
              setWizardOpen(false);
              resetWizard();
            }}>
              取消
            </Button>
            {wizardStep > 0 && (
              <Button onClick={() => setWizardStep((s) => s - 1)}>
                上一步
              </Button>
            )}
            {wizardStep < wizardSteps.length - 1 && (
              <Button
                type="primary"
                disabled={wizardStep === 0 && !wizardProductId}
                onClick={() => setWizardStep((s) => s + 1)}
              >
                下一步
              </Button>
            )}
            {wizardStep === wizardSteps.length - 1 && (
              <Button
                type="primary"
                loading={startMutation.isPending}
                disabled={!wizardProductId}
                onClick={handleWizardSubmit}
              >
                启动流水线
              </Button>
            )}
          </Space>
        }
      >
        <Steps
          current={wizardStep}
          size="small"
          style={{ marginBottom: 16 }}
          items={wizardSteps.map((s) => ({ title: s.title }))}
        />
        {wizardSteps[wizardStep].content}
      </Modal>
    </div>
  );
}
