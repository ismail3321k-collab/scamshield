// URL çıkarma, kayıtlı alan adı (Public Suffix alt kümesi), taklit tespiti, kısaltıcı / riskli TLD işaretleri.
import allowlist from "../data/allowlist.json" with { type: "json" };
import { BRANDS } from "./brands.js";

const OFFICIAL = new Set(allowlist.map((r) => r.domain));
const MESSENGER = new Set(["t.me", "telegram.me", "wa.me", "chat.whatsapp.com", "api.whatsapp.com"]);

const SECOND_LEVEL = new Set([
  "com.az", "net.az", "int.az", "gov.az", "org.az", "edu.az", "info.az", "pp.az", "mil.az", "name.az", "pro.az", "biz.az",
  "co.uk", "org.uk", "gov.uk", "ac.uk", "com.tr", "gov.tr", "org.tr", "net.tr", "com.ru", "com.ua", "co.jp", "com.au", "com.br", "co.za",
]);

const BARE_TLDS = new Set(("az com net org info top xyz online site me ru tr io co ly gd at link click shop live buzz icu cfd sbs app tk ml ga cf gq pw cc " +
  "biz store vip win bz it su uk de gl test ws fun pro club page rest bond today life world space website tech ua kz uz ge us eu").split(" "));

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "cutt.ly", "t.ly", "is.gd", "rb.gy", "shorturl.at", "clck.ru", "goo.su", "ow.ly",
  "s.id", "tiny.cc", "linkr.it", "mbg.bz", "short.gy", "v.gd", "qr.ae", "bitly.ws", "u.to", "lnkd.in", "rebrand.ly", "t.co"]);

// Markaların uygulama bağlantı servisleri (Umico, Wolt vb. reklamlarda kullanır): taklit değil, yönlendirme sayılır
const DEEPLINK = new Set(["onelink.me", "page.link", "app.link", "sng.link", "bnc.lt", "adj.st", "go.link", "smart.link"]);

const RISKY_TLDS = new Set(["top", "xyz", "icu", "online", "site", "click", "shop", "live", "buzz", "cfd", "sbs", "bond", "rest", "fun", "vip", "win", "tk", "ml", "ga", "cf", "gq", "pw", "club", "cc", "ws", "su", "cyou", "lol"]);

const HOMO = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y", "і": "i", "ј": "j", "к": "k", "м": "m", "т": "t", "в": "b", "н": "h",
  "ə": "e", "ı": "i", "ş": "s", "ç": "c", "ö": "o", "ü": "u", "ğ": "g", "0": "o", "1": "l" };

function skeleton(s) {
  return Array.from(s.toLowerCase()).map((c) => HOMO[c] ?? c).join("").replace(/rn/g, "m").replace(/vv/g, "w");
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

export const HOSTING = new Set(["github.io", "vercel.app", "pages.dev", "workers.dev", "netlify.app", "firebaseapp.com", "web.app", "weebly.com",
  "wixsite.com", "blogspot.com", "gitbook.io", "herokuapp.com", "glitch.me", "repl.co", "000webhostapp.com", "notion.site", "canva.site",
  "tilda.ws", "carrd.co", "ngrok.io", "ngrok-free.app", "onrender.com", "fly.dev", "surge.sh", "webflow.io", "framer.website"]);

export function registrable(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return host;
  // Pulsuz hostinq platformaları (PSL-dəki "private" sonluqlar kimi): hər alt domen ayrı sahibə məxsusdur
  { const l = host.split(".").filter(Boolean); if (l.length >= 3 && HOSTING.has(l.slice(-2).join("."))) return l.slice(-3).join("."); }
  const labels = host.split(".").filter(Boolean);
  if (labels.length >= 3 && SECOND_LEVEL.has(labels.slice(-2).join("."))) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

// Hamının istifadə etdiyi platformalar və qısaldıcılar: kəşfiyyat lentində bütöv host kimi gələndə nəzərə alınmır
// (məs. Blacklist.gov.az lentində google.com, docs.google.com, bit.ly var: bunlar hər Google Form-u "qara siyahı" edərdi)
const PLATFORM = new Set(["google.com", "forms.gle", "goo.gl", "g.co", "youtube.com", "youtu.be", "facebook.com", "fb.com", "instagram.com",
  "whatsapp.com", "telegram.org", "telegra.ph", "linktr.ee", "github.io", "github.com", "vercel.app", "pages.dev", "workers.dev", "netlify.app",
  "firebaseapp.com", "web.app", "weebly.com", "wixsite.com", "blogspot.com", "gitbook.io", "dropbox.com", "1drv.ms", "live.com", "microsoft.com",
  "apple.com", "icloud.com", "notion.site", "canva.site", "tilda.ws", "carrd.co"]);
export function sharedHost(host) {
  const h = String(host || "").toLowerCase().replace(/^www\./, "");
  const reg = registrable(h);
  return PLATFORM.has(h) || h.endsWith(".google.com") || MESSENGER.has(h) || SHORTENERS.has(h) || SHORTENERS.has(reg)
    || DEEPLINK.has(h) || DEEPLINK.has(reg) || OFFICIAL.has(h) || OFFICIAL.has(reg) || reg.endsWith(".gov.az");
}

export function isOfficial(host) {
  const reg = registrable(host);
  // .gov.az yalnız dövlət qurumlarına verilir
  return OFFICIAL.has(reg) || OFFICIAL.has(host) || reg.endsWith(".gov.az");
}

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'«»]+|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,24}(?::\d{2,5})?(?:\/[^\s<>"'«»]*)?/giu;

