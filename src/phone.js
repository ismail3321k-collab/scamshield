// Telefon nömrəsi yoxlanışı: ölkə kodu, +995 hiyləsi, rəsmi qısa nömrələr və istifadəçi bildirişləri.
// Nömrənin özü heç yerdə saxlanılmır: bildirişlər yalnız HMAC-SHA256 (gizli açarla) şəklində sayılır.
// Mənbələr: İKTA, 22.02.2026 (+995 ilə Azərbaycan formatını təqlid edən zənglər); DİN, 05.02.2025
// (2024: 16 804 hal, 22,4 mln AZN, "saxta xarici nömrələr"); Azercell fırıldaq xəbərdarlığı səhifəsi.
import { BRANDS, GENERIC_HOTLINES } from "./brands.js";
import { stripInvisible } from "./text.js";
import { matchDict } from "./dict.js";

// Ölkə kodları (ITU): ən uzun prefiks uyğunlaşdırılır
const COUNTRY = {
  "1": "ABŞ / Kanada", "7": "Rusiya / Qazaxıstan", "20": "Misir", "27": "Cənubi Afrika", "30": "Yunanıstan", "31": "Niderland",
  "32": "Belçika", "33": "Fransa", "34": "İspaniya", "36": "Macarıstan", "39": "İtaliya", "40": "Rumıniya", "41": "İsveçrə",
  "43": "Avstriya", "44": "Böyük Britaniya", "45": "Danimarka", "46": "İsveç", "47": "Norveç", "48": "Polşa", "49": "Almaniya",
  "51": "Peru", "52": "Meksika", "53": "Kuba", "54": "Argentina", "55": "Braziliya", "56": "Çili", "57": "Kolumbiya", "58": "Venesuela",
  "60": "Malayziya", "61": "Avstraliya", "62": "İndoneziya", "63": "Filippin", "64": "Yeni Zelandiya", "65": "Sinqapur", "66": "Tailand",
  "81": "Yaponiya", "82": "Cənubi Koreya", "84": "Vyetnam", "86": "Çin", "90": "Türkiyə", "91": "Hindistan", "92": "Pakistan",
  "93": "Əfqanıstan", "94": "Şri-Lanka", "95": "Myanma", "98": "İran",
  "211": "Cənubi Sudan", "212": "Mərakeş", "213": "Əlcəzair", "216": "Tunis", "218": "Liviya", "220": "Qambiya", "221": "Seneqal",
  "222": "Mavritaniya", "223": "Mali", "224": "Qvineya", "225": "Kot-d'İvuar", "226": "Burkina-Faso", "227": "Niger", "228": "Toqo",
  "229": "Benin", "230": "Mavriki", "231": "Liberiya", "232": "Syerra-Leone", "233": "Qana", "234": "Nigeriya", "235": "Çad",
  "236": "Mərkəzi Afrika", "237": "Kamerun", "238": "Kabo-Verde", "239": "San-Tome və Prinsipi", "240": "Ekvatorial Qvineya",
  "241": "Qabon", "242": "Konqo", "243": "Konqo DR", "244": "Anqola", "245": "Qvineya-Bisau", "248": "Seyşel adaları", "249": "Sudan",
  "250": "Ruanda", "251": "Efiopiya", "252": "Somali", "253": "Cibuti", "254": "Keniya", "255": "Tanzaniya", "256": "Uqanda",
  "257": "Burundi", "258": "Mozambik", "260": "Zambiya", "261": "Madaqaskar", "263": "Zimbabve", "264": "Namibiya", "265": "Malavi",
  "266": "Lesoto", "267": "Botsvana", "268": "Esvatini", "269": "Komor adaları", "291": "Eritreya", "297": "Aruba",
  "350": "Cəbəllütariq", "351": "Portuqaliya", "352": "Lüksemburq", "353": "İrlandiya", "354": "İslandiya", "355": "Albaniya",
  "356": "Malta", "357": "Kipr", "358": "Finlandiya", "359": "Bolqarıstan", "370": "Litva", "371": "Latviya", "372": "Estoniya",
  "373": "Moldova", "374": "Ermənistan", "375": "Belarus", "376": "Andorra", "377": "Monako", "378": "San-Marino", "380": "Ukrayna",
  "381": "Serbiya", "382": "Monteneqro", "383": "Kosovo", "385": "Xorvatiya", "386": "Sloveniya", "387": "Bosniya və Herseqovina",
  "389": "Şimali Makedoniya", "420": "Çexiya", "421": "Slovakiya", "423": "Lixtenşteyn",
  "852": "Honkonq", "853": "Makao", "855": "Kamboca", "856": "Laos", "870": "Inmarsat (peyk)", "880": "Banqladeş",
  "881": "Qlobal peyk telefonu", "882": "Beynəlxalq xüsusi şəbəkə", "883": "Beynəlxalq xüsusi şəbəkə", "886": "Tayvan",
  "960": "Maldiv adaları", "961": "Livan", "962": "İordaniya", "963": "Suriya", "964": "İraq", "965": "Küveyt",
  "966": "Səudiyyə Ərəbistanı", "967": "Yəmən", "968": "Oman", "970": "Fələstin", "971": "BƏƏ", "972": "İsrail", "973": "Bəhreyn",
  "974": "Qətər", "975": "Butan", "976": "Monqolustan", "977": "Nepal", "992": "Tacikistan", "993": "Türkmənistan",
  "994": "Azərbaycan", "995": "Gürcüstan", "996": "Qırğızıstan", "998": "Özbəkistan",
};
const SATELLITE = new Set(["870", "881", "882", "883"]);
const AZ_MOBILE = { "10": "Azercell", "50": "Azercell", "51": "Azercell", "55": "Bakcell", "99": "Bakcell", "70": "Nar", "77": "Nar", "60": "Naxtel" };

