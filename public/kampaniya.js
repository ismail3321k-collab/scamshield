// Komanda Məşqi — fişinq simulyasiyası (DEMO).
// Həqiqi e-poçt göndərilmir, həqiqi şəxs izlənmir. Hər şey brauzerdə, nümunə məlumatla işləyir.
const $ = (id) => document.getElementById(id);
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- Nümunə komanda (uydurma adlar + nümunə domen) ---
const PEOPLE = [
  { id: 1, name: "Aysel Məmmədova", mail: "aysel@sirket-numune.az" },
  { id: 2, name: "Elvin Quliyev", mail: "elvin@sirket-numune.az" },
  { id: 3, name: "Nigar Rəhimli", mail: "nigar@sirket-numune.az" },
  { id: 4, name: "Rəşad Tağıyev", mail: "resad@sirket-numune.az" },
  { id: 5, name: "Günel Səlimova", mail: "gunel@sirket-numune.az" },
  { id: 6, name: "Orxan Vəliyev", mail: "orxan@sirket-numune.az" },
  { id: 7, name: "Leyla Hüseynova", mail: "leyla@sirket-numune.az" },
  { id: 8, name: "Tural Abbasov", mail: "tural@sirket-numune.az" },
];

// --- Məşq şablonları (link təhlükəsiz təlim səhifəsinə gedir) ---
const SAFE_LINK = "scamshield-az.pages.dev/mesq/təlim";
const TEMPLATES = [
  {
    id: "azerpost", name: "Azərpoçt — bağlama bəhanəsi",
    desc: "Çatdırılma/gömrük tələsi. Ən çox işlənən növ.",
    subj: "Bağlamanız gömrükdə saxlanılıb",
    body: (n) => `Salam ${n},\nBağlamanız gömrükdə saxlanılıb. 24 saat ərzində ünvanı təsdiqləyin, əks halda geri qaytarılacaq:\n${SAFE_LINK}`,
  },
  {
    id: "bank", name: "Bank — təhlükəsizlik xəbərdarlığı",
    desc: "Hesabda «şübhəli əməliyyat», təcili təsdiq.",
    subj: "Hesabınızda şübhəli əməliyyat aşkarlandı",
    body: (n) => `Hörmətli ${n},\nHesabınızda şübhəli əməliyyat aşkarlandı. Kartın bloklanmaması üçün dərhal təsdiqləyin:\n${SAFE_LINK}`,
  },
  {
    id: "hr", name: "HR — maaş düzəlişi",
    desc: "Daxili e-poçt kimi görünür, daha inandırıcı.",
    subj: "Noyabr maaş cədvəlinə düzəliş",
    body: (n) => `Salam ${n},\nNoyabr ayı üzrə maaş cədvəlinizdə düzəliş edilib. Yeni cədvələ buradan baxın:\n${SAFE_LINK}`,
  },
];

const selected = new Set(PEOPLE.map((p) => p.id)); // başlanğıcda hamısı seçili
let tmpl = TEMPLATES[0];
let running = false;
const rows = new Map(); // id -> {status, clicked}

