// TF-IDF (hash'li karakter 3-5 gram) + lojistik regresyon çıkarımı. ml/train.py ile birebir.
import defaultModel from "../data/model.json" with { type: "json" };
import { normalizeForModel } from "./text.js";

let model = defaultModel;
// Yalnız değerlendirme betiği için: null → model kapalı (yalnız kurallar)
export function setModel(m) { model = m; }

const enc = new TextEncoder();

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (const b of enc.encode(str)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function predictScam(text) {
  if (!model) return 0;
  const chars = Array.from(normalizeForModel((text || "").slice(0, 1200)));
  const counts = new Map();
  for (const n of model.ngrams) {
    for (let i = 0; i + n <= chars.length; i++) {
      const k = fnv1a(chars.slice(i, i + n).join("")) % model.buckets;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  let norm = 0;
  const items = [];
  for (const [k, v] of counts) {
    const x = (1 + Math.log(v)) * model.idf[k];
    items.push([k, x]);
    norm += x * x;
  }
  norm = Math.sqrt(norm) || 1;
  let z = model.bias;
  for (const [k, x] of items) z += (model.w[k] * x) / norm;
  return 1 / (1 + Math.exp(-z));
}

export const modelMetrics = { holdout: defaultModel.metrics_holdout, trainSize: defaultModel.train_size, positives: defaultModel.positives };
