// Node.js production server for Railway / any Node host.
// - Serves built client assets from dist/client
// - Delegates all other requests (pages + /api/* server functions/routes)
//   to the TanStack Start SSR fetch handler in dist/server/server.js

import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "dist", "client");
const SERVER_ENTRY = path.join(__dirname, "dist", "server", "server.js");

if (!existsSync(SERVER_ENTRY)) {
  console.error(`[server] Missing build output at ${SERVER_ENTRY}`);
  console.error(`[server] Run "npm run build" before "npm start".`);
  process.exit(1);
}

const { default: ssr } = await import(SERVER_ENTRY);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function isSafeRelative(rel) {
  // prevent path traversal
  return !rel.split("/").some((p) => p === ".." || p === "");
}

async function tryServeStatic(urlPath) {
  // Only attempt for paths that look like real files (have an extension)
  // or are clearly under /assets/.
  const cleanPath = urlPath.split("?")[0].split("#")[0];
  const rel = cleanPath.replace(/^\/+/, "");
  if (!rel) return null;
  if (!isSafeRelative(rel)) return null;

  const filePath = path.join(CLIENT_DIR, rel);
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const ext = path.extname(filePath).toLowerCase();
    const data = await readFile(filePath);
    return {
      data,
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": rel.startsWith("assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600",
      },
    };
  } catch {
    return null;
  }
}

function nodeReqToWebRequest(req) {
  const host = req.headers.host ?? "localhost";
  const protocol =
    req.headers["x-forwarded-proto"]?.toString().split(",")[0] ?? "http";
  const url = `${protocol}://${host}${req.url}`;

  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else headers.set(k, String(v));
  }

  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    // Stream Node request into a Web ReadableStream
    init.body = new ReadableStream({
      start(controller) {
        req.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
        req.on("end", () => controller.close());
        req.on("error", (err) => controller.error(err));
      },
    });
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function sendWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!webRes.body) {
    res.end();
    return;
  }
  const reader = webRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  try {
    // Try static asset first (only matches existing files in dist/client)
    const staticHit = await tryServeStatic(req.url ?? "/");
    if (staticHit) {
      res.statusCode = 200;
      for (const [k, v] of Object.entries(staticHit.headers)) res.setHeader(k, v);
      res.end(staticHit.data);
      return;
    }

    // Otherwise hand off to TanStack Start SSR handler
    const webReq = nodeReqToWebRequest(req);
    const webRes = await ssr.fetch(webReq);
    await sendWebResponse(webRes, res);
  } catch (err) {
    console.error("[server] Request failed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || "0.0.0.0";
server.listen(port, host, () => {
  console.log(`[server] Listening on http://${host}:${port}`);
});