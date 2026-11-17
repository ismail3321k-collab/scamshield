# Ayıq skorlama motoru stres testi raporu

Tarih: 17.11.2026. Motor değiştirilmedi. Mesaj kümesi: `ml/stress_set.json` (142 mesaj: 85 dolandırıcılık, 57 meşru; ~65 Azerice, 15 Rusça, 12 İngilizce, bir kısmı ə/ş/ı harfsiz yazılmış). Çalıştırma: `node tools/stress.mjs` (LLM kapalı). Not: sahte alan adları yalnız `.top`, `.xyz`, `.test`, `.example` gibi uydurma adlardır.

## 1. Genel sayılar

| Ölçü | Değer |
|---|---|
| Dolandırıcılık mesajı | 85 |
| **high** (>=70) olarak yakalanan | 26 (30.6%) |
| **suspicious** (30-69) | 30 |
| **safe** olarak kaçırılan | 29 (34.1%) |
| Yakalama oranı (yalnız high) | **30.6%** |
| Yakalama oranı (high + suspicious) | **65.9%** |
| Meşru mesaj | 57 |
| safe | 53 |
| suspicious (yanlış alarm) | 4 |
| high (yanlış alarm) | 0 |
| Yanlış alarm oranı (yalnız high) | **0.0%** |
| Yanlış alarm oranı (suspicious + high) | **7.0%** |

Motorun kendi 905 örnekli ölçümü (data/metrics.json) yakalamayı 0.66 (high) / 0.85 (eşik 50) gösteriyor; bu gerçekçi stres kümesinde belirgin biçimde daha düşük çıktı: motor, eğitim dağılımındaki kalıplara (banka/kargo + link) iyi, ama sohbet tarzı tuzaklara (yakın taklidi, iş/Telegram, yatırım, ianə) neredeyse kör.

### Tür bazında (dolandırıcılık)

| Tür | n | high | suspicious | safe |
|---|---|---|---|---|
| kargo | 10 | 6 | 3 | 1 |
| bank | 15 | 7 | 7 | 1 |
| otp | 7 | 1 | 3 | 3 |
| odul | 8 | 3 | 5 | 0 |
| is | 8 | 0 | 0 | 8 |
| invest | 7 | 1 | 1 | 5 |
| gov | 9 | 3 | 5 | 1 |
| market | 7 | 4 | 3 | 0 |
| relative | 7 | 0 | 0 | 7 |
| charity | 3 | 0 | 0 | 3 |
| misc | 4 | 1 | 3 | 0 |

### Tür bazında (meşru)

| Tür | n | safe | suspicious | high |
|---|---|---|---|---|
| otp | 8 | 8 | 0 | 0 |
| tx | 7 | 7 | 0 | 0 |
| post | 3 | 2 | 1 | 0 |
| operator | 5 | 5 | 0 | 0 |
| shop | 5 | 5 | 0 | 0 |
| appt | 3 | 3 | 0 | 0 |
| friend | 6 | 6 | 0 | 0 |
| univ | 3 | 2 | 1 | 0 |
| delivery | 3 | 3 | 0 | 0 |
| bill | 5 | 4 | 1 | 0 |
| gov | 3 | 2 | 1 | 0 |
| friend_other | 6 | 6 | 0 | 0 |

### Dil bazında

| Dil | scam n | high | susp | safe | legit n | yanlış alarm |
|---|---|---|---|---|---|---|
| az | 65 | 17 | 28 | 20 | 50 | 4 |
| ru | 10 | 5 | 1 | 4 | 5 | 0 |
| en | 10 | 4 | 1 | 5 | 2 | 0 |

## 2. Tüm hatalar (63)

### 2a. Kaçırılan dolandırıcılıklar (safe) ve yalnız 'suspicious' kalanlar

Sıralama: skora göre artan. KAÇTI = safe, ZAYIF = suspicious (high olmalıydı).

