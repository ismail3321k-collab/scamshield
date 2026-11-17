// "Təhlükəni aşkar et" oyunu: suallar serverdən gəlir, cavab və izah yalnız cavab verdikdən sonra, xal serverdə hesablanır.
import { confetti } from "/confetti.js";
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* yox */ } },
};

let session = null, i = 0, score = 0, correctCount = 0, answered = false, busy = false;
const results = [];
let company = (new URLSearchParams(location.search).get("kod") || store.get("ayiq-company")).toUpperCase().slice(0, 16);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Bağlantı xətası. Yenidən cəhd edin.");
  return d;
}

// Mətndə tələ (qırmızı) və yaxşı əlamət (yaşıl) ifadələrini işarələyir
function marked(text, bad = [], good = []) {
  const ranges = [];
  for (const [list, cls] of [[bad, "bad"], [good, "good"]]) {
    for (const p of list) {
      const s = text.indexOf(p);
      if (s >= 0) ranges.push({ s, e: s + p.length, cls });
    }
  }
  ranges.sort((a, b) => a.s - b.s);
  const out = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.s < pos) continue;
    if (r.s > pos) out.push(document.createTextNode(text.slice(pos, r.s)));
    out.push(el("mark", r.cls, text.slice(r.s, r.e)));
    pos = r.e;
  }
  if (pos < text.length) out.push(document.createTextNode(text.slice(pos)));
  return out;
}

function dots() {
  $("gDots").replaceChildren(...session.questions.map((_, k) => {
    const done = results[k] !== undefined;
    return el("li", done ? (results[k] ? "ok" : "bad") : k === i ? "cur" : "");
  }));
}

function setPoints(n, streak = 0) {
  const node = $("gPoints");
  node.textContent = `${n} xal` + (streak >= 2 ? ` · 🔥 ${streak} ardıcıl` : "");
  node.classList.remove("bump");
  void node.offsetWidth;
  node.classList.add("bump");
}

// "+10" yuxarı uçan yazı
function floatGain(text) {
  if (reduced) return;
  const f = el("span", "g-float", text);
  $("gPoints").after(f);
  setTimeout(() => f.remove(), 1100);
}

function swap(node) {
  node.classList.remove("swap");
  void node.offsetWidth;
  node.classList.add("swap");
}

function show() {
  answered = false;
  const q = session.questions[i];
  $("gStep").textContent = `${i + 1} / ${session.questions.length}`;
  dots();
  $("gCh").textContent = q.channel;
  $("gFrom").textContent = q.from;
  $("gFrom").className = "";
  $("gText").replaceChildren(document.createTextNode(q.text));
  $("gActions").hidden = false;
  $("gScam").disabled = false;
  $("gSafe").disabled = false;
  $("gFeedback").hidden = true;
  $("gError").hidden = true;
  swap($("game"));
}

async function answer(saysScam) {
  if (answered || busy) return;
  busy = true;
  $("gScam").disabled = true;
  $("gSafe").disabled = true;
  let r;
  try {
    r = await api("/api/quiz/answer", { id: session.id, i, answer: saysScam ? "scam" : "safe" });
  } catch (e) {
    busy = false;
    $("gScam").disabled = false;
    $("gSafe").disabled = false;
    $("gError").textContent = e.message;
    $("gError").hidden = false;
    return;
  }
  busy = false;
  answered = true;
  results[i] = r.correct;
  score = r.score;
  correctCount = r.correctCount;
  setPoints(score, r.correct ? r.streak : 0);
  if (r.correct) {
    floatGain(`+${r.points}`);
    confetti({ count: r.bonus ? 70 : 40, y: 0.55 });
  }
  const q = session.questions[i];
  $("gActions").hidden = true;
  $("gText").replaceChildren(...marked(q.text, r.flags, r.good));
  $("gText").querySelectorAll("mark").forEach((m) => m.classList.add("sweep"));
  if (r.fromFlag) $("gFrom").className = "flag";
  $("gVerdict").textContent = r.correct ? "✅ Düzdür!" : "❌ Səhv.";
  $("gVerdict").className = "g-verdict " + (r.correct ? "ok" : "no");
  $("gGain").textContent = r.correct ? `+${r.points} xal${r.bonus ? ` (ardıcıl ${r.streak} düzgün: +${r.bonus} bonus)` : ""}` : "0 xal";
  $("gGain").className = "g-gain " + (r.correct ? "ok" : "");
  $("gTruth").textContent = r.scam ? "Bu mesaj fırıldaqdır. Tələ əlamətləri qırmızı ilə işarələnib:" : "Bu mesaj təhlükəsizdir:";
  $("gWhy").replaceChildren(...r.why.map((w) => el("li", "", w)));
  $("gLesson").textContent = "💡 " + r.lesson;
  $("gNext").textContent = i + 1 < session.questions.length ? "Növbəti" : "Nəticəni gör";
  $("gFeedback").hidden = false;
  dots();
  swap($("gFeedback"));
  $("gNext").focus({ preventScroll: true });
  $("gFeedback").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
}

