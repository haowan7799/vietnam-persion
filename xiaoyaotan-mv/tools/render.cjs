#!/usr/bin/env node
/*
 * 逍遥叹 · 音乐动画 —— 离线逐帧渲染（H.264 + AAC 的 MP4，不受实时录制掉帧影响）
 *
 * 依赖：Node 18+、ffmpeg、playwright（npm i playwright && npx playwright install chromium）
 * 用法：node tools/render.cjs <音频文件> [歌词.lrc] [输出.mp4] [--res 1080] [--fps 30] [--crf 18] [--seconds 20] [--storyboard] [--no-lyrics] [--no-brand]
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('需要 playwright：npm i playwright && npx playwright install chromium');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const res = +flag('--res', 1080);
const fps = +flag('--fps', 30);
const limit = flag('--seconds', null);
const crf = flag('--crf', '18');
const useBoard = args.includes('--storyboard'); if (useBoard) args.splice(args.indexOf('--storyboard'), 1);
// --no-lyrics：质检用，渲染时不画歌词（只看画面本身的运动）
const noLyrics = args.includes('--no-lyrics'); if (noLyrics) args.splice(args.indexOf('--no-lyrics'), 1);
// --no-brand：不画水印和制作人署名
const noBrand = args.includes('--no-brand'); if (noBrand) args.splice(args.indexOf('--no-brand'), 1);
const [audio, lyricsPath, outArg] = args;
if (!audio) {
  console.error('用法：node tools/render.cjs <音频文件> [歌词.lrc] [输出.mp4] [--res 1080] [--fps 30] [--seconds 20]');
  process.exit(1);
}
const out = outArg || '逍遥叹-音乐动画.mp4';
const page = 'file://' + path.resolve(__dirname, '..', 'index.html');

// 先用 ffmpeg 转成临时 WAV：Playwright 自带的 Chromium 解不了 AAC（m4a），
// 而且上传非 ASCII 文件名时不会触发 change 事件
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyt-'));
const wav = path.join(tmpDir, 'song.wav');
const conv = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.resolve(audio), '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', wav], { stdio: 'inherit' });
if (conv.status !== 0 || !fs.existsSync(wav)) {
  console.error('ffmpeg 读不了这个音频。请换成普通的 mp3、m4a、flac 或 wav（音乐 App 的 .ncm/.qmc/.kgm 是加密格式）。');
  process.exit(1);
}

(async () => {
  const launch = { args: ['--autoplay-policy=no-user-gesture-required'] };
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy) launch.proxy = { server: proxy };
  const browser = await chromium.launch(launch);
  const tab = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  tab.on('pageerror', (e) => console.error('页面错误：', e.message));
  await tab.goto(page);
  await tab.waitForFunction(() => window.XYT && XYT.api && XYT.api.state().tl, null, { timeout: 30000 });

  console.log('分析音频…');
  await tab.setInputFiles('#audioFile', wav);
  await tab.waitForFunction(() => XYT.api.state().an.source === 'audio' && document.getElementById('anaBox').hidden, null, { timeout: 180000 });
  if (lyricsPath) {
    const text = fs.readFileSync(lyricsPath, 'utf8');
    const shots = await tab.evaluate((t) => XYT.api.setLyrics(t), text);
    console.log(`已应用歌词，镜头数 ${shots}`);
  }
  if (noLyrics) await tab.evaluate(() => { XYT.QA = { noLyrics: true }; });
  if (noBrand) await tab.evaluate(() => { XYT.BRAND = false; });
  if (useBoard) {
    const n = await tab.evaluate(() => XYT.api.setStoryboard(XYT.STORYBOARD));
    console.log(`已应用分镜表，镜头数 ${n}`);
  }
  const info = await tab.evaluate((w) => { XYT.api.setResolution(w); const st = XYT.api.state(); return { bpm: st.an.bpm, dur: st.an.duration, secs: st.an.sections.map((s) => s.type) }; }, res === 720 ? 1280 : 1920);
  await tab.evaluate(() => XYT.api.fonts());
  await tab.waitForTimeout(500);
  const total = limit ? Math.min(+limit, info.dur) : info.dur;
  console.log(`速度 ${info.bpm.toFixed(1)} BPM，段落 ${info.secs.join(' / ')}，渲染 ${total.toFixed(1)} 秒 @ ${fps}fps`);

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-map', '0:v', '-map', '1:a', '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  const frames = Math.ceil(total * fps);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const url = await tab.evaluate((t) => { XYT.api.renderAt(t); return document.getElementById('stage').toDataURL('image/jpeg', 0.92); }, i / fps);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % fps === 0) process.stdout.write(`\r帧 ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`\n完成：${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
