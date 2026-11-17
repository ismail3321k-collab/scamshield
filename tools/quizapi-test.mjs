// Oyun API testi (xal serverdə, ad + soyad + şirkət kodu): node --no-warnings tools/quizapi-test.mjs
import { readFileSync } from "node:fs";
import { fakeD1 } from "./fake-d1.mjs";
import { quizStart, quizAnswer, quizFinish, quizLeaders, checkPlayer, cleanName, cleanCompany, pointsFor, monthOf, ROUND } from "../src/quizapi.js";

const quiz = JSON.parse(readFileSync(new URL("../data/quiz.json", import.meta.url), "utf8"));
const truth = new Map(quiz.items.map((q) => [q.id, q.scam]));
let fails = 0, passes = 0;
const ok = (c, name, extra = "") => { if (c) passes++; else { fails++; console.log("FAIL", name, extra); } };
const env = { DB: fakeD1() };
const ali = { name: "Əli", surname: "Məmmədov" };

// Açıq sual siyahısında cavab yoxdur
const s = await quizStart(env);
ok(ROUND === 10 && s.questions.length === ROUND && s.total === ROUND && /^[0-9a-f]{32}$/.test(s.id), "start 10 sual");
ok(s.questions.every((q) => !("scam" in q) && !("why" in q) && !("flags" in q)), "no answers leaked", JSON.stringify(s.questions[0]));
ok(s.questions.filter((q) => truth.get(q.id)).length === 6, "6 scam + 4 safe");

// Sıra ilə cavab; 2-ci sual qəsdən səhv
const right = (sess, k) => (truth.get(sess.questions[k].id) ? "scam" : "safe");
const wrong = (sess, k) => (truth.get(sess.questions[k].id) ? "safe" : "scam");
let r = await quizAnswer(env, { id: s.id, i: 1, answer: "scam" });
ok(r.status === 400, "out of order rejected");
r = await quizAnswer(env, { id: s.id, i: 0, answer: right(s, 0) });
ok(r.status === 200 && r.data.correct && r.data.points === 10 && r.data.why.length, "q0 correct +10", JSON.stringify(r.data));
const again = await quizAnswer(env, { id: s.id, i: 0, answer: wrong(s, 0) });
ok(again.data.repeated && again.data.correct === true && again.data.score === 10, "answer cannot be changed", JSON.stringify(again.data));
r = await quizAnswer(env, { id: s.id, i: 1, answer: wrong(s, 1) });
ok(r.data.correct === false && r.data.points === 0 && r.data.score === 10, "q1 wrong");
r = await quizAnswer(env, { id: s.id, i: 2, answer: right(s, 2) });
r = await quizAnswer(env, { id: s.id, i: 3, answer: right(s, 3) });
ok(r.data.streak === 2 && r.data.points === 10, "streak 2 no bonus");
r = await quizAnswer(env, { id: s.id, i: 4, answer: right(s, 4) });
ok(r.data.streak === 3 && r.data.points === 15 && r.data.bonus === 5 && r.data.score === 45 && !r.data.done, "streak 3 bonus", JSON.stringify(r.data));
ok((await quizAnswer(env, { id: "nope", i: 0, answer: "scam" })).status === 404, "bad session");
ok((await quizAnswer(env, { id: s.id, i: 0, answer: "maybe" })).status === 400, "bad answer value");
ok((await quizFinish(env, { id: s.id, ...ali })).status === 400, "finish before last question rejected");
for (let k = 5; k < ROUND; k++) r = await quizAnswer(env, { id: s.id, i: k, answer: right(s, k) });
ok(r.data.done && r.data.score === 120 && r.data.correctCount === 9, "10 sual: 45 + 5 × 15 = 120", JSON.stringify(r.data));

