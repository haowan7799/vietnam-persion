#!/usr/bin/env node
/*
 * 逐帧运动检查：在真实歌曲时间轴上把一个镜头逐帧渲染出来，计算相邻帧差异，找出突跳（孤立尖峰）与闪帧；
 * 也可以输出连续帧胶片条，用来检查人物和物体的运动是否连续。
 *
 * 用法：node tools/motion-check.cjs <镜头id> --song <音频> --lrc <歌词> [--fps 30] [--out 目录]
 *        [--lyrics]            连同歌词一起检查（默认关掉歌词，只看镜头）
 *        [--strip 0.5,3.2]     在这些镜头内时间各输出 --n 帧连续帧（默认 8 帧）
 *        [--res 640]           渲染宽度
 * 输出：<out>/<id>-motion.png（差异曲线 + 尖峰附近的帧），<out>/<id>-strip.png（胶片条），并在终端打印 JSON 摘要。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const has = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const song = flag('--song', null);
const lrc = flag('--lrc', null);
const fps = +flag('--fps', 30);
const outDir = flag('--out', '.');
const res = +flag('--res', 640);
const stripArg = flag('--strip', null);
const nStrip = +flag('--n', 8);
const withLyrics = has('--lyrics');
const id = args[0];
if (!id || !song) { console.error('用法：node tools/motion-check.cjs <镜头id> --song <音频> --lrc <歌词> [--fps 30] [--out 目录] [--strip t1,t2]'); process.exit(1); }

(async () => {
  const launch = {};
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) launch.proxy = { server: proxy };
  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => window.XYT && XYT.api && XYT.api.state().tl, null, { timeout: 30000 });
  await page.setInputFiles('#audioFile', path.resolve(song));
  await page.waitForFunction(() => XYT.api.state().an.source === 'audio' && document.getElementById('anaBox').hidden, null, { timeout: 180000 });
  if (lrc) await page.evaluate((t) => XYT.api.setLyrics(t), fs.readFileSync(lrc, 'utf8'));
  await page.evaluate(() => XYT.api.setStoryboard(XYT.STORYBOARD));
  await page.evaluate(() => XYT.api.fonts());
  const r = await page.evaluate(async ({ id, fps, res, withLyrics, strip, nStrip }) => {
    XYT.QA = { noLyrics: !withLyrics };
    XYT.BRAND = false;
    XYT.api.setResolution(res);
    const tl = XYT.api.state().tl;
    const k = tl.segments.findIndex((s) => s.scene === id);
    if (k < 0) return { err: `时间线里没有镜头 ${id}` };
    const seg = tl.segments[k], next = tl.segments[k + 1];
    const tEnd = next && next.trans ? next.start - next.trans.dur : seg.end;
    const stage = document.getElementById('stage');
    const sw = 160, sh = 90;
    const small = document.createElement('canvas'); small.width = sw; small.height = sh;
    const sg = small.getContext('2d', { willReadFrequently: true });
    const luma = () => {
      sg.drawImage(stage, 0, 0, sw, sh);
      const d = sg.getImageData(0, 0, sw, sh).data, y = new Float32Array(sw * sh);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) y[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      return y;
    };
    // 先暖一遍缓存，避免第一帧建缓存的耗时算进去
    XYT.api.renderAt(seg.start + 0.01); XYT.api.renderAt(seg.start + (tEnd - seg.start) / 2);
    const times = [], diffs = [], ms = [];
    let prev = null;
    const t0 = seg.start + 0.02;
    for (let t = t0; t < tEnd - 0.01; t += 1 / fps) {
      const a = performance.now();
      XYT.api.renderAt(t);
      ms.push(performance.now() - a);
      const y = luma();
      if (prev) { let s = 0; for (let i = 0; i < y.length; i++) s += Math.abs(y[i] - prev[i]); diffs.push(s / y.length); times.push(t); }
      prev = y;
    }
    // 尖峰：比前后 5 帧的中位数高很多，且比相邻两帧都高一倍以上
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
    const spikes = [];
    for (let i = 0; i < diffs.length; i++) {
      const win = diffs.slice(Math.max(0, i - 5), i).concat(diffs.slice(i + 1, i + 6));
      const base = med(win);
      const nb = Math.max(diffs[i - 1] || 0, diffs[i + 1] || 0);
      if (diffs[i] > Math.max(1.2, 3 * base + 0.8) && diffs[i] > 1.8 * nb) spikes.push({ i, t: +times[i].toFixed(3), lt: +(times[i] - seg.start).toFixed(3), diff: +diffs[i].toFixed(2), base: +base.toFixed(2) });
    }
    spikes.sort((a, b) => b.diff - a.diff);
    // 图：差异曲线 + 前 4 个尖峰前后的帧
    const top = spikes.slice(0, 4);
    const W = 1280, CH = 220, FH = 120, FW = 213;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = CH + 20 + top.length * (FH + 22);
    const g = cv.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, cv.width, cv.height);
    const maxD = Math.max(4, ...diffs);
    g.strokeStyle = '#333'; for (let v = 0; v <= maxD; v += 2) { const yy = CH - (v / maxD) * (CH - 20); g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
    // 节拍竖线
    const grid = XYT.api.state().an.grid;
    g.strokeStyle = 'rgba(255,216,74,0.25)';
    for (let i = 0; i < grid.n; i++) { const bt = grid.time(i); if (bt < t0 || bt > tEnd) continue; const xx = ((bt - t0) / (tEnd - t0)) * W; g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx, CH); g.stroke(); }
    g.strokeStyle = '#7fd1ff'; g.beginPath();
    diffs.forEach((d, i) => { const xx = ((times[i] - t0) / (tEnd - t0)) * W, yy = CH - (d / maxD) * (CH - 20); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); });
    g.stroke();
    g.fillStyle = '#ff5a4a'; for (const s of spikes) { const xx = ((s.t - t0) / (tEnd - t0)) * W; g.fillRect(xx - 2, CH - (s.diff / maxD) * (CH - 20) - 2, 5, 5); }
    g.fillStyle = '#ddd'; g.font = '13px sans-serif';
    g.fillText(`${id}  相邻帧差异（0–255 灰度均值）  最大 ${maxD.toFixed(2)}  中位 ${med(diffs).toFixed(2)}  尖峰 ${spikes.length} 个  黄线=节拍`, 8, 14);
    top.forEach((s, r) => {
      const y0 = CH + 20 + r * (FH + 22);
      g.fillStyle = '#ffd84a'; g.fillText(`尖峰 镜头内 ${s.lt}s（歌曲 ${s.t}s） 差异 ${s.diff}（附近基线 ${s.base}）`, 8, y0 + 13);
      for (let c = -2; c <= 3; c++) {
        XYT.api.renderAt(s.t + (c - 1) / fps);
        g.drawImage(stage, (c + 2) * FW, y0 + 18, FW - 4, FH);
      }
    });
    const motionUrl = cv.toDataURL('image/png');
    // 胶片条
    let stripUrl = null;
    if (strip && strip.length) {
      const cw = 320, chh = 180;
      const sc = document.createElement('canvas'); sc.width = cw * Math.min(nStrip, 8); sc.height = Math.ceil(nStrip / 8) * strip.length * (chh + 18);
      const g2 = sc.getContext('2d'); g2.fillStyle = '#111'; g2.fillRect(0, 0, sc.width, sc.height);
      let row = 0;
      for (const lt of strip) {
        for (let f = 0; f < nStrip; f++) {
          const t = seg.start + lt + f / fps;
          XYT.api.renderAt(t);
          const x = (f % 8) * cw, y = (row + Math.floor(f / 8)) * (chh + 18);
          g2.drawImage(stage, x, y + 18, cw - 2, chh);
          g2.fillStyle = '#ffd84a'; g2.font = '12px sans-serif'; g2.fillText(`${(lt + f / fps).toFixed(3)}s`, x + 4, y + 13);
        }
        row += Math.ceil(nStrip / 8);
      }
      stripUrl = sc.toDataURL('image/png');
    }
    ms.sort((a, b) => a - b);
    return { motionUrl, stripUrl, summary: { id, start: seg.start, checkedUntil: +tEnd.toFixed(3), frames: diffs.length + 1, medianDiff: +med(diffs).toFixed(3), maxDiff: +Math.max(0, ...diffs).toFixed(3), spikes: spikes.slice(0, 12), msMedian: +ms[ms.length >> 1].toFixed(1), msP90: +ms[Math.floor(ms.length * 0.9)].toFixed(1) } };
  }, { id, fps, res, withLyrics, strip: stripArg ? stripArg.split(',').map(Number) : null, nStrip });
  if (r.err) { console.error(r.err); process.exit(1); }
  fs.mkdirSync(outDir, { recursive: true });
  const mp = path.join(outDir, `${id}-motion.png`);
  fs.writeFileSync(mp, Buffer.from(r.motionUrl.split(',')[1], 'base64'));
  if (r.stripUrl) fs.writeFileSync(path.join(outDir, `${id}-strip.png`), Buffer.from(r.stripUrl.split(',')[1], 'base64'));
  console.log(JSON.stringify(r.summary, null, 1));
  console.log(`已写入 ${mp}${r.stripUrl ? ' 和胶片条 ' + path.join(outDir, id + '-strip.png') : ''}`);
  if (errors.length) console.log('页面错误：\n' + errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
