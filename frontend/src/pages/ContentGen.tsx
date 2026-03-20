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
  Input,
  Tag,
  Divider,
  message,
  Empty,
  List,
  Descriptions,
} from 'antd';
import {
  EditOutlined,
  PlayCircleOutlined,
  SendOutlined,
  TranslationOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listProducts, type ProductData } from '../api/products';
import {
  generateContent,
  generateScript,
  translateContent,
  listContent,
  type ContentPieceData,
} from '../api/content';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

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
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);
  const [style, setStyle] = useState('product_review');
  const [scriptDuration, setScriptDuration] = useState(30);
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
    },
    onError: (err: Error) => {
      messageApi.error(`脚本生成失败: ${err.message}`);
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

  // Parsed data
  const tags = parseJsonArray(selectedContent?.tags_json ?? null);
  const script = parseJsonObject(selectedContent?.script_json ?? null);
  const translations = parseJsonObject(selectedContent?.translations_json ?? null);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={3}>
        <EditOutlined style={{ marginRight: 8 }} />
        文案生成
      </Title>

      {/* Config section */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Product selector */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              选择商品
            </Text>
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
          </div>

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

          {/* Action buttons */}
          <Space wrap>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              loading={generateMutation.isPending}
              disabled={!selectedProductId}
              onClick={() => generateMutation.mutate()}
            >
              生成文案
            </Button>
            <Button
              icon={<VideoCameraOutlined />}
              loading={scriptMutation.isPending}
              disabled={!selectedProductId}
              onClick={() => scriptMutation.mutate()}
            >
              生成脚本
            </Button>
            <Select
              value={scriptDuration}
              onChange={setScriptDuration}
              style={{ width: 120 }}
              options={[
                { label: '15 秒', value: 15 },
                { label: '30 秒', value: 30 },
                { label: '60 秒', value: 60 },
                { label: '90 秒', value: 90 },
              ]}
            />
          </Space>
        </Space>
      </Card>

      {/* Loading state */}
      <Spin spinning={generateMutation.isPending || scriptMutation.isPending}>
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
                    title={`#${item.id} - ${item.style}`}
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

        {/* Results area */}
        {selectedContent && (
          <>
            <Card title="生成结果" style={{ marginBottom: 16 }}>
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
                    视频脚本
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
                  <Tag>{selectedContent.style}</Tag>
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
                  <span>翻译</span>
                </Space>
              }
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

            {/* Navigation buttons */}
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate('/pipeline')}
              >
                创建视频流水线
              </Button>
              <Button
                icon={<SendOutlined />}
                onClick={() => navigate('/publish')}
              >
                用于发布
              </Button>
              <Button
                onClick={() => setSelectedContent(null)}
              >
                返回列表
              </Button>
            </Space>
          </>
        )}

        {/* Empty state */}
        {!selectedContent && !contentLoading && selectedProductId && (contentList?.length ?? 0) === 0 && (
          <Empty
            description="暂无文案，点击上方按钮生成"
            style={{ marginTop: 48 }}
          />
        )}

        {!selectedProductId && (
          <Empty
            description="请先选择商品"
            style={{ marginTop: 48 }}
          />
        )}
      </Spin>
    </div>
  );
}
