// ScamShield analiz akışı: skoru kod hesaplar; LLM yalnız ±20 etkiler.
import { stripInvisible, foldForMatch } from "./text.js";
import { maskPII } from "./mask.js";
import { extractUrls, analyzeUrl, sharedHost } from "./url.js";
import { riskyPhoneInText } from "./phone.js";
import { matchDict } from "./dict.js";
import { predictScam } from "./model.js";
import { llmJudge } from "./llm.js";
import { BRANDS, GENERIC_HOTLINES, BANK_CARD_HOTLINE } from "./brands.js";

const CAT_W = { veri_talebi: 30, hesap_ele_gecirme: 40, banka_taklidi: 15, aciliyet: 10, odul: 15, is_teklifi: 30, yardim: 15, kargo: 5, injection: 15, mesru_isaret: -10 };

export const CAT_LABEL = {
  veri_talebi: "Məlumat tələbi",
  hesap_ele_gecirme: "Kod tələbi",
  banka_taklidi: "Bank adından",
  aciliyet: "Təcililik / hədə",
  odul: "Hədiyyə vədi",
  is_teklifi: "Asan qazanc vədi",
  yardim: "Dövlət yardımı bəhanəsi",
  kargo: "Bağlama bəhanəsi",
  injection: "Süni intellekti aldatma cəhdi",
  mesru_isaret: "Normal təhlükəsizlik xəbərdarlığı",
  pul_talebi: "Pul köçürmə tələbi",
  qohum_taklidi: "Yaxın adından yazır",
  investisiya: "Asan yatırım vədi",
};

const BANDS = [
  { max: 29, band: "safe", label: "Təhlükəli görünmür" },
  { max: 69, band: "suspicious", label: "Şübhəlidir, ehtiyatlı olun" },
  { max: 100, band: "high", label: "Çox güman ki, fırıldaqdır" },
];

