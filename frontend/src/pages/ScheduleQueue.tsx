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
  Modal,
  Form,
  Select,
  DatePicker,
  InputNumber,
  Space,
} from 'antd';
import { DatePicker as AntDatePicker } from 'antd';
import {
  ReloadOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Alert } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  getScheduleQueue,
  retryTask,
  getCalendarData,
  getOptimalSlots,
  type QueueTask,
  type CalendarDay,
} from '../api/schedule';
import { createTask, type TaskCreatePayload } from '../api/tasks';
import { getProfiles, type Profile } from '../api/profiles';
import { getVideos } from '../api/videos';
import { TASK_STATUS } from '../utils/statusLabels';

const { Title, Text } = Typography;
const { RangePicker } = AntDatePicker;

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
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [form] = Form.useForm();

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

  // Fetch optimal slots
  const { data: optimalSlots = [] } = useQuery({
    queryKey: ['optimal-slots'],
    queryFn: getOptimalSlots,
  });

  // Fetch profiles and videos for the create form
  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: () => getProfiles({}),
  });

  const { data: videoData } = useQuery({
    queryKey: ['videos-for-schedule'],
    queryFn: () => getVideos({ limit: 100 }),
  });
  const videos = videoData?.items ?? [];

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

  // Create scheduled task mutation
  const createMutation = useMutation({
    mutationFn: (payload: TaskCreatePayload) => createTask(payload),
    onSuccess: () => {
      message.success('排期任务已创建');
      setScheduleModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['schedule-queue'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-calendar'] });
    },
    onError: (err: Error) => {
      message.error(`创建失败: ${err.message}`);
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

  function handleScheduleSubmit() {
    form.validateFields().then((values) => {
      const { profile_ids, video_id, scheduled_at, timezone, interval_minutes } = values;
      const baseTime = (scheduled_at as Dayjs).toISOString();

      // Create one task per profile, staggered by interval
      const tasks: TaskCreatePayload[] = (profile_ids as number[]).map((pid, idx) => ({
        task_name: `schedule_${dayjs().format('YYYYMMDD_HHmmss')}_${idx + 1}`,
        profile_id: pid,
        video_id,
        scheduled_at: dayjs(baseTime).add(idx * (interval_minutes || 0), 'minute').toISOString(),
        timezone: timezone || 'America/Mexico_City',
        status: 'queued',
      }));

      // Create tasks sequentially
      Promise.all(tasks.map((t) => createMutation.mutateAsync(t)))
        .then(() => {
          message.success(`已创建 ${tasks.length} 个排期任务`);
          setScheduleModalOpen(false);
          form.resetFields();
          queryClient.invalidateQueries({ queryKey: ['schedule-queue'] });
          queryClient.invalidateQueries({ queryKey: ['schedule-calendar'] });
        })
        .catch(() => {});
    });
  }

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
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          智能排期
        </Title>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setScheduleModalOpen(true)}>
            新建排期
          </Button>
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
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="智能排期"
        description="管理定时发布任务。任务按预定时间自动执行，可在此查看排期和执行状态。"
        closable
        style={{ marginBottom: 16 }}
      />

      {/* Optimal time slots hint */}
      {optimalSlots.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}>
          <Space wrap>
            <Text strong><ClockCircleOutlined /> TikTok 最佳发布时段：</Text>
            {optimalSlots.map((slot) => (
              <Tag color="green" key={slot.label}>{slot.label} ({slot.start}-{slot.end})</Tag>
            ))}
          </Space>
        </Card>
      )}

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
          <Empty
            description="暂无排期任务"
            style={{ margin: '48px 0' }}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setScheduleModalOpen(true)}>
              创建排期
            </Button>
          </Empty>
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

      {/* Create Schedule Modal */}
      <Modal
        title="新建排期任务"
        open={scheduleModalOpen}
        onCancel={() => { setScheduleModalOpen(false); form.resetFields(); }}
        onOk={handleScheduleSubmit}
        okText="创建"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ timezone: 'America/Mexico_City', interval_minutes: 5 }}>
          <Form.Item name="profile_ids" label="目标设备" rules={[{ required: true, message: '请选择至少一个设备' }]}>
            <Select
              mode="multiple"
              placeholder="选择要发布的设备"
              optionFilterProp="label"
              options={profiles.map((p) => ({
                value: p.id,
                label: `${p.profile_name} (${p.group_name || '未分组'})`,
              }))}
            />
          </Form.Item>

          <Form.Item name="video_id" label="视频" rules={[{ required: true, message: '请选择视频' }]}>
            <Select
              placeholder="选择要发布的视频"
              showSearch
              optionFilterProp="label"
              options={videos.map((v) => ({
                value: v.id,
                label: v.title || `视频 #${v.id}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="scheduled_at" label="发布时间" rules={[{ required: true, message: '请选择发布时间' }]}>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              placeholder="选择日期和时间"
              showNow
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="timezone" label="时区">
                <Select
                  options={[
                    { value: 'America/Mexico_City', label: '墨西哥城 (CST)' },
                    { value: 'America/New_York', label: '纽约 (EST)' },
                    { value: 'America/Los_Angeles', label: '洛杉矶 (PST)' },
                    { value: 'America/Chicago', label: '芝加哥 (CST)' },
                    { value: 'Asia/Shanghai', label: '上海 (CST)' },
                    { value: 'Europe/London', label: '伦敦 (GMT)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="interval_minutes"
                label="设备间隔（分钟）"
                tooltip="多设备发布时，每个设备之间的间隔时间"
              >
                <InputNumber min={0} max={120} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
