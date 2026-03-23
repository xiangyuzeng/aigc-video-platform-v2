# Docker 部署指南

> 使用 Docker 一键启动 AIGC 视频发布平台，无需安装 Python 或 Node.js。

---

## 前提条件

1. 安装 **Docker Desktop**：
   - Mac：https://docs.docker.com/desktop/install/mac-install/
   - Windows：https://docs.docker.com/desktop/install/windows-install/
   - Linux：https://docs.docker.com/desktop/install/linux/

2. 安装 **AdsPower** 并登录

---

## 快速启动

### 第 1 步：下载代码

```bash
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2
```

### 第 2 步：配置环境变量

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，填入你的密钥：

```env
# 必填：AI 文案生成
ANTHROPIC_API_KEY=sk-ant-api03-你的密钥

# 必填（流水线功能）：AI 视频生成
KIE_API_KEY=你的kie密钥

# 重要：Docker 环境下需要改为 host.docker.internal
ADSPOWER_BASE_URL=http://host.docker.internal:50325
```

> **注意**：Docker 容器无法通过 `127.0.0.1` 访问宿主机上的 AdsPower。必须使用 `host.docker.internal`。

### 第 3 步：启动

```bash
docker compose up --build
```

首次启动会自动：
- 安装所有 Python/Node.js 依赖
- 安装 Playwright 浏览器驱动
- 构建前端生产版本
- 运行数据库迁移
- 启动后端和前端服务

等待看到类似输出：
```
aigc-backend   | INFO:     Uvicorn running on http://0.0.0.0:8000
aigc-frontend  | ... nginx ...
```

### 第 4 步：访问平台

打开浏览器访问：**http://localhost:5173**

---

## 常用命令

```bash
# 启动（后台运行）
docker compose up -d

# 查看日志
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 停止
docker compose down

# 重新构建（代码更新后）
docker compose up --build -d

# 清理所有数据重新开始
docker compose down -v
rm -rf backend/data/*
docker compose up --build
```

---

## 数据持久化

以下目录挂载到宿主机，容器删除后数据不会丢失：

| 容器路径 | 宿主机路径 | 内容 |
|---------|-----------|------|
| `/app/data` | `./backend/data` | SQLite 数据库 + 上传的视频 |
| `/app/output` | `./backend/output` | 生成的视频文件 |

---

## Docker 与 AdsPower 的网络连接

AdsPower 运行在你的电脑（宿主机）上，Docker 容器需要通过特殊地址访问：

| 系统 | AdsPower 地址（.env 中填写） |
|------|---------------------------|
| Mac / Windows | `http://host.docker.internal:50325` |
| Linux | `http://172.17.0.1:50325`（或使用 `--network host`） |

如果使用 Linux 且上述地址不通，可以改用 host 网络模式：

```yaml
# docker-compose.yml 中添加
services:
  backend:
    network_mode: host
```

---

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| `Cannot connect to the Docker daemon` | 确认 Docker Desktop 已启动 |
| 前端显示「未连接」 | 检查后端日志：`docker compose logs backend` |
| 无法连接 AdsPower | 确认 `.env` 中使用了 `host.docker.internal`（非 `127.0.0.1`）|
| 构建失败 | 确保网络通畅（需要下载依赖），重试：`docker compose build --no-cache` |
| 视频上传失败 | 检查 `backend/data/uploads` 目录权限 |
