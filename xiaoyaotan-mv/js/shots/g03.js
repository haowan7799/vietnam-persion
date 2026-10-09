/* 分镜镜头 第 03 组：主歌A 后四句——喜堂耳语、潮声东去、回首旧街、枫落成忆 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot || !XYT.kit || !XYT.env || !XYT.vfx || !XYT.fig) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 小工具 ----------
  const cache = (key, w, h, sc, fn) => E.util.cached('g03:' + key, [], w, h, sc, fn);
  // 本句第 k 字在镜头内的时间；没有歌词时用分镜表里的时间
  const charAt = (c, k, fb) => { const v = c.charT ? c.charT(k) : null; return v == null ? fb : v - (c.t - c.lt); };
  const glow = (g, x, y, r, col, a) => { if (a > 0.003 && r > 0) A.glow(g, x, y, r, col, Math.min(1, a)); };
  const add = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; };
  const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  const line = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
  const env = (x, a, b) => smooth(clamp((x - a) / (b - a)));
  const pulse = (x, a, b) => (x < a || x > b ? 0 : Math.sin(PI * (x - a) / (b - a)));
  // 书法字体是否已就绪（题字烘进贴图时作缓存键的一部分；就绪后不再查询）
  let fontReady = false;
  const fk = () => {
    if (!fontReady) { try { fontReady = !document.fonts || document.fonts.check('32px "Ma Shan Zheng"', '囍茶酒客福余'); } catch (e) { fontReady = true; } }
    return fontReady ? 'f' : 'n';
  };
  // 调试用分段计时（只在 window.__g03prof 存在时生效）
  const prof = (g, name, fn) => {
    const P = window.__g03prof;
    if (!P) return fn();
    g.getImageData(0, 0, 1, 1); const t0 = performance.now(); const r = fn(); g.getImageData(0, 0, 1, 1);
    P[name] = (P[name] || 0) + performance.now() - t0; return r;
  };
  // 离屏缓冲：按名字复用，每次用前清空所需区域（输出只取这块，与之前画过什么无关）
  const SCR = new Map();
  function scr(name, x0, y0, x1, y1, k) {
    const S = (XYT.sprites && XYT.sprites.S) || 1, kk = S * k;
    const w = Math.max(1, Math.ceil((x1 - x0) * kk)), h = Math.max(1, Math.ceil((y1 - y0) * kk));
    let B = SCR.get(name);
    if (!B) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; B = { cv, q: cv.getContext('2d') }; SCR.set(name, B); }
    if (B.cv.width < w || B.cv.height < h) { B.cv.width = Math.max(B.cv.width, w); B.cv.height = Math.max(B.cv.height, h); B.q = B.cv.getContext('2d'); }
    const q = B.q;
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.imageSmoothingEnabled = true;
    q.clearRect(0, 0, w + 2, h + 2);
    q.setTransform(kk, 0, 0, kk, -x0 * kk, -y0 * kk);
    return { cv: B.cv, q, x0, y0, w, h, lw: w / kk, lh: h / kk };
  }
  const blit = (g, B, dx, dy, a) => { if (a <= 0.003) return; const ga = g.globalAlpha; g.globalAlpha = ga * a; g.drawImage(B.cv, 0, 0, B.w, B.h, B.x0 + dx, B.y0 + dy, B.lw, B.lh); g.globalAlpha = ga; };
  // 渲染器给每个镜头加的推镜（见 render.js drawScene）：用来把东西放到确定的屏幕位置（两镜交接处对位）
  const camZ = (c) => 1.02 + 0.05 * clamp(c.p) + (c.be ? (0.012 * c.be(0.18) + 0.02 * c.de(0.28)) * (0.5 + (c.inten ?? 0.6)) : 0);
  const camDx = (c) => ((c.seg && c.seg.idx % 2) ? 1 : -1) * 14 * (clamp(c.p) - 0.5);
  const fromScreen = (c, sx, sy) => { const z = camZ(c); return [W / 2 + (sx - W / 2 - camDx(c)) / z, H / 2 + (sy - H / 2) / z]; };
  // 盖头交接：上一镜被风卷到画面中心的盖头 = 下一镜浪上的盖头（屏幕位置、大小、朝向一致）
  const VEIL = { x: 640, y: 372, L: 132, th: -0.32, sq: 0.56 };

  // 人物头部局部坐标（与 figures.js 的头部一致：右为脸前，上为负）→ 世界坐标
  function headBasis(P, S, f, lk = 1) {
    const ux = (P.mouth[0] - P.head[0]) / (f * S), uy = (P.mouth[1] - P.head[1]) / S;
    return Math.atan2(uy, ux) - Math.atan2(6, 9 * lk);
  }
  function headPt(P, S, f, lx, ly, lk = 1) {
    const hang = headBasis(P, S, f, lk), c = Math.cos(hang), s = Math.sin(hang);
    return [P.head[0] + f * S * (lx * lk * c - ly * s), P.head[1] + S * (lx * lk * s + ly * c)];
  }
  // 工笔淡彩的侧脸：在人物头部局部坐标里画眉、眼、唇、胭脂（P 是 F.points 的结果）
  const FACE_M = [[-1, -12.3], [-7.6, -11.4], [-11.3, -6], [-11.5, 0.4], [-9, 6.4], [-5.6, 9.4], [-1.5, 9.8], [3.8, 11.7],
    [6.8, 10.8], [7.6, 8.6], [7.3, 7.4], [8.6, 6.2], [8.1, 5.1], [8.8, 4.1], [11.1, 1.7], [8.9, -2.3], [9.5, -4.3], [8.4, -8.6], [4.6, -11.7]];
  const CAP = [[7.4, -8.6], [4.5, -12.6], [-2, -13.6], [-8.4, -11.8], [-12, -5.6], [-12.2, 1.5], [-8.6, 7.6], [-6.2, 2], [-3.4, -2.8], [1.6, -6.2], [7.6, -6.8]];
  function headFrame(g, P, s, facing, lk) {
    const hang = headBasis(P, s, facing, lk);
    g.translate(P.head[0], P.head[1]); g.scale(facing * s, s); g.rotate(hang); g.scale(lk, 1);
  }
  // o: {skin, paint(男子的深色脸要先铺肤色), eye: 0 闭/垂 .. 1 睁, smile, blush, lips, hair, rim(受光侧的一道暖边)}
  function gongbiFace(g, P, s, facing, o = {}) {
    g.save();
    headFrame(g, P, s, facing, o.look || 1);
    if (o.paint) {
      // 先铺肤色，再把发际线以上补回头发
      g.save();
      poly(g, FACE_M); g.clip();
      g.fillStyle = o.skin || '#f3e2d4'; g.fillRect(-14, -16, 30, 32);
      if (o.shade) { g.fillStyle = K.lin(g, -12, 0, 12, 0, [[0, rgba(o.shade, 0.75)], [0.55, rgba(o.shade, 0.25)], [1, rgba(o.shade, 0)]]); g.fillRect(-14, -16, 30, 32); }
      g.fillStyle = o.hair || '#1a0c0c'; poly(g, CAP); g.fill();
      // 脸颊的冷暖：受光一侧暖
      g.fillStyle = rgba(o.warm || '#ffb08a', 0.22); g.beginPath(); g.ellipse(-4, 2, 7, 9, 0, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = rgba(o.lineCol || '#3a1a14', 0.55); g.lineWidth = 0.35; poly(g, FACE_M); g.stroke();
    }
    if (o.rim) {
      // 侧影轮廓：眉骨、鼻、唇、下巴一笔暖光
      g.strokeStyle = rgba(o.rim, o.rimA ?? 0.9); g.lineWidth = o.rimW || 0.5; g.lineCap = 'round'; g.lineJoin = 'round';
      line(g, [[8.4, -8.6], [9.5, -4.3], [8.9, -2.3], [11.1, 1.7], [8.8, 4.1], [8.1, 5.1], [8.6, 6.2], [7.3, 7.4], [7.6, 8.6], [6.8, 10.8], [3.8, 11.7]]); g.stroke();
    }
    const eye = o.eye ?? 0.6;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 眉：细长柳叶
    g.strokeStyle = rgba('#2a1a18', 0.85 * (o.featA ?? 1)); g.lineWidth = 0.55;
    g.beginPath(); g.moveTo(1.4, -5.6); g.quadraticCurveTo(4.6, -6.9 - 0.4 * (o.brow || 0), 7.6, -5.4); g.stroke();
    // 眼：上眼睑一笔，睁开时下面一点瞳仁
    g.lineWidth = 0.7; g.strokeStyle = rgba('#1c1010', 0.9 * (o.featA ?? 1));
    const ey = -2.2, open = 1.6 * eye;
    g.beginPath(); g.moveTo(3.2, ey + 0.2); g.quadraticCurveTo(5.1, ey - 0.9 - open * 0.4, 7.1, ey + 0.4 - 0.2 * eye); g.stroke();
    if (eye > 0.25) {
      g.fillStyle = rgba('#140c0c', 0.85 * clamp((eye - 0.25) / 0.4) * (o.featA ?? 1));
      g.beginPath(); g.ellipse(6.1, ey + 0.55, 0.85, 0.75 * eye + 0.2, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.7 * eye); g.beginPath(); g.arc(6.4, ey + 0.2, 0.25, 0, TAU); g.fill();
    } else {
      // 垂眸：睫毛
      g.lineWidth = 0.35;
      for (let k = 0; k < 3; k++) { const x = 4.4 + k * 1; g.beginPath(); g.moveTo(x, ey + 0.2); g.lineTo(x + 0.5, ey + 1.1); g.stroke(); }
    }
    // 胭脂
    if (o.blush) { g.fillStyle = K.rad(g, 3.6, 2.8, 0.2, 3.6, [[0, rgba('#f07080', 0.5 * o.blush)], [1, rgba('#f07080', 0)]]); g.beginPath(); g.ellipse(3.6, 2.8, 3.8, 2.6, 0, 0, TAU); g.fill(); }
    // 唇
    const sm = o.smile ?? 0.3;
    g.fillStyle = rgba(o.lips || '#d8505a', 0.85 * (o.featA ?? 1));
    g.beginPath(); g.moveTo(7.2, 5.6 - sm * 0.3); g.quadraticCurveTo(8.2, 5.2, 8.5, 5.9); g.quadraticCurveTo(7.9, 6.7, 7.0, 6.3); g.closePath(); g.fill();
    if (sm > 0.35) { g.strokeStyle = rgba('#5a1a1a', 0.4 * (sm - 0.35)); g.lineWidth = 0.25; g.beginPath(); g.moveTo(7.0, 6.0); g.quadraticCurveTo(6.2, 5.6, 5.9, 5.0); g.stroke(); }
    g.restore();
  }

  // ---------- 红盖头（两镜共用）：一方软绸网格，金边、囍字团花、四角流苏 ----------
  // 团花贴图：金线圆环 + 囍
  function roundelTex() {
    return cache('veil_roundel' + fk(), 100, 100, 1.5, (q) => {
      q.translate(50, 50);
      q.strokeStyle = 'rgba(246,206,110,0.95)'; q.lineWidth = 3; q.beginPath(); q.arc(0, 0, 40, 0, TAU); q.stroke();
      q.lineWidth = 1.4; q.beginPath(); q.arc(0, 0, 33, 0, TAU); q.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; q.fillStyle = 'rgba(246,206,110,0.9)'; q.beginPath(); q.ellipse(Math.cos(a) * 44, Math.sin(a) * 44, 4.2, 2, a, 0, TAU); q.fill(); }
      q.fillStyle = '#f6cc68'; q.font = '52px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText('囍', 0, 3);
    });
  }
  // grid(u, v) → [x, y, 明暗 -1..1, 湿 0..1]；N 格。o: {alpha, tass(流苏摆角), tassL, wet(水色), back(翻面), border}
  const VN = 6;
  function veilMesh(g, grid, o = {}) {
    const N = VN, P = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) P.push(grid(i / N, j / N));
    const at = (i, j) => P[j * (N + 1) + i];
    const bil = (u, v) => {
      const x = u * N, y = v * N, i = Math.min(N - 1, Math.floor(x)), j = Math.min(N - 1, Math.floor(y)), fx = x - i, fy = y - j;
      const a = at(i, j), b = at(i + 1, j), c2 = at(i, j + 1), d = at(i + 1, j + 1);
      return [lerp(lerp(a[0], b[0], fx), lerp(c2[0], d[0], fx), fy), lerp(lerp(a[1], b[1], fx), lerp(c2[1], d[1], fx), fy)];
    };
    const ring = (ins) => {
      const pts = [], n = 12;
      for (let k = 0; k < n; k++) pts.push(bil(lerp(ins, 1 - ins, k / n), ins));
      for (let k = 0; k < n; k++) pts.push(bil(1 - ins, lerp(ins, 1 - ins, k / n)));
      for (let k = 0; k < n; k++) pts.push(bil(lerp(1 - ins, ins, k / n), 1 - ins));
      for (let k = 0; k < n; k++) pts.push(bil(ins, lerp(1 - ins, ins, k / n)));
      return pts;
    };
    const ga = g.globalAlpha, al = o.alpha ?? 1;
    g.globalAlpha = ga * al;
    const out = ring(0);
    const base = o.back ? '#8a1216' : '#c4221e';
    poly(g, out); g.fillStyle = base; g.fill();
    // 起伏的明暗、浸湿处（深、透出水色）
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = at(i, j), b = at(i + 1, j), c2 = at(i + 1, j + 1), d = at(i, j + 1);
      const sh = (a[2] + b[2] + c2[2] + d[2]) / 4, wet = ((a[3] || 0) + (b[3] || 0) + (c2[3] || 0) + (d[3] || 0)) / 4;
      let col = null, aa = 0;
      if (sh > 0.05) { col = o.back ? '#d04a36' : '#ff7a52'; aa = 0.42 * sh; } else if (sh < -0.05) { col = '#380406'; aa = 0.5 * -sh; }
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); g.closePath();
      if (col) { g.fillStyle = rgba(col, aa); g.fill(); }
      if (wet > 0.02) { g.fillStyle = rgba(o.wet || '#20304e', 0.55 * wet); g.fill(); }
    }
    // 团花（随绸面一起变形）
    if (!o.back && o.roundel !== false) {
      const c0 = bil(0.5, 0.5), cu = bil(0.62, 0.5), cv = bil(0.5, 0.62);
      const ax = [(cu[0] - c0[0]) / 12, (cu[1] - c0[1]) / 12], ay = [(cv[0] - c0[0]) / 12, (cv[1] - c0[1]) / 12];
      g.save(); g.transform(ax[0], ax[1], ay[0], ay[1], c0[0], c0[1]);
      g.globalAlpha = ga * al * (o.roundelA ?? 0.92);
      g.drawImage(roundelTex(), -27, -27, 54, 54);
      g.restore(); g.globalAlpha = ga * al;
    }
    // 金边：外缘一道、内缘一道细线
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = o.back ? 'rgba(170,120,50,0.8)' : '#e8b850'; g.lineWidth = o.border || 2.2; poly(g, out); g.stroke();
    if (!o.back) { g.strokeStyle = 'rgba(236,190,90,0.7)'; g.lineWidth = (o.border || 2.2) * 0.45; poly(g, ring(0.09)); g.stroke(); }
    // 四角流苏
    if (o.tassL) {
      const cs = [at(0, 0), at(N, 0), at(N, N), at(0, N)];
      cs.forEach((p, k) => {
        if (o.skip === k) return;
        const a0 = (o.tass ? o.tass[k] : PI / 2), L = o.tassL * (o.tassK ? o.tassK[k] : 1);
        g.strokeStyle = 'rgba(240,196,92,0.95)'; g.lineWidth = Math.max(0.8, L * 0.05);
        g.beginPath();
        for (let s = -2; s <= 2; s++) {
          const aa = a0 + s * 0.06, ex = p[0] + Math.cos(aa) * L, ey = p[1] + Math.sin(aa) * L;
          g.moveTo(p[0] + Math.cos(a0) * L * 0.18, p[1] + Math.sin(a0) * L * 0.18); g.quadraticCurveTo(p[0] + Math.cos(a0 + 0.2) * L * 0.6, p[1] + Math.sin(a0 + 0.2) * L * 0.6, ex, ey);
        }
        g.stroke();
        g.fillStyle = '#c8281e'; g.beginPath(); g.arc(p[0] + Math.cos(a0) * L * 0.16, p[1] + Math.sin(a0) * L * 0.16, L * 0.11, 0, TAU); g.fill();
        g.fillStyle = '#f0c45c'; g.beginPath(); g.arc(p[0], p[1], L * 0.08, 0, TAU); g.fill();
      });
    }
    g.globalAlpha = ga;
    return { at, bil, out };
  }

  // ======================================================================
  // 5 喜堂耳语：成亲夜，水月宫喜堂外回廊；他想逃，灵儿从身后攥住他的袖子，踮脚附耳；“话”字上一阵风把红盖头从她指间卷走
  // ======================================================================
  // 桃树：墨色枝干撑起一簇簇花团，团与团之间露出天色
  function peachTree5(q, x0, y0, sc, seed, o) {
    const rr = A.rng(seed), tips = [];
    q.lineCap = 'round'; q.strokeStyle = o.trunk;
    const grow = (x, y, a, L, w, d) => {
      const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
      q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a + 0.28) * L * 0.5, y + Math.sin(a + 0.28) * L * 0.5, x1, y1); q.stroke();
      if (d >= 2) tips.push([x1, y1, d]);
      if (d < (o.depth || 5)) { grow(x1, y1, a - 0.32 - rr() * 0.42, L * 0.74, w * 0.64, d + 1); grow(x1, y1, a + 0.26 + rr() * 0.42, L * 0.7, w * 0.6, d + 1); }
    };
    grow(x0, y0, -PI / 2 + (o.tilt || 0) + (rr() - 0.5) * 0.25, 170 * sc, 26 * sc, 0);
    const cols = o.cols;
    for (const [x, y, d] of tips) {
      const n = d >= 4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const cx = x + (rr() - 0.5) * 30 * sc, cy = y + (rr() - 0.6) * 22 * sc, R = (9 + rr() * 13) * sc;
        q.fillStyle = rgba(o.dark, 0.32); A.inkBlob(q, cx + 3 * sc, cy + 5 * sc, R, seed * 31 + k + d * 7, 0.38); q.fill();
        q.fillStyle = rgba(cols[(k + d + (rr() < 0.5 ? 1 : 0)) % cols.length], o.alpha ?? 0.9); A.inkBlob(q, cx, cy, R, seed * 13 + k + d, 0.4); q.fill();
        q.fillStyle = rgba('#fff4f8', 0.35); A.inkBlob(q, cx - R * 0.25, cy - R * 0.3, R * 0.45, seed * 17 + k, 0.4); q.fill();
      }
    }
  }
  // 远处的白玉楼阁：歇山顶、檐角起翘、窗里一点暖灯
  function pavilion5(q, x, y, w, col, roof, win) {
    q.fillStyle = col; q.fillRect(x - w * 0.42, y, w * 0.84, w * 0.42);
    q.fillStyle = roof;
    q.beginPath(); q.moveTo(x - w * 0.62, y + 4); q.quadraticCurveTo(x - w * 0.5, y - 2, x - w * 0.36, y - w * 0.14);
    q.lineTo(x + w * 0.36, y - w * 0.14); q.quadraticCurveTo(x + w * 0.5, y - 2, x + w * 0.62, y + 4);
    q.quadraticCurveTo(x, y - 6, x - w * 0.62, y + 4); q.fill();
    q.fillRect(x - w * 0.2, y - w * 0.24, w * 0.4, w * 0.12);
    for (let j = 0; j < 4; j++) { const xx = x - w * 0.3 + j * w * 0.2; q.fillStyle = win; q.fillRect(xx - w * 0.05, y + w * 0.12, w * 0.1, w * 0.16); A.softBlob(q, xx, y + w * 0.2, w * 0.14, 0.6, '#ffc878'); }
    q.fillStyle = 'rgba(220,226,244,0.5)'; q.fillRect(x - w * 0.5, y + w * 0.42, w, 4);
  }
  // 远景：天青暮色（西边余晖，东边已入靛蓝）、远阁、雾、远树
  function va5Far(q) {
    q.fillStyle = K.lin(q, 0, 0, 0, H, [[0, '#101e46'], [0.32, '#284a82'], [0.58, '#6584b8'], [0.78, '#b8b4d2'], [1, '#d8c4d4']]);
    q.fillRect(0, 0, W, H);
    // 西（左）暖、东（右）冷
    q.fillStyle = K.lin(q, 200, 0, W, 0, [[0, 'rgba(255,190,170,0.28)'], [0.45, 'rgba(255,190,170,0)'], [0.75, 'rgba(14,24,64,0.2)'], [1, 'rgba(10,18,52,0.45)']]); q.fillRect(0, 0, W, H);
    // 几颗初起的星
    const r = A.rng(57);
    for (let i = 0; i < 18; i++) { q.fillStyle = rgba('#e8eeff', 0.35 + r() * 0.4); q.beginPath(); q.arc(700 + r() * 560, 80 + r() * 200, 0.8 + r() * 1.2, 0, TAU); q.fill(); }
    // 远阁：一座在两树之间，一座更远
    pavilion5(q, 790, 356, 130, '#8c9cc6', '#3a4670', '#ffd08a');
    pavilion5(q, 690, 410, 92, '#9aa6cc', '#4a5680', '#ffd49a');
    // 远树一排（淡、偏紫）
    for (let k = 0; k < 6; k++) peachTree5(q, 300 + k * 170 + r() * 60, 600, 0.55, 40 + k, { trunk: 'rgba(80,72,118,0.55)', dark: '#6a6a9a', cols: ['#d8bcd4', '#cdb4d2', '#e2c6d8'], alpha: 0.75, depth: 4 });
    // 树排之间的冷雾
    q.fillStyle = K.lin(q, 0, 380, 0, 560, [[0, 'rgba(200,206,232,0)'], [0.5, 'rgba(200,206,232,0.55)'], [1, 'rgba(200,206,232,0.2)']]); q.fillRect(0, 380, W, 180);
  }
  // 近一排桃树（仍在焦外）
  function va5Trees(q) {
    peachTree5(q, 260, 900, 1.0, 3, { trunk: 'rgba(40,32,62,0.9)', dark: '#4a3e6e', cols: ['#eec2d2', '#e2b0c8', '#f6d6e0'], tilt: 0.05, alpha: 0.82 });
    peachTree5(q, 900, 880, 0.92, 7, { trunk: 'rgba(42,34,64,0.88)', dark: '#4a3e6e', cols: ['#f0c6d6', '#e6b4ca', '#f8dce6'], tilt: -0.12, alpha: 0.82 });
    peachTree5(q, 1190, 980, 0.8, 11, { trunk: 'rgba(44,36,66,0.85)', dark: '#4a3e6e', cols: ['#e6bcd0', '#f2d0dc', '#dca8c0'], tilt: -0.2, depth: 4, alpha: 0.8 });
  }
  // 左后方：喜堂的格扇窗，红烛透过窗纸；窗纸上大红剪纸囍
  function va5Hall(q) {
    q.fillStyle = '#2a0808'; q.fillRect(0, 0, 230, H);
    q.fillStyle = K.rad(q, 100, 330, 10, 300, [[0, '#fff0c8'], [0.35, '#ffc27a'], [0.75, '#e2783e'], [1, '#8a2a18']]);
    q.fillRect(-10, 96, 216, 500);
    q.fillStyle = '#c0161a'; q.font = '128px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
    q.fillText('囍', 96, 262);
    q.strokeStyle = 'rgba(40,8,6,0.95)'; q.lineWidth = 6;
    for (let x = -4; x < 210; x += 44) { q.beginPath(); q.moveTo(x, 96); q.lineTo(x, 596); q.stroke(); }
    for (let y = 120; y < 600; y += 44) { q.beginPath(); q.moveTo(-10, y); q.lineTo(206, y); q.stroke(); }
    q.lineWidth = 16; q.strokeRect(-12, 90, 220, 512);
    // 窗下的一对红烛：烛身、蜡泪、铜烛台
    for (const x of [52, 150]) {
      q.fillStyle = '#5a3a1a'; q.fillRect(x - 16, 586, 32, 10); q.fillRect(x - 5, 560, 10, 30);
      q.fillStyle = K.lin(q, x - 9, 0, x + 9, 0, [[0, '#7a0c0e'], [0.4, '#d8261e'], [1, '#6a0a0c']]); q.fillRect(x - 9, 470, 18, 92);
      q.fillStyle = '#f0503a'; q.beginPath(); q.ellipse(x, 470, 9, 3, 0, 0, TAU); q.fill();
      q.fillStyle = 'rgba(255,120,90,0.9)';
      for (const [dx, L] of [[-6, 22], [3, 34], [7, 14]]) { q.beginPath(); q.moveTo(x + dx - 2, 470); q.lineTo(x + dx + 2, 470); q.lineTo(x + dx + 1.6, 470 + L); q.arc(x + dx, 470 + L, 2, 0, PI); q.closePath(); q.fill(); }
      q.fillStyle = '#d8a848'; q.fillRect(x - 13, 556, 26, 5);
    }
  }
  // 白玉栏杆：望柱、莲苞柱头、云纹栏板
  function va5Rail(q) {
    q.fillStyle = '#7e8ab0'; q.fillRect(0, 40, W, 170);
    q.fillStyle = '#b8c2dc'; q.fillRect(0, 36, W, 14);
    q.fillStyle = '#e2e8f4'; q.fillRect(0, 36, W, 4);
    q.fillStyle = '#9aa6c8'; q.fillRect(0, 116, W, 8);
    for (let x = 30; x < W; x += 180) {
      q.fillStyle = '#8c98bc'; q.fillRect(x, 8, 28, 200);
      q.fillStyle = '#d0d8ec'; q.fillRect(x, 8, 8, 200);
      q.fillStyle = '#dfe4f2'; q.beginPath(); q.ellipse(x + 14, 6, 17, 14, 0, PI, TAU); q.fill(); q.beginPath(); q.ellipse(x + 14, 6, 15, 5, 0, 0, PI); q.fill();
      for (let k = 0; k < 2; k++) {
        const cx = x + 74 + k * 62;
        q.strokeStyle = 'rgba(210,218,238,0.7)'; q.lineWidth = 3;
        q.beginPath(); q.ellipse(cx, 80, 22, 14, 0, 0, TAU); q.stroke();
        q.beginPath(); q.arc(cx - 10, 78, 6, 0, TAU); q.stroke(); q.beginPath(); q.arc(cx + 9, 82, 5, 0, TAU); q.stroke();
        q.fillStyle = 'rgba(60,70,110,0.35)'; q.fillRect(cx - 24, 132, 48, 60);
      }
    }
  }
  function va5Bg() {
    const f = fk();
    return cache('va5_bg7' + f, W, H, 1, (q) => {
      q.imageSmoothingQuality = 'high';
      const far = E.util.cached('g03:va5_far5', [], W, H, 0.22, va5Far);
      q.drawImage(far, -6, -6, W + 12, H + 12);
      const tr = E.util.cached('g03:va5_trees5', [], W, H, 0.22, va5Trees);
      q.drawImage(tr, -4, -4, W + 8, H + 8);
      // 东边（歌词那一栏）压一层靛蓝，字更清楚
      q.fillStyle = K.lin(q, 1040, 0, 1280, 0, [[0, 'rgba(14,24,62,0)'], [0.25, 'rgba(14,24,62,0.42)'], [0.85, 'rgba(14,24,62,0.42)'], [1, 'rgba(14,24,62,0.3)']]);
      q.fillRect(1040, 0, 240, 560);
      const hall = E.util.cached('g03:va5_hall3' + f, [], 230, H, 0.4, va5Hall);
      q.drawImage(hall, -20, 0, 230, H);
      // 红柱（中景，微虚）：圆柱的明暗、柱头金带、右侧一线天光
      q.fillStyle = K.lin(q, 196, 0, 258, 0, [[0, '#2a0606'], [0.25, '#8a1a14'], [0.5, '#b8301e'], [0.8, '#6a120e'], [1, '#2a0606']]);
      q.fillRect(196, 0, 62, H);
      q.fillStyle = 'rgba(216,170,80,0.7)'; q.fillRect(196, 86, 62, 8); q.fillRect(196, 100, 62, 3);
      q.fillStyle = 'rgba(150,180,240,0.22)'; q.fillRect(250, 0, 5, H);
      const rail = E.util.cached('g03:va5_rail3', [], W, 210, 0.45, va5Rail);
      q.drawImage(rail, 258, 548, W - 258, 210);
      q.fillStyle = K.lin(q, 258, 0, 700, 0, [[0, 'rgba(255,150,90,0.3)'], [1, 'rgba(255,150,90,0)']]); q.fillRect(258, 548, 440, 210);
      // 梁枋：暗木、金线彩画
      const beam = E.util.cached('g03:va5_beam3', [], W, 110, 0.35, (b) => {
        b.fillStyle = K.lin(b, 0, 0, 0, 90, [[0, '#0c0608'], [0.7, '#1e1214'], [1, '#0e0809']]); b.fillRect(0, 0, W, 90);
        b.fillStyle = 'rgba(40,90,96,0.6)'; b.fillRect(0, 26, W, 38);
        b.strokeStyle = 'rgba(216,178,90,0.6)'; b.lineWidth = 2.5;
        for (let x = 0; x < W; x += 180) { b.beginPath(); b.ellipse(x + 90, 45, 50, 14, 0, 0, TAU); b.stroke(); b.beginPath(); b.ellipse(x + 90, 45, 20, 6, 0, 0, TAU); b.stroke(); }
        b.fillStyle = 'rgba(216,178,90,0.65)'; b.fillRect(0, 24, W, 2.5); b.fillRect(0, 64, W, 2.5);
        b.fillStyle = K.lin(b, 0, 90, 0, 110, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); b.fillRect(0, 90, W, 20);
      });
      q.drawImage(beam, 0, -26, W, 110);
      q.globalCompositeOperation = 'lighter';
      q.fillStyle = K.rad(q, 100, 330, 10, 230, [[0, 'rgba(255,138,74,0.26)'], [1, 'rgba(255,138,74,0)']]); q.fillRect(0, 100, 330, 460);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 近景桃枝（前景，清楚的一版与虚的一版）
  function sprig5(q) {
    const r = A.rng(17);
    q.lineCap = 'round';
    const br = [];
    const grow = (x, y, a, L, w, d) => {
      const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
      q.strokeStyle = '#2a1a22'; q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a - 0.3) * L * 0.5, y + Math.sin(a - 0.3) * L * 0.5, x1, y1); q.stroke();
      q.strokeStyle = 'rgba(150,110,140,0.5)'; q.lineWidth = w * 0.25; q.beginPath(); q.moveTo(x, y - w * 0.3); q.quadraticCurveTo(x + Math.cos(a - 0.3) * L * 0.5, y + Math.sin(a - 0.3) * L * 0.5 - w * 0.3, x1, y1 - w * 0.3); q.stroke();
      br.push([x1, y1, d, x, y]);
      if (d < 3) { grow(x1, y1, a - 0.5 - r() * 0.3, L * 0.66, w * 0.6, d + 1); grow(x1, y1, a + 0.35 + r() * 0.3, L * 0.6, w * 0.55, d + 1); }
    };
    grow(560, -30, PI * 0.12, 200, 13, 0);
    for (const [x, y, d, px, py] of br) {
      const n = d >= 2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const u = 0.3 + r() * 0.7, fx = lerp(px, x, u) + (r() - 0.5) * 22, fy = lerp(py, y, u) + (r() - 0.5) * 18, R = 9 + r() * 8, bud = r() < 0.25;
        if (bud) { q.fillStyle = '#e8708e'; q.beginPath(); q.ellipse(fx, fy, R * 0.32, R * 0.45, r() * 3, 0, TAU); q.fill(); continue; }
        // 五瓣：外浅内深，瓣尖一点缺口
        const a0 = r() * TAU;
        for (let j = 0; j < 5; j++) {
          const a = a0 + j * TAU / 5;
          q.fillStyle = K.rad(q, fx, fy, 1, R, [[0, '#f080a0'], [0.45, '#f8bccc'], [1, '#fff0f4']]);
          q.beginPath(); q.ellipse(fx + Math.cos(a) * R * 0.55, fy + Math.sin(a) * R * 0.55, R * 0.58, R * 0.42, a, 0, TAU); q.fill();
        }
        q.strokeStyle = 'rgba(200,60,90,0.8)'; q.lineWidth = 0.7;
        for (let j = 0; j < 7; j++) { const a = a0 + j * 0.9; q.beginPath(); q.moveTo(fx, fy); q.lineTo(fx + Math.cos(a) * R * 0.38, fy + Math.sin(a) * R * 0.38); q.stroke(); }
        q.fillStyle = '#f2c050'; q.beginPath(); q.arc(fx, fy, R * 0.12, 0, TAU); q.fill();
      }
    }
  }
  const SPR5 = { x: 520, y: -50, w: 600, h: 260 };
  const sprigTex = (sharp) => sharp ? cache('va5_sprigS', SPR5.w, SPR5.h, 1, (q) => { q.translate(-SPR5.x, -SPR5.y); sprig5(q); })
    : cache('va5_sprigB3', SPR5.w + 20, SPR5.h + 16, 1, (q) => {
      // 虚的一版：低分辨率画好，再高质量放大成全尺寸（逐帧 1:1 贴，不出方块）
      const lo = cache('va5_sprigL', SPR5.w, SPR5.h, 0.22, (b) => { b.translate(-SPR5.x, -SPR5.y); sprig5(b); });
      q.imageSmoothingQuality = 'high'; q.drawImage(lo, 4, 3, SPR5.w + 12, SPR5.h + 8); q.globalAlpha = 0.5; q.drawImage(lo, 10, 8, SPR5.w + 12, SPR5.h + 8);
    });
  // 前景轻纱：从梁上垂下，在腰身处用金丝绦束起，下摆散开；风向右
  function gauze5(q, t, gust, crisp) {
    const n = 14, L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, y = 64 + u * 690, w = Math.sin(t * 1.3 + u * 3.2) * 10 * u + gust * 28 * u * u;
      const pinch = Math.exp(-Math.pow((y - 440) / 120, 2));
      L.push([lerp(880, 1000, pinch) + w - 30 * u * u * (1 - pinch), y]);
      R.push([lerp(1046, 1012, pinch) + w + 60 * u * u * (1 - pinch) + 6 * Math.sin(t * 1.7 + u * 4), y]);
    }
    q.fillStyle = rgba('#f0e6f6', crisp ? 0.34 : 0.26);
    q.beginPath(); L.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); for (let i = n; i >= 0; i--) q.lineTo(R[i][0], R[i][1]); q.closePath(); q.fill();
    // 褶：几道顺着纱垂下的亮线
    q.strokeStyle = 'rgba(255,255,255,0.4)'; q.lineWidth = crisp ? 1.2 : 3;
    for (let k = 1; k < 5; k++) { q.beginPath(); L.forEach(([x, y], i) => { const xx = lerp(x, R[i][0], k / 5) + 3 * Math.sin(t * 2 + i * 0.6 + k); i ? q.lineTo(xx, y) : q.moveTo(xx, y); }); q.stroke(); }
    // 绣边：淡紫一道，金点缀
    q.strokeStyle = crisp ? 'rgba(198,176,236,0.62)' : 'rgba(198,176,236,0.4)'; q.lineWidth = crisp ? 5 : 8;
    q.beginPath(); L.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke();
    if (crisp) {
      q.fillStyle = 'rgba(246,206,110,0.95)';
      for (let i = 1; i < n; i++) for (let k = 0; k < 2; k++) { const a = L[i], b = L[i + 1], u = k / 2; q.beginPath(); q.arc(lerp(a[0], b[0], u) + 3, lerp(a[1], b[1], u), 1.6, 0, TAU); q.fill(); }
      // 金丝绦与流苏
      const ty = 440, tx0 = lerp(880, 1000, 1) + Math.sin(t * 1.3 + 1.86) * 5, tx1 = 1018;
      q.strokeStyle = '#e2b24e'; q.lineWidth = 3; q.beginPath(); q.moveTo(tx0 - 4, ty - 6); q.quadraticCurveTo((tx0 + tx1) / 2, ty + 6, tx1 + 6, ty - 4); q.stroke();
      q.beginPath(); q.moveTo(tx0 - 4, ty + 4); q.quadraticCurveTo((tx0 + tx1) / 2, ty + 14, tx1 + 6, ty + 5); q.stroke();
      const kx = tx1 + 6, ky = ty + 2, sw = 0.12 * Math.sin(t * 2.4) + 0.25 * gust;
      q.fillStyle = '#c8281e'; q.beginPath(); q.arc(kx, ky + 6, 5, 0, TAU); q.fill();
      q.strokeStyle = '#f0c45c'; q.lineWidth = 1.2;
      for (let s = -3; s <= 3; s++) { q.beginPath(); q.moveTo(kx, ky + 10); q.quadraticCurveTo(kx + s * 1.5 + 20 * sw, ky + 30, kx + s * 2.2 + 40 * sw, ky + 52); q.stroke(); }
      q.fillStyle = '#f0c45c'; q.fillRect(kx - 4, ky + 9, 8, 4);
    }
  }
  // 她从他背后攥住袖子的手：淡紫袖口里露出纤指，扣在他袖缘上，袖子被拽出几道褶（局部单位，指向身前）
  function gripHand(q, p, s, f, t, k) {
    q.save(); q.translate(p[0], p[1]); q.scale(f * s, s); q.lineCap = 'round'; q.lineJoin = 'round';
    // 他袖上被拽出的褶：从手处向前散开的几道短弧，一暗一亮
    for (let i = 0; i < 3; i++) {
      const y0 = -2 + i * 2.2, L = 8 + 2 * (i % 2);
      q.strokeStyle = 'rgba(70,6,10,0.42)'; q.lineWidth = 0.7;
      q.beginPath(); q.moveTo(1.5, y0); q.quadraticCurveTo(5, y0 - 1.6 + i * 0.4, L, y0 - 0.4 + i * 0.9); q.stroke();
      q.strokeStyle = 'rgba(255,130,100,0.28)'; q.lineWidth = 0.5;
      q.beginPath(); q.moveTo(1.8, y0 - 0.9); q.quadraticCurveTo(5, y0 - 2.4 + i * 0.4, L - 1.5, y0 - 1.3 + i * 0.9); q.stroke();
    }
    // 袖口一角（淡紫纱，从他背后探出）
    q.fillStyle = 'rgba(222,210,244,0.96)'; q.strokeStyle = 'rgba(110,90,130,0.6)'; q.lineWidth = 0.4;
    q.beginPath(); q.moveTo(-6, -6.5); q.quadraticCurveTo(-1.5, -5, -1.2, 0.5); q.quadraticCurveTo(-1.8, 5, -5.5, 6.5); q.quadraticCurveTo(-9, 1, -6, -6.5); q.fill(); q.stroke();
    // 手背与四指：指尖弯进袖缘，攥得越紧指节越弯
    q.fillStyle = '#f7e8de'; q.strokeStyle = 'rgba(140,96,86,0.75)'; q.lineWidth = 0.32;
    q.beginPath(); q.moveTo(-2, -3.6); q.quadraticCurveTo(1.4, -4.2, 2.6, -2.2); q.quadraticCurveTo(3.2, 0.8, 2.2, 3.4); q.quadraticCurveTo(-0.4, 4.2, -2.2, 3); q.closePath(); q.fill(); q.stroke();
    for (let i = 0; i < 4; i++) {
      const y0 = -2.8 + i * 1.75, bend = 1.4 + 0.9 * k;
      q.beginPath(); q.moveTo(2, y0); q.quadraticCurveTo(4.2, y0 - 0.2, 4.4 - 0.25 * i, y0 + bend);
      q.lineWidth = 1.25 - 0.1 * i; q.strokeStyle = '#f7e8de'; q.stroke();
      q.lineWidth = 0.22; q.strokeStyle = 'rgba(140,96,86,0.6)'; q.stroke();
    }
    q.restore();
  }

  XYT.registerShot('va5_whisper', {
    name: '喜堂耳语', zone: 'right', night: true, text: '#eef3f8', shadow: 'rgba(10,16,44,0.95)', accent: '#ffd27a', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tYi = charAt(c, 2, 1.17), tRen = charAt(c, 3, 1.45), tEr = charAt(c, 4, 2.07), tBian = charAt(c, 5, 2.23), tHua = charAt(c, 6, 2.73);
      const gust = 0.35 + 0.4 * Math.exp(-Math.max(0, lt) / 0.9) + 0.15 * Math.sin(t * 0.9) + 0.6 * env(lt, tHua - 0.05, tHua + 0.1) * Math.exp(-Math.max(0, lt - tHua) / 0.6);
      const tip = easeOut(clamp((lt - tYi + 0.02) / 0.42));                // 伊：踮脚
      const foc = smooth(clamp((lt - tEr + 0.02) / 0.38));                 // 耳：焦点从纱帘移到两人
      const shy = env(lt, tBian - 0.05, tBian + 0.4);                      // 边：他垂眼、脸红到耳根
      const flick = 0.85 + 0.15 * noise1(t * 7, 3);
      const hb = c.be ? c.be(0.35) : 0;

      prof(g, 'bg', () => {
        g.imageSmoothingEnabled = false; g.drawImage(va5Bg(), 0, 0, W, H); g.imageSmoothingEnabled = true;
        add(g, () => {
          glow(g, 110, 330, 120, '#ff9a5a', 0.16 * (flick - 0.8));
          for (const x of [52, 150]) { const fl = 0.8 + 0.2 * noise1(t * 9 + x, 4); glow(g, x, 458, 46 * fl, '#ffd890', 0.5 * fl); glow(g, x, 462, 9, '#fff6dc', 0.9); }
        });
        // 远处的光斑：每两拍亮起一颗
        add(g, () => {
          if (!c.b) return;
          for (let j = 0; j < 2; j++) {
            const k = Math.floor(c.b.i / 2) - j, since = t - c.grid.time(k * 2);
            const x = 640 + h2(k, 91) * 420, y = 160 + h2(k, 92) * 300;
            const e = Math.exp(-Math.max(0, since) / 1.1) * smooth(clamp(since / 0.15));
            glow(g, x, y, 30 + 18 * h2(k, 93), h2(k, 94) < 0.5 ? '#fff0f4' : '#ffe6b8', 0.5 * e);
          }
        });
      });
      prof(g, 'petB', () => V.petals(g, c, { kind: 'peach', n: 20, layer: 'back', wind: 50 + 70 * gust, fall: 40, seed: 5, area: [240, 60, W + 60, H] }));

      // ---------- 两人 ----------
      const s = 5;
      const SX = s * F.height('xiaoyao', { stage: 'wedding' }) / 180, SL = s * F.height('linger', {}) / 180;
      const XX = 455, XY = 1100;
      // 他朝左想走：先倾身欲去，“人”字后停住；“边”字低头
      const xo = { stage: 'wedding', pose: 'stand', facing: -1, wind: 0.12 + 0.1 * gust, windDir: 1, seed: 1,
        lean: lerp(0.11, 0.03, env(lt, tRen - 0.1, tRen + 0.45)), head: 0.04 + 0.12 * shy };
      const PX = F.points('xiaoyao', XX, XY, s, t, xo);
      const ear = headPt(PX, SX, -1, -4.2, 2.6);
      // 她在他身后（更远一层），朝左探身，唇贴到他后脑耳畔；踮脚前低一截
      const lo = { pose: 'flySword', facing: -1, wind: 0.6, windDir: 1, seed: 2, lean: lerp(-0.1, 0.0, tip), head: lerp(0.16, 0.06, tip) };
      const P0 = F.points('linger', 0, 0, s, t, lo);
      const lip = headPt(PX, SX, -1, -12.6, 2.2);
      const LX = lip[0] + 2 - P0.mouth[0], LY = lip[1] + lerp(34, 0, tip) - P0.mouth[1];
      const PL = F.points('linger', LX, LY, s, t, lo);
      // 盖头（攥在她远侧的手里）与被风卷走
      const tear = lt >= tHua;
      const vc = fromScreen(c, VEIL.x, VEIL.y), vz = camZ(c);
      const kf = easeInOut(clamp((lt - tHua) / 0.17));
      const veilGrid = (() => {
        const hx = PL.handF[0] + 4, hy = PL.handF[1] + 6, Lh = 112 * 1.41;
        const th = 0.86 + 0.14 * Math.sin(t * 1.4) - 0.34 * gust;          // 下垂方向：风把它吹向右下
        const D = [Math.cos(th), Math.sin(th)], Nn = [-Math.sin(th), Math.cos(th)];
        // 飞到画面中心：与下一镜浪上的盖头对位
        const Lf = VEIL.L / vz, ct = Math.cos(VEIL.th), st = Math.sin(VEIL.th);
        const f1 = [ct * Lf, st * Lf * VEIL.sq], f2 = [-st * Lf, ct * Lf * VEIL.sq];
        const hov = Math.max(0, lt - tHua - 0.17);
        const cx = vc[0] + 5 * Math.sin(hov * 3), cy = vc[1] - 3 * Math.sin(hov * 2.4);
        const h0 = [hx + D[0] * Lh * 0.45, hy + D[1] * Lh * 0.45];
        const mid = [lerp(h0[0], cx, kf) + 50 * Math.sin(PI * kf), lerp(h0[1], cy, kf) - 110 * Math.sin(PI * kf)];
        const amp0 = 26 * (0.75 + 0.45 * gust) + 10 * hb;
        return (u, v) => {
          // 沿对角线（从攥住的角往外）传的波：起伏处朝镜头翻、宽窄随之扭转，像风里的软绸
          const d = (u + v) / 2, l = (u - v) / 2, ph = 5 * d - 7 * t + 1.5 * l;
          const amp = (tear ? lerp(1, 0.35, kf) : 1) * amp0 * Math.pow(d, 1.2);
          const z = amp * Math.sin(ph);
          const de = d * (1 - 0.1 * d) - 0.045 * Math.sin(2 * ph) * d;
          const le = l * (1 - 0.38 * Math.pow(Math.sin(ph + 0.8), 2) * d);
          let x = hx + D[0] * de * Lh + Nn[0] * (le * Lh + z * 0.7), y = hy + D[1] * de * Lh + Nn[1] * (le * Lh + z * 0.7) + 8 * d * d;
          if (tear) {
            const fw = 3 * Math.sin(ph) * (1 - 0.6 * kf);
            const fly = [mid[0] + f1[0] * (u - 0.5) + f2[0] * (v - 0.5), mid[1] + f1[1] * (u - 0.5) + f2[1] * (v - 0.5) + fw];
            x = lerp(x, fly[0], kf); y = lerp(y, fly[1], kf);
          }
          return [x, y, Math.cos(ph) * clamp(amp / 14), 0];
        };
      })();
      const tassA = [0, 1, 2, 3].map((k) => PI / 2 - 0.5 * gust + 0.35 * Math.sin(t * 4.2 + k * 1.7) + hb * 0.5 * (k % 2 ? 1 : -1));
      const box = [300, 116, 910, H + 8];
      // 他（单独一层）：头顶的大冠抹掉，换成束发小金冠；脸上工笔淡彩，受左侧烛光
      const drawHim = (q) => {
        prof(q, 'f.X', () => F.draw(q, 'xiaoyao', XX, XY, s, t, xo));
        q.globalCompositeOperation = 'destination-out';
        poly(q, [[-10.4, -12.6], [-10.6, -20.5], [-5.5, -25.8], [0.8, -26.4], [7, -22.8], [6.6, -13.8], [3.6, -12.2]].map(([x, y]) => headPt(PX, SX, -1, x, y))); q.fill();
        q.globalCompositeOperation = 'source-over';
        q.save(); headFrame(q, PX, SX, -1, 1);
        q.fillStyle = '#1a0c0c'; poly(q, [[7.4, -8.6], [4.5, -12.6], [-2, -13.8], [-8.4, -12], [-10, -9], [6, -8.6]]); q.fill();
        q.beginPath(); q.ellipse(-2.6, -15, 4.8, 3.9, -0.25, 0, TAU); q.fill();
        q.fillStyle = 'rgba(140,110,120,0.35)'; q.beginPath(); q.ellipse(-3.4, -16.4, 2.6, 1, -0.3, 0, TAU); q.fill();
        q.fillStyle = K.lin(q, -5, -21, 0, -16, [[0, '#ffe7a0'], [0.5, '#e2b24e'], [1, '#a8782a']]);
        q.beginPath(); q.moveTo(-5.6, -16.4); q.quadraticCurveTo(-5.8, -20.2, -2.6, -21.2); q.quadraticCurveTo(0.6, -20.2, 0.4, -16.4); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(120,80,20,0.8)'; q.lineWidth = 0.3; q.stroke();
        q.fillStyle = '#d8242a'; q.beginPath(); q.arc(-2.6, -18.4, 0.9, 0, TAU); q.fill();
        q.strokeStyle = '#f0cc6a'; q.lineWidth = 0.75; q.beginPath(); q.moveTo(-9.6, -17); q.lineTo(4.4, -18.4); q.stroke();
        q.fillStyle = '#f6d880'; q.beginPath(); q.arc(4.6, -18.4, 0.8, 0, TAU); q.fill();
        q.restore();
        // 冠后两条红绦，顺着背垂下
        for (let k = 0; k < 2; k++) {
          const p0 = headPt(PX, SX, -1, -6.4, -15.4 + k * 1.2), pts = [];
          for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push([p0[0] + u * (26 + 10 * k) * (0.6 + 0.6 * gust) + 5 * Math.sin(t * 3 + u * 5 + k * 2) * u, p0[1] + u * (110 + 26 * k)]); }
          q.strokeStyle = k ? '#a8141a' : '#c81e22'; q.lineWidth = 4 - k; q.lineCap = 'round'; line(q, pts); q.stroke();
          q.strokeStyle = 'rgba(255,140,120,0.4)'; q.lineWidth = 1.2; line(q, pts.slice(0, 6)); q.stroke();
        }
        gongbiFace(q, PX, SX, -1, { paint: true, skin: '#f2dccb', hair: '#1a0c0c', warm: '#ffb080', eye: lerp(0.9, 0.12, shy), smile: 0.12 + 0.4 * shy, blush: 0.25 + 0.75 * shy, brow: 0.5 * shy });
        // 耳朵：害羞时红到耳根
        q.save(); headFrame(q, PX, SX, -1, 1);
        q.fillStyle = mix('#ecd2c2', '#ec7a7a', 0.1 + 0.55 * shy); q.beginPath(); q.ellipse(-4.4, 2.6, 1.8, 2.9, -0.15, 0, TAU); q.fill();
        q.strokeStyle = 'rgba(140,60,50,0.6)'; q.lineWidth = 0.35; q.beginPath(); q.ellipse(-4.2, 2.6, 1.1, 2.1, -0.15, -1.2, 2.2); q.stroke();
        q.restore();
      };
      // 两人一层：她 → 他（挖掉她头部那一块，她的脸在他后脑之前）→ 攥袖的手、盖头 → 冷暖
      const drawPair = (q, k) => {
        prof(q, 'f.L', () => F.draw(q, 'linger', LX, LY, s, t, lo));
        // 淡紫发带的两条长尾：踮脚时滞后约 200ms 才跟上，被风吹向右后
        const tipAt = (tau) => easeOut(clamp((tau - tYi + 0.02) / 0.42));
        for (let kk = 0; kk < 2; kk++) {
          const pts = [];
          for (let j = 0; j <= 9; j++) {
            const u = j / 9, tau = t - 0.21 * u, lagY = (tipAt(tau) - tip) * -34;
            const L = (170 + 40 * kk) * u;
            pts.push([PL.top[0] + 4 * s + L * (0.86 + 0.1 * gust) + 10 * Math.sin(t * 3.1 + u * 4 + kk) * u, PL.top[1] + 9 * s + L * (0.3 + 0.1 * kk) + lagY * u + 9 * Math.sin(t * 2.6 + u * 5 + kk * 1.7) * u]);
          }
          const top = [], bot = [];
          for (let j = 0; j <= 9; j++) {
            const a = pts[Math.max(0, j - 1)], b = pts[Math.min(9, j + 1)];
            let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            const w = (6 - 2.8 * (j / 9)) * (0.6 + 0.4 * Math.abs(Math.sin(t * 2 + j * 0.6 + kk)));
            top.push([pts[j][0] + nx * w, pts[j][1] + ny * w]); bot.push([pts[j][0] - nx * w, pts[j][1] - ny * w]);
          }
          q.fillStyle = kk ? 'rgba(196,176,236,0.88)' : 'rgba(214,196,242,0.92)';
          q.beginPath(); top.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); for (let i = 9; i >= 0; i--) q.lineTo(bot[i][0], bot[i][1]); q.closePath(); q.fill();
        }
        gongbiFace(q, PL, SL, -1, { eye: lerp(0.62, 0.42, tip), smile: lerp(0.3, 0.7, tip), blush: 0.45 + 0.4 * tip, lips: '#e05a68' });
        const X = scr('va5_him', box[0], box[1], box[2], box[3], k);
        prof(X.q, 'him', () => drawHim(X.q));
        q.save();
        q.beginPath(); q.rect(-200, -200, W + 400, H + 600);
        q.save(); headFrame(q, PL, SL, -1, 1); q.moveTo(12.6, -1.2); q.ellipse(0.4, -1.2, 12.2, 14, 0, 0, TAU); q.restore();
        q.clip('evenodd');
        prof(q, 'blitX', () => blit(q, X, 0, 0, 1));
        q.restore();
        // 她攥着他的袖子：手从他背后伸过来扣住袖缘
        gripHand(q, [PX.back[0] + 2.5 * SX, lerp(PX.back[1], PX.waist[1], 0.62)], SX * 0.8, -1, t, lerp(0.3, 1, env(lt, 0, tYi)));
        if (!tear) prof(q, 'f.veil', () => {
          veilMesh(q, veilGrid, { tassL: 20, tass: tassA, skip: 0, border: 2.4 });
          // 攥着一角的手：淡紫袖口从她身后探出
          const hp = [PL.handF[0] + 4, PL.handF[1] + 6], ea = Math.atan2(PL.elbowF[1] - hp[1], PL.elbowF[0] - hp[0]);
          q.save(); q.translate(hp[0], hp[1]); q.rotate(ea); q.scale(SL, SL);
          // 宽袖口：喇叭形的一截纱袖，外面再罩一层更淡的纱
          q.fillStyle = 'rgba(236,228,250,0.55)'; q.beginPath(); q.moveTo(2, -6.5); q.quadraticCurveTo(10, -10, 20, -9 + 2 * Math.sin(t * 3)); q.lineTo(21, 10); q.quadraticCurveTo(10, 9, 2, 6); q.closePath(); q.fill();
          q.fillStyle = K.lin(q, 0, -6, 0, 7, [[0, 'rgba(244,238,252,0.96)'], [1, 'rgba(206,192,236,0.96)']]); q.strokeStyle = 'rgba(110,90,130,0.6)'; q.lineWidth = 0.35;
          q.beginPath(); q.moveTo(2.5, -4.6); q.quadraticCurveTo(9, -7.5, 17, -7); q.lineTo(18, 7.5); q.quadraticCurveTo(9, 6.5, 2.5, 4.2); q.quadraticCurveTo(4.2, 0, 2.5, -4.6); q.closePath(); q.fill(); q.stroke();
          q.strokeStyle = 'rgba(150,130,190,0.5)'; q.beginPath(); q.moveTo(8, -5.8); q.quadraticCurveTo(10, 0, 8.6, 5.6); q.stroke();
          q.fillStyle = '#f7e8de'; q.strokeStyle = 'rgba(140,96,86,0.7)'; q.lineWidth = 0.3;
          q.beginPath(); q.ellipse(0.4, 0, 2.6, 2.2, 0, 0, TAU); q.fill(); q.stroke();
          q.lineWidth = 0.9; q.strokeStyle = '#f7e8de';
          for (let i = 0; i < 3; i++) { q.beginPath(); q.moveTo(-1.2, -1.3 + i * 1.2); q.quadraticCurveTo(-3, -1 + i * 1.2, -2.2, 0.7 + i * 1.1); q.stroke(); }
          q.restore();
        });
        // 冷暖：左侧烛光，右侧天青
        q.globalCompositeOperation = 'source-atop';
        q.fillStyle = K.lin(q, 320, 0, 880, 0, [[0, 'rgba(255,150,90,0.26)'], [0.4, 'rgba(255,190,170,0.04)'], [1, 'rgba(110,150,230,0.3)']]);
        q.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
        q.globalCompositeOperation = 'source-over';
      };
      // 两人面前（烛光一侧）的暖光
      add(g, () => glow(g, PX.head[0] - 60, PX.head[1] + 30, 150, '#ff9a5a', 0.2 * flick));
      prof(g, 'fig', () => {
        // 焦外：低分辨率画一遍再放大（柔）；对焦中错位叠一层；对焦后全分辨率（放大用最近邻，省时且不糊）
        const k = foc < 0.5 ? 0.45 : 0.75, B = scr('va5_pair', box[0], box[1], box[2], box[3], k);
        prof(B.q, 'pair', () => drawPair(B.q, k));
        const d = 3 * (1 - foc);
        if (d < 0.05) blit(g, B, 0, 0, 1);
        else if (foc > 0.01) { blit(g, B, -d, -d * 0.5, 1); blit(g, B, d, d * 0.5, 0.5); }
        else blit(g, B, 0, 0, 1);
      });
      prof(g, 'fx', () => {
        // 耳语处的一点柔光
        add(g, () => glow(g, ear[0] + 8, ear[1] - 4, 70, '#ffd8e0', (0.06 + 0.2 * foc) * (0.85 + 0.15 * Math.sin(t * 2))));
        // 红绸与绸花（梁下，近处）
        g.strokeStyle = '#8a1414'; g.lineWidth = 15; g.lineCap = 'round';
        const sag = 4 * Math.sin(t * 1.2);
        g.beginPath(); g.moveTo(-20, 66); g.quadraticCurveTo(110, 130 + sag, 250, 72); g.stroke();
        g.strokeStyle = 'rgba(255,150,100,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, 60); g.quadraticCurveTo(110, 123 + sag, 250, 66); g.stroke();
        g.fillStyle = '#b01e1a'; g.beginPath(); g.ellipse(252, 78, 24, 18, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,170,120,0.45)'; g.beginPath(); g.ellipse(246, 72, 10, 6, 0, 0, TAU); g.fill();
        g.strokeStyle = '#b01e1a'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(250, 94); g.quadraticCurveTo(246 + 6 * Math.sin(t * 1.6), 146, 254 + 8 * Math.sin(t * 1.3), 196); g.stroke();
      });
      // 前景：轻纱与桃枝——开头清楚，“耳”字后虚掉
      prof(g, 'gauze', () => {
        if (foc < 0.99) { g.globalAlpha = 1 - foc; gauze5(g, t, gust, true); g.globalAlpha = 1; }
        if (foc > 0.01) {
          const B = scr('va5_gz', 840, 50, 1150, H + 30, 0.2); gauze5(B.q, t, gust, false);
          blit(g, B, 2, 1, foc);
        }
      });
      prof(g, 'petF', () => {
        const sw = 5 * Math.sin(t * 1.1) + 8 * gust;
        g.save(); g.translate(SPR5.x + sw, SPR5.y + 0.3 * sw);
        if (foc < 0.99) { g.globalAlpha = 1 - foc; g.imageSmoothingEnabled = false; g.drawImage(sprigTex(true), 0, 0, SPR5.w, SPR5.h); g.imageSmoothingEnabled = true; }
        if (foc > 0.01) { g.globalAlpha = foc; g.imageSmoothingEnabled = false; g.drawImage(sprigTex(false), -10, -7, SPR5.w + 20, SPR5.h + 16); g.imageSmoothingEnabled = true; }
        g.globalAlpha = 1; g.restore();
        V.petals(g, c, { kind: 'peach', n: 8, layer: 'front', wind: 90 + 90 * gust, fall: 55, seed: 9, size: [10, 26] });
        // 几点暖色微光在廊外浮动
        add(g, () => {
          for (let i = 0; i < 9; i++) {
            const x = 640 + h2(i, 31) * 420 + 30 * Math.sin(t * 0.4 + i * 1.7) + 20 * gust * h2(i, 35);
            const y = 200 + h2(i, 32) * 320 + 18 * Math.sin(t * 0.55 + i * 2.3);
            const a = 0.4 + 0.3 * Math.sin(t * 2.1 + i * 1.9) + 0.3 * hb * (i % 3 === 0);
            glow(g, x, y, 5 + 4 * h2(i, 33), i % 2 ? '#ffe6b0' : '#ffd6e6', a);
          }
        });
      });
      // 被风卷起的盖头：飞到画面中心，下一镜从这块红里展开
      if (tear) prof(g, 'veilF', () => {
        add(g, () => glow(g, vc[0], vc[1], 120, '#ff7a50', 0.18 * env(lt, tHua, tHua + 0.2)));
        veilMesh(g, veilGrid, { tassL: 18, tass: tassA.map((a, k) => a - 0.6 + 0.3 * k), border: 2.4 });
      });
    },
  });

  // ======================================================================
  // 6 潮声东去：钱塘江口，蓝调时刻；上一镜那方红盖头落在江面，镜头升起；大潮头在“向”字上把它托起，“东”字翻面，“流”字被浪吞没
  // ======================================================================
  const HZ6 = 214, BW6 = W + 280;
  const SAND6 = [[400, 297, 280, 8, 1], [925, 262, 180, 5, 2]];   // x, y, 长, 厚, 种子（视图坐标，未平移）
  // 六和塔：十三层檐，檐角起翘，几点暖窗；左侧受余晖
  function pagoda6(q, x, y, s) {
    q.fillStyle = '#1a2240'; q.fillRect(x - 15 * s, y - 4 * s, 30 * s, 4 * s);
    let yy = y - 4 * s;
    for (let k = 0; k < 13; k++) {
      const w = (22 - k * 1.15) * s, h = (5.4 - k * 0.12) * s;
      q.fillStyle = '#1c2442'; q.fillRect(x - w / 2, yy - h, w, h);
      // 檐：两端起翘
      const ew = w / 2 + 4.2 * s, ey = yy - h + 0.6 * s;
      q.fillStyle = '#121a32';
      q.beginPath(); q.moveTo(x - ew, ey - 1.6 * s); q.quadraticCurveTo(x - ew * 0.6, ey + 0.4 * s, x, ey + 0.2 * s); q.quadraticCurveTo(x + ew * 0.6, ey + 0.4 * s, x + ew, ey - 1.6 * s);
      q.lineTo(x + ew * 0.8, ey + 1.2 * s); q.quadraticCurveTo(x, ey + 2 * s, x - ew * 0.8, ey + 1.2 * s); q.closePath(); q.fill();
      q.fillStyle = 'rgba(255,170,120,0.35)'; q.fillRect(x - w / 2, yy - h, 1.2 * s, h);
      if (k % 2 === 0) { q.fillStyle = 'rgba(255,204,130,0.95)'; q.fillRect(x - 1.2 * s, yy - h * 0.75, 2.4 * s, h * 0.45); if (k < 8) { q.fillRect(x - w * 0.36, yy - h * 0.7, 1.6 * s, h * 0.4); q.fillRect(x + w * 0.36 - 1.6 * s, yy - h * 0.7, 1.6 * s, h * 0.4); } }
      yy -= h + 0.4 * s;
    }
    q.fillStyle = '#121a32'; q.fillRect(x - 0.8 * s, yy - 9 * s, 1.6 * s, 9 * s);
    q.beginPath(); q.arc(x, yy - 3 * s, 1.6 * s, 0, TAU); q.fill();
    A.softBlob(q, x, y - 40 * s, 26 * s, 0.25, '#ffcf9a');
  }
  // 天、远岸、塔、水面底色、沙洲、近岸海塘：烘成一张（比画面宽，留出横摇的余量）
  function va6Bg() {
    return cache('va6_bg5', BW6, H, 1, (q) => {
      const r = A.rng(66);
      q.fillStyle = K.lin(q, 0, 0, 0, HZ6, [[0, '#0c1838'], [0.45, '#203e6c'], [0.85, '#4e6e9e'], [1, '#86a0c4']]);
      q.fillRect(0, 0, BW6, HZ6 + 2);
      // 西边（左）余晖、东边（右）入海口一片淡淡的海光
      q.fillStyle = K.rad(q, 30, HZ6 + 6, 10, 640, [[0, 'rgba(255,178,120,0.85)'], [0.25, 'rgba(240,140,120,0.45)'], [0.65, 'rgba(160,110,150,0.12)'], [1, 'rgba(120,100,150,0)']]);
      q.fillRect(0, 0, BW6, HZ6 + 2);
      q.fillStyle = K.rad(q, BW6 - 60, HZ6, 10, 520, [[0, 'rgba(220,234,250,0.55)'], [0.4, 'rgba(180,204,236,0.2)'], [1, 'rgba(160,190,230,0)']]);
      q.fillRect(0, 0, BW6, HZ6 + 2);
      for (let i = 0; i < 30; i++) { const x = 420 + r() * (BW6 - 420), y = 8 + r() * 120; q.fillStyle = rgba('#e8eeff', 0.2 + r() * 0.5); q.beginPath(); q.arc(x, y, 0.6 + r() * 0.9, 0, TAU); q.fill(); }
      // 水：近地平线反天光，越近越深
      q.fillStyle = K.lin(q, 0, HZ6, 0, H, [[0, '#9aaecb'], [0.1, '#6c88b0'], [0.32, '#40618f'], [0.65, '#264470'], [1, '#132648']]);
      q.fillRect(0, HZ6, BW6, H - HZ6);
      q.fillStyle = K.lin(q, 700, 0, BW6, 0, [[0, 'rgba(200,220,246,0)'], [1, 'rgba(200,220,246,0.22)']]); q.fillRect(700, HZ6, BW6 - 700, 120);
      // 余晖在水里的倒映（左侧，被拉长）
      q.save(); q.translate(60, HZ6); q.scale(1, 0.3);
      q.fillStyle = K.rad(q, 0, 0, 10, 700, [[0, 'rgba(255,170,120,0.6)'], [0.35, 'rgba(230,140,130,0.24)'], [1, 'rgba(200,120,140,0)']]);
      q.fillRect(-120, 0, 1200, 1600);
      q.restore();
      // 远岸：远一层淡山、近一层暗岸，向东（右）低下去、隐进海雾
      q.fillStyle = '#3a4668';
      q.beginPath(); q.moveTo(-10, HZ6 + 2);
      for (let x = -10; x <= 760; x += 16) { const u = x / 760; q.lineTo(x, HZ6 - (1 - u) * (34 + 18 * noise1(x * 0.008, 5)) - 2); }
      q.lineTo(800, HZ6 + 2); q.closePath(); q.fill();
      q.fillStyle = '#232e4c';
      q.beginPath(); q.moveTo(-10, HZ6 + 3);
      for (let x = -10; x <= 980; x += 14) { const u = x / 980; q.lineTo(x, HZ6 - Math.pow(1 - u, 1.4) * (20 + 12 * noise1(x * 0.014, 4)) - 1); }
      q.lineTo(1020, HZ6 + 3); q.closePath(); q.fill();
      pagoda6(q, 238, HZ6 - 18, 1.05);
      for (let i = 0; i < 22; i++) A.softBlob(q, 30 + r() * 900, HZ6 - 3 - r() * 7 * (1 - i / 22), 2.5 + r() * 2, 0.95, '#ffcf8a');
      // 远岸的倒影与灯影
      q.fillStyle = 'rgba(28,38,64,0.4)';
      q.beginPath(); q.moveTo(-10, HZ6 + 2); for (let x = -10; x <= 980; x += 20) { const u = x / 980; q.lineTo(x, HZ6 + 2 + Math.pow(1 - u, 1.4) * 12); } q.lineTo(1020, HZ6 + 2); q.fill();
      for (let i = 0; i < 16; i++) { const x = 40 + r() * 860; q.fillStyle = 'rgba(255,200,130,0.35)'; q.fillRect(x, HZ6 + 4, 1.4, 6 + r() * 8); }
      // 入海口的海雾
      q.save(); q.translate(BW6 - 160, HZ6 + 2); q.scale(1, 0.09);
      q.fillStyle = K.rad(q, 0, 0, 10, 620, [[0, 'rgba(214,226,244,0.75)'], [0.5, 'rgba(206,220,240,0.35)'], [1, 'rgba(206,220,240,0)']]); q.fillRect(-640, -640, 1280, 1280);
      q.restore();
      q.fillStyle = K.lin(q, 0, HZ6 - 12, 0, HZ6 + 26, [[0, 'rgba(200,212,236,0)'], [0.5, 'rgba(200,212,236,0.35)'], [1, 'rgba(200,212,236,0)']]);
      q.fillRect(0, HZ6 - 12, BW6, 38);
      // 退潮露出的沙洲：顺水拉长的一条沙脊，上沿一线天光，湿亮反光，下沿水线压暗
      for (const [x, y, w, h, sd] of SAND6) {
        const d = (y - HZ6) / (H - HZ6), top = [], bot = [];
        for (let i = 0; i <= 30; i++) {
          const u = i / 30, pr = Math.pow(Math.sin(PI * u), 0.55) * (1 - 0.35 * u), n1 = noise1(u * 7 + sd * 5, sd), n2 = noise1(u * 11 + sd * 9, sd + 3);
          top.push([x + (u - 0.5) * w, y - h * pr * (0.5 + 0.8 * n1)]); bot.push([x + (u - 0.5) * w * (0.96 + 0.04 * n2), y + h * pr * (0.35 + 0.4 * n2)]);
        }
        E.util.streak(q, x, y + h * 0.5, w * 0.58, h * 1.3 + 2, '#0a1230', 0.4);
        q.fillStyle = K.lin(q, 0, y - h, 0, y + h * 0.6, [[0, '#9a94a0'], [0.5, '#5c5a6c'], [1, '#2c3048']]);
        q.beginPath(); top.forEach(([a2, b2], i) => (i ? q.lineTo(a2, b2) : q.moveTo(a2, b2))); for (let i = 30; i >= 0; i--) q.lineTo(bot[i][0], bot[i][1]); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(236,232,240,0.7)'; q.lineWidth = 0.8 + d; line(q, top.slice(3, 26)); q.stroke();
        q.strokeStyle = 'rgba(255,196,150,0.4)'; q.lineWidth = 0.6; line(q, top.slice(5, 14).map(([a2, b2]) => [a2, b2 + 1.2])); q.stroke();
        q.strokeStyle = 'rgba(200,214,240,0.35)'; q.lineWidth = 0.7; line(q, bot.slice(4, 27).map(([a2, b2]) => [a2, b2 + 1.5])); q.stroke();
      }
      // 水面横向的淡彩笔触
      for (let i = 0; i < 80; i++) {
        const y = HZ6 + 6 + Math.pow(r(), 1.6) * (H - HZ6), d = (y - HZ6) / (H - HZ6);
        E.util.streak(q, r() * BW6, y, 60 + 260 * d + r() * 120, 1.5 + 8 * d, r() < 0.5 ? '#a8bee0' : '#0e1c3a', 0.08 + 0.1 * r());
      }
      // 近岸：鱼鳞石塘（左下），塘面一排排石块，塘顶受余晖
      const ex = (u) => lerp(-40, 380, u), ey = (u) => lerp(576, 760, u * u) ;
      q.fillStyle = '#2c3550';
      q.beginPath(); q.moveTo(-40, H + 20); for (let i = 0; i <= 20; i++) { const u = i / 20; q.lineTo(ex(u), ey(u) - 4); } q.lineTo(380, H + 20); q.closePath(); q.fill();
      q.fillStyle = K.lin(q, 0, 570, 0, 760, [[0, '#6e6c80'], [1, '#3a4260']]);
      q.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; q.lineTo(ex(u), ey(u) - 4); } for (let i = 20; i >= 0; i--) { const u = i / 20; q.lineTo(ex(u) + 26, ey(u) + 36); } q.closePath(); q.fill();
      q.strokeStyle = 'rgba(24,26,44,0.75)'; q.lineWidth = 1.2;
      for (let row = 0; row < 4; row++) for (let i = 0; i < 22; i++) {
        const u = (i + (row % 2) * 0.5) / 20, x0 = ex(u) + row * 6.5, y0 = ey(u) + row * 9;
        q.beginPath(); q.arc(x0 + 9, y0 + 2, 9, PI * 0.05, PI * 0.95); q.stroke();
      }
      q.strokeStyle = 'rgba(255,190,140,0.55)'; q.lineWidth = 2;
      q.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20; q.lineTo(ex(u), ey(u) - 4); } q.stroke();
      q.fillStyle = 'rgba(220,232,250,0.5)';
      for (let i = 0; i < 20; i++) { const u = (i + 0.5) / 20; q.beginPath(); q.ellipse(ex(u) + 28, ey(u) + 38, 12, 2.4, 0.3, 0, TAU); q.fill(); }
    });
  }
  // 浪线：越近越大越快；疏密不均（近地平线密），浪头成群
  const ROWS6 = [222, 229, 237, 247, 258, 271, 287, 305, 326, 351, 380, 414, 454, 500, 552, 612, 680].map((y, j) => {
    const d = (y - HZ6) / (H - HZ6), segs = [];
    const n = 4 + Math.round(5 * (1 - d) + 2 * h2(j, 9));
    for (let i = 0; i < n; i++) segs.push({ x: (i + 0.6 * h2(j, i + 10)) / n, l: 0.25 + 0.75 * h2(j, i + 20), w: 0.5 + 0.8 * h2(j, i + 30), sp: 0.8 + 0.4 * h2(j, i + 40) });
    return { y: y + 5 * (h2(j, 63) - 0.5) * d, d, A: 1 + 14 * d, L: 70 + 340 * d, v: 14 + 100 * d, w: 0.6 + 6.5 * d, ph: h2(j, 61) * TAU, ph2: h2(j, 62) * TAU, gs: 260 + 420 * d, segs, j };
  });
  const waveY = (R, x, t) => R.y + R.A * (Math.sin((TAU / R.L) * (x - R.v * t) + R.ph) * 0.75 + 0.25 * Math.sin((TAU / R.L) * 2.3 * (x - 0.6 * R.v * t) + R.ph2));
  function surfY(x, y, t) {
    let j = 0; while (j < ROWS6.length - 2 && ROWS6[j + 1].y < y) j++;
    const a = ROWS6[j], b = ROWS6[j + 1], u = clamp((y - a.y) / (b.y - a.y));
    return lerp(waveY(a, x, t) - a.y, waveY(b, x, t) - b.y, u);
  }
  // 水纹：工笔“鱼鳞”浪纹——一排排两头尖的弧笔错落成鳞；每排烘成一条可循环的长贴图，按各自的速度向东流
  const NR6 = 20;
  const STRIP6 = Array.from({ length: NR6 }, (_, j) => {
    const d = Math.pow((j + 0.6) / NR6, 1.65), y = HZ6 + 5 + (H - HZ6 + 30) * d;
    const gap = (H - HZ6 + 30) * (Math.pow((j + 1.6) / NR6, 1.65) - d), sd = clamp((y - HZ6) / (H - HZ6));
    return { j, y, gap, d: sd, P: 900 + Math.round(300 * h2(j, 3)), v: 12 + 95 * sd, L: 14 + 230 * sd, w: 0.6 + 6 * sd };
  });
  function stripTex(S) {
    const hh = Math.ceil(S.gap * 1.5 + S.w * 4 + S.L * 0.12 + 8), tw = W + 380 + S.P;
    return cache('va6_strip' + S.j, tw, hh, 1, (q) => {
      const r = A.rng(600 + S.j), yc = hh * 0.55, arcs = [];
      let x = r() * S.L;
      while (x < S.P - S.L * 0.5) { arcs.push([x, (r() - 0.5) * S.gap * 0.85, 0.45 + r() * 0.75, r()]); x += S.L * (1.05 + r() * 1.2); }
      for (const [x0, dy, k, rr] of arcs) {
        const grp = 0.3 + 0.7 * smooth(noise1(x0 / 230 + S.j * 3.1, 17) * 1.5 - 0.2);      // 浪头成群
        for (let rep = 0; x0 + rep * S.P < tw + S.L; rep++) {
          const xx = x0 + rep * S.P, L = S.L * k, cv = L * 0.07, wd = S.w * (0.55 + 0.6 * rr);
          if (S.d > 0.12) E.util.streak(q, xx + L / 2, yc + dy + wd * 1.5, L * 0.5, wd * 1.4 + 1, '#06102a', 0.3 * grp);
          const top = [], bot = [];
          for (let i = 0; i <= 8; i++) { const u = i / 8, th = Math.pow(Math.sin(PI * Math.pow(u, 0.8)), 0.9); top.push([xx + u * L, yc + dy - cv * Math.sin(PI * u) - wd * th * 0.6]); bot.push([xx + u * L, yc + dy - cv * 0.8 * Math.sin(PI * u) + wd * th * 0.4]); }
          q.fillStyle = rgba(rr < 0.15 ? '#ffffff' : '#dfe8f8', Math.min(0.92, (0.22 + 0.6 * S.d) * grp * (0.6 + 0.4 * k)));
          q.beginPath(); top.forEach(([a, b], i) => (i ? q.lineTo(a, b) : q.moveTo(a, b))); for (let i = 8; i >= 0; i--) q.lineTo(bot[i][0], bot[i][1]); q.closePath(); q.fill();
        }
      }
    });
  }

  XYT.registerShot('va6_tide', {
    name: '潮声东去', zone: 'top', night: true, text: '#eef3f8', shadow: 'rgba(8,16,40,0.95)', accent: '#ff8a5c', bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tXiang = charAt(c, 4, 1.92), tDong = charAt(c, 5, 2.22), tLiu = charAt(c, 6, 2.74);
      // 强拍：在镜头开头 0.4–1.3 秒内找一个强拍，大潮头踩着它涌进来
      let tBore = 0.79;
      if (c.grid && c.b) {
        const t0 = t - lt;
        for (let k = -4; k <= 4; k++) { const i = c.b.i + k, tt = c.grid.time(i) - t0; if (tt > 0.4 && tt < 1.3 && c.grid.isDown(i)) { tBore = tt; break; } }
      }
      const be = c.be ? c.be(0.28) : 0;
      const pan = 60 * smooth((lt + 0.6) / 3.9) + 14 * (lt + 0.6);
      const sc6 = (y) => clamp((y - HZ6) / (H - HZ6));
      const persp = (y) => (y - HZ6 + 8) / (372 - HZ6 + 8);
      // ---------- 盖头的轨迹（视图坐标）----------
      const LW = 88;                                   // 盖头在 1 倍镜头下的大小
      const vx0 = (u) => 628 + 10 * (u + 0.6), VY0 = 372;
      const bow = (y) => 70 * Math.sin(PI * sc6(y)) + (y - VY0) * 0.3 + 26 * (noise1(y * 0.012, 21) - 0.5);
      const xL = -90, vB = (vx0(tXiang) + 14 - xL - bow(VY0)) / Math.max(0.4, tXiang - tBore);
      const boreX = (y) => xL + (lt - tBore) * vB + bow(y);
      const boreH = (y) => (9 + 40 * sc6(y)) * smooth(clamp((lt - tBore + 0.1) / 0.4));
      let vx, vy, vs, fl = 0, tilt = -0.12 + 0.08 * Math.sin(t * 1.3), lift = 0, wet = 0.35, gone = 0;
      if (lt < tXiang) {
        vx = vx0(lt); vy = VY0 + surfY(vx + pan, VY0, t) * 0.8; vs = 1;
      } else {
        const u = lt - tXiang;
        const ride = 1 - smooth(clamp((lt - tDong - 0.1) / 0.4));          // 骑在浪头上，“东”字后滑下浪背
        const bx = boreX(VY0) - 16;
        // 滑下后随水向东、向远处漂（越来越小）
        const drift = smooth(clamp((lt - tDong) / (c.dur - tDong + 0.4)));
        const fx = lerp(vx0(tXiang) + 14 + (tDong + 0.25 - tXiang) * vB * 0.6, 1080, Math.pow(drift, 0.85));
        vx = lerp(fx, Math.min(bx, vx0(tXiang) + 14 + u * vB * 0.6), ride);
        vy = lerp(VY0, HZ6 + 64, Math.pow(drift, 0.8)) - 4 * Math.sin(PI * clamp(u / 0.5));
        vs = Math.max(0.2, persp(vy));
        lift = boreH(VY0) * 0.9 * smooth(clamp(u / 0.12)) * ride;
        tilt += -0.32 * ride * smooth(clamp(u / 0.15));
        fl = PI * smooth(clamp((lt - tDong + 0.12) / 0.42));
        wet = lerp(0.15, 0.6, 1 - ride);
        vy += surfY(vx + pan, vy, t) * vs;
        gone = smooth(clamp((lt - tLiu - 0.02) / 0.22));
      }
      // ---------- 镜头：从盖头近处升起（与上一镜对位），然后随水向右横摇 ----------
      const zk = easeInOut(clamp((lt + 0.6) / 1.5));
      const z0 = VEIL.L / (LW * camZ(c)), Z = lerp(z0, 1, zk);
      const vc = fromScreen(c, VEIL.x, VEIL.y);
      const wz = (Z - 1) / Math.max(0.001, z0 - 1);
      const ax = lerp(vx, vc[0], wz), ay = lerp(vy - lift, vc[1], wz);
      g.save();
      g.translate(ax, ay); g.scale(Z, Z); g.translate(-vx, -(vy - lift));
      prof(g, 'bg', () => {
        g.imageSmoothingEnabled = Z > 1.02;
        g.drawImage(va6Bg(), -pan, 0, BW6, H);
        g.imageSmoothingEnabled = true;
      });
      // 余晖洒在水上的一条碎金路：从西边天际铺向盖头最初漂着的地方
      prof(g, 'glit', () => {
        const P0 = [70 - pan, HZ6 + 4], P1 = [660, 430];
        for (let i = 0; i < 60; i++) {
          const u = Math.pow(h2(i, 71), 0.7), sp = (h2(i, 72) - 0.5) * (8 + 110 * u);
          const x = lerp(P0[0], P1[0], u) + sp * 1.5, y = lerp(P0[1], P1[1], u) + sp * 0.35 + 2 * Math.sin(t * 1.7 + i);
          const f2 = noise1(t * 2.4 + i * 3.1, 7), a = (0.1 + 0.85 * f2 * f2 * f2 + 0.4 * be * (i % 3 === 0)) * (1 - 0.45 * u);
          if (a < 0.08) continue;
          g.fillStyle = rgba(i % 5 === 0 ? '#ffe4b8' : i % 2 ? '#ffa860' : '#ff8a50', Math.min(1, a));
          const L = 4 + 22 * u * (0.5 + h2(i, 73)), th = 0.9 + 2.6 * u;
          g.beginPath(); g.ellipse(x, y, L / 2, th / 2, 0, 0, TAU); g.fill();
        }
      });
      // 浪：一行行浪头向东推移，成群地起落；潮头扫过之后那一片更白更碎
      prof(g, 'waves', () => {
        g.imageSmoothingEnabled = Z > 1.02;
        for (const S of STRIP6) {
          const tex = stripTex(S), hh = tex.lh, o = (((S.v * t - pan * (0.6 + 0.4 * S.d)) % S.P) + S.P) % S.P;
          const x0 = -S.P - 190 + o, sx = Math.max(0, -260 - x0), sw = Math.min(tex.lw - sx, W + 520), kk = tex.width / tex.lw;
          g.drawImage(tex, sx * kk, 0, sw * kk, tex.height, x0 + sx, S.y - hh * 0.55 + S.d * 3 * Math.sin(t * 1.3 + S.j), sw, hh);
        }
        g.imageSmoothingEnabled = true;
        // 沙洲上游一侧挤起的碎浪
        for (const [sx, sy, sw, sh, sd] of SAND6) {
          const x = sx - pan, d = sc6(sy);
          for (let k = 0; k < 5; k++) {
            const ph = ((t * (0.6 + 0.15 * k) + h2(sd, k)) % 1), side = k < 3 ? -1 : 1;
            const xx = x + side * sw * (0.42 + 0.05 * k) - 10 * side + ph * 14, yy = sy + (k % 3 - 1) * (sh * 0.7 + 2);
            const L = 10 + 40 * d;
            g.fillStyle = rgba('#f2f6ff', 0.75 * Math.sin(PI * ph));
            g.beginPath(); g.moveTo(xx - L / 2, yy); g.quadraticCurveTo(xx, yy - 2 - 3 * d, xx + L / 2, yy); g.quadraticCurveTo(xx, yy + 1 + d, xx - L / 2, yy); g.fill();
          }
        }
        // 浪尖上的余晖：靠西（左）的浪尖闪金，随拍一闪
        add(g, () => {
          for (let j = 3; j < ROWS6.length; j++) {
            const R = ROWS6[j];
            for (let k = 0; k < 3; k++) {
              const x = ((h2(j, k + 70) * (W + 200) + R.v * t * 0.9) % (W + 200)) - 100;
              const warm = clamp(1.15 - x / 760);
              const a = warm * (0.15 + 0.6 * be + 0.2 * Math.sin(t * 5 + j * 1.3 + k * 2.1)) * (0.5 + 0.5 * R.d);
              if (a < 0.04) continue;
              const y = waveY(R, x + pan, t) - R.w * 0.6;
              glow(g, x, y, 4 + 12 * R.d, '#ffc890', a);
              if (a > 0.3) glow(g, x, y, 1.2 + 2 * R.d, '#fff6e0', a);
            }
          }
        });
      });
      // 大潮头：强拍上从左边涌进，一堵水墙向东扫过；前面陡起的水面（浪唇透出天光），顶上翻卷的白沫和飞沫，后面一片翻搅的白水
      prof(g, 'bore', () => {
        if (lt < tBore - 0.1) return;
        const k = smooth(clamp((lt - tBore + 0.1) / 0.35));
        const onBar = (x, y) => { for (const [sx, sy, sw, sh] of SAND6) { const dx = (x - (sx - pan)) / (sw * 0.5), dy = (y - sy) / (sh * 1.4 + 3); if (dx * dx + dy * dy < 1) return true; } return false; };
        const fx = (y) => boreX(y) + 18 * (noise1(y * 0.025 + t * 1.4, 8) - 0.5) * (0.3 + sc6(y));
        // 后面翻搅的白水：离潮头越远越淡、越碎，约 1 秒散尽
        for (let i = 0; i < 46; i++) {
          const y = HZ6 + 6 + Math.pow(h2(i, 84), 0.85) * (H - HZ6), s0 = sc6(y), back = Math.pow(h2(i, 85), 1.1);
          const dist = (30 + 190 * s0) * back + 6, x = fx(y) - dist, age = dist / vB;
          const a = (0.7 - 0.45 * back) * k * Math.exp(-age / 1.0);
          if (a < 0.03 || onBar(x, y)) continue;
          E.util.streak(g, x, y + 2 * Math.sin(t * 3 + i), (16 + 60 * s0) * (0.5 + h2(i, 86)), 2 + 7 * s0, '#eef4ff', a);
        }
        // 潮头前被吸低的一线暗水
        for (let i = 0; i < 26; i++) { const y = HZ6 + 6 + (i / 26) * (H - HZ6 + 20), s0 = sc6(y), x = fx(y), h = boreH(y); if (!onBar(x, y)) E.util.streak(g, x + 8 + h * 0.9, y + 2, 10 + h * 1.4, 2 + h * 0.35, '#030a1e', 0.45 * k); }
        // 水墙：沿潮线一段段画，沙洲处断开
        const ys = [];
        for (let y = HZ6 + 3; y <= H + 34; y += 9) ys.push(y);
        let seg = [];
        const flush = () => {
          if (seg.length > 1) {
            // 陡起的水面：底部深、浪唇处透出蓝绿的天光
            g.fillStyle = rgba('#081634', 0.8 * k);
            g.beginPath(); seg.forEach(([x, y, h], i) => (i ? g.lineTo(x, y - h) : g.moveTo(x, y - h)));
            for (let i = seg.length - 1; i >= 0; i--) { const [x, y, h] = seg[i]; g.lineTo(x + 5 + h * 0.85, y + 2); }
            g.closePath(); g.fill();
            g.fillStyle = rgba('#5f8fbf', 0.55 * k);
            g.beginPath(); seg.forEach(([x, y, h], i) => (i ? g.lineTo(x + 1, y - h * 0.92) : g.moveTo(x + 1, y - h * 0.92)));
            for (let i = seg.length - 1; i >= 0; i--) { const [x, y, h] = seg[i]; g.lineTo(x + 3 + h * 0.45, y - h * 0.4); }
            g.closePath(); g.fill();
            // 浪唇一道白
            g.strokeStyle = rgba('#ffffff', 0.95 * k); g.lineCap = 'round'; g.lineJoin = 'round';
            for (let i = 1; i < seg.length; i++) { const [x0, y0, h0] = seg[i - 1], [x1, y1, h1] = seg[i]; g.lineWidth = 1.4 + 0.22 * (h0 + h1) / 2; g.beginPath(); g.moveTo(x0 - 1, y0 - h0); g.lineTo(x1 - 1, y1 - h1); g.stroke(); }
          }
          seg = [];
        };
        for (const y of ys) { const x = fx(y); if (onBar(x, y)) flush(); else seg.push([x, y, boreH(y)]); }
        flush();
        // 浪头顶上翻卷的白沫：一串浪花团，向后翻
        for (let i = 0; i < 56; i++) {
          const y = HZ6 + 4 + (i / 56) * (H - HZ6 + 30) + 3 * Math.sin(i * 7.3), s0 = sc6(y), x = fx(y);
          if (onBar(x, y)) continue;
          const h = boreH(y), r = (8 + 30 * s0) * (0.55 + 0.9 * noise1(i * 0.8 + t * 3.2, 9));
          E.util.streak(g, x - r * 0.35, y - h - r * 0.15, r * 1.15, r * 0.62, '#ffffff', (0.8 + 0.2 * h2(i, 88)) * k);
          E.util.streak(g, x - r * 1.1, y - h * 0.5, r, r * 0.5, '#dde8ff', 0.5 * k);
        }
        // 沙洲上溅起的白
        for (const [sx, sy, sw, sh, sd] of SAND6) {
          const x0 = sx - pan, hit = (fx(sy) - (x0 - sw * 0.5)) / Math.max(1, sw);
          if (hit < 0 || hit > 1.6) continue;
          const e = Math.sin(PI * clamp(hit / 1.6)) * k, s0 = sc6(sy);
          for (let i = 0; i < 7; i++) E.util.streak(g, x0 - sw * 0.5 + sw * clamp(hit) * h2(sd, i), sy - sh * (0.4 + 1.4 * h2(sd, i + 5)) * (0.6 + e), 12 + 24 * s0, 4 + 10 * s0, '#ffffff', 0.75 * e);
        }
        // 飞沫：浪头顶上往前、往上溅
        add(g, () => {
          for (let i = 0; i < 44; i++) {
            const y = HZ6 + 10 + h2(i, 81) * (H - HZ6), s0 = sc6(y), x0 = fx(y);
            if (onBar(x0, y)) continue;
            const life = ((t * 1.9 + h2(i, 82)) % 1), h = boreH(y);
            const x = x0 + 4 * s0 + life * 40 * s0, yy = y - h - life * (14 + 60 * s0) + life * life * 50 * s0;
            glow(g, x, yy, 2 + 8 * s0, '#eef4ff', 0.75 * (1 - life) * k);
          }
          const fl = Math.exp(-Math.max(0, lt - tBore) / 0.35) * k;
          for (let y = HZ6 + 30; y < H; y += 90) glow(g, fx(y), y - boreH(y), 50 + 110 * sc6(y), '#cfe0ff', 0.25 * fl);
        });
      });
      // ---------- 红盖头 ----------
      prof(g, 'veil', () => {
        if (gone >= 1) return;
        const L = LW * vs, th = VEIL.th + tilt * 0.5, sq = VEIL.sq * (0.92 + 0.08 * Math.sin(t * 1.7));
        const cf = Math.cos(fl), under = cf < 0, fy = Math.max(0.12, Math.abs(cf));
        const f1 = [Math.cos(th) * L, Math.sin(th) * L * sq], f2 = [-Math.sin(th) * L * fy, Math.cos(th) * L * sq * fy];
        const cx = vx, cy = vy - lift;
        const sink = Math.max(wet, gone);
        const grid = (u, v) => {
          // 远角折过来一截
          let uu = u, vv = v; const s2 = u + v - 1.72; if (s2 > 0) { uu -= s2 / 2; vv -= s2 / 2; }
          const x = cx + f1[0] * (uu - 0.5) + f2[0] * (vv - 0.5), y0 = cy + f1[1] * (uu - 0.5) + f2[1] * (vv - 0.5);
          const hgt = lift > 1 ? -lift * 0.25 * (uu - 0.5) : surfY(x + pan, y0, t) * vs;
          // 两个角浸在水里
          const wv = clamp(1 - Math.hypot(uu, vv - 1) / 0.55) + clamp(1 - Math.hypot(uu - 1, vv) / 0.5) * 0.8;
          const ph = 6 * uu - 3 * vv - t * 3.4;
          const edge = 1 - (1 - Math.abs(2 * uu - 1)) * (1 - Math.abs(2 * vv - 1));
          return [x + 1.5 * Math.sin(ph * 0.7 + 1) * vs, y0 + hgt + 3 * Math.sin(ph) * vs + 5 * edge * vs * (lift > 1 ? 0 : 1), 0.6 * Math.sin(ph) * (under ? 0.5 : 1), clamp(sink * 0.8 + wv * (0.6 + 0.4 * sink))];
        };
        // 水里的倒影（淡红一抹）与拖出的水纹
        if (lift < 2) {
          E.util.streak(g, cx + 2, cy + 4 * vs, 56 * vs, 14 * vs, '#0a1430', 0.22 * (1 - gone));
          g.fillStyle = rgba('#b02a26', 0.18 * (1 - gone)); g.beginPath(); g.ellipse(cx + 2, cy + 12 * vs, 46 * vs, 6 * vs, th * 0.3, 0, TAU); g.fill();
          g.strokeStyle = rgba('#dce6fa', 0.3 * (1 - gone)); g.lineCap = 'round';
          for (let k = 0; k < 3; k++) {
            const u = ((t * 0.8 + k / 3) % 1), d = (26 + u * 110) * vs, sp = (6 + u * 24) * vs;
            g.lineWidth = Math.max(0.6, 2 * vs * (1 - u)); g.globalAlpha = 1 - u;
            g.beginPath(); g.moveTo(cx - d, cy - sp * 0.5); g.quadraticCurveTo(cx - d * 0.4, cy - sp * 0.2, cx - 30 * vs, cy - 2 * vs); g.stroke();
            g.beginPath(); g.moveTo(cx - d, cy + sp * 0.6); g.quadraticCurveTo(cx - d * 0.4, cy + sp * 0.25, cx - 30 * vs, cy + 6 * vs); g.stroke();
          }
          g.globalAlpha = 1;
        }
        const M = veilMesh(g, grid, {
          alpha: 1 - gone, back: under, roundelA: 0.7, border: Math.max(1, 2.2 * vs), wet: '#203458',
          tassL: 15 * vs, tass: [PI * 0.85, PI * 0.15, PI * 0.5, PI * 0.95].map((a, k) => a + 0.25 * Math.sin(t * 2.2 + k)), skip: 2,
        });
        // 浮在水里：边上一圈水线的亮、四周压着的暗
        if (lift < 3 && gone < 1) {
          g.globalAlpha = (1 - gone) * (1 - lift / 3);
          g.strokeStyle = 'rgba(214,232,255,0.5)'; g.lineWidth = Math.max(0.8, 1.6 * vs);
          g.save(); g.translate(0, 1.5 * vs); poly(g, M.out); g.stroke(); g.restore();
          g.globalAlpha = 1;
        }
        // 折过来的一角：绸的背面（深）
        if (!under && gone < 1) {
          const a = M.at(VN, Math.round(VN * 0.72)), b = M.at(Math.round(VN * 0.72), VN), cc = M.bil(0.72, 0.72);
          g.globalAlpha = 1 - gone;
          g.fillStyle = '#7a1014'; poly(g, [a, b, cc]); g.fill();
          g.strokeStyle = 'rgba(200,150,60,0.8)'; g.lineWidth = Math.max(0.8, 1.6 * vs); poly(g, [a, b, cc]); g.stroke();
          g.globalAlpha = 1;
        }
        // 余晖照在红绸上的一点暖光（只在西边那条光路里）
        const warm = clamp(1.3 - cx / 760) * (1 - gone);
        add(g, () => glow(g, cx - 8 * vs, cy - 4 * vs, 46 * vs, '#ff9a6a', (0.18 + 0.22 * be) * warm));
        // “流”字：一道浪头卷过来把它吞下去，只剩一点红光慢慢散进暮色
        if (lt > tLiu - 0.05) {
          const u = clamp((lt - tLiu + 0.05) / 0.3), x0 = cx - 40 * vs + u * 70 * vs;
          g.strokeStyle = rgba('#f4f8ff', 0.85 * Math.sin(PI * clamp(u * 1.1))); g.lineWidth = 3 * vs + 1; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x0 - 40 * vs, cy + 6 * vs); g.quadraticCurveTo(x0, cy - 16 * vs, x0 + 30 * vs, cy + 2 * vs); g.stroke();
          E.util.streak(g, x0, cy - 2 * vs, 34 * vs, 8 * vs, '#ffffff', 0.6 * Math.sin(PI * u));
          const fin = smooth(clamp((lt - tLiu) / 0.15)) * Math.exp(-Math.max(0, lt - tLiu - 0.15) / 0.45);
          add(g, () => { glow(g, cx, cy, 26, '#ff5a3a', 0.6 * fin); glow(g, cx, cy, 6, '#ffd0b0', 0.8 * fin); });
        }
      });
      // 近岸芦苇（石塘上）
      prof(g, 'reeds', () => E.reeds(g, { t, x0: -60 - pan * 0.2, x1: 230 - pan * 0.2, y: 592, h: 150, n: 16, color: '#0c1426', plume: '#9aaccc', wind: 0.55 + 0.25 * be, seed: 6 }));
      // 几只归鸥贴着水面向东，翅膀随拍扇动
      prof(g, 'birds', () => {
        const bx = c.b ? c.b.x : t * 1.2;
        for (let k = 0; k < 4; k++) {
          const sc = 1.6 + 0.15 * k + 0.2 * h2(k, 52);
          const x = 120 + k * 120 + h2(k, 51) * 60 + (lt + 0.6) * (60 + 12 * k), y = 262 + k * 18 + 6 * Math.sin(t * 1.1 + k);
          const ph = PI * 0.5 + TAU * (bx + 0.13 * k);
          A.bird(g, x, y, sc, ph, 'rgba(236,240,250,0.9)');
          g.fillStyle = 'rgba(30,40,60,0.6)'; g.beginPath(); g.ellipse(x, y + 1, 2.2 * sc, 1.1 * sc, 0, 0, TAU); g.fill();
        }
      });
      g.restore();
    },
  });


  // ======================================================================
  // 7 回首旧街：余杭老街的廊棚，日落之后的紫暮；灯笼由远及近一路亮到他身边，“回”字上他停步回首；“往事”硬切晴天正午的旧街
  // ======================================================================
  const VP7 = [780, 372], F7 = 400;
  const pj = (X, Y, Z) => [VP7[0] + (X * F7) / Z, VP7[1] + (Y * F7) / Z];
  const POSTS7 = [1.3, 4.3, 7.3, 10.3, 13.3, 16.3, 19.3, 22.3, 25.3, 28.3, 31.3, 34.3, 37.3, 40.3];
  const PAL7 = {
    dusk: {
      sky: [[0, '#1c1630'], [0.4, '#33284a'], [0.7, '#574266'], [0.88, '#7a4654'], [1, '#c0663e']],
      opp: '#6e5a72', oppDark: '#3a2c40', roof: '#1e1824', win: '#ffb860', water0: '#5a4660', water1: '#1a1422',
      post: '#1e1214', rim: '#d08060', ceil: '#100a0c', beam: '#20141a', paint: null, floor0: '#493131', floor1: '#140c0e', joint: 'rgba(0,0,0,0.35)',
      shop: '#2a1e26', door: '#e08a48', board: '#22151a', sign: '#4a1c16', signTxt: 'rgba(240,200,140,0.7)', rail: '#180c0e', haze: '#a0605a', hazeA: 0.5, ink: null,
    },
    noon: {
      sky: [[0, '#2f74c0'], [0.6, '#8cc6ea'], [1, '#e2f2f0']],
      opp: '#f6f0e2', oppDark: '#bcc0c8', roof: '#2a2e38', win: '#3a3a40', water0: '#6cbcb0', water1: '#1e6a78',
      post: '#b0321e', rim: '#ffd8a0', ceil: '#4a2a1a', beam: '#1f6a6a', paint: '#e0b84a', floor0: '#dccfb2', floor1: '#a89070', joint: 'rgba(90,64,40,0.4)',
      shop: '#efe2c8', door: '#4a2e1e', board: '#a8683c', sign: '#c8281e', signTxt: 'rgba(255,226,150,0.95)', rail: '#a02c1a', haze: '#fff6e6', hazeA: 0.14, ink: 'rgba(36,20,14,0.75)',
    },
  };
  const fogK7 = (Z) => clamp(Z / 70);
  // 后层：天、对岸、河面、右侧店面、地面、顶棚
  function arcadeBack7(mode) {
    const P = PAL7[mode], ink = P.ink;
    return cache('va7b3_' + mode + fk(), W, H, 1, (q) => {
      const r = A.rng(mode === 'dusk' ? 71 : 72);
      q.fillStyle = mix(P.oppDark, P.water1, 0.5); q.fillRect(0, 0, W, H);
      q.fillStyle = K.lin(q, 0, 0, 0, VP7[1] + 30, P.sky); q.fillRect(0, 0, W, VP7[1] + 40);
      if (mode === 'dusk') q.fillStyle = K.rad(q, VP7[0], VP7[1] - 6, 3, 300, [[0, 'rgba(255,190,120,0.9)'], [0.12, 'rgba(240,130,90,0.5)'], [1, 'rgba(160,80,90,0)']]);
      else q.fillStyle = K.rad(q, VP7[0] - 200, 60, 5, 500, [[0, 'rgba(255,255,240,0.7)'], [1, 'rgba(255,255,240,0)']]);
      q.fillRect(0, 0, W, VP7[1] + 40);
      // 对岸的白墙黛瓦（X=-12），由近及远；墙上雨痕、水渍
      for (let k = 0; k < 18; k++) {
        const Z0 = 3.5 + k * 3.6 + k * k * 0.12, Z1 = Z0 + 3.2 + k * 0.25, fk2 = fogK7(Z0);
        const hw = 4.2 + 2.2 * h2(k, 3), base = 2.1, top = base - hw;
        const a = pj(-12, base, Z0), b = pj(-12, base, Z1), c2 = pj(-12, top, Z1), d = pj(-12, top, Z0);
        q.fillStyle = mix(P.opp, P.haze, fk2 * 0.7); poly(q, [a, b, c2, d]); q.fill();
        if (k < 12) {
          for (let i = 0; i < 6; i++) {
            const zz = lerp(Z0, Z1, h2(k, i + 20)), p0 = pj(-12, top + 0.5, zz), p1 = pj(-12, top + 0.5 + hw * (0.3 + 0.5 * h2(k, i + 30)), zz);
            q.strokeStyle = rgba(P.oppDark, (mode === 'dusk' ? 0.35 : 0.22) * (1 - fk2)); q.lineWidth = Math.max(0.6, 3 / Z0);
            q.beginPath(); q.moveTo(p0[0], p0[1]); q.lineTo(p1[0], p1[1]); q.stroke();
          }
          q.fillStyle = rgba(P.oppDark, 0.18 * (1 - fk2)); const m = pj(-12, base - hw * 0.35, lerp(Z0, Z1, 0.5)); q.beginPath(); q.ellipse(m[0], m[1], 30 / Z0 * 4, 12 / Z0 * 4, 0, 0, TAU); q.fill();
        }
        q.fillStyle = rgba(P.oppDark, 0.45 * (1 - fk2)); poly(q, [a, b, pj(-12, base - 0.8, Z1), pj(-12, base - 0.8, Z0)]); q.fill();
        const e0 = pj(-11.2, top + 0.3, Z0), e1 = pj(-11.2, top + 0.3, Z1), r0 = pj(-12.6, top - 0.9, Z0), r1 = pj(-12.6, top - 0.9, Z1);
        q.fillStyle = mix(P.roof, P.haze, fk2 * 0.6); poly(q, [e0, e1, r1, r0]); q.fill();
        if (ink && k < 10) { q.strokeStyle = ink; q.lineWidth = Math.max(0.5, 3 / Z0); poly(q, [a, b, c2, d]); q.stroke(); poly(q, [e0, e1, r1, r0]); q.stroke(); }
        if (k % 2 === 0) {
          q.fillStyle = mix(P.opp, P.haze, fk2 * 0.7);
          const g0 = pj(-12, top - 1.6, Z0), g1 = pj(-12, top - 1.6, Z0 + 0.5);
          poly(q, [d, pj(-12, top, Z0 + 0.5), g1, g0]); q.fill();
          q.fillStyle = mix(P.roof, P.haze, fk2 * 0.6);
          const cp0 = pj(-11.7, top - 1.6, Z0 - 0.15), cp1 = pj(-11.7, top - 1.6, Z0 + 0.65);
          poly(q, [cp0, cp1, [cp1[0], cp1[1] - 6 * 4 / Z0], [cp0[0] - 3, cp0[1] - 9 * 4 / Z0]]); q.fill();
        }
        if (k > 0) for (let w = 0; w < 2; w++) {
          const zz = lerp(Z0, Z1, 0.3 + w * 0.4), wy = top + 1.6 + 0.4 * h2(k, w);
          const w0 = pj(-12, wy, zz), w1 = pj(-12, wy + 0.8, zz + 0.6);
          const lit = mode === 'dusk' && h2(k, w + 5) < 0.6;
          q.fillStyle = lit ? mix(P.win, P.haze, fk2 * 0.5) : rgba(P.win, 0.7 * (1 - fk2));
          q.fillRect(w0[0], w0[1], Math.max(1, w1[0] - w0[0]), Math.max(1, w1[1] - w0[1]));
          if (lit && k < 9) A.softBlob(q, (w0[0] + w1[0]) / 2, (w0[1] + w1[1]) / 2, 22 / zz * 4, 0.4, '#ffb060');
          if (ink && zz < 30) { q.strokeStyle = ink; q.lineWidth = 0.6; q.strokeRect(w0[0], w0[1], Math.max(1, w1[0] - w0[0]), Math.max(1, w1[1] - w0[1])); }
        }
      }
      // 河面：天光、对岸倒影、灯影
      const wn = pj(-12, 2.4, 2.4), wf = pj(-12, 2.4, 80), en = pj(-2.4, 2.4, 1.2), ef = pj(-2.4, 2.4, 80);
      q.fillStyle = K.lin(q, 0, VP7[1], 0, H, [[0, P.water0], [1, P.water1]]);
      poly(q, [[wn[0] - 400, wn[1]], wf, ef, en, [-40, H + 40], [-40, wn[1]]]); q.fill();
      q.save(); q.globalAlpha = 0.3;
      for (let k = 0; k < 16; k++) {
        const Z0 = 3.5 + k * 3.6 + k * k * 0.12, Z1 = Z0 + 3.2 + k * 0.25, a = pj(-12, 2.4, Z0), b = pj(-12, 2.4, Z1), c2 = pj(-12, 6.4, Z1), d = pj(-12, 6.4, Z0);
        q.fillStyle = mix(P.opp, P.water1, 0.3); poly(q, [a, b, c2, d]); q.fill();
      }
      q.restore();
      const bA = pj(-12, 2.4, 46), bB = pj(-2.4, 2.4, 46), bT = pj(-7, 0.3, 46);
      q.strokeStyle = mix(P.oppDark, P.haze, 0.5); q.lineWidth = 3;
      q.beginPath(); q.moveTo(bA[0], bA[1]); q.quadraticCurveTo(bT[0], bT[1] - 6, bB[0], bB[1]); q.stroke();
      // 右侧店铺的墙（X=2.6）、门板、招幌
      const sh = (Z0, Z1, y0, y1, col) => { poly(q, [pj(2.6, y0, Z0), pj(2.6, y0, Z1), pj(2.6, y1, Z1), pj(2.6, y1, Z0)]); q.fillStyle = col; q.fill(); if (ink && Z0 < 26) { q.strokeStyle = ink; q.lineWidth = Math.max(0.5, 3 / Z0); q.stroke(); } };
      sh(1.6, 80, 1.6, -1.3, P.shop);
      for (let k = 0; k < 12; k++) {
        const Z0 = 2.2 + k * 3.5, Z1 = Z0 + 2.3, fk2 = fogK7(Z0);
        { const a = pj(2.6, -0.6, Z0), b = pj(2.6, 1.6, Z0); poly(q, [pj(2.6, 1.6, Z0), pj(2.6, 1.6, Z1), pj(2.6, -0.6, Z1), pj(2.6, -0.6, Z0)]);
          const dc = mix(P.door, P.haze, fk2 * 0.5); q.fillStyle = K.lin(q, 0, a[1], 0, b[1], [[0, mix(dc, '#000000', 0.55)], [0.45, dc], [1, mix(dc, '#ffffff', 0.12)]]); q.fill();
          if (ink && Z0 < 26) { q.strokeStyle = ink; q.lineWidth = Math.max(0.5, 3 / Z0); q.stroke(); }
          sh(Z0, Z1, -0.25, -0.6, mix(mode === 'dusk' ? '#2a1418' : '#2a4a7a', P.haze, fk2 * 0.5)); }
        for (let j = 0; j < 3; j++) { const zz = Z0 + 0.25 + j * 0.24; sh(zz, zz + 0.2 + 0.1 * h2(k, j + 9), 1.6, -0.6, mix(P.board, P.haze, fk2 * 0.5)); }
        if (k % 2 === 0 && k < 9) {
          const zz = Z0 + 1.2, a = pj(2.3, -1.15, zz), b = pj(2.3, 0.2, zz), w = 0.42 * F7 / zz;
          q.fillStyle = mix(P.sign, P.haze, fk2 * 0.4); q.fillRect(a[0] - w / 2, a[1], w, b[1] - a[1]);
          if (ink) { q.strokeStyle = ink; q.lineWidth = 0.8; q.strokeRect(a[0] - w / 2, a[1], w, b[1] - a[1]); }
          if (zz < 12) {
            q.fillStyle = P.signTxt; q.font = Math.round(w * 0.8) + 'px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
            q.fillText(['茶', '酒', '客', '福', '余'][k / 2 % 5], a[0], lerp(a[1], b[1], 0.35));
          }
        }
      }
      // 地面：石板，块块深浅不一
      const fl = [pj(-2.2, 1.6, 1.0), pj(-2.2, 1.6, 80), pj(2.6, 1.6, 80), pj(2.6, 1.6, 1.0)];
      q.fillStyle = K.lin(q, 0, VP7[1], 0, H, [[0, P.floor0], [1, P.floor1]]); poly(q, fl); q.fill();
      let zi = 0;
      for (let Z = 1.2; Z < 30; Z *= 1.16, zi++) for (let X = -2.2, xi = 0; X < 2.6; X += 0.6, xi++) {
        const v = h2(xi + zi * 13, mode === 'dusk' ? 5 : 6);
        if (v > 0.55) continue;
        q.fillStyle = v < 0.25 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,220,0.06)';
        poly(q, [pj(X, 1.6, Z), pj(X + 0.6, 1.6, Z), pj(X + 0.6, 1.6, Z * 1.16), pj(X, 1.6, Z * 1.16)]); q.fill();
      }
      if (mode === 'dusk') { q.fillStyle = K.rad(q, VP7[0], VP7[1] + 20, 10, 420, [[0, 'rgba(220,120,90,0.4)'], [1, 'rgba(160,90,90,0)']]); poly(q, fl); q.fill(); }
      q.strokeStyle = P.joint; q.lineWidth = 1;
      for (let X = -2.2; X <= 2.6; X += 0.6) { const a = pj(X, 1.6, 1.0), b = pj(X, 1.6, 80); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
      for (let Z = 1.2; Z < 60; Z *= 1.16) { const a = pj(-2.2, 1.6, Z), b = pj(2.6, 1.6, Z); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
      // 正午：日光从河边两柱之间斜铺到石板上
      if (mode === 'noon') {
        q.save(); poly(q, fl); q.clip();
        for (let i = 0; i < POSTS7.length - 1; i++) {
          const za = POSTS7[i] + 0.14, zb = POSTS7[i + 1] - 0.14, fk2 = fogK7(za);
          const at = (Y, Z) => pj(-2.2 + 1.7 * (1.6 - Y), 1.6, Math.max(0.5, Z - 1.9 * (1.6 - Y)));
          q.fillStyle = rgba('#fff4d8', 0.42 * (1 - fk2 * 0.6));
          poly(q, [at(1.1, za), at(1.1, zb), at(-1.0, zb), at(-1.0, za)]); q.fill();
        }
        q.restore();
      }
      // 顶棚与椽子
      const ce = [pj(-2.2, -1.3, 1.0), pj(-2.2, -1.3, 80), pj(2.6, -1.3, 80), pj(2.6, -1.3, 1.0)];
      q.fillStyle = P.ceil; poly(q, [[-40, -40], [W + 40, -40], [W + 40, ce[3][1]], ce[3], ce[2], ce[1], ce[0], [-40, ce[0][1]]]); q.fill();
      q.strokeStyle = rgba(mode === 'dusk' ? '#3a2420' : '#8a5a40', mode === 'dusk' ? 0.5 : 0.6); q.lineWidth = 2;
      for (let X = -2.2; X <= 2.6; X += 0.4) { const a = pj(X, -1.3, 1.0), b = pj(X, -1.3, 80); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
    });
  }
  // 前层：河边一排廊柱、横梁、美人靠、檐枋（透明底，河里的船与水光画在它后面）
  function arcadeFront7(mode) {
    const P = PAL7[mode], ink = P.ink;
    return cache('va7f3_' + mode, W, H, 1, (q) => {
      for (let i = POSTS7.length - 1; i >= 0; i--) {
        const Z = POSTS7[i], w = (0.24 * F7) / Z, top = pj(-2.2, -1.3, Z), bot = pj(-2.2, 1.6, Z), fk2 = fogK7(Z);
        q.fillStyle = mix(P.beam, P.haze, fk2 * 0.5); const bm = [pj(-2.2, -1.3, Z), pj(2.6, -1.3, Z), pj(2.6, -1.0, Z), pj(-2.2, -1.0, Z)]; poly(q, bm); q.fill();
        if (ink && Z < 26) { q.strokeStyle = ink; q.lineWidth = Math.max(0.5, 4 / Z); poly(q, bm); q.stroke(); }
        if (P.paint && Z < 20) { q.strokeStyle = rgba(P.paint, 0.9 * (1 - fk2)); q.lineWidth = Math.max(0.6, 4 / Z); poly(q, [pj(-2.2, -1.25, Z), pj(2.6, -1.25, Z), pj(2.6, -1.05, Z), pj(-2.2, -1.05, Z)]); q.stroke(); const m = pj(0.2, -1.15, Z); q.beginPath(); q.ellipse(m[0], m[1], 30 / Z * 4, 6 / Z * 4, 0, 0, TAU); q.stroke(); }
        q.fillStyle = mix(P.post, P.haze, fk2 * 0.55); q.fillRect(top[0] - w / 2, top[1], w, bot[1] - top[1]);
        if (ink) { q.strokeStyle = ink; q.lineWidth = Math.max(0.6, 5 / Z); q.strokeRect(top[0] - w / 2, top[1], w, bot[1] - top[1]); }
        if (Z < 6) { q.strokeStyle = 'rgba(0,0,0,0.25)'; q.lineWidth = 1; for (let k = 0; k < 4; k++) { const xx = top[0] - w / 2 + w * (0.15 + 0.22 * k); q.beginPath(); q.moveTo(xx, top[1]); q.lineTo(xx + 2 * Math.sin(k), bot[1]); q.stroke(); } }
        q.fillStyle = rgba(P.rim, (mode === 'dusk' ? 0.45 : 0.5) * (1 - fk2)); q.fillRect(top[0] + w * 0.3, top[1], Math.max(1, w * 0.16), bot[1] - top[1]);
        if (i < POSTS7.length - 1) {
          const Z2 = POSTS7[i + 1], s0 = pj(-2.2, 1.15, Z), s1 = pj(-2.2, 1.15, Z2), b0 = pj(-2.45, 0.55, Z), b1 = pj(-2.45, 0.55, Z2);
          q.fillStyle = mix(P.rail, P.haze, fk2 * 0.5); poly(q, [s0, s1, pj(-2.2, 1.25, Z2), pj(-2.2, 1.25, Z)]); q.fill();
          q.strokeStyle = mix(P.rail, P.haze, fk2 * 0.5); q.lineWidth = Math.max(1, 6 / Z);
          q.beginPath(); q.moveTo(b0[0], b0[1]); q.lineTo(b1[0], b1[1]); q.stroke();
          for (let k = 1; k < 8; k++) { const zz = lerp(Z, Z2, k / 8), a = pj(-2.2, 1.15, zz), b = pj(-2.42, 0.6, zz); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
        }
      }
      q.fillStyle = P.beam; const eb = [pj(-2.25, -1.45, 1.0), pj(-2.25, -1.45, 80), pj(-2.25, -1.05, 80), pj(-2.25, -1.05, 1.0)]; poly(q, eb); q.fill();
      if (ink) { q.strokeStyle = ink; q.lineWidth = 1.5; poly(q, eb); q.stroke(); }
      q.fillStyle = K.rad(q, VP7[0], VP7[1], 10, 360, [[0, rgba(P.haze, P.hazeA)], [1, rgba(P.haze, 0)]]); q.fillRect(0, 0, W, H);
      if (mode === 'noon') {
        // 廊下的红灯笼（白天不点）
        for (let i = LANT7.length - 1; i >= 0; i--) { const Z = LANT7[i], [x, y] = pj(-1.95, -1.05, Z); E.lantern(q, { x, y, s: 0.62 * 4 / Z * 1.75, t: 0, seed: i * 3, lit: 0, swing: 0, cord: 10, color: '#d0302a' }); }
        // 左侧最近的一根红柱在阴影里（字在这里），整幅左边压一层暗；画卷边缘的暗角
        q.fillStyle = K.lin(q, 40, 0, 220, 0, [[0, '#2a0c08'], [0.55, '#5a180e'], [0.85, '#7a2414'], [1, '#3a0e08']]); q.fillRect(40, -10, 180, H + 20);
        q.fillStyle = 'rgba(255,190,120,0.4)'; q.fillRect(212, -10, 4, H + 20);
        q.strokeStyle = 'rgba(20,8,4,0.8)'; q.lineWidth = 2; q.strokeRect(40, -10, 180, H + 20);
        q.fillStyle = K.lin(q, 0, 0, 300, 0, [[0, 'rgba(30,14,8,0.6)'], [0.7, 'rgba(30,14,8,0.25)'], [1, 'rgba(30,14,8,0)']]); q.fillRect(0, 0, 300, H);
        q.fillStyle = K.rad(q, 700, 360, 320, 820, [[0, 'rgba(120,70,30,0)'], [1, 'rgba(120,70,30,0.4)']]); q.fillRect(0, 0, W, H);
      }
    });
  }
  // 廊下灯笼：河边一排挂在檐枋下，店铺一侧一排挂在招幌旁
  const LANT7 = [2.8, 5.8, 8.8, 11.8, 14.8, 17.8, 20.8, 23.8];
  const LANS7 = [3.9, 7.4, 10.9, 14.4];
  // 一摞竹编蒸笼（冒着热气的包子）
  function steamer(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (let k = 0; k < 3; k++) {
      const yy = -k * 9;
      g.fillStyle = k % 2 ? '#c89a5a' : '#b88848'; g.beginPath(); g.ellipse(0, yy, 22, 6, 0, 0, TAU); g.fill();
      g.fillRect(-22, yy - 8, 44, 8);
      g.fillStyle = '#e0b878'; g.beginPath(); g.ellipse(0, yy - 8, 22, 6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(70,44,20,0.8)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-22, yy - 4); g.lineTo(22, yy - 4); g.stroke();
      g.beginPath(); g.ellipse(0, yy, 22, 6, 0, 0, PI); g.stroke();
    }
    g.fillStyle = '#d8ac6a'; g.beginPath(); g.ellipse(0, -27, 20, 5, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(70,44,20,0.8)'; g.lineWidth = 0.9; g.stroke();
    g.fillStyle = '#9a6a38'; g.fillRect(-3, -32, 6, 4);
    g.restore();
  }
  // 远处的小人（人群里看不清面目的远景路人）：几笔色块，迈步摆动
  function tinyWalker(g, x, y, s, t, f, col, hat, seed) {
    const ph = t * 5.2 + seed * 1.7, sw = Math.sin(ph) * 0.35;
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.strokeStyle = '#3a2a22'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -38); g.lineTo(Math.sin(sw) * 16, -2); g.moveTo(0, -38); g.lineTo(-Math.sin(sw) * 16, -2); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(-7, -72); g.lineTo(8, -72); g.lineTo(11, -34); g.lineTo(-10, -34); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,24,16,0.8)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = '#e8c8a8'; g.beginPath(); g.arc(1, -80, 7, 0, TAU); g.fill();
    if (hat) { g.fillStyle = '#c8a860'; g.beginPath(); g.moveTo(-13, -82); g.lineTo(1, -94); g.lineTo(15, -82); g.closePath(); g.fill(); }
    else { g.fillStyle = '#2a1a14'; g.beginPath(); g.arc(-1, -84, 6, PI, TAU); g.fill(); }
    g.restore();
  }

  XYT.registerShot('va7_lookback', {
    name: '回首旧街', zone: 'left', night: true, text: '#eef3f8', shadow: 'rgba(24,12,22,0.95)', accent: '#ffb44a', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tHui = charAt(c, 1, 0.56), tWang = charAt(c, 3, 1.86), tShi = charAt(c, 4, 2.3);
      const be = c.be ? c.be(0.3) : 0;
      const per = c.b && c.b.period ? c.b.period : 0.824;
      if (lt < tWang) {
        // ---------- 现在：紫暮里的廊棚 ----------
        prof(g, 'bg', () => { g.imageSmoothingEnabled = false; g.drawImage(arcadeBack7('dusk'), 0, 0, W, H); g.imageSmoothingEnabled = true; });
        // 河面的一线水光：天光与灯影在波上碎开（在廊柱之后）
        prof(g, 'canal', () => add(g, () => {
          for (let i = 0; i < 34; i++) {
            const Z = 2.6 + Math.pow(h2(i, 41), 1.4) * 22, X = -2.6 - h2(i, 42) * 6, p = pj(X, 2.4, Z);
            const fl2 = noise1(t * 2.2 + i * 2.7, 4), a = (0.12 + 0.5 * fl2 * fl2) * (1 - Z / 30);
            const L = (10 + 26 * h2(i, 43)) * 4 / Z;
            g.fillStyle = rgba(i % 3 ? '#ffb070' : '#c8a0d0', a); g.fillRect(p[0] - L / 2 + 4 * Math.sin(t * 1.3 + i), p[1], L, Math.max(1, 6 / Z));
          }
        }));
        prof(g, 'front', () => { g.imageSmoothingEnabled = false; g.drawImage(arcadeFront7('dusk'), 0, 0, W, H); g.imageSmoothingEnabled = true; });
        // 灯笼：河边一排由远及近一路亮过来，最近那盏正好在“回”字上亮；之后店铺一侧的灯笼按半拍往深处亮
        const lamps = [];
        prof(g, 'lant', () => {
          for (let i = LANT7.length - 1; i >= 0; i--) lamps.push([pj(-1.95, -1.05, LANT7[i]), LANT7[i], tHui - i * 0.075, i * 3]);
          for (let i = LANS7.length - 1; i >= 0; i--) lamps.push([pj(2.25, -1.0, LANS7[i]), LANS7[i], tHui + (i + 1) * per * 0.5, 50 + i * 3]);
          lamps.sort((a, b) => b[1] - a[1]);
          for (const [[x, y], Z, tOn, sd] of lamps) {
            const s7 = 0.62 * 4 / Z * 1.75, lit = smooth(clamp((lt - tOn) / 0.12)), pop = lt > tOn ? Math.exp(-(lt - tOn) / 0.25) : 0;
            E.lantern(g, { x, y, s: s7, t, seed: sd, lit, swing: 0.06, cord: 10, color: '#c8302a', glowColor: '#ffa040' });
            if (lit > 0.01) add(g, () => {
              glow(g, x, y + 22 * s7, 60 * s7 * (1 + 0.5 * pop), '#ffb050', 0.32 * lit + 0.35 * pop);
              // 地上一圈暖光、河里一竖道碎光
              const fp = pj(Z > 3.5 && sd >= 50 ? 1.9 : -1.6, 1.6, Z);
              glow(g, fp[0], fp[1], 90 * 4 / Z, '#ff9a48', 0.14 * lit);
              if (sd < 50) { const ry = pj(-2.6, 2.4, Z)[1] + 1.2 * F7 / Z * 0.35; for (let k = 0; k < 3; k++) glow(g, x - 30 / Z * 4 + Math.sin(t * 3 + k * 2 + sd) * 3, ry + k * 7 * 4 / Z, 9 * s7, '#ffa040', 0.2 * lit); }
            });
          }
        });
        // 白发人：沿廊向左前慢慢走出（略微变大，朝镜头来），“回”字前一顿，“回”字上回首望向廊子尽头——往事的方向
        const tStop = tHui - 0.12, turned = lt >= tHui;
        const ws = F.walkSpeed('xiaoyao', 2.4, { stage: 'old', speed: 0.5 });
        const wl = Math.min(Math.max(lt, -0.3), tStop);
        const sF = lerp(2.32, 2.46, clamp((wl + 0.3) / (tStop + 0.3))), fy = lerp(764, 778, clamp((wl + 0.3) / (tStop + 0.3)));
        const fx = 492 - ws * (wl + 0.3);
        const tw = Math.min(t, t - lt + tStop);
        const ant = env(lt, tStop - 0.02, tHui) * (turned ? 0 : 1);
        const settle = turned ? Math.exp(-(lt - tHui) / 0.5) : 0;
        const base = { stage: 'old', facing: -1, prop: 'none', ink: '#1e1618', whiteHair: true, rim: '#ffc27a', rimWidth: 1.15, rimAlpha: 0.85, light: [VP7[0] + 60, VP7[1] - 40], seed: 4 };
        const o = turned
          ? Object.assign({}, base, { pose: 'lookBack', windDir: -1, wind: 0.2 + 0.4 * settle, lean: 0.012 * Math.sin(t * 1.6), head: -0.06 * settle })
          : Object.assign({}, base, { pose: lt < tStop ? 'walk' : 'stand', speed: 0.5, windDir: 1, wind: 0.25, lean: 0.05 * ant });
        const P = F.points('xiaoyao', fx, fy, sF, turned || lt >= tStop ? t : tw, o);
        prof(g, 'fig', () => {
          g.fillStyle = 'rgba(14,6,10,0.45)'; g.beginPath(); g.ellipse(fx - 40, fy + 4, 90, 9, 0, 0, TAU); g.fill();
          F.draw(g, 'xiaoyao', fx, fy, sF, turned || lt >= tStop ? t : tw, o);
          // 白发与蓝发带：回首时滞后约 200ms 向外甩出，再慢慢落回
          const SXo = sF * F.height('xiaoyao', { stage: 'old' }) / 180;
          const whip = (tau) => { const u = tau - tHui; return u <= 0 ? 0 : Math.sin(PI * clamp(u / 0.6)) * Math.exp(-Math.max(0, u - 0.35) * 2); };
          const nape = headPt(P, SXo, -1, -9, 1, turned ? -1 : 1);
          for (let k = 0; k < 8; k++) {
            const isRib = k >= 6, L = (isRib ? 54 : 44 + 30 * h2(k, 41)) * sF / 2.4, lag = 0.18 + 0.06 * h2(k, 44);
            const pts = [];
            for (let j = 0; j <= 7; j++) {
              const u = j / 7, tau = t - lag * u, w = whip(tau), fd = tau >= tHui ? 1 : -1;
              const a = PI / 2 + fd * (0.35 + 0.06 * k + 0.9 * w) + 0.07 * Math.sin(t * 2.2 + k + u * 3);
              pts.push([nape[0] + Math.cos(a) * L * u + (k - 3.5) * 0.8 * sF * (1 - u * 0.5), nape[1] + Math.sin(a) * L * u]);
            }
            const w0 = isRib ? 2.2 : 0.9 + 0.5 * h2(k, 43), top = [], bot = [];
            for (let j = 0; j <= 7; j++) {
              const p0 = pts[Math.max(0, j - 1)], p1 = pts[Math.min(7, j + 1)];
              let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
              const ww = w0 * Math.sin(PI * (0.15 + 0.85 * j / 7)) * sF / 2.4;
              top.push([pts[j][0] + nx * ww, pts[j][1] + ny * ww]); bot.push([pts[j][0] - nx * ww, pts[j][1] - ny * ww]);
            }
            g.fillStyle = isRib ? 'rgba(84,124,186,0.92)' : rgba('#f2eee8', 0.6);
            g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = 7; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); g.fill();
          }
          // 回首后的侧脸：逆光里的暗脸，迎光一侧一道暖金轮廓（眉骨、鼻、唇、下巴）
          if (turned) {
            gongbiFace(g, P, SXo, -1, { look: -1, paint: true, skin: '#3e2824', hair: '#e2ded6', warm: '#ff9a60', shade: '#1e1214', lineCol: '#ffc070', rim: '#ffcf86', rimW: 0.6, eye: 0.55, smile: 0.05, featA: 0.75, lips: '#8a4a3a' });
            // 最近那盏灯笼摇过来，光在他脸上一明一暗
            const sw = 0.5 + 0.5 * Math.sin(t * 2.1 + 1);
            add(g, () => { glow(g, P.head[0] + 12 * sF, P.head[1], 70 * sF / 2.4, '#ffc880', (0.4 + 0.25 * sw) * (0.6 + 0.4 * settle)); glow(g, P.head[0] + 9 * sF, P.head[1] + 2, 16 * sF / 2.4, '#fff0d0', 0.4 * settle); });
          }
        });
        // 暮色里的浮尘
        prof(g, 'dust', () => add(g, () => {
          for (let i = 0; i < 20; i++) {
            const x = 380 + h2(i, 11) * 700 + 20 * Math.sin(t * 0.3 + i), y = 160 + h2(i, 12) * 420 + 14 * Math.sin(t * 0.4 + i * 2);
            glow(g, x, y, 2 + 3 * h2(i, 13), '#ffd0a0', (0.2 + 0.25 * be) * (0.6 + 0.4 * Math.sin(t * 1.5 + i)));
          }
        }));
      } else {
        // ---------- 往事：晴天正午的同一条街，工笔重彩 ----------
        const u = lt - tWang;
        prof(g, 'mem', () => {
          g.imageSmoothingEnabled = false; g.drawImage(arcadeBack7('noon'), 0, 0, W, H); g.imageSmoothingEnabled = true;
          // 河里一条乌篷船慢慢划过（在廊柱后面）
          const bz = 11, bp = pj(-7, 2.4, bz), bx = bp[0] + u * 30, by = bp[1];
          A.boat(g, bx, by, 0.42, '#3a2a22');
          g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(bx + 3, by - 10, 25, 10, 0, PI, TAU); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx - 60, by + 5); g.lineTo(bx + 60, by + 5); g.stroke();
          g.imageSmoothingEnabled = false; g.drawImage(arcadeFront7('noon'), 0, 0, W, H); g.imageSmoothingEnabled = true;
          // 廊下的彩旗
          for (let i = 0; i < 3; i++) {
            const Z = 3.6 + i * 3, a = pj(-2.1, -1.1, Z), b = pj(2.5, -1.1, Z + 1.2);
            g.strokeStyle = 'rgba(60,40,30,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 40 / Z * 4, b[0], b[1]); g.stroke();
            for (let k = 1; k < 9; k++) {
              const v = k / 9, x = lerp(a[0], b[0], v), y = lerp(a[1], b[1], v) + Math.sin(PI * v) * 40 / Z * 4, sz = 22 / Z * 4;
              g.fillStyle = ['#d8322a', '#f0c040', '#2f7ab8', '#3a9a6a'][(k + i) % 4];
              poly(g, [[x - sz * 0.4, y], [x + sz * 0.4, y], [x + 1.5 * Math.sin(t * 4 + k), y + sz]]); g.fill();
              g.strokeStyle = 'rgba(40,24,16,0.6)'; g.lineWidth = 0.6; g.stroke();
            }
          }
        });
        prof(g, 'crowd', () => {
          const q = g;
          // 包子摊：一张矮桌、几摞蒸笼、一团团热气；摊主
          const st = pj(1.95, 1.6, 6.2), ss = 4 / 6.2 * 1.3;
          q.fillStyle = '#7a4a2a'; q.fillRect(st[0] - 60 * ss, st[1] - 54 * ss, 120 * ss, 10 * ss); q.fillRect(st[0] - 52 * ss, st[1] - 44 * ss, 8 * ss, 44 * ss); q.fillRect(st[0] + 44 * ss, st[1] - 44 * ss, 8 * ss, 44 * ss);
          q.strokeStyle = 'rgba(40,24,16,0.85)'; q.lineWidth = 1; q.strokeRect(st[0] - 60 * ss, st[1] - 54 * ss, 120 * ss, 10 * ss);
          for (let k = 0; k < 3; k++) steamer(q, st[0] - 34 * ss + k * 34 * ss, st[1] - 54 * ss, ss * 0.75);
          tinyWalker(q, st[0] + 70 * ss, st[1], 1.7 * F7 / 6.6 / 172 * 1.7, 0, -1, '#c84a30', false, 0);
          // 远景人群（简笔）
          const far = [[24, -0.8, 1, '#3a7ab0', 1], [21, 1.2, -1, '#c8502a', 0], [18, 0.2, 1, '#5a8a50', 1], [16, -1.2, -1, '#d8a040', 0], [14, 1.6, -1, '#8a4a8a', 1], [13, -0.4, 1, '#3a6a9a', 0], [12, 0.9, 1, '#b84030', 1], [11, -1.4, -1, '#4a8a7a', 0], [9.4, 1.1, -1, '#3a7ac0', 1]];
          for (const [Z, X, f, col, hat] of far) {
            const [x, y] = pj(X, 1.6, Z), sc = 1.7 * F7 / Z / 172;
            tinyWalker(q, x + f * (u + 0.4) * 40 / Z * 4, y, sc * 1.7, t, f, col, hat, Z);
          }
          // 中近景：几个路人（工具包人物）——每人单独画一层，按各自的颜色提亮（工笔重彩的衣色，不是墨团）
          const mid = [[7.6, -0.9, 1, 0, '#c84a30'], [5.4, 0.6, -1, 1, '#3a9a6a'], [4.0, 1.5, -1, 3, '#d8a040'], [3.1, -0.3, 1, 2, '#9a4a8a']];
          const lift = (O, y, hgt, acc, a0) => {
            O.q.globalCompositeOperation = 'source-atop';
            O.q.fillStyle = K.lin(O.q, 0, y - hgt, 0, y, [[0, rgba('#f0d8b8', 0.35 * a0)], [0.35, rgba(acc, 0.5 * a0)], [1, rgba(acc, 0.25 * a0)]]); O.q.fillRect(O.x0, O.y0, O.lw, O.lh);
            O.q.globalCompositeOperation = 'source-over';
            g.imageSmoothingEnabled = false; blit(g, O, 0, 0, 1); g.imageSmoothingEnabled = true;
          };
          let youthDrawn = false;
          const youth = () => {
            // 少年店小二：把一摞冒热气的笼屉举过头顶，在人群里钻来钻去；“事”字上回头一笑
            const Z = 2.3, s0 = (1.72 * F7) / Z / 176, [x0, y0] = pj(-1.2, 1.6, Z);
            const hb = c.grid && c.b ? Math.exp(-Math.max(0, t - c.grid.time(c.b.i) - (c.b.ph > 0.5 ? per * 0.5 : 0)) / 0.12) : 0;
            const glance = lt >= tShi;
            const x = x0 - 70 + u * 150 + 12 * Math.sin(u * 7), y = y0 + 8 * hb;
            const yo = { stage: 'youth', pose: glance ? 'lookBack' : 'walk', facing: 1, wind: 0.3, seed: 8, speed: 1.4, part: 'back', lean: glance ? 0 : 0.06 };
            const Q = F.points('xiaoyao', x, y, s0, t, yo), hgt = 176 * s0;
            const O = scr('va7_boy', x - hgt * 0.55, y - hgt * 1.12, x + hgt * 0.6, y + 6, 1), b = O.q;
            F.draw(b, 'xiaoyao', x, y, s0, t, yo);
            // 举笼屉的胳膊（自己画，接在肩上）
            const sh = Q.shoulderN, hd = [sh[0] + 10 * s0, sh[1] - 62 * s0], el = [sh[0] + 22 * s0, sh[1] - 28 * s0];
            b.lineCap = 'round'; b.strokeStyle = '#5c4e3e'; b.lineWidth = 12 * s0; b.beginPath(); b.moveTo(sh[0], sh[1]); b.lineTo(el[0], el[1]); b.stroke();
            b.strokeStyle = '#d8a882'; b.lineWidth = 8 * s0; b.beginPath(); b.moveTo(el[0], el[1]); b.lineTo(hd[0], hd[1]); b.stroke();
            b.fillStyle = '#d8a882'; b.beginPath(); b.ellipse(hd[0], hd[1] - 2 * s0, 6 * s0, 4 * s0, 0, 0, TAU); b.fill();
            lift(O, y, hgt, '#b08a5a', 0.6);
            steamer(q, hd[0], hd[1] - 4 * s0, s0 * 0.82);
            gongbiFace(q, Q, s0 * F.height('xiaoyao', { stage: 'youth' }) / 180, 1, { look: glance ? -1 : 1, paint: true, skin: '#eecaa8', hair: '#2a1e18', eye: glance ? 0.2 : 0.8, smile: glance ? 1 : 0.4, blush: 0.4 });
            return [hd[0], hd[1] - 30 * s0, s0];
          };
          let steamAt = null;
          for (const [Z, X, f, v, acc] of mid) {
            if (!youthDrawn && Z < 2.6) { steamAt = prof(g, 'boy', youth); youthDrawn = true; }
            const s0 = (1.7 * F7) / Z / 172, [x, y] = pj(X, 1.6, Z);
            const vx = f * F.walkSpeed('villager', s0, { speed: 0.7 });
            const hgt = 180 * s0, bx = x + vx * (u + 0.5) * 0.7, O = scr('va7_one', bx - hgt * 0.6, y - hgt * 1.15, bx + hgt * 0.6, y + 6, 1);
            prof(g, 'vill', () => { F.draw(O.q, 'villager', bx, y, s0, t, { pose: 'walk', facing: f, seed: Z * 7, variant: v, wind: 0.2, speed: 0.7, accent: acc }); lift(O, y, hgt, acc, 1); });
          }
          if (!youthDrawn) steamAt = prof(g, 'boy', youth);
          // 热气：摊上和他头顶的笼屉
          prof(g, 'steam', () => {
            const puffs = [[st[0], st[1] - 70 * ss, ss * 0.85], [steamAt[0], steamAt[1] + 10 * steamAt[2], steamAt[2] * 0.62]];
            for (const [sx, sy, k] of puffs) for (let j = 0; j < 5; j++) {
              const v = ((t * 0.9 + j / 5) % 1), px = sx + Math.sin(t * 2 + j) * 6 * k - v * 30 * k, py = sy - v * 110 * k;
              if (j % 2 === 0) glow(g, px + 4, py + 5, (14 + v * 30) * k, '#8a8c96', 0.3 * Math.sin(v * PI));
              glow(g, px, py, (12 + v * 28) * k, '#ffffff', 0.75 * Math.sin(v * PI));
            }
          });
        });
        prof(g, 'memfx', () => {
          // 硬切进来的一下亮
          const fl = Math.exp(-u / 0.07);
          if (fl > 0.02) { g.fillStyle = rgba('#fff8e8', 0.5 * fl); g.fillRect(0, 0, W, H); }
        });
      }
    },
  });


  // ======================================================================
  // 8 枫落成忆：客栈后院白墙月洞窗下的小池，日落；四片红叶踩着“枫、一、片、落”落进水里，涟漪里倒映出旧人旧物
  // ======================================================================
  const HZ8 = 336;                       // 池子远岸
  const LEAFC = [['#e0402a', '#a81c16', '#ffb070'], ['#ec6a2a', '#b8401a', '#ffd08a'], ['#d42a24', '#8a1012', '#ff9a70'], ['#f0902c', '#c0601a', '#ffe0a0']];
  // 一片枫叶（七裂掌状、带锯齿），叶柄朝下；叶脉与透光的亮边
  function leafTex(k) {
    return cache('va8_leaf2_' + k, 64, 64, 1.5, (q) => {
      const [c0, c1, hi] = LEAFC[k % 4];
      q.translate(32, 38);
      const lobes = [[-PI / 2, 27], [-PI / 2 - 0.66, 23], [-PI / 2 + 0.66, 23], [-PI / 2 - 1.3, 17], [-PI / 2 + 1.3, 17], [-PI / 2 - 2.0, 9], [-PI / 2 + 2.0, 9]].sort((a, b) => a[0] - b[0]);
      const pts = [];
      for (const [a, L] of lobes) {
        pts.push([Math.cos(a - 0.26) * L * 0.38, Math.sin(a - 0.26) * L * 0.38]);
        // 每裂两侧各一个小锯齿
        pts.push([Math.cos(a - 0.12) * L * 0.72, Math.sin(a - 0.12) * L * 0.72]);
        pts.push([Math.cos(a - 0.07) * L * 0.7, Math.sin(a - 0.07) * L * 0.7]);
        pts.push([Math.cos(a) * L, Math.sin(a) * L]);
        pts.push([Math.cos(a + 0.07) * L * 0.7, Math.sin(a + 0.07) * L * 0.7]);
        pts.push([Math.cos(a + 0.12) * L * 0.72, Math.sin(a + 0.12) * L * 0.72]);
      }
      pts.push([0, 3]);
      q.beginPath(); pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath();
      q.fillStyle = K.rad(q, 0, -6, 2, 28, [[0, hi], [0.5, c0], [1, c1]]); q.fill();
      q.strokeStyle = rgba(hi, 0.55); q.lineWidth = 0.9; q.stroke();
      q.strokeStyle = rgba('#5a1008', 0.45); q.lineWidth = 0.7;
      for (const [a, L] of lobes) { q.beginPath(); q.moveTo(0, 0); q.lineTo(Math.cos(a) * L * 0.85, Math.sin(a) * L * 0.85); q.stroke(); }
      q.strokeStyle = '#5a2010'; q.lineWidth = 1.1; q.beginPath(); q.moveTo(0, 0); q.quadraticCurveTo(2, 12, 0, 22); q.stroke();
    });
  }
  // 背景：日落的天（太阳正落在墙头）、客栈后院的白墙黛瓦与月洞窗、左边客栈的后檐、参差的池岸、映着天光的池水（一张）
  function va8Bg() {
    return cache('va8_bg5', W, H, 1, (q) => {
      const r = A.rng(83);
      // 天：上紫灰，下暖金
      q.fillStyle = K.lin(q, 0, 0, 0, 330, [[0, '#463a56'], [0.35, '#7c6280'], [0.62, '#c0928c'], [0.84, '#e6c49c'], [1, '#eedeb0']]); q.fillRect(0, 0, W, 340);
      q.fillStyle = K.rad(q, 1010, 200, 10, 420, [[0, 'rgba(255,244,214,0.95)'], [0.18, 'rgba(255,214,160,0.6)'], [0.6, 'rgba(240,170,130,0.15)'], [1, 'rgba(240,170,130,0)']]); q.fillRect(0, 0, W, 340);
      q.fillStyle = '#fff4da'; q.beginPath(); q.arc(1010, 200, 30, 0, TAU); q.fill();
      // 墙外远树：几团淡紫灰
      const far = E.util.cached('g03:va8_fartree', [], W, 260, 0.2, (b) => {
        const rr = A.rng(84);
        for (let i = 0; i < 14; i++) { b.fillStyle = rgba(i % 3 ? '#6e5a74' : '#806478', 0.55); A.inkBlob(b, 300 + i * 72 + rr() * 40, 200 + rr() * 30, 40 + rr() * 36, i + 3, 0.42); b.fill(); }
      });
      q.drawImage(far, 0, 0, W, 260);
      // 白墙黛瓦：墙头瓦檐、墙面逆光（偏紫灰），雨痕
      const wy = 222, wb = 334;
      q.fillStyle = K.lin(q, 300, 0, 1280, 0, [[0, '#8a7e92'], [0.6, '#a89aac'], [1, '#9a8ea2']]); q.fillRect(300, wy, 980, wb - wy);
      q.fillStyle = K.rad(q, 1010, 230, 10, 300, [[0, 'rgba(255,220,180,0.35)'], [1, 'rgba(255,220,180,0)']]); q.fillRect(300, wy, 980, wb - wy);
      for (let i = 0; i < 40; i++) { const x = 310 + r() * 960; q.strokeStyle = rgba('#5a4e66', 0.12 + 0.12 * r()); q.lineWidth = 1 + r() * 2; q.beginPath(); q.moveTo(x, wy + 10); q.lineTo(x + (r() - 0.5) * 4, wy + 20 + r() * 60); q.stroke(); }
      q.fillStyle = '#2e2836'; q.beginPath(); q.moveTo(292, wy + 4); q.lineTo(300, wy - 10); q.lineTo(1290, wy - 10); q.lineTo(1290, wy + 6); q.closePath(); q.fill();
      q.fillStyle = '#3e3648'; for (let x = 300; x < 1290; x += 13) { q.beginPath(); q.ellipse(x, wy - 9, 6, 3, 0, PI, TAU); q.fill(); }
      q.strokeStyle = 'rgba(255,214,170,0.5)'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(300, wy - 11); q.lineTo(1290, wy - 11); q.stroke();
      q.fillStyle = 'rgba(30,24,36,0.35)'; q.fillRect(300, wy + 4, 980, 7);
      // 月洞窗：里面透出落日的暖光与几竿竹影
      const mx = 760, my = 276, mr = 40;
      q.save(); q.beginPath(); q.arc(mx, my, mr, 0, TAU); q.clip();
      q.fillStyle = K.rad(q, mx + 20, my - 10, 4, mr * 1.6, [[0, '#fff0c8'], [0.5, '#f0b878'], [1, '#c07a5a']]); q.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      q.strokeStyle = 'rgba(60,44,50,0.7)'; q.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const x = mx - 22 + k * 18; q.lineWidth = 2.4; q.beginPath(); q.moveTo(x, my + mr); q.quadraticCurveTo(x + 6, my, x + 4, my - mr); q.stroke(); for (let j = 0; j < 3; j++) { q.lineWidth = 3; q.beginPath(); q.moveTo(x + 3, my - 20 + j * 14); q.lineTo(x + 16, my - 26 + j * 14); q.stroke(); } }
      q.restore();
      q.strokeStyle = '#c8bcc8'; q.lineWidth = 6; q.beginPath(); q.arc(mx, my, mr + 3, 0, TAU); q.stroke();
      q.strokeStyle = 'rgba(60,50,70,0.6)'; q.lineWidth = 1.5; q.beginPath(); q.arc(mx, my, mr + 6.5, 0, TAU); q.stroke();
      // 左边：客栈的后檐与暗木墙（字在这里，压暗），一扇亮着的小窗
      q.fillStyle = '#241a20'; q.fillRect(-10, 180, 330, 170);
      q.fillStyle = '#ffcf8e'; q.fillRect(238, 236, 52, 46); A.softBlob(q, 264, 259, 70, 0.5, '#ffb060');
      q.strokeStyle = '#2a1a16'; q.lineWidth = 3; for (let k = 1; k < 4; k++) { q.beginPath(); q.moveTo(238 + k * 13, 236); q.lineTo(238 + k * 13, 282); q.stroke(); } q.beginPath(); q.moveTo(238, 259); q.lineTo(290, 259); q.stroke();
      q.fillStyle = '#16101a';
      q.beginPath(); q.moveTo(-20, 92); q.lineTo(300, 160); q.quadraticCurveTo(380, 176, 436, 166); q.quadraticCurveTo(410, 190, 330, 196); q.lineTo(-20, 196); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(255,190,140,0.45)'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(300, 160); q.quadraticCurveTo(380, 176, 436, 166); q.stroke();
      for (let x = 0; x < 300; x += 16) { q.fillStyle = '#221a24'; q.beginPath(); q.ellipse(x, 194 + x * 0.005, 7, 4, 0, 0, PI); q.fill(); }
      // 池水：映着天，远岸处最亮（倒映墙与落日），越近越沉成青灰
      q.fillStyle = K.lin(q, 0, HZ8, 0, H, [[0, '#d8ccae'], [0.12, '#b4bca8'], [0.42, '#88ada6'], [0.8, '#5a7c7a'], [1, '#3a5658']]); q.fillRect(0, HZ8 - 6, W, H - HZ8 + 6);
      // 墙在水里的倒影：贴着岸，往下渐渐淡没；左端也渐隐（不留硬边）
      const refl = K.lin(q, 0, HZ8, 0, HZ8 + 100, [[0, 'rgba(150,140,164,0.42)'], [0.55, 'rgba(150,140,164,0.16)'], [1, 'rgba(150,140,164,0)']]);
      q.fillStyle = refl; q.fillRect(380, HZ8, 900, 100);
      for (let k = 0; k < 8; k++) { q.globalAlpha = (k + 1) / 9; q.fillRect(300 + k * 10, HZ8, 10, 100); }
      q.globalAlpha = 1;
      q.fillStyle = K.lin(q, 0, HZ8, 0, HZ8 + 80, [[0, 'rgba(30,22,28,0.5)'], [1, 'rgba(30,22,28,0)']]); q.fillRect(-10, HZ8, 330, 80);
      q.save(); q.translate(1010, HZ8 + 8); q.scale(1, 2.6);
      q.fillStyle = K.rad(q, 0, 0, 2, 110, [[0, 'rgba(255,236,190,0.6)'], [1, 'rgba(255,220,170,0)']]); q.fillRect(-120, -10, 240, 140); q.restore();
      A.softBlob(q, mx, HZ8 + (HZ8 - my) * 0.7, 46, 0.45, '#ffd8a0');
      // 左边的池水也压暗（字的底）
      q.fillStyle = K.lin(q, 0, 0, 420, 0, [[0, 'rgba(20,24,30,0.55)'], [1, 'rgba(20,24,30,0)']]); q.fillRect(0, HZ8 - 8, 420, H - HZ8 + 8);
      // 参差的池岸：石块、草丛，高低不一（不再是一条直线）
      const bank = [];
      for (let x = -20; x <= W + 20; x += 20) bank.push([x, HZ8 - 4 + 10 * (noise1(x * 0.012, 7) - 0.5) + 6 * (noise1(x * 0.05, 8) - 0.5)]);
      q.fillStyle = '#2a2430'; q.beginPath(); q.moveTo(-20, wb - 2); bank.forEach(([x, y]) => q.lineTo(x, y)); q.lineTo(W + 20, wb - 2); q.closePath(); q.fill();
      q.strokeStyle = 'rgba(30,24,30,0.5)'; q.lineWidth = 2; line(q, bank.map(([x, y]) => [x, y + 4])); q.stroke();
      for (let i = 0; i < 16; i++) {
        const x = 300 + r() * 980, y = HZ8 - 2 + (r() - 0.5) * 8, w = 14 + r() * 30, h = 7 + r() * 12;
        q.fillStyle = K.lin(q, 0, y - h, 0, y, [[0, '#7a6e7e'], [1, '#2e2834']]); q.beginPath(); q.ellipse(x, y, w, h, 0, PI, TAU); q.lineTo(x - w, y); q.fill();
        q.strokeStyle = 'rgba(255,214,170,0.4)'; q.lineWidth = 1; q.beginPath(); q.ellipse(x, y, w, h, 0, PI * 1.15, PI * 1.6); q.stroke();
        q.fillStyle = 'rgba(40,30,40,0.4)'; q.beginPath(); q.ellipse(x, y + h * 0.5, w * 0.9, h * 0.35, 0, 0, TAU); q.fill();
      }
      // 太湖石（右）
      q.fillStyle = K.lin(q, 1140, 250, 1210, 340, [[0, '#9a8e9e'], [1, '#3e3446']]);
      q.beginPath(); q.moveTo(1120, 342); q.quadraticCurveTo(1106, 300, 1130, 284); q.quadraticCurveTo(1150, 254, 1176, 270); q.quadraticCurveTo(1208, 262, 1212, 300); q.quadraticCurveTo(1226, 330, 1214, 344); q.closePath(); q.fill();
      q.fillStyle = 'rgba(30,24,36,0.6)'; q.beginPath(); q.ellipse(1168, 300, 9, 6, 0.4, 0, TAU); q.fill(); q.beginPath(); q.ellipse(1192, 320, 6, 4, 0, 0, TAU); q.fill();
      for (let cl = 0; cl < 20; cl++) {
        const cx = r() * W, n = 4 + Math.floor(r() * 8), hh = 8 + r() * 24, by = HZ8 - 2 + (r() - 0.5) * 8;
        for (let i = 0; i < n; i++) {
          const x = cx + (r() - 0.5) * 26, h = hh * (0.5 + r() * 0.6), lean = (r() - 0.4) * 12;
          q.strokeStyle = rgba(r() < 0.3 ? '#4a4a3a' : '#221c22', 0.7 + r() * 0.3); q.lineWidth = 0.8 + r() * 1.2;
          q.beginPath(); q.moveTo(x, by + 2); q.quadraticCurveTo(x + lean * 0.3, by - h * 0.6, x + lean, by - h); q.stroke();
        }
      }
      // 岸在水里的倒影：一线柔暗
      q.fillStyle = K.lin(q, 0, HZ8 - 2, 0, HZ8 + 16, [[0, 'rgba(30,26,34,0.5)'], [1, 'rgba(30,26,34,0)']]); q.fillRect(0, HZ8 - 2, W, 18);
      // 睡莲叶：几片浮在水上（透视压扁，带缺口）
      for (const [x, y, rr, a0] of [[560, 410, 30, 0.6], [612, 432, 18, 2.2], [1050, 470, 34, 4], [1110, 498, 20, 1], [880, 640, 46, 3.3], [470, 560, 26, 5.1]]) {
        const ry = rr * (0.32 + 0.3 * (y - HZ8) / (H - HZ8));
        q.fillStyle = 'rgba(30,50,40,0.35)'; q.beginPath(); q.ellipse(x + 3, y + 3, rr, ry, 0, 0, TAU); q.fill();
        q.fillStyle = K.lin(q, x - rr, y - ry, x + rr, y + ry, [[0, '#6a8a62'], [1, '#3e6048']]);
        q.beginPath(); q.ellipse(x, y, rr, ry, 0, a0 + 0.25, a0 + TAU - 0.25); q.lineTo(x, y); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(200,220,170,0.55)'; q.lineWidth = 1; q.beginPath(); q.ellipse(x, y, rr, ry, 0, PI * 1.05, PI * 1.6); q.stroke();
        q.strokeStyle = 'rgba(30,50,36,0.5)'; q.lineWidth = 0.6; for (let k = 0; k < 5; k++) { const a = a0 + 0.6 + k * 1.1; q.beginPath(); q.moveTo(x, y); q.lineTo(x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * ry * 0.8); q.stroke(); }
      }
      // 水面的细横纹
      q.strokeStyle = 'rgba(255,250,236,0.14)'; q.lineWidth = 1;
      for (let i = 0; i < 60; i++) { const y = HZ8 + 10 + Math.pow(r(), 1.3) * (H - HZ8), x = r() * W; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 20 + r() * 90, y); q.stroke(); }
    });
  }
  const BR8 = { ox: 1300, oy: 20, x0: 380, y0: -40, w: 920, h: 340 };
  function va8Branch() {
    return cache('va8_branch2', BR8.w, BR8.h, 1, (q) => {
      q.translate(-BR8.x0, -BR8.y0);
      const r = A.rng(89);
      const twigs = [], leaves = [];
      q.lineCap = 'round';
      const grow = (x, y, a, L, w, d) => {
        const x1 = x + Math.cos(a) * L, y1 = y + Math.sin(a) * L;
        twigs.push([x, y, x1, y1, w, a]);
        const n = d < 1 ? 2 : 6 + d * 3;
        for (let k = 0; k < n; k++) { const u = 0.2 + 0.8 * r(); leaves.push([lerp(x, x1, u) + (r() - 0.5) * 50, lerp(y, y1, u) + (r() - 0.2) * 46, d, r()]); }
        if (d < 4) {
          grow(x1, y1, a + 0.28 + r() * 0.35, L * 0.72, w * 0.62, d + 1);
          grow(x1, y1, a - 0.3 - r() * 0.3, L * 0.66, w * 0.58, d + 1);
          if (d < 2) grow(lerp(x, x1, 0.5), lerp(y, y1, 0.5), a + 0.9, L * 0.5, w * 0.5, d + 2);
        }
      };
      grow(BR8.ox, BR8.oy, PI * 0.96, 300, 30, 0);
      for (const [x, y, x1, y1, w] of twigs) {
        q.strokeStyle = '#1e0e10'; q.lineWidth = w;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo((x + x1) / 2, (y + y1) / 2 - w * 0.6, x1, y1); q.stroke();
        q.strokeStyle = 'rgba(255,170,110,0.35)'; q.lineWidth = Math.max(1, w * 0.18);
        q.beginPath(); q.moveTo(x, y - w * 0.35); q.quadraticCurveTo((x + x1) / 2, (y + y1) / 2 - w * 0.95, x1, y1 - w * 0.35); q.stroke();
      }
      leaves.sort((a, b) => a[3] - b[3]);
      for (const [x, y, d, z] of leaves) {
        if (y > BR8.y0 + BR8.h - 34 || y < BR8.y0 + 30 || x < BR8.x0 + 30 || x > BR8.x0 + BR8.w + 10) continue;
        const k = Math.floor(r() * 4), s = 0.75 + 0.6 * z, a = (r() - 0.5) * 1.6 + PI * 0.05;
        q.save(); q.translate(x, y); q.rotate(a); q.scale(s, s * (0.75 + r() * 0.25));
        // 远叶（z 小）压暗，近叶透亮
        q.globalAlpha = 0.85 + 0.15 * z;
        q.drawImage(leafTex(k), -32, -38, 64, 64);
        if (z < 0.45) { q.globalCompositeOperation = 'source-atop'; q.fillStyle = rgba('#3a0e10', 0.5 * (1 - z / 0.45)); q.fillRect(-34, -40, 68, 68); q.globalCompositeOperation = 'source-over'; }
        q.restore();
      }
      q.globalAlpha = 1;
    });
  }
  // 四片主角叶：从枝上落下、翻转、正好在字上落水
  const HERO8 = [
    { k: 2, from: [700, 205], at: [600, 474], dur: 1.75, ci: 2, mem: 'yueru' },
    { k: 0, from: [905, 175], at: [862, 420], dur: 1.6, ci: 4, mem: 'gourd' },
    { k: 3, from: [585, 225], at: [712, 572], dur: 1.75, ci: 6, mem: 'butterfly' },
    { k: 1, from: [1010, 205], at: [930, 626], dur: 1.85, ci: 7, mem: 'linger' },
  ];
  function leafAt(L, tt, tLand) {
    const u = clamp((tt - (tLand - L.dur)) / L.dur);
    const fall = u < 1 ? u * u * (3 - 2 * u) * 0.25 + u * 0.75 : 1;
    const sway = Math.sin(u * PI * 2.6 + L.k) * 46 * (1 - u) * Math.sin(PI * Math.min(1, u * 1.4));
    const x = lerp(L.from[0], L.at[0], fall) + sway, y = lerp(L.from[1], L.at[1], fall);
    const rot = L.k + u * 5 + Math.sin(u * 7) * 0.6, flip = Math.cos(u * PI * 4.4 + L.k);
    return { x, y, rot, flip, u };
  }
  function drawLeaf(g, k, x, y, s, rot, flip, a) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * (Math.abs(flip) < 0.12 ? 0.12 * Math.sign(flip || 1) : flip), s);
    g.globalAlpha = a; g.drawImage(leafTex(k), -32, -36, 64, 64); g.globalAlpha = 1;
    g.restore();
  }
  // 涟漪里的回忆剪影（淡、0.35）
  // 黄蝶：前后翅、翅脉、翅缘墨点，扇动时横向缩放
  function butterfly8(g, x, y, s, t) {
    const k = 0.25 + 0.75 * Math.abs(Math.cos(t * 11));
    g.save(); g.translate(x, y); g.rotate(-0.25 + 0.15 * Math.sin(t * 2)); g.scale(s, s);
    for (const side of [-1, 1]) {
      g.save(); g.scale(side * k, 1);
      g.fillStyle = K.lin(g, 0, -12, 16, 4, [[0, '#fff2a0'], [0.6, '#f6c83a'], [1, '#c87a1a']]);
      g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(4, -16, 18, -18, 19, -8); g.bezierCurveTo(19, -2, 10, 1, 0, 1); g.fill();
      g.beginPath(); g.moveTo(0, 1); g.bezierCurveTo(10, 2, 15, 8, 11, 14); g.bezierCurveTo(7, 17, 2, 10, 0, 3); g.fill();
      g.strokeStyle = 'rgba(90,50,10,0.55)'; g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(16, -12); g.moveTo(0, 0); g.lineTo(18, -6); g.moveTo(0, 2); g.lineTo(11, 12); g.stroke();
      g.fillStyle = 'rgba(60,30,10,0.7)'; for (const [px, py] of [[17, -12], [18.5, -7], [12, 12]]) { g.beginPath(); g.arc(px, py, 1, 0, TAU); g.fill(); }
      g.restore();
    }
    g.fillStyle = '#4a2a10'; g.beginPath(); g.ellipse(0, 1, 1.1, 6, 0, 0, TAU); g.fill();
    g.strokeStyle = '#4a2a10'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(-2, -10, -4, -12); g.moveTo(0, -5); g.quadraticCurveTo(2, -10, 4, -12); g.stroke();
    g.restore();
  }
  // 涟漪里的回忆：每样先画成一张小贴图（统一的淡象牙色调，各留一点自己的颜色），落水时倒着映在涟漪圈里，随水纹一片片错开
  const MEM8 = { yueru: '#e0503a', gourd: '#e0a040', butterfly: '#f2c83a', linger: '#b8a0e8' };
  function memTex(kind) {
    return cache('va8_mem2_' + kind, 170, 200, 1.5, (q) => {
      const x = 85, fy = 188, t = 10.3;
      if (kind === 'yueru') F.draw(q, 'yueru', x + 18, fy, 0.6, t, { pose: 'swordPoint', facing: -1, wind: 0.6 });
      else if (kind === 'linger') F.draw(q, 'linger', x - 4, fy, 0.66, t, { pose: 'lookBack', facing: 1, wind: 0.7 });
      else if (kind === 'gourd') {
        // 酒剑仙的一截宽袖与手，提着葫芦的红绳
        q.fillStyle = '#7a7268'; q.beginPath(); q.moveTo(20, 0); q.quadraticCurveTo(70, 6, 104, 30); q.lineTo(92, 52); q.quadraticCurveTo(56, 34, 14, 40); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(40,30,24,0.8)'; q.lineWidth = 1; q.stroke();
        q.fillStyle = '#e2c4a4'; q.beginPath(); q.ellipse(100, 48, 8, 6, 0.5, 0, TAU); q.fill();
        q.strokeStyle = '#c8281e'; q.lineWidth = 1.6; q.beginPath(); q.moveTo(100, 52); q.quadraticCurveTo(96, 70, 92, 84); q.stroke();
        E.gourd(q, { x: 90, y: 150, s: 1.15, t, angle: -0.12, cord: true });
      } else butterfly8(q, x, 110, 2.4, 0.37);
      // 统一调成淡象牙色的回忆色，只留一点本色
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = rgba(mix('#f6eee0', MEM8[kind], 0.25), 0.38); q.fillRect(0, 0, 170, 200);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 在涟漪圈里倒映回忆：倒过来、压扁，按横条随水纹错开；圈外裁掉
  function memRefl(g, kind, x, y, R, d, a, t) {
    if (a <= 0.01) return;
    const tex = memTex(kind), kk = tex.width / 170, sc = 1.2, sq = 0.66, n = 8, sh = 200 / n;
    g.save();
    g.beginPath(); g.ellipse(x, y + R * 0.18, R, R * 0.66, 0, 0, TAU); g.clip();
    // 涟漪圈里水面被搅开，透出深一层的青，回忆浮在里面
    g.fillStyle = K.rad(g, x, y + R * 0.25, R * 0.1, R, [[0, rgba('#1e3a40', 0.55 * a)], [0.7, rgba('#2e4e52', 0.35 * a)], [1, rgba('#2e4e52', 0)]]);
    g.fillRect(x - R, y - R, R * 2, R * 2);
    g.translate(x, y - 6); g.scale(sc, -sc * sq);
    g.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      const dx = Math.sin(d * 10 - i * 1.1 + t * 2) * (2.5 + 6 * Math.exp(-d * 2)) * (0.5 + i / n);
      g.drawImage(tex, 0, i * sh * kk, 170 * kk, sh * kk + 1, -85 + dx, i * sh - 188, 170, sh + 0.6);
    }
    g.restore();
    // 一点本色的光
    add(g, () => glow(g, x, y + 30 * sq, R * 0.7, MEM8[kind], 0.18 * a));
  }
  // 额外几片：第一个“片”字上枝头又飘下三四片；镜头末尾再落一片，接下一镜的落叶
  const EXTRA8 = [
    { k: 0, from: [820, 160], to: [760, 760], dur: 2.6, at: 0, ci: 5 },
    { k: 3, from: [960, 120], to: [1010, 760], dur: 2.9, at: 0.08, ci: 5 },
    { k: 2, from: [690, 190], to: [560, 760], dur: 2.5, at: 0.17, ci: 5 },
    { k: 1, from: [1120, 90], to: [1180, 700], dur: 3.1, at: 0.26, ci: 5 },
    { k: 2, from: [880, 200], to: [800, 900], dur: 2.6, at: 0, ci: 7, late: 0.62 },
  ];

  XYT.registerShot('va8_maple', {
    name: '枫落成忆', zone: 'left', night: true, text: '#f4ecdc', shadow: 'rgba(30,16,20,0.95)', accent: '#ff6a4a', bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tl = HERO8.map((L, i) => charAt(c, L.ci, [0.98, 1.96, 2.6, 3.06][i]));
      const tPian = charAt(c, 5, 2.24), tSeal = charAt(c, 7, 3.06) + 0.27;
      const be = c.be ? c.be(0.3) : 0;
      const wind = 0.5 + 0.5 * Math.sin(t * 0.8);
      prof(g, 'bg', () => { g.imageSmoothingEnabled = false; g.drawImage(va8Bg(), 0, 0, W, H); g.imageSmoothingEnabled = true; });
      // 枝的倒影：水面上一片暗红的“花边”，分成横条按正弦错开，像水面轻晃
      const sw = 0.012 * Math.sin(t * 1.1) + 0.008 * wind;
      prof(g, 'refl', () => {
        const lo = E.util.cached('g03:va8_brlo', [], BR8.w, BR8.h, 0.3, (q) => q.drawImage(va8Branch(), 0, 0, BR8.w, BR8.h));
        const n = 6, sh = BR8.h / n;
        g.save(); g.globalAlpha = 0.42;
        g.translate(BR8.ox, 2 * HZ8 + 30 - BR8.oy); g.scale(1, -0.9); g.rotate(-sw);
        for (let i = 0; i < n; i++) {
          const dx = 7 * Math.sin(t * 1.6 + i * 0.9) * (0.4 + i / n);
          g.drawImage(lo, 0, i * sh * lo.height / BR8.h, lo.width, sh * lo.height / BR8.h, BR8.x0 - BR8.ox + dx, BR8.y0 - BR8.oy + i * sh, BR8.w, sh + 0.5);
        }
        g.restore(); g.globalAlpha = 1;
      });
      // 已经漂在水上的几片旧叶
      prof(g, 'float', () => {
        for (let i = 0; i < 5; i++) {
          const x = 380 + h2(i, 51) * 860 + lt * (5 + 4 * h2(i, 52)), y = HZ8 + 40 + h2(i, 53) * 320, sc = 0.45 + 0.8 * (y - HZ8) / (H - HZ8);
          g.save(); g.translate(x, y + 1.5 * Math.sin(t * 1.3 + i)); g.scale(1, 0.4);
          drawLeaf(g, i % 4, 0, 0, sc, h2(i, 54) * TAU + 0.1 * Math.sin(t + i), 1, 0.75);
          g.restore();
        }
      });
      // 落水：涟漪圈，圈里倒映回忆
      prof(g, 'ripple', () => {
        for (let i = 0; i < 4; i++) {
          const L = HERO8[i], T = tl[i], d = lt - T;
          if (d < 0 || d > 3) continue;
          const pk = 0.45 + 0.55 * (L.at[1] - HZ8) / (H - HZ8), ps = 0.6 + 0.4 * pk;
          const Rr = (dd) => (24 + 150 * (1 - Math.exp(-dd / 0.3)) + 60 * dd) * ps, R1 = Rr(d);
          // 回忆显影：0.08 秒浮现，第一圈越过它时淡去；最后一位（灵儿）留得久一些，慢慢淡过盖印
          const last = i === 3, hold = last ? 0.95 : 0.42, fade = last ? 0.9 : 0.28;
          const ma = 0.85 * smooth(clamp(d / 0.08)) * (1 - smooth(clamp((d - hold) / fade)));
          if (ma > 0.005) memRefl(g, L.mem, L.at[0], L.at[1], Math.min(R1, 145 * ps), d, ma, t);
          for (let k = 0; k < 3; k++) {
            const dd = d - k * 0.2; if (dd < 0) continue;
            const R = Rr(dd), a = 0.75 * Math.exp(-dd / 0.85), ry = R * (0.42 + 0.2 * pk);
            g.lineWidth = 2; g.strokeStyle = rgba('#2e4a4a', a * 0.6);
            g.beginPath(); g.ellipse(L.at[0], L.at[1] + 2, R, ry, 0, 0, TAU); g.stroke();
            g.lineWidth = 1.4; g.strokeStyle = rgba('#fff6e0', a);
            g.beginPath(); g.ellipse(L.at[0], L.at[1], R, ry, 0, 0, TAU); g.stroke();
          }
          add(g, () => glow(g, L.at[0], L.at[1], 50 * pk, '#ffe0b0', 0.55 * Math.exp(-d / 0.25)));
        }
      });
      // 枝（绕根部轻摇）：逆着落日，枝是剪影，叶子边上透光
      prof(g, 'branch', () => {
        add(g, () => glow(g, 1010, 200, 200, '#ffd8a0', 0.22 + 0.08 * be));
        g.drawImage(va8Branch(), BR8.x0 + sw * 260, BR8.y0 + sw * 120, BR8.w, BR8.h);
      });
      // 主角叶：下落、翻面、水中倒影迎上来、落水后平躺漂着
      prof(g, 'leaves', () => {
        for (let i = 0; i < 4; i++) {
          const L = HERO8[i], T = tl[i];
          const pk = 0.45 + 0.55 * (L.at[1] - HZ8) / (H - HZ8), s0 = 1.0 + 0.45 * pk;
          if (lt < T) {
            const P = leafAt(L, lt, T);
            if (P.u <= 0) continue;
            const h = L.at[1] - P.y;
            if (h < 260) drawLeaf(g, L.k, P.x, L.at[1] + h * 0.9 * pk, s0 * 0.9, -P.rot, P.flip, 0.45 * (1 - h / 260));
            drawLeaf(g, L.k, P.x, P.y, s0, P.rot, P.flip, 1);
          } else {
            const d = lt - T, bob = Math.sin(d * 5) * Math.exp(-d * 1.5) * 3;
            g.save(); g.translate(L.at[0] + d * 6, L.at[1] + bob - 3 * pk); g.scale(1, 0.42 + 0.3 * Math.exp(-d * 3));
            drawLeaf(g, L.k, 0, 0, s0 * pk * 1.1, L.k + 5 + 0.05 * Math.sin(t), 1, 1);
            g.restore();
          }
        }
        // 第一个“片”字上枝头又飘下几片；末尾再落一片
        for (const X of EXTRA8) {
          const T0 = X.late != null ? tSeal + X.late - 0.3 : tPian + X.at, u = (lt - T0) / X.dur;
          if (u <= 0 || u >= 1) continue;
          const sway = Math.sin(u * PI * 2.4 + X.k) * 50 * Math.sin(PI * Math.min(1, u * 1.3));
          const x = lerp(X.from[0], X.to[0], u) + sway, y = lerp(X.from[1], X.to[1], u * u * 0.4 + u * 0.6);
          drawLeaf(g, X.k, x, y, 0.95, X.k + u * 6, Math.cos(u * PI * 5 + X.k), 1);
        }
      });
      // 夕光里的浮尘
      prof(g, 'dust', () => add(g, () => {
        for (let i = 0; i < 16; i++) {
          const x = 480 + h2(i, 61) * 700 + 24 * Math.sin(t * 0.3 + i), y = 120 + h2(i, 62) * 300 + 14 * Math.sin(t * 0.45 + i * 2);
          glow(g, x, y, 2 + 3 * h2(i, 63), '#ffe8c0', 0.3 + 0.3 * Math.sin(t * 1.4 + i) + 0.2 * be);
        }
      }));
      // 右下角盖一枚“逍遥”小印
      prof(g, 'seal', () => {
        const d = lt - tSeal;
        if (d < 0) return;
        const k = easeOut(clamp(d / 0.16));
        g.save(); g.translate(1170, 628); g.scale(lerp(1.35, 1, k), lerp(1.35, 1, k)); g.rotate(-0.04);
        A.seal(g, 0, 0, 46, '逍遥', 0.92 * k);
        g.restore();
        add(g, () => glow(g, 1170, 628, 70, '#ff6a50', 0.3 * Math.exp(-d / 0.3)));
      });
    },
  });


  // ---------- 空闲时预热本组的静态贴图（结果与不预热完全一样，只是镜头第一帧不卡） ----------
  try {
    const jobs = () => [va5Bg, () => sprigTex(true), () => sprigTex(false), roundelTex, va6Bg, () => STRIP6.forEach(stripTex),
      () => arcadeBack7('dusk'), () => arcadeFront7('dusk'), () => arcadeBack7('noon'), () => arcadeFront7('noon'),
      () => { for (let k = 0; k < 4; k++) leafTex(k); }, va8Bg, va8Branch,
      () => E.util.cached('g03:va8_brlo', [], BR8.w, BR8.h, 0.3, (q) => q.drawImage(va8Branch(), 0, 0, BR8.w, BR8.h))];
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 150);
    let tries = 0;
    const start = () => {
      if (!(XYT.sprites && XYT.sprites.S)) { if (++tries < 120) setTimeout(start, 500); return; }
      const list = jobs(), S0 = XYT.sprites.S;
      const step = () => { if (!list.length || XYT.sprites.S !== S0) return; try { list.shift()(); } catch (e) { /* 预热失败不影响正常绘制 */ } idle(step); };
      idle(step);
    };
    setTimeout(start, 900);
  } catch (e) { /* 没有定时器的环境里跳过预热 */ }
})();
