// Renders scene.html frame-by-frame with headless Chromium.
// Usage: node render.mjs <outDir> [fps=30] [workers=4] [only=t1,t2,...]
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "/opt/node22/lib/node_modules/playwright");

const root = dirname(fileURLToPath(import.meta.url));
const [outDir = "build/frames", fpsArg = "30", workersArg = "4", only] = process.argv.slice(2);
const FPS = +fpsArg, WORKERS = +workersArg, DUR = 30;
const types = { ".html": "text/html", ".ttf": "font/ttf", ".jpg": "image/jpeg" };

const server = createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split("?")[0]));
    res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
    res.end(await readFile(p));
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/${process.env.SCENE || "scene.html"}`;

await mkdir(outDir, { recursive: true });
const jobs = only ? only.split(",").map(Number).map(t => ({ t, name: `t${t.toFixed(2)}.png` }))
  : Array.from({ length: DUR * FPS }, (_, i) => ({ t: i / FPS, name: `${String(i).padStart(5, "0")}.png` }));

const browser = await chromium.launch();
let next = 0;
async function worker() {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  while (next < jobs.length) {
    const job = jobs[next++];
    const data = await page.evaluate(t => { renderFrame(t); return document.getElementById("c").toDataURL("image/png"); }, job.t);
    await writeFile(join(outDir, job.name), Buffer.from(data.split(",")[1], "base64"));
    if (!only && next % 60 === 0) console.log(`${next}/${jobs.length}`);
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`done ${jobs.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
server.close();