// Bitir: ad / soyad / şirkət kodu yoxlanışı (xəta hansı sahədədir), nəticə bir dəfə yazılır
const bad = async (body, field, name) => {
  const x = await quizFinish(env, { id: s.id, ...body });
  ok(x.status === 400 && x.data.field === field && x.data.error, name, JSON.stringify(x.data));
};
await bad({ name: "", surname: "Məmmədov" }, "name", "empty name");
await bad({ surname: "Məmmədov" }, "name", "missing name");
await bad({ name: "Ə", surname: "Məmmədov" }, "name", "name too short");
await bad({ name: "Əli5", surname: "Məmmədov" }, "name", "name with digit");
await bad({ name: "evil.com", surname: "Məmmədov" }, "name", "name with link");
await bad({ name: "Əli", surname: "" }, "surname", "empty surname");
await bad({ name: "Əli", surname: "Məmmədovməmmədovməmm" + "ə" }, "surname", "surname 21 letters");
await bad({ name: "Admin", surname: "Bəy" }, "name", "admin blocked");
await bad({ name: "Ayıq", surname: "Rəsmi" }, "name", "Ayıq impersonation blocked");
await bad({ name: "Əli", surname: "Polis" }, "surname", "blocked word in surname");
await bad({ name: "Scam", surname: "Shield" }, "name", "ScamShield split across fields");
await bad({ name: "Fuck", surname: "Off" }, "name", "swear blocked");
await bad({ ...ali, company: "oy" }, "company", "company too short");
await bad({ ...ali, company: "OYU KOD" }, "company", "company with space");
ok((await quizFinish(env, { id: s.id, nick: "Diqqətli Pişik", company: "OYU" })).status === 400, "old nick-only request rejected");
const f = await quizFinish(env, { id: s.id, name: "  əli ", surname: "məmmədov", company: "oyu" });
ok(f.status === 200 && f.data.nick === "Əli Məmmədov" && f.data.name === "Əli" && f.data.surname === "Məmmədov", "finish ok + böyük hərf", JSON.stringify(f.data));
ok(f.data.score === 120 && f.data.best === 120 && f.data.company === "OYU" && f.data.rank === 1 && f.data.leaders[0].nick === "Əli Məmmədov", "finish board", JSON.stringify(f.data));
ok((await quizFinish(env, { id: s.id, ...ali, company: "OYU" })).status === 409, "finish only once");
ok((await quizAnswer(env, { id: s.id, i: 4, answer: wrong(s, 4) })).data.repeated, "answers frozen after finish");

// Natamam oyun cədvələ düşmür
const s2 = await quizStart(env);
await quizAnswer(env, { id: s2.id, i: 0, answer: "scam" });
ok((await quizFinish(env, { id: s2.id, name: "Tələsən", surname: "Oyunçu" })).status === 400, "unfinished game rejected");

const play = async (fn) => {
  const x = await quizStart(env);
  for (let k = 0; k < ROUND; k++) await quizAnswer(env, { id: x.id, i: k, answer: fn(x, k) });
  return x;
};

// Mükəmməl oyun → 10 + 10 + 8 × 15 = 140 xal, şirkət cədvəlində birinci
const s3 = await play(right);
const f3 = await quizFinish(env, { id: s3.id, name: "Leyla", surname: "Həsənova", company: "OYU" });
ok(f3.data.score === 140 && f3.data.rank === 1, "perfect 140", JSON.stringify(f3.data));
const b = await quizLeaders(env, { company: "OYU" });
ok(b.leaders.length === 2 && b.leaders[0].nick === "Leyla Həsənova" && b.leaders[1].nick === "Əli Məmmədov" && b.players === 2, "company board", JSON.stringify(b));