function reasonText(f) {
  switch (f.code) {
    case "brand_impersonation": return `Bu link ${f.brand} saytı deyil, saxta saytdır: ${f.reg}. Əsl sayt: ${f.official}.`;
    case "brand_link_mismatch": return `Mesaj ${f.brand} adından yazılıb, amma link onların saytına aparmır. Əsl sayt: ${f.official}.`;
    case "messenger_link": return "Sizi Telegram və ya WhatsApp-da tanımadığınız adama yazmağa çağırır.";
    case "vt_malicious": return `VirusTotal yoxlaması: ${f.total} antivirusdan ${f.malicious} dənəsi bu saytı təhlükəli sayır.`;
    case "vt_info": return f.malicious >= 1
      ? `VirusTotal yoxlaması: ${f.total} antivirusdan ${f.malicious} dənəsi bu saytı təhlükəli sayır.`
      : "VirusTotal-da bu sayt barədə hələ qeyd yoxdur. Yeni fırıldaq saytlarında bu normaldır; ona görə ScamShield saytın yaşına və içinə də baxır.";
    case "phone_lookalike": return f.kind === "satellite"
      ? `Mesajdakı nömrə (${f.display}) peyk və ya xüsusi şəbəkə nömrəsidir: geri zəng çox baha başa gələ bilər.`
      : `Mesajdakı nömrə (${f.display}) +995 (Gürcüstan) kodludur, amma Azərbaycan nömrəsinə oxşadılıb. İKTA-ya görə fırıldaq zənglərinin çoxu belə nömrələrdəndir.`;
    case "intel_hit": return f.source === "blacklist_gov_az" ? "Bu sayt dövlətin qara siyahısındadır (Blacklist.gov.az)." : "Bu link artıq fırıldaq saytı kimi qeydə alınıb.";
    case "shortener": return "Link qısaldılıb ki, hara apardığını görməyəsiniz.";
    case "risky_tld": return `Saytın adı .${f.tld} ilə bitir. Fırıldaqçılar belə ucuz saytları çox işlədir.`;
    case "ip_url": return "Link sayt adına yox, rəqəmlərdən ibarət ünvana aparır. Normal şirkətlər belə etmir.";
    case "userinfo_url": return "Linkdə hiylə var: '@' işarəsindən əvvəlki hissə aldatmaq üçündür, əsl sayt başqadır.";
    case "idn_host": return "Sayt adındakı bəzi hərflər oxşar görünən başqa hərflərdir (məsələn, rus hərfi 'а'). Saxta saytdır.";
    case "deep_subdomain": return "Sayt adı çox uzun və qarışıqdır: əsl ünvanı gizlətmək üçün belə edirlər.";
    case "unknown_link": return f.weight >= 30 ? `Bu sayt (${f.reg}) heç bir rəsmi siyahıda yoxdur və haqqında yaxşı məlumat tapılmadı. Tanımadığınız saytda kart məlumatı yazmayın.` : `Link tanımadığımız sayta aparır: ${f.reg}. Əmin deyilsinizsə, açmayın.`;
    case "new_domain": return `Bu sayt cəmi ${f.days} gün əvvəl açılıb. Fırıldaq saytları adətən təzə olur və tez bağlanır.`;
    case "young_domain": return `Bu sayt təzədir: cəmi ${f.days} gündür var.`;
    case "old_domain": return `Bu sayt ${Math.floor(f.days / 365)} ildir mövcuddur: təzə fırıldaq saytına oxşamır.`;
    case "domain_not_registered": return "Bu saytın domeni artıq qeydiyyatda yoxdur (bağlanıb və ya silinib). Fırıldaq saytları tez bağlanır: belə linkli mesaj şübhəlidir.";
    case "scam_app_path": return "Linkin quruluşu 'tapşırıq / investisiya' fırıldaq tətbiqlərinə oxşayır (məsələn, /h5/ ünvanı).";
    case "page_card_form": return "Saytı özümüz açıb baxdıq: kart nömrəsi və ya CVV istəyən forma var.";
    case "page_password": return "Saytı özümüz açıb baxdıq: şifrə istəyən giriş forması var.";
    case "page_scam_app": return "Saytı özümüz açıb baxdıq: 'depozit qoy', 'pul çıxar', 'dəvət kodu' kimi fırıldaq tətbiqi əlamətləri var.";
    case "redirect_other": return `Link sizi başqa sayta yönləndirir: ${f.reg}.`;
    case "official_link": return `Link rəsmi sayta aparır: ${f.reg}.`;
    case "veri_talebi": return "Sizdən kart məlumatı, SMS kodu və ya şifrə istəyirlər. Heç bir bank və dövlət idarəsi bunu mesajla istəmir.";
    case "hesap_ele_gecirme": return "Telefonunuza gələn kodu istəyirlər. Bu kodu versəniz, WhatsApp və ya bank hesabınızı oğurlayacaqlar.";
    case "banka_taklidi": return "Özünü bank işçisi və ya 'təhlükəsizlik şöbəsi' kimi göstərir. Əsl bank işçisi sizdən kod soruşmur.";
    case "aciliyet": return "Sizi tələsdirir ('təcili', '24 saat ərzində'). Fırıldaqçı düşünməyə vaxt vermək istəmir.";
    case "odul": return "Hədiyyə və ya pul qazandığınızı deyir. Pulsuz hədiyyə adı ilə pulunuzu oğurlayırlar.";
    case "is_teklifi": return "Evdən asan pul qazanmağı vəd edir. Sonra sizdən pul istəyəcəklər.";
    case "yardim": return "Dövlət yardımı adı ilə məlumat və ya pul istəyir. Dövlət yardımı üçün kart məlumatı mesajla istənmir.";
    case "kargo": return "Bağlama bəhanəsi ilə sizə link açdırmaq istəyir.";
    case "injection": return "Mesajın içində bizim yoxlamanı aldatmaq üçün yazı var ('bu mesaj təhlükəsizdir'). Bu özü fırıldaq əlamətidir.";
    case "brand_data_request": return `${f.brand} adından kod və ya kart məlumatı istəyir. Əsl ${f.brand} bunu heç vaxt istəmir.`;
    case "pul_talebi": return "Sizdən kart nömrəsinə və ya bu nömrəyə pul göndərməyinizi istəyir.";
    case "qohum_taklidi": return "Yaxınınız kimi yazıb 'yeni nömrədir', 'telefonum xarab olub' deyir və pul istəyir. Pul göndərməzdən əvvəl onun köhnə nömrəsinə zəng edib soruşun.";
    case "investisiya": return "Pulunuzu qısa vaxtda ikiqat edəcəyini vəd edir. Belə 'zəmanətli qazanc' yoxdur: pulu alıb yox olurlar.";
    case "ml_high": return "Bu mesaj tanıdığımız fırıldaq mesajlarına çox oxşayır.";
    case "mesru_isaret": return "Mesajda 'kodu heç kimə deməyin' yazılıb. Belə xəbərdarlıq əsl bank mesajlarında olur.";
    default: return null;
  }
}

