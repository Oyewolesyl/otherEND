import {
  Activity,
  Boxes,
  Bug,
  ClipboardCheck,
  CloudCog,
  Database,
  FileCode2,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Network,
  Radar,
  ShieldCheck,
  TestTubeDiagonal,
  type LucideIcon,
} from "lucide-react";

export type Discipline = {
  id: string;
  icon: LucideIcon;
  title: string;
  role: string;
  verdict: string;
  checks: string[];
  score: number;
};

export type Artifact = {
  icon: LucideIcon;
  title: string;
  description: string;
  status: "ready" | "needs review" | "blocked";
};

export type Risk = {
  label: string;
  severity: "high" | "medium" | "low";
  control: string;
};

export const disciplines: Discipline[] = [
  {
    id: "architect",
    icon: Boxes,
    title: "solution architect",
    role: "decides the system shape before code is written",
    verdict: "service boundaries, domain model, failure modes, and scale assumptions are now explicit.",
    checks: ["domain boundaries", "modular backend layout", "scale path", "failure behavior"],
    score: 91,
  },
  {
    id: "backend",
    icon: Database,
    title: "backend engineer",
    role: "turns the product request into durable APIs and data contracts",
    verdict: "core API contracts are normalized with validation, pagination, idempotency, and typed errors.",
    checks: ["api contracts", "database relations", "input validation", "error taxonomy"],
    score: 88,
  },
  {
    id: "database",
    icon: GitBranch,
    title: "database engineer",
    role: "turns product state into durable tables, migrations, and audit trails",
    verdict: "users, workspaces, projects, reviews, controls, blockers, and audit events have a real storage model.",
    checks: ["postgres schema", "migration path", "review history", "audit trail"],
    score: 86,
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "security engineer",
    role: "threat models the project before production risk appears",
    verdict: "auth, authorization, secrets, abuse controls, and owasp risks are mapped to controls.",
    checks: ["rbac policy", "secret handling", "rate limits", "owasp coverage"],
    score: 84,
  },
  {
    id: "qa",
    icon: TestTubeDiagonal,
    title: "qa engineer",
    role: "turns assumptions into automated confidence",
    verdict: "test coverage now includes unit, integration, auth boundary, and regression scenarios.",
    checks: ["critical paths", "negative cases", "contract tests", "release gates"],
    score: 79,
  },
  {
    id: "devops",
    icon: CloudCog,
    title: "devops engineer",
    role: "defines how the software survives real traffic and incidents",
    verdict: "deployment, observability, rollback, environment isolation, and logging have defined standards.",
    checks: ["ci checks", "environment model", "logs and metrics", "rollback plan"],
    score: 82,
  },
  {
    id: "lead",
    icon: ClipboardCheck,
    title: "technical lead",
    role: "decides whether the work is shippable",
    verdict: "the project is not treated as complete until unresolved risks and owner decisions are visible.",
    checks: ["decision record", "tradeoffs", "remaining risks", "handoff brief"],
    score: 87,
  },
];

export const artifacts: Artifact[] = [
  {
    icon: GitBranch,
    title: "architecture decision record",
    description: "why this backend shape exists, which alternatives were rejected, and what must be revisited later.",
    status: "ready",
  },
  {
    icon: Network,
    title: "api contract map",
    description: "resources, endpoints, auth rules, validation schemas, pagination, and error responses.",
    status: "ready",
  },
  {
    icon: LockKeyhole,
    title: "security control plan",
    description: "threat model, owasp coverage, rate limits, secrets policy, and authorization boundaries.",
    status: "needs review",
  },
  {
    icon: Bug,
    title: "failure and abuse cases",
    description: "what breaks, how users can misuse it, and which safeguards must exist before launch.",
    status: "ready",
  },
  {
    icon: FileCode2,
    title: "implementation prompt",
    description: "a model-ready build prompt that can be sent to the coding tool your team already uses.",
    status: "ready",
  },
  {
    icon: Activity,
    title: "release readiness report",
    description: "scorecard, blockers, final reviewer notes, and a clear ship/no-ship recommendation.",
    status: "blocked",
  },
];

export const risks: Risk[] = [
  {
    label: "generated auth logic may skip object-level authorization",
    severity: "high",
    control: "force every resource endpoint through ownership or rbac policy checks",
  },
  {
    label: "fast prototypes often leak secrets into client bundles or logs",
    severity: "high",
    control: "environment separation, secret scanning, masked logging, and deployment gates",
  },
  {
    label: "database schemas may satisfy the demo but fail under product growth",
    severity: "medium",
    control: "normalized entities, migration strategy, index review, and retention policy",
  },
  {
    label: "generated apps rarely include meaningful negative-path tests",
    severity: "medium",
    control: "require auth boundary, validation, rate-limit, and abuse-case tests",
  },
];

export const workflow = [
  "capture product intent",
  "clarify engineering assumptions",
  "design architecture and contracts",
  "run security and backend review",
  "produce implementation package",
  "score release readiness",
];

export const standards = [
  { icon: KeyRound, label: "authentication", value: "session policy, refresh flow, passwordless option" },
  { icon: ShieldCheck, label: "authorization", value: "rbac, ownership checks, tenant isolation" },
  { icon: Radar, label: "abuse controls", value: "rate limits, audit logs, anomaly flags" },
  { icon: Database, label: "data model", value: "relations, indexes, migrations, retention" },
  { icon: TestTubeDiagonal, label: "testing", value: "unit, integration, contract, security cases" },
  { icon: CloudCog, label: "operations", value: "ci gates, rollback, metrics, incident notes" },
];
