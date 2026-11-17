// Testlər üçün D1 əvəzi: Node 24-ün daxili SQLite-ı (node:sqlite) + schema.sql.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

export function fakeD1(schemaUrl = new URL("../schema.sql", import.meta.url)) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(schemaUrl, "utf8"));
  const plain = (r) => (r ? { ...r } : r);
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => {
      const r = db.prepare(sql).get(...args);
      if (r === undefined) return null;
      return col ? r[col] : plain(r);
    },
    all: async () => ({ results: db.prepare(sql).all(...args).map(plain) }),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; },
    _db: db,
  };
}

// Telegram API çağırışlarını tutan fetch əvəzi. Digər ünvanlar 404 qaytarır (şəbəkə yoxdur).
export function mockTelegram() {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    // Telegram fayl endirmə (səsli mesaj testi)
    if (/api\.telegram\.org\/file\/bot/.test(u)) { calls.push({ method: "fileDownload", body: null }); return new Response(new Uint8Array([79, 103, 103, 83, 1, 2, 3, 4])); }
    const m = /api\.telegram\.org\/bot[^/]+\/(\w+)/.exec(u);
    if (m) {
      let body = null;
      if (typeof init.body === "string") body = JSON.parse(init.body);
      calls.push({ method: m[1], body });
      // 403403 nömrəli söhbət botu bağlayıb (çatdırılmama testi üçün)
      if (body?.chat_id === 403403) return new Response(JSON.stringify({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
      const result = m[1] === "getMe" ? { username: "ayiq_test_bot" } : m[1] === "sendMessage" ? { message_id: 900 + calls.length }
        : m[1] === "getFile" ? { file_id: "v1", file_path: "voice/file_1.oga", file_size: 8 } : true;
      return new Response(JSON.stringify({ ok: true, result }), { headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  };
  return { calls, restore: () => { globalThis.fetch = realFetch; }, clear: () => { calls.length = 0; } };
}
