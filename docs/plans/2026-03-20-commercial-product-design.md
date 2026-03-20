# 肯葳科技电商视频发布平台 — Commercial Product Design

## Context

The platform is a local-first web application for automating multi-account TikTok video publishing via AdsPower browser profiles, with an AI-powered content generation pipeline. It currently works as a developer tool (terminal startup, browser-based UI). The goal is to transform it into a commercial desktop product that individual AIGC creators would pay for.

**Target customer:** Individual AIGC creators managing 5-50 TikTok accounts from their laptop.

**Monetization:** Undecided — product-first approach, pricing model added later.

---

## Phase A: Polish & Package (Make It Sellable)

### A1. Tauri Desktop Packaging

Single `.exe` (Windows) / `.dmg` (macOS) installer, ~30-50MB.

**Architecture:**
```
┌─────────────────────────────────────┐
│         Tauri Desktop Shell         │
│  (native window, system tray, menu) │
│                                     │
│  ┌───────────────────────────────┐  │
│  │   React Frontend (WebView)   │  │
│  │   Vite build → embedded      │  │
│  └──────────────┬────────────────┘  │
│                 │ HTTP/WS            │
│  ┌──────────────▼────────────────┐  │
│  │   Python Backend (sidecar)    │  │
│  │   PyInstaller → bundled .exe  │  │
│  │   FastAPI + SQLite + services │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         │
         │ CDP/HTTP
         ▼
   ┌───────────┐
   │ AdsPower  │ (user's local install)
   └───────────┘
```

**App lifecycle:**
1. User double-clicks app icon
2. Tauri window opens (splash screen with logo)
3. Sidecar starts: `backend.exe` (FastAPI on `localhost:18088`)
4. Health check loop confirms backend ready
5. WebView loads `http://localhost:18088`
6. Splash → main UI

**System tray:** Minimize to tray for background scheduled publishes. Right-click: Open / Quit.

**Port:** `18088` (avoids conflicts). Falls back to 18089, 18090 if taken.

**Build pipeline:**
```
npm run build:all
  → Step 1: cd frontend && npm run build        → frontend/dist/
  → Step 2: cp frontend/dist/ backend/static/    (embed in backend)
  → Step 3: cd backend && pyinstaller build.spec → backend.exe
  → Step 4: cp backend.exe src-tauri/sidecar/
  → Step 5: cd src-tauri && cargo tauri build    → installer
```

### A2. First-Run Setup Wizard

Modal wizard on first launch (detected by empty `servers` table). 4 steps:

1. **欢迎使用** — branding, version, "开始设置" button
2. **连接 AdsPower** — server address input, auto-detects `127.0.0.1:50325`, "测试连接" button
3. **同步设备** — calls existing sync API, shows discovered profiles with checkboxes
4. **完成** — summary of what's ready, "进入主界面" button

Key behaviors:
- Step 2 auto-detects AdsPower on default port
- Wizard state saved to `app_settings` table (`setup_completed` flag)
- Re-runnable from 服务器管理 page
- Skippable via "跳过设置" link

### A3. UI Polish

**Empty states:** Every page with tables gets an illustrated empty state with a CTA button (e.g., "还没有上传视频 → [上传视频]"). Pages: 视频, 设备, 数据采集, 发布, 数据分析, 商品.

**Chinese status labels:** Map all English statuses to Chinese:
- draft→草稿, queued→排队中, uploading→上传中, publishing→发布中
- published→已发布, failed→失败, cancelled→已取消

**Error handling:**
- React `ErrorBoundary` component — catches crashes, shows "出现错误，请重启应用"
- Backend global exception handler — returns `{"error": "...", "detail": "..."}` not stack traces
- Connection lost banner — red banner when backend sidecar disconnects: "后端服务已断开，正在重连..."

**Loading states:** Skeleton loaders (`<Skeleton>`) on Dashboard stats and all tables.

**Branding:**
- Custom app icon (肯葳科技 logo)
- Splash screen during backend startup (~2-3s)
- Sidebar footer: `v1.0.0 · 肯葳科技`

### A4. In-App Help

**Contextual help drawer:** `?` button in header opens right-side drawer with help content for the current page. Content structure per page:
- 使用指南 (step-by-step guide)
- 常见问题 (FAQ)
- 视频教程链接 (optional)

Help content stored as JSON files bundled in frontend — no server needed.

