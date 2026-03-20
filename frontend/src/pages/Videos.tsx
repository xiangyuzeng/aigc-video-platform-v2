import { useState } from 'react';
import {
  Typography,
  Row,
  Col,
  Card,
  Tag,
  Upload,
  Button,
  Input,
  Select,
  Space,
  Popconfirm,
  Empty,
  Spin,
  message,
} from 'antd';
import { InboxOutlined, DeleteOutlined, PlayCircleOutlined, AudioOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVideos, uploadVideos, deleteVideo, getVideoThumbnailUrl } from '../api/videos';
import { transcribeVideo } from '../api/scraper';
import type { UploadFile } from 'antd';

const { Title } = Typography;

const STATUS_COLORS: Record<string, string> = {
  ready: 'green',
  assigned: 'blue',
  published: 'geekblue',
  archived: 'default',
};

const STATUS_OPTIONS = [
  { value: 'ready', label: 'Ready' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Filters {
  search?: string;
  status?: string;
}

export default function Videos() {
  const queryClient = useQueryClient();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [filters, setFilters] = useState<Filters>({});

  const { data, isLoading } = useQuery({
    queryKey: ['videos', filters],
    queryFn: () => getVideos(filters),
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadVideos(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      setFileList([]);
      message.success('上传成功');
    },
    onError: () => {
      message.error('上传失败，请重试');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      message.success('删除成功');
    },
    onError: () => {
      message.error('删除失败');
    },
  });

  const transcribeMutation = useMutation({
    mutationFn: (id: number) => transcribeVideo(id),
    onSuccess: () => {
      message.success('转录任务已提交，完成后自动更新');
    },
    onError: () => {
      message.error('转录失败');
    },
  });

  const handleUpload = () => {
    const files: File[] = [];
    for (const f of fileList) {
      if (f.originFileObj) {
        files.push(f.originFileObj as File);
      }
    }
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  const videos = data?.items ?? [];
  const hasFilters = filters.search != null || filters.status != null;

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <PlayCircleOutlined style={{ marginRight: 8 }} />
        视频库
      </Title>

      {/* Upload zone */}
      <Upload.Dragger
        accept="video/*"
        multiple
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList: newFileList }) => setFileList(newFileList)}
        style={{ marginBottom: 16 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽视频文件到此区域上传</p>
      </Upload.Dragger>

      {fileList.length > 0 && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <Button
            type="primary"
            onClick={handleUpload}
            loading={uploadMutation.isPending}
          >
            开始上传
          </Button>
        </div>
      )}

      {/* Filter bar */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索视频..."
          allowClear
          onSearch={(value) =>
            setFilters((prev) => ({
              ...prev,
              search: value || undefined,
            }))
          }
          style={{ width: 240 }}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          options={STATUS_OPTIONS}
          onChange={(value) =>
            setFilters((prev) => ({
              ...prev,
              status: value ?? undefined,
            }))
          }
          style={{ width: 160 }}
        />
      </Space>

      {/* Video card grid */}
      <Spin spinning={isLoading}>
        {videos.length === 0 && !hasFilters ? (
          <Empty description="暂无视频，请上传" />
        ) : videos.length === 0 ? (
          <Empty description="无匹配结果" />
        ) : (
          <Row gutter={[16, 16]}>
            {videos.map((video) => (
              <Col span={6} key={video.id}>
                <Card
                  hoverable
                  cover={
                    <VideoCover videoId={video.id} title={video.title} />
                  }
                  actions={[
                    <AudioOutlined
                      key="transcribe"
                      title={video.transcript ? '已转录' : '转录'}
                      style={{ color: video.transcript ? '#52c41a' : undefined }}
                      onClick={() => {
                        if (!video.transcript) transcribeMutation.mutate(video.id);
                      }}
                    />,
                    <Popconfirm
                      key="delete"
                      title="确认删除此视频？"
                      onConfirm={() => deleteMutation.mutate(video.id)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={video.title ?? '未命名'}
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%' }}>
                        <Space size={4}>
                          <Tag>{formatDuration(video.duration_seconds)}</Tag>
                          {video.resolution && <Tag>{video.resolution}</Tag>}
                        </Space>
                        <Tag color={STATUS_COLORS[video.status] ?? 'default'}>
                          {video.status}
                        </Tag>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  );
}

/** Thumbnail with graceful fallback to a gray placeholder. */
function VideoCover({ videoId, title }: { videoId: number; title: string | null }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        style={{
          height: 160,
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlayCircleOutlined style={{ fontSize: 36, color: '#bfbfbf' }} />
      </div>
    );
  }

  return (
    <img
      alt={title ?? '视频缩略图'}
      src={getVideoThumbnailUrl(videoId)}
      style={{ height: 160, objectFit: 'cover' }}
      onError={() => setBroken(true)}
    />
  );
}