| # | Durum | Skor | ml | Tür/dil | Mesaj | Bayraklar | Teşhis |
|---|---|---|---|---|---|---|---|
| 1 | KAÇTI | 1 | 0.008 | otp/az | Salam qardaş, WhatsApp-a girə bilmirəm, nömrəni səhv yazmışam, sənə kod gələcək, mənə at. | - | Sohbet tarzı kod avı ('kod gələcək, mənə at/yaz', 'səhvən ... kod') kalıbı yok; mevcut `kod ... deyin/göndərin` regex'i 'mənə at/yaz' ve sıfat sırasını kaçırıyor. |
| 2 | KAÇTI | 1 | 0.01 | invest/az | Bitcoin ile gunde 200 manat qazanin! 250 AZN yatirin, 2 saata ikiqat geri. Telegram: @btc_az_money | - | Yatırım tuzağı kalıpları ('ikiqat', '3 qat', 'risksiz', 'gəlir zəmanəti' dışında 'kripto' + 'yatırın') eksik; EN/RU için sözlük yok. |
| 3 | KAÇTI | 1 | 0.014 | invest/en | Crypto investment: deposit 200 AZN and get 600 AZN in 7 days. Guaranteed returns. WhatsApp +994 55 111 22 33 | - | Yatırım tuzağı kalıpları ('ikiqat', '3 qat', 'risksiz', 'gəlir zəmanəti' dışında 'kripto' + 'yatırın') eksik; EN/RU için sözlük yok. |
| 4 | KAÇTI | 2 | 0.02 | relative/az | Salam ata, mən yeni nömrədən yazıram, telefon suya düşdü. Bir dostuma 500 manat göndərməlisən, kartına link atıram. | - | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 5 | KAÇTI | 2 | 0.019 | invest/ru | Инвестиции в крипту: вложи 200 манат и получи 600 за неделю. Гарантия дохода. WhatsApp +994 50 000 00 00 | - | Yatırım tuzağı kalıpları ('ikiqat', '3 qat', 'risksiz', 'gəlir zəmanəti' dışında 'kripto' + 'yatırın') eksik; EN/RU için sözlük yok. |
| 6 | KAÇTI | 2 | 0.025 | relative/en | Mom, my phone broke, this is my new number. Please urgently send 300 AZN to this card. | - | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 7 | KAÇTI | 2 | 0.02 | otp/en | Hi, I sent my WhatsApp code to your number by mistake, please send me the 6 digit code you received. | - | Sohbet tarzı kod avı ('kod gələcək, mənə at/yaz', 'səhvən ... kod') kalıbı yok; mevcut `kod ... deyin/göndərin` regex'i 'mənə at/yaz' ve sıfat sırasını kaçırıyor. |
| 8 | KAÇTI | 5 | 0.062 | is/az | Sizin CV-niz bəyənildi. Gündə 2 saat işləyin, həftədə 1500 AZN. Ətraflı Telegramda: @iskomekci_az | - | 'CV-niz bəyənildi', 'həftədə 1500 AZN', 'depozit edin' gibi iş-tuzağı kalıpları sözlükte yok. |
| 9 | KAÇTI | 6 | 0.019 | is/az | Tapşırıqları yerinə yetir, pul qazan! Qeydiyyat pulsuzdur, qazancı kriptoya çıxarırıq. WhatsApp +994 55 000 00 00 | odul | 'CV-niz bəyənildi', 'həftədə 1500 AZN', 'depozit edin' gibi iş-tuzağı kalıpları sözlükte yok. |
| 10 | KAÇTI | 9 | 0.103 | bank/en | Kapital Bank security alert: your card has been blocked. Reply with the SMS code to unblock it. | - | İngilizce banka kalıbı ('card has been blocked', 'reply with the SMS code') sözlükte yok. |
| 11 | KAÇTI | 10 | 0.015 | relative/az | Salam dayı, mənəm, nömrəm dəyişib. Təcili borc lazımdır, 400 AZN at, axşam qaytararam. | aciliyet | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 12 | KAÇTI | 11 | 0.043 | is/az | Evdən işləyin! Gündə 150 AZN qazanc. Telegram-da yazın: t.me/isteklifiaz2024 | messenger_link | `gündə 150 AZN qazanc`, 'part-time', 'like basıb', 'tapşırığa 5 AZN' kalıpları sözlükte yok (yalnız 'gündə 50'); messenger_link tek başına 11 puan. |
| 13 | KAÇTI | 11 | 0.023 | is/az | Salam, part-time iş təklifi: videolara like basıb gündə 80-200 AZN qazan. WhatsApp: wa.me/994500000000 | messenger_link | `gündə 150 AZN qazanc`, 'part-time', 'like basıb', 'tapşırığa 5 AZN' kalıpları sözlükte yok (yalnız 'gündə 50'); messenger_link tek başına 11 puan. |
| 14 | KAÇTI | 11 | 0.027 | is/az | Online tapşırıqlar: məhsullara rəy yaz, hər tapşırığa 5 AZN. Əvvəlcə 50 AZN depozit edin, geri qaytarılacaq. | aciliyet | 'CV-niz bəyənildi', 'həftədə 1500 AZN', 'depozit edin' gibi iş-tuzağı kalıpları sözlükte yok. |
| 15 | KAÇTI | 11 | 0.038 | is/az | Ev xanimlari ucun is: telefonla evden 100 manat gunluk, Telegram qrupuna qosulun https://t.me/gunluk_qazanc_az | messenger_link | `gündə 150 AZN qazanc`, 'part-time', 'like basıb', 'tapşırığa 5 AZN' kalıpları sözlükte yok (yalnız 'gündə 50'); messenger_link tek başına 11 puan. |
| 16 | KAÇTI | 11 | 0.022 | relative/az | Ana, telefonum xarab olub, bu nömrə yenidir. Təcili 300 AZN lazımdır, bu nömrəyə pul at, sonra izah edəcəm. | aciliyet | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 17 | KAÇTI | 11 | 0.037 | relative/az | Anaaa telefonum xarab olub bu nomreye yaz. Tecili pul lazimdi 200 manat kart nomresine at. | aciliyet | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 18 | KAÇTI | 11 | 0.033 | is/ru | Работа на дому! Заработок 150 манат в день без опыта. Пишите в Telegram: t.me/rabota_az | messenger_link | `gündə 150 AZN qazanc`, 'part-time', 'like basıb', 'tapşırığa 5 AZN' kalıpları sözlükte yok (yalnız 'gündə 50'); messenger_link tek başına 11 puan. |
| 19 | KAÇTI | 11 | 0.034 | relative/ru | Мама, у меня сломался телефон, это новый номер. Срочно переведи 300 манат на эту карту. | aciliyet | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 20 | KAÇTI | 11 | 0.033 | otp/ru | Здравствуйте, мне случайно пришёл ваш код WhatsApp. Перешлите, пожалуйста, код из СМС. | veri_talebi | Sohbet tarzı kod avı ('kod gələcək, mənə at/yaz', 'səhvən ... kod') kalıbı yok; mevcut `kod ... deyin/göndərin` regex'i 'mənə at/yaz' ve sıfat sırasını kaçırıyor. |
| 21 | KAÇTI | 11 | 0.042 | is/en | Work from home, earn $150 per day with simple tasks. Contact us on Telegram: t.me/easyjobaz | messenger_link | `gündə 150 AZN qazanc`, 'part-time', 'like basıb', 'tapşırığa 5 AZN' kalıpları sözlükte yok (yalnız 'gündə 50'); messenger_link tek başına 11 puan. |
| 22 | KAÇTI | 12 | 0.141 | invest/az | Dövlət səhmləri paylanır, hər vətəndaşa investisiya imkanı. Qeydiyyat üçün şəxsiyyət vəsiqəsi şəkli və kart məlumatı göndərin. | is_teklifi | Yatırım tuzağı kalıpları ('ikiqat', '3 qat', 'risksiz', 'gəlir zəmanəti' dışında 'kripto' + 'yatırın') eksik; EN/RU için sözlük yok. |
| 23 | KAÇTI | 12 | 0.066 | relative/az | Ana mən qəza etmişəm, polis saxlayıb. Çox təcili 1000 manat lazımdı, kimsəyə deməyin, bu kartaya köçür. | aciliyet | Yakın taklidi ('telefonum xarab olub', 'yeni nömrə', 'nömrəm dəyişib') + para isteği sözlükte hiç yok; yalnız `aciliyet` (10) tetikleniyor. |
| 24 | KAÇTI | 15 | 0.171 | gov/az | Yol polisi: avtomobiliniz üçün 45 AZN cərimə. Ödəmək üçün keçid: https://yol-cerime.test/pay | unknown_link | Resmi kurum adı + ödeme/ceza/yardım isteği ve .gov.az olmayan linkin birleşimi (kurum-link uyuşmazlığı) puanlanmıyor; kurum markası listede olmayabilir (Yol polisi/DYP). |
| 25 | KAÇTI | 17 | 0.062 | charity/az | Şəhid ailələrinə kömək kampaniyası. Təcili ianə göndərin, kart nömrəsi: 5522 0000 0000 0000, link: iane-az.top | risky_tld, aciliyet | Hayır kampanyası/ianə + açık 16 haneli kart numarası kalıbı yok; 'ianə', 'əməliyyat üçün yardım' sözlükte yok. |
| 26 | KAÇTI | 18 | 0.213 | invest/az | Neft şirkətinin səhmləri satılır, risksiz 40% gəlir. Depozit qoyun: https://neft-invest.example/start | unknown_link | Yatırım tuzağı kalıpları ('ikiqat', '3 qat', 'risksiz', 'gəlir zəmanəti' dışında 'kripto' + 'yatırın') eksik; EN/RU için sözlük yok. |
| 27 | KAÇTI | 18 | 0.209 | charity/az | Xəstə körpənin həyatı sizin əlinizdədir! Əməliyyat üçün yardım edin: kart 4169 0000 0000 0000. Paylaşın! | - | Hayır kampanyası/ianə + açık 16 haneli kart numarası kalıbı yok; 'ianə', 'əməliyyat üçün yardım' sözlükte yok. |
| 28 | KAÇTI | 18 | 0.09 | charity/az | Uşaq xəstəxanası üçün ianə toplayırıq. Təcili köçürün, yoxsa uşaq ölə bilər: https://ianeet.example/pay | unknown_link, aciliyet | Hayır kampanyası/ianə + açık 16 haneli kart numarası kalıbı yok; 'ianə', 'əməliyyat üçün yardım' sözlükte yok. |
| 29 | KAÇTI | 21 | 0.038 | kargo/az | Bağlamanız sizi gözləyir! Rüsum 1.50 manat. Ödəniş üçün link: bit.ly/azp-4421 | shortener, kargo | bit.ly + 'rüsum 1.50 manat' tutar kalıbı tutar-önce sıralı olduğu için küçük-ödeme regex'ine uymuyor; shortener+kargo birleşmiyor. |
| 30 | ZAYIF | 31 | 0.046 | otp/az | Salam, Tap.az-da elanınıza baxdım. Telefonuza gələn doğrulama kodunu deyin, alıcı kimi təsdiq edim. | veri_talebi | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 31 | ZAYIF | 31 | 0.205 | odul/az | Tebrikler! Siz lotereyada 10000 AZN qazandiniz. Pulu almaq ucun komissiya 50 AZN odeyin. | odul | Sinyal yetersiz (ağırlık toplamı < 70). |
| 32 | ZAYIF | 34 | 0.147 | misc/az | Salam, mən kuryerəm. Sifarişinizi çatdırmaq üçün ünvan və kartın üzərindəki rəqəmləri göndərin. | veri_talebi | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 33 | ZAYIF | 40 | 0.177 | bank/az | Salam, Bank təhlükəsizlik xidmətindənəm. Kartınızdan 850 AZN köçürmə cəhdi olub, ləğv etmək üçün SMS kodu deyin. | veri_talebi | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 34 | ZAYIF | 41 | 0.024 | otp/az | Sabah qonaq gəlirəm. Bir şey xahiş edim: telefonuna 6 rəqəmli kod gələcək, mənə yaz. | hesap_ele_gecirme | Sohbet tarzı kod avı ('kod gələcək, mənə at/yaz', 'səhvən ... kod') kalıbı yok; mevcut `kod ... deyin/göndərin` regex'i 'mənə at/yaz' ve sıfat sırasını kaçırıyor. |
| 35 | ZAYIF | 45 | 0.318 | otp/az | Telegram hesabınız silinəcək! Bunun qarşısını almaq üçün SMS kodunu göndərin. | veri_talebi | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 36 | ZAYIF | 46 | 0.03 | invest/az | SOCAR səhmləri ilk dəfə satışda! Cəmi 100 AZN yatırın, 30 gündə 3 qat qazanın: socar-sehm.top | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 37 | ZAYIF | 46 | 0.026 | odul/en | Congratulations! You won 5000 AZN in the Azercell lottery. Claim your prize now: azercell-win.xyz/claim | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 38 | ZAYIF | 47 | 0.551 | kargo/az | Poçt: bağlama saxlanılıb, çatdırılma ünvanını yeniləyin https://pochta-az.top/x | risky_tld, kargo | Marka/alan zayıf sinyal; kargo+ödəniş kalıbı skoru 70'e taşımıyor. |
| 39 | ZAYIF | 47 | 0.083 | bank/az | Birbank: Girişdə şübhəli fəaliyyət. Kartın son 4 rəqəmini və SMS kodunu cavab yazın. | veri_talebi, brand_data_request | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 40 | ZAYIF | 47 | 0.083 | gov/az | Dövlət yardımı: hər ailəyə 400 manat. Müraciət üçün linkə keçin: dovlet-yardimi.xyz | risky_tld, yardim, combo | Resmi kurum adı + ödeme/ceza/yardım isteği ve .gov.az olmayan linkin birleşimi (kurum-link uyuşmazlığı) puanlanmıyor; kurum markası listede olmayabilir (Yol polisi/DYP). |
| 41 | ZAYIF | 48 | 0.112 | odul/az | Azercell: Təbriklər! Siz 5000 AZN uduşun qalibi oldunuz. Hədiyyənizi almaq üçün link: azercell-hediyye.top/qazan | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 42 | ZAYIF | 49 | 0.579 | odul/az | Təbrik edirik! Bu gün 3000 manat pul mükafatı qazandınız. Ödəniş üçün kart nömrəsini yazın. | - | Sinyal yetersiz (ağırlık toplamı < 70). |
| 43 | ZAYIF | 49 | 0.142 | gov/az | Sosial Müdafiə Fondu: Sizə birdəfəlik 500 AZN yardım təyin edilib. Pulu almaq üçün kart nömrəsi və SMS kodunu göndərin. | veri_talebi, brand_data_request | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 44 | ZAYIF | 49 | 0.13 | market/az | Salam, telefon hələ satılır? Kuryer göndərirəm, pulu bu linkdən alın: https://birmarket-odenis.xyz/p | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 45 | ZAYIF | 50 | 0.179 | bank/az | ABB mobile: tesdiq kodu lazimdir, kodu burda yazin ki hesabiniz blok olunmasin. | veri_talebi, brand_data_request | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 46 | ZAYIF | 51 | 0.198 | market/az | Salam, Tap.az-da elanınız hələ də aktualdır? Pulu kartınıza köçürmək üçün linkdən məlumatları doldurun: tapaz-odenis.top/kart | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 47 | ZAYIF | 51 | 0.19 | misc/az | Elektrik borcu: Azərişıq: borcunuz var, 2 saata ödəməsəniz cərimə. Ödəmək üçün: azerishiq-odenis.top | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 48 | ZAYIF | 52 | 0.078 | odul/az | Nar: bonus 100 GB internet hədiyyə! Kart məlumatını daxil edin və hədiyyəni alın: nar-bonus.xyz | brand_impersonation, risky_tld, odul | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 49 | ZAYIF | 57 | 0.388 | gov/az | myGov: sosial yardım hüququ qazandınız. 350 AZN almaq üçün kart məlumatlarını daxil edin: mygov-yardim.top | brand_impersonation, risky_tld | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 50 | ZAYIF | 57 | 0.083 | gov/az | DİN: haqqınızda cərimə var. 20 AZN ödəniş edin, əks halda 24 saat sonra məhkəməyə veriləcək: din-cerime.top | brand_impersonation, risky_tld, aciliyet | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 51 | ZAYIF | 57 | 0.665 | gov/az | Vergi Xidməti: borcunuz var. Təcili ödəyin, yoxsa hesabınız bloklanacaq. https://e-vergi-borc.top/odenis | risky_tld, aciliyet, brand_link_mismatch | Resmi kurum adı + ödeme/ceza/yardım isteği ve .gov.az olmayan linkin birleşimi (kurum-link uyuşmazlığı) puanlanmıyor; kurum markası listede olmayabilir (Yol polisi/DYP). |
| 52 | ZAYIF | 58 | 0.273 | bank/az | Unibank: hesabınıza giriş məhdudlaşdırıldı. Şifrənizi və kartın PIN kodunu göndərin. | veri_talebi, brand_data_request | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 53 | ZAYIF | 59 | 0.637 | bank/az | Kartiniz bloklandi. Tesdiqlemek ucun kart nomresi ve CVV gonderin. Kapital Bank tehlukesizlik. | veri_talebi, brand_data_request | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 54 | ZAYIF | 59 | 0.647 | market/az | Salam, maşın elanınızı gördüm, almaq istəyirəm. Təhlükəsiz ödəniş üçün bu linkə daxil olun: https://lalafo-payment.example/secure | brand_impersonation | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 55 | ZAYIF | 62 | 0.733 | kargo/az | Sifarişiniz anbarda gözləyir. Çatdırılma üçün 0.99 AZN ödəniş edin: https://kargo-azerbaycan.example/pay | unknown_link, veri_talebi, ml_high | Veri/kod talebi yakalandı (30-40) ama marka sözü/baskı yok ya da `combo` koşulu sağlanmadı; yalnız 'suspicious'. |
| 56 | ZAYIF | 65 | 0.153 | kargo/ru | Azerpost: ваша посылка задержана на таможне. Оплатите 2.50 AZN: https://azerpost-pay.top/ru | brand_impersonation, risky_tld, veri_talebi | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 57 | ZAYIF | 66 | 0.369 | bank/az | Leobank: Hesabınız 24 saat ərzində bağlanacaq. Şəxsiyyət təsdiqi üçün daxil olun leobank-verify.top | brand_impersonation, risky_tld, aciliyet | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 58 | ZAYIF | 66 | 0.189 | misc/az | Mobil nömrənizin balansı 0. Azercell: təcili şəxsi məlumatlarınızı yeniləyin, əks halda nömrə bağlanacaq: azercell-yenile.top | brand_impersonation, risky_tld, aciliyet | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |
| 59 | ZAYIF | 69 | 0.808 | bank/az | PAŞA Bank: kartınızın müddəti bitir. Məlumatlarınızı yeniləyin: https://pasha-bank-yenile.example/kart | brand_impersonation, ml_high | Marka taklidi alanı (+40) + risky_tld (+5) var ama içerik kategorisi (ödül/yardım/aciliyet) 'combo' tetiklemiyor; toplam 70'in altında kalıyor. Marka taklidi + herhangi bir tuzak kategorisi birleşmeli. |

