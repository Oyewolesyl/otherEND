import { randomUUID } from "node:crypto";

export function generateReview(brief, options = {}) {
  const cleanBrief = String(brief || "").trim();
  const tier = options.tier === "paid" ? "paid" : "free";
  const codeScan = options.codeScan || null;
  const hasAuth = /auth|login|user|member|team|role|permission|tenant/i.test(cleanBrief);
  const hasPayments = /payment|stripe|subscription|billing|invoice|plan/i.test(cleanBrief);
  const hasFiles = /file|upload|storage|document|image|attachment/i.test(cleanBrief);
  const hasModelWork = /summary|model|prompt|agent|llm/i.test(cleanBrief);
  const hasDatabase = /database|postgres|mysql|schema|migration|record|data/i.test(cleanBrief);

  const controls = [
    "define service boundaries before implementation",
    "validate every request body and query parameter",
    "normalize api errors and response contracts",
    "require audit logs for sensitive actions",
    "add rate limits to auth and write endpoints",
    "ship with unit, integration, and authorization boundary tests",
  ];
  if (hasAuth) controls.push("enforce role-based access and object ownership checks");
  if (hasPayments) controls.push("isolate billing webhooks and verify event signatures");
  if (hasFiles) controls.push("scan uploads and keep storage access server-authorized");
  if (hasModelWork) controls.push("log model decisions without storing secrets or private prompts");
  if (hasDatabase) controls.push("ship migrations, indexes, backups, retention rules, and rollback notes");

  const blockers = [
    "no production deploy until secret scanning is enabled",
    "no release without negative-path tests for authorization failures",
    "no client-side trust for user role, tenant, billing, or storage decisions",
  ];
  if (hasDatabase) blockers.push("no database launch without migration rollback and backup recovery checks");
  if (codeScan?.warnings?.length) {
    blockers.push(...codeScan.warnings.slice(0, 3).map((warning) => `uploaded code warning: ${warning}`));
  }

  const readiness = Math.min(96, 74 + controls.length * 2 + Math.min(8, Math.floor(cleanBrief.length / 120)));
  const paidFixes = [
    "rewrite risky auth and permission flows with server-side ownership checks",
    "draft database migrations, indexes, rollback notes, and backup checks",
    "draft request validation schemas and clearer api error responses",
    "draft tests for failed login, blocked access, bad inputs, payments, uploads, and rate limits",
    "draft deployment checks for secrets, logs, rollback, and production environment separation",
  ];

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readiness,
    summary: cleanBrief,
    disciplines: [
      { name: "solution architect", score: readiness + 1, output: "system boundaries and scale assumptions are explicit." },
      { name: "backend engineer", score: readiness - 2, output: "api contracts, validation, data model, and error handling are defined." },
      { name: "database engineer", score: readiness - 4, output: "schema design, migrations, indexes, backups, and data lifecycle rules are required." },
      { name: "security engineer", score: readiness - 5, output: "auth, authorization, secrets, and abuse controls are mapped." },
      { name: "qa engineer", score: readiness - 8, output: "critical path and negative-path tests are required before launch." },
      { name: "devops engineer", score: readiness - 4, output: "deployment, logs, metrics, and rollback gates are visible." },
      { name: "technical lead", score: readiness - 1, output: "ship decision is tied to unresolved blockers and owner assumptions." },
    ],
    controls,
    blockers,
    tier,
    codeScan,
    paidFixes: tier === "paid" ? paidFixes : [],
    implementationPrompt: [
      "build this application with production engineering standards:",
      cleanBrief,
      "",
      codeScan ? `uploaded code context:\n${codeScan.reviewContext}\n` : "",
      tier === "paid"
        ? "paid tier behavior: draft corrected approach, safer code structure, tests, migrations, and handoff notes."
        : "free tier behavior: review the idea or uploaded code, explain risks, and show what must be fixed.",
      "",
      "required outputs:",
      "- architecture decision record",
      "- api contract map",
      "- postgres database schema and migration plan",
      "- authentication and authorization strategy",
      "- validation, error handling, rate limiting, and audit logging",
      "- unit, integration, authorization, abuse-case, and migration tests",
      "- deployment, observability, rollback, backup, and secrets policy",
      tier === "paid" ? "- corrected code approach and suggested patch plan" : "- upgrade notes for corrected code drafts on paid tier",
      "",
      "do not ship code that skips authorization checks, stores secrets in client code, or leaves critical paths untested.",
    ].join("\n"),
  };
}

export function reviewMarkdown(project, review) {
  if (!review) return `# ${project.title}\n\nno review has been generated yet.\n`;
  return `# ${project.title}

## project brief

${project.brief}

## readiness

${review.readiness}%

## specialist review

${review.disciplines.map((item) => `- ${item.name}: ${item.score}% - ${item.output}`).join("\n")}

## required controls

${review.controls.map((item) => `- ${item}`).join("\n")}

## release blockers

${review.blockers.map((item) => `- ${item}`).join("\n")}

## tier

${review.tier || "free"}

${review.paidFixes?.length ? `## paid corrected approach\n\n${review.paidFixes.map((item) => `- ${item}`).join("\n")}\n` : ""}

${review.codeScan ? `## uploaded code scan\n\n${review.codeScan.reviewContext}\n` : ""}

## implementation prompt

\`\`\`text
${review.implementationPrompt}
\`\`\`
`;
}
