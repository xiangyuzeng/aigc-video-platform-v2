import { Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';

async function checkHealth(): Promise<boolean> {
  try {
    await client.get('/api/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export default function ConnectionBanner() {
  const { data: connected } = useQuery({
    queryKey: ['backend-health'],
    queryFn: checkHealth,
    refetchInterval: 10_000,
    retry: false,
  });

  if (connected !== false) return null;

  return (
    <Alert
      type="error"
      banner
      message="后端服务已断开，正在重连..."
      style={{ borderRadius: 0 }}
    />
  );
}
