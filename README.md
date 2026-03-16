# AI Personal Student Assistant (Discord + Dashboard)

Production-minded MVP for a **multi-user ready** student assistant:
- Parse natural language chat into structured schedule/task actions
- Persist data in Supabase Postgres via **Prisma ORM**
- Send confirmations + reminders through Discord
- Monitor/manage all data from a Next.js dashboard

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn-style component primitives
- Prisma ORM + PostgreSQL (Supabase Postgres)
- OpenAI-compatible API for structured parser (OpenAI or OpenRouter)
- Messaging channel: Discord (gateway DM bot + optional interaction webhook)

## Recommended Deployment (Hybrid)
- **Web/API**: Vercel
- **Database**: Supabase
- **Discord gateway worker**: laptop/VPS 24/7 via PM2

Why this setup:
- Dashboard always accessible from anywhere
- Worker keeps DM bot online continuously
- Reminder runner executed by worker polling `/api/reminders/run-due`

## Folder Structure

```txt
app/
  api/
    chat/process/route.ts
    internal/health/route.ts
    webhooks/discord/route.ts
    parse-message/route.ts
    tasks/route.ts
    tasks/[id]/route.ts
    events/route.ts
    events/[id]/route.ts
    agenda/today/route.ts
    agenda/week/route.ts
    reminders/run-due/route.ts
    routines/route.ts
    settings/route.ts
  dashboard/
    page.tsx
    calendar/page.tsx
    tasks/page.tsx
    events/page.tsx
    routines/page.tsx
    messages/page.tsx
    settings/page.tsx
scripts/
  discord-gateway-bot.ts
lib/
  agenda/
  discord/
  openai/
  parser/
  reminders/
  services/
prisma/
  schema.prisma
sql/
  schema.sql
```

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Copy env:
```bash
cp .env.example .env
```

3. Fill `.env` values.

4. Generate Prisma client:
```bash
pnpm prisma:generate
```

5. Apply SQL schema in Supabase SQL editor:
- Run `sql/schema.sql`

6. Start web app:
```bash
pnpm dev
```

7. Start Discord worker (separate terminal):
```bash
pnpm discord:bot
```

## Env Split (Vercel vs Worker)

### Required in Vercel (Web/API)
- `DATABASE_URL`
- `DIRECT_URL` (for Prisma operations)
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` (opsional: `OPENAI_PARSER_MODEL` untuk parser-only override)
- `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`
- `DISCORD_BOT_TOKEN`
- `API_INTERNAL_AUTH_TOKEN`
- `REMINDER_RUN_AUTH_TOKEN`

### Required in Worker (laptop/VPS)
- `DISCORD_BOT_TOKEN`
- `INTERNAL_API_BASE_URL` (set to Vercel domain)
- `API_INTERNAL_AUTH_TOKEN`
- `REMINDER_RUN_AUTH_TOKEN`
- `REMINDER_POLL_INTERVAL_MS` (optional, default 15000)

## Core Endpoints

- `GET /api/internal/health` (internal token protected)
- `POST /api/chat/process` (internal token protected)
- `POST /api/reminders/run-due` (reminder token protected)
- `GET/POST /api/webhooks/discord`
- `POST /api/parse-message`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/events`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `GET /api/agenda/today`
- `GET /api/agenda/week`
- `POST /api/routines`
- `GET/PATCH /api/settings`
- `GET/POST /api/holidays/sync`

## Notes

- Parser asks clarification for ambiguous time expressions and applies temporal guard for explicit date/time mismatch.
- Original raw message + parse result is saved for debugging/audit.
- Auto register active: first Discord login creates user row by `discord_user_id`.
- Optional Discord allowlist lock: set `DISCORD_ALLOWED_USER_ID`.


## Parser Quality Test

Run parser test cases from terminal:

```bash
pnpm parser:test
```
### Optional env for Indonesia holidays sync
- `HOLIDAY_PROVIDER_BASE_URL` (default: `https://libur.deno.dev`)
- `HOLIDAY_SYNC_YEARS_PAST` (default: `0`)
- `HOLIDAY_SYNC_YEARS_FUTURE` (default: `1`)

Use **Dashboard -> Settings -> Sync Hari Libur Indonesia** to pull/update holiday data.



## NLP Benchmark

Run benchmark mini (25 kasus Indonesia kampus) untuk cek intent, clarification, dan datetime parse.

Local mode (langsung fungsi parser):

```bash
pnpm benchmark:nlp -- --source=local
```

Local deterministic only (tanpa call model):

```bash
pnpm benchmark:nlp -- --source=local --no-ai
```

API mode (uji endpoint /api/parse-message):

```bash
pnpm benchmark:nlp -- --source=api --base-url=http://localhost:3000
```

Opsional parameter:
- `--timezone=Asia/Jakarta`
- `--now=2026-03-16T03:30:00+07:00`

Benchmark script: `scripts/benchmark-nlp.ts`.
