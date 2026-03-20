import { Card, Steps, Button, Typography } from 'antd';
import {
  CloudServerOutlined,
  SyncOutlined,
  UploadOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSetupStatus } from '../../hooks/useSetupStatus';

const { Text } = Typography;

export default function SetupChecklist() {
  const navigate = useNavigate();
  const {
    isLoading,
    isSetupComplete,
    currentStep,
    hasServers,
    hasProfiles,
    hasVideos,
    serverCount,
    profileCount,
    videoCount,
  } = useSetupStatus();

  if (isLoading || isSetupComplete) return null;

  const stepItems = [
    {
      title: '添加服务器',
      description: hasServers
        ? `已添加 ${serverCount} 台服务器`
        : '配置 AdsPower 服务器地址',
      icon: <CloudServerOutlined />,
      content: !hasServers && (
        <Button type="primary" size="small" onClick={() => navigate('/settings')}>
          前往设置
        </Button>
      ),
    },
    {
      title: '同步设备',
      description: hasProfiles
        ? `已同步 ${profileCount} 个设备`
        : '从服务器拉取浏览器配置',
      icon: <SyncOutlined />,
      content: !hasProfiles && (
        <Button
          size="small"
          disabled={!hasServers}
          onClick={() => navigate('/profiles')}
        >
          前往设备管理
        </Button>
      ),
    },
    {
      title: '上传视频',
      description: hasVideos
        ? `已上传 ${videoCount} 个视频`
        : '上传需要发布的视频文件',
      icon: <UploadOutlined />,
      content: !hasVideos && (
        <Button size="small" onClick={() => navigate('/videos')}>
          前往上传
        </Button>
      ),
    },
    {
      title: '开始发布',
      description: '创建批量发布任务',
      icon: <SendOutlined />,
      content: (
        <Button
          type="primary"
          size="small"
          disabled={!isSetupComplete}
          onClick={() => navigate('/publish')}
        >
          新建发布
        </Button>
      ),
    },
  ];

  return (
    <Card style={{ marginBottom: 24 }}>
      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 16 }}>
        快速开始
      </Text>
      <Steps
        direction="vertical"
        size="small"
        current={currentStep}
        items={stepItems.map((item, index) => ({
          title: item.title,
          description: (
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {item.description}
              </Text>
              {item.content && <div style={{ marginTop: 8 }}>{item.content}</div>}
            </div>
          ),
          icon: item.icon,
          status:
            index < currentStep
              ? 'finish'
              : index === currentStep
                ? 'process'
                : 'wait',
        }))}
      />
    </Card>
  );
}
