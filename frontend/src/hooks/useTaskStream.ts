import { useEffect, useRef, useCallback, useState } from 'react';

export interface TaskProgress {
  task_id: number;
  status: string;
  progress: number;
  error: string | null;
}

export function useTaskStream(enabled: boolean) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [progressMap, setProgressMap] = useState<Record<number, TaskProgress>>({});
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/publish`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 2 seconds if still enabled
      if (enabled) {
        reconnectTimer.current = setTimeout(() => connect(), 2000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data: TaskProgress = JSON.parse(event.data);
        setProgressMap((prev) => ({
          ...prev,
          [data.task_id]: data,
        }));
      } catch {
        // ignore bad messages
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      setConnected(false);
      return;
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      setConnected(false);
    };
  }, [enabled, connect]);

  const resetProgress = useCallback(() => {
    setProgressMap({});
  }, []);

  return { progressMap, setProgressMap, connected, resetProgress };
}
