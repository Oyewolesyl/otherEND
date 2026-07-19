export type Discipline = {
  id: string;
  title: string;
  role: string;
  verdict: string;
  checks: string[];
  score: number;
};

export type Artifact = {
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
    title: "app structure",
    role: "checks whether the idea has a clear shape before code is written",
    verdict: "the main parts of the app, how they connect, and what could break are now easier to see.",
    checks: ["main app parts", "how features connect", "growth plan", "what happens if it fails"],
    score: 91,
  },
  {
    id: "backend",
    title: "backend logic",
    role: "checks whether the app can safely handle real user actions",
    verdict: "the app needs clear rules for requests, saved data, errors, repeated actions, and permissions.",
    checks: ["user actions", "saved data rules", "input checks", "clear error messages"],
    score: 88,
  },
  {
    id: "database",
    title: "database plan",
    role: "checks what information must be saved and how it should be organized",
    verdict: "users, workspaces, app ideas, reviews, fixes, blockers, and activity history need a durable storage plan.",
    checks: ["what gets saved", "how records connect", "review history", "activity history"],
    score: 86,
  },
  {
    id: "security",
    title: "security basics",
    role: "checks whether private actions, data, and accounts are protected",
    verdict: "sign in, permissions, secret keys, abuse controls, and common web risks are mapped to fixes.",
    checks: ["who can log in", "who can see what", "secret key safety", "abuse protection"],
    score: 84,
  },
  {
    id: "qa",
    title: "quality tester",
    role: "checks what a human should test and what software should test automatically",
    verdict: "the review creates manual test steps for real users and automated test coverage for repeatable confidence.",
    checks: ["manual test script", "automated test plan", "failure paths", "regression checks"],
    score: 79,
  },
  {
    id: "devops",
    title: "launch setup",
    role: "checks whether the app can survive real users and real mistakes",
    verdict: "deployment, logs, monitoring, rollback, environment setup, and incident notes are part of the launch plan.",
    checks: ["deploy checks", "test vs live setup", "logs and alerts", "rollback plan"],
    score: 82,
  },
  {
    id: "lead",
    title: "ship decision",
    role: "turns the review into a clear yes, no, or fix-first decision",
    verdict: "the project is not treated as complete until the remaining risks and owner decisions are visible.",
    checks: ["final decision", "tradeoffs", "remaining risks", "handoff notes"],
    score: 87,
  },
];

export const artifacts: Artifact[] = [
  {
    title: "build plan",
    description: "what the app should contain, why it should be shaped that way, and what can wait until later.",
    status: "ready",
  },
  {
    title: "backend checklist",
    description: "the user actions, saved data, permission rules, input checks, and error behavior the build needs.",
    status: "ready",
  },
  {
    title: "security checklist",
    description: "what must be protected: accounts, private data, secret keys, abuse limits, and permission boundaries.",
    status: "needs review",
  },
  {
    title: "risk list",
    description: "what can break, how users may misuse it, and which safeguards should exist before launch.",
    status: "ready",
  },
  {
    title: "quality test plan",
    description: "manual checks a person should click through and automated checks that should run before future releases.",
    status: "ready",
  },
  {
    title: "build prompt",
    description: "a stronger prompt you can paste into the coding tool your team already uses.",
    status: "ready",
  },
  {
    title: "launch readiness report",
    description: "score, blockers, reviewer notes, and a clear recommendation on whether to keep building or fix first.",
    status: "blocked",
  },
];

export const risks: Risk[] = [
  {
    label: "users might see or change data they should not access",
    severity: "high",
    control: "add permission checks to every private action and every saved record",
  },
  {
    label: "secret keys can accidentally appear in the browser or logs",
    severity: "high",
    control: "keep secrets on the server, mask logs, scan before deploy, and separate test from live",
  },
  {
    label: "the database may work for a demo but break as the product grows",
    severity: "medium",
    control: "define clear records, relationships, indexes, migrations, and data retention",
  },
  {
    label: "the build may only test the happy path",
    severity: "medium",
    control: "create manual checks and automated tests for bad inputs, blocked users, rate limits, permissions, and failed payments",
  },
];

export const workflow = [
  "understand the app idea",
  "spot missing decisions",
  "shape the backend and database plan",
  "check security and user permissions",
  "create manual and automated quality tests",
  "create the build prompt and handoff",
  "decide what is ready and what needs fixing",
];

export const standards = [
  { label: "sign in", value: "how users enter, stay signed in, and recover access" },
  { label: "permissions", value: "who can see, edit, delete, invite, export, or bill" },
  { label: "abuse controls", value: "rate limits, activity logs, and suspicious behavior checks" },
  { label: "database", value: "records, relationships, indexes, migrations, and retention" },
  { label: "manual testing", value: "real user checks, confusing flows, failed states, mobile use, and release confidence" },
  { label: "automated testing", value: "browser tests, api tests, permission tests, database tests, and regression checks" },
  { label: "launch", value: "deploy checks, rollback, logs, alerts, and incident notes" },
];
