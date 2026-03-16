-- AI Personal Student Assistant - Discord-only MVP Schema
-- Target: Supabase Postgres

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('pending', 'completed', 'cancelled', 'overdue');
  end if;

  if not exists (select 1 from pg_type where typname = 'item_source') then
    create type item_source as enum ('discord', 'dashboard');
  end if;

  if not exists (select 1 from pg_type where typname = 'entity_type') then
    create type entity_type as enum ('task', 'event', 'reminder', 'custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'recurrence_frequency') then
    create type recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'custom');
  end if;

  if not exists (select 1 from pg_type where typname = 'reminder_type') then
    create type reminder_type as enum ('one_time', 'recurring');
  end if;

  if not exists (select 1 from pg_type where typname = 'reminder_status') then
    create type reminder_status as enum ('pending', 'sent', 'failed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_direction') then
    create type message_direction as enum ('inbound', 'outbound');
  end if;

  if not exists (select 1 from pg_type where typname = 'message_channel') then
    create type message_channel as enum ('discord');
  end if;

  

  if not exists (select 1 from pg_type where typname = 'processing_status') then
    create type processing_status as enum ('received', 'parsed', 'needs_clarification', 'processed', 'failed');
  end if;

  

  if not exists (select 1 from pg_type where typname = 'holiday_type') then
    create type holiday_type as enum ('national', 'joint_leave', 'observance');
  end if;
end $$;

-- Backward compatibility for old enum variants.
do $$
begin
  if exists (select 1 from pg_type where typname = 'item_source')
    and not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'item_source' and e.enumlabel = 'discord'
    ) then
    alter type item_source add value 'discord';
  end if;

  if exists (select 1 from pg_type where typname = 'item_source')
    and not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'item_source' and e.enumlabel = 'dashboard'
    ) then
    alter type item_source add value 'dashboard';
  end if;

  if exists (select 1 from pg_type where typname = 'message_channel')
    and not exists (
      select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'message_channel' and e.enumlabel = 'discord'
    ) then
    alter type message_channel add value 'discord';
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  discord_user_id text,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz not null,
  status task_status not null default 'pending',
  source item_source not null default 'dashboard',
  raw_input text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  location text,
  source item_source not null default 'dashboard',
  raw_input text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_at is null or end_at >= start_at)
);

create table if not exists public.recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type entity_type not null,
  entity_id uuid,
  frequency recurrence_frequency not null,
  interval_value integer not null default 1 check (interval_value > 0),
  by_day text[] not null default '{}',
  by_month_day integer[] not null default '{}',
  start_date date not null,
  end_date date,
  raw_rule_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurrence_end_after_start check (end_date is null or end_date >= start_date)
);


create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  entity_type entity_type not null,
  entity_id uuid,
  reminder_type reminder_type not null default 'one_time',
  remind_at timestamptz not null,
  status reminder_status not null default 'pending',
  channel message_channel not null default 'discord',
  message_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.raw_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  direction message_direction not null,
  channel message_channel not null default 'discord',
  message_text text,
  payload_json jsonb not null default '{}'::jsonb,
  parsed_json jsonb,
  processing_status processing_status not null default 'received',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  provider text not null,
  model text not null,
  request_type text not null default 'parser',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  local_name text,
  type holiday_type not null default 'national',
  source text not null default 'nager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idx_holidays_date_name_unique unique (date, name)
);

-- Backward-compatible column migration.
alter table public.users drop column if exists phone_number;
alter table public.users add column if not exists discord_user_id text;
create unique index if not exists idx_users_discord_user_id_unique on public.users(discord_user_id);

-- Normalize legacy WA values if present.
do $$
begin
  if to_regclass('public.tasks') is not null then
    update public.tasks set source = 'discord'::item_source where source::text = 'whatsapp';
  end if;

  if to_regclass('public.events') is not null then
    update public.events set source = 'discord'::item_source where source::text = 'whatsapp';
  end if;

  if to_regclass('public.reminders') is not null then
    update public.reminders set channel = 'discord'::message_channel where channel::text = 'whatsapp';
  end if;

  if to_regclass('public.raw_messages') is not null then
    update public.raw_messages set channel = 'discord'::message_channel where channel::text = 'whatsapp';
  end if;
end $$;

-- Keep runtime values Discord-only even if legacy enum still has 'whatsapp'.
alter table public.tasks drop constraint if exists tasks_source_supported;
alter table public.tasks add constraint tasks_source_supported check (source::text in ('discord', 'dashboard'));

alter table public.events drop constraint if exists events_source_supported;
alter table public.events add constraint events_source_supported check (source::text in ('discord', 'dashboard'));

alter table public.reminders drop constraint if exists reminders_channel_discord_only;
alter table public.reminders add constraint reminders_channel_discord_only check (channel::text = 'discord');

alter table public.raw_messages drop constraint if exists raw_messages_channel_discord_only;
alter table public.raw_messages add constraint raw_messages_channel_discord_only check (channel::text = 'discord');

-- Defaults for legacy tables.
alter table public.reminders alter column channel set default 'discord';
alter table public.raw_messages alter column channel set default 'discord';

create index if not exists idx_tasks_user_due_at on public.tasks(user_id, due_at);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_events_user_start_at on public.events(user_id, start_at);
create index if not exists idx_recurrence_rules_user on public.recurrence_rules(user_id);
create index if not exists idx_reminders_user_status_remind_at on public.reminders(user_id, status, remind_at);
create index if not exists idx_raw_messages_created_at on public.raw_messages(created_at desc);
create index if not exists idx_ai_usage_events_created_at on public.ai_usage_events(created_at desc);
create index if not exists idx_ai_usage_events_provider_model_created_at on public.ai_usage_events(provider, model, created_at desc);
create index if not exists idx_holidays_date on public.holidays(date);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists set_recurrence_rules_updated_at on public.recurrence_rules;
create trigger set_recurrence_rules_updated_at
before update on public.recurrence_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();


drop trigger if exists set_holidays_updated_at on public.holidays;
create trigger set_holidays_updated_at
before update on public.holidays
for each row execute function public.set_updated_at();










