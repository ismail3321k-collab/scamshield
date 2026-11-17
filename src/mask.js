// Kişisel veri maskeleme: LLM'e ve kayda gitmeden önce.

function luhn(digits) {
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function maskPII(text) {
  const found = { kart: 0, tel: 0, fin: 0, iban: 0, kod: 0 };
  let t = text || "";
  t = t.replace(/\bAZ\d{2}[A-Z]{4}[0-9A-Z]{20}\b/gi, () => { found.iban++; return "[IBAN]"; });
  t = t.replace(/\b(?:\d[ -]?){12,18}\d\b/g, (m) => {
    if (!luhn(m.replace(/\D/g, ""))) return m;
    found.kart++;
    return "[KART]";
  });
  t = t.replace(/(?:\+?994|\b0)[\s-]?\(?(?:10|12|50|51|55|60|70|77|99)\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g, () => { found.tel++; return "[TEL]"; });
  t = t.replace(/(F[İI]N(?:\s*kod[a-zəıöüğşç]*)?\s*[:\-]?\s*)([0-9A-Z]{7})\b/gi, (_, p) => { found.fin++; return p + "[FİN]"; });
  t = t.replace(/((?:kod|code|код|parol|şifr)[a-zəıöüğşçа-я]*\s*[:\-]?\s*)(\d{4,8})\b/gi, (_, p) => { found.kod++; return p + "[KOD]"; });
  const total = Object.values(found).reduce((a, b) => a + b, 0);
  return { text: t, found, total };
}
