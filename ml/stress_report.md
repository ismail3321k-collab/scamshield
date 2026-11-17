# ScamShield: qiymətləndirmə mühərrikinin stress testi

Tarix: 17.11.2026, axşam versiyası. Dəst: `ml/stress_set.json` — 142 mesaj (85 fırıldaq, 57 normal; 115-i Azərbaycan, 15-i rus, 12-si ingilis dilində; bir hissəsi ə, ş, ı hərfləri olmadan yazılıb). İşə salmaq: `node tools/stress.mjs` (dil modeli söndürülüb: yalnız qaydalar və öz modelimiz). Linklərdəki saytlar uydurmadır (`.top`, `.xyz`, `.test`, `.example`).

> Bu dəsti komanda özü yazıb, ona görə müstəqil ölçü deyil. Müstəqil ölçü — modelin heç görmədiyi 905 SMS (`tools/eval.mjs` → `data/metrics.json`): dəqiqlik 80,2%, tutma 85,4%, yanlış həyəcan 3,3%.

## 1. Ümumi nəticə

| Ölçü | Nəticə |
|---|---|
| Fırıldaq mesajları | 85 |
| «Çox təhlükəli» (bal ≥ 70) | 50 (58,8%) |
| «Şübhəli» (bal 30–69) | 30 |
| «Təhlükəsiz» deyib buraxdıqlarımız | 5 (5,9%) |
| **Tutma (çox təhlükəli + şübhəli)** | **94,1%** |
| Normal mesajlar | 57 |
| «Təhlükəsiz» | 56 |
| «Şübhəli» (yanlış həyəcan) | 1 |
| «Çox təhlükəli» (yanlış həyəcan) | 0 |
| **Yanlış həyəcan (şübhəli + çox təhlükəli)** | **1,8%** |

## 2. Növlərə görə: fırıldaq mesajları

| Növ | Say | Çox təhlükəli | Şübhəli | Buraxılıb |
|---|---|---|---|---|
| Bank adından | 15 | 11 | 4 | 0 |
| Bağlama / kuryer | 10 | 7 | 2 | 1 |
| Dövlət adından | 9 | 4 | 4 | 1 |
| Hədiyyə / uduş | 8 | 5 | 3 | 0 |
| İş təklifi | 8 | 5 | 3 | 0 |
| İnvestisiya | 7 | 2 | 4 | 1 |
| Elan saytları (Tap.az və s.) | 7 | 4 | 3 | 0 |
| Kod tələbi | 7 | 3 | 3 | 1 |
| Yaxın adından | 7 | 4 | 2 | 1 |
| İanə | 3 | 2 | 1 | 0 |
| Digər | 4 | 3 | 1 | 0 |

## 3. Normal mesajlar

12 növün hamısında (bank kodu, ödəniş, bağlama, operator, mağaza, növbə, dost, universitet, kommunal, dövlət və s.) yalnız 1 mesaj «şübhəli» çıxıb: Azəriqazın sayğac göstəricisi xatırlatması (`azerigaz.az` rəsmi domenlər siyahımızda yox idi). «Çox təhlükəli» yanlış həyəcan yoxdur.

## 4. Dillərə görə

| Dil | Fırıldaq: çox təhlükəli / şübhəli / buraxılıb | Normal: təhlükəsiz / şübhəli / çox təhlükəli |
|---|---|---|
| Azərbaycan | 36 / 25 / 4 | 49 / 1 / 0 |
| Rus | 8 / 1 / 1 | 5 / 0 / 0 |
| İngilis | 6 / 4 / 0 | 2 / 0 / 0 |

## 5. İlk versiya ilə müqayisə

| Ölçü | İlk versiya | İndi |
|---|---|---|
| Çox təhlükəli | 26 (30,6%) | 50 (58,8%) |
| Çox təhlükəli + şübhəli | 65,9% | 94,1% |
| Buraxılan fırıldaq | 29 | 5 |
| Normal mesajda yanlış həyəcan | 7,0% | 1,8% |

İlk versiya iş təklifi, yaxın adından pul istəmə və ianə mesajlarını demək olar ki, görmürdü. Sonradan bu ssenarilər üçün qaydalar əlavə olundu: yaxın adından yeni nömrə, iş / Telegram, investisiya, ianə, marka adından pul və ya hədiyyə vədi, kart bloku və yad nömrəyə zəng çağırışı, polis / məhkəmə hədəsi, CVV və kod tələbi.

## 6. Hələ buraxdıqlarımız

1. «Dövlət səhmləri paylanır»: şəxsiyyət vəsiqəsi istəyən, linksiz investisiya tələsi.
2. Yol polisi adından cərimə və saxta ödəniş linki.
3. Rus dilində «kodunuz səhvən mənə gəldi» (WhatsApp) mesajı.
4. «Ana, qəza etmişəm, polis saxlayıb, təcili 1000 manat lazımdır» — yaxın adından, «kimsəyə deməyin» ilə.
5. Qısaldılmış linkli (bit.ly) bağlama rüsumu mesajı.

Bunlar növbəti qayda dəstinin hədəfidir. Real istifadəçi bildirişləri toplandıqca modeli yerli məlumatla yenidən öyrətməyi planlaşdırırıq.
