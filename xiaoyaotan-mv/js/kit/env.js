/* 逍遥叹 · 音乐动画 —— 工具包·场景（XYT.env）：天光、山水、草木、楼阁与器物 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, h2, rng, noise1, noise2, rgba, mix } = A;
  const PI = Math.PI;
  const E = (XYT.env = XYT.env || {});
  const sp = () => XYT.sprites;

  // ---------- 通用 ----------
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
  const num = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
  // 缓存：名字 + 影响静态外观的参数组成键；参数要离散，别把逐帧变化的量放进来
  const cached = (name, parts, w, h, sc, fn) => K.cache(name + '|' + parts.map(num).join('|'), w, h, sc, fn);
  // 按锚点贴缓存图：ax、ay 为锚点在图中的比例
  function put(g, c, x, y, s = 1, ax = 0.5, ay = 1) { g.drawImage(c, x - c.lw * s * ax, y - c.lh * s * ay, c.lw * s, c.lh * s); }
  // 题字用的书法字体按需加载；没加载好时缓存键不同，加载后自动重画
  const GLYPHS = '客栈酒茶囍比武招亲水月宫锁妖塔女娲福林李逍遥忆如仙灵岛拜南诏蜀山剑神镇封印符敕令';
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', GLYPHS).catch(() => {}); } catch (e) { /* 无字体接口 */ }
  const fontKey = (txt) => { try { return document.fonts && document.fonts.check('32px "Ma Shan Zheng"', txt) ? 'f' : 'n'; } catch (e) { return 'n'; } };
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
  // 暗面副本：布料起伏时叠一层暗色表现褶皱
  const darkMap = new WeakMap();
  function darkOf(img, col) {
    let m = darkMap.get(img);
    if (!m) { m = {}; darkMap.set(img, m); }
    const k = col || '#000000';
    if (!m[k]) {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height; c.lw = img.lw; c.lh = img.lh;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = k; g.fillRect(0, 0, c.width, c.height);
      m[k] = c;
    }
    return m[k];
  }
  // 布面飘动：把贴图切条错位。axis 'y'：挂在上边（幡、纱、帘），横条左右摆；axis 'x'：挂在左边（旗），竖条上下摆
  function cloth(g, img, x, y, w, h, t, o = {}) {
    const n = o.n || 16, amp = o.amp ?? 6, fr = o.freq ?? 1.3, spd = o.speed ?? 3, ph = o.phase || 0, dk = o.shade ?? 0.35;
    const r = img.width / img.lw, dark = dk > 0 ? darkOf(img) : null;
    const a0 = g.globalAlpha;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n, u = (u0 + u1) / 2, k = Math.pow(u, o.pow ?? 1);
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
    if (o.glow) { const q = o.glow; K.lighter(g, () => A.glow(g, q.x ?? 640, q.y ?? y1, q.r ?? 420, q.color || '#ffd9a0', q.a ?? 0.35)); }
  };

  // 光晕贴图：几层柔光预先叠好，一次贴完
  function haloTex(c1, c2, c3) {
    return cached('halo', [c1, c2, c3], 256, 256, 0.5, (g) => {
      A.softBlob(g, 128, 128, 128, 0.32, c1);
      A.softBlob(g, 128, 128, 60, 0.55, c2);
      A.softBlob(g, 128, 128, 27, 0.7, c3);
    });
  }
  // 太阳：多层光晕 + 中心偏亮的日轮；sink 为地平线 y，日轮低于它的部分不画
  E.sun = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 300, r = o.r ?? 48, col = o.color || '#e2553a', gl = o.glow ?? 0.6, a = o.alpha ?? 1;
    const hs = Math.min(r * (o.spread ?? 9), r + 520);
    K.lighter(g, () => {
      g.globalAlpha = clamp(gl * a);
      g.drawImage(haloTex(o.haze || mix(col, '#ffcf8a', 0.55), mix(col, '#ffe2b0', 0.45), '#fff1d0'), x - hs, y - hs, hs * 2, hs * 2);
      g.globalAlpha = 1;
    });
    g.save();
    if (o.sink != null) { g.beginPath(); g.rect(x - r * 2, y - r * 2, r * 4, o.sink - (y - r * 2)); g.clip(); }
    g.globalAlpha = a;
    g.fillStyle = rgba(col, 0.25);
    g.beginPath(); g.arc(x, y, r * 1.05, 0, TAU); g.fill();
    g.fillStyle = rad(g, x - r * 0.2, y - r * 0.25, r * 0.05, x, y, r, [[0, mix(col, '#fff8e4', 0.8)], [0.55, mix(col, '#ffdca8', 0.35)], [1, col]]);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.restore();
  };

  function moonTex(r, col, phase, tilt) {
    const R = Math.round(r), q = Math.round(clamp(phase) * 40) / 40, tq = Math.round((tilt || 0) * 20) / 20;
    return cached('moon', [R, col, q, tq], R * 2 + 6, R * 2 + 6, 1, (g) => {
      const c = R + 3;
      g.fillStyle = rad(g, c - R * 0.3, c - R * 0.35, R * 0.05, c, c, R, [[0, '#fffdf5'], [0.55, mix(col, '#ffffff', 0.35)], [1, col]]);
      g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(c, c, R, 0, TAU); g.clip();
      // 月海：几团柔和的灰影，外加细碎的环形山
      const rr = rng(4);
      for (let i = 0; i < 12; i++) {
        const ang = rr() * TAU, d = Math.sqrt(rr()) * R * 0.7, s = R * (0.14 + rr() * 0.26);
        A.softBlob(g, c + Math.cos(ang) * d, c + Math.sin(ang) * d, s, 0.1 + rr() * 0.1, '#7f7c78');
      }
      for (let i = 0; i < Math.round(R * 0.8); i++) {
        const ang = rr() * TAU, d = Math.sqrt(rr()) * R * 0.92, s = 0.6 + rr() * R * 0.035;
        g.fillStyle = `rgba(110,104,96,${0.05 + rr() * 0.08})`; g.beginPath(); g.arc(c + Math.cos(ang) * d, c + Math.sin(ang) * d, s, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,250,0.1)'; g.beginPath(); g.arc(c + Math.cos(ang) * d - s * 0.3, c + Math.sin(ang) * d - s * 0.3, s * 0.6, 0, TAU); g.fill();
      }
      g.fillStyle = rad(g, c, c, R * 0.6, c, c, R, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(110,96,70,0.2)']]);
      g.fillRect(0, 0, c * 2, c * 2);
      g.restore();
      if (q < 1) {
        // 月相：用偏移的圆抠掉暗面，边缘留一点柔和
        const d = 2 * R * q, ax = Math.cos(tq * PI), ay = Math.sin(tq * PI);
        g.globalCompositeOperation = 'destination-out';
        const sx = c - ax * d, sy = c - ay * d;
        g.fillStyle = rad(g, sx, sy, R * 0.94, sx, sy, R * 1.04, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
        g.beginPath(); g.arc(sx, sy, R * 1.05, 0, TAU); g.fill();
        g.globalCompositeOperation = 'destination-over';
        g.fillStyle = 'rgba(120,140,180,0.1)';
        g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    });
  }
  // 月亮：phase 1 满月、0 新月；tilt 明暗交界的方向（0 亮面朝右）；haze 冷色大光晕
  E.moon = function (g, o = {}) {
    const x = o.x ?? 900, y = o.y ?? 180, r = o.r ?? 64, col = o.color || '#f3e3b6', gl = o.glow ?? 0.45, a = o.alpha ?? 1;
    const hs = Math.min(r * (o.spread ?? 6.5), r * 2 + 420), ph = o.phase ?? 1;
    K.lighter(g, () => {
      g.globalAlpha = clamp(gl * a * (0.45 + 0.55 * ph));
      g.drawImage(haloTex(o.haze || '#7f98d0', mix(col, '#9fb4e0', 0.4), col), x - hs, y - hs, hs * 2, hs * 2);
      g.globalAlpha = 1;
    });
    g.globalAlpha = a;
    const img = moonTex(r, col, ph, o.tilt || 0);
    g.drawImage(img, x - img.lw / 2, y - img.lh / 2, img.lw, img.lh);
    g.globalAlpha = 1;
  };

  function milkyTex(seed, col) {
    return cached('milky', [seed, col], 900, 260, 0.6, (g) => {
      const r = rng(seed + 50);
      for (let i = 0; i < 26; i++) A.softBlob(g, 60 + r() * 780, 130 + (r() - 0.5) * 90, 40 + r() * 90, 0.12, col);
      for (let i = 0; i < 700; i++) {
        const x = r() * 900, y = 130 + (r() + r() + r() - 1.5) * 90;
        g.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
        const s = 0.4 + r() * 1.1; g.fillRect(x, y, s, s);
      }
    });
  }
  // 星空：n 颗，越往上越密，偶有十字星芒；milky 0..1 叠一条星河
  E.stars = function (g, o = {}) {
    const t = o.t || 0, n = o.n ?? 90, seed = o.seed ?? 3, maxY = o.maxY ?? 420, minY = o.minY ?? 0, col = o.color || '#fff6e0', tw = o.twinkle ?? 1;
    const a0 = o.alpha ?? 1;
    if (o.milky) {
      // 星河：按角度预先转好再贴，省去逐帧旋转
      const ang = Math.round((o.milkyAngle ?? -0.35) * 20) / 20, mc = o.milkyColor || '#b9c6ff';
      const bw = Math.abs(1300 * Math.cos(ang)) + Math.abs(380 * Math.sin(ang)), bh = Math.abs(1300 * Math.sin(ang)) + Math.abs(380 * Math.cos(ang));
      const c = cached('milkyRot', [seed, mc, ang], bw, bh, 0.6, (q) => { q.translate(bw / 2, bh / 2); q.rotate(ang); q.drawImage(milkyTex(seed, mc), -650, -190, 1300, 380); });
      g.globalAlpha = o.milky * a0;
      g.drawImage(c, (o.milkyX ?? 640) - bw / 2, (o.milkyY ?? maxY * 0.45) - bh / 2, bw, bh);
      g.globalAlpha = 1;
    }
    for (let i = 0; i < n; i++) {
      const x = h2(i, seed) * (W + 40) - 20, y = minY + Math.pow(h2(i, seed + 1), 1.35) * (maxY - minY);
      const m = h2(i, seed + 3), r = 0.5 + m * m * 1.2 + (m > 0.95 ? 1.2 : 0);
      let a = (0.4 + 0.6 * m) * (1 - tw * 0.3 * (1 + Math.sin(t * (0.6 + h2(i, seed + 2) * 2.6) + i * 2.1)));
      a *= clamp((maxY - y) / 70 + 0.2) * a0;
      const hk = h2(i, seed + 4), c = hk < 0.18 ? '#cfe0ff' : hk > 0.86 ? '#ffe0bc' : col;
      if (m > 0.95) {
        K.lighter(g, () => A.glow(g, x, y, r * 4, c, a * 0.45));
        g.strokeStyle = rgba(c, a * 0.35); g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(x - r * 3, y); g.lineTo(x + r * 3, y); g.moveTo(x, y - r * 3); g.lineTo(x, y + r * 3); g.stroke();
      }
      g.fillStyle = rgba(c, clamp(a));
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
  };

  // 云朵贴图：圆团并集、底部收平，上亮下暗，每团左上有受光
  function cloudTex(k, lit, sh) {
    return cached('cloud', [k, lit, sh], 520, 220, 0.5, (g) => {
      const r = rng(300 + k * 17), base = 178, puffs = [];
      const n = 6 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = 60 + u * 400 + (r() - 0.5) * 30;
        const rr = 22 + Math.sin(u * PI) * (34 + r() * 34);
        puffs.push([x, base - rr * (0.45 + r() * 0.35), rr]);
      }
      for (let i = 0; i < 4; i++) {
        const p = puffs[1 + Math.floor(r() * (n - 2))];
        puffs.push([p[0] + (r() - 0.5) * 70, p[1] - p[2] * (0.35 + r() * 0.3), p[2] * (0.45 + r() * 0.3)]);
      }
      for (const [x, y, rr] of puffs) A.softBlob(g, x, y + rr * 0.1, rr * 1.4, 0.22, lit);
      g.save();
      g.beginPath(); g.rect(0, 0, 520, base); g.clip();
      g.beginPath(); for (const [x, y, rr] of puffs) { g.moveTo(x + rr, y); g.arc(x, y, rr, 0, TAU); }
      const top = Math.min(...puffs.map((p) => p[1] - p[2]));
      g.fillStyle = K.lin(g, 0, top, 0, base, [[0, lit], [0.5, mix(lit, sh, 0.3)], [1, sh]]);
      g.fill();
      g.clip();
      for (const [x, y, rr] of puffs) {
        g.fillStyle = rad(g, x - rr * 0.35, y - rr * 0.45, rr * 0.05, x, y, rr * 1.05, [[0, 'rgba(255,255,255,0.5)'], [0.6, 'rgba(255,255,255,0.08)'], [1, 'rgba(255,255,255,0)']]);
        g.beginPath(); g.arc(x, y, rr * 1.05, 0, TAU); g.fill();
        g.fillStyle = K.lin(g, 0, y, 0, y + rr, [[0, rgba(sh, 0)], [1, rgba(sh, 0.45)]]);
        g.beginPath(); g.arc(x, y, rr, 0, PI); g.fill();
      }
      g.restore();
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = K.lin(g, 0, base - 26, 0, base, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.85)']]);
      g.fillRect(0, base - 26, 520, 30);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 浮云：y 中线，speed 像素/秒（正值向右），scale 尺寸，n 朵数，spread 上下散布；color 受光，shade 云底
  E.clouds = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 200, sc = o.scale ?? 1, speed = o.speed ?? 8, col = o.color || '#ffffff', sh = o.shade || mix(col, '#7d8aa6', 0.5);
    const a = o.alpha ?? 0.85, seed = o.seed ?? 1, n = o.n ?? 5, spread = o.spread ?? 60;
    const w = 520 * sc, span = W + w * 2;
    for (let k = 0; k < n; k++) {
      const s2 = 0.65 + 0.7 * h2(k, seed + 2);
      const x = ((((h2(k, seed) * span + t * speed * (0.8 + 0.4 * h2(k, seed + 5))) % span) + span) % span) - w;
      const yy = y + (h2(k, seed + 1) - 0.5) * spread;
      const img = cloudTex((k + seed) % 5, col, sh);
      g.globalAlpha = a * (0.75 + 0.25 * h2(k, seed + 3));
      g.drawImage(img, x, yy - 178 * sc * s2, w * s2, 220 * sc * s2);
    }
    g.globalAlpha = 1;
  };
  // 云海一行：周期为 L 的长条，预渲染后平铺滚动
  function seaRow(r, sc, lit, sh, seed) {
    const L = 1600, hh = 300 * sc + 50;
    return cached('seaRow', [r, Math.round(sc * 20) / 20, lit, sh, seed], L, hh, 0.5, (g) => {
      const n = Math.ceil(L / (520 * sc * 0.4));
      for (let k = 0; k < n; k++) {
        const s2 = 0.8 + 0.5 * h2(k, seed + r * 13);
        const x = (k / n) * L + (h2(k, seed + r * 13 + 1) - 0.5) * 60, yy = 25 + 240 * sc + (h2(k, seed + r * 13 + 2) - 0.5) * 22 * sc;
        const img = cloudTex((k + r) % 5, lit, sh), w = 520 * sc * s2, h = 220 * sc * s2;
        for (const dx of [-L, 0, L]) if (x + dx - w * 0.5 < L && x + dx + w * 0.5 > 0) g.drawImage(img, x + dx - w * 0.5, yy - 178 * sc * s2, w, h);
      }
    });
  }
  // 云海：从 y（远）铺到画面底，远小慢、近大快；color 受光、shade 云谷
  E.cloudSea = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#f6efe4', sh = o.shade || '#8e9bb5', speed = o.speed ?? 10, rows = o.rows ?? 4, a = o.alpha ?? 1;
    const base = mix(col, sh, 0.62), seed = o.seed || 0;
    g.globalAlpha = a;
    vfill(g, -80, y - 20, W + 80, H + 20, [[0, rgba(base, 0)], [0.1, rgba(base, 0.95)], [1, mix(col, sh, 0.6)]]);
    for (let r = 0; r < rows; r++) {
      const u = rows > 1 ? r / (rows - 1) : 1, z = Math.pow(u, 1.5);
      const sc = 0.4 + 1.5 * z, yy = y + z * (H - y + 30);
      const far = o.far || mix(col, sh, 0.25);
      const img = seaRow(r, sc, mix(far, col, z), mix(mix(sh, col, 0.2), sh, z), seed);
      // 远处的云更扁（透视），也少画一些像素
      const L = img.lw, q = lerp(0.55, 0.9, z), off = ((((t * speed * (0.25 + 2.2 * z) + h2(r, seed) * L) % L) + L) % L);
      for (let x = off - L; x < W + 80; x += L) g.drawImage(img, x - 80, yy - (25 + 240 * sc) * q, L, img.lh * q);
    }
    g.globalAlpha = 1;
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
  // 雾带：y 中线，h 厚度，speed 像素/秒
  E.mist = function (g, o = {}) {
    const img = sp().tint(mistTex(o.seed ?? 1), o.color || '#f2eee6'), w = o.w ?? 1200, h = o.h ?? 160;
    const off = (((o.t || 0) * (o.speed ?? 8) + (o.offset || 0)) % w + w) % w;
    g.globalAlpha = o.alpha ?? 0.5;
    for (let x = off - w; x < W + 80; x += w) g.drawImage(img, x - 40, (o.y ?? 500) - h / 2, w, h);
    g.globalAlpha = 1;
  };

  // 山形贴图（与 XYT.sprites.mtn 同规格：宽 1800 循环、高 380）：形体遮罩 + 受光面遮罩一起生成，上色时再合成
  const RANGE = {
    far: { peaks: 8, wmin: 110, wmax: 250, hmin: 70, hmax: 200, rough: 9, fall: 130, pe: 1.4, floor: 0.4 },
    mid: { peaks: 10, wmin: 70, wmax: 180, hmin: 100, hmax: 270, rough: 13, fall: 95, pe: 1.15, floor: 0.5 },
    near: { peaks: 8, wmin: 60, wmax: 160, hmin: 110, hmax: 300, rough: 16, fall: 75, pe: 1.0, floor: 0.62, trees: 1 },
    karst: { peaks: 14, wmin: 26, wmax: 58, hmin: 120, hmax: 300, rough: 6, fall: 110, pe: 3.6, floor: 0.45, trees: 0.8 },
  };
  const rangeStore = new Map();
  function rangeMasks(seed, kind) {
    const sc = 0.5 * Math.min(1, sp().S), key = seed + kind + '@' + sc;
    let m = rangeStore.get(key);
    if (m) return m;
    const L = 1800, Hm = 380, o = RANGE[kind] || RANGE.mid, pw = Math.round(L * sc), ph = Math.round(Hm * sc);
    const mk = () => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; c.L = L; c.Hm = Hm; c.lw = L; c.lh = Hm; return c; };
    const shape = mk(), light = mk();
    const r = rng(seed * 31 + 7), peaks = [];
    for (let i = 0; i < o.peaks; i++) peaks.push({ c: ((i + r() * 0.8) / o.peaks) * L, w: lerp(o.wmin, o.wmax, r()), a: lerp(o.hmin, o.hmax, Math.pow(r(), 0.9)), e: o.pe * (0.8 + 0.4 * r()) });
    const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;
    const wrapN = (x, f, s) => lerp(noise1(x * f, s), noise1((x - L) * f, s), x / L);
    const hAt = (x) => {
      let h = 0;
      for (const p of peaks) { let dx = x - p.c; dx -= L * Math.round(dx / L); h = smax(h, p.a * Math.exp(-Math.pow(Math.abs(dx / p.w), p.e) * 1.6), 16); }
      h += o.rough * (2.2 * (wrapN(x, 0.008, seed) - 0.5) + 1.2 * (wrapN(x, 0.03, seed + 1) - 0.5) + 0.5 * (wrapN(x, 0.12, seed + 2) - 0.5));
      return Math.max(10, h);
    };
    // 山体里的前山：每座主峰两侧各生几座矮峰，作为内部的山脊线
    const subA = [], subB = [];
    for (const p of peaks) for (let k = 0; k < 2; k++) {
      const sd = r() < 0.5 ? -1 : 1;
      subA.push({ c: p.c + sd * p.w * (0.25 + r() * 0.6), w: p.w * (0.35 + r() * 0.4), a: p.a * (0.4 + r() * 0.35), e: p.e });
      subB.push({ c: p.c + (r() - 0.5) * p.w * 1.6, w: p.w * (0.4 + r() * 0.5), a: p.a * (0.18 + r() * 0.22), e: p.e });
    }
    const uni = (list, x) => { let h = 0; for (const p of list) { let dx = x - p.c; dx -= L * Math.round(dx / L); h = smax(h, p.a * Math.exp(-Math.pow(Math.abs(dx / p.w), p.e) * 1.6), 10); } return h; };
    const ridge = new Float32Array(pw), fold1 = new Float32Array(pw), fold2 = new Float32Array(pw);
    for (let px = 0; px < pw; px++) {
      const x = px / sc, h = hAt(x);
      ridge[px] = h;
      fold1[px] = Math.min(h - 4, uni(subA, x) + o.rough * 0.8 * (wrapN(x, 0.05, seed + 6) - 0.5));
      fold2[px] = Math.min(h - 4, uni(subB, x));
    }
    const gs = shape.getContext('2d'), gl = light.getContext('2d');
    const di = gs.createImageData(pw, ph), dl = gl.createImageData(pw, ph), D = di.data, Dl = dl.data;
    for (let px = 0; px < pw; px++) {
      const x = px / sc, h = ridge[px], top = Hm - h, fall = o.fall * (0.7 + 0.6 * noise1(x * 0.01, seed + 3));
      for (let py = Math.max(0, Math.floor(top * sc)); py < ph; py++) {
        const y = py / sc, dd = y - top;
        const streak = noise2(x * 0.09, y * 0.016, seed) * 0.7 + 0.3 * noise2(x * 0.35, y * 0.06, seed + 5);
        let a = lerp(o.floor, 1, Math.exp(-dd / fall)) * (0.7 + 0.3 * streak) + Math.exp(-dd / 1.5) * 0.22;
        // 山体内部的前一道山脊：线下加深，像一层层叠出来
        const d1 = y - (Hm - fold1[px]), d2 = y - (Hm - fold2[px]);
        if (d1 > 0) a += 0.22 * Math.exp(-d1 / (fall * 0.5)) + 0.1 * Math.exp(-d1 / 1.5);
        if (d2 > 0) a += 0.18 * Math.exp(-d2 / (fall * 0.4));
        a *= clamp(dd * sc * 1.2) * clamp((ph - py) / (40 * sc));
        // 受光面：朝左的坡亮；明暗交界随高度摆动，顺坡皴纹带出沟壑
        const sx = Math.round(px + (noise2(x * 0.02, y * 0.02, seed + 7) - 0.5) * 50 * sc);
        const q = ((sx % pw) + pw) % pw, slope = (ridge[(q + 2) % pw] - ridge[(q - 2 + pw) % pw]) * sc / 4;
        const lit = clamp(0.5 + 0.5 * Math.tanh(slope * 1.6) + (streak - 0.5) * 0.8) * (0.55 + 0.45 * noise2(x * 0.05, y * 0.01, seed + 9));
        const la = lit * Math.exp(-dd / (fall * 1.2)) * clamp(dd * sc * 0.6) * (d1 > 0 && d1 < 6 ? 0.4 : 1);
        const i = (py * pw + px) * 4;
        D[i + 3] = Math.min(255, a * 255); Dl[i + 3] = Math.min(255, la * a * 255);
      }
    }
    gs.putImageData(di, 0, 0); gl.putImageData(dl, 0, 0);
    if (o.trees) {
      // 山脊上的小松：疏密成簇
      gs.scale(sc, sc); gs.fillStyle = '#000'; gs.strokeStyle = '#000'; gs.lineCap = 'round';
      const nT = Math.round(160 * o.trees);
      for (let k = 0; k < nT; k++) {
        const cl = noise1(k * 0.15, seed + 11);
        if (cl < 0.45) continue;
        const x = (k / nT) * L + r() * 12, px = Math.floor(x * sc) % pw, top = Hm - ridge[px] + 1 + r() * 4, s = 0.35 + r() * 0.55;
        gs.lineWidth = 1 * s; gs.beginPath(); gs.moveTo(x, top + 3); gs.lineTo(x + (r() - 0.5) * 2, top - 13 * s); gs.stroke();
        for (let j = 0; j < 4; j++) { gs.beginPath(); gs.ellipse(x + (r() - 0.5) * 3 * s, top - (2.5 + j * 3) * s, (6.5 - j * 1.3) * s, 1.7 * s, (r() - 0.5) * 0.2, 0, TAU); gs.fill(); }
      }
    }
    m = { shape, light };
    rangeStore.set(key, m);
    return m;
  }
  function rangeTex(seed, kind, col, lit, litA) {
    const ms = rangeMasks(seed, kind), key = [seed, kind, col, lit, litA, ms.shape.width].join('|');
    let c = rangeStore.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = ms.shape.width; c.height = ms.shape.height;
      c.L = 1800; c.Hm = 380; c.lw = 1800; c.lh = 380;
      const g = c.getContext('2d');
      g.drawImage(sp().tint(ms.shape, col), 0, 0);
      g.globalAlpha = litA; g.globalCompositeOperation = 'source-atop';
      g.drawImage(sp().tint(ms.light, lit), 0, 0);
      rangeStore.set(key, c);
    }
    return c;
  }
  // 群山：layers [{color, light, litA, alpha, y, scaleY, speed, kind:'far'|'mid'|'near'|'karst', seed, offset, soft, rim, fog, fogA, fogH}]
  // kind 选山形（karst 为桂林式石峰林）；soft:true 改用共用的 XYT.sprites.mtn 柔和山形；light 受光面颜色、litA 其强度
  // 不给 layers 时按 n/far/near/light/y0/y1/scale/kind 自动生成：远淡偏冷、近深；fog 为层间雾色；rim 山脊受光（每层多贴一次）
  E.mountains = function (g, o = {}) {
    const t = o.t || 0;
    let layers = o.layers;
    if (!layers) {
      const n = o.n ?? 4, far = o.far || '#9fb1c6', near = o.near || '#1f2732', y0 = o.y0 ?? 460, y1 = o.y1 ?? 700, s = o.scale ?? 0.6, lt = o.light || '#ffffff';
      layers = [];
      for (let i = 0; i < n; i++) {
        const u = n > 1 ? i / (n - 1) : 1, col = mix(far, near, Math.pow(u, 0.85));
        layers.push({ color: col, light: mix(col, lt, 0.35 - 0.12 * u), alpha: lerp(0.92, 1, u), y: lerp(y0, y1, u), scaleY: s * lerp(0.55, 1, u), speed: lerp(1.5, 14, u) * (o.speed ?? 1), rim: o.rim ? mix(o.rim, far, u * 0.5) : null, kind: o.kind, soft: o.soft });
      }
    }
    const kinds = ['far', 'far', 'mid', 'mid', 'near', 'near'];
    layers.forEach((L, i) => {
      const kind = L.kind || kinds[Math.min(5, Math.round((i * 5) / Math.max(1, layers.length - 1)))];
      const seed = (L.seed ?? i) + (o.seed || 0) * 7;
      const v = L.speed ?? 6, off = (L.offset ?? i * 517 + (o.seed || 0) * 233) + t * v;
      let spr, col = L.color || '#4a5566';
      if (L.soft) spr = sp().mtn[kind === 'karst' ? 'mid' : kind][seed % 2];
      else { spr = rangeTex(seed, kind, col, L.light || mix(col, '#ffffff', 0.3), L.litA ?? 0.6); col = null; }
      if (L.rim) A.drawMountain(g, spr, L.rim, (L.alpha ?? 1) * (L.rimA ?? 0.8), off, L.y - (L.rimW ?? 1.8), L.scaleY ?? 1);
      A.drawMountain(g, spr, col, L.alpha ?? 1, off, L.y, L.scaleY ?? 1);
      const fc = L.fog === false ? null : L.fog || o.fog;
      if (fc && (i < layers.length - 1 || L.fog)) E.mist(g, { color: fc, alpha: L.fogA ?? o.fogA ?? 0.45, t, speed: -v * 1.7, offset: i * 311, y: L.y - (L.fogY ?? 6), h: L.fogH ?? 150, seed: i });
    });
  };

  function peakTex(h, w, col, light, seed) {
    const pw = Math.round(w * 2.2), ph = Math.round(h * 1.1);
    return cached('peak', [h | 0, w | 0, col, light, seed], pw, ph, 1, (g) => {
      const cx = pw / 2, base = ph, rr = rng(seed);
      const N = 90, L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const v = i / N, y = base - v * h;
        // 春笋形：底部外撇、中段微收、顶端圆收
        let half = (w / 2) * (1.0 - 0.28 * v + 0.35 * Math.exp(-v * 9));
        if (v > 0.9) half *= Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.9) / 0.1, 2))) * 0.35 + 0.65 * (1 - (v - 0.9) / 0.1 * 0.6);
        const step = (h2(Math.floor(v * 16), seed) - 0.5) * w * 0.07;
        L.push([cx - half + (noise1(v * 9, seed) - 0.5) * w * 0.14 + step + (noise1(v * 40, seed + 1) - 0.5) * w * 0.035, y]);
        R.push([cx + half + (noise1(v * 9, seed + 2) - 0.5) * w * 0.12 - step * 0.6 + (noise1(v * 40, seed + 3) - 0.5) * w * 0.035, y]);
      }
      const path = () => { g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (let i = N; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); };
      path();
      g.fillStyle = K.lin(g, cx - w * 0.6, 0, cx + w * 0.6, 0, [[0, mix(col, light, 0.6)], [0.3, mix(col, light, 0.28)], [0.62, col], [1, shade(col, -0.45)]]);
      g.fill();
      g.save(); path(); g.clip();
      // 横向岩层与竖向裂隙（皴）
      for (let k = 0; k < 46; k++) {
        const y = base - rr() * h, amp = 1 + rr() * 3;
        g.strokeStyle = `rgba(20,18,16,${0.06 + rr() * 0.14})`; g.lineWidth = 0.8 + rr() * 1.6;
        g.beginPath();
        for (let x = cx - w; x <= cx + w; x += 8) { const yy = y + Math.sin(x * 0.05 + k) * amp + (noise1(x * 0.04, k) - 0.5) * 4; x === cx - w ? g.moveTo(x, yy) : g.lineTo(x, yy); }
        g.stroke();
        g.strokeStyle = rgba(light, 0.05 + rr() * 0.07); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(cx - w, y + 2.5); g.lineTo(cx + w * (rr() - 0.2), y + 2 + amp); g.stroke();
      }
      for (let k = 0; k < 70; k++) {
        let x = cx + (rr() - 0.5) * w * 1.1, y = base - rr() * h;
        const len = 20 + rr() * 90, dark = x > cx ? 0.25 : 0.12;
        g.strokeStyle = `rgba(14,12,10,${dark * (0.4 + rr())})`; g.lineWidth = 0.6 + rr() * 1.4;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 6; s++) { x += (rr() - 0.5) * 5; y += len / 6; g.lineTo(x, y); }
        g.stroke();
      }
      // 暗面整体压一层，亮面边缘提亮
      g.fillStyle = K.lin(g, cx - w * 0.2, 0, cx + w * 0.7, 0, [[0, 'rgba(10,14,20,0)'], [1, 'rgba(10,14,20,0.35)']]);
      g.fillRect(0, 0, pw, ph);
      g.restore();
      g.strokeStyle = rgba(light, 0.55); g.lineWidth = 1.6;
      g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(x + 1, y) : g.moveTo(x + 1, y))); g.stroke();
      // 苔点与崖树
      const tree = (x, y, s, lean) => {
        g.strokeStyle = '#1a1d18'; g.lineWidth = 1.4 * s; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 6 * s, y - 10 * s, x + lean * 4 * s, y - 20 * s); g.stroke();
        for (let k = 0; k < 4; k++) {
          const yy = y - (8 + k * 4.5) * s, ww = (13 - k * 2.6) * s;
          g.fillStyle = k % 2 ? '#24342b' : '#1b2822';
          g.beginPath(); g.ellipse(x + lean * (3 + k) * s, yy, ww, 3.2 * s, lean * 0.1, 0, TAU); g.fill();
        }
      };
      const topY = base - h;
      for (let k = 0; k < 16; k++) tree(cx + (rr() - 0.5) * w * 0.55, topY + 9 + rr() * 6, 0.45 + rr() * 0.5, rr() - 0.5);
      for (let k = 0; k < 7; k++) {
        const i = 20 + Math.floor(rr() * 60), side = rr() < 0.5 ? L : R;
        tree(side[i][0] + (side === L ? 6 : -6), side[i][1], 0.5 + rr() * 0.5, side === L ? -0.8 : 0.8);
      }
      for (let k = 0; k < 90; k++) {
        const v = rr(), i = Math.floor(v * N), x = lerp(L[i][0], R[i][0], 0.08 + rr() * 0.84), y = L[i][1];
        g.fillStyle = `rgba(24,34,26,${0.25 + rr() * 0.45})`;
        g.beginPath(); g.ellipse(x, y, 1.2 + rr() * 2.2, 0.8 + rr() * 1.2, 0, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(28,38,30,0.6)';
      g.beginPath(); g.ellipse(cx, topY + 9, w * 0.3, 4, 0, 0, TAU); g.fill();
      // 底部渐隐进雾里
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = K.lin(g, 0, base - h * 0.22, 0, base, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      g.fillRect(0, base - h * 0.22, pw, h * 0.22 + 2);
      g.globalCompositeOperation = 'source-over';
    });
  }
  // 石笋孤峰（鼎湖峰）：(x, y) 为峰脚，h 高，w 宽；light 受光色（左侧），mist 峰脚雾色
  E.stonePeak = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, h = o.h ?? 420, w = o.w ?? h * 0.3, t = o.t || 0;
    const img = peakTex(h, w, o.color || '#5d5a52', o.light || '#e9d3a8', o.seed ?? 7);
    g.globalAlpha = o.alpha ?? 1;
    put(g, img, x, y);
    g.globalAlpha = 1;
    if (o.mist !== false) {
      const mc = o.mist || '#eef0f0';
      E.mist(g, { color: mc, alpha: 0.5, t, speed: -9, offset: x, y: y - h * 0.16, h: 140, seed: 5 });
      E.mist(g, { color: mc, alpha: 0.65, t, speed: 6, offset: x * 0.3 + 400, y: y - 8, h: 160, seed: 6 });
    }
  };

  // 古道荒坡：秋草连天，一条古道蜿蜒到坡顶；坡顶起伏在 y 之上 30 像素内（天空画到 y 即可无缝）；light 逆光色
  function grassBase(y, col, dark, path, seed) {
    return cached('grassRoad', [y | 0, col, dark, path ? 1 : 0, seed], W + 120, H - y + 80, 1, (g) => {
      g.translate(60, -y + 60);
      const rr = rng(seed + 11);
      const ridge = (x) => y - 20 + 10 * Math.sin(x * 0.004 + seed) + 16 * (noise1(x * 0.006, seed) - 0.5) - 8 * Math.exp(-Math.pow((x - 900) / 300, 2));
      g.beginPath(); g.moveTo(-60, H + 20);
      for (let x = -60; x <= W + 60; x += 10) g.lineTo(x, ridge(x));
      g.lineTo(W + 60, H + 20); g.closePath();
      g.fillStyle = K.lin(g, 0, y - 30, 0, H, [[0, mix(col, '#f2e3c4', 0.35)], [0.35, col], [1, dark]]);
      g.fill();
      g.save(); g.clip();
      // 起伏的光影
      for (let k = 0; k < 18; k++) A.softBlob(g, rr() * W, y + 20 + rr() * (H - y), 80 + rr() * 160, 0.12, k % 2 ? '#ffffff' : '#2a1d10');
      // 草纹：远处细密，近处粗长
      for (let k = 0; k < 2600; k++) {
        const v = Math.pow(rr(), 1.6), yy = lerp(y - 40, H + 10, v), x = rr() * (W + 120) - 60;
        if (yy < ridge(x) + 1) continue;
        const len = 2 + v * 16, lean = (rr() - 0.4) * len * 0.6;
        const tone = rr();
        g.strokeStyle = tone < 0.3 ? rgba(dark, 0.35 + v * 0.3) : tone < 0.8 ? rgba(shade(col, (rr() - 0.5) * 0.3), 0.5) : rgba('#f4e2b8', 0.35);
        g.lineWidth = 0.5 + v * 1.1;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + lean * 0.3, yy - len * 0.6, x + lean, yy - len); g.stroke();
      }
      if (path) {
        // 古道：近宽远窄，S 形伸向坡顶
        const cpt = (v) => [lerp(560, 860, v) + Math.sin(v * 5.2) * 120 * (1 - v), lerp(H + 30, ridge(860) + 2, Math.pow(v, 0.8))];
        const hw = (v) => lerp(120, 3, Math.pow(v, 0.55));
        const Lp = [], Rp = [];
        for (let i = 0; i <= 40; i++) { const v = i / 40, [px, py] = cpt(v), ww = hw(v); Lp.push([px - ww, py]); Rp.push([px + ww * 0.9, py]); }
        g.beginPath(); Lp.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); for (let i = 40; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath();
        g.fillStyle = K.lin(g, 0, ridge(860), 0, H, [[0, mix(col, '#efe2c6', 0.55)], [1, mix(dark, '#b49a72', 0.55)]]);
        g.fill();
        g.save(); g.clip();
        for (let k = 0; k < 180; k++) {
          const v = Math.pow(rr(), 0.7), [px, py] = cpt(v), ww = hw(v);
          const sx = px + (rr() - 0.5) * ww * 1.8, s = 1 + (1 - v) * 7;
          g.fillStyle = rr() < 0.5 ? 'rgba(70,56,40,0.35)' : 'rgba(250,240,220,0.3)';
          g.beginPath(); g.ellipse(sx, py + (rr() - 0.5) * 6, s, s * 0.45, 0, 0, TAU); g.fill();
        }
        for (const side of [-0.45, 0.4]) {
          g.strokeStyle = 'rgba(60,46,30,0.25)'; g.lineWidth = 2;
          g.beginPath(); for (let i = 0; i <= 30; i++) { const v = i / 30, [px, py] = cpt(v); i ? g.lineTo(px + hw(v) * side, py) : g.moveTo(px + hw(v) * side, py); } g.stroke();
        }
        g.restore();
        // 路边草压上路面
        for (let k = 0; k < 500; k++) {
          const v = rr(), [px, py] = cpt(v), ww = hw(v), sd = rr() < 0.5 ? -1 : 0.9;
          const x = px + sd * ww * (0.9 + rr() * 0.25), len = 3 + (1 - v) * 18;
          g.strokeStyle = rgba(rr() < 0.5 ? dark : col, 0.7); g.lineWidth = 0.6 + (1 - v) * 1.2;
          g.beginPath(); g.moveTo(x, py); g.quadraticCurveTo(x - sd * len * 0.2, py - len * 0.6, x - sd * len * 0.45, py - len); g.stroke();
        }
      }
      g.restore();
    });
  }
  E.grassRoad = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#b8924e', dark = o.dark || '#4a3820', wind = o.wind ?? 0.5, light = o.light || '#ffd9a0', seed = o.seed ?? 1;
    const img = grassBase(y, col, dark, o.path !== false, seed);
    g.drawImage(img, -60, y - 60, img.lw, img.lh);
    // 近景长草与芒花：逆光描边，随风摆
    const n = o.n ?? 150, gust = Math.sin(t * 0.7) * 0.5 + 0.5;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = h2(i, seed + 3) * (W + 80) - 40, by = H + 8 - h2(i, seed + 4) * 70;
      const len = 60 + h2(i, seed + 5) * 120, ph = x * 0.012 + i * 0.3;
      const sw = (Math.sin(t * 1.6 + ph) * 0.6 + gust * 0.8) * wind * len * 0.35 + len * 0.08;
      const tx = x + sw, ty = by - len + Math.abs(sw) * 0.25;
      g.strokeStyle = rgba(i % 3 ? dark : shade(col, -0.25), 0.9); g.lineWidth = 1.2 + h2(i, seed + 6) * 1.6;
      g.beginPath(); g.moveTo(x, by); g.quadraticCurveTo(x + sw * 0.15, by - len * 0.55, tx, ty); g.stroke();
      if (i % 4 === 0) {
        // 芒花穗：几道短丝，迎光一侧提亮
        for (let k = 0; k < 5; k++) {
          const u = k / 5, px = lerp(x + sw * 0.6, tx, u), py = lerp(by - len * 0.75, ty, u);
          g.strokeStyle = rgba(light, 0.55 - u * 0.2); g.lineWidth = 1;
          g.beginPath(); g.moveTo(px, py); g.lineTo(px + 8 + sw * 0.1, py + 6 - k); g.stroke();
        }
        K.lighter(g, () => A.glow(g, tx, ty, 9, light, 0.25));
      }
    }
  };

  // 雪原：y 地平线（雪丘起伏在 y 之上 25 像素内）；footprints {x0,y0,x1,y1,n,progress} 由近到远的一串脚印；red 0..1 雪染红
  E.snowfield = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 470, col = o.color || '#eef2f7', sh = o.shade || '#9fb0c8', seed = o.seed ?? 2;
    const img = cached('snow', [y | 0, col, sh, seed], W + 120, H - y + 40, 0.75, (g) => {
      g.translate(60, -y + 20);
      const rr = rng(seed + 5);
      const ridge = (x) => y - 12 + 6 * Math.sin(x * 0.005 + seed) + 8 * (noise1(x * 0.008, seed) - 0.5);
      g.beginPath(); g.moveTo(-60, H + 20);
      for (let x = -60; x <= W + 60; x += 12) g.lineTo(x, ridge(x));
      g.lineTo(W + 60, H + 20); g.closePath();
      g.fillStyle = K.lin(g, 0, y - 10, 0, H, [[0, mix(col, sh, 0.45)], [0.3, col], [0.7, mix(col, sh, 0.2)], [1, mix(col, sh, 0.45)]]);
      g.fill();
      g.save(); g.clip();
      for (let k = 0; k < 10; k++) A.softBlob(g, rr() * W, lerp(y + 20, H, rr()), 120 + rr() * 200, 0.18, k % 3 ? sh : '#ffffff');
      // 雪丘：上亮下蓝的长椭圆
      for (let k = 0; k < 16; k++) {
        const v = Math.pow(rr(), 1.3), yy = lerp(y + 6, H + 30, v), x = rr() * W, rx = (120 + rr() * 260) * (0.4 + v), ry = rx * (0.06 + 0.04 * v);
        g.fillStyle = K.lin(g, 0, yy - ry, 0, yy + ry, [[0, rgba('#ffffff', 0.55)], [0.45, rgba(col, 0)], [1, rgba(sh, 0.6)]]);
        g.beginPath(); g.ellipse(x, yy, rx, ry, 0, 0, TAU); g.fill();
      }
      // 风痕
      for (let k = 0; k < 120; k++) {
        const v = Math.pow(rr(), 1.5), yy = lerp(y + 4, H, v), x = rr() * W, len = (20 + rr() * 80) * (0.3 + v);
        g.strokeStyle = rgba(sh, 0.12 + 0.12 * v); g.lineWidth = 0.6 + v;
        g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + len * 0.5, yy - 1.5 * v, x + len, yy + 0.5); g.stroke();
      }
      g.restore();
    });
    g.drawImage(img, -60, y - 20, img.lw, img.lh);
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
    if (o.red) {
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = K.lin(g, 0, y, 0, H, [[0, rgba('#d3505a', o.red * 0.5)], [1, rgba('#a8102a', o.red * 0.85)]]);
      g.fillRect(-80, y - 4, W + 160, H - y + 30);
      g.globalCompositeOperation = op;
    }
    // 雪面闪光
    const sk = o.sparkle ?? 1;
    if (sk > 0) K.lighter(g, () => {
      for (let i = 0; i < 40; i++) {
        const v = h2(i, seed + 20), px = h2(i, seed + 21) * W, py = lerp(y + 8, H, Math.pow(v, 0.8));
        const a = Math.max(0, Math.sin(t * (1.5 + h2(i, seed + 22) * 3) + i * 1.7)) ** 6;
        if (a < 0.05) continue;
        A.glow(g, px, py, 3 + v * 6, '#ffffff', a * 0.8 * sk);
      }
    });
  };

  // 河岸：side 'left'|'right'，从画面边缘的 top 高度斜入水线 y；foam 浪花随 t 拍岸
  E.shore = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 560, top = o.top ?? y - 60, side = o.side || 'left', reach = o.reach ?? 520;
    const col = o.color || '#3b3228', wet = o.wet || shade(col, -0.35), foam = o.foam || '#f2efe6', seed = o.seed ?? 3;
    g.save();
    if (side === 'right') { g.translate(W, 0); g.scale(-1, 1); }
    const edge = (v) => [lerp(reach, 0, v) + Math.sin(v * 9 + seed) * 18 * (1 - v) + (noise1(v * 14, seed) - 0.5) * 30, lerp(y, H + 20, Math.pow(v, 0.8))];
    const img = cached('shore', [y | 0, top | 0, reach | 0, col, wet, seed], W, H - top + 30, 0.75, (c) => {
      c.translate(0, -top + 10);
      const rr = rng(seed);
      c.beginPath(); c.moveTo(-40, top);
      c.quadraticCurveTo(reach * 0.5, top - 6, reach + 20, y - 8);
      for (let i = 0; i <= 30; i++) { const [px, py] = edge(i / 30); c.lineTo(px, py); }
      c.lineTo(-40, H + 20); c.closePath();
      c.fillStyle = K.lin(c, 0, top, 0, H, [[0, shade(col, 0.25)], [0.4, col], [1, shade(col, -0.3)]]);
      c.fill();
      c.save(); c.clip();
      for (let k = 0; k < 400; k++) { c.fillStyle = rr() < 0.5 ? 'rgba(255,240,220,0.08)' : 'rgba(0,0,0,0.12)'; c.fillRect(rr() * reach, top + rr() * (H - top), 1 + rr() * 3, 1); }
      // 湿沙带
      c.lineWidth = 26; c.strokeStyle = rgba(wet, 0.55); c.lineJoin = 'round';
      c.beginPath(); for (let i = 0; i <= 30; i++) { const [px, py] = edge(i / 30); i ? c.lineTo(px - 10, py) : c.moveTo(px - 10, py); } c.stroke();
      c.restore();
      // 礁石
      for (let k = 0; k < 6; k++) {
        const v = 0.15 + rr() * 0.8, [px, py] = edge(v), s = (10 + rr() * 22) * (0.4 + v);
        c.fillStyle = shade(col, -0.55);
        A.inkBlob(c, px - s * 0.3, py - s * 0.2, s, k * 2.3, 0.3); c.fill();
        c.fillStyle = 'rgba(255,240,220,0.18)';
        c.beginPath(); c.ellipse(px - s * 0.6, py - s * 0.6, s * 0.45, s * 0.2, -0.3, 0, TAU); c.fill();
      }
    });
    g.drawImage(img, 0, top - 10, img.lw, img.lh);
    // 浪花拍岸：沿水线的白沫，随 t 涌上退下
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
    g.restore();
  };

  // ---------- 水 ----------
  // 水面：y 水平线，top/bottom 远近水色；reflectFn(g) 在翻转后的坐标里重画要倒映的景物（按原坐标画即可），
  // 自动做波纹错位；reflect 倒影强度，wobble 摆幅；glint {x, color, w, a} 日/月光柱；lines 波光条数
  // 注意：reflectFn 里不要再调用 water
  E.water = function (g, o = {}) {
    const y = o.y ?? 470, t = o.t || 0, top = o.top || '#41526e', bottom = o.bottom || '#0f1626', dh = H + 30 - y;
    vfill(g, -80, y, W + 80, H + 40, [[0, top], [(H - y) / (H + 40 - y), bottom], [1, bottom]]);
    if (o.reflectFn) {
      // 倒影先画进半分辨率缓冲（倒影本就柔一些），再逐条错位贴回：越近摆幅越大、条越宽
      const ra = o.reflect ?? 0.6, amp = o.wobble ?? 3, Sr = sp().S * (o.reflectScale ?? 0.5);
      const sg = scratchCtx(W + 160, dh, o.reflectScale ?? 0.5);
      sg.translate(80, y); sg.scale(1, -1);
      o.reflectFn(sg);
      g.globalAlpha = ra;
      let d = 0;
      while (d < dh) {
        const u = d / dh, hs = 1.6 + u * 7;
        const dx = Math.sin(d * 0.23 - t * 2.1) * amp * (0.25 + u * 1.6) + Math.sin(d * 0.061 + t * 0.9) * amp * 0.7 * u;
        g.drawImage(scratch, 0, d * Sr, (W + 160) * Sr, hs * Sr + 1, -80 + dx, y + d, W + 160, hs + 0.4);
        d += hs;
      }
      g.globalAlpha = 1;
      vfill(g, -80, y, W + 80, H + 40, [[0, rgba(top, 0.05)], [0.4, rgba(mix(top, bottom, 0.4), 0.28)], [(H - y) / (H + 40 - y), rgba(bottom, 0.72)], [1, rgba(bottom, 0.72)]]);
    }
    const gl = o.glint;
    if (gl) {
      const gx = gl.x ?? 640, gc = gl.color || '#ffe6b0', gw = gl.w ?? 40, ga = gl.a ?? 0.6;
      K.lighter(g, () => {
        for (let i = 0; i < 34; i++) {
          const u = i / 34, yy = y + 3 + Math.pow(u, 1.4) * (dh - 20);
          const w = gw * (0.35 + u * 1.6) * (0.6 + 0.6 * noise1(t * 1.4 + i * 0.7, 3));
          const x = gx + Math.sin(t * 1.7 + i * 1.3) * (3 + u * 10);
          g.fillStyle = rgba(gc, ga * (1 - u * 0.7) * (0.5 + 0.5 * noise1(t * 2.2 + i, 5)));
          g.fillRect(x - w / 2, yy, w, 1.5 + u * 2.5);
        }
        A.glow(g, gx, y + 6, gw * 2.5, gc, ga * 0.4);
      });
    }
    const n = o.lines ?? 40, lc = o.lineColor || '#ffffff', la = o.lineA ?? 0.22, flow = o.flow ?? 1;
    for (let i = 0; i < n; i++) {
      const u = Math.pow(h2(i, 41), 1.6), yy = y + 2 + u * (dh - 30);
      const len = (16 + h2(i, 42) * 80) * (0.35 + u * 1.7);
      const x = ((((h2(i, 43) * (W + 300) + t * (5 + 12 * u) * flow) % (W + 300)) + W + 300) % (W + 300)) - 150;
      const a = la * (0.4 + 0.6 * h2(i, 44)) * (0.55 + 0.45 * Math.sin(t * 1.2 + i * 2.3));
      g.fillStyle = rgba(lc, a);
      g.fillRect(x, yy, len, 0.8 + u * 1.6);
    }
    // 水天交界的薄雾
    if (o.mist !== false) {
      const mc = o.mist || mix(top, '#ffffff', 0.3);
      g.fillStyle = K.lin(g, 0, y - 14, 0, y + 18, [[0, rgba(mc, 0)], [0.5, rgba(mc, 0.45)], [1, rgba(mc, 0)]]);
      g.fillRect(-80, y - 14, W + 160, 32);
    }
  };

  // 潮水：叠在 water() 水面上，一排排浪由远到近（远细近大），浪高沿岸起伏、时断时续；
  // dir 1 向右（东）流，-1 向左；color 浪谷暗色，light 浪脊亮色，foam 浪花；glint {x, color, w} 让浪尖在日/月光下闪亮
  E.waves = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 480, y1 = o.y1 ?? H + 20, col = o.color || '#2d4658', foam = o.foam || '#eef3ef', dir = o.dir ?? 1;
    const rows = o.rows ?? 11, amp = o.amp ?? 1, spd = o.speed ?? 1, seed = o.seed ?? 5, light = o.light || mix(col, '#9fd0d0', 0.45), gl = o.glint;
    for (let r = 0; r < rows; r++) {
      const u = rows > 1 ? r / (rows - 1) : 1, z = Math.pow(u, 1.8);
      const yy = lerp(y, y1, z), A0 = (1.2 + 22 * z) * amp, lam = 40 + 300 * z;
      const off = t * (8 + 70 * z) * spd * dir + h2(r, seed) * 900;
      const step = Math.max(4, lam / 14);
      const hAt = (x) => { const n = noise1(x * 0.004 + r * 3.7 + t * 0.05 * dir, seed + r); return clamp((n - 0.28) * 1.6); };
      const fr = (x) => { let f = (x - off) / lam + 0.35 * noise1(x * 0.002 + r, seed + 9); f -= Math.floor(f); return dir < 0 ? 1 - f : f; };
      const prof = (x) => { const f = fr(x), q = f < 0.68 ? f / 0.68 : 1 - (f - 0.68) / 0.32; return Math.pow(Math.sin(q * PI * 0.5), 1.8); };
      const xs = [], top = [], bot = [];
      for (let x = -60; x <= W + 60; x += step) {
        const hh = hAt(x), p = prof(x);
        xs.push(x); top.push(yy - A0 * p * hh); bot.push(yy + A0 * (0.25 + 0.9 * (1 - p)) * hh);
      }
      // 浪背受光、浪谷背光
      g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, top[i]) : g.moveTo(x, top[i]))); for (let i = xs.length - 1; i >= 0; i--) g.lineTo(xs[i], yy);
      g.closePath(); g.fillStyle = rgba(light, 0.35 + 0.3 * z); g.fill();
      g.beginPath(); xs.forEach((x, i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); for (let i = xs.length - 1; i >= 0; i--) g.lineTo(xs[i], bot[i]);
      g.closePath(); g.fillStyle = rgba(col, 0.35 + 0.35 * z); g.fill();
      // 浪尖白沫：只在浪高处成片
      g.lineCap = 'round';
      const k0 = Math.floor((-80 - off) / lam) - 1, n = Math.ceil((W + 160) / lam) + 2;
      for (let k = k0; k < k0 + n; k++) {
        const cx = off + (k + (dir < 0 ? 0.32 : 0.68)) * lam;
        if (cx < -80 || cx > W + 80) continue;
        const hh = hAt(cx);
        if (hh < 0.45) continue;
        const cy = yy - A0 * hh;
        let fa = (0.25 + 0.6 * z) * (0.55 + 0.45 * Math.sin(t * 1.3 + k * 2.1)) * clamp((hh - 0.45) * 2.5);
        let fc = foam;
        if (gl) { const d = Math.abs(cx - (gl.x ?? 640)) / ((gl.w ?? 80) * (1 + z * 3)); if (d < 1) { fa = Math.min(1, fa + (1 - d) * 0.6); fc = gl.color || '#ffe0b0'; } }
        g.strokeStyle = rgba(fc, fa); g.lineWidth = 0.7 + 2.2 * z;
        g.beginPath(); g.moveTo(cx - dir * lam * 0.3 * hh, cy + A0 * 0.4 * hh); g.quadraticCurveTo(cx - dir * lam * 0.08, cy - A0 * 0.06, cx + dir * lam * 0.03, cy + A0 * 0.12 * hh); g.stroke();
        if (z > 0.3) {
          g.fillStyle = rgba(fc, fa * 0.7);
          for (let s = 0; s < 6; s++) {
            const px = cx - dir * (s * 0.05 + h2(k * 7 + s, seed) * 0.06) * lam, py = cy + A0 * (0.12 + s * 0.11) * hh + h2(k + s, r) * 4;
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
      g.globalAlpha = a * (o.alpha ?? 1);
      g.fillStyle = cols[i % cols.length];
      if (kind === 'maple') mapleLeaf(g, 0, 0, 6, 0); else { g.beginPath(); g.ellipse(0, 0, 4.2, 2.6, 0, 0, TAU); g.fill(); }
      g.restore();
    }
    g.globalAlpha = 1;
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
      const haze = Math.round(tipsTmp.length * bloom);
      for (let i = 0; i < haze; i++) { const [x, y] = tipsTmp[i]; A.softBlob(g, x, y, 26 + r() * 22, 0.2, pink); }
      arms.forEach(([a, len, sd]) => limbs(g, rng(sd), tx, ty, a, len, 8, 3, o, tips));
      const cols = [pink, mix(pink, '#ffffff', 0.45), mix(pink, '#d04a6a', 0.35), mix(pink, '#ffffff', 0.7)];
      const nb = Math.round(tips.length * bloom);
      for (let i = 0; i < nb; i++) {
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
    g.save(); g.translate(x, y); g.rotate(treeSway(o, x * 0.01)); g.globalAlpha = o.alpha ?? 1;
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
    g.save(); g.translate(x, y); g.rotate(treeSway(o, x * 0.013)); g.globalAlpha = o.alpha ?? 1;
    g.drawImage(img, -260 * s, -432 * s, 520 * s, 440 * s);
    g.restore();
    fallers(g, o, [x - 220 * s, y - 380 * s, x + 220 * s, y - 80 * s], 'maple', ['#c8361f', '#de6a26', '#e8a030', '#a62416']);
  };

  function pineTex(seed, col, ink) {
    return cached('pine', [seed, col, ink], 420, 460, 1, (g) => {
      const r = rng(seed * 23 + 3), bx = 210, by = 452, hh = 300 + r() * 80;
      g.lineCap = 'round'; g.lineJoin = 'round';
      // 树干：S 形，带鳞状树皮
      const sx = (u) => bx + Math.sin(u * 3.2 + seed) * 26 * u + (r() - 0.5) * 0;
      const pts = [];
      for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([sx(u), by - u * hh, lerp(17, 4, Math.pow(u, 0.8))]); }
      g.beginPath();
      pts.forEach(([x, y, w], i) => (i ? g.lineTo(x - w, y) : g.moveTo(x - w, y)));
      for (let i = 20; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
      g.closePath(); g.fillStyle = ink; g.fill();
      for (let k = 0; k < 60; k++) {
        const u = r() * 0.9, i = Math.floor(u * 20), [x, y, w] = pts[i];
        g.strokeStyle = r() < 0.5 ? 'rgba(160,140,110,0.35)' : 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(x + (r() - 0.5) * w * 1.2, y - r() * 12, w * 0.35, 2.2, 0.2, 0, PI); g.stroke();
      }
      g.strokeStyle = 'rgba(190,170,140,0.3)'; g.lineWidth = 2.5;
      g.beginPath(); pts.forEach(([x, y, w], i) => (i ? g.lineTo(x - w * 0.6, y) : g.moveTo(x - w * 0.6, y))); g.stroke();
      // 枝与针叶团
      const pads = [];
      const nb = 6 + Math.floor(r() * 3);
      for (let k = 0; k < nb; k++) {
        const u = 0.38 + (k / nb) * 0.6, i = Math.round(u * 20), [x, y, w] = pts[Math.min(20, i)];
        const side = k % 2 ? 1 : -1, len = (70 + r() * 90) * (1.1 - u * 0.6);
        let cx = x, cy = y, a = side > 0 ? -0.15 - r() * 0.2 : PI + 0.15 + r() * 0.2;
        g.strokeStyle = ink;
        for (let s = 0; s < 6; s++) {
          const nx = cx + Math.cos(a) * len / 6, ny = cy + Math.sin(a) * len / 6 + (s < 3 ? 2 : -2.5);
          g.lineWidth = lerp(w * 0.55, 1.5, s / 6); g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
          cx = nx; cy = ny; a += (r() - 0.5) * 0.3;
          if (s === 3 || s === 5) pads.push([cx, cy - 4, (s === 5 ? 1 : 0.7) * (1.15 - u * 0.4)]);
        }
      }
      pads.push([pts[20][0], pts[20][1] - 6, 0.85]);
      const dark = mix(col, '#000000', 0.4), lite = mix(col, '#d6e2b0', 0.5);
      // 针叶团：底下一层淡墨，上面一簇簇放射的松针（车轮松针），顶缘提亮
      // 针叶团底：几团大小不一的椭圆叠成不规则的云头
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
  // 松：x 或 xs（多棵）、y 树根；s 缩放；n 棵、gap 间距；t、wind 微摆
  E.pines = function (g, o = {}) {
    const n = o.n ?? 1, s0 = o.s ?? 1, y = o.y ?? 620;
    const xs = o.xs || Array.from({ length: n }, (_, i) => (o.x ?? 640) + (i - (n - 1) / 2) * (o.gap ?? 150) * s0);
    xs.forEach((x, i) => {
      const s = s0 * (i % 2 ? 0.8 : 1) * (o.sizes ? o.sizes[i] : 1);
      const img = pineTex((o.seed ?? 2) + i, o.color || '#2f4a3a', o.ink || '#231d1a');
      g.save(); g.translate(x, y + (o.ys ? o.ys[i] : 0)); g.rotate(treeSway(o, i * 1.7)); if (o.flip ?? (i % 2)) g.scale(-1, 1);
      g.globalAlpha = o.alpha ?? 1;
      g.drawImage(img, -210 * s, -452 * s, 420 * s, 460 * s);
      g.restore();
    });
  };

  function leaf(g, x, y, L, w, a) {
    g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.35, -w, L, 0); g.quadraticCurveTo(L * 0.35, w, 0, 0); g.fill();
    g.restore();
  }
  // 竹林：x0..x1 间 n 竿，y 根部，h 高；color 竹色；light 受光色；wind 0..1；leaf 叶量
  E.bamboo = function (g, o = {}) {
    const t = o.t || 0, x0 = o.x0 ?? 0, x1 = o.x1 ?? 400, y = o.y ?? H + 10, hgt = o.h ?? 640, col = o.color || '#2c4a36';
    const n = o.n ?? 8, seed = o.seed ?? 4, wind = o.wind ?? 0.4, lit = o.light || mix(col, '#e8f0c8', 0.4), lf = o.leaf ?? 1;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = lerp(x0, x1, (i + h2(i, seed)) / n), hh = hgt * (0.72 + 0.4 * h2(i, seed + 1)), w0 = (o.w ?? 9) * (0.7 + 0.5 * h2(i, seed + 2));
      const lean = (h2(i, seed + 3) - 0.5) * 0.18, ph = i * 1.3 + seed;
      const sw = wind * (Math.sin(t * 0.8 + ph) * 0.7 + Math.sin(t * 1.9 + ph * 2) * 0.3) * 0.07;
      const pt = (u) => [bx + (lean * u + sw * u * u) * hh, y - hh * u];
      const nodes = 10 + Math.floor(h2(i, seed + 4) * 4);
      for (let k = 0; k < nodes; k++) {
        const u0 = k / nodes, u1 = (k + 1) / nodes - 0.008, [ax, ay] = pt(u0), [bx2, by2] = pt(u1), w = w0 * (1 - u0 * 0.55);
        g.strokeStyle = col; g.lineWidth = w;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx2, by2); g.stroke();
        g.strokeStyle = rgba(lit, 0.45); g.lineWidth = w * 0.25;
        g.beginPath(); g.moveTo(ax - w * 0.22, ay - 2); g.lineTo(bx2 - w * 0.22, by2 + 2); g.stroke();
        g.strokeStyle = rgba(shade(col, -0.5), 0.9); g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(bx2 - w * 0.6, by2 + 1); g.lineTo(bx2 + w * 0.6, by2 + 1); g.stroke();
        // 上半部节上出枝，三五片叶下垂
        if (u0 > 0.38 && h2(i * 31 + k, seed) < 0.7 * lf) {
          const side = (k + i) % 2 ? 1 : -1, tl = (26 + h2(k, i + seed) * 34) * (o.leafS ?? 1);
          const ta = side > 0 ? -0.5 : PI + 0.5, tx = bx2 + Math.cos(ta) * tl, ty = by2 + Math.sin(ta) * tl * 0.6;
          g.strokeStyle = col; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(bx2, by2); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = k % 3 ? col : shade(col, 0.12);
          const nl = 3 + Math.floor(h2(k, i + seed + 1) * 3);
          for (let j = 0; j < nl; j++) {
            const fl = Math.sin(t * 2.6 + j + k + i) * 0.12 * wind;
            const da = 0.35 + j * (1.0 / nl) + h2(j, k) * 0.25;
            leaf(g, tx, ty, (26 + h2(j, k + i) * 18) * (o.leafS ?? 1), 3.6 * (o.leafS ?? 1), side > 0 ? da + fl : PI - da + fl);
          }
        }
      }
    }
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
    if (o.glow) K.lighter(g, () => A.glow(g, fx, fy - 18 * s, 70 * s, o.glowColor || '#ffc8d8', o.glow * 0.5));
    const petal = (a, L, w, dark) => {
      g.save(); g.translate(fx, fy); g.rotate(a);
      g.fillStyle = K.lin(g, 0, 0, 0, -L, [[0, mix('#fff6f2', col, dark * 0.3)], [0.55, mix('#ffe6ec', col, 0.25 + dark * 0.3)], [1, mix(col, '#a8304e', dark)]]);
      g.beginPath(); g.moveTo(0, 2 * s); g.bezierCurveTo(-w, -L * 0.25, -w * 0.7, -L * 0.8, 0, -L); g.bezierCurveTo(w * 0.7, -L * 0.8, w, -L * 0.25, 0, 2 * s); g.fill();
      g.strokeStyle = rgba(col, 0.25); g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.85); g.stroke();
      g.restore();
    };
    const L = 40 * s, w = 15 * s;
    // 后排 → 莲蓬 → 前排
    for (let k = 0; k < 5; k++) petal((k - 2) * lerp(0.12, 0.42, open), L * 0.92, w * 0.9, 0.35);
    if (open > 0.45) {
      g.fillStyle = K.lin(g, 0, fy - 14 * s, 0, fy - 4 * s, [[0, '#e8d870'], [1, '#9cab4c']]);
      g.beginPath(); g.ellipse(fx, fy - 10 * s, 9 * s * open, 4 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#6f7a2c';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(fx + (k - 2) * 3.2 * s * open, fy - 10.5 * s, 0.9 * s, 0, TAU); g.fill(); }
    }
    for (const k of [-3, 3]) petal(k * lerp(0.1, 0.42, open), L, w, 0.2);
    for (let k = 0; k < 4; k++) petal((k - 1.5) * lerp(0.08, 0.34, open), L * lerp(0.95, 0.72, open), w * 1.05, 0.05);
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
      if (light) K.lighter(g, () => A.glow(g, tx + 8, ty + 10, 16, light, 0.3));
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
      K.lighter(g, () => A.glow(g, tx, ty, r * 2.2, col, 0.25));
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
  // 灯光叠加：在若干窗洞位置画暖光，按 t 微闪
  function windowGlow(g, wins, lit, t, col, seed, halo = true) {
    if (lit <= 0) return;
    K.lighter(g, () => {
      wins.forEach(([x, y, w, h], i) => {
        const f = 0.8 + 0.2 * flick(t * 0.5, i + seed);
        g.fillStyle = rgba(col, 0.55 * lit * f);
        g.fillRect(x, y, w, h);
        if (halo) A.glow(g, x + w / 2, y + h / 2, Math.max(w, h) * 1.6, col, 0.35 * lit * f);
      });
    });
  }

  // ---------- 江南白墙黛瓦 ----------
  // 马头墙：山墙朝外，顶部逐级升高，每级盖一道黛瓦压顶、外端翘起
  function huiGable(g, x, y, w, h, o) {
    const steps = o.steps, sh = o.stepH, wall = o.wall, roofC = o.roof, segs = [];
    const n = steps * 2 + 1;
    for (let k = 0; k < n; k++) { const lvl = steps - Math.abs(k - steps); segs.push([x + (k / n) * w, x + ((k + 1) / n) * w, y - h - lvl * sh, lvl]); }
    g.fillStyle = wall;
    g.beginPath(); g.moveTo(x, y);
    for (const [a, b, top] of segs) { g.lineTo(a, top); g.lineTo(b, top); }
    g.lineTo(x + w, y); g.closePath(); g.fill();
    // 墨线腰带与压顶
    for (const [a, b, top, lvl] of segs) {
      g.fillStyle = rgba(shade(wall, -0.35), 0.5); g.fillRect(a, top + 3, b - a, 3);
      g.fillStyle = roofC;
      g.fillRect(a - 5, top - 6, b - a + 10, 7);
      g.fillStyle = shade(roofC, -0.4); g.fillRect(a - 5, top, b - a + 10, 1.6);
      g.fillStyle = shade(roofC, 0.3); g.fillRect(a - 5, top - 6, b - a + 10, 1.2);
      // 外端翘起的“马头”
      const out = a + (b - a) / 2 < x + w / 2 ? -1 : 1;
      if (lvl < steps || n === 1) {
        const ex = out < 0 ? a - 5 : b + 5;
        g.fillStyle = roofC;
        g.beginPath(); g.moveTo(ex - out * 10, top - 6); g.lineTo(ex + out * 2, top - 13); g.lineTo(ex + out * 1, top - 4); g.lineTo(ex - out * 12, top); g.closePath(); g.fill();
      }
    }
  }
  function huiHouse(g, hs, o) {
    const { x, w, h, type } = hs, y = hs.y, roofC = o.roof;
    const wall = mix(o.wall, hs.seed % 4 === 0 ? '#9a9890' : '#ffffff', hs.seed % 4 === 0 ? 0.12 : 0.05);
    if (type === 'gable') {
      // 山墙后面露出的屋坡
      const rt = y - h - hs.stepH * (hs.steps - 0.3);
      g.fillStyle = shade(roofC, 0.05);
      g.beginPath(); g.moveTo(x - w * 0.18, y - h + 6); g.lineTo(x - w * 0.02, rt); g.lineTo(x + w * 1.02, rt); g.lineTo(x + w * 1.18, y - h + 6); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(roofC, -0.5), 0.55); g.lineWidth = 1;
      for (let xx = x - w * 0.16; xx < x + w * 1.16; xx += 4.5) { const u = (xx - x) / w; g.beginPath(); g.moveTo(xx + (u < 0.5 ? 2 : -2), rt + 1); g.lineTo(xx + (u - 0.5) * 6, y - h + 6); g.stroke(); }
      g.fillStyle = shade(roofC, -0.4); g.fillRect(x - w * 0.18, y - h + 4, w * 1.36, 2);
      huiGable(g, x, y, w, h, { steps: hs.steps, stepH: hs.stepH, wall, roof: roofC });
    }
    else {
      // 檐面朝外：墙顶一道瓦坡，两端马头墙竖起
      const rh = hs.roofH;
      g.fillStyle = shade(roofC, -0.1);
      g.beginPath(); g.moveTo(x - 8, y - h + 2); g.lineTo(x + w + 8, y - h + 2); g.lineTo(x + w - 2, y - h - rh); g.lineTo(x + 2, y - h - rh); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(roofC, -0.5), 0.6); g.lineWidth = 1;
      for (let xx = x; xx < x + w; xx += 5) { g.beginPath(); g.moveTo(xx + 2, y - h - rh); g.lineTo(xx + (xx - x - w / 2) * 0.04, y - h + 2); g.stroke(); }
      g.fillStyle = shade(roofC, -0.45); g.fillRect(x - 8, y - h, w + 16, 3);
      g.fillStyle = wall; g.fillRect(x, y - h + 3, w, h - 3);
      for (const ex of [x - 6, x + w - 8]) {
        g.fillStyle = wall; g.fillRect(ex, y - h - rh - 18, 14, h + rh + 18);
        g.fillStyle = roofC; g.fillRect(ex - 4, y - h - rh - 24, 22, 7); g.fillRect(ex - 2, y - h - rh * 0.4 - 6, 18, 6);
        g.fillStyle = shade(roofC, -0.4); g.fillRect(ex - 4, y - h - rh - 18, 22, 1.5);
      }
    }
    // 雨痕与墙脚潮印
    const r = rng(hs.seed);
    for (let k = 0; k < 6; k++) {
      const sx = x + 6 + r() * (w - 12), len = h * (0.2 + r() * 0.5);
      g.fillStyle = K.lin(g, 0, y - h, 0, y - h + len, [[0, rgba(shade(wall, -0.4), 0.18)], [1, rgba(shade(wall, -0.4), 0)]]);
      g.fillRect(sx, y - h + 4, 2 + r() * 5, len);
    }
    g.fillStyle = K.lin(g, 0, y - h * 0.22, 0, y, [[0, rgba(shade(wall, -0.5), 0)], [1, rgba(shade(wall, -0.5), 0.35)]]);
    g.fillRect(x, y - h * 0.22, w, h * 0.22);
    if (o.light) {
      g.save(); g.globalCompositeOperation = 'source-atop';
      g.fillStyle = K.lin(g, x, 0, x + w, 0, o.lightDir > 0 ? [[0, rgba(o.light, 0)], [1, rgba(o.light, 0.32)]] : [[0, rgba(o.light, 0.32)], [1, rgba(o.light, 0)]]);
      g.fillRect(x - 10, y - h - 80, w + 20, h + 80);
      g.restore();
    }
    // 门与门罩、小窗
    if (hs.door) {
      const dw = Math.min(26, w * 0.3), dx = x + w * hs.door - dw / 2, dh = Math.min(h * 0.5, 44);
      g.fillStyle = '#2a211c'; g.fillRect(dx, y - dh, dw, dh);
      g.fillStyle = 'rgba(120,100,80,0.5)'; g.fillRect(dx - 3, y - dh - 2, dw + 6, 2);
      roof(g, dx + dw / 2, y - dh - 6, dw + 16, 10, { color: roofC, tiles: false, curl: 0.5 });
    }
    for (const [wx, wy, ww, wh] of hs.wins) { g.fillStyle = '#2b2622'; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(wx, wy + wh, ww, 1.5); }
  }
  const townStore = new Map();
  function townLayout(seed, x0, x1, base, sc) {
    const key = [seed, x0, x1, base, sc].join('|');
    let L = townStore.get(key);
    if (L) return L;
    const r = rng(seed * 97 + 3), rows = [[], []];
    for (let row = 0; row < 2; row++) {
      const s = sc * (row ? 1 : 0.72), y = base - (row ? 0 : 26 * sc);
      let x = x0 - 40 - r() * 40;
      while (x < x1 + 40) {
        const gable = r() < 0.55, w = (gable ? 70 + r() * 70 : 90 + r() * 110) * s, h = (gable ? 70 + r() * 50 : 55 + r() * 40) * s;
        const hs = { x, w, h, y: y + (r() - 0.5) * 6 * s, type: gable ? 'gable' : 'eave', steps: 1 + Math.floor(r() * 2.6), stepH: (12 + r() * 6) * s, roofH: (16 + r() * 10) * s, seed: Math.floor(r() * 1e6), door: r() < 0.6 ? 0.25 + r() * 0.5 : 0, wins: [] };
        const nw = Math.floor(r() * 3);
        for (let k = 0; k < nw; k++) { const ww = (8 + r() * 6) * s, wh = (9 + r() * 8) * s; hs.wins.push([x + (0.15 + r() * 0.7) * w - ww / 2, hs.y - h * (0.55 + r() * 0.3), ww, wh]); }
        rows[row].push(hs);
        x += w * (0.7 + r() * 0.45) + (r() < 0.2 ? 30 * s : 0);
      }
    }
    // 前排在后排之前：同排里随机交错先后，营造层叠
    rows.forEach((rw) => rw.sort((a, b) => a.seed % 3 - b.seed % 3));
    L = { rows };
    townStore.set(key, L);
    return L;
  }
  // 江南水乡：y 墙脚线（多为水岸），color 墙色，roof 黛瓦色，haze 远排融入的雾色；lit 0..1 窗里亮灯；scale 尺寸
  // light/lightX 墙面受光色与光源横坐标（如夕阳）；bank:false 不画青石驳岸
  E.jiangnanTown = function (g, o = {}) {
    const t = o.t || 0, y = o.y ?? 520, wall = o.color || '#ece5d6', roofC = o.roof || '#34363c', haze = o.haze || '#c9ccd2', seed = o.seed ?? 1, sc = o.scale ?? 1;
    const x0 = o.x0 ?? 0, x1 = o.x1 ?? W, lit = o.lit || 0;
    const L = townLayout(seed, x0, x1, y, sc);
    const pad = 40, top = y - 230 * sc, hh = y - top + 20;
    const rowTex = (k) => cached('town', [seed, x0, x1, y, sc, wall, roofC, haze, k, o.light || '-', o.lightX ?? 0, o.bank === false ? 0 : 1], x1 - x0 + pad * 2, hh, 1, (c) => {
      c.translate(-x0 + pad, -top);
      const w2 = k ? wall : mix(wall, haze, 0.45), r2 = k ? roofC : mix(roofC, haze, 0.5);
      L.rows[k].forEach((hs) => huiHouse(c, hs, { wall: w2, roof: r2, light: o.light ? mix(o.light, haze, k ? 0 : 0.5) : null, lightDir: (hs.x + hs.w / 2) < (o.lightX ?? W / 2) ? 1 : -1 }));
      if (!k) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(haze, 0.25); c.fillRect(x0 - pad, top, x1 - x0 + pad * 2, hh); c.globalCompositeOperation = 'source-over'; }
      else if (o.bank !== false) {
        // 青石驳岸
        const bh = 14 * sc, stone = o.stone || '#6f6d68', rr = rng(seed + 77);
        c.fillStyle = K.lin(c, 0, y - 2, 0, y + bh, [[0, shade(stone, 0.2)], [1, shade(stone, -0.35)]]);
        c.fillRect(x0 - pad, y - 2, x1 - x0 + pad * 2, bh + 2);
        c.strokeStyle = rgba(shade(stone, -0.5), 0.6); c.lineWidth = 1;
        for (let xx = x0 - pad, row = 0; xx < x1 + pad; xx += 26 * sc + rr() * 12 * sc) { c.beginPath(); c.moveTo(xx, y - 2); c.lineTo(xx, y + bh * 0.5); c.moveTo(xx + 12 * sc, y + bh * 0.5); c.lineTo(xx + 12 * sc, y + bh); c.stroke(); row++; }
        c.beginPath(); c.moveTo(x0 - pad, y + bh * 0.5); c.lineTo(x1 + pad, y + bh * 0.5); c.stroke();
        c.fillStyle = 'rgba(40,60,50,0.35)'; c.fillRect(x0 - pad, y + bh - 3, x1 - x0 + pad * 2, 3);
      }
    });
    for (const k of [0, 1]) {
      const img = rowTex(k);
      g.drawImage(img, x0 - pad, top, img.lw, img.lh);
      if (lit > 0) {
        const wins = [];
        L.rows[k].forEach((hs) => hs.wins.forEach((wn, i) => { if ((hs.seed + i) % 3 !== 0) wins.push(wn); }));
        windowGlow(g, wins, lit * (k ? 1 : 0.7), t, o.lightColor || '#ffb45a', seed + k);
      }
    }
  };

  // 院墙：(x, y) 为墙顶左端，w 宽，h 墙高（默认到画面底）；light 墙面受光色（如夕照），lightX 光源横坐标；
  // window 'lattice' 漏窗 | 'moon' 月洞门（winX 中心、winR 半径）；through(g) 在洞口里画墙外景色
  E.courtyardWall = function (g, o = {}) {
    const x = o.x ?? 0, y = o.y ?? 360, w = o.w ?? W, h = o.h ?? H - y + 20, col = o.color || '#e9e2d4', roofC = o.roof || '#3a3c42', light = o.light || null, seed = o.seed ?? 4;
    const lx = o.lightX ?? x + w * 0.65, cap = o.cap ?? 30;
    const img = cached('cwall', [x | 0, y | 0, w | 0, h | 0, col, roofC, light || '-', lx | 0, cap, seed], w + 40, h + cap + 30, 1, (c) => {
      c.translate(-x + 20, -y + cap + 14);
      const r = rng(seed), bot = y + h;
      c.fillStyle = K.lin(c, 0, y, 0, bot, [[0, light ? mix(col, light, 0.3) : col], [0.5, col], [1, shade(col, -0.2)]]);
      c.fillRect(x, y, w, h);
      if (light) {
        c.fillStyle = rad(c, lx, y, 10, lx, y, w * 0.6, [[0, rgba(light, 0.4)], [0.5, rgba(light, 0.12)], [1, rgba(light, 0)]]);
        c.fillRect(x, y, w, h);
      }
      // 斑驳：灰皮剥落、补过的白灰、雨痕
      for (let k = 0; k < Math.round(w / 40); k++) { c.fillStyle = rgba(shade(col, -0.3), 0.04 + r() * 0.06); A.inkBlob(c, x + r() * w, y + 30 + r() * h * 0.8, 8 + r() * 30, k, 0.5); c.fill(); }
      for (let k = 0; k < Math.round(w / 90); k++) { c.fillStyle = rgba('#ffffff', 0.08 + r() * 0.08); A.inkBlob(c, x + r() * w, y + 50 + r() * h * 0.6, 16 + r() * 34, k + 40, 0.45); c.fill(); }
      for (let k = 0; k < Math.round(w / 30); k++) {
        const sx = x + r() * w, len = 30 + r() * h * 0.55;
        c.fillStyle = K.lin(c, 0, y, 0, y + len, [[0, rgba(shade(col, -0.45), 0.22)], [1, rgba(shade(col, -0.45), 0)]]);
        c.fillRect(sx, y + 10, 1.5 + r() * 6, len);
      }
      // 青石墙基与青苔
      const ph = Math.min(46, h * 0.16), py = bot - ph;
      c.fillStyle = K.lin(c, 0, py, 0, bot, [[0, '#7a7870'], [1, '#4c4b46']]);
      c.fillRect(x, py, w, ph);
      c.strokeStyle = 'rgba(30,30,28,0.5)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, py + ph / 2); c.lineTo(x + w, py + ph / 2); c.stroke();
      for (let xx = x, k = 0; xx < x + w; xx += 50 + r() * 30, k++) { c.beginPath(); c.moveTo(xx, py + (k % 2 ? 0 : ph / 2)); c.lineTo(xx, py + (k % 2 ? ph / 2 : ph)); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, py, w, 2);
      c.fillStyle = K.lin(c, 0, py - 40, 0, py, [[0, 'rgba(70,84,56,0)'], [1, 'rgba(70,84,56,0.3)']]);
      c.fillRect(x, py - 40, w, 40);
      // 檐下阴影
      c.fillStyle = K.lin(c, 0, y, 0, y + 34, [[0, 'rgba(20,18,16,0.45)'], [1, 'rgba(20,18,16,0)']]);
      c.fillRect(x, y, w, 34);
      // 瓦檐压顶：前坡瓦垄、檐口瓦当滴水、屋脊两端起翘
      const ct = y - cap * 0.7;
      c.fillStyle = K.lin(c, 0, ct, 0, y + 4, [[0, shade(roofC, 0.2)], [1, shade(roofC, -0.15)]]);
      c.beginPath(); c.moveTo(x - 12, y + 4); c.lineTo(x + w + 12, y + 4); c.lineTo(x + w + 6, ct); c.lineTo(x - 6, ct); c.closePath(); c.fill();
      for (let xx = x - 8; xx < x + w + 10; xx += 8) {
        c.strokeStyle = rgba(shade(roofC, -0.55), 0.85); c.lineWidth = 2.2; c.beginPath(); c.moveTo(xx, ct); c.lineTo(xx, y + 2); c.stroke();
        c.strokeStyle = rgba(shade(roofC, 0.6), 0.22); c.lineWidth = 1.2; c.beginPath(); c.moveTo(xx + 2.6, ct); c.lineTo(xx + 2.6, y + 2); c.stroke();
      }
      for (let xx = x - 8; xx < x + w + 10; xx += 8) {
        c.fillStyle = shade(roofC, -0.3); c.beginPath(); c.arc(xx + 1, y + 5, 3.6, 0, TAU); c.fill();
        c.fillStyle = rgba(shade(roofC, 0.5), 0.3); c.beginPath(); c.arc(xx + 0.5, y + 4.2, 1.6, 0, TAU); c.fill();
        c.fillStyle = shade(roofC, -0.4); c.beginPath(); c.moveTo(xx + 5, y + 4); c.lineTo(xx + 9, y + 4); c.lineTo(xx + 7, y + 10); c.closePath(); c.fill();
      }
      const rt = y - cap;
      c.fillStyle = shade(roofC, -0.3); c.fillRect(x - 8, rt, w + 16, cap * 0.32);
      c.fillStyle = shade(roofC, 0.35); c.fillRect(x - 8, rt, w + 16, 1.6);
      for (const [ex, sd] of [[x - 8, -1], [x + w + 8, 1]]) {
        c.fillStyle = shade(roofC, -0.3);
        c.beginPath(); c.moveTo(ex, rt); c.quadraticCurveTo(ex + sd * 10, rt - 4, ex + sd * 16, rt - 14); c.lineTo(ex + sd * 12, rt + cap * 0.32); c.lineTo(ex, rt + cap * 0.4); c.closePath(); c.fill();
      }
      if (light) { c.fillStyle = rgba(light, 0.4); c.fillRect(x - 8, rt, w + 16, 2.5); c.fillStyle = rgba(light, 0.15); c.fillRect(x - 8, ct, w + 16, 4); }
    });
    g.drawImage(img, x - 20, y - cap - 14, img.lw, img.lh);
    const win = o.window;
    if (win) {
      const bot = y + h - Math.min(46, h * 0.16) * 0, R = o.winR ?? (win === 'moon' ? 130 : 46);
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

  // 灯笼：(x, y) 为挂点；s 缩放；color 灯罩色；lit 0..1；swing 摆幅；kind 'round' 圆灯 | 'palace' 宫灯；text 灯上字
  E.lantern = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 200, s = o.s ?? 1, t = o.t || 0, col = o.color || '#d0362a', lit = o.lit ?? 1, seed = o.seed ?? 0;
    const ang = (o.swing ?? 0.06) * Math.sin(t * 1.6 + seed) + (o.tilt || 0);
    const cord = (o.cord ?? 16) * s;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.strokeStyle = '#2a1c14'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, cord); g.stroke();
    g.translate(0, cord);
    const f = 0.85 + 0.15 * flick(t, seed + 3), R = 17 * s, Hh = o.kind === 'palace' ? 30 * s : 24 * s;
    if (lit > 0) K.lighter(g, () => A.glow(g, 0, Hh * 0.55, R * 4.2, o.glowColor || '#ff9a4a', 0.5 * lit * f));
    g.fillStyle = '#2a1c14'; g.fillRect(-R * 0.45, 0, R * 0.9, 3.5 * s); g.fillRect(-R * 0.45, Hh + 3 * s, R * 0.9, 3.5 * s);
    const body = (lit > 0 ? mix(col, '#ffcf80', 0.35 * lit * f) : col);
    g.fillStyle = rad(g, -R * 0.25, Hh * 0.45, R * 0.1, 0, Hh * 0.55, R * 1.1, [[0, lit > 0 ? mix(body, '#fff2c0', 0.55 * lit * f) : shade(col, 0.15)], [0.7, body], [1, shade(col, -0.35)]]);
    g.beginPath();
    if (o.kind === 'palace') { g.moveTo(-R * 0.8, 3 * s); g.lineTo(R * 0.8, 3 * s); g.lineTo(R, Hh * 0.5); g.lineTo(R * 0.8, Hh + 3 * s); g.lineTo(-R * 0.8, Hh + 3 * s); g.lineTo(-R, Hh * 0.5); g.closePath(); }
    else g.ellipse(0, Hh * 0.55 + 1.5 * s, R, Hh * 0.55, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(shade(col, -0.5), 0.45); g.lineWidth = 0.8 * s;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, Hh * 0.55 + 1.5 * s, Math.abs(k) * R * 0.33 + 0.1, Hh * 0.55, 0, 0, TAU); g.stroke(); }
    if (o.text) glyphs(g, o.text, 0, Hh * 0.58, 15 * s, rgba('#2a1208', 0.8));
    // 流苏
    const sw = Math.sin(t * 2.3 + seed) * 2 * s;
    g.strokeStyle = o.tassel || '#c9a24a'; g.lineWidth = 1 * s;
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * 1.4 * s, Hh + 6 * s); g.quadraticCurveTo(k * 1.6 * s + sw * 0.5, Hh + 14 * s, k * 1.8 * s + sw, Hh + 22 * s); g.stroke(); }
    g.restore();
  };

  // ---------- 客栈 ----------
  function innTex(sq, wood, roofC, wallC, sign) {
    return cached('inn', [sq, wood, roofC, wallC, sign, fontKey(sign)], 480, 340, sq, (g) => {
      const cx = 240, y = 330, dark = shade(wood, -0.45);
      g.fillStyle = '#5b5650'; g.fillRect(cx - 200, y - 10, 400, 10);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(cx - 200, y - 10, 400, 1.5);
      // 一层：柱、门板、中间敞门
      g.fillStyle = wallC; g.fillRect(cx - 178, y - 118, 356, 108);
      for (const px of [-176, -64, 56, 168]) { g.fillStyle = wood; g.fillRect(cx + px, y - 120, 8, 110); }
      for (const [x0, x1] of [[-168, -64], [64, 168]]) {
        for (let k = 0; k < 3; k++) { const ww = (x1 - x0) / 3; lattice(g, cx + x0 + k * ww + 3, y - 106, ww - 6, 46, dark, '#c9b48e'); g.fillStyle = dark; g.fillRect(cx + x0 + k * ww + 3, y - 56, ww - 6, 44); }
      }
      g.fillStyle = '#20150e'; g.fillRect(cx - 56, y - 112, 112, 102);
      // 招牌
      g.fillStyle = '#2a1a10'; g.fillRect(cx - 52, y - 150, 104, 30);
      g.strokeStyle = '#b48a3c'; g.lineWidth = 2; g.strokeRect(cx - 49, y - 147, 98, 24);
      glyphs(g, sign, cx, y - 134, 21, '#e2b860');
      // 腰檐
      roof(g, cx, y - 120, 400, 26, { color: roofC, curl: 0.55, ridge: 0.98, tileW: 7 });
      // 二层：退进、美人靠、格窗
      g.fillStyle = wallC; g.fillRect(cx - 160, y - 236, 320, 94);
      for (let k = 0; k < 6; k++) lattice(g, cx - 150 + k * 50, y - 226, 44, 52, dark, '#d8c49a');
      for (const px of [-162, 154]) { g.fillStyle = wood; g.fillRect(cx + px, y - 238, 8, 96); }
      g.fillStyle = shade(wood, 0.1); g.fillRect(cx - 172, y - 168, 344, 6);
      railing(g, cx - 170, cx + 170, y - 144, 22, dark, { gap: 22 });
      // 顶檐
      roof(g, cx, y - 236, 420, 64, { color: roofC, curl: 0.42, ridge: 0.6, tileW: 8 });
    });
  }
  // 客栈：(x, y) 为台基中点；s 缩放；lit 0..1 灯火；sign 招牌字，flag 酒旗字（false 不画）；wind 酒旗风力；bank 临水石台基
  E.inn = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.8, wind = o.wind ?? 0.5;
    const sq = Math.max(0.5, Math.round(s * 4) / 4);
    const img = innTex(sq, o.wood || '#5b3a26', o.roof || '#383a40', o.wall || '#e4d8c2', o.sign || '客栈');
    if (o.bank) {
      // 临水的石砌台基
      const bh = (o.bankH ?? 90) * s, stone = o.stone || '#6c6a64';
      g.fillStyle = K.lin(g, 0, y, 0, y + bh, [[0, shade(stone, 0.15)], [1, shade(stone, -0.45)]]);
      g.fillRect(x - 230 * s, y - 2, 460 * s, bh);
      g.strokeStyle = rgba(shade(stone, -0.55), 0.6); g.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const yy = y + (k * bh) / 4;
        for (let xx = x - 230 * s + (k % 2) * 20 * s - 20 * s, j = 0; xx < x + 230 * s; xx += 40 * s, j++) {
          const v = h2(j, k + 3);
          g.fillStyle = v < 0.5 ? rgba('#000000', 0.06 + v * 0.1) : rgba('#ffffff', (v - 0.5) * 0.12);
          const xa = Math.max(xx, x - 230 * s), xb = Math.min(xx + 40 * s, x + 230 * s);
          g.fillRect(xa, yy, xb - xa, bh / 4);
          g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + bh / 4); g.stroke();
        }
        g.beginPath(); g.moveTo(x - 230 * s, yy); g.lineTo(x + 230 * s, yy); g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(x - 230 * s, y - 2, 460 * s, 2);
      g.fillStyle = K.lin(g, 0, y + bh * 0.6, 0, y + bh, [[0, 'rgba(30,50,40,0)'], [1, 'rgba(30,50,40,0.45)']]); g.fillRect(x - 230 * s, y + bh * 0.6, 460 * s, bh * 0.4);
    }
    g.drawImage(img, x - 240 * s, y - 330 * s, 480 * s, 340 * s);
    const L = (lx, ly, w, h) => [x + lx * s, y + ly * s, w * s, h * s];
    // 门里与窗纸的暖光
    if (lit > 0) {
      K.lighter(g, () => {
        g.fillStyle = K.lin(g, 0, y - 112 * s, 0, y, [[0, rgba('#ff9a48', 0.25 * lit)], [1, rgba('#ffcf80', 0.55 * lit)]]);
        g.fillRect(x - 56 * s, y - 112 * s, 112 * s, 102 * s);
        A.glow(g, x, y - 40 * s, 110 * s, '#ffb060', 0.35 * lit);
      });
      const up = [], low = [];
      for (let k = 0; k < 6; k++) up.push(L(-150 + k * 50, -226, 44, 52));
      for (const x0 of [-168, 64]) for (let k = 0; k < 3; k++) low.push(L(x0 + k * 34.7 + 3, -106, 28.7, 46));
      windowGlow(g, up, lit * 0.6, t, o.lightColor || '#ffb45a', 7, false);
      windowGlow(g, low, lit * 0.6, t, o.lightColor || '#ffb45a', 9, false);
      K.lighter(g, () => A.glow(g, x, y - 200 * s, 200 * s, o.lightColor || '#ffb45a', 0.25 * lit));
    }
    E.lantern(g, { x: x - 100 * s, y: y - 118 * s, s: s * 0.9, t, lit, seed: 1, cord: 10 });
    E.lantern(g, { x: x + 100 * s, y: y - 118 * s, s: s * 0.9, t, lit, seed: 2, cord: 10 });
    // 酒旗：竹竿横挑，布幡从横杆垂下随风摆
    if (o.flag !== false) {
      const px = x + 236 * s, top = y - 330 * s;
      g.strokeStyle = '#4a3523'; g.lineCap = 'round'; g.lineWidth = 5 * s;
      g.beginPath(); g.moveTo(px, y); g.lineTo(px, top); g.stroke();
      g.lineWidth = 3 * s; g.beginPath(); g.moveTo(px, top + 8 * s); g.lineTo(px - 60 * s, top + 4 * s); g.stroke();
      const flag = o.flag || '酒', fw = 48, fh = 128;
      const ftex = cached('wineflag', [flag, fontKey(flag)], fw, fh, Math.max(1, sq), (c) => {
        c.fillStyle = '#efe4c8'; c.fillRect(0, 0, fw, fh - 14);
        c.beginPath(); c.moveTo(0, fh - 14); c.lineTo(fw / 4, fh); c.lineTo(fw / 2, fh - 14); c.lineTo((fw * 3) / 4, fh); c.lineTo(fw, fh - 14); c.closePath(); c.fill();
        c.strokeStyle = '#b8352a'; c.lineWidth = 4; c.strokeRect(3, 3, fw - 6, fh - 20);
        c.fillStyle = 'rgba(120,90,50,0.12)'; for (let k = 0; k < 6; k++) c.fillRect(0, 14 + k * 16, fw, 1);
        glyphs(c, flag, fw / 2, (fh - 14) / 2, 34, '#1c1410');
      });
      g.save(); g.translate(px - 56 * s, top + 6 * s);
      cloth(g, ftex, 0, 0, fw * s, fh * s, t, { amp: (4 + 10 * wind) * s, bias: 16 * wind * s, freq: 0.9, speed: 2.6 + wind * 2, n: 18, shade: 0.3 });
      g.restore();
    }
  };

  // ---------- 码头与乌篷船 ----------
  function wupengTex(col) {
    return cached('wupeng', [col], 300, 110, 1, (g) => {
      const y = 82, dk = shade(col, -0.5);
      // 船身：两头上翘
      g.fillStyle = K.lin(g, 0, y - 20, 0, y + 14, [[0, shade(col, 0.15)], [1, dk]]);
      g.beginPath(); g.moveTo(8, y - 22); g.quadraticCurveTo(40, y + 10, 150, y + 12); g.quadraticCurveTo(250, y + 10, 294, y - 26);
      g.lineTo(286, y - 18); g.quadraticCurveTo(240, y - 4, 150, y - 4); g.quadraticCurveTo(50, y - 4, 16, y - 14); g.closePath(); g.fill();
      g.strokeStyle = rgba('#e8d8b8', 0.25); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(20, y - 12); g.quadraticCurveTo(150, y - 2, 282, y - 16); g.stroke();
      // 乌篷：三段竹篾拱篷，中段最大
      const arch = (a, b, hgt, c2) => {
        g.fillStyle = c2;
        g.beginPath(); g.moveTo(a, y - 4); g.quadraticCurveTo(a - 2, y - 4 - hgt * 1.1, (a + b) / 2, y - 4 - hgt); g.quadraticCurveTo(b + 2, y - 4 - hgt * 1.1, b, y - 4); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(200,190,170,0.18)'; g.lineWidth = 0.8;
        for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(a + ((b - a) * k) / 6, y - 4); g.quadraticCurveTo(a + ((b - a) * k) / 6, y - 4 - hgt * 0.9, (a + b) / 2, y - 4 - hgt + 1); g.stroke(); }
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(a, y - 4); g.quadraticCurveTo(a - 2, y - 4 - hgt * 1.1, (a + b) / 2, y - 4 - hgt); g.stroke();
      };
      arch(70, 128, 34, '#1d1d20'); arch(178, 228, 30, '#1d1d20'); arch(118, 190, 44, '#232327');
    });
  }
  // 码头：木栈桥伸入水中，(x, y) 为桥头靠水一端的水面点；side -1 栈桥朝左伸回岸；boat 是否停船，boatX 船位；lit 船灯
  E.dock = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 560, s = o.s ?? 1, t = o.t || 0, side = o.side ?? -1, len = (o.len ?? 360) * s;
    const wood = o.wood || '#4a3628', deck = y - 18 * s;
    const xa = side < 0 ? x - len : x, xb = side < 0 ? x : x + len;
    // 桩与倒影
    for (let px = xa + 10 * s; px <= xb; px += 46 * s) {
      g.fillStyle = shade(wood, -0.3); g.fillRect(px - 3 * s, deck, 6 * s, 30 * s);
      g.strokeStyle = rgba(shade(wood, -0.4), 0.4); g.lineWidth = 4 * s; g.beginPath();
      for (let k = 0; k < 8; k++) { const yy = y + 12 * s + k * 5 * s; g.moveTo(px + Math.sin(t * 2 + k + px) * 2 * s - 2 * s, yy); g.lineTo(px + Math.sin(t * 2 + k + px) * 2 * s + 2 * s, yy + 3 * s); }
      g.stroke();
    }
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
    const sq = Math.max(0.5, Math.round(s * 4) / 4);
    if (lit > 0) K.lighter(g, () => A.glow(g, x, y - 150 * s, 300 * s, o.glowColor || '#ffe6c8', 0.25 * lit));
    const img = palaceTex(sq, jade, o.roof || '#7f93ab', gold, inner);
    g.globalAlpha = o.alpha ?? 1;
    g.drawImage(img, x - 360 * s, y - 410 * s, 720 * s, 420 * s);
    if (lit > 0) K.lighter(g, () => {
      g.fillStyle = rgba(o.glowColor || '#ffe6c8', 0.3 * lit); g.fillRect(x - 116 * s, y - 148 * s, 232 * s, 92 * s);
      for (let k = 0; k < 5; k++) A.glow(g, x + (-64 + k * 32) * s, y - 208 * s, 26 * s, '#ffd9a0', 0.4 * lit * (0.85 + 0.15 * flick(t * 0.4, k)));
      for (const sd of [-1, 1]) A.glow(g, x + sd * 285 * s, y - 80 * s, 50 * s, '#ffd9a0', 0.35 * lit);
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
    g.globalAlpha = 1;
    if (o.mist !== false) E.mist(g, { t, y: y - 6 * s, h: 70 * s, color: o.mist || '#f4f2f6', alpha: 0.55, speed: 6, seed: 3 });
  };

  // ---------- 擂台 ----------
  function arenaTex(sq, red, wood, gold, text) {
    return cached('arena', [sq, red, wood, gold, text, fontKey(text)], 620, 440, sq, (g) => {
      g.translate(310, 430);
      const dred = shade(red, -0.35);
      // 台面
      g.fillStyle = K.lin(g, 0, -116, 0, -96, [[0, shade(wood, 0.25)], [1, wood]]);
      g.beginPath(); g.moveTo(-250, -96); g.lineTo(250, -96); g.lineTo(222, -116); g.lineTo(-222, -116); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(wood, -0.4), 0.5); g.lineWidth = 0.8;
      for (let k = -10; k <= 10; k++) { g.beginPath(); g.moveTo(k * 25, -96); g.lineTo(k * 22.2, -116); g.stroke(); }
      // 台裙：红布、金边、垂幔波浪下摆
      g.fillStyle = K.lin(g, 0, -96, 0, 0, [[0, red], [1, dred]]);
      g.fillRect(-250, -96, 500, 96);
      g.fillStyle = gold; g.fillRect(-250, -96, 500, 5);
      g.fillStyle = shade(red, 0.12);
      g.beginPath(); g.moveTo(-250, -91);
      for (let k = 0; k < 10; k++) { const x0 = -250 + k * 50; g.quadraticCurveTo(x0 + 25, -50, x0 + 50, -91); }
      g.lineTo(250, -91); g.closePath(); g.fill();
      g.strokeStyle = gold; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-250, -91); for (let k = 0; k < 10; k++) { const x0 = -250 + k * 50; g.quadraticCurveTo(x0 + 25, -50, x0 + 50, -91); } g.stroke();
      for (let k = 0; k <= 10; k++) { g.fillStyle = gold; g.beginPath(); g.arc(-250 + k * 50, -88, 3, 0, TAU); g.fill(); }
      for (const px of [-250, 242]) { g.fillStyle = '#5a1a14'; g.fillRect(px, -100, 8, 100); }
      // 台阶（右侧）
      for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? shade(wood, -0.1) : wood; g.fillRect(250 + k * 9, -96 + k * 16, 40, 16); }
      // 牌楼：两柱一梁一檐
      for (const px of [-214, 206]) {
        g.fillStyle = K.lin(g, px, 0, px + 8, 0, [[0, shade(red, 0.1)], [1, shade(red, -0.45)]]);
        g.fillRect(px, -386, 8, 272);
        g.fillStyle = gold; g.fillRect(px - 1, -300, 10, 4); g.fillRect(px - 1, -200, 10, 4);
      }
      g.fillStyle = dred; g.fillRect(-232, -392, 464, 18);
      g.fillStyle = gold; g.fillRect(-232, -392, 464, 3); g.fillRect(-232, -377, 464, 2);
      roof(g, 0, -392, 500, 34, { color: '#3a3438', curl: 0.6, ridge: 0.85, tileW: 7, trim: gold });
      // 横幅：比武招亲
      g.fillStyle = K.lin(g, 0, -370, 0, -326, [[0, shade(red, 0.15)], [1, dred]]);
      g.beginPath(); g.moveTo(-120, -372); g.lineTo(120, -372); g.lineTo(116, -326); g.lineTo(-116, -326); g.closePath(); g.fill();
      g.strokeStyle = gold; g.lineWidth = 2; g.strokeRect(-112, -368, 224, 38);
      glyphs(g, text, 0, -349, 30, '#f6d27a');
      // 红绸花垂幔与绣球
      for (const sd of [-1, 1]) {
        g.fillStyle = shade(red, 0.08);
        g.beginPath(); g.moveTo(sd * 120, -372); g.quadraticCurveTo(sd * 166, -300, sd * 210, -372); g.quadraticCurveTo(sd * 166, -318, sd * 120, -362); g.closePath(); g.fill();
        g.strokeStyle = rgba('#ffffff', 0.18); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(sd * 124, -366); g.quadraticCurveTo(sd * 166, -312, sd * 206, -368); g.stroke();
      }
      const ball = (bx, by, r) => {
        g.fillStyle = rad(g, bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r, [[0, shade(red, 0.4)], [1, dred]]);
        g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
        g.strokeStyle = rgba(shade(red, -0.5), 0.6); g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a + 0.6) * r * 0.7, by + Math.sin(a + 0.6) * r * 0.7, bx + Math.cos(a) * r, by + Math.sin(a) * r); g.stroke(); }
      };
      ball(0, -318, 16); ball(-120, -366, 9); ball(120, -366, 9); ball(-210, -372, 9); ball(210, -372, 9);
      // 大鼓
      const dx = -190, dy = -116;
      g.fillStyle = '#3a2418'; g.fillRect(dx - 22, dy - 8, 4, 8); g.fillRect(dx + 18, dy - 8, 4, 8);
      g.fillStyle = K.lin(g, dx - 26, 0, dx + 26, 0, [[0, shade(red, -0.1)], [0.4, shade(red, 0.2)], [1, shade(red, -0.5)]]);
      g.beginPath(); g.ellipse(dx, dy - 30, 26, 24, 0, 0, TAU); g.fill();
      g.fillStyle = '#e8d6b0'; g.beginPath(); g.ellipse(dx, dy - 52, 25, 6, 0, 0, TAU); g.fill();
      g.fillStyle = gold; for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(dx + k * 7, dy - 47 + Math.abs(k) * 0.6, 1.4, 0, TAU); g.fill(); }
    });
  }
  // 擂台（比武招亲）：(x, y) 为台前地面中点；s 缩放；red 红绸色；text 横幅字；t、wind 绸带与彩旗飘动；lit 灯笼
  E.arena = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, s = o.s ?? 1, t = o.t || 0, wind = o.wind ?? 0.5, red = o.red || o.color || '#c22a24', gold = o.gold || '#e0b85a';
    const sq = Math.max(0.5, Math.round(s * 4) / 4);
    const img = arenaTex(sq, red, o.wood || '#7a5236', gold, o.text || '比武招亲');
    g.drawImage(img, x - 310 * s, y - 430 * s, 620 * s, 440 * s);
    // 柱上垂下的长绸
    const silk = cached('silk', [red], 20, 160, 1, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 20, 0, [[0, shade(red, 0.2)], [0.5, red], [1, shade(red, -0.3)]]); c.fillRect(0, 0, 20, 150);
      c.beginPath(); c.moveTo(0, 150); c.lineTo(10, 160); c.lineTo(20, 150); c.fill();
      c.fillStyle = rgba('#ffffff', 0.2); c.fillRect(4, 0, 2, 150);
    });
    for (const [px, k] of [[-224, 0], [214, 1]]) cloth(g, silk, x + px * s - 6 * s, y - 372 * s, 18 * s, 150 * s, t + k * 1.3, { amp: (3 + 8 * wind) * s, bias: 10 * wind * s, freq: 0.7, speed: 2.2 + wind * 2, n: 14, shade: 0.35, pow: 1.3 });
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
    return cached('tea', [sq, wood, roofC, flagless ? 1 : 0], 480, 320, sq, (g) => {
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
      roof(g, 0, -176, 450, 60, { color: roofC, curl: 0.5, ridge: 0.6, tileW: 8 });
    });
  }
  // 茶楼（临水吊脚）：(x, y) 为平台下水面中点；s 缩放；lit 灯火；flag 茶旗字（false 不画）；steam 茶烟
  E.teahouse = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, t = o.t || 0, lit = o.lit ?? 0.7, wind = o.wind ?? 0.4;
    const sq = Math.max(0.5, Math.round(s * 4) / 4);
    const img = teaTex(sq, o.wood || '#6a4a32', o.roof || '#3a3c40', o.flag === false);
    g.drawImage(img, x - 240 * s, y - 310 * s, 480 * s, 320 * s);
    if (lit > 0) K.lighter(g, () => {
      g.fillStyle = K.lin(g, 0, y - 130 * s, 0, y - 28 * s, [[0, rgba('#ff9a48', 0.05 * lit)], [1, rgba('#ffb060', 0.3 * lit)]]);
      g.fillRect(x - 180 * s, y - 128 * s, 360 * s, 100 * s);
      A.glow(g, x, y - 80 * s, 150 * s, '#ffb060', 0.28 * lit);
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
  function towerTierTex(h, k, col, rim) {
    const G = towerGeo(h), T = G.tiers[k], cw = T.ew + 40, ch = T.th + T.eh + 30;
    return cached('towerTier', [h | 0, k, col, rim], cw, ch, 1, (g) => {
      g.translate(cw / 2, ch - 6);
      const bw = T.bw, th = T.th, r = rng(k * 19 + 3);
      // 塔身石块，左缘受冷月光
      g.fillStyle = K.lin(g, -bw / 2, 0, bw / 2, 0, [[0, mix(col, rim, 0.35)], [0.18, shade(col, 0.08)], [0.6, col], [1, shade(col, -0.5)]]);
      g.fillRect(-bw / 2, -th, bw, th);
      g.strokeStyle = rgba('#000000', 0.35); g.lineWidth = 1;
      for (let yy = -th + 7; yy < 0; yy += 9) {
        g.beginPath(); g.moveTo(-bw / 2, yy); g.lineTo(bw / 2, yy); g.stroke();
        for (let xx = -bw / 2 + ((yy / 9) % 2 ? 0 : 11); xx < bw / 2; xx += 22) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 9); g.stroke(); }
      }
      for (let i = 0; i < 12; i++) { g.fillStyle = rgba(r() < 0.5 ? '#000000' : rim, 0.06 + r() * 0.08); g.fillRect(-bw / 2 + r() * bw, -th + r() * th, 6 + r() * 14, 4 + r() * 6); }
      // 拱窗（亮光另画）
      const ww = bw * 0.22, wh = th * 0.42, wy = -th * 0.22;
      g.fillStyle = '#060807';
      g.beginPath(); g.moveTo(-ww / 2, wy); g.lineTo(-ww / 2, wy - wh + ww / 2); g.arc(0, wy - wh + ww / 2, ww / 2, PI, TAU); g.lineTo(ww / 2, wy); g.closePath(); g.fill();
      g.strokeStyle = shade(col, 0.25); g.lineWidth = 2; g.stroke();
      // 符纸
      for (const sd of [-1, 1]) {
        const fx = sd * (ww / 2 + bw * 0.12), fy = -th * 0.75, fw = bw * 0.07, fh = th * 0.5;
        g.save(); g.translate(fx, fy); g.rotate(sd * 0.05 + (r() - 0.5) * 0.06);
        g.fillStyle = '#d9b84a'; g.fillRect(-fw / 2, 0, fw, fh);
        g.strokeStyle = '#a3241c'; g.lineWidth = 1;
        g.beginPath(); for (let j = 0; j < 6; j++) { const yy = 4 + j * fh / 7; g.moveTo(-fw * 0.3, yy); g.lineTo(fw * 0.3, yy + 2); g.lineTo(-fw * 0.2, yy + 4); } g.stroke();
        g.restore();
      }
      // 塔檐：深色、檐角尖翘，角上挂铃
      const ew = T.ew, eh = T.eh, ey = -th;
      g.fillStyle = K.lin(g, 0, ey - eh, 0, ey + 4, [[0, shade(col, -0.1)], [1, shade(col, -0.55)]]);
      g.beginPath();
      g.moveTo(-ew / 2 - 8, ey - eh * 0.75); g.quadraticCurveTo(-ew * 0.35, ey + 4, -bw * 0.4, ey + 3); g.lineTo(bw * 0.4, ey + 3);
      g.quadraticCurveTo(ew * 0.35, ey + 4, ew / 2 + 8, ey - eh * 0.75); g.lineTo(ew * 0.3, ey - eh * 0.55); g.lineTo(bw * 0.38, ey - eh);
      g.lineTo(-bw * 0.38, ey - eh); g.lineTo(-ew * 0.3, ey - eh * 0.55); g.closePath(); g.fill();
      g.strokeStyle = rgba(rim, 0.45); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-ew / 2 - 8, ey - eh * 0.75); g.lineTo(-ew * 0.3, ey - eh * 0.55); g.lineTo(-bw * 0.38, ey - eh); g.lineTo(bw * 0.2, ey - eh); g.stroke();
      g.strokeStyle = rgba('#000000', 0.5); g.lineWidth = 1;
      for (let u = -0.45; u <= 0.45; u += 0.07) { g.beginPath(); g.moveTo(u * bw * 0.8, ey - eh); g.lineTo(u * ew * 0.95, ey + 1); g.stroke(); }
      for (const sd of [-1, 1]) { g.strokeStyle = '#1a1c1c'; g.beginPath(); g.moveTo(sd * (ew / 2 + 6), ey - eh * 0.72); g.lineTo(sd * (ew / 2 + 6), ey - eh * 0.72 + 8); g.stroke(); g.fillStyle = '#6a6040'; g.beginPath(); g.arc(sd * (ew / 2 + 6), ey - eh * 0.72 + 10, 2.6, 0, TAU); g.fill(); }
    });
  }
  function towerBaseTex(h, col, rim) {
    const G = towerGeo(h), bw = G.bw, cw = bw * 2.6, ch = G.base + h * 0.35;
    return cached('towerBase', [h | 0, col, rim], cw, ch, 1, (g) => {
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
          const u = i / n, px = lerp(x0, x1, u), py = lerp(y0, y1, u) + Math.sin(u * PI) * h * 0.04;
          g.strokeStyle = i % 2 ? '#3a3a3e' : '#24242a'; g.lineWidth = 2.2;
          g.beginPath(); g.ellipse(px, py, i % 2 ? 4.5 : 1.6, i % 2 ? 2.4 : 3.6, Math.atan2(y1 - y0, x1 - x0), 0, TAU); g.stroke();
          if (i % 3 === 0) { g.strokeStyle = rgba(rim, 0.3); g.lineWidth = 1; g.beginPath(); g.arc(px, py - 1, 2, PI, TAU); g.stroke(); }
        }
      }
    });
  }
  // 锁妖塔：(x, y) 为塔基中点；h 总高；color 石色；rim 冷月轮廓光；glow 窗中幽光色；lit 0..1 窗光强度；
  // broken 0..1：0 完好、往上逐渐裂开倒塌（上层倾倒坠落、碎石飞溅、烟尘漫起、裂口透光），crack 断裂的层号
  E.tower = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, h = o.h ?? 520, t = o.t || 0, col = o.color || '#262a2e', rim = o.rim || '#8fa6c8';
    const glowC = o.glow || '#7dffb4', lit = o.lit ?? 0.8, b = clamp(o.broken || 0), kc = o.crack ?? 3, dir = o.dir ?? 1;
    const G = towerGeo(h);
    // 将塌未塌时整体颤动
    const quake = b > 0 && b < 0.35 ? (1 - b / 0.35) * b * 30 : 0;
    const qx = quake * (noise1(t * 30, 3) - 0.5), qy = quake * 0.4 * (noise1(t * 30, 4) - 0.5);
    g.save(); g.translate(x + qx, y + qy);
    const base = towerBaseTex(h, col, rim);
    g.drawImage(base, -base.lw / 2, -base.lh + 2, base.lw, base.lh);
    const crackY = G.tiers[Math.min(kc, TOWER_N - 1)].y0;
    const fall = smooth(b);
    for (let k = 0; k < TOWER_N; k++) {
      const T = G.tiers[k], img = towerTierTex(h, k, col, rim);
      g.save();
      let a = 1;
      if (k >= kc && b > 0) {
        const j = k - kc, pv = dir * T.bw * 0.5;
        g.translate(pv, crackY); g.rotate(dir * fall * (0.45 + 0.12 * j)); g.translate(-pv, -crackY);
        g.translate(dir * fall * fall * (40 + 50 * j) * h / 520, fall * fall * h * (0.2 + 0.1 * j) - j * fall * 18);
        a = 1 - smooth((b - 0.75) / 0.25);
      }
      g.globalAlpha = a * (o.alpha ?? 1);
      g.drawImage(img, -img.lw / 2, T.y0 - img.lh + 6, img.lw, img.lh);
      // 窗中幽光
      if (lit > 0) K.lighter(g, () => {
        const f = 0.75 + 0.25 * flick(t * 0.6, k * 3);
        A.glow(g, 0, T.y0 - T.th * 0.4, T.bw * 0.34, glowC, 0.32 * lit * f * a);
        A.glow(g, 0, T.y0 - T.th * 0.4, T.bw * 0.1, '#e8fff0', 0.45 * lit * f * a);
      });
      g.restore();
      if (k === TOWER_N - 1) {
        // 塔刹
        g.save();
        if (b > 0 && k >= kc) { const pv = dir * T.bw * 0.5, j = k - kc; g.translate(pv, crackY); g.rotate(dir * fall * (0.45 + 0.12 * j)); g.translate(-pv, -crackY); g.translate(dir * fall * fall * (40 + 50 * j) * h / 520, fall * fall * h * (0.2 + 0.1 * j) - j * fall * 18); g.globalAlpha = 1 - smooth((b - 0.75) / 0.25); }
        const ty = T.y1 - T.eh;
        g.fillStyle = shade(col, -0.2);
        for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(0, ty - i * h * 0.018, h * 0.03 * (1 - i * 0.12), h * 0.008, 0, 0, TAU); g.fill(); }
        g.fillRect(-1.5, ty - h * 0.14, 3, h * 0.06);
        g.beginPath(); g.arc(0, ty - h * 0.145, h * 0.012, 0, TAU); g.fill();
        g.restore();
      }
    }
    if (b > 0) {
      // 断口：参差的残墙
      const T = G.tiers[Math.max(0, kc - 1)];
      g.fillStyle = shade(col, -0.3);
      g.beginPath(); g.moveTo(-T.bw / 2, crackY + 2);
      for (let i = 0; i <= 10; i++) g.lineTo(-T.bw / 2 + (i / 10) * T.bw, crackY - (h2(i, 9) * 18 + 4) * Math.min(1, b * 4));
      g.lineTo(T.bw / 2, crackY + 2); g.closePath(); g.fill();
      K.lighter(g, () => {
        A.glow(g, 0, crackY, T.bw * 1.6 * (0.6 + b), glowC, 0.6 * Math.sin(PI * clamp(b * 1.3)));
        A.glow(g, 0, crackY, T.bw * 0.5, '#ffffff', 0.4 * Math.sin(PI * clamp(b * 1.3)));
      });
      // 碎石：以 broken 为时间轴抛出
      const tau = b * 2.4, sc = h / 520;
      g.fillStyle = shade(col, 0.05);
      for (let i = 0; i < 60; i++) {
        const t0 = h2(i, 21) * 0.8;
        if (tau < t0) continue;
        const tt = tau - t0, vx = (h2(i, 22) - 0.3 * dir) * 220 * sc, vy = -h2(i, 23) * 160 * sc;
        const px = (h2(i, 24) - 0.5) * G.tiers[kc].bw + vx * tt, py = crackY + vy * tt + 260 * sc * tt * tt;
        if (py > 0) continue;
        const rr = (2 + h2(i, 25) * 7) * sc;
        g.save(); g.translate(px, py); g.rotate(tt * (2 + h2(i, 26) * 4));
        g.beginPath(); g.moveTo(-rr, -rr * 0.6); g.lineTo(rr * 0.8, -rr); g.lineTo(rr, rr * 0.5); g.lineTo(-rr * 0.4, rr); g.closePath(); g.fill();
        g.restore();
      }
      // 烟尘
      const dust = o.dust || '#8c8a90';
      for (let i = 0; i < 14; i++) {
        const u = h2(i, 31), q = clamp(b * 1.4 - u * 0.4);
        if (q <= 0) continue;
        const px = (h2(i, 32) - 0.5) * G.bw * 2.4 * q + dir * q * 60 * sc, py = lerp(crackY, -10, h2(i, 33)) - q * 30 * sc;
        A.glow(g, px, py, (60 + 120 * q) * sc, dust, 0.35 * Math.sin(PI * clamp(q)) + 0.12 * q);
      }
      if (b > 0.6) {
        // 塔下堆起的乱石
        g.fillStyle = shade(col, -0.15);
        for (let i = 0; i < 18; i++) { const px = (h2(i, 41) - 0.5) * G.bw * 2.2 + dir * 40 * sc, rr = (8 + h2(i, 42) * 18) * sc * smooth((b - 0.6) / 0.4); A.inkBlob(g, px, -rr * 0.4, rr, i, 0.35); g.fill(); }
      }
    }
    g.restore();
  };

  // ---------- 女娲庙与女娲像 ----------
  // 石材填色：左上受光、右侧背光，rim 为金色轮廓光
  function stoneFill(g, x0, x1, col, rim) {
    return K.lin(g, x0, 0, x1, 0, [[0, mix(col, rim, 0.45)], [0.25, shade(col, 0.15)], [0.65, col], [1, shade(col, -0.45)]]);
  }
  function nuwaTex(col, rim) {
    return cached('nuwa', [col, rim], 560, 600, 1, (g) => {
      g.translate(280, 590);
      g.lineJoin = 'round'; g.lineCap = 'round';
      // 莲台石座
      g.fillStyle = K.lin(g, 0, -46, 0, 0, [[0, shade(col, 0.1)], [1, shade(col, -0.45)]]);
      g.beginPath(); g.ellipse(0, -18, 170, 26, 0, 0, TAU); g.fill();
      g.fillRect(-170, -18, 340, 18);
      g.beginPath(); g.ellipse(0, 0, 170, 16, 0, 0, PI); g.fill();
      for (let k = -6; k <= 6; k++) {
        g.fillStyle = stoneFill(g, k * 26 - 14, k * 26 + 14, shade(col, -0.05), rim);
        g.beginPath(); g.moveTo(k * 26 - 15, -34); g.quadraticCurveTo(k * 26, -66 + Math.abs(k) * 2, k * 26 + 15, -34); g.closePath(); g.fill();
        g.strokeStyle = rgba(shade(col, -0.5), 0.4); g.lineWidth = 1; g.stroke();
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
        // 光从左上来：取光向垂直于尾身的分量，明暗带随弯曲连续移动
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
      // 鳞：交错的小弧，很淡
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
      // 长发垂在身后
      g.fillStyle = shade(col, -0.35);
      g.beginPath(); g.moveTo(-26, -432); g.quadraticCurveTo(-64, -380, -58, -300); g.quadraticCurveTo(-48, -270, -30, -290); g.lineTo(-20, -400); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(26, -432); g.quadraticCurveTo(64, -380, 60, -296); g.quadraticCurveTo(48, -268, 30, -290); g.lineTo(20, -400); g.closePath(); g.fill();
      // 披帛：绕过肘弯，向两侧舒展成 S 形
      for (const sd of [-1, 1]) {
        g.fillStyle = stoneFill(g, sd < 0 ? -200 : 40, sd < 0 ? -40 : 200, shade(col, 0.05), rim);
        g.beginPath();
        g.moveTo(sd * 58, -372);
        g.bezierCurveTo(sd * 96, -330, sd * 92, -286, sd * 128, -262);
        g.bezierCurveTo(sd * 168, -236, sd * 196, -250, sd * 214, -214);
        g.bezierCurveTo(sd * 200, -232, sd * 168, -224, sd * 132, -248);
        g.bezierCurveTo(sd * 92, -272, sd * 80, -318, sd * 50, -352);
        g.closePath(); g.fill();
      }
      // 躯干与衣襟
      g.fillStyle = stoneFill(g, -66, 66, col, rim);
      g.beginPath();
      g.moveTo(-30, -258); g.quadraticCurveTo(-40, -300, -46, -340); g.quadraticCurveTo(-64, -372, -58, -384);
      g.quadraticCurveTo(-30, -396, -11, -398); g.lineTo(11, -398); g.quadraticCurveTo(30, -396, 58, -384);
      g.quadraticCurveTo(64, -372, 46, -340); g.quadraticCurveTo(40, -300, 30, -258); g.closePath(); g.fill();
      g.strokeStyle = rgba(shade(col, -0.5), 0.45); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-26, -394); g.quadraticCurveTo(-6, -350, 0, -322); g.quadraticCurveTo(6, -350, 26, -394); g.stroke();
      // 腰带与玉饰，接住蛇尾
      g.fillStyle = shade(col, -0.2); g.beginPath(); g.ellipse(0, -258, 36, 9, 0, 0, TAU); g.fill();
      g.fillStyle = mix(col, rim, 0.5); g.beginPath(); g.ellipse(0, -258, 8, 6, 0, 0, TAU); g.fill();
      for (const sd of [-1, 1]) { g.strokeStyle = rgba(mix(col, rim, 0.4), 0.7); g.lineWidth = 2; g.beginPath(); g.moveTo(sd * 6, -252); g.quadraticCurveTo(sd * 10, -230, sd * 4, -212); g.stroke(); }
      // 双臂：广袖垂落，双手合于胸前捧石
      for (const sd of [-1, 1]) {
        g.fillStyle = stoneFill(g, sd < 0 ? -120 : 0, sd < 0 ? 0 : 120, shade(col, 0.02), rim);
        g.beginPath();
        g.moveTo(sd * 52, -380); g.quadraticCurveTo(sd * 76, -350, sd * 70, -306);
        g.quadraticCurveTo(sd * 88, -270, sd * 84, -232); g.quadraticCurveTo(sd * 60, -240, sd * 40, -262);
        g.quadraticCurveTo(sd * 22, -300, sd * 12, -322); g.quadraticCurveTo(sd * 30, -320, sd * 44, -318);
        g.quadraticCurveTo(sd * 46, -350, sd * 40, -372); g.closePath(); g.fill();
        g.strokeStyle = rgba(shade(col, -0.5), 0.35); g.lineWidth = 1;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(sd * (58 + k * 6), -300 + k * 4); g.quadraticCurveTo(sd * (70 + k * 4), -270, sd * (66 + k * 5), -240); g.stroke(); }
      }
      g.fillStyle = mix(col, rim, 0.25);
      g.beginPath(); g.ellipse(-8, -326, 9, 7, 0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(8, -326, 9, 7, -0.4, 0, TAU); g.fill();
      // 颈与头：不刻五官，只留柔和的明暗
      g.fillStyle = stoneFill(g, -10, 10, col, rim); g.fillRect(-9, -414, 18, 20);
      g.fillStyle = rad(g, -8, -440, 3, 0, -430, 30, [[0, mix(col, rim, 0.5)], [0.6, col], [1, shade(col, -0.35)]]);
      g.beginPath(); g.ellipse(0, -430, 21, 27, 0, 0, TAU); g.fill();
      // 高髻与金冠
      g.fillStyle = shade(col, -0.3);
      g.beginPath(); g.ellipse(0, -452, 24, 12, 0, PI, TAU); g.fill();
      g.beginPath(); g.ellipse(-11, -472, 10, 15, -0.3, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(11, -472, 10, 15, 0.3, 0, TAU); g.fill();
      g.fillStyle = mix(rim, '#ffffff', 0.15);
      g.beginPath(); g.moveTo(-20, -456); g.lineTo(-12, -470); g.lineTo(-5, -460); g.lineTo(0, -476); g.lineTo(5, -460); g.lineTo(12, -470); g.lineTo(20, -456); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, -462, 3, 0, TAU); g.fill();
      for (const sd of [-1, 1]) { g.strokeStyle = rgba(rim, 0.8); g.lineWidth = 1.2; g.beginPath(); g.moveTo(sd * 20, -456); g.quadraticCurveTo(sd * 30, -440, sd * 28, -418); g.stroke(); }
    });
  }
  // 女娲神像：人身蛇尾、捧五彩石；(x, y) 为石座底；s 缩放（s=1 高约 480）；color 石色；rim 金色轮廓光；
  // glow 0..1 背光与神光；awaken 0..1 神像“睁眼”：双目微光、捧石大亮
  E.nuwaStatue = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 640, s = o.s ?? 1, t = o.t || 0, col = o.color || '#c8b99e', rim = o.rim || '#ffd27a', gl = o.glow ?? 0.6, aw = clamp(o.awaken || 0);
    g.save(); g.translate(x, y); g.scale(s, s);
    if (gl > 0) {
      K.lighter(g, () => {
        A.glow(g, 0, -300, 360, rim, 0.28 * gl);
        A.glow(g, 0, -430, 120, '#fff0c8', 0.4 * gl);
      });
      // 头光：几道细圈缓转，外缘放射金线
      g.strokeStyle = rgba(rim, 0.55 * gl); g.lineWidth = 2;
      g.beginPath(); g.arc(0, -432, 64, 0, TAU); g.stroke();
      g.strokeStyle = rgba(rim, 0.3 * gl); g.lineWidth = 1;
      g.beginPath(); g.arc(0, -432, 74, 0, TAU); g.stroke();
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * TAU + t * 0.05, l = 14 + 8 * Math.sin(k * 3.1);
        g.beginPath(); g.moveTo(Math.cos(a) * 78, -432 + Math.sin(a) * 78); g.lineTo(Math.cos(a) * (78 + l), -432 + Math.sin(a) * (78 + l)); g.stroke();
      }
      g.strokeStyle = rgba(rim, 0.22 * gl); g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, -300, 190, 250, 0, PI * 1.05, PI * 1.95); g.stroke();
    }
    const img = nuwaTex(col, rim);
    g.drawImage(img, -280, -590, 560, 600);
    // 五彩石与双目
    const orb = 0.5 + 0.5 * aw;
    K.lighter(g, () => {
      const f = 0.85 + 0.15 * Math.sin(t * 2.2);
      A.glow(g, 0, -334, 60, '#ffe6a8', 0.5 * orb * f);
      ['#ff8a8a', '#ffe08a', '#8affc0', '#8ac8ff', '#e0a0ff'].forEach((c2, k) => { const a = t * 0.8 + (k / 5) * TAU; A.glow(g, Math.cos(a) * 7, -334 + Math.sin(a) * 4, 12, c2, 0.5 * orb); });
      A.glow(g, 0, -334, 10, '#ffffff', 0.8 * orb);
      if (aw > 0) { A.glow(g, 0, -432, 30, rim, 0.25 * aw); for (const sd of [-1, 1]) A.glow(g, sd * 8, -431, 5 + 3 * aw, '#fff8e0', 0.9 * aw); }
    });
    g.restore();
  };

  // 女娲庙：view 'interior'（默认，满画面殿内）| 'exterior'（殿宇外观，以 x, y, s 定位）；
  // interior 分两层：layer 'back' 殿墙、柱、幡、光柱；'front' 供桌、香炉、烛与香烟；'all' 两层都画（神像放在两层之间）
  E.temple = function (g, o = {}) {
    const t = o.t || 0, lit = o.lit ?? 1, view = o.view || 'interior';
    if (view === 'exterior') return templeExterior(g, o);
    const layer = o.layer || 'all', fy = o.floor ?? 560, red = o.red || '#7a1e16', gold = o.gold || '#d8a84a', wallC = o.wall || '#2a1712';
    if (layer !== 'front') {
      const img = cached('templeIn', [fy, red, gold, wallC], W, H, 1, (c) => {
        c.fillStyle = K.lin(c, 0, 0, 0, fy, [[0, shade(wallC, -0.3)], [1, shade(wallC, 0.15)]]); c.fillRect(0, 0, W, fy);
        // 神龛：拱形壁龛，内里暖金
        const ax = 640, aw = 300, top = 120;
        c.fillStyle = K.lin(c, 0, top, 0, fy, [[0, '#5a3418'], [0.6, '#8a5a2a'], [1, '#6a4020']]);
        c.beginPath(); c.moveTo(ax - aw, fy); c.lineTo(ax - aw, top + aw); c.arc(ax, top + aw, aw, PI, TAU); c.lineTo(ax + aw, fy); c.closePath(); c.fill();
        c.strokeStyle = gold; c.lineWidth = 6; c.stroke();
        c.strokeStyle = rgba(gold, 0.4); c.lineWidth = 2; c.beginPath(); c.moveTo(ax - aw - 14, fy); c.lineTo(ax - aw - 14, top + aw); c.arc(ax, top + aw, aw + 14, PI, TAU); c.lineTo(ax + aw + 14, fy); c.stroke();
        for (let k = 0; k < 9; k++) { c.strokeStyle = rgba(gold, 0.12); c.lineWidth = 1; c.beginPath(); c.arc(ax, top + aw, aw * (0.3 + k * 0.08), PI, TAU); c.stroke(); }
        // 地面：磨光石砖，透视线
        c.fillStyle = K.lin(c, 0, fy, 0, H, [[0, '#3a2a20'], [1, '#160e0a']]); c.fillRect(0, fy, W, H - fy);
        c.strokeStyle = 'rgba(255,220,160,0.08)'; c.lineWidth = 1;
        for (let k = -12; k <= 12; k++) { c.beginPath(); c.moveTo(640 + k * 30, fy); c.lineTo(640 + k * 200, H); c.stroke(); }
        for (let k = 0; k < 8; k++) { const yy = fy + Math.pow(k / 8, 1.8) * (H - fy); c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
        // 梁枋彩画与斗拱
        c.fillStyle = '#1c3a3a'; c.fillRect(0, 0, W, 54);
        for (let x = 0; x < W; x += 80) { c.fillStyle = '#2f6060'; c.beginPath(); c.ellipse(x + 40, 27, 30, 16, 0, 0, TAU); c.fill(); c.strokeStyle = gold; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#5a2a1a'; c.beginPath(); c.arc(x + 40, 27, 6, 0, TAU); c.fill(); }
        c.fillStyle = gold; c.fillRect(0, 52, W, 3); c.fillRect(0, 0, W, 3);
        for (let x = 20; x < W; x += 64) {
          c.fillStyle = '#4a1610';
          c.fillRect(x - 16, 56, 32, 8); c.fillRect(x - 24, 64, 48, 6); c.fillRect(x - 10, 70, 20, 10);
          c.fillStyle = rgba(gold, 0.6); c.fillRect(x - 24, 64, 48, 1.5);
        }
        c.fillStyle = '#3a120c'; c.fillRect(0, 80, W, 14); c.fillStyle = rgba(gold, 0.5); c.fillRect(0, 92, W, 2);
        // 柱：远两根、近两根，红漆金箍、石础
        const col = (cx, w, y0, y1) => {
          c.fillStyle = K.lin(c, cx - w / 2, 0, cx + w / 2, 0, cx < 640 ? [[0, shade(red, -0.5)], [0.7, shade(red, 0.1)], [1, shade(red, 0.3)]] : [[0, shade(red, 0.3)], [0.3, shade(red, 0.1)], [1, shade(red, -0.5)]]);
          c.fillRect(cx - w / 2, y0, w, y1 - y0);
          c.fillStyle = gold; c.fillRect(cx - w / 2, y0 + 30, w, w * 0.08); c.fillRect(cx - w / 2, y1 - w * 0.5, w, w * 0.06);
          c.fillStyle = '#4a4440'; c.beginPath(); c.ellipse(cx, y1, w * 0.75, w * 0.18, 0, 0, TAU); c.fill(); c.fillRect(cx - w * 0.75, y1, w * 1.5, w * 0.2);
        };
        col(330, 54, 94, fy); col(950, 54, 94, fy);
        col(90, 100, 0, H - 40); col(1190, 100, 0, H - 40);
      });
      g.drawImage(img, 0, 0, W, H);
      // 殿内暖光、龛内神光
      K.lighter(g, () => { A.glow(g, 640, 360, 420, '#ffb860', 0.22 * lit); A.glow(g, 640, fy + 30, 300, '#ffcf80', 0.18 * lit); });
      // 幡：长条丝幡垂挂，微微摆动
      const fan = cached('templeBanner', [gold], 46, 340, 1, (c) => {
        c.fillStyle = K.lin(c, 0, 0, 46, 0, [[0, '#a8742a'], [0.5, '#e0b860'], [1, '#8a5a1e']]); c.fillRect(0, 0, 46, 320);
        c.fillStyle = '#8a2418'; c.fillRect(0, 0, 46, 16); for (let k = 0; k < 6; k++) c.fillRect(0, 40 + k * 46, 46, 4);
        c.strokeStyle = 'rgba(120,40,20,0.6)'; c.lineWidth = 1.5; for (let k = 0; k < 6; k++) { c.beginPath(); c.arc(23, 64 + k * 46, 10, 0, TAU); c.stroke(); }
        c.fillStyle = '#e0b860'; c.beginPath(); c.moveTo(0, 320); c.lineTo(23, 340); c.lineTo(46, 320); c.fill();
      });
      for (const [bx, k] of [[205, 0], [1029, 1]]) cloth(g, fan, bx, 96, 46, 340, t + k * 2, { amp: 3, freq: 0.6, speed: 1.2, n: 12, shade: 0.25, pow: 1.5 });
      // 丁达尔光柱与浮尘
      K.lighter(g, () => {
        for (let k = 0; k < 3; k++) {
          const sx = 420 + k * 70, a = (0.08 + 0.04 * Math.sin(t * 0.5 + k * 2)) * lit;
          g.fillStyle = K.lin(g, sx, 0, sx + 260, fy, [[0, rgba('#ffe2a8', a)], [1, rgba('#ffe2a8', 0)]]);
          g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 36, 0); g.lineTo(sx + 330, fy + 40); g.lineTo(sx + 220, fy + 40); g.closePath(); g.fill();
        }
        for (let i = 0; i < 50; i++) {
          const u = h2(i, 61), px = 450 + u * 380 + Math.sin(t * 0.3 + i) * 20, py = ((h2(i, 62) * fy + t * (6 + 8 * h2(i, 63))) % fy);
          A.glow(g, px + py * 0.45, py, 3 + h2(i, 64) * 3, '#ffe6b0', 0.35 * lit * (0.5 + 0.5 * Math.sin(t * 1.5 + i)));
        }
      });
    }
    if (layer !== 'back') {
      // 供桌、香炉、红烛
      const tx = 640, ty = 630;
      g.fillStyle = K.lin(g, 0, ty - 10, 0, ty + 70, [[0, '#6a1a12'], [1, '#2a0a08']]);
      g.fillRect(tx - 230, ty - 10, 460, 90);
      g.fillStyle = '#8a2418'; g.fillRect(tx - 240, ty - 18, 480, 12);
      g.fillStyle = rgba(gold, 0.8); g.fillRect(tx - 240, ty - 18, 480, 2);
      g.fillStyle = '#b8862e'; g.fillRect(tx - 120, ty - 6, 240, 60);
      g.strokeStyle = '#7a1a10'; g.lineWidth = 2; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(tx - 96 + k * 48, ty + 24, 12, 0, TAU); g.stroke(); }
      // 鼎
      g.fillStyle = K.lin(g, tx - 40, 0, tx + 40, 0, [[0, '#7a6a3a'], [0.4, '#c8a858'], [1, '#3a3018']]);
      g.beginPath(); g.moveTo(tx - 44, ty - 64); g.quadraticCurveTo(tx - 48, ty - 26, tx - 30, ty - 20); g.lineTo(tx + 30, ty - 20); g.quadraticCurveTo(tx + 48, ty - 26, tx + 44, ty - 64); g.closePath(); g.fill();
      g.fillRect(tx - 50, ty - 70, 100, 8);
      for (const sd of [-1, 1]) { g.fillRect(tx + sd * 30 - 3, ty - 22, 6, 6); g.strokeStyle = '#a08848'; g.lineWidth = 4; g.beginPath(); g.arc(tx + sd * 40, ty - 80, 8, PI * 0.9, PI * 2.1); g.stroke(); }
      for (let k = -1; k <= 1; k++) {
        const sx = tx + k * 10, sy = ty - 70;
        g.strokeStyle = '#6a3a1a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + k * 2, sy - 34); g.stroke();
        K.lighter(g, () => A.glow(g, sx + k * 2, sy - 35, 5, '#ff7a3a', 0.8));
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
    const sq = Math.max(0.5, Math.round(s * 4) / 4), red = o.red || '#8a2a1e', roofC = o.roof || '#3a3a3e', gold = o.gold || '#d8a84a';
    const img = cached('templeEx', [sq, red, roofC, gold], 680, 420, sq, (c) => {
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
      roof(c, 0, -252, 600, 120, { color: roofC, curl: 0.4, ridge: 0.55, tileW: 9, trim: gold });
      c.fillStyle = '#1a2a2a'; c.fillRect(-60, -300, 120, 36); c.strokeStyle = gold; c.lineWidth = 2; c.strokeRect(-56, -296, 112, 28);
      glyphs(c, o.sign || '女娲庙', 0, -282, 20, gold);
    });
    g.drawImage(img, x - 340 * s, y - 410 * s, 680 * s, 420 * s);
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
      A.glow(g, x, y - 14 * s, 60 * s, col || '#ff8a3a', 0.45 + 0.15 * flick(t, seed));
      for (let k = 0; k < 5; k++) {
        const ph = t * (5 + k) + seed + k * 1.7, hh = (26 + 14 * Math.sin(ph) + 10 * flick(t * 0.8, seed + k)) * s * (k ? 0.8 : 1);
        const dx = (k - 2) * 5 * s + Math.sin(ph * 1.3) * 3 * s;
        g.fillStyle = K.lin(g, 0, y, 0, y - hh, [[0, rgba('#ffe8a0', 0.8)], [0.4, rgba(col || '#ff8a3a', 0.6)], [1, rgba('#c02a10', 0)]]);
        g.beginPath(); g.moveTo(x + dx - 7 * s, y); g.quadraticCurveTo(x + dx - 6 * s, y - hh * 0.5, x + dx + Math.sin(ph) * 5 * s, y - hh); g.quadraticCurveTo(x + dx + 6 * s, y - hh * 0.5, x + dx + 7 * s, y); g.closePath(); g.fill();
      }
    });
  }
  function altarTex(sq, stone, paint, rim) {
    return cached('altar', [sq, stone, paint, rim], 860, 520, sq, (g) => {
      g.translate(430, 510);
      const tiers = [[380, 340, 0, -60], [290, 260, -60, -115], [210, 180, -115, -165]];
      for (const [wb, wt, y0, y1] of tiers) {
        g.fillStyle = K.lin(g, 0, y1, 0, y0, [[0, shade(stone, 0.12)], [1, shade(stone, -0.35)]]);
        g.beginPath(); g.moveTo(-wb, y0); g.lineTo(wb, y0); g.lineTo(wt, y1); g.lineTo(-wt, y1); g.closePath(); g.fill();
        g.fillStyle = rgba(rim, 0.45); g.fillRect(-wt, y1, wt * 2, 2);
        // 月牙纹饰带
        const my = (y0 + y1) / 2;
        g.fillStyle = rgba(paint, 0.55); g.fillRect(-wt - (wb - wt) * 0.5, my - 6, (wt + (wb - wt) * 0.5) * 2, 12);
        for (let x = -wt; x <= wt; x += 34) { g.fillStyle = rgba(rim, 0.55); g.beginPath(); g.arc(x, my, 5, PI * 0.25, PI * 1.75); g.arc(x + 2.5, my, 4, PI * 1.75, PI * 0.25, true); g.fill(); }
      }
      // 中轴长阶
      for (let k = 0; k < 22; k++) { const yy = -k * 7.5, w = 70 - k * 0.9; g.fillStyle = k % 2 ? shade(stone, -0.2) : shade(stone, 0.02); g.fillRect(-w, yy - 7.5, w * 2, 7.5); }
      g.fillStyle = rgba(rim, 0.3); for (let k = 0; k < 22; k++) g.fillRect(-70 + k * 0.9, -k * 7.5 - 7.5, (70 - k * 0.9) * 2, 1);
      // 顶台月轮
      g.fillStyle = shade(stone, -0.1); g.beginPath(); g.ellipse(0, -168, 140, 16, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba(rim, 0.6); g.lineWidth = 2; g.beginPath(); g.ellipse(0, -168, 120, 12, 0, 0, TAU); g.stroke();
      // 图腾柱：叠刻兽面、顶上牛角与弯月
      const totem = (px, py, hh, w) => {
        g.fillStyle = K.lin(g, px - w / 2, 0, px + w / 2, 0, [[0, mix(stone, rim, 0.3)], [0.5, stone], [1, shade(stone, -0.5)]]);
        g.fillRect(px - w / 2, py - hh, w, hh);
        const nseg = Math.round(hh / (w * 1.6));
        for (let k = 0; k < nseg; k++) {
          const sy = py - hh + 18 + k * (hh - 18) / nseg, sh = (hh - 18) / nseg;
          g.fillStyle = k % 2 ? rgba(paint, 0.7) : rgba('#1a1420', 0.6);
          g.fillRect(px - w / 2 - 2, sy + sh * 0.1, w + 4, sh * 0.18);
          g.fillStyle = rgba('#0a0a10', 0.75);
          g.beginPath(); g.ellipse(px - w * 0.2, sy + sh * 0.5, w * 0.13, w * 0.07, 0.3, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(px + w * 0.2, sy + sh * 0.5, w * 0.13, w * 0.07, -0.3, 0, TAU); g.fill();
          g.fillRect(px - w * 0.18, sy + sh * 0.72, w * 0.36, sh * 0.08);
          g.fillStyle = rgba(rim, 0.25); g.fillRect(px - w / 2, sy + sh * 0.1, 2, sh * 0.8);
        }
        g.strokeStyle = shade(stone, 0.1); g.lineWidth = w * 0.22; g.lineCap = 'round';
        g.beginPath(); g.moveTo(px - w * 0.4, py - hh); g.quadraticCurveTo(px - w * 1.5, py - hh - w * 0.2, px - w * 1.3, py - hh - w * 1.2); g.stroke();
        g.beginPath(); g.moveTo(px + w * 0.4, py - hh); g.quadraticCurveTo(px + w * 1.5, py - hh - w * 0.2, px + w * 1.3, py - hh - w * 1.2); g.stroke();
        g.fillStyle = mix(rim, '#ffffff', 0.2);
        g.beginPath(); g.arc(px, py - hh - w * 0.9, w * 0.55, PI * 0.15, PI * 1.85); g.arc(px + w * 0.25, py - hh - w * 0.9, w * 0.45, PI * 1.75, PI * 0.25, true); g.fill();
      };
      totem(-345, -58, 330, 30); totem(345, -58, 330, 30);
      totem(-215, -166, 230, 24); totem(215, -166, 230, 24);
      // 火盆三足
      for (const sd of [-1, 1]) {
        const bx = sd * 150, by = -166;
        g.strokeStyle = '#2a2420'; g.lineWidth = 3;
        for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(bx + k * 10, by); g.lineTo(bx + k * 6, by - 30); g.stroke(); }
        g.fillStyle = K.lin(g, bx - 24, 0, bx + 24, 0, [[0, '#6a5a3a'], [0.5, '#a08a5a'], [1, '#2a2418']]);
        g.beginPath(); g.moveTo(bx - 26, by - 44); g.quadraticCurveTo(bx, by - 18, bx + 26, by - 44); g.closePath(); g.fill();
      }
    });
  }
  // 拜月祭坛：(x, y) 为坛前地面中点；s 缩放；moon 是否画背后巨月（moonColor、moonR、moonY）；stone 石色，paint 图腾彩绘，rim 月光轮廓；fire 火盆火色
  E.altar = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 660, s = o.s ?? 1, t = o.t || 0, rim = o.rim || '#c8c0e8', wind = o.wind ?? 0.4;
    if (o.moon !== false) E.moon(g, { x, y: y - (o.moonY ?? 380) * s, r: (o.moonR ?? 200) * s, color: o.moonColor || '#ece4d0', haze: o.moonHaze || '#8a78b8', glow: o.moonGlow ?? 0.6, phase: o.phase ?? 1 });
    const sq = Math.max(0.5, Math.round(s * 4) / 4);
    const img = altarTex(sq, o.stone || '#3c3648', o.paint || '#8a2a2a', rim);
    g.drawImage(img, x - 430 * s, y - 510 * s, 860 * s, 520 * s);
    // 柱顶垂下的教幡
    const ban = cached('altarBanner', [o.banner || '#3a1a4a', rim], 30, 150, 1, (c) => {
      c.fillStyle = K.lin(c, 0, 0, 30, 0, [[0, '#2a1036'], [0.5, o.banner || '#3a1a4a'], [1, '#1a0a22']]); c.fillRect(0, 0, 30, 140);
      c.beginPath(); c.moveTo(0, 140); c.lineTo(15, 150); c.lineTo(30, 140); c.fill();
      c.fillStyle = rgba(rim, 0.7); c.beginPath(); c.arc(15, 40, 8, PI * 0.2, PI * 1.8); c.arc(18, 40, 6.5, PI * 1.8, PI * 0.2, true); c.fill();
    });
    for (const [px, py, k] of [[-345, -388, 0], [345, -388, 1], [-215, -396, 2], [215, -396, 3]]) cloth(g, ban, x + (px + 14) * s, y + py * s, 26 * s, 130 * s, t + k * 1.1, { amp: (2 + 6 * wind) * s, bias: 8 * wind * s, freq: 0.7, speed: 1.6 + wind * 2, n: 12, shade: 0.3 });
    for (const sd of [-1, 1]) fire(g, x + sd * 150 * s, y - 206 * s, s, t, sd + 3, o.fire || '#ff8a3a');
    K.lighter(g, () => A.glow(g, x, y - 176 * s, 160 * s, rim, 0.18 + 0.1 * Math.sin(t * 0.8)));
  };

  // ---------- 器物 ----------
  // 烛火：泪滴形，多频闪烁，风吹偏斜；返回火焰顶点
  function flame(g, x, y, s, t, seed, o = {}) {
    const f = flick(t, seed), hh = (17 + 5 * f) * s * (o.size ?? 1), lean = ((o.wind || 0) * 0.6 + (noise1(t * 3, seed + 4) - 0.5) * 0.25) * hh;
    K.lighter(g, () => {
      A.glow(g, x + lean * 0.5, y - hh * 0.45, hh * (o.glow ?? 1) * 5.5, o.glowColor || '#ffa04a', 0.45 * (0.8 + 0.2 * f) * (o.alpha ?? 1));
      A.glow(g, x + lean * 0.4, y - hh * 0.4, hh * 1.6, '#ffd890', 0.5 * (o.alpha ?? 1));
    });
    const tip = [x + lean, y - hh];
    g.save(); g.globalAlpha = o.alpha ?? 1;
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
    const s = r / 7, hh = Math.max(r * 0.6, H0 * (1 - burn * 0.93)), top = y - hh;
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
    if (burn > 0.5) { g.fillStyle = shade(col, 0.1); g.beginPath(); g.ellipse(x, y - 1, r * (1.2 + burn * 0.8), r * 0.35, 0, 0, TAU); g.fill(); }
    g.strokeStyle = '#1a1210'; g.lineWidth = 1.2 * s;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x + 0.6 * s, top - 4 * s); g.stroke();
    if (burn < 1) {
      const fade = clamp((1 - burn) * 12);
      flame(g, x, top - 2 * s, s * (o.size ?? 1), t, seed, { wind: o.wind, glow: o.glow ?? 1, alpha: fade, glowColor: o.glowColor });
    } else {
      // 熄灭后的一缕青烟
      g.strokeStyle = 'rgba(200,200,210,0.25)'; g.lineWidth = 1.4 * s;
      g.beginPath();
      for (let i = 0; i <= 16; i++) { const u = i / 16, px = x + Math.sin(t * 1.4 + u * 6) * 5 * u * s + (o.wind || 0) * 30 * u * s, py = top - 4 * s - u * 90 * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
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
    if (o.glint !== false) K.lighter(g, () => { const u = ((t * 0.35) % 1.6) - 0.3; if (u > 0 && u < 1) A.glow(g, 0, -L * u, 14, '#e8f4ff', 0.6 * Math.sin(u * PI)); });
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
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 0, 40, 6, 0, 0, TAU); c.fill();
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
    g.globalAlpha = 1 - fade;
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
      g.save(); g.translate(20, -36); g.rotate(-0.12);
      g.fillStyle = '#2a1e14'; g.fillRect(56, -6, 10, 12); g.fillRect(-54, -6, 10, 12);
      g.fillStyle = K.lin(g, 0, -4, 0, 4, [[0, '#a8743a'], [1, '#5a3a1a']]); g.fillRect(-70, -3, 130, 6);
      g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(60, -4); g.quadraticCurveTo(80, -4, 92, 0); g.quadraticCurveTo(80, 4, 60, 4); g.closePath(); g.fill();
      g.fillStyle = rgba('#0a0a0a', 0.3 + 0.6 * wet); g.beginPath(); g.moveTo(74, -3); g.quadraticCurveTo(84, -2, 92, 0); g.quadraticCurveTo(84, 2, 74, 3); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    void t;
  };

  // 棋盘：(x, y) 为盘面中心；s 缩放；n 路数；stones 子数（按 seed 摆放）或 [[i,j,'b'|'w'],...]；tilt 透视程度
  E.chessboard = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 600, s = o.s ?? 1, n = o.n ?? 13, tilt = o.tilt ?? 0.45, seed = o.seed ?? 3;
    const wF = 150 * s, wB = 150 * s * (1 - tilt * 0.35), d = 150 * s * tilt;
    const P = (u, v) => [x + (u - 0.5) * lerp(wF, wB, v) * 2, y + (0.5 - v) * d * 2 + 0];
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + d + 26 * s, wF * 1.05, 14 * s, 0, 0, TAU); g.fill();
    g.fillStyle = K.lin(g, 0, y + d, 0, y + d + 24 * s, [[0, '#8a5a2a'], [1, '#4a2a12']]);
    const [a0, a1] = [P(0, 0), P(1, 0)];
    g.fillRect(a0[0], a0[1], a1[0] - a0[0], 24 * s);
    const [c0, c1] = [P(0, 1), P(1, 1)];
    g.fillStyle = K.lin(g, 0, c0[1], 0, a0[1], [[0, '#d8a860'], [1, '#c08a44']]);
    g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.lineTo(c1[0], c1[1]); g.lineTo(c0[0], c0[1]); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,24,10,0.7)'; g.lineWidth = 0.9 * s;
    const m = 0.06;
    for (let i = 0; i < n; i++) {
      const u = m + (i / (n - 1)) * (1 - 2 * m);
      let [p, q] = [P(u, m), P(u, 1 - m)]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      [p, q] = [P(m, u), P(1 - m, u)]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
    }
    let list = o.stones;
    if (!Array.isArray(list)) { const k = list ?? 22; list = []; for (let i = 0; i < k; i++) list.push([Math.floor(h2(i, seed) * n), Math.floor(h2(i, seed + 1) * n), i % 2 ? 'w' : 'b']); }
    list.slice().sort((a, b) => b[1] - a[1]).forEach(([i, j, c2]) => {
      const u = m + (i / (n - 1)) * (1 - 2 * m), v = m + (j / (n - 1)) * (1 - 2 * m), [px, py] = P(u, v), r = 7 * s * lerp(1, 0.82, v);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(px + 1.5 * s, py + 1.5 * s, r, r * 0.6, 0, 0, TAU); g.fill();
      g.fillStyle = c2 === 'w' ? rad(g, px - r * 0.3, py - r * 0.35, 1, px, py, r, [[0, '#ffffff'], [1, '#c8c4bc']]) : rad(g, px - r * 0.3, py - r * 0.35, 1, px, py, r, [[0, '#6a6a70'], [1, '#0e0e12']]);
      g.beginPath(); g.ellipse(px, py, r, r * 0.62, 0, 0, TAU); g.fill();
    });
  };

  // 吊坠（玉璧）：(x, y) 为系绳上端；s 缩放；t、swing 摆动；glow 0..1 许愿时的金光；color 玉色
  E.pendant = function (g, o = {}) {
    const x = o.x ?? 640, y = o.y ?? 300, s = o.s ?? 1, t = o.t || 0, col = o.color || '#9fd0b8', gl = o.glow || 0;
    const ang = (o.swing ?? 0.12) * Math.sin(t * 1.8);
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    g.strokeStyle = o.cord || '#b8352a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 30); g.stroke();
    g.fillStyle = o.cord || '#b8352a'; g.beginPath(); g.moveTo(0, 26); g.lineTo(-5, 31); g.lineTo(0, 36); g.lineTo(5, 31); g.closePath(); g.fill();
    if (gl > 0) K.lighter(g, () => { A.glow(g, 0, 58, 90 * (0.7 + gl * 0.6), '#ffd27a', 0.55 * gl); A.glow(g, 0, 58, 30, '#fff6d8', 0.7 * gl); });
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
  // 喜堂（满画面）：红烛、大红囍字、红绸彩球、帷幔；fade 0..1 褪成灰烬色（爱已走到尽头），burn 红烛燃尽程度
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
      // 供桌
      c.fillStyle = K.lin(c, 0, 560, 0, 720, [[0, '#5a1410'], [1, '#1a0404']]); c.fillRect(260, 560, 760, 160);
      c.fillStyle = '#7a1a14'; c.fillRect(240, 548, 800, 16); c.fillStyle = rgba(gold, 0.7); c.fillRect(240, 548, 800, 2);
      c.fillStyle = red; c.fillRect(520, 556, 240, 164);
      c.strokeStyle = gold; c.lineWidth = 2; c.strokeRect(530, 566, 220, 140);
      for (const px of [430, 850]) { c.fillStyle = '#d8b878'; c.beginPath(); c.ellipse(px, 546, 44, 9, 0, 0, TAU); c.fill(); for (let k = 0; k < 5; k++) { c.fillStyle = k % 2 ? '#e8702a' : '#f0902a'; c.beginPath(); c.arc(px - 22 + k * 11, 536 - (k % 2) * 8, 8, 0, TAU); c.fill(); } }
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
    });
    g.drawImage(base, 0, 0, W, H);
    if (fade > 0) {
      const ash = cached('weddingAsh', [red, gold, fontKey('囍')], W, H, 0.5, (c) => {
        c.drawImage(base, 0, 0, W, H);
        c.globalCompositeOperation = 'saturation'; c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'multiply'; c.fillStyle = '#7a7470'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
      });
      g.globalAlpha = fade; g.drawImage(ash, 0, 0, W, H); g.globalAlpha = 1;
    }
    // 两侧大红灯笼与龙凤烛
    E.lantern(g, { x: 270, y: 30, s: 2.2, t, color: mix(red, '#6a6460', fade), lit: 1 - fade * 0.9, text: '囍', kind: 'palace', seed: 1, cord: 30 });
    E.lantern(g, { x: 1010, y: 30, s: 2.2, t, color: mix(red, '#6a6460', fade), lit: 1 - fade * 0.9, text: '囍', kind: 'palace', seed: 2, cord: 30 });
    for (const [cx, sd] of [[330, 1], [950, 2]]) E.candle(g, { x: cx, y: 520, h: 120, r: 12, t, burn, color: mix(red, '#8a8480', fade * 0.8), seed: sd, glow: 1.4 });
    K.lighter(g, () => A.glow(g, 640, 430, 380, '#ff9a5a', 0.18 * (1 - fade)));
    // 褪色时纸灰飘落
    if (fade > 0.05) {
      for (let i = 0; i < 40; i++) {
        const P = 6, age = (t + h2(i, 81) * P) % P, px = 520 + h2(i, 82) * 240 + Math.sin(t + i) * 30 + age * 6, py = 160 + age * 70 + h2(i, 83) * 40;
        g.fillStyle = rgba(i % 3 ? '#6a6460' : '#c8b8a0', fade * 0.7 * clamp((P - age) / 2));
        g.save(); g.translate(px, py); g.rotate(t * 2 + i); g.fillRect(-3, -2, 6, 4); g.restore();
      }
    }
  };

  // 烛室（满画面）：暗室里一根残烛，对着窗外的落日或晨光；sky 'sunset' | 'dawn' | 'night'；burn 残烛程度；sunY 日的高度
  E.candleRoom = function (g, o = {}) {
    const t = o.t || 0, kind = o.sky || 'sunset', burn = o.burn ?? 0.8, wx0 = o.winX ?? 700, wx1 = wx0 + 460, wy0 = 110, wy1 = 520;
    const pal = { sunset: ['#3a2a4a', '#e07a4a', '#f8c070', '#f06a3a'], dawn: ['#5a6a9a', '#d8a8a8', '#f4dcc0', '#ffe0b0'], night: ['#0a1020', '#1a2a4a', '#2a3a5a', '#e8e0c8'] }[kind] || ['#3a2a4a', '#e07a4a', '#f8c070', '#f06a3a'];
    vfill(g, -40, -10, W + 40, H + 10, [[0, '#15110e'], [1, '#0c0907']]);
    // 窗外
    g.save(); g.beginPath(); g.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); g.clip();
    E.sky(g, { top: pal[0], mid: pal[1], bottom: pal[2], y0: wy0, y1: wy1 });
    if (kind === 'night') { E.stars(g, { t, n: 40, minY: wy0, maxY: wy1 - 100, seed: 2 }); E.moon(g, { x: wx0 + 300, y: wy0 + 110, r: 34, glow: 0.4 }); }
    else E.sun(g, { x: wx0 + 260, y: o.sunY ?? wy1 - 120, r: 46, color: pal[3], glow: 0.8 });
    E.jiangnanTown(g, { t, y: wy1 - 30, scale: 0.6, color: '#2a2024', roof: '#141012', haze: mix(pal[1], '#2a2024', 0.5), seed: 9, x0: wx0, x1: wx1, bank: false, lit: kind === 'night' ? 0.6 : 0 });
    g.fillStyle = '#100c0a'; g.fillRect(wx0, wy1 - 32, wx1 - wx0, 40);
    g.restore();
    // 窗棂
    g.strokeStyle = '#1a120c'; g.lineWidth = 12; g.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    g.lineWidth = 4; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(wx0 + (k * (wx1 - wx0)) / 4, wy0); g.lineTo(wx0 + (k * (wx1 - wx0)) / 4, wy1); g.stroke(); }
    g.beginPath(); g.moveTo(wx0, (wy0 + wy1) / 2 - 40); g.lineTo(wx1, (wy0 + wy1) / 2 - 40); g.stroke();
    g.fillStyle = '#2a1e16'; g.fillRect(wx0 - 30, wy1, wx1 - wx0 + 60, 14);
    // 斜照进屋的光，带窗棂的影
    g.save(); g.beginPath(); g.rect(-40, -40, W + 80, H + 80); g.rect(wx0 - 6, wy0 - 6, wx1 - wx0 + 12, wy1 - wy0 + 12); g.clip('evenodd');
    K.lighter(g, () => {
      g.fillStyle = K.lin(g, wx0, wy0, wx0 - 300, H, [[0, rgba(pal[2], 0.22)], [1, rgba(pal[2], 0)]]);
      g.beginPath(); g.moveTo(wx0, wy0); g.lineTo(wx1, wy0); g.lineTo(wx1 - 340, H); g.lineTo(wx0 - 420, H); g.closePath(); g.fill();
      A.glow(g, wx0 + 230, wy1 + 40, 380, pal[2], 0.22);
    });
    g.restore();
    g.strokeStyle = 'rgba(10,6,4,0.35)'; g.lineWidth = 14;
    for (let k = 1; k < 4; k++) { const fx = wx0 + (k * (wx1 - wx0)) / 4; g.beginPath(); g.moveTo(fx, wy1 + 14); g.lineTo(fx - 380 - k * 6, H); g.stroke(); }
    // 桌与残烛
    const tx = o.candleX ?? 420, ty = 560;
    g.fillStyle = K.lin(g, 0, ty, 0, ty + 30, [[0, '#4a3020'], [1, '#1a100a']]); g.fillRect(tx - 260, ty, 520, 26);
    g.fillStyle = '#140c08'; g.fillRect(tx - 240, ty + 26, 18, 140); g.fillRect(tx + 222, ty + 26, 18, 140);
    K.lighter(g, () => { A.glow(g, tx, ty - 60, 360, '#ff9a48', 0.22); A.glow(g, tx, ty + 6, 200, '#ffb060', 0.2); });
    E.candle(g, { x: tx, y: ty - 4, h: 110, r: 11, t, burn, wind: o.wind ?? 0.15, seed: 4, glow: 1.3, color: o.candleColor || '#d8cbb0' });
  };


  // 供镜头直接取用的小工具
  E.util = { shade, cached, put, cloth, flick, vfill, rad, roof, railing, lattice, glyphs, flame, fire };

  // ---------- 预览镜头 ----------

  const shot = (id, def) => XYT.registerShot && XYT.registerShot('kit_env_' + id, Object.assign({ zone: 'bottom', text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6' }, def));

  // 鼎湖峰：晨雾湖面、石笋倒影、云海
  shot('peak', {
    name: '样张·鼎湖峰', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 500;
      E.sky(g, { top: '#5f7fa6', mid: '#d3cfc6', bottom: '#f4dcc0', y1: hz, haze: '#fff3e0', hazeY: hz });
      E.sun(g, { x: 330, y: 190, r: 34, color: '#ffd6a0', glow: 0.7 });
      E.clouds(g, { t, y: 120, color: '#fff6ea', shade: '#b8b4c4', alpha: 0.8, scale: 0.7, speed: 5, n: 4, seed: 2 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 3, far: '#a9b6c6', near: '#5b6676', y0: hz - 16, y1: hz + 6, fog: '#f2ece2', fogA: 0.35, scale: 0.5 });
        E.stonePeak(q, { x: 1060, y: hz + 4, h: 240, w: 84, color: '#7b7568', light: '#efd8b2', seed: 13, t: lt, mist: false, alpha: 0.7 });
        E.stonePeak(q, { x: 760, y: hz + 8, h: 430, w: 136, color: '#5f584c', light: '#f6dcb0', t: lt, mist: false });
      };
      back(g);
      A.drawFog(g, '#f3eee6', 0.5, -lt * 9, hz - 40, 120);
      E.water(g, { y: hz, t, top: '#c9c6bf', bottom: '#4d5a6a', reflectFn: back, reflect: 0.6, glint: { x: 330, color: '#ffe2b8', w: 26, a: 0.35 } });
      A.drawFog(g, '#f3eee6', 0.45, lt * 6, hz + 6, 90);
      E.ripples(g, { x: 560, y: 620, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 2)], scale: 1.2 });
    },
  });

  // 潮声向东流：黄昏海面、河岸、拍岸浪
  shot('sea', {
    name: '样张·东流', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 420;
      E.sky(g, { top: '#3d4f7c', mid: '#d48a6c', bottom: '#f7c98e', y1: hz, haze: '#ffe0b0', hazeY: hz });
      E.clouds(g, { t, y: 150, color: '#f7c4a4', shade: '#7c6e8c', alpha: 0.7, scale: 1.1, speed: 6, seed: 3, n: 5 });
      E.sun(g, { x: 900, y: hz - 30, r: 52, color: '#ef6a3c', glow: 0.8, sink: hz });
      E.mountains(g, { t: lt, layers: [{ color: '#8a6f84', alpha: 0.7, y: hz + 2, scaleY: 0.45, speed: 2, kind: 'far' }] });
      E.water(g, { y: hz, t, top: '#d99a7e', bottom: '#2c3a55', glint: { x: 900, color: '#ffc58a', w: 60, a: 0.7 }, lines: 30 });
      E.waves(g, { t, y: hz + 8, color: '#1f2a40', light: '#e8b494', dir: 1, glint: { x: 900, color: '#ffd2a0', w: 70 } });
      E.shore(g, { t, side: 'left', y: 560, top: 520, reach: 460, color: '#4a3a33' });
    },
  });

  // 古道荒坡：秋草、夕照
  shot('road', {
    name: '样张·古道', night: false,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#7d8fae', mid: '#e8c39a', bottom: '#f6dcb0', y1: 470, haze: '#ffe7c2', hazeY: 470 });
      E.sun(g, { x: 880, y: 360, r: 40, color: '#f08a4a', glow: 0.8 });
      E.mountains(g, { t: lt, n: 2, far: '#b7a8a8', near: '#8d7c7a', y0: 445, y1: 470, fog: '#f3dcc0' });
      E.grassRoad(g, { t, y: 465, wind: 0.4 + 0.4 * c.inten, light: '#ffd49a' });
    },
  });

  // 雪原：脚印、冷月
  shot('snow', {
    name: '样张·雪原', night: true,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#16203a', mid: '#4d5f84', bottom: '#a9b6cc', y1: 470 });
      E.stars(g, { t, n: 70, maxY: 300, seed: 5 });
      E.moon(g, { x: 980, y: 150, r: 46, phase: 0.62, tilt: 0.1, color: '#eef0f6', haze: '#9fb6e8' });
      E.mountains(g, { t: lt, n: 3, far: '#7f8eaa', near: '#42506b', y0: 430, y1: 476, fog: '#c9d3e2', fogA: 0.5, rim: '#e8eef8' });
      E.snowfield(g, { t, y: 470, color: '#c9d3e6', shade: '#6f7fa0', footprints: { x0: 520, y0: 715, x1: 760, y1: 482, n: 30, progress: clamp(c.lt / 8) } });
    },
  });

  // 江南黄昏：水巷、白墙黛瓦倒影、乌篷船、客栈酒旗
  shot('jiangnan', {
    name: '样张·江南黄昏', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 478;
      E.sky(g, { top: '#4b5a86', mid: '#d99a7a', bottom: '#f6cf9a', y1: hz, haze: '#ffd9a8', hazeY: hz });
      E.clouds(g, { t, y: 110, color: '#f6b89a', shade: '#7d6a8e', scale: 0.8, alpha: 0.75, n: 4, seed: 4, speed: 4 });
      E.sun(g, { x: 400, y: 330, r: 40, color: '#f06c3c', glow: 0.8 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 2, far: '#9a8aa0', near: '#7a6c80', y0: 420, y1: 440, scale: 0.35, fog: '#f2c8a4', fogA: 0.4 });
        E.jiangnanTown(q, { t, y: hz, color: '#efe2cf', roof: '#3a3a42', haze: '#e7b994', lit: 0.6, seed: 3, light: '#ffb07a', lightX: 400 });
      };
      back(g);
      E.water(g, { y: hz, t, top: '#c99a86', bottom: '#2f3446', reflectFn: back, reflect: 0.7, wobble: 2.5, glint: { x: 400, color: '#ffc58a', w: 34, a: 0.5 } });
      E.dock(g, { x: 700, y: 580, s: 1, t, side: -1, lit: 0.8, len: 380 });
      E.inn(g, { x: 1090, y: 590, s: 0.95, t, lit: 0.85, wind: 0.6, bank: true, bankH: 150 });
      E.ripples(g, { x: 600, y: 610, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 1)], scale: 1.4, color: '#ffe2c0' });
      E.mapleTree(g, { x: 90, y: 760, s: 1.2, t, fall: 10 });
    },
  });

  // 夕阳挂墙头：院墙、月洞门里的桃林
  shot('wall', {
    name: '样张·墙头夕阳', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#5d6b94', mid: '#e7a37c', bottom: '#f9d7a2', y1: 420 });
      E.clouds(g, { t, y: 140, color: '#f7c1a0', shade: '#806c8e', scale: 0.9, alpha: 0.7, n: 4, seed: 7, speed: 3 });
      E.sun(g, { x: 830, y: 286, r: 62, color: '#f2643a', glow: 0.9, sink: 300 });
      E.mountains(g, { t: lt, n: 2, far: '#a68f9c', near: '#8d7788', y0: 360, y1: 380, scale: 0.35 });
      E.peachTree(g, { x: 1180, y: 330, s: 0.8, t, fall: 0, alpha: 0.9 });
      E.courtyardWall(g, { x: -20, y: 300, w: 1320, color: '#efe3cf', roof: '#3b3b42', light: '#ffb07a', lightX: 830, window: 'moon', winX: 420, winR: 150,
        through: (q) => {
          E.sky(q, { top: '#e9b48e', mid: '#f6d6b2', bottom: '#f3e2c4', y0: 300, y1: 720 });
          E.mountains(q, { t: lt, n: 2, far: '#c9a9a0', near: '#a88c8c', y0: 560, y1: 600, scale: 0.3 });
          q.fillStyle = K.lin(q, 0, 590, 0, 720, [[0, '#9aa070'], [1, '#5f6844']]); q.fillRect(200, 590, 450, 140);
          E.peachTree(q, { x: 470, y: 640, s: 0.9, t, fall: 10 });
        } });
      E.bamboo(g, { t, x0: 1050, x1: 1300, y: 740, h: 520, color: '#2d3f33', n: 5, wind: 0.6, seed: 5 });
    },
  });

  // 月夜荷塘：水月宫倒影、荷花、芦苇、萤光
  shot('lotus', {
    name: '样张·月夜荷塘', night: true, bloom: 0.55,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 452;
      E.sky(g, { top: '#0c1530', mid: '#25365e', bottom: '#4a5b80', y1: hz, haze: '#7c8fb8', hazeY: hz, hazeA: 0.4 });
      E.stars(g, { t, n: 110, maxY: 330, seed: 4, milky: 0.35, milkyY: 140 });
      E.moon(g, { x: 900, y: 150, r: 58, color: '#f4e7c4', glow: 0.55 });
      E.clouds(g, { t, y: 250, color: '#5d6d96', shade: '#28334f', alpha: 0.6, scale: 0.7, n: 4, seed: 9, speed: 4 });
      const back = (q) => {
        E.mountains(q, { t: lt, n: 2, far: '#3a4a72', near: '#26314f', y0: 430, y1: 452, scale: 0.4, light: '#9fb0d8', fog: '#56648c', fogA: 0.35 });
        E.palace(q, { x: 520, y: hz + 4, s: 0.78, t, lit: 0.7, jade: '#c9d2e4', roof: '#4d5f80', inner: '#7f93b8', gold: '#c9a55a', gauze: q === g ? '#e8e0f0' : false, mist: q === g ? '#8090b8' : false });
      };
      back(g);
      E.water(g, { y: hz, t, top: '#34466e', bottom: '#0b1226', reflectFn: back, reflect: 0.65, glint: { x: 900, color: '#f6e6bd', w: 30, a: 0.55 }, lineColor: '#c8d4f0' });
      E.mist(g, { t, y: hz + 20, h: 80, color: '#6a7aa6', alpha: 0.35, speed: 5 });
      E.reeds(g, { t, x0: 1040, x1: 1300, y: 730, h: 260, n: 26, color: '#0c1220', plume: '#aab4d0', wind: 0.4 });
      for (const [x, y, s, op, sd] of [[160, 640, 1.4, 1, 1], [330, 690, 1.1, 0.4, 2], [820, 660, 1.2, 0.8, 3], [980, 700, 1.5, 0.1, 4]])
        E.lotus(g, { x, y, s, open: op, t, seed: sd, leaves: 3, glow: 0.6, leafColor: '#22423e' });
      E.ripples(g, { x: 820, y: 662, t, t0: [c.grid.time(c.b.i), c.grid.time(c.b.i - 2)], color: '#e0e8ff', scale: 1.2 });
      K.lighter(g, () => { for (let i = 0; i < 24; i++) { const fx = 100 + A.noise1(t * 0.12 + i * 3.1, 5) * 1100, fy = 380 + A.noise1(t * 0.1 + i * 7.7, 6) * 300; A.glow(g, fx, fy, 9, '#d8f08a', 0.25 + 0.35 * Math.sin(t * 2 + i)); } });
    },
  });

  // 苏州擂台：比武招亲、灯笼夜市
  shot('arena', {
    name: '样张·擂台', night: false, bloom: 0.4,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#5a6f9a', mid: '#e3b48e', bottom: '#f2d6ae', y1: 560 });
      E.clouds(g, { t, y: 120, color: '#fbe0c8', shade: '#9a88a0', alpha: 0.75, scale: 0.8, n: 4, seed: 11, speed: 5 });
      E.mountains(g, { t: lt, n: 2, far: '#a596a6', near: '#8a7a8c', y0: 470, y1: 500, scale: 0.4, fog: '#f0d2b8' });
      E.jiangnanTown(g, { t, y: 560, scale: 0.85, color: '#ede0cc', roof: '#3c3c44', haze: '#e3c2a6', seed: 6, lit: 0.3 });
      g.fillStyle = K.lin(g, 0, 556, 0, H, [[0, '#9a8c78'], [1, '#5e5446']]); g.fillRect(-60, 556, W + 120, 200);
      E.arena(g, { x: 640, y: 690, s: 1.15, t, wind: 0.5 + 0.3 * c.inten });
      E.teahouse(g, { x: 1130, y: 650, s: 0.7, t, lit: 0.6 });
      for (let k = 0; k < 6; k++) E.lantern(g, { x: 40 + k * 46, y: 300 + (k % 2) * 20, s: 0.7, t, seed: k + 20, kind: k % 2 ? 'palace' : 'round' });
    },
  });

  // 锁妖塔：夜、冷月、塔中幽光；后半段塔身断裂坍塌
  shot('tower', {
    name: '样张·锁妖塔', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#070a14', mid: '#1a2238', bottom: '#3a3448', y1: 650, haze: '#5a4a5a', hazeY: 600 });
      E.stars(g, { t, n: 50, maxY: 300, seed: 8, alpha: 0.7 });
      E.moon(g, { x: 300, y: 150, r: 44, color: '#e8e4f0', haze: '#6a7ab8', glow: 0.5 });
      E.clouds(g, { t, y: 220, color: '#3a4260', shade: '#141828', alpha: 0.8, scale: 1, n: 5, seed: 13, speed: 9 });
      E.mountains(g, { t: lt, n: 3, far: '#2a3048', near: '#0e1018', y0: 560, y1: 640, scale: 0.55, light: '#6a7aa8', fog: '#3a3a52', fogA: 0.4, kind: 'mid' });
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
      E.temple(g, { t, layer: 'back' });
      E.nuwaStatue(g, { x: 640, y: 600, s: 1.05, t, glow: 0.8, awaken: clamp((c.lt - 5) / 3) });
      E.temple(g, { t, layer: 'front', burn: 0.35 });
    },
  });

  // 拜月祭坛：巨月、图腾柱、火盆
  shot('altar', {
    name: '样张·拜月祭坛', night: true, bloom: 0.5,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#0a0814', mid: '#2a1a3a', bottom: '#4a3050', y1: H });
      E.stars(g, { t, n: 60, maxY: 400, seed: 12, alpha: 0.6 });
      E.clouds(g, { t, y: 120, color: '#4a3a5a', shade: '#1a1020', alpha: 0.7, n: 4, seed: 21, speed: 6 });
      E.mountains(g, { t: lt, n: 2, far: '#2a2038', near: '#16101e', y0: 600, y1: 640, scale: 0.5, kind: 'karst', light: '#6a5a8a', fog: '#3a2a48' });
      g.fillStyle = K.lin(g, 0, 630, 0, H, [[0, '#2a2034'], [1, '#0e0a14']]); g.fillRect(-40, 630, W + 80, 100);
      E.mist(g, { t, y: 650, h: 90, color: '#4a3a5a', alpha: 0.6, speed: 6 });
      E.altar(g, { x: 640, y: 690, s: 0.95, t, moonR: 210, moonY: 420 });
    },
  });

  // 喜堂与残烛：前半红烛高照，后半褪成灰烬
  shot('wedding', {
    name: '样张·喜堂', night: true, bloom: 0.5,
    draw(g, c) { E.weddingHall(g, { t: c.t, fade: clamp((c.lt - 4) / 5) }); },
  });
  shot('candle', {
    name: '样张·残烛对落日', night: true, bloom: 0.5,
    draw(g, c) {
      E.candleRoom(g, { t: c.t, burn: 0.85, sky: 'sunset', sunY: 360 + c.lt * 6 });
      E.swordInGround(g, { x: 560, y: 560, s: 0.55, t: c.t, ground: null, angle: 0.5, tassel: '#c8302a', glint: false });
      E.gourd(g, { x: 270, y: 540, s: 0.8, t: c.t, angle: 0.3 });
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
      E.wineJar(g, { x: 180, y: 640, s: 1.1 });
      E.gourd(g, { x: 340, y: 600, s: 1.1, t, angle: -0.2 });
      E.chessboard(g, { x: 640, y: 570, s: 1.1, stones: 30 });
      E.inkstone(g, { x: 960, y: 600, s: 1, wet: 1 - clamp((c.lt - 5) / 4) });
      E.candle(g, { x: 1150, y: 560, h: 80, t, burn: clamp(c.lt / 9) });
    },
  });

  // 蜀山云海：晨光、石峰林、孤峰古松、仙鹤
  shot('shushan', {
    name: '样张·蜀山云海', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt;
      E.sky(g, { top: '#5a78a8', mid: '#e8c8b0', bottom: '#fbe6c8', y1: 540, haze: '#fff0d8', hazeY: 480 });
      E.sun(g, { x: 860, y: 400, r: 44, color: '#ffd090', glow: 0.9 });
      E.mountains(g, { t: lt, layers: [
        { kind: 'karst', color: '#8a96ae', light: '#efd8c4', litA: 0.45, y: 480, scaleY: 0.6, speed: 1, seed: 3 },
        { kind: 'karst', color: '#5a6680', light: '#d8b8a4', litA: 0.4, y: 540, scaleY: 0.75, speed: 2.5, seed: 5 },
      ] });
      E.cloudSea(g, { t, y: 480, color: '#ffeedd', shade: '#76769c', speed: 8, rows: 5 });
      E.stonePeak(g, { x: 240, y: 760, h: 520, w: 170, color: '#4f4a44', light: '#f2d2a8', t: lt, mist: '#f6efe6', seed: 21 });
      E.pines(g, { x: 286, y: 256, s: 0.24, t, seed: 4, flip: false });
      for (let k = 0; k < 3; k++) A.crane(g, 760 + k * 70 + lt * 12, 210 + k * 26 + Math.sin(t + k) * 6, 0.55, c.b.x * TAU + k, { color: '#2a2a32' });
      E.cloudSea(g, { t: t + 40, y: 640, color: '#ffffff', shade: '#c8c0d4', speed: 18, rows: 2, alpha: 0.85, seed: 5 });
    },
  });

  // 仙都红蒲公英：鼎湖峰下，红絮漫天（都成红）
  shot('fluff', {
    name: '样张·红蒲公英', night: false, bloom: 0.45,
    draw(g, c) {
      const t = c.t, lt = c.lt, hz = 520;
      E.sky(g, { top: '#8aa0c0', mid: '#ead8c8', bottom: '#f6e0c8', y1: hz, haze: '#fff0e0', hazeY: hz });
      E.mountains(g, { t: lt, n: 2, far: '#b4b8c4', near: '#8a8c98', y0: hz - 20, y1: hz, scale: 0.4, fog: '#f4ece4' });
      E.stonePeak(g, { x: 820, y: hz + 10, h: 470, w: 150, color: '#5f574c', light: '#f6dcb0', t: lt, mist: '#f6efe8' });
      g.fillStyle = K.lin(g, 0, hz, 0, H, [[0, '#9a9a6a'], [1, '#4a5232']]); g.fillRect(-40, hz, W + 80, H - hz + 20);
      E.mist(g, { t, y: hz + 10, h: 70, color: '#f4ece4', alpha: 0.6 });
      E.grassRoad(g, { t, y: hz + 10, color: '#8a8e58', dark: '#3a4222', light: '#ffe0c0', path: false, n: 60, seed: 4 });
      E.dandelions(g, { t, x0: -20, x1: 1300, y: 740, n: 34, release: 0.8, wind: 0.6, s: 1.2 });
      E.dandelions(g, { t, x0: 100, x1: 1200, y: 640, n: 26, release: 0.5, wind: 0.6, s: 0.55, seed: 3 });
    },
  });
})();
