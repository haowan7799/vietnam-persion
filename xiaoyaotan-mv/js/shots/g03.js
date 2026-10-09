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
    if (o.blush) { g.fillStyle = rgba('#f07888', 0.36 * o.blush); g.beginPath(); g.ellipse(3.6, 2.6, 3, 1.9, 0, 0, TAU); g.fill(); }
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
    pavilion5(q, 900, 330, 170, '#8c9cc6', '#3a4670', '#ffd08a');
    pavilion5(q, 1060, 418, 96, '#9aa6cc', '#4a5680', '#ffd49a');
    // 远树一排（淡、偏紫）
    for (let k = 0; k < 6; k++) peachTree5(q, 300 + k * 170 + r() * 60, 600, 0.55, 40 + k, { trunk: 'rgba(80,72,118,0.55)', dark: '#6a6a9a', cols: ['#d8bcd4', '#cdb4d2', '#e2c6d8'], alpha: 0.75, depth: 4 });
    // 树排之间的冷雾
    q.fillStyle = K.lin(q, 0, 380, 0, 560, [[0, 'rgba(200,206,232,0)'], [0.5, 'rgba(200,206,232,0.55)'], [1, 'rgba(200,206,232,0.2)']]); q.fillRect(0, 380, W, 180);
  }
  // 近一排桃树（仍在焦外）
  function va5Trees(q) {
    peachTree5(q, 380, 860, 1.25, 3, { trunk: 'rgba(38,30,58,0.92)', dark: '#4a3e6e', cols: ['#f2c2d0', '#e8aac0', '#f8d8e0'], tilt: 0.12 });
    peachTree5(q, 760, 820, 1.05, 7, { trunk: 'rgba(40,32,60,0.9)', dark: '#4a3e6e', cols: ['#f4c8d6', '#ecb0c4', '#fadce4'], tilt: -0.08 });
    peachTree5(q, 1010, 900, 0.95, 11, { trunk: 'rgba(42,34,62,0.88)', dark: '#4a3e6e', cols: ['#eebcd0', '#f6d2de', '#e4a4bc'], tilt: -0.3, depth: 4 });
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
    return cache('va5_bg3' + f, W, H, 1, (q) => {
      const far = E.util.cached('g03:va5_far3', [], W, H, 0.22, va5Far);
      q.drawImage(far, -6, -6, W + 12, H + 12);
      const tr = E.util.cached('g03:va5_trees3', [], W, H, 0.3, va5Trees);
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
  const sprigTex = (sharp) => cache(sharp ? 'va5_sprigS' : 'va5_sprigB', SPR5.w, SPR5.h, sharp ? 1 : 0.14, (q) => { q.translate(-SPR5.x, -SPR5.y); sprig5(q); });
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
    q.strokeStyle = 'rgba(184,158,232,0.85)'; q.lineWidth = crisp ? 4 : 6;
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
  // 她从他背后攥住袖子的手：几根纤指扣在袖缘上，袖子被拽出几道褶
  function gripHand(q, p, s, f, t, k) {
    q.save(); q.translate(p[0], p[1]); q.scale(f * s, s);
    // 袖上的拽褶：从手处向前散开
    q.strokeStyle = 'rgba(40,4,6,0.6)'; q.lineWidth = 1.1; q.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; q.beginPath(); q.moveTo(-1, 0); q.quadraticCurveTo(-8 * Math.cos(a), 3 * Math.sin(a) - 1, -15 * Math.cos(a) - 2, 6 * Math.sin(a) + i * 1.2 - 2); q.stroke(); }
    q.strokeStyle = 'rgba(255,140,110,0.35)'; q.lineWidth = 0.7;
    for (let i = 0; i < 3; i++) { const a = -0.4 + i * 0.45; q.beginPath(); q.moveTo(-2, -1); q.quadraticCurveTo(-9 * Math.cos(a), 2 * Math.sin(a) - 2, -14 * Math.cos(a), 5 * Math.sin(a) + i - 3); q.stroke(); }
    // 淡紫的袖口从他背后露出一角
    q.fillStyle = 'rgba(214,200,240,0.95)';
    q.beginPath(); q.moveTo(7, -7); q.quadraticCurveTo(2, -2, 3, 6); q.lineTo(10, 8); q.quadraticCurveTo(12, 0, 7, -7); q.fill();
    q.strokeStyle = 'rgba(110,90,130,0.7)'; q.lineWidth = 0.5; q.stroke();
    // 手：掌背与四指，指尖扣进袖里（越攥越紧时指节更弯）
    q.fillStyle = '#f6e6dc'; q.strokeStyle = 'rgba(120,80,70,0.7)'; q.lineWidth = 0.45;
    q.beginPath(); q.moveTo(4, -4); q.quadraticCurveTo(-1, -5, -3, -1.5); q.quadraticCurveTo(-4, 2.5, -1, 4.5); q.quadraticCurveTo(2.5, 5.5, 4.5, 3); q.closePath(); q.fill(); q.stroke();
    for (let i = 0; i < 4; i++) {
      const y0 = -3 + i * 2, bend = 2.2 + 0.8 * k;
      q.beginPath(); q.moveTo(-2.5, y0); q.quadraticCurveTo(-5.2, y0 + 0.2, -5.6 + 0.4 * i, y0 + bend); q.lineWidth = 1.6; q.strokeStyle = '#f6e6dc'; q.stroke();
      q.lineWidth = 0.35; q.strokeStyle = 'rgba(120,80,70,0.6)'; q.stroke();
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
        g.drawImage(va5Bg(), 0, 0, W, H);
        add(g, () => {
          glow(g, 100, 330, 200, '#ff8a4a', 0.24 * flick);
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
      const XX = 470, XY = 1100;
      // 他朝左想走：先倾身欲去，“人”字后停住；“边”字低头
      const xo = { stage: 'wedding', pose: 'stand', facing: -1, wind: 0.12 + 0.1 * gust, windDir: 1, seed: 1,
        lean: lerp(0.11, 0.03, env(lt, tRen - 0.1, tRen + 0.45)), head: 0.04 + 0.12 * shy };
      const PX = F.points('xiaoyao', XX, XY, s, t, xo);
      const ear = headPt(PX, SX, -1, -4.2, 2.6);
      // 她在他身后（更远一层），朝左探身，唇贴到他耳边；踮脚前低一截
      const lo = { pose: 'flySword', facing: -1, wind: 0.6, windDir: 1, seed: 2, lean: lerp(-0.08, 0.02, tip), head: lerp(0.12, 0.02, tip) };
      const P0 = F.points('linger', 0, 0, s, t, lo);
      const LX = ear[0] + 3 - P0.mouth[0], LY = ear[1] + lerp(30, 1, tip) - P0.mouth[1];
      const PL = F.points('linger', LX, LY, s, t, lo);
      // 盖头（攥在她远侧的手里）与被风卷走
      const tear = lt >= tHua;
      const vc = fromScreen(c, VEIL.x, VEIL.y), vz = camZ(c);
      const veilGrid = (() => {
        const hx = PL.handF[0] + 4, hy = PL.handF[1] + 6, Lh = 108;
        const kf = easeInOut(clamp((lt - tHua) / 0.17));
        const th = 0.78 + 0.18 * Math.sin(t * 1.4) - 0.3 * gust;          // 下垂方向：风把它吹向右下
        const e1 = [Math.cos(th - 0.62) * Lh, Math.sin(th - 0.62) * Lh], e2 = [Math.cos(th + 0.62) * Lh, Math.sin(th + 0.62) * Lh];
        // 飞到画面中心：上一镜盖头与下一镜浪上盖头对位
        const Lf = VEIL.L / vz, ct = Math.cos(VEIL.th), st = Math.sin(VEIL.th);
        const f1 = [ct * Lf, st * Lf * VEIL.sq], f2 = [-st * Lf, ct * Lf * VEIL.sq];
        const hov = Math.max(0, lt - tHua - 0.17);
        const cx = vc[0] + 6 * Math.sin(hov * 3), cy = vc[1] - 3 * Math.sin(hov * 2.4);
        const mid = [lerp(hx + (e1[0] + e2[0]) / 2, cx, kf) + 80 * Math.sin(PI * kf) * 0.4, lerp(hy + (e1[1] + e2[1]) / 2, cy, kf) - 120 * Math.sin(PI * kf)];
        return (u, v) => {
          const d = (u + v) / 2, ph = d * 5.6 - t * 7.2 + 1.3 * (u - v);
          const amp = (tear ? lerp(14, 7, kf) : 14) * Math.pow(d, 1.25) * (0.7 + 0.5 * gust);
          const w = Math.sin(ph) * amp + hb * 10 * d * d;
          const hang = [hx + e1[0] * u + e2[0] * v, hy + e1[1] * u + e2[1] * v + 10 * u * v];
          let x = hang[0], y = hang[1];
          if (tear) {
            const fly = [mid[0] + f1[0] * (u - 0.5) + f2[0] * (v - 0.5), mid[1] + f1[1] * (u - 0.5) + f2[1] * (v - 0.5)];
            x = lerp(hang[0], fly[0], kf); y = lerp(hang[1], fly[1], kf);
          }
          const nx = -Math.sin(th), ny = Math.cos(th);
          return [x + nx * w * (1 - 0.5 * (tear ? kf : 0)), y + ny * w * 0.6 - (tear ? 3 * Math.sin(ph) * kf : 0), Math.cos(ph) * clamp(amp / 9), 0];
        };
      })();
      const tassA = [0, 1, 2, 3].map((k) => PI / 2 - 0.5 * gust + 0.35 * Math.sin(t * 4.2 + k * 1.7) + hb * 0.5 * (k % 2 ? 1 : -1));

      const drawPair = (q) => {
        // 她（被他挡住身子，只露出探过来的头、肩与飘发）
        prof(q, 'f.L', () => F.draw(q, 'linger', LX, LY, s, t, lo));
        // 淡紫发带的两条长尾：踮脚时滞后约 200ms 才跟上，被风吹向右后
        const tipAt = (tau) => easeOut(clamp((tau - tYi + 0.02) / 0.42));
        for (let k = 0; k < 2; k++) {
          const pts = [];
          for (let j = 0; j <= 9; j++) {
            const u = j / 9, tau = t - 0.21 * u, lagY = (tipAt(tau) - tip) * -29;
            const L = (170 + 40 * k) * u;
            pts.push([PL.top[0] + 4 * s + L * (0.86 + 0.1 * gust) + 10 * Math.sin(t * 3.1 + u * 4 + k) * u, PL.top[1] + 9 * s + L * (0.3 + 0.1 * k) + lagY * u + 9 * Math.sin(t * 2.6 + u * 5 + k * 1.7) * u]);
          }
          const top = [], bot = [];
          for (let j = 0; j <= 9; j++) {
            const a = pts[Math.max(0, j - 1)], b = pts[Math.min(9, j + 1)];
            let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
            const w = (6 - 2.8 * (j / 9)) * (0.6 + 0.4 * Math.abs(Math.sin(t * 2 + j * 0.6 + k)));
            top.push([pts[j][0] + nx * w, pts[j][1] + ny * w]); bot.push([pts[j][0] - nx * w, pts[j][1] - ny * w]);
          }
          q.fillStyle = k ? 'rgba(196,176,236,0.88)' : 'rgba(214,196,242,0.92)';
          q.beginPath(); top.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); for (let i = 9; i >= 0; i--) q.lineTo(bot[i][0], bot[i][1]); q.closePath(); q.fill();
        }
        // 盖头还在她手里时：在她身侧随风飘
        if (!tear) prof(q, 'f.veil', () => veilMesh(q, veilGrid, { tassL: 20, tass: tassA, skip: 0, border: 2.4 }));
        // 他：头顶的冠换成束发小金冠；她的脸在他后脑之前（裁掉他与她头部重叠处）
        const herHead = (qq) => { qq.save(); headFrame(qq, PL, SL, -1, 1); qq.moveTo(12.2, -0.8); qq.ellipse(0.6, -0.8, 11.6, 13.4, 0, 0, TAU); qq.restore(); };
        const crownPts = [[-10.2, -12.8], [-10.4, -20.5], [-5.5, -25.5], [0.8, -26], [6.8, -22.5], [6.4, -14.2], [3.6, -12.4]].map(([x, y]) => headPt(PX, SX, -1, x, y));
        const clipOut = (qq, shape) => { qq.beginPath(); qq.rect(-200, -200, W + 400, H + 600); shape(qq); qq.clip('evenodd'); };
        q.save();
        clipOut(q, herHead);
        q.save();
        clipOut(q, (qq) => { qq.moveTo(crownPts[0][0], crownPts[0][1]); for (const p of crownPts) qq.lineTo(p[0], p[1]); qq.closePath(); });
        prof(q, 'f.X', () => F.draw(q, 'xiaoyao', XX, XY, s, t, xo));
        q.restore();
        // 发髻、束发金冠与横簪，两条红绦
        q.save(); headFrame(q, PX, SX, -1, 1);
        q.fillStyle = '#1a0c0c'; poly(q, [[7.4, -8.6], [4.5, -12.6], [-2, -13.8], [-8.4, -12], [-9.4, -10], [6, -9]]); q.fill();
        q.beginPath(); q.ellipse(-2.6, -15.2, 4.8, 3.8, -0.25, 0, TAU); q.fill();
        q.fillStyle = 'rgba(120,90,90,0.35)'; q.beginPath(); q.ellipse(-3.6, -16.4, 2.6, 1, -0.3, 0, TAU); q.fill();
        q.fillStyle = K.lin(q, -5, -21, 0, -16, [[0, '#ffe7a0'], [0.5, '#e2b24e'], [1, '#a8782a']]);
        q.beginPath(); q.moveTo(-5.6, -16.6); q.quadraticCurveTo(-5.8, -20.4, -2.6, -21.4); q.quadraticCurveTo(0.6, -20.4, 0.4, -16.6); q.closePath(); q.fill();
        q.strokeStyle = 'rgba(120,80,20,0.8)'; q.lineWidth = 0.3; q.stroke();
        q.fillStyle = '#d8242a'; q.beginPath(); q.arc(-2.6, -18.6, 0.9, 0, TAU); q.fill();
        q.strokeStyle = '#f0cc6a'; q.lineWidth = 0.75; q.beginPath(); q.moveTo(-9.6, -17.2); q.lineTo(4.4, -18.6); q.stroke();
        q.fillStyle = '#f6d880'; q.beginPath(); q.arc(4.6, -18.6, 0.8, 0, TAU); q.fill();
        q.restore();
        for (let k = 0; k < 2; k++) {
          const p0 = headPt(PX, SX, -1, -6.4, -15.6 + k * 1.2), pts = [];
          for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push([p0[0] + u * (80 + 20 * k) * (0.7 + 0.3 * gust), p0[1] + u * u * (90 + 30 * k) + 7 * Math.sin(t * 3 + u * 5 + k * 2) * u]); }
          q.strokeStyle = k ? '#a8141a' : '#c81e22'; q.lineWidth = 4 - k; q.lineCap = 'round'; line(q, pts); q.stroke();
          q.strokeStyle = 'rgba(255,140,120,0.4)'; q.lineWidth = 1.2; line(q, pts.slice(0, 6)); q.stroke();
        }
        // 他的脸：工笔淡彩，受左侧烛光
        gongbiFace(q, PX, SX, -1, { paint: true, skin: '#f2dccb', hair: '#1a0c0c', warm: '#ffb080', eye: lerp(0.9, 0.12, shy), smile: 0.12 + 0.4 * shy, blush: 0.2 + 0.8 * shy, brow: 0.5 * shy });
        // 耳朵：害羞时红到耳根
        q.save(); headFrame(q, PX, SX, -1, 1);
        q.fillStyle = mix('#f0d4c4', '#f07a7a', 0.15 + 0.7 * shy); q.beginPath(); q.ellipse(-4.4, 2.6, 2.1, 3.3, -0.15, 0, TAU); q.fill();
        q.strokeStyle = 'rgba(140,60,50,0.6)'; q.lineWidth = 0.35; q.beginPath(); q.ellipse(-4.2, 2.6, 1.1, 2.1, -0.15, -1.2, 2.2); q.stroke();
        q.restore();
        q.restore();
        // 她的眉眼：半垂的笑眼，唇在他耳边
        gongbiFace(q, PL, SL, -1, { eye: lerp(0.5, 0.15, tip), smile: lerp(0.3, 0.65, tip), blush: 0.5 + 0.4 * tip, lips: '#e05a68' });
        // 她攥着他的袖子：手从他背后伸过来扣住袖缘
        const sh = lerp(PX.shoulderN, PX.elbowN, 0.62);
        gripHand(q, [sh[0] + 9.5 * SX, sh[1] + 2 * SX], SX * 0.95, -1, t, lerp(0.3, 1, env(lt, 0, tYi)));
        // 冷暖：左侧烛光，右侧天青
        q.globalCompositeOperation = 'source-atop';
        q.fillStyle = K.lin(q, 300, 0, 860, 0, [[0, 'rgba(255,150,90,0.28)'], [0.4, 'rgba(255,190,170,0.05)'], [1, 'rgba(110,150,230,0.3)']]);
        q.fillRect(250, 80, 700, 660);
        q.globalCompositeOperation = 'source-over';
      };
      // 两人面前（烛光一侧）的暖光
      add(g, () => { glow(g, PX.head[0] - 60, PX.head[1] + 40, 190, '#ff9a5a', 0.2 * flick); glow(g, PL.head[0] + 40, PL.head[1] + 60, 160, '#c8d8ff', 0.1); });
      prof(g, 'fig', () => {
        const box = [250, 80, 900, H + 8];
        if (foc >= 0.995) {
          const B = scr('va5_fig', box[0], box[1], box[2], box[3], 1); drawPair(B.q); blit(g, B, 0, 0, 1);
        } else {
          // 焦外：低分辨率画一遍，错位叠两次（柔，不出锯齿）；对焦过程中与清楚的一版交叉
          const B = scr('va5_figB', box[0], box[1], box[2], box[3], 0.5); drawPair(B.q);
          const d = 3.2 * (1 - foc);
          if (foc > 0.01) { const S1 = scr('va5_fig', box[0], box[1], box[2], box[3], 1); drawPair(S1.q); blit(g, S1, 0, 0, 1); }
          const a = 1 - foc;
          blit(g, B, -d, -d * 0.5, a); blit(g, B, d, d * 0.5, a * 0.5);
        }
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
          blit(g, B, 0, 0, foc); blit(g, B, 5, 3, foc * 0.5);
        }
      });
      prof(g, 'petF', () => {
        const sw = 5 * Math.sin(t * 1.1) + 8 * gust;
        g.save(); g.translate(SPR5.x + sw, SPR5.y + 0.3 * sw);
        if (foc < 0.99) { g.globalAlpha = 1 - foc; g.drawImage(sprigTex(true), 0, 0, SPR5.w, SPR5.h); }
        if (foc > 0.01) { g.globalAlpha = foc; g.drawImage(sprigTex(false), -6, -4, SPR5.w + 12, SPR5.h + 8); }
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
  // 6 潮声东去：钱塘江口，蓝调时刻，退潮；那方红盖头漂在浪上，被大潮头托起，向东漂远
  // ======================================================================
  const HZ6 = 214;
  // 天、远岸（六和塔）、水面底色、沙洲、近处滩涂：烘成一张，比画面宽，留出横摇的余量
  function va6Bg() {
    return cache('va6_bg', W + 220, H, 1, (q) => {
      const WW = W + 220, r = A.rng(66);
      // 天：上深蓝，近地平线西边（左）留一抹余晖
      q.fillStyle = K.lin(q, 0, 0, 0, HZ6, [[0, '#101e40'], [0.5, '#22406e'], [0.85, '#4f6f9e'], [1, '#7f98bc']]);
      q.fillRect(0, 0, WW, HZ6 + 2);
      q.fillStyle = K.rad(q, 60, HZ6 + 10, 10, 620, [[0, 'rgba(255,176,120,0.75)'], [0.3, 'rgba(236,140,120,0.42)'], [0.7, 'rgba(160,110,150,0.12)'], [1, 'rgba(120,100,150,0)']]);
      q.fillRect(0, 0, WW, HZ6 + 2);
      // 几颗初起的星
      for (let i = 0; i < 26; i++) { const x = 500 + r() * (WW - 500), y = 8 + r() * 120; q.fillStyle = rgba('#e8eeff', 0.25 + r() * 0.45); q.beginPath(); q.arc(x, y, 0.6 + r() * 0.9, 0, TAU); q.fill(); }
      // 水：近地平线反天光，越近越深
      q.fillStyle = K.lin(q, 0, HZ6, 0, H, [[0, '#93a8c6'], [0.12, '#6a86ae'], [0.35, '#40618f'], [0.65, '#2a4874'], [1, '#162a4c']]);
      q.fillRect(0, HZ6, WW, H - HZ6);
      // 余晖在水里的倒映（左侧，被拉长）
      q.save(); q.translate(80, HZ6); q.scale(1, 0.32);
      q.fillStyle = K.rad(q, 0, 0, 10, 640, [[0, 'rgba(255,170,120,0.55)'], [0.4, 'rgba(230,140,130,0.22)'], [1, 'rgba(200,120,140,0)']]);
      q.fillRect(-120, 0, 1100, 1500);
      q.restore();
      // 远岸：左边低丘、六和塔、点点灯火；向右渐低渐隐，入海口在右
      q.fillStyle = '#25304c';
      q.beginPath(); q.moveTo(-10, HZ6 + 2);
      for (let x = -10; x <= 860; x += 20) { const u = x / 860; q.lineTo(x, HZ6 - (1 - u) * (22 + 14 * noise1(x * 0.012, 4)) - 2); }
      q.lineTo(900, HZ6 + 2); q.closePath(); q.fill();
      q.fillStyle = 'rgba(37,48,76,0.45)'; q.fillRect(-10, HZ6, 900, 3);
      // 塔
      const tx = 210, ty = HZ6 - 22;
      for (let k = 0; k < 7; k++) { const w = 14 - k * 1.3, y = ty - k * 7; q.fillStyle = '#1c2540'; q.fillRect(tx - w / 2, y - 6, w, 6); q.fillRect(tx - w / 2 - 3, y - 7, w + 6, 1.6); }
      q.fillRect(tx - 0.8, ty - 56, 1.6, 8);
      for (let i = 0; i < 14; i++) A.softBlob(q, 40 + r() * 700, HZ6 - 4 - r() * 8, 3 + r() * 2, 0.9, '#ffcf8a');
      // 远岸在水里的倒影
      q.fillStyle = 'rgba(30,40,66,0.35)';
      q.beginPath(); q.moveTo(-10, HZ6 + 2); for (let x = -10; x <= 860; x += 20) { const u = x / 860; q.lineTo(x, HZ6 + 2 + (1 - u) * 12); } q.lineTo(900, HZ6 + 2); q.fill();
      // 退潮露出的沙洲：顺着水流拉长，上沿反天光
      const bar = (x, y, w, h, seed) => {
        // 湿沙：一团偏暖的灰，上沿反天光，下沿压一线暗，边缘柔
        for (let k = 0; k < 6; k++) E.util.streak(q, x + (h2(seed, k) - 0.5) * w * 0.8, y + (h2(seed, k + 9) - 0.5) * h, w * (0.35 + 0.3 * h2(seed, k + 3)), h * (0.7 + 0.4 * h2(seed, k + 5)), '#6e6a74', 0.5);
        E.util.streak(q, x - w * 0.08, y - h * 0.5, w * 0.75, h * 0.45, '#d6d4e0', 0.55);
        E.util.streak(q, x + w * 0.05, y + h * 0.75, w * 0.8, h * 0.35, '#141c30', 0.45);
      };
      bar(330, 300, 210, 9, 1); bar(830, 268, 150, 5, 2); bar(150, 404, 280, 16, 3);
      // 水面上横向的淡彩笔触：天光（浅）与水色（深）交错，越近越宽
      for (let i = 0; i < 90; i++) {
        const y = HZ6 + 6 + Math.pow(r(), 1.6) * (H - HZ6), d = (y - HZ6) / (H - HZ6);
        E.util.streak(q, r() * WW, y, 60 + 260 * d + r() * 120, 1.5 + 9 * d, r() < 0.5 ? '#a8bee0' : '#0e1c3a', 0.1 + 0.12 * r());
      }
    });
  }
  // 浪线参数：越近越大越快（视差）；每行由若干段浪头组成，各段长短不一
  const ROWS6 = [228, 240, 254, 270, 290, 314, 342, 376, 416, 464, 520, 586, 662].map((y, j) => {
    const d = (y - HZ6) / (H - HZ6);
    const segs = [];
    const n = 5 + Math.round(4 * (1 - d));
    for (let i = 0; i < n; i++) segs.push({ x: (i + 0.3 * h2(j, i + 10)) / n, l: 0.35 + 0.5 * h2(j, i + 20), w: 0.6 + 0.6 * h2(j, i + 30), sp: 0.8 + 0.4 * h2(j, i + 40) });
    return { y: y + 6 * (h2(j, 63) - 0.5) * d, d, A: 1.2 + 16 * d, L: 80 + 380 * d, v: 16 + 110 * d, w: 0.7 + 7 * d, ph: h2(j, 61) * TAU, ph2: h2(j, 62) * TAU, segs };
  });
  const waveY = (R, x, t) => R.y + R.A * (Math.sin((TAU / R.L) * (x - R.v * t) + R.ph) * 0.75 + 0.25 * Math.sin((TAU / R.L) * 2.3 * (x - 0.6 * R.v * t) + R.ph2));
  // 某处水面的起伏（用于漂浮物），在两条浪线之间插值
  function surfY(x, y, t) {
    let j = 0; while (j < ROWS6.length - 2 && ROWS6[j + 1].y < y) j++;
    const a = ROWS6[j], b = ROWS6[j + 1], u = clamp((y - a.y) / (b.y - a.y));
    return lerp(waveY(a, x, t) - a.y, waveY(b, x, t) - b.y, u);
  }
  // 一段浪头：沿着浪线的两头尖、中间厚的一笔白（上沿）与其下的一抹深（浪谷）
  function crest(g, R, x0, len, wk, t, a, foam) {
    const n = 9, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + u * len, y = waveY(R, x, t);
      const w = R.w * wk * Math.pow(Math.sin(PI * Math.pow(u, 0.8)), 0.9) * 0.62;
      top.push([x, y - w * 0.6]); bot.push([x, y + w * 0.5]);
    }
    // 浪谷的暗（远处几乎看不见，省掉）
    if (R.d > 0.08) E.util.streak(g, x0 + len / 2, waveY(R, x0 + len / 2, t) + R.w * 2.2 + R.A * 0.25, len * 0.55, R.w * 1.6 + R.A * 0.35, '#08142e', 0.3 * a);
    g.fillStyle = rgba(foam, a);
    g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = n; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); g.fill();
  }
  // 漂着的红盖头：透视压扁的一方软绸（八个控制点随浪起伏），fl 翻面（cos 缩放，背面更暗），带金边、流苏
  function veilFloat(g, x, y, s, t, fl, tilt, wet) {
    const cf = Math.cos(fl), under = cf < 0;
    g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s * Math.max(0.1, Math.abs(cf)));
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = i * PI / 4 + PI / 8, corner = i % 2 === 0;
      const rr = corner ? 40 : 30 + 3 * Math.sin(t * 2.6 + i);
      pts.push([Math.cos(a) * rr * 1.3, Math.sin(a) * rr * 0.6 + 4 * Math.sin(t * 3 + i * 1.7)]);
    }
    const shape = () => {
      g.beginPath();
      const m0 = [(pts[7][0] + pts[0][0]) / 2, (pts[7][1] + pts[0][1]) / 2]; g.moveTo(m0[0], m0[1]);
      for (let i = 0; i < 8; i++) { const p = pts[i], q2 = pts[(i + 1) % 8]; g.quadraticCurveTo(p[0], p[1], (p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2); }
      g.closePath();
    };
    g.fillStyle = under ? K.lin(g, -40, -20, 40, 20, [[0, '#8a1416'], [1, '#4a0608']]) : K.lin(g, -50, -24, 50, 24, [[0, '#d8402e'], [0.45, '#b81e1c'], [1, '#7a0e10']]);
    shape(); g.fill();
    // 浸湿处更深、半透出水色
    if (wet > 0) { g.fillStyle = rgba('#3a0a1a', 0.35 * wet); g.beginPath(); g.ellipse(-12, 10, 34, 9, 0.1, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(230,187,88,0.85)'; g.lineWidth = 1.4; shape(); g.stroke();
    // 褶
    g.strokeStyle = under ? 'rgba(30,0,0,0.45)' : 'rgba(96,8,10,0.5)'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-34, -6); g.quadraticCurveTo(-4, 6 + 4 * Math.sin(t * 2.2), 30, -4); g.moveTo(-22, 9); g.quadraticCurveTo(6, 1, 30, 11); g.stroke();
    g.strokeStyle = 'rgba(255,170,130,0.45)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-30, -10); g.quadraticCurveTo(-4, 1, 26, -9); g.stroke();
    if (!under) { g.fillStyle = 'rgba(244,206,110,0.85)'; g.beginPath(); g.ellipse(8, -2, 9, 3.6, -0.2, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-2, -4, 3, 2, 0, 0, TAU); g.fill(); }
    // 四角流苏
    g.strokeStyle = '#f0c860'; g.lineWidth = 1.1;
    for (let i = 0; i < 8; i += 2) { const p = pts[i]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + Math.sign(p[0]) * 8 + 2 * Math.sin(t * 4 + i), p[1] + 5); g.stroke(); }
    g.restore();
  }
  // 漂流物后面拖出的人字水纹
  function wake(g, x, y, s, t, a) {
    g.strokeStyle = rgba('#dce6fa', 0.35 * a); g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const u = ((t * 0.9 + k / 4) % 1), d = (20 + u * 120) * s, sp = (6 + u * 26) * s;
      g.lineWidth = Math.max(0.6, 2.2 * s * (1 - u));
      g.globalAlpha = (1 - u);
      g.beginPath(); g.moveTo(x - d, y - sp * 0.5); g.quadraticCurveTo(x - d * 0.4, y - sp * 0.2, x - 28 * s, y - 2 * s); g.stroke();
      g.beginPath(); g.moveTo(x - d, y + sp * 0.6); g.quadraticCurveTo(x - d * 0.4, y + sp * 0.25, x - 28 * s, y + 6 * s); g.stroke();
    }
    g.globalAlpha = 1;
  }

  XYT.registerShot('va6_tide', {
    name: '潮声东去', zone: 'top', night: true, text: '#e9f1f6', shadow: 'rgba(8,16,40,0.92)', accent: '#e86a4a', bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tXiang = charAt(c, 4, 1.92), tDong = charAt(c, 5, 2.22), tLiu = charAt(c, 6, 2.74);
      // 强拍：在镜头开头 0.4–1.3 秒内找一个强拍，大潮头踩着它涌进来
      let tBore = 0.79;
      if (c.grid && c.b) {
        const t0 = t - lt;
        for (let k = -4; k <= 4; k++) { const i = c.b.i + k, tt = c.grid.time(i) - t0; if (tt > 0.4 && tt < 1.3 && c.grid.isDown(i)) { tBore = tt; break; } }
      }
      const pan = 70 * smooth(clamp(lt / 3.3)) + 20 * Math.max(0, lt);
      const be = c.be ? c.be(0.28) : 0;
      // 盖头漂流：托起之前随水慢漂
      // 起点对准转场的圆心（渲染器的圆形转场从画面中心展开），与上一镜灵儿手里的盖头接上
      const vx0 = (u) => 628 + 16 * u;
      const vY0 = 386;
      // 潮头前沿（中间领先的一道弧）；速度按“向”字正好扫到盖头来解
      const sc6 = (y) => clamp((y - HZ6) / (H - HZ6));
      const SL = 0.62;
      const arc = (y) => 80 * Math.sin(PI * sc6(y)) + (y - 470) * SL;
      const vB = (vx0(tXiang) + 60 - arc(vY0)) / Math.max(0.4, tXiang - tBore);
      const boreX = (y) => -60 + (lt - tBore) * vB + arc(y);
      prof(g, 'bg', () => {
        g.imageSmoothingEnabled = false;
        g.drawImage(va6Bg(), -Math.round(pan), 0, W + 220, H);
        g.imageSmoothingEnabled = true;
        E.mist(g, { t, y: HZ6 + 8, h: 46, color: '#c8d4ea', alpha: 0.35, speed: 10, seed: 6 });
      });
      // 浪：一行行浪头向东（右）推移；潮头扫过之后那一片更白更碎
      prof(g, 'waves', () => {
        const span = W + 300;
        for (let j = 0; j < ROWS6.length; j++) {
          const R = ROWS6[j], bx = boreX(R.y);
          for (const S of R.segs) {
            const len = R.L * S.l * 1.7;
            const x0 = ((S.x * span + R.v * S.sp * t) % span + span) % span - 150;
            const past = bx > x0 + len * 0.5 ? 1 : 0;
            const a = (0.22 + 0.5 * R.d) * (0.7 + 0.3 * S.w) + 0.1 * be + 0.15 * past;
            crest(g, R, x0, len, S.w * (1 + 0.5 * past), t, Math.min(0.95, a), past ? '#ffffff' : '#e4ecfa');
          }
          // 浪线上沿的一缕天光
          if (R.d > 0.12) E.util.streak(g, ((h2(j, 5) * span + R.v * 0.5 * t) % span) - 150, R.y - R.w * 2, R.L * 0.8, R.w * 0.8, '#c8d8f4', 0.18);
        }
        // 浪尖上的余晖：靠西（左）的浪尖闪金，随拍一闪
        add(g, () => {
          for (let j = 2; j < ROWS6.length; j++) {
            const R = ROWS6[j];
            for (let k = 0; k < 4; k++) {
              const x = ((h2(j, k + 70) * (W + 200) + R.v * t * 0.9) % (W + 200)) - 100;
              const warm = clamp(1.1 - x / 820);
              const a = warm * (0.2 + 0.55 * be + 0.25 * Math.sin(t * 5 + j * 1.3 + k * 2.1)) * (0.5 + 0.5 * R.d);
              const y = waveY(R, x, t) - R.w * 0.6;
              if (a < 0.03) continue;
              glow(g, x, y, 4 + 12 * R.d, '#ffc890', a);
              if (a > 0.3) glow(g, x, y, 1.2 + 2 * R.d, '#fff6e0', a);
            }
          }
        });
      });
      prof(g, 'reeds', () => {
        // 左下角的芦苇滩（近景剪影）
        E.reeds(g, { t, x0: -40, x1: 260, y: 760, h: 230, n: 18, color: '#0c1426', plume: '#8a9cc0', wind: 0.55 + 0.25 * be, seed: 6 });
      });
      // 大潮头：强拍上从左边涌进，一道白浪向东（右）扫过整个画面
      prof(g, 'bore', () => {
        if (lt < tBore - 0.05) return;
        const k = smooth(clamp((lt - tBore + 0.05) / 0.3));
        const fx = (y) => boreX(y) + 14 * (noise1(y * 0.035 + t * 2.2, 8) - 0.5) * (0.3 + sc6(y));
        // 潮头后面拖着的白沫：一笔笔横向短浪，越往后越淡
        for (let i = 0; i < 70; i++) {
          const y = HZ6 + 6 + Math.pow(h2(i, 84), 0.9) * (H - HZ6), s0 = sc6(y), back = Math.pow(h2(i, 85), 1.4);
          const x = fx(y) - (16 + back * 230) * (0.12 + s0) - 30 * s0;
          E.util.streak(g, x, y, (12 + 46 * s0) * (0.6 + h2(i, 86)), 1 + 4 * s0, '#f2f6ff', (0.5 - 0.42 * back) * k);
        }
        // 前沿：沿弧线叠一串柔白团（浪头翻起的白），再压一道陡起浪面的暗
        g.strokeStyle = rgba('#06102a', 0.5 * k); g.lineCap = 'round';
        for (let y = HZ6 + 4; y < H + 20; y += 9) { const s0 = sc6(y); g.lineWidth = 1 + 9 * s0; g.beginPath(); g.moveTo(fx(y) + 4 + 9 * s0, y); g.lineTo(fx(y + 9) + 4 + 9 * s0, y + 9); g.stroke(); }
        for (let i = 0; i < 64; i++) {
          const y = HZ6 + 4 + (i / 64) * (H - HZ6 + 20), s0 = sc6(y);
          const r = (5 + 26 * s0) * (0.7 + 0.6 * h2(i, 87));
          E.util.streak(g, fx(y) - r * 0.4, y, r * 0.9, r * 0.55, '#ffffff', (0.7 + 0.3 * h2(i, 88)) * k);
        }
        g.strokeStyle = rgba('#ffffff', 0.9 * k);
        for (let y = HZ6 + 4; y < H + 20; y += 9) { const s0 = sc6(y); g.lineWidth = 1 + 7 * s0; g.beginPath(); g.moveTo(fx(y), y); g.lineTo(fx(y + 9), y + 9); g.stroke(); }
        add(g, () => { for (let y = HZ6 + 20; y < H + 20; y += 46) glow(g, fx(y) - 6, y, 16 + 50 * sc6(y), '#bcd2ff', 0.22 * k); });
        // 浪花飞沫
        add(g, () => {
          for (let i = 0; i < 54; i++) {
            const y = HZ6 + 10 + h2(i, 81) * (H - HZ6), s0 = sc6(y);
            const life = ((t * 1.7 + h2(i, 82)) % 1);
            const x = fx(y) + 4 * s0 + life * 30 * s0, yy = y - life * (14 + 52 * s0) + life * life * 38 * s0;
            glow(g, x, yy, 2 + 11 * s0, '#e8f0ff', 0.55 * (1 - life) * k);
          }
          // 潮头扫进来那一下，整条浪线亮一亮
          const fl = Math.exp(-Math.max(0, lt - tBore) / 0.35) * k;
          for (let y = HZ6 + 30; y < H; y += 80) glow(g, fx(y), y, 60 + 120 * sc6(y), '#cfe0ff', 0.25 * fl);
        });
      });
      // 红盖头
      prof(g, 'veil', () => {
        let x, y, s, fl = 0, tilt = -0.15 + 0.1 * Math.sin(t * 1.3), lift = 0;
        if (lt < tXiang) {
          x = vx0(lt); y = vY0 + surfY(x, vY0, t) * 0.9; s = 1;
        } else {
          const u = clamp((lt - tXiang) / (c.dur - tXiang + 0.5));
          const e = easeInOut(Math.pow(u, 0.8));
          // 先被潮头托起向前冲一段，再越漂越远、越来越小
          const surge = smooth(clamp((lt - tXiang) / 0.6));
          x = lerp(vx0(tXiang), 1080, e) + 60 * surge * (1 - e);
          y = lerp(vY0, HZ6 + 22, Math.pow(e, 0.9));
          s = Math.max(0.12, (y - HZ6 + 6) / (vY0 - HZ6 + 6));
          lift = 38 * Math.sin(PI * clamp((lt - tXiang) / 0.75)) * s;
          fl = PI * smooth(clamp((lt - tDong + 0.15) / 0.5)) + 0.25 * Math.sin(t * 2);
          y += surfY(x, y, t) * s;
          tilt += 0.3 * Math.sin(PI * clamp((lt - tXiang) / 0.8));
        }
        // 水里的倒影与阴影、拖出的水纹
        const sv = s * 0.95;
        g.fillStyle = rgba('#0a1430', 0.32 * sv);
        g.beginPath(); g.ellipse(x + 4 * sv, y + 12 * sv, 52 * sv, 11 * sv, tilt * 0.3, 0, TAU); g.fill();
        if (lift < 4) wake(g, x, y + 4 * sv, sv, t, 1 - lift / 4);
        g.fillStyle = rgba('#e04030', 0.18 * (1 - lift / 40)); g.beginPath(); g.ellipse(x, y + 16 * sv + lift * 0.5, 40 * sv, 6 * sv, 0, 0, TAU); g.fill();
        veilFloat(g, x, y - lift, sv, t, fl, tilt, lift < 4 ? 1 : 0.3);
        // 余晖照在红绸上的一点光
        add(g, () => glow(g, x - 8 * s, y - lift - 4 * s, 40 * s, '#ff9a6a', 0.22 + 0.25 * be));
        // 在“流”字上，远处的盖头最后一闪
        const fin = Math.exp(-Math.max(0, lt - tLiu) / 0.5) * (lt > tLiu ? 1 : 0);
        if (fin > 0.01) add(g, () => glow(g, x, y - lift, 30, '#ffb080', 0.5 * fin));
      });
      // 几只归鸥贴着水面向东
      prof(g, 'birds', () => {
        for (let k = 0; k < 4; k++) {
          const x = 300 + k * 70 + h2(k, 51) * 40 + lt * (34 + 6 * k), y = 252 + k * 7 + 3 * Math.sin(t * 1.4 + k);
          A.bird(g, x, y, 0.55 + 0.1 * h2(k, 52), t * 7 + k * 1.9, 'rgba(230,236,250,0.75)');
        }
      });
    },
  });

  // ======================================================================
  // 7 回首旧街：余杭老街的廊棚，暮色；白发人在“回”字上回首，廊下灯笼随拍亮起；“往事”硬切晴天的旧街
  // ======================================================================
  const VP7 = [780, 372], F7 = 400;
  const pj = (X, Y, Z) => [VP7[0] + (X * F7) / Z, VP7[1] + (Y * F7) / Z];
  const POSTS7 = [1.3, 4.3, 7.3, 10.3, 13.3, 16.3, 19.3, 22.3, 25.3, 28.3, 31.3, 34.3, 37.3, 40.3];
  const PAL7 = {
    dusk: {
      sky: [[0, '#2a2240'], [0.35, '#574266'], [0.68, '#b8645a'], [0.88, '#e29c45'], [1, '#ffd08a']], sun: '#ffd890', sunX: -150,
      opp: '#8a6e80', oppDark: '#4a3646', roof: '#241c2a', win: '#ffb860', water0: '#a87060', water1: '#201828',
      post: '#1e1214', rim: '#ffb060', ceil: '#120a0c', beam: '#22141a', paint: null, floor0: '#4a3436', floor1: '#160e10', joint: 'rgba(0,0,0,0.32)',
      shop: '#2e2026', door: '#ffa850', board: '#24161a', sign: '#4a1c16', signTxt: 'rgba(240,200,140,0.75)', rail: '#1a0e10', haze: '#ffb070', hazeA: 0.55, ink: null,
    },
    noon: {
      sky: [[0, '#2f74c0'], [0.6, '#8cc6ea'], [1, '#e2f2f0']], sun: '#fffbe8', sunX: -300,
      opp: '#fbf8ef', oppDark: '#c4c8d0', roof: '#2a2e38', win: '#3a3a40', water0: '#6cbcb0', water1: '#1e6a78',
      post: '#a8301e', rim: '#ffd8a0', ceil: '#3e2418', beam: '#1f6a6a', paint: '#d8b04a', floor0: '#d8ccb2', floor1: '#a89678', joint: 'rgba(90,64,40,0.35)',
      shop: '#f0e6d0', door: '#4a2e1e', board: '#a0643c', sign: '#c8281e', signTxt: 'rgba(255,226,150,0.95)', rail: '#9a2a1a', haze: '#fff6e6', hazeA: 0.16, ink: 'rgba(30,18,14,0.7)',
    },
  };
  function arcade7(mode) {
    const P = PAL7[mode];
    return cache('va7_' + mode + fk(), W, H, 1, (q) => {
      const r = A.rng(mode === 'dusk' ? 71 : 72);
      // 底色：巷弄与远处的暗（各种缝隙里不留透明）
      q.fillStyle = mix(P.oppDark, P.water1, 0.5); q.fillRect(0, 0, W, H);
      // 天
      q.fillStyle = K.lin(q, 0, 0, 0, VP7[1] + 30, P.sky); q.fillRect(0, 0, W, VP7[1] + 40);
      if (mode === 'dusk') q.fillStyle = K.rad(q, VP7[0] + P.sunX * 0.5, VP7[1] - 14, 5, 460, [[0, 'rgba(255,240,200,1)'], [0.2, 'rgba(255,196,120,0.65)'], [1, 'rgba(255,150,90,0)']]);
      else q.fillStyle = K.rad(q, VP7[0] - 200, 60, 5, 500, [[0, 'rgba(255,255,240,0.7)'], [1, 'rgba(255,255,240,0)']]);
      q.fillRect(0, 0, W, VP7[1] + 40);
      // 对岸的白墙黛瓦（X=-12），由近及远；远处融进暮霭
      const fogK = (Z) => clamp(Z / 70);
      for (let k = 0; k < 18; k++) {
        const Z0 = 3.5 + k * 3.6 + k * k * 0.12, Z1 = Z0 + 3.2 + k * 0.25;
        const hw = 4.2 + 2.2 * h2(k, mode === 'dusk' ? 3 : 3);
        const base = 2.1, top = base - hw;
        const a = pj(-12, base, Z0), b = pj(-12, base, Z1), c2 = pj(-12, top, Z1), d = pj(-12, top, Z0);
        q.fillStyle = mix(P.opp, P.haze, fogK(Z0) * 0.7);
        poly(q, [a, b, c2, d]); q.fill();
        // 墙脚的暗、雨痕
        q.fillStyle = rgba(P.oppDark, 0.45 * (1 - fogK(Z0)));
        poly(q, [a, b, pj(-12, base - 0.8, Z1), pj(-12, base - 0.8, Z0)]); q.fill();
        // 黛瓦屋檐：向河面挑出
        const e0 = pj(-11.2, top + 0.3, Z0), e1 = pj(-11.2, top + 0.3, Z1), r0 = pj(-12.6, top - 0.9, Z0), r1 = pj(-12.6, top - 0.9, Z1);
        q.fillStyle = mix(P.roof, P.haze, fogK(Z0) * 0.6);
        poly(q, [e0, e1, r1, r0]); q.fill();
        // 马头墙：每隔一户一道阶梯山墙
        if (k % 2 === 0) {
          q.fillStyle = mix(P.opp, P.haze, fogK(Z0) * 0.7);
          const g0 = pj(-12, top - 1.6, Z0), g1 = pj(-12, top - 1.6, Z0 + 0.5);
          poly(q, [d, pj(-12, top, Z0 + 0.5), g1, g0]); q.fill();
          q.fillStyle = mix(P.roof, P.haze, fogK(Z0) * 0.6);
          const cp0 = pj(-11.7, top - 1.6, Z0 - 0.15), cp1 = pj(-11.7, top - 1.6, Z0 + 0.65);
          poly(q, [cp0, cp1, [cp1[0], cp1[1] - 6 * 4 / Z0], [cp0[0] - 3, cp0[1] - 9 * 4 / Z0]]); q.fill();
        }
        // 窗：暮色里亮灯
        if (k > 0) for (let w = 0; w < 2; w++) {
          const zz = lerp(Z0, Z1, 0.3 + w * 0.4), wy = top + 1.6 + 0.4 * h2(k, w);
          const w0 = pj(-12, wy, zz), w1 = pj(-12, wy + 0.8, zz + 0.6);
          q.fillStyle = mode === 'dusk' && h2(k, w + 5) < 0.6 ? mix(P.win, P.haze, fogK(zz) * 0.5) : rgba(P.win, 0.7 * (1 - fogK(zz)));
          q.fillRect(w0[0], w0[1], Math.max(1, w1[0] - w0[0]), Math.max(1, w1[1] - w0[1]));
        }
      }
      // 河面
      const wn = pj(-12, 2.4, 2.4), wf = pj(-12, 2.4, 80), en = pj(-2.4, 2.4, 1.2), ef = pj(-2.4, 2.4, 80);
      q.fillStyle = K.lin(q, 0, VP7[1], 0, H, [[0, P.water0], [1, P.water1]]);
      poly(q, [[wn[0] - 400, wn[1]], wf, ef, en, [-40, H + 40], [-40, wn[1]]]); q.fill();
      // 对岸在水里的倒影（压扁、淡）
      q.save(); q.globalAlpha = 0.28;
      for (let k = 0; k < 16; k++) {
        const Z0 = 3.5 + k * 3.6 + k * k * 0.12, Z1 = Z0 + 3.2 + k * 0.25, a = pj(-12, 2.4, Z0), b = pj(-12, 2.4, Z1), c2 = pj(-12, 6.4, Z1), d = pj(-12, 6.4, Z0);
        q.fillStyle = mix(P.opp, P.water1, 0.3); poly(q, [a, b, c2, d]); q.fill();
      }
      q.restore();
      // 水波：横向细纹
      q.strokeStyle = rgba(mode === 'dusk' ? '#ffc890' : '#ffffff', 0.18); q.lineWidth = 1;
      for (let i = 0; i < 40; i++) { const y = VP7[1] + 40 + Math.pow(r(), 1.5) * 330, x = r() * 700; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 14 + r() * 50, y); q.stroke(); }
      // 远处的石拱桥（近灭点）
      const bA = pj(-12, 2.4, 46), bB = pj(-2.4, 2.4, 46), bT = pj(-7, 0.3, 46);
      q.strokeStyle = mix(P.oppDark, P.haze, 0.5); q.lineWidth = 3;
      q.beginPath(); q.moveTo(bA[0], bA[1]); q.quadraticCurveTo(bT[0], bT[1] - 6, bB[0], bB[1]); q.stroke();
      // 右侧店铺的墙（X=2.6）
      const sh = (Z0, Z1, y0, y1, col) => { poly(q, [pj(2.6, y0, Z0), pj(2.6, y0, Z1), pj(2.6, y1, Z1), pj(2.6, y1, Z0)]); q.fillStyle = col; q.fill(); };
      sh(1.6, 80, 1.6, -1.3, P.shop);
      for (let k = 0; k < 12; k++) {
        const Z0 = 2.2 + k * 3.5, Z1 = Z0 + 2.3, fk = fogK(Z0);
        sh(Z0, Z1, 1.6, -0.6, mix(P.door, P.haze, fk * 0.5));
        // 门板：半掩
        sh(Z0, Z0 + 0.7 + 0.5 * h2(k, 9), 1.6, -0.6, mix(P.board, P.haze, fk * 0.5));
        // 招幌：竖挂在廊下
        if (k % 2 === 0 && k < 9) {
          const zz = Z0 + 1.2, a = pj(2.3, -1.15, zz), b = pj(2.3, 0.2, zz), w = 0.42 * F7 / zz;
          q.fillStyle = mix(P.sign, P.haze, fk * 0.4); q.fillRect(a[0] - w / 2, a[1], w, b[1] - a[1]);
          if (zz < 12) {
            q.fillStyle = P.signTxt; q.font = Math.round(w * 0.8) + 'px ' + XYT.FONT; q.textAlign = 'center'; q.textBaseline = 'middle';
            q.fillText(['茶', '酒', '客', '福', '余'][k / 2 % 5], a[0], lerp(a[1], b[1], 0.35));
          }
        }
      }
      // 地面：石板
      const fl = [pj(-2.2, 1.6, 1.0), pj(-2.2, 1.6, 80), pj(2.6, 1.6, 80), pj(2.6, 1.6, 1.0)];
      q.fillStyle = K.lin(q, 0, VP7[1], 0, H, [[0, P.floor0], [1, P.floor1]]); poly(q, fl); q.fill();
      if (mode === 'dusk') { q.fillStyle = K.rad(q, VP7[0], VP7[1] + 30, 10, 520, [[0, 'rgba(255,200,130,0.55)'], [1, 'rgba(255,170,110,0)']]); poly(q, fl); q.fill(); }
      q.strokeStyle = P.joint; q.lineWidth = 1;
      for (let X = -2.2; X <= 2.6; X += 0.6) { const a = pj(X, 1.6, 1.0), b = pj(X, 1.6, 80); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
      for (let Z = 1.2; Z < 60; Z *= 1.16) { const a = pj(-2.2, 1.6, Z), b = pj(2.6, 1.6, Z); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
      // 夕照（正午是日光）从河边两柱之间斜斜铺到石板上：一道道光、一道道柱影
      q.save(); poly(q, fl); q.clip();
      const kx = 1.7, kz = -1.9;
      for (let i = 0; i < POSTS7.length - 1; i++) {
        const za = POSTS7[i] + 0.14, zb = POSTS7[i + 1] - 0.14, fk = fogK(za);
        const at = (Y, Z) => pj(-2.2 + kx * (1.6 - Y), 1.6, Math.max(0.5, Z + kz * (1.6 - Y)));
        q.fillStyle = mode === 'dusk' ? rgba('#ffb868', 0.42 * (1 - fk * 0.6)) : rgba('#fff4d8', 0.42 * (1 - fk * 0.6));
        poly(q, [at(1.1, za), at(1.1, zb), at(-1.0, zb), at(-1.0, za)]); q.fill();
      }
      q.restore();
      // 顶棚、椽子、梁
      const ce = [pj(-2.2, -1.3, 1.0), pj(-2.2, -1.3, 80), pj(2.6, -1.3, 80), pj(2.6, -1.3, 1.0)];
      q.fillStyle = P.ceil; poly(q, [[-40, -40], [W + 40, -40], [W + 40, ce[3][1]], ce[3], ce[2], ce[1], ce[0], [-40, ce[0][1]]]); q.fill();
      q.strokeStyle = rgba(mode === 'dusk' ? '#3a2420' : '#8a5a40', mode === 'dusk' ? 0.55 : 0.6); q.lineWidth = 2;
      for (let X = -2.2; X <= 2.6; X += 0.4) { const a = pj(X, -1.3, 1.0), b = pj(X, -1.3, 80); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
      // 河边一排廊柱、檐枋、美人靠
      for (let i = POSTS7.length - 1; i >= 0; i--) {
        const Z = POSTS7[i], w = (0.24 * F7) / Z, top = pj(-2.2, -1.3, Z), bot = pj(-2.2, 1.6, Z), fk = fogK(Z);
        // 横梁
        q.fillStyle = mix(P.beam, P.haze, fk * 0.5); poly(q, [pj(-2.2, -1.3, Z), pj(2.6, -1.3, Z), pj(2.6, -1.0, Z), pj(-2.2, -1.0, Z)]); q.fill();
        if (P.paint && Z < 20) { q.strokeStyle = rgba(P.paint, 0.9 * (1 - fk)); q.lineWidth = Math.max(0.6, 4 / Z); poly(q, [pj(-2.2, -1.25, Z), pj(2.6, -1.25, Z), pj(2.6, -1.05, Z), pj(-2.2, -1.05, Z)]); q.stroke(); const m = pj(0.2, -1.15, Z); q.beginPath(); q.ellipse(m[0], m[1], 30 / Z * 4, 6 / Z * 4, 0, 0, TAU); q.stroke(); }
        q.fillStyle = mix(P.post, P.haze, fk * 0.55);
        q.fillRect(top[0] - w / 2, top[1], w, bot[1] - top[1]);
        if (P.ink) { q.strokeStyle = P.ink; q.lineWidth = Math.max(0.6, 5 / Z); q.strokeRect(top[0] - w / 2, top[1], w, bot[1] - top[1]); }
        // 柱上的木纹
        if (Z < 6) { q.strokeStyle = 'rgba(0,0,0,0.25)'; q.lineWidth = 1; for (let k = 0; k < 4; k++) { const xx = top[0] - w / 2 + w * (0.15 + 0.22 * k); q.beginPath(); q.moveTo(xx, top[1]); q.lineTo(xx + 2 * Math.sin(k), bot[1]); q.stroke(); } }
        // 迎光（灭点那一侧）的柱边
        q.fillStyle = rgba(P.rim, (mode === 'dusk' ? 0.75 : 0.5) * (1 - fk));
        q.fillRect(top[0] + w * 0.3, top[1], Math.max(1, w * 0.18), bot[1] - top[1]);
        // 两柱之间的美人靠
        if (i < POSTS7.length - 1) {
          const Z2 = POSTS7[i + 1], s0 = pj(-2.2, 1.15, Z), s1 = pj(-2.2, 1.15, Z2), b0 = pj(-2.45, 0.55, Z), b1 = pj(-2.45, 0.55, Z2);
          q.fillStyle = mix(P.rail, P.haze, fk * 0.5);
          poly(q, [s0, s1, pj(-2.2, 1.25, Z2), pj(-2.2, 1.25, Z)]); q.fill();
          q.strokeStyle = mix(P.rail, P.haze, fk * 0.5); q.lineWidth = Math.max(1, 6 / Z);
          q.beginPath(); q.moveTo(b0[0], b0[1]); q.lineTo(b1[0], b1[1]); q.stroke();
          for (let k = 1; k < 8; k++) { const zz = lerp(Z, Z2, k / 8), a = pj(-2.2, 1.15, zz), b = pj(-2.42, 0.6, zz); q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(b[0], b[1]); q.stroke(); }
        }
      }
      // 檐枋（河边一侧的长梁）
      q.fillStyle = P.beam; poly(q, [pj(-2.25, -1.45, 1.0), pj(-2.25, -1.45, 80), pj(-2.25, -1.05, 80), pj(-2.25, -1.05, 1.0)]); q.fill();
      // 暮霭 / 日光：灭点处最浓
      q.fillStyle = K.rad(q, VP7[0], VP7[1], 10, 360, [[0, rgba(P.haze, P.hazeA)], [1, rgba(P.haze, 0)]]); q.fillRect(0, 0, W, H);
    });
  }
  // 廊下灯笼：挂在河边檐枋下，两柱之间
  const LANT7 = [2.8, 5.8, 8.8, 11.8, 14.8, 17.8, 20.8, 23.8];
  // 笼屉（一摞竹编蒸笼）
  function steamer(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    for (let k = 0; k < 3; k++) {
      const yy = -k * 9;
      g.fillStyle = k % 2 ? '#c89a5a' : '#b88848'; g.beginPath(); g.ellipse(0, yy, 22, 6, 0, 0, TAU); g.fill();
      g.fillRect(-22, yy - 8, 44, 8);
      g.fillStyle = '#e0b878'; g.beginPath(); g.ellipse(0, yy - 8, 22, 6, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-22, yy - 4); g.lineTo(22, yy - 4); g.stroke();
    }
    g.fillStyle = '#d8ac6a'; g.beginPath(); g.ellipse(0, -27, 20, 5, 0, 0, TAU); g.fill();
    g.fillStyle = '#9a6a38'; g.fillRect(-3, -32, 6, 4);
    g.restore();
  }

  XYT.registerShot('va7_lookback', {
    name: '回首旧街', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(30,16,26,0.92)', accent: '#ffa631', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tHui = charAt(c, 1, 0.56), tWang = charAt(c, 3, 1.86);
      const be = c.be ? c.be(0.3) : 0;
      if (lt < tWang) {
        // ---------- 现在：暮色廊棚 ----------
        prof(g, 'bg', () => { g.imageSmoothingEnabled = false; g.drawImage(arcade7('dusk'), 0, 0, W, H); g.imageSmoothingEnabled = true; });
        // 长廊尽头的夕照：斜斜的光束沿着廊子铺过来，随拍轻轻一涨
        prof(g, 'rays', () => V.godRays(g, c, { x: VP7[0] - 70, y: VP7[1] - 12, angle: 0.62, spread: 1.9, n: 8, len: 980, start: 0.06, width: 0.8, color: '#ffbe78', alpha: 0.16, res: 0.2, source: false, night: true, seed: 7, beat: 0.4 }));
        // 灯笼：从近到远，随拍（半拍一盏）逐盏亮起
        const t0 = t - lt;
        let tFirst = 0.05;
        if (c.grid && c.b) { for (let k = -4; k <= 2; k++) { const tt = c.grid.time(c.b.i + k) - t0; if (tt >= -0.05) { tFirst = tt; break; } } }
        const per = c.b && c.b.period ? c.b.period : 0.833;
        prof(g, 'lant', () => {
          for (let i = LANT7.length - 1; i >= 0; i--) {
            const Z = LANT7[i], [x, y] = pj(-1.95, -1.05, Z), s7 = 0.62 * 4 / Z * 1.6;
            const tOn = tFirst + i * per * 0.5;
            const lit = smooth(clamp((lt - tOn) / 0.18));
            const pop = lt > tOn ? Math.exp(-(lt - tOn) / 0.3) : 0;
            E.lantern(g, { x, y, s: s7, t, seed: i * 3, lit, swing: 0.05, cord: 10, color: '#c8302a', glowColor: '#ffa040' });
            if (lit > 0.01) add(g, () => {
              glow(g, x, y + 22 * s7, 70 * s7 * (1 + 0.4 * pop), '#ffb050', 0.35 * lit + 0.3 * pop);
              // 河面的倒影：一竖道碎光
              const ry = pj(-2.6, 2.4, Z)[1] + (2.4 + 1.05) * F7 / Z * 0.35;
              for (let k = 0; k < 4; k++) glow(g, x - 30 / Z * 4 + Math.sin(t * 3 + k * 2 + i) * 3, ry + k * 7 * 4 / Z, 10 * s7, '#ffa040', 0.22 * lit);
            });
          }
        });
        // 白发人：沿廊向镜头左侧慢慢走出，“回”字上停步回首，望向灭点那头的夕照（往事的方向）
        const sF = 2.4, fy = 772;
        const turn = smooth(clamp((lt - tHui) / 0.14));
        const tStop = tHui + 0.05;
        const base = { stage: 'old', facing: -1, wind: 0.25, windDir: -1, prop: 'sword', ink: '#1c1518', whiteHair: true, rim: '#ffc070', light: [VP7[0] + 200, VP7[1] - 60], seed: 4 };
        const ws = F.walkSpeed('xiaoyao', sF, { stage: 'old', speed: 0.55 });
        const fx = 470 - ws * Math.min(Math.max(lt, -0.3), tStop);
        const tw = Math.min(t, t - lt + tStop);       // 停步后步态冻结
        prof(g, 'fig', () => {
          // 影子拖向镜头（左前）
          g.fillStyle = 'rgba(16,8,12,0.4)'; g.beginPath(); g.ellipse(fx - 50, fy + 4, 90, 10, 0, 0, TAU); g.fill();
          if (turn < 1) F.draw(g, 'xiaoyao', fx, fy, sF, tw, Object.assign({}, base, { pose: 'walk', speed: 0.55, alpha: turn > 0 ? 1 - turn : 1 }));
          if (turn > 0) F.draw(g, 'xiaoyao', fx, fy, sF, t, Object.assign({}, base, { pose: 'lookBack', alpha: turn }));
          // 白发与蓝发带：回首时滞后约 200ms 向外甩出，再落回肩后
          const pBefore = F.points('xiaoyao', fx, fy, sF, tw, Object.assign({}, base, { pose: 'walk', speed: 0.55 }));
          const pAfter = F.points('xiaoyao', fx, fy, sF, t, Object.assign({}, base, { pose: 'lookBack' }));
          const st = (tau) => smooth(clamp((tau - tHui) / 0.14));
          const whip = (tau) => { const u = tau - tHui; return u <= 0 ? 0 : Math.sin(PI * clamp(u / 0.6)) * Math.exp(-Math.max(0, u - 0.35) * 2); };
          const anchor = (tau) => {
            const k = st(tau), fd = lerp(-1, 1, k);      // 脸朝向：先朝左，回首后朝右
            const hx = lerp(pBefore.head[0], pAfter.head[0], k), hy = lerp(pBefore.head[1], pAfter.head[1], k);
            return [hx - fd * 7 * sF, hy - 3 * sF, fd];
          };
          // 每缕发是一条两头尖的细长笔触
          for (let k = 0; k < 8; k++) {
            const isRib = k >= 6, L = (isRib ? 50 : 46 + 34 * h2(k, 41)) * sF / 2.4, lag = 0.18 + 0.06 * h2(k, 44);
            const pts = [];
            for (let j = 0; j <= 7; j++) {
              const u = j / 7, tau = t - lag * u, [ax, ay, fd] = anchor(tau), w = whip(tau);
              const a = PI / 2 - fd * (0.3 + 0.07 * k + 0.85 * w) + 0.07 * Math.sin(t * 2.2 + k + u * 3);
              const bend = 0.25 * u * u * fd;
              pts.push([ax + Math.cos(a + bend) * L * u + (k - 3.5) * 0.9 * sF * (1 - u * 0.5), ay + Math.sin(a + bend) * L * u]);
            }
            const w0 = isRib ? 2.2 : 0.9 + 0.5 * h2(k, 43);
            const top = [], bot = [];
            for (let j = 0; j <= 7; j++) {
              const p0 = pts[Math.max(0, j - 1)], p1 = pts[Math.min(7, j + 1)];
              let nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
              const ww = w0 * Math.sin(PI * (0.15 + 0.85 * j / 7)) * sF / 2.4;
              top.push([pts[j][0] + nx * ww, pts[j][1] + ny * ww]); bot.push([pts[j][0] - nx * ww, pts[j][1] - ny * ww]);
            }
            g.fillStyle = isRib ? 'rgba(84,124,186,0.9)' : rgba('#f2eee8', 0.55);
            g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = 7; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); g.fill();
          }
          // 回首那一下，脸上被夕照点亮
          const lit = turn * Math.exp(-Math.max(0, lt - tHui - 0.25) / 0.8);
          if (lit > 0.01) add(g, () => glow(g, pAfter.head[0] + 10 * sF, pAfter.head[1], 60 * sF / 2.4, '#ffc880', 0.35 * lit));
        });
        // 逆光里的浮尘
        prof(g, 'dust', () => add(g, () => {
          for (let i = 0; i < 26; i++) {
            const x = 380 + h2(i, 11) * 700 + 20 * Math.sin(t * 0.3 + i), y = 160 + h2(i, 12) * 420 + 14 * Math.sin(t * 0.4 + i * 2);
            const near = clamp(1 - Math.hypot(x - VP7[0], y - VP7[1]) / 600);
            glow(g, x, y, 2 + 3 * h2(i, 13), '#ffe0a8', (0.25 + 0.4 * near) * (0.6 + 0.4 * Math.sin(t * 1.5 + i)));
          }
        }));
      } else {
        // ---------- 往事：晴天正午的同一条街，工笔重彩 ----------
        const u = lt - tWang;
        prof(g, 'mem', () => {
          g.imageSmoothingEnabled = false; g.drawImage(arcade7('noon'), 0, 0, W, H); g.imageSmoothingEnabled = true;
          // 河里一条乌篷船慢慢划过
          const bz = 9, bx = pj(-6.5, 2.4, bz)[0] + u * 40, by = pj(-6.5, 2.4, bz)[1];
          A.boat(g, bx, by, 0.5, '#3a2a22');
          g.fillStyle = '#1e1a1e'; g.beginPath(); g.ellipse(bx + 4, by - 12, 30, 12, 0, PI, TAU); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx - 70, by + 6); g.lineTo(bx + 70, by + 6); g.stroke();
          // 廊下的红灯笼（白天不点）与彩旗
          for (let i = LANT7.length - 1; i >= 0; i--) {
            const Z = LANT7[i], [x, y] = pj(-1.95, -1.05, Z);
            E.lantern(g, { x, y, s: 0.62 * 4 / Z * 1.6, t, seed: i * 3, lit: 0, swing: 0.06, cord: 10, color: '#d0302a' });
          }
          for (let i = 0; i < 3; i++) {
            const Z = 3.6 + i * 3, a = pj(-2.1, -1.1, Z), b = pj(2.5, -1.1, Z + 1.2);
            g.strokeStyle = 'rgba(60,40,30,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 40 / Z * 4, b[0], b[1]); g.stroke();
            for (let k = 1; k < 9; k++) {
              const v = k / 9, x = lerp(a[0], b[0], v), y = lerp(a[1], b[1], v) + Math.sin(PI * v) * 40 / Z * 4, sz = 22 / Z * 4;
              g.fillStyle = ['#d8322a', '#f0c040', '#2f7ab8', '#3a9a6a'][(k + i) % 4];
              poly(g, [[x - sz * 0.4, y], [x + sz * 0.4, y], [x + 1.5 * Math.sin(t * 4 + k), y + sz]]); g.fill();
            }
          }
          // 人群：不同远近的路人来来往往
          const crowd = [[6.5, -0.6, 1, 1], [9, 0.9, -1, 2], [4.2, 1.6, -1, 3], [12, -0.2, 1, 0], [15, 1.2, -1, 1], [7.5, 2.0, 1, 2], [3.2, 0.8, 1, 0]];
          const order = crowd.map((cr, i) => [cr, i]).sort((a, b) => b[0][0] - a[0][0]);
          let youthDrawn = false;
          const youth = () => {
            // 少年店小二：端着冒热气的笼屉在人群里钻过（与白发人站在同一处）
            const Z = 2.3, s0 = (1.72 * F7) / Z / 176, [x0, y0] = pj(-1.35, 1.6, Z);
            const x = x0 - 40 + u * 190, y = y0;
            F.draw(g, 'xiaoyao', x, y, s0, t, { stage: 'youth', pose: 'walk', facing: 1, wind: 0.3, seed: 8, speed: 1.4 });
            const P = F.points('xiaoyao', x, y, s0, t, { stage: 'youth', pose: 'walk', facing: 1, seed: 8, speed: 1.4 });
            steamer(g, P.chest[0] + 22 * s0, P.chest[1] + 6 * s0, s0 * 0.8);
            for (let k = 0; k < 8; k++) {
              const v = ((t * 0.9 + k / 8) % 1), sx = P.chest[0] + 22 * s0 + Math.sin(t * 2 + k) * 6 - v * 40, sy = P.chest[1] - 18 * s0 - v * 140;
              // 白墙前的热气：先垫一层灰蓝的暗面，再叠白
              glow(g, sx + 5 + v * 4, sy + 6, 18 + v * 36, '#7a8496', 0.35 * Math.sin(v * PI));
              glow(g, sx, sy, 16 + v * 34, '#ffffff', 0.75 * Math.sin(v * PI));
            }
          };
          for (const [[Z, X, f, v], i] of order) {
            if (!youthDrawn && Z < 2.6) { youth(); youthDrawn = true; }
            const s0 = (1.7 * F7) / Z / 172, [x, y] = pj(X, 1.6, Z);
            const vx = f * F.walkSpeed('villager', s0, {});
            F.draw(g, 'villager', x + vx * (u + 0.5) * 0.7, y, s0, t, { pose: 'walk', facing: f, seed: i * 5 + 1, variant: v, wind: 0.2, speed: 0.7, accent: ['#2f6eb0', '#c8402a', '#3a8a5a', '#d89a30'][i % 4] });
          }
          if (!youthDrawn) youth();
          // 硬切进来的一下亮
          const fl = Math.exp(-u / 0.07);
          if (fl > 0.02) { g.fillStyle = rgba('#fff8e8', 0.5 * fl); g.fillRect(0, 0, W, H); }
          // 画卷边缘的暗角
          g.fillStyle = K.rad(g, 640, 360, 300, 820, [[0, 'rgba(120,70,30,0)'], [1, 'rgba(120,70,30,0.45)']]); g.fillRect(0, 0, W, H);
        });
      }
    },
  });

  // ======================================================================
  // 8 枫落成忆：客栈后院大枫树下的小水池，暮色；四片红叶踩着“枫、一、片、落”落进水里，涟漪里映出旧人旧物
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
  // 背景：暮色天光、远处虚化的白墙与树、对岸的草；水面底色（一张）
  function va8Bg() {
    return cache('va8_bg2', W, H, 1, (q) => {
      q.fillStyle = '#3a2638'; q.fillRect(0, 0, W, H);
      const far = E.util.cached('g03:va8_far2', [], W, HZ8 + 40, 0.12, (b) => {
        const r = A.rng(81);
        b.fillStyle = K.lin(b, 0, 0, 0, HZ8, [[0, '#3a2638'], [0.35, '#8a4a44'], [0.7, '#d88a52'], [1, '#eccb98']]); b.fillRect(0, 0, W, HZ8 + 40);
        b.fillStyle = K.rad(b, 860, 150, 10, 560, [[0, 'rgba(255,236,190,1)'], [0.25, 'rgba(255,186,110,0.55)'], [1, 'rgba(255,140,90,0)']]); b.fillRect(0, 0, W, HZ8 + 40);
        // 远墙（逆光，暖灰）与墙头远树
        b.fillStyle = 'rgba(150,104,96,0.8)'; b.fillRect(-20, 230, W + 40, HZ8 - 200);
        b.fillStyle = 'rgba(60,36,44,0.8)'; b.fillRect(-20, 220, W + 40, 14);
        for (let i = 0; i < 16; i++) { b.fillStyle = rgba(i % 3 ? '#5a3644' : '#a0422e', 0.45); A.inkBlob(b, r() * W, 190 + r() * 40, 40 + r() * 50, i, 0.4); b.fill(); }
        // 对岸的草与石（低矮、柔）
        for (let i = 0; i < 10; i++) { b.fillStyle = rgba('#2e2228', 0.7); A.inkBlob(b, r() * W, HZ8 + 4, 30 + r() * 50, i + 20, 0.3); b.fill(); }
        // 左上更暗（字在这里）
        b.fillStyle = K.lin(b, 0, 0, 560, 0, [[0, 'rgba(24,14,22,0.8)'], [1, 'rgba(24,14,22,0)']]); b.fillRect(0, 0, 560, HZ8 + 40);
      });
      q.drawImage(far, -8, -8, W + 16, HZ8 + 48);
      // 水：远岸处反天光（暖），往近处沉成墨青
      q.fillStyle = K.lin(q, 0, HZ8, 0, H, [[0, '#8a6a5a'], [0.1, '#4a4848'], [0.35, '#1e2a2a'], [1, '#0a1212']]);
      q.fillRect(0, HZ8, W, H - HZ8);
      q.save(); q.globalAlpha = 0.3; q.translate(0, HZ8 * 2 + 30); q.scale(1, -1); q.drawImage(far, 0, 0, W, HZ8 + 40); q.restore();
      q.fillStyle = K.lin(q, 0, HZ8, 0, H, [[0, 'rgba(10,18,18,0)'], [0.45, 'rgba(10,18,18,0.55)'], [1, 'rgba(8,14,14,0.85)']]); q.fillRect(0, HZ8, W, H - HZ8);
      // 太阳在水里的一道光
      q.save(); q.translate(860, HZ8 + 6); q.scale(1, 3.2);
      q.fillStyle = K.rad(q, 0, 0, 2, 110, [[0, 'rgba(255,214,150,0.5)'], [1, 'rgba(255,190,120,0)']]); q.fillRect(-130, -10, 260, 130); q.restore();
      // 近岸的软边：对岸草丛的倒影，一线柔暗
      q.fillStyle = K.lin(q, 0, HZ8 - 6, 0, HZ8 + 14, [[0, 'rgba(20,14,16,0)'], [0.5, 'rgba(20,14,16,0.55)'], [1, 'rgba(20,14,16,0)']]); q.fillRect(0, HZ8 - 6, W, 20);
      const r = A.rng(83);
      // 对岸草丛：一丛丛疏密不一，叶尖受光
      for (let cl = 0; cl < 16; cl++) {
        const cx = r() * W, n = 4 + Math.floor(r() * 9), hh = 10 + r() * 26;
        for (let i = 0; i < n; i++) {
          const x = cx + (r() - 0.5) * 30, h = hh * (0.5 + r() * 0.6), lean = (r() - 0.4) * 14;
          q.strokeStyle = rgba('#241a1a', 0.65 + r() * 0.3); q.lineWidth = 0.8 + r() * 1.2;
          q.beginPath(); q.moveTo(x, HZ8 + 4); q.quadraticCurveTo(x + lean * 0.3, HZ8 - h * 0.6, x + lean, HZ8 - h); q.stroke();
        }
      }
      q.strokeStyle = 'rgba(255,200,150,0.07)'; q.lineWidth = 1;
      for (let i = 0; i < 50; i++) { const y = HZ8 + 10 + Math.pow(r(), 1.3) * (H - HZ8), x = r() * W; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 20 + r() * 80, y); q.stroke(); }
    });
  }
  // 枫枝：从右上伸进来横过画面上沿，叶簇浓密、逆光透亮；画进一张贴图，绕根部微微摆动
  // 贴图覆盖世界坐标 x 380..1300、y -40..300
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
  function memory(g, kind, x, y, R, t, a) {
    const sc = R / 170;
    V.util.viaScratch(g, 'g03_va8_mem', [x - R, y - R * 1.25, x + R, y + R * 0.45], 0.6, 'screen', a, (q) => {
      const fy = y + R * 0.18;
      if (kind === 'yueru') F.draw(q, 'yueru', x, fy, 0.95 * sc, t, { pose: 'swordPoint', facing: -1, wind: 0.6, glow: 0.6, glowColor: '#ff6a50' });
      else if (kind === 'linger') F.draw(q, 'linger', x, fy, 0.95 * sc, t, { pose: 'lookBack', facing: 1, wind: 0.7, glow: 0.7, glowColor: '#f4eeff' });
      else if (kind === 'gourd') { A.glow(q, x, y - R * 0.4, R * 0.5, '#ffd890', 0.22); E.gourd(q, { x, y: y - R * 0.02, s: 2.3 * sc, t, angle: -0.35 + 0.1 * Math.sin(t * 2) }); }
      else { A.glow(q, x, y - R * 0.45, R * 0.45, '#ffe070', 0.35); butterfly8(q, x + 10 * Math.sin(t * 1.7), y - R * 0.45 + 6 * Math.sin(t * 2.3), 2.4 * sc, t); }
      // 圆形柔边遮罩
      q.globalCompositeOperation = 'destination-in';
      q.fillStyle = K.rad(q, x, y - R * 0.4, R * 0.25, R * 0.9, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      q.fillRect(x - R, y - R * 1.3, R * 2, R * 1.8);
      q.globalCompositeOperation = 'source-over';
    });
  }

  XYT.registerShot('va8_maple', {
    name: '枫落成忆', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(30,14,14,0.92)', accent: '#dc3023', bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      const tl = HERO8.map((L, i) => charAt(c, L.ci, [0.98, 1.96, 2.6, 3.06][i]));
      const tSeal = charAt(c, 7, 3.06) + 0.27;
      const be = c.be ? c.be(0.3) : 0;
      const wind = 0.5 + 0.5 * Math.sin(t * 0.8);
      prof(g, 'bg', () => {
        g.imageSmoothingEnabled = false; g.drawImage(va8Bg(), 0, 0, W, H); g.imageSmoothingEnabled = true;
      });
      // 枝的倒影（暗红、摇晃）
      const sw = 0.012 * Math.sin(t * 1.1) + 0.008 * wind;
      prof(g, 'refl', () => {
        // 低分辨率的枝影（天然虚化），分成横条按正弦错开，像水面轻晃
        const lo = E.util.cached('g03:va8_brlo', [], BR8.w, BR8.h, 0.3, (q) => q.drawImage(va8Branch(), 0, 0, BR8.w, BR8.h));
        const n = 14, sh = BR8.h / n;
        g.save(); g.globalAlpha = 0.17;
        g.translate(BR8.ox, 2 * HZ8 + 26 - BR8.oy); g.scale(1, -0.92); g.rotate(-sw);
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
          drawLeaf(g, i % 4, 0, 0, sc, h2(i, 54) * TAU + 0.1 * Math.sin(t + i), 1, 0.5);
          g.restore();
        }
      });
      // 落水：涟漪、回忆剪影
      prof(g, 'ripple', () => {
        for (let i = 0; i < 4; i++) {
          const L = HERO8[i], T = tl[i], d = lt - T;
          if (d < 0 || d > 2.6) continue;
          const pk = 0.45 + 0.55 * (L.at[1] - HZ8) / (H - HZ8);
          // 回忆显影：0.08 秒浮现，停 0.35 秒，0.25 秒淡去
          const ma = 0.55 * smooth(clamp(d / 0.08)) * (1 - smooth(clamp((d - 0.43) / 0.25)));
          if (ma > 0.005) memory(g, L.mem, L.at[0], L.at[1], 230 * pk, t, ma);
          g.lineWidth = 1.4;
          for (let k = 0; k < 3; k++) {
            const dd = d - k * 0.22; if (dd < 0) continue;
            const R = (14 + dd * 120) * pk, a = 0.6 * Math.exp(-dd / 0.9);
            g.strokeStyle = rgba('#ffe0b8', a);
            g.beginPath(); g.ellipse(L.at[0], L.at[1], R, R * 0.32 * pk + R * 0.08, 0, 0, TAU); g.stroke();
          }
          // 落水那一下的光
          add(g, () => glow(g, L.at[0], L.at[1], 50 * pk, '#ffd8a0', 0.5 * Math.exp(-d / 0.25)));
        }
      });
      // 枝（绕根部轻摇）与逆光
      prof(g, 'branch', () => {
        add(g, () => { glow(g, 800, 150, 260, '#ffb070', 0.3 + 0.08 * be); glow(g, 640, 120, 160, '#ffd090', 0.2); });
        g.save(); g.translate(BR8.ox, BR8.oy); g.rotate(sw); g.drawImage(va8Branch(), BR8.x0 - BR8.ox, BR8.y0 - BR8.oy, BR8.w, BR8.h); g.restore();
      });
      // 主角叶：下落、翻面、水中倒影、落水后漂着
      prof(g, 'leaves', () => {
        for (let i = 0; i < 4; i++) {
          const L = HERO8[i], T = tl[i];
          const pk = 0.45 + 0.55 * (L.at[1] - HZ8) / (H - HZ8), s0 = 1.0 + 0.45 * pk;
          if (lt < T) {
            const P = leafAt(L, lt, T);
            if (P.u <= 0) continue;
            const h = L.at[1] - P.y;
            // 倒影：快落水时从下面迎上来
            if (h < 260) drawLeaf(g, L.k, P.x, L.at[1] + h * 0.9 * pk, s0 * 0.9, -P.rot, P.flip, 0.35 * (1 - h / 260));
            drawLeaf(g, L.k, P.x, P.y, s0, P.rot, P.flip, 1);
          } else {
            const d = lt - T, bob = Math.sin(d * 5) * Math.exp(-d * 1.5) * 3;
            // 落定后平躺在水面：竖向压扁
            g.save(); g.translate(L.at[0] + d * 6, L.at[1] + bob - 3 * pk); g.scale(1, 0.42 + 0.3 * Math.exp(-d * 3));
            drawLeaf(g, L.k, 0, 0, s0 * pk * 1.1, L.k + 5 + 0.05 * Math.sin(t), 1, 1);
            g.restore();
          }
        }
      });
      // 夕光里的浮尘
      prof(g, 'dust', () => add(g, () => {
        for (let i = 0; i < 20; i++) {
          const x = 480 + h2(i, 61) * 700 + 24 * Math.sin(t * 0.3 + i), y = 120 + h2(i, 62) * 300 + 14 * Math.sin(t * 0.45 + i * 2);
          glow(g, x, y, 2 + 3 * h2(i, 63), '#ffe0a8', 0.3 + 0.3 * Math.sin(t * 1.4 + i) + 0.2 * be);
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
    const jobs = () => [va5Bg, () => sprigTex(true), () => sprigTex(false), roundelTex, va6Bg, () => arcade7('dusk'), () => arcade7('noon'), () => { for (let k = 0; k < 4; k++) leafTex(k); }, va8Bg, va8Branch,
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
