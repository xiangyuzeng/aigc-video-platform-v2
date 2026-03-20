import { useEffect, useRef } from 'react';
import { Modal, Progress, Tag, Button, Space, Typography, message } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTaskStream } from '../../hooks/useTaskStream';
import { getTask, retryTask } from '../../api/tasks';
import { TASK_STATUS } from '../../utils/constants';

const { Text } = Typography;

interface Props {
  open: boolean;
  taskIds: number[];
  onClose: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  [TASK_STATUS.QUEUED]: { color: 'default', label: '排队中' },
  [TASK_STATUS.UPLOADING]: { color: 'processing', label: '上传中' },
  [TASK_STATUS.PUBLISHING]: { color: 'processing', label: '发布中' },
  [TASK_STATUS.PUBLISHED]: { color: 'success', label: '已发布' },
  [TASK_STATUS.FAILED]: { color: 'error', label: '失败' },
  [TASK_STATUS.CANCELLED]: { color: 'warning', label: '已取消' },
};

const TERMINAL_STATUSES = new Set(['published', 'failed', 'cancelled']);

export default function PublishProgress({ open, taskIds, onClose }: Props) {
  const { progressMap, setProgressMap, resetProgress } = useTaskStream(open);
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (open) {
      resetProgress();
    }
  }, [open, resetProgress]);

  // Polling fallback: fetch task status from REST API every 3 seconds
  useEffect(() => {
    if (!open || taskIds.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const pollTasks = async () => {
      for (const taskId of taskIds) {
        try {
          const task = await getTask(taskId);
          const status = task.status;
          const progress =
            status === 'published' ? 100 :
            status === 'failed' ? 0 :
            status === 'uploading' ? 20 :
            status === 'publishing' ? 60 :
            0;

          setProgressMap((prev) => {
            const existing = prev[taskId];
            // Only update from polling if WebSocket hasn't sent a newer status
            // or if polling has a more advanced status
            if (!existing || TERMINAL_STATUSES.has(status) || !TERMINAL_STATUSES.has(existing.status)) {
              return {
                ...prev,
                [taskId]: {
                  task_id: taskId,
                  status,
                  progress: existing ? Math.max(existing.progress, progress) : progress,
                  error: task.error_message,
                },
              };
            }
            return prev;
          });
        } catch {
          // Ignore polling errors
        }
      }
    };

    // Initial poll after a short delay
    const initialTimeout = setTimeout(pollTasks, 1500);
    // Then poll every 3 seconds
    pollRef.current = setInterval(pollTasks, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, taskIds, setProgressMap]);

  const retryMutation = useMutation({
    mutationFn: retryTask,
    onSuccess: () => {
      message.success('重试已提交');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Compute overall progress
  const total = taskIds.length;
  const completed = taskIds.filter((id) => {
    const p = progressMap[id];
    return p && TERMINAL_STATUSES.has(p.status);
  }).length;
  const overallPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = completed === total && total > 0;

  // Stop polling once all done
  useEffect(() => {
    if (allDone && pollRef.current) {
      clearInterval(pollRef.current);
    }
  }, [allDone]);

  return (
    <Modal
      title="发布进度"
      open={open}
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          {allDone ? '完成' : '后台运行'}
        </Button>
      }
      width={560}
      maskClosable={false}
    >
      {/* Overall progress */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>总进度: {completed}/{total}</Text>
        <Progress percent={overallPercent} status={allDone ? 'success' : 'active'} />
      </div>

      {/* Per-task list */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {taskIds.map((taskId) => {
          const p = progressMap[taskId];
          const status = p?.status ?? 'queued';
          const progress = p?.progress ?? 0;
          const error = p?.error;
          const config = statusConfig[status] ?? { color: 'default', label: status };

          return (
            <div
              key={taskId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              {/* Status icon */}
              <div style={{ width: 24 }}>
                {status === 'published' && <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />}
                {status === 'failed' && <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />}
                {(status === 'uploading' || status === 'publishing') && <LoadingOutlined style={{ fontSize: 16 }} />}
              </div>

              {/* Progress bar + label */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text>任务 #{taskId}</Text>
                  <Tag color={config.color}>{config.label}</Tag>
                </div>
                <Progress
                  percent={progress}
                  size="small"
                  status={
                    status === 'published' ? 'success' : status === 'failed' ? 'exception' : 'active'
                  }
                  showInfo={false}
                />
                {error && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {error}
                  </Text>
                )}
              </div>

              {/* Retry button for failed tasks */}
              {status === 'failed' && (
                <Space>
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={retryMutation.isPending}
                    onClick={() => retryMutation.mutate(taskId)}
                  >
                    重试
                  </Button>
                </Space>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
