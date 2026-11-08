#!/usr/bin/env node
// 用题库为一次考试准备答案：questions.json -> answers.json（命中部分）+ unmatched.json（待人工/模型补答）
// 用法: node scripts/prepare_answers.js <tag>
const fs = require("fs");
const path = require("path");
const { loadBank, matchAnswer, pickOption } = require("./lib_match");

const ROOT = path.join(__dirname, "..");
const TAG = process.argv[2] || "run1";
const DIR = path.join(ROOT, "runs", TAG);
const { B } = loadBank(path.join(ROOT, "data", "bank.json"));
const qs = JSON.parse(fs.readFileSync(path.join(DIR, "questions.json"), "utf8"));

const answers = {}, matched = [], unmatched = [];
for (const q of qs) {
  const m = matchAnswer(B, q.title);
  if (!m) { unmatched.push(q); continue; }
  const opt = pickOption(q.options, m.answer_text);
  if (!opt) { unmatched.push({ ...q, bank_answer: m.answer_text, bank_score: m.score }); continue; }
  answers[q.idx] = opt.id;
  matched.push({ idx: q.idx, title: q.title, answer: m.answer_text, option: opt.text });
}
fs.writeFileSync(path.join(DIR, "answers.json"), JSON.stringify(answers, null, 1), "utf8");
fs.writeFileSync(path.join(DIR, "unmatched.json"), JSON.stringify(unmatched, null, 1), "utf8");
console.log(JSON.stringify({ total: qs.length, matched: matched.length, unmatched: unmatched.length }, null, 1));
unmatched.forEach(u => {
  console.log(`\n[${u.idx}] ${u.title}`);
  (u.options || []).forEach(o => console.log(`    ${o.id} = ${o.text}`));
  if (u.bank_answer) console.log(`    (题库参考: ${u.bank_answer})`);
});
