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
  const hasInvites = /invite|member|team|workspace|role/i.test(cleanBrief);

  const manualTests = [
    "open the app as a new visitor and confirm the first screen explains what to do next",
    "create an account or sign in, then confirm the user sees a clear success message",
    "create the main record in the product, refresh the page, and confirm it is still there",
    "enter empty, wrong, and very long values into important forms and confirm friendly error messages appear",
    "try to open a private page or record while signed out and confirm access is blocked",
    "use the app on a phone-sized screen and confirm the main task can be completed without hidden buttons",
  ];
  if (hasAuth) manualTests.push("sign in as two different users and confirm one user cannot see or change the other user's private data");
  if (hasInvites) manualTests.push("invite a teammate, accept the invite, then confirm the teammate only has the intended permissions");
  if (hasPayments) manualTests.push("test subscription checkout, cancelled checkout, failed payment, and webhook retry behavior in stripe test mode");
  if (hasFiles) manualTests.push("upload a valid file, a file that is too large, and a wrong file type, then confirm storage stays private");

  const automatedTests = [
    "unit tests for validation helpers, permission checks, and core business rules",
    "api tests for create, read, update, delete, bad input, missing auth, and forbidden access",
    "browser tests for sign in, the main happy path, failed form submission, and mobile layout",
    "regression tests for bugs once they are fixed so the same mistake does not return",
  ];
  if (hasAuth) automatedTests.push("authorization boundary tests proving users cannot access records they do not own");
  if (hasDatabase) automatedTests.push("database tests for migrations, required fields, indexes, rollback, and delete behavior");
  if (hasPayments) automatedTests.push("stripe webhook tests for paid, failed, cancelled, duplicate, and replayed events");
  if (hasFiles) automatedTests.push("upload tests for file type, size, virus-scan placeholder, signed url access, and private storage rules");
  if (codeScan?.warnings?.some((warning) => /test/i.test(warning))) automatedTests.push("add missing test files before treating the uploaded code as release-ready");

  const controls = [
    "define service boundaries before implementation",
    "validate every request body and query parameter",
    "normalize api errors and response contracts",
    "require audit logs for sensitive actions",
    "add rate limits to auth and write endpoints",
    "ship with unit, integration, and authorization boundary tests",
    "complete the manual quality tester checklist before release",
    "automate the main happy path, failed path, and permission boundary tests",
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
    "draft a manual qa script that a non-technical founder can follow before launch",
    "draft automated playwright and api test coverage for the most important flows",
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
      { name: "quality tester", score: readiness - 8, output: "manual checks and automated test coverage are defined before launch." },
      { name: "devops engineer", score: readiness - 4, output: "deployment, logs, metrics, and rollback gates are visible." },
      { name: "technical lead", score: readiness - 1, output: "ship decision is tied to unresolved blockers and owner assumptions." },
    ],
    controls,
    blockers,
    tier,
    codeScan,
    manualTests,
    automatedTests,
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
      "- manual quality tester script for non-technical release checks",
      "- automated test plan with browser, api, database, and permission coverage",
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

## manual quality tester plan

${(review.manualTests || []).map((item) => `- ${item}`).join("\n")}

## automated testing plan

${(review.automatedTests || []).map((item) => `- ${item}`).join("\n")}

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
