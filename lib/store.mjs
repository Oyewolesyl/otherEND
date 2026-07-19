import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const DATA_DIR = process.env.VERCEL ? resolve("/tmp/otherend-data") : resolve(".data");
const DB_PATH = join(DATA_DIR, "db.json");
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;

let schemaReady = false;

function ensureFileDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    writeFileSync(
      DB_PATH,
      JSON.stringify({ users: [], workspaces: [], memberships: [], projects: [], reviews: [], auditLogs: [] }, null, 2),
    );
  }
}

function readFileDb() {
  ensureFileDb();
  const db = JSON.parse(readFileSync(DB_PATH, "utf8"));
  db.users ||= [];
  db.workspaces ||= [];
  db.memberships ||= [];
  db.projects ||= [];
  db.reviews ||= [];
  db.auditLogs ||= [];
  return db;
}

function writeFileDb(db) {
  ensureFileDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function query(text, params = []) {
  if (!pool) throw new Error("DATABASE_URL is not configured");
  const result = await pool.query(text, params);
  return result.rows;
}

export async function ensureSchema() {
  if (!pool || schemaReady) return;
  await query(`
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
      manual_tests jsonb not null default '[]'::jsonb,
      automated_tests jsonb not null default '[]'::jsonb,
      tier text not null default 'free',
      code_scan jsonb,
      paid_fixes jsonb not null default '[]'::jsonb,
      implementation_prompt text not null,
      created_at timestamptz not null default now()
    );

    alter table reviews add column if not exists tier text not null default 'free';
    alter table reviews add column if not exists code_scan jsonb;
    alter table reviews add column if not exists paid_fixes jsonb not null default '[]'::jsonb;
    alter table reviews add column if not exists manual_tests jsonb not null default '[]'::jsonb;
    alter table reviews add column if not exists automated_tests jsonb not null default '[]'::jsonb;

    create table if not exists audit_logs (
      id uuid primary key,
      workspace_id uuid references workspaces(id) on delete cascade,
      user_id uuid references users(id) on delete set null,
      action text not null,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);
  schemaReady = true;
}

function toCamel(row) {
  if (!row) return null;
  return {
    ...row,
    ownerId: row.owner_id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    implementationPrompt: row.implementation_prompt,
    codeScan: row.code_scan,
    paidFixes: row.paid_fixes,
    manualTests: row.manual_tests,
    automatedTests: row.automated_tests,
  };
}

async function writeAudit({ workspaceId, userId, action, metadata = {} }) {
  if (pool) {
    await query(
      "insert into audit_logs (id, workspace_id, user_id, action, metadata) values ($1, $2, $3, $4, $5)",
      [randomUUID(), workspaceId, userId, action, metadata],
    );
    return;
  }
  const db = readFileDb();
  db.auditLogs.unshift({ id: randomUUID(), workspaceId, userId, action, metadata, createdAt: new Date().toISOString() });
  writeFileDb(db);
}

export async function getOrCreateUser({ email, name }) {
  await ensureSchema();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const displayName = String(name || "").trim() || normalizedEmail.split("@")[0] || "builder";
  if (!normalizedEmail.includes("@")) throw Object.assign(new Error("valid email required"), { status: 400 });

  if (pool) {
    const [user] = await query(
      `insert into users (id, email, name)
       values ($1, $2, $3)
       on conflict (email) do update set name = excluded.name
       returning id, email, name, created_at`,
      [randomUUID(), normalizedEmail, displayName],
    );
    const [existingWorkspace] = await query(
      "select id, owner_id, name, created_at from workspaces where owner_id = $1 order by created_at asc limit 1",
      [user.id],
    );
    const [createdWorkspace] = existingWorkspace
      ? [null]
      : await query(
          `insert into workspaces (id, owner_id, name)
           values ($1, $2, $3)
           returning id, owner_id, name, created_at`,
          [randomUUID(), user.id, `${displayName}'s workspace`],
        );
    const activeWorkspace = existingWorkspace || createdWorkspace;
    await query(
      `insert into memberships (workspace_id, user_id, role)
       values ($1, $2, 'owner')
       on conflict (workspace_id, user_id) do nothing`,
      [activeWorkspace.id, user.id],
    );
    return { user: toCamel(user), workspace: toCamel(activeWorkspace) };
  }

  const db = readFileDb();
  let user = db.users.find((item) => item.email === normalizedEmail);
  if (!user) {
    user = { id: randomUUID(), email: normalizedEmail, name: displayName, createdAt: new Date().toISOString() };
    db.users.push(user);
  }
  let workspace = db.workspaces.find((item) => item.ownerId === user.id);
  if (!workspace) {
    workspace = { id: randomUUID(), ownerId: user.id, name: `${displayName}'s workspace`, createdAt: new Date().toISOString() };
    db.workspaces.push(workspace);
    db.memberships.push({ workspaceId: workspace.id, userId: user.id, role: "owner", createdAt: new Date().toISOString() });
  }
  writeFileDb(db);
  return { user, workspace };
}

