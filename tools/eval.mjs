// AZ-SC test bölümünde (modelin görmediği %20) tam akışın ölçümü. LLM'siz.
// Kullanım: node tools/eval.mjs  → data/metrics.json
import { readFileSync, writeFileSync } from "node:fs";
import { analyze } from "../src/analyze.js";
import { setModel } from "../src/model.js";

const holdout = JSON.parse(readFileSync("ml/holdout.json", "utf8"));
const evalModel = JSON.parse(readFileSync("data/model_eval.json", "utf8"));

async function measure(name, model, threshold) {
  setModel(model);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const { text, label } of holdout) {
    const r = await analyze(text, { useLlm: false });
    const pred = r.score >= threshold ? 1 : 0;
    if (pred && label) tp++; else if (pred && !label) fp++; else if (!pred && label) fn++; else tn++;
  }
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1), fpr = fp / (fp + tn || 1);
  const out = { n: holdout.length, threshold, precision: +precision.toFixed(4), recall: +recall.toFixed(4), fpr: +fpr.toFixed(4), tp, fp, fn, tn };
  console.log(name.padEnd(28), JSON.stringify(out));
  return out;
}

const pipeline50 = await measure("ScamShield (bal >= 50)", evalModel, 50);
const pipeline70 = await measure("ScamShield (bal >= 70)", evalModel, 70);
const rules50 = await measure("Yalnız qaydalar (bal >= 50)", null, 50);
const rules30 = await measure("Yalnız qaydalar (bal >= 30)", null, 30);
writeFileSync("data/metrics.json", JSON.stringify({ pipeline: pipeline50, pipeline_high: pipeline70, pipeline_rules: rules50, rules30 }, null, 1));
console.log("data/metrics.json yazıldı");
