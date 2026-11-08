#!/usr/bin/env node
// 从原始题库文本重建题库（新增 docx 时用）
// 用法:
//   node scripts/build_bank.js                # 输出 data/bank.built.json
//   node scripts/build_bank.js --force        # 覆盖 data/bank.json（先备份 .bak）
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW = path.join(ROOT, "data", "raw", "大语题库.txt");
const raw = fs.readFileSync(RAW, "utf8").replace(/\u00a0/g, " ").replace(/[\u200b-\u200f\ufeff]/g, "").replace(/\r/g, "");

function clean(s) { return String(s || "").replace(/\s+/g, " ").replace(/^[\s:：.、．]+/, "").replace(/[\s:：.、．]+$/, "").trim(); }
function norm(s) { return clean(s).replace(/[\s，。；：！？、“”‘’（）()《》〈〉【】\[\]{}·—\-_,.;:!?"'`~…\*]/g, "").toLowerCase(); }

function parseOptions(body) {
  const marks = []; const re = /([A-D])\s*[.、．:：]\s*/g; let mm;
  while ((mm = re.exec(body)) !== null) marks.push({ L: mm[1], i: mm.index, len: mm[0].length });
  const last = {}; for (const k of marks) last[k.L] = k;
  if (!(last.A && last.B && last.C && last.D)) return null;
  if (!(last.A.i < last.B.i && last.B.i < last.C.i && last.C.i < last.D.i)) return null;
  const order = [last.A, last.B, last.C, last.D]; const opts = {};
  for (let j = 0; j < 4; j++) {
    const st = order[j].i + order[j].len, en = j < 3 ? order[j + 1].i : body.length;
    opts[order[j].L] = clean(body.slice(st, en));
  }
  return { a: last.A.i, opts };
}

const bank = [];
const reAns = /(\d{1,4})\s*[.、．]\s*([\s\S]*?)参考答案\s*[:：]\s*([A-Da-d])(?![A-Za-z])/g;
let m;
while ((m = reAns.exec(raw)) !== null) {
  const no = parseInt(m[1], 10), body = m[2], answer = m[3].toUpperCase();
  const opt = parseOptions(body);
  if (!opt) continue;
  bank.push({ qtype: "mcq", no, stem: clean(body.slice(0, opt.a)), options: opt.opts, answer, answer_text: opt.opts[answer] || null, source: "docx" });
}
let rest = raw.replace(reAns, f => " ".repeat(f.length));
for (const line of rest.split(/\n/)) {
  const t = clean(line);
  if (!t) continue;
  const mm = t.match(/^(\d{1,4})\s*[.、．]?\s*(.{6,})$/);
  if (!mm) continue;
  const body = mm[2].trim();
  if (/参考答案/.test(body)) continue;
  if (/^(第\s*\d+\s*页|\d{1,2}\s*\/\s*\d{1,2})$/.test(body)) continue;
  const opt = parseOptions(body);
  if (opt) { bank.push({ qtype: "mcq", no: parseInt(mm[1], 10), stem: clean(body.slice(0, opt.a)), options: opt.opts, answer: null, answer_text: null, source: "docx-noanswer" }); continue; }
  let stem = body, ans = null;
  const qm = body.lastIndexOf("？");
  const ph = [...body.matchAll(/[（(]\s*[)）]/g)];
  const bm = ph.length ? ph[ph.length - 1].index + ph[ph.length - 1][0].length - 1 : -1;
  if (qm >= 0 && qm < body.length - 1) { stem = body.slice(0, qm + 1); ans = clean(body.slice(qm + 1)); }
  else if (bm >= 0) { stem = body.slice(0, bm + 1); ans = clean(body.slice(bm + 1)); if (!ans) ans = null; }
  bank.push({ qtype: "inline", no: parseInt(mm[1], 10), stem: clean(stem), options: null, answer: null, answer_text: ans, source: "docx" });
}

// 去重
const groups = new Map();
for (const e of bank) {
  const k = norm(e.stem);
  if (!k || k.length < 4) continue;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(e);
}
const dedup = [];
for (const [, g] of groups) {
  g.sort((a, b) => {
    const sc = x => (x.qtype === "mcq" && x.answer ? 4 : 0) + (x.answer_text ? 2 : 0) + (x.qtype === "mcq" ? 1 : 0);
    return sc(b) - sc(a);
  });
  dedup.push({ ...g[0], dupCount: g.length, altAnswers: [...new Set(g.map(x => x.answer_text).filter(Boolean))] });
}

const target = process.argv.includes("--force") ? path.join(ROOT, "data", "bank.json") : path.join(ROOT, "data", "bank.built.json");
if (target.endsWith("bank.json") && fs.existsSync(target)) fs.copyFileSync(target, target + ".bak");
fs.writeFileSync(target, JSON.stringify(dedup, null, 1), "utf8");
console.log(JSON.stringify({ entries: dedup.length, wrote: path.relative(ROOT, target) }, null, 1));
