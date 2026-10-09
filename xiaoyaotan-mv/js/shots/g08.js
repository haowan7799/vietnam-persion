/* 分镜镜头 第 08 组：间奏三镜（枫落秋池、女娲时轮、长卷故地）与主歌B2前两句（孤舟归岛、空台系绸） */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 通用小工具 ----------
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const bump = (x, a, b, c) => seg(x, a, b) * (1 - seg(x, b, c));
  const tintS = (col) => XYT.sprites.tint(XYT.sprites.glow, col);
  // 柔光点：透明度乘在当前 globalAlpha 上
  function dot(g, x, y, r, col, a, op) {
    if (!(a > 0.003) || !(r > 0.2)) return;
    const o = g.globalCompositeOperation, ga = g.globalAlpha;
    g.globalCompositeOperation = op || 'lighter'; g.globalAlpha = ga * Math.min(1, a);
    g.drawImage(tintS(col), x - r, y - r, r * 2, r * 2);
    g.globalCompositeOperation = o; g.globalAlpha = ga;
  }
  // 压扁的柔光（水面反光、地上的光斑）
  function oval(g, x, y, rx, ry, col, a, op) {
    if (!(a > 0.003)) return;
    const o = g.globalCompositeOperation, ga = g.globalAlpha;
    g.globalCompositeOperation = op || 'lighter'; g.globalAlpha = ga * Math.min(1, a);
    g.drawImage(tintS(col), x - rx, y - ry, rx * 2, ry * 2);
    g.globalCompositeOperation = o; g.globalAlpha = ga;
  }
  // 本句第 k 字相对镜头起点的时间；取不到时用实测表
  function charAt(c, k, table) {
    const v = c.charT ? c.charT(k) : null;
    return v == null ? table[Math.min(k, table.length - 1)] : v - (c.t - c.lt);
  }
  function chars(c, table) { const out = []; for (let k = 0; k < table.length; k++) out.push(charAt(c, k, table)); return out; }
  // 题字：书法字体就绪后缓存键改变，自动重画
  const GLY = '南诏锁妖塔林家堡余杭仙灵岛比武招亲故地酒逍遥';
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', GLY).catch(() => {}); } catch (e) { /* 无字体接口 */ }
  let fontReady = false;
  const fontK = () => {
    if (fontReady) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', GLY)) { fontReady = true; return 'f'; } } catch (e) { /* 无字体接口 */ }
    return 'n';
  };

  // 枫叶：五裂掌状，叶缘细锯齿；(x, y) 为叶心，s 半径，c1 叶心色、c2 叶缘色
  function maplePath(g, x, y, s, rot) {
    const L = [[-PI / 2, 1], [-PI / 2 - 0.86, 0.88], [-PI / 2 + 0.86, 0.88], [-PI / 2 - 1.72, 0.56], [-PI / 2 + 1.72, 0.56]];
    g.beginPath();
    const n = 110;
    for (let i = 0; i <= n; i++) {
      const th = -PI / 2 + (i / n) * TAU;
      let r = 0.3;
      for (const [a, l] of L) { const d = Math.cos(th - a); if (d > 0) r = Math.max(r, l * Math.pow(d, 5.5)); }
      // 叶柄处收口
      const db = Math.cos(th - PI / 2); if (db > 0.92) r = Math.min(r, 0.2 + (1 - db) * 2);
      r *= 1 + 0.05 * Math.sin(th * 30) * clamp((r - 0.34) * 2.5);
      const px = x + Math.cos(th + rot) * r * s, py = y + Math.sin(th + rot) * r * s;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }
  function mapleLeaf(g, x, y, s, rot, c1, c2, vein) {
    maplePath(g, x, y, s, rot);
    const gr = g.createRadialGradient(x, y + s * 0.1, s * 0.05, x, y, s);
    gr.addColorStop(0, c1); gr.addColorStop(0.55, mix(c1, c2, 0.6)); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fill();
    if (vein) {
      g.strokeStyle = rgba(vein, 0.55); g.lineWidth = Math.max(0.6, s * 0.035); g.lineCap = 'round';
      for (const a of [-PI / 2, -PI / 2 - 0.82, -PI / 2 + 0.82, -PI / 2 - 1.62, -PI / 2 + 1.62]) {
        const l = Math.abs(a + PI / 2) > 1.2 ? 0.5 : 0.82;
        g.beginPath(); g.moveTo(x, y + s * 0.08); g.lineTo(x + Math.cos(a + rot) * s * l, y + Math.sin(a + rot) * s * l); g.stroke();
      }
      g.lineWidth = Math.max(0.8, s * 0.05);
      g.beginPath(); g.moveTo(x, y + s * 0.1); g.lineTo(x + Math.cos(PI / 2 + rot) * s * 0.55, y + Math.sin(PI / 2 + rot) * s * 0.55); g.stroke();
    }
  }
  // 叶片贴图（64 见方，叶心在 (32, 30)，半径 26）
  const LEAFC = [
    ['#f0a040', '#dc3023'], ['#e2702a', '#a8281c'], ['#c8862e', '#9c5333'], ['#b8763a', '#7a3a1c'],
    ['#d89a4a', '#b0502a'], ['#a46a3a', '#5e2e18'],
  ];
  function leafTex(k) {
    const [c1, c2] = LEAFC[k % LEAFC.length];
    return K.cache('g08|leaf' + k, 64, 64, 1, (q) => mapleLeaf(q, 32, 30, 26, 0, c1, c2, mix(c2, '#2a0a06', 0.5)));
  }
  // 贴一片叶：rot 旋转，fx 翻面（-1..1），sy 透视压扁
  function putLeaf(g, tex, x, y, s, rot, fx, sy, a) {
    if (a <= 0.01) return;
    const ga = g.globalAlpha;
    g.save(); g.translate(x, y); g.scale(1, sy); g.rotate(rot); g.scale(fx, 1);
    g.globalAlpha = ga * a;
    g.drawImage(tex, -s * 32 / 26, -s * 30 / 26, s * 64 / 26, s * 64 / 26);
    g.restore();
  }
  // 同上，但不用 save/restore：以底层变换 m 直接 setTransform（大量叶片时省时）；用完请 g.setTransform(m)
  function putLeafM(g, m, tex, x, y, s, rot, fx, sy, a) {
    if (a <= 0.01) return;
    const e = m.a * x + m.c * y + m.e, f = m.b * x + m.d * y + m.f;
    const c0 = m.c * sy, d0 = m.d * sy, cs = Math.cos(rot), sn = Math.sin(rot);
    const A1 = (m.a * cs + c0 * sn) * fx, B1 = (m.b * cs + d0 * sn) * fx, C1 = -m.a * sn + c0 * cs, D1 = -m.b * sn + d0 * cs;
    g.setTransform(A1, B1, C1, D1, e, f);
    const ga = g.globalAlpha;
    g.globalAlpha = ga * a;
    g.drawImage(tex, -s * 32 / 26, -s * 30 / 26, s * 64 / 26, s * 64 / 26);
    g.globalAlpha = ga;
  }
  // 本镜头内的拍点（相对镜头起点的秒数）：由节拍网格现算，重新分析音频后自动对齐
  const beatMemo = new WeakMap();
  function shotBeats(c) {
    const G = c.grid, st = c.t - c.lt;
    if (!G || !G.pos) return [];
    let m = beatMemo.get(G);
    if (!m) { m = new Map(); beatMemo.set(G, m); }
    const key = st.toFixed(3) + '|' + c.dur.toFixed(3);
    let r = m.get(key);
    if (r) return r;
    r = [];
    for (let i = Math.floor(G.pos(st - 1.5)); i < 100000; i++) {
      const bt = G.time(i);
      if (bt > st + c.dur + 1.5) break;
      r.push({ lt: bt - st, down: G.isDown(i) });
    }
    if (m.size > 60) m.clear();
    m.set(key, r);
    return r;
  }
  // 从 a 秒起的第 k 个拍点（down 为真只数强拍）；网格不可用时按 fb 秒兜底
  function beatAt(c, a, k, down, fb) {
    let n = 0;
    for (const b of shotBeats(c)) {
      if (b.lt < a - 1e-3 || (down && !b.down)) continue;
      if (n++ === k) return b.lt;
    }
    return fb;
  }

  // =====================================================================
  // 间奏 x1 枫落秋池：客栈后院的雨水洼，最后一片红枫落进去，延时到结霜
  // =====================================================================
  // 低机位：地平线 y=110（地面 y = 110 + 1792/z）
  const X1 = { pc: [470, 566], rx: 330, py: 0.31, wallY: 98, baseY: 226, well: [1072, 446], A1: 590 };
  const X1B = [96, 446, 924, 240];                   // 水洼贴图范围
  const x1Gy = (z) => 110 + 1792 / z, x1Gx = (X, z) => 640 + (X * 1280) / z;
  const wrapA = (a) => ((((a + PI) % TAU) + TAU) % TAU) - PI;
  // 水洼轮廓：几个椭圆并起来（三处鼓包、两道凹腰），沿射线取最外的边，再抹圆；另有两小摊积水
  const X1E = [[0, 0, 0.8, 0.62], [-0.6, 0.3, 0.44, 0.38], [0.5, -0.24, 0.46, 0.42], [0.62, 0.24, 0.36, 0.36], [-0.32, -0.42, 0.34, 0.26], [0.18, 0.46, 0.44, 0.28]];
  const X1SAT = [];
  let x1RT = null;
  function x1RTab() {
    if (x1RT) return x1RT;
    const n = 360, raw = new Float32Array(n), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU, ca = Math.cos(th), sa = Math.sin(th);
      let best = 0.3;
      for (let d = 1.6; d > 0.3; d -= 0.005) {
        const x = ca * d, y = sa * d;
        if (X1E.some(([ex, ey, ax, ay]) => ((x - ex) / ax) ** 2 + ((y - ey) / ay) ** 2 < 1)) { best = d; break; }
      }
      raw[i] = best;
    }
    for (let i = 0; i < n; i++) {
      let sm = 0; for (let k = -7; k <= 7; k++) sm += raw[(i + k + n) % n];
      const th = (i / n) * TAU;
      out[i] = (sm / 15) * (1 + 0.035 * (A.noise2(Math.cos(th) * 2.2 + 5, Math.sin(th) * 2.2 + 5, 7) - 0.5) * 2);
    }
    x1RT = out;
    return out;
  }
  const x1R = (th) => { const T = x1RTab(), n = T.length; let f = ((((th / TAU) % 1) + 1) % 1) * n; const i = Math.floor(f); f -= i; return T[i % n] * (1 - f) + T[(i + 1) % n] * f; };
  const x1P = (th, k = 1) => { const r = x1R(th) * k * X1.rx; return [X1.pc[0] + Math.cos(th) * r, X1.pc[1] + Math.sin(th) * r * X1.py]; };
  function x1Path(g, k = 1, a0 = 0, a1 = TAU, close = true) {
    const n = Math.max(8, Math.round(((a1 - a0) / TAU) * 200));
    g.beginPath();
    for (let i = 0; i <= n; i++) { const [x, y] = x1P(a0 + ((a1 - a0) * i) / n, k); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    if (close) g.closePath();
  }
  function x1PathAll(g, k = 1) { x1Path(g, k); for (const [x, y, a, b] of X1SAT) { g.moveTo(x + a * k, y); g.ellipse(x, y, a * k, b * k, 0, 0, TAU); } }
  // 点在水洼里的“深度”：0 在中心，1 在岸线
  const x1U = (x, y) => { const dx = (x - X1.pc[0]) / X1.rx, dy = (y - X1.pc[1]) / (X1.rx * X1.py); return Math.hypot(dx, dy) / x1R(Math.atan2(dy, dx)); };
  const shade6 = (c, k) => (k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k));

  // 水洼遮罩；masked() 把画好的内容按水洼形状裁好（只在建缓存时裁一次）
  function x1Mask() { return K.cache('g08|x1mask', X1B[2], X1B[3], 1, (q) => { q.translate(-X1B[0], -X1B[1]); q.fillStyle = '#fff'; x1PathAll(q); q.fill(); }); }
  function x1Clip(q) { q.globalCompositeOperation = 'destination-in'; q.drawImage(x1Mask(), 0, 0, X1B[2], X1B[3]); q.globalCompositeOperation = 'source-over'; }

  // 马头墙：五级跌落，每级顶上一道黛瓦压顶，檐角起翘
  function x1Gable(q, x0, w, top, base, col, cap) {
    const st = [[0, 0.17, 2], [0.17, 0.34, 1], [0.34, 0.66, 0], [0.66, 0.83, 1], [0.83, 1, 2]];
    q.fillStyle = col;
    q.beginPath(); q.moveTo(x0, base);
    for (const [a, b, l] of st) { const y = top + l * 34; q.lineTo(x0 + w * a, y); q.lineTo(x0 + w * b, y); }
    q.lineTo(x0 + w, base); q.closePath(); q.fill();
    q.fillStyle = cap;
    for (const [a, b, l] of st) {
      const y = top + l * 34, xa = x0 + w * a - 6, xb = x0 + w * b + 6;
      q.beginPath(); q.moveTo(xa, y + 1); q.lineTo(xa - 4, y - 13); q.quadraticCurveTo(xa + 4, y - 8, xa + 10, y - 8); q.lineTo(xb - 10, y - 8); q.quadraticCurveTo(xb - 4, y - 8, xb + 4, y - 13); q.lineTo(xb, y + 1); q.closePath(); q.fill();
    }
  }
  // 墙后远景（雨雾里的老树、马头墙、客栈后楼的暖窗），屏幕坐标；局部 y = 屏幕 y + 230
  function x1FarBody(q) {
    const r = A.rng(5150);
    // 老树：墙后一团灰绿的树冠
    q.fillStyle = '#7f8f8c';
    for (let k = 0; k < 14; k++) { A.inkBlob(q, 70 + k * 26 + r() * 24, -40 + r() * 100 + Math.abs(k - 7) * 10, 46 + r() * 34, k + 3, 0.4); q.fill(); }
    q.fillStyle = '#5f6d6a'; q.fillRect(232, 0, 13, 110);
    q.strokeStyle = '#5f6d6a'; q.lineWidth = 6; q.lineCap = 'round'; q.beginPath(); q.moveTo(238, 40); q.quadraticCurveTo(270, 10, 312, -6); q.stroke();
    // 两座马头墙：一远一近
    x1Gable(q, 880, 360, -60, 110, '#cdd2ce', '#535c61');
    x1Gable(q, 640, 250, 12, 110, '#d8dbd5', '#454e53');
    // 客栈后楼：深色檐口，二楼一扇亮着的窗
    q.fillStyle = '#58636a';
    q.beginPath(); q.moveTo(1080, 26); q.quadraticCurveTo(1180, 34, 1290, 20); q.lineTo(1290, 44); q.quadraticCurveTo(1180, 56, 1080, 46); q.closePath(); q.fill();
    q.fillStyle = '#c7cbc5'; q.fillRect(1094, 44, 200, 70);
    q.fillStyle = '#4c555a'; q.fillRect(1150, 56, 46, 34);
    q.fillStyle = '#e6ad66'; q.fillRect(1154, 60, 38, 26);
    q.strokeStyle = '#6a5440'; q.lineWidth = 1.2;
    for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(1154 + k * 9.5, 60); q.lineTo(1154 + k * 9.5, 86); q.stroke(); }
    q.beginPath(); q.moveTo(1154, 73); q.lineTo(1192, 73); q.stroke();
    q.globalCompositeOperation = 'lighter'; A.softBlob(q, 1173, 73, 70, 0.3, '#ffae58'); q.globalCompositeOperation = 'source-over';
    // 墙头露出的一丛竹
    E.bamboo(q, { t: 0, x0: 420, x1: 600, y: 110, h: 170, n: 5, color: '#6c7f76', haze: '#b8c2bf', wind: 0, w: 5, seed: 9 });
  }
  function x1Far() {
    return K.cache('g08|x1far', W, 470, 1, (q) => {
      // 远处的东西柔一点（1.5px 失焦），再罩 0.3 的雨雾；墙本身清楚
      const soft = K.cache('g08|x1farS', W, 470, 0.6, (p) => { p.translate(0, 230); x1FarBody(p); });
      q.filter = 'blur(1.5px)'; q.drawImage(soft, 0, 0, W, 470); q.filter = 'none';
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = K.lin(q, 0, 100, 0, 340, [[0, 'rgba(214,220,219,0.1)'], [1, 'rgba(214,220,219,0.32)']]); q.fillRect(0, 0, W, 470);
      q.globalCompositeOperation = 'source-over';
      q.translate(0, 230);
      E.courtyardWall(q, { x: -40, y: X1.wallY, w: W + 80, h: X1.baseY - X1.wallY, color: '#e2e4de', roof: '#3f474d', cap: 22, seed: 7, window: 'lattice', winX: 400, winY: 158, winR: 44,
        through(p) {
          // 花窗里是客栈后屋，一盏灯亮着：冷景里唯一的暖点
          p.fillStyle = K.lin(p, 0, 114, 0, 202, [[0, '#d99a58'], [1, '#7a4a28']]); p.fillRect(350, 108, 100, 100);
          p.globalCompositeOperation = 'lighter'; A.softBlob(p, 412, 150, 46, 0.5, '#ffc070'); p.globalCompositeOperation = 'source-over';
        } });
      q.globalCompositeOperation = 'lighter'; A.softBlob(q, 400, 158, 96, 0.16, '#ffb060'); q.globalCompositeOperation = 'source-over';
      // 墙面雨痕
      const r = A.rng(77);
      for (let k = 0; k < 40; k++) { const x = r() * W, w = 2 + r() * 7; q.fillStyle = K.lin(q, 0, X1.wallY + 20, 0, X1.baseY, [[0, 'rgba(90,100,100,0.16)'], [1, 'rgba(90,100,100,0)']]); q.fillRect(x, X1.wallY + 18, w, (X1.baseY - X1.wallY) * (0.3 + r() * 0.6)); }
      // 墙脚泛潮的一抹青苔（软，不成硬线）
      q.fillStyle = K.lin(q, 0, X1.baseY - 34, 0, X1.baseY, [[0, 'rgba(96,116,100,0)'], [1, 'rgba(96,116,100,0.32)']]); q.fillRect(0, X1.baseY - 34, W, 34);
    });
  }

  // 青石板：近大远小、错缝；几何单独算好，结霜时还要用
  let x1TileMemo = null;
  function x1Tiles() {
    if (x1TileMemo) return x1TileMemo;
    const r = A.rng(8101), zs = [], out = [];
    for (let z = 12.5; z > 2.2; z -= 0.6 * (z / 5) * (0.75 + 0.5 * r())) zs.push(z);
    zs.push(2.1);
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1];
      let X = -8 - r();
      while (X < 8) {
        const w = 0.45 + r() * 0.55, Xb = X + w, gp = 0.014;
        const p = [[x1Gx(X + gp, z0), x1Gy(z0) + 0.7], [x1Gx(Xb - gp, z0), x1Gy(z0) + 0.7], [x1Gx(Xb - gp, z1), x1Gy(z1) - 1.4], [x1Gx(X + gp, z1), x1Gy(z1) - 1.4]];
        X = Xb;
        if (p[1][0] < -40 || p[0][0] > W + 40) continue;
        out.push({ p, near: clamp((x1Gy(z1) - 240) / 480), tn: r(), s: r() });
      }
    }
    x1TileMemo = out;
    return out;
  }
  // 地面（缓存）：石板对比放轻，远处没进雾里留白；水洼外一圈湿得发黑
  function x1Ground() {
    return K.cache('g08|x1ground', W, H, 1, (q) => {
      const r = A.rng(8102);
      q.fillStyle = '#5a6764'; q.fillRect(0, X1.baseY - 4, W, H);
      for (const T of x1Tiles()) {
        const { p, near, tn } = T;
        const base = mix(tn < 0.2 ? '#5f6d68' : tn < 0.45 ? '#6f7c76' : tn < 0.7 ? '#7a857e' : tn < 0.85 ? '#827d6e' : '#66766f', '#6c7974', 0.55);
        q.beginPath(); p.forEach(([px, py], k) => (k ? q.lineTo(px, py) : q.moveTo(px, py))); q.closePath();
        q.fillStyle = K.lin(q, 0, p[0][1], 0, p[3][1], [[0, mix(base, '#c4ccca', 0.25 * (1 - near))], [1, mix(base, '#3e4a46', 0.15 + 0.1 * near)]]); q.fill();
        q.save(); q.clip();
        for (let k = 0; k < 20 + near * 50; k++) { q.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'; q.fillRect(lerp(p[3][0], p[2][0], r()), lerp(p[0][1], p[3][1], r()), 1 + r() * 5 * (0.4 + near), 1 + r() * 1.6); }
        if (r() < 0.45) { q.fillStyle = 'rgba(30,40,40,' + (0.06 + r() * 0.1).toFixed(3) + ')'; A.inkBlob(q, lerp(p[3][0], p[2][0], r()), lerp(p[0][1], p[3][1], r()), (p[2][0] - p[3][0]) * (0.15 + r() * 0.2), r() * 9, 0.5); q.fill(); }
        q.restore();
        // 石缝：淡淡一道，远处的受光边不画
        if (near > 0.45) { q.strokeStyle = 'rgba(220,228,226,0.12)'; q.lineWidth = 0.8 + near * 0.6; q.beginPath(); q.moveTo(p[0][0], p[0][1]); q.lineTo(p[1][0], p[1][1]); q.stroke(); }
        q.strokeStyle = rgba(r() < 0.6 ? '#3f5c3e' : '#2c3634', 0.25); q.lineWidth = 1 + near * 2.2;
        q.beginPath(); q.moveTo(p[3][0], p[3][1] + 1); q.lineTo(p[2][0], p[2][1] + 1); q.stroke();
        if (r() < 0.55) { q.beginPath(); q.moveTo(p[1][0] + 1, p[1][1]); q.lineTo(p[2][0] + 1, p[2][1]); q.stroke(); }
        if (r() < 0.3) { q.fillStyle = rgba(r() < 0.5 ? '#5c7c4c' : '#46663f', 0.3 + r() * 0.25); A.inkBlob(q, p[2][0], p[2][1], 2 + near * 6, r() * 9, 0.5); q.fill(); }
      }
      // 近处稍暗
      q.fillStyle = K.lin(q, 0, 400, 0, H, [[0, 'rgba(20,28,28,0)'], [1, 'rgba(20,28,28,0.22)']]); q.fillRect(0, 400, W, H - 400);
      // 水洼外一圈湿石：软的深色晕
      q.save(); q.filter = 'blur(6px)'; q.fillStyle = 'rgba(34,44,44,0.5)'; x1PathAll(q, 1.07); q.fill(); q.filter = 'none'; q.restore();
      q.save(); q.fillStyle = 'rgba(34,44,44,0.35)'; x1PathAll(q, 1.02); q.fill(); q.restore();
      // 枯叶堆：墙脚一溜，水洼边几簇；全是褐色
      const drift = (x, y, n, sp, s0) => {
        for (let k = 0; k < n; k++) {
          const xx = x + (r() - 0.5) * sp, yy = y + (r() - 0.5) * sp * 0.22, s = s0 * (0.7 + r() * 0.5) * (0.4 + (yy - 226) / 500);
          putLeaf(q, leafTex(3 + (k % 3)), xx, yy, s, r() * TAU, r() < 0.5 ? 1 : -1, 0.42, 0.9);
        }
      };
      for (const [x, n] of [[60, 5], [210, 4], [560, 6], [780, 3], [900, 5]]) drift(x, 236 + r() * 8, n, 90, 12);
      for (const th of [3.3, 3.9, 4.6, 2.5, 1.9]) { const [x, y] = x1P(th, 1.12); drift(x, y + 6, 4 + Math.floor(r() * 3), 70, 20); }
      drift(140, 690, 3, 60, 26);
      // 远处石面没进雾里：留白
      q.fillStyle = K.lin(q, 0, X1.baseY - 4, 0, 420, [[0, 'rgba(224,230,230,0.78)'], [0.5, 'rgba(224,230,230,0.34)'], [1, 'rgba(224,230,230,0)']]); q.fillRect(0, X1.baseY - 4, W, 420 - X1.baseY + 4);
    });
  }
  // 石井（缓存）：井栏、井口一线、青苔、木桶
  function x1Well() {
    return K.cache('g08|x1well', 440, 300, 1, (q) => {
      const cx = 200, top = 70, base = 246, rx = 112, ryT = 15, ryB = 22;
      q.fillStyle = 'rgba(30,38,40,0.4)'; q.beginPath(); q.ellipse(cx + 18, base + 4, rx + 40, ryB + 12, 0, 0, TAU); q.fill();
      q.beginPath(); q.moveTo(cx - rx, top); q.lineTo(cx - rx, base); q.ellipse(cx, base, rx, ryB, 0, PI, 0, true); q.lineTo(cx + rx, top); q.closePath();
      q.fillStyle = K.lin(q, cx - rx, 0, cx + rx, 0, [[0, '#7e8c88'], [0.22, '#9eaba6'], [0.5, '#8a9792'], [0.8, '#5c6865'], [1, '#46514f']]); q.fill();
      q.save(); q.clip();
      const r = A.rng(77);
      q.strokeStyle = 'rgba(30,36,36,0.4)'; q.lineWidth = 1.3;
      for (const yy of [top + 62, top + 122]) { q.beginPath(); q.ellipse(cx, yy, rx, (ryT + ryB) / 2, 0, 0, PI); q.stroke(); }
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) { const a = PI - ((k + 0.5 + (row % 2) * 0.5) / 4) * PI, x = cx + Math.cos(a) * rx; const y0 = top + row * 60 + Math.sin(a) * 18; q.beginPath(); q.moveTo(x, y0 + 4); q.lineTo(x, y0 + 60); q.stroke(); }
      for (let k = 0; k < 260; k++) { q.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.1)'; q.fillRect(cx - rx + r() * rx * 2, top + r() * (base - top + ryB), 1 + r() * 3, 1 + r() * 2); }
      for (let k = 0; k < 14; k++) { const x = cx - rx + r() * rx * 2, w = 3 + r() * 8; q.fillStyle = K.lin(q, 0, top, 0, base, [[0, 'rgba(30,40,42,0.22)'], [1, 'rgba(30,40,42,0)']]); q.fillRect(x, top, w, (base - top) * (0.4 + r() * 0.6)); }
      for (let k = 0; k < 70; k++) { const a = r() * PI, x = cx + Math.cos(a) * rx * 0.98, y = base + Math.sin(a) * ryB - Math.pow(r(), 2) * 70; q.fillStyle = rgba(r() < 0.5 ? '#56764c' : '#3c5a3a', 0.25 + r() * 0.3); A.inkBlob(q, x, y, 3 + r() * 9, k, 0.5); q.fill(); }
      q.fillStyle = K.lin(q, cx, 0, cx + rx, 0, [[0, 'rgba(10,14,16,0)'], [1, 'rgba(10,14,16,0.3)']]); q.fillRect(cx, top, rx, base - top + ryB);
      q.restore();
      q.beginPath(); q.ellipse(cx, top, rx, ryT, 0, 0, TAU);
      q.fillStyle = K.lin(q, 0, top - ryT, 0, top + ryT, [[0, '#b9c3c0'], [1, '#93a09c']]); q.fill();
      q.beginPath(); q.ellipse(cx, top - 1, rx * 0.74, ryT * 0.5, 0, 0, TAU); q.fillStyle = '#141a1c'; q.fill();
      q.strokeStyle = 'rgba(240,244,244,0.5)'; q.lineWidth = 1.4; q.beginPath(); q.ellipse(cx, top, rx - 1, ryT - 1, 0, PI * 1.05, PI * 1.9); q.stroke();
      q.strokeStyle = 'rgba(50,56,56,0.65)'; q.lineWidth = 1.6;
      for (let k = 0; k < 6; k++) { const x = cx - 70 + k * 26 + r() * 8; q.beginPath(); q.moveTo(x, top + ryT - 2); q.lineTo(x + 2, top + ryT + 6); q.stroke(); }
      const bx = 372, by = 262, bw = 46, bh = 70;
      q.fillStyle = 'rgba(30,36,40,0.4)'; q.beginPath(); q.ellipse(bx + 8, by + 4, bw + 14, 10, 0, 0, TAU); q.fill();
      q.beginPath(); q.moveTo(bx - bw, by - bh); q.lineTo(bx - bw + 6, by); q.ellipse(bx, by, bw - 6, 8, 0, PI, 0, true); q.lineTo(bx + bw, by - bh); q.closePath();
      q.fillStyle = K.lin(q, bx - bw, 0, bx + bw, 0, [[0, '#5a4028'], [0.35, '#8a6640'], [1, '#3a2818']]); q.fill();
      q.strokeStyle = '#26282a'; q.lineWidth = 4; for (const yy of [by - bh + 14, by - 14]) { q.beginPath(); q.ellipse(bx, yy, bw - 3, 8, 0, 0, PI); q.stroke(); }
      q.strokeStyle = 'rgba(20,14,10,0.4)'; q.lineWidth = 1; for (let k = -3; k <= 3; k++) { q.beginPath(); q.moveTo(bx + k * 13, by - bh + 4); q.lineTo(bx + k * 11.5, by + 6); q.stroke(); }
      q.beginPath(); q.ellipse(bx, by - bh, bw, 9, 0, 0, TAU); q.fillStyle = '#2a2018'; q.fill();
      q.fillStyle = 'rgba(170,186,196,0.45)'; q.beginPath(); q.ellipse(bx, by - bh + 1, bw - 7, 5.5, 0, 0, TAU); q.fill();
      q.strokeStyle = '#3a2a1c'; q.lineWidth = 3; q.beginPath(); q.moveTo(bx - bw + 4, by - bh); q.quadraticCurveTo(bx, by - bh - 60, bx + bw - 4, by - bh); q.stroke();
    });
  }

  // 枫枝几何：从左上斜伸进来；小枝与母枝夹角不超过 50°，不许直垂成线
  let x1Geo = null;
  function x1BranchGeo() {
    if (x1Geo) return x1Geo;
    const r = A.rng(9041), segs = [], tips = [];
    const limb = (x, y, a, len, w0, w1, n, bend, lim) => {
      const pts = [[x, y, a]];
      let aa = a;
      for (let i = 0; i < n; i++) {
        aa += bend + (r() - 0.5) * 0.2;
        aa = clamp(aa, a - 0.87, a + 0.87);
        aa = Math.min(aa, lim);
        const l = len / n, nx = x + Math.cos(aa) * l, ny = y + Math.sin(aa) * l;
        segs.push([x, y, nx, ny, lerp(w0, w1, i / n), lerp(w0, w1, (i + 1) / n)]);
        x = nx; y = ny; pts.push([x, y, aa]);
      }
      return pts;
    };
    const main = limb(-80, -6, 0.3, 1080, 30, 4, 12, -0.026, 0.6);
    main.forEach(([x, y, a], i) => {
      if (i < 2 || i > 11) return;
      for (const sd of i % 2 ? [1] : [-1, 1]) {
        if (r() < 0.22) continue;
        const s0 = segs.length, my = [];
        const ba = a + sd * (0.4 + r() * 0.4), bl = 100 + r() * 140 * (1 - i / 16);
        const w = lerp(30, 4, i / 12) * 0.55;
        const br = limb(x, y, ba, bl, w, 2, 5, sd > 0 ? 0.03 : -0.03, 1.05);
        br.forEach(([bx, by, b2], j) => {
          if (j < 2) return;
          if (r() < 0.55) {
            const s1 = segs.length;
            const tw = limb(bx, by, b2 + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.45), 36 + r() * 46, 2, 0.9, 3, 0.03, 1.1);
            const e = tw[tw.length - 1];
            if (e[1] > 200) segs.length = s1; else my.push([e[0], e[1]]);
          }
          if (j === br.length - 1 && by < 200) my.push([bx, by]);
        });
        // 整根小枝垂得太低就不要
        if (br[br.length - 1][1] > 215) segs.length = s0; else tips.push(...my);
      }
    });
    // 枝上剩下的十来片枯叶；主角红叶挂在正中偏右的一根小枝梢上
    const cand = tips.filter(([x, y]) => x > 90 && x < 1000 && y > 30);
    let hero = cand[0], best = 1e9;
    for (const p of cand) { const d = Math.abs(p[0] - 700) + Math.abs(p[1] - 150) * 0.6; if (d < best) { best = d; hero = p; } }
    const leaves = [];
    const rest = cand.filter((p) => p !== hero);
    for (let k = 0; k < 11 && rest.length; k++) {
      const p = rest.splice(Math.floor(h2(k, 701) * rest.length), 1)[0];
      leaves.push({ x: p[0] + (h2(k, 702) - 0.5) * 6, y: p[1] + 9 + h2(k, 703) * 5, s: 13 + h2(k, 704) * 6, rot: PI + (h2(k, 705) - 0.5) * 1.2, tex: 3 + (k % 3), sd: k });
    }
    x1Geo = { segs, leaves, hero: [hero[0], hero[1] + 4] };
    return x1Geo;
  }
  // 枫枝贴图：5 档微摆预先画好，逐帧在相邻两档间淡化（不用逐帧旋转大图）
  const X1SW = [-0.008, -0.004, 0, 0.004, 0.008], X1PIV = [-40, 14];
  function x1Branch(k, frost) {
    return K.cache('g08|x1br' + k + (frost ? 'f' : ''), 1100, 300, 1, (q) => {
      const { segs } = x1BranchGeo();
      q.translate(X1PIV[0], X1PIV[1] + 20); q.rotate(X1SW[k]); q.translate(-X1PIV[0], -X1PIV[1]);
      q.lineCap = 'round'; q.lineJoin = 'round';
      if (frost) {
        // 枝的上沿结一道白霜
        // 不用逐笔模糊：一道宽而淡、一道窄而亮
        for (const [a, k] of [[0.35, 1.8], [0.95, 1]]) {
          for (const [x0, y0, x1, y1, w0, w1] of segs) { q.strokeStyle = rgba('#f6fafd', a); q.lineWidth = Math.max(1.4, w0 * 0.36) * k; q.beginPath(); q.moveTo(x0, y0 - w0 * 0.38); q.lineTo(x1, y1 - w1 * 0.38); q.stroke(); }
        }
        return;
      }
      for (const [x0, y0, x1, y1, w0, w1] of segs) { q.strokeStyle = '#21160f'; q.lineWidth = (w0 + w1) / 2; q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke(); }
      const r = A.rng(31);
      for (const [x0, y0, x1, y1, w0, w1] of segs) {
        if (w0 < 3) continue;
        q.strokeStyle = 'rgba(176,150,124,0.3)'; q.lineWidth = w0 * 0.22;
        q.beginPath(); q.moveTo(x0, y0 - w0 * 0.28); q.lineTo(x1, y1 - w1 * 0.28); q.stroke();
        if (r() < 0.5) { q.strokeStyle = 'rgba(80,60,44,0.6)'; q.lineWidth = 1; const u = r(); q.beginPath(); q.arc(lerp(x0, x1, u), lerp(y0, y1, u), w0 * 0.3, 0, TAU); q.stroke(); }
      }
    });
  }
  // 枝上一点随摆角转动后的位置
  function x1Sw(x, y, a) {
    const dx = x - X1PIV[0], dy = y - X1PIV[1], cs = Math.cos(a), sn = Math.sin(a);
    return [X1PIV[0] + dx * cs - dy * sn, X1PIV[1] + dx * sn + dy * cs];
  }
  // 最近景：右上角几根失焦的枯枝（缓存，整数平移）
  function x1Near() {
    return K.cache('g08|x1near', 460, 300, 1, (q) => {
      const tmp = K.cache('g08|x1nearS', 460, 300, 1, (p) => {
        p.lineCap = 'round'; p.strokeStyle = '#1c130d';
        const br = (pts, w0) => { for (let i = 1; i < pts.length; i++) { p.lineWidth = w0 * (1 - (i - 1) / pts.length); p.beginPath(); p.moveTo(pts[i - 1][0], pts[i - 1][1]); p.lineTo(pts[i][0], pts[i][1]); p.stroke(); } };
        br([[470, -10], [400, 30], [330, 70], [250, 112], [176, 150]], 14);
        br([[330, 70], [300, 120], [282, 176], [262, 214]], 6);
        br([[250, 112], [212, 100], [170, 78]], 4);
        br([[400, 30], [372, 92], [366, 140]], 5);
        br([[176, 150], [130, 160], [96, 182]], 3);
        // 一两片挂着的枯叶
        mapleLeaf(p, 268, 222, 18, 0.4, '#8a5a2e', '#5e2e18');
        mapleLeaf(p, 102, 190, 14, -0.6, '#7a4a26', '#4e2814');
      });
      q.filter = 'blur(6px)'; q.drawImage(tmp, 0, 0, 460, 300); q.filter = 'none';
    });
  }
  // 主角红叶贴图：唯一的正红
  const x1HeroTex = () => K.cache('g08|x1hero', 128, 128, 1, (q) => mapleLeaf(q, 64, 60, 52, 0, '#e84a30', '#b81e18', '#5a0c06'));
  function putHero(g, x, y, s, rot, fx, sy, a) {
    const ga = g.globalAlpha;
    g.save(); g.translate(x, y); g.scale(1, sy); g.rotate(rot); g.scale(fx, 1);
    g.globalAlpha = ga * a;
    g.drawImage(x1HeroTex(), -s * 64 / 52, -s * 60 / 52, s * 128 / 52, s * 128 / 52);
    g.restore();
  }

  // 整幅背景（缓存，不透明）：天、远景、地面、石井、水洼倒影；冷暖两版，暖版另有对焦前的模糊版
  const x1SkyC = (cold) => [mix('#bcc6c8', '#9ab4c6', cold), mix('#dfe3e0', '#e8eef1', cold)];
  function x1Refl(q, cold) {
    // 水是镜子：远沿映着亮的天，近沿是深的石板青
    const [pcx] = X1.pc;
    q.fillStyle = K.lin(q, 0, 494, 0, 652, cold
      ? [[0, '#eef4f7'], [0.16, '#d6e2ea'], [0.4, '#93a8b6'], [0.66, '#4a5e6c'], [1, '#2a3c4a']]
      : [[0, '#e3e9ea'], [0.16, '#cdd6d9'], [0.4, '#8e9da2'], [0.66, '#56666c'], [1, '#36454b']]);
    q.fillRect(X1B[0], X1B[1], X1B[2], X1B[3]);
    // 倒过来的老树与马头墙：远沿一道清楚的深色剪影
    q.save(); q.translate(0, 548); q.scale(1, -1);
    q.fillStyle = cold ? '#56656e' : '#56625f';
    const r = A.rng(5150);
    for (let k = 0; k < 14; k++) { A.inkBlob(q, 70 + k * 26 + r() * 24, -40 + r() * 100 + Math.abs(k - 7) * 10, 46 + r() * 34, k + 3, 0.4); q.fill(); }
    q.restore();
    q.save(); q.translate(0, 546); q.scale(1, -1);
    x1Gable(q, 880, 360, -60, 120, cold ? '#c9d2d8' : '#c3c8c4', '#3b4449');
    x1Gable(q, 640, 250, 12, 120, cold ? '#d0d8dc' : '#cdd0ca', '#363e43');
    q.restore();
    // 倒过来的枫枝（深，0.75）
    const { segs } = x1BranchGeo();
    q.save(); q.translate(-40, 0); q.globalAlpha = 0.75; q.lineCap = 'round'; q.strokeStyle = cold ? '#1e242a' : '#241c18';
    for (const [x0, y0, x1, y1, w0, w1] of segs) { q.lineWidth = ((w0 + w1) / 2) * 0.9; q.beginPath(); q.moveTo(x0, X1.A1 - y0 - 20); q.lineTo(x1, X1.A1 - y1 - 20); q.stroke(); }
    q.restore();
    // 远沿一线受天光，近沿暗
    q.save(); q.filter = 'blur(1px)'; q.strokeStyle = 'rgba(250,252,252,0.7)'; q.lineWidth = 2; x1Path(q, 0.985, PI * 1.08, PI * 1.92, false); q.stroke(); q.filter = 'none'; q.restore();
    q.save(); q.filter = 'blur(5px)'; q.strokeStyle = 'rgba(20,30,34,0.5)'; q.lineWidth = 12; x1Path(q, 1, PI * 0.1, PI * 0.9, false); q.stroke(); q.filter = 'none'; q.restore();
    void pcx;
  }
  // kf：0 秋雨（暖灰）、1 转冷、2 结霜；调色、墙脚薄雾、地上的霜都直接画进去，逐帧只在相邻两版间淡化
  function x1Backdrop(kf, blur) {
    return K.cache('g08|x1bd' + kf + (blur ? 'b' : ''), W, H + 40, 1, (q) => {
      if (blur) { const sh = x1Backdrop(kf, 0); q.drawImage(sh, 0, 0, W, H + 40); q.filter = 'blur(5px)'; q.drawImage(sh, 0, 0, W, H + 40); q.filter = 'none'; return; }  // 先垫一层清晰的，模糊后边缘不透明
      const cold = kf ? 1 : 0;
      q.translate(0, 40);
      const [top, hor] = x1SkyC(cold);
      q.fillStyle = K.lin(q, 0, -40, 0, X1.baseY, [[0, top], [1, hor]]); q.fillRect(0, -40, W, X1.baseY + 40);
      q.drawImage(x1Far(), 0, -230, W, 470);
      q.drawImage(x1Ground(), 0, 0, W, H);
      q.drawImage(x1Well(), X1.well[0] - 200, X1.well[1] - 246);
      const pr = K.cache('g08|x1pr' + cold, X1B[2], X1B[3], 1, (p) => { p.save(); p.translate(-X1B[0], -X1B[1]); x1Refl(p, cold); p.restore(); x1Clip(p); });
      q.drawImage(pr, X1B[0], X1B[1], X1B[2], X1B[3]);
      // 天放晴转蓝，地面泛一层冷光
      if (cold) { q.fillStyle = 'rgba(200,220,236,0.12)'; q.fillRect(0, X1.baseY, W, H); }
      E.mist(q, { t: 0, y: X1.baseY + 4, h: 110, color: cold ? '#eef3f6' : '#e2e7e5', alpha: 0.32, seed: 4 });
      if (kf === 2) q.drawImage(x1GroundFrost(), 0, 0, W, H);
      V.grade(q, kf ? { snow: 0.3 } : { autumn: 0.2 });
    });
  }
  // 霜：成簇的晶种，簇间留空；主枝长短不一，±60° 分两级羽枝，粗细由根到梢 1.6→0.5
  let x1Den = null;
  function x1Dendrites() {
    if (x1Den) return x1Den;
    const r = A.rng(4417), out = [];
    const grow = (x, y, a, L, w0, d0, lvl) => {
      const n = Math.max(2, Math.round(L / 9));
      let px = x, py = y, aa = a;
      for (let k = 0; k < n; k++) {
        const l = L / n, nx = px + Math.cos(aa) * l, ny = py + Math.sin(aa) * l, u = k / n;
        const w = lerp(w0, 0.5, u), al = lerp(0.95, 0.5, u) * (lvl ? 0.8 : 1);
        out.push([px, py, nx, ny, d0 + k * l, d0 + (k + 1) * l, w, al]);
        if (lvl < 2 && k > 0 && r() < 0.62) {
          const sd = r() < 0.5 ? -1 : 1;
          grow(nx, ny, aa + sd * (PI / 3) * (0.85 + r() * 0.3), L * (0.3 + r() * 0.3) * (1 - u * 0.6), w * 0.8, d0 + (k + 1) * l, lvl + 1);
        }
        px = nx; py = ny; aa += (r() - 0.5) * 0.25;
      }
    };
    // 14 簇，每簇 2–6 根
    for (let cI = 0; cI < 14; cI++) {
      const th0 = (cI / 14) * TAU + (r() - 0.5) * 0.35, m = 2 + Math.floor(r() * 5);
      for (let j = 0; j < m; j++) {
        const th = th0 + (r() - 0.5) * 0.22, R0 = x1R(th) * 0.995;
        const x = Math.cos(th) * R0 * X1.rx, y = Math.sin(th) * R0 * X1.rx;
        grow(x, y, th + PI + (r() - 0.5) * 0.9, (60 + r() * 60) * (0.3 + r() * 1.3), 1.6, r() * 14, 0);
      }
    }
    x1Den = out;
    return out;
  }
  const X1FL = 12, X1FMAX = 300;
  function x1FrostTex(k) {
    const f = k / (X1FL - 1), reach = f * X1FMAX;
    return K.cache('g08|x1frost' + k, X1B[2], X1B[3], 1, (q) => {
      q.save(); q.translate(-X1B[0], -X1B[1]);
      const [pcx, pcy] = X1.pc;
      // 先是一圈柔的白霜带，随后冰面整体发白
      const bw = 8 + 34 * Math.min(1, f * 1.6);
      q.filter = 'blur(' + (3 + bw * 0.25).toFixed(1) + 'px)';
      q.strokeStyle = rgba('#f4f8fb', 0.5 + 0.2 * f); q.lineWidth = bw; x1PathAll(q); q.stroke();
      q.strokeStyle = rgba('#ffffff', 0.5); q.lineWidth = bw * 0.35; x1PathAll(q); q.stroke();
      q.filter = 'none';
      if (f > 0) { q.fillStyle = rgba('#e8f0f4', 0.07 * smooth(f)); q.fillRect(X1B[0], X1B[1], X1B[2], X1B[3]); }
      // 枝晶
      q.lineCap = 'round';
      for (const pass of [0, 1]) {
        for (const [x0, y0, x1, y1, d0, d1, w, al] of x1Dendrites()) {
          if (d0 >= reach) continue;
          const u = clamp((reach - d0) / (d1 - d0));
          const ax = pcx + x0, ay = pcy + y0 * X1.py, bx = pcx + lerp(x0, x1, u), by = pcy + lerp(y0, y1, u) * X1.py;
          if (pass === 0) { q.strokeStyle = 'rgba(70,90,104,0.22)'; q.lineWidth = w + 1; q.beginPath(); q.moveTo(ax, ay + 1); q.lineTo(bx, by + 1); q.stroke(); }
          else { q.strokeStyle = rgba('#ffffff', al); q.lineWidth = w; q.beginPath(); q.moveTo(ax, ay); q.lineTo(bx, by); q.stroke(); }
        }
      }
      q.restore();
      x1Clip(q);
    });
  }
  // 地上的霜（整幅缓存，淡入）：水洼周围石板的边、墙帽、井栏
  function x1GroundFrost() {
    return K.cache('g08|x1gfrost', W, H, 1, (q) => {
      q.lineCap = 'round';
      for (const T of x1Tiles()) {
        const { p, near } = T;
        const mx = (p[0][0] + p[1][0]) / 2, my = (p[0][1] + p[3][1]) / 2;
        const u = x1U(mx, my), a = clamp(1.25 - (u - 1) * 0.9) * (0.4 + 0.6 * near);
        if (a < 0.05 || u < 0.9) continue;
        q.strokeStyle = rgba('#f6fafc', 0.9 * a); q.lineWidth = 1.2 + near * 2.2;
        q.beginPath(); q.moveTo(p[0][0] + 2, p[0][1] + 1); q.lineTo(p[1][0] - 2, p[1][1] + 1); q.stroke();
        q.strokeStyle = rgba('#f4f8fb', 0.4 * a); q.lineWidth = 0.6 + near;
        q.beginPath(); q.moveTo(p[1][0] - 1, p[1][1] + 1); q.lineTo(p[2][0] - 1, p[2][1] - 1); q.stroke();
      }
      // 整片石面蒙一层白霜，岸边一圈更白
      q.fillStyle = K.lin(q, 0, X1.baseY, 0, H, [[0, 'rgba(236,242,246,0.3)'], [1, 'rgba(236,242,246,0.14)']]); q.fillRect(0, X1.baseY, W, H - X1.baseY);
      q.save(); q.filter = 'blur(4px)'; q.strokeStyle = 'rgba(240,246,250,0.4)'; q.lineWidth = 12; x1PathAll(q, 1.05); q.stroke(); q.filter = 'none'; q.restore();
      // 墙帽、井栏、桶沿
      q.strokeStyle = 'rgba(246,250,252,0.8)'; q.lineWidth = 2.2;
      q.beginPath(); q.moveTo(0, X1.wallY - 1); q.lineTo(W, X1.wallY - 1); q.stroke();
      const [wx, wy] = X1.well;
      q.lineWidth = 2.6; q.beginPath(); q.ellipse(wx, wy - 176, 111, 14, 0, PI * 0.98, PI * 2.02); q.stroke();
      q.lineWidth = 1.6; q.beginPath(); q.ellipse(wx + 172, wy - 54, 45, 8.5, 0, PI, TAU); q.stroke();
    });
  }
  // 一片叶的落点：都落在地上（水洼里只有那片红叶）——墙脚或水洼外沿
  function x1Drop(L) {
    const k = L.sd;
    if (h2(k, 36) < 0.35) return [clamp(L.x + (h2(k, 37) - 0.5) * 200, 30, 940), 238 + h2(k, 38) * 18];
    const th = 2.3 + h2(k, 39) * 2.6, [x, y] = x1P(th, 1.1 + h2(k, 40) * 0.12);
    return [x, y + 4];
  }

  XYT.registerShot('x1_frostpond', {
    name: '枫落秋池', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(245,247,248,0.85)', accent: '#dc3023', bloom: 0.3,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      const geo = x1BranchGeo();
      const [pcx, pcy] = X1.pc;
      // 节拍：红叶落水在第一个强拍，下一个强拍起结霜
      const land = beatAt(c, 0.8, 0, true, 1.47), frost0 = beatAt(c, land + 1, 0, true, 4.8);
      const bp = Math.max(0.5, (frost0 - land) / 4);
      // 镜头长度（预览里镜头可能很短，按结霜所需的长度兜底）
      const D = Math.max(c.dur, frost0 + 3.3);
      const crawl0 = frost0 + bp * 0.5, rainEnd = frost0 + bp * 2.4;
      // 背景的三版：秋雨 → 转冷 → 结霜
      const KF = smooth(seg(lt, land + 0.5, frost0 + 0.4)) + smooth(seg(lt, frost0 + 0.4, D - 0.4));
      const cold = Math.min(1, KF), gf = Math.max(0, KF - 1);
      // 雨势逐小节减弱，2:23 前停
      const rainAt = (x) => (x < land ? 1 : x < frost0 ? 0.62 : 0.34 * (1 - smooth(seg(x, frost0 + bp * 1.2, rainEnd))));
      const rain = rainAt(lt);
      // 镜头：先略仰着跟落叶，落水后落定；整数像素平移
      const tilt = Math.round(30 * (1 - easeInOut(seg(lt, -1, land + 0.4))));
      const focus = smooth(seg(lt, land - 0.6, land + 0.35));
      g.save();
      g.translate(0, tilt);
      // —— 背景（含水洼倒影）：对焦拉过来，再由暖转冷 ——
      if (focus < 1) g.drawImage(x1Backdrop(0, 1), 0, -40, W, H + 40);
      if (focus > 0) {
        const k0 = Math.min(1, Math.floor(KF)), u = KF - k0;
        if (u < 0.996) { g.globalAlpha = focus; g.drawImage(x1Backdrop(k0, 0), 0, -40, W, H + 40); }
        if (u > 0.004) { g.globalAlpha = focus * u; g.drawImage(x1Backdrop(k0 + 1, 0), 0, -40, W, H + 40); }
        g.globalAlpha = 1;
      }
      // —— 延时：倒影里的云飞快掠过（不裁剪：云团离岸线越近越淡） ——
      {
        const ct = lt * 0.03 + 0.42 * Math.pow(seg(lt, land, D), 1.25) * 5;
        for (let k = 0; k < 6; k++) {
          const u = ((h2(k, 51) + ct * (0.5 + 0.4 * h2(k, 52))) % 1.4) - 0.2;
          const y = pcy - 46 + h2(k, 53) * 90, x = 100 + u * 860;
          const e = x1U(x, y);
          if (e > 0.85) continue;
          const half = (1 - e) * 160;
          oval(g, x, y, Math.min(70 + 80 * h2(k, 54), half), 9 + 7 * h2(k, 55), '#ffffff', (0.16 + 0.14 * h2(k, 56)) * (1 - e / 0.85) * (0.5 + 0.5 * focus) * (1 - 0.6 * smooth(seg(lt, crawl0, D))), 'screen');
        }
      }
      // 雨点涟漪：圈不越出岸线
      g.lineWidth = 1;
      {
        const rate = 22, i1 = Math.floor(t * rate);
        g.strokeStyle = rgba('#f6fafc', 0.42);
        g.beginPath();
        for (let i = i1; i > i1 - rate * 0.9; i--) {
          const t0 = i / rate + h2(i, 61) / rate, age = t - t0;
          if (age < 0 || age > 0.85) continue;
          const lt0 = lt - age;
          if (h2(i, 62) > rainAt(lt0)) continue;
          const th = h2(i, 63) * TAU, uu = Math.sqrt(h2(i, 64)) * 0.86, rr = uu * x1R(th) * X1.rx;
          const x = pcx + Math.cos(th) * rr, y = pcy + Math.sin(th) * rr * X1.py;
          const Rm = (1 - uu) * x1R(th) * X1.rx * 0.8, R = Math.min(Rm, (3 + age * 34) * (0.7 + 0.5 * (y - pcy + 110) / 220));
          if (R < 1.5) continue;
          g.moveTo(x + R, y); g.ellipse(x, y, R, R * X1.py, 0, 0, TAU);
        }
        g.stroke();
      }
      // 霜：分档贴图交叉淡化（贴图已按水洼形状裁好）
      const fw = 0.08 * smooth(seg(lt, frost0, frost0 + 0.7)) + 0.92 * easeInOut(seg(lt, crawl0, D - 0.2));
      if (fw > 0.003) {
        const fk = clamp(fw) * (X1FL - 1), k0 = Math.min(X1FL - 2, Math.floor(fk)), u = fk - k0;
        const a0 = k0 === 0 ? clamp(fw * 40) : 1;
        if (u < 0.98) { g.globalAlpha = a0; g.drawImage(x1FrostTex(k0), X1B[0], X1B[1], X1B[2], X1B[3]); }
        if (u > 0.02) { g.globalAlpha = u; g.drawImage(x1FrostTex(k0 + 1), X1B[0], X1B[1], X1B[2], X1B[3]); }
        g.globalAlpha = 1;
      }
      // 地上的霜

      // —— 主角红叶：挂在枝梢 → 摇摆着落下，与水里的倒影相会 → 落水 → 被霜封住 ——
      const sway = 0.006 * Math.sin(t * 0.9) * (1 - smooth(seg(lt, frost0, rainEnd))) + 0.004 * c.be(0.5) * rain;
      const tD = land - 1.75;
      const HL = [446, 562];
      if (lt < land) {
        const [hx0, hy0] = x1Sw(geo.hero[0] - 40, geo.hero[1], sway);
        const u = seg(lt, tD, land), e = u * u * 0.35 + u * 0.65, s = 40 + 4 * Math.sin(u * PI);
        const swing = Math.sin(u * PI * 3.2) * 120 * (1 - u) * smooth(u / 0.15);
        const x = lerp(hx0, HL[0], easeInOut(u)) + swing, y = lerp(hy0 + s * 0.62, HL[1], e) - Math.abs(Math.sin(u * PI * 3.2)) * 14 * (1 - u);
        // 挂着时叶柄朝上、在风里抖；落下时翻两个身，近水时放平
        const tw = lt < tD ? 0.22 * Math.sin(t * 7) * (0.4 + 0.6 * seg(lt, tD - 1, tD)) : 0;
        const rot = lerp(PI + 0.15, 2.6 + TAU, easeInOut(u)) + 0.5 * Math.sin(u * PI * 3.2) * (1 - u) + tw;
        const fx = Math.cos(u * PI * 4), sy = lerp(1, 0.44, smooth(seg(u, 0.7, 1)));
        const fxs = fx < 0 ? Math.min(-0.38, fx) : Math.max(0.38, fx);
        // 水里的倒影：叶越低，倒影越近，落水时两者相会
        const ry = 2 * HL[1] - y;
        if (u > 0.4 && x1U(x, ry) < 0.9) putHero(g, x, ry, s, -rot, fxs, -sy * 0.9, 0.45 * seg(u, 0.4, 0.75));
        if (u > 0.55) oval(g, x, HL[1] + 6, 30 * u, 8 * u, '#1a2224', 0.28 * u * u, 'source-over');
        if (lt < tD) { g.strokeStyle = '#3a1c10'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(hx0, hy0); g.lineTo(x, y - s * 0.4); g.stroke(); }
        putHero(g, x, y, s, rot, fxs, sy, 1);
        dot(g, x, y, s * 2.2, '#ff5a3a', 0.12, 'screen');
      } else {
        const age = lt - land, lock = smooth(seg(lt, D - 1.6, D - 0.4));
        const x = HL[0] + (1 - Math.exp(-age * 0.45)) * 22, y = HL[1] + Math.sin(t * 0.9) * 1.2 * (1 - lock);
        const rot = 2.6 + (1 - Math.exp(-age * 0.5)) * 0.5;
        // 红叶的倒影：水下一抹红
        putHero(g, x, y + 10, 42, -rot, 1, -0.28, 0.32 * (1 - lock * 0.7));
        putHero(g, x, y, 42, rot, 1, 0.44, 1);
        if (lock > 0) {
          // 叶缘结一圈冰晶
          g.save(); g.translate(x, y); g.scale(1, 0.44); g.rotate(rot);
          g.globalAlpha = 0.8 * lock; g.strokeStyle = '#ffffff'; g.lineWidth = 2; maplePath(g, 0, 0, 42.5, 0); g.stroke();
          g.lineWidth = 1.1; g.beginPath();
          for (let k = 0; k < 22; k++) { const a = (k / 22) * TAU, rr = 30 + 14 * h2(k, 811); g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); g.lineTo(Math.cos(a) * (rr + 7 + 7 * h2(k, 812)), Math.sin(a) * (rr + 7 + 7 * h2(k, 812))); }
          g.stroke();
          g.restore(); g.globalAlpha = 1;
        }
        // 落水的大涟漪（强拍上一亮）
        for (let k = 0; k < 4; k++) {
          const ag = age - k * 0.3;
          if (ag < 0 || ag > 2.6) continue;
          const R = 12 + 190 * easeOut(ag / 2.6), a = 0.7 * Math.pow(1 - ag / 2.6, 1.3) * (1 - k * 0.2);
          g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 2 - k * 0.35;
          g.beginPath(); g.ellipse(HL[0], HL[1] + 3, R, R * X1.py, 0, 0, TAU); g.stroke();
          g.strokeStyle = rgba('#2a3a40', a * 0.35);
          g.beginPath(); g.ellipse(HL[0], HL[1] + 5, R * 0.97, R * X1.py * 0.97, 0, 0.1 * PI, 0.9 * PI); g.stroke();
        }
        if (age < 0.5) oval(g, HL[0], HL[1], 80, 26, '#ffffff', 0.45 * (1 - age / 0.5), 'screen');
        dot(g, x, y + 2, 60, '#ff5a3a', 0.12 * (1 - lock * 0.5), 'screen');
      }
      // 霜面细碎的闪光
      if (gf > 0) {
        for (let i = 0; i < 14; i++) {
          const th = h2(i, 95) * TAU, [x, y] = x1P(th, 0.98 - 0.55 * h2(i, 96) * fw);
          const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (3 + h2(i, 97) * 3) + i * 2), 6);
          dot(g, x, y, 4 + 6 * tw, '#ffffff', 0.85 * gf * tw, 'screen');
        }
      }

      // —— 枯叶：每拍掉一两片，都落到墙脚和水洼外沿 ——
      const shed = [];
      for (const b of shotBeats(c)) if (b.lt > land + 0.3 && b.lt < rainEnd + bp) shed.push(b.lt);
      if (!shed.length) shed.push(land + 0.8);
      const leafTd = (L) => { const j = Math.floor(L.sd * 0.67); return shed[Math.min(shed.length - 1, j)] + (L.sd % 3 === 2 ? 0.18 : 0); };
      {
        const m = g.getTransform();
        for (const L of geo.leaves) {
          const td = leafTd(L), dur = 1.4 + h2(L.sd, 38) * 0.6, [lx, ly] = x1Drop(L);
          const age = lt - td;
          if (age < 0) continue;
          const u = Math.min(1, age / dur);
          const [ax, ay] = x1Sw(L.x - 40, L.y, sway);
          const x = lerp(ax, lx, u) + Math.sin(u * PI * 2.4 + L.sd) * 46 * (1 - u), y = lerp(ay, ly, u * u * 0.45 + u * 0.55);
          const fx = u < 1 ? Math.cos(age * 4 + L.sd) : 1, sz = lerp(L.s, 4 + 17 * clamp((ly - 226) / 494), u);
          putLeafM(g, m, leafTex(L.tex), x, y, sz, L.rot + u * 5, fx < 0 ? Math.min(-0.2, fx) : Math.max(0.2, fx), lerp(1, 0.42, u * u), 1);
        }
        g.setTransform(m);
      }
      // —— 枫枝（近景，上沿）：5 档微摆交叉淡化；上沿结霜 ——
      {
        const fs = clamp((sway - X1SW[0]) / (X1SW[4] - X1SW[0])) * 4, k0 = Math.min(3, Math.floor(fs)), u = fs - k0;
        const bf = smooth(seg(lt, frost0 + bp, D - 0.3));
        for (const [k, a] of [[k0, 1], [k0 + 1, u]]) {
          if (a < 0.02) continue;
          g.globalAlpha = a; g.drawImage(x1Branch(k, 0), -40, -20, 1100, 300);
          if (bf > 0.004) { g.globalAlpha = a * bf; g.drawImage(x1Branch(k, 1), -40, -20, 1100, 300); }
        }
        g.globalAlpha = 1;
      }
      // 枝上未落的叶（与倒影里的一并画）
      {
        const m = g.getTransform();
        for (const L of geo.leaves) {
          const td = leafTd(L);
          if (lt >= td) continue;
          const [x, y] = x1Sw(L.x - 40, L.y, sway);
          const tw = 0.14 * Math.sin(t * (2 + h2(L.sd, 41)) + L.sd) + (lt > td - 0.3 ? 0.5 * Math.sin(t * 28) * seg(lt, td - 0.3, td) : 0);
          putLeafM(g, m, leafTex(L.tex), x, y, L.s, L.rot + tw, 1, 1, 1);
          const ry = X1.A1 - L.y - 20;
          if (x1U(x, ry) < 0.85) putLeafM(g, m, leafTex(L.tex), x, ry, L.s * 0.9, -L.rot, 1, -1, 0.55 * focus);
        }
        g.setTransform(m);
      }
      // 墙脚的薄雾，缓缓流动
      // 最近景：右上角失焦的枯枝
      g.drawImage(x1Near(), 830 + Math.round(3 * Math.sin(t * 0.8)), -10 + Math.round(2 * Math.sin(t * 1.1 + 1)), 460, 300);
      g.restore();
      // —— 雨：每小节变细变冷，2:23 前停 ——
      if (rain > 0.02) {
        V.rain(g, c, { n: Math.round(240 * rain), angle: 0.1, speed: 900 + 200 * cold, len: lerp(46, 24, cold), color: mix('#d6dcdf', '#f4f9ff', cold), alpha: 0.48 * (0.45 + 0.55 * rain), beat: 0.35 });
        g.strokeStyle = rgba('#eef4f6', 0.5 * rain); g.lineWidth = 1;
        g.beginPath();
        const rr = 34, j1 = Math.floor(t * rr);
        for (let j = j1; j > j1 - rr * 0.25; j--) {
          if (h2(j, 71) > rain) continue;
          const age = t - (j / rr + h2(j, 72) / rr);
          if (age < 0 || age > 0.22) continue;
          const x = h2(j, 73) * W, y = 250 + Math.pow(h2(j, 74), 0.7) * 470, R = (1 + age * 30) * (0.3 + (y - 230) / 500);
          if (x1U(x, y) < 1.1 || (x > 950 && y < 470)) continue;
          g.moveTo(x - R, y + tilt); g.quadraticCurveTo(x, y + tilt - R * 0.9, x + R, y + tilt);
        }
        g.stroke();
      }
      // 雨停后空中浮着细碎的冰晶，冷白闪烁
      if (gf > 0.02) {
        for (let i = 0; i < 34; i++) {
          const x = (h2(i, 121) * W + t * (6 + 10 * h2(i, 122))) % W, y = 60 + h2(i, 123) * 600 + Math.sin(t * 0.7 + i) * 12;
          const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (2.5 + 3 * h2(i, 124)) + i * 1.7), 4);
          dot(g, x, y, 2 + 3 * h2(i, 125) + 4 * tw, '#ffffff', gf * (0.25 + 0.6 * tw), 'screen');
        }
      }
      // 近景：画面下角两簇失焦的枯草
      g.lineCap = 'round';
      for (const [x, y, s, k] of [[40, 752, 1.6, 0], [1250, 770, 1.3, 1]]) {
        for (let i = 0; i < 9; i++) {
          const a = -PI / 2 + (i / 8 - 0.5) * 1.6 + 0.07 * Math.sin(t * 1.3 + i) * (1 - gf), l = (70 + 50 * h2(i, k + 80)) * s;
          g.strokeStyle = rgba(i % 2 ? '#2e3026' : '#45402e', 0.5); g.lineWidth = 8 * s;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5, x + Math.cos(a + 0.3) * l, y + Math.sin(a + 0.3) * l); g.stroke();
        }
      }
    },
  });
  // =====================================================================
  // 间奏 x2 女娲时轮：女娲庙低机位仰视，神像睁眼，时光漩涡把少年的黑发一缕缕吹白
  // =====================================================================
  const X2 = {
    sx: 400, top: 86, bot: 700,       // 神像中轴、冠顶、蛇尾盘底（屏幕）
    fx: 784, fy: 704, fs: 1.72,       // 逍遥脚底与缩放
    vx: 640, vy: 400,                 // 漩涡
    vpx: 560, vpy: -1300,             // 仰视：竖线汇向高处
    gold: '#eacd76', gold2: '#f2be45', qing: '#24506a', lv: '#2c6a58', jade: '#88ada6',
  };
  const x2Lean = (xb, y, yb = H + 40) => xb + (X2.vpx - xb) * ((yb - y) / (yb - X2.vpy));

  // 一段管子：沿点列画，半径 rf(u)；上沿受光、下沿背光，鳞纹
  function x2Tube(q, pts, rf, base, lit, dark, scale) {
    const N = pts.length - 1, P = [];
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      P.push([pts[i][0], pts[i][1], -ty, tx, rf(i / N)]);
    }
    const edge = (k0, k1) => {
      q.beginPath();
      P.forEach(([x, y, nx, ny, r], i) => { const X = x + nx * r * k0, Y = y + ny * r * k0; i ? q.lineTo(X, Y) : q.moveTo(X, Y); });
      for (let i = N; i >= 0; i--) { const [x, y, nx, ny, r] = P[i]; q.lineTo(x + nx * r * k1, y + ny * r * k1); }
      q.closePath();
    };
    // 法线朝上的一侧受光
    const up = P[Math.floor(N / 2)][3] < 0 ? 1 : -1;
    edge(-1, 1); q.fillStyle = base; q.fill();
    edge(up * 1, up * 0.25); q.fillStyle = lit; q.fill();
    edge(up * 0.95, up * 0.7); q.fillStyle = rgba('#fff4d0', 0.35); q.fill();
    edge(-up * 1, -up * 0.45); q.fillStyle = dark; q.fill();
    if (scale) {
      q.strokeStyle = scale; q.lineWidth = 1;
      for (let i = 2; i < N - 1; i += 2) {
        const [x, y, nx, ny, r] = P[i];
        if (r < 6) continue;
        for (let k = -2; k <= 2; k++) {
          if ((i / 2 + k) % 2) continue;
          const sx = x + nx * r * k * 0.36, sy = y + ny * r * k * 0.36, a = Math.atan2(ny, nx) + PI / 2;
          q.beginPath(); q.arc(sx, sy, r * 0.2, a - 1.1, a + 1.1); q.stroke();
        }
      }
    }
    edge(-1, 1); q.strokeStyle = 'rgba(60,36,12,0.55)'; q.lineWidth = 1.3; q.stroke();
  }
  // 女娲像（未变形的局部坐标 640×720，中轴 x=320）：金身、石青石绿衣、人首蛇尾盘在石座上，双手捧五彩石
  function x2StatueRaw(q, awake) {
    const cx = 320, G = X2.gold, Gd = '#a8782e', Gs = '#6a4618';
    const skin = (x0, x1) => K.lin(q, x0, 0, x1, 0, [[0, '#c89a48'], [0.35, '#f4dc98'], [0.7, '#e2b866'], [1, '#9a6a2a']]);
    q.lineJoin = 'round'; q.lineCap = 'round';
    // 头光：石青、石绿两圈，外圈金焰
    const hy = 186;
    q.fillStyle = K.rad(q, cx, hy, 10, 96, [[0, 'rgba(255,236,170,0.6)'], [0.55, 'rgba(44,106,88,0.85)'], [0.75, 'rgba(36,80,106,0.9)'], [0.92, 'rgba(234,205,118,0.9)'], [1, 'rgba(234,205,118,0)']]);
    q.beginPath(); q.arc(cx, hy, 96, 0, TAU); q.fill();
    q.strokeStyle = G; q.lineWidth = 2.5; q.beginPath(); q.arc(cx, hy, 70, 0, TAU); q.stroke();
    q.lineWidth = 1.5; q.beginPath(); q.arc(cx, hy, 88, 0, TAU); q.stroke();
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; q.fillStyle = G; q.beginPath(); q.moveTo(cx + Math.cos(a - 0.08) * 92, hy + Math.sin(a - 0.08) * 92); q.quadraticCurveTo(cx + Math.cos(a) * 112, hy + Math.sin(a) * 112, cx + Math.cos(a + 0.1) * 104, hy + Math.sin(a + 0.1) * 104); q.lineTo(cx + Math.cos(a + 0.06) * 92, hy + Math.sin(a + 0.06) * 92); q.fill(); }
    // 披帛（身后那一段）：从肩后向两侧舒展成 S 形
    for (const sd of [-1, 1]) {
      q.fillStyle = K.lin(q, cx, 0, cx + sd * 300, 0, [[0, '#2c6a58'], [0.6, '#3e8a72'], [1, '#88ada6']]);
      q.beginPath(); q.moveTo(cx + sd * 60, 262);
      q.bezierCurveTo(cx + sd * 150, 230, cx + sd * 210, 300, cx + sd * 230, 380);
      q.bezierCurveTo(cx + sd * 250, 450, cx + sd * 300, 470, cx + sd * 312, 430);
      q.bezierCurveTo(cx + sd * 296, 456, cx + sd * 262, 440, cx + sd * 246, 390);
      q.bezierCurveTo(cx + sd * 222, 310, cx + sd * 160, 262, cx + sd * 64, 284);
      q.closePath(); q.fill();
      q.strokeStyle = G; q.lineWidth = 1.6; q.stroke();
    }
    // 长发垂在身后
    q.fillStyle = '#2a1c14';
    q.beginPath(); q.moveTo(cx - 36, 170); q.bezierCurveTo(cx - 70, 240, cx - 74, 330, cx - 54, 400); q.lineTo(cx + 54, 400); q.bezierCurveTo(cx + 74, 330, cx + 70, 240, cx + 36, 170); q.closePath(); q.fill();
    // —— 蛇尾：两圈盘在石座上，尾梢从左边绕到台前 ——
    const sk = (pts, r0, r1) => { const out = []; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < 8; j++) { const u = j / 8; out.push([lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]); } out.push(pts[pts.length - 1]); return out; };
    const crs = (pts, n) => {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        for (let j = 0; j < n; j++) {
          const s = j / n, f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * s + (2 * a - 5 * b + 4 * c2 - d) * s * s + (-a + 3 * b - 3 * c2 + d) * s * s * s);
          out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
        }
      }
      out.push(pts[pts.length - 1]);
      return out;
    };
    void sk;
    const scl = rgba('#5a3a10', 0.35);
    // 石座
    q.fillStyle = K.lin(q, 0, 640, 0, 720, [[0, '#6a5a44'], [1, '#2a2018']]);
    q.beginPath(); q.ellipse(cx, 690, 250, 40, 0, 0, TAU); q.fill(); q.fillRect(cx - 250, 690, 500, 40);
    // 后圈（在身后）
    x2Tube(q, crs([[cx + 40, 600], [cx + 190, 610], [cx + 230, 650], [cx + 130, 680], [cx - 60, 684], [cx - 200, 662], [cx - 210, 628], [cx - 120, 606]], 10), (u) => 44 - 6 * u, '#b88a3a', '#e6c372', '#6a4a1c', scl);
    // 从腰下来的一段 → 前圈
    x2Tube(q, crs([[cx, 430], [cx + 20, 500], [cx + 70, 560], [cx + 160, 600], [cx + 170, 640], [cx + 60, 668], [cx - 90, 666], [cx - 190, 640]], 10), (u) => 60 - 22 * u, '#c09440', '#ecca7c', '#6a4a1c', scl);
    // 腹甲：浅石绿一道
    // —— 身躯：交领上衣，大袖，双手捧石于胸前 ——
    // 下裳在腰间散开，盖住人身与蛇身的交接
    q.fillStyle = K.lin(q, cx - 120, 0, cx + 120, 0, [[0, '#183a46'], [0.4, '#2e6070'], [0.75, '#24506a'], [1, '#142a36']]);
    q.beginPath(); q.moveTo(cx - 70, 400); q.bezierCurveTo(cx - 120, 450, cx - 140, 500, cx - 128, 530); q.quadraticCurveTo(cx - 60, 512, cx, 530); q.quadraticCurveTo(cx + 60, 512, cx + 128, 530); q.bezierCurveTo(cx + 140, 500, cx + 120, 450, cx + 70, 400); q.closePath(); q.fill();
    q.strokeStyle = G; q.lineWidth = 2.2; q.beginPath(); q.moveTo(cx - 128, 530); q.quadraticCurveTo(cx - 60, 512, cx, 530); q.quadraticCurveTo(cx + 60, 512, cx + 128, 530); q.stroke();
    q.strokeStyle = 'rgba(10,24,30,0.5)'; q.lineWidth = 1.4;
    for (const k of [-90, -50, -12, 26, 64, 100]) { q.beginPath(); q.moveTo(cx + k * 0.55, 410); q.quadraticCurveTo(cx + k * 0.9, 470, cx + k, 522); q.stroke(); }
    // 上衣
    q.fillStyle = K.lin(q, cx - 90, 0, cx + 90, 0, [[0, '#1c4a44'], [0.45, '#3f7f6a'], [0.8, '#2c6a58'], [1, '#163a34']]);
    q.beginPath(); q.moveTo(cx - 78, 258); q.quadraticCurveTo(cx - 92, 330, cx - 70, 410); q.lineTo(cx + 70, 410); q.quadraticCurveTo(cx + 92, 330, cx + 78, 258); q.quadraticCurveTo(cx, 238, cx - 78, 258); q.fill();
    // 宽腰带
    q.fillStyle = '#7a3a22'; q.fillRect(cx - 74, 392, 148, 20); q.fillStyle = G; q.fillRect(cx - 74, 392, 148, 2.5); q.fillRect(cx - 74, 409, 148, 2.5);
    q.fillStyle = G; q.beginPath(); q.arc(cx, 402, 8, 0, TAU); q.fill();
    // 大袖：从肩到肘，袖口垂成大弧
    for (const sd of [-1, 1]) {
      q.fillStyle = K.lin(q, cx + sd * 40, 0, cx + sd * 170, 0, [[0, '#24506a'], [0.6, '#2e6a7a'], [1, '#183a4a']]);
      q.beginPath(); q.moveTo(cx + sd * 70, 256);
      q.bezierCurveTo(cx + sd * 130, 262, cx + sd * 150, 320, cx + sd * 146, 360);
      q.bezierCurveTo(cx + sd * 150, 420, cx + sd * 140, 470, cx + sd * 110, 484);
      q.quadraticCurveTo(cx + sd * 80, 470, cx + sd * 66, 420);
      q.lineTo(cx + sd * 30, 352); q.lineTo(cx + sd * 66, 300); q.closePath(); q.fill();
      q.strokeStyle = G; q.lineWidth = 2; q.beginPath(); q.moveTo(cx + sd * 110, 484); q.quadraticCurveTo(cx + sd * 80, 470, cx + sd * 66, 420); q.stroke();
      q.strokeStyle = 'rgba(8,20,28,0.5)'; q.lineWidth = 1.3;
      for (const k of [0.3, 0.55, 0.8]) { q.beginPath(); q.moveTo(cx + sd * lerp(80, 140, k), 280 + k * 40); q.quadraticCurveTo(cx + sd * lerp(90, 146, k), 380, cx + sd * lerp(76, 124, k), 470); q.stroke(); }
    }
    // 交领与衣缘
    q.strokeStyle = G; q.lineWidth = 3;
    q.beginPath(); q.moveTo(cx - 34, 246); q.lineTo(cx + 18, 330); q.moveTo(cx + 34, 246); q.lineTo(cx - 6, 312); q.stroke();
    q.fillStyle = '#f0e2c0'; q.beginPath(); q.moveTo(cx - 28, 246); q.lineTo(cx + 2, 296); q.lineTo(cx + 28, 246); q.closePath(); q.fill();
    // 双手：前臂收到胸前，手掌相托
    for (const sd of [-1, 1]) {
      q.fillStyle = K.lin(q, cx + sd * 70, 0, cx, 0, [[0, '#24506a'], [1, '#2e6a7a']]);
      q.beginPath(); q.moveTo(cx + sd * 64, 330); q.quadraticCurveTo(cx + sd * 40, 352, cx + sd * 14, 350); q.lineTo(cx + sd * 12, 368); q.quadraticCurveTo(cx + sd * 46, 374, cx + sd * 78, 360); q.closePath(); q.fill();
      q.strokeStyle = G; q.lineWidth = 1.6; q.beginPath(); q.moveTo(cx + sd * 14, 350); q.lineTo(cx + sd * 12, 368); q.stroke();
    }
    q.fillStyle = skin(cx - 24, cx + 24);
    q.beginPath(); q.moveTo(cx - 24, 354); q.quadraticCurveTo(cx, 376, cx + 24, 354); q.quadraticCurveTo(cx + 26, 364, cx + 12, 372); q.lineTo(cx - 12, 372); q.quadraticCurveTo(cx - 26, 364, cx - 24, 354); q.fill();
    // 颈与脸（金身，没有五官，只有闭着的眼线）
    q.fillStyle = skin(cx - 16, cx + 16); q.fillRect(cx - 14, 214, 28, 36);
    q.fillStyle = skin(cx - 34, cx + 34);
    q.beginPath(); q.ellipse(cx, 186, 31, 40, 0, 0, TAU); q.fill();
    q.fillStyle = 'rgba(120,80,30,0.25)'; q.beginPath(); q.ellipse(cx + 12, 192, 18, 34, 0.1, 0, TAU); q.fill();
    // 鬓发、高髻、金冠、步摇
    q.fillStyle = '#2a1c14';
    q.beginPath(); q.moveTo(cx - 32, 190); q.bezierCurveTo(cx - 40, 150, cx - 20, 136, cx, 136); q.bezierCurveTo(cx + 20, 136, cx + 40, 150, cx + 32, 190); q.quadraticCurveTo(cx + 26, 160, cx, 156); q.quadraticCurveTo(cx - 26, 160, cx - 32, 190); q.fill();
    q.beginPath(); q.ellipse(cx, 120, 24, 22, 0, 0, TAU); q.fill();
    q.beginPath(); q.ellipse(cx - 18, 112, 12, 16, -0.5, 0, TAU); q.fill(); q.beginPath(); q.ellipse(cx + 18, 112, 12, 16, 0.5, 0, TAU); q.fill();
    q.fillStyle = K.lin(q, 0, 100, 0, 150, [[0, '#fff0b8'], [1, '#b8862e']]);
    q.beginPath(); q.moveTo(cx - 36, 146); q.lineTo(cx - 28, 118); q.lineTo(cx - 14, 132); q.lineTo(cx, 100); q.lineTo(cx + 14, 132); q.lineTo(cx + 28, 118); q.lineTo(cx + 36, 146); q.quadraticCurveTo(cx, 138, cx - 36, 146); q.fill();
    q.fillStyle = '#c03a2a'; q.beginPath(); q.arc(cx, 128, 4, 0, TAU); q.fill();
    q.fillStyle = '#3a9a80'; q.beginPath(); q.arc(cx - 22, 134, 3, 0, TAU); q.arc(cx + 22, 134, 3, 0, TAU); q.fill();
    q.strokeStyle = G; q.lineWidth = 1.6;
    for (const sd of [-1, 1]) { q.beginPath(); q.moveTo(cx + sd * 26, 130); q.lineTo(cx + sd * 54, 112); q.stroke(); for (let k = 0; k < 3; k++) { q.beginPath(); q.moveTo(cx + sd * 54, 112); q.lineTo(cx + sd * (52 + k * 4), 132 + k * 4); q.stroke(); } }
    // 眼：睡着是两道下弯的细线；醒来是两道金白的光缝
    if (!awake) {
      q.strokeStyle = 'rgba(90,56,20,0.85)'; q.lineWidth = 1.8;
      for (const sd of [-1, 1]) { q.beginPath(); q.moveTo(cx + sd * 6, 184); q.quadraticCurveTo(cx + sd * 13, 189, cx + sd * 21, 184); q.stroke(); }
    } else {
      for (const sd of [-1, 1]) { q.fillStyle = '#fff8e0'; q.beginPath(); q.moveTo(cx + sd * 5, 184); q.quadraticCurveTo(cx + sd * 13, 177, cx + sd * 22, 183); q.quadraticCurveTo(cx + sd * 13, 189, cx + sd * 5, 184); q.fill(); }
    }
    // 衣上的金线团花
    q.strokeStyle = rgba(G, 0.6); q.lineWidth = 1.2;
    for (const [x, y] of [[cx - 40, 300], [cx + 44, 316], [cx - 50, 470], [cx + 56, 480], [cx, 495]]) { q.beginPath(); q.arc(x, y, 9, 0, TAU); q.moveTo(x + 4, y); q.arc(x, y, 4, 0, TAU); q.stroke(); }
    // 金身受光：左上来的神光，一道亮边
    q.globalCompositeOperation = 'source-atop';
    q.fillStyle = K.lin(q, 0, 80, 0, 720, [[0, 'rgba(255,230,160,0.18)'], [0.5, 'rgba(255,230,160,0)'], [1, 'rgba(30,16,6,0.35)']]); q.fillRect(0, 0, 640, 720);
    q.globalCompositeOperation = 'source-over';
  }
  // 仰视透视：上窄下宽、越高越扁；按横条贴进缓存（只在建缓存时做）
  const X2WARP = { top: 0.8, h: 0.78 };
  function x2Statue(awake) {
    return K.cache('g08|x2st' + (awake ? 'a' : 's'), 640, 720, 1, (q) => {
      const raw = K.cache('g08|x2stR' + (awake ? 'a' : 's'), 640, 720, 1, (p) => x2StatueRaw(p, awake));
      // y'(y)：从底往上积分竖向比例
      const n = 72, Y = [720];
      for (let i = n - 1; i >= 0; i--) { const u = (i + 0.5) / n; Y.unshift(Y[0] - (720 / n) * lerp(X2WARP.h, 1, u)); }
      const off = Y[0];
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, hs = lerp(X2WARP.top, 1, u), y0 = (i * 720) / n, y1 = ((i + 1) * 720) / n;
        const d0 = Y[i] - off, d1 = Y[i + 1] - off;
        const sc = 720 / (720 - off);
        q.drawImage(raw, 0, y0 * raw.height / 720, raw.width, ((y1 - y0) * raw.height) / 720 + 1, 320 - 320 * hs, d0 * sc, 640 * hs, (d1 - d0) * sc + 0.8);
      }
    });
  }
  // 局部 y（0..720）映射到变形后（0..720）
  function x2WarpY(y) {
    const n = 72;
    let s = 0, tot = 0;
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, h = (720 / n) * lerp(X2WARP.h, 1, u); tot += h; if ((i + 1) * 720 / n <= y) s += h; else if (i * 720 / n < y) s += h * ((y - i * 720 / n) / (720 / n)); }
    return 720 - (tot - s) * (720 / tot);
  }

  // 殿堂（缓存，不透明）：后墙、背光、藻井与梁枋、收分的柱、天窗泻下的光柱
  function x2HallBody(q) {
    const r = A.rng(2401);
    q.fillStyle = K.lin(q, 0, -40, 0, H + 40, [[0, '#0e0a0a'], [0.45, '#22140e'], [1, '#2e1c14']]); q.fillRect(0, -40, W, H + 80);
    // 后墙残存的金线祥云壁画与石青团花
    q.strokeStyle = 'rgba(216,168,74,0.12)'; q.lineWidth = 2;
    for (let k = 0; k < 16; k++) { const x = r() * W, y = 140 + r() * 420, s = 40 + r() * 50; q.beginPath(); q.arc(x, y, s * 0.3, PI * 0.2, PI * 1.7); q.arc(x + s * 0.36, y - s * 0.06, s * 0.2, PI * 1.2, PI * 2.6); q.moveTo(x - s * 0.5, y + s * 0.3); q.quadraticCurveTo(x, y + s * 0.15, x + s * 0.6, y + s * 0.3); q.stroke(); }
    // 大背光：火焰形，金边，里层石青石绿
    const cx = X2.sx, cy = 330;
    const flame = () => { q.beginPath(); q.moveTo(cx - 300, H + 40); q.bezierCurveTo(cx - 340, 220, cx - 130, 60, cx, -20); q.bezierCurveTo(cx + 130, 60, cx + 340, 220, cx + 300, H + 40); q.closePath(); };
    flame(); q.fillStyle = K.rad(q, cx, cy, 20, 560, [[0, '#7a5a2a'], [0.3, '#3e3a2a'], [0.55, '#1e2e30'], [0.8, '#1a1a18'], [1, '#160e0a']]); q.fill();
    q.save(); flame(); q.clip();
    for (let k = 0; k < 5; k++) { q.strokeStyle = k % 2 ? 'rgba(44,106,88,0.55)' : 'rgba(36,80,106,0.55)'; q.lineWidth = 9; q.beginPath(); q.ellipse(cx, cy + 40, 170 + k * 30, 240 + k * 40, 0, PI * 1.02, PI * 1.98); q.stroke(); }
    q.strokeStyle = 'rgba(255,214,130,0.14)'; q.lineWidth = 1.4;
    for (let k = 0; k < 80; k++) { const a = -PI + (k / 80) * PI; q.beginPath(); q.moveTo(cx, cy); q.lineTo(cx + Math.cos(a) * 640, cy + Math.sin(a) * 820); q.stroke(); }
    for (let k = 0; k < 5; k++) { q.strokeStyle = 'rgba(234,205,118,' + (0.4 - k * 0.06).toFixed(3) + ')'; q.lineWidth = 2; q.beginPath(); q.ellipse(cx, cy + 40, 155 + k * 30, 225 + k * 40, 0, PI * 1.02, PI * 1.98); q.stroke(); }
    q.restore();
    flame(); q.strokeStyle = X2.gold; q.lineWidth = 5; q.stroke();
    for (let k = 0; k < 28; k++) {
      const u = k / 27, side = u < 0.5 ? -1 : 1, v = u < 0.5 ? u * 2 : (1 - u) * 2;
      const ex = cx + side * lerp(0, 318, Math.pow(1 - v, 0.6)), ey = lerp(H, -10, v);
      q.fillStyle = 'rgba(234,205,118,0.55)';
      q.beginPath(); q.moveTo(ex, ey); q.quadraticCurveTo(ex + side * 22, ey - 10, ex + side * 10, ey - 30); q.quadraticCurveTo(ex + side * 4, ey - 14, ex, ey); q.fill();
    }
    // 藻井：顶上一片向高处退去的方格天花，石青石绿相间，金边、团花
    const rows = [[-40, -6], [-6, 22], [22, 44], [44, 60]];
    for (let ri = 0; ri < rows.length; ri++) {
      const [y0, y1] = rows[ri];
      for (let k = -9; k <= 9; k++) {
        const xb0 = X2.vpx + k * 150, xb1 = X2.vpx + (k + 1) * 150;
        const a0 = x2Lean(xb0, y1, 120), a1 = x2Lean(xb1, y1, 120), b0 = x2Lean(xb0, y0, 120), b1 = x2Lean(xb1, y0, 120);
        q.beginPath(); q.moveTo(a0, y1); q.lineTo(a1, y1); q.lineTo(b1, y0); q.lineTo(b0, y0); q.closePath();
        q.fillStyle = (k + ri) % 2 ? '#1e4656' : '#245a4c'; q.fill();
        q.strokeStyle = 'rgba(234,205,118,0.75)'; q.lineWidth = 2; q.stroke();
        const mx = (a0 + a1 + b0 + b1) / 4, my = (y0 + y1) / 2, rr = (y1 - y0) * 0.32;
        q.fillStyle = 'rgba(234,205,118,0.7)'; q.beginPath(); q.ellipse(mx, my, rr * 1.6, rr, 0, 0, TAU); q.fill();
        q.fillStyle = '#7a2a1e'; q.beginPath(); q.ellipse(mx, my, rr * 0.7, rr * 0.45, 0, 0, TAU); q.fill();
      }
    }
    // 梁枋底面：旋子彩画
    const beam = (y0, h) => {
      q.fillStyle = '#2c5a50'; q.fillRect(0, y0, W, h);
      q.fillStyle = X2.gold; q.fillRect(0, y0, W, 2); q.fillRect(0, y0 + h - 2, W, 2);
      for (let x = -40; x < W; x += 170) {
        q.fillStyle = X2.qing; q.beginPath(); q.moveTo(x + 30, y0 + h / 2); q.lineTo(x + 50, y0 + 4); q.lineTo(x + 112, y0 + 4); q.lineTo(x + 132, y0 + h / 2); q.lineTo(x + 112, y0 + h - 4); q.lineTo(x + 50, y0 + h - 4); q.closePath(); q.fill();
        q.strokeStyle = X2.gold; q.lineWidth = 1.2; q.stroke();
        for (const dx of [146, 16]) { q.fillStyle = '#3a7a66'; q.beginPath(); q.arc(x + dx, y0 + h / 2, h * 0.34, 0, TAU); q.fill(); q.strokeStyle = 'rgba(234,205,118,0.85)'; q.stroke(); q.fillStyle = X2.gold; q.beginPath(); q.arc(x + dx, y0 + h / 2, h * 0.1, 0, TAU); q.fill(); }
      }
    };
    beam(60, 26);
    // 斗拱
    for (let x = 30; x < W; x += 74) {
      q.fillStyle = '#4a2418'; q.fillRect(x - 18, 86, 36, 8); q.fillRect(x - 26, 94, 52, 6); q.fillRect(x - 10, 100, 20, 9);
      q.fillStyle = X2.qing; q.fillRect(x - 24, 94.5, 7, 5); q.fillRect(x + 17, 94.5, 7, 5);
      q.fillStyle = 'rgba(234,205,118,0.7)'; q.fillRect(x - 26, 94, 52, 1.4);
    }
    q.fillStyle = '#2a140c'; q.fillRect(0, 108, W, 8); q.fillStyle = 'rgba(234,205,118,0.55)'; q.fillRect(0, 115, W, 2);
    // 柱：仰视下向上收拢；红漆褪成赭色，背光一侧偏冷
    const col = (xb, wb, dark) => {
      const y0 = 116, y1 = H + 40;
      const xa = x2Lean(xb, y0), xc = x2Lean(xb + wb, y0);
      const path = () => { q.beginPath(); q.moveTo(xb, y1); q.lineTo(xa, y0); q.lineTo(xc, y0); q.lineTo(xb + wb, y1); q.closePath(); };
      path();
      const lit = xb + wb / 2 < X2.sx + 100;
      q.fillStyle = K.lin(q, xb, 0, xb + wb, 0, lit ? [[0, '#2e3a46'], [0.5, '#5e2e24'], [0.85, '#8a4a30'], [1, '#a8643a']] : [[0, '#a8643a'], [0.15, '#8a4a30'], [0.5, '#5e2e24'], [1, '#2e3a46']]);
      q.fill();
      for (const yy of [150, 186, H - 30]) { const xl = x2Lean(xb, yy), xr = x2Lean(xb + wb, yy); q.fillStyle = '#c89a3e'; q.fillRect(xl, yy, xr - xl, 7); q.fillStyle = 'rgba(255,230,160,0.45)'; q.fillRect(xl, yy, xr - xl, 1.5); }
      q.strokeStyle = 'rgba(216,168,74,0.3)'; q.lineWidth = 3;
      q.beginPath();
      for (let k = 0; k <= 30; k++) { const u = k / 30, yy = lerp(210, H - 50, u), xl = x2Lean(xb, yy), xr = x2Lean(xb + wb, yy); const px = lerp(xl, xr, 0.5 + 0.42 * Math.sin(u * PI * 3.2)); k ? q.lineTo(px, yy) : q.moveTo(px, yy); }
      q.stroke();
      if (dark) { path(); q.fillStyle = 'rgba(14,16,22,' + dark + ')'; q.fill(); }
    };
    col(1060, 64, 0.3); col(-70, 170, 0.5); col(1160, 190, 0.5);
    // 天窗泻下的光柱（烘进底图，逐帧只动浮尘）
    q.save(); q.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 5; k++) {
      const x0 = 330 + k * 46, ang = 0.12 + k * 0.05, L = 900, w0 = 30 + k * 8, w1 = 120 + k * 30;
      const ex = x0 + Math.sin(ang) * L, ey = 60 + Math.cos(ang) * L;
      const gr = q.createLinearGradient(x0, 60, ex, ey); gr.addColorStop(0, 'rgba(255,220,150,0.16)'); gr.addColorStop(0.5, 'rgba(255,214,140,0.07)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
      q.fillStyle = gr; q.beginPath(); q.moveTo(x0 - w0 / 2, 60); q.lineTo(x0 + w0 / 2, 60); q.lineTo(ex + w1 / 2, ey); q.lineTo(ex - w1 / 2, ey); q.closePath(); q.fill();
    }
    A.softBlob(q, X2.sx + 60, 60, 220, 0.25, '#ffd890');
    q.restore();
  }
  // 供台前裙（只露边沿）与一截搭到台前的蛇尾梢
  function x2Front(q) {
    // 台沿与前裙
    q.fillStyle = K.lin(q, 0, 640, 0, 720, [[0, '#5a2a1e'], [1, '#2a120c']]);
    q.beginPath(); q.moveTo(118, 644); q.lineTo(690, 644); q.lineTo(704, 760); q.lineTo(104, 760); q.closePath(); q.fill();
    q.fillStyle = '#7a3a26'; q.fillRect(108, 636, 592, 12); q.fillStyle = 'rgba(234,205,118,0.85)'; q.fillRect(108, 636, 592, 2);
    q.strokeStyle = 'rgba(234,205,118,0.5)'; q.lineWidth = 2; q.strokeRect(150, 660, 508, 100);
    for (let k = 0; k < 5; k++) { const x = 210 + k * 98, y = 704; q.beginPath(); q.arc(x, y - 6, 14, PI * 0.15, PI * 0.95, true); q.arc(x - 18, y + 4, 10, -PI * 0.2, PI * 0.9, true); q.moveTo(x + 10, y); q.arc(x + 18, y + 4, 10, PI * 1.2, PI * 0.1); q.stroke(); }
    // 烛台一排
    for (let k = 0; k < 8; k++) { const x = 160 + k * 70 + (k > 3 ? 40 : 0); q.fillStyle = '#8a6a30'; q.beginPath(); q.moveTo(x - 8, 636); q.lineTo(x + 8, 636); q.lineTo(x + 4, 626); q.lineTo(x - 4, 626); q.closePath(); q.fill(); q.fillStyle = '#e8dcc0'; q.fillRect(x - 2.5, 610, 5, 16); }
    // 香炉
    q.fillStyle = K.lin(q, 360, 0, 440, 0, [[0, '#5a4a28'], [0.4, '#c8a858'], [1, '#2a2010']]);
    q.beginPath(); q.moveTo(352, 604); q.quadraticCurveTo(346, 636, 372, 640); q.lineTo(428, 640); q.quadraticCurveTo(454, 636, 448, 604); q.closePath(); q.fill();
    q.fillRect(346, 598, 108, 8);
    for (const sd of [-1, 1]) { q.strokeStyle = '#9a8040'; q.lineWidth = 4; q.beginPath(); q.arc(400 + sd * 44, 588, 7, PI * 0.9, PI * 2.1); q.stroke(); }
    q.strokeStyle = '#6a3a1a'; q.lineWidth = 1.6; for (const dx of [-10, 0, 10]) { q.beginPath(); q.moveTo(400 + dx, 598); q.lineTo(400 + dx * 1.4, 560); q.stroke(); }
    // 蛇尾梢从像座左边绕下来，搭在台沿上
    const pts = [];
    for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push([lerp(190, 132, u) + Math.sin(u * PI * 1.4) * 40, lerp(596, 700, u) - Math.sin(u * PI) * 30]); }
    x2Tube(q, pts, (u) => lerp(26, 5, Math.pow(u, 0.9)), '#b88a3a', '#e6c372', '#6a4a1c', rgba('#5a3a10', 0.35));
  }
  // 整幅静景两版（神像睡 / 醒）：殿堂 + 变形后的神像 + 台前；局部 y = 屏幕 y + 40
  function x2Scene(awake) {
    return K.cache('g08|x2scene' + (awake ? 'a' : 's'), W, H + 60, 1, (q) => {
      q.translate(0, 40);
      x2HallBody(q);
      const st = x2Statue(awake), yT = x2WarpY(96), sc = (X2.bot - X2.top) / (720 - yT);
      q.drawImage(st, X2.sx - 320 * sc, X2.bot - 720 * sc, 640 * sc, 720 * sc);
      x2Front(q);
    });
  }
  // 神像局部坐标（变形前）→ 屏幕
  function x2SP(x, y) {
    const yT = x2WarpY(96), sc = (X2.bot - X2.top) / (720 - yT), yw = x2WarpY(y), u = clamp(y / 720), hs = lerp(X2WARP.top, 1, u);
    return [X2.sx + (x - 320) * hs * sc, X2.bot - (720 - yw) * sc, sc];
  }
  // 麒麟角：一支弯曲的螺纹兽角，(x, y) 为握处，a 角尖方向，L 长
  function qilinHorn(g, x, y, a, L, glow) {
    const ca = Math.cos(a), sa = Math.sin(a);
    dot(g, x + ca * L * 0.55, y + sa * L * 0.55, 46 + 40 * glow, '#ffd27a', 0.2 + 0.35 * glow);
    g.save(); g.translate(x, y); g.rotate(a);
    const pts = [];
    for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push([u * L, -Math.sin(u * PI * 0.8) * L * 0.2 - u * u * L * 0.1, Math.pow(1 - u, 0.8) * L * 0.13 + 0.6]); }
    const outline = () => {
      g.beginPath();
      pts.forEach(([px, py, w], i) => (i ? g.lineTo(px, py - w) : g.moveTo(px, py - w)));
      for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + pts[i][2]);
      g.closePath();
    };
    outline();
    g.fillStyle = K.lin(g, 0, -L * 0.3, 0, L * 0.12, [[0, '#fff6dc'], [0.5, '#e8cc8a'], [1, '#9a6e34']]); g.fill();
    g.strokeStyle = 'rgba(90,56,20,0.7)'; g.lineWidth = 1.2; g.stroke();
    g.save(); outline(); g.clip();
    g.strokeStyle = 'rgba(110,70,26,0.55)'; g.lineWidth = 1.4;
    for (let i = 1; i < 13; i++) { const [px, py, w] = pts[i], [qx, qy, w2] = pts[i + 1]; g.beginPath(); g.moveTo(px, py - w); g.quadraticCurveTo((px + qx) / 2 + w * 0.6, (py + qy) / 2, qx, qy + w2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,240,0.45)'; g.beginPath(); pts.forEach(([px, py, w], i) => (i ? g.lineTo(px, py - w * 0.5) : g.moveTo(px, py - w * 0.5))); g.lineTo(L, pts[16][1]); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#c8962e'; g.fillRect(-2, -L * 0.15, 5, L * 0.3);
    g.restore();
    const [ex, ey] = pts[16], tx = x + ca * ex - sa * ey, ty = y + sa * ex + ca * ey;
    dot(g, tx, ty, 14 + 22 * glow, '#fff2c8', 0.45 + 0.4 * glow);
    return [tx, ty];
  }
  // 发丝：8 缕细长的贝塞尔，顺风从头后向右下飘；k 缕的形状（相对头顶，单位为人物缩放 s）
  const x2Strand = (k, t) => {
    const a = h2(k, 901), b = h2(k, 902), w = Math.sin(t * 2.6 + k * 1.3);
    return [[1 + a * 3, 1 + b * 2], [3 + a * 6 + w * 0.5, 20 + b * 3], [6 + a * 11 + w, 40 + b * 3], [22 + a * 20 + w * 2, 57 + b * 5 - w]];
  };

  // 推镜中心：他的头（姿势固定，取一次）
  let x2ZcM = null;
  const x2Zc = () => x2ZcM || (x2ZcM = ((P) => [P.head[0] + 20, P.head[1] + 10])(F.points('xiaoyao', X2.fx, X2.fy, X2.fs, 0, { stage: 'hero', pose: 'swordUp', facing: -1, wind: 1, windDir: 1, hairLoose: true })));

  XYT.registerShot('x2_nuwa', {
    name: '女娲时轮', zone: 'top', night: true, text: '#1a2026', shadow: 'rgba(255,240,200,0.85)', accent: '#f2be45', bloom: 0.36,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      // 节拍：第一个强拍神像睁眼、漩涡展开；第二个强拍起黑发变白（三连音一缕，9 秒前白完）
      const wakeT = beatAt(c, 1.5, 0, true, 3.33), whiteT = beatAt(c, wakeT + 1, 0, true, 6.68);
      const bp = Math.max(0.5, (whiteT - wakeT) / 4), sub = bp / 3;
      const endT = Math.max(whiteT + 2.4, Math.min(c.dur - 0.9, 9.1));
      const wake = easeOut(seg(lt, wakeT, wakeT + 0.45));
      const vAmt = easeOut(seg(lt, wakeT, wakeT + 1.6));
      // 镜头：缓慢上升（整数像素）；变白时推向他的头
      const rise = Math.round(lerp(-20, 16, easeInOut(seg(lt, 0, whiteT))));
      const push = easeInOut(seg(lt, whiteT - 0.2, endT));
      const zc = x2Zc();
      g.save();
      if (push > 0.001) { const z = 1 + 0.28 * push; g.translate(zc[0], zc[1]); g.scale(z, z); g.translate(-zc[0], -zc[1]); }
      g.translate(0, rise);
      // —— 静景：睡着的神像 → 睁眼 ——
      if (wake < 1) g.drawImage(x2Scene(false), 0, -40, W, H + 60);
      if (wake > 0) { g.globalAlpha = wake; g.drawImage(x2Scene(true), 0, -40, W, H + 60); g.globalAlpha = 1; }
      // 光柱里的浮尘
      V.dust(g, c, { n: 42, size: [0.8, 2.4], speed: 1, color: '#ffe6b0', alpha: 0.7, light: { x: 420, y: 60, angle: PI / 2 - 0.18, spread: 0.32, len: 760 } });
      // 幡：两条长幡垂在背光两侧，被漩涡的风越吹越斜
      const wind = 0.3 + 0.7 * vAmt;
      for (const [bx, k, col] of [[118, 0, '#c89a3e'], [930, 1, '#3e7a6a']]) {
        const n = 16, L = 300, wd = 28;
        const pts = [];
        for (let i = 0; i <= n; i++) { const u = i / n, sw = (Math.sin(t * 1.4 + u * 4 + k * 2) * 6 + Math.sin(t * 3.1 + u * 7) * 2) * u + wind * 60 * u * u * (k ? 1 : -0.4); pts.push([bx + sw, 116 + u * L]); }
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x - wd / 2, y) : g.moveTo(x - wd / 2, y)));
        for (let i = n; i >= 0; i--) g.lineTo(pts[i][0] + wd / 2, pts[i][1]);
        g.closePath();
        g.fillStyle = K.lin(g, bx - wd, 0, bx + wd, 0, [[0, mix(col, '#000000', 0.45)], [0.5, col], [1, mix(col, '#000000', 0.5)]]); g.fill();
        g.strokeStyle = 'rgba(234,205,118,0.55)'; g.lineWidth = 1.2;
        for (let j = 1; j < 6; j++) { const [x, y] = pts[Math.round((j * n) / 6)]; g.strokeRect(x - 7, y - 7, 14, 14); }
        const [ex, ey] = pts[n];
        g.fillStyle = col; g.beginPath(); g.moveTo(ex - wd / 2, ey); g.lineTo(ex, ey + 18); g.lineTo(ex + wd / 2, ey); g.fill();
      }
      // 神像：五彩石（醒前暗，醒后五色散开）与双目的光
      {
        const [sx, sy, sc] = x2SP(320, 362), [ex, ey] = x2SP(320, 182);
        const f = 0.85 + 0.15 * Math.sin(t * 2.2), on = 0.25 + 0.75 * wake;
        dot(g, sx, sy, 40 * sc, '#ffe6a8', 0.25 * on * f);
        ['#ff6a5a', '#ffd25a', '#5affa0', '#5aaaff', '#d08aff'].forEach((c2, k) => { const a = t * 0.9 + (k / 5) * TAU; dot(g, sx + Math.cos(a) * 18 * sc * on, sy + Math.sin(a) * 8 * sc * on, 12 * sc, c2, 0.45 * on); });
        if (wake > 0) {
          for (const sd of [-1, 1]) dot(g, ex + sd * 13 * sc, ey, (6 + 6 * c.de(0.6)) * sc, '#fff8e0', 0.9 * wake);
          dot(g, ex, ey, 60 * sc, '#ffd890', 0.25 * wake);
          // 睁眼的一瞬：头光一亮
          const u = seg(lt, wakeT - 0.05, wakeT + 1.2);
          if (u > 0 && u < 1) dot(g, ex, ey, 60 + 240 * easeOut(u), '#fff2c8', 0.55 * (1 - u) * (1 - u));
        }
      }
      // 长明灯火苗
      for (let k = 0; k < 8; k++) {
        const x = 160 + k * 70 + (k > 3 ? 40 : 0), fl = 0.75 + 0.25 * noise1(t * 6 + k * 3, 4), lean = 2 * vAmt * Math.sin(t * 3 + k);
        dot(g, x, 600, 20 * fl, '#ffb050', 0.55);
        g.fillStyle = rgba('#fff2c0', 0.92); g.beginPath(); g.ellipse(x + lean, 604 - 5 * fl, 2.2, 6 * fl, lean * 0.08, 0, TAU); g.fill();
      }
      // 香烟：三炷香，烟在光柱里发亮、缓缓盘旋；漩涡开后被吸向漩涡
      V.smoke(g, c, { kind: 'incense', x: 400, y: 562, h: 280, n: 3, width: 1.8, wind: 0.2 + 0.5 * vAmt, color: '#fff2dc', alpha: 0.26, seed: 171 });
      if (vAmt > 0.02) {
        // 被扯进漩涡的烟缕：细、淡，绕着漩涡卷进去
        g.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.3 + k / 3) % 1;
          g.strokeStyle = rgba('#fff0d8', 0.12 * vAmt * Math.sin(ph * PI)); g.lineWidth = 2.2;
          g.beginPath();
          for (let i = 0; i <= 22; i++) { const u = i / 22, a = PI * 0.8 + u * 3.2 + ph * 1.5, rr = lerp(240, 16, u); const x = X2.vx + Math.cos(a) * rr, y = X2.vy + Math.sin(a) * rr * 0.7; i ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.stroke();
        }
      }
      // 时光漩涡：强拍上从一点展开，冲出一道光环；星轨随拍旋转
      const sur = V.util.surge(c, 6);
      if (vAmt > 0.003) {
        V.timeVortex(g, c, { x: X2.vx, y: X2.vy, r: lerp(190, 280, vAmt) / (1 + 0.12 * push), amount: vAmt, tilt: 0.78, dir: 1, color: '#ffd88a', color2: '#88ada6', time: t + sur * 0.5, beat: 0.7, n: 56, alpha: 0.8 });
        const sh = seg(lt, wakeT, wakeT + 1.1);
        if (sh > 0 && sh < 1) { g.strokeStyle = rgba('#fff4d0', 0.8 * (1 - sh)); g.lineWidth = 3 + 6 * (1 - sh); g.beginPath(); g.ellipse(X2.vx, X2.vy, 60 + 620 * easeOut(sh), (60 + 620 * easeOut(sh)) * 0.78, 0, 0, TAU); g.stroke(); }
        // 强拍：两三道大星轨扫过整个画面
        g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
        const sd = c.b.sinceDown;
        if (sd < 1.4 && lt > wakeT) {
          for (let k = 0; k < 3; k++) {
            const R = 380 + k * 150, a0 = -PI * 0.2 + k * 2.1 + c.b.di * 0.7, head = a0 + easeOut(sd / 1.4) * 2.4, al = 0.5 * (1 - sd / 1.4) * vAmt;
            for (let i = 0; i < 16; i++) {
              const a1 = head - i * 0.05, a2 = a1 - 0.05;
              g.strokeStyle = rgba(k === 1 ? '#bfe6dc' : '#ffe2a0', al * (1 - i / 16)); g.lineWidth = 3 * (1 - i / 16) + 0.5;
              g.beginPath(); g.moveTo(X2.vx + Math.cos(a1) * R, X2.vy + Math.sin(a1) * R * 0.62); g.lineTo(X2.vx + Math.cos(a2) * R, X2.vy + Math.sin(a2) * R * 0.62); g.stroke();
            }
            dot(g, X2.vx + Math.cos(head) * R, X2.vy + Math.sin(head) * R * 0.62, 12, '#fff8e0', al * 1.6, 'lighter');
          }
        }
        g.globalCompositeOperation = 'source-over';
      }
      // —— 逍遥：举着发光的麒麟角，被漩涡风吹得衣发后掠；黑发一缕缕变白，最后跨进老年 ——
      const NS = 8, sT = (j) => whiteT + j * sub, allW = sT(NS - 1) + 0.4;
      const oldT = Math.min(endT - 0.15, allW + 0.1);
      const flare = bump(lt, oldT - 0.35, oldT, oldT + 0.45);
      const o = { stage: lt < oldT ? 'hero' : 'old', pose: 'swordUp', prop: 'none', facing: -1, wind: 0.6 + 0.4 * vAmt, windDir: 1, hairLoose: true, whiteHair: lt >= allW, rim: '#ffe2a8', light: [X2.vx - 40, X2.vy - 40], rimWidth: 1.8, rimAlpha: 1 };
      F.draw(g, 'xiaoyao', X2.fx, X2.fy, X2.fs, t, o);
      const P = F.points('xiaoyao', X2.fx, X2.fy, X2.fs, t, o);
      // 白发：每缕从发梢往发根长，最前端一点星光
      if (lt > whiteT && lt < allW + 0.35) {
        const [tx0, ty0] = P.top, s = X2.fs, fadeOut = 1 - seg(lt, allW, allW + 0.35);
        g.lineCap = 'round';
        for (let j = 0; j < NS; j++) {
          const u = smooth(seg(lt, sT(j), sT(j) + 0.4));
          if (u <= 0) continue;
          const pts = x2Strand(j, t).map(([x, y]) => [tx0 + x * s, ty0 + y * s]);
          const B = (v) => { const a = 1 - v; return [a * a * a * pts[0][0] + 3 * a * a * v * pts[1][0] + 3 * a * v * v * pts[2][0] + v * v * v * pts[3][0], a * a * a * pts[0][1] + 3 * a * a * v * pts[1][1] + 3 * a * v * v * pts[2][1] + v * v * v * pts[3][1]]; };
          const v0 = 1 - u, M = 10;
          for (let i = 0; i < M; i++) {
            const va = lerp(v0, 1, i / M), vb = lerp(v0, 1, (i + 1) / M), [ax, ay] = B(va), [bx, by] = B(vb);
            g.strokeStyle = rgba('#f6f2e8', 0.95 * fadeOut); g.lineWidth = (0.6 + 2.6 * Math.sin(PI * (0.15 + 0.7 * va))) * s * 0.6;
            g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
          }
          if (u < 1) { const [fx2, fy2] = B(v0); dot(g, fx2, fy2, 9, '#ffffff', 0.9, 'lighter'); dot(g, fx2, fy2, 22, '#ffe6b0', 0.4, 'lighter'); }
        }
      }
      // 跨进老年的一瞬：金白的光把他裹住
      if (flare > 0) { dot(g, P.chest[0], P.chest[1] - 40, 260, '#fff2d0', 0.75 * flare, 'lighter'); dot(g, P.head[0], P.head[1], 90, '#ffffff', 0.6 * flare, 'lighter'); }
      // 麒麟角：握在高举的手里，每拍亮一次
      {
        const [hx, hy] = P.handN;
        const pulse = c.be(0.35) * (0.6 + 0.4 * (1 - vAmt)) + 0.3 * vAmt;
        const [tx, ty] = qilinHorn(g, hx, hy + 6, -PI / 2 - 0.62, 40 * X2.fs, pulse);
        if (vAmt > 0.02) {
          g.strokeStyle = rgba('#fff0c0', 0.35 * vAmt * (0.6 + 0.4 * pulse)); g.lineWidth = 2;
          g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo((tx + X2.vx) / 2, ty - 40, X2.vx, X2.vy); g.stroke();
        }
      }
      // 漩涡吹出的光尘：从漩涡向人物这边飞
      if (vAmt > 0.02) {
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 45; i++) {
          const u = (h2(i, 31) + t * (0.35 + 0.3 * h2(i, 32))) % 1, a = (h2(i, 33) - 0.5) * 1.4;
          const x = X2.vx + Math.cos(a) * (60 + u * 640), y = X2.vy + Math.sin(a) * (40 + u * 320) * 0.7 + 50 * u * u;
          const sz = 1 + 2.5 * h2(i, 34);
          g.globalAlpha = 0.7 * vAmt * Math.sin(u * PI);
          g.drawImage(tintS('#ffe8b0'), x - sz * 2, y - sz * 2, sz * 4, sz * 4);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      }
      g.restore();
    },
  });
  // =====================================================================
  // 间奏 x3 长卷故地：青绿山水长卷横移，五处旧地的灯火随拍一盏盏熄灭，人去楼空
  // =====================================================================
  // 卷面坐标：中景 X 在屏幕上位于 X - P(lt)；远景 0.2 倍、近景 1.75 倍（视差）
  const X3 = {
    top: 40, bot: 680, hor: 430,                  // 画心上下边、地平线（画高约 60%）
    sites: [640, 1140, 1640, 2140, 2650],         // 祭坛、锁妖塔、擂台、客栈、仙灵岛
  };
  const X3M0 = -600, X3MW = 3960, X3F0 = -140, X3FW = 1840;
  // 卷速按拍：每拍经过一处小景、灯在画面正中熄灭；第 4 拍后减速，停在仙灵岛
  function x3Clock(c) {
    const b0 = beatAt(c, -0.15, 0, false, 0), b1 = beatAt(c, -0.15, 1, false, 0.833);
    const bp = clamp(b1 - b0, 0.45, 1.2), v = 500 / bp;
    return { bp, b0, v, cruise: b0 + 3.3 * bp, T: 1.44 * bp, beat: (k) => beatAt(c, -0.15, k, false, b0 + k * bp) };
  }
  function x3P(lt, k) {
    const x = lt - k.b0;
    if (lt <= k.cruise) return k.v * x;
    const d = Math.min(lt, k.cruise + k.T) - k.cruise;
    return k.v * (k.cruise - k.b0) + k.v * d - (k.v / (2 * k.T)) * d * d;
  }
  // 青绿设色：山脊石青、山腰石绿、山脚赭石；墨线有粗细，皴笔顺坡成簇，金线勾脊
  const QL = { blue: '#2f6f86', green: '#4fa58c', pale: '#9cc9b4', ochre: '#b98a52', ink: '#2c3830', silk: '#efe5cc', gold: '#d2ac58' };
  function qlRange(q, x0, x1, base, hmax, seed, o = {}) {
    const r = A.rng(seed), pts = [];
    const n = Math.max(6, Math.round((x1 - x0) / 34));
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = lerp(x0, x1, u);
      const env = Math.pow(Math.sin(u * PI), o.sharp ?? 0.8);
      const hh = hmax * env * (0.55 + 0.45 * (noise1(u * (o.freq ?? 5) + seed, seed) * 1.2)) * (1 + 0.2 * (r() - 0.5));
      pts.push([x, base - hh]);
    }
    const mid = (i) => [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    const ridge = (dy = 0) => { q.moveTo(pts[0][0], pts[0][1] + dy); for (let i = 1; i < n; i++) { const [mx, my] = mid(i); q.quadraticCurveTo(pts[i][0], pts[i][1] + dy, mx, my + dy); } q.lineTo(pts[n][0], pts[n][1] + dy); };
    const shape = () => { q.beginPath(); q.moveTo(x0, base); q.lineTo(pts[0][0], pts[0][1]); ridge(); q.lineTo(x1, base); q.closePath(); };
    const top = base - hmax;
    shape();
    q.fillStyle = K.lin(q, 0, top, 0, base, [[0, o.c0 || QL.blue], [0.4, o.c1 || QL.green], [0.82, o.c2 || QL.ochre], [1, rgba(o.c2 || QL.ochre, 0)]]);
    q.fill();
    q.save(); shape(); q.clip();
    // 脊下一道更深的石青
    q.filter = 'blur(3px)'; q.strokeStyle = rgba(o.cd || '#1c4e68', o.band ?? 0.5); q.lineWidth = 22; q.beginPath(); ridge(4); q.stroke(); q.filter = 'none';
    // 皴：沿坡成簇的细笔
    q.lineCap = 'round';
    for (let k = 0; k < n * 0.7; k++) {
      const i = 1 + Math.floor(r() * (n - 1)), [px, py] = pts[i], side = pts[i + 1][1] > pts[i - 1][1] ? 1 : -1;
      const m = 3 + Math.floor(r() * 4);
      for (let j = 0; j < m; j++) {
        const x = px + side * j * 6 + (r() - 0.5) * 4, y = py + 6 + j * 4, l = 18 + r() * 34;
        q.strokeStyle = rgba(QL.ink, 0.16 + r() * 0.14); q.lineWidth = 0.7 + r() * 0.6;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + side * l * 0.3, y + l * 0.5, x + side * l * 0.55, y + l); q.stroke();
      }
    }
    // 山脚留白的云气
    q.fillStyle = K.lin(q, 0, base - hmax * 0.4, 0, base, [[0, rgba(QL.silk, 0)], [1, rgba(QL.silk, 0.9)]]);
    q.fillRect(x0, base - hmax * 0.4, x1 - x0, hmax * 0.4);
    q.restore();
    // 金线勾脊（金碧）与粗细有致的墨线
    q.strokeStyle = rgba(QL.gold, o.goldA ?? 0.75); q.lineWidth = 1.1; q.beginPath(); ridge(2.5); q.stroke();
    q.strokeStyle = rgba(QL.ink, o.line ?? 0.7);
    for (let i = 1; i < n; i++) {
      const [ax, ay] = i === 1 ? pts[0] : mid(i - 1), [bx, by] = i === n - 1 ? pts[n] : mid(i);
      q.lineWidth = (o.lw ?? 1.3) * (0.6 + 1.1 * noise1(i * 0.7 + seed, seed + 3));
      q.beginPath(); q.moveTo(ax, ay); q.quadraticCurveTo(pts[i][0], pts[i][1], bx, by); q.stroke();
    }
    // 苔点：点在脊上
    q.fillStyle = rgba('#1f3a2c', 0.75);
    for (let k = 0; k < n * 0.8; k++) { const [x, y] = pts[1 + Math.floor(r() * (n - 1))]; q.beginPath(); q.ellipse(x + (r() - 0.5) * 8, y + 2 + r() * 4, 1.5 + r() * 1.6, 1 + r() * 0.8, 0, 0, TAU); q.fill(); }
    return pts;
  }
  function qlPine(q, x, y, s, lean) {
    q.strokeStyle = QL.ink; q.lineWidth = 2.2 * s; q.lineCap = 'round';
    q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + lean * 10 * s, y - 20 * s, x + lean * 6 * s, y - 40 * s); q.stroke();
    for (let k = 0; k < 4; k++) {
      const yy = y - (16 + k * 8) * s, w = (18 - k * 3.5) * s, xx = x + lean * (4 + k * 1.5) * s;
      q.fillStyle = k % 2 ? '#2f6e58' : '#3d8468';
      q.beginPath(); q.ellipse(xx, yy, w, 4.5 * s, 0, 0, TAU); q.fill();
      q.strokeStyle = rgba(QL.ink, 0.5); q.lineWidth = 0.8; q.stroke();
    }
  }
  function qlCloud(q, x, y, s) {
    q.fillStyle = 'rgba(250,246,234,0.95)'; q.strokeStyle = 'rgba(58,110,140,0.7)'; q.lineWidth = 1.4;
    q.beginPath();
    q.arc(x, y, 16 * s, PI, TAU); q.arc(x + 26 * s, y + 2 * s, 12 * s, PI * 1.1, PI * 2.1); q.arc(x + 48 * s, y + 4 * s, 9 * s, PI * 1.2, PI * 2.2);
    q.lineTo(x + 56 * s, y + 10 * s); q.quadraticCurveTo(x + 20 * s, y + 18 * s, x - 18 * s, y + 10 * s); q.closePath();
    q.fill(); q.stroke();
    q.beginPath(); q.arc(x, y + 1, 7 * s, PI * 1.1, PI * 2.2); q.stroke();
  }
  function qlMist(q, x0, x1, y, h, a) {
    for (let k = 0; k < 3; k++) {
      q.fillStyle = K.lin(q, 0, y - h, 0, y + h, [[0, rgba(QL.silk, 0)], [0.5, rgba('#f6efdc', a)], [1, rgba(QL.silk, 0)]]);
      q.beginPath(); q.ellipse((x0 + x1) / 2 + (k - 1) * (x1 - x0) * 0.2, y + (k - 1) * h * 0.2, (x1 - x0) * 0.42, h, 0, 0, TAU); q.fill();
    }
  }
  function qlLabel(q, x, y, text, size) {
    const ch = Array.from(text);
    q.fillStyle = 'rgba(40,34,28,0.78)'; q.font = size + 'px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
    ch.forEach((c, i) => q.fillText(c, x, y + i * size * 1.04));
    q.fillStyle = 'rgba(176,40,30,0.85)'; q.fillRect(x - size * 0.42, y + ch.length * size * 1.04 + 2, size * 0.84, size * 0.84);
    q.strokeStyle = 'rgba(250,240,220,0.8)'; q.lineWidth = 1; q.strokeRect(x - size * 0.3, y + ch.length * size * 1.04 + 2 + size * 0.12, size * 0.6, size * 0.6);
  }
  // 绢底与远山（缓存，不透明）
  function x3Far() {
    return K.cache('g08|x3far', X3FW, H, 1, (q) => {
      q.translate(-X3F0, 0);
      const r = A.rng(3301);
      q.fillStyle = K.lin(q, 0, 0, 0, H, [[0, '#f2e8d0'], [0.6, '#ede2c6'], [1, '#e2d4b2']]); q.fillRect(X3F0, 0, X3FW, H);
      for (let k = 0; k < 900; k++) { q.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(120,96,60,0.05)'; q.fillRect(X3F0 + r() * X3FW, r() * H, 1 + r() * 30, 1); }
      for (let k = 0; k < 18; k++) { q.fillStyle = 'rgba(150,120,70,' + (0.03 + r() * 0.04).toFixed(3) + ')'; A.inkBlob(q, X3F0 + r() * X3FW, 60 + r() * 600, 30 + r() * 90, k, 0.5); q.fill(); }
      for (let k = 0; k < 7; k++) {
        const x0 = X3F0 - 100 + k * 270 + r() * 80, w = 380 + r() * 260;
        q.globalAlpha = 0.45;
        qlRange(q, x0, x0 + w, X3.hor - 30, 150 + r() * 110, 70 + k, { c0: '#6a9ab0', c1: '#8fbcb0', c2: '#d8c8a0', cd: '#5a8aa0', band: 0.3, line: 0.35, lw: 1, goldA: 0.3 });
        q.globalAlpha = 1;
      }
      qlMist(q, X3F0, X3F0 + X3FW, X3.hor - 40, 40, 0.7);
    });
  }
  // 八盏灯（卷面坐标）：k 是第几拍熄
  const X3LAMPS = [
    { x: 640 - 128, y: X3.hor - 52, r: 1.2, k: 0, s: 0 }, { x: 640 + 128, y: X3.hor - 52, r: 1.2, k: 0, s: 0 },
    { x: 1144, y: X3.hor - 248, r: 1.1, k: 1, s: 1 },
    { x: 1640 - 92, y: X3.hor - 6, r: 1, k: 2, s: 2 }, { x: 1640 + 92, y: X3.hor - 6, r: 1, k: 2, s: 2 },
    { x: 2140 - 30, y: X3.hor + 12, r: 1, k: 3, s: 3 }, { x: 2140 + 76, y: X3.hor - 34, r: 0.9, k: 3, s: 3 },
    { x: 2650 - 40, y: X3.hor + 128, r: 1.5, k: 5, s: 4 },
  ];
  // 小景缩放
  const vig = (q, cx, by, s, fn) => { q.save(); q.translate(cx, by); q.scale(s, s); q.translate(-cx, -by); fn(); q.restore(); };
  // 中景：连绵的山、云带、五处小景（缓存，透明底）
  function x3MidBody(q) {
    const r = A.rng(3401), hor = X3.hor;
    const [sA, sT, sR, sI, sX] = X3.sites;
    for (let k = 0; k < 9; k++) {
      const x0 = X3M0 + k * 380 + r() * 100;
      qlRange(q, x0, x0 + 420 + r() * 200, hor + 40, 120 + r() * 90, 200 + k, { line: 0.6 });
    }
    qlMist(q, X3M0, X3M0 + 3000, hor + 30, 36, 0.85);
    // 引首：卷首题字与印
    q.fillStyle = 'rgba(30,26,22,0.85)'; q.font = '54px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
    Array.from('故地').forEach((c, i) => q.fillText(c, 90, 200 + i * 62));
    A.seal(q, 90, 358, 44, '逍遥', 0.9);
    // —— 南诏祭坛：高原台地上三层石坛，正中石阶，两侧图腾柱与长幡，坛前火盆 ——
    vig(q, sA, hor + 70, 1.12, () => {
      const cx = sA, by = hor + 70;
      qlRange(q, cx - 330, cx + 330, by + 10, 250, 31, { sharp: 0.5, freq: 3 });
      // 台地
      q.fillStyle = K.lin(q, 0, by - 40, 0, by + 10, [[0, '#c8a470'], [1, '#a07848']]);
      q.beginPath(); q.moveTo(cx - 270, by + 10); q.lineTo(cx - 220, by - 34); q.lineTo(cx + 220, by - 34); q.lineTo(cx + 270, by + 10); q.closePath(); q.fill();
      q.strokeStyle = rgba(QL.ink, 0.65); q.lineWidth = 1.3; q.stroke();
      // 三层坛：每层顶面浅、立面深，立面一道刻纹
      for (let k = 0; k < 3; k++) {
        const w = 160 - k * 44, y0 = by - 34 - k * 30, h = 24;
        q.fillStyle = '#e2d6bc'; q.beginPath(); q.moveTo(cx - w, y0 - h); q.lineTo(cx - w + 10, y0 - h - 6); q.lineTo(cx + w - 10, y0 - h - 6); q.lineTo(cx + w, y0 - h); q.closePath(); q.fill();
        q.fillStyle = K.lin(q, 0, y0 - h, 0, y0, [[0, '#b8a888'], [1, '#8a7a60']]); q.fillRect(cx - w, y0 - h, w * 2, h);
        q.strokeStyle = rgba(QL.ink, 0.7); q.lineWidth = 1.1; q.strokeRect(cx - w, y0 - h, w * 2, h);
        q.strokeStyle = rgba('#3a6a8a', 0.6); q.beginPath(); q.moveTo(cx - w + 6, y0 - h * 0.45); q.lineTo(cx + w - 6, y0 - h * 0.45); q.stroke();
      }
      // 石阶
      q.fillStyle = '#d6c8aa';
      q.beginPath(); q.moveTo(cx - 26, by - 34); q.lineTo(cx - 14, by - 118); q.lineTo(cx + 14, by - 118); q.lineTo(cx + 26, by - 34); q.closePath(); q.fill();
      q.strokeStyle = rgba(QL.ink, 0.55); q.lineWidth = 0.8;
      for (let k = 0; k < 9; k++) { const y = by - 38 - k * 9, w = lerp(26, 14, k / 9); q.beginPath(); q.moveTo(cx - w, y); q.lineTo(cx + w, y); q.stroke(); }
      // 坛顶月牙石
      q.fillStyle = '#2f5f8a'; q.beginPath(); q.arc(cx, by - 158, 22, 0, TAU); q.arc(cx + 9, by - 162, 18, 0, TAU, true); q.fill('evenodd');
      q.strokeStyle = QL.gold; q.lineWidth = 1.4; q.beginPath(); q.arc(cx, by - 158, 22, 0, TAU); q.stroke();
      for (const sd of [-1, 1]) {
        // 图腾柱
        const px = cx + sd * 200;
        q.fillStyle = '#5a3a2a'; q.fillRect(px - 5, by - 160, 10, 150);
        q.strokeStyle = rgba(QL.ink, 0.8); q.lineWidth = 1; q.strokeRect(px - 5, by - 160, 10, 150);
        for (let j = 0; j < 4; j++) { q.fillStyle = j % 2 ? '#2f6f86' : '#b0402a'; q.fillRect(px - 6, by - 146 + j * 30, 12, 8); }
        q.strokeStyle = '#2f5f8a'; q.lineWidth = 3; q.beginPath(); q.arc(px, by - 170, 10, PI * 0.15, PI * 0.85, true); q.stroke();
        // 长幡：竿上垂下的窄幡，幡尾分叉随风
        const fx0 = cx + sd * 250;
        q.strokeStyle = '#4a3020'; q.lineWidth = 2.2; q.beginPath(); q.moveTo(fx0, by - 4); q.lineTo(fx0, by - 210); q.stroke();
        q.fillStyle = sd < 0 ? '#2f6f86' : '#b0402a';
        q.beginPath(); q.moveTo(fx0, by - 206); q.bezierCurveTo(fx0 - sd * 14, by - 170, fx0 - sd * 6, by - 130, fx0 - sd * 18, by - 96); q.lineTo(fx0 - sd * 8, by - 104); q.lineTo(fx0 - sd * 4, by - 92); q.bezierCurveTo(fx0 + sd * 6, by - 130, fx0 + sd * 2, by - 170, fx0 + sd * 12, by - 204); q.closePath(); q.fill();
        q.strokeStyle = rgba(QL.ink, 0.6); q.lineWidth = 0.9; q.stroke();
        // 火盆
        const fx = cx + sd * 114, fy = by - 52;
        q.fillStyle = '#4a3a2a'; q.beginPath(); q.moveTo(fx - 13, fy); q.lineTo(fx + 13, fy); q.lineTo(fx + 7, fy + 15); q.lineTo(fx - 7, fy + 15); q.closePath(); q.fill();
        q.strokeStyle = QL.gold; q.lineWidth = 1; q.beginPath(); q.moveTo(fx - 13, fy); q.lineTo(fx + 13, fy); q.stroke();
      }
    });
    qlLabel(q, sA - 360, hor - 220, '南诏', 24);
    // —— 锁妖塔：云海里拔起的孤峰，峰顶黑塔 ——
    vig(q, sT, hor + 110, 0.95, () => {
      const cx = sT, by = hor + 110;
      q.fillStyle = K.lin(q, 0, by - 330, 0, by + 30, [[0, QL.blue], [0.45, QL.green], [0.8, QL.ochre], [1, rgba(QL.ochre, 0)]]);
      const peak = () => { q.beginPath(); q.moveTo(cx - 130, by + 30); q.bezierCurveTo(cx - 90, by - 60, cx - 66, by - 200, cx - 30, by - 296); q.quadraticCurveTo(cx + 2, by - 312, cx + 32, by - 294); q.bezierCurveTo(cx + 60, by - 200, cx + 84, by - 60, cx + 140, by + 30); q.closePath(); };
      peak(); q.fill();
      q.save(); peak(); q.clip();
      q.filter = 'blur(4px)'; q.fillStyle = 'rgba(28,78,104,0.45)'; q.beginPath(); q.ellipse(cx + 30, by - 230, 40, 90, 0.2, 0, TAU); q.fill(); q.filter = 'none';
      q.lineCap = 'round';
      for (let k = 0; k < 26; k++) { const y = by - 280 + k * 12, x = cx - 40 + r() * 80; q.strokeStyle = rgba(QL.ink, 0.18 + r() * 0.15); q.lineWidth = 0.8; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 4, y + 14, x + (r() - 0.5) * 10, y + 30); q.stroke(); }
      q.restore();
      q.strokeStyle = rgba(QL.gold, 0.7); q.lineWidth = 1.1; q.beginPath(); q.moveTo(cx - 28, by - 290); q.bezierCurveTo(cx - 62, by - 196, cx - 84, by - 70, cx - 120, by + 10); q.stroke();
      peak(); q.strokeStyle = rgba(QL.ink, 0.75); q.lineWidth = 1.6; q.stroke();
      // 塔：七层，墨青塔身，檐角起翘
      const tx = cx + 2, ty = by - 300;
      for (let k = 0; k < 7; k++) {
        const w = 34 - k * 3.4, y0 = ty - k * 24;
        q.fillStyle = '#26302e'; q.fillRect(tx - w * 0.6, y0 - 20, w * 1.2, 20);
        q.fillStyle = '#1a2220'; q.beginPath(); q.moveTo(tx - w - 6, y0 - 18); q.quadraticCurveTo(tx, y0 - 26, tx + w + 6, y0 - 18); q.lineTo(tx + w * 0.7, y0 - 24); q.lineTo(tx - w * 0.7, y0 - 24); q.closePath(); q.fill();
        q.fillStyle = '#3a4a44'; q.fillRect(tx - 3, y0 - 15, 6, 9);
      }
      q.strokeStyle = '#1a2220'; q.lineWidth = 2; q.beginPath(); q.moveTo(tx, ty - 168); q.lineTo(tx, ty - 190); q.stroke();
      // 塔下云海
      for (let k = 0; k < 7; k++) qlCloud(q, cx - 220 + k * 64 + r() * 20, by - 30 + r() * 36 + Math.abs(k - 3) * 6, 0.9 + r() * 0.5);
      qlMist(q, cx - 320, cx + 320, by + 6, 52, 0.95);
    });
    qlLabel(q, sT - 170, hor - 250, '锁妖塔', 22);
    // —— 林家堡擂台：粉墙、玲珑太湖石、柳，红幔擂台 ——
    vig(q, sR, hor + 92, 1.15, () => {
      const cx = sR, by = hor + 92;
      q.fillStyle = '#c8b898'; q.fillRect(cx - 240, by - 10, 480, 18);
      q.fillStyle = '#f4ecdc'; q.fillRect(cx - 230, by - 60, 460, 50);
      q.strokeStyle = rgba(QL.ink, 0.6); q.lineWidth = 1; q.strokeRect(cx - 230, by - 60, 460, 50);
      q.fillStyle = '#4a5450'; q.fillRect(cx - 236, by - 68, 472, 9);
      for (const wx of [cx - 150, cx + 150]) { q.strokeStyle = rgba(QL.ink, 0.6); q.beginPath(); q.arc(wx, by - 36, 13, 0, TAU); q.stroke(); }
      const sx = cx, sy = by - 70;
      q.fillStyle = '#8a5a36'; q.fillRect(sx - 90, sy - 12, 180, 14);
      q.strokeStyle = rgba(QL.ink, 0.8); q.strokeRect(sx - 90, sy - 12, 180, 14);
      for (const px of [-80, -28, 28, 80]) { q.fillStyle = '#a8321e'; q.fillRect(sx + px - 3, sy - 92, 6, 80); }
      E.util.roof(q, sx, sy - 92, 190, 34, { color: '#3e4a4e', curl: 0.6, ridge: 0.7, tileW: 7, trim: '#c8a050' });
      q.fillStyle = 'rgba(200,52,36,0.9)';
      q.beginPath(); q.moveTo(sx - 80, sy - 88); q.quadraticCurveTo(sx - 54, sy - 62, sx - 28, sy - 88); q.quadraticCurveTo(sx, sy - 62, sx + 28, sy - 88); q.quadraticCurveTo(sx + 54, sy - 62, sx + 80, sy - 88); q.lineTo(sx + 80, sy - 82); q.quadraticCurveTo(sx + 54, sy - 56, sx + 28, sy - 82); q.quadraticCurveTo(sx, sy - 56, sx - 28, sy - 82); q.quadraticCurveTo(sx - 54, sy - 56, sx - 80, sy - 82); q.closePath(); q.fill();
      q.fillStyle = '#c8321e'; q.fillRect(sx - 30, sy - 112, 60, 14); q.strokeStyle = '#d8a850'; q.strokeRect(sx - 30, sy - 112, 60, 14);
      // 太湖石：瘦、皱、漏、透——高挑扭转的轮廓，大小不一的透洞，皱纹顺石势
      const rx = cx - 200, ry = by - 10;
      const rock = () => {
        q.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU, w = 26 * (1 + 0.28 * (noise1(a * 1.8 + 3, 11) - 0.5) * 2), hgt = 78 * (1 + 0.18 * (noise1(a * 2.4 + 7, 12) - 0.5) * 2);
          const yy = Math.sin(a) * hgt, xx = Math.cos(a) * w + Math.sin(yy * 0.035) * 12;
          i ? q.lineTo(rx + xx, ry - 78 + yy) : q.moveTo(rx + xx, ry - 78 + yy);
        }
        q.closePath();
      };
      rock(); q.fillStyle = K.lin(q, rx - 34, 0, rx + 34, 0, [[0, '#6e7c78'], [0.45, '#b8c4bc'], [1, '#5e6c68']]); q.fill();
      q.save(); rock(); q.clip();
      q.strokeStyle = rgba(QL.ink, 0.3); q.lineWidth = 0.9;
      for (let k = 0; k < 9; k++) { const y0 = ry - 150 + k * 16; q.beginPath(); q.moveTo(rx - 30, y0); q.bezierCurveTo(rx - 10, y0 - 8, rx + 6, y0 + 10, rx + 30, y0 - 2); q.stroke(); }
      q.restore();
      rock(); q.strokeStyle = rgba(QL.ink, 0.8); q.lineWidth = 1.5; q.stroke();
      for (const [hx, hy, hr, sd] of [[-6, -122, 8, 1], [10, -88, 6, 2], [-10, -60, 5, 3], [12, -34, 4, 4], [0, -142, 3.5, 5]]) {
        q.fillStyle = 'rgba(34,44,42,0.9)'; A.inkBlob(q, rx + hx, ry + hy, hr, sd, 0.4); q.fill();
        q.strokeStyle = 'rgba(236,240,236,0.55)'; q.lineWidth = 1; q.beginPath(); q.arc(rx + hx, ry + hy, hr + 2, PI * 1.1, PI * 1.8); q.stroke();
      }
      q.strokeStyle = '#4a3a2a'; q.lineWidth = 3; q.beginPath(); q.moveTo(cx + 200, by - 10); q.quadraticCurveTo(cx + 196, by - 70, cx + 210, by - 130); q.stroke();
      q.strokeStyle = 'rgba(88,150,110,0.8)'; q.lineWidth = 1.2;
      for (let k = 0; k < 22; k++) { const x0 = cx + 180 + r() * 60, y0 = by - 140 + r() * 30; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo(x0 + 6, y0 + 40, x0 + (r() - 0.3) * 14, y0 + 60 + r() * 40); q.stroke(); }
    });
    qlLabel(q, sR - 300, hor - 160, '林家堡', 22);
    // —— 余杭客栈：白墙黛瓦、石拱桥、酒旗 ——
    vig(q, sI, hor + 96, 1.15, () => {
      const cx = sI, by = hor + 96;
      q.fillStyle = K.lin(q, cx - 300, 0, cx + 300, 0, [[0, 'rgba(120,170,170,0)'], [0.2, 'rgba(120,170,170,0.4)'], [0.8, 'rgba(120,170,170,0.4)'], [1, 'rgba(120,170,170,0)']]);
      q.beginPath(); q.moveTo(cx - 300, by + 6); q.quadraticCurveTo(cx, by - 2, cx + 300, by + 8); q.lineTo(cx + 300, by + 40); q.quadraticCurveTo(cx, by + 52, cx - 300, by + 36); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(58,110,120,0.4)'; q.lineWidth = 1;
      for (let k = 0; k < 12; k++) { const x = cx - 260 + r() * 520, y = by + 10 + r() * 28; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 8, y - 3, x + 16, y); q.stroke(); }
      const house = (x, w, h, gable) => {
        q.fillStyle = '#f6efe0'; q.fillRect(x, by - h, w, h);
        q.strokeStyle = rgba(QL.ink, 0.65); q.lineWidth = 1; q.strokeRect(x, by - h, w, h);
        q.fillStyle = '#3a4448';
        if (gable) { q.fillRect(x - 4, by - h - 26, 18, 8); q.fillRect(x + w - 14, by - h - 26, 18, 8); q.fillRect(x + 8, by - h - 12, w - 16, 7); }
        q.beginPath(); q.moveTo(x - 6, by - h + 2); q.lineTo(x + w + 6, by - h + 2); q.lineTo(x + w - 4, by - h - 12); q.lineTo(x + 4, by - h - 12); q.closePath(); q.fill();
      };
      house(cx - 230, 120, 70, true); house(cx - 100, 150, 96, true); house(cx + 70, 110, 60, false);
      q.fillStyle = '#5a3a24'; q.fillRect(cx - 60, by - 44, 70, 44);
      q.fillStyle = '#e8c890'; q.fillRect(cx - 40, by - 82, 30, 22); q.strokeStyle = '#5a3a24'; q.strokeRect(cx - 40, by - 82, 30, 22);
      q.strokeStyle = '#4a3a2a'; q.lineWidth = 2.5; q.beginPath(); q.moveTo(cx + 40, by - 96); q.lineTo(cx + 40, by - 170); q.lineTo(cx + 64, by - 170); q.stroke();
      q.fillStyle = '#efe6cc'; q.fillRect(cx + 46, by - 166, 20, 46); q.strokeStyle = rgba(QL.ink, 0.6); q.lineWidth = 1; q.strokeRect(cx + 46, by - 166, 20, 46);
      q.fillStyle = '#b0301e'; q.fillRect(cx + 46, by - 166, 20, 6);
      q.fillStyle = 'rgba(30,26,22,0.85)'; q.font = '16px ' + XYT.FONT; q.textAlign = 'center'; q.fillText('酒', cx + 56, by - 140);
      q.strokeStyle = '#4a3a2a'; q.lineWidth = 1; q.beginPath(); q.moveTo(cx + 64, by - 170); q.lineTo(cx + 64, by - 118); q.stroke();
      q.fillStyle = '#c8402a'; q.beginPath(); q.ellipse(cx + 64, by - 112, 5, 7, 0, 0, TAU); q.fill();
      q.fillStyle = '#d8d0bc'; q.beginPath(); q.moveTo(cx + 120, by + 4); q.quadraticCurveTo(cx + 190, by - 46, cx + 260, by + 4); q.lineTo(cx + 250, by + 4); q.quadraticCurveTo(cx + 190, by - 30, cx + 130, by + 4); q.closePath(); q.fill();
      q.strokeStyle = rgba(QL.ink, 0.7); q.lineWidth = 1.2; q.stroke();
      q.strokeStyle = 'rgba(88,150,110,0.8)'; q.lineWidth = 1.1;
      for (let k = 0; k < 18; k++) { const x0 = cx - 270 + r() * 50, y0 = by - 120 + r() * 20; q.beginPath(); q.moveTo(x0, y0); q.quadraticCurveTo(x0 + 6, y0 + 40, x0 + (r() - 0.3) * 14, y0 + 60 + r() * 50); q.stroke(); }
    });
    qlLabel(q, sI - 330, hor - 160, '余杭', 24);
    // —— 仙灵岛远景：雾中的圆润青山，山上一座白玉楼阁（水月宫） ——
    {
      const cx = sX;
      qlRange(q, cx - 460, cx + 300, hor - 2, 190, 77, { sharp: 0.6, freq: 2.5 });
      q.fillStyle = K.lin(q, cx - 250, 0, cx - 20, 0, [[0, 'rgba(150,196,196,0)'], [1, 'rgba(150,196,196,0.36)']]); q.fillRect(cx - 250, hor + 2, 1010, 680 - hor);
      const px = cx - 40, py = hor - 128;
      q.fillStyle = 'rgba(246,242,236,0.95)'; q.fillRect(px - 44, py - 6, 88, 34); q.strokeStyle = rgba(QL.ink, 0.5); q.lineWidth = 1; q.strokeRect(px - 44, py - 6, 88, 34);
      E.util.roof(q, px, py - 6, 112, 22, { color: '#6f86a6', curl: 0.7, ridge: 0.6, tileW: 6, trim: '#d8b45c' });
      q.fillStyle = 'rgba(246,242,236,0.95)'; q.fillRect(px - 24, py - 50, 48, 22);
      E.util.roof(q, px, py - 50, 72, 18, { color: '#6f86a6', curl: 0.7, ridge: 0.5, tileW: 6, trim: '#d8b45c' });
      for (const dx of [-30, -10, 10, 30]) { q.fillStyle = 'rgba(200,190,170,0.9)'; q.fillRect(px + dx - 2, py + 2, 4, 26); }
      qlMist(q, cx - 360, cx + 200, hor - 70, 24, 0.8);
      qlMist(q, cx - 500, cx + 400, hor + 6, 26, 0.9);
      qlLabel(q, cx + 230, hor - 250, '仙灵岛', 24);
    }
  }
  function x3Mid() {
    return K.cache('g08|x3mid' + fontK(), X3MW, H, 1, (q) => { q.translate(-X3M0, 0); x3MidBody(q); });
  }
  // 灯灭后小景褪成水墨：每处一块去色的贴片（径向软边）
  function x3Drain(k) {
    const cx = X3.sites[k], cy = X3.hor - 110, w = 680, h = 480;
    return K.cache('g08|x3drain' + k + fontK(), w, h, 1, (q) => {
      q.filter = 'grayscale(1) sepia(0.3) brightness(1.06) contrast(0.92)';
      const m = x3Mid(), sc = m.width / m.lw;
      q.drawImage(m, (cx - w / 2 - X3M0) * sc, (cy - h / 2) * sc, w * sc, h * sc, 0, 0, w, h);
      q.filter = 'none';
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.rad(q, w / 2, h / 2, 0, w / 2, [[0, 'rgba(0,0,0,1)'], [0.62, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 仙灵岛前景（缓存，画在浪纹之后）：弧形沙嘴、湿沙一线、浪花花边、礁石、桃树、石灯
  const X3IS = { x0: 2650 - 760, w: 1520, y0: 420, h: 300 };
  function x3Island() {
    return K.cache('g08|x3isle', X3IS.w, X3IS.h, 1, (q) => {
      q.translate(-X3IS.x0, -X3IS.y0);
      const cx = 2650, r = A.rng(3611);
      const shoreP = () => { q.moveTo(cx - 760, 640); q.bezierCurveTo(cx - 520, 600, cx - 300, 556, cx - 60, 548); q.bezierCurveTo(cx + 200, 540, cx + 420, 556, cx + 760, 590); };
      // 浪花花边（在沙外）
      q.strokeStyle = 'rgba(255,255,255,0.85)'; q.lineWidth = 2.4; q.beginPath(); q.save(); q.translate(0, -7); shoreP(); q.restore(); q.stroke();
      q.lineWidth = 1.2;
      for (let k = 0; k < 70; k++) { const u = k / 70, x = cx - 740 + u * 1480; const y = x < cx - 60 ? lerp(640, 548, Math.pow((x - (cx - 760)) / 700, 0.8)) : lerp(548, 590, Math.pow((x - (cx - 60)) / 820, 1.6)); q.beginPath(); q.arc(x, y - 10, 5 + r() * 4, PI * 1.05, PI * 1.95); q.stroke(); }
      // 沙
      q.beginPath(); shoreP(); q.lineTo(cx + 760, 720); q.lineTo(cx - 760, 720); q.closePath();
      q.fillStyle = K.lin(q, 0, 540, 0, 700, [[0, '#d8c08c'], [0.18, '#ead8ac'], [1, '#e2cc9c']]); q.fill();
      // 湿沙一线
      q.save(); q.beginPath(); shoreP(); q.lineTo(cx + 760, 720); q.lineTo(cx - 760, 720); q.closePath(); q.clip();
      q.strokeStyle = 'rgba(150,120,80,0.45)'; q.lineWidth = 12; q.beginPath(); q.save(); q.translate(0, 4); shoreP(); q.restore(); q.stroke();
      for (let k = 0; k < 120; k++) { q.fillStyle = 'rgba(140,110,70,' + (0.1 + r() * 0.15).toFixed(3) + ')'; q.fillRect(cx - 760 + r() * 1520, 560 + r() * 160, 1 + r() * 2, 1); }
      q.restore();
      q.strokeStyle = rgba(QL.ink, 0.55); q.lineWidth = 1.3; q.beginPath(); shoreP(); q.stroke();
      // 礁石
      q.fillStyle = '#8a9a90'; A.inkBlob(q, cx + 170, 566, 24, 3, 0.4); q.fill(); q.strokeStyle = rgba(QL.ink, 0.6); q.stroke();
      // 桃树
      q.strokeStyle = '#4a3a2a'; q.lineWidth = 4; q.beginPath(); q.moveTo(cx + 330, 580); q.quadraticCurveTo(cx + 318, 520, cx + 340, 462); q.moveTo(cx + 328, 520); q.lineTo(cx + 372, 488); q.moveTo(cx + 336, 480); q.lineTo(cx + 300, 452); q.stroke();
      for (let k = 0; k < 40; k++) { q.fillStyle = k % 3 ? 'rgba(240,170,190,0.85)' : 'rgba(250,210,220,0.9)'; q.beginPath(); q.arc(cx + 290 + r() * 100, 436 + r() * 66, 3.5 + r() * 4, 0, TAU); q.fill(); }
      // 石灯（滩头）
      const lx = cx - 40, ly = 610;
      q.save(); q.translate(lx, ly); q.scale(1.6, 1.6); q.translate(-lx, -ly);
      q.fillStyle = 'rgba(40,36,28,0.25)'; q.beginPath(); q.ellipse(lx + 6, ly + 1, 16, 3, 0, 0, TAU); q.fill();
      q.fillStyle = '#9a9a90'; q.fillRect(lx - 4, ly - 30, 8, 30); q.fillRect(lx - 12, ly - 34, 24, 6); q.fillRect(lx - 9, ly - 50, 18, 16); q.beginPath(); q.moveTo(lx - 16, ly - 50); q.lineTo(lx, ly - 62); q.lineTo(lx + 16, ly - 50); q.closePath(); q.fill();
      q.strokeStyle = rgba(QL.ink, 0.7); q.lineWidth = 0.8; q.strokeRect(lx - 9, ly - 50, 18, 16); q.strokeRect(lx - 12, ly - 34, 24, 6);
      q.fillStyle = '#e8c890'; q.fillRect(lx - 5, ly - 47, 10, 10);
      q.restore();
    });
  }
  // 近景：掠过画面下沿的石与松，偶尔从上角探进一枝松（1.75 倍速度）
  function x3Near(k) {
    return K.cache('g08|x3near' + k, 360, 200, 1, (q) => {
      const r = A.rng(3500 + k);
      const pts = [];
      for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([20 + u * 320, 200 - Math.pow(Math.sin(u * PI), 0.7) * (90 + 40 * r()) - (r() - 0.5) * 16]); }
      q.beginPath(); q.moveTo(20, 200); pts.forEach(([x, y]) => q.lineTo(x, y)); q.lineTo(340, 200); q.closePath();
      q.fillStyle = K.lin(q, 0, 90, 0, 200, [[0, '#3f8670'], [0.45, '#6d9a7a'], [1, '#a88a58']]); q.fill();
      q.strokeStyle = rgba(QL.gold, 0.6); q.lineWidth = 1; q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y + 3) : q.moveTo(x, y + 3))); q.stroke();
      q.strokeStyle = rgba(QL.ink, 0.85); q.lineWidth = 1.8; q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke();
      q.strokeStyle = rgba(QL.ink, 0.35); q.lineWidth = 1.1;
      for (let j = 0; j < 14; j++) { const [x, y] = pts[1 + Math.floor(r() * 12)]; q.beginPath(); q.moveTo(x, y + 4); q.quadraticCurveTo(x + 6, y + 30, x - 6, y + 60); q.stroke(); }
      q.fillStyle = rgba('#1f3a2c', 0.85);
      for (let j = 0; j < 16; j++) { const [x, y] = pts[1 + Math.floor(r() * 12)]; q.beginPath(); q.ellipse(x + (r() - 0.5) * 10, y + 3, 2.4, 1.5, 0, 0, TAU); q.fill(); }
      q.strokeStyle = rgba('#5a6a3a', 0.8); q.lineCap = 'round';
      for (let j = 0; j < 12; j++) { const x = 40 + r() * 280, y = 200 - r() * 40, l = 40 + r() * 50, a = -PI / 2 + (r() - 0.4) * 0.6; q.lineWidth = 1.2; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.6, x + Math.cos(a + 0.3) * l, y + Math.sin(a + 0.3) * l); q.stroke(); }
      if (k % 2 === 0) qlPine(q, 120 + r() * 120, pts[7][1] + 6, 1.3, r() - 0.5);
    });
  }
  function x3Bough() {
    return K.cache('g08|x3bough', 460, 280, 1, (q) => {
      const r = A.rng(3620);
      q.lineCap = 'round'; q.strokeStyle = '#2a2018';
      q.lineWidth = 14; q.beginPath(); q.moveTo(-10, 20); q.quadraticCurveTo(160, 40, 300, 120); q.stroke();
      q.lineWidth = 7; q.beginPath(); q.moveTo(170, 52); q.quadraticCurveTo(230, 30, 330, 34); q.moveTo(250, 94); q.quadraticCurveTo(300, 150, 300, 210); q.stroke();
      // 松针团：墨绿扇面，一层层
      for (const [x, y, s] of [[120, 50, 1.2], [220, 40, 1], [330, 40, 1.1], [300, 130, 1.2], [300, 214, 0.9], [60, 34, 1]]) {
        for (let k = 0; k < 3; k++) {
          q.fillStyle = k === 0 ? '#1e4636' : k === 1 ? '#2f6650' : '#3e8066';
          q.beginPath(); q.ellipse(x + (r() - 0.5) * 20, y + k * 6 - 6, 46 * s - k * 8, 14 * s - k * 2, (r() - 0.5) * 0.4, 0, TAU); q.fill();
        }
        q.strokeStyle = rgba(QL.ink, 0.5); q.lineWidth = 0.8;
        for (let k = 0; k < 14; k++) { const a = PI + (k / 13) * PI; q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(a) * 44 * s, y + Math.sin(a) * 12 * s + 6); q.stroke(); }
      }
    });
  }
  // 一行鱼鳞浪纹（宽 W + 一个周期）
  function x3WaveRow(row) {
    const R = 7 + row * 1.6, sp = Math.round(R * 2.3);
    const c2 = K.cache('g08|x3wave' + row, W + sp * 2, Math.ceil(R * 1.2 + 4), 1, (q) => {
      q.strokeStyle = rgba('#3a6e8c', 0.42); q.lineWidth = 1.1;
      q.beginPath();
      for (let x = 0; x < W + sp * 3; x += sp) { q.moveTo(x + Math.cos(PI * 1.12) * R, R + 2 + Math.sin(PI * 1.12) * R); q.arc(x, R + 2, R, PI * 1.12, PI * 1.88); }
      q.stroke();
    });
    c2.sp = sp; c2.R = R;
    return c2;
  }
  // 雾的贴图（缓存，整数平移贴，不缩放）
  const x3FogFront = () => K.cache('g08|x3fogF', 560, 640, 1, (q) => { q.fillStyle = K.lin(q, 0, 0, 560, 0, [[0, 'rgba(242,238,228,0)'], [0.55, 'rgba(242,238,228,0.7)'], [1, 'rgba(242,238,228,0.26)']]); q.fillRect(0, 0, 560, 640); });
  const x3FogLeft = () => K.cache('g08|x3fogL', 520, 640, 1, (q) => { q.fillStyle = K.lin(q, 0, 0, 520, 0, [[0, 'rgba(242,238,228,0.9)'], [0.6, 'rgba(242,238,228,0.55)'], [1, 'rgba(242,238,228,0)']]); q.fillRect(0, 0, 520, 640); });
  function x3MistBand(k) {
    // 宽两个周期，逐帧按偏移裁一段贴（一次贴完，不用首尾拼）
    return K.cache('g08|x3mist' + k, 2800, 220, 1, (q) => {
      const r = A.rng(3700 + k);
      for (let i = 0; i < 46; i++) { const x = r() * 1400, y = 110 + (r() - 0.5) * 70, rr = 50 + r() * 80; for (const dx of [-1400, 0, 1400, 2800]) A.softBlob(q, x + dx, y, rr, 0.22, '#f6f2ea'); }
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.lin(q, 0, 0, 0, 220, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,1)'], [0.65, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, 2800, 220);
    });
  }
  // 锦缎包首
  function x3Brocade() {
    return K.cache('g08|x3brocade', W + 160, 40, 1, (q) => {
      q.fillStyle = '#2c4a4a'; q.fillRect(0, 0, W + 160, 40);
      q.strokeStyle = 'rgba(216,180,100,0.75)'; q.lineWidth = 1.2;
      for (let x = 0; x < W + 160; x += 80) {
        q.beginPath(); q.arc(x + 40, 20, 8, PI * 0.2, PI * 1.7); q.arc(x + 50, 18, 5, PI * 1.2, PI * 2.5); q.stroke();
        q.beginPath(); q.moveTo(x + 22, 26); q.quadraticCurveTo(x + 40, 32, x + 60, 26); q.stroke();
      }
      q.fillStyle = 'rgba(216,180,100,0.9)'; q.fillRect(0, 0, W + 160, 2); q.fillRect(0, 38, W + 160, 2);
    });
  }

  XYT.registerShot('x3_scroll', {
    name: '长卷故地', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(245,238,220,0.85)', accent: '#b0301e', bloom: 0.22,
    draw(g, c) {
      const lt = c.lt, t = c.t, ck = x3Clock(c);
      const P = x3P(lt, ck), Pi = Math.round(P);
      const fogT = ck.beat(4), stopT = ck.cruise + ck.T;
      // 远景（0.2 倍）、中景、灯灭后褪成水墨的小景（颜色在半秒里褪尽）
      const back = (q, P0, Pi0, lt0) => {
        q.drawImage(x3Far(), Math.round(0.2 * P0) - X3F0, 0, W, H, 0, 0, W, H);
        q.drawImage(x3Mid(), Pi0 - X3M0, 0, W, H, 0, 0, W, H);
        for (let k = 0; k < 4; k++) {
          const dr = smooth(seg(lt0, ck.beat(k) + 0.05, ck.beat(k) + 0.55)), x = X3.sites[k] - Pi0 - 340;
          if (dr > 0.01 && x > -680 && x < W) { q.globalAlpha = dr; q.drawImage(x3Drain(k), x, X3.hor - 110 - 240, 680, 480); q.globalAlpha = 1; }
        }
      };
      // 卷停之后这三层不再变：合成一张贴
      if (lt >= stopT && lt > ck.beat(3) + 0.6) g.drawImage(K.cache('g08|x3still' + Pi + fontK(), W, H, 1, (q) => back(q, P, Pi, Math.max(c.dur, stopT + 1))), 0, 0, W, H);
      else back(g, P, Pi, lt);
      // 仙灵岛：海上鱼鳞浪纹随时间滑动，前面是沙嘴
      const isx = X3IS.x0 - Pi;
      if (isx < W) {
        // 每行浪纹是一条缓存的横带，按各自的速度整数平移；靠客栈一侧分四档淡入
        const xs0 = X3.sites[3] + 350 - Pi;
        for (let row = 0; row < 10; row++) {
          const st = x3WaveRow(row), sp = st.sp, y = 450 + row * 18 + row * row * 1.3 - st.R;
          const off = Math.round((t * (8 + row * 2.2)) % sp);
          for (let band = 0; band < 4; band++) {
            const xa = Math.max(0, xs0 + band * 90), xb = band < 3 ? Math.min(W, xs0 + band * 90 + 90) : W;
            if (xb <= xa) continue;
            g.globalAlpha = [0.25, 0.5, 0.75, 1][band];
            const sx = ((((xa - off) % sp) + sp) % sp);
            g.drawImage(st, sx, 0, xb - xa, st.lh, xa, y, xb - xa, st.lh);
          }
        }
        g.globalAlpha = 1;
        g.drawImage(x3Island(), isx, X3IS.y0, X3IS.w, X3IS.h);
        // 桃花瓣从树上飘落
        for (let i = 0; i < 16; i++) {
          const ph = (h2(i, 3701) + t * (0.14 + 0.08 * h2(i, 3702))) % 1;
          const x = 2650 + 330 - Pi + (h2(i, 3703) - 0.5) * 90 - ph * 160 + Math.sin(t * 2 + i) * 10, y = 450 + ph * 150;
          g.fillStyle = rgba(i % 3 ? '#f0aabe' : '#fad2dc', 0.85 * Math.sin(ph * PI));
          g.beginPath(); g.ellipse(x, y, 3.2, 1.8, t * 2 + i, 0, TAU); g.fill();
        }
      }
      // 近景（1.75 倍）：下沿的石与松，上角偶尔探进一枝松
      for (let k = 0; k < 9; k++) {
        const xn = 200 + k * 620 + h2(k, 3) * 200 - 1.75 * P;
        if (xn < -340 || xn > W + 20) continue;
        g.drawImage(x3Near(k % 4), Math.round(xn), X3.bot - 150 + Math.round(h2(k, 4) * 40), 360, 200);
      }
      for (let k = 0; k < 2; k++) {
        const xb = Math.round(1180 + k * 1500 - 1.9 * P);
        if (xb < -470 || xb > W + 10) continue;
        if (k % 2) { g.save(); g.translate(xb + 460, X3.top - 6); g.scale(-1, 1); g.drawImage(x3Bough(), 0, 0, 460, 280); g.restore(); }
        else g.drawImage(x3Bough(), xb, X3.top - 6, 460, 280);
      }
      // 强拍：雾从右边涌起，长卷停在仙灵岛
      const fg = easeOut(seg(lt, fogT, fogT + 1.6));
      if (fg > 0) {
        // 雾锋（缓存的横向渐变，整数平移）＋其后一层匀雾＋左边越积越厚的旧地
        const fxp = Math.round(lerp(W + 260, -200, fg));
        g.globalAlpha = 1 - fg * 0.5; g.drawImage(x3FogFront(), fxp - 300, X3.top, 560, X3.bot - X3.top);
        g.globalAlpha = 1; g.fillStyle = 'rgba(242,238,228,0.26)'; if (fxp + 260 < W) g.fillRect(Math.max(0, fxp + 260), X3.top, W - Math.max(0, fxp + 260), X3.bot - X3.top);
        g.globalAlpha = fg; g.drawImage(x3FogLeft(), 0, X3.top, 520, X3.bot - X3.top);
        // 两条雾带缓缓往左流
        for (const [y, sp, a, k] of [[X3.hor - 20, 34, 0.5, 0], [X3.hor - 200, 22, 0.36, 1]]) {
          const off = Math.round(((t * sp + k * 700) % 1400 + 1400) % 1400), mb = x3MistBand(k), sc = mb.width / mb.lw;
          g.globalAlpha = a * fg;
          g.drawImage(mb, off * sc, 0, W * sc, mb.height, 0, y, W, 220);
        }
        g.globalAlpha = 1;
      }
      // 灯火：暖光晕在绢上化开；到了各自的拍点熄灭，一闪，冒一缕青烟
      for (const L of X3LAMPS) {
        const x = L.x - P, y = L.y, tk = ck.beat(L.k) + (L.x % 2 ? 0.07 : 0);
        if (x < -140 || x > W + 140) continue;
        const k = 1 - smooth(seg(lt, tk, tk + 0.3));
        const fl = 0.85 + 0.15 * noise1(t * 7 + L.x, 3);
        if (k > 0.01) {
          dot(g, x, y, 100 * L.r * fl, '#ffb060', 0.32 * k, 'source-over');
          dot(g, x, y, 34 * L.r * fl, '#fff0c0', 0.75 * k, 'screen');
          g.fillStyle = rgba('#e85a2a', 0.9 * k); g.beginPath(); g.ellipse(x, y + 1, 2.6 * L.r, 5 * L.r * fl, 0, 0, TAU); g.fill();
          g.fillStyle = rgba('#fff4c8', 0.9 * k); g.beginPath(); g.ellipse(x, y + 2, 1.1 * L.r, 2.4 * L.r * fl, 0, 0, TAU); g.fill();
        }
        const age = lt - tk;
        if (age > 0 && age < 0.25) dot(g, x, y, 70 * L.r, '#fff4d8', 0.5 * (1 - age / 0.25), 'screen');
        if (age > 0.1 && age < 1.8) {
          const u = (age - 0.1) / 1.7;
          g.strokeStyle = rgba('#5a6470', 0.5 * (1 - u)); g.lineWidth = 1.5;
          g.beginPath();
          for (let i = 0; i <= 12; i++) { const v = i / 12, yy = y - v * 60 * (0.4 + u), xx = x + Math.sin(v * 6 + age * 3) * 6 * v; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
          g.stroke();
        }
      }
      // 灯尽：卷面沉进黎明前的冷蓝，接下一镜
      const cool = smooth(seg(lt, stopT - 0.2, Math.max(c.dur, stopT + 1)));
      if (cool > 0) {
        g.globalCompositeOperation = 'multiply'; g.fillStyle = mix('#ffffff', '#5a7ab0', 0.62 * cool); g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
      }
      // 锦缎包首
      const bro = x3Brocade(), bo = ((Pi % 80) + 80) % 80;
      g.drawImage(bro, bo, 0, W, 40, 0, 0, W, X3.top);
      g.drawImage(bro, bo, 0, W, 40, 0, X3.bot, W, H - X3.bot);
      g.fillStyle = 'rgba(30,26,20,0.25)'; g.fillRect(0, X3.top, W, 3); g.fillRect(0, X3.bot - 3, W, 3);
    },
  });
  // =====================================================================
  // 主歌B2 第25句 孤舟归岛：第9句 —— 白发人划船靠岸，雾开处是水月宫的残迹
  // =====================================================================
  const V21T = [0.35, 0.63, 1.01, 1.49, 1.75, 2.27];
  const V21 = { wl: 690, touchX: 772, fig: 2.8, L: 1080 };
  // 沙嘴的水线：船头触沙处 (772, 694) 往右上收向远处
  const v21Wl = (x) => (x < 760 ? 700 : 694 - Math.pow((x - 760) / 530, 0.75) * 104);
  // 船头位置：每拍一桨，桨后滑行；“尽”字上触沙停住
  function v21Prow(lt, touch, beats) {
    const S = (t) => { let s = 0.22 * t; for (const b of beats) if (t > b) s += 1 - Math.exp(-(t - b) / 0.42); return s; };
    const a = -0.4, s0 = S(a), s1 = S(touch);
    if (lt >= touch) return V21.touchX - 4 * Math.sin(Math.min(1, (lt - touch) / 0.3) * PI) * Math.exp(-(lt - touch) * 2);
    return lerp(V21.touchX - 250, V21.touchX, (S(Math.max(lt, a - 0.5)) - s0) / (s1 - s0));
  }
  // 天（缓存）：西边（左上）还是深蓝，东边（右）透出黎明前的灰白；远岛山影化在雾里
  function v21Sky() {
    return K.cache('g08|v21sky', W, H, 1, (q) => {
      q.fillStyle = K.lin(q, 0, 0, 0, 560, [[0, '#1c3762'], [0.45, '#3c5a88'], [0.8, '#8ea2c4'], [1, '#a1afc9']]); q.fillRect(0, 0, W, H);
      q.fillStyle = K.lin(q, 300, 0, W, 0, [[0, 'rgba(161,175,201,0)'], [0.6, 'rgba(176,190,214,0.55)'], [1, 'rgba(196,210,228,0.85)']]); q.fillRect(0, 0, W, 560);
      // 东边天际一道亮带（在废墟后面）
      q.fillStyle = K.lin(q, 0, 380, 0, 520, [[0, 'rgba(214,236,240,0)'], [0.6, 'rgba(214,236,240,0.55)'], [1, 'rgba(227,249,253,0.2)']]); q.fillRect(500, 380, 800, 140);
      q.fillStyle = 'rgba(70,92,128,0.3)';
      q.beginPath(); q.moveTo(380, 520); q.bezierCurveTo(520, 380, 700, 350, 860, 380); q.bezierCurveTo(990, 400, 1100, 440, 1290, 470); q.lineTo(1290, 520); q.closePath(); q.fill();
      q.fillStyle = 'rgba(70,92,128,0.2)';
      q.beginPath(); q.moveTo(-10, 520); q.bezierCurveTo(90, 440, 220, 430, 380, 470); q.lineTo(440, 520); q.closePath(); q.fill();
      E.mist(q, { t: 0, y: 470, h: 160, color: '#b8c6da', alpha: 0.6, seed: 3 });
    });
  }
  // 雾带（缓存）：平顶、柔边的横向雾层，比天光暗一点
  function v21Bank(k) {
    return K.cache('g08|v21bank' + k, 900, 300, 1, (q) => {
      const r = A.rng(77 + k), col = k ? '#8ea2c4' : '#a1afc9';
      for (let i = 0; i < 46; i++) { const x = 60 + r() * 780, y = 150 + (r() - 0.3) * 60, rx = 120 + r() * 160, ry = 30 + r() * 36; q.fillStyle = K.rad(q, 0, 0, 0, 1, [[0, rgba(col, 0.5)], [1, rgba(col, 0)]]); q.save(); q.translate(x, y); q.scale(rx, ry); q.beginPath(); q.arc(0, 0, 1, 0, TAU); q.fill(); q.restore(); }
      // 顶边压平：上半截按高度淡出；左右两端淡出
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.lin(q, 0, 50, 0, 150, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(0, 0, 900, 300);
      q.fillStyle = K.lin(q, 0, 0, 900, 0, [[0, 'rgba(0,0,0,0)'], [0.15, 'rgba(0,0,0,1)'], [0.85, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, 900, 300);
    });
  }
  // 两层雾带叠成一幅“幕布”（缓存）
  const v21Curtain = () => K.cache('g08|v21cur', 920, 460, 1, (q) => { q.drawImage(v21Bank(0), 0, 0, 900, 300); q.drawImage(v21Bank(1), 20, 160, 900, 300); });
  // 沙嘴与水月宫残迹（缓存）：半埋的须弥座、汉白玉栏板与望柱、断柱、歪斜的残牌坊、散落的琉璃瓦和翻倒的柱础
  function v21Land() {
    return K.cache('g08|v21land', W, H, 1, (q) => {
      const r = A.rng(2101);
      const jade = (x0, x1) => K.lin(q, x0, 0, x1, 0, [[0, '#8e9cae'], [0.3, '#e6ecf2'], [0.65, '#c2ccd8'], [1, '#76869a']]);
      const ink = 'rgba(56,68,88,0.55)';
      // 沙：柔边（模糊一次），后接废墟脚下，前到水线
      const sand = () => { q.beginPath(); q.moveTo(1300, 518); q.quadraticCurveTo(1000, 512, 760, 528); q.quadraticCurveTo(640, 540, 600, 560); q.quadraticCurveTo(700, 640, 760, 700); for (let x = 760; x <= 1300; x += 20) q.lineTo(x, v21Wl(x)); q.closePath(); };
      q.save(); q.filter = 'blur(2.5px)'; sand(); q.fillStyle = K.lin(q, 0, 512, 0, 700, [[0, '#b6b2ae'], [0.55, '#a2a2a6'], [1, '#8a90a0']]); q.fill(); q.filter = 'none'; q.restore();
      q.save(); sand(); q.clip();
      for (let k = 0; k < 6; k++) { q.fillStyle = 'rgba(60,74,96,0.1)'; q.beginPath(); q.ellipse(720 + k * 100 + r() * 40, 560 + r() * 40, 120, 12, -0.05, 0, TAU); q.fill(); }
      // 水线处一条湿沙（更深），再往上一线反光
      q.filter = 'blur(4px)'; q.strokeStyle = 'rgba(64,78,100,0.45)'; q.lineWidth = 26;
      q.beginPath(); for (let x = 740; x <= 1300; x += 20) { const y = v21Wl(x) - 8; x === 740 ? q.moveTo(x, y) : q.lineTo(x, y); } q.stroke(); q.filter = 'none';
      q.strokeStyle = 'rgba(214,226,238,0.4)'; q.lineWidth = 1.2;
      q.beginPath(); for (let x = 800; x <= 1300; x += 20) { const y = v21Wl(x) - 22; x === 800 ? q.moveTo(x, y) : q.lineTo(x, y); } q.stroke();
      for (let k = 0; k < 700; k++) { const x = 600 + r() * 700, y = 512 + r() * 190; q.fillStyle = r() < 0.5 ? 'rgba(230,236,244,0.22)' : 'rgba(60,70,86,0.16)'; q.fillRect(x, y, 1 + r() * 2, 1); }
      q.restore();
      // —— 须弥座：台面、上枋、仰莲一排、束腰，下半截埋在沙里 ——
      const bx0 = 690, bx1 = 1030, top = 498;
      q.fillStyle = '#dde4ec'; q.fillRect(bx0 - 6, top, bx1 - bx0 + 12, 8);
      q.fillStyle = jade(bx0, bx1); q.fillRect(bx0, top + 8, bx1 - bx0, 10);
      q.strokeStyle = ink; q.lineWidth = 1; q.strokeRect(bx0 - 6, top, bx1 - bx0 + 12, 8); q.strokeRect(bx0, top + 8, bx1 - bx0, 10);
      q.fillStyle = '#c8d2dc'; q.fillRect(bx0 + 4, top + 18, bx1 - bx0 - 8, 11);
      q.strokeStyle = 'rgba(70,84,104,0.5)'; q.lineWidth = 0.9;
      for (let x = bx0 + 8; x < bx1 - 6; x += 12) { q.beginPath(); q.moveTo(x, top + 29); q.quadraticCurveTo(x + 6, top + 16, x + 12, top + 29); q.stroke(); }
      q.fillStyle = '#9eaab8'; q.fillRect(bx0 + 12, top + 29, bx1 - bx0 - 24, 12);
      for (let x = bx0 + 24; x < bx1 - 30; x += 46) { q.strokeStyle = 'rgba(60,72,90,0.45)'; q.strokeRect(x, top + 31, 34, 8); }
      // 残损的台沿：几处缺口
      q.fillStyle = '#b6b2ae';
      for (const [x, w] of [[742, 26], [902, 34], [1004, 22]]) { q.beginPath(); q.moveTo(x, top - 1); q.lineTo(x + w * 0.3, top + 9 + r() * 6); q.lineTo(x + w * 0.7, top + 6 + r() * 6); q.lineTo(x + w, top - 1); q.closePath(); q.fill(); }
      // 沙埋到束腰
      q.fillStyle = '#b2aea9';
      q.beginPath(); q.moveTo(bx0 - 30, top + 60); for (let x = bx0 - 30; x <= bx1 + 30; x += 20) q.lineTo(x, top + 34 + Math.sin(x * 0.03) * 4 + (r() - 0.5) * 4); q.lineTo(bx1 + 30, top + 60); q.closePath(); q.fill();
      // —— 汉白玉栏杆：望柱（莲苞头）与栏板（宝瓶、云头），中间缺了一段 ——
      const rail = top - 2;
      const post = (x, h) => {
        q.fillStyle = jade(x - 5, x + 5); q.fillRect(x - 5, rail - h, 10, h);
        q.strokeStyle = ink; q.lineWidth = 1; q.strokeRect(x - 5, rail - h, 10, h);
        q.fillStyle = '#e6ecf2'; q.beginPath(); q.ellipse(x, rail - h - 6, 6.5, 8, 0, 0, TAU); q.fill(); q.stroke();
        q.beginPath(); q.moveTo(x - 7, rail - h - 2); q.quadraticCurveTo(x, rail - h - 8, x + 7, rail - h - 2); q.stroke();
      };
      const panel = (x0, x1, broken) => {
        const y0 = rail - 40;
        q.fillStyle = '#d4dce6'; q.fillRect(x0, y0 + 10, x1 - x0, 30);
        q.strokeStyle = ink; q.strokeRect(x0, y0 + 10, x1 - x0, 30);
        // 宝瓶镂空
        const m = (x0 + x1) / 2;
        q.fillStyle = 'rgba(80,96,120,0.55)'; q.beginPath(); q.ellipse(m - 12, y0 + 25, 6, 9, 0, 0, TAU); q.ellipse(m + 12, y0 + 25, 6, 9, 0, 0, TAU); q.fill();
        // 寻杖扶手与云头
        if (!broken) { q.fillStyle = '#e2e8ee'; q.fillRect(x0, y0, x1 - x0, 5); q.strokeRect(x0, y0, x1 - x0, 5); q.beginPath(); q.arc(m, y0 + 8, 4, PI, TAU); q.stroke(); }
        else { q.fillStyle = '#b6b2ae'; q.beginPath(); q.moveTo(m - 6, y0 + 9); q.lineTo(m + 4, y0 + 22); q.lineTo(x1, y0 + 14); q.lineTo(x1, y0 + 8); q.closePath(); q.fill(); }
      };
      panel(705, 760, false); panel(760, 815, true); panel(815, 868, false); panel(980, 1026, true);
      post(705, 44); post(760, 44); post(815, 40); post(868, 26); post(980, 44); post(1026, 30);
      // —— 断柱：圆柱、覆莲柱础，顶上断口参差 ——
      const pillar = (x, h, w, broken, lean) => {
        q.save(); q.translate(x, rail); q.rotate(lean);
        q.fillStyle = jade(-w / 2, w / 2);
        q.beginPath(); q.moveTo(-w / 2, 0); q.lineTo(-w / 2, -h);
        if (broken) { for (let k = 0; k <= 7; k++) q.lineTo(-w / 2 + (k / 7) * w, -h - (r() - 0.3) * w * 0.9); } else q.lineTo(w / 2, -h);
        q.lineTo(w / 2, 0); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(70,84,104,0.4)'; q.lineWidth = 1; q.stroke();
        q.strokeStyle = 'rgba(70,84,104,0.3)'; for (const k of [-0.25, 0.22]) { q.beginPath(); q.moveTo(k * w, -8); q.lineTo(k * w, -h + 10); q.stroke(); }
        // 柱础：覆莲
        q.fillStyle = '#c8d2dc'; q.beginPath(); q.ellipse(0, -2, w * 0.85, 8, 0, 0, TAU); q.fill(); q.stroke();
        for (let k = -2; k <= 2; k++) { q.beginPath(); q.moveTo(k * w * 0.3 - w * 0.14, -4); q.quadraticCurveTo(k * w * 0.3, -14, k * w * 0.3 + w * 0.14, -4); q.stroke(); }
        if (!broken) { q.fillStyle = '#d8e0e8'; q.fillRect(-w * 0.7, -h - 10, w * 1.4, 12); q.strokeRect(-w * 0.7, -h - 10, w * 1.4, 12); q.strokeStyle = 'rgba(200,170,100,0.6)'; q.beginPath(); q.arc(-w * 0.2, -h + 10, 5, PI * 0.2, PI * 1.6); q.arc(w * 0.2, -h + 10, 5, PI * 1.4, PI * 2.8); q.stroke(); }
        q.strokeStyle = 'rgba(50,60,74,0.55)'; q.beginPath(); q.moveTo(-w * 0.2, -h * 0.4); q.lineTo(w * 0.12, -h * 0.55); q.lineTo(-w * 0.05, -h * 0.72); q.stroke();
        q.fillStyle = 'rgba(80,110,96,0.45)'; for (let k = 0; k < 5; k++) { q.beginPath(); q.ellipse((r() - 0.5) * w, -14 - r() * 40, 6, 3.5, 0, 0, TAU); q.fill(); }
        q.restore();
      };
      pillar(736, 170, 30, true, -0.02); pillar(846, 250, 34, false, 0.01); pillar(910, 112, 32, true, 0.035);
      // —— 残牌坊：两根方柱、额枋，上面的小瓦顶歪向一边，裂了缝、缺了瓦 ——
      const ax0 = 952, ax1 = 1030, atop = 286;
      for (const x of [ax0, ax1]) { q.fillStyle = jade(x - 8, x + 8); q.fillRect(x - 8, atop, 16, rail - atop); q.strokeStyle = ink; q.strokeRect(x - 8, atop, 16, rail - atop); q.fillStyle = '#c0cad6'; q.fillRect(x - 13, rail - 16, 26, 16); }
      q.fillStyle = jade(ax0, ax1); q.fillRect(ax0 - 14, atop + 10, ax1 - ax0 + 28, 16); q.strokeRect(ax0 - 14, atop + 10, ax1 - ax0 + 28, 16);
      q.save(); q.translate(ax0 - 18, atop + 8); q.rotate(0.13);
      q.fillStyle = '#24323a'; q.beginPath(); q.moveTo(-10, 4); q.quadraticCurveTo(50, -6, ax1 - ax0 + 50, 2); q.lineTo(ax1 - ax0 + 38, -16); q.lineTo(4, -18); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(160,190,200,0.45)'; q.lineWidth = 1; for (let x = 4; x < ax1 - ax0 + 36; x += 6) { q.beginPath(); q.moveTo(x, -16); q.lineTo(x - 1, 1); q.stroke(); }
      q.fillStyle = '#b6b2ae'; q.beginPath(); q.moveTo(46, -18); q.lineTo(58, -4); q.lineTo(70, -18); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(20,26,30,0.8)'; q.lineWidth = 1.4; q.beginPath(); q.moveTo(30, -17); q.lineTo(36, -8); q.lineTo(31, 2); q.stroke();
      q.restore();
      // 翻倒的柱础、断柱段与散落的琉璃瓦
      q.save(); q.translate(900, 574); q.rotate(-0.12);
      q.fillStyle = K.lin(q, 0, -16, 0, 16, [[0, '#d8e0ea'], [1, '#8494a8']]); q.fillRect(-70, -15, 140, 30);
      q.strokeStyle = 'rgba(70,84,104,0.45)'; q.lineWidth = 1; for (const k of [-6, 6]) { q.beginPath(); q.moveTo(-68, k); q.lineTo(68, k); q.stroke(); }
      q.beginPath(); q.ellipse(70, 0, 7, 15, 0, 0, TAU); q.fillStyle = '#c4ced8'; q.fill(); q.stroke();
      q.restore();
      q.save(); q.translate(780, 560); q.rotate(0.5); q.fillStyle = '#c8d2dc'; q.beginPath(); q.ellipse(0, 0, 22, 9, 0, 0, TAU); q.fill(); q.strokeStyle = ink; q.stroke(); q.beginPath(); q.ellipse(0, -4, 16, 6, 0, 0, TAU); q.stroke(); q.restore();
      for (let k = 0; k < 9; k++) {
        const x = 700 + r() * 330, y = 540 + r() * 60;
        q.save(); q.translate(x, y); q.rotate((r() - 0.5) * 1.2);
        q.fillStyle = r() < 0.5 ? '#24424a' : '#1c3440'; q.beginPath(); q.moveTo(-8, 0); q.quadraticCurveTo(0, -6, 8, 0); q.lineTo(7, 3); q.quadraticCurveTo(0, -2, -7, 3); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(140,180,190,0.4)'; q.lineWidth = 0.8; q.beginPath(); q.moveTo(-6, -1); q.quadraticCurveTo(0, -5, 6, -1); q.stroke();
        q.restore();
      }
      // 野草：只在 620–1040 之间
      q.lineCap = 'round';
      for (let k = 0; k < 170; k++) {
        const x = 620 + r() * 420, y = top + 30 + r() * 30, l = 14 + r() * 40, a = -PI / 2 + (r() - 0.5) * 0.9;
        q.strokeStyle = rgba(r() < 0.5 ? '#46566a' : '#5a6a72', 0.6 + r() * 0.3); q.lineWidth = 0.8 + r() * 1.2;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.6, x + Math.cos(a + 0.25) * l, y + Math.sin(a + 0.25) * l); q.stroke();
      }
    });
  }
  // 整幅静景（缓存，不透明）：天、沙嘴与残迹、近处的水
  function v21Bg() {
    return K.cache('g08|v21bg', W, H, 1, (q) => {
      q.drawImage(v21Sky(), 0, 0, W, H);
      q.globalCompositeOperation = 'screen'; A.softBlob(q, 940, 460, 220, 0.2, '#d6ecf0'); q.globalCompositeOperation = 'source-over';
      q.drawImage(v21Land(), 0, 0, W, H);
      q.fillStyle = K.lin(q, 0, 520, 0, H, [[0, '#a1afc9'], [0.4, '#6f84a6'], [1, '#2e4466']]);
      q.beginPath(); q.moveTo(-10, 528); q.lineTo(600, 560); q.quadraticCurveTo(700, 640, 760, 700); q.lineTo(-10, 720); q.closePath(); q.fill();
      q.fillRect(-10, 698, W + 20, 30);
    });
  }
  // 水面薄雾带（缓存，整数平移）
  function v21MistBand() {
    return K.cache('g08|v21mist', 1400, 120, 1, (q) => {
      const r = A.rng(3711);
      for (let i = 0; i < 40; i++) { const x = r() * 1400, y = 60 + (r() - 0.5) * 30, rr = 40 + r() * 60; for (const dx of [-1400, 0, 1400]) A.softBlob(q, x + dx, y, rr, 0.2, '#c0cee0'); }
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.lin(q, 0, 0, 0, 120, [[0, 'rgba(0,0,0,0)'], [0.4, 'rgba(0,0,0,1)'], [0.6, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(0, 0, 1400, 120);
    });
  }
  // 小船（侧面，船头朝右）：part 'back' 远侧船舷，'front' 近侧船身
  function v21Boat(g, x, y, L, rot, part) {
    g.save(); g.translate(x, y); g.rotate(rot);
    const h = 70;
    if (part === 'back') {
      g.fillStyle = '#2a2420';
      g.beginPath(); g.moveTo(-L / 2, -h + 6); g.quadraticCurveTo(0, -h + 18, L / 2 + 14, -h - 10); g.lineTo(L / 2 - 8, -h + 2); g.quadraticCurveTo(0, -h + 28, -L / 2 + 8, -h + 14); g.closePath(); g.fill();
      g.restore(); return;
    }
    const hull = () => {
      g.beginPath();
      g.moveTo(-L / 2 - 18, -h);
      g.quadraticCurveTo(-L / 2 + 14, 6, -L * 0.2, 14);
      g.lineTo(L * 0.18, 14);
      g.quadraticCurveTo(L / 2 - 8, 6, L / 2 + 34, -h - 18);
      g.lineTo(L / 2 + 18, -h - 6);
      g.quadraticCurveTo(L * 0.1, -h + 14, -L / 2 - 6, -h + 6);
      g.closePath();
    };
    hull();
    g.fillStyle = K.lin(g, 0, -h - 12, 0, 14, [[0, '#6a5a4c'], [0.5, '#463a32'], [1, '#221c18']]); g.fill();
    g.save(); hull(); g.clip();
    g.strokeStyle = 'rgba(20,16,14,0.5)'; g.lineWidth = 1.2;
    for (let k = 1; k < 5; k++) { const yy = -h + k * 13; g.beginPath(); g.moveTo(-L / 2, yy - 2); g.quadraticCurveTo(0, yy + 8, L / 2 + 20, yy - 14 - k); g.stroke(); }
    g.fillStyle = 'rgba(190,210,230,0.14)'; g.fillRect(-L / 2 - 20, -4, L + 60, 20);
    g.restore();
    g.strokeStyle = 'rgba(214,226,240,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-L / 2 - 6, -h + 6); g.quadraticCurveTo(L * 0.1, -h + 14, L / 2 + 18, -h - 6); g.stroke();
    g.restore();
  }
  // 寄居蟹：螺壳、小腿、一点影子
  function v21Crab(g, x, y, t, dir, s) {
    const st = Math.sin(t * 16);
    g.save(); g.translate(x, y); g.scale(dir * s, s);
    g.fillStyle = 'rgba(40,48,64,0.3)'; g.beginPath(); g.ellipse(0, 6, 11, 2.6, 0, 0, TAU); g.fill();
    g.strokeStyle = '#4a3a34'; g.lineWidth = 1.2; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const ph = st * (k % 2 ? 1 : -1) * 2; g.beginPath(); g.moveTo(-3 + k * 3, 0); g.lineTo(-6 + k * 4 + ph, 5); g.stroke(); }
    g.fillStyle = '#8a5a46'; g.beginPath(); g.ellipse(5, -1, 3.4, 2.4, 0, 0, TAU); g.fill();
    g.strokeStyle = '#8a5a46'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(7, -2); g.lineTo(10, -5); g.moveTo(6, -2); g.lineTo(8, -6); g.stroke();
    g.fillStyle = K.lin(g, -8, -10, 4, 2, [[0, '#f0e6da'], [1, '#a08a7c']]);
    g.beginPath(); g.ellipse(-2, -4, 7, 6, -0.3, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(90,70,60,0.75)'; g.lineWidth = 0.9; g.beginPath(); g.arc(-2, -4, 3.5, 0, PI * 1.5); g.stroke();
    g.restore();
  }
  // 两段的手臂：肩 → 肘 → 手（解两节骨的位置，肘朝下后方）；宽袖
  function v21Arm(g, S, Gp, l1, l2, col, rim) {
    const dx = Gp[0] - S[0], dy = Gp[1] - S[1], d = Math.min(l1 + l2 - 1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx), c1 = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), b = Math.acos(c1);
    const E2 = [S[0] + Math.cos(a + b) * l1, S[1] + Math.sin(a + b) * l1];
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 袖：上臂粗，前臂下垂一片袖口
    g.strokeStyle = col; g.lineWidth = 26; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E2[0], E2[1]); g.stroke();
    g.lineWidth = 20; g.beginPath(); g.moveTo(E2[0], E2[1]); g.lineTo(Gp[0], Gp[1]); g.stroke();
    const fx = Gp[0] - E2[0], fy = Gp[1] - E2[1], fl = Math.hypot(fx, fy) || 1, nx = -fy / fl, ny = fx / fl, sgn = ny > 0 ? 1 : -1;
    g.fillStyle = col; g.beginPath(); g.moveTo(E2[0], E2[1]); g.lineTo(Gp[0] - fx * 0.12, Gp[1] - fy * 0.12); g.quadraticCurveTo(Gp[0] + nx * sgn * 30, Gp[1] + ny * sgn * 30 + 18, E2[0] + nx * sgn * 22 + fx * 0.2, E2[1] + ny * sgn * 22 + fy * 0.2); g.closePath(); g.fill();
    g.strokeStyle = rim; g.lineWidth = 2; g.beginPath(); g.moveTo(S[0] + 4, S[1] - 10); g.lineTo(E2[0] + 4, E2[1] - 9); g.lineTo(Gp[0], Gp[1] - 9); g.stroke();
    g.fillStyle = '#d6ccc0'; g.beginPath(); g.ellipse(Gp[0], Gp[1], 8, 7, a, 0, TAU); g.fill();
  }

  XYT.registerShot('vb21_ruins', {
    name: '孤舟归岛', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(236,244,250,0.88)', accent: '#2e4e7e', bloom: 0.3,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      const ct = chars(c, V21T), touch = ct[4], headT = ct[5];
      const beats = shotBeats(c).filter((b) => b.lt < touch - 0.2).map((b) => b.lt);
      if (!beats.length) beats.push(-0.4, 0.43, 1.26);
      const xp = v21Prow(lt, touch, beats), L = V21.L, bx = xp - L / 2 - 34;
      const since = lt - touch, jolt = since > 0 ? Math.exp(-since * 4) * Math.sin(since * 22) : 0;
      const rot = -0.006 + 0.003 * Math.sin(t * 1.3) + 0.018 * jolt;
      const bob = Math.round(2 * Math.sin(t * 1.6) * (since > 0 ? 0.3 : 1));
      // 天与远岛；东边那道天光越来越亮，“头”字上再亮一层
      g.drawImage(v21Bg(), 0, 0, W, H);
      const dawn = 0.15 + 0.25 * seg(lt, 0, c.dur) + 0.35 * smooth(seg(lt, headT - 0.1, headT + 0.6));
      oval(g, 930, 470, 420, 70, '#e3f9fd', dawn * 0.6, 'screen');
      // 废墟前几丛长草随风摆
      g.lineCap = 'round';
      for (let k = 0; k < 22; k++) {
        const x = 630 + h2(k, 11) * 400, y = 530 + h2(k, 12) * 24, l = 30 + 40 * h2(k, 13), sw = Math.sin(t * 1.5 + k) * 0.12 - 0.12;
        g.strokeStyle = rgba('#3e4e5c', 0.75); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sw * l * 0.4, y - l * 0.6, x + sw * l, y - l); g.stroke();
      }
      // 牌坊上挂着一片撕破的白纱，被海风吹向左边
      {
        const x0 = 1018, y0 = 302, n = 12;
        g.beginPath();
        const pts = [];
        for (let i = 0; i <= n; i++) { const u = i / n, w = Math.sin(t * 2.2 - u * 4) * 10 * u + Math.sin(t * 3.7 - u * 7) * 4 * u; pts.push([x0 - u * 90 - u * u * 30 + w * 0.4, y0 + u * 110 + w]); }
        pts.forEach(([x, y], i) => (i ? g.lineTo(x - 8 * (1 - i / n), y) : g.moveTo(x - 8, y)));
        for (let i = n; i >= 0; i--) { const [x, y] = pts[i]; g.lineTo(x + 10 * (1 - i / n) + 2, y - 4 - 6 * (i / n) * Math.sin(t * 3 + i)); }
        g.closePath(); g.fillStyle = 'rgba(236,242,248,0.62)'; g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke();
      }
      // 浪花花边轻拍沙岸
      {
        const surge = 0.5 + 0.5 * Math.sin(t * 1.4);
        g.strokeStyle = rgba('#eef6fa', 0.55 + 0.3 * surge); g.lineWidth = 1.5;
        g.beginPath();
        for (let x = 1300; x >= 770; x -= 14) { const y = v21Wl(x) - 3 + surge * 4 + Math.sin(x * 0.06 + t * 2) * 1.4; x === 1300 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
        g.lineWidth = 1; g.strokeStyle = rgba('#eef6fa', 0.4);
        g.beginPath();
        for (let x = 1290; x >= 780; x -= 22) { const y = v21Wl(x) + 2 + surge * 4; g.moveTo(x + 8, y); g.arc(x, y, 8, 0, PI, true); }
        g.stroke();
      }
      // 寄居蟹：船头一顿之后，从船头旁爬过沙面
      if (lt > touch + 0.25) { const u = lt - touch - 0.25; v21Crab(g, 792 + u * 36, 662 - u * 6, t, 1, 2.5); }
      // —— 雾：两层平顶的雾带挡着废墟，“尽”字起像幕布一样向两边拉开，“头”字前拉完 ——
      const part = easeInOut(seg(lt, touch, headT));
      g.globalAlpha = 0.94 * (1 - part * 0.75);
      g.drawImage(v21Curtain(), Math.round(400 - part * 700 + Math.sin(t * 0.3) * 8), 190, 920, 460);
      g.drawImage(v21Curtain(), Math.round(760 + part * 640 - Math.sin(t * 0.3) * 8), 170, 920, 460);
      g.globalAlpha = 1;
      // —— 水：近处深蓝；船、人、桨 ——
      {
        g.strokeStyle = 'rgba(214,236,240,0.32)'; g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < 22; k++) {
          const y = 552 + Math.pow(h2(k, 21), 1.2) * 160, x = ((h2(k, 22) * 1400 + t * (6 + 10 * h2(k, 23))) % 1400) - 160, w = 30 + 80 * h2(k, 24) * (y - 540) / 160;
          if (x + w > 600 + (y - 560) * 1.1) continue;
          g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 2, x + w, y);
        }
        g.stroke();
      }
      // 船头触沙的水纹
      if (since > 0 && since < 1.6) {
        for (let k = 0; k < 3; k++) {
          const a = since - k * 0.18; if (a <= 0) continue;
          const R = 14 + a * 110; g.strokeStyle = rgba('#ffffff', 0.5 * (1 - a / 1.6)); g.lineWidth = 1.3;
          g.beginPath(); g.ellipse(xp, V21.wl, R, R * 0.16, 0, PI, TAU); g.stroke();
        }
      }
      v21Boat(g, bx, V21.wl + bob, L, rot, 'back');
      const sx = Math.round(xp - 430), sy = V21.wl - 54 + bob;
      // 划桨：每拍一桨。拉桨时桨叶在水里往后走，回桨时提出水面向前
      let b0 = beats[0] - 0.83, bi = -1;
      for (let i = 0; i < beats.length; i++) if (lt >= beats[i]) { b0 = beats[i]; bi = i; }
      const per = 0.83, ph = clamp((lt - b0) / per);
      const rowing = lt < touch + 0.05;
      const sw = (a1, b1, u) => [lerp(a1[0], b1[0], u), lerp(a1[1], b1[1], u)];
      const Gc = [150, -112], Ge = [34, -98], Gr = [96, -140], Bc = [262, 34], Be = [-40, 30], Br = [120, -16];
      let Grel, Brel;
      if (rowing) {
        if (ph < 0.55) { const u = easeInOut(ph / 0.55); Grel = sw(Gc, Ge, u); Brel = sw(Bc, Be, u); }
        else { const u = easeInOut((ph - 0.55) / 0.45), q2 = (a1, m, b1) => [lerp(lerp(a1[0], m[0], u), lerp(m[0], b1[0], u), u), lerp(lerp(a1[1], m[1], u), lerp(m[1], b1[1], u), u)]; Grel = q2(Ge, Gr, Gc); Brel = q2([Be[0], Be[1] - 20], Br, [Bc[0], Bc[1] - 30]); }
      } else {
        // 触沙后桨收起，横搭在船舷上
        const k = smooth(seg(lt, touch + 0.05, touch + 0.7));
        Grel = sw(Ge, [40, -84], k); Brel = sw(Be, [-230, -40], k);
      }
      const lean = rowing ? lerp(0.18, -0.1, ph < 0.55 ? easeInOut(ph / 0.55) : 1 - easeInOut((ph - 0.55) / 0.45)) : lerp(0.2 * Math.exp(-Math.max(0, since) * 2.5), -0.04, smooth(seg(lt, touch + 0.3, touch + 1.3)));
      const o = { stage: 'old', pose: 'sit', seat: 'ledge', facing: 1, wind: 0.4, windDir: -1, prop: 'none', lean: lean + 0.05 * jolt, head: since > 0 ? -0.12 * smooth(seg(lt, touch + 0.3, headT + 0.4)) : 0, rim: '#e3f9fd', light: [1000, 450], rimWidth: 1.6, part: 'back' };
      F.draw(g, 'xiaoyao', sx, sy, V21.fig, t, o);
      const P = F.points('xiaoyao', sx, sy, V21.fig, t, o);
      v21Boat(g, bx, V21.wl + bob, L, rot, 'front');
      // 桨：长度固定，从握处指向桨叶
      const G = [sx + Grel[0], sy + Grel[1]], Bt = [sx + Brel[0], V21.wl + Brel[1]];
      const ang = Math.atan2(Bt[1] - G[1], Bt[0] - G[0]), Lp = 290;
      g.save(); g.translate(G[0], G[1]); g.rotate(ang);
      g.strokeStyle = '#3a2c22'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-10, 0); g.lineTo(Lp - 70, 0); g.stroke();
      g.strokeStyle = '#4a3a2c'; g.lineWidth = 16; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-4, 0); g.stroke();
      g.fillStyle = '#4e3e30'; g.beginPath(); g.moveTo(Lp - 80, -4); g.quadraticCurveTo(Lp - 30, -17, Lp + 10, -4); g.lineTo(Lp + 10, 4); g.quadraticCurveTo(Lp - 30, 17, Lp - 80, 4); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(214,226,240,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -3); g.lineTo(Lp - 70, -3); g.stroke();
      g.restore();
      // 近侧的手臂（自己画：肩 → 握处）
      v21Arm(g, P.shoulderN, G, 30 * V21.fig, 32 * V21.fig, '#3a3f46', 'rgba(220,240,250,0.55)');
      // 水面以下的桨叶与船身蒙一层水色
      g.fillStyle = 'rgba(46,68,102,0.55)'; g.fillRect(-10, V21.wl + 4, W + 20, H - V21.wl);
      // 入水的涟漪、回桨时的水滴
      const tipX = G[0] + Math.cos(ang) * Lp, tipY = G[1] + Math.sin(ang) * Lp;
      if (rowing && ph < 0.55) { const a = ph * per; for (let k = 0; k < 2; k++) { const aa = a - k * 0.12; if (aa <= 0) continue; const R = 8 + aa * 70; g.strokeStyle = rgba('#e8f2f8', 0.65 * (1 - aa / 0.5)); g.lineWidth = 1.3; g.beginPath(); g.ellipse(sx + 214 - aa * 140, V21.wl + 6, R * 1.4, R * 0.22, 0, 0, TAU); g.stroke(); } }
      if (rowing && ph >= 0.55) { g.fillStyle = 'rgba(226,240,250,0.85)'; for (let k = 0; k < 7; k++) { const u = (((ph - 0.55) / 0.45) * 1.2 + k * 0.15) % 1; g.beginPath(); g.arc(tipX + (h2(k, bi + 4) - 0.5) * 10, tipY + u * (V21.wl + 6 - tipY), 1.6, 0, TAU); g.fill(); } }
      // 近处水面的薄雾
      { const off = Math.round((((t * 6 + 500) % 1400) + 1400) % 1400); g.globalAlpha = 0.45; g.drawImage(v21MistBand(), off - 1400, 590, 1400, 120); g.drawImage(v21MistBand(), off, 590, 1400, 120); g.globalAlpha = 1; }
      // 近景：左下角几枝失焦的芦苇
      E.reeds(g, { t, x0: -40, x1: 90, y: H + 20, h: 320, n: 6, color: '#1e2a3a', plume: '#a8b8cc', wind: 0.4, seed: 21 });
    },
  });
  // =====================================================================
  // 主歌B2 第26句 空台系绸：第10句 —— 俯拍荒废擂台，白发人拾起泡在水里的红绸，系回柱上
  // =====================================================================
  const V22T = [0.24, 0.64, 1.04, 1.44, 1.84, 2.34];
  // 俯拍：台板汇向画面上方的 vp；竖直的东西汇向画面下方很远的 nadir（越靠右越往右斜）
  const V22 = { fx: 820, fy: 640, fs: 1.85, sq: 0.92, vpx: 640, vpy: -1150, nad: [640, 3200], pb: [884, 586] };
  const v22Lean = (x, y) => Math.atan2(x - V22.nad[0], V22.nad[1] - y);
  const v22PX = (y) => V22.pb[0] + (V22.pb[1] - y) * Math.tan(v22Lean(V22.pb[0], V22.pb[1]));
  const v22PW = (y) => lerp(46, 62, clamp((V22.pb[1] - y) / 640));
  // 人物的局部变换：绕脚底按当地竖线转一点，再压扁
  const v22FigLean = v22Lean(V22.fx, V22.fy);
  const v22Tx = ([x, y]) => { const dx = x - V22.fx, dy = (y - V22.fy) * V22.sq, c0 = Math.cos(v22FigLean), s0 = Math.sin(v22FigLean); return [V22.fx + dx * c0 - dy * s0, V22.fy + dx * s0 + dy * c0]; };
  // 水洼（不规则椭圆）：主水洼在柱脚前
  const V22P = [[930, 626, 150, 36, 1], [560, 452, 110, 30, 2], [300, 664, 110, 28, 3], [780, 300, 86, 20, 4], [660, 690, 90, 22, 5]];
  function v22PudPath(g, p, k = 1) {
    const [cx, cy, rx, ry, sd] = p;
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const th = (i / 40) * TAU, r = (0.82 + 0.3 * noise1(th * 1.5 + sd * 7, sd)) * k; i ? g.lineTo(cx + Math.cos(th) * rx * r, cy + Math.sin(th) * ry * r) : g.moveTo(cx + Math.cos(th) * rx * r, cy + Math.sin(th) * ry * r); }
    g.closePath();
  }
  // 台板与台边（缓存，不透明）：湿亮的旧木板，左上来的光在板沿上一线；台外是雨里的栏杆与柳影
  function v22Floor() {
    return K.cache('g08|v22floor' + fontK(), W, H, 1, (q) => {
      const r = A.rng(2201), top = 110;
      // 台外：雨雾里的柳影（糊），台边栏杆
      q.fillStyle = K.lin(q, 0, 0, 0, top, [[0, '#2a2440'], [1, '#3a3252']]); q.fillRect(0, 0, W, top + 4);
      const wil = K.cache('g08|v22wil', W, 140, 0.5, (p) => {
        const rr = A.rng(2210);
        p.strokeStyle = 'rgba(30,26,44,0.8)'; p.lineCap = 'round';
        for (let k = 0; k < 5; k++) {
          const x0 = 120 + k * 260 + rr() * 80;
          p.fillStyle = 'rgba(34,30,50,0.85)'; A.inkBlob(p, x0, 10, 70 + rr() * 30, k, 0.5); p.fill();
          p.lineWidth = 1.4; for (let j = 0; j < 40; j++) { const x = x0 - 80 + rr() * 160; p.beginPath(); p.moveTo(x, 10); p.quadraticCurveTo(x + 6, 60, x + (rr() - 0.5) * 20, 90 + rr() * 50); p.stroke(); }
        }
      });
      q.filter = 'blur(2.5px)'; q.globalAlpha = 0.85; q.drawImage(wil, 0, -10, W, 140); q.globalAlpha = 1; q.filter = 'none';
      // 栏杆：望柱与横栏（俯看，靠里的一侧）
      q.fillStyle = '#4a3e58'; q.fillRect(0, top - 34, W, 7); q.fillRect(0, top - 16, W, 5);
      for (let x = 20; x < W; x += 96) { q.fillStyle = '#4e4260'; q.fillRect(x - 5, top - 46, 10, 46); q.fillStyle = 'rgba(200,190,230,0.3)'; q.fillRect(x - 5, top - 46, 2, 46); q.beginPath(); q.arc(x, top - 48, 6, 0, TAU); q.fillStyle = '#5a4c6c'; q.fill(); }
      q.fillStyle = 'rgba(200,190,230,0.25)'; q.fillRect(0, top - 34, W, 1.5);
      // 台面
      q.fillStyle = '#3a3044'; q.fillRect(-40, top, W + 80, H - top);
      q.fillStyle = '#5a4a5c'; q.fillRect(-40, top - 4, W + 80, 8); q.fillStyle = 'rgba(200,190,230,0.35)'; q.fillRect(-40, top - 4, W + 80, 2);
      const xs = [];
      for (let x = -900; x < W + 900; x += 62 + r() * 18) xs.push(x);
      const at = (xb, y) => xb + (V22.vpx - xb) * ((H - y) / (H - V22.vpy));
      for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i], b = xs[i + 1];
        let y0 = H + 4;
        while (y0 > top) {
          const len = 120 + r() * 220, y1 = Math.max(top, y0 - len);
          const p = [[at(a, y0) + 1.5, y0], [at(b, y0) - 1.5, y0], [at(b, y1) - 1, y1 + 1.5], [at(a, y1) + 1, y1 + 1.5]];
          const tn = r();
          q.beginPath(); p.forEach(([x, y], k) => (k ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath();
          q.fillStyle = K.lin(q, p[0][0], 0, p[1][0], 0, [[0, mix('#4a3e52', '#5a4a52', tn)], [0.5, mix('#54465a', '#64525c', tn)], [1, mix('#3e3448', '#4a3c46', tn)]]);
          q.fill();
          q.save(); q.clip();
          q.strokeStyle = 'rgba(30,24,36,0.32)'; q.lineWidth = 1;
          for (let k = 0; k < 5; k++) {
            const u = 0.15 + r() * 0.7;
            q.beginPath(); q.moveTo(lerp(p[0][0], p[1][0], u), y0); q.bezierCurveTo(lerp(p[0][0], p[1][0], u + (r() - 0.5) * 0.2), lerp(y0, y1, 0.33), lerp(p[3][0], p[2][0], u + (r() - 0.5) * 0.2), lerp(y0, y1, 0.66), lerp(p[3][0], p[2][0], u), y1); q.stroke();
          }
          if (r() < 0.3) { const u = 0.3 + r() * 0.4, yy = lerp(y0, y1, r()), xx = lerp(at(a, yy), at(b, yy), u); q.strokeStyle = 'rgba(30,24,36,0.5)'; q.beginPath(); q.ellipse(xx, yy, 5, 9, 0, 0, TAU); q.stroke(); }
          // 湿亮：映着暮紫天光的长条
          q.fillStyle = 'rgba(176,164,227,' + (0.05 + r() * 0.09).toFixed(3) + ')';
          const u = 0.3 + r() * 0.4; q.beginPath(); q.moveTo(lerp(p[0][0], p[1][0], u - 0.12), y0); q.lineTo(lerp(p[0][0], p[1][0], u + 0.12), y0); q.lineTo(lerp(p[3][0], p[2][0], u + 0.1), y1); q.lineTo(lerp(p[3][0], p[2][0], u - 0.1), y1); q.closePath(); q.fill();
          q.restore();
          q.fillStyle = 'rgba(20,16,24,0.65)';
          for (const yy of [y0 - 10, y1 + 10]) for (const u2 of [0.25, 0.75]) { q.beginPath(); q.arc(lerp(at(a, yy), at(b, yy), u2), yy, 2, 0, TAU); q.fill(); }
          // 横缝：受光的一线
          q.strokeStyle = 'rgba(214,204,240,0.22)'; q.lineWidth = 1; q.beginPath(); q.moveTo(p[3][0], y1 + 2.5); q.lineTo(p[2][0], y1 + 2.5); q.stroke();
          y0 = y1 - 3;
        }
        q.strokeStyle = 'rgba(14,12,20,0.85)'; q.lineWidth = 2.2;
        q.beginPath(); q.moveTo(a, H); q.lineTo(at(a, top), top); q.stroke();
        // 板沿朝左上光的一线湿亮
        q.strokeStyle = 'rgba(214,204,240,0.28)'; q.lineWidth = 1;
        q.beginPath(); q.moveTo(a + 2.5, H); q.lineTo(at(a, top) + 1.5, top); q.stroke();
      }
      q.fillStyle = K.lin(q, 0, top, 0, H, [[0, 'rgba(20,16,30,0.45)'], [0.5, 'rgba(20,16,30,0.1)'], [1, 'rgba(20,16,30,0)']]); q.fillRect(0, top, W, H - top);
      // 画外左上有一盏灯：湿台板上拖出一道长长的反光
      q.save(); q.globalCompositeOperation = 'screen';
      for (const [w, a] of [[160, 0.08], [70, 0.12], [24, 0.14]]) {
        q.fillStyle = K.lin(q, 0, 110, 0, H, [[0, rgba('#f2dcc8', a)], [0.6, rgba('#e8d0d8', a * 0.6)], [1, rgba('#e8d0d8', 0)]]);
        q.beginPath(); q.moveTo(250 - w * 0.3, 110); q.lineTo(250 + w * 0.3, 110); q.lineTo(470 + w, H); q.lineTo(470 - w, H); q.closePath(); q.fill();
      }
      q.restore();
      // 倒地的鼓：浅色鼓皮，一圈鼓钉
      q.save(); q.translate(560, 196); q.rotate(-0.35);
      q.fillStyle = K.lin(q, 0, -30, 0, 30, [[0, '#5a4048'], [0.5, '#4a3440'], [1, '#2e2230']]); q.fillRect(-44, -30, 84, 60);
      q.strokeStyle = 'rgba(20,14,18,0.6)'; q.lineWidth = 2; q.beginPath(); q.moveTo(-44, -20); q.lineTo(40, -20); q.moveTo(-44, 20); q.lineTo(40, 20); q.stroke();
      q.fillStyle = '#c8bca8'; q.beginPath(); q.ellipse(40, 0, 13, 30, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(80,60,50,0.6)'; q.lineWidth = 1.2; q.beginPath(); q.ellipse(40, 0, 10, 24, 0, 0, TAU); q.stroke();
      q.fillStyle = '#d8c890'; for (let k = 0; k < 12; k++) { const a2 = (k / 12) * TAU; q.beginPath(); q.arc(40 + Math.cos(a2) * 12, Math.sin(a2) * 28, 1.6, 0, TAU); q.fill(); }
      q.fillStyle = '#3a2c34'; q.beginPath(); q.ellipse(-44, 0, 12, 30, 0, 0, TAU); q.fill();
      q.restore();
      q.strokeStyle = '#2a2026'; q.lineWidth = 4; q.lineCap = 'round';
      q.beginPath(); q.moveTo(680, 150); q.lineTo(800, 214); q.moveTo(716, 138); q.lineTo(760, 236); q.stroke();
      // 当年的横幅：一幅塌软起皱的旧布摊在台板上，一头泡进水洼，下摆撕成条；褪成灰褐，金字只剩“招亲”
      q.save(); q.translate(400, 440); q.rotate(-0.12);
      const top0 = (x) => -30 + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.11 + 1) * 3, bot0 = (x) => 30 + Math.sin(x * 0.05 + 2) * 8;
      const ban = () => {
        q.beginPath(); q.moveTo(-190, top0(-190));
        for (let x = -190; x <= 170; x += 10) q.lineTo(x, top0(x));
        for (let x = 170; x >= -190; x -= 10) { const torn = x > 60 ? (Math.floor(x / 14) % 2 ? 18 + (x - 60) * 0.12 : 2) : 0; q.lineTo(x, bot0(x) + torn); }
        q.closePath();
      };
      ban(); q.fillStyle = K.lin(q, -190, 0, 170, 0, [[0, '#4e4248'], [0.4, '#625458'], [1, '#54484c']]); q.fill();
      q.save(); ban(); q.clip();
      // 褶：一道道明暗相间的鼓起与凹陷
      for (let x = -186; x < 170; x += 22 + r() * 10) {
        q.fillStyle = 'rgba(20,14,22,0.32)'; q.beginPath(); q.moveTo(x, -50); q.bezierCurveTo(x + 10, -10, x - 8, 14, x + 6, 60); q.lineTo(x + 12, 60); q.bezierCurveTo(x - 2, 14, x + 16, -10, x + 8, -50); q.closePath(); q.fill();
        q.fillStyle = 'rgba(210,198,224,0.13)'; q.beginPath(); q.moveTo(x + 10, -50); q.bezierCurveTo(x + 20, -10, x + 2, 14, x + 16, 60); q.lineTo(x + 19, 60); q.bezierCurveTo(x + 5, 14, x + 23, -10, x + 13, -50); q.closePath(); q.fill();
      }
      q.strokeStyle = 'rgba(150,130,96,0.4)'; q.lineWidth = 1.4; q.beginPath(); for (let x = -176; x <= 150; x += 10) q.lineTo(x, top0(x) + 7); q.stroke();
      q.fillStyle = 'rgba(176,154,110,0.48)'; q.font = '30px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText('招', -10, 2); q.fillText('亲', 50, -2);
      q.fillStyle = 'rgba(120,100,80,0.22)'; q.fillText('武', -70, 4);
      // 泡水的那头更深
      q.fillStyle = K.lin(q, 60, 0, 170, 0, [[0, 'rgba(24,18,34,0)'], [1, 'rgba(24,18,34,0.5)']]); q.fillRect(60, -60, 120, 140);
      q.restore();
      ban(); q.strokeStyle = 'rgba(30,22,28,0.5)'; q.lineWidth = 1.2; q.stroke();
      q.restore();
      // 左上来的冷光：台面左上亮、右下沉
      q.fillStyle = K.rad(q, 260, 160, 40, 900, [[0, 'rgba(176,164,227,0.16)'], [0.6, 'rgba(176,164,227,0.04)'], [1, 'rgba(14,10,24,0.25)']]); q.fillRect(0, 110, W, H - 110);
      for (const p of V22P) { q.fillStyle = 'rgba(20,16,30,0.18)'; v22PudPath(q, p, 1.18); q.fill(); }
    });
  }
  // 水洼（缓存，按形状裁好）：暮紫的天在水里，一道亮的天光斜过，主水洼里有柱子的倒影
  function v22Puds() {
    return K.cache('g08|v22puds', W, H, 1, (q) => {
      for (const p of V22P) {
        const [cx, cy, rx, ry] = p;
        q.save(); v22PudPath(q, p, 0.98); q.clip();
        q.fillStyle = K.lin(q, cx - rx, cy - ry, cx + rx * 0.5, cy + ry, [[0, '#8a7cbc'], [0.5, '#5e4e88'], [1, '#342a50']]); q.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
        // 天光一道：浅紫到白
        q.save(); q.translate(cx - rx * 0.2, cy); q.rotate(-0.25);
        q.fillStyle = K.lin(q, 0, -ry * 0.5, 0, ry * 0.5, [[0, 'rgba(176,164,227,0)'], [0.45, 'rgba(176,164,227,0.75)'], [0.55, 'rgba(255,255,255,0.85)'], [0.65, 'rgba(176,164,227,0.6)'], [1, 'rgba(176,164,227,0)']]);
        q.fillRect(-rx * 1.2, -ry * 0.5, rx * 2.4, ry);
        q.restore();
        if (p[4] === 1) {
          // 柱子的倒影（向镜头这边倒下去）与柱础
          q.fillStyle = 'rgba(28,20,40,0.7)';
          const bx = V22.pb[0], by = V22.pb[1] + 6, ln = -v22Lean(bx, by);
          q.beginPath(); q.moveTo(bx - 34, by); q.lineTo(bx + 34, by); q.lineTo(bx + 30 + 140 * Math.tan(ln) + 10, by + 140); q.lineTo(bx - 30 + 140 * Math.tan(ln) - 10, by + 140); q.closePath(); q.fill();
        }
        q.restore();
        q.save(); q.filter = 'blur(1.5px)'; q.strokeStyle = 'rgba(220,210,245,0.35)'; q.lineWidth = 1.2; v22PudPath(q, p, 0.95); q.stroke(); q.filter = 'none'; q.restore();
      }
    });
  }
  // 柱（缓存）：风化的旧木柱，漆皮几乎剥尽；柱脚一块石柱础
  function v22Pillar() {
    return K.cache('g08|v22pillar', 220, 760, 1, (q) => {
      q.translate(-V22.pb[0] + 110, 40);
      const y0 = V22.pb[1] - 6, y1 = -40;
      const L = (y) => v22PX(y) - v22PW(y) / 2, R = (y) => v22PX(y) + v22PW(y) / 2;
      q.beginPath(); q.moveTo(L(y0), y0); q.lineTo(L(y1), y1); q.lineTo(R(y1), y1); q.lineTo(R(y0), y0); q.closePath();
      q.fillStyle = K.lin(q, V22.pb[0] - 36, 0, V22.pb[0] + 50, 0, [[0, '#3a3044'], [0.25, '#76667a'], [0.5, '#5a4a5c'], [1, '#262030']]); q.fill();
      q.strokeStyle = 'rgba(200,190,230,0.4)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(L(y0) + 4, y0); q.lineTo(L(y1) + 4, y1); q.stroke();
      q.strokeStyle = 'rgba(20,14,24,0.4)'; q.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const u = 0.2 + k * 0.1; q.beginPath(); q.moveTo(lerp(L(y0), R(y0), u), y0); q.lineTo(lerp(L(y1), R(y1), u + (h2(k, 51) - 0.5) * 0.05), y1); q.stroke(); }
      for (let k = 0; k < 8; k++) { const y = lerp(y0 - 30, y1 + 60, h2(k, 41)), x = v22PX(y) + (h2(k, 42) - 0.5) * v22PW(y) * 0.6; q.fillStyle = 'rgba(86,52,58,0.35)'; q.beginPath(); q.ellipse(x, y, 3 + 5 * h2(k, 43), 12 + 16 * h2(k, 44), 0.1, 0, TAU); q.fill(); }
      // 石柱础：鼓形，覆莲一圈
      const bx = V22.pb[0], by = V22.pb[1];
      q.fillStyle = K.lin(q, bx - 50, 0, bx + 50, 0, [[0, '#4a4452'], [0.35, '#8a8494'], [1, '#3a3442']]);
      q.beginPath(); q.ellipse(bx, by + 4, 50, 14, 0, 0, PI); q.lineTo(bx - 50, by - 12); q.ellipse(bx, by - 12, 50, 14, 0, PI, TAU); q.closePath(); q.fill();
      q.fillStyle = '#7a7486'; q.beginPath(); q.ellipse(bx, by - 12, 50, 14, 0, 0, TAU); q.fill();
      q.strokeStyle = 'rgba(30,24,36,0.5)'; q.lineWidth = 1; q.stroke();
      for (let k = 0; k < 8; k++) { const a = PI * (0.1 + k * 0.1); q.beginPath(); q.arc(bx + Math.cos(a) * 44, by - 8 + Math.sin(a) * 10, 6, PI, TAU); q.stroke(); }
    });
  }
  // 一条绸带：沿点列，宽度 w(u)，带一道光泽
  function v22Band(g, pts, wf, col, sheen) {
    const n = pts.length - 1, N = [];
    for (let i = 0; i <= n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; N.push([-ty / l, tx / l]); }
    g.beginPath();
    for (let i = 0; i <= n; i++) { const w = wf(i / n) / 2; i ? g.lineTo(pts[i][0] + N[i][0] * w, pts[i][1] + N[i][1] * w) : g.moveTo(pts[i][0] + N[i][0] * w, pts[i][1] + N[i][1] * w); }
    for (let i = n; i >= 0; i--) { const w = wf(i / n) / 2; g.lineTo(pts[i][0] - N[i][0] * w, pts[i][1] - N[i][1] * w); }
    g.closePath(); g.fillStyle = col; g.fill();
    g.strokeStyle = 'rgba(40,6,10,0.45)'; g.lineWidth = 1; g.stroke();
    if (sheen) { g.strokeStyle = sheen; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i <= n; i++) { const w = wf(i / n) * 0.18; i ? g.lineTo(pts[i][0] + N[i][0] * w, pts[i][1] + N[i][1] * w) : g.moveTo(pts[i][0] + N[i][0] * w, pts[i][1] + N[i][1] * w); } g.stroke(); }
  }
  // 飘尾：从 (x, y) 出发，ang 起始方向；droop 0 被风扯直 → 1 垂下
  function v22Tail(x, y, len, ang, droop, t, ph) {
    const n = 14, pts = [];
    let px = x, py = y;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push([px, py]);
      const a = lerp(ang, PI / 2, clamp(droop * (0.6 + 0.6 * u))) + Math.sin(t * (4 - 2.5 * droop) - u * 5 + ph) * (0.32 - 0.2 * droop) * u;
      px += (Math.cos(a) * len) / n; py += (Math.sin(a) * len) / n;
    }
    return pts;
  }

  XYT.registerShot('vb22_stage', {
    name: '空台系绸', zone: 'left', night: true, text: '#eef0f8', shadow: 'rgba(22,24,35,0.88)', accent: '#c84a54', bloom: 0.36,
    draw(g, c) {
      const lt = c.lt, t = c.t;
      const ct = chars(c, V22T), tPick = ct[2], tStand = ct[3], tTie = ct[4], tKnot = ct[5];
      g.drawImage(v22Floor(), 0, 0, W, H);
      g.drawImage(v22Puds(), 0, 0, W, H);
      // 雨点涟漪
      const bi0 = shotBeats(c).findIndex((b) => b.lt > -0.05), bk = Math.max(0, c.b.i - (c.grid && c.grid.pos ? Math.floor(c.grid.pos(c.t - c.lt)) : 0));
      const dens = clamp(0.45 + 0.14 * bk, 0.4, 1.1);
      void bi0;
      g.lineWidth = 1; g.strokeStyle = 'rgba(230,220,246,0.45)';
      g.beginPath();
      for (let k = 0; k < V22P.length; k++) {
        const [cx, cy, rx, ry] = V22P[k];
        const rate = 7 * dens, i1 = Math.floor(t * rate);
        for (let i = i1; i > i1 - rate * 0.8; i--) {
          const t0 = (i + h2(i, k + 30)) / rate, age = t - t0;
          if (age < 0 || age > 0.8) continue;
          const x = cx + (h2(i, k + 31) - 0.5) * rx * 1.2, y = cy + (h2(i, k + 32) - 0.5) * ry * 1.0, R = 3 + age * 26;
          g.moveTo(x + R, y); g.ellipse(x, y, R, R * 0.4, 0, 0, TAU);
        }
      }
      g.stroke();
      // —— 人物：恨也（跪在水边）→ 放（揭起湿绸）→ 弃（站起，拧水）→ 承诺（系在柱上） ——
      const silkC = '#9d2933', silkD = '#6a1a22', silkH = 'rgba(255,190,190,0.35)';
      const stand = lt >= tStand;
      const o = stand
        ? { stage: 'old', pose: 'pray', facing: 1, lean: 0.04, head: 0.18 + 0.12 * smooth(seg(lt, tKnot - 0.1, tKnot + 0.5)), wind: 0.45, windDir: -1, prop: 'none', rim: '#c8b8f0', light: [200, -200] }
        : { stage: 'old', pose: 'kneel', cradle: true, facing: 1, lean: 0.42 - 0.12 * smooth(seg(lt, tPick, tStand)), head: 0.25, wind: 0.4, windDir: -1, prop: 'none', rim: '#c8b8f0', light: [200, -200] };
      const P = F.points('xiaoyao', V22.fx, V22.fy, V22.fs, t, o);
      const hN = v22Tx(P.handN), hF = v22Tx(P.handF);
      // 柱子（在人物身后一点）
      g.drawImage(v22Pillar(), V22.pb[0] - 110, -40, 220, 760);
      // 泡在水里的一方红绸：60–90 像素宽，三四道褶，一道水光；“放”字起被揭起来、越来越小
      const sx = 948, sy = 624;
      const peel = smooth(seg(lt, tPick, tStand + 0.05));
      if (peel < 0.98) {
        const k = 1 - peel * 0.92;
        g.save(); g.translate(sx, sy); g.scale(k, k * 0.42);
        const wob = Math.sin(t * 2) * 1.5;
        const cloth = () => { g.beginPath(); g.moveTo(-80, -10); g.bezierCurveTo(-60, -50 + wob, -10, -40, 20, -46); g.bezierCurveTo(60, -52, 86, -24, 82, 0); g.bezierCurveTo(78, 30 - wob, 30, 44, -10, 40); g.bezierCurveTo(-50, 44, -86, 22, -80, -10); g.closePath(); };
        cloth(); g.fillStyle = silkD; g.fill();
        g.save(); cloth(); g.clip();
        for (let j = 0; j < 4; j++) { const x = -60 + j * 38; g.fillStyle = rgba(silkC, 0.9); g.beginPath(); g.moveTo(x - 10, -50); g.bezierCurveTo(x + 6, -20, x - 8, 10, x + 4, 50); g.lineTo(x + 18, 50); g.bezierCurveTo(x + 6, 10, x + 20, -20, x + 6, -50); g.closePath(); g.fill(); }
        g.strokeStyle = silkH; g.lineWidth = 5; g.beginPath(); g.moveTo(-60, -20); g.bezierCurveTo(-20, -34, 20, -10, 64, -24); g.stroke();
        // 半沉：下半截盖一层水色
        g.fillStyle = 'rgba(70,56,110,0.55)'; g.fillRect(-90, 6 + wob, 180, 60);
        g.restore();
        g.restore();
        // 绸的一角搭在他手里（跪着时手伸进水里）
        if (!stand) {
          const hx = (hN[0] + hF[0]) / 2, hy = (hN[1] + hF[1]) / 2, ex = sx - 30 * k, ey = sy - 6;
          const lift = peel;
          const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([lerp(hx, ex, u) + Math.sin(u * PI) * 6, lerp(hy, ey, u) + Math.sin(u * PI) * (10 - 30 * lift)]); }
          v22Band(g, pts, (u) => lerp(20, 30 + 30 * (1 - lift), u), silkC, silkH);
          // 揭起时水从绸上流下
          if (lift > 0) { g.fillStyle = 'rgba(236,230,252,0.85)'; for (let j = 0; j < 8; j++) { const u = ((t * 1.8 + j / 8) % 1), [px, py] = pts[3 + (j % 6)]; g.beginPath(); g.ellipse(px + (h2(j, 7) - 0.5) * 8, lerp(py, sy, u), 1.6, 3, 0, 0, TAU); g.fill(); } }
        }
      }
      // 人物：俯拍压扁一点，并顺着当地竖线微斜（与柱子一致）；换姿势在“弃”字上一下换
      oval(g, V22.fx + 14, V22.fy + 8, 76, 16, '#141020', 0.38, 'source-over');
      g.save(); g.translate(V22.fx, V22.fy); g.rotate(v22FigLean); g.scale(1, V22.sq); g.translate(-V22.fx, -V22.fy);
      F.draw(g, 'xiaoyao', V22.fx, V22.fy, V22.fs, t, o);
      g.restore();
      // 系绸的位置：站起后双手所在的高度，柱子左沿
      const ty = stand ? (hN[1] + hF[1]) / 2 : 0;
      if (stand && lt < tTie) {
        // 拧水：两拳之间一段拧成绳的绸（20–30 像素宽，斜纹），两拳下各垂一截，拧出一串水珠
        // 绸的握点从跪着时的手平滑移到站起后的手（0.15 秒），不跟着姿势跳
        const k0 = smooth(seg(lt, tStand, tStand + 0.15));
        let K0 = [[hF[0], hF[1]], [hN[0], hN[1]]];
        if (k0 < 1) { const Pk = F.points('xiaoyao', V22.fx, V22.fy, V22.fs, t, { stage: 'old', pose: 'kneel', cradle: true, facing: 1, lean: 0.3, head: 0.25 }); K0 = [v22Tx(Pk.handF), v22Tx(Pk.handN)]; }
        const ax = lerp(K0[0][0], hF[0], k0), ay = lerp(K0[0][1], hF[1], k0), bx = lerp(K0[1][0], hN[0] + 8, k0), by = lerp(K0[1][1], hN[1] + 10, k0);
        const tw = seg(lt, tStand, tTie);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        // 两截垂尾
        for (const [x0, y0, ph, L0] of [[ax, ay, 0, 70], [bx, by, 1.6, 56]]) {
          const pts = v22Tail(x0, y0, L0, PI / 2 + 0.2, 1, t, ph);
          v22Band(g, pts, (u) => lerp(18, 10, u), silkC, silkH);
        }
        const wr = lerp(26, 14, tw);
        g.save(); g.translate(mx, my); g.rotate(Math.atan2(by - ay, bx - ax));
        const L2 = Math.max(18, Math.hypot(bx - ax, by - ay) + 14);
        g.fillStyle = silkC; g.beginPath(); g.ellipse(0, 0, L2 / 2 + 6, wr / 2, 0, 0, TAU); g.fill();
        g.strokeStyle = rgba(silkD, 0.95); g.lineWidth = 2;
        for (let j = -3; j <= 3; j++) { const x = j * 5 + Math.sin(t * 9) * 1.5 * tw; g.beginPath(); g.moveTo(x - 4, -wr / 2 + 1); g.lineTo(x + 4, wr / 2 - 1); g.stroke(); }
        g.restore();
        // 水珠：一串从拧处落下，在台板上溅开
        const fyy = V22.fy + 4;
        for (let j = 0; j < 12; j++) {
          const u = (t * (1.7 + 0.8 * tw) + j / 12) % 1, y = lerp(my + 6, fyy, u * u), x = mx + Math.sin(j * 2.1) * 3;
          g.fillStyle = rgba('#f2eefc', 0.95); g.beginPath(); g.ellipse(x, y, 2.2, 3.4 + u * 4, 0, 0, TAU); g.fill();
          dot(g, x, y, 7, '#e8e0ff', 0.3);
          if (u > 0.88) { g.strokeStyle = rgba('#e6e0f6', 0.6); g.lineWidth = 1; g.beginPath(); g.ellipse(x, fyy, 6 + (u - 0.88) * 120, 2 + (u - 0.88) * 30, 0, 0, TAU); g.stroke(); }
        }
      }
      if (lt >= tTie) {
        // 绕柱：两道绸带围着柱身渐次绕上，结在柱子左沿、两手之间
        const wrap = easeOut(seg(lt, tTie, tTie + 0.4)), px = v22PX(ty), pw = v22PW(ty) / 2 + 3;
        g.lineCap = 'round';
        for (const [dy, a] of [[-7, 1], [8, 0.9]]) {
          g.strokeStyle = rgba(silkC, a); g.lineWidth = 12;
          g.beginPath(); g.ellipse(px, ty + dy, pw, 8, 0, PI * 0.02 + PI * (1 - wrap), PI * 0.98); g.stroke();
          g.strokeStyle = silkH; g.lineWidth = 2.4;
          g.beginPath(); g.ellipse(px, ty + dy - 3, pw, 8, 0, PI * 0.1 + PI * 0.8 * (1 - wrap), PI * 0.9); g.stroke();
        }
        const kx = px - pw + 6, ky = ty + 2;
        // 承字：一阵风把绸尾扯直（向左、低于头）；诺字系好后垂下，在风里轻摆
        const gust = bump(lt, tTie + 0.05, tTie + 0.3, tKnot + 0.15), droop = 1 - 0.92 * gust;
        const k2 = smooth(seg(lt, tTie + 0.05, tTie + 0.35));
        v22Band(g, v22Tail(kx, ky, 140 * k2, PI - 0.3, droop, t, 0), (u) => lerp(15, 8, u), silkC, silkH);
        v22Band(g, v22Tail(kx, ky + 5, 112 * k2, PI - 0.12, Math.min(1, droop + 0.12), t, 1.7), (u) => lerp(13, 7, u), mix(silkC, '#c84050', 0.2), silkH);
        g.fillStyle = silkD; g.beginPath(); g.ellipse(kx, ky, 9 * wrap + 2, 7 * wrap + 2, 0.4, 0, TAU); g.fill();
        // 诺字上结一收：一点水光
        if (lt > tKnot - 0.05 && lt < tKnot + 0.4) dot(g, kx, ky, 26, '#ffd0d0', 0.35 * (1 - seg(lt, tKnot - 0.05, tKnot + 0.4)), 'lighter');
      }
      // —— 近景：破旧彩幔从画外的梁上垂下，在风里摆 ——
      for (const [x0, w, len, col, ph] of [[1100, 90, 250, '#4a3a5c', 0], [1205, 70, 310, '#5e5244', 1.3]]) {
        const n = 14, pts = [];
        for (let i = 0; i <= n; i++) { const u = i / n, sw = (Math.sin(t * 1.6 + u * 3 + ph) * 18 + Math.sin(t * 3.7 + u * 6 + ph) * 6) * u + 40 * u * u * (0.5 + 0.5 * Math.sin(t * 0.8 + ph)); pts.push([x0 + sw, -20 + u * len]); }
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x - w / 2, y) : g.moveTo(x - w / 2, y)));
        for (let k = 0; k <= 6; k++) { const [x, y] = pts[n]; g.lineTo(x - w / 2 + (k / 6) * w, y + (k % 2 ? -18 : 6) * (0.6 + 0.4 * h2(k, ph * 10))); }
        for (let i = n; i >= 0; i--) g.lineTo(pts[i][0] + w / 2, pts[i][1]);
        g.closePath();
        g.fillStyle = rgba(col, 0.9); g.fill();
        g.strokeStyle = 'rgba(200,180,230,0.18)'; g.lineWidth = 2;
        for (let k = 1; k < 4; k++) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x - w / 2 + (k / 4) * w, y) : g.moveTo(x - w / 2 + (k / 4) * w, y))); g.stroke(); }
      }
      // —— 雨：每拍加密一档，强拍上一阵急雨 ——
      V.rain(g, c, { n: Math.round(150 + 50 * Math.min(bk, 5)), angle: 0.05, speed: 1100, len: 30, color: '#d8d0f0', alpha: 0.45, beat: 0.6 });
      const sheet = c.de(0.28);
      if (sheet > 0.06) {
        // 急雨：一层长而斜的雨线，一条路径画完
        g.strokeStyle = rgba('#e4def8', 0.32 * sheet); g.lineWidth = 1.3; g.beginPath();
        for (let i = 0; i < 70; i++) { const L = 90 + 60 * h2(i, 981), y = ((h2(i, 982) * (H + 200) + t * 1500) % (H + 200)) - 150, x = h2(i, 983) * (W + 100) - 50 + y * 0.08; g.moveTo(x, y); g.lineTo(x - L * 0.08, y - L); }
        g.stroke();
      }
      // 台板上溅起的水花：落在灯光反光带里的更亮
      g.lineWidth = 1;
      for (const [hot, col] of [[0, 'rgba(220,214,244,0.5)'], [1, 'rgba(255,240,230,0.9)']]) {
        g.strokeStyle = col; g.beginPath();
        const rr = 40, j1 = Math.floor(t * rr);
        for (let j = j1; j > j1 - rr * 0.25; j--) {
          const age = t - (j / rr + h2(j, 72) / rr);
          if (age < 0 || age > 0.2) continue;
          const x = h2(j, 73) * W, y = 120 + h2(j, 74) * 600, R = (1.5 + age * 30) * (0.5 + (y - 100) / 600);
          const lx = lerp(250, 470, (y - 110) / (H - 110)), inL = Math.abs(x - lx) < 50 + (y - 110) * 0.1;
          if (inL !== !!hot) continue;
          g.moveTo(x - R, y); g.quadraticCurveTo(x, y - R * 1.1, x + R, y);
        }
        g.stroke();
      }
    },
  });
})();