async function getOrCreateWorkspaceForUser(userId) {
  await ensureSchema();
  if (pool) {
    const [existingWorkspace] = await query(
      "select id, owner_id, name, created_at from workspaces where owner_id = $1 order by created_at asc limit 1",
      [userId],
    );
    if (existingWorkspace) return toCamel(existingWorkspace);
    const [user] = await query("select id, email, name, created_at from users where id = $1", [userId]);
    if (!user) throw Object.assign(new Error("user not found"), { status: 401 });
    const [workspace] = await query(
      `insert into workspaces (id, owner_id, name)
       values ($1, $2, $3)
       returning id, owner_id, name, created_at`,
      [randomUUID(), userId, `${user.name}'s workspace`],
    );
    await query(
      `insert into memberships (workspace_id, user_id, role)
       values ($1, $2, 'owner')
       on conflict (workspace_id, user_id) do nothing`,
      [workspace.id, userId],
    );
    return toCamel(workspace);
  }
  const db = readFileDb();
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw Object.assign(new Error("user not found"), { status: 401 });
  let workspace = db.workspaces.find((item) => item.ownerId === userId);
  if (!workspace) {
    workspace = { id: randomUUID(), ownerId: userId, name: `${user.name}'s workspace`, createdAt: new Date().toISOString() };
    db.workspaces.push(workspace);
    db.memberships.push({ workspaceId: workspace.id, userId, role: "owner", createdAt: new Date().toISOString() });
    writeFileDb(db);
  }
  return workspace;
}

