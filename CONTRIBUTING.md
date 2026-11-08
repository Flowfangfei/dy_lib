# 贡献指南

欢迎补充新题、修正错误答案。仓库：<https://github.com/Zhen-WushuiLingchun/dy_lib.git>

## 方式一：手工补充（无需 cookie）

直接编辑 `data/bank.json`，按以下格式追加：

```json
{
  "qtype": "mcq",
  "no": 0,
  "stem": "题干（不含 A/B/C/D）",
  "options": {
    "A": "选项A文本",
    "B": "选项B文本",
    "C": "选项C文本",
    "D": "选项D文本"
  },
  "answer": "C",
  "answer_text": "选项C文本",
  "verified": true
}
```

要求：

- `stem` 用题干原文，不要带选项。
- `answer_text` 必填，且与某个选项文本一致（允许标点差异）。
- `answer` 只是辅助字段；选项顺序会变，以 `answer_text` 为准。
- 同一题干请勿重复添加；已有条目请更新而不是新增。
- 改完 `bank.json` 后，同步更新 `data/bank.csv`（可运行一次 `node scripts/merge_exam.js <tag>` 或自行导出）。

## 方式二：跑一轮考试自动入库（需要账号 cookie）

```bash
export EXAM_COOKIE="ASP.NET_SessionId 的值"
node scripts/exam_runner.js run1
node scripts/prepare_answers.js run1
# 补答 runs/run1/unmatched.json 后写入 runs/run1/answers.ready.json
node scripts/parse_result.js run1
node scripts/merge_exam.js run1
```

`merge_exam.js` 会：

- 按题干匹配已有条目并更新答案（标记 `verified: true`）；
- 未匹配的作为新条目追加；
- 与题库旧答案不一致时写入 `data/conflicts_exam.md`。

## 提交

```bash
git checkout -b add-questions-YYYYMMDD
git add data/ scripts/ *.md
git commit -m "add: 新增 N 题答案"
git push -u origin add-questions-YYYYMMDD
```

然后在 GitHub 上开 Pull Request。

## 禁止事项

- 不要提交 `runs/`、`.env`、`*.cookie` 或任何形式的会话凭据。
- 不要提交包含个人信息的截图或日志。
- 不要批量提交未经核对的答案；不确定的题请标注或先不入库。
