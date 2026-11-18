// Telegram botu: webhook → əmrlər / analiz → düz mətn cavab.
import { analyze } from "./analyze.js";
import { recordCheck, intelLookup } from "./store.js";
import { checkLinks } from "./linkcheck.js";
import { screenshot } from "./shot.js";
import { tg, defang } from "./tgapi.js";
import { todayData, todayText } from "./today.js";
import { createInvite, openInvite, listGuards, guardCallback, notifyGuardians } from "./guard.js";
import { startQuiz, quizCallback } from "./quiz.js";
import { voiceEnabled, transcribe, meaningful, downloadTelegramFile, MAX_SECONDS, MAX_BYTES } from "./voice.js";
import { parsePhone, phoneOnly, shortTextPhone, phoneVerdict, phoneText, phoneKey, phoneCounts, addUserReport, recordPhoneSightings } from "./phone.js";

const ICON = { high: "🔴", suspicious: "🟠", safe: "🟢" };

export function formatReply(r) {
  const lines = [`${ICON[r.band]} ${r.score}/100 — ${r.bandLabel}`, ""];
  if (r.reasons.length) lines.push("Niyə belə düşünürük?");
  r.reasons.forEach((x, i) => lines.push(`${i + 1}. ${defang(x.text)}`));
  // VirusTotal məlumat sətri (0 nəticə "təhlükəsiz" demək deyil)
  for (const u of r.urls || []) for (const f of u.findings || []) if (f.code === "vt_info") lines.push(`🔎 ${defang(f.text)}`);
  if (r.reasons.length) lines.push("");
  lines.push("İndi nə etməli?", r.advice, "");
  lines.push("Kimə zəng etməli?");
  for (const h of r.hotlines) lines.push(`${h.num ? "📞" : "💳"} ${h.label}: ${h.desc}`);
  // Dövlətin qara siyahısını yeni saytlarla qidalandırırıq (Blacklist.gov.az); artıq siyahıda olan sayt üçün demirik
  if (r.band !== "safe" && (r.urls || []).some((u) => !u.official && !u.messenger && !u.blacklisted)) {
    lines.push("", "🚫 Saytı dövlətin qara siyahısına bildirin: blacklist.gov.az/report («Fişinq» seçin)");
  }
  if (r.masked.total) lines.push("", `🔒 ${r.masked.total} şəxsi məlumat (kart, telefon, kod) yoxlamadan əvvəl gizlədildi.`);
  return lines.join("\n");
}

export const WELCOME = [
  "Salam! Mən ScamShield-əm 👋",
  "",
  "Şübhəli SMS-i, WhatsApp mesajını, linki və ya telefon nömrəsini bura göndərin (və ya yönləndirin). Bir neçə saniyədə yoxlayıb deyəcəyəm: fırıldaqdırmı, hansı tələ var və nə etməlisiniz.",
  "",
  "Başqa nə edə bilərəm:",
  "👨‍👩‍👧 /qoru — yaxınınızı (ana, ata) qoruyun: ona fırıldaq mesajı gələndə sizə xəbər verim",
  "📢 /bugun — bu gün yayılan tələlər",
  "📞 /nomre — telefon nömrəsini yoxlayın",
  "🎯 /oyun — «Təhlükəni aşkar et» oyunu: özünüzü sınayın",
  "",
  "🔒 Mesaj mətni saxlanılmır; kart və telefon nömrələri yoxlamadan əvvəl gizlədilir.",
].join("\n");

// Əmrlər menyusu (Telegram yalnız kiçik latın hərfləri qəbul edir)
export const COMMANDS = [
  { command: "bugun", description: "Bu gün yayılan tələlər" },
  { command: "qoru", description: "Yaxınını qoru (ana, ata)" },
  { command: "yaxinlar", description: "Qoşulmuş yaxınlar" },
  { command: "nomre", description: "Telefon nömrəsini yoxla" },
  { command: "oyun", description: "Təhlükəni aşkar et oyunu" },
  { command: "komek", description: "Bot nə edə bilir" },
];

const FOLD = { "ə": "e", "ö": "o", "ü": "u", "ğ": "g", "ı": "i", "ş": "s", "ç": "c" };

// "/Bugün@scamshield_az_bot arg" → { name: "bugun", arg: "arg" }
export function parseCommand(text) {
  const m = /^\/([\p{L}\d_]+)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/u.exec(text || "");
  if (!m) return null;
  const name = m[1].toLowerCase().replace(/̇/g, "").replace(/[əöüğışç]/g, (c) => FOLD[c]);
  return { name, arg: (m[2] || "").trim() };
}

