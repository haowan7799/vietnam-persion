#!/usr/bin/env node
/*
 * 逍遥叹 · 音乐动画 —— 单镜头预览：把一个或多个镜头在若干时间点的画面拼成一张联系表
 *
 * 用法：node tools/preview-shot.cjs <镜头id[,id2,...]> [--times 0.5,2,4.5,7,9.5] [--text 示例歌词]
 *                                   [--sec verse|chorus|bridge] [--dur 12] [--out sheet.png] [--width 640]
 * 依赖：playwright（NODE_PATH 指向全局 node_modules 亦可）
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const times = flag('--times', '0.5,2,4.5,7,9.5').split(',').map(Number);
const text = flag('--text', '');
const sec = flag('--sec', 'verse');
const dur = +flag('--dur', 12);
const width = +flag('--width', 640);
const out = flag('--out', 'shot-preview.png');
const ids = (args[0] || '').split(',').filter(Boolean);
if (!ids.length) { console.error('用法：node tools/preview-shot.cjs <镜头id[,id2]> [--times ...] [--text ...] [--out sheet.png]'); process.exit(1); }

(async () => {
  const launch = {};
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) launch.proxy = { server: proxy };
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.XYT && XYT.api && XYT.api.state().tl, null, { timeout: 30000 });
  await page.evaluate(() => XYT.api.fonts());
  const res = await page.evaluate(async ({ ids, times, text, sec, dur, width }) => {
    const known = ids.filter((id) => XYT.scenes[id]);
    const missing = ids.filter((id) => !XYT.scenes[id]);
    const h = Math.round(width * 9 / 16);
    const sheet = document.createElement('canvas');
    sheet.width = width * times.length; sheet.height = (h + 24) * known.length;
    const sg = sheet.getContext('2d');
    sg.fillStyle = '#111'; sg.fillRect(0, 0, sheet.width, sheet.height);
    const timing = {};
    for (let r = 0; r < known.length; r++) {
      XYT.api.previewShot(known[r], { text, sec, dur });
      await document.fonts.ready;
      let ms = 0;
      for (let c = 0; c < times.length; c++) {
        const t0 = performance.now();
        XYT.api.renderAt(times[c]);
        ms += performance.now() - t0;
        sg.drawImage(document.getElementById('stage'), c * width, r * (h + 24) + 24, width, h);
        sg.fillStyle = '#ffd84a'; sg.font = '14px sans-serif';
        sg.fillText(`${known[r]} @ ${times[c]}s`, c * width + 6, r * (h + 24) + 17);
      }
      timing[known[r]] = +(ms / times.length).toFixed(1);
    }
    return { url: sheet.toDataURL('image/png'), missing, timing };
  }, { ids, times, text, sec, dur, width });
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(`已写入 ${out}`);
  if (res.missing.length) console.log('找不到镜头：', res.missing.join(', '));
  console.log('每帧绘制毫秒（未计入栅格化）：', JSON.stringify(res.timing));
  if (errors.length) console.log('页面错误：\n' + errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
