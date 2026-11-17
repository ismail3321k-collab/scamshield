// Səsli mesaj yoxlanışı (sınaq): Telegram səs faylı → Workers AI Whisper → mətn → adi analiz.
// Səs və mətn heç yerdə saxlanılmır. VOICE_ENABLED = "0" olanda söndürülür (dəyişən yoxdursa açıqdır).
// Whisper sxemi (developers.cloudflare.com, 17.11.2026): turbo → { audio: base64, task, language, vad_filter, initial_prompt };
// köhnə whisper → { audio: [0..255] }.

const PROMPT = "Salam, mən Kapital Bankın təhlükəsizlik şöbəsindənəm. Kartınızdan şübhəli ödəniş var. Telefonunuza gələn SMS kodunu mənə deyin. Azərpoçt, bağlamanız gömrükdə saxlanılıb, ödəyin. Birbank, kart, manat, bloklanıb, təcili, yeni nömrəmdir, karta at.";
export const MAX_SECONDS = 120;
export const MAX_BYTES = 5 * 1024 * 1024;

export const voiceEnabled = (env) => String(env?.VOICE_ENABLED ?? "1").trim() !== "0";

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function transcribe(env, bytes) {
  if (!env?.AI || !bytes?.length) return { text: "", model: null };
  try {
    const r = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
      audio: toBase64(bytes), task: "transcribe", language: "az", vad_filter: true, initial_prompt: PROMPT,
    });
    const text = String(r?.text || "").trim();
    if (text) return { text, model: "whisper-large-v3-turbo", language: r?.transcription_info?.language || null };
  } catch (e) { console.error("whisper turbo", String(e?.message || e).slice(0, 200)); }
  try {
    const r = await env.AI.run("@cf/openai/whisper", { audio: [...bytes] });
    const text = String(r?.text || "").trim();
    if (text) return { text, model: "whisper" };
  } catch (e) { console.error("whisper", String(e?.message || e).slice(0, 200)); }
  return { text: "", model: null };
}

// Boş və ya mənasız nəticə (səssizlikdə Whisper bəzən bir-iki söz "uydurur")
export function meaningful(text) {
  const t = String(text || "").trim();
  const letters = (t.match(/\p{L}/gu) || []).length;
  return letters >= 8 && t.split(/\s+/).length >= 2;
}

export async function downloadTelegramFile(env, fileId) {
  const info = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`)).json().catch(() => null);
  const path = info?.result?.file_path;
  if (!path || (info.result.file_size || 0) > MAX_BYTES) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${path}`);
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  return buf.length && buf.length <= MAX_BYTES ? buf : null;
}
