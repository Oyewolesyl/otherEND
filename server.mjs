import { createHmac, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = resolve(".data");
const DB_PATH = join(DATA_DIR, "db.json");
const DIST_DIR = resolve("dist");
const SESSION_SECRET = process.env.SESSION_SECRET || "otherend-local-dev-secret-change-me";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function ensureDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) writeFileSync(DB_PATH, JSON.stringify({ users: [], projects: [] }, null, 2));
}

function readDb() {
  ensureDb();
  return JSON.parse(readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  ensureDb();
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolveBody({});
      try {
        resolveBody(JSON.parse(data));
      } catch {
        reject(new Error("invalid json"));
      }
    });
  });
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
  const hasAi = /ai|summary|model|prompt|agent|llm/i.test(cleanBrief);
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
  if (hasAi) controls.push("log model decisions without storing secrets or private prompts");
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

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "POST" && pathname === "/api/auth") {
      const body = await readBody(req);
      const email = String(body.email || "").trim().toLowerCase();
      const name = String(body.name || "").trim() || email.split("@")[0] || "builder";
      if (!email.includes("@")) return json(res, 400, { error: "valid email required" });
      const db = readDb();
      let user = db.users.find((item) => item.email === email);
      if (!user) {
        user = { id: randomUUID(), email, name, createdAt: new Date().toISOString() };
        db.users.push(user);
        writeDb(db);
      }
      return json(res, 200, { token: sign({ userId: user.id, email: user.email }), user });
    }

    const auth = getAuth(req);
    if (!auth?.userId) return json(res, 401, { error: "session required" });

    if (req.method === "POST" && pathname === "/api/projects") {
      const body = await readBody(req);
      const now = new Date().toISOString();
      const project = {
        id: randomUUID(),
        userId: auth.userId,
        title: String(body.title || "otherEND review").trim(),
        brief: String(body.brief || "").trim(),
        review: null,
        createdAt: now,
        updatedAt: now,
      };
      const db = readDb();
      db.projects.unshift(project);
      writeDb(db);
      return json(res, 201, { project });
    }

    if (req.method === "GET" && pathname === "/api/projects") {
      const db = readDb();
      return json(res, 200, { projects: db.projects.filter((item) => item.userId === auth.userId) });
    }

    const match = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(review|export))?$/);
    if (!match) return json(res, 404, { error: "not found" });
    const [, projectId, action] = match;
    const db = readDb();
    const project = db.projects.find((item) => item.id === projectId && item.userId === auth.userId);
    if (!project) return json(res, 404, { error: "project not found" });

    if (req.method === "PUT" && !action) {
      const body = await readBody(req);
      project.title = String(body.title || project.title).trim();
      project.brief = String(body.brief || project.brief).trim();
      project.updatedAt = new Date().toISOString();
      writeDb(db);
      return json(res, 200, { project });
    }

    if (req.method === "POST" && action === "review") {
      project.review = generateReview(project.brief);
      project.updatedAt = new Date().toISOString();
      writeDb(db);
      return json(res, 200, { project, review: project.review });
    }

    if (req.method === "GET" && action === "export") {
      return send(res, 200, reviewMarkdown(project), "text/markdown; charset=utf-8");
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, 500, { error: error.message || "server error" });
  }
}

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(DIST_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(DIST_DIR) || !existsSync(filePath)) {
    const fallback = join(DIST_DIR, "index.html");
    if (existsSync(fallback)) return send(res, 200, readFileSync(fallback), "text/html; charset=utf-8");
    return send(res, 404, "run npm run build first");
  }
  return send(res, 200, readFileSync(filePath), mimeTypes[extname(filePath)] || "application/octet-stream");
}

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
  return serveStatic(res, url.pathname);
}).listen(PORT, () => {
  console.log(`otherEND server running on http://127.0.0.1:${PORT}`);
});
