# Enterprise Product Evaluation — AIGC Video Publishing Platform

> An honest assessment of what needs to change to sell this as a finished enterprise product.

---

## Executive Summary

The platform has a **solid functional core** — the publishing automation, AI content pipeline, and pipeline orchestrator all work. However, it currently operates as a **single-user local development tool**. To sell as enterprise software, it needs work in 5 critical areas: **authentication & multi-tenancy, reliability & deployment, platform coverage, UX polish, and customization options**.

This document is organized by priority: **Critical (must-have before selling)**, **High (expected by paying customers)**, **Medium (competitive differentiators)**, and **Low (nice-to-have)**.

---

## CRITICAL — Must Fix Before Selling

### 1. Authentication & User Management

**Current state**: Zero authentication. Anyone with the URL has full access.

**What's needed**:
- Login/registration system (email + password, or SSO)
- Role-based access control (Admin, Manager, Operator)
  - Admin: full access, API key management, user management
  - Manager: can create/manage campaigns but not change settings
  - Operator: can only execute pre-configured tasks
- Session management with JWT tokens
- Audit logging (who did what, when)

**Implementation approach**: Add FastAPI middleware with `python-jose` for JWT. Store users in a `users` table with bcrypt-hashed passwords. Add `user_id` foreign key to Task, PipelineRun, Template tables.

### 2. Multi-Tenancy / Team Support

**Current state**: Single user, single workspace. All data is shared.

**What's needed**:
- Organization/workspace concept — each team sees only their own data
- Invite system — add team members to an organization
- Per-organization API key storage (encrypted)
- Shared vs. private templates, products, content

**Why critical**: Enterprise customers will have multiple team members. Without this, one person's mistake affects everyone.

### 3. Data Security & API Key Storage

**Current state**: API keys stored in plaintext `.env` file. No encryption.

**What's needed**:
- Encrypt API keys at rest (use `cryptography.fernet` or OS keychain)
- Never expose full API keys in frontend responses (mask with `sk-ant-***...xxx`)
- Add key rotation support
- Secure the `.env` file or move secrets to a proper secrets manager
- HTTPS enforcement (currently HTTP only)

### 4. One-Click Installation / Startup

**Current state**: Users must install Python, Node.js, Git, run multiple terminal commands, create `.env` files manually. This is a dealbreaker for non-technical users.

**Options (pick one or both)**:

#### Option A: Desktop Application (Recommended for local-first)
- Package with **Electron** or **Tauri** as a desktop app
- Bundle Python backend using **PyInstaller** or **cx_Freeze**
- Frontend served by the bundled backend (no separate Node.js needed)
- Single `.exe` (Windows) / `.dmg` (Mac) installer
- Built-in settings UI replaces `.env` file editing
- Auto-start backend on app launch

#### Option B: Docker Compose (For tech-savvy users / server deployment)
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./data:/app/data"]
  frontend:
    build: ./frontend
    ports: ["5173:80"]
