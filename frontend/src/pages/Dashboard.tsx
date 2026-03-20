import { useState } from 'react';
import { Row, Col, Card, Table, Tag, Button, Space, Skeleton, Statistic, Typography } from 'antd';
import {
  LaptopOutlined,
  PlaySquareOutlined,
  SendOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  SyncOutlined,
  UploadOutlined,
  SearchOutlined,
  RocketOutlined,
  BarChartOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getOverview } from '../api/analytics';
import { getTasks, type TaskData } from '../api/tasks';
import { TASK_STATUS } from '../utils/statusLabels';
import QuickPipeline from '../components/QuickPipeline';

const { Title, Text } = Typography;

const columns = [
  {
    title: '任务名称',
    dataIndex: 'task_name',
    key: 'task_name',
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const cfg = TASK_STATUS[status] ?? { color: 'default', label: status };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    render: (val: string) => new Date(val).toLocaleString('zh-CN', { hour12: false }),
  },
];

const WORKFLOW_STEPS = [
  {
    key: 'settings',
    title: '配置服务器',
    desc: '添加 AdsPower 服务器地址',
    icon: <SettingOutlined />,
    route: '/settings',
    checkField: 'total_profiles' as const,
  },
  {
    key: 'profiles',
    title: '同步设备',
    desc: '从 AdsPower 拉取浏览器环境',
    icon: <SyncOutlined />,
    route: '/profiles',
    checkField: 'total_profiles' as const,
  },
  {
    key: 'videos',
    title: '上传视频',
    desc: '上传要发布的短视频文件',
    icon: <UploadOutlined />,
    route: '/videos',
    checkField: 'total_videos' as const,
  },
  {
    key: 'scraper',
    title: '采集文案',
    desc: '从 TikTok 采集文案和标签',
    icon: <SearchOutlined />,
    route: '/scraper',
    checkField: 'total_scraped' as const,
  },
  {
    key: 'publish',
    title: '批量发布',
    desc: '选择设备和视频，一键发布',
    icon: <RocketOutlined />,
    route: '/publish',
    checkField: 'total_tasks' as const,
  },
  {
    key: 'analytics',
    title: '查看数据',
    desc: '分析发布效果和成功率',
    icon: <BarChartOutlined />,
    route: '/analytics',
    checkField: 'total_published' as const,
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [quickPipelineOpen, setQuickPipelineOpen] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: getOverview,
    refetchInterval: 30000,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['recent-tasks'],
    queryFn: () => getTasks(),
    refetchInterval: 30000,
  });

  const recentTasks = (tasks ?? []).slice(0, 20);

  // Determine which workflow steps are "done" based on data
  const getStepStatus = (step: typeof WORKFLOW_STEPS[0]): 'finish' | 'process' | 'wait' => {
    if (!overview || !step.checkField) return 'wait';
    const val = overview[step.checkField];
    return val && val > 0 ? 'finish' : 'wait';
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Dashboard</Title>
        <Text type="secondary">肯葳科技电商视频发布平台概览</Text>
      </div>

      {/* Workflow Illustration */}
      <Card
        title="使用流程"
        style={{ marginBottom: 24 }}
        extra={<Text type="secondary">点击任意步骤跳转</Text>}
      >
        <Row gutter={[8, 16]} align="middle" justify="center">
          {WORKFLOW_STEPS.map((step, idx) => (
            <Col key={step.key} flex="none" style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Card
                  hoverable
                  size="small"
                  onClick={() => navigate(step.route)}
                  style={{
                    width: 140,
                    textAlign: 'center',
                    borderColor: getStepStatus(step) === 'finish' ? '#52c41a' : undefined,
                    background: getStepStatus(step) === 'finish' ? '#f6ffed' : undefined,
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 4, color: getStepStatus(step) === 'finish' ? '#52c41a' : '#1677ff' }}>
                    {step.icon}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {`${idx + 1}. ${step.title}`}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{step.desc}</Text>
                  {getStepStatus(step) === 'finish' && (
                    <div style={{ marginTop: 4 }}>
                      <Tag color="success" style={{ margin: 0 }}>已完成</Tag>
                    </div>
                  )}
                </Card>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRightOutlined style={{ fontSize: 18, color: '#bbb' }} />
                )}
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Stats */}
      {overviewLoading ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <Col span={6} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="设备总数"
                value={overview?.total_profiles ?? 0}
                prefix={<LaptopOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="视频总数"
                value={overview?.total_videos ?? 0}
                prefix={<PlaySquareOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="今日任务"
                value={overview?.tasks_today ?? 0}
                prefix={<SendOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功率 (7天)"
                value={overview?.success_rate ?? 0}
                precision={1}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: (overview?.success_rate ?? 0) >= 80 ? '#52c41a' : '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick Actions */}
      <Card style={{ marginBottom: 24 }}>
        <Space>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setQuickPipelineOpen(true)}>
            一键生成
          </Button>
          <Button icon={<RocketOutlined />} onClick={() => navigate('/publish')}>
            新建发布
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => navigate('/videos')}>
            上传视频
          </Button>
          <Button icon={<SyncOutlined />} onClick={() => navigate('/profiles')}>
            同步设备
          </Button>
          <Button icon={<SearchOutlined />} onClick={() => navigate('/scraper')}>
            采集文案
          </Button>
        </Space>
      </Card>

      <QuickPipeline open={quickPipelineOpen} onClose={() => setQuickPipelineOpen(false)} />

      {/* Recent Tasks */}
      <Card title="最近任务">
        {tasksLoading ? (
          <Skeleton active paragraph={{ rows: 5 }} />
        ) : (
          <Table<TaskData>
            dataSource={recentTasks}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
}
