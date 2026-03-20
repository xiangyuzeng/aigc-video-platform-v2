import { useState } from 'react';
import { Row, Col, Card, Checkbox, Button, Select, Input, Tag, Space, Badge, Alert, message } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getServers } from '../../api/servers';
import { getProfiles, getProfileGroups, testServerConnection, syncServerProfiles } from '../../api/profiles';
import { usePublishStore } from '../../stores/publishStore';
import type { WizardProfile } from '../../stores/publishStore';

const PLATFORM_OPTIONS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
];

export default function StepProfiles() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const selectedProfiles = usePublishStore((s) => s.selectedProfiles);
  const toggleProfile = usePublishStore((s) => s.toggleProfile);
  const selectAllInGroup = usePublishStore((s) => s.selectAllInGroup);
  const clearProfiles = usePublishStore((s) => s.clearProfiles);
  const setStep = usePublishStore((s) => s.setStep);

  // Filters
  const [serverId, setServerId] = useState<number | undefined>(undefined);
  const [groupName, setGroupName] = useState<string | undefined>(undefined);
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');

  // Data fetching
  const { data: servers = [] } = useQuery({
    queryKey: ['servers'],
    queryFn: getServers,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['profile-groups'],
    queryFn: getProfileGroups,
  });

  // Default to first server with is_default, or first server
  const effectiveServerId = serverId ?? servers.find((s) => s.is_default)?.id ?? servers[0]?.id;

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles', { server_id: effectiveServerId, group_name: groupName, platform, search: search || undefined }],
    queryFn: () =>
      getProfiles({
        server_id: effectiveServerId,
        group_name: groupName,
        platform,
        search: search || undefined,
      }),
    enabled: effectiveServerId !== undefined,
  });

  // Mutations
  const testMutation = useMutation({
    mutationFn: testServerConnection,
    onSuccess: (data) => {
      if (data.ok) {
        void message.success(data.message || '连接成功');
      } else {
        void message.error(data.message || '连接失败');
      }
    },
    onError: () => {
      void message.error('连接测试失败');
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncServerProfiles,
    onSuccess: (data) => {
      if (data.ok) {
        void message.success(`同步成功，共 ${data.synced} 个设备`);
        void queryClient.invalidateQueries({ queryKey: ['profiles'] });
        void queryClient.invalidateQueries({ queryKey: ['profile-groups'] });
      } else {
        void message.error('同步失败');
      }
    },
    onError: () => {
      void message.error('同步设备失败');
    },
  });

  const handleTestConnection = () => {
    if (effectiveServerId === undefined) {
      void message.warning('请先选择服务器');
      return;
    }
    testMutation.mutate(effectiveServerId);
  };

  const handleSync = () => {
    if (effectiveServerId === undefined) {
      void message.warning('请先选择服务器');
      return;
    }
    syncMutation.mutate(effectiveServerId);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const selectedIdSet = new Set(selectedProfiles.map((sp) => sp.id));

  const isSelected = (profileId: number) => selectedIdSet.has(profileId);

  const toWizardProfile = (p: { id: number; profile_id: string; profile_name: string; group_name: string | null }): WizardProfile => ({
    id: p.id,
    profile_id: p.profile_id,
    profile_name: p.profile_name,
    group_name: p.group_name,
  });

  const handleSelectAllInGroup = () => {
    const wizardProfiles = profiles.map(toWizardProfile);
    selectAllInGroup(wizardProfiles);
  };

  const handleNextStep = () => {
    setStep(1);
  };

  const serverOptions = servers.map((s) => ({
    value: s.id,
    label: s.name,
  }));

  const groupOptions = groups.map((g) => ({
    value: g,
    label: g,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top toolbar */}
      <div style={{ marginBottom: 16 }}>
        <Space wrap size={[8, 8]}>
          <Select
            style={{ width: 180 }}
            placeholder="选择服务器"
            value={effectiveServerId}
            onChange={(val: number) => setServerId(val)}
            options={serverOptions}
          />
          <Button
            onClick={handleTestConnection}
            loading={testMutation.isPending}
          >
            测试连接
          </Button>
          <Button
            icon={<SyncOutlined />}
            onClick={handleSync}
            loading={syncMutation.isPending}
          >
            同步设备
          </Button>
          <Select
            style={{ width: 160 }}
            allowClear
            placeholder="全部分组"
            value={groupName}
            onChange={(val: string | undefined) => setGroupName(val)}
            options={groupOptions}
          />
          <Select
            style={{ width: 140 }}
            allowClear
            placeholder="平台"
            value={platform}
            onChange={(val: string | undefined) => setPlatform(val)}
            options={PLATFORM_OPTIONS}
          />
          <Input.Search
            placeholder="搜索设备..."
            style={{ width: 200 }}
            onSearch={handleSearch}
            allowClear
          />
        </Space>
      </div>

      {/* Profile grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Row gutter={[16, 16]}>
          {profilesLoading ? (
            <Col span={24} style={{ textAlign: 'center', padding: 48 }}>
              加载中...
            </Col>
          ) : profiles.length === 0 ? (
            <Col span={24} style={{ padding: 48 }}>
              {servers.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="请先添加服务器"
                  description="在设置页面添加 AdsPower 服务器地址后，才能同步设备。"
                  action={
                    <Button type="primary" size="small" onClick={() => navigate('/settings')}>
                      前往设置
                    </Button>
                  }
                />
              ) : (
                <Alert
                  type="info"
                  showIcon
                  message="暂无设备"
                  description="请点击上方「同步设备」按钮从 AdsPower 服务器拉取设备列表。"
                  action={
                    <Space>
                      <Button type="primary" size="small" onClick={handleSync} loading={syncMutation.isPending}>
                        同步设备
                      </Button>
                      <Button size="small" onClick={() => navigate('/profiles')}>
                        设备管理
                      </Button>
                    </Space>
                  }
                />
              )}
            </Col>
          ) : (
            profiles.map((p) => {
              const selected = isSelected(p.id);
              return (
                <Col span={6} key={p.id}>
                  <Card
                    hoverable
                    size="small"
                    style={{
                      border: selected ? '2px solid #1677ff' : '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    bodyStyle={{ padding: 12 }}
                    onClick={() => toggleProfile(toWizardProfile(p))}
                  >
                    <div style={{ position: 'relative' }}>
                      <Checkbox
                        checked={selected}
                        style={{ position: 'absolute', top: 0, right: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleProfile(toWizardProfile(p))}
                      />
                      <div style={{ fontWeight: 600, marginBottom: 4, paddingRight: 24 }}>
                        {p.profile_name}
                      </div>
                      <Space size={[4, 4]} wrap>
                        {p.group_name && (
                          <Tag color="blue">{p.group_name}</Tag>
                        )}
                        {p.platform && (
                          <Tag>{p.platform}</Tag>
                        )}
                      </Space>
                      {p.serial_number && (
                        <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                          #{p.serial_number}
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
              );
            })
          )}
        </Row>
      </div>

      {/* Footer bar */}
      <div
        style={{
          marginTop: 16,
          padding: '12px 0',
          borderTop: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Badge count={selectedProfiles.length} showZero overflowCount={999}>
            <span style={{ padding: '0 8px' }}>已选设备</span>
          </Badge>
          <Button onClick={handleSelectAllInGroup}>
            全选当前分组
          </Button>
          <Button onClick={clearProfiles}>
            清空选择
          </Button>
        </Space>
        <Button
          type="primary"
          disabled={selectedProfiles.length === 0}
          onClick={handleNextStep}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
