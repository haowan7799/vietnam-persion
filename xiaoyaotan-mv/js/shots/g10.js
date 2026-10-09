/* 分镜镜头 第 10 组：副歌2 前四句——血月拜月、阿奴弑父、塔中符牢、锁链相认 */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot || !XYT.kit || !XYT.env || !XYT.vfx || !XYT.fig) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, h2, noise1, rgba, mix } = A;
  const PI = Math.PI;

  // ---------- 本组通用小工具 ----------
  const C = (key, w, h, sc, fn) => K.cache('g10|' + key, w, h, sc, fn);
  const tint = (img, col) => E.util.tintOf(img, col);
  const ramp = (x, a, b) => smooth((x - a) / (b - a));
  // 柔光：乘上调用方的透明度（A.glow 会把透明度重置为 1，这里不用它）
  function glo(g, x, y, r, col, a) {
    if (!(a > 0.003) || !(r > 0.5)) return;
    const p = g.globalAlpha;
    g.globalAlpha = p * clamp(a);
    g.drawImage(XYT.sprites.tint(XYT.sprites.glow, col), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = p;
  }
  const add = (g, fn) => { const op = g.globalCompositeOperation; g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = op; };
  // 底色比画面大得多：荷兰角、抖动时四角也不露底
  const base = (g, col) => { g.fillStyle = col; g.fillRect(-700, -700, W + 1400, H + 1400); };
  // 本句第 k 个字的镜内时间（没有歌词时用分镜表里的实测值）
  const chT = (c, k, def) => { const v = c.charT ? c.charT(k) : null; return v == null ? def[k] : v - (c.t - c.lt); };
  // 手持机位：rot 荷兰角，z 缩放（绕 cx, cy），amp 噪声晃动，kick 冲击震动
  function cam(g, c, o) {
    const t = c.t, a = o.amp ?? 3, k = o.kick || 0;
    const dx = a * (noise1(t * 1.6, 3) * 2 - 1) + k * Math.sin(t * 87) + (o.px || 0);
    const dy = a * (noise1(t * 1.4, 5) * 2 - 1) + k * Math.cos(t * 73) + (o.py || 0);
    const rot = (o.rot || 0) + (o.wob || 0) * (noise1(t * 0.8, 9) * 2 - 1);
    const cx = o.cx ?? W / 2, cy = o.cy ?? H / 2, z = o.z ?? 1;
    g.save(); g.translate(cx + dx, cy + dy); if (o.rot || o.wob) g.rotate(rot); g.scale(z, z); g.translate(-cx, -cy);
  }
  // 拖着贴图：中心 (x, y)，宽 w 高 h，转 rot
  function putR(g, img, x, y, w, h, rot) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
  }
  // 暗角
  function vignette(g, a, col, m) {
    const gr = g.createRadialGradient(640, 380, 280, 640, 380, 860);
    gr.addColorStop(0, rgba(col || '#000000', 0)); gr.addColorStop(1, rgba(col || '#000000', a));
    g.fillStyle = gr; g.fillRect(-(m ?? 60), -(m ?? 60), W + 2 * (m ?? 60), H + 2 * (m ?? 60));
  }
  // 墨色远峰：一簇簇高矮胖瘦不一的石峰（karst 时圆顶陡壁），由峰顶往下淡进雾里；rim 受光一侧的细亮边
  function inkRidge(g, o) {
    const r = A.rng(o.seed), n = o.n || 9, pk = [];
    let x = -180;
    while (x < W + 180) {
      const w = (o.w || 60) * (0.45 + 0.9 * r()), h = o.h * (0.3 + 0.7 * Math.pow(r(), 0.8));
      pk.push([x + w, w * (0.8 + 0.4 * r()), w * (0.8 + 0.4 * r()), h, 2.4 + 3 * r()]);
      x += w * (0.7 + 1.5 * r()) * (r() < 0.25 ? 2.2 : 1);
    }
    const top = (x) => {
      let y = 0;
      for (const [cx, wl, wr, h, pw] of pk) { const u = (x - cx) / (x < cx ? wl : wr), a = Math.abs(u); if (a < 1) y = Math.max(y, h * (o.karst ? 1 - Math.pow(a, pw) : Math.pow(1 - a * a, 1.4))); }
      return o.y - y - (noise1(x * 0.03, o.seed) - 0.5) * (o.rough ?? 8) - 4;
    };
    g.beginPath(); g.moveTo(-200, o.y + 60);
    for (let x = -200; x <= W + 200; x += 4) g.lineTo(x, top(x));
    g.lineTo(W + 200, o.y + 60); g.closePath();
    g.fillStyle = K.lin(g, 0, o.y - o.h, 0, o.y + 10, [[0, o.col], [0.6, mix(o.col, o.fog, 0.4)], [1, o.fog]]);
    g.fill();
    if (o.tex) {
      // 皴：峰身上竖向的干笔，深浅两色
      g.save(); g.clip();
      const br = brushTex(o.seed % 5 + 1), dk = tint(br, mix(o.col, '#000000', 0.5)), lt = tint(br, o.tex);
      for (const [cx, wl, wr, h] of pk) {
        if (cx < -150 || cx > W + 150) continue;
        for (let k = 0; k < 3; k++) {
          const sx = cx + (r() - 0.5) * (wl + wr) * 0.7, L = h * (0.5 + 0.5 * r());
          g.globalAlpha = 0.25 + 0.3 * r();
          putR(g, r() < 0.4 ? lt : dk, sx, o.y - h + L / 2 + 6, L, 6 + 10 * r(), PI / 2 + (r() - 0.5) * 0.25);
        }
      }
      g.globalAlpha = 1;
      g.restore();
    }
    if (o.rim) {
      g.strokeStyle = rgba(o.rim, o.rimA ?? 0.35); g.lineWidth = 1.3;
      g.beginPath(); let on = false;
      for (let x = -200; x <= W + 200; x += 4) { const y = top(x), d = top(x + 4) - y, lit = (o.lightDir || -1) * d > 0.3; if (lit) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } else on = false; }
      g.stroke();
    }
  }
  // 乌云墨团：一层压暗的墨云，朝月一侧先垫一层暗红，留出被月光照到的云边
  function inkClouds(g, list, rimCol, mx, my) {
    for (const [x, y, w, h, seed, a] of list) {
      const tx = splashTex(seed);
      g.globalAlpha = a; g.drawImage(tint(tx, '#07050a'), x - w / 2, y - h / 2, w, h);
    }
    g.globalAlpha = 1;
  }

  // 飞白笔触（白色，用时着色）：横向一笔，起笔浓、收笔散成丝，丝间有断续的留白
  function brushTex(seed, noHead) {
    return C('brush' + seed + (noHead ? 'n' : ''), 512, 80, 0.6, (q) => {
      const r = A.rng(seed * 131 + 9);
      q.fillStyle = '#ffffff';
      for (let i = 0; i < 52; i++) {
        const v = (i + 0.5) / 52, y = 10 + v * 60, edge = Math.abs(v - 0.5) * 2;
        const th = 0.7 + r() * 1.9;
        let x = 14 + edge * edge * 90 + r() * 26;
        const end = 500 - edge * 170 - r() * 90;
        while (x < end) {
          const L = 18 + r() * 150, gap = r() < 0.38 ? 3 + r() * 26 : 0;
          q.globalAlpha = (0.3 + 0.6 * r()) * (1 - 0.5 * (x / 512));
          q.fillRect(x, y + Math.sin(x * 0.01 + i) * 1.4, Math.min(L, end - x), th);
          x += L + gap;
        }
      }
      // 起笔处一团浓墨
      if (!noHead) { q.globalAlpha = 0.9; q.beginPath(); q.ellipse(40, 40, 30, 26, 0, 0, TAU); q.fill(); }
      q.globalAlpha = 1;
    });
  }
  // 泼墨团（白色，用时着色）：淡墨晕托底，几块不规则浓墨，边上几笔斜扫的干笔
  function splashTex(seed) {
    return C('splash' + seed, 640, 400, 0.45, (q) => {
      const r = A.rng(seed * 977 + 13);
      for (let i = 0; i < 30; i++) A.softBlob(q, 320 + (r() - 0.5) * 440, 200 + (r() - 0.5) * 210, 50 + r() * 120, 0.2, '#ffffff');
      for (let i = 0; i < 7; i++) {
        q.fillStyle = `rgba(255,255,255,${(0.22 + r() * 0.3).toFixed(2)})`;
        A.inkBlob(q, 320 + (r() - 0.5) * 300, 200 + (r() - 0.5) * 130, 40 + r() * 70, seed * 7 + i, 0.5); q.fill();
      }
      const br = brushTex(seed % 5 + 1);
      for (let i = 0; i < 10; i++) {
        q.globalAlpha = 0.15 + r() * 0.25;
        putR(q, br, 320 + (r() - 0.5) * 360, 200 + (r() - 0.5) * 200, 160 + r() * 200, 20 + r() * 30, (r() - 0.5) * 0.7);
      }
      q.globalAlpha = 1;
    });
  }
  // 闪电只在亮的那一小段里画（之后几乎看不见，却很费时）
  // 闪电（本地的轻量版）：主干用中点位移折出锯齿，两三道分叉；亮度三闪而灭；返回当前亮度 0..1
  function zapPath(r, x0, y0, x1, y1, dev, depth, out) {
    if (depth > 5) { out.push([x1, y1]); return; }
    const mx = (x0 + x1) / 2 + (r() - 0.5) * dev * Math.hypot(x1 - x0, y1 - y0), my = (y0 + y1) / 2 + (r() - 0.5) * dev * 0.3 * Math.abs(y1 - y0);
    zapPath(r, x0, y0, mx, my, dev * 0.62, depth + 1, out); zapPath(r, mx, my, x1, y1, dev * 0.62, depth + 1, out);
  }
  function bolt(g, c, o) {
    let lv = 0;
    const col = o.color || BOLT_V, wd = o.width ?? 1;
    o.at.forEach((s0, k) => {
      const age = c.lt - s0;
      if (age < -0.01 || age > (o.life ?? 0.5)) return;
      const a = Math.max(0, age), I = Math.max(Math.exp(-a / 0.06), a > 0.09 ? 0.75 * Math.exp(-(a - 0.09) / 0.07) : 0, a > 0.22 ? 0.5 * Math.exp(-(a - 0.22) / 0.12) : 0);
      lv = Math.max(lv, I);
      const r = A.rng((o.seed || 91) * 977 + k * 131 + 7), x = o.xs ? o.xs[k] : o.x, y0 = o.y0 ?? -40, y1 = o.y1 ?? 520, xe = x + (r() - 0.5) * (o.drift ?? 200);
      const main = [[x, y0]]; zapPath(r, x, y0, xe, y1, 0.32, 0, main);
      const br = [];
      for (let b = 0; b < 3; b++) { const i = 8 + Math.floor(r() * (main.length - 20)), p = main[i], L = 60 + 140 * r(), an = PI / 2 + (r() < 0.5 ? -1 : 1) * (0.5 + 0.6 * r()); const pts = [p]; zapPath(r, p[0], p[1], p[0] + Math.cos(an) * L, p[1] + Math.sin(an) * L, 0.35, 2, pts); br.push(pts); }
      add(g, () => {
        const p0 = g.globalAlpha;
        if (I > 0.25) { g.fillStyle = rgba(col, (o.flash ?? 0.6) * I * 0.14); g.fillRect(-300, -300, W + 600, H + 600); }
        g.globalAlpha = p0 * clamp((o.flash ?? 0.6) * I * 0.7); g.drawImage(XYT.sprites.tint(XYT.sprites.glow, col), x - 360, y0 - 160, 720, 560);
        g.globalAlpha = p0; g.lineCap = 'round'; g.lineJoin = 'round';
        const line = (pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); };
        for (const [lw, al, cc] of [[7, 0.3, col], [2, 0.95, '#ffffff']]) {
          g.strokeStyle = rgba(cc, clamp(al * I)); g.lineWidth = lw * wd; line(main);
          g.strokeStyle = rgba(cc, clamp(al * I * 0.6)); g.lineWidth = lw * wd * 0.5; br.forEach(line);
        }
        g.globalAlpha = p0 * clamp(0.3 * I); for (let i = 0; i < main.length; i += 16) g.drawImage(XYT.sprites.tint(XYT.sprites.glow, col), main[i][0] - 80, main[i][1] - 80, 160, 160);
        g.globalAlpha = p0;
      });
    });
    return lv;
  }
  // 大笔泼墨的一刀：粗起细收，中间实、两边散成飞白（白色，用时着色）
  function slashTex(seed) {
    return C('slash' + seed, 1024, 200, 0.5, (q) => {
      const r = A.rng(seed * 59 + 3);
      const env = (u) => Math.pow(Math.sin(PI * clamp(u * 0.92 + 0.04)), 0.55) * (1 - 0.55 * u);
      q.fillStyle = '#ffffff';
      // 实心的笔肚
      q.globalAlpha = 0.75; q.beginPath();
      for (let i = 0; i <= 60; i++) { const u = i / 60; q.lineTo(20 + u * 980, 100 - env(u) * 46 + (noise1(u * 9, seed) - 0.5) * 10); }
      for (let i = 60; i >= 0; i--) { const u = i / 60; q.lineTo(20 + u * 980, 100 + env(u) * 40 + (noise1(u * 9, seed + 1) - 0.5) * 10); }
      q.closePath(); q.fill();
      // 飞白：笔肚两边散开的丝，越到收笔越散
      for (let i = 0; i < 150; i++) {
        const v = (r() - 0.5) * 2, th = 0.8 + r() * 2.4;
        let x = 20 + r() * 200;
        while (x < 1000) {
          const u = (x - 20) / 980, e = env(u), L = 20 + r() * 140;
          if (Math.abs(v) < 1.15 && r() > 0.25) { q.globalAlpha = (0.25 + 0.6 * r()) * (1 - Math.abs(v) * 0.5); q.fillRect(x, 100 + v * e * 78, L, th); }
          x += L + (r() < 0.4 ? 6 + r() * 40 : 0);
        }
      }
      q.globalAlpha = 1;
    });
  }
  // 节拍冲击：最近一个时刻 ts（数组）之后的衰减包络
  function kickOf(lt, list, d) {
    let v = 0;
    for (const s of list) if (lt >= s) v = Math.max(v, Math.exp(-(lt - s) / d));
    return v;
  }

  // 静态底版：不动的远中景先画进一张比画面大一圈的缓存（四周各留 PM），每帧整张贴一次
  const PM = 130;
  const plate = (key, sc, fn) => C('plate-' + key, W + PM * 2, H + PM * 2, sc, (q) => { q.translate(PM, PM); fn(q); });
  // 底版内容很柔（天、云、雾、远山、水），贴的时候关掉插值：旋转缩放下整屏贴图省一大半时间，看不出差别
  // 放大超过 1.25 倍时（低分辨率底版或大幅推近）照常插值，免得出马赛克
  const putPlate = (g, img) => { const sm = g.imageSmoothingEnabled, m = g.getTransform(), up = Math.hypot(m.a, m.b) * (W + PM * 2) / img.width; g.imageSmoothingEnabled = up > 1.25; g.drawImage(img, -PM, -PM, W + PM * 2, H + PM * 2); g.imageSmoothingEnabled = sm; };
  // 贴缓存图：倍率接近 1:1 且没有旋转时不插值（快很多，也不糊）
  function blit(g, img, x, y, w, h) {
    const m = g.getTransform(), r = Math.hypot(m.a, m.b) * w / img.width, sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = !(r > 0.85 && r < 1.2 && Math.abs(m.b) < 1e-6);
    g.drawImage(img, x, y, w, h); g.imageSmoothingEnabled = sm;
  }
  // 局部静态层（建筑、崖石这类边缘清楚的）：只缓存一块区域，照常插值贴
  function putLayer(g, key, x0, y0, w, h, sc, fn) {
    blit(g, C('layer-' + key, w, h, sc, (q) => { q.translate(-x0, -y0); fn(q); }), x0, y0, w, h);
  }
  // 水面碎光：一行行短亮痕，左右错落、各自明灭（只画碎光，不重画水面）
  function glints(g, t, x, y0, y1, w, col, a, seed) {
    const spr = XYT.sprites.tint(XYT.sprites.glow, col);
    add(g, () => {
      const p = g.globalAlpha;
      for (let i = 0; i < 22; i++) {
        const u = i / 22, yy = y0 + Math.pow(u, 1.4) * (y1 - y0), spread = w * (0.4 + u * 1.8);
        for (let k = 0; k < 2; k++) {
          const f = noise1(t * (1.4 + h2(i * 3 + k, seed)) + i * 0.7 + k * 3.1, seed);
          if (f < 0.4) continue;
          const jx = (h2(i * 3 + k, seed + 1) - 0.5) * 2 * spread + Math.sin(t * 1.2 + i) * (2 + u * 6);
          const len = w * (0.3 + 0.6 * h2(i * 3 + k, seed + 2)) * (0.5 + u);
          g.globalAlpha = p * clamp(a * (f - 0.4) * 2.4 * (1 - u * 0.5));
          g.drawImage(spr, x + jx - len / 2, yy - 1 - u * 1.5, len, 2 + u * 3);
        }
      }
      g.globalAlpha = p;
    });
  }

  // =====================================================================
  // 33 血月拜月：笑叹词穷｜古痴今狂｜终成空
  // =====================================================================
  const BM_T = [0.27, 0.63, 0.97, 1.33, 2.29, 2.67, 3.17, 3.59, 3.91, 4.38, 4.85];
  const RIM_V = '#b8a0ff', BOLT_V = '#c8b8ff';

  // 拜月背影（工具包只有侧身，这里自绘）：脚底 (x, y)，s=1 约 190 高，背对镜头。
  // arms 0 垂手 → 0.5 平张（狂笑）→ 1 高举成 V（召唤）；laugh 0..1 头后仰、双肩随笑抖；wind 风向右吹的力度
  function baiyuePaths(s, t, o) {
    const arms = o.arms ?? 1, laugh = o.laugh || 0, wind = o.wind ?? 0.8, ph = o.phase || 0;
    const shake = laugh * 2.4 * Math.sin(t * TAU * 6.5 + ph);
    const P = (x, y) => [x * s, y * s];
    const sh = -150 + shake * 0.7, hy = -175 + laugh * 6 + shake;
    const wv = (k, f, a) => Math.sin(t * f + k) * a;
    // 长袍：宽肩、收腰、下摆外张，被风吹向右
    const robe = new Path2D();
    { const hemR = 66 + 36 * wind, hemL = -58 + 6 * wind;
      robe.moveTo(...P(-30, sh + 6)); robe.bezierCurveTo(...P(-27, -112), ...P(-30, -60), ...P(hemL - 4, -3));
      for (let i = 0; i <= 12; i++) { const u = i / 12, xx = lerp(hemL, hemR, u), yy = 1 + Math.sin(u * 7 + t * 2.6) * 2.4 - u * u * 10 * wind + wv(i, 2.2, 1.2); robe.lineTo(...P(xx, yy)); }
      robe.bezierCurveTo(...P(40 + 12 * wind, -48), ...P(28, -112), ...P(30, sh + 6)); robe.closePath(); }
    // 披风：从双肩披下，下缘几道圆转的波，整片向右翻飞（风大时甩出剪影之外）
    const cape = new Path2D(), capeHem = [];
    { cape.moveTo(...P(-33, sh)); cape.bezierCurveTo(...P(-44, -118), ...P(-46, -70), ...P(-40 + 6 * wind, -30));
      for (let i = 1; i <= 16; i++) { const u = i / 16, xx = lerp(-40 + 6 * wind, 66 + 54 * wind, u), yy = -30 + 6 * Math.sin(u * PI * 3 + t * 2.4) - u * u * 46 * wind + wv(i * 0.9, 3, 3 * u); capeHem.push([xx, yy]); cape.lineTo(...P(xx, yy)); }
      cape.bezierCurveTo(...P(52 + 34 * wind, -84 - 6 * wind), ...P(44, -126), ...P(33, sh)); cape.closePath(); }
    // 肩甲：双肩各一片微翘的弧
    const pads = new Path2D();
    for (const sd of [-1, 1]) { pads.moveTo(...P(sd * 16, sh - 2)); pads.quadraticCurveTo(...P(sd * 36, sh - 9), ...P(sd * 44, sh + 6)); pads.quadraticCurveTo(...P(sd * 34, sh + 4), ...P(sd * 18, sh + 8)); pads.closePath(); }
    // 双臂与大袖：袖口宽，下垂成一面旗似的布，随风起伏
    const armPath = new Path2D(), sleeves = new Path2D(), linings = [], hands = [];
    for (const sd of [-1, 1]) {
      // 左臂从“垂下”经“平张”转到“左上”，右臂对称（角度不能穿过身体）
      const a = sd < 0 ? lerp(PI / 2 + 0.2, PI + PI / 2 - 0.62, arms) : lerp(PI / 2 - 0.2, -PI / 2 + 0.62, arms);
      const sx = sd * 30, sy = sh + 7, len = 68, ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len;
      hands.push([ex, ey, a]);
      armPath.moveTo(...P(sx, sy)); armPath.quadraticCurveTo(...P(sx + Math.cos(a) * len * 0.5 + sd * 3, sy + Math.sin(a) * len * 0.5 + 4), ...P(ex, ey));
      const drop = 24 + 52 * clamp(arms * 1.3), top = [], bot = [];
      for (let i = 0; i <= 9; i++) {
        const u = 0.1 + 0.9 * i / 9, px = lerp(sx, ex, u), py = lerp(sy, ey, u);
        top.push([px, py - 5]);
        const d = drop * Math.pow(u, 1.15) * (0.85 + 0.15 * Math.sin(t * 2.6 + i * 0.9 + sd)) + 10;
        bot.push([px + d * 0.4 * wind + wv(i + sd * 3, 3.4, 2.2) + sd * u * 6, py + d]);
      }
      // 袖口外沿多甩出一角
      const last = bot[bot.length - 1], te = top[top.length - 1];
      sleeves.moveTo(...P(top[0][0], top[0][1]));
      top.forEach((q) => sleeves.lineTo(...P(q[0], q[1])));
      sleeves.quadraticCurveTo(...P(te[0] + sd * 10 + 8 * wind, te[1] + 6), ...P(last[0] + sd * 8 + 10 * wind, last[1] - 4));
      for (let i = bot.length - 1; i >= 0; i--) sleeves.lineTo(...P(bot[i][0], bot[i][1]));
      sleeves.closePath();
      linings.push(bot);
    }
    // 头（背面）、及腰长发、高冠：头后一弯仰月，中间竖一支尖翎
    const head = new Path2D();
    head.ellipse(0, hy * s, 11.5 * s, 13 * s, 0, 0, TAU);
    const hair = new Path2D(), strands = [];
    { const sw = wind * 12; hair.moveTo(...P(-11, hy)); hair.bezierCurveTo(...P(-15, hy + 34), ...P(-13, -112), ...P(-9 + sw * 0.5, -84 + wv(1, 2, 2)));
      hair.lineTo(...P(11 + sw, -82 + wv(2, 2.3, 2))); hair.bezierCurveTo(...P(15 + sw * 0.4, -112), ...P(15, hy + 34), ...P(11, hy)); hair.closePath();
      for (let k = 0; k < 5; k++) strands.push([[-8 + k * 4, hy + 8], [-8 + k * 4 + sw * 0.4, -118], [-6 + k * 4 + sw * (0.9 + 0.2 * k) + wv(k, 2.6, 3), -78 + k * 2]]); }
    const crown = new Path2D();
    { const cy = hy - 12, tilt = laugh * 0.14 + 0.02 * Math.sin(t * 1.3);
      const R = (x, y) => { const c = Math.cos(tilt), n = Math.sin(tilt); return [(x * c - (y - cy) * n) * s, (cy + x * n + (y - cy) * c) * s]; };
      // 仰月：外弧大、内弧上移，两角尖朝天
      const mc = cy - 10, N = 18;
      for (let i = 0; i <= N; i++) { const a = -0.12 + (PI + 0.24) * i / N; const q = R(Math.cos(a) * 31, mc + Math.sin(a) * 26); i ? crown.lineTo(...q) : crown.moveTo(...q); }
      for (let i = N; i >= 0; i--) { const a = -0.36 + (PI + 0.72) * i / N; crown.lineTo(...R(Math.cos(a) * 25, mc - 9 + Math.sin(a) * 21)); }
      crown.closePath();
      crown.moveTo(...R(-3, cy + 2)); crown.quadraticCurveTo(...R(-1.8, cy - 26), ...R(0, cy - 40)); crown.quadraticCurveTo(...R(1.8, cy - 26), ...R(3, cy + 2)); crown.closePath();
      crown.moveTo(...R(4.2, cy - 40)); crown.arc(...R(0, cy - 40), 4.2 * s, 0, TAU);
    }
    return { robe, cape, pads, sleeves, armPath, head, hair, strands, crown, hands, linings, capeHem, hy, sh };
  }
  function baiyueBack(g, x, y, s, t, o = {}) {
    const p = baiyuePaths(s, t, o), rim = o.rim || RIM_V, ra = o.rimA ?? 0.9;
    g.save(); g.translate(x, y);
    const fills = [p.cape, p.robe, p.sleeves, p.pads, p.hair, p.head, p.crown];
    // 轮廓光：先描一圈亮边（一半落在剪影外），再整体填黑，只剩外缘一线光
    if (rim && ra > 0) {
      add(g, () => {
        g.lineJoin = 'round'; g.lineCap = 'round';
        g.strokeStyle = rgba(rim, 0.85 * ra); g.lineWidth = 2.4 * s; for (const f of fills) g.stroke(f);
        g.lineWidth = 9.4 * s; g.stroke(p.armPath);
      });
    }
    const ink = o.ink || '#07050a';
    g.fillStyle = K.lin(g, 0, -190 * s, 0, 0, [[0, ink], [0.75, mix(ink, '#1e1030', 0.35)], [1, mix(ink, '#3a2060', 0.4)]]);
    g.fill(p.robe);
    g.fillStyle = K.lin(g, 0, -150 * s, 0, -20 * s, [[0, ink], [1, mix(ink, '#160c22', 0.8)]]); g.fill(p.cape);
    g.strokeStyle = ink; g.lineWidth = 7 * s; g.lineCap = 'round'; g.stroke(p.armPath);
    g.fillStyle = K.lin(g, 0, -270 * s, 0, -60 * s, [[0, ink], [1, mix(ink, '#2a1446', 0.45)]]); g.fill(p.sleeves);
    g.fillStyle = ink; g.fill(p.pads);
    // 衣纹：披风上几道顺风的淡紫长弧；袖里、披风下缘一线紫衬
    g.strokeStyle = rgba('#5a3a8a', 0.4); g.lineWidth = 1.1 * s; g.beginPath();
    for (let k = 0; k < 4; k++) { const q = p.capeHem[3 + k * 4]; g.moveTo((-14 + k * 10) * s, (p.sh + 14) * s); g.quadraticCurveTo((-8 + k * 14) * s, -90 * s, q[0] * s, (q[1] - 4) * s); }
    g.stroke();
    g.strokeStyle = rgba('#7a4cc0', 0.8); g.lineWidth = 1.7 * s;
    g.beginPath(); for (const bot of p.linings) bot.forEach((q, i) => (i ? g.lineTo(q[0] * s, q[1] * s - 2 * s) : g.moveTo(q[0] * s, q[1] * s - 2 * s))); g.stroke();
    g.beginPath(); p.capeHem.forEach((q, i) => (i ? g.lineTo(q[0] * s, q[1] * s - 2.5 * s) : g.moveTo(q[0] * s, q[1] * s - 2.5 * s))); g.stroke();
    g.fillStyle = ink; g.fill(p.hair); g.fill(p.head); g.fill(p.crown);
    g.strokeStyle = rgba('#2a2036', 0.9); g.lineWidth = 0.9 * s; g.beginPath();
    for (const [a, b, c2] of p.strands) { g.moveTo(a[0] * s, a[1] * s); g.quadraticCurveTo(b[0] * s, b[1] * s, c2[0] * s, c2[1] * s); }
    g.stroke();
    // 冠上的银边、背上的月牙图腾
    g.strokeStyle = rgba('#dfe2f6', 0.6); g.lineWidth = 1.1 * s; g.stroke(p.crown);
    g.fillStyle = rgba('#cfc6f2', 0.75);
    g.beginPath(); g.arc(0, -114 * s, 9 * s, PI * 0.15, PI * 1.85); g.arc(3.4 * s, -114 * s, 7.4 * s, PI * 1.75, PI * 0.25, true); g.fill();
    add(g, () => glo(g, 0, -114 * s, 18 * s, '#8a6cff', 0.35));
    // 杖：右手握着，杖头仰月托紫珠
    if (o.staff !== false) {
      const [hx, hy2] = p.hands[1], tx = hx * s + 4 * s, ty = hy2 * s - 46 * s, bx = hx * s - 4 * s, by = hy2 * s + 96 * s;
      g.strokeStyle = '#1a1220'; g.lineWidth = 2.8 * s; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
      g.fillStyle = '#dfe2f6';
      g.beginPath(); g.arc(tx, ty - 10 * s, 11 * s, -0.32, PI + 0.32); g.arc(tx, ty - 14.5 * s, 9 * s, PI + 0.62, -0.62, true); g.closePath(); g.fill();
      add(g, () => { glo(g, tx, ty - 12 * s, 26 * s, '#b9a8ff', 0.5 * (o.fx ?? 1)); glo(g, tx, ty - 11 * s, 5 * s, '#ffffff', 0.8 * (o.fx ?? 1)); });
    }
    g.restore();
    return { head: [x, y + p.hy * s], hands: p.hands.map((h) => [x + h[0] * s, y + h[1] * s]), top: [x, y + (p.hy - 56) * s] };
  }
  // 苗银头冠（工具包的银角近看像兔耳，近景时擦掉它，在头上另画一顶）：一对外翻的宽银角、冠沿一排银花、两侧垂下的银流苏与小铃。
  // pts 是 F.points 的结果（head、top 定出头的朝向），s 人物缩放，face 朝向
  function crownFrame(pts, s, sz) {
    const hx = pts.head[0], hy = pts.head[1], dx = pts.top[0] - hx, dy = pts.top[1] - hy, L = Math.hypot(dx, dy) || 1;
    return { ox: pts.top[0], oy: pts.top[1], ux: dx / L, uy: dy / L, k: s * (sz ?? 1) };
  }
  // 局部坐标 (x 朝脸前方, y 朝头顶为负) → 世界坐标
  const cfAt = (f, face, x, y) => [f.ox + (-f.uy * face * x - f.ux * y) * f.k, f.oy + (f.ux * face * x - f.uy * y) * f.k];
  function eraseHorns(q, pts, s, face) {
    const f = crownFrame(pts, s), P = (x, y) => cfAt(f, face, x, y);
    const op = q.globalCompositeOperation; q.globalCompositeOperation = 'destination-out';
    q.fillStyle = '#000'; q.beginPath(); q.moveTo(...P(-26, 1.2)); q.lineTo(...P(-26, -34)); q.lineTo(...P(26, -34)); q.lineTo(...P(26, 1.2)); q.closePath(); q.fill();
    q.globalCompositeOperation = op;
  }
  function miaoCrown(q, pts, s, t, face, o = {}) {
    const f = crownFrame(pts, s, o.size ?? 0.78), P = (x, y) => cfAt(f, face, x, y), lit = o.lit ?? 1;
    const SV = '#e4e8f0', SD = '#8a92a4', SE = '#5a6070';
    // 银角：宽，外沿弯出去、角尖朝天；里沿一道錾刻纹
    for (const sd of [-1, 1]) {
      const hn = new Path2D();
      const pts2 = [[sd * 2, 0.5], [sd * 11, -2], [sd * 19, -6.5], [sd * 24, -13], [sd * 23.5, -23], [sd * 20.5, -25.5], [sd * 19.5, -18], [sd * 14, -11.5], [sd * 7, -6.5], [sd * 1, -3.2]];
      pts2.forEach((p, i) => (i ? hn.lineTo(...P(p[0], p[1])) : hn.moveTo(...P(p[0], p[1]))));
      hn.closePath();
      const a = P(0, 0), b = P(sd * 22, -20);
      const gr = q.createLinearGradient(a[0], a[1], b[0], b[1]);
      gr.addColorStop(0, SD); gr.addColorStop(0.5, sd > 0 ? '#d0d6e2' : '#f4f6fa'); gr.addColorStop(1, '#7a8294');
      q.fillStyle = gr; q.fill(hn);
      q.strokeStyle = rgba(SE, 0.8); q.lineWidth = 0.5 * s; q.stroke(hn);
      q.beginPath(); [[sd * 5, -3], [sd * 11, -6.5], [sd * 16.5, -11.5], [sd * 20, -18.5]].forEach((p, i) => (i ? q.lineTo(...P(p[0], p[1])) : q.moveTo(...P(p[0], p[1])))); q.stroke();
    }
    // 冠沿：一道银箍，上面一排银花
    q.fillStyle = SV; q.beginPath(); [[-11, 2], [-11.5, -2.4], [11.5, -2.4], [11, 2]].forEach((p, i) => (i ? q.lineTo(...P(p[0], p[1])) : q.moveTo(...P(p[0], p[1])))); q.closePath(); q.fill();
    for (let i = 0; i < 6; i++) { const c = P(-9 + i * 3.6, -0.4); q.fillStyle = '#ffffff'; q.beginPath(); q.arc(c[0], c[1], 1.5 * s, 0, TAU); q.fill(); q.fillStyle = SE; q.beginPath(); q.arc(c[0], c[1], 0.55 * s, 0, TAU); q.fill(); }
    { const c = P(1.5, -3.8); q.fillStyle = '#c9314a'; q.beginPath(); q.arc(c[0], c[1], 1.4 * s, 0, TAU); q.fill(); }
    // 流苏：冠沿两侧垂下的银链，链尾小铃，随头摆
    const sw = Math.sin(t * 3.1) * 1.4;
    q.strokeStyle = rgba('#d8dce6', 0.9); q.lineWidth = 0.45 * s;
    for (let i = 0; i < 7; i++) {
      const x0 = -10 + i * 3.3, L = 6 + (i % 3) * 3 + (Math.abs(i - 3) < 2 ? -2 : 2), a = P(x0, 1.8), b = P(x0 + sw * (L / 10), 1.8 + L);
      q.beginPath(); q.moveTo(...a); q.lineTo(...b); q.stroke();
      q.fillStyle = i % 2 ? '#ffffff' : '#c8ccd8'; q.beginPath(); q.arc(b[0], b[1], (i % 2 ? 0.9 : 1.2) * s, 0, TAU); q.fill();
    }
    if (lit > 0) add(q, () => { const c = P(17, -12), d = P(-17, -12); glo(q, c[0], c[1], 7 * s, '#ffffff', 0.18 * lit); glo(q, d[0], d[1], 6 * s, '#ffffff', 0.12 * lit); });
  }
  // 复用的草稿缓冲：尺寸按 128 像素分档（同一尺寸的请求总拿到同一档，结果只取决于这一帧，不受之前画过多大的影响）
  const scrPool = new Map();
  function scratchCv(slot, w, h) {
    const BW = Math.max(128, Math.ceil(w / 128) * 128), BH = Math.max(128, Math.ceil(h / 128) * 128), key = slot + BW + 'x' + BH;
    let cv = scrPool.get(key);
    if (cv) { scrPool.delete(key); scrPool.set(key, cv); return cv; }
    cv = document.createElement('canvas'); cv.width = BW; cv.height = BH; scrPool.set(key, cv);
    if (scrPool.size > 8) { const [k0, c0] = scrPool.entries().next().value; scrPool.delete(k0); c0.width = c0.height = 1; }
    return cv;
  }
  // 整个人画进复用的全分辨率缓冲（每次清空），可以在缓冲里擦改（比如擦掉银角），再贴回
  // 缓冲在屏幕坐标里：连同镜头的转角一起画进去，再 1:1 不旋转地贴回（转着贴整块图很贵）
  function figBuf(g, box, draw) {
    const [bx0, by0, bw, bh] = box, m = g.getTransform();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[bx0, by0], [bx0 + bw, by0], [bx0, by0 + bh], [bx0 + bw, by0 + bh]]) { const px = m.a * x + m.c * y + m.e, py = m.b * x + m.d * y + m.f; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const cw = g.canvas.width, ch = g.canvas.height;
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(cw, Math.ceil(x1)); y1 = Math.min(ch, Math.ceil(y1));
    const pw = x1 - x0, ph = y1 - y0;
    if (pw <= 0 || ph <= 0) return;
    const figCv = scratchCv('fig', pw, ph);
    const q = figCv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, figCv.width, figCv.height);
    q.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
    draw(q);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(figCv, 0, 0, pw, ph, x0, y0, pw, ph); g.restore();
  }
  // 预先转好角、缩放好的贴图（镜头里固定的转角 rot、缩放 z 烘进去）：fn(q) 以锚点 (0,0) 为原点画，box 是锚点周围的范围
  function rotSprite(key, rot, z, box, fn) {
    const [a0, b0, a1, b1] = box, c = Math.cos(rot), sn = Math.sin(rot);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of [[a0, b0], [a1, b0], [a0, b1], [a1, b1]]) { const px = (x * c - y * sn) * z, py = (x * sn + y * c) * z; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const w = Math.ceil(x1 - x0), h = Math.ceil(y1 - y0);
    return { img: C('rs-' + key, w, h, 1, (q) => { q.translate(-x0, -y0); q.rotate(rot); q.scale(z, z); fn(q); }), ox: -x0, oy: -y0, w, h, z };
  }
  // 把预转贴图贴到世界坐标 (ax, ay)：按当前变换算出锚点的屏幕位置，只做平移和微小缩放
  function blitRot(g, sp, ax, ay) {
    const m = g.getTransform(), Sd = (XYT.sprites && XYT.sprites.S) || 1, k = Math.hypot(m.a, m.b) / Sd / sp.z;
    g.save(); g.setTransform(Sd * k, 0, 0, Sd * k, m.a * ax + m.c * ay + m.e, m.b * ax + m.d * ay + m.f); blit(g, sp.img, -sp.ox, -sp.oy, sp.w, sp.h); g.restore();
  }
  // 在屏幕坐标里裁掉右侧歌词栏（x ≥ xr 的部分不画），不受镜头转角影响；之后要 g.restore()
  function clipLeft(g, xr) { const m = g.getTransform(), Sd = (XYT.sprites && XYT.sprites.S) || 1; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(0, 0, xr * Sd, g.canvas.height); g.clip(); g.setTransform(m); }
  // 屏幕坐标里整屏铺一层色（不受镜头转角影响，便宜）
  function screenFill(g, col) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = col; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore(); }
  // 低分辨率草稿缓冲：每次用前清空，画完放大贴回（浪、水雾这类软边的大块头）
  function soft(g, res, rect, fn) {
    const [x0, y0, x1, y1] = rect;
    const m = g.getTransform(), k = res * Math.max(0.3, Math.hypot(m.a, m.b)), w = Math.ceil((x1 - x0) * k), h = Math.ceil((y1 - y0) * k);
    const scrCv = scratchCv('soft', w, h);
    const q = scrCv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, scrCv.width, scrCv.height);
    q.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    fn(q);
    g.drawImage(scrCv, 0, 0, w, h, x0, y0, w / k, h / k);
  }

  // 血月：泼墨月面（干笔的深浅红）、月食本影按 ec 0..1 推进；ec 越小剩下的亮边越宽
  function moonBrush() {
    return C('bm-moonbrush', 400, 400, 0.6, (q) => {
      q.beginPath(); q.arc(200, 200, 198, 0, TAU); q.clip();
      const r = A.rng(77);
      for (let k = 0; k < 16; k++) {
        const dark = k % 3 !== 0, br = tint(brushTex(1 + (k % 5)), dark ? '#3a0a12' : '#f08a62');
        q.globalAlpha = dark ? 0.16 + 0.14 * r() : 0.1 + 0.1 * r();
        putR(q, br, 60 + r() * 280, 40 + r() * 320, 180 + r() * 220, 26 + r() * 40, (r() - 0.5) * 0.6 - 0.2);
      }
      q.globalAlpha = 0.22;
      for (let k = 0; k < 4; k++) q.drawImage(tint(splashTex(40 + k), '#2a0610'), -60 + r() * 200, -40 + r() * 260, 300 + r() * 120, 180 + r() * 80);
      q.globalAlpha = 1;
    });
  }
  const moonBase = (r) => C('bm-moonbase' + r, r * 2.4, r * 2.4, 1, (q) => {
    const c = r * 1.2;
    E.moon(q, { x: c, y: c, r, color: '#b8443a', haze: '#6a1424', glow: 0, spread: 3.6 });
    q.save(); q.beginPath(); q.arc(c, c, r * 1.005, 0, TAU); q.clip();
    q.globalAlpha = 0.85; q.drawImage(moonBrush(), c - r, c - r, r * 2, r * 2); q.restore();
  });
  // 全食的月亮整张缓存（本影、亮边都在里面）
  const moonFull = (r) => C('bm-moonfull' + r, r * 2.4, r * 2.4, 1, (q) => moonDraw(q, r * 1.2, r * 1.2, r, 1));
  function bloodMoon(g, x, y, r, ec) {
    if (ec >= 0.999) { g.drawImage(moonFull(r), x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4); return; }
    moonDraw(g, x, y, r, ec);
  }
  function moonDraw(g, x, y, r, ec) {
    g.drawImage(moonBase(r), x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
    g.save();
    g.beginPath(); g.arc(x, y, r * 1.005, 0, TAU); g.clip();
    const d = lerp(1.35, 0.5, clamp(ec)), ux = x + r * 0.62 * d, uy = y - r * 0.74 * d;
    const gr = g.createRadialGradient(ux, uy, r * 0.2, ux, uy, r * 1.55);
    gr.addColorStop(0, 'rgba(18,2,6,0.86)'); gr.addColorStop(0.55, 'rgba(36,5,10,0.55)'); gr.addColorStop(1, 'rgba(60,10,16,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    // 还没被吞的那一边：一弯铜亮
    const lit = 1 - clamp(ec);
    if (lit > 0.01) add(g, () => { const lx = x - r * 0.7, ly = y + r * 0.62; glo(g, lx, ly, r * (0.7 + 0.6 * lit), '#ffa070', 0.5 * lit); });
    g.restore();
    add(g, () => {
      g.strokeStyle = rgba('#ffb07a', 0.3 + 0.3 * lit); g.lineWidth = Math.max(1.5, r * 0.03);
      g.beginPath(); g.arc(x, y, r * 0.975, PI * 0.5, PI * (1.08 + 0.3 * lit)); g.stroke();
    });
  }
  // 掠过月面的乌云：两块拉长的泼墨，x 偏移由调用方给
  function moonClouds(g, x, y, r, off, a) {
    for (const [dx, dy, w, h, sd, al] of [[-1.2, 0.25, 3.2, 0.5, 51, 0.8], [0.6, -0.35, 2.6, 0.38, 53, 0.6], [2.3, 0.05, 2.8, 0.42, 55, 0.7]]) {
      const cw = w * r, px = x + ((dx * r + off + 6 * r) % (8 * r)) - 4 * r;
      g.globalAlpha = a * al; g.drawImage(tint(splashTex(sd), '#1a0e16'), px - cw / 2, y + dy * r - h * r / 2, cw, h * r);
    }
    g.globalAlpha = 1;
  }
  // 喀斯特峰林、湖心石台、崖台
  function islandTex() {
    return C('bm-island', 760, 150, 0.75, (q) => {
      const r = A.rng(331), topY = (u) => 26 + 40 * Math.pow(Math.abs(u - 0.5) * 2, 2.2) + (noise1(u * 14, 7) - 0.5) * 18;
      q.fillStyle = K.lin(q, 0, 0, 0, 150, [[0, '#241c2a'], [0.4, '#110c14'], [1, '#050407']]);
      q.beginPath(); q.moveTo(0, 150);
      for (let i = 0; i <= 30; i++) q.lineTo((i / 30) * 760, topY(i / 30));
      q.lineTo(760, 150); q.closePath(); q.fill();
      for (let k = 0; k < 40; k++) {
        const x = 40 + r() * 680, y = 40 + r() * 90, L = 14 + r() * 40;
        q.strokeStyle = rgba(r() < 0.5 ? '#3a2c3a' : '#030204', 0.5 + r() * 0.4); q.lineWidth = 1 + r() * 2.2;
        q.beginPath(); q.moveTo(x, y); q.lineTo(x - L * 0.3, y + L); q.stroke();
      }
      q.strokeStyle = rgba('#a890e0', 0.4); q.lineWidth = 2;
      q.beginPath(); for (let i = 4; i <= 26; i++) { const u = i / 30; i === 4 ? q.moveTo(u * 760, topY(u)) : q.lineTo(u * 760, topY(u)); } q.stroke();
    });
  }
  function cliffTex(key, w, h, o) {
    return C('cliff-' + key, w, h, o.sc || 0.6, (q) => {
      const r = A.rng(o.seed);
      const topAt = (u) => h * o.top + (noise1(u * 6, o.seed) - 0.5) * h * 0.09 + Math.pow(Math.max(0, u - o.drop), 1.6) * h * 3.2;
      const outline = () => { q.beginPath(); q.moveTo(-4, h + 4); for (let i = 0; i <= 48; i++) { const u = i / 48; q.lineTo(u * w, topAt(u)); } q.lineTo(w, h + 4); q.closePath(); };
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, o.c0 || '#221a26'], [0.35, '#0e0a10'], [1, '#030204']]);
      outline(); q.fill();
      q.save(); outline(); q.clip();
      for (let k = 0; k < 9; k++) {
        const dy = 18 + k * h * 0.08 + r() * 10;
        q.strokeStyle = rgba(k % 2 ? '#2e2434' : '#000000', 0.45); q.lineWidth = 1.2 + r() * 2.5;
        q.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24; const y = topAt(Math.min(u, o.drop)) + dy + (noise1(u * 9 + k, o.seed + 3) - 0.5) * 8; i ? q.lineTo(u * w, y) : q.moveTo(0, y); } q.stroke();
      }
      const br = brushTex(o.seed % 5 + 1);
      for (let k = 0; k < 22; k++) {
        const u = r(), x = u * w, y = topAt(u) + 20 + r() * h * 0.45;
        q.globalAlpha = 0.16 + r() * 0.22;
        putR(q, tint(br, r() < 0.45 ? (o.c1 || '#3e3044') : '#000000'), x, y, 30 + r() * 46, 12 + r() * 14, PI / 2 + 0.2 + (r() - 0.5) * 0.3);
      }
      q.globalAlpha = 1;
      q.restore();
      q.strokeStyle = rgba(o.rim || RIM_V, 0.55); q.lineWidth = 2.4;
      q.beginPath(); for (let i = 0; i <= 48; i++) { const u = i / 48; i ? q.lineTo(u * w, topAt(u) + 1) : q.moveTo(0, topAt(0) + 1); } q.stroke();
      q.strokeStyle = '#08060a'; q.lineWidth = 1.2;
      for (let k = 0; k < 70; k++) { const u = r() * o.drop, x = u * w, y = topAt(u) + 2; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + 3, y - 6, x + 5 + r() * 7, y - 7 - r() * 11); q.stroke(); }
      if (o.pine) E.util.inkPine(q, o.pine[0], topAt(o.pine[0] / w) + 4, o.pine[1], o.pine[2], o.seed + 5, '#07050a', rgba(o.rim || RIM_V, 0.5));
    });
  }
  // 图腾柱：刻着弯月、兽面（双眼、獠牙）、涡纹、菱纹；lines 是刻痕的白版（亮起时着色叠加）
  function totemTex(seed, w, h) {
    const mk = (lines) => C('totem2-' + seed + (lines ? 'L' : 'B'), w + 90, h + 110, 1, (q) => {
      const cx = (w + 90) / 2, y0 = 110;
      if (!lines) {
        q.fillStyle = K.lin(q, cx - w / 2, 0, cx + w / 2, 0, [[0, '#4a3a50'], [0.35, '#221a28'], [1, '#07060a']]);
        q.fillRect(cx - w / 2, y0, w, h);
        // 石面的干笔
        const br = tint(brushTex(seed % 5 + 1), '#000000');
        for (let k = 0; k < 6; k++) { q.globalAlpha = 0.25; putR(q, br, cx + (h2(k, seed) - 0.5) * w * 0.5, y0 + 40 + h2(k, seed + 1) * (h - 80), 120, w * 0.5, PI / 2); }
        q.globalAlpha = 1;
        q.strokeStyle = '#18121c'; q.lineWidth = w * 0.24; q.lineCap = 'round';
        for (const sd of [-1, 1]) { q.beginPath(); q.moveTo(cx + sd * w * 0.35, y0 + 6); q.quadraticCurveTo(cx + sd * w * 1.3, y0 - 6, cx + sd * w * 1.05, y0 - w * 1.05); q.stroke(); }
      }
      // 柱顶弯月
      q.fillStyle = lines ? '#ffffff' : '#2a2230';
      q.beginPath(); q.arc(cx, y0 - w * 0.7, w * 0.5, PI * 0.15, PI * 1.85); q.arc(cx + w * 0.22, y0 - w * 0.7, w * 0.42, PI * 1.75, PI * 0.25, true); q.fill();
      const seg = w * 2.1, n = Math.floor((h - 30) / seg);
      q.strokeStyle = lines ? '#ffffff' : 'rgba(0,0,0,0.8)'; q.fillStyle = q.strokeStyle; q.lineWidth = Math.max(2, w * 0.075); q.lineCap = 'round'; q.lineJoin = 'round';
      for (let k = 0; k < n; k++) {
        const sy = y0 + 18 + k * seg, cy = sy + seg / 2, kind = (k + seed) % 4, hw = w * 0.4;
        q.beginPath();
        if (kind === 0) {
          // 弯月：一弯月牙托一颗珠
          q.arc(cx, cy, hw * 0.8, PI * 0.2, PI * 1.25); q.arc(cx + hw * 0.32, cy - hw * 0.05, hw * 0.62, PI * 1.2, PI * 0.25, true); q.closePath(); q.fill();
          q.beginPath(); q.arc(cx + hw * 0.35, cy - hw * 0.1, hw * 0.16, 0, TAU); q.fill();
          q.beginPath();
        } else if (kind === 1) {
          // 兽面：眉弓、一对杏眼、鼻、两枚獠牙
          q.moveTo(cx - hw, cy - seg * 0.26); q.quadraticCurveTo(cx - hw * 0.5, cy - seg * 0.36, cx, cy - seg * 0.22); q.quadraticCurveTo(cx + hw * 0.5, cy - seg * 0.36, cx + hw, cy - seg * 0.26);
          for (const sd of [-1, 1]) { q.moveTo(cx + sd * hw * 0.85, cy - seg * 0.12); q.quadraticCurveTo(cx + sd * hw * 0.5, cy - seg * 0.24, cx + sd * hw * 0.15, cy - seg * 0.1); q.quadraticCurveTo(cx + sd * hw * 0.5, cy - seg * 0.02, cx + sd * hw * 0.85, cy - seg * 0.12); }
          q.moveTo(cx - hw * 0.2, cy + seg * 0.08); q.quadraticCurveTo(cx, cy + seg * 0.16, cx + hw * 0.2, cy + seg * 0.08);
          q.moveTo(cx - hw * 0.8, cy + seg * 0.22); q.quadraticCurveTo(cx, cy + seg * 0.3, cx + hw * 0.8, cy + seg * 0.22);
          q.stroke();
          q.beginPath(); for (const sd of [-1, 1]) { q.moveTo(cx + sd * hw * 0.5, cy + seg * 0.24); q.lineTo(cx + sd * hw * 0.38, cy + seg * 0.42); q.lineTo(cx + sd * hw * 0.26, cy + seg * 0.25); } q.fill();
          for (const sd of [-1, 1]) { q.beginPath(); q.arc(cx + sd * hw * 0.5, cy - seg * 0.12, hw * 0.1, 0, TAU); q.fill(); }
          q.beginPath();
        } else if (kind === 2) {
          // 涡纹：一对相向的旋
          for (const sd of [-1, 1]) { const ox = cx + sd * hw * 0.45; for (let i = 0; i <= 26; i++) { const a = i * 0.42, rr = hw * 0.5 * (1 - i / 30); const px = ox + Math.cos(a * sd) * rr, py = cy + Math.sin(a * sd) * rr; i ? q.lineTo(px, py) : q.moveTo(px, py); } }
        } else {
          // 菱纹带
          for (let j = -2; j <= 2; j++) { const px = cx + j * hw * 0.42; q.moveTo(px, cy - seg * 0.2); q.lineTo(px + hw * 0.2, cy); q.lineTo(px, cy + seg * 0.2); q.lineTo(px - hw * 0.2, cy); q.closePath(); }
        }
        q.stroke();
        q.beginPath(); q.moveTo(cx - w / 2 + 2, sy); q.lineTo(cx + w / 2 - 2, sy); q.stroke();
      }
    });
    return { base: mk(false), lines: mk(true), w: w + 90, h: h + 110 };
  }
  // 泼墨巨浪（画进低分辨率缓冲）：浪背从 x0 涌到浪头 x1，浪头卷成闭合的浪舌（舌里填深水，不透底）；
  // 浪面几道顺势的水纹线，浪唇垂下一排浪爪，只在浪头一小段有一笔飞白浪沫，浪舌抛出十几点飞沫。h 浪高，r 卷的大小
  function inkWave(q, t, o) {
    const dir = o.x1 > o.x0 ? 1 : -1, L = Math.abs(o.x1 - o.x0), Hh = o.h, R = o.r ?? Math.min(110, Hh * 0.28), seed = o.seed || 1, al = o.alpha ?? 1;
    if (Hh < 6) return null;
    q.save(); q.translate(o.x0, o.base); q.scale(dir, 1);
    const n = 26, crest = [];
    const prof = (u, k) => (0.1 + 0.9 * Math.pow(u, 1.25)) * (0.94 + 0.12 * noise1(u * 4 - t * 0.5 + k, seed)) + 0.02 * Math.sin(u * 15 - t * 2.4 + seed + k);
    for (let i = 0; i <= n; i++) { const u = i / n; crest.push([u * L, -Hh * prof(u, 0)]); }
    const tip = crest[n], cx = tip[0] + R * 0.3, cy = tip[1] + R * 0.95, hook = [];
    for (let k = 0; k <= 14; k++) {
      const a = -PI / 2 - 0.3 + (k / 14) * PI * 1.32, rr = R * (1 - 0.42 * k / 14);
      hook.push([cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr]);
    }
    const he = hook[14];
    const body = () => {
      q.beginPath(); q.moveTo(-60, 90);
      crest.forEach((p) => q.lineTo(p[0], p[1]));
      hook.forEach((p) => q.lineTo(p[0], p[1]));
      // 浪舌折回浪面：把卷里的空洞封住
      q.quadraticCurveTo(he[0] - R * 0.5, he[1] - R * 0.1, tip[0] - R * 0.5, tip[1] + R * 1.3);
      q.bezierCurveTo(tip[0] - R * 0.1, tip[1] + R * 2.3, tip[0] + R * 0.7, -R * 0.2, tip[0] + R * 2.0, 90);
      q.closePath();
    };
    q.globalAlpha = al;
    q.fillStyle = K.lin(q, 0, -Hh, 0, 40, [[0, o.face || '#2c1420'], [0.12, o.mid || '#160a12'], [0.45, o.body || '#0c080e'], [1, '#040306']]);
    body(); q.fill();
    q.save(); body(); q.clip();
    // 浪舌里更深；浪唇薄处被身后的月光透成暗红
    { const tg = q.createRadialGradient(cx - R * 0.2, cy + R * 0.25, R * 0.05, cx - R * 0.2, cy + R * 0.25, R * 1.1); tg.addColorStop(0, 'rgba(2,1,4,0.92)'); tg.addColorStop(1, 'rgba(10,7,12,0)'); q.fillStyle = tg; q.fillRect(cx - R * 1.5, cy - R * 1.2, R * 3, R * 2.7); }
    q.lineJoin = 'round'; q.lineCap = 'round';
    q.strokeStyle = rgba(o.lip || '#8a2a3a', 0.3); q.lineWidth = R * 0.45;
    q.beginPath(); crest.slice(Math.floor(n * 0.7)).forEach((p, i) => (i ? q.lineTo(p[0], p[1] + R * 0.22) : q.moveTo(p[0], p[1] + R * 0.22))); hook.slice(0, 6).forEach((p) => q.lineTo(p[0] - R * 0.08, p[1] + R * 0.16)); q.stroke();
    // 浪面水纹：几道顺着浪势、由浪脚扫向浪舌的长线，越靠前越亮
    for (let k = 1; k <= 4; k++) {
      const f = k / 5, sh = Hh * f * 0.75;
      q.globalAlpha = al * (0.5 - f * 0.3); q.strokeStyle = o.flow || '#7a2a3a'; q.lineWidth = 1.2 + 2.4 * (1 - f);
      q.beginPath();
      for (let i = Math.floor(n * (0.15 + f * 0.3)); i <= n; i++) { const u = i / n, x = u * L - f * R * 0.8, y = -Hh * prof(u, k * 0.7) * (1 - f * 0.55) + sh * 0.1 + Math.sin(u * 9 + t * 1.8 + k) * 3; i === Math.floor(n * (0.15 + f * 0.3)) ? q.moveTo(x, y) : q.lineTo(x, y); }
      q.stroke();
    }
    q.restore();
    // 浪唇的白沫：顺着浪尖到浪舌外沿一整笔飞白（浪尖处最宽，往卷里收细）——一层淡沫托底，上面九道长短不一的干笔丝
    { const fp = crest.slice(n - 7).concat(hook.slice(1, 12)), m = fp.length, foam = o.foam || '#efd6d8', wmax = o.foamW ?? Math.max(5, R * 0.26);
      const nrm = fp.map((p, i) => { const pa = fp[Math.max(0, i - 1)], pb = fp[Math.min(m - 1, i + 1)], dx = pb[0] - pa[0], dy = pb[1] - pa[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
      const wid = fp.map((p, i) => { const v = i / (m - 1); return wmax * Math.pow(Math.sin(PI * Math.min(1, v * 1.25 + 0.04)), 0.8) * (v < 0.8 ? 1 : 1 - (v - 0.8) * 3) * (0.75 + 0.25 * noise1(i * 0.8 + t * 0.6, seed + 5)); });
      const at = (i, f) => [fp[i][0] + nrm[i][0] * wid[i] * f, fp[i][1] + nrm[i][1] * wid[i] * f];
      q.globalAlpha = al * 0.32; q.fillStyle = foam;
      q.beginPath(); for (let i = 0; i < m; i++) { const p = at(i, 1); i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]); } for (let i = m - 1; i >= 0; i--) { const p = at(i, -0.6); q.lineTo(p[0], p[1]); } q.closePath(); q.fill();
      q.strokeStyle = foam; q.lineCap = 'round'; q.lineJoin = 'round';
      for (let k = 0; k < 9; k++) {
        const f = -0.55 + 1.45 * (k / 8) + 0.08 * (h2(k, seed + 7) - 0.5), i0 = Math.floor(h2(k, seed + 11) * 3), i1 = m - 1 - Math.floor(h2(k, seed + 12) * 5);
        q.globalAlpha = al * (0.35 + 0.45 * h2(k, seed + 8)); q.lineWidth = Math.max(0.8, R * (0.012 + 0.03 * h2(k, seed + 9)));
        q.setLineDash([R * (0.25 + 0.7 * h2(k, seed + 10)), R * (0.03 + 0.1 * h2(k, seed + 13))]); q.lineDashOffset = -t * 30 * (1 + k * 0.1);
        q.beginPath(); for (let i = i0; i <= i1; i++) { const p = at(i, f); i > i0 ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]); } q.stroke();
      }
      q.setLineDash([]); }
    // 飞沫：从浪舌抛向前上方、落下
    q.globalCompositeOperation = 'lighter';
    for (let i = 0; i < (o.nSpray ?? 20); i++) {
      const P = 0.6 + 0.4 * h2(i, seed + 12), ph = (t / P + h2(i, seed + 13)) % 1, src = hook[Math.floor(h2(i, seed + 17) * 8)];
      const vx = 50 + 100 * h2(i, seed + 14), vy = 80 + 110 * h2(i, seed + 15), tt = ph * P;
      const px = src[0] + vx * tt, py = src[1] - vy * tt + 280 * tt * tt;
      glo(q, px, py, 3 + 6 * h2(i, seed + 16), '#f4c8c8', al * 0.5 * (1 - ph));
    }
    q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
    q.restore();
    const wx = (p) => [o.x0 + dir * p[0], o.base + p[1]];
    return { tip: wx(tip), curl: wx([cx, cy]), lip: wx(hook[6]) };
  }
  // 浪的包围盒（含浪舌与飞沫），给低分辨率缓冲用
  function waveRect(o) {
    const R2 = o.r ?? Math.min(110, o.h * 0.28), top = o.base - o.h - R2 - 90, bot = o.base + 95;
    return o.x1 > o.x0 ? [o.x0 - 70, top, o.x1 + R2 * 2.6 + 150, bot] : [o.x1 - R2 * 2.6 - 150, top, o.x0 + 70, bot];
  }
  // 化灰：draw(q) 先画进复用缓冲（每次清空），自上而下按噪声边擦掉，擦口烧成金红，再贴回；返回擦口的 y
  function ashDraw(g, box, t, prog, seed, draw) {
    const [bx0, by0, bw, bh] = box;
    const m = g.getTransform(), S = Math.max(0.5, Math.hypot(m.a, m.b));
    const pw = Math.ceil(bw * S) + 2, ph = Math.ceil(bh * S) + 2;
    const ashCv = scratchCv('ash', pw, ph);
    const q = ashCv.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over';
    q.clearRect(0, 0, ashCv.width, ashCv.height);
    q.setTransform(S, 0, 0, S, -bx0 * S, -by0 * S);
    draw(q);
    const fy = lerp(by0 + bh * 0.05, by0 + bh * 1.02, clamp(prog)), J = bh * 0.06;
    if (prog > 0) {
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = '#000';
      q.beginPath(); q.moveTo(bx0 - 4, by0 - 4);
      for (let i = 0; i <= 28; i++) { const xx = bx0 + (bw * i) / 28; q.lineTo(xx, fy + (noise1(i * 0.7 + t * 1.3, seed) - 0.5) * 2 * J); }
      q.lineTo(bx0 + bw + 4, by0 - 4); q.closePath(); q.fill();
      const gr = q.createLinearGradient(0, fy - J * 0.6, 0, fy + J * 2.5);
      gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.fillRect(bx0, fy - J * 0.6, bw, J * 3.1);
      q.globalCompositeOperation = 'source-atop';
      const g2 = q.createLinearGradient(0, fy, 0, fy + J * 3);
      g2.addColorStop(0, 'rgba(255,214,140,1)'); g2.addColorStop(0.4, 'rgba(255,140,70,0.8)'); g2.addColorStop(1, 'rgba(255,120,60,0)');
      q.fillStyle = g2; q.fillRect(bx0, fy - J, bw, J * 4);
    }
    g.drawImage(ashCv, 0, 0, pw, ph, bx0, by0, pw / S, ph / S);
    return fy;
  }
  // 飞灰：擦口经过时从身上剥离，先是火星，后成灰片，随风飘向 (tx, ty)；按颜色分桶，每桶一次填充
  function ashFlakes(g, t, o) {
    const n = o.n || 200, seed = o.seed || 7, s = o.s, tx = o.tx ?? o.x + 400, ty = o.ty ?? o.top - 200;
    const ang = Math.atan2(ty - o.top, tx - o.x), ca = Math.cos(ang), sa = Math.sin(ang);
    const NB = 4, paths = [], alph = [0, 0, 0, 0], glows = [];
    for (let k = 0; k < NB * 2; k++) paths.push(new Path2D());
    for (let i = 0; i < n; i++) {
      const u = h2(i, seed), sx = o.x + (h2(i, seed + 1) - 0.5) * (40 + 120 * Math.sin(u * PI)) * s;
      const sy = o.top + (o.bot - o.top) * u, ts = o.t0 + u * o.dur, age = t - ts, life = 1.4 + 1.8 * h2(i, seed + 2);
      if (age < 0 || age > life) continue;
      const q = age / life, w1 = h2(i, seed + 3), sp = (60 + 120 * w1) * s;
      const d = age * sp + age * age * 40 * s, wob = Math.sin(age * 3 + i) * 12 * s;
      const px = sx + ca * d - sa * wob, py = sy + sa * d + ca * wob - age * 30 * s;
      const ember = h2(i, seed + 6) < 0.3, sz = (1.2 + 3.4 * Math.pow(h2(i, seed + 5), 2)) * s * (1 - q * 0.4), hot = ember ? 1 - smooth(age / 1.5) : 0.6 * (1 - smooth(age / 0.3));
      if (hot > 0.02 && ember) glows.push([px, py, sz * 3, 0.45 * hot]);
      const bk = (ember ? NB : 0) + Math.min(NB - 1, Math.floor(hot * NB)), P = paths[bk];
      const rot = age * (3 + 4 * w1) + i, cr = Math.cos(rot), sr = Math.sin(rot), fl = 0.4 + 0.6 * Math.abs(Math.cos(age * 5 + i));
      const pt = (x, y) => [px + (x * cr - y * fl * sr), py + (x * sr + y * fl * cr)];
      P.moveTo(...pt(-sz, -sz * 0.4)); P.lineTo(...pt(sz * 0.6, -sz * 0.7)); P.lineTo(...pt(sz, sz * 0.3)); P.lineTo(...pt(-sz * 0.4, sz * 0.6)); P.closePath();
    }
    const p0 = g.globalAlpha;
    for (let k = 0; k < NB * 2; k++) {
      const ember = k >= NB, hot = ((k % NB) + 0.5) / NB;
      g.globalAlpha = p0 * 0.85; g.fillStyle = mix(ember ? '#3a2018' : '#1c1416', ember ? '#ffd08a' : '#c88a5a', hot); g.fill(paths[k]);
    }
    g.globalAlpha = p0;
    if (glows.length) add(g, () => { for (const [x, y, r, a] of glows) glo(g, x, y, r, '#ff9a4a', a); });
  }
  // 地脉金光：沿折线推进到 prog，走过的路一直亮着、微微脉动，头上一团亮光，沿途迸出细细的裂纹
  function goldVein(g, t, path, prog, a0) {
    if (prog <= 0) return;
    const L = [0];
    for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const tot = L[L.length - 1], cur = tot * prog;
    const at = (d) => { for (let i = 1; i < path.length; i++) if (d <= L[i]) { const u = (d - L[i - 1]) / (L[i] - L[i - 1]); return [lerp(path[i - 1][0], path[i][0], u), lerp(path[i - 1][1], path[i][1], u)]; } return path[path.length - 1]; };
    add(g, () => {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [lw, al, col] of [[14, 0.16, '#ffb84a'], [4.5, 0.5, '#ffd27a'], [1.8, 0.95, '#fff6d8']]) {
        g.strokeStyle = rgba(col, al * a0 * (0.85 + 0.15 * Math.sin(t * 9))); g.lineWidth = lw;
        g.beginPath();
        for (let d = 0; d <= cur; d += 10) { const [x, y] = at(d); const j = (noise1(d * 0.05, 3) - 0.5) * 6; d === 0 ? g.moveTo(x, y + j) : g.lineTo(x, y + j); }
        g.stroke();
      }
      g.strokeStyle = rgba('#ffd27a', 0.55 * a0); g.lineWidth = 1;
      g.beginPath();
      for (let k = 0; k < 26; k++) {
        const d = h2(k, 71) * tot; if (d > cur) continue;
        const [x, y] = at(d), an = (h2(k, 72) - 0.5) * 2.4 + (h2(k, 73) < 0.5 ? PI : 0), len = 10 + 30 * h2(k, 74);
        g.moveTo(x, y); g.lineTo(x + Math.cos(an) * len * 0.6, y + Math.sin(an) * len * 0.3 + 3); g.lineTo(x + Math.cos(an + 0.4) * len, y + Math.sin(an + 0.4) * len * 0.35);
      }
      g.stroke();
      if (prog < 1) { const [x, y] = at(cur); glo(g, x, y, 70, '#ffcf6a', 0.75); glo(g, x, y, 14, '#ffffff', 0.95); }
    });
  }
  // 崖上两人：阿奴与唐钰跪地相对，合捧吊坠
  function cliffPair(g, t, x, y, s, o = {}) {
    const gap = 50 * s, px = x + gap / 2, py = y - 70 * s;
    const SA = s * F.height('anu') / 180, SB = s * F.height('tangyu') / 180;
    const hold = (fx, f, SS, dy) => [((px - fx) * f) / SS, (py - y) / SS + dy];
    const b0 = { pose: 'kneel', cradle: true, wind: 0.7, rim: o.rim || '#ffd27a', light: o.light || [px, py], rimAlpha: o.rimA ?? 0.9, rimWidth: o.rimW, alpha: o.alpha ?? 1, head: o.head };
    if (o.silhouette) Object.assign(b0, { tone: 'silhouette', ink: '#0a080c' });
    F.draw(g, 'tangyu', x + gap, y, s, t, Object.assign({}, b0, { facing: -1, holdN: hold(x + gap, -1, SB, 3), holdF: hold(x + gap, -1, SB, 7) }));
    F.draw(g, 'anu', x, y, s, t, Object.assign({}, b0, { facing: 1, holdN: hold(x, 1, SA, 1), holdF: hold(x, 1, SA, 5) }));
    E.pendant(g, { x: px, y: py - 34 * s, s: s * 0.5, t, glow: 0, swing: 0.05, color: '#9fd0b8' });
    return [px, py - 6 * s];
  }
  // 血月湖景底版：天、乌云、月晕、峰林、湖与倒影（月本身、石台另画）
  function bmPlate(key, o) {
    return plate(key, o.sc ?? 1, (q) => {
      const t = 3, hz = o.hz;
      base(q, '#07060a');
      E.sky(q, { y0: -PM, y1: hz + 4, stops: [[0, '#040307'], [0.45, '#0e0a16'], [0.8, '#22141e'], [1, '#3a1a22']] });
      add(q, () => { glo(q, o.mx, o.my, o.mr * 3.6, '#5a0e1a', 0.55); glo(q, o.mx, o.my, o.mr * 1.7, '#9a2a2a', 0.3); glo(q, o.mx, hz, 560, '#4a1422', 0.3); });
      inkClouds(q, o.clouds);
      // 天角的泼墨
      q.globalAlpha = 0.7; q.drawImage(tint(splashTex(61), '#030204'), -PM - 80, -PM - 60, 760, 420); q.drawImage(tint(splashTex(62), '#030204'), W - 560 + PM, -PM - 40, 700, 380); q.globalAlpha = 1;
      const ridges = (r) => {
        inkRidge(r, { y: hz, h: 170, seed: o.seed, w: 46, karst: true, col: '#1e1520', fog: '#2e1c26', rim: '#a890e0', rimA: 0.3, tex: '#3a2a38', lightDir: o.mx > 640 ? 1 : -1 });
        inkRidge(r, { y: hz + 2, h: 95, seed: o.seed + 7, w: 40, karst: true, col: '#0b080e', fog: '#1c1018', rim: '#c05048', rimA: 0.4, tex: '#2a1e2a', lightDir: o.mx > 640 ? 1 : -1 });
      };
      ridges(q);
      E.mist(q, { t, y: hz - 8, h: 64, color: '#3a2434', alpha: 0.55, speed: 0, seed: 3 });
      const back = (r) => {
        add(r, () => glo(r, o.mx, o.my, o.mr * 1.6, '#b0302a', 0.45));
        ridges(r);
        if (o.ax) {
          r.drawImage(islandTex(), o.ax - 380 * o.is, o.ay - 24 * o.is, 760 * o.is, 150 * o.is);
          E.altar(r, { x: o.ax, y: o.ay, s: o.as, t, moon: false, stone: '#2a2432', paint: '#5a1a22', rim: '#c8b8f0', fire: '#ff5a2a', haze: false, embers: 0, wind: 0.3, banner: '#26101e' });
        }
      };
      E.water(q, { y: hz, t, top: '#2a1a2a', bottom: '#050408', reflectFn: back, reflect: 0.5, wobble: 2.2, glint: { x: o.mx, color: '#ff7a5a', w: o.mr * 0.3, a: o.glintA ?? 0.3 }, lineColor: '#d8806a', lineA: 0.08, lines: 22, mist: '#4a2a3a' });
      vignette(q, 0.6, '#030204', PM);
    });
  }
  // 湖心石台与祭坛（边缘清楚，单独缓存一块；sc 推近时用更高分辨率）
  function bmAltar(g, key, o, sc) {
    const w = 860 * o.as + 120, h = 560 * o.as + 60;
    putLayer(g, 'bm-altar-' + key, o.ax - w / 2, o.ay - 540 * o.as - 20, w, h, sc || 1, (q) => {
      q.drawImage(islandTex(), o.ax - 380 * o.is, o.ay - 24 * o.is, 760 * o.is, 150 * o.is);
      E.altar(q, { x: o.ax, y: o.ay, s: o.as, t: 3, moon: false, stone: '#2a2432', paint: '#5a1a22', rim: '#c8b8f0', fire: '#ff5a2a', haze: '#3a2a4e', embers: 0, wind: 0.3, banner: '#26101e' });
    });
  }
  // 祭坛火盆的火光闪动
  function braziers(g, t, ax, ay, as, a) {
    add(g, () => { for (const sd of [-1, 1]) { const f = 0.6 + 0.4 * noise1(t * 7 + sd * 5, 4); glo(g, ax + sd * 150 * as, ay - 214 * as, 46 * as * (0.8 + 0.4 * f), '#ff7a3a', (a ?? 1) * 0.5 * f); } });
  }
  // 祭坛四根图腾柱顶的弯月（世界坐标）
  const capsOf = (o) => [[-345, -415], [345, -415], [-215, -420], [215, -420]].map(([dx, dy]) => [o.ax + dx * o.as, o.ay + dy * o.as]);

  XYT.registerShot('c2_bloodmoon', {
    name: '血月拜月', zone: 'top', night: true, text: '#e9f1f6', shadow: 'rgba(12,4,10,0.92)', accent: '#f2cf72', bloom: 0.35,
    draw(g, c) {
      const T = (k) => chT(c, k, BM_T);
      if (c.lt < T(4)) bmPanel1(g, c, T);
      else if (c.lt < T(8)) bmPanel2(g, c, T);
      else if (c.lt < T(9)) bmPanel3a(g, c, T);
      else bmPanel3(g, c, T);
    },
  });

  // ① 笑叹词穷：远景，湖心祭坛、血月，拜月背影；每个字月食推进一格、一根图腾柱顶的弯月点亮、乌云扫过月面快一截、他的双臂举高一截；
  // “穷”字一道闪电照亮他和月亮。左下崖上两个小人影捧坠跪着
  const BM1 = { hz: 470, mx: 770, my: 334, mr: 112, seed: 7, ax: 770, ay: 612, as: 0.55, is: 0.95, clouds: [[140, 150, 900, 520, 3, 0.9], [1220, 130, 820, 480, 5, 0.85], [560, 40, 900, 360, 8, 0.7]] };
  function bmPanel1(g, c, T) {
    const t = c.t, lt = c.lt, o = BM1, ks = [T(0), T(1), T(2), T(3)];
    const p = clamp(lt / Math.max(0.5, T(4)));
    let step = 0, surge = 0;
    for (let k = 0; k < 4; k++) { const e = easeOut(clamp((lt - ks[k]) / 0.3)); step += e; surge += 70 * easeOut(clamp((lt - ks[k]) / 0.6)); }
    cam(g, c, { z: 1.0 + 0.05 * p, cx: 770, cy: 430, amp: 2, kick: 4 * kickOf(lt, [T(3)], 0.2) });
    putPlate(g, bmPlate('bm1', o));
    bloodMoon(g, o.mx, o.my, o.mr, 0.25 + 0.75 * step / 4);
    moonClouds(g, o.mx, o.my + 10, o.mr, 24 * lt + surge, 0.75);
    const lv = bolt(g, c, { at: [0.02, T(3) + 0.02], xs: [1040, 230], x: 1040, y0: -60, y1: o.hz + 4, drift: -170, color: BOLT_V, flash: 0.75, seed: 33, width: 1.2, life: 0.4 });
    glints(g, t, o.mx, o.hz + 4, 600, o.mr * 0.3, '#ff8a6a', 0.55, 5);
    // 湖面雨点
    V.ripples(g, c, { rain: 7, area: [80, o.hz + 20, 1200, 700], r: 26, life: 1.2, flat: 0.22, color: '#d8a0b0', alpha: 0.35, seed: 19 });
    bmAltar(g, 'a', o);
    braziers(g, t, o.ax, o.ay, o.as);
    // 图腾柱顶的弯月：一个字点亮一根
    const caps = capsOf(o);
    add(g, () => caps.forEach(([x, y], k) => { const on = ramp(lt, ks[k], ks[k] + 0.12), fl = on * (0.8 + 0.2 * noise1(t * 6 + k, 2)); if (fl > 0) { glo(g, x, y, 34, '#c8a0ff', 0.55 * fl * (1 + 0.8 * Math.exp(-(lt - ks[k]) / 0.25))); glo(g, x, y, 7, '#ffffff', 0.8 * fl); } }));
    const by = o.ay - 168 * o.as, arms = 0.15 + 0.85 * step / 4;
    baiyueBack(g, o.ax, by, 0.68, t, { arms, laugh: 0, wind: 0.8, rim: mix(RIM_V, '#ffffff', lv * 0.6), rimA: 0.75 + 0.25 * lv, fx: 0.6 + 0.6 * lv });
    add(g, () => glo(g, o.ax, by - 80, 140, '#9a6aff', 0.08 + 0.3 * lv));
    E.mist(g, { t, y: o.ay + 12, h: 56, color: '#3a2638', alpha: 0.55, speed: 10, seed: 5 });
    V.embers(g, c, { n: 30, x0: o.ax - 120, x1: o.ax + 120, y: o.ay - 110, rise: 300, speed: 50, wind: 30, color: '#ff6a3a', size: [1, 3], seed: 7 });
    // 前景：左下崖台与许愿的两人（略快于远景，有视差）
    g.save(); g.translate(-14 * p, 6 * p);
    putLayer(g, 'bm-cliff1', -80, 380, 620, 410, 1, (q) => {
      q.drawImage(cliffTex('a', 620, 280, { seed: 17, top: 0.24, drop: 0.74, rim: RIM_V, pine: [430, 1.0, 0.75] }), -80, 506, 620, 280);
      cliffPair(q, 3, 214, 576, 0.4, { rim: '#ffd27a', rimA: 0.8 });
    });
    { const gl = 0.35 + 0.25 * Math.sin(t * 2.4), px = 224, py = 573.6; add(g, () => { glo(g, px, py, 16 + 24 * gl, '#ffc860', 0.3 + 0.35 * gl); glo(g, px, py, 4, '#fff6d8', 0.5 + 0.4 * gl); }); }
    g.restore();
    V.rain(g, c, { n: 110, angle: 0.12, speed: 1000, len: 26, color: '#c8b0d0', alpha: 0.22, seed: 41 });
    g.restore();
  }

  // ② 古痴今狂：低机位荷兰角近景，他背对镜头狂笑（头后仰、双肩抖），“狂”字双臂高举；
  // 左右两道泼墨浪墙随字升起（左高在柱后，右低晚一拍），图腾柱一根根点亮；“狂”字闪电照出浪里的水魔兽
  function bmP2Plate() {
    return plate('bm2', 1, (q) => {
      base(q, '#050307');
      E.sky(q, { y0: -PM, y1: 660, stops: [[0, '#030205'], [0.4, '#0e0812'], [0.75, '#2a1018'], [1, '#4a1a24']] });
      add(q, () => { glo(q, 640, 360, 560, '#8a1a2a', 0.18); glo(q, 640, 640, 520, '#5a1420', 0.25); });
      E.clouds(q, { t: 5, y: 190, color: '#2a1e2e', shade: '#060408', alpha: 0.85, scale: 1.5, speed: 0, n: 6, seed: 51, spread: 150, lightX: 640 });
      // 天角压下来的大块泼墨
      q.globalAlpha = 0.85;
      q.drawImage(tint(splashTex(71), '#020103'), -PM - 160, -PM - 120, 900, 520);
      q.drawImage(tint(splashTex(72), '#020103'), W - 620 + PM, -PM - 140, 860, 500);
      q.globalAlpha = 0.6; q.drawImage(tint(splashTex(73), '#020103'), 300, -PM - 220, 700, 380);
      q.globalAlpha = 1;
      vignette(q, 0.6, '#020103', PM);
      bloodMoon(q, 640, 338, 176, 1);
      add(q, () => glo(q, 640, 338, 260, '#c8443a', 0.18));
    });
  }
  function bmPanel2(g, c, T) {
    const t = c.t, lt = c.lt, beat = (c.b && c.b.period) || 0.83;
    const ks = [T(4), T(5), T(6), T(7)];
    const kick = kickOf(lt, ks, 0.18);
    cam(g, c, { z: 1.04 + 0.05 * clamp((lt - T(4)) / 1.6), cx: 640, cy: 470, amp: 3, kick: 6 * kick });
    putPlate(g, bmP2Plate());
    moonClouds(g, 640, 400, 176, 40 * lt, 0.55);
    const lv = bolt(g, c, { at: [T(7) + 0.02], x: 300, y0: -60, y1: 380, drift: 90, color: BOLT_V, flash: 0.6, seed: 61, life: 0.35 });
    // 浪墙：左浪高、在柱后；右浪矮、晚一拍才起
    let rL = 0, rR = 0;
    for (let k = 0; k < 4; k++) { rL += easeOut(clamp((lt - ks[k]) / 0.3)); rR += easeOut(clamp((lt - ks[k] - beat * 0.5) / 0.3)); }
    const hL = 90 + 82 * rL, hR = 50 + 52 * rR;
    let wL = null;
    const oL = { x0: -240, x1: 330 + 10 * rL, base: 690, h: hL, r: 46 + 16 * rL, seed: 5 }, oR = { x0: 1560, x1: 950 - 8 * rR, base: 690, h: hR, r: 34 + 12 * rR, seed: 9 };
    wL = inkWave(g, t, oL);
    inkWave(g, t + 3, oR);
    // 浪里的水魔兽：“狂”字的闪电一照，浪里探出一颗巨大的兽头（紫光勾边），两点青光一直亮到切镜
    const bq = ramp(lt, T(7) - 0.03, T(7) + 0.2);
    if (bq > 0 && wL) beastHead(g, t, wL.curl[0] - 70, wL.curl[1] + 100, 0.9, bq, lv);
    // 图腾柱：四根，依次在字上点亮
    const totems = [[70, 712, 560, 46, 0, 0], [1210, 712, 560, 46, 1, 1], [262, 716, 460, 36, 2, 2], [1018, 716, 460, 36, 3, 3]];
    for (const [x, y, hh, w, seed, k] of totems) {
      const tx = totemTex(seed, w, hh), on = ramp(lt, ks[k], ks[k] + 0.14), fl = on * (0.75 + 0.25 * noise1(t * 6 + k, 3));
      blit(g, tx.base, x - tx.w / 2, y - tx.h, tx.w, tx.h);
      if (fl > 0) add(g, () => {
        g.globalAlpha = fl; blit(g, tint(tx.lines, '#ff4a6a'), x - tx.w / 2, y - tx.h, tx.w, tx.h); g.globalAlpha = 1;
        { const p0 = g.globalAlpha; g.globalAlpha = p0 * 0.3 * fl; g.drawImage(XYT.sprites.tint(XYT.sprites.glow, '#a02a5a'), x - w * 1.4, y - hh * 1.05, w * 2.8, hh * 1.1); g.globalAlpha = p0; }
        glo(g, x, y - tx.h + 72, 62, '#ff8a6a', 0.6 * fl * (0.6 + 0.6 * Math.exp(-(lt - ks[k]) / 0.3)));
      });
    }
    // 石阶（仰拍只见一级级立面，阶沿受逆光）
    for (let k = 0; k < 6; k++) {
      const y0 = 650 + k * k * 4 + k * 10, y1 = 650 + (k + 1) * (k + 1) * 4 + (k + 1) * 10;
      g.fillStyle = mix('#140e16', '#030204', k / 5); g.fillRect(-300, y0, W + 600, y1 - y0 + 1);
      g.fillStyle = rgba('#a890e0', 0.36 - k * 0.05); g.fillRect(-300, y0, W + 600, 1.5);
    }
    // 他：古 张臂，痴、今 仰天狂笑（肩在抖），狂 双臂高举
    const laugh = ramp(lt, T(5) - 0.05, T(5) + 0.25) * (1 - 0.6 * ramp(lt, T(7), T(7) + 0.2));
    const arms = lerp(0.3, 0.5, ramp(lt, T(4), T(4) + 0.3)) + 0.5 * easeOut(clamp((lt - T(7)) / 0.22));
    baiyueBack(g, 640, 652, 1.62, t, { arms, laugh: laugh * (0.7 + 0.3 * ramp(lt, T(6), T(6) + 0.2)), wind: 0.95, rim: mix(RIM_V, '#ffffff', lv * 0.6), rimA: 0.85 + 0.15 * lv, fx: 0.7 + 0.5 * lv });
    add(g, () => glo(g, 640, 470, 220, '#7a4aff', 0.08 + 0.1 * clamp(rL / 4) + 0.2 * lv));
    V.embers(g, c, { n: 28, x0: 100, x1: 1180, y: 740, rise: 640, speed: 90, wind: 40, color: '#ff5a2a', size: [1.2, 5], seed: 9 });
    g.restore();
  }
  // 水魔兽的头（龙形）：钝吻张口、上下獠牙、后掠双角、颈后一排鳍、两条长须；剪影，紫光勾边，青色双眼。(x, y) 在眼处，头朝右
  function beastHead(g, t, x, y, s, a, lv) {
    const br = Math.sin(t * 1.7) * 3, jaw = 0.12 + 0.06 * Math.sin(t * 2.3);
    const pt = (px, py) => [x + px * s, y + (py + br) * s];
    const J = (px, py) => { const c = Math.cos(jaw), n = Math.sin(jaw), dx = px - 40, dy = py - 18; return pt(40 + dx * c - dy * n, 18 + dx * n + dy * c); };
    const up = new Path2D();
    up.moveTo(...pt(-170, 60)); up.bezierCurveTo(...pt(-170, -10), ...pt(-110, -62), ...pt(-40, -58));
    up.bezierCurveTo(...pt(-10, -56), ...pt(10, -40), ...pt(40, -38));
    up.bezierCurveTo(...pt(90, -36), ...pt(140, -40), ...pt(168, -30));
    up.bezierCurveTo(...pt(196, -24), ...pt(200, 2), ...pt(184, 12));
    up.lineTo(...pt(40, 20)); up.lineTo(...pt(-60, 70)); up.closePath();
    const low = new Path2D();
    low.moveTo(...J(30, 22)); low.lineTo(...J(170, 30)); low.bezierCurveTo(...J(184, 40), ...J(176, 58), ...J(150, 60));
    low.bezierCurveTo(...J(90, 66), ...J(20, 80), ...J(-60, 110)); low.lineTo(...pt(-170, 120)); low.lineTo(...pt(-170, 60)); low.closePath();
    const horns = new Path2D();
    for (const [ox, sc] of [[-30, 1], [-70, 0.78]]) {
      horns.moveTo(...pt(ox + 14, -52)); horns.bezierCurveTo(...pt(ox - 30 * sc, -120 * sc), ...pt(ox - 110 * sc, -150 * sc), ...pt(ox - 190 * sc, -128 * sc));
      horns.bezierCurveTo(...pt(ox - 120 * sc, -128 * sc), ...pt(ox - 60 * sc, -98 * sc), ...pt(ox - 22, -50)); horns.closePath();
    }
    const fins = new Path2D();
    for (let k = 0; k < 5; k++) { const bx = -100 - k * 22, by = -36 + k * 18, L = 46 - k * 4, w = Math.sin(t * 3 + k) * 4; fins.moveTo(...pt(bx + 10, by)); fins.lineTo(...pt(bx - L, by - L * 0.55 + w)); fins.lineTo(...pt(bx - 6, by + 14)); fins.closePath(); }
    const parts = [up, low, horns, fins];
    g.save(); g.globalAlpha *= a;
    const ra = 0.35 + 0.65 * lv;
    // 口中幽紫的光
    add(g, () => glo(g, ...pt(110, 34), 70 * s, '#7a3aff', 0.35 * (0.5 + lv)));
    add(g, () => { g.lineJoin = 'round'; g.strokeStyle = rgba('#d8ccff', 0.85 * ra); g.lineWidth = 2.3 * s; for (const P of parts) g.stroke(P); });
    g.fillStyle = '#050307'; for (const P of parts) g.fill(P);
    // 上下獠牙
    g.fillStyle = rgba('#e0d8f0', 0.6 + 0.35 * lv); g.beginPath();
    for (const fx of [70, 100, 130, 158]) { const [px, py] = pt(fx, 18); g.moveTo(px - 4 * s, py); g.lineTo(px + 1 * s, py + (fx > 150 ? 22 : 14) * s); g.lineTo(px + 5 * s, py); }
    for (const fx of [80, 112, 144]) { const [px, py] = J(fx, 30); g.moveTo(px - 4 * s, py + 1 * s); g.lineTo(px, py - 14 * s); g.lineTo(px + 4 * s, py + 1 * s); }
    g.fill();
    // 额上、吻上几道紫光的鳞纹；鼻孔
    g.strokeStyle = rgba(RIM_V, 0.25 + 0.45 * lv); g.lineWidth = 1.4 * s; g.beginPath();
    for (let k = 0; k < 6; k++) { const [px, py] = pt(-120 + k * 24, -30 + Math.abs(k - 2.5) * 5); g.moveTo(px, py); g.quadraticCurveTo(px + 10 * s, py - 8 * s, px + 20 * s, py); }
    for (let k = 0; k < 4; k++) { const [px, py] = pt(70 + k * 24, -28); g.moveTo(px, py); g.quadraticCurveTo(px + 9 * s, py - 6 * s, px + 18 * s, py); }
    g.stroke();
    g.restore();
    // 长须：从吻上甩向后上方、后下方，随水摆动
    add(g, () => {
      g.lineCap = 'round';
      for (const [sd, L] of [[-1, 260], [1, 220]]) {
        g.strokeStyle = rgba('#c8b8ff', (0.25 + 0.55 * lv) * a); g.lineWidth = 2 * s;
        g.beginPath(); const [sx, sy] = pt(176, -16);
        g.moveTo(sx, sy);
        for (let i = 1; i <= 12; i++) { const u = i / 12; g.lineTo(sx + (40 - u * L * 0.9) * s, sy + (sd * u * 90 + Math.sin(u * 5 - t * 3 + sd) * 18 * u) * s); }
        g.stroke();
      }
    });
    // 下半截没在浪里：一团软边的深水压住
    { const p0 = g.globalAlpha; g.globalAlpha = p0 * a; const spr = XYT.sprites.tint(XYT.sprites.glow, '#0a070c'); g.drawImage(spr, x - 260 * s, y + 40 * s, 520 * s, 240 * s); g.drawImage(spr, x - 200 * s, y + 70 * s, 400 * s, 180 * s); g.globalAlpha = p0; }
    add(g, () => { const [ex, ey] = pt(20, -22); glo(g, ex, ey, 40 * s, '#48e0c8', 0.5 * a); glo(g, ex, ey, 13 * s, '#48e0c8', 0.95 * a); glo(g, ex, ey, 4.5 * s, '#e8fff8', a);
      const [fx, fy] = pt(-14, -27); glo(g, fx, fy, 22 * s, '#48e0c8', 0.4 * a); glo(g, fx, fy, 8 * s, '#48e0c8', 0.8 * a); });
  }

  // 近景里的二人：阿奴（左，朝右）与唐钰（右，朝左）跪地，双手在中间合捧吊坠
  const CP = { x0: 515, x1: 765, y: 712, s: 2.8, px: 640, py: 712 - 72 * 2.8 };
  function closePair(q) {
    const { x0, x1, y, s, px, py } = CP, SA = s * F.height('anu') / 180, SB = s * F.height('tangyu') / 180;
    const hold = (fx, f, SS, dy) => [((px - fx) * f) / SS, (py - y) / SS + dy];
    const b0 = { pose: 'kneel', cradle: true, wind: 0.6, rim: '#ffd890', light: [px, py], rimAlpha: 1, rimWidth: 1.3, lean: -0.6, head: -0.15 };
    F.draw(q, 'tangyu', x1, y, s, 3, Object.assign({}, b0, { facing: -1, holdN: hold(x1, -1, SB, 3), holdF: hold(x1, -1, SB, 7) }));
    const ao = Object.assign({}, b0, { facing: 1, holdN: hold(x0, 1, SA, 1), holdF: hold(x0, 1, SA, 5) });
    F.draw(q, 'anu', x0, y, s, 3, ao);
    const ap = F.points('anu', x0, y, s, 3, ao);
    eraseHorns(q, ap, s, 1); miaoCrown(q, ap, s, 3, 1);
    E.pendant(q, { x: px, y: py - 34 * s * 0.3, s: s * 0.3, t: 3, glow: 0, swing: 0, color: '#9fd0b8' });
  }
  // ③a 终：近景，崖上二人合捧的吊坠迸出金光
  function bmPanel3a(g, c, T) {
    const t = c.t, lt = c.lt, t8 = T(8), a0 = lt - t8;
    cam(g, c, { z: 1.0 + 0.04 * clamp(a0 / 0.5), cx: 640, cy: 470, amp: 1.6, kick: 5 * kickOf(lt, [t8], 0.15) });
    putPlate(g, plate('bm3c', 0.4, (q) => {
      base(q, '#07050a');
      E.sky(q, { y0: -PM, y1: 520, stops: [[0, '#050307'], [0.6, '#1a0c16'], [1, '#3a1420']] });
      add(q, () => { glo(q, 1010, 230, 420, '#6a1420', 0.5); glo(q, 1010, 230, 150, '#c84a3a', 0.65); glo(q, 1010, 230, 105, '#e0644a', 0.6); });
      E.mist(q, { t: 0, y: 470, h: 120, color: '#3a2030', alpha: 0.6, speed: 0, seed: 4 });
      q.fillStyle = K.lin(q, 0, 500, 0, H + PM, [[0, '#1a0e16'], [1, '#050306']]); q.fillRect(-PM, 500, W + 2 * PM, H);
      add(q, () => { for (let i = 0; i < 12; i++) glo(q, 700 + h2(i, 3) * 560, 520 + h2(i, 4) * 80, 20 + 30 * h2(i, 5), '#ff7a5a', 0.15); });
      vignette(q, 0.7, '#020103', PM);
    }));
    // 失焦的光斑
    add(g, () => { for (let i = 0; i < 7; i++) { const x = 100 + h2(i, 81) * 1100 + Math.sin(t * 0.4 + i) * 20, y = 160 + h2(i, 82) * 300; glo(g, x, y, 40 + 40 * h2(i, 83), i % 3 ? '#ff6a5a' : '#ffd27a', 0.1); } });
    // 崖顶石面
    g.drawImage(cliffTex('c', 1400, 260, { seed: 37, top: 0.2, drop: 1.2, rim: '#ffd27a', sc: 0.5 }), -60, 640, 1400, 260);
    const burst = easeOut(clamp(a0 / 0.12)), gl = 0.6 + 0.4 * burst + 0.15 * Math.sin(t * 20) * burst;
    putLayer(g, 'bm-pair-close', 140, 230, 1000, 500, 1, (q) => closePair(q));
    const px = CP.px, py = CP.py;
    V.godRays(g, c, { x: px, y: py, angle: -PI / 2, spread: 2.6, n: 11, len: 700, width: 0.7, color: '#ffd88a', alpha: 0.32 * burst, source: false, beat: 0.3 });
    add(g, () => {
      glo(g, px, py, 240 * (0.6 + 0.4 * burst), '#ffb84a', 0.24 * gl);
      glo(g, px, py, 70, '#ffd27a', 0.45 * gl);
      glo(g, px, py, 16, '#ffffff', 0.95 * burst);
      // 照在两人脸上、手上的金光
      glo(g, 470, 430, 120, '#ffc860', 0.22 * burst); glo(g, 800, 430, 120, '#ffc860', 0.22 * burst);
    });
    V.sparks(g, c, { at: t8 + 0.02, x: px, y: py, n: 50, speed: 520, spread: TAU, gravity: 120, color: '#ffd890', hot: '#ffffff', size: 1.4, dur: 0.9 });
    g.restore();
  }

  // ③ 成空：远景，金光过湖冲上祭坛；“空”字推到坛顶，拜月自上而下化灰，灰向血月飘；
  // 随后拉开：一道巨浪扑碎湖里的月影，两只比翼鸟从左下的金光里飞起，掠过血月
  const BM3 = { hz: 450, mx: 1060, my: 272, mr: 104, seed: 11, cseed: 44, ax: 800, ay: 592, as: 0.62, is: 1.05, clouds: [[300, 120, 1000, 560, 4, 0.9], [1300, 90, 760, 420, 6, 0.8], [700, 20, 800, 300, 9, 0.7]] };
  function bmPanel3(g, c, T) {
    const t = c.t, lt = c.lt, o = BM3;
    const t9 = T(9), t10 = T(10);
    const push = easeInOut(clamp((lt - t9 - 0.05) / 0.62)), pull = easeInOut(clamp((lt - 5.55) / 0.95));
    // 镜头：先推到坛顶与血月之间，再拉开；fx, fy 是要放到画面 (640, sy) 处的那一点
    const z = 1.0 + 0.64 * push - 0.5 * pull, fx = lerp(lerp(640, 930, push), 760, pull), fy = lerp(lerp(380, 400, push), 390, pull), sy = lerp(380, 370, push);
    cam(g, c, { z, cx: fx, cy: fy, px: 640 - fx, py: sy - fy, amp: 2, kick: 5 * kickOf(lt, [t10], 0.25) + 4 * kickOf(lt, [6.2], 0.2) });
    putPlate(g, bmPlate('bm3', o));
    bloodMoon(g, o.mx, o.my, o.mr, 1);
    moonClouds(g, o.mx, o.my + 18, o.mr, 30 * lt, 0.6);
    glints(g, t, o.mx, o.hz + 4, 640, o.mr * 0.3, '#ff8a6a', 0.5, 9);
    // 湖里的月影：竖着拉长、被波纹切成一段段；巨浪砸下来时碎成乱跳的红光
    const hitT = 6.2, broke = ramp(lt, hitT - 0.05, hitT + 0.25);
    moonReflection(g, t, o.mx, o.hz, o.mr, 1 - broke, broke, lt - hitT);
    // 巨浪：自右侧湖面立起，卷向月影，砸下去化成白沫
    const wv = clamp((lt - 5.5) / 0.72), col = ramp(lt, hitT - 0.02, hitT + 0.42);
    if (wv > 0 && col < 1) {
      const x1 = lerp(1560, o.mx - 30, easeInOut(wv)), wh = (60 + 260 * easeOut(wv)) * (1 - col);
      const ow = { x0: x1 + 560, x1, base: o.hz + 150, h: wh, r: 54 * (1 - 0.5 * col) + 10, seed: 13, nSpray: 22, alpha: 1 - 0.5 * col };
      inkWave(g, t, ow);
    }
    if (col > 0) add(g, () => {
      for (let i = 0; i < 26; i++) { const x = o.mx - 300 + h2(i, 71) * 640, y = o.hz + 20 + h2(i, 72) * 120 - col * 50 * h2(i, 73); glo(g, x, y, 10 + 22 * h2(i, 74), '#e8a0a8', 0.14 * Math.sin(PI * col)); }
      const boom = clamp((lt - hitT) / 0.9);
      if (boom > 0 && boom < 1) for (let i = 0; i < 40; i++) {
        const an = -PI / 2 + (h2(i, 95) - 0.5) * 2.6, v = 260 + 360 * h2(i, 96), u = 0.08 + boom * 0.9;
        glo(g, o.mx - 60 + h2(i, 98) * 160 + Math.cos(an) * v * u, o.hz + 70 + Math.sin(an) * v * u + 420 * u * u, 3 + 6 * h2(i, 97), '#ffc8c0', 0.5 * (1 - boom));
      }
    });
    bmAltar(g, 'b', o, 1.8);
    braziers(g, t, o.ax, o.ay, o.as);
    // 金光：左下崖上的吊坠 → 湖面 → 石台 → 石阶 → 坛顶
    const pend = [243.5, 573];
    const path = [pend, [330, 630], [450, 652], [580, 624], [690, 602], [758, 566], [788, 530], [800, 494]];
    const gp = easeInOut(clamp((lt - t9 + 0.02) / (t10 - t9 - 0.03)));
    // 拜月：金光上身，“空”字起自上而下化灰
    const by = o.ay - 168 * o.as, bs = 0.86, bh = 214 * bs;
    const dis = clamp((lt - t10) / 0.95), engulf = ramp(lt, t10 - 0.2, t10 + 0.05);
    const shake = 1 - ramp(lt, t10 - 0.3, t10);
    const bo = { arms: 1, laugh: 0.8 * shake, wind: 0.9, rim: mix(RIM_V, '#ffe9a0', engulf), rimA: 0.85 + 0.15 * engulf, fx: 1 - engulf };
    if (dis < 1) {
      if (dis <= 0) baiyueBack(g, o.ax, by, bs, t, bo);
      else {
        // 化灰时他不再动：身形缓存成一张（金光勾边），每帧只做擦除
        const bw = 300 * bs, bh2 = 292 * bs, spr = C('bm-baiyue-ash', bw, bh2, 1.8, (q) => { q.translate(bw / 2, 280 * bs); baiyueBack(q, 0, 0, bs, 9.3, { arms: 1, laugh: 0, wind: 0.9, rim: '#ffe9a0', rimA: 1, fx: 0 }); });
        ashDraw(g, [o.ax - bw / 2, by - 280 * bs, bw, bh2], t, dis, 19, (q) => q.drawImage(spr, o.ax - bw / 2, by - 280 * bs, bw, bh2));
      }
    }
    ashFlakes(g, lt, { x: o.ax, top: by - bh, bot: by, s: bs * 2.2, t0: t10, dur: 0.95, n: 200, seed: 23, tx: o.mx + 60, ty: o.my - 40 });
    if (engulf > 0) {
      if (dis < 1) V.godRays(g, c, { x: o.ax, y: by + 6, angle: -PI / 2, spread: 0.3, n: 5, len: 520, width: 0.55, color: '#ffd88a', alpha: 0.4 * engulf * (1 - dis), source: false, beat: 0.4 });
      add(g, () => { glo(g, o.ax, by - 60, 130, '#ffc860', 0.42 * engulf * (1 - 0.5 * dis)); glo(g, o.ax, by - 4, 34, '#fff4d0', 0.7 * engulf * (1 - dis * 0.8)); });
    }
    goldVein(g, t, path, gp, 1 - 0.5 * ramp(lt, 6.0, 6.6));
    E.mist(g, { t, y: o.ay + 6, h: 56, color: '#3a2638', alpha: 0.45, speed: 9, seed: 5 });
    // 前景崖台与二人：金光自吊坠迸出，二人化入光中，比翼鸟从光里飞出
    const fade = ramp(lt, t10 + 0.3, 5.6);
    g.drawImage(cliffTex('b', 640, 280, { seed: 29, top: 0.3, drop: 0.7, rim: '#e8c890', pine: [86, 1.3, -0.6] }), -160, 540, 640, 280);
    g.save(); g.globalAlpha *= 1 - 0.9 * fade;
    putLayer(g, 'bm-pair3', 130, 470, 260, 160, 1.2, (q) => cliffPair(q, 3, 228, 620, 0.62, { rim: '#ffe2a0' }));
    g.restore();
    add(g, () => { glo(g, pend[0], pend[1], 60, '#ffc860', 0.5); glo(g, pend[0], pend[1], 12, '#fffbe8', 0.9); glo(g, pend[0], pend[1] - 20, 120, '#ffd27a', 0.3 * fade); });
    pairBirds(g, t, lt, 5.05);
    V.embers(g, c, { n: 24, x0: 700, x1: 1100, y: 640, rise: 360, speed: 55, wind: 30, color: '#ffb04a', size: [1, 3], seed: 13 });
    g.restore();
  }
  // 湖里的月影：一道竖着拉长的柔光，上面是一行行明灭错落的碎光；broke 碎开的程度（被浪砸散成乱跳的红光），age 碎开后的秒数
  function moonReflection(g, t, x, hz, r, k, broke, age) {
    if (k > 0.01) {
      add(g, () => { const p0 = g.globalAlpha; g.globalAlpha = p0 * 0.3 * k; g.drawImage(XYT.sprites.tint(XYT.sprites.glow, '#c8402e'), x - r * 0.9, hz - r * 0.3, r * 1.8, r * 2.6); g.globalAlpha = p0; });
      g.save(); g.globalAlpha *= k; glints(g, t, x, hz + 6, hz + r * 1.9, r * 0.32, '#ff8a5a', 1, 21); g.restore();
    }
    if (broke > 0.01) {
      const fade = Math.exp(-Math.max(0, age) * 0.9);
      g.save(); g.globalAlpha *= broke * fade; glints(g, t * 2.2, x - r * 0.4, hz + 10, hz + r * 2.2, r * (0.6 + 0.8 * broke), '#ff6a4a', 1, 33); glints(g, t * 1.8 + 3, x + r * 0.6, hz + 20, hz + r * 2, r * 0.7 * broke, '#ff9a6a', 0.8, 34); g.restore();
    }
  }
  // 比翼鸟：两只剪影并肩斜飞，长尾，身后一道金色流光；从 t0 起沿一条弧飞过血月
  const BIRD_PATH = [[250, 560, 0], [540, 430, 0.3], [860, 320, 0.55], [1060, 258, 0.7], [1250, 190, 0.85], [1450, 110, 1.05]];
  function birdAt(u) {
    const P = BIRD_PATH; let i = 1; while (i < P.length - 1 && u > P[i][2]) i++;
    const a = P[i - 1], b = P[i], f = clamp((u - a[2]) / (b[2] - a[2])), e = f * f * (3 - 2 * f) * 0.3 + f * 0.7;
    return [lerp(a[0], b[0], e), lerp(a[1], b[1], e)];
  }
  function pairBirds(g, t, lt, t0) {
    const dur = 1.25, u0 = (lt - t0) / dur;
    if (u0 <= 0 || u0 > 1.1) return;
    for (let b = 0; b < 2; b++) {
      const u = u0 - b * 0.03, off = b ? [-14, 22] : [0, 0];
      if (u <= 0) continue;
      // 金色流光：沿走过的路一串柔光
      // 金色流光：沿走过的路一道渐细渐淡的光痕
      add(g, () => {
        const tr = []; for (let k = 0; k <= 24; k++) { const uu = u - k * 0.012; if (uu < 0) break; const [px, py] = birdAt(uu); tr.push([px + off[0] - 8, py + off[1]]); }
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (const [lw, al, col] of [[10, 0.12, '#ffb84a'], [3.5, 0.3, '#ffd27a'], [1.2, 0.6, '#fff4d8']]) {
          for (let c3 = 0; c3 < 3; c3++) {
            const k0 = Math.floor(c3 * tr.length / 3), k1 = Math.min(tr.length - 1, Math.floor((c3 + 1) * tr.length / 3));
            if (k1 <= k0) continue;
            g.strokeStyle = rgba(col, al * (1 - c3 / 3)); g.lineWidth = lw * (1 - 0.25 * c3);
            g.beginPath(); g.moveTo(tr[k0][0], tr[k0][1]); for (let k = k0 + 1; k <= k1; k++) g.lineTo(tr[k][0], tr[k][1]); g.stroke();
          }
        }
      });
      const [x, y] = birdAt(u), [x2, y2] = birdAt(u + 0.01), ang = Math.atan2(y2 - y, x2 - x), flap = Math.sin(t * 15 + b * 2.4);
      bird(g, x + off[0], y + off[1], 1.25 - 0.25 * clamp(u), ang, flap, t + b);
    }
  }
  function bird(g, x, y, s, ang, flap, t) {
    g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s);
    // 长尾两条，随风飘
    g.strokeStyle = '#0a0608'; g.lineCap = 'round';
    for (const sd of [-1, 1]) {
      g.lineWidth = 2.4; g.beginPath(); g.moveTo(-8, 0); g.bezierCurveTo(-26, sd * 4 + Math.sin(t * 6) * 3, -44, sd * 9 + Math.sin(t * 5 + sd) * 6, -64, sd * 6 + Math.sin(t * 4 + sd) * 9); g.stroke();
    }
    g.fillStyle = '#0a0608';
    g.beginPath(); g.ellipse(0, 0, 11, 3.6, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(10, -1.5); g.lineTo(16, 0); g.lineTo(10, 1.5); g.fill();
    for (const sd of [-1, 1]) {
      const fy = sd * (14 + 12 * flap * sd);
      g.beginPath(); g.moveTo(4, 0); g.quadraticCurveTo(-2, fy * 0.6, -10, fy); g.quadraticCurveTo(-4, fy * 0.4, -6, 0); g.closePath(); g.fill();
    }
    // 一线金边
    add(g, () => { g.strokeStyle = rgba('#ffd890', 0.55); g.lineWidth = 0.9; g.beginPath(); g.ellipse(0, 0, 11.5, 4, 0, PI * 1.05, PI * 1.95); g.stroke(); });
    g.restore();
  }

  // =====================================================================
  // 34 阿奴弑父：刀钝刃乏｜恩断义绝｜梦方破
  // =====================================================================
  const AN_T = [0.34, 0.62, 0.96, 1.6, 1.99, 2.38, 3.12, 3.48, 3.86, 4.3, 4.75];
  // 王宫石阶：侧看的一大段台阶，自左下往右上；x0,y0 第 0 级前沿，tread 踏面宽，riser 每级高，D 踏面进深
  const AN = { x0: -320, y0: 770, tread: 56, riser: 13.4, D: 30, sun: [806, 446], sunR: 34 };
  const anK = (x) => Math.floor((x - AN.x0) / AN.tread);
  const anEdge = (x) => AN.y0 - AN.riser * anK(x);
  const anFoot = (x) => anEdge(x) - AN.D * 0.45;
  const AN_WIND = { wind: 0.85, windDir: -1 };

  // 南诏宫门：重檐，檐角翘起，脊上一对牛角；暗色剪影，檐口受暮光
  function anPalace(q, x, y, s, col, rim) {
    q.save(); q.translate(x, y); q.scale(s, s);
    const roof = (w, y0, h, ov) => {
      q.fillStyle = col;
      q.beginPath(); q.moveTo(-w - ov, y0); q.quadraticCurveTo(-w * 0.55, y0 - h * 0.15, -w * 0.35, y0 - h); q.lineTo(w * 0.35, y0 - h); q.quadraticCurveTo(w * 0.55, y0 - h * 0.15, w + ov, y0);
      q.quadraticCurveTo(w + ov * 1.3, y0 - h * 0.35, w + ov * 1.5, y0 - h * 0.5); q.lineTo(w + ov * 0.6, y0 + 8); q.lineTo(-w - ov * 0.6, y0 + 8); q.lineTo(-w - ov * 1.5, y0 - h * 0.5); q.quadraticCurveTo(-w - ov * 1.3, y0 - h * 0.35, -w - ov, y0); q.fill();
      q.strokeStyle = rgba(rim, 0.5); q.lineWidth = 1.5;
      q.beginPath(); q.moveTo(-w - ov * 1.5, y0 - h * 0.5); q.quadraticCurveTo(-w - ov * 1.3, y0 - h * 0.35, -w - ov, y0); q.quadraticCurveTo(-w * 0.55, y0 - h * 0.15, -w * 0.35, y0 - h); q.lineTo(w * 0.35, y0 - h); q.stroke();
    };
    q.fillStyle = col; q.fillRect(-150, -90, 300, 90);
    for (let k = -2; k <= 2; k++) { q.fillStyle = mix(col, '#000000', 0.3); q.fillRect(k * 56 - 6, -88, 12, 88); }
    q.fillStyle = mix(col, '#000000', 0.55); q.fillRect(-40, -70, 80, 70);
    roof(170, -90, 46, 40);
    q.fillStyle = col; q.fillRect(-110, -170, 220, 40);
    roof(120, -150, 40, 30);
    // 屋脊牛角
    q.strokeStyle = col; q.lineWidth = 9; q.lineCap = 'round';
    for (const sd of [-1, 1]) { q.beginPath(); q.moveTo(sd * 30, -190); q.quadraticCurveTo(sd * 80, -200, sd * 70, -246); q.stroke(); }
    q.restore();
  }
  // 石阶：侧墙（墙上一道浮雕带）、踏面（受暮光的一条条浅带）、远侧石栏
  function anStairs(q, o = {}) {
    const { x0, y0, tread, riser, D } = AN, n = 36, stone = o.stone || '#2c2836';
    q.beginPath(); q.moveTo(x0, H + 300);
    for (let k = 0; k < n; k++) { const x = x0 + k * tread, y = y0 - riser * k; q.lineTo(x, y); q.lineTo(x + tread, y); }
    q.lineTo(x0 + n * tread, H + 300); q.closePath();
    q.fillStyle = K.lin(q, 0, 260, 0, 820, [[0, stone], [1, '#09080c']]); q.fill();
    // 侧墙浮雕：沿坡度的一道回纹带
    q.save(); q.beginPath(); q.rect(-400, -400, W + 800, H + 800); q.clip();
    const sl = riser / tread;
    for (const [dy, a] of [[40, 0.5], [58, 0.3]]) {
      q.strokeStyle = rgba('#5a5068', a); q.lineWidth = 2;
      q.beginPath(); q.moveTo(x0, y0 + dy + 10); q.lineTo(x0 + n * tread, y0 + dy + 10 - n * tread * sl); q.stroke();
    }
    for (let k = 0; k < n * 2; k++) {
      const x = x0 + k * tread * 0.5 + 10, y = y0 + 49 - (x - x0) * sl + 10;
      q.strokeStyle = rgba('#4a4258', 0.45); q.lineWidth = 1.4;
      q.beginPath(); q.arc(x, y, 5, 0, PI * 1.6); q.stroke();
    }
    q.restore();
    // 踏面
    for (let k = 0; k < n; k++) {
      const x = x0 + k * tread, y = y0 - riser * k;
      q.fillStyle = K.lin(q, 0, y - D, 0, y, [[0, o.far || '#3a3446'], [1, o.near || '#6a6078']]);
      q.fillRect(x, y - D, tread + 0.6, D);
      q.fillStyle = rgba(o.lit || '#d8cce8', 0.5); q.fillRect(x, y - 1.2, tread + 0.6, 1.6);
      q.fillStyle = rgba('#000000', 0.25); q.fillRect(x + tread - 2, y - D, 2, D);
      if (h2(k, 5) < 0.4) { q.strokeStyle = rgba('#1a1620', 0.6); q.lineWidth = 1; q.beginPath(); q.moveTo(x + 10 + h2(k, 6) * 30, y - D * 0.2); q.lineTo(x + 18 + h2(k, 7) * 30, y - D * 0.8); q.stroke(); }
    }
    // 远侧石栏：沿坡的扶手与望柱
    q.strokeStyle = o.rail || '#1e1a26'; q.lineWidth = 7; q.lineCap = 'round';
    q.beginPath(); q.moveTo(x0, y0 - D - 62); q.lineTo(x0 + n * tread, y0 - D - 62 - n * riser); q.stroke();
    q.lineWidth = 2; q.strokeStyle = rgba(o.lit || '#d8cce8', 0.35);
    q.beginPath(); q.moveTo(x0, y0 - D - 66); q.lineTo(x0 + n * tread, y0 - D - 66 - n * riser); q.stroke();
    for (let k = 0; k < n; k += 3) {
      const x = x0 + k * tread + 20, y = y0 - riser * k - D;
      q.fillStyle = o.rail || '#1e1a26'; q.fillRect(x - 5, y - 74, 10, 74);
      q.beginPath(); q.arc(x, y - 78, 7, 0, TAU); q.fill();
      q.fillStyle = rgba('#000000', 0.3); q.fillRect(x + 8, y - 58, 3 * tread - 16, 50);
    }
  }
  // 苗家长幡：竿顶挑一条彩绣长幡，被风吹向左
  function anBanner(g, t, x, y, h, len, seed, cols) {
    g.fillStyle = '#16121c'; g.fillRect(x - 2.5, y - h, 5, h);
    const n = 14, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, w = Math.sin(t * 5.2 - u * 7 + seed) * 10 * u + Math.sin(t * 3.1 - u * 4 + seed * 2) * 6 * u;
      pts.push([x - u * len, y - h + 6 + w + u * u * 14]);
    }
    const bw = 16;
    for (let b = 0; b < cols.length; b++) {
      g.fillStyle = cols[b];
      g.beginPath();
      const o0 = (b / cols.length) * bw, o1 = ((b + 1) / cols.length) * bw;
      pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + o0 * (1 - i / n * 0.4)) : g.moveTo(p[0], p[1] + o0)));
      for (let i = n; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] + o1 * (1 - i / n * 0.4));
      g.closePath(); g.fill();
    }
  }
  // 风里的枯叶与尘：从右向左翻飞（time 可放慢）
  function anLeaves(g, t, n, seed, area, k) {
    const [x0, y0, x1, y1] = area, sp = k ?? 1;
    for (let i = 0; i < n; i++) {
      const z = h2(i, seed), v = (180 + 260 * z), P = (x1 - x0 + 200) / v;
      const u = ((t * sp / P + h2(i, seed + 1)) % 1);
      const x = x1 + 100 - u * (x1 - x0 + 200), y = y0 + h2(i, seed + 2) * (y1 - y0) + Math.sin(t * sp * 2.5 + i) * 26 + u * 40;
      const s = (2 + 5 * z) * (i % 3 ? 1 : 1.6);
      g.save(); g.translate(x, y); g.rotate(t * sp * (3 + 4 * z) + i); g.scale(1, Math.cos(t * sp * 4 + i * 1.3));
      g.fillStyle = i % 4 === 0 ? rgba('#b0a4e3', 0.5 + 0.3 * z) : rgba('#1a1620', 0.55 + 0.4 * z);
      g.beginPath(); g.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  // 剑：剑柄在 (x, y)，朝 ang；红穗随风
  function anSword(g, t, x, y, ang, L, s) {
    g.save(); g.translate(x, y); g.rotate(ang);
    const gr = g.createLinearGradient(0, -3 * s, 0, 3 * s);
    gr.addColorStop(0, '#f2f4f8'); gr.addColorStop(0.5, '#a8b0bc'); gr.addColorStop(1, '#5a6270');
    g.fillStyle = gr; g.beginPath(); g.moveTo(8 * s, -2.4 * s); g.lineTo(L - 10 * s, -2 * s); g.lineTo(L, 0); g.lineTo(L - 10 * s, 2 * s); g.lineTo(8 * s, 2.4 * s); g.closePath(); g.fill();
    g.fillStyle = '#c8a050'; g.fillRect(6 * s, -6 * s, 3 * s, 12 * s);
    g.fillStyle = '#2a1e18'; g.fillRect(-10 * s, -2 * s, 16 * s, 4 * s);
    g.restore();
    g.strokeStyle = '#9a3324'; g.lineWidth = 1.6 * s; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const bx = x - Math.cos(ang) * 10 * s, by = y - Math.sin(ang) * 10 * s; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + 4 * s + Math.sin(t * 4 + k) * 3, by + 10 * s, bx + 10 * s + k * 2 + Math.sin(t * 3 + k) * 5, by + 18 * s); g.stroke(); }
  }
  // 短刃：苗刀式的短刀，握在 (x, y)，刃朝 ang
  function anDagger(g, x, y, ang, s, a) {
    g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha *= a ?? 1;
    g.fillStyle = '#d8dce8'; g.beginPath(); g.moveTo(4 * s, -2 * s); g.quadraticCurveTo(24 * s, -3.4 * s, 34 * s, 0.6 * s); g.lineTo(4 * s, 2 * s); g.closePath(); g.fill();
    g.fillStyle = '#e8c860'; g.fillRect(2 * s, -4 * s, 2.2 * s, 8 * s);
    g.fillStyle = '#3a1a24'; g.fillRect(-8 * s, -1.8 * s, 10 * s, 3.6 * s);
    g.restore();
  }
  // 葫芦碎片：几块弧形的瓢片带着暗边，向四周慢慢飞散后落在阶上
  function gourdShards(g, t, x, y, age, s, slow) {
    if (age < 0) return;
    const k = age * (slow ?? 1);
    for (let i = 0; i < 9; i++) {
      const an = -PI / 2 + (h2(i, 41) - 0.5) * 2.6, v = (70 + 120 * h2(i, 42)) * s, d = Math.min(k, 0.55);
      let px = x + Math.cos(an) * v * d, py = y + Math.sin(an) * v * d + 0.5 * 900 * d * d * s;
      const land = y + (6 + 10 * h2(i, 44)) * s;
      if (py > land) py = land;
      const sz = (3 + 5 * h2(i, 43)) * s, rot = an + k * (4 + 6 * h2(i, 45)) * (py >= land ? 0 : 1);
      g.save(); g.translate(px, py); g.rotate(rot);
      g.fillStyle = '#a8602c'; g.beginPath(); g.arc(0, 0, sz, PI * 1.1, PI * 1.9); g.lineTo(sz * 0.6, -sz * 0.2); g.closePath(); g.fill();
      g.strokeStyle = '#4a2410'; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }
  // 被操控的紫光：眼里一小点紫光，带一线短短的横向光痕
  function anEye(g, x, y, s, a, t) {
    if (a <= 0.01) return;
    add(g, () => {
      const f = 0.85 + 0.15 * Math.sin(t * 11);
      glo(g, x, y, 8 * s, '#8a6cff', 0.6 * a * f);
      glo(g, x, y, 2.6 * s, '#f0e8ff', 0.95 * a);
      const p = g.globalAlpha; g.globalAlpha = p * 0.5 * a * f;
      g.drawImage(XYT.sprites.tint(XYT.sprites.glow, '#b0a4e3'), x - 15 * s, y - 1.2 * s, 30 * s, 2.4 * s);
      g.globalAlpha = p;
    });
  }
  // 酒与一线殷红顺着台阶往下流：pts 折线（踏面前沿、立面），prog 0..1 走到哪；前沿一颗湿亮的液珠
  // 从石阶上 x 处起，沿踏面走到前沿、落到下一级……（石阶坐标；map 把它换到画面坐标）
  function stairPath(x, n, map) {
    const yT = (k) => AN.y0 - AN.riser * k - AN.D * 0.22, M = map || ((p) => p);
    let k = anK(x);
    const pts = [M([x, yT(k)])];
    for (let j = 0; j < n; j++) { const ex = AN.x0 + k * AN.tread + 3; pts.push(M([ex, yT(k)])); pts.push(M([ex - 2, yT(k - 1)])); k--; }
    return pts;
  }
  function wineFlow(g, pts, prog, t, s) {
    if (prog <= 0) return;
    let L = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
    const cut = L * clamp(prog);
    let head = pts[0];
    const path = (dx, dy) => {
      g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy); let acc = 0;
      for (let i = 1; i < pts.length; i++) { const l = seg[i - 1]; if (acc + l >= cut) { const u = (cut - acc) / l; head = [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]; g.lineTo(head[0] + dx, head[1] + dy); break; } g.lineTo(pts[i][0] + dx, pts[i][1] + dy); acc += l; head = pts[i]; }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = rgba('#5a3018', 0.6); g.lineWidth = 5 * s; path(0, 0.5 * s); g.stroke();
    g.strokeStyle = rgba('#7a1820', 0.95); g.lineWidth = 2.4 * s; path(0, 1.4 * s); g.stroke();
    g.strokeStyle = rgba('#ffd8c0', 0.32); g.lineWidth = 0.8 * s; path(-0.4 * s, -1 * s); g.stroke();
    if (prog < 1) {
      g.fillStyle = '#6a161e'; g.beginPath(); g.ellipse(head[0], head[1] + 1.4 * s, 3 * s, 2.3 * s, 0, 0, TAU); g.fill();
      add(g, () => glo(g, head[0] - 1 * s, head[1], 2.6 * s, '#ffe0c0', 0.5));
    }
  }
  const AN_SLOPE = (x) => AN.y0 - AN.riser * ((x - AN.x0) / AN.tread - 0.5) - AN.D * 0.45;

  // 底版连同镜头的固定部分（转角 rot、缩放 z0，绕 cx, cy）一起烘进去；每帧底版只剩平移抖动和很小的推拉，
  // 贴图几乎 1:1、不旋转（便宜）；返回时 g 已经套上完整的镜头变换（与 cam 一样，最后要 g.restore()）
  function camPlate(g, c, key, sc, o, fn) {
    const img = plate(key, sc, (q) => { q.translate(o.cx, o.cy); q.rotate(o.rot); q.scale(o.z0, o.z0); q.translate(-o.cx, -o.cy); fn(q); });
    const t = c.t, a = o.amp ?? 3, k = o.kick || 0;
    const dx = a * (noise1(t * 1.6, 3) * 2 - 1) + k * Math.sin(t * 87) + (o.px || 0);
    const dy = a * (noise1(t * 1.4, 5) * 2 - 1) + k * Math.cos(t * 73) + (o.py || 0);
    const zr = o.z / o.z0;
    g.save(); g.translate(o.cx + dx, o.cy + dy); g.scale(zr, zr); g.translate(-o.cx, -o.cy);
    putPlate(g, img);
    g.translate(o.cx, o.cy); g.rotate(o.rot); g.scale(o.z0, o.z0); g.translate(-o.cx, -o.cy);
  }

  XYT.registerShot('c2_anu', {
    name: '阿奴弑父', zone: 'left', night: true, text: '#e9f1f6', shadow: 'rgba(14,10,22,0.92)', accent: '#c9a8ff', bloom: 0.38,
    draw(g, c) {
      const T = (k) => chT(c, k, AN_T);
      if (c.lt < T(4)) anPanel1(g, c, T);
      else if (c.lt < T(8)) anPanel2(g, c, T);
      else anPanel3(g, c, T);
    },
  });

  // 暮色石阶：天、沉到远山后的落日（只剩一弯与余晖）、云、远山、远处宫阙、台阶顶上的宫门、石阶
  function anScene(q) {
    q.fillStyle = K.lin(q, 0, -400, 0, 1100, [[0, '#1a1828'], [0.4, '#3e3450'], [0.62, '#6a5a72'], [1, '#2a2434']]); q.fillRect(-900, -900, W + 1800, H + 1800);
    E.sky(q, { y0: -400, y1: 520, stops: [[0, '#1c1a2a'], [0.45, '#3e3450'], [0.8, '#6a5c78'], [1, '#8a7486']] });
    add(q, () => { glo(q, AN.sun[0], AN.sun[1] + 20, 420, '#c88a8a', 0.32); glo(q, AN.sun[0], AN.sun[1], 160, '#f0c0b0', 0.4); });
    E.sun(q, { x: AN.sun[0], y: AN.sun[1], r: AN.sunR, color: '#e0b8b0', glow: 0.5, spread: 5, haze: '#c89a9a', sink: 470 });
    E.clouds(q, { t: 4, y: 230, color: '#9a8cac', shade: '#3a3248', alpha: 0.7, scale: 1.1, speed: 0, n: 6, seed: 61, spread: 160, lightX: AN.sun[0] });
    inkRidge(q, { y: 470, h: 120, seed: 71, w: 120, col: '#4a4058', fog: '#6a5c74', rough: 10, rim: '#e8b8b0', rimA: 0.35, lightDir: -1 });
    inkRidge(q, { y: 500, h: 90, seed: 73, w: 80, col: '#302a3c', fog: '#4a4058', rough: 8 });
    anPalace(q, 300, 470, 0.55, '#3a3248', '#c8a4b0');
    E.mist(q, { t: 0, y: 470, h: 90, color: '#7a6c88', alpha: 0.5, speed: 0, seed: 7 });
    anPalace(q, 1290, AN.y0 - AN.riser * anK(1290) - AN.D, 1.25, '#17141e', '#cfc4e8');
    anStairs(q);
  }
  // 风里拉长的薄云：两三块淡色泼墨慢慢向左飘（便宜的动感）
  function anWisps(g, t, a) {
    for (const [y, w, h, sd, al, sp] of [[170, 700, 90, 63, 0.35, 34], [250, 560, 70, 64, 0.28, 52], [110, 820, 110, 65, 0.22, 24]]) {
      const x = ((1500 - t * sp + sd * 97) % 2000) - 360;
      g.globalAlpha = a * al; g.drawImage(tint(splashTex(sd), '#c8bcd8'), x, y - h / 2, w, h);
    }
    g.globalAlpha = 1;
  }

  // ① 刀钝刃乏：阿奴迈步冲上石阶（脚步踩实，不滑），离他三步时扑刺；他握剑的手从“刃”字起慢慢垂下，“乏”字前垂到底，不挡
  function anPanel1(g, c, T) {
    const t = c.t, lt = c.lt;
    camPlate(g, c, 'an1b', 1, { rot: -0.2, z0: 1.045, z: 1.03 + 0.03 * clamp(lt / 2), cx: 640, cy: 420, amp: 3.2 }, anScene);
    anWisps(g, t, 1);
    for (const [x, k, sd] of [[460, 0, 1], [700, 1, 2], [960, 2, 3], [1180, 3, 4]]) {
      const yy = AN.y0 - AN.riser * anK(x) - AN.D;
      anBanner(g, t, x, yy - 4, 150 + 20 * (k % 2), 120, sd, k % 2 ? ['#5a1a26', '#7a2a32', '#5a1a26'] : ['#26304a', '#8a6a3a', '#26304a']);
    }
    anLeaves(g, t, 22, 11, [0, 120, W, 520], 1);
    // 酒剑仙：站在高处，剑从手里斜指来人，“刃”起慢慢垂下
    const jx = 820, jy = anFoot(jx), js = 1.3;
    const drop = easeInOut(clamp((lt - T(2)) / (T(4) - 0.05 - T(2))));
    const jo = Object.assign({ pose: 'stand', prop: 'none', facing: -1, rim: '#ecdcf0', light: AN.sun, head: 0.05 + 0.3 * drop, lean: 0.02 * drop, tone: 'silhouette', ink: '#2a2420', rimAlpha: 0.9 }, AN_WIND);
    F.draw(g, 'jiujianxian', jx, jy, js, t, jo);
    const jp = F.points('jiujianxian', jx, jy, js, t, jo);
    anSword(g, t, jp.handN[0], jp.handN[1], lerp(PI + 0.38, PI / 2 + 0.3, drop), 118, 1.25);
    // 阿奴：迈步上阶，x 按步速走（脚不滑），“乏”前 0.3 秒扑刺
    const ws = F.walkSpeed('anu', 1.3, { speed: 2.6 }), tl0 = T(3) - 0.3, x0 = 318;
    const ax = x0 + ws * Math.min(lt, tl0) + 46 * easeOut(clamp((lt - tl0) / 0.4)), ay = AN_SLOPE(ax);
    const lunge = lt >= tl0;
    const ao = Object.assign({ pose: lunge ? 'swordPoint' : 'walk', speed: 2.6, lean: lunge ? 0.05 : 0.2, facing: 1, prop: 'none', rim: '#d8c8ff', light: AN.sun, rimAlpha: 0.9 }, AN_WIND);
    // 冲势：身后几道干笔
    { const sp = lunge ? 1 - clamp((lt - tl0) / 0.5) : 0.7, br = tint(brushTex(2), '#cfc4e8');
      for (let k = 0; k < 4; k++) { g.globalAlpha = 0.24 * sp * (1 - k * 0.2); putR(g, br, ax - 100 - k * 22, ay - 70 - k * 26 + 10 * Math.sin(k * 2), 170 + 60 * sp, 10, -0.24 + 0.03 * k); }
      g.globalAlpha = 1; }
    F.draw(g, 'anu', ax, ay, 1.3, t, ao);
    const ap = F.points('anu', ax, ay, 1.3, t, ao);
    const dA = lunge ? Math.atan2(ap.handN[1] - ap.elbowN[1], ap.handN[0] - ap.elbowN[0]) : PI / 2 - 0.5;
    anDagger(g, ap.handN[0], ap.handN[1], dA, 1.3);
    anEye(g, ap.head[0] + 5, ap.head[1] - 1, 1.3, 1, t);
    V.threads(g, c, { lines: [[ap.head[0] - 60, -120, ap.head[0], ap.head[1] - 12], [ap.handN[0] + 30, -120, ap.handN[0], ap.handN[1]], [ap.handF[0] - 80, -120, ap.handF[0], ap.handF[1]]], color: '#a890ff', width: 0.7, glow: 0.3, sag: 8, wave: 3, alpha: 0.3, pulse: false, seed: 211 });
    anLeaves(g, t, 8, 17, [0, 200, W, 700], 1.4);
    g.restore();
    fgLeaves(g, t, 1180, 760, 1.2, 0.85);
  }

  // ② 恩断义绝：升格慢镜。两个剪影在逆光里交叠，她的短刃探进交叠处；“断”字他弯下身、葫芦从腰间脱落，
  // “义”字他跪下、剑拄在阶上；葫芦翻着落下，“绝”字摔碎，酒和一线殷红顺阶流下。画面一点点暗成剪影
  const AN2 = { jx: 820, js: 1.3 };
  const anJo = (extra) => Object.assign({ pose: 'stand', prop: 'none', facing: -1, light: AN.sun, tone: 'silhouette', ink: '#120f18', rim: '#ecdcf0', rimAlpha: 1, rimWidth: 1.3, head: 0.35, lean: 0.02 }, AN_WIND, extra);
  // 他的几个定格（缓存）：0 站着垂剑，1 弯身，2 跪地拄剑
  function anFather(q, state, t) {
    const jx = AN2.jx, jy = anFoot(jx), o = state === 2 ? anJo({ pose: 'kneel', prop: 'sword', head: 0.5 }) : state === 1 ? anJo({ head: 0.75, lean: 0.27 }) : anJo({});
    F.draw(q, 'jiujianxian', jx, jy, AN2.js, t, o);
    // 腰间的葫芦已经掉了：用剪影色盖掉
    const gp = F.points('jiujianxian', jx, jy, AN2.js, t, o).gourdMouth;
    if (gp && state > 0) { q.fillStyle = '#120f18'; q.beginPath(); q.ellipse(gp[0] + 1, gp[1] + 12, 11, 16, 0, 0, TAU); q.fill(); }
    if (state < 2) { const p = F.points('jiujianxian', jx, jy, AN2.js, t, o); anSword(q, t, p.handN[0], p.handN[1], PI / 2 + 0.3, 118, 1.25); }
  }
  // 弯身的八张过渡定格（与她的升格一样一格一格地动）
  const foldSpr = (qf) => rotSprite('an-fold-' + qf, -0.2, 1.39, [-190, -300, 190, 30], (q) => {
    const jx = AN2.jx, jy = anFoot(jx), f = easeInOut((qf + 0.5) / 8), o = anJo({ head: 0.35 + 0.4 * f, lean: 0.02 + 0.25 * f });
    q.translate(-jx, -jy); F.draw(q, 'jiujianxian', jx, jy, AN2.js, 3.3, o);
    const p = F.points('jiujianxian', jx, jy, AN2.js, 3.3, o);
    if (p.gourdMouth) { q.fillStyle = '#120f18'; q.beginPath(); q.ellipse(p.gourdMouth[0] + 1, p.gourdMouth[1] + 12, 11, 16, 0, 0, TAU); q.fill(); }
    anSword(q, 3.3, p.handN[0], p.handN[1], PI / 2 + 0.3, 118, 1.25);
  });
  const fatherSpr = (state) => rotSprite('an-father-' + state, -0.2, 1.39, [-190, -300, 190, 30], (q) => { q.translate(-AN2.jx, -anFoot(AN2.jx)); anFather(q, state, 3.3); });
  // 她扑刺的定格：升格时身形每 0.045 秒（片内时间）换一张缓存
  const AN_AO2 = Object.assign({ pose: 'swordPoint', facing: 1, prop: 'none', light: AN.sun, tone: 'silhouette', ink: '#120f18', rim: '#d8c8ff', rimAlpha: 1, rimWidth: 1.3, lean: 0.05 }, AN_WIND);
  function anuP2(qi) {
    const ts = 3.3 + qi * 0.045, ax = 0, ay = 0, ao = AN_AO2;
    return rotSprite('an-anu2-' + qi, -0.2, 1.39, [-200, -270, 220, 30], (q) => { F.draw(q, 'anu', ax, ay, 1.3, ts, ao); const p = F.points('anu', ax, ay, 1.3, ts, ao); anDagger(q, p.handN[0], p.handN[1], Math.atan2(p.handN[1] - p.elbowN[1], p.handN[0] - p.elbowN[0]) - 0.06, 1.3); });
  }
  function anPanel2(g, c, T) {
    const t = c.t, lt = c.lt, t4 = T(4), t5 = T(5), t6 = T(6), t7 = T(7), t8 = T(8);
    const ts = t4 + (lt - t4) * 0.2, tf = (c.t - lt) + ts, a2 = lt - t4;
    camPlate(g, c, 'an2b', 1, { rot: -0.2, z0: 1.39, z: 1.36 + 0.06 * clamp(a2 / 1.9), cx: 770, cy: 400, px: -40, py: 30, amp: 1.2 }, anScene);
    anWisps(g, tf, 0.8);
    // 逆光：落日在两人身后，交叠处一团暖光；画面渐暗成剪影
    const dk = ramp(lt, t4, t7);
    if (dk > 0.01) screenFill(g, rgba('#0a0812', 0.55 * dk));
    add(g, () => { glo(g, 790, anFoot(790) - 120, 260, '#e0a8a0', 0.22 + 0.1 * dk); glo(g, 800, anFoot(800) - 110, 90, '#ffe0d0', 0.18); });
    for (const [x, k, sd] of [[700, 1, 2], [960, 2, 3]]) {
      const yy = AN.y0 - AN.riser * anK(x) - AN.D;
      anBanner(g, tf, x, yy - 4, 150 + 20 * (k % 2), 120, sd, k % 2 ? ['#3a141c', '#4a1c22', '#3a141c'] : ['#1a2030', '#4a3a24', '#1a2030']);
    }
    anLeaves(g, tf, 26, 11, [0, 120, W, 520], 1);
    // 她：每 0.045 秒片内时间一张定格，身后两三个淡淡的残影
    const u = clamp(a2 / 1.87), ax = 694 + 30 * easeOut(u), ay = AN_SLOPE(ax), qi = Math.min(8, Math.floor((ts - t4) / 0.045));
    for (let k = 3; k >= 1; k--) {
      const uu = clamp((a2 - k * 0.22) / 1.87), ex = 694 + 30 * easeOut(uu) - k * 10;
      if (a2 - k * 0.22 < -0.3) continue;
      g.globalAlpha = 0.14 * (1 - k * 0.22); blitRot(g, anuP2(Math.max(0, qi - k)), ex, AN_SLOPE(ex));
    }
    g.globalAlpha = 1;
    blitRot(g, anuP2(qi), ax, ay);
    // 他：断 弯身（过渡时现画），义 跪下（两张定格交叠着沉下去）
    const fold = clamp((lt - t5) / 0.5), kneel = clamp((lt - t6) / 0.32);
    const fy0 = anFoot(AN2.jx);
    if (lt < t5) blitRot(g, fatherSpr(0), AN2.jx, fy0);
    else if (fold < 1) blitRot(g, foldSpr(Math.min(7, Math.floor(fold * 8))), AN2.jx, fy0);
    else if (kneel <= 0) blitRot(g, fatherSpr(1), AN2.jx, fy0);
    else {
      // 跪下：新的定格先画实，旧的定格一边下沉一边淡掉（不会两张都半透明）
      const e = easeInOut(kneel);
      blitRot(g, fatherSpr(2), AN2.jx, fy0 - 10 * (1 - e));
      if (e < 1) { g.globalAlpha = 1 - e; blitRot(g, fatherSpr(1), AN2.jx, fy0 + 30 * e); g.globalAlpha = 1; }
      if (kneel < 1) add(g, () => glo(g, AN2.jx - 60, anFoot(AN2.jx), 40, '#d8c8ff', 0.3 * (1 - kneel)));
    }
    // 她眼里的紫光（小）；交叠处他的剪影把刀尖盖住
    const hp = F.points('anu', ax, ay, 1.3, 3.3 + qi * 0.045, AN_AO2);
    anEye(g, hp.head[0] + 5, hp.head[1] - 1, 1.3, 1, t);
    V.threads(g, c, { lines: [[hp.head[0] - 60, -160, hp.head[0], hp.head[1] - 12], [hp.handN[0] + 30, -160, hp.handN[0], hp.handN[1]], [hp.handF[0] - 80, -160, hp.handF[0], hp.handF[1]]], color: '#a890ff', width: 0.7, glow: 0.3, sag: 8, wave: 3, alpha: 0.4, pulse: false, seed: 211, time: tf });
    // 葫芦：“断”字从他腰间脱落，慢慢翻着落下，“绝”字摔碎在石阶上
    const gx0 = AN2.jx - 12, gy0 = anFoot(AN2.jx) - 104, gx = AN2.jx - 64, gy = anFoot(gx) - 4;
    if (lt >= t5 && lt < t7) {
      const k = clamp((lt - t5) / (t7 - t5)), px = lerp(gx0, gx, k), py = lerp(gy0, gy - 22, k * k);
      E.gourd(g, { x: px, y: py, s: 0.62, angle: 0.3 * Math.sin(k * 3) - k * 2.2, t: ts, color: '#9a6a34' });
      add(g, () => glo(g, px, py, 22, '#ffd8a0', 0.16));
    }
    if (lt >= t7) {
      const age = lt - t7, sa = age * 0.45;
      add(g, () => {
        glo(g, gx, gy - 8, 90 * (0.5 + 0.5 * Math.exp(-age / 0.2)), '#ffd8a0', 0.65 * Math.exp(-age / 0.25));
        for (let i = 0; i < 25; i++) {
          const an = -PI / 2 + (h2(i, 51) - 0.5) * 2.6, v = 60 + 140 * h2(i, 52), d = Math.min(sa, 0.5);
          glo(g, gx + Math.cos(an) * v * d, gy - 6 + Math.sin(an) * v * d + 300 * d * d, 2.5 + 3 * h2(i, 53), i % 4 ? '#ffd8a0' : '#ff4a4a', 0.75 * (1 - d / 0.5));
        }
      });
      gourdShards(g, ts, gx, gy - 4, age, 1.3, 0.45);
      wineFlow(g, stairPath(gx, 9), age / 0.8 * 0.5, t, 1);
    }
    anLeaves(g, tf, 10, 17, [0, 200, W, 700], 1.4);
    g.restore();
    fgLeaves(g, tf, 1180, 760, 1.5, 0.9);
  }
  // 前景墨叶：几片宽叶从角上伸进来，随风摆
  function fgLeaves(g, t, x, y, s, a) {
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = a;
    g.fillStyle = '#07060a';
    for (let k = 0; k < 7; k++) {
      const an = -PI / 2 - 0.5 - k * 0.22 + 0.06 * Math.sin(t * 2.3 + k), L = 150 + 50 * h2(k, 3);
      g.save(); g.rotate(an);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -16, L, 0); g.quadraticCurveTo(L * 0.5, 16, 0, 0); g.fill();
      g.restore();
    }
    g.restore();
  }

  // ③ 梦方破：近景阿奴。眼里的紫光“梦”起裂、“破”字像玻璃一样碎掉，丝线同时崩断；短刃从指间滑落，
  // 腕上的铃铛弹起、停在半空一拍才落下，落地一圈涟漪；她抬头转向跪在阶上的父亲，空着的手伸向他，脸上一滴泪
  const P3M = (p) => [-420 + 1.45 * p[0], -120 + 1.45 * p[1]], P3X = (X) => (X + 420) / 1.45;
  const AN3 = { fx: 1000, fy: P3M([0, anFoot(P3X(1000))])[1], ax: 476, ay: 792, as: 2.85 };
  function anP3Scene(q) {
    // 失焦的远景：同一段石阶放大、虚化（烘的时候模糊一次）
    const tmp = document.createElement('canvas'), S = (XYT.sprites && XYT.sprites.S) || 1;
    tmp.width = Math.ceil((W + 2 * PM) * S); tmp.height = Math.ceil((H + 2 * PM) * S);
    const r = tmp.getContext('2d'); r.scale(S, S); r.translate(PM, PM);
    r.fillStyle = K.lin(r, 0, -PM, 0, H + PM, [[0, '#1a1828'], [0.5, '#3a3048'], [1, '#5a4c64']]); r.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
    add(r, () => { glo(r, 1060, 330, 520, '#c88a8a', 0.35); glo(r, 1040, 340, 200, '#f0c0b0', 0.3); });
    E.clouds(r, { t: 4, y: 160, color: '#9a8cac', shade: '#3a3248', alpha: 0.6, scale: 1.4, speed: 0, n: 5, seed: 66, spread: 120, lightX: 1010 });
    r.save(); r.translate(-420, -120); r.scale(1.45, 1.45);
    inkRidge(r, { y: 470, h: 120, seed: 71, w: 120, col: '#4a4058', fog: '#6a5c74', rough: 10 });
    anPalace(r, 1290, AN.y0 - AN.riser * anK(1290) - AN.D, 1.25, '#1e1a26', '#cfc4e8');
    anStairs(r, { stone: '#302a3c', near: '#5a5068', far: '#3a3446' });
    r.restore();
    r.fillStyle = 'rgba(40,32,52,0.3)'; r.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
    q.save(); q.filter = 'blur(2.5px)'; q.drawImage(tmp, -PM, -PM, W + 2 * PM, H + 2 * PM); q.restore();
    q.fillStyle = '#1a1622'; q.fillRect(-900, -900, W + 1800, 900 - PM + 1); q.fillRect(-900, H + PM - 1, W + 1800, 900); q.fillRect(-900, -900, 900 - PM + 1, H + 1800); q.fillRect(W + PM - 1, -900, 900, H + 1800);
    vignette(q, 0.55, '#07060c', PM);
  }
  // 父亲跪在高处的阶上拄剑、低着头；身边碎葫芦（缓存）
  function anP3Father(q) {
    const { fx, fy } = AN3, ko = { pose: 'kneel', prop: 'sword', facing: -1, tone: 'silhouette', ink: '#221e2a', rim: '#ecdcf0', light: [1060, 330], wind: 0.5, windDir: -1, head: 0.45 };
    F.draw(q, 'jiujianxian', fx, fy, 1.5, 3, ko);
    const kp = F.points('jiujianxian', fx, fy, 1.5, 3, ko).gourdMouth;
    if (kp) { q.fillStyle = '#221e2a'; q.beginPath(); q.ellipse(kp[0], kp[1] + 13, 12, 17, 0, 0, TAU); q.fill(); }
    gourdShards(q, 3, fx - 70, fy + 4, 2, 1.5, 1);
  }
  function anPanel3(g, c, T) {
    const t = c.t, lt = c.lt, t8 = T(8), t9 = T(9), t10 = T(10);
    const beat = (c.b && c.b.period) || 0.833;
    camPlate(g, c, 'an3b', 1, { rot: -0.12, z0: 1.06, z: 1.04 + 0.04 * clamp((lt - t8) / 2.8), cx: 560, cy: 380, amp: 1.6, kick: 3 * kickOf(lt, [t10], 0.15) }, anP3Scene);
    anLeaves(g, t, 12, 23, [0, 60, W, 640], 0.6);
    const { fx, fy, ax, ay, as } = AN3;
    blitRot(g, rotSprite('an-father3c', -0.12, 1.06, [-240, -300, 200, 40], (q) => { q.translate(-AN3.fx, -AN3.fy); anP3Father(q); }), AN3.fx, AN3.fy);
    // 顺着台阶往下爬的那一线红（接上一格，继续往下流）
    wineFlow(g, stairPath(P3X(fx - 70), 7, P3M), 0.3 + 0.12 * (lt - t8), t, 1.25);
    // 阿奴：先失神低头；“破”字后抬头、转向他，空着的手伸过去
    const look = easeInOut(clamp((lt - t10 - 0.35) / 0.5)), reach = clamp((lt - 5.3) / 0.2);
    const ao = { pose: 'stand', facing: 1, wind: 0.8, windDir: -1, rim: '#e8e0ff', light: [1060, 330], rimWidth: 1.2, head: 0.32 - 0.42 * look, lean: 0.02 - 0.05 * look };
    const ap = F.points('anu', ax, ay, as, t, ao);
    V.threads(g, c, { lines: [[ap.head[0] - 30, -40, ap.head[0], ap.head[1] - 30], [ap.handN[0] + 40, -40, ap.handN[0], ap.handN[1]], [ap.handF[0] - 60, -40, ap.handF[0], ap.handF[1]]], color: '#a890ff', width: 0.9, glow: 0.2, sag: 10, wave: 3, alpha: 0.3, snapIn: t10, snapAt: 0.28, pulse: false, seed: 213 });
    const box = [ax - 260, ay - 560, 560, 600];
    // 轮廓光的便宜做法：先在偏向光源一侧错开两三个像素画一层浅色剪影，再把人画上去，只露出受光一侧的亮边
    const drawAnu = (q, o) => figBuf(q, box, (b) => {
      const o2 = Object.assign({}, o, { rim: null });
      F.draw(b, 'anu', ax + 2.6, ay - 1.4, as, t, Object.assign({}, o2, { tone: 'silhouette', ink: '#cfc4ee' }));
      F.draw(b, 'anu', ax, ay, as, t, o2);
      const p = F.points('anu', ax, ay, as, t, o); eraseHorns(b, p, as, 1); miaoCrown(b, p, as, t, 1, { lit: 0.6 });
    });
    drawAnu(g, reach > 0.5 ? Object.assign({}, ao, { pose: 'embrace', head: ao.head - 0.25, lean: ao.lean - 0.04 }) : ao);
    // 短刃：“破”字之后从指间滑落
    const rel = lt - (t10 + 0.15);
    if (rel < 0) anDagger(g, ap.handN[0], ap.handN[1], PI / 2 - 0.25, as * 0.9);
    else if (rel < 1) anDagger(g, ap.handN[0] + rel * 30, ap.handN[1] + 0.5 * 1800 * rel * rel, PI / 2 - 0.25 + rel * 5, as * 0.9, 1 - smooth((rel - 0.6) / 0.4));
    // 眼里的紫光：“梦”字起裂，“破”字碎
    const hp = F.points('anu', ax, ay, as, t, ao), ex = hp.head[0] + 6.5 * as, ey = hp.head[1] - 1.2 * as;
    if (lt < t10) anEye(g, ex, ey, as * 0.9, 1, t);
    V.shatter(g, c, { x: ex, y: ey, r: 18, n: 14, at: t10, crack: t10 - t8, dur: 1.3, kind: 'light', color: '#b0a4e3', edge: '#ffffff', force: 160, gravity: 120, seed: 117 });
    if (lt >= t10) add(g, () => glo(g, ex, ey, 5, '#ffffff', 0.35 * look));
    // 泪：她看清了他
    V.tear(g, c, { x: ex + 3, y: ey + 9, at: 5.85, s: 2.2, len: 60, angle: PI / 2 + 0.15, dur: 1.2, color: '#eef6ff' });
    // 铃铛：从腕上弹起，停在半空一拍，再落到阶上，叮的一圈涟漪
    const b0 = t10 + 0.05, up = 0.22, hold = beat, landY = 690;
    if (lt > b0) {
      const bx0 = ap.handN[0] + 6, by0 = ap.handN[1] - 6, a1 = lt - b0;
      let bx = bx0 + 34, by = by0 - 120, sw = 0, landed = -1;
      if (a1 < up) { const k = a1 / up; bx = bx0 + 34 * k; by = by0 - 120 * easeOut(k); }
      else if (a1 > up + hold) { const k = a1 - up - hold; by += 0.5 * 1600 * k * k; bx += 30 * k; sw = k * 6; if (by >= landY) { landed = (by - landY) / 600 + k - Math.sqrt(2 * (landY - (by0 - 120)) / 1600); by = landY; sw = 1.2; } }
      const frozen = a1 > up && a1 < up + hold;
      if (frozen) add(g, () => { const k = (a1 - up) / hold; for (let r = 0; r < 2; r++) { const q = (k * 1.6 + r * 0.5) % 1; g.strokeStyle = rgba('#e8e4ff', 0.5 * (1 - q)); g.lineWidth = 1.4; g.beginPath(); g.arc(bx, by, 10 + q * 46, 0, TAU); g.stroke(); } glo(g, bx, by, 36, '#d8d0ff', 0.35); });
      if (landed >= 0) { const la = Math.max(0, landed); add(g, () => { for (let r = 0; r < 3; r++) { const q = clamp(la * 1.4 - r * 0.18); if (q <= 0 || q >= 1) continue; g.strokeStyle = rgba('#e8e4ff', 0.55 * (1 - q)); g.lineWidth = 1.3; g.beginPath(); g.ellipse(bx, by + 8, 12 + q * 90, 3 + q * 18, 0, 0, TAU); g.stroke(); } glo(g, bx, by + 6, 30, '#d8d0ff', 0.4 * Math.exp(-la * 3)); }); }
      g.save(); g.translate(bx, by); g.rotate(sw + (frozen || landed >= 0 ? 0 : Math.sin(a1 * 12) * 0.3)); g.scale(2, 2);
      g.fillStyle = K.lin(g, -6, 0, 6, 0, [[0, '#8a90a0'], [0.4, '#f4f6fa'], [1, '#6a7080']]);
      g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-6, -6, 0, -6); g.quadraticCurveTo(6, -6, 6, 4); g.closePath(); g.fill();
      g.fillStyle = '#3a3a48'; g.fillRect(-4, 2.6, 8, 1.4);
      g.strokeStyle = '#c9314a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -11); g.stroke();
      g.restore();
      if (frozen) add(g, () => glo(g, bx - 2, by - 4, 5, '#ffffff', 0.9));
    }
    anLeaves(g, t, 8, 29, [0, 100, W, 720], 0.9);
    g.restore();
  }

  // =====================================================================
  // 35 塔中符牢：路荒遗叹｜饱览足迹｜没人懂
  // =====================================================================
  const TW_T = [0.24, 0.64, 1.04, 1.44, 2.26, 2.68, 3.1, 3.52, 3.92, 4.36, 4.8];
  const TW_COL = ['#eacd76', '#ff4c00', '#48c0a3'];
  const TW_GATE = { x: 520, top: 330, spring: 452, w: 262, y: 640, wall: 288 };

  // 铁链（整条批量画，不逐节 save/restore）：正面的环与侧面的扁环交替，受光一侧一点高光
  function chain(g, x0, y0, x1, y1, sag, s, o = {}) {
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.floor(L / (11 * s)));
    const P = (u) => [lerp(x0, x1, u), lerp(y0, y1, u) + sag * 4 * u * (1 - u)];
    const col = o.col || '#2a2c34', hi = o.hi || '#9fb6c8', ha = o.hiA ?? 0.6, rx = 7.5 * s, ry = 4.2 * s;
    const ring = new Path2D(), flat = new Path2D(), hiR = new Path2D(), hiF = new Path2D();
    let [ax, ay] = P(0);
    for (let i = 0; i < n; i++) {
      const [bx, by] = P((i + 1) / n), an = Math.atan2(by - ay, bx - ax), mx = (ax + bx) / 2, my = (ay + by) / 2, c = Math.cos(an), sn = Math.sin(an);
      const ep = (th) => [mx + rx * Math.cos(th) * c - ry * Math.sin(th) * sn, my + rx * Math.cos(th) * sn + ry * Math.sin(th) * c];
      if (i % 2 === 0) {
        ring.moveTo(...ep(0)); ring.ellipse(mx, my, rx, ry, an, 0, TAU);
        hiR.moveTo(...ep(PI * 1.1)); hiR.ellipse(mx, my, rx, ry, an, PI * 1.1, PI * 1.6);
      } else {
        flat.moveTo(mx - c * rx, my - sn * rx); flat.lineTo(mx + c * rx, my + sn * rx);
        hiF.moveTo(mx - c * rx * 0.66 + sn * 0.9 * s, my - sn * rx * 0.66 - c * 0.9 * s); hiF.lineTo(mx + c * rx * 0.66 + sn * 0.9 * s, my + sn * rx * 0.66 - c * 0.9 * s);
      }
      ax = bx; ay = by;
    }
    g.lineCap = 'butt'; g.strokeStyle = col;
    g.lineWidth = 2.6 * s; g.stroke(ring);
    g.lineWidth = 2.8 * s; g.stroke(flat);
    g.strokeStyle = rgba(hi, ha); g.lineWidth = 1 * s; g.stroke(hiR);
    g.strokeStyle = rgba(hi, ha * 0.8); g.lineWidth = 0.9 * s; g.stroke(hiF);
    g.lineCap = 'round';
  }
  // 符纸：黄纸，顶上朱砂“敕令”记号，一竖列卷曲的符文，纸边与下端撕得不齐
  function talTex() {
    return C('tw-tal3', 24, 72, 2.5, (q) => {
      const r = A.rng(17);
      q.beginPath(); q.moveTo(2, 1.5); q.lineTo(22, 1);
      for (let i = 1; i <= 10; i++) q.lineTo(22 + (r() - 0.5) * 1.6, 1 + i * 6.4);
      for (let i = 1; i <= 7; i++) q.lineTo(22 - i * 2.86, 66 + (r() - 0.5) * 6 + (i % 2) * 2.5);
      for (let i = 10; i >= 1; i--) q.lineTo(2 + (r() - 0.5) * 1.6, 1 + i * 6.4);
      q.closePath();
      q.fillStyle = K.lin(q, 0, 0, 0, 72, [[0, '#f4dc78'], [0.7, '#e2bc56'], [1, '#c89a3a']]); q.fill();
      q.save(); q.clip(); A.softBlob(q, 16, 54, 14, 0.3, '#a8782a'); A.softBlob(q, 6, 20, 8, 0.15, '#a8782a'); q.restore();
      q.strokeStyle = '#b02a1c'; q.lineCap = 'round'; q.lineJoin = 'round';
      // 敕令：两三笔横、一竖、一撇一捺
      q.lineWidth = 1.5; q.beginPath(); q.moveTo(6, 6); q.lineTo(18, 5.5); q.moveTo(7.5, 9.5); q.lineTo(16.5, 9.2); q.moveTo(12, 3.5); q.lineTo(12, 14); q.moveTo(11.5, 14); q.quadraticCurveTo(8, 16, 6, 17.5); q.moveTo(12.5, 14); q.quadraticCurveTo(16, 16, 18, 17.5); q.stroke();
      // 符文：一列卷曲的曲笔与小圈
      q.lineWidth = 1.15; q.beginPath();
      for (let j = 0; j < 6; j++) { const y = 21 + j * 7.4; q.moveTo(7, y); q.bezierCurveTo(18, y - 2.5, 5, y + 4, 16.5, y + 5); if (j % 2) { q.moveTo(15.5, y + 1); q.arc(12.5, y + 1.5, 2.6, 0, PI * 1.5); } }
      q.stroke();
      q.fillStyle = 'rgba(176,42,28,0.85)'; q.fillRect(9.5, 58, 5.5, 4.5);
    });
  }
  const talGlow = (col) => C('tw-talg' + col, 60, 110, 1, (q) => A.softBlob(q, 30, 55, 32, 0.65, col));
  // (x, y) 为符的上端；glowCol 给了就在纸后亮一团光；burn 0..1 自下而上烧掉
  function talisman(g, x, y, s, rot, glowCol, ga, burn) {
    g.save(); g.translate(x, y); g.rotate(rot);
    if (glowCol && ga > 0) { const p0 = g.globalAlpha; g.globalAlpha = p0 * clamp(ga) * 0.75; g.globalCompositeOperation = 'lighter'; g.drawImage(talGlow(glowCol), -30 * s, -18 * s, 60 * s, 110 * s); g.globalCompositeOperation = 'source-over'; g.globalAlpha = p0; }
    const b = burn || 0;
    if (b > 0) { const hh = 72 * s * (1 - 0.8 * b); g.beginPath(); g.rect(-13 * s, -2 * s, 26 * s, hh + 2 * s); g.save(); g.clip(); g.drawImage(talTex(), -12 * s, 0, 24 * s, 72 * s); g.restore(); add(g, () => glo(g, 0, hh, 16 * s, '#ff7a2a', 0.9)); g.fillStyle = '#2a120a'; g.fillRect(-12 * s, hh - 2 * s, 24 * s, 2.5 * s); }
    else g.drawImage(talTex(), -12 * s, 0, 24 * s, 72 * s);
    g.restore();
  }
  // 塔基石墙：大小、高低都不齐的毛石（圆角、上亮下暗、缝里深），墨色水渍、湿亮与暗的雨痕、墙脚与石缝里的青苔
  function towerStones(q, x0, y0, x1, y1, seed, o = {}) {
    const r = A.rng(seed), stone = o.stone || '#262e3a';
    q.save(); q.beginPath(); q.rect(x0, y0, x1 - x0, y1 - y0); q.clip();
    q.fillStyle = o.joint || '#06080c'; q.fillRect(x0, y0, x1 - x0, y1 - y0);
    let y = y1;
    while (y > y0 - 60) {
      const bh = 26 + 46 * r(); let x = x0 - r() * 90;
      while (x < x1) {
        const bw = 36 + 130 * r(), tone = r(), dy = (r() - 0.5) * 8, hh = bh * (0.82 + 0.2 * r()), rr = 4 + 8 * r();
        const c0 = mix(stone, tone < 0.55 ? '#000000' : '#7a8698', tone < 0.55 ? 0.6 * (0.55 - tone) / 0.55 : 0.3 * (tone - 0.55) / 0.45);
        const xa = x + 2 + r() * 2, xb = x + bw - 2 - r() * 2, ya = y - hh + dy, yb = y - 2 + dy * 0.5;
        q.fillStyle = K.lin(q, 0, ya, 0, yb, [[0, mix(c0, '#9aa8b8', 0.12)], [1, mix(c0, '#000000', 0.35)]]);
        q.beginPath(); q.moveTo(xa + rr, ya); q.lineTo(xb - rr, ya + (r() - 0.5) * 3); q.quadraticCurveTo(xb, ya, xb, ya + rr); q.lineTo(xb + (r() - 0.5) * 3, yb - rr); q.quadraticCurveTo(xb, yb, xb - rr, yb); q.lineTo(xa + rr, yb + (r() - 0.5) * 2); q.quadraticCurveTo(xa, yb, xa, yb - rr); q.lineTo(xa + (r() - 0.5) * 3, ya + rr); q.quadraticCurveTo(xa, ya, xa + rr, ya); q.fill();
        if (r() < 0.3) { q.strokeStyle = rgba('#000000', 0.45); q.lineWidth = 1; q.beginPath(); const cx = xa + (xb - xa) * r(); q.moveTo(cx, ya + 2); q.lineTo(cx + (r() - 0.5) * 14, ya + hh * 0.6); q.stroke(); }
        x += bw + 3 + r() * 4;
      }
      y -= bh + 3;
    }
    // 墨色水渍
    for (let k = 0; k < 8; k++) { q.globalAlpha = 0.3 + 0.2 * r(); q.drawImage(tint(splashTex(81 + (k % 5)), '#020305'), x0 + r() * (x1 - x0) - 300, y0 + r() * (y1 - y0) - 160, 500 + 400 * r(), 260 + 200 * r()); }
    // 雨痕：暗的和湿亮的竖笔
    const sb = tint(brushTex(5), '#030408'), sl = tint(brushTex(4, true), o.wet || '#8aa4c0');
    for (let k = 0; k < 34; k++) { const lite = k % 4 === 0; q.globalAlpha = lite ? 0.08 + 0.08 * r() : 0.2 + 0.2 * r(); putR(q, lite ? sl : sb, x0 + r() * (x1 - x0), y0 + 40 + r() * (y1 - y0 - 80), 90 + 220 * r(), lite ? 5 : 10 + 6 * r(), PI / 2 + (r() - 0.5) * 0.08); }
    // 青苔：墙脚一片，石缝里几点
    q.globalAlpha = 1;
    for (let k = 0; k < 60; k++) { const px = x0 + r() * (x1 - x0), py = y1 - Math.pow(r(), 2.2) * (y1 - y0) * 0.7; A.softBlob(q, px, py, 5 + 16 * r(), 0.22 + 0.25 * r(), r() < 0.5 ? (o.moss || '#2a4a34') : '#3a5a3a'); }
    q.fillStyle = K.lin(q, 0, y0, 0, y0 + 140, [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]); q.fillRect(x0, y0, x1 - x0, 140);
    q.globalAlpha = 1;
    q.restore();
  }
  // ① 塔门底版：雷雨夜。锁妖塔的塔身一层层压在塔基石墙之上，墙中拱门、门上匾、门前湿亮的石阶
  function twGatePlate() {
    return plate('tw1b', 1, (q) => {
      const G = TW_GATE;
      base(q, '#05070c');
      E.sky(q, { y0: -PM, y1: 660, stops: [[0, '#03050a'], [0.45, '#0c1424'], [1, '#18283a']] });
      add(q, () => { glo(q, 1010, 40, 420, '#3a5a8a', 0.3); });
      inkClouds(q, [[200, 40, 1000, 420, 21, 0.85], [1050, 20, 700, 380, 23, 0.7]]);
      inkRidge(q, { y: 620, h: 250, seed: 91, w: 70, karst: true, col: '#0c121c', fog: '#16243a', rim: '#4a6a8a', rimA: 0.35, lightDir: 1 });
      E.mist(q, { t: 0, y: 600, h: 90, color: '#2a3a52', alpha: 0.5, speed: 0, seed: 9 });
      // 塔身：从墙后升起，一层层出檐，窗里幽绿
      E.tower(q, { x: G.x - 10, y: G.wall + 170, h: 700, t: 3, color: '#121822', rim: '#7a9ab8', lit: 0.5, glow: '#5ad6a0' });
      // 塔身退进雨夜里一点
      q.fillStyle = K.lin(q, 0, -PM, 0, G.wall, [[0, 'rgba(6,10,18,0.15)'], [1, 'rgba(10,16,28,0.45)']]); q.fillRect(G.x - 400, -PM, 800, G.wall + PM);
      // 塔基石墙
      towerStones(q, -PM, G.wall + 12, 1010, G.y, 33, { stone: '#262e3a', top: '#141820', bot: '#1c222e' });
      q.fillStyle = K.lin(q, 960, 0, 1010, 0, [[0, 'rgba(120,150,190,0)'], [1, 'rgba(120,150,190,0.3)']]); q.fillRect(960, G.wall, 50, G.y - G.wall);
      // 墙头的瓦檐，右端起翘
      q.fillStyle = '#080a10';
      q.beginPath(); q.moveTo(-PM, G.wall - 8); q.lineTo(1000, G.wall - 8); q.quadraticCurveTo(1050, G.wall - 12, 1078, G.wall - 40); q.lineTo(1064, G.wall + 20); q.lineTo(-PM, G.wall + 22); q.closePath(); q.fill();
      q.strokeStyle = rgba('#7a9ab8', 0.45); q.lineWidth = 1.6; q.beginPath(); q.moveTo(-PM, G.wall - 8); q.lineTo(1000, G.wall - 8); q.quadraticCurveTo(1050, G.wall - 12, 1078, G.wall - 40); q.stroke();
      for (let k = 0; k < 24; k++) { q.fillStyle = '#04060a'; q.fillRect(-PM + k * 50, G.wall + 18, 6, 10); }
      // 匾
      q.fillStyle = '#1a1208'; q.fillRect(G.x - 66, G.wall + 30, 132, 40);
      q.strokeStyle = '#8a6a2a'; q.lineWidth = 2; q.strokeRect(G.x - 62, G.wall + 33, 124, 34);
      E.util.glyphs(q, '锁妖塔', G.x, G.wall + 51, 24, '#c8a050');
      // 拱门与门洞里的黑、门里渗出的妖气幽光
      const arch = () => { q.beginPath(); q.moveTo(G.x - G.w / 2, G.y); q.lineTo(G.x - G.w / 2, G.spring); q.arc(G.x, G.spring, G.w / 2, PI, 0); q.lineTo(G.x + G.w / 2, G.y); q.closePath(); };
      q.fillStyle = '#020305'; arch(); q.fill();
      q.save(); arch(); q.clip();
      q.fillStyle = K.lin(q, 0, G.top, 0, G.y, [[0, '#010203'], [1, '#04100c']]); q.fillRect(G.x - G.w, G.top, G.w * 2, G.y - G.top);
      add(q, () => { glo(q, G.x, G.y - 30, 150, '#1a5a4a', 0.18); glo(q, G.x + 30, G.y - 150, 60, '#2a8a6a', 0.1); });
      q.restore();
      q.strokeStyle = '#2a3242'; q.lineWidth = 16; arch(); q.stroke();
      q.strokeStyle = rgba('#7a9ab8', 0.35); q.lineWidth = 2; q.beginPath(); q.arc(G.x, G.spring, G.w / 2 + 8, PI * 1.05, PI * 1.95); q.stroke();
      // 门两侧旧符
      q.globalAlpha = 0.6;
      for (let k = 0; k < 4; k++) talisman(q, G.x - G.w / 2 - 46 - k * 58, G.wall + 60 + (k % 2) * 80, 0.95, (h2(k, 3) - 0.5) * 0.3, null, 0, 0);
      q.globalAlpha = 1;
      // 门前三级湿亮的石阶、石台
      q.fillStyle = K.lin(q, 0, G.y, 0, H + PM, [[0, '#1a2230'], [1, '#05070a']]); q.fillRect(-PM, G.y, W + 2 * PM, H - G.y + PM);
      for (let k = 0; k < 3; k++) { const y = G.y + 2 + k * 22, x0 = G.x - G.w / 2 - 60 - k * 40, x1 = G.x + G.w / 2 + 120 + k * 40; q.fillStyle = mix('#1e2836', '#0a0e14', k / 3); q.fillRect(x0, y, x1 - x0, 22); q.fillStyle = rgba('#9ab4d0', 0.3 - k * 0.07); q.fillRect(x0, y, x1 - x0, 1.6); }
      add(q, () => { glo(q, G.x, G.y + 30, 200, '#1a5a4a', 0.2); });
      for (let k = 0; k < 6; k++) { const x = 140 + k * 190 + h2(k, 31) * 60, y = G.y + 76 + h2(k, 32) * 30; q.fillStyle = rgba('#6a88a8', 0.18); q.beginPath(); q.ellipse(x, y, 60 + 40 * h2(k, 33), 4 + 3 * h2(k, 34), 0, 0, TAU); q.fill(); }
      vignette(q, 0.6, '#020306', PM);
    });
  }
  // 剑圣：借说书人的身形，换成素白道袍（整个人罩一层白）、白发、长白须，背上斜插一柄剑；须与袖随风
  function swordMaster(g, x, y, s, t, lv) {
    const o = { pose: 'stand', facing: 1, whiteHair: true, prop: 'none', wind: 0.75, windDir: -1, head: 0.1, rim: null };
    const p = F.points('storyteller', x, y, s, t, o);
    figBuf(g, [x - 110 * s, y - 210 * s, 220 * s, 220 * s], (q) => {
      // 背后的剑：剑鞘斜插，剑柄从肩后露出
      const bx = p.back[0], by = p.back[1];
      q.strokeStyle = '#1a1612'; q.lineWidth = 4.4 * s; q.lineCap = 'round'; q.beginPath(); q.moveTo(bx - 34 * s, by + 46 * s); q.lineTo(bx + 16 * s, by - 34 * s); q.stroke();
      q.strokeStyle = '#c8a050'; q.lineWidth = 6 * s; q.beginPath(); q.moveTo(bx + 10 * s, by - 24 * s); q.lineTo(bx + 14 * s, by - 30 * s); q.stroke();
      q.strokeStyle = '#d8d0c0'; q.lineWidth = 2.2 * s; q.beginPath(); q.moveTo(bx + 16 * s, by - 34 * s); q.lineTo(bx + 22 * s, by - 46 * s); q.stroke();
      q.strokeStyle = '#a03424'; q.lineWidth = 1.2 * s; for (let k = 0; k < 3; k++) { q.beginPath(); q.moveTo(bx + 22 * s, by - 46 * s); q.quadraticCurveTo(bx + 12 * s - k * 3 * s, by - 44 * s + Math.sin(t * 5 + k) * 3 * s, bx + 2 * s - k * 5 * s, by - 34 * s + Math.sin(t * 4 + k) * 5 * s); q.stroke(); }
      // 人：先在受光一侧错开画一层亮边，再画人，再整个罩一层素白
      q.globalAlpha = 1;
      F.draw(q, 'storyteller', x + 2 * s, y - 1.2 * s, s, t, Object.assign({}, o, { tone: 'silhouette', ink: mix('#c8d8ee', '#ffffff', lv * 0.6) }));
      F.draw(q, 'storyteller', x, y, s, t, o);
      q.globalCompositeOperation = 'source-atop';
      q.fillStyle = rgba('#dfe5ec', 0.62); q.fillRect(x - 110 * s, y - 210 * s, 220 * s, 220 * s);
      q.fillStyle = K.lin(q, x, y - 180 * s, x, y, [[0, 'rgba(10,14,20,0)'], [1, 'rgba(10,14,20,0.35)']]); q.fillRect(x - 110 * s, y - 210 * s, 220 * s, 220 * s);
      q.globalCompositeOperation = 'source-over';
      // 墨线勾一道身后的轮廓（暗面）
      // 长白须：自下巴垂下，几缕随风
      const mx = p.mouth[0], my = p.mouth[1];
      q.strokeStyle = rgba('#f0ece4', 0.95); q.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const L = (26 + 10 * h2(k, 7)) * s, sw = Math.sin(t * 2.4 + k * 0.8) * 4 * s - 7 * s;
        q.lineWidth = (2.6 - k * 0.3) * s; q.beginPath(); q.moveTo(mx - 2 * s + k * 0.8 * s, my + 2 * s);
        q.bezierCurveTo(mx + k * s, my + L * 0.4, mx + sw * 0.5 - k * s, my + L * 0.7, mx + sw - k * 1.5 * s, my + L); q.stroke();
      }
    });
  }

  XYT.registerShot('c2_tower', {
    name: '塔中符牢', zone: 'right', night: true, text: '#e9f1f6', shadow: 'rgba(4,8,14,0.92)', accent: '#eacd76', bloom: 0.45,
    draw(g, c) {
      const T = (k) => chT(c, k, TW_T);
      if (c.lt < T(4)) twPanel1(g, c, T);
      else if (c.lt < T(8)) twPanel2(g, c, T);
      else twPanel3(g, c, T);
    },
  });
  // 风里飘过的雨云：两三块拉长的泼墨
  function twWisps(g, t) {
    for (const [y, w, h, sd, al, sp] of [[230, 760, 110, 85, 0.35, 60], [120, 640, 90, 86, 0.3, 40]]) {
      const x = ((1600 - t * sp + sd * 61) % 2100) - 420;
      g.globalAlpha = al; g.drawImage(tint(splashTex(sd), '#1e2a3e'), x, y - h / 2, w, h);
    }
    g.globalAlpha = 1;
  }

  // ① 路荒遗叹：闪电照亮塔门前剑圣的背影，他不回头；逍遥一路走来（步子踩实），“叹”字跃起一剑劈断门上的锁链，冲进门里的黑
  function twPanel1(g, c, T) {
    const t = c.t, lt = c.lt, G = TW_GATE, tS = T(3);
    cam(g, c, { z: 1.03 + 0.03 * clamp(lt / 2.2), cx: 600, cy: 420, amp: 2.4, kick: 6 * kickOf(lt, [tS], 0.2) });
    putPlate(g, twGatePlate());
    twWisps(g, t);
    const lv = bolt(g, c, { at: [T(0) - 0.05, tS + 0.02], xs: [1010, 985], y0: -60, y1: 560, drift: -60, color: '#d8e4ff', flash: 0.75, seed: 71, width: 1.2, life: 0.45 });
    // 门洞里的妖气一缕缕往外渗
    add(g, () => { for (let i = 0; i < 6; i++) { const ph = (lt * 0.3 + h2(i, 9)) % 1; glo(g, G.x + (h2(i, 8) - 0.5) * 150 + Math.sin(lt + i) * 20, G.y - 40 - ph * 230, 50 + 40 * ph, '#2a9a7a', 0.07 * Math.sin(PI * ph)); } });
    // 锁链：交叉成 X 加一道横；“叹”字被劈断，各截垂下摆动
    const cut = lt >= tS, ca = lt - tS;
    const ends = [[G.x - G.w / 2 + 8, G.spring - 90, G.x + G.w / 2 - 8, G.y - 20], [G.x + G.w / 2 - 8, G.spring - 90, G.x - G.w / 2 + 8, G.y - 20], [G.x - G.w / 2 + 8, 520, G.x + G.w / 2 - 8, 520]];
    const hiC = lv > 0.05 ? '#e8f0ff' : '#8aa4c0';
    for (const [x0, y0, x1, y1] of ends) {
      if (!cut) { chain(g, x0, y0, x1, y1, 14, 1.2, { hi: hiC }); continue; }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (const [ax, ay] of [[x0, y0], [x1, y1]]) {
        const L = Math.hypot(mx - ax, my - ay) * 0.92, a0 = Math.atan2(my - ay, mx - ax), sw = PI / 2 + (a0 - PI / 2) * Math.exp(-ca * 2.2) * Math.cos(ca * 7);
        const an = lerp(a0, sw, Math.min(1, ca * 3));
        chain(g, ax, ay, ax + Math.cos(an) * L, ay + Math.sin(an) * L, 6, 1.2, { hi: hiC });
      }
    }
    { const lx = G.x, ly0 = 516; let ly = ly0, rot = 0; if (cut) { ly = Math.min(G.y - 14, ly0 + 0.5 * 1800 * ca * ca); rot = Math.min(1.2, ca * 4); }
      g.save(); g.translate(lx, ly); g.rotate(rot); g.fillStyle = '#2a2a30'; g.fillRect(-18, -12, 36, 30); g.strokeStyle = '#2a2a30'; g.lineWidth = 5; g.beginPath(); g.arc(0, -12, 11, PI, 0); g.stroke(); g.fillStyle = rgba(hiC, 0.5); g.fillRect(-16, -10, 32, 2); g.restore(); }
    // 门上的符：风里抖；被劈的那一刻着火，卷着飞走
    for (let k = 0; k < 6; k++) {
      const x = G.x - 100 + k * 40, y = G.spring - 60 + (k % 2) * 80, sw = 0.12 * Math.sin(t * 6 + k * 1.7);
      if (!cut) talisman(g, x, y, 0.9, sw, null, 0, 0);
      else { const fa = ca * (0.8 + 0.4 * h2(k, 5)); if (fa < 1.4) talisman(g, x - fa * 120 * (0.5 + h2(k, 6)), y - fa * 160 + fa * fa * 40, 0.9, sw + fa * 3, null, 0, clamp(fa * 0.8)); }
    }
    // 剑圣：站在门前石阶上、挡住半边门，面朝风雨，不回头；闪电时身上一亮
    swordMaster(g, 712, G.y + 3, 1.42, t, lv);
    if (lv > 0.02) add(g, () => glo(g, 730, G.y - 130, 140, '#e8f0ff', 0.32 * lv));
    // 逍遥：按步速走来（脚不滑），跃起举剑，“叹”字劈下，再冲进门里，越走越小、没进黑里
    const ws = F.walkSpeed('xiaoyao', 1.3, { speed: 2.4 }), tA = tS - 0.3, xA = 352;
    let xs, xsz = 1.3, xy = G.y + 4, pose, into = 0;
    if (lt < tA) { xs = xA - ws * (tA - lt); pose = 'walk'; }
    else if (lt < tS) { xs = xA + 10 * (lt - tA) / 0.3; pose = 'swordUp'; xy -= 30 * Math.sin(clamp((lt - tA) / 0.3) * PI); }
    else if (lt < tS + 0.3) { xs = xA + 10; pose = 'swordPoint'; }
    else {
      // 冲进门：缩放随距离变小，x 按当前缩放下的步速积分（脚不滑）
      const T2 = 0.75, u = clamp((lt - tS - 0.3) / T2), tau = u * T2, s0 = 1.3, s1 = 0.86, k1 = F.walkSpeed('xiaoyao', 1, { speed: 3.2 });
      xsz = lerp(s0, s1, u); xs = xA + 10 + k1 * (s0 * tau + 0.5 * (s1 - s0) * tau * tau / T2); xy = G.y + 4 - 8 * u; pose = 'walk'; into = u;
    }
    const xo = { pose, facing: 1, speed: lt < tA ? 2.4 : 3.2, lean: pose === 'walk' ? 0.12 : 0, rim: mix('#8ab8e8', '#ffffff', lv), light: [1010, 60], wind: 0.9, windDir: -1, alpha: 1 - 0.95 * smooth(into) };
    if (into > 0) Object.assign(xo, { tone: 'silhouette', ink: '#0a0c12' });
    F.draw(g, 'xiaoyao', xs, xy, xsz, t, xo);
    if (cut) {
      V.swordQi(g, c, { kind: 'slash', at: tS, x: G.x - 170, y: G.spring - 110, x2: G.x + 190, y2: G.y, color: '#bfe8ff', r: 14, dur: 0.6 });
      V.sparks(g, c, { at: tS + 0.04, x: G.x, y: 520, n: 40, speed: 620, color: '#ffd890', spread: TAU, size: 1.2 });
    }
    V.rain(g, c, { n: 140, angle: 0.18, speed: 1100, color: '#a8c0dc', alpha: 0.42, ground: G.y + 10, depth: 70 });
    g.restore();
  }

  // ② 饱览足迹：每个字硬切一层符牢（金、朱、青），泼墨的快切；他一层层往上（站的台阶越来越高、人越来越小）；
  // “迹”字仰望塔心：一圈圈塔檐、斗拱与垂下的符穗，三色的符纸螺旋着升上去
  const TW_FLOORS = [
    { rot: 0.1, x: 430, y: 655, s: 1.55, pose: 'swordUp', face: 1, cx: 640, cy: 400 },
    { rot: -0.13, x: 500, y: 560, s: 1.3, pose: 'swordPoint', face: 1, cx: 640, cy: 400 },
    { rot: 0.07, x: 700, y: 470, s: 1.1, pose: 'swordPoint', face: -1, cx: 640, cy: 380 },
  ];
  // 塔室：内墙一圈拱形牢龛（龛里妖影两点眼光）、龛前竖栅；他脚下一段往右上盘的石阶；k 0 金（栅栏贴满封条）、1 朱（龛里火光）、2 青（水漫过地、墙上冰霜）
  function twFloorScene(k) {
    return (q) => {
      const col = TW_COL[k], dk = ['#1e1606', '#22080a', '#061c18'][k], r = A.rng(300 + k), P = TW_FLOORS[k];
      q.fillStyle = K.lin(q, 0, -PM, 0, H + PM, [[0, '#04050a'], [0.6, mix(dk, '#05060a', 0.3)], [1, '#020204']]); q.fillRect(-700, -700, W + 1400, H + 1400);
      add(q, () => { glo(q, 640 + (k - 1) * 200, 330, 620, col, 0.12); });
      inkClouds(q, [[200 + k * 300, 200, 1100, 700, 11 + k, 0.8], [1000 - k * 200, 560, 1000, 600, 14 + k, 0.7]]);
      const n = 6, cx0 = 640 + (k === 1 ? -80 : 60);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n - 0.5, x = cx0 + u * 1250, y = 330 + Math.abs(u) * 60 - (k === 1 ? 30 : 0) - k * 30, w = 150 * (1 - Math.abs(u) * 0.5), h = 230 * (1 - Math.abs(u) * 0.4);
        q.fillStyle = '#0c0e14'; q.fillRect(x - w / 2 - 14, y - h / 2 - 20, w + 28, h + 40);
        q.fillStyle = '#020204'; q.beginPath(); q.moveTo(x - w / 2, y + h / 2); q.lineTo(x - w / 2, y - h / 2 + w / 2); q.arc(x, y - h / 2 + w / 2, w / 2, PI, 0); q.lineTo(x + w / 2, y + h / 2); q.closePath(); q.fill();
        if (k === 1) add(q, () => { glo(q, x, y + h * 0.3, w * 0.7, '#ff4c00', 0.35); glo(q, x, y + h * 0.38, w * 0.3, '#ffb04a', 0.5); });
        q.fillStyle = mix(dk, '#000000', 0.2); A.inkBlob(q, x + (r() - 0.5) * 20, y + h * 0.12, w * 0.32, 40 + i + k * 7, 0.4); q.fill();
        add(q, () => { for (const sd of [-1, 1]) glo(q, x + sd * w * 0.09 + (r() - 0.5) * 6, y - h * 0.02, 7, k === 1 ? '#ff2a1a' : col, 0.85); });
        q.strokeStyle = k === 0 ? '#3a2e14' : '#1a1c24'; q.lineWidth = 5;
        for (let b = -2; b <= 2; b++) { q.beginPath(); q.moveTo(x + b * w * 0.2, y - h / 2 + 12); q.lineTo(x + b * w * 0.2, y + h / 2); q.stroke(); }
        q.strokeStyle = rgba(col, k === 0 ? 0.55 : 0.25); q.lineWidth = 1.2;
        for (let b = -2; b <= 2; b++) { q.beginPath(); q.moveTo(x + b * w * 0.2 + 2, y - h / 2 + 12); q.lineTo(x + b * w * 0.2 + 2, y + h / 2); q.stroke(); }
        if (k === 0) {
          // 金层：栅栏上交叉的封条与一枚圆封
          q.save(); q.translate(x, y); q.rotate(0.6); q.fillStyle = rgba('#e8c860', 0.85); q.fillRect(-w * 0.6, -6, w * 1.2, 12); q.rotate(-1.2); q.fillRect(-w * 0.6, -6, w * 1.2, 12); q.restore();
          q.fillStyle = '#b02a1c'; q.beginPath(); q.arc(x, y, 14, 0, TAU); q.fill(); q.strokeStyle = '#f0d070'; q.lineWidth = 1.5; q.beginPath(); q.arc(x, y, 10, 0, TAU); q.stroke();
        }
      }
      if (k === 2) {
        // 青层：墙上的冰霜，一道道斜的冷亮
        for (let i = 0; i < 40; i++) { q.strokeStyle = rgba('#bdeee9', 0.08 + 0.12 * r()); q.lineWidth = 1 + 2 * r(); const x = r() * W, y = r() * 520; q.beginPath(); q.moveTo(x, y); q.lineTo(x + 20 + 40 * r(), y - 30 - 50 * r()); q.lineTo(x + 30 + 30 * r(), y - 10); q.stroke(); }
      }
      // 他脚下的石阶：往右上盘，一级级
      const sx0 = P.x - 360, sy0 = P.y + 80, tread = 70 * P.s / 1.55, riser = 26 * P.s / 1.55;
      for (let i = 0; i < 14; i++) {
        const x = sx0 + i * tread, y = sy0 - i * riser + (P.x - sx0 > i * tread ? 0 : 0);
        q.fillStyle = mix('#1a1c22', '#0a0b0e', i / 14); q.fillRect(x, y, tread + 1, H + PM - y);
        q.fillStyle = rgba(col, 0.32); q.fillRect(x, y, tread + 1, 1.5);
      }
      if (k === 2) {
        // 水漫过低处的台阶与地面
        q.fillStyle = K.lin(q, 0, 600, 0, H + PM, [[0, 'rgba(10,40,40,0.7)'], [1, 'rgba(2,10,12,0.95)']]); q.fillRect(-PM, 600, W + 2 * PM, H);
        for (let i = 0; i < 10; i++) { q.strokeStyle = rgba('#bdeee9', 0.12); q.lineWidth = 1.2; q.beginPath(); q.ellipse(200 + r() * 900, 640 + r() * 70, 40 + 60 * r(), 4 + 3 * r(), 0, 0, TAU); q.stroke(); }
      }
      vignette(q, 0.7, '#000000', PM);
    };
  }
  // 他在这一层的定格（预转好镜头角度）
  const twHero = (k) => { const P = TW_FLOORS[k]; return rotSprite('tw-hero' + k, P.rot, 1.09, [-150, -330, 170, 20], (q) => F.draw(q, 'xiaoyao', 0, 0, P.s, 3.4, { pose: P.pose, facing: P.face, rim: TW_COL[k], light: [140 * P.face, -500], rimWidth: 1.3, wind: 0.95, windDir: -P.face })); };
  function twPanel2(g, c, T) {
    const t = c.t, lt = c.lt, cuts = [T(4), T(5), T(6), T(7)];
    let k = 0; while (k < 3 && lt >= cuts[k + 1]) k++;
    const age = lt - cuts[k];
    if (k === 3) return twShaft(g, c, age);
    const col = TW_COL[k], P = TW_FLOORS[k];
    camPlate(g, c, 'tw-f' + k, 1, { rot: P.rot, z0: 1.09, z: 1.06 + 0.06 * age, cx: P.cx, cy: P.cy, amp: 4, kick: 8 * Math.exp(-age / 0.12) }, twFloorScene(k));
    // 右边是歌词栏：特效都收在画面 x < 1040 以内
    clipLeft(g, 1040);
    talismanSwirl(g, t, col, 16, 400 + k * 7, 560, 330, 520, 220, 0.85);
    if (k === 1) {
      // 朱层：龛里扑出的红眼妖影
      for (let i = 0; i < 2; i++) {
        const u = easeOut(clamp((age - 0.05 - i * 0.08) / 0.3)), bx = [880, 230][i], by = [300, 330][i], tx = lerp(bx, P.x + (i ? -60 : 90), u * 0.7), ty = lerp(by, P.y - 180, u * 0.7);
        add(g, () => glo(g, tx, ty, 230, '#ff3a1a', 0.32 * u));
        g.globalAlpha = 0.9 * u; g.drawImage(tint(splashTex(91 + i), '#050203'), tx - 160, ty - 90, 320, 180);
        g.globalAlpha = 1;
        const claw = () => { for (let f = 0; f < 3; f++) { g.moveTo(tx + (i ? 60 : -60), ty + (f - 1) * 22); g.quadraticCurveTo(tx + (i ? 110 : -110), ty + (f - 1) * 30 - 10, tx + (i ? 160 : -160), ty + (f - 1) * 40 + 14); } };
        g.lineCap = 'round'; g.strokeStyle = rgba('#ff5a2a', 0.7 * u); g.lineWidth = 10; g.beginPath(); claw(); g.stroke();
        g.strokeStyle = rgba('#050203', 0.95 * u); g.lineWidth = 7; g.beginPath(); claw(); g.stroke();
        add(g, () => { for (const sd of [-1, 1]) glo(g, tx + sd * 16, ty - 10, 10, '#ff2a1a', 0.95 * u); });
      }
      V.embers(g, c, { n: 30, x0: 80, x1: 1000, y: 720, rise: 600, speed: 80, wind: 20, color: '#ff6a2a', size: [1, 4], seed: 31 });
    }
    if (k === 2) V.ripples(g, c, { rain: 6, area: [80, 610, 1000, 700], r: 30, life: 1, flat: 0.2, color: '#bdeee9', alpha: 0.35, seed: 37 });
    blitRot(g, twHero(k), P.x, P.y);
    // 泼墨剑痕：一笔干墨斜扫过画面
    const sw = clamp(age / 0.1), br = tint(slashTex(1 + k), mix(col, '#fff6e0', 0.25)), bk = tint(slashTex(4 + k), '#000000'), fo = 1 - smooth((age - 0.2) / 0.22);
    if (fo > 0) {
      g.save(); g.beginPath(); g.rect(-300, -300, 300 + 1340 * sw, H + 600); g.clip();
      g.globalAlpha = 0.5 * fo; putR(g, bk, 520, 420, 1050, 240, [-0.42, 0.38, -0.25][k] + 0.08);
      add(g, () => { g.globalAlpha = 0.5 * fo; putR(g, br, 500, 330, 980, 150, [-0.42, 0.38, -0.25][k]); });
      g.restore(); g.globalAlpha = 1;
    }
    V.swordQi(g, c, { at: cuts[k] + 0.02, x: P.x + P.face * 60, y: P.y - 170 * P.s / 1.55, angle: [-0.5, -0.7, PI + 0.4][k], dist: 500, r: 120 * P.s / 1.55, color: col, dur: 0.45 });
    V.sparks(g, c, { at: cuts[k] + 0.12, x: P.x + P.face * 240, y: P.y - 300 * P.s / 1.55, n: 36, speed: 480, color: col, hot: '#fff6e0', size: 1.1 });
    talismanSwirl(g, t + 9, col, 6, 500 + k, 560, 420, 600, 280, 1);
    g.restore();
    g.restore();
  }
  // 漫天的符：一张张发光的符纸绕着塔室打旋
  function talismanSwirl(g, t, col, n, seed, cx, cy, rx, ry, a) {
    for (let i = 0; i < n; i++) {
      const z = h2(i, seed), an = h2(i, seed + 1) * TAU + t * (0.4 + 0.6 * z) * (i % 2 ? 1 : -1), rr = 0.5 + 0.6 * h2(i, seed + 2);
      const x = cx + Math.cos(an) * rx * rr, y = cy + Math.sin(an) * ry * rr + Math.sin(t * 2 + i) * 14;
      g.globalAlpha = (a ?? 1) * (0.5 + 0.5 * z);
      talisman(g, x, y, 0.4 + 0.6 * z, Math.sin(t * 3 + i) * 0.5 + an * 0.2, col, 0.6 + 0.4 * Math.sin(t * 5 + i), 0);
    }
    g.globalAlpha = 1;
  }
  // 塔心仰视：一圈圈八角塔檐往上收（暗墨的檐、檐下一排斗拱、垂下的符穗），塔顶一团青白的光
  function twShaftScene(q) {
    const vx = 640, vy = 250;
    q.fillStyle = '#020306'; q.fillRect(-700, -700, W + 1400, H + 1400);
    add(q, () => { glo(q, vx, vy, 420, '#2a4a50', 0.5); });
    const oct = (R, k, cy) => { q.beginPath(); for (let j = 0; j <= 8; j++) { const a = (j / 8) * TAU + PI / 8; q.lineTo(vx + Math.cos(a) * R * k, cy + Math.sin(a) * R * 0.56 * k); } q.closePath(); };
    const tal = talTex();
    for (let i = 11; i >= 0; i--) {
      const R = 34 * Math.pow(1.42, i), cy = vy + R * 0.22, u = i / 11;
      // 檐：外圈墨，内圈更深
      oct(R, 1, cy); q.fillStyle = mix('#18242a', '#040608', u); q.fill();
      oct(R, 0.86, cy); q.fillStyle = mix('#0a1216', '#020304', u); q.fill();
      // 斗拱：檐下一排小方块
      for (let j = 0; j < 24; j++) { const a = (j / 24) * TAU, px = vx + Math.cos(a) * R * 0.9, py = cy + Math.sin(a) * R * 0.504; q.fillStyle = rgba('#2a3a40', 0.7 * (1 - u * 0.5)); q.fillRect(px - R * 0.014, py - R * 0.01, R * 0.028, R * 0.03); }
      // 垂下的符穗
      for (let j = 0; j < 16; j++) { const a = (j / 16) * TAU + i, px = vx + Math.cos(a) * R * 0.84, py = cy + Math.sin(a) * R * 0.47, L = R * 0.12; q.globalAlpha = 0.55 * (1 - u * 0.4); q.drawImage(tal, px - L * 0.17, py, L * 0.34, L); }
      q.globalAlpha = 1;
      // 一道淡淡的干笔檐线
      oct(R, 0.86, cy); q.strokeStyle = rgba('#bdeee9', 0.15); q.lineWidth = 1 + 2 * u; q.stroke();
    }
    // 墨晕：几块压暗的泼墨
    for (let k = 0; k < 4; k++) { q.globalAlpha = 0.35; q.drawImage(tint(splashTex(95 + k), '#010203'), [-200, 800, -100, 700][k], [-100, -60, 420, 460][k], 800, 420); }
    q.globalAlpha = 1;
    add(q, () => { glo(q, vx, vy, 260, '#bdeee9', 0.45); glo(q, vx, vy, 80, '#ffffff', 0.85); });
    vignette(q, 0.7, '#000000', PM);
  }
  function twShaft(g, c, age) {
    const t = c.t, vx = 640, vy = 250;
    camPlate(g, c, 'tw-shaft2', 1, { rot: 0, z0: 1.12, z: 1.0 + 0.14 * clamp(age / 0.4), cx: vx, cy: vy + 60, amp: 3, kick: 6 * Math.exp(-age / 0.12) }, twShaftScene);
    clipLeft(g, 1040);
    V.godRays(g, c, { x: vx, y: vy, angle: PI / 2, spread: 2.4, n: 7, len: 620, width: 0.5, color: '#bdeee9', alpha: 0.16, source: false, beat: 0.5 });
    for (let i = 0; i < 24; i++) {
      const u = ((age * 0.9 + h2(i, 61)) % 1), an = h2(i, 62) * TAU + u * 7, R = Math.pow(1 - u, 1.5) * 520 + 30, y = vy + R * 0.22;
      g.globalAlpha = 0.95 * Math.sin(PI * u);
      talisman(g, vx + Math.cos(an) * R, y + Math.sin(an) * R * 0.5, 0.25 + (1 - u) * 0.9, an, TW_COL[i % 3], 1, 0);
    }
    g.globalAlpha = 1;
    g.restore();
    blitRot(g, rotSprite('tw-hero-up', 0, 1.12, [-130, -260, 130, 20], (q) => F.draw(q, 'xiaoyao', 0, 0, 1.1, 3.4, { pose: 'swordUp', facing: 1, tone: 'silhouette', ink: '#05070a', rim: '#bdeee9', light: [0, -500], wind: 0.9 })), 640, 720);
    g.restore();
  }

  // ③ 没人懂：塔顶。破开的塔顶漏下雨和雷光；灵儿被铁链锁在石柱上，银青的蛇尾顺着石柱垂到地上，一圈三色的符环绕在她肩头，
  // 是这里最亮的光；左墙被符光照亮，“没、人、懂”每个字墙上猛地多出一组指着她的道士影子；“懂”后他冲进来，在她面前跪下
  const TW3 = { lx: 760, ly: 520, ls: 2.0, ringY: 258, ringR: 230 };
  // 一束从破口斜照下来的冷光（白，柔边，上窄下宽）
  const shaftTex = () => C('tw-shaft-beam', 420, 760, 0.4, (q) => {
    const gr = q.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, 'rgba(159,216,232,0.5)'); gr.addColorStop(1, 'rgba(159,216,232,0)');
    q.fillStyle = gr; q.beginPath(); q.moveTo(150, 0); q.lineTo(300, 0); q.lineTo(400, 760); q.lineTo(60, 760); q.closePath(); q.fill();
    q.globalCompositeOperation = 'destination-in'; const g2 = q.createLinearGradient(0, 0, 420, 0); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.35, 'rgba(0,0,0,1)'); g2.addColorStop(0.65, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = g2; q.fillRect(0, 0, 420, 760);
  });
  function twTopScene(q) {
    q.fillStyle = K.lin(q, 0, -PM, 0, H + PM, [[0, '#04060a'], [0.7, '#0c141a'], [1, '#05070a']]); q.fillRect(-700, -700, W + 1400, H + 1400);
    // 塔顶破口：一块锯齿形的洞，透出翻滚的雨云
    const hole = () => { q.beginPath(); const pts = [[560, -PM], [600, 40], [640, 20], [700, 70], [760, 30], [830, 80], [900, 40], [960, 90], [1010, 30], [1060, -PM]]; pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); q.closePath(); };
    q.save(); hole(); q.clip();
    q.fillStyle = K.lin(q, 0, -PM, 0, 100, [[0, '#0a1626'], [1, '#203448']]); q.fillRect(500, -PM, 600, 260);
    inkClouds(q, [[800, -20, 600, 260, 41, 0.8]]);
    q.restore();
    // 左墙：不规则的石块，被符光照亮的一片（影子落在这里）
    towerStones(q, -PM, -PM, 560, 660, 51, { stone: '#3a3426', top: '#141210', bot: '#1c1810' });
    q.fillStyle = K.lin(q, 380, 0, 560, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']]); q.fillRect(380, -PM, 180, 660 + PM);
    add(q, () => { glo(q, 300, 360, 380, '#e8b860', 0.32); glo(q, 330, 380, 200, '#ffd890', 0.2); });
    // 右侧远墙（暗）与石柱
    towerStones(q, 560, -PM, W + PM, 660, 52, { stone: '#1a222a', top: '#06080c', bot: '#0c1014' });
    q.fillStyle = 'rgba(2,3,5,0.55)'; q.fillRect(560, -PM, W + PM - 560, 660 + PM);
    q.fillStyle = K.lin(q, 700, 0, 820, 0, [[0, '#1c2226'], [0.4, '#343e44'], [1, '#0a0e12']]); q.fillRect(705, -PM, 110, 660 + PM);
    for (let k = 0; k < 9; k++) { q.fillStyle = rgba('#000000', 0.35); q.fillRect(705, 40 + k * 70, 110, 3); }
    // 柱上钉满的符（灵儿身上不贴）
    for (let k = 0; k < 9; k++) { const y = [40, 70, 120, 420, 470, 520, 560, 600, 150][k], x = [722, 790, 712, 718, 796, 730, 790, 760, 800][k]; talisman(q, x, y, 0.8, (h2(k, 4) - 0.5) * 0.4, null, 0, 0); }
    // 地面、积水
    q.fillStyle = K.lin(q, 0, 640, 0, H + PM, [[0, '#1a242a'], [1, '#05070a']]); q.fillRect(-PM, 640, W + 2 * PM, H);
    q.fillStyle = rgba('#bdeee9', 0.15); q.fillRect(-PM, 640, W + 2 * PM, 1.5);
    q.fillStyle = rgba('#5a8aa8', 0.2); q.beginPath(); q.ellipse(820, 690, 220, 18, 0, 0, TAU); q.fill();
    add(q, () => { q.globalAlpha = 0.5; q.drawImage(shaftTex(), 600, -60, 420, 760); q.globalAlpha = 1; });
    vignette(q, 0.6, '#000000', PM);
  }
  // 灵儿（缓存）：女娲后人的身形，头低垂；工具包的蛇尾擦掉，另画一条顺着石柱垂到地上、在地上盘一道的尾巴；两道铁链交叉把她捆在柱上
  function twLingerLayer(q) {
    const { lx, ly, ls } = TW3, lo = { form: 'nuwa', pose: 'stand', facing: -1, head: 0.85, lean: 0.04, wind: 0.35, rim: '#bdeee9', light: [820, -40], glow: 0 };
    const lp = F.points('linger', lx, ly, ls, 3, lo), cut = lp.pelvis[1] + 26 * ls;
    // 尾巴先画（在人后面）
    lingerTail(q, lx + 4, cut - 30, 650, ls);
    figBuf(q, [lx - 160, ly - 360, 320, 480], (b) => {
      F.draw(b, 'linger', lx, ly, ls, 3, lo);
      b.globalCompositeOperation = 'destination-out';
      const gr = b.createLinearGradient(0, cut - 14, 0, cut + 6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      b.fillStyle = gr; b.fillRect(lx - 200, cut - 14, 400, 400);
      b.globalCompositeOperation = 'source-over';
    });
    chain(q, 704, lp.chest[1] - 30, 818, lp.pelvis[1] + 10, 10, 0.95, { hi: '#bdeee9', hiA: 0.55 });
    chain(q, 818, lp.chest[1] - 26, 704, lp.pelvis[1] + 14, 10, 0.95, { hi: '#bdeee9', hiA: 0.55 });
    chain(q, 706, lp.waist[1] + 40, 816, lp.waist[1] + 44, 6, 0.9, { hi: '#bdeee9', hiA: 0.45 });
  }
  // 蛇尾：从腰下顺着石柱垂到地上，再在地上盘出去；银青渐变、一排排鳞
  function lingerTail(q, x, y0, yGround, s) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      let px, py;
      if (u < 0.62) { const v = u / 0.62; px = x + Math.sin(v * PI * 1.2) * 18 * s; py = lerp(y0, yGround - 12, v); }
      else { const v = (u - 0.62) / 0.38; px = x + 8 * s + v * 230 * s * 0.5 - Math.sin(v * PI) * 20; py = yGround - 12 + Math.sin(v * PI * 0.8) * 8 - v * v * 40; }
      pts.push([px, py]);
    }
    const wAt = (u) => (17 - 13 * Math.pow(u, 1.2)) * s;
    const L = [], Rr = [];
    pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(30, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = wAt(i / 30); L.push([p[0] - dy / l * w, p[1] + dx / l * w]); Rr.push([p[0] + dy / l * w, p[1] - dx / l * w]); });
    const path = new Path2D(); L.forEach((p, i) => (i ? path.lineTo(...p) : path.moveTo(...p))); for (let i = 30; i >= 0; i--) path.lineTo(...Rr[i]); path.closePath();
    q.fillStyle = K.lin(q, x - 20 * s, 0, x + 20 * s, 0, [[0, '#4a7a78'], [0.45, '#9fd0c8'], [1, '#2a4a4c']]); q.fill(path);
    q.save(); q.clip(path);
    q.strokeStyle = rgba('#e3f9fd', 0.35); q.lineWidth = 1;
    for (let i = 1; i < 30; i++) { const p = pts[i], w = wAt(i / 30); q.beginPath(); q.arc(p[0], p[1] - w * 0.2, w * 0.9, 0.2 * PI, 0.8 * PI); q.stroke(); }
    q.restore();
    q.strokeStyle = rgba('#bdeee9', 0.55); q.lineWidth = 1.3; q.stroke(path);
    const tp = pts[30];
    q.fillStyle = '#7ab0aa'; q.beginPath(); q.moveTo(tp[0], tp[1]); q.quadraticCurveTo(tp[0] + 16 * s, tp[1] - 18 * s, tp[0] + 26 * s, tp[1] - 8 * s); q.quadraticCurveTo(tp[0] + 14 * s, tp[1] - 2 * s, tp[0] + 22 * s, tp[1] + 10 * s); q.closePath(); q.fill();
  }
  // 破口漏下的雨：只落在那一束光里
  function holeRain(g, t) {
    g.strokeStyle = rgba('#a8c8e0', 0.32); g.lineWidth = 1.1; g.beginPath();
    for (let i = 0; i < 60; i++) { const x = 600 + h2(i, 81) * 420, y = ((t * 950 + h2(i, 82) * 800) % 780) - 60, d = 6 + 0.06 * (y + 60); g.moveTo(x + d, y); g.lineTo(x + d + 2, y + 26); }
    g.stroke();
  }
  // 墙上道士的影子：几个人伸手指着她，影子被拉长、歪斜（静态贴图）
  function twShadowTex(k) {
    return C('tw-shadow' + k, 520, 560, 0.28, (q) => {
      q.translate(0, 540); q.transform(1, 0, -0.3, 1.25, 0, 0);
      const who = [['storyteller', 'jinyuan'], ['villager', 'storyteller', 'villager'], ['jinyuan', 'villager']][k];
      who.forEach((w, i) => F.draw(q, w, 150 + i * 120 + k * 20, 0, 1.9 - i * 0.12, 3 + i, { pose: 'reach', facing: 1, prop: 'none', tone: 'silhouette', ink: '#000000', variant: i + k, wind: 0.2, feibai: false }));
    });
  }
  // 绕在她肩头的符环：半圈在身后（layer 0），半圈在身前（layer 1）
  function talismanRing(g, t, x, y, R, layer) {
    for (let i = 0; i < 16; i++) {
      const an = (i / 16) * TAU + t * 0.5, s = Math.sin(an);
      if ((s > 0) !== (layer === 1)) continue;
      const px = x + Math.cos(an) * R, py = y + s * R * 0.26 + Math.sin(t * 2 + i) * 6;
      g.globalAlpha = 0.55 + 0.45 * (s * 0.5 + 0.5);
      talisman(g, px, py - 30, 0.62 + 0.22 * s, Math.cos(an) * 0.35, layer ? TW_COL[i % 3] : null, 1, 0);
    }
    g.globalAlpha = 1;
  }
  function twPanel3(g, c, T) {
    const t = c.t, lt = c.lt, t8 = T(8), ts = t8 + (lt - t8) * 0.55;
    const jolt = kickOf(lt, [T(8), T(9), T(10)], 0.12);
    cam(g, c, { z: 1.02 + 0.05 * clamp((lt - t8) / 2.8), cx: 700, cy: 380, amp: 1.4, kick: 5 * jolt });
    putPlate(g, plate('tw-top2', 1, twTopScene));
    // 破口漏下的雨与冷光，偶尔一闪雷光
    const fl = bolt(g, c, { at: [4.6], x: 820, y0: -80, y1: 60, drift: 60, color: '#c8dcff', flash: 0.3, seed: 77, life: 0.4 });
    add(g, () => { const p0 = g.globalAlpha; g.globalAlpha = p0 * (0.25 + 0.5 * fl + 0.1 * c.be(0.4)); g.drawImage(shaftTex(), 600, -60, 420, 760); g.globalAlpha = p0; });
    // 墙上的影子：没、人、懂各猛地显出一组，硬黑
    const fk = 0.92 + 0.08 * noise1(t * 6, 3);
    for (let k = 0; k < 3; k++) {
      const a = clamp((lt - T(8 + k)) / 0.08) * fk;
      if (a <= 0) continue;
      const sh = 1 + 0.03 * Math.sin(t * 3 + k);
      g.globalAlpha = 0.85 * a; g.drawImage(tint(twShadowTex(k), '#020102'), -70 + k * 140, 668 - 560 * sh + k * 6, 520, 560 * sh);
      g.globalAlpha = 1;
    }
    const { lx, ly, ringY, ringR } = TW3;
    talismanRing(g, ts, lx, ringY, ringR, 0);
    add(g, () => { glo(g, lx, ringY + 20, 260, '#e8c860', 0.18); glo(g, lx, ringY, 140, '#5ac8c0', 0.2); });
    putLayer(g, 'tw-linger2', lx - 240, ly - 380, 520, 520, 1.1, twLingerLayer);
    talismanRing(g, ts, lx, ringY, ringR, 1);
    // 他：“懂”字之后从左边冲进来（步速与跑步一致），到她面前跪下，扬起一点尘
    const ta = T(10) + 0.1, ws = F.walkSpeed('xiaoyao', 1.35, { speed: 3.4 }), xStart = 90, xEnd = 600, tK = ta + (xEnd - xStart) / ws;
    if (lt > ta) {
      const knelt = lt >= tK, xx = knelt ? xEnd : xStart + ws * (lt - ta);
      const xo = { pose: knelt ? 'kneel' : 'walk', speed: 3.4, lean: knelt ? 0 : 0.16, facing: 1, head: knelt ? -0.35 : 0, wind: 0.6 };
      F.draw(g, 'xiaoyao', xx + 2, 650.8, 1.35, t, Object.assign({}, xo, { tone: 'silhouette', ink: '#bdeee9' }));
      F.draw(g, 'xiaoyao', xx, 652, 1.35, t, xo);
      if (knelt) V.smoke(g, c, { kind: 'puff', at: tK, x: xEnd, y: 650, w: 120, n: 5, size: 50, rise: 20, life: 1.2, color: '#4a5a62', alpha: 0.4 });
    }
    holeRain(g, t);
    V.dust(g, c, { n: 30, color: '#cfe8ee', alpha: 0.45, light: { x: 800, y: -40, angle: PI / 2 - 0.08, spread: 0.3, len: 700 } });
    g.restore();
  }

  // ---------- 工笔淡彩的人脸（与第 11 组同一套画法，全片的脸保持一致）----------
  // 本地坐标：脸朝右，耳在 (-10,-4) 附近，头顶约 y=-108，下巴约 y=48；s 缩放，rot 旋转，flip=-1 朝左
  // 轮廓：女、男两套控制点，按 m 插值
  const PF = {
    f: [[20, -80], [30, -76, 37, -60, 39.5, -40], [40.5, -30, 40.5, -23], [41, -17, 44, -9], [48.5, -1, 53.5, 3, 51.5, 6.5], [50, 9.5, 45.5, 10], [45, 13, 47.5, 16], [48.8, 18, 47.8, 19.5], [46, 21, 44.3, 22], [46.8, 23.5, 45.9, 26.5], [45, 29.5, 41.5, 30.5], [41, 33, 43, 37], [44, 42, 41, 46, 35, 47.5], [29, 49, 23, 51, 19.5, 57], [16.5, 80, 15.5, 108]],
    m: [[16, -84], [32, -80, 40, -60, 41.5, -40], [44, -30, 42.5, -22], [42, -17, 46, -8], [51, 1, 57, 6, 54.5, 9.5], [52.5, 12.5, 47, 12.5], [46, 15.5, 48.5, 19], [50.5, 21, 49.5, 23], [47, 24.5, 45, 25.5], [48.5, 27, 47.5, 30], [46, 33.5, 42.5, 34.5], [42, 37.5, 44.5, 42], [46.5, 50, 42, 56, 33, 57], [26, 58, 21, 61, 19, 68], [16, 88, 18, 112]],
  };
  // sm 笑意：唇往回收、嘴角后拉（侧影上的唇不再前噘）
  const LIPK = [0, 0, 0, 0, 0, 0.35, 0.8, 1, 0.9, 0.7, 0.3, 0, 0, 0, 0];
  function profileLine(g, m, noNeck, sm) {
    const a = PF.f, b = PF.m, k = sm || 0, L = (i, j) => a[i][j] + (b[i][j] - a[i][j]) * m - (j % 2 ? 0 : LIPK[i] * k * 3);
    g.moveTo(L(0, 0), L(0, 1));
    for (let i = 1; i < a.length - (noNeck ? 1 : 0); i++) {
      if (a[i].length === 6) g.bezierCurveTo(L(i, 0), L(i, 1), L(i, 2), L(i, 3), L(i, 4), L(i, 5));
      else g.quadraticCurveTo(L(i, 0), L(i, 1), L(i, 2), L(i, 3));
    }
  }
  const HAIR = '#141018';
  // 眼：e 0 闭 1 睁；sm 笑意（下睑上推、眼尾微弯）
  function eyeGeo(e, m, sm) {
    return {
      ix: 38.5 - m, iy: -12.6, ox: 21 - m, oy: -14.8 - 0.6 * m,
      up: lerp(-10.4, -19.2 + m * 0.8, e) + sm * 0.8, low: lerp(-10.4, -9.4, e) - sm * 2.6, flick: lerp(0.6, 2.6, e) * (1 - 0.6 * m),
    };
  }
  function gongbi(g, o) {
    const m = o.male ? 1 : 0, t = o.t || 0, s = o.s, e = clamp(o.eye ?? 0), sm = o.smile || 0;
    const ink = '#3a2624', skin = o.skin || (m ? '#ead2c0' : '#f2dfd4'), lw = (w) => (w * 1.15) / Math.max(0.3, s);
    const lit = o.lit || mix(skin, '#ffffff', 0.25), shade = o.shade || mix(skin, '#a88276', 0.45);
    g.save(); g.translate(o.x, o.y); g.rotate(o.rot || 0); g.scale(s * (o.flip || 1), s);
    // turn：1 侧脸，0 背影；背影时脸、五官都不画（被发罩盖住），转过来时才淡入
    const turn = o.turn ?? 1, fw = lerp(0.1, 1, turn), fa = smooth((turn - 0.3) / 0.2), a0 = g.globalAlpha;
    if (o.backHair) o.backHair(g, t, turn);
    // 颈：下颌下面在阴影里，往下渐亮，没进衣领；后颈线比前颈宽出一截
    const nk = o.neck ?? 84, bk = o.neckBack ?? (-36 - 6 * m);
    g.fillStyle = K.lin(g, 0, 44, 0, nk, [[0, mix(skin, '#6a4a42', 0.6)], [0.55, mix(skin, '#8a6458', 0.45)], [1, mix(skin, '#a07a6c', 0.32)]]);
    g.beginPath(); g.moveTo(22, 50); g.lineTo(19.5, 57); g.quadraticCurveTo(16.5, 80, 15.5 + 2 * m, nk + 8); g.lineTo(bk, nk + 12); g.bezierCurveTo(bk + 1, 72, bk + 5, 46, -24 - 2 * m, 24); g.lineTo(-16 - 4 * m, 20); g.closePath(); g.fill();
    // 颈侧筋影、前颈线（画在衣领之前，免得压到领上）
    g.strokeStyle = rgba('#6a4a42', 0.25); g.lineWidth = lw(2.2); g.beginPath(); g.moveTo(-10, 40); g.quadraticCurveTo(0, 70, 10, nk + 6); g.stroke();
    g.strokeStyle = rgba(ink, 0.7 * fa); g.lineWidth = lw(1.1); g.beginPath(); g.moveTo(19.5, 57); g.quadraticCurveTo(16.5, 80, 15.5 + 2 * m, nk + 6); g.stroke();
    if (o.collar) o.collar(g, t);
    if (fa > 0.01) {
      g.globalAlpha = a0 * fa;
      // 脸（转头时按 fw 压扁前半张脸）；迎光一半暖亮，背光一半红褐
      g.save(); g.translate(-14, 0); g.scale(fw, 1); g.translate(14, 0);
      g.fillStyle = K.lin(g, -24, 0, 50, 0, [[0, shade], [0.45, skin], [1, lit]]);
      g.beginPath(); profileLine(g, m, true, sm); g.quadraticCurveTo(4, 52 + 6 * m, -12 - 4 * m, 34); g.quadraticCurveTo(-18 - 4 * m, 20, -20, 0); g.bezierCurveTo(-22, -50, -6, -80, PF.f[0][0] - 4 * m, PF.f[0][1] - 4 * m); g.closePath(); g.fill();
      g.save(); g.clip();
      // 颊红、眼窝、颧骨受光、颌下阴影（男子不打胭脂，颌下多一层青影）
      if (!m) A.softBlob(g, 25, 6, 17, 0.2 + 0.1 * sm, '#ec8a86');
      A.softBlob(g, 30, -16, 10, 0.2 + 0.1 * m, '#8a5a52');
      A.softBlob(g, 30, -2, 9, 0.12, '#ffffff');
      A.softBlob(g, 14, 56 + 8 * m, 22, 0.32, '#6a4238');
      A.softBlob(g, -16, -30, 26, 0.2, '#7a5a50');
      A.softBlob(g, -10, 34, 22, 0.28, '#7a5248');
      if (m) { A.softBlob(g, 26, 40, 20, 0.16, '#4a5a5a'); A.softBlob(g, 6, 30, 18, 0.12, '#4a5a5a'); }
      if (o.faceFx) o.faceFx(g);
      g.restore();
      // 唇：笑时往嘴角收一点（整块按嘴角缩到 0.8）
      const lip = o.lip || (m ? '#9a6a62' : '#cf7a76'), dy = m * 3, lk = 1 - 0.2 * Math.min(1, sm * 1.2) - 0.15 * m;
      g.save(); g.translate(40.5, 21 + dy); g.scale(lk, lk); g.translate(-40.5 - sm * 1.4, -21 - dy);
      g.fillStyle = lip;
      g.beginPath(); g.moveTo(45.5, 13 + dy); g.quadraticCurveTo(48.8 + 1.7 * m, 17.5 + dy, 47.8 + 1.7 * m, 19.5 + dy); g.quadraticCurveTo(46, 21 + dy, 44.3 + 0.7 * m, 22 + dy);
      g.quadraticCurveTo(46.8 + 1.7 * m, 23.5 + dy, 45.9 + 1.6 * m, 26.5 + dy); g.quadraticCurveTo(45, 29.5 + dy, 42, 30 + dy); g.bezierCurveTo(39, 27 + dy, 39, 24 + dy, 40.5, 20 + dy); g.closePath(); g.fill();
      g.fillStyle = rgba('#ffffff', 0.2 * (1 - m)); g.beginPath(); g.ellipse(45, 25.2 + dy, 1.4, 0.6, -0.3, 0, TAU); g.fill();
      g.restore();
      // 唇缝与嘴角：笑时嘴角上扬 6–7 个单位，外侧一道笑纹
      g.strokeStyle = rgba('#6a2a28', 0.85); g.lineWidth = lw(1.1); g.lineCap = 'round';
      g.beginPath(); g.moveTo(44.2 + 0.5 * m - sm * 1.2, 22 + dy); g.quadraticCurveTo(41.5 - sm, 22.8 + dy - sm * 1.4, 39.4 - sm * 2, 21.6 + dy - sm * 6.5); g.stroke();
      if (sm > 0.05) { g.strokeStyle = rgba('#9a5a52', 0.45 * sm); g.lineWidth = lw(0.9); g.beginPath(); g.moveTo(38.5, 13 - sm * 2); g.quadraticCurveTo(34.5, 20, 36.5, 28); g.stroke(); }
      // 鼻翼
      g.strokeStyle = rgba(ink, 0.5); g.lineWidth = lw(0.85);
      g.beginPath(); g.moveTo(45.5, 9.5 + 1.5 * m); g.bezierCurveTo(41, 10 + 1.5 * m, 40, 5 + m, 43, 3.5 + m); g.stroke();
      // 眉：女柳叶，男剑眉（眉头粗而乱）；brow 愁时眉头上提
      const br = o.brow || 0;
      g.fillStyle = '#1c1416';
      g.beginPath();
      g.moveTo(39.5 + m, -27.5 - br * 2.4 + m * 1.5);
      g.quadraticCurveTo(30, lerp(-33, -35.5, m) - br * 0.8, 15 - 2 * m, lerp(-28.5, -33, m) + br * 0.2);
      g.quadraticCurveTo(29, lerp(-31.4, -28.4, m) - br * 0.6, 39.5 + m, lerp(-26.4, -23.2, m) - br * 2.2);
      g.closePath(); g.fill();
      if (m) { g.strokeStyle = rgba('#1c1416', 0.7); g.lineWidth = lw(0.6); for (let k = 0; k < 7; k++) { const x = 38 - k * 2.6; g.beginPath(); g.moveTo(x, -24.5 - k * 0.6 - br * 2); g.lineTo(x - 2.2, -29.5 - k * 0.5 - br * 2 + (k % 2) * 1.2); g.stroke(); } }
      // 眼
      const G = eyeGeo(e, m, sm), ES = o.eyeS || (m ? 1.25 : 1.4);
      g.save(); g.translate(31, -14); g.scale(ES, ES); g.translate(-31, 14);
      const upPath = () => { g.moveTo(G.ix, G.iy); g.quadraticCurveTo(30, G.up, G.ox, G.oy); };
      if (e > 0.05) {
        g.save();
        g.beginPath(); upPath(); g.quadraticCurveTo(28, G.low, G.ix - 0.5, G.iy + 1); g.closePath();
        g.fillStyle = o.sclera || '#f6f1ee'; g.fill(); g.clip();
        const ir = g.createRadialGradient(33.2, -15, 0.5, 33.2, -14, 5);
        ir.addColorStop(0, '#0a0606'); ir.addColorStop(0.4, '#2a1612'); ir.addColorStop(1, '#5a3a2a');
        g.fillStyle = ir; g.beginPath(); g.ellipse(33, -14, 3.1, 4.8, 0, 0, TAU); g.fill();
        g.fillStyle = rgba('#3a2020', 0.35); g.fillRect(16, G.up - 2.5, 26, 3.2);
        g.restore();
        g.fillStyle = rgba('#ffffff', 0.95 * e); g.beginPath(); g.arc(34.6, -16, 1.05, 0, TAU); g.fill();
        if (o.catch) { g.fillStyle = rgba(o.catch, 0.8 * e); g.beginPath(); g.ellipse(32.2, -12.6, 0.8, 1.4, 0, 0, TAU); g.fill(); }
        if (o.wet > 0) { g.fillStyle = rgba('#ffffff', 0.75 * o.wet); g.beginPath(); g.ellipse(31, G.low + 1.4, 5, 0.9, 0, 0, TAU); g.fill(); }
        g.strokeStyle = rgba(o.lowLid || '#6a4038', 0.45 * e + (o.lowLid ? 0.3 : 0)); g.lineWidth = lw(o.lowLid ? 0.9 : 0.6);
        g.beginPath(); g.moveTo(G.ix - 0.5, G.iy + 1); g.quadraticCurveTo(28, G.low, G.ox + 1, G.oy + 1.4); g.stroke();
      }
      // 上睑：浓墨一笔；女子眼尾上挑，男子收在眼角
      g.strokeStyle = '#140c0e'; g.lineWidth = lw(m ? 1.9 : 1.7);
      g.beginPath(); upPath(); if (!m) g.quadraticCurveTo(G.ox - 1.5, G.oy - 0.5 * G.flick, G.ox - 3, G.oy - G.flick); g.stroke();
      // 睫毛：女子在眼尾几根细长上翘；男子短而直、稀
      const nl = m ? 4 : 5, lashL = m ? 1.8 : 4.8;
      g.fillStyle = '#140c0e';
      for (let i = 0; i < nl; i++) {
        const u = 0.45 + 0.55 * (i + 0.5) / nl, iu = 1 - u;
        const px = iu * iu * G.ix + 2 * u * iu * 30 + u * u * G.ox, py = iu * iu * G.iy + 2 * u * iu * G.up + u * u * G.oy;
        const a = lerp(lerp(1.5, 2.3, u), lerp(-1.35, -2.55, u) * (m ? 0.8 : 1), e), L = lashL * (0.55 + 0.6 * u), bw = 0.42;
        const cv = m ? 0.05 : 0.25;
        const cx = px + Math.cos(a) * L * 0.55 + Math.cos(a + PI / 2) * L * cv * (e * 2 - 1), cy = py + Math.sin(a) * L * 0.55 + Math.sin(a + PI / 2) * L * cv * (e * 2 - 1);
        const tx = px + Math.cos(a) * L, ty = py + Math.sin(a) * L, nx = Math.cos(a + PI / 2) * bw, ny = Math.sin(a + PI / 2) * bw;
        g.beginPath(); g.moveTo(px - nx, py - ny); g.quadraticCurveTo(cx, cy, tx, ty); g.quadraticCurveTo(cx, cy, px + nx, py + ny); g.closePath(); g.fill();
      }
      // 双眼皮褶（男子是一道沉重的眼睑褶）
      g.strokeStyle = rgba('#6a4440', 0.4 + 0.2 * m); g.lineWidth = lw(0.65 + 0.5 * m);
      g.beginPath(); g.moveTo(36.5, lerp(-13.5, -17, e)); g.quadraticCurveTo(30, lerp(-12.5, -21.6, e) + sm - m * 1.2, 21.5, lerp(-16, -18.6, e)); g.stroke();
      // 泪珠：下睑上鼓起一颗，带一点高光
      if (o.tear > 0.02) {
        const tb = clamp(o.tear), bx = 33.5, by = G.low + 1.1 + 0.8 * tb;
        g.fillStyle = rgba('#e8f4f8', 0.32 * tb); g.strokeStyle = rgba('#ffffff', 0.65 * tb); g.lineWidth = lw(0.45);
        g.beginPath(); g.ellipse(bx, by, 1.5 + 0.5 * tb, 1.2 + 1.1 * tb, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = rgba('#ffffff', 0.95 * tb); g.beginPath(); g.arc(bx - 0.5, by - 0.6, 0.55, 0, TAU); g.fill();
      }
      g.restore();
      // 侧脸轮廓与颌线
      g.strokeStyle = ink; g.lineWidth = lw(1.1); g.lineJoin = 'round';
      g.beginPath(); profileLine(g, m, true, sm); g.stroke();
      g.strokeStyle = rgba(ink, 0.18 + 0.12 * m); g.beginPath(); g.moveTo(-13, 14); g.bezierCurveTo(-10, 30, 0, 44 + 6 * m, 14, 51 + 6 * m); g.stroke();
      // 轮廓光：只描到下巴，不往颈上挂
      if (o.rim) add(g, () => { const ra = o.rimA ?? 0.5; g.strokeStyle = rgba(o.rim, ra); g.lineWidth = lw(o.rimW || 2.6); g.beginPath(); profileLine(g, m, true, sm); g.stroke(); g.lineWidth = lw(1); g.strokeStyle = rgba('#ffffff', ra * 0.7); g.beginPath(); profileLine(g, m, true, sm); g.stroke(); });
      g.restore();
      g.globalAlpha = a0;
    }
    // 耳
    if (o.ear) {
      g.fillStyle = mix(skin, '#c4907e', 0.3); g.beginPath(); g.ellipse(-12, -6, 6.5, 12.5, 0.15, 0, TAU); g.fill();
      g.strokeStyle = rgba(ink, 0.55); g.lineWidth = lw(0.9);
      g.beginPath(); g.moveTo(-8, -16); g.bezierCurveTo(-19, -20, -21, 5, -9, 6); g.moveTo(-10, -10); g.quadraticCurveTo(-14, -4, -10, 1); g.stroke();
      if (o.earring) { g.fillStyle = o.earring; g.beginPath(); g.arc(-10.5, 9.5, 1.8, 0, TAU); g.fill(); }
    }
    // 背影：两侧露出一点耳尖
    if (turn < 0.5 && o.backEars) {
      const ea = 1 - turn / 0.5;
      g.fillStyle = rgba(mix(skin, '#a06a5a', 0.35), ea);
      for (const ex of [-66, 56]) { g.beginPath(); g.ellipse(ex, -4, 7, 12, ex < 0 ? -0.15 : 0.15, 0, TAU); g.fill(); }
    }
    if (o.hair) o.hair(g, t, turn);
    g.restore();
  }
  // 三次贝塞尔上的点
  const bz = (p, u) => { const iu = 1 - u, a = iu * iu * iu, b = 3 * iu * iu * u, c = 3 * iu * u * u, d = u * u * u; return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]; };
  // 一束发丝：沿 p（四点贝塞尔）铺 n 根，宽 sp，col 颜色
  function lock(g, p, n, sp, col, a, w) {
    g.strokeStyle = rgba(col, a); g.lineWidth = w; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? (i / (n - 1) - 0.5) * sp : 0;
      g.beginPath(); g.moveTo(p[0][0] + k * 0.4, p[0][1]);
      g.bezierCurveTo(p[1][0] + k, p[1][1] + k * 0.3, p[2][0] + k * 1.2, p[2][1] + k * 0.2, p[3][0] + k * 1.4, p[3][1]);
      g.stroke();
    }
  }
  // 发面：深墨底色上一道受光的光泽
  function hairFill(g, x0, y0, x1, y1) {
    g.fillStyle = K.lin(g, x0, y0, x1, y1, [[0, '#2e2a3a'], [0.35, HAIR], [1, '#0a080c']]);
  }
  // 女子散发（灵儿）：发际、头顶、脑后，鬓发盖住耳朵；turn 背面时发罩盖住整张脸
  function capLinger(g, t, turn) {
    const fr = lerp(46, 0, turn), sw = Math.sin(t * 1.3) * 1.5;
    hairFill(g, -10, -110, -60, 20);
    g.beginPath();
    g.moveTo(21 + fr, -79);
    g.bezierCurveTo(18 + fr * 0.5, -102, -20, -118, -52, -110);
    g.bezierCurveTo(-86, -100, -98, -54, -88, -8);
    g.bezierCurveTo(-80, 28, -62, 50, -42, 62);
    g.lineTo(-22 + fr * 0.3, 44);
    g.bezierCurveTo(-14 + fr, 16, -8 + fr, -24, 4 + fr, -50);
    g.quadraticCurveTo(14 + fr, -64, 21 + fr, -79);
    g.closePath(); g.fill();
    // 额前一缕刘海
    g.fillStyle = HAIR;
    g.beginPath(); g.moveTo(21 + fr, -80); g.bezierCurveTo(31 + fr, -74, 35 + fr * 0.8, -62, 33 + fr * 0.8, -52); g.bezierCurveTo(25 + fr, -62, 16 + fr, -63, 8 + fr, -55); g.closePath(); g.fill();
    // 鬓边垂发
    lock(g, [[6 + fr, -54], [-2 + fr + sw * 0.3, -30], [-4 + fr + sw, 4], [-10 + fr * 0.5 + sw * 1.6, 44]], 3, 6, HAIR, 1, lw1(g));
    lock(g, [[10, -96], [-26, -116], [-78, -88], [-84, -4]], 8, 30, '#4e4a60', 0.5, lw1(g) * 0.7);
    lock(g, [[0, -60], [-20, -40], [-30, 0], [-34, 40]], 4, 12, '#4e4a60', 0.35, lw1(g) * 0.6);
  }
  const lw1 = (g) => { const m = g.getTransform(); return 1.1 / Math.max(0.3, Math.hypot(m.a, m.b) / ((XYT.sprites && XYT.sprites.S) || 1)); };
  // 桃花簪与淡紫发带
  function peachPin(g, x, y, r, t) {
    g.fillStyle = '#f2b6c6';
    for (let p = 0; p < 5; p++) { const a = (p / 5) * TAU + 0.3; g.beginPath(); g.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.8, r * 0.55, a, 0, TAU); g.fill(); }
    g.fillStyle = '#f8e08a'; g.beginPath(); g.arc(x, y, r * 0.38, 0, TAU); g.fill();
    g.strokeStyle = '#d8b46a'; g.lineWidth = r * 0.25; g.beginPath(); g.moveTo(x + r * 0.5, y + r * 0.3); g.lineTo(x + r * 3.4, y + r * 1.8); g.stroke();
  }
  // 男子发罩：发际、脑后、发髻与蓝发带（带尾随风），鬓角一缕垂到下颌前
  function capXiaoyao(g, t) {
    hairFill(g, -10, -110, -60, 20);
    g.beginPath();
    g.moveTo(17, -84);
    g.bezierCurveTo(10, -106, -26, -118, -56, -110);
    g.bezierCurveTo(-88, -98, -98, -52, -88, -8);
    g.bezierCurveTo(-82, 26, -66, 50, -50, 58);
    g.lineTo(-30, 34); g.bezierCurveTo(-28, 10, -24, -10, -22, -18);
    g.quadraticCurveTo(-10, -32, 0, -54);
    g.quadraticCurveTo(8, -72, 17, -84);
    g.closePath(); g.fill();
    g.fillStyle = HAIR; g.beginPath(); g.ellipse(-46, -112, 19, 12, -0.35, 0, TAU); g.fill();
    g.fillStyle = '#3b6db3'; g.save(); g.translate(-38, -110); g.rotate(-0.35); g.fillRect(-3, -11, 6, 22); g.restore();
    g.save(); g.translate(-40, -104); g.rotate(1.2 + Math.sin(t * 1.4) * 0.12);
    E.util.ribbon(g, 0, 0, 58, 4, t, { color: '#3b6db3', amp: 5, freq: 0.7, speed: 1.5, bias: 6, shade: true });
    g.restore();
    lock(g, [[10, -96], [-26, -116], [-78, -88], [-84, -4]], 7, 28, '#4a4a5a', 0.5, lw1(g) * 0.7);
    // 鬓角：一束发先铺底，再描几根发丝，随风轻摆
    const sw = Math.sin(t * 1.1) * 1.6, p = [[2, -56], [-5 + sw * 0.3, -32], [-1 + sw, 4], [-6 + sw * 1.6, 44]];
    const N = 14, Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) { const u = i / N, q = bz(p, u), wd = 4.2 * (1 - u * 0.65) + 0.6; Lp.push([q[0] - wd, q[1]]); Rp.push([q[0] + wd * 0.8, q[1]]); }
    g.fillStyle = HAIR;
    g.beginPath(); Lp.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); for (let i = N; i >= 0; i--) g.lineTo(Rp[i][0], Rp[i][1]); g.closePath(); g.fill();
    lock(g, p, 5, 5, '#3a3644', 1, lw1(g) * 0.8);
    // 额前几根散下来的发丝
    lock(g, [[14, -84], [26, -70], [28, -52], [24, -36]], 3, 4, HAIR, 0.85, lw1(g) * 0.7);
  }
  // 灵儿衣领（本地坐标，接在颈下）：白纱中衣、浅粉交领斜压下去、边上一道柔和的粉，外罩轻纱
  function lingerBody(g, t) {
    g.fillStyle = K.lin(g, -70, 0, 40, 0, [[0, '#b8b0bc'], [0.55, '#efe8ee'], [1, '#f8f4f7']]);
    g.beginPath(); g.moveTo(22, 86); g.bezierCurveTo(46, 120, 52, 220, 44, 420); g.lineTo(-96, 420); g.bezierCurveTo(-92, 240, -78, 130, -46, 88); g.quadraticCurveTo(-12, 76, 22, 86); g.fill();
    // 交领：左襟压右襟，领缘一道浅粉渐到白
    g.fillStyle = K.lin(g, 20, 86, -12, 160, [[0, '#f2c6d4'], [1, '#e8b4c6']]);
    g.beginPath(); g.moveTo(20, 86); g.quadraticCurveTo(4, 110, -6, 160); g.lineTo(-18, 158); g.quadraticCurveTo(-8, 108, 8, 82); g.closePath(); g.fill();
    g.fillStyle = K.lin(g, -46, 88, -10, 160, [[0, '#fbf6f9'], [1, '#e8dce4']]);
    g.beginPath(); g.moveTo(-46, 88); g.quadraticCurveTo(-20, 120, -6, 160); g.lineTo(-14, 164); g.quadraticCurveTo(-34, 124, -56, 96); g.closePath(); g.fill();
    g.strokeStyle = rgba('#d89ab0', 0.6); g.lineWidth = lw1(g) * 0.9; g.beginPath(); g.moveTo(20, 86); g.quadraticCurveTo(4, 110, -6, 160); g.stroke();
    g.strokeStyle = rgba('#9a8aa0', 0.35); g.lineWidth = 1.2;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(30 - k * 22, 150 + k * 10); g.quadraticCurveTo(26 - k * 24, 260, 34 - k * 26, 420); g.stroke(); }
    g.fillStyle = rgba('#f6e8f0', 0.35);
    g.beginPath(); g.moveTo(40, 120); g.bezierCurveTo(70 + Math.sin(t) * 4, 200, 66, 300, 60, 420); g.lineTo(30, 420); g.bezierCurveTo(40, 300, 44, 200, 30, 120); g.closePath(); g.fill();
  }
  // 他的衣领（本地坐标）：月白中衣、青衫交领
  function xiaoyaoCollar(g) {
    // 交领：月白中衣一道、青衫领缘一道，往下没进暗里
    g.fillStyle = K.lin(g, 0, 90, 0, 200, [[0, '#24363a'], [1, 'rgba(10,14,16,0)']]);
    g.beginPath(); g.moveTo(24, 92); g.bezierCurveTo(34, 120, 30, 160, 20, 200); g.lineTo(-90, 200); g.bezierCurveTo(-80, 150, -66, 110, -46, 92); g.quadraticCurveTo(-10, 80, 24, 92); g.fill();
    g.fillStyle = K.lin(g, 0, 90, 0, 170, [[0, '#e4f0ee'], [1, 'rgba(200,220,218,0)']]); g.beginPath(); g.moveTo(22, 92); g.quadraticCurveTo(6, 114, -4, 160); g.lineTo(-13, 158); g.quadraticCurveTo(-4, 112, 10, 88); g.closePath(); g.fill();
    g.strokeStyle = rgba('#6a8a8e', 0.5); g.lineWidth = lw1(g); g.beginPath(); g.moveTo(-30, 96); g.quadraticCurveTo(-34, 140, -40, 190); g.stroke();
  }
  // 他的肩背（世界坐标）：颈后往左下斜下去的肩线，一大片暗青渐没进左下角的黑里，肩线上一线冷光
  function xiaoyaoShoulder(g, him) {
    const N = faceAt(him, -18, 104), B = faceAt(him, 26, 104);
    const sh = new Path2D();
    sh.moveTo(N[0] + 10, N[1] - 6);
    sh.bezierCurveTo(N[0] - 90, N[1] - 30, N[0] - 220, N[1] + 10, N[0] - 330, N[1] + 120);
    sh.lineTo(N[0] - 360, H + 80); sh.lineTo(B[0] - 60, H + 80);
    sh.bezierCurveTo(B[0] - 10, N[1] + 200, B[0] + 20, B[1] + 60, B[0], B[1]); sh.closePath();
    g.fillStyle = K.lin(g, N[0], N[1], N[0] - 280, N[1] + 260, [[0, '#22323a'], [0.45, '#141e22'], [1, '#040506']]); g.fill(sh);
    g.save(); g.clip(sh);
    g.strokeStyle = rgba('#3a5458', 0.35); g.lineWidth = 1.3;
    for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(N[0] - 40 - k * 46, N[1] + 6 + k * 14); g.quadraticCurveTo(N[0] - 70 - k * 46, N[1] + 120, N[0] - 130 - k * 36, H + 40); g.stroke(); }
    g.restore();
    g.strokeStyle = rgba('#9fd8e8', 0.28); g.lineWidth = 1.6; g.beginPath(); g.moveTo(N[0] + 10, N[1] - 6); g.bezierCurveTo(N[0] - 90, N[1] - 30, N[0] - 220, N[1] + 10, N[0] - 330, N[1] + 120); g.stroke();
  }
  // 灵儿的长发：从后脑散向地面（世界坐标），几束带光泽
  function spillHair(g, hx, hy, t, s) {
    for (let k = 0; k < 7; k++) {
      const u = k / 6, x0 = hx + (u - 0.5) * 120 * s, sw = Math.sin(t * 0.9 + k) * 6 * s;
      const p = [[x0, hy], [x0 - 40 * s + sw, hy + 90 * s], [x0 - 70 * s + sw * 1.5, hy + 170 * s], [x0 - 100 * s + sw * 2, hy + 330 * s]];
      g.fillStyle = K.lin(g, x0, hy, x0 - 60 * s, hy + 300 * s, [[0, '#120e16'], [1, '#08060a']]);
      g.beginPath(); g.moveTo(p[0][0] - 26 * s, p[0][1]);
      g.bezierCurveTo(p[1][0] - 22 * s, p[1][1], p[2][0] - 14 * s, p[2][1], p[3][0] - 4 * s, p[3][1]);
      g.lineTo(p[3][0] + 6 * s, p[3][1]);
      g.bezierCurveTo(p[2][0] + 16 * s, p[2][1], p[1][0] + 22 * s, p[1][1], p[0][0] + 26 * s, p[0][1]);
      g.closePath(); g.fill();
      lock(g, p, 4, 30 * s, '#5a6070', 0.35, 0.8);
    }
  }
  // 局部坐标 → 世界坐标（与 gongbi 同样的平移、旋转、缩放）
  const faceAt = (o, px, py) => { const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0); return [o.x + (px * c - py * s) * o.s, o.y + (px * s + py * c) * o.s]; };

  // =====================================================================
  // 36 锁链相认：多年望眼欲穿过红尘滚滚｜我没看透
  // =====================================================================
  const CH_T = [0.3, 0.58, 1, 1.42, 1.92, 2.12, 2.66, 3.08, 3.36, 3.88, 4.2, 4.76, 5.22, 5.56, 5.97];
  const CH = { x: 330, y: 700, s: 3.4, light: [800, 430] };
  const CH_BOX = [190, 240, 880, 500];
  // 怀抱里两人的位置（照 fig.cradle 的算法算出她的落点，好把锁链挂到她身上、把她的脸画在头的位置）
  function chLinger() {
    const s = CH.s, SA = s * F.height('xiaoyao') / 180, bo = { pose: 'lie', flat: true, limp: true, wind: 0.15, night: true };
    const bp = F.points('linger', 0, CH.y, s, 3, bo), xB = CH.x + 50 * SA - bp.back[0];
    return F.points('linger', xB, CH.y, s, 3, bo);
  }
  // 两人的怀抱（缓存两张）：k 0 他埋着头，1 他抬起头望着她；只有他有轮廓光，她不亮
  // 他抬头的四张定格：k = 0 低头看她，k = 3 抬头望向远处
  const CH_UPN = 4;
  const chPairTex = (k) => C('ch-pair3-' + k, CH_BOX[2], CH_BOX[3], 1.25, (q) => {
    q.translate(-CH_BOX[0], -CH_BOX[1]);
    const f = easeInOut(k / (CH_UPN - 1));
    F.cradle(q, CH.x, CH.y, CH.s, 3, { wind: 0.15, facing: 1, a: { head: lerp(0.1, -0.3, f), lean: -0.2 * f, rim: '#ff7a6a', light: CH.light, rimAlpha: 0.75 }, b: {} });
    // 她的脸：仰着、眼闭着，枕在他臂弯里
    const lp = chLinger(), fo = { x: lp.head[0] + 4, y: lp.head[1] - 2, s: 0.5, rot: -PI / 2 - 0.25 };
    gongbi(q, Object.assign({}, fo, { eye: 0, t: 3, hair: capLinger, neck: 70 }));
    const at = (lx, ly) => faceAt(fo, lx, ly), pin = at(-52, -86);
    peachPin(q, pin[0], pin[1], 4, 3);
  });
  // 回忆：街头陌路，他拱手一礼、她立在灯下（暖黄旧色，圆形，边缘柔软）
  function chMemoryTex() {
    return C('ch-memory2', 320, 320, 1, (q) => {
      q.fillStyle = K.lin(q, 0, 0, 0, 320, [[0, '#f6dcb8'], [1, '#c89a74']]); q.fillRect(0, 0, 320, 320);
      // 街：屋檐、灯笼、青石路
      q.fillStyle = 'rgba(110,70,50,0.45)'; q.beginPath(); q.moveTo(0, 96); q.lineTo(320, 70); q.lineTo(320, 96); q.lineTo(0, 120); q.closePath(); q.fill();
      for (let k = 0; k < 5; k++) q.fillRect(16 + k * 66, 112 - k * 6, 6, 150);
      q.fillStyle = 'rgba(200,60,40,0.65)'; q.beginPath(); q.ellipse(250, 150, 14, 18, 0, 0, TAU); q.fill();
      A.softBlob(q, 250, 150, 40, 0.35, '#ffd890');
      q.fillStyle = 'rgba(120,80,60,0.3)'; q.fillRect(0, 262, 320, 58);
      F.draw(q, 'xiaoyao', 120, 284, 1.0, 3, { pose: 'pray', facing: 1, head: 0.3, tone: 'silhouette', ink: '#5a3628', wind: 0.2 });
      F.draw(q, 'linger', 210, 284, 1.0, 3, { pose: 'stand', facing: -1, tone: 'silhouette', ink: '#7a4a3a', wind: 0.4 });
      // 圆形柔边
      q.globalCompositeOperation = 'destination-in';
      const gr = q.createRadialGradient(160, 160, 100, 160, 160, 160); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      q.fillStyle = gr; q.fillRect(0, 0, 320, 320);
    });
  }
  // 红尘：绕两人慢慢转的一圈红色尘光（z>0 在前，z<0 在后）；大颗的里头闪过那段回忆。spin 转得多快，bright 亮度，roll 第二圈滚过去的位置
  function redDust(g, t, layer, o) {
    const n = 64, mem = chMemoryTex();
    add(g, () => {
      for (let i = 0; i < n; i++) {
        const an = h2(i, 7) * TAU + o.ang * (0.6 + 0.4 * h2(i, 8)), z = Math.sin(an);
        if ((z > 0) !== (layer === 1)) continue;
        const rr = 0.55 + 0.6 * h2(i, 9), x = o.cx + Math.cos(an) * o.rx * rr, y = o.cy + z * o.ry * rr + (h2(i, 10) - 0.5) * 160 + Math.sin(t * 0.7 + i) * 10;
        const R = (4 + 26 * Math.pow(h2(i, 11), 1.8)) * (0.75 + 0.45 * z), f = (0.65 + 0.35 * Math.sin(t * 1.7 + i * 2.1)) * o.bright;
        glo(g, x, y, R * 2.6, '#c8202e', 0.24 * f * (0.6 + 0.4 * z));
        glo(g, x, y, R * 0.6, '#ff9a8a', 0.55 * f);
        if (R > 14 && layer === 1) {
          const fl = clamp(Math.sin(t * 0.9 + i * 1.3) * 2 - 0.6);
          if (fl > 0) { g.globalCompositeOperation = 'source-over'; const p = g.globalAlpha; g.globalAlpha = p * 0.35 * fl; g.drawImage(mem, x - R, y - R, R * 2, R * 2); g.globalAlpha = p; g.globalCompositeOperation = 'lighter'; }
        }
      }
    });
  }

  XYT.registerShot('c2_chains', {
    name: '锁链相认', zone: 'top', night: true, text: '#e9f1f6', shadow: 'rgba(14,6,8,0.92)', accent: '#ff9a8a', bloom: 0.42,
    draw(g, c) {
      const T = (k) => chT(c, k, CH_T);
      if (c.lt < T(11)) chPanel1(g, c, T);
      else chPanel2(g, c, T);
    },
  });

  // 塔顶一角（比上一镜更暗更暖的红黑）：墨晕把石墙压掉大半，墙上一圈褪色的女娲符阵，右边断柱与焦黑的符
  function chScene(q) {
    q.fillStyle = '#060304'; q.fillRect(-700, -700, W + 1400, H + 1400);
    towerStones(q, -PM, -PM, W + PM, 660, 61, { stone: '#2e1c1e', joint: '#080405', top: '#120808', bot: '#1a0c0c', wet: '#c8807a', moss: '#2a1e18' });
    q.fillStyle = 'rgba(10,3,4,0.62)'; q.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
    for (let k = 0; k < 9; k++) { q.globalAlpha = 0.6; q.drawImage(tint(splashTex(101 + (k % 6)), '#030102'), [-200, 500, 900, -100, 300, 800, 100, 640, 1000][k], [-120, -160, 60, 300, 380, 360, 140, 120, -40][k], 760, 420); }
    q.globalAlpha = 1;
    // 女娲符阵：两圈同心、一圈八卦似的短刻、中间一条盘着的蛇身，金红色，褪得只剩淡淡一层
    const cx = 640, cy = 250;
    q.strokeStyle = rgba('#d8a060', 0.2); q.lineWidth = 3; q.beginPath(); q.arc(cx, cy, 200, 0, TAU); q.stroke();
    q.lineWidth = 2; q.beginPath(); q.arc(cx, cy, 168, 0, TAU); q.stroke(); q.beginPath(); q.arc(cx, cy, 74, 0, TAU); q.stroke();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; for (let j = 0; j < 3; j++) { const r0 = 174 + j * 8, w = j === 1 && k % 2 ? 0.08 : 0.2; q.beginPath(); q.arc(cx, cy, r0, a - w, a + w); q.stroke(); } }
    q.lineWidth = 6; q.strokeStyle = rgba('#d8a060', 0.16); q.beginPath();
    for (let i = 0; i <= 40; i++) { const u = i / 40, a = u * TAU * 1.5, r = 60 - u * 44; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? q.lineTo(x, y) : q.moveTo(x, y); } q.stroke();
    q.fillStyle = rgba('#d8a060', 0.2); q.beginPath(); q.ellipse(cx + 60, cy, 10, 6, 0.3, 0, TAU); q.fill();
    // 右边断柱与柱上烧焦的符
    q.fillStyle = K.lin(q, 1000, 0, 1110, 0, [[0, '#1a0e10'], [0.4, '#2a1a1c'], [1, '#080405']]); q.fillRect(1000, -PM, 110, 820);
    for (let k = 0; k < 5; k++) { q.fillStyle = rgba('#2a1a10', 0.85); q.fillRect(1020 + (k % 2) * 40, 180 + k * 70, 14, 30 - k * 3); q.fillStyle = rgba('#ff7a3a', 0.25); q.fillRect(1020 + (k % 2) * 40, 210 + k * 70 - k * 3, 14, 2); }
    add(q, () => { glo(q, 640, 520, 520, '#5a1018', 0.45); glo(q, 980, -60, 300, '#6a3a3a', 0.2); });
    q.fillStyle = K.lin(q, 0, 640, 0, H + PM, [[0, '#1a0c0e'], [1, '#040203']]); q.fillRect(-PM, 640, W + 2 * PM, H);
    vignette(q, 0.7, '#000000', PM);
  }
  // 锁链的端点：从左边墙上（低于歌词栏）斜着下来，缠到她身上
  const chChains = (lp) => [[-60, 190, lp.chest[0] + 10, lp.chest[1] - 6, 46, 1.7], [-60, 270, lp.waist[0], lp.waist[1], 40, 1.7], [-60, 350, lp.kneeN ? lp.kneeN[0] : lp.waist[0] + 80, (lp.kneeN ? lp.kneeN[1] : lp.waist[1]) + 4, 30, 1.6]];
  // ① 多年望眼欲穿过红尘滚滚：他跪着抱住被锁链缠着、昏迷的她；“望”字他抬起头望着她；“穿”字一颗红尘放大，里面是当年街头陌路的一礼；
  // “红尘”二字尘光一亮、转快三倍；“滚滚”又一圈尘浪滚过。三层视差：远墙 0.5、人 1、近处的链与尘 1.6
  function chPanel1(g, c, T) {
    const t = c.t, lt = c.lt, p = clamp(lt / Math.max(1, T(11)));
    const z = 1.0 + 0.1 * easeInOut(p);
    cam(g, c, { z, cx: 600, cy: 520, amp: 1.2 });
    g.save(); g.translate(30 * p, 10 * p); putPlate(g, plate('ch1b', 1, chScene)); g.restore();
    // 红尘的转角：平时慢慢转，“红尘”二字转快三倍，持续一拍
    const beat = (c.b && c.b.period) || 0.833, fast = ramp(lt, T(7) - 0.05, T(7) + 0.1) * (1 - ramp(lt, T(7) + beat, T(7) + beat + 0.3));
    const ang = 0.22 * lt + 0.44 * Math.max(0, Math.min(lt, T(7) + beat + 0.15) - T(7)) * 1 + 0.2 * fast;
    const dust = { cx: 620, cy: 500, rx: 470, ry: 150, ang, bright: 1 + 0.9 * fast + 0.3 * c.be(0.35) };
    redDust(g, t, 0, dust);
    const lp = chLinger(), sw = Math.sin(t * 0.8) * 4;
    for (const [x0, y0, x1, y1, sag, s] of chChains(lp)) chain(g, x0, y0, x1, y1, sag + sw, s, { hi: '#ff9a8a', hiA: 0.45 });
    // 两人：“望”字他抬起头——四张定格依次换，相邻两张之间短短一叠（新的一张先画实，旧的淡掉）
    const up = clamp((lt - T(2) + 0.05) / 0.5) * (CH_UPN - 1), uk = Math.min(CH_UPN - 2, Math.floor(up)), uf = up - uk;
    if (up <= 0 || up >= CH_UPN - 1) g.drawImage(chPairTex(up <= 0 ? 0 : CH_UPN - 1), CH_BOX[0], CH_BOX[1], CH_BOX[2], CH_BOX[3]);
    else { g.drawImage(chPairTex(uk + 1), CH_BOX[0], CH_BOX[1], CH_BOX[2], CH_BOX[3]); g.globalAlpha = 1 - easeInOut(uf); g.drawImage(chPairTex(uk), CH_BOX[0], CH_BOX[1], CH_BOX[2], CH_BOX[3]); g.globalAlpha = 1; }
    chain(g, lp.chest[0] - 30, lp.chest[1] - 18, lp.chest[0] + 40, lp.waist[1] + 12, 14, 1.4, { hi: '#ff9a8a', hiA: 0.5 });
    chain(g, lp.waist[0] - 20, lp.waist[1] - 14, lp.waist[0] + 120, CH.y - 6, 10, 1.4, { hi: '#ff9a8a', hiA: 0.45 });
    chain(g, lp.waist[0] + 120, CH.y - 4, lp.waist[0] + 330, CH.y - 2, 6, 1.4, { hi: '#ff9a8a', hiA: 0.35 });
    redDust(g, t, 1, dust);
    // “穿”字：一颗红尘放大成一面回忆
    const mu = clamp((lt - T(5)) / 0.8);
    if (mu > 0 && mu < 1) {
      const gr = easeOut(clamp(mu / 0.3)), fo = 1 - smooth((mu - 0.7) / 0.3), x = 840 + 40 * mu, y = 330 - 20 * mu, R = 20 + 70 * gr;
      add(g, () => glo(g, x, y, R * 1.8, '#ff6a5a', 0.35 * fo));
      g.globalAlpha = 0.5 * fo * gr; g.drawImage(chMemoryTex(), x - R, y - R, R * 2, R * 2); g.globalAlpha = 1;
    }
    // “滚滚”：又一圈尘浪从右向左滚过
    const roll = clamp((lt - T(9) + 0.05) / 0.9);
    if (roll > 0 && roll < 1) add(g, () => {
      for (let i = 0; i < 40; i++) {
        const u = h2(i, 91), x = lerp(1400, -200, roll) + (u - 0.5) * 260 + Math.sin(roll * 6 + i) * 30, y = 420 + (h2(i, 92) - 0.5) * 300 + Math.cos(roll * 5 + i) * 26, R = 3 + 12 * Math.pow(h2(i, 93), 2);
        glo(g, x, y, R * 2.4, '#d82a30', 0.3 * Math.sin(PI * roll)); glo(g, x, y, R * 0.5, '#ffc0a8', 0.6 * Math.sin(PI * roll));
      }
    });
    // 细碎的尘点
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ff6a5a';
    for (let i = 0; i < 70; i++) {
      const an = h2(i, 61) * TAU + ang * (1 + 0.9 * h2(i, 62)), rr = 0.4 + 0.8 * h2(i, 63), x = dust.cx + Math.cos(an) * dust.rx * rr, y = dust.cy + Math.sin(an) * dust.ry * rr + (h2(i, 64) - 0.5) * 220;
      g.globalAlpha = (0.3 + 0.5 * h2(i, 65)) * (0.6 + 0.4 * Math.sin(t * 2.3 + i)) * dust.bright; const sz = 1.6 + h2(i, 66) * 1.6; g.fillRect(x, y, sz, sz);
    }
    g.restore();
    // 前景（视差 1.6）：近处失焦的一段铁链与几颗大红尘
    g.save(); g.translate(-30 * p * 0.6, -12 * p * 0.6);
    g.globalAlpha = 0.6; chain(g, 1080, 780, 1420, 520, -30, 4.2, { col: '#060304', hi: '#4a2a2a', hiA: 0.4 }); g.globalAlpha = 1;
    add(g, () => { for (let i = 0; i < 4; i++) { const x = 120 + i * 330 + Math.sin(t * 0.4 + i) * 30 - 60 * p, y = 600 + 70 * h2(i, 71) - 20 * Math.cos(t * 0.3 + i); glo(g, x, y, 60 + 30 * h2(i, 72), '#d02a34', 0.1 * dust.bright); } });
    g.restore();
    // 烧过的符化成灰，慢慢往下飘
    add(g, () => { for (let i = 0; i < 16; i++) { const ph = ((t * 0.06 + h2(i, 31)) % 1), x = 120 + h2(i, 32) * 1040 + Math.sin(t * 0.8 + i) * 30, y = -20 + ph * 760; glo(g, x, y, 3 + 3 * h2(i, 33), '#ff8a4a', 0.5 * Math.sin(PI * ph) * (0.5 + 0.5 * Math.sin(t * 3 + i))); } });
    g.restore();
  }

  // ② 我没看透：极近景，工笔淡彩的两张脸。他低头看她，眼睛睁着往下看；“没”字眉头拧起、眼皮垂下一点；
  // “看”字下睑涌起一颗泪；“透”字泪落下，滴在她脸颊上（镜头跟着推近一点）；她的眼睛还闭着
  const CH2 = { hx: 478, hy: 372, hs: 1.5, hr: 0.86, fy: 618, fs: 1.95, fr: -PI / 2 + 0.3 };
  function chFaces(T, lt) {
    const t12 = T(12), t13 = T(13);
    const brow = 0.25 + 1.0 * easeOut(clamp((lt - t12) / 0.45)), eye = 0.8 - 0.28 * easeInOut(clamp((lt - t12) / 0.5));
    const him = { male: true, x: CH2.hx, y: CH2.hy, s: CH2.hs, rot: CH2.hr, eye, brow, wet: easeOut(clamp((lt - t12) / 0.6)) * 0.8, tear: easeOut(clamp((lt - t13) / 0.3)), ear: true, neck: 96, rim: '#9fd8e8', rimA: 0.35 };
    // 他眼下那颗泪的位置（局部坐标），她的脸颊正好在它正下方
    const drop = faceAt(him, 34, -8);
    const her = { x: 0, y: CH2.fy, s: CH2.fs, rot: CH2.fr, eye: 0, neck: 96 };
    const off = faceAt(her, 22, 2); her.x = drop[0] - (off[0] - her.x);
    return { him, her, drop, land: faceAt(her, 22, 2) };
  }
  function chPanel2(g, c, T) {
    const t = c.t, lt = c.lt, t11 = T(11), t14 = T(14);
    const F2 = chFaces(T, lt), { him, her, drop, land } = F2;
    const p = clamp((lt - t11) / 1.9), push = easeInOut(clamp((lt - t14) / 0.5));
    cam(g, c, { z: 1.0 + 0.045 * easeInOut(p) + 0.03 * push, cx: lerp(580, land[0], push), cy: lerp(470, land[1], push), amp: 0.8 });
    putPlate(g, plate('ch2b', 0.5, (q) => {
      base(q, '#07040a');
      q.fillStyle = K.lin(q, 0, -PM, 0, H + PM, [[0, '#0a0608'], [1, '#140a0c']]); q.fillRect(-PM, -PM, W + 2 * PM, H + 2 * PM);
      add(q, () => { glo(q, 980, 120, 420, '#4a2a2a', 0.3); glo(q, 520, 640, 420, '#5a1418', 0.4); });
      for (let k = 0; k < 3; k++) chain(q, 860 + k * 130, -60, 900 + k * 150, 760, 30, 3.2, { col: '#0c0809', hi: '#4a3a3a', hiA: 0.3 });
      vignette(q, 0.7, '#000000', PM);
    }));
    // 背后的红尘（大而虚）
    add(g, () => { for (let i = 0; i < 12; i++) { const x = 100 + h2(i, 41) * 1100 + Math.sin(t * 0.3 + i) * 30, y = 120 + h2(i, 42) * 560 + Math.cos(t * 0.25 + i) * 20, R = 20 + 50 * h2(i, 43); glo(g, x, y, R, '#c8202e', 0.14 + 0.1 * Math.sin(t * 1.3 + i) + 0.08 * c.be(0.4)); } });
    // 她：仰着的脸，眼闭着，长发散开，簪一朵桃花
    const hb = faceAt(her, -40, -40);
    spillHair(g, hb[0], hb[1], t, 1.0);
    gongbi(g, Object.assign({}, her, { t, hair: capLinger, collar: lingerBody }));
    { const at = (lx, ly) => faceAt(her, lx, ly), pin = at(-52, -86), rb = at(-70, -40);
      peachPin(g, pin[0], pin[1], 8, t);
      for (const [k, L, ang] of [[0, 170, 0.35], [1, 130, 0.7]]) { g.save(); g.translate(rb[0], rb[1]); g.rotate(ang + Math.sin(t * 0.8 + k) * 0.08); E.util.ribbon(g, 0, 0, L, 7 - k, t * 0.7 + k, { color: '#c9b4e4', amp: 14, freq: 1.1, speed: 1.4, bias: 26 - k * 18, shade: true }); g.restore(); } }
    // 他：低头的侧脸，青衫的领与肩从左下压进来
    xiaoyaoShoulder(g, him);
    gongbi(g, Object.assign({}, him, { t, hair: capXiaoyao, collar: xiaoyaoCollar }));
    // 泪：“看”字下睑涌起，“透”字落下，滴在她脸颊上
    if (lt > t14) {
      const fa = lt - t14, gdrop = 0.5 * 1800 * fa * fa, py = drop[1] + 4 + gdrop, hitAge = fa - Math.sqrt(2 * Math.max(1, land[1] - drop[1] - 4) / 1800);
      if (hitAge < 0) {
        const r = 4.2, st = Math.min(1, fa * 6);
        add(g, () => glo(g, drop[0], py, r * 5, '#d8f0ff', 0.4));
        const gr = g.createRadialGradient(drop[0] - r * 0.3, py - r * 0.4, r * 0.1, drop[0], py, r * 1.3);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(200,230,250,0.65)'); gr.addColorStop(1, 'rgba(120,160,200,0.75)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(drop[0], py, r * 0.85, r * (1 + 0.5 * st), 0, 0, TAU); g.fill();
        g.strokeStyle = rgba('#ffffff', 0.7); g.lineWidth = 1; g.beginPath(); g.moveTo(drop[0] - r * 0.3, py - r * 0.6); g.lineTo(drop[0] - r * 0.1, py + r * 0.2); g.stroke();
      } else {
        // 落在她脸颊上：一点碎光、一圈细涟、一道往下滑的湿痕
        const ha = hitAge;
        add(g, () => { glo(g, land[0], land[1], 34 * (1 - Math.exp(-ha * 8)), '#e8f8ff', 0.65 * Math.exp(-ha * 2.5)); g.strokeStyle = rgba('#e8f8ff', 0.6 * Math.exp(-ha * 2)); g.lineWidth = 1.2; g.beginPath(); g.ellipse(land[0], land[1], 4 + ha * 40, 1.5 + ha * 12, 0.2, 0, TAU); g.stroke(); });
        g.strokeStyle = rgba('#e8f6ff', 0.5); g.lineWidth = 2.2; g.beginPath(); g.moveTo(land[0], land[1]); g.quadraticCurveTo(land[0] + 8, land[1] + 10 * clamp(ha * 3), land[0] + 16, land[1] + 24 * clamp(ha * 2)); g.stroke();
        add(g, () => glo(g, land[0] + 1, land[1] + 1, 5, '#ffffff', 0.75));
      }
    }
    // 前景飘过的一两粒红尘（失焦大光斑）
    add(g, () => { for (let i = 0; i < 3; i++) { const x = ((t * 18 + h2(i, 51) * 1400) % 1500) - 100, y = 200 + h2(i, 52) * 420; glo(g, x, y, 70 + 30 * h2(i, 53), '#e8303a', 0.1); } });
    g.restore();
  }

  // 空闲时预热：先烘几张大底图和姿势定格，再在离屏画布上按四镜的代表时刻“干画”一遍，把切镜时要用的贴图都先放进缓存（不影响画面）。
  // 只在播放头接近本组（150–214 s）或暂停时做，每次空闲只做一件，不给 requestIdleCallback 设超时
  let dryCv = null;
  function dryDraw(id, lt) {
    const st = XYT.api.state(), tl = st.tl, an = st.an, seg = tl && tl.segments.find((s) => s.scene === id);
    if (!seg || !an || !an.grid || !XYT.scenes[id]) return;
    const S = XYT.sprites.S, t = seg.start + lt, b = an.grid.info(t), ln = seg.line != null && tl.lines ? tl.lines[seg.line] : null;
    if (!dryCv || dryCv.width !== Math.round(W * S)) { dryCv = document.createElement('canvas'); dryCv.width = Math.round(W * S); dryCv.height = Math.round(H * S); }
    const c = {
      t, lt, dur: seg.end - seg.start, p: clamp(lt / Math.max(0.1, seg.end - seg.start)), seg, variant: seg.variant || 0, inten: seg.intensity ?? 0.6, seed: seg.seed || 0, b, grid: an.grid,
      be: (d) => Math.exp(-Math.max(0, b.since) / d) * (0.4 + 0.6 * b.str), de: (d) => Math.exp(-Math.max(0, b.sinceDown) / d), rms: 0, onset: 0, low: 0, high: 0, line: ln,
      charT: (k) => { if (!ln) return null; const v = ln.reveal.filter((x) => x != null); return v.length ? v[Math.max(0, Math.min(v.length - 1, k))] : null; },
    };
    const g = dryCv.getContext('2d'); g.setTransform(S, 0, 0, S, 0, 0);
    g.save(); XYT.scenes[id].draw(g, c); g.restore();
  }
  const WARM = [moonBrush, () => moonBase(112), () => moonBase(176), () => moonFull(176), () => moonFull(104), islandTex, () => bmPlate('bm1', BM1), bmP2Plate, () => bmPlate('bm3', BM3), () => [0, 1, 2].forEach(fatherSpr), () => [0, 1, 2, 3].forEach(foldSpr), () => [4, 5, 6, 7].forEach(foldSpr)];
  for (let q = 0; q <= 8; q += 3) WARM.push(() => { for (let k = q; k < q + 3; k++) anuP2(k); });
  WARM.push(() => twGatePlate(), () => [0, 1, 2].forEach(twHero), () => [0, 1, 2].forEach(twShadowTex), () => { chPairTex(0); chPairTex(1); }, () => { chPairTex(2); chPairTex(3); chMemoryTex(); });
  for (const [id, ts] of [['c2_bloodmoon', [0.3, 2.5, 3.9, 4.05, 4.5, 5.6, 6.3]], ['c2_anu', [0.3, 2.0, 3.0, 3.6, 4.4, 5.5]], ['c2_tower', [0.3, 2.3, 2.8, 3.3, 3.7, 4.5, 5.5]], ['c2_chains', [0.3, 1.5, 4.8, 6.4]]])
    for (const lt of ts) WARM.push(() => dryDraw(id, lt));
  WARM.push(() => { dryCv = null; });
  function songPos() {
    try {
      const st = XYT.api && XYT.api.state && XYT.api.state();
      if (!st) return { pos: 0, playing: false };
      if (!st.playing || !st.actx) return { pos: st.pos || 0, playing: false };
      return { pos: st.startOff + (st.actx.currentTime - st.startCtx), playing: true };
    } catch (e) { return { pos: 0, playing: false }; }
  }
  let wi = 0;
  function warmTick() {
    if (wi >= WARM.length) return;
    // 时间轴里还没有本组镜头（还没载入歌曲与分镜）就先等着
    const sp = songPos(), near = sp.pos > 150 && sp.pos < 214, st = XYT.api && XYT.api.state && XYT.api.state();
    const ready = st && st.tl && st.tl.segments && st.tl.segments.some((s) => s.scene === 'c2_bloodmoon');
    if (!XYT.sprites || !ready || !(near || !sp.playing)) { setTimeout(warmTick, 1500); return; }
    const run = () => { try { WARM[wi](); } catch (e) { /* 预热失败不影响正式绘制 */ } wi++; setTimeout(warmTick, 60); };
    if (window.requestIdleCallback) window.requestIdleCallback(run); else setTimeout(run, 120);
  }
  setTimeout(warmTick, 2500);
})();
