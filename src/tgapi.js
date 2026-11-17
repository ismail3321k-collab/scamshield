// Telegram Bot API köməkçiləri (bütün bot modulları bunu işlədir).

export async function tg(env, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("tg", method, res.status, (await res.text()).slice(0, 200));
  return res;
}

// Linkləri basılmaz edir: https:// silinir, nöqtə [.] olur
export function defang(s) {
  return String(s || "").replace(/https?:\/\//gi, "").replace(/\.(?=[a-z0-9])/gi, "[.]");
}

let botCache = null;
export async function botUsername(env) {
  if (botCache) return botCache;
  if (!env.TELEGRAM_TOKEN) return "";
  try {
    const me = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getMe`)).json();
    botCache = me?.result?.username || "";
  } catch { botCache = ""; }
  return botCache || "";
}
export function resetBotCache() { botCache = null; }

export function displayName(from) {
  const n = [from?.first_name, from?.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 40);
  return n || "Telegram istifadəçisi";
}
