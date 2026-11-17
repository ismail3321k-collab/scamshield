-- ScamShield D1 sxemi. Mesaj mətni saxlanılmır.
CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  channel TEXT NOT NULL,
  score INTEGER NOT NULL,
  band TEXT NOT NULL,
  flags TEXT,
  domain TEXT,
  brand TEXT,
  campaign_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_checks_ts ON checks (ts);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT,
  brand TEXT,
  domain TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  count INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  flags TEXT
);
CREATE INDEX IF NOT EXISTS idx_campaigns_last ON campaigns (last_seen);

CREATE TABLE IF NOT EXISTS intel_hosts (
  host TEXT PRIMARY KEY,
  source TEXT,
  ts INTEGER
);

-- "Yaxınını qoru": razılıqla qoşulan ailə üzvləri. Mesaj mətni burada da YOXDUR.
CREATE TABLE IF NOT EXISTS guard_invites (
  code TEXT PRIMARY KEY,          -- 12 bayt təsadüfi, bir dəfəlik, 24 saat
  guardian_chat INTEGER NOT NULL,
  guardian_name TEXT,
  guardian_user TEXT,
  label TEXT,                     -- qoruyanın verdiyi ad ("Anam")
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS guards (
  protected_chat INTEGER NOT NULL,
  guardian_chat INTEGER NOT NULL,
  guardian_name TEXT,
  protected_name TEXT,
  label TEXT,
  created INTEGER NOT NULL,
  last_alert INTEGER DEFAULT 0,
  PRIMARY KEY (protected_chat, guardian_chat)
);
CREATE INDEX IF NOT EXISTS idx_guards_guardian ON guards (guardian_chat);

-- Nömrə şikayətləri: nömrənin özü YOX, yalnız HMAC-SHA256 (gizli açarla) saxlanılır.
CREATE TABLE IF NOT EXISTS phone_reports (
  phone TEXT NOT NULL,            -- HMAC(nömrə)
  reporter TEXT NOT NULL,         -- HMAC(tg:chat və ya ip:ünvan): eyni adam iki dəfə saymır
  source TEXT NOT NULL,           -- 'user' (istifadəçi bildirdi) | 'message' (təhlükəli mesajda göründü)
  ts INTEGER NOT NULL,
  PRIMARY KEY (phone, reporter)
);

-- "Fırıldağı tap" xal cədvəli. Cavablar serverdə yoxlanılır; oyun sessiyası hər suala bir dəfə cavab qəbul edir.
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id TEXT PRIMARY KEY,            -- 16 bayt təsadüfi
  qids TEXT NOT NULL,             -- sual id-ləri (vergüllə)
  answers TEXT NOT NULL DEFAULT '',-- f = fırıldaq, t = təhlükəsiz (sıra ilə)
  points INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  started INTEGER NOT NULL,
  finished INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS quiz_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nick TEXT NOT NULL,             -- "Ad Soyad" (cədvəldə hamıya görünür)
  company TEXT,                   -- şirkət kodu, məs. OYU
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  month TEXT NOT NULL,            -- YYYY-MM (Bakı vaxtı)
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quiz_scores_board ON quiz_scores (month, company, score);

-- Kiçik açar-dəyər cədvəli (məs. Blacklist.gov.az lentinin tarixi: dəyişməyibsə yenidən yazmırıq)
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

-- VirusTotal nəticələri 24 saat (pulsuz limit: dəqiqədə 4, gündə 500)
CREATE TABLE IF NOT EXISTS vt_cache (
  domain TEXT PRIMARY KEY,
  malicious INTEGER, suspicious INTEGER, total INTEGER, known INTEGER,
  ts INTEGER NOT NULL
);

-- İcma bildirişləri (saytdakı «Şübhəli mənbə haqqında məlumat ver» forması): moderasiya növbəsi, avtomatik dərc olunmur.
-- value: mesaj/kampaniya mətnində kart, telefon və kodlar gizlədilir; reporter = HMAC(ip). Worker cədvəli özü də yaradır.
CREATE TABLE IF NOT EXISTS community_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,             -- phone | website | message | campaign
  value TEXT NOT NULL,
  note TEXT,
  reporter TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' -- pending | approved | rejected
);
CREATE INDEX IF NOT EXISTS idx_community_reports ON community_reports (status, ts);
