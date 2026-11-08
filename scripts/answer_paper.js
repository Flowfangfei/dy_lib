#!/usr/bin/env node
// 题库查询 CLI：给一份题目（可带选项）→ 输出匹配到的答案
// 用法:
//   node scripts/answer_paper.js examples/questions.sample.json
// 输入格式:
//   [{ "title": "题干", "options": [{"id":"1","text":"A. ..."}, ...] }]
//   也支持 ["题干1", "题干2"]
const fs = require("fs");
const path = require("path");
const { loadBank, matchAnswer, pickOption } = require("./lib_match");

const ROOT = path.join(__dirname, "..");
const { B } = loadBank(path.join(ROOT, "data", "bank.json"));
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = [];
for (const item of input) {
  const title = typeof item === "string" ? item : item.title;
  const opts = typeof item === "string" ? null : (item.options || null);
  const m = matchAnswer(B, title);
  let option = null;
  if (m && opts) option = pickOption(opts, m.answer_text);
  out.push({
    q: title,
    matched: m ? m.matched : null,
    score: m ? m.score : 0,
    answer_text: m ? m.answer_text : null,
    option_id: option ? option.id : null,
    option_text: option ? option.text : null,
  });
}
console.log(JSON.stringify(out, null, 1));