### 2b. Yanlış alarmlar (meşru mesaj, skor >= 30)

| # | Skor | ml | Tür/dil | Mesaj | Bayraklar | Teşhis |
|---|---|---|---|---|---|---|
| 1 | 46 | 0.196 | bill/az | Azəriqaz: Qaz sayğacı göstəricisini 25-dək bildirin. https://azerigaz.az | brand_impersonation | SSS (yanlış alarm): URL markası `myGov` anahtarı `govaz` yüzünden her `*.gov.az` alanını (dyp.gov.az) taklit sayıyor / `azerigaz.az` gerçek sitesi Azəriqaz alan listesinde yok. |
| 2 | 43 | 0.087 | gov/az | DYP: Növbəti texniki baxış tarixiniz 15 dekabrdır. Ətraflı: https://dyp.gov.az | brand_impersonation | SSS (yanlış alarm): URL markası `myGov` anahtarı `govaz` yüzünden her `*.gov.az` alanını (dyp.gov.az) taklit sayıyor / `azerigaz.az` gerçek sitesi Azəriqaz alan listesinde yok. |
| 3 | 35 | 0.412 | univ/az | ADA Universiteti: Sabahkı mühazirə Zoom vasitəsilə keçiriləcək. Link e-poçtunuza göndərilib. | - | Bayrak yok; skoru yalnızca ML veriyor (ml=0.412, skor=ml*85). 'Link', 'Zoom', 'e-poçt' gibi sözcükler ML'i yukarı çekiyor. |
| 4 | 31 | 0.717 | post/az | Azərpoçt: Bağlamanız çatdırılma üçün kuryerə təhvil verilib. İzləmə: https://azerpost.az/track | kargo, official_link, ml_high | Resmi azerpost.az linki var (-30) ama `kuryerə təhvil verilib` benzeri ifade `kargo` (+5) ve ML (>=0.7) ile 30'a çıkıyor; ML tek başına yüksek. |