export async function createProject({ userId, workspaceId, title, brief }) {
  await ensureSchema();
  const workspace = workspaceId ? { id: workspaceId } : await getOrCreateWorkspaceForUser(userId);
  const now = new Date().toISOString();
  if (pool) {
    const [project] = await query(
      `insert into projects (id, workspace_id, user_id, title, brief, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $6)
       returning id, workspace_id, user_id, title, brief, created_at, updated_at`,
      [randomUUID(), workspace.id, userId, String(title || "otherend review").trim(), String(brief || "").trim(), now],
    );
    await writeAudit({ workspaceId: workspace.id, userId, action: "project.created", metadata: { projectId: project.id } });
    return toCamel(project);
  }
  const db = readFileDb();
  const project = {
    id: randomUUID(),
    workspaceId: workspace.id,
    userId,
    title: String(title || "otherend review").trim(),
    brief: String(brief || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
  db.projects.unshift(project);
  db.auditLogs.unshift({ id: randomUUID(), workspaceId: workspace.id, userId, action: "project.created", metadata: { projectId: project.id }, createdAt: now });
  writeFileDb(db);
  return project;
}

export async function listProjects({ userId }) {
  await ensureSchema();
  if (pool) {
    const rows = await query(
      `select p.id, p.workspace_id, p.user_id, p.title, p.brief, p.created_at, p.updated_at,
        (select row_to_json(r) from (
          select id, readiness, summary, disciplines, controls, blockers, manual_tests, automated_tests, tier, code_scan, paid_fixes, implementation_prompt, created_at
          from reviews where project_id = p.id order by created_at desc limit 1
        ) r) as review
       from projects p
       join memberships m on m.workspace_id = p.workspace_id and m.user_id = $1
       order by p.updated_at desc`,
      [userId],
    );
    return rows.map((row) => ({ ...toCamel(row), review: row.review ? toCamel(row.review) : null }));
  }
  const db = readFileDb();
  return db.projects
    .filter((item) => item.userId === userId)
    .map((project) => ({ ...project, review: db.reviews.find((review) => review.projectId === project.id) || null }));
}

export async function getProject({ userId, projectId }) {
  const projects = await listProjects({ userId });
  return projects.find((item) => item.id === projectId) || null;
}

export async function updateProject({ userId, projectId, title, brief }) {
  await ensureSchema();
  if (pool) {
    const [project] = await query(
      `update projects p
       set title = $3, brief = $4, updated_at = now()
       where p.id = $2 and exists (
         select 1 from memberships m where m.workspace_id = p.workspace_id and m.user_id = $1
       )
       returning id, workspace_id, user_id, title, brief, created_at, updated_at`,
      [userId, projectId, String(title || "otherend review").trim(), String(brief || "").trim()],
    );
    if (!project) return null;
    await writeAudit({ workspaceId: project.workspace_id, userId, action: "project.updated", metadata: { projectId } });
    return toCamel(project);
  }
  const db = readFileDb();
  const project = db.projects.find((item) => item.id === projectId && item.userId === userId);
  if (!project) return null;
  project.title = String(title || project.title).trim();
  project.brief = String(brief || project.brief).trim();
  project.updatedAt = new Date().toISOString();
  db.auditLogs.unshift({ id: randomUUID(), workspaceId: project.workspaceId, userId, action: "project.updated", metadata: { projectId }, createdAt: new Date().toISOString() });
  writeFileDb(db);
  return project;
}

export async function saveReview({ userId, projectId, review }) {
  await ensureSchema();
  if (pool) {
    const [project] = await query(
      `select p.id, p.workspace_id
       from projects p
       join memberships m on m.workspace_id = p.workspace_id and m.user_id = $1
       where p.id = $2`,
      [userId, projectId],
    );
    if (!project) return null;
    const [saved] = await query(
      `insert into reviews (id, project_id, readiness, summary, disciplines, controls, blockers, manual_tests, automated_tests, tier, code_scan, paid_fixes, implementation_prompt, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning id, project_id, readiness, summary, disciplines, controls, blockers, manual_tests, automated_tests, tier, code_scan, paid_fixes, implementation_prompt, created_at`,
      [
        review.id,
        projectId,
        review.readiness,
        review.summary,
        JSON.stringify(review.disciplines),
        JSON.stringify(review.controls),
        JSON.stringify(review.blockers),
        JSON.stringify(review.manualTests || []),
        JSON.stringify(review.automatedTests || []),
        review.tier || "free",
        review.codeScan ? JSON.stringify(review.codeScan) : null,
        JSON.stringify(review.paidFixes || []),
        review.implementationPrompt,
        review.createdAt,
      ],
    );
    await query("update projects set updated_at = now() where id = $1", [projectId]);
    await writeAudit({ workspaceId: project.workspace_id, userId, action: "review.created", metadata: { projectId, reviewId: review.id, readiness: review.readiness } });
    return toCamel(saved);
  }
  const db = readFileDb();
  const project = db.projects.find((item) => item.id === projectId && item.userId === userId);
  if (!project) return null;
  const saved = { ...review, projectId };
  db.reviews = db.reviews.filter((item) => item.projectId !== projectId);
  db.reviews.unshift(saved);
  project.updatedAt = new Date().toISOString();
  db.auditLogs.unshift({ id: randomUUID(), workspaceId: project.workspaceId, userId, action: "review.created", metadata: { projectId, reviewId: review.id, readiness: review.readiness }, createdAt: new Date().toISOString() });
  writeFileDb(db);
  return saved;
}

export async function listAuditLogs({ userId }) {
  await ensureSchema();
  if (pool) {
    const rows = await query(
      `select a.id, a.workspace_id, a.user_id, a.action, a.metadata, a.created_at
       from audit_logs a
       join memberships m on m.workspace_id = a.workspace_id and m.user_id = $1
       order by a.created_at desc
       limit 50`,
      [userId],
    );
    return rows.map(toCamel);
  }
  const db = readFileDb();
  const workspaceIds = new Set(db.memberships.filter((item) => item.userId === userId).map((item) => item.workspaceId));
  return db.auditLogs.filter((item) => workspaceIds.has(item.workspaceId)).slice(0, 50);
}

export function storageMode() {
  if (pool) return "postgres";
  return process.env.VERCEL ? "temporary json" : "local json";
}
