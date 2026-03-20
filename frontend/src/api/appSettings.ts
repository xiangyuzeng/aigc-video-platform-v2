import client from './client';

export interface SetupStatus {
  needs_setup: boolean;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await client.get<SetupStatus>('/api/app-settings/setup/status');
  return res.data;
}

export async function getAllSettings(): Promise<Record<string, string | null>> {
  const res = await client.get<Record<string, string | null>>('/api/app-settings/');
  return res.data;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await client.put(`/api/app-settings/${key}`, { value });
}
