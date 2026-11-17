// hackathon/data/*.csv → ayiq/data/*.json
// Kullanım: node tools/build-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "..", "data");

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

const allow = parseCsv(readFileSync(join(src, "allowlist.csv"), "utf8"))
  .filter((r) => !/komanda yoxlas/i.test(r.qeyd))
  .map((r) => ({ domain: r.domen.toLowerCase(), brand: r.brend, category: r.kateqoriya, sender: r.sms_gonderen || "" }));
writeFileSync(join(root, "data", "allowlist.json"), JSON.stringify(allow));

const dict = parseCsv(readFileSync(join(src, "sozluk.csv"), "utf8"))
  .map((r) => ({ phrase: r.ifade, lang: r.dil, cat: r.kateqoriya, weight: Number(r.ceki), tr: r.turkcesi }));
writeFileSync(join(root, "data", "sozluk.json"), JSON.stringify(dict));

console.log(`allowlist: ${allow.length} domen, sozluk: ${dict.length} ifade`);
