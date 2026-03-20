import { useState } from 'react';
import { Typography, Table, Button, Modal, Form, Input, Tag, Space, Popconfirm, Alert, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServers, createServer, updateServer, deleteServer } from '../api/servers';
import type { Server } from '../api/servers';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import EmptyState from '../components/EmptyState';

interface ServerFormValues {
  name: string;
  base_url: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<ServerFormValues>();
  const queryClient = useQueryClient();

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: getServers,
  });

  const createMutation = useMutation({
    mutationFn: createServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      message.success('服务器已添加');
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServerFormValues> }) =>
      updateServer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      message.success('服务器已更新');
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteServer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      message.success('服务器已删除');
    },
  });

  const openAddModal = () => {
    setEditingServer(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (server: Server) => {
    setEditingServer(server);
    form.setFieldsValue({ name: server.name, base_url: server.base_url });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingServer(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editingServer) {
      updateMutation.mutate({ id: editingServer.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const columns: ColumnsType<Server> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '服务器地址',
      dataIndex: 'base_url',
      key: 'base_url',
    },
    {
      title: '默认',
      dataIndex: 'is_default',
      key: 'is_default',
      render: (isDefault: boolean) =>
        isDefault ? <Tag color="blue">默认</Tag> : null,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: Server) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此服务器？关联的设备配置将一并删除。"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap' }}>服务器</Typography.Title>
          <Typography.Text type="secondary">管理 AdsPower 服务器连接</Typography.Text>
        </div>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            添加服务器
          </Button>
          {servers.length > 0 && (
            <Button icon={<ArrowRightOutlined />} onClick={() => navigate('/profiles')}>
              下一步：同步设备
            </Button>
          )}
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="第一步：添加 AdsPower 服务器地址。在 AdsPower 客户端 → API & MCP 页面查看（如 http://127.0.0.1:50325）。添加后前往「设备」页面同步浏览器环境。"
        style={{ marginBottom: 16 }}
        closable
      />

      {servers.length === 0 && !isLoading ? (
        <EmptyState
          description="还没有添加服务器"
          actionText="添加服务器"
          onAction={openAddModal}
        />
      ) : (
        <Table<Server>
          columns={columns}
          dataSource={servers}
          rowKey="id"
          loading={isLoading}
          pagination={false}
        />
      )}

      <Modal
        title={editingServer ? '编辑服务器' : '添加服务器'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={closeModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="我的 AdsPower 服务器" />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="服务器地址"
            rules={[{ required: true, message: '请输入服务器地址' }]}
          >
            <Input placeholder="http://127.0.0.1:50325" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
