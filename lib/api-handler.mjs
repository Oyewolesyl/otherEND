import { createHmac } from "node:crypto";
import { createProject, getOrCreateUser, getProject, listAuditLogs, listProjects, saveReview, storageMode, updateProject } from "./store.mjs";
import { generateReview, reviewMarkdown } from "./review-engine.mjs";
import { analyzeZip } from "./code-scan.mjs";

const SESSION_SECRET = process.env.SESSION_SECRET || "otherend-local-dev-secret-change-me";

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

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

async function createStripeCheckout({ email }) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_PRO;
  const appUrl = process.env.APP_URL || "https://otherend-app.vercel.app";
  if (!secretKey || !priceId) {
    return {
      configured: false,
      message: "stripe is not connected yet. add STRIPE_SECRET_KEY and STRIPE_PRICE_PRO in vercel.",
    };
  }

  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/?checkout=success`,
    cancel_url: `${appUrl}/?checkout=cancelled`,
    allow_promotion_codes: "true",
  });
  if (email) params.set("customer_email", email);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error?.message || "stripe checkout failed"), { status: 502 });
  return { configured: true, url: body.url };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolveBody, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 12_000_000) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) return resolveBody({});
      try {
        resolveBody(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error("invalid json"), { status: 400 }));
      }
    });
  });
}

export async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return json(res, 200, { ok: true, storage: storageMode() });
    }

    if (req.method === "POST" && pathname === "/api/auth") {
      const body = await readBody(req);
      const { user, workspace } = await getOrCreateUser({ email: body.email, name: body.name });
      return json(res, 200, {
        token: sign({ userId: user.id, email: user.email, workspaceId: workspace.id }),
        user,
        workspace,
        storage: storageMode(),
      });
    }

    const auth = getAuth(req);
    if (!auth?.userId) return json(res, 401, { error: "session required" });

    if (req.method === "GET" && pathname === "/api/projects") {
      return json(res, 200, { projects: await listProjects({ userId: auth.userId }) });
    }

    if (req.method === "POST" && pathname === "/api/projects") {
      const body = await readBody(req);
      const project = await createProject({
        userId: auth.userId,
        workspaceId: auth.workspaceId,
        title: body.title,
        brief: body.brief,
      });
      return json(res, 201, { project });
    }

    if (req.method === "GET" && pathname === "/api/audit-logs") {
      return json(res, 200, { auditLogs: await listAuditLogs({ userId: auth.userId }) });
    }

    if (req.method === "POST" && pathname === "/api/billing/checkout") {
      const body = await readBody(req);
      return json(res, 200, await createStripeCheckout({ email: body.email || auth.email }));
    }

    if (req.method === "POST" && pathname === "/api/code-scan") {
      const body = await readBody(req);
      const scan = analyzeZip({ fileName: body.fileName, base64: body.base64 });
      return json(res, 200, { scan });
    }

    const match = pathname.match(/^\/api\/projects\/([^/]+)(?:\/(review|export))?$/);
    if (!match) return json(res, 404, { error: "not found" });

    const [, projectId, action] = match;
    const project = await getProject({ userId: auth.userId, projectId });
    if (!project) return json(res, 404, { error: "project not found" });

    if (req.method === "PUT" && !action) {
      const body = await readBody(req);
      const updated = await updateProject({ userId: auth.userId, projectId, title: body.title, brief: body.brief });
      if (!updated) return json(res, 404, { error: "project not found" });
      return json(res, 200, { project: updated });
    }

    if (req.method === "POST" && action === "review") {
      const body = await readBody(req);
      const context = body.codeScan?.reviewContext ? `${project.brief}\n\nuploaded code scan:\n${body.codeScan.reviewContext}` : project.brief;
      const review = generateReview(context, { tier: body.tier || "free", codeScan: body.codeScan || null });
      const saved = await saveReview({ userId: auth.userId, projectId, review });
      if (!saved) return json(res, 404, { error: "project not found" });
      return json(res, 200, { project: { ...project, review: saved }, review: saved });
    }

    if (req.method === "GET" && action === "export") {
      return text(res, 200, reviewMarkdown(project, project.review), "text/markdown; charset=utf-8");
    }

    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || "server error" });
  }
}
