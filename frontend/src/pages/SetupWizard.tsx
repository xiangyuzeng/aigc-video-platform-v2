import { useState } from 'react';
import {
  Modal,
  Steps,
  Button,
  Form,
  Input,
  Result,
  Table,
  Space,
  Typography,
  message,
  Spin,
} from 'antd';
import {
  RocketOutlined,
  CheckCircleOutlined,
  ApiOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { createServer, type Server } from '../api/servers';
import {
  testServerConnection,
  syncServerProfiles,
  getProfiles,
  type Profile,
} from '../api/profiles';
import { setSetting } from '../api/appSettings';

const { Text, Link } = Typography;

interface SetupWizardProps {
  open: boolean;
  onFinish: () => void;
}

export default function SetupWizard({ open, onFinish }: SetupWizardProps) {
  const [current, setCurrent] = useState(0);
  const [server, setServer] = useState<Server | null>(null);
  const [connectionOk, setConnectionOk] = useState(false);
  const [syncedProfiles, setSyncedProfiles] = useState<Profile[]>([]);
  const [form] = Form.useForm();

  // --- Mutations ---

  const createServerMutation = useMutation({
    mutationFn: (data: { name: string; base_url: string }) => createServer(data),
    onSuccess: (srv) => {
      setServer(srv);
      setConnectionOk(false);
      message.success('服务器已添加');
    },
    onError: (err: Error) => {
      message.error(`添加失败: ${err.message}`);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (serverId: number) => testServerConnection(serverId),
    onSuccess: (result) => {
      if (result.ok) {
        setConnectionOk(true);
        message.success('连接成功');
      } else {
        setConnectionOk(false);
        message.error(`连接失败: ${result.message}`);
      }
    },
    onError: (err: Error) => {
      setConnectionOk(false);
      message.error(`测试失败: ${err.message}`);
    },
  });

  const syncProfilesMutation = useMutation({
    mutationFn: async (serverId: number) => {
      const syncResult = await syncServerProfiles(serverId);
      const profiles = await getProfiles({ server_id: serverId });
      return { syncResult, profiles };
    },
    onSuccess: ({ syncResult, profiles }) => {
      setSyncedProfiles(profiles);
      message.success(`同步完成，共 ${syncResult.synced} 个设备`);
    },
    onError: (err: Error) => {
      message.error(`同步失败: ${err.message}`);
    },
  });

  // --- Handlers ---

  const handleAddServer = async () => {
    try {
      const values = await form.validateFields();
      createServerMutation.mutate({
        name: values.name,
        base_url: values.base_url,
      });
    } catch {
      // validation failed
    }
  };

  const handleTestConnection = () => {
    if (server) {
      testConnectionMutation.mutate(server.id);
    }
  };

  const handleSync = () => {
    if (server) {
      syncProfilesMutation.mutate(server.id);
    }
  };

  const handleFinish = async () => {
    try {
      await setSetting('setup_completed', 'true');
    } catch {
      // ignore — non-critical
    }
    onFinish();
  };

  const handleSkip = async () => {
    try {
      await setSetting('setup_completed', 'true');
    } catch {
      // ignore
    }
    onFinish();
  };

  const next = () => setCurrent((c) => c + 1);
  const prev = () => setCurrent((c) => c - 1);

  // --- Step content ---

  const canProceedFromStep1 = !!server && connectionOk;
  const canProceedFromStep2 = syncedProfiles.length > 0;

  const profileColumns = [
    {
      title: '设备名称',
      dataIndex: 'profile_name',
      key: 'profile_name',
    },
    {
      title: '分组',
      dataIndex: 'group_name',
      key: 'group_name',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '序号',
      dataIndex: 'serial_number',
      key: 'serial_number',
      render: (v: string | null) => v ?? '-',
    },
  ];

  const steps = [
    {
      title: '欢迎使用',
      icon: <RocketOutlined />,
      content: (
        <Result
          icon={<RocketOutlined style={{ color: '#1677ff' }} />}
          title="欢迎使用肯葳科技电商视频发布平台"
          subTitle="本向导将帮助您完成初始设置：连接 AdsPower 反指纹浏览器并同步设备列表。只需几步即可开始使用。"
          extra={
            <Button type="primary" size="large" onClick={next}>
              开始设置
            </Button>
          }
        />
      ),
    },
    {
      title: '连接 AdsPower',
      icon: <ApiOutlined />,
      content: (
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              name: '我的 AdsPower',
              base_url: 'http://127.0.0.1:50325',
            }}
          >
            <Form.Item
              label="服务器名称"
              name="name"
              rules={[{ required: true, message: '请输入服务器名称' }]}
            >
              <Input placeholder="我的 AdsPower" />
            </Form.Item>
            <Form.Item
              label="AdsPower API 地址"
              name="base_url"
              rules={[{ required: true, message: '请输入 API 地址' }]}
            >
              <Input placeholder="http://127.0.0.1:50325" />
            </Form.Item>
          </Form>

          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              onClick={handleAddServer}
              loading={createServerMutation.isPending}
              disabled={!!server}
              block
            >
              添加服务器
            </Button>

            {server && (
              <Button
                onClick={handleTestConnection}
                loading={testConnectionMutation.isPending}
                icon={connectionOk ? <CheckCircleOutlined /> : undefined}
                block
              >
                测试连接
              </Button>
            )}

            {connectionOk && (
              <Result
                status="success"
                title="连接成功"
                subTitle={`已成功连接到 ${server?.name}`}
                style={{ padding: '16px 0' }}
              />
            )}
          </Space>
        </div>
      ),
    },
    {
      title: '同步设备',
      icon: <SyncOutlined />,
      content: (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleSync}
              loading={syncProfilesMutation.isPending}
              block
            >
              同步设备
            </Button>

            {syncProfilesMutation.isPending && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="正在同步设备列表..." />
              </div>
            )}

            {syncedProfiles.length > 0 && (
              <Table
                dataSource={syncedProfiles}
                columns={profileColumns}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 240 }}
              />
            )}
          </Space>
        </div>
      ),
    },
    {
      title: '完成',
      icon: <CheckCircleOutlined />,
      content: (
        <Result
          status="success"
          title="设置完成"
          subTitle={
            <Space direction="vertical">
              {server && <Text>已连接服务器: {server.name}</Text>}
              {syncedProfiles.length > 0 && (
                <Text>已同步 {syncedProfiles.length} 个设备</Text>
              )}
            </Space>
          }
          extra={
            <Button type="primary" size="large" onClick={handleFinish}>
              进入主界面
            </Button>
          }
        />
      ),
    },
  ];

  // --- Footer buttons ---

  const renderFooter = () => {
    if (current === 0) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Link onClick={handleSkip}>跳过设置</Link>
        </div>
      );
    }

    if (current === steps.length - 1) {
      // Last step — footer handled by the Result component's extra
      return null;
    }

    return (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={prev}>上一步</Button>
        <Button
          type="primary"
          onClick={next}
          disabled={
            (current === 1 && !canProceedFromStep1) ||
            (current === 2 && !canProceedFromStep2)
          }
        >
          下一步
        </Button>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      width={640}
      closable={false}
      maskClosable={false}
      footer={renderFooter()}
      title={
        <Steps
          current={current}
          size="small"
          items={steps.map((s) => ({ title: s.title, icon: s.icon }))}
        />
      }
    >
      {steps[current]?.content}
    </Modal>
  );
}
