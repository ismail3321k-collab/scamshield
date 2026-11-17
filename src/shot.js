// Linki kullanıcı yerine biz açarız: Cloudflare'in yalıtılmış tarayıcısında ekran görüntüsü.
// Gizlilik: sorgu (?..) ve # kısmı gönderilmez (kurbanın izleme kodu olabilir).
import puppeteer from "@cloudflare/puppeteer";

const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

function privateHost(h) {
  return /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(":") || h.endsWith(".local") || h.endsWith(".internal");
}

export function cleanTarget(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : "http://" + raw);
    if (!/^https?:$/.test(u.protocol) || privateHost(u.hostname)) return null;
    return u.origin + u.pathname;
  } catch { return null; }
}

export function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Tarayıcı takılırsa istek askıda kalmasın: en fazla 25 sn
export function screenshot(env, raw, ctx) {
  return Promise.race([
    screenshotInner(env, raw, ctx),
    new Promise((r) => setTimeout(() => r({ ok: false, reason: "timeout" }), 20_000)),
  ]);
}

async function screenshotInner(env, raw, ctx) {
  if (!env.BROWSER) return { ok: false, reason: "no_browser" };
  const target = cleanTarget(raw);
  if (!target) return { ok: false, reason: "bad_url" };
  const cache = caches.default;
  const cacheKey = new Request("https://ayiq-shot.cache/" + encodeURIComponent(target));
  const hit = await cache.match(cacheKey);
  if (hit) {
    const meta = JSON.parse(hit.headers.get("x-meta") || "{}");
    if (meta.ok === false) return meta;
    return { ok: true, image: new Uint8Array(await hit.arrayBuffer()), ...meta, cached: true };
  }
  let browser;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1 });
    let navError = null, status = null;
    try {
      const resp = await page.goto(target, { waitUntil: "networkidle2", timeout: 10000 });
      status = resp?.status() ?? null;
    } catch (e) { navError = String(e?.message || e); }
    if (navError && /ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_ADDRESS|ERR_TUNNEL|ERR_CERT|ERR_SSL|ERR_EMPTY_RESPONSE|ERR_ABORTED/i.test(navError)) {
      const meta = { ok: false, reason: "site_down", detail: navError.slice(0, 80) };
      ctx?.waitUntil(cache.put(cacheKey, new Response("", { headers: { "cache-control": "max-age=600", "x-meta": JSON.stringify(meta) } })));
      return meta;
    }
    await new Promise((r) => setTimeout(r, 1200));
    const finalUrl = page.url();
    const title = (await page.title().catch(() => "")).slice(0, 120);
    const image = new Uint8Array(await page.screenshot({ type: "jpeg", quality: 60 }));
    const meta = { finalUrl, title, status };
    ctx?.waitUntil(cache.put(cacheKey, new Response(image, {
      headers: { "content-type": "image/jpeg", "cache-control": "max-age=3600", "x-meta": JSON.stringify(meta) },
    })));
    return { ok: true, image, ...meta };
  } catch (e) {
    return { ok: false, reason: "error", detail: String(e?.message || e).slice(0, 160) };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
