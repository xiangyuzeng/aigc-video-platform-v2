import { useState, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Row,
  Col,
  Card,
  Popconfirm,
  Empty,
  message,
  Tabs,
  Tooltip,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FileTextOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTemplates,
  getCategories,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  type TemplateData,
  type TemplateCreate,
} from '../api/templates';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function Templates() {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = message.useMessage();

  // State
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateData | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<{ content: string | null; tags: string | null } | null>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates', activeCategory],
    queryFn: () => getTemplates(activeCategory),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['template-categories'],
    queryFn: getCategories,
  });

  // Category options for the select in the form
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c, value: c })),
    [categories],
  );

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: TemplateCreate) => createTemplate(data),
    onSuccess: () => {
      messageApi.success('模板创建成功');
      setModalOpen(false);
      setEditingTemplate(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      void queryClient.invalidateQueries({ queryKey: ['template-categories'] });
    },
    onError: (err: Error) => {
      messageApi.error(`创建失败: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TemplateCreate> }) =>
      updateTemplate(id, data),
    onSuccess: () => {
      messageApi.success('模板更新成功');
      setModalOpen(false);
      setEditingTemplate(null);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      void queryClient.invalidateQueries({ queryKey: ['template-categories'] });
    },
    onError: (err: Error) => {
      messageApi.error(`更新失败: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTemplate(id),
    onSuccess: () => {
      messageApi.success('已删除');
      void queryClient.invalidateQueries({ queryKey: ['templates'] });
      void queryClient.invalidateQueries({ queryKey: ['template-categories'] });
    },
    onError: (err: Error) => {
      messageApi.error(`删除失败: ${err.message}`);
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, variables }: { id: number; variables: Record<string, string> }) =>
      applyTemplate(id, variables),
    onSuccess: (result) => {
      setPreviewResult(result);
    },
    onError: (err: Error) => {
      messageApi.error(`预览失败: ${err.message}`);
    },
  });

  // Handlers
  function openCreateModal() {
    setEditingTemplate(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEditModal(template: TemplateData) {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      content_template: template.content_template,
      tags_template: template.tags_template,
      category: template.category,
    });
    setModalOpen(true);
  }

  function openPreview(template: TemplateData) {
    setPreviewTemplate(template);
    // Initialize variables with empty values
    const vars: Record<string, string> = {};
    for (const v of template.variables) {
      vars[v] = '';
    }
    setPreviewVars(vars);
    setPreviewResult(null);
    setPreviewModalOpen(true);
  }

  function handleFormSubmit(values: TemplateCreate) {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  }

  function handlePreviewApply() {
    if (!previewTemplate) return;
    applyMutation.mutate({ id: previewTemplate.id, variables: previewVars });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      messageApi.success('已复制到剪贴板');
    });
  }

  // Tab items for category filter
  const tabItems = [
    { key: '__all__', label: '全部' },
    ...categories.map((c) => ({ key: c, label: c })),
  ];

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          模板库
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新建模板
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="模板库"
        description="保存常用的发布配置为模板，下次发布时可快速加载。"
        closable
        style={{ marginBottom: 16 }}
      />

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <Tabs
          activeKey={activeCategory ?? '__all__'}
          onChange={(key) => setActiveCategory(key === '__all__' ? undefined : key)}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Template cards grid */}
      {templates.length === 0 && !isLoading ? (
        <Empty description="暂无模板" style={{ marginTop: 80 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            创建第一个模板
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((t) => (
            <Col key={t.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                size="small"
                title={
                  <Space>
                    <Text strong ellipsis style={{ maxWidth: 140 }}>
                      {t.name}
                    </Text>
                    {t.category && <Tag color="blue">{t.category}</Tag>}
                  </Space>
                }
                actions={[
                  <Tooltip key="preview" title="预览">
                    <EyeOutlined onClick={() => openPreview(t)} />
                  </Tooltip>,
                  <Tooltip key="edit" title="编辑">
                    <EditOutlined onClick={() => openEditModal(t)} />
                  </Tooltip>,
                  <Popconfirm
                    key="delete"
                    title="确定删除此模板？"
                    onConfirm={() => deleteMutation.mutate(t.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <DeleteOutlined />
                  </Popconfirm>,
                ]}
              >
                {/* Content preview */}
                {t.content_template && (
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: 13, marginBottom: 8 }}
                  >
                    {t.content_template}
                  </Paragraph>
                )}

                {/* Tags preview */}
                {t.tags_template && (
                  <Paragraph
                    style={{ fontSize: 12, color: '#1890ff', marginBottom: 8 }}
                    ellipsis={{ rows: 1 }}
                  >
                    {t.tags_template}
                  </Paragraph>
                )}

                {/* Variable chips */}
                {t.variables.length > 0 && (
                  <div>
                    {t.variables.map((v) => (
                      <Tag key={v} color="orange" style={{ marginBottom: 4, fontSize: 11 }}>
                        {`{${v}}`}
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Create / Edit Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '新建模板'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingTemplate(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingTemplate ? '保存' : '创建'}
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          preserve={false}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="如：好物推荐通用模板" />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Select
              placeholder="选择或输入分类"
              options={categoryOptions}
              allowClear
              showSearch
              mode={undefined}
              // Allow creating new categories by typing
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ padding: '4px 8px', fontSize: 12, color: '#999' }}>
                    输入新分类名称并回车即可创建
                  </div>
                </>
              )}
              // Support typing a custom value
              onSearch={() => {}}
              notFoundContent="输入新分类名称"
            />
          </Form.Item>

          <Form.Item
            name="content_template"
            label="文案模板"
            help="使用 {变量名} 作为占位符，如：快来看看 {product_name}！只要 {price}！"
          >
            <TextArea
              rows={4}
              placeholder="快来看看 {product_name}！只要 {price}！限时优惠，不容错过！"
            />
          </Form.Item>

          <Form.Item
            name="tags_template"
            label="标签模板"
            help="使用 {变量名} 作为占位符，如：#好物推荐 #{category}"
          >
            <TextArea
              rows={2}
              placeholder="#好物推荐 #{category} #限时优惠"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Preview / Apply Modal */}
      <Modal
        title={`预览模板: ${previewTemplate?.name ?? ''}`}
        open={previewModalOpen}
        onCancel={() => {
          setPreviewModalOpen(false);
          setPreviewTemplate(null);
          setPreviewResult(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setPreviewModalOpen(false);
              setPreviewTemplate(null);
              setPreviewResult(null);
            }}
          >
            关闭
          </Button>,
          <Button
            key="apply"
            type="primary"
            loading={applyMutation.isPending}
            onClick={handlePreviewApply}
          >
            生成预览
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        {previewTemplate && (
          <div>
            {/* Raw templates */}
            <Card size="small" title="文案模板" style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                {previewTemplate.content_template || '(空)'}
              </Text>
            </Card>
            <Card size="small" title="标签模板" style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ whiteSpace: 'pre-wrap' }}>
                {previewTemplate.tags_template || '(空)'}
              </Text>
            </Card>

            {/* Variable inputs */}
            {previewTemplate.variables.length > 0 && (
              <Card size="small" title="填写变量" style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]}>
                  {previewTemplate.variables.map((v) => (
                    <Col key={v} xs={24} sm={12}>
                      <div>
                        <Text strong style={{ fontSize: 12 }}>{`{${v}}`}</Text>
                        <Input
                          size="small"
                          placeholder={`输入 ${v} 的值`}
                          value={previewVars[v] ?? ''}
                          onChange={(e) =>
                            setPreviewVars((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                          style={{ marginTop: 4 }}
                        />
                      </div>
                    </Col>
                  ))}
                </Row>
              </Card>
            )}

            {/* Rendered result */}
            {previewResult && (
              <Card
                size="small"
                title="生成结果"
                extra={
                  <Space>
                    {previewResult.content && (
                      <Tooltip title="复制文案">
                        <Button
                          size="small"
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(previewResult.content!)}
                        />
                      </Tooltip>
                    )}
                  </Space>
                }
              >
                {previewResult.content && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      文案:
                    </Text>
                    <Paragraph
                      style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 8, borderRadius: 4 }}
                    >
                      {previewResult.content}
                    </Paragraph>
                  </div>
                )}
                {previewResult.tags && (
                  <div>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      标签:
                    </Text>
                    <Paragraph
                      style={{ whiteSpace: 'pre-wrap', background: '#f0f5ff', padding: 8, borderRadius: 4, color: '#1890ff' }}
                    >
                      {previewResult.tags}
                    </Paragraph>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
