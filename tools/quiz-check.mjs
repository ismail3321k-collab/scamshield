// Oyun məlumatının yoxlanışı: node tools/quiz-check.mjs
import { readFileSync } from "node:fs";
import { pickRound, defangLinks } from "../src/quiz.js";

const quiz = JSON.parse(readFileSync(new URL("../data/quiz.json", import.meta.url), "utf8"));
let fails = 0;
const fail = (...a) => { fails++; console.log("FAIL", ...a); };

const ids = new Set();
for (const q of quiz.items) {
  for (const k of ["id", "channel", "from", "text", "lesson"]) if (typeof q[k] !== "string" || !q[k]) fail(q.id, "field", k);
  if (typeof q.scam !== "boolean") fail(q.id, "scam bool");
  if (!Array.isArray(q.why) || q.why.length < 1) fail(q.id, "why");
  if (ids.has(q.id)) fail(q.id, "duplicate id");
  ids.add(q.id);
  for (const f of [...(q.flags || []), ...(q.good || [])]) if (!q.text.includes(f)) fail(q.id, "phrase not in text:", f);
  if (q.scam && !(q.flags || []).length) fail(q.id, "scam without flags");
  if (/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/.test(q.text)) fail(q.id, "unmasked card number");
}
const scam = quiz.items.filter((q) => q.scam).length, safe = quiz.items.length - scam;
if (scam < 3 || safe < 2) fail("need ≥3 scam and ≥2 safe", scam, safe);

// Toxumlu seçim: hər toxumda 3 fırıldaq + 2 təhlükəsiz, təkrarsız, və hər dəfə eyni
for (let s = 0; s < 2000; s += 37) {
  const r = pickRound(s);
  if (r.length !== 5 || r.filter((q) => q.scam).length !== 3 || new Set(r.map((q) => q.id)).size !== 5) fail("round", s);
  if (pickRound(s).map((q) => q.id).join() !== r.map((q) => q.id).join()) fail("not deterministic", s);
}
if (defangLinks("Ətraflı: birbank.az və 12.40 AZN") !== "Ətraflı: birbank[.]az və 12.40 AZN") fail("defangLinks", defangLinks("Ətraflı: birbank.az və 12.40 AZN"));

console.log(`quiz-check: ${quiz.items.length} mesaj (${scam} fırıldaq, ${safe} təhlükəsiz), ${fails ? fails + " xəta" : "xəta yoxdur"}`);
process.exit(fails ? 1 : 0);
