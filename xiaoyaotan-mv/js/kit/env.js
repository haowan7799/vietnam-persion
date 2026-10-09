/* 逍遥叹 · 音乐动画 —— 工具包·场景（XYT.env）：天光、山水、草木、楼阁与器物
 *
 * 用法约定：
 * - 每个函数 fn(g, opts)，1280×720 逻辑坐标；动画全由 t 驱动，不存帧间状态。
 * - 透明度：调用前设 g.globalAlpha 就能把整个元素一起淡入淡出；函数自己的 alpha 参数与它相乘。
 * - 缓存：静态部分都烘成贴图（总量有上限，旧的自动丢弃）。可放心逐帧变的：t、位置（x、y、x0、offset）、
 *   alpha、sway、wind、lit、open、burn、fade、broken、red/redAt、progress、光源位置（院墙 lightX）。
 *   尺寸（h、r、s）按档建图再缩放，慢慢变也行；颜色按每通道 8 级一档建图，逐帧渐变会每隔几帧重建一次，
 *   宜用两层交叉淡化代替改色。
 * - 画面不会每帧清空：天、地、水要铺满整幅（推拉镜头时多铺出一些），否则会透出上一帧。
 * - E.warm() 预热常用贴图（页面空闲时也会自动预热），E.stats() 查看缓存。
 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, h2, rng, noise1, noise2, rgba, mix } = A;
  const PI = Math.PI;
  const E = (XYT.env = XYT.env || {});
  const sp = () => XYT.sprites;

  // ---------- 通用 ----------
  // 整体透明度：每个导出函数进入时记下 g.globalAlpha 为 A0，内部设透明度都乘上它，退出时还原。
  // 镜头里先 g.globalAlpha = 0.4 再调用任何函数，就能让它整体淡入淡出
  let A0 = 1;
  const al = (g, a) => { g.globalAlpha = A0 * a; };
  // 函数自己的 alpha 参数：并进本次调用的整体透明度（退出时由外层包装还原），里面所有光斑、粒子都跟着淡
  const fade = (g, a) => { if (a != null && a !== 1) { A0 *= clamp(a); g.globalAlpha = A0; } };
  // 颜色量化（每通道 8 级一档）：用于缓存键与着色副本，逐帧渐变的颜色也只落到有限几档
  const qcMemo = new Map();
  function qc(c) {
    if (typeof c !== 'string' || c.length !== 7 || c[0] !== '#') return c;
    let r = qcMemo.get(c);
    if (r) return r;
    const v = parseInt(c.slice(1), 16), q = (x) => Math.min(255, Math.round(x / 8) * 8).toString(16).padStart(2, '0');
    r = '#' + q((v >> 16) & 255) + q((v >> 8) & 255) + q(v & 255);
    if (qcMemo.size > 4096) qcMemo.clear();
    qcMemo.set(c, r);
    return r;
  }
  // 光斑：同 A.glow，但乘整体透明度，且不改动调用前的透明度
  function glow(g, x, y, r, col, a) {
    if (!(a > 0) || !(r > 0)) return;
    const p = g.globalAlpha;
    g.globalAlpha = A0 * Math.min(1, a);
    g.drawImage(col ? sp().tint(sp().glow, qc(col)) : sp().glow, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = p;
  }
  // 径向渐变：两个圆心可不同（K.rad 只支持同心）
  function rad(g, x0, y0, r0, x1, y1, r1, stops) {
    const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    return gr;
  }
  // 大面积竖向渐变：预渲染成 2 像素宽的竖条再拉伸贴上（比逐帧渐变填充快数倍）；有上限的缓存，逐帧变色也不会无限增长
  const vstore = new Map();
  function vfill(g, x0, y0, x1, y1, stops, alpha) {
    const S = sp().S, n = Math.max(2, Math.min(1024, Math.round((y1 - y0) * S)));
    const key = n + JSON.stringify(stops);
    let c = vstore.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = 2; c.height = n;
      const q = c.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, n);
      stops.forEach(([o, col]) => gr.addColorStop(clamp(o), col));
      q.fillStyle = gr; q.fillRect(0, 0, 2, n);
      if (vstore.size > 96) vstore.delete(vstore.keys().next().value);
      vstore.set(key, c);
    }
    const sm = g.imageSmoothingEnabled, a0 = g.globalAlpha;
    g.imageSmoothingEnabled = false;
    if (alpha != null) g.globalAlpha = a0 * alpha;
    g.drawImage(c, x0, y0, x1 - x0, y1 - y0);
    g.imageSmoothingEnabled = sm; g.globalAlpha = a0;
  }
  const shade = (c, k) => (k < 0 ? mix(c, '#000000', -k) : mix(c, '#ffffff', k));
  const hex = (c) => { const v = parseInt(c.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  // 贴图缓存：名字 + 影响外观的参数做键（数值保留三位小数，颜色量化）；按当前分辨率缓存。
  // 只放离散或量化过的参数；位置一律在贴图的局部坐标里画、贴的时候再平移。
  // 总像素超出预算时丢掉最久没用的，逐帧变化的参数也不会把内存撑爆
  const store = new Map();
  let storePx = 0, builds = 0, lastBuilt = '';
  const BUDGET = 40e6;
  const num = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : typeof v === 'string' ? qc(v) : v);
  function cached(name, parts, w, h, sc, fn) {
    const S = sp().S * (sc || 1), key = name + '|' + parts.map(num).join('|') + '@' + S.toFixed(3);
    let c = store.get(key);
    if (c) { store.delete(key); store.set(key, c); return c; }
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * S)); c.height = Math.max(1, Math.round(h * S));
    const q = c.getContext('2d');
    q.scale(S, S);
    const p = A0; A0 = 1;
    try { fn(q); } finally { A0 = p; }
    c.lw = w; c.lh = h;
    builds++; lastBuilt = key;
    store.set(key, c); storePx += c.width * c.height;
    while (storePx > BUDGET && store.size > 1) { const [k0, c0] = store.entries().next().value; store.delete(k0); storePx -= c0.width * c0.height; }
    return c;
  }
  // 尺寸分档：连续变化的尺寸按档建贴图，贴的时候再缩放
  const bucket = (v, step) => Math.max(step, Math.ceil(v / step) * step);
  // 贴图快路：变换只有平移和缩放、贴图像素与目标大小一致时，对齐到整设备像素直接拷贝（不走双线性插值，快好几倍）；
  // 否则照常插值贴。静止的大贴图（街景、殿内、院墙）都走这里
  function blit(g, img, x, y, w, h) {
    const m = g.getTransform();
    if (m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0 && Math.abs(m.a * w - img.width) < 0.6 && Math.abs(m.d * h - img.height) < 0.6) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(img, Math.round(m.a * x + m.e), Math.round(m.d * y + m.f));
      g.setTransform(m);
    } else g.drawImage(img, x, y, w, h);
  }
  // 建筑贴图的分辨率档：s 落在 0.05 的格上就按 s 本身建（能走快路），否则按 0.25 一档
  const sqOf = (s) => (Math.abs(s * 20 - Math.round(s * 20)) < 1e-6 ? Math.max(0.3, s) : Math.max(0.5, Math.round(s * 4) / 4));
  // 按锚点贴缓存图：ax、ay 为锚点在图中的比例
  function put(g, c, x, y, s = 1, ax = 0.5, ay = 1) { g.drawImage(c, x - c.lw * s * ax, y - c.lh * s * ay, c.lw * s, c.lh * s); }
  // 题字用的书法字体按需加载；没加载好时缓存键不同，加载后自动重画
  const GLYPHS = '客栈酒茶囍比武招亲水月宫锁妖塔女娲福林李逍遥忆如仙灵岛拜南诏蜀山剑神镇封印符敕令当铺余杭';
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', GLYPHS).catch(() => {}); } catch (e) { /* 无字体接口 */ }
  // 字体就绪后结果不会再变，记下来（document.fonts.check 每帧调用很贵）
  const fontOk = new Set();
  const fontKey = (txt) => {
    if (fontOk.has(txt)) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', txt)) { fontOk.add(txt); return 'f'; } } catch (e) { /* 无字体接口 */ }
    return 'n';
  };
  // 烛火闪烁：确定性的多频噪声
  const flick = (t, s) => 0.55 * noise1(t * 9, s) + 0.3 * noise1(t * 23, s + 1) + 0.15 * noise1(t * 47, s + 2);
  // 每帧复用的离屏缓冲（倒影用）：每次使用前清空，不跨帧保存内容
  let scratch = null;
  function scratchCtx(lw, lh, k = 1) {
    const S = sp().S * k, pw = Math.ceil(lw * S), ph = Math.ceil(lh * S);
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width < pw || scratch.height < ph) { scratch.width = Math.max(scratch.width, pw); scratch.height = Math.max(scratch.height, ph); }
    const g = scratch.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.setTransform(S, 0, 0, S, 0, 0);
    return g;
  }
  // 单色副本：同形状、填成一种颜色（布料暗面、雾化、轮廓墨线用）；随原图一起回收，每张原图最多留 keep 种颜色
  const tintMap = new WeakMap();
  function tintOf(img, col, keep = 16) {
    let m = tintMap.get(img);
    if (!m) { m = new Map(); tintMap.set(img, m); }
    const k = qc(col || '#000000');
    let c = m.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width; c.height = img.height; c.lw = img.lw; c.lh = img.lh; c.L = img.L; c.Hm = img.Hm;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = k; g.fillRect(0, 0, c.width, c.height);
      m.set(k, c);
      if (m.size > keep) m.delete(m.keys().next().value);
    }
    return c;
  }
  // 着色后直接画进 g（借一块复用的缓冲，不留副本）：建贴图时用，颜色逐帧变也不攒内存
  let tsc = null;
  function tintDraw(g, src, col, w, h) {
    if (!tsc) tsc = document.createElement('canvas');
    if (tsc.width < src.width || tsc.height < src.height) { tsc.width = Math.max(tsc.width, src.width); tsc.height = Math.max(tsc.height, src.height); }
    const q = tsc.getContext('2d');
    q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, src.width, src.height); q.drawImage(src, 0, 0);
    q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, src.width, src.height);
    g.drawImage(tsc, 0, 0, src.width, src.height, 0, 0, w ?? src.width, h ?? src.height);
  }
  // 贴图并按 haze 融进空气：远处的建筑贴完再叠一层同形状的雾色（hazeA 为 0 时走 blit 快路）
  function putHazed(g, img, x, y, w, h, haze, hazeA) {
    blit(g, img, x, y, w, h);
    if (haze && hazeA > 0) { const p = g.globalAlpha; g.globalAlpha = p * Math.min(1, hazeA); g.drawImage(tintOf(img, haze), x, y, w, h); g.globalAlpha = p; }
  }
  // 水墨描边：给缓存好的器物贴图加一圈粗细不匀的墨线（背光一侧粗），再压一层纸纹，让平涂的块面像画出来的
  function inkEdge(tex, o = {}) {
    const ink = o.ink || '#1a1512', k = tex.width / tex.lw, wgt = (o.w ?? 1.2) * k;
    const c = document.createElement('canvas');
    c.width = tex.width; c.height = tex.height; c.lw = tex.lw; c.lh = tex.lh;
    const g = c.getContext('2d'), dark = tintOf(tex, ink);
    // 八个方向错位叠墨：右下（背光）重、左上轻，形成有提按的轮廓
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.3, f = 0.55 + 0.45 * Math.cos(a - PI / 4);
      g.globalAlpha = (o.a ?? 0.75) * (0.35 + 0.65 * f);
      g.drawImage(dark, Math.cos(a) * wgt * (0.6 + 0.8 * f), Math.sin(a) * wgt * (0.6 + 0.8 * f));
    }
    g.globalAlpha = 1;
    g.drawImage(tex, 0, 0);
    if (o.grain !== false && sp().paper) {
      // 纸纹：正片叠底一层，再用原形状裁回
      const keep = document.createElement('canvas'); keep.width = c.width; keep.height = c.height;
      keep.getContext('2d').drawImage(c, 0, 0);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = o.grain ?? 0.35;
      g.fillStyle = g.createPattern(sp().paper, 'repeat'); g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(keep, 0, 0);
    }
    return c;
  }
  // 布面飘动：把贴图切条错位。axis 'y'：挂在上边（幡、纱、帘），横条左右摆；axis 'x'：挂在左边（旗），竖条上下摆。
  // 条数按摆幅自动加密（相邻两条错开约 1.8 像素以内，最多 36 条），不出明显台阶
  function cloth(g, img, x, y, w, h, t, o = {}) {
    const amp = o.amp ?? 6, fr = o.freq ?? 1.3, spd = o.speed ?? 3, ph = o.phase || 0, dk = o.shade ?? 0.35, pw = o.pow ?? 1;
    const n = Math.min(36, Math.max(o.n || 16, Math.ceil((Math.abs(amp) * fr * TAU + Math.abs(o.bias || 0) * pw) / 1.8)));
    const r = img.width / img.lw, dark = dk > 0 ? tintOf(img) : null;
    const a0 = g.globalAlpha;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, u = (u0 + u1) / 2, k = Math.pow(u, pw);
      const wave = t * spd - u * fr * TAU + ph;
      const d = Math.sin(wave) * amp * k + (o.bias || 0) * k;
      const sl = Math.cos(wave) * k;
      if (o.axis === 'x') {
        const sx = u0 * img.lw * r, sw = (u1 - u0) * img.lw * r + 1;
        const dx = x + u0 * w, dw = (u1 - u0) * w + 0.7, dy = y + d;
        g.drawImage(img, sx, 0, sw, img.height, dx, dy, dw, h);
        if (dark && sl > 0) { g.globalAlpha = a0 * sl * dk; g.drawImage(dark, sx, 0, sw, img.height, dx, dy, dw, h); g.globalAlpha = a0; }
      } else {
        const sy = u0 * img.lh * r, sh = (u1 - u0) * img.lh * r + 1;
        const dy = y + u0 * h, dh = (u1 - u0) * h + 0.7, dx = x + d;
        g.drawImage(img, 0, sy, img.width, sh, dx, dy, w, dh);
        if (dark && sl > 0) { g.globalAlpha = a0 * sl * dk; g.drawImage(dark, 0, sy, img.width, sh, dx, dy, w, dh); g.globalAlpha = a0; }
      }
    }
  }
  // 细长飘带（红绸、幡尾）：沿中线画成渐细的贝塞尔带，弯曲连续，不切条
  function ribbonPath(g, x, y, len, w, t, o = {}) {
    const n = 18, amp = o.amp ?? 8, fr = o.freq ?? 0.8, spd = o.speed ?? 2.4, bias = o.bias || 0, ph = o.phase || 0, pw = o.pow ?? 1.3;
    const P = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, k = Math.pow(u, pw), wave = t * spd - u * fr * TAU + ph;
      P.push([x + Math.sin(wave) * amp * k + bias * k, y + u * len * (1 - 0.06 * Math.abs(Math.sin(wave)) * k), Math.cos(wave) * k]);
    }
    const hw = (u) => w * 0.5 * (1 - u * (o.taper ?? 0.45));
    g.beginPath();
    for (let i = 0; i <= n; i++) g.lineTo(P[i][0] - hw(i / n), P[i][1]);
    for (let i = n; i >= 0; i--) g.lineTo(P[i][0] + hw(i / n), P[i][1]);
    g.closePath();
    g.fillStyle = o.color || '#c22a24'; g.fill();
    if (o.shade !== false) {
      // 背光的弯处压暗、迎光处提亮：沿长度方向一条渐变，一次填完
      const gr = g.createLinearGradient(0, y, 0, P[n][1]);
      for (let i = 0; i <= n; i++) { const sl = P[i][2]; gr.addColorStop(i / n, sl > 0 ? `rgba(0,0,0,${Math.min(0.45, sl * 0.4)})` : `rgba(255,240,230,${Math.min(0.3, -sl * 0.28)})`); }
      g.fillStyle = gr; g.fill();
    }
    return P[n];
  }

  // ---------- 天空与光 ----------
  // 天幕：三段渐变；haze 地平线辉光；glow {x,y,r,color,a} 天光
  E.sky = function (g, o = {}) {
    const y0 = o.y0 ?? 0, y1 = o.y1 ?? H;
    const stops = o.stops || [[0, o.top || '#1d2b4f'], [o.midAt ?? 0.62, o.mid || '#8d7d9a'], [1, o.bottom || '#f0c9a0']];
    vfill(g, -80, y0 - 2, W + 80, y1 + 2, stops);
    if (o.haze) {
      const hy = o.hazeY ?? y1, hh = o.hazeH ?? 160;
      vfill(g, -80, hy - hh, W + 80, hy + 4, [[0, rgba(o.haze, 0)], [0.7, rgba(o.haze, (o.hazeA ?? 0.5) * 0.6)], [1, rgba(o.haze, o.hazeA ?? 0.5)]]);
    }
    if (o.glow) { const q = o.glow; K.lighter(g, () => glow(g, q.x ?? 640, q.y ?? y1, q.r ?? 420, q.color || '#ffd9a0', q.a ?? 0.35)); }
  };

  // 光晕贴图：几层柔光预先叠好，一次贴完
  function haloTex(c1, c2, c3) {
    return cached('halo', [c1, c2, c3], 256, 256, 0.5, (g) => {
      A.softBlob(g, 128, 128, 128, 0.32, c1);
      A.softBlob(g, 128, 128, 60, 0.55, c2);
      A.softBlob(g, 128, 128, 27, 0.7, c3);
    });
  }
  // 太阳：多层光晕 + 中心偏亮的日轮；sink 为地平线 y，日轮低于它的部分不画；光晕半径封顶，免得大面积叠加拖慢
  E.sun = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 300, r = o.r ?? 48, col = o.color || '#e2553a', gl = o.glow ?? 0.6, a = o.alpha ?? 1;
    const hs = Math.min(r * (o.spread ?? 9), r + 260, 300);
    K.lighter(g, () => {
      al(g, clamp(gl * a));
      g.drawImage(haloTex(o.haze || mix(col, '#ffcf8a', 0.55), mix(col, '#ffe2b0', 0.45), '#fff1d0'), x - hs, y - hs, hs * 2, hs * 2);
      al(g, 1);
    });
    g.save();
    if (o.sink != null) { g.beginPath(); g.rect(x - r * 2, y - r * 2, r * 4, o.sink - (y - r * 2)); g.clip(); }
    al(g, a);
    g.fillStyle = rgba(col, 0.25);
    g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.fill();
    g.fillStyle = rad(g, x - r * 0.2, y - r * 0.25, r * 0.05, x, y, r, [[0, mix(col, '#fff8e4', 0.8)], [0.55, mix(col, '#ffdca8', 0.35)], [1, col]]);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.restore();
  };

  // 月面：逐像素画月海（噪声斑块，大小随半径）、边缘压暗、少量环形山；月相用半圆 ± 半椭圆的明暗交界，边缘柔和
  function moonTex(r, col, phase, tilt) {
    const R = r > 48 ? bucket(r, 16) : bucket(r, 8), q = Math.round(clamp(phase) * 48) / 48, tq = Math.round((tilt || 0) * 24) / 24;
    return cached('moon', [R, col, q, tq], R * 2 + 6, R * 2 + 6, 1, (g) => {
      const c = R + 3, S = sp().S, N = Math.round((R * 2 + 6) * S), Rp = R * S, cp = c * S;
      const disc = document.createElement('canvas'); disc.width = disc.height = N;
      const dg = disc.getContext('2d'), img = dg.createImageData(N, N), D = img.data;
      const base = hex(col);
      const mare = [base[0] * 0.62 + 24, base[1] * 0.63 + 26, base[2] * 0.68 + 34];
      // 月海：按真实月面的大致位置（玉兔捣药的图样），边缘用噪声扰动
      const MARIA = [[-0.42, -0.02, 0.36], [-0.3, -0.38, 0.27], [0.14, -0.34, 0.16], [0.3, -0.06, 0.2], [0.62, -0.26, 0.11], [0.5, 0.16, 0.13], [0.3, 0.3, 0.09], [-0.12, 0.38, 0.17], [-0.46, 0.4, 0.1], [0.05, -0.64, 0.1], [0.25, -0.62, 0.08], [-0.2, 0.12, 0.14]];
      const rr = rng(4), craters = [];
      for (let i = 0; i < Math.min(16, 5 + R * 0.08); i++) { const ang = rr() * TAU, d = Math.sqrt(rr()) * 0.85; craters.push([Math.cos(ang) * d, Math.sin(ang) * d, 0.02 + rr() * rr() * 0.04]); }
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const nx = (px + 0.5 - cp) / Rp, ny = (py + 0.5 - cp) / Rp, d2 = nx * nx + ny * ny;
        if (d2 > 1.0) continue;
        const z = Math.sqrt(1 - d2), wx = nx + (noise2(nx * 6 + 11, ny * 6, 5) - 0.5) * 0.12, wy = ny + (noise2(nx * 6, ny * 6 + 7, 6) - 0.5) * 0.12;
        let m = 0;
        for (const [mx, my, mr] of MARIA) { const dd = Math.hypot(wx - mx, wy - my) / mr; if (dd < 1.5) m = Math.max(m, smooth((1.2 - dd) / 0.5)); }
        m *= 0.5 + 0.22 * noise2(nx * 9, ny * 9, 8);
        let lum = 0.84 + 0.16 * z + (noise2(nx * 26 + 3, ny * 26, 9) - 0.5) * 0.06 + (noise2(nx * 60, ny * 60, 10) - 0.5) * 0.03;
        for (const [cx, cy, cr] of craters) { const dd = Math.hypot(nx - cx, ny - cy) / cr; if (dd < 1.6) lum += dd < 1 ? 0.07 * (1 - dd) : 0; }
        // 第谷环形山的亮纹：月面下方一点向四面放射
        const tdx = nx + 0.1, tdy = ny - 0.68, td = Math.hypot(tdx, tdy);
        if (td < 0.9) lum += 0.06 * Math.pow(Math.max(0, Math.sin(Math.atan2(tdy, tdx) * 9 + 1.3)), 6) * (1 - td / 0.9) + (td < 0.04 ? 0.15 : 0);
        const i = (py * N + px) * 4, aa = clamp((1 - Math.sqrt(d2)) * Rp * 1.2);
        for (let k = 0; k < 3; k++) D[i + k] = clamp(lerp(base[k], mare[k], m) * lum + 255 * 0.1 * (1 - m) * z, 0, 255);
        D[i + 3] = aa * 255;
      }
      dg.putImageData(img, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      if (q >= 0.995) { g.drawImage(disc, 0, 0); g.restore(); return; }
      // 暗面：极淡的地照
      g.globalAlpha = 0.06; g.drawImage(disc, 0, 0); g.globalAlpha = 1;
      if (q > 0.005) {
        // 受光面遮罩：右半圆 + 交界半椭圆（k>0 凹进去成月牙，k<0 鼓出来成凸月），再整体按 tilt 转
        const m = document.createElement('canvas'); m.width = m.height = N;
        const mg = m.getContext('2d'), k = Math.cos(q * PI);
        try { mg.filter = `blur(${Math.max(0.6, Rp * 0.025)}px)`; } catch (e) { /* 不支持滤镜时边缘略硬 */ }
        mg.translate(cp, cp); mg.rotate(tq * PI);
        mg.beginPath(); mg.arc(0, 0, Rp * 1.02, -PI / 2, PI / 2, false);
        mg.ellipse(0, 0, Math.max(0.01, Rp * Math.abs(k)), Rp * 1.02, 0, PI / 2, -PI / 2, k > 0);
        mg.closePath(); mg.fillStyle = '#fff'; mg.fill();
        const lit = document.createElement('canvas'); lit.width = lit.height = N;
        const lg = lit.getContext('2d'); lg.drawImage(disc, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(m, 0, 0);
        g.drawImage(lit, 0, 0);
      }
      g.restore();
    });
  }
  // 月亮：phase 1 满月、0.5 半月、0 新月；tilt 明暗交界的方向（0 亮面朝右，0.5 朝下，以半圈为单位）；haze 冷色大光晕
  E.moon = function (g, o = {}) {
    const x = o.x ?? 900, y = o.y ?? 180, r = o.r ?? 64, col = o.color || '#f3e3b6', gl = o.glow ?? 0.45, a = o.alpha ?? 1;
    const hs = Math.min(r * (o.spread ?? 6), r * 2 + 260, 360), ph = o.phase ?? 1;
    K.lighter(g, () => {
      al(g, clamp(gl * a * (0.45 + 0.55 * ph)));
      g.drawImage(haloTex(o.haze || '#7f98d0', mix(col, '#9fb4e0', 0.4), col), x - hs, y - hs, hs * 2, hs * 2);
      al(g, 1);
    });
    al(g, a);
    const img = moonTex(r, col, ph, o.tilt || 0), k = r / (img.lw / 2 - 3);
    g.drawImage(img, x - (img.lw / 2) * k, y - (img.lh / 2) * k, img.lw * k, img.lh * k);
    al(g, 1);
  };

  function milkyTex(seed, col) {
    return cached('milky', [seed, col], 900, 180, 0.6, (g) => {
      g.translate(0, -40);
      const r = rng(seed + 50);
      for (let i = 0; i < 26; i++) A.softBlob(g, 60 + r() * 780, 130 + (r() - 0.5) * 90, 40 + r() * 90, 0.12, col);
      // 暗尘带：星河中间一道断续的暗缝
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 14; i++) A.softBlob(g, 80 + i * 55 + r() * 30, 130 + Math.sin(i * 0.7) * 14 + (r() - 0.5) * 10, 18 + r() * 22, 0.35, '#000000');
      g.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 700; i++) {
        const x = r() * 900, y = 130 + (r() + r() + r() - 1.5) * 90;
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        const s = 0.4 + r() * 1.1; g.fillRect(x, y, s, s);
      }
      // 上下、两头都羽化，贴图边缘不露直线
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = K.lin(g, 0, 40, 0, 220, [[0, 'rgba(0,0,0,0)'], [0.3, 'rgba(0,0,0,1)'], [0.7, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 40, 900, 180);
      g.fillStyle = K.lin(g, 0, 0, 900, 0, [[0, 'rgba(0,0,0,0)'], [0.12, 'rgba(0,0,0,1)'], [0.88, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 40, 900, 180);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 星空：n 颗，越往上越密，偶有十字星芒；milky 0..1 叠一条星河
  E.stars = function (g, o = {}) {
    const t = o.t || 0, n = o.n ?? 90, seed = o.seed ?? 3, maxY = o.maxY ?? 420, minY = o.minY ?? 0, col = o.color || '#fff6e0', tw = o.twinkle ?? 1;
    const a0 = o.alpha ?? 1;
    if (o.milky) {
      // 星河：贴图带着旋转贴上（只填带子本身，不填旋转后的外接框）
      const ang = o.milkyAngle ?? -0.35, mc = o.milkyColor || '#b9c6ff';
      al(g, o.milky * a0);
      g.save(); g.translate(o.milkyX ?? 640, o.milkyY ?? maxY * 0.45); g.rotate(ang);
      g.drawImage(milkyTex(seed, mc), -650, -130, 1300, 260);
      g.restore();
      al(g, 1);
    }
    for (let i = 0; i < n; i++) {
      const x = h2(i, seed) * (W + 40) - 20, y = minY + Math.pow(h2(i, seed + 1), 1.35) * (maxY - minY);
      const m = h2(i, seed + 3), r = 0.5 + m * m * 1.2 + (m > 0.95 ? 1.2 : 0);
      let a = (0.4 + 0.6 * m) * (1 - tw * 0.3 * (1 + Math.sin(t * (0.6 + h2(i, seed + 2) * 2.6) + i * 2.1)));
      a *= clamp((maxY - y) / 70 + 0.2) * a0;
      const hk = h2(i, seed + 4), c = hk < 0.18 ? '#cfe0ff' : hk > 0.86 ? '#ffe0bc' : col;
      if (m > 0.95) {
        K.lighter(g, () => glow(g, x, y, r * 4, c, a * 0.45));
        g.strokeStyle = rgba(c, a * 0.35); g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x - r * 3, y); g.lineTo(x + r * 3, y); g.moveTo(x, y - r * 3); g.lineTo(x, y + r * 3); g.stroke();
      }
      g.fillStyle = rgba(c, clamp(a));
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
  };

  // 软笔触：拉长的柔边椭圆（水墨里的一笔淡彩），云、雾、浪都用它。用一张预渲染的白色柔圆按色着色后拉伸贴上，
  // 比每笔新建渐变快得多
  let streakSpr = null;
  function streak(g, x, y, rx, ry, col, a, rot = 0) {
    if (!(a > 0)) return;
    if (!streakSpr) {
      streakSpr = document.createElement('canvas'); streakSpr.width = streakSpr.height = 64; streakSpr.lw = streakSpr.lh = 64;
      const q = streakSpr.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
    }
    const p = g.globalAlpha, spr = tintOf(streakSpr, col, 96);
    g.globalAlpha = p * Math.min(1, a);
    if (rot) { g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(spr, -rx, -ry, rx * 2, ry * 2); g.restore(); }
    else g.drawImage(spr, x - rx, y - ry, rx * 2, ry * 2);
    g.globalAlpha = p;
  }
  // 云贴图（520×220，云底约在 y=178）。style 'wash'（默认）：一缕缕横向淡彩叠成云气，上缘受光、迎光一侧更亮，
  // 底部一路淡到透明，不留硬边；'cumulus'：圆团积云（只在需要卡通式云朵时用），同样柔边无气泡圈
  function cloudTex(k, lit, sh, style, ldir) {
    return cached('cloud', [k, lit, sh, style, ldir], 520, 220, 0.5, (g) => {
      const r = rng(300 + k * 17), base = 178;
      if (style === 'cumulus') {
        const puffs = [], n = 6 + Math.floor(r() * 4);
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n, x = 60 + u * 400 + (r() - 0.5) * 30, rr = 22 + Math.sin(u * PI) * (34 + r() * 34);
          puffs.push([x, base - rr * (0.45 + r() * 0.35), rr]);
        }
        for (let i = 0; i < 4; i++) { const p = puffs[1 + Math.floor(r() * (n - 2))]; puffs.push([p[0] + (r() - 0.5) * 70, p[1] - p[2] * (0.35 + r() * 0.3), p[2] * (0.45 + r() * 0.3)]); }
        const top = Math.min(...puffs.map((p) => p[1] - p[2]));
        g.save(); g.beginPath(); g.rect(0, 0, 520, base + 10); g.clip();
        for (const [x, y, rr] of puffs) A.softBlob(g, x, y + rr * 0.1, rr * 1.3, 0.18, lit);
        g.beginPath(); for (const [x, y, rr] of puffs) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, TAU); }
        g.fillStyle = K.lin(g, 0, top, 0, base, [[0, lit], [0.55, mix(lit, sh, 0.35)], [1, sh]]); g.fill();
        // 迎光一侧整体提亮
        if (ldir) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = K.lin(g, 260 - ldir * 260, 0, 260 + ldir * 260, 0, [[0, rgba('#ffffff', 0)], [1, rgba('#ffffff', 0.3)]]); g.fillRect(0, 0, 520, 220); }
        g.restore();
      } else {
        // 云头轮廓：几个缓坡叠成，中间高两头低
        const lumps = [];
        for (let i = 0; i < 5; i++) lumps.push([90 + i * 85 + (r() - 0.5) * 50, (24 + r() * 40) * Math.sin(((i + 0.5) / 5) * PI) + 10, 50 + r() * 50]);
        const topAt = (x) => { let h = 0; for (const [c, a, w] of lumps) h = Math.max(h, a * Math.exp(-((x - c) * (x - c)) / (2 * w * w))); return base - 34 - h * 1.4; };
        const fadeX = (x) => clamp((230 - Math.abs(x - 260)) / 60);
        // 云体：一层层大块淡彩横扫，上暖下冷
        for (let i = 0; i < 16; i++) {
          const x = 70 + (i / 15) * 380 + (r() - 0.5) * 30, tp = topAt(x), v = r();
          streak(g, x, lerp(tp + 16, base - 6, v), 60 + r() * 80, 16 + r() * 16, mix(lit, sh, 0.25 + v * 0.6), (0.3 + r() * 0.15) * fadeX(x));
        }
        for (let i = 0; i < 30; i++) {
          const x = 50 + r() * 420, tp = topAt(x), v = Math.pow(r(), 0.8), y = lerp(tp + 8, base + 4, v);
          streak(g, x, y, 30 + r() * 90, 5 + r() * 10, mix(lit, sh, clamp(v * 1.1 + (r() - 0.5) * 0.3)), (0.16 + r() * 0.16) * fadeX(x));
        }
        // 受光的上缘：沿轮廓一串亮笔，迎光一侧更亮
        for (let x = 50; x < 470; x += 12) {
          const tp = topAt(x), side = ldir ? clamp(0.5 + 0.5 * ldir * Math.tanh((topAt(x - 6) - topAt(x + 6)) * 0.15)) : 0.6;
          streak(g, x + (r() - 0.5) * 8, tp + 14 + r() * 4, 26 + r() * 18, 11 + r() * 6, mix(lit, '#ffffff', 0.2), (0.1 + 0.2 * side) * fadeX(x));
        }
        // 两头拖出的细缕
        for (let i = 0; i < 10; i++) { const sd = i % 2 ? 1 : -1, x = 260 + sd * (150 + r() * 90); streak(g, x, base - 12 - r() * 30, 50 + r() * 60, 2.5 + r() * 3, mix(lit, sh, 0.4), 0.18); }
      }
      // 底部一路淡到画布底（不留硬边）
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = K.lin(g, 0, base - 34, 0, 220, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,1)']]);
      g.fillRect(0, base - 34, 520, 220 - base + 34);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 浮云：y 中线，speed 像素/秒（正值向右），scale 尺寸，n 朵数，spread 上下散布；color 受光，shade 云底；
  // style 'wash'（默认，水墨云气）| 'cumulus'；lightX 光源横坐标（给了就让每朵云迎光一侧更亮）
  E.clouds = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 200, sc = o.scale ?? 1, speed = o.speed ?? 8, col = o.color || '#ffffff', sh = o.shade || mix(col, '#7d8aa6', 0.5);
    const a = o.alpha ?? 0.85, seed = o.seed ?? 1, n = o.n ?? 5, spread = o.spread ?? 60, style = o.style === 'cumulus' ? 'cumulus' : 'wash';
    const w = 520 * sc, span = W + w * 2;
    for (let k = 0; k < n; k++) {
      const s2 = 0.65 + 0.7 * h2(k, seed + 2);
      const x = ((((h2(k, seed) * span + t * speed * (0.8 + 0.4 * h2(k, seed + 5))) % span) + span) % span) - w;
      const yy = y + (h2(k, seed + 1) - 0.5) * spread;
      const ldir = o.lightX == null ? 0 : (x + w * s2 / 2 < o.lightX ? 1 : -1);
      const img = cloudTex((k + seed) % 5, col, sh, style, ldir);
      al(g, a * (0.75 + 0.25 * h2(k, seed + 3)));
      // 宽扁的云更像一缕云气：wash 云横向再拉长一些
      const sx = style === 'wash' ? 1.25 : 1;
      g.drawImage(img, x, yy - 178 * sc * s2, w * s2 * sx, 220 * sc * s2);
    }
    al(g, 1);
  };
  // 云海一行：周期为 L 的长条云带。上缘是缓缓起伏的长波，再缀些小云头；受光的上缘暖亮，往下转成蓝紫的谷色，
  // 下沿淡出，让下一行盖住；远近几行叠起来就是层层云海。预渲染后平铺滚动；pr 为该行贴图分辨率
  function seaRow(r, sc, lit, sh, val, seed, ldir, pr) {
    const L = 1600, hh = Math.round(100 + 240 * sc), top0 = Math.round(hh * 0.5);
    return cached('seaRow', [r, Math.round(sc * 20) / 20, lit, sh, val, seed, ldir], L, hh, pr, (g) => {
      const rr = rng(seed * 31 + r * 7 + 3), s0 = seed * 5 + r * 11;
      const wrapN = (x, f, s) => lerp(noise1(x * f, s), noise1((x - L) * f, s), x / L);
      const A1 = 40 + 120 * sc, f1 = 5 / L, f2 = 15 / L;
      const puffs = [];
      for (let i = 0; i < Math.round(L / (40 + 50 * sc)); i++) puffs.push([rr() * L, (18 + 50 * sc) * (0.5 + rr()), (6 + 24 * sc) * (0.4 + rr())]);
      const hAt = (x) => {
        let h = A1 * smooth(0.62 * wrapN(x, f1, s0) + 0.38 * wrapN(x, f2, s0 + 1) - 0.1);
        let b = 0;
        for (const [c, w, a] of puffs) { let dx = x - c; dx -= L * Math.round(dx / L); const q = 1 - (dx * dx) / (w * w); if (q > 0) b = Math.max(b, a * Math.sqrt(q)); }
        return h + b * (0.4 + 0.6 * h / A1);
      };
      const NS = 400, tops = [];
      for (let i = 0; i <= NS; i++) { const x = (i / NS) * L; tops.push([x, top0 - hAt(x) + A1 * 0.5]); }
      const ymin = Math.min(...tops.map((p) => p[1]));
      const path = () => { g.beginPath(); g.moveTo(0, hh); tops.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(L, hh); g.closePath(); };
      path();
      g.fillStyle = K.lin(g, 0, ymin, 0, hh, [[0, lit], [0.25, mix(lit, sh, 0.18)], [0.6, mix(sh, val, 0.25)], [1, val]]);
      g.fill();
      g.save(); path(); g.clip();
      // 起伏处的体积：波峰下一抹亮，波谷里一抹蓝紫
      for (let i = 0; i < 26; i++) {
        const x = ((i + rr()) / 26) * L, ty = top0 - hAt(x) + A1 * 0.5, crest = hAt(x) / (A1 * 1.2);
        for (const dx of [-L, 0, L]) {
          streak(g, x + dx + ldir * 20 * sc, ty + 10 + 18 * sc, (50 + 90 * sc) * (0.7 + rr() * 0.6), 8 + 16 * sc, mix(lit, '#ffffff', 0.3), 0.18 + 0.3 * crest);
          streak(g, x + dx - ldir * 40 * sc, ty + 26 + 50 * sc, (60 + 120 * sc) * (0.7 + rr() * 0.6), 10 + 24 * sc, val, 0.12 + 0.12 * (1 - crest));
        }
      }
      // 横向的淡笔，带出云海的流动感
      for (let i = 0; i < 46; i++) { const x = rr() * L, y = lerp(top0, hh, rr()), lw = 60 + rr() * 160 * sc, th = 3 + rr() * 7 * sc, c2 = rr() < 0.45 ? lit : val, a2 = 0.07 + rr() * 0.1; for (const dx of [-L, 0, L]) streak(g, x + dx, y, lw, th, c2, a2); }
      g.restore();
      // 受光的上缘：一圈柔亮（不是硬线）
      for (let i = 0; i < NS; i += 3) { const [x, y] = tops[i], up = clamp(0.5 + ldir * (tops[Math.max(0, i - 2)][1] - tops[Math.min(NS, i + 2)][1]) * 0.15); for (const dx of [0, x < 40 ? L : x > L - 40 ? -L : 0]) streak(g, x + dx, y + 3, 9 + 10 * sc, 3 + 3 * sc, mix(lit, '#ffffff', 0.5), 0.12 + 0.3 * up); }
      // 下沿淡出
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = K.lin(g, 0, hh * 0.62, 0, hh, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.9)']]);
      g.fillRect(0, hh * 0.62, L, hh * 0.38 + 1);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 云海：从 y（远）铺到画面底，远处扁平细碎、近处云头大而缓；color 受光、shade 云谷、valley 谷底蓝紫；
  // lightX 光源横坐标（云头迎光一侧亮）；far 最远一行的颜色
  E.cloudSea = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#f6efe4', sh = o.shade || '#8e9bb5', speed = o.speed ?? 10, rows = o.rows ?? 4, a = o.alpha ?? 1;
    const val = o.valley || mix(sh, '#5a4f8a', 0.35), seed = o.seed || 0, ldir = o.lightX == null ? 0 : (o.lightX < 640 ? -1 : 1);
    const far = o.far || mix(col, sh, 0.25);
    al(g, a);
    // 底色：y 以下不透明（画面不会每帧清空，留缝会透出上一帧）
    vfill(g, -80, y - 10, W + 80, H + 40, [[0, rgba(mix(far, sh, 0.3), 0)], [0.1, mix(far, sh, 0.3)], [1, mix(sh, val, 0.4)]]);
    for (let r = 0; r < rows; r++) {
      const u = rows > 1 ? r / (rows - 1) : 1, z = Math.pow(u, 1.4);
      const sc = 0.3 + 1.2 * z, yy = y + z * (H - y + 20);
      const lit = mix(far, col, z), shade2 = mix(mix(sh, far, 0.35), sh, z);
      const img = seaRow(r, sc, lit, shade2, mix(val, sh, 0.4 * (1 - z)), seed, ldir, z > 0.5 ? 0.35 : 0.5);
      // 远处更扁（透视）；最近一行限高，免得一大团挡满画面
      const L = img.lw, q = lerp(0.5, 0.85, z), off = ((((t * speed * (0.25 + 2.2 * z) + h2(r, seed) * L) % L) + L) % L);
      const hgt = Math.min(img.lh * q, 320), top = yy - img.lh * 0.45 * q;
      for (let x = off - L; x < W + 80; x += L) g.drawImage(img, x - 80, top, L, hgt);
      // 行与行之间一道薄雾，远近连成一片
      if (r === Math.floor(rows / 3) || r === Math.floor((rows * 2) / 3)) E.mist(g, { t, y: yy - 6, h: 60 + 120 * z, color: z > 0.5 ? mix(lit, sh, 0.3) : lit, alpha: 0.35, speed: speed * (0.3 + 1.6 * z), seed: 7 + r });
      al(g, a);
    }
    al(g, 1);
  };

  // ---------- 地形 ----------
  // 雾带贴图：上下边缘保证柔和（共用雾贴图的团块会被画布切出直边）
  function mistTex(seed) {
    return cached('mist', [seed], 1200, 240, 0.4, (g) => {
      const r = rng(seed + 900);
      // 团块左右各复制一份，平铺时首尾无缝
      for (let i = 0; i < 60; i++) { const x = r() * 1200, y = 120 + (r() - 0.5) * 70, rr = 40 + r() * 70; for (const dx of [-1200, 0, 1200]) A.softBlob(g, x + dx, y, rr, 0.2, '#ffffff'); }
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = K.lin(g, 0, 0, 0, 240, [[0, 'rgba(0,0,0,0)'], [0.35, 'rgba(0,0,0,1)'], [0.65, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
      g.fillRect(0, 0, 1200, 240);
    });
  }
  // 雾带：y 中线，h 厚度，speed 像素/秒，w 平铺周期
  E.mist = function (g, o = {}) {
    const img = tintOf(mistTex(o.seed ?? 1), o.color || '#f2eee6'), w = o.w ?? 1200, h = o.h ?? 160;
    const off = (((o.t || 0) * (o.speed ?? 8) + (o.offset || 0)) % w + w) % w;
    al(g, o.alpha ?? 0.5);
    for (let x = off - w; x < W + 80; x += w) g.drawImage(img, x - 40, (o.y ?? 500) - h / 2, w, h);
    al(g, 1);
  };
  // 柔边横条贴图（雪面风痕、石峰前的流云、水面碎光都用它，按需拉伸着色）
  function softBar() {
    return cached('softBar', [], 256, 32, 1, (g) => streak(g, 128, 16, 126, 15, '#ffffff', 1));
  }

  // 山形（宽 1800 循环、高 380）：一次生成四张遮罩——墨色浓淡、实心剪影、受光面、山脊受光线
  const RANGE = {
    far: { peaks: 7, wmin: 140, wmax: 300, hmin: 70, hmax: 190, rough: 12, fall: 130, pe: 1.9, floor: 0.42, warp: 70 },
    mid: { peaks: 9, wmin: 90, wmax: 220, hmin: 100, hmax: 260, rough: 18, fall: 95, pe: 2.0, floor: 0.52, warp: 55 },
    near: { peaks: 8, wmin: 80, wmax: 190, hmin: 110, hmax: 290, rough: 24, fall: 75, pe: 2.2, floor: 0.62, warp: 45, trees: 1 },
    karst: { peaks: 14, wmin: 30, wmax: 64, hmin: 120, hmax: 300, rough: 6, fall: 110, pe: 2.4, floor: 0.48, warp: 10, trees: 0.8, karst: 1 },
  };
  const maskStore = new Map();
  function rangeMasks(seed, kind, ldir) {
    const sc = 0.5 * Math.min(1, sp().S), key = [seed, kind, ldir, sc].join('|');
    let m = maskStore.get(key);
    if (m) return m;
    const L = 1800, Hm = 380, o = RANGE[kind] || RANGE.mid, pw = Math.round(L * sc), ph = Math.round(Hm * sc);
    const mk = (k = 1) => { const c = document.createElement('canvas'); c.width = Math.round(pw * k); c.height = Math.round(ph * k); c.L = L; c.Hm = Hm; c.lw = L; c.lh = Hm; return c; };
    const shape = mk(), solid = mk(), light = mk();
    const r = rng(seed * 31 + 7), peaks = [];
    // 主峰左右坡宽不等（不对称、略带倾斜），峰形指数 1.8 以上：圆浑的峰顶而不是直边尖锥；每座主峰再带一两个肩峰
    for (let i = 0; i < o.peaks; i++) {
      const w = lerp(o.wmin, o.wmax, r()), sk = 0.6 + r() * 0.8;
      const p = { c: ((i + r() * 0.8) / o.peaks) * L, wl: w * sk, wr: w * (2 - sk), a: lerp(o.hmin, o.hmax, Math.pow(r(), 0.9)), e: o.pe * (0.85 + 0.3 * r()) };
      peaks.push(p);
      if (!o.karst) for (let k = 0; k < 1 + (r() < 0.6 ? 1 : 0); k++) {
        const sd = r() < 0.5 ? -1 : 1;
        peaks.push({ c: p.c + sd * w * (0.55 + r() * 0.5), wl: w * (0.35 + r() * 0.3), wr: w * (0.35 + r() * 0.3), a: p.a * (0.45 + r() * 0.3), e: p.e * 0.9 });
      }
    }
    const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
    const wrapN = (x, f, s) => lerp(noise1(x * f, s), noise1((x - L) * f, s), x / L);
    const prof = (list, x, k) => {
      let h = 0;
      for (const p of list) {
        let dx = x - p.c; dx -= L * Math.round(dx / L);
        const u = dx / (dx < 0 ? p.wl : p.wr);
        let v = p.a * Math.exp(-Math.pow(Math.abs(u), p.e) * 1.6);
        // 石峰林：峰顶参差（顶部叠高频起伏）
        if (o.karst) v += p.a * 0.035 * smooth((v / p.a - 0.7) / 0.3) * ((noise1(x * 0.07, seed + 13 + p.c) - 0.5) * 2 + 0.5 * (noise1(x * 0.19, seed + 14) - 0.5));
        h = smax(h, v, k);
      }
      return h;
    };
    const hAt = (x) => {
      const xw = x + o.warp * (wrapN(x, 0.0032, seed + 20) - 0.5) * 2;
      let h = prof(peaks, xw, 16);
      const f = clamp(h / o.hmax);
      // 起伏：普通噪声给缓坡，脊状噪声（|2n-1| 取反）在高处切出肩与棱
      h += o.rough * (2.2 * (wrapN(x, 0.008, seed) - 0.5) + 1.2 * (wrapN(x, 0.03, seed + 1) - 0.5) + 0.6 * (wrapN(x, 0.11, seed + 2) - 0.5)) * (0.5 + 0.7 * f);
      h += o.rough * 1.6 * (0.5 - Math.abs(2 * wrapN(x, 0.018, seed + 3) - 1)) * f;
      if (o.karst) h = Math.max(h, 26 + 22 * wrapN(x, 0.006, seed + 4));
      return Math.max(10, h);
    };
    // 山体里的前山：每座主峰两侧各生几座矮峰，作为内部的山脊线
    const subA = [], subB = [];
    for (const p of peaks) for (let k = 0; k < 2; k++) {
      const sd = r() < 0.5 ? -1 : 1, w = (p.wl + p.wr) / 2;
      subA.push({ c: p.c + sd * w * (0.25 + r() * 0.6), wl: w * (0.35 + r() * 0.4), wr: w * (0.35 + r() * 0.4), a: p.a * (0.4 + r() * 0.35), e: p.e });
      subB.push({ c: p.c + (r() - 0.5) * w * 1.6, wl: w * (0.4 + r() * 0.5), wr: w * (0.4 + r() * 0.5), a: p.a * (0.18 + r() * 0.22), e: p.e });
    }
    const ridge = new Float32Array(pw), fold1 = new Float32Array(pw), fold2 = new Float32Array(pw);
    for (let px = 0; px < pw; px++) {
      const x = px / sc, h = hAt(x);
      ridge[px] = h;
      fold1[px] = Math.min(h - 4, prof(subA, x, 10) + o.rough * 0.8 * (wrapN(x, 0.05, seed + 6) - 0.5));
      fold2[px] = Math.min(h - 4, prof(subB, x, 10));
    }
    const ctxs = [shape, solid, light].map((c) => c.getContext('2d'));
    const datas = ctxs.map((c) => c.createImageData(pw, ph)), D = datas[0].data, Ds = datas[1].data, Dl = datas[2].data;
    for (let px = 0; px < pw; px++) {
      const x = px / sc, h = ridge[px], top = Hm - h, fall = o.fall * (0.7 + 0.6 * noise1(x * 0.01, seed + 3));
      const sl0 = (ridge[(px + 2) % pw] - ridge[(px - 2 + pw) % pw]) * sc / 4;
      for (let py = Math.max(0, Math.floor(top * sc)); py < ph; py++) {
        const y = py / sc, dd = y - top;
        // 皴纹顺坡斜下（披麻皴）；石峰林改为竖向沟壑
        const sx = o.karst ? x : x + dd * Math.tanh(sl0 * 2) * 0.7;
        const streak = o.karst ? noise2(x * 0.16, y * 0.012, seed) * 0.6 + 0.4 * noise2(x * 0.5, y * 0.04, seed + 5)
          : noise2(sx * 0.09, y * 0.02, seed) * 0.7 + 0.3 * noise2(sx * 0.35, y * 0.07, seed + 5);
        let a = lerp(o.floor, 1, Math.exp(-dd / fall)) * (0.7 + 0.3 * streak) + Math.exp(-dd / 1.5) * 0.22;
        // 山体内部的前一道山脊：线下加深，像一层层叠出来
        const d1 = y - (Hm - fold1[px]), d2 = y - (Hm - fold2[px]);
        if (d1 > 0) a += 0.22 * Math.exp(-d1 / (fall * 0.5)) + 0.1 * Math.exp(-d1 / 1.5);
        if (d2 > 0) a += 0.18 * Math.exp(-d2 / (fall * 0.4));
        const edge = clamp(dd * sc * 1.2);
        a *= edge * lerp(0.75, 1, clamp((ph - py) / (40 * sc)));
        // 受光面：光从 ldir 一侧来（-1 左、1 右）；明暗交界随高度摆动，顺坡皴纹带出沟壑
        const wx = Math.round(px + (noise2(x * 0.02, y * 0.02, seed + 7) - 0.5) * 50 * sc);
        const q = ((wx % pw) + pw) % pw, slope = (ridge[(q + 2) % pw] - ridge[(q - 2 + pw) % pw]) * sc / 4 * -ldir;
        const lit = clamp(0.5 + 0.5 * Math.tanh(slope * 1.6) + (streak - 0.5) * 0.8) * (0.55 + 0.45 * noise2(x * 0.05, y * 0.01, seed + 9));
        const la = lit * Math.exp(-dd / (fall * 1.2)) * clamp(dd * sc * 0.6) * (d1 > 0 && d1 < 6 ? 0.4 : 1);
        const i = (py * pw + px) * 4;
        D[i + 3] = Math.min(255, a * 255); Dl[i + 3] = Math.min(255, la * a * 255);
        Ds[i + 3] = edge * clamp((ph - py) / (10 * sc)) * 255;
      }
    }
    ctxs.forEach((c, k) => c.putImageData(datas[k], 0, 0));
    if (o.trees) {
      // 山脊上的小树：松（横出的针叶团）与点叶杂树，疏密成簇；画进墨色与实心两张遮罩
      for (const gs of [ctxs[0], ctxs[1]]) {
        const tr = rng(seed * 7 + 99);
        gs.save(); gs.scale(sc, sc); gs.fillStyle = '#000'; gs.strokeStyle = '#000'; gs.lineCap = 'round';
        const nT = Math.round(170 * o.trees);
        for (let k = 0; k < nT; k++) {
          const x = (k / nT) * L + tr() * 12, s = 0.4 + tr() * 0.6, kind2 = tr(), lean = (tr() - 0.5) * 0.5, j1 = tr(), j2 = tr(), j3 = tr();
          if (noise1(k * 0.15, seed + 11) < 0.45) continue;
          const px = Math.floor(x * sc) % pw, top = Hm - ridge[px] + 1.5 + j1 * 3;
          if (kind2 < 0.6) {
            gs.lineWidth = 1.1 * s; gs.beginPath(); gs.moveTo(x, top + 3); gs.quadraticCurveTo(x + lean * 4, top - 7 * s, x + lean * 8 * s, top - 15 * s); gs.stroke();
            for (let j = 0; j < 3; j++) {
              const yy = top - (4 + j * 4.2) * s, cx = x + lean * (3 + j * 2.5) * s + (j % 2 ? 2 : -2) * s * (j2 - 0.3);
              gs.beginPath(); gs.ellipse(cx, yy, (7 - j * 1.7) * s * (0.8 + j3 * 0.4), 1.5 * s, lean * 0.3, 0, TAU); gs.fill();
            }
          } else {
            gs.lineWidth = 0.9 * s; gs.beginPath(); gs.moveTo(x, top + 3); gs.lineTo(x + lean * 3, top - 6 * s); gs.stroke();
            for (let j = 0; j < 5; j++) { gs.beginPath(); gs.arc(x + lean * 3 + (h2(k, j) - 0.5) * 9 * s, top - 7 * s - h2(k, j + 9) * 6 * s, (1.8 + h2(k, j + 3) * 1.6) * s, 0, TAU); gs.fill(); }
          }
        }
        gs.restore();
      }
    }
    // 山脊受光线：沿脊线描一道线（全分辨率），迎光的坡段亮、背光的坡段暗；贴的时候着色
    const rk = Math.min(1, sp().S) / sc, rim = mk(rk), rg = rim.getContext('2d');
    rg.scale(sc * rk, sc * rk); rg.lineCap = 'round'; rg.lineJoin = 'round';
    for (let px = 0; px < pw - 2; px += 2) {
      const s1 = (ridge[(px + 3) % pw] - ridge[(px - 1 + pw) % pw]) * sc / 4 * -ldir;
      rg.strokeStyle = `rgba(255,255,255,${clamp(0.35 + 0.65 * Math.tanh(s1 * 2.2 + 0.4))})`; rg.lineWidth = 2.2;
      rg.beginPath(); rg.moveTo(px / sc, Hm - ridge[px] + 0.6); rg.lineTo((px + 2) / sc, Hm - ridge[px + 2] + 0.6); rg.stroke();
    }
    m = { shape, solid, light, rim, sc };
    maskStore.set(key, m);
    if (maskStore.size > 24) maskStore.delete(maskStore.keys().next().value);
    return m;
  }
  // 上色的山层：先用雾色填实心剪影（山不透光），再叠墨色浓淡，在受光面上叠亮色，最后描山脊受光线（都烘进一张贴图）
  function rangeTex(seed, kind, ldir, col, lit, litA, under, rim, rimA) {
    const ms = rangeMasks(seed, kind, ldir), S = sp().S;
    return cached('range', [seed, kind, ldir, col, lit, litA, under || '-', rim || '-', rim ? Math.round(rimA * 20) / 20 : 0], 1800, 380, ms.sc / S, (g) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (under) tintDraw(g, ms.solid, under);
      tintDraw(g, ms.shape, col);
      g.globalAlpha = litA; g.globalCompositeOperation = 'source-atop';
      tintDraw(g, ms.light, lit);
      g.globalCompositeOperation = 'source-over';
      if (rim) { g.globalAlpha = clamp(rimA); tintDraw(g, ms.rim, rim, ms.shape.width, ms.shape.height); }
      g.globalAlpha = 1;
    });
  }
  // 平铺山层（x 偏移自动循环），乘整体透明度；左右各多铺一段，推拉镜头时不露边
  function tileRange(g, spr, alpha, offX, baseY, scaleY) {
    const L = 1800, Hm = 380 * scaleY;
    let x = -(((offX % L) + L) % L);
    if (x > -100) x -= L;
    al(g, alpha);
    for (; x < W + 100; x += L) g.drawImage(spr, x, baseY - Hm, L, Hm);
    al(g, 1);
  }
  // 群山：layers [{color, light, litA, alpha, y, scaleY, speed, kind:'far'|'mid'|'near'|'karst', seed, offset, soft, rim, rimA, fog, fogA, fogH, fogY, occlude}]
  // kind 选山形（karst 为桂林式石峰林）；soft:true 改用共用的 XYT.sprites.mtn 柔和山形；light 受光面颜色、litA 其强度；
  // lightDir -1 光从左来（默认）| 1 从右来；occlude 山体先用这个颜色填实（默认取雾色与山色之间，false 不填，山会透出背后的日月）；
  // rim 山脊受光线颜色、rimA 其强度（soft 山形不画）。不给 layers 时按 n/far/near/light/y0/y1/scale/kind 自动生成：远淡偏冷、近深；fog 为层间雾色。
  // 可逐帧变：t、y、alpha、speed、offset；颜色会按档重建贴图，宜少变
  E.mountains = function (g, o = {}) {
    const t = o.t || 0, ldir = (o.lightDir ?? -1) > 0 ? 1 : -1;
    let layers = o.layers;
    if (!layers) {
      const n = o.n ?? 4, far = o.far || '#9fb1c6', near = o.near || '#1f2732', y0 = o.y0 ?? 460, y1 = o.y1 ?? 700, s = o.scale ?? 0.6, lt = o.light || '#ffffff';
      layers = [];
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) : 1, col = mix(far, near, Math.pow(u, 0.85));
        layers.push({ color: col, light: mix(col, lt, 0.35 - 0.12 * u), alpha: 1, y: lerp(y0, y1, u), scaleY: s * lerp(0.55, 1, u), speed: lerp(1.5, 14, u) * (o.speed ?? 1), rim: o.rim ? mix(o.rim, far, u * 0.5) : null, kind: o.kind, soft: o.soft });
      }
    }
    const kinds = ['far', 'far', 'mid', 'mid', 'near', 'near'];
    layers.forEach((L, i) => {
      const kind = L.kind || kinds[Math.min(5, Math.round((i * 5) / Math.max(1, layers.length - 1)))];
      const seed = (L.seed ?? i) + (o.seed || 0) * 7;
      const v = L.speed ?? 6, off = (L.offset ?? i * 517 + (o.seed || 0) * 233) + t * v;
      const col = L.color || '#4a5566', fc = L.fog === false ? null : L.fog || o.fog, ld = L.lightDir == null ? ldir : (L.lightDir > 0 ? 1 : -1);
      const occ = L.occlude ?? o.occlude, under = occ === false ? null : typeof occ === 'string' ? occ : mix(col, fc || o.haze || '#dfe3ea', 0.38);
      if (L.soft) {
        const spr = sp().mtn[kind === 'karst' ? 'mid' : kind][seed % 2];
        if (under) tileRange(g, tintOf(spr, under), (L.alpha ?? 1) * 0.6, off, L.y, L.scaleY ?? 1);
        tileRange(g, sp().tint(spr, qc(col)), L.alpha ?? 1, off, L.y, L.scaleY ?? 1);
      } else {
        tileRange(g, rangeTex(seed, kind, ld, col, L.light || mix(col, '#ffffff', 0.3), L.litA ?? 0.6, under, L.rim, L.rimA ?? 0.8), L.alpha ?? 1, off, L.y, L.scaleY ?? 1);
      }
      if (fc && (i < layers.length - 1 || L.fog)) E.mist(g, { color: fc, alpha: L.fogA ?? o.fogA ?? 0.45, t, speed: -v * 1.7, offset: i * 311, y: L.y - (L.fogY ?? 6), h: L.fogH ?? 150, seed: i });
    });
  };

  // 小松（剪影）：斜出的树干，几簇横向的针叶团，大小参差；石峰顶上、崖缝里用
  function inkPine(g, x, y, s, lean, seed, col, lite) {
    const r = rng(seed), hh = (18 + r() * 14) * s;
    g.strokeStyle = col; g.lineCap = 'round';
    const tx = x + lean * hh * 0.8, ty = y - hh;
    g.lineWidth = 2.2 * s; g.beginPath(); g.moveTo(x, y + 2 * s); g.bezierCurveTo(x + lean * hh * 0.1, y - hh * 0.4, tx - lean * hh * 0.3, ty + hh * 0.3, tx, ty); g.stroke();
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const u = 0.45 + (k / Math.max(1, n - 1)) * 0.55, bx = lerp(x, tx, u), by = lerp(y, ty, u) - 2 * s;
      const side = k === n - 1 ? 0 : (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.8), ww = (9 + r() * 9) * s * (1.1 - u * 0.4);
      const px = bx + side * ww * 0.6;
      if (side) { g.lineWidth = 1.1 * s; g.beginPath(); g.moveTo(bx, by + 2 * s); g.quadraticCurveTo((bx + px) / 2, by - 2 * s, px, by); g.stroke(); }
      // 针叶团：几个扁椭圆拼成锯齿边的云头，顶边一抹亮
      g.fillStyle = col; g.beginPath();
      for (let j = 0; j < 4; j++) { const ex = px + (j / 3 - 0.5) * ww * 1.4, ey = by - Math.sin((j / 3) * PI) * 2.2 * s; g.moveTo(ex + ww * 0.42, ey); g.ellipse(ex, ey, ww * 0.42, 2.6 * s, 0, 0, TAU); }
      g.fill();
      if (lite) { g.strokeStyle = lite; g.lineWidth = 0.8 * s; g.beginPath(); g.ellipse(px - ww * 0.1, by - 1.6 * s, ww * 0.7, 2 * s, 0, PI * 1.1, PI * 1.9); g.stroke(); g.strokeStyle = col; }
    }
  }
  // 石笋孤峰贴图（光从左来，右侧背光）：剪影带凸出的岩檐与内收；竖向柱状节理、斧劈皴、硬的明暗交界、
  // 岩檐下的阴影、缝里的苔点小树；越往上越融进天色，峰脚渐变成雾色（不透明）
  function peakTex(hb, wr, col, light, haze, base, seed) {
    const h = hb, w = h * wr, pw = Math.round(w * 2.4), ph = Math.round(h * 1.12);
    return cached('peak', [hb, wr, col, light, haze, base, seed], pw, ph, 1, (g) => {
      const cx = pw / 2, bot = ph, rr = rng(seed), N = 120;
      // 岩檐：在某些高度剪影突然外凸（下沿成檐），往上慢慢收回
      const ledges = [];
      for (let k = 0; k < 5; k++) ledges.push({ v: 0.14 + (k / 5) * 0.7 + rr() * 0.1, len: 0.04 + rr() * 0.08, d: (0.015 + rr() * 0.045) * w, side: k % 2 ? 1 : -1 });
      const ledgeAt = (v, side) => { let d = 0; for (const l of ledges) if (l.side === side) { const q = (v - l.v) / l.len; if (q > 0 && q < 1.6) d = Math.max(d, l.d * smooth(q * 12) * (1 - smooth((q - 0.4) / 1.2))); } return d; };
      const half = (v) => {
        // 春笋形：底部外撇、中段微收、顶端圆收
        let hw = (w / 2) * (1.0 - 0.26 * v + 0.32 * Math.exp(-v * 9));
        if (v > 0.9) hw *= 0.35 * Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.9) / 0.1, 2))) + 0.65 * (1 - ((v - 0.9) / 0.1) * 0.6);
        return hw;
      };
      const Lp = [], Rp = [];
      for (let i = 0; i <= N; i++) {
        const v = i / N, y = bot - v * h, hw = half(v);
        const nl = (noise1(v * 8, seed) - 0.5) * w * 0.12 + (noise1(v * 37, seed + 1) - 0.5) * w * 0.035;
        const nr = (noise1(v * 8, seed + 2) - 0.5) * w * 0.11 + (noise1(v * 37, seed + 3) - 0.5) * w * 0.035;
        Lp.push([cx - hw + nl - ledgeAt(v, -1), y]);
        Rp.push([cx + hw + nr + ledgeAt(v, 1), y]);
      }
      const path = () => { g.beginPath(); Lp.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = N; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath(); };
      const at = (v, u) => { const i = Math.round(clamp(v) * N); return [lerp(Lp[i][0], Rp[i][0], (u + 1) / 2), Lp[i][1]]; };
      const dark = shade(col, -0.42), mid = col, lit = mix(col, light, 0.55);
      path(); g.fillStyle = K.lin(g, cx - w * 0.2, 0, cx + w * 0.7, 0, [[0, shade(col, -0.18)], [1, dark]]); g.fill();
      g.save(); path(); g.clip();
      // 受光面：交界线硬，带一点起伏
      g.beginPath(); g.moveTo(Lp[0][0] - w, bot + 2);
      for (let i = 0; i <= N; i++) { const v = i / N, [x, y] = at(v, -0.02 + 0.22 * (noise1(v * 11, seed + 5) - 0.5) + 0.18 * (noise1(v * 31, seed + 6) - 0.5)); g.lineTo(x, y); }
      g.lineTo(Lp[N][0] - w, bot - h - 10); g.closePath();
      g.fillStyle = K.lin(g, cx - w * 0.65, 0, cx + w * 0.05, 0, [[0, mix(lit, '#ffffff', 0.15)], [0.45, lit], [1, mix(mid, light, 0.2)]]); g.fill();
      // 竖向柱状节理：长短不一的竖缝，暗线旁贴一道亮线
      for (let k = 0; k < 16; k++) {
        const u0 = -0.92 + rr() * 1.84, v0 = rr() * 0.3, v1 = Math.min(0.97, v0 + 0.35 + rr() * 0.6), shadow = u0 > 0.05;
        g.strokeStyle = `rgba(16,14,12,${(shadow ? 0.35 : 0.22) + rr() * 0.2})`; g.lineWidth = 0.8 + rr() * 1.6;
        g.beginPath();
        for (let v = v0; v <= v1; v += 0.012) { const [x, y] = at(v, u0 + (noise1(v * 9 + k, seed + 7) - 0.5) * 0.1); v === v0 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
        if (!shadow) {
          g.strokeStyle = rgba(light, 0.12 + rr() * 0.12); g.lineWidth = 1;
          g.beginPath();
          for (let v = v0; v <= v1; v += 0.02) { const [x, y] = at(v, u0 + (noise1(v * 9 + k, seed + 7) - 0.5) * 0.1); v === v0 ? g.moveTo(x - 1.6, y) : g.lineTo(x - 1.6, y); }
          g.stroke();
        }
      }
      // 斧劈皴：斜向下劈的楔形暗块，背光侧更密更重
      for (let k = 0; k < 90; k++) {
        const u = -1 + Math.pow(rr(), 0.7) * 2, v = 0.05 + rr() * 0.88, [x, y] = at(v, u), s = (6 + rr() * 16) * (h / 420), dk = u > 0 ? 0.32 : 0.16;
        g.fillStyle = `rgba(14,12,10,${dk * (0.4 + rr() * 0.8)})`;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - s * 0.35, y + s * 1.6); g.lineTo(x + s * (0.2 + rr() * 0.3), y + s * (0.9 + rr() * 0.5)); g.closePath(); g.fill();
      }
      // 岩檐：下面一道阴影、上沿一线受光
      for (const l of ledges) {
        const i = Math.round(l.v * N), y = Lp[i][1], x0 = l.side < 0 ? Lp[i][0] : lerp(Lp[i][0], Rp[i][0], 0.6), x1 = l.side < 0 ? lerp(Lp[i][0], Rp[i][0], 0.4) : Rp[i][0];
        const sh = (6 + l.d * 0.4) * (h / 420), tilt = (h2(i, 3) - 0.5) * 10;
        g.fillStyle = K.lin(g, 0, y, 0, y + sh, [[0, 'rgba(10,10,10,0.32)'], [1, 'rgba(10,10,10,0)']]);
        g.beginPath(); g.moveTo(x0, y - tilt * (l.side < 0 ? 0 : 1)); g.lineTo(x1, y - tilt * (l.side < 0 ? 1 : 0)); g.lineTo(x1, y + sh); g.lineTo(x0, y + sh); g.fill();
        g.strokeStyle = rgba(light, 0.35); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x0, y - 1.5); g.lineTo(lerp(x0, x1, 0.6), y - 2); g.stroke();
      }
      // 背光侧整体压暗，迎光边缘一线提亮
      g.fillStyle = K.lin(g, cx, 0, cx + w * 0.75, 0, [[0, 'rgba(10,14,22,0)'], [1, 'rgba(10,14,22,0.3)']]);
      g.fillRect(0, 0, pw, ph);
      g.restore();
      g.strokeStyle = rgba(mix(light, '#ffffff', 0.3), 0.55); g.lineWidth = 1.4;
      g.beginPath(); Lp.forEach(([x, y], i) => { if (i % 9 === 0 && rr() < 0.3) g.moveTo(x + 1, y); else i ? g.lineTo(x + 1, y) : g.moveTo(x + 1, y); }); g.stroke();
      // 缝里的苔点与小灌木
      for (let k = 0; k < 70; k++) {
        const l = ledges[k % ledges.length], useL = k % 3 !== 0, v = useL ? l.v + 0.004 : 0.08 + rr() * 0.85, u = useL ? l.side * (0.4 + rr() * 0.55) : -0.9 + rr() * 1.8;
        const [x, y] = at(v, u);
        g.fillStyle = `rgba(${22 + rr() * 16},${34 + rr() * 16},${26},${0.35 + rr() * 0.45})`;
        for (let j = 0; j < 3; j++) { g.beginPath(); g.ellipse(x + (rr() - 0.5) * 8, y - 1 - rr() * 3, 1 + rr() * 2.4, 0.8 + rr() * 1.4, 0, 0, TAU); g.fill(); }
      }
      // 峰顶：一抹草顶与一丛高低不一、斜出的松；岩檐上探出崖松
      const topY = bot - h, pc = '#18201b', pl = rgba(mix('#4a6a50', light, 0.4), 0.7);
      for (let k = 0; k < 40; k++) { const u = (rr() - 0.5) * 1.7, [x, y] = at(0.975 + rr() * 0.02, u); g.fillStyle = `rgba(26,${36 + rr() * 20},28,${0.5 + rr() * 0.4})`; g.beginPath(); g.ellipse(x, y + 2 + rr() * 4, 1.5 + rr() * 3.5, 1 + rr() * 2, 0, 0, TAU); g.fill(); }
      for (let k = 0; k < 5; k++) { const u = (k / 4 - 0.5) * 1.1 + (rr() - 0.5) * 0.2, [x, y] = at(0.97 + rr() * 0.02, u), big = k === 1 || k === 3 ? 1.25 : 0.6 + rr() * 0.35; inkPine(g, x, y + 5, big * (h / 420) * 1.5, u * 1.3 + (rr() - 0.5) * 0.6, seed * 13 + k, pc, pl); }
      for (let k = 0; k < 4; k++) { const l = ledges[(k * 2) % ledges.length], i = Math.round(l.v * N), [x, y] = l.side < 0 ? Lp[i] : Rp[i]; inkPine(g, x - l.side * 3, y, (0.4 + rr() * 0.4) * (h / 420) * 1.6, l.side * (0.9 + rr() * 0.6), seed * 17 + k, pc, pl); }
      // 空气透视：上部微融进天色，峰脚渐变成雾色（不透明，不会透出后面的山）
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = K.lin(g, 0, topY, 0, bot, [[0, rgba(haze, 0.22)], [0.45, rgba(haze, 0.06)], [0.72, rgba(base, 0)], [1, rgba(base, 1)]]);
      g.fillRect(0, 0, pw, ph);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 石笋孤峰（鼎湖峰）：(x, y) 为峰脚，h 高，w 宽；light 受光色；lightDir -1 光从左（默认）| 1 从右；
  // haze 高处融入的天色；mist 峰脚雾色（false 不画雾带，峰脚仍渐变成 base 色）；wisps 0..1 横过峰身的流云
  // h、w 可逐帧变（按 32 像素分档建图再缩放）
  E.stonePeak = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, h = o.h ?? 420, w = o.w ?? h * 0.3, t = o.t || 0;
    const mc = o.mist === false ? null : o.mist || '#eef0f0', hb = bucket(h, 32), wr = Math.round((w / h) * 50) / 50;
    const img = peakTex(hb, wr, o.color || '#5d5a52', o.light || '#e9d3a8', o.haze || mix(mc || '#dfe4ea', '#c8d2e0', 0.4), o.base || mc || '#e6e8ea', o.seed ?? 7);
    const k = h / hb, sx = (w / h) / wr;
    al(g, o.alpha ?? 1);
    g.save(); g.translate(x, y);
    if ((o.lightDir ?? -1) > 0) g.scale(-1, 1);
    g.drawImage(img, -img.lw * k * sx / 2, -img.lh * k, img.lw * k * sx, img.lh * k);
    g.restore();
    // 流云横过峰身：两三缕淡云从峰前慢慢飘过
    const wp = o.wisps ?? 0.6;
    if (wp > 0) {
      const bar = tintOf(softBar(), o.wispColor || mc || '#f4f2ee');
      for (let i = 0; i < 3; i++) {
        const P = 26 + i * 7, q = ((t / P + h2(i, 77)) % 1), wx = x + lerp(-1.4, 1.4, q) * w * 1.6, wy = y - h * (0.35 + 0.22 * i + 0.05 * Math.sin(t * 0.2 + i));
        al(g, (o.alpha ?? 1) * wp * 0.55 * Math.sin(q * PI));
        g.drawImage(bar, wx - w * 0.9, wy - h * 0.02, w * 1.8, h * 0.05 + 8);
        g.drawImage(bar, wx - w * 0.5 + 20, wy - h * 0.012 + 6, w * 1.1, h * 0.03 + 4);
      }
    }
    al(g, 1);
    if (mc) {
      E.mist(g, { color: mc, alpha: 0.5, t, speed: -9, offset: x, y: y - h * 0.16, h: 140, seed: 5 });
      E.mist(g, { color: mc, alpha: 0.65, t, speed: 6, offset: x * 0.3 + 400, y: y - 8, h: 160, seed: 6 });
    }
  };

  // 古道荒坡：秋草连天，一条古道蜿蜒到坡顶；坡顶起伏在 y 之上 30 像素内（天空画到 y 即可无缝）；
  // light 逆光色；haze 坡顶与远山相接处的雾色（false 不画）。y 可逐帧变（贴图在局部坐标里画，按 40 像素分档加高）
  function grassBase(hb, col, dark, path, seed) {
    return cached('grassRoad', [hb, col, dark, path ? 1 : 0, seed], W + 120, hb, 1, (g) => {
      // 局部坐标：坡顶基线在 y0=60，画面底约在 H + 20 - y + 60 以下
      const y0 = 60, bot = hb, rr = rng(seed + 11);
      const ridge = (x) => y0 - 20 + 10 * Math.sin(x * 0.004 + seed) + 16 * (noise1(x * 0.006, seed) - 0.5) - 8 * Math.exp(-Math.pow((x - 960) / 300, 2));
      g.translate(60, 0);
      g.beginPath(); g.moveTo(-60, bot); for (let x = -60; x <= W + 60; x += 10) g.lineTo(x, ridge(x)); g.lineTo(W + 60, bot); g.closePath();
      g.fillStyle = K.lin(g, 0, y0 - 30, 0, Math.min(bot, y0 + 300), [[0, mix(col, '#f2e3c4', 0.35)], [0.35, col], [1, dark]]);
      g.fill();
      g.save(); g.clip();
      // 起伏的光影
      for (let k = 0; k < 18; k++) A.softBlob(g, rr() * W, y0 + 20 + rr() * (bot - y0), 80 + rr() * 160, 0.12, k % 2 ? '#ffffff' : '#2a1d10');
      // 草纹：远处细密，近处粗长
      for (let k = 0; k < 2600; k++) {
        const v = Math.pow(rr(), 1.6), yy = lerp(y0 - 40, bot + 10, v), x = rr() * (W + 120) - 60;
        const len = 2 + v * 16, lean = (rr() - 0.4) * len * 0.6, tone = rr(), tn2 = rr();
        if (yy < ridge(x) + 1) continue;
        g.strokeStyle = tone < 0.3 ? rgba(dark, 0.35 + v * 0.3) : tone < 0.8 ? rgba(shade(col, (tn2 - 0.5) * 0.3), 0.5) : rgba('#f4e2b8', 0.35);
        g.lineWidth = 0.5 + v * 1.1;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + lean * 0.3, yy - len * 0.6, x + lean, yy - len); g.stroke();
      }
      if (path) {
        // 古道：近宽远窄，S 形伸向坡顶
        const cpt = (v) => [lerp(560, 860, v) + Math.sin(v * 5.2) * 120 * (1 - v), lerp(bot + 10, ridge(860) + 2, Math.pow(v, 0.8))];
        const hw = (v) => lerp(120, 3, Math.pow(v, 0.55));
        const Lp = [], Rp = [];
        for (let i = 0; i <= 40; i++) { const v = i / 40, [px, py] = cpt(v), ww = hw(v); Lp.push([px - ww, py]); Rp.push([px + ww * 0.9, py]); }
        g.beginPath(); Lp.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); for (let i = 40; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath();
        g.fillStyle = K.lin(g, 0, ridge(860), 0, bot, [[0, mix(col, '#efe2c6', 0.55)], [1, mix(dark, '#b49a72', 0.55)]]);
        g.fill();
        g.save(); g.clip();
        for (let k = 0; k < 180; k++) {
          const v = Math.pow(rr(), 0.7), [px, py] = cpt(v), ww = hw(v), j1 = rr(), j2 = rr(), j3 = rr();
          const sx = px + (j1 - 0.5) * ww * 1.8, s = 1 + (1 - v) * 7;
          g.fillStyle = j2 < 0.5 ? 'rgba(70,56,40,0.35)' : 'rgba(250,240,220,0.3)';
          g.beginPath(); g.ellipse(sx, py + (j3 - 0.5) * 6, s, s * 0.45, 0, 0, TAU); g.fill();
        }
        // 车辙
        for (const side of [-0.45, 0.4]) {
          g.strokeStyle = 'rgba(60,46,30,0.25)'; g.lineWidth = 2;
          g.beginPath(); for (let i = 0; i <= 30; i++) { const v = i / 30, [px, py] = cpt(v); i ? g.lineTo(px + hw(v) * side, py) : g.moveTo(px + hw(v) * side, py); } g.stroke();
        }
        g.restore();
        // 路边草压上路面
        for (let k = 0; k < 500; k++) {
          const v = rr(), [px, py] = cpt(v), ww = hw(v), sd = rr() < 0.5 ? -1 : 0.9, j = rr(), c2 = rr();
          const x = px + sd * ww * (0.9 + j * 0.25), len = 3 + (1 - v) * 18;
          g.strokeStyle = rgba(c2 < 0.5 ? dark : col, 0.7); g.lineWidth = 0.6 + (1 - v) * 1.2;
          g.beginPath(); g.moveTo(x, py); g.quadraticCurveTo(x - sd * len * 0.2, py - len * 0.6, x - sd * len * 0.45, py - len); g.stroke();
        }
      }
      g.restore();
    });
  }
  E.grassRoad = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#b8924e', dark = o.dark || '#4a3820', wind = o.wind ?? 0.5, light = o.light || '#ffd9a0', seed = o.seed ?? 1;
    const hb = bucket(H + 80 - y, 40), img = grassBase(hb, col, dark, o.path !== false, seed);
    blit(g, img, -60, y - 60, img.lw, img.lh);
    // 坡顶与远山相接处一道薄雾，接缝不硬
    if (o.haze !== false) { const hz = o.haze || mix(col, light, 0.6); vfill(g, -80, y - 46, W + 80, y + 26, [[0, rgba(hz, 0)], [0.55, rgba(hz, o.hazeA ?? 0.45)], [1, rgba(hz, 0)]]); }
    // 近景长草：两头尖的叶片（填充，不是等宽线），随风摆；每四株一穗芒花，逆光发亮
    const n = o.n ?? 150, gust = Math.sin(t * 0.7) * 0.5 + 0.5;
    g.lineCap = 'round';
    const plumes = [];
    for (let i = 0; i < n; i++) {
      const x = h2(i, seed + 3) * (W + 80) - 40, by = H + 8 - h2(i, seed + 4) * 70;
      const len = 60 + h2(i, seed + 5) * 120, ph = x * 0.012 + i * 0.3;
      const sw = (Math.sin(t * 1.6 + ph) * 0.6 + gust * 0.8) * wind * len * 0.35 + len * 0.08;
      const tx = x + sw, ty = by - len + Math.abs(sw) * 0.25, bw = (1.6 + h2(i, seed + 6) * 2.6) * (len / 150);
      g.fillStyle = rgba(i % 3 ? dark : shade(col, -0.25), 0.9);
      g.beginPath(); g.moveTo(x - bw, by); g.quadraticCurveTo(x + sw * 0.15 - bw * 0.6, by - len * 0.55, tx, ty); g.quadraticCurveTo(x + sw * 0.15 + bw * 0.6, by - len * 0.55, x + bw, by); g.closePath(); g.fill();
      if (i % 4 === 0) plumes.push([x, by, len, sw, tx, ty, i]);
    }
    // 芒花：从穗梢顺风弯下的一道弧（穗轴），轴上垂下细丝，迎光发亮
    g.lineWidth = 0.7;
    for (const [x, by, len, sw, tx, ty, i] of plumes) {
      const dir = sw >= 0 ? 1 : -1, pl = 22 + 16 * h2(i, seed + 7), fx = Math.sin(t * 2.2 + i) * 2;
      const ax = tx - dir * pl * 0.1, ay = ty + pl * 0.15, mx = tx + dir * pl * 0.55 + fx, my = ty - pl * 0.12, ex = tx + dir * pl * 0.95 + fx * 1.5, ey = ty + pl * 0.45;
      g.strokeStyle = rgba(light, 0.55);
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(mx, my, ex, ey);
      for (let k = 1; k < 10; k++) {
        const u = k / 10, px = (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * ex, py = (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * ey;
        const fl = (7 + 6 * Math.sin(u * PI)) * (0.8 + 0.4 * h2(i, k)), fw = Math.sin(t * 3 + i + k) * 1.2;
        g.moveTo(px, py); g.quadraticCurveTo(px + dir * fl * 0.35 + fw, py + fl * 0.3, px + dir * fl * 0.2 + fw * 1.5, py + fl);
      }
      g.stroke();
      g.strokeStyle = rgba(dark, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(tx, ty); g.lineTo(ax, ay); g.stroke(); g.lineWidth = 0.7;
      K.lighter(g, () => glow(g, mx, my + pl * 0.2, 13, light, 0.14));
    }
  };

  // 雪地上一团血色洇开的贴图：像宣纸上的红墨晕开——边缘是分形的毛边，里面有深浅的水渍纹，中心最浓（贴的时候压成透视椭圆）
  function bleedTex() {
    return cached('bleed', [], 256, 256, 0.6, (g) => {
      const S = sp().S * 0.6, N = Math.round(256 * S), img = g.createImageData(N, N), D = img.data;
      const fbm = (x, y, s) => 0.5 * noise2(x, y, s) + 0.27 * noise2(x * 2.1, y * 2.1, s + 1) + 0.15 * noise2(x * 4.3, y * 4.3, s + 2) + 0.08 * noise2(x * 9, y * 9, s + 3);
      for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
        const nx = (px / N) * 2 - 1, ny = (py / N) * 2 - 1, d = Math.hypot(nx, ny);
        const edge = 0.62 + 0.5 * (fbm(nx * 2.2 + 5, ny * 2.2 + 5, 5) - 0.5);
        const a = smooth((edge - d) / 0.12) * (0.75 + 0.25 * smooth((edge - d) / 0.4));
        // 水渍纹：浓淡相间的几圈，像墨在纸上走过
        const vein = 0.5 + 0.5 * Math.sin((d - edge) * 28 + fbm(nx * 3, ny * 3, 9) * 6);
        const core = clamp(smooth((edge * 0.7 - d) / 0.35) * 0.8 + vein * 0.2 * (1 - d));
        const i = (py * N + px) * 4;
        D[i] = lerp(214, 140, core); D[i + 1] = lerp(96, 14, core); D[i + 2] = lerp(112, 36, core); D[i + 3] = a * 255 * (0.8 + 0.2 * fbm(nx * 12, ny * 12, 7));
      }
      g.setTransform(1, 0, 0, 1, 0, 0); g.putImageData(img, 0, 0);
    });
  }
  let redBuf = null;
  // 雪原：y 地平线（雪丘起伏在 y 之上 25 像素内）；footprints {x0,y0,x1,y1,n,progress} 由近到远的一串脚印；
  // red 0..1 雪染红：只给 red 是整片由远及近泛红；再给 redAt {x, y, r} 就从那一点洇开（r 为 red=1 时的半径）；
  // drift 0..1 贴地吹过的雪尘。y 可逐帧变
  E.snowfield = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#eef2f7', sh = o.shade || '#9fb0c8', seed = o.seed ?? 2, hb = bucket(H + 40 - y, 40);
    const img = cached('snow', [hb, col, sh, seed], W + 120, hb, 1, (g) => {
      const y0 = 30, bot = hb, rr = rng(seed + 5), span = Math.min(bot, 300);
      g.translate(60, 0);
      const ridge = (x) => y0 - 12 + 6 * Math.sin(x * 0.005 + seed) + 8 * (noise1(x * 0.008, seed) - 0.5);
      g.beginPath(); g.moveTo(-60, bot); for (let x = -60; x <= W + 60; x += 12) g.lineTo(x, ridge(x)); g.lineTo(W + 60, bot); g.closePath();
      g.fillStyle = K.lin(g, 0, y0 - 10, 0, y0 + span, [[0, mix(col, sh, 0.45)], [0.3, col], [0.7, mix(col, sh, 0.2)], [1, mix(col, sh, 0.45)]]);
      g.fill();
      g.save(); g.clip();
      for (let k = 0; k < 10; k++) A.softBlob(g, rr() * W, lerp(y0 + 20, bot, rr()), 120 + rr() * 200, 0.18, k % 3 ? sh : '#ffffff');
      // 雪丘：上亮下蓝的长椭圆
      for (let k = 0; k < 16; k++) {
        const v = Math.pow(rr(), 1.3), yy = lerp(y0 + 6, bot + 30, v), x = rr() * W, rx = (120 + rr() * 260) * (0.4 + v), ry = rx * (0.06 + 0.04 * v);
        g.fillStyle = K.lin(g, 0, yy - ry, 0, yy + ry, [[0, rgba('#ffffff', 0.55)], [0.45, rgba(col, 0)], [1, rgba(sh, 0.6)]]);
        g.beginPath(); g.ellipse(x, yy, rx, ry, 0, 0, TAU); g.fill();
      }
      // 风痕
      for (let k = 0; k < 120; k++) {
        const v = Math.pow(rr(), 1.5), yy = lerp(y0 + 4, bot, v), x = rr() * W, len = (20 + rr() * 80) * (0.3 + v);
        g.strokeStyle = rgba(sh, 0.12 + 0.12 * v); g.lineWidth = 0.6 + v;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + len * 0.5, yy - 1.5 * v, x + len, yy + 0.5); g.stroke();
      }
      g.restore();
    });
    const ox = -60, oy = y - 30;
    blit(g, img, ox, oy, img.lw, img.lh);
    const fp = o.footprints;
    if (fp) {
      const n = fp.n ?? 26, pr = fp.progress ?? 1, fs = fp.s ?? 2.2, col2 = fp.color || shade(sh, -0.2);
      for (let i = 0; i < n * pr; i++) {
        const v = i / n, ease = Math.pow(v, 0.6);
        const px = lerp(fp.x0 ?? 640, fp.x1 ?? 820, ease) + Math.sin(v * 7 + seed) * 24 * (1 - v), py = lerp(fp.y0 ?? H - 20, fp.y1 ?? y + 12, ease);
        const s = lerp(1, 0.1, ease) * fs, side = i % 2 ? 1 : -1;
        const a = clamp(n * pr - i) * (fp.alpha ?? 0.75);
        g.fillStyle = rgba(col2, a * 0.7);
        g.beginPath(); g.ellipse(px + side * 9 * s, py, 6 * s, 3 * s, side * 0.1, 0, TAU); g.fill();
        g.fillStyle = rgba('#ffffff', a * 0.6);
        g.beginPath(); g.ellipse(px + side * 9 * s, py + 2.2 * s, 6 * s, 1.5 * s, 0, 0, PI); g.fill();
      }
    }
    const red = clamp(o.red || 0);
    if (red > 0) {
      // 染红：先在半分辨率缓冲里画红（渐变或洇开的血团），用雪地形状裁出，再正片叠底贴回——只染雪，不染天
      const S = sp().S * 0.5, bw = img.lw, bh = img.lh;
      if (!redBuf) redBuf = document.createElement('canvas');
      const pw = Math.ceil(bw * S), ph = Math.ceil(bh * S);
      if (redBuf.width < pw || redBuf.height < ph) { redBuf.width = Math.max(redBuf.width, pw); redBuf.height = Math.max(redBuf.height, ph); }
      const q = redBuf.getContext('2d');
      q.setTransform(1, 0, 0, 1, 0, 0); q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; q.clearRect(0, 0, redBuf.width, redBuf.height);
      q.setTransform(S, 0, 0, S, -ox * S, -oy * S);
      const ra = o.redAt;
      if (ra) {
        const R = (ra.r ?? 500) * Math.pow(red, 0.7), ratio = ra.ratio ?? 0.42;
        q.globalAlpha = clamp(red * 3);
        q.drawImage(bleedTex(), (ra.x ?? 640) - R, (ra.y ?? H - 120) - R * ratio, R * 2, R * 2 * ratio);
        // 几处溅开的小团
        for (let i = 0; i < 6; i++) { const rr2 = R * (0.12 + 0.2 * h2(i, 5)), a = (h2(i, 6) - 0.5) * PI * 2, d = R * (0.75 + 0.35 * h2(i, 7)); q.globalAlpha = clamp(red * 2 - 0.4); q.drawImage(bleedTex(), (ra.x ?? 640) + Math.cos(a) * d - rr2, (ra.y ?? H - 120) + Math.sin(a) * d * ratio - rr2 * ratio, rr2 * 2, rr2 * 2 * ratio); }
      } else {
        q.fillStyle = K.lin(q, 0, y - 30, 0, H, [[0, rgba('#d8707a', red * 0.5)], [0.5, rgba('#c23040', red * 0.65)], [1, rgba('#9a0c24', red * 0.8)]]);
        q.fillRect(ox, oy, bw, bh);
        // 深浅不匀：再洇上几团更浓的红
        for (let i = 0; i < 9; i++) { const v = h2(i, seed + 70), R = (90 + 220 * h2(i, seed + 71)) * (0.4 + v), cx = h2(i, seed + 72) * W, cy = lerp(y + 10, H + 20, Math.pow(v, 0.8)); q.globalAlpha = clamp(red * 1.4 - 0.2) * 0.7; q.drawImage(bleedTex(), cx - R, cy - R * 0.35, R * 2, R * 0.7); }
        q.globalAlpha = 1;
      }
      q.globalAlpha = 1; q.globalCompositeOperation = 'destination-in';
      q.drawImage(img, ox, oy, bw, bh);
      g.save();
      g.globalCompositeOperation = 'multiply'; al(g, 1);
      g.drawImage(redBuf, 0, 0, pw, ph, ox, oy, pw / S, ph / S);
      g.restore();
    }
    // 贴地吹过的雪尘：长条淡白，近大远小，随风横移
    const dr = o.drift ?? 0.5;
    if (dr > 0) {
      const bar = softBar();
      for (let i = 0; i < 16; i++) {
        const v = h2(i, seed + 30), yy = lerp(y + 4, H + 10, Math.pow(v, 0.9)), len = (120 + 260 * h2(i, seed + 31)) * (0.3 + v);
        const sp2 = (40 + 60 * v) * (o.wind ?? 1), x = ((h2(i, seed + 32) * (W + len * 2) + t * sp2) % (W + len * 2)) - len;
        al(g, dr * (0.12 + 0.18 * v) * (0.6 + 0.4 * Math.sin(t * 0.9 + i)));
        g.drawImage(bar, x, yy - (3 + 8 * v), len, 6 + 16 * v);
      }
      al(g, 1);
    }
    // 雪面闪光
    const sk = o.sparkle ?? 1;
    if (sk > 0) K.lighter(g, () => {
      for (let i = 0; i < 40; i++) {
        const v = h2(i, seed + 20), px = h2(i, seed + 21) * W, py = lerp(y + 8, H, Math.pow(v, 0.8));
        const a = Math.max(0, Math.sin(t * (1.5 + h2(i, seed + 22) * 3) + i * 1.7)) ** 6;
        if (a < 0.05) continue;
        glow(g, px, py, 3 + v * 6, '#ffffff', a * 0.8 * sk);
      }
    });
  };

  // 河岸：side 'left'|'right'，从画面边缘的 top 高度斜入水线 y；foam 浪花随 t 拍岸；sky 湿沙上映出的天色；
  // 半没在水里的礁石、沙上的卵石与草丛。整体随 y、top 一起平移时贴图不重建
  E.shore = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 560, top = o.top ?? y - 60, side = o.side || 'left', reach = o.reach ?? 520;
    const col = o.color || '#3b3228', wet = o.wet || shade(col, -0.35), foam = o.foam || '#f2efe6', seed = o.seed ?? 3, skyC = o.sky || mix(col, '#e8e0d8', 0.5);
    const dy = Math.round(y - top), hb = bucket(H + 30 - top, 40);
    // 局部坐标：岸顶在 10，水线在 10 + dy
    const yl = 10 + dy;
    const edge = (v) => [lerp(reach, 0, v) + Math.sin(v * 9 + seed) * 18 * (1 - v) + (noise1(v * 14, seed) - 0.5) * 30, lerp(yl, hb + 10, Math.pow(v, 0.8))];
    const rocks = [];
    { const rr = rng(seed + 50); for (let k = 0; k < 4; k++) { const v = 0.1 + (k / 4) * 0.8 + rr() * 0.1, [px, py] = edge(v), out = rr() * 40 * (0.3 + v); rocks.push([px + 4 + out, py + 3 + out * 0.15, (10 + rr() * 26) * (0.4 + v), k]); } }
    const img = cached('shore', [dy, reach | 0, hb, col, wet, skyC, seed], W, hb, 1, (c) => {
      const rr = rng(seed);
      c.beginPath(); c.moveTo(-40, 10);
      c.quadraticCurveTo(reach * 0.5, 4, reach + 20, yl - 8);
      for (let i = 0; i <= 30; i++) { const [px, py] = edge(i / 30); c.lineTo(px, py); }
      c.lineTo(-40, hb + 20); c.closePath();
      c.fillStyle = K.lin(c, 0, 10, 0, hb, [[0, shade(col, 0.25)], [0.4, col], [1, shade(col, -0.3)]]);
      c.fill();
      c.save(); c.clip();
      for (let k = 0; k < 400; k++) { c.fillStyle = rr() < 0.5 ? 'rgba(255,240,220,0.08)' : 'rgba(0,0,0,0.12)'; c.fillRect(rr() * reach, 10 + rr() * hb, 1 + rr() * 3, 1); }
      // 湿沙带：颜色深，映着天光，带几道被浪抹平的亮痕
      c.lineJoin = 'round';
      c.lineWidth = 34; c.strokeStyle = rgba(wet, 0.6);
      c.beginPath(); for (let i = 0; i <= 30; i++) { const [px, py] = edge(i / 30); i ? c.lineTo(px - 12, py) : c.moveTo(px - 12, py); } c.stroke();
      c.lineWidth = 12; c.strokeStyle = rgba(skyC, 0.32);
      c.beginPath(); for (let i = 0; i <= 30; i++) { const [px, py] = edge(i / 30); i ? c.lineTo(px - 6, py - 2) : c.moveTo(px - 6, py - 2); } c.stroke();
      for (let k = 0; k < 14; k++) { const v = rr(), [px, py] = edge(v); c.strokeStyle = rgba(skyC, 0.25 + rr() * 0.2); c.lineWidth = 1 + v * 1.5; c.beginPath(); c.moveTo(px - 30 - rr() * 40, py - 4 - rr() * 6); c.lineTo(px - 8, py - 3); c.stroke(); }
      // 卵石
      for (let k = 0; k < 26; k++) {
        const v = rr(), [ex, ey] = edge(v), px = ex - 20 - rr() * 160 * (0.3 + v), py = ey - 6 - rr() * 30 * (0.3 + v), s = (1.5 + rr() * 3.5) * (0.4 + v);
        c.fillStyle = rgba(shade(col, -0.5), 0.6); c.beginPath(); c.ellipse(px + s * 0.2, py + s * 0.35, s * 1.1, s * 0.5, 0, 0, TAU); c.fill();
        c.fillStyle = mix(col, rr() < 0.5 ? '#9a8f84' : '#6a6058', 0.5); c.beginPath(); c.ellipse(px, py, s, s * 0.6, rr() - 0.5, 0, TAU); c.fill();
        c.fillStyle = rgba('#fff4e0', 0.25); c.beginPath(); c.ellipse(px - s * 0.3, py - s * 0.25, s * 0.45, s * 0.2, 0, 0, TAU); c.fill();
      }
      c.restore();
      // 岸上的草丛
      for (let k = 0; k < 14; k++) {
        const px = rr() * reach * 0.8, py = 14 + rr() * dy * 0.6 + (px / reach) * dy * 0.4, s = 0.6 + rr() * 0.7;
        c.strokeStyle = rgba(mix(shade(col, -0.3), '#6a6040', 0.4), 0.7); c.lineCap = 'round';
        for (let j = 0; j < 9; j++) { const a = -PI / 2 + (j / 8 - 0.5) * 1.5 + (rr() - 0.5) * 0.3, l = (6 + rr() * 10) * s; c.lineWidth = 0.8 * s; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + Math.cos(a) * l * 0.5, py + Math.sin(a) * l * 0.6, px + Math.cos(a) * l, py + Math.sin(a) * l); c.stroke(); }
      }
      // 礁石：只画水线以上的部分，顶缘一线受光，底部被水吞没
      for (const [px, py, s, k] of rocks) {
        c.save(); c.beginPath(); c.rect(px - s * 2, py - s * 2, s * 4, s * 2 + s * 0.15); c.clip();
        c.fillStyle = shade(col, -0.2); A.inkBlob(c, px, py, s, k * 2.3, 0.3); c.fill();
        c.fillStyle = K.lin(c, 0, py - s, 0, py, [[0, rgba(mix(col, skyC, 0.45), 0.75)], [1, rgba(shade(col, -0.6), 0)]]); A.inkBlob(c, px - s * 0.12, py - s * 0.08, s * 0.82, k * 2.3, 0.3); c.fill();
        c.strokeStyle = rgba(skyC, 0.5); c.lineWidth = 1.2; c.beginPath(); c.arc(px - s * 0.1, py - s * 0.1, s * 0.85, PI * 1.12, PI * 1.62); c.stroke();
        c.restore();
      }
    });
    g.save();
    if (side === 'right') { g.translate(W, 0); g.scale(-1, 1); }
    g.translate(0, top - 10);
    blit(g, img, 0, 0, img.lw, img.lh);
    // 浪花拍岸：沿水线的白沫，随 t 涌上退下；礁石四周一圈圈拍出的白沫
    const surge = 0.5 + 0.5 * Math.sin(t * 1.1 + seed);
    g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const off = 8 + k * 9 + surge * 10;
      g.strokeStyle = rgba(foam, (0.5 - k * 0.14) * (0.6 + 0.4 * surge)); g.lineWidth = 2.4 - k * 0.6;
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const v = i / 40, [px, py] = edge(v);
        const x = px + off * (0.4 + v), yy = py + Math.sin(v * 40 + t * 2 + k) * 1.2;
        if (h2(i + k * 50, seed) < 0.18) g.moveTo(x, yy); else i ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
    for (const [px, py, s, k] of rocks) {
      const ph = (t * 0.7 + k * 0.37) % 1;
      g.strokeStyle = rgba(foam, 0.55 * (1 - ph)); g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(px, py + s * 0.12, s * (1.05 + ph * 0.6), s * (0.2 + ph * 0.12), 0, 0, PI); g.stroke();
      g.strokeStyle = rgba(foam, 0.7); g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(px, py + s * 0.12, s * 1.02, s * 0.16, 0, PI * (0.1 + 0.05 * Math.sin(t * 2 + k)), PI * 0.9); g.stroke();
    }
    g.restore();
  };

  // ---------- 水 ----------
  // 水面：y 水平线，top/bottom 远近水色；reflectFn(g) 在翻转后的坐标里重画要倒映的景物（按原坐标画即可），
  // 自动做波纹错位；reflect 倒影强度，wobble 摆幅；glint {x, color, w, a} 日/月光柱（碎成一段段闪烁的光点）；lines 波光条数
  // 注意：reflectFn 里不要再调用 water
  let reflBuf = null;
  E.water = function (g, o = {}) {
    const y = o.y ?? 470, t = o.t || 0, top = o.top || '#41526e', bottom = o.bottom || '#0f1626', dh = H + 30 - y;
    vfill(g, -80, y, W + 80, H + 40, [[0, top], [(H - y) / (H + 40 - y), bottom], [1, bottom]]);
    if (o.reflectFn) {
      // 倒影先画进半分辨率缓冲（倒影本就柔一些），再逐条错位贴回：越近摆幅越大、条越宽
      const ra = o.reflect ?? 0.6, amp = o.wobble ?? 3, Sr = sp().S * (o.reflectScale ?? 0.4);
      const sg = scratchCtx(W + 160, dh, o.reflectScale ?? 0.4);
      sg.translate(80, y); sg.scale(1, -1);
      o.reflectFn(sg);
      // 逐条错位贴回：条的上下边对齐到设备像素，相邻两条不重叠也不留缝（半透明叠加也不出横纹）；
      // 越往近处倒影越淡。变换带旋转时退回到先拼进缓冲再整体贴的做法
      const m = g.getTransform(), fadeA = (u) => u < 0.4 ? lerp(0.95, 0.72, u / 0.4) : lerp(0.72, 0.3, clamp((u - 0.4) / 0.6));
      if (Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        let d = 0;
        while (d < dh) {
          const u = d / dh, hs = 1.6 + u * 7;
          const dx = Math.sin(d * 0.23 - t * 2.1) * amp * (0.25 + u * 1.6) + Math.sin(d * 0.061 + t * 0.9) * amp * 0.7 * u;
          const Y0 = Math.round(m.d * (y + d) + m.f), Y1 = Math.round(m.d * (y + d + hs) + m.f);
          if (Y1 > Y0) { g.globalAlpha = A0 * ra * fadeA(u); g.drawImage(scratch, 0, d * Sr, (W + 160) * Sr, hs * Sr, m.a * (-80 + dx) + m.e, Y0, m.a * (W + 160), Y1 - Y0); }
          d += hs;
        }
        g.setTransform(m);
      } else {
        const rw = Math.ceil((W + 160) * Sr), rh = Math.ceil(dh * Sr);
        if (!reflBuf) reflBuf = document.createElement('canvas');
        if (reflBuf.width < rw || reflBuf.height < rh) { reflBuf.width = Math.max(reflBuf.width, rw); reflBuf.height = Math.max(reflBuf.height, rh); }
        const rg = reflBuf.getContext('2d');
        rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalAlpha = 1; rg.globalCompositeOperation = 'source-over'; rg.clearRect(0, 0, rw, rh);
        let d = 0;
        while (d < dh) {
          const u = d / dh, hs = 1.6 + u * 7;
          const dx = Math.sin(d * 0.23 - t * 2.1) * amp * (0.25 + u * 1.6) + Math.sin(d * 0.061 + t * 0.9) * amp * 0.7 * u;
          rg.globalAlpha = fadeA(u);
          rg.drawImage(scratch, 0, d * Sr, rw, (hs + 1) * Sr, dx * Sr, d * Sr, rw, (hs + 1) * Sr);
          d += hs;
        }
        al(g, ra);
        g.drawImage(reflBuf, 0, 0, rw, rh, -80, y, rw / Sr, rh / Sr);
      }
      al(g, 1);
    }
    const gl = o.glint;
    if (gl) {
      // 光柱：每一行两三段短短的碎光（压扁的光斑），左右错落、有断有续、各自闪烁；越近越宽越散
      const gx = gl.x ?? 640, gc = gl.color || '#ffe6b0', gw = gl.w ?? 40, ga = gl.a ?? 0.6, spr = sp().tint(sp().glow, qc(gc));
      K.lighter(g, () => {
        glow(g, gx, y + 6, gw * 2.5, gc, ga * 0.4);
        const rows = 40;
        for (let i = 0; i < rows; i++) {
          const u = i / rows, yy = y + 3 + Math.pow(u, 1.5) * (dh - 16), spread = gw * (0.4 + u * 2.2), th = 1.6 + u * 3.6;
          const nd = 2 + Math.floor(h2(i, 31) * 3);
          for (let k = 0; k < nd; k++) {
            const f = noise1(t * (1.6 + h2(i * 5 + k, 33)) + i * 0.7 + k * 3.1, 5);
            if (f < 0.35) continue;
            const jx = (h2(i * 5 + k, 32) - 0.5) * 2 * spread + Math.sin(t * 1.3 + i * 0.9 + k) * (2 + u * 8);
            const len = gw * (0.18 + 0.5 * h2(i * 5 + k, 34)) * (0.5 + u * 1.4);
            al(g, Math.min(1, ga * (1.1 - u * 0.75) * (f - 0.35) * 2.2 * (1 - Math.abs(jx) / (spread * 1.3))));
            g.drawImage(spr, gx + jx - len / 2, yy - th / 2, len, th);
          }
        }
        al(g, 1);
      });
    }
    // 波光：柔边的细长亮痕，随水流慢慢横移、明灭
    const n = o.lines ?? 40, lc = o.lineColor || '#ffffff', la = o.lineA ?? 0.22, flow = o.flow ?? 1;
    if (n > 0) {
      const bar = tintOf(softBar(), lc);
      for (let i = 0; i < n; i++) {
        const u = Math.pow(h2(i, 41), 1.6), yy = y + 2 + u * (dh - 30);
        const len = (16 + h2(i, 42) * 80) * (0.35 + u * 1.7);
        const x = ((((h2(i, 43) * (W + 300) + t * (5 + 12 * u) * flow) % (W + 300)) + W + 300) % (W + 300)) - 150;
        const a = la * (0.4 + 0.6 * h2(i, 44)) * (0.55 + 0.45 * Math.sin(t * 1.2 + i * 2.3));
        al(g, Math.min(1, a * 1.6));
        g.drawImage(bar, x, yy - (1 + u * 2), len, 2 + u * 4);
      }
      al(g, 1);
    }
    // 水天交界的薄雾
    if (o.mist !== false) {
      const mc = o.mist || mix(top, '#ffffff', 0.3);
      vfill(g, -80, y - 14, W + 80, y + 18, [[0, rgba(mc, 0)], [0.5, rgba(mc, 0.45)], [1, rgba(mc, 0)]]);
    }
  };

  // 潮水：叠在 water() 水面上，一排排浪由远到近（远细近大），浪高沿岸起伏、时断时续；
  // 每排浪是一道受光的浪脊线（下方一抹渐淡的浪面光）加上方一抹背光的浪背暗影，没有整齐的底边；
  // dir 1 向右（东）流，-1 向左；color 浪背暗色，light 浪脊亮色，foam 浪花；glint {x, color, w} 让浪尖在日/月光下闪亮
  E.waves = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 480, y1 = o.y1 ?? H + 20, col = o.color || '#2d4658', foam = o.foam || '#eef3ef', dir = o.dir ?? 1;
    const rows = o.rows ?? 10, amp = o.amp ?? 1, spd = o.speed ?? 1, seed = o.seed ?? 5, light = o.light || mix(col, '#9fd0d0', 0.45), gl = o.glint;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let r = 0; r < rows; r++) {
      const u = rows > 1 ? r / (rows - 1) : 1, z = Math.pow(u, 1.8);
      const yy = lerp(y, y1, z), A0w = (1.2 + 22 * z) * amp, lam = 40 + 300 * z;
      const off = t * (8 + 70 * z) * spd * dir + h2(r, seed) * 900;
      const step = Math.max(8, lam / 10);
      const hAt = (x) => { const n = 0.65 * noise1(x * (0.005 + 0.016 * (1 - z)) + r * 3.7 + t * 0.05 * dir, seed + r) + 0.35 * noise1(x * 0.013 + r, seed + r + 50); return clamp((n - 0.28) * 1.9); };
      const fr = (x) => { let f = (x - off) / lam + 0.35 * noise1(x * 0.002 + r, seed + 9); f -= Math.floor(f); return dir < 0 ? 1 - f : f; };
      const prof = (x) => { const f = fr(x), q = f < 0.68 ? f / 0.68 : 1 - (f - 0.68) / 0.32; return Math.pow(Math.sin(q * PI * 0.5), 1.8); };
      // 基线本身也随噪声上下起伏（不是一条直线）
      const base = (x) => yy + (noise1(x * 0.006 + r * 1.9, seed + 40) - 0.5) * (2 + 10 * z);
      const pts = [];
      for (let x = -60; x <= W + 60; x += step) { const hh = hAt(x); pts.push([x, base(x) - A0w * prof(x) * hh, hh]); }
      // 按浪高断开：浪低处不画
      const run = (dy, minH) => {
        g.beginPath(); let on = false;
        for (const [x, py, hh] of pts) { if (hh > minH) { on ? g.lineTo(x, py + dy * (0.4 + hh)) : g.moveTo(x, py + dy * (0.4 + hh)); on = true; } else on = false; }
      };
      const lw = 0.6 + 1.3 * z;
      // 浪背暗影（在浪脊之上，像压在前一排后面），宽而淡
      g.lineJoin = 'bevel';
      g.strokeStyle = rgba(col, 0.05 + 0.1 * z); g.lineWidth = lw * 3 + A0w * 0.5;
      run(-(lw * 2 + A0w * 0.45), 0.18); g.stroke();
      if (z > 0.3) {
        // 近处的浪面：浪脊下一片受光的斜面，往下渐淡（填色，不是一条粗线）
        const fh = A0w * 0.9 + 4, gr = g.createLinearGradient(0, yy - A0w * 0.6, 0, yy + fh);
        gr.addColorStop(0, rgba(light, 0.2 + 0.12 * z)); gr.addColorStop(1, rgba(light, 0));
        g.fillStyle = gr;
        let seg = [];
        const flush = () => { if (seg.length > 1) { g.beginPath(); seg.forEach(([x, py], i) => (i ? g.lineTo(x, py) : g.moveTo(x, py))); for (let i = seg.length - 1; i >= 0; i--) g.lineTo(seg[i][0], seg[i][1] + fh * (0.5 + seg[i][2] * 0.5)); g.closePath(); g.fill(); } seg = []; };
        for (const p of pts) { if (p[2] > 0.16) seg.push(p); else flush(); }
        flush();
      } else {
        g.strokeStyle = rgba(light, 0.08 + 0.09 * z); g.lineWidth = lw * 3 + A0w * 0.28;
        run(lw * 1.4 + A0w * 0.2, 0.14); g.stroke();
      }
      g.lineJoin = 'round';
      // 浪脊亮线
      g.strokeStyle = rgba(mix(light, '#ffffff', 0.3), 0.22 + 0.36 * z); g.lineWidth = lw;
      run(0, 0.22); g.stroke();
      // 浪尖白沫：只在浪高处成片
      const k0 = Math.floor((-80 - off) / lam) - 1, n = Math.ceil((W + 160) / lam) + 2;
      for (let k = k0; k < k0 + n; k++) {
        const cx = off + (k + (dir < 0 ? 0.32 : 0.68)) * lam;
        if (cx < -80 || cx > W + 80) continue;
        const hh = hAt(cx);
        if (hh < 0.45) continue;
        const cy = base(cx) - A0w * hh;
        let fa = (0.25 + 0.6 * z) * (0.55 + 0.45 * Math.sin(t * 1.3 + k * 2.1)) * clamp((hh - 0.45) * 2.5);
        let fc = foam;
        if (gl) { const d = Math.abs(cx - (gl.x ?? 640)) / ((gl.w ?? 80) * (1 + z * 3)); if (d < 1) { fa = Math.min(1, fa + (1 - d) * 0.6); fc = gl.color || '#ffe0b0'; } }
        g.strokeStyle = rgba(fc, fa); g.lineWidth = 0.7 + 2.2 * z;
        g.beginPath(); g.moveTo(cx - dir * lam * 0.3 * hh, cy + A0w * 0.4 * hh); g.quadraticCurveTo(cx - dir * lam * 0.08, cy - A0w * 0.06, cx + dir * lam * 0.03, cy + A0w * 0.12 * hh); g.stroke();
        if (z > 0.3) {
          g.fillStyle = rgba(fc, fa * 0.7);
          for (let s = 0; s < 6; s++) {
            const px = cx - dir * (s * 0.05 + h2(k * 7 + s, seed) * 0.06) * lam, py = cy + A0w * (0.12 + s * 0.11) * hh + h2(k + s, r) * 4;
            g.beginPath(); g.arc(px, py, (0.5 + h2(k * 3 + s, r) * 1.5) * z * 2, 0, TAU); g.fill();
          }
        }
      }
    }
  };

  // 涟漪：t0 为起始时间（可为数组），每次泛出 rings 圈，ratio 椭圆扁度
  E.ripples = function (g, o = {}) {
    const t = o.t || 0, list = Array.isArray(o.t0) ? o.t0 : [o.t0 ?? 0];
    const x = o.x ?? 640, y = o.y ?? 560, life = o.life ?? 2.6, s = o.scale ?? 1, spd = o.speed ?? 44 * s, ratio = o.ratio ?? 0.24;
    const col = o.color || '#ffffff', a0 = o.alpha ?? 0.55, rings = o.rings ?? 3;
    for (const t0 of list) for (let k = 0; k < rings; k++) {
      const age = t - t0 - k * 0.3;
      if (age < 0 || age > life) continue;
      const q = age / life, r = 3 * s + age * spd * (1 - 0.12 * k);
      const a = a0 * (1 - q) * (1 - q) * (1 - k * 0.22);
      g.strokeStyle = rgba(col, a); g.lineWidth = (1.7 - q) * s;
      g.beginPath(); g.ellipse(x, y, r, r * ratio, 0, 0, TAU); g.stroke();
      g.strokeStyle = rgba('#000000', a * 0.3);
      g.beginPath(); g.ellipse(x, y + 1.4 * s, r * 0.96, r * ratio * 0.96, 0, 0, PI); g.stroke();
    }
  };

  // ---------- 植物 ----------
  // 画枝：一段段折转、渐细；粗枝左侧提一道受光；末梢记到 tips
  function limbs(g, r, x, y, ang, len, w, depth, o, tips) {
    let cx = x, cy = y, a = ang;
    const steps = Math.max(3, Math.round(len / 11));
    for (let i = 0; i < steps; i++) {
      const nx = cx + (Math.cos(a) * len) / steps, ny = cy + (Math.sin(a) * len) / steps;
      const ww = Math.max(0.7, w * (1 - (i / steps) * 0.55));
      g.strokeStyle = o.ink; g.lineWidth = ww;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
      if (ww > 2.2 && o.bark) { g.strokeStyle = o.bark; g.lineWidth = ww * 0.28; g.beginPath(); g.moveTo(cx - ww * 0.28, cy); g.lineTo(nx - ww * 0.28, ny); g.stroke(); }
      cx = nx; cy = ny;
      a += (r() - 0.5) * (o.kink ?? 0.5) + (o.lift ?? 0) * Math.cos(a) * -Math.sign(Math.sin(a) || 1) * 0.05;
      if (depth > 0 && r() < (o.fork ?? 0.3)) limbs(g, r, cx, cy, a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), len * (0.38 + r() * 0.3), ww * 0.62, depth - 1, o, tips);
      if (ww < 4.5 && r() < 0.45) tips.push([cx, cy, ww]);
    }
    tips.push([cx, cy, 1]);
  }
  let dryC = null;
  const dryCtx = () => { if (!dryC) { const c = document.createElement('canvas'); c.width = c.height = 2; dryC = c.getContext('2d'); } return dryC; };
  // 树的公共摆动：sway 为直接给定的转角；给了 t 就叠加微风（wind 0..1）
  function treeSway(o, k) {
    const t = o.t, wind = o.wind ?? 0.5;
    return (o.sway || 0) + (t == null ? 0 : wind * (Math.sin(t * 0.9 + k) * 0.012 + Math.sin(t * 2.3 + k * 2) * 0.004));
  }
  // 树下飘落：花瓣或枫叶，按 t 循环，无状态
  function fallers(g, o, box, kind, cols) {
    const t = o.t, n = o.fall ?? 14, seed = o.seed ?? 1, s = o.s ?? 1, wind = o.wind ?? 0.5;
    if (t == null || n <= 0) return;
    for (let i = 0; i < n; i++) {
      const P = 5 + h2(i, seed + 40) * 4, age = ((t + h2(i, seed + 41) * P) % P), q = age / P;
      const x = box[0] + h2(i, seed + 42) * (box[2] - box[0]) + age * (14 + 30 * wind) * s + Math.sin(t * 1.3 + i) * 12 * s;
      const y = box[1] + h2(i, seed + 43) * (box[3] - box[1]) * 0.4 + age * (28 + 14 * h2(i, seed + 44)) * s;
      const a = clamp(q * 8) * clamp((1 - q) * 4);
      const spin = t * (1.4 + h2(i, seed + 45) * 2) + i;
      g.save(); g.translate(x, y); g.rotate(spin * 0.7); g.scale(Math.cos(spin) * s, s);
      al(g, a * (o.alpha ?? 1));
      g.fillStyle = cols[i % cols.length];
      if (kind === 'maple') mapleLeaf(g, 0, 0, 6, 0); else { g.beginPath(); g.ellipse(0, 0, 4.2, 2.6, 0, 0, TAU); g.fill(); }
      g.restore();
    }
    al(g, 1);
  }
  function blossom(g, x, y, s, rot, petal, heart) {
    g.fillStyle = petal;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k * TAU) / 5;
      g.beginPath(); g.ellipse(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, s * 0.58, s * 0.42, a, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.arc(x - s * 0.15, y - s * 0.2, s * 0.35, 0, TAU); g.fill();
    g.fillStyle = heart; g.beginPath(); g.arc(x, y, s * 0.22, 0, TAU); g.fill();
    g.fillStyle = '#f7d67a';
    for (let k = 0; k < 5; k++) { const a = rot + 0.6 + (k * TAU) / 5; g.fillRect(x + Math.cos(a) * s * 0.32 - 0.4, y + Math.sin(a) * s * 0.32 - 0.4, 0.9, 0.9); }
  }
  function peachTex(seed, bloom, ink, pink) {
    return cached('peach', [seed, bloom, ink, pink], 600, 460, 1, (g) => {
      const r = rng(seed * 13 + 1), tips = [];
      const bx = 300, by = 452;
      g.lineCap = 'round'; g.lineJoin = 'round';
      const o = { ink, bark: 'rgba(170,140,120,0.35)', kink: 0.45, fork: 0.32 };
      const lean = (r() - 0.5) * 0.3;
      // 主干：两三股扭在一起
      const tx = bx + lean * 90, ty = by - 110;
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = ink; g.lineWidth = 15 - k * 3;
        g.beginPath(); g.moveTo(bx + (k - 1) * 6, by); g.bezierCurveTo(bx + (k - 1) * 10, by - 40, tx - (k - 1) * 8, ty + 40, tx, ty); g.stroke();
      }
      g.strokeStyle = 'rgba(170,140,120,0.3)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx - 8, by); g.bezierCurveTo(bx - 6, by - 40, tx - 12, ty + 40, tx - 5, ty); g.stroke();
      const nL = 4 + Math.floor(r() * 2), arms = [];
      for (let k = 0; k < nL; k++) arms.push([-PI / 2 + (k / (nL - 1) - 0.5) * 2.1 + (r() - 0.5) * 0.3, 95 + r() * 55, seed * 13 + 5 + k * 7]);
      // 先空跑一遍取枝梢画花雾，再画枝，最后花朵
      const dry = dryCtx(), tipsTmp = [];
      arms.forEach(([a, len, sd]) => limbs(dry, rng(sd), tx, ty, a, len, 8, 3, o, tipsTmp));
      // 花量按每个枝梢各自抽签（不是按生成顺序取前 N 个，免得花全挤在第一根枝上）
      tipsTmp.forEach(([x, y], i) => { const rs = r(); if (h2(i, seed + 61) < bloom) A.softBlob(g, x, y, 26 + rs * 22, 0.2, pink); });
      arms.forEach(([a, len, sd]) => limbs(g, rng(sd), tx, ty, a, len, 8, 3, o, tips));
      const cols = [pink, mix(pink, '#ffffff', 0.45), mix(pink, '#d04a6a', 0.35), mix(pink, '#ffffff', 0.7)];
      for (let i = 0; i < tips.length; i++) {
        if (h2(i, seed + 62) >= bloom) continue;
        const [x, y] = tips[i], m = 2 + Math.floor(r() * 4);
        for (let k = 0; k < m; k++) {
          const fx = x + (r() - 0.5) * 22, fy = y + (r() - 0.5) * 18, s = 3.2 + r() * 3;
          if (r() < 0.15) { g.fillStyle = mix(pink, '#b0304e', 0.5); g.beginPath(); g.ellipse(fx, fy, s * 0.4, s * 0.55, r(), 0, TAU); g.fill(); continue; }
          blossom(g, fx, fy, s, r() * TAU, cols[Math.floor(r() * cols.length)], '#b8405c');
        }
      }
    });
  }
  // 桃树：(x, y) 为树根；s 缩放；bloom 0..1 花量；sway 转角；t 给了就随风摆并落花（fall 片数）
  E.peachTree = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1;
    const img = peachTex(o.seed ?? 3, Math.round((o.bloom ?? 1) * 10) / 10, o.ink || '#2a1f1d', o.color || '#f2a9b8');
    g.save(); g.translate(x, y); g.rotate(treeSway(o, x * 0.01)); al(g, o.alpha ?? 1);
    g.drawImage(img, -300 * s, -452 * s, 600 * s, 460 * s);
    g.restore();
    fallers(g, o, [x - 200 * s, y - 330 * s, x + 200 * s, y - 60 * s], 'peach', ['#f4b3c0', '#f8d0d8', '#e88ba0']);
  };

  function mapleLeaf(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -PI / 2 + (k - 2) * 0.95, a2 = a + 0.475;
      const rr = k === 2 ? 1 : k === 1 || k === 3 ? 0.88 : 0.62;
      g.lineTo(Math.cos(a - 0.12) * s * rr * 0.55, Math.sin(a - 0.12) * s * rr * 0.55);
      g.lineTo(Math.cos(a) * s * rr, Math.sin(a) * s * rr);
      g.lineTo(Math.cos(a + 0.12) * s * rr * 0.55, Math.sin(a + 0.12) * s * rr * 0.55);
      if (k < 4) g.lineTo(Math.cos(a2) * s * 0.3, Math.sin(a2) * s * 0.3);
    }
    g.lineTo(0, s * 0.2);
    g.closePath(); g.fill();
    g.restore();
  }
  function mapleTex(seed, ink, col) {
    return cached('maple', [seed, ink, col], 520, 440, 1, (g) => {
      const r = rng(seed * 17 + 5), tips = [];
      const bx = 260, by = 432, tx = bx + (r() - 0.5) * 30, ty = by - 140;
      g.lineCap = 'round';
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(bx - 16, by); g.quadraticCurveTo(bx - 8, by - 70, tx - 6, ty); g.lineTo(tx + 6, ty); g.quadraticCurveTo(bx + 8, by - 70, bx + 16, by); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,150,120,0.25)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(bx - 10, by); g.quadraticCurveTo(bx - 6, by - 70, tx - 3, ty); g.stroke();
      const o = { ink, bark: 'rgba(200,150,120,0.25)', kink: 0.4, fork: 0.35 };
      const angs = [-PI / 2 - 1.0, -PI / 2 - 0.45, -PI / 2 + 0.05, -PI / 2 + 0.55, -PI / 2 + 1.05];
      const reds = [col, mix(col, '#e8892c', 0.5), mix(col, '#f2b440', 0.35), mix(col, '#8a1a14', 0.4), mix(col, '#ff9a5a', 0.3)];
      // 背光暗叶团
      const arms = angs.map((a, k) => [a, 105 + r() * 55, seed * 17 + 9 + k * 5]);
      const tmp = [], dry = dryCtx();
      arms.forEach(([a, len, sd]) => limbs(dry, rng(sd), tx, ty, a, len, 9, 3, o, tmp));
      for (const [x, y] of tmp) A.softBlob(g, x, y, 22 + r() * 12, 0.12, mix(col, '#4a0d0a', 0.4));
      for (const [x, y] of tmp) for (let k = 0; k < 6; k++) { g.fillStyle = mix(col, '#5a120c', 0.35 + r() * 0.25); mapleLeaf(g, x + (r() - 0.5) * 36, y + (r() - 0.5) * 28, 5.5 + r() * 3, r() * TAU); }
      arms.forEach(([a, len, sd]) => limbs(g, rng(sd), tx, ty, a, len, 9, 3, o, tips));
      for (const [x, y] of tips) {
        const m = 4 + Math.floor(r() * 5);
        for (let k = 0; k < m; k++) {
          const lx = x + (r() - 0.5) * 30, ly = y + (r() - 0.5) * 24, up = clamp((ty + 40 - ly) / 200);
          g.fillStyle = reds[Math.floor(r() * reds.length)];
          mapleLeaf(g, lx, ly, 5 + r() * 4, (r() - 0.5) * 1.2);
          if (r() < 0.3 + up * 0.4) { g.fillStyle = 'rgba(255,220,150,0.35)'; mapleLeaf(g, lx - 1, ly - 1, 3, (r() - 0.5)); }
        }
      }
    });
  }
  // 枫树：参数同桃树；color 叶色
  E.mapleTree = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1;
    const img = mapleTex(o.seed ?? 5, o.ink || '#2a1a16', o.color || '#c8361f');
    g.save(); g.translate(x, y); g.rotate(treeSway(o, x * 0.013)); al(g, o.alpha ?? 1);
    g.drawImage(img, -260 * s, -432 * s, 520 * s, 440 * s);
    g.restore();
    fallers(g, o, [x - 220 * s, y - 380 * s, x + 220 * s, y - 80 * s], 'maple', ['#c8361f', '#de6a26', '#e8a030', '#a62416']);
  };

  // 松：每棵按种子变出不同的树形——斜度、高矮、树干弯法、枝数，冠形有平顶层叠（黄山松）与高耸两种
  function pineTex(seed, col, ink) {
    return cached('pine', [seed, col, ink], 420, 460, 1, (g) => {
      const r = rng(seed * 23 + 3), bx = 210, by = 452, flat = r() < 0.5, hh = (flat ? 240 : 300) + r() * 90;
      const lean = (r() - 0.5) * 0.7, bend = 14 + r() * 30, ph0 = r() * TAU;
      g.lineCap = 'round'; g.lineJoin = 'round';
      // 树干：带弯的一根，下粗上细，鳞状树皮；平顶松干更斜更扭
      const sx = (u) => bx + lean * u * hh * 0.45 + Math.sin(u * 2.4 + ph0) * bend * u;
      const pts = [];
      for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([sx(u), by - u * hh, lerp(15, 3.5, Math.pow(u, 0.75))]); }
      g.beginPath();
      pts.forEach(([x, y, w], i) => (i ? g.lineTo(x - w, y) : g.moveTo(x - w * 1.3, y)));
      for (let i = 20; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2] * (i ? 1 : 1.3), pts[i][1]);
      g.closePath(); g.fillStyle = ink; g.fill();
      for (let k = 0; k < 60; k++) {
        const u = r() * 0.9, i = Math.floor(u * 20), [x, y, w] = pts[i];
        g.strokeStyle = r() < 0.5 ? 'rgba(160,140,110,0.35)' : 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x + (r() - 0.5) * w * 1.2, y - r() * 12, w * 0.35, 2.2, 0.2, 0, PI); g.stroke();
      }
      g.strokeStyle = 'rgba(190,170,140,0.3)'; g.lineWidth = 2.5;
      g.beginPath(); pts.forEach(([x, y, w], i) => (i ? g.lineTo(x - w * 0.6, y) : g.moveTo(x - w * 0.6, y))); g.stroke();
      // 枝与针叶团：平顶松枝条近乎水平、集中在上部；高松枝条分布更长
      const pads = [];
      const nb = (flat ? 4 : 5) + Math.floor(r() * 4), u0 = flat ? 0.55 : 0.32;
      for (let k = 0; k < nb; k++) {
        const u = u0 + (k / nb) * (1 - u0) * 0.95, i = Math.round(u * 20), [x, y, w] = pts[Math.min(20, i)];
        const side = (k + (seed % 2)) % 2 ? 1 : -1, len = (70 + r() * 100) * (flat ? 1.25 - u * 0.5 : 1.1 - u * 0.6) * (side * lean > 0 ? 1.25 : 0.85);
        let cx = x, cy = y, a = side > 0 ? -0.1 - r() * (flat ? 0.08 : 0.35) : PI + 0.1 + r() * (flat ? 0.08 : 0.35);
        g.strokeStyle = ink;
        for (let s = 0; s < 6; s++) {
          const nx = cx + Math.cos(a) * len / 6, ny = cy + Math.sin(a) * len / 6 + (s < 3 ? 2 : -2.5);
          g.lineWidth = lerp(w * 0.55, 1.5, s / 6); g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
          cx = nx; cy = ny; a += (r() - 0.5) * 0.3;
          if (s === 3 || s === 5) pads.push([cx, cy - 4, (s === 5 ? 1 : 0.7) * (1.15 - u * 0.4) * (0.75 + r() * 0.5)]);
        }
      }
      pads.push([pts[20][0], pts[20][1] - 6, flat ? 1.2 : 0.85]);
      const dark = mix(col, '#000000', 0.4), lite = mix(col, '#d6e2b0', 0.5);
      // 针叶团：底下一层淡墨，上面一簇簇放射的松针（车轮松针），顶缘提亮
      for (const [x, y, s] of pads) {
        g.fillStyle = rgba(dark, 0.6); g.beginPath();
        for (let k = 0; k < 6; k++) { const px = x + (k / 5 - 0.5) * 80 * s + (r() - 0.5) * 8 * s, rx = (12 + r() * 12) * s, ry = (6 + r() * 6) * s, py = y + 3 * s - Math.sin((k / 5) * PI) * 5 * s; g.moveTo(px + rx, py); g.ellipse(px, py, rx, ry, 0, 0, TAU); }
        g.fill();
      }
      for (const [x, y, s] of pads) {
        const nt = 5 + Math.floor(r() * 3);
        for (let f = 0; f < nt; f++) {
          const fx = x + (f / (nt - 1) - 0.5) * 78 * s + (r() - 0.5) * 8 * s, fy = y - Math.sin((f / (nt - 1)) * PI) * 7 * s + (r() - 0.5) * 4 * s;
          const L = (13 + r() * 7) * s;
          g.fillStyle = rgba(dark, 0.9); g.beginPath(); g.ellipse(fx, fy + 2 * s, L * 0.95, L * 0.42, 0, 0, TAU); g.fill();
          g.lineWidth = 0.9;
          for (let k = 0; k < 15; k++) {
            const a = PI * 1.02 + (k / 14) * PI * 0.96;
            g.strokeStyle = k % 3 === 0 ? rgba(lite, 0.55) : rgba(col, 0.95);
            g.beginPath(); g.moveTo(fx, fy + 2 * s); g.lineTo(fx + Math.cos(a) * L, fy + 2 * s + Math.sin(a) * L * 0.62); g.stroke();
          }
        }
      }
    });
  }
  // 松：x 或 xs（多棵）、y 树根；s 缩放，sizes 每棵的倍数；n 棵、gap 间距；t、wind 微摆；每棵树形各不相同
  E.pines = function (g, o = {}) {
    const n = o.n ?? 1, s0 = o.s ?? 1, y = o.y ?? 620;
    const xs = o.xs || Array.from({ length: n }, (_, i) => (o.x ?? 640) + (i - (n - 1) / 2) * (o.gap ?? 150) * s0);
    xs.forEach((x, i) => {
      const sd = (o.seed ?? 2) + i * 7;
      const s = s0 * (0.75 + 0.4 * h2(i, sd)) * (o.sizes ? o.sizes[i] : 1);
      const img = pineTex(sd, o.color || '#2f4a3a', o.ink || '#231d1a');
      g.save(); g.translate(x, y + (o.ys ? o.ys[i] : 0)); g.rotate(treeSway(o, i * 1.7)); if (o.flip ?? (h2(i, sd + 1) < 0.5)) g.scale(-1, 1);
      al(g, o.alpha ?? 1);
      g.drawImage(img, -210 * s, -452 * s, 420 * s, 460 * s);
      g.restore();
    });
  };

  function leaf(g, x, y, L, w, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.35, -w, L, 0); g.quadraticCurveTo(L * 0.35, w, 0, 0); g.fill();
    g.restore();
  }
  // 竹林：x0..x1 间 n 竿，y 根部，h 高；color 竹色；light 受光色；wind 0..1；leaf 叶量，leafS 叶大小；
  // 竿分浓淡（远竿淡而细、近竿浓而粗），叶成“个”“介”字簇，大小参差
  E.bamboo = function (g, o = {}) {
    const t = o.t || 0, x0 = o.x0 ?? 0, x1 = o.x1 ?? 400, y = o.y ?? H + 10, hgt = o.h ?? 640, col = o.color || '#2c4a36';
    const n = o.n ?? 8, seed = o.seed ?? 4, wind = o.wind ?? 0.4, lit = o.light || mix(col, '#e8f0c8', 0.4), lf = o.leaf ?? 1, haze = o.haze || mix(col, '#c8d0c0', 0.55);
    g.lineCap = 'round';
    // 先画淡的（远），再画浓的（近）
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => h2(a, seed + 9) - h2(b, seed + 9));
    for (const i of order) {
      const depth = h2(i, seed + 9), c = mix(haze, col, 0.35 + 0.65 * depth), cl = mix(haze, lit, 0.4 + 0.6 * depth);
      const bx = lerp(x0, x1, (i + h2(i, seed)) / n), hh = hgt * (0.72 + 0.4 * h2(i, seed + 1)), w0 = (o.w ?? 9) * (0.55 + 0.75 * depth) * (0.8 + 0.4 * h2(i, seed + 2));
      const lean = (h2(i, seed + 3) - 0.5) * 0.18, ph = i * 1.3 + seed;
      const sw = wind * (Math.sin(t * 0.8 + ph) * 0.7 + Math.sin(t * 1.9 + ph * 2) * 0.3) * 0.07;
      const pt = (u) => [bx + (lean * u + sw * u * u) * hh, y - hh * u];
      const nodes = 10 + Math.floor(h2(i, seed + 4) * 4);
      for (let k = 0; k < nodes; k++) {
        const u0 = k / nodes, u1 = (k + 1) / nodes - 0.008, [ax, ay] = pt(u0), [bx2, by2] = pt(u1), w = w0 * (1 - u0 * 0.55);
        g.strokeStyle = c; g.lineWidth = w;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
        g.strokeStyle = rgba(cl, 0.45); g.lineWidth = w * 0.25;
        g.beginPath(); g.moveTo(ax - w * 0.22, ay - 2); g.lineTo(bx2 - w * 0.22, by2 + 2); g.stroke();
        g.strokeStyle = rgba(shade(c, -0.5), 0.9); g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(bx2 - w * 0.6, by2 + 1); g.lineTo(bx2 + w * 0.6, by2 + 1); g.stroke();
        // 上半部节上出枝，一簇三至七片叶，叶长短不一
        if (u0 > 0.38 && h2(i * 31 + k, seed) < 0.7 * lf) {
          const side = (k + i) % 2 ? 1 : -1, tl = (22 + h2(k, i + seed) * 40) * (o.leafS ?? 1);
          const ta = side > 0 ? -0.5 : PI + 0.5, tx = bx2 + Math.cos(ta) * tl, ty = by2 + Math.sin(ta) * tl * 0.6;
          g.strokeStyle = c; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(bx2, by2); g.lineTo(tx, ty); g.stroke();
          const nl = 3 + Math.floor(h2(k, i + seed + 1) * 5), big = 0.7 + 0.6 * h2(k, i + seed + 2);
          for (let j = 0; j < nl; j++) {
            const fl = Math.sin(t * 2.6 + j + k + i) * 0.12 * wind;
            const da = 0.3 + j * (1.2 / nl) + h2(j, k) * 0.25, L = (20 + h2(j, k + i) * 26) * (o.leafS ?? 1) * big * (0.75 + 0.5 * depth);
            g.fillStyle = j % 3 ? c : mix(c, j % 2 ? lit : '#000000', 0.18);
            leaf(g, tx, ty, L, L * 0.13, side > 0 ? da + fl : PI - da + fl);
          }
        }
      }
    }
  };

  // 垂柳：(x, y) 树根；s 缩放；t、wind 柳丝随风；color 叶色，ink 干色；n 柳丝数（从枝梢垂下）
  const willowO = (ink) => ({ ink, bark: 'rgba(170,150,120,0.3)', kink: 0.35, fork: 0.3 });
  function willowLimbs(g, seed, ink, tips) {
    const r = rng(seed * 41 + 9), bx = 180, by = 412;
    for (let k = 0; k < 6; k++) limbs(g, rng(seed * 41 + k), bx + (r() - 0.5) * 8, by - 190, -PI / 2 + (k / 5 - 0.5) * 2.4, 80 + r() * 60, 7, 2, willowO(ink), tips);
  }
  const willowTipStore = new Map();
  function willowTips(seed) {
    let t = willowTipStore.get(seed);
    if (!t) { t = []; willowLimbs(dryCtx(), seed, '#000', t); t = t.map(([x, y]) => [x - 180, y - 412]); willowTipStore.set(seed, t); }
    return t;
  }
  function willowTex(seed, ink) {
    return cached('willowTrunk', [seed, ink], 360, 420, 1, (g) => {
      const bx = 180, by = 412;
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.fillStyle = ink;
      g.beginPath(); g.moveTo(bx - 18, by); g.bezierCurveTo(bx - 10, by - 90, bx - 30, by - 150, bx - 8, by - 200); g.lineTo(bx + 8, by - 200); g.bezierCurveTo(bx - 8, by - 150, bx + 12, by - 90, bx + 18, by); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(170,150,120,0.3)'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 12, by); g.bezierCurveTo(bx - 6, by - 90, bx - 24, by - 150, bx - 5, by - 198); g.stroke();
      willowLimbs(g, seed, ink, []);
    });
  }
  E.willow = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, wind = o.wind ?? 0.5, seed = o.seed ?? 3, col = o.color || '#7d9a4a';
    fade(g, o.alpha);
    const img = willowTex(seed, o.ink || '#2a2420'), tips = willowTips(seed), n = o.n ?? Math.min(64, tips.length * 2);
    g.save(); g.translate(x, y); g.rotate(treeSway(o, x * 0.01));
    g.drawImage(img, -180 * s, -412 * s, 360 * s, 420 * s);
    // 柳丝：每根从一处枝梢垂下，越往下摆得越大；丝上一串细叶，深浅两色
    g.lineCap = 'round';
    const leafC = mix(col, '#d8e8a0', 0.3), dk = shade(col, -0.3);
    for (let i = 0; i < n; i++) {
      const [tx0, ty0] = tips[i % tips.length], sx = (tx0 + (h2(i, seed + 4) - 0.5) * 40) * s, sy = (ty0 + h2(i, seed + 5) * 14) * s, len = (110 + 170 * h2(i, seed + 2)) * s;
      const ph = t * (1.1 + 0.4 * h2(i, seed + 3)) + i * 0.7, sw = (Math.sin(ph) * 0.6 + 0.6) * wind * 40 * s + Math.sin(ph * 2.3) * 4 * s;
      const ex = sx + sw, ey = sy + len, cx1 = sx + sw * 0.15 + (sx > 0 ? 8 : -8) * s, cy1 = sy + len * 0.4;
      g.strokeStyle = rgba(i % 3 ? col : dk, 0.8); g.lineWidth = 0.9 * s;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx1, cy1, ex, ey); g.stroke();
      g.strokeStyle = rgba(i % 2 ? leafC : col, 0.9); g.lineWidth = 2.2 * s;
      g.beginPath();
      for (let k = 1; k < 12; k++) {
        const u = k / 12, px = (1 - u) * (1 - u) * sx + 2 * u * (1 - u) * cx1 + u * u * ex, py = (1 - u) * (1 - u) * sy + 2 * u * (1 - u) * cy1 + u * u * ey;
        const dd = (k % 2 ? 1 : -1) * 3.4 * s;
        g.moveTo(px, py); g.lineTo(px + dd + sw * 0.03, py + 4.8 * s);
      }
      g.stroke();
    }
    g.restore();
  };

  function lotusLeafTex(seed, col) {
    return cached('lotusLeaf', [seed, col], 200, 70, 1, (g) => {
      const r = rng(seed + 70), cx = 100, cy = 35, rx = 92, ry = 28;
      const notch = PI / 2 + (r() - 0.5) * 0.8;
      g.beginPath();
      for (let i = 0; i <= 60; i++) {
        const a = notch + 0.18 + (i / 60) * (TAU - 0.36), wob = 1 + (noise1(a * 3, seed) - 0.5) * 0.12;
        const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob - (Math.sin(a) < 0 ? 2 : 0);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.lineTo(cx + Math.cos(notch) * 6, cy + Math.sin(notch) * 3); g.closePath();
      g.fillStyle = rad(g, cx - 10, cy - 6, 4, cx, cy, rx, [[0, mix(col, '#d8e6a0', 0.45)], [0.6, col], [1, shade(col, -0.35)]]);
      g.fill();
      g.save(); g.clip();
      g.strokeStyle = rgba(mix(col, '#e8f0c0', 0.5), 0.35); g.lineWidth = 0.9;
      for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); g.stroke(); }
      g.strokeStyle = rgba(mix(col, '#eef4cc', 0.6), 0.5); g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy - 1.5, rx - 2, ry - 1.5, 0, PI * 1.05, PI * 1.95); g.stroke();
      g.restore();
      g.fillStyle = shade(col, 0.3); g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill();
    });
  }
  // 荷：(x, y) 为花茎入水处；s 缩放；open 0 花苞 → 1 盛开；leaves 荷叶数；color 花瓣尖色；glow 夜里的花光；t 微摆
  E.lotus = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, open = clamp(o.open ?? 1), t = o.t || 0, seed = o.seed ?? 1;
    const col = o.color || '#e86a8e', leafC = o.leafColor || '#3f6b48', nl = o.leaves ?? 2;
    for (let k = 0; k < nl; k++) {
      const lx = x + (h2(k, seed) - 0.5) * 180 * s, ly = y + (h2(k, seed + 1) - 0.2) * 26 * s, ls = s * (0.4 + 0.45 * h2(k, seed + 2));
      const img = lotusLeafTex((seed + k) % 4, mix(leafC, k % 2 ? '#6f8a4a' : '#2f5a44', 0.25));
      g.drawImage(img, lx - 100 * ls, ly - 35 * ls, 200 * ls, 70 * ls);
    }
    if (o.flower === false) return;
    const sw = (o.sway || 0) + Math.sin(t * 0.9 + seed) * 4 * s, top = y - (o.stem ?? 62) * s;
    g.strokeStyle = shade(leafC, -0.2); g.lineWidth = 2.6 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sw * 0.2, (y + top) / 2, x + sw, top); g.stroke();
    const fx = x + sw, fy = top;
    if (o.glow) K.lighter(g, () => glow(g, fx, fy - 18 * s, 70 * s, o.glowColor || '#ffc8d8', o.glow * 0.5));
    // 花头按开放程度分档缓存（每片花瓣的渐变不必逐帧重建）
    const sq = Math.max(0.5, Math.round(s * 4) / 4), oq = Math.round(open * 20) / 20;
    const head = cached('lotusHead', [col, oq], 120, 90, sq, (c) => {
      const hx = 60, hy = 80, L = 40, w = 15;
      const petal = (a, Lp, wp, dark) => {
        c.save(); c.translate(hx, hy); c.rotate(a);
        c.fillStyle = K.lin(c, 0, 0, 0, -Lp, [[0, mix('#fff6f2', col, dark * 0.3)], [0.55, mix('#ffe6ec', col, 0.25 + dark * 0.3)], [1, mix(col, '#a8304e', dark)]]);
        c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(-wp, -Lp * 0.25, -wp * 0.7, -Lp * 0.8, 0, -Lp); c.bezierCurveTo(wp * 0.7, -Lp * 0.8, wp, -Lp * 0.25, 0, 2); c.fill();
        c.strokeStyle = rgba(col, 0.25); c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -Lp * 0.85); c.stroke();
        c.restore();
      };
      // 后排 → 莲蓬 → 前排
      for (let k = 0; k < 5; k++) petal((k - 2) * lerp(0.12, 0.42, oq), L * 0.92, w * 0.9, 0.35);
      if (oq > 0.45) {
        c.fillStyle = K.lin(c, 0, hy - 14, 0, hy - 4, [[0, '#e8d870'], [1, '#9cab4c']]);
        c.beginPath(); c.ellipse(hx, hy - 10, 9 * oq, 4, 0, 0, TAU); c.fill();
        c.fillStyle = '#6f7a2c';
        for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(hx + (k - 2) * 3.2 * oq, hy - 10.5, 0.9, 0, TAU); c.fill(); }
      }
      for (const k of [-3, 3]) petal(k * lerp(0.1, 0.42, oq), L, w, 0.2);
      for (let k = 0; k < 4; k++) petal((k - 1.5) * lerp(0.08, 0.34, oq), L * lerp(0.95, 0.72, oq), w * 1.05, 0.05);
    });
    g.drawImage(head, fx - 60 * s, fy - 80 * s, 120 * s, 90 * s);
  };

  // 芦苇：x0..x1 间 n 株，y 根部，h 高；plume 芦花色；light 逆光描边；wind 0..1
  E.reeds = function (g, o = {}) {
    const t = o.t || 0, x0 = o.x0 ?? 0, x1 = o.x1 ?? 500, y = o.y ?? H + 6, hgt = o.h ?? 220, n = o.n ?? 30, seed = o.seed ?? 6;
    const col = o.color || '#3b3426', plume = o.plume || '#e8dcc0', wind = o.wind ?? 0.5, light = o.light;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = lerp(x0, x1, h2(i, seed)), hh = hgt * (0.6 + 0.6 * h2(i, seed + 1));
      const sw = (Math.sin(t * 1.3 + bx * 0.02) * 0.6 + Math.sin(t * 0.5 + i) * 0.4 + 0.5) * wind * hh * 0.22;
      const tx = bx + sw, ty = y - hh + Math.abs(sw) * 0.3;
      g.strokeStyle = col; g.lineWidth = 1.2 + h2(i, seed + 2) * 1.2;
      g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + sw * 0.2, y - hh * 0.6, tx, ty); g.stroke();
      // 两片细长叶，从秆中部斜出、尖端下垂
      for (const sd of [-1, 1]) {
        const ly = y - hh * (0.25 + 0.25 * h2(i, seed + sd + 5)), lx = bx + sw * 0.1, ll = 40 + h2(i, seed + sd + 7) * 40;
        g.fillStyle = col;
        g.beginPath(); g.moveTo(lx, ly); g.quadraticCurveTo(lx + sd * ll * 0.5 + sw * 0.3, ly - ll * 0.9, lx + sd * ll + sw * 0.5, ly - ll * 0.5 + Math.sin(t * 2 + i) * 3);
        g.quadraticCurveTo(lx + sd * ll * 0.45 + sw * 0.3, ly - ll * 0.75, lx + sd * 2, ly - 6); g.closePath(); g.fill();
      }
      // 芦花：下垂的穗轴上撒细丝，半透明
      const dx = (6 + wind * 14) * (sw >= 0 ? 1 : -1) * 0.5 + sw * 0.15, pl = 26 + h2(i, seed + 8) * 18;
      g.strokeStyle = rgba(plume, 0.42); g.lineWidth = 0.8;
      g.beginPath();
      for (let k = 0; k < 14; k++) {
        const u = k / 13, px = tx + dx * u * 1.6, py = ty + u * pl * 0.55, len = 9 * (1 - u * 0.4);
        const ang = PI / 2 - (dx > 0 ? 0.9 : -0.9) + (h2(k, i + seed) - 0.5) * 1.2;
        g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * len, py + Math.sin(ang) * len);
      }
      g.stroke();
      g.fillStyle = rgba(plume, 0.22);
      g.beginPath(); g.ellipse(tx + dx * 0.9, ty + pl * 0.3, 5, pl * 0.32, -dx * 0.03, 0, TAU); g.fill();
      if (light) K.lighter(g, () => glow(g, tx + 8, ty + 10, 16, light, 0.3));
    }
  };

  function puffTex(col) {
    return cached('puff', [col], 64, 64, 1.5, (g) => {
      const r = rng(31);
      A.softBlob(g, 32, 32, 22, 0.35, col);
      g.lineCap = 'round';
      for (let k = 0; k < 70; k++) {
        const a = r() * TAU, rr = 15 + r() * 9;
        g.strokeStyle = rgba(mix(col, '#ffffff', 0.25), 0.5 + r() * 0.4); g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); g.stroke();
        g.fillStyle = rgba(mix(col, '#ffffff', 0.4), 0.85);
        g.beginPath(); g.arc(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr, 1.1, 0, TAU); g.fill();
      }
      g.fillStyle = shade(col, -0.3); g.beginPath(); g.arc(32, 32, 2.4, 0, TAU); g.fill();
    });
  }
  // 蒲公英：x0..x1 间 n 株，y 地面；color 绒球色（仙都的红蒲公英默认红）；release 0..1 绒籽飞散量；wind 0..1
  E.dandelions = function (g, o = {}) {
    const t = o.t || 0, x0 = o.x0 ?? 0, x1 = o.x1 ?? W, y = o.y ?? H, n = o.n ?? 26, seed = o.seed ?? 8, s0 = o.s ?? 1;
    const col = o.color || '#e0453a', stem = o.stem || '#3c3a28', wind = o.wind ?? 0.5, rel = o.release ?? 0.4;
    const img = puffTex(col), tops = [];
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const v = h2(i, seed + 1), s = s0 * (0.55 + 0.75 * v), bx = lerp(x0, x1, h2(i, seed)), by = y + (1 - v) * -30 * s0;
      const hh = (70 + 70 * h2(i, seed + 2)) * s, sw = (Math.sin(t * 1.4 + bx * 0.03) * 0.6 + 0.4) * wind * hh * 0.15;
      const tx = bx + sw, ty = by - hh;
      g.strokeStyle = stem; g.lineWidth = 1.4 * s;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sw * 0.1, by - hh * 0.5, tx, ty); g.stroke();
      const r = 18 * s * (1 - 0.35 * rel * h2(i, seed + 3));
      K.lighter(g, () => glow(g, tx, ty, r * 2.2, col, 0.25));
      g.drawImage(img, tx - r * 1.45, ty - r * 1.45, r * 2.9, r * 2.9);
      tops.push([tx, ty, s]);
    }
    // 飘走的绒籽：每株轮流放出，轨迹由时间算出
    const ns = Math.round(70 * rel);
    for (let k = 0; k < ns && tops.length; k++) {
      const [px, py, s] = tops[k % tops.length], P = 5 + h2(k, seed + 9) * 3, age = (t + h2(k, seed + 10) * P) % P, q = age / P;
      const x = px + age * (30 + 60 * wind) * (0.7 + h2(k, seed + 11) * 0.6) + Math.sin(t * 2 + k) * 8;
      const yy = py - age * (14 + 16 * h2(k, seed + 12)) + Math.sin(t * 1.3 + k * 2) * 6;
      const a = clamp(q * 6) * clamp((1 - q) * 3);
      g.strokeStyle = rgba(mix(col, '#ffffff', 0.3), a * 0.8); g.lineWidth = 0.7 * s;
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x - 3 * s, yy + 7 * s);
      for (let j = -2; j <= 2; j++) { g.moveTo(x, yy); g.lineTo(x + j * 2.4 * s, yy - 4 * s); }
      g.stroke();
    }
  };

  // ---------- 建筑通用 ----------
  // 曲面屋顶（正立面）：cx 中心，y 檐口，w 宽，h 高；curl 檐角起翘，ridge 正脊宽占比，over 出檐
  function roof(g, cx, y, w, h, o = {}) {
    const hw = w / 2, ov = o.over ?? w * 0.05, lift = h * (o.curl ?? 0.32), rk = o.ridge ?? 0.62, col = o.color || '#3a3d44';
    const Lx = cx - hw - ov, Rx = cx + hw + ov, top = y - h;
    const path = () => {
      g.beginPath();
      g.moveTo(Lx, y - lift);
      g.quadraticCurveTo(cx - hw * 0.72, y + h * 0.03, cx - hw * 0.45, y + h * 0.04);
      g.lineTo(cx + hw * 0.45, y + h * 0.04);
      g.quadraticCurveTo(cx + hw * 0.72, y + h * 0.03, Rx, y - lift);
      g.quadraticCurveTo(cx + hw * 0.78, y - h * 0.32, cx + hw * rk, top);
      g.lineTo(cx - hw * rk, top);
      g.quadraticCurveTo(cx - hw * 0.78, y - h * 0.32, Lx, y - lift);
      g.closePath();
    };
    path();
    g.fillStyle = K.lin(g, 0, top, 0, y, [[0, shade(col, o.topLight ?? 0.18)], [0.7, col], [1, shade(col, -0.25)]]);
    g.fill();
    if (o.tiles !== false) {
      g.save(); path(); g.clip();
      const n = Math.max(6, Math.round(w / (o.tileW ?? 9)));
      for (let i = 0; i <= n; i++) {
        const u = i / n, xb = Lx + u * (Rx - Lx), xt = cx + (xb - cx) * rk * 0.98;
        g.strokeStyle = rgba(shade(col, -0.45), 0.55); g.lineWidth = Math.max(0.6, w / n * 0.28);
        g.beginPath(); g.moveTo(xt, top); g.quadraticCurveTo(xt + (xb - xt) * 0.3, y - h * 0.3, xb, y + 2); g.stroke();
        g.strokeStyle = rgba(shade(col, 0.5), 0.18); g.lineWidth = Math.max(0.5, w / n * 0.16);
        g.beginPath(); g.moveTo(xt + 1.2, top); g.quadraticCurveTo(xt + 1.2 + (xb - xt) * 0.3, y - h * 0.3, xb + 1.2, y + 2); g.stroke();
      }
      g.restore();
    }
    // 檐口瓦当一线
    g.strokeStyle = shade(col, -0.5); g.lineWidth = Math.max(1.2, h * 0.07);
    g.beginPath(); g.moveTo(Lx, y - lift); g.quadraticCurveTo(cx - hw * 0.72, y + h * 0.03, cx - hw * 0.45, y + h * 0.04); g.lineTo(cx + hw * 0.45, y + h * 0.04); g.quadraticCurveTo(cx + hw * 0.72, y + h * 0.03, Rx, y - lift); g.stroke();
    if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = Math.max(0.8, h * 0.025); g.beginPath(); g.moveTo(Lx + 2, y - lift + 2); g.quadraticCurveTo(cx - hw * 0.72, y + h * 0.06, cx, y + h * 0.07); g.quadraticCurveTo(cx + hw * 0.72, y + h * 0.06, Rx - 2, y - lift + 2); g.stroke(); }
    // 正脊与鸱吻
    const rc = o.ridgeColor || shade(col, -0.35), rh = Math.max(2, h * 0.12);
    g.fillStyle = rc;
    g.fillRect(cx - hw * rk, top - rh, hw * rk * 2, rh + 1);
    for (const sd of [-1, 1]) {
      const ex = cx + sd * hw * rk;
      g.beginPath(); g.moveTo(ex, top); g.quadraticCurveTo(ex + sd * rh * 0.4, top - rh * 2.4, ex - sd * rh * 0.6, top - rh * 2.2); g.lineTo(ex - sd * rh * 0.9, top - rh); g.closePath(); g.fill();
    }
    if (o.pearl) { g.fillStyle = o.pearl; g.beginPath(); g.arc(cx, top - rh * 1.8, rh * 0.9, 0, TAU); g.fill(); }
    if (o.light) { g.strokeStyle = rgba(o.light, o.lightA ?? 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - hw * rk, top - rh); g.lineTo(cx + hw * rk, top - rh); g.stroke(); }
  }
  // 栏杆：x0..x1，y 为地面，h 高
  function railing(g, x0, x1, y, h, col, o = {}) {
    const n = Math.max(2, Math.round((x1 - x0) / (o.gap ?? 34)));
    g.fillStyle = col; g.strokeStyle = col;
    g.fillRect(x0, y - h, x1 - x0, Math.max(1.5, h * 0.12));
    g.fillRect(x0, y - h * 0.35, x1 - x0, Math.max(1, h * 0.08));
    for (let i = 0; i <= n; i++) {
      const x = lerp(x0, x1, i / n);
      g.fillRect(x - h * 0.06, y - h * 1.08, h * 0.12, h * 1.08);
      if (o.caps) { g.beginPath(); g.arc(x, y - h * 1.1, h * 0.09, 0, TAU); g.fill(); }
      if (i < n && o.pattern !== false) {
        const xm = lerp(x0, x1, (i + 0.5) / n), ww = (x1 - x0) / n;
        g.lineWidth = Math.max(0.6, h * 0.04);
        g.beginPath(); g.moveTo(xm - ww * 0.3, y - h * 0.4); g.lineTo(xm, y - h * 0.85); g.lineTo(xm + ww * 0.3, y - h * 0.4); g.stroke();
      }
    }
  }
  // 格窗：w×h，frame 框色，paper 纸色；kind 'grid' 方格、'ice' 冰裂、'round' 圆窗
  function lattice(g, x, y, w, h, frame, paper, kind = 'grid') {
    g.fillStyle = paper; g.fillRect(x, y, w, h);
    g.strokeStyle = frame; g.lineWidth = Math.max(0.8, Math.min(w, h) * 0.035);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (kind === 'ice') {
      const r = rng(Math.round(x * 7 + y));
      for (let k = 0; k < 14; k++) { const px = x + r() * w, py = y + r() * h; g.beginPath(); g.moveTo(px, py); g.lineTo(px + (r() - 0.5) * w * 0.7, py + (r() - 0.5) * h * 0.7); g.stroke(); }
    } else {
      const nx = Math.max(2, Math.round(w / 7)), ny = Math.max(2, Math.round(h / 7));
      for (let i = 1; i < nx; i++) { g.beginPath(); g.moveTo(x + (i * w) / nx, y); g.lineTo(x + (i * w) / nx, y + h); g.stroke(); }
      for (let j = 1; j < ny; j++) { g.beginPath(); g.moveTo(x, y + (j * h) / ny); g.lineTo(x + w, y + (j * h) / ny); g.stroke(); }
    }
    g.restore();
    g.lineWidth = Math.max(1.2, Math.min(w, h) * 0.07); g.strokeRect(x, y, w, h);
  }
  // 书法字：font 未就绪时用后备字体
  function glyphs(g, text, x, y, size, col, o = {}) {
    g.fillStyle = col; g.font = `${size}px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ch = Array.from(text);
    if (o.vertical) ch.forEach((c, i) => g.fillText(c, x, y + (i - (ch.length - 1) / 2) * size * 1.02));
    else g.fillText(text, x, y);
  }
  // 灯光叠加：在若干窗洞位置画暖光，按 t 微闪（颜色与光斑贴图只取一次，逐窗只改透明度）
  function windowGlow(g, wins, lit, t, col, seed, halo = true) {
    if (lit <= 0 || !wins.length) return;
    const p = g.globalAlpha, op = g.globalCompositeOperation, spr = halo ? sp().tint(sp().glow, qc(col)) : null;
    g.globalCompositeOperation = 'lighter'; g.fillStyle = col;
    for (let i = 0; i < wins.length; i++) {
      const [x, y, w, h] = wins[i], f = 0.8 + 0.2 * noise1(t * 4.5, i + seed);
      g.globalAlpha = A0 * Math.min(1, 0.55 * lit * f); g.fillRect(x, y, w, h);
      if (spr) { const r = Math.max(w, h) * 1.6; g.globalAlpha = A0 * Math.min(1, 0.35 * lit * f); g.drawImage(spr, x + w / 2 - r, y + h / 2 - r, r * 2, r * 2); }
    }
    g.globalAlpha = p; g.globalCompositeOperation = op;
  }

  // ---------- 江南白墙黛瓦 ----------
  // 马头墙压顶：一道薄薄的黛瓦脊，下挂一排瓦当，外端像马头一样向上翘起；墙上压一线阴影
  function wallCap(g, a, b, top, roofC, wall, outL, outR) {
    const th = 4.2, dk = shade(roofC, -0.4);
    g.fillStyle = rgba(shade(wall, -0.45), 0.45); g.fillRect(a, top + 1, b - a, 4);
    g.fillStyle = roofC;
    g.beginPath();
    g.moveTo(a - 4, top + 1); g.lineTo(b + 4, top + 1);
    if (outR) { g.quadraticCurveTo(b + 8, top - 1, b + 11, top - 8); g.lineTo(b + 9, top - 9); g.quadraticCurveTo(b + 6, top - th - 1, b + 1, top - th); }
    else g.lineTo(b + 4, top - th + 1);
    g.lineTo(a + (outL ? -1 : -4), top - th);
    if (outL) { g.quadraticCurveTo(a - 6, top - th - 1, a - 9, top - 9); g.lineTo(a - 11, top - 8); g.quadraticCurveTo(a - 8, top - 1, a - 4, top + 1); }
    g.closePath(); g.fill();
    // 瓦当一排、脊上一线受光
    g.fillStyle = dk;
    for (let x = a - 2; x < b + 3; x += 3.2) { g.beginPath(); g.arc(x, top + 1.6, 1.3, 0, PI); g.fill(); }
    g.fillStyle = rgba(shade(roofC, 0.45), 0.6); g.fillRect(a - 2, top - th, b - a + 4, 0.9);
  }
  // 雨痕：墙头往下的灰黑水渍，长短浓淡不一
  function stains(g, x, y, w, h, wall, r, n) {
    for (let k = 0; k < n; k++) {
      const sx = x + 2 + r() * (w - 4), len = h * (0.25 + r() * 0.6), sw = 1.5 + r() * 6;
      g.fillStyle = K.lin(g, 0, y, 0, y + len, [[0, rgba(shade(wall, -0.5), 0.3 + r() * 0.15)], [0.6, rgba(shade(wall, -0.45), 0.12)], [1, rgba(shade(wall, -0.4), 0)]]);
      g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + sw, y); g.lineTo(sx + sw * 0.6 + (r() - 0.5) * 3, y + len); g.lineTo(sx + sw * 0.3, y + len * 0.9); g.closePath(); g.fill();
    }
  }
  // 马头墙：山墙朝外，顶部逐级升高，每级一道压顶、外端翘起；一侧背光
  function huiGable(g, x, y, w, h, o) {
    const steps = o.steps, sh = o.stepH, wall = o.wall, roofC = o.roof, segs = [];
    const n = steps * 2 + 1;
    for (let k = 0; k < n; k++) { const lvl = steps - Math.abs(k - steps); segs.push([x + (k / n) * w, x + ((k + 1) / n) * w, y - h - lvl * sh, lvl, k]); }
    const outline = () => { g.beginPath(); g.moveTo(x, y); for (const [a, b, top] of segs) { g.lineTo(a, top); g.lineTo(b, top); } g.lineTo(x + w, y); g.closePath(); };
    outline(); g.fillStyle = wall; g.fill();
    g.save(); outline(); g.clip();
    // 背光一侧（离光远的半边）压一层冷灰
    const sd = o.lightDir || -1;
    g.fillStyle = K.lin(g, x, 0, x + w, 0, sd > 0 ? [[0, rgba('#5a6070', 0.16)], [0.5, rgba('#5a6070', 0.04)], [1, rgba('#5a6070', 0)]] : [[0, rgba('#5a6070', 0)], [0.5, rgba('#5a6070', 0.04)], [1, rgba('#5a6070', 0.16)]]);
    g.fillRect(x, y - h - steps * sh - 10, w, h + steps * sh + 10);
    stains(g, x, y - h - steps * sh, w, h + steps * sh, wall, o.r, 5 + Math.floor(w / 18));
    g.restore();
    for (const [a, b, top, lvl, k] of segs) wallCap(g, a, b, top, roofC, wall, k < steps && lvl < steps, k > steps && lvl < steps);
  }
  function huiHouse(g, hs, o) {
    const { x, w, h, type } = hs, y = hs.y, roofC = o.roof, r = rng(hs.seed);
    const wall = mix(o.wall, hs.seed % 4 === 0 ? '#9a9890' : '#ffffff', hs.seed % 4 === 0 ? 0.12 : 0.05);
    if (type === 'gable') {
      // 山墙后面露出的屋坡：瓦垄只画在坡面里
      const rt = y - h - hs.stepH * (hs.steps - 0.3);
      const slope = () => { g.beginPath(); g.moveTo(x - w * 0.18, y - h + 6); g.lineTo(x - w * 0.02, rt); g.lineTo(x + w * 1.02, rt); g.lineTo(x + w * 1.18, y - h + 6); g.closePath(); };
      slope(); g.fillStyle = shade(roofC, 0.05); g.fill();
      g.save(); slope(); g.clip();
      g.strokeStyle = rgba(shade(roofC, -0.5), 0.55); g.lineWidth = 1;
      for (let xx = x - w * 0.16; xx < x + w * 1.16; xx += 4.5) { const u = (xx - x) / w; g.beginPath(); g.moveTo(xx + (u < 0.5 ? 2 : -2), rt + 1); g.lineTo(xx + (u - 0.5) * 6, y - h + 6); g.stroke(); }
      g.restore();
      g.fillStyle = shade(roofC, -0.4); g.fillRect(x - w * 0.18, y - h + 4, w * 1.36, 2);
      huiGable(g, x, y, w, h, { steps: hs.steps, stepH: hs.stepH, wall, roof: roofC, lightDir: o.lightDir, r });
    } else {
      // 檐面朝外：墙顶一道瓦坡，两端马头墙竖起
      const rh = hs.roofH;
      const slope = () => { g.beginPath(); g.moveTo(x - 8, y - h + 2); g.lineTo(x + w + 8, y - h + 2); g.lineTo(x + w - 2, y - h - rh); g.lineTo(x + 2, y - h - rh); g.closePath(); };
      slope(); g.fillStyle = shade(roofC, -0.1); g.fill();
      g.save(); slope(); g.clip();
      g.strokeStyle = rgba(shade(roofC, -0.5), 0.6); g.lineWidth = 1;
      for (let xx = x; xx < x + w; xx += 5) { g.beginPath(); g.moveTo(xx + 2, y - h - rh); g.lineTo(xx + (xx - x - w / 2) * 0.04, y - h + 2); g.stroke(); }
      g.restore();
      g.fillStyle = shade(roofC, -0.45); g.fillRect(x - 8, y - h, w + 16, 3);
      g.fillStyle = shade(roofC, -0.3); for (let xx = x - 6; xx < x + w + 6; xx += 3.4) { g.beginPath(); g.arc(xx, y - h + 3, 1.3, 0, PI); g.fill(); }
      g.fillStyle = wall; g.fillRect(x, y - h + 3, w, h - 3);
      g.fillStyle = K.lin(g, 0, y - h + 3, 0, y - h + 16, [[0, rgba(shade(wall, -0.5), 0.35)], [1, rgba(shade(wall, -0.5), 0)]]); g.fillRect(x, y - h + 3, w, 13);
      stains(g, x, y - h + 3, w, h - 3, wall, r, 3 + Math.floor(w / 25));
      for (const [ex, sd] of [[x - 6, -1], [x + w - 8, 1]]) {
        const top = y - h - rh - 18;
        g.fillStyle = wall; g.fillRect(ex, top, 14, h + rh + 18);
        g.fillStyle = rgba(shade(wall, -0.4), sd > 0 ? 0.18 : 0.08); g.fillRect(ex + (sd > 0 ? 7 : 0), top, 7, h + rh + 18);
        stains(g, ex, top + 4, 14, h * 0.6, wall, r, 2);
        wallCap(g, ex, ex + 14, top, roofC, wall, sd < 0, sd > 0);
      }
    }
    // 墙脚潮印与青苔
    g.fillStyle = K.lin(g, 0, y - h * 0.24, 0, y, [[0, rgba(shade(wall, -0.5), 0)], [0.7, rgba(mix(shade(wall, -0.45), '#4a5a40', 0.3), 0.25)], [1, rgba(shade(wall, -0.55), 0.45)]]);
    g.fillRect(x, y - h * 0.24, w, h * 0.24);
    if (o.light) {
      g.save(); g.globalCompositeOperation = 'source-atop';
      g.fillStyle = K.lin(g, x, 0, x + w, 0, o.lightDir > 0 ? [[0, rgba(o.light, 0)], [1, rgba(o.light, 0.32)]] : [[0, rgba(o.light, 0.32)], [1, rgba(o.light, 0)]]);
      g.fillRect(x - 10, y - h - 80, w + 20, h + 80);
      g.restore();
    }
    // 门与门罩、小窗
    if (hs.door) {
      const dw = Math.min(26, w * 0.3), dx = x + w * hs.door - dw / 2, dh = Math.min(h * 0.5, 44);
      g.fillStyle = '#5a5650'; g.fillRect(dx - 3, y - dh - 1, dw + 6, dh + 1);
      g.fillStyle = '#2a211c'; g.fillRect(dx, y - dh, dw, dh);
      g.fillStyle = 'rgba(160,120,80,0.25)'; g.fillRect(dx + dw / 2 - 0.5, y - dh, 1, dh);
      roof(g, dx + dw / 2, y - dh - 6, dw + 16, 10, { color: roofC, tiles: false, curl: 0.5 });
    }
    for (const [wx, wy, ww, wh] of hs.wins) {
      g.fillStyle = '#2b2622'; g.fillRect(wx, wy, ww, wh);
      g.strokeStyle = 'rgba(120,100,80,0.45)'; g.lineWidth = 0.8;
      g.beginPath(); for (let k = 1; k < 3; k++) { g.moveTo(wx + (ww * k) / 3, wy); g.lineTo(wx + (ww * k) / 3, wy + wh); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(wx - 1, wy + wh, ww + 2, 1.5);
      g.fillStyle = rgba(shade(roofC, -0.2), 0.8); g.fillRect(wx - 2.5, wy - 2.5, ww + 5, 2.2);
    }
  }
  // 布局在局部坐标里排（x 从 0 起，墙脚线 y=0），平移不重排
  const townStore = new Map();
  function townLayout(seed, span, sc) {
    const key = [seed, Math.round(span), sc].join('|');
    let L = townStore.get(key);
    if (L) return L;
    const r = rng(seed * 97 + 3), rows = [[], []];
    for (let row = 0; row < 2; row++) {
      const s = sc * (row ? 1 : 0.72), y = -(row ? 0 : 26 * sc);
      let x = -40 - r() * 40;
      while (x < span + 40) {
        const gable = r() < 0.55, w = (gable ? 70 + r() * 70 : 90 + r() * 110) * s, h = (gable ? 70 + r() * 50 : 55 + r() * 40) * s;
        const hs = { x, w, h, y: y + (r() - 0.5) * 6 * s, type: gable ? 'gable' : 'eave', steps: 1 + Math.floor(r() * 2.6), stepH: (12 + r() * 6) * s, roofH: (16 + r() * 10) * s, seed: Math.floor(r() * 1e6), door: r() < 0.6 ? 0.25 + r() * 0.5 : 0, wins: [] };
        const nw = Math.floor(r() * 3);
        for (let k = 0; k < nw; k++) { const ww = (8 + r() * 6) * s, wh = (9 + r() * 8) * s; hs.wins.push([x + (0.15 + r() * 0.7) * w - ww / 2, hs.y - h * (0.55 + r() * 0.3), ww, wh]); }
        rows[row].push(hs);
        x += w * (0.7 + r() * 0.45) + (r() < 0.2 ? 30 * s : 0);
      }
    }
    // 同排里随机交错先后，营造层叠
    rows.forEach((rw) => rw.sort((a, b) => a.seed % 3 - b.seed % 3));
    // 贴图需要的高度按最高的屋顶算（不多留空白）；后排被前排挡住的窗不亮
    const roofTop = (f) => f.y - f.h - (f.type === 'gable' ? f.steps * f.stepH + 14 : f.roofH + 30);
    let mt = 0;
    for (const rw of rows) for (const hs of rw) mt = Math.max(mt, -roofTop(hs));
    for (const hs of rows[0]) hs.wins = hs.wins.filter(([wx, wy, ww, wh]) => !rows[1].some((f) => wx + ww > f.x - 6 && wx < f.x + f.w + 6 && wy + wh > roofTop(f) && wy < f.y));
    L = { rows, top: mt + 8 };
    townStore.set(key, L);
    if (townStore.size > 32) townStore.delete(townStore.keys().next().value);
    return L;
  }
  // 江南水乡：y 墙脚线（多为水岸），color 墙色，roof 黛瓦色，haze 远排融入的雾色；lit 0..1 窗里亮灯；scale 尺寸
  // light/lightX 墙面受光色与光源横坐标（如夕阳）；bank:false 不画青石驳岸；smoke 0..1 炊烟；hazeA 整体再融进雾里
  // 可逐帧变：t、y、x0（整体平移）、lit、smoke、hazeA；x1 - x0、scale、颜色变了会重建贴图
  E.jiangnanTown = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 520, wall = o.color || '#ece5d6', roofC = o.roof || '#34363c', haze = o.haze || '#c9ccd2', seed = o.seed ?? 1;
    const sc = Math.round((o.scale ?? 1) * 20) / 20, x0 = o.x0 ?? 0, x1 = o.x1 ?? W, lit = o.lit || 0, span = Math.round(x1 - x0);
    const L = townLayout(seed, span, sc);
    const pad = 40, top = Math.ceil(L.top), hh = top + 20 * sc + 20, lxr = o.lightX == null ? Math.round(span / 2) : Math.round((o.lightX - x0) / 20) * 20;
    const hq = Math.round((o.hazeA || 0) * 20) / 20;
    // 前后两排画进同一张贴图（后排先画、罩一层雾，再画前排与驳岸），只贴一次
    const img = cached('town', [seed, span, sc, wall, roofC, haze, o.light || '-', lxr, o.bank === false ? 0 : 1, hq], span + pad * 2, hh, 1, (c) => {
      c.translate(pad, top);
      for (const k of [0, 1]) {
        const w2 = k ? wall : mix(wall, haze, 0.45), r2 = k ? roofC : mix(roofC, haze, 0.5);
        L.rows[k].forEach((hs) => huiHouse(c, hs, { wall: w2, roof: r2, light: o.light ? mix(o.light, haze, k ? 0 : 0.5) : null, lightDir: (hs.x + hs.w / 2) < lxr ? 1 : -1 }));
        if (!k) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(haze, 0.25); c.fillRect(-pad, -top, span + pad * 2, hh); c.globalCompositeOperation = 'source-over'; }
      }
      if (o.bank !== false) {
        // 青石驳岸：错缝条石，石缝里一点青苔，水线处一道湿痕
        const bh = 14 * sc, stone = o.stone || '#6f6d68', rr = rng(seed + 77);
        c.fillStyle = K.lin(c, 0, -2, 0, bh, [[0, shade(stone, 0.2)], [1, shade(stone, -0.35)]]);
        c.fillRect(-pad, -2, span + pad * 2, bh + 2);
        c.strokeStyle = rgba(shade(stone, -0.5), 0.6); c.lineWidth = 1;
        for (let xx = -pad; xx < span + pad; xx += 26 * sc + rr() * 12 * sc) {
          c.beginPath(); c.moveTo(xx, -2); c.lineTo(xx, bh * 0.5); c.moveTo(xx + 12 * sc, bh * 0.5); c.lineTo(xx + 12 * sc, bh); c.stroke();
          c.fillStyle = rgba(rr() < 0.5 ? '#ffffff' : '#000000', 0.05 + rr() * 0.06); c.fillRect(xx + 1, -1, 24 * sc, bh * 0.5);
        }
        c.beginPath(); c.moveTo(-pad, bh * 0.5); c.lineTo(span + pad, bh * 0.5); c.stroke();
        c.fillStyle = 'rgba(40,60,50,0.35)'; c.fillRect(-pad, bh - 3, span + pad * 2, 3);
        // 河埠头：几处石阶下到水边
        for (let k = 0; k < Math.max(1, Math.round(span / 500)); k++) {
          const sx = (k + 0.3 + rr() * 0.4) * (span / Math.max(1, Math.round(span / 500)));
          for (let j = 0; j < 4; j++) { c.fillStyle = j % 2 ? shade(stone, -0.05) : shade(stone, 0.18); c.fillRect(sx - 14 * sc + j * 2, -2 + j * bh * 0.25, 28 * sc - j * 4, bh * 0.25); }
        }
      }
      // 整体再融进雾里（远景用）
      if (hq) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(haze, hq); c.fillRect(-pad, -top, span + pad * 2, hh); c.globalCompositeOperation = 'source-over'; }
    });
    blit(g, img, x0 - pad, y - top, img.lw, img.lh);
    if (lit > 0) for (const k of [0, 1]) {
      const wins = [];
      L.rows[k].forEach((hs) => hs.wins.forEach((wn, i) => { if ((hs.seed + i) % 3 !== 0) wins.push([wn[0] + x0, wn[1] + y, wn[2], wn[3]]); }));
      windowGlow(g, wins, lit * (k ? 1 : 0.7), t, o.lightColor || '#ffb45a', seed + k);
    }
    // 炊烟：从几户人家的屋顶升起一串柔团，越高越大越淡，被风带向一边
    const sm = o.smoke ?? 0.6;
    if (sm > 0) {
      const spr = sp().tint(sp().glow, qc(o.smokeColor || mix(haze, '#6a6a78', 0.55))), wind = o.wind ?? 0.4;
      L.rows[1].forEach((hs, i) => {
        if (hs.seed % 4 !== 1) return;
        const cx = x0 + hs.x + hs.w * 0.6, cy = y + hs.y - hs.h - (hs.type === 'gable' ? hs.steps * hs.stepH : hs.roofH) - 2;
        for (let k = 0; k < 10; k++) {
          const P = 7, q = ((t / P + k / 10 + h2(i, 3)) % 1), rise = q * 150 * sc, r = (6 + 30 * q) * sc;
          const px = cx + rise * (0.25 + wind * 0.9) + Math.sin(t * 0.8 + k + i) * 6 * q, py = cy - rise;
          al(g, sm * 0.5 * Math.sin(q * PI) * (1 - q * 0.6));
          g.drawImage(spr, px - r * 1.3, py - r, r * 2.6, r * 2);
        }
      });
      al(g, 1);
    }
  };

  // 石拱桥：(x, y) 为桥脚水面中点；s 缩放；span 跨度；color 石色；rail 石栏颜色；lit 桥洞里透出的光
  E.archBridge = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 560, s = o.s ?? 1, col = o.color || '#8a8a84', span = o.span ?? 260, sq = sqOf(s);
    const hq = Math.round((o.hazeA || 0) * 20) / 20;
    const img = cached('bridge', [sq, span | 0, col, o.rail || '-', hq ? o.haze || '#c8ccd4' : '-', hq], span + 220, span * 0.62 + 60, sq, (c) => {
      const cx = (span + 220) / 2, base = span * 0.62 + 56, R = span / 2, top = base - R * 0.92 - 18, dk = shade(col, -0.4);
      // 桥身：拱顶处薄，两头顺着台阶斜下到岸（不是一整座实心的山）
      const deck = (u) => { const xx = lerp(10, span + 210, clamp(u)), dx = Math.abs(xx - cx) / (R * 1.22); return base - 16 - (dx < 1 ? (R * 0.92 + 10) * Math.sqrt(1 - dx * dx * 0.55) - 4 * dx * dx : Math.max(0, (R * 0.92 + 6) * Math.sqrt(0.45) * (1 - (dx - 1) * 2.2))); };
      c.beginPath(); c.moveTo(0, base);
      for (let i = 0; i <= 60; i++) { const u = i / 60; c.lineTo(lerp(10, span + 210, u), deck(u)); }
      c.lineTo(span + 220, base); c.closePath();
      c.fillStyle = K.lin(c, 0, top, 0, base, [[0, shade(col, 0.15)], [1, shade(col, -0.25)]]); c.fill();
      // 拱洞（半圆略超），券石一圈
      c.save(); c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.arc(cx, base, R * 0.86, PI, TAU); c.fill(); c.restore();
      c.strokeStyle = dk; c.lineWidth = 1;
      for (let k = 0; k <= 22; k++) { const a = PI + (k / 22) * PI; c.beginPath(); c.moveTo(cx + Math.cos(a) * R * 0.86, base + Math.sin(a) * R * 0.86); c.lineTo(cx + Math.cos(a) * R * 1.0, base + Math.sin(a) * R * 1.0); c.stroke(); }
      c.beginPath(); c.arc(cx, base, R * 1.0, PI, TAU); c.stroke();
      c.strokeStyle = rgba('#ffffff', 0.25); c.beginPath(); c.arc(cx, base, R * 0.87, PI * 1.1, PI * 1.6); c.stroke();
      // 条石纹
      const rr = rng(span | 0);
      c.save(); c.beginPath(); c.moveTo(0, base); for (let i = 0; i <= 40; i++) { const u = i / 40; c.lineTo(lerp(10, span + 210, u), deck(u)); } c.lineTo(span + 220, base); c.closePath(); c.clip();
      for (let yy = top; yy < base; yy += 9) for (let xx = (yy / 9) % 2 ? 0 : 14; xx < span + 220; xx += 28) { c.fillStyle = rgba(rr() < 0.5 ? '#000000' : '#ffffff', 0.04 + rr() * 0.06); c.fillRect(xx, yy, 27, 8); }
      c.fillStyle = rgba('#3a5a40', 0.25); for (let k = 0; k < 30; k++) { c.beginPath(); c.arc(rr() * (span + 220), base - rr() * 30, 2 + rr() * 5, 0, TAU); c.fill(); }
      c.restore();
      // 桥栏：望柱与栏板沿桥面起伏
      const rc = o.rail || shade(col, 0.1);
      c.fillStyle = rc;
      for (let i = 0; i <= 12; i++) { const u = 0.04 + (i / 12) * 0.92, px = lerp(10, span + 210, u), py = deck(u); c.fillRect(px - 2.5, py - 20, 5, 20); c.beginPath(); c.arc(px, py - 21, 3.2, 0, TAU); c.fill(); }
      c.strokeStyle = rc; c.lineWidth = 3;
      c.beginPath(); for (let i = 0; i <= 40; i++) { const u = 0.04 + (i / 40) * 0.92; i ? c.lineTo(lerp(10, span + 210, u), deck(u) - 13) : c.moveTo(lerp(10, span + 210, u), deck(u) - 13); } c.stroke();
      c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i <= 40; i++) { const u = 0.04 + (i / 40) * 0.92; i ? c.lineTo(lerp(10, span + 210, u), deck(u) - 4) : c.moveTo(lerp(10, span + 210, u), deck(u) - 4); } c.stroke();
      c.strokeStyle = rgba('#ffffff', 0.3); c.lineWidth = 1; c.beginPath(); for (let i = 0; i <= 40; i++) { const u = i / 40; i ? c.lineTo(lerp(10, span + 210, u), deck(u) + 1) : c.moveTo(lerp(10, span + 210, u), deck(u) + 1); } c.stroke();
      if (hq) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(o.haze || '#c8ccd4', hq); c.fillRect(0, 0, span + 220, span * 0.62 + 60); c.globalCompositeOperation = 'source-over'; }
    });
    al(g, o.alpha ?? 1);
    blit(g, img, x - (img.lw / 2) * s, y - (img.lh - 4) * s, img.lw * s, img.lh * s);
    if (o.lit) K.lighter(g, () => glow(g, x, y - span * 0.2 * s, span * 0.4 * s, o.lightColor || '#ffb45a', 0.3 * o.lit));
    al(g, 1);
  };

  // 院墙：(x, y) 为墙顶左端，w 宽，h 墙高（默认到画面底）；light 墙面受光色（如夕照），lightX 光源横坐标；
  // window 'lattice' 漏窗 | 'moon' 月洞门（winX 中心、winR 半径）；through(g) 在洞口里画墙外景色。
  // 可逐帧变：x、y（墙在局部坐标里画）、light、lightX；w、h、cap、颜色变了会重建贴图
  E.courtyardWall = function (g, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 360, w = o.w ?? W, hReq = o.h ?? H - y + 20, h = o.h != null ? Math.round(o.h) : bucket(hReq, 40), col = o.color || '#e9e2d4', roofC = o.roof || '#3a3c42', light = o.light || null, seed = o.seed ?? 4;
    const lx = o.lightX ?? x + w * 0.65, cap = o.cap ?? 30, ww = Math.round(w);
    const img = cached('cwall', [ww, h, col, roofC, cap, seed], ww + 40, h + cap + 30, 1, (c) => {
      // 局部坐标：墙顶左端在 (20, cap + 14)
      c.translate(20, cap + 14);
      const r = rng(seed), bot = h, w = ww;
      c.fillStyle = K.lin(c, 0, 0, 0, bot, [[0, col], [0.5, col], [1, shade(col, -0.2)]]);
      c.fillRect(0, 0, w, h);
      // 斑驳：灰皮剥落、补过的白灰、雨痕
      for (let k = 0; k < Math.round(w / 40); k++) { c.fillStyle = rgba(shade(col, -0.3), 0.04 + r() * 0.06); A.inkBlob(c, r() * w, 30 + r() * h * 0.8, 8 + r() * 30, k, 0.5); c.fill(); }
      for (let k = 0; k < Math.round(w / 90); k++) { c.fillStyle = rgba('#ffffff', 0.08 + r() * 0.08); A.inkBlob(c, r() * w, 50 + r() * h * 0.6, 16 + r() * 34, k + 40, 0.45); c.fill(); }
      stains(c, 0, 10, w, h * 0.7, col, r, Math.round(w / 30));
      // 青石墙基与青苔
      const ph = Math.min(46, h * 0.16), py = bot - ph;
      c.fillStyle = K.lin(c, 0, py, 0, bot, [[0, '#7a7870'], [1, '#4c4b46']]);
      c.fillRect(0, py, w, ph);
      c.strokeStyle = 'rgba(30,30,28,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, py + ph / 2); c.lineTo(w, py + ph / 2); c.stroke();
      for (let xx = 0, k = 0; xx < w; xx += 50 + r() * 30, k++) { c.beginPath(); c.moveTo(xx, py + (k % 2 ? 0 : ph / 2)); c.lineTo(xx, py + (k % 2 ? ph / 2 : ph)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, py, w, 2);
      c.fillStyle = K.lin(c, 0, py - 40, 0, py, [[0, 'rgba(70,84,56,0)'], [1, 'rgba(70,84,56,0.3)']]);
      c.fillRect(0, py - 40, w, 40);
      // 檐下阴影
      c.fillStyle = K.lin(c, 0, 0, 0, 34, [[0, 'rgba(20,18,16,0.45)'], [1, 'rgba(20,18,16,0)']]);
      c.fillRect(0, 0, w, 34);
      // 瓦檐压顶：前坡瓦垄、檐口瓦当滴水、屋脊两端起翘
      const ct = -cap * 0.7;
      c.fillStyle = K.lin(c, 0, ct, 0, 4, [[0, shade(roofC, 0.2)], [1, shade(roofC, -0.15)]]);
      c.beginPath(); c.moveTo(-12, 4); c.lineTo(w + 12, 4); c.lineTo(w + 6, ct); c.lineTo(-6, ct); c.closePath(); c.fill();
      for (let xx = -8; xx < w + 10; xx += 8) {
        c.strokeStyle = rgba(shade(roofC, -0.55), 0.85); c.lineWidth = 2.2; c.beginPath(); c.moveTo(xx, ct); c.lineTo(xx, 2); c.stroke();
        c.strokeStyle = rgba(shade(roofC, 0.6), 0.22); c.lineWidth = 1.2; c.beginPath(); c.moveTo(xx + 2.6, ct); c.lineTo(xx + 2.6, 2); c.stroke();
      }
      for (let xx = -8; xx < w + 10; xx += 8) {
        c.fillStyle = shade(roofC, -0.3); c.beginPath(); c.arc(xx + 1, 5, 3.6, 0, TAU); c.fill();
        c.fillStyle = rgba(shade(roofC, 0.5), 0.3); c.beginPath(); c.arc(xx + 0.5, 4.2, 1.6, 0, TAU); c.fill();
        c.fillStyle = shade(roofC, -0.4); c.beginPath(); c.moveTo(xx + 5, 4); c.lineTo(xx + 9, 4); c.lineTo(xx + 7, 10); c.closePath(); c.fill();
      }
      const rt = -cap;
      c.fillStyle = shade(roofC, -0.3); c.fillRect(-8, rt, w + 16, cap * 0.32);
      c.fillStyle = shade(roofC, 0.35); c.fillRect(-8, rt, w + 16, 1.6);
      for (const [ex, sd] of [[-8, -1], [w + 8, 1]]) {
        c.fillStyle = shade(roofC, -0.3);
        c.beginPath(); c.moveTo(ex, rt); c.quadraticCurveTo(ex + sd * 10, rt - 4, ex + sd * 16, rt - 14); c.lineTo(ex + sd * 12, rt + cap * 0.32); c.lineTo(ex, rt + cap * 0.4); c.closePath(); c.fill();
      }
    });
    blit(g, img, x - 20, y - cap - 14, img.lw, img.lh);
    if (light) {
      // 墙面受光在贴的时候画（光源移动不必重建贴图）：墙头一片斜照的暖光、瓦脊一线亮
      g.save(); g.beginPath(); g.rect(x, y, w, Math.min(h, H + 40 - y)); g.clip();
      vfill(g, x, y, x + w, y + h * 0.6, [[0, rgba(light, 0.3)], [1, rgba(light, 0)]]);
      glow(g, lx, y, w * 0.6, light, 0.4);
      g.restore();
      al(g, 0.4); g.fillStyle = light; g.fillRect(x - 8, y - cap, w + 16, 2.5); al(g, 0.15); g.fillRect(x - 8, y - cap * 0.7, w + 16, 4); al(g, 1);
    }
    const win = o.window;
    if (win) {
      const bot = y + hReq, R = o.winR ?? (win === 'moon' ? 130 : 46);
      const cx = o.winX ?? x + w / 2, cy = win === 'moon' ? (o.winY ?? Math.min(bot - R * 0.82, y + R + 50)) : (o.winY ?? y + 90);
      const ground = win === 'moon' ? Math.min(bot, cy + R * 0.82) : cy + R;
      g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
      if (win === 'moon') { g.beginPath(); g.rect(cx - R - 2, cy - R - 2, R * 2 + 4, ground - (cy - R) + 2); g.clip(); }
      if (o.through) o.through(g); else { g.fillStyle = K.lin(g, 0, cy - R, 0, cy + R, [[0, '#2c3430'], [1, '#141816']]); g.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4); }
      if (win === 'lattice') {
        g.strokeStyle = shade(col, -0.2); g.lineWidth = 3.4;
        for (let k = -5; k <= 5; k++) {
          g.beginPath(); g.moveTo(cx + k * 14 - R, cy - R); g.lineTo(cx + k * 14 + R, cy + R); g.stroke();
          g.beginPath(); g.moveTo(cx + k * 14 + R, cy - R); g.lineTo(cx + k * 14 - R, cy + R); g.stroke();
        }
      }
      g.restore();
      // 门洞的砖框：外沿深、内沿受光
      const a0 = win === 'moon' ? Math.asin(clamp((ground - cy) / R, -1, 1)) : 0;
      const arcFr = (r, lw, c2, from, to) => { g.strokeStyle = c2; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, from, to); g.stroke(); };
      if (win === 'moon') {
        arcFr(R + 6, 12, shade(col, -0.28), PI - a0, TAU + a0);
        arcFr(R + 1, 2, rgba('#ffffff', 0.5), PI * 1.05, PI * 1.7);
        arcFr(R + 12, 1.5, rgba(shade(col, -0.5), 0.4), PI - a0, TAU + a0);
      } else { arcFr(R + 5, 10, shade(col, -0.28), 0, TAU); arcFr(R + 1, 2, rgba('#ffffff', 0.45), PI * 1.05, PI * 1.7); }
    }
  };

  // 灯笼：(x, y) 为挂点；s 缩放；color 灯罩色；lit 0..1；swing 摆幅；kind 'round' 圆灯 | 'palace' 宫灯；text 灯上字。
  // 灯身按亮度分档缓存，光晕与流苏逐帧画
  E.lantern = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 200, s = o.s ?? 1, t = o.t || 0, col = o.color || '#d0362a', lit = clamp(o.lit ?? 1), seed = o.seed ?? 0;
    const ang = (o.swing ?? 0.06) * Math.sin(t * 1.6 + seed) + (o.tilt || 0);
    const cord = (o.cord ?? 16) * s, palace = o.kind === 'palace';
    g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = '#2a1c14'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, cord); g.stroke();
    g.translate(0, cord);
    const f = 0.85 + 0.15 * flick(t, seed + 3), R = 17 * s, Hh = palace ? 30 * s : 24 * s;
    if (lit > 0) K.lighter(g, () => glow(g, 0, Hh * 0.55, R * 4.2, o.glowColor || '#ff9a4a', 0.5 * lit * f));
    const lq = Math.round(lit * f * 10) / 10, sq = sqOf(s), text = o.text || '';
    const body = cached('lantern', [col, palace ? 1 : 0, text, fontKey(text || '福'), lq], 40, 40, sq * 1.5, (c) => {
      const R1 = 17, H1 = palace ? 30 : 24;
      c.translate(20, 3);
      c.fillStyle = '#2a1c14'; c.fillRect(-R1 * 0.45, 0, R1 * 0.9, 3.5); c.fillRect(-R1 * 0.45, H1 + 3, R1 * 0.9, 3.5);
      const bc = lq > 0 ? mix(col, '#ffcf80', 0.35 * lq) : col;
      c.fillStyle = rad(c, -R1 * 0.25, H1 * 0.45, R1 * 0.1, 0, H1 * 0.55, R1 * 1.1, [[0, lq > 0 ? mix(bc, '#fff2c0', 0.55 * lq) : shade(col, 0.15)], [0.7, bc], [1, shade(col, -0.35)]]);
      c.beginPath();
      if (palace) { c.moveTo(-R1 * 0.8, 3); c.lineTo(R1 * 0.8, 3); c.lineTo(R1, H1 * 0.5); c.lineTo(R1 * 0.8, H1 + 3); c.lineTo(-R1 * 0.8, H1 + 3); c.lineTo(-R1, H1 * 0.5); c.closePath(); }
      else c.ellipse(0, H1 * 0.55 + 1.5, R1, H1 * 0.55, 0, 0, TAU);
      c.fill();
      c.strokeStyle = rgba(shade(col, -0.5), 0.45); c.lineWidth = 0.8;
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(0, H1 * 0.55 + 1.5, Math.abs(k) * R1 * 0.33 + 0.1, H1 * 0.55, 0, 0, TAU); c.stroke(); }
      if (text) glyphs(c, text, 0, H1 * 0.58, 15, rgba('#2a1208', 0.8));
    });
    g.drawImage(body, -20 * s, -3 * s, 40 * s, 40 * s);
    // 流苏
    const sw = Math.sin(t * 2.3 + seed) * 2 * s;
    g.strokeStyle = o.tassel || '#c9a24a'; g.lineWidth = 1 * s;
    g.beginPath();
    for (let k = -2; k <= 2; k++) { g.moveTo(k * 1.4 * s, Hh + 6 * s); g.quadraticCurveTo(k * 1.6 * s + sw * 0.5, Hh + 14 * s, k * 1.8 * s + sw, Hh + 22 * s); }
    g.stroke();
    g.restore();
  };

  // 带水墨描边的缓存贴图：先在临时画布上画好，再加一圈提按墨线与纸纹（建筑、器物共用，统一画风）
  function inked(name, parts, w, h, sc, fn, io) {
    return cached(name, parts, w, h, sc, (g) => {
      const S = sp().S * (sc || 1), tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(w * S)); tmp.height = Math.max(1, Math.round(h * S)); tmp.lw = w; tmp.lh = h;
      const q = tmp.getContext('2d'); q.scale(S, S); fn(q);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(inkEdge(tmp, io), 0, 0); g.restore();
    });
  }

  // ---------- 客栈 ----------
  // 直棂窗：木框、竖棂、糊纸
  function slatWin(g, x, y, w, h, frame, paper, n) {
    g.fillStyle = paper; g.fillRect(x, y, w, h);
    g.fillStyle = frame;
    const k = n || Math.max(3, Math.round(w / 6));
    for (let i = 1; i < k; i++) g.fillRect(x + (i * w) / k - 0.8, y, 1.6, h);
    g.fillRect(x, y + h * 0.33 - 1, w, 2); g.fillRect(x, y + h * 0.66 - 1, w, 2);
    g.lineWidth = 3; g.strokeStyle = frame; g.strokeRect(x, y, w, h);
  }
  function innTex(sq, wood, roofC, wallC, sign) {
    return inked('inn', [sq, wood, roofC, wallC, sign, fontKey(sign)], 480, 360, sq, (g) => {
      const cx = 240, y = 350, dark = shade(wood, -0.5), lac = shade(wood, -0.2);
      g.fillStyle = '#5b5650'; g.fillRect(cx - 200, y - 10, 400, 10);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx - 200, y - 10, 400, 1.5);
      // 一层：深色木铺面，左右两间排着门板（有几块卸下，露出屋里），中间敞门
      g.fillStyle = '#20150e'; g.fillRect(cx - 178, y - 118, 356, 108);
      for (const [x0, x1, sd] of [[-170, -66, -1], [66, 170, 1]]) {
        const nb = 9, bw = (x1 - x0) / nb;
        for (let k = 0; k < nb; k++) {
          if ((sd < 0 && (k === 6 || k === 7)) || (sd > 0 && k === 2)) continue;
          const bx = cx + x0 + k * bw, tone = h2(k, sd + 5);
          g.fillStyle = mix(lac, dark, 0.3 + tone * 0.4); g.fillRect(bx + 0.5, y - 112, bw - 1, 100);
          g.fillStyle = rgba('#ffffff', 0.06); g.fillRect(bx + 1, y - 112, 1.2, 100);
          g.fillStyle = rgba('#000000', 0.25); g.fillRect(bx + bw - 1.5, y - 112, 1, 100);
        }
        g.fillStyle = dark; g.fillRect(cx + x0, y - 70, x1 - x0, 3); g.fillRect(cx + x0, y - 114, x1 - x0, 4);
      }
      // 卸下的门板斜靠在一旁
      g.save(); g.translate(cx - 30, y - 12); g.rotate(-0.12); g.fillStyle = mix(lac, dark, 0.4); g.fillRect(-60, -96, 11, 96); g.fillRect(-48, -96, 11, 96); g.restore();
      for (const px of [-178, -66, 58, 170]) { g.fillStyle = K.lin(g, cx + px, 0, cx + px + 9, 0, [[0, shade(wood, 0.1)], [1, dark]]); g.fillRect(cx + px, y - 122, 9, 112); }
      // 门槛
      g.fillStyle = dark; g.fillRect(cx - 58, y - 16, 116, 6);
      // 腰檐：檐角高高翘起
      roof(g, cx, y - 122, 420, 28, { color: roofC, curl: 0.85, ridge: 0.98, tileW: 7 });
      // 二层：退进；格扇窗，前面一排弯弯的美人靠
      g.fillStyle = shade(wood, -0.35); g.fillRect(cx - 160, y - 244, 320, 98);
      for (let k = 0; k < 6; k++) slatWin(g, cx - 152 + k * 51, y - 236, 45, 56, dark, '#d9c49a', 7);
      for (const px of [-164, 156]) { g.fillStyle = lac; g.fillRect(cx + px, y - 246, 8, 100); }
      // 美人靠：靠背一根根 S 形的弯木条，上沿一道外鼓的扶手
      g.fillStyle = shade(wood, 0.05); g.fillRect(cx - 176, y - 152, 352, 7);
      g.strokeStyle = dark; g.lineWidth = 2.2;
      for (let k = 0; k <= 44; k++) { const bx = cx - 172 + k * 7.8; g.beginPath(); g.moveTo(bx, y - 152); g.bezierCurveTo(bx + 2.5, y - 160, bx - 3, y - 168, bx + 1, y - 178); g.stroke(); }
      g.strokeStyle = shade(wood, 0.1); g.lineWidth = 5;
      g.beginPath(); g.moveTo(cx - 178, y - 176); g.quadraticCurveTo(cx, y - 184, cx + 178, y - 176); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.18); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - 178, y - 178.5); g.quadraticCurveTo(cx, y - 186.5, cx + 178, y - 178.5); g.stroke();
      // 顶檐：重檐翘角
      roof(g, cx, y - 246, 440, 66, { color: roofC, curl: 0.62, ridge: 0.6, tileW: 8 });
      // 竖招牌：从腰檐下挂在左柱前，黑底金框
      const bx = cx - 92, by = y - 112;
      g.strokeStyle = '#2a1a10'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx - 8, by - 10); g.lineTo(bx - 8, by); g.moveTo(bx + 8, by - 10); g.lineTo(bx + 8, by); g.stroke();
      g.fillStyle = '#1e140c'; g.fillRect(bx - 15, by, 30, 86);
      g.strokeStyle = '#b48a3c'; g.lineWidth = 1.6; g.strokeRect(bx - 12, by + 3, 24, 80);
      glyphs(g, sign, bx, by + 43, 22, '#e2b860', { vertical: true });
    }, { w: 1.1, a: 0.6, grain: 0.3 });
  }
  function innBankTex(sq, bh, stone) {
    return cached('innBank', [sq, bh | 0, stone], 460, bh + 4, sq, (g) => {
      g.fillStyle = K.lin(g, 0, 2, 0, bh, [[0, shade(stone, 0.15)], [1, shade(stone, -0.45)]]);
      g.fillRect(0, 0, 460, bh);
      g.strokeStyle = rgba(shade(stone, -0.55), 0.6); g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const yy = (k * bh) / 4;
        for (let xx = (k % 2) * 20 - 20, j = 0; xx < 460; xx += 40, j++) {
          const v = h2(j, k + 3);
          g.fillStyle = v < 0.5 ? rgba('#000000', 0.06 + v * 0.1) : rgba('#ffffff', (v - 0.5) * 0.12);
          g.fillRect(Math.max(0, xx), yy, Math.min(40, 460 - xx), bh / 4);
          g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + bh / 4); g.stroke();
        }
        g.beginPath(); g.moveTo(0, yy); g.lineTo(460, yy); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 460, 2);
      g.fillStyle = K.lin(g, 0, bh * 0.6, 0, bh, [[0, 'rgba(30,50,40,0)'], [1, 'rgba(30,50,40,0.45)']]); g.fillRect(0, bh * 0.6, 460, bh * 0.4);
      const r = rng(bh | 0);
      for (let k = 0; k < 20; k++) { g.fillStyle = rgba('#3a5a3a', 0.2 + r() * 0.2); g.beginPath(); g.arc(r() * 460, bh * (0.5 + r() * 0.5), 2 + r() * 6, 0, TAU); g.fill(); }
    });
  }
  // 客栈：(x, y) 为台基中点；s 缩放；lit 0..1 灯火；sign 竖招牌字；flag 酒旗字（false 不画），flagSide 1 右 | -1 左；
  // wind 酒旗风力；bank 临水石台基（bankH 高）
  E.inn = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.8, wind = o.wind ?? 0.5;
    const sq = sqOf(s);
    const img = innTex(sq, o.wood || '#5b3a26', o.roof || '#383a40', o.wall || '#e4d8c2', o.sign || '客栈');
    if (o.bank) {
      const bh = (o.bankH ?? 90), bt = innBankTex(sq, bh, o.stone || '#6c6a64');
      blit(g, bt, x - 230 * s, y - 2, 460 * s, (bh + 4) * s);
    }
    putHazed(g, img, x - 240 * s, y - 350 * s, 480 * s, 360 * s, o.haze || '#c8ccd4', o.hazeA || 0);
    const L = (lx, ly, w, h) => [x + lx * s, y + ly * s, w * s, h * s];
    // 门里与窗纸的暖光
    if (lit > 0) {
      K.lighter(g, () => {
        g.fillStyle = K.lin(g, 0, y - 112 * s, 0, y, [[0, rgba('#ff9a48', 0.25 * lit)], [1, rgba('#ffcf80', 0.55 * lit)]]);
        g.fillRect(x - 56 * s, y - 112 * s, 112 * s, 100 * s);
        for (const lx of [-170 + 6 * 11.6, 66 + 2 * 11.6]) g.fillRect(x + lx * s, y - 112 * s, (lx < 0 ? 23 : 11.6) * s, 100 * s);
        glow(g, x, y - 40 * s, 95 * s, '#ffb060', 0.38 * lit);
      });
      const up = [];
      for (let k = 0; k < 6; k++) up.push(L(-152 + k * 51, -236, 45, 56));
      windowGlow(g, up, lit * 0.75, t, o.lightColor || '#ffb45a', 7, false);
    }
    E.lantern(g, { x: x - 20 * s, y: y - 122 * s, s: s * 0.9, t, lit, seed: 1, cord: 10 });
    E.lantern(g, { x: x + 120 * s, y: y - 122 * s, s: s * 0.9, t, lit, seed: 2, cord: 10 });
    // 酒旗：竹竿横挑，布幡从横杆垂下随风摆
    if (o.flag !== false) {
      const fs = o.flagSide ?? 1, px = x + fs * 236 * s, top = y - 340 * s;
      g.strokeStyle = '#4a3523'; g.lineCap = 'round'; g.lineWidth = 5 * s;
      g.beginPath(); g.moveTo(px, y); g.lineTo(px, top); g.stroke();
      g.lineWidth = 3 * s; g.beginPath(); g.moveTo(px, top + 8 * s); g.lineTo(px - fs * 60 * s, top + 4 * s); g.stroke();
      const flag = o.flag || '酒', fw = 48, fh = 128;
      const ftex = cached('wineflag', [flag, fontKey(flag)], fw, fh, Math.max(1, sq), (c) => {
        c.fillStyle = '#efe4c8'; c.fillRect(0, 0, fw, fh - 14);
        c.beginPath(); c.moveTo(0, fh - 14); c.lineTo(fw / 4, fh); c.lineTo(fw / 2, fh - 14); c.lineTo((fw * 3) / 4, fh); c.lineTo(fw, fh - 14); c.closePath(); c.fill();
        c.strokeStyle = '#b8352a'; c.lineWidth = 4; c.strokeRect(3, 3, fw - 6, fh - 20);
        c.fillStyle = 'rgba(120,90,50,0.12)'; for (let k = 0; k < 6; k++) c.fillRect(0, 14 + k * 16, fw, 1);
        glyphs(c, flag, fw / 2, (fh - 14) / 2, 34, '#1c1410');
      });
      g.save(); g.translate(px - fs * 56 * s, top + 6 * s);
      if (fs < 0) g.translate(-fw * s, 0);
      cloth(g, ftex, 0, 0, fw * s, fh * s, t, { amp: (4 + 10 * wind) * s, bias: 16 * wind * s, freq: 0.9, speed: 2.6 + wind * 2, n: 18, shade: 0.3 });
      g.restore();
    }
  };

  // ---------- 码头与乌篷船 ----------
  // 乌篷船侧面：两头上翘的船身，低矮的半圆筒篷（竖向竹篾箍、横向篾席纹、篷顶一线受光）
  function wupengTex(col) {
    return inked('wupeng', [col], 300, 110, 1, (g) => {
      const y = 82, dk = shade(col, -0.5);
      g.fillStyle = K.lin(g, 0, y - 20, 0, y + 14, [[0, shade(col, 0.15)], [1, dk]]);
      g.beginPath(); g.moveTo(8, y - 22); g.quadraticCurveTo(40, y + 10, 150, y + 12); g.quadraticCurveTo(250, y + 10, 294, y - 26);
      g.lineTo(286, y - 18); g.quadraticCurveTo(240, y - 4, 150, y - 4); g.quadraticCurveTo(50, y - 4, 16, y - 14); g.closePath(); g.fill();
      g.strokeStyle = rgba('#e8d8b8', 0.25); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(20, y - 12); g.quadraticCurveTo(150, y - 2, 282, y - 16); g.stroke();
      const canopy = (a, b, hgt, c2) => {
        const shape = () => { g.beginPath(); g.moveTo(a, y - 4); g.lineTo(a, y - 4 - hgt * 0.55); g.quadraticCurveTo(a + 2, y - 4 - hgt, a + (b - a) * 0.22, y - 4 - hgt); g.lineTo(b - (b - a) * 0.22, y - 4 - hgt); g.quadraticCurveTo(b - 2, y - 4 - hgt, b, y - 4 - hgt * 0.55); g.lineTo(b, y - 4); g.closePath(); };
        shape(); g.fillStyle = K.lin(g, 0, y - 4 - hgt, 0, y - 4, [[0, shade(c2, 0.2)], [0.35, c2], [1, shade(c2, -0.3)]]); g.fill();
        g.save(); shape(); g.clip();
        // 横向篾席纹
        g.strokeStyle = 'rgba(200,190,160,0.12)'; g.lineWidth = 0.8;
        for (let yy = y - 4 - hgt + 3; yy < y - 4; yy += 2.6) { g.beginPath(); g.moveTo(a, yy); g.lineTo(b, yy); g.stroke(); }
        // 竖向竹箍
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.6;
        for (let k = 1; k < 5; k++) { const xx = lerp(a, b, k / 5); g.beginPath(); g.moveTo(xx, y - 4 - hgt); g.lineTo(xx, y - 4); g.stroke(); }
        g.strokeStyle = 'rgba(220,200,160,0.18)'; g.lineWidth = 0.8;
        for (let k = 1; k < 5; k++) { const xx = lerp(a, b, k / 5) - 1.6; g.beginPath(); g.moveTo(xx, y - 4 - hgt); g.lineTo(xx, y - 4); g.stroke(); }
        g.restore();
        g.strokeStyle = 'rgba(230,220,200,0.4)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(a + (b - a) * 0.15, y - 3.4 - hgt); g.lineTo(b - (b - a) * 0.15, y - 3.4 - hgt); g.stroke();
      };
      canopy(66, 132, 30, '#1f1f22'); canopy(176, 226, 26, '#1f1f22'); canopy(118, 192, 38, '#26262a');
    }, { w: 0.9, a: 0.5, grain: 0.25 });
  }
  // 码头：木栈桥伸入水中，(x, y) 为桥头靠水一端的水面点；side -1 栈桥朝左伸回岸；boat 是否停船，boatX 船位；lit 船灯
  E.dock = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 560, s = o.s ?? 1, t = o.t || 0, side = o.side ?? -1, len = (o.len ?? 360) * s;
    const wood = o.wood || '#4a3628', deck = y - 18 * s;
    const xa = side < 0 ? x - len : x, xb = side < 0 ? x : x + len;
    // 桩与倒影：倒影是一道竖向晃动、往下渐淡的影子
    for (let px = xa + 10 * s; px <= xb; px += 46 * s) {
      g.fillStyle = shade(wood, -0.3); g.fillRect(px - 3 * s, deck, 6 * s, 30 * s);
      g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(px - 3 * s, deck, 1.5 * s, 30 * s);
      const gr = g.createLinearGradient(0, y + 10 * s, 0, y + 54 * s);
      gr.addColorStop(0, rgba(shade(wood, -0.45), 0.5)); gr.addColorStop(1, rgba(shade(wood, -0.45), 0));
      g.strokeStyle = gr; g.lineWidth = 4.5 * s; g.lineCap = 'butt';
      g.beginPath();
      for (let k = 0; k <= 10; k++) { const yy = y + 10 * s + k * 4.4 * s, wx = px + Math.sin(t * 2.2 + k * 0.7 + px * 0.05) * (0.6 + k * 0.25) * s; k ? g.lineTo(wx, yy) : g.moveTo(wx, yy); }
      g.stroke();
    }
    g.lineCap = 'round';
    g.fillStyle = K.lin(g, 0, deck - 4 * s, 0, deck + 8 * s, [[0, shade(wood, 0.25)], [1, shade(wood, -0.3)]]);
    g.fillRect(xa, deck - 4 * s, xb - xa, 10 * s);
    g.strokeStyle = rgba(shade(wood, -0.5), 0.6); g.lineWidth = 1;
    for (let px = xa; px < xb; px += 12 * s) { g.beginPath(); g.moveTo(px, deck - 4 * s); g.lineTo(px, deck + 6 * s); g.stroke(); }
    // 系船桩
    const mx = side < 0 ? xb - 16 * s : xa + 16 * s;
    g.fillStyle = shade(wood, -0.2); g.fillRect(mx - 4 * s, deck - 22 * s, 8 * s, 20 * s);
    g.fillStyle = shade(wood, 0.2); g.fillRect(mx - 5 * s, deck - 24 * s, 10 * s, 3 * s);
    if (o.boat !== false) {
      const bx = o.boatX ?? x + side * len * 0.5, by = y + (o.boatY ?? 26) * s + Math.sin(t * 1.2) * 2.2 * s, rot = Math.sin(t * 0.9) * 0.015;
      // 船影
      g.fillStyle = rgba('#000000', 0.25);
      g.beginPath(); g.ellipse(bx, by + 12 * s, 140 * s, 10 * s, 0, 0, TAU); g.fill();
      const bow = bx - side * 135 * s;
      g.strokeStyle = rgba('#2a2018', 0.7); g.lineWidth = 1.2 * s;
      g.beginPath(); g.moveTo(mx, deck - 14 * s); g.quadraticCurveTo((mx + bow) / 2, Math.max(deck, by - 10 * s) + 10 * s, bow, by - 22 * s); g.stroke();
      g.save(); g.translate(bx, by); g.rotate(rot);
      const img = wupengTex(o.boatColor || '#3a2c22');
      g.drawImage(img, -150 * s, -82 * s, 300 * s, 110 * s);
      // 船尾的橹
      g.strokeStyle = '#2a1e16'; g.lineWidth = 3 * s;
      const oa = 0.35 + Math.sin(t * 1.4) * 0.08;
      g.beginPath(); g.moveTo(120 * s, -30 * s); g.lineTo(120 * s + Math.cos(oa) * 110 * s, -30 * s + Math.sin(oa) * 110 * s); g.stroke();
      if (o.lit) E.lantern(g, { x: -128 * s, y: -46 * s, s: s * 0.55, t, lit: o.lit, seed: 5, cord: 8, swing: 0.1 });
      g.restore();
    }
  };

  // ---------- 水月宫 ----------
  function gauzeTex(col) {
    return cached('gauze', [col], 40, 100, 1, (g) => {
      g.fillStyle = K.lin(g, 0, 0, 0, 100, [[0, rgba(col, 0.75)], [0.6, rgba(col, 0.42)], [1, rgba(col, 0.2)]]);
      g.fillRect(0, 0, 40, 100);
      for (let k = 0; k < 7; k++) { const x = 3 + k * 5.6; g.fillStyle = rgba('#ffffff', 0.18 + (k % 2) * 0.14); g.fillRect(x, 0, 1.6, 100); }
      g.fillStyle = rgba(col, 0.9); g.fillRect(0, 0, 40, 3);
    });
  }
  function palaceTex(sq, jade, roofC, gold, inner) {
    return cached('palace', [sq, jade, roofC, gold, inner], 720, 420, sq, (g) => {
      g.translate(360, 410);
      const js = shade(jade, -0.22), jd = mix(jade, '#7f93b0', 0.35);
      // 两层台基
      const terrace = (x0, x1, y0, y1) => {
        g.fillStyle = K.lin(g, 0, y1, 0, y0, [[0, shade(jade, 0.1)], [0.2, jade], [1, jd]]);
        g.fillRect(x0, y1, x1 - x0, y0 - y1);
        g.fillStyle = rgba('#ffffff', 0.55); g.fillRect(x0, y1, x1 - x0, 1.5);
        g.strokeStyle = rgba(js, 0.5); g.lineWidth = 0.8;
        for (let x = x0 + 18; x < x1; x += 36) { g.beginPath(); g.moveTo(x, y1 + 4); g.lineTo(x, y0 - 2); g.stroke(); }
      };
      terrace(-330, 330, 0, -26); terrace(-250, 250, -26, -52);
      // 正中台阶
      for (let k = 0; k < 8; k++) { const yy = -k * 6.5; g.fillStyle = k % 2 ? shade(jade, 0.05) : jd; g.fillRect(-40 + k * 1.2, yy - 6.5, 80 - k * 2.4, 6.5); }
      railing(g, -330, -48, -26, 14, shade(jade, 0.05), { gap: 22, caps: true });
      railing(g, 48, 330, -26, 14, shade(jade, 0.05), { gap: 22, caps: true });
      // 两侧回廊
      for (const sd of [-1, 1]) {
        for (let x = 125; x <= 235; x += 28) { g.fillStyle = jade; g.fillRect(sd * x - 2.5, -100, 5, 48); }
        roof(g, sd * 180, -100, 130, 16, { color: roofC, curl: 0.3, ridge: 0.95, tileW: 6, trim: gold });
      }
      // 两侧六角亭
      for (const sd of [-1, 1]) {
        const px = sd * 285;
        g.fillStyle = jd; g.fillRect(px - 40, -40, 80, 14);
        for (const cx of [-24, 24]) { g.fillStyle = jade; g.fillRect(px + cx - 3, -110, 6, 70); g.fillStyle = gold; g.fillRect(px + cx - 4, -112, 8, 4); }
        g.fillStyle = rgba(inner, 0.6); g.fillRect(px - 21, -106, 42, 64);
        railing(g, px - 36, px + 36, -40, 10, shade(jade, 0.05), { gap: 18 });
        roof(g, px, -110, 96, 54, { color: roofC, curl: 0.55, ridge: 0.04, tileW: 6, trim: gold });
        g.fillStyle = gold; g.beginPath(); g.moveTo(px, -186); g.lineTo(px - 4, -164); g.lineTo(px + 4, -164); g.closePath(); g.fill();
        g.beginPath(); g.arc(px, -168, 4, 0, TAU); g.fill();
      }
      // 主殿：一层六柱（柱间挂纱，见动态部分），重檐
      g.fillStyle = K.lin(g, 0, -150, 0, -52, [[0, mix(inner, '#ffffff', 0.4)], [1, inner]]);
      g.fillRect(-120, -150, 240, 98);
      railing(g, -240, -125, -52, 14, shade(jade, 0.05), { gap: 22, caps: true });
      railing(g, 125, 240, -52, 14, shade(jade, 0.05), { gap: 22, caps: true });
      for (const cx of [-110, -66, -22, 22, 66, 110]) {
        g.fillStyle = K.lin(g, cx - 4, 0, cx + 4, 0, [[0, shade(jade, 0.2)], [1, js]]);
        g.fillRect(cx - 4, -150, 8, 98);
        g.fillStyle = gold; g.fillRect(cx - 5.5, -152, 11, 5); g.fillRect(cx - 5, -56, 10, 3);
      }
      g.fillStyle = gold; g.fillRect(-124, -158, 248, 5);
      roof(g, 0, -158, 310, 34, { color: roofC, curl: 0.55, ridge: 0.98, tileW: 7, trim: gold });
      // 二层与顶檐
      g.fillStyle = jade; g.fillRect(-84, -232, 168, 46);
      for (let k = 0; k < 5; k++) lattice(g, -78 + k * 32, -226, 28, 36, js, mix(inner, '#ffffff', 0.5));
      railing(g, -92, 92, -186, 10, shade(jade, 0.05), { gap: 16 });
      roof(g, 0, -232, 262, 74, { color: roofC, curl: 0.45, ridge: 0.5, tileW: 8, trim: gold, pearl: gold, light: '#ffffff' });
    });
  }
  // 水月宫：(x, y) 为台基中点；s 缩放；jade 白玉色、roof 瓦色、gold 金饰、gauze 纱色（false 不画）、inner 殿内色；lit 0..1 殿内灯光；wind 纱的飘动；mist 台基雾色（false 不画）
  E.palace = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 560, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.6, wind = o.wind ?? 0.5;
    const jade = o.jade || o.color || '#eef0f0', gold = o.gold || '#d8b45c', inner = o.inner || '#cfdcea';
    const sq = sqOf(s);
    fade(g, o.alpha);
    if (lit > 0) K.lighter(g, () => glow(g, x, y - 150 * s, 230 * s, o.glowColor || '#ffe6c8', 0.3 * lit));
    const img = palaceTex(sq, jade, o.roof || '#7f93ab', gold, inner);
    putHazed(g, img, x - 360 * s, y - 410 * s, 720 * s, 420 * s, o.haze || '#c8ccd4', o.hazeA || 0);
    if (lit > 0) K.lighter(g, () => {
      g.fillStyle = rgba(o.glowColor || '#ffe6c8', 0.3 * lit); g.fillRect(x - 116 * s, y - 148 * s, 232 * s, 92 * s);
      for (let k = 0; k < 5; k++) glow(g, x + (-64 + k * 32) * s, y - 208 * s, 26 * s, '#ffd9a0', 0.4 * lit * (0.85 + 0.15 * flick(t * 0.4, k)));
      for (const sd of [-1, 1]) glow(g, x + sd * 285 * s, y - 80 * s, 50 * s, '#ffd9a0', 0.35 * lit);
    });
    // 柱间轻纱（gauze:false 不画，倒影里可省掉）
    if (o.gauze !== false) {
      const gz = gauzeTex(o.gauze || '#fff2f4');
      for (let k = 0; k < 5; k++) {
        const bx = x + (-106 + k * 44) * s;
        cloth(g, gz, bx, y - 148 * s, 36 * s, 86 * s, t + k * 0.7, { amp: (1.5 + 5 * wind) * s, bias: 4 * wind * s, freq: 0.8, speed: 1.8 + wind, n: 8, shade: 0 });
      }
      for (const sd of [-1, 1]) cloth(g, gz, x + sd * 285 * s - 20 * s, y - 106 * s, 40 * s, 60 * s, t + sd, { amp: (1 + 4 * wind) * s, bias: 3 * wind * s, n: 6, shade: 0 });
    }
    if (o.mist !== false) E.mist(g, { t, y: y - 6 * s, h: 70 * s, color: o.mist || '#f4f2f6', alpha: 0.55, speed: 6, seed: 3 });
  };

  // ---------- 擂台 ----------
  function arenaTex(sq, red, wood, gold, text) {
    return inked('arena', [sq, red, wood, gold, text, fontKey(text)], 620, 440, sq, (g) => {
      g.translate(310, 430);
      const dred = shade(red, -0.35), r = rng(17);
      // 台面：木板，近处宽、远处窄，几道磨亮的痕
      g.fillStyle = K.lin(g, 0, -116, 0, -96, [[0, shade(wood, 0.25)], [1, wood]]);
      g.beginPath(); g.moveTo(-250, -96); g.lineTo(250, -96); g.lineTo(222, -116); g.lineTo(-222, -116); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(wood, -0.4), 0.5); g.lineWidth = 0.8;
      for (let k = -10; k <= 10; k++) { g.beginPath(); g.moveTo(k * 25, -96); g.lineTo(k * 22.2, -116); g.stroke(); }
      g.fillStyle = rgba('#ffffff', 0.08); g.fillRect(-180, -108, 260, 3);
      // 台裙：红布带竖向褶光、金线云纹、垂幔波浪下摆
      g.fillStyle = K.lin(g, 0, -96, 0, 0, [[0, red], [1, dred]]);
      g.fillRect(-250, -96, 500, 96);
      for (let k = 0; k < 25; k++) { g.fillStyle = rgba(k % 2 ? '#000000' : '#ffffff', k % 2 ? 0.1 : 0.06); g.fillRect(-250 + k * 20 + r() * 4, -86, 7 + r() * 6, 86); }
      g.strokeStyle = rgba(gold, 0.55); g.lineWidth = 1.2;
      for (let k = 0; k < 8; k++) {
        const cx = -210 + k * 60, cy = -36;
        g.beginPath(); g.arc(cx, cy, 8, PI * 0.2, PI * 1.6); g.arc(cx + 9, cy - 2, 5, PI * 1.2, PI * 2.4); g.moveTo(cx - 16, cy + 8); g.quadraticCurveTo(cx, cy + 2, cx + 18, cy + 8); g.stroke();
      }
      g.fillStyle = gold; g.fillRect(-250, -96, 500, 5);
      g.fillStyle = shade(red, 0.12);
      g.beginPath(); g.moveTo(-250, -91);
      for (let k = 0; k < 10; k++) { const x0 = -250 + k * 50; g.quadraticCurveTo(x0 + 25, -50, x0 + 50, -91); }
      g.lineTo(250, -91); g.closePath(); g.fill();
      g.strokeStyle = gold; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-250, -91); for (let k = 0; k < 10; k++) { const x0 = -250 + k * 50; g.quadraticCurveTo(x0 + 25, -50, x0 + 50, -91); } g.stroke();
      for (let k = 0; k <= 10; k++) { g.fillStyle = gold; g.beginPath(); g.arc(-250 + k * 50, -88, 3, 0, TAU); g.fill(); g.strokeStyle = gold; g.lineWidth = 1; g.beginPath(); g.moveTo(-250 + k * 50, -86); g.lineTo(-250 + k * 50, -72); g.stroke(); }
      for (const px of [-250, 242]) { g.fillStyle = '#5a1a14'; g.fillRect(px, -100, 8, 100); }
      // 台阶（右侧）
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? shade(wood, -0.1) : wood; g.fillRect(250 + k * 9, -96 + k * 16, 40, 16); g.fillStyle = rgba('#ffffff', 0.12); g.fillRect(250 + k * 9, -96 + k * 16, 40, 1.5); }
      // 牌楼：两柱一梁一檐
      for (const px of [-214, 206]) {
        g.fillStyle = K.lin(g, px, 0, px + 8, 0, [[0, shade(red, 0.1)], [1, shade(red, -0.45)]]);
        g.fillRect(px, -386, 8, 272);
        g.fillStyle = gold; g.fillRect(px - 1, -300, 10, 4); g.fillRect(px - 1, -200, 10, 4);
        g.fillStyle = '#3a2a20'; g.fillRect(px - 5, -118, 18, 6);
      }
      g.fillStyle = dred; g.fillRect(-232, -392, 464, 18);
      g.fillStyle = gold; g.fillRect(-232, -392, 464, 3); g.fillRect(-232, -377, 464, 2);
      for (let k = 0; k < 9; k++) { g.strokeStyle = rgba(gold, 0.6); g.lineWidth = 1; g.strokeRect(-220 + k * 50, -388, 40, 9); }
      roof(g, 0, -392, 500, 34, { color: '#3a3438', curl: 0.7, ridge: 0.85, tileW: 7, trim: gold });
      // 横幅：比武招亲
      g.fillStyle = K.lin(g, 0, -370, 0, -326, [[0, shade(red, 0.15)], [1, dred]]);
      g.beginPath(); g.moveTo(-120, -372); g.lineTo(120, -372); g.lineTo(116, -326); g.lineTo(-116, -326); g.closePath(); g.fill();
      g.strokeStyle = gold; g.lineWidth = 2; g.strokeRect(-112, -368, 224, 38);
      glyphs(g, text, 0, -349, 30, '#f6d27a');
      // 梁下垂的红绸花幔
      for (const sd of [-1, 1]) {
        g.fillStyle = shade(red, 0.08);
        g.beginPath(); g.moveTo(sd * 120, -372); g.quadraticCurveTo(sd * 166, -300, sd * 210, -372); g.quadraticCurveTo(sd * 166, -318, sd * 120, -362); g.closePath(); g.fill();
        g.strokeStyle = rgba('#ffffff', 0.18); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(sd * 124, -366); g.quadraticCurveTo(sd * 166, -312, sd * 206, -368); g.stroke();
      }
      // 大红绸花：一朵层层叠叠的绸结，两侧小花
      const rosette = (bx, by, R) => {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU, px = bx + Math.cos(a) * R * 0.55, py = by + Math.sin(a) * R * 0.45;
          g.fillStyle = rad(g, px - R * 0.1, py - R * 0.15, 1, px, py, R * 0.55, [[0, shade(red, 0.35)], [0.6, red], [1, dred]]);
          g.beginPath(); g.ellipse(px, py, R * 0.5, R * 0.34, a, 0, TAU); g.fill();
        }
        g.fillStyle = rad(g, bx - R * 0.15, by - R * 0.15, 1, bx, by, R * 0.45, [[0, shade(red, 0.4)], [1, dred]]);
        g.beginPath(); g.arc(bx, by, R * 0.42, 0, TAU); g.fill();
        g.strokeStyle = rgba(shade(red, -0.5), 0.6); g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a + 0.7) * R * 0.3, by + Math.sin(a + 0.7) * R * 0.3, bx + Math.cos(a) * R * 0.42, by + Math.sin(a) * R * 0.42); g.stroke(); }
      };
      rosette(0, -318, 22); rosette(-120, -366, 11); rosette(120, -366, 11); rosette(-210, -372, 11); rosette(210, -372, 11);
      // 大鼓
      const dx = -190, dy = -116;
      g.fillStyle = '#3a2418'; g.fillRect(dx - 22, dy - 8, 4, 8); g.fillRect(dx + 18, dy - 8, 4, 8);
      g.fillStyle = K.lin(g, dx - 26, 0, dx + 26, 0, [[0, shade(red, -0.1)], [0.4, shade(red, 0.2)], [1, shade(red, -0.5)]]);
      g.beginPath(); g.ellipse(dx, dy - 30, 26, 24, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8d6b0'; g.beginPath(); g.ellipse(dx, dy - 52, 25, 6, 0, 0, TAU); g.fill();
      g.fillStyle = gold; for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(dx + k * 7, dy - 47 + Math.abs(k) * 0.6, 1.4, 0, TAU); g.fill(); }
      // 兵器架
      g.strokeStyle = '#3a2418'; g.lineWidth = 3; g.beginPath(); g.moveTo(150, -116); g.lineTo(150, -190); g.moveTo(200, -116); g.lineTo(200, -190); g.moveTo(144, -184); g.lineTo(206, -184); g.stroke();
      for (let k = 0; k < 4; k++) { g.strokeStyle = '#6a5a4a'; g.lineWidth = 2; g.beginPath(); g.moveTo(156 + k * 12, -118); g.lineTo(160 + k * 12, -212); g.stroke(); g.fillStyle = '#c8ccd0'; g.beginPath(); g.moveTo(160 + k * 12, -212); g.lineTo(157 + k * 12, -228); g.lineTo(163 + k * 12, -228); g.closePath(); g.fill(); g.fillStyle = red; g.fillRect(157 + k * 12, -212, 6, 4); }
    }, { w: 1.2, a: 0.55, grain: 0.3 });
  }
  // 擂台（比武招亲）：(x, y) 为台前地面中点；s 缩放；red 红绸色；text 横幅字；t、wind 绸带与彩旗飘动；lit 灯笼
  E.arena = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, s = o.s ?? 1, t = o.t || 0, wind = o.wind ?? 0.5, red = o.red || o.color || '#c22a24', gold = o.gold || '#e0b85a';
    const sq = sqOf(s);
    fade(g, o.alpha);
    const img = arenaTex(sq, red, o.wood || '#7a5236', gold, o.text || '比武招亲');
    putHazed(g, img, x - 310 * s, y - 430 * s, 620 * s, 440 * s, o.haze || '#c8ccd4', o.hazeA || 0);
    // 柱上垂下的长绸：贝塞尔飘带，弯得连续，不出台阶
    for (const [px, k] of [[-224, 0], [214, 1]]) {
      ribbonPath(g, x + px * s + 3 * s, y - 372 * s, 160 * s, 16 * s, t + k * 1.3, { amp: (3 + 9 * wind) * s, bias: 12 * wind * s, freq: 0.7, speed: 2.2 + wind * 2, color: red, taper: 0.3 });
      ribbonPath(g, x + px * s + 9 * s, y - 368 * s, 120 * s, 8 * s, t + k * 1.3 + 0.8, { amp: (2 + 7 * wind) * s, bias: 9 * wind * s, freq: 0.9, speed: 2.6 + wind * 2, color: shade(red, 0.15), taper: 0.5 });
    }
    // 台角彩旗
    const pen = cached('pennant', [red, gold], 60, 34, 1, (c) => {
      c.fillStyle = gold; c.beginPath(); c.moveTo(0, 0); c.lineTo(60, 17); c.lineTo(0, 34); c.closePath(); c.fill();
      c.fillStyle = red; c.beginPath(); c.moveTo(0, 4); c.lineTo(50, 17); c.lineTo(0, 30); c.closePath(); c.fill();
    });
    for (const [px, k] of [[-246, 0], [246, 1]]) {
      const bx = x + px * s, top = y - 196 * s;
      g.strokeStyle = '#3a2418'; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(bx, y - 96 * s); g.lineTo(bx, top); g.stroke();
      cloth(g, pen, bx, top, 56 * s, 32 * s, t * 1.3 + k, { axis: 'x', amp: (2 + 6 * wind) * s, freq: 1, speed: 4 + 3 * wind, n: 12, shade: 0.3 });
    }
    for (const [px, k] of [[-222, 3], [214, 4]]) E.lantern(g, { x: x + px * s, y: y - 374 * s, s: s * 0.8, t, lit: o.lit ?? 0.7, seed: k, cord: 6, swing: 0.08 * (0.5 + wind) });
  };

  // ---------- 茶楼 ----------
  function teaTex(sq, wood, roofC, flagless) {
    return inked('tea', [sq, wood, roofC, flagless ? 1 : 0], 480, 320, sq, (g) => {
      g.translate(240, 310);
      const dk = shade(wood, -0.45);
      // 吊脚与平台
      for (let px = -190; px <= 190; px += 38) { g.fillStyle = dk; g.fillRect(px - 3, -22, 6, 32); }
      g.fillStyle = K.lin(g, 0, -28, 0, -16, [[0, shade(wood, 0.25)], [1, dk]]); g.fillRect(-200, -28, 400, 12);
      // 屋里：暗底、桌凳、茶具
      g.fillStyle = K.lin(g, 0, -170, 0, -28, [[0, '#3a2a1e'], [1, '#2a1e16']]); g.fillRect(-180, -170, 360, 142);
      for (const tx of [-96, 92]) {
        g.fillStyle = dk; g.fillRect(tx - 42, -72, 84, 6); g.fillRect(tx - 36, -66, 4, 38); g.fillRect(tx + 32, -66, 4, 38);
        g.fillRect(tx - 64, -50, 18, 4); g.fillRect(tx + 46, -50, 18, 4);
        g.fillStyle = '#6f5a46'; g.beginPath(); g.ellipse(tx - 10, -80, 10, 8, 0, 0, TAU); g.fill(); g.fillRect(tx - 12, -92, 4, 5);
        g.beginPath(); g.moveTo(tx, -82); g.quadraticCurveTo(tx + 10, -86, tx + 12, -92); g.lineWidth = 2; g.strokeStyle = '#6f5a46'; g.stroke();
        for (const cx of [12, 24]) { g.fillStyle = '#d8ccb4'; g.fillRect(tx + cx, -78, 7, 6); }
      }
      // 竹帘卷起一半
      for (const [x0, x1] of [[-176, -64], [-56, 56], [64, 176]]) {
        g.fillStyle = '#b89a62'; g.fillRect(x0, -170, x1 - x0, 40);
        g.strokeStyle = 'rgba(80,60,30,0.45)'; g.lineWidth = 0.8;
        for (let yy = -168; yy < -130; yy += 3) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
        g.fillStyle = '#9a7d4a'; g.beginPath(); g.ellipse((x0 + x1) / 2, -128, (x1 - x0) / 2, 5, 0, 0, TAU); g.fill();
      }
      for (const px of [-186, -62, 58, 182]) { g.fillStyle = K.lin(g, px - 4, 0, px + 4, 0, [[0, shade(wood, 0.15)], [1, dk]]); g.fillRect(px - 4, -176, 8, 150); }
      railing(g, -196, 196, -28, 20, dk, { gap: 28 });
      roof(g, 0, -176, 450, 60, { color: roofC, curl: 0.6, ridge: 0.6, tileW: 8 });
    }, { w: 1, a: 0.5, grain: 0.28 });
  }
  // 茶楼（临水吊脚）：(x, y) 为平台下水面中点；s 缩放；lit 灯火；flag 茶旗字（false 不画）；steam 茶烟
  E.teahouse = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.7, wind = o.wind ?? 0.4;
    const sq = sqOf(s);
    fade(g, o.alpha);
    const img = teaTex(sq, o.wood || '#6a4a32', o.roof || '#3a3c40', o.flag === false);
    putHazed(g, img, x - 240 * s, y - 310 * s, 480 * s, 320 * s, o.haze || '#c8ccd4', o.hazeA || 0);
    if (lit > 0) K.lighter(g, () => {
      g.fillStyle = K.lin(g, 0, y - 130 * s, 0, y - 28 * s, [[0, rgba('#ff9a48', 0.05 * lit)], [1, rgba('#ffb060', 0.3 * lit)]]);
      g.fillRect(x - 180 * s, y - 128 * s, 360 * s, 100 * s);
      glow(g, x, y - 80 * s, 150 * s, '#ffb060', 0.28 * lit);
    });
    // 茶烟：细丝缓缓上升、左右摆
    if (o.steam !== false) {
      g.lineCap = 'round';
      for (const tx of [-106, 82]) for (let k = 0; k < 3; k++) {
        const ph = t * 0.6 + k * 0.33 + tx;
        g.strokeStyle = rgba('#f4efe6', 0.22 * (1 - k * 0.25)); g.lineWidth = 2 * s;
        g.beginPath();
        for (let i = 0; i <= 12; i++) { const u = i / 12, px = x + (tx + Math.sin(ph * 2 + u * 5) * 6 * u) * s, py = y - (92 + u * 60) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
    }
    E.lantern(g, { x: x - 150 * s, y: y - 176 * s, s: s * 0.75, t, lit, seed: 6, cord: 8 });
    E.lantern(g, { x: x + 150 * s, y: y - 176 * s, s: s * 0.75, t, lit, seed: 7, cord: 8 });
    if (o.flag !== false) {
      const px = x - 222 * s, top = y - 300 * s, flag = o.flag || '茶';
      g.strokeStyle = '#4a3523'; g.lineWidth = 4 * s; g.lineCap = 'round';
      g.beginPath(); g.moveTo(px, y - 20 * s); g.lineTo(px, top); g.stroke();
      const ft = cached('teaflag', [flag, fontKey(flag)], 44, 96, Math.max(1, sq), (c) => {
        c.fillStyle = '#3d6b5a'; c.fillRect(0, 0, 44, 84); c.beginPath(); c.moveTo(0, 84); c.lineTo(22, 96); c.lineTo(44, 84); c.fill();
        c.fillStyle = '#efe4c8'; c.fillRect(6, 10, 32, 64);
        glyphs(c, flag, 22, 42, 28, '#1c2a24');
      });
      g.save(); g.translate(px + 4 * s, top + 6 * s);
      cloth(g, ft, 0, 0, 44 * s, 96 * s, t, { amp: (3 + 8 * wind) * s, bias: 12 * wind * s, freq: 0.9, speed: 2.4 + wind * 2, n: 14, shade: 0.3 });
      g.restore();
    }
  };

  // ---------- 锁妖塔 ----------
  const TOWER_N = 7;
  function towerGeo(h) {
    const ws = [];
    let sum = 0;
    for (let k = 0; k < TOWER_N; k++) { const w = 1.15 - 0.06 * k; ws.push(w); sum += w; }
    const Ht = h * 0.74, base = h * 0.09, tiers = [];
    let y = -base;
    for (let k = 0; k < TOWER_N; k++) {
      const th = (Ht * ws[k]) / sum, bw = h * 0.19 * (1 - 0.065 * k);
      tiers.push({ k, y0: y, y1: y - th, th, bw, ew: bw * 1.55, eh: th * 0.3 });
      y -= th;
    }
    return { tiers, base, top: y, bw: h * 0.36 };
  }
  // 塔身一层（不含檐）：石块、左缘冷月光、拱窗；原点在该层底边中点，贴图底边留 6
  function towerBodyTex(hb, k, col, rim) {
    const T = towerGeo(hb).tiers[k], cw = T.bw + 12, ch = T.th + 12;
    return cached('towerBody', [hb, k, col, rim], cw, ch, 1, (g) => {
      g.translate(cw / 2, ch - 6);
      const bw = T.bw, th = T.th, r = rng(k * 19 + 3);
      g.fillStyle = K.lin(g, -bw / 2, 0, bw / 2, 0, [[0, mix(col, rim, 0.35)], [0.18, shade(col, 0.08)], [0.6, col], [1, shade(col, -0.5)]]);
      g.fillRect(-bw / 2, -th - 2, bw, th + 2);
      g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 1;
      for (let yy = -th + 7; yy < 0; yy += 9) {
        g.beginPath(); g.moveTo(-bw / 2, yy); g.lineTo(bw / 2, yy); g.stroke();
        for (let xx = -bw / 2 + ((yy / 9) % 2 ? 0 : 11); xx < bw / 2; xx += 22) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 9); g.stroke(); }
      }
      for (let i = 0; i < 14; i++) { g.fillStyle = rgba(r() < 0.5 ? '#000000' : rim, 0.06 + r() * 0.08); g.fillRect(-bw / 2 + r() * bw, -th + r() * th, 6 + r() * 14, 4 + r() * 6); }
      // 裂缝与苔痕
      g.strokeStyle = rgba('#000000', 0.4); g.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) { let px = -bw / 2 + r() * bw, py = -th + r() * th * 0.5; g.beginPath(); g.moveTo(px, py); for (let j = 0; j < 5; j++) { px += (r() - 0.5) * 6; py += 5 + r() * 6; g.lineTo(px, py); } g.stroke(); }
      const ww = bw * 0.22, wh = th * 0.42, wy = -th * 0.22;
      g.fillStyle = '#060807';
      g.beginPath(); g.moveTo(-ww / 2, wy); g.lineTo(-ww / 2, wy - wh + ww / 2); g.arc(0, wy - wh + ww / 2, ww / 2, PI, TAU); g.lineTo(ww / 2, wy); g.closePath(); g.fill();
      g.strokeStyle = shade(col, 0.25); g.lineWidth = 2; g.stroke();
    });
  }
  // 塔檐：深色、檐角尖翘，角上挂铃；原点在檐口线中点
  function towerEaveTex(hb, k, col, rim) {
    const T = towerGeo(hb).tiers[k], cw = T.ew + 40, ch = T.eh + 30;
    return cached('towerEave', [hb, k, col, rim], cw, ch, 1, (g) => {
      g.translate(cw / 2, T.eh + 8);
      const bw = T.bw, ew = T.ew, eh = T.eh;
      g.fillStyle = K.lin(g, 0, -eh, 0, 4, [[0, shade(col, -0.1)], [1, shade(col, -0.55)]]);
      g.beginPath();
      g.moveTo(-ew / 2 - 8, -eh * 0.75); g.quadraticCurveTo(-ew * 0.35, 4, -bw * 0.4, 3); g.lineTo(bw * 0.4, 3);
      g.quadraticCurveTo(ew * 0.35, 4, ew / 2 + 8, -eh * 0.75); g.lineTo(ew * 0.3, -eh * 0.55); g.lineTo(bw * 0.38, -eh);
      g.lineTo(-bw * 0.38, -eh); g.lineTo(-ew * 0.3, -eh * 0.55); g.closePath(); g.fill();
      g.strokeStyle = rgba(rim, 0.45); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-ew / 2 - 8, -eh * 0.75); g.lineTo(-ew * 0.3, -eh * 0.55); g.lineTo(-bw * 0.38, -eh); g.lineTo(bw * 0.2, -eh); g.stroke();
      g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = 1;
      for (let u = -0.45; u <= 0.45; u += 0.07) { g.beginPath(); g.moveTo(u * bw * 0.8, -eh); g.lineTo(u * ew * 0.95, 1); g.stroke(); }
      for (const sd of [-1, 1]) { g.strokeStyle = '#1a1c1c'; g.beginPath(); g.moveTo(sd * (ew / 2 + 6), -eh * 0.72); g.lineTo(sd * (ew / 2 + 6), -eh * 0.72 + 8); g.stroke(); g.fillStyle = '#6a6040'; g.beginPath(); g.arc(sd * (ew / 2 + 6), -eh * 0.72 + 10, 2.6, 0, TAU); g.fill(); }
    });
  }
  function towerBaseTex(hb, col, rim) {
    const G = towerGeo(hb), bw = G.bw, cw = bw * 2.6, ch = G.base + hb * 0.35;
    return cached('towerBase', [hb, col, rim], cw, ch, 1, (g) => {
      g.translate(cw / 2, ch - 2);
      const b = G.base;
      for (const [w, y0, y1] of [[bw, 0, -b * 0.5], [bw * 0.8, -b * 0.5, -b]]) {
        g.fillStyle = K.lin(g, -w / 2, 0, w / 2, 0, [[0, mix(col, rim, 0.3)], [0.5, col], [1, shade(col, -0.5)]]);
        g.fillRect(-w / 2, y1, w, y0 - y1);
        g.fillStyle = rgba(rim, 0.35); g.fillRect(-w / 2, y1, w, 1.5);
      }
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? shade(col, -0.15) : col; g.fillRect(-bw * 0.12 + k * 1.5, -k * (b / 6) - b / 6, bw * 0.24 - k * 3, b / 6); }
      // 镇妖铁链：从三层檐角拉到地桩
      const T = G.tiers[2];
      for (const sd of [-1, 1]) {
        const x0 = sd * (T.ew / 2 + 2), y0 = T.y1 - T.eh * 0.6, x1 = sd * bw * 1.15, y1 = -4;
        g.fillStyle = '#2a2a2c'; g.fillRect(x1 - 5, -16, 10, 16);
        const n = 26;
        for (let i = 0; i <= n; i++) {
          const u = i / n, px = lerp(x0, x1, u), py = lerp(y0, y1, u) + Math.sin(u * PI) * hb * 0.04;
          g.strokeStyle = i % 2 ? '#3a3a3e' : '#24242a'; g.lineWidth = 2.2;
          g.beginPath(); g.ellipse(px, py, i % 2 ? 4.5 : 1.6, i % 2 ? 2.4 : 3.6, Math.atan2(y1 - y0, x1 - x0), 0, TAU); g.stroke();
          if (i % 3 === 0) { g.strokeStyle = rgba(rim, 0.3); g.lineWidth = 1; g.beginPath(); g.arc(px, py - 1, 2, PI, TAU); g.stroke(); }
        }
      }
    });
  }
  function talismanTex() {
    return cached('talisman', [], 14, 46, 2, (g) => {
      g.fillStyle = '#d9b84a'; g.fillRect(0, 0, 14, 46);
      g.fillStyle = 'rgba(120,80,20,0.25)'; g.fillRect(0, 40, 14, 6);
      g.strokeStyle = '#a3241c'; g.lineWidth = 1.1;
      g.beginPath(); for (let j = 0; j < 6; j++) { const yy = 5 + j * 6; g.moveTo(3, yy); g.lineTo(11, yy + 2); g.lineTo(4, yy + 4); } g.stroke();
      g.fillStyle = '#a3241c'; g.fillRect(4, 1.5, 6, 2);
    });
  }
  // 锁妖塔：(x, y) 为塔基中点；h 总高（可逐帧变，按 32 分档建图再缩放）；color 石色；rim 冷月轮廓光；glow 窗中幽光色；lit 0..1 窗光；
  // broken 0..1：先震颤、裂口透光，再上半截整体倾倒（不散开），落地时摔成几块滚到一边停住，碎石飞溅、烟尘被裂光照亮；
  // crack 断裂的层号，dir 倒向（1 右、-1 左）；dust 烟尘色；wisps 0..1 窗口飘出的妖气；alpha 整体透明度；lightDir -1 月光从左（默认）| 1 从右
  E.tower = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, h = o.h ?? 520, t = o.t || 0, col = o.color || '#262a2e', rim = o.rim || '#8fa6c8';
    const glowC = o.glow || '#7dffb4', lit = o.lit ?? 0.8, b = clamp(o.broken || 0), kc = clamp(Math.round(o.crack ?? 3), 1, TOWER_N - 1);
    // lightDir 1：月光从右来，整座塔镜像着画；倒向 dir 仍按画面方向
    const ldir = (o.lightDir ?? -1) > 0 ? -1 : 1, dir = ((o.dir ?? 1) < 0 ? -1 : 1) * ldir;
    fade(g, o.alpha);
    const hb = bucket(h, 32), k0 = h / hb, G = towerGeo(hb), sc = hb / 520;
    // 将塌未塌时整体颤动
    const quake = b > 0 && b < 0.35 ? Math.sin((b / 0.35) * PI) * 8 * sc : 0;
    const qx = quake * (noise1(t * 30, 3) - 0.5), qy = quake * 0.4 * (noise1(t * 30, 4) - 0.5);
    g.save(); g.translate(x + qx, y + qy); g.scale(k0 * ldir, k0);
    const base = towerBaseTex(hb, col, rim);
    blit(g, base, -base.lw / 2, -base.lh + 2, base.lw, base.lh);
    // 铁链上一点流光
    K.lighter(g, () => {
      const T = G.tiers[2];
      for (const sd of [-1, 1]) {
        const u = ((t * 0.12 + (sd > 0 ? 0.5 : 0)) % 1), x0 = sd * (T.ew / 2 + 2), y0 = T.y1 - T.eh * 0.6, x1 = sd * G.bw * 1.15;
        glow(g, lerp(x0, x1, u), lerp(y0, -4, u) + Math.sin(u * PI) * hb * 0.04, 10 * sc, rim, 0.5 * Math.sin(u * PI));
      }
    });
    const crackY = G.tiers[kc].y0;
    const body = (k) => towerBodyTex(hb, k, col, rim), eave = (k) => towerEaveTex(hb, k, col, rim);
    const drawBody = (k) => { const T = G.tiers[k], im = body(k); g.drawImage(im, -im.lw / 2, T.y0 - im.lh + 6, im.lw, im.lh); };
    const drawEave = (k) => { const T = G.tiers[k], im = eave(k); g.drawImage(im, -im.lw / 2, T.y1 - T.eh - 8, im.lw, im.lh); };
    const drawSpire = () => {
      const T = G.tiers[TOWER_N - 1], ty = T.y1 - T.eh;
      g.fillStyle = shade(col, -0.2);
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, ty - i * hb * 0.018, hb * 0.03 * (1 - i * 0.12), hb * 0.008, 0, 0, TAU); g.fill(); }
      g.fillRect(-1.5, ty - hb * 0.14, 3, hb * 0.06);
      g.beginPath(); g.arc(0, ty - hb * 0.145, hb * 0.012, 0, TAU); g.fill();
    };
    const winGlow = (k, f0 = 1) => {
      if (lit <= 0) return;
      const T = G.tiers[k], f = (0.75 + 0.25 * flick(t * 0.6, k * 3)) * f0;
      K.lighter(g, () => { glow(g, 0, T.y0 - T.th * 0.4, T.bw * 0.34, glowC, 0.32 * lit * f); glow(g, 0, T.y0 - T.th * 0.4, T.bw * 0.1, '#e8fff0', 0.45 * lit * f); });
    };
    // 符纸：贴在窗两侧，下端随风翻动
    const tal = talismanTex();
    const talismans = (k) => {
      const T = G.tiers[k], ww = T.bw * 0.22;
      for (const sd of [-1, 1]) {
        const fx = sd * (ww / 2 + T.bw * 0.12) - T.bw * 0.035, fy = T.y0 - T.th * 0.75, fw = T.bw * 0.07, fh = T.th * 0.5;
        cloth(g, tal, fx, fy, fw, fh, t * 1.4 + k + sd, { amp: (1 + 2.5 * (o.wind ?? 0.5)) * sc, bias: sd * 1.5 * sc, freq: 0.6, speed: 3, n: 8, shade: 0.25, pow: 1.6 });
      }
    };
    // 断后的残桩：断层以下完好；断层那一层只剩参差的下半截（不带檐），断口里透出幽光
    const stumpTop = kc - 1, broke = b > 0.3;
    for (let k = 0; k < (broke ? stumpTop : TOWER_N); k++) {
      drawBody(k); talismans(k); drawEave(k); winGlow(k);
      if (!broke && k === TOWER_N - 1) drawSpire();
    }
    const jag = [];
    { const T = G.tiers[stumpTop]; for (let i = 0; i <= 10; i++) jag.push([-T.bw / 2 - 2 + (i / 10) * (T.bw + 4), T.y1 + T.th * (0.12 + 0.38 * h2(i, 9 + kc))]); }
    if (broke) {
      const T = G.tiers[stumpTop];
      g.save(); g.beginPath(); g.moveTo(-T.bw, T.y0 + 4); jag.forEach(([px, py]) => g.lineTo(px, py)); g.lineTo(T.bw, T.y0 + 4); g.closePath(); g.clip();
      drawBody(stumpTop); winGlow(stumpTop);
      g.restore();
      g.strokeStyle = shade(col, -0.5); g.lineWidth = 2.5; g.beginPath(); jag.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      K.lighter(g, () => {
        const f = 0.7 + 0.3 * flick(t * 0.8, 5);
        jag.forEach(([px, py], i) => { if (i % 2) glow(g, px, py + 3, T.bw * 0.22, glowC, 0.35 * f); });
        glow(g, 0, T.y1 + T.th * 0.3, T.bw * 1.4, glowC, 0.28 * f);
      });
    } else if (b > 0) {
      // 裂缝在断层处一点点张开、透光
      const w = clamp(b / 0.3);
      g.strokeStyle = rgba(mix(glowC, '#ffffff', 0.4), 0.5 + 0.5 * w); g.lineWidth = 1 + 2.5 * w;
      g.beginPath(); jag.forEach(([px, py], i) => { if (i / 10 <= w * 1.2) (i ? g.lineTo(px, py - G.tiers[stumpTop].th * 0.1) : g.moveTo(px, py - G.tiers[stumpTop].th * 0.1)); }); g.stroke();
      K.lighter(g, () => glow(g, 0, crackY + 6, G.tiers[kc].bw * (0.8 + w), glowC, 0.45 * w));
    }
    // 倾倒的上半截：断层的檐 + 以上各层 + 塔刹，绕倒向一侧的断口整体转动
    const fallIdx = [];
    for (let k = kc; k < TOWER_N; k++) fallIdx.push(k);
    const drawFalling = (from, to) => {
      for (let k = from; k <= to; k++) { if (k === kc) drawEave(stumpTop); drawBody(k); drawEave(k); winGlow(k, 0.6); if (k === TOWER_N - 1) drawSpire(); }
    };
    const pvx = dir * G.tiers[kc].bw * 0.5, pvy = crackY;
    const qf = clamp((b - 0.3) / 0.45), th0 = dir * 1.25 * qf * qf, c = -crackY;
    const fallT = (q) => [dir * 0.3 * c * q * q, c * 0.82 * q * q];
    if (broke && b < 0.75) {
      const [tx, ty] = fallT(qf);
      g.save(); g.translate(pvx + tx, pvy + ty); g.rotate(th0); g.translate(-pvx, -pvy);
      drawFalling(kc, TOWER_N - 1);
      g.restore();
    } else if (b >= 0.75) {
      // 落地：摔成几块（每块一两层），各自滚开、弹一下，然后停住，不再淡出
      const u = smooth((b - 0.75) / 0.2), eo = 1 - Math.pow(1 - u, 3), the = dir * 1.25, [tx, ty] = fallT(1);
      const groups = [];
      for (let i = 0; i < fallIdx.length; i += 2) groups.push(fallIdx.slice(i, i + 2));
      groups.forEach((gr, j) => {
        const k0g = gr[0], k1g = gr[gr.length - 1], cy0 = (G.tiers[k0g].y0 + G.tiers[k1g].y1) / 2;
        // 落地瞬间这一块中心的位置
        const dx0 = 0 - pvx, dy0 = cy0 - pvy, ix = pvx + tx + dx0 * Math.cos(the) - dy0 * Math.sin(the), iy = pvy + ty + dx0 * Math.sin(the) + dy0 * Math.cos(the);
        const rx = ix + dir * (12 + 26 * h2(j, 7)) * sc * (j + 1), ry = -G.tiers[k0g].bw * 0.32 - 4 * sc;
        const px = lerp(ix, rx, eo), py = lerp(iy, ry, eo) - Math.sin(u * PI) * (30 - j * 6) * sc * (1 - u * 0.5);
        const rot = the + dir * (0.25 + 0.35 * h2(j, 8)) * eo * (j % 2 ? -1 : 1) + dir * 0.32 * eo;
        g.save(); g.translate(px, py); g.rotate(rot); g.translate(0, -cy0);
        // 断成块：上下边参差
        const T0 = G.tiers[k0g], T1 = G.tiers[k1g], hwid = T0.ew / 2 + 12;
        g.beginPath(); g.moveTo(-hwid, T0.y0 - T0.th * 0.1 * h2(j, 1));
        for (let i = 1; i <= 6; i++) g.lineTo(-hwid + (i / 6) * hwid * 2, T0.y0 - T0.th * (0.05 + 0.25 * h2(i, j + 3)));
        g.lineTo(hwid, T1.y1 - T1.eh - (k1g === TOWER_N - 1 ? hb * 0.16 : 0));
        g.lineTo(-hwid, T1.y1 - T1.eh - (k1g === TOWER_N - 1 ? hb * 0.16 : 0)); g.closePath(); g.clip();
        drawFalling(k0g, k1g);
        g.restore();
      });
    }
    if (b > 0) {
      const tau = b * 2.4, rimC = mix(glowC, rim, 0.4);
      // 碎石：从断口抛出，落到地上停住；向着裂光的一侧描一道亮边
      for (let i = 0; i < 60; i++) {
        const t0 = 0.25 + h2(i, 21) * 0.8;
        if (tau < t0) continue;
        const tt = tau - t0, vx = (h2(i, 22) - 0.5 + 0.3 * dir) * 300 * sc, vy = -h2(i, 23) * 160 * sc;
        const rr = (2 + h2(i, 25) * 7) * sc, ground = -rr * 0.6;
        let px = (h2(i, 24) - 0.5) * G.tiers[kc].bw + vx * tt, py = crackY + vy * tt + 260 * sc * tt * tt, rot = tt * (2 + h2(i, 26) * 4);
        if (py > ground) {
          // 落地后停住：解出落地时刻
          const A2 = 260 * sc, B2 = vy, C2 = crackY - ground, land = (-B2 + Math.sqrt(Math.max(0, B2 * B2 - 4 * A2 * C2))) / (2 * A2);
          px = (h2(i, 24) - 0.5) * G.tiers[kc].bw + vx * land; py = ground; rot = land * (2 + h2(i, 26) * 4);
        }
        g.save(); g.translate(px, py); g.rotate(rot);
        g.fillStyle = mix(col, rim, 0.25);
        g.beginPath(); g.moveTo(-rr, -rr * 0.6); g.lineTo(rr * 0.8, -rr); g.lineTo(rr, rr * 0.5); g.lineTo(-rr * 0.4, rr); g.closePath(); g.fill();
        g.strokeStyle = rgba(rimC, 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(-rr, -rr * 0.6); g.lineTo(rr * 0.8, -rr); g.stroke();
        g.restore();
      }
      // 散飞的符纸
      for (let i = 0; i < 6; i++) {
        const tt = tau - 0.4 - h2(i, 51) * 0.6;
        if (tt < 0) continue;
        const px = (h2(i, 52) - 0.5) * G.bw * 2 + Math.sin(tt * 3 + i) * 30 * sc + dir * tt * 60 * sc, py = crackY - 20 * sc + tt * 90 * sc;
        if (py > -4) continue;
        g.save(); g.translate(px, py); g.rotate(Math.sin(tt * 4 + i) * 0.8); g.scale(Math.cos(tt * 5 + i), 1);
        g.drawImage(tal, -4 * sc, -12 * sc, 8 * sc, 24 * sc);
        g.restore();
      }
      // 烟尘：灰色的团，被裂口的光从里面照亮
      const dust = o.dust || '#8c8a90';
      for (let i = 0; i < 14; i++) {
        const uu = h2(i, 31), q = clamp(b * 1.4 - uu * 0.4);
        if (q <= 0) continue;
        const px = (h2(i, 32) - 0.5) * G.bw * 2.4 * q + dir * q * 60 * sc, py = lerp(crackY, -10, h2(i, 33)) - q * 30 * sc;
        glow(g, px, py, (60 + 120 * q) * sc, dust, 0.35 * Math.sin(PI * clamp(q)) + 0.12 * q);
        if (i % 2) K.lighter(g, () => glow(g, px, py, (40 + 60 * q) * sc, glowC, 0.12 * Math.sin(PI * clamp(q))));
      }
      if (b > 0.6) {
        // 塔下堆起的乱石：顶上一线被裂光照亮
        const pile = smooth((b - 0.6) / 0.4);
        for (let i = 0; i < 18; i++) {
          const px = (h2(i, 41) - 0.5) * G.bw * 2.2 + dir * 40 * sc, rr = (8 + h2(i, 42) * 18) * sc * pile;
          g.fillStyle = mix(col, rim, 0.12); A.inkBlob(g, px, -rr * 0.4, rr, i, 0.35); g.fill();
          g.strokeStyle = rgba(rimC, 0.45); g.lineWidth = 1.2; g.beginPath(); g.arc(px, -rr * 0.4, rr * 0.9, PI * 1.15, PI * 1.75); g.stroke();
        }
      }
    }
    // 妖气：窗口里飘出的幽绿烟缕，绕着塔身慢慢升
    const wp = o.wisps ?? 0.6;
    if (wp > 0 && lit > 0) K.lighter(g, () => {
      const nT = broke ? stumpTop : TOWER_N;
      for (let i = 0; i < 12; i++) {
        const k = i % nT, T = G.tiers[k], P = 5 + h2(i, 61) * 3, q = ((t + h2(i, 62) * P) % P) / P;
        const px = Math.sin(q * 3 + i) * T.bw * (0.2 + q * 0.6), py = T.y0 - T.th * 0.45 - q * T.th * 1.6;
        glow(g, px, py, T.bw * (0.12 + q * 0.25), glowC, wp * 0.22 * Math.sin(q * PI) * lit);
      }
    });
    g.restore();
  };

  // ---------- 女娲庙与女娲像 ----------
  // 石材填色：左上受光、右侧背光，rim 为金色轮廓光
  function stoneFill(g, x0, x1, col, rim) {
    return K.lin(g, x0, 0, x1, 0, [[0, mix(col, rim, 0.45)], [0.25, shade(col, 0.15)], [0.65, col], [1, shade(col, -0.45)]]);
  }
  function nuwaTex(col, rim) {
    return cached('nuwa', [col, rim], 560, 620, 1, (g) => {
      g.translate(280, 610);
      g.lineJoin = 'round'; g.lineCap = 'round';
      const fold = rgba(shade(col, -0.5), 0.38), hi = rgba(mix(col, rim, 0.5), 0.5);
      // 莲台石座
      g.fillStyle = K.lin(g, 0, -46, 0, 0, [[0, shade(col, 0.1)], [1, shade(col, -0.45)]]);
      g.beginPath(); g.ellipse(0, -18, 170, 26, 0, 0, TAU); g.fill();
      g.fillRect(-170, -18, 340, 18);
      g.beginPath(); g.ellipse(0, 0, 170, 16, 0, 0, PI); g.fill();
      for (let k = -6; k <= 6; k++) {
        g.fillStyle = stoneFill(g, k * 26 - 14, k * 26 + 14, shade(col, -0.05), rim);
        g.beginPath(); g.moveTo(k * 26 - 15, -34); g.quadraticCurveTo(k * 26, -66 + Math.abs(k) * 2, k * 26 + 15, -34); g.closePath(); g.fill();
        g.strokeStyle = rgba(shade(col, -0.5), 0.4); g.lineWidth = 1; g.stroke();
        g.strokeStyle = rgba(shade(col, -0.45), 0.3); g.beginPath(); g.moveTo(k * 26, -38); g.lineTo(k * 26, -56 + Math.abs(k) * 2); g.stroke();
      }
      // 蛇尾：沿 S 形脊线由粗到细，鳞纹、腹甲
      const spine = [[0, -250], [-26, -196], [10, -140], [96, -96], [104, -62], [48, -46], [-60, -46], [-140, -64], [-176, -102], [-168, -142], [-140, -156]];
      const P = (u) => {
        const f = u * (spine.length - 1), i = Math.min(spine.length - 2, Math.floor(f)), q = f - i;
        const p0 = spine[Math.max(0, i - 1)], p1 = spine[i], p2 = spine[i + 1], p3 = spine[Math.min(spine.length - 1, i + 2)];
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * q + (2 * a - 5 * b + 4 * c - d) * q * q + (-a + 3 * b - 3 * c + d) * q * q * q);
        return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
      };
      const R = (u) => lerp(36, 5, Math.pow(u, 1.15));
      const N = 140, pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, [px, py] = P(u), [ax, ay] = P(Math.max(0, u - 0.004)), [bx, by] = P(Math.min(1, u + 0.004));
        let tx = bx - ax, ty = by - ay; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const Lx = -0.6, Ly = -0.8, d = Lx * tx + Ly * ty;
        pts.push({ px, py, r: R(u), nx: -ty, ny: tx, lx: Lx - d * tx, ly: Ly - d * ty });
      }
      const band = (c0, c1, fill) => {
        g.beginPath();
        pts.forEach((q, i) => { const X = q.px + q.lx * q.r * c0, Y = q.py + q.ly * q.r * c0; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
        for (let i = N; i >= 0; i--) { const q = pts[i]; g.lineTo(q.px + q.lx * q.r * c1, q.py + q.ly * q.r * c1); }
        g.closePath(); g.fillStyle = fill; g.fill();
      };
      const tube = () => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.px + q.nx * q.r, q.py + q.ny * q.r) : g.moveTo(q.px + q.nx * q.r, q.py + q.ny * q.r))); for (let i = N; i >= 0; i--) { const q = pts[i]; g.lineTo(q.px - q.nx * q.r, q.py - q.ny * q.r); } g.closePath(); };
      tube(); g.fillStyle = col; g.fill();
      g.save(); tube(); g.clip();
      band(-1.4, -0.2, rgba(shade(col, -0.45), 0.35)); band(-1.4, -0.55, rgba(shade(col, -0.5), 0.35));
      band(0.15, 0.95, rgba(mix(col, rim, 0.35), 0.4)); band(0.35, 0.8, rgba(mix(col, rim, 0.6), 0.4));
      for (let i = 2; i < N; i += 2) {
        const q = pts[i];
        if (q.r < 8) continue;
        for (let k = -2; k <= 2; k++) {
          if ((i / 2 + k) % 2) continue;
          const sx = q.px + q.nx * q.r * k * 0.36, sy = q.py + q.ny * q.r * k * 0.36, sr = q.r * 0.17, a = Math.atan2(q.ny, q.nx) - PI / 2;
          g.strokeStyle = rgba(shade(col, -0.5), 0.16); g.lineWidth = 0.8;
          g.beginPath(); g.arc(sx, sy, sr, a - PI * 0.4, a + PI * 0.4); g.stroke();
        }
      }
      g.restore();
      tube(); g.strokeStyle = rgba(shade(col, -0.55), 0.35); g.lineWidth = 1.2; g.stroke();
      // 长发垂在身后，发梢分缕
      g.fillStyle = shade(col, -0.35);
      for (const sd of [-1, 1]) {
        g.beginPath(); g.moveTo(sd * 22, -436); g.bezierCurveTo(sd * 62, -400, sd * 70, -330, sd * 58, -286);
        g.quadraticCurveTo(sd * 50, -276, sd * 44, -292); g.quadraticCurveTo(sd * 40, -280, sd * 34, -296); g.lineTo(sd * 18, -404); g.closePath(); g.fill();
      }
      // 披帛：绕过肘弯，向两侧舒展成 S 形
      for (const sd of [-1, 1]) {
        g.fillStyle = stoneFill(g, sd < 0 ? -210 : 40, sd < 0 ? -40 : 210, shade(col, 0.05), rim);
        g.beginPath();
        g.moveTo(sd * 54, -372);
        g.bezierCurveTo(sd * 96, -330, sd * 92, -286, sd * 128, -262);
        g.bezierCurveTo(sd * 168, -236, sd * 196, -250, sd * 216, -212);
        g.bezierCurveTo(sd * 200, -232, sd * 168, -224, sd * 132, -248);
        g.bezierCurveTo(sd * 92, -272, sd * 80, -318, sd * 48, -352);
        g.closePath(); g.fill();
        g.strokeStyle = fold; g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(sd * 70, -340); g.bezierCurveTo(sd * 96, -300, sd * 110, -270, sd * 150, -252); g.stroke();
      }
      // 躯干：交领上衣，束腰；衣褶几道
      g.fillStyle = stoneFill(g, -66, 66, col, rim);
      g.beginPath();
      g.moveTo(-30, -258); g.quadraticCurveTo(-38, -300, -44, -340); g.quadraticCurveTo(-60, -370, -54, -386);
      g.quadraticCurveTo(-30, -398, -11, -400); g.lineTo(11, -400); g.quadraticCurveTo(30, -398, 54, -386);
      g.quadraticCurveTo(60, -370, 44, -340); g.quadraticCurveTo(38, -300, 30, -258); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(col, -0.5), 0.45); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-24, -396); g.quadraticCurveTo(-6, -352, 2, -322); g.moveTo(24, -396); g.quadraticCurveTo(8, -360, 2, -340); g.stroke();
      g.strokeStyle = fold; g.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-26 + k * 4, -300); g.quadraticCurveTo(-18 + k * 6, -280, -20 + k * 8, -262); g.stroke(); g.beginPath(); g.moveTo(24 - k * 4, -300); g.quadraticCurveTo(18 - k * 6, -280, 20 - k * 8, -262); g.stroke(); }
      // 腰带与玉饰，接住蛇尾
      g.fillStyle = shade(col, -0.2); g.beginPath(); g.ellipse(0, -258, 36, 9, 0, 0, TAU); g.fill();
      g.fillStyle = mix(col, rim, 0.5); g.beginPath(); g.ellipse(0, -258, 8, 6, 0, 0, TAU); g.fill();
      for (const sd of [-1, 1]) { g.strokeStyle = rgba(mix(col, rim, 0.4), 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(sd * 6, -252); g.quadraticCurveTo(sd * 10, -230, sd * 4, -212); g.stroke(); }
      // 双臂：上臂贴身而下，小臂向内合于胸前捧石；广袖从小臂垂下，袖口外翻，褶纹顺垂
      for (const sd of [-1, 1]) {
        // 广袖
        g.fillStyle = stoneFill(g, sd < 0 ? -110 : 10, sd < 0 ? -10 : 110, shade(col, 0.03), rim);
        g.beginPath();
        g.moveTo(sd * 50, -378);
        g.bezierCurveTo(sd * 74, -360, sd * 76, -330, sd * 66, -312);
        g.bezierCurveTo(sd * 80, -290, sd * 92, -262, sd * 88, -228);
        g.quadraticCurveTo(sd * 80, -218, sd * 70, -224);
        g.quadraticCurveTo(sd * 64, -214, sd * 54, -222);
        g.quadraticCurveTo(sd * 44, -214, sd * 38, -228);
        g.bezierCurveTo(sd * 34, -258, sd * 24, -290, sd * 14, -316);
        g.lineTo(sd * 40, -320);
        g.bezierCurveTo(sd * 46, -340, sd * 46, -362, sd * 40, -374);
        g.closePath(); g.fill();
        g.strokeStyle = fold; g.lineWidth = 1;
        g.strokeStyle = rgba(shade(col, -0.5), 0.22);
        for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(sd * (46 + k * 14), -306 + k * 4); g.bezierCurveTo(sd * (56 + k * 12), -284, sd * (50 + k * 14), -260, sd * (56 + k * 12), -232); g.stroke(); }
        g.strokeStyle = hi; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(sd * 52, -374); g.bezierCurveTo(sd * 70, -356, sd * 72, -332, sd * 64, -314); g.stroke();
        // 小臂与手腕：渐细，合到胸前
        g.fillStyle = stoneFill(g, sd < 0 ? -50 : 0, sd < 0 ? 0 : 50, mix(col, '#ffffff', 0.06), rim);
        g.beginPath(); g.moveTo(sd * 40, -322); g.quadraticCurveTo(sd * 26, -330, sd * 12, -334); g.lineTo(sd * 10, -324); g.quadraticCurveTo(sd * 24, -318, sd * 38, -312); g.closePath(); g.fill();
      }
      // 合捧的双手
      g.fillStyle = mix(col, rim, 0.25);
      g.beginPath(); g.ellipse(-8, -328, 8, 6.5, 0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(8, -328, 8, 6.5, -0.4, 0, TAU); g.fill();
      // 颈与头：不刻五官，只留柔和的明暗与侧影
      g.fillStyle = stoneFill(g, -10, 10, col, rim); g.fillRect(-8.5, -416, 17, 20);
      g.fillStyle = rad(g, -8, -442, 3, 0, -432, 30, [[0, mix(col, rim, 0.5)], [0.6, col], [1, shade(col, -0.35)]]);
      g.beginPath(); g.ellipse(0, -432, 20, 26, 0, 0, TAU); g.fill();
      // 高髻：头顶挽起一个微微后倾的高髻，后面再盘一个小环
      const hair = shade(col, -0.32);
      g.fillStyle = hair;
      g.beginPath(); g.ellipse(0, -452, 23, 12, 0, PI, TAU); g.fill();
      g.beginPath(); g.moveTo(-15, -458); g.bezierCurveTo(-20, -478, -12, -496, 2, -498); g.bezierCurveTo(14, -497, 18, -480, 15, -458); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(13, -482, 7, 10, 0.5, 0, TAU); g.fill();
      g.fillStyle = rgba(shade(col, -0.55), 0.5); g.beginPath(); g.ellipse(14, -482, 2.5, 5, 0.5, 0, TAU); g.fill();
      g.strokeStyle = hi; g.lineWidth = 1; g.beginPath(); g.moveTo(-14, -462); g.bezierCurveTo(-17, -480, -10, -492, 0, -494); g.stroke();
      g.strokeStyle = rgba(shade(col, -0.55), 0.35); g.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-10 + k * 6, -460); g.quadraticCurveTo(-8 + k * 5, -480, -2 + k * 4, -494); g.stroke(); }
      const crown = mix(rim, '#ffffff', 0.12);
      g.fillStyle = crown;
      for (let k = -2; k <= 2; k++) { const a = -PI / 2 + k * 0.42; g.beginPath(); g.ellipse(Math.cos(a) * 9, -458 + Math.sin(a) * 9 + 9, 3.2, 7.5, a + PI / 2, 0, TAU); g.fill(); }
      g.fillStyle = mix(rim, '#a0302a', 0.35); g.beginPath(); g.arc(0, -455, 2.6, 0, TAU); g.fill();
      g.strokeStyle = rgba(rim, 0.85); g.lineWidth = 1.4; g.beginPath(); g.ellipse(0, -452, 21, 5, 0, PI * 1.05, PI * 1.95); g.stroke();
    });
  }
  // 女娲神像：人身蛇尾、捧五彩石；(x, y) 为石座底；s 缩放（s=1 高约 500）；color 石色；rim 金色轮廓光；
  // glow 0..1 背光与神光；awaken 0..1 神像“睁眼”：双目微光、捧石大亮；t 让步摇的珠串轻摆；lightDir 1 受光面换到右边（镜像）
  E.nuwaStatue = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, s = o.s ?? 1, t = o.t || 0, col = o.color || '#c8b99e', rim = o.rim || '#ffd27a', gl = o.glow ?? 0.6, aw = clamp(o.awaken || 0);
    fade(g, o.alpha);
    g.save(); g.translate(x, y); g.scale(s * ((o.lightDir ?? -1) > 0 ? -1 : 1), s);
    if (gl > 0) {
      K.lighter(g, () => {
        glow(g, 0, -300, 300, rim, 0.32 * gl);
        glow(g, 0, -440, 120, '#fff0c8', 0.4 * gl);
      });
      // 头光：几道细圈，外缘放射金线缓转
      g.strokeStyle = rgba(rim, 0.55 * gl); g.lineWidth = 2;
      g.beginPath(); g.arc(0, -444, 66, 0, TAU); g.stroke();
      g.strokeStyle = rgba(rim, 0.3 * gl); g.lineWidth = 1;
      g.beginPath(); g.arc(0, -444, 76, 0, TAU); g.stroke();
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * TAU + t * 0.05, l = 14 + 8 * Math.sin(k * 3.1);
        g.beginPath(); g.moveTo(Math.cos(a) * 80, -444 + Math.sin(a) * 80); g.lineTo(Math.cos(a) * (80 + l), -444 + Math.sin(a) * (80 + l)); g.stroke();
      }
      g.strokeStyle = rgba(rim, 0.22 * gl); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, -300, 190, 250, 0, PI * 1.05, PI * 1.95); g.stroke();
    }
    const img = nuwaTex(col, rim);
    blit(g, img, -280, -610, 560, 620);
    // 步摇：两支斜插的金簪，簪头垂下的珠串随 t 轻摆
    for (const sd of [-1, 1]) {
      const bx = sd * 10, by = -486, ex = sd * 30, ey = -506;
      g.strokeStyle = mix(rim, '#ffffff', 0.15); g.lineWidth = 1.6; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = rim; g.beginPath(); g.arc(ex, ey, 2.6, 0, TAU); g.fill();
      const sw = Math.sin(t * 1.7 + sd) * 0.18;
      for (let k = 0; k < 3; k++) {
        const L = 14 + k * 5, a = PI / 2 + sw + (k - 1) * 0.12;
        g.strokeStyle = rgba(rim, 0.7); g.lineWidth = 0.7; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a) * L, ey + Math.sin(a) * L); g.stroke();
        g.fillStyle = k === 1 ? '#e8f4ff' : rim; g.beginPath(); g.arc(ex + Math.cos(a) * L, ey + Math.sin(a) * L, 1.6, 0, TAU); g.fill();
      }
    }
    // 五彩石与双目
    const orb = 0.5 + 0.5 * aw;
    K.lighter(g, () => {
      const f = 0.85 + 0.15 * Math.sin(t * 2.2);
      glow(g, 0, -336, 60, '#ffe6a8', 0.5 * orb * f);
      ['#ff8a8a', '#ffe08a', '#8affc0', '#8ac8ff', '#e0a0ff'].forEach((c2, k) => { const a = t * 0.8 + (k / 5) * TAU; glow(g, Math.cos(a) * 7, -336 + Math.sin(a) * 4, 12, c2, 0.5 * orb); });
      glow(g, 0, -336, 10, '#ffffff', 0.8 * orb);
      if (aw > 0) { glow(g, 0, -434, 30, rim, 0.25 * aw); for (const sd of [-1, 1]) glow(g, sd * 7, -434, 2.5 + 2 * aw, '#fff8e0', 0.6 * aw); }
    });
    g.restore();
  };

  // 旋子彩画：一段梁枋上的图案——中间长六角枋心，两旁一朵朵旋花（层层旋转的花瓣），两端箍头
  function xuanzi(c, x0, x1, y0, y1, gold) {
    const h = y1 - y0, cy = (y0 + y1) / 2, blue = '#24506a', green = '#2c6a58', dk = '#14303a';
    c.fillStyle = green; c.fillRect(x0, y0, x1 - x0, h);
    // 箍头
    for (const ex of [x0, x1 - 14]) { c.fillStyle = blue; c.fillRect(ex, y0, 14, h); c.fillStyle = gold; c.fillRect(ex + 3, y0, 1.5, h); c.fillRect(ex + 9.5, y0, 1.5, h); }
    // 枋心
    const mx = (x0 + x1) / 2, mw = (x1 - x0) * 0.22;
    c.fillStyle = blue; c.beginPath(); c.moveTo(mx - mw, cy); c.lineTo(mx - mw + h * 0.35, y0 + 5); c.lineTo(mx + mw - h * 0.35, y0 + 5); c.lineTo(mx + mw, cy); c.lineTo(mx + mw - h * 0.35, y1 - 5); c.lineTo(mx - mw + h * 0.35, y1 - 5); c.closePath(); c.fill();
    c.strokeStyle = gold; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = rgba(gold, 0.6); c.lineWidth = 1; c.beginPath(); c.moveTo(mx - mw * 0.6, cy); c.bezierCurveTo(mx - mw * 0.3, cy - 8, mx, cy + 8, mx + mw * 0.3, cy - 4); c.stroke();
    // 旋花：花心一点，外圈两层弯花瓣
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
      const fx = mx + sd * (mw + h * 0.6 + k * h * 1.05), R = h * 0.42;
      if (fx < x0 + 16 + R || fx > x1 - 16 - R) continue;
      c.fillStyle = dk; c.beginPath(); c.arc(fx, cy, R, 0, TAU); c.fill();
      for (const [rr, n, col2] of [[R * 0.92, 9, blue], [R * 0.6, 7, green]]) {
        for (let j = 0; j < n; j++) {
          const a = (j / n) * TAU + k;
          c.fillStyle = col2; c.beginPath(); c.moveTo(fx + Math.cos(a) * rr * 0.35, cy + Math.sin(a) * rr * 0.35);
          c.quadraticCurveTo(fx + Math.cos(a + 0.5) * rr * 1.05, cy + Math.sin(a + 0.5) * rr * 1.05, fx + Math.cos(a + 0.62) * rr * 0.6, cy + Math.sin(a + 0.62) * rr * 0.6); c.closePath(); c.fill();
          c.strokeStyle = rgba('#e8f0f0', 0.55); c.lineWidth = 0.7; c.stroke();
        }
      }
      c.fillStyle = gold; c.beginPath(); c.arc(fx, cy, R * 0.18, 0, TAU); c.fill();
      c.strokeStyle = gold; c.lineWidth = 1; c.beginPath(); c.arc(fx, cy, R, 0, TAU); c.stroke();
    }
    c.fillStyle = gold; c.fillRect(x0, y0, x1 - x0, 2); c.fillRect(x0, y1 - 2, x1 - x0, 2);
  }
  // 篆意的回纹方印：网格上一笔盘绕的折线，像篆刻印文（只取意，不是真字）
  function sealGlyph(c, x, y, s, seed, col) {
    const r = rng(seed), n = 4;
    c.strokeStyle = col; c.lineWidth = s * 0.07; c.lineCap = 'square'; c.lineJoin = 'miter';
    c.strokeRect(x - s / 2, y - s / 2, s, s);
    c.beginPath();
    for (let k = 0; k < 3; k++) {
      let gx = Math.floor(r() * n), gy = Math.floor(r() * n);
      const P = (i, j) => [x - s / 2 + s * (0.18 + (0.64 * i) / (n - 1)), y - s / 2 + s * (0.18 + (0.64 * j) / (n - 1))];
      c.moveTo(...P(gx, gy));
      for (let j = 0; j < 4; j++) { if (j % 2) gy = clamp(gy + (r() < 0.5 ? -2 : 2), 0, n - 1); else gx = clamp(gx + (r() < 0.5 ? -2 : 2), 0, n - 1); c.lineTo(...P(gx, gy)); }
    }
    c.stroke();
  }
  // 如意云头纹
  function ruyi(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = s * 0.08;
    c.beginPath(); c.arc(x, y - s * 0.12, s * 0.22, PI * 0.15, PI * 0.95, true);
    c.arc(x - s * 0.3, y + s * 0.05, s * 0.18, -PI * 0.2, PI * 0.9, true);
    c.moveTo(x + s * 0.18, y); c.arc(x + s * 0.32, y + s * 0.05, s * 0.18, PI * 1.2, PI * 0.1);
    c.moveTo(x - s * 0.45, y + s * 0.2); c.quadraticCurveTo(x, y + s * 0.36, x + s * 0.48, y + s * 0.2);
    c.stroke();
  }
  // 丁达尔光柱（半分辨率缓存，贴的时候按时间明灭）
  function rayTex(k, fy) {
    return cached('templeRay', [k, fy], 400, fy + 40, 0.3, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 260, fy, [[0, 'rgba(255,226,168,1)'], [0.6, 'rgba(255,226,168,0.4)'], [1, 'rgba(255,226,168,0)']]);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(36, 0); c.lineTo(330, fy + 40); c.lineTo(220, fy + 40); c.closePath(); c.fill();
    });
  }
  // 女娲庙：view 'interior'（默认，满画面殿内）| 'exterior'（殿宇外观，以 x, y, s 定位）；
  // interior 分两层：layer 'back' 殿墙、柱、幡、光柱；'front' 供桌、香炉、烛与香烟；'all' 两层都画（神像放在两层之间）
  E.temple = function (g, o = {}) {
    const t = o.t || 0, lit = o.lit ?? 1, view = o.view || 'interior';
    if (view === 'exterior') return templeExterior(g, o);
    const layer = o.layer || 'all', fy = o.floor ?? 560, red = o.red || '#7a1e16', gold = o.gold || '#d8a84a', wallC = o.wall || '#2a1712';
    if (layer !== 'front') {
      const lq = Math.round(clamp(lit, 0, 1.5) * 4) / 4;
      const img = cached('templeIn', [fy, red, gold, wallC, lq], W, H, 1, (c) => {
        c.fillStyle = K.lin(c, 0, 0, 0, fy, [[0, shade(wallC, -0.3)], [1, shade(wallC, 0.15)]]); c.fillRect(0, 0, W, fy);
        // 墙上淡淡的壁画：远山与祥云的残迹
        c.globalAlpha = 0.12; c.strokeStyle = gold; c.lineWidth = 1.2;
        for (const sx of [120, 1010]) for (let k = 0; k < 4; k++) ruyi(c, sx + (k % 2) * 70, 200 + k * 70, 60, gold);
        c.globalAlpha = 1;
        // 神龛：拱形壁龛，内里暖金，边上一圈莲瓣纹
        const ax = 640, aw = 300, top = 120;
        c.fillStyle = K.lin(c, 0, top, 0, fy, [[0, '#5a3418'], [0.6, '#8a5a2a'], [1, '#6a4020']]);
        c.beginPath(); c.moveTo(ax - aw, fy); c.lineTo(ax - aw, top + aw); c.arc(ax, top + aw, aw, PI, TAU); c.lineTo(ax + aw, fy); c.closePath(); c.fill();
        c.strokeStyle = gold; c.lineWidth = 6; c.stroke();
        c.strokeStyle = rgba(gold, 0.4); c.lineWidth = 2; c.beginPath(); c.moveTo(ax - aw - 14, fy); c.lineTo(ax - aw - 14, top + aw); c.arc(ax, top + aw, aw + 14, PI, TAU); c.lineTo(ax + aw + 14, fy); c.stroke();
        for (let k = 0; k < 9; k++) { c.strokeStyle = rgba(gold, 0.12); c.lineWidth = 1; c.beginPath(); c.arc(ax, top + aw, aw * (0.3 + k * 0.08), PI, TAU); c.stroke(); }
        for (let k = 0; k <= 24; k++) { const a = PI + (k / 24) * PI, px = ax + Math.cos(a) * (aw + 7), py = top + aw + Math.sin(a) * (aw + 7); c.fillStyle = rgba(gold, 0.55); c.beginPath(); c.ellipse(px, py, 3, 6, a + PI / 2, 0, TAU); c.fill(); }
        // 地面：磨光石砖，透视线
        c.fillStyle = K.lin(c, 0, fy, 0, H, [[0, '#3a2a20'], [1, '#160e0a']]); c.fillRect(0, fy, W, H - fy);
        c.strokeStyle = 'rgba(255,220,160,0.08)'; c.lineWidth = 1;
        for (let k = -12; k <= 12; k++) { c.beginPath(); c.moveTo(640 + k * 30, fy); c.lineTo(640 + k * 200, H); c.stroke(); }
        for (let k = 0; k < 8; k++) { const yy = fy + Math.pow(k / 8, 1.8) * (H - fy); c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
        // 梁枋：旋子彩画，下面一排斗拱
        for (let k = 0; k < 4; k++) xuanzi(c, k * 320, (k + 1) * 320, 0, 54, gold);
        for (let x = 20; x < W; x += 64) {
          c.fillStyle = '#4a1610';
          c.fillRect(x - 16, 56, 32, 8); c.fillRect(x - 24, 64, 48, 6); c.fillRect(x - 10, 70, 20, 10);
          c.fillStyle = '#24506a'; c.fillRect(x - 22, 64.5, 6, 5); c.fillRect(x + 16, 64.5, 6, 5);
          c.fillStyle = rgba(gold, 0.6); c.fillRect(x - 24, 64, 48, 1.5);
        }
        c.fillStyle = '#3a120c'; c.fillRect(0, 80, W, 14); c.fillStyle = rgba(gold, 0.5); c.fillRect(0, 92, W, 2);
        // 柱：远两根、近两根，红漆金箍、石础
        const col = (cx, w, y0, y1) => {
          c.fillStyle = K.lin(c, cx - w / 2, 0, cx + w / 2, 0, cx < 640 ? [[0, shade(red, -0.5)], [0.7, shade(red, 0.1)], [1, shade(red, 0.3)]] : [[0, shade(red, 0.3)], [0.3, shade(red, 0.1)], [1, shade(red, -0.5)]]);
          c.fillRect(cx - w / 2, y0, w, y1 - y0);
          c.fillStyle = gold; c.fillRect(cx - w / 2, y0 + 30, w, w * 0.08); c.fillRect(cx - w / 2, y1 - w * 0.5, w, w * 0.06);
          c.fillStyle = '#4a4440'; c.beginPath(); c.ellipse(cx, y1, w * 0.75, w * 0.18, 0, 0, TAU); c.fill(); c.fillRect(cx - w * 0.75, y1, w * 1.5, w * 0.2);
          c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 1; for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(cx, y1 + w * 0.05, w * (0.2 + k * 0.1), w * 0.04, 0, PI, TAU); c.stroke(); }
        };
        col(330, 54, 94, fy); col(950, 54, 94, fy);
        col(90, 100, 0, H - 40); col(1190, 100, 0, H - 40);
        // 殿内暖光、龛内神光（亮度分档烘进贴图）
        c.globalCompositeOperation = 'lighter';
        glow(c, 640, 360, 420, '#ffb860', 0.22 * lq); glow(c, 640, fy + 30, 300, '#ffcf80', 0.18 * lq);
        c.globalCompositeOperation = 'source-over';
      });
      blit(g, img, 0, 0, W, H);
      // 幡：长条丝幡垂挂，微微摆动；幡面是篆意方印与云纹
      const fan = cached('templeBanner', [gold], 46, 340, 1, (c) => {
        c.fillStyle = K.lin(c, 0, 0, 46, 0, [[0, '#a8742a'], [0.5, '#e0b860'], [1, '#8a5a1e']]); c.fillRect(0, 0, 46, 320);
        c.fillStyle = '#8a2418'; c.fillRect(0, 0, 46, 16); c.fillRect(0, 300, 46, 6);
        for (let k = 0; k < 5; k++) sealGlyph(c, 23, 52 + k * 50, 28, 31 + k, 'rgba(120,36,20,0.75)');
        ruyi(c, 23, 288, 30, 'rgba(120,36,20,0.6)');
        c.fillStyle = '#e0b860'; c.beginPath(); c.moveTo(0, 320); c.lineTo(23, 340); c.lineTo(46, 320); c.fill();
      });
      for (const [bx, k] of [[205, 0], [1029, 1]]) cloth(g, fan, bx, 96, 46, 340, t + k * 2, { amp: 3, freq: 0.6, speed: 1.2, n: 12, shade: 0.25, pow: 1.5 });
      // 丁达尔光柱（缓存的光束，各自明灭）与浮尘
      K.lighter(g, () => {
        for (let k = 0; k < 3; k++) {
          const sx = 420 + k * 70, a = (0.08 + 0.04 * Math.sin(t * 0.5 + k * 2)) * lit;
          al(g, a); g.drawImage(rayTex(k, fy), sx, 0, 400, fy + 40);
        }
        al(g, 1);
        for (let i = 0; i < 30; i++) {
          const u = h2(i, 61), px = 450 + u * 380 + Math.sin(t * 0.3 + i) * 20, py = ((h2(i, 62) * fy + t * (6 + 8 * h2(i, 63))) % fy);
          glow(g, px + py * 0.45, py, 3 + h2(i, 64) * 3, '#ffe6b0', 0.35 * lit * (0.5 + 0.5 * Math.sin(t * 1.5 + i)));
        }
      });
    }
    if (layer !== 'back') {
      // 供桌、香炉（缓存）；红烛与香烟逐帧画
      const tx = 640, ty = 630;
      const front = inked('templeFront', [red, gold], 520, 180, 1, (c) => {
        c.translate(260, 90);
        c.fillStyle = K.lin(c, 0, -10, 0, 80, [[0, '#6a1a12'], [1, '#2a0a08']]);
        c.fillRect(-230, -10, 460, 90);
        c.fillStyle = '#8a2418'; c.fillRect(-240, -18, 480, 12);
        c.fillStyle = rgba(gold, 0.8); c.fillRect(-240, -18, 480, 2);
        // 桌围：金地上一排如意云头，中间一方篆意印
        c.fillStyle = '#b8862e'; c.fillRect(-120, -6, 240, 60);
        c.strokeStyle = '#7a1a10'; c.lineWidth = 2; c.strokeRect(-114, 0, 228, 48);
        for (const rx of [-90, -50, 50, 90]) ruyi(c, rx, 22, 30, '#7a1a10');
        sealGlyph(c, 0, 24, 30, 77, '#7a1a10');
        // 鼎
        c.fillStyle = K.lin(c, -40, 0, 40, 0, [[0, '#7a6a3a'], [0.4, '#c8a858'], [1, '#3a3018']]);
        c.beginPath(); c.moveTo(-44, -64); c.quadraticCurveTo(-48, -26, -30, -20); c.lineTo(30, -20); c.quadraticCurveTo(48, -26, 44, -64); c.closePath(); c.fill();
        c.fillRect(-50, -70, 100, 8);
        c.strokeStyle = 'rgba(60,40,10,0.5)'; c.lineWidth = 1.2; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-24 + k * 12, -44, 4, 0, TAU); c.stroke(); }
        for (const sd of [-1, 1]) { c.fillRect(sd * 30 - 3, -22, 6, 6); c.strokeStyle = '#a08848'; c.lineWidth = 4; c.beginPath(); c.arc(sd * 40, -80, 8, PI * 0.9, PI * 2.1); c.stroke(); }
      }, { w: 1, a: 0.5, grain: 0.25 });
      blit(g, front, tx - 260, ty - 90, 520, 180);
      for (let k = -1; k <= 1; k++) {
        const sx = tx + k * 10, sy = ty - 70;
        g.strokeStyle = '#6a3a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + k * 2, sy - 34); g.stroke();
        K.lighter(g, () => glow(g, sx + k * 2, sy - 35, 5, '#ff7a3a', 0.8));
        // 香烟：细丝袅袅
        g.strokeStyle = rgba('#e8e0d0', 0.18); g.lineWidth = 1.6;
        g.beginPath();
        for (let i = 0; i <= 24; i++) { const u = i / 24, px = sx + k * 2 + Math.sin(t * 0.8 + u * 6 + k) * 10 * u + noise1(u * 3 + t * 0.4, k + 5) * 30 * u - 15 * u, py = sy - 35 - u * 230; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
      E.candle(g, { x: tx - 180, y: ty - 18, h: 70, r: 7, t, burn: o.burn ?? 0.3, seed: 1 });
      E.candle(g, { x: tx + 180, y: ty - 18, h: 70, r: 7, t, burn: o.burn ?? 0.3, seed: 2 });
    }
  };
  function templeExterior(g, o) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.7;
    const sq = sqOf(s), red = o.red || '#8a2a1e', roofC = o.roof || '#3a3a3e', gold = o.gold || '#d8a84a';
    fade(g, o.alpha);
    const hq = Math.round((o.hazeA || 0) * 20) / 20;
    const img = inked('templeEx', [sq, red, roofC, gold, o.sign || '女娲庙', fontKey(o.sign || '女娲庙'), hq ? o.haze || '#c8ccd4' : '-', hq], 680, 420, sq, (c) => {
      c.translate(340, 410);
      // 台基与长阶
      c.fillStyle = K.lin(c, 0, -70, 0, 0, [[0, '#9a948a'], [1, '#5a5650']]);
      c.beginPath(); c.moveTo(-320, 0); c.lineTo(320, 0); c.lineTo(290, -70); c.lineTo(-290, -70); c.closePath(); c.fill();
      for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? '#8a847a' : '#a8a296'; c.fillRect(-60 + k * 2, -k * 7 - 7, 120 - k * 4, 7); }
      railing(c, -290, -64, -70, 16, '#b8b2a6', { gap: 26, caps: true }); railing(c, 64, 290, -70, 16, '#b8b2a6', { gap: 26, caps: true });
      // 殿身：红柱、格扇门
      c.fillStyle = '#3a1a12'; c.fillRect(-230, -230, 460, 160);
      for (let k = 0; k < 6; k++) lattice(c, -220 + k * 74, -214, 66, 104, '#5a2a1a', '#d8b878');
      for (let k = 0; k <= 6; k++) { const px = -230 + k * 76.6; c.fillStyle = K.lin(c, px - 6, 0, px + 6, 0, [[0, shade(red, 0.25)], [1, shade(red, -0.4)]]); c.fillRect(px - 6, -236, 12, 166); }
      c.fillStyle = '#2a4a48'; c.fillRect(-250, -252, 500, 16); c.fillStyle = gold; c.fillRect(-250, -252, 500, 2);
      roof(c, 0, -252, 600, 120, { color: roofC, curl: 0.5, ridge: 0.55, tileW: 9, trim: gold });
      c.fillStyle = '#1a2a2a'; c.fillRect(-60, -300, 120, 36); c.strokeStyle = gold; c.lineWidth = 2; c.strokeRect(-56, -296, 112, 28);
      glyphs(c, o.sign || '女娲庙', 0, -282, 20, gold);
      if (hq) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(o.haze || '#c8ccd4', hq); c.fillRect(-340, -410, 680, 420); c.globalCompositeOperation = 'source-over'; }
    }, { w: 1.1, a: 0.55, grain: 0.3 });
    blit(g, img, x - 340 * s, y - 410 * s, 680 * s, 420 * s);
    if (lit > 0) windowGlow(g, Array.from({ length: 6 }, (_, k) => [x + (-220 + k * 74) * s, y - 214 * s, 66 * s, 104 * s]), lit * 0.5, t, '#ffc070', 3);
    // 门前香炉的烟
    g.strokeStyle = rgba('#e8e0d0', 0.2); g.lineWidth = 3 * s;
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const u = i / 24, px = x + (Math.sin(t * 0.7 + u * 5) * 14 * u + noise1(u * 3 + t * 0.3, 7) * 40 * u - 20 * u) * s, py = y - (80 + u * 260) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    if (o.mist !== false) E.mist(g, { t, y: y - 10 * s, h: 90 * s, color: o.mist || '#e8e4dc', alpha: 0.5, speed: 5 });
  }

  // ---------- 拜月祭坛 ----------
  // 火焰：几条火舌叠加，按 t 跳动
  function fire(g, x, y, s, t, seed, col) {
    K.lighter(g, () => {
      glow(g, x, y - 14 * s, 60 * s, col || '#ff8a3a', 0.45 + 0.15 * flick(t, seed));
      for (let k = 0; k < 5; k++) {
        const ph = t * (5 + k) + seed + k * 1.7, hh = (26 + 14 * Math.sin(ph) + 10 * flick(t * 0.8, seed + k)) * s * (k ? 0.8 : 1);
        const dx = (k - 2) * 5 * s + Math.sin(ph * 1.3) * 3 * s;
        g.fillStyle = K.lin(g, 0, y, 0, y - hh, [[0, rgba('#ffe8a0', 0.8)], [0.4, rgba(col || '#ff8a3a', 0.6)], [1, rgba('#c02a10', 0)]]);
        g.beginPath(); g.moveTo(x + dx - 7 * s, y); g.quadraticCurveTo(x + dx - 6 * s, y - hh * 0.5, x + dx + Math.sin(ph) * 5 * s, y - hh); g.quadraticCurveTo(x + dx + 6 * s, y - hh * 0.5, x + dx + 7 * s, y); g.closePath(); g.fill();
      }
    });
  }
  // 图腾柱上的一节雕刻：kind 0 兽面（卷云双目、眉角、獠牙）、1 盘蛇、2 鸟首、3 月牙与星；刻痕暗、凸面受月光
  function totemCarve(g, px, sy, w, sh, kind, stone, paint, rim) {
    const dk = rgba('#0a0a10', 0.7), lt = rgba(rim, 0.35), cy = sy + sh / 2;
    g.fillStyle = rgba(paint, 0.55); g.fillRect(px - w / 2 - 2, sy + sh * 0.04, w + 4, sh * 0.1);
    g.strokeStyle = dk; g.lineWidth = Math.max(1.2, w * 0.07); g.lineCap = 'round';
    if (kind === 0) {
      // 兽面：一对卷云眼、额上弯角、口里两颗獠牙
      for (const sd of [-1, 1]) { g.beginPath(); g.arc(px + sd * w * 0.2, cy - sh * 0.06, w * 0.12, sd > 0 ? PI : 0, sd > 0 ? PI * 2.6 : PI * 1.6, sd < 0); g.stroke(); }
      g.beginPath(); g.moveTo(px - w * 0.42, cy - sh * 0.2); g.quadraticCurveTo(px - w * 0.2, cy - sh * 0.38, px, cy - sh * 0.24); g.quadraticCurveTo(px + w * 0.2, cy - sh * 0.38, px + w * 0.42, cy - sh * 0.2); g.stroke();
      g.beginPath(); g.moveTo(px - w * 0.3, cy + sh * 0.2); g.lineTo(px + w * 0.3, cy + sh * 0.2); g.stroke();
      g.fillStyle = rgba(rim, 0.45); for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(px + sd * w * 0.12, cy + sh * 0.2); g.lineTo(px + sd * w * 0.08, cy + sh * 0.34); g.lineTo(px + sd * w * 0.18, cy + sh * 0.2); g.fill(); }
    } else if (kind === 1) {
      // 盘蛇：S 形盘绕
      g.beginPath(); g.moveTo(px - w * 0.35, cy - sh * 0.3); g.bezierCurveTo(px + w * 0.5, cy - sh * 0.3, px - w * 0.5, cy + sh * 0.1, px + w * 0.35, cy + sh * 0.3); g.stroke();
      g.fillStyle = dk; g.beginPath(); g.arc(px - w * 0.35, cy - sh * 0.3, w * 0.07, 0, TAU); g.fill();
    } else if (kind === 2) {
      // 鸟首：弯喙、圆目、羽冠
      g.beginPath(); g.arc(px - w * 0.05, cy, w * 0.2, PI * 0.6, PI * 2.2); g.quadraticCurveTo(px + w * 0.38, cy + sh * 0.06, px + w * 0.2, cy + sh * 0.2); g.stroke();
      g.beginPath(); g.moveTo(px - w * 0.15, cy - sh * 0.18); g.lineTo(px - w * 0.3, cy - sh * 0.34); g.moveTo(px, cy - sh * 0.2); g.lineTo(px - w * 0.05, cy - sh * 0.38); g.stroke();
      g.fillStyle = dk; g.beginPath(); g.arc(px - w * 0.02, cy - sh * 0.02, w * 0.05, 0, TAU); g.fill();
    } else {
      // 月牙与星
      g.fillStyle = rgba(rim, 0.5); g.beginPath(); g.arc(px, cy, w * 0.26, PI * 0.25, PI * 1.75); g.arc(px + w * 0.1, cy, w * 0.21, PI * 1.7, PI * 0.3, true); g.fill();
      g.fillStyle = dk; for (const [dx, dy] of [[0.3, -0.3], [0.32, 0.25]]) { g.beginPath(); g.arc(px + w * dx, cy + sh * dy, w * 0.05, 0, TAU); g.fill(); }
    }
    g.strokeStyle = lt; g.lineWidth = 1; g.beginPath(); g.moveTo(px - w / 2 + 1, sy + sh * 0.18); g.lineTo(px - w / 2 + 1, sy + sh * 0.9); g.stroke();
  }
  function altarTex(sq, stone, paint, rim) {
    return inked('altar', [sq, stone, paint, rim], 860, 540, sq, (g) => {
      g.translate(430, 530);
      const r = rng(81);
      const tiers = [[380, 340, 0, -60], [290, 260, -60, -115], [210, 180, -115, -165]];
      for (const [wb, wt, y0, y1] of tiers) {
        // 正面受月光，两侧斜面背光
        g.fillStyle = K.lin(g, 0, y1, 0, y0, [[0, shade(stone, 0.14)], [1, shade(stone, -0.3)]]);
        g.beginPath(); g.moveTo(-wt + 18, y0); g.lineTo(wt - 18, y0); g.lineTo(wt - 18, y1); g.lineTo(-wt + 18, y1); g.closePath(); g.fill();
        for (const sd of [-1, 1]) {
          g.fillStyle = K.lin(g, 0, y1, 0, y0, [[0, shade(stone, sd < 0 ? -0.05 : -0.25)], [1, shade(stone, sd < 0 ? -0.35 : -0.55)]]);
          g.beginPath(); g.moveTo(sd * (wt - 18), y1); g.lineTo(sd * wt, y1); g.lineTo(sd * wb, y0); g.lineTo(sd * (wt - 18), y0); g.closePath(); g.fill();
        }
        g.fillStyle = rgba(rim, 0.45); g.fillRect(-wt, y1, wt * 2, 2);
        // 边角磨损：缺口与细裂
        for (let k = 0; k < 10; k++) {
          const ex = (r() - 0.5) * wt * 1.9, ey = y1 + (r() < 0.6 ? 1 : (y0 - y1) * r());
          g.fillStyle = rgba(shade(stone, -0.6), 0.6); g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + 4 + r() * 8, ey); g.lineTo(ex + 2 + r() * 3, ey + 3 + r() * 5); g.closePath(); g.fill();
          g.strokeStyle = rgba('#000000', 0.3); g.lineWidth = 0.8; g.beginPath(); g.moveTo(ex, ey + 2); g.lineTo(ex + (r() - 0.5) * 10, ey + 8 + r() * 12); g.stroke();
        }
        // 饰带：月牙与菱纹交替，间距不匀、有的剥落
        const my = (y0 + y1) / 2;
        g.fillStyle = rgba(paint, 0.5); g.fillRect(-wt + 18, my - 6, (wt - 18) * 2, 12);
        let xx = -wt + 34, k = 0;
        while (xx < wt - 30) {
          const worn = r() < 0.18, a = worn ? 0.15 : 0.55;
          if (k % 2 === 0) { g.fillStyle = rgba(rim, a); g.beginPath(); g.arc(xx, my, 5, PI * 0.25, PI * 1.75); g.arc(xx + 2.5, my, 4, PI * 1.75, PI * 0.25, true); g.fill(); }
          else { g.fillStyle = rgba(shade(paint, -0.4), a + 0.2); g.beginPath(); g.moveTo(xx, my - 5); g.lineTo(xx + 4, my); g.lineTo(xx, my + 5); g.lineTo(xx - 4, my); g.closePath(); g.fill(); }
          xx += 22 + r() * 14; k++;
        }
      }
      // 中轴长阶：每一级上沿受光，侧帮背光
      for (let k = 0; k < 22; k++) {
        const yy = -k * 7.5, w = 70 - k * 0.9;
        g.fillStyle = k % 2 ? shade(stone, -0.18) : shade(stone, 0.02); g.fillRect(-w, yy - 7.5, w * 2, 7.5);
        g.fillStyle = rgba(rim, 0.28); g.fillRect(-w, yy - 7.5, w * 2, 1);
        g.fillStyle = rgba('#000000', 0.25); g.fillRect(w - 8, yy - 7.5, 8, 7.5);
        if (r() < 0.3) { g.fillStyle = rgba('#000000', 0.35); g.fillRect(-w + r() * w * 2, yy - 7.5, 4 + r() * 6, 2); }
      }
      for (const sd of [-1, 1]) { g.fillStyle = shade(stone, -0.35); g.beginPath(); g.moveTo(sd * 70, 0); g.lineTo(sd * 84, 0); g.lineTo(sd * 66, -165); g.lineTo(sd * 51, -165); g.closePath(); g.fill(); }
      // 顶台月轮
      g.fillStyle = shade(stone, -0.1); g.beginPath(); g.ellipse(0, -168, 140, 16, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba(rim, 0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(0, -168, 120, 12, 0, 0, TAU); g.stroke();
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.fillStyle = rgba(rim, 0.45); g.beginPath(); g.arc(Math.cos(a) * 104, -168 + Math.sin(a) * 10, 2.2, 0, TAU); g.fill(); }
      // 图腾柱：一节节不同的雕刻，顶上牛角与弯月
      const totem = (px, py, hh, w, seed) => {
        g.fillStyle = K.lin(g, px - w / 2, 0, px + w / 2, 0, [[0, mix(stone, rim, 0.3)], [0.5, stone], [1, shade(stone, -0.5)]]);
        g.fillRect(px - w / 2, py - hh, w, hh);
        const nseg = Math.round(hh / (w * 1.6));
        for (let k = 0; k < nseg; k++) {
          const sy = py - hh + 18 + k * (hh - 18) / nseg, sh = (hh - 18) / nseg;
          totemCarve(g, px, sy, w, sh, (k + seed) % 4 === 3 && k % 2 ? 0 : (k * 3 + seed) % 4, stone, paint, rim);
        }
        g.strokeStyle = shade(stone, 0.1); g.lineWidth = w * 0.22; g.lineCap = 'round';
        g.beginPath(); g.moveTo(px - w * 0.4, py - hh); g.quadraticCurveTo(px - w * 1.5, py - hh - w * 0.2, px - w * 1.3, py - hh - w * 1.2); g.stroke();
        g.beginPath(); g.moveTo(px + w * 0.4, py - hh); g.quadraticCurveTo(px + w * 1.5, py - hh - w * 0.2, px + w * 1.3, py - hh - w * 1.2); g.stroke();
        g.fillStyle = mix(rim, '#ffffff', 0.2);
        g.beginPath(); g.arc(px, py - hh - w * 0.9, w * 0.55, PI * 0.15, PI * 1.85); g.arc(px + w * 0.25, py - hh - w * 0.9, w * 0.45, PI * 1.75, PI * 0.25, true); g.fill();
      };
      totem(-345, -58, 330, 30, 0); totem(345, -58, 330, 30, 1);
      totem(-215, -166, 230, 24, 2); totem(215, -166, 230, 24, 3);
      // 火盆三足
      for (const sd of [-1, 1]) {
        const bx = sd * 150, by = -166;
        g.strokeStyle = '#2a2420'; g.lineWidth = 3;
        for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(bx + k * 10, by); g.lineTo(bx + k * 6, by - 30); g.stroke(); }
        g.fillStyle = K.lin(g, bx - 24, 0, bx + 24, 0, [[0, '#6a5a3a'], [0.5, '#a08a5a'], [1, '#2a2418']]);
        g.beginPath(); g.moveTo(bx - 26, by - 44); g.quadraticCurveTo(bx, by - 18, bx + 26, by - 44); g.closePath(); g.fill();
      }
    }, { w: 1.1, a: 0.5, grain: 0.3 });
  }
  // 拜月祭坛：(x, y) 为坛前地面中点；s 缩放；moon 是否画背后巨月（moonColor、moonR、moonY）；stone 石色，paint 图腾彩绘，rim 月光轮廓；
  // fire 火盆火色；embers 火星数；haze 漫过石阶的月色薄雾（false 不画）；wind 幡与火
  E.altar = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 660, s = o.s ?? 1, t = o.t || 0, rim = o.rim || '#c8c0e8', wind = o.wind ?? 0.5;
    fade(g, o.alpha);
    if (o.moon !== false) E.moon(g, { x, y: y - (o.moonY ?? 380) * s, r: (o.moonR ?? 200) * s, color: o.moonColor || '#ece4d0', haze: o.moonHaze || '#8a78b8', glow: o.moonGlow ?? 0.6, phase: o.phase ?? 1 });
    const sq = sqOf(s);
    const img = altarTex(sq, o.stone || '#3c3648', o.paint || '#8a2a2a', rim);
    putHazed(g, img, x - 430 * s, y - 530 * s, 860 * s, 540 * s, o.haze === false ? null : o.hazeColor || '#4a3a5a', o.hazeA || 0);
    // 顶台月轮缓缓明灭
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
    K.lighter(g, () => {
      g.strokeStyle = rgba(rim, 0.15 + 0.25 * pulse); g.lineWidth = 3 * s;
      g.beginPath(); g.ellipse(x, y - 168 * s, 120 * s, 12 * s, 0, 0, TAU); g.stroke();
      glow(g, x, y - 176 * s, 160 * s, rim, 0.14 + 0.12 * pulse);
    });
    // 柱顶垂下的教幡
    const ban = cached('altarBanner', [o.banner || '#3a1a4a', rim], 30, 150, 1, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 30, 0, [[0, '#2a1036'], [0.5, o.banner || '#3a1a4a'], [1, '#1a0a22']]); c.fillRect(0, 0, 30, 140);
      c.beginPath(); c.moveTo(0, 140); c.lineTo(15, 150); c.lineTo(30, 140); c.fill();
      c.fillStyle = rgba(rim, 0.7); c.beginPath(); c.arc(15, 40, 8, PI * 0.2, PI * 1.8); c.arc(18, 40, 6.5, PI * 1.8, PI * 0.2, true); c.fill();
      c.strokeStyle = rgba(rim, 0.4); c.lineWidth = 1; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(4, 70 + k * 16); c.lineTo(26, 70 + k * 16); c.stroke(); }
    });
    for (const [px, py, k] of [[-345, -388, 0], [345, -388, 1], [-215, -396, 2], [215, -396, 3]]) cloth(g, ban, x + (px + 14) * s, y + py * s, 26 * s, 130 * s, t + k * 1.1, { amp: (3 + 9 * wind) * s, bias: 12 * wind * s, freq: 0.75, speed: 1.8 + wind * 2.4, shade: 0.35, pow: 1.2 });
    for (const sd of [-1, 1]) fire(g, x + sd * 150 * s, y - 206 * s, s, t, sd + 3, o.fire || '#ff8a3a');
    // 火星：从火盆里升起、被风吹偏、渐暗
    const ne = o.embers ?? 36;
    if (ne > 0) K.lighter(g, () => {
      for (let i = 0; i < ne; i++) {
        const sd = i % 2 ? 1 : -1, P = 1.8 + h2(i, 91) * 1.6, q = ((t + h2(i, 92) * P) % P) / P;
        const px = x + sd * 150 * s + ((h2(i, 93) - 0.5) * 20 + q * (30 + 50 * wind) * (h2(i, 94) - 0.2) + Math.sin(t * 3 + i) * 6 * q) * s, py = y - (216 + q * (120 + 80 * h2(i, 95))) * s;
        glow(g, px, py, (2 + 3 * (1 - q)) * s, q < 0.4 ? '#ffd890' : '#ff7a3a', 0.9 * (1 - q) * clamp(q * 8));
      }
    });
    // 月色薄雾漫过石阶
    if (o.haze !== false) {
      const hc = o.haze || mix(rim, '#6a5a9a', 0.5);
      E.mist(g, { t, y: y - 40 * s, h: 110 * s, color: hc, alpha: 0.45, speed: 7, seed: 11, w: 1300 });
      E.mist(g, { t, y: y - 120 * s, h: 80 * s, color: hc, alpha: 0.25, speed: -5, seed: 12, offset: 300 });
    }
  };

  // ---------- 器物 ----------
  // 烛火：泪滴形，多频闪烁，风吹偏斜；返回火焰顶点
  function flame(g, x, y, s, t, seed, o = {}) {
    const f = flick(t, seed), hh = (17 + 5 * f) * s * (o.size ?? 1), lean = ((o.wind || 0) * 0.6 + (noise1(t * 3, seed + 4) - 0.5) * 0.25) * hh;
    K.lighter(g, () => {
      glow(g, x + lean * 0.5, y - hh * 0.45, hh * (o.glow ?? 1) * 5.5, o.glowColor || '#ffa04a', 0.45 * (0.8 + 0.2 * f) * (o.alpha ?? 1));
      glow(g, x + lean * 0.4, y - hh * 0.4, hh * 1.6, '#ffd890', 0.5 * (o.alpha ?? 1));
    });
    const tip = [x + lean, y - hh];
    g.save(); al(g, o.alpha ?? 1);
    g.fillStyle = K.lin(g, 0, y, 0, y - hh, [[0, 'rgba(120,150,255,0.55)'], [0.15, '#ffb050'], [0.5, '#ffd27a'], [1, 'rgba(255,140,40,0.3)']]);
    g.beginPath(); g.moveTo(x - 4 * s, y - 2 * s); g.bezierCurveTo(x - 5.5 * s, y - hh * 0.45, tip[0] - 1.5 * s, tip[1] + hh * 0.25, tip[0], tip[1]); g.bezierCurveTo(tip[0] + 1.5 * s, tip[1] + hh * 0.25, x + 5.5 * s, y - hh * 0.45, x + 4 * s, y - 2 * s); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,252,235,0.9)';
    g.beginPath(); g.ellipse(x + lean * 0.25, y - hh * 0.32, 1.8 * s, hh * 0.22, lean * 0.01, 0, TAU); g.fill();
    g.restore();
    return tip;
  }
  // 蜡烛：(x, y) 为烛底（烛台托面）；h 烛高，r 半径；burn 0..1 燃尽程度（1 熄灭只剩残蜡与青烟）；
  // color 烛色；wind 火苗偏斜；glow 光晕倍数；holder:false 不画烛台
  E.candle = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, H0 = o.h ?? 60, r = o.r ?? 7, t = o.t || 0, burn = clamp(o.burn || 0), col = o.color || '#c8231e', seed = o.seed ?? 0;
    const s = r / 7, hh = Math.max(r * 1.3, H0 * (1 - burn * 0.9)), top = y - hh;
    if (o.holder !== false) {
      g.fillStyle = K.lin(g, x - r * 2.4, 0, x + r * 2.4, 0, [[0, '#6a4e22'], [0.35, '#d8b060'], [1, '#3a2a12']]);
      g.beginPath(); g.ellipse(x, y + 1.5 * s, r * 2.2, r * 0.6, 0, 0, TAU); g.fill();
      g.fillRect(x - r * 0.5, y, r, r * 2.6);
      g.beginPath(); g.ellipse(x, y + r * 2.8, r * 1.8, r * 0.55, 0, 0, TAU); g.fill();
      g.fillRect(x - r * 1.8, y + r * 2.8, r * 3.6, r * 0.5);
    }
    g.fillStyle = K.lin(g, x - r, 0, x + r, 0, [[0, shade(col, -0.35)], [0.3, shade(col, 0.25)], [0.6, col], [1, shade(col, -0.5)]]);
    g.fillRect(x - r, top, r * 2, hh);
    g.beginPath(); g.ellipse(x, top, r, r * 0.32, 0, 0, TAU); g.fillStyle = shade(col, 0.15); g.fill();
    // 烛泪
    g.fillStyle = shade(col, 0.2);
    for (let k = 0; k < 4; k++) {
      const dx = (h2(k, seed + 50) - 0.5) * r * 1.7, len = (4 + h2(k, seed + 51) * 14) * s * (0.4 + burn);
      g.beginPath(); g.moveTo(x + dx - 1.6 * s, top); g.lineTo(x + dx - 1.4 * s, top + len); g.arc(x + dx, top + len, 1.5 * s, PI, 0, true); g.lineTo(x + dx + 1.6 * s, top); g.fill();
    }
    if (burn > 0.5) {
      // 残蜡：烛脚下摊开一圈凝住的蜡泪，边上几滴垂挂
      const pr = r * (1.3 + burn * 1.1);
      g.fillStyle = shade(col, 0.12); g.beginPath(); g.ellipse(x, y - 1, pr, r * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.18); g.beginPath(); g.ellipse(x - pr * 0.25, y - 1.8, pr * 0.5, r * 0.14, 0, 0, TAU); g.fill();
      for (let k = 0; k < 3; k++) { const dx = (h2(k, seed + 60) - 0.5) * pr * 1.6; g.fillStyle = shade(col, 0.05); g.beginPath(); g.ellipse(x + dx, y + 1 + r * 0.2, 1.6 * s, (2 + 3 * h2(k, seed + 61)) * s, 0, 0, TAU); g.fill(); }
      if (burn >= 1) { g.fillStyle = rgba(shade(col, 0.3), 0.8); g.beginPath(); g.ellipse(x, top + 0.5, r * 0.85, r * 0.26, 0, 0, TAU); g.fill(); }
    }
    g.strokeStyle = '#1a1210'; g.lineWidth = 1.2 * s;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x + 0.6 * s, top - 4 * s); g.stroke();
    if (burn < 1) {
      const fade = clamp((1 - burn) * 12);
      flame(g, x, top - 2 * s, s * (o.size ?? 1), t, seed, { wind: o.wind, glow: o.glow ?? 1, alpha: fade, glowColor: o.glowColor });
    } else {
      // 熄灭后：焦黑的烛芯头一点余红，两缕青烟袅袅散开
      K.lighter(g, () => glow(g, x + 0.6 * s, top - 4 * s, 3 * s, '#ff6a2a', 0.35 + 0.25 * flick(t * 0.3, seed)));
      g.lineCap = 'round';
      for (let k = 0; k < 2; k++) {
        g.strokeStyle = `rgba(210,210,220,${0.3 - k * 0.1})`; g.lineWidth = (1.6 - k * 0.5) * s;
        g.beginPath();
        for (let i = 0; i <= 20; i++) { const u = i / 20, px = x + Math.sin(t * 1.2 + u * 6 + k * 2) * (3 + 9 * u) * s * (k ? -1 : 1) + (o.wind || 0) * 40 * u * s + noise1(u * 3 - t * 0.5, seed + k) * 14 * u * s, py = top - 4 * s - u * (100 + k * 30) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
    }
  };

  // 剑插在地：(x, y) 为入土点；s 缩放；angle 倾斜；chipped 刃口崩缺；tassel 剑穗色（null 不画）；glint 剑身流光；ground 土色（null 不画土堆）
  E.swordInGround = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 620, s = o.s ?? 1, t = o.t || 0, ang = o.angle ?? 0.07, steel = o.color || '#b8c2c8';
    if (o.ground !== null) {
      const gc = o.ground || '#4a3c30';
      g.fillStyle = K.lin(g, 0, y - 10 * s, 0, y + 14 * s, [[0, shade(gc, 0.2)], [1, shade(gc, -0.3)]]);
      g.beginPath(); g.ellipse(x, y + 4 * s, 50 * s, 12 * s, 0, PI, TAU); g.lineTo(x + 50 * s, y + 10 * s); g.lineTo(x - 50 * s, y + 10 * s); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(gc, -0.5), 0.7); g.lineWidth = 1.2 * s;
      for (let k = 0; k < 5; k++) { const a = PI + 0.3 + k * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 34 * s, y + Math.sin(a) * -6 * s + 6 * s); g.stroke(); }
    }
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    const L = 160, wb = 5.5;
    // 刃：两侧各崩几处缺口
    const notchL = o.chipped === false ? [] : [[0.32, 3], [0.58, 2.2], [0.8, 1.6]], notchR = o.chipped === false ? [] : [[0.45, 2.6], [0.7, 1.8]];
    g.beginPath(); g.moveTo(-wb, 0);
    for (const [u, d] of notchL) { g.lineTo(-wb * (1 - u * 0.1), -L * u + 3); g.lineTo(-wb + d, -L * u); g.lineTo(-wb * (1 - u * 0.1), -L * u - 3); }
    g.lineTo(-wb * 0.92, -L); g.lineTo(wb * 0.92, -L);
    for (const [u, d] of notchR.slice().reverse()) { g.lineTo(wb * (1 - u * 0.1), -L * u - 3); g.lineTo(wb - d, -L * u); g.lineTo(wb * (1 - u * 0.1), -L * u + 3); }
    g.lineTo(wb, 0); g.closePath();
    g.fillStyle = K.lin(g, -wb, 0, wb, 0, [[0, shade(steel, 0.25)], [0.5, steel], [0.52, shade(steel, -0.35)], [1, shade(steel, -0.15)]]);
    g.fill();
    g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-0.3, -2); g.lineTo(-0.3, -L + 4); g.stroke();
    g.fillStyle = 'rgba(120,70,50,0.35)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse((h2(k, 3) - 0.5) * 6, -L * h2(k, 4), 1.6, 3, 0, 0, TAU); g.fill(); }
    if (o.glint !== false) K.lighter(g, () => { const u = ((t * 0.35) % 1.6) - 0.3; if (u > 0 && u < 1) glow(g, 0, -L * u, 14, '#e8f4ff', 0.6 * Math.sin(u * PI)); });
    // 剑格、剑柄、剑首
    g.fillStyle = K.lin(g, -16, 0, 16, 0, [[0, '#6a5a3a'], [0.5, '#c8a860'], [1, '#4a3a20']]);
    g.beginPath(); g.moveTo(-17, -L - 1); g.quadraticCurveTo(0, -L - 9, 17, -L - 1); g.lineTo(14, -L + 4); g.quadraticCurveTo(0, -L - 2, -14, -L + 4); g.closePath(); g.fill();
    g.fillStyle = '#2a1a14'; g.fillRect(-3.4, -L - 44, 6.8, 38);
    g.strokeStyle = '#5a3a2a'; g.lineWidth = 1.2; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(-3.4, -L - 8 - k * 4); g.lineTo(3.4, -L - 11 - k * 4); g.stroke(); }
    g.fillStyle = '#b8984a'; g.beginPath(); g.ellipse(0, -L - 47, 6, 4.5, 0, 0, TAU); g.fill();
    g.restore();
    if (o.tassel !== null) {
      // 剑穗：在剑首下随风飘
      const px = x + Math.sin(ang) * (L + 47) * s, py = y - Math.cos(ang) * (L + 47) * s, wind = o.wind ?? 0.5;
      g.strokeStyle = o.tassel || '#b8352a'; g.lineCap = 'round';
      for (let k = 0; k < 5; k++) {
        g.lineWidth = (1.4 - k * 0.15) * s;
        g.beginPath(); g.moveTo(px, py);
        const ex = px + (12 + 26 * wind + k * 3) * s + Math.sin(t * 3 + k) * 4 * s, ey = py + (34 - wind * 18 + k * 2) * s;
        g.quadraticCurveTo(px + 6 * s + Math.sin(t * 2.4 + k) * 3 * s, py + 16 * s, ex, ey); g.stroke();
      }
      g.fillStyle = o.tassel || '#b8352a'; g.beginPath(); g.arc(px + 2 * s, py + 5 * s, 2.6 * s, 0, TAU); g.fill();
    }
  };

  // 酒坛：(x, y) 为坛底中点；s 缩放；label 红纸上的字；color 釉色；tilt 倾斜
  E.wineJar = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 620, s = o.s ?? 1, col = o.color || '#4a3426', label = o.label ?? '酒';
    const img = cached('jar', [col, label, fontKey(label || '酒')], 120, 140, Math.max(1, Math.ceil(s)), (c) => {
      c.translate(60, 136);
      const body = () => { c.beginPath(); c.moveTo(-22, 0); c.bezierCurveTo(-58, -30, -56, -86, -26, -100); c.lineTo(26, -100); c.bezierCurveTo(56, -86, 58, -30, 22, 0); c.closePath(); };
      body();
      c.fillStyle = K.lin(c, -50, 0, 50, 0, [[0, shade(col, -0.3)], [0.3, shade(col, 0.35)], [0.55, col], [1, shade(col, -0.55)]]); c.fill();
      c.fillStyle = rgba('#ffffff', 0.18); c.beginPath(); c.ellipse(-24, -66, 6, 20, 0.2, 0, TAU); c.fill();
      c.fillStyle = shade(col, -0.2); c.fillRect(-20, -108, 40, 10);
      // 红布封口，麻绳扎紧
      c.fillStyle = K.lin(c, -30, 0, 30, 0, [[0, '#8a1a14'], [0.4, '#d03a2a'], [1, '#6a1410']]);
      c.beginPath(); c.moveTo(-26, -104); c.quadraticCurveTo(-34, -124, 0, -128); c.quadraticCurveTo(34, -124, 26, -104); c.quadraticCurveTo(30, -94, 22, -92); c.lineTo(-22, -92); c.quadraticCurveTo(-30, -94, -26, -104); c.fill();
      c.strokeStyle = '#c8a870'; c.lineWidth = 2; c.beginPath(); c.moveTo(-24, -104); c.quadraticCurveTo(0, -100, 24, -104); c.stroke();
      if (label) {
        c.save(); c.translate(0, -56); c.rotate(PI / 4);
        c.fillStyle = '#c8302a'; c.fillRect(-17, -17, 34, 34); c.restore();
        glyphs(c, label, 0, -56, 26, '#1a1210');
      }
    });
    // 地上的影子单独画，不随坛子倾斜
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x + Math.sin(o.tilt || 0) * 30 * s, y + 1, 42 * s, 6 * s, 0, 0, TAU); g.fill();
    g.save(); g.translate(x, y); g.rotate(o.tilt || 0); g.drawImage(img, -60 * s, -136 * s, 120 * s, 140 * s); g.restore();
  };

  // 酒葫芦：(x, y) 为中心；s 缩放；angle 旋转（横倒放 PI/2）；color 葫芦色；cord 系绳色；t 给了就让穗子摆
  E.gourd = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, col = o.color || '#c89a4a', cord = o.cord || '#b8352a', t = o.t || 0;
    g.save(); g.translate(x, y); g.rotate(o.angle || 0); g.scale(s, s);
    const fillLobe = (cy, rr) => {
      g.fillStyle = rad(g, -rr * 0.35, cy - rr * 0.35, rr * 0.1, 0, cy, rr * 1.05, [[0, shade(col, 0.45)], [0.5, col], [1, shade(col, -0.5)]]);
      g.beginPath(); g.arc(0, cy, rr, 0, TAU); g.fill();
    };
    fillLobe(14, 26); fillLobe(-22, 16);
    g.fillStyle = shade(col, -0.2); g.fillRect(-6, -10, 12, 8);
    g.fillStyle = '#6a4a2a'; g.fillRect(-4, -46, 8, 10); g.fillStyle = '#8a6a3a'; g.beginPath(); g.ellipse(0, -46, 5, 2.4, 0, 0, TAU); g.fill();
    g.strokeStyle = cord; g.lineWidth = 3; g.beginPath(); g.ellipse(0, -6, 8, 3, 0, 0, TAU); g.stroke();
    g.lineWidth = 1.6; g.lineCap = 'round';
    const sw = Math.sin(t * 2.2) * 3;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(6, -4); g.quadraticCurveTo(14 + k * 2, 8, 12 + k * 3 + sw, 26); g.stroke(); }
    g.fillStyle = rgba('#ffffff', 0.25); g.beginPath(); g.ellipse(-10, 6, 5, 9, 0.4, 0, TAU); g.fill();
    g.restore();
  };

  // 卷轴：kind 'hand' 手卷（横向，(x, y) 为卷心左端，w 展开全长）| 'hang' 立轴（(x, y) 为上轴中点，h 全长）；
  // open 0..1 展开程度；content 'landscape' 山水 | 'text' 字（text 指定）；fade 0..1 墨色褪去（墨尽）
  E.scroll = function (g, o = {}) {
    const kind = o.kind || 'hand', x = o.x ?? 320, y = o.y ?? 360, open = clamp(o.open ?? 1), fade = clamp(o.fade || 0);
    const paper = o.paper || '#efe4c8', silk = o.silk || '#6a7a8a', ink = o.ink || '#1c1a18';
    const hand = kind === 'hand', L = hand ? o.w ?? 640 : o.h ?? 420, B = hand ? o.h ?? 180 : o.w ?? 160;
    const text = o.text || '逍遥', content = o.content || 'landscape';
    const tex = cached('scroll', [kind, L | 0, B | 0, paper, silk, ink, content, text, fontKey(text)], hand ? L : B, hand ? B : L, 1, (c) => {
      const w = hand ? L : B, h = hand ? B : L, m = Math.min(w, h) * 0.08;
      c.fillStyle = silk; c.fillRect(0, 0, w, h);
      c.fillStyle = paper; c.fillRect(m, m, w - m * 2, h - m * 2);
      const r = rng(7);
      for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(150,120,80,${0.03 + r() * 0.05})`; c.beginPath(); c.arc(m + r() * (w - 2 * m), m + r() * (h - 2 * m), 4 + r() * 16, 0, TAU); c.fill(); }
    });
    const art = cached('scrollArt', [kind, L | 0, B | 0, ink, content, text, fontKey(text)], hand ? L : B, hand ? B : L, 1, (c) => {
      const w = hand ? L : B, h = hand ? B : L, m = Math.min(w, h) * 0.08;
      if (content === 'text') {
        const ch = Array.from(text), sz = Math.min((hand ? h : w) * 0.5, ((hand ? w : h) - m * 4) / Math.max(1, ch.length) * 0.9);
        ch.forEach((cc, i) => glyphs(c, cc, hand ? m * 2 + sz * (i + 0.5) * 1.05 : w / 2, hand ? h / 2 : m * 2 + sz * (i + 0.5) * 1.05, sz, ink));
      } else {
        // 淡墨远山、浓墨近石、几笔小舟
        const r = rng(13);
        for (let k = 0; k < 3; k++) {
          const yb = m + (h - 2 * m) * (0.55 + k * 0.15), a = 0.18 + k * 0.25;
          c.fillStyle = rgba(ink, a); c.beginPath(); c.moveTo(m, yb);
          for (let px = m; px <= w - m; px += 6) c.lineTo(px, yb - (h - 2 * m) * (0.12 + 0.18 * noise1(px * 0.012 + k * 5, 4 + k)) * (1 - k * 0.2));
          c.lineTo(w - m, yb + 4); c.lineTo(m, yb + 4); c.closePath(); c.fill();
        }
        c.strokeStyle = rgba(ink, 0.7); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(w * 0.62, h * 0.8); c.quadraticCurveTo(w * 0.66, h * 0.83, w * 0.7, h * 0.8); c.stroke();
        c.fillStyle = '#b8302a'; c.fillRect(w - m - 16, h - m - 22, 10, 10);
        for (let k = 0; k < 4; k++) { c.fillStyle = rgba(ink, 0.6); c.fillRect(w - m - 14 + (k % 2) * 3, m + 10 + k * 12, 3, 9); }
        r();
      }
    });
    const w = hand ? L * open : B, h = hand ? B : L * open;
    g.save();
    g.beginPath(); g.rect(x - (hand ? 0 : B / 2), y - (hand ? B / 2 : 0), w, h); g.clip();
    const dx = x - (hand ? 0 : B / 2), dy = y - (hand ? B / 2 : 0);
    g.drawImage(tex, dx, dy, tex.lw, tex.lh);
    al(g, 1 - fade);
    g.drawImage(art, dx, dy, art.lw, art.lh);
    g.restore();
    // 轴头
    const rod = (rx, ry, len, vert) => {
      g.fillStyle = K.lin(g, vert ? rx - 6 : 0, vert ? 0 : ry - 6, vert ? rx + 6 : 0, vert ? 0 : ry + 6, [[0, '#4a2a1a'], [0.5, '#8a5a3a'], [1, '#2a160c']]);
      if (vert) g.fillRect(rx - 6, ry - 4, 12, len + 8); else g.fillRect(rx - 4, ry - 6, len + 8, 12);
      g.fillStyle = '#d8c8a8';
      if (vert) { g.fillRect(rx - 7, ry - 12, 14, 9); g.fillRect(rx - 7, ry + len + 3, 14, 9); } else { g.fillRect(rx - 12, ry - 7, 9, 14); g.fillRect(rx + len + 3, ry - 7, 9, 14); }
    };
    if (hand) { rod(x, y - B / 2, B, true); rod(x + w, y - B / 2, B, true); }
    else { rod(x - B / 2, y, B, false); rod(x - B / 2, y + h, B, false); }
  };

  // 砚台：(x, y) 为中心；s 缩放；wet 0..1 砚池里的墨（0 墨干龟裂）；brush 是否搁一支笔
  E.inkstone = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, wet = clamp(o.wet ?? 1), t = o.t || 0;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(4, 26, 80, 12, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a2a2e'; g.fillRect(-70, 4, 140, 18);
    g.fillStyle = K.lin(g, -70, -30, 70, 10, [[0, '#5a5a62'], [1, '#2e2e34']]);
    g.beginPath(); g.moveTo(-74, 4); g.lineTo(74, 4); g.lineTo(62, -28); g.lineTo(-62, -28); g.closePath(); g.fill();
    g.fillStyle = '#1a1a1e'; g.beginPath(); g.ellipse(-8, -10, 44, 10, 0, 0, TAU); g.fill();
    g.fillStyle = '#121216'; g.beginPath(); g.ellipse(36, -16, 16, 5, 0, 0, TAU); g.fill();
    if (wet > 0) {
      g.fillStyle = rgba('#050508', 0.6 + 0.4 * wet); g.beginPath(); g.ellipse(-8, -10, 40 * (0.5 + 0.5 * wet), 8.5 * (0.5 + 0.5 * wet), 0, 0, TAU); g.fill();
      g.fillStyle = rgba('#ffffff', 0.25 * wet); g.beginPath(); g.ellipse(-22, -13, 10, 1.6, 0, 0, TAU); g.fill();
    } else {
      g.strokeStyle = 'rgba(120,120,130,0.5)'; g.lineWidth = 0.7;
      for (let k = 0; k < 9; k++) { const a = h2(k, 5) * TAU; g.beginPath(); g.moveTo(-8, -10); g.lineTo(-8 + Math.cos(a) * 36, -10 + Math.sin(a) * 8); g.stroke(); }
    }
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-62, -28); g.lineTo(62, -28); g.stroke();
    if (o.brush !== false) {
      // 笔斜搁在砚台上沿，笔下一道淡影
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(14, -25, 66, 2.6, -0.05, 0, TAU); g.fill();
      g.save(); g.translate(14, -31); g.rotate(-0.05);
      g.fillStyle = '#2a1e14'; g.fillRect(56, -6, 10, 12); g.fillRect(-54, -6, 10, 12);
      g.fillStyle = K.lin(g, 0, -4, 0, 4, [[0, '#a8743a'], [1, '#5a3a1a']]); g.fillRect(-70, -3, 130, 6);
      g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(60, -4); g.quadraticCurveTo(80, -4, 92, 0); g.quadraticCurveTo(80, 4, 60, 4); g.closePath(); g.fill();
      g.fillStyle = rgba('#0a0a0a', 0.3 + 0.6 * wet); g.beginPath(); g.moveTo(74, -3); g.quadraticCurveTo(84, -2, 92, 0); g.quadraticCurveTo(84, 2, 74, 3); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    void t;
  };

  // 棋盘：(x, y) 为盘面中心；s 缩放；n 路数；stones 子数（按 seed 摆放）或 [[i,j,'b'|'w'],...]；tilt 透视程度。
  // 棋盘连子一起缓存（带墨线描边），只有子数或摆法变了才重建
  E.chessboard = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, n = o.n ?? 13, tilt = Math.round((o.tilt ?? 0.45) * 50) / 50, seed = o.seed ?? 3;
    let list = o.stones;
    if (!Array.isArray(list)) { const k = list ?? 22; list = []; for (let i = 0; i < k; i++) list.push([Math.floor(h2(i, seed) * n), Math.floor(h2(i, seed + 1) * n), i % 2 ? 'w' : 'b']); }
    const sig = list.map((p) => p.join('')).join(',');
    const sq = sqOf(s), wF = 150, wB = 150 * (1 - tilt * 0.35), d = 150 * tilt, cw = wF * 2.3, ch = d * 2 + 70;
    const tex = inked('chess', [sq, n, tilt, sig], cw, ch, sq, (g) => {
      const cx = cw / 2, cy = d + 8;
      const P = (u, v) => [cx + (u - 0.5) * lerp(wF, wB, v) * 2, cy + (0.5 - v) * d * 2];
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + d + 26, wF * 1.05, 14, 0, 0, TAU); g.fill();
      const [a0, a1] = [P(0, 0), P(1, 0)], [c0, c1] = [P(0, 1), P(1, 1)];
      g.fillStyle = K.lin(g, 0, a0[1], 0, a0[1] + 24, [[0, '#8a5a2a'], [1, '#4a2a12']]);
      g.fillRect(a0[0], a0[1], a1[0] - a0[0], 24);
      g.fillStyle = K.lin(g, 0, c0[1], 0, a0[1], [[0, '#d8a860'], [1, '#c08a44']]);
      g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(c1[0], c1[1]); g.lineTo(c0[0], c0[1]); g.closePath(); g.fill();
      // 木纹
      const r = rng(seed + 5);
      g.save(); g.clip();
      for (let k = 0; k < 18; k++) { const v = r(); g.strokeStyle = `rgba(120,70,30,${0.08 + r() * 0.1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const [p0] = [P(0, v)], [p1] = [P(1, v + (r() - 0.5) * 0.05)]; g.moveTo(p0[0], p0[1]); g.quadraticCurveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + (r() - 0.5) * 6, p1[0], p1[1]); g.stroke(); }
      g.restore();
      g.strokeStyle = 'rgba(40,24,10,0.7)'; g.lineWidth = 0.9;
      const m = 0.06;
      for (let i = 0; i < n; i++) {
        const u = m + (i / (n - 1)) * (1 - 2 * m);
        let [p, q] = [P(u, m), P(u, 1 - m)]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
        [p, q] = [P(m, u), P(1 - m, u)]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      }
      list.slice().sort((a, b) => b[1] - a[1]).forEach(([i, j, c2]) => {
        const u = m + (i / (n - 1)) * (1 - 2 * m), v = m + (j / (n - 1)) * (1 - 2 * m), [px, py] = P(u, v), rr = 7 * lerp(1, 0.82, v);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px + 1.5, py + 1.5, rr, rr * 0.6, 0, 0, TAU); g.fill();
        g.fillStyle = c2 === 'w' ? rad(g, px - rr * 0.3, py - rr * 0.35, 1, px, py, rr, [[0, '#ffffff'], [1, '#c8c4bc']]) : rad(g, px - rr * 0.3, py - rr * 0.35, 1, px, py, rr, [[0, '#6a6a70'], [1, '#0e0e12']]);
        g.beginPath(); g.ellipse(px, py, rr, rr * 0.62, 0, 0, TAU); g.fill();
      });
    }, { w: 0.9, a: 0.5, grain: 0.3 });
    blit(g, tex, x - (cw / 2) * s, y - (d + 8) * s, cw * s, ch * s);
  };

  // 吊坠（玉璧）：(x, y) 为系绳上端；s 缩放；t、swing 摆动；glow 0..1 许愿时的金光；color 玉色
  E.pendant = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 300, s = o.s ?? 1, t = o.t || 0, col = o.color || '#9fd0b8', gl = o.glow || 0;
    const ang = (o.swing ?? 0.12) * Math.sin(t * 1.8);
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.strokeStyle = o.cord || '#b8352a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 30); g.stroke();
    g.fillStyle = o.cord || '#b8352a'; g.beginPath(); g.moveTo(0, 26); g.lineTo(-5, 31); g.lineTo(0, 36); g.lineTo(5, 31); g.closePath(); g.fill();
    if (gl > 0) K.lighter(g, () => { glow(g, 0, 58, 90 * (0.7 + gl * 0.6), '#ffd27a', 0.55 * gl); glow(g, 0, 58, 30, '#fff6d8', 0.7 * gl); });
    g.fillStyle = rad(g, -8, 48, 2, 0, 58, 24, [[0, mix(col, '#ffffff', 0.55)], [0.6, col], [1, shade(col, -0.45)]]);
    g.beginPath(); g.arc(0, 58, 22, 0, TAU); g.arc(0, 58, 7, 0, TAU, true); g.fill();
    g.strokeStyle = rgba(shade(col, -0.5), 0.5); g.lineWidth = 1; g.beginPath(); g.arc(0, 58, 15, 0, TAU); g.stroke();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; g.fillStyle = rgba(shade(col, -0.4), 0.45); g.beginPath(); g.arc(Math.cos(a) * 18.5, 58 + Math.sin(a) * 18.5, 1.3, 0, TAU); g.fill(); }
    g.fillStyle = rgba('#ffffff', 0.45); g.beginPath(); g.ellipse(-10, 50, 4, 2, -0.6, 0, TAU); g.fill();
    g.strokeStyle = o.cord || '#b8352a'; g.lineWidth = 1.2;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(0, 80); g.quadraticCurveTo(k * 2 + Math.sin(t * 2.5) * 2, 96, k * 3 + Math.sin(t * 2.5 + k) * 3, 112); g.stroke(); }
    g.restore();
  };

  // ---------- 室内 ----------
  // 喜堂（满画面）：红烛、大红囍字、红绸彩球、帷幔；fade 0..1 褪成灰烬色（第9句），burn 红烛燃尽程度
  E.weddingHall = function (g, o = {}) {
    const t = o.t || 0, fade = clamp(o.fade || 0), burn = clamp(o.burn ?? fade * 0.9), red = o.red || '#b8221c', gold = o.gold || '#e0b04a';
    const base = cached('wedding', [red, gold, fontKey('囍')], W, H, 1, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 0, H, [[0, '#3a0a08'], [0.6, '#5a1210'], [1, '#2a0806']]); c.fillRect(0, 0, W, H);
      for (let x = 60; x < W; x += 150) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, 0, 6, 560); c.fillStyle = rgba(gold, 0.18); c.fillRect(x + 6, 0, 1.5, 560); }
      // 两侧格扇
      for (const x0 of [140, 960]) for (let k = 0; k < 2; k++) lattice(c, x0 + k * 92, 150, 84, 300, '#2a0806', '#7a2a1a');
      // 正中大红囍
      c.save(); c.translate(640, 270); c.rotate(PI / 4);
      c.fillStyle = K.lin(c, -120, -120, 120, 120, [[0, shade(red, 0.15)], [1, shade(red, -0.2)]]); c.fillRect(-118, -118, 236, 236);
      c.strokeStyle = gold; c.lineWidth = 5; c.strokeRect(-108, -108, 216, 216); c.lineWidth = 1.5; c.strokeRect(-100, -100, 200, 200);
      c.restore();
      glyphs(c, '囍', 640, 276, 190, gold);
      // 供桌：深色木案，红缎桌围绣金色云纹与小囍，桌上两盘果子
      c.fillStyle = K.lin(c, 0, 560, 0, 720, [[0, '#5a1410'], [1, '#1a0404']]); c.fillRect(260, 560, 760, 160);
      c.fillStyle = '#4a120e'; c.fillRect(240, 548, 800, 16); c.fillStyle = rgba(gold, 0.7); c.fillRect(240, 548, 800, 2);
      c.fillStyle = rgba('#000000', 0.35); c.fillRect(240, 562, 800, 3);
      c.fillStyle = K.lin(c, 520, 0, 760, 0, [[0, shade(red, -0.15)], [0.4, shade(red, 0.12)], [1, shade(red, -0.25)]]); c.fillRect(520, 556, 240, 164);
      for (let k = 0; k < 12; k++) { c.fillStyle = rgba(k % 2 ? '#000000' : '#ffffff', k % 2 ? 0.1 : 0.05); c.fillRect(522 + k * 20, 566, 8, 154); }
      c.strokeStyle = gold; c.lineWidth = 2; c.strokeRect(530, 566, 220, 140); c.lineWidth = 1; c.strokeRect(536, 572, 208, 128);
      glyphs(c, '囍', 640, 636, 56, rgba(gold, 0.85));
      c.strokeStyle = rgba(gold, 0.6); c.lineWidth = 1.4;
      for (const [cx, cy] of [[570, 600], [710, 600], [570, 676], [710, 676]]) { c.beginPath(); c.arc(cx, cy, 9, PI * 0.2, PI * 1.6); c.arc(cx + 10, cy - 2, 5.5, PI * 1.2, PI * 2.4); c.stroke(); }
      c.fillStyle = rgba('#ffffff', 0.08); c.fillRect(270, 566, 240, 2); c.fillRect(770, 566, 240, 2);
      for (const px of [430, 850]) {
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(px + 4, 549, 46, 7, 0, 0, TAU); c.fill();
        c.fillStyle = K.lin(c, px - 44, 0, px + 44, 0, [[0, '#a88850'], [0.4, '#f0d8a0'], [1, '#8a6a38']]); c.beginPath(); c.ellipse(px, 546, 44, 9, 0, 0, TAU); c.fill();
        for (let k = 0; k < 6; k++) { const fx = px - 24 + (k % 4) * 15 + (k > 3 ? 8 : 0), fy = 534 - (k > 3 ? 12 : 0); c.fillStyle = rad(c, fx - 3, fy - 3, 1, fx, fy, 9, [[0, '#ffc070'], [0.6, k % 2 ? '#e8702a' : '#f0902a'], [1, '#a8401a']]); c.beginPath(); c.arc(fx, fy, 8.5, 0, TAU); c.fill(); }
      }
      // 两侧帷幔
      for (const sd of [-1, 1]) {
        const ex = sd < 0 ? 0 : W;
        c.fillStyle = K.lin(c, ex, 0, ex - sd * 200, 0, [[0, shade(red, -0.35)], [0.6, red], [1, shade(red, -0.15)]]);
        c.beginPath(); c.moveTo(ex, 0); c.lineTo(ex - sd * 230, 0); c.quadraticCurveTo(ex - sd * 120, 300, ex - sd * 70, 420); c.quadraticCurveTo(ex - sd * 110, 560, ex - sd * 150, 720); c.lineTo(ex, 720); c.closePath(); c.fill();
        c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 3;
        for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(ex - sd * k * 38, 0); c.quadraticCurveTo(ex - sd * (k * 22), 300, ex - sd * (50 + k * 4), 420); c.quadraticCurveTo(ex - sd * (70 + k * 14), 560, ex - sd * (80 + k * 14), 720); c.stroke(); }
        c.fillStyle = gold; c.beginPath(); c.ellipse(ex - sd * 72, 420, 16, 9, 0, 0, TAU); c.fill();
        c.strokeStyle = gold; c.lineWidth = 2; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(ex - sd * 72, 428); c.lineTo(ex - sd * (72 + k * 4), 470); c.stroke(); }
      }
      // 顶上红绸彩球
      c.fillStyle = shade(red, 0.05); c.fillRect(0, 0, W, 26);
      for (let k = 0; k < 4; k++) {
        const x0 = 120 + k * 260, x1 = x0 + 260;
        c.fillStyle = shade(red, 0.12);
        c.beginPath(); c.moveTo(x0, 22); c.quadraticCurveTo((x0 + x1) / 2, 150, x1, 22); c.quadraticCurveTo((x0 + x1) / 2, 110, x0, 22); c.fill();
        c.strokeStyle = rgba('#ffffff', 0.15); c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + 10, 28); c.quadraticCurveTo((x0 + x1) / 2, 134, x1 - 10, 28); c.stroke();
      }
      for (let k = 0; k < 5; k++) {
        const bx = 120 + k * 260;
        c.fillStyle = rad(c, bx - 6, 20, 2, bx, 26, 26, [[0, shade(red, 0.45)], [1, shade(red, -0.4)]]); c.beginPath(); c.arc(bx, 26, 24, 0, TAU); c.fill();
        c.strokeStyle = rgba(shade(red, -0.6), 0.6); c.lineWidth = 1.2; for (let j = 0; j < 8; j++) { const a = (j / 8) * TAU; c.beginPath(); c.moveTo(bx, 26); c.quadraticCurveTo(bx + Math.cos(a + 0.5) * 16, 26 + Math.sin(a + 0.5) * 16, bx + Math.cos(a) * 24, 26 + Math.sin(a) * 24); c.stroke(); }
      }
      // 静止的暖光直接画进贴图：堂中一团烛光、两盏大灯笼的光晕
      c.globalCompositeOperation = 'lighter';
      glow(c, 640, 430, 380, '#ff9a5a', 0.18); glow(c, 270, 120, 170, '#ff9a4a', 0.32); glow(c, 1010, 120, 170, '#ff9a4a', 0.32);
      c.globalCompositeOperation = 'source-over';
    });
    // 褪色时与灰烬版交叉淡化；全红或全灰时只贴一张
    if (fade < 1) blit(g, base, 0, 0, W, H);
    if (fade > 0) {
      const ash = cached('weddingAsh', [red, gold, fontKey('囍')], W, H, 0.5, (c) => {
        c.drawImage(base, 0, 0, W, H);
        c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = '#7a7470'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
      });
      al(g, fade < 1 ? fade : 1); g.drawImage(ash, 0, 0, W, H); al(g, 1);
    }
    // 两侧大红灯笼与龙凤烛
    E.lantern(g, { x: 270, y: 30, s: 2.2, t, color: mix(red, '#6a6460', fade), lit: 1 - fade * 0.9, text: '囍', kind: 'palace', seed: 1, cord: 30 });
    E.lantern(g, { x: 1010, y: 30, s: 2.2, t, color: mix(red, '#6a6460', fade), lit: 1 - fade * 0.9, text: '囍', kind: 'palace', seed: 2, cord: 30 });
    for (const [cx, sd] of [[330, 1], [950, 2]]) E.candle(g, { x: cx, y: 520, h: 120, r: 12, t, burn, color: mix(red, '#8a8480', fade * 0.8), seed: sd, glow: 1.4 });
    // 褪色时纸灰飘落（直接设变换矩阵，免去逐片 save/restore）
    if (fade > 0.05) {
      const m = g.getTransform();
      for (let i = 0; i < 40; i++) {
        const P = 6, age = (t + h2(i, 81) * P) % P, px = 520 + h2(i, 82) * 240 + Math.sin(t + i) * 30 + age * 6, py = 160 + age * 70 + h2(i, 83) * 40;
        const a = t * 2 + i, ca = Math.cos(a), sa = Math.sin(a) * Math.cos(t * 3 + i);
        g.fillStyle = rgba(i % 3 ? '#6a6460' : '#c8b8a0', fade * 0.7 * clamp((P - age) / 2));
        g.setTransform(m.a * ca + m.c * sa, m.b * ca + m.d * sa, -m.a * sa + m.c * ca, -m.b * sa + m.d * ca, m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f);
        g.fillRect(-3, -2, 6, 4);
      }
      g.setTransform(m);
    }
  };

  // 烛室（满画面）：暗室里一根残烛，对着窗外的落日或晨光；sky 'sunset' | 'dawn' | 'night'；burn 残烛程度；sunY 日的高度；
  // dust 0..1 光里的浮尘。屋子与斜照的光束都缓存，只有窗外的天、日与烛火逐帧画
  E.candleRoom = function (g, o = {}) {
    const t = o.t || 0, kind = o.sky || 'sunset', burn = o.burn ?? 0.8, wx0 = Math.round(o.winX ?? 700), wx1 = wx0 + 460, wy0 = 110, wy1 = 520;
    const pal = { sunset: ['#3a2a4a', '#e07a4a', '#f8c070', '#f06a3a'], dawn: ['#5a6a9a', '#d8a8a8', '#f4dcc0', '#ffe0b0'], night: ['#0a1020', '#1a2a4a', '#2a3a5a', '#e8e0c8'] }[kind] || ['#3a2a4a', '#e07a4a', '#f8c070', '#f06a3a'];
    const tx = Math.round(o.candleX ?? 420), ty = 560;
    // 窗外
    g.save(); g.beginPath(); g.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); g.clip();
    E.sky(g, { top: pal[0], mid: pal[1], bottom: pal[2], y0: wy0, y1: wy1 });
    if (kind === 'night') { E.stars(g, { t, n: 40, minY: wy0, maxY: wy1 - 100, seed: 2 }); E.moon(g, { x: wx0 + 300, y: wy0 + 110, r: 34, glow: 0.4 }); }
    else E.sun(g, { x: wx0 + 260, y: o.sunY ?? wy1 - 120, r: 46, color: pal[3], glow: 0.8 });
    E.jiangnanTown(g, { t, y: wy1 - 30, scale: 0.6, color: '#2a2024', roof: '#141012', haze: mix(pal[1], '#2a2024', 0.7), seed: 9, x0: wx0, x1: wx1, bank: false, lit: kind === 'night' ? 0.6 : 0, smoke: kind === 'night' ? 0 : 0.5 });
    g.fillStyle = '#100c0a'; g.fillRect(wx0, wy1 - 32, wx1 - wx0, 40);
    g.restore();
    // 屋子：暗墙、窗棂、窗台、桌案、窗棂投在墙地上的影（窗口处留空）
    const room = cached('candleRoom', [kind, wx0, tx], W, H, 1, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 0, H, [[0, '#15110e'], [1, '#0c0907']]); c.fillRect(0, 0, W, H);
      const r = rng(5);
      for (let k = 0; k < 14; k++) { c.fillStyle = rgba(r() < 0.5 ? '#3a2a1e' : '#000000', 0.04 + r() * 0.04); A.inkBlob(c, r() * W, r() * 560, 30 + r() * 80, k, 0.5); c.fill(); }
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0); c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#1a120c'; c.lineWidth = 12; c.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
      c.lineWidth = 4; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(wx0 + (k * (wx1 - wx0)) / 4, wy0); c.lineTo(wx0 + (k * (wx1 - wx0)) / 4, wy1); c.stroke(); }
      c.beginPath(); c.moveTo(wx0, (wy0 + wy1) / 2 - 40); c.lineTo(wx1, (wy0 + wy1) / 2 - 40); c.stroke();
      c.fillStyle = '#2a1e16'; c.fillRect(wx0 - 30, wy1, wx1 - wx0 + 60, 14); c.fillStyle = rgba(pal[2], 0.25); c.fillRect(wx0 - 30, wy1, wx1 - wx0 + 60, 2);
      c.fillStyle = K.lin(c, 0, ty, 0, ty + 30, [[0, '#4a3020'], [1, '#1a100a']]); c.fillRect(tx - 260, ty, 520, 26);
      c.fillStyle = rgba('#ffd8a0', 0.12); c.fillRect(tx - 260, ty, 520, 1.5);
      c.fillStyle = '#140c08'; c.fillRect(tx - 240, ty + 26, 18, 140); c.fillRect(tx + 222, ty + 26, 18, 140);
    });
    blit(g, room, 0, 0, W, H);
    // 斜照进屋的光束：低分辨率预先画好、边缘羽化；窗棂的影子落在光里
    // 光束贴图只包住光束所在的范围（不铺满全幅），省一半像素
    const bx0 = wx0 - 470, bw2 = wx1 - bx0 + 20, by0 = wy0 - 20, bh2 = H - by0;
    const beam = cached('candleBeam', [kind, wx0], bw2, bh2, 0.25, (c) => {
      c.translate(-bx0, -by0);
      try { c.filter = `blur(${Math.max(2, 4 * sp().S)}px)`; } catch (e) { /* 不支持滤镜时边缘略硬 */ }
      c.fillStyle = K.lin(c, wx0, wy0, wx0 - 300, H, [[0, rgba(pal[2], 0.85)], [1, rgba(pal[2], 0)]]);
      c.beginPath(); c.moveTo(wx0, wy0); c.lineTo(wx1, wy0); c.lineTo(wx1 - 340, H); c.lineTo(wx0 - 420, H); c.closePath(); c.fill();
      c.globalCompositeOperation = 'destination-out'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 14;
      for (let k = 1; k < 4; k++) { const fx = wx0 + (k * (wx1 - wx0)) / 4; c.beginPath(); c.moveTo(fx, wy1 + 14); c.lineTo(fx - 380 - k * 6, H); c.stroke(); }
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fillRect(wx0 - 6, wy0 - 6, wx1 - wx0 + 12, wy1 - wy0 + 12);
    });
    K.lighter(g, () => {
      al(g, 0.55 * (0.9 + 0.1 * Math.sin(t * 0.4)));
      g.drawImage(beam, bx0, by0, bw2, bh2);
      al(g, 1);
      glow(g, wx0 + 200, wy1 + 170, 260, pal[2], 0.2);
      // 光里的浮尘：慢慢飘、明灭
      const nd = Math.round(30 * (o.dust ?? 1));
      for (let i = 0; i < nd; i++) {
        const v = h2(i, 71), py = wy0 + 20 + ((h2(i, 72) * (H - wy0) + t * (4 + 6 * h2(i, 73))) % (H - wy0 - 20));
        const f = (py - wy0) / (H - wy0), px = lerp(lerp(wx0, wx0 - 420, f), lerp(wx1, wx1 - 340, f), v) + Math.sin(t * 0.4 + i) * 14;
        glow(g, px, py, 2 + h2(i, 74) * 2.5, pal[2], 0.45 * (0.4 + 0.6 * Math.sin(t * 1.3 + i * 1.7)) * (1 - f * 0.6));
      }
      glow(g, tx, ty - 60, 270, '#ff9a48', 0.26); glow(g, tx, ty + 6, 160, '#ffb060', 0.2);
    });
    E.candle(g, { x: tx, y: ty - 4, h: 110, r: 11, t, burn, wind: o.wind ?? 0.15, seed: 4, glow: 1.3, color: o.candleColor || '#d8cbb0' });
  };

  // 预热：把常用贴图先建好（切镜头时第一帧不卡）。kinds 山形种类，seeds 每种几个种子
  const warmJobs = (o = {}) => {
    const jobs = [];
    for (const kind of o.kinds || ['far', 'mid', 'near', 'karst']) for (let s = 0; s < (o.seeds ?? 4); s++) jobs.push(() => rangeMasks(s, kind, -1));
    jobs.push(() => { mistTex(1); mistTex(0); softBar(); haloTex('#ffcf8a', '#ffe2b0', '#fff1d0'); });
    for (let k = 0; k < 5; k++) jobs.push(() => cloudTex(k, '#ffffff', mix('#ffffff', '#7d8aa6', 0.5), 'wash', 0));
    jobs.push(() => bleedTex());
    return jobs;
  };
  E.warm = function (o = {}) { if (sp() && sp().S) warmJobs(o).forEach((f) => f()); };
  // 页面空闲时自动预热，每次空闲只做一件，不卡主线程；结果与不预热完全一样（缓存按同样的参数确定地生成）
  try {
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 3000 }) : (f) => setTimeout(f, 120);
    let tries = 0;
    const start = () => {
      if (!(XYT.sprites && XYT.sprites.S)) { if (++tries < 120) setTimeout(start, 500); return; }
      const jobs = warmJobs(), S0 = XYT.sprites.S;
      const step = () => { if (!jobs.length || XYT.sprites.S !== S0) return; jobs.shift()(); idle(step); };
      idle(step);
    };
    setTimeout(start, 500);
  } catch (e) { /* 没有定时器的环境里跳过预热 */ }

  // 缓存统计：贴图张数、像素总数（百万）、累计新建次数与最近一张的键（排查逐帧重建用）
  E.stats = () => ({ textures: store.size, mpx: +(storePx / 1e6).toFixed(1), builds, last: lastBuilt });

  // 供镜头直接取用的小工具（都按调用时的 globalAlpha 整体缩放）
  E.util = { shade, cached, put, cloth, flick, vfill, rad, roof, railing, lattice, glyphs, flame, fire, inkEdge, ribbon: ribbonPath, glow, streak, tintOf, putHazed, bucket, qc, inkPine, softBar };
  // 导出函数统一包一层：进入时记下 globalAlpha 作整体透明度 A0，退出时还原透明度与合成方式
  const wrapA = (f) => function (g, ...rest) {
    if (!g || typeof g.drawImage !== 'function') return f.call(this, g, ...rest);
    const p = A0, a0 = g.globalAlpha, op = g.globalCompositeOperation;
    A0 = a0;
    try { return f.call(this, g, ...rest); } finally { A0 = p; g.globalAlpha = a0; g.globalCompositeOperation = op; }
  };
  for (const k of Object.keys(E)) if (typeof E[k] === 'function' && k !== 'warm' && k !== 'stats') E[k] = wrapA(E[k]);
  for (const k of ['put', 'cloth', 'vfill', 'roof', 'railing', 'lattice', 'glyphs', 'flame', 'fire', 'ribbon', 'glow', 'streak', 'putHazed', 'inkPine']) E.util[k] = wrapA(E.util[k]);

  // ---------- 预览镜头 ----------
  // 这些样张也是镜头作者的范例：远淡近浓至少四层、层间有雾、一处唯美元素、镜头缓推

  const shot = (id, def) => XYT.registerShot && XYT.registerShot('kit_env_' + id, Object.assign({ zone: 'bottom', text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6' }, def));

  // 鼎湖峰：晨雾湖面、石笋倒影
  shot('peak', {
    name: '样张·鼎湖峰', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 500;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 420 });
      E.sky(g, { top: '#5f7fa6', mid: '#d3cfc6', bottom: '#f4dcc0', y1: hz, haze: '#fff3e0', hazeY: hz });
      E.sun(g, { x: 330, y: 190, r: 34, color: '#ffd6a0', glow: 0.7 });
      E.clouds(g, { t, y: 130, color: '#fff6ea', shade: '#b8b4c4', alpha: 0.8, scale: 0.8, speed: 5, n: 4, seed: 2, lightX: 330 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 3, far: '#a9b6c6', near: '#5b6676', y0: hz - 16, y1: hz + 6, fog: '#f2ece2', fogA: 0.35, scale: 0.5, rim: '#fff4e0' });
        E.stonePeak(q, { x: 1060, y: hz + 4, h: 240, w: 84, color: '#7b7568', light: '#efd8b2', seed: 13, t: lt, mist: false, base: '#e8e6e2', alpha: 0.75 });
        E.stonePeak(q, { x: 760, y: hz + 8, h: 430, w: 136, color: '#5f584c', light: '#f6dcb0', t: lt, mist: false, base: '#e8e6e2' });
      };
      back(g);
      E.mist(g, { t: lt, y: hz - 30, h: 120, color: '#f3eee6', alpha: 0.5, speed: -9 });
      E.water(g, { y: hz, t, top: '#c9c6bf', bottom: '#4d5a6a', reflectFn: back, reflect: 0.6, glint: { x: 330, color: '#ffe2b8', w: 26, a: 0.35 } });
      E.mist(g, { t: lt, y: hz + 6, h: 90, color: '#f3eee6', alpha: 0.45, speed: 6, seed: 2 });
      E.ripples(g, { x: 560, y: 620, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 2)], scale: 1.2 });
      for (let k = 0; k < 2; k++) A.crane(g, 420 + k * 60 + lt * 14, 250 + k * 22 + Math.sin(t + k) * 5, 0.4, c.b.x * TAU + k * 2, { color: '#3a3a44' });
      g.restore();
    },
  });

  // 潮声向东流：黄昏海面、河岸、拍岸浪
  shot('sea', {
    name: '样张·东流', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 420;
      K.camera(g, c, { z0: 1.02, z1: 1.06, x0: 10, x1: -20 });
      E.sky(g, { top: '#3d4f7c', mid: '#d48a6c', bottom: '#f7c98e', y1: hz, haze: '#ffe0b0', hazeY: hz });
      E.clouds(g, { t, y: 160, color: '#ffc8a8', shade: '#7c6e8c', alpha: 0.75, scale: 1.1, speed: 6, seed: 3, n: 5, lightX: 900 });
      E.sun(g, { x: 900, y: hz - 30, r: 52, color: '#ef6a3c', glow: 0.8, sink: hz });
      E.mountains(g, { t: lt, lightDir: 1, layers: [{ color: '#a58290', light: '#ffc8a0', litA: 0.5, y: hz + 2, scaleY: 0.45, speed: 2, kind: 'far', occlude: '#d8a08c', rim: '#ffd0a0', rimA: 0.6 }] });
      E.water(g, { y: hz, t, top: '#d99a7e', bottom: '#2c3a55', glint: { x: 900, color: '#ffc58a', w: 60, a: 0.7 }, lines: 30 });
      E.waves(g, { t, y: hz + 8, color: '#1f2a40', light: '#e8b494', dir: 1, glint: { x: 900, color: '#ffd2a0', w: 70 } });
      E.shore(g, { t, side: 'left', y: 560, top: 520, reach: 460, color: '#4a3a33', sky: '#e8a888' });
      A.bird && [0, 1, 2].forEach((k) => A.bird(g, 600 + k * 40 + lt * 20, 200 + k * 14, 0.6, t * 6 + k, '#2a2430'));
      g.restore();
    },
  });

  // 古道荒坡：秋草、夕照在右，山的受光面朝右
  shot('road', {
    name: '样张·古道', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 470 });
      E.sky(g, { top: '#7d8fae', mid: '#e8c39a', bottom: '#f6dcb0', y1: 470, haze: '#ffe7c2', hazeY: 470 });
      E.sun(g, { x: 880, y: 360, r: 40, color: '#f08a4a', glow: 0.8 });
      E.clouds(g, { t, y: 140, color: '#ffe0c0', shade: '#9a8aa0', alpha: 0.6, n: 3, seed: 5, speed: 4, lightX: 880 });
      E.mountains(g, { t: lt, lightDir: 1, layers: [
        { kind: 'far', color: '#c4b0ae', light: '#ffe0c0', litA: 0.5, y: 448, scaleY: 0.3, speed: 1, seed: 2, fog: '#f3dcc0', fogA: 0.4 },
        { kind: 'mid', color: '#9a8482', light: '#ffc89a', litA: 0.55, y: 466, scaleY: 0.38, speed: 3, seed: 4, rim: '#ffd8a8', rimA: 0.7 },
      ] });
      E.grassRoad(g, { t, y: 465, wind: 0.4 + 0.4 * c.inten, light: '#ffd49a' });
      g.restore();
    },
  });

  // 雪原：脚印、冷月；后半段雪地从脚印尽头洇红（白雪纷飞都成红）
  shot('snow', {
    name: '样张·雪原', night: true,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      K.camera(g, c, { z0: 1, z1: 1.04 });
      E.sky(g, { top: '#16203a', mid: '#4d5f84', bottom: '#a9b6cc', y1: 470 });
      E.stars(g, { t, n: 70, maxY: 300, seed: 5 });
      E.moon(g, { x: 980, y: 150, r: 46, phase: 0.62, tilt: 0.1, color: '#eef0f6', haze: '#9fb6e8' });
      E.mountains(g, { t: lt, lightDir: 1, n: 3, far: '#7f8eaa', near: '#42506b', light: '#e8eef8', y0: 430, y1: 476, fog: '#c9d3e2', fogA: 0.5, rim: '#e8eef8' });
      E.snowfield(g, { t, y: 470, color: '#c9d3e6', shade: '#6f7fa0', drift: 0.7, red: clamp((lt - 5) / 4), redAt: { x: 700, y: 560, r: 900 }, footprints: { x0: 520, y0: 715, x1: 760, y1: 482, n: 30, progress: clamp(lt / 6) } });
      g.restore();
    },
  });

  // 江南黄昏：水巷、白墙黛瓦与石拱桥的倒影、乌篷船、客栈酒旗、炊烟
  shot('jiangnan', {
    name: '样张·江南黄昏', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 478;
      K.camera(g, c, { z0: 1, z1: 1.04, x0: 0, x1: -16 });
      E.sky(g, { top: '#4b5a86', mid: '#d99a7a', bottom: '#f6cf9a', y1: hz, haze: '#ffd9a8', hazeY: hz });
      E.clouds(g, { t, y: 120, color: '#f6b89a', shade: '#7d6a8e', scale: 0.8, alpha: 0.75, n: 3, seed: 4, speed: 4, lightX: 400 });
      E.sun(g, { x: 400, y: 330, r: 40, color: '#f06c3c', glow: 0.8, spread: 7 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 2, far: '#9a8aa0', near: '#7a6c80', y0: 420, y1: 440, scale: 0.35, fog: '#f2c8a4', fogA: 0.4 });
        E.jiangnanTown(q, { t, y: hz, color: '#efe2cf', roof: '#3a3a42', haze: '#e7b994', lit: 0.6, seed: 3, light: '#ffb07a', lightX: 400, smoke: q === g ? 0.7 : 0 });
        E.archBridge(q, { x: 470, y: hz + 4, s: 0.7, span: 240, color: '#9a8c84', haze: '#e7b994', hazeA: 0.2 });
      };
      back(g);
      E.water(g, { y: hz, t, top: '#c99a86', bottom: '#2f3446', reflectFn: back, reflect: 0.7, wobble: 2.5, glint: { x: 400, color: '#ffc58a', w: 34, a: 0.5 } });
      E.dock(g, { x: 760, y: 580, s: 1, t, side: -1, lit: 0.8, len: 380 });
      E.inn(g, { x: 1060, y: 590, s: 0.9, t, lit: 0.85, wind: 0.6, bank: true, bankH: 150, flagSide: -1 });
      E.ripples(g, { x: 660, y: 610, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 1)], scale: 1.4, color: '#ffe2c0' });
      E.mapleTree(g, { x: 90, y: 760, s: 1.2, t, fall: 12 });
      g.restore();
    },
  });

  // 江南春水：垂柳、石拱桥、桃花，桥洞与倒影合成满月
  shot('bridge', {
    name: '样张·小桥垂柳', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 470;
      K.camera(g, c, { z0: 1.03, z1: 1, cy: 420 });
      E.sky(g, { top: '#8aa8c8', mid: '#e4e0d8', bottom: '#f4ece0', y1: hz, haze: '#ffffff', hazeY: hz, hazeA: 0.4 });
      E.clouds(g, { t, y: 150, color: '#ffffff', shade: '#a8b4c8', alpha: 0.7, n: 4, seed: 8, speed: 3 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 2, far: '#b8c4d0', near: '#93a2b0', y0: 430, y1: 452, scale: 0.32, fog: '#eef0ee', fogA: 0.5 });
        E.jiangnanTown(q, { t, y: hz, color: '#f2efe8', roof: '#40444c', haze: '#d8dee4', seed: 5, scale: 0.8, smoke: q === g ? 0.5 : 0 });
        E.archBridge(q, { x: 640, y: hz + 6, s: 1.15, span: 260, color: '#a6a69c', haze: '#d8dee4', hazeA: 0.12 });
      };
      back(g);
      E.water(g, { y: hz, t, top: '#b8c8c8', bottom: '#4a6070', reflectFn: back, reflect: 0.75, wobble: 2, lines: 30 });
      E.mist(g, { t: lt, y: hz + 10, h: 70, color: '#f4f4f0', alpha: 0.4, speed: 6 });
      E.dock(g, { x: 300, y: 600, s: 0.9, t, side: -1, len: 300, boatX: 360 });
      E.peachTree(g, { x: 1180, y: 700, s: 1.1, t, fall: 14, seed: 6 });
      E.willow(g, { x: 130, y: 720, s: 1.2, t, wind: 0.5 + 0.3 * c.inten, color: '#8aa850' });
      g.restore();
    },
  });

  // 夕阳挂墙头：院墙、月洞门里的桃林
  shot('wall', {
    name: '样张·墙头夕阳', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#5d6b94', mid: '#e7a37c', bottom: '#f9d7a2', y1: 420 });
      E.clouds(g, { t, y: 150, color: '#f7c1a0', shade: '#806c8e', scale: 0.9, alpha: 0.7, n: 4, seed: 7, speed: 3, lightX: 830 });
      E.sun(g, { x: 830, y: 286, r: 62, color: '#f2643a', glow: 0.9, sink: 300 });
      E.mountains(g, { t: lt, n: 2, far: '#a68f9c', near: '#8d7788', y0: 360, y1: 380, scale: 0.35 });
      E.peachTree(g, { x: 1180, y: 330, s: 0.8, t, fall: 6, alpha: 0.9 });
      E.courtyardWall(g, { x: -20, y: 300, w: 1320, color: '#efe3cf', roof: '#3b3b42', light: '#ffb07a', lightX: 830, window: 'moon', winX: 420, winR: 150,
        through: (q) => {
          E.sky(q, { top: '#e9b48e', mid: '#f6d6b2', bottom: '#f3e2c4', y0: 300, y1: 720 });
          E.mountains(q, { t: lt, n: 2, far: '#c9a9a0', near: '#a88c8c', y0: 560, y1: 600, scale: 0.3 });
          q.fillStyle = K.lin(q, 0, 590, 0, 720, [[0, '#9aa070'], [1, '#5f6844']]); q.fillRect(200, 590, 450, 140);
          E.peachTree(q, { x: 470, y: 640, s: 0.9, t, fall: 10 });
        } });
      E.bamboo(g, { t, x0: 1050, x1: 1300, y: 740, h: 520, color: '#2d3f33', n: 6, wind: 0.6, seed: 5 });
    },
  });

  // 月夜荷塘：水月宫倒影、荷花、芦苇、萤光
  shot('lotus', {
    name: '样张·月夜荷塘', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 452;
      K.camera(g, c, { z0: 1, z1: 1.04, cy: 500 });
      E.sky(g, { top: '#0c1530', mid: '#25365e', bottom: '#4a5b80', y1: hz, haze: '#7c8fb8', hazeY: hz, hazeA: 0.4 });
      E.stars(g, { t, n: 120, maxY: 330, seed: 4 });
      E.moon(g, { x: 900, y: 150, r: 58, color: '#f4e7c4', glow: 0.55 });
      E.clouds(g, { t, y: 260, color: '#6a7aa6', shade: '#28334f', alpha: 0.5, scale: 0.7, n: 4, seed: 9, speed: 4, lightX: 900 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 2, far: '#3a4a72', near: '#26314f', y0: 430, y1: 452, scale: 0.4, light: '#9fb0d8', fog: '#56648c', fogA: 0.35, lightDir: 1 });
        E.palace(q, { x: 520, y: hz + 4, s: 0.78, t, lit: 0.7, jade: '#c9d2e4', roof: '#4d5f80', inner: '#7f93b8', gold: '#c9a55a', gauze: q === g ? '#e8e0f0' : false, mist: q === g ? '#8090b8' : false });
      };
      back(g);
      E.water(g, { y: hz, t, top: '#34466e', bottom: '#0b1226', reflectFn: back, reflect: 0.65, glint: { x: 900, color: '#f6e6bd', w: 30, a: 0.55 }, lineColor: '#c8d4f0' });
      E.mist(g, { t, y: hz + 20, h: 80, color: '#6a7aa6', alpha: 0.35, speed: 5 });
      E.reeds(g, { t, x0: 1040, x1: 1300, y: 730, h: 260, n: 26, color: '#0c1220', plume: '#aab4d0', wind: 0.4 });
      for (const [x, y, s, op, sd] of [[160, 640, 1.4, 1, 1], [330, 690, 1.1, 0.4, 2], [820, 660, 1.2, 0.8, 3], [980, 700, 1.5, 0.1, 4]])
        E.lotus(g, { x, y, s, open: op, t, seed: sd, leaves: 3, glow: 0.6, leafColor: '#22423e' });
      E.ripples(g, { x: 820, y: 662, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 2)], color: '#e0e8ff', scale: 1.2 });
      K.lighter(g, () => { for (let i = 0; i < 24; i++) { const fx = 100 + A.noise1(t * 0.12 + i * 3.1, 5) * 1100, fy = 380 + A.noise1(t * 0.1 + i * 7.7, 6) * 300; glow(g, fx, fy, 9, '#d8f08a', 0.25 + 0.35 * Math.sin(t * 2 + i)); } });
      g.restore();
    },
  });

  // 苏州擂台：比武招亲、灯笼夜市
  shot('arena', {
    name: '样张·擂台', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 520 });
      E.sky(g, { top: '#5a6f9a', mid: '#e3b48e', bottom: '#f2d6ae', y1: 560 });
      E.clouds(g, { t, y: 130, color: '#fbe0c8', shade: '#9a88a0', alpha: 0.7, scale: 0.8, n: 4, seed: 11, speed: 5 });
      E.mountains(g, { t: lt, n: 2, far: '#a596a6', near: '#8a7a8c', y0: 470, y1: 500, scale: 0.4, fog: '#f0d2b8' });
      E.jiangnanTown(g, { t, y: 560, scale: 0.85, color: '#ede0cc', roof: '#3c3c44', haze: '#e3c2a6', seed: 6, lit: 0.3, hazeA: 0.15 });
      // 青石板地：近大远小的接缝
      g.fillStyle = K.lin(g, 0, 556, 0, H, [[0, '#a69a88'], [1, '#5e5446']]); g.fillRect(-60, 556, W + 120, 200);
      g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const yy = 560 + Math.pow(k / 7, 1.6) * 170; g.beginPath(); g.moveTo(-60, yy); g.lineTo(W + 60, yy); g.stroke(); }
      for (let k = -14; k <= 14; k++) { g.beginPath(); g.moveTo(640 + k * 50, 560); g.lineTo(640 + k * 140, H + 20); g.stroke(); }
      E.arena(g, { x: 640, y: 690, s: 1.15, t, wind: 0.5 + 0.3 * c.inten });
      E.teahouse(g, { x: 1130, y: 650, s: 0.7, t, lit: 0.6 });
      g.strokeStyle = '#3a2418'; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, 296); g.quadraticCurveTo(140, 330, 290, 300); g.stroke();
      for (let k = 0; k < 6; k++) E.lantern(g, { x: 30 + k * 50, y: 302 + Math.sin((k / 5) * PI) * 22, s: 0.7, t, seed: k + 20, kind: k % 2 ? 'palace' : 'round' });
      g.restore();
    },
  });

  // 锁妖塔：夜、冷月、塔中幽光与妖气；后半段塔身断裂坍塌
  shot('tower', {
    name: '样张·锁妖塔', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#070a14', mid: '#1a2238', bottom: '#3a3448', y1: 650, haze: '#5a4a5a', hazeY: 600 });
      E.stars(g, { t, n: 50, maxY: 300, seed: 8, alpha: 0.7 });
      E.moon(g, { x: 300, y: 150, r: 44, color: '#e8e4f0', haze: '#6a7ab8', glow: 0.5 });
      E.clouds(g, { t, y: 230, color: '#4a5272', shade: '#141828', alpha: 0.75, scale: 1, n: 5, seed: 13, speed: 9, lightX: 300 });
      E.mountains(g, { t: lt, n: 3, far: '#2a3048', near: '#0e1018', y0: 560, y1: 640, scale: 0.55, light: '#6a7aa8', fog: '#3a3a52', fogA: 0.4, kind: 'mid', rim: '#8a9ac8' });
      E.tower(g, { x: 700, y: 650, h: 560, t, broken: clamp((lt - 6) / 5), rim: '#9fb6e0' });
      E.mist(g, { t, y: 650, h: 120, color: '#4a4a62', alpha: 0.6, speed: 8 });
      g.fillStyle = K.lin(g, 0, 640, 0, H, [[0, '#0e0e16'], [1, '#050508']]); g.fillRect(-40, 640, W + 80, 100);
      E.swordInGround(g, { x: 220, y: 690, s: 0.9, t, ground: '#1a1a22', tassel: '#c8302a', angle: -0.1 });
    },
  });

  // 女娲庙：殿内神像、光柱、香烟
  shot('temple', {
    name: '样张·女娲庙', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 300 });
      E.temple(g, { t, layer: 'back' });
      E.nuwaStatue(g, { x: 640, y: 600, s: 1.0, t, glow: 0.8, awaken: clamp((c.lt - 5) / 3) });
      E.temple(g, { t, layer: 'front', burn: 0.35 });
      g.restore();
    },
  });

  // 拜月祭坛：巨月、图腾柱、火盆、火星与月雾
  shot('altar', {
    name: '样张·拜月祭坛', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      K.camera(g, c, { z0: 1.04, z1: 1, cy: 420 });
      E.sky(g, { top: '#0a0814', mid: '#2a1a3a', bottom: '#4a3050', y1: H });
      E.stars(g, { t, n: 60, maxY: 400, seed: 12, alpha: 0.6 });
      E.clouds(g, { t, y: 130, color: '#5a4a6a', shade: '#1a1020', alpha: 0.6, n: 4, seed: 21, speed: 6, lightX: 640 });
      E.mountains(g, { t: lt, n: 2, far: '#2a2038', near: '#16101e', y0: 600, y1: 640, scale: 0.5, kind: 'karst', light: '#6a5a8a', fog: '#3a2a48' });
      g.fillStyle = K.lin(g, 0, 630, 0, H, [[0, '#2a2034'], [1, '#0e0a14']]); g.fillRect(-60, 630, W + 120, 120);
      E.mist(g, { t, y: 650, h: 90, color: '#4a3a5a', alpha: 0.6, speed: 6 });
      E.altar(g, { x: 640, y: 690, s: 0.95, t, moonR: 210, moonY: 420 });
      g.restore();
    },
  });

  // 喜堂与残烛：前半红烛高照，后半褪成灰烬
  shot('wedding', {
    name: '样张·喜堂', night: true, bloom: 0.5,
    draw(g, c) { E.weddingHall(g, { t: c.t, fade: clamp((c.lt - 4) / 5) }); },
  });
  // 残烛对落日：剑平放在桌上，葫芦立在桌面
  shot('candle', {
    name: '样张·残烛对落日', night: true, bloom: 0.5,
    draw(g, c) {
      E.candleRoom(g, { t: c.t, burn: 0.85, sky: 'sunset', sunY: 360 + c.lt * 6 });
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(560, 559, 120, 3, 0, 0, TAU); g.fill();
      E.swordInGround(g, { x: 470, y: 556, s: 0.62, t: c.t, ground: null, angle: 1.55, tassel: '#c8302a', glint: false, wind: 0.1 });
      E.gourd(g, { x: 270, y: 527, s: 0.8, t: c.t, angle: 0.08 });
    },
  });

  // 器物一览：桌上的酒坛、葫芦、卷轴、砚台、棋盘、吊坠、灯笼
  shot('props', {
    name: '样张·器物', night: false,
    draw(g, c) {
      const t = c.t;
      E.sky(g, { top: '#e8dcc4', mid: '#efe4d0', bottom: '#d8c8a8' });
      g.fillStyle = K.lin(g, 0, 470, 0, H, [[0, '#6a4a30'], [1, '#3a2618']]); g.fillRect(0, 470, W, 250);
      E.scroll(g, { kind: 'hang', x: 1120, y: 40, w: 150, h: 380, open: clamp(c.lt / 4), content: 'landscape', fade: clamp((c.lt - 7) / 3) });
      E.scroll(g, { kind: 'hand', x: 380, y: 140, w: 560, h: 150, open: clamp(c.lt / 3), content: 'text', text: '逍遥叹' });
      E.lantern(g, { x: 120, y: 0, s: 1.6, t, text: '福', cord: 40 });
      E.pendant(g, { x: 280, y: 300, s: 1.2, t, glow: 0.5 + 0.5 * Math.sin(t) });
      E.wineJar(g, { x: 180, y: 640, s: 1.1, tilt: 0.08 * Math.sin(t * 0.5) });
      E.gourd(g, { x: 340, y: 600, s: 1.1, t, angle: -0.2 });
      E.chessboard(g, { x: 640, y: 570, s: 1.1, stones: 30 });
      E.inkstone(g, { x: 960, y: 600, s: 1, wet: 1 - clamp((c.lt - 5) / 4) });
      E.candle(g, { x: 1150, y: 560, h: 80, t, burn: clamp(c.lt / 9) });
    },
  });

  // 蜀山云海：晨光在右、石峰林、孤峰古松、仙鹤
  shot('shushan', {
    name: '样张·蜀山云海', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 380 });
      E.sky(g, { top: '#5a78a8', mid: '#e8c8b0', bottom: '#fbe6c8', y1: 540, haze: '#fff0d8', hazeY: 480 });
      E.sun(g, { x: 860, y: 400, r: 44, color: '#ffd090', glow: 0.9 });
      E.clouds(g, { t, y: 150, color: '#fff4e8', shade: '#9aa0c0', alpha: 0.6, n: 3, seed: 14, speed: 4, lightX: 860 });
      E.mountains(g, { t: lt, lightDir: 1, layers: [
        { kind: 'karst', color: '#8a96ae', light: '#f4dcc8', litA: 0.5, y: 480, scaleY: 0.6, speed: 1, seed: 3, occlude: '#d8d8e0' },
        { kind: 'karst', color: '#5a6680', light: '#e8c0a4', litA: 0.45, y: 540, scaleY: 0.75, speed: 2.5, seed: 5, rim: '#ffe0c0', rimA: 0.6 },
      ] });
      E.cloudSea(g, { t, y: 480, color: '#fff2e4', shade: '#8a88b0', speed: 8, rows: 5, lightX: 860 });
      E.stonePeak(g, { x: 240, y: 760, h: 520, w: 170, color: '#4f4a44', light: '#f2d2a8', t: lt, mist: '#f6efe6', seed: 21, lightDir: 1 });
      for (let k = 0; k < 3; k++) A.crane(g, 760 + k * 70 + lt * 12, 210 + k * 26 + Math.sin(t + k) * 6, 0.55, c.b.x * TAU + k, { color: '#2a2a32' });
      E.cloudSea(g, { t: t + 40, y: 640, color: '#ffffff', shade: '#c8c0d4', speed: 18, rows: 2, alpha: 0.85, seed: 5, lightX: 860 });
      g.restore();
    },
  });

  // 仙都红蒲公英：鼎湖峰下，红絮漫天（都成红）
  shot('fluff', {
    name: '样张·红蒲公英', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 520;
      K.camera(g, c, { z0: 1, z1: 1.05, cy: 600 });
      E.sky(g, { top: '#8aa0c0', mid: '#ead8c8', bottom: '#f6e0c8', y1: hz, haze: '#fff0e0', hazeY: hz });
      E.clouds(g, { t, y: 120, color: '#ffffff', shade: '#b0b4c8', alpha: 0.6, n: 3, seed: 6, speed: 3 });
      E.mountains(g, { t: lt, n: 2, far: '#b4b8c4', near: '#8a8c98', y0: hz - 20, y1: hz, scale: 0.4, fog: '#f4ece4' });
      E.stonePeak(g, { x: 820, y: hz + 10, h: 470, w: 150, color: '#5f574c', light: '#f6dcb0', t: lt, mist: '#f6efe8' });
      E.grassRoad(g, { t, y: hz + 10, color: '#8a8e58', dark: '#3a4222', light: '#ffe0c0', path: false, n: 60, seed: 4, haze: '#f4ece4' });
      E.dandelions(g, { t, x0: 100, x1: 1200, y: 640, n: 26, release: 0.5, wind: 0.6, s: 0.55, seed: 3 });
      E.dandelions(g, { t, x0: -20, x1: 1300, y: 740, n: 34, release: 0.8, wind: 0.6, s: 1.2 });
      g.restore();
    },
  });
})();
