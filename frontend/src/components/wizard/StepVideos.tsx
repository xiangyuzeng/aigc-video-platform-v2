import { useState, useMemo } from 'react';
import { Row, Col, Card, Button, Tag, Space, Typography, Empty, message } from 'antd';
import { DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getVideos, getVideoThumbnailUrl } from '../../api/videos';
import { usePublishStore } from '../../stores/publishStore';
import type { Video } from '../../api/videos';

const { Text, Title } = Typography;

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function StepVideos() {
  const navigate = useNavigate();
  const [focusedProfileId, setFocusedProfileId] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const selectedProfiles = usePublishStore((s) => s.selectedProfiles);
  const assignments = usePublishStore((s) => s.assignments);
  const assignVideo = usePublishStore((s) => s.assignVideo);
  const removeAssignment = usePublishStore((s) => s.removeAssignment);
  const autoDistribute = usePublishStore((s) => s.autoDistribute);
  const setStep = usePublishStore((s) => s.setStep);

  const { data, isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => getVideos({}),
  });

  const videos: Video[] = data?.items ?? [];

  // Build a lookup: videoId -> count of profiles it's assigned to
  const videoDuplicateCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const a of assignments) {
      counts.set(a.videoId, (counts.get(a.videoId) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  // Build a lookup: videoId -> Video for quick access
  const videoMap = useMemo(() => {
    const map = new Map<number, Video>();
    for (const v of videos) {
      map.set(v.id, v);
    }
    return map;
  }, [videos]);

  const handleVideoClick = (video: Video) => {
    if (focusedProfileId == null) {
      void messageApi.warning('请先在左侧选择一个设备');
      return;
    }
    assignVideo(focusedProfileId, video.id);
  };

  const handleAutoDistribute = () => {
    if (selectedProfiles.length === 0) {
      void messageApi.warning('没有选中的设备');
      return;
    }
    if (videos.length === 0) {
      void messageApi.warning('没有可用的视频');
      return;
    }
    const profileIds = selectedProfiles.map((p) => p.id);
    const videoIds = videos.map((v) => v.id);
    autoDistribute(profileIds, videoIds);
    void messageApi.success('已自动分配视频');
  };

  const hasAssignments = assignments.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {contextHolder}
      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        {/* Left sidebar: selected profiles (30%) */}
        <Col span={7}>
          <Card
            title="已选设备"
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}
          >
            {selectedProfiles.length === 0 ? (
              <Empty description="未选择设备" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedProfiles.map((profile) => {
                  const isFocused = focusedProfileId === profile.id;
                  const profileAssignments = assignments.filter(
                    (a) => a.profileId === profile.id,
                  );

                  return (
                    <div
                      key={profile.id}
                      onClick={() => setFocusedProfileId(profile.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: isFocused ? '2px solid #1677ff' : '1px solid #f0f0f0',
                        background: isFocused ? '#e6f4ff' : '#fafafa',
                        transition: 'all 0.2s',
                      }}
                    >
                      <Text strong style={{ fontSize: 13 }}>
                        {profile.profile_name}
                      </Text>
                      {profile.group_name && (
                        <Tag style={{ marginLeft: 6, fontSize: 11 }}>{profile.group_name}</Tag>
                      )}

                      {profileAssignments.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {profileAssignments.map((a) => {
                            const video = videoMap.get(a.videoId);
                            const isDuplicate = (videoDuplicateCount.get(a.videoId) ?? 0) > 1;
                            return (
                              <Tag
                                key={a.videoId}
                                closable
                                onClose={(e) => {
                                  e.preventDefault();
                                  removeAssignment(profile.id, a.videoId);
                                }}
                                closeIcon={<DeleteOutlined style={{ fontSize: 10 }} />}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  maxWidth: '100%',
                                }}
                              >
                                <img
                                  src={getVideoThumbnailUrl(a.videoId)}
                                  alt=""
                                  style={{
                                    width: 24,
                                    height: 16,
                                    objectFit: 'cover',
                                    borderRadius: 2,
                                    verticalAlign: 'middle',
                                  }}
                                />
                                <Text
                                  ellipsis
                                  style={{ fontSize: 11, maxWidth: 80, display: 'inline-block' }}
                                >
                                  {video?.title ?? `视频${a.videoId}`}
                                </Text>
                                {isDuplicate && (
                                  <Tag
                                    color="orange"
                                    style={{ marginLeft: 2, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                                  >
                                    重复
                                  </Tag>
                                )}
                              </Tag>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Right panel: video library (70%) */}
        <Col span={17}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0 }}>
                  视频库
                </Title>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={handleAutoDistribute}
                  disabled={videos.length === 0 || selectedProfiles.length === 0}
                >
                  自动分配
                </Button>
              </div>
            }
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}
          >
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">加载中...</Text>
              </div>
            ) : videos.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" align="center" size={8}>
                    <Text type="secondary">暂无视频，请先上传视频文件</Text>
                    <Button type="primary" size="small" onClick={() => navigate('/videos')}>
                      前往上传
                    </Button>
                  </Space>
                }
              />
            ) : (
              <Row gutter={[12, 12]}>
                {videos.map((video) => {
                  const assignedCount = videoDuplicateCount.get(video.id) ?? 0;
                  return (
                    <Col span={8} key={video.id}>
                      <Card
                        hoverable
                        size="small"
                        onClick={() => handleVideoClick(video)}
                        cover={
                          <div
                            style={{
                              position: 'relative',
                              height: 100,
                              overflow: 'hidden',
                              background: '#000',
                            }}
                          >
                            <img
                              src={getVideoThumbnailUrl(video.id)}
                              alt={video.title ?? ''}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                background: 'rgba(0,0,0,0.7)',
                                color: '#fff',
                                fontSize: 11,
                                padding: '1px 5px',
                                borderRadius: 3,
                              }}
                            >
                              {formatDuration(video.duration_seconds)}
                            </span>
                          </div>
                        }
                        bodyStyle={{ padding: '8px 10px' }}
                      >
                        <Text
                          ellipsis
                          style={{ fontSize: 12, display: 'block' }}
                          title={video.title ?? undefined}
                        >
                          {video.title ?? '未命名视频'}
                        </Text>
                        {assignedCount > 0 && (
                          <Tag
                            color={assignedCount > 1 ? 'orange' : 'blue'}
                            style={{ fontSize: 10, marginTop: 4 }}
                          >
                            已分配 {assignedCount} 个设备
                            {assignedCount > 1 ? ' (重复)' : ''}
                          </Tag>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Card>
        </Col>
      </Row>

      {/* Navigation buttons */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(0)}>上一步</Button>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            已分配 {assignments.length} 个任务
          </Text>
          <Button type="primary" onClick={() => setStep(2)} disabled={!hasAssignments}>
            下一步
          </Button>
        </Space>
      </div>
    </div>
  );
}
