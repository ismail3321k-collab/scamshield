// Kırmızı bayrak sözlüğü eşlemesi (katlanmış metin üzerinde; konumlar orijinal metne denk gelir).
import dict from "../data/sozluk.json" with { type: "json" };
import { foldForMatch } from "./text.js";

const ENTRIES = dict.map((e) => {
  const f = foldForMatch(e.phrase);
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const short = f.replace(/\s/g, "").length <= 4;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc}${short ? "(?![\\p{L}\\p{N}])" : ""}`, "gu");
  return { ...e, re };
});

export function matchDict(text) {
  const folded = foldForMatch(text);
  const hits = [];
  for (const e of ENTRIES) {
    for (const m of folded.matchAll(e.re)) {
      hits.push({ start: m.index, end: m.index + m[0].length, cat: e.cat, weight: e.weight, phrase: e.phrase });
    }
  }
  return hits;
}
