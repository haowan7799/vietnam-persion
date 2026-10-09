/* 分镜镜头 第 07 组：副歌1 后四句 —— 题壁墨枯、彩依还蝶、蝶绕残烛、枫天初雪 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 通用小工具 ----------
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const tintS = (col) => XYT.sprites.tint(XYT.sprites.glow, col);
  // 本句第 k 字相对镜头起点的时间；取不到时用实测表
  function charAt(c, k, table) {
    const v = c.charT ? c.charT(k) : null;
    return v == null ? table[Math.min(k, table.length - 1)] : v - (c.t - c.lt);
  }
  function chars(c, table) { const out = []; for (let k = 0; k < table.length; k++) out.push(charAt(c, k, table)); return out; }
  // 柔光点
  function dot(g, x, y, r, col, a, op) {
    if (!(a > 0.003) || r <= 0) return;
    const o = g.globalCompositeOperation, ga = g.globalAlpha;
    g.globalCompositeOperation = op || 'lighter'; g.globalAlpha = ga * Math.min(1, a);
    g.drawImage(tintS(col), x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = o; g.globalAlpha = ga;
  }
  // 每帧复用的草稿缓冲（设备分辨率），用前清空，不跨帧保存内容
  const bufs = {};
  function scratch(name, w, h) {
    let cv = bufs[name];
    if (!cv) cv = bufs[name] = document.createElement('canvas');
    w = Math.max(2, Math.ceil(w)); h = Math.max(2, Math.ceil(h));
    if (cv.width < w || cv.height < h) { cv.width = Math.max(cv.width, w); cv.height = Math.max(cv.height, h); }
    const q = cv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, w + 2, h + 2);
    return { cv, q, w, h };
  }
  // 当前变换下逻辑区域 box 对应的设备像素范围（草稿层只开这么大）
  function devBox(g, box) {
    const m = g.getTransform(), xs = [], ys = [];
    for (const [x, y] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) { xs.push(m.a * x + m.c * y + m.e); ys.push(m.b * x + m.d * y + m.f); }
    const cw = g.canvas.width, ch = g.canvas.height;
    const X0 = Math.max(0, Math.floor(Math.min(...xs))), Y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const X1 = Math.min(cw, Math.ceil(Math.max(...xs))), Y1 = Math.min(ch, Math.ceil(Math.max(...ys)));
    return { X0, Y0, w: Math.max(2, X1 - X0), h: Math.max(2, Y1 - Y0) };
  }
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;
  // 书法字：先请求本组用到的字形；没加载好时缓存键不同，加载后自动重画
  const MY_GLYPHS = '李大侠到此一游囍';
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', MY_GLYPHS).catch(() => {}); } catch (e) { /* 无字体接口 */ }
  let fontReady = false;
  const fk = () => {
    if (fontReady) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', MY_GLYPHS)) { fontReady = true; return 'f'; } } catch (e) { /* 无 */ }
    return 'n';
  };
  // 填一条从 (x0,y0) 到 (x1,y1) 的柔边光带
  function bandV(g, x0, y0, x1, y1, stops) { g.fillStyle = K.lin(g, 0, y0, 0, y1, stops); g.fillRect(x0, y0, x1 - x0, y1 - y0); }


  // =====================================================================
  // 第21句 题壁墨枯：〔第21句第1–4字〕｜〔第21句第5–8字〕｜〔第21句第9–11字〕
  // =====================================================================
  const T21 = [0.26, 0.54, 1.04, 1.28, 2.02, 2.64, 3.16, 3.6, 3.96, 4.34, 4.88];
  const WB = 612;           // 墙脚
  const GY = 664;           // 少年脚下
  const WEND = 1012;        // 墙的右端
  // 墙头三级跌落（马头墙）：[x0, x1, 檐下沿 y]
  const STEPS = [[-60, 560, 150], [560, 812, 112], [812, WEND, 74]];
  // 墙上的字：[字, x, y, 字号, 旋转]
  const WRIT = [['李', 276, 292, 128, -0.07], ['大', 364, 280, 152, 0.05], ['侠', 460, 302, 148, -0.05], ['到', 548, 298, 120, 0.07],
    ['此', 622, 316, 114, -0.06], ['一', 688, 298, 104, 0.03], ['游', 754, 324, 128, 0.09]];
  const INK = '#15161b';
  const BOY = { x: 930, y: GY, s: 2.0 };
  const wallPath = (q, inset = 0) => {
    q.beginPath(); q.moveTo(-60, WB);
    for (const [x0, x1, y] of STEPS) { q.lineTo(x0, y + inset); q.lineTo(x1, y + inset); }
    q.lineTo(WEND, WB); q.closePath();
  };
  // 旧瓦缺了几片的位置（老墙上雨痕从这里垂下）
  const brokenTile = (si, xx) => h2(Math.round(xx) + 400, 31 + si) < 0.085;

  // 竹影：一簇簇竹叶的柔影（预先模糊），从左上方斜斜投在墙上
  function bambooShadow() {
    return K.cache('g07|bshadow', W + 200, 560, 0.5, (q) => {
      const r = A.rng(31);
      try { q.filter = `blur(${(2.6 * SS() * 0.5).toFixed(1)}px)`; } catch (e) { /* 无滤镜 */ }
      const twig = (x0, y0, ang, len, n, a) => {
        q.fillStyle = q.strokeStyle = `rgba(0,0,0,${a})`; q.lineWidth = 2.4;
        q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo(x0 + Math.cos(ang) * len * 0.5, y0 + Math.sin(ang) * len * 0.5 + 10, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); q.stroke();
        for (let k = 0; k < n; k++) {
          const u = 0.3 + (k / n) * 0.75, px = x0 + Math.cos(ang) * len * u, py = y0 + Math.sin(ang) * len * u + 10 * Math.sin(u * PI);
          const m = 3 + Math.floor(r() * 3);
          for (let j = 0; j < m; j++) {
            const la = ang + 0.7 + (j - (m - 1) / 2) * 0.38 + (r() - 0.5) * 0.3, L = 50 + r() * 38, wd = 6.5 + r() * 3;
            q.save(); q.translate(px, py); q.rotate(la);
            q.beginPath(); q.moveTo(0, 0); q.quadraticCurveTo(L * 0.3, -wd, L, 1); q.quadraticCurveTo(L * 0.35, wd, 0, 0); q.fill();
            q.restore();
          }
        }
      };
      for (let k = 0; k < 6; k++) twig(-60 + r() * 420, -10 + r() * 150, 0.3 + r() * 0.45, 200 + r() * 160, 4 + Math.floor(r() * 3), 0.85);
      for (let k = 0; k < 4; k++) twig(-80 + r() * 260, 170 + r() * 220, 0.15 + r() * 0.35, 150 + r() * 120, 3, 0.55);
    });
  }
  // 桂树：墨绿叶团里缀着细碎金黄的桂花；墙后探出来。bare 为几十年后的枯枝
  function osmanthus(bare) {
    return K.cache('g07|osm' + (bare ? 'B' : 'A'), 760, 320, 1, (q) => {
      const r = A.rng(bare ? 77 : 71);
      q.strokeStyle = bare ? '#4c4842' : '#3a2e26'; q.lineCap = 'round';
      const branch = (x, y, a, L, w, d) => {
        if (d <= 0 || L < 8) return;
        const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
        q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo((x + x1) / 2 + (r() - 0.5) * L * 0.3, (y + y1) / 2, x1, y1); q.stroke();
        for (let k = 0; k < 2; k++) branch(x1, y1, a + (k ? 0.5 : -0.55) + (r() - 0.5) * 0.4, L * (0.62 + r() * 0.2), w * 0.66, d - 1);
      };
      branch(250, 350, -1.45, 120, 22, 6);
      branch(530, 350, -1.75, 105, 18, 6);
      if (bare) {
        for (let k = 0; k < 22; k++) { q.fillStyle = rgba(k % 2 ? '#7a5a3a' : '#5a4a3a', 0.8); q.beginPath(); q.ellipse(100 + r() * 560, 40 + r() * 200, 5, 2.4, r() * 3, 0, TAU); q.fill(); }
        return;
      }
      const clusters = [[140, 170, 120], [262, 96, 130], [392, 130, 124], [520, 86, 124], [636, 160, 104], [330, 214, 110], [474, 210, 104], [80, 232, 80]];
      for (const pass of [0, 1, 2, 3]) {
        for (const [cx, cy, R] of clusters) {
          const n = pass === 0 ? 130 : pass === 3 ? 40 : 80;
          for (let k = 0; k < n; k++) {
            const a = r() * TAU, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.72;
            const top = clamp((cy - y) / R + 0.5);
            q.fillStyle = pass === 0 ? '#1d3a2c' : pass === 1 ? mix('#2a5240', '#3f6a48', top) : pass === 2 ? rgba('#7aa66a', 0.25 + 0.5 * top) : rgba('#d8e8b0', 0.35 * top);
            q.beginPath(); q.ellipse(x, y, (9 + r() * 5) * (pass === 3 ? 0.6 : 1), (4 + r() * 2) * (pass === 3 ? 0.6 : 1), r() * PI, 0, TAU); q.fill();
          }
        }
      }
      for (let k = 0; k < 300; k++) {
        const [cx, cy, R] = clusters[k % clusters.length];
        const a = r() * TAU, d = Math.sqrt(r()) * R * 0.95, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.72;
        q.fillStyle = r() < 0.55 ? '#f6cf4a' : '#e8a040';
        for (let j = 0; j < 4; j++) { q.beginPath(); q.arc(x + (r() - 0.5) * 7, y + (r() - 0.5) * 5, 1.2 + r() * 1.2, 0, TAU); q.fill(); }
      }
    });
  }
  // 墙外远景：雾里一层层马头墙、远塔与柳烟
  function skyTex(aged) {
    return K.cache('g07|sky' + (aged ? 'B' : 'A'), W, 640, 1, (q) => {
      const r = A.rng(aged ? 61 : 60);
      if (aged) bandV(q, 0, 0, W, 640, [[0, '#7f8f9a'], [0.55, '#b4bcbf'], [1, '#cfd2cd']]);
      else {
        bandV(q, 0, 0, W, 640, [[0, '#76a8c8'], [0.45, '#bcd6de'], [0.8, '#e9eee6'], [1, '#f4f0e2']]);
        q.fillStyle = K.rad(q, 80, -60, 0, 640, [[0, 'rgba(255,244,214,0.7)'], [0.5, 'rgba(255,244,214,0.25)'], [1, 'rgba(255,244,214,0)']]); q.fillRect(0, 0, W, 640);
      }
      E.clouds(q, { t: 0, y: 80, color: aged ? '#d4d8d8' : '#ffffff', shade: aged ? '#76828a' : '#a8bccb', alpha: aged ? 0.75 : 0.6, scale: 0.75, n: 4, seed: aged ? 23 : 21, speed: 0, lightX: aged ? 640 : 120 });
      const haze = aged ? '#c6cbcb' : '#e6ece6';
      // 远山
      q.fillStyle = mix(aged ? '#8a969c' : '#9fb6c0', haze, 0.35);
      q.beginPath(); q.moveTo(WEND - 40, 470);
      for (let x = WEND - 40; x <= W + 20; x += 20) q.lineTo(x, 430 - 40 * Math.sin((x - 900) / 90) - 20 * noise1(x / 60, 3));
      q.lineTo(W + 20, 640); q.lineTo(WEND - 40, 640); q.closePath(); q.fill();
      // 远塔
      const px = 1190, py = 452;
      q.fillStyle = mix(aged ? '#7c8890' : '#8ea4ae', haze, 0.3);
      for (let k = 0; k < 6; k++) { const w = 24 - k * 2.6, y = py - k * 15; q.fillRect(px - w / 2, y - 12, w, 12); q.beginPath(); q.moveTo(px - w / 2 - 7, y - 10); q.quadraticCurveTo(px, y - 15, px + w / 2 + 7, y - 10); q.lineTo(px + w / 2, y - 13); q.lineTo(px - w / 2, y - 13); q.closePath(); q.fill(); }
      q.fillRect(px - 1, py - 104, 2, 16);
      bandV(q, WEND - 40, 380, W, 520, [[0, rgba(haze, 0)], [1, rgba(haze, 0.6)]]);
      // 两排白墙黛瓦（马头墙），远排更淡
      E.jiangnanTown(q, { t: 0, y: 560, x0: WEND - 40, x1: W + 40, scale: 0.45, seed: 12, color: aged ? '#c8c8c0' : '#f4f0e6', roof: aged ? '#55585c' : '#3e434a', haze, hazeA: 0.55, bank: false, smoke: 0 });
      bandV(q, WEND - 40, 470, W, 580, [[0, rgba(haze, 0)], [0.7, rgba(haze, 0.5)], [1, rgba(haze, 0.2)]]);
      E.jiangnanTown(q, { t: 0, y: 614, x0: WEND - 30, x1: W + 40, scale: 0.7, seed: 5, color: aged ? '#c4c2b8' : '#f6f2e8', roof: aged ? '#4a4c50' : '#33373e', haze, hazeA: aged ? 0.3 : 0.18, bank: false, smoke: 0 });
      // 柳烟：几株虚虚的柳
      for (const [wx, wy, s] of [[1060, 540, 0.8], [1250, 560, 1]]) {
        q.strokeStyle = rgba(aged ? '#7a8478' : '#8faa78', 0.35); q.lineWidth = 1.2;
        for (let k = 0; k < 26; k++) { const sx = wx + (r() - 0.5) * 70 * s, sy = wy - 110 * s + r() * 30 * s; q.beginPath(); q.moveTo(sx, sy); q.quadraticCurveTo(sx + 6, sy + 50 * s, sx + 2 + r() * 8, sy + (70 + r() * 60) * s); q.stroke(); }
      }
    });
  }
  // 字形与墨字
  function glyphTex(ch) {
    return K.cache('g07|gl' + ch + fk(), 180, 180, 1, (q) => {
      q.fillStyle = '#000'; q.font = `150px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText(ch, 90, 96);
    });
  }
  function inkGlyph(ch, col) {
    return K.cache('g07|ig2' + ch + col + fk(), 180, 180, 1, (q) => {
      q.drawImage(glyphTex(ch), 0, 0, 180, 180);
      q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, 180, 180);
      // 飞白：每个字按自己的运笔方向擦出两三道长长的干丝
      q.globalCompositeOperation = 'destination-out';
      const r = A.rng(ch.charCodeAt(0) * 7 + 3);
      const base = (r() - 0.5) * 1.6;
      for (let k = 0; k < 3; k++) {
        const x = 50 + r() * 80, y = 45 + r() * 90, a = base + (r() - 0.5) * 0.9 + (k === 2 ? PI / 2 : 0), L = 70 + r() * 60;
        q.save(); q.translate(x, y); q.rotate(a);
        for (let j = 0; j < 5; j++) { q.fillStyle = `rgba(0,0,0,${0.45 + r() * 0.5})`; q.fillRect(-L / 2 + r() * 16, -7 + j * 3.3 + r() * 0.8, L * (0.55 + r() * 0.45), 0.8 + r() * 0.7); }
        q.restore();
      }
      q.globalCompositeOperation = 'source-over';
    });
  }
  function putGlyph(q, w, col, alpha) {
    const [ch, x, y, size, rot] = w;
    q.save(); q.translate(x, y); q.rotate(rot); q.scale(size / 150, size / 150);
    q.globalAlpha = alpha; q.drawImage(inkGlyph(ch, col), -90, -96, 180, 180); q.globalAlpha = 1;
    q.restore();
  }
  // 白墙（三级马头墙、墙基、青石板路，前五个字已写好）；aged 为几十年后的斑驳版
  function wallTex(aged) {
    return K.cache('g07|wall2' + (aged ? 'B' : 'A') + fk(), W, H, 1, (q) => {
      const r = A.rng(aged ? 2109 : 2101);
      const plaster = aged ? '#bfbbb0' : '#f7f1e3';
      q.save(); wallPath(q); q.clip();
      q.fillStyle = K.lin(q, 0, 60, 0, WB, aged ? [[0, '#b9b8b0'], [0.5, plaster], [1, '#a8a89c']] : [[0, '#efe6d2'], [0.25, plaster], [0.75, '#f1eadb'], [1, '#d9d0bd']]);
      q.fillRect(-60, 0, WEND + 60, WB);
      if (!aged) {
        // 晨光从左上斜照：暖白一片，右下渐冷
        q.fillStyle = K.lin(q, 0, 80, WEND, 560, [[0, 'rgba(255,244,214,0.55)'], [0.55, 'rgba(255,244,214,0)'], [1, 'rgba(150,170,190,0.18)']]); q.fillRect(-60, 0, WEND + 60, WB);
      }
      // 灰皮斑驳与补灰
      for (let k = 0; k < (aged ? 70 : 34); k++) { q.fillStyle = rgba(aged ? (k % 3 ? '#7e7a6c' : '#5e6458') : '#c8bfa8', (aged ? 0.07 : 0.05) + r() * 0.06); A.inkBlob(q, r() * WEND, 80 + r() * 520, 10 + r() * (aged ? 90 : 50), k, 0.55); q.fill(); }
      for (let k = 0; k < 16; k++) { q.fillStyle = rgba('#ffffff', (aged ? 0.02 : 0.12) + r() * (aged ? 0.03 : 0.08)); A.inkBlob(q, r() * WEND, 120 + r() * 400, 20 + r() * 40, k + 50, 0.45); q.fill(); }
      // 雨痕：从檐下垂下的柔边竖纹；老墙上多从缺瓦处垂下，宽窄不一
      const streak = (x, y0, w, L, col, a) => {
        try { q.filter = `blur(${(Math.max(0.6, w * 0.3) * SS()).toFixed(1)}px)`; } catch (e) { /* 无 */ }
        q.fillStyle = K.lin(q, 0, y0, 0, y0 + L, [[0, rgba(col, a)], [0.35, rgba(col, a * 0.7)], [1, rgba(col, 0)]]);
        q.beginPath(); q.moveTo(x - w / 2, y0); q.lineTo(x + w / 2, y0); q.quadraticCurveTo(x + w * 0.4, y0 + L * 0.6, x + w * 0.1, y0 + L); q.lineTo(x - w * 0.1, y0 + L); q.quadraticCurveTo(x - w * 0.5, y0 + L * 0.6, x - w / 2, y0); q.fill();
      };
      if (aged) {
        const spots = [];
        STEPS.forEach(([x0, x1, y], si) => { for (let xx = x0 - 8; xx < x1 + 10; xx += 8) if (brokenTile(si, xx)) spots.push([xx + 1, y + 4]); });
        for (const [x, y] of spots) streak(x, y, 6 + r() * 16, 160 + r() * 300, '#3e3a2e', 0.2 + r() * 0.14);
        for (let k = spots.length; k < 35; k++) {
          const x = r() * WEND, st = STEPS.find((s) => x >= s[0] && x < s[1]) || STEPS[0];
          streak(x, st[2] + 4, 2 + r() * 10, 60 + r() * 240, '#4a4636', 0.1 + r() * 0.12);
        }
      } else {
        for (let k = 0; k < 18; k++) {
          const x = r() * WEND, st = STEPS.find((s) => x >= s[0] && x < s[1]) || STEPS[0];
          streak(x, st[2] + 4, 2 + r() * 5, 40 + r() * 110, '#a0977f', 0.08);
        }
      }
      q.filter = 'none';
      if (!aged) {
        // 桂树〔第4句第2–4字〕投下的斑驳碎影
        try { q.filter = `blur(${(4 * SS()).toFixed(1)}px)`; } catch (e) { /* 无 */ }
        for (let k = 0; k < 90; k++) { const x = 40 + r() * 600, y = 150 + Math.pow(r(), 1.6) * 90; q.fillStyle = `rgba(70,80,70,${0.05 + r() * 0.08})`; q.beginPath(); q.ellipse(x, y, 10 + r() * 22, 5 + r() * 8, r(), 0, TAU); q.fill(); }
        q.filter = 'none';
        // 早先的涂鸦：一个持剑小人、一只拴着绳的酒葫芦
        q.strokeStyle = rgba(INK, 0.78); q.lineWidth = 3.2; q.lineCap = 'round'; q.lineJoin = 'round';
        const sx = 130, sy = 470;
        q.beginPath(); q.arc(sx, sy - 52, 9, 0, TAU); q.stroke();
        q.beginPath(); q.moveTo(sx, sy - 43); q.lineTo(sx + 2, sy - 8); q.lineTo(sx - 14, sy + 18); q.moveTo(sx + 2, sy - 8); q.lineTo(sx + 18, sy + 14);
        q.moveTo(sx, sy - 32); q.lineTo(sx + 20, sy - 44); q.lineTo(sx + 56, sy - 82); q.moveTo(sx, sy - 32); q.lineTo(sx - 18, sy - 20); q.stroke();
        q.lineWidth = 2; q.beginPath(); q.moveTo(sx + 40, sy - 66); q.lineTo(sx + 48, sy - 59); q.stroke();
        // 葫芦：上小下大两瓣、束腰系绳、顶上一截柄
        const gx = sx + 96, gy = sy + 6;
        q.lineWidth = 2.6;
        q.beginPath(); q.moveTo(gx - 4, gy - 14); q.bezierCurveTo(gx - 22, gy - 10, gx - 20, gy + 18, gx, gy + 18); q.bezierCurveTo(gx + 20, gy + 18, gx + 22, gy - 10, gx + 4, gy - 14); q.stroke();
        q.beginPath(); q.moveTo(gx - 4, gy - 14); q.bezierCurveTo(gx - 12, gy - 18, gx - 9, gy - 31, gx, gy - 31); q.bezierCurveTo(gx + 9, gy - 31, gx + 12, gy - 18, gx + 4, gy - 14); q.stroke();
        q.lineWidth = 2; q.beginPath(); q.moveTo(gx - 6, gy - 15); q.lineTo(gx + 6, gy - 13); q.moveTo(gx + 3, gy - 14); q.quadraticCurveTo(gx + 16, gy - 6, gx + 12, gy + 6); q.stroke();
        q.lineWidth = 2.4; q.beginPath(); q.moveTo(gx, gy - 31); q.quadraticCurveTo(gx + 2, gy - 38, gx + 7, gy - 40); q.stroke();
        q.font = `30px ${XYT.FONT}`; q.fillStyle = rgba(INK, 0.7); q.textAlign = 'center'; q.fillText('剑', sx + 40, sy + 54);
      } else {
        // 剥落处露出青砖：小块、边缘参差
        for (let k = 0; k < 3; k++) {
          const px = [130, 720, 960][k], py = [220, 200, 430][k], R = 12 + r() * 14;
          q.save(); A.inkBlob(q, px, py, R, k + 90, 0.62); q.clip();
          q.fillStyle = '#8e8c84'; q.fillRect(px - R * 1.6, py - R * 1.6, R * 3.2, R * 3.2);
          q.strokeStyle = 'rgba(70,70,66,0.35)'; q.lineWidth = 1;
          for (let yy = py - R * 1.6, j = 0; yy < py + R * 1.6; yy += 12, j++) {
            q.beginPath(); q.moveTo(px - R * 1.6, yy); q.lineTo(px + R * 1.6, yy); q.stroke();
            for (let xx = px - R * 1.6 + (j % 2) * 15; xx < px + R * 1.6; xx += 30) { q.beginPath(); q.moveTo(xx, yy); q.lineTo(xx, yy + 12); q.stroke(); }
          }
          q.fillStyle = K.lin(q, 0, py - R, 0, py + R, [[0, 'rgba(40,40,36,0.35)'], [1, 'rgba(40,40,36,0)']]); q.fillRect(px - R * 1.6, py - R * 1.6, R * 3.2, R * 3.2);
          q.restore();
          q.strokeStyle = 'rgba(90,84,70,0.35)'; q.lineWidth = 1; A.inkBlob(q, px, py, R, k + 90, 0.62); q.stroke();
        }
        // 细裂缝
        q.strokeStyle = 'rgba(60,56,48,0.4)'; q.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          let x = 80 + r() * (WEND - 160), y = 150 + r() * 100;
          q.lineWidth = 0.9; q.beginPath(); q.moveTo(x, y);
          for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 26; y += 12 + r() * 22; q.lineTo(x, y); }
          q.stroke();
        }
        // 墙脚潮痕与青苔：一抹墨绿往上洇
        q.fillStyle = K.lin(q, 0, WB - 200, 0, WB, [[0, 'rgba(70,90,60,0)'], [0.6, 'rgba(70,90,60,0.22)'], [1, 'rgba(50,70,46,0.5)']]); q.fillRect(-60, WB - 200, WEND + 60, 200);
        try { q.filter = `blur(${(2.5 * SS()).toFixed(1)}px)`; } catch (e) { /* 无 */ }
        for (let k = 0; k < 70; k++) { const x = r() * WEND, y = WB - Math.pow(r(), 2.2) * 150; q.fillStyle = rgba(r() < 0.5 ? '#4f6b3e' : '#6f8a4a', 0.1 + r() * 0.16); A.inkBlob(q, x, y, 6 + r() * 20, k + 200, 0.5); q.fill(); }
        q.filter = 'none';
        // 枯藤
        q.strokeStyle = 'rgba(70,58,44,0.7)'; q.lineWidth = 1.6;
        for (let k = 0; k < 3; k++) { let x = 30 + k * 60 + r() * 40, y = WB - 30; q.beginPath(); q.moveTo(x, y); for (let j = 0; j < 14; j++) { x += (r() - 0.45) * 22; y -= 14 + r() * 12; q.lineTo(x, y); } q.stroke(); }
        // 只剩“大侠”：其余几字淡成影子；字上剥掉一块块
        const tmp = document.createElement('canvas'), S = SS();
        tmp.width = Math.ceil(W * S); tmp.height = Math.ceil(520 * S);
        const tq = tmp.getContext('2d'); tq.scale(S, S);
        for (const i of [0, 3, 4, 5, 6]) putGlyph(tq, WRIT[i], '#3a3a38', 0.08);
        for (const i of [1, 2]) putGlyph(tq, WRIT[i], '#2a2a2c', 0.8);
        tq.globalCompositeOperation = 'destination-out';
        const r2 = A.rng(404);
        for (let i = 0; i < 80; i++) { tq.fillStyle = `rgba(0,0,0,${0.35 + r2() * 0.65})`; A.inkBlob(tq, 296 + r2() * 240, 210 + r2() * 180, 2 + r2() * 9, i, 0.5); tq.fill(); }
        for (let i = 0; i < 50; i++) { tq.fillStyle = `rgba(0,0,0,${0.2 + r2() * 0.3})`; tq.fillRect(296 + r2() * 240, 200 + r2() * 200, 1 + r2() * 3, 20 + r2() * 60); }
        q.drawImage(tmp, 0, 0, W, 520);
      }
      // 檐下阴影
      for (const [x0, x1, y] of STEPS) bandV(q, x0, y, x1, y + 44, [[0, aged ? 'rgba(30,30,28,0.3)' : 'rgba(60,50,36,0.3)'], [1, 'rgba(40,36,30,0)']]);
      q.restore();
      // 墙基：青石
      const py = WB - 40;
      q.fillStyle = K.lin(q, 0, py, 0, WB, [[0, aged ? '#6a6c64' : '#9a968a'], [1, aged ? '#3e403a' : '#625f55']]); q.fillRect(-60, py, WEND + 60, 40);
      q.strokeStyle = 'rgba(30,30,28,0.45)'; q.lineWidth = 1;
      q.beginPath(); q.moveTo(-60, py + 20); q.lineTo(WEND, py + 20); q.stroke();
      for (let x = -40, k = 0; x < WEND; x += 60 + r() * 30, k++) { q.beginPath(); q.moveTo(x, py + (k % 2 ? 0 : 20)); q.lineTo(x, py + (k % 2 ? 20 : 40)); q.stroke(); }
      q.fillStyle = 'rgba(255,250,235,0.3)'; q.fillRect(-60, py, WEND + 60, 2);
      // 墙头瓦檐：每级一道，端头起翘；老墙缺几片瓦
      STEPS.forEach(([x0, x1, y], si) => {
        const cap = 30, ct = y - cap * 0.7, roofC = aged ? '#4a4c4e' : '#30343a';
        q.fillStyle = K.lin(q, 0, ct, 0, y + 4, [[0, mix(roofC, '#9aa4b0', 0.3)], [1, mix(roofC, '#000000', 0.2)]]);
        q.beginPath(); q.moveTo(x0 - 12, y + 4); q.lineTo(x1 + 14, y + 4); q.lineTo(x1 + 8, ct); q.lineTo(x0 - 6, ct); q.closePath(); q.fill();
        for (let xx = x0 - 8; xx < x1 + 10; xx += 8) {
          if (aged && brokenTile(si, xx)) { q.fillStyle = 'rgba(200,200,190,0.5)'; q.fillRect(xx - 3, ct, 7, y - ct); continue; }
          q.strokeStyle = rgba('#101114', 0.8); q.lineWidth = 2.2; q.beginPath(); q.moveTo(xx, ct); q.lineTo(xx, y + 2); q.stroke();
          q.strokeStyle = rgba(aged ? '#b8bcc0' : '#f0f4fa', aged ? 0.15 : 0.3); q.lineWidth = 1.1; q.beginPath(); q.moveTo(xx + 2.6, ct); q.lineTo(xx + 2.6, y + 2); q.stroke();
          q.fillStyle = '#1e2024'; q.beginPath(); q.arc(xx + 1, y + 5, 3.4, 0, TAU); q.fill();
        }
        const rt = y - cap;
        q.fillStyle = mix(roofC, '#000000', 0.3); q.fillRect(x0 - 8, rt, x1 - x0 + 18, cap * 0.32);
        q.fillStyle = rgba('#f4f8fc', aged ? 0.15 : 0.5); q.fillRect(x0 - 8, rt, x1 - x0 + 18, 1.6);
        q.fillStyle = mix(roofC, '#000000', 0.3);
        q.beginPath(); q.moveTo(x1 + 10, rt); q.quadraticCurveTo(x1 + 22, rt - 4, x1 + 30, rt - 18); q.lineTo(x1 + 24, rt + cap * 0.32); q.lineTo(x1 + 10, rt + cap * 0.4); q.closePath(); q.fill();
      });
      // 墙的右端：转角的一道竖影
      q.fillStyle = aged ? '#8f8e86' : '#d6cdb8'; q.fillRect(WEND - 6, 74, 6, WB - 74);
      q.fillStyle = 'rgba(0,0,0,0.12)'; q.fillRect(WEND - 2, 74, 2, WB - 74);
      // 青石板路
      q.fillStyle = K.lin(q, 0, WB, 0, H, aged ? [[0, '#70726c'], [1, '#3c3e3a']] : [[0, '#b2ab98'], [0.5, '#958e7c'], [1, '#6a6458']]); q.fillRect(-60, WB, W + 120, H - WB);
      q.strokeStyle = aged ? 'rgba(30,34,30,0.5)' : 'rgba(60,54,44,0.32)'; q.lineWidth = 1.2;
      for (let k = 0; k < 5; k++) { const yy = WB + 10 + Math.pow(k / 5, 1.5) * 108; q.beginPath(); q.moveTo(-60, yy); q.lineTo(W + 60, yy); q.stroke(); }
      for (let k = -12; k <= 14; k++) { const x0 = 620 + k * 70; q.beginPath(); q.moveTo(x0, WB); q.lineTo(620 + k * 150, H + 40); q.stroke(); }
      if (!aged) { q.fillStyle = K.lin(q, 0, WB, W, H, [[0, 'rgba(255,240,205,0.25)'], [1, 'rgba(255,240,205,0)']]); q.fillRect(-60, WB, W + 120, H - WB); }
      // 墙脚的草
      q.strokeStyle = aged ? '#5a6a3a' : '#5f7a44'; q.lineWidth = 1.4;
      for (let k = 0; k < (aged ? 120 : 50); k++) { const gx = r() * WEND, gh = 6 + r() * (aged ? 30 : 16); q.beginPath(); q.moveTo(gx, WB + 2); q.quadraticCurveTo(gx + 2, WB - gh * 0.5, gx + (r() - 0.4) * 10, WB - gh); q.stroke(); }
      if (aged) for (let k = 0; k < 40; k++) leafSprite(q, r() * W, WB + 6 + r() * 100, 0.32 + r() * 0.2, r() * TAU, r() < 0.5 ? -1 : 1, 0.85);
      else {
        // 晨光斜斜地从左上照进巷子（烘焙进墙面）
        q.globalCompositeOperation = 'screen';
        try { q.filter = `blur(${(10 * SS()).toFixed(1)}px)`; } catch (e) { /* 无 */ }
        for (let i = 0; i < 6; i++) {
          const a = 0.62 + i * 0.075 + (h2(i, 3) - 0.5) * 0.04, w0 = 18 + 30 * h2(i, 4), w1 = 70 + 110 * h2(i, 5), L = 1500;
          q.fillStyle = K.lin(q, -160, -200, -160 + Math.cos(a) * L, -200 + Math.sin(a) * L, [[0, 'rgba(255,240,200,0.26)'], [0.5, 'rgba(255,240,200,0.11)'], [1, 'rgba(255,240,200,0)']]);
          const nx = -Math.sin(a), ny = Math.cos(a);
          q.beginPath(); q.moveTo(-160 + nx * w0, -200 + ny * w0); q.lineTo(-160 + Math.cos(a) * L + nx * w1, -200 + Math.sin(a) * L + ny * w1);
          q.lineTo(-160 + Math.cos(a) * L - nx * w1, -200 + Math.sin(a) * L - ny * w1); q.lineTo(-160 - nx * w0, -200 - ny * w0); q.closePath(); q.fill();
        }
        q.filter = 'none'; q.globalCompositeOperation = 'source-over';
        // 前五个字（墨已写好，压在光上，保持浓黑）
        for (let i = 0; i < 5; i++) putGlyph(q, WRIT[i], INK, 1);
      }
    });
  }
  // 写字的扫笔路径：字内局部坐标（-1..1），u 0..1；rows 往返几趟
  function sweep(u, rows) {
    if (rows === 1) return [lerp(-0.62, 0.66, u), 0.02 + 0.05 * Math.sin(u * PI)];
    const k = u * rows, i = Math.min(rows - 1, Math.floor(k)), f = k - i, dir = i % 2 ? -1 : 1;
    return [dir * lerp(-0.58, 0.58, smooth(f)), lerp(-0.6, 0.62, (i + f) / rows)];
  }
  // 局部写出：prog 写到哪；dry 之后只剩一丝丝断续的飞白
  function writeGlyph(g, w, prog, dry, rows) {
    const [ch, x, y, size, rot] = w, sc = size / 150, S = SS();
    if (prog <= 0) return;
    const img = inkGlyph(ch, INK);
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    if (prog >= 1 && dry >= 1) { g.drawImage(img, -90, -96, 180, 180); g.restore(); return; }
    const k = S * sc, side = Math.ceil(180 * k);
    const B = scratch('g07w', side, side), q = B.q;
    q.setTransform(k, 0, 0, k, 0, 0);
    const P = (u) => { const [px, py] = sweep(u, rows); return [90 + px * 78, 96 + py * 78]; };
    const wetEnd = Math.min(prog, dry);
    if (wetEnd > 0) {
      q.strokeStyle = '#000'; q.lineWidth = rows === 1 ? 70 : 54; q.lineCap = 'round'; q.lineJoin = 'round';
      q.beginPath();
      const n = Math.max(2, Math.ceil(wetEnd * 60));
      for (let i = 0; i <= n; i++) { const [px, py] = P((wetEnd * i) / n); i ? q.lineTo(px, py) : q.moveTo(px, py); }
      q.stroke();
    }
    if (prog > dry) {
      q.lineCap = 'butt';
      const n = Math.max(2, Math.ceil((prog - dry) * 90));
      for (let b = 0; b < 9; b++) {
        const off = (b / 8 - 0.5) * 48;
        q.lineWidth = 1.3 + 1.6 * h2(b, 5);
        q.beginPath();
        let on = false;
        for (let i = 0; i <= n; i++) {
          const u = dry + ((prog - dry) * i) / n, [px, py] = P(u), [qx, qy] = P(Math.min(1, u + 0.01));
          const tx = qx - px, ty = qy - py, l = Math.hypot(tx, ty) || 1;
          const dens = 1 - smooth(((u - dry) / Math.max(0.05, 1 - dry)) * 2.2);
          const keep = h2(b * 131 + Math.floor(u * 90), 17) < 0.15 + 0.6 * dens;
          const X = px - (ty / l) * off, Y = py + (tx / l) * off;
          if (keep) { if (!on) { q.moveTo(X, Y); on = true; } else q.lineTo(X, Y); } else on = false;
        }
        q.strokeStyle = `rgba(0,0,0,${0.5 + 0.5 * h2(b, 3)})`;
        q.stroke();
      }
    }
    q.globalCompositeOperation = 'source-in';
    q.drawImage(img, 0, 0, 180, 180);
    q.globalCompositeOperation = 'source-over';
    g.drawImage(B.cv, 0, 0, side, side, -90, -96, 180, 180);
    g.restore();
  }
  function brushTip(w, prog, rows) {
    const [, x, y, size, rot] = w, sc = size / 150, [px, py] = sweep(clamp(prog), rows);
    const lx = px * 78 * sc, ly = (py * 78 - 6) * sc;
    return [x + lx * Math.cos(rot) - ly * Math.sin(rot), y + lx * Math.sin(rot) + ly * Math.cos(rot)];
  }
  // 笔干之后的一记拖笔：从“游”的末笔往右下拖出一截干丝（不受字形限制）
  const D0 = brushTip(WRIT[6], 0.9, 3);
  const DRAG = (u) => [D0[0] + 46 * u + 3 * Math.sin(u * 7), D0[1] + 58 * u - 10 * Math.sin(u * PI)];
  function dryDrag(g, u) {
    if (u <= 0) return;
    g.lineCap = 'round';
    const n = Math.ceil(u * 50), nx = -0.78, ny = 0.62;
    for (let b = 0; b < 15; b++) {
      const off = (b / 14 - 0.5) * 24;
      g.strokeStyle = rgba(INK, 0.4 + 0.5 * h2(b, 8)); g.lineWidth = 0.9 + 1.5 * h2(b, 9);
      g.beginPath(); let on = false;
      for (let i = 0; i <= n; i++) {
        const v = (u * i) / n, [px, py] = DRAG(v), w = 1 - 0.55 * v;
        // 丝越往后越断、越细：靠外的毫先断
        const keep = h2(b * 97 + Math.floor(v * 26), 23) < 0.92 - v * (0.5 + 0.9 * Math.abs(off) / 12);
        const X = px + nx * off * w, Y = py + ny * off * w;
        if (keep) { if (!on) { g.moveTo(X, Y); on = true; } else g.lineTo(X, Y); } else on = false;
      }
      g.stroke();
    }
  }
  // 大毛笔：从握笔处 (hx, hy) 指向 ang，长 L；wet 笔头湿度
  function bigBrush(g, hx, hy, ang, L, wet) {
    g.save(); g.translate(hx, hy); g.rotate(ang);
    g.fillStyle = K.lin(g, 0, -3, 0, 3, [[0, '#ecd696'], [0.5, '#b89654'], [1, '#7a5e30']]);
    g.fillRect(-L * 0.42, -2.7, L * 0.42 + L * 0.62, 5.4);
    g.fillStyle = 'rgba(90,60,30,0.6)'; for (const u of [-0.28, 0.1, 0.42]) g.fillRect(u * L, -2.9, 2, 5.8);
    const b0 = L * 0.62;
    g.fillStyle = '#3a2a1e'; g.fillRect(b0 - 4, -3.7, 8, 7.4);
    g.fillStyle = mix('#e8dcc0', '#121218', 0.25 + 0.75 * wet);
    g.beginPath(); g.moveTo(b0 + 3, -4.4); g.quadraticCurveTo(b0 + L * 0.28, -3.8, b0 + L * 0.44, 0); g.quadraticCurveTo(b0 + L * 0.28, 3.8, b0 + 3, 4.4); g.closePath(); g.fill();
    if (wet < 0.5) { g.strokeStyle = 'rgba(40,36,30,0.6)'; g.lineWidth = 0.7; for (let j = -2; j <= 2; j++) { g.beginPath(); g.moveTo(b0 + 6, j * 1.2); g.lineTo(b0 + L * 0.44 + 2 * Math.abs(j), j * 2.2); g.stroke(); } }
    else { g.fillStyle = `rgba(255,255,255,${0.3 * wet})`; g.beginPath(); g.ellipse(b0 + L * 0.18, -1.7, L * 0.1, 0.9, 0, 0, TAU); g.fill(); }
    g.restore();
    return [hx + Math.cos(ang) * (b0 + L * 0.44), hy + Math.sin(ang) * (b0 + L * 0.44)];
  }
  // 麻雀：x, y 脚下；dir 朝向；fly 起飞；ph 振翅相位
  function sparrow(g, x, y, s, dir, fly, ph) {
    g.save(); g.translate(x, y); g.scale(dir * s, s);
    if (fly) {
      const f = Math.sin(ph);
      g.fillStyle = '#5a4030';
      g.beginPath(); g.moveTo(-2, -6); g.quadraticCurveTo(-8, -14 - f * 10, -16, -8 - f * 14); g.quadraticCurveTo(-8, -6, -2, -4); g.fill();
      g.beginPath(); g.moveTo(2, -6); g.quadraticCurveTo(8, -14 - f * 10, 14, -6 - f * 12); g.quadraticCurveTo(8, -5, 2, -4); g.fill();
    }
    g.fillStyle = '#8a6646'; g.beginPath(); g.ellipse(0, -6, 7, 4.6, -0.2, 0, TAU); g.fill();
    g.fillStyle = '#5a3c28'; g.beginPath(); g.moveTo(-6, -6); g.lineTo(-13, -9); g.lineTo(-12, -5); g.closePath(); g.fill();
    g.fillStyle = '#6a4630'; g.beginPath(); g.arc(5.5, -10, 3.6, 0, TAU); g.fill();
    g.fillStyle = '#efe6d6'; g.beginPath(); g.ellipse(6.4, -9, 1.8, 1.4, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8dcc4'; g.beginPath(); g.ellipse(1, -3.6, 4.5, 2, 0, 0, TAU); g.fill();
    g.fillStyle = '#1a1210'; g.beginPath(); g.moveTo(8.6, -10.5); g.lineTo(11.4, -9.6); g.lineTo(8.6, -8.8); g.fill();
    if (!fly) { g.strokeStyle = '#4a3020'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -2); g.lineTo(-0.5, 0); g.moveTo(2, -2); g.lineTo(2, 0); g.stroke(); }
    g.restore();
  }
  // 时间点：写字从 wStart 起；“墨”字起笔干，“尽”字笔尽，再干拖一笔
  const wStart = 0.22;
  function wProg(lt, k) {
    if (lt <= wStart) return 0;
    if (lt <= k[3]) return 0.86 * (lt - wStart) / (k[3] - wStart);
    return 0.86 + 0.04 * easeOut(seg(lt, k[3], k[3] + 0.2));
  }
  const wDry = (k) => 0.86 * (k[2] - wStart) / (k[3] - wStart);
  const dragU = (lt, k) => easeOut(seg(lt, k[3] + 0.12, k[3] + 0.55));
  function curTip(lt, k) {
    if (lt < wStart) return brushTip(WRIT[5], clamp((lt + 0.25) / 0.45), 1);
    if (lt > k[3] + 0.12) return DRAG(dragU(lt, k));
    return brushTip(WRIT[6], wProg(lt, k), 3);
  }
  function splats(k) {
    const out = [];
    for (const [t0, n, cx, cy, sx, sy, sd] of [[k[5] + 0.12, 26, 640, 210, 250, 140, 1], [k[6] + 0.1, 22, 660, 380, 210, 150, 2]]) {
      for (let i = 0; i < n; i++) {
        const r = h2(i, sd * 7) < 0.15 ? 4 + h2(i, sd * 7 + 1) * 4 : 1.2 + h2(i, sd * 7 + 2) * 2.4;
        out.push({ t: t0 + h2(i, sd * 7 + 3) * 0.12, x: cx + (h2(i, sd * 7 + 4) - 0.5) * sx * 2, y: cy + (h2(i, sd * 7 + 5) - 0.5) * sy, r, a: h2(i, sd * 7 + 6) * 3 });
      }
    }
    return out;
  }
  function drawSplats(g, lt, k) {
    g.fillStyle = rgba(INK, 0.9);
    for (const sp of splats(k)) {
      if (lt < sp.t) continue;
      const e = easeOut(seg(lt, sp.t, sp.t + 0.08));
      g.beginPath(); g.ellipse(sp.x, sp.y, sp.r * e, sp.r * e * 0.8, sp.a, 0, TAU); g.fill();
      if (sp.r > 3) { g.beginPath(); g.ellipse(sp.x + Math.cos(sp.a) * sp.r * 1.7, sp.y + Math.sin(sp.a) * sp.r * 1.7, sp.r * 0.35 * e, sp.r * 0.3 * e, 0, 0, TAU); g.fill(); }
    }
  }
  // 墨淌：几道细细的垂痕慢慢往下爬（lt 取到时间跳转为止）
  function drips(g, lt) {
    g.strokeStyle = rgba(INK, 0.8); g.lineWidth = 1.8; g.lineCap = 'round'; g.fillStyle = INK;
    for (const [x, y0, born, sp, mx] of [[374, 346, -1.6, 9, 46], [446, 362, -1.2, 7, 30], [562, 350, -1.5, 8, 38], [776, 372, 0.9, 16, 44]]) {
      const L = Math.min(mx, Math.max(0, lt - born) * sp * (1 - 0.3 * Math.max(0, lt - born) / 6));
      if (L <= 0.5) continue;
      g.beginPath(); g.moveTo(x - 1, y0 - 4); g.quadraticCurveTo(x + 1.5, y0 + L * 0.5, x + 0.4, y0 + L); g.stroke();
      g.beginPath(); g.ellipse(x + 0.4, y0 + L + 1.2, 2.2, 2.9, 0, 0, TAU); g.fill();
    }
  }
  const BOWL = [812, GY + 10];
  function inkBowl(g, x, y, lt, k) {
    g.fillStyle = 'rgba(40,30,20,0.25)'; g.beginPath(); g.ellipse(x + 8, y + 3, 40, 6, 0, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, x - 34, 0, x + 34, 0, [[0, '#b8b4a6'], [0.4, '#f6f2e8'], [1, '#8a877c']]);
    g.beginPath(); g.moveTo(x - 34, y - 22); g.quadraticCurveTo(x - 30, y + 2, x, y + 2); g.quadraticCurveTo(x + 30, y + 2, x + 34, y - 22); g.closePath(); g.fill();
    g.strokeStyle = '#3c5a8a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 30, y - 14); g.quadraticCurveTo(x, y - 8, x + 30, y - 14); g.stroke();
    g.lineWidth = 1; g.beginPath(); g.moveTo(x - 12, y - 6); g.quadraticCurveTo(x - 4, y - 12, x + 4, y - 6); g.stroke();
    g.fillStyle = '#ece8de'; g.beginPath(); g.ellipse(x, y - 22, 34, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#121216'; g.beginPath(); g.ellipse(x, y - 21, 29, 5.2, 0, 0, TAU); g.fill();
    const age = lt - (k[4] + 0.12);
    if (age > 0 && age < 0.8) { g.strokeStyle = `rgba(210,220,236,${0.6 * (1 - age / 0.8)})`; g.lineWidth = 1; g.beginPath(); g.ellipse(x - 4, y - 21, 6 + age * 30, (6 + age * 30) * 0.18, 0, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(x - 10, y - 22.5, 9, 1.2, 0, 0, TAU); g.fill();
  }
  function birds(g, c, lt, t, k) {
    const tf = k[5] + 0.05;
    for (const [x0, dir, i] of [[600, 1, 0], [650, -1, 1], [704, 1, 2]]) {
      const y0 = 84, age = lt - tf - i * 0.06;
      if (age <= 0) {
        const hop = Math.max(0, Math.sin((c.b.x + i * 0.5) * PI)) * 4 * (h2(c.b.i, i) < 0.5 ? 1 : 0);
        sparrow(g, x0 + Math.sin(t * 0.5 + i) * 3, y0 - hop, 1.5, dir, false, 0);
      } else if (age < 2.5) {
        const x = x0 + age * (260 + 60 * i) * (i === 1 ? -0.6 : 1), y = y0 - age * 170 + age * age * 10;
        if (y > -40) sparrow(g, x, y, 1.5, i === 1 ? -1 : 1, true, t * 40 + i);
      }
    }
  }
  function fgLeaves(g, t, calm) {
    const tex = K.cache('g07|fgleaf', 380, 280, 0.5, (q) => {
      const r = A.rng(9);
      try { q.filter = `blur(${(5 * SS() * 0.5).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      for (let k = 0; k < 10; k++) {
        const x = 20 + r() * 240, y = 10 + r() * 150, a = 0.2 + r() * 0.9, L = 90 + r() * 80;
        q.save(); q.translate(x, y); q.rotate(a);
        q.fillStyle = r() < 0.5 ? '#1c2c20' : '#2c4430';
        q.beginPath(); q.moveTo(0, 0); q.quadraticCurveTo(L * 0.4, -14, L, 0); q.quadraticCurveTo(L * 0.4, 14, 0, 0); q.fill();
        q.restore();
      }
    });
    g.save(); g.translate(-90, -70); g.rotate((0.03 * Math.sin(t * 1.1) + 0.015 * Math.sin(t * 2.7)) * calm);
    g.drawImage(tex, 0, 0, 380, 280);
    g.restore();
  }
  // 右上角垂下的柳丝（随风摆）；aged 时只剩枯丝
  function willow(g, t, aged, calm) {
    g.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const sx = 1050 + h2(i, 41) * 260, sy = -10, len = 50 + h2(i, 42) * 70 * (aged ? 0.7 : 1);
      const ph = t * (1.2 + 0.5 * h2(i, 43)) + i, sw = Math.sin(ph) * 10 * calm + 6;
      const ex = sx + sw, ey = sy + len;
      g.strokeStyle = aged ? rgba('#6a5e4a', 0.55) : rgba(i % 3 ? '#7f9a50' : '#5a7a3a', 0.85); g.lineWidth = 1;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + sw * 0.2, sy + len * 0.5, ex, ey); g.stroke();
      if (aged) continue;
      g.strokeStyle = rgba(i % 2 ? '#a8c070' : '#7f9a50', 0.9); g.lineWidth = 2.4;
      g.beginPath();
      for (let k = 2; k < 11; k++) { const u = k / 11, px = lerp(sx, ex, u) + sw * 0.2 * (1 - u) * u * 2, py = lerp(sy, ey, u); const dd = (k % 2 ? 1 : -1) * 3.6; g.moveTo(px, py); g.lineTo(px + dd + sw * 0.04, py + 5); }
      g.stroke();
    }
  }

  // ---------- 少年：套件里店小二的脸是墨色剪影，这里补一张晨光里的暖色侧脸 ----------
  const corner = (p) => [p[0], p[1], 1];
  const FACE_M = [[-1, -12.3], [-7.6, -11.4], [-11.3, -6], [-11.5, 0.4], [-9, 6.4], corner([-5.6, 9.4]), [-1.5, 9.8], [3.8, 11.7],
    [6.8, 10.8], corner([7.6, 8.6]), [7.3, 7.4], corner([8.6, 6.2]), [8.1, 5.1], corner([8.8, 4.1]), corner([11.1, 1.7]), [8.9, -2.3], [9.5, -4.3], [8.4, -8.6], [4.6, -11.7]];
  const CAP_Y = [[7.4, -8.4], corner([8.8, -5.8]), [6, -9.6], corner([6.4, -6.8]), [4, -11.8], [-2, -13.6], [-8.6, -11.6], [-12, -5.4], [-11.8, 2], corner([-8.6, 7.2]), [-5.6, 1], [-2.4, -3.6], [2.4, -6.4], corner([7.2, -6.2])];
  function pathC(g, pts) {
    const n = pts.length, at = (i) => pts[((i % n) + n) % n], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const p0 = at(0), st = p0[2] ? p0 : at(-1)[2] ? at(-1) : mid(at(-1), p0);
    g.moveTo(st[0], st[1]);
    for (let i = 0; i < n; i++) {
      const p = at(i), q = at(i + 1);
      if (p[2]) { if (i > 0) g.lineTo(p[0], p[1]); continue; }
      const e = q[2] ? q : mid(p, q);
      g.quadraticCurveTo(p[0], p[1], e[0], e[1]);
    }
    g.closePath();
  }
  // 脸上的墨点（头部局部坐标，鼻尖一大滴）
  const FACE_SPOTS = [[10.1, 1.5, 2.3], [6.4, 3.8, 1.0], [4.2, 6.2, 0.8], [7.8, -1.2, 0.7], [2.6, 2.4, 0.6], [8.2, -5.0, 0.6]];
  function boyFace(g, P, mood, spotT) {
    const S = BOY.s * 176 / 180, f = -1;
    const dx = P.top[0] - P.head[0], dy = P.top[1] - P.head[1], ang = Math.atan2(dx * f, -dy);
    g.save(); g.translate(P.head[0], P.head[1]); g.scale(f * S, S); g.rotate(ang);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // 颈
    g.fillStyle = '#c9a283'; g.beginPath(); g.moveTo(-5.4, 6.2); g.lineTo(3.2, 9.2); g.lineTo(3.6, 16.5); g.lineTo(-5.6, 15.8); g.closePath(); g.fill();
    // 脸：朝光的一侧亮，后脑一侧暗；颊上一点红
    g.beginPath(); pathC(g, FACE_M);
    g.fillStyle = K.lin(g, -11, 0, 11, 0, [[0, '#c79e7c'], [0.45, '#e5c6a6'], [1, '#f2dcc2']]); g.fill();
    g.save(); g.clip();
    g.fillStyle = 'rgba(224,128,104,0.22)'; g.beginPath(); g.ellipse(4.6, 3.6, 3.6, 2.6, 0, 0, TAU); g.fill();
    if (mood === 'laugh') { g.fillStyle = 'rgba(224,128,104,0.18)'; g.beginPath(); g.ellipse(5.4, 2.4, 3, 2, 0, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(58,38,26,0.9)'; g.lineWidth = 0.65; g.beginPath(); pathC(g, FACE_M); g.stroke();
    // 耳
    g.fillStyle = '#d9b493'; g.beginPath(); g.ellipse(-3.2, 1.6, 2.3, 3.5, 0.15, 0, TAU); g.fill(); g.lineWidth = 0.45; g.stroke();
    // 眉眼：平时一道短横；笑时眯成弯月；嘴角张开
    g.strokeStyle = '#24180f';
    g.lineWidth = 1.1; g.beginPath(); g.moveTo(4.2, -6.4); g.quadraticCurveTo(6.4, -7.6, 8.5, -6.6); g.stroke();
    g.lineWidth = 0.9; g.beginPath();
    if (mood === 'laugh') { g.moveTo(4.4, -2.7); g.quadraticCurveTo(6.1, -4.9, 7.9, -2.9); }
    else { g.moveTo(4.8, -3.4); g.quadraticCurveTo(6.3, -3.9, 7.7, -3.3); }
    g.stroke();
    if (mood === 'laugh') { g.fillStyle = '#4a2018'; g.beginPath(); g.moveTo(8.8, 5.0); g.quadraticCurveTo(6.2, 5.6, 5.8, 6.7); g.quadraticCurveTo(7.4, 8.2, 8.3, 7.7); g.closePath(); g.fill(); }
    // 发：盖住头顶、后脑与鬓角；顶上一个小髻
    g.fillStyle = '#1d1a16'; g.beginPath(); pathC(g, CAP_Y); g.fill();
    g.fillStyle = 'rgba(150,160,170,0.25)'; g.lineWidth = 0.5; g.strokeStyle = 'rgba(170,176,180,0.35)';
    g.beginPath(); g.moveTo(3, -11.6); g.quadraticCurveTo(-4, -13, -9.6, -9.4); g.stroke();
    g.fillStyle = '#8a7a62'; g.beginPath(); g.ellipse(-5.2, -14.2, 4.4, 3.8, -0.5, 0, TAU); g.fill();
    g.strokeStyle = '#675a46'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(6.6, -10.4); g.quadraticCurveTo(-1, -13.6, -11.2, -7.6); g.stroke();
    // 甩笔溅回来的墨点
    if (spotT != null) {
      g.fillStyle = INK;
      FACE_SPOTS.forEach(([x, y, r], i) => {
        const e = easeOut(seg(spotT, i * 0.015, 0.05 + i * 0.015));
        if (e <= 0) return;
        g.beginPath(); g.ellipse(x, y, r * e, r * e * 0.86, 0.4 * i, 0, TAU); g.fill();
        if (i === 0) { g.beginPath(); g.arc(x - 1.6, y + 2.4 * e, 0.7 * e, 0, TAU); g.arc(x + 1.2, y - 2.6, 0.5 * e, 0, TAU); g.fill(); }
      });
    }
    g.restore();
  }
  // 姿势时间表：写字 → 跪下蘸墨（千）→ 举笔甩墨（情）→ 向前再甩（万，墨溅回脸上）→ 挠头大笑（怨）
  function poseList(k) { return [[-99, 'write'], [k[4] - 0.08, 'dip'], [k[5] - 0.1, 'flick'], [k[6] - 0.06, 'flick2'], [k[7] - 0.06, 'scratch']]; }
  const XF = 0.06; // 换姿势的交叠半宽（共 0.12 秒）
  function poseMix(lt, k) {
    const L = poseList(k);
    let i = 0;
    while (i + 1 < L.length && lt >= L[i + 1][0]) i++;
    if (i + 1 < L.length && lt > L[i + 1][0] - XF) return [L[i][1], L[i + 1][1], smooth((lt - L[i + 1][0] + XF) / (2 * XF))];
    if (i > 0 && lt < L[i][0] + XF) return [L[i - 1][1], L[i][1], smooth((lt - L[i][0] + XF) / (2 * XF))];
    return [L[i][1], null, 0];
  }
  function boyState(name, lt, k, t) {
    const o = { stage: 'youth', facing: -1, wind: 0.3, seed: 3 };
    let x = BOY.x, y = BOY.y;
    if (name === 'write') {
      // 踮着脚、身子随笔慢慢往右挪
      o.pose = 'reach'; o.lean = 0.05;
      const pr = clamp((lt - wStart) / (k[3] + 0.55 - wStart));
      x = lerp(918, 964, smooth(pr)) + 3 * Math.sin(lt * 4.2);
      y = GY - 7 - 1.5 * Math.sin(lt * 6.3);
    } else if (name === 'dip') { o.pose = 'kneel'; o.head = 0.08; x = 932; }
    else if (name === 'flick') { o.pose = 'swordUp'; o.head = 0.12; x = 936; }
    else if (name === 'flick2') { o.pose = 'reach'; o.lean = 0.1; x = 940; y = GY - 3; }
    else {
      // 挠头大笑：手按在头顶来回挠，“怨”字上身往上一颠
      o.pose = 'drink'; o.lean = 0.02;
      const sc = seg(lt, k[7] - 0.06, k[8] + 0.2);
      o.head = 0.5 + 0.09 * Math.sin(lt * TAU * 8) * Math.sin(PI * sc);
      x = 934; y = GY - 9 * Math.sin(PI * clamp((lt - k[7]) / 0.26)) * (lt > k[7] ? 1 : 0);
    }
    return { x, y, opts: o, pose: name };
  }
  function drawBoyBrush(g, lt, k, B, t, P) {
    const hx = P.handN[0], hy = P.handN[1];
    let ang, L = 78, wet = 1;
    if (B.pose === 'write') {
      const tip = curTip(lt, k);
      ang = Math.atan2(tip[1] - hy, tip[0] - hx); L = clamp(Math.hypot(tip[0] - hx, tip[1] - hy) / 1.06, 34, 100);
      wet = 1 - seg(lt, k[2] - 0.1, k[3]);
    } else if (B.pose === 'dip') {
      const bx = BOWL[0] + 2, by = BOWL[1] - 20;
      ang = Math.atan2(by - hy, bx - hx) + 0.06 * Math.sin(lt * 14) * Math.exp(-Math.max(0, lt - k[4]) / 0.3);
      L = clamp(Math.hypot(bx - hx, by - hy) / 1.06, 50, 100);
      wet = seg(lt, k[4] + 0.08, k[4] + 0.3);
    } else if (B.pose === 'flick') {
      ang = -1.25 + 0.85 * Math.sin((lt - k[5]) * 22) * Math.exp(-Math.max(0, lt - k[5]) / 0.4);
      // 笔尖别越过 x=1030（右边是歌词）
      const reach = L * 1.06;
      if (hx + Math.cos(ang) * reach > 1030) ang = -Math.acos(clamp((1030 - hx) / reach, -1, 1));
    } else if (B.pose === 'flick2') { ang = PI + 0.12 + 0.6 * Math.sin((lt - k[6]) * 24) * Math.exp(-Math.max(0, lt - k[6]) / 0.35); wet = 0.8; }
    else { ang = -1.05 + 0.12 * Math.sin(lt * TAU * 8) * seg(lt, k[7] - 0.06, k[7] + 0.1); L = 70; wet = 0.6; }
    const tip = bigBrush(g, hx, hy, ang, L, wet);
    // 甩笔瞬间从笔尖抛出的墨点：只往左上（墙上）飞
    for (const [t0, sd, a0, a1] of [[k[5] + 0.04, 3, -2.9, -2.2], [k[6] + 0.03, 4, -3.05, -2.55]]) {
      const age = lt - t0;
      if (age < 0 || age > 0.35) continue;
      g.fillStyle = rgba(INK, 0.9 * (1 - age / 0.35));
      for (let i = 0; i < 30; i++) {
        const an = lerp(a0, a1, h2(i, sd)), v = 500 + 700 * h2(i, sd + 1);
        const x = tip[0] + Math.cos(an) * v * age, y = tip[1] + Math.sin(an) * v * age + 600 * age * age;
        g.beginPath(); g.ellipse(x, y, 1.4 + 2.4 * h2(i, sd + 2), 1.2 + 1.6 * h2(i, sd + 2), an, 0, TAU); g.fill();
      }
    }
    // 第二下甩笔：几滴墨从笔杆上弹回，打在自己脸上
    const ab = lt - k[6];
    if (ab > 0 && ab < 0.08) {
      g.fillStyle = INK;
      for (let i = 0; i < 6; i++) {
        const u = ab / 0.08, sx = lerp(tip[0], hx, 0.5), x = lerp(sx, P.mouth[0] + 4 * h2(i, 7), u), y = lerp(hy - 10, P.mouth[1] - 10 + 10 * h2(i, 8), u);
        g.beginPath(); g.ellipse(x, y, 2.2, 1.2, 0.3, 0, TAU); g.fill();
      }
    }
    // 肩上抹布也落了几点
    if (lt > k[6] + 0.06) {
      g.fillStyle = INK;
      for (let i = 0; i < 5; i++) { const px = P.shoulderN[0] + (h2(i, 9) - 0.5) * 22, py = P.shoulderN[1] - 2 + h2(i, 10) * 18; g.beginPath(); g.arc(px, py, 1.2 + 1.6 * h2(i, 11), 0, TAU); g.fill(); }
    }
  }
  function drawBoy(q, name, lt, k, t) {
    const B = boyState(name, lt, k, t), o = B.opts;
    F.draw(q, 'xiaoyao', B.x, B.y, BOY.s, t, Object.assign({ part: 'back' }, o));
    const P = F.points('xiaoyao', B.x, B.y, BOY.s, t, o);
    boyFace(q, P, name === 'scratch' ? 'laugh' : 'calm', lt > k[6] + 0.07 ? lt - k[6] - 0.07 : null);
    F.draw(q, 'xiaoyao', B.x, B.y, BOY.s, t, Object.assign({ part: 'front' }, o));
    drawBoyBrush(q, lt, k, B, t, P);
    return B;
  }
  // 少年整层：先画进草稿层（换姿势时两张按 1-u / u 叠起来），地上投一道柔影，再整体贴回
  const BOXB = [560, 120, 1120, 720];
  function boyLayer(g, lt, k, t, alpha) {
    if (alpha <= 0.01) return;
    const [pa, pb, u] = poseMix(lt, k);
    const m = g.getTransform(), D = devBox(g, BOXB);
    const setT = (q) => q.setTransform(m.a, m.b, m.c, m.d, m.e - D.X0, m.f - D.Y0);
    const Bf = scratch('g07boy', D.w, D.h);
    let fx = 0;
    if (!pb) { setT(Bf.q); fx = drawBoy(Bf.q, pa, lt, k, t).x - 20; }
    else {
      for (const [nm, a] of [[pa, 1 - u], [pb, u]]) {
        const B2 = scratch('g07boy2', D.w, D.h);
        setT(B2.q); const st = drawBoy(B2.q, nm, lt, k, t);
        Bf.q.globalAlpha = a; Bf.q.drawImage(B2.cv, 0, 0, D.w, D.h, 0, 0, D.w, D.h);
        fx += (st.x - 20) * a;
      }
      Bf.q.globalAlpha = 1;
    }
    // 地上的影：1/4 分辨率剪影（自然发虚），从脚下往右下铺开
    const R4 = 4, SH = scratch('g07boysh', D.w / R4, D.h / R4);
    SH.q.drawImage(Bf.cv, 0, 0, D.w, D.h, 0, 0, SH.w, SH.h);
    SH.q.globalCompositeOperation = 'source-in'; SH.q.fillStyle = '#5a5040'; SH.q.fillRect(0, 0, SH.w + 2, SH.h + 2); SH.q.globalCompositeOperation = 'source-over';
    const fdx = m.a * fx + m.c * GY + m.e, fdy = m.b * fx + m.d * GY + m.f;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(fdx, fdy); g.transform(1, 0, -0.62, -0.24, 0, 0); g.translate(-fdx, -fdy);
    g.globalAlpha = 0.42 * alpha; g.drawImage(SH.cv, 0, 0, SH.w, SH.h, D.X0, D.Y0, D.w, D.h);
    g.restore();
    // 脚下一团贴地的暗
    g.save(); g.globalAlpha = alpha;
    g.fillStyle = K.rad(g, fx + 10, GY + 2, 4, 90, [[0, 'rgba(60,48,34,0.32)'], [1, 'rgba(60,48,34,0)']]);
    g.beginPath(); g.ellipse(fx + 10, GY + 2, 90, 11, 0, 0, TAU); g.fill();
    g.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alpha;
    g.drawImage(Bf.cv, 0, 0, D.w, D.h, D.X0, D.Y0, D.w, D.h);
    g.restore();
  }

  // 回忆（晴朗上午）：时间跳转前风慢慢停下（calm 0），好与定格的那一张接上
  function drawPast(g, c, lt, t, k) {
    const calm = 1 - smooth(seg(lt, k[8] - 0.5, k[8]));
    g.drawImage(skyTex(false), 0, 0, W, 640);
    g.save(); g.translate(360, 350); g.rotate((Math.sin(t * 0.9) * 0.006 + 0.004 * Math.sin(t * 2.1)) * calm); g.drawImage(osmanthus(false), -340, -350, 760, 320); g.restore();
    g.drawImage(wallTex(false), 0, 0, W, H);
    bambooOn(g, t, calm);
    drips(g, lt);
    writeGlyph(g, WRIT[5], clamp((lt + 0.25) / 0.45), 1, 1);
    writeGlyph(g, WRIT[6], wProg(lt, k), wDry(k), 3);
    dryDrag(g, dragU(lt, k));
    drawSplats(g, lt, k);
    inkBowl(g, BOWL[0], BOWL[1], lt, k);
    boyLayer(g, lt, k, t, 1);
    birds(g, c, lt, t, k);
    petalsOsm(g, t, 1);
    V.dust(g, c, { n: 36, area: [80, 140, 900, 600], color: '#fff3d0', size: [1, 2.6], alpha: 0.55 * (0.3 + 0.7 * calm), night: false });
    willow(g, t, false, calm);
    fgLeaves(g, t, calm);
  }
  // 竹影在墙上摇
  function bambooOn(g, t, calm) {
    g.save(); wallPath(g, 2); g.clip();
    // 纯黑的正片叠底与普通叠一层 20% 黑完全等价，后者快得多
    g.globalAlpha = 0.2;
    g.drawImage(bambooShadow(), -80 + (Math.sin(t * 0.8) * 10 + Math.sin(t * 2.3) * 3) * calm, 120 + Math.sin(t * 0.6) * 4 * calm, W + 200, 560);
    g.restore();
  }
  // 桂花细瓣飘落（近大远小）
  function petalsOsm(g, t, a) {
    if (a <= 0.01) return;
    for (let i = 0; i < 50; i++) {
      const z = h2(i, 5), sp = 16 + 30 * z, y0 = (h2(i, 6) * 780 + t * sp) % 780 - 30;
      const x = 40 + h2(i, 7) * 760 + y0 * 0.3 + Math.sin(t * (0.7 + z) + i) * 16;
      const r = 1.1 + z * 2.6;
      g.fillStyle = rgba(i % 3 ? '#f6cf4a' : '#e8a040', (0.6 + 0.4 * z) * a);
      g.beginPath(); g.ellipse(x, y0, r, r * (0.45 + 0.55 * Math.abs(Math.sin(t * 3 + i))), t + i, 0, TAU); g.fill();
    }
  }
  // “英”字定格的那一张（风已停、字已写完、墨点都在）：时间跳转时整张贴，不再逐层画
  function pastAll(k) {
    const dk = wDry(k).toFixed(3);
    return K.cache('g07|pastAll' + fk() + dk, W, H, 1, (q) => {
      q.drawImage(skyTex(false), 0, 0, W, 640);
      q.drawImage(osmanthus(false), 20, 0, 760, 320);
      q.drawImage(wallTex(false), 0, 0, W, H);
      bambooOn(q, 0, 0);
      writeGlyph(q, WRIT[5], 1, 1, 1);
      writeGlyph(q, WRIT[6], wProg(99, k), wDry(k), 3);
      dryDrag(q, 1);
      drawSplats(q, 99, k);
      inkBowl(q, BOWL[0], BOWL[1], 99, k);
      willow(q, 0, false, 0);
      fgLeaves(q, 0, 0);
    });
  }
  // 褪色版：去饱和、偏冷（岁月从这里开始）
  function pastGrey(k) {
    const dk = wDry(k).toFixed(3);
    return K.cache('g07|pastGrey' + fk() + dk, W, H, 1, (q) => {
      q.drawImage(pastAll(k), 0, 0, W, H);
      q.globalCompositeOperation = 'saturation'; q.fillStyle = 'rgba(128,128,128,0.85)'; q.fillRect(0, 0, W, H);
      q.globalCompositeOperation = 'source-over'; q.fillStyle = 'rgba(96,108,116,0.16)'; q.fillRect(0, 0, W, H);
    });
  }
  // 水渍：一张预先模糊的柔边斑，边缘一圈深色水线
  function stainSprite() {
    return K.cache('g07|stain2', 256, 256, 0.5, (q) => {
      try { q.filter = `blur(${(4 * SS() * 0.5).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      // 洇湿的里面淡、偏冷；外缘一圈深色水线，里面还有两道退潮留下的细圈
      q.fillStyle = 'rgba(128,132,116,0.24)'; A.inkBlob(q, 128, 128, 94, 17, 0.62); q.fill();
      q.fillStyle = 'rgba(150,148,128,0.14)'; A.inkBlob(q, 124, 132, 70, 23, 0.6); q.fill();
      q.strokeStyle = 'rgba(92,86,64,0.8)'; q.lineWidth = 4.5; A.inkBlob(q, 128, 128, 94, 17, 0.62); q.stroke();
      q.strokeStyle = 'rgba(110,104,82,0.4)'; q.lineWidth = 2.2; A.inkBlob(q, 126, 130, 78, 17, 0.62); q.stroke();
      q.strokeStyle = 'rgba(110,104,82,0.28)'; q.lineWidth = 1.6; A.inkBlob(q, 124, 132, 56, 29, 0.6); q.stroke();
      q.filter = 'none';
    });
  }
  // 逐帧的水渍画在 1/4 分辨率草稿层上再整张放大贴回（本来就是虚边，看不出）
  function stainsLow(g, lt, tJ) {
    const m = g.getTransform(), D = devBox(g, [-40, -40, W + 40, H + 40]), R = 4;
    const B = scratch('g07stn', D.w / R, D.h / R);
    B.q.setTransform(m.a / R, m.b / R, m.c / R, m.d / R, (m.e - D.X0) / R, (m.f - D.Y0) / R);
    stains(B.q, lt, tJ);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(B.cv, 0, 0, B.w, B.h, D.X0, D.Y0, D.w, D.h); g.restore();
  }
  // 褪色且水渍已洇满的一张：水渍长定以后只贴这一张
  function pastStained(k) {
    const dk = wDry(k).toFixed(3);
    return K.cache('g07|pastSt' + fk() + dk, W, H, 1, (q) => { q.drawImage(pastGrey(k), 0, 0, W, H); stains(q, 99, 0); });
  }
  // 七处水渍：从墙脚和檐下洇开
  const STAINS = [[150, 600, 1.0, 0.7], [470, 604, 1.2, 0.62], [800, 598, 1.0, 0.7], [250, 160, 0.9, 1.2], [640, 124, 0.8, 1.25], [900, 88, 0.85, 1.3], [60, 330, 0.7, 1.0]];
  function stains(g, lt, tJ) {
    const img = stainSprite();
    g.save(); wallPath(g); g.clip();
    STAINS.forEach(([x, y, s, ay], i) => {
      const e = easeOut(seg(lt, tJ - 0.08 + i * 0.015, tJ + 0.2 + i * 0.012));
      if (e <= 0) return;
      const R = (30 + 200 * e) * s;
      g.globalAlpha = 0.85 * Math.min(1, e * 3);
      g.save(); g.translate(x, y); g.rotate(i * 1.3); g.scale(1, ay); g.drawImage(img, -R, -R, R * 2, R * 2); g.restore();
    });
    g.restore();
  }

  // ---------- 几十年后：阴天冷光，墙皮剥落，只剩“大侠” ----------
  function agedAll() {
    return K.cache('g07|agedAll2' + fk(), W, H, 1, (q) => {
      q.drawImage(skyTex(true), 0, 0, W, 640);
      q.drawImage(osmanthus(true), 20, 0, 760, 320);
      q.drawImage(wallTex(true), 0, 0, W, H);
      bandV(q, 0, 540, W, H, [[0, 'rgba(200,206,206,0)'], [0.5, 'rgba(200,206,206,0.16)'], [1, 'rgba(200,206,206,0.05)']]);
      // 冷灰的天光，四角压暗
      q.fillStyle = K.rad(q, 520, 330, 200, 900, [[0, 'rgba(30,40,50,0)'], [1, 'rgba(30,40,50,0.28)']]); q.fillRect(0, 0, W, H);
    });
  }
  // 墙头的枯草：逐帧随风摆
  function wallGrass(g, t) {
    g.lineCap = 'round';
    for (const [col, lw, sd] of [['rgba(138,122,90,0.85)', 1.2, 0], ['rgba(170,150,104,0.75)', 0.9, 1]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
      STEPS.forEach(([x0, x1, y], si) => {
        const rt = y - 30, n = Math.floor((x1 - x0) / 14);
        for (let j = 0; j < n; j++) {
          const gx = x0 + h2(j, si * 7 + sd + 50) * (x1 - x0), gh = 8 + 30 * h2(j, si * 7 + sd + 60);
          const sw = (Math.sin(t * 1.7 + gx * 0.031) * 0.6 + Math.sin(t * 3.1 + gx * 0.07) * 0.3 + 0.4) * gh * 0.22;
          g.moveTo(gx, rt + 2); g.quadraticCurveTo(gx + sw * 0.3, rt - gh * 0.5, gx + sw + 3 * h2(j, si + 70), rt - gh);
        }
      });
      g.stroke();
    }
    // 几枝草穗
    g.fillStyle = 'rgba(176,156,110,0.8)';
    STEPS.forEach(([x0, x1, y], si) => {
      for (let j = 0; j < 6; j++) {
        const gx = x0 + h2(j, si + 80) * (x1 - x0), gh = 30 + 14 * h2(j, si + 81), sw = (Math.sin(t * 1.7 + gx * 0.031) * 0.6 + 0.4) * gh * 0.25;
        g.save(); g.translate(gx + sw, y - 30 - gh); g.rotate(0.3 + sw * 0.03); g.beginPath(); g.ellipse(0, 0, 1.6, 5.5, 0, 0, TAU); g.fill(); g.restore();
      }
    });
  }
  // 枯叶贴图：歪的椭圆叶片，叶缘卷起焦黄，主脉与叶柄
  function leafImg() {
    return K.cache('g07|dleaf', 64, 40, 2, (q) => {
      q.translate(32, 20);
      const blade = () => { q.beginPath(); q.moveTo(-22, 1); q.bezierCurveTo(-15, -13, 9, -15, 24, -3); q.bezierCurveTo(14, 8, -8, 12, -22, 1); q.closePath(); };
      q.fillStyle = K.rad(q, -2, -1, 2, 26, [[0, '#7a4a26'], [0.55, '#8a5a30'], [1, '#c08040']]); blade(); q.fill();
      q.save(); blade(); q.clip();
      // 卷起的上缘迎光
      q.strokeStyle = 'rgba(232,180,110,0.7)'; q.lineWidth = 2.2; q.beginPath(); q.moveTo(-18, -5); q.bezierCurveTo(-10, -13, 9, -14, 22, -4); q.stroke();
      q.fillStyle = 'rgba(60,34,16,0.35)'; q.beginPath(); q.ellipse(4, 6, 12, 4, -0.1, 0, TAU); q.fill();
      q.fillStyle = 'rgba(70,40,20,0.5)'; for (const [x, y, r] of [[-6, -3, 1.6], [10, 1, 1.2], [2, 5, 0.9]]) { q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill(); }
      q.restore();
      q.strokeStyle = 'rgba(80,46,22,0.9)'; q.lineWidth = 0.7; blade(); q.stroke();
      q.strokeStyle = 'rgba(66,38,18,0.85)'; q.lineWidth = 1.1; q.beginPath(); q.moveTo(-22, 1); q.quadraticCurveTo(0, -3, 24, -3); q.stroke();
      q.lineWidth = 0.6;
      for (let j = 0; j < 4; j++) { const x = -14 + j * 9; q.beginPath(); q.moveTo(x, -1.6 + j * 0.1); q.lineTo(x + 5, -8 + j * 0.8); q.moveTo(x, -1.4); q.lineTo(x + 5, 5 - j * 0.6); q.stroke(); }
      q.strokeStyle = '#4a2c14'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(-22, 1); q.quadraticCurveTo(-27, 2, -30, 6); q.stroke();
    });
  }
  function leafSprite(g, x, y, s, rot, fx, a) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * (Math.abs(fx) < 0.15 ? 0.15 * Math.sign(fx || 1) : fx), s);
    if (a != null) g.globalAlpha *= a;
    g.drawImage(leafImg(), -32, -20, 64, 40);
    g.restore();
  }
  // 现在的逍遥（白发、背剑、腰挂葫芦）的长影：滑上墙，停在“大侠”旁
  const SHS = 1.85, SHX0 = 995;
  const SHO = { stage: 'old', facing: -1, prop: 'gourd', tone: 'silhouette', ink: '#000000', rim: null, feibai: false, wind: 0.55, stride: 1.4, speed: 1.35, seed: 5 };
  const tLeaf = (k) => k[10] + 0.45;
  function presentShadow(g, lt, k, t, a) {
    const t0 = k[8] + 0.42, tS = tLeaf(k);
    if (lt < t0 || a <= 0.2) return;
    const sp = F.walkSpeed('xiaoyao', SHS, SHO);
    const x = SHX0 - sp * (Math.min(lt, tS) - t0);
    const stop = smooth(seg(lt, tS - 0.12, tS + 0.18));
    const m = g.getTransform(), D = devBox(g, [x - 180, 180, x + 160, WB + 10]), R = 4;
    const B = scratch('g07psh', D.w / R, D.h / R);
    B.q.setTransform(m.a / R, m.b / R, m.c / R, m.d / R, (m.e - D.X0) / R, (m.f - D.Y0) / R);
    // 一张剪影里叠两种姿势（走→停），影子本来就虚，看不出接缝
    if (stop < 1) F.draw(B.q, 'xiaoyao', x, WB, SHS, t, Object.assign({ pose: 'walk' }, SHO));
    if (stop > 0) { B.q.globalAlpha = stop; F.draw(B.q, 'xiaoyao', x, WB, SHS, t, Object.assign({ pose: 'stand', head: -0.12 }, SHO)); B.q.globalAlpha = 1; }
    // 白发、葫芦在剪影里也有颜色：统一染成冷灰的影
    B.q.setTransform(1, 0, 0, 1, 0, 0); B.q.globalCompositeOperation = 'source-in'; B.q.fillStyle = '#28303a'; B.q.fillRect(0, 0, B.w + 2, B.h + 2); B.q.globalCompositeOperation = 'source-over';
    g.save(); wallPath(g, 4); g.clip();
    const fdx = m.a * x + m.c * WB + m.e, fdy = m.b * x + m.d * WB + m.f;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.translate(fdx, fdy); g.transform(1.04, 0, 0.17, 1.02, 0, 0); g.translate(-fdx, -fdy);
    g.globalAlpha = 0.24 * a; g.drawImage(B.cv, 0, 0, B.w, B.h, D.X0, D.Y0, D.w, D.h);
    g.restore();
  }
  function drawAged(g, c, lt, t, k, a) {
    g.save(); g.globalAlpha = a;
    g.drawImage(agedAll(), 0, 0, W, H);
    // 云影慢慢掠过墙面
    const cx = -500 + (lt - k[8]) * 45;
    g.fillStyle = K.lin(g, cx, 0, cx + 900, 0, [[0, 'rgba(34,42,52,0)'], [0.3, 'rgba(34,42,52,0.13)'], [0.7, 'rgba(34,42,52,0.13)'], [1, 'rgba(34,42,52,0)']]);
    g.fillRect(Math.max(-60, cx), 40, 900, 620);
    g.restore();
    presentShadow(g, lt, k, t, a);
    g.save(); g.globalAlpha = a;
    wallGrass(g, t);
    willow(g, t, true, 1);
    // 枯叶：从墙头飘下，打着转贴到“侠”上，落定时还轻轻一晃
    const tl = tLeaf(k), u = seg(lt, tl - 1.7, tl), [lx1, ly1] = [WRIT[2][1] + 26, WRIT[2][2] - 14];
    if (u > 0) {
      const lx = lerp(700, lx1, easeOut(u)) + Math.sin(u * 9) * 34 * (1 - u), ly = lerp(-30, ly1, u);
      const st = lt - tl, rot = u < 1 ? lt * 3 : 0.55 + 0.3 * Math.exp(-st / 0.25) * Math.sin(st * 16);
      leafSprite(g, lx, ly, 1.1, rot, u < 1 ? Math.cos(lt * 5) : 1);
    }
    for (let i = 0; i < 10; i++) {
      const sp = 40 + 30 * h2(i, 3), y = (h2(i, 4) * 800 + t * sp) % 800 - 40, x = (h2(i, 5) * 1400 + t * 50 + Math.sin(t + i) * 40) % 1400 - 60;
      leafSprite(g, x, y, 0.42 + 0.4 * h2(i, 6), t * (1 + h2(i, 7)) + i, Math.cos(t * 3 + i));
    }
    g.restore();
    V.dust(g, c, { n: 22, area: [60, 120, 1000, 600], color: '#e2e6e6', size: [0.8, 2.2], alpha: 0.4 * a, night: false, seed: 7 });
  }

  XYT.registerShot('c1_wallink', {
    name: '题壁墨枯', zone: 'right', night: false,
    text: '#1a2026', shadow: 'rgba(250,246,236,0.95)', accent: '#b8862e', bloom: 0.2,
    draw(g, c) {
      const lt = c.lt, t = c.t, k = chars(c, T21);
      const tJ = k[8];
      // 几十年后的那张老墙、定格的那一张，提前分几帧建好，转场时不卡
      if (lt > 0.8) skyTex(true);
      if (lt > 1.4) osmanthus(true);
      if (lt > 2.0) wallTex(true);
      if (lt > 2.6) agedAll();
      if (lt > 2.9) stainSprite();
      if (lt > 3.5) pastAll(k);
      if (lt > 3.62) pastGrey(k);
      if (lt > 3.74) pastStained(k);
      const jump = smooth(seg(lt, tJ + 0.24, tJ + 0.72));
      // 时间跳转后慢慢推向“大侠”（以墙角左侧为中心推，墙角不压到歌词）
      const push = easeInOut(seg(lt, tJ + 0.2, c.dur + 0.4));
      g.save();
      if (push > 0) { const z = 1 + 0.07 * push; g.translate(860, 300); g.scale(z, z); g.translate(-860, -300); }
      if (lt < tJ) drawPast(g, c, lt, t, k);
      else if (jump < 1) {
        // 定格、褪色、水渍从墙脚与檐下洇开；少年淡去
        const desat = smooth(seg(lt, tJ, tJ + 0.26));
        if (lt >= tJ + 0.28) g.drawImage(pastStained(k), 0, 0, W, H);
        else {
          if (desat < 1) { g.drawImage(pastAll(k), 0, 0, W, H); drips(g, tJ); }
          if (desat > 0) { g.globalAlpha = desat; g.drawImage(pastGrey(k), 0, 0, W, H); g.globalAlpha = 1; }
          stainsLow(g, lt, tJ);
        }
        if (lt < tJ + 0.2) petalsOsm(g, t, 1 - seg(lt, tJ, tJ + 0.2));
        if (lt < tJ + 0.22) boyLayer(g, lt, k, t, 1 - smooth(seg(lt, tJ, tJ + 0.22)));
      }
      if (jump > 0) drawAged(g, c, lt, t, k, jump);
      g.restore();
    },
  });

  // =====================================================================
  // 第22句 彩依还蝶：〔第22句第1–4字〕｜〔第22句第5–8字〕｜〔第22句第9–11字〕
  // =====================================================================
  const T22 = [0.27, 0.61, 0.97, 1.61, 2.27, 2.63, 3.06, 3.49, 3.95, 4.27, 4.72];
  const GOLD = '#eacd76', MOONW = '#f2ecde', RED = '#c83c23';
  // ---------- 本组共用：一只淡黄的蝶（彩依） ----------
  // 翅膀贴图：上翅、下翅各一张（白底染色前的成品），thin 为翅膀变薄后的半透明版
  function wingImg(thin) {
    return K.cache('g07|wing2' + (thin ? 'T' : 'A'), 96, 96, 1, (q) => {
      // 上翅、下翅；thin 为“瘦”后的版本：颜色褪成米白、半透，翅脉清楚，光从里面透过来
      const up = () => { q.beginPath(); q.moveTo(6, 50); q.bezierCurveTo(14, 26, 46, 6, 84, 6); q.quadraticCurveTo(94, 16, 86, 30); q.bezierCurveTo(74, 46, 44, 52, 6, 54); q.closePath(); };
      const lo = () => { q.beginPath(); q.moveTo(6, 52); q.bezierCurveTo(36, 50, 64, 60, 60, 76); q.bezierCurveTo(56, 92, 30, 94, 20, 86); q.quadraticCurveTo(8, 76, 6, 58); q.closePath(); };
      let gr = q.createLinearGradient(6, 52, 86, 8);
      if (thin) { gr.addColorStop(0, 'rgba(222,206,180,0.62)'); gr.addColorStop(0.5, 'rgba(236,228,210,0.5)'); gr.addColorStop(1, 'rgba(248,244,232,0.42)'); }
      else { gr.addColorStop(0, '#d69228'); gr.addColorStop(0.35, '#f6d66e'); gr.addColorStop(0.8, '#fff0ba'); gr.addColorStop(1, '#fffae2'); }
      q.fillStyle = gr; up(); q.fill();
      gr = q.createRadialGradient(6, 54, 2, 6, 54, 70);
      if (thin) { gr.addColorStop(0, 'rgba(214,196,170,0.6)'); gr.addColorStop(1, 'rgba(240,234,220,0.44)'); }
      else { gr.addColorStop(0, '#c87828'); gr.addColorStop(0.45, '#f4cc60'); gr.addColorStop(1, '#ffecaa'); }
      q.fillStyle = gr; lo(); q.fill();
      // 翅脉与翅缘
      q.strokeStyle = thin ? 'rgba(120,96,66,0.75)' : 'rgba(120,70,20,0.55)'; q.lineWidth = thin ? 0.9 : 0.8;
      for (const [x1, y1] of [[80, 10], [76, 22], [62, 34], [40, 46], [50, 70], [30, 84]]) { q.beginPath(); q.moveTo(8, 53); q.quadraticCurveTo((8 + x1) / 2, (53 + y1) / 2 - 4, x1, y1); q.stroke(); }
      q.strokeStyle = thin ? 'rgba(150,126,92,0.7)' : 'rgba(150,90,30,0.8)'; q.lineWidth = 2.2;
      q.beginPath(); q.moveTo(46, 12); q.bezierCurveTo(62, 6, 80, 4, 84, 6); q.quadraticCurveTo(94, 16, 86, 30); q.stroke();
      if (thin) { q.strokeStyle = 'rgba(150,126,92,0.5)'; q.lineWidth = 1; up(); q.stroke(); lo(); q.stroke(); }
      // 翅上的眼斑与白点
      q.fillStyle = thin ? 'rgba(255,255,250,0.3)' : 'rgba(255,255,255,0.85)';
      for (const [x1, y1, r] of [[80, 12, 2.4], [86, 20, 1.8], [70, 10, 1.6], [44, 80, 2], [34, 86, 1.4]]) { q.beginPath(); q.arc(x1, y1, r, 0, TAU); q.fill(); }
      q.fillStyle = thin ? 'rgba(170,140,110,0.25)' : 'rgba(200,110,60,0.6)'; q.beginPath(); q.ellipse(48, 72, 6, 4, 0.4, 0, TAU); q.fill();
    });
  }
  // 画一只蝶：x, y 身体中心；s 翅长；rot 身体朝向（0 朝上）；open 翅开合 0..1；thin 0..1 变薄（两张翅膀贴图交叠过渡）；glow 光晕
  function butterfly(g, x, y, s, rot, open, o = {}) {
    const k = 0.1 + 0.9 * open, th = clamp(o.thin || 0);
    g.save(); g.translate(x, y); g.rotate(rot);
    // 光晕只比蝶大一点，淡金，不要成一团白光
    if (o.glow > 0) dot(g, 0, 0, s * 1.6, o.glowColor || '#ffd890', Math.min(0.35, o.glow), o.op || 'screen');
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    const ga = g.globalAlpha;
    for (const [img, a] of [[wingImg(false), 1 - th], [wingImg(true), th]]) {
      if (a <= 0.01) continue;
      g.globalAlpha = ga * a;
      for (const sd of [-1, 1]) {
        g.save(); g.scale(sd * k, 1); g.rotate(-0.15);
        g.drawImage(img, -s * 0.06, -s * 0.56, s, s);
        g.restore();
      }
    }
    g.globalAlpha = ga;
    g.fillStyle = th > 0.5 ? '#5a4632' : '#3a2614'; g.beginPath(); g.ellipse(0, s * 0.02, s * 0.045, s * 0.26, 0, 0, TAU); g.fill();
    g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(0.6, s * 0.02);
    g.beginPath(); g.moveTo(0, -s * 0.2); g.quadraticCurveTo(-s * 0.08, -s * 0.38, -s * 0.15, -s * 0.44); g.moveTo(0, -s * 0.2); g.quadraticCurveTo(s * 0.08, -s * 0.38, s * 0.15, -s * 0.44); g.stroke();
    g.restore();
  }
  // 格扇：上部方格棂心透出纱光，下部裙板
  function geshan(q, x, y, w, h, lightCol) {
    q.fillStyle = '#2c1a12'; q.fillRect(x, y, w, h);
    const ix = x + 8, iw = w - 16, iy = y + 10, ih = h * 0.62;
    q.fillStyle = K.lin(q, 0, iy, 0, iy + ih, [[0, mix(lightCol, '#3a2418', 0.35)], [0.5, lightCol], [1, mix(lightCol, '#3a2418', 0.25)]]); q.fillRect(ix, iy, iw, ih);
    q.strokeStyle = 'rgba(60,34,18,0.85)'; q.lineWidth = 2;
    for (let xx = ix + iw / 6; xx < ix + iw - 2; xx += iw / 6) { q.beginPath(); q.moveTo(xx, iy); q.lineTo(xx, iy + ih); q.stroke(); }
    for (let yy = iy + ih / 10; yy < iy + ih - 2; yy += ih / 10) { q.beginPath(); q.moveTo(ix, yy); q.lineTo(ix + iw, yy); q.stroke(); }
    q.strokeStyle = rgba(GOLD, 0.7); q.lineWidth = 1.4; q.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
    const by = iy + ih + 14, bh = h - (by - y) - 14;
    q.fillStyle = '#3a2216'; q.fillRect(ix, by, iw, bh);
    q.strokeStyle = rgba(GOLD, 0.55); q.lineWidth = 1.2; q.strokeRect(ix + 6, by + 6, iw - 12, bh - 12);
    q.beginPath(); q.ellipse(x + w / 2, by + bh / 2, iw * 0.22, bh * 0.22, 0, 0, TAU); q.stroke();
  }
  // 喜堂：金色与月白为主调，红只点在一对红烛、一方小囍与几缕红纸屑上
  function hallTex() {
    return K.cache('g07|hall2' + fk(), W, H, 1, (q) => {
      const r = A.rng(2201);
      bandV(q, 0, 0, W, H, [[0, '#1a1018'], [0.5, '#2a1c24'], [1, '#140c10']]);
      // 后墙：六扇格扇，纱后透着暖金的烛光
      for (let i = 0; i < 6; i++) geshan(q, 330 + i * 130, 124, 130, 346, i === 2 || i === 3 ? '#f6dfa0' : '#e8cf96');
      // 两侧墙（透视）：左墙暗，右墙开一扇月光棂窗
      q.fillStyle = K.lin(q, 0, 0, 330, 0, [[0, '#120a0e'], [1, '#2a1a1e']]);
      q.beginPath(); q.moveTo(0, 0); q.lineTo(330, 124); q.lineTo(330, 470); q.lineTo(0, 760); q.closePath(); q.fill();
      q.fillStyle = K.lin(q, 1110, 0, W, 0, [[0, '#2a1a1e'], [1, '#140c10']]);
      q.beginPath(); q.moveTo(1110, 124); q.lineTo(W, 30); q.lineTo(W, 760); q.lineTo(1110, 470); q.closePath(); q.fill();
      // 右墙的窗：月白冷光，斜透视的方格
      q.save(); q.beginPath(); q.moveTo(1150, 150); q.lineTo(1250, 110); q.lineTo(1250, 470); q.lineTo(1150, 430); q.closePath(); q.clip();
      bandV(q, 1140, 100, 1260, 480, [[0, '#cfe0f0'], [1, '#8fa6c8']]);
      q.strokeStyle = 'rgba(40,26,20,0.9)'; q.lineWidth = 2.5;
      for (let k = 1; k < 5; k++) { const x = 1150 + k * 20; q.beginPath(); q.moveTo(x, 150 - k * 8); q.lineTo(x, 430 + k * 8); q.stroke(); }
      for (let k = 1; k < 12; k++) { q.beginPath(); q.moveTo(1150, 150 + k * 24); q.lineTo(1250, 110 + k * 30); q.stroke(); }
      q.restore();
      q.strokeStyle = '#2a1810'; q.lineWidth = 7; q.beginPath(); q.moveTo(1150, 150); q.lineTo(1250, 110); q.lineTo(1250, 470); q.lineTo(1150, 430); q.closePath(); q.stroke();
      // 顶：梁枋彩画（青底金线）与天花
      q.fillStyle = K.lin(q, 0, 0, 0, 124, [[0, '#0e0a10'], [1, '#22161c']]); q.beginPath(); q.moveTo(0, 0); q.lineTo(W, 0); q.lineTo(W, 30); q.lineTo(1110, 124); q.lineTo(330, 124); q.lineTo(0, 0); q.fill();
      q.strokeStyle = rgba(GOLD, 0.22); q.lineWidth = 1;
      for (let k = 0; k <= 10; k++) { q.beginPath(); q.moveTo(330 + k * 78, 124); q.lineTo(lerp(-200, W + 200, k / 10), 0); q.stroke(); }
      q.fillStyle = K.lin(q, 0, 92, 0, 126, [[0, '#24343a'], [1, '#14202a']]); q.fillRect(300, 94, 840, 32);
      q.strokeStyle = rgba(GOLD, 0.8); q.lineWidth = 1.6; q.strokeRect(304, 98, 832, 24);
      for (let k = 0; k < 7; k++) { const cx = 360 + k * 120; q.beginPath(); q.ellipse(cx, 110, 22, 8, 0, 0, TAU); q.stroke(); q.beginPath(); q.arc(cx, 110, 4, 0, TAU); q.stroke(); }
      // 正中小小一方红囍（剪纸）
      q.save(); q.translate(720, 262); q.rotate(PI / 4); q.fillStyle = RED; q.fillRect(-34, -34, 68, 68); q.restore();
      q.fillStyle = '#f6d88a'; q.font = `52px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('囍', 720, 265);
      // 供桌
      q.fillStyle = K.lin(q, 0, 428, 0, 470, [[0, '#4a2a1a'], [1, '#1e100a']]); q.fillRect(590, 430, 260, 40);
      q.fillStyle = '#5a3420'; q.fillRect(580, 424, 280, 9); q.fillStyle = rgba(GOLD, 0.7); q.fillRect(580, 424, 280, 1.5);
      q.fillStyle = mix(RED, '#2a0a08', 0.25); q.fillRect(680, 433, 80, 37);
      q.strokeStyle = rgba(GOLD, 0.7); q.lineWidth = 1; q.strokeRect(684, 437, 72, 29);
      // 地面：深色抛光的木地板，向灭点收拢
      q.fillStyle = K.lin(q, 0, 470, 0, H, [[0, '#3a2620'], [0.4, '#2a1a16'], [1, '#120a08']]);
      q.beginPath(); q.moveTo(0, 760); q.lineTo(330, 470); q.lineTo(1110, 470); q.lineTo(W, 760); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(0,0,0,0.35)'; q.lineWidth = 1;
      for (let k = -10; k <= 10; k++) { q.beginPath(); q.moveTo(720 + k * 40, 470); q.lineTo(720 + k * 170, H + 40); q.stroke(); }
      for (let k = 1; k < 7; k++) { const yy = 470 + Math.pow(k / 7, 1.8) * 260; q.beginPath(); q.moveTo(0, yy); q.lineTo(W, yy); q.stroke(); }
      // 月光在地上投下的窗格
      q.save(); q.globalCompositeOperation = 'screen';
      try { q.filter = `blur(${(3 * SS()).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      q.fillStyle = 'rgba(170,190,230,0.28)';
      q.beginPath(); q.moveTo(1150, 470); q.lineTo(1250, 470); q.lineTo(1000, 720); q.lineTo(760, 720); q.closePath(); q.fill();
      q.filter = 'none';
      q.restore();
      // 地上散落的红纸屑与花生红枣
      for (let k = 0; k < 70; k++) {
        const x = 200 + r() * 1000, y = 480 + Math.pow(r(), 0.8) * 230, s = 0.5 + (y - 470) / 250;
        q.fillStyle = r() < 0.75 ? rgba(RED, 0.7) : rgba('#e8c070', 0.8);
        q.save(); q.translate(x, y); q.rotate(r() * PI); q.fillRect(-4 * s, -2 * s, 8 * s, 4 * s); q.restore();
      }
      // 中间的空宴席：圆桌、杯盘狼藉
      const tab = (cx, cy, rx, ry) => {
        q.fillStyle = 'rgba(0,0,0,0.45)'; q.beginPath(); q.ellipse(cx, cy + ry * 1.6, rx * 1.05, ry * 0.8, 0, 0, TAU); q.fill();
        q.fillStyle = '#1a0e0a'; q.fillRect(cx - rx * 0.1, cy, rx * 0.2, ry * 2.4);
        q.fillStyle = K.lin(q, 0, cy - ry, 0, cy + ry + 8, [[0, '#6a4028'], [0.6, '#4a2a1a'], [1, '#2a160e']]);
        q.beginPath(); q.ellipse(cx, cy, rx, ry, 0, 0, TAU); q.fill();
        q.fillStyle = '#2a160e'; q.beginPath(); q.ellipse(cx, cy + 5, rx, ry, 0, 0, PI); q.lineTo(cx - rx, cy); q.fill();
        q.fillStyle = K.lin(q, 0, cy - ry, 0, cy + ry, [[0, '#7a4a2e'], [1, '#5a3420']]); q.beginPath(); q.ellipse(cx, cy, rx, ry, 0, 0, TAU); q.fill();
        q.strokeStyle = rgba(GOLD, 0.35); q.lineWidth = 1.2; q.beginPath(); q.ellipse(cx, cy, rx - 3, ry - 2, 0, PI * 1.05, PI * 1.95); q.stroke();
        for (let k = 0; k < 9; k++) {
          const a = r() * TAU, d = Math.sqrt(r()) * 0.75, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
          if (k % 3 === 0) { q.fillStyle = '#e8e2d4'; q.beginPath(); q.ellipse(x, y, 13, 4.5, 0, 0, TAU); q.fill(); q.fillStyle = '#c8b090'; q.beginPath(); q.ellipse(x, y - 1, 8, 2.5, 0, 0, TAU); q.fill(); }
          else if (k % 3 === 1) { q.fillStyle = '#f0ece2'; q.fillRect(x - 3, y - 7, 6, 7); q.fillStyle = '#c8c0b0'; q.beginPath(); q.ellipse(x, y - 7, 3, 1.2, 0, 0, TAU); q.fill(); }
          else { q.save(); q.translate(x, y); q.rotate(PI / 2 - 0.2); q.fillStyle = '#ece6da'; q.fillRect(-3, -6, 6, 9); q.restore(); }
        }
        // 酒壶
        q.fillStyle = K.lin(q, cx + rx * 0.3 - 9, 0, cx + rx * 0.3 + 9, 0, [[0, '#a8b8b0'], [0.5, '#e8f0ea'], [1, '#7a8a84']]);
        q.beginPath(); q.ellipse(cx + rx * 0.3, cy - 12, 10, 13, 0, 0, TAU); q.fill(); q.fillRect(cx + rx * 0.3 - 3, cy - 32, 6, 10);
      };
      tab(640, 548, 150, 30);
      tab(1110, 676, 230, 46);
      // 后墙纱后的一团暖烛光
      q.globalCompositeOperation = 'screen';
      q.fillStyle = K.rad(q, 720, 330, 0, 360, [[0, 'rgba(255,207,128,0.12)'], [0.5, 'rgba(255,207,128,0.05)'], [1, 'rgba(255,207,128,0)']]); q.fillRect(360, 0, 720, 690);
      q.globalCompositeOperation = 'source-over';
      // 近处左侧一根粗柱（暗，衬字）
      q.fillStyle = K.lin(q, 40, 0, 190, 0, [[0, '#0a0608'], [0.6, '#24141a'], [1, '#0e080a']]); q.fillRect(40, 0, 150, H);
      q.fillStyle = rgba(GOLD, 0.25); q.fillRect(170, 0, 2, H);
      q.fillStyle = '#3a2216'; q.fillRect(30, 60, 170, 26); q.strokeStyle = rgba(GOLD, 0.5); q.strokeRect(34, 64, 162, 18);
    });
  }
  // 纱幔：月白轻纱，从梁上垂下，随风轻摆（缓存一幅，逐帧斜切）
  function gauzeTex() {
    return K.cache('g07|gauze', 140, 420, 0.5, (q) => {
      for (let k = 0; k < 5; k++) {
        const x0 = 10 + k * 24;
        q.fillStyle = K.lin(q, x0, 0, x0 + 30, 0, [[0, 'rgba(242,236,222,0.05)'], [0.5, 'rgba(242,236,222,0.32)'], [1, 'rgba(242,236,222,0.06)']]);
        q.beginPath(); q.moveTo(x0, 0); q.lineTo(x0 + 34, 0); q.quadraticCurveTo(x0 + 40, 220, x0 + 30 + k * 2, 420); q.lineTo(x0 - 6 + k * 2, 420); q.quadraticCurveTo(x0 - 4, 200, x0, 0); q.fill();
      }
    });
  }
  // 宾客的残影：每组一张缓存的金白幽影（静止），用 screen 叠上去；散去时上浮、淡没成金尘
  const GUESTS = [
    [0, 'villager', 520, 566, 1.05, 1, 'sit', 1, 0], [1, 'villager', 762, 560, 1.12, -1, 'drink', 3, 3],
    [2, 'villager', 600, 586, 1.15, 1, 'sit', 2, 2], [2, 'villager', 700, 572, 1.1, -1, 'stand', 4, 1],
    [3, 'villager', 860, 566, 1.12, -1, 'laugh', 5, 0], [3, 'villager', 430, 572, 1.08, 1, 'stand', 6, 2],
  ];
  function guestSprite(i) {
    const [, who, , , s, facing, pose, seed, variant] = GUESTS[i];
    return K.cache('g07|guest2' + i, 260, 300, 1, (q) => {
      F.draw(q, who, 130, 270, s, 1.3 + i, { pose, facing, seed, variant, ghost: true, night: true, wind: 0.2, accent: '#e8b040', rim: '#ffe2a8', glow: 0.6, glowColor: '#ffd890' });
    });
  }
  // 每拍一颗烛泪顺着烛身滑下
  function beatDrip(g, c, x, top, base, r, sd) {
    const age = c.b.since;
    if (age > 0.7) return;
    const dx = (h2(c.b.i, sd) - 0.5) * r * 1.4, u = easeIn(clamp(age / 0.6)), y = lerp(top + 2, base - 4, u), rr = 2.6;
    g.fillStyle = mix(RED, '#ffb090', 0.25);
    g.beginPath(); g.moveTo(x + dx - 1.5, top + 1); g.lineTo(x + dx - rr * 0.8, y); g.arc(x + dx, y, rr, PI, 0, true); g.lineTo(x + dx + 1.5, top + 1); g.fill();
    g.fillStyle = 'rgba(255,230,200,0.6)'; g.beginPath(); g.arc(x + dx - 0.8, y - 0.6, 0.9, 0, TAU); g.fill();
  }
  function drawHall(g, c, lt, t, k) {
    // 慢推近
    const z = 1 + 0.05 * easeInOut(seg(lt, 0, k[4]));
    g.save(); g.translate(720, 360); g.scale(z, z); g.translate(-720, -360);
    g.drawImage(hallTex(), 0, 0, W, H);
    const off = smooth((lt - k[3]) / 0.25), dim = 1 - 0.15 * off;
    // 后墙纱后的烛光随火苗微微明灭；“散”字灯灭，整堂暗下一成半
    // （纱后的烛光已烘进喜堂贴图）
    // 纱幔
    const gz = gauzeTex();
    for (const [x, sd] of [[318, 1], [1000, -1]]) {
      g.save(); g.translate(x, 120); g.transform(1, 0, 0.04 * Math.sin(t * 0.8 + sd) + 0.02 * sd, 1, 0, 0); g.drawImage(gz, 0, 0, 140, 420); g.restore();
    }
    // 一对红烛：每拍矮一截（约 7 像素），一颗烛泪滑下
    const bi = Math.max(0, c.b.i - (c.grid ? Math.floor(c.grid.pos(c.t - lt)) : 0)), step = bi + (1 - Math.exp(-c.b.since / 0.12));
    const burn = clamp(0.3 + 0.075 * step, 0, 0.92), CH = 111, CR = 12;
    for (const [cx, sd] of [[650, 1], [790, 2]]) {
      E.candle(g, { x: cx, y: 424, h: CH, r: CR, t, burn, color: RED, seed: sd, glow: 0.75 * dim, size: 1.25 });
      const top = 424 - Math.max(CR * 1.3, CH * (1 - burn * 0.9));
      beatDrip(g, c, cx, top, 424, CR, sd);
    }
    // 烛光在地板上的倒影
    K.lighter(g, () => { for (const cx of [650, 790]) { g.save(); g.translate(cx, 560); g.scale(0.35, 1.6); A.glow(g, 0, 0, 60, '#ff9a50', 0.2 * dim); g.restore(); } });
    // 宫灯：右边一盏在“散”字熄灭，冒一缕烟
    E.lantern(g, { x: 470, y: 122, s: 1.9, t, kind: 'palace', lit: dim, color: '#e8c87a', seed: 1, cord: 26, glowColor: '#ffc070' });
    E.lantern(g, { x: 970, y: 122, s: 1.9, t, kind: 'palace', lit: 1 - off, color: off > 0.5 ? '#6e5c40' : '#e8c87a', seed: 2, cord: 26, glowColor: '#ffc070' });
    if (lt > k[3]) V.smoke(g, c, { kind: 'incense', x: 970, y: 196, h: 140, n: 2, width: 1.4, color: '#c8c0b8', alpha: 0.5 * (1 - seg(lt, k[3] + 1.2, k[4])), time: t });
    // 宾客残影：曲、终、人、散，一组组淡去；平时轻轻摇晃、明灭
    for (let i = 0; i < GUESTS.length; i++) {
      const [grp, , x, y] = GUESTS[i], kc = k[grp], u = seg(lt, kc, kc + 0.5);
      if (u >= 1) continue;
      const a = 0.72 * (1 - smooth(u)) * (0.82 + 0.18 * noise1(t * 2.2 + i * 3, 7));
      g.save(); g.globalAlpha = a; g.globalCompositeOperation = 'screen';
      g.translate(x, y - 26 * easeOut(u)); g.rotate(0.025 * Math.sin(t * 1.1 + i * 1.7)); g.transform(1, 0, 0.03 * Math.sin(t * 0.9 + i), 1, 0, 0);
      g.drawImage(guestSprite(i), -130, -270, 260, 300);
      g.restore();
      // 散成金尘
      if (u > 0) for (let j = 0; j < 14; j++) {
        const px = x + (h2(j, i) - 0.5) * 70 + Math.sin(t * 2 + j) * 6, py = y - 30 - h2(j, i + 9) * 150 - u * (40 + 60 * h2(j, i + 4));
        dot(g, px, py, 4 + 4 * h2(j, i + 2), GOLD, 0.5 * Math.sin(PI * u));
      }
    }
    // 月光与浮尘
    V.dust(g, c, { n: 28, color: '#dfe8ff', alpha: 0.6, light: { x: 1200, y: 290, angle: 2.4, spread: 0.35, len: 520 } });
    if (off > 0) { g.fillStyle = `rgba(12,6,10,${0.15 * off})`; g.fillRect(-20, -20, W + 40, H + 40); }
    g.restore();
  }

  // ---------- 卧房：病榻、黎明前的窗（近景） ----------
  const HEAD = { x: 486, y: 420, s: 2.0 };
  // 侧脸轮廓（右向立姿的局部坐标），画时转 -90°：头顶朝左，脸朝上
  const toW = (px, py) => [HEAD.x + py * HEAD.s, HEAD.y - px * HEAD.s];
  const WIN = [760, 40, 200, 290];
  const BED = 590;          // 床沿（彩依坐在这儿）
  const EXIT = [857, 271];  // 蝶出窗处：与下一镜的蝶在屏幕上同一点（已算上本镜推近与引擎镜头）
  function headTex() {
    return K.cache('g07|jinhead4', 260, 220, 1, (q) => {
      q.translate(130, 116); q.scale(HEAD.s, HEAD.s); q.rotate(-PI / 2);
      const skin = '#eadccf', line = '#4a3632';
      // 颈（大半藏在被里）
      q.fillStyle = '#d8c6ba';
      q.beginPath(); q.moveTo(-8, 18); q.lineTo(-7, 40); q.lineTo(15, 40); q.lineTo(12, 22); q.closePath(); q.fill();
      // 脸：额、眉骨、鼻、唇、下颌；由颊侧到鼻梁的淡淡晕染
      const face = () => {
        q.beginPath();
        q.moveTo(11, -29); q.quadraticCurveTo(18.5, -22, 19, -13); q.quadraticCurveTo(18.2, -9.5, 19, -7.5); q.quadraticCurveTo(23, -2, 25.5, 2.2); q.quadraticCurveTo(25, 4.8, 20.5, 5.6);
        q.quadraticCurveTo(21.6, 8.4, 21, 10.6); q.quadraticCurveTo(20.2, 12, 20.8, 13.4); q.quadraticCurveTo(21, 16.4, 18.8, 17.6); q.quadraticCurveTo(19.2, 22.5, 14.5, 25.5);
        q.quadraticCurveTo(6, 29, -3, 23); q.lineTo(-11, 4); q.lineTo(-5, -21); q.closePath();
      };
      q.fillStyle = K.lin(q, -10, 0, 26, 0, [[0, '#cdb9ac'], [0.45, skin], [1, '#f2e8de']]); face(); q.fill();
      q.save(); face(); q.clip();
      q.fillStyle = 'rgba(120,124,150,0.16)'; q.beginPath(); q.ellipse(11, -5, 7, 4.5, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(120,124,150,0.12)'; q.beginPath(); q.ellipse(6, 12, 9, 8, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(80,70,80,0.18)'; q.beginPath(); q.ellipse(4, 26, 16, 5, 0, 0, TAU); q.fill();
      q.restore();
      q.strokeStyle = line; q.lineWidth = 0.6; face(); q.stroke();
      // 闭目：一道下弯的线；淡眉；唇缝一点淡红；鼻翼
      q.lineCap = 'round';
      q.strokeStyle = 'rgba(40,30,30,0.85)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(7.6, -5.2); q.quadraticCurveTo(11.6, -2.6, 15.8, -5.4); q.stroke();
      q.lineWidth = 0.5; q.beginPath(); q.moveTo(14.6, -4.6); q.lineTo(16.4, -3.6); q.stroke();
      q.strokeStyle = 'rgba(40,36,40,0.75)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(6, -12); q.quadraticCurveTo(12, -14.8, 18, -11.8); q.stroke();
      q.strokeStyle = 'rgba(170,96,96,0.65)'; q.lineWidth = 0.7; q.beginPath(); q.moveTo(18.6, 12.1); q.lineTo(21.2, 12.3); q.stroke();
      q.strokeStyle = line; q.lineWidth = 0.45; q.beginPath(); q.moveTo(21, 5.2); q.quadraticCurveTo(18.6, 6.4, 17.6, 4.8); q.stroke();
      // 耳
      q.fillStyle = '#e4d0c2'; q.beginPath(); q.ellipse(-4.5, 2, 3.8, 6.6, 0.1, 0, TAU); q.fill(); q.strokeStyle = line; q.lineWidth = 0.45; q.stroke();
      q.beginPath(); q.arc(-4, 2, 2.2, -1.2, 1.4); q.stroke();
      // 头发：盖住头顶与后脑，发际线从额到鬓；几道发光
      q.fillStyle = '#101316';
      q.beginPath(); q.moveTo(13, -27.5); q.quadraticCurveTo(4, -41, -12, -39); q.quadraticCurveTo(-31, -31, -31, -10); q.quadraticCurveTo(-31, 11, -19, 25);
      q.lineTo(-9, 22); q.quadraticCurveTo(-10.5, 10, -9.5, 5); q.quadraticCurveTo(-8.5, -3.5, 1.5, -8); q.quadraticCurveTo(6, -16, 8.5, -22); q.quadraticCurveTo(10.5, -26.5, 13, -27.5); q.fill();
      q.strokeStyle = 'rgba(150,160,180,0.32)'; q.lineWidth = 0.5;
      for (let j = 0; j < 9; j++) { q.beginPath(); q.moveTo(10 - j * 2.6, -31 + j * 0.6); q.quadraticCurveTo(-14, -31 + j * 4, -25, -6 + j * 3.6); q.stroke(); }
      // 发髻与浅青发带（白色只留给变白的鬓发）
      q.fillStyle = '#101316'; q.beginPath(); q.ellipse(-13, -45, 9, 7, -0.3, 0, TAU); q.fill();
      q.strokeStyle = '#a8cfc4'; q.lineWidth = 2; q.lineCap = 'round';
      q.beginPath(); q.ellipse(-13, -45, 5, 6.5, -0.3, 0.6, 2.6); q.stroke();
      q.lineWidth = 1.3; q.beginPath(); q.moveTo(-17, -41); q.quadraticCurveTo(-26, -36, -30, -27); q.moveTo(-16, -40); q.quadraticCurveTo(-22, -31, -22, -23); q.stroke();
    });
  }
  // 锦被：冷灰缎面，烛光一侧暖、窗光一侧泛蓝；盖过胸、膝两处隆起，在床沿垂下几道褶
  function quiltPath(q) {
    q.beginPath(); q.moveTo(506, 470); q.quadraticCurveTo(512, 404, 556, 398); q.quadraticCurveTo(620, 384, 690, 400);
    q.quadraticCurveTo(740, 414, 770, 420); q.quadraticCurveTo(820, 404, 870, 418); q.quadraticCurveTo(940, 436, 975, 470);
    q.quadraticCurveTo(992, 520, 996, BED - 6); q.quadraticCurveTo(1000, 620, 990, 652);
    q.quadraticCurveTo(930, 664, 880, 648); q.quadraticCurveTo(820, 666, 760, 650); q.quadraticCurveTo(700, 664, 640, 648); q.quadraticCurveTo(580, 660, 528, 646);
    q.lineTo(520, BED); q.closePath();
  }
  function roomTex() {
    return K.cache('g07|room4', W, H, 1, (q) => {
      const r = A.rng(2207);
      // 后墙：暗梅紫的板壁，靠窗处被天光微微照亮
      bandV(q, 0, 0, W, H, [[0, '#1c1622'], [0.6, '#261c28'], [1, '#100a10']]);
      q.strokeStyle = 'rgba(0,0,0,0.3)'; q.lineWidth = 2; for (let x = 40; x < W; x += 120) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, 470); q.stroke(); }
      q.fillStyle = K.rad(q, 860, 200, 0, 420, [[0, 'rgba(106,122,168,0.34)'], [0.5, 'rgba(106,122,168,0.12)'], [1, 'rgba(106,122,168,0)']]); q.fillRect(400, 0, 880, 640);
      // 墙上一幅小小的花蝶图（彩依的影子）
      q.fillStyle = '#d8ccb0'; q.fillRect(470, 60, 120, 200); q.fillStyle = '#e8dcc0'; q.fillRect(478, 70, 104, 180);
      q.fillStyle = '#3a2418'; q.fillRect(462, 54, 136, 8); q.fillRect(462, 258, 136, 8);
      q.strokeStyle = 'rgba(80,90,70,0.7)'; q.lineWidth = 1.2; q.beginPath(); q.moveTo(500, 240); q.quadraticCurveTo(520, 180, 556, 150); q.moveTo(526, 190); q.quadraticCurveTo(540, 176, 560, 182); q.stroke();
      for (const [x, y] of [[556, 150], [540, 176], [512, 210]]) { q.fillStyle = 'rgba(220,150,160,0.8)'; q.beginPath(); q.arc(x, y, 5, 0, TAU); q.fill(); }
      q.save(); q.translate(520, 120); q.rotate(-0.3); q.fillStyle = 'rgba(230,180,80,0.85)';
      q.beginPath(); q.ellipse(-7, -3, 8, 5, -0.5, 0, TAU); q.ellipse(7, -3, 8, 5, 0.5, 0, TAU); q.fill(); q.beginPath(); q.ellipse(-5, 5, 5, 3.5, 0.4, 0, TAU); q.ellipse(5, 5, 5, 3.5, -0.4, 0, TAU); q.fill(); q.restore();
      q.fillStyle = 'rgba(30,20,20,0.15)'; q.fillRect(478, 70, 104, 180);
      // 窗：两扇窗扇向内推开，窗外另画
      const [wx, wy, ww, wh] = WIN;
      q.globalCompositeOperation = 'destination-out'; q.fillStyle = '#000'; q.fillRect(wx, wy, ww, wh); q.globalCompositeOperation = 'source-over';
      q.strokeStyle = '#140c08'; q.lineWidth = 14; q.strokeRect(wx, wy, ww, wh);
      for (const [x0, sd] of [[wx, -1], [wx + ww, 1]]) {
        const x1 = x0 + sd * 46;
        q.fillStyle = '#2a1a12'; q.beginPath(); q.moveTo(x0, wy - 4); q.lineTo(x1, wy - 22); q.lineTo(x1, wy + wh + 22); q.lineTo(x0, wy + wh + 4); q.closePath(); q.fill();
        q.fillStyle = 'rgba(200,190,170,0.5)'; q.beginPath(); q.moveTo(x0 + sd * 6, wy + 6); q.lineTo(x1 - sd * 6, wy - 8); q.lineTo(x1 - sd * 6, wy + wh + 8); q.lineTo(x0 + sd * 6, wy + wh - 6); q.closePath(); q.fill();
        q.strokeStyle = '#2a1a12'; q.lineWidth = 2.2;
        for (let k = 1; k < 9; k++) { const u = k / 9; q.beginPath(); q.moveTo(x0 + sd * 6, lerp(wy + 6, wy + wh - 6, u)); q.lineTo(x1 - sd * 6, lerp(wy - 8, wy + wh + 8, u)); q.stroke(); }
        q.beginPath(); q.moveTo((x0 + x1) / 2, wy - 2); q.lineTo((x0 + x1) / 2, wy + wh + 6); q.stroke();
      }
      q.fillStyle = '#2a1a12'; q.fillRect(wx - 20, wy + wh, ww + 40, 14); q.fillStyle = 'rgba(160,180,220,0.35)'; q.fillRect(wx - 20, wy + wh, ww + 40, 1.6);
      // 床围（矮栏）：从帐子褶后面起，金线收得很暗
      q.fillStyle = K.lin(q, 0, 440, 0, 500, [[0, '#3a2418'], [1, '#22140c']]); q.fillRect(240, 446, W - 240, 60);
      q.strokeStyle = rgba(GOLD, 0.3); q.lineWidth = 1.2;
      for (let x = 250; x < W; x += 84) { q.strokeRect(x + 6, 452, 72, 46); q.beginPath(); q.arc(x + 42, 475, 12, 0, TAU); q.stroke(); }
      q.fillStyle = rgba(GOLD, 0.45); q.fillRect(240, 446, W - 240, 1.6);
      q.fillStyle = K.lin(q, 0, 500, 0, BED, [[0, '#4a3a44'], [1, '#2a1e26']]); q.fillRect(240, 500, W - 240, BED - 500);
      // 枕：紫缎绣金
      q.fillStyle = K.lin(q, 0, 466, 0, 540, [[0, '#7a6488'], [0.45, '#574266'], [1, '#2a1e34']]);
      q.beginPath(); q.moveTo(330, 486); q.quadraticCurveTo(326, 470, 344, 468); q.lineTo(600, 470); q.quadraticCurveTo(618, 474, 614, 492); q.lineTo(608, 536); q.lineTo(334, 536); q.closePath(); q.fill();
      q.strokeStyle = rgba(GOLD, 0.6); q.lineWidth = 1.4; q.strokeRect(352, 500, 240, 26);
      for (let x = 370; x < 590; x += 30) { q.beginPath(); q.arc(x, 513, 6, 0, TAU); q.stroke(); q.beginPath(); q.arc(x, 513, 2, 0, TAU); q.stroke(); }
      // 枕上铺开的发丝，然后是头
      q.fillStyle = 'rgba(14,16,18,0.92)';
      q.beginPath(); q.moveTo(430, 470); q.quadraticCurveTo(372, 474, 356, 508); q.quadraticCurveTo(384, 488, 426, 484); q.closePath(); q.fill();
      q.drawImage(headTex(), HEAD.x - 130, HEAD.y - 116, 260, 220);
      // 床沿：深木雕金（被子在这儿垂下来）
      q.fillStyle = K.lin(q, 0, BED, 0, H, [[0, '#4a2a18'], [1, '#160c06']]); q.fillRect(240, BED, W - 240, H - BED);
      q.fillStyle = rgba(GOLD, 0.55); q.fillRect(240, BED, W - 240, 2);
      q.strokeStyle = rgba(GOLD, 0.3); q.lineWidth = 1.4;
      for (let x = 250; x < W; x += 180) { q.strokeRect(x + 10, BED + 28, 160, 80); q.beginPath(); q.ellipse(x + 90, BED + 68, 44, 22, 0, 0, TAU); q.stroke(); }
      // 锦被：顶面由隆起处的亮到床沿渐暗；床沿往下的垂面更暗、带竖褶
      q.fillStyle = K.lin(q, 0, 384, 0, BED, [[0, '#c9cdd4'], [0.45, '#b8bcc4'], [1, '#9a9ea8']]); quiltPath(q); q.fill();
      q.save(); quiltPath(q); q.clip();
      q.fillStyle = K.lin(q, 500, 0, 1000, 0, [[0, 'rgba(255,186,128,0.2)'], [0.45, 'rgba(255,186,128,0)'], [0.7, 'rgba(140,166,214,0)'], [1, 'rgba(140,166,214,0.22)']]); q.fillRect(500, 380, 520, 300);
      // 腰间一道浅浅的凹（胸与膝之间）
      q.fillStyle = K.lin(q, 700, 0, 840, 0, [[0, 'rgba(60,62,76,0)'], [0.5, 'rgba(60,62,76,0.16)'], [1, 'rgba(60,62,76,0)']]); q.fillRect(700, 400, 140, BED - 400);
      // 垂面
      q.fillStyle = K.lin(q, 0, BED, 0, 664, [[0, '#8a8f9a'], [1, '#5e626e']]); q.fillRect(500, BED, 520, 90);
      // 顶面的褶：从隆起往床沿斜下，到垂面变成竖褶
      q.strokeStyle = 'rgba(64,66,82,0.3)'; q.lineWidth = 2;
      for (const [x0, y0, x1] of [[600, 404, 586], [680, 404, 660], [742, 426, 744], [820, 416, 812], [900, 440, 902], [960, 470, 966]]) { q.beginPath(); q.moveTo(x0, y0 + 6); q.quadraticCurveTo(x0 + 18, (y0 + BED) / 2, x1, BED + 4); q.lineTo(x1 + 4, 656); q.stroke(); }
      q.strokeStyle = 'rgba(236,238,244,0.22)'; q.lineWidth = 1.2;
      for (const [x0, y0, x1] of [[606, 404, 592], [686, 404, 666], [826, 416, 818], [906, 440, 908]]) { q.beginPath(); q.moveTo(x0, y0 + 6); q.quadraticCurveTo(x0 + 18, (y0 + BED) / 2, x1, BED + 4); q.lineTo(x1 + 4, 652); q.stroke(); }
      // 床沿处被子翻折的一道亮边
      q.fillStyle = 'rgba(232,234,240,0.35)'; q.fillRect(500, BED - 3, 520, 2.4);
      q.strokeStyle = rgba('#c8a868', 0.32); q.lineWidth = 1.1;
      for (let k = 0; k < 9; k++) { const x = 600 + r() * 360, y = 450 + r() * 120; q.beginPath(); q.arc(x, y, 8 + r() * 4, 0, TAU); q.stroke(); q.beginPath(); q.arc(x, y, 2.4, 0, TAU); q.stroke(); }
      q.restore();
      // 隆起的轮廓上一线窗光
      q.strokeStyle = 'rgba(214,224,244,0.5)'; q.lineWidth = 1.4;
      q.beginPath(); q.moveTo(556, 398); q.quadraticCurveTo(620, 384, 690, 400); q.quadraticCurveTo(740, 414, 770, 420); q.quadraticCurveTo(820, 404, 870, 418); q.quadraticCurveTo(940, 436, 975, 470); q.stroke();
      q.strokeStyle = 'rgba(50,52,64,0.45)'; q.lineWidth = 1; quiltPath(q); q.stroke();
      // 被头翻出的里子（领口一道浅青）
      q.fillStyle = '#a8c4bc'; q.beginPath(); q.moveTo(506, 470); q.quadraticCurveTo(512, 404, 556, 398); q.quadraticCurveTo(600, 388, 650, 388); q.lineTo(652, 400); q.quadraticCurveTo(586, 400, 556, 412); q.quadraticCurveTo(524, 426, 518, 480); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(60,70,66,0.4)'; q.lineWidth = 1; q.stroke();
      // 床尾：雕花床柱与挽起的帐子（暗）
      q.fillStyle = K.lin(q, 990, 0, 1090, 0, [[0, '#1a0e0a'], [0.5, '#3a2216'], [1, '#140a08']]); q.fillRect(1004, 140, 46, H - 140);
      q.fillStyle = rgba(GOLD, 0.35); q.fillRect(1034, 140, 2, H - 140);
      q.fillStyle = K.lin(q, 1040, 0, W, 0, [[0, '#2a1a26'], [0.4, '#3a2634'], [1, '#160e14']]);
      q.beginPath(); q.moveTo(1050, 0); q.lineTo(W, 0); q.lineTo(W, H); q.lineTo(1110, H); q.quadraticCurveTo(1060, 470, 1090, 300); q.quadraticCurveTo(1110, 200, 1050, 0); q.fill();
      q.strokeStyle = 'rgba(0,0,0,0.3)'; q.lineWidth = 3; for (const x of [1140, 1190, 1240]) { q.beginPath(); q.moveTo(x, 0); q.quadraticCurveTo(x - 30, 360, x - 10, H); q.stroke(); }
      // 床头：左侧垂下的厚帐子褶（暗，衬歌词）
      q.fillStyle = K.lin(q, 0, 0, 260, 0, [[0, '#120a10'], [0.6, '#22161e'], [0.9, '#2e1e28'], [1, '#160c12']]);
      q.beginPath(); q.moveTo(0, 0); q.lineTo(236, 0); q.quadraticCurveTo(262, 300, 246, H); q.lineTo(0, H); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(0,0,0,0.35)'; q.lineWidth = 3; for (const x of [50, 110, 170, 220]) { q.beginPath(); q.moveTo(x, 0); q.quadraticCurveTo(x + 14, 360, x + 4, H); q.stroke(); }
      q.strokeStyle = 'rgba(255,190,130,0.12)'; q.lineWidth = 2; q.beginPath(); q.moveTo(236, 0); q.quadraticCurveTo(262, 300, 246, H); q.stroke();
      // 床头小几（帐子前）
      q.fillStyle = '#2a1810'; q.fillRect(250, 548, 96, 12); q.fillRect(262, 560, 10, 160); q.fillRect(324, 560, 10, 160);
      q.fillStyle = rgba(GOLD, 0.45); q.fillRect(250, 548, 96, 1.5);
    });
  }
  // 窗外：黎明前的天（dawn 0..1 越来越亮）
  function windowSky(g, t, dawn) {
    const [wx, wy, ww, wh] = WIN;
    const sky = (d) => K.cache('g07|winsky3' + d, ww, wh, 1, (q) => {
      bandV(q, 0, 0, ww, wh, d ? [[0, '#4a5a80'], [0.5, '#a4b0c8'], [1, '#f2dac4']] : [[0, '#121a32'], [0.7, '#2c385a'], [1, '#4a5274']]);
      if (!d) { q.fillStyle = '#fff'; const r = A.rng(5); for (let k = 0; k < 22; k++) { q.globalAlpha = 0.3 + r() * 0.6; q.beginPath(); q.arc(r() * ww, r() * wh * 0.6, 0.6 + r() * 0.9, 0, TAU); q.fill(); } q.globalAlpha = 1; }
      q.fillStyle = d ? '#4c546a' : '#1a2034'; q.beginPath(); q.moveTo(0, wh - 40); for (let x = 0; x <= ww; x += 10) q.lineTo(x, wh - 46 - 22 * Math.sin(x / 40) - 10 * noise1(x / 24, 2)); q.lineTo(ww, wh); q.lineTo(0, wh); q.fill();
      q.fillStyle = d ? 'rgba(220,214,220,0.4)' : 'rgba(80,90,120,0.4)'; q.fillRect(0, wh - 60, ww, 30);
      // 梅枝剪影与几点白梅
      q.strokeStyle = d ? '#2a2a36' : '#0c0e18'; q.lineCap = 'round';
      q.lineWidth = 5; q.beginPath(); q.moveTo(ww + 10, 30); q.quadraticCurveTo(150, 54, 120, 46); q.quadraticCurveTo(90, 40, 70, 70); q.stroke();
      q.lineWidth = 2.4; q.beginPath(); q.moveTo(140, 52); q.quadraticCurveTo(130, 24, 110, 12); q.moveTo(96, 44); q.lineTo(84, 92); q.moveTo(70, 70); q.lineTo(44, 78); q.stroke();
      q.fillStyle = d ? 'rgba(244,240,244,0.85)' : 'rgba(200,206,230,0.65)';
      for (const [x, y] of [[110, 12], [84, 92], [120, 46], [44, 78], [150, 54], [128, 30], [70, 70]]) { q.beginPath(); q.arc(x, y, 3.4, 0, TAU); q.fill(); }
    });
    g.drawImage(sky(0), wx, wy, ww, wh);
    if (dawn > 0.004) { g.globalAlpha = dawn; g.drawImage(sky(1), wx, wy, ww, wh); g.globalAlpha = 1; }
  }
  // 鬓角四绺：每绺 6 根细发，从鬓边垂到枕上；“发、华、鬓、白”每字一绺由根到梢变白，白的前端走着一点亮
  function lockPath(i, j, t) {
    const [tx, ty] = toW(0.5 - i * 0.8, -9 + i * 1.6);
    const sw = Math.sin(t * 1.3 + i * 1.7) * 1.2, o = (j - 2.5) * 1.3;
    const p0 = [tx + o * 0.4, ty + o * 0.5], p1 = [tx - 6 + o * 0.8 + sw, ty + 20 + o * 0.3], p2 = [tx - 22 - i * 4 + o + sw, ty + 44 + i * 3], p3 = [tx - 30 - i * 9 + o * 1.4 + (h2(j, i) - 0.5) * 6, ty + 62 + i * 3 + h2(j, i + 4) * 8];
    return (u) => { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; };
  }
  function strands(g, lt, k, t) {
    g.lineCap = 'round';
    const N = 14;
    for (let i = 0; i < 4; i++) {
      const w = easeInOut(seg(lt, k[4 + i], k[4 + i] + 0.42));
      for (let j = 0; j < 6; j++) {
        const P = lockPath(i, j, t), lw = 0.8 + 0.6 * h2(j, i + 9);
        const pts = []; for (let n = 0; n <= N; n++) pts.push(P(n / N));
        g.strokeStyle = '#14171b'; g.lineWidth = lw; g.beginPath(); pts.forEach((p, n) => (n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        if (w <= 0) continue;
        // 白：由根到梢渐进，前端渐淡
        const [x0, y0] = pts[0], [xe, ye] = P(Math.min(1, w + 0.05));
        g.strokeStyle = K.lin(g, x0, y0, xe, ye, [[0, 'rgba(236,240,244,0.98)'], [Math.max(0.01, 0.8), 'rgba(230,234,240,0.9)'], [1, 'rgba(230,234,240,0)']]);
        g.lineWidth = lw * 1.05; g.beginPath();
        const m = Math.max(1, Math.ceil(w * N));
        for (let n = 0; n <= m; n++) { const p = P((Math.min(w + 0.05, 1) * n) / m); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        g.stroke();
      }
      // 白的前端一点亮，顺着发丝往下走
      if (w > 0 && w < 1) { const [fx, fy] = lockPath(i, 2, t)(w); dot(g, fx, fy, 9, '#eef4ff', 0.75 * Math.sin(PI * w)); }
    }
    // “白”字：鬓角整片染灰
    const gw = smooth(seg(lt, k[7], k[7] + 0.5));
    if (gw > 0) {
      g.save(); g.translate(HEAD.x, HEAD.y); g.scale(HEAD.s, HEAD.s); g.rotate(-PI / 2);
      g.globalAlpha *= 0.8 * gw; g.fillStyle = '#c8ccd0';
      g.beginPath(); g.moveTo(2, -9); g.quadraticCurveTo(-6, -6, -9.5, 4); g.quadraticCurveTo(-13, 4, -15, -2); g.quadraticCurveTo(-13, -12, -4, -15); g.quadraticCurveTo(1, -14, 2, -9); g.fill();
      g.strokeStyle = '#e4e8ec'; g.lineWidth = 0.5;
      for (let j = 0; j < 5; j++) { g.beginPath(); g.moveTo(1 - j * 3, -10 + j * 0.5); g.quadraticCurveTo(-6 - j * 2, -9 + j, -10 - j, 1 + j * 0.6); g.stroke(); }
      g.restore();
    }
  }
  // 晋元的手：掌、拇指、四指细长收尖；open 张开托着，0 时并拢微屈
  function jinHand(g, x, y, ang, sc, open) {
    const line = 'rgba(52,44,40,0.75)', sk = '#ecdfd2';
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc);
    g.fillStyle = sk; g.strokeStyle = line; g.lineWidth = 0.8 / sc;
    g.beginPath(); g.moveTo(-3, -6); g.quadraticCurveTo(9, -8.5, 15, -5); g.quadraticCurveTo(18, 1, 14.5, 6); g.quadraticCurveTo(4, 8.5, -3, 6); g.closePath(); g.fill(); g.stroke();
    for (let j = 0; j < 4; j++) {
      const y0 = -4.3 + j * 3, len = [14, 16.5, 15.5, 11.5][j], spread = (j - 1.5) * (0.05 + 0.14 * open), curl = 0.2 + 0.5 * (1 - open);
      const x1 = 14 + Math.cos(spread) * len * 0.55, y1 = y0 + Math.sin(spread) * len * 0.55 + curl * 2.5;
      const x2 = 14 + Math.cos(spread + curl) * len, y2 = y0 + Math.sin(spread + curl) * len + curl * 4;
      g.beginPath(); g.moveTo(13.5, y0 - 1.35); g.quadraticCurveTo(x1, y1 - 1.25, x2, y2); g.quadraticCurveTo(x1, y1 + 1.25, 13.5, y0 + 1.35); g.closePath(); g.fill(); g.stroke();
    }
    g.beginPath(); g.moveTo(3, -5.5); g.quadraticCurveTo(8, -11 - 3 * open, 13.5, -11.5 - 2 * open); g.quadraticCurveTo(10, -7.5, 7, -3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(200,150,140,0.25)'; g.beginPath(); g.ellipse(6, 1, 5, 3, 0, 0, TAU); g.fill();
    g.restore();
  }
  // 晋元的手臂：平时藏在被下，只一只手搭在被沿、被她握着；“殁”字手从被头下颤着抬起去够蝶；末了无力地垂落在被上
  const SHO_J = [598, 410], REST_H = [652, 574];
  function jinArm(g, lt, k, t, bf) {
    const out = smooth(seg(lt, k[10] + 0.02, k[10] + 0.12));
    const reachU = easeOut(seg(lt, k[10] + 0.02, k[10] + 0.75)), fall = easeIn(seg(lt, k[10] + 1.05, k[10] + 1.35));
    if (out < 1) {
      // 被沿露出的一截袖口和手（抬手时缩回被下）
      g.save(); g.globalAlpha *= 1 - out;
      g.fillStyle = '#a8cfc4'; g.beginPath(); g.ellipse(REST_H[0] - 14, REST_H[1] - 6, 9, 6, 0.5, 0, TAU); g.fill();
      jinHand(g, REST_H[0] - 8, REST_H[1] - 2, 0.55, 1.25, 0.15);
      g.restore();
      if (out <= 0) return;
    }
    // 够得着的地方：朝着蝶，最远 135
    const dx = bf[0] - SHO_J[0], dy = bf[1] - SHO_J[1], d = Math.hypot(dx, dy) || 1, L = Math.min(135, d);
    const reachT = [SHO_J[0] + (dx / d) * L, SHO_J[1] + (dy / d) * L];
    const trem = reachU * (1 - fall), start = [SHO_J[0] + 34, SHO_J[1] + 4];
    let T = [lerp(start[0], reachT[0], reachU) + 1.8 * Math.sin(t * 23) * trem, lerp(start[1], reachT[1], reachU) + 1.6 * Math.sin(t * 19 + 1) * trem];
    const limp = [672, 470];
    T = [lerp(T[0], limp[0], fall), lerp(T[1], limp[1], fall) - 5 * Math.sin(PI * seg(lt, k[10] + 1.35, k[10] + 1.52))];
    // 两节反解：肘往下沉
    const L1 = 70, L2 = 68, ex = T[0] - SHO_J[0], ey = T[1] - SHO_J[1], dd = clamp(Math.hypot(ex, ey), 24, L1 + L2 - 1);
    const a0 = Math.atan2(ey, ex), cA = clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1);
    const ae = a0 + Math.acos(cA) * (ex >= 0 ? 1 : -1);
    const E1 = [SHO_J[0] + Math.cos(ae) * L1, SHO_J[1] + Math.sin(ae) * L1];
    const fa = Math.atan2(T[1] - E1[1], T[0] - E1[0]);
    const wr = [lerp(E1[0], T[0], 0.84), lerp(E1[1], T[1], 0.84)];
    const lift = reachU * (1 - fall), line = 'rgba(46,56,54,0.75)';
    g.save(); g.globalAlpha *= out; g.lineCap = 'round'; g.lineJoin = 'round';
    // 宽袖往下垂成一兜（先画在臂后）
    const n = 10, top = [], bot = [];
    const nx = -Math.sin(fa), ny = Math.cos(fa), sgn = ny >= 0 ? 1 : -1;
    for (let j = 0; j <= n; j++) {
      const u = j / n, px = lerp(E1[0], wr[0], u), py = lerp(E1[1], wr[1], u);
      top.push([px, py]);
      const sag = (16 + 30 * lift) * Math.sin(PI * (0.1 + 0.75 * u)) * (1 - 0.25 * u);
      bot.push([px + nx * sgn * 11, py + ny * sgn * 11 + sag]);
    }
    g.fillStyle = K.lin(g, E1[0], E1[1], E1[0], E1[1] + 60, [[0, '#e8eee9'], [1, '#a6b5af']]);
    g.beginPath(); top.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let j = n; j >= 0; j--) g.lineTo(bot[j][0], bot[j][1]); g.closePath(); g.fill();
    g.strokeStyle = line; g.lineWidth = 0.9; g.beginPath(); bot.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    g.strokeStyle = 'rgba(110,140,130,0.45)'; g.lineWidth = 1.1;
    for (const j of [3, 6]) { g.beginPath(); g.moveTo(top[j][0], top[j][1] + 6); g.quadraticCurveTo(lerp(top[j][0], bot[j][0], 0.5) - 4, lerp(top[j][1], bot[j][1], 0.6), bot[j][0] - 6, bot[j][1] - 2); g.stroke(); }
    // 臂：圆头粗线勾出袖筒，先描边再填色
    const arm = () => { g.beginPath(); g.moveTo(SHO_J[0], SHO_J[1]); g.lineTo(E1[0], E1[1]); g.lineTo(wr[0], wr[1]); };
    g.strokeStyle = line; g.lineWidth = 25; arm(); g.stroke();
    g.strokeStyle = '#eef3ee'; g.lineWidth = 23; arm(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(SHO_J[0] - nx * 4, SHO_J[1] - 8); g.lineTo(E1[0] - nx * sgn * 6, E1[1] - ny * sgn * 6); g.lineTo(wr[0] - nx * sgn * 6, wr[1] - ny * sgn * 6); g.stroke();
    // 被头压住肩那一截
    g.fillStyle = '#b8bcc4'; g.beginPath(); g.ellipse(SHO_J[0] - 2, SHO_J[1] + 8, 22, 10, -0.1, 0, TAU); g.fill();
    g.fillStyle = '#a8c4bc'; g.beginPath(); g.ellipse(SHO_J[0] - 4, SHO_J[1] + 1, 20, 5, -0.1, 0, TAU); g.fill();
    // 袖口一道浅青
    g.strokeStyle = '#a8cfc4'; g.lineWidth = 3; g.beginPath(); g.moveTo(wr[0] - nx * 11, wr[1] - ny * 11); g.lineTo(wr[0] + nx * 11, wr[1] + ny * 11); g.stroke();
    jinHand(g, wr[0] + Math.cos(fa) * 2, wr[1] + Math.sin(fa) * 2, fa + 0.1 * (1 - lift), 1.3, lift);
    g.restore();
  }
  // 彩依：坐在床沿、他的头边，低头看着他，一只手覆在他的手上；缓存成一张，只轻轻晃
  const CAI = { x: 712, y: BED + 2, s: 2.5 };
  const CAIO = { pose: 'sit', seat: 'ledge', facing: -1, head: 0.5, lean: 0.12, rim: '#b0c6ee', light: [880, 60], glow: 0, wind: 0.15, night: true, seed: 2 };
  const CBOX = [CAI.x - 260, CAI.y - 300, CAI.x + 200, CAI.y + 140];
  function caiSprite() {
    return K.cache('g07|caiS', CBOX[2] - CBOX[0], CBOX[3] - CBOX[1], 1, (q) => {
      F.draw(q, 'caiyi', CAI.x - CBOX[0], CAI.y - CBOX[1], CAI.s, 1.1, CAIO);
    });
  }
  const CAIP = () => F.points('caiyi', CAI.x, CAI.y, CAI.s, 1.1, CAIO);
  function putCai(q, t) {
    q.save(); q.translate(CAI.x, CAI.y); q.transform(1, 0, 0.012 * Math.sin(t * 0.9), 1 + 0.004 * Math.sin(t * 1.3), 0, 0); q.translate(-CAI.x, -CAI.y);
    q.drawImage(caiSprite(), CBOX[0], CBOX[1], CBOX[2] - CBOX[0], CBOX[3] - CBOX[1]);
    q.restore();
  }
  const BORN = [508, 352];  // 蝶在他脸上方成形
  // 蝶的路线：“颜”在他脸上方成形，“殁”振翅飞起、掠过他额角，绕向窗口，停在窗口扑翅（接下一镜）
  function bflyAt(lt, k) {
    const t0 = k[10], u = seg(lt, t0, t0 + 1.25), e = easeInOut(u);
    const p0 = BORN, p1 = [600, 170], p2 = EXIT;
    let x = (1 - e) * (1 - e) * p0[0] + 2 * e * (1 - e) * p1[0] + e * e * p2[0];
    let y = (1 - e) * (1 - e) * p0[1] + 2 * e * (1 - e) * p1[1] + e * e * p2[1];
    const sway = Math.sin(PI * u) + 0.25;
    x += Math.sin(lt * 7) * 6 * sway; y += Math.cos(lt * 9) * 5 * sway;
    if (u <= 0) { x += Math.sin(lt * 3) * 3; y += Math.cos(lt * 2.4) * 3; }
    return [x, y, u];
  }
  function drawRoom(g, c, lt, t, k) {
    const z = 1 + 0.045 * easeInOut(seg(lt, k[4], c.dur));
    g.save(); g.translate(600, 420); g.scale(z, z); g.translate(-600, -420);
    const dawn = smooth(seg(lt, k[4] - 0.3, c.dur + 0.4));
    windowSky(g, t, dawn);
    g.drawImage(roomTex(), 0, 0, W, H);
    // 窗光：冷冷的一道斜照在被面上，天越亮越清楚
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.2 + 0.45 * dawn;
    g.drawImage(K.cache('g07|winbeam4', 520, 420, 0.25, (q) => {
      q.translate(-480, -300);
      try { q.filter = `blur(${(10 * SS() * 0.25).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      q.fillStyle = K.lin(q, 860, 60, 640, 640, [[0, 'rgba(150,172,214,0.5)'], [1, 'rgba(150,172,214,0)']]);
      q.beginPath(); q.moveTo(760, 330); q.lineTo(960, 330); q.lineTo(960, 680); q.lineTo(640, 680); q.closePath(); q.fill();
    }), 480, 300, 520, 420);
    g.restore();
    // 床头一支残红烛：暖光照在他脸上，天亮时一点点暗下去；蝶飞走那一下，火苗猛地一偏
    const gust = lt > k[10] + 0.15 ? Math.exp(-(lt - k[10] - 0.15) / 0.3) : 0;
    E.candle(g, { x: 298, y: 548, h: 64, r: 8.5, t, burn: 0.5 + 0.3 * dawn, color: RED, seed: 7, glow: 1.5 - 0.7 * dawn, wind: 0.15 + 0.9 * gust });
    dot(g, 440, 450, 170, '#ffb070', 0.22 * (1 - 0.6 * dawn));
    strands(g, lt, k, t);
    const bf = bflyAt(lt, k);
    jinArm(g, lt, k, t, bf);
    // 彩依：“英”起由下往上收拢，擦口一道金边；金粉旋着飞到他脸上方，聚成一只蝶
    const dis = seg(lt, k[8], k[10] + 0.05);
    if (dis <= 0) putCai(g, t);
    else if (dis < 1) {
      const m = g.getTransform(), D = devBox(g, CBOX);
      const B = scratch('g07cai', D.w, D.h);
      B.q.setTransform(m.a, m.b, m.c, m.d, m.e - D.X0, m.f - D.Y0);
      putCai(B.q, t);
      const top = CAI.y - 210, bot = CAI.y + 130, ey = lerp(bot, top, dis);
      B.q.globalCompositeOperation = 'destination-out';
      B.q.fillStyle = K.lin(B.q, 0, ey - 36, 0, ey + 6, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      B.q.fillRect(CBOX[0], ey - 36, CBOX[2] - CBOX[0], CBOX[3] - ey + 40);
      B.q.globalCompositeOperation = 'source-atop';
      B.q.fillStyle = K.lin(B.q, 0, ey - 56, 0, ey, [[0, 'rgba(255,220,140,0)'], [1, 'rgba(255,232,170,0.95)']]);
      B.q.fillRect(CBOX[0], ey - 56, CBOX[2] - CBOX[0], 60);
      B.q.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(B.cv, 0, 0, D.w, D.h, D.X0, D.Y0, D.w, D.h); g.restore();
      // 她身上的一层柔光（画在草稿层外，不会被框住）
      const P = CAIP();
      dot(g, P.chest[0], lerp(P.chest[1], ey, 0.4), 120, '#ffe0a0', 0.3 * Math.sin(PI * dis), 'screen');
      for (let j = 0; j < 46; j++) {
        const ph = (dis * 2.4 + h2(j, 3)) % 1;
        const sx = CAI.x - 120 + h2(j, 4) * 200, sy = lerp(bot, top, clamp(dis + 0.05)) + (h2(j, 7) - 0.5) * 30;
        const e = easeIn(ph), ang = h2(j, 5) * TAU + ph * 5;
        const x = lerp(sx, BORN[0], e) + Math.cos(ang) * 30 * (1 - e), y = lerp(sy, BORN[1], e) - Math.sin(PI * e) * 50 + Math.sin(ang) * 18 * (1 - e);
        dot(g, x, y, 3 + 5 * h2(j, 6), '#ffd890', 0.75 * Math.sin(PI * ph) * (1 - seg(dis, 0.92, 1)));
      }
    }
    // 蝶：“颜”字在他脸上方显形，“殁”字飞走
    const born = seg(lt, k[9] - 0.1, k[10]);
    if (born > 0) {
      const u = bf[2], s = lerp(14, 46, easeOut(born)) * (1 - 0.45 * smooth(u * 1.25 - 0.15));
      const flap = lt < k[10] ? 0.55 + 0.45 * Math.sin(lt * 9) : Math.abs(Math.cos(lt * 15));
      const hd = Math.atan2(EXIT[1] - BORN[1], EXIT[0] - BORN[0]) + PI / 2;
      for (let j = 1; j <= 9; j++) { const p = bflyAt(lt - j * 0.06, k); if (p[2] <= 0) break; dot(g, p[0], p[1] + j * 1.6, 6 - j * 0.5, '#ffe0a0', 0.4 * (1 - j / 10), 'screen'); }
      butterfly(g, bf[0], bf[1], s, lerp(-0.2, hd - 0.3, smooth(u * 3)) + 0.15 * Math.sin(lt * 5), flap, { glow: 0.35 * born * (1 - 0.3 * u), op: 'screen' });
    }
    // 上方垂下的帐幔，两侧挽起
    g.save(); g.globalAlpha = 0.6;
    for (const [x, sd] of [[180, 1], [1050, -1]]) { g.save(); g.translate(x, -20); g.transform(1.1, 0, 0.03 * Math.sin(t * 0.8 + sd) + (lt > k[10] ? 0.05 * Math.sin(PI * seg(lt, k[10], k[10] + 1.4)) * sd : 0), 1.0, 0, 0); g.drawImage(gauzeTex(), 0, 0, 140, 420); g.restore(); }
    g.restore();
    g.restore();
  }

  XYT.registerShot('c1_caiyi', {
    name: '彩依还蝶', zone: 'left', night: true,
    text: '#e9f1f6', shadow: 'rgba(14,10,22,0.92)', accent: '#f0c239', bloom: 0.42,
    draw(g, c) {
      const lt = c.lt, t = c.t, k = chars(c, T22);
      // 卧房的贴图在喜堂这几秒里先建好，硬切时不卡
      if (lt > 0.5) headTex();
      if (lt > 0.9) roomTex();
      if (lt > 2.0) litRoom('n');
      if (lt > 2.6) litRoom('d');
      if (lt > 3.2) litRoom('o');
      if (lt > 1.3) caiSprite();
      if (lt > 1.6) gauzeTex();
      if (lt < k[4]) drawHall(g, c, lt, t, k);
      else drawRoom(g, c, lt, t, k);
    },
  });

  // =====================================================================
  // 第23句 蝶绕残烛：〔第23句第1–4字〕｜〔第23句第5–8字〕｜〔第23句第9–11字〕
  // =====================================================================
  const T23 = [0.29, 0.61, 0.99, 1.41, 2.09, 2.69, 3.01, 3.51, 3.81, 4.31, 4.71];
  const WX0 = 630, WX1 = 990, WY0 = -14, WY1 = 430;      // 冰裂纹木窗（上缘出画）
  const CX = 380, CR = 17, CBASE = 584, TABLE = 612;    // 残烛：x、半径、烛脚、桌面
  const CTOP0 = 494;                                    // 烛顶（约 90 像素高的残烛）
  const SUN = [812, 236], RIDGE = 372;                  // 太阳跃出后的位置、远山脊线
  const BIN = [880, 260];                               // 上一镜蝶出窗处（屏幕同一点）
  const cTop = (lt) => CTOP0 + 7 * clamp(lt / 6.6);     // 烛一点点矮下去
  // 窗外的天：0 日出前（深靛，山脊一线余烬），1 日出后（金）
  function dawnTex(d) {
    const w = WX1 - WX0, h = WY1 - WY0;
    return K.cache('g07|dawn2' + d, w, h, 1, (q) => {
      const yr = RIDGE - WY0;
      if (!d) {
        bandV(q, 0, 0, w, h, [[0, '#1e2644'], [0.62, '#2c2c50'], [0.8, '#3a3058'], [1, '#3a3058']]);
        // 山脊上一线余烬
        q.fillStyle = K.lin(q, 0, yr - 40, 0, yr + 4, [[0, 'rgba(255,120,60,0)'], [0.75, 'rgba(255,120,60,0.35)'], [1, 'rgba(255,170,90,0.6)']]); q.fillRect(0, yr - 40, w, 44);
        q.fillStyle = K.rad(q, SUN[0] - WX0, yr, 0, 140, [[0, 'rgba(255,140,70,0.45)'], [1, 'rgba(255,140,70,0)']]); q.fillRect(0, yr - 140, w, 160);
        q.fillStyle = '#fff'; const r = A.rng(8); for (let k = 0; k < 18; k++) { q.globalAlpha = 0.25 + r() * 0.5; q.beginPath(); q.arc(r() * w, r() * yr * 0.7, 0.6 + r() * 0.8, 0, TAU); q.fill(); } q.globalAlpha = 1;
      } else {
        bandV(q, 0, 0, w, h, [[0, '#d9a24a'], [0.35, '#f2be45'], [0.72, '#ff9a42'], [0.86, '#ff8936'], [1, '#f6b060']]);
        q.fillStyle = K.rad(q, SUN[0] - WX0, SUN[1] - WY0, 0, 300, [[0, 'rgba(255,246,210,0.75)'], [0.3, 'rgba(255,226,150,0.35)'], [1, 'rgba(255,220,140,0)']]); q.fillRect(0, 0, w, h);
      }
    });
  }
  // 远山与屋脊剪影（天空透明，太阳从山后跃出）
  function ridgeTex(d) {
    const w = WX1 - WX0, h = WY1 - WY0;
    return K.cache('g07|ridge2' + d, w, h, 1, (q) => {
      const yr = RIDGE - WY0;
      for (const [y0, amp, col, sd] of [[yr - 6, 30, d ? '#c88a68' : '#3c2c48', 3], [yr + 12, 24, d ? '#a06a58' : '#2c2038', 5], [yr + 30, 16, d ? '#784a44' : '#1e1626', 7]]) {
        q.fillStyle = col; q.beginPath(); q.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) q.lineTo(x, y0 - amp * (0.5 + 0.5 * Math.sin(x / 70 + sd)) - 14 * noise1(x / 30, sd));
        q.lineTo(w, h); q.closePath(); q.fill();
      }
      q.fillStyle = d ? '#4a2c28' : '#160e16';
      const r = A.rng(31);
      let x = -10;
      while (x < w + 20) { const ww = 50 + r() * 70, hh = 10 + r() * 16; q.fillRect(x, h - 10 - hh, ww, h); q.fillRect(x - 4, h - 14 - hh, ww * 0.3, 5); q.fillRect(x + ww * 0.7, h - 14 - hh, ww * 0.34, 5); x += ww + 2; }
    });
  }
  // 冰裂纹窗棂：把窗框反复用随机直线切开，切到每格六七十像素，格边就是一根根木条（像冰面裂开）
  function iceCells() {
    const r = A.rng(2333), w = WX1 - WX0, h = WY1 - WY0, out = [];
    const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    const split = (P, depth) => {
      if (area(P) < 3600 + r() * 2600 || depth > 10) { out.push(P); return; }
      let cx = 0, cy = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of P) { cx += p[0]; cy += p[1]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      cx /= P.length; cy /= P.length;
      // 切线大致横着切高的格、竖着切宽的格，再随机偏一点
      const a = (x1 - x0 > y1 - y0 ? PI / 2 : 0) + (r() - 0.5) * 1.3;
      const px = cx + (r() - 0.5) * (x1 - x0) * 0.3, py = cy + (r() - 0.5) * (y1 - y0) * 0.3, dx = Math.cos(a), dy = Math.sin(a);
      const side = (p) => (p[0] - px) * dy - (p[1] - py) * dx;
      const L = [], R = [];
      for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[(i + 1) % P.length], sp = side(p), sq = side(q);
        if (sp >= 0) L.push(p); if (sp <= 0) R.push(p);
        if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const u = sp / (sp - sq), m = [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]; L.push(m); R.push(m); }
      }
      if (L.length < 3 || R.length < 3) { out.push(P); return; }
      split(L, depth + 1); split(R, depth + 1);
    };
    split([[12, 12], [w - 12, 12], [w - 12, h - 12], [12, h - 12]], 0);
    return out;
  }
  const ICE = iceCells();
  const icePath = (q) => { q.beginPath(); for (const P of ICE) { q.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) q.lineTo(P[i][0], P[i][1]); q.closePath(); } };
  function latticeTex() {
    const w = WX1 - WX0, h = WY1 - WY0;
    return K.cache('g07|lattice2', w, h, 1, (q) => {
      q.lineJoin = 'miter'; q.lineCap = 'square';
      q.strokeStyle = '#22130e'; q.lineWidth = 6; icePath(q); q.stroke();
      q.save(); q.translate(-1, -1.5); q.strokeStyle = 'rgba(150,104,70,0.45)'; q.lineWidth = 1.1; icePath(q); q.stroke(); q.restore();
      // 外圈边框
      q.strokeStyle = '#1a0e0a'; q.lineWidth = 24; q.strokeRect(0, 0, w, h);
      q.strokeStyle = 'rgba(150,100,70,0.45)'; q.lineWidth = 1.4; q.strokeRect(12, 12, w - 24, h - 24);
    });
  }
  // 冰裂纹透进来的光斑：去掉木条的格子，预先模糊、四周羽化
  function latticeLight() {
    const w = WX1 - WX0, h = WY1 - WY0;
    return K.cache('g07|latlight2', w, h, 0.4, (q) => {
      try { q.filter = `blur(${(3 * SS() * 0.4).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      q.fillStyle = 'rgba(255,212,140,1)'; q.fillRect(12, 12, w - 24, h - 24);
      q.globalCompositeOperation = 'destination-out'; q.strokeStyle = '#000'; q.lineWidth = 9; icePath(q); q.stroke();
      q.filter = 'none';
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.rad(q, w / 2, h / 2, Math.min(w, h) * 0.25, Math.max(w, h) * 0.62, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 屋内（缓存）：暗木墙、窗洞、看得清轮廓的空床（隔着纱）、桌案、书与扇、烛台
  function candleRoomTex() {
    return K.cache('g07|croom2', W, H, 1, (q) => {
      const r = A.rng(2301);
      bandV(q, 0, 0, W, H, [[0, '#1c1312'], [0.7, '#2a1c1a'], [1, '#140c0a']]);
      for (let k = 0; k < 18; k++) { q.fillStyle = rgba(r() < 0.5 ? '#4a3230' : '#1a100e', 0.08 + r() * 0.06); A.inkBlob(q, r() * W, r() * 560, 30 + r() * 80, k, 0.5); q.fill(); }
      // 墙上的竖板缝
      q.strokeStyle = 'rgba(0,0,0,0.25)'; q.lineWidth = 2; for (let x = 1020; x < W; x += 90) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, TABLE); q.stroke(); }
      // 空床：床柱、床顶横楣、叠好的被、枕；前面垂着半透的纱
      const bed = document.createElement('canvas'), S = SS();
      bed.width = Math.ceil(360 * S); bed.height = Math.ceil(620 * S);
      const b = bed.getContext('2d'); b.scale(S, S);
      b.fillStyle = '#2a1a16'; b.fillRect(30, 40, 16, 580); b.fillRect(300, 40, 16, 580); b.fillRect(20, 40, 310, 26);
      b.fillStyle = 'rgba(200,160,100,0.35)'; b.fillRect(20, 64, 310, 2);
      b.fillStyle = '#3a2620'; b.fillRect(30, 470, 286, 30);
      b.fillStyle = '#4a3238'; b.fillRect(46, 440, 254, 32);
      // 叠好的被：几层月白的方块，枕在床头
      b.fillStyle = '#6e6a74'; b.beginPath(); b.moveTo(150, 442); b.lineTo(150, 398); b.quadraticCurveTo(152, 390, 162, 390); b.lineTo(280, 390); b.quadraticCurveTo(292, 392, 290, 404); b.lineTo(290, 442); b.closePath(); b.fill();
      b.fillStyle = '#86828c'; b.fillRect(152, 392, 136, 10); b.fillStyle = 'rgba(40,30,40,0.35)'; b.fillRect(150, 414, 140, 3); b.fillRect(150, 428, 140, 2);
      b.fillStyle = '#5a4466'; b.beginPath(); b.ellipse(92, 428, 42, 15, 0, 0, TAU); b.fill();
      b.strokeStyle = 'rgba(200,170,110,0.5)'; b.lineWidth = 1.2; b.strokeRect(156, 398, 128, 38);
      for (let k = 0; k < 6; k++) {
        const x0 = 16 + k * 56 + (k > 2 ? 36 : 0);
        b.fillStyle = K.lin(b, x0, 0, x0 + 56, 0, [[0, 'rgba(236,226,206,0.06)'], [0.5, 'rgba(236,226,206,0.3)'], [1, 'rgba(236,226,206,0.05)']]);
        b.beginPath(); b.moveTo(x0, 66); b.lineTo(x0 + 58, 66); b.quadraticCurveTo(x0 + 64 + (k > 2 ? 16 : -16), 330, x0 + 52 + (k > 2 ? 30 : -30), 620); b.lineTo(x0 - 4 + (k > 2 ? 30 : -30), 620); b.quadraticCurveTo(x0 - 2, 300, x0, 66); b.fill();
      }
      try { q.filter = `blur(${(2.2 * S).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      q.globalAlpha = 0.85; q.drawImage(bed, -20, 0, 360, 620); q.globalAlpha = 1;
      q.filter = 'none';
      // 窗洞与窗框
      q.globalCompositeOperation = 'destination-out'; q.fillStyle = '#000'; q.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0); q.globalCompositeOperation = 'source-over';
      q.fillStyle = '#2a1a14'; q.fillRect(WX0 - 30, WY1, WX1 - WX0 + 60, 16); q.fillStyle = 'rgba(255,200,150,0.22)'; q.fillRect(WX0 - 30, WY1, WX1 - WX0 + 60, 1.6);
      // 桌案：暗红漆面，边上一道亮
      q.fillStyle = K.lin(q, 0, TABLE, 0, H, [[0, '#4a2a22'], [0.3, '#3a1e18'], [1, '#160a08']]); q.fillRect(-20, TABLE, W + 40, H - TABLE);
      q.fillStyle = 'rgba(255,190,140,0.18)'; q.fillRect(-20, TABLE, W + 40, 2);
      q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillRect(-20, TABLE + 2, W + 40, 6);
      // 烛旁：一册线装书、一柄合起的折扇（他留下的，正落在日光里）
      q.save(); q.translate(530, TABLE + 6); q.rotate(-0.04);
      q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillRect(-72, -2, 150, 8);
      q.fillStyle = '#2a3a4c'; q.fillRect(-72, -20, 146, 18); q.fillStyle = '#e8dcc0'; q.fillRect(-68, -16, 140, 11); q.fillStyle = '#34485a'; q.fillRect(-74, -26, 150, 8);
      q.fillStyle = '#e8dcc0'; q.fillRect(-56, -25, 26, 5); q.strokeStyle = 'rgba(230,220,200,0.7)'; q.lineWidth = 0.8; for (let k = 0; k < 4; k++) { q.beginPath(); q.moveTo(-72, -24 + k * 6); q.lineTo(-66, -24 + k * 6); q.stroke(); }
      q.restore();
      q.save(); q.translate(672, TABLE + 2); q.rotate(0.1);
      q.fillStyle = 'rgba(0,0,0,0.35)'; q.beginPath(); q.ellipse(0, 6, 70, 4, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, -64, 0, 64, 0, [[0, '#6a4a30'], [0.5, '#c8a476'], [1, '#5a3a24']]);
      q.beginPath(); q.moveTo(-64, -4); q.lineTo(62, -8); q.lineTo(64, 1); q.lineTo(-64, 4); q.closePath(); q.fill();
      q.fillStyle = '#ece4d0'; q.beginPath(); q.moveTo(-18, -5); q.lineTo(62, -8); q.lineTo(63, -2); q.lineTo(-18, 1); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(80,60,40,0.4)'; q.lineWidth = 0.7; for (let k = 0; k < 6; k++) { q.beginPath(); q.moveTo(-14 + k * 13, -5.5 + k * -0.4); q.lineTo(-14 + k * 13, 0.6 - k * 0.2); q.stroke(); }
      q.strokeStyle = '#2a1a10'; q.lineWidth = 1; q.beginPath(); q.arc(-60, 0, 3.2, 0, TAU); q.stroke();
      q.strokeStyle = '#a8cfc4'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(-60, 3); q.quadraticCurveTo(-68, 16, -60, 30); q.stroke();
      q.fillStyle = '#a8cfc4'; q.beginPath(); q.ellipse(-60, 32, 2.4, 4, 0, 0, TAU); q.fill();
      q.restore();
      // 铜烛台：盘、柱、座
      q.fillStyle = 'rgba(0,0,0,0.4)'; q.beginPath(); q.ellipse(CX + 10, TABLE + 4, 70, 7, 0, 0, TAU); q.fill();
      const brass = K.lin(q, CX - 50, 0, CX + 50, 0, [[0, '#5a3a14'], [0.35, '#e0b45a'], [0.6, '#a87a30'], [1, '#3a2408']]);
      q.fillStyle = brass;
      q.beginPath(); q.ellipse(CX, TABLE - 2, 48, 8, 0, 0, TAU); q.fill();
      q.fillRect(CX - 8, CBASE + 6, 16, TABLE - CBASE - 8);
      q.beginPath(); q.ellipse(CX, CBASE + 14, 14, 4, 0, 0, TAU); q.fill();
      q.beginPath(); q.ellipse(CX, CBASE + 4, 44, 9, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(255,232,170,0.55)'; q.beginPath(); q.ellipse(CX - 16, CBASE + 1, 16, 2.2, 0, 0, TAU); q.fill();
      // 盘里层层凝住的红烛泪，往盘沿垂挂
      q.fillStyle = '#8a2018';
      q.beginPath(); q.ellipse(CX, CBASE + 2, 32, 7, 0, 0, TAU); q.fill();
      for (let k = 0; k < 7; k++) { const dx = -30 + k * 10 + (r() - 0.5) * 4, L = 6 + r() * 12; q.beginPath(); q.ellipse(CX + dx, CBASE + 7 + L / 2, 3.4, L / 2 + 2, 0, 0, TAU); q.fill(); }
      q.fillStyle = 'rgba(255,190,170,0.25)'; q.beginPath(); q.ellipse(CX - 10, CBASE, 12, 2.2, 0, 0, TAU); q.fill();
    });
  }
  // 红烛残身（烛顶随时间矮下去，逐帧画；身上一道道凝住的烛泪）
  function candleBody(g, top) {
    g.fillStyle = K.lin(g, CX - CR, 0, CX + CR, 0, [[0, '#7a1c12'], [0.3, '#e05a3a'], [0.55, '#c83c23'], [1, '#5a140c']]);
    g.beginPath(); g.moveTo(CX - CR, CBASE); g.lineTo(CX - CR + 1, top + 6); g.quadraticCurveTo(CX - CR + 4, top - 4, CX - 8, top + 2); g.quadraticCurveTo(CX, top + 6, CX + 7, top);
    g.quadraticCurveTo(CX + CR - 3, top - 7, CX + CR - 1, top + 4); g.lineTo(CX + CR, CBASE); g.closePath(); g.fill();
    g.fillStyle = '#8a2018';
    for (let k = 0; k < 7; k++) { const dx = -CR + 4 + k * 5, L = 8 + h2(k, 23) * 34; g.beginPath(); g.moveTo(CX + dx - 2.4, top + 3); g.lineTo(CX + dx - 2.2, top + L); g.arc(CX + dx, top + L, 2.4, PI, 0, true); g.lineTo(CX + dx + 2.4, top + 3); g.fill(); }
    g.fillStyle = 'rgba(255,200,170,0.28)'; g.fillRect(CX - 9, top + 8, 4, CBASE - top - 12);
    // 烛顶凹下去的一汪蜡
    g.fillStyle = '#e8644a'; g.beginPath(); g.ellipse(CX, top + 2, CR - 4, 4, 0, 0, TAU); g.fill();
    g.fillStyle = '#a82a1c'; g.beginPath(); g.ellipse(CX, top + 3, CR - 7, 2.4, 0, 0, TAU); g.fill();
  }
  // 烛泪：每两拍从烛口淌下一颗 7 像素的蜡珠，顺着烛身滑到烛脚
  function waxDrops(g, c, lt, top) {
    const t0 = c.t - lt, i0 = Math.ceil(c.grid.pos(t0 - 0.6));
    for (let i = i0; i <= c.b.i; i++) {
      if (((i % 2) + 2) % 2) continue;
      const age = c.t - c.grid.time(i);
      if (age < 0 || age > 2.4) continue;
      const dx = (h2(i, 4) - 0.5) * CR * 1.3, u = easeIn(clamp(age / 1.8));
      const y = lerp(top + 4, CBASE + 3, u), rr = 3.6 * Math.min(1, 0.5 + age * 2);
      g.fillStyle = '#9a2418';
      g.beginPath(); g.moveTo(CX + dx - 2, top + 4); g.lineTo(CX + dx - rr * 0.85, y); g.arc(CX + dx, y, rr, PI, 0, true); g.lineTo(CX + dx + 2, top + 4); g.fill();
      g.fillStyle = 'rgba(255,190,160,0.7)'; g.beginPath(); g.arc(CX + dx - 1.2, y - 1, 1.2, 0, TAU); g.fill();
    }
  }
  // 蝶的路线：在上一镜出窗处扑着翅，-0.3 秒起飞进来，绕烛一圈；“日”字扑向太阳，“争”字折回；“徒”火灭，“消”落在烛芯上
  function moth(lt, k) {
    const top = cTop(lt), fl = [CX, top - 70];
    const P = (x, y, z) => ({ x, y, z: z ?? 1 });
    if (lt < -0.3) return P(BIN[0] + Math.sin(lt * 6) * 3, BIN[1] + Math.cos(lt * 5) * 3, 0.75);
    if (lt < k[0]) { const u = easeInOut(seg(lt, -0.3, k[0])); return P(lerp(BIN[0], fl[0] + 130, u) + Math.sin(u * 6) * 14, lerp(BIN[1], fl[1] - 10, u) - Math.sin(u * PI) * 50, lerp(0.75, 1, u)); }
    // 绕烛一圈（前后有远近）
    if (lt < k[3] + 0.2) { const u = seg(lt, k[0], k[3] + 0.2), a = u * TAU; return P(fl[0] + Math.cos(a) * 130, fl[1] - 10 + Math.sin(a) * 40 - Math.sin(u * PI) * 20, 0.88 + 0.22 * Math.sin(a)); }
    if (lt < k[5]) { const u = lt - k[3] - 0.2; return P(fl[0] + 130 + Math.sin(u * 2.4) * 14, fl[1] - 12 + Math.sin(u * 4.1) * 10, 1); }
    // 扑向太阳
    if (lt < k[6] + 0.1) { const u = easeOut(seg(lt, k[5], k[6] + 0.1)); return P(lerp(fl[0] + 130, 760, u), lerp(fl[1] - 12, 300, u) + Math.sin(u * 8) * 8, lerp(1, 0.7, u)); }
    // 折回烛火
    if (lt < k[7]) { const u = easeInOut(seg(lt, k[6] + 0.1, k[7])); return P(lerp(760, fl[0] + 100, u), lerp(300, fl[1] - 40, u) - Math.sin(u * PI) * 30, lerp(0.7, 1, u)); }
    if (lt < k[8]) { const u = seg(lt, k[7], k[8]); return P(fl[0] + 100 - u * 40 + Math.sin(lt * 9) * 6, fl[1] - 40 + Math.sin(lt * 7) * 8, 1); }
    // 火灭后盘旋落下，“消”字停在烛芯上
    const u = easeInOut(seg(lt, k[8], k[9]));
    return P(lerp(fl[0] + 60, CX + 2, u) + Math.sin(u * 7) * 22 * (1 - u), lerp(fl[1] - 40, top - 22, u) - Math.sin(u * PI) * 24, 1);
  }
  function drawMoth(g, lt, k, t, sun) {
    const m = moth(lt, k), m0 = moth(lt - 0.05, k);
    const landed = lt >= k[9], thin = smooth(seg(lt, k[10] - 0.05, k[10] + 0.5));
    const s = 84 * m.z;
    let rot, open;
    if (!landed) {
      const hd = Math.atan2(m.y - m0.y, m.x - m0.x);
      rot = hd + PI / 2; rot = Math.atan2(Math.sin(rot), Math.cos(rot)) * 0.5;
      open = Math.abs(Math.cos(t * 14 + 0.3));
    } else {
      // 落定：翅膀先轻轻开合几下；“瘦”字之后翅膀垂开、身子一歪，不再扇动
      const settle = Math.exp(-(lt - k[9]) / 0.35);
      rot = 0.06 + 0.25 * thin;
      open = lerp(0.72 + 0.22 * Math.sin((lt - k[9]) * 12) * settle, 0.95, thin);
    }
    const y = landed ? m.y + 4 * thin : m.y;
    butterfly(g, m.x, y, s, rot, open, { thin, alpha: lerp(1, 0.72, thin), glow: (0.2 + 0.15 * sun) * (1 - thin) * (landed ? 0.6 : 1), glowColor: '#ffd890', op: 'screen' });
    // 最后一拍：翅上落下几片淡淡的鳞粉
    if (thin > 0.6) {
      const t0 = k[10] + 0.6;
      for (let i = 0; i < 4; i++) {
        const a = lt - t0 - i * 0.18;
        if (a < 0 || a > 2) continue;
        const x = m.x + (i - 1.5) * 18 + Math.sin(a * 3 + i) * 8, yy = y - 6 + a * (26 + 8 * i) + a * a * 6;
        g.fillStyle = `rgba(240,232,214,${0.7 * (1 - a / 2)})`;
        g.beginPath(); g.ellipse(x, yy, 3, 1.6, a * 2 + i, 0, TAU); g.fill();
      }
    }
    return m;
  }
  // 屋里的两团光：烛光（暖，靠烛）与晨光（金，靠窗），各一张整幅的径向渐变（无色带）
  function glowTex(kind) {
    return K.cache('g07|bfcglow' + kind, W, H, 0.5, (q) => {
      if (kind === 'c') q.fillStyle = K.rad(q, CX, CTOP0 - 40, 0, 460, [[0, 'rgba(255,160,80,0.55)'], [0.25, 'rgba(255,140,70,0.28)'], [0.6, 'rgba(255,120,60,0.08)'], [1, 'rgba(255,120,60,0)']]);
      else q.fillStyle = K.rad(q, SUN[0], SUN[1] + 80, 0, 760, [[0, 'rgba(255,214,150,0.5)'], [0.35, 'rgba(255,200,130,0.22)'], [0.7, 'rgba(255,190,120,0.07)'], [1, 'rgba(255,190,120,0)']]);
      q.fillRect(0, 0, W, H);
    });
  }

  // 屋子连同光一起烘成三张：n 日出前（只有烛光）、d 日出后（烛光弱下去、晨光与纱帐上的光斑）、o 烛灭后
  function litRoom(kind) {
    return K.cache('g07|litroom' + kind, W, H, 1, (q) => {
      q.drawImage(candleRoomTex(), 0, 0, W, H);
      q.globalCompositeOperation = 'screen';
      if (kind !== 'o') { q.globalAlpha = kind === 'n' ? 1 : 0.45; q.drawImage(glowTex('c'), 0, 0, W, H); }
      if (kind !== 'n') {
        q.globalAlpha = 0.9; q.drawImage(glowTex('s'), 0, 0, W, H);
        q.globalAlpha = 0.22; q.save(); q.translate(30, 170); q.transform(0.62, 0.18, -0.12, 0.85, 0, 0); q.drawImage(latticeLight(), 0, 0, WX1 - WX0, WY1 - WY0); q.restore();
      }
      q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    });
  }

  XYT.registerShot('c1_butterflycandle', {
    name: '蝶绕残烛', zone: 'right', night: true,
    text: '#e9f1f6', shadow: 'rgba(30,16,10,0.92)', accent: '#f2be45', bloom: 0.45,
    draw(g, c) {
      const lt = c.lt, t = c.t, k = chars(c, T23), top = cTop(lt);
      // 固定机位，只有 0.5 px 的呼吸
      g.save(); g.translate(Math.sin(t * 0.9) * 0.5, Math.sin(t * 0.7) * 0.5);
      const rise = easeOut(seg(lt, k[5] - 0.1, k[5] + 0.4));          // “日”字太阳跃出
      const day = smooth(seg(lt, k[5] - 0.2, c.dur));
      const ww = WX1 - WX0, wh = WY1 - WY0;
      // 窗外：深靛 → 金；太阳在“日”字从山后跳出来，弹一下再定住，两道薄云横过日面
      g.save(); g.beginPath(); g.rect(WX0, WY0, ww, wh); g.clip();
      if (rise < 1) g.drawImage(dawnTex(0), WX0, WY0, ww, wh);
      if (rise > 0) { g.globalAlpha = rise; g.drawImage(dawnTex(1), WX0, WY0, ww, wh); g.globalAlpha = 1; }
      const pop = seg(lt, k[5] - 0.1, k[5] + 0.7);
      const sy = lerp(RIDGE + 40, SUN[1], easeOut(Math.min(1, pop / 0.45))) - 14 * Math.sin(PI * clamp((pop - 0.3) / 0.4)) * (pop > 0.3 ? 1 : 0) - 6 * day;
      if (pop > 0) {
        const R = 46;
        g.fillStyle = K.rad(g, SUN[0], sy, R * 0.9, R * 3.4, [[0, 'rgba(255,170,90,0.55)'], [1, 'rgba(255,170,90,0)']]); g.fillRect(SUN[0] - R * 3.4, sy - R * 3.4, R * 6.8, R * 6.8);
        g.fillStyle = K.rad(g, SUN[0] - 10, sy - 10, 2, R, [[0, '#ffd27a'], [0.55, '#ff8a36'], [1, '#f2562a']]); g.beginPath(); g.arc(SUN[0], sy, R, 0, TAU); g.fill();
        for (const [dy, w, a] of [[-6, 150, 0.7], [16, 110, 0.55]]) { g.fillStyle = K.lin(g, SUN[0] - w, 0, SUN[0] + w, 0, [[0, 'rgba(200,90,50,0)'], [0.5, `rgba(200,90,50,${a})`], [1, 'rgba(200,90,50,0)']]); g.beginPath(); g.ellipse(SUN[0] + 10, sy + dy, w, 3.2, -0.02, 0, TAU); g.fill(); }
      }
      if (rise < 1) g.drawImage(ridgeTex(0), WX0, WY0, ww, wh);
      if (rise > 0) { g.globalAlpha = rise; g.drawImage(ridgeTex(1), WX0, WY0, ww, wh); g.globalAlpha = 1; }
      g.restore();
      g.drawImage(latticeTex(), WX0, WY0, ww, wh);
      // 屋子（光已烘好）：日出时由 n 过渡到 d，烛灭时由 d 过渡到 o
      const out = lt >= k[8], dim = 1 - 0.55 * rise, gone = out ? smooth((lt - k[8]) / 0.25) : 0;
      const rr = clamp(rise * 1.7);
      if (rr < 1) g.drawImage(litRoom('n'), 0, 0, W, H);
      if (rr > 0 && gone < 1) { g.globalAlpha = rr; g.drawImage(litRoom('d'), 0, 0, W, H); g.globalAlpha = 1; }
      if (gone > 0) { g.globalAlpha = gone; g.drawImage(litRoom('o'), 0, 0, W, H); g.globalAlpha = 1; }
      // 冰裂纹的光斑斜铺到桌上（随日头升起慢慢滑动）
      if (rise > 0) {
        g.save(); g.globalCompositeOperation = 'screen';
        const sl = 22 * day;
        g.globalAlpha = 0.55 * rise;
        g.translate(560 - sl, TABLE + 2); g.transform(1, 0, -1.1, 0.27, 0, 0); g.drawImage(latticeLight(), 0, 0, ww, wh);
        g.restore();
        // 烛身迎光的一侧亮起来，桌上拖出一道往左下的烛影
        g.save(); g.globalAlpha = rise;
        g.fillStyle = 'rgba(30,14,10,0.35)'; g.beginPath(); g.moveTo(CX - CR, TABLE + 2); g.lineTo(CX + CR, TABLE + 2); g.lineTo(CX - 60, TABLE + 40); g.lineTo(CX - 110, TABLE + 40); g.closePath(); g.fill();
        g.restore();
        if (rise > 0.3) V.godRays(g, c, { x: SUN[0], y: sy, angle: 2.4, spread: 0.42, n: 4, len: 860, width: 1.1, start: 0.25, color: '#ffe0a8', alpha: 0.4 * rise, source: false, beat: 0.25, res: 0.18, motes: 20, moteColor: '#fff4d8' });
      }
      // 残烛：火苗 6–10 Hz 抖动；太阳出来后在光里显得黯淡；“徒”字熄灭
      candleBody(g, top);
      if (rise > 0) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.5 * rise; g.fillStyle = K.lin(g, CX, 0, CX + CR, 0, [[0, 'rgba(255,200,130,0)'], [1, 'rgba(255,214,150,0.9)']]); g.fillRect(CX, top + 4, CR, CBASE - top - 4); g.restore(); }
      waxDrops(g, c, lt, top);
      if (!out) {
        V.flame(g, c, { kind: 'candle', x: CX, y: top - 3, s: 2.3, burn: 0.8, glow: 0.42 * dim, alpha: 0.65 + 0.35 * dim, color: '#ff9a3a', wind: 0.05 * Math.sin(t * 1.3) });
      } else {
        // 一缕青烟升起（偏开一点、往右卷），烛芯一点余红
        const age = lt - k[8];
        dot(g, CX + 1, top - 8, 6, '#ff6a2a', 0.7 * Math.exp(-age / 0.8));
        const sa = 0.6 * (1 - seg(lt, 4.6, 5.5));
        if (sa > 0) V.smoke(g, c, { kind: 'incense', x: CX + 6, y: top - 9, h: 280 * smooth(age / 1.2), n: 2, width: 1.8, wind: 0.25, color: '#c8ccd8', alpha: sa });
      }
      // 烛芯
      g.strokeStyle = '#1a100c'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(CX, top + 2); g.quadraticCurveTo(CX + 1.5, top - 5, CX + 1, top - 11); g.stroke();
      drawMoth(g, lt, k, t, rise);
      // 光里的浮尘（日出前很淡）
      V.dust(g, c, { n: 20, color: '#ffe8c0', alpha: 0.2 + 0.45 * rise, area: [200, 160, 1000, 640] });
      g.restore();
    },
  });

  // =====================================================================
  // 第24句 枫天初雪：〔第24句第1–11字〕｜〔第24句第12–14字〕
  // =====================================================================
  const T24 = [0.29, 0.59, 0.93, 1.39, 1.79, 2.19, 2.59, 3.09, 3.47, 3.89, 4.15, 5.03, 5.55, 6.01];
  // 枫谷远景：冷暮天、蜀山远峰、薄雾（缓存；大光晕用径向渐变，没有色带）
  function valleyFar() {
    return K.cache('g07|vfar2', W + 120, H + 80, 1, (q) => {
      q.translate(60, 40);
      bandV(q, -60, -40, W + 60, 620, [[0, '#1c3050'], [0.35, '#35608a'], [0.65, '#86aec6'], [0.85, '#cfdde2'], [1, '#e2e6e2']]);
      // 日落处的一抹余暖（在左，给人物逆光）
      q.globalCompositeOperation = 'screen';
      q.fillStyle = K.rad(q, 300, 470, 0, 520, [[0, 'rgba(240,200,176,0.42)'], [0.4, 'rgba(240,200,176,0.2)'], [0.75, 'rgba(240,200,176,0.06)'], [1, 'rgba(240,200,176,0)']]); q.fillRect(-60, -40, W + 120, 720);
      q.fillStyle = K.rad(q, 300, 520, 0, 260, [[0, 'rgba(255,230,208,0.4)'], [0.5, 'rgba(255,230,208,0.14)'], [1, 'rgba(255,230,208,0)']]); q.fillRect(-60, 200, 760, 520);
      q.globalCompositeOperation = 'source-over';
      E.clouds(q, { t: 0, y: 150, color: '#c8d8e6', shade: '#4a6a8a', alpha: 0.5, scale: 1.1, n: 4, seed: 41, speed: 0, lightX: 300 });
      E.mountains(q, { t: 0, lightDir: -1, layers: [
        { kind: 'karst', color: '#7a96ae', light: '#e8eef2', litA: 0.35, y: 470, scaleY: 0.9, speed: 0, seed: 7, fog: '#c8d6de', fogA: 0.5 },
        { kind: 'far', color: '#5a7a96', light: '#d8e4ec', litA: 0.3, y: 520, scaleY: 0.6, speed: 0, seed: 3, fog: '#b0c4d0', fogA: 0.45 },
      ] });
      E.mist(q, { t: 0, y: 500, h: 120, color: '#c4d4dc', alpha: 0.55, speed: 0, seed: 2 });
    });
  }
  // 中景：枫谷山坡，层林尽染（红只在坡上〔第8句第5–7字〕）；bright 只画枫林、颜色提亮（“〔第24句第12–14字〕”时叠上去）
  function valleyMid(bright) {
    return K.cache('g07|vmid' + (bright ? 'B' : 'A'), W + 120, 420, 1, (q) => {
      q.translate(60, -300);
      const r = A.rng(2401);
      if (!bright) for (const [y0, col, amp, sd] of [[560, '#3e566c', 50, 1], [610, '#2c3e50', 40, 2]]) {
        q.fillStyle = col; q.beginPath(); q.moveTo(-60, 720);
        for (let x = -60; x <= W + 60; x += 12) q.lineTo(x, y0 - amp * (0.5 + 0.5 * Math.sin(x / 160 + sd)) - 26 * noise1(x / 60, sd) + (x > 700 ? -(x - 700) * 0.12 : 0));
        q.lineTo(W + 60, 720); q.closePath(); q.fill();
      }
      // 枫林：一团团点叶，坡上越近越大；冷光里红得发暗，坡顶受逆光一点亮
      const cols = bright ? ['#ff4a2a', '#ff8a3a', '#e8361e', '#ffa050', '#d02a1c'] : ['#dc3023', '#ca6924', '#a8281c', '#e8762c', '#8a1c18'];
      for (let k = 0; k < 70; k++) {
        const x = 520 + r() * 820 + (r() < 0.25 ? -620 : 0), base = 600 - (x > 700 ? (x - 700) * 0.12 : 0) - r() * 50;
        const R = 14 + r() * 26 * (x > 900 ? 1.3 : 1);
        if (!bright) { q.fillStyle = '#2a1e1e'; q.fillRect(x - 1.5, base - R * 0.4, 3, R * 0.9); }
        const c0 = cols[Math.floor(r() * cols.length)];
        for (let j = 0; j < 26; j++) { const a = r() * TAU, d = Math.sqrt(r()) * R; q.fillStyle = rgba(c0, 0.55 + r() * 0.4); q.beginPath(); q.arc(x + Math.cos(a) * d, base - R * 0.6 + Math.sin(a) * d * 0.8, 2.6 + r() * 3.4, 0, TAU); q.fill(); }
        q.fillStyle = rgba('#ffd0a0', bright ? 0.4 : 0.25); q.beginPath(); q.arc(x - R * 0.3, base - R * 1.1, R * 0.35, 0, TAU); q.fill();
      }
      if (bright) return;
      // 坡间雾
      bandV(q, -60, 520, W + 60, 600, [[0, 'rgba(176,196,208,0)'], [0.6, 'rgba(176,196,208,0.45)'], [1, 'rgba(176,196,208,0)']]);
      // 石阶山道：从右下蜿蜒上坡
      q.fillStyle = '#5a6670';
      for (let k = 0; k < 14; k++) { const u = k / 13, x = lerp(1180, 860, u) + Math.sin(u * 5) * 30, y = lerp(700, 560, u), w = lerp(70, 26, u); q.fillRect(x - w / 2, y, w, 4 + 3 * (1 - u)); }
    });
  }
  // 远天上慢慢飘的几缕薄云
  function wispTex() {
    return K.cache('g07|wisp', 420, 110, 0.5, (q) => {
      try { q.filter = `blur(${(9 * SS() * 0.5).toFixed(1)}px)`; } catch (e) { /* 无 */ }
      const r = A.rng(77);
      for (let k = 0; k < 7; k++) { q.fillStyle = `rgba(214,228,240,${0.25 + r() * 0.2})`; q.beginPath(); q.ellipse(70 + r() * 280, 50 + (r() - 0.5) * 24, 50 + r() * 70, 9 + r() * 10, 0, 0, TAU); q.fill(); }
      q.filter = 'none';
    });
  }
  // 近景：右侧一棵老枫，枝头逆光透红
  function nearMaple() {
    return K.cache('g07|vnear', 520, 560, 1, (q) => {
      const r = A.rng(2407);
      q.translate(520, 0);
      q.strokeStyle = '#1e1414'; q.lineCap = 'round';
      const br = (x, y, a, L, w, d) => {
        if (d <= 0 || L < 10) return;
        const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
        q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo((x + x1) / 2 + (r() - 0.5) * 20, (y + y1) / 2 + (r() - 0.5) * 20, x1, y1); q.stroke();
        br(x1, y1, a + (r() - 0.6) * 0.8, L * 0.7, w * 0.65, d - 1);
        if (r() < 0.8) br(x1, y1, a - 0.6 - r() * 0.5, L * 0.6, w * 0.6, d - 1);
      };
      br(-40, 560, -1.9, 200, 34, 6);
      br(-90, 200, -2.6, 160, 16, 5);
      // 叶团：暗红底、亮红边（逆光）
      const leaf = (x, y, s, rot, c) => { q.save(); q.translate(x, y); q.rotate(rot); q.fillStyle = c; q.beginPath(); for (let k = 0; k < 5; k++) { const a = -PI / 2 + (k - 2) * 0.95, a2 = a + 0.475, rr = k === 2 ? 1 : k === 1 || k === 3 ? 0.88 : 0.62; q.lineTo(Math.cos(a - 0.12) * s * rr * 0.55, Math.sin(a - 0.12) * s * rr * 0.55); q.lineTo(Math.cos(a) * s * rr, Math.sin(a) * s * rr); q.lineTo(Math.cos(a + 0.12) * s * rr * 0.55, Math.sin(a + 0.12) * s * rr * 0.55); if (k < 4) q.lineTo(Math.cos(a2) * s * 0.3, Math.sin(a2) * s * 0.3); } q.closePath(); q.fill(); q.restore(); };
      const clusters = [[-250, 70, 90], [-150, 30, 80], [-340, 150, 70], [-60, 120, 80], [-220, 210, 60], [-420, 60, 60]];
      for (const pass of [0, 1]) for (const [cx, cy, R] of clusters) {
        for (let k = 0; k < (pass ? 50 : 70); k++) {
          const a = r() * TAU, d = Math.sqrt(r()) * R, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7;
          leaf(x, y, 9 + r() * 7, r() * TAU, pass ? rgba(r() < 0.5 ? '#f05a30' : '#ff8a40', 0.75) : rgba(r() < 0.5 ? '#8a1c18' : '#b82a20', 0.95));
        }
      }
    });
  }
  // 地上铺开的一层红叶（长音里慢慢显出来）
  function carpetTex() {
    return K.cache('g07|carpet', W + 80, 200, 1, (q) => {
      const r = A.rng(2411), PT = V.util.petalTex;
      q.fillStyle = K.lin(q, 0, 0, 0, 200, [[0, 'rgba(120,24,18,0)'], [0.35, 'rgba(120,24,18,0.45)'], [1, 'rgba(90,16,12,0.75)']]); q.fillRect(0, 0, W + 80, 200);
      for (let k = 0; k < 230; k++) {
        const y = 20 + Math.pow(r(), 0.7) * 180, s = 16 + (y / 200) * 34 * (0.6 + 0.6 * r()), x = r() * (W + 80);
        q.save(); q.translate(x, y); q.rotate(r() * TAU); q.scale(1, 0.45 + 0.4 * r()); q.globalAlpha = 0.75 + 0.25 * r();
        q.drawImage(PT('maple', Math.floor(r() * 60), false), -s / 2, -s / 2, s, s); q.restore();
      }
    });
  }
  // ---------- 少年仰脸的侧影 ----------
  // 局部坐标：面朝右；头在 HD 处往下挪了 10，颈短一些；整体再转一点让下巴微抬
  const HD = 18, EYE = [30, -12 + HD], RIM = '#e8f2fc';
  function headPath(g) {
    g.beginPath();
    g.moveTo(-4, -58 + HD);
    g.bezierCurveTo(14, -60 + HD, 27, -50 + HD, 31, -38 + HD);
    g.quadraticCurveTo(36, -27 + HD, 37, -20 + HD); g.quadraticCurveTo(35, -15.5 + HD, 36, -13 + HD); g.quadraticCurveTo(38, -10 + HD, 39, -8 + HD);
    g.quadraticCurveTo(45, -3 + HD, 49, 1.5 + HD); g.quadraticCurveTo(49.5, 4.5 + HD, 42, 6.2 + HD); g.quadraticCurveTo(43.2, 9 + HD, 42.6, 11 + HD);
    g.quadraticCurveTo(44.5, 13 + HD, 44, 14.5 + HD); g.quadraticCurveTo(42, 16.4 + HD, 41.6, 17.2 + HD); g.quadraticCurveTo(43.4, 19 + HD, 42.8, 21 + HD);
    g.quadraticCurveTo(39.5, 23.5 + HD, 39.6, 26 + HD); g.quadraticCurveTo(41, 31 + HD, 38, 34 + HD); g.quadraticCurveTo(30, 41 + HD, 18, 43 + HD);
    g.quadraticCurveTo(8, 46 + HD, -4, 44 + HD); g.lineTo(-26, 38 + HD); g.quadraticCurveTo(-30, 32 + HD, -32, 26 + HD);
    g.bezierCurveTo(-50, 8 + HD, -48, -36 + HD, -32, -50 + HD); g.quadraticCurveTo(-20, -59 + HD, -4, -58 + HD);
    g.closePath();
  }
  // 脸的侧轮廓（只这一段描一线天光）
  function facePath(g) {
    g.beginPath(); g.moveTo(31, -38 + HD);
    g.quadraticCurveTo(36, -27 + HD, 37, -20 + HD); g.quadraticCurveTo(35, -15.5 + HD, 36, -13 + HD); g.quadraticCurveTo(38, -10 + HD, 39, -8 + HD);
    g.quadraticCurveTo(45, -3 + HD, 49, 1.5 + HD); g.quadraticCurveTo(49.5, 4.5 + HD, 42, 6.2 + HD); g.quadraticCurveTo(43.2, 9 + HD, 42.6, 11 + HD);
    g.quadraticCurveTo(44.5, 13 + HD, 44, 14.5 + HD); g.quadraticCurveTo(42, 16.4 + HD, 41.6, 17.2 + HD); g.quadraticCurveTo(43.4, 19 + HD, 42.8, 21 + HD);
    g.quadraticCurveTo(39.5, 23.5 + HD, 39.6, 26 + HD); g.quadraticCurveTo(41, 31 + HD, 38, 34 + HD);
  }
  function neckPath(g) {
    g.beginPath(); g.moveTo(14, 54); g.quadraticCurveTo(9, 62, 11, 68); g.lineTo(13, 84); g.lineTo(-27, 84); g.quadraticCurveTo(-26, 66, -24, 52); g.closePath();
  }
  // 长衫：背后一侧的衣缘随风抖
  function robePath(g, t, fl) {
    g.beginPath();
    g.moveTo(13, 78); g.quadraticCurveTo(40, 92, 78, 104); g.bezierCurveTo(130, 118, 166, 146, 178, 190); g.lineTo(200, 420); g.lineTo(-220, 420);
    for (let j = 10; j >= 0; j--) { const u = j / 10, y = lerp(200, 420, u); g.lineTo(-196 - 24 * u + Math.sin(t * 3.4 + u * 7) * (2 + 7 * u) * fl, y); }
    g.bezierCurveTo(-180, 140, -120, 112, -70, 100); g.quadraticCurveTo(-40, 92, -27, 78); g.closePath();
  }
  function bust(g, t, wind, gust, lite) {
    const fl = 0.6 + 0.4 * wind + 1.2 * gust;
    // 马尾：六绺细发从发结甩向身后，各自错开相位；“都”字大风从左来，一绺绺往前卷
    const tieX = -14, tieY = -64 + HD;
    const strand = (len, w0, ph, da, col) => {
      const L = [], R = [];
      let x = tieX, y = tieY;
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const back = PI * 0.72 + da - lerp(0.6, 0.3, wind) * u * (1 - u * 0.5);
        const fwd = -0.95 + da * 2.2 + 1.35 * u + 0.3 * Math.sin(u * PI + ph);
        const a = lerp(back, fwd, gust) + Math.sin(t * (2.6 + ph * 0.3) + ph + u * 5) * (0.12 + 0.14 * gust) * u;
        const w = lerp(w0, 1, Math.pow(u, 1.2)) / 2 * (1 + 0.2 * Math.sin(u * PI));
        if (i) { x += Math.cos(a) * len / 14; y += Math.sin(a) * len / 14; }
        L.push([x - Math.sin(a) * w, y + Math.cos(a) * w]); R.push([x + Math.sin(a) * w, y - Math.cos(a) * w]);
      }
      g.fillStyle = col; g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath(); g.fill();
    };
    const STR = [[196, 11, 0, 0], [184, 10, 1.3, 0.07], [172, 9, 2.6, -0.06], [160, 8, 3.7, 0.13], [150, 7, 4.9, -0.11], [134, 6, 5.8, 0.18]];
    // 马尾背光一侧（上缘）的冷光
    // （lite：正被叶子吃掉时少画几笔）
    if (!lite) { g.save(); g.translate(-1.8, -1.6); for (let i = 0; i < 3; i++) { const [len, w0, ph, da] = STR[i]; strand(len, w0 + 1, ph, da, rgba(RIM, 0.8 - i * 0.2)); } g.restore(); }
    STR.forEach(([len, w0, ph, da], i) => { if (!lite || i < 4) strand(len, w0 + (lite ? 2 : 0), ph, da, i % 2 ? '#141a24' : '#0c1016'); });
    // 逆光轮廓：只在迎光一侧（左后上）留一线冷白，往下渐没
    g.save(); g.translate(-2.4, -1.2);
    g.fillStyle = K.lin(g, 0, -60, 0, 330, [[0, rgba(RIM, 1)], [0.35, rgba(RIM, 0.7)], [0.75, rgba(RIM, 0.12)], [1, rgba(RIM, 0)]]);
    robePath(g, t, fl); g.fill(); neckPath(g); g.fill(); headPath(g); g.fill();
    g.restore();
    // 衣：月白长衫背着光，冷灰蓝
    g.fillStyle = K.lin(g, 0, 80, 0, 420, [[0, '#3c4c5e'], [0.4, '#2c3a4a'], [1, '#1a2430']]); robePath(g, t, fl); g.fill();
    g.save(); robePath(g, t, fl); g.clip();
    g.fillStyle = K.lin(g, -200, 0, 200, 0, [[0, 'rgba(160,190,210,0.16)'], [0.5, 'rgba(160,190,210,0)'], [1, 'rgba(220,120,90,0.1)']]); g.fillRect(-230, 70, 440, 360);
    // 衣褶：几道顺着身子垂下的褶，随风微动
    g.strokeStyle = 'rgba(96,126,148,0.42)'; g.lineWidth = 1.8; g.lineCap = 'round';
    for (const [x0, y0, x1, k0] of [[-150, 150, -176, 0], [-96, 118, -120, 1], [-34, 130, -52, 2], [120, 150, 140, 3]]) {
      const sw = Math.sin(t * 1.9 + k0 * 1.3) * 4 * fl;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + sw + 10, 280, x1 + sw, 420); g.stroke();
    }
    g.strokeStyle = 'rgba(170,198,214,0.22)'; g.lineWidth = 1;
    if (!lite) for (const [x0, y0, x1] of [[-146, 152, -170], [-30, 132, -46]]) { g.beginPath(); g.moveTo(x0 + 3, y0); g.quadraticCurveTo((x0 + x1) / 2 + 13, 280, x1 + 3, 420); g.stroke(); }
    // 交领：颈下开一道 V，里面露白色中衣；两道月白领缘（外衫，半透）从颈后、颈前斜下交在胸前
    g.fillStyle = 'rgba(226,236,242,0.55)';
    g.beginPath(); g.moveTo(-16, 82); g.quadraticCurveTo(-2, 80, 14, 80); g.quadraticCurveTo(30, 120, 48, 160); g.quadraticCurveTo(14, 126, -16, 82); g.closePath(); g.fill();
    g.fillStyle = 'rgba(233,241,246,0.5)';
    g.beginPath(); g.moveTo(-28, 84); g.quadraticCurveTo(6, 128, 52, 168); g.lineTo(42, 172); g.quadraticCurveTo(-4, 134, -36, 92); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(10, 80); g.quadraticCurveTo(32, 120, 52, 168); g.lineTo(45, 168); g.quadraticCurveTo(22, 126, 2, 84); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,52,66,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-16, 82); g.quadraticCurveTo(14, 126, 48, 160); g.stroke();
    // 背后衣缘：一道飘动的亮边
    g.strokeStyle = 'rgba(200,220,236,0.3)'; g.lineWidth = 2; g.beginPath();
    for (let j = 0; j <= 10; j++) { const u = j / 10, y = lerp(200, 420, u), x = -194 - 24 * u + Math.sin(t * 3.4 + u * 7) * (2 + 7 * u) * fl; j ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.restore();
    // 颈：比脸略浅一点的墨蓝，和下颌分开
    g.fillStyle = '#1b2533'; neckPath(g); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(4, 58, 22, 6, 0, 0, TAU); g.fill();
    // 头：发与脸同是剪影，脸略透冷色，颊上一点枫叶的红反光
    g.fillStyle = '#10151d'; headPath(g); g.fill();
    g.save(); headPath(g); g.clip();
    g.fillStyle = K.rad(g, 30, -2 + HD, 2, 36, [[0, 'rgba(84,100,126,0.42)'], [0.6, 'rgba(84,100,126,0.16)'], [1, 'rgba(84,100,126,0)']]); g.fillRect(-10, -50 + HD, 70, 100);
    g.fillStyle = K.rad(g, 30, 10 + HD, 1, 16, [[0, 'rgba(200,80,56,0.16)'], [1, 'rgba(200,80,56,0)']]); g.fillRect(10, -10 + HD, 40, 40);
    // 发际线：额上与鬓角的墨发
    g.fillStyle = '#0a0d12'; g.beginPath(); g.moveTo(-4, -60 + HD); g.bezierCurveTo(16, -62 + HD, 30, -52 + HD, 32, -40 + HD); g.quadraticCurveTo(18, -40 + HD, 10, -30 + HD); g.quadraticCurveTo(2, -16 + HD, -2, 6 + HD); g.quadraticCurveTo(-10, 18 + HD, -30, 30 + HD); g.lineTo(-60, 0 + HD); g.lineTo(-40, -60 + HD); g.closePath(); g.fill();
    g.restore();
    // 脸上一线极细的天光，到下巴为止
    if (!lite) { g.strokeStyle = 'rgba(190,214,236,0.45)'; g.lineWidth = 0.9; g.save(); g.translate(0.7, -0.4); facePath(g); g.stroke(); g.restore(); }
    // 发髻、发带结
    g.fillStyle = RIM; g.beginPath(); g.ellipse(tieX - 1.6, tieY - 1.8, 12, 9, -0.4, 0, TAU); g.fill();
    g.fillStyle = '#0a0d12'; g.beginPath(); g.ellipse(tieX, tieY, 11, 8.4, -0.4, 0, TAU); g.fill();
    // 蓝发带两条
    const ribbon = (len, w0, ph, da, col) => {
      let x = tieX + 2, y = tieY + 3; const L = [], R = [];
      for (let i = 0; i <= 12; i++) {
        const u = i / 12, a = lerp(PI * 0.7 + da - 0.4 * u, 0.3 + da + 0.4 * u, gust) + Math.sin(t * 3.4 + ph + u * 6) * (0.25 + 0.2 * gust) * u, w = lerp(w0, 2, u) / 2;
        if (i) { x += Math.cos(a) * len / 12; y += Math.sin(a) * len / 12; }
        L.push([x - Math.sin(a) * w, y + Math.cos(a) * w]); R.push([x + Math.sin(a) * w, y - Math.cos(a) * w]);
      }
      g.fillStyle = col; g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
    };
    ribbon(150, 5.5, 1.1, 0.42, '#4c8dae'); ribbon(124, 4.4, 2.3, 0.62, '#6aa6c4');
    g.fillStyle = '#4c8dae'; g.beginPath(); g.ellipse(tieX + 2, tieY + 4, 6, 3.6, -0.4, 0, TAU); g.fill();
    // 几缕散发拂过脸前，接着逆光发亮
    g.lineCap = 'round';
    if (!lite) for (let i = 0; i < 3; i++) {
      const sx = 22 - i * 5, sy = -50 + HD + i * 3, w1 = Math.sin(t * 2.7 + i * 1.9) * 4 * (1 + gust), w2 = Math.sin(t * 2.2 + i * 2.3) * 5 * (1 + gust);
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(38 + i * 2 + w1, -34 + HD + i * 4, 40 + i * 3 + w2, -14 + HD + i * 6);
      g.strokeStyle = '#0a0d12'; g.lineWidth = 1.3; g.stroke();
      g.strokeStyle = rgba(RIM, 0.5 - i * 0.12); g.lineWidth = 0.6; g.stroke();
    }
  }
  // 头的变换：人物层 1.3 → 1.0 假拉远（围着胸口缩）
  function headXf(lt, dur) {
    const z = lerp(1.3, 1.0, easeInOut(clamp(lt / dur))), k = 1.2 * z;
    return { k, x: 410, y: lerp(300, 318, easeInOut(clamp(lt / dur))), rot: -0.2 };
  }
  const bToW = (hx, p) => { const c = Math.cos(hx.rot), s = Math.sin(hx.rot); return [hx.x + (p[0] * c - p[1] * s) * hx.k, hx.y + (p[0] * s + p[1] * c) * hx.k]; };
  // 泪：“泪”字在眼角涌出，沿颊滑下，颊上留一道映着天光的湿痕；“涌”字从下巴坠落，一闪，落在衣领上溅开
  function tearDrop(g, lt, k, hx) {
    const t0 = k[1], tf = k[6];
    if (lt < t0) return;
    const path = (u) => [EYE[0] + 2 + 6 * u, EYE[1] + 2 + 38 * u];
    const slide = seg(lt, t0 + 0.4, tf), well = smooth((lt - t0) / 0.35), r = 3.5 * hx.k;
    const wetA = lt < tf ? 1 : 1 - seg(lt, tf + 0.6, tf + 2.2);
    if (slide > 0 && wetA > 0) {
      g.lineCap = 'round';
      const n = 12, s1 = lt < tf ? slide : 1;
      g.strokeStyle = `rgba(150,180,210,${0.4 * wetA})`; g.lineWidth = 2.6 * hx.k * 0.5;
      g.beginPath(); for (let j = 0; j <= n; j++) { const [x, y] = bToW(hx, path((s1 * j) / n)); j ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.strokeStyle = `rgba(232,244,255,${0.7 * wetA})`; g.lineWidth = 0.8;
      g.beginPath(); for (let j = 0; j <= n; j++) { const [x, y] = bToW(hx, path((s1 * j) / n)); j ? g.lineTo(x - 0.8, y) : g.moveTo(x - 0.8, y); } g.stroke();
    }
    if (lt < tf) {
      const [x, y] = bToW(hx, path(easeIn(slide)));
      g.fillStyle = 'rgba(210,232,252,0.92)'; g.beginPath(); g.ellipse(x, y, r * well * 0.85, r * well * (1 + 0.3 * slide), 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.35 * well, 0, TAU); g.fill();
      dot(g, x, y, 6 * hx.k, '#ffffff', 0.4 * well);
      return;
    }
    // 坠落到衣领（约 0.32 秒），落下时一闪
    const age = lt - tf, [x0, y0] = bToW(hx, path(1)), [xc, yc] = bToW(hx, [34, 132]);
    const fall = 0.32;
    if (age < fall) {
      const u = age / fall, x = lerp(x0, xc, u), y = y0 + (yc - y0) * u * u;
      g.fillStyle = 'rgba(214,236,255,0.95)'; g.beginPath(); g.ellipse(x, y, r * 0.8, r * (1 + Math.min(1.3, age * 6)), 0, 0, TAU); g.fill();
      dot(g, x, y, 26 * hx.k, '#ffffff', 0.9 * Math.exp(-age / 0.1));
      dot(g, x, y, 8 * hx.k, '#ffffff', 0.7);
    } else if (age < fall + 0.6) {
      // 溅开：几粒细珠往外弹，领上一小片湿
      const a = age - fall;
      g.fillStyle = `rgba(160,190,214,${0.5 * (1 - a / 0.6)})`; g.beginPath(); g.ellipse(xc, yc + 2, 9 * hx.k * Math.min(1, a * 8), 3 * hx.k, -0.2, 0, TAU); g.fill();
      g.fillStyle = `rgba(226,242,255,${0.9 * (1 - a / 0.6)})`;
      for (let i = 0; i < 6; i++) { const an = -PI * (0.15 + 0.7 * (i / 5)), v = 60 + 40 * h2(i, 3); g.beginPath(); g.arc(xc + Math.cos(an) * v * a, yc + Math.sin(an) * v * a + 160 * a * a, 1.3 + 0.8 * h2(i, 4), 0, TAU); g.fill(); }
      dot(g, xc, yc, 14 * hx.k, '#ffffff', 0.6 * (1 - a / 0.6));
    }
  }
  // 卷起的枫叶风暴：“都”字从左卷来，越卷越密，“红”字最满；之后四成叶子落下铺满一地，其余吹出画面
  const NSTORM = 62;
  function stormLeaf(i, lt, k) {
    const z = h2(i, 71), age = lt - k[11];
    const delay = 0.08 + 0.9 * Math.pow(h2(i, 72), 0.85), a = age - delay;
    if (a < 0) return null;
    const drop = h2(i, 81) < 0.42, tDrop = 0.55 + 0.6 * h2(i, 82);
    const sp = lerp(640, 1180, z) * (0.85 + 0.3 * h2(i, 74));
    const fly = drop ? Math.min(a, tDrop) : a, d = drop ? Math.max(0, a - tDrop) : 0;
    const y0 = 90 + h2(i, 75) * 560;
    const swirl = Math.sin(fly * 4.2 + h2(i, 76) * TAU) * (40 + 80 * z);
    let x = -140 + fly * sp, y = y0 - 140 * Math.sin(Math.min(1, fly / 1.2) * PI) * (0.4 + h2(i, 77)) + swirl;
    let rot = a * (2 + 3 * h2(i, 80)) + i, fx = Math.cos(a * 4 + i), landed = false, gone = 0;
    if (drop && d > 0) {
      // 落叶：离开风头，飘飘荡荡落到谷底（地面 565–715），落定不再动
      const yG = 565 + 150 * h2(i, 88), fallT = Math.max(0.4, (yG - y) / 120);
      const u = Math.min(1, d / fallT);
      x += d * 50 * (1 - 0.5 * u) + Math.sin(d * 2.2 + i) * 26 * (1 - u);
      y = lerp(y, yG, easeInOut(u));
      // 落定后慢慢融进地上那层红叶（铺地的贴图接手，省得〔第8句第5–7字〕画）
      if (u >= 1) { landed = true; rot = tDrop * 5 + i; fx = 0.45 + 0.5 * h2(i, 89); gone = seg(d - fallT, 0.3, 0.9); }
      else { rot = tDrop * (2 + 3 * h2(i, 80)) + i + d * 1.6; fx = Math.cos(d * 3 + i); }
    }
    const s = lerp(30, 128, Math.pow(z, 1.4)) * (0.75 + 0.5 * h2(i, 78)) * (landed ? 0.85 : 1);
    if (gone >= 1) return null;
    return { x, y, s, rot, fx, al: clamp(a / 0.12) * (1 - gone), near: z > 0.95, vi: Math.floor(h2(i, 79) * 60), landed };
  }
  function leafStorm(g, lt, k, layer) {
    if (lt < k[11] - 0.05) return;
    const U = V.util, PT = U.petalTex, m = U.Mx(g), ga = g.globalAlpha;
    for (let i = 0; i < NSTORM; i++) {
      const L = stormLeaf(i, lt, k);
      if (!L) continue;
      const front = L.near || h2(i, 71) > 0.8;
      if ((layer === 'front') !== front || L.x > W + 100 || L.x < -160 || L.y > H + 80) continue;
      const img = L.near ? U.soft('petal|maple' + (L.vi % 4), PT('maple', L.vi % 4, false), 2.6) : PT('maple', L.vi, false);
      const w = L.s * (64 / 52) * (L.near ? img.pk : 1);
      g.globalAlpha = ga * L.al;
      U.putR(g, m, img, L.x, L.y, w, w, L.rot, (L.fx < 0 ? -1 : 1) * Math.max(0.15, Math.abs(L.fx)));
    }
    // 前景：一阵贴着镜头扫过的大叶，正好把人影盖住（只最近的四片虚焦）
    if (layer === 'front') {
      for (let i = 0; i < 14; i++) {
        const a = lt - k[11] - 0.22 - h2(i, 83) * 0.75;
        if (a < 0 || a > 1.6) continue;
        const sp = 1400 + 800 * h2(i, 84), x = -220 + a * sp, y = 140 + h2(i, 85) * 540 + Math.sin(a * 6 + i) * 50 - a * 120;
        if (x > W + 200) continue;
        const vi = Math.floor(h2(i, 86) * 60), blur = i < 3, img = blur ? U.soft('petal|maple' + (vi % 4), PT('maple', vi % 4, false), 3.2) : PT('maple', vi, false);
        const w = (90 + 60 * h2(i, 87)) * (blur ? img.pk : 1);
        const fx = Math.cos(a * 5 + i);
        g.globalAlpha = ga * 0.95 * clamp(a / 0.08);
        U.putR(g, m, img, x, y, w, w, a * 3 + i, (fx < 0 ? -1 : 1) * Math.max(0.2, Math.abs(fx)));
      }
    }
    U.reset(g, m);
    g.globalAlpha = ga;
  }
  // 远处卷过的一大片叶群：预先画好的一长条，只平移（便宜），两层快慢不同，像漫天卷起来的红枫
  function swarmTex(i) {
    return K.cache('g07|swarm3' + i, 1700, 320, 1, (q) => {
      const r = A.rng(2421 + i), PT = V.util.petalTex, n = i ? 240 : 320;
      for (let k = 0; k < n; k++) {
        const x = r() * 1700, y = 160 + (r() + r() + r() - 1.5) * 110, s = i ? 32 + r() * 40 : 20 + r() * 30;
        q.save(); q.translate(x, y); q.rotate(r() * TAU); q.scale(r() < 0.5 ? -1 : 1, 0.4 + 0.6 * r());
        q.globalAlpha = i ? 0.95 : 0.85; q.drawImage(PT('maple', Math.floor(r() * 60), false), -s / 2, -s / 2, s, s); q.restore();
      }
    });
  }
  // 两层叶群：只整条平移，按整像素贴（快）；后一层在人前、快一些
  function swarm(g, lt, k, i) {
    const a = smooth(seg(lt, k[11] + (i ? 0.5 : 0.3), k[11] + (i ? 0.85 : 0.7))) * (1 - smooth(seg(lt, k[13] + 0.5, k[13] + 1.3)));
    if (a <= 0) return;
    const age = lt - k[11], x = Math.round(-1700 + (age - (i ? 0.3 : 0.08)) * (i ? 1400 : 1000)), y = Math.round((i ? 250 : 170) + Math.sin(age * 2.2 + i) * 16 - age * 18);
    if (x > W || x < -1700) return;
    g.globalAlpha = a; g.drawImage(swarmTex(i), x, y, 1700, 320); g.globalAlpha = 1;
  }
  // 侧影被〔第8句第5–7字〕枫叶形的缺口从左到右吃掉：每个缺口张开时，正好从那儿飞出一片叶子
  const HOLES = 36;
  const holeAt = (i, k) => {
    const x = 150 + h2(i, 91) * 560, y = 150 + h2(i, 92) * 580;
    return { x, y, t: k[11] + (x + 220) / 1300 + (h2(i, 93) - 0.3) * 0.3, r: 50 + 44 * h2(i, 94), rot: h2(i, 95) * TAU, vi: Math.floor(h2(i, 96) * 60) };
  };
  function drawBust(g, c, lt, k, hx, gust) {
    const tw = k[11] + (420 + 220) / 1300, erase = smooth(seg(lt, tw + 0.22, tw + 0.36));
    const draw = (q, lite) => { q.save(); q.translate(hx.x, hx.y); q.rotate(hx.rot); q.scale(hx.k, hx.k); bust(q, c.t, 0.35 + 0.2 * Math.sin(c.t * 0.7), gust, lite); q.restore(); };
    if (lt < k[11] + 0.15) { draw(g); return; }
    if (erase < 1) {
      const m = g.getTransform(), D = devBox(g, [110, 90, 740, 730]);
      const RB = 0.5, B = scratch('g07bust', D.w * RB, D.h * RB);
      B.q.setTransform(m.a * RB, m.b * RB, m.c * RB, m.d * RB, (m.e - D.X0) * RB, (m.f - D.Y0) * RB);
      draw(B.q, true);
      // 缺口遮罩：三分之一分辨率画好，再一次性从剪影里抠掉
      const PT = V.util.petalTex, R3 = 3, M = scratch('g07bustm', D.w / R3, D.h / R3), bw = Math.ceil(D.w * RB), bh = Math.ceil(D.h * RB);
      M.q.setTransform(m.a / R3, m.b / R3, m.c / R3, m.d / R3, (m.e - D.X0) / R3, (m.f - D.Y0) / R3);
      for (let i = 0; i < HOLES; i++) {
        const h = holeAt(i, k), u = easeOut(seg(lt, h.t, h.t + 0.35));
        if (u <= 0) continue;
        const w = h.r * u * 2.2;
        M.q.save(); M.q.translate(h.x, h.y); M.q.rotate(h.rot + u); M.q.drawImage(PT('maple', h.vi, false), -w / 2, -w / 2, w, w); M.q.restore();
      }
      if (erase > 0) { M.q.globalAlpha = erase; M.q.fillStyle = '#000'; M.q.fillRect(-100, -100, W + 200, H + 200); M.q.globalAlpha = 1; }
      B.q.setTransform(1, 0, 0, 1, 0, 0);
      B.q.globalCompositeOperation = 'destination-out';
      B.q.drawImage(M.cv, 0, 0, Math.ceil(D.w / R3), Math.ceil(D.h / R3), 0, 0, bw, bh);
      B.q.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(B.cv, 0, 0, bw, bh, D.X0, D.Y0, D.w, D.h); g.restore();
    }
    // 从缺口里飞出去的叶子：每个缺口一片，起点正是缺口处
    const U = V.util, PT = U.petalTex, m2 = U.Mx(g), ga = g.globalAlpha;
    for (let i = 0; i < HOLES; i++) {
      const h = holeAt(i, k), a = lt - h.t;
      if (a < 0 || a > 2) continue;
      const x = h.x + a * (520 + 300 * h2(i, 97)) + Math.sin(a * 5 + i) * 26, y = h.y - a * (150 + 120 * h2(i, 98)) + a * a * 70;
      if (x > W + 60) continue;
      const s = h.r * 0.55 * (0.8 + 0.4 * h2(i, 99)), fx = Math.cos(a * 5 + i);
      g.globalAlpha = ga * clamp(a / 0.06) * (1 - seg(a, 1.3, 2));
      U.putR(g, m2, PT('maple', h.vi, false), x, y, s, s, h.rot + a * 4, (fx < 0 ? -1 : 1) * Math.max(0.15, Math.abs(fx)));
    }
    U.reset(g, m2); g.globalAlpha = ga;
  }

  XYT.registerShot('c1_maplestorm', {
    name: '枫天初雪', zone: 'top', night: true,
    text: '#e9f1f6', shadow: 'rgba(16,24,40,0.9)', accent: '#ff8a6a', bloom: 0.4,
    draw(g, c) {
      const lt = c.lt, t = c.t, k = chars(c, T24);
      if (lt > 3.5) carpetTex();
      if (lt > 4.2) valleyMid(true);
      if (lt > 4.5) swarmTex(0);
      if (lt > 2.5) valleyFar();
      if (lt > 4.8) swarmTex(1);
      const redU = smooth(seg(lt, k[13] - 0.1, k[13] + 1.0));          // “红”：谷里的枫林亮起来
      // 远景随假拉远缩得慢一些（视差）
      g.save();
      // 远景与中景合成一张（同一层缩放）
      g.drawImage(K.cache('g07|vback2', W + 120, H + 80, 1, (q) => { q.drawImage(valleyFar(), 0, 0, W + 120, H + 80); q.drawImage(valleyMid(false), 0, 340, W + 120, 420); }), -60, -40, W + 120, H + 80);
      // 远天几缕薄云慢慢飘
      const wp = wispTex();
      for (const [x0, y, sp, a] of [[80, 170, 7, 0.8], [620, 120, 5, 0.6], [980, 220, 9, 0.7]]) { g.globalAlpha = a; g.drawImage(wp, ((x0 + t * sp) % (W + 420)) - 420, y, 420, 110); }
      g.globalAlpha = 1;
      if (redU > 0) { g.globalAlpha = redU; g.drawImage(valleyMid(true), -60, 300, W + 120, 420); g.globalAlpha = 1; }
      // 远处一群归鸟
      for (let i = 0; i < 5; i++) A.bird(g, 860 + i * 26 + lt * 18, 230 + (i % 2) * 12 + Math.sin(t + i) * 3, 0.9, t * 7 + i, 'rgba(30,40,60,0.6)');
      E.mist(g, { t, y: 600, h: 120, color: '#a8bccb', alpha: 0.35, speed: 10, seed: 6 });
      g.restore();
      const zn = lerp(1.15, 1.0, easeInOut(clamp(lt / c.dur)));
      // 近处的老枫（逆光），随风摇；大风时摇得更狠
      const gust = smooth(seg(lt, k[11] - 0.05, k[11] + 0.35)) * (1 - smooth(seg(lt, k[11] + 1.6, k[11] + 3)));
      g.save(); g.translate(1280, 0); g.scale(zn, zn); g.rotate(0.012 * Math.sin(t * 1.1) + 0.04 * gust * Math.sin(t * 6)); g.translate(-1280, 0);
      g.drawImage(nearMaple(), 760, -20, 520, 560);
      g.restore();
      // 谷底慢慢铺满的红叶
      if (redU > 0) { g.globalAlpha = 0.9 * redU; g.drawImage(carpetTex(), -40, 540, W + 80, 200); g.globalAlpha = 1; }
      // 背景里一直零落的枫叶（远层）
      // （风暴最密的那一阵里，零落的枫叶不必再画）
      const pa = 1 - smooth(seg(lt, k[11] + 0.3, k[11] + 0.6)) * (1 - smooth(seg(lt, k[13] + 0.6, k[13] + 1.2)));
      if (pa > 0.02) V.petals(g, c, { kind: 'maple', n: 26, layer: 'back', wind: 30 + 400 * gust, fall: 40, seed: 24, alpha: 0.9 * pa });
      // 初雪：“白”字起落，“纷飞”变密；风暴来时被卷走；“红”字后再落的雪〔第8句第5–7字〕变红
      const swept = 1 - smooth(seg(lt, k[11] + 0.1, k[11] + 0.7));
      const snowA = smooth(seg(lt, k[7] - 0.1, k[8])) * swept;
      const snowB = smooth(seg(lt, k[9] - 0.1, k[10] + 0.2)) * swept;
      const snowR = smooth(seg(lt, k[13], k[13] + 0.4)), redS = 0.8 * smooth(seg(lt, k[13], k[13] + 0.8));
      if (snowA > 0) V.snow(g, c, { n: 90, layer: 'back', alpha: 0.9 * snowA, fall: 46, wind: -10, size: [1.2, 8], seed: 31 });
      // 少年的侧影
      const hx = headXf(lt, c.dur);
      swarm(g, lt, k, 0);
      leafStorm(g, lt, k, 'back');
      drawBust(g, c, lt, k, hx, gust);
      swarm(g, lt, k, 1);
      tearDrop(g, lt, k, hx);
      if (snowB > 0) V.snow(g, c, { n: 140, layer: 'front', alpha: 0.95 * snowB, fall: 60, wind: -14, size: [1.5, 12], seed: 33 });
      if (snowR > 0) V.snow(g, c, { n: 56, alpha: 0.9 * snowR, fall: 52, wind: 10, size: [1.5, 11], seed: 35, red: redS, redKind: 'petal' });
      if (pa > 0.02) V.petals(g, c, { kind: 'maple', n: 12, layer: 'front', wind: 30 + 500 * gust, fall: 50, seed: 25, alpha: 0.85 * pa });
      leafStorm(g, lt, k, 'front');
      // 长音：叶落尽，空谷里的暮色更冷一些
      const after = smooth(seg(lt, k[13] + 0.6, c.dur));
      if (after > 0) { g.save(); g.globalAlpha = 0.16 * after; g.fillStyle = '#1a2a44'; g.fillRect(-20, -20, W + 40, H + 40); g.restore(); }
    },
  });
})();