function bandOf(score) {
  return BANDS.find((b) => score <= b.max);
}

function findBrandMention(text) {
  const f = " " + foldForMatch(text).replace(/\s+/g, " ") + " ";
  for (const b of BRANDS) if (b.mentions.some((m) => f.includes(m))) return b;
  return null;
}

// Saytın özü barədə sübut sayılan bayraqlar: ictimai lentdə sayt adı yalnız bunlardan biri o linkin özündə olanda göstərilir
const DOMAIN_EVIDENCE = new Set(["brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app", "new_domain",
  "young_domain", "domain_not_registered", "scam_app_path", "idn_host", "userinfo_url", "ip_url"]);

function campaignInfo(urls, cats, brand) {
  const cand = urls.filter((u) => !u.official && !u.messenger);
  const ev = cand.find((u) => u.flags.some((f) => DOMAIN_EVIDENCE.has(f.code)));
  const bad = ev || cand[0];
  const top = Object.keys(cats).filter((c) => cats[c] > 0 && c !== "mesru_isaret").sort();
  const key = bad ? "domen:" + bad.reg : `metn:${brand?.name || "-"}|${top.join("+")}`;
  let label = "Şübhəli mesaj";
  if (brand) label = `${brand.name} təqlidi`;
  else if (cats.is_teklifi) label = "Saxta iş təklifi";
  else if (cats.yardim) label = "Saxta dövlət yardımı";
  else if (cats.hesap_ele_gecirme) label = "Hesab oğurluğu (kod tələbi)";
  else if (cats.odul) label = "Saxta hədiyyə / uduş";
  else if (cats.kargo) label = "Saxta bağlama bildirişi";
  else if (cats.veri_talebi) label = "Kart məlumatı tələbi";
  return { key, label, domain: bad?.reg || null, evidence: !!ev };
}

