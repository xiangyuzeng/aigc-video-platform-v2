# Docker 部署指南

> 使用 Docker 一键启动 AIGC 视频发布平台，无需安装 Python 或 Node.js。

---

## 前提条件

1. 安装 **Docker Desktop**：
   - Mac：https://docs.docker.com/desktop/install/mac-install/
   - Windows：https://docs.docker.com/desktop/install/windows-install/
   - Linux：https://docs.docker.com/desktop/install/linux/

2. 安装并登录 **AdsPower**

---

## 快速启动（推荐）

### 使用启动脚本

```bash
# Mac / Linux
./start.sh

# Windows — 双击 start.bat
```

脚本会自动：检查 Docker → 检查 .env → 构建镜像 → 启动容器。

### 手动启动

```bash
# 第 1 步：配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 填入 ANTHROPIC_API_KEY 和 KIE_API_KEY

# 第 2 步：启动
docker compose up --build -d

# 第 3 步：访问
# 浏览器打开 http://localhost:5173
```

---

## 完整文档

- **[项目首页（README）](README.md)** — 功能介绍、快速启动、环境变量说明
- **[完整使用指南（Wiki）](docs/wiki/WIKI.md)** — 详细安装指南、API 密钥获取、功能说明和故障排除

---

## 常用命令

```bash
# 后台启动
docker compose up -d

# 查看日志
docker compose logs -f

# 查看容器状态
docker compose ps

# 停止
docker compose down

# 重新构建（代码更新后）
docker compose up --build -d

# 完全重置
docker compose down
rm -rf backend/data/*
docker compose up --build
```

---

## 数据持久化

| 容器路径 | 宿主机路径 | 内容 |
|---------|-----------|------|
| `/app/data` | `./backend/data` | SQLite 数据库 + 上传的视频 |
| `/app/output` | `./backend/output` | 生成的视频文件 |

---

## 跨平台兼容性

| 系统 | Docker | AdsPower 地址 | 启动命令 |
|------|--------|--------------|---------|
| **Mac (Apple Silicon)** | Docker Desktop | `host.docker.internal:50325` | `./start.sh` |
| **Mac (Intel)** | Docker Desktop | `host.docker.internal:50325` | `./start.sh` |
| **Windows 10/11** | Docker Desktop + WSL 2 | `host.docker.internal:50325` | 双击 `start.bat` |
| **Linux (Ubuntu/Debian)** | Docker Engine | `172.17.0.1:50325` | `./start.sh` |

> Docker Desktop 版本要求：4.0+（支持 `docker compose` V2 命令）

---

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| `Cannot connect to the Docker daemon` | 确认 Docker Desktop 已启动 |
| 前端显示「未连接」 | `docker compose logs backend` 查看报错 |
| 无法连接 AdsPower | 服务器页面地址填 `http://host.docker.internal:50325` |
| 构建失败 | `docker compose build --no-cache` 重试 |
| 存储损坏 (input/output error) | 重置 Docker：Mac 删除 `~/Library/Containers/com.docker.docker/Data/vms`，Windows 在 Docker Desktop → Troubleshoot → Clean/Purge data |
