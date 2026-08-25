import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the daily memory product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>一帧之后｜每日记忆锚点<\/title>/i);
  assert.match(html, /一帧之后/);
  assert.match(html, /记忆锚点/);
  assert.match(html, />时间<\/button>/);
  assert.match(html, /class="daily-anchor-browser"/);
  assert.match(html, /is-home/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the memory assets and core interactions", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  await Promise.all([
    "cat.jpg",
    "cat-sketch.png",
    "cake.jpg",
    "cake-sketch.png",
    "flowers.jpg",
    "flowers-sketch.png",
    "sculptures.jpg",
    "sculptures-sketch.png",
  ].map((name) => access(new URL(`../public/memories/${name}`, import.meta.url))));

  assert.match(page, /yizhen-daily-memories-v1/);
  assert.match(page, /yizhen-memory-store-v2/);
  assert.match(page, /useState<View>\("archive"\)/);
  assert.match(page, /useState\(today\.slice\(0, 7\)\)/);
  assert.match(page, /aria-label="返回记忆锚点"/);
  assert.match(page, /compressImage/);
  assert.match(page, /moveAnchor/);
  assert.match(page, /saveMemory/);
  assert.match(page, /className="time-ribbon"/);
  assert.match(page, /data-year/);
  assert.match(page, /data-month/);
  assert.match(page, /trailingCalendarBlanks/);
  assert.doesNotMatch(page, /type="month"/);
  assert.match(page, /type="date"/);
  assert.match(page, /memoriesByDate/);
  assert.match(page, /setAsDayCover/);
  assert.match(page, /renameCustomCategory/);
  assert.match(page, /自定义类别|新建自己的类别/);
  assert.match(page, />时间<\/button>/);
  assert.match(page, />分类<\/button>/);
  assert.match(page, /className="anchor-grid"/);
  assert.match(page, /className="category-grid"/);
  assert.doesNotMatch(page, /className="book-spread|turnArchiveSpread|返回书架/);
  assert.doesNotMatch(page, /className="archive-grid"|className="book-volume"|className="bookcase"/);
  assert.match(page, /setCalendarMonth\(today\.slice\(0, 7\)\); setView\("calendar"\)/);
  assert.match(page, /pickerSyncingRef/);
  assert.match(page, /if \(pickerSyncingRef\.current\) return;/);
  assert.match(page, /behavior: "auto"/);
  assert.doesNotMatch(page, /behavior: "smooth"/);
  assert.ok(page.indexOf("<span>锚</span>记忆锚点") < page.indexOf("<span>日</span>日历"));
  assert.match(page, /选择一个分类/);
  assert.match(page, /每个锚点只属于一个分类/);
  assert.doesNotMatch(page, /最多 3 个|categoryIds\.slice\(0, 3\)/);
  assert.match(page, /changeDay/);
  assert.match(page, /handleHomeTouchStart/);
  assert.match(page, /← 上一天/);
  assert.match(page, /下一天 →/);
  assert.match(page, /编辑记忆文字/);
  assert.match(page, /保存简笔画/);
  assert.doesNotMatch(page, /memoriesByDate\.size\} 天 · \{sortedMemories\.length\} 个锚点/);
  assert.match(page, /保存修改/);
  assert.match(page, /撕开并查看原始照片/);
  assert.match(page, /className="anchor-toggle"/);
  assert.match(page, /halfVisibleHeight/);
  assert.doesNotMatch(page, /style=\{\{ left: `\$\{memory\.anchor\.x\}/);
  assert.match(page, /app-header.*is-secondary/);
  assert.doesNotMatch(page, /month-summary|recent-memories|record-today/);
  assert.doesNotMatch(page, /className="memory-toggle"|className="memory-veil"|className="anchor-trace"/);
  assert.doesNotMatch(page, /不是保存整张照片|搜索记忆|原图藏在这张简笔画之后|点击简笔画翻开|选择今天的一张照片|confirmation-anchor|photo-options/);
  assert.doesNotMatch(page, /PRIVATE BY DEFAULT|你的记忆，只属于你|隐私与关于|恢复示例内容|showAbout|resetLocalMemory/);
  assert.match(css, /tear-piece-top/);
  assert.match(css, /--tear-shift-negative/);
  assert.match(css, /object-fit: contain/);
  assert.doesNotMatch(css, /\.anchor-toggle span|\.memory-paper\.is-open \.anchor-toggle/);
  assert.match(css, /\.app-header\.is-secondary/);
  assert.match(css, /position: fixed/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /scroll-snap-type: y mandatory/);
  assert.match(css, /\.anchor-grid/);
  assert.match(css, /\.category-tile/);
  assert.match(css, /\.daily-date-strip/);
  assert.match(css, /\.daily-anchor-actions/);
  assert.doesNotMatch(css, /book-turn-next|book-spine|book-volume|book-spread/);
  assert.doesNotMatch(css, /trace-draw|veil-dissolve/);
  assert.match(css, /prefers-reduced-motion/);
});

test("includes an automated GitHub Pages export", async () => {
  const [packageJson, exporter, workflow] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/export-github-pages.mjs", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-github-pages.yml", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /export:github-pages/);
  assert.match(exporter, /dist["'], ["']github-pages/);
  assert.match(exporter, /\.nojekyll/);
  assert.match(exporter, /GITHUB_PAGES_BASE_PATH/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /npm run export:github-pages/);
});
