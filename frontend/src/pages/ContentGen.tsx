import { useState } from 'react';
import {
  Typography,
  Card,
  Select,
  Radio,
  Button,
  Space,
  Tabs,
  Spin,
  Tag,
  Divider,
  message,
  Empty,
  List,
  Descriptions,
  Alert,
  Steps,
  Row,
  Col,
} from 'antd';
import {
  EditOutlined,
  SendOutlined,
  TranslationOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '../api/products';
import {
  generateContent,
  generateScript,
  translateContent,
  listContent,
  type ContentPieceData,
} from '../api/content';

const { Title, Paragraph, Text } = Typography;

const STYLE_OPTIONS = [
  { label: '产品测评', value: 'product_review' },
  { label: '开箱体验', value: 'unboxing' },
  { label: '生活方式', value: 'lifestyle' },
  { label: '对比评测', value: 'comparison' },
  { label: '使用教程', value: 'tutorial' },
  { label: '痛点解决', value: 'problem_solution' },
];

const LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
  { label: 'Espanol', value: 'es' },
  { label: '日本語', value: 'ja' },
  { label: '한국어', value: 'ko' },
  { label: 'Francais', value: 'fr' },
];

const VIDEO_MODELS = [
  { label: 'Veo 3 Fast', value: 'veo3_fast', maxDuration: 8, desc: '快速生成，适合批量制作' },
  { label: 'Veo 3', value: 'veo3', maxDuration: 8, desc: '高质量生成' },
];

function getDurationOptions(model: string) {
  const m = VIDEO_MODELS.find((v) => v.value === model);
  const max = m?.maxDuration ?? 8;
  const opts = [];
  if (max >= 5) opts.push({ label: '5 秒', value: 5 });
  if (max >= 8) opts.push({ label: '8 秒', value: 8 });
  return opts.length > 0 ? opts : [{ label: `${max} 秒`, value: max }];
}

