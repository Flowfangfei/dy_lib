#!/usr/bin/env node
// 考试自动答题 Runner（南开大学大学语文在线测试）
// 用法: EXAM_COOKIE="ASP.NET_SessionId=..." node scripts/exam_runner.js <tag>
// 依赖: 本机 Chrome；无需 puppeteer（直接走 CDP）
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "runs");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const COOKIE = process.env.EXAM_COOKIE || "";
const HEADLESS = process.env.HEADLESS === "1";
const HOLD_SEC = parseInt(process.env.HOLD_SEC || "120", 10);
const TAG = process.argv[2] || "run1";
const OUT = path.join(RUNS, TAG);
const URL_EXAM = process.env.EXAM_URL || "https://dy.nankai.edu.cn/Exam/ExamPaper.aspx?EPID=8";
const PORT = 9600 + (parseInt(TAG.replace(/\D/g, "") || "1", 10) % 80);
const PROFILE = path.join(require("os").tmpdir(), `dy-lib-chrome-${TAG}`);

if (!COOKIE) {
  console.error("缺少 EXAM_COOKIE。请先在浏览器登录 dy.nankai.edu.cn，然后从 DevTools → Application → Cookies 复制 ASP.NET_SessionId。");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; fs.appendFileSync(path.join(OUT, "run.log"), line + "\n"); console.log(line); };

class CDP {
  constructor(u){this.ws=new WebSocket(u);this.id=0;this.p=new Map();this.handlers=[];this.ready=new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=()=>rej(new Error("ws error"))});this.ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&this.p.has(m.id)){const{resolve,reject}=this.p.get(m.id);this.p.delete(m.id);m.error?reject(new Error(JSON.stringify(m.error))):resolve(m.result)}else{for(const h of this.handlers)h(m);}};}
  send(m,p={}){const id=++this.id;return new Promise((res,rej)=>{this.p.set(id,{resolve:res,reject:rej});this.ws.send(JSON.stringify({id,method:m,params:p}))});}
  on(fn){this.handlers.push(fn);}
}

(async () => {
  fs.writeFileSync(path.join(OUT, "run.log"), "");
  const args = [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", "--window-size=1400,1000"];
  if (HEADLESS) args.unshift("--headless=new");
  const proc = spawn(CHROME, [...args, "about:blank"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) {} await sleep(250); }
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find(t => t.type === "page");
    const cdp = new CDP(page.webSocketDebuggerUrl); await cdp.ready;
    await cdp.send("Page.enable"); await cdp.send("Network.enable");
    cdp.on((m) => {
      if (m.method === "Page.javascriptDialogOpening") {
        log(`dialog: ${m.params.type} ${m.params.message}`);
        cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
      }
    });
    await cdp.send("Network.setCookie", { name: "ASP.NET_SessionId", value: COOKIE.replace(/^ASP\.NET_SessionId=/, ""), domain: "dy.nankai.edu.cn", path: "/", httpOnly: true });

    log("navigate");
    await cdp.send("Page.navigate", { url: URL_EXAM });
    await sleep(3500);
    const pre = (await cdp.send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true })).result.value;
    if (!pre.includes("开始考试")) { log("未到开考页（cookie 可能失效）"); return; }

    const tStart = Date.now();
    await cdp.send("Runtime.evaluate", { expression: "document.getElementById('ContentPlaceHolder1_ContentPlaceHolder1_btnStart').click()", returnByValue: true });
    await sleep(6000);
    const html = (await cdp.send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true })).result.value;

    const qs = [];
    const ms = [...html.matchAll(/lbQTitle[^>]*>([\s\S]*?)<\/span>/g)];
    for (let k = 0; k < ms.length; k++) {
      const start = ms[k].index;
      const end = k + 1 < ms.length ? ms[k + 1].index : html.length;
      const block = html.slice(start, end);
      const title = ms[k][1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      const labels = [...block.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)].map(m => m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim());
      const ids = [...block.matchAll(/type="radio"[^>]*?value="(\d+)"/g)].map(m => m[1]);
      const ids2 = ids.length ? ids : [...block.matchAll(/value="(\d+)"[^>]*?type="radio"/g)].map(m => m[1]);
      qs.push({ idx: k, title, options: ids2.map((id, i) => ({ id, text: labels[i] || "" })) });
    }
    fs.writeFileSync(path.join(OUT, "questions.json"), JSON.stringify(qs, null, 1), "utf8");
    log(`questions=${qs.length}`);

    const ready = path.join(OUT, "answers.ready.json");
    log("waiting answers.ready.json");
    for (let i = 0; i < 900; i++) { if (fs.existsSync(ready)) break; await sleep(2000); }
    if (!fs.existsSync(ready)) { log("超时未收到答案"); return; }
    const ans = JSON.parse(fs.readFileSync(ready, "utf8"));
    const applied = await cdp.send("Runtime.evaluate", { expression: `(()=>{const a=${JSON.stringify(ans)};let ok=0,miss=[];for(const k of Object.keys(a)){const el=document.querySelector("input[type=radio][value='"+a[k]+"']");if(el){el.checked=true;el.dispatchEvent(new Event('click',{bubbles:true}));ok++;}else miss.push(k);}return JSON.stringify({ok,miss});})()`, returnByValue: true });
    log("apply " + applied.result.value);

    const el = Date.now() - tStart;
    if (el < HOLD_SEC * 1000) { log(`hold ${Math.round((HOLD_SEC * 1000 - el) / 1000)}s`); await sleep(HOLD_SEC * 1000 - el); }

    log("submit");
    await cdp.send("Runtime.evaluate", { expression: "document.getElementById('ContentPlaceHolder1_ContentPlaceHolder1_btnSubmit').click()", returnByValue: true }).catch(e => log("submit err " + e.message));
    await sleep(4000);

    for (let step = 0; step < 6; step++) {
      const h = await cdp.send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true }).then(r => r.result.value).catch(() => "");
      fs.writeFileSync(path.join(OUT, `step${step}.html`), h || "", "utf8");
      const clicked = await cdp.send("Runtime.evaluate", { expression: `(()=>{const rx=/(完毕|确认完成|确定|完成|查看答案|查看试卷|答案|提交|继续)/;for(const el of document.querySelectorAll("input[type=button],input[type=submit],button,a")){const t=(el.value||el.textContent||"").trim();if(rx.test(t)&&t.length<20){el.click();return t;}}return null;})()`, returnByValue: true }).then(r => r.result.value).catch(() => null);
      if (!clicked) break;
      log(`click: ${clicked}`);
      await sleep(3000);
    }
    await sleep(1500);
    const finalHtml = await cdp.send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true }).then(r => r.result.value).catch(() => "");
    fs.writeFileSync(path.join(OUT, "result.html"), finalHtml || "", "utf8");
    log(`result.html len=${(finalHtml || "").length}`);
  } catch (e) {
    log("FATAL " + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
  }
})();
