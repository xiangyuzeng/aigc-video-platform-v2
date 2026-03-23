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
2. 根据你的芯片选择下载（Apple 芯片 / Intel 芯片）
3. 打开下载的 `.dmg` 文件，将 Docker 拖入 Applications 文件夹
4. 从 Applications 中打开 Docker
5. 首次启动需要等待 Docker 引擎初始化（状态栏鲸鱼图标变为稳定状态）

**Windows：**
1. 访问 https://docs.docker.com/desktop/install/windows-install/
2. 下载并运行安装程序
3. 安装过程中会提示启用 WSL 2（按提示操作即可）
4. 安装完成后重启电脑
5. 打开 Docker Desktop，等待引擎启动

**验证安装**（打开终端/命令提示符）：
```bash
docker --version
docker compose version
```
都有输出即表示安装成功。

### 2.2 安装 AdsPower

1. 访问 [AdsPower 官网](https://www.adspower.com/) 下载对应系统版本
2. 安装并打开 AdsPower
3. **注册或登录** AdsPower 账号（必须登录才能使用 API）
4. 在 AdsPower 中创建至少一个浏览器环境（Profile）

### 2.3 安装 Git 并下载代码

**Mac（如果没有 Git）：**
```bash
xcode-select --install
```

**Windows（如果没有 Git）：**
访问 https://git-scm.com/download/win 下载安装。

**下载项目代码：**
```bash
cd ~/Desktop
git clone https://github.com/xiangyuzeng/aigc-video-platform-v2.git
cd aigc-video-platform-v2
```

### 2.4 配置环境变量

```bash
cp backend/.env.example backend/.env
```

然后编辑 `backend/.env` 文件，填入你的 API 密钥（详见[第 4 节](#4-api-密钥配置)）：

```env
# 必填：AI 文案生成
ANTHROPIC_API_KEY=sk-ant-api03-你的密钥

# 流水线视频生成时需要
KIE_API_KEY=你的kie密钥

# ⚠️ Docker 环境必须使用 host.docker.internal（不是 127.0.0.1）
ADSPOWER_BASE_URL=http://host.docker.internal:50325
```

> **关键区别**：Docker 容器无法通过 `127.0.0.1` 访问你电脑上运行的 AdsPower。必须将 `.env` 中的 `ADSPOWER_BASE_URL` 改为 `http://host.docker.internal:50325`。

### 2.5 一键启动

确保 **Docker Desktop** 和 **AdsPower** 都已经打开，然后运行：

```bash
docker compose up --build
```

首次启动会：
1. 自动下载 Python 和 Node.js 运行环境（约 2-5 分钟）
2. 自动安装所有依赖库
3. 自动安装 Playwright 浏览器驱动
4. 自动构建前端生产版本
5. 自动运行数据库迁移
6. 启动后端和前端服务

看到以下输出表示启动成功：
```
aigc-backend   | INFO:     Uvicorn running on http://0.0.0.0:8000
aigc-frontend  | ... start worker processes ...
```

> **提示**：首次构建较慢（2-5 分钟），之后再次启动只需几秒钟。

### 2.6 打开平台

在浏览器中访问：**http://localhost:5173**

你应该能看到平台的控制台页面。

### 2.7 常用 Docker 命令

```bash
# 后台启动（不占用终端窗口）
docker compose up -d

# 查看运行日志
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 停止平台
docker compose down

# 代码更新后重新构建
docker compose up --build -d

# 完全重置（清除所有数据）
docker compose down
rm -rf backend/data/*
docker compose up --build
```

### 2.8 数据持久化

以下数据保存在你的电脑上，即使删除容器也不会丢失：

| 数据 | 本地路径 |
|------|----------|
| 数据库（所有配置和任务记录） | `backend/data/app.db` |
| 上传的视频文件 | `backend/data/uploads/` |
| 生成的视频文件 | `backend/output/` |

### 2.9 Docker 与 AdsPower 的网络连接

AdsPower 运行在你的电脑上（不在 Docker 中），所以需要使用特殊地址：

| 你的系统 | `.env` 中填写的 AdsPower 地址 |
|----------|---------------------------|
| Mac | `http://host.docker.internal:50325` |
| Windows | `http://host.docker.internal:50325` |
| Linux | `http://172.17.0.1:50325` |

同样，在平台的「服务器」页面添加 AdsPower 时，也要填写上述地址（而不是 `127.0.0.1`）。

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

## 18. 完整操作演示（从零开始）

> 假设你已完成 Docker 安装并启动了平台。

### 演示场景

**抓取 TikTok 商品 → AI 评分 → 生成文案 → 发布到两个账号**

### 第 1 步：添加 AdsPower 服务器

1. 打开 AdsPower 并登录
2. 进入 API & MCP 页面，复制 API 地址
3. 在平台「服务器」页面点击「添加服务器」
4. 名称填 `我的AdsPower`，地址填 `http://host.docker.internal:50325`（Docker 用户）
5. 点击确定

### 第 2 步：同步设备

1. 点击「下一步：同步设备」
2. 点击「同步设备」
3. 确认设备列表出现你的浏览器环境

### 第 3 步：抓取商品

1. 进入「商品」页面
2. 输入 TikTok Shop 商品链接：
   ```
   https://shop.tiktok.com/us/pdp/neuro-energy-caffeine-gum-nootropic-brain-supplement...
   ```
3. 点击「抓取」

### 第 4 步：AI 商品评分

1. 找到刚抓取的商品
2. 点击「评分」
3. 查看分数和推荐营销角度

### 第 5 步：AI 文案生成

1. 进入「文案生成」
2. 选择商品 → 风格选「产品测评」→ 模型选「Veo 3 Fast」→ 时长选「8 秒」
3. 点击 **「一键生成（文案 + 脚本）」**
4. 查看：标题文案、标签、视频脚本

### 第 6 步：上传视频

1. 进入「视频」页面
2. 拖放 MP4 文件到上传区域

### 第 7 步：发布

1. 进入「发布」→ 勾选 2 个设备 → 下一步
2. 分配视频 → 下一步
3. 编辑文案 → 下一步
4. 确认发布

### 第 8 步：查看结果

- 控制台：查看「最近任务」状态
- 数据分析：查看趋势图
- 账号健康：查看设备分数

### 全自动方式（自动流水线）

1. 进入「自动流水线」→ 点击「新建流水线」
2. 选择商品 → 视频来源选「Kie.ai」→ 风格选「产品测评」→ 勾选设备
3. 确认启动
4. 等待全部阶段自动完成

---

## 19. 常见问题与解决方案

### Docker 相关

| 问题 | 解决方案 |
|------|----------|
| `Cannot connect to the Docker daemon` | 打开 Docker Desktop 并等待引擎启动 |
| 首次构建很慢 | 正常，需下载依赖（2-5 分钟），后续启动几秒 |
| 容器启动后前端显示「未连接」 | 运行 `docker compose logs backend` 查看后端报错 |
| 无法连接 AdsPower | `.env` 中 `ADSPOWER_BASE_URL` 必须是 `http://host.docker.internal:50325` |
| 平台「服务器」页面连接失败 | 服务器地址也要填 `http://host.docker.internal:50325` |
| 需要重置所有数据 | `docker compose down && rm -rf backend/data/* && docker compose up --build` |
| 更新代码后不生效 | `git pull && docker compose up --build -d` |

### 手动安装相关

| 问题 | 解决方案 |
|------|----------|
| `command not found: python3` | 重新安装 Python，勾选 Add to PATH |
| `command not found: npm` | 重新安装 Node.js |
| `pip install` 失败 | 先激活虚拟环境：`source venv/bin/activate` |
| `No module named 'app'` | 确保在 `backend` 目录下运行 |
| 数据库报错 | 运行 `alembic upgrade head` |

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
