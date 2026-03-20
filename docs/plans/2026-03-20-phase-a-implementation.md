# Phase A: Polish & Package — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the existing developer tool into a polished, installable desktop product that individual AIGC creators would pay for.

**Architecture:** Tauri 2.0 wraps the React frontend in a native window and launches the Python backend (bundled via PyInstaller) as a sidecar process. The backend serves both API and static frontend from a single port (18088). A first-run setup wizard guides new users through AdsPower configuration.

**Tech Stack:** Tauri 2.0 (Rust), PyInstaller, React 18 + Ant Design 5 + TypeScript (existing), FastAPI + SQLAlchemy (existing)

---

## Task 1: App Settings Backend — `setup_completed` Flag

The setup wizard and branding features need a persistent key-value store for app-level settings.

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`
- Create: `backend/app/routers/app_settings.py`

**Step 1: Add AppSetting model**

In `backend/app/models.py`, add at the end:

```python
class AppSetting(Base):
    """Key-value store for app-level settings"""
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
```

**Step 2: Create app_settings router**

Create `backend/app/routers/app_settings.py`:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import AppSetting, Server

router = APIRouter()


@router.get("/")
async def get_all_settings(db: AsyncSession = Depends(get_db)):
    """Return all app settings as a dict."""
    result = await db.execute(select(AppSetting))
    rows = result.scalars().all()
    return {row.key: row.value for row in rows}


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    """Get a single setting by key."""
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    return {"key": key, "value": row.value if row else None}


@router.put("/{key}")
async def set_setting(key: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Set a single setting value."""
    value = body.get("value")
    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    await db.commit()
    return {"key": key, "value": value}


@router.get("/setup/status")
async def get_setup_status(db: AsyncSession = Depends(get_db)):
    """Check if first-run setup is needed."""
    # Setup is needed if: no setup_completed flag AND no servers exist
    result = await db.execute(
        select(AppSetting).where(AppSetting.key == "setup_completed")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value == "true":
        return {"needs_setup": False}

    # Also check if there are any servers (user may have set up manually)
    server_count = await db.execute(select(Server))
    if server_count.scalars().first():
        return {"needs_setup": False}

    return {"needs_setup": True}
```

**Step 3: Register the router**

In `backend/app/main.py`, after the existing router imports:

```python
from app.routers import app_settings
app.include_router(app_settings.router, prefix="/api/app-settings", tags=["app-settings"])
```

**Step 4: Verify**

Run: `cd /Users/davidzeng/Desktop/Combined/backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000`

Test: `curl http://localhost:8000/api/app-settings/setup/status` → should return `{"needs_setup": true}`

**Step 5: Commit**

```bash
git add backend/app/models.py backend/app/routers/app_settings.py backend/app/main.py
git commit -m "feat: add app_settings model and router for setup wizard state"
```

---

## Task 2: Frontend API Client for App Settings

**Files:**
- Create: `frontend/src/api/appSettings.ts`

**Step 1: Create the API client**

Create `frontend/src/api/appSettings.ts`:

```typescript
import client from './client';

export interface SetupStatus {
  needs_setup: boolean;
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const res = await client.get<SetupStatus>('/api/app-settings/setup/status');
  return res.data;
}

export async function getAllSettings(): Promise<Record<string, string | null>> {
  const res = await client.get<Record<string, string | null>>('/api/app-settings/');
  return res.data;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await client.put(`/api/app-settings/${key}`, { value });
}
```

**Step 2: Commit**

```bash
git add frontend/src/api/appSettings.ts
git commit -m "feat: add app settings API client"
```

---

## Task 3: First-Run Setup Wizard — UI Component

**Files:**
- Create: `frontend/src/pages/SetupWizard.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create SetupWizard page**

Create `frontend/src/pages/SetupWizard.tsx`:

```tsx
import { useState } from 'react';
import { Modal, Steps, Button, Input, Form, Table, Alert, Space, Typography, Spin, Result, message } from 'antd';
import { RocketOutlined, ApiOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getServers, createServer } from '../api/servers';
import { testServerConnection, syncServerProfiles, getProfiles } from '../api/profiles';
import { setSetting } from '../api/appSettings';
import type { Server } from '../api/servers';
import type { Profile } from '../api/profiles';

interface SetupWizardProps {
  open: boolean;
  onFinish: () => void;
}

