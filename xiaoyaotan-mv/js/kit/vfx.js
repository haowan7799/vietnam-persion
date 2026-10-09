/* 逍遥叹 · 音乐动画 —— 工具包·特效（XYT.vfx）：光、花、雪、萤、蝶、鸟、雨、雷、墨、火、丝、剑气与调色
 * 全部无状态：粒子位置都是时间与固定种子的函数；近景粒子大、快、虚（预渲染的柔化贴图），远景小、慢、淡。
 * 用法统一为 V.xxx(g, c, opts)，只有 grade(g, preset, amount)。通用选项：seed、alpha、time（默认 c.t）、beat（拍点强度）、blend（发光的混合方式）；
 * 一次性事件用 at（镜头内第几秒，数或数组）或 t0（歌曲时间），都不给时从镜头起点开始；也可 on:'beat'|'down'（加 every、chance）踩点触发；
 * 粒子类可用 layer:'back'|'front' 分人物前后两层画。调用方的 globalAlpha（如 K.alpha 包一层）会乘到所有绘制上。
 * 颜色请保持常量（贴图按颜色缓存，键量化到每通道 5 位）；要动画就改 alpha、red 之类的量。 */
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
  // 贴图缓存用的颜色键：每通道量化到 5 位，动画颜色最多只会建出有限几张贴图
  const qmemo = new Map();
  function qc(c) {
    let v = qmemo.get(c);
    if (v) return v;
    const p = rgb(c), q = (n) => hx((Math.round((clamp(n, 0, 255) * 31) / 255) * 255) / 31);
    v = '#' + q(p[0]) + q(p[1]) + q(p[2]);
    if (qmemo.size > 2000) qmemo.clear();
    qmemo.set(c, v);
    return v;
  }
  const tint = (src, col) => XYT.sprites.tint(src, qc(col));

  // ---------- 通用 ----------
  const wrap = (v, a, b) => { const w = b - a; return a + ((((v - a) % w) + w) % w); };
  const BE = (c, d) => (c.be ? c.be(d) : 0);
  const DE = (c, d) => (c.de ? c.de(d) : 0);
  // 进入特效：保存状态，记下调用方的整体透明度；之后所有透明度都乘上它（K.alpha 包一层即可整体淡化）
  const enter = (g) => { g.save(); return g.globalAlpha; };
  // 镜头起点在特效时钟上的位置（time 给定时跟着平移）
  const start = (c, t) => t - (c.lt ?? 0);
  V.at = (c, s) => c.t - (c.lt ?? 0) + s;   // 镜头内第 s 秒对应的歌曲时间
  // 暗场还是亮场：opts.night，其次镜头的 night 标记，取不到时当暗场。亮场里发光改用 screen，免得冲成灰白
  function isNight(c, o) {
    if (o && o.night != null) return !!o.night;
    if (c.night != null) return !!c.night;
    const sc = c.seg && XYT.scenes && XYT.scenes[c.seg.scene];
    return sc ? sc.night !== false : true;
  }
  const glowOp = (c, o) => o.blend || (isNight(c, o) ? 'lighter' : 'screen');
  // 无状态的阵风：每拍推进 1，拍头快、拍尾缓。乘上幅度，就是粒子被节拍一阵阵推走的位移
  function surge(c, k = 5) {
    const x = c.b ? c.b.x : c.t * 1.2, i = Math.floor(x), f = x - i;
    return i + (1 - Math.exp(-k * f)) / (1 - Math.exp(-k));
  }
  // 触发时刻（特效时钟 t 上）：at 镜头内秒数，或 t0 歌曲时间（数或数组）；或 on = 'beat' | 'down' 取 t 之前最近几拍，every 隔几次一发，chance 按种子抽签
  function fires(c, o, life, t = c.t) {
    if (o.at != null) return (Array.isArray(o.at) ? o.at : [o.at]).map((s, k) => ({ t0: start(c, t) + s, k, str: 1 }));
    if (o.t0 != null) return (Array.isArray(o.t0) ? o.t0 : [o.t0]).map((t0, k) => ({ t0, k, str: 1 }));
    if (!o.on || !c.grid) return [];
    const ev = Math.max(1, o.every || 1), down = o.on === 'down' || o.on === 'bar', dp = c.grid.dp || 0;
    const out = [];
    let i = t === c.t && c.b ? c.b.i : Math.floor(c.grid.pos(t));
    for (let guard = 0; guard < 96 && out.length < 16; guard++, i--) {
      const t0 = c.grid.time(i);
      if (t - t0 > life) break;
      if (down && !c.grid.isDown(i)) continue;
      const idx = down ? Math.round((i - dp) / 4) : i;
      if (((idx % ev) + ev) % ev) continue;
      if (o.chance != null && hash(idx * 7919 + (o.seed || 0) * 31) > o.chance) continue;
      out.push({ t0, k: idx, str: c.grid.strength(i) });
    }
    return out;
  }
  // 一次性特效：什么时刻都没给时，从镜头起点开始
  const once = (c, o, life, t) => (o.at == null && o.t0 == null && !o.on ? [{ t0: start(c, t), k: 0, str: 1 }] : fires(c, o, life, t));
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
  const poly = (g, pts) => { g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };

  // ---------- 贴图 ----------
  const S = (key, w, h, sc, fn) => K.cache('vfx|' + key, w, h, sc, fn);
  // 像素生成：f(u, v) → 不透明度
  function pix(key, w, h, sc, col, f) {
    col = qc(col);
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
  const glowTex = (col) => tint(XYT.sprites.glow, col);
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
  // 光束：从光源向外展开，带放射状的细纹；st 光从光源外多远处才开始（0..1，量化成 0.05 一档）
  const rayTex = (col, st = 0) => pix('ray' + st, 512, 96, 0.5, col, (u, v) => {
    const hw = 0.05 + 0.95 * u, q = (v - 0.5) * 2 / hw, d = Math.abs(q);
    if (d >= 1) return 0;
    const across = Math.pow(Math.cos((d * PI) / 2), 1.5) * (0.72 + 0.28 * noise1(q * 5 + 20, 7));
    return across * smooth((u - st) / (0.1 + 0.1 * st)) * Math.pow(1 - u, 1.25);
  });

  // 每帧复用的低分辨率缓冲：光束、漩涡、烟这类柔而大的东西先画到低分辨率，再一次放大贴回（只省填充，不跨帧保存内容）
  const scr = {};
  function scratch(name, lw, lh, k) {
    const S0 = XYT.sprites.S * k, pw = Math.max(2, Math.ceil(lw * S0)), ph = Math.max(2, Math.ceil(lh * S0));
    let cv = scr[name];
    if (!cv) cv = scr[name] = document.createElement('canvas');
    if (cv.width < pw || cv.height < ph) { cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
    const q = cv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, Math.min(cv.width, pw + 2), Math.min(cv.height, ph + 2));
    return { cv, q, pw, ph, k: S0 };
  }
  // 低分辨率缓冲：区域 [x0,y0,x1,y1]（逻辑坐标），fn(q) 在缓冲里按逻辑坐标作画，之后用 op 贴回 g
  // near：贴回时不做双线性插值（软件渲染下大面积放大贴图，插值占了大半开销；内容本来就很柔时看不出差别）
  function viaScratch(g, name, box, k, op, alpha, fn, near) {
    const x0 = Math.max(box[0], -24), y0 = Math.max(box[1], -24), x1 = Math.min(box[2], W + 24), y1 = Math.min(box[3], H + 24);
    if (x1 <= x0 || y1 <= y0) return;
    const B = scratch(name, x1 - x0, y1 - y0, k);
    B.q.setTransform(B.k, 0, 0, B.k, -x0 * B.k, -y0 * B.k);
    fn(B.q, [B.k, 0, 0, B.k, -x0 * B.k, -y0 * B.k]);
    g.save();
    g.globalCompositeOperation = op; g.globalAlpha = alpha;
    if (near) g.imageSmoothingEnabled = false;
    g.drawImage(B.cv, 0, 0, B.pw, B.ph, x0, y0, B.pw / B.k, B.ph / B.k);
    g.restore();
  }

  // ---------- 丁达尔光 ----------
  // x, y 光源；angle 光束朝向；spread 张角；len 长度；width 粗细倍数；start 光从离光源多远处开始（0..1，比如窗外的太阳只在室内显光）；motes 光中浮尘数量
  V.godRays = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 980, y = o.y ?? -60, ang = o.angle ?? 2.05, spread = o.spread ?? 0.8, n = o.n ?? 9;
    const len = o.len ?? 1250, wd = o.width ?? 1, col = o.color || '#ffe2a8', seed = o.seed ?? 1, beat = o.beat ?? 0.35;
    const st = Math.round(clamp(o.start ?? 0, 0, 0.8) * 20) / 20;
    const GA = enter(g), a = (o.alpha ?? 0.32) * GA, tex = rayTex(col, st);
    const pulse = 1 + beat * (0.45 * BE(c, 0.45) + 0.55 * DE(c, 0.9));
    const beams = [];
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    const ext = (px, py, r) => { bx0 = Math.min(bx0, px - r); bx1 = Math.max(bx1, px + r); by0 = Math.min(by0, py - r); by1 = Math.max(by1, py + r); };
    for (let i = 0; i < n; i++) {
      const hA = h2(i, seed), hB = h2(i, seed + 1), hC = h2(i, seed + 2);
      const th = ang + (hA - 0.5) * spread + 0.03 * Math.sin(t * (0.08 + 0.06 * hB) + i * 1.7);
      const L = len * lerp(0.72, 1.1, hC), ww = len * 0.19 * wd * lerp(0.3, 1.5, hB * hB);
      const fl = 0.4 + 0.6 * noise1(t * (0.16 + 0.12 * hC) + i * 11.3, seed);
      beams.push([th, L, ww, clamp(a * fl * pulse * lerp(1, 0.55, hB))]);
      ext(x + Math.cos(th) * L, y + Math.sin(th) * L, ww * 0.5);
      ext(x + Math.cos(th) * L * st * 0.9, y + Math.sin(th) * L * st * 0.9, ww * 0.5 * st + 2);
    }
    const op = glowOp(c, o);
    if (n) {
      viaScratch(g, 'rays', [bx0, by0, bx1, by1], o.res ?? 0.25, op, 1, (q, m) => {
        q.globalCompositeOperation = 'lighter';
        for (const [th, L, ww, al] of beams) {
          q.globalAlpha = al;
          putR(q, m, tex, x + (Math.cos(th) * L) / 2, y + (Math.sin(th) * L) / 2, L, ww, th);
        }
      }, o.near);
    }
    if (o.source !== false && st < 0.05) {
      const R = o.srcR ?? 220;
      g.globalCompositeOperation = op;
      g.globalAlpha = clamp(a * 1.3 * pulse);
      g.drawImage(glowTex(col), x - R, y - R, R * 2, R * 2);
    }
    g.restore();
    if (o.motes) V.dust(g, c, { n: o.motes, color: o.moteColor || cmix(col, '#ffffff', 0.5), seed: seed + 7, alpha: o.moteAlpha ?? 0.9, beat, time: o.time, blend: o.blend, night: o.night, light: { x, y, angle: ang, spread: spread * 0.85, len: len * 0.85, start: st } });
  };

  // ---------- 浮尘 ----------
  // area [x0,y0,x1,y1]；或 light {x,y,angle,spread,len,start}：浮尘只在光束里，沿光束缓缓漂移，越近光源越亮
  V.dust = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 90, ar = o.area || [0, 0, W, H], col = o.color || '#fff0cf', seed = o.seed ?? 3;
    const sz = o.size || [0.9, 3.8], sp = o.speed ?? 1, beat = o.beat ?? 0.35, L = o.light;
    const GA = enter(g), a = (o.alpha ?? 0.8) * GA;
    const tab = table('dust' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.8), x: h2(i, seed + 1), y: h2(i, seed + 2), f: 0.5 + 1.8 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU, h: h2(i, seed + 5) }));
    const dot = sparkTex(col), halo = glowTex(col), aw = ar[2] - ar[0], ah = ar[3] - ar[1];
    const bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.4);
    g.globalCompositeOperation = glowOp(c, o);
    for (const q of tab) {
      const k = lerp(0.35, 1.4, q.z) * sp;
      const nx = (noise1(t * 0.06 * k + q.p * 3, seed) - 0.5) * 2, ny = (noise1(t * 0.05 * k + q.p * 3 + 40, seed + 1) - 0.5) * 2;
      let x, y, al = a;
      if (L) {
        // 沿光束方向的位置随时间循环（有界），两端淡入淡出
        const ll = L.len ?? 1000, s0 = Math.max(0.08, L.start ?? 0), u = wrap(q.x + t * 0.006 * k * (q.h - 0.35), 0, 1);
        const d = lerp(s0, 1, Math.sqrt(u)) * ll, th = (L.angle ?? 2) + (q.y - 0.5) * (L.spread ?? 0.6);
        x = L.x + Math.cos(th) * d + nx * 50 * k + Math.sin(t * 0.13 * q.f + q.p) * 16;
        y = L.y + Math.sin(th) * d + ny * 40 * k + Math.sin(t * 0.05 * q.f + q.p * 2) * 20;
        const edge = 1 - Math.abs(q.y - 0.5) * 2;
        al *= smooth(edge / 0.5) * lerp(1, 0.35, d / ll) * smooth(u / 0.06) * smooth((1 - u) / 0.1);
      } else {
        x = ar[0] + wrap(q.x * aw + nx * 90 * k + t * 5 * k * (q.h - 0.45), 0, aw);
        y = ar[1] + wrap(q.y * ah + ny * 70 * k - t * 3 * k * (q.h - 0.3), 0, ah);
      }
      // 尘粒翻转时一闪一闪
      al *= (0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin(t * q.f + q.p), 3)) * lerp(0.55, 1, q.z);
      if (hash(q.i * 131 + bi * 977 + seed) < 0.2) al += pulse * 0.8 * GA;
      if (al < 0.012) continue;
      const r = lerp(sz[0], sz[1], q.z);
      if (q.z > 0.82) { g.globalAlpha = clamp(al * 0.5); g.drawImage(halo, x - r * 3, y - r * 3, r * 6, r * 6); }
      else { g.globalAlpha = clamp(al); g.drawImage(dot, x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
    }
    g.restore();
  };

  // ---------- 光斑 ----------
  // 亮场（或 blend:'screen'）里用 screen 叠加并压低透明度；越近越大越淡，免得像镜头上的灰
  V.bokeh = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 22, ar = o.area || [0, 0, W, H], cols = o.colors || ['#ffd9a0', '#ffc2cf', '#fff3da'];
    const night = isNight(c, o), op = glowOp(c, o);
    const GA = enter(g), a = (o.alpha ?? (night ? 0.3 : 0.16)) * GA;
    const sz = o.size || [16, 72], seed = o.seed ?? 5, drift = o.drift ?? 9, rise = o.rise ?? 4, beat = o.beat ?? 0.5;
    const tab = table('bokeh' + seed, n, (i) => ({ z: h2(i, seed), x: h2(i, seed + 1), y: h2(i, seed + 2), ci: Math.floor(h2(i, seed + 3) * 97), f: 0.4 + h2(i, seed + 4), p: h2(i, seed + 5) * TAU }));
    const aw = ar[2] - ar[0], ah = ar[3] - ar[1], bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.5);
    g.globalCompositeOperation = op;
    for (const q of tab) {
      const zz = Math.pow(q.z, 1.4), r = lerp(sz[0], sz[1], zz), k = 0.3 + q.z;
      const x = ar[0] - r + wrap(q.x * (aw + r * 2) + t * drift * k + Math.sin(t * 0.21 * q.f + q.p) * 14, 0, aw + r * 2);
      const y = ar[1] - r + wrap(q.y * (ah + r * 2) - t * rise * k + Math.sin(t * 0.17 * q.f + q.p * 2) * 18, 0, ah + r * 2);
      let al = a * (0.6 + 0.4 * Math.sin(t * 0.6 * q.f + q.p)) * lerp(1, 0.28, zz);
      if (hash(q.i * 13 + bi * 7 + seed) < 0.4) al *= 1 + pulse * 1.4;
      g.globalAlpha = clamp(al);
      g.drawImage(bokehTex(cols[q.ci % cols.length]), x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  };

  // ---------- 花瓣与落叶 ----------
  const PETALS = {
    peach: { cols: [['#ffe6ec', '#f07c98'], ['#ffd0dc', '#de567e'], ['#fff1f4', '#f39ab0']], size: [10, 46], fall: 36, wind: 26, sway: 26, spin: 1.5, flip: 2.2 },
    plum: { cols: [['#fffaf7', '#efb8be'], ['#ffe2e4', '#d24456'], ['#f8c6cc', '#a8182c']], size: [8, 34], fall: 34, wind: 22, sway: 22, spin: 1.8, flip: 2.6 },
    maple: { cols: [['#f8b040', '#c8321c'], ['#f4c64a', '#da5a1c'], ['#ec5a2a', '#8c1610'], ['#d8302a', '#6a0e12']], size: [14, 56], fall: 46, wind: 30, sway: 40, spin: 1.1, flip: 1.6 },
    lotus: { cols: [['#fff9fb', '#f08cb0'], ['#fff3f6', '#e5739c'], ['#ffffff', '#f6b4ca']], size: [16, 60], fall: 28, wind: 18, sway: 34, spin: 0.7, flip: 1.2 },
    // 血瓣：梅瓣的形，深红到暗绛（白雪都成红）
    blood: { cols: [['#c8202e', '#5a0610'], ['#b41826', '#48040c'], ['#d42c36', '#680a14']], size: [8, 32], fall: 34, wind: 22, sway: 22, spin: 1.8, flip: 2.6 },
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
    if (kind === 'plum' || kind === 'blood') {
      const gr = g.createRadialGradient(0, 18, 1, 0, 2, 26);
      gr.addColorStop(0, c2); gr.addColorStop(0.45, cmix(c2, c1, 0.7)); gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(0, 21); g.bezierCurveTo(-23, 19, -25, -16, -6, -20); g.lineTo(0, -15); g.lineTo(6, -20); g.bezierCurveTo(25, -16, 23, 19, 0, 21);
      g.closePath(); g.fill();
      g.strokeStyle = kind === 'blood' ? 'rgba(255,170,160,0.22)' : 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
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
    const P = PETALS[kind], v = vi % P.cols.length, [c1, c2] = P.cols[v];
    return S('petal|' + kind + v + (flower ? 'f' : ''), 64, 64, 1, (g) => drawPetal(g, kind, c1, c2, flower));
  }
  // kind：peach 桃 / plum 梅 / maple 枫 / lotus 莲；layer 'back'|'front' 只画远或近的一半，方便人物前后各画一层
  V.petals = function (g, c, o = {}) {
    const kind = PETALS[o.kind] ? o.kind : 'peach', P = PETALS[kind];
    const t = o.time ?? c.t, n = o.n ?? 60, seed = o.seed ?? 11;
    const sz = o.size || P.size, fall = o.fall ?? P.fall, wind = o.wind ?? P.wind, gust = o.gust ?? 24, sw = o.sway ?? P.sway;
    const ar = o.area || [-40, -60, W + 40, H + 40];
    const zr = o.layer === 'back' ? [0, 0.62] : o.layer === 'front' ? [0.62, 2] : o.z || [0, 2];
    const tab = table('petal' + kind + seed, n, (i) => ({
      z: Math.pow(h2(i, seed), 1.15), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU,
      ci: Math.floor(h2(i, seed + 5) * 60), sp: (h2(i, seed + 6) - 0.5) * 2, fl: 0.6 + h2(i, seed + 7), fw: h2(i, seed + 8) < 0.3,
    }));
    const sur = surge(c, 6) * gust, m = Mx(g), GA = enter(g), a = (o.alpha ?? 1) * GA;
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
    const t = o.time ?? c.t, n = o.n ?? 200, seed = o.seed ?? 21, red = clamp(o.red ?? 0);
    const col = o.color || '#ffffff', rc = o.redColor || '#c41c28', fall = o.fall ?? 50, wind = o.wind ?? 16, gust = o.gust ?? 16;
    const sz = o.size || [1.6, 12], ar = o.area || [-20, -20, W + 20, H + 20], beat = o.beat ?? 0.5;
    const zr = o.layer === 'back' ? [0, 0.7] : o.layer === 'front' ? [0.7, 2] : [0, 2];
    const tab = table('snow' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.25), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU, f: 0.5 + h2(i, seed + 5), h: h2(i, seed + 6) }));
    const fw = flakeTex(col), fr = flakeTex(rc), bw = bokehTex(col), br = bokehTex(rc), spk = sparkTex(cmix(col, '#fff8e8', 0.5)), halo = glowTex(rc);
    const sur = surge(c, 5) * gust, bi = c.b ? c.b.i : 0, glint = beat * BE(c, 0.3), m = Mx(g);
    const GA = enter(g), a = (o.alpha ?? 0.95) * GA;
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
        if (o.redKind === 'petal') {
          // 红雪化瓣：深红的血瓣，近处的失焦
          const vi = q.i % 3, base = petalTex('blood', vi, false), img = near ? soft('petal|blood' + vi, base, 2.6) : base, s = (r * 3 + 3) * (near ? img.pk * 0.8 : 1);
          g.globalAlpha = clamp(al * rr * (near ? 0.8 : 1));
          putR(g, m, img, x, y, s, s, q.p + t * 1.4 * (q.h - 0.5), Math.cos(t * 2 * q.f + q.p));
          reset(g, m);
        } else { g.globalAlpha = clamp(al * rr * (near ? 0.7 : 1)); g.drawImage(rImg, x - d / 2, y - d / 2, d, d); }
        // 只有最近的几片带一点点暗红的晕
        if (q.z > 0.8) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(al * rr * 0.05); g.drawImage(halo, x - r * 3, y - r * 3, r * 6, r * 6);
          g.globalCompositeOperation = 'source-over';
        }
      }
      // 拍点：一部分雪花闪光
      if (glint > 0.02 && q.z > 0.35 && !near && hash(q.i * 7 + bi * 131 + seed) < 0.14) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(glint * GA * (1 - rr * 0.8)); g.drawImage(spk, x - r * 3, y - r * 3, r * 6, r * 6);
        g.globalCompositeOperation = 'source-over';
      }
    }
    g.restore();
  };

  // ---------- 萤火 ----------
  V.fireflies = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 36, ar = o.area || [0, 260, W, H], col = o.color || '#d4f08a', core = o.core || '#fbffe2';
    const seed = o.seed ?? 31, s = o.size ?? 1, beat = o.beat ?? 0.7, trail = o.trail ?? 4, sp = o.speed ?? 1;
    const tab = table('ffly' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.5), a: h2(i, seed + 1) * 100, b: h2(i, seed + 2) * 100, f: 0.6 + 1.2 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU }));
    const halo = glowTex(col), dot = sparkTex(core), aw = ar[2] - ar[0], ah = ar[3] - ar[1], bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.4);
    const pos = (q, tt, k) => [
      ar[0] + (noise1(tt * 0.07 * k * sp + q.a, seed) * 1.5 - 0.25) * aw + Math.sin(tt * 0.8 * q.f + q.p) * 26 * k,
      ar[1] + (noise1(tt * 0.06 * k * sp + q.b, seed + 1) * 1.5 - 0.25) * ah + Math.sin(tt * 1.1 * q.f + q.p * 1.3) * 18 * k,
    ];
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    g.globalCompositeOperation = glowOp(c, o);
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
    c1 = qc(c1); c2 = qc(c2);
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
    const pal = o.colors || BFLY, trail = o.trail ?? 0, F = o.from, sp = o.speed ?? 1, night = isNight(c, o), op = glowOp(c, o);
    const gl = (o.glow ?? 0) * (night ? 1 : 0.45);
    const tab = table('bfly' + seed, n, (i) => ({ z: h2(i, seed), a: h2(i, seed + 1) * 100, b: h2(i, seed + 2) * 100, f: 1.5 + 1.1 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU, ci: Math.floor(h2(i, seed + 5) * 60), h: h2(i, seed + 6) }));
    const aw = ar[2] - ar[0], ah = ar[3] - ar[1], m = Mx(g);
    const path = (q, tt, k) => [ar[0] + (noise1(tt * 0.07 * k * sp + q.a, seed) * 1.4 - 0.2) * aw, ar[1] + (noise1(tt * 0.06 * k * sp + q.b, seed + 1) * 1.4 - 0.2) * ah];
    const GA = enter(g), a = (o.alpha ?? 1) * GA, ft0 = F ? (F.at != null ? start(c, t) + F.at : F.t0 ?? start(c, t)) : 0;
    for (const q of tab) {
      const k = lerp(0.6, 1.3, q.z);
      let s = lerp(sz[0], sz[1], q.z), al = a * lerp(0.7, 1, q.z);
      let [x, y] = path(q, t, k), [x0, y0] = path(q, t - 0.12, k);
      if (F) {
        const age = t - (ft0 + q.h * (F.stagger ?? 1.4));
        if (age < 0) continue;
        const e = easeOut(clamp(age / (F.dur ?? 3.5))), sx = F.x + (q.a % 1 - 0.5) * (F.w ?? 60), sy = F.y + (q.b % 1 - 0.5) * (F.h ?? 120);
        const e0 = easeOut(clamp((age - 0.12) / (F.dur ?? 3.5)));
        x = lerp(sx, x, e); y = lerp(sy, y, e) - Math.sin(e * PI) * 40; x0 = lerp(sx, x0, e0); y0 = lerp(sy, y0, e0) - Math.sin(e0 * PI) * 40;
        al *= smooth(age / 0.5); s *= lerp(0.35, 1, smooth(age / 0.9));
        if (age < 0.6) { g.globalCompositeOperation = op; g.globalAlpha = clamp((1 - age / 0.6) * (night ? 0.7 : 0.35) * a); const R = 30; g.drawImage(glowTex(pal[q.ci % pal.length][0]), sx - R, sy - R, R * 2, R * 2); g.globalCompositeOperation = 'source-over'; }
      }
      const ph = o.sync && c.b ? c.b.x * TAU * 2 + q.p : t * q.f * TAU + q.p;
      const open = 0.12 + 0.88 * Math.abs(Math.cos(ph));
      y += Math.cos(ph) * s * 0.12;
      const hd = Math.atan2(y - y0, x - x0 || 1e-3), rot = 0.55 * Math.sin(hd) * Math.sign(Math.cos(hd) || 1) + (Math.cos(hd) >= 0 ? 0.35 : -0.35);
      const [c1, c2] = o.ink ? ['#2a2630', '#141218'] : pal[q.ci % pal.length];
      if (trail > 0) {
        g.globalCompositeOperation = op;
        const dt = sparkTex(cmix(c1, '#fff6d8', 0.5));
        for (let j = 1; j <= 6; j++) {
          let [px, py] = path(q, t - j * 0.14, k);
          if (F) { const age = t - j * 0.14 - (ft0 + q.h * (F.stagger ?? 1.4)); if (age < 0) break; const e = easeOut(clamp(age / (F.dur ?? 3.5))); px = lerp(F.x, px, e); py = lerp(F.y, py, e) - Math.sin(e * PI) * 40; }
          py += j * j * 1.2;
          const r = s * 0.22 * (1 - j / 8);
          g.globalAlpha = clamp(trail * al * 0.5 * (1 - j / 7)); g.drawImage(dt, px - r * 2, py - r * 2, r * 4, r * 4);
        }
        g.globalCompositeOperation = 'source-over';
      }
      if (gl > 0) { g.globalCompositeOperation = op; g.globalAlpha = clamp(gl * al * 0.32 * (1 + (o.beat ?? 0.6) * BE(c, 0.4))); g.drawImage(glowTex(c1), x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); g.globalCompositeOperation = 'source-over'; }
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
    // 身子：从椭圆的起点落笔，免得多出一道连线
    const ex = x + dir * 0.8 * s, ey = y + 1.2 * s;
    g.moveTo(ex + 4.2 * s, ey);
    g.ellipse(ex, ey, 4.2 * s, 1.5 * s, 0, 0, TAU);
  }
  // 长尾：两条由粗到细的飘带（填充的多边形），随翅膀起伏
  function tailPath(g, x, y, s, dir, t, q, off) {
    const N = 9, L = [], R = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, tx = x - dir * (3 + u * 46) * s;
      const ty = y + 1.5 * s + off * u * 7 * s + Math.sin(t * 3 + q.p - u * 4.2) * u * 6 * s;
      const hw = s * (1.5 * (1 - u) + 0.15) * (1 - 0.6 * u * u);
      L.push([tx, ty - hw]); R.push([tx, ty + hw]);
    }
    poly(g, L);
    for (let j = N; j >= 0; j--) g.lineTo(R[j][0], R[j][1]);
    g.closePath();
  }
  // kind：'flock' 散群 / 'v' 雁阵 / 'pair' 比翼双飞（带长尾）；at / t0 给定时只飞过一次，否则从镜头起点的 x 处出发、循环飞
  // lum 夜里发光的灵鸟（pair 在暗场默认开）；glow 光晕颜色
  V.birds = function (g, c, o = {}) {
    const kind = o.kind || 'flock', t = o.time ?? c.t, seed = o.seed ?? 51, dir = o.dir ?? 1, s0 = o.size ?? 1;
    const n = o.n ?? (kind === 'v' ? 9 : kind === 'pair' ? 2 : 14), sp = o.speed ?? (kind === 'pair' ? 70 : 55);
    const night = isNight(c, o), lum = o.lum ?? (kind === 'pair' && night);
    const col = o.color || (lum ? '#fff0d6' : '#1d1f24'), fog = o.fog || null, y0 = o.y ?? 200, spread = o.spread ?? 380;
    const ev = o.at != null || o.t0 != null ? fires(c, o, 1e9, t) : null, pass = ev && ev.length ? ev[0].t0 : null;
    const cx = pass != null ? (o.x ?? (dir > 0 ? -160 : W + 160)) + dir * sp * (t - pass) : (o.x ?? 0) + dir * sp * (t - start(c, t));
    const tab = table('bird' + kind + seed, n, (i) => ({ z: kind === 'flock' ? h2(i, seed) : 0.5 + 0.5 * (1 - i / n), x: h2(i, seed + 1), y: h2(i, seed + 2), f: 1.7 + 0.9 * h2(i, seed + 3), p: h2(i, seed + 4) * TAU }));
    const loop = pass == null;
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
    const GA = enter(g), a = (o.alpha ?? 0.85) * GA, all = buckets[2].concat(buckets[1], buckets[0]);
    const op = glowOp(c, o);
    // 光晕：小而暖，贴着鸟身
    if (lum || o.glow) {
      const gc = o.glow || '#ffd9a0', gt = glowTex(gc);
      g.globalCompositeOperation = op;
      for (const [x, y, s] of all) { g.globalAlpha = clamp((lum ? 0.26 : 0.2) * a); g.drawImage(gt, x - 12 * s, y - 12 * s, 24 * s, 24 * s); }
      g.globalCompositeOperation = 'source-over';
    }
    for (let L = 0; L < 3; L++) {
      const bk = buckets[L];
      if (!bk.length) continue;
      const fc = fog ? cmix(col, fog, (2 - L) * 0.28) : col;
      if (kind === 'pair') {
        // 长尾先画，暗场用加色叠出流光
        g.globalCompositeOperation = lum ? op : 'source-over';
        g.fillStyle = fc;
        g.globalAlpha = a * (lum ? 0.5 : 0.75);
        g.beginPath();
        for (const [x, y, s, , , q] of bk) for (const off of [-1, 1]) tailPath(g, x, y, s, dir, t, q, off);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      g.fillStyle = fc;
      g.globalAlpha = a * (kind === 'flock' ? 0.55 + 0.22 * L : lum ? 0.9 : 1);
      g.beginPath();
      for (const [x, y, s, ph, glide] of bk) birdPath(g, x, y, s, ph, dir, glide);
      g.fill();
    }
    if (lum || (kind === 'pair' && o.glow)) {
      // 鸟身里一点亮核，尾上闪着细碎的光屑
      const dot = sparkTex(cmix(o.glow || '#ffe8c0', '#ffffff', 0.4));
      g.globalCompositeOperation = op;
      for (const [x, y, s, , , q] of all) {
        g.globalAlpha = clamp(0.8 * a); const rc = 3.2 * s; g.drawImage(dot, x + dir * 0.8 * s - rc, y + 1.2 * s - rc, rc * 2, rc * 2);
        for (let j = 0; j < 7; j++) {
          const u = (j + 0.5) / 7, off = j % 2 ? 1 : -1, tx = x - dir * (3 + u * 46) * s;
          const ty = y + 1.5 * s + off * u * 7 * s + Math.sin(t * 3 + q.p - u * 4.2) * u * 6 * s;
          const tw = 0.5 + 0.5 * Math.sin(t * 7 + j * 2.3 + q.p * 3);
          g.globalAlpha = clamp(a * (1 - u) * tw * 0.9); const r = s * (2.6 - 1.4 * u); g.drawImage(dot, tx - r, ty - r, r * 2, r * 2);
        }
      }
    }
    g.restore();
  };

  // ---------- 飘带 ----------
  // 横贯画面的绸带；anchor [x,y] + angle + len 时从一点飘出。正反面明暗不同，拍点时一道光沿带流过
  V.ribbons = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 3, cols = o.colors || ['#f7c4d2', '#cfe2f6', '#f6e0b0'], seed = o.seed ?? 61;
    const amp = o.amp ?? 80, wd = o.width ?? 24, speed = o.speed ?? 1, tw = o.twist ?? 2.2, beat = o.beat ?? 0.5;
    const segs = o.segs ?? 56, gl = o.glow ?? 0.35, yc = o.y ?? 380, gap = o.spacing ?? 70, x0 = o.x0 ?? -120, x1 = o.x1 ?? W + 120;
    const ampK = 1 + beat * 0.3 * BE(c, 0.5);
    const lastBeat = c.grid && c.b ? c.grid.time(c.b.i) : -99, hl = (t - lastBeat) / 1.1;
    const GA = enter(g), a = (o.alpha ?? 0.82) * GA, op = glowOp(c, o);
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
        P.push([bx0 + ux * u * L + nx * wv, by0 + uy * u * L + ny * wv + sag, wd * 0.5 * taper * (0.12 + 0.88 * Math.abs(face)), face, u, taper]);
      }
      const E1 = [], E2 = [], N1 = [];
      for (let j = 0; j <= segs; j++) {
        const p = P[j], q0 = P[Math.max(0, j - 1)], q1 = P[Math.min(segs, j + 1)];
        let tx = q1[0] - q0[0], ty = q1[1] - q0[1];
        const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        N1.push([-ty, tx]);
        E1.push([p[0] - ty * p[2], p[1] + tx * p[2]]); E2.push([p[0] + ty * p[2], p[1] - tx * p[2]]);
      }
      if (gl > 0) {
        // 光晕就是带子自己的轮廓向外扩一圈：跟着收窄与翻转，侧过来时不会套一层粗管
        g.globalCompositeOperation = op; g.globalAlpha = 1;
        for (const [ext, al] of [[0.34, 0.09], [0.14, 0.12]]) {
          g.fillStyle = ca(col, clamp(gl * al * a));
          g.beginPath();
          for (let j = 0; j <= segs; j++) { const p = P[j], e = p[2] + wd * ext * p[5] * (0.35 + 0.65 * Math.abs(p[3])); j ? g.lineTo(p[0] + N1[j][0] * e, p[1] + N1[j][1] * e) : g.moveTo(p[0] + N1[j][0] * e, p[1] + N1[j][1] * e); }
          for (let j = segs; j >= 0; j--) { const p = P[j], e = p[2] + wd * ext * p[5] * (0.35 + 0.65 * Math.abs(p[3])); g.lineTo(p[0] - N1[j][0] * e, p[1] - N1[j][1] * e); }
          g.closePath(); g.fill();
        }
        g.globalCompositeOperation = 'source-over';
      }
      // 明暗：沿带子方向的线性渐变，每段一个色标（正面亮、有丝光，背面暗；拍点时一道光流过）
      const gr = g.createLinearGradient(bx0, by0, bx0 + ux * L, by0 + uy * L);
      for (let j = 0; j <= segs; j += 2) {
        const f = P[j][3], u = P[j][4];
        let cc = f >= 0 ? cmix(col, '#ffffff', Math.pow(f, 8) * 0.55) : cmix(col, '#2a1e30', 0.08 - f * 0.22);
        if (hl < 1) cc = cmix(cc, '#ffffff', 0.6 * Math.exp(-Math.pow((u - hl) / 0.05, 2)) * (1 - hl));
        gr.addColorStop(u, cc);
      }
      g.globalAlpha = a;
      g.fillStyle = gr;
      g.beginPath();
      E1.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      for (let j = segs; j >= 0; j--) g.lineTo(E2[j][0], E2[j][1]);
      g.closePath(); g.fill();
      g.strokeStyle = ca(cmix(col, '#3a2a30', 0.45), 0.35); g.lineWidth = 0.8;
      g.beginPath(); E1.forEach((p, j) => (j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      g.globalAlpha = GA;
    }
    g.restore();
  };

  // ---------- 墨晕 ----------
  // 宣纸墨晕贴图（白色，逐像素算一次，用时再染色）：中间一片宽而淡的墨，外缘略积墨、带一道淡水痕，轮廓分瓣、边上有纸纤维的毛边
  // part 'full' 整朵；'core' 只有刚落笔时的浓墨芯
  const inkEdge = new Map();
  function inkOutline(v) {
    let E = inkEdge.get(v);
    if (E) return E;
    const sd = 700 + v * 13, NB = 720;
    // 两套轮廓：lo 只有低频的分瓣（内部浓淡用，免得出放射纹），hi 再加细碎的毛边（只管边缘）
    const lo = new Float32Array(NB), hi = new Float32Array(NB);
    let mx = 0;
    for (let i = 0; i < NB; i++) {
      const an = (i / NB) * TAU, cs = Math.cos(an), sn = Math.sin(an);
      const n1 = noise2(cs * 1.4 + 5, sn * 1.4 + 5, sd), n2 = noise2(cs * 4 + 9, sn * 4 + 9, sd + 1), n3 = noise2(cs * 11 + 3, sn * 11 + 3, sd + 2);
      const n4 = noise2(cs * 23 + 7, sn * 23 + 7, sd + 3), fray = smooth((n2 - 0.45) / 0.3);
      lo[i] = 1 + 0.35 * (n1 - 0.5) * 2 + 0.1 * (n2 - 0.5) * 2;
      hi[i] = lo[i] + 0.07 * (n3 - 0.5) * 2 + 0.05 * (n4 - 0.5) * 2 * fray;
      mx = Math.max(mx, hi[i]);
    }
    for (let i = 0; i < NB; i++) { lo[i] *= 0.78 / mx; hi[i] *= 0.78 / mx; }
    E = { lo, hi };
    inkEdge.set(v, E);
    return E;
  }
  // 纸纹与墨色起伏的噪声场：与花样无关（同一张纸），按像素尺寸算一次，三种花样共用
  const fieldMemo = new Map();
  function inkField(pw, ph) {
    const key = pw + 'x' + ph;
    let F = fieldMemo.get(key);
    if (F) return F;
    const n = pw * ph, fib = new Float32Array(n), mot = new Float32Array(n), edge = new Float32Array(n);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const u = (x + 0.5) / pw, w = (y + 0.5) / ph, i = y * pw + x;
      fib[i] = (0.84 + 0.16 * noise2(u * 70, w * 70, 704)) * (0.9 + 0.1 * noise2(u * 22, w * 22, 705));
      mot[i] = 0.72 + 0.56 * noise2(u * 5 + 3, w * 5 + 3, 706);
      edge[i] = 0.07 * (noise2(u * 15 + 2, w * 15 + 2, 708) - 0.5) + 0.07 * (noise2(u * 46 + 11, w * 46 + 11, 707) - 0.5);
    }
    F = { fib, mot, edge };
    if (fieldMemo.size > 4) fieldMemo.clear();
    fieldMemo.set(key, F);
    return F;
  }
  function inkWhite(v, part) {
    return S('inkw' + v + part, 256, 256, 0.75, (g) => {
      const cv = g.canvas, pw = cv.width, ph = cv.height, img = g.createImageData(pw, ph), d = img.data;
      const E = inkOutline(v), NB = E.lo.length, F = inkField(pw, ph);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const u = (x + 0.5) / pw, w = (y + 0.5) / ph, dx = (u - 0.5) * 2, dy = (w - 0.5) * 2, r = Math.hypot(dx, dy);
        const j = y * pw + x, i = j * 4;
        d[i] = d[i + 1] = d[i + 2] = 255;
        if (r > 0.999) { d[i + 3] = 0; continue; }
        const ai = Math.floor((((Math.atan2(dy, dx) / TAU) + 1) % 1) * NB) % NB, dd = r / E.lo[ai], fib = F.fib[j];
        let al;
        if (part === 'core') al = Math.pow(1 - smooth(dd / 0.6), 1.1) * 0.9 * fib;
        else {
          // 墨色有浓淡：低频的云状起伏；外缘被纸纤维吃出毛边（二维噪声扭一扭边线，不是放射状的尖刺）
          const de = r / E.hi[ai] + F.edge[j];
          const inside = 1 - smooth((de - 0.9) / 0.12);
          const core = 0.5 * Math.pow(1 - smooth(dd / 0.75), 0.8), body = 0.42 * (1 - 0.5 * smooth((dd - 0.1) / 0.85)) * F.mot[j];
          const ring = 0.07 * Math.exp(-Math.pow((dd - 0.92) / 0.08, 2));
          const halo = 0.05 * (1 - smooth((dd - 0.95) / 0.22)) * smooth((1 - r) / 0.05);
          al = ((core + body + ring) * inside + halo) * fib;
        }
        d[i + 3] = clamp(al) * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }
  const inkTex = (v, col, part) => tint(inkWhite(v, part), col);
  // 空闲时先把三种墨晕花样算好（只是缓存，免得第一个强拍落墨时卡一下）
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => { if (XYT.sprites) for (let v = 0; v < 3; v++) { inkWhite(v, 'full'); inkWhite(v, 'core'); } }, { timeout: 5000 });
  // k：外层乘下来的整体透明度（调用方 alpha × 收尾渐隐）
  function bloomPaper(g, x, y, R, age, o, seed, m, k) {
    const dur = o.dur ?? 2.6, p = easeOut(clamp(age / dur)), col = o.color || '#17130f', a = (o.alpha ?? 0.9) * smooth(age / 0.06) * k;
    const v = ((seed % 3) + 3) % 3, rot = h2(seed, 3) * TAU, sy = 0.86 + 0.24 * h2(seed, 4), r = R * (0.14 + 0.86 * p);
    const dry = 1 - 0.25 * smooth((age - dur) / 4);
    g.globalAlpha = clamp(a * dry);
    putR(g, m, inkTex(v, col, 'full'), x, y, r * 2.8, r * 2.8 * sy, rot, 1);
    // 第二遍积墨：小一圈、偏一点，层次就出来了（墨分五色）
    const v2 = (v + 1) % 3, ox = (h2(seed, 5) - 0.5) * r * 0.3, oy = (h2(seed, 6) - 0.5) * r * 0.3, p2 = easeOut(clamp((age - 0.15) / (dur * 0.8)));
    g.globalAlpha = clamp(a * dry * 0.32 * p2);
    putR(g, m, inkTex(v2, col, 'full'), x + ox, y + oy, r * 1.5 * (0.5 + 0.5 * p2), r * 1.5 * sy * (0.5 + 0.5 * p2), rot + 2.1, 1);
    // 刚落下时墨芯浓，随着晕开渐渐化淡
    if (p < 0.98) {
      g.globalAlpha = clamp(a * (1 - p) * 0.85);
      putR(g, m, inkTex(v, col, 'core'), x, y, r * 1.7, r * 1.7 * sy, rot, 1);
    }
    reset(g, m);
  }
  // 烟团贴图：白色、柔软、横向拉长，几缕低频的丝（不挖洞，免得像菜花）
  const puffTex = (k) => S('puff2|' + k, 160, 112, 0.5, (g) => {
    const r = A.rng(300 + k);
    // 几个大小不一的团块挤在一起，外形不规则
    const lobes = [];
    for (let i = 0; i < 3; i++) lobes.push([80 + (r() - 0.5) * 56, 56 + (r() - 0.5) * 18, 0.8 + r() * 0.4]);
    for (let i = 0; i < 22; i++) {
      const [lx, ly, lk] = lobes[i % 3], an = r() * TAU, d = Math.pow(r(), 0.6);
      const x = lx + Math.cos(an) * d * 30 * lk, y = ly + Math.sin(an) * d * 14 * lk, rr = Math.min(50, (20 + r() * 16) * lk);
      A.softBlob(g, clamp(x, rr, 160 - rr), clamp(y, rr, 112 - rr), rr, 0.1 + 0.08 * r(), '#ffffff');
    }
    // 丝：沿一条弯弧排开的小软团，叠得很密，画出来是连成一片的淡烟丝
    for (let w = 0; w < 3; w++) {
      const y0 = 30 + r() * 52, bend = (r() - 0.5) * 40, ph = r() * TAU;
      for (let j = 0; j <= 40; j++) {
        const u = j / 40, x = 18 + u * 124, y = y0 + bend * Math.sin(u * PI) + Math.sin(u * 7 + ph) * 4;
        A.softBlob(g, x, y, 5 + 4 * Math.sin(u * PI), 0.04 * Math.sin(u * PI), '#ffffff');
      }
    }
  });
  // 水中墨：先画进低分辨率缓冲（本来就柔），再贴回；墨丝是一笔连贯的螺旋曲线，越往外越卷，粗细浓淡分三遍描
  function bloomWater(g, x, y, R, age, o, seed, k, t) {
    const dur = o.dur ?? 3.2, p = easeOut(clamp(age / dur)), col = o.color || '#17130f';
    const a = (o.alpha ?? 0.8) * smooth(age / 0.1) * (1 - smooth((age - dur) / (o.fade ?? 3))) * k;
    if (a <= 0.005) return;
    // 墨滴下沉：墨丝大多朝下散开，两侧的向外、向上卷回（像一朵倒挂的蘑菇云），中间几缕直直垂下
    const nT = 7, curls = [], sx = x, sy = y + p * R * 0.25;
    for (let j = 0; j < nT; j++) {
      const f = (j + 0.3 + 0.4 * h2(j, seed + 9)) / nT - 0.5, an = PI / 2 + f * 3.4 + (h2(j, seed + 13) - 0.5) * 0.5 + (h2(seed, 14) - 0.5) * 0.6;
      const cv = f < 0 ? 1 : -1, L = R * (0.3 + 1.0 * p) * (0.45 + 0.75 * h2(j, seed + 11)) * (1 - 0.3 * Math.abs(f));
      const pts = [];
      let px = sx + Math.cos(an) * R * 0.04, py = sy + Math.sin(an) * R * 0.04, hd = an;
      const N = 24, curl = (1.2 + 3.6 * Math.abs(f) * 2) * (0.7 + 0.6 * h2(j, seed + 12));
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        pts.push([px, py, u]);
        // 曲率越往外越大（像回旋线），尾端卷成一个小涡；墨慢慢下沉
        hd = an + cv * (0.5 * u + curl * Math.pow(smooth((u - 0.3) / 0.7), 1.4)) + 0.25 * Math.sin(t * 0.4 + j * 1.7 + u * 3);
        const ds = (L / N) * (1 - 0.55 * smooth((u - 0.55) / 0.45));
        px += Math.cos(hd) * ds; py += Math.sin(hd) * ds * 0.85 + u * ds * 0.35 * p;
      }
      curls.push(pts);
    }
    // 墨丝的轮廓：源头细、中段鼓起、卷尾收细
    const band = (q, pts, k) => {
      const N = pts.length - 1, Lf = [], Rt = [];
      for (let i = 0; i <= N; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(N, i + 1)], u = pts[i][2];
        let tx = p1[0] - p0[0], ty = p1[1] - p0[1];
        const l = Math.hypot(tx, ty) || 1;
        const hw = R * k * (0.012 + 0.11 * Math.pow(u, 0.7)) * (0.45 + 0.55 * p) * (1 - 0.6 * smooth((u - 0.8) / 0.2));
        Lf.push([pts[i][0] - (ty / l) * hw, pts[i][1] + (tx / l) * hw]); Rt.push([pts[i][0] + (ty / l) * hw, pts[i][1] - (tx / l) * hw]);
      }
      q.beginPath(); poly(q, Lf);
      for (let i = N; i >= 0; i--) q.lineTo(Rt[i][0], Rt[i][1]);
      q.closePath();
    };
    const box = [x - R * 1.6, y - R * 1.5, x + R * 1.6, y + R * 1.8];
    viaScratch(g, 'inkw', box, o.res ?? 0.3, 'source-over', 1, (q, m) => {
      // 一团淡淡的墨云
      const puff = tint(puffTex(((seed % 3) + 3) % 3), col);
      for (let j = 0; j < 5; j++) {
        const an = h2(j, seed) * TAU, d = R * p * (0.15 + 0.45 * h2(j, seed + 2)), s = R * (0.45 + 0.75 * p) * (0.7 + 0.5 * h2(j, seed + 3));
        q.globalAlpha = clamp(a * 0.4 * (1 - 0.4 * p));
        putR(q, m, puff, sx + Math.cos(an) * d, sy + Math.abs(Math.sin(an)) * d * 0.8, s * 1.3, s * 0.8, an + p * 0.6, 1);
      }
      reset(q, m);
      // 每根墨丝三层：宽而淡、中、窄而浓，叠出柔边；颜色沿丝由浓到淡
      for (const pts of curls) {
        const e = pts[pts.length - 1], gr = q.createLinearGradient(sx, sy, e[0], e[1]);
        gr.addColorStop(0, ca(col, 1)); gr.addColorStop(0.6, ca(col, 0.75)); gr.addColorStop(1, ca(col, 0.45));
        q.fillStyle = gr;
        for (const [k, al] of [[2.4, 0.09], [1.8, 0.11], [1.25, 0.14], [0.8, 0.17], [0.45, 0.22]]) { q.globalAlpha = clamp(a * al); band(q, pts, k); q.fill(); }
      }
      // 刚滴下的浓墨芯
      if (age < dur) { const cr = R * (0.12 + 0.2 * p); q.globalAlpha = clamp(a * 0.6 * (1 - p)); q.drawImage(inkTex(((seed % 3) + 3) % 3, col, 'core'), sx - cr, sy - cr, cr * 2, cr * 2); }
    });
    // 细墨丝：全分辨率的一根细线，给软墨一点筋骨
    g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(0.6, R * 0.005);
    g.globalAlpha = clamp(a * 0.28);
    g.beginPath();
    for (const pts of curls) poly(g, pts.slice(3));
    g.stroke();
  }
  // kind 'paper'（宣纸上的墨晕，层层积墨、边缘留水痕）/ 'water'（滴入水中的墨，如烟卷开）
  // 单个：x, y 加 at / t0（不给时从镜头起点开始）；on:'down' 等踩点触发：给了 x, y 就在那里（jitter 随机偏移），否则散落在 area 内
  V.inkBloom = function (g, c, o = {}) {
    const t = o.time ?? c.t, R = o.r ?? 220, seed = o.seed ?? 71, water = o.kind === 'water';
    const dur = o.dur ?? (water ? 3.2 : 2.6), hold = o.hold ?? 4, life = dur + (water ? (o.fade ?? 3) : hold);
    const ev = once(c, o, life, t);
    const ar = o.area || [160, 120, W - 160, H - 120], many = o.x == null, jit = o.jitter ?? 0;
    const GA = enter(g), fl = clamp(hold, 0.3, 1.5), paper = [];
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > life) continue;
      let x = many ? lerp(ar[0], ar[2], hash(e.k * 37 + seed)) : o.x, y = many ? lerp(ar[1], ar[3], hash(e.k * 53 + seed + 1)) : o.y;
      if (!many && jit) { x += (hash(e.k * 37 + seed) - 0.5) * 2 * jit; y += (hash(e.k * 53 + seed + 1) - 0.5) * 2 * jit; }
      const r = R * (many || jit ? 0.6 + 0.5 * hash(e.k * 71 + seed) : 1), fade = water ? 1 : 1 - smooth((age - life + fl) / fl);
      if (water) { bloomWater(g, x, y, r, age, o, seed + e.k * 13, GA * fade, t); continue; }
      const rr = r * (0.14 + 0.86 * easeOut(clamp(age / dur))) * 1.45, sy = 0.86 + 0.24 * h2(seed + e.k * 13, 4);
      paper.push([x, y, r, age, seed + e.k * 13, GA * fade, [x - rr, y - rr * sy, x + rr, y + rr * sy]]);
    }
    // 宣纸墨晕：几朵先叠进一张低分辨率缓冲（贴图本身也只有约三成分辨率，看不出差别），再一次贴回；离得远时各贴各的，免得贴一大片空白
    const area = (b) => Math.max(0, Math.min(b[2], W) - Math.max(b[0], 0)) * Math.max(0, Math.min(b[3], H) - Math.max(b[1], 0));
    let sum = 0;
    const U = [1e9, 1e9, -1e9, -1e9];
    for (const p of paper) { const b = p[6]; sum += area(b); U[0] = Math.min(U[0], b[0]); U[1] = Math.min(U[1], b[1]); U[2] = Math.max(U[2], b[2]); U[3] = Math.max(U[3], b[3]); }
    const groups = paper.length && area(U) <= sum * 1.15 ? [[U, paper]] : paper.map((p) => [p[6], [p]]);
    for (const [box, list] of groups) viaScratch(g, 'inkp', box, o.res ?? 0.35, 'source-over', 1, (q, mm) => {
      for (const [x, y, r, age, sd, k] of list) bloomPaper(q, x, y, r, age, o, sd, mm, k);
    });
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
    const ev = fires(c, Object.assign({ on: 'down', chance: 0.5 }, o), 0.9, t);
    let lvl = 0;
    const GA = enter(g);
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
      g.globalAlpha = clamp(fl * I * 0.55) * GA;
      g.drawImage(glowTex(col), x - 420, y0 - 300, 840, 640);
      g.fillStyle = ca(col, clamp(fl * I * 0.18)); g.globalAlpha = GA; g.fillRect(-60, -60, W + 120, H + 120);
      for (const sg of segs) {
        const k = sg.w ? 0.45 / sg.w : 1;
        for (const [lw, al, cc] of [[7, 0.32, col], [2, 0.95, '#ffffff']]) {
          g.strokeStyle = ca(cc, clamp(al * I * (sg.w ? 0.7 : 1))); g.lineWidth = lw * wd * k;
          g.beginPath(); sg.pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
        }
      }
      const main = segs[0].pts;
      g.globalAlpha = clamp(0.3 * I) * GA;
      for (let i = 0; i < main.length; i += 12) g.drawImage(glowTex(col), main[i][0] - 90, main[i][1] - 90, 180, 180);
    }
    g.restore();
    return lvl;
  };

  // ---------- 涟漪 ----------
  // 单点 x, y 加 at / t0（不给时从镜头起点泛起）；on:'beat' 每拍一圈：给了 x, y 就在那里（jitter 随机偏移半径），否则散落在 area 内；rain: 每秒雨点数（随机落点）
  // 也接受 env 风格的两参调用 V.ripples(g, {x, y, t0, t})
  V.ripples = function (g, c, o = {}) {
    const t = o.time ?? c.t, life = o.life ?? 2.4, R = o.r ?? 90, flat = o.flat ?? 0.28, rings = o.rings ?? 3, col = o.color || '#ffffff';
    const lw = o.width ?? 1.3, seed = o.seed ?? 101, ar = o.area || [100, 480, W - 100, H - 20], jit = o.jitter ?? 0;
    const list = [];
    if (o.rain) {
      const rate = o.rain, step = 1 / rate, i1 = Math.floor(t / step);
      for (let i = i1; i > i1 - Math.ceil(life * rate) - 1; i--) {
        const t0 = i * step + hash(i * 3 + seed) * step;
        if (t0 > t) continue;
        list.push([lerp(ar[0], ar[2], hash(i * 7 + seed)), lerp(ar[1], ar[3], hash(i * 11 + seed)), t0, 0.5 + 0.5 * hash(i * 13 + seed)]);
      }
    } else {
      const many = o.x == null;
      for (const e of once(c, o, life, t)) {
        let x = many ? lerp(ar[0], ar[2], hash(e.k * 17 + seed)) : o.x, y = many ? lerp(ar[1], ar[3], hash(e.k * 29 + seed)) : o.y;
        if (!many && jit) { x += (hash(e.k * 17 + seed) - 0.5) * 2 * jit; y += (hash(e.k * 29 + seed) - 0.5) * 2 * jit * flat; }
        list.push([x, y, e.t0, 0.6 + 0.4 * (e.str ?? 1)]);
      }
    }
    const GA = enter(g), a = (o.alpha ?? 0.5) * GA;
    g.globalAlpha = 1;
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
      if (age < 0.25) { g.globalCompositeOperation = glowOp(c, o); g.globalAlpha = (1 - age / 0.25) * a; const r = 16 * sc; g.drawImage(glowTex(col), x - r, y - r * 0.6, r * 2, r * 1.2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
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
      // 墨块用的毛糙轮廓：每条边细分，往里外随机抖一抖，再往里收一点（墨块之间留出纸白）
      const rough = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], ex = bx - ax, ey = by - ay, el = Math.hypot(ex, ey) || 1;
        const k = Math.max(3, Math.round(el * 22));
        for (let q = 0; q < k; q++) {
          const u = q / k, jr = (r() - 0.5) * 0.15 * Math.min(1, el * 3) * (q ? 1 : 0.3);
          const px = ax + ex * u - (ey / el) * jr, py = ay + ey * u + (ex / el) * jr;
          rough.push([cx + (px - cx) * 0.82, cy + (py - cy) * 0.82]);
        }
      }
      s.push({ pts, rough, cx, cy, h: r(), h2: r(), h3: r(), sz: Math.sqrt(pts.reduce((v, p) => Math.max(v, (p[0] - cx) ** 2 + (p[1] - cy) ** 2), 0)) });
    }
    s.spokes = V2;
    shardMemo.set(key, s);
    return s;
  }
  // 笔触式裂纹：起笔粗、收笔细的一条填充带（墨），或细亮线（光、玻璃）
  function crackStroke(g, x, y, R, pts, w0) {
    const L = [], Rt = [], N = pts.length - 1;
    for (let i = 0; i <= N; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(N, i + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], l = Math.hypot(tx, ty) || 1;
      const w = w0 * (1 - (i / N) * 0.85) * (i ? 1 : 0.6);
      L.push([x + pts[i][0] * R - (ty / l) * w, y + pts[i][1] * R + (tx / l) * w]); Rt.push([x + pts[i][0] * R + (ty / l) * w, y + pts[i][1] * R - (tx / l) * w]);
    }
    poly(g, L);
    for (let i = N; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
    g.closePath();
  }
  // x, y, r：碎裂物的圆心与半径；at / t0 碎开时刻（不给时为镜头起点；之前 crack 秒先出现裂纹）；img 可选的贴图（覆盖 [x-r, y-r, 2r, 2r]）
  // kind 'glass' 冷光碎片 / 'light' 发光的梦 / 'ink' 墨块：毛边的墨片飞散，化作墨雾与墨点
  V.shatter = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 360, R = o.r ?? 160, n = o.n ?? 36, seed = o.seed ?? 111;
    const ev = once(c, o, 1e9, t), t0 = ev.length ? ev[0].t0 : start(c, t), ink = o.kind === 'ink';
    const kind = o.kind || 'glass', col = o.color || (ink ? '#16141a' : '#cfe6ff'), edge = o.edge || '#ffffff';
    const dur = o.dur ?? 2.4, force = o.force ?? 380, grav = o.gravity ?? 360, crack = o.crack ?? 0.6;
    const age = t - t0, set = shardSet(seed, n), m = Mx(g);
    if (age > dur) return;
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    // 碎开之前：完整的贴图（若有），最后 crack 秒里裂纹从中心蔓延
    if (age < -crack) { if (o.img) g.drawImage(o.img, x - R, y - R, R * 2, R * 2); g.restore(); return; }
    if (age < 0) {
      if (o.img) g.drawImage(o.img, x - R, y - R, R * 2, R * 2);
      const cp = clamp((age + crack) / crack), sp = set.spokes;
      g.globalCompositeOperation = ink ? 'source-over' : 'lighter';
      g.fillStyle = ink ? ca(col, 0.9 * a) : ca(edge, 0.85 * a);
      g.globalAlpha = 1;
      const w0 = (ink ? 3.4 : 1.6) * (R / 160);
      g.beginPath();
      for (let j = 0; j < sp[1].length; j++) {
        if (h2(j, seed) > cp * 1.4) continue;
        const pts = [[0, 0]];
        for (let ri = 1; ri <= 3; ri++) { const f = clamp(cp * 1.1 * 3 - (ri - 1)); if (f <= 0) break; const [px, py] = pts[pts.length - 1]; pts.push([lerp(px, sp[ri][j][0], f), lerp(py, sp[ri][j][1], f)]); if (f < 1) break; }
        if (pts.length > 1) crackStroke(g, x, y, R, pts, w0 * (0.6 + 0.6 * h2(j, seed + 3)));
      }
      if (cp > 0.6) for (let ri = 1; ri <= 2; ri++) for (let j = 0; j < sp[ri].length; j++) {
        if (h2(j + ri * 50, seed) > (cp - 0.6) * 2.5) continue;
        const j2 = (j + 1) % sp[ri].length;
        crackStroke(g, x, y, R, [sp[ri][j], [(sp[ri][j][0] + sp[ri][j2][0]) / 2 * 1.02, (sp[ri][j][1] + sp[ri][j2][1]) / 2 * 1.02], sp[ri][j2]], w0 * 0.5);
      }
      g.fill();
      if (!ink) { g.globalAlpha = cp * 0.4 * a; const rr = R * (0.4 + cp * 0.4); g.drawImage(glowTex(col), x - rr, y - rr, rr * 2, rr * 2); }
      else if (cp > 0.3) { g.globalAlpha = clamp((cp - 0.3) * 0.5 * a); const rr = R * 0.3 * cp; g.drawImage(inkTex(((seed % 3) + 3) % 3, col, 'core'), x - rr, y - rr, rr * 2, rr * 2); }
      g.restore();
      return;
    }
    const fade = 1 - smooth(age / dur);
    if (age < 0.3 && !ink) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - age / 0.3) * a; const rr = R * 2.2; g.drawImage(glowTex(col), x - rr, y - rr, rr * 2, rr * 2); g.globalCompositeOperation = 'source-over'; }
    const place = (s, aa) => {
      const l = Math.hypot(s.cx, s.cy) || 0.001, dx = l > 0.05 ? s.cx / l : Math.cos(s.h * TAU), dy = l > 0.05 ? s.cy / l : Math.sin(s.h * TAU);
      const v = force * (0.5 + 0.9 * s.h2) * (1.2 - l * 0.4);
      return [x + s.cx * R + dx * v * aa, y + s.cy * R + (dy * v - 80) * aa + 0.5 * grav * aa * aa];
    };
    if (ink) {
      // 墨雾：每块墨片身后晕开一团，越散越淡（低分辨率缓冲里画）
      const puff = tint(puffTex(((seed % 3) + 3) % 3), col), stamps = [];
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const s of set) {
        if (s.h3 > 0.55) continue;
        const [px, py] = place(s, age * 0.85), sz = R * (s.sz * 1.6 + 0.12) * (0.9 + 2.4 * easeOut(age / dur));
        const al = a * 0.3 * smooth(age / 0.25) * (1 - smooth((age - dur * 0.25) / (dur * 0.75)));
        if (al < 0.01) continue;
        stamps.push([px, py, sz, al, s.h * TAU + age * (s.h3 - 0.5)]);
        bx0 = Math.min(bx0, px - sz); bx1 = Math.max(bx1, px + sz); by0 = Math.min(by0, py - sz); by1 = Math.max(by1, py + sz);
      }
      if (stamps.length) viaScratch(g, 'shatter', [bx0, by0, bx1, by1], 0.3, 'source-over', 1, (q, mm) => {
        for (const [px, py, sz, al, rot] of stamps) { q.globalAlpha = al; putR(q, mm, puff, px, py, sz * 1.3, sz * 0.9, rot, 1); }
      });
    }
    for (const s of set) {
      const [px, py] = place(s, age);
      const rot = (s.h3 - 0.5) * 7 * age, fx = Math.cos(age * (2 + 6 * s.h) + s.h3 * 6);
      // 墨片：边缘先化开（缩小、变淡），像墨在空气里散成雾
      const dis = ink ? smooth((age - dur * 0.12 - s.h * dur * 0.2) / (dur * 0.45)) : 0;
      const al = a * fade * (1 - dis);
      if (al < 0.01) continue;
      const sk = ink ? 1 - 0.55 * dis : 1;
      setL(g, m, px, py, rot, Math.max(0.1, Math.abs(fx)) * Math.sign(fx || 1) * sk, sk);
      g.beginPath();
      (ink ? s.rough : s.pts).forEach((p, i) => { const qx = (p[0] - s.cx) * R, qy = (p[1] - s.cy) * R; i ? g.lineTo(qx, qy) : g.moveTo(qx, qy); });
      g.closePath();
      if (o.img) {
        g.save(); g.clip(); g.globalAlpha = al * 0.92;
        g.drawImage(o.img, -R - s.cx * R, -R - s.cy * R, R * 2, R * 2);
        g.restore();
      } else if (ink) {
        g.globalAlpha = al * (0.72 + 0.2 * s.h2); g.fillStyle = col; g.fill();
      } else {
        g.globalAlpha = al;
        g.fillStyle = ca(col, kind === 'light' ? 0.55 : 0.28); g.fill();
      }
      if (!ink) {
        const gl = Math.pow(Math.abs(Math.sin(rot * 1.3 + s.h * 6 + age * 3)), 10);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = ca(cmix(col, edge, 0.4 + 0.6 * gl), (0.5 + 0.5 * gl) * al); g.lineWidth = 1.5; g.globalAlpha = 1; g.stroke();
        if (gl > 0.05) { g.fillStyle = ca(edge, gl * 0.22 * al); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      }
    }
    reset(g, m);
    // 细碎的闪屑；墨块则是溅开的墨点（顺着飞行方向拉长一点）
    g.globalCompositeOperation = ink ? 'source-over' : 'lighter';
    const dot = ink ? flakeTex(col) : sparkTex(cmix(col, '#ffffff', 0.5));
    for (let i = 0; i < n * 2; i++) {
      const an = h2(i, seed + 5) * TAU, v = force * (0.8 + 1.4 * h2(i, seed + 6)), dr = R * 0.3 + v * age;
      const px = x + Math.cos(an) * dr, py = y + Math.sin(an) * dr + 0.5 * grav * age * age;
      const rr = (ink ? 1.2 + 4.5 * Math.pow(h2(i, seed + 7), 2) : 1.5 + 3 * h2(i, seed + 7));
      if (ink) {
        g.globalAlpha = clamp(a * (1 - smooth((age - dur * 0.5) / (dur * 0.5))) * 0.9);
        const vy = Math.sin(an) * v + grav * age, vx = Math.cos(an) * v, sp = Math.hypot(vx, vy);
        putR(g, m, dot, px, py, rr * 2 * (1 + Math.min(1.5, sp / 900)), rr * 2, Math.atan2(vy, vx));
      } else {
        g.globalAlpha = clamp(a * fade * (0.5 + 0.5 * Math.sin(age * 20 + i)));
        g.drawImage(dot, px - rr * 2, py - rr * 2, rr * 4, rr * 4);
      }
    }
    reset(g, m);
    g.restore();
  };

  // ---------- 余烬 ----------
  // 从 y 处（x0..x1）升起的火星；rise 升高多少后熄灭；近处的大而亮，带一圈暖晕
  V.embers = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 70, seed = o.seed ?? 121, x0 = o.x0 ?? 0, x1 = o.x1 ?? W, yb = o.y ?? H + 10;
    const rise = o.rise ?? 520, sp = o.speed ?? 70, wind = o.wind ?? 18, col = o.color || '#ff8a3a', hot = o.hot || '#ffe6a6';
    const sz = o.size || [1.2, 6], beat = o.beat ?? 0.5;
    const tab = table('ember' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.4), L: 0.6 + 0.8 * h2(i, seed + 1), p: h2(i, seed + 2), f: h2(i, seed + 3) * 100, h: h2(i, seed + 4) }));
    const tHot = sparkTex(hot), tCol = glowTex(col), m = Mx(g), bi = c.b ? c.b.i : 0, pulse = beat * BE(c, 0.35);
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    g.globalCompositeOperation = glowOp(c, o);
    for (const q of tab) {
      const k = lerp(0.5, 1.4, q.z), life = (rise / sp) * q.L / k, u0 = t / life + q.p, cyc = Math.floor(u0), u = u0 - cyc;
      const xs = lerp(x0, x1, h2(q.i * 31 + cyc, seed + 5));
      const pos = (uu) => [xs + wind * uu * life * k + (noise1(uu * 3 + q.f, seed) - 0.5) * 70 * k * uu + Math.sin(uu * 9 + q.f) * 6 * uu, yb - uu * rise * q.L * (0.8 + 0.4 * q.h)];
      const [x, y] = pos(u), [xp, yp] = pos(Math.max(0, u - 0.02));
      let br = smooth(u / 0.08) * (1 - smooth((u - 0.45) / 0.55)) * (0.55 + 0.45 * noise1(t * 7 + q.f, seed + 1));
      if (hash(q.i * 19 + bi * 101 + seed) < 0.3) br *= 1 + pulse * 1.5;
      br *= a * lerp(0.6, 1.15, q.z);
      if (br < 0.02) continue;
      const r = lerp(sz[0], sz[1], Math.pow(q.z, 1.6)), an = Math.atan2(y - yp, x - xp), st = 1 + Math.min(3, Math.hypot(x - xp, y - yp) / (r * 1.5));
      g.globalAlpha = clamp(br * 0.32); g.drawImage(tCol, x - r * 3.5, y - r * 3.5, r * 7, r * 7);
      if (q.z > 0.7) { g.globalAlpha = clamp(br * 0.1); g.drawImage(tCol, x - r * 6, y - r * 6, r * 12, r * 12); }
      g.globalAlpha = clamp(br);
      putR(g, m, tHot, x, y, r * 3.2 * st, r * 3.2, an);
    }
    reset(g, m);
    g.restore();
  };

  // ---------- 火花 ----------
  // 迸溅：x, y 处在 at / t0（不给时为镜头起点）或 on:'beat'/'down' 炸开；angle/spread 喷射方向与张角
  V.sparks = function (g, c, o = {}) {
    const t = o.time ?? c.t, n = o.n ?? 40, seed = o.seed ?? 131, sp = o.speed ?? 520, grav = o.gravity ?? 900, dur = o.dur ?? 0.9;
    const ang = o.angle ?? -PI / 2, spread = o.spread ?? TAU, col = o.color || '#ffc86a', hot = o.hot || '#fffbe8', drag = o.drag ?? 2.4, a = o.alpha ?? 1, s = o.size ?? 1;
    const ev = once(c, o, dur, t);
    const GA = enter(g);
    g.globalCompositeOperation = glowOp(c, o);
    g.lineCap = 'round';
    for (const e of ev) {
      const age = t - e.t0;
      if (age < 0 || age > dur) continue;
      const ox = o.x ?? 640, oy = o.y ?? 360, sd = seed + e.k * 17;
      if (age < 0.16) { g.globalAlpha = clamp((1 - age / 0.16) * a) * GA; const R = 70 * s; g.drawImage(glowTex(col), ox - R, oy - R, R * 2, R * 2); }
      g.globalAlpha = GA;
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
  // 漩涡的光盘贴图（正圆、未旋转、亮度按 1/1.4 存，留出拍点提亮的余量）：深处的光与旋臂。旋臂纯色分三层（整条淡蓝，靠里一段叠金，最里一段叠白），每层再套两圈更宽更淡的，边缘就柔了
  function vortexDisk(c1, c2, arms, dir) {
    return S('vortex|' + qc(c1) + qc(c2) + arms + dir, 512, 512, 1.6, (q) => {
      const x = 256, y = 256, R = 256 / 1.1, thMax = 3.2 * PI, kk = Math.log(1 / 0.05) / thMax, k = 1 / 1.4;
      q.globalCompositeOperation = 'lighter';
      q.globalAlpha = 0.36 * k; q.drawImage(glowTex(c2), x - R * 0.75, y - R * 0.75, R * 1.5, R * 1.5);
      q.globalAlpha = 0.3 * k; q.drawImage(glowTex(c1), x - R * 0.4, y - R * 0.4, R * 0.8, R * 0.8);
      q.globalAlpha = 1;
      for (const [i0, wk, cc, al] of [[0, 1, c2, 0.17], [0.3, 0.5, c1, 0.26], [0.6, 0.25, '#ffffff', 0.22]]) {
        for (const [wx, ax] of [[1.9, 0.3], [1.35, 0.35], [0.8, 0.5]]) {
          q.fillStyle = ca(cc, al * ax * k);
          q.beginPath();
          for (let j = 0; j < arms; j++) {
            const base = (j * TAU) / arms, NS = 60, j0 = Math.round(i0 * NS), outer = [], inner = [];
            for (let i = j0; i <= NS; i++) {
              const th = (i / NS) * thMax, rr = R * Math.exp(-kk * th), an = base + dir * th, w = 0.16 * wk * wx * Math.pow(Math.sin((PI * (i - j0)) / (NS - j0)), 0.7);
              outer.push([x + Math.cos(an) * rr * (1 + w), y + Math.sin(an) * rr * (1 + w)]);
              inner.push([x + Math.cos(an + dir * 0.1 * wk) * rr * (1 - w * 0.6), y + Math.sin(an + dir * 0.1 * wk) * rr * (1 - w * 0.6)]);
            }
            poly(q, outer);
            for (let i = inner.length - 1; i >= 0; i--) q.lineTo(inner[i][0], inner[i][1]);
            q.closePath();
          }
          q.fill();
        }
      }
    });
  }
  // x, y 圆心；r 半径；amount 0..1 漩涡张开的程度；tilt 透视扁度；dir 旋向；res 柔光部分的缓冲分辨率
  V.timeVortex = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 360, amt = clamp(o.amount ?? 1), R = (o.r ?? 420) * (0.3 + 0.7 * easeOut(amt));
    const c1 = o.color || '#ffd88a', c2 = o.color2 || '#8ab6ff', tilt = o.tilt ?? 0.62, dir = o.dir ?? 1, seed = o.seed ?? 141, n = o.n ?? 90;
    const beat = o.beat ?? 0.6, pulse = beat * BE(c, 0.45), dpulse = beat * DE(c, 0.8);
    const GA = enter(g), a = (o.alpha ?? 1) * amt * GA, op = glowOp(c, o), M0 = Mx(g);
    if (a < 0.01) { g.restore(); return; }
    const arms = o.arms ?? 4, rot = t * 0.35 * dir;
    const tab = table('vortex' + seed, n, (i) => ({ z: h2(i, seed), h: h2(i, seed + 1), p: h2(i, seed + 2) * TAU, v: 0.05 + 0.08 * h2(i, seed + 3), ci: h2(i, seed + 4) < 0.55 ? 0 : 1 }));
    // 柔的部分（深处的光、旋臂）不随时间变形，只转动、随拍点明暗：先画成一张正圆的贴图缓存起来，每帧旋转、压扁贴一次
    const disk = vortexDisk(c1, c2, arms, dir);
    g.globalCompositeOperation = op;
    g.globalAlpha = clamp((a * (1 + 0.4 * dpulse)) / 1.4);
    setL(g, Mx(g), x, y, 0, 1, tilt);
    const mm = Mx(g);
    setL(g, mm, 0, 0, rot);
    if (o.smooth !== true) g.imageSmoothingEnabled = false;
    // 只贴有内容的中间一圈（光盘边上的一圈是空的，省点填充）
    const kc = 1.02 / 1.1, dw = disk.width, cw = dw * kc;
    g.drawImage(disk, (dw - cw) / 2, (dw - cw) / 2, cw, cw, -R * 1.02, -R * 1.02, R * 2.04, R * 2.04);
    g.imageSmoothingEnabled = true;
    reset(g, M0);
    const core = R * 0.16 * (1 + 0.25 * pulse);
    g.globalAlpha = clamp(0.9 * a); g.drawImage(glowTex('#ffffff'), x - core, y - core, core * 2, core * 2);
    g.globalCompositeOperation = op;
    g.globalAlpha = 1;
    // 星轨：被吸向中心的光弧，越近越快（细线留在全分辨率）
    const B = [[], [], [], [], [], []];
    for (const p of tab) {
      const s = (((p.h - t * p.v) % 1) + 1) % 1, u = 0.05 + 0.95 * s, rr = R * u;
      const th = p.p + dir * (t * 0.22 + 0.5 / u), dl = (0.08 + 0.4 * (1 - s)) * (0.6 + 0.8 * p.z);
      const al = smooth((1 - s) / 0.18) * smooth(s / 0.12);
      if (al < 0.05) continue;
      B[p.ci * 3 + Math.min(2, Math.floor(al * 3))].push([rr, th, dl]);
    }
    B.forEach((bk, bi) => {
      if (!bk.length) return;
      const ci = Math.floor(bi / 3), lv = (bi % 3) + 1;
      g.strokeStyle = ca(ci ? c2 : c1, clamp(a * 0.28 * lv)); g.lineWidth = 0.8 + lv * 0.5;
      g.beginPath();
      // 光弧用四段折线近似（比 ellipse 弧省得多，这么短看不出折角）
      for (const [rr, th, dl] of bk) {
        const t0 = dir > 0 ? th - dl : th;
        g.moveTo(x + Math.cos(t0) * rr, y + Math.sin(t0) * rr * tilt);
        for (let q = 1; q <= 4; q++) { const an = t0 + (dl * q) / 4; g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr * tilt); }
      }
      g.stroke();
    });
    // 刻度环：像日晷与罗盘，反向缓转，拍点时一亮（细线留在全分辨率，保持锐利）
    g.lineCap = 'butt';
    [[0.98, 60, 1, 0.05], [0.66, 36, -1, 0.08], [0.4, 18, 1, 0.12]].forEach(([k, m, d, sp], ri) => {
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
    // 星点
    const dot = sparkTex('#fff6e0');
    for (let i = 0; i < 26; i++) {
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
    const sp = o.speed ?? 0.7, s0 = o.size ?? 12, trail = o.trail ?? 10, seed = o.seed ?? 151, beat = o.beat ?? 0.6, float = o.mode === 'float';
    const ar = o.area || [100, 100, W - 100, H - 160], pulse = beat * BE(c, 0.45), white = sparkTex('#ffffff');
    const pos = (i, tt) => {
      if (float) {
        return [lerp(ar[0], ar[2], noise1(tt * 0.05 + i * 13.7, seed) * 1.3 - 0.15), lerp(ar[1], ar[3], noise1(tt * 0.045 + i * 7.3, seed + 1) * 1.3 - 0.15) + Math.sin(tt * 1.2 + i) * 8, 0];
      }
      const th = tt * sp + (i * TAU) / n;
      return [x + Math.cos(th) * R, y + Math.sin(th) * R * tilt + Math.sin(tt * 1.7 + i * 2) * 6, Math.sin(th)];
    };
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    g.globalCompositeOperation = glowOp(c, o);
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
  // kind 'incense' 香烟袅袅（x, y 为香头；升到一半分成两缕，各自打个卷淡去）
  //      'puff' 翻滚的烟尘（x, y, w 为源区；at / t0 / on 给定时是一次性的爆散）；烟团顺着飘动方向拉长，画进低分辨率缓冲
  V.smoke = function (g, c, o = {}) {
    const t = o.time ?? c.t, kind = o.kind || 'incense', seed = o.seed ?? 161, col = o.color || (kind === 'incense' ? '#e4ded4' : '#6a625c');
    const a = o.alpha ?? (kind === 'incense' ? 0.55 : 0.5), x = o.x ?? 640, y = o.y ?? 600;
    const GA = enter(g);
    if (kind === 'incense') {
      const h = o.h ?? 300, nS = o.n ?? 2, wd = o.width ?? 1.6, wind = o.wind ?? 0.15, N = 32, sp = 0.5, hk = h / 300;
      g.lineCap = 'butt'; g.lineJoin = 'round';
      const seg = (pts, j0, j1, lw, al) => {
        g.strokeStyle = ca(col, clamp(al)); g.lineWidth = lw;
        g.beginPath(); g.moveTo(pts[j0][0], pts[j0][1]);
        for (let j = j0 + 1; j <= j1; j++) g.lineTo(pts[j][0], pts[j][1]);
        g.stroke();
      };
      for (let k = 0; k < nS; k++) {
        const ph = h2(k, seed) * TAU, lift = 0.85 + 0.15 * Math.sin(t * 0.3 + k);
        const col0 = (u) => {
          const amp = (3 + 40 * Math.pow(u, 1.5)) * hk;
          return x + amp * (0.55 * Math.sin(u * 7 - t * 1.5 + ph) + 0.45 * (noise1(u * 2.6 - t * 0.35 + k * 10, seed) - 0.5) * 2) + wind * u * u * h + (k - (nS - 1) / 2) * 3 * u;
        };
        const main = [];
        for (let j = 0; j <= N; j++) { const u = (j / N) * sp; main.push([col0(u), y - u * h * lift]); }
        // 主干：越往上越宽、越淡（分段画，免得圆头叠成“串珠”）
        for (let j0 = 0; j0 < N; j0 += 4) {
          const u = ((j0 + 2) / N) * sp;
          seg(main, j0, Math.min(N, j0 + 4), wd * (1 + u * 7), a * Math.pow(1 - u * 0.8, 1.3) * smooth(u / 0.03 + 0.3));
        }
        // 两缕分叉：各自偏开、打卷，渐渐散尽
        for (const b of [-1, 1]) {
          const br = [], ph2 = ph + b * 1.3 + k;
          for (let j = 0; j <= N; j++) {
            const v = j / N, u = sp + v * (1 - sp);
            const off = b * 30 * hk * Math.pow(v, 1.2) + 22 * hk * v * Math.sin(v * 5.5 + t * 1.1 + ph2) + b * 16 * hk * v * v * Math.cos(v * 8 + t * 0.8);
            br.push([col0(u) + off, y - u * h * lift - Math.sin(v * 6 + ph2 + t * 0.9) * 12 * hk * v * v]);
          }
          for (let j0 = 0; j0 < N; j0 += 4) {
            const v = (j0 + 2) / N, u = sp + v * (1 - sp);
            seg(br, j0, Math.min(N, j0 + 4), wd * (1 + u * 7) * (0.75 - 0.25 * v), a * 0.62 * Math.pow(1 - u * 0.8, 1.3) * Math.pow(1 - v, 1.4) * (b > 0 ? 1 : 0.8));
          }
        }
      }
    } else {
      const n = o.n ?? 14, w = o.w ?? 300, sz = o.size ?? 140, rise = o.rise ?? 40, life = o.life ?? 6, drift = o.drift ?? 14;
      const bursts = o.at != null || o.t0 != null || o.on ? fires(c, o, life * 1.3, t) : null;
      const list = [];
      if (bursts) for (const e of bursts) for (let i = 0; i < n; i++) list.push([i, e]);
      else for (let i = 0; i < n; i++) list.push([i, null]);
      const stamps = [];
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
      for (const [i, e] of list) {
        const sd = seed + (e ? e.k * 31 : 0), hA = h2(i, sd), hB = h2(i, sd + 1), hC = h2(i, sd + 2);
        let u, px, py, s, vx, vy;
        if (e) {
          const age = t - e.t0 - hA * 0.4;
          if (age < 0) continue;
          const L = life * (0.7 + 0.5 * hB);
          u = clamp(age / L);
          if (u >= 1) continue;
          const an = hB * TAU, sp0 = o.spread ?? 260, ee = easeOut(Math.min(1, u * 2.5)), d = sp0 * ee * (0.25 + 0.75 * hC);
          px = x + Math.cos(an) * d + drift * u * L; py = y + Math.sin(an) * d * 0.45 - rise * u * L; s = sz * (0.5 + 1.5 * ee) * (0.75 + 0.5 * hA);
          const dv = u < 0.4 ? 3 * Math.pow(1 - u * 2.5, 2) * sp0 * (0.4 + 0.6 * hC) / L : 0;
          vx = Math.cos(an) * dv + drift; vy = Math.sin(an) * dv * 0.5 - rise;
        } else {
          const L = life * (0.7 + 0.6 * hB), u0 = t / L + hA, cyc = Math.floor(u0);
          u = u0 - cyc;
          px = x + (h2(i * 13 + cyc, seed + 3) - 0.5) * w + drift * u * L + Math.sin(t * 0.3 + i) * 10; py = y - rise * u * L; s = sz * (0.45 + 0.9 * u) * (0.7 + 0.6 * hC);
          vx = drift + Math.cos(t * 0.3 + i) * 3; vy = -rise;
        }
        const al = a * smooth(u / 0.15) * Math.pow(1 - u, 1.3);
        if (al < 0.01) continue;
        // 烟团横着铺开，顺着飘动方向略斜、略拉长，速度越大拉得越长；再加一点慢慢的摆
        const sp1 = Math.hypot(vx, vy), st = 1.05 + Math.min(0.3, sp1 / 250);
        let tilt = Math.atan2(vy, vx);
        tilt = Math.atan2(Math.sin(tilt) * 0.25, Math.cos(tilt));
        const rot = tilt + 0.3 * Math.sin(t * 0.25 + hC * 9) + (hA - 0.5) * 0.5;
        stamps.push([i % 3, px, py, s * st, s * 0.82, rot, al]);
        const ext = s * st * 0.6;
        bx0 = Math.min(bx0, px - ext); bx1 = Math.max(bx1, px + ext); by0 = Math.min(by0, py - ext); by1 = Math.max(by1, py + ext);
      }
      if (stamps.length) viaScratch(g, 'smoke', [bx0, by0, bx1, by1], o.res ?? 0.35, 'source-over', GA, (q, m) => {
        for (const [v, px, py, sw, sh, rot, al] of stamps) { q.globalAlpha = clamp(al); putR(q, m, tint(puffTex(v), col), px, py, sw, sh, rot, 1); }
      });
    }
    g.restore();
  };

  // ---------- 红蒲公英絮 ----------
  function pappusTex(col, light) {
    col = qc(col); light = qc(light);
    return S('pappus|' + col + light, 64, 64, 1, (g) => {
      const cx = 32, cy = 24;
      g.lineCap = 'round';
      // 绒球的蓬松感：半透明的穹顶
      g.save(); g.beginPath(); g.rect(0, 0, 64, cy + 6); g.clip();
      A.softBlob(g, cx, cy, 22, 0.32, col);
      g.restore();
      for (let i = 0; i < 40; i++) {
        const an = -PI + (i / 39) * PI + Math.sin(i * 7.3) * 0.05, L = 19 + 4 * Math.sin(i * 3.7);
        const ex = cx + Math.cos(an) * L, ey = cy + Math.sin(an) * L * 0.9 + 3;
        g.strokeStyle = ca(i % 3 ? col : light, 0.8); g.lineWidth = 0.85;
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
    const sz = o.size || [7, 46], wind = o.wind ?? 28, rise = o.rise ?? 16, gust = o.gust ?? 30, night = isNight(c, o), gl = o.glow ?? (night ? 0.5 : 0), op = glowOp(c, o);
    const ar = o.area || [-40, -40, W + 40, H + 40], zr = o.layer === 'back' ? [0, 0.65] : o.layer === 'front' ? [0.65, 2] : [0, 2];
    const tab = table('fluff' + seed, n, (i) => ({ z: Math.pow(h2(i, seed), 1.4), x: h2(i, seed + 1), y: h2(i, seed + 2), v: h2(i, seed + 3), p: h2(i, seed + 4) * TAU, f: 0.5 + h2(i, seed + 5) }));
    const tex = pappusTex(col, light), sft = soft('pappus|' + qc(col) + qc(light), tex, 2.4), halo = glowTex(col), dot = sparkTex(cmix(col, light, 0.4));
    const sur = surge(c, 5) * gust, m = Mx(g), GA = enter(g), a = (o.alpha ?? 0.95) * GA;
    for (const q of tab) {
      if (q.z < zr[0] || q.z >= zr[1]) continue;
      const k = lerp(0.3, 1.4, q.z), s = lerp(sz[0], sz[1], q.z) * (0.8 + 0.4 * q.v);
      const spanY = ar[3] - ar[1] + s * 2, spanX = ar[2] - ar[0] + s * 2;
      const y = ar[1] - s + wrap(q.y * spanY - t * rise * k * (0.6 + 0.8 * q.v) + Math.sin(t * 0.8 * q.f + q.p) * 14 * k, 0, spanY);
      const x = ar[0] - s + wrap(q.x * spanX + t * wind * k + sur * k + Math.sin(t * 0.5 * q.f + q.p * 2) * 30 * k, 0, spanX);
      const rot = 0.3 * Math.sin(t * 0.7 * q.f + q.p) + 0.15;
      const al = a * lerp(0.45, 1, Math.min(1, q.z * 1.6));
      if (gl > 0 && q.z > 0.55) { g.globalCompositeOperation = op; g.globalAlpha = clamp(gl * al * (night ? 0.4 : 0.25)); g.drawImage(halo, x - s * 1.4, y - s * 1.6, s * 2.8, s * 2.8); g.globalCompositeOperation = 'source-over'; }
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
  // 时刻：at / t0（不给时为镜头起点），或 on:'down' 等踩点
  V.tear = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 300, s = o.s ?? 1, len = o.len ?? 60, ang = o.angle ?? 0.12, dur = o.dur ?? 2.2;
    const col = o.color || '#dcefff', well = 0.7, seed = o.seed ?? 181;
    const ev = once(c, o, well + dur + 3, t);
    // 多个时刻时取最近已经开始的那一个
    let t0 = 1e9;
    for (const e of ev) if (e.t0 <= t ? t0 > t || e.t0 > t0 : t0 > t && e.t0 < t0) t0 = e.t0;
    let age = t - t0;
    if (o.loop) age = ((age % o.loop) + o.loop) % o.loop;
    if (age < 0) return;
    const r = 2.6 * s * easeOut(clamp(age / well)), dx = Math.sin(ang), dy = Math.cos(ang);
    const ts = clamp((age - well) / dur);
    // 走走停停地滑：在若干处稍作停顿
    const u = ts <= 0 ? 0 : clamp(easeInOut(ts) + 0.04 * Math.sin(ts * PI * 4) * (1 - ts));
    const path = (uu) => [x + dx * len * uu + (noise1(uu * 3, seed) - 0.5) * 4 * s, y + dy * len * uu];
    const fall = Math.max(0, age - well - dur), [px, py] = path(u), cx = px, cy = py + 0.5 * 900 * fall * fall;
    // 泪痕在泪珠落下后一秒内干掉
    const fade = 1 - smooth(fall / 0.5), wet = 1 - smooth(fall / 1.1);
    if (wet <= 0) return;
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    // 泪痕：从眼角的细线渐渐粗到泪珠处，越近泪珠越湿亮
    if (u > 0.02) {
      const N = 14, Lf = [], Rt = [], C = [];
      for (let j = 0; j <= N; j++) {
        const uu = (u * j) / N, [qx, qy] = path(uu), w = s * (0.25 + 1.15 * Math.pow(j / N, 1.3));
        const [nx0, ny0] = path(Math.max(0, uu - 0.02)), [nx1, ny1] = path(uu + 0.02), tx = nx1 - nx0, ty = ny1 - ny0, l = Math.hypot(tx, ty) || 1;
        Lf.push([qx - (ty / l) * w, qy + (tx / l) * w]); Rt.push([qx + (ty / l) * w, qy - (tx / l) * w]); C.push([qx - (ty / l) * w * 0.4, qy + (tx / l) * w * 0.4]);
      }
      const gr = g.createLinearGradient(x, y, px, py);
      gr.addColorStop(0, ca(col, 0.08 * a * wet)); gr.addColorStop(0.7, ca(col, 0.22 * a * wet)); gr.addColorStop(1, ca(col, 0.34 * a * wet));
      g.fillStyle = gr;
      g.beginPath(); poly(g, Lf); for (let j = N; j >= 0; j--) g.lineTo(Rt[j][0], Rt[j][1]); g.closePath(); g.fill();
      // 一侧的细高光，与一点沿泪痕往下滑的闪光
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = ca('#ffffff', 0.12 * a * wet); g.lineWidth = Math.max(0.5, s * 0.3); g.lineCap = 'round';
      g.beginPath(); poly(g, C.slice(Math.floor(N * 0.3))); g.stroke();
      const gp = (age * 0.55) % 1, [gx, gy] = path(u * easeInOut(gp)), gr2 = s * 3.2;
      g.globalAlpha = clamp(a * wet * 0.55 * Math.sin(PI * gp));
      g.drawImage(sparkTex('#ffffff'), gx - gr2, gy - gr2, gr2 * 2, gr2 * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (fade > 0 && r > 0.05) {
      const st = fall > 0 ? Math.min(2, fall * 6) : u > 0 && u < 1 ? 0.5 : 0;
      // 很淡的一点晕（亮场里不画）
      if (isNight(c, o)) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = clamp(fade * 0.1 * a); g.drawImage(glowTex(col), cx - r * 3, cy - r * 3, r * 6, r * 6);
        g.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = fade;
      const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.2, r * 0.1, cx, cy, r * 1.4);
      gr.addColorStop(0, ca(col, 0.3 * a)); gr.addColorStop(0.7, ca(col, 0.55 * a)); gr.addColorStop(1, ca(cmix(col, '#203040', 0.5), 0.8 * a));
      g.fillStyle = gr; dropPath(g, cx, cy, r, st); g.fill();
      g.fillStyle = ca('#ffffff', 0.9 * a); g.beginPath(); g.ellipse(cx - r * 0.38, cy - r * 0.2, r * 0.2, r * 0.32, -0.4, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = ca(col, 0.5 * a); g.beginPath(); g.ellipse(cx + r * 0.2, cy + r * 0.62, r * 0.42, r * 0.18, 0, 0, TAU); g.fill();
    }
    g.restore();
  };

  // ---------- 火焰 ----------
  // 烛火的舌形：as 左右不对称（-1..1），tw 上半截的 S 形扭动
  function tongue(g, x, y, w, h, lean, as = 0, tw = 0) {
    const tx = x + lean, ty = y - h, wl = 0.62 * (1 + 0.3 * as), wr = 0.62 * (1 - 0.3 * as);
    g.beginPath();
    g.moveTo(tx, ty);
    g.bezierCurveTo(tx - w * 0.12 + tw * w * 0.3, ty + h * 0.3, x - w * wl, y - h * (0.4 + 0.08 * as), x - w * 0.5, y - h * 0.12);
    g.bezierCurveTo(x - w * 0.42, y + h * 0.05, x - w * 0.2, y + h * 0.09, x, y + h * 0.09);
    g.bezierCurveTo(x + w * 0.2, y + h * 0.09, x + w * 0.42, y + h * 0.05, x + w * 0.5, y - h * 0.12);
    g.bezierCurveTo(x + w * wr, y - h * (0.4 - 0.08 * as), tx + w * 0.12 + tw * w * 0.3, ty + h * 0.3, tx, ty);
    g.closePath();
  }
  // 火舌贴图（白色，用时染色）：六种不对称的形，底实、往上渐淡，边缘略柔。根部在 (0.5, 0.94)
  const NTONG = 6;
  const tongueTex = (v) => S('tongue' + v, 64, 128, 0.6, (g) => {
    const r = A.rng(900 + v * 17), bx = 32, by = 120, Hh = 110 + r() * 6;
    const tipx = 32 + (r() - 0.5) * 24, tipy = by - Hh, wl = 13 + r() * 7, wr = 13 + r() * 7, sl = (r() - 0.5) * 22, sr = (r() - 0.5) * 22;
    const gr = g.createLinearGradient(0, by + 4, 0, tipy);
    gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.12, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.8, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    if ('filter' in g) g.filter = `blur(${(2 * g.getTransform().a).toFixed(2)}px)`;
    g.fillStyle = gr;
    g.beginPath();
    // 尖细长、带 S 形扭动的火舌
    g.moveTo(tipx, tipy);
    g.bezierCurveTo(tipx + 2 + sr, tipy + Hh * 0.38, bx + wr * 1.1 - sr * 0.3, by - Hh * (0.42 + 0.1 * r()), bx + wr, by - Hh * 0.16);
    g.bezierCurveTo(bx + wr * 0.92, by - Hh * 0.02, bx + wr * 0.45, by + 4, bx, by + 4);
    g.bezierCurveTo(bx - wl * 0.45, by + 4, bx - wl * 0.92, by - Hh * 0.02, bx - wl, by - Hh * 0.16);
    g.bezierCurveTo(bx - wl * 1.1 - sl * 0.3, by - Hh * (0.42 + 0.1 * r()), tipx - 2 + sl, tipy + Hh * 0.38, tipx, tipy);
    g.closePath(); g.fill();
    g.filter = 'none';
  });
  // kind 'candle' 烛火 / 'torch' 火把 / 'fire' 火堆与火盆；x, y 为火焰根部；burn 0..1（残烛小而暗）；wind 吹斜
  // 火把与火堆：一根根火舌各自“生—升—断”，断下的火苗往上飘着熄掉；外层暗红正常叠，里层加色
  V.flame = function (g, c, o = {}) {
    const t = o.time ?? c.t, x = o.x ?? 640, y = o.y ?? 500, s = o.s ?? 1, kind = o.kind || 'candle', seed = o.seed ?? 191;
    const col = o.color || '#ff9a3a', core = o.core || '#fff4d0', wind = o.wind ?? 0, burn = o.burn ?? 1, gl = o.glow ?? 1, beat = o.beat ?? 0.3;
    const fl = 0.55 * noise1(t * 9, seed) + 0.3 * noise1(t * 23, seed + 1) + 0.15 * noise1(t * 47, seed + 2);
    const flare = 1 + beat * 0.14 * BE(c, 0.3);
    const GA = enter(g), a = (o.alpha ?? 1) * GA, op = glowOp(c, o), m = Mx(g);
    if (kind === 'candle') {
      const h = 34 * s * (0.84 + 0.3 * fl) * (0.45 + 0.55 * burn) * flare, w = 11 * s * (0.75 + 0.25 * burn);
      const lean = wind * h * 0.6 + (noise1(t * 2.6, seed + 3) - 0.5) * w * 0.9;
      const as = (noise1(t * 3.1, seed + 4) - 0.5) * 2, tw = (noise1(t * 4.3, seed + 5) - 0.5) * 2;
      // 光晕竖长，随火苗跳
      g.globalCompositeOperation = op;
      g.globalAlpha = clamp(0.3 * gl * a * (0.7 + 0.3 * fl) * (0.4 + 0.6 * burn)); const R = h * 4 * gl; g.drawImage(glowTex(col), x + lean * 0.3 - R * 0.8, y - h * 0.5 - R * 1.15, R * 1.6, R * 2.3);
      g.globalAlpha = clamp(0.45 * a * (0.8 + 0.2 * fl)); const R2 = h * 1.2; g.drawImage(glowTex(cmix(col, core, 0.5)), x + lean * 0.4 - R2 * 0.75, y - h * 0.5 - R2 * 1.1, R2 * 1.5, R2 * 2.2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      let gr = g.createLinearGradient(0, y - h, 0, y + h * 0.1);
      gr.addColorStop(0, ca(cmix(col, '#ff4020', 0.4), 0)); gr.addColorStop(0.25, ca(col, 0.7 * a)); gr.addColorStop(0.7, ca(cmix(col, core, 0.5), 0.95 * a)); gr.addColorStop(1, ca(col, 0.5 * a));
      g.fillStyle = gr; tongue(g, x, y, w, h, lean, as, tw); g.fill();
      gr = g.createLinearGradient(0, y - h * 0.62, 0, y);
      gr.addColorStop(0, ca(core, 0)); gr.addColorStop(0.4, ca(core, 0.9 * a)); gr.addColorStop(1, ca('#ffffff', 0.95 * a));
      g.fillStyle = gr; tongue(g, x, y - h * 0.04, w * 0.52, h * 0.6, lean * 0.6, as * 0.6, tw * 0.5); g.fill();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = ca('#6a8cff', 0.45 * a); g.beginPath(); g.ellipse(x, y - h * 0.02, w * 0.3, h * 0.09, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = ca('#140c08', 0.9 * a); g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x, y + 2 * s); g.quadraticCurveTo(x + 0.6 * s, y - h * 0.1, x + lean * 0.15, y - h * 0.18); g.stroke();
    } else {
      const fire = kind === 'fire', FW = (fire ? 120 : 34) * s, FH = (fire ? 150 : 90) * s * (0.5 + 0.5 * burn) * flare;
      // 竖长的暖光，忽明忽暗
      g.globalCompositeOperation = op;
      g.globalAlpha = clamp(0.4 * gl * a * (0.78 + 0.22 * fl)); const R = FH * 1.6 * gl * (0.95 + 0.1 * fl);
      g.drawImage(glowTex(col), x - R * 0.85 + wind * FH * 0.3, y - FH * 0.45 - R * 1.2, R * 1.7, R * 2.4);
      const layers = [[0, o.deep || '#a82014', fire ? 11 : 5, 1.05, 1.05, 0.62, 'source-over'], [1, col, fire ? 9 : 4, 0.82, 0.85, 0.62, 'lighter'], [2, core, fire ? 5 : 3, 0.45, 0.5, 0.5, 'lighter']];
      for (const [L, cc, nT, ww, hh, al, cop] of layers) {
        g.globalCompositeOperation = cop;
        // 火床：火舌根部一片炽热的光，把一根根火舌连成一团
        if (L === 1) { g.globalAlpha = clamp(0.55 * a * (0.85 + 0.15 * fl)); g.drawImage(glowTex(cmix(col, core, 0.3)), x - FW * 0.62, y - FH * 0.2, FW * 1.24, FH * 0.36); }
        for (let j = 0; j < nT; j++) {
          const sd = seed + j * 7 + L * 31, hA = h2(j, sd), hB = h2(j, sd + 1), hC = h2(j, sd + 2);
          // 每根火舌一个周期：长出来、往上蹿、尖上断开一截
          const P = (0.55 + 0.45 * hA) / (1 + 0.15 * L), ph = t / P + hB, cyc = Math.floor(ph), u = ph - cyc;
          const hv = hash(cyc * 7919 + sd * 13), v = Math.floor(hv * NTONG), kx = hash(cyc * 131 + sd) < 0.5 ? -1 : 1;
          const ux = nT === 1 ? 0.5 : (j + 0.5 * (hC - 0.5)) / (nT - 1);
          const dome = 0.45 + 0.55 * Math.sin(PI * (0.12 + 0.76 * ux));
          const hj = FH * hh * dome * (0.6 + 0.5 * hv) * (0.35 + 0.65 * smooth(u / 0.3)) * (1 - 0.25 * smooth((u - 0.65) / 0.35));
          const wj = (FW / nT) * 2.6 * ww * (0.85 + 0.3 * hC) * (1 - 0.25 * u);
          const xj = x + (ux - 0.5) * FW * 0.78 * ww + (noise1(t * 1.3 + j * 3.1, sd) - 0.5) * wj * 0.3;
          const rot = wind * 0.45 + (noise1(t * 2.2 + j * 1.9, sd + 1) - 0.5) * 0.36 + (ux - 0.5) * 0.12;
          const fa = al * a * smooth(u / 0.12) * (1 - smooth((u - 0.8) / 0.2));
          if (fa < 0.01) continue;
          g.globalAlpha = clamp(fa);
          putR(g, m, tint(tongueTex(v), cc), xj, y, wj, hj, rot, kx, 0.5, 0.94);
          // 断开的火苗：从火舌尖上脱出，边升边缩，熄掉
          if (L > 0 && u > 0.55 && hC < 0.75) {
            const lu = (u - 0.55) / 0.45, lh = hj * (0.28 - 0.18 * lu), ly = y - hj * (0.82 + 0.55 * lu), lx = xj + Math.sin(rot) * hj * (0.82 + 0.55 * lu) + wind * lu * FH * 0.2;
            g.globalAlpha = clamp(fa * (1 - lu) * (1 - lu) * smooth(lu / 0.15 + 0.2));
            putR(g, m, tint(tongueTex((v + 3) % NTONG), cc), lx, ly, lh * 0.4, lh, rot * 0.6, kx, 0.5, 0.94);
          }
        }
      }
      reset(g, m);
      g.globalCompositeOperation = 'source-over';
      g.restore();
      if (o.embers !== false) V.embers(g, c, { x0: x - FW * 0.35, x1: x + FW * 0.35, y: y - FH * 0.3, n: fire ? 26 : 10, rise: FH * 2.4, speed: 64 * s, wind: wind * 60, size: [1 * s, 3.6 * s], color: cmix(col, '#ff6020', 0.3), hot: '#fff0c0', seed: seed + 5, alpha: o.alpha ?? 1, time: o.time, blend: o.blend, night: o.night });
      return;
    }
    g.restore();
  };

  // ---------- 命运丝线 ----------
  // from/to 两端（或 lines: [[x0,y0,x1,y1], ...]）；sag 下垂；progress 牵线进度；strands 几股绞在一起；
  // snap 断线时刻（歌曲时间；或 snapAt 断在哪儿 0..1、snapIn 镜头内秒数）；拍点时一颗光珠沿线流过（on、every）
  V.threads = function (g, c, o = {}) {
    const t = o.time ?? c.t, col = o.color || '#e0262e', wd = o.width ?? 1.6, sag = o.sag ?? 60, wave = o.wave ?? 7;
    const gl = o.glow ?? 0.7, seed = o.seed ?? 201, prog = clamp(o.progress ?? 1), strands = o.strands ?? 1, braid = o.braid ?? 5;
    const lines = o.lines || [[...(o.from || [300, 420]), ...(o.to || [980, 420])]];
    const beats = o.pulse === false ? [] : fires(c, { on: o.on || 'beat', every: o.every || 2 }, 1.6, t);
    const halo = glowTex(col), dot = sparkTex(cmix(col, '#fff0e0', 0.6)), op = glowOp(c, o);
    const snapT = o.snapIn != null ? start(c, t) + o.snapIn : o.snap;
    const GA = enter(g), a = (o.alpha ?? 0.95) * GA;
    g.globalAlpha = 1;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const draw = (pts, alpha) => {
      g.globalCompositeOperation = op;
      g.strokeStyle = ca(col, 0.14 * gl * alpha); g.lineWidth = wd * 6;
      g.beginPath(); poly(g, pts); g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = ca(col, alpha); g.lineWidth = wd; g.stroke();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = ca(cmix(col, '#ffffff', 0.5), 0.35 * alpha); g.lineWidth = wd * 0.45; g.stroke();
      g.globalCompositeOperation = 'source-over';
    };
    lines.forEach((ln, li) => {
      const [x0, y0, x1, y1] = ln, ph = h2(li, seed) * TAU, L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      // 几股丝绕着彼此拧：每股偏开 braid 像素，两端收拢
      const pt = (u, k = 0) => {
        const w = wave * Math.sin(u * PI * 3 - t * 1.3 + ph) * Math.sin(PI * u) + Math.sin(t * 0.7 + ph) * 4 * Math.sin(PI * u);
        const tw = strands > 1 ? braid * Math.sin(u * L * 0.03 + (k * TAU) / strands + t * 0.5) * Math.pow(Math.sin(PI * u), 0.5) : 0;
        return [lerp(x0, x1, u) + nx * (w + tw), lerp(y0, y1, u) + ny * (w + tw) + sag * 4 * u * (1 - u)];
      };
      const N = 48, snapAge = snapT != null ? t - snapT : -1;
      if (snapAge < 0) {
        for (let k = 0; k < strands; k++) { const pts = []; for (let i = 0; i <= N; i++) pts.push(pt((i / N) * prog, k)); draw(pts, a * (strands > 1 ? 0.85 : 1)); }
        g.globalCompositeOperation = op;
        if (prog < 1) { const [ex, ey] = pt(prog); g.globalAlpha = a; g.drawImage(halo, ex - 24, ey - 24, 48, 48); g.drawImage(dot, ex - 8, ey - 8, 16, 16); }
        for (const e of beats) {
          const u = easeInOut(clamp((t - e.t0) / 1.4));
          if (u >= 1 || u > prog) continue;
          const [bx, by] = pt(u), al = a * Math.sin(PI * u);
          g.globalAlpha = clamp(al * 0.8); g.drawImage(halo, bx - 22, by - 22, 44, 44);
          g.globalAlpha = clamp(al); g.drawImage(dot, bx - 7, by - 7, 14, 14);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      } else {
        // 断线：两截从断口回弹，像被风吹的丝一样飘着垂下（只垂下约四成长度），断头打个卷，一秒多就淡没
        const sp = o.snapAt ?? 0.5, fade = a * (1 - smooth((snapAge - 0.3) / 0.9));
        if (fade <= 0) return;
        const [bx, by] = pt(sp), drop = 1 - Math.exp(-snapAge * 3);
        for (const side of [0, 1]) {
          const u0 = side ? 1 : 0, segU = side ? 1 - sp : sp, [ax, ay] = pt(u0), segL = L * segU;
          const M = 24, ds = (segL / M) * (1 - 0.22 * drop);
          const th0 = Math.atan2(by - ay, bx - ax), dth = Math.atan2(Math.sin(PI / 2 - th0), Math.cos(PI / 2 - th0));
          const sgn = side ? 1 : -1, pts = [[ax, ay]];
          let px = ax, py = ay;
          for (let i = 1; i <= M; i++) {
            const v = i / M, uo = lerp(u0, sp, v), uo0 = lerp(u0, sp, v - 1 / M), [qx, qy] = pt(uo), [rx, ry] = pt(uo0);
            const hOrig = Math.atan2(qy - ry, qx - rx), hHang = th0 + dth * 0.55 * Math.pow(v, 1.2);
            const flutter = Math.sin(v * 7 - snapAge * 11 + ph) * 0.5 * v * Math.exp(-snapAge * 1.6);
            const curl = sgn * 3.2 * Math.pow(smooth((v - 0.72) / 0.28), 1.5) * drop;
            const hd = hHang + Math.atan2(Math.sin(hOrig - hHang), Math.cos(hOrig - hHang)) * (1 - drop) + flutter + curl;
            px += Math.cos(hd) * ds; py += Math.sin(hd) * ds;
            pts.push([px, py]);
          }
          draw(pts, fade);
        }
        if (snapAge < 0.5) {
          g.globalCompositeOperation = op; g.globalAlpha = clamp((1 - snapAge / 0.5) * a);
          g.drawImage(halo, bx - 50, by - 50, 100, 100);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
          g.globalAlpha = GA;
          V.sparks(g, c, { x: bx, y: by, t0: snapT, n: 18, speed: 260, gravity: 500, dur: 0.6, color: col, hot: '#ffe8d8', size: 0.7, seed: seed + 3, time: o.time, alpha: o.alpha ?? 0.95, blend: o.blend, night: o.night });
          g.globalAlpha = 1;
        }
      }
    });
    g.restore();
  };

  // ---------- 剑气 ----------
  // kind 'crescent'：月牙形剑气飞出（x, y 起点，angle 方向，dist 飞行距离）；'slash'：一道斩线（从 x,y 到 x2,y2）
  // at / t0 指定（不给时为镜头起点），或 on:'down' / 'beat' 踩点发出
  V.swordQi = function (g, c, o = {}) {
    const t = o.time ?? c.t, kind = o.kind || 'crescent', col = o.color || '#a6e2ff', core = o.core || '#ffffff', seed = o.seed ?? 211;
    const dur = o.dur ?? (kind === 'slash' ? 0.9 : 0.85), wd = o.width ?? 1;
    const ev = once(c, o, dur, t);
    const halo = glowTex(col), dot = sparkTex(cmix(col, core, 0.5));
    const GA = enter(g), a = (o.alpha ?? 1) * GA;
    g.globalAlpha = 1;
    g.globalCompositeOperation = glowOp(c, o);
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
      // 一直往前飞（只略减速），最后两成时间里淡掉，不会停在半路成一道灰弧
      const travel = (u) => { u = clamp(u); return u * (1.3 - 0.3 * u); };
      const u = age / dur, fa = Math.pow(1 - u, 0.6) * (1 - smooth((u - 0.7) / 0.3)) * a;
      // 拖影：月牙外弧此刻与 0.12 秒前的位置之间扫过的一片，向后渐隐
      const arcAt = (aa, sp) => {
        const p = travel(aa / dur), cx = ox + Math.cos(ang) * dist * p, cy = oy + Math.sin(ang) * dist * p, R = R0 * (0.65 + 0.55 * p);
        const pts = [];
        for (let i = 0; i <= 12; i++) { const an = ang - sp / 2 + (sp * i) / 12; pts.push([cx + Math.cos(an) * R, cy + Math.sin(an) * R]); }
        return pts;
      };
      // 三层由窄到宽叠起来，两端自然变淡
      for (const [k, al] of [[1, 0.1], [0.66, 0.14], [0.33, 0.2]]) {
        const A1 = arcAt(age, span * k), A0 = arcAt(Math.max(0, age - 0.12), span * k);
        const sg = g.createLinearGradient(A0[6][0], A0[6][1], A1[6][0], A1[6][1]);
        sg.addColorStop(0, ca(col, 0)); sg.addColorStop(1, ca(col, clamp(al * 2 * fa)));
        g.fillStyle = sg;
        g.beginPath();
        A1.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        for (let i = 12; i >= 0; i--) g.lineTo(A0[i][0], A0[i][1]);
        g.closePath(); g.fill();
      }
      // 月牙本体：外晕、主体、白色锋口三层
      const p = travel(u), cx = ox + Math.cos(ang) * dist * p, cy = oy + Math.sin(ang) * dist * p;
      const R = R0 * (0.65 + 0.55 * p), th = R * 0.24 * (1 - 0.5 * p) * wd;
      const ix = cx - Math.cos(ang) * th, iy = cy - Math.sin(ang) * th;
      for (const [lw, cc, al] of [[1.25, col, 0.22], [1, col, 0.6], [0.55, core, 0.95]]) {
        g.fillStyle = ca(cc, clamp(al * fa));
        g.beginPath();
        g.arc(cx, cy, R, ang - span / 2, ang + span / 2);
        g.arc(ix, iy, R * (1 - 0.06 * lw) + th * (lw - 1) * -0.6, ang + (span / 2) * (0.92 + 0.05 * lw), ang - (span / 2) * (0.92 + 0.05 * lw), true);
        g.closePath(); g.fill();
      }
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
    g.restore();
  };

  // ---------- 调色 ----------
  // 每个预设是几层全屏混合，只用纯色（软件渲染下渐变与放大贴图很贵）：fill 纯色；v 竖向渐变，用 24 条纯色横带拼出来。
  // multiply 压暗染色、screen 提亮暗部。调用时所有 multiply 层合成一层、所有 screen 层合成一层：
  // 透明度 al 的 multiply 等于颜色 lerp(白, col, al) 的不透明 multiply，两层相乘即合成；screen 同理（1-(1-s1)(1-s2)），所以混几种预设也只画两遍
  const GRADES = {
    autumn: [['multiply', 'v', ['#ffcf94', '#ffc07a', '#e48e58'], 0.6], ['screen', 'fill', '#4a2208', 0.32]],
    dusk: [['multiply', 'v', ['#a8a0e0', '#eab0c0', '#ffbc8a'], 0.55], ['screen', 'v', ['#1a1438', '#2a1430', '#3a1a10'], 0.4]],
    night: [['multiply', 'v', ['#5668b8', '#6c7ec4', '#4a5698'], 0.6], ['screen', 'fill', '#0a1434', 0.4]],
    storm: [['multiply', 'v', ['#7a8a9c', '#909eac', '#6a7a88'], 0.6], ['screen', 'fill', '#18242c', 0.45]],
    snow: [['multiply', 'v', ['#d4e2ff', '#eef4ff', '#c4d2ec'], 0.5], ['screen', 'fill', '#34445c', 0.32]],
    // 血：往暗红里压，不往粉里提
    blood: [['multiply', 'v', ['#b84a44', '#b04040', '#8a2a2c'], 0.62], ['screen', 'fill', '#200000', 0.15]],
    gold: [['multiply', 'v', ['#ffe4a8', '#ffd488', '#e8a860'], 0.55], ['screen', 'fill', '#3a2000', 0.3]],
    dream: [['screen', 'v', ['#4a3058', '#3e2c50', '#2c2c5e'], 0.42], ['multiply', 'v', ['#fff0f8', '#fbe8f6', '#e8e0ff'], 0.5]],
  };
  const BANDS = 24;
  const bandMemo = new Map();
  // 某一层在第 i 条横带的颜色（0..1 的 rgb）
  function layerBand(type, val, i) {
    if (type === 'fill') return rgb(val);
    const u = (i + 0.5) / BANDS, f = u * (val.length - 1), j = Math.min(val.length - 2, Math.floor(f)), p = rgb(val[j]), q = rgb(val[j + 1]), k = f - j;
    return [lerp(p[0], q[0], k), lerp(p[1], q[1], k), lerp(p[2], q[2], k)];
  }
  // 把 {预设: 量} 合成两组横带：M（multiply）与 S（screen）；全白/全黑的就省掉
  function compose(mix) {
    const key = Object.entries(mix).map(([p, k]) => p + ':' + k.toFixed(3)).join(',');
    let r = bandMemo.get(key);
    if (r) return r;
    const M = [], Sc = [];
    let mOn = false, sOn = false;
    for (let i = 0; i < BANDS; i++) {
      const m = [1, 1, 1], s = [1, 1, 1];
      for (const [p, k] of Object.entries(mix)) for (const [op, type, val, al] of GRADES[p]) {
        const cc = layerBand(type, val, i), w = clamp(al * k);
        for (let ch = 0; ch < 3; ch++) {
          const v = cc[ch] / 255;
          if (op === 'multiply') m[ch] *= lerp(1, v, w);
          else s[ch] *= 1 - v * w;
        }
      }
      const mc = '#' + hx(m[0] * 255) + hx(m[1] * 255) + hx(m[2] * 255), sc = '#' + hx((1 - s[0]) * 255) + hx((1 - s[1]) * 255) + hx((1 - s[2]) * 255);
      if (mc !== '#ffffff') mOn = true;
      if (sc !== '#000000') sOn = true;
      M.push(mc); Sc.push(sc);
    }
    r = { M: mOn ? M : null, S: sOn ? Sc : null };
    if (bandMemo.size > 400) bandMemo.clear();
    bandMemo.set(key, r);
    return r;
  }
  // grade(g, preset, amount=1)：在屏幕空间叠加调色，不受镜头推拉影响；也接受 grade(g, c, preset, amount)
  // preset 也可以是 {snow: 0.4, blood: 0.5} 这样的混合，一次画完（最多两遍全屏）；amount 再乘到每一项上。量会量化到 1/64，便于缓存
  V.grade = function (g, preset, amt, extra) {
    if (preset && typeof preset === 'object' && (preset.t != null || preset.b != null || preset.lt != null)) { preset = amt; amt = extra; }
    const k0 = clamp(amt ?? 1), mix = {};
    let any = false;
    if (typeof preset === 'string') { if (GRADES[preset] && k0 > 0.001) { mix[preset] = Math.round(k0 * 64) / 64; any = mix[preset] > 0; } }
    else if (preset) for (const [p, v] of Object.entries(preset)) { const k = Math.round(clamp(v * k0) * 64) / 64; if (GRADES[p] && k > 0) { mix[p] = k; any = true; } }
    if (!any) return;
    const { M, S: Sc } = compose(mix);
    const cw = g.canvas.width, ch = g.canvas.height, GA = g.globalAlpha;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = GA;
    for (const [op, b] of [['multiply', M], ['screen', Sc]]) {
      if (!b) continue;
      g.globalCompositeOperation = op;
      let i = 0;
      while (i < BANDS) {
        // 相邻同色的横带并成一块
        let j = i + 1;
        while (j < BANDS && b[j] === b[i]) j++;
        const y0 = Math.round((i * ch) / BANDS), y1 = Math.round((j * ch) / BANDS);
        g.fillStyle = b[i]; g.fillRect(0, y0, cw, y1 - y0);
        i = j;
      }
    }
    g.restore();
  };
  V.GRADES = Object.keys(GRADES);
  V.util = { surge, fires, once, start, isNight, glowOp, table, Mx, setL, putR, reset, poly, glowTex, sparkTex, bokehTex, flakeTex, petalTex, soft, tint, qc, ca, cmix, wrap, viaScratch };

  // 也接受 env 风格的两参调用 V.xxx(g, {…, t})：没有镜头上下文时，用 opts.t（或 time）当时间、镜头起点当 0
  for (const name of Object.keys(V)) {
    const f = V[name];
    if (typeof f !== 'function' || name === 'grade' || name === 'at') continue;
    V[name] = function (g, c, o) {
      if (o === undefined && c && c.be === undefined && c.b === undefined && c.grid === undefined) { o = c; c = { t: o.t ?? o.time ?? 0, lt: o.t ?? o.time ?? 0 }; }
      return f(g, c, o || {});
    };
  }

  // ---------- 预览镜头 ----------
  if (!XYT.registerShot) return;
  const shot = (id, def) => XYT.registerShot('kit_vfx_' + id, Object.assign({ zone: 'bottom', text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6' }, def));
  const E = () => XYT.env, F = () => XYT.fig;

  // 客栈：窗里斜进来的光柱与浮尘（岁月难得沉默）
  shot('rays', {
    name: '特效·光柱浮尘', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t;
      E().candleRoom(g, { t, burn: 0.6, sky: 'dawn', winX: 760, candleX: 330 });
      V.godRays(g, c, { x: 1000, y: 150, angle: 2.42, spread: 0.5, n: 11, len: 1350, start: 0.2, color: '#ffdcaa', alpha: 0.3, motes: 100 });
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
      V.petals(g, c, { kind: 'peach', n: 60, layer: 'back' });
      F().draw(g, 'linger', 660, 640, 1.25, t, { pose: 'dance', wind: 0.6, rim: '#fff4e6' });
      V.butterflies(g, c, { n: 5, area: [380, 300, 1000, 560], size: [12, 22], colors: [['#fff2f6', '#e88aa8'], ['#fff6dc', '#e2a85a']], glow: 0.4, trail: 0.6 });
      V.petals(g, c, { kind: 'peach', n: 60, layer: 'front' });
      V.bokeh(g, c, { n: 10, colors: ['#ffd8e2', '#fff2e0'], alpha: 0.22 });
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
      V.snow(g, c, { n: 190, red, redKind: 'petal', layer: 'back' });
      F().draw(g, 'xiaoyao', 620, 640, 1.3, t, { stage: 'old', pose: 'kneel', wind: 0.4, rim: '#e8eef8' });
      V.snow(g, c, { n: 190, red, redKind: 'petal', layer: 'front' });
      V.grade(g, { snow: 1 - red * 0.8, blood: red * 0.75 });
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
      V.godRays(g, c, { x: 360, y: 230, angle: 0.75, spread: 1.4, n: 7, color: '#ffd8b0', alpha: 0.11, len: 1200, source: false });
      E().dandelions(g, { t, y: 740, x0: -40, x1: W + 40, n: 40, color: '#e8423a', wind: 0.6, s: 1.3 });
      V.fluff(g, c, { n: 100, layer: 'back' });
      F().draw(g, 'linger', 600, 660, 1.3, t, { pose: 'lookBack', wind: 0.7, rim: '#ffe6c0' });
      V.fluff(g, c, { n: 100, layer: 'front' });
      V.bokeh(g, c, { n: 7, colors: ['#ff9a8a', '#ffd8c0'], alpha: 0.2, size: [30, 90] });
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
      V.butterflies(g, c, { n: 22, from: { x: 560, y: 520, at: 1.5, dur: 4.5, stagger: 3, w: 70, h: 200 }, area: [600, 60, 1180, 460], size: [10, 26], glow: 0.7, trail: 0.8 });
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
      V.swordQi(g, c, { kind: 'slash', at: [2.2, 7.8], x: 520, y: 260, x2: 1180, y2: 560, color: '#ffd0a0' });
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
      V.shatter(g, c, { x: 640, y: 320, r: 170, n: 42, img: dreamImg(), at: 4.2, crack: 2, dur: 3.2, kind: 'light', color: '#ffd8ec', force: 300, gravity: 200 });
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
      V.inkBloom(g, c, { kind: 'water', x: 1040, y: 220, at: 0.3, r: 180, dur: 5, fade: 6, color: '#2a2630' });
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
      V.threads(g, c, { from: [414, 461], to: [884, 477], sag: 50, progress: smooth(lt / 2), snapIn: 7.2, strands: 2 });
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

  // 女娲：灵儿升起于湖面，五灵珠绕身（身后半圈、身前半圈分两次画），肩头飘带，比翼鸟飞过满月
  shot('orbs', {
    name: '特效·五灵珠', night: true, bloom: 0.6,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 500, rise = easeOut(clamp(lt / 4)) * 40;
      E().sky(g, { top: '#060a1c', mid: '#1a2850', bottom: '#3a4a78', y1: hz, haze: '#6a7ab0', hazeY: hz, hazeA: 0.45 });
      E().stars(g, { t, n: 90, maxY: 380, seed: 14 });
      E().moon(g, { x: 900, y: 170, r: 70, color: '#f4ecd0', glow: 0.6 });
      V.birds(g, c, { kind: 'pair', y: 175, x: 200, speed: 50, size: 1.3 });
      const back = (q) => E().mountains(q, { t: lt, n: 2, far: '#2a3a68', near: '#18223e', y0: hz - 30, y1: hz, scale: 0.45, light: '#8aa0d8' });
      back(g);
      E().water(g, { y: hz, t, top: '#2a3a62', bottom: '#060a16', reflectFn: back, reflect: 0.5, glint: { x: 900, color: '#f6e6bd', w: 34, a: 0.5 } });
      V.ripples(g, c, { x: 640, y: 640, on: 'beat', r: 160, color: '#bfe8ff', alpha: 0.5, rings: 3 });
      const cy = 640 - rise;
      V.glowOrbs(g, c, { x: 640, y: cy - 110, r: 150, tilt: 0.3, layer: 'back', size: 11 });
      V.ribbons(g, c, { anchor: [628, cy - 150], angle: PI * 0.92, len: 420, n: 2, amp: 40, width: 16, colors: ['#e8f2ff', '#cfe6f2'], droop: 0.12, glow: 0.5 });
      V.ribbons(g, c, { anchor: [652, cy - 150], angle: PI * 0.08, len: 380, n: 1, amp: 36, width: 14, colors: ['#e8f2ff'], droop: 0.14, glow: 0.5, seed: 9 });
      F().draw(g, 'linger', 640, cy, 1.25, t, { form: 'nuwa', wind: 0.7, rim: '#c8fff6', glow: 0.5, glowColor: '#9fe8ff' });
      V.glowOrbs(g, c, { x: 640, y: cy - 110, r: 150, tilt: 0.3, layer: 'front', size: 11 });
      V.bokeh(g, c, { n: 12, colors: ['#9fd8ff', '#e8d8ff'], alpha: 0.18, size: [30, 90] });
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
      V.smoke(g, c, { kind: 'puff', x: 640, y: 600, w: 900, n: 8, size: 220, rise: 24, color: '#4a3a50', alpha: 0.45 });
      for (const x of [300, 980]) {
        g.fillStyle = '#1a1214'; g.beginPath(); g.moveTo(x - 70, 560); g.lineTo(x + 70, 560); g.lineTo(x + 40, 610); g.lineTo(x - 40, 610); g.closePath(); g.fill();
        g.fillRect(x - 10, 610, 20, 40); g.fillRect(x - 40, 646, 80, 10);
        V.flame(g, c, { kind: 'fire', x, y: 562, s: 0.9, wind: 0.15, seed: x });
      }
      for (const x of [520, 760]) { g.fillStyle = '#20161a'; g.fillRect(x - 4, 470, 8, 180); V.flame(g, c, { kind: 'torch', x, y: 472, s: 0.6, seed: x + 3 }); }
      F().draw(g, 'baiyue', 640, 660, 1.1, t, { pose: 'summon', rim: '#ff9a5a', glow: 0.3, glowColor: '#8a6cff' });
      V.smoke(g, c, { kind: 'puff', x: 640, y: 560, at: 4, n: 12, size: 170, spread: 340, life: 4, color: '#2a2030', alpha: 0.55 });
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
