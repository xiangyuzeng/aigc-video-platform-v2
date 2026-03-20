import { useState } from 'react';
import {
  Modal,
  Steps,
  Form,
  Input,
  Select,
  Radio,
  DatePicker,
  Button,
  Space,
  Descriptions,
  Tag,
  message,
  Spin,
  Alert,
  Divider,
  Typography,
} from 'antd';
import {
  ShoppingOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listProducts, scrapeProduct, type ProductData } from '../api/products';
import { getProfiles, type Profile } from '../api/profiles';
import { startPipeline, type PipelineRunData } from '../api/pipeline';
import dayjs from 'dayjs';

const { Text } = Typography;

interface QuickPipelineProps {
  open: boolean;
  onClose: () => void;
}

const STYLE_OPTIONS = [
  { value: 'product_review', label: '商品测评 (Product Review)' },
  { value: 'unboxing', label: '开箱视频 (Unboxing)' },
  { value: 'lifestyle', label: '生活方式 (Lifestyle)' },
  { value: 'tutorial', label: '使用教程 (Tutorial)' },
  { value: 'comparison', label: '对比评测 (Comparison)' },
];

const VIDEO_SOURCE_OPTIONS = [
  { value: 'ai_generate', label: 'AI 生成 (kie.ai)' },
  { value: 'moviepy', label: 'MoviePy 合成' },
  { value: 'upload', label: '上传视频' },
];

