const $ = (id) => document.getElementById(id);

let key = new URLSearchParams(location.search).get("key") || sessionGet() || "";
if (new URLSearchParams(location.search).has("key")) history.replaceState(null, "", "/panel");

function sessionGet() { try { return sessionStorage.getItem("ayiq-key"); } catch { return null; } }
function sessionSet(v) { try { sessionStorage.setItem("ayiq-key", v); } catch { /* yok */ } }

const seen = new Map(); // kampanya id → count
let first = true;

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} san əvvəl`;
  if (s < 3600) return `${Math.round(s / 60)} dəq əvvəl`;
  if (s < 86400) return `${Math.round(s / 3600)} saat əvvəl`;
  return new Date(ts).toLocaleDateString("az-AZ");
}

function time(ts) { return new Date(ts).toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

const FLAG_AZ = {
  brand_impersonation: "brend təqlidi", intel_hit: "fırıldaq siyahısında", shortener: "qısa link", risky_tld: "riskli zona",
  veri_talebi: "məlumat tələbi", hesap_ele_gecirme: "kod tələbi", banka_taklidi: "bank adından", aciliyet: "təcililik",
  odul: "hədiyyə vədi", is_teklifi: "asan qazanc", yardim: "yardım bəhanəsi", kargo: "bağlama bəhanəsi", injection: "manipulyasiya cəhdi",
  messenger_link: "Telegram/WhatsApp linki", ml_high: "model: yüksək oxşarlıq", unknown_link: "naməlum link",
  pul_talebi: "pul tələbi", qohum_taklidi: "yaxın adından", investisiya: "yatırım vədi", new_domain: "təzə domen",
  young_domain: "təzə domen", domain_not_registered: "silinmiş domen", scam_app_path: "fırıldaq tətbiqi linki",
  page_card_form: "saytda kart forması", page_password: "saytda şifrə forması", page_scam_app: "fırıldaq tətbiqi saytı",
  brand_link_mismatch: "brend adı, yad link", redirect_other: "başqa sayta yönləndirmə", idn_host: "oxşar hərflər",
  userinfo_url: "@ hiyləsi", ip_url: "IP ünvanlı link", vt_malicious: "VirusTotal: zərərli", vt_info: "VirusTotal yoxlandı", phone_lookalike: "+995 saxta nömrə",
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function api(path) {
  const res = await fetch(path, { headers: { "x-panel-key": key } });
  if (res.status === 401) throw new Error("auth");
  if (!res.ok) throw new Error("http");
  return res;
}

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function animateNum(node, to) {
  const from = Number(node.textContent) || 0;
  if (from === to || reduced) { node.textContent = to; return; }
  const t0 = performance.now(), dur = 600;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  node.parentElement.classList.remove("bump");
  void node.offsetWidth;
  node.parentElement.classList.add("bump");
}

function renderCamps(list) {
  const box = $("camps");
  if (!list.length) { box.replaceChildren(el("p", "empty", "Hələ kampaniya yoxdur. Şübhəli mesaj yoxlanılan kimi burada görünəcək.")); return; }
  const nodes = list.map((c) => {
    const d = el("div", "camp");
    const t = el("div", "t");
    t.append(el("span", "", c.label || "Şübhəli mesaj"), el("span", "n", `${c.count} bildiriş`));
    const flags = (c.flags || "").split(",").map((f) => FLAG_AZ[f]).filter(Boolean);
    const info = [c.domain ? `domen: ${c.domain}` : null, `ən yüksək bal: ${c.max_score}`, `ilk: ${ago(c.first_seen)}`, `son: ${ago(c.last_seen)}`].filter(Boolean).join(" · ");
    d.append(t, el("div", "d", info));
    if (flags.length) d.append(el("div", "d", "Əlamətlər: " + [...new Set(flags)].join(", ")));
    if (c.domain) {
      const links = el("div", "d bl-links");
      const rep = el("a", "", "Blacklist.gov.az-a bildir");
      rep.href = "https://blacklist.gov.az/report";
      const chk = el("a", "", "qara siyahıda yoxla");
      chk.href = "https://blacklist.gov.az/search?search=" + encodeURIComponent(c.domain);
      for (const a of [rep, chk]) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      links.append(rep, document.createTextNode(" · "), chk);
      d.append(links);
    }
    const prev = seen.get(c.id);
    if (!first && (prev === undefined || prev !== c.count)) {
      d.classList.add("flash");
      if (prev === undefined) d.classList.add("slidein");
      setTimeout(() => d.classList.remove("flash", "slidein"), 2500);
    }
    seen.set(c.id, c.count);
    return d;
  });
  box.replaceChildren(...nodes);
}

function renderRecent(list) {
  $("recent").replaceChildren(...list.map((r) => {
    const tr = el("tr");
    const band = el("td", "num tag-" + r.band, String(r.score));
    tr.append(el("td", "num", time(r.ts)), el("td", "", r.channel === "telegram" ? "Telegram" : r.channel === "voice" ? "Səs" : r.channel === "qr" ? "QR" : "Veb"), band,
      el("td", "", r.brand || "—"), el("td", "hide-sm", r.domain || "—"));
    return tr;
  }));
}

// İcma bildirişləri: moderasiya növbəsi (təsdiqlənən sayt təhdid bazasına düşür)
const TYPE_AZ = { phone: "Telefon nömrəsi", website: "Veb-sayt", message: "Fırıldaq mesajı", campaign: "Fişinq kampaniyası" };
const STATUS_AZ = { pending: ["gözləyir", "tag-suspicious"], approved: ["təsdiqləndi", "tag-safe"], rejected: ["rədd edildi", "tag-high"] };
async function loadQueue() {
  try {
    const d = await (await api("/api/admin/reports")).json();
    renderQueue(d.items || []);
  } catch (e) {
    if (e.message !== "auth") $("queue").replaceChildren(el("p", "empty", "Növbəni yükləmək alınmadı."));
  }
}
async function decide(id, status, btn) {
  btn.disabled = true;
  try {
    const res = await fetch("/api/admin/reports/status", { method: "POST", headers: { "x-panel-key": key, "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (!res.ok) throw new Error("http");
    loadQueue();
  } catch {
    btn.disabled = false;
  }
}
function renderQueue(items) {
  if (!items.length) { $("queue").replaceChildren(el("p", "empty", "Gözləyən bildiriş yoxdur.")); return; }
  $("queue").replaceChildren(...items.map((r) => {
    const d = el("div", "q-item");
    const t = el("div", "t");
    const [st, cls] = STATUS_AZ[r.status] || STATUS_AZ.pending;
    t.append(el("span", "", TYPE_AZ[r.type] || r.type), el("span", cls, st));
    d.append(t, el("div", "v", r.value));
    if (r.note) d.append(el("div", "d", "İzah: " + r.note));
    d.append(el("div", "d", ago(r.ts)));
    if (r.status === "pending") {
      const tools = el("div", "tools");
      tools.style.marginTop = "10px";
      const ok = el("button", "btn btn-sm btn-secondary", r.type === "website" ? "Təsdiqlə (təhdid bazasına əlavə et)" : "Təsdiqlə");
      const no = el("button", "btn btn-sm btn-ghost", "Rədd et");
      ok.type = no.type = "button";
      ok.addEventListener("click", () => decide(r.id, "approved", ok));
      no.addEventListener("click", () => decide(r.id, "rejected", no));
      tools.append(ok, no);
      d.append(tools);
    }
    return d;
  }));
}

async function refresh() {
  try {
    const data = await (await api("/api/panel")).json();
    animateNum($("sTotal"), data.stats.total);
    animateNum($("sHigh"), data.stats.high);
    animateNum($("sCamp"), data.stats.activeCampaigns);
    renderCamps(data.campaigns);
    renderRecent(data.recent);
    $("live").textContent = "Canlı · son yenilənmə " + time(Date.now());
    first = false;
  } catch (e) {
    if (e.message === "auth") { showLogin("Açar yanlışdır."); return; }
    $("live").textContent = "Bağlantı xətası, yenidən cəhd edilir…";
  }
}

async function loadMetrics() {
  const m = await (await fetch("/api/metrics")).json();
  const box = $("metrics");
  box.className = "";
  const rows = [];
  if (m.pipeline) rows.push(["ScamShield (qaydalar + model)", m.pipeline]);
  if (m.pipeline_rules) rows.push(["Yalnız qaydalar", m.pipeline_rules]);
  if (m.model?.holdout) rows.push(["Yalnız model", m.model.holdout]);
  const table = el("table");
  const head = el("tr");
  ["Üsul", "Test mesajı", "Dəqiqlik (precision)", "Tutma (recall)", "Yanlış həyəcan"].forEach((h) => head.append(el("th", "", h)));
  const thead = el("thead"); thead.append(head);
  const tbody = el("tbody");
  for (const [name, x] of rows) {
    const tr = el("tr");
    tr.append(el("td", "", name), el("td", "num", String(x.n)), el("td", "num", (x.precision * 100).toFixed(1) + "%"),
      el("td", "num", (x.recall * 100).toFixed(1) + "%"), el("td", "num", (x.fpr * 100).toFixed(1) + "%"));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const note = el("p", "empty", "Test: AZ-SC açıq Azərbaycan SMS dəstinin modelə göstərilməmiş 20%-i.");
  box.replaceChildren(table, note);
}

async function download(format) {
  const res = await api("/api/report" + (format === "csv" ? "?format=csv" : ""));
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = format === "csv" ? "scamshield-kampaniyalar.csv" : "scamshield-hesabat.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function showLogin(err) {
  $("app").hidden = true;
  $("login").hidden = false;
  $("loginErr").textContent = err || "";
  $("loginErr").hidden = !err;
}

$("keyform").addEventListener("submit", (e) => {
  e.preventDefault();
  key = $("key").value.trim();
  sessionSet(key);
  start();
});
$("dlCsv").addEventListener("click", () => download("csv"));
$("dlJson").addEventListener("click", () => download("json"));

function start() {
  if (!key) { showLogin(); return; }
  sessionSet(key);
  $("login").hidden = true;
  $("app").hidden = false;
  refresh();
  loadQueue();
  loadMetrics().catch(() => {});
  clearInterval(window.__t);
  window.__t = setInterval(refresh, 3000);
  clearInterval(window.__q);
  window.__q = setInterval(loadQueue, 15000);
}
start();
