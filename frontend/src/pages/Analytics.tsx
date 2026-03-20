import { useState } from 'react';
import { Row, Col, Card, Spin, Typography, Statistic } from 'antd';
import { DatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTimeline, type TimelinePoint } from '../api/analytics';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const PUBLISHED_COLOR = '#52c41a';
const FAILED_COLOR = '#ff4d4f';

const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '最近7天', value: [dayjs().subtract(7, 'day'), dayjs()] },
  { label: '最近30天', value: [dayjs().subtract(30, 'day'), dayjs()] },
];

function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13}>
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  const dateFrom = dateRange[0].format('YYYY-MM-DD');
  const dateTo = dateRange[1].format('YYYY-MM-DD');

  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['analytics-timeline', dateFrom, dateTo],
    queryFn: () => getTimeline(dateFrom, dateTo),
  });

  const totalPublished = timeline.reduce((sum: number, d: TimelinePoint) => sum + d.published, 0);
  const totalFailed = timeline.reduce((sum: number, d: TimelinePoint) => sum + d.failed, 0);
  const total = totalPublished + totalFailed;
  const successRate = total > 0 ? ((totalPublished / total) * 100).toFixed(1) : '—';

  const pieData = [
    { name: '发布成功', value: totalPublished },
    { name: '发布失败', value: totalFailed },
  ];

  const handleRangeChange: RangePickerProps['onChange'] = (values) => {
    if (values && values[0] && values[1]) {
      setDateRange([values[0] as dayjs.Dayjs, values[1] as dayjs.Dayjs]);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>数据分析</Title>
      </div>

      <Card style={{ marginBottom: 24 }}>
        <RangePicker
          value={dateRange}
          onChange={handleRangeChange}
          presets={RANGE_PRESETS}
          format="YYYY-MM-DD"
          allowClear={false}
        />
      </Card>

      {isLoading ? (
        <Spin size="large" style={{ display: 'block', textAlign: 'center', margin: '48px 0' }} />
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={16}>
              <Card title="发布趋势">
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={timeline} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="published"
                      name="发布成功"
                      stroke={PUBLISHED_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="failed"
                      name="发布失败"
                      stroke={FAILED_COLOR}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col span={8}>
              <Card title="成功/失败占比">
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      <Cell key="published" fill={PUBLISHED_COLOR} />
                      <Cell key="failed" fill={FAILED_COLOR} />
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card>
                <Statistic title="发布成功" value={totalPublished} valueStyle={{ color: PUBLISHED_COLOR }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="发布失败" value={totalFailed} valueStyle={{ color: FAILED_COLOR }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="成功率"
                  value={successRate}
                  suffix={total > 0 ? '%' : ''}
                  valueStyle={{ color: Number(successRate) >= 80 ? PUBLISHED_COLOR : FAILED_COLOR }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