```
- One command: `docker compose up`
- Works identically on Mac, Windows, Linux
- No Python/Node.js installation needed

#### Option C: Cloud-Hosted SaaS (Maximum reach)
- Deploy backend on a VPS (AWS, DigitalOcean)
- Users access via web browser — no local installation
- AdsPower still runs locally, connects via WireGuard/Tailscale tunnel
- Biggest engineering effort, but best user experience

### 5. Reliability & Error Recovery

**Current state**:
- SQLite file-based database (no replication, single writer)
- In-process APScheduler (tasks lost if process crashes)
- No automatic retries on publish failure
- No health checks or process monitoring

**What's needed**:
- **Database**: Migrate to PostgreSQL for multi-user concurrency (SQLite blocks on concurrent writes)
- **Task queue**: Replace APScheduler with Celery + Redis or Dramatiq for reliable background task execution
- **Auto-retry**: Failed publish tasks should automatically retry 2-3 times with exponential backoff
- **Process monitoring**: Add health check endpoint, integrate with systemd/PM2 for auto-restart
- **Database backups**: Automated daily backups with point-in-time recovery

---

## HIGH PRIORITY — Expected by Paying Customers

### 6. Multi-Platform Support

**Current state**: Only TikTok publishing is implemented.

**Platforms to add (by market demand)**:
| Platform | Difficulty | Market Value |
|----------|-----------|--------------|
| Instagram Reels | Medium | Very High |
| YouTube Shorts | Medium | Very High |
| Facebook Reels | Medium | High |
| Xiaohongshu (小红书) | Medium | High (Chinese market) |
| Kuaishou (快手) | Medium | High (Chinese market) |
| Pinterest Video Pins | Low | Medium |
| Twitter/X Video | Low | Medium |

**Implementation**: Each platform needs its own Playwright automation script in `publisher.py`. The upload flow differs per platform (different selectors, different content fields, different verification steps). Consider a plugin architecture where each platform is a separate module.

### 7. Proxy & IP Management

**Current state**: No proxy configuration. AdsPower handles IP isolation per profile, but there's no proxy management in the platform itself.

**What's needed**:
- Proxy pool management (residential, datacenter, mobile proxies)
- Per-profile proxy assignment
- Proxy health monitoring (speed test, IP leak check)
- Automatic proxy rotation on failure
- IP geolocation display for each profile

**Why important**: Enterprise users running 50+ accounts need reliable, diverse IPs to avoid detection.

### 8. Content Calendar & Campaign Management

**Current state**: Basic scheduling with a calendar view. No campaign concept.

**What's needed**:
- **Campaign** entity: group related tasks across multiple days/platforms
- Drag-and-drop content calendar (like Buffer/Hootsuite)
- Campaign templates (e.g., "7-day product launch sequence")
- Content approval workflow (draft → pending review → approved → scheduled)
- Campaign performance metrics (aggregate analytics per campaign)

### 9. Analytics V2 — Actionable Insights

**Current state**: Basic success/failure counts and timeline chart.

**What's needed**:
- **Per-platform analytics**: Separate metrics for TikTok, Instagram, etc.
- **Per-account analytics**: Detailed breakdown per device/account
- **Time-of-day analysis**: Which posting times perform best
- **Content performance**: Which content styles get the best results
- **Trend detection**: Alert when success rates drop significantly
- **Export options**: PDF reports, scheduled email reports
- **Dashboard customization**: Drag-and-drop widget layout

### 10. Notification System

**Current state**: WebSocket for real-time in-app updates only.

**What's needed**:
- Email notifications (task completed, task failed, daily digest)
- Webhook support (integrate with Slack, Discord, custom systems)
- In-app notification center with read/unread states
- Configurable alert thresholds (e.g., "notify me if success rate < 70%")
- Mobile push notifications (if mobile app is planned)

### 11. Comprehensive Logging & Audit Trail

**Current state**: Python logging to stdout. No persistent logs.

**What's needed**:
- Structured JSON logging with correlation IDs
- Persistent log storage (file rotation or ELK stack)
- User action audit trail (who did what, when, from where)
- Task execution logs (full timeline of each publish attempt)
- Log search and filtering UI
- Log export for debugging

---

## MEDIUM PRIORITY — Competitive Differentiators

### 12. AI Content Improvements

**Current state**: Single-shot Claude generation with 6 style presets.

**Improvements**:
- **Brand voice training**: Let users provide example captions → AI learns their tone
- **A/B content variants**: Generate 3-5 variations, let user pick or auto-test
- **Content scheduling intelligence**: AI suggests what to post based on trending topics
- **Image generation**: Auto-generate cover images using DALL-E or Midjourney
- **Multilingual first-pass**: Generate content in target language directly (not translate)
- **Content compliance check**: AI scans content for policy violations before posting
- **Hashtag research**: Suggest trending hashtags based on niche/category

### 13. Video Enhancement Features

**Current state**: Basic MoviePy slideshow + kie.ai Veo 3 (8s max).

**Improvements**:
- **Longer video support**: Support models beyond Veo 3 (Runway, Pika, etc.)
- **Video templates**: Pre-built video layouts (product showcase, before/after, testimonial)
- **Auto-captioning**: Burn subtitles into video (currently in pipeline but could be standalone)
- **Music library**: Add royalty-free background music tracks
- **Video trimming/splitting**: Edit uploaded videos in-browser
- **Watermark customization**: Custom brand watermarks on generated videos
- **Aspect ratio conversion**: Auto-convert between 9:16, 16:9, 1:1

### 14. Batch Operations & Bulk Actions

**Current state**: Publish wizard handles batch publishing. Other operations are one-at-a-time.

**Improvements**:
- Bulk product import (CSV/Excel upload)
- Bulk content generation (generate for all products at once)
- Bulk device tag/label management
- Batch video upload with progress tracking
- Bulk template application across devices

### 15. Integration Ecosystem

**Current state**: AdsPower, Anthropic Claude, kie.ai. No other integrations.

**Integrations to add**:
| Integration | Purpose | Priority |
|-------------|---------|----------|
| Google Sheets | Import/export product data | High |
| Airtable | Content calendar sync | Medium |
| Slack/Discord | Notifications | High |
| Zapier/Make | Custom workflow automation | Medium |
| Shopify | Auto-import products | High (e-commerce) |
| Amazon | Product data source | Medium |
| Canva | Template design | Low |
| Google Analytics | Track post performance | Medium |

### 16. White-Label / Branding

**Current state**: Hardcoded "肯葳科技电商视频发布平台" branding.

**What's needed for resellers**:
- Configurable logo, app name, colors
- Custom domain support (if SaaS)
- Removable/replaceable footer branding
- Custom email templates
- API for partner integration

### 17. Account Warmup Automation

**What it does**: New social media accounts need to behave like real users before posting. Automated warmup simulates human behavior.

**Features**:
- Scheduled browsing sessions (scroll feed, watch videos, like/comment)
- Gradual posting frequency increase (1/day → 2/day → 3/day)
- Random timing variation (don't post at exactly the same time every day)
- Warmup progress tracking per account
- Warmup templates (different strategies for different platforms)

**Why important**: This is a key feature competitors (like Multilogin, GoLogin) offer. Accounts that post immediately after creation get flagged.

### 18. Competitor Intelligence

**Features**:
- Monitor competitor TikTok accounts
- Track their posting frequency, content types, engagement
- Auto-scrape their top-performing content for inspiration
- Alert when competitors post in your niche
- Trend analysis: what content types are gaining traction

---

## LOW PRIORITY — Nice-to-Have

### 19. Mobile App

- React Native or Flutter companion app
- View task status, approve content on the go
- Push notifications for task completion/failure
- Basic analytics dashboard

### 20. AI Chat Assistant

- In-app AI assistant for platform guidance
- "Help me create a campaign for this product"
- Natural language task creation ("post this video to all TikTok accounts at 7pm")

### 21. Marketplace

- Community-shared templates
- Pre-built content strategies
- Proxy provider integrations

---

## Startup Efficiency Improvements

### Current Pain Points

1. **3 separate processes** needed (AdsPower + backend + frontend)
2. **Manual terminal commands** for startup
3. **Python virtual environment** must be activated each time
4. **No startup script** provided
5. **Database migration** must be run manually after updates
6. **Port conflicts** not handled gracefully

### Quick Wins (Do Now)

#### A. Create startup scripts

**Mac** — `start.sh`:
```bash
#!/bin/bash
echo "Starting AIGC Video Platform..."

