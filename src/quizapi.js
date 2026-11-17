// "Təhlükəni aşkar et" oyununun sayt API-si. Cavablar və izahlar yalnız serverdədir (data/quiz.json), xal serverdə hesablanır.
// Sessiya hər suala yalnız bir dəfə və sıra ilə cavab qəbul edir: cavabı "yoxlayıb" sonra dəyişmək olmur.
// Cədvəldə yalnız ləqəb və şirkət kodu saxlanılır (həqiqi ad istənmir).
import quiz from "../data/quiz.json" with { type: "json" };

export const ROUND = 10;
const BY_ID = new Map(quiz.items.map((q) => [q.id, q]));
const SCAM = quiz.items.filter((q) => q.scam).map((q) => q.id);
const SAFE = quiz.items.filter((q) => !q.scam).map((q) => q.id);
const SESSION_TTL = 2 * 3600 * 1000;

function rand(n) { return crypto.getRandomValues(new Uint32Array(1))[0] % n; }
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const newId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const publicQ = (q) => ({ id: q.id, channel: q.channel, from: q.from, text: q.text });
const explain = (q) => ({ scam: q.scam, flags: q.flags || [], good: q.good || [], fromFlag: !!q.fromFlag, why: q.why, lesson: q.lesson });

// Bakı vaxtı ilə ay: "2026-11"
export const monthOf = (ts = Date.now()) => new Date(ts + 4 * 3600 * 1000).toISOString().slice(0, 7);

// Düzgün cavab +10; ardıcıl 3-cü düzgün cavabdan başlayaraq hər düzgün cavaba +5 seriya bonusu
export const pointsFor = (correct, streak) => (correct ? 10 + (streak >= 3 ? 5 : 0) : 0);

// Söyüş və təqlid (admin, ScamShield, Ayıq, polis…) olan ləqəblər qəbul edilmir
const BAD_NICK = /(?:^|[^\p{L}])(?:sik|amk|amq|orospu|pezeveng|yarrak|gotveren|qehbe|qəhbə|gijdillaq|peyser|dalbayob|blyat|бля|сука|хуй|пизд|еба|fuck|shit|bitch|nigg)|admin|moderator|ayıq|ayiq|scam ?shield|polis|dtx|cert/iu;
export function cleanNick(s) {
  const n = String(s || "").replace(/\s+/g, " ").trim();
  if (!/^[\p{L}\p{N} _-]{2,20}$/u.test(n)) return null;
  if (/https?|www|t\.me/i.test(n) || BAD_NICK.test(n)) return null;
  return n;
}

export async function quizDeleteNick(env, nick) {
  const r = await env.DB.prepare("DELETE FROM quiz_scores WHERE nick = ?1").bind(String(nick || "").trim()).run();
  return r.meta?.changes || 0;
}
export function cleanCompany(s) {
  const c = String(s || "").trim().toUpperCase();
  if (!c) return "";
  return /^[A-Z0-9-]{3,16}$/.test(c) ? c : null;
}

export async function quizStart(env) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM quiz_sessions WHERE started < ?1").bind(now - SESSION_TTL).run();
  const ids = shuffle([...shuffle(SCAM).slice(0, 6), ...shuffle(SAFE).slice(0, 4)]);
  const id = newId();
  await env.DB.prepare("INSERT INTO quiz_sessions (id, qids, started) VALUES (?1, ?2, ?3)").bind(id, ids.join(","), now).run();
  return { id, total: ids.length, questions: ids.map((x) => publicQ(BY_ID.get(x))) };
}

async function getSession(env, id) {
  if (!/^[0-9a-f]{32}$/.test(String(id || ""))) return null;
  const s = await env.DB.prepare("SELECT * FROM quiz_sessions WHERE id = ?1").bind(id).first();
  if (!s || Date.now() - s.started > SESSION_TTL) return null;
  return s;
}

const fail = (status, error) => ({ status, data: { error } });

