import { useState } from 'react';
import { Table, Button, Tag, Space, Alert, message, Typography } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { usePublishStore, type TaskContent } from '../../stores/publishStore';
import { bulkCreateTasks, executeTasks, type TaskCreatePayload } from '../../api/tasks';
import { getVideoThumbnailUrl } from '../../api/videos';
import PublishProgress from './PublishProgress';

const { Text, Title } = Typography;

export default function StepReview() {
  const assignments = usePublishStore((s) => s.assignments);
  const selectedProfiles = usePublishStore((s) => s.selectedProfiles);
  const taskContents = usePublishStore((s) => s.taskContents);
  const setStep = usePublishStore((s) => s.setStep);
  const reset = usePublishStore((s) => s.reset);

  const [progressOpen, setProgressOpen] = useState(false);
  const [taskIds, setTaskIds] = useState<number[]>([]);

  const getProfileName = (profileId: number): string => {
    const profile = selectedProfiles.find((p) => p.id === profileId);
    return profile?.profile_name ?? `Profile #${profileId}`;
  };

  // Validation: check for missing required fields
  const validationErrors: string[] = [];
  const errorKeys = new Set<string>();

  for (const assignment of assignments) {
    const key = `${assignment.profileId}-${assignment.videoId}`;
    const tc = taskContents[key];
    if (!tc) {
      validationErrors.push(`任务 ${key} 缺少配置`);
      errorKeys.add(key);
      continue;
    }
    if (!tc.content?.trim()) {
      validationErrors.push(`${getProfileName(assignment.profileId)} — 文案不能为空`);
      errorKeys.add(key);
    }
  }

  const hasErrors = validationErrors.length > 0;

  // Build table data
  const dataSource = assignments.map((a) => {
    const key = `${a.profileId}-${a.videoId}`;
    const tc = taskContents[key] as TaskContent | undefined;
    return {
      key,
      profileId: a.profileId,
      videoId: a.videoId,
      profileName: getProfileName(a.profileId),
      content: tc?.content ?? '',
      tags: tc?.tags ?? '',
      scheduled_at: tc?.scheduled_at,
      timezone: tc?.timezone ?? 'America/Mexico_City',
      hasError: errorKeys.has(key),
    };
  });

  const columns = [
    {
      title: '缩略图',
      dataIndex: 'videoId',
      key: 'thumbnail',
      width: 80,
      render: (videoId: number) => (
        <img
          src={getVideoThumbnailUrl(videoId)}
          alt="thumb"
          style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, background: '#f0f0f0' }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ),
    },
    {
      title: '设备',
      dataIndex: 'profileName',
      key: 'profileName',
      width: 150,
    },
    {
      title: '文案',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string, record: (typeof dataSource)[0]) => (
        <Text type={record.hasError && !content ? 'danger' : undefined}>
          {content || '(空)'}
        </Text>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      ellipsis: true,
      render: (tags: string) =>
        tags
          ? tags.split(' ').slice(0, 3).map((t, i) => <Tag key={i}>{t}</Tag>)
          : <Text type="secondary">—</Text>,
    },
    {
      title: '发布时间',
      key: 'schedule',
      width: 180,
      render: (_: unknown, record: (typeof dataSource)[0]) =>
        record.scheduled_at ? (
          <Text>{new Date(record.scheduled_at).toLocaleString()}</Text>
        ) : (
          <Tag color="green">立即发布</Tag>
        ),
    },
  ];

  const publishMutation = useMutation({
    mutationFn: async () => {
      // 1. Create tasks in bulk
      const payloads: TaskCreatePayload[] = assignments.map((a) => {
        const key = `${a.profileId}-${a.videoId}`;
        const tc = taskContents[key]!;
        return {
          task_name: `publish-${Date.now()}`,
          profile_id: a.profileId,
          video_id: a.videoId,
          content: tc.content || undefined,
          tags: tc.tags || undefined,
          trans_content: tc.trans_content || undefined,
          trans_tags: tc.trans_tags || undefined,
          cover_override_path: tc.cover_path || undefined,
          scheduled_at: tc.scheduled_at || undefined,
          timezone: tc.timezone,
        };
      });

      const tasks = await bulkCreateTasks(payloads);
      return tasks;
    },
    onSuccess: async (tasks) => {
      setTaskIds(tasks.map((t) => t.id));

      // Execute the tasks
      try {
        await executeTasks();
      } catch {
        message.warning('任务创建成功，但执行启动失败，可稍后重试');
      }

      setProgressOpen(true);
    },
    onError: (err: Error) => {
      message.error(`发布失败: ${err.message}`);
    },
  });

  const handlePublish = () => {
    if (hasErrors) {
      message.error('请先修正验证错误');
      return;
    }
    publishMutation.mutate();
  };

  const handleProgressClose = () => {
    setProgressOpen(false);
    reset();
  };

  return (
    <div>
      <Title level={5}>确认发布 — 共 {assignments.length} 个任务</Title>

      {hasErrors && (
        <Alert
          type="error"
          message="存在验证错误"
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Table
        dataSource={dataSource}
        columns={columns}
        pagination={false}
        size="small"
        scroll={{ y: 400 }}
        rowClassName={(record) => (record.hasError ? 'ant-table-row-error' : '')}
      />

      {/* Navigation */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(2)}>上一步</Button>
        <Space>
          <Button
            type="primary"
            size="large"
            loading={publishMutation.isPending}
            disabled={hasErrors || assignments.length === 0}
            onClick={handlePublish}
          >
            确认发布 ({assignments.length})
          </Button>
        </Space>
      </div>

      {/* Progress Modal */}
      <PublishProgress
        open={progressOpen}
        taskIds={taskIds}
        onClose={handleProgressClose}
      />
    </div>
  );
}
