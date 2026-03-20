import { useState } from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  SendOutlined,
  PlaySquareOutlined,
  LaptopOutlined,
  CloudDownloadOutlined,
  BarChartOutlined,
  SettingOutlined,
  VideoCameraOutlined,
  ShoppingOutlined,
  EditOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { type: 'divider' },
  { key: '/settings', icon: <SettingOutlined />, label: '服务器管理' },
  { key: '/profiles', icon: <LaptopOutlined />, label: '设备' },
  { key: '/videos', icon: <PlaySquareOutlined />, label: '视频' },
  { key: '/scraper', icon: <CloudDownloadOutlined />, label: '数据采集' },
  { key: '/publish', icon: <SendOutlined />, label: '发布' },
  { type: 'divider' },
  { key: '/products', icon: <ShoppingOutlined />, label: '商品' },
  { key: '/content', icon: <EditOutlined />, label: '文案生成' },
  { key: '/pipeline', icon: <ThunderboltOutlined />, label: '自动流水线' },
  { type: 'divider' },
  { key: '/analytics', icon: <BarChartOutlined />, label: '数据分析' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey =
    menuItems
      ?.filter((item): item is NonNullable<typeof item> & { key: string } => item !== null)
      .map((item) => item.key)
      .filter((key) => key !== '/')
      .find((key) => location.pathname.startsWith(key)) ?? '/';

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="lg"
      theme="dark"
      style={{ position: 'relative' }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          overflow: 'hidden',
        }}
      >
        {collapsed ? (
          <VideoCameraOutlined style={{ fontSize: 24, color: '#fff' }} />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
            肯葳科技电商视频发布平台
          </span>
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={handleMenuClick}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '8px 16px',
        }}
      >
        {!collapsed && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            v2.0.0 · 肯葳科技
          </span>
        )}
      </div>
    </Sider>
  );
}
