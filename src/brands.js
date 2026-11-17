// Taklit edilen markalar: resmi alan adları (data/allowlist.csv ile uyumlu), alan adı anahtarları, mesajdaki anılışları.
// keys: hostname içinde aranır (5+ harf alt dize; daha kısa olanlar yalnız tam etiket). mentions: mesaj metninde (katlanmış) aranır.

export const BRANDS = [
  { name: "Azərpoçt", keys: ["azerpost", "azerpoct", "azerpocht", "azpost"], domains: ["azerpost.az"], mentions: ["azerpoct", "azerpost", "azer poct"], hotline: { label: "Azərpoçt 169", num: "169", desc: "Bağlamanız həqiqətən gözləyirmi? Azərpoçtun özündən soruşun." } },
  { name: "Kapital Bank", keys: ["kapitalbank", "kapital"], domains: ["kapitalbank.az", "birbank.az"], mentions: ["kapital bank", "kapitalbank"], hotline: { label: "Kapital Bank 196", num: "196", desc: "Kartınızla bağlı hər şeyi bankın öz nömrəsindən soruşun. Bank heç vaxt SMS kodu soruşmur." } },
  { name: "Birbank", keys: ["birbank"], domains: ["birbank.az", "kapitalbank.az"], mentions: ["birbank"], hotline: { label: "Kapital Bank 196", num: "196", desc: "Kartınızla bağlı hər şeyi bankın öz nömrəsindən soruşun. Bank heç vaxt SMS kodu soruşmur." } },
  { name: "ABB", keys: ["abbbank", "abb"], domains: ["abb-bank.az"], mentions: ["abb bank", "abb-bank", "abb-nin", "abb "] },
  { name: "PAŞA Bank", keys: ["pashabank", "pasabank", "pasha"], domains: ["pashabank.az"], mentions: ["pasa bank", "pasha bank", "pasabank", "pashabank"] },
  { name: "AccessBank", keys: ["accessbank"], domains: ["accessbank.az"], mentions: ["accessbank", "access bank"] },
  { name: "Leobank", keys: ["leobank"], domains: ["leobank.az"], mentions: ["leobank"] },
  { name: "Unibank", keys: ["unibank"], domains: ["unibank.az"], mentions: ["unibank"] },
  { name: "Bank Respublika", keys: ["bankrespublika", "respublika"], domains: ["bankrespublika.az"], mentions: ["bank respublika"] },
  { name: "Xalq Bank", keys: ["xalqbank"], domains: ["xalqbank.az"], mentions: ["xalq bank"] },
  { name: "Expressbank", keys: ["expressbank"], domains: ["expressbank.az"], mentions: ["expressbank"] },
  { name: "Yelo Bank", keys: ["yelobank", "yelo"], domains: ["yelo.az"], mentions: ["yelo bank"] },
  { name: "Rabitəbank", keys: ["rabitabank", "rabitebank"], domains: ["rabitabank.com"], mentions: ["rabitebank", "rabitabank"] },
  { name: "Bank of Baku", keys: ["bankofbaku"], domains: ["bankofbaku.com"], mentions: ["bank of baku"] },
  { name: "Ziraat Bank", keys: ["ziraatbank", "ziraat"], domains: ["ziraatbank.az"], mentions: ["ziraat"] },
  { name: "Yapı Kredi", keys: ["yapikredi"], domains: ["yapikredi.com.az"], mentions: ["yapi kredi"] },
  { name: "myGov", keys: ["mygov", "egov"], domains: ["my.gov.az", "e-gov.az", "mygov.az"], mentions: ["mygov", "e-gov", "elektron hokumet"] },
  { name: "ASAN xidmət", keys: ["asanxidmet", "asan"], domains: ["asan.gov.az"], mentions: ["asan xidmet", "asan "] },
  { name: "DİN", keys: ["dingov", "din", "polis"], domains: ["mia.gov.az", "din.gov.az"], mentions: ["daxili isler", "din "], hotline: { label: "Polis 102", num: "102", desc: "Pulunuz artıq kartdan çıxıbsa, dərhal polisə zəng edin." } },
  { name: "Mərkəzi Bank", keys: ["cbar", "merkezibank"], domains: ["cbar.az"], mentions: ["merkezi bank"] },
  { name: "Vergi Xidməti", keys: ["etaxes", "taxes"], domains: ["taxes.gov.az", "e-taxes.gov.az"], mentions: ["vergi xidmeti", "e-taxes"] },
  { name: "Sosial Müdafiə", keys: ["sosial", "dsmf", "esosial"], domains: ["sosial.gov.az", "dsmf.gov.az"], mentions: ["sosial yardim", "dsmf", "sosial muhafize", "sosial mudafie"] },
  { name: "DİM", keys: ["dimgov", "dim"], domains: ["dim.gov.az"], mentions: ["imtahan merkezi"] },
  { name: "Azercell", keys: ["azercell"], domains: ["azercell.com"], mentions: ["azercell"] },
  { name: "Bakcell", keys: ["bakcell"], domains: ["bakcell.com", "bkc.link"], mentions: ["bakcell"] },
  { name: "Nar", keys: ["narmobile", "nar"], domains: ["nar.az"], mentions: ["nar mobile"] },
  { name: "Tap.az", keys: ["tapaz"], domains: ["tap.az"], mentions: ["tap.az", "tapaz"] },
  { name: "Lalafo", keys: ["lalafo"], domains: ["lalafo.az"], mentions: ["lalafo"] },
  { name: "Birmarket", keys: ["birmarket", "umico"], domains: ["birmarket.az", "umico.az"], mentions: ["birmarket", "umico"] },
  { name: "MilliÖn", keys: ["million"], domains: ["million.az"], mentions: ["million"], exactOnly: true },
  { name: "eManat", keys: ["emanat"], domains: ["emanat.az"], mentions: ["emanat"] },
  { name: "Azərişıq", keys: ["azerishiq", "azerisiq"], domains: ["azerishiq.az"], mentions: ["azerisiq"] },
  { name: "Azəriqaz", keys: ["azeriqaz"], domains: ["azeriqaz.az"], mentions: ["azeriqaz"] },
  { name: "SOCAR", keys: ["socar"], domains: ["socar.az"], mentions: ["socar"] },
  { name: "WhatsApp", keys: ["whatsapp"], domains: ["whatsapp.com", "wa.me"], mentions: [] },
  { name: "Telegram", keys: ["telegram"], domains: ["telegram.org", "t.me"], mentions: [] },
];

// 1654: Elektron Təhlükəsizlik Xidməti (2026'dan Milli Kibertəhlükəsizlik Agentliyi) qaynar xətti (Report.az, 26.05.2026)
export const GENERIC_HOTLINES = [
  { label: "Polis 102", num: "102", desc: "Pulunuz artıq kartdan çıxıbsa və ya sizi hədələyirlərsə, polisə zəng edin." },
  { label: "Kibertəhlükəsizlik 1654", num: "1654", desc: "Saxta sayt, saxta mesaj və ya oğurlanmış WhatsApp / Telegram hesabı haqqında dövlətin kibertəhlükəsizlik xəttinə xəbər verin." },
];

export const BANK_CARD_HOTLINE = { label: "Kartın arxasındakı nömrə", num: null, desc: "Bank kartınızın arxasında bankın öz nömrəsi yazılıb. Şübhə varsa, mesajdakı nömrəyə yox, ora zəng edin." };
