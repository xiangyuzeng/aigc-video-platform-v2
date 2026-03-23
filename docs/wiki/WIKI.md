# AIGC 电商视频发布平台 — 完整使用指南

> 基于 AdsPower 指纹浏览器的多账号社交媒体视频自动发布平台。

---

## 目录

1. [平台简介](#1-平台简介)
2. [安装与启动（Docker 方式 — 推荐）](#2-安装与启动docker-方式--推荐)
3. [安装与启动（手动方式 — 备选）](#3-安装与启动手动方式--备选)
4. [API 密钥配置](#4-api-密钥配置)
5. [控制台（首页）](#5-控制台首页)
6. [第一步：服务器配置](#6-第一步服务器配置)
7. [第二步：同步设备](#7-第二步同步设备)
8. [第三步：上传视频](#8-第三步上传视频)
9. [第四步：数据采集](#9-第四步数据采集)
10. [第五步：商品管理](#10-第五步商品管理)
11. [第六步：AI 文案生成](#11-第六步ai-文案生成)
12. [第七步：批量发布](#12-第七步批量发布)
13. [第八步：智能排期](#13-第八步智能排期)
14. [第九步：自动流水线](#14-第九步自动流水线)
15. [第十步：模板库](#15-第十步模板库)
16. [第十一步：数据分析](#16-第十一步数据分析)
17. [第十二步：账号健康](#17-第十二步账号健康)
18. [完整操作演示（从零开始）](#18-完整操作演示从零开始)
19. [常见问题与解决方案](#19-常见问题与解决方案)

---

## 1. 平台简介

本平台是一个**本地运行**的 Web 应用，帮助你通过 AdsPower 指纹浏览器实现**多账号自动化视频发布**。

### 主要功能

- **多账号发布**：同时向多个社交媒体账号发布视频
- **AI 文案生成**：使用 Claude AI 自动生成标题、标签、描述和视频脚本
- **商品采集**：从 TikTok Shop 等电商平台自动抓取商品信息
- **AI 视频生成**：通过 kie.ai 使用 Veo 3 模型生成短视频
- **智能排期**：在最佳时间段自动发布，支持日历视图
- **流水线自动化**：一键完成从商品选择到视频发布的全流程
- **健康监控**：追踪各账号的发布成功率和健康分数

### 技术架构

本平台分为两个部分，使用 Docker 时会自动打包在一起：
- **后端**（Backend）：Python + FastAPI，运行在 `http://localhost:8000`
- **前端**（Frontend）：React + TypeScript + Nginx，运行在 `http://localhost:5173`

---

## 2. 安装与启动（Docker 方式 — 推荐）

> **推荐所有用户使用此方式**。Docker 方式只需安装一个软件，一条命令即可启动整个平台，无需安装 Python、Node.js 或任何编程工具。Mac、Windows、Linux 操作完全相同。

### 2.1 安装 Docker Desktop

**Mac：**
1. 访问 https://docs.docker.com/desktop/install/mac-install/
2. 根据你的芯片选择下载：
   - **Apple 芯片**（M1/M2/M3/M4）：选 "Apple Silicon"
   - **Intel 芯片**：选 "Intel Chip"
   - 不确定？点击左上角  → 关于本机 → 查看"芯片"
3. 打开下载的 `.dmg` 文件，将 Docker 拖入 Applications 文件夹
4. 从 Applications 中打开 Docker
5. 首次启动需要授权密码，然后等待 Docker 引擎初始化
6. **状态栏鲸鱼图标停止动画** = 启动完成

**Windows：**
1. 访问 https://docs.docker.com/desktop/install/windows-install/
2. 下载并运行安装程序
3. 安装过程中会提示启用 **WSL 2**（Windows Subsystem for Linux）
   - 勾选 "Use WSL 2 instead of Hyper-V"（推荐）
   - 如果提示需要更新 WSL，按照弹窗链接安装 WSL 2 更新包
4. 安装完成后**重启电脑**
5. 重启后打开 Docker Desktop，等待引擎启动
6. **系统托盘鲸鱼图标变绿** = 启动完成

**Linux（Ubuntu/Debian）：**
```bash
# 安装 Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# 注销后重新登录使生效
```

**验证安装**（打开终端 / PowerShell / 命令提示符）：
```bash
docker --version
docker compose version
```
两条命令都有输出即表示安装成功。如果提示 "command not found"，请重启终端再试。

### 2.2 安装 AdsPower

1. 访问 [AdsPower 官网](https://www.adspower.com/) 下载对应系统版本
2. 安装并打开 AdsPower
3. **注册或登录** AdsPower 账号（**必须登录才能使用 API**）
4. 在 AdsPower 中创建至少一个浏览器环境（Profile）
5. 确认 API 已启用：点击顶部 **API & MCP** → 看到 API 地址（如 `http://127.0.0.1:50325`）

> **重要**：AdsPower 必须保持打开和登录状态，平台才能控制浏览器环境。

### 2.3 下载代码

**方式一：使用 Git（推荐）**

先安装 Git（如果没有）：
- Mac：打开终端运行 `xcode-select --install`
- Windows：访问 https://git-scm.com/download/win 下载安装

然后下载代码：
```bash
# Mac / Linux
cd ~/Desktop
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2

# Windows (PowerShell)
cd $env:USERPROFILE\Desktop
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2
```

**方式二：直接下载 ZIP（不需要 Git）**

1. 访问 https://github.com/xiangyuzeng/aigc-video-platform-v2/archive/refs/heads/main.zip
2. 解压到桌面
3. 打开终端，进入解压后的文件夹：
```bash
# Mac
cd ~/Desktop/aigc-video-platform-v2-main

# Windows (PowerShell)
cd $env:USERPROFILE\Desktop\aigc-video-platform-v2-main
```

### 2.4 配置环境变量

```bash
# Mac / Linux
cp backend/.env.example backend/.env

# Windows (PowerShell)
copy backend\.env.example backend\.env
```

然后用文本编辑器打开 `backend/.env`，填入你的 API 密钥（详见[第 4 节](#4-api-密钥配置)）。

**必须修改的 3 项：**

```env
# 1. AI 文案生成密钥（必填，否则文案功能不可用）
ANTHROPIC_API_KEY=sk-ant-api03-你的密钥

# 2. AI 视频生成密钥（流水线功能需要，否则可跳过）
KIE_API_KEY=你的kie密钥

# 3. AdsPower 地址（Docker 会自动处理，通常无需手动改）
#    docker-compose.yml 已自动覆盖为 host.docker.internal
ADSPOWER_BASE_URL=http://127.0.0.1:50325
```

> **注意**：Docker 环境中 `ADSPOWER_BASE_URL` 会被 `docker-compose.yml` 自动覆盖为 `http://host.docker.internal:50325`，所以 `.env` 中保持默认值即可。

### 2.5 一键启动

**方式一：使用启动脚本（最简单）**

```bash
# Mac / Linux
./start.sh

# Windows — 双击 start.bat 文件
```

启动脚本会自动：检查 Docker → 检查配置 → 构建镜像 → 启动容器。

**方式二：手动启动**

确保 **Docker Desktop** 和 **AdsPower** 都已经打开，然后运行：

```bash
docker compose up --build -d
```

首次启动会自动完成以下步骤（约 3-5 分钟）：
1. 下载 Python 3.11 + Node.js 18 运行环境
2. 安装所有后端和前端依赖库
3. 安装 Playwright 浏览器驱动（用于自动化发布）
4. 构建前端生产版本
5. 运行数据库迁移（创建表结构）
6. 启动后端 API 服务器和前端 Web 服务器

查看启动进度：
```bash
docker compose logs -f
```

看到以下输出表示启动成功：
```
aigc-backend   | [2/2] Starting API server on port 8000...
aigc-backend   | INFO:     Uvicorn running on http://0.0.0.0:8000
aigc-frontend  | ... start worker processes ...
```

> **提示**：首次构建较慢（3-5 分钟），之后再次启动只需几秒钟。

### 2.6 打开平台

在浏览器中访问：**http://localhost:5173**

你应该能看到平台的控制台页面，右上角显示「已连接」。

> **如果显示「未连接」**：运行 `docker compose logs backend` 查看后端是否有报错。

### 2.7 常用 Docker 命令

```bash
# 后台启动（不占用终端窗口）
docker compose up -d

# 查看运行日志（按 Ctrl+C 退出查看）
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 查看容器健康状态
docker compose ps

# 停止平台
docker compose down

# 代码更新后重新构建
docker compose up --build -d

# 完全重置（清除所有数据，从零开始）
docker compose down
rm -rf backend/data/*         # Mac / Linux
# rmdir /s backend\data       # Windows
docker compose up --build
```

### 2.8 数据持久化

以下数据保存在你的电脑上，即使删除容器也不会丢失：

| 数据 | 本地路径 | 说明 |
|------|----------|------|
| 数据库 | `backend/data/app.db` | 所有配置、任务记录、商品信息 |
| 上传的视频 | `backend/data/uploads/` | 手动上传的 MP4 文件 |
| 生成的视频 | `backend/output/` | AI 流水线生成的视频文件 |

> **备份**：只需复制 `backend/data/` 和 `backend/output/` 文件夹即可完整备份所有数据。

### 2.9 Docker 与 AdsPower 的网络连接

AdsPower 运行在你的电脑上（不在 Docker 中），所以 Docker 容器需要通过特殊地址访问宿主机：

| 你的系统 | 平台「服务器」页面中填写的 AdsPower 地址 |
|----------|----------------------------------------|
| **Mac** | `http://host.docker.internal:50325` |
| **Windows** | `http://host.docker.internal:50325` |
| **Linux** | `http://172.17.0.1:50325`（或使用 `--network host`） |

> **重要**：`docker-compose.yml` 已自动将后端的 AdsPower 地址设为 `host.docker.internal`。你只需要在平台「服务器」页面添加 AdsPower 时，也使用上述地址（而不是 `127.0.0.1`）。

---

## 3. 安装与启动（手动方式 — 备选）

> 如果你不想使用 Docker，可以手动安装所有依赖。适合需要修改代码的开发者。

### 3.1 Mac 手动安装

```bash
# 安装 Homebrew（如果没有）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 安装依赖
brew install python@3.11 node@18 git

# 下载代码
cd ~/Desktop
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2

# 设置后端
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入密钥（ADSPOWER_BASE_URL 保持 http://127.0.0.1:50325）

# 初始化数据库
alembic upgrade head

# 设置前端（新终端窗口）
cd ~/Desktop/aigc-video-platform-v2/frontend
npm install
```

### 3.2 Windows 手动安装

1. 安装 Python 3.11+（https://python.org ，**勾选 Add to PATH**）
2. 安装 Node.js 18+（https://nodejs.org ，LTS 版本）
3. 安装 Git（https://git-scm.com/download/win）

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2

cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
copy .env.example .env
:: 编辑 .env 填入密钥
alembic upgrade head

:: 新命令提示符窗口
cd %USERPROFILE%\Desktop\aigc-video-platform-v2\frontend
npm install
```

### 3.3 手动启动（每次使用时）

需要打开 **两个终端窗口** + **AdsPower**：

**终端 1 — 后端：**
```bash
cd ~/Desktop/aigc-video-platform-v2/backend   # Windows: cd %USERPROFILE%\Desktop\...
source venv/bin/activate                        # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**终端 2 — 前端：**
```bash
cd ~/Desktop/aigc-video-platform-v2/frontend
npm run dev
```

打开浏览器访问：**http://localhost:5173**

> **注意**：手动方式下，`.env` 中的 `ADSPOWER_BASE_URL` 保持 `http://127.0.0.1:50325`（不需要改为 `host.docker.internal`）。

---

## 4. API 密钥配置

本平台依赖以下外部服务。你需要分别注册并获取 API 密钥。

### 4.1 Anthropic API 密钥（必填 — AI 文案生成）

**没有这个密钥，文案生成和商品评分功能将无法使用。**

**获取步骤：**
1. 访问 https://console.anthropic.com/
2. 点击 **Sign Up** 注册账号（需要邮箱验证）
3. 登录后，点击左侧菜单 **API Keys**
4. 点击 **Create Key** 创建密钥
5. 复制密钥（格式：`sk-ant-api03-...`）
6. 粘贴到 `backend/.env` 中的 `ANTHROPIC_API_KEY=` 后面

> **费用**：按使用量计费，新账号有免费额度。每次文案生成约 $0.01-0.05。

### 4.2 kie.ai API 密钥（自动流水线视频生成时必填）

**获取步骤：**
1. 访问 https://kie.ai/
2. 注册并登录
3. 进入 API 设置页面
4. 创建 API Key 并复制
5. 粘贴到 `.env` 中的 `KIE_API_KEY=` 后面

> **注意**：Veo 3 模型生成视频最长 8 秒，每次生成约 2-5 分钟。

### 4.3 AdsPower 本地 API 地址

**获取步骤：**
1. 打开 AdsPower 客户端并**登录**
2. 点击顶部 **API & MCP** 菜单
3. 复制显示的 API 地址（通常是 `http://127.0.0.1:50325`）

**在平台中填写时的地址区别：**

| 部署方式 | `.env` 文件中填写 | 平台「服务器」页面中填写 |
|---------|------------------|----------------------|
| **Docker** | `http://host.docker.internal:50325` | `http://host.docker.internal:50325` |
| **手动安装** | `http://127.0.0.1:50325` | `http://127.0.0.1:50325` |

> **重要**：AdsPower 必须保持运行状态！端口以 AdsPower 实际显示的为准。

### 4.4 Docker 环境完整 `.env` 示例

```env
# AI 文案生成（必填）
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxx

# AI 视频生成（流水线功能需要）
KIE_API_KEY=kie_xxxxxxxxxxxxxxxxxxxx

# Docker 环境下 AdsPower 地址（注意不是 127.0.0.1）
ADSPOWER_BASE_URL=http://host.docker.internal:50325

# 采集功能使用的 Profile ID
SCRAPER_PROFILE_ID=你的ProfileID

# 时区
DEFAULT_TIMEZONE=America/Mexico_City
```

---

## 5. 控制台（首页）

> **侧边栏位置**：控制台

![控制台](screenshots/01-dashboard.png)

### 页面说明

控制台是平台的总览页面，展示关键数据和快捷入口。

### 页面元素

| 区域 | 说明 |
|------|------|
| **使用流程** | 6 步引导图，点击任意步骤可跳转 |
| **设备总数** | 已同步的 AdsPower 浏览器环境数量 |
| **视频总数** | 视频库中的视频数量 |
| **今日任务** | 今天创建的发布任务数量 |
| **成功率（7天）** | 最近 7 天的发布成功率 |
| **快捷操作按钮** | 一键生成、新建发布、上传视频、同步设备、采集文案 |
| **最近任务** | 最近的发布任务列表（已发布/失败） |

### 注意事项

- 右上角连接指示器：「已连接」= 后端正常，「未连接」= 后端可能没启动
- 第一次使用时数据为空，按使用流程逐步操作即可

---

## 6. 第一步：服务器配置

> **侧边栏位置**：基础设置 → 服务器

![服务器配置](screenshots/02-servers.png)

### 页面说明

管理 AdsPower 服务器连接。

### 操作步骤

1. 点击 **「添加服务器」**
2. 填写：
   - **名称**：如「我的 AdsPower」
   - **服务器地址**：
     - Docker 用户填：`http://host.docker.internal:50325`
     - 手动安装用户填：`http://127.0.0.1:50325`
3. 点击确定

### 注意事项

- 第一个服务器自动设为**默认**
- AdsPower 必须在运行状态
- 添加后点击 **「下一步：同步设备」** 继续
- 删除服务器会同时删除关联设备

---

## 7. 第二步：同步设备

> **侧边栏位置**：基础设置 → 设备

![设备管理](screenshots/03-profiles.png)

### 操作步骤

1. 选择服务器（默认已选）
2. 可选：点击「测试连接」确认可达
3. 点击 **「同步设备」**
4. 等待完成（设备多时 10-20 秒）

### 表格列说明

| 列 | 说明 |
|----|------|
| **名称** | AdsPower 中的环境名称 |
| **分组** | 环境分组 |
| **平台** | 关联的社交媒体平台 |
| **标签** | 可自定义标签 |
| **编号** | AdsPower 序号 |
| **最后同步** | 上次同步时间 |

### 注意事项

- 未分组环境也会同步
- 同步有速率限制延迟（1.5秒/批），避免 AdsPower API 限流
- 设备不会自动更新，需手动点击「同步设备」

---

## 8. 第三步：上传视频

> **侧边栏位置**：内容准备 → 视频

![视频库](screenshots/04-videos.png)

### 操作步骤

1. 拖放 MP4 文件到上传区域，或点击选择文件
2. 支持多文件同时上传
3. 上传完成后视频卡片自动出现

### 注意事项

- 仅支持 **MP4** 格式
- 流水线生成的视频会自动出现（前缀 `Pipeline #N`）
- Docker 环境下视频存储在 `backend/data/uploads/`

---

## 9. 第四步：数据采集

> **侧边栏位置**：内容准备 → 数据采集

![数据采集](screenshots/05-scraper.png)

### 操作步骤

1. 在 TikTok 上找到视频 → 分享 → 复制链接
2. 粘贴到 **TikTok 视频链接** 输入框
3. 输入 **AdsPower Profile ID**
4. 点击 **「采集」**

### 如何获取 Profile ID

在 AdsPower 客户端的环境管理中，复制目标环境的 Profile ID（如 `k1ac3oq`）。

### 注意事项

- 需要 AdsPower 运行且目标环境未被打开
- TikTok 可能限制频繁采集，建议间隔操作

---

## 10. 第五步：商品管理

> **侧边栏位置**：内容准备 → 商品

![商品管理](screenshots/06-products.png)

### 添加商品

**方式一：URL 抓取（推荐）**
粘贴 TikTok Shop 链接 → 点击「抓取」

**方式二：手动添加**
点击「手动添加」→ 填写名称、分类、价格等

### AI 评分

点击「评分」→ AI 分析带货潜力（0-100 分）：
- 绿色 80+：很适合推广
- 黄色 60-79：可以推广
- 红色 <60：不太适合

### 注意事项

- AI 评分需要 `ANTHROPIC_API_KEY`
- 商品数据是「文案生成」的基础

---

## 11. 第六步：AI 文案生成

> **侧边栏位置**：内容准备 → 文案生成

![AI 文案生成](screenshots/07-content-gen.png)

### 三步流程

**步骤 1**：选择商品

**步骤 2**：配置风格与视频模型
- 内容风格：产品测评 / 开箱体验 / 生活方式 / 对比评测 / 使用教程 / 痛点解决
- 视频模型：Veo 3 Fast（快速）/ Veo 3（高质量）
- 视频时长：5 秒 / 8 秒

**步骤 3**：生成
- **一键生成（文案 + 脚本）**：推荐！同时生成文案和脚本
- 仅生成文案 / 仅生成脚本

### 生成结果

- 标题文案（可复制）
- 标签列表
- 详细描述
- 视频脚本（Hook → Body → CTA）
- 可选翻译（中/英/西/日/韩/法）

### 注意事项

- **必须配置 `ANTHROPIC_API_KEY`**
- 「一键生成」耗时约为单次的 2 倍
- 视频时长根据模型自动调整（Veo 3 最长 8 秒）

---

## 12. 第七步：批量发布

> **侧边栏位置**：发布管理 → 发布

![批量发布](screenshots/08-publish.png)

### 四步向导

1. **选择设备**：勾选要发布的设备
2. **分配视频**：为每个设备选择视频
3. **编辑内容**：编辑文案和标签
4. **确认发布**：检查并点击「发布」

### 注意事项

- 发布通过 AdsPower 打开真实浏览器，AdsPower 必须运行
- 每个设备约 1-3 分钟
- 发布中不要手动操作 AdsPower 浏览器
- 草稿功能可保存/恢复配置

---

## 13. 第八步：智能排期

> **侧边栏位置**：发布管理 → 智能排期

![智能排期](screenshots/09-schedule.png)

### 推荐发布时段（TikTok）

- 早间 7:00-9:00 | 午间 12:00-14:00 | 晚间 18:00-21:00

### 功能

- 日历视图查看排期
- 创建定时发布任务
- 按状态筛选（排队中/已发布/失败）

### 注意事项

- 后端和 AdsPower 必须在排期时间保持运行
- Docker 用户：容器需要保持运行（使用 `docker compose up -d` 后台运行）

---

## 14. 第九步：自动流水线

> **侧边栏位置**：发布管理 → 自动流水线

![自动流水线](screenshots/10-pipeline.png)

### 最强功能：一键全自动

1. 点击「新建流水线」
2. 选择商品 → 视频来源 → 目标设备
3. 确认启动

### 流水线阶段

```
文案生成 → 脚本生成 → AI 视频生成 → 字幕生成 → 视频处理 → 发布
```

### 注意事项

- AI 视频生成需要 `KIE_API_KEY`
- 视频生成约 2-5 分钟
- 失败可从失败阶段恢复（点击 ▶）
- 后台运行，可浏览其他页面

---

## 15. 第十步：模板库

> **侧边栏位置**：发布管理 → 模板库

![模板库](screenshots/11-templates.png)

保存常用发布配置为模板，下次可快速加载。适合重复性发布任务。

---

## 16. 第十一步：数据分析

> **侧边栏位置**：数据监控 → 数据分析

![数据分析](screenshots/12-analytics.png)

### 主要内容

- 日期范围选择（最近7天/30天）
- 发布趋势折线图
- 成功/失败占比饼图
- 统计卡片：发布成功 / 发布失败 / 成功率

### 注意事项

- 只统计已完成任务
- 空数据时会显示上下文提示和快捷操作按钮

---

## 17. 第十二步：账号健康

> **侧边栏位置**：数据监控 → 账号健康

![账号健康](screenshots/13-account-health.png)

### 主要内容

- 设备总数 / 平均健康分数 / 有警告设备
- 每个设备的发布总数、成功率、健康分数、警告状态
- 支持导出 CSV

### 健康分数

- 70-100：健康（绿色）
- 40-69：一般（蓝色）
- 0-39：异常（红色）

---

## 18. 完整操作演示（从零开始 — 已实测验证）

> 以下流程已在 Docker 环境中完整测试通过，使用真实 AdsPower 环境和 TikTok Shop 商品。

### 演示场景

**抓取 TikTok 商品 → AI 评分 → 生成文案 → 自动流水线生成视频 → 发布到多个账号 → 查看数据**

### 前置条件检查

在开始之前，确认以下服务都已准备好：

| 检查项 | 状态 | 如何验证 |
|--------|------|----------|
| Docker Desktop | 运行中 | 状态栏鲸鱼图标稳定 |
| AdsPower | 已登录运行 | 界面显示你的浏览器环境 |
| `backend/.env` 已配置 | 有 API 密钥 | `ANTHROPIC_API_KEY` 和 `KIE_API_KEY` 已填写 |
| 平台已启动 | 可访问 | 浏览器打开 http://localhost:5173 看到控制台 |

### 第 1 步：添加 AdsPower 服务器

1. 打开 AdsPower 并**登录**（未登录无法使用 API）
2. 点击顶部 **API & MCP** 菜单，复制 API 地址（如 `http://127.0.0.1:50325`）
3. 在平台侧边栏点击「**基础设置 → 服务器**」
4. 点击「**添加服务器**」
5. 填写：
   - 名称：`我的AdsPower`
   - 地址：`http://host.docker.internal:50325`（Docker 用户必须用此地址）
6. 点击确定 → 服务器卡片出现，显示「已连接」

> **实测结果**：服务器 "test1" 添加成功，自动设为默认，最后连接时间自动更新。

### 第 2 步：同步设备

1. 点击「**下一步：同步设备**」（或侧边栏「基础设置 → 设备」）
2. 点击「**同步设备**」按钮
3. 等待 5-20 秒（有速率限制延迟，每批间隔 1.5 秒）
4. 设备表格出现你的浏览器环境

> **实测结果**：同步到 2 个设备（test1 在 "test" 分组，test2 未分组）。未分组环境也能正确同步。

### 第 3 步：抓取商品

1. 侧边栏点击「**内容准备 → 商品**」
2. 输入 TikTok Shop 商品链接，例如：
   ```
   https://shop.tiktok.com/us/pdp/neuro-gum-caffeine-nootropics-sugar-free-energy-focus-blend/1729413266549936259
   ```
3. 点击「**抓取**」
4. 等待 3-10 秒，商品卡片自动出现

> **实测结果**：成功抓取 "Neuro Energy Caffeine Gum/Mints" 商品，自动提取名称和 TikTok Shop 链接。

### 第 4 步：AI 商品评分

1. 找到刚抓取的商品卡片
2. 点击「**评分**」
3. 等待 5-15 秒（Claude AI 分析中）
4. 查看：分数（0-100）、评分理由、推荐营销角度

> **实测结果**：Neuro Energy Gum 获得 **62 分**（黄色 — 可以推广），AI 建议三个营销角度：
> - "POV: 你需要能量但讨厌咖啡"反应视频
> - 健身前的习惯展示
> - 学习/工作期间的专注力测试挑战

### 第 5 步：AI 文案生成

1. 侧边栏点击「**内容准备 → 文案生成**」
2. **选择商品**：下拉选择刚抓取的商品
3. **配置**：
   - 风格：「产品测评」
   - 视频模型：「Veo 3 Fast」（快速生成）
   - 时长：「8 秒」（Veo 3 最长支持 8 秒）
4. 点击 **「一键生成（文案 + 脚本）」**
5. 等待 15-30 秒，查看生成结果

> **实测结果**：生成完整文案包含：
> - **标题**："I tried caffeine GUM so you don't have to… and honestly? I'm shook"
> - **标签**：#neurogum #caffeinegum #energyhack #tiktokmademebuyit 等
> - **视频脚本**：Hook (3秒) → Body (24秒) → CTA (3秒) 完整结构

### 第 6 步：上传视频（手动发布路径）

1. 侧边栏点击「**内容准备 → 视频**」
2. 拖放 MP4 文件到上传区域，或点击选择
3. 上传完成后视频卡片出现，显示缩略图和时长

> **实测结果**：视频库中有 2 个视频，包含流水线自动生成的视频（标记 "Pipeline #5"）。

### 第 7 步：手动发布

1. 侧边栏点击「**发布管理 → 发布**」
2. **步骤 1**：勾选要发布的设备（如 test1, test2）→ 下一步
3. **步骤 2**：为每个设备分配视频 → 下一步
4. **步骤 3**：编辑文案和标签（可粘贴文案生成的内容）→ 下一步
5. **步骤 4**：检查所有配置 → 点击「**发布**」

> **实测结果**：5 个发布任务中 3 个成功（published），2 个失败（failed），整体成功率 60%。发布通过 AdsPower 打开真实浏览器操作，每个设备约 1-3 分钟。

### 第 8 步：全自动流水线（推荐！）

> 流水线将以上步骤全自动完成：**文案 → 脚本 → AI 视频 → 字幕 → 处理 → 发布**

1. 侧边栏点击「**发布管理 → 自动流水线**」
2. 点击「**新建流水线**」
3. 配置：
   - 商品：选择已有商品
   - 视频来源：选「Kie.ai」（AI 生成）或「上传视频」
   - 风格：选「产品测评」
   - 勾选目标设备
4. 点击确认启动
5. 观察 6 个阶段依次自动完成

> **实测结果**：Pipeline #5 全部 6 阶段成功完成：
> | 阶段 | 耗时 | 输出 |
> |------|------|------|
> | 文案生成 | ~9 秒 | 标题 + 标签 + 描述 |
> | 脚本生成 | ~10 秒 | Hook/Body/CTA 结构 |
> | AI 视频生成 | ~84 秒 | 8 秒短视频（Veo 3） |
> | 字幕生成 | ~17 秒 | 2 段字幕 |
> | 视频处理 | ~10 秒 | 最终视频（自动入库） |
> | 发布 | <1 秒 | 创建发布任务 |
> | **总计** | **约 2 分 10 秒** | 全自动完成 |

### 第 9 步：查看结果

完成发布后，可在以下页面查看效果：

- **控制台**（首页）：查看「最近任务」列表，显示每个任务的状态
- **数据分析**：查看发布趋势图和成功/失败占比
- **账号健康**：查看每个设备的健康分数和发布成功率

> **实测结果**：
> - 数据分析显示成功率 60%，2 个设备的详细发布统计
> - 账号健康页面显示 2 个设备的健康分数和警告状态
> - 所有图表和统计卡片正确渲染

### 端到端测试验证总结

以下是在 Docker 环境中实际验证的完整清单：

| 功能 | API 端点 | 状态 | 数据 |
|------|----------|------|------|
| 服务器管理 | `/api/servers/` | ✅ 通过 | 1 个服务器 |
| 设备同步 | `/api/profiles/` | ✅ 通过 | 2 个设备（含未分组） |
| 视频库 | `/api/videos/` | ✅ 通过 | 2 个视频 |
| 数据采集 | `/api/scraper/history` | ✅ 通过 | 5 条采集记录 |
| 商品管理 | `/api/products/` | ✅ 通过 | 2 个商品（1 个已评分） |
| AI 文案生成 | `/api/content/` | ✅ 通过 | 7 条生成记录 |
| 发布任务 | `/api/tasks/` | ✅ 通过 | 5 个任务（3 成功 / 2 失败） |
| 自动流水线 | `/api/pipeline/runs` | ✅ 通过 | 2 条运行记录（1 完成） |
| 数据分析 | `/api/analytics/` | ✅ 通过 | 成功率 60% |
| 账号健康 | `/api/health-dashboard/` | ✅ 通过 | 2 个设备 |
| 智能排期 | `/api/schedule/queue` | ✅ 通过 | 队列功能正常 |
| 模板库 | `/api/templates/` | ✅ 通过 | 模板增删改查正常 |
| 标签系统 | `/api/tags/recent` | ✅ 通过 | 4 个常用标签 |
| 草稿功能 | `/api/drafts/` | ✅ 通过 | 草稿保存/恢复正常 |
| Nginx 代理 | 所有 `/api/*` 路由 | ✅ 通过 | API + WebSocket 代理正常 |
| SPA 路由 | 全部 13 个页面路由 | ✅ 通过 | 均返回 200 |
| 数据持久化 | SQLite + 文件存储 | ✅ 通过 | 容器重启后数据保留 |

---

## 19. 常见问题与解决方案

### Docker 相关

| 问题 | 解决方案 |
|------|----------|
| `Cannot connect to the Docker daemon` | 打开 Docker Desktop 并等待引擎启动（鲸鱼图标停止动画） |
| 首次构建很慢 | 正常，需下载依赖（3-5 分钟），后续启动几秒 |
| 容器启动后前端显示「未连接」 | 运行 `docker compose logs backend` 查看后端报错 |
| 无法连接 AdsPower | 服务器页面中的地址必须是 `http://host.docker.internal:50325`（不是 127.0.0.1） |
| 需要重置所有数据 | `docker compose down && rm -rf backend/data/* && docker compose up --build` |
| 更新代码后不生效 | `git pull && docker compose up --build -d` |
| 构建失败 `input/output error` | Docker 存储损坏。Mac: 退出 Docker → 删除 `~/Library/Containers/com.docker.docker/Data/vms` → 重开。Windows: Docker Desktop → Settings → Troubleshoot → Clean/Purge data |
| Builders 页面显示 Error | 同上，属于 Docker 存储损坏 |
| Windows: `docker compose` 无响应 | 以管理员身份运行 PowerShell |
| Windows: WSL 2 相关错误 | 运行 `wsl --update` 更新 WSL 内核 |
| Mac: 端口 5173 被占用 | `lsof -i :5173` 查看占用进程，`kill <PID>` 结束 |
| Windows: 端口 5173 被占用 | `netstat -ano \| findstr :5173` 查看 PID，`taskkill /PID <PID> /F` 结束 |
| Linux: permission denied | 确认用户在 docker 组：`sudo usermod -aG docker $USER`，然后注销重登 |

### 手动安装相关

| 问题 | 解决方案 |
|------|----------|
| `command not found: python3` | 重新安装 Python，**勾选 Add to PATH** |
| `command not found: npm` | 重新安装 Node.js |
| `pip install` 失败 | 先激活虚拟环境：Mac `source venv/bin/activate` / Windows `venv\Scripts\activate` |
| `No module named 'app'` | 确保在 `backend` 目录下运行 |
| 数据库报错 | 运行 `alembic upgrade head` |
| Windows: `playwright install` 失败 | 以管理员身份运行 PowerShell |

### 连接相关

| 问题 | 解决方案 |
|------|----------|
| 同步设备返回空 | AdsPower 未运行或未登录 |
| Too many requests | 等待 5 秒后重试 |
| 测试连接失败 | 检查 AdsPower 是否运行，地址是否正确 |

### AI 功能相关

| 问题 | 解决方案 |
|------|----------|
| 文案/评分生成失败 | 在 `.env` 中配置 `ANTHROPIC_API_KEY` |
| 流水线视频生成失败 | 在 `.env` 中配置 `KIE_API_KEY` |
| 视频生成超时 | kie.ai 繁忙，点击 ▶ 重试 |

### 发布相关

| 问题 | 解决方案 |
|------|----------|
| 发布任务卡住 | 检查 AdsPower 环境是否可以打开 |
| 发布失败 | 查看错误信息，检查账号状态 |
| 分析页面空白 | 扩大日期范围，用「最近30天」 |

### 完整环境变量参考

```env
# ===== 必填 =====
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx        # AI 文案生成

# ===== 按需 =====
KIE_API_KEY=kie_xxxxxxxx                        # AI 视频生成
OPENAI_API_KEY=sk-xxxxxxxx                      # 图片生成（可选）

# ===== 地址配置 =====
# Docker:   http://host.docker.internal:50325
# 手动安装: http://127.0.0.1:50325
ADSPOWER_BASE_URL=http://host.docker.internal:50325

DATABASE_URL=sqlite+aiosqlite:///./data/app.db
SCRAPER_PROFILE_ID=你的ProfileID
DEFAULT_TIMEZONE=America/Mexico_City
ANTHROPIC_MODEL=claude-sonnet-4-6
CONTENT_PRIMARY_LANGUAGE=en
```

---

> **需要帮助？** 请在 [GitHub Issues](https://github.com/xiangyuzeng/aigc-video-platform-v2/issues) 中提交问题。