export default function SetupWizard({ open, onFinish }: SetupWizardProps) {
  const [current, setCurrent] = useState(0);
  const [createdServer, setCreatedServer] = useState<Server | null>(null);
  const [syncedProfiles, setSyncedProfiles] = useState<Profile[]>([]);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Step 2: Create server
  const createMutation = useMutation({
    mutationFn: createServer,
    onSuccess: (server) => {
      setCreatedServer(server);
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      message.success('服务器已添加');
    },
  });

  // Step 2: Test connection
  const testMutation = useMutation({
    mutationFn: (serverId: number) => testServerConnection(serverId),
  });

  // Step 3: Sync profiles
  const syncMutation = useMutation({
    mutationFn: (serverId: number) => syncServerProfiles(serverId),
    onSuccess: (profiles) => {
      setSyncedProfiles(profiles);
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      message.success(`已同步 ${profiles.length} 个设备`);
    },
  });

  const handleAddServer = async () => {
    const values = await form.validateFields();
    createMutation.mutate(values);
  };

  const handleTestConnection = () => {
    if (createdServer) {
      testMutation.mutate(createdServer.id);
    }
  };

  const handleSync = () => {
    if (createdServer) {
      syncMutation.mutate(createdServer.id);
    }
  };

  const handleFinish = async () => {
    await setSetting('setup_completed', 'true');
    queryClient.invalidateQueries({ queryKey: ['setup-status'] });
    onFinish();
  };

  const steps = [
    {
      title: '欢迎使用',
      icon: <RocketOutlined />,
    },
    {
      title: '连接 AdsPower',
      icon: <ApiOutlined />,
    },
    {
      title: '同步设备',
      icon: <SyncOutlined />,
    },
    {
      title: '完成',
      icon: <CheckCircleOutlined />,
    },
  ];

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <Result
            icon={<RocketOutlined style={{ color: '#0365C0' }} />}
            title="欢迎使用肯葳科技电商视频发布平台"
            subTitle="接下来我们将帮助您完成初始设置，连接 AdsPower 并同步您的浏览器设备。"
            extra={
              <Typography.Text type="secondary">
                v2.0.0 · 肯葳科技
              </Typography.Text>
            }
          />
        );

      case 1:
        return (
          <div>
            <Alert
              type="info"
              showIcon
              message="请确保 AdsPower 客户端已启动，并在「API & MCP」页面中找到 API 地址（默认 http://127.0.0.1:50325）"
              style={{ marginBottom: 16 }}
            />
            <Form form={form} layout="vertical" initialValues={{ name: '我的 AdsPower', base_url: 'http://127.0.0.1:50325' }}>
              <Form.Item name="name" label="服务器名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="我的 AdsPower" />
              </Form.Item>
              <Form.Item name="base_url" label="API 地址" rules={[{ required: true, message: '请输入地址' }]}>
                <Input placeholder="http://127.0.0.1:50325" />
              </Form.Item>
            </Form>
            <Space>
              {!createdServer ? (
                <Button type="primary" onClick={handleAddServer} loading={createMutation.isPending}>
                  添加服务器
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleTestConnection}
                    loading={testMutation.isPending}
                    icon={<ApiOutlined />}
                  >
                    测试连接
                  </Button>
                  {testMutation.data && (
                    <Typography.Text type={testMutation.data.ok ? 'success' : 'danger'}>
                      {testMutation.data.ok ? '连接成功' : '连接失败'}
                    </Typography.Text>
                  )}
                </>
              )}
            </Space>
          </div>
        );

      case 2:
        return (
          <div>
            {!createdServer ? (
              <Alert type="warning" message="请先在上一步添加服务器" />
            ) : (
              <>
                <Button
                  type="primary"
                  icon={<SyncOutlined />}
                  onClick={handleSync}
                  loading={syncMutation.isPending}
                  style={{ marginBottom: 16 }}
                >
                  同步设备
                </Button>
                {syncedProfiles.length > 0 && (
                  <Table
                    dataSource={syncedProfiles}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '名称', dataIndex: 'profile_name', key: 'profile_name' },
                      { title: '分组', dataIndex: 'group_name', key: 'group_name' },
                      { title: '编号', dataIndex: 'serial_number', key: 'serial_number' },
                    ]}
                  />
                )}
              </>
            )}
          </div>
        );

      case 3:
        return (
          <Result
            status="success"
            title="设置完成"
            subTitle={
              <Space direction="vertical">
                <Typography.Text>
                  {createdServer ? `已连接服务器: ${createdServer.name}` : '未添加服务器（可稍后在服务器管理中添加）'}
                </Typography.Text>
                <Typography.Text>
                  {syncedProfiles.length > 0 ? `已同步 ${syncedProfiles.length} 个设备` : '未同步设备（可稍后在设备页面同步）'}
                </Typography.Text>
              </Space>
            }
          />
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      title={null}
      footer={null}
      closable={false}
      width={640}
      maskClosable={false}
    >
      <Steps current={current} items={steps} style={{ marginBottom: 24 }} />

      {renderStepContent()}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          {current === 0 && (
            <Button type="link" onClick={handleFinish}>
              跳过设置
            </Button>
          )}
        </div>
        <Space>
          {current > 0 && current < 3 && (
            <Button onClick={() => setCurrent(current - 1)}>上一步</Button>
          )}
          {current < 3 && (
            <Button type="primary" onClick={() => setCurrent(current + 1)}>
              {current === 0 ? '开始设置' : '下一步'}
            </Button>
          )}
          {current === 3 && (
            <Button type="primary" onClick={handleFinish}>
              进入主界面
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
}
```

**Step 2: Integrate into App.tsx**

Modify `frontend/src/App.tsx` to check setup status and show wizard:

```tsx
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "./components/layout/AppLayout";
import Settings from "./pages/Settings";
import Videos from "./pages/Videos";
import Profiles from "./pages/Profiles";
import PublishWizard from "./pages/PublishWizard";
import Scraper from "./pages/Scraper";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Products from "./pages/Products";
import ContentGen from "./pages/ContentGen";
import PipelineRuns from "./pages/PipelineRuns";
import SetupWizard from "./pages/SetupWizard";
import { getSetupStatus } from "./api/appSettings";

export default function App() {
  const [wizardDismissed, setWizardDismissed] = useState(false);

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
  });

  const showWizard = setupStatus?.needs_setup === true && !wizardDismissed;

  return (
    <>
      <SetupWizard open={showWizard} onFinish={() => setWizardDismissed(true)} />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/publish" element={<PublishWizard />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/scraper" element={<Scraper />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/products" element={<Products />} />
          <Route path="/content" element={<ContentGen />} />
          <Route path="/pipeline" element={<PipelineRuns />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
```

**Step 3: Verify**

Start frontend dev server, clear the database (or use fresh one). On first load, the setup wizard modal should appear. Clicking "跳过设置" should dismiss it and set `setup_completed=true`.

**Step 4: Commit**

```bash
git add frontend/src/pages/SetupWizard.tsx frontend/src/App.tsx
git commit -m "feat: add first-run setup wizard with AdsPower connection flow"
```

---

## Task 4: ErrorBoundary Component

**Files:**
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Create ErrorBoundary**

Create `frontend/src/components/ErrorBoundary.tsx`:

```tsx
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Result
            status="error"
            title="出现错误"
            subTitle="应用遇到了意外错误，请尝试重新加载。"
            extra={
              <Button type="primary" onClick={this.handleReload}>
                重新加载
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Step 2: Wrap app in ErrorBoundary**

In `frontend/src/main.tsx`, wrap the entire render tree:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: "#0365C0",
              borderRadius: 6,
            },
          }}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

**Step 3: Commit**

```bash
git add frontend/src/components/ErrorBoundary.tsx frontend/src/main.tsx
git commit -m "feat: add ErrorBoundary to catch and display frontend crashes"
```

---

## Task 5: Connection Lost Banner

Detects when the backend is unreachable and shows a persistent red banner.

**Files:**
- Create: `frontend/src/components/ConnectionBanner.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Step 1: Create ConnectionBanner**

Create `frontend/src/components/ConnectionBanner.tsx`:

```tsx
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
```

**Step 2: Add to AppLayout**

Modify `frontend/src/components/layout/AppLayout.tsx`:

```tsx
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ServerStatus from './ServerStatus';
import ConnectionBanner from '../ConnectionBanner';

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
          <ServerStatus />
        </Header>
        <Content style={{ margin: 24, background: '#fff', borderRadius: 8, padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/components/ConnectionBanner.tsx frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: add connection lost banner when backend is unreachable"
```

---

## Task 6: EmptyState Component + Apply to All Pages

Reusable empty state component with illustration and CTA button.

**Files:**
- Create: `frontend/src/components/EmptyState.tsx`
- Modify: `frontend/src/pages/Videos.tsx`
- Modify: `frontend/src/pages/Profiles.tsx`
- Modify: `frontend/src/pages/Scraper.tsx`
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/pages/Analytics.tsx`
- Modify: `frontend/src/pages/Products.tsx`

**Step 1: Create EmptyState component**

Create `frontend/src/components/EmptyState.tsx`:

```tsx
import { Empty, Button } from 'antd';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export default function EmptyState({ description, actionText, onAction, icon }: EmptyStateProps) {
  return (
    <Empty
      image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
      description={description}
      style={{ padding: '48px 0' }}
    >
      {actionText && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </Empty>
  );
}
```

**Step 2: Apply to Settings page**

In `frontend/src/pages/Settings.tsx`, add after imports:

```typescript
import EmptyState from '../components/EmptyState';
```

Replace the `<Table>` section (approximately lines 151-157) with a conditional:

```tsx
{servers.length === 0 && !isLoading ? (
  <EmptyState
    description="还没有添加服务器"
    actionText="添加服务器"
    onAction={openAddModal}
  />
) : (
  <Table<Server>
    columns={columns}
    dataSource={servers}
    rowKey="id"
    loading={isLoading}
    pagination={false}
  />
)}
```

**Step 3: Apply to Videos page**

In `frontend/src/pages/Videos.tsx`, import `EmptyState` and use it when the video list is empty (show "还没有上传视频" with "上传视频" action that scrolls to upload area).

**Step 4: Apply to Profiles page**

In `frontend/src/pages/Profiles.tsx`, import `EmptyState` and show "还没有同步设备" with "前往服务器管理" action navigating to `/settings` when profiles list is empty.

**Step 5: Apply to Products page**

In `frontend/src/pages/Products.tsx`, import `EmptyState` and show "还没有商品" with "添加商品" action when products list is empty.

**Step 6: Apply to Analytics page**

In `frontend/src/pages/Analytics.tsx`, import `EmptyState` and show "还没有数据" with "前往发布" action navigating to `/publish` when no data exists.

**Step 7: Commit**

```bash
git add frontend/src/components/EmptyState.tsx frontend/src/pages/Settings.tsx frontend/src/pages/Videos.tsx frontend/src/pages/Profiles.tsx frontend/src/pages/Products.tsx frontend/src/pages/Analytics.tsx
git commit -m "feat: add EmptyState component and apply to all table pages"
```

---

## Task 7: Chinese Status Labels

Map all English status strings to Chinese labels across the app.

**Files:**
- Create: `frontend/src/utils/statusLabels.ts`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Create centralized status label map**

Create `frontend/src/utils/statusLabels.ts`:

```typescript
export const TASK_STATUS: Record<string, { color: string; label: string }> = {
  draft:      { color: 'default',    label: '草稿' },
  queued:     { color: 'processing', label: '排队中' },
  uploading:  { color: 'processing', label: '上传中' },
  publishing: { color: 'processing', label: '发布中' },
  published:  { color: 'success',    label: '已发布' },
  failed:     { color: 'error',      label: '失败' },
  cancelled:  { color: 'warning',    label: '已取消' },
};

export const VIDEO_STATUS: Record<string, { color: string; label: string }> = {
  ready:     { color: 'green',    label: '就绪' },
  assigned:  { color: 'blue',     label: '已分配' },
  published: { color: 'geekblue', label: '已发布' },
  archived:  { color: 'default',  label: '已归档' },
};

export const PIPELINE_STATUS: Record<string, { color: string; label: string }> = {
  draft:     { color: 'default',    label: '草稿' },
  running:   { color: 'processing', label: '运行中' },
  completed: { color: 'success',    label: '已完成' },
  failed:    { color: 'error',      label: '失败' },
  cancelled: { color: 'warning',    label: '已取消' },
};
```

**Step 2: Update Dashboard.tsx**

In `frontend/src/pages/Dashboard.tsx`, replace the `STATUS_TAG` object (lines 22-30) with:

```typescript
import { TASK_STATUS } from '../utils/statusLabels';
```

Update the status column render function to use `TASK_STATUS` instead of `STATUS_TAG`:

```typescript
render: (status: string) => {
  const cfg = TASK_STATUS[status] ?? { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
},
```

**Step 3: Update Videos.tsx**

Import and use `VIDEO_STATUS` from the shared map instead of the local `STATUS_COLORS` and `STATUS_OPTIONS`.

**Step 4: Commit**

```bash
git add frontend/src/utils/statusLabels.ts frontend/src/pages/Dashboard.tsx frontend/src/pages/Videos.tsx
git commit -m "feat: centralize Chinese status labels for tasks, videos, and pipeline"
```

---

## Task 8: Skeleton Loading States

Replace `<Spin>` with `<Skeleton>` for a more polished loading experience.

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

**Step 1: Add skeleton loaders to Dashboard stats**

In `frontend/src/pages/Dashboard.tsx`, replace the stats loading section (the `overviewLoading ? <Spin>` ternary around lines 182-226):

```tsx
import { Skeleton } from 'antd';
```

Replace the Spin with Skeleton cards:

```tsx
{overviewLoading ? (
  <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
    {[1, 2, 3, 4].map((i) => (
      <Col span={6} key={i}>
        <Card>
          <Skeleton active paragraph={{ rows: 1 }} />
        </Card>
      </Col>
    ))}
  </Row>
) : (
  /* existing stats Row */
)}
```

Replace the tasks table Spin similarly:

```tsx
{tasksLoading ? (
  <Skeleton active paragraph={{ rows: 5 }} />
) : (
  <Table<TaskData> ... />
)}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: replace Spin with Skeleton loading states on Dashboard"
```

---

## Task 9: Sidebar Branding Footer

Show version and company name in sidebar footer.

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Step 1: Add version footer to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add a footer element inside `<Sider>`, below the `<Menu>`:

```tsx
<div
  style={{
    position: 'absolute',
    bottom: 48, // above collapse button
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
```

Note: The `<Sider>` needs `style={{ position: 'relative' }}` for the absolute positioning to work.

**Step 2: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add version and company name to sidebar footer"
```

---

## Task 10: Backend Global Exception Handler

Return structured JSON errors instead of stack traces for production readiness.

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add exception handlers**

In `backend/app/main.py`, after the `app = FastAPI(...)` block, add:

```python
from fastapi import Request
from fastapi.responses import JSONResponse


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return structured JSON."""
    logging.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if app.debug else "服务器内部错误，请稍后重试",
        },
    )
```

Also import and register handlers for known error types from `app/errors.py`:

```python
from app.errors import AdsPowerError, PublishError, ScrapingError, PipelineError


@app.exception_handler(AdsPowerError)
async def adspower_error_handler(request: Request, exc: AdsPowerError):
    return JSONResponse(status_code=502, content={"error": "AdsPower Error", "detail": str(exc)})


@app.exception_handler(ScrapingError)
async def scraping_error_handler(request: Request, exc: ScrapingError):
    return JSONResponse(status_code=502, content={"error": "Scraping Error", "detail": str(exc)})


@app.exception_handler(PublishError)
async def publish_error_handler(request: Request, exc: PublishError):
    return JSONResponse(status_code=500, content={"error": "Publish Error", "detail": str(exc)})


@app.exception_handler(PipelineError)
async def pipeline_error_handler(request: Request, exc: PipelineError):
    return JSONResponse(status_code=500, content={"error": "Pipeline Error", "detail": str(exc)})
```

**Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add structured global exception handlers for production"
```

---

## Task 11: In-App Help System — Help Content

**Files:**
- Create: `frontend/src/help/index.ts`

**Step 1: Create help content data**

Create `frontend/src/help/index.ts`:

```typescript
export interface HelpSection {
  title: string;
  steps?: string[];
  faq?: { q: string; a: string }[];
}

export interface PageHelp {
  pageTitle: string;
  guide: HelpSection;
  faq: HelpSection;
}

const helpContent: Record<string, PageHelp> = {
  '/': {
    pageTitle: 'Dashboard',
    guide: {
      title: '使用指南',
      steps: [
        '查看上方的使用流程卡片，了解从配置到发布的完整步骤',
        '绿色边框的步骤表示已完成，点击任意步骤可直接跳转',
        '下方的统计卡片展示设备、视频、任务和成功率概览',
        '最近任务表格展示最新的发布任务状态',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '步骤一直显示未完成？', a: '请检查是否已添加服务器并同步设备。每个步骤需要至少完成一次操作才会标记为已完成。' },
        { q: '数据多久更新一次？', a: '统计数据每30秒自动刷新一次。' },
      ],
    },
  },
  '/settings': {
    pageTitle: '服务器管理',
    guide: {
      title: '使用指南',
      steps: [
        '确保 AdsPower 客户端已启动',
        '在 AdsPower 客户端左侧菜单「API & MCP」页面找到 API 地址',
        '点击「添加服务器」，填入名称和 API 地址',
        '添加后可在设备页面同步浏览器环境',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '默认端口是什么？', a: 'AdsPower 默认 API 端口为 50325，地址格式：http://127.0.0.1:50325' },
        { q: '可以添加多个服务器吗？', a: '可以。每个 AdsPower 实例可作为单独的服务器添加，支持管理多台电脑上的浏览器环境。' },
      ],
    },
  },
  '/profiles': {
    pageTitle: '设备管理',
    guide: {
      title: '使用指南',
      steps: [
        '选择已配置的服务器',
        '点击「同步」从 AdsPower 拉取浏览器环境列表',
        '为设备设置标签和平台类型',
        '使用筛选器按分组、平台或关键词查找设备',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '设备列表为空？', a: '请先在服务器管理中添加 AdsPower 服务器，然后点击同步按钮。' },
        { q: '同步会覆盖现有数据吗？', a: '同步只会添加新设备和更新已有设备信息，不会删除已有设备。' },
      ],
    },
  },
  '/videos': {
    pageTitle: '视频管理',
    guide: {
      title: '使用指南',
      steps: [
        '点击上传区域或拖拽视频文件上传',
        '支持 MP4、MOV、AVI 格式，建议分辨率 1080x1920',
        '上传后可查看视频封面、时长和文件大小',
        '视频就绪后可在发布页面选择并批量发布',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '上传失败？', a: '请检查文件格式和大小，确保后端服务正常运行。' },
        { q: '如何转录字幕？', a: '点击视频卡片上的麦克风图标，系统会使用 AI 自动生成字幕文本。' },
      ],
    },
  },
  '/scraper': {
    pageTitle: '数据采集',
    guide: {
      title: '使用指南',
      steps: [
        '输入 TikTok 视频链接',
        '选择一个可用的浏览器设备作为采集工具',
        '点击「开始采集」，等待系统自动提取文案和标签',
        '采集完成后复制内容，在发布页面使用',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '采集超时？', a: '采集过程需要启动浏览器环境，通常需要30-60秒。请确保 AdsPower 已启动且网络正常。' },
        { q: '采集的数据在哪里？', a: '采集结果会显示在页面下方，同时保存在数据库中。您可以在发布时选择使用这些文案。' },
      ],
    },
  },
  '/publish': {
    pageTitle: '批量发布',
    guide: {
      title: '使用指南',
      steps: [
        '第一步：选择要发布的设备（浏览器环境）',
        '第二步：选择视频并编辑文案、标签',
        '第三步：设置发布时间（立即发布或定时发布）',
        '第四步：确认后提交，系统会自动逐个发布',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '发布失败怎么办？', a: '检查 AdsPower 是否在线，浏览器环境是否已登录 TikTok。可以在任务列表中重试失败的任务。' },
        { q: '可以同时发布多少个？', a: '系统会按顺序逐个发布，每个间隔约60秒以避免被平台检测。' },
      ],
    },
  },
  '/analytics': {
    pageTitle: '数据分析',
    guide: {
      title: '使用指南',
      steps: [
        '查看发布成功率和每日趋势图',
        '使用日期范围筛选器查看特定时间段数据',
        '饼图展示成功与失败的任务分布',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: '数据从哪来？', a: '所有数据来自系统内部的发布任务记录，不依赖外部 API。' },
      ],
    },
  },
  '/products': {
    pageTitle: '商品管理',
    guide: {
      title: '使用指南',
      steps: [
        '输入商品链接，点击「采集」自动提取商品信息',
        '也可以手动添加商品信息',
        '使用 AI 评分功能评估商品的带货潜力',
        '选择高分商品进入文案生成流程',
      ],
    },
    faq: {
      title: '常见问题',
      faq: [
        { q: 'AI 评分需要什么？', a: '需要配置 Anthropic API Key（在 .env 文件中设置 ANTHROPIC_API_KEY）。' },
      ],
    },
  },
};

export default helpContent;
```

**Step 2: Commit**

```bash
git add frontend/src/help/index.ts
git commit -m "feat: add help content data for all pages"
```

---

## Task 12: In-App Help Drawer Component

**Files:**
- Create: `frontend/src/components/HelpDrawer.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

**Step 1: Create HelpDrawer**

Create `frontend/src/components/HelpDrawer.tsx`:

```tsx
import { useState } from 'react';
import { Drawer, Button, Typography, Collapse, Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import helpContent from '../help/index';

const { Title, Text, Paragraph } = Typography;

export default function HelpDrawer() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const pageHelp = helpContent[location.pathname];

  if (!pageHelp) return null;

  return (
    <>
      <Button
        type="text"
        icon={<QuestionCircleOutlined />}
        onClick={() => setOpen(true)}
        title="帮助"
      />
      <Drawer
        title={`帮助 — ${pageHelp.pageTitle}`}
        open={open}
        onClose={() => setOpen(false)}
        width={400}
      >
        <Collapse
          defaultActiveKey={['guide']}
          ghost
          items={[
            {
              key: 'guide',
              label: <Text strong>{pageHelp.guide.title}</Text>,
              children: pageHelp.guide.steps && (
                <ol style={{ paddingLeft: 20, margin: 0 }}>
                  {pageHelp.guide.steps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <Text>{step}</Text>
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              key: 'faq',
              label: <Text strong>{pageHelp.faq.title}</Text>,
              children: pageHelp.faq.faq && (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {pageHelp.faq.faq.map((item, i) => (
                    <div key={i}>
                      <Text strong>Q: {item.q}</Text>
                      <Paragraph type="secondary" style={{ marginTop: 4 }}>
                        A: {item.a}
                      </Paragraph>
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
}
```

**Step 2: Add HelpDrawer to AppLayout header**

Modify `frontend/src/components/layout/AppLayout.tsx` to include the help button in the header, next to ServerStatus:

```tsx
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
```

**Step 3: Commit**

```bash
git add frontend/src/components/HelpDrawer.tsx frontend/src/components/layout/AppLayout.tsx
git commit -m "feat: add contextual help drawer with per-page guides and FAQ"
```

---

## Task 13: Tauri Shell — Project Scaffolding

Initialize the Tauri 2.0 project that wraps the existing app.

**Files:**
- Create: `src-tauri/` directory (Tauri config, Rust entry, icons)
- Modify: `package.json` (root-level scripts)

**Step 1: Install Tauri CLI**

```bash
cd /Users/davidzeng/Desktop/Combined
npm install --save-dev @tauri-apps/cli@latest
```

**Step 2: Initialize Tauri project**

```bash
npx tauri init
```

When prompted:
- App name: `肯葳科技电商视频发布平台`
- Window title: `肯葳科技电商视频发布平台`
- Web assets path: `../frontend/dist`
- Dev server URL: `http://localhost:5173`
- Frontend dev command: `npm run dev --prefix frontend`
- Frontend build command: `npm run build --prefix frontend`

**Step 3: Configure tauri.conf.json**

Modify `src-tauri/tauri.conf.json` to configure sidecar and window:

```json
{
  "$schema": "https://raw.githubusercontent.com/nickel-org/nickel.rs/master/tauri.conf.schema.json",
  "productName": "肯葳科技电商视频发布平台",
  "version": "2.0.0",
  "identifier": "com.kenwei.video-platform",
  "build": {
    "beforeBuildCommand": "npm run build --prefix frontend",
    "beforeDevCommand": "npm run dev --prefix frontend",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../frontend/dist"
  },
  "app": {
    "windows": [
      {
        "title": "肯葳科技电商视频发布平台",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": [
      "sidecar/backend"
    ]
  }
}
```

**Step 4: Create Rust sidecar launcher**

Modify `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::Command;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Sidecar will be managed once PyInstaller bundle is ready
            // For now, assume backend runs separately in dev
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 5: Commit**

```bash
git add src-tauri/ package.json
git commit -m "feat: scaffold Tauri 2.0 desktop shell with sidecar config"
```

---

## Task 14: PyInstaller Build Spec

Bundle the Python backend into a single executable.

**Files:**
- Create: `backend/build.spec`
- Create: `scripts/build-backend.sh`

**Step 1: Create PyInstaller spec**

Create `backend/build.spec`:

```python
# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

a = Analysis(
    ['app/main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('app', 'app'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'aiosqlite',
        'sqlalchemy.dialects.sqlite',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Keep console for logging; change to False for release
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
```

**Step 2: Create build script**

Create `scripts/build-backend.sh`:

```bash
#!/bin/bash
set -e

echo "=== Building backend with PyInstaller ==="
cd "$(dirname "$0")/../backend"

# Activate venv if exists
if [ -f .venv/bin/activate ]; then
    source .venv/bin/activate
fi

# Install PyInstaller if needed
pip install pyinstaller --quiet

# Build
pyinstaller build.spec --clean --noconfirm

# Copy to Tauri sidecar directory
SIDECAR_DIR="../src-tauri/sidecar"
mkdir -p "$SIDECAR_DIR"
cp dist/backend "$SIDECAR_DIR/backend"

echo "=== Backend built successfully → src-tauri/sidecar/backend ==="
```

```bash
chmod +x scripts/build-backend.sh
```

**Step 3: Commit**

```bash
git add backend/build.spec scripts/build-backend.sh
git commit -m "feat: add PyInstaller build spec and build script for backend sidecar"
```

---

## Task 15: Full Build Pipeline Script

Orchestrate the entire build: frontend → embed in backend → PyInstaller → Tauri.

**Files:**
- Create: `scripts/build-all.sh`
- Create: `scripts/build-frontend.sh`
- Create: `scripts/build-installer.sh`

**Step 1: Create frontend build script**

Create `scripts/build-frontend.sh`:

```bash
#!/bin/bash
set -e

echo "=== Building frontend ==="
cd "$(dirname "$0")/../frontend"
npm run build

# Copy dist to backend static directory for single-port serving
STATIC_DIR="../backend/static"
rm -rf "$STATIC_DIR"
cp -r dist "$STATIC_DIR"

echo "=== Frontend built → backend/static/ ==="
```

**Step 2: Create installer build script**

Create `scripts/build-installer.sh`:

```bash
#!/bin/bash
set -e

echo "=== Building Tauri installer ==="
cd "$(dirname "$0")/../src-tauri"

# Copy sidecar to expected location
mkdir -p sidecar

cargo tauri build

echo "=== Installer built ==="
```

**Step 3: Create build-all script**

Create `scripts/build-all.sh`:

```bash
#!/bin/bash
set -e

SCRIPTS_DIR="$(dirname "$0")"

echo "========================================="
echo "  肯葳科技电商视频发布平台 — Full Build"
echo "========================================="

# Step 1: Build frontend
bash "$SCRIPTS_DIR/build-frontend.sh"

# Step 2: Build backend (PyInstaller)
bash "$SCRIPTS_DIR/build-backend.sh"

# Step 3: Build Tauri installer
bash "$SCRIPTS_DIR/build-installer.sh"

echo "========================================="
echo "  Build complete!"
echo "========================================="
```

```bash
chmod +x scripts/build-all.sh scripts/build-frontend.sh scripts/build-installer.sh
```

**Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add full build pipeline scripts (frontend + backend + installer)"
```

---

## Task 16: Backend Serves Static Frontend (Production Mode)

In production (when `backend/static/` exists), serve the frontend from FastAPI.

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add static file serving for production**

In `backend/app/main.py`, at the very end of the file (after all router registrations), add:

```python
# --- Serve frontend static files in production (when bundled) ---
import pathlib

_static_dir = pathlib.Path(__file__).parent.parent / "static"
if _static_dir.is_dir():
    # Serve index.html for SPA fallback
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = _static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_static_dir / "index.html")

    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static-frontend")
```

Note: This must come after all API routes so `/api/*` routes take priority.

**Step 2: Update config for production port**

In `backend/app/config.py`, note the port is already configurable via `port: int = 8000`. For production Tauri builds, this will be overridden to `18088` via environment variable.

**Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: serve bundled frontend from FastAPI in production mode"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | App settings backend | `models.py`, `app_settings.py`, `main.py` |
| 2 | App settings API client | `appSettings.ts` |
| 3 | Setup wizard UI | `SetupWizard.tsx`, `App.tsx` |
| 4 | ErrorBoundary | `ErrorBoundary.tsx`, `main.tsx` |
| 5 | Connection lost banner | `ConnectionBanner.tsx`, `AppLayout.tsx` |
| 6 | EmptyState component | `EmptyState.tsx` + 6 pages |
| 7 | Chinese status labels | `statusLabels.ts`, `Dashboard.tsx`, `Videos.tsx` |
| 8 | Skeleton loading | `Dashboard.tsx` |
| 9 | Sidebar branding | `Sidebar.tsx` |
| 10 | Backend exception handlers | `main.py` |
| 11 | Help content data | `help/index.ts` |
| 12 | Help drawer component | `HelpDrawer.tsx`, `AppLayout.tsx` |
| 13 | Tauri scaffolding | `src-tauri/` |
| 14 | PyInstaller build spec | `build.spec`, `build-backend.sh` |
| 15 | Full build pipeline | `scripts/` |
| 16 | Static frontend serving | `main.py` |

## Verification

After all tasks:

1. **Setup wizard**: Delete `data/app.db`, restart backend, reload frontend → wizard appears
2. **ErrorBoundary**: Throw error in a component → error page renders with reload button
3. **Connection banner**: Stop backend → red banner appears; restart → banner disappears
4. **Empty states**: With fresh DB, each page shows illustrated empty state with CTA
5. **Chinese labels**: Dashboard recent tasks show 草稿/排队中/已发布 etc.
6. **Skeleton loading**: Dashboard shows skeleton cards while data loads
7. **Help drawer**: Click `?` button in header → right-side drawer with page-specific help
8. **Sidebar footer**: `v2.0.0 · 肯葳科技` visible at bottom of sidebar
9. **Backend errors**: Trigger an error → JSON response with `error`/`detail`, no stack trace
10. **Build pipeline**: `bash scripts/build-all.sh` completes (frontend + PyInstaller + Tauri)
