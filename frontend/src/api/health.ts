import client from './client';

export interface AccountHealth {
  profile_id: number;
  profile_name: string;
  group_name: string | null;
  serial_number: string | null;
  total_posts: number;
  success_rate: number;
  last_publish_time: string | null;
  avg_interval_hours: number | null;
  health_score: number;
  alerts: string[];
}

export async function getAccountHealth(): Promise<AccountHealth[]> {
  const res = await client.get<AccountHealth[]>('/api/health-dashboard/');
  return res.data;
}

export async function exportHealthCSV(): Promise<void> {
  const res = await client.get('/api/health-dashboard/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'account_health.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
