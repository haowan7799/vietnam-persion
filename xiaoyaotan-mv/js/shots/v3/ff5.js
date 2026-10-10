/* 第三版镜头组 ff5：e5_inkrain, e6_peony, e7_fireflies */
(function () {
  'use strict';
  const A = XYT.art, K = XYT.kit, W = A.W, H = A.H, TAU = Math.PI * 2;
  const { clamp, lerp, smooth, easeInOut, h2, rgba, mix } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;
  const sstep = (a, b, x) => smooth((x - a) / (b - a));

  // ---------- 公用：值噪声与逐像素贴图 ----------
  function makeNoise(seed) {
    const N = 256, tab = new Float32Array(N * N), r = A.rng(seed);
    for (let i = 0; i < N * N; i++) tab[i] = r();
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
      const a = tab[y0 * N + x0], b = tab[y0 * N + x1], c = tab[y1 * N + x0], d = tab[y1 * N + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  // 在缓存画布上按设备像素逐点着色；fn(X, Y, out) 写入 out[0..3]
  function pixels(g, x0, y0, w, h, fn) {
    const sc = g.getTransform().a;
    const pw = Math.max(1, Math.round(w * sc)), ph = Math.max(1, Math.round(h * sc));
    const tmp = document.createElement('canvas'); tmp.width = pw; tmp.height = ph;
    const tg = tmp.getContext('2d'), id = tg.createImageData(pw, ph), d = id.data, o = [0, 0, 0, 255];
    for (let py = 0; py < ph; py++) {
      const Y = y0 + (py + 0.5) / sc;
      for (let px = 0; px < pw; px++) {
        o[3] = 255;
        fn(x0 + (px + 0.5) / sc, Y, o);
        const k = (py * pw + px) * 4;
        d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = o[3];
      }
    }
    tg.putImageData(id, 0, 0);
    g.drawImage(tmp, x0, y0, w, h);
  }
  // 每帧复用的离屏画布（每次使用前整块清空，不保存帧间状态）
  const scratch = {};
  function scratchCanvas(name, w, h) {
    const sc = SS();
    let c = scratch[name];
    const pw = Math.round(w * sc), ph = Math.round(h * sc);
    if (!c) { c = scratch[name] = document.createElement('canvas'); }
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.setTransform(sc, 0, 0, sc, 0, 0);
    return { c, g };
  }

  // =====================================================================
  // e5_inkrain：雨夜摩崖，檐水把墨迹冲成墨流
  // =====================================================================
  const E5 = (function () {
    const FOOT = 540;                          // 壁脚线（倒影翻转轴）
    const BIGX = 884;                          // 最大一笔所在竖带
    const LX = -0.55, LY = -0.83;              // 主光方向（指向左上的远处微光）
    // 檐口：起伏的岩口，几处下垂的石牙（最大一笔正上方一处，水从那里汇下）
    const TEETH = [[300, 16, 26], [612, 12, 22], [884, 15, 18], [1012, 10, 16], [1160, 18, 30]];
    const lipY = (x) => {
      let y = 156 + 30 * (1 - x / W) + 20 * (A.noise1(x * 0.005, 3) - 0.5) + 9 * (A.noise1(x * 0.021, 5) - 0.5) + 3 * (A.noise1(x * 0.09, 7) - 0.5);
      for (const [tx, a, w] of TEETH) { const u = 1 - Math.abs(x - tx) / w; if (u > 0) y += a * u * u * (3 - 2 * u); }
      return y;
    };
    // 壁脚：起伏不平，几处坍落的碎石堆；积水后面一段几乎是平的（倒影的翻转轴）
    const TALUS = [[318, 62, 17], [646, 44, 11], [176, 34, 8], [1236, 40, 9]];
    const footY = (x) => {
      const flat = 1 - 0.88 * sstep(690, 760, x) * (1 - sstep(1190, 1250, x));
      let y = FOOT + flat * (26 * (A.noise1(x * 0.007, 9) - 0.5) + 9 * (A.noise1(x * 0.03, 4) - 0.5)) + 2 * (A.noise1(x * 0.08, 6) - 0.5);
      for (const [tx, w, h] of TALUS) { const u = (x - tx) / w; if (Math.abs(u) < 1) y -= h * Math.pow(Math.cos(u * Math.PI / 2), 1.6) * (0.85 + 0.3 * A.noise1(x * 0.05, tx)); }
      return y;
    };
    const butX = (y) => 118 + 14 * Math.sin(y * 0.011 + 0.5) + 10 * (A.noise1(y * 0.03, 12) - 0.5) + 5 * (A.noise1(y * 0.11, 13) - 0.5);
    // 积水轮廓
    const POOL = { cx: 972, cy: 628, rx: 204, ry: 58 };
    const poolR = (a) => 1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.05 * Math.sin(a * 5 + 2.1) + 0.03 * Math.sin(a * 9 + 1);
    function poolPath(g) {
      g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU, r = poolR(a);
        const x = POOL.cx + Math.cos(a) * POOL.rx * r, y = POOL.cy + Math.sin(a) * POOL.ry * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    const POOL_TOP = POOL.cy - POOL.ry * 1.12, POOL_BOT = POOL.cy + POOL.ry * 1.12;

    // 维诺格（岩块节理）：返回到最近边界的距离与朝边界的方向
    function makeCells(seed, cw, ch, nx, ny) {
      const r = A.rng(seed), NX = nx + 3, NY = ny + 3;
      const SX = new Float32Array(NX * NY), SY = new Float32Array(NX * NY), T = new Float32Array(NX * NY);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        SX[k] = (i - 1 + 0.15 + 0.7 * r()) * cw; SY[k] = (j - 1 + 0.15 + 0.7 * r()) * ch; T[k] = r();
      }
      return function (X, Y, o) {
        const ci = Math.floor(X / cw) + 1, cj = Math.floor(Y / ch) + 1;
        let f1 = 1e12, f2 = 1e12, k1 = 0, k2 = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const j = cj + dj; if (j < 0 || j >= NY) continue;
          for (let di = -1; di <= 1; di++) {
            const i = ci + di; if (i < 0 || i >= NX) continue;
            const k = j * NX + i, dx = X - SX[k], dy = Y - SY[k], d = dx * dx + dy * dy;
            if (d < f1) { f2 = f1; k2 = k1; f1 = d; k1 = k; } else if (d < f2) { f2 = d; k2 = k; }
          }
        }
        const ux = SX[k2] - SX[k1], uy = SY[k2] - SY[k1], ul = Math.hypot(ux, uy) || 1;
        o.d = -((X - (SX[k1] + SX[k2]) / 2) * ux + (Y - (SY[k1] + SY[k2]) / 2) * uy) / ul;
        o.nx = ux / ul; o.ny = uy / ul; o.tone = T[k1]; o.tone2 = T[k2];
      };
    }
    // 明度 → 冷灰石色
    function rockCol(l, o, lich) {
      l = clamp(l, 0, 1);
      let r, gg, b;
      if (l < 0.45) { const u = l / 0.45; r = 14 + 46 * u; gg = 16 + 50 * u; b = 21 + 59 * u; }
      else { const u = (l - 0.45) / 0.55; r = 60 + 92 * u; gg = 66 + 94 * u; b = 80 + 92 * u; }
      if (lich) { r = lerp(r, r * 0.95 + 6, lich); gg = lerp(gg, gg * 1.06 + 6, lich); b = lerp(b, b * 0.88, lich); }
      o[0] = r; o[1] = gg; o[2] = b;
    }

    // ---------- 抽象草书：部件拼成的假字（不成任何真字），草写省笔，笔画间细牵丝相连 ----------
    const SH = {
      H: (x, y, L) => [[x, y, 0.66], [x + 0.2 * L, y - 0.03 * L, 0.56], [x + 0.78 * L, y - 0.1 * L, 0.54], [x + L, y - 0.11 * L, 0.68]],
      V: (x, y, L) => [[x, y, 0.86], [x + 0.02 * L, y + 0.5 * L, 0.76], [x, y + L, 0.7]],
      X: (x, y, L) => [[x, y, 0.86], [x + 0.02 * L, y + 0.5 * L, 0.72], [x - 0.01 * L, y + L, 0.04]],
      P: (x, y, L) => [[x, y, 0.82], [x - 0.18 * L, y + 0.42 * L, 0.56], [x - 0.62 * L, y + 0.84 * L, 0.04]],
      N: (x, y, L) => [[x, y, 0.26], [x + 0.34 * L, y + 0.3 * L, 0.52], [x + 0.72 * L, y + 0.6 * L, 0.95], [x + 0.98 * L, y + 0.64 * L, 0.05]],
      D: (x, y, L) => [[x, y, 0.4], [x + 0.22 * L, y + 0.26 * L, 0.85], [x + 0.3 * L, y + 0.44 * L, 0.55]],
      Z: (x, y, L) => [[x, y, 0.6], [x + 0.6 * L, y - 0.08 * L, 0.48], [x + 0.74 * L, y - 0.06 * L, 0.8], [x + 0.64 * L, y + 0.5 * L, 0.7], [x + 0.56 * L, y + 0.88 * L, 0.6]],
      G: (x, y, L) => [[x, y, 0.85], [x + 0.02 * L, y + 0.5 * L, 0.74], [x, y + 0.86 * L, 0.76], [x - 0.2 * L, y + 0.76 * L, 0.05]],
      T: (x, y, L) => [[x, y, 0.8], [x + 0.36 * L, y - 0.24 * L, 0.05]],
      W: (x, y, L) => [[x, y, 0.3], [x + 0.25 * L, y + 0.12 * L, 0.62], [x + 0.55 * L, y + 0.02 * L, 0.46], [x + 0.85 * L, y + 0.16 * L, 0.76], [x + L, y + 0.1 * L, 0.06]],
    };
    SH.C = (x, y, L) => [[x, y, 0.6], [x + 0.62 * L, y - 0.06 * L, 0.48], [x + 0.76 * L, y - 0.04 * L, 0.8], [x + 0.7 * L, y + 0.2 * L, 0.06]];
    // 假字部件（单位格坐标）：[笔形, x, y, 长度]；左右、上下随机拼合，草写连笔后不成真字
    const CMP = {
      L: [
        [['P', -0.18, -0.48, 0.42], ['V', -0.3, -0.18, 0.66]],
        [['D', -0.42, -0.4, 0.2], ['D', -0.44, -0.1, 0.2], ['T', -0.47, 0.32, 0.3]],
        [['H', -0.48, -0.18, 0.4], ['G', -0.3, -0.46, 0.92], ['T', -0.48, 0.2, 0.36]],
        [['H', -0.48, -0.22, 0.4], ['V', -0.3, -0.48, 0.96], ['P', -0.31, -0.16, 0.3], ['D', -0.27, -0.04, 0.16]],
        [['D', -0.38, -0.44, 0.18], ['Z', -0.48, -0.18, 0.3]],
        [['Z', -0.44, -0.46, 0.25], ['Z', -0.46, -0.2, 0.25], ['T', -0.48, 0.2, 0.34]],
        [['P', -0.24, -0.48, 0.3], ['P', -0.22, -0.24, 0.36], ['V', -0.32, -0.04, 0.5]],
        [['Z', -0.42, -0.44, 0.24], ['Z', -0.42, -0.2, 0.24], ['V', -0.42, -0.44, 0.94]],
      ],
      R: [
        [['V', 0.0, -0.16, 0.34], ['Z', 0.0, -0.16, 0.42], ['H', 0.02, 0.16, 0.38]],
        [['P', 0.04, -0.42, 0.86], ['Z', 0.06, -0.42, 0.42], ['H', 0.08, -0.14, 0.3], ['H', 0.08, 0.08, 0.3]],
        [['H', -0.06, -0.12, 0.56], ['G', 0.26, -0.44, 0.92], ['D', 0.06, 0.04, 0.16]],
        [['H', -0.06, -0.1, 0.54], ['N', 0.0, -0.44, 0.6], ['P', 0.32, 0.0, 0.26], ['D', 0.3, -0.42, 0.14]],
        [['V', 0.0, -0.4, 0.5], ['Z', 0.0, -0.4, 0.42], ['H', 0.04, -0.12, 0.3], ['P', 0.12, 0.1, 0.34], ['W', 0.2, 0.12, 0.34]],
        [['P', 0.06, -0.48, 0.3], ['Z', 0.04, -0.3, 0.38], ['P', 0.24, -0.16, 0.5], ['N', 0.22, 0.0, 0.32]],
        [['Z', -0.04, -0.3, 0.5], ['V', 0.16, -0.46, 0.6], ['V', 0.0, -0.36, 0.5], ['W', 0.0, 0.2, 0.5]],
      ],
      T: [
        [['H', -0.4, -0.36, 0.8], ['V', -0.18, -0.48, 0.22], ['V', 0.16, -0.48, 0.22]],
        [['P', 0.0, -0.48, 0.5], ['N', 0.0, -0.4, 0.46]],
        [['H', -0.32, -0.46, 0.64], ['V', -0.34, -0.36, 0.24], ['C', -0.34, -0.36, 0.7], ['V', 0.0, -0.46, 0.34], ['D', -0.2, -0.26, 0.1], ['D', 0.16, -0.26, 0.1]],
        [['V', -0.16, -0.46, 0.34], ['Z', -0.16, -0.46, 0.32], ['H', -0.14, -0.3, 0.26], ['H', -0.14, -0.14, 0.28]],
      ],
      B: [
        [['D', -0.36, 0.14, 0.16], ['W', -0.3, 0.26, 0.56], ['D', -0.02, 0.06, 0.16], ['D', 0.24, 0.1, 0.18]],
        [['H', -0.3, -0.02, 0.6], ['D', -0.36, 0.3, 0.14], ['D', -0.12, 0.3, 0.14], ['D', 0.1, 0.3, 0.14], ['D', 0.3, 0.28, 0.16]],
        [['H', -0.36, -0.04, 0.7], ['V', -0.18, 0.08, 0.32], ['Z', -0.18, 0.08, 0.38], ['H', -0.16, 0.36, 0.34]],
        [['H', -0.36, 0.1, 0.72], ['V', 0.0, -0.06, 0.54], ['P', -0.02, 0.12, 0.38], ['N', 0.02, 0.12, 0.38]],
        [['D', -0.05, -0.04, 0.16], ['Z', -0.24, 0.08, 0.3], ['W', -0.42, 0.3, 0.9]],
      ],
      S: [
        [['V', -0.26, -0.2, 0.4], ['Z', -0.26, -0.22, 0.52], ['H', -0.24, 0.12, 0.5], ['X', 0.0, -0.5, 1.0]],
        [['H', -0.4, -0.34, 0.8], ['P', 0.02, -0.34, 0.5], ['V', 0.0, -0.12, 0.62], ['D', 0.12, -0.04, 0.2]],
        [['D', -0.06, -0.48, 0.16], ['Z', -0.3, -0.3, 0.5], ['W', -0.46, 0.16, 0.96]],
        [['H', -0.3, -0.36, 0.6], ['H', -0.4, -0.1, 0.8], ['P', 0.0, -0.36, 0.86], ['N', 0.02, -0.04, 0.5]],
      ],
    };
    function glyph(rnd) {
      const pick = (a) => a[Math.floor(rnd() * a.length)];
      return rnd() < 0.7 ? pick(CMP.L).concat(pick(CMP.R)) : pick(CMP.T).concat(pick(CMP.B));
    }

    // 向心 Catmull-Rom（不过冲、不自打结），再按弧长 0.7px 重采样
    function spline(P) {
      const raw = [];
      const get = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
      const dd = (a, b) => Math.pow(Math.max(1e-4, Math.hypot(b[0] - a[0], b[1] - a[1])), 0.5);
      for (let i = 0; i < P.length - 1; i++) {
        const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
        const t0 = 0, t1 = dd(p0, p1), t2 = t1 + dd(p1, p2), t3 = t2 + dd(p2, p3);
        const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.4));
        const L = (a, b, ta, tb, t) => { const u = (t - ta) / (tb - ta || 1e-6); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
        for (let k = 0; k < n; k++) {
          const t = lerp(t1, t2, k / n);
          const A1 = L(p0, p1, t0, t1, t), A2 = L(p1, p2, t1, t2, t), A3 = L(p2, p3, t2, t3, t);
          const B1 = L(A1, A2, t0, t2, t), B2 = L(A2, A3, t1, t3, t), C = L(B1, B2, t1, t2, t);
          raw.push([C[0], C[1], lerp(p1[2], p2[2], smooth(k / n))]);
        }
      }
      const e = P[P.length - 1]; raw.push([e[0], e[1], e[2]]);
      const out = [{ x: raw[0][0], y: raw[0][1], p: raw[0][2], sl: 0 }];
      let acc = 0, sl = 0;
      for (let i = 1; i < raw.length; i++) {
        const d = Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
        acc += d; sl += d;
        if (acc >= 0.7 || i === raw.length - 1) { out.push({ x: raw[i][0], y: raw[i][1], p: raw[i][2], sl }); acc = 0; }
      }
      return out;
    }

      // 一行：假字（部件拼合，草写省笔），笔画之间以细牵丝相连，提笔处断开
    // 每个字用自己的随机数（列号、字号、重抽次数），便于单独重抽看着像真字的那个
    function column(seed, x0, y0, y1, sizes, s0, ink0, out, opt = {}) {
      const rc = A.rng(seed);
      const tot = sizes.reduce((a, b) => a + b, 0), kk = (y1 - y0) / tot;
      let y = y0, pen = null;
      const lift = () => { if (pen && pen.pts.length > 1) out.push(pen); pen = null; };
      sizes.forEach((sz0, ci) => {
        const rnd = A.rng(seed * 31 + ci * 977 + ((opt.reroll && opt.reroll[ci]) || 0) * 7919);
        const sz = sz0 * kk, cy = y + sz / 2; y += sz;
        const gl = glyph(rnd);
        const sx = Math.min(sz, s0 * 1.02) * (1.0 + rnd() * 0.16), sy = sz * (0.96 + rnd() * 0.08), sk = (rnd() - 0.5) * 0.4, rot = (rnd() - 0.5) * 0.2;
        const cx = x0 + (rnd() - 0.5) * 26, cr = Math.cos(rot), sr = Math.sin(rot);
        if (ci > 0 && rc() < 0.3) lift();
        gl.forEach(([nm, x, yy, L], k) => {
          if (k > 0 && k < gl.length - 1 && rnd() < 0.34) return;
          const jx = (rnd() - 0.5) * 0.12, jy = (rnd() - 0.5) * 0.1, jl = 0.9 + rnd() * 0.3;
          const P = SH[nm](x + jx, yy + jy, L * jl).map(([u, v, pp]) => {
            const xx = (u + v * sk) * sx, yv = v * sy;
            return [cx + xx * cr - yv * sr, cy + xx * sr + yv * cr, clamp(pp * (0.85 + rnd() * 0.3), 0.03, 1)];
          });
          // 牵丝太长就提笔（不让一根细线横穿整个字）
          const far = pen && Math.hypot(P[0][0] - pen.pts[pen.pts.length - 1][0], P[0][1] - pen.pts[pen.pts.length - 1][1]) > 0.5 * sz;
          if (k > 0) { const lf = rnd() < 0.06; if (lf || far) lift(); } else if (far) lift();
          if (!pen) pen = { pts: [], s: s0, ink: ink0 * (0.95 + rc() * 0.12), L: opt.L || (720 + rc() * 240), seed: Math.floor(rc() * 1e5) };
          else {
            const a = pen.pts[pen.pts.length - 1], b = P[0], dx = b[0] - a[0], dy = b[1] - a[1];
            pen.pts.push([a[0] + dx * 0.2 + (rnd() - 0.5) * 6, a[1] + dy * 0.12 - 4, 0.07]);
            pen.pts.push([a[0] + dx * 0.8 + (rnd() - 0.5) * 6, a[1] + dy * 0.84 - 3, 0.07]);
          }
          for (const q of P) pen.pts.push(q);
        });
      });
      lift();
    }
    // 笔画采样：法线、笔宽（笔压、方向：竖重横轻、上提更轻）、起笔藏锋与收笔出锋、沿笔的墨量
    function prepStroke(st) {
      const S = spline(st.pts), n = S.length;
      const total = S[n - 1].sl, s = st.s, seed = st.seed;
      for (let i = 0; i < n; i++) {
        const a = S[Math.max(0, i - 3)], b = S[Math.min(n - 1, i + 3)];
        let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        S[i].nx = -ty; S[i].ny = tx;
        const pr = clamp(S[i].p * (0.85 + 0.12 * Math.abs(ty) + 0.08 * ty), 0.02, 1.1);
        S[i].w0 = s * (0.012 + 0.21 * Math.pow(pr, 1.25));
      }
      for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = Math.max(0, i - 12); k <= Math.min(n - 1, i + 12); k++) { a += S[k].w0; c++; } S[i].w = a / c; }
      const eL = Math.min(total * 0.12, 16), xL = Math.min(total * 0.14, 28);
      const sharp = S[n - 1].p < 0.12;
      const box = [1e9, 1e9, -1e9, -1e9];
      for (let i = 0; i < n; i++) {
        const q = S[i], u0 = q.sl / eL, u1 = (total - q.sl) / xL;
        if (u0 < 1) q.w *= 0.72 + 0.28 * smooth(u0) + 0.05 * Math.sin(Math.PI * u0);
        if (u1 < 1) q.w *= sharp ? 0.08 + 0.92 * Math.pow(smooth(u1), 0.75) : 0.82 + 0.18 * smooth(u1);
        q.w *= 1 + 0.07 * (A.noise1(q.sl * 0.08, seed) - 0.5);
        q.ink = st.ink * Math.exp(-q.sl / st.L);
        q.dry = clamp((0.62 - q.ink) / 0.5, 0, 1);
        box[0] = Math.min(box[0], q.x - q.w); box[1] = Math.min(box[1], q.y - q.w); box[2] = Math.max(box[2], q.x + q.w); box[3] = Math.max(box[3], q.y + q.w);
      }
      st.S = S; st.box = box;
    }
    // 毛笔：墨足处整笔铺满；墨将尽处改成一束细毫分别走笔，边上的毫先干、一段段断开，尾端参差（飞白），收笔不留圆头
    function renderStroke(g, st, col) {
      const S = st.S, n = S.length, seed = st.seed, [x0, y0, x1, y1] = st.box;
      if (n < 3) return;
      const sc = g.getTransform().a, pad = 4;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil((x1 - x0 + 2 * pad) * sc); cv.height = Math.ceil((y1 - y0 + 2 * pad) * sc);
      const t = cv.getContext('2d');
      t.setTransform(sc, 0, 0, sc, -(x0 - pad) * sc, -(y0 - pad) * sc);
      t.strokeStyle = col; t.lineCap = 'round'; t.lineJoin = 'round';
      const DRY0 = 0.04;
      for (let i = 0; i < n - 1; i++) {
        const a = S[i], b = S[i + 1];
        // 细笔（牵丝、尖尾）墨枯时整条断续
        if (a.w < 6 && (a.dry > 0.35 || (a.dry > 0.12 && a.dry * 1.4 > 0.3 + 0.5 * (A.noise1(a.sl * 0.035, seed + 77) - 0.5)))) continue;
        if (a.ink < 0.06) continue;
        if (a.w >= 6 && a.dry > DRY0) continue;
        t.lineWidth = (a.w + b.w) / 2; t.beginPath(); t.moveTo(a.x, a.y); t.lineTo(b.x, b.y); t.stroke();
      }
      // 枯笔毛束：毫与毫在墨足时互相叠满（看起来仍是整笔），越枯越细、越稀
      const total = S[n - 1].sl, dryEnd = S[n - 1].dry, tail = Math.min(46, total * 0.3);
      const M = 15, rs = A.rng(seed + 5);
      for (let k = 0; k < M; k++) {
        const o0 = ((k + 0.5) / M - 0.5) * 0.94 + (rs() - 0.5) * 0.03, e = Math.min(1, Math.abs(o0) * 2.1);
        const sens = 0.6 + 0.5 * e + 0.2 * (rs() - 0.5);
        const cut = total - (dryEnd > 0.08 ? tail * (0.04 + 0.96 * Math.pow(rs(), 0.7)) * Math.min(1, dryEnd * 2.2) : 0);
        for (let i = 0; i < n - 1; i++) {
          const a = S[i], b = S[i + 1];
          if (a.w < 6 || a.dry <= DRY0 || a.sl > cut) continue;
          const v = a.dry * sens * 0.6 + 0.42 * (A.noise1(a.sl * 0.018 + k * 3.7, seed + k) - 0.5) + 0.14 * (A.noise1(a.sl * 0.07 + k * 1.3, seed + 40 + k) - 0.5);
          if (v > 0.4) continue;
          const oa = o0 + 0.03 * (A.noise1(a.sl * 0.03 + k, seed + 60) - 0.5), ob = o0 + 0.03 * (A.noise1(b.sl * 0.03 + k, seed + 60) - 0.5);
          t.lineWidth = Math.max(0.6, (a.w / M) * lerp(1.75, 1.0, smooth(a.dry)));
          t.beginPath(); t.moveTo(a.x + a.nx * oa * a.w, a.y + a.ny * oa * a.w); t.lineTo(b.x + b.nx * ob * b.w, b.y + b.ny * ob * b.w); t.stroke();
        }
      }
      g.drawImage(cv, x0 - pad, y0 - pad, cv.width / sc, cv.height / sc);
    }
    let LAYOUT = null;
    // 草书的随机种子；REROLL[行][字] 用来单独重抽看着像真字的那个字
    const CAL_SEED = 61, REROLL = { 0: { 0: 3, 1: 2 }, 1: { 1: 12 }, 2: { 2: 13 }, 3: { 0: 10, 1: 9 } };
    // 细流的路径：噪声游走约 ±3px（经过笔画时另加小折，见 layout）
    const xsOf = (x0) => (y) => x0 + 6 * (A.noise1(y * 0.016 + x0 * 0.37, 17) - 0.5) + 1.6 * (A.noise1(y * 0.06 + x0 * 0.11, 19) - 0.5);
    function layout() {
      if (LAYOUT) return LAYOUT;
      const strokes = [], R = A.rng(CAL_SEED);
      // 四行，自右向左；字有大小，草写连绵；最左一行墨将尽（枯笔飞白）
      const cols = [
        { x: 1046, s: 120, n: 3, ink: 1.1 },
        { x: 734, s: 124, n: 2, ink: 1.02 },
        { x: 578, s: 116, n: 3, ink: 0.92 },
        { x: 424, s: 112, n: 2, ink: 0.62, L: 300 },
      ];
      cols.forEach((c, i) => {
        const sz = []; for (let k = 0; k < c.n; k++) sz.push(0.7 + R() * 0.7);
        column(CAL_SEED * 13 + i, c.x, 212, 526, sz, c.s, c.ink, strokes, { L: c.L, reroll: REROLL[i] });
      });
      // 第二行：上方一个小字，下面是全篇最大的一竖（悬针）
      column(CAL_SEED * 13 + 7, 890, 194, 242, [1], 56, 1.05, strokes, { reroll: REROLL[7] });
      strokes.push({ pts: [[BIGX - 12, 252, 0.6], [BIGX - 3, 260, 1.0], [BIGX + 1, 282, 0.95], [BIGX + 3, 340, 0.82], [BIGX + 4, 405, 0.62], [BIGX + 2, 455, 0.36], [BIGX, 488, 0.15], [BIGX - 1, 514, 0.02]], s: 180, ink: 1.45, L: 300, big: true, seed: 991 });
      strokes.forEach((st) => prepStroke(st));
      // 一条细流经过哪些笔画（墨足处）
      const crossings = (xs) => {
        const hit = new Uint8Array(720);
        for (const st of strokes) {
          if (st.big) continue;
          for (const q of st.S) {
            if (q.ink < 0.3) continue;
            const yy = Math.round(q.y);
            if (yy < 2 || yy >= 718) continue;
            if (Math.abs(q.x - xs(q.y)) < q.w * 0.45) for (let d = -2; d <= 2; d++) hit[yy + d] = 1;
          }
        }
        const out = []; let a0 = -1;
        for (let y = 0; y < 720; y++) {
          if (hit[y] && a0 < 0) a0 = y;
          if (!hit[y] && a0 >= 0) { if (y - a0 > 3) out.push([a0, y]); a0 = -1; }
        }
        return out;
      };
      // 檐水细流：每行挑两处笔画最密的竖线（第1句第1字起，到第4字时每行都已流过笔画），另有两道只是湿痕
      const picks = [[], []];
      for (const cx of [1046, 734, 578]) {
        const cand = [];
        for (let x = cx - 44; x <= cx + 44; x += 2) cand.push([x, crossings(xsOf(x)).reduce((acc, [ya, yb]) => acc + yb - ya, 0)]);
        cand.sort((u, v) => v[1] - u[1]);
        const x1 = cand[0][0], x2 = (cand.find(([x]) => Math.abs(x - x1) >= 16) || cand[1])[0];
        picks[0].push(x1); picks[1].push(x2);
      }
      const T0 = [0.26, 0.4, 0.55, 0.7, 0.86, 1.02];
      const riv = picks[0].concat(picks[1]).map((x, k) => ({ x, t0: T0[k], v: 86 + 16 * h2(k, 5) }));
      riv.push({ x: 1150, t0: 1.5, v: 98 }, { x: 318, t0: 2.1, v: 90 });
      for (const r of riv) {
        r.y0 = lipY(r.x) + 3;
        // 水流出笔画下缘时被墨面带偏一点（±1–2.5px 的小折）
        const xs0 = xsOf(r.x), kinks = crossings(xs0).map(([, yb], i) => [yb, (h2(i, r.x | 0) < 0.5 ? -1 : 1) * (1 + 1.5 * h2(i + 9, r.x | 0))]);
        r.xs = (y) => { let x = xs0(y); for (const [yb, k] of kinks) x += k * smooth((y - yb + 2) / 9); return x; };
        r.cross = crossings(r.xs);
      }
      // 迎风（右半）笔画下缘的雨淋短流痕
      const drips = [], dr = A.rng(919);
      for (const st of strokes) {
        if (st.big) continue;
        for (let i = 6; i < st.S.length; i += 9) {
          const q = st.S[i];
          if (q.x < 640 || Math.abs(q.x - BIGX) < 36) continue;
          if (q.ink < 0.5 || q.w < 5 || Math.abs(q.ny) < 0.55) continue;
          if (dr() > 0.14) continue;
          const sd = q.ny > 0 ? 1 : -1, wx = clamp((q.x - 640) / 560, 0, 1);
          drips.push({
            x: q.x + q.nx * sd * q.w * 0.4, y: q.y + q.ny * sd * q.w * 0.4,
            w: clamp(q.w * 0.22, 1.4, 3.4), L: 12 + dr() * 34 * (0.5 + wx),
            t0: lerp(2.4, 0.9, wx) + dr() * 2.2, tau: 0.9 + dr() * 1.4,
          });
        }
      }
      LAYOUT = { strokes, riv, drips };
      return LAYOUT;
    }
    function inkLayer() {
      return K.cache('ff5_e5_ink', W, H, 1, (g) => {
        g.fillStyle = '#0f1013';
        for (const st of layout().strokes) renderStroke(g, st, '#0f1013');
        // 石面细孔：墨没吃进去的地方
        const r = A.rng(4242);
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 0; i < 5000; i++) g.fillRect(300 + r() * 900, 190 + r() * 340, 0.6 + r() * 0.7, 0.6 + r() * 0.7);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 最大一笔所在竖带（软边）
    // 上缘在笔头之上（笔头顶约 y 237），上方小字最低处约 y 227，竖带顶部 9px 渐入
    const BAND = { x: BIGX - 46, y: 228, w: 92, h: 312 };
    function bandMaskTex() {
      return K.cache('ff5_e5_bandmask', BAND.w, BAND.h, 1, (g) => {
        const gr = g.createLinearGradient(0, 0, BAND.w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, 'rgba(0,0,0,1)');
        gr.addColorStop(0.8, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, BAND.w, BAND.h);
        g.globalCompositeOperation = 'destination-in';
        const gv = g.createLinearGradient(0, 0, 0, 9);
        gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gv; g.fillRect(0, 0, BAND.w, BAND.h);
      });
    }
    function bandMask(g) { g.drawImage(bandMaskTex(), BAND.x, BAND.y, BAND.w, BAND.h); }
    function bigLayer() {
      return K.cache('ff5_e5_big', BAND.w, BAND.h, 1, (g) => {
        g.translate(-BAND.x, -BAND.y);
        g.filter = 'blur(2.5px)'; g.globalAlpha = 0.22;
        g.drawImage(inkLayer(), 0, 0, W, H);
        g.filter = 'none'; g.globalAlpha = 0.9;
        g.drawImage(inkLayer(), 0, 0, W, H);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'destination-in';
        bandMask(g);
        g.globalCompositeOperation = 'source-over';
      });
    }

    // ---------- 石壁、岩檐与地面（静态底层） ----------
    function wallLayer() {
      return K.cache('ff5_e5_wall', W, H, 1, (g) => {
        const nA = makeNoise(11), nB = makeNoise(23), nC = makeNoise(37), nD = makeNoise(51);
        const wallCells = makeCells(71, 132, 132, 11, 6), eaveCells = makeCells(83, 150, 90, 10, 5), gCells = makeCells(97, 120, 120, 12, 6);
        const lip = new Float32Array(W + 2), ft = new Float32Array(W + 2);
        for (let x = 0; x <= W + 1; x++) { lip[x] = lipY(x); ft[x] = footY(x); }
        const bx = new Float32Array(H + 2); for (let y = 0; y <= H + 1; y++) bx[y] = butX(y);
        const bump = (x, y) => 0.6 * nB(x * 0.03, y * 0.03) + 0.4 * nB(x * 0.07 + 7, y * 0.07 + 3);
        const hBig = (x, y) => 0.65 * nA(x * 0.0065 + 3, y * 0.0065 + 8) + 0.35 * nA(x * 0.016 + 1, y * 0.016 + 2);
        const vc = {};
        pixels(g, 0, 0, W, H, (X, Y, o) => {
          const xi = X | 0, yi = Y | 0, lp = lip[xi], fy = ft[xi];
          if (Y < lp) {
            // 岩檐：暗而稳，近口沿处略亮
            eaveCells(X, Y * 2.2 + 400, vc);
            const e = sstep(lp - 26, lp, Y);
            let l = 0.07 + 0.04 * (vc.tone - 0.5) + 0.05 * (nC(X * 0.03, Y * 0.06) - 0.5);
            l += e * (0.08 + 0.06 * Math.exp(-((X - 480) * (X - 480)) / 4e5));
            rockCol(l, o, 0);
            return;
          }
          const isBut = X < bx[yi] && Y < fy + 30;
          if (Y < fy || isBut) {
            // 节理：扭曲后的维诺格，只有部分边界显出裂缝
            const wx = X + 34 * (nC(X * 0.007, Y * 0.007) - 0.5), wy = Y + 34 * (nC(X * 0.007 + 50, Y * 0.007) - 0.5);
            wallCells(wx, wy * 0.62, vc);
            const dx = (X - 760) / 470, dy = (Y - 366) / 175;
            const flat = clamp(1.3 - Math.sqrt(dx * dx + dy * dy), 0, 1);
            const rough = 1 - 0.75 * flat;
            const cv = rough * sstep(0.5, 0.7, nD(X * 0.012 + 9, Y * 0.012));
            // 一片远处来的冷光落在书写面上，四周渐暗
            const lx = (X - 640) / 560, ly = (Y - 350) / 260;
            let l = 0.11 + Math.exp(-(lx * lx + ly * ly)) * 0.42;
            l -= sstep(lp + 90, lp, Y) * 0.13;
            l -= sstep(1080, 1290, X) * 0.06;
            // 石面小块面：各自微倾，交界处柔和过渡
            const fw = sstep(-4, 4, vc.d);
            l += (lerp((vc.tone + vc.tone2) / 2, vc.tone, fw) - 0.5) * 0.11 * (0.4 + 0.6 * rough);
            if (vc.d < 5) { const k = 1 - vc.d / 5; l += 0.05 * k * k * (vc.nx * LX + vc.ny * LY) * cv; }
            if (vc.d < 0.9) l -= 0.1 * cv * (1 - vc.d / 0.9);
            // 大起伏与细纹理的受光
            const sb = hBig(X - 3, Y - 4.5) - hBig(X + 3, Y + 4.5);
            l += sb * 1.0 * (0.6 + 0.4 * rough);
            const sh = bump(X - 1.2, Y - 1.8) - bump(X + 1.2, Y + 1.8);
            l += sh * (0.14 + 0.26 * rough);
            l += (0.6 * nD(X * 0.13, Y * 0.13) + 0.4 * nD(X * 0.35, Y * 0.35) - 0.5) * 0.035;
            // 檐下水痕：长短不一的竖向暗舌
            const tl = 30 + 230 * Math.pow(nA(X * 0.021, 3.3), 2.2);
            const st = (1 - clamp((Y - lp) / tl, 0, 1)) * (0.5 + 0.5 * nD(X * 0.35, Y * 0.004));
            l -= st * 0.07;
            // 湿面冷光：朝光的大起伏上一层柔亮
            l += sstep(0.01, 0.05, sb) * 0.05;
            l -= sstep(fy - 26, fy, Y) * 0.1;
            let lich = rough * sstep(0.56, 0.8, nA(X * 0.008 + 20, Y * 0.01)) * 0.6;
            if (isBut) {
              // 左侧前凸的岩柱：更近、更暗，右缘背光
              l = l * 0.7 - 0.02 - sstep(bx[yi] - 14, bx[yi], X) * 0.08;
              lich *= 1.4;
            } else if (X < bx[yi] + 70) {
              l -= 0.1 * (1 - (X - bx[yi]) / 70) * sstep(lp, lp + 30, Y);
            }
            rockCol(l, o, clamp(lich, 0, 1));
            return;
          }
          // 壁脚以下：湿岩台地，纹理被透视压扁；近壁处有壁面的湿反光
          const d = clamp((Y - fy) / 180, 0, 1);
          let l = 0.12 + 0.07 * (nC(X * 0.012, Y * 0.06) - 0.5) + 0.05 * (nD(X * 0.05, Y * 0.25) - 0.5);
          l += 0.08 * (1 - d) * sstep(0.4, 0.7, nA(X * 0.01, Y * 0.05)) * (0.6 + 0.4 * nD(X * 0.2, Y * 0.02));
          l -= d * 0.04;
          l -= sstep(fy + 12, fy, Y) * 0.06;
          rockCol(l, o, 0.12);
        });
        // 左侧一道细长裂隙：暗线，迎光的右沿一线冷光
        const r = A.rng(808);
        const fis = [];
        for (let y = lipY(262) + 30, x = 262; y < FOOT - 40; y += 10 + r() * 16) { fis.push([x, y]); x += (r() - 0.5) * 9; }
        g.strokeStyle = 'rgba(10,11,14,0.7)'; g.lineWidth = 1.8;
        g.beginPath(); fis.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.strokeStyle = 'rgba(140,150,166,0.16)'; g.lineWidth = 1;
        g.beginPath(); fis.forEach(([x, y], i) => (i ? g.lineTo(x + 1.6, y) : g.moveTo(x + 1.6, y))); g.stroke();
        // 岩柱右缘一线暗边
        g.strokeStyle = 'rgba(6,7,9,0.55)'; g.lineWidth = 2;
        g.beginPath();
        for (let y = lipY(120); y <= FOOT + 30; y += 4) { const x = butX(y); y === lipY(120) ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
        // 壁脚接触暗线
        g.fillStyle = 'rgba(8,10,13,0.55)';
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 8) g.lineTo(x, footY(x) - 2);
        for (let x = W + 10; x >= -10; x -= 8) g.lineTo(x, footY(x) + 5);
        g.closePath(); g.fill();
        // 檐口：口沿立面受一点冷光（柔和的亮带），沿口一线断续的湿光
        g.save();
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 5) g.lineTo(x, lipY(x));
        for (let x = W + 10; x >= -10; x -= 5) g.lineTo(x, lipY(x) - 16);
        g.closePath(); g.clip();
        g.fillStyle = A.vgrad(g, 140, 220, [[0, 'rgba(120,132,150,0)'], [1, 'rgba(120,132,150,0.16)']]); g.fillRect(0, 130, W, 100);
        g.restore();
        // 沿口断续的湿光：长短不一、明暗不一
        {
          const rl = A.rng(7171);
          for (let x = -10; x < W + 10;) {
            const len = 8 + rl() * 54, gap = 6 + rl() * 70;
            if (rl() < 0.75) {
              g.strokeStyle = `rgba(150,162,178,${0.1 + 0.22 * rl()})`; g.lineWidth = 0.8 + rl() * 0.7;
              const off = -0.3 - rl() * 1.2;
              g.beginPath();
              for (let xx = x; xx <= x + len; xx += 3) { const yy = lipY(xx) + off; xx === x ? g.moveTo(xx, yy) : g.lineTo(xx, yy); }
              g.stroke();
            }
            x += len + gap;
          }
        }
        // 壁脚碎石与坍落的碎石堆：受左上光
        for (let i = 0; i < 22; i++) {
          const x = 160 + r() * 1100, y = footY(x) + 5 + r() * 12, rr = 2 + r() * 5;
          if (x > 740 && x < 1200) continue;
          stone(g, x, y, rr * 1.8, rr, i * 3.1);
        }
        for (const [tx, w, h] of TALUS) {
          const n = Math.round(w * 0.5);
          for (let i = 0; i < n; i++) {
            const u = (r() - 0.5) * 1.8, x = tx + u * w, top = footY(x), y = top + 2 + r() * (FOOT + 14 - top), rr = 1.6 + r() * (h * 0.22 + 2);
            stone(g, x, y, rr * (1.3 + r() * 0.8), rr, i * 1.9 + tx);
          }
        }
      });
    }
    function baseLayer() {
      return K.cache('ff5_e5_base', W, H, 1, (g) => {
        g.drawImage(wallLayer(), 0, 0, W, H);
        // 墨迹（最大一笔的竖带除外）
        const tmp = document.createElement('canvas');
        const sc = g.getTransform().a;
        tmp.width = Math.round(W * sc); tmp.height = Math.round(H * sc);
        const tg = tmp.getContext('2d'); tg.scale(sc, sc);
        tg.drawImage(inkLayer(), 0, 0, W, H);
        tg.globalCompositeOperation = 'destination-out';
        bandMask(tg);
        // 墨在湿石上微微洇开，再叠上墨迹本身（略透出石纹）
        g.filter = 'blur(2.5px)'; g.globalAlpha = 0.22;
        g.drawImage(tmp, 0, 0, W, H);
        g.filter = 'none'; g.globalAlpha = 0.9;
        g.drawImage(tmp, 0, 0, W, H);
        g.globalAlpha = 1;
      });
    }
    // 受左上光的扁石：暗部、顶面一线冷光、接触阴影
    function stone(g, x, y, rx, ry, seed) {
      g.fillStyle = 'rgba(5,6,8,0.55)';
      g.beginPath(); g.ellipse(x + rx * 0.12, y + ry * 0.55, rx * 1.12, ry * 0.32, 0, 0, TAU); g.fill();
      g.save(); g.translate(x, y); g.scale(rx / ry, 1);
      A.inkBlob(g, 0, 0, ry, seed, 0.2);
      const gr = g.createLinearGradient(0, -ry, 0, ry);
      gr.addColorStop(0, '#2e333c'); gr.addColorStop(0.4, '#1b1e24'); gr.addColorStop(1, '#0d0f12');
      g.fillStyle = gr; g.fill();
      g.restore();
      g.strokeStyle = 'rgba(150,162,180,0.2)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x - rx * 0.12, y - ry * 0.25, rx * 0.62, ry * 0.5, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
    }
    // 积水边石与前景（画在水面之后）
    const FRONT_Y = 540;
    function frontLayer() {
      return K.cache('ff5_e5_front', W, H - FRONT_Y, 1, (g) => {
        g.translate(0, -FRONT_Y);
        const r = A.rng(6061);
        // 积水边十来块大小不一的石头，疏密不均，有几块半没在水里；墨流入水处留空
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * TAU + (r() - 0.5) * 0.5;
          // 只有远沿（水在石前看不到的一侧之外）的石头半没在水里；近沿的石头都在岸上
          const rr = poolR(a), sn = Math.sin(a), sub = r() < 0.38 && sn < 0.1, out = sub ? -7 - r() * 6 : 2 + r() * 8;
          const x = POOL.cx + Math.cos(a) * (POOL.rx + out) * rr, y = POOL.cy + sn * (POOL.ry + out * 0.3) * rr;
          const R = (3.5 + r() * 11) * (sn > 0 ? 1.25 : 0.75), ex = 1.3 + r() * 1.1, ey = 0.55 + r() * 0.4;
          if (Math.abs(x - BIGX) < 46 && sn < 0) continue;
          if (sub) {
            // 水线以上画石头；水线以下只在积水范围内透出一团更暗的石影，再留一线极淡的水线光
            const wl = y + R * 0.18;
            g.save(); g.beginPath(); g.rect(x - R * ex * 1.8, wl - R * 3, R * ex * 3.6, R * 3); g.clip();
            stone(g, x, y + R * 0.2, R * ex, R * ey, i * 1.7 + 3);
            g.restore();
            g.save(); poolPath(g); g.clip(); g.beginPath(); g.rect(x - R * ex * 1.8, wl, R * ex * 3.6, R * 2); g.clip();
            g.fillStyle = 'rgba(8,10,13,0.42)'; g.beginPath(); g.ellipse(x, y + R * 0.2, R * ex * 1.02, R * ey * 1.05, 0, 0, TAU); g.fill();
            g.restore();
            g.strokeStyle = 'rgba(170,184,200,0.16)'; g.lineWidth = 1;
            g.beginPath(); g.ellipse(x, wl, R * ex * 1.0, R * ey * 0.26, 0, 0.2, Math.PI - 0.2); g.stroke();
          } else stone(g, x, y + R * 0.2, R * ex, R * ey, i * 1.7 + 3);
        }
        // 左下前景巨石：近、暗，顶面受一点冷光，表面有湿亮的细纹
        const bpath = () => { g.beginPath(); g.moveTo(-20, 604); g.bezierCurveTo(50, 566, 160, 570, 232, 612); g.bezierCurveTo(282, 648, 300, 700, 312, 740); g.lineTo(-20, 740); g.closePath(); };
        const gr = g.createLinearGradient(60, 572, 150, 720);
        gr.addColorStop(0, '#2c313a'); gr.addColorStop(0.25, '#181b21'); gr.addColorStop(1, '#090a0c');
        bpath(); g.fillStyle = gr; g.fill();
        g.save(); bpath(); g.clip();
        for (let i = 0; i < 26; i++) {
          const x = r() * 290, y = 590 + r() * 120, l = 20 + r() * 60;
          g.strokeStyle = `rgba(${r() < 0.5 ? '150,162,180' : '5,6,8'},${0.06 + r() * 0.1})`; g.lineWidth = 1 + r() * 2;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 4 + r() * 8, x + l, y + 6 + r() * 10); g.stroke();
        }
        g.restore();
        g.strokeStyle = 'rgba(160,172,190,0.28)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(6, 592); g.bezierCurveTo(60, 570, 150, 574, 214, 602); g.stroke();
        // 右下角前景石
        g.fillStyle = '#0e1013';
        g.beginPath(); g.moveTo(1186, 740); g.bezierCurveTo(1196, 690, 1236, 668, 1300, 662); g.lineTo(1300, 740); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,162,180,0.16)';
        g.beginPath(); g.moveTo(1200, 690); g.bezierCurveTo(1218, 674, 1250, 666, 1290, 664); g.stroke();
        // 蕨叶（顺风微倾向右）
        const fern = (x, y, len, ang, s) => {
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          const cx = x + Math.cos(ang - 0.4 * s) * len * 0.55, cy = y + Math.sin(ang - 0.4 * s) * len * 0.55;
          g.strokeStyle = '#141a16'; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
          g.fillStyle = '#172019';
          for (let k = 1; k < 16; k++) {
            const u = k / 16, it = 1 - u;
            const px = it * it * x + 2 * it * u * cx + u * u * ex, py = it * it * y + 2 * it * u * cy + u * u * ey;
            const tx = 2 * it * (cx - x) + 2 * u * (ex - cx), ty = 2 * it * (cy - y) + 2 * u * (ey - cy);
            const tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl, ll = len * 0.2 * (1 - u * 0.75);
            for (const sd of [-1, 1]) {
              const nx = -uy * sd, ny = ux * sd;
              const qx = px + nx * ll + ux * ll * 0.45, qy = py + ny * ll + uy * ll * 0.45 + 2;
              g.beginPath(); g.moveTo(px, py);
              g.quadraticCurveTo(px + nx * ll * 0.5 + ux * ll * 0.5, py + ny * ll * 0.5 + uy * ll * 0.5 - 1, qx, qy);
              g.quadraticCurveTo(px + nx * ll * 0.45 + ux * ll * 0.1, py + ny * ll * 0.45 + uy * ll * 0.1 + 2, px + ux * 2, py + uy * 2);
              g.fill();
            }
          }
          g.strokeStyle = 'rgba(150,170,180,0.12)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(cx, cy - 1, ex, ey - 1); g.stroke();
        };
        fern(70, 598, 124, -1.2, 1); fern(112, 596, 96, -0.72, 1); fern(42, 604, 92, -1.78, -1); fern(160, 600, 72, -0.42, 1);
        fern(1234, 668, 82, -1.38, 1); fern(1258, 670, 64, -0.88, 1);
      });
    }

    // ---------- 动态元素 ----------
    const VINES = [{ x: 46, len: 156, ph: 0.3 }, { x: 92, len: 100, ph: 1.7 }, { x: 1198, len: 160, ph: 2.6 }, { x: 1240, len: 112, ph: 4.1 }];
    function drawVines(g, t) {
      for (const v of VINES) {
        const y0 = lipY(v.x) - 2;
        const sway = (u) => Math.pow(u, 1.6) * (4.5 + 2 * Math.sin(t * TAU * 0.42 + v.ph) + 1 * Math.sin(t * TAU * 0.83 + v.ph * 2));
        const px = (u) => v.x + sway(u) + 3 * Math.sin(u * 4 + v.ph);
        g.strokeStyle = '#121714'; g.lineWidth = 1.5;
        g.beginPath();
        for (let k = 0; k <= 16; k++) { const u = k / 16; k ? g.lineTo(px(u), y0 + u * v.len) : g.moveTo(px(u), y0); }
        g.stroke();
        for (let k = 1; k <= 10; k++) {
          const u = k / 10.5, y = y0 + u * v.len, x = px(u), sd = k % 2 ? 1 : -1;
          const s = 7.5 * (1 - u * 0.35);
          g.save(); g.translate(x, y); g.rotate(sd * 0.85 + 0.12 + 0.08 * Math.sin(t * 2.6 + k));
          g.fillStyle = '#161e19';
          g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.9, s * 0.2, s * 0.7, s * 1.2, 0, s * 1.7); g.bezierCurveTo(-s * 0.7, s * 1.2, -s * 0.9, s * 0.2, 0, 0); g.fill();
          g.fillStyle = 'rgba(150,168,186,0.14)';
          g.beginPath(); g.ellipse(-s * 0.25, s * 0.55, s * 0.18, s * 0.42, 0.3, 0, TAU); g.fill();
          g.restore();
        }
      }
    }
    // 雨：三层，向右斜；檐上那段很淡（歌词区保持安静）
    let RAIN = null;
    function rainData() {
      if (RAIN) return RAIN;
      const r = A.rng(2024), mk = (n, v0, v1, len, w, a) => {
        const d = []; for (let i = 0; i < n; i++) d.push({ x: r() * (W + 200), u: r() * 900, v: v0 + r() * (v1 - v0), len: len * (0.8 + r() * 0.4), k: r() });
        return { d, w, a };
      };
      RAIN = [mk(280, 620, 760, 15, 1, 0.2), mk(110, 900, 1050, 26, 1.2, 0.24), mk(24, 1300, 1500, 60, 2.2, 0.12)];
      return RAIN;
    }
    const SLANT = 0.17;
    // 雨势加大时新增的雨丝从画外落入：按每根雨丝本轮的起落时刻判断是否出现
    function drawRain(g, t, amtAt) {
      const span = 900;
      g.lineCap = 'round';
      for (const L of rainData()) {
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          for (const d of L.d) {
            const u = (((d.u + d.v * t) % span) + span) % span, y = u - 80;
            if (d.k > amtAt(t - u / d.v)) continue;
            const x = ((((d.x + SLANT * u) % (W + 200)) + (W + 200)) % (W + 200)) - 100;
            const dim = y < lipY(clamp(x, 0, W)) + 8;
            if ((pass === 1) !== dim) continue;
            g.moveTo(x, y); g.lineTo(x - SLANT * d.len, y - d.len);
          }
          g.strokeStyle = `rgba(190,200,214,${pass ? L.a * 0.3 : L.a})`;
          g.lineWidth = L.w;
          g.stroke();
        }
      }
    }
    // 积水雨圈：按时间槽确定地生成
    function drawRings(g, t, rate) {
      const slot = 0.04, life = 1.0;
      g.lineWidth = 1;
      for (let j = Math.floor((t - life) / slot); j <= Math.floor(t / slot); j++) {
        const ts = j * slot, rr = rate(ts);
        for (let m = 0; m < 3; m++) {
          if (h2(j, 71 + m) > rr) continue;
          const age = t - ts - h2(j, 91 + m) * slot;
          if (age < 0 || age > life) continue;
          const a = h2(j, 31 + m) * TAU, d = Math.sqrt(h2(j, 51 + m)) * 0.9;
          const x = POOL.cx + Math.cos(a) * POOL.rx * d, y = POOL.cy + Math.sin(a) * POOL.ry * d;
          const R = 2 + 20 * Math.pow(age, 0.6);
          const al = 0.4 * Math.pow(1 - age / life, 1.6) * clamp(age / 0.05, 0, 1);
          g.strokeStyle = `rgba(178,190,206,${al})`;
          g.beginPath(); g.ellipse(x, y, R, R * 0.3, 0, 0, TAU); g.stroke();
          if (age < 0.35) { g.strokeStyle = `rgba(178,190,206,${al * 0.6})`; g.beginPath(); g.ellipse(x, y, R * 0.5, R * 0.15, 0, 0, TAU); g.stroke(); }
        }
      }
    }
    // 地面雨溅：细小的水冠与弹起的水珠（近大远小）
    function drawSplashes(g, t, rate) {
      const slot = 0.02, life = 0.24;
      g.lineWidth = 1;
      for (let j = Math.floor((t - life) / slot); j <= Math.floor(t / slot); j++) {
        const rr = rate(j * slot);
        for (let m = 0; m < 4; m++) {
          if (h2(j, 211 + m) > rr) continue;
          const age = t - j * slot - h2(j, 231 + m) * slot;
          if (age < 0 || age > life) continue;
          const x = h2(j, 251 + m) * W, y = 556 + h2(j, 271 + m) * 158;
          const dx = (x - POOL.cx) / (POOL.rx + 14), dy = (y - POOL.cy) / (POOL.ry + 10);
          if (dx * dx + dy * dy < 1) continue;
          if (x < 300 && y > 600 - (300 - x) * 0.1) continue;
          if (x > 1180 && y > 670) continue;
          const k = 0.6 + ((y - 556) / 158) * 0.9, u = age / life;
          const R = (1.5 + 6 * Math.sqrt(u)) * k, al = 0.32 * (1 - u) * clamp(age / 0.03, 0, 1);
          g.strokeStyle = `rgba(190,200,215,${al})`;
          g.beginPath(); g.ellipse(x, y, R, R * 0.28, 0, Math.PI, TAU); g.stroke();
          g.fillStyle = `rgba(200,210,225,${al * 1.2})`;
          for (let q = 0; q < 2; q++) {
            const vx = (q ? 1 : -1) * (12 + 18 * h2(j, 291 + m + q)) * k, vy = -(40 + 30 * h2(j, 301 + m + q)) * k;
            g.fillRect(x + vx * age - 0.6, y + vy * age + 0.5 * 900 * k * age * age - 0.6, 1.3, 1.3);
          }
        }
      }
    }
    // 岩檐一股水：按自由落体反推出水时刻，使水头在第一句第9字到达最大一笔顶端
    const G_PX = 588;                          // 壁高约 6 m ≈ 360 px，g ≈ 588 px/s²
    function gush(c) {
      const t0 = c.t - c.lt;
      const tHit = c.charT(8) != null ? c.charT(8) - t0 : 3.984;
      const yLip = lipY(BIGX) - 1, yTop = 240;
      const tFall = Math.sqrt((2 * (yTop - yLip)) / G_PX);
      const ts = tHit - tFall, v0 = G_PX * tFall, aw = G_PX * 0.5;
      const front = (t) => {
        const u = t - ts;
        if (u <= 0) return yLip;
        if (u < tFall) return yLip + 0.5 * G_PX * u * u;
        const w = u - tFall;
        return Math.min(FOOT + 26, yTop + v0 * w + 0.5 * aw * w * w);
      };
      const passT = (y) => {
        if (y <= yTop) return ts + Math.sqrt((2 * Math.max(0, y - yLip)) / G_PX);
        const d = y - yTop;
        return ts + tFall + (-v0 + Math.sqrt(v0 * v0 + 2 * aw * d)) / aw;
      };
      return { ts, tHit, yLip, yTop, front, passT, tFoot: passT(FOOT) };
    }
    function dripSprite() {
      return K.cache('ff5_e5_drip', 12, 80, 2, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 80);
        gr.addColorStop(0, 'rgba(15,16,19,0.85)'); gr.addColorStop(0.55, 'rgba(15,16,19,0.42)'); gr.addColorStop(1, 'rgba(15,16,19,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(1, 0); g.lineTo(11, 0); g.quadraticCurveTo(8, 40, 7, 78); g.lineTo(5, 78); g.quadraticCurveTo(4, 40, 1, 0); g.fill();
      });
    }
    // 竖向流纹（向下滚动表示水流），上下可无缝拼接
    function streakTex(kind) {
      return K.cache('ff5_e5_streak' + kind, 64, 256, 1, (g) => {
        const r = A.rng(3131 + kind * 7);
        const n = kind ? 46 : 80;
        for (let i = 0; i < n; i++) {
          const x = 3 + r() * 58, w = kind ? 0.6 + r() * 1.4 : 0.8 + r() * 3.4, y = r() * 256, l = 30 + r() * 150, a = kind ? 0.3 + r() * 0.6 : 0.12 + r() * 0.45;
          for (const oy of [-256, 0, 256]) {
            const gr = g.createLinearGradient(0, y + oy, 0, y + oy + l);
            gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(x, y + oy, w, l);
          }
        }
      });
    }
    // 淡墨瀑痕贴图：最大一笔被冲下的淡墨，顺流拉长的灰色晕染，中间浓两边淡，越往下越宽，顺风略偏右；
    // 上面只叠几十根极淡的流丝（左右游移 ≤3px）；上缘 20px、下缘 46px 渐隐
    const TR = { x: BIGX - 60, y: 230, w: 150, h: 320 };
    const trC = (y) => BIGX + 9 * Math.pow(clamp((y - TR.y) / 300, 0, 1), 1.4);
    const trHW = (y, k) => 12 + 22 * clamp((y - TR.y) / 300, 0, 1) + 12 * (A.noise1(y * 0.018 + k * 7, 300 + k) - 0.5);
    function trailTex() {
      return K.cache('ff5_e5_trail', TR.w, TR.h, 1, (g) => {
        const nz = makeNoise(7400);
        const vfade = (Y) => sstep(TR.y, TR.y + 20, Y) * (1 - sstep(TR.y + TR.h - 46, TR.y + TR.h, Y));
        pixels(g, 0, 0, TR.w, TR.h, (x, y, o) => {
          const X = x + TR.x, Y = y + TR.y;
          const u = Math.abs(X - trC(Y)) / trHW(Y, 1);
          const env = 1 - sstep(0.45, 1.0 + 0.35 * (nz(Y * 0.035, 3.3) - 0.5) + 0.12 * (nz(X * 0.1, Y * 0.1) - 0.5), u);
          const streak = 0.55 * nz(X * 0.21, Y * 0.011) + 0.45 * nz(X * 0.52 + 20, Y * 0.028 + 7);
          const a = env * vfade(Y) * (0.3 + 0.44 * streak);
          o[0] = 40; o[1] = 44; o[2] = 52; o[3] = Math.round(255 * clamp(a, 0, 1));
        });
        g.translate(-TR.x, -TR.y);
        const r = A.rng(7373);
        g.lineCap = 'round';
        for (let i = 0; i < 40; i++) {
          const y0 = TR.y + 16 + Math.pow(r(), 1.5) * 200;
          const u = (r() - 0.5) * 1.5, x0 = trC(y0) + u * trHW(y0, 1);
          const len = 40 + Math.pow(r(), 0.8) * (TR.y + TR.h - y0 - 30);
          const w = 0.7 + r() * 1.3, a = 0.06 + r() * 0.14, sd = r() * 100;
          const gr = g.createLinearGradient(0, y0, 0, y0 + len);
          gr.addColorStop(0, 'rgba(36,40,48,0)'); gr.addColorStop(0.15, `rgba(36,40,48,${a})`); gr.addColorStop(0.6, `rgba(36,40,48,${a * 0.6})`); gr.addColorStop(1, 'rgba(36,40,48,0)');
          g.strokeStyle = gr; g.lineWidth = w;
          g.beginPath();
          for (let k = 0; k <= 12; k++) {
            const yy = y0 + (len * k) / 12;
            const x = x0 + (trC(yy) - trC(y0)) + u * (trHW(yy, 1) - trHW(y0, 1)) * 0.5 + 6 * (A.noise1(yy * 0.02 + sd, 400) - 0.5);
            k ? g.lineTo(x, yy) : g.moveTo(x, yy);
          }
          g.stroke();
        }
        g.globalCompositeOperation = 'destination-out';
        const gt = g.createLinearGradient(0, TR.y, 0, TR.y + 20);
        gt.addColorStop(0, 'rgba(0,0,0,1)'); gt.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gt; g.fillRect(TR.x, TR.y, TR.w, 20);
        const gb = g.createLinearGradient(0, TR.y + TR.h - 46, 0, TR.y + TR.h);
        gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gb; g.fillRect(TR.x, TR.y + TR.h - 46, TR.w, 46);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 水流的流纹贴图（冷灰着色）
    const gushTex = () => tinted('ff5_e5_gushtex', streakTex(1), '#b2bdcb');
    // 冲刷后留在石上的淡淡墨渍（模糊的残影）
    function ghostLayer() {
      return K.cache('ff5_e5_ghost', BAND.w, BAND.h, 1, (g) => {
        g.translate(-BAND.x, -BAND.y);
        g.filter = 'blur(3px)'; g.globalAlpha = 0.22;
        g.drawImage(inkLayer(), 0, 0, W, H);
        g.filter = 'none'; g.globalAlpha = 1;
        g.globalCompositeOperation = 'destination-in'; bandMask(g); g.globalCompositeOperation = 'source-over';
      });
    }
    function tinted(key, src, col) {
      return K.cache(key, src.lw, src.lh, 1, (g) => {
        g.drawImage(src, 0, 0, src.lw, src.lh);
        g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, src.lw, src.lh);
      });
    }
    function inkCloudTex(k) {
      return K.cache('ff5_e5_cloud' + k, 256, 256, 1, (g) => {
        const nz = makeNoise(500 + k * 13);
        pixels(g, 0, 0, 256, 256, (X, Y, o) => {
          const dx = (X - 128) / 128, dy = (Y - 128) / 128, r = Math.sqrt(dx * dx + dy * dy);
          const ang = Math.atan2(dy, dx);
          const n = 0.5 * nz(X * 0.03, Y * 0.03) + 0.3 * nz(X * 0.07 + 9, Y * 0.07) + 0.2 * nz(X * 0.16, Y * 0.16 + 4);
          const tend = 0.5 + 0.5 * Math.sin(ang * 5 + n * 6);
          const edge = 1 - sstep(0.35 + 0.45 * n * (0.6 + 0.4 * tend), 1.0, r * 1.15);
          const a = clamp(edge * (0.45 + 0.75 * n), 0, 1);
          o[0] = 16; o[1] = 17; o[2] = 20; o[3] = Math.round(255 * a);
        });
      });
    }

    // 细流冲刷带：所有交叉段上的石面（无墨），中间实、两边羽化；每帧按冲刷进度取用
    function washLayer() {
      return K.cache('ff5_e5_wash', W, H, 1, (g) => {
        const wall = wallLayer();
        for (const r of layout().riv) {
          for (const [ya, yb] of r.cross) {
            for (const [hw, al] of [[3.8, 0.5], [2.1, 1]]) {
              g.save(); g.beginPath();
              for (let y = ya - 2; y < yb + 2; y += 2) g.lineTo(r.xs(y) - hw, y);
              g.lineTo(r.xs(yb + 2) - hw, yb + 2); g.lineTo(r.xs(yb + 2) + hw, yb + 2);
              for (let y = yb + 2; y >= ya - 2; y -= 2) g.lineTo(r.xs(y) + hw, y);
              g.closePath(); g.clip();
              g.globalAlpha = al; g.drawImage(wall, 0, 0, W, H);
              g.restore();
            }
          }
        }
      });
    }
    // 檐水细流：先冲淡流经的笔画（露出石面），再把墨拖成向下的墨痕；水流本身是一道深色湿痕，几点亮光顺流而下
    function drawTrickles(g, t, Lr, refl) {
      const wash = washLayer(), ws = wash.width / W;
      for (const r of Lr.riv) {
        if (t < r.t0) continue;
        const fy = footY(r.x), front = Math.min(fy + 2, r.y0 + r.v * (t - r.t0));
        if (!refl) {
          for (const [ya, yb] of r.cross) {
            const ta = r.t0 + (ya - r.y0) / r.v;
            if (t <= ta) continue;
            const yy = Math.min(front, yb + 2), k = 0.45 * smooth((t - ta) / 0.8), x0 = r.x - 9, h = yy - ya + 2;
            if (h <= 0) continue;
            g.globalAlpha = k;
            g.drawImage(wash, x0 * ws, (ya - 2) * ws, 18 * ws, h * ws, x0, ya - 2, 18, h);
          }
          g.globalAlpha = 1;
        }
        // 墨痕：交叉段下方，起点浓，向下按 Lk 变淡（Lk 随时间变长但有上限，墨被带走后整体变淡）
        const drags = [];
        for (const [ya, yb] of r.cross) {
          const tb = r.t0 + (yb - r.y0) / r.v;
          if (t <= tb || front - yb < 2) continue;
          const age = t - tb, Lk = 18 + 34 * Math.min(age, 2.5);
          drags.push([yb, Lk, Math.min(Math.min(front, fy) - yb, Lk * 2.2), 0.62 * (0.55 + 0.45 * Math.exp(-age / 2)) * smooth(age / 0.25)]);
        }
        const dragA = (y) => {
          let keep = 1;
          for (const [yb, Lk, span, a0] of drags) {
            const d = y - yb;
            if (d < 0 || d > span) continue;
            keep *= 1 - a0 * Math.exp(-d / Lk) * (1 - smooth((d - span * 0.8) / (span * 0.2 + 1e-3)));
          }
          return 1 - keep;
        };
        const N = Math.max(2, Math.ceil((front - r.y0) / 8)), wt = 2.5 + 1.5 * h2(r.x | 0, 3);
        const path = () => { g.beginPath(); for (let y = r.y0; y < front; y += 4) { const x = r.xs(y); y === r.y0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.lineTo(r.xs(front), front); };
        g.lineCap = 'round';
        if (refl) {
          if (!drags.length) continue;
          const gr = g.createLinearGradient(0, r.y0, 0, front + 1);
          for (let k = 0; k <= N; k++) gr.addColorStop(k / N, `rgba(15,16,19,${0.3 * dragA(lerp(r.y0, front, k / N))})`);
          g.strokeStyle = gr; g.lineWidth = 6; path(); g.stroke();
          continue;
        }
        // 湿痕：6–8px 的软边淡带（外 8px、内 4px 两层叠出软边），本身很淡；深色只来自笔画下方拖出的墨
        const go = g.createLinearGradient(0, r.y0, 0, front + 1), gi = g.createLinearGradient(0, r.y0, 0, front + 1);
        for (let k = 0; k <= N; k++) {
          const y = lerp(r.y0, front, k / N), wet = 0.1 + 0.08 * A.noise1(y * 0.03, r.x | 0), d = dragA(y);
          go.addColorStop(k / N, `rgba(13,14,17,${0.5 * wet + 0.42 * d})`);
          gi.addColorStop(k / N, `rgba(13,14,17,${0.55 * wet + 0.6 * d})`);
        }
        g.strokeStyle = go; g.lineWidth = 8; path(); g.stroke();
        g.strokeStyle = gi; g.lineWidth = 4; path(); g.stroke();
        if (front < fy) {
          g.fillStyle = 'rgba(10,12,15,0.22)'; g.beginPath(); g.ellipse(r.xs(front), front - 1, wt * 0.62, wt * 0.95, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(200,210,224,0.26)'; g.fillRect(r.xs(front) - 0.6, front - 2.2, 1.1, 1.1);
        }
        for (let k = 0; k < 2; k++) {
          const P = 380, vg = 120 + 40 * h2(k, r.x | 0), yk = r.y0 + (((t - r.t0) * vg + k * 190) % P);
          if (yk > front - 2) continue;
          const al = 0.3 * Math.sin((Math.PI * (yk - r.y0)) / P) * smooth((front - yk) / 12);
          g.fillStyle = `rgba(214,224,238,${al})`; g.fillRect(r.xs(yk) - 0.6, yk - 1.2, 1.2, 2.4);
        }
      }
    }
    // 墙面上的动态墨流与水（倒影模式 refl 只画大件）
    function drawWallDynamics(g, t, Lr, gs, refl) {
      drawTrickles(g, t, Lr, refl);
      if (!refl) {
        const spr = dripSprite();
        g.globalAlpha = 0.85;
        for (const d of Lr.drips) {
          if (t < d.t0) continue;
          const L = d.L * (1 - Math.exp(-(t - d.t0) / d.tau));
          if (L < 0.6) continue;
          g.drawImage(spr, d.x - d.w / 2, d.y - 1, d.w, L + 2);
        }
        g.globalAlpha = 1;
      }
      // 大股水冲下的淡墨瀑痕：墨痕随水头向下延伸（前沿 24px 软过渡），墨痕本身不动，之后慢慢变淡
      if (t > gs.tHit - 0.02) {
        const f = gs.front(t), bot = Math.min(f, TR.y + TR.h);
        if (bot > TR.y) {
          const age = t - gs.tHit, kin = clamp(age / 0.2, 0, 1), fade = 0.8 + 0.4 * Math.exp(-age / 1.3);
          const tex = trailTex(), sc = tex.width / TR.w, A0 = (refl ? 0.65 : 1) * kin * fade;
          const hh = Math.min(TR.h, bot - TR.y), hs = Math.max(0, hh - 24);
          g.globalAlpha = A0;
          if (hs > 0) g.drawImage(tex, 0, 0, TR.w * sc, hs * sc, TR.x, TR.y, TR.w, hs);
          for (let k = 0; k < 4; k++) {
            const y0 = hs + k * 6; if (y0 >= hh) break;
            const h = Math.min(6, hh - y0);
            g.globalAlpha = A0 * (1 - (k + 0.5) / 4);
            g.drawImage(tex, 0, y0 * sc, TR.w * sc, h * sc, TR.x, TR.y + y0, TR.w, h);
          }
          g.globalAlpha = 1;
          // 最先冲下的一舌浓墨（边缘柔和）
          if (f < FOOT + 30) {
            const L = 90, cx = trC(f), hg = g.createLinearGradient(0, f - L, 0, f + 2);
            const a = (refl ? 0.2 : 0.34) * kin * clamp((FOOT + 30 - f) / 40, 0, 1);
            hg.addColorStop(0, 'rgba(13,14,17,0)'); hg.addColorStop(0.75, `rgba(13,14,17,${a})`); hg.addColorStop(1, `rgba(13,14,17,${a * 0.5})`);
            g.fillStyle = hg;
            g.beginPath();
            g.moveTo(cx - 18, f - L); g.quadraticCurveTo(cx - 21, f - 20, cx - 10, f + 2);
            g.quadraticCurveTo(cx + 1, f + 7, cx + 12, f + 2); g.quadraticCurveTo(cx + 22, f - 20, cx + 19, f - L);
            g.closePath(); g.fill();
          }
        }
        // 壁脚到积水之间的湿地上，墨水洇成几团软边的墨晕，0.6 s 内摊开、连成一片流进水里
        if (!refl && t > gs.tFoot) {
          const x0 = trC(FOOT);
          for (let j = 0; j < 4; j++) {
            const u = t - gs.tFoot - j * 0.12;
            if (u <= 0) continue;
            const k = smooth(u / 0.6), rx = (15 + 6 * j) * (0.5 + 0.5 * k) * (1 + 0.03 * Math.min(u, 3)), ry = rx * 0.4;
            const x = x0 + 1 + (j - 1.5) * 3 + 3 * h2(j, 77), y = FOOT + 5 + j * 8.5;
            g.save(); g.translate(x, y); g.rotate((h2(j, 79) - 0.5) * 0.3);
            g.globalAlpha = 0.42 * k * (0.78 + 0.22 * Math.exp(-u / 2));
            g.drawImage(inkCloudTex(j % 3), -rx, -ry, rx * 2, ry * 2);
            g.restore();
          }
          g.globalAlpha = 1;
        }
      }
      // 水：檐口到笔画顶端是一股自由下落的水柱（7→12px，越往下越宽），落到壁上后是贴壁流下的一片薄水；
      // 都用顺流滚动的流纹画成半透明，迎光（左）侧一线冷光；刚出水时略粗（涌），约 1 s 后稳定
      if (t > gs.ts) {
        const f = gs.front(t), sg = 1 + 0.16 * Math.exp(-Math.max(0, t - gs.tHit) / 1.1);
        const yc = Math.min(f, gs.yTop);
        const colHW = (y) => (3.5 + 2.5 * clamp((y - gs.yLip) / (gs.yTop - gs.yLip), 0, 1)) * sg;
        const colX = (y) => BIGX + 1 + 0.4 * Math.sin(y * 0.05 + t * 4);
        const front0 = f < gs.yTop ? 10 : 0;
        waterBand(g, gs, t, gs.yLip, yc - front0, colX, colHW, 4, 4, refl ? 0.5 : 1, 0.2, 0.34, 0.42, refl);
        if (f < gs.yTop) {
          // 水头碎成几颗水珠
          for (let j = 0; j < 3; j++) {
            const yb = f - j * 6.5, rb = 2.1 - 0.35 * j;
            if (yb < gs.yLip + 4) continue;
            g.fillStyle = `rgba(170,182,198,${(refl ? 0.15 : 0.32) * (1 - 0.2 * j)})`;
            g.beginPath(); g.ellipse(colX(yb) + (h2(j, 5) - 0.5) * 3, yb, rb, rb * 1.35, 0, 0, TAU); g.fill();
          }
        }
        if (f > gs.yTop) {
          const fb = Math.min(f, FOOT + 2);
          const half = (y) => (8 + 12 * clamp((y - gs.yTop) / 220, 0, 1)) * sg;
          const sx = (y) => trC(y) + 1;
          waterBand(g, gs, t, gs.yTop, fb, sx, half, 8, 4, refl ? 0.5 : 1, 0.08, 0.2, 0.24, refl);
          // 顺流而下的几点碎光
          const span = 300;
          for (let k = 0; k < 10; k++) {
            const y = gs.yTop + ((k * 71.3 + h2(k, 16) * 40 + (t - gs.tHit) * (250 + 80 * h2(k, 15))) % span);
            if (y > fb - 4) continue;
            const x = sx(y) + (h2(k, 17) - 0.5) * 2 * half(y) * 0.7, l = 3 + 12 * h2(k, 18) * h2(k, 14);
            const al = (refl ? 0.12 : 0.3) * (0.5 + 0.5 * h2(k, 19)) * Math.sin((Math.PI * (y - gs.yTop)) / span) * smooth((fb - y) / 20);
            g.strokeStyle = `rgba(214,224,238,${al})`; g.lineWidth = 1;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke();
          }
          if (f < FOOT && !refl) A.glow(g, sx(f), f, 5, '#d8e2ee', 0.16);
        }
      }
    }
    // 软边的水带横截面（中间实、两边渐无）
    function bandProfile() {
      return K.cache('ff5_e5_bandprof', 64, 4, 1, (g) => {
        for (let x = 0; x < 64; x++) { const u = (x + 0.5) / 32 - 1; g.fillStyle = `rgba(154,166,182,${Math.pow(Math.max(0, 1 - u * u), 1.4)})`; g.fillRect(x, 0, 1, 4); }
      });
    }
    // 按行画一段水带：每行的流纹贴图坐标由水流经过该处的时刻决定（下落加速，流纹自然拉长、向下滚动）；
    // ns 股流纹并排、略有快慢；迎光一侧一线断续冷光随水下移；末端 24px 渐隐
    function waterBand(g, gs, t, yA, yB, cxF, hwF, rowH, ns, am, aBody, aStrand, aHi, refl) {
      if (yB <= yA + 0.5) return;
      const tex = gushTex(), tsc = tex.width / tex.lw, prof = bandProfile(), psc = prof.width / prof.lw, VREF = 240;
      let y0 = yA, y1 = yB;
      if (refl) { y0 = Math.max(y0, 2 * FOOT - POOL_BOT - 8); y1 = Math.min(y1, 2 * FOOT - POOL_TOP + 8); if (y1 <= y0) return; }
      const tcOf = (y, sp) => VREF * sp * (gs.passT(y) - t);
      for (let y = y0; y < y1; y += rowH) {
        const h = Math.min(rowH, y1 - y), ym = y + h / 2, cx = cxF(ym), hw = hwF(ym);
        const endF = smooth((yB - ym) / 24) * am;
        g.globalAlpha = aBody * endF;
        g.drawImage(prof, 0, 0, prof.width, prof.height, cx - hw, y, hw * 2, h);
        for (let j = 0; j < ns; j++) {
          const sp = 1 + 0.07 * (j - (ns - 1) / 2), c0 = tcOf(y, sp), c1 = tcOf(y + h, sp), hs = c1 - c0;
          if (hs <= 0.01) continue;
          const dx = cx - hw + (2 * hw * (j + 0.5)) / ns, dw = ((2 * hw) / ns) * 1.25;
          const sxx = (j * 61) % 48, a0 = ((c0 % 256) + 256) % 256;
          g.globalAlpha = aStrand * endF * (1 - 0.3 * Math.abs((j + 0.5) / ns * 2 - 1));
          if (a0 + hs <= 256) g.drawImage(tex, sxx * tsc, a0 * tsc, 16 * tsc, hs * tsc, dx - dw / 2, y, dw, h);
          else { const h1 = 256 - a0, fr = h1 / hs; g.drawImage(tex, sxx * tsc, a0 * tsc, 16 * tsc, h1 * tsc, dx - dw / 2, y, dw, h * fr); g.drawImage(tex, sxx * tsc, 0, 16 * tsc, (hs - h1) * tsc, dx - dw / 2, y + h * fr, dw, h * (1 - fr)); }
        }
        const hn = A.noise1(tcOf(ym, 1) * 0.045, 7);
        if (hn > 0.42) { g.globalAlpha = aHi * endF * smooth((hn - 0.42) / 0.2); g.fillStyle = '#ccd6e4'; g.fillRect(cx - hw * 0.62 - 0.5, y, 1, h); }
      }
      g.globalAlpha = 1;
    }
    // 冲击处的水雾：溅起后受重力回落、顺风向右散开
    function drawSpray(g, t, x, y, t0, n, seed) {
      if (t < t0) return;
      for (let i = 0; i < n; i++) {
        const born = t0 + Math.pow(h2(i, seed), 1.8) * 2.6, age = t - born;
        if (age < 0 || age > 1.0) continue;
        const vx = (h2(i, seed + 1) - 0.4) * 80, vy = -50 - h2(i, seed + 2) * 70;
        const px = x + vx * age + 16 * age * age, py = y + vy * age + 0.5 * 300 * age * age;
        A.glow(g, px, py, 2 + age * 6, '#c8d2e0', 0.22 * Math.sin(Math.PI * age));
      }
    }

    function draw(g, c) {
      const t = c.lt, Lr = layout(), gs = gush(c), t0 = c.t - c.lt;
      const base = baseLayer(), front = frontLayer(), big = bigLayer();
      // 雨势：第一句第5字加大
      const tQ = c.charT(4) != null ? c.charT(4) - t0 : 2.044;
      const amtAt = (ts) => 0.55 + 0.45 * sstep(tQ - 0.2, tQ + 0.6, ts);
      const z = 1 + 0.03 * easeInOut(clamp(t / c.dur, 0, 1));
      g.save();
      g.translate(880, 400); g.scale(z, z); g.translate(-880, -400);
      g.drawImage(base, 0, 0, W, H);
      // 最大一笔：水头经过后逐段被冲走，只留一层模糊的淡墨渍；冲刷前沿是约 0.6 s 的柔和过渡
      const S = scratchCanvas('e5big', BAND.w, BAND.h);
      if (t > gs.tHit - 0.05) {
        const wv = (y) => smooth((t - gs.passT(Math.max(y, gs.yTop)) + 0.05) / 0.6);
        const grW = S.g.createLinearGradient(0, 0, 0, BAND.h), grK = S.g.createLinearGradient(0, 0, 0, BAND.h);
        for (let k = 0; k <= 32; k++) { const w = wv(BAND.y + (BAND.h * k) / 32); grW.addColorStop(k / 32, `rgba(0,0,0,${w})`); grK.addColorStop(k / 32, `rgba(0,0,0,${1 - w})`); }
        S.g.drawImage(ghostLayer(), 0, 0, BAND.w, BAND.h);
        S.g.globalCompositeOperation = 'destination-in'; S.g.fillStyle = grW; S.g.fillRect(0, 0, BAND.w, BAND.h);
        const S2 = scratchCanvas('e5big2', BAND.w, BAND.h);
        S2.g.drawImage(big, 0, 0, BAND.w, BAND.h);
        S2.g.globalCompositeOperation = 'destination-in'; S2.g.fillStyle = grK; S2.g.fillRect(0, 0, BAND.w, BAND.h);
        S.g.globalCompositeOperation = 'source-over';
        S.g.drawImage(S2.c, 0, 0, BAND.w, BAND.h);
      } else S.g.drawImage(big, 0, 0, BAND.w, BAND.h);
      g.drawImage(S.c, BAND.x, BAND.y, BAND.w, BAND.h);
      drawWallDynamics(g, t, Lr, gs, false);
      // 檐口积水渐满：出水前口沿上一颗渐大的水珠，出水后 0.3 s 内隐去
      if (t > gs.ts - 0.9) {
        const k = clamp((t - (gs.ts - 0.9)) / 0.9, 0, 1), off = 1 - smooth((t - gs.ts) / 0.3);
        if (off > 0) A.glow(g, BIGX + 1, gs.yLip + 2, 4 + 3 * k, '#d6e0ee', 0.3 * k * off);
      }
      drawSpray(g, t, BIGX + 1, gs.yTop, gs.tHit, 34, 41);

     
      // ---------- 积水：壁下部倒影（以壁脚线翻转）、墨云、雨圈 ----------
      g.save();
      poolPath(g); g.clip();
      const sc = base.width / W;
      const xa = POOL.cx - POOL.rx * 1.12, xb = POOL.cx + POOL.rx * 1.12;
      for (let y = POOL_TOP - 2; y < POOL_BOT + 2; y += 3) {
        const ys = 2 * FOOT - y - 3;
        const dx = 0.75 * Math.sin(y * 0.21 + t * 2.3) + 0.4 * Math.sin(y * 0.071 - t * 1.6);
        g.drawImage(base, xa * sc, ys * sc, (xb - xa) * sc, 3 * sc, xa + dx, y, xb - xa, 3.2);
        if (ys >= BAND.y && ys < BAND.y + BAND.h) g.drawImage(S.c, 0, (ys - BAND.y) * sc, BAND.w * sc, 3 * sc, BAND.x + dx, y, BAND.w, 3.2);
      }
      g.save();
      g.translate(0, 2 * FOOT); g.scale(1, -1);
      drawWallDynamics(g, t, Lr, gs, true);
      g.restore();
      // 倒影比实物暗、偏冷
      g.fillStyle = 'rgba(10,14,22,0.2)';
      g.fillRect(xa - 10, POOL_TOP - 4, xb - xa + 20, POOL_BOT - POOL_TOP + 8);
      // 掠射角下水面更亮：远端一层冷银色的反光
      g.fillStyle = A.vgrad(g, POOL_TOP, POOL_BOT, [[0, 'rgba(150,164,184,0.16)'], [0.5, 'rgba(150,164,184,0.05)'], [1, 'rgba(150,164,184,0)']]);
      g.fillRect(xa - 10, POOL_TOP - 4, xb - xa + 20, POOL_BOT - POOL_TOP + 8);
      // 墨云：浓墨从入水处涌进积水，顺着水面向右（风向）铺开、化淡
      const tIn = gs.tFoot + 0.22;
      if (t > tIn) {
        const age = t - tIn;
        for (let k = 0; k < 3; k++) {
          const tex = inkCloudTex(k);
          const R = (30 + 64 * Math.sqrt(age) * (0.8 + 0.25 * k)) * (1 + 0.1 * k);
          const cx = trC(FOOT) + 4 + (10 + 30 * k) * Math.sqrt(age) + 24 * age, cy = POOL_TOP + 16 + 20 * Math.sqrt(age) + k * 4;
          const a = smooth(age / 0.25) * (1.0 - 0.15 * k) * (0.55 + 0.45 * Math.exp(-age / 3));
          g.save(); g.translate(cx, cy); g.scale(1, 0.38); g.rotate(0.2 * k + age * 0.06 * (k - 1));
          g.globalAlpha = a; g.drawImage(tex, -R, -R, R * 2, R * 2); g.restore();
        }
        g.globalAlpha = 1;
      }
      drawRings(g, t, (ts) => 0.2 + 0.5 * sstep(tQ - 0.2, tQ + 0.6, ts));
      // 拍点上的大水滴
      const b = c.b;
      for (let i = b.i - 2; i <= b.i; i++) {
        const tb = c.grid.time(i), age = c.t - tb;
        if (age < 0 || age > 1.3 || tb < t0 - 0.2) continue;
        for (let m = 0; m < 2; m++) {
          const a = h2(i, 7 + m) * TAU, d = 0.25 + 0.6 * h2(i, 9 + m);
          const x = POOL.cx + Math.cos(a) * POOL.rx * d, y = POOL.cy + Math.sin(a) * POOL.ry * d;
          for (let ring = 0; ring < 3; ring++) {
            const ag = age - ring * 0.12; if (ag <= 0) continue;
            const R = 3 + 38 * Math.pow(ag, 0.6), al = 0.36 * Math.pow(1 - ag / 1.3, 1.5) * (1 - ring * 0.25) * clamp(ag / 0.05, 0, 1);
            g.strokeStyle = `rgba(184,196,212,${al})`; g.lineWidth = 1.1;
            g.beginPath(); g.ellipse(x, y, R, R * 0.3, 0, 0, TAU); g.stroke();
          }
        }
      }
      // 入水处一圈圈小波
      if (t > gs.tFoot) {
        for (let k = 0; k < 4; k++) {
          const u = t - gs.tFoot - k * 0.3;
          if (u < 0) continue;
          const age = u % 1.2, R = 4 + 32 * Math.pow(age, 0.6), al = 0.3 * (1 - age / 1.2) * clamp(age / 0.08, 0, 1);
          g.strokeStyle = `rgba(184,196,212,${al})`; g.lineWidth = 1;
          g.beginPath(); g.ellipse(trC(FOOT) + 4, POOL_TOP + 14, R, R * 0.28, 0, 0, TAU); g.stroke();
        }
      }
      g.restore();
      drawSplashes(g, t, (ts) => 0.3 + 0.45 * sstep(tQ - 0.2, tQ + 0.6, ts));
      g.drawImage(front, 0, FRONT_Y, W, H - FRONT_Y);
      drawSpray(g, t, BIGX + 3, FOOT + 8, gs.tFoot, 16, 61);
      drawVines(g, t);
      drawRain(g, t, amtAt);
      g.restore();
      // 潮湿空气：下部略亮的雨雾
      const hz = g.createLinearGradient(0, 300, 0, H);
      hz.addColorStop(0, 'rgba(126,138,154,0)'); hz.addColorStop(1, 'rgba(126,138,154,0.08)');
      g.fillStyle = hz; g.fillRect(0, 300, W, H - 300);
    }
    return { draw, warm: [inkLayer, wallLayer, washLayer, baseLayer, bigLayer, ghostLayer, frontLayer, trailTex, () => inkCloudTex(0), () => inkCloudTex(1), () => inkCloudTex(2), () => streakTex(0), () => streakTex(1), gushTex, bandProfile, bandMaskTex] };
  })();

  XYT.registerShot('e5_inkrain', {
    name: '墨尽雨洗', zone: 'top', night: true,
    text: '#e6e9ee', shadow: 'rgba(6,8,12,0.9)', accent: '#b9c7d8', bloom: 0.32,
    draw: E5.draw,
  });

  // =====================================================================
  // e6_peony 残红：暮春雨后的庭院，低垂的红牡丹，天光转灰，花瓣一齐松脱
  // 比例：花径约 15 cm ≈ 140 px，即约 10 px/cm；重力 ≈ 9800 px/s²
  // =====================================================================
  const E6 = (function () {
    const CAP = 336, BASE = 545, PX = 420, GP = 9800;
    // 积水在花台脚下（镜头低，约 0.3 m 高，地平线 y≈266，花台立面距镜头约 1.45 m）
    const PUD = { cx: 786, cy: 575, rx: 192, ry: 21 };
    const pudR = (a) => 1 + 0.06 * Math.sin(a * 3 + 1.1) + 0.05 * Math.sin(a * 5 + 0.3) + 0.03 * Math.sin(a * 8 + 2);
    function pudPath(g) {
      g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU, r = pudR(a);
        const x = PUD.cx + Math.cos(a) * PUD.rx * r, y = PUD.cy + Math.sin(a) * PUD.ry * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    const inPud = (x, y, m = 0) => {
      const a = Math.atan2((y - PUD.cy) / PUD.ry, (x - PUD.cx) / PUD.rx), r = pudR(a);
      const dx = (x - PUD.cx) / (PUD.rx * r - m), dy = (y - PUD.cy) / (PUD.ry * r - m * 0.3);
      return dx * dx + dy * dy < 1;
    };

    // ---------- 背景：虚化的粉墙黛瓦、漏窗、竹丛（建缓存时模糊） ----------
    function bgLayer() {
      return K.cache('ff5_e6_bg', W, H, 1, (g) => {
        const sc = g.getTransform().a;
        const tmp = document.createElement('canvas'); tmp.width = Math.round(W * sc); tmp.height = Math.round(H * sc);
        const t = tmp.getContext('2d'); t.scale(sc, sc);
        const r = A.rng(6006);
        t.fillStyle = A.vgrad(t, 0, 100, [[0, '#e9ebea'], [1, '#dfe2e1']]); t.fillRect(-30, -30, W + 60, 130);
        // 墙外树冠
        for (let i = 0; i < 26; i++) { const x = r() * W, y = 20 + r() * 60; A.glow(t, x, y, 50 + r() * 70, r() < 0.5 ? '#76877b' : '#8e9c91', 0.5); }
        // 墙
        t.fillStyle = A.vgrad(t, 88, 480, [[0, '#d6d9d8'], [0.08, '#e2e4e3'], [0.7, '#d9dcdb'], [1, '#c3c9c5']]);
        t.fillRect(-30, 88, W + 60, 392);
        for (let i = 0; i < 40; i++) {
          const x = r() * W, l = 20 + r() * 120;
          t.fillStyle = `rgba(120,128,124,${0.05 + r() * 0.08})`; t.fillRect(x, 92, 3 + r() * 10, l);
        }
        for (let i = 0; i < 30; i++) A.glow(t, r() * W, 440 + r() * 40, 30 + r() * 40, '#8b9a8c', 0.22);
        // 黛瓦墙檐
        t.fillStyle = '#5d6261'; t.fillRect(0, 62, W, 26);
        t.fillStyle = '#7b807f'; t.fillRect(0, 58, W, 6);
        t.fillStyle = 'rgba(30,34,34,0.5)'; for (let x = 0; x < W; x += 13) t.fillRect(x, 66, 3, 22);
        t.fillStyle = 'rgba(60,64,64,0.35)'; t.fillRect(0, 88, W, 7);
        // 圆形漏窗：窗外竹影，窗格冰裂纹
        t.fillStyle = '#c4c8c5'; t.beginPath(); t.arc(500, 236, 74, 0, TAU); t.fill();
        t.fillStyle = '#5f7263'; t.beginPath(); t.arc(500, 236, 62, 0, TAU); t.fill();
        t.save(); t.beginPath(); t.arc(500, 236, 62, 0, TAU); t.clip();
        for (let i = 0; i < 8; i++) A.glow(t, 460 + r() * 90, 190 + r() * 90, 20 + r() * 20, '#46594a', 0.6);
        t.strokeStyle = '#d6dad7'; t.lineWidth = 5;
        for (let i = 0; i < 14; i++) { const a = r() * TAU, x0 = 500 + Math.cos(a) * 70, y0 = 236 + Math.sin(a) * 70; t.beginPath(); t.moveTo(x0, y0); t.lineTo(500 + (r() - 0.5) * 60, 236 + (r() - 0.5) * 60); t.stroke(); }
        t.restore();
        // 右侧竹丛
        for (let i = 0; i < 16; i++) { const x = 1060 + r() * 230; t.fillStyle = r() < 0.5 ? '#6c8070' : '#7f9283'; t.fillRect(x, 90 + r() * 60, 5 + r() * 4, 400); }
        for (let i = 0; i < 40; i++) A.glow(t, 1040 + r() * 260, 100 + r() * 300, 26 + r() * 30, r() < 0.5 ? '#5f7667' : '#7a8f7e', 0.45);
        // 远处湿石地面
        t.fillStyle = A.vgrad(t, 478, 640, [[0, '#a9afac'], [0.5, '#868c89'], [1, '#4c5250']]); t.fillRect(-30, 478, W + 60, 280);
        t.fillStyle = 'rgba(60,66,64,0.4)'; t.fillRect(0, 476, W, 4);
        g.filter = 'blur(7px)';
        g.drawImage(tmp, -20, -20, W + 40, H + 40);
        g.filter = 'none';
      });
    }

    // ---------- 牡丹叶丛（在压顶石后面），整片缓存，随微风整体轻摆 ----------
    const LV = { x: 470, y: 90, w: 810, h: 270 };
    // 牡丹小叶：宽卵形，基部楔形，外三分之一有浅裂；没骨铺色，基部深，只留一线淡主脉；叶尖受重力微垂
    function leaflet(g, x, y, dir, len, col, dark, lobes, blur, seed, droop) {
      const r = A.rng(seed), wid = len * (0.26 + 0.05 * r());
      const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
      const nu = [0.6 + r() * 0.08, 0.62 + r() * 0.08], dep = [0.36 + r() * 0.14, 0.36 + r() * 0.14];
      const asym = 1 + (r() - 0.5) * 0.16, N = 30, side = [[], []];
      const at = (u, perp) => [x + ux * u * len + nx * perp, y + uy * u * len + ny * perp + droop * len * u * u];
      for (let sd = 0; sd < 2; sd++) {
        const sg = sd ? -1 : 1, has = lobes === 3 || (lobes === 2 && sd === 0);
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          let hw = wid * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.82) * (sd ? asym : 1 / asym);
          if (has) {
            const z = (u - nu[sd]) / 0.05;
            hw *= 1 - dep[sd] * Math.exp(-z * z) + 0.1 * Math.exp(-Math.pow((u - nu[sd] + 0.08) / 0.05, 2));
          }
          side[sd].push(at(u, sg * hw));
        }
      }
      const pts = side[0].concat(side[1].slice().reverse());
      const shape = () => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
        g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.closePath();
      };
      g.filter = `blur(${blur}px)`;
      shape(); g.fillStyle = col; g.globalAlpha = 0.92; g.fill();
      const [ex, ey] = at(0.65, 0);
      const gr = g.createLinearGradient(x, y, ex, ey); gr.addColorStop(0, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.45; g.fillStyle = gr; shape(); g.fill();
      g.filter = 'none'; g.globalAlpha = 1;
      if (blur < 1.5) {
        g.strokeStyle = 'rgba(28,44,38,0.2)'; g.lineWidth = 0.8;
        g.beginPath();
        for (let i = 0; i <= 12; i++) { const [px, py] = at(0.03 + 0.8 * i / 12, 0); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
    }
    function leafLayer() {
      return K.cache('ff5_e6_leaves', LV.w, LV.h, 1, (g) => {
        g.translate(-LV.x, -LV.y);
        const r = A.rng(6262);
        // 二回三出复叶：叶柄从花台里伸出，顶生小叶三浅裂，两侧小叶一大一小、或二裂或全缘，叶尖下垂
        const group = (x, y, s, tone, blur, side, stem) => {
          const col = mix('#3e5c52', '#8fa49b', tone), dark = mix('#283c35', '#566a62', tone);
          const ra = (side > 0 ? 0 : Math.PI) + side * (-0.5 + r() * 0.75);   // 叶轴方向：向外、略向上或向下
          if (stem) {
            g.strokeStyle = mix('#4a6457', '#7f938a', tone); g.lineWidth = 1.8 * s;
            g.beginPath(); g.moveTo(x - side * 6, y + stem); g.quadraticCurveTo(x - side * 2, y + stem * 0.4, x, y); g.stroke();
          }
          const L0 = 64 * s * (0.9 + r() * 0.25);
          const jx = x + Math.cos(ra) * L0 * 0.16, jy = y + Math.sin(ra) * L0 * 0.16;
          g.strokeStyle = mix('#4a6457', '#7f938a', tone); g.lineWidth = 1.4 * s;
          g.beginPath(); g.moveTo(x, y); g.lineTo(jx, jy); g.stroke();
          const a1 = ra - side * (0.8 + r() * 0.35), a2 = ra + side * (0.75 + r() * 0.35);
          leaflet(g, x, y, a1, L0 * (0.68 + r() * 0.16), mix(col, '#9fb3a9', 0.08), dark, r() < 0.5 ? 2 : 1, blur, Math.floor(r() * 1e5), 0.18 + r() * 0.15);
          leaflet(g, x, y, a2, L0 * (0.62 + r() * 0.16), mix(col, '#2c443b', 0.15), dark, r() < 0.4 ? 2 : 1, blur, Math.floor(r() * 1e5), 0.25 + r() * 0.15);
          leaflet(g, jx, jy, ra, L0, col, dark, 3, blur, Math.floor(r() * 1e5), 0.16 + r() * 0.14);
        };
        // 远层（更虚）、中层、近层；位置、大小、朝向都不规则，彼此交叠
        for (let i = 0; i < 16; i++) group(700 + r() * 600, 140 + r() * 100, 0.8 + r() * 0.35, 0.6 + r() * 0.3, 2.4, r() < 0.5 ? -1 : 1, 0);
        for (let i = 0; i < 6; i++) group(840 + r() * 440, 190 + r() * 70, 0.9 + r() * 0.25, 0.36 + r() * 0.14, 1.2, r() < 0.45 ? -1 : 1, 50 + r() * 30);
        const front = [[1010, 240, 1.15, -1], [1150, 230, 1.2, 1], [915, 272, 0.98, -1], [1245, 262, 1.05, 1], [1078, 290, 1.0, 1], [872, 302, 0.82, 1], [662, 306, 0.74, -1], [1190, 300, 0.9, -1], [990, 304, 0.86, 1], [760, 300, 0.7, 1]];
        for (const [x, y, sz, sd] of front) group(x + (r() - 0.5) * 16, y + (r() - 0.5) * 10, sz * (0.92 + r() * 0.16), 0.2 + r() * 0.2, 0.6, sd, 36 + r() * 20);
        // 叶面上残留的雨珠（只落在叶面上）
        g.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 60; i++) { const x = 640 + r() * 640, y = 170 + r() * 160; g.fillStyle = 'rgba(240,244,242,0.55)'; g.beginPath(); g.arc(x, y, 0.8 + r() * 1.1, 0, TAU); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      });
    }

    // ---------- 花台与石面（清晰） ----------
    function stoneLayer() {
      return K.cache('ff5_e6_stone', W, H, 1, (g) => {
        const nz = makeNoise(616), nz2 = makeNoise(626);
        // 近处湿石面：大块石板（各块深浅略异），左侧远端与背景地面柔和衔接
        const slab = (X, Y) => {
          const row = Y < 600 ? 0 : Y < 672 ? 1 : 2, off = [0, 150, 70][row], wdt = [260, 300, 340][row];
          return row * 31 + Math.floor((X + off) / wdt);
        };
        pixels(g, 0, 500, W, 220, (X, Y, o) => {
          const d = clamp((Y - 545) / 175, 0, 1);
          let l = 0.19 + 0.05 * (h2(slab(X, Y), 5) - 0.5) + 0.05 * (nz(X * 0.02, Y * 0.05) - 0.5) + 0.035 * (nz2(X * 0.12, Y * 0.3) - 0.5);
          l += 0.09 * sstep(0.55, 0.8, nz(X * 0.006 + 9, Y * 0.02)) * (0.4 + 0.6 * d);
          l -= 0.05 * d;
          const v = 30 + 150 * l;
          o[0] = v * 0.96; o[1] = v; o[2] = v * 0.98;
          const fadeL = sstep(520, 640, Y), fadeR = Y < BASE ? 0 : 1;
          o[3] = Math.round(255 * (X >= PX ? fadeR : fadeL));
        });
        // 石板缝：柔和的暗线，左侧远端渐隐
        const seam = (x0, y0, x1, y1, w) => {
          const gr = g.createLinearGradient(0, Math.min(y0, y1) - 20, 0, Math.max(y0, y1));
          gr.addColorStop(0, 'rgba(14,16,16,0)'); gr.addColorStop(1, 'rgba(14,16,16,0.4)');
          g.strokeStyle = gr; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        };
        seam(0, 600, W, 601, 1.4); seam(0, 672, W, 674, 1.8);
        for (const [x, y0, y1] of [[110, 600, 672], [370, 600, 672], [670, 600, 672], [970, 600, 672], [1270, 600, 672], [230, 545, 600], [490, 545, 600], [750, 545, 600], [1010, 545, 600], [270, 672, 720], [610, 672, 720], [950, 672, 720]]) seam(x, y0, x + (x - 640) * 0.04, y1, 1.3);
        // 花台石块：花岗岩纹理
        pixels(g, PX, CAP, W - PX, BASE - CAP, (X, Y, o) => {
          let l = 0.42 + 0.08 * (nz(X * 0.03, Y * 0.03) - 0.5) + 0.07 * (nz2(X * 0.25, Y * 0.25) - 0.5);
          if (nz2(X * 0.6, Y * 0.6) > 0.82) l += 0.06;
          if (Y < CAP + 12) l = 0.66 + 0.05 * (nz(X * 0.05, Y * 0.2) - 0.5);          // 压顶石顶面受天光
          else if (Y < CAP + 32) l = 0.5 + 0.05 * (nz(X * 0.04, Y * 0.1) - 0.5);     // 压顶石立面
          else l -= 0.2 * sstep(CAP + 50, CAP + 32, Y);                              // 檐下阴影
          l -= 0.16 * sstep(BASE - 90, BASE, Y);                                     // 下部返潮
          const v = 26 + 170 * clamp(l, 0, 1);
          o[0] = v * 0.97; o[1] = v; o[2] = v * 0.98;
        });
        g.strokeStyle = 'rgba(20,24,22,0.6)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(PX, CAP + 12); g.lineTo(W, CAP + 12); g.moveTo(PX, CAP + 32); g.lineTo(W, CAP + 32); g.moveTo(PX, 456); g.lineTo(W, 456); g.stroke();
        for (const x of [600, 830, 1060]) { g.beginPath(); g.moveTo(x, CAP + 32); g.lineTo(x, 456); g.stroke(); }
        for (const x of [500, 720, 955, 1190]) { g.beginPath(); g.moveTo(x, 456); g.lineTo(x, BASE); g.stroke(); }
        for (const x of [700, 1000]) { g.beginPath(); g.moveTo(x, CAP); g.lineTo(x, CAP + 32); g.stroke(); }
        // 雨后的水渍与斑驳：自压顶石下沿垂下的深色水痕、几片返潮的暗斑
        {
          const r2 = A.rng(6363);
          g.save(); g.beginPath(); g.rect(PX, CAP + 32, W - PX, BASE - CAP - 32); g.clip();
          g.filter = 'blur(2px)';
          for (let i = 0; i < 46; i++) {
            const x = PX + r2() * (W - PX), l = 20 + r2() * 110, w = 4 + r2() * 16;
            const gr = g.createLinearGradient(0, CAP + 32, 0, CAP + 32 + l);
            gr.addColorStop(0, `rgba(30,36,34,${0.18 + r2() * 0.2})`); gr.addColorStop(1, 'rgba(30,36,34,0)');
            g.fillStyle = gr; g.fillRect(x, CAP + 32, w, l);
          }
          for (let i = 0; i < 18; i++) A.glow(g, PX + r2() * (W - PX), 400 + r2() * 140, 30 + r2() * 50, '#2c3431', 0.25);
          g.filter = 'none';
          g.restore();
        }
        // 左端在镜头左侧，侧面朝外看不到，只在棱上留一线天光
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(PX - 1, CAP, 2, BASE - CAP);
        // 青苔与缝里的小草
        const r = A.rng(6262);
        for (let i = 0; i < 40; i++) { const x = PX + r() * (W - PX), y = r() < 0.5 ? 456 + (r() - 0.5) * 8 : BASE - r() * 30; A.glow(g, x, y, 8 + r() * 18, '#56704f', 0.35); }
        g.strokeStyle = '#4f6b45'; g.lineWidth = 1.2;
        for (let i = 0; i < 70; i++) {
          const x = PX + r() * (W - PX), h = 6 + r() * 14, lean = -2 - r() * 4;
          g.beginPath(); g.moveTo(x, BASE + 1); g.quadraticCurveTo(x + lean * 0.4, BASE - h * 0.6, x + lean, BASE - h); g.stroke();
        }
        // 接地暗线
        g.fillStyle = A.vgrad(g, BASE - 4, BASE + 10, [[0, 'rgba(10,12,12,0.6)'], [1, 'rgba(10,12,12,0)']]); g.fillRect(PX, BASE - 4, W - PX, 14);
      });
    }

    // 湿石面上花台的模糊倒影（很淡，越远越淡）
    function wetLayer() {
      return K.cache('ff5_e6_wet', W, 120, 1, (g) => {
        const st = stoneLayer(), sc = st.width / W;
        g.save(); g.translate(0, 120); g.scale(1, -1);
        g.filter = 'blur(3px)'; g.globalAlpha = 0.16;
        g.drawImage(st, PX * sc, (BASE - 120) * sc, (W - PX) * sc, 120 * sc, PX, 0, W - PX, 120);
        g.restore();
        g.globalCompositeOperation = 'destination-in';
        g.fillStyle = A.vgrad(g, 0, 120, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, 120);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // ---------- 花瓣贴图：没骨晕染，基部深、外缘浅而薄，边上积一道水线 ----------
    function petalSprite(k, dark) {
      return K.cache('ff5_e6_pet' + k + (dark ? 'd' : ''), 64, 72, 2, (g) => {
        const r = A.rng(700 + k * 11);
        const sc = [1, 0.9, 1.08, 0.95, 1.02, 0.86][k % 6];
        const pts = [];
        const n = 5 + (k % 3);
        for (let i = 0; i <= n; i++) pts.push([8 + (48 * i) / n + (r() - 0.5) * 3, 8 + r() * 6 + (i % 2) * 2]);
        const path = () => {
          g.beginPath(); g.moveTo(32, 70);
          g.bezierCurveTo(14 - 8 * sc, 58, 0, 26, pts[0][0], pts[0][1]);
          for (let i = 1; i <= n; i++) { const p0 = pts[i - 1], p1 = pts[i]; g.quadraticCurveTo((p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - 4, p1[0], p1[1]); }
          g.bezierCurveTo(64, 26, 50 + 8 * sc, 58, 32, 70); g.closePath();
        };
        const c0 = dark ? '#560b15' : '#73101b', c1 = dark ? '#8a1622' : '#a91d2a', c2 = dark ? '#b3303c' : '#de4b56';
        g.filter = 'blur(1.6px)';
        path();
        const gr = g.createRadialGradient(32, 72, 3, 32, 60, 70);
        gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.globalAlpha = 0.9; g.fill();
        g.filter = 'blur(4px)'; g.globalAlpha = 0.5;
        g.fillStyle = c0; g.beginPath(); g.ellipse(32, 62, 12, 18, 0, 0, TAU); g.fill();
        g.globalAlpha = 1; g.filter = 'blur(0.7px)';
        path(); g.strokeStyle = dark ? 'rgba(90,8,18,0.5)' : 'rgba(150,18,34,0.45)'; g.lineWidth = 1.3; g.stroke();
        g.filter = 'none';
        g.save(); path(); g.clip();
        g.strokeStyle = 'rgba(255,210,210,0.06)'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const ex = 18 + i * 14 + (r() - 0.5) * 6; g.beginPath(); g.moveTo(32, 64); g.quadraticCurveTo((32 + ex) / 2, 38, ex, 16 + r() * 8); g.stroke(); }
        g.restore();
      });
    }

    // ---------- 花的姿态：枝顶节点、垂下的花颈方向（随风轻摆、第一句第9字后更沉，落瓣后回弹） ----------
    const N0 = { x: 838, y: 250 }, NECK = 50, CEN = 36;
    function headPose(t, tR, tRel) {
      const dro = easeInOut(clamp((t - tR) / 0.8, 0, 1));
      const u = t - tRel, reb = u > 0 ? (1 - Math.exp(-u / 0.45) * Math.cos(TAU * 1.3 * u)) : 0;
      const sway = 0.026 * Math.sin(TAU * 0.45 * t + 0.6) + 0.013 * Math.sin(TAU * 0.93 * t + 2.1);
      // 方向角：0 指向右，π/2 指向下；花颈原本朝左下，风向左
      const ang = 1.98 + 0.03 - dro * 0.24 + reb * 0.17 + sway;
      const nx = N0.x - 1.5 * Math.sin(TAU * 0.45 * t + 0.6) + reb * 2, ny = N0.y + dro * 7 - reb * 6;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return { nx, ny, ang, px: nx + ca * NECK, py: ny + sa * NECK, cx: nx + ca * (NECK + CEN), cy: ny + sa * (NECK + CEN) };
    }
    // 花瓣布局（花头局部坐标：+y 是花面朝向，即花颈延长方向；a 为相对花面轴的偏角）
    // 侧面看下垂的花：外瓣自花托张开成杯，内瓣皱缩，花心在杯口，前瓣遮住一部分
    let PET = null;
    function petals() {
      if (PET) return PET;
      const r = A.rng(6464), out = [];
      const add = (n, a0, a1, by, L, Wd, dark, ord, jb) => {
        for (let i = 0; i < n; i++) {
          const a = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1)) + (r() - 0.5) * 0.18;
          out.push({ bx: (r() - 0.5) * jb, by: by + (r() - 0.5) * 6, a, L: L * (0.9 + r() * 0.2), Wd: Wd * (0.88 + r() * 0.24), spr: Math.floor(r() * 6), dark, ord: ord + r() * 0.5 });
        }
      };
      add(3, -2.3, 2.3, -28, 36, 40, true, 0, 10);       // 反卷的护瓣
      add(9, -1.2, 1.2, -24, 78, 56, false, 1, 16);      // 后面的外瓣（看到内侧）
      add(4, -0.9, 0.9, -26, 70, 60, true, 1.6, 10);     // 上方拱起的外瓣背面
      add(10, -0.85, 0.85, -12, 46, 40, true, 2, 34);    // 皱缩的内瓣
      add(6, -0.95, 0.95, -18, 64, 52, false, 4, 30);    // 前面的外瓣
      add(4, -0.5, 0.5, 6, 30, 34, true, 4.6, 26);       // 杯口卷起的小瓣
      out.sort((a, b) => a.ord - b.ord);
      return (PET = out);
    }
    const local2w = (P, lx, ly) => { const R = P.ang - Math.PI / 2, c = Math.cos(R), s = Math.sin(R); return [P.cx + c * lx - s * ly, P.cy + s * lx + c * ly]; };
    function petalAttached(P, q) {
      const [bx, by] = local2w(P, q.bx, q.by);
      return { bx, by, th: P.ang - q.a, L: q.L };
    }
    // 落瓣：每瓣的松脱时刻、下落参数、落点（全部由常数推出）
    // 落点先在花下的湿石面与积水里均匀铺开（最多约两层），再反推每瓣所受的风（一律向左）和松脱时的初速；
    // 松脱在第1句第9字后 0.04–0.34 s 内，终速按需加大，保证第11字前后（tLand）全部落定
    let FALL = null;
    function fallPlan(tR, tLand) {
      if (FALL && FALL.tR === tR && FALL.tLand === tLand) return FALL;
      const ps = petals(), r = A.rng(6565), list = [];
      const tg = [];
      // 花下偏左（风向左）最密，向外渐疏，外缘不规则
      for (let guard = 0, md = 28; tg.length < ps.length; guard++) {
        if (guard % 800 === 799) md *= 0.92;
        const x = 480 + r() * 500, y = 563 + r() * 36;
        const dx = (x - 715) / 125, dy = (y - 566) / 20;
        const dens = Math.exp(-dx * dx - dy * dy) * (0.75 + 0.5 * A.noise1(x * 0.02, 41));
        if (r() > dens) continue;
        if (tg.every(([a, b]) => Math.hypot(a - x, (b - y) * 3.4) > md)) tg.push([x, y]);
      }
      const pre = ps.map((q, i) => {
        const tr = tR + 0.04 + Math.pow(r(), 0.8) * 0.26;
        const P = headPose(tr, tR, 99);
        const a = petalAttached(P, q);
        const half = (a.L * 32) / 72;
        return { q, i, tr, a, c0x: a.bx + Math.cos(a.th) * half, c0y: a.by + Math.sin(a.th) * half, key: r() };
      });
      // 左边的瓣落到左边：按起点 x 与落点 x 排序后配对（加一点扰动）
      const order = pre.slice().sort((u, v) => (u.c0x + u.key * 40) - (v.c0x + v.key * 40));
      const tgs = tg.slice().sort((u, v) => u[0] - v[0]);
      order.forEach((o, k) => { o.xt = tgs[k][0]; o.yl = tgs[k][1]; });
      for (const o of pre) {
        const { q, i, tr, a, c0x, c0y, yl } = o;
        // 下落时长 0.6–0.9 s（分镜），但不晚于 tLand 落定；由时长反求终速（湿重的花瓣约 0.3–0.6 m/s）
        const Td = Math.min(0.6 + 0.3 * r(), tLand - tr);
        const mkFy = (v) => { const kk = v / GP; return (u) => c0y + v * (u - kk * (1 - Math.exp(-u / kk))); };
        const tOf = (fyv) => { let lo = 0, hi = 3; for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (fyv(m) < yl) lo = m; else hi = m; } return hi; };
        let vlo = 150, vhi = 2000;
        for (let it = 0; it < 24; it++) { const vm = (vlo + vhi) / 2; if (tOf(mkFy(vm)) > Td) vlo = vm; else vhi = vm; }
        const fy = mkFy(vhi), tl = tOf(fy), kx = 0.3;
        const fl = { A: 8 + r() * 14, w: 5 + r() * 5, ph: r() * TAU };
        const Wk = (u) => u - kx * (1 - Math.exp(-u / kx)), Vk = (u) => 0.22 * (1 - Math.exp(-u / 0.22));
        const flu = (u) => fl.A * Math.sin(fl.w * u + fl.ph) * (1 - Math.exp(-u / 0.12));
        // 风速 ≤ 0（向左），不够的部分由松脱时的弹出初速补足
        const need = o.xt - c0x - flu(tl);
        let wind = clamp(need / Wk(tl), -900, -40);
        const vx0 = clamp((need - wind * Wk(tl)) / Vk(tl), -340, 240);
        const fx = (u) => c0x + wind * Wk(u) + vx0 * Vk(u) + flu(u);
        const xl = fx(tl);
        const rot = (r() < 0.5 ? -1 : 1) * (2.5 + r() * 4), fw = 6 + r() * 6, fph = r() * TAU;
        // 落地时的朝向：最后 0.25 s 转到最近的水平方向，再各偏 ±1.1 rad（平躺在地上的朝向各不相同，压扁后多半近乎水平）
        const thE = a.th + rot * tl, thL = Math.round(thE / Math.PI) * Math.PI + (h2(i, 613) - 0.5) * 2.2;
        list.push({ q, tr, c0x, c0y, th0: a.th, L: a.L, fy, fx, tl, xl, yl, wet: inPud(xl, yl, 6), rot, fw, fph, thL, i });
      }
      FALL = { tR, tLand, list, tRel: Math.max(...list.map((f) => f.tr)) };
      return FALL;
    }
    // sq：屏幕空间的纵向压扁（平躺在地上、水上时的透视），sx：沿花瓣自身横向的翻转
    function drawPetal(g, spr, x, y, th, sx, sy, Wd, L, pivot, sq) {
      g.save(); g.translate(x, y); if (sq != null) g.scale(1, sq);
      g.rotate(th + Math.PI / 2); g.scale(sx * Wd / 64, sy * L / 72);
      g.drawImage(spr, -32, pivot === 'base' ? -70 : -36, 64, 72);
      g.restore();
    }
    // 涟漪
    function ripple(g, x, y, age, big) {
      for (let k = 0; k < 2; k++) {
        const a = age - k * 0.16; if (a <= 0 || a > 1.6) continue;
        const R = (big ? 4 : 2) + (big ? 46 : 26) * Math.pow(a, 0.6);
        const al = (big ? 0.42 : 0.3) * Math.pow(1 - a / 1.6, 1.5) * clamp(a / 0.05, 0, 1) * (1 - k * 0.35);
        g.strokeStyle = `rgba(232,236,236,${al})`; g.lineWidth = 1.1;
        g.beginPath(); g.ellipse(x, y, R, R * 0.16, 0, 0, TAU); g.stroke();
      }
    }
    // 水珠：在瓣尖聚满、拉长、下落（加速）
    function drawBead(g, x, y, rad, stretch) {
      g.fillStyle = 'rgba(236,240,240,0.62)';
      g.beginPath(); g.ellipse(x, y, rad, rad * stretch, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,70,70,0.45)'; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.35 * stretch, Math.max(0.6, rad * 0.28), 0, TAU); g.fill();
    }

    function draw(g, c) {
      const t = c.lt, t0 = c.t - c.lt;
      const ct = (k, d) => (c.charT(k) != null ? c.charT(k) - t0 : d);
      const tRen = ct(2, 0.96), tSan = ct(3, 1.48), tFa = ct(4, 2.18), tR = ct(8, 3.92);
      const FP = fallPlan(tR, ct(10, 4.8) + 0.05);
      const P = headPose(t, tR, FP.tRel);
      g.drawImage(bgLayer(), 0, 0, W, H);
      // 叶丛：整片以压顶石处为根轻摆（风向左：越高的叶子越往左偏）
      const sh = 0.008 * (0.6 + 0.4 * Math.sin(TAU * 0.4 * t)) + 0.003 * Math.sin(TAU * 0.83 * t + 1);
      g.save(); g.transform(1, 0, sh, 1, -sh * (CAP + 20), 0);
      g.drawImage(leafLayer(), LV.x, LV.y, LV.w, LV.h);
      g.restore();
      // 花枝：从叶丛里拱起，到节点后垂下；花颈与枝在节点处切线连续，末端顺着花头的朝向
      const c2x = 900, c2y = 206 + (P.ny - N0.y) * 0.5;
      let ux = P.nx - c2x, uy = P.ny - c2y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
      g.lineCap = 'round';
      g.strokeStyle = '#4b654c'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(952, CAP + 30);
      g.bezierCurveTo(944, 262, c2x, c2y, P.nx, P.ny);
      g.bezierCurveTo(P.nx + ux * NECK * 0.4, P.ny + uy * NECK * 0.4, P.px - ca * NECK * 0.35, P.py - sa * NECK * 0.35, P.px, P.py);
      g.stroke();
      g.strokeStyle = 'rgba(190,210,180,0.35)'; g.lineWidth = 1.2; g.stroke();
      g.drawImage(stoneLayer(), 0, 0, W, H);
      g.drawImage(wetLayer(), 0, BASE, W, 120);
      // 积水：映出花台下部（以花台底线翻转），水面暗而亮滑；边缘柔和加深，只在远沿留断续的一线水光
      const st = stoneLayer(), ss = st.width / W;
      const px0 = PUD.cx - PUD.rx * 1.12, pw = PUD.rx * 2.24;
      g.save(); pudPath(g); g.clip();
      for (let y = PUD.cy - PUD.ry * 1.15; y < PUD.cy + PUD.ry * 1.15; y += 1.5) {
        const ys = 2 * BASE - y - 1.5, dx = 0.7 * Math.sin(y * 0.5 + t * 2.1) + 0.4 * Math.sin(y * 0.17 - t * 1.3);
        g.drawImage(st, px0 * ss, ys * ss, pw * ss, 1.5 * ss, px0 + dx, y, pw, 1.7);
      }
      g.fillStyle = 'rgba(22,28,30,0.42)'; g.fillRect(px0 - 10, PUD.cy - PUD.ry * 1.3, pw + 20, PUD.ry * 2.6);
      g.save(); g.translate(PUD.cx, PUD.cy); g.scale(1, PUD.ry / PUD.rx);
      const ge = g.createRadialGradient(0, 0, PUD.rx * 0.55, 0, 0, PUD.rx * 1.12);
      ge.addColorStop(0, 'rgba(14,18,18,0)'); ge.addColorStop(0.7, 'rgba(14,18,18,0.16)'); ge.addColorStop(1, 'rgba(14,18,18,0.34)');
      g.fillStyle = ge; g.fillRect(-PUD.rx * 1.2, -PUD.rx * 1.2, PUD.rx * 2.4, PUD.rx * 2.4);
      g.restore();
      g.restore();
      g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        if (h2(i, 913) < 0.45) continue;
        const a0 = Math.PI * (1.08 + 0.84 * (i + 0.3 * h2(i, 919)) / 26), a1 = a0 + Math.PI * 0.84 / 26 * (0.25 + 0.9 * h2(i, 917));
        g.strokeStyle = `rgba(228,232,232,${0.1 + 0.14 * h2(i, 921)})`;
        g.beginPath();
        for (let k = 0; k <= 4; k++) { const aa = lerp(a0, a1, k / 4), rr = pudR(aa); const x = PUD.cx + Math.cos(aa) * PUD.rx * rr, y = PUD.cy + Math.sin(aa) * PUD.ry * rr + 0.5; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }

      // 花托、萼片与蓇葖（绿色，随画面一起褪色）：花瓣在时被遮住，落尽后露出
      drawCalyx(g, P);

      // ---------- 天光转灰：除牡丹外整体去饱和（第一句第5字起 1.5 s） ----------
      const kd = smooth((t - tFa) / 1.5);
      if (kd > 0) {
        g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.globalAlpha = 0.9 * kd; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = '#d4d7d8'; g.globalAlpha = kd; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }

      // ---------- 花与花瓣 ----------
      const ps = petals(), SQ = 0.3;
      const tipOf = (idx) => { const q = ps[idx], a = petalAttached(P, q); return [a.bx + Math.cos(a.th) * a.L * 0.95, a.by + Math.sin(a.th) * a.L * 0.95]; };
      const front = ps.map((q, i) => ({ q, i })).filter((o) => !o.q.dark && o.q.ord < 2);
      const lowY = (o) => { const a = petalAttached(P, o.q); return a.by + Math.sin(a.th) * o.q.L; };
      const idxA = front.reduce((bb, o) => (lowY(o) > lowY(bb) ? o : bb), front[0]).i;
      const idxB = front[(front.findIndex((o) => o.i === idxA) + 2) % front.length].i;
      const drops = [{ tl: tRen, idx: idxA, yw: 562, g0: -0.8 }, { tl: tSan, idx: idxB, yw: 567, g0: 0.3 }];
      // 每瓣此刻的状态：下落的最后 0.25 s 逐渐放平（纵向压扁到 SQ、转向水平），始终以最低点为准，最低点不低于落点 yl+2；
      // 落定后 0.3 s 内慢慢摊开
      const ext = (L, Wd, th, sx, sq) => sq * (Math.abs(Math.sin(th)) * L * 35 / 72 + Math.abs(Math.cos(th)) * Wd * sx * 31 / 64);
      const st8 = [];
      for (const f of FP.list) {
        if (t < f.tr) continue;
        const u = t - f.tr, spr = petalSprite(f.q.spr, f.q.dark);
        if (u < f.tl) {
          const flip = 0.3 + 0.7 * Math.abs(Math.cos(f.fw * u * 0.5)), kb = smooth(1 - (f.tl - u) / 0.25);
          const th = lerp(f.th0 + f.rot * u, f.thL, kb), sq = lerp(1, SQ, kb), e = ext(f.L, f.q.Wd, th, flip, sq);
          st8.push({ f, spr, fall: true, kb, x: f.fx(u), y: Math.min(f.fy(u), f.yl + 2 - e), th, sx: flip, sq });
        } else {
          const w = u - f.tl, k = smooth(w / 0.3);
          const flipL = 0.3 + 0.7 * Math.abs(Math.cos(f.fw * f.tl * 0.5)), sx = lerp(flipL, 0.95, k);
          const th = f.thL + 0.12 * Math.sign(f.rot) * (1 - Math.exp(-w / 0.5)), e = ext(f.L, f.q.Wd, th, sx, SQ);
          const drift = f.wet ? -9 * (1 - Math.exp(-w / 1.4)) : 0, bob = f.wet ? 0.4 * Math.sin(TAU * 0.8 * w + f.fph) * Math.min(1, w / 0.3) : 0;
          st8.push({ f, spr, fall: false, k, x: f.xl + drift, y: Math.min(f.yl, f.yl + 2 - e) + bob, th, sx, sq: SQ });
        }
      }
      // 1) 落水花瓣的倒影（以各自落点的水面为轴）
      g.save(); pudPath(g); g.clip();
      for (const o of st8) {
        if (!o.f.wet) continue;
        // 倒影以落点处的水面（瓣的最低点 yl+2）为轴翻转
        if (o.fall) {
          if (o.f.yl - o.y > 40) continue;
          g.globalAlpha = 0.4; g.save(); g.translate(0, 2 * (o.f.yl + 2)); g.scale(1, -1);
          drawPetal(g, o.spr, o.x, o.y, o.th, o.sx, 1, o.f.q.Wd, o.f.L, 'c', o.sq); g.restore();
        } else {
          g.globalAlpha = 0.3;
          // 漂在水面的瓣：倒影几乎被自身遮住，只在近缘露出一线（翻卷的瓣缘）
          drawPetal(g, o.spr, o.x, o.y + 2.5, o.th, o.sx, 1, o.f.q.Wd, o.f.L, 'c', -o.sq);
        }
      }
      g.globalAlpha = 1;
      // 2) 涟漪（水珠、落瓣）画在漂浮的花瓣下面
      for (const d of drops) { const [tx] = tipOf(d.idx); if (t > d.tl) ripple(g, tx, d.yw, t - d.tl, false); }
      for (const f of FP.list) { if (!f.wet) continue; const age = t - f.tr - f.tl; if (age > 0) ripple(g, f.xl, f.yl, age, false); }
      g.restore();
      // 3) 落定的花瓣（远的先画），4) 正在下落的花瓣
      st8.filter((o) => !o.fall).sort((p1, p2) => p1.f.yl - p2.f.yl).forEach((o) => drawPetal(g, o.spr, o.x, o.y, o.th, o.sx, 1, o.f.q.Wd, o.f.L, 'c', o.sq));
      st8.filter((o) => o.fall).forEach((o) => drawPetal(g, o.spr, o.x, o.y, o.th, o.sx, 1, o.f.q.Wd, o.f.L, 'c', o.sq));
      // 5) 还在花头上的花瓣
      const fl = FP.list;
      const attached = (i) => t < fl.find((f) => f.i === i).tr;
      const left = ps.filter((qq, j) => attached(j)).length / ps.length, ka = clamp(left * 2.5, 0, 1);
      ps.forEach((q, i) => {
        if (!attached(i)) return;
        const a = petalAttached(P, q);
        drawPetal(g, petalSprite(q.spr, q.dark), a.bx, a.by, a.th, 1, 1, q.Wd, a.L, 'base');
      });
      // 花心一点暖黄：从杯口露出的花蕊（随花瓣松脱一起散落）
      if (ka > 0) {
        const [mx, my] = local2w(P, 2, 34);
        A.glow(g, mx, my, 11, '#e2a640', 0.4 * ka);
        for (let m = 0; m < 9; m++) {
          const [sx0, sy0] = local2w(P, (h2(m, 3) - 0.5) * 16, 30 + h2(m, 5) * 8);
          g.fillStyle = `rgba(${236 + 14 * h2(m, 7) | 0},${196 + 30 * h2(m, 8) | 0},${90 + 40 * h2(m, 9) | 0},${0.9 * ka})`;
          g.beginPath(); g.arc(sx0, sy0, 1.1 + 0.7 * h2(m, 6), 0, TAU); g.fill();
        }
      }
      // 6) 瓣尖水珠（第1句第3、4字时落进积水）
      for (const d of drops) {
        const [tx, ty] = tipOf(d.idx);
        const tf = Math.sqrt((2 * (d.yw - ty - 5)) / GP), td = d.tl - tf;
        if (t < td) {
          if (t > tR) continue;
          const k = clamp((t - d.g0) / (td - d.g0), 0, 1), rad = 1.8 + 3.4 * smooth(k);
          drawBead(g, tx, ty + rad * (1 + 0.4 * k), rad, 1 + 0.35 * k * k);
        } else if (t < d.tl) {
          const u = t - td, y = ty + 5 + 0.5 * GP * u * u;
          drawBead(g, tx, y, 3.8, 1 + Math.min(1.1, u * 6));
        } else if (t < tR) {
          const k = clamp((t - d.tl) / 1.4, 0, 1), rad = 1.2 + 1.6 * smooth(k);
          drawBead(g, tx, ty + rad, rad, 1);
        }
      }
    }
    // 花托、萼片（反卷贴着花颈）与花心的几枚蓇葖
    function drawCalyx(g, P) {
      const leaf = (x0, y0, x1, y1, w, bend, col) => {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x0 + nx * w * 0.5, y0 + ny * w * 0.5);
        g.quadraticCurveTo(mx + nx * (w + bend), my + ny * (w + bend), x1, y1);
        g.quadraticCurveTo(mx + nx * (-w + bend), my + ny * (-w + bend), x0 - nx * w * 0.5, y0 - ny * w * 0.5);
        g.closePath(); g.fill();
      };
      // 萼片：短而宽，自花托生出，尖端贴着花颈反卷
      for (const [sd, ox, oy, w, bd] of [[-1, 9, -6, 5.5, -1.5], [1, 10, -5, 6, 1.5], [-1, 5, -11, 4, -1], [1, 4, -12, 3.8, 1]]) {
        const [x0, y0] = local2w(P, sd * 3, -CEN + 7), [x1, y1] = local2w(P, sd * ox, -CEN + oy);
        leaf(x0, y0, x1, y1, w, bd, sd > 0 ? '#4a6544' : '#557150');
      }
      // 花托：一小团略鼓的绿
      const [rx, ry] = local2w(P, 0, -CEN + 7);
      g.fillStyle = '#4f6b48'; g.beginPath(); g.ellipse(rx, ry, 7, 5.5, P.ang, 0, TAU); g.fill();
      // 蓇葖：三四枚黄绿色的小果，朝花面方向微微张开，带一点茸毛的亮边
      for (const [ang, len, ox] of [[-0.34, 10, -3.5], [0.03, 11.5, 0], [0.38, 10, 3.5], [0.16, 8, 1.5]]) {
        const [x0, y0] = local2w(P, ox, -CEN + 9);
        const d = P.ang + ang, x1 = x0 + Math.cos(d) * len, y1 = y0 + Math.sin(d) * len;
        leaf(x0, y0, x1, y1, 5.2, 0.6, '#a2ad46');
        leaf(x0 + Math.cos(d) * 2, y0 + Math.sin(d) * 2, x1, y1, 3, 0.4, 'rgba(200,198,118,0.55)');
      }
    }
    return { draw, warm: [bgLayer, leafLayer, stoneLayer, wetLayer, () => { for (let k = 0; k < 6; k++) { petalSprite(k, false); petalSprite(k, true); } }] };
  })();

  XYT.registerShot('e6_peony', {
    name: '残红', zone: 'left', night: false,
    text: '#2a2622', shadow: 'rgba(250,248,244,0.85)', accent: '#b3202d', bloom: 0.2,
    draw: E6.draw,
  });

  // =====================================================================
  // e7_fireflies 萤火消晨：雨后初夏夜将尽，山涧竹林萤火；东方日出第一线光，萤火一只只淡去
  // =====================================================================
  const E7 = (function () {
    const SUN = { x: 1064, y: 0 };
    const WSH = 0.3;                           // 涧水晨光的峰值强度
    const bankY = (x) => 474 + 6 * Math.sin(x * 0.006 + 0.8) + 3 * Math.sin(x * 0.021);
    const ridge = (k, x) => {
      // 三层远山的山脊线：远山峰峦起伏，中层缓丘，近处左侧一座小山
      if (k === 0) return 360 - 70 * Math.pow(A.noise1(x * 0.0042, 31), 1.6) - 18 * A.noise1(x * 0.014, 32) + 10 * sstep(900, 1280, x);
      if (k === 1) return 420 - 64 * Math.pow(A.noise1(x * 0.0036 + 4, 33), 1.8) - 9 * A.noise1(x * 0.016, 34) + 16 * sstep(700, 1280, x);
      return 474 - 92 * Math.pow(sstep(820, 200, x), 1.2) * (0.75 + 0.25 * A.noise1(x * 0.006, 35)) - 6 * A.noise1(x * 0.03, 36);
    };
    SUN.y = Math.max(ridge(0, SUN.x), ridge(1, SUN.x) - 400) + 2;      // 日轮上缘刚露出最远的山脊
    // 竹：远岸几丛（略亮，空气透视），太阳正对处留出空隙；右侧近景两竿最暗、最粗
    let BAM = null;
    function bamboo() {
      if (BAM) return BAM;
      const r = A.rng(7070), far = [], near = [];
      const xs = [770, 792, 846, 902, 918, 974, 1010, 1112, 1131, 1166, 1222, 1240];
      for (const x of xs) far.push({ x: x + (r() - 0.5) * 8, w: 5 + r() * 4, lean: (r() - 0.5) * 0.06, base: bankY(x) + 1, seed: Math.floor(r() * 1000) });
      for (const [x, w] of [[1192, 19], [1252, 25]]) near.push({ x, w, lean: (r() - 0.5) * 0.03, base: 760, seed: Math.floor(r() * 1000) });
      return (BAM = { far, near });
    }
    const stalkX = (s, y) => s.x + (s.base - y) * s.lean;
    // 竹竿：一节一节，节处略收、留一线空白，节上一道深环
    function drawStalk(g, s, col, top, nodeCol) {
      const r = A.rng(s.seed + 11);
      let y = s.base;
      g.fillStyle = col;
      while (y > top) {
        const seg = 52 + r() * 34, y1 = Math.max(top, y - seg);
        const w0 = s.w * (0.92 + 0.08 * (y - top) / (s.base - top + 1)), w1 = w0 * 0.97;
        g.beginPath();
        g.moveTo(stalkX(s, y) - w0 / 2, y - 1.5); g.lineTo(stalkX(s, y1) - w1 / 2, y1 + 1.5);
        g.lineTo(stalkX(s, y1) + w1 / 2, y1 + 1.5); g.lineTo(stalkX(s, y) + w0 / 2, y - 1.5); g.closePath(); g.fill();
        g.fillStyle = nodeCol; g.fillRect(stalkX(s, y1) - w1 * 0.62, y1 - 1, w1 * 1.24, 2.4);
        g.fillStyle = col;
        y = y1;
      }
    }
    // 竹叶：“个”“介”字形的一组三到五片，披针形，叶尖下垂
    function leafGroup(g, x, y, s, col, seed, dir) {
      const r = A.rng(seed);
      g.fillStyle = col;
      const n = 3 + Math.floor(r() * 3);
      const base = Math.PI / 2 + dir * (0.5 + r() * 0.5);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * (0.32 + r() * 0.12), L = (30 + r() * 22) * s, w = (3.6 + r() * 1.8) * s;
        g.save(); g.translate(x, y); g.rotate(a - Math.PI / 2);
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(w * 1.1, L * 0.25, w * 0.6, L * 0.7, 0, L); g.bezierCurveTo(-w * 0.5, L * 0.7, -w * 1.0, L * 0.25, 0, 0); g.fill();
        g.restore();
      }
    }
    function bambooLeaves(g, s, col, top, scale, seed) {
      const r = A.rng(seed);
      g.strokeStyle = col; g.lineWidth = 1.2 * scale;
      for (let k = 0; k < 7; k++) {
        const y = top + 30 + r() * (s.base > 700 ? 300 : 260), dir = r() < 0.5 ? -1 : 1;
        const x0 = stalkX(s, y), bx = x0 + dir * (24 + r() * 40) * scale, by = y - (10 + r() * 20) * scale;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + bx) / 2, y - 4, bx, by); g.stroke();
        leafGroup(g, bx, by, scale, col, seed + k * 13, dir);
        if (r() < 0.6) leafGroup(g, (x0 + bx) / 2, y - 3, scale * 0.8, col, seed + k * 17 + 5, dir);
      }
    }
    // 天空：夜将尽，东方天边一线鱼肚白
    function skyLayer() {
      return K.cache('ff5_e7_sky', W, 500, 1, (g) => {
        g.fillStyle = A.vgrad(g, 0, 500, [[0, '#0a1220'], [0.5, '#101d31'], [1, '#1d3046']]); g.fillRect(0, 0, W, 500);
        // 黎明前：东边（右侧四成）整片天已经泛起冷灰的微明
        const gl = g.createLinearGradient(700, 0, W, 0);
        gl.addColorStop(0, 'rgba(84,110,132,0)'); gl.addColorStop(0.45, 'rgba(84,110,132,0.12)'); gl.addColorStop(1, 'rgba(96,120,140,0.24)');
        g.fillStyle = gl; g.fillRect(700, 0, W - 700, 500);
        const gr = g.createRadialGradient(SUN.x, SUN.y + 40, 10, SUN.x, SUN.y + 40, 900);
        gr.addColorStop(0, 'rgba(112,138,152,0.78)'); gr.addColorStop(0.22, 'rgba(76,102,122,0.44)');
        gr.addColorStop(0.55, 'rgba(48,72,96,0.16)'); gr.addColorStop(1, 'rgba(36,56,79,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, 500);
        // 天边几缕极淡的云，下缘受东方微光
        g.filter = 'blur(3px)';
        for (let i = 0; i < 6; i++) {
          const x = 700 + i * 100 + (h2(i, 4) - 0.5) * 60, y = 262 + h2(i, 5) * 60;
          g.fillStyle = `rgba(84,110,130,${0.16 + 0.1 * h2(i, 6)})`;
          g.beginPath(); g.ellipse(x, y, 110 + 80 * h2(i, 7), 5 + 3 * h2(i, 8), -0.02, 0, TAU); g.fill();
        }
        g.filter = 'none';
      });
    }
    // 远山三层（山顶深、山脚没入雾里）、水面（含倒影）、远岸竹丛
    const MT = [{ top: '#2a4157', mist: '#4f6b80', y1: 432 }, { top: '#1a2b3f', mist: '#3a566a', y1: 462 }, { top: '#101c2b', mist: '#253a4d', y1: 480 }];
    function landLayer() {
      return K.cache('ff5_e7_land', W, H, 1, (g) => {
        const B = bamboo();
        const mtn = (gg, k, flip) => {
          gg.beginPath();
          for (let x = -10; x <= W + 10; x += 5) {
            const y = ridge(k, x), yy = flip ? 2 * bankY(x) - y : y;
            x < 0 ? gg.moveTo(x, yy) : gg.lineTo(x, yy);
          }
          gg.lineTo(W + 10, flip ? 470 : H); gg.lineTo(-10, flip ? 470 : H); gg.closePath();
        };
        MT.forEach((m, k) => {
          let ymin = 1e9; for (let x = 0; x <= W; x += 20) ymin = Math.min(ymin, ridge(k, x));
          g.filter = `blur(${[2.2, 1.4, 0.7][k]}px)`;
          mtn(g, k, false);
          g.fillStyle = A.vgrad(g, ymin, m.y1, [[0, m.top], [0.55, mix(m.top, m.mist, 0.45)], [1, m.mist]]); g.fill();
          g.filter = 'none';
          // 山脚雾带
          g.fillStyle = A.vgrad(g, m.y1 - 50, m.y1 + 10, [[0, 'rgba(111,140,156,0)'], [0.75, 'rgba(111,140,156,0.28)'], [1, 'rgba(111,140,156,0)']]);
          g.fillRect(0, m.y1 - 50, W, 60);
        });
        // 远岸竹丛
        const fc = '#152233', fn = '#0e1826';
        for (const s of B.far) drawStalk(g, s, fc, -20, fn);
        for (const s of B.far) bambooLeaves(g, s, fc, -20, 0.8, 7200 + s.seed);
        // 岸脚
        g.fillStyle = '#0b131e';
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, bankY(x) - 3 - 4 * A.noise1(x * 0.04, 3) * sstep(600, 800, x));
        for (let x = W + 10; x >= -10; x -= 6) g.lineTo(x, bankY(x) + 2);
        g.closePath(); g.fill();
        // 水面：天光倒影 + 远山、远竹倒影（以岸线翻转，暗一些）
        const wt = document.createElement('canvas'), sc = g.getTransform().a;
        wt.width = Math.round(W * sc); wt.height = Math.round(H * sc);
        const w = wt.getContext('2d'); w.scale(sc, sc);
        w.fillStyle = A.vgrad(w, 470, H, [[0, '#24374d'], [0.45, '#162438'], [1, '#0c1524']]); w.fillRect(0, 0, W, H);
        const gr = w.createRadialGradient(SUN.x, 540, 10, SUN.x, 540, 640);
        gr.addColorStop(0, 'rgba(100,128,144,0.46)'); gr.addColorStop(1, 'rgba(36,56,79,0)');
        w.fillStyle = gr; w.fillRect(0, 470, W, 250);
        MT.forEach((m, k) => { mtn(w, k, true); w.fillStyle = mix(m.top, '#0a1220', 0.3); w.fill(); });
        for (const s of B.far) { w.save(); w.translate(0, 2 * s.base); w.scale(1, -1); drawStalk(w, s, '#0d1623', -20, '#0a121d'); w.restore(); }
        // 水纹：细碎横纹（近处稍长）
        for (let i = 0; i < 300; i++) {
          const y = 478 + Math.pow(h2(i, 1), 1.3) * 240, x = h2(i, 2) * W, d = (y - 470) / 250, l = 14 + 70 * h2(i, 3) * d;
          w.fillStyle = h2(i, 4) < 0.55 ? `rgba(6,10,18,${0.25 + 0.2 * d})` : 'rgba(130,160,180,0.07)';
          w.fillRect(x, y, l, 0.8 + d * 1.2);
        }
        g.save();
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, bankY(x));
        g.lineTo(W + 10, H); g.lineTo(-10, H); g.closePath(); g.clip();
        g.filter = 'blur(1.6px)';
        g.drawImage(wt, 0, 0, W, H);
        g.filter = 'none';
        g.restore();
      });
    }
    // 近景：右侧两竿近竹与垂叶、左下与右下岸石草丛
    function nearLayer() {
      return K.cache('ff5_e7_near', W, H, 1, (g) => {
        const B = bamboo(), r = A.rng(7272);
        for (const s of B.near) drawStalk(g, s, '#060a10', -30, '#03060a');
        for (const s of B.near) bambooLeaves(g, s, '#05080d', -40, 1.3, 7300 + s.seed);
        // 从画外垂进来的一枝竹叶
        g.strokeStyle = '#05080d'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(1290, 40); g.quadraticCurveTo(1180, 60, 1110, 120); g.stroke();
        for (let k = 0; k < 5; k++) leafGroup(g, 1290 - k * 40, 46 + k * 16, 1.35, '#05080d', 7400 + k, -1);
        // 左下岸石与草
        g.fillStyle = '#070b11';
        g.beginPath(); g.moveTo(-20, 646); g.bezierCurveTo(60, 622, 160, 630, 232, 664); g.bezierCurveTo(282, 688, 330, 704, 380, 740); g.lineTo(-20, 740); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(1010, 740); g.bezierCurveTo(1040, 672, 1120, 638, 1300, 628); g.lineTo(1300, 740); g.closePath(); g.fill();
        g.strokeStyle = '#070b11'; g.lineWidth = 1.5;
        for (let i = 0; i < 64; i++) {
          const left = i < 36, x = left ? r() * 330 : 1030 + r() * 260, y0 = left ? 656 + (x / 330) * 28 : 652 - (x - 1030) * 0.08;
          const h = 12 + r() * 34, lean = (r() - 0.5) * 14;
          g.beginPath(); g.moveTo(x, y0 + 6); g.quadraticCurveTo(x + lean * 0.3, y0 - h * 0.6, x + lean, y0 - h); g.stroke();
        }
        g.strokeStyle = 'rgba(93,122,138,0.22)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(10, 638); g.bezierCurveTo(70, 622, 150, 628, 214, 656); g.stroke();
        g.beginPath(); g.moveTo(1060, 666); g.bezierCurveTo(1110, 644, 1190, 634, 1290, 630); g.stroke();
      });
    }
    // 萤火：各自的平滑游动、呼吸闪烁、所在的地面深度（决定倒影）与淡去顺序
    // 两只同高并排会像一对眼睛：整镜逐 0.1 s 检查（含倒影），太近就重抽
    let FF = null;
    function flies() {
      if (FF) return FF;
      const r = A.rng(7777), out = [], P = [];
      const TS = []; for (let k = 0; k <= 73; k++) TS.push(-0.6 + k * 0.1);
      const mk = () => {
        const overWater = r() < 0.6;
        const yg = overWater ? 490 + Math.pow(r(), 0.8) * 190 : 430 + r() * 40;
        const depth = clamp((yg - 420) / 280, 0, 1);
        const x0 = 380 + r() * 860;
        const hgt = (overWater ? 18 + r() * 120 : 40 + r() * 230) * (0.6 + 0.6 * depth);
        return {
          x0, yg, hgt, s: 0.55 + 0.75 * depth,
          ax: [12 + r() * 14, 5 + r() * 5], wx: [0.2 + r() * 0.25, 0.6 + r() * 0.5], px: [r() * TAU, r() * TAU],
          ay: [8 + r() * 12, 4 + r() * 6], wy: [0.3 + r() * 0.4, 0.8 + r() * 0.7], py: [r() * TAU, r() * TAU],
          T: 1 + r() * 2, ph: r() * TAU,
        };
      };
      const path = (f) => TS.map((t) => { const [x, y] = flyPos(f, t); return [x, y, f.yg > bankY(x) + 3 ? 2 * f.yg - y : null]; });
      const near = (a, b) => {
        if (Math.abs(a[0] - b[0]) >= 42) return false;
        const ys = [[a[1], b[1]], [a[2], b[1]], [a[1], b[2]], [a[2], b[2]]];
        return ys.some(([u, v]) => u != null && v != null && Math.abs(u - v) < 13);
      };
      for (let guard = 0; out.length < 46 && guard < 4000; guard++) {
        const f = mk(), q = path(f);
        let ok = true;
        for (let j = 0; j < P.length && ok; j++) for (let k = 0; k < TS.length; k++) if (near(q[k], P[j][k])) { ok = false; break; }
        if (!ok) continue;
        // 邻近的萤火在最靠近的时刻闪烁相位错开至少 π/2
        for (let j = 0; j < P.length; j++) {
          let dm = 1e9, km = 0;
          for (let k = 0; k < TS.length; k++) { const d = Math.hypot(q[k][0] - P[j][k][0], q[k][1] - P[j][k][1]); if (d < dm) { dm = d; km = k; } }
          if (dm > 80) continue;
          const o = out[j], tk = TS[km];
          const dph = ((((TAU * tk) / f.T + f.ph) - ((TAU * tk) / o.T + o.ph)) % TAU + TAU) % TAU;
          if (dph < Math.PI / 2 || dph > TAU - Math.PI / 2) f.ph += Math.PI;
        }
        out.push(f); P.push(q);
      }
      // 离东方亮处越近越早被晨光淹没
      out.forEach((f) => { f.key = -f.x0 + (r() - 0.5) * 380; });
      const sorted = out.slice().sort((a, b) => a.key - b.key);
      sorted.forEach((f, k) => { f.order = k / (sorted.length - 1); });
      return (FF = out);
    }
    function flyPos(f, t) {
      const x = f.x0 + f.ax[0] * Math.sin(f.wx[0] * t + f.px[0]) + f.ax[1] * Math.sin(f.wx[1] * t + f.px[1]);
      const y = f.yg - f.hgt + f.ay[0] * Math.sin(f.wy[0] * t + f.py[0]) + f.ay[1] * Math.sin(f.wy[1] * t + f.py[1]);
      return [x, y];
    }

    function draw(g, c) {
      const t = c.lt, t0 = c.t - c.lt;
      const ct = (k, d) => (c.charT(k) != null ? c.charT(k) - t0 : d);
      const tYu = ct(4, 2.2), tTu = ct(8, 3.82);
      // 晨光：日轮上缘刚露出山脊，耀斑在约 1.6 s 内亮起；日轮露出的面积随升起增长，光持续变强（只在 x>600 一侧）
      const k1 = smooth((t - tYu) / 1.6), late = Math.pow(clamp((t - tYu - 1) / 4, 0, 1), 1.5);
      const kd = k1 * (0.8 + 0.5 * late), kc = Math.min(1, kd);
      // 天光的颜色：先是鱼肚白，约 2.6 s 内转成淡金
      const gold = smooth((t - tYu - 0.4) / 2.6);
      const mixc = (p, q, k) => [0, 1, 2].map((i) => Math.round(p[i] + (q[i] - p[i]) * clamp(k, 0, 1)));
      const FISH = [226, 230, 222], GOLD = [246, 216, 164], cs = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      const cDawn = mixc(FISH, GOLD, gold);
      g.drawImage(skyLayer(), 0, 0, W, 500);
      if (kd > 0) {
        // 东天整片转亮：暖色天光由地平线向上、向两侧铺开（普通叠加，颜色趋向天光本色，不会加成死白）
        g.save(); g.translate(SUN.x, SUN.y + 20); g.scale(1.35, 1);
        const RS = 420 + 80 * late, gs = g.createRadialGradient(0, 0, 0, 0, 0, RS);
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, f = Math.exp(-u * u * 4) * Math.pow(1 - u, 1.6);
          gs.addColorStop(u, cs(mixc(cDawn, [196, 170, 158], u * 0.9), 0.62 * Math.min(1, kd) * f));
        }
        const lx0 = Math.max(-RS, (-SUN.x) / 1.35), lx1 = Math.min(RS, (W - SUN.x) / 1.35), ly0 = Math.max(-RS, -SUN.y - 20), ly1 = Math.min(RS, 500 - SUN.y - 20);
        g.fillStyle = gs; g.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
        g.restore();
        // 日轮周围的耀光
        const R = 120 + 330 * kd;
        const gr = g.createRadialGradient(SUN.x, SUN.y, 4, SUN.x, SUN.y, R);
        gr.addColorStop(0, `rgba(250,236,204,${0.95 * kc})`); gr.addColorStop(0.08, cs(mixc(cDawn, [246, 214, 168], 0.6), 0.7 * kc));
        gr.addColorStop(0.35, cs(mixc(cDawn, [234, 190, 142], 0.7), 0.3 * kc)); gr.addColorStop(1, 'rgba(220,172,130,0)');
        g.fillStyle = gr; g.fillRect(SUN.x - R, Math.max(0, SUN.y - R), Math.min(2 * R, W - SUN.x + R), Math.min(500, SUN.y + R) - Math.max(0, SUN.y - R));
        // 天边一条横向的光带（鱼肚白→淡金）
        g.save(); g.translate(SUN.x - 40, SUN.y + 10); g.scale(2.6 + 0.6 * late, 1);
        const gb = g.createRadialGradient(0, 0, 0, 0, 0, 200);
        gb.addColorStop(0, cs(mixc(cDawn, GOLD, 0.3), 0.36 * kc)); gb.addColorStop(0.5, cs(cDawn, 0.14 * kc)); gb.addColorStop(1, cs(cDawn, 0));
        g.fillStyle = gb; g.fillRect(-200, -200, 400, 400);
        g.restore();
        // 天亮后东天整体再暖一层
        if (gold > 0) {
          g.save(); g.translate(SUN.x, SUN.y + 20); g.scale(1.5, 1);
          const gwm = g.createRadialGradient(0, 0, 0, 0, 0, 380);
          gwm.addColorStop(0, `rgba(233,185,138,${0.26 * gold * kc})`); gwm.addColorStop(0.6, `rgba(233,185,138,${0.1 * gold * kc})`); gwm.addColorStop(1, 'rgba(233,185,138,0)');
          g.fillStyle = gwm; g.fillRect(Math.max(-380, -SUN.x / 1.5), Math.max(-380, -SUN.y - 20), 760, Math.min(760, 500 - SUN.y + 360));
          g.restore();
        }
        A.glow(g, SUN.x, SUN.y + 3, 14 + 4 * late, '#fff1d4', kc);
        A.glow(g, SUN.x, SUN.y + 3, 5 + 2 * late, '#fff8ea', kc);
      }
      g.drawImage(landLayer(), 0, 0, W, H);
      // 远山山脊被晨光勾出一线暖边（仅在太阳附近）
      if (kd > 0) {
        for (let k = 0; k < 2; k++) {
          const span = k ? 180 : 280;
          const gr = g.createLinearGradient(SUN.x - span, 0, SUN.x + span, 0);
          const a = (k ? 0.2 : 0.45) * kd;
          gr.addColorStop(0, 'rgba(246,220,170,0)'); gr.addColorStop(0.5, `rgba(246,220,170,${a})`); gr.addColorStop(1, 'rgba(246,220,170,0)');
          g.strokeStyle = gr; g.lineWidth = 1.1;
          g.beginPath();
          for (let x = SUN.x - span; x <= SUN.x + span; x += 6) { const y = ridge(k, x) + 0.8; x === SUN.x - span ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.stroke();
        }
      }
      // 薄雾：几乎静止的两道雾带（无风，只极慢地漂）
      for (const [y, h, a, sp] of [[440, 34, 0.16, 1.2], [480, 22, 0.14, -0.8]]) {
        const gr = g.createLinearGradient(0, y - h, 0, y + h);
        gr.addColorStop(0, 'rgba(150,176,190,0)'); gr.addColorStop(0.5, `rgba(150,176,190,${a})`); gr.addColorStop(1, 'rgba(150,176,190,0)');
        g.fillStyle = gr;
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 20) g.lineTo(x, y - h + 8 * Math.sin(x * 0.006 + sp * t * 0.05 + y));
        for (let x = W + 10; x >= -10; x -= 20) g.lineTo(x, y + h + 8 * Math.sin(x * 0.005 + sp * t * 0.05 + y * 2));
        g.closePath(); g.fill();
      }
      if (kd > 0) {
        g.globalCompositeOperation = 'lighter';
        g.save(); g.translate(SUN.x, 455); g.scale(1, 0.32);
        const gr = g.createRadialGradient(0, 0, 10, 0, 0, 520);
        gr.addColorStop(0, `rgba(233,185,138,${0.45 * Math.min(1, kd)})`); gr.addColorStop(1, 'rgba(233,185,138,0)');
        g.fillStyle = gr; g.fillRect(-520, -520, 1040, 1040);
        g.restore();
        // 晨光漫进山涧：水面映出转亮的东天，一大片暖色柔光由日下向左、向近处铺开（x≈380 以左已为零，歌词区不变）
        const RW = 760;
        g.save(); g.translate(SUN.x - 20, 488); g.scale(1, 0.46);
        const gm = g.createRadialGradient(0, 0, 0, 0, 0, RW), cW = mixc([214, 208, 192], [238, 196, 146], gold);
        for (let k = 0; k <= 16; k++) { const u = k / 16, f = Math.exp(-2 * u * u) * (1 - u); gm.addColorStop(u, cs(cW, WSH * kc * (0.75 + 0.25 * gold) * f)); }
        g.fillStyle = gm; g.fillRect(-RW, 0, Math.min(2 * RW, W - SUN.x + 20 + RW), RW);
        g.restore();
        // 日光倒影是一道竖向柔光，再加碎金
        g.save(); g.translate(SUN.x, 476); g.scale(1, 3.2);
        const gw = g.createRadialGradient(0, 0, 2, 0, 0, 90 + 70 * kd);
        gw.addColorStop(0, `rgba(250,236,200,${0.5 * kd})`); gw.addColorStop(0.4, `rgba(240,214,170,${0.22 * kd})`); gw.addColorStop(1, 'rgba(233,185,138,0)');
        g.fillStyle = gw; g.fillRect(-180, 0, 360, 80);
        g.restore();
        const spread = (0.5 + 0.5 * k1) * (1 + 0.5 * late);
        for (let i = 0; i < 110; i++) {
          const y = 478 + Math.pow(h2(i, 61), 1.4) * 240, d = (y - 476) / 244;
          const x = SUN.x + (h2(i, 62) - 0.55) * (16 + 200 * d) * spread + 5 * Math.sin(t * 0.7 + i);
          const tw = 0.5 + 0.5 * Math.sin(t * (2 + 2 * h2(i, 63)) + i * 1.7);
          const edge = clamp(Math.abs(x - SUN.x) / ((16 + 200 * d) * spread * 0.62), 0, 1);
          const a = kd * tw * (1 - d * 0.6) * 0.5 * (1 - edge * edge) * (i < 90 ? 1 : late);
          if (a < 0.02) continue;
          g.fillStyle = `rgba(255,236,196,${a})`;
          g.fillRect(x, y, 4 + 18 * d * h2(i, 64), 0.8 + d);
        }
        g.globalCompositeOperation = 'source-over';
      }
      // 萤火与倒影
      const F = flies();
      const downFlare = t > tYu ? c.de(0.55) * smooth((t - tYu) / 0.6) : 0;
      g.globalCompositeOperation = 'lighter';
      for (const f of F) {
        const tf = tTu + f.order * 2.1, fade = 1 - smooth((t - tf) / (0.6 + 0.3 * h2(f.x0 | 0, 3)));
        if (fade <= 0) continue;
        const p = 0.5 + 0.5 * Math.sin((TAU * t) / f.T + f.ph);
        let b = (0.22 + 0.78 * p * p * p) * (1 + 0.45 * downFlare);
        b *= fade * (1 - 0.25 * kd);
        const [x, y] = flyPos(f, t);
        const s = f.s;
        A.glow(g, x, y, 24 * s, '#c8e86a', 0.34 * b);
        A.glow(g, x, y, 9 * s, '#d9f27a', 0.5 * b);
        A.glow(g, x, y, 4 * s, '#f4ffd0', 0.95 * b);
        if (f.yg > bankY(x) + 3) {
          const yr = 2 * f.yg - y, jx = 1.6 * Math.sin(t * 2.6 + yr * 0.08);
          if (yr < H + 20) {
            g.save(); g.translate(x + jx, yr); g.scale(1, 1.4);
            A.glow(g, 0, 0, 13 * s, '#b8d860', 0.2 * b);
            A.glow(g, 0, 0, 3.6 * s, '#dff59a', 0.55 * b);
            g.restore();
          }
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.drawImage(nearLayer(), 0, 0, W, H);
      // 近竹逆光的一线暖边（靠近太阳的那几竿）
      if (kd > 0) {
        const B = bamboo();
        for (const s of B.far.concat(B.near)) {
          const d = Math.abs(stalkX(s, SUN.y) - SUN.x);
          if (d > 260) continue;
          const a = kd * (1 - d / 260) * (s.base > 700 ? 0.55 : 0.35);
          const top = s.base > 700 ? -30 : -20;
          for (const sd of [-1, 1]) {
            const gr = g.createLinearGradient(0, top, 0, s.base);
            gr.addColorStop(0, 'rgba(246,220,170,0)'); gr.addColorStop(0.55, `rgba(246,220,170,${a})`); gr.addColorStop(1, 'rgba(246,220,170,0)');
            g.strokeStyle = gr; g.lineWidth = 1;
            g.beginPath(); g.moveTo(stalkX(s, s.base) + sd * (s.w / 2 - 0.5), s.base); g.lineTo(stalkX(s, top) + sd * (s.w / 2 * 0.85 - 0.5), top); g.stroke();
          }
        }
      }
    }
    return { draw, warm: [skyLayer, landLayer, nearLayer] };
  })();

  XYT.registerShot('e7_fireflies', {
    name: '萤火消晨', zone: 'left', night: true,
    text: '#eef0e2', shadow: 'rgba(6,10,18,0.9)', accent: '#d9f27a', bloom: 0.45,
    draw: E7.draw,
  });

  // 页面空闲时预建静态贴图（结果与第一帧现建完全相同）
  try {
    const jobs = [...E5.warm, ...E6.warm, ...E7.warm];
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 200);
    let tries = 0;
    const start = () => {
      if (!(XYT.sprites && XYT.sprites.S)) { if (++tries < 120) setTimeout(start, 500); return; }
      const step = () => { if (!jobs.length) return; try { jobs.shift()(); } catch (e) { /* 忽略 */ } idle(step); };
      idle(step);
    };
    setTimeout(start, 1500);
  } catch (e) { /* 无定时器环境 */ }
})();