// Kodsuz oyunçu: ümumi cədvəl (sətir = ad + şirkət), yeri bütün oyunçular arasında
const s4 = await play(wrong);
const f4 = await quizFinish(env, { id: s4.id, name: "Nigar", surname: "Quliyeva", company: "" });
ok(f4.status === 200 && f4.data.company === "" && f4.data.score === 0 && f4.data.rank === 3, "no company → general board rank", JSON.stringify(f4.data));
const g = await quizLeaders(env, {});
ok(g.leaders.length === 3 && g.leaders[0].company === "OYU" && g.leaders[2].nick === "Nigar Quliyeva" && !g.leaders[2].company && g.players === 3, "global board", JSON.stringify(g));
ok((await quizLeaders(env, { company: "BASQA" })).leaders.length === 0, "other company empty");

// Eyni ad yenidən oynayır: cədvəldə ən yaxşı xal qalır, yer ona görə
const s5 = await play(wrong);
const f5 = await quizFinish(env, { id: s5.id, name: "Leyla", surname: "Həsənova", company: "OYU" });
ok(f5.data.score === 0 && f5.data.best === 140 && f5.data.rank === 1 && f5.data.leaders.length === 2, "best score kept", JSON.stringify(f5.data));

// İlk 10-dan kənarda da yer deyilir: BIG şirkətində 12 nəfər daha yüksək xalla
const month = monthOf();
for (let k = 0; k < 12; k++) {
  await env.DB.prepare("INSERT INTO quiz_scores (nick, company, score, correct, total, month, ts) VALUES (?1, 'BIG', ?2, 10, 10, ?3, ?4)").bind(`Oyunçu ${"ABCDEFGHIJKL"[k]}`, 100 + k, month, 1000 + k).run();
}
await env.DB.prepare("INSERT INTO quiz_scores (nick, company, score, correct, total, month, ts) VALUES ('Erkən Gələn', 'BIG', 0, 0, 10, ?1, 5)").bind(month).run();
const s6 = await play(wrong);
const f6 = await quizFinish(env, { id: s6.id, name: "Sonuncu", surname: "Gələn", company: "big" });
ok(f6.data.rank === 14 && f6.data.leaders.length === 10 && !f6.data.leaders.some((x) => x.nick === "Sonuncu Gələn") && f6.data.players === 14, "rank outside top 10 (tie: earlier first)", JSON.stringify({ rank: f6.data.rank, n: f6.data.leaders.length, players: f6.data.players }));

// Köməkçi funksiyalar
ok(cleanName("  əli  ") === "Əli" && cleanName("ibrahim") === "İbrahim" && cleanName("Əli-əkbər") === "Əli-Əkbər" && cleanName("Ağa   Bəy") === "Ağa Bəy", "cleanName format");
ok(cleanName("MƏMMƏDOV") === "MƏMMƏDOV" && cleanName("McDonald") === "McDonald" && cleanName("şahin") === "Şahin", "cleanName keeps case / NFC");
ok([null, "", "Ə", "Əli5", "a".repeat(21), "Əli--Bəy", "-Əli", "Əli-", "<b>", "t.me/x", "Əli_Bəy", "Əli.", "😀😀"].every((x) => cleanName(x) === null), "cleanName rejects");
ok(cleanName("a".repeat(20)) === "A" + "a".repeat(19) && cleanName("Ой") === "Ой", "cleanName limits");
const p = checkPlayer({ name: "leyla", surname: "həsənova", company: " oyu " });
ok(p.ok && p.nick === "Leyla Həsənova" && p.company === "OYU", "checkPlayer ok", JSON.stringify(p));
ok(checkPlayer({ ...ali }).company === "" && checkPlayer({ ...ali, company: "ŞİRKƏT" }).data?.field === "company", "checkPlayer company");
ok(cleanCompany("oyu") === "OYU" && cleanCompany("") === "" && cleanCompany("A B") === null && cleanCompany("MİHİ") === "MIHI" && cleanCompany("mihi") === "MIHI", "cleanCompany");
ok(pointsFor(true, 1) === 10 && pointsFor(true, 3) === 15 && pointsFor(false, 0) === 0, "pointsFor");

console.log(`quizapi-test: ${passes} keçdi, ${fails} xəta`);
process.exit(fails ? 1 : 0);
