/* 逍遥叹 · 音乐动画 —— 绘画工具：数学、程序化贴图、人物与器物 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const W = 1280, H = 720, TAU = Math.PI * 2;

  // ---------- 数学 ----------
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = (t) => Math.pow(clamp(t), 3);
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  function hash(n) {
    n = (n | 0) ^ 0x9e3779b9;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul((b | 0) + 7, 19349663));
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise1(x, seed = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(h2(i, seed), h2(i + 1, seed), u);
  }
  function noise2(x, y, seed = 0) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const s = seed * 977;
    const a = h2(i + s, j), b = h2(i + 1 + s, j), c = h2(i + s, j + 1), d = h2(i + 1 + s, j + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }
  function hex2rgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  function rgba(hex, a) { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2c, t) {
    const a = hex2rgb(h1), b = hex2rgb(h2c);
    const c = a.map((v, k) => Math.round(lerp(v, b[k], clamp(t))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function vgrad(g, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  function fillV(g, y0, y1, stops, x0 = -40, x1 = W + 40) {
    g.fillStyle = vgrad(g, y0, y1, stops);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  // ---------- 贴图 ----------
  function canvas(pw, ph) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(pw));
    c.height = Math.max(1, Math.round(ph));
    return c;
  }

  function makeMountain(sc, seed, o) {
    const L = o.L, Hm = o.Hm;
    const pw = Math.round(L * sc), ph = Math.round(Hm * sc);
    const c = canvas(pw, ph), g = c.getContext('2d');
    const img = g.createImageData(pw, ph), d = img.data;
    const r = rng(seed);
    const peaks = [];
    for (let i = 0; i < o.peaks; i++) peaks.push({ c: r() * L, w: lerp(o.wmin, o.wmax, r()), a: lerp(o.hmin, o.hmax, Math.pow(r(), 0.8)) });
    const harm = [];
    for (let k = 1; k <= 12; k++) harm.push({ k: k * 3, a: (o.rough / Math.pow(k, 1.15)) * (0.5 + r()), p: r() * TAU });
    const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
    for (let px = 0; px < pw; px++) {
      const x = px / sc;
      let h = 0;
      for (const p of peaks) {
        let dx = x - p.c;
        dx -= L * Math.round(dx / L);
        const u = dx / p.w;
        h = smax(h, p.a * Math.exp(-u * u * (1 + 0.6 * Math.abs(u))), 18);
      }
      for (const hm of harm) h += hm.a * Math.sin((TAU * hm.k * x) / L + hm.p);
      const yr = (Hm - Math.max(8, h)) * sc;
      const edge = 0.5 + 0.5 * noise1(x * 0.015, seed);
      const fall = o.fall * sc * (0.75 + 0.5 * noise1(x * 0.01, seed + 3));
      for (let py = Math.max(0, Math.floor(yr)); py < ph; py++) {
        const dd = py - yr;
        let a = Math.exp(-dd / fall) * o.density + Math.exp(-dd / (2.4 * sc)) * 0.5 * edge;
        const y = py / sc;
        a *= 0.66 + 0.34 * noise2(x * 0.07, y * 0.014, seed) * (0.7 + 0.3 * noise2(x * 0.3, y * 0.05, seed + 9));
        a *= clamp((ph - py) / (50 * sc));
        const i = (py * pw + px) * 4;
        d[i] = 18; d[i + 1] = 20; d[i + 2] = 24; d[i + 3] = Math.min(255, a * 255);
      }
    }
    g.putImageData(img, 0, 0);
    c.L = L; c.Hm = Hm;
    return c;
  }

  function softBlob(g, x, y, r, a, col) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.6, rgba(col, a * 0.45));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  class Sprites {
    constructor(S) {
      this.S = S;
      this.tints = new Map();
      const t0 = performance.now();
      this.glow = this.mk(128, 128, 1, (g) => softBlob(g, 64, 64, 64, 1, '#ffffff'));
      this.paper = this.makePaper();
      this.vignette = this.mk(320, 180, 1, (g) => {
        const gr = g.createRadialGradient(160, 90, 40, 160, 90, 190);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.65, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = gr; g.fillRect(0, 0, 320, 180);
      });
      const ms = Math.min(1, S) * 0.5, mn = Math.min(1, S) * 0.75;
      const base = { L: 1800, Hm: 380 };
      this.mtn = {
        far: [makeMountain(ms, 11, { ...base, peaks: 9, wmin: 90, wmax: 220, hmin: 90, hmax: 230, rough: 9, fall: 90, density: 0.55 }),
          makeMountain(ms, 23, { ...base, peaks: 7, wmin: 120, wmax: 260, hmin: 70, hmax: 200, rough: 7, fall: 110, density: 0.5 })],
        mid: [makeMountain(ms, 37, { ...base, peaks: 8, wmin: 70, wmax: 170, hmin: 110, hmax: 290, rough: 12, fall: 70, density: 0.7 }),
          makeMountain(ms, 41, { ...base, peaks: 10, wmin: 60, wmax: 150, hmin: 90, hmax: 250, rough: 12, fall: 60, density: 0.72 })],
        near: [makeMountain(mn, 53, { ...base, peaks: 6, wmin: 60, wmax: 140, hmin: 120, hmax: 330, rough: 16, fall: 50, density: 0.9 }),
          makeMountain(mn, 67, { ...base, peaks: 7, wmin: 50, wmax: 130, hmin: 100, hmax: 300, rough: 18, fall: 45, density: 0.92 })],
      };
      this.fog = this.mk(1200, 220, 0.5, (g) => {
        const r = rng(5);
        for (let i = 0; i < 46; i++) softBlob(g, 60 + r() * 1080, 110 + (r() - 0.5) * 70, 70 + r() * 120, 0.22, '#ffffff');
      });
      this.clouds = [0, 1, 2].map((k) => this.mk(420, 170, 0.6, (g) => {
        const r = rng(100 + k);
        for (let i = 0; i < 22; i++) {
          const x = 60 + r() * 300, y = 70 + (r() - 0.6) * 60, rr = 30 + r() * 55;
          softBlob(g, x, Math.min(y, 120 - rr * 0.3), rr, 0.5, '#ffffff');
        }
      }));
      this.branch = this.makeBranch(7, '#e8a3ad', '#c75c6c', 1);
      this.plum = this.makeBranch(19, '#f4ecec', '#c23a3a', 0.85);
      this.buildMs = performance.now() - t0;
    }
    mk(w, h, sc, fn) {
      const s = this.S * sc;
      const c = canvas(w * s, h * s), g = c.getContext('2d');
      g.scale(s, s);
      fn(g);
      c.lw = w; c.lh = h;
      return c;
    }
    makePaper() {
      const N = 256, c = canvas(N, N), g = c.getContext('2d');
      const img = g.createImageData(N, N), d = img.data;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const n = 0.55 * noise2(x / 6, y / 6, 3) + 0.3 * noise2(x / 2, y / 2, 4) + 0.15 * hash(x * 999 + y);
        const v = 205 + n * 50;
        const i = (y * N + x) * 4;
        d[i] = v; d[i + 1] = v * 0.985; d[i + 2] = v * 0.95; d[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const r = rng(77);
      g.strokeStyle = 'rgba(120,100,70,0.12)';
      g.lineWidth = 0.6;
      for (let i = 0; i < 70; i++) {
        const x = r() * N, y = r() * N, a = r() * TAU, l = 6 + r() * 22;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.4) * l * 0.5, y + Math.sin(a + 0.4) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
      }
      return c;
    }
    makeBranch(seed, petal, heart, scale) {
      const S = this.S;
      return this.mk(700, 460, 1, (g) => {
        const r = rng(seed);
        const blossoms = [];
        const limb = (x, y, a, len, w, depth) => {
          let cx = x, cy = y, ang = a;
          const steps = Math.max(3, Math.round(len / 14));
          g.strokeStyle = '#211a17';
          g.lineCap = 'round';
          for (let i = 0; i < steps; i++) {
            const nx = cx + Math.cos(ang) * (len / steps), ny = cy + Math.sin(ang) * (len / steps);
            g.lineWidth = Math.max(0.8, w * (1 - (i / steps) * 0.6));
            g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
            if (w > 3 && r() < 0.35) { g.fillStyle = 'rgba(33,26,23,0.6)'; g.beginPath(); g.ellipse(nx, ny, w * 0.6, w * 0.35, ang, 0, TAU); g.fill(); }
            cx = nx; cy = ny; ang += (r() - 0.5) * 0.5;
            if (depth > 0 && r() < 0.28) limb(cx, cy, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * (0.35 + r() * 0.3), w * 0.55, depth - 1);
            if (w < 6 && r() < 0.55) blossoms.push([cx + (r() - 0.5) * 14, cy + (r() - 0.5) * 14, 5 + r() * 6]);
          }
          blossoms.push([cx, cy, 6 + r() * 5]);
        };
        limb(-20, 30, 0.35, 520 * scale, 15, 3);
        limb(-10, 140, 0.15, 300 * scale, 8, 2);
        for (const [x, y, s] of blossoms) {
          const rot = r() * TAU;
          g.fillStyle = petal;
          for (let k = 0; k < 5; k++) {
            const a = rot + (k * TAU) / 5;
            g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.55, s * 0.4, a, 0, TAU); g.fill();
          }
          g.fillStyle = heart;
          g.beginPath(); g.arc(x, y, s * 0.28, 0, TAU); g.fill();
        }
      });
    }
    tint(src, color) {
      const key = src;
      let m = this.tints.get(key);
      if (!m) { m = new Map(); this.tints.set(key, m); }
      let c = m.get(color);
      if (!c) {
        c = canvas(src.width, src.height);
        const g = c.getContext('2d');
        g.drawImage(src, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        c.L = src.L; c.Hm = src.Hm; c.lw = src.lw; c.lh = src.lh;
        m.set(color, c);
      }
      return c;
    }
  }
  XYT.Sprites = Sprites;

  // 平铺绘制山层：x 偏移会自动循环
  function drawMountain(g, spr, color, alpha, offX, baseY, scaleY = 1) {
    const c = color ? XYT.sprites.tint(spr, color) : spr;
    const L = spr.L, Hm = spr.Hm * scaleY;
    let x = -(((offX % L) + L) % L);
    g.globalAlpha = alpha;
    while (x < W) { g.drawImage(c, x, baseY - Hm, L, Hm); x += L; }
    g.globalAlpha = 1;
  }
  function drawFog(g, color, alpha, offX, y, h = 220, w = 1200) {
    const c = XYT.sprites.tint(XYT.sprites.fog, color);
    let x = -(((offX % w) + w) % w);
    g.globalAlpha = alpha;
    while (x < W) { g.drawImage(c, x, y - h / 2, w, h); x += w; }
    g.globalAlpha = 1;
  }
  function glow(g, x, y, r, color, a) {
    const c = color ? XYT.sprites.tint(XYT.sprites.glow, color) : XYT.sprites.glow;
    g.globalAlpha = a;
    g.drawImage(c, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }

  // ---------- 人物与器物 ----------
  function ribbon(g, x0, y0, dir, wind, t, len, w0, phase) {
    const seg = 9, pts = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      pts.push([
        x0 + dir * u * len * (0.45 + 0.55 * wind),
        y0 + u * u * len * 0.55 * (1 - wind * 0.85) + Math.sin(t * 4.2 + phase - u * 4.5) * (1.5 + 7 * u) * (0.35 + wind),
      ]);
    }
    g.beginPath();
    pts.forEach(([x, y], i) => { const w = w0 * (1 - (i / seg) * 0.8); i ? g.lineTo(x, y - w / 2) : g.moveTo(x, y - w / 2); });
    for (let i = seg; i >= 0; i--) { const [x, y] = pts[i]; g.lineTo(x, y + (w0 * (1 - (i / seg) * 0.8)) / 2); }
    g.closePath();
    g.fill();
  }

  // 侠客剪影（原点在脚底，面朝 +x）
  function hero(g, x, y, s, t, o = {}) {
    const f = o.facing || 1, wind = o.wind ?? 0.4, col = o.color || '#14161a';
    const w1 = Math.sin(t * 3.1), w2 = Math.sin(t * 4.3 + 1), w3 = Math.sin(t * 2.3 + 2);
    g.save();
    g.translate(x, y);
    g.scale(s * f, s);
    if (o.lean) g.rotate(o.lean);
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    ribbon(g, -6, -162, -1, wind, t, 44, 3.4, 0);
    ribbon(g, -6, -158, -1, wind, t, 36, 2.6, 1.3);
    if (o.pose !== 'hold' && o.pose !== 'row') {
      g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-26, -152); g.lineTo(16, -90); g.stroke();
      g.lineWidth = 5; g.beginPath(); g.moveTo(-22, -160); g.lineTo(-27, -151); g.stroke();
      g.lineWidth = 2; g.beginPath(); g.moveTo(-31, -148); g.lineTo(-20, -156); g.stroke();
      if (o.tassel !== false) { g.strokeStyle = '#b8352a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-27, -162); g.quadraticCurveTo(-34 - 6 * wind, -156 + w2 * 2, -38 - 9 * wind, -146 + w1 * 2); g.stroke(); g.strokeStyle = col; }
    }
    // 衣袍
    g.beginPath();
    g.moveTo(-8, -140);
    g.quadraticCurveTo(-21, -136, -22, -112);
    g.quadraticCurveTo(-26, -62, -30 - 16 * wind - 5 * w1 * wind, -3 + 2 * w3 * wind);
    g.quadraticCurveTo(-12, 4 + 2 * w2, 4, 0);
    g.quadraticCurveTo(14, 2, 23 + 3 * wind * w3, -1);
    g.quadraticCurveTo(17, -52, 15, -112);
    g.quadraticCurveTo(13, -135, 7, -140);
    g.closePath();
    g.fill();
    // 腰带飘带
    ribbon(g, -16, -92, -1, wind, t + 0.5, 40, 3, 2.1);
    // 袖
    if (o.pose === 'hold') {
      g.lineWidth = 9; g.beginPath(); g.moveTo(8, -128); g.lineTo(30, -144); g.stroke();
      const a = o.swordAngle ?? -1.1;
      g.lineWidth = 2.4; g.beginPath(); g.moveTo(30, -144); g.lineTo(30 + Math.cos(a) * 96, -144 + Math.sin(a) * 96); g.stroke();
      g.lineWidth = 4.5; g.beginPath(); g.moveTo(30 - Math.sin(a) * 7, -144 + Math.cos(a) * 7); g.lineTo(30 + Math.sin(a) * 7, -144 - Math.cos(a) * 7); g.stroke();
      g.beginPath(); g.moveTo(-12, -128); g.quadraticCurveTo(-28 - 8 * wind, -104, -32 - 14 * wind - 4 * w2 * wind, -72 + 3 * w1); g.lineTo(-18 - 5 * wind, -76); g.quadraticCurveTo(-14, -98, -6, -120); g.closePath(); g.fill();
    } else if (o.pose === 'row') {
      const a = o.oar ?? 0.9;
      g.lineWidth = 8; g.beginPath(); g.moveTo(6, -126); g.lineTo(26, -104); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(26 - Math.cos(a) * 40, -104 - Math.sin(a) * 40); g.lineTo(26 + Math.cos(a) * 120, -104 + Math.sin(a) * 120); g.stroke();
      g.beginPath(); g.ellipse(26 + Math.cos(a) * 122, -104 + Math.sin(a) * 122, 9, 3.5, a, 0, TAU); g.fill();
    } else if (o.pose === 'open') {
      g.beginPath(); g.moveTo(-10, -132); g.quadraticCurveTo(-40, -150, -64 - 8 * wind, -146 + 4 * w2); g.lineTo(-58 - 6 * wind, -130 + 3 * w1); g.quadraticCurveTo(-34, -128, -8, -118); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(8, -132); g.quadraticCurveTo(38, -152, 62, -150 + 3 * w3); g.lineTo(58, -134); g.quadraticCurveTo(32, -128, 8, -118); g.closePath(); g.fill();
    } else {
      g.beginPath(); g.moveTo(-12, -128); g.quadraticCurveTo(-30 - 10 * wind, -100, -34 - 16 * wind - 5 * w2 * wind, -64 + 4 * w1); g.lineTo(-18 - 6 * wind, -68); g.quadraticCurveTo(-15, -96, -6, -120); g.closePath(); g.fill();
    }
    // 头
    g.beginPath(); g.ellipse(2, -151, 9.5, 11, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(-3, -164, 5.5, 0, TAU); g.fill();
    g.fillRect(-3, -143, 8, 6);
    g.strokeStyle = o.belt || 'rgba(255,248,235,0.22)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-22, -93); g.lineTo(16, -95); g.stroke();
    g.restore();
  }

  // 少女剪影
  function maiden(g, x, y, s, t, o = {}) {
    const f = o.facing || 1, wind = o.wind ?? 0.4, col = o.color || '#17151b', scarf = o.scarf || 'rgba(190,225,235,0.9)';
    const w1 = Math.sin(t * 2.7), w2 = Math.sin(t * 3.6 + 1.2);
    g.save();
    g.translate(x, y); g.scale(s * f, s);
    g.fillStyle = col; g.lineJoin = 'round'; g.lineCap = 'round';
    // 长发
    g.beginPath();
    g.moveTo(-4, -158);
    g.quadraticCurveTo(-20, -140, -18 - 10 * wind, -110 + 2 * w1);
    g.quadraticCurveTo(-24 - 22 * wind, -84, -28 - 30 * wind + 4 * w2, -70);
    g.quadraticCurveTo(-14 - 8 * wind, -92, -2, -120);
    g.closePath(); g.fill();
    // 裙
    g.beginPath();
    g.moveTo(-7, -136);
    g.quadraticCurveTo(-15, -118, -12, -96);
    g.quadraticCurveTo(-22, -40, -34 - 14 * wind - 4 * w1 * wind, -2);
    g.quadraticCurveTo(-6, 5, 22 + 2 * w2 * wind, 0);
    g.quadraticCurveTo(12, -50, 10, -96);
    g.quadraticCurveTo(12, -122, 6, -136);
    g.closePath(); g.fill();
    // 头、发髻
    g.beginPath(); g.ellipse(1, -148, 8.5, 10, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(-4, -160, 7, 5, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(6, -159, 5, 4, 0.4, 0, TAU); g.fill();
    // 发簪
    g.fillStyle = o.pin || '#d9b25e';
    g.beginPath(); g.arc(-9, -163, 2, 0, TAU); g.fill();
    // 披帛
    g.strokeStyle = scarf; g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-14, -112);
    for (let i = 1; i <= 10; i++) {
      const u = i / 10;
      g.lineTo(-14 - u * (50 + 40 * wind), -112 - Math.sin(u * Math.PI) * 30 + Math.sin(t * 3 - u * 5) * 6 * (0.4 + wind) + u * 40);
    }
    g.stroke();
    g.beginPath();
    g.moveTo(12, -110);
    for (let i = 1; i <= 8; i++) {
      const u = i / 8;
      g.lineTo(12 + u * 30 - u * u * 50 * wind, -110 + u * 70 + Math.sin(t * 3.4 - u * 4) * 5 * (0.4 + wind));
    }
    g.stroke();
    g.restore();
  }

  function crane(g, x, y, s, ph, o = {}) {
    const col = o.color || '#1b1b1f', f = o.facing || 1;
    const flap = Math.sin(ph);
    g.save(); g.translate(x, y); g.scale(s * f, s);
    g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
    g.beginPath(); g.ellipse(0, 0, 26, 8, -0.05, 0, TAU); g.fill();
    g.lineWidth = 3.2; g.beginPath(); g.moveTo(22, -2); g.quadraticCurveTo(36, -8, 50, -6); g.stroke();
    g.beginPath(); g.arc(51, -6, 4, 0, TAU); g.fill();
    g.lineWidth = 1.6; g.beginPath(); g.moveTo(54, -6); g.lineTo(66, -4); g.stroke();
    g.fillStyle = '#c0262d'; g.beginPath(); g.arc(50, -9.5, 2, 0, TAU); g.fill(); g.fillStyle = col;
    g.lineWidth = 1.8; g.beginPath(); g.moveTo(-22, 3); g.lineTo(-58, 7); g.moveTo(-22, 1); g.lineTo(-56, 3); g.stroke();
    for (const side of [1, -1]) {
      const tipY = -flap * 52 * side - 6, mid = -flap * 26 * side;
      g.globalAlpha = side < 0 ? 0.75 : 1;
      g.beginPath();
      g.moveTo(-10, -2);
      g.quadraticCurveTo(-2, mid - 4, 6, tipY);
      g.quadraticCurveTo(-8, mid + 4, -26, tipY * 0.9 + 4);
      g.quadraticCurveTo(-18, mid * 0.4, -14, 2);
      g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  function bird(g, x, y, s, ph, col) {
    const f = Math.sin(ph);
    g.strokeStyle = col; g.lineWidth = 1.6 * s; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - 7 * s, y - f * 4 * s);
    g.quadraticCurveTo(x - 3 * s, y - 2 * s - f * 2 * s, x, y);
    g.quadraticCurveTo(x + 3 * s, y - 2 * s - f * 2 * s, x + 7 * s, y - f * 4 * s);
    g.stroke();
  }

  function butterfly(g, x, y, s, ph, col, rot) {
    const k = 0.2 + 0.8 * Math.abs(Math.cos(ph));
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    g.fillStyle = col;
    for (const side of [-1, 1]) {
      g.save(); g.scale(side * k, 1);
      g.beginPath(); g.ellipse(7, -5, 8, 6, -0.5, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(5, 5, 5, 4, 0.5, 0, TAU); g.fill();
      g.restore();
    }
    g.fillRect(-0.8, -6, 1.6, 12);
    g.restore();
  }

  function lantern(g, x, y, s, flick, a = 1) {
    glow(g, x, y, 46 * s * (0.9 + 0.2 * flick), '#ffb35c', 0.55 * a);
    g.save(); g.translate(x, y); g.scale(s, s);
    const gr = g.createLinearGradient(0, -16, 0, 16);
    gr.addColorStop(0, `rgba(255,214,140,${a})`); gr.addColorStop(1, `rgba(214,92,40,${a})`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(-11, -15); g.quadraticCurveTo(0, -19, 11, -15);
    g.lineTo(8, 14); g.quadraticCurveTo(0, 16, -8, 14);
    g.closePath(); g.fill();
    g.fillStyle = `rgba(255,248,220,${0.7 * a * (0.7 + 0.3 * flick)})`;
    g.beginPath(); g.ellipse(0, 9, 3.5, 2.5, 0, 0, TAU); g.fill();
    g.restore();
  }

  function boat(g, x, y, s, col) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-120, -14); g.quadraticCurveTo(-60, 10, 0, 10); g.quadraticCurveTo(70, 10, 128, -18);
    g.lineTo(118, -8); g.quadraticCurveTo(60, 2, 0, 2); g.quadraticCurveTo(-60, 2, -112, -6);
    g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-112, -8); g.quadraticCurveTo(0, 4, 118, -10); g.lineTo(118, -4); g.quadraticCurveTo(0, 12, -112, -2); g.fill();
    g.beginPath(); g.moveTo(-50, -2); g.quadraticCurveTo(-22, -46, 18, -44); g.quadraticCurveTo(40, -40, 46, -2); g.closePath(); g.fill();
    g.restore();
  }

  function umbrella(g, x, y, s, col, tilt) {
    g.save(); g.translate(x, y); g.rotate(tilt || 0); g.scale(s, s);
    g.strokeStyle = '#2a1b17'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 92); g.stroke();
    const gr = g.createLinearGradient(-70, 0, 70, 0);
    gr.addColorStop(0, col); gr.addColorStop(0.5, mix(col, '#ffffff', 0.18)); gr.addColorStop(1, mix(col, '#000000', 0.25));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-72, 14); g.quadraticCurveTo(-60, -22, 0, -28); g.quadraticCurveTo(60, -22, 72, 14);
    for (let k = 6; k >= -6; k--) g.lineTo(k * 12, 14 + (k % 2 ? 4 : 0));
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,10,10,0.35)'; g.lineWidth = 1;
    for (let k = -5; k <= 5; k++) { g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(k * 8, -14, k * 12, 14); g.stroke(); }
    g.restore();
  }

  function pavilion(g, x, y, s, col, lit) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = col;
    g.fillRect(-70, -8, 140, 8);
    for (const px of [-56, -20, 20, 56]) g.fillRect(px - 3, -96, 6, 90);
    g.beginPath();
    g.moveTo(-96, -96); g.quadraticCurveTo(-60, -102, -40, -128); g.lineTo(0, -168); g.lineTo(40, -128);
    g.quadraticCurveTo(60, -102, 96, -96); g.quadraticCurveTo(102, -104, 106, -112); g.quadraticCurveTo(70, -104, 44, -134);
    g.lineTo(0, -176); g.lineTo(-44, -134); g.quadraticCurveTo(-70, -104, -106, -112); g.quadraticCurveTo(-102, -104, -96, -96);
    g.closePath(); g.fill();
    g.fillRect(-2, -192, 4, 20);
    g.fillRect(-60, -40, 120, 3);
    if (lit) lantern(g, 0, -80, 0.7, lit, 1);
    g.restore();
  }

  function roofs(g, baseY, col, seed, alpha) {
    const r = rng(seed);
    g.fillStyle = col;
    g.globalAlpha = alpha;
    let x = -40;
    while (x < W + 40) {
      const w = 90 + r() * 120, h = 40 + r() * 70, top = baseY - h;
      g.fillRect(x + 10, top, w - 20, h + 200);
      g.beginPath();
      g.moveTo(x - 12, top + 6); g.quadraticCurveTo(x + w * 0.2, top + 2, x + w * 0.3, top - 16);
      g.lineTo(x + w * 0.7, top - 16); g.quadraticCurveTo(x + w * 0.8, top + 2, x + w + 12, top + 6);
      g.lineTo(x + w + 12, top + 10); g.lineTo(x - 12, top + 10); g.closePath(); g.fill();
      x += w * (0.75 + r() * 0.4);
    }
    g.globalAlpha = 1;
  }

  function seal(g, x, y, size, text, a = 1) {
    g.save(); g.translate(x, y);
    g.globalAlpha = a;
    g.fillStyle = '#b3261e';
    const r = rng(9);
    g.beginPath();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const u = i / n, side = Math.min(3, Math.floor(u * 4)), f = u * 4 - side;
      const jit = (r() - 0.5) * size * 0.04;
      const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
      const [ax, ay] = pts[side], [bx, by] = pts[side + 1];
      const px = (ax + (bx - ax) * f) * size / 2 + jit, py = (ay + (by - ay) * f) * size / 2 + jit;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
    g.fillStyle = '#f6eadb';
    const chars = Array.from(text);
    const fs = size * (chars.length > 1 ? 0.42 : 0.7);
    g.font = `${fs}px ${XYT.FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (chars.length === 2) { g.fillText(chars[0], 0, -fs * 0.5); g.fillText(chars[1], 0, fs * 0.52); }
    else if (chars.length === 4) { g.fillText(chars[0], fs * 0.5, -fs * 0.5); g.fillText(chars[1], fs * 0.5, fs * 0.52); g.fillText(chars[2], -fs * 0.5, -fs * 0.5); g.fillText(chars[3], -fs * 0.5, fs * 0.52); }
    else g.fillText(text, 0, 0);
    g.restore();
  }

  function xiangyun(g, x, y, s, col, a, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = 2.2; g.lineCap = 'round';
    const curl = (cx, cy, r, dir) => {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, ang = dir * (u * TAU * 1.25) - Math.PI / 2, rr = r * (1 - u * 0.75);
        const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    };
    curl(0, 0, 16, 1); curl(28, 4, 12, -1); curl(-26, 6, 11, 1);
    g.beginPath(); g.moveTo(-40, 16); g.quadraticCurveTo(0, 26, 46, 14); g.quadraticCurveTo(70, 8, 84, 18); g.stroke();
    g.restore();
  }

  function moonDisc(g, x, y, r, col, a, glowA) {
    glow(g, x, y, r * 3.2, col, glowA);
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    gr.addColorStop(0, rgba('#fffdf3', a)); gr.addColorStop(1, rgba(col, a));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    const rr = rng(4);
    g.fillStyle = `rgba(150,140,110,${0.08 * a})`;
    for (let i = 0; i < 7; i++) { const ang = rr() * TAU, d = rr() * r * 0.7; g.beginPath(); g.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, r * (0.08 + rr() * 0.16), 0, TAU); g.fill(); }
  }

  function inkBlob(g, x, y, R, seed, wob = 0.28) {
    g.beginPath();
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const rr = R * (1 + wob * (noise1(a * 1.6 + seed, seed) - 0.5) * 2 + 0.08 * (noise1(a * 7 + seed, seed + 1) - 0.5));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  }

  XYT.art = {
    W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, hash, h2, rng, noise1, noise2, rgba, mix, vgrad, fillV,
    drawMountain, drawFog, glow, softBlob, hero, maiden, crane, bird, butterfly, lantern, boat, umbrella, pavilion, roofs,
    seal, xiangyun, moonDisc, inkBlob, ribbon,
  };
  XYT.FONT = '"Ma Shan Zheng", "STKaiti", "KaiTi", "Kaiti SC", "Noto Serif SC", serif';
})();
