create table if not exists users (
  id uuid primary key,
  email text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key,
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists projects (
  id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  brief text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  readiness integer not null,
  summary text not null,
  disciplines jsonb not null,
  controls jsonb not null,
  blockers jsonb not null,
  tier text not null default 'free',
  code_scan jsonb,
  paid_fixes jsonb not null default '[]'::jsonb,
  implementation_prompt text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key,
  workspace_id uuid references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists projects_workspace_updated_idx on projects (workspace_id, updated_at desc);
create index if not exists reviews_project_created_idx on reviews (project_id, created_at desc);
create index if not exists audit_logs_workspace_created_idx on audit_logs (workspace_id, created_at desc);
