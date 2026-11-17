// Yerel arayüz sunucusu: statik dosyalar diskten, /api/* istekleri canlı ScamShield'e.
// Kullanım: node tools/ui-dev.mjs [klasör=public] [port=8790] [api=https://scamshield-az.pages.dev]
// Not: canlı API'ye giden her analiz panele (D1 checks) yazılır; sunum öncesi panel sıfırlanmalı.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || "public");
const port = Number(process.argv[3] || 8790);
const api = (process.argv[4] || "https://scamshield-az.pages.dev").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon", ".wasm": "application/wasm", ".gz": "application/gzip", ".txt": "text/plain; charset=utf-8",
};

// _headers dosyasındaki "/*" bloğu (CSP vb.) her yanıta eklenir: canlıdaki gibi test edilsin
async function globalHeaders() {
  try {
    const lines = (await readFile(join(root, "_headers"), "utf8")).split(/\r?\n/);
    const out = {};
    let inAll = false;
    for (const l of lines) {
      if (!l.trim()) continue;
      if (!/^\s/.test(l)) { inAll = l.trim() === "/*"; continue; }
      if (inAll) { const i = l.indexOf(":"); out[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
    }
    return out;
  } catch { return {}; }
}

async function fileFor(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, "") || "/index";
  for (const cand of [clean, clean + ".html", join(clean, "index.html")]) {
    const p = resolve(join(root, cand));
    if (p !== root && !p.startsWith(root + sep)) return null;
    try { if ((await stat(p)).isFile()) return p; } catch { /* sıradaki */ }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const r = await fetch(api + url.pathname + url.search, {
        method: req.method,
        headers: { "content-type": req.headers["content-type"] || "application/json" },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json", "cache-control": "no-store" });
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    const file = await fileFor(url.pathname);
    const headers = await globalHeaders();
    if (!file) {
      res.writeHead(404, { ...headers, "content-type": "text/plain; charset=utf-8" });
      res.end("404");
      return;
    }
    res.writeHead(200, { ...headers, "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("dev server: " + e.message);
  }
}).listen(port, () => console.log(`UI dev: http://localhost:${port}  (dosyalar: ${root}, API: ${api})`));