function parseJsonArray(jsonStr: string | null): string[] {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(jsonStr: string | null): Record<string, unknown> | null {
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export default function ContentGen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
  const [style, setStyle] = useState('product_review');
  const [videoModel, setVideoModel] = useState('veo3_fast');
  const [scriptDuration, setScriptDuration] = useState(8);
  const [selectedContent, setSelectedContent] = useState<ContentPieceData | null>(null);
  const [translateLangs, setTranslateLangs] = useState<string[]>(['zh', 'es']);

  // Queries
  const { data: productData } = useQuery({
    queryKey: ['products', '', 1, 100],
    queryFn: () => listProducts({ limit: 100 }),
  });

  const products = productData?.items ?? [];

  const { data: contentList, isLoading: contentLoading } = useQuery({
    queryKey: ['content', selectedProductId],
    queryFn: () => listContent(selectedProductId),
    enabled: !!selectedProductId,
  });

  // Mutations
  const generateMutation = useMutation({
    mutationFn: () => {
      if (!selectedProductId) throw new Error('请先选择商品');
      return generateContent(selectedProductId, style);
    },
    onSuccess: (result) => {
      messageApi.success('文案生成成功');
      setSelectedContent(result);
      void queryClient.invalidateQueries({ queryKey: ['content', selectedProductId] });
    },
    onError: (err: Error) => {
      messageApi.error(`生成失败: ${err.message}`);
    },
  });

  const scriptMutation = useMutation({
    mutationFn: () => {
      if (!selectedProductId) throw new Error('请先选择商品');
      return generateScript(selectedProductId, style, scriptDuration);
    },
    onSuccess: (result) => {
      messageApi.success('脚本生成成功');
      setSelectedContent(result);
      void queryClient.invalidateQueries({ queryKey: ['content', selectedProductId] });
    },
    onError: (err: Error) => {
      messageApi.error(`脚本生成失败: ${err.message}`);
    },
  });

  // One-click: generate content + script together
  const generateAllMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId) throw new Error('请先选择商品');
      await generateContent(selectedProductId, style);
      return await generateScript(selectedProductId, style, scriptDuration);
    },
    onSuccess: (result) => {
      messageApi.success('文案和脚本已全部生成');
      setSelectedContent(result);
      void queryClient.invalidateQueries({ queryKey: ['content', selectedProductId] });
    },
    onError: (err: Error) => {
      messageApi.error(`生成失败: ${err.message}`);
    },
  });

  const translateMutation = useMutation({
    mutationFn: () => {
      if (!selectedContent) throw new Error('请先生成或选择文案');
      return translateContent(selectedContent.id, translateLangs);
    },
    onSuccess: (result) => {
      messageApi.success('翻译完成');
      setSelectedContent(result);
    },
    onError: (err: Error) => {
      messageApi.error(`翻译失败: ${err.message}`);
    },
  });

  const isGenerating = generateMutation.isPending || scriptMutation.isPending || generateAllMutation.isPending;

  // Parsed data
  const tags = parseJsonArray(selectedContent?.tags_json ?? null);
  const script = parseJsonObject(selectedContent?.script_json ?? null);
  const translations = parseJsonObject(selectedContent?.translations_json ?? null);

  // Step tracking
  const currentStep = !selectedProductId ? 0 : !selectedContent ? 1 : 2;
  const durationOptions = getDurationOptions(videoModel);

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={3}>
        <EditOutlined style={{ marginRight: 8 }} />
        AI 文案生成
      </Title>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="自动化内容生成流程"
        description="选择商品 → 配置风格和视频模型 → 一键生成文案与脚本 → 翻译后用于发布或流水线。"
        closable
        style={{ marginBottom: 16 }}
      />

      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '选择商品' },
          { title: '配置并生成' },
          { title: '结果与下一步' },
        ]}
      />

      {/* Step 1: Product Selection */}
      <Card
        title={<><Tag color="blue">步骤 1</Tag> 选择商品</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        <Select
          showSearch
          placeholder="搜索并选择商品..."
          value={selectedProductId}
          onChange={(val) => {
            setSelectedProductId(val);
            setSelectedContent(null);
          }}
          optionFilterProp="label"
          style={{ width: '100%', maxWidth: 480 }}
          options={products.map((p) => ({
            label: `${p.name}${p.category ? ` (${p.category})` : ''}`,
            value: p.id,
          }))}
          allowClear
        />
        {products.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">还没有商品。</Text>{' '}
            <Button type="link" size="small" onClick={() => navigate('/products')} style={{ padding: 0 }}>
              去添加商品
            </Button>
          </div>
        )}
      </Card>

      {/* Step 2: Configuration */}
      <Card
        title={<><Tag color={selectedProductId ? 'blue' : 'default'}>步骤 2</Tag> 配置风格与视频模型</>}
        size="small"
        style={{ marginBottom: 16, opacity: selectedProductId ? 1 : 0.5 }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Style picker */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              内容风格
            </Text>
            <Radio.Group
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              options={STYLE_OPTIONS}
            />
          </div>

          {/* Video model + duration */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                视频模型
              </Text>
              <Select
                value={videoModel}
                onChange={(val) => {
                  setVideoModel(val);
                  const opts = getDurationOptions(val);
                  const last = opts[opts.length - 1];
                  if (!opts.find((o) => o.value === scriptDuration) && last) {
                    setScriptDuration(last.value);
                  }
                }}
                style={{ width: '100%' }}
                options={VIDEO_MODELS.map((m) => ({
                  label: `${m.label} — ${m.desc}`,
                  value: m.value,
                }))}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                视频时长
              </Text>
              <Select
                value={scriptDuration}
                onChange={setScriptDuration}
                style={{ width: '100%' }}
                options={durationOptions}
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                {VIDEO_MODELS.find((m) => m.value === videoModel)?.label ?? ''} 最长支持{' '}
                {VIDEO_MODELS.find((m) => m.value === videoModel)?.maxDuration ?? 8} 秒
              </Text>
            </Col>
          </Row>

          {/* Action buttons */}
          <Divider style={{ margin: '8px 0' }} />
          <Space wrap>
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              loading={generateAllMutation.isPending}
              disabled={!selectedProductId}
              onClick={() => generateAllMutation.mutate()}
            >
              一键生成（文案 + 脚本）
            </Button>
            <Button
              icon={<FileTextOutlined />}
              loading={generateMutation.isPending}
              disabled={!selectedProductId || generateAllMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              仅生成文案
            </Button>
            <Button
              icon={<VideoCameraOutlined />}
              loading={scriptMutation.isPending}
              disabled={!selectedProductId || generateAllMutation.isPending}
              onClick={() => scriptMutation.mutate()}
            >
              仅生成脚本
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Loading state */}
      <Spin spinning={isGenerating}>
        {/* Content history for this product */}
        {selectedProductId && contentList && contentList.length > 0 && !selectedContent && (
          <Card title="已有文案" style={{ marginBottom: 16 }} size="small">
            <List
              dataSource={contentList}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="select"
                      type="link"
                      size="small"
                      onClick={() => setSelectedContent(item)}
                    >
                      查看
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={`#${item.id} - ${STYLE_OPTIONS.find((s) => s.value === item.style)?.label ?? item.style}`}
                    description={
                      <Text ellipsis style={{ maxWidth: 500 }}>
                        {item.caption ?? '(无标题)'}
                      </Text>
                    }
                  />
                  <Text type="secondary">
                    {new Date(item.created_at).toLocaleString('zh-CN')}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        )}

        {/* Step 3: Results area */}
        {selectedContent && (
          <>
            <Card
              title={<><Tag color="green">步骤 3</Tag> 生成结果</>}
              style={{ marginBottom: 16 }}
            >
              {/* Caption */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>标题文案</Text>
                <Paragraph
                  style={{ marginTop: 4, fontSize: 16 }}
                  copyable
                >
                  {selectedContent.caption ?? '(无)'}
                </Paragraph>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>标签</Text>
                  <div style={{ marginTop: 4 }}>
                    {tags.map((tag, idx) => (
                      <Tag key={idx} color="blue" style={{ marginBottom: 4 }}>
                        #{tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedContent.description && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>描述</Text>
                  <Paragraph
                    style={{ marginTop: 4 }}
                    copyable
                    ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}
                  >
                    {selectedContent.description}
                  </Paragraph>
                </div>
              )}

              <Divider />

              {/* Script */}
              {script && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>
                    <VideoCameraOutlined style={{ marginRight: 4 }} />
                    视频脚本（{scriptDuration} 秒 · {VIDEO_MODELS.find((m) => m.value === videoModel)?.label}）
                  </Text>
                  <Card size="small" style={{ marginTop: 8, background: '#fafafa' }}>
                    {Object.entries(script).map(([key, val]) => (
                      <div key={key} style={{ marginBottom: 8 }}>
                        <Text strong>{key}: </Text>
                        <Text>{typeof val === 'string' ? val : JSON.stringify(val)}</Text>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              <Descriptions size="small" column={2}>
                <Descriptions.Item label="风格">
                  <Tag>{STYLE_OPTIONS.find((s) => s.value === selectedContent.style)?.label ?? selectedContent.style}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="语言">
                  <Tag>{selectedContent.language}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Translation section */}
            <Card
              title={
                <Space>
                  <TranslationOutlined />
                  <span>翻译（可选）</span>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Space style={{ marginBottom: 16 }} wrap>
                <Select
                  mode="multiple"
                  value={translateLangs}
                  onChange={setTranslateLangs}
                  style={{ minWidth: 240 }}
                  options={LANGUAGE_OPTIONS}
                  placeholder="选择目标语言"
                />
                <Button
                  type="primary"
                  icon={<TranslationOutlined />}
                  loading={translateMutation.isPending}
                  onClick={() => translateMutation.mutate()}
                >
                  翻译
                </Button>
              </Space>

              {translations && Object.keys(translations).length > 0 && (
                <Tabs
                  items={Object.entries(translations).map(([lang, content]) => ({
                    key: lang,
                    label: LANGUAGE_OPTIONS.find((o) => o.value === lang)?.label ?? lang,
                    children: (
                      <div>
                        {typeof content === 'object' && content !== null ? (
                          Object.entries(content as Record<string, unknown>).map(
                            ([field, text]) => (
                              <div key={field} style={{ marginBottom: 12 }}>
                                <Text strong>{field}</Text>
                                <Paragraph copyable style={{ marginTop: 2 }}>
                                  {String(text)}
                                </Paragraph>
                              </div>
                            ),
                          )
                        ) : (
                          <Paragraph copyable>{String(content)}</Paragraph>
                        )}
                      </div>
                    ),
                  }))}
                />
              )}
            </Card>

            {/* Next actions */}
            <Card
              title={<><Tag color="orange">下一步</Tag> 使用生成内容</>}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Space wrap>
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate('/pipeline')}
                >
                  创建自动流水线
                </Button>
                <Button
                  icon={<SendOutlined />}
                  onClick={() => navigate('/publish')}
                >
                  手动发布
                </Button>
                <Button
                  onClick={() => setSelectedContent(null)}
                >
                  返回列表
                </Button>
              </Space>
            </Card>
          </>
        )}

        {/* Empty state */}
        {!selectedContent && !contentLoading && selectedProductId && (contentList?.length ?? 0) === 0 && (
          <Empty
            description="暂无文案，点击上方「一键生成」开始"
            style={{ marginTop: 48 }}
          />
        )}

        {!selectedProductId && (
          <Empty
            description="请先在步骤 1 中选择商品"
            style={{ marginTop: 48 }}
          />
        )}
      </Spin>
    </div>
  );
}
