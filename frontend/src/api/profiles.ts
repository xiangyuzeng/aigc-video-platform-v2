import client from './client';

export interface Profile {
  id: number;
  server_id: number;
  profile_id: string;
  profile_name: string;
  group_id: string | null;
  group_name: string | null;
  platform: string;
  label: string | null;
  remark: string | null;
  serial_number: string | null;
  last_synced_at: string | null;
}

export interface ProfileUpdate {
  label?: string;
  platform?: string;
  remark?: string;
}

export async function getProfiles(params?: {
  server_id?: number;
  group_name?: string;
  platform?: string;
  search?: string;
}): Promise<Profile[]> {
  const res = await client.get<Profile[]>('/api/profiles', { params });
  return res.data;
}

export async function getProfileGroups(): Promise<string[]> {
  const res = await client.get<string[]>('/api/profiles/groups');
  return res.data;
}

export async function updateProfile(id: number, data: ProfileUpdate): Promise<Profile> {
  const res = await client.patch<Profile>(`/api/profiles/${id}`, data);
  return res.data;
}

export async function deleteProfile(id: number): Promise<{ ok: boolean }> {
  const res = await client.delete<{ ok: boolean }>(`/api/profiles/${id}`);
  return res.data;
}

export async function testServerConnection(serverId: number): Promise<{ ok: boolean; message: string }> {
  const res = await client.post<{ ok: boolean; message: string }>(`/api/servers/${serverId}/test`);
  return res.data;
}

export async function syncServerProfiles(serverId: number): Promise<{ ok: boolean; synced: number }> {
  const res = await client.post<{ ok: boolean; synced: number }>(`/api/servers/${serverId}/sync`);
  return res.data;
}