function countUp(node, to) {
  if (reduced) { node.textContent = to; return; }
  const t0 = performance.now(), dur = 700;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function finish() {
  const total = session.questions.length;
  $("game").hidden = true;
  const r = $("gResult");
  r.hidden = false;
  $("gShareNote").hidden = true;
  countUp($("gScore"), score);
  const badge = correctCount === total ? "🏅 Fırıldaq ovçusu" : correctCount >= total - 1 ? "🥈 Diqqətli oyunçu" : "📚 Bir az məşq lazımdır";
  $("gBadge").textContent = badge;
  $("gBadge").className = "g-badge " + (correctCount >= total - 1 ? "win" : "");
  $("gBadge").hidden = false;
  if (correctCount >= total - 1) setTimeout(() => confetti({ count: correctCount === total ? 160 : 90, y: 0.35, spread: 1.4 }), 300);
  const verdict = correctCount === total
    ? "Əla! Fırıldaqçılar sizi aldada bilməz."
    : correctCount === total - 1
      ? "Yaxşıdır, amma bir tələ sizi aldada bilərdi. Şübhəli mesajı həmişə əvvəl ScamShield-də yoxlayın."
      : "Diqqət: fırıldaqçılar çox inandırıcı yazır. Şübhəli mesajı həmişə əvvəl ScamShield-də yoxlayın.";
  $("gResultText").textContent = `${total} mesajdan ${correctCount} düzgün. ${verdict}`;
  $("gNick").value = store.get("ayiq-nick");
  $("gCompany").value = company;
  $("gForm").hidden = false;
  $("gSave").disabled = false;
  $("gFormMsg").hidden = true;
  swap(r);
  r.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

async function newRound() {
  $("gResult").hidden = true;
  $("game").hidden = false;
  $("gText").textContent = "Yüklənir…";
  $("gScam").disabled = true;
  $("gSafe").disabled = true;
  $("gFeedback").hidden = true;
  results.length = 0;
  i = 0;
  score = 0;
  correctCount = 0;
  setPoints(0);
  try {
    session = await api("/api/quiz/start", {});
  } catch (e) {
    $("gText").textContent = e.message;
    return;
  }
  show();
}

// Cədvəl
function monthLabel(m) {
  const [y, mm] = (m || "").split("-");
  return MONTHS[Number(mm) - 1] ? `${MONTHS[Number(mm) - 1]} ${y}` : "";
}

function renderBoard(d, me) {
  $("bTitle").textContent = d.company ? `«${d.company}» cədvəli · ${monthLabel(d.month)}` : `Ümumi cədvəl · ${monthLabel(d.month)}`;
  const list = d.leaders || [];
  const top = $("bTop");
  if (list.length) {
    top.replaceChildren(el("span", "b-crown", "🏆"), el("span", "", "Ayın ən ayıq oyunçusu: "), el("b", "", list[0].nick), el("span", "", ` · ${list[0].score} xal`));
    top.hidden = false;
  } else top.hidden = true;
  $("bList").replaceChildren(...list.map((x) => {
    const li = el("li", x.nick === me ? "me" : "");
    li.append(el("span", "b-nick", x.nick + (!d.company && x.company ? ` · ${x.company}` : "")), el("span", "b-score", `${x.score} xal`));
    return li;
  }));
  [...$("bList").children].forEach((li, k) => { li.style.animationDelay = reduced ? "0ms" : `${k * 60}ms`; li.classList.add("slide"); });
  $("bEmpty").hidden = list.length > 0;
  $("bMeta").textContent = d.players ? `Bu ay cədvələ düşən: ${d.players}` : "";
  $("bCompany").value = d.company || "";
}

async function loadBoard(code, me) {
  try { renderBoard(await api(`/api/quiz/leaders?company=${encodeURIComponent(code || "")}`), me); } catch { /* cədvəl açılmadı */ }
}

$("gScam").addEventListener("click", () => answer(true));
$("gSafe").addEventListener("click", () => answer(false));
$("gNext").addEventListener("click", () => {
  i++;
  if (i < session.questions.length) {
    show();
    $("game").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  } else finish();
});
$("gAgain").addEventListener("click", newRound);

$("gForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("gFormMsg");
  const nick = $("gNick").value.trim();
  const code = $("gCompany").value.trim().toUpperCase();
  $("gSave").disabled = true;
  try {
    const d = await api("/api/quiz/finish", { id: session.id, nick, company: code });
    store.set("ayiq-nick", d.nick);
    if (code) { company = code; store.set("ayiq-company", code); }
    msg.textContent = d.rank ? `Cədvələ yazıldı! Yeriniz: ${d.rank}.` : "Cədvələ yazıldı!";
    msg.className = "g-formmsg ok";
    $("gForm").querySelectorAll("input").forEach((x) => { x.disabled = true; });
    renderBoard(d, d.nick);
    $("cedvel").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "g-formmsg err";
    $("gSave").disabled = false;
  }
  msg.hidden = false;
});

$("bFilter").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = $("bCompany").value.trim().toUpperCase();
  loadBoard(code, store.get("ayiq-nick"));
});

$("gShare").addEventListener("click", async () => {
  const url = location.origin + "/oyun" + (company ? `?kod=${encodeURIComponent(company)}` : "");
  const text = `Fırıldaq mesajını tanıya bilərsən? Mən ${score} xal topladım. Sən də yoxla:`;
  const note = $("gShareNote");
  if (navigator.share) {
    try { await navigator.share({ title: "Təhlükəni aşkar et", text, url }); return; } catch { /* ləğv edildi */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    note.textContent = "Link kopyalandı. İndi dostlarınıza WhatsApp və ya Telegram-da göndərin.";
  } catch {
    note.textContent = `Bu linki dostlarınıza göndərin: ${url}`;
  }
  note.hidden = false;
});

// Yenidən oynayanda forma inputları yenidən aktiv olsun
$("gAgain").addEventListener("click", () => $("gForm").querySelectorAll("input").forEach((x) => { x.disabled = false; }));

// Oyun «Oyuna başla» düyməsi ilə başlayır
$("gStartBtn").addEventListener("click", () => {
  $("gStart").hidden = true;
  newRound();
  $("game").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
});
loadBoard(company, store.get("ayiq-nick"));
