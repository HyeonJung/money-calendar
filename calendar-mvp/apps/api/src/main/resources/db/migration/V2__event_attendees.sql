alter table app_users
  add column if not exists profile_image_url varchar(1000),
  add column if not exists avatar_color varchar(7);

update app_users
set avatar_color = case
  when email = 'owner@example.com' then '#2563EB'
  when email = 'viewer@example.com' then '#8B5CF6'
  when email = 'editor@example.com' then '#22C55E'
  when email = 'adminuser@example.com' then '#F59E0B'
  when email = 'admin@example.com' then '#F43F5E'
  else '#64748B'
end
where avatar_color is null;

create table if not exists event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  user_id uuid not null references app_users(id),
  email varchar(255) not null,
  display_name varchar(100),
  response_status varchar(30) not null default 'NEEDS_ACTION',
  invited_by uuid null references app_users(id),
  invited_at timestamptz not null default now(),
  responded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint event_attendees_response_check check (response_status in ('NEEDS_ACTION', 'ACCEPTED', 'DECLINED', 'TENTATIVE'))
);

create unique index if not exists idx_event_attendees_event_user_active
  on event_attendees(event_id, user_id)
  where deleted_at is null;

create unique index if not exists idx_event_attendees_event_email_active
  on event_attendees(event_id, lower(email))
  where deleted_at is null;

create index if not exists idx_event_attendees_event
  on event_attendees(event_id)
  where deleted_at is null;

create index if not exists idx_event_attendees_user
  on event_attendees(user_id)
  where deleted_at is null;
