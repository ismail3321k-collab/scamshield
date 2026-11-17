// D1: yoxlamalar (mesaj mətni YOX), kampaniyalar, OpenPhish hostları.
import { sharedHost } from "./url.js";

export async function recordCheck(env, channel, r) {
  if (!env.DB) return;
  const now = Date.now();
  let campaignId = null;
  if (r.campaign) {
    await env.DB.prepare(
      `INSERT INTO campaigns (key, label, brand, domain, first_seen, last_seen, count, max_score, flags)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, 1, ?6, ?7)
       ON CONFLICT(key) DO UPDATE SET last_seen = ?5, count = count + 1, max_score = MAX(max_score, ?6), flags = ?7`
    ).bind(r.campaign.key, r.campaign.label, r.brand, r.campaign.domain, now, r.score, [...r.flags, ...(r.campaign.evidence ? ["domain_evidence"] : [])].join(",")).run();
    const row = await env.DB.prepare("SELECT id FROM campaigns WHERE key = ?1").bind(r.campaign.key).first();
    campaignId = row?.id ?? null;
  }
  await env.DB.prepare(
    "INSERT INTO checks (ts, channel, score, band, flags, domain, brand, campaign_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
  ).bind(now, channel, r.score, r.band, r.flags.join(","), r.campaign?.domain ?? null, r.brand, campaignId).run();
}

export async function panelData(env) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.getTime() - 4 * 3600 * 1000; // Bakı günü (UTC+4)
  const [stats, campaigns, recent] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN band = 'high' THEN 1 ELSE 0 END) AS high,
              SUM(CASE WHEN band = 'suspicious' THEN 1 ELSE 0 END) AS suspicious
       FROM checks WHERE ts >= ?1`
    ).bind(since).first(),
    env.DB.prepare("SELECT id, label, brand, domain, first_seen, last_seen, count, max_score, flags FROM campaigns ORDER BY last_seen DESC LIMIT 30").all(),
    env.DB.prepare("SELECT ts, channel, score, band, brand, domain FROM checks ORDER BY ts DESC LIMIT 15").all(),
  ]);
  const active = await env.DB.prepare("SELECT COUNT(*) AS n FROM campaigns WHERE last_seen >= ?1").bind(Date.now() - 24 * 3600 * 1000).first();
  return {
    stats: { total: stats?.total || 0, high: stats?.high || 0, suspicious: stats?.suspicious || 0, activeCampaigns: active?.n || 0 },
    campaigns: campaigns.results || [],
    recent: recent.results || [],
  };
}

// host → mənbə ('openphish' | 'blacklist_gov_az')
export async function intelLookup(env, hosts) {
  const map = new Map();
  if (!env.DB || !hosts.length) return map;
  const uniq = [...new Set(hosts)].slice(0, 20);
  const q = `SELECT host, source FROM intel_hosts WHERE host IN (${uniq.map((_, i) => "?" + (i + 1)).join(",")})`;
  const res = await env.DB.prepare(q).bind(...uniq).all();
  for (const r of res.results || []) map.set(r.host, r.source);
  return map;
}

// Blacklist.gov.az açıq lenti (hosts faylı). Yalnız təmiz host adlarını götürürük: "?…" və ya "%" olan
// sətirlər konkret linkdir, bütün domeni qaralamamaq üçün atılır. Eyni host OpenPhish-də də varsa, yerli mənbə üstün tutulur.
export function parseBlacklistFeed(text) {
  const hosts = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim().toLowerCase();
    if (!line || line.startsWith("#")) continue;
    const h = line.split(/\s+/).pop();
    const host = h.replace(/^www\./, "");
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host.length <= 253 && !sharedHost(host)) hosts.add(host);
  }
  return [...hosts];
}

export async function refreshBlacklist(env) {
  const res = await fetch("https://blacklist.gov.az/download/threatfeed", {
    headers: { "user-agent": "Mozilla/5.0 (compatible; ayiq-hackathon/1.0)", accept: "text/plain,*/*" },
  });
  if (!res.ok) return `http ${res.status}`;
  const body = await res.text();
  const list = parseBlacklistFeed(body).slice(0, 10000);
  if (list.length < 100) return `qısa cavab: ${list.length} host, ${body.length} bayt`; // köhnə siyahını silmirik
  // Lent dəyişməyibsə yenidən yazmırıq (D1 yazı limitinə qənaət)
  const date = (body.match(/Latest update at:\s*([^\r\n]+)/) || [])[1] || String(list.length);
  try {
    const prev = await env.DB.prepare("SELECT value FROM meta WHERE key = 'blacklist_feed_date'").first();
    if (prev?.value === date) return `dəyişməyib (${date})`;
  } catch { /* meta cədvəli yoxdur */ }
  const now = Date.now();
  const stmts = [env.DB.prepare("DELETE FROM intel_hosts WHERE source = 'blacklist_gov_az'")];
  for (const h of list) stmts.push(env.DB.prepare("INSERT OR REPLACE INTO intel_hosts (host, source, ts) VALUES (?1, 'blacklist_gov_az', ?2)").bind(h, now));
  for (let i = 0; i < stmts.length; i += 500) await env.DB.batch(stmts.slice(i, i + 500));
  try { await env.DB.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('blacklist_feed_date', ?1)").bind(date).run(); } catch { /* yox */ }
  return list.length;
}

export async function refreshOpenPhish(env) {
  const res = await fetch("https://openphish.com/feed.txt", { headers: { "user-agent": "ayiq-hackathon/1.0" } });
  if (!res.ok) return 0;
  const text = await res.text();
  const hosts = new Set();
  for (const line of text.split("\n")) {
    try { hosts.add(new URL(line.trim()).hostname.toLowerCase()); } catch { /* boş satır */ }
  }
  const list = [...hosts].slice(0, 5000);
  const now = Date.now();
  const stmts = [env.DB.prepare("DELETE FROM intel_hosts WHERE source = 'openphish'")];
  for (const h of list) stmts.push(env.DB.prepare("INSERT OR IGNORE INTO intel_hosts (host, source, ts) VALUES (?1, 'openphish', ?2)").bind(h, now));
  for (let i = 0; i < stmts.length; i += 500) await env.DB.batch(stmts.slice(i, i + 500));
  return list.length;
}
