import { Layout, Space } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ServerStatus from './ServerStatus';
import ConnectionBanner from '../ConnectionBanner';
import HelpDrawer from '../HelpDrawer';

const { Content, Header } = Layout;

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <ConnectionBanner />
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Space>
            <HelpDrawer />
            <ServerStatus />
          </Space>
        </Header>
        <Content style={{ margin: 24, background: '#fff', borderRadius: 8, padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
