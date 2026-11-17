// Oyun API testi (xal serverdə): node --no-warnings tools/quizapi-test.mjs
import { readFileSync } from "node:fs";
import { fakeD1 } from "./fake-d1.mjs";
import { quizStart, quizAnswer, quizFinish, quizLeaders, cleanNick, cleanCompany, pointsFor } from "../src/quizapi.js";

const quiz = JSON.parse(readFileSync(new URL("../data/quiz.json", import.meta.url), "utf8"));
const truth = new Map(quiz.items.map((q) => [q.id, q.scam]));
let fails = 0, passes = 0;
const ok = (c, name, extra = "") => { if (c) passes++; else { fails++; console.log("FAIL", name, extra); } };
const env = { DB: fakeD1() };

// Açıq sual siyahısında cavab yoxdur
const s = await quizStart(env);
ok(s.questions.length === 5 && /^[0-9a-f]{32}$/.test(s.id), "start");
ok(s.questions.every((q) => !("scam" in q) && !("why" in q) && !("flags" in q)), "no answers leaked", JSON.stringify(s.questions[0]));
ok(s.questions.filter((q) => truth.get(q.id)).length === 3, "3 scam + 2 safe");

// Sıra ilə cavab; 2-ci sual qəsdən səhv
const right = (k) => (truth.get(s.questions[k].id) ? "scam" : "safe");
const wrong = (k) => (truth.get(s.questions[k].id) ? "safe" : "scam");
let r = await quizAnswer(env, { id: s.id, i: 1, answer: "scam" });
ok(r.status === 400, "out of order rejected");
r = await quizAnswer(env, { id: s.id, i: 0, answer: right(0) });
ok(r.status === 200 && r.data.correct && r.data.points === 10 && r.data.why.length, "q0 correct +10", JSON.stringify(r.data));
const again = await quizAnswer(env, { id: s.id, i: 0, answer: wrong(0) });
ok(again.data.repeated && again.data.correct === true && again.data.score === 10, "answer cannot be changed", JSON.stringify(again.data));
r = await quizAnswer(env, { id: s.id, i: 1, answer: wrong(1) });
ok(r.data.correct === false && r.data.points === 0 && r.data.score === 10, "q1 wrong");
r = await quizAnswer(env, { id: s.id, i: 2, answer: right(2) });
r = await quizAnswer(env, { id: s.id, i: 3, answer: right(3) });
ok(r.data.streak === 2 && r.data.points === 10, "streak 2 no bonus");
r = await quizAnswer(env, { id: s.id, i: 4, answer: right(4) });
ok(r.data.streak === 3 && r.data.points === 15 && r.data.bonus === 5 && r.data.score === 45 && r.data.done, "streak 3 bonus", JSON.stringify(r.data));
ok((await quizAnswer(env, { id: "nope", i: 0, answer: "scam" })).status === 404, "bad session");
ok((await quizAnswer(env, { id: s.id, i: 0, answer: "maybe" })).status === 400, "bad answer value");

// Bitir: ləqəb / şirkət kodu yoxlanışı, bir dəfə yazılır
ok((await quizFinish(env, { id: s.id, nick: "x", company: "OYU" })).status === 400, "nick too short");
ok((await quizFinish(env, { id: s.id, nick: "evil.com", company: "OYU" })).status === 400, "nick with link");
ok((await quizFinish(env, { id: s.id, nick: "Diqqətli Pişik", company: "oy" })).status === 400, "company too short");
const f = await quizFinish(env, { id: s.id, nick: "Diqqətli Pişik", company: "oyu" });
ok(f.status === 200 && f.data.score === 45 && f.data.company === "OYU" && f.data.rank === 1, "finish ok", JSON.stringify(f.data));
ok((await quizFinish(env, { id: s.id, nick: "Diqqətli Pişik", company: "OYU" })).status === 409, "finish only once");
ok((await quizAnswer(env, { id: s.id, i: 4, answer: wrong(4) })).data.repeated, "answers frozen after finish");

// Natamam oyun cədvələ düşmür
const s2 = await quizStart(env);
await quizAnswer(env, { id: s2.id, i: 0, answer: "scam" });
ok((await quizFinish(env, { id: s2.id, nick: "Tələsən", company: "" })).status === 400, "unfinished game rejected");

// Mükəmməl oyun → 65 xal, cədvəldə birinci
const s3 = await quizStart(env);
for (let k = 0; k < 5; k++) await quizAnswer(env, { id: s3.id, i: k, answer: truth.get(s3.questions[k].id) ? "scam" : "safe" });
const f3 = await quizFinish(env, { id: s3.id, nick: "Bilici", company: "OYU" });
ok(f3.data.score === 65 && f3.data.rank === 1, "perfect 65", JSON.stringify(f3.data));
const b = await quizLeaders(env, { company: "OYU" });
ok(b.leaders.length === 2 && b.leaders[0].nick === "Bilici" && b.players === 2, "company board", JSON.stringify(b));
const g = await quizLeaders(env, {});
ok(g.leaders.length === 2 && g.leaders[1].company === "OYU", "global board", JSON.stringify(g));
ok((await quizLeaders(env, { company: "BASQA" })).leaders.length === 0, "other company empty");

ok(cleanNick("  Diqqətli   Pişik ") === "Diqqətli Pişik" && cleanNick("<b>x</b>") === null && cleanNick("t.me/x") === null && cleanNick("Əli-55") === "Əli-55", "cleanNick");
ok(cleanNick("admin") === null && cleanNick("Ayıq Rəsmi") === null && cleanNick("polis 102") === null && cleanNick("Musiqiçi") === "Musiqiçi", "nick blocklist");
ok(cleanCompany("oyu") === "OYU" && cleanCompany("") === "" && cleanCompany("A B") === null, "cleanCompany");
ok(pointsFor(true, 1) === 10 && pointsFor(true, 3) === 15 && pointsFor(false, 0) === 0, "pointsFor");

console.log(`quizapi-test: ${passes} keçdi, ${fails} xəta`);
process.exit(fails ? 1 : 0);
