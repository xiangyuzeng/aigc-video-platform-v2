import { useState } from 'react';
import {
  Alert,
  Card,
  Button,
  Input,
  Table,
  Space,
  Typography,
  message,
  Descriptions,
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CopyOutlined, SearchOutlined, InfoCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { scrapeUrl, getScraperHistory, ScrapedResult } from '../api/scraper';

const { Title, Text } = Typography;

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
};

const copyToClipboard = async (text: string | null) => {
  if (!text) {
    message.warning('内容为空');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制');
  } catch {
    message.error('复制失败');
  }
};

interface ResultSectionProps {
  label: string;
  value: string | null;
}

function ResultSection({ label, value }: ResultSectionProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>{label}</Text>
        <Button
          size="small"
          icon={<CopyOutlined />}
          onClick={() => copyToClipboard(value)}
        >
          复制
        </Button>
      </div>
      <div
        style={{
          background: '#f5f5f5',
          borderRadius: 4,
          padding: '8px 12px',
          minHeight: 48,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: 13,
          color: value ? '#222' : '#aaa',
        }}
      >
        {value || '（无内容）'}
      </div>
    </div>
  );
}

interface ExpandedRowProps {
  record: ScrapedResult;
}

function ExpandedRow({ record }: ExpandedRowProps) {
  return (
    <Descriptions column={1} bordered size="small" style={{ margin: '8px 0' }}>
      <Descriptions.Item
        label={
          <Space>
            原始文案
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(record.original_content)}>
              复制
            </Button>
          </Space>
        }
      >
        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {record.original_content || '（无内容）'}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item
        label={
          <Space>
            原始标签
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(record.original_tags)}>
              复制
            </Button>
          </Space>
        }
      >
        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {record.original_tags || '（无内容）'}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item
        label={
          <Space>
            翻译文案
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(record.translated_content)}>
              复制
            </Button>
          </Space>
        }
      >
        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {record.translated_content || '（无内容）'}
        </Text>
      </Descriptions.Item>
      <Descriptions.Item
        label={
          <Space>
            翻译标签
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(record.translated_tags)}>
              复制
            </Button>
          </Space>
        }
      >
        <Text style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {record.translated_tags || '（无内容）'}
        </Text>
      </Descriptions.Item>
    </Descriptions>
  );
}

export default function Scraper() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [profileId, setProfileId] = useState('');
  const [latestResult, setLatestResult] = useState<ScrapedResult | null>(null);

  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['scraper-history'],
    queryFn: () => getScraperHistory(20, 0),
  });

  const scrapeMutation = useMutation({
    mutationFn: () => scrapeUrl(url.trim(), profileId.trim()),
    onSuccess: (data) => {
      setLatestResult(data);
      queryClient.invalidateQueries({ queryKey: ['scraper-history'] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? '采集失败，请重试';
      message.error(msg);
    },
  });

  const handleScrape = () => {
    if (!url.trim()) {
      message.warning('请输入 TikTok 视频链接');
      return;
    }
    if (!profileId.trim()) {
      message.warning('请输入 AdsPower Profile ID');
      return;
    }
    scrapeMutation.mutate();
  };

  const columns = [
    {
      title: 'URL',
      dataIndex: 'source_url',
      key: 'source_url',
      ellipsis: true,
      render: (text: string) => (
        <Text ellipsis style={{ maxWidth: 400 }} title={text}>
          {text}
        </Text>
      ),
    },
    {
      title: '采集时间',
      dataIndex: 'scraped_at',
      key: 'scraped_at',
      width: 180,
      render: (val: string) => formatDate(val),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: ScrapedResult) => (
        <Button
          size="small"
          type="link"
          onClick={() => setLatestResult(record)}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>数据采集</Title>

      {/* Help Section */}
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="如何使用数据采集"
        description={
          <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
            <li><b>TikTok 视频链接</b>：打开 TikTok 找到目标视频，点击分享 → 复制链接（如 https://www.tiktok.com/@username/video/...）</li>
            <li><b>AdsPower 采集专用 Profile ID</b>：在 AdsPower「环境管理」中，找到任意一个已登录 TikTok 的浏览器环境，复制其 ID（编号列下方的字符串，如 k1ajc3oq）</li>
            <li><b>完成流程</b>：采集完成后，前往「发布」页面，在第二步「编辑内容」中可以手动粘贴采集到的文案，或点击「从URL采集」自动填入</li>
          </ul>
        }
        style={{ marginBottom: 16 }}
        closable
      />

      {/* Scrape Input Section */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input
            placeholder="输入 TikTok 视频链接（如 https://www.tiktok.com/@user/video/...）"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            prefix={<SearchOutlined />}
            allowClear
            onPressEnter={handleScrape}
          />
          <Input
            placeholder="AdsPower Profile ID（如 k1ajc3oq，在环境管理中查看）"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            loading={scrapeMutation.isPending}
            onClick={handleScrape}
          >
            采集
          </Button>
        </Space>
      </Card>

      {/* Latest Result Card */}
      {latestResult && (
        <Card
          title="采集结果"
          style={{ marginBottom: 24 }}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatDate(latestResult.scraped_at)}
            </Text>
          }
        >
          <ResultSection label="原始文案" value={latestResult.original_content} />
          <ResultSection label="原始标签" value={latestResult.original_tags} />
          <ResultSection label="翻译文案" value={latestResult.translated_content} />
          <ResultSection label="翻译标签" value={latestResult.translated_tags} />
          <Alert
            type="success"
            showIcon
            message="采集完成"
            description={
              <Space direction="vertical" size={4}>
                <Text>内容已保存到采集历史。你可以：</Text>
                <Text>1. 复制上方的文案和标签，在发布向导中粘贴使用</Text>
                <Text>2. 直接前往发布页面，在「编辑内容」步骤中点击「从URL采集」自动填入</Text>
              </Space>
            }
            action={
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={() => navigate('/publish')}
              >
                前往发布
              </Button>
            }
            style={{ marginTop: 16 }}
          />
        </Card>
      )}

      {/* History Section */}
      <Card title="采集历史">
        <Table<ScrapedResult>
          rowKey="id"
          columns={columns}
          dataSource={historyQuery.data ?? []}
          loading={historyQuery.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          expandable={{
            expandedRowRender: (record) => <ExpandedRow record={record} />,
            rowExpandable: () => true,
          }}
          size="middle"
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
}
