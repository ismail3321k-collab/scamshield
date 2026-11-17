// "Təhlükəni aşkar et" oyunu (bot; əvvəlki adı «Fırıldağı tap»). Vəziyyət saxlanılmır: hər şey düymə məlumatındadır q:<toxum>:<sual>:<bal>:<f|t|n>.
// Suallar sayt ilə eynidir (data/quiz.json, cavablar yalnız serverdə). Hər oyunda 3 fırıldaq + 2 təhlükəsiz mesaj.
import quiz from "../data/quiz.json" with { type: "json" };
import { tg, botUsername } from "./tgapi.js";

const SCAM = quiz.items.filter((q) => q.scam);
const SAFE = quiz.items.filter((q) => !q.scam);
export const ROUND = 5;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, r) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function pickRound(seed) {
  const r = rng(seed);
  return shuffle([...shuffle(SCAM, r).slice(0, 3), ...shuffle(SAFE, r).slice(0, 2)], r);
}

// Telegram linkləri basılan etməsin deyə yalnız domenləri [.] edirik (12.40 AZN kimi rəqəmlərə toxunmur)
export function defangLinks(s) {
  return String(s || "").replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, (m) => m.replace(/\./g, "[.]"));
}

const head = (q, i) => [`🎯 Təhlükəni aşkar et · ${i + 1}/${ROUND}`, "", `📱 ${q.channel} · ${q.from}`, `«${defangLinks(q.text)}»`, ""];

function questionText(q, i) {
  return [...head(q, i), "Bu mesaj təhlükəlidir, yoxsa təhlükəsiz?"].join("\n");
}

function answerText(q, i, correct) {
  return [
    ...head(q, i),
    correct ? "✅ Düzdür!" : "❌ Səhv.",
    q.scam ? "Bu mesaj FIRILDAQDIR." : "Bu mesaj təhlükəsizdir.",
    "",
    q.scam ? "Tələ əlamətləri:" : "Niyə təhlükəsizdir:",
    ...q.why.map((w) => "• " + defangLinks(w)),
    "",
    `💡 ${defangLinks(q.lesson)}`,
  ].join("\n");
}

function resultText(score, gameLink) {
  const msg = score === ROUND
    ? "Əla! Fırıldaqçılar sizi aldada bilməz. 🛡️"
    : score === ROUND - 1
      ? "Yaxşıdır, amma bir tələ sizi aldada bilərdi. Şübhəli mesajı həmişə əvvəl mənə göndərin."
      : "Diqqət: fırıldaqçılar çox inandırıcı yazır. Şübhəli mesajı həmişə əvvəl mənə göndərin.";
  return [
    `🏁 Nəticə: ${score}/${ROUND}`,
    "",
    msg,
    "",
    "Ən vacib 3 qayda:",
    "1. SMS kodunu heç kimə deməyin, bank əməkdaşına da.",
    "2. Linkdə domenin sonuna baxın: azerpost[.]az, kapitalbank[.]az, dövlət saytları .gov[.]az.",
    "3. Yaxınınız yeni nömrədən pul istəyirsə, köhnə nömrəsinə zəng edin.",
    "",
    `Dostlarınızı da sınayın: bu linki göndərin ${gameLink}`,
    "(«Dostuna göndər» düyməsi telefonda işləyir.)",
  ].join("\n");
}

const answerKb = (seed, i, score) => ({
  inline_keyboard: [[
    { text: "🚨 Təhlükəlidir", callback_data: `q:${seed}:${i}:${score}:f` },
    { text: "✅ Təhlükəsizdir", callback_data: `q:${seed}:${i}:${score}:t` },
  ]],
});

export async function startQuiz(env, chatId) {
  const seed = crypto.getRandomValues(new Uint16Array(1))[0].toString(16);
  const q = pickRound(parseInt(seed, 16))[0];
  return tg(env, "sendMessage", { chat_id: chatId, text: questionText(q, 0), reply_markup: answerKb(seed, 0, 0), link_preview_options: { is_disabled: true } });
}

export async function quizCallback(env, cb) {
  const data = cb.data || "";
  if (data === "q:new") {
    if (!cb.message) { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id }); return true; }
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    await startQuiz(env, cb.message.chat.id);
    return true;
  }
  const m = /^q:([0-9a-f]{1,4}):(\d):(\d):([ftn])$/.exec(data);
  if (!m) return false;
  if (!cb.message) { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id }); return true; }
  const [, seed, iS, scoreS, a] = m;
  const i = Number(iS), score = Number(scoreS);
  const chatId = cb.message.chat.id, messageId = cb.message.message_id;
  const round = pickRound(parseInt(seed, 16));
  if (a === "n") {
    await tg(env, "answerCallbackQuery", { callback_query_id: cb.id });
    await tg(env, "editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
    if (i < ROUND) {
      return !!(await tg(env, "sendMessage", { chat_id: chatId, text: questionText(round[i], i), reply_markup: answerKb(seed, i, score), link_preview_options: { is_disabled: true } }));
    }
    const bot = (await botUsername(env)) || "scamshield_az_bot";
    const share = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${bot}?start=oyun`)}&text=${encodeURIComponent("Fırıldaq mesajını tanıya bilərsən? 5 mesajlıq oyunu yoxla:")}`;
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text: resultText(Math.min(score, ROUND), `https://t.me/${bot}?start=oyun`),
      reply_markup: {
        inline_keyboard: [
          [{ text: "📤 Dostuna göndər", url: share }],
          [{ text: "🏆 Saytda oyna və cədvələ düş", url: `${env.SITE_URL || "https://scamshield-az.pages.dev"}/oyun#cedvel` }],
          [{ text: "🔁 Yenidən oyna", callback_data: "q:new" }],
        ],
      },
      link_preview_options: { is_disabled: true },
    });
    return true;
  }
  if (i >= ROUND) { await tg(env, "answerCallbackQuery", { callback_query_id: cb.id }); return true; }
  const q = round[i];
  const correct = (a === "f") === q.scam;
  const next = score + (correct ? 1 : 0);
  await tg(env, "answerCallbackQuery", { callback_query_id: cb.id, text: correct ? "✅ Düzdür!" : "❌ Səhv" });
  await tg(env, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: answerText(q, i, correct),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: [[{ text: i + 1 < ROUND ? "Növbəti ▶️" : "Nəticəni gör 🏁", callback_data: `q:${seed}:${i + 1}:${next}:n` }]] },
  });
  return true;
}
