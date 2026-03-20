import client from './client';

export interface OptimalSlot {
  label: string;
  start: string;
  end: string;
}

export interface QueueTask {
  id: number;
  task_name: string;
  profile_id: number;
  video_id: number;
  status: string;
  scheduled_at: string | null;
  timezone: string;
  error_message: string | null;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  total: number;
  published: number;
  failed: number;
  queued: number;
}

export async function getOptimalSlots(): Promise<OptimalSlot[]> {
  const res = await client.get<OptimalSlot[]>('/api/schedule/optimal-slots');
  return res.data;
}

export async function staggerTasks(
  taskIds: number[],
  startTime: string,
  intervalMinutes: number = 5,
): Promise<{ count: number }> {
  const res = await client.post('/api/schedule/stagger', {
    task_ids: taskIds,
    start_time: startTime,
    interval_minutes: intervalMinutes,
  });
  return res.data;
}

export async function getScheduleQueue(params?: {
  date_from?: string;
  date_to?: string;
  status?: string;
}): Promise<QueueTask[]> {
  const res = await client.get<QueueTask[]>('/api/schedule/queue', { params });
  return res.data;
}

export async function retryTask(taskId: number): Promise<void> {
  await client.post(`/api/schedule/retry/${taskId}`);
}

export async function getCalendarData(
  year?: number,
  month?: number,
): Promise<CalendarDay[]> {
  const res = await client.get<CalendarDay[]>('/api/schedule/calendar', {
    params: { year, month },
  });
  return res.data;
}
