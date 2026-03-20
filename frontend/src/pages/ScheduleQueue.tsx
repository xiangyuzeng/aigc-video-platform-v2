import { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Statistic,
  Button,
  Typography,
  Spin,
  Empty,
  Tabs,
  Badge,
  Tooltip,
  message,
  Calendar,
} from 'antd';
import { DatePicker } from 'antd';
import {
  ReloadOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  getScheduleQueue,
  retryTask,
  getCalendarData,
  type QueueTask,
  type CalendarDay,
} from '../api/schedule';
import { TASK_STATUS } from '../utils/statusLabels';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const STATUS_TABS = [
  { key: '', label: '全部' },
  { key: 'queued', label: '排队中' },
  { key: 'published', label: '已发布' },
  { key: 'failed', label: '失败' },
];

export default function ScheduleQueue() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs().add(30, 'day'),
  ]);
  const [statusFilter, setStatusFilter] = useState('');
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());

  const dateFrom = dateRange[0].format('YYYY-MM-DD');
  const dateTo = dateRange[1].format('YYYY-MM-DD');

  // Fetch queue data
  const { data: queueTasks = [], isLoading } = useQuery({
    queryKey: ['schedule-queue', dateFrom, dateTo, statusFilter],
    queryFn: () =>
      getScheduleQueue({
        date_from: dateFrom,
        date_to: dateTo,
        status: statusFilter || undefined,
      }),
    refetchInterval: 30000,
  });

  // Fetch calendar data
  const { data: calendarData = [] } = useQuery({
    queryKey: ['schedule-calendar', calendarMonth.year(), calendarMonth.month() + 1],
    queryFn: () => getCalendarData(calendarMonth.year(), calendarMonth.month() + 1),
    refetchInterval: 30000,
  });

  // Retry mutation
  const retryMutation = useMutation({
    mutationFn: retryTask,
    onSuccess: () => {
      message.success('任务已重新排队');
      queryClient.invalidateQueries({ queryKey: ['schedule-queue'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-calendar'] });
    },
    onError: (err: Error) => {
      message.error(err.message || '重试失败');
    },
  });

  // Summary stats
  const totalQueued = queueTasks.filter((t) => t.status === 'queued').length;
  const todayStr = dayjs().format('YYYY-MM-DD');
  const publishingToday = queueTasks.filter(
    (t) =>
      t.scheduled_at &&
      dayjs(t.scheduled_at).format('YYYY-MM-DD') === todayStr &&
      ['queued', 'uploading', 'publishing'].includes(t.status),
  ).length;
  const totalFailed = queueTasks.filter((t) => t.status === 'failed').length;

  // Build calendar data map
  const calendarMap: Record<string, CalendarDay> = {};
  calendarData.forEach((d) => {
    calendarMap[d.date] = d;
  });

  const dateCellRender = (value: Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    const dayData = calendarMap[dateStr];
    if (!dayData || dayData.total === 0) return null;
    return (
      <div style={{ fontSize: 11, lineHeight: '18px' }}>
        {dayData.published > 0 && (
          <div>
            <Badge color="#52c41a" text={<span style={{ fontSize: 11 }}>{dayData.published} 已发布</span>} />
          </div>
        )}
        {dayData.queued > 0 && (
          <div>
            <Badge color="#1890ff" text={<span style={{ fontSize: 11 }}>{dayData.queued} 排队中</span>} />
          </div>
        )}
        {dayData.failed > 0 && (
          <div>
            <Badge color="#ff4d4f" text={<span style={{ fontSize: 11 }}>{dayData.failed} 失败</span>} />
          </div>
        )}
      </div>
    );
  };

  const columns: ColumnsType<QueueTask> = [
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
      width: 100,
      render: (status: string) => {
        const info = TASK_STATUS[status] || { color: 'default', label: status };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_at',
      key: 'scheduled_at',
      width: 180,
      render: (val: string | null) =>
        val ? dayjs(val).format('YYYY-MM-DD HH:mm') : <span style={{ color: '#999' }}>未设置</span>,
      sorter: (a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return a.scheduled_at.localeCompare(b.scheduled_at);
      },
    },
    {
      title: '时区',
      dataIndex: 'timezone',
      key: 'timezone',
      width: 160,
      ellipsis: true,
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      ellipsis: true,
      render: (val: string | null) =>
        val ? (
          <Tooltip title={val}>
            <span style={{ color: '#ff4d4f' }}>{val}</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: QueueTask) =>
        record.status === 'failed' ? (
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate(record.id)}
          >
            重试
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          智能排期
        </Title>
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([dates[0], dates[1]]);
            }
          }}
          presets={[
            { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
            { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
            { label: '未来7天', value: [dayjs(), dayjs().add(7, 'day')] },
            { label: '未来30天', value: [dayjs(), dayjs().add(30, 'day')] },
          ]}
        />
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="排队中"
              value={totalQueued}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="今日发布"
              value={publishingToday}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="失败（可重试）"
              value={totalFailed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: totalFailed > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Calendar View */}
      <Card style={{ marginBottom: 24 }} title={<><CalendarOutlined /> 排期日历</>}>
        <Calendar
          fullscreen={false}
          value={calendarMonth}
          onChange={(val) => setCalendarMonth(val)}
          cellRender={(current, info) => {
            if (info.type === 'date') return dateCellRender(current);
            return null;
          }}
        />
      </Card>

      {/* Task Queue Table */}
      <Card>
        <Tabs
          activeKey={statusFilter}
          onChange={(key) => setStatusFilter(key)}
          items={STATUS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
          style={{ marginBottom: 16 }}
        />
        {isLoading ? (
          <Spin size="large" style={{ display: 'block', textAlign: 'center', margin: '48px 0' }} />
        ) : queueTasks.length === 0 ? (
          <Empty description="暂无排期任务" style={{ margin: '48px 0' }} />
        ) : (
          <Table
            columns={columns}
            dataSource={queueTasks}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
}
