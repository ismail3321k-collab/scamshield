// Metin yardımcıları: model normalizasyonu (ml/train.py ile birebir) ve uzunluğu koruyan eşleme katlaması.

const FOLD = { "ə": "e", "ı": "i", "ö": "o", "ü": "u", "ğ": "g", "ş": "s", "ç": "c", "â": "a", "î": "i", "û": "u" };

// ml/train.py normalize() ile aynı olmalı.
export function normalizeForModel(text) {
  let t = (text || "").normalize("NFKC").toLowerCase();
  t = t.replace(/[əıöüğşçâîû]/g, (c) => FOLD[c]);
  t = t.replaceAll("sh", "s").replaceAll("ch", "c");
  let out = "";
  for (const ch of t) {
    if (ch >= "0" && ch <= "9") {
      if (!out.endsWith("0")) out += "0";
    } else if (/\s/.test(ch)) {
      if (!out.endsWith(" ")) out += " ";
    } else out += ch;
  }
  return " " + out.trim() + " ";
}

// Eşleme için katlama: uzunluğu korur (vurgu konumları orijinal metne denk gelsin diye).
export function foldForMatch(text) {
  return (text || "")
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/[əıöüğşçâîû]/g, (c) => FOLD[c]);
}

export function stripInvisible(text) {
  return (text || "").replace(/[​-‏‪-‮⁠-⁤⁦-⁩﻿­]/g, "");
}
