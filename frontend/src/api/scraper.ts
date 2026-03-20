import client from './client';

export interface ScrapedResult {
  id: number;
  source_url: string;
  original_content: string | null;
  original_tags: string | null;
  translated_content: string | null;
  translated_tags: string | null;
  scraped_at: string;
}

export async function scrapeUrl(url: string, profileId: string): Promise<ScrapedResult> {
  const res = await client.post<ScrapedResult>('/api/scraper/scrape', { url, profile_id: profileId }, { timeout: 120_000 });
  return res.data;
}

export async function getScraperHistory(limit = 20, offset = 0): Promise<ScrapedResult[]> {
  const res = await client.get<ScrapedResult[]>('/api/scraper/history', { params: { limit, offset } });
  return res.data;
}

export async function transcribeVideo(videoId: number): Promise<{ status: string }> {
  const res = await client.post<{ status: string }>(`/api/videos/${videoId}/transcribe`);
  return res.data;
}
