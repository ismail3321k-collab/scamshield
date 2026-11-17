"""ScamShield ML modeli: simvol 3-5 qram (hash) TF-IDF + logistik reqressiya.

Kullanım: python -I train.py <dataset.csv> <çıktı model.json> [<ek_test.csv>]
- Etiket: smishing = 1, ham + spam (reklam) = 0.
- Özellikler JS tarafında birebir aynı hesaplanır (src/model.js): normalize → n-gram → FNV-1a 32 bit → mod BUCKETS.
"""
import csv
import json
import math
import random
import sys
import unicodedata
from collections import Counter

import numpy as np
from scipy import sparse
from scipy.optimize import minimize

BUCKETS = 1 << 15
NGRAMS = (3, 4, 5)
C_REG = 4.0  # L2 ters gücü
FOLD = str.maketrans({"ə": "e", "ı": "i", "ö": "o", "ü": "u", "ğ": "g", "ş": "s", "ç": "c", "â": "a", "î": "i", "û": "u"})


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = t.translate(FOLD)
    t = t.replace("sh", "s").replace("ch", "c")
    out = []
    for ch in t:
        if ch.isdigit():
            if not out or out[-1] != "0":
                out.append("0")
        elif ch.isspace():
            if not out or out[-1] != " ":
                out.append(" ")
        else:
            out.append(ch)
    return " " + "".join(out).strip() + " "


def fnv1a(s: str) -> int:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def features(text: str) -> Counter:
    t = normalize(text)
    c = Counter()
    for n in NGRAMS:
        for i in range(len(t) - n + 1):
            c[fnv1a(t[i:i + n]) % BUCKETS] += 1
    return c


def load(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    seen, data = set(), []
    for r in rows:
        msg = (r.get("message") or "").strip()
        if not msg or msg in seen:
            continue
        seen.add(msg)
        data.append((msg, 1 if r.get("label") == "smishing" else 0))
    return data


def matrix(texts, idf=None):
    feats = [features(t) for t in texts]
    if idf is None:
        df = np.zeros(BUCKETS)
        for f in feats:
            for k in f:
                df[k] += 1
        idf = np.log((1 + len(feats)) / (1 + df)) + 1.0
    rows, cols, vals = [], [], []
    for i, f in enumerate(feats):
        items = [(k, (1 + math.log(v)) * idf[k]) for k, v in f.items()]
        norm = math.sqrt(sum(x * x for _, x in items)) or 1.0
        for k, x in items:
            rows.append(i)
            cols.append(k)
            vals.append(x / norm)
    X = sparse.csr_matrix((vals, (rows, cols)), shape=(len(texts), BUCKETS))
    return X, idf


def fit(X, y):
    pos = y.sum()
    w_pos = len(y) / (2 * pos)
    w_neg = len(y) / (2 * (len(y) - pos))
    sw = np.where(y == 1, w_pos, w_neg)

    def loss(theta):
        w, b = theta[:-1], theta[-1]
        z = X @ w + b
        p = 1 / (1 + np.exp(-z))
        eps = 1e-12
        l = -np.sum(sw * (y * np.log(p + eps) + (1 - y) * np.log(1 - p + eps))) + 0.5 / C_REG * w @ w
        g = sw * (p - y)
        gw = X.T @ g + w / C_REG
        return l, np.append(gw, g.sum())

    res = minimize(loss, np.zeros(BUCKETS + 1), jac=True, method="L-BFGS-B", options={"maxiter": 400})
    return res.x[:-1], res.x[-1]


def report(name, y, p, thr=0.5):
    pred = (p >= thr).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum()); tn = int(((pred == 0) & (y == 0)).sum())
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    fpr = fp / (fp + tn) if fp + tn else 0
    print(f"{name}: n={len(y)} precision={prec:.3f} recall={rec:.3f} FPR={fpr:.3f}  TP={tp} FP={fp} FN={fn} TN={tn}")
    return {"n": len(y), "precision": round(prec, 4), "recall": round(rec, 4), "fpr": round(fpr, 4),
            "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    data = load(sys.argv[1])
    random.Random(42).shuffle(data)
    pos = [d for d in data if d[1] == 1]
    neg = [d for d in data if d[1] == 0]
    cut_p, cut_n = int(len(pos) * 0.8), int(len(neg) * 0.8)
    train = pos[:cut_p] + neg[:cut_n]
    test = pos[cut_p:] + neg[cut_n:]

    Xtr, idf = matrix([t for t, _ in train])
    ytr = np.array([l for _, l in train], dtype=float)
    w, b = fit(Xtr, ytr)
    Xte, _ = matrix([t for t, _ in test], idf)
    yte = np.array([l for _, l in test], dtype=float)
    pte = 1 / (1 + np.exp(-(Xte @ w + b)))
    holdout = report("AZ-SC test (%20)", yte, pte)
    out_dir = sys.argv[2].rsplit("/", 1)[0] if "/" in sys.argv[2] else "."
    json.dump({"buckets": BUCKETS, "ngrams": list(NGRAMS), "bias": round(float(b), 5),
               "idf": [round(float(x), 4) for x in idf], "w": [round(float(x), 5) for x in w]},
              open(f"{out_dir}/model_eval.json", "w", encoding="utf-8"), separators=(",", ":"))
    json.dump([{"text": t, "label": l} for t, l in test], open("ml/holdout.json", "w", encoding="utf-8"), ensure_ascii=False)

    # Son model: tüm veriyle yeniden eğit
    Xall, idf = matrix([t for t, _ in data])
    yall = np.array([l for _, l in data], dtype=float)
    w, b = fit(Xall, yall)

    model = {
        "buckets": BUCKETS, "ngrams": list(NGRAMS), "bias": round(float(b), 5),
        "idf": [round(float(x), 4) for x in idf],
        "w": [round(float(x), 5) for x in w],
        "metrics_holdout": holdout,
        "train_size": len(data), "positives": len(pos),
    }
    json.dump(model, open(sys.argv[2], "w", encoding="utf-8"), separators=(",", ":"))
    print("model yazildi:", sys.argv[2])

    probe = [
        "Azərpoçt: Bağlamanız müvəqqəti saxlanılıb. Ünvanınızı 24 saat ərzində yeniləyin, əks halda geri qaytarılacaq: https://azerpost.389159.com.az/unvan",
        "Kapital Bank: Birbank-a giriş kodu: 482913. Kodu heç kimə deməyin.",
        "Salam, sabah dərsə gəlirsən?",
    ]
    Xp, _ = matrix(probe, idf)
    for t, p in zip(probe, 1 / (1 + np.exp(-(Xp @ w + b)))):
        print(f"{p:.3f}  {t[:70]}")


if __name__ == "__main__":
    main()
