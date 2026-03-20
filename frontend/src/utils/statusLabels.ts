export const TASK_STATUS: Record<string, { color: string; label: string }> = {
  draft:      { color: 'default',    label: '草稿' },
  queued:     { color: 'processing', label: '排队中' },
  uploading:  { color: 'processing', label: '上传中' },
  publishing: { color: 'processing', label: '发布中' },
  published:  { color: 'success',    label: '已发布' },
  failed:     { color: 'error',      label: '失败' },
  cancelled:  { color: 'warning',    label: '已取消' },
};

export const VIDEO_STATUS: Record<string, { color: string; label: string }> = {
  ready:     { color: 'green',    label: '就绪' },
  assigned:  { color: 'blue',     label: '已分配' },
  published: { color: 'geekblue', label: '已发布' },
  archived:  { color: 'default',  label: '已归档' },
};

export const PIPELINE_STATUS: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default',    label: '草稿' },
  running:   { color: 'processing', label: '运行中' },
  completed: { color: 'success',    label: '已完成' },
  failed:    { color: 'error',      label: '失败' },
  cancelled: { color: 'warning',    label: '已取消' },
};
