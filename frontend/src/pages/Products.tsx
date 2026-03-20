import { useState } from 'react';
import {
  Typography,
  Table,
  Input,
  Button,
  Space,
  Tag,
  Drawer,
  Progress,
  Modal,
  Form,
  InputNumber,
  message,
  Card,
  Image,
  Popconfirm,
  Spin,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  StarOutlined,
  DeleteOutlined,
  LinkOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listProducts,
  scrapeProduct,
  scoreProduct,
  createProduct,
  deleteProduct,
  type ProductData,
} from '../api/products';
import type { ColumnsType } from 'antd/es/table';
import EmptyState from '../components/EmptyState';

const { Title, Paragraph, Text } = Typography;

function scoreColor(score: number | null): string {
  if (score == null) return '#d9d9d9';
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
}

export default function Products() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [drawerProduct, setDrawerProduct] = useState<ProductData | null>(null);
  const [form] = Form.useForm();

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['products', search, page, pageSize],
    queryFn: () =>
      listProducts({
        search: search || undefined,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
  });

  // Mutations
  const scrapeMutation = useMutation({
    mutationFn: (url: string) => scrapeProduct(url),
    onSuccess: () => {
      messageApi.success('商品抓取成功');
      setScrapeUrl('');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => {
      messageApi.error(`抓取失败: ${err.message}`);
    },
  });

  const scoreMutation = useMutation({
    mutationFn: (id: number) => scoreProduct(id),
    onSuccess: (updated) => {
      messageApi.success(`评分完成: ${updated.score ?? '-'}`);
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      if (drawerProduct?.id === updated.id) {
        setDrawerProduct(updated);
      }
    },
    onError: (err: Error) => {
      messageApi.error(`评分失败: ${err.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      messageApi.success('商品添加成功');
      setAddModalOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => {
      messageApi.error(`添加失败: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      messageApi.success('已删除');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: Error) => {
      messageApi.error(`删除失败: ${err.message}`);
    },
  });

  // Helpers
  function parseJsonArray(jsonStr: string | null): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Table columns
  const columns: ColumnsType<ProductData> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record: ProductData) => (
        <a onClick={() => setDrawerProduct(record)}>{name}</a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (val: string | null) => (val ? <Tag>{val}</Tag> : '-'),
    },
    {
      title: '价格',
      key: 'price',
      width: 120,
      render: (_: unknown, record: ProductData) =>
        record.price != null
          ? `${record.currency} ${record.price.toFixed(2)}`
          : '-',
    },
    {
      title: '评分',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
      render: (score: number | null) =>
        score != null ? (
          <Tag color={scoreColor(score)}>{score}</Tag>
        ) : (
          <Text type="secondary">未评分</Text>
        ),
    },
    {
      title: '来源',
      dataIndex: 'source_url',
      key: 'source_url',
      width: 80,
      render: (url: string | null) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined />
          </a>
        ) : (
          '-'
        ),
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
      width: 140,
      render: (_: unknown, record: ProductData) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<StarOutlined />}
            loading={scoreMutation.isPending && scoreMutation.variables === record.id}
            onClick={() => scoreMutation.mutate(record.id)}
          >
            评分
          </Button>
          <Popconfirm
            title="确定删除此商品？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Drawer: parsed image URLs
  const drawerImages = parseJsonArray(drawerProduct?.image_urls_json ?? null);
  const drawerAngles = parseJsonArray(drawerProduct?.suggested_angles_json ?? null);

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={3}>
        <ShoppingOutlined style={{ marginRight: 8 }} />
        商品管理
      </Title>

      {/* URL Scrape bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入商品 URL 自动抓取..."
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            onPressEnter={() => {
              if (scrapeUrl.trim()) scrapeMutation.mutate(scrapeUrl.trim());
            }}
            allowClear
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            loading={scrapeMutation.isPending}
            disabled={!scrapeUrl.trim()}
            onClick={() => scrapeMutation.mutate(scrapeUrl.trim())}
          >
            抓取
          </Button>
        </Space.Compact>
      </Card>

      {/* Filter + Actions bar */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索商品..."
          allowClear
          onSearch={(val) => {
            setSearch(val);
            setPage(1);
          }}
          style={{ width: 260 }}
          prefix={<SearchOutlined />}
        />
        <Button icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          手动添加
        </Button>
      </Space>

      {/* Products table */}
      {(data?.items ?? []).length === 0 && !isLoading ? (
        <EmptyState
          description="还没有商品"
          actionText="添加商品"
          onAction={() => setAddModalOpen(true)}
        />
      ) : (
        <Table<ProductData>
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
          size="middle"
          onRow={(record) => ({
            style: { cursor: 'pointer' },
            onClick: (e) => {
              // Don't open drawer when clicking action buttons / links
              const target = e.target as HTMLElement;
              if (target.closest('button') || target.closest('.ant-popover')) return;
              setDrawerProduct(record);
            },
          })}
        />
      )}

      {/* Manual add modal */}
      <Modal
        title="手动添加商品"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="商品名称" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="如：电子产品、美妆、服饰" />
          </Form.Item>
          <Form.Item name="price" label="价格">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
          <Form.Item name="currency" label="货币">
            <Input placeholder="USD" />
          </Form.Item>
          <Form.Item name="source_url" label="来源 URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="商品描述..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        title={drawerProduct?.name ?? '商品详情'}
        placement="right"
        width={560}
        open={!!drawerProduct}
        onClose={() => setDrawerProduct(null)}
        extra={
          drawerProduct && (
            <Button
              type="primary"
              icon={<StarOutlined />}
              loading={scoreMutation.isPending}
              onClick={() => scoreMutation.mutate(drawerProduct.id)}
            >
              评分
            </Button>
          )
        }
      >
        {drawerProduct && (
          <div>
            {/* Score gauge */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Progress
                type="dashboard"
                percent={drawerProduct.score ?? 0}
                strokeColor={scoreColor(drawerProduct.score)}
                format={(pct) => (drawerProduct.score != null ? `${pct}` : '未评分')}
              />
              {drawerProduct.score_reasoning && (
                <Paragraph
                  type="secondary"
                  style={{ marginTop: 8 }}
                  ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                >
                  {drawerProduct.score_reasoning}
                </Paragraph>
              )}
            </div>

            {/* Basic info */}
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="分类">
                {drawerProduct.category ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="价格">
                {drawerProduct.price != null
                  ? `${drawerProduct.currency} ${drawerProduct.price.toFixed(2)}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {drawerProduct.source_url ? (
                  <a href={drawerProduct.source_url} target="_blank" rel="noopener noreferrer">
                    {drawerProduct.source_url}
                  </a>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(drawerProduct.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>

            {/* Description */}
            {drawerProduct.description && (
              <Card size="small" title="商品描述" style={{ marginBottom: 16 }}>
                <Paragraph
                  ellipsis={{ rows: 5, expandable: true, symbol: '展开' }}
                >
                  {drawerProduct.description}
                </Paragraph>
              </Card>
            )}

            {/* Suggested angles */}
            {drawerAngles.length > 0 && (
              <Card size="small" title="推荐营销角度" style={{ marginBottom: 16 }}>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {drawerAngles.map((angle, idx) => (
                    <li key={idx}>{angle}</li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Images */}
            {drawerImages.length > 0 && (
              <Card size="small" title="商品图片" style={{ marginBottom: 16 }}>
                <Image.PreviewGroup>
                  <Space wrap>
                    {drawerImages.map((url, idx) => (
                      <Image
                        key={idx}
                        src={url}
                        width={120}
                        height={120}
                        style={{ objectFit: 'cover', borderRadius: 4 }}
                        fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjYwIiB5PSI2MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiNiZmJmYmYiIGZvbnQtc2l6ZT0iMTIiPuaXoOWbvueJhzwvdGV4dD48L3N2Zz4="
                      />
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
