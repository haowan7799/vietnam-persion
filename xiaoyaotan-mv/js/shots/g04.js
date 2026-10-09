/* 分镜镜头 第 04 组：主歌B1 前四句——推舟离岛、擂台撕绸、茶中蛊影、岔路红线 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot || !XYT.env || !XYT.fig || !XYT.vfx || !XYT.kit) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 小工具 ----------
  // 静态图层：放进工具包的有界贴图库
  const cache = (key, w, h, sc, fn) => E.util.cached('g04:' + key, [], w, h, sc, fn);
  // 本句第 k 字相对镜头起点的时间；没有歌词时用分镜里的默认值
  const ct = (c, k, d) => { const v = c.charT ? c.charT(k) : null; return v == null ? d : v - (c.t - c.lt); };
  const up = (lt, t0, d) => smooth((lt - t0) / d);
  const glow = (g, x, y, r, col, a) => { if (a > 0.003 && r > 0.5) A.glow(g, x, y, r, col, Math.min(1, a)); };
  const blend = (g, op, fn) => { const o = g.globalCompositeOperation; g.globalCompositeOperation = op; fn(); g.globalCompositeOperation = o; };
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  // 从镜头内 lt0 秒以后，每过一拍台阶式加 1（拍头快、拍尾缓）
  function beatSteps(c, lt0, d = 0.3) {
    if (!c.grid || !c.b) return Math.max(0, Math.floor((c.lt - lt0) / 0.833));
    const t0 = c.t - c.lt + lt0;
    let n = 0;
    for (let k = 0; k < 10; k++) {
      const tb = c.grid.time(c.b.i - k);
      if (tb <= t0) break;
      n += easeOut((c.t - tb) / d);
    }
    return n;
  }
  // 当前拍之后经过的秒数（没有节拍网格时按 72 BPM）
  const sinceBeat = (c) => (c.b ? Math.max(0, c.b.since) : (c.t % 0.833));
  // 二次贝塞尔取点
  const qb = (p0, p1, p2, u) => { const v = 1 - u; return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]]; };
  // 飘带：从 (x, y) 顺着 ang 方向飘出，波浪由近到远变大；正反面两色
  function streamer(g, x, y, ang, len, w, t, col, o = {}) {
    const n = 18, amp = o.amp ?? 0.35, fr = o.freq ?? 2.2, sp = o.speed ?? 7, ph = o.phase || 0;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, d = u * len;
      const wv = Math.sin(u * fr * PI * 2 - t * sp + ph) * amp * len * 0.22 * u + (o.droop || 0) * u * u * len;
      const px = x + ca * d - sa * wv, py = y + sa * d + ca * wv;
      const tw = Math.cos(u * fr * PI * 2 - t * sp * 0.8 + ph * 1.3);
      const hw = w * (1 - u * 0.75) * (0.35 + 0.65 * Math.abs(tw)) * 0.5;
      L.push([px - sa * hw, py + ca * hw]); R.push([px + sa * hw, py - ca * hw]);
    }
    g.beginPath(); g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
    g.fillStyle = col; g.fill();
    if (o.light) { g.strokeStyle = o.light; g.lineWidth = 0.8; g.beginPath(); for (let i = 0; i <= n; i++) i ? g.lineTo(L[i][0], L[i][1]) : g.moveTo(L[i][0], L[i][1]); g.stroke(); }
  }
  // 便宜的轮廓光（工具包的 rim 要走离屏缓冲，大人物很贵）：先朝光的方向错开几像素画一个暖色剪影，再把人物盖上去，露出的一线就是轮廓光
  function figWarmRim(g, who, x, y, s, t, o, dx, dy, col) {
    F.draw(g, who, x + dx, y + dy, s, t, Object.assign({}, o, { rim: null, tone: 'silhouette', ink: col, accent: col, wind: o.wind }));
    F.draw(g, who, x, y, s, t, Object.assign({}, o, { rim: null }));
  }
  // 大图分带贴：柔和的天空、云、雾那几带用最近邻采样（软件渲染里快三四倍，软边看不出差别），有细线的带照常插值
  function blitBands(g, img, dx, dy, dw, dh, bands) {
    const kx = img.width / dw, ky = img.height / dh, sm = g.imageSmoothingEnabled;
    for (const [y0, y1, near] of bands) {
      g.imageSmoothingEnabled = !near;
      g.drawImage(img, 0, y0 * ky, img.width, (y1 - y0) * ky, dx, dy + y0, dw, y1 - y0);
    }
    g.imageSmoothingEnabled = sm;
  }
  // 镜头内推拉：以 (cx, cy) 为中心缩放，记得 g.restore()
  function zoomAt(g, z, cx, cy) { g.save(); g.translate(cx, cy); g.scale(z, z); g.translate(-cx, -cy); }
  // 两个时刻之间的节拍：返回 [lt0, lt1) 之间的拍点（镜头内时间）
  function beatsIn(c, lt0, lt1) {
    const out = [];
    if (!c.grid || !c.b) return out;
    const base = c.t - c.lt;
    for (let k = -6; k < 12; k++) { const tb = c.grid.time(c.b.i - k) - base; if (tb >= lt0 && tb < lt1) out.push(tb); }
    return out.sort((a, b) => a - b);
  }
  // ======================================================================
  // 9 第9句 · 推舟离岛：仙灵岛晨雾海滩，灵儿涉水把小船推离，转身迎向岛上的火光；船上的少年回头伸手，雾墙随拍合拢在两人之间
  // ======================================================================
  const B1 = { hz: 384, sun: [905, 128], fire: [196, 230] };
  const B1S = { p0: [-60, 548], p1: [230, 592], p2: [540, 770] };
  const shoreAt = (u) => qb(B1S.p0, B1S.p1, B1S.p2, u);
  // 山形：几个控制点之间余弦过渡，再加一点噪声起伏
  function ridgePath(q, pts, seed, y1, amp = 7) {
    q.beginPath(); q.moveTo(pts[0][0], y1);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      for (let k = 0; k < 12; k++) {
        const u = k / 12, x = lerp(ax, bx, u), yy = lerp(ay, by, (1 - Math.cos(u * PI)) / 2);
        q.lineTo(x, yy - amp * (noise1(x * 0.045, seed) - 0.5) - amp * 0.4 * (noise1(x * 0.17, seed + 1) - 0.5));
      }
    }
    const L = pts[pts.length - 1]; q.lineTo(L[0], L[1]); q.lineTo(L[0], y1); q.closePath();
  }
  const ISL = [[-60, 268], [30, 238], [120, 222], [210, 236], [290, 252], [390, 290], [500, 330], [640, B1.hz + 4]];
  const ridgeY1 = (x) => (x < 120 ? 238 - (x + 60) * 0.09 : 222 + (x - 120) * 0.27);
  // 天、日、远山、仙岛、岛后的火光（静态部分）、海、倒影、沙岸、光束：整张静态
  function vb1Back() {
    return cache('vb1back5', W + 80, H + 60, 1, (q) => {
      q.translate(40, 30);
      const hz = B1.hz, [sx, sy] = B1.sun, [fx, fy] = B1.fire;
      q.fillStyle = K.lin(q, 0, -30, 0, hz + 10, [[0, '#86a2c2'], [0.35, '#b9cfe0'], [0.75, '#dcebef'], [1, '#eef7f6']]);
      q.fillRect(-40, -30, W + 80, hz + 40);
      // 一缕淡紫的晨霭
      A.softBlob(q, 300, 120, 420, 0.26, '#c4b8e6');
      A.softBlob(q, 1020, 300, 360, 0.16, '#d0c4ec');
      // 雾里的日
      A.softBlob(q, sx, sy, 300, 0.5, '#fffaf0');
      A.softBlob(q, sx, sy, 90, 0.8, '#fffdf6');
      q.fillStyle = 'rgba(255,252,240,0.95)'; q.beginPath(); q.arc(sx, sy, 20, 0, TAU); q.fill();
      // 云带
      E.clouds(q, { t: 0, y: 70, color: '#f4f8fa', shade: '#a9b9cc', alpha: 0.55, scale: 1.1, n: 4, seed: 12, speed: 0, lightX: sx });
      // 右侧海天交界的远岛
      q.fillStyle = 'rgba(132,150,184,0.35)'; ridgePath(q, [[660, hz + 2], [760, hz - 30], [860, hz - 16], [980, hz - 40], [1120, hz - 8], [1200, hz + 2]], 7, hz + 3, 5); q.fill();
      q.fillStyle = 'rgba(150,168,196,0.28)'; ridgePath(q, [[1000, hz + 2], [1100, hz - 22], [1220, hz - 14], [1340, hz + 2]], 9, hz + 3, 4); q.fill();
      // 仙岛远峰：淡紫青
      ridgePath(q, [[-80, 300], [40, 176], [150, 104], [230, 140], [320, 196], [460, 300], [600, hz]], 3, hz + 10, 9);
      q.fillStyle = K.lin(q, 0, 100, 0, hz, [[0, 'rgba(110,128,168,0.75)'], [0.6, 'rgba(160,178,204,0.5)'], [1, 'rgba(220,232,238,0)']]); q.fill();
      // 岛后的火光：天被映成橘红（画在近岛之前，山脊挡住下半）
      q.globalCompositeOperation = 'screen';
      A.softBlob(q, fx, fy + 6, 300, 0.42, '#ff8936');
      A.softBlob(q, fx, fy, 120, 0.55, '#ffa060');
      q.globalCompositeOperation = 'source-over';
      // 峰腰的雾（靠火的一段染上暖色）
      for (let i = 0; i < 6; i++) A.softBlob(q, -20 + i * 110, 236 + (i % 2) * 10, 120, 0.4, i === 2 || i === 1 ? '#f6e2d4' : '#eef5f6');
      // 近岛：青绿坡、石青山脊
      ridgePath(q, ISL, 11, hz + 10, 8);
      q.fillStyle = K.lin(q, 0, 220, 0, hz, [[0, '#3a6a6a'], [0.35, '#5a8c82'], [1, 'rgba(170,200,198,0.6)']]); q.fill();
      q.save(); ridgePath(q, ISL, 11, hz + 10, 8); q.clip();
      // 受光的石绿皴擦
      const r = A.rng(91);
      for (let i = 0; i < 60; i++) {
        const x = -40 + r() * 640, y = 230 + r() * 120;
        q.fillStyle = rgba(r() < 0.5 ? '#86b0a0' : '#2f5458', 0.18 + r() * 0.2);
        q.beginPath(); q.ellipse(x, y, 10 + r() * 30, 3 + r() * 5, -0.2, 0, TAU); q.fill();
      }
      // 山脊被火映亮的一道暖边
      A.softBlob(q, fx, fy + 14, 110, 0.35, '#e88a50');
      // 桃林：一簇簇淡粉点染，花簇里有深浅
      for (let i = 0; i < 46; i++) {
        const cx = -40 + r() * 600, cy = ridgeY1(cx) + 10 + Math.pow(r(), 1.3) * 80, R = 14 + r() * 18;
        const fade = 1 - clamp((cy - 250) / 150) * 0.55;
        A.softBlob(q, cx, cy, R * 1.6, 0.35 * fade, '#f4c8d6');
        for (let k = 0; k < 9; k++) {
          const a = r() * TAU, d = r() * R;
          q.fillStyle = rgba(['#f8d4de', '#f0a8bd', '#fde8ee', '#e58aa7'][k % 4], (0.3 + r() * 0.35) * fade);
          q.beginPath(); q.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 2 + r() * 4, 1.5 + r() * 3, r() * PI, 0, TAU); q.fill();
        }
      }
      q.restore();
      // 山脊上的树：几笔点叶；火边的几棵是逆光剪影
      for (let i = 0; i < 34; i++) {
        const x = -30 + i * 17 + r() * 10, yTop = ridgeY1(x), far = clamp((x - 200) / 360), hh = (5 + r() * 10) * (1 - 0.5 * far), pink = r() < 0.4;
        const back = Math.abs(x - fx) < 70;
        q.strokeStyle = back ? 'rgba(40,28,30,0.8)' : 'rgba(40,58,62,0.45)'; q.lineWidth = 0.9; q.beginPath(); q.moveTo(x, yTop + 3); q.lineTo(x, yTop - hh * 0.6); q.stroke();
        for (let k = 0; k < 10; k++) {
          q.fillStyle = back ? rgba('#2e2226', 0.55 + r() * 0.3) : rgba(pink ? '#e6a0b6' : '#36575a', (0.3 + r() * 0.35) * (1 - 0.45 * far));
          q.beginPath(); q.ellipse(x + (r() - 0.5) * 16, yTop - hh + (r() - 0.2) * 12, 2.5 + r() * 4, 2 + r() * 2.5, r() * PI, 0, TAU); q.fill();
        }
      }
      // 火边的屋檐剪影（仙灵岛的竹屋）
      q.fillStyle = 'rgba(44,30,30,0.85)';
      for (const [hx, hy, hw] of [[164, 226, 26], [222, 236, 20]]) {
        q.beginPath(); q.moveTo(hx - hw * 0.75, hy); q.quadraticCurveTo(hx - hw * 0.3, hy - 4, hx, hy - hw * 0.45); q.quadraticCurveTo(hx + hw * 0.3, hy - 4, hx + hw * 0.75, hy); q.closePath(); q.fill();
        q.fillRect(hx - hw * 0.45, hy - 1, hw * 0.9, 6);
      }
      // 水月宫一角：雾里一道翘起的檐线
      q.strokeStyle = 'rgba(70,88,104,0.42)'; q.lineWidth = 2.2; q.lineCap = 'round';
      q.beginPath(); q.moveTo(292, 254); q.quadraticCurveTo(300, 258, 314, 256); q.lineTo(350, 256); q.quadraticCurveTo(364, 258, 372, 252); q.stroke();
      q.lineWidth = 1.6; q.beginPath(); q.moveTo(304, 242); q.quadraticCurveTo(312, 246, 322, 244); q.lineTo(344, 244); q.quadraticCurveTo(354, 246, 360, 240); q.stroke();
      q.fillStyle = 'rgba(232,240,242,0.35)'; q.fillRect(312, 257, 40, 8); q.fillRect(318, 245, 28, 9);
      A.softBlob(q, 332, 262, 60, 0.45, '#eef5f6');
      // 火光把周围的雾和山脊都染暖
      q.globalCompositeOperation = 'screen';
      A.softBlob(q, fx, fy - 10, 240, 0.32, '#ff9a50');
      A.softBlob(q, fx + 10, fy - 40, 110, 0.3, '#ffb070');
      q.globalCompositeOperation = 'source-over';
      // 山脚的雾带
      q.fillStyle = K.lin(q, 0, 300, 0, hz + 6, [[0, 'rgba(236,246,248,0)'], [0.7, 'rgba(236,246,248,0.55)'], [1, 'rgba(240,248,249,0.95)']]);
      q.fillRect(-40, 300, W + 80, hz - 300 + 8);
      // 火下的那段雾被染成橘粉
      q.globalCompositeOperation = 'multiply'; A.softBlob(q, fx + 20, 318, 170, 0.32, '#ffb48a'); q.globalCompositeOperation = 'source-over';
      // 海：远白近青
      q.fillStyle = K.lin(q, 0, hz, 0, H + 30, [[0, '#e8f4f4'], [0.22, '#bcd6da'], [0.55, '#82aab4'], [1, '#56808f']]);
      q.fillRect(-40, hz, W + 80, H + 30 - hz);
      // 仙岛的倒影
      q.save(); q.globalAlpha = 0.3; q.translate(0, hz * 2 + 4); q.scale(1, -1);
      ridgePath(q, ISL, 11, hz + 10, 8); q.fillStyle = K.lin(q, 0, 220, 0, hz, [[0, 'rgba(40,80,84,0.9)'], [1, 'rgba(90,130,130,0.2)']]); q.fill();
      q.restore();
      // 火光的倒影：一道竖的暖光
      q.globalCompositeOperation = 'screen';
      q.save(); q.translate(fx, hz * 2 - fy - 10); q.scale(0.35, 1.6); A.softBlob(q, 0, 0, 90, 0.35, '#ff9a50'); q.restore();
      q.globalCompositeOperation = 'source-over';
      // 日光照水的一片亮与碎光
      A.softBlob(q, sx - 20, hz + 60, 300, 0.32, '#ffffff');
      for (let i = 0; i < 70; i++) {
        const u = r(), y = hz + 8 + u * u * 300, w = (6 + r() * 30) * (0.5 + u * 1.5), x = sx - 30 + (r() - 0.5) * (40 + u * 260);
        q.fillStyle = rgba('#ffffff', 0.25 + r() * 0.35); q.fillRect(x, y, w, 1 + u * 1.5);
      }
      // 水天交界的雾
      q.fillStyle = K.lin(q, 0, hz - 26, 0, hz + 40, [[0, 'rgba(242,249,250,0)'], [0.45, 'rgba(242,249,250,0.9)'], [1, 'rgba(242,249,250,0)']]);
      q.fillRect(-40, hz - 26, W + 80, 66);
      // 光束
      q.globalCompositeOperation = 'screen'; q.globalAlpha = 0.6; q.drawImage(vb1Rays(), 0, 0, W, H);
      q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
      // 沙岸
      const N = 40;
      q.beginPath(); q.moveTo(-60, H + 40);
      for (let i = 0; i <= N; i++) { const [x, y] = shoreAt(i / N); q.lineTo(x, y); }
      q.lineTo(-60, H + 40); q.closePath();
      q.fillStyle = K.lin(q, 0, 540, 0, H, [[0, '#ece6d8'], [0.5, '#ded5c2'], [1, '#c9bea6']]); q.fill();
      q.save(); q.clip();
      q.lineJoin = 'round';
      for (const [w, col] of [[70, 'rgba(140,158,162,0.35)'], [34, 'rgba(170,192,198,0.6)'], [10, 'rgba(236,246,248,0.7)']]) {
        q.lineWidth = w; q.strokeStyle = col; q.beginPath();
        for (let i = 0; i <= N; i++) { const [x, y] = shoreAt(i / N); i ? q.lineTo(x - 3, y - 2) : q.moveTo(x - 3, y - 2); }
        q.stroke();
      }
      for (let k = 0; k < 500; k++) { q.fillStyle = r() < 0.5 ? 'rgba(255,250,240,0.2)' : 'rgba(90,84,70,0.12)'; q.fillRect(r() * 560 - 40, 540 + r() * 200, 1 + r() * 2, 1); }
      q.strokeStyle = 'rgba(120,130,130,0.22)'; q.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        const [x, y] = shoreAt(0.12 + k * 0.12);
        q.beginPath(); q.moveTo(x - 140, y - 28 - k * 3); q.quadraticCurveTo(x - 60, y - 6, x - 10, y - 8); q.stroke();
      }
      // 沙上一串她走来的脚印
      for (let k = 0; k < 7; k++) { const [x, y] = shoreAt(0.3 + k * 0.07); q.fillStyle = 'rgba(120,112,96,0.28)'; q.beginPath(); q.ellipse(x - 30 + (k % 2) * 8, y + 22 + k * 2, 5, 2.2, -0.3, 0, TAU); q.fill(); }
      q.restore();
      // 左下的礁石与草
      q.fillStyle = '#34403f'; A.inkBlob(q, 40, 700, 74, 3, 0.35); q.fill();
      q.fillStyle = K.lin(q, 0, 630, 0, 700, [[0, 'rgba(170,190,190,0.55)'], [1, 'rgba(50,60,60,0)']]); A.inkBlob(q, 30, 690, 58, 3, 0.35); q.fill();
      q.fillStyle = '#46524f'; A.inkBlob(q, 140, 716, 32, 9, 0.3); q.fill();
      q.strokeStyle = 'rgba(46,60,52,0.85)';
      for (let j = 0; j < 26; j++) {
        const bx = r() * 190, by = 650 + r() * 40, l = 30 + r() * 70, a = -PI / 2 + (r() - 0.3) * 0.9;
        q.lineWidth = 1 + r() * 1.4; q.beginPath(); q.moveTo(bx, by); q.quadraticCurveTo(bx + Math.cos(a) * l * 0.5 + 8, by + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l + 14, by + Math.sin(a) * l); q.stroke();
      }
    });
  }
  function vb1Rays() {
    return cache('vb1rays', W, H, 0.3, (q) => {
      V.godRays(q, { t: 2, lt: 0 }, { x: B1.sun[0], y: B1.sun[1], angle: 1.95, spread: 0.85, n: 7, len: 900, start: 0.08, color: '#ffffff', alpha: 0.4, res: 0.3, beat: 0, night: false, blend: 'lighter' });
    });
  }
  // 岛上的烟柱：底部被火映橘，越往上越淡越宽，向右飘（静态，贴的时候轻摆）
  function vb1Smoke() {
    return cache('vb1smoke', 340, 240, 0.5, (q) => {
      const P = (u) => [40 + u * u * 230 + Math.sin(u * 5) * 10, 225 - u * 200];
      for (let i = 0; i < 70; i++) {
        const u = Math.pow(i / 69, 0.9), [x, y] = P(u), R = 16 + u * 58;
        const col = u < 0.25 ? mix('#d0703a', '#5a5060', u / 0.25) : mix('#5a5060', '#9a96a6', (u - 0.25) / 0.75);
        A.softBlob(q, x + (h2(i, 1) - 0.5) * R * 0.6, y + (h2(i, 2) - 0.5) * 10, R, (0.26 - u * 0.15) * (0.7 + 0.3 * h2(i, 3)), col);
      }
    });
  }
  // 雾墙：贴着海面立起的一堵雾，左缘一绺绺散开、顶上翻卷，里面有冷蓝的体积阴影（静态，按拍往左推）
  function vb1FogWall(seed) {
    return cache('vb1fogB' + seed, 1100, 520, 0.3, (q) => {
      const r = A.rng(seed);
      // 主体：从左往右渐浓，从上往下渐浓，四周都留够软边
      const gx = q.createLinearGradient(40, 0, 420, 0);
      gx.addColorStop(0, 'rgba(236,244,246,0)'); gx.addColorStop(1, 'rgba(236,244,246,0.95)');
      q.save(); q.beginPath(); q.rect(0, 0, 1100, 520); q.clip();
      q.fillStyle = gx; q.fillRect(0, 190, 1100, 330);
      const gy = q.createLinearGradient(0, 140, 0, 230);
      gy.addColorStop(0, 'rgba(236,244,246,0)'); gy.addColorStop(1, 'rgba(236,244,246,0.95)');
      q.globalCompositeOperation = 'destination-in'; q.fillStyle = gy; q.fillRect(0, 140, 1100, 380);
      q.globalCompositeOperation = 'source-over';
      q.restore();
      // 顶上翻卷的雾头
      for (let i = 0; i < 46; i++) {
        const x = 200 + Math.pow(r(), 0.7) * 760, R = 50 + r() * 90, y = 160 + r() * 50 + clamp((360 - x) / 200) * 60;
        A.softBlob(q, x, Math.max(R, y), R, 0.35 + 0.35 * r(), '#f0f6f7');
      }
      // 左缘散开的雾绺
      for (let i = 0; i < 26; i++) { const R = 30 + r() * 60, y = 240 + r() * 250; A.softBlob(q, R + 30 + r() * 220, Math.min(520 - R, y), R, 0.25 + 0.3 * r(), '#eef5f6'); }
      // 体积：雾里冷蓝的阴影与亮面
      for (let i = 0; i < 14; i++) { const R = 90 + r() * 90; A.softBlob(q, 300 + r() * 600, 280 + r() * 120, R, 0.16, '#9fb6c4'); }
      for (let i = 0; i < 10; i++) { const R = 60 + r() * 60; A.softBlob(q, 260 + r() * 640, 200 + r() * 60, R, 0.3, '#ffffff'); }
    });
  }
  // 右下前景：失焦的芦苇与礁石（压住画面一角，拉开景深）
  function vb1Reeds() {
    return cache('vb1reeds', 320, 260, 0.5, (q) => {
      const r = A.rng(23);
      q.fillStyle = '#26302f'; A.inkBlob(q, 210, 250, 90, 5, 0.3); q.fill();
      q.strokeStyle = 'rgba(30,40,38,0.9)'; q.lineCap = 'round';
      for (let j = 0; j < 30; j++) {
        const bx = 60 + r() * 260, l = 120 + r() * 120, a = -PI / 2 - 0.25 + (r() - 0.5) * 0.5;
        q.lineWidth = 2 + r() * 3; q.beginPath(); q.moveTo(bx, 262); q.quadraticCurveTo(bx + Math.cos(a) * l * 0.5, 262 + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, 262 + Math.sin(a) * l); q.stroke();
      }
      for (let j = 0; j < 8; j++) {
        const bx = 80 + r() * 220, by = 70 + r() * 60;
        q.fillStyle = 'rgba(70,74,70,0.7)'; q.beginPath(); q.ellipse(bx, by, 5, 22, -0.3, 0, TAU); q.fill();
      }
    });
  }
  // 小船：船头朝右；part 'back' 画内舷，'front' 画外侧船身（压住人物腿）
  function skiff(g, x, y, s, part) {
    g.save(); g.translate(x, y); g.scale(s, s);
    if (part === 'back') {
      g.fillStyle = '#3a3029';
      g.beginPath(); g.moveTo(-100, -34); g.quadraticCurveTo(0, -22, 110, -36); g.lineTo(100, -26); g.quadraticCurveTo(0, -14, -92, -24); g.closePath(); g.fill();
    } else {
      g.fillStyle = K.lin(g, 0, -40, 0, 4, [[0, '#7a6450'], [0.45, '#4e3f33'], [1, '#2a221d']]);
      g.beginPath();
      g.moveTo(-116, -50); g.quadraticCurveTo(-102, -20, -72, -10); g.quadraticCurveTo(0, 6, 82, -8); g.quadraticCurveTo(112, -18, 128, -54);
      g.quadraticCurveTo(112, -30, 86, -26); g.quadraticCurveTo(0, -14, -78, -26); g.quadraticCurveTo(-100, -30, -116, -50);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(246,238,220,0.6)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(-112, -48); g.quadraticCurveTo(-96, -28, -78, -26); g.quadraticCurveTo(0, -14, 86, -26); g.quadraticCurveTo(110, -30, 126, -52); g.stroke();
      g.strokeStyle = 'rgba(30,24,20,0.5)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(-80, -17); g.quadraticCurveTo(0, -3, 92, -16); g.stroke();
      g.strokeStyle = '#3c3a2c'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(46, -22); g.lineTo(-20, -170); g.stroke();
    }
    g.restore();
  }
  // 灵儿：涉水推船的位置与各段姿势
  const LG1 = { x0: 430, y: 690, s: 1.08, wl: 662 };
  const LG1push = { pose: 'stand', facing: 1, lean: 0.55 };

  XYT.registerShot('vb1_farewell', {
    name: '推舟离岛', zone: 'right', night: false,
    text: '#1a2026', shadow: 'rgba(240,248,250,0.85)', accent: '#8a78b8', bloom: 0.3,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = B1.hz, [fx, fy] = B1.fire;
      const tPush = ct(c, 0, 0.28), tLook = ct(c, 1, 0.62), tTurnHim = ct(c, 2, 1.02), tJin = ct(c, 4, 1.74), tTou = ct(c, 5, 2.28);
      const nb = beatSteps(c, tPush + 0.05), nbMax = 3;
      // 长焦拉远：先近后远，越拉越慢
      zoomAt(g, lerp(1.18, 1.0, easeOut(clamp(lt / c.dur))), 560, 600);
      g.drawImage(vb1Back(), -40, -30, W + 80, H + 60);
      // ---- 岛上火光：几团跳动的暖光 + 烟柱 + 火星；“尽”字火势一涨 ----
      const flare = 1 + 0.5 * (lt > tJin ? Math.exp(-(lt - tJin) / 0.4) : 0);
      const fl = (0.8 + 0.2 * noise1(t * 6, 3) + 0.25 * c.be(0.25)) * flare;
      const sm = vb1Smoke(), sk = 0.06 * Math.sin(t * 0.7) + 0.03 * noise1(t * 0.5, 9);
      g.save(); g.translate(fx - 40, fy - 5); g.transform(1, 0, -sk, 1, 0, 0); g.globalAlpha = 0.9; g.drawImage(sm, 0, -225, 340, 240); g.restore();
      // 烟里往上翻滚的几团
      for (let i = 0; i < 4; i++) {
        const u = (t * 0.11 + i / 4) % 1, px = fx + u * u * 230 + Math.sin(u * 5 + i) * 12, py = fy - u * 195;
        glow(g, px, py, 18 + u * 46, '#6a6270', 0.22 * Math.sin(u * PI));
      }
      blend(g, 'screen', () => {
        glow(g, fx, fy - 14, 80 * (0.9 + 0.2 * flare), '#ff8a40', 0.3 * fl);
        for (let i = 0; i < 4; i++) {
          const n = noise1(t * (5 + i) + i * 3.1, 13 + i), x = fx - 42 + i * 28 + (noise1(t * 2 + i, 21) - 0.5) * 8;
          glow(g, x, fy + 2 - 6 * n, (16 + 20 * n) * (0.85 + 0.2 * flare), i % 2 ? '#ff6a24' : '#ff9a3a', (0.3 + 0.3 * n) * fl);
        }
      });
      blend(g, 'lighter', () => {
        // 火心两点
        for (let i = 0; i < 2; i++) glow(g, fx - 18 + i * 34, fy + 3, 7 + 4 * noise1(t * 7 + i, 31), '#ffc070', 0.45 * fl);
        // 火星往上飘
        for (let i = 0; i < 9; i++) {
          const u = ((t * (0.35 + 0.2 * h2(i, 2)) + h2(i, 3)) % 1), px = fx - 40 + h2(i, 4) * 90 + u * 70 + Math.sin(t * 3 + i) * 6, py = fy + 4 - u * 130;
          glow(g, px, py, 2.5 + 2.5 * (1 - u), '#ffa050', 0.7 * (1 - u) * Math.min(1, flare));
        }
      });
      // 火光映在水面：倒影处几道橘色碎光
      blend(g, 'screen', () => {
        for (let i = 0; i < 6; i++) {
          const yy = hz * 2 - fy - 50 + i * 16, w = 16 + i * 6, x = fx + Math.sin(t * 2 + i * 1.7) * (3 + i);
          g.fillStyle = rgba('#ff9a50', (0.36 - i * 0.04) * fl * (0.6 + 0.4 * noise1(t * 3 + i, 4)));
          g.fillRect(x - w / 2, yy, w, 2);
        }
      });
      // 水面细浪
      for (let i = 0; i < 22; i++) {
        const u = Math.pow(h2(i, 41), 1.3), yy = hz + 8 + u * 320, len = (20 + h2(i, 42) * 70) * (0.4 + u * 1.6);
        const x = ((h2(i, 43) * 1500 + t * (6 + 14 * u)) % 1500) - 150;
        g.fillStyle = rgba('#ffffff', (0.12 + 0.16 * h2(i, 44)) * (0.6 + 0.4 * Math.sin(t * 1.3 + i)));
        g.fillRect(x, yy, len, 1 + u * 1.5);
      }
      // ---- 小船：先被她双手扶着，“爱”字一推冲出去，之后每拍漂远一段 ----
      const wind = { wind: 0.5, windDir: 1, seed: 5 };
      const hand0 = F.points('linger', LG1.x0, LG1.y, LG1.s, 0, Object.assign({}, wind, LG1push)).handN;
      const bx0 = hand0[0] + 100, by0 = hand0[1] + 40;
      const since = lt - tPush, pushed = since > 0;
      const push = pushed ? easeOut(since / 1.1) : 0;
      const bx = bx0 + 150 * push + 46 * nb + 6 * Math.max(0, since) - (pushed ? 0 : 3 * smooth(lt / Math.max(0.05, tPush)));
      const dist = bx - bx0;
      const bs = 1 - 0.0011 * dist;
      const by = by0 - 0.12 * dist + Math.sin(t * 1.6) * 1.2 * bs;
      // 推的一下：船尾被顶得一颠
      const kick = pushed && since < 0.5 ? Math.exp(-since / 0.09) : 0;
      const brot = 0.015 * Math.sin(t * 1.3) - 0.05 * kick;
      // 尾迹：船尾后面一个张开的 V 字，越远越宽越淡，再点几笔碎沫
      if (pushed) {
        const sx = bx - 112 * bs, sy = by - 6 * bs, L = Math.min(150, 40 + dist * 0.9) * bs, fade = clamp(since / 0.15) * (1 - 0.35 * clamp(nb / nbMax));
        g.lineCap = 'round';
        for (const sg of [-1, 1]) {
          const ex = sx - L, ey = sy + sg * L * 0.12 + 4 * bs;
          const gr = g.createLinearGradient(sx, 0, ex, 0);
          gr.addColorStop(0, rgba('#ffffff', 0.75 * fade)); gr.addColorStop(1, rgba('#ffffff', 0));
          g.strokeStyle = gr; g.lineWidth = 1.8 * bs;
          g.beginPath(); g.moveTo(sx, sy);
          for (let i = 1; i <= 8; i++) { const u = i / 8; g.lineTo(lerp(sx, ex, u), lerp(sy, ey, u) + Math.sin(u * 8 - t * 4 + sg) * 1.6 * u); }
          g.stroke();
        }
        for (let i = 0; i < 9; i++) {
          const u = (h2(i, 81) + t * 0.25) % 1, x = sx - u * L, y = sy + (h2(i, 82) - 0.5) * u * L * 0.22 + 3;
          g.fillStyle = rgba('#ffffff', 0.6 * fade * (1 - u)); g.fillRect(x, y, 6 + 10 * u, 1.3);
        }
      }
      E.ripples(g, { x: hand0[0] + 20, y: LG1.wl + 2, t, t0: [V.at(c, tPush)], scale: 1.5, color: '#ffffff', life: 2.4 });
      // 少年：背对岸站着，“已”字回头，“走”字转身伸手，越伸越远
      let xp;
      if (lt < tLook) xp = { pose: 'stand', facing: 1, lean: kick ? -0.16 * kick : 0 };
      else if (lt < tTurnHim) xp = { pose: 'lookBack', facing: 1 };
      else xp = { pose: 'reach', facing: -1, lean: 0.05 + 0.28 * up(lt, tTurnHim, 1.6) };
      g.save();
      g.translate(bx, by); g.rotate(brot); g.translate(-bx, -by);
      skiff(g, bx, by, bs, 'back');
      F.draw(g, 'xiaoyao', bx - 6 * bs, by - 18 * bs, 0.92 * bs, t, Object.assign({ wind: 0.65, windDir: 1, seed: 3 }, xp));
      skiff(g, bx, by, bs, 'front');
      g.restore();
      g.fillStyle = rgba('#3c4a50', 0.16);
      g.beginPath(); g.ellipse(bx, by + 4 * bs, 120 * bs, 6 * bs, 0, 0, TAU); g.fill();
      // ---- 雾墙：每拍往左推一段，吞掉小船，横在两人之间 ----
      const fc = clamp(nb / nbMax), eL = lerp(1180, 590, fc) + Math.sin(t * 0.4) * 12;
      g.globalAlpha = 0.25 + 0.5 * fc;
      g.drawImage(vb1FogWall(31), eL - 200, 226, 1100, 520);
      // 第二层只贴左边那段雾缘（右边早已被第一层盖满）
      const fw2 = vb1FogWall(57), k2 = fw2.width / 1100;
      g.globalAlpha = 0.18 + 0.3 * fc;
      g.drawImage(fw2, 0, 0, 560 * k2, fw2.height, eL - 330 + Math.sin(t * 0.3 + 1) * 20, 250 + Math.sin(t * 0.5) * 6, 560, 520);
      g.globalAlpha = 1;
      // 浪花：沿水线涌上又退下
      const sg = 0.5 + 0.5 * Math.sin(t * 1.25);
      g.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = rgba('#ffffff', (0.6 - k * 0.16) * (0.6 + 0.4 * sg)); g.lineWidth = 2 - k * 0.5;
        g.beginPath();
        for (let i = 0; i <= 36; i++) {
          const u = i / 36, [x, y] = shoreAt(u), off = 5 + k * 10 + sg * 8;
          if (h2(i + k * 40, 3) < 0.15) g.moveTo(x + off * 0.55, y + off * 0.75);
          else i ? g.lineTo(x + off * 0.55, y + off * 0.75 + Math.sin(u * 30 + t * 2) * 1.2) : g.moveTo(x + off * 0.55, y + off * 0.75);
        }
        g.stroke();
      }
      // ---- 灵儿：弯腰扶船，“爱”字一推、手送出去；“尽”字先回头、再转身望火；“头”字往岸上走 ----
      const tTurn = tJin + 0.12;
      let lp, lx = LG1.x0;
      if (lt < tPush) lp = Object.assign({}, LG1push);
      else if (since < 0.08) { lp = { pose: 'stand', facing: 1, lean: 0.72 }; lx += 6 * (since / 0.08); }
      else if (since < 0.62) { lp = { pose: 'reach', facing: 1, lean: lerp(0.42, 0.12, up(since, 0.08, 0.5)) }; lx += 6 * (1 - up(since, 0.08, 0.3)); }
      else if (lt < tJin) lp = { pose: 'stand', facing: 1, head: 0.16 };
      else if (lt < tTurn) lp = { pose: 'lookBack', facing: 1 };
      else if (lt < tTou) lp = { pose: 'stand', facing: -1, head: -0.12 };
      else lp = { pose: 'walk', facing: -1 };
      if (lt > tTou) lx -= F.walkSpeed('linger', LG1.s, {}) * (lt - tTou);
      const warm = lt > tJin;
      const gust = up(lt, tJin, 0.15) * (1 - 0.4 * up(lt, tTou + 0.3, 0.6));
      const lo = Object.assign({}, wind, { wind: 0.5 + 0.5 * gust, rim: warm ? '#ff9a50' : '#ffffff', light: warm ? [fx, fy] : B1.sun, rimAlpha: 0.9, rimWidth: warm ? 2.5 : 1.6 }, lp);
      const wl = LG1.wl, ly = LG1.y, LS = LG1.s;
      // 倒影：以她身边的水面为镜，只画水面以下
      g.save(); g.beginPath(); g.rect(lx - 160, wl, 320, 140); g.clip();
      g.globalAlpha = 0.3; g.translate(0, wl * 2); g.scale(1, -1);
      F.draw(g, 'linger', lx, ly, LS, t, Object.assign({}, lo, { rim: null }));
      g.restore();
      // 淡紫发带：转身时被风扬起，盖住转身那一下
      const hp = F.points('linger', lx, ly, LS, t, lo);
      const rAng = lerp(0.5, -0.65, gust) + 0.12 * Math.sin(t * 2.4);
      streamer(g, hp.head[0] - 3 * lo.facing, hp.head[1] - 6, rAng, 60 + 90 * gust, 6.5, t, 'rgba(184,166,230,0.92)', { amp: 0.5, light: 'rgba(255,255,255,0.7)', speed: 8 });
      streamer(g, hp.head[0] - 3 * lo.facing, hp.head[1] - 4, rAng + 0.25, 44 + 60 * gust, 4, t + 0.4, 'rgba(176,164,227,0.8)', { amp: 0.6, speed: 9, phase: 1.3 });
      // 她涉在水里：身子只画到水面
      g.save(); g.beginPath(); g.rect(lx - 200, 0, 400, wl + 3); g.clip();
      F.draw(g, 'linger', lx, ly, LS, t, lo);
      g.restore();
      // 转身以后，火光照着她朝火的一侧
      if (warm) blend(g, 'screen', () => glow(g, hp.chest[0] - 18, hp.chest[1] - 10, 90, '#ff9a50', 0.25 * up(lt, tJin, 0.25) * fl / flare));
      // 水面一线：水色、脚边一圈圈白沫
      g.fillStyle = rgba('#e8f4f6', 0.7); g.fillRect(lx - 34, wl + 1, 68, 1.4);
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.6 + k * 0.5) % 1;
        g.strokeStyle = rgba('#ffffff', 0.65 * (1 - ph)); g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(lx + 6, wl + 2, 30 + ph * 44, 4 + ph * 5, 0, 0, TAU); g.stroke();
      }
      // “尽”字转身：一阵风从她袖上卷起桃瓣，飘向远去的船
      if (lt > tJin - 0.05) {
        const tt = lt - tJin;
        for (let i = 0; i < 18; i++) {
          const ox = (h2(i, 64) - 0.5) * 40, oy = (h2(i, 65) - 0.5) * 60, d = tt * (100 + 130 * h2(i, 61)), a = -0.7 + 1.0 * h2(i, 62);
          const px = hp.chest[0] + ox + Math.cos(a) * d + Math.sin(tt * 3 + i) * 10, py = hp.chest[1] + 10 + oy + Math.sin(a) * d * 0.6 + 30 * tt * tt;
          const al = clamp(tt / 0.1) * (1 - clamp((tt - 1.0) / 0.6));
          if (al <= 0) continue;
          g.save(); g.translate(px, py); g.rotate(tt * 4 + i); g.scale(Math.cos(tt * 6 + i * 2), 1);
          g.fillStyle = rgba(i % 3 ? '#f6c2d0' : '#eaa0b8', 0.85 * al);
          g.beginPath(); g.ellipse(0, 0, 4 + 3 * h2(i, 63), 2.6, 0, 0, TAU); g.fill();
          g.restore();
        }
      }
      // 桃瓣：从岛上吹向海，随拍一阵阵
      V.petals(g, c, { kind: 'peach', n: 22, size: [5, 13], wind: 50, fall: 16, gust: 30, seed: 41, night: false });
      // 前景：右下失焦的芦苇、近雾
      const rd = vb1Reeds(), sw = 0.03 * Math.sin(t * 1.1) + 0.02 * c.be(0.3);
      g.save(); g.translate(1150, 730); g.transform(1, 0, sw, 1, 0, 0); g.globalAlpha = 0.85; g.drawImage(rd, -140, -200, 260, 210); g.restore();
      E.mist(g, { t, y: 712, h: 110, color: '#eef6f7', alpha: 0.32, speed: 14, seed: 6 });
      g.restore();
    },
  });

  // ======================================================================
  // 10 第10句 · 擂台撕绸：苏州林家堡擂台，正午，低机位仰拍；月如一鞭卷住剑穗把少年拽得原地打转，台下哄笑；她松手，亲手扯下“比武招亲”红绸任风吹走
  // ======================================================================
  const B2 = { floor: 560, lip: 568, pillL: 150, pillR: 1132, gong: [640, 352], gr: 50, S: 1.62, knot: [182, 112], Ls: 220, M: 200 };
  // 远景：正午的天、积云、塔影、垂柳、台后露出的几团树梢（低机位，地平线压在台面以下）
  function vb2BackDraw(q) {
    q.translate(B2.M, 0);
    const X0 = -B2.M, WW = W + 2 * B2.M;
    q.fillStyle = K.lin(q, 0, 0, 0, 580, [[0, '#3a7fbd'], [0.45, '#86bcdc'], [0.82, '#d8ecee'], [1, '#f1f8f0']]);
    q.fillRect(X0, 0, WW, 600);
    E.sun(q, { x: 150, y: 64, r: 30, color: '#fffbe8', glow: 0.8, spread: 6 });
    E.clouds(q, { t: 0, y: 160, color: '#ffffff', shade: '#8fb0c8', alpha: 0.9, scale: 1.15, n: 4, seed: 31, speed: 0, lightX: 150, style: 'cumulus' });
    E.clouds(q, { t: 0, y: 380, color: '#ffffff', shade: '#b0c8d4', alpha: 0.55, scale: 0.75, n: 5, seed: 17, speed: 0, lightX: 150 });
    // 地平线上的薄霭
    q.fillStyle = K.lin(q, 0, 470, 0, 560, [[0, 'rgba(240,248,242,0)'], [1, 'rgba(240,248,242,0.85)']]); q.fillRect(X0, 470, WW, 130);
    // 远处北寺塔：七层，飞檐上翘，罩在薄雾里
    const px = 1010, pb = 556;
    for (let k = 0; k < 7; k++) {
      const w = 46 - k * 4.5, y0 = pb - 26 - k * 34, hz = 0.16 + k * 0.05;
      q.fillStyle = mix('#5e7484', '#cfe0e6', hz); q.fillRect(px - w / 2, y0 - 24, w, 26);
      q.fillStyle = mix('#3f505c', '#c8d8e0', hz);
      q.beginPath(); q.moveTo(px - w / 2 - 16, y0 - 22); q.quadraticCurveTo(px - w / 2 - 4, y0 - 26, px - w / 2, y0 - 30); q.lineTo(px + w / 2, y0 - 30); q.quadraticCurveTo(px + w / 2 + 4, y0 - 26, px + w / 2 + 16, y0 - 22); q.lineTo(px + w / 2 + 2, y0 - 34); q.lineTo(px - w / 2 - 2, y0 - 34); q.closePath(); q.fill();
      q.fillStyle = 'rgba(255,248,226,0.35)'; q.fillRect(px - w / 2, y0 - 22, 3, 20);
    }
    q.fillStyle = '#6a7c88'; q.fillRect(px - 1.5, pb - 290, 3, 48);
    for (let k = 0; k < 4; k++) { q.beginPath(); q.arc(px, pb - 276 + k * 7, 4 - k * 0.6, 0, TAU); q.fill(); }
    // 台后探出来的几团树梢
    for (const [x, y, r, col] of [[330, 548, 54, '#5f8a5a'], [430, 552, 40, '#6f9a64'], [800, 548, 48, '#5a8458'], [880, 552, 34, '#7aa268'], [1240, 540, 64, '#58805a'], [-120, 540, 70, '#56805a']]) {
      for (let k = 0; k < 7; k++) { q.fillStyle = rgba(k % 2 ? col : mix(col, '#eaf4c8', 0.35), 0.85); A.inkBlob(q, x + (k - 3) * r * 0.25, y - r * 0.25 - Math.abs(k - 3) * -3, r * 0.42, k + x, 0.3); q.fill(); }
    }
    // 垂柳（左后）
    E.willow(q, { x: 40, y: 560, s: 1.15, t: 0, wind: 0.4, color: '#8aaa4e', seed: 5 });
    // 正午的光：从左上斜照下来
    q.globalCompositeOperation = 'screen'; q.globalAlpha = 0.7; q.drawImage(vb2Rays(), 0, 0, W, H); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
  }
  // 远景与台合成一整张（台随镜头一起平移，视差差别只有几像素，合并后省一次大图）
  function vb2Static() {
    return cache('vb2static', W + 2 * B2.M, H + 20, 1, (q) => {
      q.save(); vb2BackDraw(q); q.restore();
      q.save(); q.translate(B2.M, 0); vb2Posts(q); q.restore();
      q.drawImage(vb2Floor(), 0, 540, W + 2 * B2.M, 190);
      q.drawImage(vb2Top(), 0, -12, W + 2 * B2.M, 96);
    });
  }
  // 甩镜用：同一张横向拖糊（低清即可）
  function vb2StaticBlur() {
    return cache('vb2staticblur', W + 2 * B2.M, H + 20, 0.35, (q) => {
      const src = vb2Static();
      for (let k = 0; k < 9; k++) { q.globalAlpha = k ? 1 / (k + 1) : 1; q.drawImage(src, (k - 4) * 22, 0, W + 2 * B2.M, H + 20); }
      q.globalAlpha = 1;
    });
  }
  function vb2Rays() {
    return cache('vb2rays', W, H, 0.3, (q) => {
      V.godRays(q, { t: 1, lt: 0 }, { x: 110, y: 30, angle: 0.8, spread: 0.7, n: 6, len: 1100, start: 0.05, color: '#fff6d8', alpha: 0.35, res: 0.3, beat: 0, night: false, blend: 'lighter' });
    });
  }
  // 顶梁与青金米三色彩幔（一条横带）
  function vb2Top() {
    return cache('vb2top', W + 2 * B2.M, 96, 1, (q) => {
      q.translate(B2.M, 12);
      const X0 = -B2.M, WW = W + 2 * B2.M, gold = '#eacd76', teal = '#5e8a84', cream = '#f3ecd6', wood = '#493131';
      q.fillStyle = K.lin(q, 0, -12, 0, 34, [[0, '#2e1e1c'], [1, wood]]); q.fillRect(X0, -12, WW, 46);
      q.fillStyle = gold; q.fillRect(X0, 30, WW, 3);
      const sw = (x0, x1, y0, dep, col) => {
        q.fillStyle = col; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo((x0 + x1) / 2, y0 + dep * 2, x1, y0); q.lineTo(x1, y0 - 4); q.quadraticCurveTo((x0 + x1) / 2, y0 + dep * 1.2, x0, y0 - 4); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(255,255,255,0.25)'; q.lineWidth = 1; q.beginPath(); q.moveTo(x0, y0 - 2); q.quadraticCurveTo((x0 + x1) / 2, y0 + dep * 1.6, x1, y0 - 2); q.stroke();
      };
      for (let k = -3; k < 13; k++) {
        const x0 = 20 + k * 130;
        sw(x0, x0 + 130, 34, 24, k % 2 ? teal : '#7aa39a');
        sw(x0 + 10, x0 + 120, 34, 13, k % 2 ? gold : cream);
        q.fillStyle = gold; q.beginPath(); q.arc(x0, 38, 4, 0, TAU); q.fill();
        q.strokeStyle = '#c9a858'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(x0, 40); q.lineTo(x0, 70); q.stroke();
        q.fillStyle = '#c84a30'; q.fillRect(x0 - 2, 66, 4, 8);
      }
    });
  }
  // 台面（仰拍只露一窄条，木缝往远处收）、台沿、台裙（一条横带）
  function vb2Floor() {
    return cache('vb2floor', W + 2 * B2.M, 190, 1, (q) => {
      const y0 = 540;
      q.translate(B2.M, -y0);
      const X0 = -B2.M, WW = W + 2 * B2.M, fl = B2.floor, lip = B2.lip, gold = '#eacd76', cream = '#f3ecd6';
      // 台面：受光的木板，越远越亮
      q.fillStyle = K.lin(q, 0, fl - 16, 0, lip, [[0, '#c8a47a'], [1, '#8a6a4e']]); q.fillRect(X0, fl - 16, WW, lip - fl + 16);
      q.strokeStyle = 'rgba(70,46,30,0.45)'; q.lineWidth = 1;
      for (let k = -14; k <= 14; k++) { const xb = 640 + k * 70; q.beginPath(); q.moveTo(xb, lip); q.lineTo(640 + (xb - 640) * 0.8, fl - 16); q.stroke(); }
      q.strokeStyle = 'rgba(255,240,210,0.35)'; for (const yy of [fl - 10, fl - 3]) { q.beginPath(); q.moveTo(X0, yy); q.lineTo(X0 + WW, yy); q.stroke(); }
      // 台沿
      q.fillStyle = K.lin(q, 0, lip, 0, lip + 16, [[0, '#7a5a44'], [1, '#3a2622']]); q.fillRect(X0, lip, WW, 16);
      q.fillStyle = gold; q.fillRect(X0, lip, WW, 2);
      // 台裙：青色锦缎、金色云纹、米色垂幔
      const sk = lip + 16;
      q.fillStyle = K.lin(q, 0, sk, 0, 730, [[0, '#4a6f6a'], [1, '#2a4240']]); q.fillRect(X0, sk, WW, 730 - sk);
      q.strokeStyle = rgba(gold, 0.55); q.lineWidth = 1.3;
      for (let k = -2; k < 15; k++) {
        const cx = -20 + k * 110, cy = sk + 74;
        q.beginPath(); q.arc(cx, cy, 11, PI * 0.2, PI * 1.6); q.arc(cx + 12, cy - 3, 7, PI * 1.2, PI * 2.4); q.moveTo(cx - 22, cy + 11); q.quadraticCurveTo(cx, cy + 3, cx + 24, cy + 11); q.stroke();
      }
      q.fillStyle = gold; q.fillRect(X0, sk, WW, 4);
      for (let k = -3; k < 18; k++) {
        const x0 = -60 + k * 90;
        q.fillStyle = k % 2 ? cream : '#e6d7a8';
        q.beginPath(); q.moveTo(x0, sk + 4); q.quadraticCurveTo(x0 + 45, sk + 48, x0 + 90, sk + 4); q.closePath(); q.fill();
        q.strokeStyle = gold; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x0, sk + 4); q.quadraticCurveTo(x0 + 45, sk + 48, x0 + 90, sk + 4); q.stroke();
        q.fillStyle = gold; q.beginPath(); q.arc(x0, sk + 8, 3, 0, TAU); q.fill();
      }
    });
  }
  // 柱子与锣架：直接用矩形画（便宜）
  const pillarFill = (g) => K.lin(g, -15, 0, 15, 0, [[0, '#6a4840'], [0.35, '#4a302c'], [1, '#2a1a18']]);
  function vb2Posts(g) {
    const fl = B2.floor, [gx, gy] = B2.gong, gold = '#eacd76';
    // 锣架
    g.fillStyle = '#4a302a';
    g.fillRect(gx - 74, gy - 74, 9, fl - gy + 74); g.fillRect(gx + 65, gy - 74, 9, fl - gy + 74);
    g.fillRect(gx - 86, gy - 82, 172, 10);
    g.fillStyle = gold; g.fillRect(gx - 86, gy - 82, 172, 2);
    g.fillStyle = 'rgba(255,236,200,0.3)'; g.fillRect(gx - 74, gy - 72, 2, fl - gy + 72);
    g.strokeStyle = '#2a1c18'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(gx - 30, gy - 72); g.lineTo(gx - 12, gy - B2.gr + 4); g.moveTo(gx + 30, gy - 72); g.lineTo(gx + 12, gy - B2.gr + 4); g.stroke();
    // 两根柱
    for (const px of [B2.pillL, B2.pillR]) {
      g.save(); g.translate(px, 0); g.fillStyle = pillarFill(g); g.fillRect(-15, -20, 30, fl + 10); g.restore();
      g.fillStyle = gold; g.fillRect(px - 16, 104, 32, 5); g.fillRect(px - 16, 430, 32, 5);
      g.fillStyle = 'rgba(255,240,200,0.24)'; g.fillRect(px - 11, -20, 3, fl + 10);
      g.fillStyle = '#8a8478'; g.fillRect(px - 22, fl - 12, 44, 12);
    }
  }
  // 台下看热闹的人（背影）：六种样子——斗笠举拳、团扇、骑在肩上的孩子、举杯、方巾书生、拍手；前排设色浓，后排淡在雾里
  const CROWD2 = ['#2f4a86', '#a8762c', '#3f7a5c', '#5a4a7a', '#2f6a74', '#6a4a30'];
  function crowdSprite(kind, back) {
    return cache('vb2crowd' + kind + (back ? 'b' : 'f'), 150, 240, 0.8, (q) => {
      q.translate(75, 240);
      const hz = back ? '#b4c4c6' : null, mk = (col, k) => (hz ? mix(col, hz, k) : col);
      const ink = mk('#1e1c22', 0.5), cloth = mk(CROWD2[kind], 0.5), skin = mk('#d8b48c', 0.5), rim = 'rgba(255,244,214,' + (back ? 0.35 : 0.7) + ')';
      // 身子与肩
      q.fillStyle = cloth;
      q.beginPath(); q.moveTo(-58, 0); q.quadraticCurveTo(-56, -76, -20, -88); q.lineTo(20, -88); q.quadraticCurveTo(56, -76, 58, 0); q.closePath(); q.fill();
      q.fillStyle = 'rgba(0,0,0,0.16)'; q.beginPath(); q.moveTo(-6, -86); q.lineTo(6, -86); q.lineTo(0, -40); q.closePath(); q.fill();
      const arm = (sx, x1, y1, col) => { const ex = 50 * sx, ey = -112; q.lineCap = 'round'; q.lineJoin = 'round'; q.strokeStyle = cloth; q.lineWidth = 14; q.beginPath(); q.moveTo(34 * sx, -80); q.lineTo(ex, ey); q.stroke(); q.lineWidth = 11; q.beginPath(); q.moveTo(ex, ey); q.lineTo(x1, y1); q.stroke(); q.fillStyle = col || skin; q.beginPath(); q.arc(x1, y1 - 4, 7, 0, TAU); q.fill(); };
      if (kind === 0) arm(1, 44, -170);
      if (kind === 3) { arm(-1, -46, -160); q.fillStyle = mk('#e8e0c8', 0.3); q.fillRect(-54, -184, 16, 14); q.fillStyle = mk('#c8a860', 0.3); q.fillRect(-54, -184, 16, 3); }
      // 脖子与后脑
      q.fillStyle = ink; q.fillRect(-9, -104, 18, 18);
      q.beginPath(); q.ellipse(0, -120, 16, 18, 0, 0, TAU); q.fill();
      if (kind === 0) { q.fillStyle = mk('#c8a868', 0.4); q.beginPath(); q.moveTo(-40, -122); q.lineTo(0, -154); q.lineTo(40, -122); q.quadraticCurveTo(0, -128, -40, -122); q.fill(); }
      if (kind === 1) {
        q.fillStyle = ink; q.beginPath(); q.ellipse(0, -140, 10, 8, 0, 0, TAU); q.fill();
        q.strokeStyle = mk('#e0c070', 0.3); q.lineWidth = 2; q.beginPath(); q.moveTo(-14, -146); q.lineTo(14, -134); q.stroke();
        // 团扇
        q.strokeStyle = mk('#6a4a2a', 0.3); q.lineWidth = 2; q.beginPath(); q.moveTo(40, -96); q.lineTo(46, -128); q.stroke();
        q.fillStyle = mk('#e2d2ac', 0.25); q.beginPath(); q.arc(48, -146, 17, 0, TAU); q.fill();
        q.fillStyle = mk('#88a87a', 0.25); q.beginPath(); q.arc(44, -150, 7, 0, TAU); q.fill();
      }
      if (kind === 2) {
        // 骑在肩上的孩子
        q.fillStyle = mk('#4a8a9a', 0.45); q.beginPath(); q.moveTo(-22, -130); q.quadraticCurveTo(-20, -168, 0, -172); q.quadraticCurveTo(20, -168, 22, -130); q.closePath(); q.fill();
        q.lineCap = 'round'; q.strokeStyle = mk('#4a8a9a', 0.45); q.lineWidth = 8;
        q.beginPath(); q.moveTo(-14, -162); q.lineTo(-34, -196); q.moveTo(14, -162); q.lineTo(32, -198); q.stroke();
        q.fillStyle = skin; q.beginPath(); q.arc(-35, -200, 5, 0, TAU); q.arc(33, -202, 5, 0, TAU); q.fill();
        q.fillStyle = ink; q.beginPath(); q.ellipse(0, -184, 11, 12, 0, 0, TAU); q.fill();
        q.beginPath(); q.ellipse(-8, -196, 4.5, 4.5, 0, 0, TAU); q.ellipse(8, -196, 4.5, 4.5, 0, 0, TAU); q.fill();
      }
      if (kind === 3) { q.fillStyle = ink; q.beginPath(); q.ellipse(0, -140, 8, 7, 0, 0, TAU); q.fill(); }
      if (kind === 4) { q.fillStyle = mk('#2a2a34', 0.4); q.fillRect(-15, -146, 30, 14); q.fillRect(-4, -152, 8, 8); }
      if (kind === 5) { q.fillStyle = ink; q.beginPath(); q.ellipse(2, -142, 7, 6, 0.3, 0, TAU); q.fill(); q.fillStyle = mk('#c8a060', 0.3); q.fillRect(6, -148, 2, 12); }
      // 正午的光从左上打在头肩上
      q.strokeStyle = rim; q.lineWidth = 2.4;
      q.beginPath(); q.arc(0, -120, 16, PI * 1.05, PI * 1.6); q.stroke();
      q.beginPath(); q.moveTo(-56, -30); q.quadraticCurveTo(-55, -76, -20, -88); q.stroke();
    });
  }
  // 两排人：后排小而淡（有骑肩的孩子），前排大而浓（只露头肩）
  const CROWD_ROWS = [
    { n: 13, sc: 0.82, y0: 706, gap: 106, x0: 10, back: true, kinds: [0, 2, 4, 1, 3, 5, 2, 0, 4, 1, 5, 3, 2] },
    { n: 9, sc: 1.3, y0: 800, gap: 158, x0: -30, back: false, kinds: [4, 5, 0, 4, 3, 5, 1, 4, 5] },
  ];
  const CROWD_TOP = [-178, -168, -210, -188, -154, -152];
  const crowdPeople = (row) => { const R = CROWD_ROWS[row], out = []; for (let i = 0; i < R.n; i++) { const k = i + row * 20; out.push({ x: R.x0 + i * R.gap + 36 * h2(k, 3), y: R.y0 + 14 * h2(k, 4), kind: R.kinds[i], ss: R.sc * (0.9 + 0.2 * h2(k, 10)), lean: (h2(k, 6) - 0.5) * 0.24 }); } return out; };
  function crowdSeg(row, sg) {
    const R = CROWD_ROWS[row], SW = (W + 200) / 4, xa = -100 + sg * SW;
    const ps = crowdPeople(row).filter((p) => p.x >= xa && p.x < xa + SW);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9;
    for (const p of ps) { x0 = Math.min(x0, p.x - 80 * p.ss); x1 = Math.max(x1, p.x + 80 * p.ss); y0 = Math.min(y0, p.y + CROWD_TOP[p.kind] * p.ss - 6); }
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    const w = Math.ceil(x1 - x0), h = Math.min(H + 30, R.y0 + 24) - y0;
    const cv = cache('vb2seg' + row + '_' + sg, w, h, 1, (q) => {
      for (const p of ps) { q.save(); q.translate(p.x - x0, p.y - y0); q.rotate(p.lean); q.drawImage(crowdSprite(p.kind, R.back), -75 * p.ss, -240 * p.ss, 150 * p.ss, 240 * p.ss); q.restore(); }
    });
    cv.x0 = x0; cv.y0 = y0;
    return cv;
  }
  // 红绸“比武招亲”：中线 N 个点，按扭转画正反两面，正面写字
  function silkStrip(g, pts, width, twistFn, fontOk) {
    const n = pts.length;
    const L = [], R = [], tw = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const k = twistFn(i / (n - 1)), hw = width * 0.5 * Math.max(0.08, Math.abs(k));
      L.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); R.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]); tw.push(k);
    }
    for (let i = 0; i < n - 1; i++) {
      const k = (tw[i] + tw[i + 1]) / 2, front = k >= 0, lit = Math.abs(k);
      g.fillStyle = front ? mix('#a8261a', '#e8583a', lit * 0.8) : mix('#6a1610', '#b8342a', lit * 0.6);
      g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(L[i + 1][0], L[i + 1][1]); g.lineTo(R[i + 1][0], R[i + 1][1]); g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = 0.8; g.stroke();
    }
    // 金边
    g.strokeStyle = 'rgba(234,205,118,0.85)'; g.lineWidth = 1.4;
    for (const S of [L, R]) { g.beginPath(); S.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    // 字
    if (fontOk) {
      const chs = ['比', '武', '招', '亲'];
      const sz = Math.round(width * 0.72);
      chs.forEach((ch, j) => {
        const u = 0.2 + j * 0.2, fi = u * (n - 1), i0 = Math.floor(fi), i1 = Math.min(n - 1, i0 + 1), f = fi - i0;
        const k = lerp(tw[i0], tw[i1], f);
        if (k < 0.15) return;
        const px = lerp(pts[i0][0], pts[i1][0], f), py = lerp(pts[i0][1], pts[i1][1], f);
        const a = Math.atan2(pts[i1][1] - pts[i0][1], pts[i1][0] - pts[i0][0]) - PI / 2;
        g.save(); g.translate(px, py); g.rotate(a); g.scale(k, 1); g.drawImage(silkGlyph(ch, sz), -sz * 0.6, -sz * 0.6, sz * 1.2, sz * 1.2); g.restore();
      });
    }
  }
  let fontReady = false;
  const fontOK = () => { if (fontReady) return true; try { fontReady = !!(document.fonts && document.fonts.check('32px "Ma Shan Zheng"', '比武招亲')); } catch (e) { fontReady = true; } return fontReady; };
  // 鞭子：从手到梢的一条渐细的线
  function whipLine(g, pts, w0) {
    const n = pts.length;
    g.lineCap = 'round'; g.strokeStyle = '#4a1612';
    for (let i = 0; i < n - 1; i++) { g.lineWidth = lerp(w0, 0.8, i / (n - 1)); g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[i + 1][0], pts[i + 1][1]); g.stroke(); }
  }
  // 锣面（静态贴图，挂点在上沿正中）
  function vb2Gong() {
    return cache('vb2gong', B2.gr * 2 + 4, B2.gr * 2 + 4, 1, (q) => {
      const r = B2.gr, c0 = r + 2;
      const gr = q.createRadialGradient(c0 - 12, c0 - 14, 4, c0, c0, r); [[0, '#f6dc8a'], [0.55, '#c99a3a'], [0.85, '#8a6224'], [1, '#5a3c16']].forEach(([o, cc]) => gr.addColorStop(o, cc));
      q.fillStyle = gr; q.beginPath(); q.arc(c0, c0, r, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(90,60,20,0.6)'; q.lineWidth = 1.2;
      for (const k of [0.38, 0.62, 0.86]) { q.beginPath(); q.arc(c0, c0, r * k, 0, TAU); q.stroke(); }
      q.fillStyle = '#e8c060'; q.beginPath(); q.arc(c0, c0, r * 0.22, 0, TAU); q.fill();
    });
  }
  // 月如朝左伸手时手相对脚的横向偏移（与时间无关的常量，算一次就记下）
  let reachDX0 = null;
  const reachDX = () => (reachDX0 == null ? (reachDX0 = F.points('yueru', 0, B2.floor, B2.S, 0, { pose: 'reach', facing: -1, prop: 'none' }).handN[0]) : reachDX0);
  // 红绸上的四个字：预先写成小贴图
  const silkGlyph = (ch, sz) => cache('vb2glyph' + ch + sz, sz * 1.2, sz * 1.2, 1, (q) => { q.fillStyle = '#f6d98a'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.font = `${sz}px ${XYT.FONT}`; q.fillText(ch, sz * 0.6, sz * 0.6); });
  // 甩镜：撞一下就回来（镜头内时间 → 横移像素）
  const panAt = (lt, t0) => { const u = (lt - t0) / 0.25; return u <= 0 || u >= 1 ? 0 : 170 * Math.pow(Math.sin(PI * u), 2) * (u < 0.5 ? 1 : 1 - 0.15 * (u - 0.5)); };

  XYT.registerShot('vb2_arena', {
    name: '擂台撕绸', zone: 'top', night: false,
    text: '#1a2026', shadow: 'rgba(250,246,234,0.85)', accent: '#c83c23', bloom: 0.28,
    draw(g, c) {
      const t = c.t, lt = c.lt, fl = B2.floor, S2 = B2.S;
      const tHen = ct(c, 0, 0.21), tYe = ct(c, 1, 0.59), tFang = ct(c, 2, 1.05), tQi = ct(c, 3, 1.41), tCheng = ct(c, 4, 1.85), tNuo = ct(c, 5, 2.23);
      const tS0 = tHen + 0.12, tS1 = tS0 + 0.47;
      // 跟拍横移（最后停在锣居中，好接下一镜的形状匹配）；他打转时甩一下镜
      const pan0 = tS0 + 0.235 - 0.125;
      const pan = panAt(lt, pan0);
      const camX = 18 * (1 - smooth(lt / 2.6)) - pan;
      const panV = Math.abs(panAt(lt + 0.01, pan0) - panAt(lt - 0.01, pan0)) / 0.02;
      const blurK = clamp(panV / 1600);
      g.save();
      zoomAt(g, 1.0 + 0.03 * c.p, 640, 380);
      // 远景与台：甩镜时叠一层拖糊的
      blitBands(g, vb2Static(), -B2.M + camX, 0, W + 2 * B2.M, H + 20, [[0, 100, false], [100, 540, true], [540, 590, false], [590, H + 20, true]]);
      if (lt > 0.12) vb2StaticBlur(); // 甩镜前先把拖糊图建好
      if (blurK > 0.02) { g.globalAlpha = blurK; g.drawImage(vb2StaticBlur(), -B2.M + camX, 0, W + 2 * B2.M, H + 20); g.globalAlpha = 1; }
      // 天上两只燕子掠过
      V.birds(g, c, { kind: 'pair', n: 2, x: 980 + camX, y: 200, dir: -1, speed: 120, size: 0.8, color: '#2a3038', night: false });
      g.translate(camX, 0);
      // 梁上垂下的长彩带，随风摆
      for (const [x0, col, ph] of [[B2.pillL + 40, 'rgba(94,138,132,0.9)', 0], [B2.pillL + 58, 'rgba(234,205,118,0.9)', 1.2], [B2.pillR - 40, 'rgba(94,138,132,0.9)', 2.1], [B2.pillR - 58, 'rgba(234,205,118,0.9)', 3.3]]) {
        streamer(g, x0, 36, PI / 2 - 0.28 - 0.08 * Math.sin(t * 1.4 + ph), 150, 9, t, col, { amp: 0.5, speed: 4.5, phase: ph, freq: 1.4 });
      }
      // 锣：每拍一亮，微微摆
      const [gx, gy] = B2.gong, gb = c.be(0.22), gsw = 0.05 * Math.sin(t * 2.2) + 0.08 * gb;
      g.save(); g.translate(gx, gy - B2.gr); g.rotate(gsw); g.drawImage(vb2Gong(), -B2.gr - 2, -2, B2.gr * 2 + 4, B2.gr * 2 + 4); g.restore();
      blend(g, 'screen', () => {
        glow(g, gx - 10, gy - 10, 70 + 50 * gb, '#fff0b0', 0.25 + 0.6 * gb);
        g.globalAlpha = 0.7 * gb; g.fillStyle = '#fff8d8';
        g.save(); g.translate(gx, gy); g.rotate(-0.6 + 0.3 * gb);
        g.beginPath(); g.ellipse(-12, -14, B2.gr * 0.75, 5, 0, 0, TAU); g.fill(); g.restore();
        g.globalAlpha = 1;
      });
      // ---- 月如：甩鞭；“放”字撒手；“弃”字走向左柱；“承”字扯下红绸；“诺”字扬手一抛，随后转身背对他 ----
      const sun = [-200, -260];
      const dxReach = reachDX();
      const yGrab = B2.knot[0] + 2 - dxReach, yx0 = 330, wsY = F.walkSpeed('yueru', S2, {});
      const tWalk = tQi + 0.04, tArrive = tWalk + (yx0 - yGrab) / wsY;
      let yx = yx0, yp;
      if (lt < tFang) yp = { pose: 'reach', facing: 1, lean: lt > tHen ? -0.16 * Math.sin(PI * clamp((lt - tHen) / 0.5)) : 0.04 };
      else if (lt < tFang + 0.34) yp = { pose: 'reach', facing: 1, lean: 0, head: 0.1 * up(lt, tFang, 0.3) };
      else if (lt < tWalk) yp = { pose: 'stand', facing: 1, head: 0.12 };
      else if (lt < tArrive) { yp = { pose: 'walk', facing: -1 }; yx = yx0 - wsY * (lt - tWalk); }
      else if (lt < tNuo) { yx = yGrab; yp = { pose: 'reach', facing: -1, lean: -0.2 * up(lt, tCheng, 0.25) + 0.08 * (1 - up(lt, tArrive, 0.2)) }; }
      else if (lt < tNuo + 0.5) { yx = yGrab + 10 * up(lt, tNuo, 0.2); yp = { pose: 'swordUp', facing: 1, lean: 0.1 * (1 - up(lt, tNuo, 0.3)) }; }
      else { yx = yGrab + 10; yp = { pose: 'stand', facing: -1, head: -0.12 }; }
      const yo = Object.assign({ wind: 0.5 + 0.3 * c.inten, windDir: 1, seed: 7, rim: '#fff2d0', light: sun, rimAlpha: 0.9, prop: 'none' }, yp);
      const yh = F.points('yueru', yx, fl, S2, t, yo);
      // ---- 逍遥：先被一鞭拽过去，再原地转一圈（双臂甩开、脚离地），转完晕乎乎地晃；“诺”字仰头追着红绸、迈一步伸手 ----
      let xx = 862, xy = fl, xp, kx = 1, spinTh = null;
      if (lt < tHen) xp = { pose: 'stand', facing: -1, lean: -0.04 };
      else if (lt < tS0) { const u = (lt - tHen) / 0.12; xx = lerp(862, 820, easeOut(u)); xp = { pose: 'stand', facing: -1, lean: 0.3 * Math.sin(PI * 0.5 * u) }; }
      else if (lt < tS1) {
        const u = (lt - tS0) / (tS1 - tS0); spinTh = TAU * easeInOut(u);
        xx = 820; xy = fl - 15 * Math.sin(PI * u);
      } else {
        const d = lt - tS1;
        xx = 820 + 5 * Math.sin(d * 5) * Math.exp(-d * 2);
        if (lt < tNuo + 0.12) xp = { pose: 'stand', facing: -1, lean: 0.13 * Math.sin(d * 8) * Math.exp(-d * 1.6), head: 0.2 * Math.sin(d * 6 + 1) * Math.exp(-d * 1.3) };
        else if (lt < tNuo + 0.34) xp = { pose: 'lookBack', facing: -1, head: -0.3 };
        else { xx += 26 * up(lt, tNuo + 0.34, 0.3); xp = { pose: 'reach', facing: 1, head: -0.2 }; }
      }
      const spinPose = (th) => { const cs = Math.cos(th); return [{ pose: 'summon', facing: cs >= 0 ? -1 : 1, wind: 1, windDir: Math.sin(th) >= 0 ? 1 : -1, head: 0.25 }, Math.max(0.45, Math.abs(cs))]; };
      if (spinTh != null) [xp, kx] = spinPose(spinTh);
      const xo = Object.assign({ wind: 0.55, windDir: 1, seed: 2, rim: '#fff2d0', light: sun, rimAlpha: 0.8 }, xp);
      const xw = F.points('xiaoyao', xx, xy, S2, t, xo);
      // 剑穗位置：腰侧；打转时绕身体转
      const tas = spinTh != null ? [xx - Math.cos(spinTh) * 30, xw.waist[1] + 30 + Math.sin(spinTh) * 5] : [xx + 28 * (xo.facing > 0 ? -1 : 1), xw.waist[1] + 32];
      // 打转：两道残影、风痕、脚下扬尘
      if (spinTh != null) {
        const u = (lt - tS0) / (tS1 - tS0), sa = Math.sin(PI * u);
        [[0.55, 0.25], [1.1, 0.12]].forEach(([d, a]) => {
          const [po, k2] = spinPose(spinTh - d * sa);
          g.globalAlpha = a; g.save(); g.translate(xx, 0); g.scale(k2, 1); F.draw(g, 'xiaoyao', 0, xy, S2, t, Object.assign({ wind: 0.55, seed: 2 }, po)); g.restore();
        });
        g.globalAlpha = 1;
        g.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const yy = fl - 60 - k * 62, a0 = spinTh * 1.3 + k * 0.9, rx = 100 - k * 10;
          g.strokeStyle = rgba('#ffffff', 0.7 * sa); g.lineWidth = 3 - k * 0.4;
          g.beginPath(); g.ellipse(xx, yy, rx, 16, 0, a0, a0 + 2.0); g.stroke();
        }
        for (let k = 0; k < 6; k++) glow(g, xx + (k - 2.5) * 30 * (0.5 + u), fl - 6 - 10 * h2(k, 3) * u, 26 + 20 * u, '#e8dcc0', 0.35 * sa);
      }
      g.save(); g.translate(xx, 0); g.scale(kx, 1); figWarmRim(g, 'xiaoyao', 0, xy, S2, t, xo, -2.2 / kx, -1.6, '#fff0cc'); g.restore();
      // 转完头上绕着的两颗小金星（晕）
      if (lt > tS1 && lt < tCheng) {
        const d = lt - tS1, a = clamp(d / 0.1) * (1 - clamp((lt - (tCheng - 0.3)) / 0.3));
        blend(g, 'screen', () => { for (let k = 0; k < 2; k++) { const an = d * 7 + k * PI; glow(g, xw.head[0] + Math.cos(an) * 26, xw.head[1] - 34 + Math.sin(an) * 7, 9, '#ffe9a0', 0.8 * a); } });
      }
      // ---- 鞭子 ----
      const hand = yh.handN;
      let wp = [];
      if (lt < tHen) {
        // 甩出去：鞭梢沿弧线飞向剑穗
        const u = easeOut(clamp((lt + 0.32) / (tHen + 0.32)));
        const tip = [lerp(hand[0] + 60, tas[0], u), lerp(hand[1] - 90, tas[1], u) - Math.sin(u * PI) * 60];
        for (let i = 0; i <= 14; i++) { const v = i / 14, m = qb(hand, [lerp(hand[0], tip[0], 0.5), Math.min(hand[1], tip[1]) - 80 * (1 - u) - 20], tip, v); wp.push([m[0], m[1] + Math.sin(v * 8 - lt * 30) * 6 * v * (1 - u)]); }
      } else if (lt < tFang) {
        const sag = 10 + 6 * Math.sin(lt * 12);
        for (let i = 0; i <= 14; i++) { const v = i / 14, m = qb(hand, [lerp(hand[0], tas[0], 0.5), lerp(hand[1], tas[1], 0.5) + sag], tas, v); wp.push(m); }
      } else {
        // “放”：梢先松开往下掉，柄在她张开的手里停一两帧；落到台板上盘成一圈，落点扬起一小团尘
        const tf = t - (lt - tFang) - 0.001, tau = lt - tFang;
        const h0 = F.points('yueru', yx0, fl, S2, tf, Object.assign({}, yo, { pose: 'reach', facing: 1, lean: 0 })).handN;
        const xT = F.points('xiaoyao', 820, fl, S2, tf, Object.assign({}, xo, { pose: 'stand', facing: -1, lean: 0 }));
        const t0p = [820 + 28, xT.waist[1] + 32];
        const coilC = [lerp(h0[0], t0p[0], 0.58), fl - 3], G2 = 3500;
        // 柄：在手里停一两帧再落；梢：先落；中段跟着往下坠成弧
        const fall = (p, d) => [p[0], Math.min(fl - 2, p[1] + G2 * d * d)];
        const Hd = fall(h0, Math.max(0, tau - 0.05)), Td = fall([lerp(t0p[0], t0p[0] - 40, smooth(tau / 0.3)), t0p[1]], tau);
        const sagK = smooth(tau / 0.16), coilK = smooth((tau - 0.26) / 0.18);
        for (let i = 0; i <= 14; i++) {
          const v = i / 14, bx = lerp(Hd[0], Td[0], v), by = lerp(Hd[1], Td[1], v) + (14 + 150 * sagK) * Math.sin(PI * v);
          const an = v * 2.2 * TAU + 0.6, rr = 8 + 30 * (1 - v);
          const cx = coilC[0] + Math.cos(an) * rr * 1.7, cy = coilC[1] + Math.sin(an) * rr * 0.14;
          wp.push([lerp(bx, cx, coilK), Math.min(fl - 1.5, lerp(by, cy, coilK))]);
        }
        // 梢和柄落地处各扬起一小团尘
        for (const [x0, tl] of [[Td[0], 0.18], [coilC[0] - 40, 0.32]]) {
          const d = tau - tl;
          if (d > 0 && d < 0.6) for (let k = 0; k < 4; k++) glow(g, x0 + (k - 1.5) * (14 + d * 60), fl - 5 - d * 24 * h2(k, 9), 14 + d * 46, '#eadcbc', 0.45 * (1 - d / 0.6));
        }
      }
      whipLine(g, wp, 3);
      if (lt > tHen && lt < tFang) {
        // 鞭梢在剑穗上缠的几圈
        g.strokeStyle = '#4a1612'; g.lineWidth = 1.4;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(tas[0], tas[1] + k * 4, 6, 3, 0.3, 0, TAU); g.stroke(); }
        g.fillStyle = '#c8322a'; g.beginPath(); g.moveTo(tas[0], tas[1]); g.lineTo(tas[0] + 3, tas[1] + 22); g.lineTo(tas[0] - 3, tas[1] + 22); g.closePath(); g.fill();
        if (lt < tHen + 0.15) blend(g, 'screen', () => glow(g, tas[0], tas[1], 34, '#fff6d0', 0.85 * (1 - (lt - tHen) / 0.15)));
      }
      // 月如本人
      figWarmRim(g, 'yueru', yx, fl, S2, t, yo, -2.2, -1.6, '#fff0cc');
      // ---- 红绸：系在左柱上随风轻摆；“承”字被扯下（顶上的结先撑住，再崩断），“诺”字一扬，被风带走，一拍一翻 ----
      const N = 16, Ls = B2.Ls, knot = B2.knot;
      const hang = () => { const p = []; for (let i = 0; i < N; i++) { const u = i / (N - 1); p.push([knot[0] + Math.sin(u * 2.6 - t * 2.4) * 7 * u + 10 * u * u, knot[1] + u * Ls]); } return p; };
      const held = (h, sw) => {
        // 握在手里：自由端顺风朝右上飘
        const p = [], al = lerp(-PI / 2 - 0.15, -0.35, sw) + 0.25 * Math.sin((lt - tCheng) * 10) * (1 - sw);
        for (let i = 0; i < N; i++) {
          const u = 1 - i / (N - 1), d = u * Ls, wv = (Math.sin(u * 6 - t * 11) * 16 + Math.sin(u * 13 - t * 17) * 4) * u * sw + 20 * u * u * (1 - sw);
          p.push([h[0] + Math.cos(al) * d - Math.sin(al) * wv, h[1] + Math.sin(al) * d + Math.cos(al) * wv]);
        }
        return p;
      };
      const tSnap = tCheng + 0.12;
      let pts = [], twist;
      if (lt < tCheng) { pts = hang(); twist = (u) => 0.82 + 0.18 * Math.sin(u * 4 - t * 2); }
      else if (lt < tNuo) {
        const h = yh.handN, tau = lt - tCheng, sw = up(lt, tSnap, 0.3);
        const P0 = hang(), P1 = held(h, sw);
        if (lt < tSnap) {
          // 结还没断：绸子从结一直绷到她手上
          const k = smooth(tau / 0.12);
          for (let i = 0; i < N; i++) { const u = i / (N - 1), ln = [lerp(knot[0], h[0], u), lerp(knot[1], h[1], u) + 18 * Math.sin(PI * u) * (1 - k)]; pts.push([lerp(P0[i][0], ln[0], k), lerp(P0[i][1], ln[1], k)]); }
        } else {
          const k = smooth((lt - tSnap) / 0.12);
          for (let i = 0; i < N; i++) { const u = i / (N - 1), ln = [lerp(knot[0], h[0], u), lerp(knot[1], h[1], u)]; pts.push([lerp(ln[0], P1[i][0], k), lerp(ln[1], P1[i][1], k)]); }
        }
        twist = (u) => Math.cos((1 - u) * 2.2 * sw - (lt - tSnap) * 5 * sw) * (0.9 + 0.1 * sw);
      } else {
        // 飞走：自由端沿风的轨迹领头，其余各点沿同一条轨迹落后
        const tau = lt - tNuo, hR = F.points('yueru', yGrab, fl, S2, t - tau, Object.assign({}, yo, { pose: 'reach', facing: -1, lean: -0.2 })).handN;
        const F0 = [hR[0] + Math.cos(-0.35) * Ls, hR[1] + Math.sin(-0.35) * Ls];
        const v0 = [640, -110], sp = Math.hypot(v0[0], v0[1]), d0 = [v0[0] / sp, v0[1] / sp];
        const P = (s) => (s >= 0 ? [F0[0] + v0[0] * s + 180 * s * s, F0[1] + v0[1] * s - 30 * s * s + 26 * Math.sin(s * 4)] : [F0[0] + d0[0] * sp * s, F0[1] + d0[1] * sp * s]);
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1), s = tau - u * Ls / sp, p = P(s), wv = (Math.sin(u * 6 - t * 11) * 18 + Math.sin(u * 14 - t * 19) * 5) * (0.3 + u) * Math.min(1, 0.4 + tau * 3);
          pts.push([p[0] - d0[1] * wv, p[1] + d0[0] * wv]);
        }
        pts.reverse();
        const fl2 = PI * beatSteps(c, tNuo, 0.35);
        twist = (u) => Math.cos(fl2 + (1 - u) * 2.4 + Math.sin(t * 4 + u * 3) * 0.4);
      }
      // 正午的光透过红绸
      blend(g, 'screen', () => { const m = pts[N >> 1]; glow(g, m[0], m[1], 90, '#ff7a50', 0.24); });
      silkStrip(g, pts, 50, twist, fontOK());
      // 柱上的绳结：断之前系着绸，崩断后两头散开的线头，迸出几点金星
      g.strokeStyle = '#c9a858'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(B2.pillL + 14, knot[1] - 8);
      if (lt < tSnap) g.lineTo(pts[0][0], pts[0][1]);
      else { const sw2 = Math.exp(-(lt - tSnap) / 0.5); g.quadraticCurveTo(B2.pillL + 30, knot[1] + 6, B2.pillL + 22 + 6 * Math.sin(t * 9) * sw2, knot[1] + 22); }
      g.stroke();
      if (lt >= tSnap) {
        g.lineWidth = 1;
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(B2.pillL + 22, knot[1] + 22); g.lineTo(B2.pillL + 22 + k * 4, knot[1] + 30); g.stroke(); }
        if (lt < tNuo) { const p = pts[0]; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + k * 4 - 3, p[1] - 8); g.stroke(); } }
        V.sparks(g, c, { x: knot[0] - 6, y: knot[1] + 8, at: tSnap, n: 8, speed: 260, gravity: 700, dur: 0.6, color: '#f6d070', size: 0.8, night: false });
      }
      // 阳光里浮动的金尘，每拍闪一下
      blend(g, 'screen', () => {
        const fb = c.be(0.3);
        for (let i = 0; i < 14; i++) {
          const x = (h2(i, 71) * 1400 + t * (8 + 10 * h2(i, 72))) % 1400 - 60, y = 140 + h2(i, 73) * 400 + Math.sin(t * 0.8 + i) * 14;
          glow(g, x, y, 3 + 4 * h2(i, 74), '#fff0c0', (0.35 + 0.4 * fb * h2(i, 75)) * (0.5 + 0.5 * Math.sin(t * 2 + i)));
        }
      });
      // ---- 台下的人：每拍笑得前仰后合，强拍更大（每排切成四段，各段自己颠） ----
      g.translate(-camX * 0.3, 0);
      const laugh = lt > tHen ? 1 : 0.4, bounce = c.be(0.28) + 1.2 * c.de(0.35);
      g.imageSmoothingEnabled = false;
      for (let row = 0; row < 2; row++) for (let sg = 0; sg < 4; sg++) {
        const S = crowdSeg(row, sg), R = CROWD_ROWS[row], ph = h2(sg, row + 3);
        const dy = -bounce * (5 + 9 * ph) * laugh * R.sc + Math.sin(t * 9 + sg * 2 + row) * 1.5 * laugh, dx = Math.sin(t * 2.2 + sg * 1.7 + row) * 2 * laugh;
        g.drawImage(S, S.x0 + dx, S.y0 + dy, S.lw, S.lh);
      }
      g.imageSmoothingEnabled = true;
      g.restore();
    },
  });

  // ======================================================================
  // 11 第11句 · 茶中蛊影：阴天海边茶棚，棚里一盏灯笼暖光、棚外海色冰冷；绣月牙的黑袖把茶推到少年面前，“自”字切近景他一饮而尽，“认”字切进杯里：蛊虫一扭，倒影里的桃林与白衣人像墨入水般化开褪色
  // ======================================================================
  const B3 = { hz: 318, cupY: 512, cs: 1.05, c0: 440, c1: 610, lamp: [176, 150], tea: [840, 450, 480, 268] };
  // 小工具：一团不规则墨形的路径（不另起 beginPath，可以多团并成一个裁剪区）
  function blobPath(g, x, y, R, seed, wob = 0.3) {
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, rr = R * (1 + wob * (noise1(a * 1.6 + seed, seed) - 0.5) * 2);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.62;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  // 茶棚：暗的草檐、半卷的竹帘、两根竹柱框住外面阴天灰青的海和雾里的仙岛（整张静态）
  function vb3Back() {
    return cache('vb3back5', W, H, 1, (q) => {
      const hz = B3.hz, r = A.rng(55);
      q.fillStyle = K.lin(q, 0, 0, 0, hz, [[0, '#7e909a'], [0.6, '#a8b8ba'], [1, '#c4d0cc']]); q.fillRect(0, 0, W, hz + 2);
      E.clouds(q, { t: 0, y: 130, color: '#bcc6c8', shade: '#6e7e88', alpha: 0.75, scale: 1.2, n: 5, seed: 44, speed: 0, style: 'wash' });
      // 云缝漏下一束天光，正落在远岛上
      A.softBlob(q, 700, 160, 150, 0.3, '#eef0ea');
      q.globalCompositeOperation = 'screen'; q.globalAlpha = 0.7;
      V.godRays(q, { t: 1, lt: 0 }, { x: 700, y: 120, angle: 1.62, spread: 0.5, n: 5, len: 230, start: 0.3, width: 1.4, color: '#f4f6f0', alpha: 0.26, res: 0.4, beat: 0, night: false, blend: 'lighter' });
      q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
      ridgePath(q, [[540, hz + 2], [610, hz - 24], [670, hz - 40], [730, hz - 28], [800, hz - 12], [860, hz + 2]], 5, hz + 3, 5);
      q.fillStyle = 'rgba(112,130,140,0.5)'; q.fill();
      A.softBlob(q, 680, hz - 24, 36, 0.3, '#e4c6d0');
      // 海：灰青，近处深
      q.fillStyle = K.lin(q, 0, hz, 0, 560, [[0, '#a4b8b4'], [0.4, '#7c9e9a'], [1, '#465a64']]); q.fillRect(0, hz, W, H - hz);
      for (let i = 0; i < 110; i++) {
        const u = r(), y = hz + 4 + u * u * 200, w = (8 + r() * 30) * (0.4 + u * 1.8);
        q.fillStyle = rgba(r() < 0.6 ? '#d4e0dc' : '#34464e', 0.16 + r() * 0.18); q.fillRect(r() * W, y, w, 1 + u * 1.6);
      }
      q.fillStyle = K.lin(q, 0, hz - 14, 0, hz + 16, [[0, 'rgba(206,216,212,0)'], [0.5, 'rgba(206,216,212,0.7)'], [1, 'rgba(206,216,212,0)']]); q.fillRect(0, hz - 14, W, 30);
      A.softBlob(q, 690, hz + 22, 120, 0.32, '#e8eee8');
      // 棚内：四周压暗，像一个暖色的画框
      const vg = q.createRadialGradient(640, 300, 300, 640, 360, 820);
      vg.addColorStop(0, 'rgba(40,26,16,0)'); vg.addColorStop(1, 'rgba(40,26,16,0.55)');
      q.fillStyle = vg; q.fillRect(0, 0, W, H);
      // 竹柱：朝灯的一面被映暖
      for (const [x, w] of [[54, 46], [1226, 40]]) {
        q.fillStyle = K.lin(q, x - w / 2, 0, x + w / 2, 0, [[0, '#2e2416'], [0.4, x < 640 ? '#8a6a3a' : '#5a4a2e'], [1, '#221a10']]); q.fillRect(x - w / 2, 0, w, H);
        for (let y = 70; y < H; y += 120 + r() * 30) { q.fillStyle = 'rgba(30,22,12,0.75)'; q.fillRect(x - w / 2 - 1, y, w + 2, 5); q.fillStyle = 'rgba(240,200,140,0.3)'; q.fillRect(x - w / 2, y + 5, w, 2); }
      }
      // 草檐与半卷的竹帘
      q.fillStyle = K.lin(q, 0, 0, 0, 40, [[0, '#2a2016'], [1, '#4a3a26']]); q.fillRect(0, 0, W, 36);
      q.strokeStyle = 'rgba(96,78,48,0.9)'; q.lineCap = 'round';
      for (let i = 0; i < 240; i++) { const x = r() * W, l = 12 + r() * 26; q.lineWidth = 1 + r() * 1.5; q.beginPath(); q.moveTo(x, 30); q.lineTo(x + (r() - 0.5) * 6, 30 + l); q.stroke(); }
      q.fillStyle = K.lin(q, 0, 50, 0, 78, [[0, '#b89a62'], [0.5, '#d8bc84'], [1, '#8a6e40']]); q.fillRect(80, 52, W - 160, 24);
      q.strokeStyle = 'rgba(90,70,40,0.5)'; q.lineWidth = 1; for (let k = 0; k < 4; k++) { q.beginPath(); q.moveTo(80, 56 + k * 6); q.lineTo(W - 80, 56 + k * 6); q.stroke(); }
      q.strokeStyle = 'rgba(60,44,24,0.8)'; q.lineWidth = 1.2; for (const x of [300, 980]) { q.beginPath(); q.moveTo(x, 36); q.lineTo(x, 84); q.stroke(); }
      // 灯笼挂绳
      q.beginPath(); q.moveTo(B3.lamp[0], 36); q.lineTo(B3.lamp[0], B3.lamp[1] - 26); q.stroke();
    });
  }
  // 茶桌：旧漆木，左边被灯笼映暖；一圈旧茶渍、几片散落的茶叶；茶壶放在他手边（静态）
  function vb3Table() {
    return cache('vb3table2', W, 260, 1, (q) => {
      q.translate(0, -460);
      q.fillStyle = K.lin(q, 0, 488, 0, 588, [[0, '#5e4834'], [0.5, '#4a3826'], [1, '#3a2c1e']]);
      poly(q, [[-20, 500], [W + 20, 488], [W + 20, 590], [-20, 590]]); q.fill();
      const r = A.rng(66);
      q.strokeStyle = 'rgba(30,20,12,0.35)'; q.lineWidth = 1;
      for (let i = 0; i < 18; i++) { const y = 496 + i * 5.2 + r() * 2; q.beginPath(); q.moveTo(-20, y + 6); q.bezierCurveTo(400, y + (r() - 0.5) * 6, 800, y + (r() - 0.5) * 6, W + 20, y - 6); q.stroke(); }
      // 灯笼的暖光落在桌面
      q.globalCompositeOperation = 'screen';
      q.save(); q.translate(400, 532); q.scale(2.4, 0.5); A.softBlob(q, 0, 0, 220, 0.5, '#d8904a'); q.restore();
      q.globalCompositeOperation = 'source-over';
      q.fillStyle = 'rgba(255,220,170,0.22)'; q.fillRect(-20, 497, W + 40, 2);
      // 旧茶渍
      q.strokeStyle = 'rgba(40,24,10,0.35)'; q.lineWidth = 2.5; q.beginPath(); q.ellipse(745, 548, 30, 7, 0, 0.3, TAU - 0.4); q.stroke();
      q.strokeStyle = 'rgba(40,24,10,0.2)'; q.lineWidth = 1.5; q.beginPath(); q.ellipse(752, 551, 24, 5.5, 0, 0, TAU); q.stroke();
      // 散落的茶叶
      for (let i = 0; i < 9; i++) {
        const x = 330 + r() * 520, y = 530 + r() * 46;
        q.save(); q.translate(x, y); q.rotate(r() * PI); q.fillStyle = rgba(r() < 0.5 ? '#3a4a24' : '#5a5a2a', 0.85); q.beginPath(); q.ellipse(0, 0, 4 + r() * 3, 1.4, 0, 0, TAU); q.fill(); q.restore();
      }
      // 桌沿与桌下的暗
      q.fillStyle = K.lin(q, 0, 588, 0, 616, [[0, '#3a2a1c'], [1, '#1c130c']]); q.fillRect(-20, 588, W + 40, 28);
      q.fillStyle = 'rgba(255,220,170,0.2)'; q.fillRect(-20, 588, W + 40, 1.5);
      q.fillStyle = K.lin(q, 0, 616, 0, 720, [[0, '#160f0a'], [1, '#221c16']]); q.fillRect(-20, 616, W + 40, 110);
      // 茶壶（他手边，桌右后）
      const px = 800, py = 508, k = 0.8;
      q.save(); q.translate(px, py); q.scale(k, k);
      q.fillStyle = 'rgba(20,12,8,0.3)'; q.beginPath(); q.ellipse(6, 4, 60, 9, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, -50, 0, 50, 0, [[0, '#7a4a30'], [0.4, '#8a5a3c'], [1, '#2a1810']]);
      q.beginPath(); q.ellipse(0, -34, 50, 36, 0, 0, TAU); q.fill();
      q.beginPath(); q.moveTo(-44, -40); q.quadraticCurveTo(-80, -52, -90, -76); q.lineTo(-82, -78); q.quadraticCurveTo(-70, -58, -40, -28); q.fill();
      q.strokeStyle = '#3a2418'; q.lineWidth = 6; q.beginPath(); q.arc(52, -36, 18, -PI * 0.5, PI * 0.5); q.stroke();
      q.fillStyle = '#3a2418'; q.beginPath(); q.ellipse(0, -70, 26, 6, 0, 0, TAU); q.fill(); q.beginPath(); q.arc(0, -78, 6, 0, TAU); q.fill();
      q.fillStyle = 'rgba(255,220,180,0.35)'; q.beginPath(); q.ellipse(-24, -46, 9, 18, -0.4, 0, TAU); q.fill();
      q.restore();
    });
  }
  // 茶杯（侧视，口沿略俯）：青瓷，茶面每拍一晃；worm>0 时茶面上一条小黑虫一扭
  function cupSide(g, x, y, s, slosh, tilt, o = {}) {
    g.save(); g.translate(x, y); g.rotate(tilt || 0); g.scale(s, s);
    if (!o.noShadow) { g.fillStyle = 'rgba(20,12,8,0.32)'; g.beginPath(); g.ellipse(6, 2, 36, 7, 0, 0, TAU); g.fill(); }
    g.fillStyle = K.lin(g, -30, 0, 30, 0, [[0, '#9ab4a4'], [0.3, '#e0ecdf'], [0.65, '#aac2b2'], [1, '#5f7a6e']]);
    g.beginPath(); g.moveTo(-30, -40); g.quadraticCurveTo(-28, -6, -14, 0); g.lineTo(14, 0); g.quadraticCurveTo(28, -6, 30, -40); g.closePath(); g.fill();
    // 灯光从左边映在杯身上
    g.fillStyle = 'rgba(255,200,140,0.35)'; g.beginPath(); g.moveTo(-27, -38); g.quadraticCurveTo(-25, -10, -14, -2); g.lineTo(-9, -2); g.quadraticCurveTo(-18, -12, -19, -38); g.closePath(); g.fill();
    g.fillStyle = '#d4e2d6'; g.beginPath(); g.ellipse(0, -40, 30, 10.5, 0, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, 0, -48, 0, -32, [[0, '#a4823e'], [1, '#6a5226']]); g.beginPath(); g.ellipse(0, -39.5 + slosh * 0.6, 26.5, 8.4, slosh * 0.03, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,236,200,0.55)'; g.beginPath(); g.ellipse(-9 + slosh * 3, -42 + slosh * 0.6, 8, 2, 0, 0, TAU); g.fill();
    if (o.worm > 0) {
      // 茶面上那条黑虫：一点点大，随晃动扭一扭
      g.strokeStyle = rgba('#120c10', 0.85 * o.worm); g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const u = i / 6, px = 6 + (u - 0.5) * 9, py = -38 + Math.sin(u * 6 - o.t * 9) * 1.2 * (0.5 + Math.abs(slosh) * 0.4) + slosh * 0.5; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    }
    g.restore();
  }
  // 拜月教徒的黑袖：袖口一圈银线月牙，几道柔和的褶光，袖里伸出一只苍白的手
  function sleeve(g, hx, hy, t) {
    g.save();
    const sw = Math.sin(t * 1.6) * 6;
    g.fillStyle = K.lin(g, 0, hy - 110, 0, hy + 90, [[0, '#2a2438'], [0.5, '#161823'], [1, '#0c0c12']]);
    g.beginPath();
    g.moveTo(-60, hy - 96); g.bezierCurveTo(hx - 300, hy - 110 + sw, hx - 160, hy - 64, hx - 92, hy - 46);
    g.lineTo(hx - 72, hy - 32); g.quadraticCurveTo(hx - 64, hy + 8, hx - 86, hy + 48);
    g.bezierCurveTo(hx - 150, hy + 100, hx - 260, hy + 150 - sw, -60, hy + 200); g.closePath(); g.fill();
    // 垂下的宽袖口一角
    g.beginPath(); g.moveTo(hx - 120, hy + 40); g.quadraticCurveTo(hx - 150, hy + 140 + sw, hx - 230, hy + 170); g.quadraticCurveTo(hx - 200, hy + 110, hx - 210, hy + 60); g.closePath(); g.fill();
    // 两三道柔和的褶光（灯在左上，褶的上沿发暖）
    g.save(); g.clip();
    for (const [k, a] of [[0, 0.32], [1, 0.22], [2, 0.16]]) {
      const y0 = hy - 70 + k * 52;
      const gr = g.createLinearGradient(0, y0 - 18, 0, y0 + 22);
      gr.addColorStop(0, 'rgba(120,96,150,0)'); gr.addColorStop(0.45, rgba('#7a6aa0', a)); gr.addColorStop(1, 'rgba(120,96,150,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-60, y0 - 20); g.bezierCurveTo(hx - 300, y0 - 14 + sw * 0.5, hx - 180, y0 + k * 6, hx - 100, y0 + 8 + k * 10); g.lineTo(hx - 100, y0 + 24 + k * 10); g.bezierCurveTo(hx - 190, y0 + 22, hx - 300, y0 + 14, -60, y0 + 18); g.closePath(); g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(240,190,130,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-60, hy - 96); g.bezierCurveTo(hx - 300, hy - 110 + sw, hx - 160, hy - 64, hx - 92, hy - 46); g.stroke();
    // 袖上一缕幽紫的雾气
    blend(g, 'screen', () => glow(g, hx - 120, hy - 10, 110, '#6a4a8a', 0.2 + 0.08 * Math.sin(t * 3)));
    // 袖口：深紫镶边与银月牙
    g.fillStyle = '#3a2a4e';
    g.beginPath(); g.moveTo(hx - 92, hy - 48); g.quadraticCurveTo(hx - 60, hy - 4, hx - 86, hy + 50); g.lineTo(hx - 108, hy + 44); g.quadraticCurveTo(hx - 82, hy - 4, hx - 112, hy - 42); g.closePath(); g.fill();
    for (let k = 0; k < 4; k++) {
      const u = (k + 0.5) / 4, mx = lerp(hx - 100, hx - 96, u) + Math.sin(u * PI) * 16, my = lerp(hy - 40, hy + 44, u);
      g.fillStyle = '#d8d4e8'; g.beginPath(); g.arc(mx, my, 6, -PI * 0.6, PI * 0.6); g.arc(mx + 3, my, 4.6, PI * 0.6, -PI * 0.6, true); g.closePath(); g.fill();
    }
    // 手：苍白，四指搭在杯侧
    g.fillStyle = '#e8ded4';
    g.beginPath(); g.moveTo(hx - 80, hy - 16); g.quadraticCurveTo(hx - 54, hy - 30, hx - 30, hy - 24); g.lineTo(hx - 30, hy + 6); g.quadraticCurveTo(hx - 56, hy + 14, hx - 80, hy + 14); g.closePath(); g.fill();
    g.lineCap = 'round'; g.strokeStyle = '#e8ded4';
    for (let k = 0; k < 4; k++) { g.lineWidth = 6.5 - k * 0.6; g.beginPath(); g.moveTo(hx - 34, hy - 20 + k * 7.5); g.quadraticCurveTo(hx - 16, hy - 24 + k * 7, hx - 6 + k * 1.5, hy - 18 + k * 7.5); g.stroke(); }
    g.lineWidth = 6; g.beginPath(); g.moveTo(hx - 56, hy - 22); g.quadraticCurveTo(hx - 40, hy - 40, hx - 20, hy - 36); g.stroke();
    g.strokeStyle = 'rgba(120,96,90,0.45)'; g.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(hx - 30, hy - 17 + k * 7.5); g.lineTo(hx - 8 + k * 1.5, hy - 15 + k * 7.5); g.stroke(); }
    g.restore();
  }
  // 灯笼：暖黄纸灯，随风轻摆，每拍火苗一跳
  function vb3Lamp(g, t, be, a = 1) {
    const [lx, ly] = B3.lamp, sw = 0.05 * Math.sin(t * 1.3);
    blend(g, 'screen', () => { glow(g, lx, ly, 260, '#ff9a40', 0.3 * a); glow(g, lx, ly, 90, '#ffc070', (0.5 + 0.15 * be) * a); });
    g.save(); g.translate(lx, ly - 26); g.rotate(sw); g.translate(-lx, -(ly - 26));
    g.globalAlpha = a;
    E.lantern(g, { x: lx, y: ly - 26, s: 0.9, t, color: '#e8a050', lit: 0.9 + 0.1 * be, swing: 0, kind: 'round', glowColor: '#ffc070', tassel: '#a03020', seed: 3 });
    g.globalAlpha = 1;
    g.restore();
  }
  // 杯中倒影：仙灵岛桃林与白衣人影，琥珀色的茶已经染进去（彩色一张、褪成灰白一张，静态）
  function vb3Mem(grey) {
    return cache(grey ? 'vb3memG' : 'vb3memC', 960, 536, 1, (q) => {
      q.save(); q.beginPath(); q.ellipse(480, 268, 480, 268, 0, 0, TAU); q.clip();
      q.fillStyle = K.lin(q, 0, 0, 0, 536, [[0, '#f6e8ec'], [0.6, '#eed6de'], [1, '#e4c6d0']]); q.fillRect(0, 0, 960, 536);
      A.softBlob(q, 480, 220, 290, 0.6, '#fffaf4');
      q.fillStyle = 'rgba(170,150,176,0.4)'; ridgePath(q, [[0, 320], [160, 230], [320, 280], [500, 210], [700, 270], [960, 220], [960, 320]], 6, 330, 8); q.fill();
      const br = XYT.sprites.branch;
      q.globalAlpha = 0.85; q.drawImage(br, -40, -20, 540, 354);
      q.save(); q.translate(1000, -10); q.scale(-1, 1); q.drawImage(br, 0, 0, 500, 330); q.restore();
      q.globalAlpha = 1;
      const r = A.rng(5);
      for (let i = 0; i < 70; i++) { q.fillStyle = rgba(i % 2 ? '#f2a6bc' : '#fbd6e0', 0.5 + r() * 0.4); q.beginPath(); q.ellipse(r() * 960, 290 + r() * 250, 3 + r() * 4, 2 + r() * 2, r() * PI, 0, TAU); q.fill(); }
      q.fillStyle = K.lin(q, 0, 370, 0, 536, [[0, 'rgba(232,214,222,0)'], [1, 'rgba(214,190,204,0.8)']]); q.fillRect(0, 370, 960, 166);
      A.softBlob(q, 520, 320, 140, 0.7, '#ffffff');
      F.draw(q, 'linger', 520, 410, 1.2, 2.0, { pose: 'stand', facing: -1, wind: 0.6, windDir: 1, seed: 9 });
      // 映在茶里：压一层琥珀
      q.globalCompositeOperation = 'multiply'; q.fillStyle = '#d8b878'; q.globalAlpha = 0.6; q.fillRect(0, 0, 960, 536);
      q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
      q.fillStyle = 'rgba(122,100,48,0.1)'; q.fillRect(0, 0, 960, 536);
      if (grey) {
        // 褪色：去饱和、发灰、被墨吃掉一层
        q.globalCompositeOperation = 'saturation'; q.fillStyle = '#808080'; q.fillRect(0, 0, 960, 536);
        q.globalCompositeOperation = 'source-over';
        q.fillStyle = 'rgba(70,62,52,0.45)'; q.fillRect(0, 0, 960, 536);
        for (let i = 0; i < 14; i++) A.softBlob(q, r() * 960, r() * 536, 60 + r() * 120, 0.18, '#1a141e');
      }
      q.restore();
    });
  }
  // 杯口俯视：外面一圈暗木桌，青瓷口沿、内壁，茶底色（静态）
  function vb3Macro() {
    return cache('vb3macro', W + 120, H + 120, 1, (q) => {
      q.translate(60, 60);
      const cx = 840, cy = 420, [tx, ty, trx, tr2] = B3.tea;
      q.fillStyle = K.lin(q, 0, -60, 0, H + 60, [[0, '#4a3828'], [1, '#22180f']]); q.fillRect(-60, -60, W + 120, H + 120);
      q.globalCompositeOperation = 'screen'; A.softBlob(q, 200, 100, 520, 0.4, '#a0602a'); q.globalCompositeOperation = 'source-over';
      q.fillStyle = 'rgba(10,6,4,0.45)'; q.beginPath(); q.ellipse(cx + 20, cy + 26, 610, 356, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, 0, cy - 340, 0, cy + 340, [[0, '#e6efe8'], [0.5, '#b6cbbd'], [1, '#8aa496']]);
      q.beginPath(); q.ellipse(cx, cy, 600, 350, 0, 0, TAU); q.fill();
      q.fillStyle = K.lin(q, 0, cy - 320, 0, cy + 300, [[0, '#9fb8aa'], [0.3, '#cfdcd2'], [1, '#e2ebe4']]);
      q.beginPath(); q.ellipse(cx, cy + 6, 560, 322, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(80,100,90,0.18)'; q.lineWidth = 1;
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; q.beginPath(); q.moveTo(cx + Math.cos(a) * 560, cy + 6 + Math.sin(a) * 322); q.lineTo(cx + Math.cos(a + 0.1) * 470, cy + 30 + Math.sin(a + 0.1) * 262); q.stroke(); }
      // 灯笼的暖光映在左上的口沿
      q.globalCompositeOperation = 'screen'; q.save(); q.beginPath(); q.ellipse(cx, cy, 600, 350, 0, 0, TAU); q.clip(); A.softBlob(q, cx - 420, cy - 240, 260, 0.5, '#e8a060'); q.restore(); q.globalCompositeOperation = 'source-over';
      q.fillStyle = K.lin(q, 0, ty - tr2, 0, ty + tr2, [[0, '#8a7234'], [1, '#5a4820']]);
      q.beginPath(); q.ellipse(tx, ty, trx, tr2, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(255,255,255,0.55)'; q.lineWidth = 3;
      q.beginPath(); q.ellipse(cx, cy, 598, 348, 0, PI * 1.1, PI * 1.6); q.stroke();
    });
  }
  // 蛊虫：圆头、尾巴渐尖，十几节环纹，背上一道幽紫的光；身子是一条行波，扭的时候头部卷成 S
  function guWorm(g, x, y, len, t, twist, ang) {
    const n = 14, pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), d = (0.5 - u) * len;
      let w = Math.sin(u * 2.2 * PI - t * 9) * len * 0.08;
      w += twist * Math.sin(clamp(1 - u * 2.2) * PI * 1.6) * len * 0.22 * (1 - u);
      pts.push([x + Math.cos(ang) * d - Math.sin(ang) * w, y + Math.sin(ang) * d + Math.cos(ang) * w]);
    }
    // 身后一缕淡墨
    g.strokeStyle = 'rgba(26,20,30,0.18)'; g.lineWidth = len * 0.06; g.lineCap = 'round';
    g.beginPath(); const tl = pts[n - 1]; g.moveTo(tl[0], tl[1]);
    for (let k = 1; k <= 6; k++) g.lineTo(tl[0] - Math.cos(ang) * k * len * 0.12 + Math.sin(t * 2 + k) * 3, tl[1] - Math.sin(ang) * k * len * 0.12 + Math.cos(t * 1.6 + k) * 3);
    g.stroke();
    blend(g, 'screen', () => glow(g, x, y, len * 0.8, '#8a5ab0', 0.28));
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const u = i / (n - 1), r = len * 0.05 * (u < 0.12 ? 0.75 + 0.25 * Math.sin((u / 0.12) * PI * 0.5) : Math.pow(1 - (u - 0.12) / 0.88, 0.7) * 0.9 + 0.1);
      L.push([pts[i][0] - dy / l * r, pts[i][1] + dx / l * r]); R.push([pts[i][0] + dy / l * r, pts[i][1] - dx / l * r]);
    }
    const hd = pts[0], hr = len * 0.05;
    g.fillStyle = '#16121a';
    g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
    g.beginPath(); g.arc(hd[0], hd[1], hr, 0, TAU); g.fill();
    // 环纹与背光
    g.strokeStyle = 'rgba(120,100,150,0.5)'; g.lineWidth = 0.9;
    for (let i = 1; i < n - 1; i++) { g.beginPath(); g.moveTo(L[i][0], L[i][1]); g.lineTo(R[i][0], R[i][1]); g.stroke(); }
    g.strokeStyle = 'rgba(170,130,210,0.6)'; g.lineWidth = 1.4; g.beginPath(); R.slice(0, n - 2).forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    // 头上两点暗红
    const hx2 = hd[0] + Math.cos(ang) * hr * 0.3, hy2 = hd[1] + Math.sin(ang) * hr * 0.3;
    g.fillStyle = '#b0303a'; for (const k of [-1, 1]) { g.beginPath(); g.arc(hx2 - Math.sin(ang) * k * hr * 0.45, hy2 + Math.cos(ang) * k * hr * 0.45, 1.6, 0, TAU); g.fill(); }
  }

  XYT.registerShot('vb3_gu', {
    name: '茶中蛊影', zone: 'top', night: false,
    text: '#1a2026', shadow: 'rgba(236,240,236,0.85)', accent: '#7a4a9a', bloom: 0.25,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tMing = ct(c, 0, 0.31), tYun = ct(c, 1, 0.63), tZi = ct(c, 2, 1.03), tRen = ct(c, 3, 1.45), tYou = ct(c, 4, 1.87), tMo = ct(c, 5, 2.23);
      const sb = sinceBeat(c), slosh = Math.sin(sb * 14) * Math.exp(-sb / 0.35) * 2.2;
      const be = c.be(0.3);
      if (lt < tZi) {
        // ---- 茶棚近景：开头从杯口拉出来（接上一镜的锣面），黑袖推杯 ----
        const cs = B3.cs, mouth = [B3.c0, B3.cupY - 40 * cs], Q = [640, 352];
        const e = smooth((lt + 0.5) / 0.8), z = lerp(55 / (30 * cs), 1, e) * (1 + 0.035 * smooth((lt - 0.3) / 0.8));
        const P = [lerp(mouth[0], Q[0], e), lerp(mouth[1], Q[1], e)];
        g.save(); g.translate(Q[0], Q[1]); g.scale(z, z); g.translate(-P[0], -P[1]);
        blitBands(g, vb3Back(), 0, 0, W, H, [[0, 40, false], [40, 300, true], [300, H, false]]);
        E.mist(g, { t, y: B3.hz + 10, h: 80, color: '#ccd4d0', alpha: 0.35, speed: 6, seed: 4 });
        V.birds(g, c, { kind: 'flock', n: 3, x: 760, y: 190, dir: -1, speed: 22, size: 0.9, color: '#5e6c74', spread: 70, night: false });
        // 茶旗
        const fl = cache('vb3flag', 70, 200, 1, (q) => {
          q.fillStyle = '#e8dcc0'; q.fillRect(0, 0, 70, 200); q.fillStyle = '#5a7a6a'; q.fillRect(0, 0, 70, 10); q.fillRect(0, 190, 70, 10);
          q.fillStyle = '#2a3a34'; q.font = `52px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('茶', 35, 100);
        });
        E.util.cloth(g, fl, 1110, 90, 70, 200, t, { axis: 'y', amp: 6, freq: 1, speed: 3, n: 8, shade: 0.25 });
        // 少年：侧影坐在右侧，望着茶；灯光从左边勾出他的脸
        const xo = { pose: 'stand', facing: -1, wind: 0.25, windDir: -1, seed: 4, head: 0.1 + 0.06 * up(lt, tYun, 0.4), prop: 'none', rim: '#f0c890', light: B3.lamp, rimWidth: 2.5, rimAlpha: 0.85 };
        figWarmRim(g, 'xiaoyao', 975, 965, 4.0, t, xo, -3.5, -1.5, '#e8b878');
        g.drawImage(vb3Table(), 0, 460, W, 260);
        // 茶杯：“命”字被黑袖推到他面前
        const push = easeInOut(clamp((lt - tMing) / 0.4)), cx = lerp(B3.c0, B3.c1, push), cy = B3.cupY;
        // 漆面上杯子的倒影
        g.save(); g.globalAlpha = 0.22; g.translate(0, cy * 2 + 4); g.scale(1, -0.45); cupSide(g, cx, cy, cs, 0, 0, { noShadow: true }); g.restore();
        cupSide(g, cx, cy, cs, slosh, 0, { worm: (lt > tMing ? clamp((lt - tMing) / 0.2) : 0) * (0.35 + 0.65 * Math.min(1, Math.abs(slosh))), t });
        // 茶烟：被灯映暖
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = rgba(k === 1 ? '#ffe8c8' : '#ffffff', 0.26); g.lineWidth = 2.5; g.beginPath();
          for (let j = 0; j <= 10; j++) { const u = j / 10, py = cy - 46 * cs - u * 90, px = cx - 8 + k * 8 + Math.sin(u * 5 + t * 2 + k) * 8 * u; j ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke();
        }
        // 黑袖：推杯，然后往左下缩回桌沿以下
        const back = easeIn(clamp((lt - tYun - 0.05) / 0.45));
        const hx = lerp(cx - 16, lerp(cx - 60, -160, back), smooth(back * 1.5)), hy = cy - 18 + back * back * 230;
        if (back < 1) sleeve(g, hx, hy, t);
        vb3Lamp(g, t, be);
        // 提前把杯中微距要用的几张大贴图分几帧备好（只建缓存，不影响画面），免得硬切那一帧卡顿
        if (lt > 0.5) vb3Macro(); if (lt > 0.72) vb3Mem(false); if (lt > 0.92) vb3Mem(true);
        // 近处一缕薄雾
        E.mist(g, { t, y: 650, h: 110, color: '#b8a890', alpha: 0.14, speed: 10, seed: 7 });
        g.restore();
      } else if (lt < tRen) {
        // ---- “自”字切近景：侧脸仰头一饮而尽，身后远处的仙岛被一束天光照着 ----
        const ta = lt - tZi;
        g.save();
        zoomAt(g, 1 + 0.03 * ta, 900, 300);
        g.save(); g.translate(760, 300); g.scale(1.55, 1.55); g.translate(-760, -300); g.drawImage(vb3Back(), 0, 0, W, H); g.restore();
        E.mist(g, { t, y: 420, h: 120, color: '#c8d0cc', alpha: 0.3, speed: 8, seed: 9 });
        // 画外左上角那盏灯笼的暖光
        blend(g, 'screen', () => { glow(g, 40, 40, 420, '#ff9a40', 0.28 + 0.06 * be); glow(g, 60, 60, 160, '#ffc070', 0.3); });
        const xs = 5, xo = { pose: 'drink', facing: -1, wind: 0.25, windDir: -1, seed: 4, prop: 'none', head: -0.08 - 0.16 * up(ta, 0, 0.4), rim: '#f0c890', light: [60, 60], rimWidth: 3, rimAlpha: 0.95 };
        const p0 = F.points('xiaoyao', 0, 0, xs, 0, Object.assign({}, xo, { head: -0.08 }));
        const fx = 900 - p0.head[0], fy = 300 - p0.head[1];
        figWarmRim(g, 'xiaoyao', fx, fy, xs, t, xo, -4.5, -3, '#f0c890');
        const hp = F.points('xiaoyao', fx, fy, xs, t, xo);
        // 杯口贴着嘴，越喝杯底翘得越高
        const rot = -2.5 - 0.35 * up(ta, 0, 0.35), ks = 1.1, mt = [hp.mouth[0] - 2, hp.mouth[1] - 4];
        const ox = mt[0] - 40 * ks * Math.sin(rot), oy = mt[1] + 40 * ks * Math.cos(rot);
        g.save(); g.translate(ox, oy); g.rotate(rot); cupSide(g, 0, 0, ks, 0, 0, { noShadow: true }); g.restore();
        blend(g, 'screen', () => glow(g, hp.mouth[0] - 20, hp.mouth[1] - 10, 120, '#f0b070', 0.18));
        g.restore();
      } else {
        // ---- “认”字切进杯里：蛊虫一扭，墨从虫身边化开，倒影一片片褪成灰；“幽”字再扭一下 ----
        const ta = lt - tRen, [tx, ty, trx, tr2] = B3.tea;
        g.save();
        zoomAt(g, 1.0 + 0.05 * clamp(ta / 0.8), 980, 470);
        blitBands(g, vb3Macro(), -60, -60, W + 120, H + 120, [[0, H + 120, true]]);
        const sm0 = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
        const wob = slosh * 3, wx = tx + 150, wy = ty + 50;
        g.save(); g.beginPath(); g.ellipse(tx, ty, trx, tr2, 0, 0, TAU); g.clip();
        g.drawImage(vb3Mem(false), tx - trx + wob, ty - tr2, trx * 2, tr2 * 2);
        // 墨团：从虫身边一层层往外卷开；墨到之处倒影褪成灰
        const ink = (k) => {
          const a0 = h2(k, 21) * TAU, dl = 0.02 + 0.035 * k, gk = easeOut(clamp((ta - dl) / 0.34));
          const d = (30 + 230 * h2(k, 22)) * gk, cu = a0 + (h2(k, 23) - 0.5) * 2.2 * gk;
          return [wx + Math.cos(cu) * d, wy + Math.sin(cu) * d * 0.62, (26 + 170 * h2(k, 24)) * gk + 4 * (k === 0 ? 1 : 0)];
        };
        const NB = 8, blobs = []; for (let k = 0; k < NB; k++) blobs.push(ink(k));
        const all = smooth((ta - 0.16) / 0.26), memG = vb3Mem(true);
        if (all > 0) { g.globalAlpha = all; g.drawImage(memG, tx - trx + wob, ty - tr2, trx * 2, tr2 * 2); g.globalAlpha = 1; }
        if (all < 0.99) for (const [kr, a] of [[1.0, 0.45], [0.78, 0.45], [0.55, 0.6]]) {
          g.save(); g.beginPath();
          for (let k = 0; k < NB; k++) { const [bx, by, br] = blobs[k]; if (br > 3) blobPath(g, bx, by, br * kr, 30 + k, 0.32); }
          g.clip(); g.globalAlpha = a * (1 - all);
          g.drawImage(memG, tx - trx + wob, ty - tr2, trx * 2, tr2 * 2);
          g.restore();
        }
        g.globalAlpha = 1;
        for (let k = 0; k < NB; k++) { const [bx, by, br] = blobs[k]; if (br > 2) glow(g, bx, by, br * 1.15, '#1a141e', (0.12 + 0.18 * h2(k, 25)) * (1 - 0.4 * all)); }
        // 至多三缕细墨丝
        g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const a0 = -0.6 + k * 2.1, gk = easeOut(clamp((ta - 0.05) / 0.5));
          g.strokeStyle = rgba('#120e16', 0.45 * (1 - 0.5 * all)); g.lineWidth = 1.2;
          g.beginPath();
          for (let j = 0; j <= 10; j++) { const u = j / 10, a = a0 + 1.6 * u * u + Math.sin(ta * 2 + k + u * 3) * 0.1, d = 220 * gk * u; const px = wx + Math.cos(a) * d, py = wy + Math.sin(a) * d * 0.62; j ? g.lineTo(px, py) : g.moveTo(px, py); }
          g.stroke();
        }
        // 蛊虫：切进来那一下扭一次，“幽”字再扭
        const tw = Math.sin(clamp(ta / 0.3) * PI) * 1.0 - Math.sin(clamp((lt - tYou) / 0.3) * PI) * 1.2 + Math.sin(clamp((lt - tMo) / 0.3) * PI) * 0.8;
        guWorm(g, wx, wy, 120, t, tw, -0.35 + 0.2 * Math.sin(t * 1.5));
        // 每拍一圈涟漪
        E.ripples(g, { x: wx, y: wy, t, t0: [c.grid ? c.grid.time(c.b.i) : t, c.grid ? c.grid.time(c.b.i - 1) : t - 0.83], scale: 4, ratio: 0.56, color: '#f4e8c8', alpha: 0.4, life: 1.6 });
        g.imageSmoothingEnabled = sm0;
        // 天光在茶面上的一道亮
        blend(g, 'screen', () => { g.globalAlpha = 0.45; g.drawImage(XYT.sprites.tint(XYT.sprites.glow, '#fff6e6'), tx - 340 + wob, ty - 200, 300, 70); g.globalAlpha = 1; });
        g.restore();
        g.strokeStyle = 'rgba(60,46,20,0.45)'; g.lineWidth = 4; g.beginPath(); g.ellipse(tx, ty, trx, tr2, 0, 0, TAU); g.stroke();
        g.restore();
      }
    },
  });

  // ======================================================================
  // 12 第12句 · 岔路红线：雨中岔路口，左路尽头湖畔是白衣灵儿，右路尽头土丘上是红衣月如，各有一束冷光照着；少年两腕各系一根红线，往哪边迈都被另一根拽回，最后被两根线吊起双臂、垂下头
  // ======================================================================
  const B4 = { hz: 300, fork: [628, 646], lake: [262, 334], hill: [1010, 268], S: 1.55,
    puddles: [[598, 694, 70], [770, 680, 40], [520, 566, 26], [742, 566, 22], [452, 480, 14], [824, 476, 13], [600, 612, 22]] };
  const LAKE = [[430, 301], [360, 313], [300, 321], [220, 327], [120, 333], [-20, 341]];
  // 路：中线三次曲线，宽度随远近收窄
  const roadW = (y) => 230 * clamp((y - B4.hz) / (H - B4.hz)) + 6;
  function roadPts(p0, p1, p2, p3, n = 24) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      out.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
    }
    return out;
  }
  const RD_T = roadPts([630, 790], [630, 740], [630, 690], [628, 628], 8);
  const RD_L = roadPts([624, 640], [560, 560], [400, 420], [B4.lake[0] + 40, B4.lake[1] + 2]);
  const RD_R = roadPts([634, 640], [700, 560], [880, 420], [B4.hill[0] - 20, B4.hill[1] + 26]);
  // 土丘上的孤树：几笔墨干、点叶成团，罩一层雨雾
  function inkTree(q, x, y, s, seed, col, haze) {
    const r = A.rng(seed);
    q.strokeStyle = col; q.lineCap = 'round';
    const br = [[0, 0, -1.62, 120, 7], [0, -70, -2.3, 60, 3.5], [2, -96, -0.9, 56, 3], [-6, -40, -0.6, 40, 2.4]];
    const tips = [];
    for (const [bx, by, a, l, w] of br) {
      let px = x + bx * s, py = y + by * s, aa = a;
      for (let k = 0; k < 6; k++) { const nx = px + Math.cos(aa) * l * s / 6, ny = py + Math.sin(aa) * l * s / 6; q.lineWidth = w * s * (1 - k / 8); q.beginPath(); q.moveTo(px, py); q.lineTo(nx, ny); q.stroke(); px = nx; py = ny; aa += (r() - 0.5) * 0.4; }
      tips.push([px, py]);
    }
    for (const [tx, ty] of tips) for (let k = 0; k < 22; k++) {
      q.fillStyle = rgba(r() < 0.5 ? col : mix(col, haze, 0.4), 0.35 + r() * 0.35);
      q.beginPath(); q.ellipse(tx + (r() - 0.5) * 40 * s, ty + (r() - 0.6) * 18 * s, (3 + r() * 6) * s, (2 + r() * 3) * s, (r() - 0.5) * 0.6, 0, TAU); q.fill();
    }
  }
  function roadPoly(q, pts, k = 1) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      const w = roadW(pts[i][1]) * 0.5 * k, nx = -dy / l, ny = dx / l;
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w * 0.35]); R.push([pts[i][0] - nx * w, pts[i][1] - ny * w * 0.35]);
    }
    q.beginPath(); L.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) q.lineTo(R[i][0], R[i][1]); q.closePath();
  }
  // 远山、湖、土丘、雨中的旷野与两条岔路、水洼（静态）
  function vb4Back() {
    return cache('vb4back4', W + 40, H + 40, 1, (q) => {
      q.translate(20, 20);
      const hz = B4.hz;
      q.fillStyle = K.lin(q, 0, -20, 0, hz + 10, [[0, '#5a7088'], [0.5, '#8ca0b2'], [1, '#c4d0da']]); q.fillRect(-20, -20, W + 40, hz + 30);
      E.clouds(q, { t: 0, y: 90, color: '#9aa9b8', shade: '#566676', alpha: 0.8, scale: 1.3, n: 5, seed: 61, speed: 0 });
      // 云缝里漏下的天光
      A.softBlob(q, 330, 120, 200, 0.3, '#e3f0f6'); A.softBlob(q, 980, 110, 200, 0.3, '#e3f0f6');
      E.mountains(q, { t: 0, lightDir: 1, layers: [
        { kind: 'far', color: '#93a4b6', light: '#d8e4ec', litA: 0.4, y: hz + 4, scaleY: 0.3, seed: 21, fog: '#c6d2da', fogA: 0.6 },
        { kind: 'mid', color: '#7a8e9c', light: '#c8d6de', litA: 0.35, y: hz + 8, scaleY: 0.22, seed: 23, offset: 400, fog: '#c2ced6', fogA: 0.55 },
      ] });
      // 旷野：湿草地，远淡近深
      q.fillStyle = K.lin(q, 0, hz, 0, H + 20, [[0, '#9aaca8'], [0.25, '#6e8478'], [0.7, '#4a5e52'], [1, '#33443a']]);
      q.fillRect(-20, hz, W + 40, H + 20 - hz);
      // 左：湖，银灰水面；岸线压在她脚前
      q.fillStyle = K.lin(q, 0, hz, 0, hz + 44, [[0, '#d4e2e8'], [1, '#a4bac4']]);
      q.beginPath(); q.moveTo(-20, hz + 1); LAKE.forEach(([x, y]) => q.lineTo(x, y)); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(60,76,72,0.45)'; q.lineWidth = 1.4; q.beginPath(); LAKE.forEach(([x, y], i) => (i ? q.lineTo(x, y + 1) : q.moveTo(x, y + 1))); q.stroke();
      q.strokeStyle = 'rgba(255,255,255,0.4)'; q.lineWidth = 1;
      for (let k = 0; k < 7; k++) { q.beginPath(); q.moveTo(10 + k * 44, hz + 6 + k * 4); q.lineTo(70 + k * 44, hz + 6 + k * 4); q.stroke(); }
      // 湖边芦苇（让开她站的地方）
      q.strokeStyle = 'rgba(70,86,82,0.7)';
      const r = A.rng(71);
      for (let k = 0; k < 40; k++) { const x = r() < 0.5 ? 60 + r() * 150 : 330 + r() * 120, y = hz + 22 + r() * 30, l = 10 + r() * 18; q.lineWidth = 0.8; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 3, y - l); q.stroke(); }
      // 右：土丘与一棵孤树
      q.fillStyle = K.lin(q, 0, B4.hill[1] - 10, 0, hz + 60, [[0, '#7c8e80'], [1, '#5a6e60']]);
      q.beginPath(); q.moveTo(820, hz + 50); q.quadraticCurveTo(900, B4.hill[1] + 6, B4.hill[0], B4.hill[1]); q.quadraticCurveTo(1120, B4.hill[1] + 4, 1230, hz + 46); q.closePath(); q.fill();
      q.fillStyle = 'rgba(214,226,232,0.35)'; q.beginPath(); q.moveTo(880, hz + 20); q.quadraticCurveTo(950, B4.hill[1] + 8, B4.hill[0], B4.hill[1] + 2); q.lineTo(B4.hill[0], B4.hill[1] + 8); q.quadraticCurveTo(950, B4.hill[1] + 16, 880, hz + 26); q.closePath(); q.fill();
      inkTree(q, 1084, B4.hill[1] + 8, 0.95, 7, '#34443e', '#c6d2da');
      // 地平线上一排雨雾里的远树
      for (let i = 0; i < 26; i++) {
        const x = 440 + i * 18 + r() * 10, hh = 6 + r() * 12;
        q.fillStyle = rgba('#8b9ca6', 0.35 + r() * 0.2); q.beginPath(); q.ellipse(x, hz + 4 - hh * 0.5, 6 + r() * 6, hh, 0, 0, TAU); q.fill();
      }
      // 草的笔触
      for (let k = 0; k < 700; k++) {
        const y = hz + 6 + Math.pow(r(), 1.6) * (H - hz), d = (y - hz) / (H - hz), x = r() * W, l = 3 + d * 22;
        q.strokeStyle = rgba(r() < 0.5 ? '#2e4034' : '#8ea494', 0.25 + 0.3 * r()); q.lineWidth = 0.6 + d * 1.4;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x + (r() - 0.4) * l * 0.4, y - l); q.stroke();
      }
      // 两条路：湿泥土路，路肩软边，远处没入雾
      for (const pts of [RD_T, RD_L, RD_R]) { roadPoly(q, pts, 1.25); q.fillStyle = 'rgba(52,62,56,0.25)'; q.fill(); }
      for (const pts of [RD_T, RD_L, RD_R]) { roadPoly(q, pts, 1.1); q.fillStyle = 'rgba(70,78,72,0.45)'; q.fill(); }
      for (const pts of [RD_T, RD_L, RD_R]) { roadPoly(q, pts); q.fillStyle = K.lin(q, 0, hz, 0, H, [[0, '#a8aea8'], [0.3, '#86847a'], [1, '#625e54']]); q.fill(); }
      for (const pts of [RD_T, RD_L, RD_R]) {
        q.save(); roadPoly(q, pts); q.clip();
        for (let k = 0; k < 40; k++) {
          const i = Math.floor(r() * pts.length), [px, py] = pts[i], w = roadW(py);
          q.fillStyle = rgba(r() < 0.65 ? '#4e4a42' : '#b4bec2', r() < 0.65 ? 0.1 + r() * 0.12 : 0.05 + r() * 0.07);
          q.beginPath(); q.ellipse(px + (r() - 0.5) * w * 0.7, py + (r() - 0.5) * 10, w * (0.1 + r() * 0.2), w * 0.03 + 1, 0, 0, TAU); q.fill();
        }
        for (const off of [-0.2, 0.2]) {
          q.strokeStyle = 'rgba(66,62,54,0.22)'; q.lineWidth = 1.6; q.beginPath();
          pts.forEach((p, i) => { const x = p[0] + off * roadW(p[1]) + Math.sin(i * 0.9 + off * 9) * roadW(p[1]) * 0.04; i ? q.lineTo(x, p[1]) : q.moveTo(x, p[1]); }); q.stroke();
        }
        q.restore();
      }
      // 水洼：映着阴沉的天，比天略暗，边缘软，不描边
      for (const [x, y, rx] of B4.puddles) {
        q.save(); q.translate(x, y); q.scale(1, 0.2);
        const gr = q.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx);
        gr.addColorStop(0, 'rgba(150,168,184,0.7)'); gr.addColorStop(0.75, 'rgba(140,158,172,0.55)'); gr.addColorStop(1, 'rgba(120,136,148,0)');
        q.fillStyle = gr; q.beginPath(); q.arc(0, 0, rx, 0, TAU); q.fill();
        q.fillStyle = 'rgba(200,214,224,0.35)'; q.beginPath(); q.ellipse(0, -rx * 0.35, rx * 0.7, rx * 0.35, 0, 0, TAU); q.fill();
        q.restore();
      }
      // 地平线上的雾
      q.fillStyle = K.lin(q, 0, hz - 30, 0, hz + 70, [[0, 'rgba(200,212,220,0)'], [0.4, 'rgba(200,212,220,0.75)'], [1, 'rgba(200,212,220,0)']]); q.fillRect(-20, hz - 30, W + 40, 100);
    });
  }
  // 两束冷光：左照湖畔，右照土丘（各一张，只截光束所在的那一竖条，好分开调亮暗、也省得整屏混合）
  const RAYBOX = [[150, 0, 300, 420], [840, 0, 300, 360]];
  function vb4Ray(side) {
    const [bx, by, bw, bh] = RAYBOX[side];
    return cache('vb4rayB' + side, bw, bh, 0.35, (q) => {
      q.translate(-bx, -by);
      const o = side ? { x: 980, y: 20, angle: 1.62 } : { x: 300, y: 30, angle: 1.66 };
      V.godRays(q, { t: 1, lt: 0 }, { x: o.x, y: o.y, angle: o.angle, spread: 0.13, n: 3, len: 360, start: 0.15, color: '#eef6fa', alpha: 0.6, res: 0.35, beat: 0, night: false, blend: 'lighter' });
    });
  }
  // 横向可接缝的雨雾带（一张，滚动着贴）
  function vb4Mist() {
    return cache('vb4mist', 1280, 150, 0.4, (q) => {
      const r = A.rng(17);
      for (let i = 0; i < 40; i++) {
        const x = r() * 1280, y = 50 + r() * 50, R = 50 + r() * 70;
        for (const dx of [-1280, 0, 1280]) A.softBlob(q, x + dx, y, R, 0.28 + 0.2 * r(), '#c8d4dc');
      }
    });
  }
  // 一道斜斜的雨幕（静态贴图，左右漂）
  function vb4Curtain() {
    return cache('vb4curtain', 260, 760, 0.3, (q) => {
      const r = A.rng(29);
      const gr = q.createLinearGradient(0, 0, 260, 0);
      gr.addColorStop(0, 'rgba(210,222,230,0)'); gr.addColorStop(0.5, 'rgba(210,222,230,0.7)'); gr.addColorStop(1, 'rgba(210,222,230,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 260, 760);
      q.strokeStyle = 'rgba(236,244,248,0.6)'; q.lineWidth = 2;
      for (let i = 0; i < 60; i++) { const x = 30 + r() * 200, y = r() * 760; q.beginPath(); q.moveTo(x, y); q.lineTo(x - 14, y + 60); q.stroke(); }
    });
  }
  // 近处两角的湿草（失焦、深色）
  function vb4Grass(seed) {
    return cache('vb4grass' + seed, 360, 260, 0.6, (q) => {
      const r = A.rng(seed);
      q.lineCap = 'round';
      for (let k = 0; k < 46; k++) {
        const bx = r() * 360, l = 90 + r() * 170, a = -PI / 2 + (r() - 0.5) * 0.7;
        q.strokeStyle = rgba(r() < 0.6 ? '#1c2620' : '#34463a', 0.9); q.lineWidth = 2 + r() * 4;
        q.beginPath(); q.moveTo(bx, 262); q.quadraticCurveTo(bx + Math.cos(a) * l * 0.4, 262 + Math.sin(a) * l * 0.6, bx + Math.cos(a) * l, 262 + Math.sin(a) * l); q.stroke();
      }
    });
  }
  // 红线的中线：slack 松紧（0 绷直），twang 弹一下的余振（像素）
  function threadPts(a, b, slack, twang, t) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L, pts = [];
    for (let i = 0; i <= 32; i++) {
      const u = i / 32, sag = slack * L * 0.16 * 4 * u * (1 - u);
      const wv = twang * Math.sin(PI * u) * Math.sin(t * 46) + Math.sin(u * 9 - t * 2.2) * 2 * slack;
      pts.push([lerp(a[0], b[0], u) + nx * wv, lerp(a[1], b[1], u) + ny * wv + sag]);
    }
    return pts;
  }
  function redThread(g, pts, alpha, hot) {
    const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    blend(g, 'screen', () => { path(); g.strokeStyle = rgba('#ff4a30', clamp((0.22 + 0.5 * hot) * alpha)); g.lineWidth = 9 + 6 * hot; g.stroke(); });
    path(); g.strokeStyle = rgba('#c8261e', 0.95 * alpha); g.lineWidth = 2.2; g.stroke();
    blend(g, 'screen', () => { path(); g.strokeStyle = rgba('#ffb0a0', (0.5 + 0.4 * hot) * alpha); g.lineWidth = 0.8 + hot; g.stroke(); });
    // 线上挂着的雨珠
    blend(g, 'screen', () => { for (let k = 0; k < 6; k++) { const p = pts[4 + k * 5]; glow(g, p[0], p[1] + 2, 3.2, '#ffffff', 0.7 * alpha); } });
  }

  XYT.registerShot('vb4_crossroad', {
    name: '岔路红线', zone: 'top', night: false,
    text: '#1a2026', shadow: 'rgba(226,234,238,0.85)', accent: '#c83c23', bloom: 0.25,
    draw(g, c) {
      const t = c.t, lt = c.lt, S4 = B4.S;
      const tXiang = ct(c, 0, 0.24), tDuo = ct(c, 3, 1.46), tYou = ct(c, 4, 1.74), tDe = ct(c, 6, 2.72), tWo = ct(c, 7, 3.12);
      // 轻微的手持感（只平移）
      const jx = (noise1(t * 1.3, 7) - 0.5) * 6, jy = (noise1(t * 1.1, 8) - 0.5) * 4;
      g.save();
      g.translate(640 + jx, 400 + jy); g.scale(1.03, 1.03); g.translate(-640, -400);
      blitBands(g, vb4Back(), -20, -20, W + 40, H + 40, [[0, 300, true], [300, H + 40, false]]);
      // ---- 少年：先算他在哪、什么姿势 ----
      const [fx, fy] = B4.fork, ws = F.walkSpeed('xiaoyao', S4, {}) * 0.7;
      const xL = fx - ws * (tDuo - tXiang), xBack1 = lerp(xL, fx, 0.85), tTurn = tYou + 0.12, xR = xBack1 + ws * (tDe - tTurn), xBack2 = lerp(xR, fx + 8, 0.8);
      let x = fx, y = fy, xp;
      const yank = (t0, a, b) => { const u = clamp((lt - t0) / 0.45); return [lerp(a, b, easeOut(u)), -6 * Math.sin(PI * clamp((lt - t0) / 0.16))]; };
      if (lt < tXiang) xp = { pose: 'stand', facing: -1, head: 0.05 };
      else if (lt < tDuo) { xp = { pose: 'walk', facing: -1, speed: 0.7 }; x = fx - ws * (lt - tXiang); }
      else if (lt < tYou) { const [xx, hop] = yank(tDuo, xL, xBack1); x = xx; y += hop; xp = { pose: 'reach', facing: -1, lean: -0.35 * Math.exp(-(lt - tDuo) / 0.35), head: -0.05 }; }
      else if (lt < tTurn) { x = xBack1; xp = { pose: 'lookBack', facing: -1 }; }
      else if (lt < tDe) { xp = { pose: 'walk', facing: 1, speed: 0.7 }; x = xBack1 + ws * (lt - tTurn); }
      else if (lt < tWo) { const [xx, hop] = yank(tDe, xR, xBack2); x = xx; y += hop; xp = { pose: 'reach', facing: 1, lean: -0.35 * Math.exp(-(lt - tDe) / 0.35), head: -0.05 }; }
      else { x = xBack2 + 2 * Math.sin((lt - tWo) * 60) * Math.exp(-(lt - tWo) / 0.25); xp = { pose: 'summon', facing: 1, head: 0.75 * up(lt, tWo, 0.35), lean: 0.06 * up(lt, tWo, 0.4) }; }
      const xo = Object.assign({ wind: 0.55, windDir: 1, seed: 11 }, xp);
      const P = F.points('xiaoyao', x, y, S4, t, xo);
      // 左腕永远牵灵儿：朝左时是近手，朝右时是远手
      const hL = xo.facing < 0 ? P.handN : P.handF, hR = xo.facing < 0 ? P.handF : P.handN;
      const stepL = lt > tXiang && lt < tDuo, stepR = lt > tTurn && lt < tDe;
      // ---- 两束冷光与脚下的光斑：他往哪边迈，哪边亮一些；“我”字两边都暗下去 ----
      const dim = 1 - 0.4 * up(lt, tWo, 0.4);
      const kL = (0.6 + 0.24 * (stepL ? up(lt, tXiang, 0.4) : 0)) * dim, kR = (0.6 + 0.24 * (stepR ? up(lt, tTurn, 0.4) : 0)) * dim;
      blend(g, 'screen', () => {
        for (const sd of [0, 1]) { const [bx, by, bw, bh] = RAYBOX[sd]; g.globalAlpha = sd ? kR : kL; g.drawImage(vb4Ray(sd), bx, by, bw, bh); }
        g.globalAlpha = 1;
        g.save(); g.translate(B4.lake[0], B4.lake[1] + 2); g.scale(1, 0.28); glow(g, 0, 0, 70, '#eef6fa', 0.55 * kL); g.restore();
        g.save(); g.translate(B4.hill[0], B4.hill[1] + 2); g.scale(1, 0.28); glow(g, 0, 0, 64, '#eef6fa', 0.55 * kR); g.restore();
      });
      // 雨雾带（一张贴图滚动）
      const mi = vb4Mist(), mo = ((t * 6) % 1280 + 1280) % 1280;
      g.imageSmoothingEnabled = false; g.globalAlpha = 0.55; g.drawImage(mi, -mo, B4.hz - 55, 1280, 150); g.drawImage(mi, 1280 - mo, B4.hz - 55, 1280, 150); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
      // ---- 远处两人：灵儿“由”“得”两字低下头；月如原本望着远处，“多”字回过头看他，“由”字转身朝他 ----
      const lgo = { pose: 'stand', facing: 1, wind: 0.6, windDir: 1, seed: 3, head: 0.3 * up(lt, tYou, 0.4) + 0.25 * up(lt, tDe, 0.4) };
      const yro = lt < tDuo ? { pose: 'stand', facing: 1, wind: 0.6, windDir: 1, seed: 6, head: -0.05 } : lt < tYou ? { pose: 'lookBack', facing: 1, wind: 0.6, windDir: 1, seed: 6 } : { pose: 'stand', facing: -1, wind: 0.6, windDir: 1, seed: 6 };
      F.draw(g, 'linger', B4.lake[0], B4.lake[1], 0.42, t, lgo);
      F.draw(g, 'yueru', B4.hill[0], B4.hill[1], 0.4, t, yro);
      const pL = F.points('linger', B4.lake[0], B4.lake[1], 0.42, t, lgo).handN, pY = F.points('yueru', B4.hill[0], B4.hill[1], 0.4, t, yro).handN;
      // ---- 红线：松紧与弹振 ----
      const tw = (t0, d = 0.5) => (lt > t0 && lt - t0 < 2 ? Math.exp(-(lt - t0) / d) : 0);
      const slR = lt < tXiang ? 0.55 : lt < tDuo ? lerp(0.55, 0, smooth((lt - tXiang) / (tDuo - tXiang))) : lt < tTurn ? 0.12 : lt < tDe ? lerp(0.15, 0.6, up(lt, tTurn, 0.6)) : lt < tWo ? 0.35 : 0.02;
      const slL = lt < tXiang ? 0.55 : lt < tDuo ? lerp(0.55, 0.85, up(lt, tXiang, 0.8)) : lt < tTurn ? 0.45 : lt < tDe ? lerp(0.45, 0, smooth((lt - tTurn) / (tDe - tTurn))) : lt < tWo ? 0.12 : 0.02;
      const twR = 24 * tw(tDuo) + 20 * tw(tWo), twL = 24 * tw(tDe) + 20 * tw(tWo + 0.05);
      const ptsL = threadPts(hL, pL, slL, twL, t), ptsR = threadPts(hR, pY, slR, twR, t + 0.4);
      // ---- 近处的两个水洼里倒映着他和红线（压扁、倒过来） ----
      for (const [px, py, rx] of B4.puddles.slice(0, 2)) {
        g.save(); g.beginPath(); g.ellipse(px, py, rx * 0.92, rx * 0.18, 0, 0, TAU); g.clip();
        g.globalAlpha = 0.6; g.translate(0, fy * 1.35); g.scale(1, -0.35);
        F.draw(g, 'xiaoyao', x, fy, S4, t, xo);
        g.strokeStyle = 'rgba(200,40,30,0.9)'; g.lineWidth = 2.4;
        for (const ps of [ptsL, ptsR]) { g.beginPath(); ps.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
        g.restore();
      }
      // ---- 红线与少年 ----
      redThread(g, ptsL, 0.95, clamp(twL / 24));
      redThread(g, ptsR, 0.95, clamp(twR / 24));
      F.draw(g, 'xiaoyao', x, y, S4, t, xo);
      // 腕上的红结；线一绷，腕上闪一下
      for (const h of [hL, hR]) { g.fillStyle = '#d02a20'; g.beginPath(); g.arc(h[0], h[1], 3.2, 0, TAU); g.fill(); }
      blend(g, 'screen', () => { glow(g, hR[0], hR[1], 34, '#ff6040', 0.7 * clamp(twR / 20)); glow(g, hL[0], hL[1], 34, '#ff6040', 0.7 * clamp(twL / 20)); });
      // 被拽回时脚下溅起的泥水
      for (const t0 of [tDuo, tDe]) {
        const d = lt - t0;
        if (d > 0 && d < 0.5) for (let k = 0; k < 8; k++) {
          const a = -PI / 2 + (h2(k, 91) - 0.5) * 2.4, v = 120 + 120 * h2(k, 92);
          const sx = P.footN[0] + (h2(k, 93) - 0.5) * 30 + Math.cos(a) * v * d, sy = fy - 2 + Math.sin(a) * v * d + 600 * d * d;
          if (sy < fy + 4) { g.fillStyle = rgba('#c8d2d6', 0.7 * (1 - d / 0.5)); g.beginPath(); g.arc(sx, sy, 1.8, 0, TAU); g.fill(); }
        }
      }
      // ---- 雨：斜雨丝、两三道飘移的雨幕；水洼随拍起涟漪，路面随拍溅起小水冠 ----
      const beats = c.grid ? [c.grid.time(c.b.i), c.grid.time(c.b.i - 1), c.grid.time(c.b.i - 2)] : [t, t - 0.83];
      B4.puddles.forEach(([px, py, rx], i) => {
        E.ripples(g, { x: px + (h2(i, 3) - 0.5) * rx * 0.6, y: py, t, t0: beats.map((b) => b + h2(i, 4) * 0.25), scale: rx / 40, ratio: 0.2, color: '#eef4f6', alpha: 0.5, life: 1.2, rings: 2 });
      });
      const sb = sinceBeat(c);
      if (sb < 0.22) {
        const bi = c.b ? c.b.i : 0;
        g.strokeStyle = rgba('#e4ecf0', 0.7 * (1 - sb / 0.22)); g.lineWidth = 1;
        for (let k = 0; k < 7; k++) {
          const pts = k % 2 ? RD_L : RD_R, j = 6 + Math.floor(h2(k, bi) * 12), [px, py] = pts[j], w = roadW(py) * (h2(k, bi + 7) - 0.5) * 0.8, r = (2 + 6 * (sb / 0.22)) * (py / 600);
          g.beginPath(); g.ellipse(px + w, py, r * 1.6, r * 0.5, 0, PI, TAU); g.stroke();
          for (let m = -1; m <= 1; m++) { g.beginPath(); g.moveTo(px + w + m * r, py - r * 0.3); g.lineTo(px + w + m * r * 1.4, py - r * 1.4); g.stroke(); }
        }
      }
      const cu = vb4Curtain();
      g.imageSmoothingEnabled = false;
      for (let k = 0; k < 2; k++) {
        const cx = ((h2(k, 5) * 1500 + t * (30 + 24 * k)) % 1600) - 200;
        g.globalAlpha = 0.1 + 0.05 * k; g.drawImage(cu, cx, -20, 220 + 60 * k, 760);
      }
      g.globalAlpha = 1; g.imageSmoothingEnabled = true;
      V.rain(g, c, { n: 220, angle: 0.22, speed: 900, len: 42, color: '#d6e2ea', alpha: 0.45, night: false });
      // 近处两角的湿草，随风摆
      const sw = 0.05 * Math.sin(t * 1.3) + 0.03 * c.be(0.3);
      g.save(); g.translate(120, 740); g.transform(1, 0, sw, 1, 0, 0); g.drawImage(vb4Grass(3), -180, -270, 360, 270); g.restore();
      g.save(); g.translate(1180, 740); g.transform(1, 0, sw * 1.2, 1, 0, 0); g.scale(-1, 1); g.drawImage(vb4Grass(9), -180, -260, 360, 260); g.restore();
      g.restore();
    },
  });
})();