export async function quizAnswer(env, body, depth = 0) {
  const s = await getSession(env, body?.id);
  if (!s) return fail(404, "Oyun tapılmadı və ya vaxtı keçib. Yenidən başlayın.");
  const qids = s.qids.split(",");
  const i = Number(body?.i);
  const ans = body?.answer === "scam" ? "f" : body?.answer === "safe" ? "t" : null;
  if (!Number.isInteger(i) || i < 0 || i >= qids.length || !ans) return fail(400, "Yanlış sorğu.");
  const q = BY_ID.get(qids[i]);
  if (i < s.answers.length) {
    // Təkrar cavab: ilk cavab qüvvədədir və dəyişmir
    return { status: 200, data: { ...explain(q), correct: (s.answers[i] === "f") === q.scam, repeated: true, score: s.points, correctCount: s.correct, streak: s.streak, done: s.answers.length >= qids.length } };
  }
  if (s.finished) return fail(409, "Oyun artıq bitib.");
  if (i !== s.answers.length) return fail(400, "Sualları sıra ilə cavablandırın.");
  const correct = (ans === "f") === q.scam;
  const streak = correct ? s.streak + 1 : 0;
  const pts = pointsFor(correct, streak);
  const answers = s.answers + ans;
  const r = await env.DB.prepare(
    "UPDATE quiz_sessions SET answers = ?1, points = points + ?2, correct = correct + ?3, streak = ?4 WHERE id = ?5 AND answers = ?6"
  ).bind(answers, pts, correct ? 1 : 0, streak, s.id, s.answers).run();
  if (!r.meta?.changes) return depth ? fail(409, "Yenidən cəhd edin.") : quizAnswer(env, body, 1);
  return {
    status: 200,
    data: { ...explain(q), correct, points: pts, bonus: pts > 10 ? pts - 10 : 0, score: s.points + pts, correctCount: s.correct + (correct ? 1 : 0), streak, done: answers.length >= qids.length },
  };
}

export async function quizLeaders(env, opts = {}) {
  const c = cleanCompany(opts.company) || "";
  const m = /^\d{4}-\d{2}$/.test(opts.month || "") ? opts.month : monthOf();
  const rows = c
    ? await env.DB.prepare("SELECT nick, MAX(score) AS score FROM quiz_scores WHERE month = ?1 AND company = ?2 GROUP BY nick ORDER BY score DESC, MIN(ts) ASC LIMIT 10").bind(m, c).all()
    : await env.DB.prepare("SELECT nick, company, MAX(score) AS score FROM quiz_scores WHERE month = ?1 GROUP BY nick, company ORDER BY score DESC, MIN(ts) ASC LIMIT 10").bind(m).all();
  const cnt = c
    ? await env.DB.prepare("SELECT COUNT(DISTINCT nick) AS n FROM quiz_scores WHERE month = ?1 AND company = ?2").bind(m, c).first()
    : await env.DB.prepare("SELECT COUNT(*) AS n FROM (SELECT DISTINCT nick, company FROM quiz_scores WHERE month = ?1)").bind(m).first();
  return { company: c, month: m, leaders: rows.results || [], players: cnt?.n || 0 };
}

export async function quizFinish(env, body) {
  const s = await getSession(env, body?.id);
  if (!s) return fail(404, "Oyun tapılmadı və ya vaxtı keçib. Yenidən başlayın.");
  const total = s.qids.split(",").length;
  if (s.answers.length < total) return fail(400, "Əvvəlcə bütün suallara cavab verin.");
  const nick = cleanNick(body?.nick);
  if (!nick) return fail(400, "Bu ləqəb olmaz: 2-20 hərf və ya rəqəm yazın (link, söyüş və «admin» kimi adlar olmaz). Həqiqi adınızı yazmayın.");
  const company = cleanCompany(body?.company);
  if (company === null) return fail(400, "Şirkət kodu 3-16 simvol olmalıdır: böyük hərf, rəqəm və ya «-» (məs. OYU).");
  const r = await env.DB.prepare("UPDATE quiz_sessions SET finished = 1 WHERE id = ?1 AND finished = 0").bind(s.id).run();
  if (!r.meta?.changes) return fail(409, "Bu nəticə artıq cədvələ yazılıb.");
  const month = monthOf();
  await env.DB.prepare("INSERT INTO quiz_scores (nick, company, score, correct, total, month, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(nick, company || null, s.points, s.correct, total, month, Date.now()).run();
  const board = await quizLeaders(env, { company, month });
  const idx = board.leaders.findIndex((x) => x.nick === nick);
  return { status: 200, data: { ok: true, nick, score: s.points, correct: s.correct, total, rank: idx >= 0 ? idx + 1 : null, ...board } };
}