const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const now = () => new Date().toLocaleTimeString("az", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- Addım 1: alıcılar ----------
function renderPeople() {
  $("rcList").replaceChildren(...PEOPLE.map((p) => {
    const row = document.createElement("label");
    row.className = "rcpt";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.checked = selected.has(p.id);
    cb.addEventListener("change", () => { cb.checked ? selected.add(p.id) : selected.delete(p.id); updateCount(); });
    const av = document.createElement("span"); av.className = "av"; av.textContent = initials(p.name);
    const who = document.createElement("span"); who.className = "who";
    who.innerHTML = `<b></b><span></span>`;
    who.querySelector("b").textContent = p.name;
    who.querySelector("span").textContent = p.mail;
    row.append(cb, av, who);
    return row;
  }));
  updateCount();
}
function updateCount() {
  $("rcCount").textContent = `${selected.size} seçildi`;
  $("startBtn").disabled = running || selected.size === 0 || !tmpl;
}
$("rcAll").addEventListener("click", () => {
  const all = selected.size === PEOPLE.length;
  selected.clear();
  if (!all) PEOPLE.forEach((p) => selected.add(p.id));
  $("rcAll").textContent = all ? "Hamısını seç" : "Heç birini seçmə";
  renderPeople();
});

// ---------- Addım 2: şablon ----------
function renderTemplates() {
  $("tmplList").replaceChildren(...TEMPLATES.map((t) => {
    const l = document.createElement("label");
    l.className = "tmpl" + (t.id === tmpl.id ? " on" : "");
    const r = document.createElement("input");
    r.type = "radio"; r.name = "tmpl"; r.checked = t.id === tmpl.id;
    r.addEventListener("change", () => { tmpl = t; renderTemplates(); renderPreview(); });
    const box = document.createElement("span");
    box.innerHTML = `<b></b><span></span>`;
    box.querySelector("b").textContent = t.name;
    box.querySelector("span").textContent = t.desc;
    l.append(r, box);
    return l;
  }));
}
function renderPreview() {
  $("mSubj").textContent = tmpl.subj;
  const name = PEOPLE[0].name.split(" ")[0];
  const text = tmpl.body(name);
  const mb = $("mBody");
  mb.replaceChildren();
  // link sətrini ayrı göstər, qalan mətn adi
  text.split("\n").forEach((line) => {
    const div = document.createElement("div");
    if (line.includes(SAFE_LINK)) { div.className = "mlink"; div.textContent = line; }
    else div.textContent = line;
    mb.append(div);
  });
  const safe = document.createElement("span");
  safe.className = "safe";
  safe.textContent = "✓ Link təhlükəsiz təlim səhifəsinə aparır — heç bir saxta bank saytı açılmır.";
  mb.append(safe);
}

// ---------- Addım 3: simulyasiya ----------
function statusBadge(st) {
  const map = { wait: ["st-wait", "Gözləyir"], sent: ["st-sent", "Göndərildi"], open: ["st-open", "Açdı"], click: ["st-click", "Kliklədi"] };
  const [cls, label] = map[st];
  const s = document.createElement("span");
  s.className = "st " + cls; s.textContent = label;
  return s;
}
function renderResultRows() {
  $("resBody").replaceChildren(...PEOPLE.filter((p) => selected.has(p.id)).map((p) => {
    const tr = document.createElement("tr");
    tr.dataset.id = p.id;
    const td1 = document.createElement("td");
    td1.innerHTML = `<div class="who2"><b></b><br><span></span></div>`;
    td1.querySelector("b").textContent = p.name;
    td1.querySelector("span").textContent = p.mail;
    const td2 = document.createElement("td"); td2.className = "col-st"; td2.append(statusBadge("wait"));
    const td3 = document.createElement("td"); td3.className = "col-time"; td3.textContent = "—";
    const td4 = document.createElement("td"); td4.className = "col-rec"; td4.textContent = "—";
    tr.append(td1, td2, td3, td4);
    return tr;
  }));
}
function setRow(id, st, time) {
  const tr = $("resBody").querySelector(`tr[data-id="${id}"]`);
  if (!tr) return;
  tr.querySelector(".col-st").replaceChildren(statusBadge(st));
  if (time) tr.querySelector(".col-time").textContent = time;
  if (st === "click") {
    const p = PEOPLE.find((x) => x.id === id);
    const rec = tr.querySelector(".col-rec");
    rec.replaceChildren();
    const a = document.createElement("a");
    a.href = "/#akademiya"; a.className = "btn btn-ghost btn-sm";
    a.textContent = "Akademiyaya";
    rec.append(a);
  } else if (st === "open") {
    tr.querySelector(".col-rec").textContent = "izləyir";
  }
}
function updateKpis() {
  let sent = 0, open = 0, click = 0;
  rows.forEach((r) => { sent++; if (r.status === "open" || r.status === "click") open++; if (r.status === "click") click++; });
  $("kSent").textContent = sent;
  $("kOpen").textContent = open;
  $("kClick").textContent = click;
}
function feed(kind, person) {
  $("tgEmpty")?.remove();
  const b = document.createElement("div");
  b.className = "bub " + kind;
  const t = now();
  if (kind === "click") b.innerHTML = `🔴 <span class="nm"></span> linkə <b>kliklədi</b>. Həqiqi fırıldaqda kart məlumatını itirə bilərdi — təlim səhifəsinə yönləndirildi.<span class="t"></span>`;
  else b.innerHTML = `📩 <span class="nm"></span> mesajı açdı.<span class="t"></span>`;
  b.querySelector(".nm").textContent = person.name;
  b.querySelector(".t").textContent = t;
  $("tgFeed").append(b);
  $("tgFeed").scrollTop = $("tgFeed").scrollHeight;
  return t;
}

$("startBtn").addEventListener("click", () => {
  if (running) return;
  const list = PEOPLE.filter((p) => selected.has(p.id));
  if (!list.length) return;
  running = true;
  $("startBtn").disabled = true;
  rows.clear();
  $("tgFeed").replaceChildren();
  $("resCard").hidden = false;
  renderResultRows();
  list.forEach((p) => rows.set(p.id, { status: "wait", clicked: false }));
  updateKpis();

  // progress bar + "göndərildi"
  const bar = $("sendBar");
  $("sendMsg").hidden = false;
  $("sendMsg").textContent = "Simulyasiya göndərilir…";
  let prog = 0;
  const barTimer = setInterval(() => {
    prog = Math.min(100, prog + rand(12, 26));
    bar.style.width = prog + "%";
    if (prog >= 100) clearInterval(barTimer);
  }, reduce ? 40 : 160);

  // hamısı "göndərildi"
  setTimeout(() => {
    list.forEach((p, i) => {
      setTimeout(() => {
        rows.get(p.id).status = "sent";
        setRow(p.id, "sent", now());
        updateKpis();
      }, reduce ? i * 10 : i * 90);
    });
    $("sendMsg").textContent = `${list.length} nəfərə göndərildi (simulyasiya). Rəhbərin paneli kliklər üçün canlı izləyir…`;
    scheduleEngagement(list);
  }, reduce ? 150 : 900);
});

function scheduleEngagement(list) {
  const base = reduce ? 200 : 1200;
  let pending = 0;
  list.forEach((p) => {
    const willOpen = Math.random() < 0.85;
    const willClick = willOpen && Math.random() < 0.5; // ~%40-45 klik
    if (willOpen) {
      pending++;
      const openAt = base + rand(reduce ? 50 : 400, reduce ? 500 : 3200);
      setTimeout(() => {
        rows.get(p.id).status = "open";
        const t = feed("open", p);
        setRow(p.id, "open", t);
        updateKpis();
        pending--;
        if (willClick) {
          pending++;
          setTimeout(() => {
            rows.get(p.id).status = "click";
            rows.get(p.id).clicked = true;
            const t2 = feed("click", p);
            setRow(p.id, "click", t2);
            updateKpis();
            pending--;
            if (pending === 0) finish(list);
          }, rand(reduce ? 50 : 500, reduce ? 400 : 2600));
        } else if (pending === 0) finish(list);
      }, openAt);
    }
  });
  if (pending === 0) finish(list);
}

function finish(list) {
  running = false;
  updateCount();
  const clicked = [...rows.values()].filter((r) => r.clicked).length;
  const opened = [...rows.values()].filter((r) => r.status === "open" || r.status === "click").length;
  $("sendMsg").textContent = `Məşq bitdi: ${list.length} göndərildi · ${opened} açdı · ${clicked} kliklədi. Kliklədi olanlar üçün Akademiya tövsiyə olunur.`;
}

$("enrollBtn").addEventListener("click", () => {
  const clicked = [...rows.entries()].filter(([, r]) => r.clicked).map(([id]) => PEOPLE.find((p) => p.id === id).name);
  $("enrollMsg").hidden = false;
  $("enrollMsg").textContent = clicked.length
    ? `${clicked.length} işçi (${clicked.join(", ")}) ScamShield Akademiyasına qeyd olundu (demo).`
    : "Kliklədi olan yoxdur — komanda bu dəfə tələni tanıdı. Afərin!";
});

$("resetBtn").addEventListener("click", () => {
  running = false;
  rows.clear();
  $("resCard").hidden = true;
  $("sendMsg").hidden = true;
  $("enrollMsg").hidden = true;
  $("sendBar").style.width = "0";
  $("tgFeed").replaceChildren();
  const e = document.createElement("p");
  e.className = "tg-empty"; e.id = "tgEmpty";
  e.textContent = "Rəhbər yalnız panelə daxil olur. Simulyasiya başlayanda hər klik burada canlı görünür — Telegram qurmaq lazım deyil.";
  $("tgFeed").append(e);
  updateCount();
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
});

// başlat
renderPeople();
renderTemplates();
renderPreview();