function send(env, chatId, text, extra = {}) {
  return tg(env, "sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true }, ...extra });
}

async function sendToday(env, chatId) {
  let d = { total: 0, high: 0, items: [] };
  try { d = await todayData(env); } catch (e) { console.error("today", e); }
  await send(env, chatId, todayText(d));
}

const PRIVATE_ONLY = "Bu funksiya yalnız botla şəxsi yazışmada işləyir. Botu açın: /start";

// Bütün mesaj yalnız salamlaşma və ya təşəkkürdürsə: bal vermirik, nə göndərmək lazım olduğunu deyirik
const HELLO_WORDS = new Set(["salam", "salamlar", "slm", "selam", "merhaba", "aleykum", "əleykum", "hello", "hi", "hey", "привет", "здравствуйте", "necəsən", "necesen", "necəsiz", "necesiz"]);
const THANKS_WORDS = new Set(["sağ", "sag", "ol", "olun", "çox", "cox", "təşəkkür", "təşəkkürlər", "tesekkur", "tesekkurler", "thanks", "thank", "you", "спасибо"]);
function smallTalk(text) {
  if (text.length > 40 || /[0-9@/:]/.test(text)) return null;
  const words = text.toLowerCase().replace(/[^\p{L}]+/gu, " ").trim().split(" ").filter(Boolean);
  if (!words.length || words.length > 4 || !words.every((w) => HELLO_WORDS.has(w) || THANKS_WORDS.has(w))) return null;
  return words.some((w) => HELLO_WORDS.has(w)) ? "hello" : "thanks";
}
const HELLO_REPLY = "Salam! 👋 Şübhəli SMS, WhatsApp mesajı, link, telefon nömrəsi və ya səsli mesajı mənə göndərin, bir neçə saniyəyə yoxlayım.\n\nBot nə edə bilir: /komek";
const THANKS_REPLY = "Dəyməz! 🙂 Yeni şübhəli mesaj gəlsə, mənə göndərin.";

// Nömrə yoxla: ölkə kodu, +995 hiyləsi, rəsmi nömrələr, istifadəçi bildirişləri
async function phoneReply(env, msg, input) {
  const chatId = msg.chat.id;
  const p = typeof input === "string" ? parsePhone(input) : input;
  if (!p || p.kind === "unknown") return send(env, chatId, "Bu, telefon nömrəsinə oxşamır. Belə göndərin: /nomre +994 55 123 45 67");
  const key = await phoneKey(env, p);
  const counts = key ? await phoneCounts(env, key).catch(() => ({ user: 0, message: 0 })) : { user: 0, message: 0 };
  const v = phoneVerdict(p, counts);
  const extra = { reply_to_message_id: msg.message_id };
  if (v.reportable && key) extra.reply_markup = { inline_keyboard: [[{ text: "🚩 Bu nömrə mənə fırıldaq üçün zəng edib / yazıb", callback_data: "pr:" + key }]] };
  await send(env, chatId, phoneText(v), extra);
  // Yaxınını qoru: qorunan şəxs çox təhlükəli nömrə yoxlayanda da xəbər (nömrənin özü getmir)
  if (v.band === "high" && msg.chat.type === "private") await tellProtected(env, chatId, await notifyGuardians(env, msg, null, { phone: true }).catch(() => null));
}

async function tellProtected(env, chatId, res) {
  if (!res) return;
  if (res.delivered.length) {
    await send(env, chatId, `👨‍👩‍👧 ${res.delivered.length > 1 ? "Yaxınlarınıza" : "Yaxınınıza"} (${res.delivered.join(", ")}) xəbər verdim ki, sizə zəng etsin. Mesajınızın mətnini onlara göstərmədim.`);
  } else if (res.failed.length) {
    await send(env, chatId, "⚠️ Yaxınınıza xəbər göndərə bilmədim (o, botu bağlayıb). Ona özünüz zəng edin.");
  }
}

async function phoneCallback(env, cb) {
  const m = /^pr:([0-9a-f]{32})$/.exec(cb.data || "");
  if (!m) return false;
  const res = await addUserReport(env, m[1], "tg:" + cb.from.id);
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: res === "dup" ? "Siz bu nömrəni artıq bildirmisiniz." : "Təşəkkürlər! Bildirişiniz qeydə alındı." });
  if (cb.message) await tg(env, "editMessageReplyMarkup", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } });
  return true;
}

async function startCmd(env, msg, arg) {
  const chatId = msg.chat.id;
  const priv = msg.chat.type === "private";
  if (arg === "bugun") return sendToday(env, chatId);
  if (arg === "oyun") return startQuiz(env, chatId);
  if (arg === "qoru") return priv ? createInvite(env, msg, "") : send(env, chatId, PRIVATE_ONLY);
  if (arg.startsWith("q_")) return priv ? openInvite(env, msg, arg.slice(2)) : send(env, chatId, PRIVATE_ONLY);
  return send(env, chatId, WELCOME);
}