// Rəsmi qısa nömrələr: brendlərin qaynar xətləri + ümumi xətlər + təcili xidmətlər
const OFFICIAL = {};
for (const h of [...BRANDS.map((b) => b.hotline), ...GENERIC_HOTLINES]) {
  if (h?.num && !OFFICIAL[h.num]) OFFICIAL[h.num] = { label: h.label, desc: h.desc };
}
Object.assign(OFFICIAL, {
  "101": { label: "Yanğından mühafizə 101", desc: "Yanğın zamanı zəng edilən dövlət xəttidir." },
  "103": { label: "Təcili tibbi yardım 103", desc: "Təcili tibbi yardım xəttidir." },
  "112": { label: "Fövqəladə hallar 112", desc: "Fövqəladə halların vahid xəttidir." },
  "108": { label: "ASAN xidmət 108", desc: "ASAN xidmətin məlumat xəttidir." },
  "*1111": { label: "Azercell *1111", desc: "Azercell-in müştəri xidmətləri xəttidir." },
});

const BAND_LABEL = {
  official: "Rəsmi nömrədir",
  unknown: "Bu nömrə barədə şikayət yoxdur",
  suspicious: "Ehtiyatlı olun",
  high: "Yüksək risk: fırıldaq nömrəsinə oxşayır",
};
const RANK = { official: 0, unknown: 1, suspicious: 2, high: 3 };

function matchCc(digits) {
  for (const n of [3, 2, 1]) if (COUNTRY[digits.slice(0, n)]) return digits.slice(0, n);
  return null;
}

