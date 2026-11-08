// 题库匹配核心库
const fs = require("fs");
const path = require("path");

function unesc(s) {
  return String(s || "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function clean(s) {
  return unesc(s).replace(/\s+/g, " ").replace(/^[\s:：.、．]+/, "").replace(/[\s:：.、．]+$/, "").trim();
}
function stripPh(s) {
  return s.replace(/[（(]\s*[)）]/g, "").replace(/\s+/g, " ").trim();
}
function norm(s) {
  return stripPh(clean(s)).replace(/[\s，。；：！？、“”‘’（）()《》〈〉【】\[\]{}·—\-_,.;:!?"'`~…\*]/g, "").toLowerCase();
}
function dice(a, b) {
  if (!a || !b) return 0;
  const bg = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = bg(a), B = bg(b); let it = 0, tot = 0;
  for (const [k, v] of A) { tot += v; if (B.has(k)) it += Math.min(v, B.get(k)); }
  for (const [, v] of B) tot += v;
  return tot ? (2 * it) / tot : 0;
}

function loadBank(file) {
  const bank = JSON.parse(fs.readFileSync(file, "utf8"));
  const B = bank.map(e => ({
    e,
    ce: stripPh(clean(e.stem)),
    ne: norm(e.stem),
    letter: (e.qtype === "mcq" && e.answer && /^[A-D]$/.test(e.answer)) ? e.answer : null,
  }));
  return { bank, B };
}

// 返回 { answer_text, score, matched, letter } 或 null
function matchAnswer(B, q) {
  const qq = stripPh(clean(q)), nq = norm(q);
  const qq2 = qq.replace(/[\s:：,，.、．？?！!]+$/, "");
  let best = null;
  for (const b of B) {
    if (!b.ne) continue;
    let score = dice(nq, b.ne), pref = false, tail = null;
    const base = b.ce;
    if (base === qq || base === qq2) { score = 1; pref = true; }
    else if (qq.length > 8 && base.startsWith(qq)) { score = 1; pref = true; }
    else if (qq2.length > 8 && base.startsWith(qq2)) { score = 0.999; pref = true; }
    if (pref) {
      const used = base.startsWith(qq) ? qq : (base.startsWith(qq2) ? qq2 : qq);
      let t = base.slice(used.length).replace(/^[\s:：,，.、．;；)）\]】]+/, "").trim();
      if (t && t.length <= 80) tail = t;
    }
    const cand = { score, b, tail };
    if (!best) { best = cand; continue; }
    if (cand.score > best.score + 0.02) { best = cand; continue; }
    if (Math.abs(cand.score - best.score) <= 0.02) {
      const rank = c => (c.b.letter ? 3 : 0) + (c.tail ? 1 : 0);
      if (rank(cand) > rank(best) || (rank(cand) === rank(best) && cand.tail && best.tail && cand.tail.length < best.tail.length)) best = cand;
    }
  }
  if (!best) return null;
  let text = null;
  if (best.b.letter && best.b.e.options) text = best.b.e.options[best.b.letter] || null;
  else if (best.tail) text = best.tail;
  else if (best.b.e.answer_text) text = best.b.e.answer_text;
  if (!text) return null;
  return { answer_text: text, score: +best.score.toFixed(3), matched: best.b.e.stem, letter: best.b.letter };
}

// 在一组选项中按答案文本选最接近的
function pickOption(options, answerText) {
  let best = null;
  for (const o of options) {
    const s = dice(norm(answerText), norm(o.text || ""));
    const contain = (o.text && (o.text.includes(answerText) || answerText.includes(o.text))) ? 0.9 : 0;
    const sc = Math.max(s, contain);
    if (!best || sc > best.sc) best = { sc, o };
  }
  return best && best.sc >= 0.3 ? { ...best.o, score: +best.sc.toFixed(2) } : null;
}

module.exports = { unesc, clean, stripPh, norm, dice, loadBank, matchAnswer, pickOption };