async function checkMessage(env, ctx, msg, text, opts = {}) {
  const chatId = msg.chat.id;
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const r = await analyze(text, { env, intelLookup: (hosts) => intelLookup(env, hosts), linkCheck: (u) => checkLinks(u, env) });
  const shown = text.length > 900 ? text.slice(0, 900) + "…" : text;
  const body = opts.voice
    ? `🎙️ Səsli mesajda eşitdiyimiz mətn (səs tanıma səhv edə bilər):\n«${defang(shown)}»\n\n${formatReply(r)}\n\n🔒 Səs saxlanılmır, yalnız mətnə çevrilir.`
    : formatReply(r);
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: body.slice(0, 4000),
    reply_to_message_id: msg.message_id,
    link_preview_options: { is_disabled: true },
  });
  // Çox təhlükəli mesajdakı nömrələr: yalnız HMAC şəklində "mesajda göründü" sayılır
  if (r.band === "high") await recordPhoneSightings(env, text, "tg:" + chatId).catch((e) => console.error("phone", e));
  // Yaxınını qoru: çox təhlükəli nəticədə qoruyanlara qısa xəbər (mətn getmir)
  if (r.band === "high" && msg.chat.type === "private") {
    await tellProtected(env, chatId, await notifyGuardians(env, msg, r).catch((e) => { console.error("guard", e); return null; }));
  }
  await recordCheck(env, opts.channel || "telegram", r);
  // Linki istifadəçinin yerinə biz açıb ekran şəklini göndəririk
  const link = (r.urls || []).find((u) => !u.official && !u.messenger);
  if (link) {
    // domen qeydiyyatda yoxdursa sayt açılmır: brauzeri boşuna gözlətmirik
    const shot = link.registry === "missing" ? { ok: false, reason: "site_down" } : (await tg(env, "sendChatAction", { chat_id: chatId, action: "upload_photo" }), await screenshot(env, link.raw, ctx));
    if (shot.ok) {
      let finalHost = link.host;
      try { finalHost = new URL(shot.finalUrl).hostname; } catch { /* yok */ }
      const cap = [
        "📷 Bu linki sizin yerinizə biz açdıq. Sayt belə görünür:",
        `Link əslində bura aparır: ${defang(finalHost)}`,
        shot.title ? `Səhifənin adı: ${shot.title}` : null,
        r.band === "safe" ? null : "⚠️ Bu sayta özünüz daxil olmayın və heç nə yazmayın.",
      ].filter(Boolean).join("\n");
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("caption", cap.slice(0, 1000));
      form.append("reply_to_message_id", String(msg.message_id));
      form.append("photo", new Blob([shot.image], { type: "image/jpeg" }), "sayt.jpg");
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendPhoto`, { method: "POST", body: form });
    } else if (shot.reason === "site_down" || shot.reason === "timeout") {
      await send(env, chatId, "📷 Linki sizin yerinizə açmağa çalışdıq: sayt artıq açılmır (bağlanıb). Fırıldaq saytları belə tez-tez bağlanır.", { reply_to_message_id: msg.message_id });
    }
  }
  return r;
}

// Səsli mesaj (sınaq): Whisper ilə mətnə, sonra adi yoxlama. Səs və mətn saxlanılmır.
async function voiceReply(env, ctx, msg, audio) {
  const chatId = msg.chat.id;
  const reply = { reply_to_message_id: msg.message_id };
  if ((audio.duration || 0) > MAX_SECONDS || (audio.file_size || 0) > MAX_BYTES) {
    return send(env, chatId, "Səsli mesaj çox uzundur. Zəhmət olmasa 2 dəqiqəyə qədər olan səs göndərin və ya mətni yazın.", reply);
  }
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" });
  const bytes = await downloadTelegramFile(env, audio.file_id).catch(() => null);
  if (!bytes) return send(env, chatId, "Səs faylını yükləmək alınmadı. Yenidən göndərin və ya mətni yazın.", reply);
  const { text } = await transcribe(env, bytes);
  if (!meaningful(text)) return send(env, chatId, "Səsi aydın eşidə bilmədim. Zəhmət olmasa mətni yazıb göndərin.", reply);
  return checkMessage(env, ctx, msg, text.slice(0, 2000), { channel: "voice", voice: true });
}

async function handleMessage(env, ctx, msg) {
  const chatId = msg.chat.id;
  const audio = msg.voice || msg.audio;
  if (audio) {
    if (msg.chat.type !== "private") return;
    if (!voiceEnabled(env)) return send(env, chatId, "Səsli mesaj yoxlaması hazırda söndürülüb. Mətni yazıb göndərin, yoxlayım.");
    return voiceReply(env, ctx, msg, audio);
  }
  const text = (msg.text || msg.caption || "").trim();
  if (!text) {
    // Paylaşılan kontakt: Telegram nömrəni "+" olmadan göndərir
    if (msg.contact?.phone_number) {
      const n = String(msg.contact.phone_number).trim();
      return phoneReply(env, msg, n.startsWith("+") ? n : "+" + n);
    }
    // Qrupda (qoşulma, stiker və s.) susuruq; şəxsi yazışmada yalnız şəkil / fayl üçün izah
    if (msg.chat.type !== "private" || !(msg.photo || msg.document)) return;
    return send(env, chatId, "Şəkildəki mətni kopyalayıb mesaj kimi göndərin, yoxlayım. Skrinşotu saytda da yoxlaya bilərsiniz: «Şəkil yüklə» düyməsi (scamshield-az.pages.dev). Şəkil sizin cihazınızdan çıxmır, mətn brauzerdə oxunur.");
  }
  const cmd = parseCommand(text);
  if (cmd) {
    switch (cmd.name) {
      case "start": return startCmd(env, msg, cmd.arg);
      case "help": case "komek": return send(env, chatId, WELCOME);
      case "bugun": return sendToday(env, chatId);
      case "qoru": return msg.chat.type === "private" ? createInvite(env, msg, cmd.arg) : send(env, chatId, PRIVATE_ONLY);
      case "yaxinlar": return msg.chat.type === "private" ? listGuards(env, msg) : send(env, chatId, PRIVATE_ONLY);
      case "oyun": return startQuiz(env, chatId);
      case "nomre": return cmd.arg ? phoneReply(env, msg, cmd.arg) : send(env, chatId, "Yoxlamaq istədiyiniz nömrəni göndərin, məsələn: +994 55 123 45 67 və ya /nomre +995 55 000 12 34");
      default: return send(env, chatId, "Bu əmri tanımıram. Bot nə edə bilir: /komek");
    }
  }
  const talk = smallTalk(text);
  if (talk) return msg.chat.type === "private" ? send(env, chatId, talk === "hello" ? HELLO_REPLY : THANKS_REPLY) : undefined;
  const ph = phoneOnly(text) || shortTextPhone(text);
  if (ph) return phoneReply(env, msg, ph);
  return checkMessage(env, ctx, msg, text);
}

async function handleCallback(env, cb) {
  if (await guardCallback(env, cb)) return;
  if (await phoneCallback(env, cb)) return;
  if (await quizCallback(env, cb)) return;
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
}

export async function handleTelegram(request, env, ctx) {
  if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  let update;
  try { update = await request.json(); } catch { return new Response("ok"); }
  if (update.callback_query) {
    ctx.waitUntil(handleCallback(env, update.callback_query).catch((e) => console.error("tg cb", e?.stack || e)));
    return new Response("ok");
  }
  // Redaktə olunmuş mesajları təkrar yoxlamırıq (say və xəbərdarlıq ikiqat olmasın)
  const msg = update.message;
  if (!msg?.chat) return new Response("ok");
  ctx.waitUntil(handleMessage(env, ctx, msg).catch((e) => console.error("tg", e?.stack || e)));
  return new Response("ok");
}

export async function setupWebhook(env, origin) {
  const res = await tg(env, "setWebhook", {
    url: `${origin}/tg/${env.TG_PATH}`,
    secret_token: env.TELEGRAM_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const commands = await (await tg(env, "setMyCommands", { commands: COMMANDS })).json().catch(() => null);
  await tg(env, "setMyShortDescription", { short_description: "Şübhəli mesajı, linki və ya nömrəni yoxlayıram. Yaxınlarınızı fırıldaqdan qoruyuram." });
  // Botun görünən adı və açılış təsviri (istifadəçi adı @scamshield_az_bot dəyişmir)
  const named = await (await tg(env, "setMyName", { name: "ScamShield" })).json().catch(() => null);
  await tg(env, "setMyDescription", {
    description: "Şübhəli SMS, link, telefon nömrəsi və ya səsli mesajı göndərin: ScamShield bir neçə saniyədə fırıldaq olub-olmadığını Azərbaycan dilində izah edir. Yaxınlarınızı da fırıldaqdan qoruyur.",
  });
  const me = await (await tg(env, "getMe", {})).json();
  return { webhook: await res.json(), commands: commands?.ok ?? null, name: named?.ok ?? null, bot: me?.result?.username || null, display: me?.result?.first_name || null };
}