**Tooltips:** `<Tooltip>` on non-obvious UI elements (Profile ID input, sync button, etc.).

**What's New modal:** After app updates, shows changelog from bundled `CHANGELOG.md`.

---

## Phase B: Premium Features (Make Them Pay)

### B1. Template Library (模板库)

New sidebar item + page for reusable caption/tag templates.

**Features:**
- Create templates with variable placeholders: `{product_name}`, `{price}`, `{category}`
- Variables auto-filled from product data when used in publish wizard
- "为N个账号生成不同版本" — uses Claude to create unique spins (avoids TikTok duplicate detection)
- Categories for organizing templates (好物推荐, 开箱测评, etc.)

**Database:** New `templates` table: id, name, content_template, tags_template, variables_json, category, created_at

**Integration:** PublishWizard Step 2 gets "从模板选择" dropdown.

### B2. Smart Scheduling (智能排期)

**Features:**
- Best-time engine — preset optimal TikTok time slots (7-9am, 12-2pm, 6-9pm) in target timezone
- Stagger publishing — when publishing to 50 accounts, auto-space 3-10 minutes apart
- Queue dashboard — new "排期" page with calendar/timeline view of all scheduled publishes
- One-click retry for failed tasks with exponential backoff

**UI:** Calendar view showing scheduled/completed/failed publishes per time slot, color-coded.

### B3. Account Health Dashboard (账号健康)

New page tracking each profile's publishing history.

**Features:**
- Per-account stats: total posts, success rate, last publish time, average interval
- Health score algorithm: regular posting + high success rate = healthy
- Alerts: "account-5 已3天未发布", "account-8 连续失败3次"
- Exportable as CSV

**Data source:** Derived from existing `tasks` table — no new external APIs.

### B4. AI Pipeline Polish (一键生成)

Simplify the product→script→video→publish pipeline into a single wizard:
- Paste product link → select style → select accounts → "一键生成并发布"
- Visual pipeline progress with stage-by-stage status
- Save successful configs as "预设" for repeat use

---

## Phase C: Growth & Trust (Scale the Business)

- **Auto-updater** — Tauri's built-in updater checking GitHub releases
- **Analytics & reporting** — exportable reports, ROI tracking per account
- **License/activation system** — when pricing model is decided
- **Crash reporting** — Sentry integration for catching bugs from real users

---

## Project Structure

```
Combined/
├── src-tauri/                      ← Tauri shell
│   ├── tauri.conf.json
│   ├── src/main.rs
│   ├── icons/
│   └── sidecar/
├── backend/                        ← FastAPI (PyInstaller bundled)
│   ├── app/
│   │   ├── models.py               ← Add: templates, app_settings
│   │   ├── routers/
│   │   │   ├── templates.py        ← Template CRUD
│   │   │   ├── schedule.py         ← Smart scheduling + queue
│   │   │   └── health.py           ← Account health stats
│   │   └── services/
│   │       ├── template_engine.py  ← Variable substitution + AI variations
│   │       └── health_scorer.py    ← Account health calculation
│   ├── build.spec                  ← PyInstaller spec
│   └── requirements.txt
├── frontend/                       ← Vite + React
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SetupWizard.tsx
│   │   │   ├── Templates.tsx
│   │   │   ├── ScheduleQueue.tsx
│   │   │   └── AccountHealth.tsx
│   │   ├── components/
│   │   │   ├── HelpDrawer.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   └── ConnectionBanner.tsx
│   │   └── help/                   ← Help content per page
│   └── package.json
├── scripts/
│   ├── build-backend.sh
│   ├── build-frontend.sh
│   └── build-installer.sh
└── docs/plans/
```

## Tech Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Desktop shell | Tauri 2.0 | Small binary, native feel, sidecar support |
| Backend bundling | PyInstaller --onefile | Single exe, no Python install needed |
| Backend serves frontend | FastAPI StaticFiles | One port, no CORS, simpler sidecar |
| Database | SQLite (keep) | Perfect for single-user desktop, zero config |
| Auto-updater | Tauri built-in | Checks GitHub releases for new versions |
| Help content | JSON in frontend bundle | No server needed, instant load |

## Implementation Priority

1. **Phase A** first — minimum to charge money
2. **Phase B** next — features that justify the price
3. **Phase C** last — scaling when there are paying users
