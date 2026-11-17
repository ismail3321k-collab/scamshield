// İcma bildirişi və moderasiya növbəsi testi (sahte D1, şəbəkəsiz). Kullanım: node tools/community-test.mjs
import worker from "../src/worker.js";
import { fakeD1 } from "./fake-d1.mjs";

const env = { DB: fakeD1(), PANEL_KEY: "test-key", PHONE_PEPPER: "pepper", ASSETS: { fetch: async () => new Response("asset") } };
const ctx = { waitUntil() {} };
let ok = 0, fail = 0;
const check = (name, cond, extra = "") => { if (cond) ok++; else { fail++; console.log("FAIL", name, extra); } };

const call = async (path, { method = "GET", body, ip = "1.2.3.4", key } = {}) => {
  const headers = { "content-type": "application/json", "cf-connecting-ip": ip };
  if (key) headers["x-panel-key"] = key;
  const res = await worker.fetch(new Request("https://x.test" + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env, ctx);
  return { status: res.status, data: await res.json().catch(() => null) };
};
const rep = (body, ip) => call("/api/community/report", { method: "POST", body: { elapsed: 9000, ...body }, ip });
const rows = () => env.DB._db.prepare("SELECT * FROM community_reports ORDER BY id").all();

// 1. Düzgün bildirişlər növbəyə düşür
check("phone ok", (await rep({ type: "phone", value: "+995 55 000 12 34" })).data?.ok === true);
check("website ok", (await rep({ type: "website", value: "azerpost-catdirilma.top" })).data?.ok === true);
check("message masked", (await rep({ type: "message", value: "Kartınız bloklandı, kodu deyin: kod 482913, kart 4169 7388 1234 5678" })).data?.ok === true);
const r1 = rows();
check("3 rows pending", r1.length === 3 && r1.every((r) => r.status === "pending"), JSON.stringify(r1));
check("phone normalized", r1[0].value.startsWith("+995"), r1[0].value);
check("code masked", r1[2] && !r1[2].value.includes("482913") && r1[2].value.includes("[KOD]"), r1[2]?.value);
check("reporter hashed", r1.every((r) => /^[0-9a-f]{32}$/.test(r.reporter) && !r.reporter.includes("1.2.3.4")));

// 2. Yoxlama və spam qoruması
check("bad phone 400", (await rep({ type: "phone", value: "salam" })).status === 400);
check("bad site 400", (await rep({ type: "website", value: "bu sayt deyil" })).status === 400);
check("short msg 400", (await rep({ type: "message", value: "qısa" })).status === 400);
check("bad type 400", (await rep({ type: "spam", value: "azerpost.top" })).status === 400);
const before = rows().length;
check("honeypot silent", (await rep({ type: "website", value: "spam-bot.top", company: "x" })).data?.ok === true && rows().length === before);
check("too fast silent", (await call("/api/community/report", { method: "POST", body: { type: "website", value: "fast-bot.top", elapsed: 300 } })).data?.ok === true && rows().length === before);
check("dup ignored", (await rep({ type: "website", value: "azerpost-catdirilma.top" })).data?.dup === true && rows().length === before);

// 3. Panel: açarsız 401, açarla siyahı, təsdiq → intel_hosts
check("queue 401", (await call("/api/admin/reports")).status === 401);
const q = await call("/api/admin/reports", { key: "test-key" });
check("queue list", q.data?.items?.length === 3, JSON.stringify(q.data));
check("queue hides reporter", q.data?.items?.every((x) => !("reporter" in x)));
const site = q.data.items.find((x) => x.type === "website");
const ap = await call("/api/admin/reports/status", { method: "POST", key: "test-key", body: { id: site.id, status: "approved" } });
check("approve ok", ap.data?.ok === true && ap.data?.intel === true, JSON.stringify(ap.data));
const intel = env.DB._db.prepare("SELECT * FROM intel_hosts WHERE host = 'azerpost-catdirilma.top'").get();
check("intel added", intel?.source === "community", JSON.stringify(intel));
const ph = q.data.items.find((x) => x.type === "phone");
const rj = await call("/api/admin/reports/status", { method: "POST", key: "test-key", body: { id: ph.id, status: "rejected" } });
check("reject ok", rj.data?.ok === true && rj.data?.intel === false);
check("bad status 400", (await call("/api/admin/reports/status", { method: "POST", key: "test-key", body: { id: ph.id, status: "publish" } })).status === 400);

// 4. Platforma domeni təsdiqlənsə də təhdid bazasına düşmür
await rep({ type: "website", value: "docs.google.com/forms/abc" }, "5.6.7.8");
const g = (await call("/api/admin/reports", { key: "test-key" })).data.items.find((x) => x.value.startsWith("docs.google.com"));
check("shared host not intel", (await call("/api/admin/reports/status", { method: "POST", key: "test-key", body: { id: g.id, status: "approved" } })).data?.intel === false);

// 5. Reset növbəni də təmizləyir
check("reset ok", (await call("/api/admin/reset", { method: "POST", key: "test-key" })).data?.ok === true && rows().length === 0);

console.log(`community-test: ${ok}/${ok + fail}`);
process.exit(fail ? 1 : 0);
