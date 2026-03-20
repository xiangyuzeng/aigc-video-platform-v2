import client from './client';

export interface TaskData {
  id: number;
  task_name: string;
  profile_id: number;
  video_id: number;
  content: string | null;
  tags: string | null;
  trans_content: string | null;
  trans_tags: string | null;
  cover_override_path: string | null;
  scheduled_at: string | null;
  timezone: string;
  status: string;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  published_url: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface TaskCreatePayload {
  task_name: string;
  profile_id: number;
  video_id: number;
  content?: string;
  tags?: string;
  trans_content?: string;
  trans_tags?: string;
  cover_override_path?: string;
  scheduled_at?: string;
  timezone?: string;
}

export async function getTasks(params?: {
  status?: string;
  task_name?: string;
  profile_id?: number;
}): Promise<TaskData[]> {
  const res = await client.get<TaskData[]>('/api/tasks', { params });
  return res.data;
}

export async function createTask(payload: TaskCreatePayload): Promise<TaskData> {
  const res = await client.post<TaskData>('/api/tasks', payload);
  return res.data;
}

export async function bulkCreateTasks(payloads: TaskCreatePayload[]): Promise<TaskData[]> {
  const res = await client.post<TaskData[]>('/api/tasks/bulk', payloads);
  return res.data;
}

export async function getTask(id: number): Promise<TaskData> {
  const res = await client.get<TaskData>(`/api/tasks/${id}`);
  return res.data;
}

export async function deleteTask(id: number): Promise<void> {
  await client.delete(`/api/tasks/${id}`);
}

export async function executeTasks(): Promise<{ ok: boolean; task_count: number }> {
  const res = await client.post<{ ok: boolean; task_count: number }>('/api/tasks/execute');
  return res.data;
}

export async function retryTask(id: number): Promise<TaskData> {
  const res = await client.post<TaskData>(`/api/tasks/${id}/retry`);
  return res.data;
}

export async function cancelTask(id: number): Promise<TaskData> {
  const res = await client.post<TaskData>(`/api/tasks/${id}/cancel`);
  return res.data;
}
