import client from './client';

export interface TagItem {
  tag: string;
  use_count: number;
}

export async function getRecentTags(platform = 'tiktok', limit = 20): Promise<TagItem[]> {
  const res = await client.get<TagItem[]>('/api/tags/recent', { params: { platform, limit } });
  return res.data;
}

export async function suggestTags(q: string, platform = 'tiktok', limit = 10): Promise<TagItem[]> {
  const res = await client.get<TagItem[]>('/api/tags/suggest', { params: { q, platform, limit } });
  return res.data;
}
