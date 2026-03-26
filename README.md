# AIGC 多账号视频发布平台

> 基于 AdsPower 反检测浏览器的多账号社交媒体视频自动发布系统。一键 Docker 部署，支持 Mac / Windows / Linux。

---

## 功能特性

- **多账号管理** — 通过 AdsPower 浏览器环境隔离，同时管理多个 TikTok / 社媒账号
- **AI 文案生成** — 基于 Claude AI 自动生成多语言视频文案和脚本
- **AI 视频生成** — 集成 kie.ai (Veo3) 模型，从文字生成短视频
- **自动发布** — Playwright 自动化操作浏览器，一键发布到多个账号
- **智能排期** — 设定发布时间表，自动按计划执行
- **流水线** — 串联「生成文案 → 生成视频 → 发布」全流程
- **数据采集** — 抓取竞品视频数据用于内容灵感
- **数据分析** — 发布成功率、账号健康度等数据看板

---

## 系统要求

| 软件 | 说明 |
|------|------|
| **Docker Desktop 4.0+** | [Mac 下载](https://docs.docker.com/desktop/install/mac-install/) · [Windows 下载](https://docs.docker.com/desktop/install/windows-install/) · [Linux 下载](https://docs.docker.com/desktop/install/linux/) |
| **AdsPower** | [官网下载](https://www.adspower.com/) — 安装后需保持运行 |

> 无需安装 Python、Node.js 或任何开发工具。Docker 会自动处理所有依赖。

---

## 30 秒快速启动

### 第 1 步：下载项目

```bash
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2
```

或直接 [下载 ZIP](https://github.com/xiangyuzeng/aigc-video-platform-v2/archive/refs/heads/main.zip) 并解压。

### 第 2 步：启动

```bash
# Mac / Linux
chmod +x start.sh
./start.sh

# Windows — 双击 start.bat
```

首次启动会自动：
1. 检查 Docker 是否运行
2. 从模板创建 `.env` 配置文件（自动打开编辑器让你填写 API 密钥）
3. 构建 Docker 镜像（首次约 3-5 分钟）
4. 启动前后端容器

### 第 3 步：打开浏览器

```
http://localhost:5173
```

---

## API 密钥获取

使用前需要配置 `backend/.env` 中的 API 密钥：

| 密钥 | 必须 | 获取方式 |
|------|------|----------|
| `ANTHROPIC_API_KEY` | 是 | 1. 访问 [console.anthropic.com](https://console.anthropic.com/) 2. 注册 / 登录 3. 点击「API Keys」→「Create Key」 |
| `KIE_API_KEY` | 是（视频生成） | 1. 访问 [kie.ai](https://kie.ai/) 2. 注册账号 3. 进入控制台获取 API Key |
| `OPENAI_API_KEY` | 可选（图片生成） | 1. 访问 [platform.openai.com](https://platform.openai.com/) 2. 创建 API Key |

---

## AdsPower 配置

平台通过 AdsPower 的本地 API 控制浏览器环境：

1. **打开 AdsPower** → 确保软件正在运行
2. **获取 API 地址**：AdsPower 默认运行在 `http://127.0.0.1:50325`
3. **创建浏览器环境**：在 AdsPower 中创建所需的账号环境
4. **在平台中添加服务器**：进入「服务器」页面，填入地址 `http://127.0.0.1:50325`
5. **同步设备**：进入「设备」页面，点击「同步」拉取 AdsPower 中的浏览器环境

> **Docker 用户注意**：Docker 容器内无法访问 `127.0.0.1`，系统已自动配置为 `host.docker.internal:50325`，无需手动修改。

---

## 环境变量说明

完整配置项见 `backend/.env.example`，关键配置：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ADSPOWER_BASE_URL` | `http://127.0.0.1:50325` | AdsPower API 地址 |
| `ANTHROPIC_API_KEY` | — | Claude AI 密钥（文案生成） |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Claude 模型名称 |
| `KIE_API_KEY` | — | kie.ai 密钥（视频生成） |
| `KIE_PROVIDER` | `veo` | 视频生成模型（veo = Google Veo3） |
| `KIE_DEFAULT_ASPECT_RATIO` | `9:16` | 视频比例（竖屏） |
| `OPENAI_API_KEY` | — | OpenAI 密钥（可选，图片生成） |
| `TTS_ENGINE` | `edge-tts` | 语音合成引擎 |
| `TTS_VOICE` | `en-US-AriaNeural` | 语音角色 |
| `DEFAULT_TIMEZONE` | `America/Mexico_City` | 排期时区 |

---

## 项目结构

```
aigc-video-platform-v2/
├── README.md              ← 本文件
├── DOCKER.md              ← Docker 部署详情
├── docker-compose.yml     ← 容器编排配置
├── start.sh               ← Mac/Linux 一键启动
├── start.bat              ← Windows 一键启动
├── backend/               ← FastAPI 后端
│   ├── app/
│   │   ├── main.py        ← 入口
│   │   ├── config.py      ← 配置
│   │   ├── models.py      ← 数据模型
│   │   ├── routers/       ← API 路由
│   │   └── services/      ← 业务逻辑
│   ├── alembic/           ← 数据库迁移
│   ├── data/              ← 运行时数据（SQLite + 上传文件）
│   ├── .env.example       ← 环境变量模板
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              ← React 前端
│   ├── src/
│   │   ├── pages/         ← 页面组件
│   │   ├── components/    ← 公共组件
│   │   ├── api/           ← API 调用
│   │   └── stores/        ← 状态管理
│   ├── Dockerfile
│   ├── nginx.conf         ← Nginx 配置（生产）
│   └── package.json
└── docs/
    └── wiki/WIKI.md       ← 完整使用指南
```

---

## 常用命令

```bash
# 启动（后台运行）
docker compose up -d

# 查看实时日志
docker compose logs -f

# 查看容器状态
docker compose ps

# 停止
docker compose down

# 更新代码后重新构建
docker compose up --build -d

# 完全重置（清除所有数据）
docker compose down
rm -rf backend/data/*
docker compose up --build -d
```

---

## 使用流程

```
服务器 → 设备 → 视频 → 文案生成 → 发布
  │       │       │        │          │
  │       │       │        │          └─ 选择账号 + 视频，一键发布
  │       │       │        └─ AI 生成文案/脚本/标签
  │       │       └─ 上传或 AI 生成视频
  │       └─ 同步 AdsPower 浏览器环境
  └─ 添加 AdsPower 服务器地址
```

详细操作请见 **[完整使用指南（Wiki）](docs/wiki/WIKI.md)**

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + Zustand |
| 后端 | FastAPI + SQLAlchemy 2.0 (async) + SQLite |
| 浏览器自动化 | Playwright → AdsPower CDP |
| AI 文案 | Anthropic Claude API |
| AI 视频 | kie.ai (Veo3) |
| 语音合成 | Edge TTS |
| 部署 | Docker Compose + Nginx |

---

## 跨平台兼容性

| 系统 | 启动命令 | 说明 |
|------|----------|------|
| Mac (Apple Silicon / Intel) | `./start.sh` | Docker Desktop |
| Windows 10/11 | 双击 `start.bat` | Docker Desktop + WSL 2 |
| Linux (Ubuntu/Debian) | `./start.sh` | Docker Engine |

---

## 常见问题

<details>
<summary><b>Q: Docker 启动失败怎么办？</b></summary>

1. 确认 Docker Desktop 已启动（系统托盘有鲸鱼图标）
2. 运行 `docker compose build --no-cache` 重试
3. 如遇存储损坏：Mac 删除 `~/Library/Containers/com.docker.docker/Data/vms`，Windows 在 Docker Desktop → Troubleshoot → Clean/Purge data
</details>

<details>
<summary><b>Q: 无法连接 AdsPower？</b></summary>

1. 确认 AdsPower 已启动
2. Docker 用户：系统已自动处理网络，无需手动配置
3. 本地开发：服务器地址填 `http://127.0.0.1:50325`
</details>

<details>
<summary><b>Q: 文案生成失败？</b></summary>

检查 `backend/.env` 中的 `ANTHROPIC_API_KEY` 是否正确配置，确认账户有余额。
</details>

<details>
<summary><b>Q: 视频生成失败？</b></summary>

检查 `backend/.env` 中的 `KIE_API_KEY` 是否正确配置。Veo3 模型最长生成 8 秒视频。
</details>

<details>
<summary><b>Q: 如何备份数据？</b></summary>

所有数据存储在 `backend/data/` 目录中（SQLite 数据库 + 上传文件），复制此目录即可完成备份。
</details>

---

## 相关文档

- [Docker 部署指南](DOCKER.md)
- [完整使用指南（Wiki）](docs/wiki/WIKI.md)

---

## 许可证

MIT License
