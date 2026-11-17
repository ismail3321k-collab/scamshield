// ScamShield ana səhifəsi: təhlil paneli, nəticə paneli, sayt reputasiyası, təhdid lenti, akademiya, bildiriş.
// Analiz məntiqi serverdədir (/api/analyze); burada yalnız göstərmə və yoxlama addımları var.
import { LESSONS, LEVELS } from "/academy.js";

const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SVG_NS = "http://www.w3.org/2000/svg";
const pad = (n) => String(n).padStart(2, "0");
const hms = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fullDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${hms(d)}`;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function icon(name, cls = "ic") {
  const s = document.createElementNS(SVG_NS, "svg");
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  const u = document.createElementNS(SVG_NS, "use");
  u.setAttribute("href", "/icons.svg#" + name);
  s.append(u);
  return s;
}
function badge(text, lv) {
  const b = el("span", "badge lv-" + lv);
  b.append(el("span", "dot"), el("span", "", text));
  return b;
}
function toast(text) {
  const box = $("toast");
  $("toastText").textContent = text;
  box.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => box.classList.remove("show"), 3800);
}
async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  let data = {};
  try { data = await res.json(); } catch { /* boş cavab */ }
  if (!res.ok) {
    const err = new Error(data.error || (res.status === 429 ? "Çox sorğu. Bir dəqiqə sonra yenidən yoxlayın." : "Xəta baş verdi. Yenidən cəhd edin."));
    err.status = res.status;
    throw err;
  }
  return data;
}
const netMsg = (e) => (e instanceof TypeError ? "Bağlantı xətası. İnterneti yoxlayıb yenidən cəhd edin." : e.message || "Xəta baş verdi. Yenidən cəhd edin.");

/* =====================================================================
   1. Təhlil paneli
   ===================================================================== */
const MODES = {
  msg: { label: "SMS və ya WhatsApp mesajı", ph: "Məsələn: Azərpoçt: Bağlamanız saxlanılıb, ünvanınızı 24 saat ərzində yeniləyin…", hint: "Mesajı olduğu kimi yapışdırın.", rows: 6, btn: "Təhlil et" },
  url: { label: "Şübhəli link", ph: "Məsələn: azerpost-catdirilma.top/unvan", hint: "Linki tam kopyalayın: saytı sizin yerinizə biz açıb yoxlayırıq.", rows: 3, btn: "Linki yoxla" },
  phone: { label: "Telefon nömrəsi", ph: "Məsələn: +995 55 000 12 34", hint: "Zəng edən və ya yazan nömrəni ölkə kodu ilə yazın.", rows: 2, btn: "Nömrəni yoxla" },
  qr: {},
};

const STEPS = ["Şəxsi məlumatlar gizlədilir", "Linklər yoxlanılır", "Fırıldaq ifadələri axtarılır", "Model qiymətləndirir", "Süni intellekt yoxlayır"];
const PHONE_STEPS = ["Nömrə tanınır", "Ölkə kodu yoxlanılır", "İstifadəçi bildirişləri axtarılır"];
const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
const looksPhone = (s) => /^[+*]?[\d\s\-().]{3,30}#?$/.test(s.replace(INVISIBLE, ""));
const DOMAIN_RE = /(?:https?:\/\/)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}]{2,24}|\b\d{1,3}(?:\.\d{1,3}){3}\b/u;

const msg = $("msg");
const btn = $("check");
let mode = "msg";
let busy = false;

function setCount() { $("count").textContent = `${msg.value.length} / 2000`; }

function applyModeTexts() {
  if (mode === "qr") return;
  const c = MODES[mode];
  $("msgLabel").textContent = c.label;
  $("msgHint").textContent = c.hint;
  $("checkLabel").textContent = busy ? "Təhlil edilir…" : c.btn;
  msg.placeholder = c.ph;
  msg.rows = c.rows;
  msg.classList.toggle("short", mode !== "msg");
}

function setMode(m, focus = false) {
  mode = m;
  document.querySelectorAll(".tab").forEach((b) => {
    const on = b.dataset.mode === m;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  $("anPanel").setAttribute("aria-labelledby", "tab-" + m);
  const qr = m === "qr";
  $("textField").hidden = qr;
  $("qrField").hidden = !qr;
  $("anActions").hidden = qr;
  msg.removeAttribute("aria-invalid");
  showError("");
  applyModeTexts();
  if (focus) (qr ? $("qr") : msg).focus();
}

const tabs = [...document.querySelectorAll(".tab")];
tabs.forEach((b, i) => {
  b.addEventListener("click", () => setMode(b.dataset.mode, true));
  b.addEventListener("keydown", (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const next = k === "first" ? tabs[0] : k === "last" ? tabs[tabs.length - 1] : tabs[(i + k + tabs.length) % tabs.length];
    setMode(next.dataset.mode);
    next.focus();
  });
});

msg.addEventListener("input", () => { setCount(); if (msg.getAttribute("aria-invalid")) { msg.removeAttribute("aria-invalid"); showError(""); } });
msg.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); });
btn.addEventListener("click", () => run());

function showError(text) {
  $("errorText").textContent = text || "";
  $("error").hidden = !text;
}

function validate(text) {
  if (!text) return mode === "url" ? "Əvvəlcə linki yapışdırın." : mode === "phone" ? "Əvvəlcə nömrəni yazın." : "Əvvəlcə mesajı, linki və ya nömrəni yapışdırın.";
  if (mode === "url" && !DOMAIN_RE.test(text)) return "Bu, link kimi görünmür. Məsələn: sayt.az və ya https://sayt.az/sehife";
  if (mode === "phone" && (text.replace(/\D/g, "").length < 3)) return "Nömrəni rəqəmlərlə yazın. Məsələn: +994 50 123 45 67";
  if (mode === "msg" && text.length < 3) return "Mesaj çox qısadır. Mətni tam yapışdırın.";
  return null;
}

function setBusy(on) {
  busy = on;
  btn.disabled = on;
  $("yoxla").setAttribute("aria-busy", String(on));
  const ic = btn.querySelector("svg");
  if (on) {
    const sp = el("span", "spinner");
    sp.setAttribute("aria-hidden", "true");
    ic.replaceWith(sp);
  } else {
    const sp = btn.querySelector(".spinner");
    if (sp) sp.replaceWith(icon("search"));
  }
  applyModeTexts();
}

// Yoxlama addımları: cavab gələnə qədər addımlar bir-bir işarələnir
function startSteps(list) {
  const box = $("steps");
  box.replaceChildren(...list.map((s) => {
    const li = el("li", "step");
    li.append(el("span", "dot"), el("span", "", s));
    return li;
  }));
  box.hidden = false;
  let i = 0, stopped = false;
  const items = [...box.children];
  (async () => {
    while (!stopped && i < items.length - 1) {
      items[i].classList.add("active");
      await wait(320);
      if (stopped) break;
      items[i].classList.replace("active", "done");
      i++;
    }
    if (!stopped && items[i]) items[i].classList.add("active");
  })();
  return async (summary) => {
    stopped = true;
    for (; i < items.length; i++) {
      items[i].classList.remove("active");
      items[i].classList.add("done");
      await wait(60);
    }
    await wait(140);
    box.hidden = true;
    const done = $("stepsDone");
    done.replaceChildren(icon("check-circle", "ic ic-sm"), el("span", "", summary));
    done.hidden = false;
  };
}

function showSkeleton() {
  $("netice").hidden = false;
  $("resSkeleton").hidden = false;
  $("result").hidden = true;
  $("phone").hidden = true;
}

async function run(channel = "web", source = null) {
  if (busy) return;
  const text = msg.value.trim();
  const err = validate(text);
  if (err) {
    showError(err);
    msg.setAttribute("aria-invalid", "true");
    msg.focus();
    return;
  }
  showError("");
  $("stepsDone").hidden = true;
  setBusy(true);
  showSkeleton();
  const t0 = performance.now();
  const finish = startSteps(looksPhone(text) ? PHONE_STEPS : STEPS);
  try {
    const data = await postJson("/api/analyze", { text, channel });
    const ms = Math.round(performance.now() - t0);
    if (data.kind === "phone") {
      await finish("Nömrə yoxlandı · nömrə yadda saxlanılmadı");
      renderPhone(data, text);
      return;
    }
    const parts = ["Yoxlama bitdi"];
    if (data.masked?.total) parts.push(`${data.masked.total} şəxsi məlumat gizlədildi`);
    if (data.linkChecked) parts.push("link yoxlanıldı");
    await finish(parts.join(" · "));
    render(text, data, { source: source || (channel === "qr" ? "qr" : null), ms });
    setTimeout(loadToday, 1500);
  } catch (e) {
    $("steps").hidden = true;
    $("netice").hidden = true;
    showError(netMsg(e));
  } finally {
    setBusy(false);
  }
}

/* =====================================================================
   2. Nəticə paneli
   ===================================================================== */
const LEVEL = [
  { min: 90, key: "crit", label: "Kritik" },
  { min: 70, key: "high", label: "Yüksək risk" },
  { min: 30, key: "sus", label: "Şübhəli" },
  { min: 0, key: "safe", label: "Təhlükə əlaməti yoxdur" },
];
const levelOf = (score) => LEVEL.find((l) => score >= l.min) || LEVEL[3];
const LV_CLASSES = ["lv-safe", "lv-sus", "lv-high", "lv-crit", "lv-neutral"];
function setLv(node, key) { node.classList.remove(...LV_CLASSES); node.classList.add("lv-" + key); }

const SUB = {
  crit: "Linkə basmayın, kod və kart məlumatı verməyin.",
  high: "Linkə basmayın, kod və kart məlumatı verməyin.",
  sus: "Tələsməyin: əvvəl şirkətin öz rəsmi nömrəsinə zəng edin.",
  safe: "Ciddi təhlükə əlaməti tapılmadı.",
};

// Göstəricinin kateqoriyası və gücü (mühərrikin kodlarına görə)
const CATS = {
  link: ["Domen və link", "link"], intel: ["Təhdid kəşfiyyatı", "database"], page: ["Saytın məzmunu", "globe"],
  text: ["Sosial mühəndislik", "users"], model: ["Süni intellekt modeli", "cpu"], inj: ["Manipulyasiya cəhdi", "alert"],
  phone: ["Telefon nömrəsi", "phone"], good: ["Etibarlılıq əlaməti", "check-circle"],
};
const CODE_CAT = {
  brand_impersonation: "link", brand_link_mismatch: "link", shortener: "link", risky_tld: "link", ip_url: "link", userinfo_url: "link",
  idn_host: "link", deep_subdomain: "link", unknown_link: "link", new_domain: "link", young_domain: "link", domain_not_registered: "link",
  scam_app_path: "link", redirect_other: "link", messenger_link: "text",
  intel_hit: "intel", vt_malicious: "intel", vt_info: "intel",
  page_card_form: "page", page_password: "page", page_scam_app: "page",
  veri_talebi: "text", hesap_ele_gecirme: "text", banka_taklidi: "text", aciliyet: "text", odul: "text", is_teklifi: "text",
  yardim: "text", kargo: "text", brand_data_request: "text", pul_talebi: "text", qohum_taklidi: "text", investisiya: "text",
  ml_high: "model", injection: "inj", phone_lookalike: "phone",
  official_link: "good", old_domain: "good", mesru_isaret: "good",
};
const STRONG = new Set(["brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app", "page_password",
  "domain_not_registered", "idn_host", "userinfo_url", "ip_url", "hesap_ele_gecirme", "veri_talebi", "brand_data_request",
  "injection", "qohum_taklidi", "investisiya", "new_domain", "phone_lookalike", "scam_app_path"]);
const CODE_NAME = {
  brand_impersonation: "Brend təqlidi", brand_link_mismatch: "Brend və link uyğun deyil", shortener: "Qısaldılmış link",
  risky_tld: "Riskli domen zonası", ip_url: "IP ünvanlı link", userinfo_url: "«@» hiyləsi", idn_host: "Oxşar hərflər (IDN)",
  deep_subdomain: "Dərin alt domen", unknown_link: "Naməlum sayt", new_domain: "Təzə domen", young_domain: "Gənc domen",
  old_domain: "Köhnə domen", domain_not_registered: "Domen qeydiyyatda yoxdur", scam_app_path: "Fırıldaq tətbiqi yolu",
  redirect_other: "Başqa sayta yönləndirmə", official_link: "Rəsmi link", messenger_link: "Messencerə çağırış",
  intel_hit: "Qara siyahıda var", vt_malicious: "VirusTotal: təhlükəli", vt_info: "VirusTotal yoxlaması",
  page_card_form: "Kart forması", page_password: "Şifrə forması", page_scam_app: "Fırıldaq tətbiqi əlamətləri",
  veri_talebi: "Məlumat tələbi", hesap_ele_gecirme: "Kod tələbi", banka_taklidi: "Bank təqlidi", aciliyet: "Tələsdirmə",
  odul: "Hədiyyə vədi", is_teklifi: "Saxta iş təklifi", yardim: "Saxta yardım", kargo: "Bağlama bəhanəsi",
  brand_data_request: "Brend adından məlumat tələbi", pul_talebi: "Pul tələbi", qohum_taklidi: "Yaxın təqlidi",
  investisiya: "İnvestisiya vədi", ml_high: "Model: fırıldağa oxşayır", injection: "Təlimat inyeksiyası",
  phone_lookalike: "Şübhəli nömrə", mesru_isaret: "Rəsmi xəbərdarlıq ifadəsi", combo: "Əlamətlərin birləşməsi",
};
const MASK_NAME = { kart: "kart", tel: "telefon", fin: "FİN", iban: "IBAN", kod: "kod" };

// Göstəricilər: mühərrikin əsas səbəbləri + linklərdəki əlavə tapıntılar (təkrarsız)
function indicators(r) {
  const out = [];
  const seen = new Set();
  for (const x of r.reasons || []) {
    if (!x.text || seen.has(x.code + x.text)) continue;
    seen.add(x.code + x.text);
    out.push(x);
  }
  for (const u of r.urls || []) {
    for (const f of u.findings || []) {
      if (f.code === "unknown_link" || seen.has(f.code + f.text) || [...seen].some((s) => s.startsWith(f.code) && f.code !== "vt_info")) continue;
      seen.add(f.code + f.text);
      out.push(f);
    }
  }
  return out;
}

function indicatorItem(x) {
  const cat = CODE_CAT[x.code] || "text";
  const [catName, ic] = CATS[cat];
  const lv = cat === "good" ? "safe" : STRONG.has(x.code) ? "crit" : x.code === "vt_info" ? "neutral" : "sus";
  const li = el("li", "ind lv-" + lv);
  const i = el("span", "ind-ic");
  i.append(icon(ic));
  const body = el("div");
  body.append(el("span", "ind-cat", catName), el("span", "ind-text", x.text));
  li.append(i, body);
  return li;
}

function buildActions(r, lv) {
  const f = new Set(r.flags || []);
  const hasLink = (r.urls || []).some((u) => !u.official && !u.messenger);
  const out = [];
  const add = (text, warn = false) => { if (!out.some((o) => o.text === text)) out.push({ text, warn }); };
  if (lv === "safe") {
    if (f.has("mesru_isaret")) add("Kodu özünüz istəmisinizsə, bu normaldır. Yenə də onu heç kimə deməyin.");
    add("Kart məlumatlarınızı və SMS təsdiq kodlarını heç kimə göndərməyin.");
    add("Şübhə yaranarsa, qurumla onun öz rəsmi kanalları vasitəsilə əlaqə saxlayın.");
    return out;
  }
  if (hasLink) add("Linkə daxil olmayın.", true);
  add("Kart məlumatlarınızı paylaşmayın.", true);
  if (["hesap_ele_gecirme", "banka_taklidi", "brand_data_request", "veri_talebi"].some((c) => f.has(c)) || lv !== "sus") add("SMS təsdiq kodlarını heç kimə göndərməyin.", true);
  if (f.has("qohum_taklidi") || f.has("pul_talebi")) add("Pul köçürməzdən əvvəl yaxınınıza köhnə nömrəsindən zəng edib soruşun.", true);
  if (f.has("is_teklifi") || f.has("investisiya")) add("«Asan qazanc» üçün heç bir ödəniş və ya depozit etməyin.", true);
  if (f.has("phone_lookalike")) add("Mesajdakı nömrəyə geri zəng etməyin.", true);
  add("Rəsmi qurumla onun öz rəsmi kanalları vasitəsilə əlaqə saxlayın.");
  if (lv === "sus") add("Tələsməyin: mesajın doğru olduğunu yoxlayana qədər heç bir addım atmayın.");
  else add("Mesaja cavab yazmayın, göndərəni bloklayın və mesajı silin.");
  if (hasLink && lv !== "sus" && (r.urls || []).some((u) => u.verdict === "danger" && !u.blacklisted)) add("Saxta saytı Blacklist.gov.az-a bildirin: düymə link hesabatındadır.");
  return out.slice(0, 7);
}

function sourceLabel(r, source, text) {
  if (source === "qr") return "QR kod";
  if (source === "ocr") return "Ekran şəkli (OCR)";
  const urls = r.urls || [];
  if (urls.length && text.replace(/\s+/g, " ").length <= (urls[0].raw || "").length + 3) return "Link";
  return urls.length ? "Mesaj + link" : "Mesaj";
}

const GAUGE_C = 2 * Math.PI * 52;
function setGauge(score) {
  const fill = $("gaugeFill");
  fill.style.transition = "none";
  fill.style.strokeDasharray = String(GAUGE_C);
  fill.style.strokeDashoffset = String(GAUGE_C);
  void fill.getBoundingClientRect();
  fill.style.transition = "";
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = String(GAUGE_C * (1 - score / 100)); }));
}
function countUp(node, to, dur = 700) {
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    node.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => { node.textContent = String(to); }, dur + 150); // pəncərə arxa fonda olsa da son rəqəm yazılsın
}

function markText(text, highlights) {
  const box = $("marked");
  box.replaceChildren();
  let pos = 0;
  const spans = [];
  for (const h of highlights) {
    if (h.start < pos) continue;
    spans.push(h);
    pos = h.end;
  }
  pos = 0;
  for (const h of spans) {
    if (h.start > pos) box.append(document.createTextNode(text.slice(pos, h.start)));
    const m = el("mark", /link/i.test(h.label) ? "link" : "", text.slice(h.start, h.end));
    m.title = h.label;
    box.append(m);
    pos = h.end;
  }
  if (pos < text.length) box.append(document.createTextNode(text.slice(pos)));
}

function techRow(dl, k, v) {
  dl.append(el("dt", "", k));
  const dd = el("dd");
  if (v instanceof Node) dd.append(v); else dd.textContent = v;
  dl.append(dd);
}

function reveal(box) {
  [...box.querySelectorAll(".card, .ind, .lcard, .hotline, .act-list li")].forEach((n, i) => {
    n.classList.remove("reveal");
    n.style.animationDelay = reduced ? "0ms" : `${Math.min(i, 14) * 45}ms`;
    void n.offsetWidth;
    n.classList.add("reveal");
  });
}
function scrollToResults() {
  const h = $("resTitle");
  $("netice").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  setTimeout(() => h.focus({ preventScroll: true }), reduced ? 0 : 450);
}

function render(text, r, { source, ms }) {
  const lv = levelOf(r.score);
  const now = new Date();
  $("resSkeleton").hidden = true;
  $("phone").hidden = true;
  const box = $("result");
  box.hidden = false;
  setLv($("sumCard"), lv.key);

  countUp($("score"), r.score);
  setGauge(r.score);
  setLv($("lvlBadge"), lv.key);
  $("lvlText").textContent = lv.label;
  $("band").textContent = r.bandLabel;
  $("bandSub").textContent = r.band === "safe" && (r.flags || []).includes("mesru_isaret")
    ? "Bu kodu özünüz istəmisinizsə, normaldır. Kodu heç kimə deməyin."
    : SUB[lv.key];
  const segs = [...$("scaleBar").querySelectorAll("span")];
  const segIndex = { safe: 0, sus: 1, high: 2, crit: 3 }[lv.key];
  segs.forEach((s, i) => s.classList.toggle("on", i === segIndex));
  $("scaleMark").style.left = `${Math.min(99, Math.max(1, r.score))}%`;

  const inds = indicators(r);
  $("fType").textContent = sourceLabel(r, source, text);
  $("fInd").textContent = String(inds.filter((x) => CODE_CAT[x.code] !== "good").length);
  $("fMask").textContent = String(r.masked?.total || 0);
  $("fTime").textContent = hms(now);

  // Göstəricilər
  const list = $("reasons");
  if (inds.length) list.replaceChildren(...inds.map(indicatorItem));
  else list.replaceChildren(el("li", "empty-line", "Mesajda tanıdığımız heç bir təhlükə əlaməti tapılmadı."));
  $("indCount").textContent = inds.length ? `${inds.length} göstərici` : "";

  // Linklər
  const urls = r.urls || [];
  $("links").replaceChildren(...urls.map(linkCard));
  $("linksBlock").hidden = !urls.length;

  markText(text, r.highlights || []);

  // Tövsiyələr
  $("advice").textContent = r.advice || "";
  $("actions").replaceChildren(...buildActions(r, lv.key).map((a) => {
    const li = el("li", a.warn ? "warn" : "");
    li.append(icon(a.warn ? "x-circle" : "check-circle"), el("span", "", a.text));
    return li;
  }));
  $("hotlines").replaceChildren(...(r.hotlines || []).map(hotlineRow));
  $("hotBox").hidden = !(r.hotlines || []).length;

  // Texniki detallar
  const dl = $("tech");
  dl.replaceChildren();
  techRow(dl, "Təhlil növü", sourceLabel(r, source, text));
  techRow(dl, "Təhlil vaxtı", fullDate(now));
  if (ms) techRow(dl, "Cavab müddəti", `${(ms / 1000).toFixed(1).replace(".", ",")} saniyə`);
  techRow(dl, "Yekun bal", `${r.score} / 100 · ${lv.label}`);
  techRow(dl, "Mühərrikin qərarı", `${r.bandLabel} (${r.band})`);
  techRow(dl, "Model (AZ-SC)", `${Math.round((r.ml || 0) * 100)}% fırıldaq mesajlarına oxşarlıq`);
  techRow(dl, "Dil modeli", r.llm?.used ? `istifadə olundu · düzəliş ${r.llm.adjust > 0 ? "+" : ""}${r.llm.adjust} bal` : "istifadə olunmadı");
  const maskParts = Object.entries(r.masked?.found || {}).filter(([, v]) => v > 0).map(([k, v]) => `${MASK_NAME[k] || k}: ${v}`);
  techRow(dl, "Gizlədilən məlumat", r.masked?.total ? `${r.masked.total} (${maskParts.join(", ")})` : "yoxdur");
  if (r.brand) techRow(dl, "Adından yazılan brend", r.brand);
  if (r.campaign?.label) techRow(dl, "Kampaniya", r.campaign.label);
  const chips = el("div");
  const codes = (r.flags || []).filter((c) => c !== "combo");
  if (codes.length) codes.forEach((c) => { const s = el("span", "code-chip", c); s.title = CODE_NAME[c] || c; chips.append(s); });
  else chips.textContent = "yoxdur";
  techRow(dl, "Aşkarlanan kodlar", chips);
  urls.forEach((u, i) => {
    const reg = { found: u.ageDays != null ? (u.ageDays < 365 ? `${u.ageDays} gün` : `${Math.floor(u.ageDays / 365)} il`) : "tapıldı", missing: "qeydiyyatda yoxdur", unknown: "məlumat açıq deyil", not_checked: "yoxlanılmadı" }[u.registry] || "—";
    const page = { opened: "açılıb yoxlanıldı", failed: "açılmadı", not_checked: "açılmadı (lazım olmadı)" }[u.pageStatus] || "—";
    techRow(dl, `Link ${i + 1}`, `${u.host} · domen ${u.reg} · yaşı: ${reg} · səhifə: ${page}${u.official ? " · rəsmi siyahıda" : ""}${u.blacklisted ? " · Blacklist.gov.az-da" : ""}`);
  });

  const meta = [];
  if (r.masked?.total) meta.push(`${r.masked.total} şəxsi məlumat (kart, telefon, kod) yoxlamadan əvvəl gizlədildi`);
  meta.push("mesajınızın mətni yadda saxlanılmadı");
  $("meta").textContent = meta.join(" · ");

  reveal(box);
  box.querySelectorAll("mark").forEach((m) => m.classList.add("sweep"));
  scrollToResults();
}

function hotlineRow(h) {
  const row = el("div", "hotline");
  const ic = el("span", "h-ic");
  ic.append(icon(h.num ? "phone" : "bank"));
  const body = el("div");
  const head = h.num ? el("a", "", h.label) : el("strong", "", h.label);
  if (h.num) head.href = "tel:" + h.num;
  body.append(head, el("p", "", h.desc));
  row.append(ic, body);
  return row;
}

// Link kartı: sayt barədə tapılanlar, qara siyahı və ekran şəkli
const LINK_VERDICT = {
  danger: ["Təhlükəli link", "crit"], suspicious: ["Şübhəli link", "sus"], unknown: ["Naməlum sayt", "neutral"],
  official: ["Rəsmi sayt", "safe"], messenger: ["Telegram / WhatsApp linki", "neutral"],
};
const PAGE_CODES = new Set(["page_card_form", "page_password", "page_scam_app"]);

function linkCard(u) {
  const card = el("li", "lcard");
  const [vt, lv] = LINK_VERDICT[u.messenger ? "messenger" : u.verdict] || LINK_VERDICT.unknown;
  const top = el("div", "lcard-top");
  const host = el("span", "lcard-host", u.host || u.reg);
  top.append(host, badge(vt, lv));
  card.append(top);

  const row = (k, v) => { const p = el("p", "lrow"); p.append(el("span", "k", k + " "), document.createTextNode(v)); return p; };
  card.append(row("Linkin getdiyi sayt:", u.reg));
  if (u.brand && u.verdict === "danger") card.append(row("Özünü göstərdiyi:", u.brand));

  if (!u.official && !u.messenger) {
    if (u.registry === "missing") card.append(row("Domen:", "qeydiyyatda yoxdur (sayt bağlanıb və ya silinib)"));
    else if (u.registry === "found" && u.ageDays != null) card.append(row("Domen:", u.ageDays < 365 ? `${u.ageDays} gün əvvəl açılıb` : `${Math.floor(u.ageDays / 365)} ildir mövcuddur`));
    else if (u.registry === "unknown") card.append(row("Domen:", "yaşı müəyyən edilmədi (.az kimi domenlərdə məlumat açıq deyil)"));

    const pageFind = (u.findings || []).filter((f) => PAGE_CODES.has(f.code));
    if (u.pageStatus === "opened") card.append(row("Saytın özü:", pageFind.length ? "açıb yoxladıq, aşağıdakılar tapıldı" : u.verdict === "danger" ? "açıb yoxladıq: kart forması hələ görünmür, amma domen saxtadır" : "açıb yoxladıq: kart və ya şifrə forması tapılmadı"));
    else if (u.pageStatus === "failed") card.append(row("Saytın özü:", "avtomatik yoxlama zamanı açılmadı (cavab vermədi və ya yoxlamanı blokladı)"));

    const shown = new Set(["unknown_link", "old_domain", "domain_not_registered", "new_domain", "young_domain"]);
    const rest = (u.findings || []).filter((f) => !shown.has(f.code));
    if (rest.length) {
      const ul = el("ul", "lfind");
      rest.forEach((f) => ul.append(el("li", "", f.text)));
      card.append(ul);
    }
    const acts = el("div", "lactions");
    if (u.registry !== "missing") acts.append(shotButton(u, card));
    card.append(acts);
    if (u.verdict === "danger" || u.verdict === "suspicious") card.append(blacklistBlock(u));
  }
  return card;
}

// Blacklist.gov.az: dövlətin qara siyahısında yoxla / yeni saytı bildir
function blacklistBlock(u) {
  const wrap = el("div", "lactions");
  const chk = el("a", "btn btn-ghost btn-sm");
  chk.append(icon("search", "ic ic-sm"), el("span", "", "Qara siyahıda yoxla"));
  chk.href = "https://blacklist.gov.az/search?search=" + encodeURIComponent(u.reg || "");
  chk.target = "_blank";
  chk.rel = "noopener noreferrer";
  if (u.blacklisted) {
    const box = el("div");
    box.append(el("p", "shotnote", "Bu sayt artıq dövlətin qara siyahısındadır (Blacklist.gov.az)."), wrap);
    wrap.append(chk);
    return box;
  }
  const rep = el("a", "btn btn-secondary btn-sm");
  rep.append(icon("flag", "ic ic-sm"), el("span", "", "Dövlətin qara siyahısına bildir"));
  rep.href = "https://blacklist.gov.az/report";
  rep.target = "_blank";
  rep.rel = "noopener noreferrer";
  wrap.append(rep, chk);
  // qısaldılmış linkdə "bit.ly" yox, linkin tam ünvanı lazımdır
  const addr = (u.flags || []).includes("shortener") ? u.raw : u.reg;
  const box = el("div");
  box.append(wrap, el("p", "shotnote", `Formada «Kateqoriya: Fişinq» seçin və saytın ünvanını yazın: ${addr}`));
  return box;
}

// "Saytı bizim yerimizə aç": Cloudflare-in təcrid olunmuş brauzerində ekran şəkli
function shotButton(u, card) {
  const b = el("button", "btn btn-ghost btn-sm");
  b.type = "button";
  b.append(icon("camera", "ic ic-sm"), el("span", "", "Saytı bizim yerimizə aç"));
  const note = el("p", "shotnote", "Sayt sizin cihazınızda açılmır: onu biz təhlükəsiz brauzerdə açıb şəklini çəkirik.");
  b.addEventListener("click", async () => {
    b.disabled = true;
    b.replaceChildren(el("span", "spinner"), el("span", "", "Sayt açılır… (5-15 saniyə)"));
    try {
      const d = await postJson("/api/shot", { url: u.raw });
      if (!d.ok) {
        note.textContent = d.reason === "site_down" || d.reason === "timeout"
          ? "Saytı açmağa çalışdıq: sayt açılmır (bağlanıb və ya cavab vermir)."
          : "Saytın şəklini çəkmək alınmadı.";
        b.remove();
        return;
      }
      const fig = el("figure", "shotfig");
      const img = el("img");
      img.src = d.image;
      img.alt = "Saytın ekran şəkli";
      img.loading = "lazy";
      fig.append(img, el("figcaption", "", `Bu şəkli biz çəkdik. Link əslində bura aparır: ${d.finalHost || u.reg}` + (d.title ? ` · Səhifənin adı: ${d.title}` : "")));
      b.remove();
      note.replaceWith(fig);
      fig.after(el("p", "shotnote", u.verdict === "danger" || u.verdict === "suspicious" ? "Bu sayta özünüz daxil olmayın və heç nə yazmayın." : "Şəkil yalnız məlumat üçündür: saytı açmazdan əvvəl ünvanın doğru olduğuna əmin olun."));
    } catch (e) {
      b.disabled = false;
      b.replaceChildren(icon("refresh", "ic ic-sm"), el("span", "", "Yenidən cəhd et"));
      note.textContent = netMsg(e);
    }
  });
  queueMicrotask(() => { if (b.parentElement) b.parentElement.after(note); else card.append(note); });
  return b;
}

// Nömrə nəticəsi
const PHONE_LV = {
  official: ["safe", "Rəsmi nömrə"], unknown: ["neutral", "Bildiriş yoxdur"],
  suspicious: ["sus", "Şübhəli"], high: ["high", "Yüksək risk"],
};
let phoneRaw = "";
function renderPhone(v, raw) {
  phoneRaw = raw;
  $("resSkeleton").hidden = true;
  $("result").hidden = true;
  const box = $("phone");
  box.hidden = false;
  const [lv, label] = PHONE_LV[v.band] || PHONE_LV.unknown;
  setLv($("phSum"), lv);
  setLv($("phBadge"), lv);
  $("phLvl").textContent = label;
  $("phNum").textContent = v.display;
  $("phBand").textContent = v.bandLabel;
  $("phType").textContent = v.type || "";
  $("phKind").textContent = v.type || v.country || "—";
  $("phReports").textContent = String(v.reports?.user || 0);
  $("phTime").textContent = hms(new Date());
  $("phReasons").replaceChildren(...(v.reasons || []).map((text) => {
    const li = el("li", "ind lv-" + (lv === "neutral" ? "neutral" : lv === "safe" ? "safe" : lv === "high" ? "crit" : "sus"));
    const i = el("span", "ind-ic");
    i.append(icon(lv === "safe" ? "check-circle" : "phone"));
    const body = el("div");
    body.append(el("span", "ind-text", text));
    li.append(i, body);
    return li;
  }));
  $("phAdvice").textContent = v.advice;
  $("phHotlines").replaceChildren(...(v.hotlines || []).map(hotlineRow));
  $("phReportBox").hidden = !v.reportable;
  $("phReport").disabled = false;
  $("phReportNote").hidden = true;
  reveal(box);
  scrollToResults();
}

$("phReport").addEventListener("click", async () => {
  const b = $("phReport");
  const note = $("phReportNote");
  b.disabled = true;
  try {
    const d = await postJson("/api/phone/report", { number: phoneRaw });
    note.textContent = d.dup
      ? "Siz bu nömrəni artıq bildirmisiniz."
      : `Təşəkkürlər! Bildirişiniz qeydə alındı. Bu nömrəni bildirən istifadəçi sayı: ${d.reports?.user || 0}.`;
    if (!d.dup) toast("Bildirişiniz qeydə alındı.");
  } catch (e) {
    note.textContent = netMsg(e);
    b.disabled = false;
  }
  note.hidden = false;
});

/* =====================================================================
   3. QR və ekran şəkli: hamısı brauzerdə oxunur, şəkil serverə getmir
   ===================================================================== */
function loadScript(src) {
  return new Promise((ok, bad) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = ok;
    s.onerror = bad;
    document.head.append(s);
  });
}

async function decodeQr(file) {
  const bmp = await createImageBitmap(file);
  if ("BarcodeDetector" in window) {
    try {
      const det = new window.BarcodeDetector({ formats: ["qr_code"] });
      const codes = await det.detect(bmp);
      if (codes.length) return codes[0].rawValue;
    } catch { /* jsQR ilə davam */ }
  }
  if (!window.jsQR) await loadScript("/vendor/jsQR.js");
  const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext("2d");
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return window.jsQR(img.data, img.width, img.height)?.data || null;
}

let ocrWorker = null;
async function ocrImage(file, onProgress) {
  if (!window.Tesseract) await loadScript("/vendor/tesseract/tesseract.min.js");
  if (!ocrWorker) {
    ocrWorker = await window.Tesseract.createWorker(["aze", "eng", "rus"], 1, {
      workerPath: "/vendor/tesseract/worker.min.js",
      corePath: "/vendor/tesseract/",
      langPath: "/vendor/tesseract/lang",
      workerBlobURL: false,
      logger: (m) => onProgress(m),
    });
  }
  const { data } = await ocrWorker.recognize(file);
  return (data?.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function ocrStatus(text) {
  const p = $("ocrStatus");
  if (!text) { p.hidden = true; return; }
  p.replaceChildren(el("span", "spinner"), el("span", "", text));
  p.hidden = false;
}

async function handleImage(file) {
  if (!file || busy) return;
  if (!/^image\//.test(file.type)) { showError("Yalnız şəkil faylı yükləyin (PNG, JPG)."); return; }
  if (file.size > 15 * 1024 * 1024) { showError("Şəkil çox böyükdür (15 MB-dan çox)."); return; }
  showError("");
  $("stepsDone").hidden = true;
  ocrStatus("Şəkil oxunur…");
  try {
    const value = await decodeQr(file).catch(() => null);
    if (value) {
      ocrStatus("");
      setMode(DOMAIN_RE.test(value) && value.trim().split(/\s+/).length === 1 ? "url" : "msg");
      msg.value = value.slice(0, 2000);
      setCount();
      run("qr", "qr");
      return;
    }
    ocrStatus("QR kod tapılmadı. Şəkildəki mətn oxunur (ilk dəfə 10-20 saniyə çəkə bilər)…");
    const text = await ocrImage(file, (m) => {
      if (m.status === "recognizing text") ocrStatus(`Şəkildəki mətn oxunur… ${Math.round((m.progress || 0) * 100)}%`);
      else if (/load/.test(m.status || "")) ocrStatus("Mətn oxuyucu hazırlanır (ilk dəfə 10-20 saniyə)…");
    });
    ocrStatus("");
    if (text.replace(/\s/g, "").length < 8) {
      showError("Şəkildə nə QR kod, nə də oxunaqlı mətn tapıldı. Daha aydın şəkil yükləyin və ya mətni kopyalayın.");
      return;
    }
    setMode("msg");
    msg.value = text.slice(0, 2000);
    setCount();
    await run("web", "ocr");
  } catch {
    ocrStatus("");
    showError("Şəkli oxumaq alınmadı. Mətni kopyalayıb yapışdırın.");
  }
}

$("qr").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  handleImage(file);
});
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("drag")));
drop.addEventListener("drop", (e) => { e.preventDefault(); handleImage(e.dataTransfer?.files?.[0]); });
document.addEventListener("paste", (e) => {
  if (mode !== "qr") return;
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) { e.preventDefault(); handleImage(item.getAsFile()); }
});

/* =====================================================================
   4. Sayt reputasiyası: eyni analiz mühərriki, yalnız sayt üçün hesabat
   ===================================================================== */
const URL_STRUCT = ["shortener", "risky_tld", "ip_url", "userinfo_url", "deep_subdomain", "scam_app_path", "redirect_other"];
const domInput = $("domInput");

function domError(text) {
  $("domErr").replaceChildren(...(text ? [icon("alert", "ic ic-sm"), el("span", "", text)] : []));
  $("domErr").hidden = !text;
  if (text) domInput.setAttribute("aria-invalid", "true"); else domInput.removeAttribute("aria-invalid");
}
domInput.addEventListener("input", () => domError(""));

$("domForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = domInput.value.trim();
  if (!raw) { domError("Saytın ünvanını yazın."); domInput.focus(); return; }
  if (/\s/.test(raw) || !DOMAIN_RE.test(raw)) { domError("Bu, sayt ünvanı kimi görünmür. Məsələn: sayt.az və ya https://sayt.az"); domInput.focus(); return; }
  domError("");
  const b = $("domBtn");
  b.disabled = true;
  const ic = b.querySelector("svg");
  const sp = el("span", "spinner");
  ic.replaceWith(sp);
  $("domEmpty").hidden = true;
  $("domReport").hidden = true;
  $("domSkeleton").hidden = false;
  try {
    const data = await postJson("/api/analyze", { text: raw, channel: "web" });
    const u = (data.urls || [])[0];
    if (data.kind === "phone" || !u) {
      $("domEmpty").hidden = false;
      domError(data.kind === "phone" ? "Bu, telefon nömrəsidir. Yuxarıdakı «Nömrə» bölməsindən yoxlayın." : "Bu ünvanda sayt adı tapılmadı. Məsələn: sayt.az");
      return;
    }
    renderDomain(u, data);
  } catch (err) {
    $("domEmpty").hidden = false;
    domError(netMsg(err));
  } finally {
    $("domSkeleton").hidden = true;
    sp.replaceWith(icon("search", "ic ic-sm"));
    b.disabled = false;
  }
});

function renderDomain(u, data) {
  const f = new Set(u.flags || []);
  const find = (code) => (u.findings || []).find((x) => x.code === code)?.text;
  const rows = [];
  const add = (status, title, text) => rows.push({ status, title, text });
  // Saxta sayt üçün «tapılmadı» nəticələri yaşıl göstərilmir: istifadəçi yanlış rahatlamasın
  const clean = u.verdict === "danger" ? "na" : "ok";

  // 1. Brend təqlidi və rəsmi siyahı
  if (u.official) add("ok", "Rəsmi saytlar siyahısı", `Bu domen ScamShield-in rəsmi saytlar siyahısındadır${u.brand ? ` (${u.brand})` : ""}.`);
  else if (f.has("brand_impersonation")) add("bad", "Brend təqlidi", find("brand_impersonation") || `Özünü ${u.brand} kimi göstərir, amma rəsmi sayt deyil.`);
  else if (f.has("idn_host")) add("bad", "Oxşar hərflər", find("idn_host"));
  else add("na", "Rəsmi saytlar siyahısı", "Siyahıda yoxdur. Bu, saytın saxta olduğu demək deyil: siyahıda yalnız tanınmış Azərbaycan qurumları var.");

  // 2. Domenin yaşı (RDAP)
  if (u.registry === "missing") add("bad", "Domenin qeydiyyatı", "Domen qeydiyyatda yoxdur: sayt bağlanıb və ya silinib.");
  else if (u.ageDays != null) {
    const age = u.ageDays < 365 ? `${u.ageDays} gün əvvəl qeydiyyatdan keçib` : `${Math.floor(u.ageDays / 365)} ildir mövcuddur`;
    add(f.has("new_domain") ? "bad" : f.has("young_domain") ? "warn" : u.ageDays >= 365 ? "ok" : "warn", "Domenin yaşı", age + (f.has("new_domain") ? ". Fırıldaq saytları adətən təzə olur." : "."));
  } else if (u.registry === "unknown") add("na", "Domenin yaşı", "Bu domen üçün reyestr məlumatı açıq deyil (.az zonasında və hostinq alt domenlərində belə olur).");
  else add("na", "Domenin yaşı", u.official ? "Rəsmi sayt üçün yoxlanılmadı." : "Yoxlanılmadı.");

  // 3. Qara siyahılar
  if (f.has("intel_hit")) add("bad", "Qara siyahılar", u.blacklisted ? "Dövlətin qara siyahısındadır (Blacklist.gov.az)." : "Fişinq siyahısında qeydə alınıb (OpenPhish).");
  else add(clean, "Qara siyahılar", "Blacklist.gov.az və OpenPhish siyahılarında tapılmadı.");

  // 4. VirusTotal
  if (f.has("vt_malicious")) add("bad", "VirusTotal", find("vt_malicious"));
  else if (f.has("vt_info")) add((find("vt_info") || "").includes("hələ qeyd yoxdur") ? "na" : "warn", "VirusTotal", find("vt_info"));
  else add("na", "VirusTotal", u.official ? "Rəsmi sayt üçün yoxlanılmadı." : "Bu dəfə yoxlanılmadı.");

  // 5. URL quruluşu
  const struct = URL_STRUCT.filter((c) => f.has(c));
  if (struct.length) add(struct.some((c) => ["ip_url", "userinfo_url", "scam_app_path"].includes(c)) ? "bad" : "warn", "Linkin quruluşu", struct.map(find).filter(Boolean).join(" "));
  else add(clean, "Linkin quruluşu", "Qısaldıcı, IP ünvan, «@» hiyləsi və ya riskli domen zonası tapılmadı.");

  // 6. Saytın məzmunu
  const page = ["page_card_form", "page_password", "page_scam_app"].filter((c) => f.has(c));
  if (page.length) add("bad", "Saytın məzmunu", page.map(find).filter(Boolean).join(" "));
  else if (u.pageStatus === "opened") add(clean, "Saytın məzmunu", u.verdict === "danger" ? "Saytı açıb yoxladıq: kart forması hələ görünmür, amma domen saxtadır." : "Saytı açıb yoxladıq: kart və ya şifrə forması tapılmadı.");
  else if (u.pageStatus === "failed") add("na", "Saytın məzmunu", "Sayt avtomatik yoxlama zamanı açılmadı (cavab vermədi və ya yoxlamanı blokladı).");
  else add("na", "Saytın məzmunu", u.official ? "Rəsmi sayt üçün açılmadı." : "Yoxlanılmadı.");

  // 7. HTTPS / SSL: hələ yoxlanılmır, uydurmuruq
  add("na", "HTTPS və SSL sertifikatı", "Sertifikat yoxlaması hələ qoşulmayıb. Unutmayın: kilid işarəsi saytın təhlükəsiz olduğunu göstərmir.");

  const STATUS_ICON = { ok: "check-circle", warn: "alert", bad: "x-circle", na: "minus-circle" };
  $("domChecks").replaceChildren(...rows.map((r) => {
    const li = el("li", r.status);
    const body = el("div");
    body.append(el("b", "", r.title), el("span", "", r.text || "—"));
    li.append(icon(STATUS_ICON[r.status]), body);
    return li;
  }));

  // Nişan yekun bala görə: rəsmi sayt → yaşıl; qalanları eyni 0-100 şkalası ilə
  const DOM_LEVEL = { crit: ["Kritik risk", "crit"], high: ["Yüksək risk", "high"], sus: ["Şübhəli sayt", "sus"], safe: ["Təhlükə əlaməti tapılmadı", "safe"] };
  const [vt, lv] = u.official ? ["Rəsmi sayt", "safe"] : u.messenger ? LINK_VERDICT.messenger : DOM_LEVEL[levelOf(data.score).key];
  setLv($("domBadge"), lv);
  $("domBadgeText").textContent = vt;
  $("domName").textContent = u.reg || u.host;
  $("domSub").textContent = u.host && u.host !== u.reg ? `Tam ünvan: ${u.host}` : "Yoxlanılan domen";
  $("domScore").textContent = String(data.score);

  const foot = $("domFoot");
  foot.replaceChildren();
  if (!u.official && !u.messenger && u.registry !== "missing") {
    const acts = el("div", "lactions");
    acts.append(shotButton(u, foot));
    foot.append(acts);
  }
  if (u.verdict === "danger" || u.verdict === "suspicious") foot.append(blacklistBlock(u));
  foot.hidden = !foot.childElementCount;
  $("domReport").hidden = false;
  reveal($("domReport"));
}

/* =====================================================================
   5. Aktiv təhdidlər: son 24 saatın real kampaniyaları (/api/today)
   ===================================================================== */
const WANTS = {
  "SMS kodunuzu istəyir": ["Hesab oğurluğu", "SMS kodunu heç kimə deməyin, bank əməkdaşına da."],
  "kart məlumatı istəyir": ["Fişinq", "Kart məlumatını linkdəki saytda yazmayın."],
  "pul köçürməyi istəyir": ["Pul tələbi", "Pul köçürməzdən əvvəl qarşı tərəfə özünüz zəng edib yoxlayın."],
  "yaxınınız kimi yazır": ["Yaxın təqlidi", "Yaxınınızın köhnə nömrəsinə zəng edib soruşun."],
  "asan qazanc vəd edir": ["Saxta iş təklifi", "«Tapşırıq» və «depozit» üçün pul ödəməyin."],
  "yatırım gəliri vəd edir": ["İnvestisiya fırıldağı", "Zəmanətli gəlir vəd edən təkliflərə pul köçürməyin."],
  "hədiyyə vəd edir": ["Saxta hədiyyə", "«Hədiyyə» üçün kart məlumatı və ödəniş tələb olunmur."],
  "dövlət yardımı vəd edir": ["Saxta yardım", "Dövlət yardımı üçün kart məlumatı mesajla istənmir."],
  "bağlama bəhanəsi ilə yazır": ["Saxta çatdırılma", "Bağlamanı yalnız poçtun rəsmi saytında yoxlayın."],
  "WhatsApp / Telegram-a çağırır": ["Messencer tələsi", "Tanımadığınız adama WhatsApp və ya Telegram-da yazmayın."],
};
function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "indicə";
  if (s < 3600) return `${Math.round(s / 60)} dəq əvvəl`;
  return `${Math.round(s / 3600)} saat əvvəl`;
}
const todaySeen = new Map();
let todayFirst = true;

function threatCard(x) {
  const card = el("article", "card threat");
  const wants = x.wants || [];
  const brandFake = /adından saxta mesaj$/.test(x.label || "");
  const [cat, action] = brandFake && !wants.length ? ["Brend təqlidi", "Linkə basmayın, kod və kart məlumatı verməyin."]
    : WANTS[wants[0]] || [brandFake ? "Brend təqlidi" : "Fişinq", "Linkə basmayın, kod və kart məlumatı verməyin."];
  const top = el("div", "th-top");
  top.append(badge("Yüksək risk", "high"), el("span", "badge", brandFake ? "Brend təqlidi" : cat));
  card.append(top, el("h3", "", x.label));
  card.append(el("p", "th-desc", wants.length ? "Nə istəyir: " + wants.join(", ") + "." : "Yüksək riskli fırıldaq mesajı."));
  const meta = el("dl", "th-meta");
  const m = (k, v) => { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); meta.append(d); };
  m("Son qeyd", `${ago(x.last)} (${hm(new Date(x.last))})`);
  m("Yoxlama sayı", `${x.count} dəfə`);
  m("Mənbə", "ScamShield");
  card.append(meta);
  const doms = x.domains?.length ? x.domains : x.domain ? [x.domain] : [];
  if (doms.length) {
    const s = el("p", "th-sites", (doms.length > 1 ? `${doms.length} sayt: ` : "Sayt: ") + doms.join(", "));
    card.append(s);
  }
  const act = el("p", "th-action");
  act.append(icon("shield-check"), el("span", "", action));
  card.append(act);
  const prev = todaySeen.get(x.label);
  if (!todayFirst && prev !== x.count) {
    card.classList.add(prev === undefined ? "slidein" : "flash");
    setTimeout(() => card.classList.remove("slidein", "flash"), 2500);
  }
  todaySeen.set(x.label, x.count);
  return card;
}

function renderToday(d) {
  const items = d.items || [];
  $("thError").hidden = true;
  $("thList").replaceChildren(...items.map(threatCard));
  $("thList").hidden = !items.length;
  $("thEmpty").hidden = items.length > 0;
  $("fdTotal").textContent = String(d.total || 0);
  $("fdHigh").textContent = String(d.high || 0);
  $("fdTime").textContent = hm(new Date());
  todayFirst = false;
}
function loadToday() {
  fetch("/api/today", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then(renderToday)
    .catch(() => {
      if (!todayFirst) return; // əvvəlki siyahı qalsın
      $("thList").hidden = true;
      $("thEmpty").hidden = true;
      $("thError").hidden = false;
    });
}
$("thRetry").addEventListener("click", () => { $("thError").hidden = true; $("thList").hidden = false; loadToday(); });
loadToday();
setInterval(() => { if (!document.hidden) loadToday(); }, 30_000);

/* =====================================================================
   6. Akademiya
   ===================================================================== */
const dlg = $("lessonDlg");
let lastLessonBtn = null;

function renderAcademy() {
  $("acadGrid").replaceChildren(...LESSONS.map((l) => {
    const card = el("article", "card lesson");
    const ic = el("span", "lesson-ic");
    ic.append(icon(l.icon));
    const meta = el("div", "lesson-meta");
    const time = el("span", "time");
    time.append(icon("clock"), el("span", "", `${l.minutes} dəq oxu`));
    meta.append(el("span", "badge " + (l.level === 1 ? "lv-safe" : "lv-sus"), LEVELS[l.level]), time);
    const b = el("button", "btn btn-text");
    b.type = "button";
    b.append(el("span", "", "Ətraflı oxu"), icon("arrow-right"));
    b.setAttribute("aria-haspopup", "dialog");
    b.addEventListener("click", () => openLesson(l, b));
    card.append(ic, meta, el("h3", "", l.title), el("p", "", l.summary), b);
    return card;
  }));
}

function openLesson(l, from) {
  lastLessonBtn = from;
  const body = $("dlgBody");
  const head = el("div", "dlg-head");
  const left = el("div");
  const meta = el("div", "lesson-meta");
  const time = el("span", "time");
  time.append(icon("clock"), el("span", "", `${l.minutes} dəq oxu`));
  meta.append(el("span", "badge " + (l.level === 1 ? "lv-safe" : "lv-sus"), LEVELS[l.level]), time);
  const h = el("h3", "", l.title);
  h.id = "dlgTitle";
  left.append(meta, h);
  const close = el("button", "btn btn-ghost btn-icon");
  close.type = "button";
  close.setAttribute("aria-label", "Bağla");
  close.append(icon("x"));
  close.addEventListener("click", () => dlg.close());
  head.append(left, close);
  const list = (items, cls, ic) => {
    const ul = el("ul", "dlg-list " + cls);
    items.forEach((s) => { const li = el("li"); li.append(icon(ic), el("span", "", s)); ul.append(li); });
    return ul;
  };
  const parts = [head, el("p", "lead", l.summary), el("h4", "", "Necə tanımaq olar?"), list(l.signs, "signs", "alert"), el("h4", "", "Nə etməli?"), list(l.actions, "", "check-circle")];
  if (l.example) {
    const ex = el("div", "dlg-example");
    const exText = el("span", "", l.example);
    ex.append(el("small", "", "Nümunə fırıldaq mesajı"), exText);
    parts.push(el("h4", "", "Nümunə"), ex);
  }
  const foot = el("div", "dlg-foot");
  const play = el("a", "btn btn-primary btn-sm");
  play.href = "/oyun";
  play.append(icon("target", "ic ic-sm"), el("span", "", "Özünüzü sınayın"));
  const check = el("a", "btn btn-ghost btn-sm");
  check.href = "#yoxla";
  check.append(icon("search", "ic ic-sm"), el("span", "", "Mesajı yoxla"));
  check.addEventListener("click", () => dlg.close());
  foot.append(play, check);
  parts.push(foot);
  body.replaceChildren(...parts);
  dlg.showModal();
  close.focus();
}
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener("close", () => { if (lastLessonBtn) lastLessonBtn.focus(); });
renderAcademy();

/* =====================================================================
   7. İcma bildirişi: moderasiya növbəsinə düşür, avtomatik dərc olunmur
   ===================================================================== */
const REP = {
  phone: { label: "Telefon nömrəsi", ph: "+994 50 123 45 67", rows: 1 },
  website: { label: "Saytın ünvanı", ph: "məsələn: azerpost-catdirilma.top", rows: 1 },
  message: { label: "Mesajın mətni", ph: "Fırıldaq mesajını olduğu kimi yapışdırın", rows: 4 },
  campaign: { label: "Kampaniyanın təsviri", ph: "Məsələn: «Azərpoçt» adından 0,99 AZN ödəniş istəyən SMS-lər yayılır, link: …", rows: 4 },
};
const repForm = $("repForm");
const repValue = $("repValue");
const pageLoaded = Date.now();
const repType = () => repForm.querySelector('input[name="rtype"]:checked')?.value || "phone";

function applyRepType() {
  const c = REP[repType()];
  $("repValueLabel").textContent = c.label;
  repValue.placeholder = c.ph;
  repValue.rows = c.rows;
  repValue.classList.toggle("single", c.rows === 1);
}
function repFieldError(text) {
  $("repValueErr").replaceChildren(...(text ? [icon("alert", "ic ic-sm"), el("span", "", text)] : []));
  $("repValueErr").hidden = !text;
  if (text) repValue.setAttribute("aria-invalid", "true"); else repValue.removeAttribute("aria-invalid");
}
function repError(text) {
  $("repErr").replaceChildren(...(text ? [icon("alert", "ic ic-sm"), el("span", "", text)] : []));
  $("repErr").hidden = !text;
}
repForm.querySelectorAll('input[name="rtype"]').forEach((r) => r.addEventListener("change", () => { applyRepType(); repFieldError(""); $("repOk").hidden = true; }));
repValue.addEventListener("input", () => repFieldError(""));
repValue.addEventListener("keydown", (e) => { if (e.key === "Enter" && REP[repType()].rows === 1) { e.preventDefault(); repForm.requestSubmit(); } });

function validateReport(type, value) {
  if (!value) return "Bu sahəni doldurun.";
  if (type === "phone") {
    const d = value.replace(/\D/g, "");
    if (d.length < 7 || d.length > 15 || /[a-zəıöüğşç]/i.test(value)) return "Nömrəni ölkə kodu ilə yazın. Məsələn: +994 50 123 45 67";
  }
  if (type === "website" && (/\s/.test(value) || !DOMAIN_RE.test(value))) return "Saytın ünvanını yazın. Məsələn: sayt.az";
  if (type === "message" && value.length < 15) return "Mesajın mətnini tam yapışdırın (ən azı 15 simvol).";
  if (type === "campaign" && value.length < 20) return "Kampaniyanı bir-iki cümlə ilə təsvir edin (ən azı 20 simvol).";
  return null;
}

repForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("repOk").hidden = true;
  repError("");
  const type = repType();
  const value = repValue.value.trim();
  const err = validateReport(type, value);
  if (err) { repFieldError(err); repValue.focus(); return; }
  if (!$("repConsent").checked) { repError("Göndərməzdən əvvəl təsdiq qutusunu işarələyin."); $("repConsent").focus(); return; }
  const b = $("repBtn");
  b.disabled = true;
  try {
    await postJson("/api/community/report", {
      type, value, note: $("repNote").value.trim(), company: $("repHp").value, elapsed: Date.now() - pageLoaded,
    });
    repValue.value = "";
    $("repNote").value = "";
    $("repConsent").checked = false;
    $("repOkText").textContent = "Təşəkkürlər! Bildirişiniz moderasiya növbəsinə düşdü. Yoxlanılmadan heç yerdə dərc olunmayacaq.";
    $("repOk").hidden = false;
    toast("Bildirişiniz göndərildi.");
  } catch (err2) {
    repError(err2.status === 404 ? "Bildiriş xidməti hazırda əlçatan deyil. Bir az sonra yenidən cəhd edin." : netMsg(err2));
  } finally {
    b.disabled = false;
  }
});

/* =====================================================================
   8. Sınaq rəqəmləri: görünəndə sayılır
   ===================================================================== */
const statNums = [...document.querySelectorAll("[data-count]")];
if ("IntersectionObserver" in window) {
  statNums.forEach((n) => { n.textContent = "0"; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countUp(en.target, Number(en.target.dataset.count), 1100);
      io.unobserve(en.target);
    });
  }, { threshold: 0.6 });
  statNums.forEach((n) => io.observe(n));
}

/* =====================================================================
   9. Telegram botunun adı serverdən (dəyişərsə linklər özü yenilənsin)
   ===================================================================== */
fetch("/api/config").then((r) => r.json()).then((c) => {
  if (!c.bot) return;
  const href = `https://t.me/${c.bot}`;
  document.querySelectorAll(".tg-link").forEach((a) => { a.href = href; });
  $("guardBtn").href = `${href}?start=qoru`;
  $("tgHandle").textContent = "@" + c.bot;
}).catch(() => { /* standart link qalır */ });


setMode("msg");
applyRepType();
setCount();
