import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { handleApi } from "./lib/api-handler.mjs";

const PORT = Number(process.env.PORT || 8787);
const DIST_DIR = resolve("dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
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
  console.log(`otherend server running on http://127.0.0.1:${PORT}`);
});
