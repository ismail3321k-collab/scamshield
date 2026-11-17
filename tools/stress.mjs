import fs from "fs";
import { analyze } from "../src/analyze.js";

const set = JSON.parse(fs.readFileSync(new URL("../ml/stress_set.json", import.meta.url), "utf8"));
const rows = [];
for (const m of set) {
  const r = await analyze(m.text, { useLlm: false });
  rows.push({ ...m, score: r.score, ml: r.ml, band: r.band, flags: r.flags.map((f) => (typeof f === "string" ? f : f.code)) });
}
const sc = rows.filter((r) => r.expected === "scam");
const lg = rows.filter((r) => r.expected === "legit");
const cnt = (a, b) => a.filter((r) => r.band === b).length;
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : "0.0") + "%";

console.log(`\nToplam ${rows.length}: scam ${sc.length}, legit ${lg.length}\n`);
console.log("SCAM   high=" + cnt(sc, "high") + "  suspicious=" + cnt(sc, "suspicious") + "  kacirilan(safe)=" + cnt(sc, "safe"));
console.log("  yakalama (high): " + pct(cnt(sc, "high"), sc.length) + "   (high+suspicious): " + pct(cnt(sc, "high") + cnt(sc, "suspicious"), sc.length));
console.log("LEGIT  safe=" + cnt(lg, "safe") + "  suspicious=" + cnt(lg, "suspicious") + "  high=" + cnt(lg, "high"));
console.log("  yanlis alarm (high): " + pct(cnt(lg, "high"), lg.length) + "   (suspicious+high): " + pct(cnt(lg, "high") + cnt(lg, "suspicious"), lg.length));

const types = [...new Set(rows.map((r) => r.expected + ":" + r.type))].sort();
console.log("\nTur bazinda (S/H/safe = scam icin high/suspicious/safe; legit icin safe/susp/high):");
for (const t of types) {
  const g = rows.filter((r) => r.expected + ":" + r.type === t);
  console.log("  " + t.padEnd(22) + "n=" + String(g.length).padStart(2) + "  high=" + cnt(g, "high") + " susp=" + cnt(g, "suspicious") + " safe=" + cnt(g, "safe"));
}
const langs = [...new Set(rows.map((r) => r.lang))];
for (const lang of langs) {
  const a = sc.filter((r) => r.lang === lang);
  const b = lg.filter((r) => r.lang === lang);
  console.log(`  dil ${lang}: scam n=${a.length} high=${cnt(a, "high")} susp=${cnt(a, "suspicious")} safe=${cnt(a, "safe")} | legit n=${b.length} safe=${cnt(b, "safe")} susp=${cnt(b, "suspicious")} high=${cnt(b, "high")}`);
}
const fails = rows.filter((r) => (r.expected === "scam" && r.band !== "high") || (r.expected === "legit" && r.band !== "safe"));
if (process.argv.includes("--fails") || true) {
  console.log("\nHATALAR (" + fails.length + "):");
  for (const r of fails.sort((a, b) => a.expected.localeCompare(b.expected) || a.score - b.score)) {
    console.log(`${r.expected === "scam" ? "KACTI " : "ALARM "} ${String(r.score).padStart(3)} ${r.band.padEnd(10)} ml=${r.ml} [${r.type}/${r.lang}] ${r.text.slice(0, 90)}  {${r.flags.join(",")}}`);
  }
}