export function extractUrls(text) {
  const out = [];
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0].replace(/[.,;:!?)\]»"'…]+$/u, "");
    const start = m.index;
    if (start > 0 && /[@\p{L}\p{N}_]/u.test(text[start - 1])) continue; // e-posta ya da kelime içi
    const hasScheme = /^https?:\/\//i.test(raw) || /^www\./i.test(raw);
    const rawHost = raw.replace(/^https?:\/\//i, "").split(/[\/?#:]/)[0].toLowerCase();
    const tld = rawHost.split(".").pop();
    if (!hasScheme && !BARE_TLDS.has(tld)) continue;
    let parsed;
    try { parsed = new URL(/^https?:\/\//i.test(raw) ? raw : "http://" + raw); } catch { continue; }
    out.push({ raw, start, end: start + raw.length, host: parsed.hostname.toLowerCase(), unicodeHost: rawHost.replace(/^.*@/, ""), hasUserinfo: !!parsed.username, path: parsed.pathname });
  }
  return out;
}

function brandFromHost(unicodeHost, reg) {
  const sk = skeleton(unicodeHost);
  const compact = sk.replace(/[.\-]/g, "");
  const tokens = sk.split(/[.\-]/).filter(Boolean);
  for (const b of BRANDS) {
    for (const key of b.keys) {
      const k = key.replace(/[.\-]/g, "");
      let hit = false;
      if (k.length >= 5 && !b.exactOnly) hit = compact.includes(k);
      if (!hit) hit = tokens.includes(k);
      if (!hit && k.length >= 6) hit = tokens.some((t) => t.length >= 5 && lev(t, k, k.length >= 9 ? 2 : 1) <= (k.length >= 9 ? 2 : 1));
      if (hit) {
        const official = b.domains.some((d) => reg === d || unicodeHost === d || unicodeHost.endsWith("." + d));
        return { brand: b, official };
      }
    }
  }
  return null;
}

export function analyzeUrl(u) {
  const reg = registrable(u.host);
  const messenger = MESSENGER.has(u.host) || MESSENGER.has(reg);
  const official = !messenger && isOfficial(u.host);
  const flags = [];
  if (messenger) {
    flags.push({ code: "messenger_link", weight: 10 });
    return { raw: u.raw, start: u.start, end: u.end, host: u.host, reg, official: false, messenger: true, brand: null, flags };
  }
  const tld = u.host.split(".").pop();
  let brandHit = brandFromHost(u.unicodeHost, registrable(u.unicodeHost));
  // "https://azerpost.az@baska-site.top" hilesi: marka adı @ işaretinden önce, asıl adres sonra
  if (!brandHit && u.hasUserinfo) {
    const userinfo = u.raw.replace(/^https?:\/\//i, "").split("@")[0].toLowerCase();
    const hit = brandFromHost(userinfo, "");
    if (hit) brandHit = { brand: hit.brand, official: false };
  }
  if (DEEPLINK.has(reg)) {
    flags.push({ code: "shortener", weight: 15 });
    return { raw: u.raw, start: u.start, end: u.end, host: u.host, reg, official: false, brand: brandHit?.brand.name || null, flags };
  }
  if (!official && brandHit && !brandHit.official) {
    flags.push({ code: "brand_impersonation", weight: 40, brand: brandHit.brand.name, official: brandHit.brand.domains[0], reg });
  }
  if (SHORTENERS.has(u.host) || SHORTENERS.has(reg)) flags.push({ code: "shortener", weight: 15 });
  if (!official && RISKY_TLDS.has(tld)) flags.push({ code: "risky_tld", weight: 5, tld });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.host) || u.host.includes(":")) flags.push({ code: "ip_url", weight: 10 });
  if (u.hasUserinfo) flags.push({ code: "userinfo_url", weight: 10 });
  if (!official && u.host.split(".").some((l) => l.startsWith("xn--"))) flags.push({ code: "idn_host", weight: 10 });
  if (!official && u.host.split(".").length >= 5) flags.push({ code: "deep_subdomain", weight: 5 });
  return { raw: u.raw, start: u.start, end: u.end, host: u.host, reg, official, brand: brandHit?.brand.name || null, flags };
}

export { SHORTENERS };
