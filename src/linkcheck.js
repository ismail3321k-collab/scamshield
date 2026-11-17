// Linkleri gerçekten incele: alan adı yaşı (RDAP) + sayfayı güvenli şekilde kendimiz açıp içine bakma.
// Gizlilik: sorgu (?..) ve # kısmı gönderilmez (kurbanın izleme kodu olabilir); JS çalıştırılmaz; en fazla 150 KB okunur.
import { registrable, sharedHost } from "./url.js";
import { BRANDS } from "./brands.js";
import { foldForMatch } from "./text.js";
import { vtDomain, vtFlag } from "./vt.js";

const cache = new Map(); // anahtar → { t, v }
const TTL = 3600_000;

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  const v = fn().catch(() => null);
  cache.set(key, { t: Date.now(), v });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return v;
}

async function fetchT(url, init, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

function privateHost(h) {
  return /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(":") || h.endsWith(".local") || h.endsWith(".internal");
}

// IANA RDAP rehberi: TLD → sicilin RDAP adresi (Cloudflare önbelleğinde 1 gün)
let bootstrap = null;
function rdapBase(tld) {
  if (!bootstrap) {
    bootstrap = fetchT("https://data.iana.org/rdap/dns.json", { cf: { cacheTtl: 86400, cacheEverything: true } }, 3000)
      .then((r) => r.json())
      .then((j) => {
        const m = new Map();
        for (const [tlds, urls] of j.services || []) for (const t of tlds) m.set(t, urls.find((x) => x.startsWith("https")) || urls[0]);
        return m;
      })
      .catch(() => { bootstrap = null; return new Map(); });
  }
  return bootstrap.then((m) => m.get(tld) || null);
}

// Alan adı kaç günlük? null = bilinmiyor (.az gibi RDAP'ı olmayan alanlar), -1 = sicilde yok (silinmiş / hiç alınmamış)
export function domainAgeDays(reg) {
  return cached("rdap:" + reg, async () => {
    const base = await rdapBase(reg.split(".").pop());
    if (!base) return null;
    const res = await fetchT(`${base.replace(/\/?$/, "/")}domain/${reg}`, { headers: { accept: "application/rdap+json" } }, 3000);
    if (res.status === 404) return -1;
    if (!res.ok) return null;
    const j = await res.json();
    const ev = (j.events || []).find((e) => e.eventAction === "registration");
    if (!ev?.eventDate) return null;
    return Math.max(0, Math.floor((Date.now() - Date.parse(ev.eventDate)) / 86_400_000));
  });
}

async function readLimited(res, max) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let out = "", size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    out += dec.decode(value, { stream: true });
  }
  try { reader.cancel(); } catch { /* yok */ }
  return out;
}

export function inspectPage(raw) {
  let start;
  try { start = new URL(/^https?:\/\//i.test(raw) ? raw : "http://" + raw); } catch { return Promise.resolve(null); }
  const key = "page:" + start.origin + start.pathname;
  return cached(key, async () => {
    let target = start.origin + start.pathname;
    for (let hop = 0; hop < 5; hop++) {
      const t = new URL(target);
      if (!/^https?:$/.test(t.protocol) || privateHost(t.hostname)) return null;
      const res = await fetchT(target, {
        redirect: "manual",
        headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36", accept: "text/html,*/*" },
      }, 3000);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) { target = new URL(loc, target).href; continue; }
      const ct = res.headers.get("content-type") || "";
      const html = /html|text/i.test(ct) ? await readLimited(res, 150_000) : "";
      return { finalUrl: target, status: res.status, html };
    }
    return null;
  });
}

const CARD_RE = /<input[^>]{0,300}?(cc-number|cc-csc|cc-exp|card[-_ ]?(num|no)|cardnumber|cvv|cvc|kart[-_ ]?(n[öo]m|no)|номер\s*карты)[^>]*>/i;
const SCAM_APP_RE = /(recharge|withdraw|invit(e|ation)\s*code|usdt|grab\s*order|commission|vip\s*level|task\s*hall|抢单|充值|提现|邀请码|rebate)/gi;
const APP_PATH_RE = /\/h5\/|#\/pages\/|\/(invite|register|reg)\?(code|ref|invite)=|\/(recharge|withdraw)\b/i;

// Linkler için ek işaretler: { host → [flag] }
export async function checkLinks(urls, env) {
  const out = new Map();
  const targets = urls.filter((u) => !u.official && !u.messenger).slice(0, 2);
  await Promise.all(targets.map(async (u) => {
    const flags = [];
    if (APP_PATH_RE.test(u.raw)) flags.push({ code: "scam_app_path", weight: 20 });
    const [age, page, vt] = await Promise.all([domainAgeDays(u.reg), inspectPage(u.raw), sharedHost(u.host) ? null : vtDomain(env, u.reg).catch(() => null)]);
    const vf = vtFlag(vt);
    if (vf) flags.push(vf);
    if (age === -1) flags.push({ code: "domain_not_registered", weight: 25 });
    else if (age !== null && age !== undefined) {
      if (age < 30) flags.push({ code: "new_domain", weight: 35, days: age });
      else if (age < 180) flags.push({ code: "young_domain", weight: 15, days: age });
      else if (age >= 1095) flags.push({ code: "old_domain", weight: -15, days: age });
    }
    if (page?.html) {
      const html = page.html;
      if (/<input[^>]{0,200}?type\s*=\s*["']?password/i.test(html)) flags.push({ code: "page_password", weight: 15 });
      if (CARD_RE.test(html)) flags.push({ code: "page_card_form", weight: 35 });
      const appHits = new Set((html.match(SCAM_APP_RE) || []).map((x) => x.toLowerCase()));
      if (appHits.size >= 2) flags.push({ code: "page_scam_app", weight: 35 });
      const title = foldForMatch(html.match(/<title[^>]*>([^<]{0,200})/i)?.[1] || "");
      const text = foldForMatch(title + " " + html.slice(0, 40_000));
      for (const b of BRANDS) {
        if (b.name.length < 4) continue;
        const names = [foldForMatch(b.name), ...b.mentions.filter((m) => m.trim().length >= 6)];
        if (names.some((n) => title.includes(n.trim())) || (names.some((n) => text.includes(n.trim())) && CARD_RE.test(html))) {
          if (!b.domains.includes(u.reg)) flags.push({ code: "brand_impersonation", weight: 40, brand: b.name, official: b.domains[0], reg: u.reg, viaPage: true });
          break;
        }
      }
    }
    if (page?.finalUrl) {
      try {
        const fin = registrable(new URL(page.finalUrl).hostname);
        if (fin && fin !== u.reg) flags.push({ code: "redirect_other", weight: 10, reg: fin });
      } catch { /* yok */ }
    }
    if (page) flags.push({ code: "page_checked", weight: 0 });
    out.set(u.host, flags);
  }));
  return out;
}