function group(national, cc) {
  // Azərbaycan formatı 2-3-2-2; +995-də Azərbaycana oxşadılmış nömrəni də belə göstəririk ki, hiylə görünsün
  if (national.length === 9 && (cc === "994" || (cc === "995" && AZ_MOBILE[national.slice(0, 2)]))) {
    return `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  }
  if (national.length === 9) return `${national.slice(0, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
  return national.replace(/(\d{3})(?=\d{3,})/g, "$1 ");
}

// Mətni telefon nömrəsi kimi oxuyur. Nömrəyə oxşamırsa null.
export function parsePhone(input) {
  const s = stripInvisible(String(input || "")).trim();
  if (!s || s.length > 32 || !/^[+*]?[\d\s\-().]+#?$/.test(s)) return null;
  const star = s.startsWith("*");
  let d = s.replace(/[^\d+]/g, "");
  if (d.lastIndexOf("+") > 0) return null;
  if (d.startsWith("00")) d = "+" + d.slice(2);
  // "+994 (050) 123-45-67" və "994 050 …": milli prefiksdəki 0 atılır
  if (d.startsWith("+9940") && d.length === 14) d = "+994" + d.slice(5);
  else if (d.startsWith("9940") && d.length === 13) d = "+994" + d.slice(4);
  if (!d.startsWith("+")) {
    if (star || d.length <= 5) {
      if (d.length < 3) return null;
      const short = (star ? "*" : "") + d;
      return { kind: "short", short, display: short };
    }
    if (d.length === 10 && d[0] === "0") d = "+994" + d.slice(1);
    else if (d.length === 12 && d.startsWith("994")) d = "+" + d;
    else if (d.length === 9 && AZ_MOBILE[d.slice(0, 2)]) d = "+994" + d;
    else return { kind: "unknown", display: d };
  }
  const digits = d.slice(1);
  if (digits.length < 7 || digits.length > 15) return { kind: "unknown", display: d };
  const cc = matchCc(digits);
  const national = digits.slice(cc ? cc.length : 0);
  return {
    kind: cc === "994" ? "az" : "intl",
    e164: "+" + digits,
    cc,
    country: cc ? COUNTRY[cc] : null,
    national,
    display: cc ? `+${cc} ${group(national, cc)}` : "+" + digits,
  };
}

// Bütün mətn yalnız bir telefon nömrəsidirsə (sayt və bot bunu "nömrə yoxla" kimi qəbul edir)
export function phoneOnly(text) {
  const p = parsePhone(text);
  if (!p || p.kind === "unknown") return null;
  // Qısa nömrə kimi yalnız rəsmi və ya * ilə başlayanları qəbul edirik ("2026", "4821" kod deyil)
  if (p.kind === "short" && !(OFFICIAL[p.short] || p.short.startsWith("*"))) return null;
  return p;
}

// Mətndəki nömrələr (maskadan əvvəl), təkrarsız
export function phonesInText(text) {
  const t = stripInvisible(String(text || ""));
  const found = new Map();
  for (const m of [...t.matchAll(AZ_IN_TEXT), ...t.matchAll(INTL_IN_TEXT)]) {
    const p = parsePhone(m[0]);
    if (p && (p.kind === "az" || p.kind === "intl") && !found.has(p.e164)) found.set(p.e164, { ...p, raw: m[0] });
  }
  return [...found.values()];
}

// "Bu nömrədən zəng gəldi: +995 55 000 12 34" kimi qısa mətn: tək nömrə var və qalan sözlərdə fırıldaq ifadəsi yoxdur → nömrə yoxlanışı
export function shortTextPhone(text) {
  const t = stripInvisible(String(text || "")).trim();
  if (t.length > 80) return null;
  const nums = phonesInText(t);
  if (nums.length !== 1) return null;
  const rest = t.replace(nums[0].raw, " ");
  if (/https?:|www\.|\.[a-z]{2,}\//i.test(rest) || matchDict(rest).length) return null;
  return nums[0];
}

// Mesajın içindəki riskli nömrə: Azərbaycan nömrəsinə oxşadılmış +995 və ya peyk nömrəsi
export function riskyPhoneInText(text) {
  for (const p of phonesInText(text)) {
    if (p.kind !== "intl") continue;
    if (SATELLITE.has(p.cc)) return { kind: "satellite", display: p.display };
    if (p.cc === "995" && p.national.length === 9 && AZ_MOBILE[p.national.slice(0, 2)]) return { kind: "lookalike", display: p.display };
  }
  return null;
}

export function phoneVerdict(p, counts = { user: 0, message: 0 }) {
  const reasons = [];
  let band = "unknown", type = "";
  const raise = (b) => { if (RANK[b] > RANK[band]) band = b; };

  if (p.kind === "short") {
    const o = OFFICIAL[p.short];
    if (o) {
      band = "official";
      type = "Rəsmi qısa nömrə";
      reasons.push(`Bu, rəsmi nömrədir: ${o.label}. ${o.desc}`);
      reasons.push("Diqqət: fırıldaqçılar zəng edəndə ekranda rəsmi nömrəni saxta göstərə bilər. Belə zəng gəlibsə, söndürün və bu nömrəyə özünüz zəng edin.");
    } else {
      type = "Qısa nömrə";
      reasons.push("Bu qısa nömrənin kimə aid olduğunu bilmirik.");
      reasons.push("Azercell xəbərdarlıq edir: qısa nömrəyə zəng etməzdən və ya SMS göndərməzdən əvvəl qiymətini operatordan soruşun, bəziləri pullu xidmətdir.");
    }
  } else if (p.kind === "az") {
    const pre = p.national.slice(0, 2);
    if (p.national.length !== 9) {
      type = "Azərbaycan nömrəsi (natamam)";
      raise("suspicious");
      reasons.push(`Azərbaycan nömrəsi 9 rəqəmdən ibarət olur (məs. 55 123 45 67), bu nömrədə isə ${p.national.length} rəqəm var. Yazılışı yoxlayın.`);
    } else if (AZ_MOBILE[pre]) {
      type = "Azərbaycan mobil nömrəsi";
      reasons.push(`Azərbaycan mobil nömrəsidir (0${pre}). İlkin operatoru: ${AZ_MOBILE[pre]}; nömrə başqa operatora keçirilmiş ola bilər.`);
    } else if (pre === "12") {
      type = "Bakı şəhər nömrəsi";
      reasons.push("Bakı şəhər nömrəsidir (012).");
    } else {
      type = "Azərbaycan şəhər / region nömrəsi";
      reasons.push(`Azərbaycan şəhər və ya region nömrəsidir (0${pre}).`);
    }
  } else if (SATELLITE.has(p.cc)) {
    type = p.country;
    raise("high");
    reasons.push("Bu, ölkə nömrəsi deyil: peyk və ya beynəlxalq xüsusi şəbəkə nömrəsidir.");
    reasons.push("Belə nömrəyə geri zəng çox baha başa gələ bilər. Tanımırsınızsa, geri zəng etməyin.");
  } else if (p.cc === "995") {
    type = "Gürcüstan nömrəsi (+995)";
    const pre = p.national.slice(0, 2);
    if (p.national.length === 9 && AZ_MOBILE[pre]) {
      raise("high");
      reasons.push(`Diqqət: +995 Gürcüstanın kodudur, Azərbaycanın kodu isə +994-dür. Nömrənin qalan hissəsi Azərbaycan mobil nömrəsinə oxşayır (0${pre} ...), ona görə ilk baxışda yerli nömrə kimi görünür.`);
      reasons.push("İKTA (22.02.2026): Azərbaycana gələn fırıldaq zənglərinin çoxu məhz Azərbaycan nömrəsinə oxşadılmış +995 nömrələrindən gəlir.");
    } else {
      raise("suspicious");
      reasons.push("Gürcüstan nömrəsidir (+995).");
      reasons.push("İKTA-nın məlumatına görə, son vaxtlar Azərbaycana gələn fırıldaq zənglərinin çoxu +995 kodlu nömrələrdəndir. Tanımırsınızsa, ehtiyatlı olun.");
    }
  } else if (!p.cc) {
    type = "Naməlum ölkə kodu";
    raise("suspicious");
    reasons.push("Bu ölkə kodunu tanımırıq. Tanımadığınız xarici nömrəyə geri zəng etməyin.");
  } else {
    type = `Xarici nömrə: ${p.country} (+${p.cc})`;
    raise("suspicious");
    reasons.push(`Xarici nömrədir: ${p.country} (+${p.cc}). Bu ölkədə tanışınız yoxdursa, ehtiyatlı olun.`);
    reasons.push("DİN: 2024-cü ildə xaricdən edilən 16 804 kibermüdaxilə halında vətəndaşlardan 22,4 milyon manat oğurlanıb; insanlar çox vaxt saxta xarici nömrələrə inanıb.");
    reasons.push("Azercell: SMS-də yazılan beynəlxalq nömrələrə zəng etməyin və cavabsız zəng gələn naməlum nömrəyə geri zəng etməyin.");
  }

  const user = counts.user || 0, message = counts.message || 0;
  let crowdHigh = false;
  if (user) reasons.push(`🚩 ${user} ScamShield istifadəçisi bu nömrədən fırıldaq zəngi və ya mesajı aldığını bildirib.`);
  if (message) reasons.push(`🔎 Bu nömrə ScamShield-in çox təhlükəli saydığı ${message} mesajda görünüb.`);
  if (band !== "official") {
    // Yalnız istifadəçi bildirişləri (≥3) zolağı "yüksək"ə qaldırır; mesajlarda görünmək ən çox "ehtiyatlı olun"dur
    if (user >= 3) { crowdHigh = RANK[band] < RANK.high; raise("high"); }
    else if (user + message >= 1) raise("suspicious");
    if (!user && !message) reasons.push(RANK[band] >= RANK.suspicious
      ? "İstifadəçilərdən bu nömrə barədə hələ bildiriş yoxdur: risk nömrənin özündən (ölkə kodu və görünüşü) gəlir."
      : "Bu nömrə barədə ScamShield-də hələ bildiriş yoxdur. Amma bu, nömrənin təhlükəsiz olduğu demək deyil.");
  }

  const advice = band === "official"
    ? "Bu nömrədən zəng gəlibsə və sizdən SMS kodu, kart məlumatı və ya pul istəyirlərsə, zəngi bitirin və bu nömrəyə özünüz zəng edin. Bank və polis heç vaxt SMS kodu istəmir."
    : band === "unknown"
      ? "Kimsə bank, polis və ya dövlət qurumu adından zəng edib kod, kart məlumatı və ya pul istəyirsə, bu, fırıldaqdır. Zəngi bitirin və quruma onun rəsmi nömrəsindən özünüz zəng edin. Ekranda görünən nömrə saxta göstərilə bilər."
      : "Cavab verməyin və geri zəng etməyin. Artıq danışmısınızsa: heç kimə SMS kodu, kartın arxasındakı 3 rəqəmi (CVV) və ya PIN-i deməyin, pul köçürməyin. Bank adından zəng edibsə, kartın arxasındakı nömrəyə özünüz zəng edin.";

  return {
    kind: "phone",
    display: p.display,
    country: p.country || null,
    type,
    band,
    bandLabel: crowdHigh ? "İstifadəçilər fırıldaq kimi bildirib" : BAND_LABEL[band],
    reasons,
    advice,
    reports: { user, message },
    reportable: p.kind === "az" || p.kind === "intl",
    hotlines: GENERIC_HOTLINES,
  };
}

// --- Bildirişlər (yalnız HMAC)
async function hmacHex(env, s) {
  const secret = env.PHONE_PEPPER || env.TELEGRAM_SECRET || "ayiq-local";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(s)));
  return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const phoneKey = (env, p) => (p?.e164 ? hmacHex(env, "tel:" + p.e164) : null);

export async function phoneCounts(env, key) {
  if (!env.DB || !key) return { user: 0, message: 0 };
  const r = await env.DB.prepare(
    "SELECT SUM(CASE WHEN source = 'user' THEN 1 ELSE 0 END) AS u, SUM(CASE WHEN source = 'message' THEN 1 ELSE 0 END) AS m FROM phone_reports WHERE phone = ?1"
  ).bind(key).first();
  return { user: r?.u || 0, message: r?.m || 0 };
}

// İstifadəçi bildirişi. Eyni adam eyni nömrəni yalnız bir dəfə sayır. "dup" | "ok"
export async function addUserReport(env, key, reporterRaw) {
  const reporter = await hmacHex(env, "rep:" + reporterRaw);
  const prev = await env.DB.prepare("SELECT source FROM phone_reports WHERE phone = ?1 AND reporter = ?2").bind(key, reporter).first();
  if (prev?.source === "user") return "dup";
  await env.DB.prepare(
    `INSERT INTO phone_reports (phone, reporter, source, ts) VALUES (?1, ?2, 'user', ?3)
     ON CONFLICT(phone, reporter) DO UPDATE SET source = 'user', ts = ?3`
  ).bind(key, reporter, Date.now()).run();
  return "ok";
}

const AZ_IN_TEXT = /(?:\+?994|\b0)[\s-]?\(?(?:10|12|50|51|55|60|70|77|99)\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}\b/g;
const INTL_IN_TEXT = /\+\d[\d\s\-()]{6,18}\d/g;

// Çox təhlükəli mesajda görünən nömrələr (maskadan əvvəlki mətndən), yalnız HMAC şəklində
export async function recordPhoneSightings(env, text, reporterRaw) {
  if (!env.DB || !text) return 0;
  const found = new Map();
  for (const m of [...String(text).matchAll(AZ_IN_TEXT), ...String(text).matchAll(INTL_IN_TEXT)]) {
    const p = parsePhone(m[0]);
    if (p && (p.kind === "az" || p.kind === "intl") && !found.has(p.e164)) found.set(p.e164, p);
    if (found.size >= 3) break;
  }
  if (!found.size) return 0;
  const reporter = await hmacHex(env, "rep:" + reporterRaw);
  const now = Date.now();
  const stmts = [];
  for (const p of found.values()) {
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO phone_reports (phone, reporter, source, ts) VALUES (?1, ?2, 'message', ?3)").bind(await phoneKey(env, p), reporter, now));
  }
  await env.DB.batch(stmts);
  return stmts.length;
}

const ICON = { high: "🔴", suspicious: "🟠", unknown: "⚪", official: "🟢" };

export function phoneText(v) {
  const lines = [`📞 ${v.display}`, `${ICON[v.band]} ${v.bandLabel}`];
  if (v.type) lines.push(`Növü: ${v.type}`);
  lines.push("", "Nə bilirik?");
  for (const r of v.reasons) lines.push("• " + r);
  lines.push("", "İndi nə etməli?", v.advice, "", "Kimə zəng etməli?");
  for (const h of v.hotlines) lines.push(`📞 ${h.label}: ${h.desc}`);
  lines.push("", "🔒 Nömrə yadda saxlanılmır; bildirişlər yalnız şifrələnmiş şəkildə sayılır.");
  return lines.join("\n");
}
