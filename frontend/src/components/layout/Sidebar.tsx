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
  FileTextOutlined,
  HeartOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '控制台' },
  {
    type: 'group',
    label: '基础设置',
    children: [
      { key: '/settings', icon: <SettingOutlined />, label: '服务器' },
      { key: '/profiles', icon: <LaptopOutlined />, label: '设备' },
    ],
  },
  {
    type: 'group',
    label: '内容准备',
    children: [
      { key: '/videos', icon: <PlaySquareOutlined />, label: '视频' },
      { key: '/scraper', icon: <CloudDownloadOutlined />, label: '数据采集' },
      { key: '/products', icon: <ShoppingOutlined />, label: '商品' },
      { key: '/content', icon: <EditOutlined />, label: '文案生成' },
    ],
  },
  {
    type: 'group',
    label: '发布管理',
    children: [
      { key: '/publish', icon: <SendOutlined />, label: '发布' },
      { key: '/schedule', icon: <CalendarOutlined />, label: '智能排期' },
      { key: '/pipeline', icon: <ThunderboltOutlined />, label: '自动流水线' },
      { key: '/templates', icon: <FileTextOutlined />, label: '模板库' },
    ],
  },
  {
    type: 'group',
    label: '数据监控',
    children: [
      { key: '/analytics', icon: <BarChartOutlined />, label: '数据分析' },
      { key: '/account-health', icon: <HeartOutlined />, label: '账号健康' },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const allKeys: string[] = [];
  menuItems?.forEach((item) => {
    if (item && 'children' in item && Array.isArray((item as any).children)) {
      (item as any).children.forEach((child: any) => {
        if (child?.key) allKeys.push(child.key);
      });
    } else if (item && 'key' in item) {
      allKeys.push(item.key as string);
    }
  });
  const selectedKey =
    allKeys.filter((k) => k !== '/').find((k) => location.pathname.startsWith(k)) ?? '/';

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
