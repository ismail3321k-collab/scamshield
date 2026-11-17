// "Təhlükəni aşkar et" oyunu: suallar serverdən gəlir, cavab və izah yalnız cavab verdikdən sonra, xal serverdə hesablanır.
// Axın: «Sınağa başla» → ad, soyad, şirkət kodu → 10 sual → nəticə avtomatik ayın cədvəlinə yazılır.
import { confetti } from "/confetti.js";
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];

const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* yox */ } },
};

let session = null, i = 0, score = 0, correctCount = 0, answered = false, busy = false, starting = false, saving = false;
const results = [];
// Oyunçu: son yazılan ad / soyad / kod yadda qalır; linkdəki ?kod= (məs. /oyun?kod=OYU) üstündür
const player = {
  name: store.get("ayiq-ad"),
  surname: store.get("ayiq-soyad"),
  company: (new URLSearchParams(location.search).get("kod") || store.get("ayiq-company")).trim().toUpperCase().slice(0, 16),
};
// Cədvəldə vurğulanan sətir: bu cihazda sonuncu oynayan
let me = { nick: player.name && player.surname ? `${player.name} ${player.surname}` : "", company: store.get("ayiq-company") };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  } catch {
    throw Object.assign(new Error("Bağlantı xətası. İnterneti yoxlayıb yenidən cəhd edin."), { status: 0 });
  }
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(d.error || "Bağlantı xətası. Yenidən cəhd edin."), { status: res.status, field: d.field });
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

function scrollTo(node, block = "start") {
  node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block });
}

// Oyunçu forması: ad, soyad, istəyə bağlı şirkət kodu
const FIELDS = { name: "gName", surname: "gSurname", company: "gCompany" };

function clearWhoError() {
  $("gWhoMsg").hidden = true;
  Object.values(FIELDS).forEach((id) => $(id).removeAttribute("aria-invalid"));
}

function whoError(text, field) {
  const msg = $("gWhoMsg");
  msg.textContent = text;
  msg.hidden = false;
  const input = $(FIELDS[field]);
  if (input) {
    input.setAttribute("aria-invalid", "true");
    input.focus({ preventScroll: true });
  }
  scrollTo($("gWho"), "nearest");
}

function openWho(newPlayer = false) {
  if (newPlayer) { player.name = ""; player.surname = ""; }
  $("gName").value = player.name;
  $("gSurname").value = player.surname;
  $("gCompany").value = player.company;
  clearWhoError();
  $("gStart").hidden = true;
  $("game").hidden = true;
  $("gResult").hidden = true;
  $("gWho").hidden = false;
  swap($("gWho"));
  const first = !player.name ? $("gName") : !player.surname ? $("gSurname") : $("gGo");
  first.focus({ preventScroll: true });
  scrollTo($("gWho"), "nearest");
}

