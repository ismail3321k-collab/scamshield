// "Yaxınını qoru": razılıq əsasında ailə xəbərdarlığı (yalnız botla şəxsi yazışmada).
// Qoruyan (məs. övlad) /qoru ilə bir dəfəlik dəvət linki yaradır; qorunan (məs. ana) linki açıb «Razıyam» basır.
// Qorunan şəxs çox təhlükəli mesaj yoxlayanda qoruyana QISA xəbər gedir. Mesajın mətni HEÇ VAXT getmir.
// Hər iki tərəf /yaxinlar ilə istədiyi vaxt əlaqəni silə bilər. Bütün əməliyyatlarda WHERE-də düyməni basanın öz ID-si var.
import { tg, botUsername, displayName } from "./tgapi.js";
import { publicLabel } from "./today.js";

const INVITE_TTL = 24 * 3600 * 1000;
const MAX_OPEN_INVITES = 5;
const MAX_GUARDIANS = 5;
const ALERT_GAP = 60 * 1000;

function newCode() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function cleanLabel(s) {
  return String(s || "").replace(/[\u0000-\u001f<>@/\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 24) || null;
}

const send = (env, chatId, text, extra = {}) =>
  tg(env, "sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true }, ...extra });
const answer = (env, cb, text) => tg(env, "answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) });
const edit = (env, cb, text) =>
  tg(env, "editMessageText", { chat_id: cb.message.chat.id, message_id: cb.message.message_id, text, link_preview_options: { is_disabled: true } });

async function getInvite(env, code) {
  if (!/^[A-Za-z0-9_-]{16}$/.test(code || "")) return null;
  const inv = await env.DB.prepare("SELECT * FROM guard_invites WHERE code = ?1").bind(code).first();
  if (!inv || Date.now() - inv.created > INVITE_TTL) return null;
  return inv;
}

// Dəveti atomik götürür: iki nəfər eyni linki eyni anda aça bilməz
async function claimInvite(env, code) {
  const inv = await env.DB.prepare("DELETE FROM guard_invites WHERE code = ?1 RETURNING *").bind(code).first();
  if (!inv || Date.now() - inv.created > INVITE_TTL) return null;
  return inv;
}

export async function createInvite(env, msg, arg) {
  const chatId = msg.chat.id;
  const now = Date.now();
  await env.DB.prepare("DELETE FROM guard_invites WHERE created < ?1").bind(now - INVITE_TTL).run();
  const open = await env.DB.prepare("SELECT COUNT(*) AS n FROM guard_invites WHERE guardian_chat = ?1").bind(chatId).first();
  if ((open?.n || 0) >= MAX_OPEN_INVITES) {
    await env.DB.prepare("DELETE FROM guard_invites WHERE code IN (SELECT code FROM guard_invites WHERE guardian_chat = ?1 ORDER BY created ASC LIMIT 1)").bind(chatId).run();
  }
  const code = newCode();
  const label = cleanLabel(arg);
  await env.DB.prepare("INSERT INTO guard_invites (code, guardian_chat, guardian_name, guardian_user, label, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
    .bind(code, chatId, displayName(msg.from), msg.from?.username || null, label, now).run();
  const bot = (await botUsername(env)) || "scamshield_az_bot";
  const link = `https://t.me/${bot}?start=q_${code}`;
  const shareText = "Səni telefon fırıldaqçılarından qorumaq istəyirəm. Bu linki aç və «Razıyam» düyməsinə bas:";
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
  const text = [
    "👨‍👩‍👧 Yaxınınızı fırıldaqdan qoruyun",
    "",
    "1. 👇 Növbəti mesajı qorumaq istədiyiniz adama (ana, ata, nənə) yönləndirin (Forward) və ya içindəki linki kopyalayıb göndərin.",
    "2. O, linki açıb «Razıyam» düyməsini bassın.",
    "3. Hazırdır: o, mənə çox təhlükəli mesaj göndərəndə sizə dərhal xəbər verəcəyəm ki, ona zəng edəsiniz.",
    "",
    "🔒 Onun mesajlarının mətnini sizə göstərmirəm, yalnız «təhlükə var» xəbəri gedir. O, istədiyi vaxt bunu dayandıra bilər.",
    "Link bir dəfəlikdir və 24 saat keçərlidir.",
    "",
    label ? `Xəbərdarlıqlarda onu belə adlandıracağam: «${label}».` : "Məsləhət: ona ad verə bilərsiniz, məsələn: /qoru Anam",
    "",
    "Aşağıdakı düymə telefonda işləyir; kompüterdə növbəti mesajı yönləndirin.",
  ].join("\n");
  await send(env, chatId, text, { reply_markup: { inline_keyboard: [[{ text: "📤 Linki yaxınıma göndər (telefonda)", url: share }]] } });
  // Hər yerdə işləyən yol: olduğu kimi yönləndirilə bilən qısa mesaj
  await send(env, chatId, `${shareText} ${link}`);
  return code;
}

export async function openInvite(env, msg, code) {
  const chatId = msg.chat.id;
  const inv = await getInvite(env, code);
  if (!inv) return send(env, chatId, "Bu dəvət linki köhnəlib və ya artıq istifadə olunub. Yaxınınızdan yeni link istəyin (o, botda /qoru yazmalıdır).");
  if (inv.guardian_chat === chatId) return send(env, chatId, "Bu linki özünüz yaratmısınız 🙂 Onu qorumaq istədiyiniz adama göndərin.");
  const who = inv.guardian_name + (inv.guardian_user ? ` (@${inv.guardian_user})` : "");
  const text = [
    `👨‍👩‍👧 ${who} sizi telefon fırıldaqçılarından qorumaq istəyir.`,
    "",
    "Razı olsanız:",
    `• Siz mənə şübhəli mesaj göndərəndə və o, çox təhlükəli çıxanda, ${inv.guardian_name} qısa xəbər alacaq ki, sizə zəng etsin.`,
    "• Mesajınızın mətni ona GÖNDƏRİLMİR.",
    "• İstədiyiniz vaxt /yaxinlar yazıb dayandıra bilərsiniz.",
    "",
    "Bu adamı tanımırsınızsa, «İstəmirəm» düyməsini basın.",
  ].join("\n");
  return send(env, chatId, text, {
    reply_markup: { inline_keyboard: [[{ text: "✅ Razıyam", callback_data: "ga:" + code }, { text: "❌ İstəmirəm", callback_data: "gn:" + code }]] },
  });
}

async function acceptInvite(env, cb, code) {
  const me = cb.message.chat.id;
  const inv = await getInvite(env, code);
  if (!inv) {
    await answer(env, cb, "Linkin vaxtı keçib.");
    return edit(env, cb, "Bu dəvət linki köhnəlib və ya artıq istifadə olunub. Yaxınınızdan yeni link istəyin.");
  }
  if (inv.guardian_chat === me) return answer(env, cb, "Özünüzü qoruya bilməzsiniz 🙂 Linki yaxınınıza göndərin.");
  const exists = await env.DB.prepare("SELECT 1 AS x FROM guards WHERE protected_chat = ?1 AND guardian_chat = ?2").bind(me, inv.guardian_chat).first();
  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM guards WHERE protected_chat = ?1").bind(me).first();
  if (!exists && (cnt?.n || 0) >= MAX_GUARDIANS) {
    await answer(env, cb, "Ən çox 5 yaxın qoşula bilər.");
    return edit(env, cb, "Sizi artıq 5 yaxın qoruyur, bu, maksimumdur. Birini çıxarmaq üçün: /yaxinlar");
  }
  const claimed = await claimInvite(env, code);
  if (!claimed) {
    await answer(env, cb, "Link artıq istifadə olunub.");
    return edit(env, cb, "Bu dəvət linki artıq istifadə olunub. Yaxınınızdan yeni link istəyin.");
  }
  const myName = displayName(cb.from);
  await env.DB.prepare(
    `INSERT INTO guards (protected_chat, guardian_chat, guardian_name, protected_name, label, created, last_alert)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)
     ON CONFLICT(protected_chat, guardian_chat) DO UPDATE SET guardian_name = ?3, protected_name = ?4, label = ?5`
  ).bind(me, claimed.guardian_chat, claimed.guardian_name, myName, claimed.label, Date.now()).run();
  await answer(env, cb, "Hazırdır!");
  await edit(env, cb, [
    `✅ Hazırdır! ${claimed.guardian_name} artıq sizi qoruyur.`,
    "",
    `Şübhəli SMS, WhatsApp mesajı və ya link gələndə onu mənə göndərin. Çox təhlükəli olsa, ${claimed.guardian_name} xəbər alacaq ki, sizə zəng etsin.`,
    "",
    "Dayandırmaq üçün: /yaxinlar",
  ].join("\n"));
  await send(env, claimed.guardian_chat, [
    `✅ ${myName}${claimed.label ? ` («${claimed.label}»)` : ""} razılaşdı.`,
    "İndi ona çox təhlükəli mesaj gəlib mənə göndərəndə sizə dərhal xəbər verəcəyəm.",
    "",
    "Siyahı: /yaxinlar",
  ].join("\n"));
}

async function declineInvite(env, cb, code) {
  const inv = await claimInvite(env, code);
  await answer(env, cb);
  await edit(env, cb, "Yaxşı, qoşulmadınız. Sizin mesajlarınız barədə heç kimə xəbər getmir.");
  if (inv) await send(env, inv.guardian_chat, `ℹ️ ${displayName(cb.from)} dəvətinizi qəbul etmədi.`);
}

export async function listGuards(env, msg) {
  const me = msg.chat.id;
  const [mine, theirs] = await Promise.all([
    env.DB.prepare("SELECT guardian_chat, guardian_name FROM guards WHERE protected_chat = ?1 ORDER BY created").bind(me).all(),
    env.DB.prepare("SELECT protected_chat, protected_name, label FROM guards WHERE guardian_chat = ?1 ORDER BY created").bind(me).all(),
  ]);
  const a = mine.results || [], b = theirs.results || [];
  if (!a.length && !b.length) {
    return send(env, me, "Hələ heç kimlə qoşulmamısınız.\n\nYaxınınızı qorumaq üçün /qoru yazın: sizə dəvət linki verəcəyəm.");
  }
  const lines = [], kb = [];
  if (a.length) {
    lines.push("🛡️ Sizi qoruyanlar (çox təhlükəli mesajda onlara xəbər gedir):");
    for (const g of a) {
      lines.push(`• ${g.guardian_name}`);
      kb.push([{ text: `❌ ${g.guardian_name}: dayandır`, callback_data: `gd:${g.guardian_chat}` }]);
    }
    lines.push("");
  }
  if (b.length) {
    lines.push("👨‍👩‍👧 Sizin qoruduqlarınız:");
    for (const p of b) {
      const n = p.label ? `${p.label} (${p.protected_name})` : p.protected_name;
      lines.push(`• ${n}`);
      kb.push([{ text: `❌ ${n}: qorumanı dayandır`, callback_data: `gp:${p.protected_chat}` }]);
    }
    lines.push("");
  }
  lines.push("Yeni yaxın əlavə etmək üçün: /qoru");
  return send(env, me, lines.join("\n"), { reply_markup: { inline_keyboard: kb.slice(0, 10) } });
}

// Qorunan şəxs qoruyanı çıxarır (gd) və ya qoruyan qorunanı çıxarır (gp). WHERE-də həmişə düyməni basanın ID-si var.
async function removeLink(env, cb, op, other) {
  const me = cb.message.chat.id;
  const sql = op === "gd"
    ? "DELETE FROM guards WHERE protected_chat = ?1 AND guardian_chat = ?2 RETURNING guardian_chat, guardian_name, protected_chat, protected_name, label"
    : "DELETE FROM guards WHERE guardian_chat = ?1 AND protected_chat = ?2 RETURNING guardian_chat, guardian_name, protected_chat, protected_name, label";
  const row = await env.DB.prepare(sql).bind(me, other).first();
  if (!row) return answer(env, cb, "Bu əlaqə artıq yoxdur.");
  await answer(env, cb, "Dayandırıldı.");
  if (op === "gd") {
    await edit(env, cb, `✅ ${row.guardian_name} artıq sizin barənizdə xəbərdarlıq almayacaq.\n\nSiyahı: /yaxinlar`);
    await send(env, row.guardian_chat, `ℹ️ ${row.protected_name} qorumanı dayandırdı. Ona gələn təhlükəli mesajlar barədə artıq xəbər almayacaqsınız.`);
  } else {
    const n = row.label ? `${row.label} (${row.protected_name})` : row.protected_name;
    await edit(env, cb, `✅ ${n} üçün qoruma dayandırıldı.\n\nSiyahı: /yaxinlar`);
    await send(env, row.protected_chat, `ℹ️ ${row.guardian_name} artıq sizə gələn təhlükəli mesajlar barədə xəbər almayacaq.`);
  }
}

// Düymələr: ga/gn (dəvəti qəbul/rədd), gd/gp (əlaqəni sil). İşlənibsə true qaytarır.
export async function guardCallback(env, cb) {
  const m = /^(ga|gn|gd|gp):([A-Za-z0-9_-]{1,32})$/.exec(cb.data || "");
  if (!m) return false;
  if (cb.message?.chat?.type !== "private") { await answer(env, cb, "Bu yalnız botla şəxsi yazışmada işləyir."); return true; }
  const [, op, val] = m;
  if (op === "ga") await acceptInvite(env, cb, val);
  else if (op === "gn") await declineInvite(env, cb, val);
  else if (/^-?\d{1,16}$/.test(val)) await removeLink(env, cb, op, Number(val));
  else await answer(env, cb);
  return true;
}

// Qorunan şəxs çox təhlükəli mesaj və ya nömrə yoxlayanda: qoruyanlara qısa xəbər (mətn / nömrə yoxdur), dəqiqədə ən çox bir dəfə.
// Nəticə: { delivered: [adlar], failed: [adlar] } — qorunan şəxsə yalnız həqiqətən çatanları deyirik.
export async function notifyGuardians(env, msg, r, opts = {}) {
  const me = msg.chat.id;
  const now = Date.now();
  const rows = (await env.DB.prepare("SELECT guardian_chat, guardian_name, label, last_alert FROM guards WHERE protected_chat = ?1").bind(me).all()).results || [];
  const due = rows.filter((g) => now - (g.last_alert || 0) >= ALERT_GAP);
  const out = { delivered: [], failed: [] };
  if (!due.length) return out;
  const name = displayName(msg.from);
  const what = r?.campaign ? publicLabel({ label: r.campaign.label, brand: r.brand, domain: r.campaign.domain }) : null;
  const sentTo = [];
  for (const g of due) {
    const who = g.label ? `${g.label} (${name})` : name;
    const text = opts.phone
      ? [
        `🚨 ${who} indicə çox təhlükəli telefon nömrəsini ScamShield-də yoxladı (məsələn, Azərbaycan nömrəsinə oxşadılmış xarici nömrə).`,
        "",
        "Ona indi zəng edin və xatırladın:",
        "• o nömrəyə cavab verməsin və geri zəng etməsin,",
        "• SMS kodunu və kart məlumatını heç kimə deməsin,",
        "• heç kimə pul köçürməsin.",
        "",
        "🔒 Nömrənin özünü sizə göstərmirəm.",
      ]
      : [
        `🚨 ${who} indicə çox təhlükəli mesaj aldı və onu ScamShield-də yoxladı.`,
        `Qiymət: ${r.score}/100${what ? ` · ${what}` : ""}.`,
        "",
        "Ona indi zəng edin və xatırladın:",
        "• linkə basmasın,",
        "• kart məlumatını və SMS kodunu heç kimə verməsin,",
        "• heç kimə pul köçürməsin.",
        "",
        "🔒 Mesajın mətnini sizə göstərmirəm: bu, onun şəxsi məlumatıdır.",
      ];
    const res = await send(env, g.guardian_chat, text.join("\n")).catch(() => null);
    if (res?.ok) { out.delivered.push(g.guardian_name); sentTo.push(g.guardian_chat); } else out.failed.push(g.guardian_name);
  }
  if (sentTo.length) {
    await env.DB.prepare(`UPDATE guards SET last_alert = ?1 WHERE protected_chat = ?2 AND guardian_chat IN (${sentTo.map((_, i) => "?" + (i + 3)).join(",")})`)
      .bind(now, me, ...sentTo).run();
  }
  return out;
}
