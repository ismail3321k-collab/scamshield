// Bot axınlarının testi: sahte D1 (node:sqlite) + Telegram API əvəzi. İnternet tələb etmir.
// İşə salmaq: node tools/bot-test.mjs
import { fakeD1, mockTelegram } from "./fake-d1.mjs";
import { handleTelegram, parseCommand } from "../src/telegram.js";
import { todayData, todayText } from "../src/today.js";

let fails = 0, passes = 0;
function ok(cond, name, extra = "") {
  if (cond) passes++;
  else { fails++; console.log("FAIL", name, extra); }
}

const tgMock = mockTelegram();
const env = { DB: fakeD1(), TELEGRAM_TOKEN: "x", TELEGRAM_SECRET: "s3cret", TG_PATH: "p", PHONE_PEPPER: "pepper-test" };

async function update(u) {
  const pending = [];
  const ctx = { waitUntil: (p) => pending.push(p) };
  const req = new Request("https://x/tg/p", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": "s3cret" }, body: JSON.stringify(u) });
  const res = await handleTelegram(req, env, ctx);
  await Promise.all(pending);
  return res;
}
let mid = 1;
const user = (id, first) => ({ id, is_bot: false, first_name: first, username: first.toLowerCase() });
const msgFrom = (u, text) => ({ update_id: mid++, message: { message_id: mid, from: u, chat: { id: u.id, type: "private" }, date: 0, text } });
const sent = (method) => tgMock.calls.filter((c) => c.method === method);
const lastText = () => sent("sendMessage").at(-1)?.body?.text || "";

// --- Əmr ayrıştırma
ok(parseCommand("/bugun")?.name === "bugun", "cmd plain");
ok(parseCommand("/Bugün@ayiq_yoxla_bot")?.name === "bugun", "cmd az + @bot");
ok(parseCommand("/qoru Anam")?.arg === "Anam", "cmd arg");
ok(parseCommand("/NÖMRƏ +994 50 123 45 67")?.name === "nomre", "cmd upper az");
ok(parseCommand("salam") === null, "not cmd");

// --- Gizli açar yoxdursa 403
{
  const req = new Request("https://x/tg/p", { method: "POST", body: "{}" });
  const res = await handleTelegram(req, env, { waitUntil() {} });
  ok(res.status === 403, "secret required");
}

// --- Bu gün yayılan tələlər (boş)
const ali = user(1001, "Ali");
await update(msgFrom(ali, "/bugun"));
ok(/kampaniya qeydə alınmayıb/.test(lastText()), "today empty", lastText());

// --- Bu gün: kampaniya əlavə et
const now = Date.now();
const db = env.DB;
await db.prepare("INSERT INTO campaigns (key, label, brand, domain, first_seen, last_seen, count, max_score, flags) VALUES ('domen:azerpost-x.top','Azərpoçt təqlidi','Azərpoçt','azerpost-x.top',?1,?1,3,92,'brand_impersonation,veri_talebi,kargo,domain_evidence')").bind(now).run();
await db.prepare("INSERT INTO campaigns (key, label, brand, domain, first_seen, last_seen, count, max_score, flags) VALUES ('domen:rakip.az','Kapital Bank təqlidi','Kapital Bank','rakip.az',?1,?1,1,75,'hesap_ele_gecirme,brand_link_mismatch')").bind(now).run();
for (let i = 0; i < 3; i++) await db.prepare("INSERT INTO checks (ts, channel, score, band, flags, domain, brand, campaign_id) VALUES (?1,'web',92,'high','',NULL,'Azərpoçt',1)").bind(now - i * 1000).run();
await db.prepare("INSERT INTO checks (ts, channel, score, band, flags, domain, brand, campaign_id) VALUES (?1,'web',75,'high','',NULL,'Kapital Bank',2)").bind(now).run();
await db.prepare("INSERT INTO checks (ts, channel, score, band, flags, domain, brand, campaign_id) VALUES (?1,'web',10,'safe','',NULL,NULL,NULL)").bind(now).run();
await db.prepare("INSERT INTO checks (ts, channel, score, band, flags, domain, brand, campaign_id) VALUES (?1,'web',95,'high','',NULL,'Azərpoçt',1)").bind(now - 2 * 86400000).run();
const d = await todayData(env);
ok(d.total === 5 && d.high === 4, "today stats", JSON.stringify(d));
ok(d.items[0].label === "Azərpoçt adından saxta mesaj" && d.items[0].count === 3, "today top item", JSON.stringify(d.items[0]));
ok(d.items[0].domain === "azerpost-x[.]top", "today evidence domain defanged", d.items[0].domain);
ok(d.items[1].domain === null, "today no evidence → domain hidden", JSON.stringify(d.items[1]));
ok(d.items[0].wants.includes("kart məlumatı istəyir"), "today wants");
ok(/1\. Azərpoçt adından saxta mesaj — 3 dəfə/.test(todayText(d)), "today text");

// Eyni qurumun kampaniyaları bir sətirdə birləşir
{
  const { groupCampaigns, todayText: tt } = await import("../src/today.js");
  const t = Date.now();
  const g = groupCampaigns([
    { label: "Azərpoçt təqlidi", brand: "Azərpoçt", domain: "azerpost-catdirilma.top", flags: "brand_impersonation,kargo,veri_talebi,domain_evidence", n: 1, last: t - 5000 },
    { label: "Azərpoçt təqlidi", brand: "Azərpoçt", domain: "870189.com", flags: "intel_hit,kargo,domain_evidence", n: 1, last: t },
    { label: "Kapital Bank təqlidi", brand: "Kapital Bank", domain: "kart-yenile.com", flags: "brand_impersonation,hesap_ele_gecirme,domain_evidence", n: 1, last: t - 9000 },
    { label: "Kapital Bank təqlidi", brand: "Kapital Bank", domain: null, flags: "hesap_ele_gecirme,aciliyet", n: 1, last: t - 8000 },
    { label: "Saxta iş təklifi", brand: null, domain: "temiz-sayt.az", flags: "is_teklifi,messenger_link", n: 3, last: t - 100000 },
  ]);
  ok(g.length === 3, "grouped to 3", JSON.stringify(g));
  ok(g[0].label === "Saxta iş təklifi" && g[0].count === 3 && g[0].domains.length === 0, "no evidence → no site", JSON.stringify(g[0]));
  const az = g.find((x) => x.label === "Azərpoçt adından saxta mesaj");
  ok(az.count === 2 && az.domains.join() === "azerpost-catdirilma[.]top,870189[.]com" && az.domain === "azerpost-catdirilma[.]top" && az.last === t, "azerpost merged", JSON.stringify(az));
  ok(g[1].label === "Azərpoçt adından saxta mesaj", "tie broken by last (newest first)");
  const kb = g.find((x) => x.label === "Kapital Bank adından saxta mesaj");
  ok(kb.count === 2 && kb.domains.length === 1 && kb.wants.length <= 2, "kapital merged", JSON.stringify(kb));
  const text = tt({ total: 5, high: 5, items: g });
  ok(/Azərpoçt adından saxta mesaj — 2 dəfə\n   Nə istəyir: .+\n   2 fərqli sayt: azerpost-catdirilma\[\.\]top, 870189\[\.\]com/.test(text), "bot text grouped", text);
  ok(/Kapital Bank adından saxta mesaj — 2 dəfə\n   Nə istəyir: .+\n   Sayt: kart-yenile\[\.\]com/.test(text), "bot text single site", text);
  const many = groupCampaigns(["a.top", "b.top", "c.top", "d.top"].map((dm, k) => ({ label: "Azərpoçt təqlidi", brand: "Azərpoçt", domain: dm, flags: "new_domain,domain_evidence", n: 1, last: k })));
  ok(many[0].domains.length === 3 && /3 fərqli sayt: a\[\.\]top, b\[\.\]top \+1/.test(tt({ total: 4, high: 4, items: many })), "max 3 domains, bot shows 2 +1", tt({ total: 4, high: 4, items: many }));
}
tgMock.clear();
await update(msgFrom(ali, "/start bugun"));
ok(/Bu gün yayılan tələlər \(son 24 saat\)/.test(lastText()), "start=bugun", lastText());

// --- Kömək və naməlum əmr
await update(msgFrom(ali, "/komek"));
ok(/\/qoru/.test(lastText()) && /\/oyun/.test(lastText()), "help lists commands");
await update(msgFrom(ali, "/blabla"));
ok(/tanımıram/.test(lastText()), "unknown cmd");

// --- Yaxınını qoru
const ayse = user(2002, "Ayşe");   // qorunan (ana)
const murad = user(3003, "Murad"); // qoruyan (övlad)
const yad = user(4004, "Yad");     // kənar adam
const cbUpdate = (from, data, chatType = "private") => ({ update_id: mid++, callback_query: { id: "cb" + mid, from, data, message: { message_id: 77, chat: { id: from.id, type: chatType } } } });
const codeOf = (t) => /start=q_([A-Za-z0-9_-]{16})/.exec(t)?.[1];
const countGuards = async () => (await env.DB.prepare("SELECT COUNT(*) AS n FROM guards").first("n"));

tgMock.clear();
await update(msgFrom(murad, "/qoru Anam"));
const code = codeOf(lastText());
ok(!!code, "invite code", lastText());
const inviteInfo = sent("sendMessage").at(-2).body;
ok(/«Anam»/.test(inviteInfo.text) && /Növbəti mesajı .*yönləndirin \(Forward\)/.test(inviteInfo.text), "invite label + forward hint", inviteInfo.text);
ok(inviteInfo.reply_markup.inline_keyboard[0][0].url.startsWith("https://t.me/share/url?url=") && /telefonda/.test(inviteInfo.reply_markup.inline_keyboard[0][0].text), "share button (phone)");
ok(/^Səni telefon fırıldaqçılarından qorumaq istəyirəm\. .+«Razıyam».+https:\/\/t\.me\/\S+\?start=q_/.test(lastText()) && !sent("sendMessage").at(-1).body.reply_markup, "forwardable invite message", lastText());
await update(msgFrom(murad, "/start q_" + code));
ok(/özünüz yaratmısınız/.test(lastText()), "self open blocked");
await update(msgFrom(ayse, "/start q_" + code));
const consent = sent("sendMessage").at(-1).body;
ok(/Murad \(@murad\) sizi/.test(consent.text) && /GÖNDƏRİLMİR/.test(consent.text), "consent text", consent.text);
ok(consent.reply_markup.inline_keyboard[0][0].callback_data === "ga:" + code, "consent buttons");
tgMock.clear();
await update(cbUpdate(ayse, "ga:" + code));
ok(sent("answerCallbackQuery").length === 1, "accept answered");
ok(/Hazırdır! Murad artıq sizi qoruyur/.test(sent("editMessageText").at(-1)?.body?.text || ""), "accept edit");
ok(sent("sendMessage").some((c) => c.body.chat_id === murad.id && /Ayşe \(«Anam»\) razılaşdı/.test(c.body.text)), "guardian told");
const grow = await env.DB.prepare("SELECT * FROM guards WHERE protected_chat = ?1").bind(ayse.id).first();
ok(grow && grow.guardian_chat === murad.id && grow.label === "Anam", "guards row", JSON.stringify(grow));
await update(msgFrom(yad, "/start q_" + code));
ok(/köhnəlib və ya artıq istifadə olunub/.test(lastText()), "code single use");
tgMock.clear();
await update(cbUpdate(yad, "ga:" + code));
ok(/köhnəlib/.test(sent("editMessageText").at(-1)?.body?.text || ""), "used code rejected on callback");

// Çox təhlükəli mesaj → qoruyana xəbər (mətnsiz)
const scam = "Kapital Bank: Kartınız bloklanıb. Bloku açmaq üçün 30 dəqiqə ərzində telefonunuza gələn SMS kodunu təhlükəsizlik şöbəsinin əməkdaşına deyin.";
tgMock.clear();
await update(msgFrom(ayse, scam));
const verdict = sent("sendMessage").find((c) => c.body.chat_id === ayse.id)?.body?.text || "";
ok(/^🔴/.test(verdict), "scam is high", verdict.slice(0, 80));
const alert = sent("sendMessage").find((c) => c.body.chat_id === murad.id)?.body?.text || "";
ok(/🚨 Anam \(Ayşe\) indicə çox təhlükəli mesaj aldı/.test(alert), "guardian alert", alert);
ok(!/şöbəsinin|bloklanıb/.test(alert), "alert has no message text");
ok(sent("sendMessage").some((c) => c.body.chat_id === ayse.id && /Yaxınınıza \(Murad\) xəbər verdim/.test(c.body.text)), "protected told");
tgMock.clear();
await update(msgFrom(ayse, scam));
ok(!sent("sendMessage").some((c) => c.body.chat_id === murad.id), "alert throttled (60 s)");
tgMock.clear();
await update(msgFrom(murad, scam));
ok(!sent("sendMessage").some((c) => c.body.chat_id === ayse.id), "guardian's own scam does not alert protected");

// Siyahı və silmə (IDOR yoxlaması)
await update(msgFrom(ayse, "/yaxinlar"));
ok(/Sizi qoruyanlar/.test(lastText()) && /Murad/.test(lastText()), "list protected side", lastText());
await update(msgFrom(murad, "/yaxinlar"));
ok(/Sizin qoruduqlarınız/.test(lastText()) && /Anam \(Ayşe\)/.test(lastText()), "list guardian side", lastText());
tgMock.clear();
await update(cbUpdate(yad, "gd:" + murad.id));
ok(/artıq yoxdur/.test(sent("answerCallbackQuery").at(-1)?.body?.text || ""), "IDOR gd blocked");
await update(cbUpdate(yad, "gp:" + ayse.id));
ok((await countGuards()) === 1, "row intact after stranger");
await update(cbUpdate(ayse, "gd:" + murad.id, "group"));
ok((await countGuards()) === 1, "group callback ignored");
tgMock.clear();
await update(cbUpdate(ayse, "gd:" + murad.id));
ok(sent("sendMessage").some((c) => c.body.chat_id === murad.id && /qorumanı dayandırdı/.test(c.body.text)), "guardian told of removal");
ok((await countGuards()) === 0, "row removed");

// Qrup, rədd, köhnə dəvət, maksimum 5 açıq dəvət
await update({ update_id: mid++, message: { message_id: 5, from: murad, chat: { id: -100123, type: "group" }, date: 0, text: "/qoru" } });
ok(/yalnız botla şəxsi yazışmada/.test(lastText()), "group /qoru blocked");
await update(msgFrom(murad, "/qoru"));
const code2 = codeOf(lastText());
tgMock.clear();
await update(cbUpdate(ayse, "gn:" + code2));
ok(sent("sendMessage").some((c) => c.body.chat_id === murad.id && /qəbul etmədi/.test(c.body.text)), "decline notifies guardian");
ok((await countGuards()) === 0, "decline adds nothing");
await update(msgFrom(murad, "/qoru"));
const code3 = codeOf(lastText());
await env.DB.prepare("UPDATE guard_invites SET created = ?1 WHERE code = ?2").bind(Date.now() - 25 * 3600 * 1000, code3).run();
await update(msgFrom(ayse, "/start q_" + code3));
ok(/köhnəlib/.test(lastText()), "expired invite");
for (let i = 0; i < 7; i++) await update(msgFrom(murad, "/qoru"));
ok((await env.DB.prepare("SELECT COUNT(*) AS n FROM guard_invites WHERE guardian_chat = ?1").bind(murad.id).first("n")) <= 5, "max 5 open invites");
await update(msgFrom(ayse, "/start q_nonsense"));
ok(/köhnəlib/.test(lastText()), "garbage code");

// --- Nömrə yoxla
tgMock.clear();
await update(msgFrom(ali, "+995 55 000 12 34"));
ok(/🔴 Yüksək risk: fırıldaq nömrəsinə oxşayır/.test(lastText()) && /İKTA/.test(lastText()), "bot phone +995 high", lastText());
const prBtn = sent("sendMessage").at(-1).body.reply_markup?.inline_keyboard?.[0]?.[0];
ok(/^pr:[0-9a-f]{32}$/.test(prBtn?.callback_data || ""), "report button");
tgMock.clear();
await update(cbUpdate(ali, prBtn.callback_data));
ok(/qeydə alındı/.test(sent("answerCallbackQuery").at(-1)?.body?.text || ""), "report ok");
ok(sent("editMessageReplyMarkup").length === 1, "report button removed");
await update(cbUpdate(ali, prBtn.callback_data));
ok(/artıq bildirmisiniz/.test(sent("answerCallbackQuery").at(-1)?.body?.text || ""), "report dup");
await update(cbUpdate(ayse, prBtn.callback_data));
tgMock.clear();
await update(msgFrom(murad, "/nomre +995 55 000 12 34"));
ok(/🚩 2 ScamShield istifadəçisi/.test(lastText()), "report count shown", lastText());
const scamPhone = "Kapital Bank: Kartınız bloklanıb. Bloku açmaq üçün 30 dəqiqə ərzində telefonunuza gələn SMS kodunu təhlükəsizlik şöbəsinin əməkdaşına deyin, WhatsApp: +994 55 987 65 43";
tgMock.clear();
await update(msgFrom(yad, scamPhone));
ok(/^🔴/.test(sent("sendMessage").find((c) => c.body.chat_id === yad.id)?.body?.text || ""), "scam with phone is high");
tgMock.clear();
await update(msgFrom(ali, "055 987 65 43"));
ok(/🔎 Bu nömrə ScamShield-in çox təhlükəli saydığı 1 mesajda görünüb/.test(lastText()) && /🟠/.test(lastText()), "sighting counted", lastText());
await update(msgFrom(ali, "102"));
ok(/🟢 Rəsmi nömrədir/.test(lastText()) && !sent("sendMessage").at(-1).body.reply_markup, "official: no report button");
await update(msgFrom(ali, "/nomre"));
ok(/Yoxlamaq istədiyiniz nömrəni göndərin/.test(lastText()), "nomre without arg");
await update(msgFrom(ali, "/nomre salam"));
ok(/telefon nömrəsinə oxşamır/.test(lastText()), "nomre garbage");
const prow = env.DB._db.prepare("SELECT phone, reporter FROM phone_reports").all();
ok(prow.length === 3 && prow.every((r) => /^[0-9a-f]{32}$/.test(r.phone) && /^[0-9a-f]{32}$/.test(r.reporter)), "only HMAC stored", JSON.stringify(prow));

// --- Təhlükəni aşkar et (bot oyunu)
{
  const { pickRound } = await import("../src/quiz.js");
  tgMock.clear();
  await update(msgFrom(ali, "/oyun"));
  const first = sent("sendMessage").at(-1).body;
  ok(/🎯 Təhlükəni aşkar et · 1\/5/.test(first.text), "quiz starts", first.text);
  ok(first.reply_markup.inline_keyboard[0][0].text === "🚨 Təhlükəlidir", "quiz button renamed", first.reply_markup.inline_keyboard[0][0].text);
  const fBtn = first.reply_markup.inline_keyboard[0][0].callback_data;
  const seed = /^q:([0-9a-f]+):0:0:f$/.exec(fBtn)?.[1];
  ok(!!seed, "quiz button data", fBtn);
  const round = pickRound(parseInt(seed, 16));
  let score = 0;
  for (let i = 0; i < 5; i++) {
    const q = round[i];
    const right = q.scam ? "f" : "t";
    const ans = i === 1 ? (right === "f" ? "t" : "f") : right; // 2-ci sualda qəsdən səhv
    tgMock.clear();
    await update(cbUpdate(ali, `q:${seed}:${i}:${score}:${ans}`));
    const ed = sent("editMessageText").at(-1)?.body;
    ok(ed && (i === 1 ? /❌ Səhv/.test(ed.text) : /✅ Düzdür/.test(ed.text)), "quiz answer " + i, ed?.text?.slice(0, 120));
    ok(!/https?:\/\//.test(ed.text) && !/\b[a-z-]+\.(az|com|top|info|xyz)\b/.test(ed.text), "quiz links defanged " + i, ed?.text);
    if (ans === right) score++;
    const nextData = ed.reply_markup.inline_keyboard[0][0].callback_data;
    ok(nextData === `q:${seed}:${i + 1}:${score}:n`, "next button " + i, nextData);
    tgMock.clear();
    await update(cbUpdate(ali, nextData));
  }
  ok(/🏁 Nəticə: 4\/5/.test(lastText()), "quiz result 4/5", lastText());
  const kb = sent("sendMessage").at(-1).body.reply_markup.inline_keyboard;
  ok(kb[0][0].url.includes("start%3Doyun") && kb[1][0].url.includes("/oyun#cedvel") && kb[2][0].callback_data === "q:new", "result buttons", JSON.stringify(kb));
  tgMock.clear();
  await update(cbUpdate(ali, "q:new"));
  ok(/1\/5/.test(lastText()), "play again");
  await update(msgFrom(ali, "/start oyun"));
  ok(/1\/5/.test(lastText()), "start=oyun");
  tgMock.clear();
  await update(cbUpdate(ali, "q:zz:9:9:f"));
  ok(sent("answerCallbackQuery").length === 1 && !sent("editMessageText").length, "garbage quiz data ignored");
}

// --- Yoxlayıcı agentin tapdıqları (17.11)
{
  // Qısa mətndə tək nömrə → nömrə kartı
  tgMock.clear();
  await update(msgFrom(ali, "Bu nömrədən zəng gəldi: +995 55 000 12 34"));
  ok(/🔴 Yüksək risk: fırıldaq nömrəsinə oxşayır/.test(lastText()) && /📞 \+995 55 000 12 34/.test(lastText()), "short text → phone card", lastText());
  // Görünməz işarəli nömrə
  await update(msgFrom(ali, "\u202A+995 55 000 12 34\u202C"));
  ok(/🔴/.test(lastText()), "bidi marks stripped", lastText().slice(0, 60));
  // Paylaşılan kontakt (Telegram "+" olmadan göndərir)
  tgMock.clear();
  await update({ update_id: mid++, message: { message_id: 600, from: ali, chat: { id: ali.id, type: "private" }, date: 0, contact: { phone_number: "995550001234", first_name: "X" } } });
  ok(/📞 \+995 55 000 12 34/.test(lastText()), "contact → phone card", lastText());
  // Qrupda mətnsiz mesaj (stiker, qoşulma): susur
  tgMock.clear();
  await update({ update_id: mid++, message: { message_id: 601, from: ali, chat: { id: -100555, type: "group" }, date: 0, sticker: { file_id: "x" } } });
  await update({ update_id: mid++, message: { message_id: 602, from: ali, chat: { id: -100555, type: "group" }, date: 0, new_chat_members: [ali] } });
  ok(sent("sendMessage").length === 0, "group non-text is silent");
  // Redaktə olunmuş mesaj təkrar yoxlanılmır
  await update({ update_id: mid++, edited_message: { message_id: 603, from: ali, chat: { id: ali.id, type: "private" }, date: 0, text: "Kartınız bloklanıb, kodu deyin" } });
  ok(sent("sendMessage").length === 0, "edited message ignored");

  // Qoruyan botu bağlayıb: qorunana "xəbər verdim" demirik
  const nene = user(5005, "Nənə");
  await env.DB.prepare("INSERT INTO guards (protected_chat, guardian_chat, guardian_name, protected_name, label, created, last_alert) VALUES (?1, 403403, 'Blok', 'Nənə', NULL, 0, 0)").bind(nene.id).run();
  tgMock.clear();
  await update(msgFrom(nene, scam));
  ok(sent("sendMessage").some((c) => c.body.chat_id === nene.id && /xəbər göndərə bilmədim/.test(c.body.text)), "failed delivery reported honestly");
  ok(!sent("sendMessage").some((c) => c.body.chat_id === nene.id && /xəbər verdim/.test(c.body.text)), "no false 'xəbər verdim'");

  // Qorunan şəxs çox təhlükəli nömrə yoxlayır → qoruyana xəbər (nömrəsiz)
  const baba = user(6006, "Baba");
  await env.DB.prepare("INSERT INTO guards (protected_chat, guardian_chat, guardian_name, protected_name, label, created, last_alert) VALUES (?1, ?2, 'Murad', 'Baba', 'Atam', 0, 0)").bind(baba.id, murad.id).run();
  tgMock.clear();
  await update(msgFrom(baba, "+995 55 000 12 34"));
  const pAlert = sent("sendMessage").find((c) => c.body.chat_id === murad.id)?.body?.text || "";
  ok(/Atam \(Baba\) indicə çox təhlükəli telefon nömrəsini/.test(pAlert) && !/000 12 34/.test(pAlert), "phone alert to guardian without number", pAlert);
  ok(sent("sendMessage").some((c) => c.body.chat_id === baba.id && /Yaxınınıza \(Murad\) xəbər verdim/.test(c.body.text)), "protected told after phone alert");

  // Düymə message olmadan gəlir (inline rejim): oyun çökmür
  tgMock.clear();
  await update({ update_id: mid++, callback_query: { id: "inl1", from: ali, data: "q:1a2b:0:0:f" } });
  ok(sent("answerCallbackQuery").length === 1, "callback without message answered");
}

// --- Səsli mesaj (sınaq): Whisper əvəzi ilə
{
  let heard = "Salam, Kapital Bank təhlükəsizlik şöbəsindənəm. Kartınız bloklanıb, telefonunuza gələn SMS kodunu mənə deyin, təcilidir.";
  const aiCalls = [];
  const venv = { ...env, AI: { run: async (model, input) => { aiCalls.push(model); return model.includes("whisper") ? { text: heard } : { response: "" }; } } };
  const voiceUpdate = (u, extra = {}) => ({ update_id: mid++, message: { message_id: 700 + mid, from: u, chat: { id: u.id, type: "private" }, date: 0, voice: { file_id: "v1", duration: 9, mime_type: "audio/ogg", file_size: 8, ...extra } } });
  async function vupdate(u) {
    const pending = [];
    const req = new Request("https://x/tg/p", { method: "POST", headers: { "X-Telegram-Bot-Api-Secret-Token": "s3cret" }, body: JSON.stringify(u) });
    await handleTelegram(req, venv, { waitUntil: (pr) => pending.push(pr) });
    await Promise.all(pending);
  }
  const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM checks WHERE channel = 'voice'").first("n");
  tgMock.clear();
  await vupdate(voiceUpdate(ali));
  const vt = lastText();
  ok(/🎙️ Səsli mesajda eşitdiyimiz mətn/.test(vt) && /«Salam, Kapital Bank/.test(vt) && /🔴/.test(vt) && /🔒 Səs saxlanılmır/.test(vt), "voice → transcript + verdict", vt.slice(0, 200));
  ok(aiCalls[0] === "@cf/openai/whisper-large-v3-turbo", "turbo model first", aiCalls.join());
  ok(sent("fileDownload").length === 1 && sent("getFile").length === 1, "file fetched once");
  ok((await env.DB.prepare("SELECT COUNT(*) AS n FROM checks WHERE channel = 'voice'").first("n")) === before + 1, "recorded as voice channel");
  // uzun səs
  tgMock.clear();
  await vupdate(voiceUpdate(ali, { duration: 300 }));
  ok(/2 dəqiqəyə qədər/.test(lastText()) && !sent("getFile").length, "too long rejected before download");
  // anlaşılmaz səs
  heard = "Hmm.";
  tgMock.clear();
  await vupdate(voiceUpdate(ali));
  ok(/Səsi aydın eşidə bilmədim/.test(lastText()), "meaningless transcript");
  // söndürülüb
  venv.VOICE_ENABLED = "0";
  tgMock.clear();
  await vupdate(voiceUpdate(ali));
  ok(/söndürülüb/.test(lastText()) && !sent("getFile").length, "VOICE_ENABLED=0 switch");
  delete venv.VOICE_ENABLED;
  // qrupda susur
  tgMock.clear();
  await vupdate({ update_id: mid++, message: { message_id: 799, from: ali, chat: { id: -100777, type: "group" }, date: 0, voice: { file_id: "v1", duration: 5 } } });
  ok(sent("sendMessage").length === 0, "voice in group ignored");
}

// --- Salamlaşma / təşəkkür: bal yox, qısa cavab; içində rəqəm və ya link olan mesaj adi qaydada yoxlanır
{
  const before = sent("sendMessage").length;
  await update(msgFrom(ali, "Salam!"));
  ok(/^Salam! 👋/.test(lastText()) && !/\/100/.test(lastText()), "greeting reply", lastText());
  await update(msgFrom(ali, "Çox sağ ol 🙏"));
  ok(/^Dəyməz!/.test(lastText()), "thanks reply", lastText());
  ok(sent("sendMessage").length === before + 2, "one reply each");
  await update({ update_id: mid++, message: { message_id: 801, from: ali, chat: { id: -100777, type: "group" }, date: 0, text: "salam" } });
  ok(sent("sendMessage").length === before + 2, "greeting in group ignored");
  await update(msgFrom(ali, "Salam, səhvən sizə 6 rəqəmli kod göndərdim, zəhmət olmasa onu mənə yazın, təcilidir."));
  ok(!/^Salam! 👋/.test(lastText()), "scam starting with salam still checked", lastText());
}

// @@SON@@ (yeni bölmələr bundan əvvələ əlavə olunur)
tgMock.restore();
console.log(`bot-test: ${passes} keçdi, ${fails} xəta`);
process.exit(fails ? 1 : 0);
