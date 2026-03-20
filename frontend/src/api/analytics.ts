import client from './client';

export interface OverviewStats {
  total_profiles: number;
  total_videos: number;
  total_scraped: number;
  total_tasks: number;
  total_published: number;
  tasks_today: number;
  success_rate: number;
}

export interface TimelinePoint {
  date: string;
  published: number;
  failed: number;
}

export async function getOverview(): Promise<OverviewStats> {
  const res = await client.get<OverviewStats>('/api/analytics');
  return res.data;
}

export async function getTimeline(dateFrom?: string, dateTo?: string): Promise<TimelinePoint[]> {
  const res = await client.get<TimelinePoint[]>('/api/analytics/timeline', {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return res.data;
}
