import { Tag, Tooltip, Space } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getServers } from '../../api/servers';
import { testServerConnection } from '../../api/profiles';

export default function ServerStatus() {
  const navigate = useNavigate();
  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: getServers,
  });

  const defaultServer = servers?.find((s) => s.is_default) ?? null;

  const { data: connectionResult } = useQuery({
    queryKey: ['server-connection', defaultServer?.id],
    queryFn: () => testServerConnection(defaultServer!.id),
    enabled: !!defaultServer,
    refetchInterval: 60000,
    retry: false,
  });

  if (!defaultServer) {
    return (
      <Tooltip title="点击前往设置添加服务器">
        <Tag color="warning" style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')}>
          <Space size={4}>
            <ApiOutlined />
            无服务器
          </Space>
        </Tag>
      </Tooltip>
    );
  }

  const connected = connectionResult?.ok === true;

  return (
    <Tooltip title={`${defaultServer.name} — ${defaultServer.base_url}`}>
      <Tag color={connected ? 'success' : 'error'}>
        <Space size={4}>
          <ApiOutlined />
          {connected ? '已连接' : '未连接'}
        </Space>
      </Tag>
    </Tooltip>
  );
}
