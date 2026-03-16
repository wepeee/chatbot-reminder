# Project Prompt - AI Personal Student Assistant (Discord + Web Dashboard)

Build a production-minded MVP for a personal student assistant app focused on capturing tasks/events from chat, sending reminders via Discord, and providing a web dashboard to manage schedule, deadlines, and recurring routines.

This project is single-user-first for personal use, but architecture should stay extensible for future multi-user SaaS.

## Core Goal

User can send natural-language chat like:
- "aku ada tugas basis data tanggal 20 maret jam 23.59"
- "setiap senin jam 8 pagi kuliah AI"
- "ingetin aku tiap jumat jam 10 buat siap jumatan"
- "hari ini ada apa aja?"
- "minggu ini deadline apa?"

System should:
1. Parse message into structured data
2. Save to database
3. Create reminders automatically
4. Send confirmation/reminders via Discord DM
5. Show data in web dashboard

## Product Principles

- Single-user first
- Reliable over fancy
- No multi-agent orchestration
- AI only for parsing/intent extraction
- State in database, not in model memory
- Discord DM for daily interaction
- Web dashboard for visibility and control

## Required Stack

- Frontend: Next.js App Router + TypeScript
- UI: Tailwind + shadcn/ui + GSM token-based global style management
- Backend: Next.js route handlers/server actions
- Database: Supabase Postgres
- Auth: simple auth optimized for one user
- AI parsing: OpenAI-compatible structured JSON
- Messaging: Discord (DM gateway bot + optional interaction webhook)
- Scheduling/reminders: local worker poller and/or scheduled HTTP trigger
- Deployment target: Vercel (web) + Supabase + local laptop/VPS worker

## Messaging Runtime Choice

- Primary recommendation: `scripts/discord-gateway-bot.ts` running 24/7 on local laptop/VPS.
- This worker handles:
  - Discord DM inbound -> `/api/chat/process`
  - Reminder polling -> `/api/reminders/run-due`
- If using external scheduler (n8n/cron), disable worker reminder polling to avoid duplicate dispatch.

## MVP Intents

- `create_task`
- `create_event`
- `create_recurring_reminder`
- `get_today_agenda`
- `get_week_agenda`
- `update_item`
- `delete_item`

## Required Tables

- `users`
- `tasks`
- `events`
- `recurrence_rules`
- `reminders`
- `raw_messages`

Channel/source values must be Discord-oriented:
- source: `discord` | `dashboard`
- channel: `discord`

## Required Backend Flows

### Flow 1 - Incoming Discord DM
1. Receive DM through Discord gateway worker
2. Save raw payload to `raw_messages`
3. Normalize message text
4. Parse with AI structured output
5. Validate result
6. If ambiguous, send clarification question
7. Persist entity
8. Create reminder rows
9. Send confirmation message

### Flow 2 - Reminder Dispatch
1. Scheduled loop checks pending reminders
2. Find due reminders
3. Send reminder via Discord DM (fallback webhook if mapping unavailable)
4. Update status (`sent`/`failed`/`cancelled`)
5. Log outbound message + failures

### Flow 3 - Agenda Requests
Handle messages like:
- "hari ini ada apa?"
- "minggu ini deadline apa?"
- "besok aku ada apa?"

Return concise Discord reply from `tasks + events` query.

## Required API Routes

- `GET /api/internal/health`
- `POST /api/chat/process`
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
- `GET|PATCH /api/settings`
- `POST /api/reminders/run-due`
- `GET|POST /api/webhooks/discord`

## Dashboard Pages

- `/dashboard`
- `/dashboard/calendar`
- `/dashboard/tasks`
- `/dashboard/events`
- `/dashboard/routines`
- `/dashboard/messages`
- `/dashboard/settings`

## Parsing Rules

- Default timezone: `Asia/Jakarta`
- Never guess ambiguous time expressions
- Ask clarification for vague terms (`jumat depan`, `nanti sore`, `malam`, `abis dzuhur`)
- Support Indonesian conversational style + mixed Indonesian-English phrasing

## Non-Goals (for now)

- Billing/subscriptions
- Mobile app
- Voice assistant
- OCR/file intelligence
- Agent orchestration
- Vector DB
- Group scheduling
- Gamification
- Advanced analytics
- Google Calendar sync

## Build Order

### Phase 1
- DB schema
- Dashboard shell
- Discord inbound flow
- AI parser
- Create task/event/reminder flow

### Phase 2
- Today/week agenda
- Reminder scheduler + dispatcher
- Dashboard task/event listing

### Phase 3
- Edit/delete flows
- Recurring routines management
- Message logs
- Settings

### Phase 4
- Calendar UX polish
- Edge-case validation hardening
- Observability/logging refinements

