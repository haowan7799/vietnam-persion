#!/usr/bin/env node
/*
 * 剪影人物图鉴：把 XYT.sil（或候选实现）的所有人物与姿势画成联系表，用来检查比例、轮廓光、穿模与二次运动
 *
 * 用法：node tools/sil-gallery.cjs [--file js/kit/sil.js] [--ns sil] [--out sheet.png]
 *        [--mode poses|motion|walk|scale] [--who old] [--pose walkSide] [--h 300]
 *   poses  ：每个人物每个姿势一格，亮底和暗底各画一遍（默认）
 *   motion ：选定人物姿势在 0..2.8 秒内 8 个时刻，看头发、衣摆、发带的摆动是否连续
 *   walk   ：长衫步连续 12 帧（每帧 1/15 秒），带地面参考线与脚下标记，检查滑步
 *   scale  ：同一姿势在 40/80/160/320 像素高下的样子
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const file = flag('--file', 'js/kit/sil.js');
const ns = flag('--ns', 'sil');
const out = flag('--out', 'sil-gallery.png');
const mode = flag('--mode', 'poses');
const who = flag('--who', null);
const pose = flag('--pose', null);
const H0 = +flag('--h', 300);

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
  if (path.resolve(file) !== path.resolve(__dirname, '..', 'js/kit/sil.js')) await page.addScriptTag({ path: path.resolve(file) });
  const res = await page.evaluate(({ ns, mode, who, pose, H0 }) => {
    const S = XYT[ns];
    if (!S || !S.draw) return { err: `XYT.${ns}.draw 不存在` };
    const poses = S.poses || {};
    const cells = [];
    const whoList = who ? [who] : Object.keys(poses);
    if (mode === 'poses') {
      for (const w of whoList) for (const p of (pose ? [pose] : poses[w])) for (const dark of [false, true]) cells.push({ w, p, t: 1.3, dark, h: H0 });
    } else if (mode === 'motion') {
      const w = whoList[0], p = pose || poses[w][0];
      for (let k = 0; k < 8; k++) cells.push({ w, p, t: k * 0.4, dark: false, h: H0, label: `t=${(k * 0.4).toFixed(1)}` });
    } else if (mode === 'walk') {
      const w = whoList[0], p = pose || 'walkSide';
      for (let k = 0; k < 12; k++) cells.push({ w, p, t: k / 15, dark: false, h: H0, walk: true, label: `f${k}` });
    } else if (mode === 'scale') {
      const w = whoList[0], p = pose || poses[w][0];
      for (const h of [40, 80, 160, 320]) for (const dark of [false, true]) cells.push({ w, p, t: 1.3, dark, h });
    }
    const cw = Math.round(H0 * 1.25), ch = Math.round(H0 * 1.35);
    const cols = mode === 'walk' ? 6 : mode === 'motion' ? 4 : 6;
    const rows = Math.ceil(cells.length / cols);
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch;
    const g = cv.getContext('2d');
    const times = [];
    cells.forEach((c, i) => {
      const x0 = (i % cols) * cw, y0 = Math.floor(i / cols) * ch;
      const gr = g.createLinearGradient(0, y0, 0, y0 + ch);
      if (c.dark) { gr.addColorStop(0, '#1b2333'); gr.addColorStop(1, '#3b4660'); } else { gr.addColorStop(0, '#f1e6cf'); gr.addColorStop(1, '#d9c8a6'); }
      g.fillStyle = gr; g.fillRect(x0, y0, cw, ch);
      const gy = y0 + ch - 40;
      g.strokeStyle = c.dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, gy + 0.5); g.lineTo(x0 + cw, gy + 0.5); g.stroke();
      let fx = x0 + cw / 2;
      if (c.walk) {
        const v = S.walkSpeed ? S.walkSpeed(c.h) : 0;
        fx = x0 + cw * 0.3 + v * c.t;
        // 脚下参考：每隔 10 像素一格，便于看脚是否滑
        g.fillStyle = 'rgba(200,40,40,0.5)';
        for (let xx = x0; xx < x0 + cw; xx += 10) g.fillRect(xx, gy + 2, 1, 6);
      }
      g.save();
      const t0 = performance.now();
      try {
        S.draw(g, c.w, c.p, fx, gy, c.h, c.t, { facing: 1, wind: 0.6, windDir: -1, rim: c.dark ? '#ffd9a0' : '#fff2d6', rimSide: 1, accent: null });
      } catch (e) { g.fillStyle = 'red'; g.font = '14px sans-serif'; g.fillText(String(e.message).slice(0, 40), x0 + 6, y0 + 40); }
      times.push(performance.now() - t0);
      g.restore();
      g.fillStyle = c.dark ? '#ffd84a' : '#7a1d10'; g.font = '13px sans-serif';
      g.fillText(`${c.w}/${c.p}${c.label ? ' ' + c.label : ''} h=${c.h}`, x0 + 6, y0 + 16);
    });
    times.sort((a, b) => a - b);
    return { url: cv.toDataURL('image/png'), n: cells.length, medMs: times[times.length >> 1], maxMs: times[times.length - 1], poses };
  }, { ns, mode, who, pose, H0 });
  if (res.err) { console.error(res.err); process.exit(1); }
  fs.writeFileSync(out, Buffer.from(res.url.split(',')[1], 'base64'));
  console.log(`已写入 ${out}：${res.n} 格；每个人物绘制中位 ${res.medMs.toFixed(2)} ms，最大 ${res.maxMs.toFixed(2)} ms`);
  console.log('姿势表：', JSON.stringify(res.poses));
  if (errors.length) console.log('页面错误：\n' + errors.join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
