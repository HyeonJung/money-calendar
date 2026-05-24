create extension if not exists "pgcrypto";

create table app_users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  display_name varchar(100),
  timezone varchar(64) not null default 'Asia/Seoul',
  role varchar(30) not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table calendars (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid null references app_users(id),
  type varchar(30) not null,
  name varchar(80) not null,
  color varchar(7) not null,
  description varchar(500),
  visibility varchar(30) not null default 'PRIVATE',
  is_readonly boolean not null default false,
  is_default boolean not null default false,
  system_key varchar(80) null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint calendars_type_check check (type in ('USER', 'SYSTEM_HOLIDAY')),
  constraint calendars_visibility_check check (visibility in ('PRIVATE', 'LINK', 'PUBLIC')),
  constraint calendars_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint calendars_user_owner_check check ((type = 'USER' and owner_user_id is not null) or type = 'SYSTEM_HOLIDAY'),
  constraint calendars_holiday_readonly_check check (type <> 'SYSTEM_HOLIDAY' or is_readonly = true)
);

create table calendar_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id),
  user_id uuid not null references app_users(id),
  role varchar(30) not null,
  subscription_status varchar(30) not null default 'SUBSCRIBED',
  display_order integer,
  created_by uuid null references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_members_unique unique (calendar_id, user_id),
  constraint calendar_members_role_check check (role in ('OWNER', 'VIEWER', 'EDITOR', 'ADMIN')),
  constraint calendar_members_subscription_check check (subscription_status in ('SUBSCRIBED', 'HIDDEN', 'UNSUBSCRIBED'))
);

create table events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references calendars(id),
  created_by uuid null references app_users(id),
  updated_by uuid null references app_users(id),
  source varchar(30) not null default 'USER',
  source_key varchar(120) null,
  title varchar(120) not null,
  description text null,
  location varchar(255) null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone varchar(64) not null default 'Asia/Seoul',
  is_all_day boolean not null default false,
  status varchar(30) not null default 'CONFIRMED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint events_source_check check (source in ('USER', 'SYSTEM_HOLIDAY')),
  constraint events_status_check check (status in ('CONFIRMED', 'CANCELED')),
  constraint events_range_check check (ends_at > starts_at),
  constraint events_user_created_by_check check (source <> 'USER' or created_by is not null)
);

create table holiday_sources (
  id uuid primary key default gen_random_uuid(),
  country_code varchar(2) not null,
  holiday_date date not null,
  name varchar(120) not null,
  local_name varchar(120) not null,
  is_public_holiday boolean not null default true,
  source_provider varchar(80) not null,
  source_key varchar(120) not null,
  raw_payload jsonb null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holiday_sources_country_check check (country_code = 'KR'),
  constraint holiday_sources_unique unique (country_code, holiday_date, source_key)
);

create table holiday_sync_runs (
  id uuid primary key default gen_random_uuid(),
  target_country_code varchar(2) not null,
  target_year integer not null,
  status varchar(30) not null,
  trigger_type varchar(30) not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  requested_count integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary varchar(500),
  created_at timestamptz not null default now(),
  constraint holiday_sync_runs_country_check check (target_country_code = 'KR'),
  constraint holiday_sync_runs_status_check check (status in ('RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED')),
  constraint holiday_sync_runs_trigger_check check (trigger_type in ('SCHEDULED', 'MANUAL', 'RETRY'))
);

create table holiday_sync_failures (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references holiday_sync_runs(id),
  stage varchar(50) not null,
  error_code varchar(80),
  error_message text not null,
  external_status integer null,
  external_response_summary text null,
  raw_payload jsonb null,
  is_retryable boolean not null default false,
  created_at timestamptz not null default now(),
  constraint holiday_sync_failures_stage_check check (stage in ('FETCH', 'PARSE', 'VALIDATE', 'UPSERT_HOLIDAY_SOURCE', 'UPSERT_EVENT', 'UNKNOWN'))
);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id),
  token_hash varchar(255) not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index idx_calendars_owner on calendars(owner_user_id) where deleted_at is null;
create index idx_calendar_members_user on calendar_members(user_id);
create index idx_calendar_members_calendar on calendar_members(calendar_id);
create index idx_events_calendar_range on events(calendar_id, starts_at, ends_at) where deleted_at is null;
create index idx_events_range on events(starts_at, ends_at) where deleted_at is null;
create unique index idx_events_holiday_source on events(calendar_id, source, source_key) where source_key is not null and deleted_at is null;
create index idx_holiday_sync_runs_year on holiday_sync_runs(target_country_code, target_year, started_at desc);
