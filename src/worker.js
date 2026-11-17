// ScamShield Worker: API, Telegram webhook, panel, zamanlanmış OpenPhish yenilemesi.
import { analyze } from "./analyze.js";
import { handleTelegram, setupWebhook } from "./telegram.js";
import { recordCheck, panelData, intelLookup, refreshOpenPhish, refreshBlacklist } from "./store.js";
import { modelMetrics } from "./model.js";
import { checkLinks } from "./linkcheck.js";
import { screenshot, toBase64 } from "./shot.js";
import { botUsername, resetBotCache } from "./tgapi.js";
import { todayData } from "./today.js";
import { quizStart, quizAnswer, quizFinish, quizLeaders, quizDeleteNick } from "./quizapi.js";
import { transcribe, meaningful, MAX_BYTES } from "./voice.js";
import { parsePhone, phoneOnly, shortTextPhone, phoneVerdict, phoneKey, phoneCounts, addUserReport, recordPhoneSightings } from "./phone.js";
import { maskPII } from "./mask.js";
import { sharedHost } from "./url.js";
import metrics from "../data/metrics.json" with { type: "json" };

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });

// İzolat başına basit hız sınırı: IP başına dakikada 20 analiz
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.t > 60_000) { hits.set(ip, { t: now, n: 1 }); return false; }
  e.n++;
  if (hits.size > 5000) hits.clear();
  return e.n > 20;
}

function authorized(request, env) {
  const key = request.headers.get("x-panel-key") || "";
  return env.PANEL_KEY && key.length === env.PANEL_KEY.length && key === env.PANEL_KEY;
}