export default function QuickPipeline({ open, onClose }: QuickPipelineProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [productSource, setProductSource] = useState<'existing' | 'scrape'>('existing');
  const [videoSource, setVideoSource] = useState('ai_generate');
  const [style, setStyle] = useState('product_review');
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([]);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduleTime, setScheduleTime] = useState<dayjs.Dayjs | null>(null);
  const [launchedRun, setLaunchedRun] = useState<PipelineRunData | null>(null);

  // Fetch existing products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-pipeline'],
    queryFn: () => listProducts({ limit: 100 }),
    enabled: open,
  });

  // Fetch profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles-for-pipeline'],
    queryFn: () => getProfiles(),
    enabled: open,
  });

  // Scrape product mutation
  const scrapeMutation = useMutation({
    mutationFn: (url: string) => scrapeProduct(url),
    onSuccess: (product) => {
      setSelectedProduct(product);
      message.success(`商品 "${product.name}" 采集成功`);
    },
    onError: () => {
      message.error('商品采集失败，请检查链接');
    },
  });

  // Start pipeline mutation
  const pipelineMutation = useMutation({
    mutationFn: startPipeline,
    onSuccess: (run) => {
      setLaunchedRun(run);
      message.success('Pipeline 已启动');
    },
    onError: () => {
      message.error('Pipeline 启动失败');
    },
  });

  const products = productsData?.items ?? [];

  const handleClose = () => {
    // Reset state on close
    setCurrentStep(0);
    setSelectedProduct(null);
    setScrapeUrl('');
    setProductSource('existing');
    setVideoSource('ai_generate');
    setStyle('product_review');
    setSelectedProfileIds([]);
    setScheduleType('immediate');
    setScheduleTime(null);
    setLaunchedRun(null);
    onClose();
  };

  const handleNext = () => {
    if (currentStep === 0 && !selectedProduct) {
      message.warning('请先选择或采集一个商品');
      return;
    }
    if (currentStep === 1 && selectedProfileIds.length === 0) {
      message.warning('请至少选择一个发布账号');
      return;
    }
    setCurrentStep((s) => s + 1);
  };

  const handlePrev = () => {
    setCurrentStep((s) => s - 1);
  };

  const handleLaunch = () => {
    if (!selectedProduct) return;
    pipelineMutation.mutate({
      product_id: selectedProduct.id,
      style,
      video_source: videoSource,
      target_profile_ids: selectedProfileIds,
      schedule_time: scheduleType === 'scheduled' && scheduleTime ? scheduleTime.toISOString() : undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  };

  const handleGoToPipeline = () => {
    handleClose();
    navigate('/pipeline');
  };

  const canGoNext = () => {
    if (currentStep === 0) return !!selectedProduct;
    if (currentStep === 1) return selectedProfileIds.length > 0;
    return true;
  };

  // Step 1: Product selection
  const renderStep1 = () => (
    <div>
      <Radio.Group
        value={productSource}
        onChange={(e) => {
          setProductSource(e.target.value);
          setSelectedProduct(null);
        }}
        style={{ marginBottom: 16 }}
      >
        <Radio.Button value="existing">选择已有商品</Radio.Button>
        <Radio.Button value="scrape">输入链接采集</Radio.Button>
      </Radio.Group>

      {productSource === 'existing' ? (
        <div>
          <Select
            showSearch
            placeholder="搜索并选择商品"
            style={{ width: '100%' }}
            loading={productsLoading}
            value={selectedProduct?.id}
            onChange={(id) => {
              const p = products.find((item) => item.id === id);
              setSelectedProduct(p ?? null);
            }}
            optionFilterProp="label"
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name}${p.price ? ` - ${p.currency}${p.price}` : ''}`,
            }))}
            notFoundContent={productsLoading ? <Spin size="small" /> : '暂无商品'}
          />
          {products.length === 0 && !productsLoading && (
            <Alert
              type="info"
              showIcon
              message="暂无已有商品，请切换到「输入链接采集」模式"
              style={{ marginTop: 12 }}
            />
          )}
        </div>
      ) : (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            prefix={<LinkOutlined />}
            placeholder="输入商品链接 (如 TikTok Shop / Amazon)"
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onPressEnter={() => scrapeUrl && scrapeMutation.mutate(scrapeUrl)}
          />
          <Button
            type="primary"
            loading={scrapeMutation.isPending}
            onClick={() => scrapeUrl && scrapeMutation.mutate(scrapeUrl)}
            disabled={!scrapeUrl}
          >
            抓取
          </Button>
        </Space.Compact>
      )}

      {selectedProduct && (
        <Descriptions
          bordered
          column={2}
          size="small"
          style={{ marginTop: 16 }}
          title={<Text strong><ShoppingOutlined /> 已选商品</Text>}
        >
          <Descriptions.Item label="名称" span={2}>{selectedProduct.name}</Descriptions.Item>
          <Descriptions.Item label="价格">
            {selectedProduct.price ? `${selectedProduct.currency} ${selectedProduct.price}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="分类">{selectedProduct.category ?? '-'}</Descriptions.Item>
          {selectedProduct.score != null && (
            <Descriptions.Item label="AI 评分">{selectedProduct.score}</Descriptions.Item>
          )}
        </Descriptions>
      )}
    </div>
  );

  // Step 2: Configuration
  const renderStep2 = () => (
    <Form layout="vertical">
      <Form.Item label="视频来源">
        <Radio.Group value={videoSource} onChange={(e) => setVideoSource(e.target.value)}>
          {VIDEO_SOURCE_OPTIONS.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
          ))}
        </Radio.Group>
      </Form.Item>

      <Form.Item label="视频风格">
        <Select
          value={style}
          onChange={setStyle}
          options={STYLE_OPTIONS}
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        label="发布账号"
        required
        help={selectedProfileIds.length === 0 ? '请至少选择一个账号' : undefined}
        validateStatus={selectedProfileIds.length === 0 ? 'error' : undefined}
      >
        <Select
          mode="multiple"
          placeholder="选择要发布的账号"
          loading={profilesLoading}
          value={selectedProfileIds}
          onChange={setSelectedProfileIds}
          style={{ width: '100%' }}
          optionFilterProp="label"
          maxTagCount="responsive"
          options={(profiles ?? []).map((p: Profile) => ({
            value: p.id,
            label: `${p.profile_name}${p.group_name ? ` (${p.group_name})` : ''}${p.platform ? ` - ${p.platform}` : ''}`,
          }))}
          notFoundContent={profilesLoading ? <Spin size="small" /> : '暂无可用账号'}
        />
      </Form.Item>

      <Form.Item label="发布时间">
        <Radio.Group
          value={scheduleType}
          onChange={(e) => {
            setScheduleType(e.target.value);
            if (e.target.value === 'immediate') setScheduleTime(null);
          }}
        >
          <Radio value="immediate">立即发布</Radio>
          <Radio value="scheduled">定时发布</Radio>
        </Radio.Group>
        {scheduleType === 'scheduled' && (
          <DatePicker
            showTime
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择发布时间"
            value={scheduleTime}
            onChange={setScheduleTime}
            disabledDate={(current) => current && current < dayjs().startOf('day')}
          />
        )}
      </Form.Item>
    </Form>
  );

  // Step 3: Confirmation
  const renderStep3 = () => {
    if (launchedRun) {
      return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>Pipeline 已成功启动!</Text>
          </div>
          <div style={{ margin: '12px 0' }}>
            <Text type="secondary">
              运行 ID: <Tag color="blue">#{launchedRun.id}</Tag>
              状态: <Tag color="processing">{launchedRun.status}</Tag>
            </Text>
          </div>
          <Button type="primary" onClick={handleGoToPipeline} style={{ marginTop: 12 }}>
            查看 Pipeline 运行状态
          </Button>
        </div>
      );
    }

    const selectedProfiles = (profiles ?? []).filter((p: Profile) => selectedProfileIds.includes(p.id));

    return (
      <div>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="商品">
            {selectedProduct?.name ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="商品价格">
            {selectedProduct?.price ? `${selectedProduct.currency} ${selectedProduct.price}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="视频来源">
            {VIDEO_SOURCE_OPTIONS.find((o) => o.value === videoSource)?.label ?? videoSource}
          </Descriptions.Item>
          <Descriptions.Item label="视频风格">
            {STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style}
          </Descriptions.Item>
          <Descriptions.Item label="发布账号">
            <Space wrap>
              {selectedProfiles.map((p: Profile) => (
                <Tag key={p.id}>{p.profile_name}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="发布时间">
            {scheduleType === 'immediate'
              ? '立即发布'
              : scheduleTime
                ? scheduleTime.format('YYYY-MM-DD HH:mm')
                : '未设置'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            loading={pipelineMutation.isPending}
            onClick={handleLaunch}
          >
            一键生成并发布
          </Button>
        </div>
      </div>
    );
  };

  const stepItems = [
    { title: '选择商品', icon: <ShoppingOutlined /> },
    { title: '配置选项', icon: <SettingOutlined /> },
    { title: '确认并启动', icon: <CheckCircleOutlined /> },
  ];

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="一键生成 Pipeline"
      width={700}
      footer={
        launchedRun ? null : (
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>上一步</Button>
            )}
            {currentStep < 2 ? (
              <Button type="primary" onClick={handleNext} disabled={!canGoNext()}>
                下一步
              </Button>
            ) : null}
          </Space>
        )
      }
      destroyOnClose
    >
      <Steps
        current={currentStep}
        items={stepItems}
        style={{ marginBottom: 24 }}
        size="small"
      />

      {currentStep === 0 && renderStep1()}
      {currentStep === 1 && renderStep2()}
      {currentStep === 2 && renderStep3()}
    </Modal>
  );
}
