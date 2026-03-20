import { useState } from 'react';
import { Typography, Table, Button, Select, Input, Tag, Space, Alert, Popconfirm, message } from 'antd';
import { SyncOutlined, ApiOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getServers } from '../api/servers';
import type { Server } from '../api/servers';
import {
  getProfiles,
  getProfileGroups,
  updateProfile,
  deleteProfile,
  testServerConnection,
  syncServerProfiles,
} from '../api/profiles';
import type { Profile } from '../api/profiles';
import type { ColumnsType } from 'antd/es/table';
import EmptyState from '../components/EmptyState';

const { Title } = Typography;

const PLATFORM_OPTIONS = [
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'Facebook', value: 'facebook' },
];

export default function Profiles() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  // --- filters ---
  const [selectedServerId, setSelectedServerId] = useState<number | undefined>(undefined);
  const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined);
  const [platformFilter, setPlatformFilter] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // --- queries ---
  const { data: servers } = useQuery<Server[]>({
    queryKey: ['servers'],
    queryFn: getServers,
  });

  // Auto-select default server once loaded
  const effectiveServerId =
    selectedServerId ?? servers?.find((s) => s.is_default)?.id ?? servers?.[0]?.id;

  const { data: profiles, isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ['profiles', effectiveServerId, groupFilter, platformFilter, searchText],
    queryFn: () =>
      getProfiles({
        server_id: effectiveServerId,
        group_name: groupFilter,
        platform: platformFilter,
        search: searchText || undefined,
      }),
    enabled: !!effectiveServerId,
  });

  const { data: groups } = useQuery<string[]>({
    queryKey: ['profile-groups'],
    queryFn: getProfileGroups,
  });

  // --- mutations ---
  const testMutation = useMutation({
    mutationFn: (serverId: number) => testServerConnection(serverId),
    onSuccess: (res) => {
      if (res.ok) {
        messageApi.success('连接成功');
      } else {
        messageApi.error(`连接失败: ${res.message}`);
      }
    },
    onError: (err: Error) => {
      messageApi.error(`连接失败: ${err.message}`);
    },
  });

  const syncMutation = useMutation({
    mutationFn: (serverId: number) => syncServerProfiles(serverId),
    onSuccess: (res) => {
      if (res.ok) {
        messageApi.success(`已同步 ${res.synced} 条`);
        void queryClient.invalidateQueries({ queryKey: ['profiles'] });
        void queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      } else {
        messageApi.error('同步失败');
      }
    },
    onError: (err: Error) => {
      messageApi.error(`同步失败: ${err.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { label?: string; platform?: string } }) =>
      updateProfile(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
    onError: (err: Error) => {
      messageApi.error(`更新失败: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProfile(id),
    onSuccess: () => {
      messageApi.success('已删除');
      void queryClient.invalidateQueries({ queryKey: ['profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
    onError: (err: Error) => {
      messageApi.error(`删除失败: ${err.message}`);
    },
  });

  // --- inline editing helpers ---
  function startEditing(id: number, field: string, currentValue: string) {
    setEditingCell({ id, field });
    setEditValue(currentValue);
  }

  function commitEdit(id: number, field: string) {
    setEditingCell(null);
    updateMutation.mutate({ id, data: { [field]: editValue } });
  }

  function commitPlatformEdit(id: number, value: string) {
    setEditingCell(null);
    updateMutation.mutate({ id, data: { platform: value } });
  }

  // --- table columns ---
  const columns: ColumnsType<Profile> = [
    {
      title: '名称',
      dataIndex: 'profile_name',
      key: 'profile_name',
      ellipsis: true,
    },
    {
      title: '分组',
      dataIndex: 'group_name',
      key: 'group_name',
      width: 120,
      render: (val: string | null) => (val ? <Tag>{val}</Tag> : '-'),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 140,
      render: (val: string, record: Profile) => {
        if (editingCell?.id === record.id && editingCell.field === 'platform') {
          return (
            <Select
              size="small"
              autoFocus
              defaultOpen
              value={val}
              options={PLATFORM_OPTIONS}
              style={{ width: '100%' }}
              onChange={(v: string) => commitPlatformEdit(record.id, v)}
              onBlur={() => setEditingCell(null)}
            />
          );
        }
        return (
          <Tag
            style={{ cursor: 'pointer' }}
            onClick={() => startEditing(record.id, 'platform', val)}
          >
            {val || '点击设置'}
          </Tag>
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      width: 160,
      render: (val: string | null, record: Profile) => {
        if (editingCell?.id === record.id && editingCell.field === 'label') {
          return (
            <Input
              size="small"
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit(record.id, 'label')}
              onPressEnter={() => commitEdit(record.id, 'label')}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: val ? undefined : '#bbb' }}
            onClick={() => startEditing(record.id, 'label', val ?? '')}
          >
            {val || '点击编辑'}
          </span>
        );
      },
    },
    {
      title: '编号',
      dataIndex: 'serial_number',
      key: 'serial_number',
      width: 80,
      render: (val: string | null) => val ?? '-',
    },
    {
      title: '最后同步',
      dataIndex: 'last_synced_at',
      key: 'last_synced_at',
      width: 170,
      render: (val: string | null) => {
        if (!val) return '-';
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
      width: 80,
      render: (_: unknown, record: Profile) => (
        <Popconfirm
          title="确定删除此设备？"
          description="关联的发布任务也会被删除"
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  // --- render ---
  return (
    <div style={{ padding: 24 }}>
      {contextHolder}
      <Title level={4}>设备管理</Title>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="如何使用设备管理"
        description="设备列表从 AdsPower 同步。先在「服务器」页面添加服务器地址，然后点击「同步设备」拉取浏览器环境。同步完成后，前往「视频」上传视频，或直接使用「发布」功能。"
        style={{ marginBottom: 16 }}
        closable
      />

      {servers && servers.length === 0 && (
        <Alert
          type="warning"
          showIcon
          message="请先添加服务器"
          description="在设置页面添加 AdsPower 服务器后，才能同步和管理设备。"
          action={
            <Button type="primary" size="small" onClick={() => navigate('/settings')}>
              前往设置
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 200 }}
          placeholder="选择服务器"
          value={effectiveServerId}
          onChange={(val: number) => setSelectedServerId(val)}
          options={servers?.map((s) => ({ label: s.name, value: s.id }))}
        />

        <Button
          icon={<ApiOutlined />}
          loading={testMutation.isPending}
          disabled={!effectiveServerId}
          onClick={() => {
            if (effectiveServerId) testMutation.mutate(effectiveServerId);
          }}
        >
          测试连接
        </Button>

        <Button
          type="primary"
          icon={<SyncOutlined />}
          loading={syncMutation.isPending}
          disabled={!effectiveServerId}
          onClick={() => {
            if (effectiveServerId) syncMutation.mutate(effectiveServerId);
          }}
        >
          同步设备
        </Button>

        <Select
          style={{ width: 150 }}
          allowClear
          placeholder="筛选分组"
          value={groupFilter}
          onChange={(val: string | undefined) => setGroupFilter(val)}
          options={groups?.map((g) => ({ label: g, value: g }))}
        />

        <Select
          style={{ width: 150 }}
          allowClear
          placeholder="筛选平台"
          value={platformFilter}
          onChange={(val: string | undefined) => setPlatformFilter(val)}
          options={PLATFORM_OPTIONS}
        />

        <Input.Search
          style={{ width: 200 }}
          placeholder="搜索设备..."
          allowClear
          onSearch={(val: string) => setSearchText(val)}
        />
      </Space>

      {(!profiles || profiles.length === 0) && !profilesLoading ? (
        <EmptyState
          description="还没有同步设备"
          actionText="前往服务器管理"
          onAction={() => navigate('/settings')}
        />
      ) : (
        <Table<Profile>
          rowKey="id"
          columns={columns}
          dataSource={profiles}
          loading={profilesLoading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          size="middle"
          scroll={{ x: 700 }}
        />
      )}
    </div>
  );
}
