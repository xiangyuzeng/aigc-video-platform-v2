import { Row, Col, Card, Table, Tag, Progress, Statistic, Button, Typography, Space, Empty, Spin } from 'antd';
import { DownloadOutlined, AlertOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { getAccountHealth, exportHealthCSV, type AccountHealth as AccountHealthData } from '../api/health';

const { Title } = Typography;

function getSuccessRateColor(rate: number): string {
  if (rate >= 80) return '#52c41a';
  if (rate >= 50) return '#faad14';
  return '#ff4d4f';
}

function getHealthScoreStatus(score: number): 'success' | 'normal' | 'exception' {
  if (score >= 70) return 'success';
  if (score >= 40) return 'normal';
  return 'exception';
}

const columns: ColumnsType<AccountHealthData> = [
  {
    title: '设备名称',
    dataIndex: 'profile_name',
    key: 'profile_name',
    ellipsis: true,
    sorter: (a, b) => a.profile_name.localeCompare(b.profile_name),
  },
  {
    title: '分组',
    dataIndex: 'group_name',
    key: 'group_name',
    render: (val: string | null) => val || '-',
    filters: [],
    onFilter: (value, record) => record.group_name === value,
  },
  {
    title: '发布总数',
    dataIndex: 'total_posts',
    key: 'total_posts',
    sorter: (a, b) => a.total_posts - b.total_posts,
    width: 100,
  },
  {
    title: '成功率',
    dataIndex: 'success_rate',
    key: 'success_rate',
    sorter: (a, b) => a.success_rate - b.success_rate,
    width: 100,
    render: (val: number) => (
      <span style={{ color: getSuccessRateColor(val), fontWeight: 600 }}>
        {val.toFixed(1)}%
      </span>
    ),
  },
  {
    title: '最后发布',
    dataIndex: 'last_publish_time',
    key: 'last_publish_time',
    sorter: (a, b) => {
      if (!a.last_publish_time && !b.last_publish_time) return 0;
      if (!a.last_publish_time) return 1;
      if (!b.last_publish_time) return -1;
      return a.last_publish_time.localeCompare(b.last_publish_time);
    },
    render: (val: string | null) =>
      val ? dayjs(val).format('YYYY-MM-DD HH:mm') : <span style={{ color: '#999' }}>从未发布</span>,
  },
  {
    title: '健康分数',
    dataIndex: 'health_score',
    key: 'health_score',
    sorter: (a, b) => a.health_score - b.health_score,
    width: 160,
    render: (val: number) => (
      <Progress
        percent={val}
        size="small"
        status={getHealthScoreStatus(val)}
        format={(percent) => `${percent}`}
      />
    ),
  },
  {
    title: '警告',
    dataIndex: 'alerts',
    key: 'alerts',
    render: (alerts: string[]) =>
      alerts.length > 0 ? (
        <Space size={4} wrap>
          {alerts.map((alert, i) => (
            <Tag color="red" key={i}>
              {alert}
            </Tag>
          ))}
        </Space>
      ) : (
        <Tag color="green">正常</Tag>
      ),
  },
];

export default function AccountHealth() {
  const { data: healthData = [], isLoading } = useQuery({
    queryKey: ['account-health'],
    queryFn: getAccountHealth,
    refetchInterval: 60000,
  });

  const handleExport = async () => {
    await exportHealthCSV();
  };

  // Build dynamic group filters from data
  const groupFilters = Array.from(new Set(healthData.map((d) => d.group_name).filter(Boolean))).map(
    (g) => ({ text: g as string, value: g as string }),
  );
  const columnsWithFilters = columns.map((col) => {
    if (col.key === 'group_name') {
      return { ...col, filters: groupFilters };
    }
    return col;
  });

  // Summary stats
  const totalAccounts = healthData.length;
  const avgHealthScore =
    totalAccounts > 0
      ? Math.round(healthData.reduce((sum, d) => sum + d.health_score, 0) / totalAccounts)
      : 0;
  const accountsWithAlerts = healthData.filter((d) => d.alerts.length > 0).length;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          账号健康
        </Title>
        <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={healthData.length === 0}>
          导出 CSV
        </Button>
      </div>

      {isLoading ? (
        <Spin size="large" style={{ display: 'block', textAlign: 'center', margin: '48px 0' }} />
      ) : healthData.length === 0 ? (
        <Empty description="暂无设备数据，请先同步设备" style={{ margin: '80px 0' }} />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic title="设备总数" value={totalAccounts} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="平均健康分数"
                  value={avgHealthScore}
                  suffix="/ 100"
                  valueStyle={{
                    color: avgHealthScore >= 70 ? '#52c41a' : avgHealthScore >= 40 ? '#faad14' : '#ff4d4f',
                  }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="有警告的设备"
                  value={accountsWithAlerts}
                  prefix={<AlertOutlined />}
                  valueStyle={{ color: accountsWithAlerts > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>
          </Row>

          <Card>
            <Table
              columns={columnsWithFilters}
              dataSource={healthData}
              rowKey="profile_id"
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
              size="middle"
            />
          </Card>
        </>
      )}
    </div>
  );
}