## 3. Öneriler (etki sırasına göre, motor kodu bu çalışmada değiştirilmedi)

Her önerinin meşru kümede (57 mesaj) yeni yanlış alarm üretmemesine dikkat edildi: meşru mesajların hiçbirinde "mənə at/yaz", ianə, 16 haneli açık kart numarası, "telefonum xarab olub", "ikiqat", "depozit", "gündə N AZN qazan" gibi ifade yok; meşru işlem bildirimleri kartı maskeli (4169***1234) yazıyor.

1. **Marka taklidi alanı + herhangi bir tuzak sinyali = high (en büyük kazanç, ~15 mesaj).** `analyze.js`'de `brand_impersonation` (40) + `risky_tld` (5) tek başına 45-57 veriyor; ödül, yardım, aciliyet, ceza, "kart", "ödə" kategorilerinden biri varken skor 70'e çıkmıyor (örn. Azercell/Nar/Bakcell ödül, myGov, DİN, Vergi, Leobank, Azərişıq, Tap.az/Birmarket alıcı linkleri). Kural: \`brand_impersonation\` bayrağı varsa ve herhangi bir kategori (odul, yardim, aciliyet, veri_talebi, kargo, is_teklifi) > 0 ise \`combo\` (+25) ekle. Mevcut meşru kümede brand_impersonation yalnız iki hatalı örnekte (madde 4) çıktığından yeni yanlış alarm yok.
2. **Yakın taklidi / "yeni nömrə" kategorisi (7 mesajın 7'si kaçtı, ru/en dahil; skor 2-11).** Yeni kalıp (regex, katlanmış metin): iki gruptan biri + para isteği. Grup A: \`telefonum xarab\`, \`telefon suya dusdu\`, \`yeni nomre\`, \`nomrem deyisib\`, \`yeni nomreden yaz\`; grup B: \`(pul|\\d+\\s?(azn|manat)).{0,40}(at|kocur|gonder|lazim)\` ya da \`pul at\`. İkisi birlikte -> kategori \`veri_talebi\` ağırlık 35 (veya yeni \`yakin_taklidi\` 40). Sadece A tek başına zayıf (10) bırakılmalı: "Telefonumu təmirə vermişəm" meşru örneği A'ya uymuyor. RU: \`новый номер\` + \`переведи\`; EN: \`new number\` + \`send ... AZN\`.
3. **Sohbet tarzı kod avı (otp: 7 mesajın 3'ü safe, 3'ü zayıf).** \`kod\` kalıp regex'ine ters sıra ekle: \`\\bkod[a-z]*\\b.{0,40}\\b(mene|bize)\\s+(at|yaz|gonder|de)\\b\` ve \`seh?ven\\b.{0,40}\\bkod\`, \`whatsapp kodu\`/\`telegram.*kod\` + "göndərin/mənə". Ağırlık 40 (hesap_ele_gecirme). Meşru OTP mesajlarında "kodu heç kimə deməyin" var; kalıp "mənə/bizə" gerektirdiği için tetiklenmez. EN: \`send me the .{0,15}code\`, RU: \`перешлите.{0,20}код\` (şu an ru örneği yalnız 11 puan).
4. **Yanlış alarm düzeltmeleri (4 meşru mesaj):** (a) \`myGov\` marka anahtarı \`govaz\` her \`*.gov.az\` alanını (dyp.gov.az) "taklit" sayıyor; \`govaz\` anahtarını çıkar ya da alt-alan/alan \`.gov.az\` ile bitiyorsa brand_impersonation uygulama. Bunun yan etkisi: sahte gov-benzeri alanlar (\`mygov-yardim.top\`) yine \`mygov\` anahtarıyla yakalanır. (b) \`azerigaz.az\` (Azəriqaz'ın gerçek sitesi) \`BRANDS\` Azəriqaz.domains ve data/allowlist.json'a eklenmeli. (c) \`dyp.gov.az\` allowlist'e eklenmeli ve "Yol Polisi/DYP" markası olarak tanımlanmalı (bu sayede "Yol polisi ... cərimə ... yol-cerime.test" brand_link_mismatch ile yakalanır). (d) 'Azərpoçt ... kuryerə təhvil verilib' resmi-link mesajı 31 alıyor: \`kargo\` ağırlığı 5 + ML 0.7; resmi link (-30) varken ML katkısını \`p*30\` yerine yarıya indirmek ya da \`official_link\` ağırlığını -40 yapmak yeterli (ada Zoom mesajı da ML'den 35 alıyor; ML'e bayraksız mesajda 85 yerine ~60 üst sınır koymak 30 eşiğinin altına indirir).
5. **İş / Telegram-WhatsApp görev tuzağı (8 mesajın 8'i high değil, 6'sı safe; skor 5-11).** Sözlüğe (\`is_teklifi\`, ağırlık 30) ekle: \`gündə \\d+ azn\`/\`gunde \\d+ manat\` kalıbı (regex: \`gunde\\s+\\d{2,4}\\s*(azn|manat)\` ve \`heftede\\s+\\d{3,5}\`), \`part-time\`, \`like bas\`, \`tapşırığa \\d+\`, \`cv-niz bəyənildi\`, \`evden is\`, \`depozit edin\`, \`qazancı kriptoya\`, \`ev xanımları\`. Ayrıca \`messenger_link\` (t.me / wa.me) + \`is_teklifi >= 25\` zaten \`lure\` + messengerLink üzerinden \`combo\` verir; asıl eksik kalıplar. EN: \`earn \\$?\\d+ per day\`, \`work from home\`; RU: \`работа на дому\`, \`заработок .* в день\`. Meşru kümede bu ifadeler yok (insan sohbetinde "gündə" geçse de yanında tutar+qazan yok).
6. **Yatırım / kripto (7 mesajın 5'i safe).** \`is_teklifi\` veya yeni \`yatirim\` kategorisine: \`ikiqat\`, \`\\d qat qazan\`, \`risksiz\`, \`zəmanət\` (tek başına "zəmanət" garanti sözleşmeleri için riskli: "gəlir zəmanəti" zaten var, "gəlir/qazanc zəmanəti" ile sınırla), \`kripto.{0,30}(yatir|qoy)\`, \`bitcoin ile gunde\`, \`səhmləri .{0,20}satış\` + \`yatırın\`, EN \`guaranteed returns\`, \`deposit .* get\`, RU \`гарантия дохода\`, \`вложи\`. "investisiya" tek başına 5 kalmalı (meşru banka reklamları için).
7. **Hayır/ianə + açık kart numarası (3/3 safe).** Mesajda 16 haneli (4-4-4-4 boşluklu veya bitişik) açık kart numarası + (\`ianə\`, \`yardım edin\`, \`köçürün\`, \`pul at\`) -> \`veri_talebi\`-benzeri 30. Meşru işlem bildirimleri kartı maskeli yazdığı (4169***1234) için çakışma yok. Ayrıca sözlüğe \`ianə\`, \`əməliyyat üçün yardım\`, \`həyatı sizin əlinizdədir\` (ağırlık 20, tek başına şüpheli, kart no ile birlikte high).
8. **Kargo: tutar kalıbı ve shortener (kargo 6/10 high).** Mevcut tutar regex'i "ödəyin ... 1.20 AZN" sırasını yakalıyor, "Rüsum 1.50 manat. Ödəniş üçün link" gibi tutar-önce sırayı yakalamıyor: \`(rusum|gomruk|catdirilma|catdirilma haqqi)[^.\\n]{0,25}\\d{1,2}[.,]\\d{2}\\s?(azn|manat)\` ekle (15). \`kargo\` + (\`shortener\` | \`unknown_link\` | marka-uyumsuz) -> \`combo\` +25. Ayrıca \`kargo\` ağırlığını 5'ten 10'a çıkarmak ve "gömrük" kelimesini \`kargo\` kategorisine eklemek ("Poçt:" tek başına marka sayılmadığı için 'pochta-az.top' hâlâ 47'de).
9. **İngilizce/Rusça banka kalıpları.** "your card has been blocked" + "reply with the SMS code" (EN, skor 9) ve "Назовите CVV" gibi ifadeler: sözlüğe \`sms code\`/\`cvv\` + \`reply\`/\`send\`/\`назовите\`/\`сообщите\` kalıpları (veri_talebi 30). Rusça sözlük kapsamı kısmi (banka+kod yakalandı), EN neredeyse sıfır.
10. **Banka/kuruma "kart ... CVV/PIN/SMS kodu göndərin" tek başına yeterli olmalı.** Şu an "Unibank ... PIN kodunu göndərin", "Kartiniz bloklandi ... CVV gonderin", "Birbank ... SMS kodunu cavab yazın" 47-59'da kalıyor: marka sözü + \`veri_talebi\` >= 30 + hiçbir link yok -> \`brand_data_request\` (10) var ama \`combo\` yok. Koşul: \`strongData && brand\` (link olmasa da) ise \`combo\` ekle; resmi link yoksa ve meşru "kodu heç kimə deməyin" işareti (\`mesru_isaret\`) yoksa. Bu, meşru OTP'lerin (mesru_isaret içeren) etkilenmemesi için \`mesru_isaret\` yokluğu şartına bağlanmalı; meşru kümedeki 8 OTP mesajında \`mesru_isaret\` mevcut ve veri_talebi yok.

### Notlar
- ".test" / ".example" alanları yalnız \`unknown_link\` (+5) alıyor; gerçek dünyada kullanılmayacağı için sorun sayılmadı, ama \`bit.ly\`-benzeri kısaltıcı ve \`.top/.xyz\` zayıf ağırlıkları (5) çok düşük: marka sözü + .top, kendi başına en az 25 olmalı (madde 1 ile birlikte).
- Meşru kümede hiç \`high\` yok; önerilen 1 ve 10. maddeler \`combo\`'yu genişlettiği için yayından önce \`node tools/stress.mjs\`, \`node tools/attack.mjs\` ve \`node tools/test.mjs\` yeniden çalıştırılmalı.
- Küme küçüktür (142); "tam çözüm" iddiası taşımaz, regresyon seti olarak büyütülmelidir.
