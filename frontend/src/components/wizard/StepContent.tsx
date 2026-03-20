import { useState } from 'react';
import { Row, Col, Card, Button, Input, Space, Tag, Collapse, Modal, Typography, message } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { usePublishStore } from '../../stores/publishStore';
import { getVideoThumbnailUrl } from '../../api/videos';
import { scrapeUrl } from '../../api/scraper';
import TagInput from './TagInput';
import SchedulePicker from './SchedulePicker';

const { Text } = Typography;

export default function StepContent() {
  const assignments = usePublishStore((s) => s.assignments);
  const selectedProfiles = usePublishStore((s) => s.selectedProfiles);
  const taskContents = usePublishStore((s) => s.taskContents);
  const updateTaskContent = usePublishStore((s) => s.updateTaskContent);
  const applyTagsToAll = usePublishStore((s) => s.applyTagsToAll);
  const applyScheduleToAll = usePublishStore((s) => s.applyScheduleToAll);
  const setStep = usePublishStore((s) => s.setStep);

  const [batchTagsOpen, setBatchTagsOpen] = useState(false);
  const [batchTags, setBatchTags] = useState('');

  const [batchScheduleOpen, setBatchScheduleOpen] = useState(false);
  const [batchScheduledAt, setBatchScheduledAt] = useState<string | null>(null);
  const [batchTimezone, setBatchTimezone] = useState('America/Mexico_City');

  // Scrape modal state
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false);
  const [scrapeTargetKey, setScrapeTargetKey] = useState<string | null>(null);
  const [scrapeUrlValue, setScrapeUrlValue] = useState('');
  const [scrapeProfileId, setScrapeProfileId] = useState('');

  const scrapeMutation = useMutation({
    mutationFn: () => scrapeUrl(scrapeUrlValue, scrapeProfileId),
    onSuccess: (result) => {
      if (scrapeTargetKey) {
        updateTaskContent(scrapeTargetKey, {
          content: result.original_content ?? '',
          tags: result.original_tags ?? '',
          trans_content: result.translated_content ?? '',
          trans_tags: result.translated_tags ?? '',
        });
      }
      setScrapeModalOpen(false);
      setScrapeUrlValue('');
      setScrapeProfileId('');
      message.success('采集成功，已填入内容');
    },
    onError: (err: Error) => {
      message.error(`采集失败: ${err.message}`);
    },
  });

  const getProfileName = (profileId: number): string => {
    const profile = selectedProfiles.find((p) => p.id === profileId);
    return profile?.profile_name ?? `Profile #${profileId}`;
  };

  const handleBatchTagsConfirm = () => {
    applyTagsToAll(batchTags);
    setBatchTagsOpen(false);
    setBatchTags('');
  };

  const handleBatchScheduleConfirm = () => {
    if (batchScheduledAt) {
      applyScheduleToAll(batchScheduledAt, batchTimezone);
    }
    setBatchScheduleOpen(false);
    setBatchScheduledAt(null);
    setBatchTimezone('America/Mexico_City');
  };

  return (
    <div>
      {/* Batch toolbar */}
      <Space style={{ marginBottom: 16 }}>
        <Button onClick={() => setBatchTagsOpen(true)}>批量设置标签</Button>
        <Button onClick={() => setBatchScheduleOpen(true)}>批量设置时间</Button>
      </Space>

      {/* Batch tags modal */}
      <Modal
        title="批量设置标签"
        open={batchTagsOpen}
        onOk={handleBatchTagsConfirm}
        onCancel={() => setBatchTagsOpen(false)}
        destroyOnClose
      >
        <TagInput value={batchTags} onChange={setBatchTags} />
      </Modal>

      {/* Batch schedule modal */}
      <Modal
        title="批量设置时间"
        open={batchScheduleOpen}
        onOk={handleBatchScheduleConfirm}
        onCancel={() => setBatchScheduleOpen(false)}
        okButtonProps={{ disabled: !batchScheduledAt }}
        destroyOnClose
      >
        <SchedulePicker
          scheduledAt={batchScheduledAt}
          timezone={batchTimezone}
          onScheduledAtChange={setBatchScheduledAt}
          onTimezoneChange={setBatchTimezone}
        />
      </Modal>

      {/* Scrollable task card list */}
      <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
        {assignments.map((assignment) => {
          const key = `${assignment.profileId}-${assignment.videoId}`;
          const tc = taskContents[key];
          if (!tc) return null;

          return (
            <Card key={key} size="small" style={{ marginBottom: 12 }}>
              <Row gutter={16}>
                {/* Left: thumbnail + profile badge */}
                <Col span={6}>
                  <img
                    src={getVideoThumbnailUrl(assignment.videoId)}
                    alt="video thumbnail"
                    style={{
                      width: '100%',
                      borderRadius: 4,
                      objectFit: 'cover',
                      maxHeight: 160,
                      background: '#f0f0f0',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect fill="%23f0f0f0" width="160" height="90"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23bbb" font-size="14">No Thumbnail</text></svg>';
                    }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">{getProfileName(assignment.profileId)}</Tag>
                  </div>
                </Col>

                {/* Right: form fields */}
                <Col span={18}>
                  <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    {/* Scrape button */}
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => {
                        setScrapeTargetKey(key);
                        setScrapeModalOpen(true);
                      }}
                    >
                      从URL采集
                    </Button>

                    {/* Caption */}
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 4 }}>
                        文案
                      </Text>
                      <Input.TextArea
                        rows={3}
                        showCount
                        maxLength={500}
                        value={tc.content}
                        onChange={(e) => updateTaskContent(key, { content: e.target.value })}
                        placeholder="输入发布文案..."
                      />
                    </div>

                    {/* Tags */}
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 4 }}>
                        标签
                      </Text>
                      <TagInput
                        value={tc.tags}
                        onChange={(val) => updateTaskContent(key, { tags: val })}
                      />
                    </div>

                    {/* Translation (collapsible) */}
                    <Collapse
                      size="small"
                      items={[
                        {
                          key: 'translation',
                          label: '翻译',
                          children: (
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              <div>
                                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                  翻译文案
                                </Text>
                                <Input.TextArea
                                  rows={2}
                                  showCount
                                  maxLength={500}
                                  value={tc.trans_content}
                                  onChange={(e) =>
                                    updateTaskContent(key, { trans_content: e.target.value })
                                  }
                                  placeholder="输入翻译文案..."
                                />
                              </div>
                              <div>
                                <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                  翻译标签
                                </Text>
                                <TagInput
                                  value={tc.trans_tags}
                                  onChange={(val) => updateTaskContent(key, { trans_tags: val })}
                                />
                              </div>
                            </Space>
                          ),
                        },
                      ]}
                    />

                    {/* Schedule */}
                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 4 }}>
                        发布时间
                      </Text>
                      <SchedulePicker
                        scheduledAt={tc.scheduled_at}
                        timezone={tc.timezone}
                        onScheduledAtChange={(val) =>
                          updateTaskContent(key, { scheduled_at: val })
                        }
                        onTimezoneChange={(val) => updateTaskContent(key, { timezone: val })}
                      />
                    </div>
                  </Space>
                </Col>
              </Row>
            </Card>
          );
        })}

        {assignments.length === 0 && (
          <Card>
            <Text type="secondary">暂无任务，请返回上一步分配视频。</Text>
          </Card>
        )}
      </div>

      {/* Scrape from URL Modal */}
      <Modal
        title="从URL采集内容"
        open={scrapeModalOpen}
        onOk={() => scrapeMutation.mutate()}
        onCancel={() => {
          setScrapeModalOpen(false);
          setScrapeUrlValue('');
          setScrapeProfileId('');
        }}
        confirmLoading={scrapeMutation.isPending}
        okText="采集"
        cancelText="取消"
        okButtonProps={{ disabled: !scrapeUrlValue || !scrapeProfileId }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>FastMoss URL</Text>
            <Input
              placeholder="输入 FastMoss 视频页面 URL"
              value={scrapeUrlValue}
              onChange={(e) => setScrapeUrlValue(e.target.value)}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>采集 Profile ID</Text>
            <Input
              placeholder="AdsPower 采集专用 Profile ID"
              value={scrapeProfileId}
              onChange={(e) => setScrapeProfileId(e.target.value)}
            />
          </div>
        </Space>
      </Modal>

      {/* Navigation */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(1)}>上一步</Button>
        <Button type="primary" onClick={() => setStep(3)}>
          下一步
        </Button>
      </div>
    </div>
  );
}