export async function analyze(input, deps = {}) {
  const text = stripInvisible(String(input ?? "")).slice(0, 2000);
  const masked = maskPII(text);
  const flags = [];

  // Linkler
  const urls = extractUrls(text).slice(0, 10).map(analyzeUrl);
  if (deps.intelLookup && urls.length) {
    try {
      const hits = await deps.intelLookup(urls.flatMap((u) => [u.host, u.host.replace(/^www\./, "")]));
      for (const u of urls) {
        if (u.official || u.messenger || sharedHost(u.host)) continue; // google.com, bit.ly kimi ümumi platformalar
        const host = u.host.replace(/^www\./, "");
        if (hits.has(u.host) || hits.has(host)) u.flags.push({ code: "intel_hit", weight: 40, source: hits.get?.(u.host) || hits.get?.(host) || null });
      }
    } catch { /* istihbarat yoksa devam */ }
  }
  // LLM'i şimdiden başlat (link kontrolüyle paralel)
  const llmP = deps.env && deps.useLlm !== false ? llmJudge(deps.env, masked.text).catch(() => null) : Promise.resolve(null);
  // Linki gerçekten incele: alan adı yaşı + sayfanın içi (yalnız canlı sistemde)
  let linkChecked = false;
  if (deps.linkCheck && urls.length) {
    try {
      const extra = await deps.linkCheck(urls);
      for (const u of urls) {
        const f = extra.get(u.host);
        if (!f) continue;
        linkChecked = true;
        u.flags.push(...f.filter((x) => x.code !== "page_checked" && !(x.code === "brand_impersonation" && u.flags.some((y) => y.code === "brand_impersonation"))));
        const age = f.find((x) => x.days !== undefined);
        if (age) u.ageDays = age.days;
        u.pageChecked = f.some((x) => x.code === "page_checked");
        u.registryChecked = true;
      }
    } catch { /* link kontrolü olmazsa devam */ }
  }
  const textOnly = urls.reduce((t, u) => t.replace(u.raw, " "), text).replace(/\s+/g, " ").trim();
  const STRONG_URL = new Set(["brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app", "new_domain"]);
  for (const u of urls) {
    if (u.official || u.messenger) continue;
    const bare = textOnly.length < 15; // mesaj yalnız bir linkdən ibarətdir
    // köhnə sayt yalnız güclü əlamət yoxdursa yumşaldır
    if (u.flags.some((f) => STRONG_URL.has(f.code))) u.flags = u.flags.filter((f) => f.code !== "old_domain");
    const positive = u.flags.filter((f) => f.weight > 0);
    const old = u.flags.some((f) => f.code === "old_domain");
    if (bare && !old && !u.flags.some((f) => STRONG_URL.has(f.code))) u.flags.push({ code: "unknown_link", weight: 30, reg: u.reg });
    else if (positive.length === 0) u.flags.push({ code: "unknown_link", weight: 5, reg: u.reg });
  }
  // her kod bir kez, en yüksek ağırlıkla
  const urlFlagMap = new Map();
  for (const u of urls) for (const f of u.flags) {
    const prev = urlFlagMap.get(f.code);
    if (!prev || f.weight > prev.weight) urlFlagMap.set(f.code, { ...f, reg: f.reg || u.reg });
  }
  flags.push(...urlFlagMap.values());

  // Sözlük + kalıp kuralları (katlanmış metinde; konumlar orijinale denk gelir)
  const hits = matchDict(text);
  const folded = foldForMatch(text);
  const PATTERNS = [
    // "kodu / kodunu ... göndərin / deyin / yazın / bildirin / verin" (olumsuz "-mə-" hâlleri eşleşmez)
    { re: /\bkod[a-z]*\b(?:\s+\S+){0,3}?\s+(?:gonderin|gonder|deyin|yazin|bildirin|verin)\b/gu, cat: "veri_talebi", weight: 30, phrase: "kod tələbi" },
    // "kartınızı / məlumatlarınızı / hesabınızı təsdiqləyin"
    { re: /\b(?:kartinizi|melumatlarinizi|hesabinizi|unvaninizi)\s+(?:\S+\s+)?tesdiqleyin/gu, cat: "veri_talebi", weight: 25, phrase: "məlumat təsdiqi" },
    { re: /\btesdiqleyin\b/gu, cat: "veri_talebi", weight: 10, phrase: "təsdiqləyin" },
    // kiçik məbləğli ödəniş (bağlama / gömrük tələsi): "1.20 AZN ödəyin", "pay 1.20 AZN"
    { re: /(?:ode|pay|оплат)[\p{L}]*[^.\n]{0,40}?\b\d{1,2}[.,]\d{2}\s?(?:azn|manat|₼)|\b\d{1,2}[.,]\d{2}\s?(?:azn|manat|₼)[^.\n]{0,30}?(?:ode|pay|fee|rusum|haqq)/giu, cat: "veri_talebi", weight: 15, phrase: "kiçik ödəniş tələbi" },
  ];
  PATTERNS.push(
    // sohbet tarzı kod avı: "kod gələcək, mənə at", "send me the 6 digit code"
    { re: /\bkod[a-z]*\b[^.\n]{0,40}?\b(?:mene|bize)\s+(?:at|gonder|yaz|de|ver)\b/gu, cat: "hesap_ele_gecirme", weight: 40, phrase: "kodu mənə at" },
    { re: /\b(?:send|forward|tell|give)\s+(?:me\s+)?(?:the\s+|that\s+|your\s+)?(?:\d[- ]?digit\s+)?(?:sms\s+|verification\s+|whatsapp\s+)?code\b/gu, cat: "hesap_ele_gecirme", weight: 40, phrase: "send me the code" },
    { re: /\b(?:code|kod)\b[^.\n]{0,40}?(?:by mistake|sehven)|(?:by mistake|sehven)[^.\n]{0,40}?\b(?:code|kod)/gu, cat: "hesap_ele_gecirme", weight: 40, phrase: "səhvən kod" },
    { re: /\b(?:reply|respond|enter)\s+(?:with\s+)?(?:the\s+|your\s+)?(?:sms\s+|otp\s+)?code\b/gu, cat: "veri_talebi", weight: 30, phrase: "reply with the code" },
    { re: /\b(?:card|account)\s+(?:has been|is|was|will be)\s+(?:blocked|suspended|locked|closed)/gu, cat: "aciliyet", weight: 10, phrase: "card blocked" },
    { re: /карт[аы]\s+(?:была\s+)?заблокирован/gu, cat: "aciliyet", weight: 10, phrase: "карта заблокирована" },
    { re: /\b\d{2,5}\s?(?:azn|manat|man)\b[^.\n]{0,20}?\b(?:at|gonder|kocur|yolla)\b|\bpul\s+(?:at|gonder(?:in)?|kocur(?:un)?|yolla(?:yin)?)\b|\bkarta\s+(?:at|kocur(?:un)?)\b|\bkart nomresine\b[^.\n]{0,15}?(?:at|kocur|gonder)|\bnomreye pul\b|\bsend\s+(?:me\s+)?\d{2,5}\s?(?:azn|manat|usd|\$)|переведи|скинь\s+\d+|\bborc\b[^.\n]{0,20}?(?:lazim|ver)/gu, cat: "pul_talebi", weight: 20, phrase: "pul köçürmə tələbi" },
    { re: /\b(?:ikiqat|iki qat|2 qat|3 qat|uc qat|qat artir)|zemanetli\s+(?:gelir|qazanc)|\brisksiz\b|guaranteed\s+(?:returns?|profit|income)|гарантия дохода|гарантированн/gu, cat: "investisiya", weight: 30, phrase: "zəmanətli / ikiqat qazanc" },
    { re: /\b(?:yatir|invest|deposit|depozit)[a-z]*\b[^.\n]{0,30}?\d{2,6}[^.\n]{0,40}?\b(?:geri|qazan|get|alacaq|qaytar|receive)|вложи[^.\n]{0,30}?\d{2,6}[^.\n]{0,30}?получи/gu, cat: "investisiya", weight: 30, phrase: "yatır, qat-qat al" },
    { re: /\b(?:bitcoin|kripto|crypto|usdt|btc)\b[^.\n]{0,60}?\b(?:qazan|gelir|earn|profit|yatir|invest)|крипт[^.\n]{0,40}?(?:вложи|доход)/gu, cat: "investisiya", weight: 25, phrase: "kripto qazanc vədi" },
    { re: /\b(?:gunde|gunluk|heftede|hefte|per day|a day)\b[^.\n]{0,25}?\d{2,5}\s?(?:azn|manat|man|\$|usd)\b|\b\d{2,5}(?:\s?-\s?\d{2,5})?\s?(?:azn|manat|\$|usd)\b[^.\n]{0,20}?\b(?:gunde|gunluk|heftede|per day|a day|qazan)|в день|в неделю/gu, cat: "is_teklifi", weight: 30, phrase: "gündəlik qazanc vədi" },
    { re: /\b(?:part-time|like bas|rey yaz|tapsiriq|evden isle|evden is|ev xanimlari ucun is|work from home|earn \$?\d+)|работа на дому|заработок|без опыта/gu, cat: "is_teklifi", weight: 25, phrase: "asan iş təklifi" },
    { re: /\b(?:evvelce|first)\b[^.\n]{0,25}?\b(?:depozit|deposit|odenis|qeydiyyat haqqi)/gu, cat: "is_teklifi", weight: 30, phrase: "əvvəlcə pul ödə" },
    { re: /\b(?:iane|xeste usaq|emeliyyat ucun pul|yardim edin)\b|помогите|пожертв/gu, cat: "yardim", weight: 15, phrase: "ianə xahişi" },
  );
  const idChange = /\b(?:yeni nomre|nomrem deyis|telefonum (?:xarab|suya|sinib|itib)|telefon (?:suya dusdu|xarab)|bu nomre yenidir|menem\b)|my phone (?:broke|is broken)|new number|сломался телефон|новый номер/u.exec(folded);
  const moneyAsk = /\b\d{2,5}\s?(?:azn|manat|man|\$)|\bpul\b|\bborc\b|karta|kart nomresine|\bsend\b|переведи|скинь|денег/u.test(folded);
  if (idChange && moneyAsk) hits.push({ start: idChange.index, end: idChange.index + idChange[0].length, cat: "qohum_taklidi", weight: 35, phrase: "yaxın adından yeni nömrə" });
  const cardNo = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/u.exec(folded);
  if (cardNo && /\b(?:at|kocur|gonder|iane|yardim|send|transfer)\b|переведи/u.test(folded)) hits.push({ start: cardNo.index, end: cardNo.index + cardNo[0].length, cat: "pul_talebi", weight: 30, phrase: "kart nömrəsinə pul" });
  for (const p of PATTERNS) {
    for (const m of folded.matchAll(p.re)) hits.push({ start: m.index, end: m.index + m[0].length, cat: p.cat, weight: p.weight, phrase: p.phrase });
  }
  // Danışıq (zəng / səsli mesaj) ssenariləri. Səs tanıma felləri ("deyin") tez-tez səhv yazır, ona görə fel tələb olunmur.
  // Bank SMS-i "Salam, mən…" ilə başlamır; əsl OTP SMS-də kodun özü olur (maskada [KOD]) və «heç kimə deməyin» yazılır.
  const speech = /\b(?:salam|men|menem|bizim)\b/u.test(folded);
  const bankWord = /\b(?:bank|birbank|kapital|abb|pasa ?bank|pasha|leobank|unibank|xalq ?bank|access ?bank|yelo|rabite)/u.test(folded);
  const codeWord = /\bsms\s*kod[a-z]*|\bkod(?:u|unu|lar|lari)?\b|\bsifre[a-z]*|\bparol[a-z]*|\bpin\b|\bcvv\b|\bcvc\b/u.exec(folded);
  const bankThreat = /blok|subheli|odenis|emeliyyat|tehlukesizlik|dondur/u.test(folded);
  const legitOtp = masked.found.kod > 0 || /\bhec kime\b/u.test(folded);
  if (speech && bankWord && codeWord && bankThreat && !legitOtp) {
    hits.push({ start: codeWord.index, end: codeWord.index + codeWord[0].length, cat: "hesap_ele_gecirme", weight: 40, phrase: "bank adından kod tələbi (zəng ssenarisi)" });
  }
  // "Salam, Azərpoçtdan… bağlamanız saxlanılıb, bir manat ödəyin": danışıqda bağlama + ödəniş tələbi
  const parcelPay = /\bode(?:yin|yesiniz|nis edin|mek lazim)\b|\b(?:bir|iki|uc|bes|yarim|\d{1,2})\s+manat\b/u.exec(folded);
  if (speech && parcelPay && /\b(?:baglama|gomruk|azerpo|kuryer|catdirilma)/u.test(folded)) {
    hits.push({ start: parcelPay.index, end: parcelPay.index + parcelPay[0].length, cat: "veri_talebi", weight: 25, phrase: "bağlama üçün ödəniş tələbi (zəng ssenarisi)" });
  }
  const cats = {};
  const phrases = {};
  for (const h of hits) {
    const w = h.weight; // ağırlıklar data/sozluk.csv'de (istek ifadeleri güçlü, "SMS kodu" gibi adlar zayıf)
    phrases[h.cat] = phrases[h.cat] || new Set();
    phrases[h.cat].add(h.phrase);
    cats[h.cat] = cats[h.cat] === undefined ? w : (w > 0 ? Math.max(cats[h.cat], w) : Math.min(cats[h.cat], w));
  }
  for (const c of Object.keys(cats)) {
    const extra = c === "mesru_isaret" ? 0 : Math.min(15, (phrases[c].size - 1) * 5);
    cats[c] += extra;
    flags.push({ code: c, weight: cats[c] });
  }

  const brand = findBrandMention(text) || BRANDS.find((b) => b.name === (urlFlagMap.get("brand_impersonation")?.brand)) || null;
  const strongData = (cats.veri_talebi ?? 0) >= 25 || cats.hesap_ele_gecirme > 0 || (cats.pul_talebi ?? 0) >= 20 || cats.qohum_taklidi > 0;
  const badLink = urls.some((u) => !u.official && !u.messenger);
  const messengerLink = urls.some((u) => u.messenger);
  const officialOnly = urls.length > 0 && urls.every((u) => u.official);
  // "pulsuz", "bonus" gibi zayıf reklam kelimeleri tuzak sayılmaz
  const lure = (cats.odul ?? 0) >= 20 || (cats.is_teklifi ?? 0) >= 25 || (cats.yardim ?? 0) >= 15 || (cats.investisiya ?? 0) >= 25;
  const pressure = cats.aciliyet > 0 || (cats.veri_talebi ?? 0) >= 10 || cats.hesap_ele_gecirme > 0 || (cats.pul_talebi ?? 0) > 0;
  const hardBadLink = urls.some((u) => !u.official && !u.messenger && !u.flags.some((f) => f.code === "shortener"));
  if (strongData && brand && !officialOnly) flags.push({ code: "brand_data_request", weight: 10, brand: brand.name });
  const impersonation = urlFlagMap.has("brand_impersonation");
  if ((strongData && (cats.aciliyet || cats.banka_taklidi || badLink || messengerLink || lure)) || (lure && (badLink || messengerLink || strongData || pressure)) || (impersonation && (pressure || lure || cats.kargo > 0)) ||
      (cats.hesap_ele_gecirme > 0 && brand) || ((cats.veri_talebi ?? 0) >= 25 && cats.kargo > 0 && brand)) {
    flags.push({ code: "combo", weight: 25 });
  }
  // Mesaj bir marka adına yazılmış ama link o markanın resmi sitesine gitmiyor
  // (kısaltılmış link markaların reklamlarında da kullanılır: o durumda yalnız baskı / veri isteği varsa)
  if (brand && badLink && !urlFlagMap.has("brand_impersonation") && (hardBadLink || pressure)) {
    flags.push({ code: "brand_link_mismatch", weight: 15, brand: brand.name, official: brand.domains[0] });
  }
  if (officialOnly && !strongData) flags.push({ code: "official_link", weight: -30, reg: urls[0].reg });
  // Mesajdakı nömrə: Azərbaycan nömrəsinə oxşadılmış +995 və ya peyk nömrəsi (İKTA, 22.02.2026)
  const riskyPhone = riskyPhoneInText(text);
  if (riskyPhone) flags.push({ code: "phone_lookalike", weight: riskyPhone.kind === "satellite" ? 25 : 30, kind: riskyPhone.kind, display: riskyPhone.display });

  // ML: kurallar + model katkısı ile modelin tek başına güveninden büyüğü alınır; olumsuz işaretler ikisinden de düşer
  const p = predictScam(text);
  if (p >= 0.7) flags.push({ code: "ml_high", weight: 0 });
  const pos = flags.reduce((s, f) => s + Math.max(0, f.weight), 0);
  const neg = flags.reduce((s, f) => s + Math.min(0, f.weight), 0);
  const mlAlone = officialOnly && !strongData ? 0 : p >= 0.5 ? p * 85 : 0;
  let score = Math.max(pos + p * 30, mlAlone) + neg;

  // LLM (yalnız maskelenmiş metin)
  const llm = await llmP;
  if (llm) score += llm.adjust; // LLM yalnız ±20 etkiler; görünen işaretler kurallardan gelir

  const injection = cats.injection > 0 || flags.some((f) => f.code === "injection");
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (injection) score = Math.max(score, 50);
  // Mesaj yalnız bir linkdirsə və link özü saxtadırsa (brend təqlidi, fırıldaq siyahısı, kart forması),
  // mətn olmasa da nəticə «çox təhlükəli» olsun: istifadəçi çox vaxt yalnız linki kopyalayır.
  const bareFake = textOnly.length < 15 && urls.some((u) => !u.official && !u.messenger &&
    u.flags.some((f) => ["brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app"].includes(f.code)));
  if (bareFake) score = Math.max(score, 75);
  const b = bandOf(score);

  // Açıklamalar: en ağır 4 işaret
  const shown = flags
    .filter((f) => f.code !== "combo" && (f.weight > 0 || f.code === "ml_high" || f.code === "injection" || (b.band === "safe" && f.weight < 0)))
    .sort((a, b2) => (b2.code === "injection") - (a.code === "injection") || b2.weight - a.weight)
    .slice(0, 4)
    .map((f) => ({ code: f.code, text: reasonText(f) }))
    .filter((r) => r.text);

  const advice = b.band === "high"
    ? (urls.length
      ? "Linkə basmayın. Heç kimə kart nömrəsi, SMS kodu və ya şifrə deməyin. Mesaja cavab yazmayın, nömrəni bloklayın və mesajı silin."
      : "Heç kimə kart nömrəsi, SMS kodu və ya şifrə deməyin. Mesaja cavab yazmayın, zəng gəlsə telefonu qapadın, nömrəni bloklayın.")
    : b.band === "suspicious"
      ? "Tələsməyin. Mesaja inanmazdan əvvəl şirkətin öz rəsmi nömrəsinə zəng edib soruşun. O vaxta qədər kart məlumatı və kod verməyin."
      : "Ciddi təhlükə əlaməti tapmadıq. Amma yenə də heç kimə kart məlumatı və SMS kodu verməyin.";
  const isBank = brand && /bank|abb/i.test(brand.name);
  const hotlines = [];
  const seenNum = new Set();
  for (const h of [brand?.hotline, isBank && !brand?.hotline ? BANK_CARD_HOTLINE : null, cats.banka_taklidi && !isBank ? BANK_CARD_HOTLINE : null, ...GENERIC_HOTLINES]) {
    if (!h || seenNum.has(h.label)) continue;
    seenNum.add(h.label);
    hotlines.push(h);
  }

  const highlights = [
    ...hits.filter((h) => h.cat !== "mesru_isaret").map((h) => ({ start: h.start, end: h.end, label: CAT_LABEL[h.cat] })),
    ...urls.filter((u) => !u.official).map((u) => ({
      start: u.start, end: u.end,
      label: u.flags.some((f) => f.code === "brand_impersonation") ? `Saxta link: əsl domen ${u.reg}` : `Naməlum link: ${u.reg}`,
    })),
  ].sort((x, y) => x.start - y.start);

  const campaign = score >= 50 ? campaignInfo(urls, cats, brand) : null;

  return {
    score, band: b.band, bandLabel: b.label,
    reasons: shown, advice, hotlines, highlights,
    urls: urls.map((u) => {
      const codes = u.flags.map((f) => f.code);
      const danger = codes.some((c) => ["brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app", "new_domain", "domain_not_registered", "scam_app_path", "ip_url", "userinfo_url", "idn_host"].includes(c));
      return {
        raw: u.raw, host: u.host, reg: u.reg, official: u.official, messenger: !!u.messenger, brand: u.brand,
        blacklisted: u.flags.some((f) => f.code === "intel_hit" && f.source === "blacklist_gov_az"),
        // «şübhəli» yalnız bala təsir edən link əlamətindən gəlir: vt_info (0 çəki) və old_domain (mənfi) məlumatdır
        verdict: u.official ? "official" : danger ? "danger" : u.flags.some((f) => f.weight > 0 && f.code !== "unknown_link") ? "suspicious" : "unknown",
        ageDays: u.ageDays ?? null,
        registry: codes.includes("domain_not_registered") ? "missing" : u.ageDays != null ? "found" : u.registryChecked ? "unknown" : "not_checked",
        pageChecked: !!u.pageChecked,
        pageStatus: !u.registryChecked ? "not_checked" : u.pageChecked ? "opened" : "failed",
        findings: u.flags.filter((f) => f.weight !== 0 || f.code === "vt_info").map((f) => ({ code: f.code, text: reasonText(f) })).filter((x) => x.text),
        flags: codes,
      };
    }),
    masked: { total: masked.total, found: masked.found },
    linkChecked,
    ml: Math.round(p * 1000) / 1000,
    llm: llm ? { used: true, verdict: llm.verdict, adjust: llm.adjust } : { used: false },
    brand: brand?.name || null,
    flags: flags.map((f) => f.code),
    campaign,
  };
}
