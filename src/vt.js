// VirusTotal domen yoxlaması. Yalnız domen göndərilir (linkin yolu və «?…» hissəsi yox: qurbanın izləmə kodu getməsin).
// Açar (VT_API_KEY, Cloudflare secret) yoxdursa səssiz keçir. Pulsuz limit: dəqiqədə 4, gündə 500 → nəticə D1-də 24 saat saxlanılır
// (workers.dev-də Cache API işləmir); 429-da keçir.
// Qeyd: pulsuz VirusTotal API kommersiya məhsulunda işlədilə bilməz; satışda Premium API lazımdır.

const TTL = 24 * 3600 * 1000;

export async function vtDomain(env, reg) {
  if (!env?.VT_API_KEY || !reg || !/^[a-z0-9.-]+$/i.test(reg)) return null;
  const domain = reg.toLowerCase();
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT malicious, suspicious, total, known FROM vt_cache WHERE domain = ?1 AND ts > ?2").bind(domain, Date.now() - TTL).first();
      if (row) return { malicious: row.malicious, suspicious: row.suspicious, total: row.total, known: !!row.known };
    } catch { /* keş cədvəli yoxdur */ }
  }
  let res;
  try {
    res = await fetch(`https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`, {
      headers: { "x-apikey": env.VT_API_KEY, accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
  } catch { return null; }
  if (res.status === 429 || res.status === 401 || res.status >= 500) return null;
  let out;
  if (res.status === 404) out = { malicious: 0, suspicious: 0, total: 0, known: false };
  else if (res.ok) {
    const s = (await res.json().catch(() => null))?.data?.attributes?.last_analysis_stats || {};
    const malicious = s.malicious || 0, suspicious = s.suspicious || 0;
    out = { malicious, suspicious, total: malicious + suspicious + (s.harmless || 0) + (s.undetected || 0) + (s.timeout || 0), known: true };
  } else return null;
  if (env.DB) {
    try {
      await env.DB.prepare("INSERT OR REPLACE INTO vt_cache (domain, malicious, suspicious, total, known, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)")
        .bind(domain, out.malicious, out.suspicious, out.total, out.known ? 1 : 0, Date.now()).run();
    } catch { /* yazılmadı */ }
  }
  return out;
}

// İki və ya daha çox antivirus "zərərli" deyirsə bayraq (çəki intel_hit qədər).
// Əks halda yalnız məlumat sətri (çəkisi 0): 0 nəticə heç vaxt "təhlükəsiz" kimi göstərilmir —
// yeni fırıldaq saytlarını VirusTotal hələ tanımır, ScamShield isə saytın yaşına və içinə də baxır.
export function vtFlag(v) {
  if (!v) return null;
  if (v.known && v.malicious >= 2) return { code: "vt_malicious", weight: 40, malicious: v.malicious, total: v.total };
  return { code: "vt_info", weight: 0, malicious: v.malicious || 0, total: v.total || 0, known: !!v.known };
}