// --- İcma bildirişləri: moderasiya növbəsi. Heç nə avtomatik dərc olunmur; göndərənin IP-si yalnız HMAC izi kimi qalır.
const REPORT_TYPES = new Set(["phone", "website", "message", "campaign"]);
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
let reportsReady = false;
async function ensureReportsTable(env) {
  if (reportsReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS community_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL,
      note TEXT, reporter TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending')`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_community_reports ON community_reports (status, ts)"),
  ]);
  reportsReady = true;
}
async function reporterKey(env, ip) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(env.PHONE_PEPPER || env.PANEL_KEY || "scamshield"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode("crep:" + ip)));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function reportHost(v) {
  try { return new URL(/^https?:\/\//i.test(v) ? v : "http://" + v).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

function csv(rows) {
  const head = ["label", "brand", "domain", "count", "max_score", "first_seen", "last_seen", "flags"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [head.join(","), ...rows.map((r) => [r.label, r.brand, r.domain, r.count, r.max_score,
    new Date(r.first_seen).toISOString(), new Date(r.last_seen).toISOString(), r.flags].map(esc).join(","))].join("\n");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/tg/")) {
      if (request.method !== "POST" || !env.TG_PATH || path !== `/tg/${env.TG_PATH}`) return new Response("not found", { status: 404 });
      return handleTelegram(request, env, ctx);
    }

    if (path === "/api/analyze" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      if (rateLimited(ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
      if (Number(request.headers.get("content-length") || 0) > 16_000) return json({ error: "Mətn çox uzundur." }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      const text = typeof body?.text === "string" ? body.text : "";
      if (!text.trim()) return json({ error: "Mətn boşdur." }, 400);
      // Yalnız telefon nömrəsi yazılıbsa: nömrə yoxlanışı
      const ph = phoneOnly(text) || shortTextPhone(text);
      if (ph) {
        const key = await phoneKey(env, ph);
        const counts = key ? await phoneCounts(env, key).catch(() => ({ user: 0, message: 0 })) : { user: 0, message: 0 };
        return json(phoneVerdict(ph, counts));
      }
      const r = await analyze(text, { env, intelLookup: (h) => intelLookup(env, h), linkCheck: (u) => checkLinks(u, env) });
      ctx.waitUntil(recordCheck(env, body?.channel === "qr" ? "qr" : "web", r).catch((e) => console.error("record", e)));
      if (r.band === "high") ctx.waitUntil(recordPhoneSightings(env, text, "ip:" + ip).catch((e) => console.error("phone", e)));
      return json(r);
    }

    if (path === "/api/phone/report" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      if (rateLimited("rep:" + ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      const p = parsePhone(String(body?.number || ""));
      if (!p || !(p.kind === "az" || p.kind === "intl")) return json({ error: "Bu nömrəni bildirmək olmur." }, 400);
      const key = await phoneKey(env, p);
      const res = await addUserReport(env, key, "ip:" + ip);
      return json({ ok: true, dup: res === "dup", reports: await phoneCounts(env, key) });
    }

    // İcma bildirişi: moderasiya növbəsinə düşür (panel), avtomatik dərc olunmur
    if (path === "/api/community/report" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      if (rateLimited("crep:" + ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
      if (Number(request.headers.get("content-length") || 0) > 8000) return json({ error: "Bildiriş çox uzundur." }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      // Spam qoruması: gizli sahə doldurulubsa və ya forma insan üçün çox tez göndərilibsə, heç nə yazmadan "qəbul edildi" deyirik
      if (body?.company || Number(body?.elapsed || 0) < 2500) return json({ ok: true });
      const type = String(body?.type || "");
      const raw = String(body?.value || "").replace(INVISIBLE, "").trim();
      if (!REPORT_TYPES.has(type) || !raw || raw.length > 1000) return json({ error: "Bildirişi düzgün doldurun." }, 400);
      let value;
      if (type === "phone") {
        const p = parsePhone(raw);
        if (!p || !(p.kind === "az" || p.kind === "intl")) return json({ error: "Nömrəni ölkə kodu ilə yazın. Məsələn: +994 50 123 45 67" }, 400);
        value = p.display;
      } else if (type === "website") {
        const h = reportHost(raw);
        if (!h || !h.includes(".") || /\s/.test(raw)) return json({ error: "Saytın ünvanını düzgün yazın. Məsələn: sayt.az" }, 400);
        value = raw.slice(0, 300);
      } else {
        if (raw.length < 15) return json({ error: "Mətn çox qısadır." }, 400);
        value = maskPII(raw).text; // göndərənin öz kartı, telefonu, kodu bazaya düşməsin
      }
      const note = maskPII(String(body?.note || "").replace(INVISIBLE, "").trim().slice(0, 500)).text || null;
      await ensureReportsTable(env);
      const reporter = await reporterKey(env, ip);
      const since = Date.now() - 24 * 3600 * 1000;
      const dup = await env.DB.prepare("SELECT id FROM community_reports WHERE reporter = ?1 AND type = ?2 AND value = ?3 AND ts >= ?4").bind(reporter, type, value, since).first();
      if (dup) return json({ ok: true, dup: true });
      const daily = await env.DB.prepare("SELECT COUNT(*) AS n FROM community_reports WHERE reporter = ?1 AND ts >= ?2").bind(reporter, since).first();
      if ((daily?.n || 0) >= 20) return json({ error: "Bu gün çox bildiriş göndərmisiniz. Sabah yenidən cəhd edin." }, 429);
      await env.DB.prepare("INSERT INTO community_reports (ts, type, value, note, reporter, status) VALUES (?1, ?2, ?3, ?4, ?5, 'pending')")
        .bind(Date.now(), type, value, note, reporter).run();
      return json({ ok: true });
    }

    if (path === "/api/shot" && request.method === "POST") {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      if (rateLimited("shot:" + ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      const r = await screenshot(env, String(body?.url || ""), ctx);
      if (!r.ok) return json({ ok: false, reason: r.reason, detail: r.detail || null });
      let finalHost = null;
      try { finalHost = new URL(r.finalUrl).hostname; } catch { /* yok */ }
      return json({ ok: true, image: "data:image/jpeg;base64," + toBase64(r.image), finalHost, title: r.title, cached: !!r.cached });
    }

    // Təhlükəni aşkar et (oyun): xal serverdə, cavablar serverdə
    if (path.startsWith("/api/quiz/")) {
      const ip = request.headers.get("cf-connecting-ip") || "local";
      if (path === "/api/quiz/leaders" && request.method === "GET") {
        return json(await quizLeaders(env, { company: url.searchParams.get("company") || "", month: url.searchParams.get("month") || "" }));
      }
      if (request.method !== "POST") return json({ error: "Yanlış sorğu." }, 405);
      if (path === "/api/quiz/start") {
        if (rateLimited("quiz:" + ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
        return json(await quizStart(env));
      }
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      if (path === "/api/quiz/answer") { const r = await quizAnswer(env, body); return json(r.data, r.status); }
      if (path === "/api/quiz/finish") {
        if (rateLimited("qf:" + ip)) return json({ error: "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." }, 429);
        const r = await quizFinish(env, body);
        return json(r.data, r.status);
      }
      return json({ error: "Tapılmadı." }, 404);
    }

    if (path === "/api/config") {
      return json({ bot: await botUsername(env) });
    }

    if (path === "/api/today") {
      let d = { total: 0, high: 0, items: [] };
      try { d = await todayData(env); } catch (e) { console.error("today", e); }
      return new Response(JSON.stringify(d), { headers: { ...JSON_HEADERS, "cache-control": "public, max-age=15" } });
    }

    if (path === "/api/metrics") {
      return json({ model: modelMetrics, pipeline: metrics.pipeline, pipeline_high: metrics.pipeline_high, pipeline_rules: metrics.pipeline_rules });
    }

    if (path === "/api/panel") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      return json(await panelData(env));
    }

    if (path === "/api/report") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      const data = await panelData(env);
      if (url.searchParams.get("format") === "csv") {
        return new Response(csv(data.campaigns), {
          headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="scamshield-kampaniyalar.csv"', "cache-control": "no-store" },
        });
      }
      return new Response(JSON.stringify({ generated: new Date().toISOString(), source: "ScamShield", ...data }, null, 2), {
        headers: { ...JSON_HEADERS, "content-disposition": 'attachment; filename="scamshield-hesabat.json"' },
      });
    }

    if (path === "/api/admin/reset" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      await ensureReportsTable(env);
      await env.DB.batch(["checks", "campaigns", "phone_reports", "quiz_scores", "quiz_sessions", "community_reports"].map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
      return json({ ok: true });
    }

    // Moderasiya növbəsi (panel): son 50 bildiriş, əvvəlcə gözləyənlər
    if (path === "/api/admin/reports" && request.method === "GET") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      await ensureReportsTable(env);
      const rows = await env.DB.prepare("SELECT id, ts, type, value, note, status FROM community_reports ORDER BY (status = 'pending') DESC, ts DESC LIMIT 50").all();
      return json({ items: rows.results || [] });
    }

    // Moderator qərarı. Təsdiqlənən sayt təhdid bazasına düşür: sonrakı yoxlamalarda «fırıldaq siyahısında» görünür.
    if (path === "/api/admin/reports/status" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      const id = Number(body?.id);
      const status = body?.status;
      if (!Number.isInteger(id) || !["approved", "rejected"].includes(status)) return json({ error: "Yanlış sorğu." }, 400);
      await ensureReportsTable(env);
      const row = await env.DB.prepare("SELECT type, value FROM community_reports WHERE id = ?1").bind(id).first();
      if (!row) return json({ error: "Tapılmadı." }, 404);
      await env.DB.prepare("UPDATE community_reports SET status = ?1 WHERE id = ?2").bind(status, id).run();
      let intel = false;
      if (status === "approved" && row.type === "website") {
        const h = reportHost(row.value);
        if (h && h.includes(".") && !sharedHost(h)) {
          await env.DB.prepare("INSERT OR IGNORE INTO intel_hosts (host, source, ts) VALUES (?1, 'community', ?2)").bind(h, Date.now()).run();
          intel = true;
        }
      }
      return json({ ok: true, intel });
    }

    // Səs boru xəttinin sınağı (yalnız panel açarı ilə): gövdə = səs faylı → Whisper → analiz. Heç nə saxlanılmır.
    if (path === "/api/admin/voice-test" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) return json({ error: "Səs faylı boşdur və ya 5 MB-dan böyükdür." }, 400);
      const t0 = Date.now();
      const tr = await transcribe(env, bytes);
      const r = meaningful(tr.text) ? await analyze(tr.text, { env, intelLookup: (h) => intelLookup(env, h) }) : null;
      return json({ model: tr.model, ms: Date.now() - t0, text: tr.text, meaningful: meaningful(tr.text), score: r?.score ?? null, band: r?.band ?? null });
    }

    // Cədvəldən ləqəb silmək (söyüş, təqlid): POST {nick}
    if (path === "/api/admin/quiz/delete" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Yanlış sorğu." }, 400); }
      return json({ ok: true, deleted: await quizDeleteNick(env, body?.nick) });
    }

    if (path === "/api/admin/setup" && request.method === "POST") {
      if (!authorized(request, env)) return json({ error: "İcazə yoxdur." }, 401);
      const out = { openphish: null, telegram: null };
      try { out.openphish = await refreshOpenPhish(env); } catch (e) { out.openphish = "xəta: " + e.message; }
      try { out.blacklist = await refreshBlacklist(env); } catch (e) { out.blacklist = "xəta: " + e.message; }
      if (env.TELEGRAM_TOKEN && env.TELEGRAM_SECRET && env.TG_PATH) {
        resetBotCache();
        out.telegram = await setupWebhook(env, url.origin);
      }
      return json(out);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    // Blacklist.gov.az lenti gündə bir dəfə (00:17 UTC işə düşəndə) və yalnız dəyişibsə yazılır
    const daily = new Date(event.scheduledTime || Date.now()).getUTCHours() < 6;
    ctx.waitUntil(refreshOpenPhish(env).catch((e) => console.error("openphish", e)).then(() => (daily ? refreshBlacklist(env) : null)).catch((e) => console.error("blacklist", e)));
  },
};
