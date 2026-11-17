// "Bu gün yayılan tələlər": son 24 saatın ən çox görülən təhlükəli kampaniyaları.
// İctimai siyahıda istifadəçinin yazdığı mətn YOXDUR: yalnız bizim etiketlər, say və vaxt.
// Saytın adı yalnız sayt barədə sübut olanda göstərilir (təzə domen, saxta kart forması və s.),
// beləcə heç kim təmiz bir saytı saxta mesajla bu siyahıya sala bilməz.
import { defang } from "./tgapi.js";
import { HOSTING } from "./url.js";

const EVIDENCE = new Set([
  "brand_impersonation", "intel_hit", "vt_malicious", "page_card_form", "page_scam_app", "new_domain", "young_domain",
  "domain_not_registered", "scam_app_path", "idn_host", "userinfo_url", "ip_url",
]);

const WANTS = [
  ["hesap_ele_gecirme", "SMS kodunuzu istəyir"],
  ["veri_talebi", "kart məlumatı istəyir"],
  ["pul_talebi", "pul köçürməyi istəyir"],
  ["qohum_taklidi", "yaxınınız kimi yazır"],
  ["is_teklifi", "asan qazanc vəd edir"],
  ["investisiya", "yatırım gəliri vəd edir"],
  ["odul", "hədiyyə vəd edir"],
  ["yardim", "dövlət yardımı vəd edir"],
  ["kargo", "bağlama bəhanəsi ilə yazır"],
  ["messenger_link", "WhatsApp / Telegram-a çağırır"],
];

export function publicLabel(c) {
  if (c.brand && /təqlidi$/.test(c.label || "")) return `${c.brand} adından saxta mesaj`;
  if (!c.label || c.label === "Şübhəli mesaj") return c.domain ? "Şübhəli link" : "Şübhəli mesaj";
  return c.label;
}

// Eyni qurumun (eyni ictimai etiketin) kampaniyaları bir sətirdə birləşir: say cəmlənir, saytlar ayrıca sadalanır
export function groupCampaigns(rows) {
  const groups = new Map();
  for (const c of rows) {
    const label = publicLabel(c);
    const flags = (c.flags || "").split(",");
    const g = groups.get(label) || { label, count: 0, last: 0, wants: [], domains: [] };
    g.count += c.n || 0;
    g.last = Math.max(g.last, c.last || 0);
    for (const [code, t] of WANTS) if (flags.includes(code) && !g.wants.includes(t)) g.wants.push(t);
    // github.io, pages.dev kimi hostinq platformasının özü fırıldaq saytı deyil: siyahıda göstərilmir
    if (c.domain && flags.includes("domain_evidence") && !HOSTING.has(String(c.domain).toLowerCase())) {
      const d = defang(c.domain);
      if (!g.domains.includes(d)) g.domains.push(d);
    }
    groups.set(label, g);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, 5)
    .map((g) => ({ ...g, wants: g.wants.slice(0, 2), domains: g.domains.slice(0, 3), domain: g.domains[0] || null }));
}

export async function todayData(env) {
  const since = Date.now() - 24 * 3600 * 1000;
  const [stats, rows] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN band = 'high' THEN 1 ELSE 0 END) AS high FROM checks WHERE ts >= ?1").bind(since).first(),
    env.DB.prepare(
      `SELECT c.label, c.brand, c.domain, c.flags, COUNT(k.id) AS n, MAX(k.ts) AS last
       FROM checks k JOIN campaigns c ON c.id = k.campaign_id
       WHERE k.ts >= ?1 AND k.band = 'high'
       GROUP BY c.id ORDER BY n DESC, last DESC LIMIT 50`
    ).bind(since).all(),
  ]);
  return { total: stats?.total || 0, high: stats?.high || 0, items: groupCampaigns(rows.results || []) };
}

// Telefonda oxunaqlı olsun deyə hər sətir qısa: tələnin növü və saytlar ayrı sətirlərdə, botda ən çox 2 sayt
// 390 px telefonda (≈290 px mətn eni) hər sətir ən çox 2 sətrə sığsın: göstərilən saytlar ≈40 simvolu keçmir
export function sitesText(domains, max = 2, budget = 40) {
  if (!domains?.length) return null;
  if (domains.length === 1) return "Sayt: " + domains[0];
  const shown = [domains[0]];
  for (const d of domains.slice(1, max)) {
    if ([...shown, d].join(", ").length > budget) break;
    shown.push(d);
  }
  const rest = domains.length - shown.length;
  return `${domains.length} fərqli sayt: ${shown.join(", ")}${rest > 0 ? ` +${rest}` : ""}`;
}

export function todayText(d) {
  if (!d.items.length) {
    return [
      "📢 Bu gün yayılan tələlər",
      "",
      "Son 24 saatda ScamShield-də çox təhlükəli kampaniya qeydə alınmayıb.",
      "Şübhəli mesaj alsanız, mənə göndərin, yoxlayım.",
    ].join("\n");
  }
  const lines = ["📢 Bu gün yayılan tələlər (son 24 saat)", ""];
  d.items.forEach((x, i) => {
    lines.push(`${i + 1}. ${x.label} — ${x.count} dəfə`);
    if (x.wants?.length) lines.push("   Nə istəyir: " + x.wants.join(", "));
    const sites = sitesText(x.domains || (x.domain ? [x.domain] : []));
    if (sites) lines.push("   " + sites);
  });
  lines.push("", `Son 24 saatda yoxlanılan mesaj: ${d.total}, onlardan çox təhlükəli: ${d.high}.`);
  lines.push("Belə mesaj alsanız, linkə basmayın, kod verməyin və mesajı mənə göndərin.");
  return lines.join("\n");
}
