import { inflateRawSync } from "node:zlib";

const MAX_ZIP_BYTES = 8 * 1024 * 1024;
const TEXT_FILE_LIMIT = 120_000;
const TEXT_NAMES = new Set([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "dockerfile",
  "docker-compose.yml",
  ".env",
  ".env.example",
  "schema.sql",
  "database.sql",
  "prisma/schema.prisma",
]);

function readZipEntries(buffer) {
  const endStart = Math.max(0, buffer.length - 66_000);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= endStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw Object.assign(new Error("this does not look like a valid zip file"), { status: 400 });

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  let offset = centralOffset;

  for (let index = 0; index < entryCount && offset < buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength).replaceAll("\\", "/");
    entries.push({ name, method, compressedSize, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries.filter((entry) => entry.name && !entry.name.endsWith("/") && !entry.name.includes("__MACOSX/"));
}

function readEntryText(buffer, entry) {
  if (entry.size > TEXT_FILE_LIMIT || entry.compressedSize <= 0) return "";
  if (buffer.readUInt32LE(entry.localOffset) !== 0x04034b50) return "";
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  try {
    const output = entry.method === 0 ? data : entry.method === 8 ? inflateRawSync(data) : null;
    return output ? output.toString("utf8").slice(0, TEXT_FILE_LIMIT) : "";
  } catch {
    return "";
  }
}

function countWhere(entries, test) {
  return entries.filter((entry) => test(entry.name.toLowerCase())).length;
}

function hasPath(entries, test) {
  return entries.some((entry) => test(entry.name.toLowerCase()));
}

export function analyzeZipBuffer({ fileName, buffer }) {
  if (!buffer.length) throw Object.assign(new Error("upload a zip file first"), { status: 400 });
  if (buffer.length > MAX_ZIP_BYTES) throw Object.assign(new Error("zip is too large. keep this first review under 8mb."), { status: 413 });

  const entries = readZipEntries(buffer);
  const names = entries.map((entry) => entry.name);
  const lowerNames = names.map((name) => name.toLowerCase());
  const selectedText = new Map();

  for (const entry of entries) {
    const normalized = entry.name.toLowerCase();
    const basename = normalized.split("/").pop() || normalized;
    if (TEXT_NAMES.has(normalized) || TEXT_NAMES.has(basename)) {
      const text = readEntryText(buffer, entry);
      if (text) selectedText.set(normalized, text);
    }
  }

  const packageJson = [...selectedText.entries()].find(([name]) => name.endsWith("package.json"))?.[1] || "";
  const hasReact = /"react"\s*:/.test(packageJson) || lowerNames.some((name) => name.endsWith(".tsx") || name.includes("/src/"));
  const hasNext = /"next"\s*:/.test(packageJson) || lowerNames.some((name) => name.includes("/app/") && name.endsWith("page.tsx"));
  const hasExpress = /"express"\s*:/.test(packageJson);
  const hasPrisma = lowerNames.some((name) => name.endsWith("schema.prisma"));
  const hasSql = lowerNames.some((name) => name.endsWith(".sql"));
  const hasEnv = lowerNames.some((name) => name.includes(".env"));
  const hasDocker = lowerNames.some((name) => name.endsWith("dockerfile") || name.endsWith("docker-compose.yml"));
  const hasTests = hasPath(entries, (name) => /(\.test\.|\.spec\.|__tests__|\/tests?\/)/.test(name));
  const apiFiles = countWhere(entries, (name) => name.includes("/api/") || name.includes("/routes/") || name.includes("/controllers/"));
  const dbFiles = countWhere(entries, (name) => name.includes("schema") || name.includes("migration") || name.includes("database") || name.includes("prisma"));
  const authFiles = countWhere(entries, (name) => name.includes("auth") || name.includes("session") || name.includes("login"));

  const findings = [];
  if (hasReact) findings.push("frontend app detected");
  if (hasNext) findings.push("next.js structure detected");
  if (hasExpress) findings.push("express backend detected");
  if (apiFiles) findings.push(`${apiFiles} possible api or route files found`);
  if (dbFiles || hasPrisma || hasSql) findings.push(`${dbFiles || 1} database or migration files found`);
  if (authFiles) findings.push(`${authFiles} auth-related files found`);
  if (hasDocker) findings.push("deployment files found");
  if (hasTests) findings.push("test files found");

  const warnings = [];
  if (hasEnv) warnings.push("an env file exists in the zip. confirm real secrets are not committed.");
  if (!hasTests) warnings.push("no obvious test files were found.");
  if (!dbFiles && !hasPrisma && !hasSql) warnings.push("no obvious database schema or migration files were found.");
  if (!apiFiles) warnings.push("no obvious api route files were found.");
  if (!authFiles) warnings.push("no obvious auth or session files were found.");

  const summaryLines = [
    `zip file: ${fileName || "uploaded code"}`,
    `files found: ${entries.length}`,
    `key findings: ${findings.length ? findings.join("; ") : "project structure detected, but no strong backend signals found"}`,
    `warnings: ${warnings.length ? warnings.join("; ") : "no immediate structure warnings from file names"}`,
  ];

  return {
    fileName: fileName || "uploaded code.zip",
    size: buffer.length,
    fileCount: entries.length,
    sampleFiles: names.slice(0, 24),
    findings,
    warnings,
    reviewContext: summaryLines.join("\n"),
  };
}

export function analyzeZip({ fileName, base64 }) {
  const cleanBase64 = String(base64 || "").replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  return analyzeZipBuffer({ fileName, buffer });
}
