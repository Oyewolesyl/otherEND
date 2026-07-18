import { createHmac, randomUUID } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "otherend-vercel-preview-secret";
const store = globalThis.__otherendStore || { users: [], projects: [] };
globalThis.__otherendStore = store;

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.end(type.includes("json") ? JSON.stringify(body) : body);
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = createHmac("sha256", SESSION_SECRET).update(encoded).digest("base64url");
  if (signature !== expected) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function getAuth(req) {
  const header = req.headers.authorization || "";
  return verify(header.startsWith("Bearer ") ? header.slice(7) : "");
}

function generateReview(brief) {
  const cleanBrief = String(brief || "").trim();
  const hasAuth = /auth|login|user|member|team|role|permission|tenant/i.test(cleanBrief);
  const hasPayments = /payment|stripe|subscription|billing|invoice|plan/i.test(cleanBrief);
  const hasFiles = /file|upload|storage|document|image|attachment/i.test(cleanBrief);
  const hasModelWork = /summary|model|prompt|agent|llm/i.test(cleanBrief);
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
  const blockers = [
    "no production deploy until secret scanning is enabled",
    "no release without negative-path tests for authorization failures",
    "no client-side trust for user role, tenant, billing, or storage decisions",
  ];
  const readiness = Math.min(94, 76 + controls.length * 2 + Math.min(6, Math.floor(cleanBrief.length / 120)));
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    readiness,
    summary: cleanBrief,
    disciplines: [
      { name: "solution architect", score: readiness + 1, output: "system boundaries and scale assumptions are explicit." },
      { name: "backend engineer", score: readiness - 2, output: "api contracts, validation, data model, and error handling are defined." },
      { name: "security engineer", score: readiness - 5, output: "auth, authorization, secrets, and abuse controls are mapped." },
      { name: "qa engineer", score: readiness - 8, output: "critical path and negative-path tests are required before launch." },
      { name: "devops engineer", score: readiness - 4, output: "deployment, logs, metrics, and rollback gates are visible." },
      { name: "technical lead", score: readiness - 1, output: "ship decision is tied to unresolved blockers and owner assumptions." },
    ],
    controls,
    blockers,
    implementationPrompt: [
      "build this application with production engineering standards:",
      cleanBrief,
      "",
      "required outputs:",
      "- architecture decision record",
      "- api contract map",
      "- database schema and migration plan",
      "- authentication and authorization strategy",
      "- validation, error handling, rate limiting, and audit logging",
      "- unit, integration, authorization, and abuse-case tests",
      "- deployment, observability, rollback, and secrets policy",
      "",
      "do not ship code that skips authorization checks, stores secrets in client code, or leaves critical paths untested.",
    ].join("\n"),
  };
}

function reviewMarkdown(project) {
  if (!project.review) return `# ${project.title}\n\nno review has been generated yet.\n`;
  const review = project.review;
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

## implementation prompt

\`\`\`text
${review.implementationPrompt}
\`\`\`
`;
}

export default function handler(req, res) {
  const path = `/${[req.query.path].flat().filter(Boolean).join("/")}`;

  if (req.method === "POST" && path === "/auth") {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim() || email.split("@")[0] || "builder";
    if (!email.includes("@")) return send(res, 400, { error: "valid email required" });
    let user = store.users.find((item) => item.email === email);
    if (!user) {
      user = { id: randomUUID(), email, name, createdAt: new Date().toISOString() };
      store.users.push(user);
    }
    return send(res, 200, { token: sign({ userId: user.id, email: user.email }), user });
  }

  const auth = getAuth(req);
  if (!auth?.userId) return send(res, 401, { error: "session required" });

  if (req.method === "POST" && path === "/projects") {
    const now = new Date().toISOString();
    const project = {
      id: randomUUID(),
      userId: auth.userId,
      title: String(req.body?.title || "otherend review").trim(),
      brief: String(req.body?.brief || "").trim(),
      review: null,
      createdAt: now,
      updatedAt: now,
    };
    store.projects.unshift(project);
    return send(res, 201, { project });
  }

  if (req.method === "GET" && path === "/projects") {
    return send(res, 200, { projects: store.projects.filter((item) => item.userId === auth.userId) });
  }

  const match = path.match(/^\/projects\/([^/]+)(?:\/(review|export))?$/);
  if (!match) return send(res, 404, { error: "not found" });

  const [, projectId, action] = match;
  const project = store.projects.find((item) => item.id === projectId && item.userId === auth.userId);
  if (!project) return send(res, 404, { error: "project not found" });

  if (req.method === "PUT" && !action) {
    project.title = String(req.body?.title || project.title).trim();
    project.brief = String(req.body?.brief || project.brief).trim();
    project.updatedAt = new Date().toISOString();
    return send(res, 200, { project });
  }

  if (req.method === "POST" && action === "review") {
    project.review = generateReview(project.brief);
    project.updatedAt = new Date().toISOString();
    return send(res, 200, { project, review: project.review });
  }

  if (req.method === "GET" && action === "export") {
    return send(res, 200, reviewMarkdown(project), "text/markdown; charset=utf-8");
  }

  return send(res, 404, { error: "not found" });
}
