# CLAUDE.md — Project Instructions

## What This Project Is

A local-first web application for automating multi-account social media video publishing through AdsPower anti-detect browser profiles. See `PROMPT.md` for the full specification.

## Tech Stack (Locked — Do Not Change)

- **Frontend**: Vite + React 18 + TypeScript + Ant Design 5 + Zustand + TanStack Query v5 + Recharts
- **Backend**: FastAPI + Python 3.11+ + SQLAlchemy 2.0 async + aiosqlite (SQLite) + Alembic
- **Browser Automation**: Playwright (async Python) connecting to AdsPower CDP
- **Task Scheduling**: APScheduler 4.x (in-process, no Redis)
- **Transcription**: faster-whisper
- **Real-time**: FastAPI WebSockets

## Project Structure

```
aigc-video-platform/
├── CLAUDE.md          ← you are here
├── PROMPT.md          ← full specification
├── backend/           ← FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── routers/
│   │   ├── services/
│   │   └── ws/
│   ├── alembic/
│   ├── data/          ← runtime (SQLite DB + uploads)
│   └── requirements.txt
└── frontend/          ← Vite + React app
    ├── src/
    │   ├── api/
    │   ├── stores/
    │   ├── hooks/
    │   ├── pages/
    │   ├── components/
    │   └── utils/
    ├── package.json
    └── vite.config.ts
```

## Commands

```bash
# Backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000    # dev server
alembic upgrade head                          # run migrations
alembic revision --autogenerate -m "desc"     # create migration

# Frontend
cd frontend
npm run dev                                   # dev server on :5173
npm run build                                 # production build
npm run lint                                  # type check + lint
```

## Rules

1. **Read PROMPT.md first** for the full specification before implementing any feature.
2. **Follow the phase order** in PROMPT.md. Each phase should produce a working increment.
3. **SQLite only** — no PostgreSQL. Use WAL mode. No Docker.
4. **No SSR** — this is a Vite SPA, not Next.js.
5. **Ant Design 5** for all UI components. Don't install other UI libraries.
6. **Chinese labels** for domain terms in UI (分组, 设备, 文案, 标签, 发布). English for system/technical terms.
7. **All backend async** — use `async def` for all route handlers and service methods.
8. **Tag formatting** is critical business logic — see `formatTags()` in PROMPT.md. Port it exactly.
9. When creating API endpoints, always add them to the FastAPI app with a router prefix (`/api/servers`, `/api/profiles`, etc.)
10. Frontend API calls go through the Axios client in `src/api/client.ts` with baseURL from env.
