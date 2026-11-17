// Nömrə yoxlanışı testi: node tools/phone-test.mjs
import { parsePhone, phoneOnly, phoneVerdict, shortTextPhone, riskyPhoneInText } from "../src/phone.js";

const CASES = [
  // [giriş, gözlənən növ, gözlənən zolaq, əlavə yoxlama]
  ["+995 55 000 12 34", "intl", "high", (v) => /İKTA/.test(v.reasons.join(" ")) && /\+994/.test(v.reasons[0])],
  ["+995 599 12 34 56", "intl", "suspicious", (v) => /Gürcüstan/.test(v.type)],
  ["050 123 45 67", "az", "unknown", (v) => v.display === "+994 50 123 45 67" && /Azercell/.test(v.reasons[0])],
  ["(050) 123-45-67", "az", "unknown"],
  ["+99455 123 45 67", "az", "unknown", (v) => /Bakcell/.test(v.reasons[0])],
  ["994701234567", "az", "unknown", (v) => /Nar/.test(v.reasons[0])],
  ["551234567", "az", "unknown"],
  ["+994 12 493 00 00", "az", "unknown", (v) => /Bakı/.test(v.type)],
  ["+994 55 123 45", "az", "suspicious", (v) => /9 rəqəm/.test(v.reasons[0])],
  ["102", "short", "official", (v) => /Polis/.test(v.reasons[0]) && !v.reportable],
  ["1654", "short", "official"],
  ["196", "short", "official", (v) => /Kapital/.test(v.reasons[0])],
  ["169", "short", "official", (v) => /Azərpoçt/.test(v.reasons[0])],
  ["*1111", "short", "official", (v) => /Azercell/.test(v.reasons[0])],
  ["112", "short", "official"],
  ["9999", "short", "unknown", (v) => /qiymətini/.test(v.reasons.join(" "))],
  ["+94 77 123 4567", "intl", "suspicious", (v) => /Şri-Lanka/.test(v.type) && /16 804/.test(v.reasons.join(" "))],
  ["+882 1234 5678", "intl", "high", (v) => /peyk/.test(v.reasons[0])],
  ["00 90 532 123 45 67", "intl", "suspicious", (v) => /Türkiyə/.test(v.type)],
  ["+1 202 555 0123", "intl", "suspicious", (v) => /ABŞ/.test(v.type)],
  ["+7 701 123 45 67", "intl", "suspicious", (v) => /Rusiya/.test(v.type)],
  // iOS / WhatsApp-dan kopyalanan nömrədəki görünməz istiqamət işarələri
  ["\u202A+995 55 000 12 34\u202C", "intl", "high"],
  ["\u2066+994 55 123 45 67\u2069", "az", "unknown"],
  // "+994 (050) …" və "994 050 …": milli prefiksdəki 0
  ["+994 (050) 123-45-67", "az", "unknown", (v) => v.display === "+994 50 123 45 67"],
  ["9940501234567", "az", "unknown", (v) => v.display === "+994 50 123 45 67"],
];

let fails = 0;
for (const [input, kind, band, extra] of CASES) {
  const p = parsePhone(input);
  const v = p && p.kind !== "unknown" ? phoneVerdict(p) : null;
  const good = p?.kind === kind && v?.band === band && (!extra || extra(v));
  if (!good) fails++;
  console.log(`${good ? "OK  " : "FAIL"} ${input.padEnd(22)} → ${p?.kind ?? "null"} / ${v?.band ?? "-"} ${v ? "· " + v.display + " · " + v.type : ""}`);
}

// Nömrə olmayanlar
for (const s of ["Salam", "12345678", "https://t.me/x", "kod 4821 deyin", "+", "55", "2026", "4821"]) {
  const r = phoneOnly(s);
  if (r) { fails++; console.log("FAIL not-phone", s, JSON.stringify(r)); }
}

// Bildiriş sayına görə zolaq
const az = parsePhone("055 987 65 43");
const c = [
  [{ user: 0, message: 0 }, "unknown"],
  [{ user: 1, message: 0 }, "suspicious"],
  [{ user: 2, message: 1 }, "suspicious"],   // mesajda görünmək ən çox "ehtiyatlı olun"
  [{ user: 0, message: 9 }, "suspicious"],
  [{ user: 3, message: 0 }, "high"],          // yalnız 3+ istifadəçi bildirişi
];
for (const [counts, band] of c) {
  const v = phoneVerdict(az, counts);
  if (v.band !== band) { fails++; console.log("FAIL counts", JSON.stringify(counts), v.band); }
}
const off = phoneVerdict(parsePhone("196"), { user: 5, message: 5 });
if (off.band !== "official") { fails++; console.log("FAIL official must stay official"); }
const crowd = phoneVerdict(az, { user: 3, message: 0 });
if (crowd.bandLabel !== "İstifadəçilər fırıldaq kimi bildirib") { fails++; console.log("FAIL crowd label", crowd.bandLabel); }

// Qısa mətndə tək nömrə → nömrə yoxlanışı; fırıldaq sözləri və ya iki nömrə olanda yox
const st = (t) => shortTextPhone(t)?.display || null;
const shortCases = [
  ["Bu nömrədən zəng gəldi: +995 55 000 12 34", "+995 55 000 12 34"],
  ["kimdir bu? 055 987 65 43", "+994 55 987 65 43"],
  ["Kartınız bloklanıb, 055 123 45 67 nömrəsinə zəng edin", null],
  ["055 123 45 67 və 050 765 43 21", null],
  ["Azərpoçt: bağlamanız saxlanılıb, ödəyin https://x.top/a 055 123 45 67", null],
];
for (const [t, want] of shortCases) if (st(t) !== want) { fails++; console.log("FAIL shortTextPhone", t, st(t)); }
const rp = riskyPhoneInText("Kapital Bank əməkdaşıyam, WhatsApp: +995 55 000 12 34");
if (rp?.kind !== "lookalike") { fails++; console.log("FAIL riskyPhoneInText", JSON.stringify(rp)); }
if (riskyPhoneInText("Zəng edin: +994 55 123 45 67")) { fails++; console.log("FAIL az number is not risky"); }

console.log(fails ? `\nphone-test: ${fails} xəta` : `\nphone-test: hamısı keçdi (${CASES.length} nömrə + qısa mətn, say və risk yoxlamaları)`);
process.exit(fails ? 1 : 0);