// Yeni tur: ad serverdə əvvəlcədən yoxlanılır (səhv olsa, dərhal deyirik), sonra 10 sual gəlir
async function startRound(who, btn, msg) {
  if (starting) return;
  starting = true;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Yüklənir…";
  msg.hidden = true;
  let d;
  try {
    d = await api("/api/quiz/start", who);
  } catch (e) {
    starting = false;
    btn.disabled = false;
    btn.textContent = label;
    if (e.field) {
      if ($("gWho").hidden) openWho();
      whoError(e.message, e.field);
    } else {
      msg.textContent = e.message;
      msg.hidden = false;
    }
    return;
  }
  starting = false;
  btn.disabled = false;
  btn.textContent = label;
  Object.assign(player, who, d.player ? { name: d.player.name, surname: d.player.surname, company: d.player.company } : {});
  store.set("ayiq-ad", player.name);
  store.set("ayiq-soyad", player.surname);
  store.set("ayiq-company", player.company);
  if ($("bCompany").value !== player.company) loadBoard(player.company);
  session = d;
  results.length = 0;
  i = 0;
  score = 0;
  correctCount = 0;
  $("gStart").hidden = true;
  $("gWho").hidden = true;
  $("gResult").hidden = true;
  $("game").hidden = false;
  setPoints(0);
  show();
  scrollTo($("game"));
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

const label = (nick, code) => nick + (code ? ` · ${code}` : "");

function finish() {
  const total = session.questions.length;
  $("game").hidden = true;
  const r = $("gResult");
  r.hidden = false;
  $("gShareNote").hidden = true;
  $("gAgainMsg").hidden = true;
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
  $("gPlayer").textContent = label(`${player.name} ${player.surname}`, player.company);
  swap(r);
  scrollTo(r);
  save();
}

// Nəticə avtomatik cədvələ yazılır; şəbəkə xətasında «Yenidən cəhd et»
async function save() {
  if (saving) return;
  saving = true;
  const msg = $("gSaveMsg");
  msg.textContent = "Cədvələ yazılır…";
  msg.className = "g-formmsg";
  $("gRetry").hidden = true;
  try {
    const d = await api("/api/quiz/finish", { id: session.id, name: player.name, surname: player.surname, company: player.company });
    me = { nick: d.nick, company: d.company || "" };
    msg.textContent = (d.rank ? `Cədvələ yazıldı! Yeriniz: ${d.rank}.` : "Cədvələ yazıldı!")
      + (d.best > d.score ? ` Cədvəldə ən yaxşı nəticəniz göstərilir: ${d.best} xal.` : "");
    msg.className = "g-formmsg ok";
    renderBoard(d, { rank: d.rank, nick: d.nick, company: d.company, score: d.best ?? d.score });
  } catch (e) {
    if (e.status === 409) {
      // Əvvəlki cəhd serverə çatıb: nəticə artıq yazılıb
      me = { nick: `${player.name} ${player.surname}`, company: player.company };
      msg.textContent = "Cədvələ yazıldı!";
      msg.className = "g-formmsg ok";
      loadBoard(player.company);
    } else {
      msg.textContent = e.message;
      msg.className = "g-formmsg err";
      $("gRetry").hidden = !(e.status === 0 || e.status === 429 || e.status >= 500);
    }
  }
  saving = false;
}

// Cədvəl
function monthLabel(m) {
  const [y, mm] = (m || "").split("-");
  return MONTHS[Number(mm) - 1] ? `${MONTHS[Number(mm) - 1]} ${y}` : "";
}

function boardRow(x, code) {
  const li = el("li", me.nick && x.nick === me.nick && code === (me.company || "") ? "me" : "");
  const row = el("div", "b-row");
  row.append(el("span", "b-nick", label(x.nick, code)), el("span", "b-score", `${x.score} xal`));
  li.append(row);
  return li;
}

// mine: cədvələ indicə yazılan oyunçu; ilk 10-dan kənardadırsa, öz yeri ilə sonda göstərilir
function renderBoard(d, mine = null) {
  $("bTitle").textContent = d.company ? `«${d.company}» cədvəli · ${monthLabel(d.month)}` : `Ümumi cədvəl · ${monthLabel(d.month)}`;
  const list = d.leaders || [];
  const top = $("bTop");
  if (list.length) {
    top.replaceChildren(el("span", "b-crown", "🏆"), el("span", "", "Ayın ən ayıq oyunçusu: "), el("b", "", label(list[0].nick, d.company ? "" : list[0].company)), el("span", "", ` · ${list[0].score} xal`));
    top.hidden = false;
  } else top.hidden = true;
  const rows = list.map((x) => boardRow(x, d.company || x.company || ""));
  if (mine?.rank && list.length && mine.rank > list.length) {
    if (mine.rank > list.length + 1) {
      const gap = el("li", "b-gap", "…");
      gap.setAttribute("aria-hidden", "true");
      rows.push(gap);
    }
    const li = boardRow({ nick: mine.nick, score: mine.score }, d.company || mine.company || "");
    li.value = mine.rank;
    rows.push(li);
  }
  $("bList").replaceChildren(...rows);
  rows.forEach((li, k) => { li.style.animationDelay = reduced ? "0ms" : `${k * 60}ms`; li.classList.add("slide"); });
  $("bEmpty").hidden = list.length > 0;
  $("bMeta").textContent = d.players ? `Bu ay cədvələ düşən: ${d.players}` : "";
  $("bCompany").value = d.company || "";
}

async function loadBoard(code) {
  try { renderBoard(await api(`/api/quiz/leaders?company=${encodeURIComponent(code || "")}`)); } catch { /* cədvəl açılmadı */ }
}

$("gScam").addEventListener("click", () => answer(true));
$("gSafe").addEventListener("click", () => answer(false));
$("gNext").addEventListener("click", () => {
  i++;
  if (i < session.questions.length) {
    show();
    scrollTo($("game"));
  } else finish();
});

// «Sınağa başla» → oyunçu forması
$("gStartBtn").addEventListener("click", () => openWho());

$("gWhoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  clearWhoError();
  const who = {
    name: $("gName").value.trim(),
    surname: $("gSurname").value.trim(),
    company: $("gCompany").value.trim().toUpperCase(),
  };
  if (!who.name) return whoError("Adınızı yazın.", "name");
  if (!who.surname) return whoError("Soyadınızı yazın.", "surname");
  startRound(who, $("gGo"), $("gWhoMsg"));
});
Object.values(FIELDS).forEach((id) => $(id).addEventListener("input", () => $(id).removeAttribute("aria-invalid")));

// «Yenidən oyna»: eyni adla yeni tur; «Başqa oyunçu»: formanı boş adla açır (şirkət kodu qalır)
$("gAgain").addEventListener("click", () => startRound({ name: player.name, surname: player.surname, company: player.company }, $("gAgain"), $("gAgainMsg")));
$("gOther").addEventListener("click", () => openWho(true));
$("gRetry").addEventListener("click", save);

$("bFilter").addEventListener("submit", (e) => {
  e.preventDefault();
  loadBoard($("bCompany").value.trim().toUpperCase());
});

$("gShare").addEventListener("click", async () => {
  const url = location.origin + "/oyun" + (player.company ? `?kod=${encodeURIComponent(player.company)}` : "");
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

loadBoard(player.company);
