# ScamShield

**Klikləmədən əvvəl yoxla.**

Azərbaycan dilində fırıldaq mesajı yoxlayıcısı. Şübhəli SMS, WhatsApp mesajı, link, telefon nömrəsi, QR kod, ekran görüntüsü və ya səsli mesaj göndərin: ScamShield bir neçə saniyədə 0–100 risk balı verir, tələnin harada olduğunu sadə dildə izah edir və nə etməli olduğunuzu deyir.

- Sayt: https://scamshield-az.pages.dev
- Telegram botu: [@scamshield_az_bot](https://t.me/scamshield_az_bot)

Cyber Force komandası · OYU CyberAI Hackathon 2026

## İmkanlar

- **Mətn, link və nömrə təhlili** — qaydalar, yerli brend və lüğət bazası və dil modeli (Llama 3.3 70B) birlikdə işləyir.
- **Linkin real yoxlanışı** — domenin yaşı (RDAP), VirusTotal reputasiyası, OpenPhish və blacklist.gov.az siyahıları; şübhəli səhifəni təcrid olunmuş brauzerdə açıb ekran görüntüsünü göstəririk.
- **QR kod və skrinşot** — şəkil brauzerdə oxunur (jsQR, Tesseract.js), serverə yalnız oxunan mətn gedir.
- **Səsli mesaj** (Telegram) — Whisper ilə mətnə çevrilir və adi qaydada yoxlanılır.
- **«Yaxınını qoru»** — yaxınınıza fırıldaq mesajı gələndə sizə xəbərdarlıq gəlir (mesajın mətni olmadan).
- **«Bu gün yayılan tələlər»** və bank / CERT üçün anonim kampaniya paneli.
- **«Təhlükəni aşkar et»** — 10 suallıq təlim sınağı, şirkət kodu ilə ayın cədvəli.
- **«Fişinq Testi»** — şirkətlər üçün fişinq simulyasiyası (demo).

## Məxfilik

- Yoxlanılan mesajın mətni saxlanılmır; statistikada yalnız vaxt, kanal, bal, əlamət kodları və şübhəli domen qalır.
- Telefon nömrələri yalnız HMAC izi kimi saxlanılır.
- Dil modelinə kart, telefon və kodları gizlədilmiş mətn göndərilir.
- Şübhəli linki istifadəçi yox, təcrid olunmuş brauzerimiz açır.

## Nəticələr

| Test | Nəticə |
|---|---|
| 905 görülməmiş SMS (`ml/holdout.json`, `tools/eval.mjs`) | precision 81,4% · recall 85,4% · yanlış həyəcan 3,1% |
| Hücum testi (`tools/attack.mjs`) | 17 hücum + 3 nəzarət |

## Arxitektura

Bir Cloudflare Worker sayta, API-yə və Telegram webhook-una birlikdə xidmət edir:

- **Workers** — `src/worker.js` (marşrutlar), `src/analyze.js` (bal), `src/linkcheck.js`, `src/telegram.js`, `src/guard.js`, `src/phone.js`, `src/voice.js`, `src/quizapi.js`
- **D1** (SQLite) — `schema.sql`
- **Workers AI** — Llama 3.3 70B, Whisper large-v3-turbo
- **Browser Rendering** — şübhəli səhifənin ekran görüntüsü
- **Pages** — `scamshield-az.pages.dev` sorğuları service binding ilə Worker-ə ötürür

## Struktur

```
src/        Worker kodu
public/     sayt (ana səhifə, sınaq, Fişinq Testi, panel, məxfilik)
data/       brendlər, lüğət, sınaq sualları, blacklist.gov.az siyahısı
ml/         sadə model və test dəstləri
tools/      testlər və köməkçi skriptlər
schema.sql  D1 sxemi
```

## İşə salmaq

```bash
npm install
npx wrangler d1 execute ayiq --local --file=schema.sql
npx wrangler dev
```

Sirlər (`npx wrangler secret put <AD>`): `PANEL_KEY`, `TELEGRAM_TOKEN`, `TELEGRAM_SECRET`, `TG_PATH`, `PHONE_PEPPER`, `VT_API_KEY` (istəyə bağlı). Lokal işləmək üçün `.dev.vars` faylı.

Yayım: `npx wrangler deploy`, sonra Telegram webhook-u üçün `POST /api/admin/setup` (`x-panel-key` başlığı ilə).

## Testlər

```bash
node tools/test.mjs
node tools/bot-test.mjs
node tools/attack.mjs
node tools/eval.mjs
```

---

## English

ScamShield checks suspicious SMS, WhatsApp messages, links, phone numbers, QR codes, screenshots and voice messages for Azerbaijani users and explains the risk (0–100) in plain Azerbaijani. Built on Cloudflare Workers, D1, Workers AI (Llama 3.3 70B, Whisper) and Browser Rendering. Message text is never stored.

Live: https://scamshield-az.pages.dev · Telegram: [@scamshield_az_bot](https://t.me/scamshield_az_bot) · Team Cyber Force, OYU CyberAI Hackathon 2026.