# Check AdsPower
curl -s http://127.0.0.1:50325/api/v1/group/list > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  AdsPower is not running. Please start it first."
fi

# Start backend
cd backend
source venv/bin/activate
alembic upgrade head 2>/dev/null  # auto-migrate
uvicorn app.main:app --port 8000 &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Platform running at http://localhost:5173"
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
```

**Windows** — `start.bat`:
```batch
@echo off
echo Starting AIGC Video Platform...

start /B cmd /c "cd backend && venv\Scripts\activate && alembic upgrade head 2>nul && uvicorn app.main:app --port 8000"
timeout /t 3 /nobreak >nul
start /B cmd /c "cd frontend && npm run dev"

echo Platform running at http://localhost:5173
pause
```

#### B. Auto-migration on startup

Add to `backend/app/main.py` startup event:
```python
@app.on_event("startup")
async def auto_migrate():
    import subprocess
    subprocess.run(["alembic", "upgrade", "head"], cwd=Path(__file__).parent.parent)
```

#### C. Settings UI for API keys

Replace manual `.env` editing with an in-app settings page where users can paste API keys. Store encrypted in the database `app_settings` table (which already exists).

#### D. System requirements check

On first launch, verify:
- Python version ≥ 3.11
- ffmpeg/ffprobe installed
- AdsPower reachable
- Required API keys configured
- Disk space sufficient

Show clear error messages with fix instructions for any missing requirement.

---

## Use Case Variations

### Use Case 1: E-Commerce Multi-Store Operator

**Scenario**: Manages 50+ TikTok Shop accounts, needs to post product videos daily.

**Current gaps**:
- No product-to-account mapping (which products go to which accounts)
- No posting frequency rules (don't post same product twice to same account)
- No inventory-aware scheduling (stop promoting out-of-stock items)
- No product performance tracking (which products convert best on which accounts)

**Features needed**:
- Product-account assignment matrix
- Posting history deduplication
- Shopify/inventory integration
- Product-level analytics

### Use Case 2: Social Media Agency

**Scenario**: Agency manages accounts for 10+ clients, each with different brands.

**Current gaps**:
- No client/workspace separation
- No brand voice profiles
- No client approval workflow
- No client-facing dashboard (read-only view for clients)
- No billing/usage tracking per client

**Features needed**:
- Multi-workspace with client isolation
- Brand kit per client (logo, colors, tone, hashtag sets)
- Approval workflow (create → review → approve → schedule)
- Client portal with limited permissions
- Usage reports per client

### Use Case 3: Individual Creator / Influencer

**Scenario**: One person managing 3-5 accounts across platforms.

**Current gaps**:
- Setup is too complex for non-technical users
- No cross-platform posting (TikTok only)
- No engagement tracking (likes, views, comments)
- No content calendar view with drag-and-drop

**Features needed**:
- One-click desktop installer
- Multi-platform support (TikTok + Instagram + YouTube)
- Engagement metric pulling (via platform APIs or scraping)
- Simple calendar UI (drag content to dates)

### Use Case 4: Dropshipping / Affiliate Marketing

**Scenario**: Posts product review videos for affiliate commissions.

**Current gaps**:
- No affiliate link management
- No commission tracking
- No product trend discovery
- No automated product sourcing

**Features needed**:
- Affiliate link store per product
- Auto-insert links in bio/comments
- Trending product discovery (scrape TikTok trending)
- Performance tracking by product + account

---

## Customization Features for Enterprise

### 1. Custom Publishing Workflows

Let users define their own publishing flow:
```
[Select Accounts] → [AI Generate] → [Manager Review] → [Schedule] → [Publish] → [Report]
```
vs.
```
[Upload Video] → [Assign Accounts] → [Publish Now]
```

Implement as a configurable pipeline with optional stages.

### 2. Custom Fields

Let users add custom fields to:
- Products (e.g., "supplier", "profit margin", "SKU")
- Profiles (e.g., "client name", "niche", "follower count")
- Tasks (e.g., "campaign name", "priority")

Store as JSON metadata with configurable UI.

### 3. Branding / Theming

- Custom logo upload
- Color scheme selection (light/dark/custom)
- Custom sidebar labels
- Configurable dashboard widgets

### 4. API Access

Expose the platform's functionality as a documented REST API so customers can:
- Integrate with their own systems
- Build custom dashboards
- Automate workflows beyond what the UI offers

Provide: OpenAPI docs, API keys per user, rate limiting, webhook callbacks.

### 5. Plugin System

Allow third-party or custom plugins for:
- New social media platforms
- New AI content generators
- New video creation tools
- Custom analytics providers
- New product data sources

Define clear interfaces (abstract base classes) for each plugin type.

---

## Competitive Landscape

| Feature | This Platform | Publer | SocialBee | Hootsuite |
|---------|--------------|--------|-----------|-----------|
| Multi-account TikTok | ✅ | ✅ | ✅ | ✅ |
| Anti-detect browser integration | ✅ | ❌ | ❌ | ❌ |
| AI content generation | ✅ | ✅ | ✅ | Partial |
| AI video generation | ✅ | ❌ | ❌ | ❌ |
| Auto pipeline (end-to-end) | ✅ | ❌ | ❌ | ❌ |
| Product scraping + scoring | ✅ | ❌ | ❌ | ❌ |
| Account health monitoring | ✅ | ❌ | ❌ | ❌ |
| Multi-platform support | ❌ (TikTok only) | ✅ | ✅ | ✅ |
| Authentication | ❌ | ✅ | ✅ | ✅ |
| Cloud/SaaS | ❌ | ✅ | ✅ | ✅ |
| Mobile app | ❌ | ✅ | ✅ | ✅ |
| Content calendar | Partial | ✅ | ✅ | ✅ |

**Your unique advantages**: Anti-detect browser integration, AI video generation, end-to-end pipeline automation, product scraping/scoring. These are features that no mainstream social media tool offers.

**Your biggest gaps**: No auth, TikTok-only, no cloud deployment, complex setup.

---

## Recommended Roadmap

### Phase 1: Enterprise Foundation (4-6 weeks)
1. Authentication + user management
2. One-click installer (Electron/Tauri wrapper or Docker)
3. API key encryption + settings UI
4. Auto-migration + startup scripts
5. PostgreSQL migration option

### Phase 2: Platform Expansion (4-6 weeks)
6. Instagram Reels publishing
7. YouTube Shorts publishing
8. Multi-platform analytics
9. Notification system (email + webhook)

### Phase 3: Workflow & Collaboration (4-6 weeks)
10. Campaign management
11. Content approval workflow
12. Content calendar with drag-and-drop
13. Team/workspace support
14. Audit logging

### Phase 4: Intelligence & Scale (4-6 weeks)
15. AI content variants + brand voice
16. Account warmup automation
17. Advanced analytics (time-of-day, content type analysis)
18. Bulk operations (CSV import, batch generation)
19. Plugin architecture for extensibility
