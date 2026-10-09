/* 逍遥叹 · 音乐动画 —— 工具包·特效（XYT.vfx）：光、花、雪、萤、蝶、鸟、雨、雷、墨、火、丝、剑气与调色
 * 全部无状态：粒子位置都是时间与固定种子的函数；近景粒子大、快、虚（预渲染的柔化贴图），远景小、慢、淡。 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, hash, h2, noise1, noise2 } = A;
  const PI = Math.PI;
  const V = (XYT.vfx = XYT.vfx || {});

  // ---------- 颜色 ----------
  const cmemo = new Map();
  function rgb(c) {
    let v = cmemo.get(c);
    if (v) return v;
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length <= 4) h = h.split('').map((ch) => ch + ch).join('');
      const n = parseInt(h.slice(0, 6), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
    } else {
      const m = c.match(/[\d.]+/g) || [0, 0, 0];
      v = [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]];
    }
    if (cmemo.size > 600) cmemo.clear();
    cmemo.set(c, v);
    return v;
  }
  const ca = (c, a = 1) => { const v = rgb(c); return `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${+clamp(a * v[3]).toFixed(3)})`; };
  const hx = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
  function cmix(c1, c2, t) {
    const p = rgb(c1), q = rgb(c2);
    t = clamp(t);
    return '#' + hx(lerp(p[0], q[0], t)) + hx(lerp(p[1], q[1], t)) + hx(lerp(p[2], q[2], t));
  }

  // ---------- 通用 ----------
  const wrap = (v, a, b) => { const w = b - a; return a + ((((v - a) % w) + w) % w); };
  const BE = (c, d) => (c.be ? c.be(d) : 0);
  const DE = (c, d) => (c.de ? c.de(d) : 0);
  // 无状态的阵风：每拍推进 1，拍头快、拍尾缓。乘上幅度，就是粒子被节拍一阵阵推走的位移
  function surge(c, k = 5) {
    const x = c.b ? c.b.x : c.t * 1.2, i = Math.floor(x), f = x - i;
    return i + (1 - Math.exp(-k * f)) / (1 - Math.exp(-k));
  }
  // 触发时刻：o.t0 给定（数或数组），或 o.on = 'beat' | 'down' 取最近几拍；every 隔几次一发，chance 按种子抽签
  function fires(c, o, life) {
    if (o.t0 != null) return (Array.isArray(o.t0) ? o.t0 : [o.t0]).map((t0, k) => ({ t0, k, str: 1 }));
    if (!o.on || !c.grid || !c.b) return [];
    const ev = Math.max(1, o.every || 1), down = o.on === 'down' || o.on === 'bar', dp = c.grid.dp || 0;
    const out = [];
    let i = c.b.i;
    for (let guard = 0; guard < 96 && out.length < 16; guard++, i--) {
      const t0 = c.grid.time(i);
      if (c.t - t0 > life) break;
      if (down && !c.grid.isDown(i)) continue;
      const idx = down ? Math.round((i - dp) / 4) : i;
      if (((idx % ev) + ev) % ev) continue;
      if (o.chance != null && hash(idx * 7919 + (o.seed || 0) * 31) > o.chance) continue;
      out.push({ t0, k: idx, str: c.grid.strength(i) });
    }
    return out;
  }
  // 粒子表：由种子算出的常量参数，按景深从远到近排好（只是记忆化，不是帧间状态）
  const tabs = new Map();
  function table(key, n, make) {
    const k = key + '#' + n;
    let a = tabs.get(k);
    if (!a) {
      a = [];
      for (let i = 0; i < n; i++) { const q = make(i); q.i = i; a.push(q); }
      a.sort((p, q) => p.z - q.z);
      if (tabs.size > 160) tabs.delete(tabs.keys().next().value);
      tabs.set(k, a);
    }
    return a;
  }
  // 变换：以当前变换为底，直接 setTransform，循环里不用 save/restore
  function Mx(g) { const m = g.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f]; }
  function setL(g, m, x, y, rot, kx = 1, ky = 1) {
    const cs = Math.cos(rot), sn = Math.sin(rot);
    g.setTransform(m[0] * cs * kx + m[2] * sn * kx, m[1] * cs * kx + m[3] * sn * kx, (-m[0] * sn + m[2] * cs) * ky, (-m[1] * sn + m[3] * cs) * ky, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]);
  }
  function putR(g, m, img, x, y, w, h, rot, kx, ax = 0.5, ay = 0.5) {
    setL(g, m, x, y, rot, kx == null ? 1 : kx, 1);
    g.drawImage(img, -w * ax, -h * ay, w, h);
  }
  const reset = (g, m) => g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

  // ---------- 贴图 ----------
  const S = (key, w, h, sc, fn) => K.cache('vfx|' + key, w, h, sc, fn);
  // 像素生成：f(u, v) → 不透明度
  function pix(key, w, h, sc, col, f) {
    return S(key + '|' + col, w, h, sc, (g) => {
      const cv = g.canvas, pw = cv.width, ph = cv.height, img = g.createImageData(pw, ph), d = img.data;
      const [r, gg, b] = rgb(col);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = clamp(f((x + 0.5) / pw, (y + 0.5) / ph)) * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  // 失焦副本：同一形状模糊后的版本，pk 为贴图边长与原图之比（四周留了模糊余量）
  function soft(key, src, px, sc = 0.6) {
    const pad = Math.ceil(px * 2.4);
    const c = S('soft|' + key + '|' + px, src.lw + pad * 2, src.lh + pad * 2, sc, (g) => {
      const k = g.getTransform().a;
      if ('filter' in g) {
        g.filter = `blur(${(px * k).toFixed(2)}px)`;
        g.drawImage(src, pad, pad, src.lw, src.lh);
        g.filter = 'none';
      } else {
        g.globalAlpha = 0.16;
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; g.drawImage(src, pad + Math.cos(a) * px, pad + Math.sin(a) * px, src.lw, src.lh); }
      }
    });
    c.pk = (src.lw + pad * 2) / src.lw;
    return c;
  }
  const glowTex = (col) => XYT.sprites.tint(XYT.sprites.glow, col);
  // 亮点：锐利的核加柔和的晕
  const sparkTex = (col) => pix('spark', 64, 64, 0.5, col, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    return r >= 1 ? 0 : Math.exp(-(r * r) / 0.012) * 0.95 + Math.pow(1 - r, 3) * 0.42;
  });
  // 光斑：平的圆盘，边缘略亮（镜头失焦）
  const bokehTex = (col) => pix('bokeh', 96, 96, 0.5, col, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2.08;
    if (r >= 1) return 0;
    return smooth((1 - r) / 0.09) * (0.46 + 0.12 * (1 - r) + 0.16 * Math.exp(-Math.pow((r - 0.86) / 0.08, 2)));
  });
  // 雪花：实心的柔边小圆
  const flakeTex = (col) => pix('flake', 32, 32, 0.5, col, (u, v) => {
    const r = Math.hypot(u - 0.5, v - 0.5) * 2;
    return r >= 1 ? 0 : 1 - smooth((r - 0.28) / 0.72);
  });
  // 光束：从光源向外展开，带放射状的细纹
  const rayTex = (col) => pix('ray', 512, 96, 0.5, col, (u, v) => {
    const hw = 0.05 + 0.95 * u, q = (v - 0.5) * 2 / hw, d = Math.abs(q);
    if (d >= 1) return 0;
    const across = Math.pow(Math.cos((d * PI) / 2), 1.5) * (0.72 + 0.28 * noise1(q * 5 + 20, 7));
    return across * smooth(u / 0.1) * Math.pow(1 - u, 1.25);
  });

  // 每帧复用的低分辨率缓冲：光束这类柔而大的东西先画到 1/4 分辨率，再一次放大贴回（只省填充，不跨帧保存内容）
  const scr = {};
  function scratch(name, lw, lh, k) {
    const S0 = XYT.sprites.S * k, pw = Math.max(2, Math.ceil(lw * S0)), ph = Math.max(2, Math.ceil(lh * S0));
    let cv = scr[name];
    if (!cv) cv = scr[name] = document.createElement('canvas');
    if (cv.width < pw || cv.height < ph) { cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
    const q = cv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, pw + 2, ph + 2);
    return { cv, q, pw, ph, k: S0 };
  }

  // ---------- 丁达尔光 ----------
  // x, y 光源；angle 光束朝向；spread 张角；len 长度；width 粗细倍数；motes 光中浮尘数量
  V.godRays = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 980, y = o.y ?? -60, ang = o.angle ?? 2.05, spread = o.spread ?? 0.8, n = o.n ?? 9;
    const len = o.len ?? 1250, wd = o.width ?? 1, col = o.color || '#ffe2a8', a = o.alpha ?? 0.32, seed = o.seed ?? 1, beat = o.beat ?? 0.35;
    const tex = rayTex(col);
    const pulse = 1 + beat * (0.45 * BE(c, 0.45) + 0.55 * DE(c, 0.9));
    const beams = [];
    let bx0 = x, by0 = y, bx1 = x, by1 = y;
    for (let i = 0; i < n; i++) {
      const hA = h2(i, seed), hB = h2(i, seed + 1), hC = h2(i, seed + 2);
      const th = ang + (hA - 0.5) * spread + 0.03 * Math.sin(t * (0.08 + 0.06 * hB) + i * 1.7);
      const L = len * lerp(0.72, 1.1, hC), ww = len * 0.19 * wd * lerp(0.3, 1.5, hB * hB);
      const fl = 0.4 + 0.6 * noise1(t * (0.16 + 0.12 * hC) + i * 11.3, seed);
      beams.push([th, L, ww, clamp(a * fl * pulse * lerp(1, 0.55, hB))]);
      const ex = x + Math.cos(th) * L, ey = y + Math.sin(th) * L, nx = -Math.sin(th) * ww * 0.5, ny = Math.cos(th) * ww * 0.5;
      bx0 = Math.min(bx0, ex - Math.abs(nx)); bx1 = Math.max(bx1, ex + Math.abs(nx)); by0 = Math.min(by0, ey - Math.abs(ny)); by1 = Math.max(by1, ey + Math.abs(ny));
    }
    // 只在画面附近的范围里画
    bx0 = Math.max(bx0, -120); by0 = Math.max(by0, -120); bx1 = Math.min(bx1, W + 120); by1 = Math.min(by1, H + 120);
    g.save();
    g.globalCompositeOperation = 'lighter';
    if (bx1 > bx0 && by1 > by0 && n) {
      const bw = bx1 - bx0, bh = by1 - by0, B = scratch('rays', bw, bh, o.res ?? 0.25), q = B.q, m = [B.k, 0, 0, B.k, -bx0 * B.k, -by0 * B.k];
      q.globalCompositeOperation = 'lighter';
      for (const [th, L, ww, al] of beams) {
        q.globalAlpha = al;
        putR(q, m, tex, x + (Math.cos(th) * L) / 2, y + (Math.sin(th) * L) / 2, L, ww, th);
      }
      g.globalAlpha = 1;
      g.drawImage(B.cv, 0, 0, B.pw, B.ph, bx0, by0, B.pw / B.k, B.ph / B.k);
    }
    if (o.source !== false) {
      const R = o.srcR ?? 220;
      g.globalAlpha = clamp(a * 1.3 * pulse);
      g.drawImage(glowTex(col), x - R, y - R, R * 2, R * 2);
    }
    g.restore();
    if (o.motes) V.dust(g, c, { n: o.motes, color: o.moteColor || cmix(col, '#ffffff', 0.5), seed: seed + 7, alpha: o.moteAlpha ?? 0.9, beat, light: { x, y, angle: ang, spread: spread * 0.85, len: len * 0.85 } });
  };

  // ---------- 浮尘 ----------
  // area [x0,y0,x1,y1]；或 light {x,y,angle,spread,len}：浮尘只在光束里，越近光源越亮
  V.dust = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 90, ar = o.area || [0, 0, W, H], col = o.color || '#fff0cf', a = o.alpha ?? 0.8, seed = o.seed ?? 3;
    const sz = o.size || [0.7, 3.2], sp = o.speed ?? 1, beat = o.beat ?? 0.35, L = o.light;
    const tab = table('dust' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.8), x: h2(i, seed + 1), y: h2(i, seed + 2), f: 0.5 + 1.8 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU, h: h2(i, seed + 5) }));
    const dot = sparkTex(col), halo = glowTex(col), aw = ar[2] - ar[0], ah = ar[3] - ar[1];
    const bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.4);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const q of tab) {
      const k = lerp(0.35, 1.4, q.z) * sp;
      const nx = (noise1(t * 0.06 * k + q.p * 3, seed) - 0.5) * 2, ny = (noise1(t * 0.05 * k + q.p * 3 + 40, seed + 1) - 0.5) * 2;
      let x, y, al = a;
      if (L) {
        const d = lerp(0.08, 1, Math.sqrt(q.x)) * (L.len ?? 1000), th = (L.angle ?? 2) + (q.y - 0.5) * (L.spread ?? 0.6);
        x = L.x + Math.cos(th) * d + nx * 50 * k + Math.sin(t * 0.13 * q.f + q.p) * 16;
        y = L.y + Math.sin(th) * d + ny * 40 * k + t * 2 * (q.h - 0.5);
        const edge = 1 - Math.abs(q.y - 0.5) * 2;
        al *= smooth(edge / 0.5) * lerp(1, 0.35, d / (L.len ?? 1000));
      } else {
        x = ar[0] + wrap(q.x * aw + nx * 90 * k + t * 5 * k * (q.h - 0.45), 0, aw);
        y = ar[1] + wrap(q.y * ah + ny * 70 * k - t * 3 * k * (q.h - 0.3), 0, ah);
      }
      // 尘粒翻转时一闪一闪
      al *= (0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * q.f + q.p), 3)) * lerp(0.55, 1, q.z);
      if (hash(q.i * 131 + bi * 977 + seed) < 0.2) al += pulse * 0.8;
      if (al < 0.012) continue;
      const r = lerp(sz[0], sz[1], q.z);
      if (q.z > 0.82) { g.globalAlpha = clamp(al * 0.5); g.drawImage(halo, x - r * 3, y - r * 3, r * 6, r * 6); }
      else { g.globalAlpha = clamp(al); g.drawImage(dot, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
    }
    g.restore();
  };

  // ---------- 光斑 ----------
  V.bokeh = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 22, ar = o.area || [0, 0, W, H], cols = o.colors || ['#ffd9a0', '#ffc2cf', '#fff3da'];
    const a = o.alpha ?? 0.3, sz = o.size || [16, 72], seed = o.seed ?? 5, drift = o.drift ?? 9, rise = o.rise ?? 4, beat = o.beat ?? 0.5;
    const tab = table('bokeh' + seed, n, (i) => ({ z: h2(i, seed), x: h2(i, seed + 1), y: h2(i, seed + 2), ci: Math.floor(h2(i, seed + 3) * 97), f: 0.4 + h2(i, seed + 4), p: h2(i, seed + 5) * TAU }));
    const aw = ar[2] - ar[0], ah = ar[3] - ar[1], bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.5);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const q of tab) {
      const r = lerp(sz[0], sz[1], Math.pow(q.z, 1.4)), k = 0.3 + q.z;
      const x = ar[0] - r + wrap(q.x * (aw + r * 2) + t * drift * k + Math.sin(t * 0.21 * q.f + q.p) * 14, 0, aw + r * 2);
      const y = ar[1] - r + wrap(q.y * (ah + r * 2) - t * rise * k + Math.sin(t * 0.17 * q.f + q.p * 2) * 18, 0, ah + r * 2);
      let al = a * (0.6 + 0.4 * Math.sin(t * 0.6 * q.f + q.p)) * lerp(1, 0.55, q.z);
      if (hash(q.i * 13 + bi * 7 + seed) < 0.4) al *= 1 + pulse * 1.4;
      g.globalAlpha = clamp(al);
      g.drawImage(bokehTex(cols[q.ci % cols.length]), x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  };

  // ---------- 花瓣与落叶 ----------
  const PETALS = {
    peach: { cols: [['#ffe6ec', '#f07c98'], ['#ffd0dc', '#de567e'], ['#fff1f4', '#f39ab0']], size: [8, 34], fall: 36, wind: 26, sway: 26, spin: 1.5, flip: 2.2 },
    plum: { cols: [['#fffaf7', '#efb8be'], ['#ffe2e4', '#d24456'], ['#f8c6cc', '#a8182c']], size: [7, 26], fall: 34, wind: 22, sway: 22, spin: 1.8, flip: 2.6 },
    maple: { cols: [['#f8b040', '#c8321c'], ['#f4c64a', '#da5a1c'], ['#ec5a2a', '#8c1610'], ['#d8302a', '#6a0e12']], size: [12, 46], fall: 46, wind: 30, sway: 40, spin: 1.1, flip: 1.6 },
    lotus: { cols: [['#fff9fb', '#f08cb0'], ['#fff3f6', '#e5739c'], ['#ffffff', '#f6b4ca']], size: [14, 52], fall: 28, wind: 18, sway: 34, spin: 0.7, flip: 1.2 },
  };
  function drawPetal(g, kind, c1, c2, flower) {
    g.translate(32, 32);
    const dk = cmix(c2, '#3a0a14', 0.35);
    if (kind === 'maple') {
      const lobes = [[0, 1], [-0.85, 0.86], [0.85, 0.86], [-1.72, 0.6], [1.72, 0.6], [-2.4, 0.3], [2.4, 0.3]];
      const gr = g.createRadialGradient(0, 4, 1, 0, 4, 30);
      gr.addColorStop(0, c1); gr.addColorStop(0.55, cmix(c1, c2, 0.55)); gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i <= 200; i++) {
        const a = (i / 200) * TAU - PI / 2;
        let r = 0.24;
        for (const [la, ll] of lobes) { let d = a - (la - PI / 2); d -= TAU * Math.round(d / TAU); r = Math.max(r, ll * Math.pow(Math.max(0, Math.cos(d)), 10)); }
        r *= 1 + 0.05 * Math.sin(a * 38) * smooth((r - 0.38) / 0.3);
        const px = Math.cos(a) * r * 28, py = Math.sin(a) * r * 28 + 4;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      g.strokeStyle = ca(dk, 0.45); g.lineWidth = 0.8;
      for (const [la, ll] of lobes) { const a = la - PI / 2; g.beginPath(); g.moveTo(0, 4); g.lineTo(Math.cos(a) * ll * 24, 4 + Math.sin(a) * ll * 24); g.stroke(); }
      g.strokeStyle = dk; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(1, 18, -2, 30); g.stroke();
      return;
    }
    if (kind === 'lotus') {
      const gr = g.createLinearGradient(0, 30, 0, -30);
      gr.addColorStop(0, c1); gr.addColorStop(0.5, cmix(c1, c2, 0.3)); gr.addColorStop(1, c2);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 30); g.bezierCurveTo(-7, 26, -15, 6, -12, -9); g.quadraticCurveTo(-8, -24, 0, -30);
      g.quadraticCurveTo(8, -24, 12, -9); g.bezierCurveTo(15, 6, 7, 26, 0, 30);
      g.closePath(); g.fill();
      g.strokeStyle = ca(c2, 0.32); g.lineWidth = 0.7;
      for (const dx of [-7, -3.5, 0, 3.5, 7]) { g.beginPath(); g.moveTo(dx * 0.3, 28); g.quadraticCurveTo(dx * 1.1, 0, dx * 0.4, -26); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(-1, 28); g.bezierCurveTo(-8, 24, -14, 6, -11, -8); g.stroke();
      return;
    }
    if (kind === 'plum' && flower) {
      for (let k = 0; k < 5; k++) {
        const a = (k * TAU) / 5 - PI / 2;
        const gr = g.createRadialGradient(0, 0, 2, Math.cos(a) * 11, Math.sin(a) * 11, 12);
        gr.addColorStop(0, c2); gr.addColorStop(0.5, cmix(c2, c1, 0.7)); gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(Math.cos(a) * 12, Math.sin(a) * 12, 10.5, 9.5, a, 0, TAU); g.fill();
      }
      g.fillStyle = dk; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(250,220,150,0.85)'; g.lineWidth = 0.6;
      for (let k = 0; k < 12; k++) {
        const a = (k * TAU) / 12, l = 8 + (k % 3) * 2;
        g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
        g.fillStyle = '#ffd86a'; g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, 1, 0, TAU); g.fill();
      }
      return;
    }
    if (kind === 'plum') {
      const gr = g.createRadialGradient(0, 18, 1, 0, 2, 26);
      gr.addColorStop(0, c2); gr.addColorStop(0.45, cmix(c2, c1, 0.7)); gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 21); g.bezierCurveTo(-23, 19, -25, -16, -6, -20); g.lineTo(0, -15); g.lineTo(6, -20); g.bezierCurveTo(25, -16, 23, 19, 0, 21);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-2, 19); g.bezierCurveTo(-20, 16, -22, -12, -7, -18); g.stroke();
      return;
    }
    // 桃花瓣：瓣尖有小缺口
    const gr = g.createLinearGradient(0, 28, 0, -26);
    gr.addColorStop(0, c2); gr.addColorStop(0.42, cmix(c2, c1, 0.62)); gr.addColorStop(1, c1);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, 28); g.bezierCurveTo(-16, 18, -25, -4, -17, -18); g.quadraticCurveTo(-10, -27, -3, -22);
    g.lineTo(0, -16); g.lineTo(3, -22); g.quadraticCurveTo(10, -27, 17, -18); g.bezierCurveTo(25, -4, 16, 18, 0, 28);
    g.closePath(); g.fill();
    g.strokeStyle = ca(c2, 0.3); g.lineWidth = 0.7;
    for (const dx of [-9, -4, 0, 4, 9]) { g.beginPath(); g.moveTo(0, 26); g.quadraticCurveTo(dx * 0.5, 6, dx, -14); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-1, 26); g.bezierCurveTo(-15, 16, -22, -3, -16, -16); g.stroke();
  }
  function petalTex(kind, vi, flower) {
    const P = PETALS[kind], [c1, c2] = P.cols[vi % P.cols.length];
    return S('petal|' + kind + vi + (flower ? 'f' : ''), 64, 64, 1, (g) => drawPetal(g, kind, c1, c2, flower));
  }
  // kind：peach 桃 / plum 梅 / maple 枫 / lotus 莲；layer 'back'|'front' 只画远或近的一半，方便人物前后各画一层
  V.petals = function (g, c, o = {}) {
    const kind = PETALS[o.kind] ? o.kind : 'peach', P = PETALS[kind];
    const t = o.time ?? c.t, n = o.n ?? 60, seed = o.seed ?? 11, a = o.alpha ?? 1;
    const sz = o.size || P.size, fall = o.fall ?? P.fall, wind = o.wind ?? P.wind, gust = o.gust ?? 24, sw = o.sway ?? P.sway;
    const ar = o.area || [-40, -60, W + 40, H + 40];
    const zr = o.layer === 'back' ? [0, 0.62] : o.layer === 'front' ? [0.62, 2] : o.z || [0, 2];
    const tab = table('petal' + kind + seed, n, (i) => ({
      z: Math.pow(h2(i, seed), 1.35), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU,
      ci: Math.floor(h2(i, seed + 5) * 60), sp: (h2(i, seed + 6) - 0.5) * 2, fl: 0.6 + h2(i, seed + 7), fw: h2(i, seed + 8) < 0.3,
    }));
    const sur = surge(c, 6) * gust, m = Mx(g);
    g.save();
    for (const q of tab) {
      if (q.z < zr[0] || q.z >= zr[1]) continue;
      const k = lerp(0.35, 1.45, q.z);
      const s = lerp(sz[0], sz[1], q.z) * (0.78 + 0.44 * q.v);
      const spanY = ar[3] - ar[1] + s * 2, spanX = ar[2] - ar[0] + s * 2;
      const y = ar[1] - s + wrap(q.y * spanY + t * fall * k * (0.75 + 0.5 * q.v), 0, spanY);
      const sway = Math.sin(t * (0.5 + 0.7 * q.fl) + q.p) * sw * k;
      const x = ar[0] - s + wrap(q.x * spanX + t * wind * k + sway + sur * k, 0, spanX);
      const rot = q.p + t * P.spin * q.sp + 0.5 * Math.sin(t * 0.9 * q.fl + q.p);
      let fx = Math.cos(t * P.flip * q.fl + q.p * 2);
      fx = (fx < 0 ? -1 : 1) * Math.max(0.14, Math.abs(fx));
      const flower = kind === 'plum' && q.fw && !o.single;
      const tex = petalTex(kind, q.ci, flower);
      const blur = q.z > 0.8 && o.blur !== false;
      const img = blur ? soft('petal|' + kind + (q.ci % P.cols.length) + (flower ? 'f' : ''), tex, 2.6) : tex;
      const w = s * (64 / 52) * (blur ? img.pk : 1);
      g.globalAlpha = clamp(a * lerp(0.5, 1, Math.min(1, q.z * 1.6)) * (blur ? 0.85 : 1));
      putR(g, m, img, x, y, w, w, rot, fx);
    }
    reset(g, m);
    g.restore();
  };

  // ---------- 雪（可渐渐变红） ----------
  // red 0..1：越靠下的雪先红，像落进血里；redKind 'petal' 时红雪化作红色花瓣
  V.snow = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 200, seed = o.seed ?? 21, red = clamp(o.red ?? 0), a = o.alpha ?? 0.95;
    const col = o.color || '#ffffff', rc = o.redColor || '#d8202e', fall = o.fall ?? 50, wind = o.wind ?? 16, gust = o.gust ?? 16;
    const sz = o.size || [1.6, 12], ar = o.area || [-20, -20, W + 20, H + 20], beat = o.beat ?? 0.5;
    const zr = o.layer === 'back' ? [0, 0.7] : o.layer === 'front' ? [0.7, 2] : [0, 2];
    const tab = table('snow' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.25), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU, f: 0.5 + h2(i, seed + 5), h: h2(i, seed + 6) }));
    const fw = flakeTex(col), fr = flakeTex(rc), bw = bokehTex(col), br = bokehTex(rc), spk = sparkTex(cmix(col, '#fff8e8', 0.5)), halo = glowTex(rc);
    const sur = surge(c, 5) * gust, bi = c.b ? c.b.i : 0, glint = beat * BE(c, 0.3), m = Mx(g);
    g.save();
    for (const q of tab) {
      if (q.z < zr[0] || q.z >= zr[1]) continue;
      const k = lerp(0.3, 1.5, q.z), r = lerp(sz[0], sz[1], Math.pow(q.z, 1.45)) * (0.8 + 0.4 * q.v);
      const spanY = ar[3] - ar[1] + r * 4, spanX = ar[2] - ar[0] + r * 4;
      const y = ar[1] - r * 2 + wrap(q.y * spanY + t * fall * k * (0.8 + 0.4 * q.v), 0, spanY);
      const x = ar[0] - r * 2 + wrap(q.x * spanX + t * wind * k + Math.sin(t * (0.6 + 0.8 * q.f) + q.p) * (5 + 22 * q.z) + sur * k, 0, spanX);
      const key = 0.55 * q.h + 0.45 * (1 - clamp(y / H));
      const rr = red <= 0 ? 0 : smooth((red * 1.3 - key) / 0.25);
      const near = q.z > 0.84, al = a * lerp(0.45, 1, Math.min(1, q.z * 1.5));
      const wImg = near ? bw : fw, rImg = near ? br : fr, d = near ? r * 2.4 : r * 2;
      if (rr < 0.995) { g.globalAlpha = clamp(al * (1 - rr) * (near ? 0.6 : 1)); g.drawImage(wImg, x - d / 2, y - d / 2, d, d); }
      if (rr > 0.005) {
        if (o.redKind === 'petal' && !near) {
          const s = r * 3 + 3, img = petalTex('plum', 2, false);
          g.globalAlpha = clamp(al * rr);
          putR(g, m, img, x, y, s, s, q.p + t * 1.4 * (q.h - 0.5), Math.cos(t * 2 * q.f + q.p));
          reset(g, m);
        } else { g.globalAlpha = clamp(al * rr * (near ? 0.7 : 1)); g.drawImage(rImg, x - d / 2, y - d / 2, d, d); }
        if (q.z > 0.5) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(al * rr * 0.18); g.drawImage(halo, x - r * 4, y - r * 4, r * 8, r * 8);
          g.globalCompositeOperation = 'source-over';
        }
      }
      // 拍点：一部分雪花闪光
      if (glint > 0.02 && q.z > 0.35 && !near && hash(q.i * 7 + bi * 131 + seed) < 0.14) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(glint * (1 - rr * 0.5)); g.drawImage(spk, x - r * 3, y - r * 3, r * 6, r * 6);
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.restore();
  };

  // ---------- 萤火 ----------
  V.fireflies = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 36, ar = o.area || [0, 260, W, H], col = o.color || '#d4f08a', core = o.core || '#fbffe2';
    const a = o.alpha ?? 1, seed = o.seed ?? 31, s = o.size ?? 1, beat = o.beat ?? 0.7, trail = o.trail ?? 4, sp = o.speed ?? 1;
    const tab = table('ffly' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.5), a: h2(i, seed + 1) * 100, b: h2(i, seed + 2) * 100, f: 0.6 + 1.2 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU }));
    const halo = glowTex(col), dot = sparkTex(core), aw = ar[2] - ar[0], ah = ar[3] - ar[1], bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.4);
    const pos = (q, tt, k) => [
      ar[0] + (noise1(tt * 0.07 * k * sp + q.a, seed) * 1.5 - 0.25) * aw + Math.sin(tt * 0.8 * q.f + q.p) * 26 * k,
      ar[1] + (noise1(tt * 0.06 * k * sp + q.b, seed + 1) * 1.5 - 0.25) * ah + Math.sin(tt * 1.1 * q.f + q.p * 1.3) * 18 * k,
    ];
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const q of tab) {
      const k = lerp(0.5, 1.5, q.z), r = lerp(2.2, 8, q.z) * s;
      let lv = 0.1 + 0.9 * Math.pow(0.5 + 0.5 * Math.sin(t * q.f * 1.3 + q.p), 2.5);
      if (hash(q.i * 17 + bi * 131 + seed) < 0.3) lv = Math.max(lv, pulse * 1.2);
      lv *= a * lerp(0.55, 1, q.z);
      if (lv < 0.02) continue;
      for (let j = trail; j >= 1; j--) {
        const [px, py] = pos(q, t - j * 0.08, k);
        g.globalAlpha = clamp(lv * 0.3 * (1 - j / (trail + 1)));
        g.drawImage(dot, px - r, py - r, r * 2, r * 2);
      }
      const [x, y] = pos(q, t, k);
      g.globalAlpha = clamp(lv * 0.6); g.drawImage(halo, x - r * 4, y - r * 4, r * 8, r * 8);
      g.globalAlpha = clamp(lv * (q.z > 0.8 ? 0.45 : 1)); g.drawImage(dot, x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    }
    g.restore();
  };

  // ---------- 蝴蝶 ----------
  const BFLY = [['#ffe6a0', '#e8862e'], ['#c2e8ff', '#3a6ed8'], ['#ffc8e2', '#c84a8c'], ['#d4f6c0', '#3a9468'], ['#e8d6ff', '#7448d4'], ['#fff2da', '#d49a40']];
  function wingTex(c1, c2) {
    return S('wing|' + c1 + c2, 64, 64, 1, (g) => {
      const dk = cmix(c2, '#160c1c', 0.55);
      let gr = g.createRadialGradient(4, 36, 2, 4, 36, 42);
      gr.addColorStop(0, dk); gr.addColorStop(0.32, c2); gr.addColorStop(0.78, c1); gr.addColorStop(1, cmix(c1, c2, 0.5));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(4, 33); g.bezierCurveTo(24, 30, 46, 38, 41, 50); g.bezierCurveTo(37, 60, 22, 63, 14, 58); g.quadraticCurveTo(6, 52, 4, 40); g.closePath(); g.fill();
      gr = g.createLinearGradient(4, 33, 58, 4);
      gr.addColorStop(0, dk); gr.addColorStop(0.28, c2); gr.addColorStop(0.72, c1); gr.addColorStop(1, cmix(c1, '#ffffff', 0.35));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(4, 32); g.bezierCurveTo(13, 18, 33, 4, 56, 3); g.quadraticCurveTo(63, 10, 57, 20); g.bezierCurveTo(49, 30, 30, 36, 4, 35); g.closePath(); g.fill();
      g.strokeStyle = ca(dk, 0.8); g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(10, 24); g.bezierCurveTo(20, 13, 35, 5, 56, 3); g.quadraticCurveTo(63, 10, 57, 20); g.stroke();
      g.lineWidth = 1.6; g.beginPath(); g.moveTo(41, 50); g.bezierCurveTo(37, 60, 22, 63, 14, 58); g.stroke();
      g.strokeStyle = ca(dk, 0.3); g.lineWidth = 0.7;
      for (const [x1, y1] of [[50, 9], [46, 20], [32, 30], [36, 46], [22, 54]]) { g.beginPath(); g.moveTo(5, 34); g.lineTo(x1, y1); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [x1, y1, r] of [[49, 9, 2], [54, 13, 1.5], [44, 12, 1.3], [33, 52, 1.6], [27, 57, 1.1]]) { g.beginPath(); g.arc(x1, y1, r, 0, TAU); g.fill(); }
    });
  }
  // from {x,y,t0,dur}：从一点化出（彩依化蝶）；glow 灵蝶光晕；trail 金粉拖尾；ink 墨色剪影
  V.butterflies = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 8, ar = o.area || [60, 60, W - 60, H - 140], sz = o.size || [14, 34], seed = o.seed ?? 41;
    const a = o.alpha ?? 1, pal = o.colors || BFLY, gl = o.glow ?? 0, trail = o.trail ?? 0, F = o.from, sp = o.speed ?? 1;
    const tab = table('bfly' + seed, n, (i) => ({ z: h2(i, seed), a: h2(i, seed + 1) * 100, b: h2(i, seed + 2) * 100, f: 1.5 + 1.1 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU, ci: Math.floor(h2(i, seed + 5) * 60), h: h2(i, seed + 6) }));
    const aw = ar[2] - ar[0], ah = ar[3] - ar[1], m = Mx(g);
    const path = (q, tt, k) => [ar[0] + (noise1(tt * 0.07 * k * sp + q.a, seed) * 1.4 - 0.2) * aw, ar[1] + (noise1(tt * 0.06 * k * sp + q.b, seed + 1) * 1.4 - 0.2) * ah];
    g.save();
    for (const q of tab) {
      const k = lerp(0.6, 1.3, q.z);
      let s = lerp(sz[0], sz[1], q.z), al = a * lerp(0.7, 1, q.z);
      let [x, y] = path(q, t, k), [x0, y0] = path(q, t - 0.12, k);
      if (F) {
        const age = t - ((F.t0 ?? 0) + q.h * (F.stagger ?? 1.4));
        if (age < 0) continue;
        const e = easeOut(clamp(age / (F.dur ?? 3.5))), sx = F.x + (q.a % 1 - 0.5) * (F.w ?? 60), sy = F.y + (q.b % 1 - 0.5) * (F.h ?? 120);
        const e0 = easeOut(clamp((age - 0.12) / (F.dur ?? 3.5)));
        x = lerp(sx, x, e); y = lerp(sy, y, e) - Math.sin(e * PI) * 40; x0 = lerp(sx, x0, e0); y0 = lerp(sy, y0, e0) - Math.sin(e0 * PI) * 40;
        al *= smooth(age / 0.5); s *= lerp(0.35, 1, smooth(age / 0.9));
        if (age < 0.6) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp((1 - age / 0.6) * 0.7 * a); const R = 30; g.drawImage(glowTex(pal[q.ci % pal.length][0]), sx - R, sy - R, R * 2, R * 2); g.globalCompositeOperation = 'source-over'; }
      }
      const ph = o.sync && c.b ? c.b.x * TAU * 2 + q.p : t * q.f * TAU + q.p;
      const open = 0.12 + 0.88 * Math.abs(Math.cos(ph));
      y += Math.cos(ph) * s * 0.12;
      const hd = Math.atan2(y - y0, x - x0 || 1e-3), rot = 0.55 * Math.sin(hd) * Math.sign(Math.cos(hd) || 1) + (Math.cos(hd) >= 0 ? 0.35 : -0.35);
      const [c1, c2] = o.ink ? ['#2a2630', '#141218'] : pal[q.ci % pal.length];
      if (trail > 0) {
        g.globalCompositeOperation = 'lighter';
        const dt = sparkTex(cmix(c1, '#fff6d8', 0.5));
        for (let j = 1; j <= 6; j++) {
          let [px, py] = path(q, t - j * 0.14, k);
          if (F) { const age = t - j * 0.14 - ((F.t0 ?? 0) + q.h * (F.stagger ?? 1.4)); if (age < 0) break; const e = easeOut(clamp(age / (F.dur ?? 3.5))); px = lerp(F.x, px, e); py = lerp(F.y, py, e) - Math.sin(e * PI) * 40; }
          py += j * j * 1.2;
          const r = s * 0.22 * (1 - j / 8);
          g.globalAlpha = clamp(trail * al * 0.5 * (1 - j / 7)); g.drawImage(dt, px - r * 2, py - r * 2, r * 4, r * 4);
        }
        g.globalCompositeOperation = 'source-over';
      }
      if (gl > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(gl * al * 0.32); g.drawImage(glowTex(c1), x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); g.globalCompositeOperation = 'source-over'; }
      const wt = wingTex(c1, c2);
      g.globalAlpha = clamp(al);
      putR(g, m, wt, x, y, s, s, rot, open, 0.06, 0.53);
      putR(g, m, wt, x, y, s, s, rot, -open, 0.06, 0.53);
      setL(g, m, x, y, rot);
      g.fillStyle = o.ink ? '#141218' : cmix(c2, '#1a1018', 0.7);
      g.beginPath(); g.ellipse(0, s * 0.06, s * 0.045, s * 0.3, 0, 0, TAU); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(0.5, s * 0.025);
      g.beginPath(); g.moveTo(0, -s * 0.2); g.quadraticCurveTo(-s * 0.08, -s * 0.42, -s * 0.16, -s * 0.48); g.moveTo(0, -s * 0.2); g.quadraticCurveTo(s * 0.08, -s * 0.42, s * 0.16, -s * 0.48); g.stroke();
      reset(g, m);
    }
    g.restore();
  };

  // ---------- 飞鸟 ----------
  function birdPath(g, x, y, s, ph, dir, glide) {
    const f = Math.sin(ph) * glide, up = -f * 9 * s - 1.5 * s, mid = -f * 3 * s - 1.5 * s;
    g.moveTo(x - 1.6 * s, y);
    g.quadraticCurveTo(x - 6 * s, y + mid - 2 * s, x - 15 * s, y + up);
    g.quadraticCurveTo(x - 7 * s, y + mid + 1.6 * s, x - 1.4 * s, y + 2.4 * s);
    g.lineTo(x + 1.4 * s, y + 2.4 * s);
    g.quadraticCurveTo(x + 7 * s, y + mid + 1.6 * s, x + 15 * s, y + up);
    g.quadraticCurveTo(x + 6 * s, y + mid - 2 * s, x + 1.6 * s, y);
    g.closePath();
    g.moveTo(x + dir * 5 * s, y + 0.9 * s);
    g.ellipse(x + dir * 0.8 * s, y + 1.2 * s, 4.2 * s, 1.5 * s, 0, 0, TAU);
  }
  // kind：'flock' 散群 / 'v' 雁阵 / 'pair' 比翼双飞（带长尾与光）；t0 给定时只飞过一次，否则循环
  V.birds = function (g, c, o = {}) {
    const kind = o.kind || 'flock', t = o.time ?? c.t, seed = o.seed ?? 51, dir = o.dir ?? 1, s0 = o.size ?? 1;
    const n = o.n ?? (kind === 'v' ? 9 : kind === 'pair' ? 2 : 14), sp = o.speed ?? (kind === 'pair' ? 70 : 55);
    const col = o.color || '#1d1f24', fog = o.fog || null, a = o.alpha ?? 0.85, y0 = o.y ?? 200, spread = o.spread ?? 380;
    const cx = o.t0 != null ? (o.x ?? (dir > 0 ? -160 : W + 160)) + dir * sp * (t - o.t0) : (o.x ?? 0) + dir * sp * t;
    const tab = table('bird' + kind + seed, n, (i) => ({ z: kind === 'flock' ? h2(i, seed) : 0.5 + 0.5 * (1 - i / n), x: h2(i, seed + 1), y: h2(i, seed + 2), f: 1.7 + 0.9 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU }));
    const loop = o.t0 == null;
    const buckets = [[], [], []];
    for (const q of tab) {
      let dx, dy, s;
      if (kind === 'v') {
        const rank = Math.ceil(q.i / 2), side = q.i % 2 ? 1 : -1;
        dx = -dir * rank * 30 * s0; dy = side * rank * 13 * s0 + Math.sin(t * 0.8 + q.p) * 3 * s0; s = s0 * (q.i ? 0.9 : 1);
      } else if (kind === 'pair') {
        dx = -dir * q.i * 34 * s0; dy = Math.sin(t * 1.1 + q.i * PI) * 12 * s0; s = s0 * 1.6;
      } else {
        dx = (q.x - 0.5) * spread; dy = (q.y - 0.5) * 110 + (noise1(t * 0.3 + q.p, seed) - 0.5) * 30; s = s0 * lerp(0.45, 1.25, q.z);
      }
      let x = cx + dx;
      if (loop) x = wrap(x, -80, W + 80);
      const y = y0 + dy;
      const glide = 0.3 + 0.7 * smooth(noise1(t * 0.5 + q.p, seed + 2) * 1.8 - 0.3);
      const ph = o.sync && c.b ? c.b.x * PI + q.p * 0.4 : t * q.f * TAU + q.p;
      buckets[kind === 'flock' ? Math.min(2, Math.floor(q.z * 3)) : 2].push([x, y, s, ph, glide, q]);
    }
    g.save();
    if (kind === 'pair' || o.glow) {
      const gc = o.glow || '#fff2d0', gt = glowTex(gc), dot = sparkTex(gc);
      g.globalCompositeOperation = 'lighter';
      for (const b of buckets[2].concat(buckets[1], buckets[0])) {
        const [x, y, s, , , q] = b;
        g.globalAlpha = 0.35 * a; g.drawImage(gt, x - 40 * s, y - 40 * s, 80 * s, 80 * s);
        for (let j = 1; j <= 10; j++) {
          const tx = x - dir * j * 9 * s, ty = y + Math.sin(t * 1.1 + q.i * PI - j * 0.35) * 5 * s * (kind === 'pair' ? 1 : 0.3);
          g.globalAlpha = clamp(0.5 * a * (1 - j / 11)); const r = 3 * s * (1 - j / 13); g.drawImage(dot, tx - r, ty - r, r * 2, r * 2);
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    for (let L = 0; L < 3; L++) {
      const bk = buckets[L];
      if (!bk.length) continue;
      g.fillStyle = fog ? cmix(col, fog, (2 - L) * 0.28) : col;
      g.globalAlpha = a * (kind === 'flock' ? 0.55 + 0.22 * L : 1);
      g.beginPath();
      for (const [x, y, s, ph, glide] of bk) birdPath(g, x, y, s, ph, dir, glide);
      g.fill();
      if (kind === 'pair') {
        g.strokeStyle = g.fillStyle; g.lineCap = 'round';
        for (const [x, y, s, , , q] of bk) {
          for (const off of [-1, 1]) {
            g.lineWidth = 1.4 * s; g.beginPath(); g.moveTo(x - dir * 4 * s, y + 1.5 * s);
            for (let j = 1; j <= 8; j++) g.lineTo(x - dir * (4 + j * 4.2) * s, y + 1.5 * s + off * j * 0.7 * s + Math.sin(t * 3 + q.p - j * 0.6) * j * 0.5 * s);
            g.stroke();
          }
        }
      }
    }
    g.restore();
  };

  // ---------- 飘带 ----------
  // 横贯画面的绸带；anchor [x,y] + angle + len 时从一点飘出。正反面明暗不同，拍点时一道光沿带流过
  V.ribbons = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 3, cols = o.colors || ['#f7c4d2', '#cfe2f6', '#f6e0b0'], seed = o.seed ?? 61;
    const amp = o.amp ?? 80, wd = o.width ?? 24, a = o.alpha ?? 0.82, speed = o.speed ?? 1, tw = o.twist ?? 2.2, beat = o.beat ?? 0.5;
    const segs = o.segs ?? 56, gl = o.glow ?? 0.35, yc = o.y ?? 380, gap = o.spacing ?? 70, x0 = o.x0 ?? -120, x1 = o.x1 ?? W + 120;
    const ampK = 1 + beat * 0.3 * BE(c, 0.5);
    const lastBeat = c.grid && c.b ? c.grid.time(c.b.i) : -99, hl = (t - lastBeat) / 1.1;
    g.save();
    for (let k = 0; k < n; k++) {
      const hA = h2(k, seed), hB = h2(k, seed + 1), hC = h2(k, seed + 2), col = cols[k % cols.length];
      const f1 = 0.7 + hA * 0.6, f2 = 1.6 + hB, s1 = (1.1 + hC * 0.5) * speed, s2 = (0.7 + hA * 0.4) * speed;
      let bx0, by0, ux, uy, L;
      if (o.anchor) { const an = (o.angle ?? PI) + (k - (n - 1) / 2) * (o.fan ?? 0.18); bx0 = o.anchor[0]; by0 = o.anchor[1]; L = (o.len ?? 600) * (0.8 + 0.3 * hB); ux = Math.cos(an); uy = Math.sin(an); }
      else { bx0 = x0; by0 = yc + (k - (n - 1) / 2) * gap; L = x1 - x0; ux = 1; uy = 0; }
      const nx = -uy, ny = ux;
      const P = [];
      for (let j = 0; j <= segs; j++) {
        const u = j / segs, env = o.anchor ? Math.pow(u, 0.85) : 1;
        const wv = amp * env * ampK * (0.62 * Math.sin(u * TAU * f1 - t * s1 + hA * TAU) + 0.38 * Math.sin(u * TAU * f2 + t * s2 + hB * TAU));
        const sag = o.anchor ? (o.droop ?? 0.25) * L * u * u : 0;
        const tw0 = u * PI * tw + t * 0.8 * speed + hC * TAU, face = Math.cos(tw0);
        const taper = o.anchor ? (0.3 + 0.7 * u) * (1 - Math.pow(u, 8)) : Math.pow(Math.sin(PI * u), 0.3);
        P.push([bx0 + ux * u * L + nx * wv, by0 + uy * u * L + ny * wv + sag, wd * 0.5 * taper * (0.12 + 0.88 * Math.abs(face)), face, u]);
      }
      const E1 = [], E2 = [];
      for (let j = 0; j <= segs; j++) {
        const p = P[j], q0 = P[Math.max(0, j - 1)], q1 = P[Math.min(segs, j + 1)];
        let tx = q1[0] - q0[0], ty = q1[1] - q0[1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        E1.push([p[0] - ty * p[2], p[1] + tx * p[2]]); E2.push([p[0] + ty * p[2], p[1] - tx * p[2]]);
      }
      if (gl > 0) {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = ca(col, gl * 0.16 * a); g.lineWidth = wd * 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); P.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        g.globalCompositeOperation = 'source-over';
      }
      // 按明暗分段合并成多边形
      const lv = (j) => {
        const f = (P[j][3] + P[j + 1][3]) / 2, u = P[j][4];
        let s = f >= 0 ? 4 + Math.round(Math.pow(f, 6) * 3) : 3 - Math.round(-f * 3);
        if (hl < 1 && Math.abs(u - hl) < 0.07) s = 8;
        return s;
      };
      const shade = (s) => (s === 8 ? cmix(col, '#ffffff', 0.7) : s >= 4 ? cmix(col, '#ffffff', (s - 4) * 0.16) : cmix(col, '#2a2030', 0.12 + (3 - s) * 0.07));
      let j0 = 0;
      g.globalAlpha = a;
      while (j0 < segs) {
        const s = lv(j0);
        let j1 = j0 + 1;
        while (j1 < segs && lv(j1) === s) j1++;
        g.fillStyle = shade(s);
        g.beginPath();
        for (let j = j0; j <= j1; j++) (j === j0 ? g.moveTo(E1[j][0], E1[j][1]) : g.lineTo(E1[j][0], E1[j][1]));
        for (let j = j1; j >= j0; j--) g.lineTo(E2[j][0], E2[j][1]);
        g.closePath(); g.fill();
        j0 = j1;
      }
      g.strokeStyle = ca(cmix(col, '#3a2a30', 0.45), 0.35); g.lineWidth = 0.8;
      g.beginPath(); E1.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.globalAlpha = 1;
    }
    g.restore();
  };

  // ---------- 墨晕 ----------
  // 宣纸墨晕贴图（逐像素算一次）：中心浓、向外渐淡，边缘一圈积墨，外沿一道淡水痕，边上有毛刺，带纸纹
  // part 'full' 整朵；'core' 只有刚落笔时的浓墨芯
  function inkTex(v, col, part) {
    const sd = 700 + v * 13;
    return pix('ink' + v + part, 256, 256, 0.75, col, (u, w) => {
      const dx = (u - 0.5) * 2, dy = (w - 0.5) * 2, r = Math.hypot(dx, dy);
      if (r > 0.999) return 0;
      const cs = r > 1e-4 ? dx / r : 1, sn = r > 1e-4 ? dy / r : 0;
      const n1 = noise2(cs * 1.4 + 5, sn * 1.4 + 5, sd), n2 = noise2(cs * 4 + 9, sn * 4 + 9, sd + 1), n3 = noise2(cs * 13 + 3, sn * 13 + 3, sd + 2);
      const n4 = noise2(cs * 30 + 7, sn * 30 + 7, sd + 3), fray = smooth((n2 - 0.45) / 0.3);
      const E = 0.74 * (1 + 0.2 * (n1 - 0.5) * 2 + 0.08 * (n2 - 0.5) * 2 + 0.03 * (n3 - 0.5) * 2 + 0.05 * (n4 - 0.5) * 2 * fray);
      const d = r / E;
      const fib = (0.8 + 0.2 * noise2(u * 70, w * 70, sd + 4)) * (0.9 + 0.1 * noise2(u * 22, w * 22, sd + 5));
      if (part === 'core') return Math.pow(1 - smooth(d / 0.5), 1.4) * 0.9 * fib;
      const inside = 1 - smooth((d - 0.97) / 0.05);
      const core = 0.62 * Math.pow(1 - smooth(d / 0.6), 1.6), body = 0.3 * (1 - smooth((d - 0.05) / 0.95));
      const ring = 0.3 * Math.exp(-Math.pow((d - 0.955) / 0.035, 2));
      const halo = 0.08 * (1 - smooth((d - 0.95) / 0.22)) * smooth((1 - r) / 0.05);
      return ((core + body + ring) * inside + halo) * fib;
    });
  }
  function bloomPaper(g, x, y, R, age, o, seed, m) {
    const dur = o.dur ?? 2.6, p = easeOut(clamp(age / dur)), col = o.color || '#17130f', a = (o.alpha ?? 0.9) * smooth(age / 0.06);
    const v = ((seed % 3) + 3) % 3, rot = h2(seed, 3) * TAU, sy = 0.86 + 0.24 * h2(seed, 4), r = R * (0.14 + 0.86 * p);
    g.globalAlpha = clamp(a * (1 - 0.25 * smooth((age - dur) / 4)));
    putR(g, m, inkTex(v, col, 'full'), x, y, r * 2.25, r * 2.25 * sy, rot, 1);
    // 刚落下时墨芯浓，随着晕开渐渐化淡
    g.globalAlpha = clamp(a * (1 - p) * 0.9);
    putR(g, m, inkTex(v, col, 'core'), x, y, r * 1.6, r * 1.6 * sy, rot, 1);
    reset(g, m);
    g.globalAlpha = 1;
  }
  const puffTex = (k) => S('puff|' + k, 128, 128, 0.5, (g) => {
    const r = A.rng(300 + k);
    for (let i = 0; i < 26; i++) { const an = r() * TAU, d = Math.pow(r(), 0.7) * 34; A.softBlob(g, 64 + Math.cos(an) * d, 64 + Math.sin(an) * d * 0.8, 14 + r() * 26, 0.28, '#ffffff'); }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 10; i++) A.softBlob(g, 20 + r() * 88, 20 + r() * 88, 6 + r() * 12, 0.5, '#000000');
    g.globalCompositeOperation = 'source-over';
  });
  function bloomWater(g, x, y, R, age, o, seed, m) {
    const dur = o.dur ?? 3.2, p = easeOut(clamp(age / dur)), col = o.color || '#17130f', a = (o.alpha ?? 0.8) * smooth(age / 0.1) * (1 - smooth((age - dur) / (o.fade ?? 3)));
    if (a <= 0.005) return;
    for (let k = 0; k < 10; k++) {
      const an = h2(k, seed) * TAU, cv = (h2(k, seed + 1) - 0.5) * 2.4, d = R * p * (0.3 + 0.7 * h2(k, seed + 2));
      const th = an + cv * p, px = x + Math.cos(th) * d, py = y + Math.sin(th) * d * 0.85 + p * R * 0.12;
      const s = R * (0.25 + 0.55 * p) * (0.6 + 0.6 * h2(k, seed + 3));
      g.globalAlpha = clamp(a * 0.42 * (1 - 0.45 * p));
      putR(g, m, XYT.sprites.tint(puffTex(k % 3), col), px, py, s, s, th + p * cv, 1);
    }
    reset(g, m);
    g.globalAlpha = 1;
    g.strokeStyle = ca(col, 0.35 * a); g.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      const an = h2(k, seed + 9) * TAU, cv = (h2(k, seed + 10) - 0.5) * 3, L = R * p * (0.6 + 0.6 * h2(k, seed + 11));
      g.lineWidth = 0.8 + 2.4 * h2(k, seed + 12) * (1 - p * 0.5);
      g.beginPath(); g.moveTo(x, y);
      for (let j = 1; j <= 12; j++) { const u = j / 12, th = an + cv * u * u; g.lineTo(x + Math.cos(th) * L * u, y + Math.sin(th) * L * u * 0.85); }
      g.stroke();
    }
  }
  // kind 'paper'（宣纸上的墨晕，层层积墨、边缘留水痕）/ 'water'（滴入水中的墨，如烟卷开）
  // 单个：x, y, t0；或 on:'down' 在 area 内每个强拍晕开一朵
  V.inkBloom = function (g, c, o = {}) {
    const t = o.time ?? c.t, R = o.r ?? 220, seed = o.seed ?? 71, water = o.kind === 'water';
    const life = (o.dur ?? 3) + (water ? (o.fade ?? 3) : (o.hold ?? 6));
    const ev = o.t0 == null && !o.on ? [{ t0: 0, k: 0 }] : fires(c, o, life);
    const ar = o.area || [160, 120, W - 160, H - 120], m = Mx(g);
    g.save();
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > life) continue;
      const many = o.x == null || o.on;
      const x = many ? lerp(ar[0], ar[2], hash(e.k * 37 + seed)) : o.x, y = many ? lerp(ar[1], ar[3], hash(e.k * 53 + seed + 1)) : o.y;
      const r = R * (many ? 0.6 + 0.5 * hash(e.k * 71 + seed) : 1), fade = water ? 1 : 1 - smooth((age - life + 1.5) / 1.5);
      g.globalAlpha = fade;
      if (water) bloomWater(g, x, y, r, age, o, seed + e.k * 13, m);
      else bloomPaper(g, x, y, r, age, o, seed + e.k * 13, m);
    }
    g.restore();
  };

  // ---------- 雨 ----------
  // angle 雨丝偏斜（弧度，正值向右）；ground 地面/水面 y，给出时在此溅起水花
  V.rain = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 260, seed = o.seed ?? 81, ang = o.angle ?? 0.16, v0 = o.speed ?? 950, len = o.len ?? 40;
    const col = o.color || '#c6d2e6', a = o.alpha ?? 0.5, beat = o.beat ?? 0.3, gy = o.ground;
    const LY = [[0.42, 0.55, 0.5, 0.6, 0.38], [0.3, 0.75, 0.75, 0.9, 0.5], [0.2, 1, 1, 1.3, 0.6], [0.08, 1.35, 1.7, 2.6, 0.3]];
    const tn = Math.tan(ang), k = 1 + beat * 0.35 * BE(c, 0.3);
    g.save();
    g.lineCap = 'round';
    let base = 0;
    LY.forEach(([frac, vs, ls, lw, al], L) => {
      const m = Math.round(n * frac), v = v0 * vs, l = len * ls, span = H + l + 140, P = span / v;
      g.strokeStyle = ca(col, clamp(a * al * k)); g.lineWidth = lw;
      g.beginPath();
      for (let i = 0; i < m; i++) {
        const id = base + i, ph = h2(id, seed);
        const y = ((t / P + ph) % 1) * span - l - 70, cyc = Math.floor(t / P + ph);
        const x = wrap(h2(id, seed + 1 + cyc * 7) * (W + 400) - 200 + y * tn, -60, W + 60);
        if (gy != null && y > gy + (L - 1) * 14) continue;
        g.moveTo(x, y); g.lineTo(x - l * tn * 0.98, y - l);
      }
      g.stroke();
      if (L === 3) { g.strokeStyle = ca(col, clamp(a * 0.08 * k)); g.lineWidth = lw * 4; g.stroke(); }
      base += m;
    });
    if (gy != null) {
      const ns = o.splash ?? 46;
      g.strokeStyle = ca(col, clamp(a * 0.8)); g.lineWidth = 1;
      g.beginPath();
      const drops = [];
      for (let i = 0; i < ns; i++) {
        const P = 0.45 + 0.4 * h2(i, seed + 40), u = t / P + h2(i, seed + 41), cyc = Math.floor(u), age = (u - cyc) * P;
        if (age > 0.32) continue;
        const x = h2(i * 131 + cyc, seed + 42) * W, y = gy + h2(i * 71 + cyc, seed + 43) * (o.depth ?? 60), r = 2 + age * 34 * (0.6 + 0.4 * (y - gy) / 60), e = 1 - age / 0.32;
        g.moveTo(x + r, y); g.ellipse(x, y, r, r * 0.28, 0, 0, TAU);
        drops.push([x, y, age, e]);
      }
      g.stroke();
      g.fillStyle = ca(col, clamp(a * 0.9));
      for (const [x, y, age, e] of drops) {
        if (age > 0.18) continue;
        for (const s of [-1, 1]) { const dx = s * age * 60, dy = -age * 80 + age * age * 420; g.fillRect(x + dx - 0.8, y + dy - 0.8, 1.6, 1.6 * e + 0.6); }
      }
    }
    g.restore();
  };

  // ---------- 闪电 ----------
  function bolt(rand, x0, y0, x1, y1, dev, depth, out) {
    let pts = [[x0, y0], [x1, y1]];
    for (let lvl = 0; lvl < 6; lvl++) {
      const np = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
        const off = (rand() - 0.5) * dev * L;
        np.push([(ax + bx) / 2 - (dy / L) * off, (ay + by) / 2 + (dx / L) * off], [bx, by]);
      }
      pts = np;
    }
    out.push({ pts, w: depth });
    if (depth < 2) {
      const nb = depth ? 1 : 3;
      for (let b = 0; b < nb; b++) {
        const at = Math.floor((0.15 + rand() * 0.6) * pts.length), [sx, sy] = pts[at];
        const L = Math.hypot(x1 - x0, y1 - y0) * (0.25 + rand() * 0.3) / (depth + 1), an = Math.atan2(y1 - y0, x1 - x0) + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.6);
        bolt(rand, sx, sy, sx + Math.cos(an) * L, sy + Math.sin(an) * L, dev * 1.1, depth + 1, out);
      }
    }
    return out;
  }
  // 闪电：t0 指定，或 on:'down'（默认）加 chance 抽签；返回当前闪光强度 0..1，可用来照亮场景
  V.lightning = function (g, c, o = {}) {
    const t = o.time ?? c.t, seed = o.seed ?? 91, col = o.color || '#c9b8ff', fl = o.flash ?? 0.5, wd = o.width ?? 1;
    const ev = fires(c, Object.assign({ on: 'down', chance: 0.5 }, o), 0.9);
    let lvl = 0;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > 0.9) continue;
      const I = Math.max(Math.exp(-age / 0.06), age > 0.09 ? 0.75 * Math.exp(-(age - 0.09) / 0.07) : 0, age > 0.22 ? 0.5 * Math.exp(-(age - 0.22) / 0.12) : 0);
      lvl = Math.max(lvl, I);
      const rand = A.rng(seed * 977 + e.k * 131 + 7);
      const x = o.x != null ? o.x + (rand() - 0.5) * (o.jitter ?? 0) : lerp(o.x0 ?? 200, o.x1 ?? W - 200, rand());
      const y0 = o.y0 ?? -20, y1 = o.y1 ?? 520, xe = x + (rand() - 0.5) * (o.drift ?? 260);
      const segs = bolt(rand, x, y0, xe, y1, o.dev ?? 0.32, 0, []);
      // 天空闪亮
      g.globalAlpha = clamp(fl * I * 0.55);
      g.drawImage(glowTex(col), x - 420, y0 - 300, 840, 640);
      g.fillStyle = ca(col, clamp(fl * I * 0.18)); g.globalAlpha = 1; g.fillRect(-60, -60, W + 120, H + 120);
      for (const sg of segs) {
        const k = sg.w ? 0.45 / sg.w : 1;
        for (const [lw, al, cc] of [[7, 0.32, col], [2, 0.95, '#ffffff']]) {
          g.strokeStyle = ca(cc, clamp(al * I * (sg.w ? 0.7 : 1))); g.lineWidth = lw * wd * k;
          g.beginPath(); sg.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        }
      }
      const main = segs[0].pts;
      g.globalAlpha = clamp(0.3 * I);
      for (let i = 0; i < main.length; i += 12) g.drawImage(glowTex(col), main[i][0] - 90, main[i][1] - 90, 180, 180);
    }
    g.restore();
    return lvl;
  };

  // ---------- 涟漪 ----------
  // 单点 x,y,t0；on:'beat' 每拍在 area 内泛起一圈；rain: 每秒雨点数（随机落点）
  V.ripples = function (g, c, o = {}) {
    const t = o.time ?? c.t, life = o.life ?? 2.4, R = o.r ?? 90, flat = o.flat ?? 0.28, rings = o.rings ?? 3, col = o.color || '#ffffff';
    const a = o.alpha ?? 0.5, lw = o.width ?? 1.3, seed = o.seed ?? 101, ar = o.area || [100, 480, W - 100, H - 20];
    const list = [];
    if (o.rain) {
      const rate = o.rain, step = 1 / rate, i1 = Math.floor(t / step);
      for (let i = i1; i > i1 - Math.ceil(life * rate) - 1; i--) {
        const t0 = i * step + hash(i * 3 + seed) * step;
        if (t0 > t) continue;
        list.push([lerp(ar[0], ar[2], hash(i * 7 + seed)), lerp(ar[1], ar[3], hash(i * 11 + seed)), t0, 0.5 + 0.5 * hash(i * 13 + seed)]);
      }
    } else {
      for (const e of o.t0 == null && !o.on ? [] : fires(c, o, life)) {
        const many = o.x == null || o.on;
        list.push([many ? lerp(ar[0], ar[2], hash(e.k * 17 + seed)) : o.x, many ? lerp(ar[1], ar[3], hash(e.k * 29 + seed)) : o.y, e.t0, 0.6 + 0.4 * (e.str ?? 1)]);
      }
    }
    g.save();
    for (const [x, y, t0, s] of list) {
      const age = t - t0;
      if (age < 0 || age > life) continue;
      const fy = flat * (0.6 + 0.4 * clamp((y - (ar[1] || 0)) / 300 + 0.5)), sc = s * (o.scale ?? 1);
      for (let j = 0; j < rings; j++) {
        const aj = age - j * 0.18;
        if (aj <= 0) continue;
        const r = R * sc * easeOut(aj / life) * (1 - j * 0.12), fa = a * Math.pow(1 - age / life, 1.5) * (1 - j * 0.25);
        if (fa < 0.01) continue;
        g.strokeStyle = ca(col, fa); g.lineWidth = lw * (1 - j * 0.2);
        g.beginPath(); g.ellipse(x, y, r, r * fy, 0, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(0,0,0,${(fa * 0.35).toFixed(3)})`; g.lineWidth = lw * 0.8;
        g.beginPath(); g.ellipse(x, y + 1, r * 0.9, r * fy * 0.9, 0, 0.15 * PI, 0.85 * PI); g.stroke();
      }
      if (age < 0.25) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - age / 0.25) * a; const r = 16 * sc; g.drawImage(glowTex(col), x - r, y - r * 0.6, r * 2, r * 1.2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    }
    g.restore();
  };

  // ---------- 碎裂 ----------
  const shardMemo = new Map();
  function shardSet(seed, n) {
    const key = seed + ':' + n;
    let s = shardMemo.get(key);
    if (s) return s;
    const r = A.rng(seed * 7 + 3), m = Math.max(5, Math.round(n / 3)), rings = [0, 0.32, 0.66, 1];
    const angs = [];
    for (let j = 0; j < m; j++) angs.push(((j + 0.2 + r() * 0.6) / m) * TAU);
    const V2 = rings.map((rr, ri) => angs.map((an) => {
      const jr = ri === 0 ? 0 : ri === 3 ? 1 : rr + (r() - 0.5) * 0.12, ja = an + (ri === 3 || ri === 0 ? 0 : (r() - 0.5) * (TAU / m) * 0.5);
      return [Math.cos(ja) * jr, Math.sin(ja) * jr];
    }));
    s = [];
    for (let ri = 0; ri < 3; ri++) for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      let pts;
      if (ri === 0) pts = [[0, 0], V2[1][j], V2[1][j2]];
      else if (ri === 1) pts = [V2[1][j], V2[2][j], V2[2][j2], V2[1][j2]];
      else {
        // 外圈碎片的外缘沿着圆弧
        const an0 = angs[j], an1 = angs[j2] + (j2 ? 0 : TAU);
        pts = [V2[2][j]];
        for (let q = 0; q <= 3; q++) { const an = an0 + ((an1 - an0) * q) / 3; pts.push([Math.cos(an), Math.sin(an)]); }
        pts.push(V2[2][j2]);
      }
      const cx = pts.reduce((v, p) => v + p[0], 0) / pts.length, cy = pts.reduce((v, p) => v + p[1], 0) / pts.length;
      s.push({ pts, cx, cy, h: r(), h2: r(), h3: r() });
    }
    s.spokes = V2;
    shardMemo.set(key, s);
    return s;
  }
  // x, y, r：碎裂物的圆心与半径；t0 碎开时刻（之前 crack 秒先出现裂纹）；img 可选的贴图（覆盖 [x-r, y-r, 2r, 2r]）
  // kind 'glass' 冷光碎片 / 'light' 发光的梦 / 'ink' 墨块
  V.shatter = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 360, R = o.r ?? 160, n = o.n ?? 36, seed = o.seed ?? 111, t0 = o.t0 ?? 0;
    const kind = o.kind || 'glass', col = o.color || (kind === 'ink' ? '#16141a' : '#cfe6ff'), edge = o.edge || '#ffffff';
    const dur = o.dur ?? 2.4, force = o.force ?? 380, grav = o.gravity ?? 360, crack = o.crack ?? 0.6, a = o.alpha ?? 1;
    const age = t - t0, set = shardSet(seed, n), m = Mx(g);
    if (age > dur || age < -crack - (o.hold ?? 0)) return;
    g.save();
    if (age < 0) {
      if (o.img) g.drawImage(o.img, x - R, y - R, R * 2, R * 2);
      const cp = clamp((age + crack) / crack), sp = set.spokes;
      g.globalCompositeOperation = kind === 'ink' ? 'source-over' : 'lighter';
      g.strokeStyle = ca(kind === 'ink' ? '#000000' : edge, 0.85 * a); g.lineWidth = 1.2;
      g.beginPath();
      for (let j = 0; j < sp[1].length; j++) {
        if (h2(j, seed) > cp * 1.4) continue;
        g.moveTo(x, y);
        for (let ri = 1; ri <= 3; ri++) { if (ri / 3 > cp * 1.1) break; g.lineTo(x + sp[ri][j][0] * R, y + sp[ri][j][1] * R); }
      }
      if (cp > 0.6) for (let ri = 1; ri <= 2; ri++) for (let j = 0; j < sp[ri].length; j++) { if (h2(j + ri * 50, seed) > (cp - 0.6) * 2.5) continue; const j2 = (j + 1) % sp[ri].length; g.moveTo(x + sp[ri][j][0] * R, y + sp[ri][j][1] * R); g.lineTo(x + sp[ri][j2][0] * R, y + sp[ri][j2][1] * R); }
      g.stroke();
      if (kind !== 'ink') { g.globalAlpha = cp * 0.4 * a; const rr = R * (0.4 + cp * 0.4); g.drawImage(glowTex(col), x - rr, y - rr, rr * 2, rr * 2); }
      g.restore();
      return;
    }
    const fade = 1 - smooth(age / dur);
    if (age < 0.3 && kind !== 'ink') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - age / 0.3) * a; const rr = R * 2.2; g.drawImage(glowTex(col), x - rr, y - rr, rr * 2, rr * 2); g.globalCompositeOperation = 'source-over'; }
    for (const s of set) {
      const l = Math.hypot(s.cx, s.cy) || 0.001, dx = l > 0.05 ? s.cx / l : Math.cos(s.h * TAU), dy = l > 0.05 ? s.cy / l : Math.sin(s.h * TAU);
      const v = force * (0.5 + 0.9 * s.h2) * (1.2 - l * 0.4);
      const px = x + s.cx * R + dx * v * age, py = y + s.cy * R + (dy * v - 80) * age + 0.5 * grav * age * age;
      const rot = (s.h3 - 0.5) * 7 * age, fx = Math.cos(age * (2 + 6 * s.h) + s.h3 * 6);
      const al = a * fade * (kind === 'ink' ? 1 - smooth((age - dur * 0.3) / (dur * 0.6)) : 1);
      if (al < 0.01) continue;
      setL(g, m, px, py, rot, Math.max(0.1, Math.abs(fx)) * Math.sign(fx || 1), 1);
      g.beginPath();
      s.pts.forEach((p, i) => { const qx = (p[0] - s.cx) * R, qy = (p[1] - s.cy) * R; i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); });
      g.closePath();
      if (o.img) {
        g.save(); g.clip(); g.globalAlpha = al;
        g.drawImage(o.img, -R - s.cx * R, -R - s.cy * R, R * 2, R * 2);
        g.restore();
      } else {
        g.globalAlpha = al;
        g.fillStyle = kind === 'ink' ? col : ca(col, kind === 'light' ? 0.55 : 0.28); g.fill();
      }
      if (kind !== 'ink') {
        const gl = Math.pow(Math.abs(Math.sin(rot * 1.3 + s.h * 6 + age * 3)), 10);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = ca(edge, (0.45 + 0.55 * gl) * al); g.lineWidth = 1.2; g.stroke();
        if (gl > 0.05) { g.fillStyle = ca(edge, gl * 0.5 * al); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      }
    }
    reset(g, m);
    // 细碎的闪屑
    g.globalCompositeOperation = kind === 'ink' ? 'source-over' : 'lighter';
    const dot = kind === 'ink' ? flakeTex(col) : sparkTex(cmix(col, '#ffffff', 0.5));
    for (let i = 0; i < n * 2; i++) {
      const an = h2(i, seed + 5) * TAU, v = force * (0.8 + 1.4 * h2(i, seed + 6));
      const px = x + Math.cos(an) * (R * 0.3 + v * age), py = y + Math.sin(an) * (R * 0.3 + v * age) + 0.5 * grav * age * age;
      const rr = 1.5 + 3 * h2(i, seed + 7);
      g.globalAlpha = clamp(a * fade * (0.5 + 0.5 * Math.sin(age * 20 + i)));
      g.drawImage(dot, px - rr * 2, py - rr * 2, rr * 4, rr * 4);
    }
    g.restore();
  };

  // ---------- 余烬 ----------
  // 从 y 处（x0..x1）升起的火星；rise 升高多少后熄灭
  V.embers = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 70, seed = o.seed ?? 121, x0 = o.x0 ?? 0, x1 = o.x1 ?? W, yb = o.y ?? H + 10;
    const rise = o.rise ?? 520, sp = o.speed ?? 70, wind = o.wind ?? 18, col = o.color || '#ff8a3a', hot = o.hot || '#ffe6a6';
    const a = o.alpha ?? 1, sz = o.size || [1, 4.2], beat = o.beat ?? 0.5;
    const tab = table('ember' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.4), L: 0.6 + 0.8 * h2(i, seed + 1), p: h2(i, seed + 2), f: h2(i, seed + 3) * 100, h: h2(i, seed + 4) }));
    const tHot = sparkTex(hot), tCol = glowTex(col), m = Mx(g), bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.35);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const q of tab) {
      const k = lerp(0.5, 1.4, q.z), life = (rise / sp) * q.L / k, u0 = t / life + q.p, cyc = Math.floor(u0), u = u0 - cyc;
      const xs = lerp(x0, x1, h2(q.i * 31 + cyc, seed + 5));
      const pos = (uu) => [xs + wind * uu * life * k + (noise1(uu * 3 + q.f, seed) - 0.5) * 70 * k * uu + Math.sin(uu * 9 + q.f) * 6 * uu, yb - uu * rise * q.L * (0.8 + 0.4 * q.h)];
      const [x, y] = pos(u), [xp, yp] = pos(Math.max(0, u - 0.02));
      let br = smooth(u / 0.08) * (1 - smooth((u - 0.45) / 0.55)) * (0.55 + 0.45 * noise1(t * 7 + q.f, seed + 1));
      if (hash(q.i * 19 + bi * 101 + seed) < 0.3) br *= 1 + pulse * 1.5;
      br *= a * lerp(0.6, 1, q.z);
      if (br < 0.02) continue;
      const r = lerp(sz[0], sz[1], q.z), an = Math.atan2(y - yp, x - xp), st = 1 + Math.min(3, Math.hypot(x - xp, y - yp) / (r * 1.5));
      g.globalAlpha = clamp(br * 0.3); g.drawImage(tCol, x - r * 3, y - r * 3, r * 6, r * 6);
      g.globalAlpha = clamp(br);
      putR(g, m, tHot, x, y, r * 3.2 * st, r * 3.2, an);
    }
    reset(g, m);
    g.restore();
  };

  // ---------- 火花 ----------
  // 迸溅：x, y 处在 t0（或 on:'beat'/'down'）炸开；angle/spread 喷射方向与张角
  V.sparks = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 40, seed = o.seed ?? 131, sp = o.speed ?? 520, grav = o.gravity ?? 900, dur = o.dur ?? 0.9;
    const ang = o.angle ?? -PI / 2, spread = o.spread ?? TAU, col = o.color || '#ffc86a', hot = o.hot || '#fffbe8', drag = o.drag ?? 2.4, a = o.alpha ?? 1, s = o.size ?? 1;
    const ev = o.t0 == null && !o.on ? [{ t0: 0, k: 0, str: 1 }] : fires(c, o, dur);
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > dur) continue;
      const ox = o.x ?? 640, oy = o.y ?? 360, sd = seed + e.k * 17;
      if (age < 0.16) { g.globalAlpha = clamp((1 - age / 0.16) * a); const R = 70 * s; g.drawImage(glowTex(col), ox - R, oy - R, R * 2, R * 2); }
      g.globalAlpha = 1;
      const disp = (v, aa) => (v * (1 - Math.exp(-drag * aa))) / drag;
      for (let lv = 0; lv < 3; lv++) {
        g.beginPath();
        for (let i = lv; i < n; i += 3) {
          const th = ang + (h2(i, sd) - 0.5) * spread, v = sp * (0.25 + 0.75 * Math.sqrt(h2(i, sd + 1))) * (0.6 + 0.4 * (e.str ?? 1));
          const lf = dur * (0.4 + 0.6 * h2(i, sd + 2));
          if (age > lf) continue;
          const a0 = Math.max(0, age - 0.035), d1 = disp(v, age), d0 = disp(v, a0);
          g.moveTo(ox + Math.cos(th) * d0, oy + Math.sin(th) * d0 + 0.5 * grav * a0 * a0);
          g.lineTo(ox + Math.cos(th) * d1, oy + Math.sin(th) * d1 + 0.5 * grav * age * age);
        }
        const k = 1 - age / dur;
        g.strokeStyle = ca(lv ? col : hot, clamp(a * k * (lv === 2 ? 0.5 : 0.95))); g.lineWidth = (lv === 2 ? 2.6 : 1.4) * s;
        g.stroke();
      }
    }
    g.restore();
  };

  // ---------- 时光漩涡 ----------
  // x, y 圆心；r 半径；amount 0..1 漩涡张开的程度；tilt 透视扁度；dir 旋向
  V.timeVortex = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 360, amt = clamp(o.amount ?? 1), R = (o.r ?? 420) * (0.3 + 0.7 * easeOut(amt));
    const c1 = o.color || '#ffd88a', c2 = o.color2 || '#8ab6ff', tilt = o.tilt ?? 0.62, dir = o.dir ?? 1, seed = o.seed ?? 141, n = o.n ?? 140;
    const a = (o.alpha ?? 1) * amt, beat = o.beat ?? 0.6, pulse = beat * BE(c, 0.45), dpulse = beat * DE(c, 0.8);
    if (a < 0.01) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    // 深处的光
    g.globalAlpha = clamp(0.36 * a); g.drawImage(glowTex(c2), x - R * 0.75, y - R * 0.75 * tilt, R * 1.5, R * 1.5 * tilt);
    g.globalAlpha = clamp(0.3 * a * (1 + dpulse)); g.drawImage(glowTex(c1), x - R * 0.4, y - R * 0.4 * tilt, R * 0.8, R * 0.8 * tilt);
    // 旋臂
    const arms = o.arms ?? 4, thMax = 3.2 * PI, kk = Math.log(1 / 0.05) / thMax, rot = t * 0.35 * dir;
    // 纯色分两层：整条旋臂淡蓝，靠里的一段叠一层金（比渐变填充省得多）
    for (const [i0, wk, cc, al] of [[0, 1, c2, 0.17], [0.3, 0.5, c1, 0.26], [0.6, 0.25, '#ffffff', 0.22]]) {
      g.fillStyle = ca(cc, clamp(al * a * (1 + 0.4 * dpulse)));
      g.beginPath();
      for (let j = 0; j < arms; j++) {
        const base = rot + (j * TAU) / arms, NS = 40, j0 = Math.round(i0 * NS), outer = [], inner = [];
        for (let i = j0; i <= NS; i++) {
          const th = (i / NS) * thMax, rr = R * Math.exp(-kk * th), an = base + dir * th, w = 0.16 * wk * Math.pow(Math.sin((PI * (i - j0)) / (NS - j0)), 0.7);
          outer.push([x + Math.cos(an) * rr * (1 + w), y + Math.sin(an) * rr * (1 + w) * tilt]);
          inner.push([x + Math.cos(an + dir * 0.1 * wk) * rr * (1 - w * 0.6), y + Math.sin(an + dir * 0.1 * wk) * rr * (1 - w * 0.6) * tilt]);
        }
        outer.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1]);
        g.closePath();
      }
      g.fill();
    }
    // 星轨：被吸向中心的光弧，越近越快
    const tab = table('vortex' + seed, n, (i) => ({ z: h2(i, seed), h: h2(i, seed + 1), p: h2(i, seed + 2) * TAU, v: 0.05 + 0.08 * h2(i, seed + 3), ci: h2(i, seed + 4) < 0.55 ? 0 : 1 }));
    const B = [[], [], [], [], [], []];
    for (const q of tab) {
      const s = (((q.h - t * q.v) % 1) + 1) % 1, u = 0.05 + 0.95 * s, rr = R * u;
      const th = q.p + dir * (t * 0.22 + 0.5 / u), dl = (0.08 + 0.4 * (1 - s)) * (0.6 + 0.8 * q.z);
      const al = smooth((1 - s) / 0.18) * smooth(s / 0.12);
      if (al < 0.05) continue;
      B[q.ci * 3 + Math.min(2, Math.floor(al * 3))].push([rr, th, dl]);
    }
    B.forEach((bk, bi) => {
      if (!bk.length) return;
      const ci = Math.floor(bi / 3), lv = (bi % 3) + 1;
      g.strokeStyle = ca(ci ? c2 : c1, clamp(a * 0.28 * lv)); g.lineWidth = 0.8 + lv * 0.5;
      g.beginPath();
      for (const [rr, th, dl] of bk) {
        const t0 = dir > 0 ? th - dl : th, t1 = dir > 0 ? th : th + dl;
        g.moveTo(x + Math.cos(t0) * rr, y + Math.sin(t0) * rr * tilt);
        g.ellipse(x, y, rr, rr * tilt, 0, t0, t1);
      }
      g.stroke();
    });
    // 刻度环：像日晷与罗盘，反向缓转，拍点时一亮
    g.lineCap = 'butt';
    [[0.98, 72, 1, 0.05], [0.66, 48, -1, 0.08], [0.4, 24, 1, 0.12]].forEach(([k, m, d, sp], ri) => {
      const rr = R * k * (1 + 0.025 * pulse), off = t * sp * d * dir;
      g.strokeStyle = ca(ri === 1 ? c2 : c1, clamp(a * (0.22 + 0.4 * pulse))); g.lineWidth = 1;
      g.beginPath(); g.ellipse(x, y, rr, rr * tilt, 0, 0, TAU); g.stroke();
      g.lineWidth = 1.4; g.beginPath();
      for (let i = 0; i < m; i++) {
        const an = off + (i / m) * TAU, big = i % 6 === 0, l0 = big ? 0.955 : 0.975, l1 = big ? 1.05 : 1.025;
        g.moveTo(x + Math.cos(an) * rr * l0, y + Math.sin(an) * rr * l0 * tilt); g.lineTo(x + Math.cos(an) * rr * l1, y + Math.sin(an) * rr * l1 * tilt);
      }
      g.stroke();
    });
    // 中心与星点
    const core = R * 0.16 * (1 + 0.25 * pulse);
    g.globalAlpha = clamp(0.9 * a); g.drawImage(glowTex('#ffffff'), x - core, y - core, core * 2, core * 2);
    const dot = sparkTex('#fff6e0');
    for (let i = 0; i < 40; i++) {
      const u = 0.1 + 0.9 * h2(i, seed + 9), th = h2(i, seed + 10) * TAU + dir * t * (0.4 / u), rr = R * u;
      g.globalAlpha = clamp(a * (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * 3 + i * 2.1), 3)));
      const s = 2 + 3 * h2(i, seed + 11);
      g.drawImage(dot, x + Math.cos(th) * rr - s * 2, y + Math.sin(th) * rr * tilt - s * 2, s * 4, s * 4);
    }
    g.restore();
  };

  // ---------- 灵珠 ----------
  const FIVE = ['#6cc8ff', '#ff6a4a', '#c69cff', '#7cf0a6', '#ffd36a'];
  // mode 'orbit'：绕 (x, y) 椭圆环行（五灵珠绕灵儿）；layer 'back'|'front' 只画人物身后或身前的半圈；mode 'float'：在 area 里漂浮
  V.glowOrbs = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 5, cols = o.colors || FIVE, x = o.x ?? 640, y = o.y ?? 360, R = o.r ?? 130, tilt = o.tilt ?? 0.32;
    const sp = o.speed ?? 0.7, s0 = o.size ?? 12, trail = o.trail ?? 10, seed = o.seed ?? 151, a = o.alpha ?? 1, beat = o.beat ?? 0.6, float = o.mode === 'float';
    const ar = o.area || [100, 100, W - 100, H - 160], pulse = beat * BE(c, 0.45), white = sparkTex('#ffffff');
    const pos = (i, tt) => {
      if (float) {
        return [lerp(ar[0], ar[2], noise1(tt * 0.05 + i * 13.7, seed) * 1.3 - 0.15), lerp(ar[1], ar[3], noise1(tt * 0.045 + i * 7.3, seed + 1) * 1.3 - 0.15) + Math.sin(tt * 1.2 + i) * 8, 0];
      }
      const th = tt * sp + (i * TAU) / n;
      return [x + Math.cos(th) * R, y + Math.sin(th) * R * tilt + Math.sin(tt * 1.7 + i * 2) * 6, Math.sin(th)];
    };
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const [px, py, d] = pos(i, t);
      if ((o.layer === 'back' && d >= 0) || (o.layer === 'front' && d < 0)) continue;
      const col = cols[i % cols.length], sc = (1 + 0.22 * d) * (1 + 0.3 * pulse) * (float ? 0.7 + 0.6 * h2(i, seed) : 1), al = a * (0.75 + 0.25 * d);
      const gt = glowTex(col), st = sparkTex(cmix(col, '#ffffff', 0.4));
      for (let j = trail; j >= 1; j--) {
        const [qx, qy] = pos(i, t - j * 0.045);
        const r = s0 * sc * 0.9 * (1 - j / (trail + 2));
        g.globalAlpha = clamp(al * 0.45 * (1 - j / (trail + 1))); g.drawImage(st, qx - r, qy - r, r * 2, r * 2);
      }
      const r = s0 * sc;
      g.globalAlpha = clamp(al * 0.4); g.drawImage(gt, px - r * 5, py - r * 5, r * 10, r * 10);
      g.globalAlpha = clamp(al * 0.85); g.drawImage(st, px - r * 1.6, py - r * 1.6, r * 3.2, r * 3.2);
      g.globalAlpha = clamp(al); g.drawImage(white, px - r * 0.8, py - r * 0.8, r * 1.6, r * 1.6);
    }
    g.restore();
  };

  // ---------- 烟 ----------
  // kind 'incense' 香烟袅袅（x, y 为香头）/ 'puff' 翻滚的烟尘（x, y, w 为源区；t0 给定时是一次性的爆散）
  V.smoke = function (g, c, o = {}) {
    const t = o.time ?? c.t, kind = o.kind || 'incense', seed = o.seed ?? 161, col = o.color || (kind === 'incense' ? '#e4ded4' : '#6a625c');
    const a = o.alpha ?? (kind === 'incense' ? 0.55 : 0.5), x = o.x ?? 640, y = o.y ?? 600, m = Mx(g);
    g.save();
    if (kind === 'incense') {
      const h = o.h ?? 300, nS = o.n ?? 2, wd = o.width ?? 1.6, wind = o.wind ?? 0.15, N = 36;
      g.lineCap = 'round';
      for (let k = 0; k < nS; k++) {
        const ph = h2(k, seed) * TAU, pts = [];
        for (let j = 0; j <= N; j++) {
          const u = j / N, amp = 3 + 46 * Math.pow(u, 1.5);
          const off = amp * (0.55 * Math.sin(u * 7 - t * 1.5 + ph) + 0.45 * (noise1(u * 2.6 - t * 0.35 + k * 10, seed) - 0.5) * 2) + wind * u * u * h;
          pts.push([x + off + (k - (nS - 1) / 2) * 3 * u, y - u * h * (0.85 + 0.15 * Math.sin(t * 0.3 + k))]);
        }
        for (let j = 0; j < N; j++) {
          const u = j / N;
          g.strokeStyle = ca(col, a * Math.pow(1 - u, 1.3) * smooth(u / 0.05 + 0.3));
          g.lineWidth = wd * (1 + u * 7);
          g.beginPath(); g.moveTo(pts[j][0], pts[j][1]); g.lineTo(pts[j + 1][0], pts[j + 1][1]); g.stroke();
        }
        const top = pts[Math.round(N * 0.7)];
        g.globalAlpha = a * 0.3;
        putR(g, m, XYT.sprites.tint(puffTex(k % 3), col), top[0], top[1] - h * 0.15, h * 0.4, h * 0.4, t * 0.2 + ph, 1);
        reset(g, m);
        g.globalAlpha = 1;
      }
    } else {
      const n = o.n ?? 14, w = o.w ?? 300, sz = o.size ?? 140, rise = o.rise ?? 40, life = o.life ?? 6, drift = o.drift ?? 14, burst = o.t0 != null;
      for (let i = 0; i < n; i++) {
        const hA = h2(i, seed), hB = h2(i, seed + 1), hC = h2(i, seed + 2);
        let u, px, py, s;
        if (burst) {
          const age = t - o.t0 - hA * 0.4;
          if (age < 0) continue;
          u = clamp(age / (life * (0.7 + 0.5 * hB)));
          if (u >= 1) continue;
          const an = hB * TAU, e = easeOut(Math.min(1, u * 2.5)), d = (o.spread ?? 260) * e * (0.4 + 0.6 * hC);
          px = x + Math.cos(an) * d + drift * u * life; py = y + Math.sin(an) * d * 0.5 - rise * u * life; s = sz * (0.4 + 1.1 * e) * (0.7 + 0.6 * hA);
        } else {
          const L = life * (0.7 + 0.6 * hB), u0 = t / L + hA, cyc = Math.floor(u0);
          u = u0 - cyc;
          px = x + (h2(i * 13 + cyc, seed + 3) - 0.5) * w + drift * u * L; py = y - rise * u * L; s = sz * (0.45 + 0.9 * u) * (0.7 + 0.6 * hC);
        }
        const al = a * smooth(u / 0.15) * Math.pow(1 - u, 1.3);
        g.globalAlpha = clamp(al);
        putR(g, m, XYT.sprites.tint(puffTex(i % 3), col), px, py, s, s * 0.85, hC * TAU + u * (hA - 0.5) * 1.6, 1);
      }
      reset(g, m);
    }
    g.restore();
  };

  // ---------- 红蒲公英絮 ----------
  function pappusTex(col, light) {
    return S('pappus|' + col + light, 64, 64, 1, (g) => {
      const cx = 32, cy = 24;
      g.lineCap = 'round';
      for (let i = 0; i < 34; i++) {
        const an = -PI + (i / 33) * PI + Math.sin(i * 7.3) * 0.05, L = 19 + 4 * Math.sin(i * 3.7);
        const ex = cx + Math.cos(an) * L, ey = cy + Math.sin(an) * L * 0.9 + 3;
        g.strokeStyle = ca(i % 3 ? col : light, 0.75); g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(an) * L * 0.5, cy + Math.sin(an) * L * 0.4 - 2, ex, ey); g.stroke();
        g.fillStyle = ca(light, 0.8); g.beginPath(); g.arc(ex, ey, 0.9, 0, TAU); g.fill();
      }
      for (let i = 0; i < 10; i++) {
        const an = 0.3 + (i / 9) * (PI - 0.6), L = 9;
        g.strokeStyle = ca(col, 0.5); g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(an) * L, cy + Math.sin(an) * L * 0.7); g.stroke();
      }
      g.strokeStyle = ca(cmix(col, '#3a0a0a', 0.3), 0.9); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 0.5, cy + 22); g.stroke();
      g.fillStyle = cmix(col, '#3a0a0a', 0.45);
      g.beginPath(); g.ellipse(cx + 0.6, cy + 26, 1.6, 4.2, 0.05, 0, TAU); g.fill();
      A.softBlob(g, cx, cy, 6, 0.6, light);
    });
  }
  // 漫天红絮：随风上浮，近大远小；拍点时一阵风把它们推远
  V.fluff = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 90, seed = o.seed ?? 171, col = o.color || '#e8322c', light = o.light || '#ffd2c0';
    const a = o.alpha ?? 0.95, sz = o.size || [7, 46], wind = o.wind ?? 28, rise = o.rise ?? 16, gust = o.gust ?? 30, gl = o.glow ?? 0.35;
    const ar = o.area || [-40, -40, W + 40, H + 40], zr = o.layer === 'back' ? [0, 0.65] : o.layer === 'front' ? [0.65, 2] : [0, 2];
    const tab = table('fluff' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.4), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU, f: 0.5 + h2(i, seed + 5) }));
    const tex = pappusTex(col, light), sft = soft('pappus|' + col + light, tex, 2.4), halo = glowTex(col), dot = sparkTex(cmix(col, light, 0.4));
    const sur = surge(c, 5) * gust, m = Mx(g);
    g.save();
    for (const q of tab) {
      if (q.z < zr[0] || q.z >= zr[1]) continue;
      const k = lerp(0.3, 1.4, q.z), s = lerp(sz[0], sz[1], q.z) * (0.8 + 0.4 * q.v);
      const spanY = ar[3] - ar[1] + s * 2, spanX = ar[2] - ar[0] + s * 2;
      const y = ar[1] - s + wrap(q.y * spanY - t * rise * k * (0.6 + 0.8 * q.v) + Math.sin(t * 0.8 * q.f + q.p) * 14 * k, 0, spanY);
      const x = ar[0] - s + wrap(q.x * spanX + t * wind * k + sur * k + Math.sin(t * 0.5 * q.f + q.p * 2) * 30 * k, 0, spanX);
      const rot = 0.3 * Math.sin(t * 0.7 * q.f + q.p) + 0.15;
      const al = a * lerp(0.45, 1, Math.min(1, q.z * 1.6));
      if (gl > 0 && q.z > 0.25) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(gl * al * 0.35); g.drawImage(halo, x - s * 1.4, y - s * 1.6, s * 2.8, s * 2.8); g.globalCompositeOperation = 'source-over'; }
      if (s < 7) { g.globalAlpha = clamp(al); g.drawImage(dot, x - s * 0.5, y - s * 0.5, s, s); continue; }
      const blur = q.z > 0.82, img = blur ? sft : tex, w = s * (blur ? img.pk : 1);
      g.globalAlpha = clamp(al * (blur ? 0.85 : 1));
      putR(g, m, img, x, y, w, w, rot, 1);
    }
    reset(g, m);
    g.restore();
  };

  // ---------- 泪 ----------
  function dropPath(g, x, y, r, st) {
    // 下圆上尖的水滴；st 为拉长程度
    g.beginPath();
    g.moveTo(x, y - r * (1.6 + st));
    g.bezierCurveTo(x + r * 0.35, y - r * (0.9 + st * 0.5), x + r, y - r * 0.35, x + r, y + r * 0.1);
    g.arc(x, y + r * 0.1, r, 0, PI);
    g.bezierCurveTo(x - r, y - r * 0.35, x - r * 0.35, y - r * (0.9 + st * 0.5), x, y - r * (1.6 + st));
    g.closePath();
  }
  // x, y 眼角；len 沿脸颊滑落的长度；angle 滑落方向偏斜；s 大小（近景特写可设 4–8）；loop 周期秒；color 血泪用红色
  V.tear = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 300, s = o.s ?? 1, len = o.len ?? 60, ang = o.angle ?? 0.12, dur = o.dur ?? 2.2;
    const col = o.color || '#dcefff', a = o.alpha ?? 1, well = 0.7, seed = o.seed ?? 181;
    let age = t - (o.t0 ?? 0);
    if (o.loop) age = ((age % o.loop) + o.loop) % o.loop;
    if (age < 0) return;
    const r = 2.6 * s * easeOut(clamp(age / well)), dx = Math.sin(ang), dy = Math.cos(ang);
    const ts = clamp((age - well) / dur);
    // 走走停停地滑：在若干处稍作停顿
    const u = ts <= 0 ? 0 : clamp(easeInOut(ts) + 0.04 * Math.sin(ts * PI * 4) * (1 - ts));
    const fall = Math.max(0, age - well - dur), cx = x + dx * len * u + (noise1(u * 3, seed) - 0.5) * 4 * s, cy = y + dy * len * u + 0.5 * 900 * fall * fall;
    const fade = 1 - smooth(fall / 0.5);
    if (fade <= 0) return;
    g.save();
    // 泪痕
    if (u > 0.02) {
      const gr = g.createLinearGradient(x, y, cx, cy);
      gr.addColorStop(0, ca(col, 0.18 * a)); gr.addColorStop(1, ca(col, 0.42 * a));
      g.strokeStyle = gr; g.lineWidth = Math.max(0.8, r * 0.7); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y);
      for (let j = 1; j <= 10; j++) { const uu = (u * j) / 10; g.lineTo(x + dx * len * uu + (noise1(uu * 3, seed) - 0.5) * 4 * s, y + dy * len * uu); }
      g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = ca('#ffffff', 0.12 * a); g.lineWidth = Math.max(0.5, r * 0.25); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    const st = fall > 0 ? Math.min(2, fall * 6) : u > 0 && u < 1 ? 0.5 : 0;
    g.globalAlpha = fade;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = fade * 0.4; g.drawImage(glowTex(col), cx - r * 4, cy - r * 4, r * 8, r * 8); g.globalAlpha = fade;
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r * 1.4);
    gr.addColorStop(0, ca(col, 0.3 * a)); gr.addColorStop(0.7, ca(col, 0.55 * a)); gr.addColorStop(1, ca(cmix(col, '#203040', 0.5), 0.8 * a));
    g.fillStyle = gr; dropPath(g, cx, cy, r, st); g.fill();
    g.fillStyle = ca('#ffffff', 0.95 * a); g.beginPath(); g.ellipse(cx - r * 0.38, cy - r * 0.2, r * 0.22, r * 0.34, -0.4, 0, TAU); g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = ca(col, 0.6 * a); g.beginPath(); g.ellipse(cx + r * 0.2, cy + r * 0.62, r * 0.45, r * 0.2, 0, 0, TAU); g.fill();
    g.restore();
  };

  // ---------- 火焰 ----------
  function tongue(g, x, y, w, h, lean) {
    const tx = x + lean, ty = y - h;
    g.beginPath();
    g.moveTo(tx, ty);
    g.bezierCurveTo(tx - w * 0.12, ty + h * 0.3, x - w * 0.62, y - h * 0.4, x - w * 0.5, y - h * 0.12);
    g.bezierCurveTo(x - w * 0.42, y + h * 0.05, x - w * 0.2, y + h * 0.09, x, y + h * 0.09);
    g.bezierCurveTo(x + w * 0.2, y + h * 0.09, x + w * 0.42, y + h * 0.05, x + w * 0.5, y - h * 0.12);
    g.bezierCurveTo(x + w * 0.62, y - h * 0.4, tx + w * 0.12, ty + h * 0.3, tx, ty);
    g.closePath();
  }
  // kind 'candle' 烛火 / 'torch' 火把 / 'fire' 火堆与火盆；x, y 为火焰根部；burn 0..1（残烛小而暗）；wind 吹斜
  V.flame = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 500, s = o.s ?? 1, kind = o.kind || 'candle', seed = o.seed ?? 191;
    const col = o.color || '#ff9a3a', core = o.core || '#fff4d0', wind = o.wind ?? 0, burn = o.burn ?? 1, gl = o.glow ?? 1, a = o.alpha ?? 1, beat = o.beat ?? 0.3;
    const fl = 0.55 * noise1(t * 9, seed) + 0.3 * noise1(t * 23, seed + 1) + 0.15 * noise1(t * 47, seed + 2);
    const flare = 1 + beat * 0.14 * BE(c, 0.3);
    g.save();
    if (kind === 'candle') {
      const h = 34 * s * (0.84 + 0.3 * fl) * (0.45 + 0.55 * burn) * flare, w = 11 * s * (0.75 + 0.25 * burn);
      const lean = wind * h * 0.6 + (noise1(t * 2.6, seed + 3) - 0.5) * w * 0.9;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = clamp(0.32 * gl * a * (0.7 + 0.3 * fl) * (0.4 + 0.6 * burn)); const R = h * 4.2 * gl; g.drawImage(glowTex(col), x - R, y - h * 0.4 - R, R * 2, R * 2);
      g.globalAlpha = clamp(0.5 * a * (0.8 + 0.2 * fl)); const R2 = h * 1.3; g.drawImage(glowTex(cmix(col, core, 0.5)), x + lean * 0.4 - R2, y - h * 0.45 - R2, R2 * 2, R2 * 2);
      g.globalAlpha = a;
      g.globalCompositeOperation = 'source-over';
      let gr = g.createLinearGradient(0, y - h, 0, y + h * 0.1);
      gr.addColorStop(0, ca(cmix(col, '#ff4020', 0.4), 0)); gr.addColorStop(0.25, ca(col, 0.7)); gr.addColorStop(0.7, ca(cmix(col, core, 0.5), 0.95)); gr.addColorStop(1, ca(col, 0.5));
      g.fillStyle = gr; tongue(g, x, y, w, h, lean); g.fill();
      gr = g.createLinearGradient(0, y - h * 0.62, 0, y);
      gr.addColorStop(0, ca(core, 0)); gr.addColorStop(0.4, ca(core, 0.9)); gr.addColorStop(1, ca('#ffffff', 0.95));
      g.fillStyle = gr; tongue(g, x, y - h * 0.04, w * 0.52, h * 0.6, lean * 0.6); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = ca('#6a8cff', 0.45 * a); g.beginPath(); g.ellipse(x, y - h * 0.02, w * 0.3, h * 0.09, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(20,12,8,0.9)'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, y + 2 * s); g.quadraticCurveTo(x + 0.6 * s, y - h * 0.1, x + lean * 0.15, y - h * 0.18); g.stroke();
    } else {
      const fire = kind === 'fire', m = fire ? 9 : 4, FW = (fire ? 120 : 34) * s, FH = (fire ? 150 : 90) * s * (0.5 + 0.5 * burn) * flare;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = clamp(0.38 * gl * a * (0.85 + 0.15 * fl)); const R = FH * 2.6 * gl; g.drawImage(glowTex(col), x - R, y - FH * 0.4 - R, R * 2, R * 2);
      for (const [layer, cc, ww, hh, al] of [[0, '#d8341a', 1, 1, 0.55], [1, col, 0.75, 0.82, 0.7], [2, core, 0.42, 0.55, 0.85]]) {
        for (let j = 0; j < m; j++) {
          const u = m === 1 ? 0.5 : j / (m - 1), sd = seed + j * 7 + layer * 31;
          const hj = FH * hh * (0.42 + 0.58 * Math.sin(PI * (0.15 + 0.7 * u))) * (0.65 + 0.55 * noise1(t * (2.2 + layer) + j * 3.1, sd));
          const xj = x + (u - 0.5) * FW * 0.75 * ww, wj = (FW / m) * 2.1 * ww;
          const lean = wind * hj * 0.7 + (noise1(t * 3.4 + j * 1.7, sd + 1) - 0.5) * wj * 1.2;
          const gr = g.createLinearGradient(0, y - hj, 0, y);
          gr.addColorStop(0, ca(cc, 0)); gr.addColorStop(0.45, ca(cc, al * 0.7 * a)); gr.addColorStop(1, ca(cc, al * a));
          g.fillStyle = gr; g.globalAlpha = 1;
          tongue(g, xj, y, wj, hj, lean); g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
      if (o.embers !== false) V.embers(g, c, { x0: x - FW * 0.35, x1: x + FW * 0.35, y: y - FH * 0.3, n: fire ? 26 : 10, rise: FH * 2.2, speed: 60 * s, wind: wind * 60, size: [0.8 * s, 2.6 * s], seed: seed + 5, alpha: a });
    }
    g.restore();
  };

  // ---------- 命运丝线 ----------
  // from/to 两端（或 lines: [[x0,y0,x1,y1], ...]）；sag 下垂；progress 牵线进度；snap 断线时刻；拍点时一颗光珠沿线流过
  V.threads = function (g, c, o = {}) {
    const t = o.time ?? c.t, col = o.color || '#e0262e', a = o.alpha ?? 0.95, wd = o.width ?? 1.6, sag = o.sag ?? 60, wave = o.wave ?? 7;
    const gl = o.glow ?? 0.7, seed = o.seed ?? 201, prog = clamp(o.progress ?? 1), strands = o.strands ?? 1;
    const lines = o.lines || [[...(o.from || [300, 420]), ...(o.to || [980, 420])]];
    const beats = o.pulse === false ? [] : fires(c, { on: o.on || 'beat', every: o.every || 2 }, 1.6);
    const halo = glowTex(col), dot = sparkTex(cmix(col, '#fff0e0', 0.6));
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    lines.forEach((ln, li) => {
      const [x0, y0, x1, y1] = ln, ph = h2(li, seed) * TAU, L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const pt = (u, k = 0) => {
        const w = wave * Math.sin(u * PI * 3 - t * 1.3 + ph) * Math.sin(PI * u) + Math.sin(t * 0.7 + ph) * 4 * Math.sin(PI * u);
        const tw = strands > 1 ? wd * 1.3 * Math.sin(u * L * 0.09 + (k * TAU) / strands + t * 0.5) : 0;
        return [lerp(x0, x1, u) + nx * (w + tw), lerp(y0, y1, u) + ny * (w + tw) + sag * 4 * u * (1 - u)];
      };
      const N = 40, snapAge = o.snap != null ? t - o.snap : -1;
      const draw = (pts, alpha) => {
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = ca(col, 0.14 * gl * alpha); g.lineWidth = wd * 6;
        g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = ca(col, alpha); g.lineWidth = wd; g.stroke();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = ca(cmix(col, '#ffffff', 0.5), 0.35 * alpha); g.lineWidth = wd * 0.45; g.stroke();
        g.globalCompositeOperation = 'source-over';
      };
      if (snapAge < 0) {
        for (let k = 0; k < strands; k++) { const pts = []; for (let i = 0; i <= N; i++) pts.push(pt((i / N) * prog, k)); draw(pts, a); }
        if (prog < 1) { const [ex, ey] = pt(prog); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a; g.drawImage(halo, ex - 24, ey - 24, 48, 48); g.drawImage(dot, ex - 8, ey - 8, 16, 16); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        g.globalCompositeOperation = 'lighter';
        for (const e of beats) {
          const u = easeInOut(clamp((t - e.t0) / 1.4));
          if (u >= 1 || u > prog) continue;
          const [bx, by] = pt(u), al = a * Math.sin(PI * u);
          g.globalAlpha = clamp(al * 0.8); g.drawImage(halo, bx - 22, by - 22, 44, 44);
          g.globalAlpha = clamp(al); g.drawImage(dot, bx - 7, by - 7, 14, 14);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      } else {
        // 断线：两截各自回弹、垂落、渐隐
        const sp = o.snapAt ?? 0.5, fade = a * (1 - smooth((snapAge - 1.2) / 1.6));
        if (fade <= 0) return;
        const [bx, by] = pt(sp), drop = (1 - Math.exp(-snapAge * 2.5)), osc = Math.exp(-snapAge * 2.2) * Math.sin(snapAge * 14);
        for (const side of [0, 1]) {
          const [ax, ay] = side ? [x1, y1] : [x0, y0], segL = L * (side ? 1 - sp : sp);
          const hx = ax + (bx - ax) * 0.15, hy = ay + segL * 0.85;
          const ex = lerp(bx, hx, drop) + osc * 20 * (side ? 1 : -1), ey = lerp(by, hy, drop);
          const mx = lerp((ax + bx) / 2, ax + (ex - ax) * 0.35, drop), my = lerp((ay + by) / 2 + sag * 0.5, ay + (ey - ay) * 0.6, drop);
          const pts = [];
          for (let i = 0; i <= 20; i++) { const u = i / 20, iu = 1 - u; pts.push([iu * iu * ax + 2 * u * iu * mx + u * u * ex, iu * iu * ay + 2 * u * iu * my + u * u * ey]); }
          draw(pts, fade);
        }
        if (snapAge < 0.5) {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp((1 - snapAge / 0.5) * a);
          g.drawImage(halo, bx - 50, by - 50, 100, 100);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
          V.sparks(g, c, { x: bx, y: by, t0: o.snap, n: 18, speed: 260, gravity: 500, dur: 0.6, color: col, hot: '#ffe8d8', size: 0.7, seed: seed + 3 });
        }
      }
    });
    g.restore();
  };

  // ---------- 剑气 ----------
  // kind 'crescent'：月牙形剑气飞出（x, y 起点，angle 方向，dist 飞行距离）；'slash'：一道斩线（从 x,y 到 x2,y2）
  // t0 指定，或 on:'down' / 'beat' 踩点发出
  V.swordQi = function (g, c, o = {}) {
    const t = o.time ?? c.t, kind = o.kind || 'crescent', col = o.color || '#a6e2ff', core = o.core || '#ffffff', seed = o.seed ?? 211;
    const dur = o.dur ?? (kind === 'slash' ? 0.9 : 0.85), a = o.alpha ?? 1, wd = o.width ?? 1;
    const ev = o.t0 == null && !o.on ? [{ t0: 0, k: 0, str: 1 }] : fires(c, o, dur);
    const halo = glowTex(col), dot = sparkTex(cmix(col, core, 0.5));
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > dur) continue;
      const sd = seed + e.k * 7;
      const ang = (o.angle ?? 0) + (o.on ? (hash(e.k * 13 + seed) - 0.5) * (o.jitter ?? 0.5) : 0);
      const ox = o.x ?? 300, oy = o.y ?? 360;
      if (kind === 'slash') {
        const x2 = o.x2 ?? ox + Math.cos(ang) * (o.dist ?? 700), y2 = o.y2 ?? oy + Math.sin(ang) * (o.dist ?? 700);
        const rv = easeOut(clamp(age / 0.12)), fa = 1 - smooth((age - 0.12) / (dur - 0.12)), th = (o.r ?? 10) * wd * (1 - 0.6 * smooth(age / dur));
        const ex = lerp(ox, x2, rv), ey = lerp(oy, y2, rv), sx = lerp(ox, x2, smooth((age - 0.1) / (dur * 0.7)) * 0.9), sy = lerp(oy, y2, smooth((age - 0.1) / (dur * 0.7)) * 0.9);
        const L = Math.hypot(ex - sx, ey - sy), an = Math.atan2(ey - sy, ex - sx), nx = -Math.sin(an), ny = Math.cos(an);
        for (const [k, cc, al] of [[3.2, col, 0.18], [1.4, col, 0.55], [0.45, core, 1]]) {
          g.fillStyle = ca(cc, clamp(al * fa * a));
          g.beginPath();
          g.moveTo(sx, sy); g.quadraticCurveTo((sx + ex) / 2 + nx * th * k, (sy + ey) / 2 + ny * th * k, ex, ey);
          g.quadraticCurveTo((sx + ex) / 2 - nx * th * k * 0.3, (sy + ey) / 2 - ny * th * k * 0.3, sx, sy);
          g.fill();
        }
        g.globalAlpha = clamp(fa * a * 0.7); g.drawImage(halo, ex - 60, ey - 60, 120, 120); g.globalAlpha = 1;
        for (let i = 0; i < 16; i++) {
          const u = h2(i, sd), px = lerp(sx, ex, u) + nx * (h2(i, sd + 1) - 0.5) * 30 + Math.cos(an) * age * 80, py = lerp(sy, ey, u) + ny * (h2(i, sd + 1) - 0.5) * 30 + age * age * 160;
          g.globalAlpha = clamp(fa * a * (0.4 + 0.6 * h2(i, sd + 2))); const r = 2 + 3 * h2(i, sd + 3); g.drawImage(dot, px - r, py - r, r * 2, r * 2);
        }
        g.globalAlpha = 1;
        continue;
      }
      const R0 = (o.r ?? 150) * (0.7 + 0.3 * (e.str ?? 1)), dist = o.dist ?? 900, span = o.span ?? 2.3;
      const fa = Math.pow(1 - age / dur, 1.2) * a;
      // 残影：紧跟在后面的几道细月牙，连成一抹拖影
      for (let gh = 7; gh >= 0; gh--) {
        const aa = age - gh * 0.018;
        if (aa < 0) continue;
        const p = easeOut(clamp(aa / dur)), cx = ox + Math.cos(ang) * dist * p, cy = oy + Math.sin(ang) * dist * p;
        const R = R0 * (0.65 + 0.55 * p), th = R * 0.24 * (1 - 0.5 * p) * wd;
        const k = gh ? 0.4 * (1 - gh / 8) : 1;
        const ix = cx - Math.cos(ang) * th, iy = cy - Math.sin(ang) * th;
        const layers = gh ? [[0.55, cmix(col, core, 0.3), 0.45]] : [[1.25, col, 0.22], [1, col, 0.6], [0.55, core, 0.95]];
        for (const [lw, cc, al] of layers) {
          g.fillStyle = ca(cc, clamp(al * fa * k));
          g.beginPath();
          g.arc(cx, cy, R, ang - span / 2, ang + span / 2);
          g.arc(ix, iy, R * (1 - 0.06 * lw) + th * (lw - 1) * -0.6, ang + span / 2 * (0.92 + 0.05 * lw), ang - span / 2 * (0.92 + 0.05 * lw), true);
          g.closePath(); g.fill();
        }
        if (!gh) {
          g.globalAlpha = clamp(fa * 0.6); g.drawImage(halo, cx + Math.cos(ang) * R * 0.8 - R * 0.8, cy + Math.sin(ang) * R * 0.8 - R * 0.8, R * 1.6, R * 1.6); g.globalAlpha = 1;
          // 速度线与剥落的光屑
          g.strokeStyle = ca(col, clamp(0.4 * fa)); g.lineWidth = 1.2;
          g.beginPath();
          for (let i = 0; i < 12; i++) {
            const an = ang + (h2(i, sd) - 0.5) * span * 0.9, rr = R * (0.85 + 0.2 * h2(i, sd + 1)), bx = cx + Math.cos(an) * rr, by = cy + Math.sin(an) * rr, l = 40 + 120 * h2(i, sd + 2);
            g.moveTo(bx, by); g.lineTo(bx - Math.cos(ang) * l, by - Math.sin(ang) * l);
          }
          g.stroke();
          for (let i = 0; i < 18; i++) {
            const an = ang + (h2(i, sd + 5) - 0.5) * span, rr = R * (0.9 + 0.15 * h2(i, sd + 6)), back = 30 + 90 * h2(i, sd + 7) * p;
            const px = cx + Math.cos(an) * rr - Math.cos(ang) * back, py = cy + Math.sin(an) * rr - Math.sin(ang) * back + age * 40;
            g.globalAlpha = clamp(fa * (0.4 + 0.6 * h2(i, sd + 8))); const r = 1.5 + 3 * h2(i, sd + 9); g.drawImage(dot, px - r, py - r, r * 2, r * 2);
          }
          g.globalAlpha = 1;
        }
      }
    }
    g.restore();
  };

  // ---------- 调色 ----------
  // 每个预设两三层全屏混合，只用纯色填充（软件渲染下渐变与放大贴图很贵）：
  // fill 纯色；v 竖向渐变，用 24 条纯色横带拼出来。multiply 压暗染色、screen 提亮暗部
  const GRADES = {
    autumn: [['multiply', 'v', ['#ffcf94', '#ffc07a', '#e48e58'], 0.6], ['screen', 'fill', '#4a2208', 0.32]],
    dusk: [['multiply', 'v', ['#a8a0e0', '#eab0c0', '#ffbc8a'], 0.55], ['screen', 'v', ['#1a1438', '#2a1430', '#3a1a10'], 0.4]],
    night: [['multiply', 'v', ['#5668b8', '#6c7ec4', '#4a5698'], 0.6], ['screen', 'fill', '#0a1434', 0.4]],
    storm: [['multiply', 'v', ['#7a8a9c', '#909eac', '#6a7a88'], 0.6], ['screen', 'fill', '#18242c', 0.45]],
    snow: [['multiply', 'v', ['#d4e2ff', '#eef4ff', '#c4d2ec'], 0.5], ['screen', 'fill', '#34445c', 0.32]],
    blood: [['multiply', 'v', ['#ff8478', '#ffa290', '#d84444'], 0.62], ['screen', 'fill', '#3a0408', 0.3]],
    gold: [['multiply', 'v', ['#ffe4a8', '#ffd488', '#e8a860'], 0.55], ['screen', 'fill', '#3a2000', 0.3]],
    dream: [['screen', 'v', ['#4a3058', '#3e2c50', '#2c2c5e'], 0.42], ['multiply', 'v', ['#fff0f8', '#fbe8f6', '#e8e0ff'], 0.5]],
  };
  const BANDS = 24;
  const bandMemo = new Map();
  function bands(cols) {
    const key = cols.join(',');
    let b = bandMemo.get(key);
    if (!b) {
      b = [];
      for (let i = 0; i < BANDS; i++) {
        const u = (i + 0.5) / BANDS, f = u * (cols.length - 1), j = Math.min(cols.length - 2, Math.floor(f));
        b.push(cmix(cols[j], cols[j + 1], f - j));
      }
      bandMemo.set(key, b);
    }
    return b;
  }
  // grade(g, preset, amount=1)：在屏幕空间叠加调色，不受镜头推拉影响；也接受 grade(g, c, preset, amount)
  V.grade = function (g, preset, amt, extra) {
    if (preset && typeof preset === 'object') { preset = amt; amt = extra; }
    const P = GRADES[preset];
    if (!P) return;
    const k = clamp(amt ?? 1);
    if (k <= 0.001) return;
    const cw = g.canvas.width, ch = g.canvas.height;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const [op, type, val, al] of P) {
      g.globalCompositeOperation = op;
      g.globalAlpha = clamp(al * k);
      if (type === 'fill') { g.fillStyle = val; g.fillRect(0, 0, cw, ch); continue; }
      const b = bands(val);
      for (let i = 0; i < BANDS; i++) {
        const y0 = Math.round((i * ch) / BANDS), y1 = Math.round(((i + 1) * ch) / BANDS);
        g.fillStyle = b[i]; g.fillRect(0, y0, cw, y1 - y0);
      }
    }
    g.restore();
  };
  V.GRADES = Object.keys(GRADES);
  V.util = { surge, fires, table, Mx, setL, putR, reset, glowTex, sparkTex, bokehTex, flakeTex, petalTex, soft, ca, cmix, wrap };

  // ---------- 预览镜头 ----------
  if (!XYT.registerShot) return;
  const shot = (id, def) => XYT.registerShot('kit_vfx_' + id, Object.assign({ zone: 'bottom', text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6' }, def));
  const E = () => XYT.env, F = () => XYT.fig;
  const t0Of = (c, s) => c.t - c.lt + s;   // 镜头内第 s 秒对应的歌曲时间

  // 客栈：窗里斜进来的光柱与浮尘（岁月难得沉默）
  shot('rays', {
    name: '特效·光柱浮尘', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t;
      E().candleRoom(g, { t, burn: 0.6, sky: 'dawn', winX: 760, candleX: 330 });
      V.godRays(g, c, { x: 1000, y: 150, angle: 2.42, spread: 0.5, n: 11, len: 1350, color: '#ffdcaa', alpha: 0.28, srcR: 300, motes: 130 });
      F().draw(g, 'xiaoyao', 640, 660, 1.45, t, { stage: 'old', pose: 'lookBack', facing: 1, rim: '#ffd9a8', wind: 0.08 });
      V.dust(g, c, { n: 40, area: [0, 0, W, H], alpha: 0.35, size: [1, 3], seed: 9 });
      V.grade(g, 'autumn', 0.7);
    },
  });

  // 桃林：远近两层落英、光斑、粉蝶（仙灵岛）
  shot('peach', {
    name: '特效·桃林落英', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().sky(g, { top: '#9fb4d8', mid: '#f4d6dc', bottom: '#fbe8e0', y1: 520, haze: '#fff0f0', hazeY: 520 });
      E().sun(g, { x: 980, y: 140, r: 34, color: '#fff0d8', glow: 0.35 });
      E().mountains(g, { t: lt, n: 2, far: '#c6bccf', near: '#a497ae', y0: 470, y1: 500, fog: '#fbe6e6', fogA: 0.4, scale: 0.4 });
      g.fillStyle = K.lin(g, 0, 500, 0, H, [[0, '#cfd6b0'], [1, '#8f9c72']]); g.fillRect(-40, 498, W + 80, 240);
      E().peachTree(g, { x: 170, y: 640, s: 1.2, t, fall: 0 });
      E().peachTree(g, { x: 1130, y: 600, s: 0.9, t, fall: 0, alpha: 0.9 });
      V.godRays(g, c, { x: 980, y: 140, angle: 2.25, spread: 0.6, n: 7, color: '#ffe8d0', alpha: 0.12, source: false });
      V.petals(g, c, { kind: 'peach', n: 70, layer: 'back' });
      F().draw(g, 'linger', 660, 640, 1.25, t, { pose: 'dance', wind: 0.6, rim: '#fff4e6' });
      V.butterflies(g, c, { n: 5, area: [380, 300, 1000, 560], size: [12, 22], colors: [['#fff2f6', '#e88aa8'], ['#fff6dc', '#e2a85a']], glow: 0.4, trail: 0.6 });
      V.petals(g, c, { kind: 'peach', n: 70, layer: 'front' });
      V.bokeh(g, c, { n: 14, colors: ['#ffd8e2', '#fff2e0'], alpha: 0.22 });
      V.grade(g, 'dream', 0.4);
    },
  });

  // 秋：红枫一片片落，雁阵南飞（也随枫叶一片片落）
  shot('maple', {
    name: '特效·枫叶雁阵', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().sky(g, { top: '#6d84ad', mid: '#eab890', bottom: '#f8d8a8', y1: 470, haze: '#ffe2bc', hazeY: 470 });
      E().sun(g, { x: 880, y: 330, r: 44, color: '#f2803e', glow: 0.85 });
      E().mountains(g, { t: lt, n: 2, far: '#b9a2a2', near: '#8f7676', y0: 440, y1: 470, fog: '#f4d8bc' });
      E().grassRoad(g, { t, y: 465, wind: 0.6, light: '#ffcf96' });
      E().mapleTree(g, { x: 1140, y: 700, s: 1.3, t, fall: 0 });
      V.birds(g, c, { kind: 'v', y: 190, x: 300, speed: 40, size: 1.1, color: '#3a2a2a', alpha: 0.8 });
      V.birds(g, c, { kind: 'flock', n: 6, y: 250, x: 700, speed: 30, size: 0.6, color: '#5a4040', alpha: 0.6, seed: 9 });
      F().draw(g, 'xiaoyao', 470, 600, 0.95, t, { pose: 'walk', wind: 0.55, rim: '#ffcf96' });
      V.petals(g, c, { kind: 'maple', n: 55, wind: 46 });
      V.grade(g, 'autumn', 0.75);
    },
  });

  // 雪：后半段白雪自下而上染红，红雪化作花瓣（泪干血盈眶涌 白雪纷飞都成红）
  shot('snow', {
    name: '特效·白雪都成红', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt, red = smooth((lt - 2) / 7);
      E().sky(g, { top: '#141c34', mid: '#46587e', bottom: '#9daac2', y1: 470 });
      E().moon(g, { x: 960, y: 150, r: 42, color: '#eef0f6', haze: '#9fb6e8', glow: 0.5 });
      E().mountains(g, { t: lt, n: 3, far: '#76849f', near: '#3c4964', y0: 430, y1: 476, fog: '#c2cde0', fogA: 0.5, rim: '#e8eef8' });
      E().snowfield(g, { t, y: 470, color: '#c8d2e4', shade: '#6f7fa0' });
      V.snow(g, c, { n: 230, red, redKind: 'petal', layer: 'back' });
      F().draw(g, 'xiaoyao', 620, 640, 1.3, t, { stage: 'old', pose: 'kneel', wind: 0.4, rim: '#e8eef8' });
      V.snow(g, c, { n: 230, red, redKind: 'petal', layer: 'front' });
      V.grade(g, 'snow', 1 - red * 0.8);
      V.grade(g, 'blood', red * 0.7);
    },
  });

  // 红蒲公英：鼎湖峰下，红絮迎着逆光飞起
  shot('fluff', {
    name: '特效·红絮漫天', night: false, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 520;
      E().sky(g, { top: '#6f8fb8', mid: '#e8d2c0', bottom: '#f8dcc0', y1: hz, haze: '#fff0dc', hazeY: hz });
      E().sun(g, { x: 360, y: 230, r: 34, color: '#ffe0b0', glow: 0.45 });
      E().mountains(g, { t: lt, n: 2, far: '#b2b8c8', near: '#7e8496', y0: hz - 20, y1: hz, fog: '#f4e6da', fogA: 0.4, scale: 0.45 });
      E().stonePeak(g, { x: 900, y: hz + 6, h: 430, w: 136, color: '#5f584c', light: '#f6dcb0', t: lt, mist: '#f6efe6' });
      g.fillStyle = K.lin(g, 0, hz, 0, H, [[0, '#b2a68a'], [1, '#6a5a44']]); g.fillRect(-40, hz - 2, W + 80, 240);
      V.godRays(g, c, { x: 360, y: 230, angle: 0.75, spread: 1.4, n: 9, color: '#ffd8b0', alpha: 0.1, len: 1300, source: false });
      V.fluff(g, c, { n: 80, layer: 'back' });
      F().draw(g, 'linger', 600, 660, 1.3, t, { pose: 'lookBack', wind: 0.7, rim: '#ffe6c0' });
      V.fluff(g, c, { n: 80, layer: 'front' });
      V.bokeh(g, c, { n: 10, colors: ['#ff9a8a', '#ffd8c0'], alpha: 0.2, size: [30, 90] });
    },
  });

  // 荷塘月夜：萤火、灵光、水面涟漪踩拍
  shot('pond', {
    name: '特效·荷塘萤火', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 452;
      E().sky(g, { top: '#0c1530', mid: '#25365e', bottom: '#4a5b80', y1: hz, haze: '#7c8fb8', hazeY: hz, hazeA: 0.4 });
      E().stars(g, { t, n: 90, maxY: 330, seed: 4 });
      E().moon(g, { x: 880, y: 140, r: 54, color: '#f4e7c4', glow: 0.55 });
      const back = (q) => E().mountains(q, { t: lt, n: 2, far: '#3a4a72', near: '#26314f', y0: 430, y1: 452, scale: 0.4, light: '#9fb0d8' });
      back(g);
      E().water(g, { y: hz, t, top: '#34466e', bottom: '#0b1226', reflectFn: back, reflect: 0.6, glint: { x: 880, color: '#f6e6bd', w: 30, a: 0.5 } });
      V.ripples(g, c, { on: 'beat', area: [200, 520, 1080, 680], r: 110, color: '#dfe8ff', alpha: 0.55 });
      for (const [x, y, s, op, sd] of [[180, 650, 1.4, 1, 1], [400, 700, 1.1, 0.5, 2], [930, 670, 1.25, 0.85, 3]])
        E().lotus(g, { x, y, s, open: op, t, seed: sd, leaves: 3, glow: 0.6, leafColor: '#22423e' });
      V.glowOrbs(g, c, { mode: 'float', n: 6, area: [200, 200, 1080, 420], colors: ['#bfe8ff', '#ffe6b0', '#d8c8ff'], size: 6, trail: 6 });
      V.fireflies(g, c, { n: 40, area: [0, 380, W, H] });
      V.grade(g, 'night', 0.5);
    },
  });

  // 彩依化蝶：病榻前烛影摇红，身影化作漫天彩蝶飞出窗外
  shot('butterfly', {
    name: '特效·化蝶', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt, fade = smooth((lt - 1.5) / 3);
      E().candleRoom(g, { t, burn: 0.7, sky: 'night', winX: 720, candleX: 300 });
      F().draw(g, 'caiyi', 560, 640, 1.4, t, { pose: 'reach', wind: 0.5, alpha: 1 - fade * 0.9, glow: 0.3 + fade * 0.6, glowColor: '#ffe2a0', rim: '#ffe2b0' });
      V.butterflies(g, c, { n: 22, from: { x: 560, y: 520, t0: t0Of(c, 1.5), dur: 4.5, stagger: 3, w: 70, h: 200 }, area: [600, 60, 1180, 460], size: [10, 26], glow: 0.7, trail: 0.8 });
      V.smoke(g, c, { kind: 'incense', x: 140, y: 560, h: 260, n: 2, alpha: 0.4 });
      V.grade(g, 'dusk', 0.45);
    },
  });

  // 雷雨：湖面急雨、紫电劈落、雨点涟漪（决战）
  shot('storm', {
    name: '特效·雷雨', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 470;
      E().sky(g, { top: '#0b0d18', mid: '#232a40', bottom: '#3c4258', y1: hz });
      E().clouds(g, { t, y: 120, color: '#3a4260', shade: '#141828', alpha: 0.9, scale: 1.2, n: 6, seed: 13, speed: 14 });
      const lv = V.lightning(g, c, { on: 'down', chance: 0.6, x0: 300, x1: 1000, y1: hz, color: '#c8b6ff' });
      E().mountains(g, { t: lt, n: 2, far: '#2a3048', near: '#141820', y0: hz - 20, y1: hz, scale: 0.5, light: lv > 0.1 ? '#c8b6ff' : '#4a5470' });
      E().water(g, { y: hz, t, top: '#2a3046', bottom: '#080a12' });
      V.ripples(g, c, { rain: 26, area: [0, 490, W, H], r: 26, life: 0.9, rings: 2, alpha: 0.4, color: '#c6d2e6' });
      F().draw(g, 'xiaoyao', 640, 610, 1.3, t, { pose: 'swordUp', wind: 0.8, rim: lv > 0.05 ? '#e2d8ff' : '#6a7aa0' });
      V.rain(g, c, { n: 300, angle: 0.22, ground: 500, alpha: 0.5 });
      V.grade(g, 'storm', 0.8);
      if (lv > 0.01) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(200,190,255,${(lv * 0.12).toFixed(3)})`; g.fillRect(0, 0, W, H); g.restore(); }
    },
  });

  // 剑气：锁妖塔前月牙剑气踩强拍飞出，一字斩、火花与余烬
  shot('sword', {
    name: '特效·剑气', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().sky(g, { top: '#070a14', mid: '#1a1e34', bottom: '#40303c', y1: 650 });
      E().moon(g, { x: 300, y: 150, r: 40, color: '#e8e4f0', haze: '#6a7ab8', glow: 0.45 });
      E().tower(g, { x: 900, y: 650, h: 520, t, rim: '#9fb6e0' });
      g.fillStyle = K.lin(g, 0, 630, 0, H, [[0, '#14121a'], [1, '#060508']]); g.fillRect(-40, 630, W + 80, 100);
      V.embers(g, c, { n: 60, y: H + 10, rise: 600, color: '#ff6a3a' });
      F().draw(g, 'xiaoyao', 330, 660, 1.3, t, { pose: 'swordPoint', wind: 0.7, rim: '#a6e2ff' });
      V.swordQi(g, c, { on: 'down', x: 470, y: 470, angle: -0.12, dist: 800, r: 140 });
      V.swordQi(g, c, { kind: 'slash', t0: [t0Of(c, 2.2), t0Of(c, 7.8)], x: 520, y: 260, x2: 1180, y2: 560, color: '#ffd0a0' });
      V.sparks(g, c, { on: 'down', x: 470, y: 470, angle: -0.2, spread: 1.6, n: 36 });
      V.grade(g, 'blood', 0.45);
    },
  });

  // 梦方破：一轮装着往事的光镜，先裂后碎
  const dreamImg = () => S('demo-dream', 320, 320, 0.8, (g) => {
    g.save(); g.beginPath(); g.arc(160, 160, 158, 0, TAU); g.clip();
    g.fillStyle = K.lin(g, 0, 0, 0, 320, [[0, '#f6c6d4'], [0.6, '#fbe6e0'], [1, '#d8b0c0']]); g.fillRect(0, 0, 320, 320);
    A.drawMountain(g, XYT.sprites.mtn.far[0], '#b896ac', 0.7, 300, 250, 0.5);
    A.drawMountain(g, XYT.sprites.mtn.mid[0], '#8a6a84', 0.8, 900, 300, 0.4);
    A.maiden(g, 170, 290, 0.8, 1, { color: '#4a3048', scarf: 'rgba(255,230,240,0.9)' });
    A.glow(g, 230, 90, 70, '#ffffff', 0.6);
    g.restore();
    g.strokeStyle = 'rgba(255,240,250,0.9)'; g.lineWidth = 3; g.beginPath(); g.arc(160, 160, 157, 0, TAU); g.stroke();
  });
  shot('shatter', {
    name: '特效·梦碎', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t;
      E().sky(g, { top: '#080812', mid: '#1c1830', bottom: '#2c2238' });
      E().stars(g, { t, n: 80, maxY: 700, seed: 6 });
      K.lighter(g, () => A.glow(g, 640, 330, 300, '#d8a8ff', 0.25));
      V.shatter(g, c, { x: 640, y: 320, r: 170, n: 42, img: dreamImg(), t0: t0Of(c, 4.2), crack: 2, dur: 3.2, kind: 'light', color: '#ffd8ec', force: 300, gravity: 200 });
      F().draw(g, 'xiaoyao', 640, 700, 1.0, t, { pose: 'reach', wind: 0.5, rim: '#e8c8ff' });
      V.glowOrbs(g, c, { mode: 'float', n: 8, colors: ['#ffd8ec', '#d8c8ff'], size: 4, area: [200, 100, 1080, 600], trail: 4 });
      V.grade(g, 'dream', 0.4);
    },
  });

  // 时光漩涡：女娲庙里金光转动，逍遥被卷回十年前
  shot('vortex', {
    name: '特效·时光漩涡', night: true, bloom: 0.6,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().temple(g, { t, layer: 'back' });
      g.fillStyle = 'rgba(6,4,10,0.45)'; g.fillRect(0, 0, W, H);
      V.timeVortex(g, c, { x: 640, y: 330, r: 460, amount: smooth(lt / 3), tilt: 0.7 });
      F().draw(g, 'xiaoyao', 640, 640, 1.1, t, { pose: 'fall', wind: 0.9, rim: '#ffe2a0', glow: 0.3, glowColor: '#ffd88a' });
      V.glowOrbs(g, c, { x: 640, y: 520, r: 220, tilt: 0.3, n: 5, size: 9 });
      V.smoke(g, c, { kind: 'incense', x: 210, y: 640, h: 300, n: 3, alpha: 0.35, color: '#f0d8b0' });
      V.smoke(g, c, { kind: 'incense', x: 1070, y: 640, h: 300, n: 3, alpha: 0.35, color: '#f0d8b0', seed: 9 });
      V.grade(g, 'gold', 0.6);
    },
  });

  // 墨晕：宣纸上每个强拍晕开一朵墨，水中墨如烟，素绸飘过
  shot('ink', {
    name: '特效·墨晕飘带', night: false, bloom: 0.2,
    draw(g, c) {
      const t = c.t;
      E().sky(g, { top: '#efe6d4', mid: '#f4ecdc', bottom: '#e6dcc6' });
      V.inkBloom(g, c, { on: 'down', area: [200, 140, 1080, 560], r: 200, hold: 5 });
      V.inkBloom(g, c, { kind: 'water', x: 1040, y: 220, t0: t0Of(c, 0.3), r: 180, dur: 5, fade: 6, color: '#2a2630' });
      V.ribbons(g, c, { n: 2, y: 470, amp: 70, width: 26, colors: ['#e8d8c0', '#c8d6e0'], alpha: 0.85, glow: 0 });
      V.petals(g, c, { kind: 'plum', n: 26, size: [6, 18], seed: 3 });
      V.birds(g, c, { kind: 'pair', y: 200, x: 0, speed: 60, size: 1.1, color: '#2a2628', glow: '#fff4e0' });
      A.seal(g, 1180, 640, 54, '逍遥');
    },
  });

  // 红线：两人之间的命运丝线，光珠踩拍流过，末段崩断
  shot('threads', {
    name: '特效·红线', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().sky(g, { top: '#1a1630', mid: '#5a3a5a', bottom: '#d08070', y1: 560, haze: '#f0a080', hazeY: 560 });
      E().mountains(g, { t: lt, n: 2, far: '#5a4060', near: '#2a1e30', y0: 520, y1: 560, scale: 0.4 });
      g.fillStyle = K.lin(g, 0, 556, 0, H, [[0, '#2a1e28'], [1, '#100a10']]); g.fillRect(-40, 556, W + 80, 200);
      F().draw(g, 'xiaoyao', 330, 660, 1.2, t, { pose: 'reach', wind: 0.4, rim: '#ffb0a0' });
      F().draw(g, 'linger', 950, 660, 1.2, t, { pose: 'reach', facing: -1, wind: 0.4, windDir: -1, rim: '#ffb0a0' });
      V.threads(g, c, { from: [395, 520], to: [885, 520], sag: 50, progress: smooth(lt / 2), snap: t0Of(c, 7.2), strands: 2 });
      V.threads(g, c, { lines: [[0, 120, 1280, 260], [0, 300, 1280, 160]], width: 0.8, alpha: 0.35, glow: 0.4, sag: 30, pulse: false, seed: 7 });
      V.petals(g, c, { kind: 'plum', n: 34, seed: 8, wind: 20 });
      V.grade(g, 'dusk', 0.5);
    },
  });

  // 泪：近景侧脸剪影（灵儿），一滴泪顺着脸颊滑落；窗前残烛
  const profile = (g) => {
    g.moveTo(468, 176); g.bezierCurveTo(540, 150, 604, 178, 618, 232); g.quadraticCurveTo(624, 256, 628, 268);
    g.quadraticCurveTo(632, 280, 630, 290); g.quadraticCurveTo(648, 318, 664, 334); g.quadraticCurveTo(666, 344, 650, 350);
    g.quadraticCurveTo(654, 360, 652, 366); g.quadraticCurveTo(646, 372, 648, 376); g.quadraticCurveTo(654, 386, 644, 394);
    g.quadraticCurveTo(640, 420, 618, 432); g.quadraticCurveTo(596, 442, 578, 446); g.quadraticCurveTo(574, 470, 584, 510);
  };
  shot('tear', {
    name: '特效·泪与残烛', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t;
      E().sky(g, { top: '#100a0c', mid: '#20141a', bottom: '#2a1812' });
      V.bokeh(g, c, { n: 16, colors: ['#ffb060', '#ff8a4a', '#ffd8a0'], alpha: 0.24, size: [30, 110], drift: 4 });
      // 长发
      const sw = Math.sin(t * 0.8) * 10;
      g.fillStyle = '#0e0a0c';
      g.beginPath(); g.moveTo(470, 170); g.bezierCurveTo(380, 180, 360, 300, 380, 420); g.bezierCurveTo(396, 540, 340 + sw, 640, 300 + sw * 1.6, 730);
      g.lineTo(560, 730); g.bezierCurveTo(520, 600, 470, 470, 476, 330); g.closePath(); g.fill();
      // 侧脸、颈、发髻
      g.fillStyle = '#16100f';
      g.beginPath(); profile(g); g.lineTo(600, 730); g.lineTo(420, 730); g.bezierCurveTo(440, 560, 420, 380, 430, 280); g.bezierCurveTo(436, 220, 446, 186, 468, 176); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(452, 168, 52, 40, -0.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(500, 150, 30, 22, 0.3, 0, TAU); g.fill();
      // 轮廓光与发簪
      g.save(); g.globalCompositeOperation = 'lighter';
      g.strokeStyle = 'rgba(255,168,96,0.6)'; g.lineWidth = 2;
      g.beginPath(); profile(g); g.stroke();
      g.strokeStyle = 'rgba(255,168,96,0.28)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(500, 128); g.quadraticCurveTo(540, 134, 556, 168); g.stroke();
      A.glow(g, 418, 140, 18, '#ffd9a0', 0.8);
      g.restore();
      g.fillStyle = '#e0c070'; g.beginPath(); g.arc(418, 140, 3.2, 0, TAU); g.fill();
      V.tear(g, c, { x: 618, y: 296, s: 2.2, len: 128, angle: -0.06, loop: 5, color: '#ffe6cc' });
      // 残烛（自绘烛身，火焰用 V.flame）
      const cx = 1010, cy = 650, ch = 96;
      g.fillStyle = K.lin(g, cx - 14, 0, cx + 14, 0, [[0, '#8a6a58'], [0.4, '#e8d6c0'], [1, '#6a4a3a']]);
      g.fillRect(cx - 14, cy - ch, 28, ch);
      g.beginPath(); g.ellipse(cx, cy - ch, 14, 4.5, 0, 0, TAU); g.fillStyle = '#f2e2cc'; g.fill();
      g.fillStyle = '#d8c4aa'; g.beginPath(); g.moveTo(cx + 6, cy - ch); g.quadraticCurveTo(cx + 9, cy - ch + 30, cx + 7, cy - ch + 44); g.arc(cx + 7, cy - ch + 44, 3, 0, PI); g.quadraticCurveTo(cx + 3, cy - ch + 20, cx + 2, cy - ch); g.fill();
      g.fillStyle = '#2a1a12'; g.beginPath(); g.ellipse(cx, cy + 2, 40, 9, 0, 0, TAU); g.fill();
      V.flame(g, c, { x: cx, y: cy - ch - 4, s: 1.3, burn: 0.65, wind: 0.08 });
      V.smoke(g, c, { kind: 'incense', x: cx + 2, y: cy - ch - 40, h: 260, n: 1, alpha: 0.2 });
      V.embers(g, c, { n: 14, x0: cx - 30, x1: cx + 30, y: cy - ch - 20, rise: 240, speed: 36, size: [0.8, 2] });
    },
  });

  // 花瓣样张：桃、梅、枫、莲各一列
  shot('petals', {
    name: '特效·花瓣四式', night: false, bloom: 0.3,
    draw(g, c) {
      const kinds = [['peach', '#f4dde2', '#c9a8b4'], ['plum', '#2a2830', '#151419'], ['maple', '#e8cfa8', '#9a7a5a'], ['lotus', '#21334a', '#0e1626']];
      kinds.forEach(([k, c1, c2], i) => {
        g.save(); g.beginPath(); g.rect(i * 320, 0, 320, H); g.clip();
        g.fillStyle = K.lin(g, 0, 0, 0, H, [[0, c1], [1, c2]]); g.fillRect(i * 320, 0, 320, H);
        V.petals(g, c, { kind: k, n: 34, area: [i * 320 - 40, -60, i * 320 + 360, H + 40], seed: 20 + i, wind: 14 });
        g.restore();
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(i * 320 + 8, 8, 100, 28);
        g.fillStyle = '#fff'; g.font = '18px sans-serif'; g.textAlign = 'left'; g.fillText(k, i * 320 + 16, 28);
      });
    },
  });

  // 火：拜月祭坛的火盆、火把、烟尘
  shot('fire', {
    name: '特效·火盆烟尘', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E().sky(g, { top: '#0a0814', mid: '#2a1a3a', bottom: '#4a3050' });
      E().stars(g, { t, n: 60, maxY: 400, seed: 12 });
      E().mountains(g, { t: lt, n: 2, far: '#2a2038', near: '#16101e', y0: 600, y1: 640, scale: 0.5, kind: 'karst' });
      g.fillStyle = K.lin(g, 0, 630, 0, H, [[0, '#2a2034'], [1, '#0e0a14']]); g.fillRect(-40, 630, W + 80, 100);
      V.smoke(g, c, { kind: 'puff', x: 640, y: 600, w: 900, n: 14, size: 260, rise: 26, color: '#4a3a50', alpha: 0.4 });
      for (const x of [300, 980]) {
        g.fillStyle = '#1a1214'; g.beginPath(); g.moveTo(x - 70, 560); g.lineTo(x + 70, 560); g.lineTo(x + 40, 610); g.lineTo(x - 40, 610); g.closePath(); g.fill();
        g.fillRect(x - 10, 610, 20, 40); g.fillRect(x - 40, 646, 80, 10);
        V.flame(g, c, { kind: 'fire', x, y: 562, s: 0.9, wind: 0.15, seed: x });
      }
      for (const x of [520, 760]) { g.fillStyle = '#20161a'; g.fillRect(x - 4, 470, 8, 180); V.flame(g, c, { kind: 'torch', x, y: 472, s: 0.6, seed: x + 3 }); }
      F().draw(g, 'baiyue', 640, 660, 1.1, t, { pose: 'summon', rim: '#ff9a5a', glow: 0.3, glowColor: '#8a6cff' });
      V.smoke(g, c, { kind: 'puff', x: 640, y: 560, t0: t0Of(c, 4), n: 16, size: 160, spread: 340, life: 4, color: '#2a2030', alpha: 0.55 });
      V.grade(g, 'night', 0.35);
    },
  });

  // 调色八式：同一画面分成八条，各套一个预设
  shot('grade', {
    name: '特效·调色八式', night: false, bloom: 0.3,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 478;
      E().sky(g, { top: '#5a6c96', mid: '#e0b090', bottom: '#f6dcb0', y1: hz, haze: '#ffe0b8', hazeY: hz });
      E().sun(g, { x: 640, y: 330, r: 40, color: '#f4804a', glow: 0.8 });
      const back = (q) => E().mountains(q, { t: lt, n: 2, far: '#9a8aa0', near: '#6a5c70', y0: 420, y1: hz, scale: 0.45 });
      back(g);
      E().water(g, { y: hz, t, top: '#c09a8a', bottom: '#2a3044', reflectFn: back, reflect: 0.6, glint: { x: 640, color: '#ffc58a', w: 34, a: 0.5 } });
      F().draw(g, 'xiaoyao', 300, 640, 1.1, t, { pose: 'stand', rim: '#ffd0a0' });
      F().draw(g, 'yueru', 980, 640, 1.1, t, { pose: 'stand', facing: -1, rim: '#ffd0a0' });
      V.GRADES.forEach((p, i) => {
        g.save(); g.beginPath(); g.rect(i * 160, 0, 160, H); g.clip();
        V.grade(g, p, 1);
        g.restore();
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(i * 160 + 4, 8, 152, 30);
        g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText(p, i * 160 + 80, 30);
      });
    },
  });
})();
