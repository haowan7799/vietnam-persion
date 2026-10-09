/* 分镜镜头 第 14 组：尾奏四镜（雪融春回、渡口反打、渡头小女孩、落款钤印） */
(function () {
  'use strict';
  const XYT = window.XYT;
  if (!XYT || !XYT.registerShot) return;
  const A = XYT.art, K = XYT.kit, E = XYT.env, V = XYT.vfx, F = XYT.fig;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeIn, easeInOut, hash, h2, rng, noise1, noise2, rgba, mix } = A;
  const PI = Math.PI;
  const ss = (a, b, x) => smooth((x - a) / (b - a));
  const SC = () => (XYT.sprites && XYT.sprites.S) || 1;
  const ts0 = (c) => c.t - c.lt;
  // 离歌曲时间 T 最近的拍 / 强拍（分镜给的时刻按真实节拍对齐）
  const nearB = (c, T) => (c.grid.nearest ? c.grid.nearest(T) : c.grid.time(Math.round(c.grid.pos(T))));
  const nearD = (c, T) => (c.grid.nearestDown ? c.grid.nearestDown(T) : nearB(c, T));
  const beatI = (c, T) => Math.round(c.grid.pos(T));
  const backOut = (u) => { if (u <= 0) return 0; if (u >= 1) return 1; const v = u - 1; return 1 + 2.4 * v * v * v + 1.4 * v * v; };
  const glow = (g, x, y, r, col, a) => { if (a > 0.004) A.glow(g, x, y, r, col, a); };
  const withOp = (g, op, fn) => { const o = g.globalCompositeOperation; g.globalCompositeOperation = op; fn(); g.globalCompositeOperation = o; };

  // 书法字体就绪与否（就绪后记下）
  const fontOk = {};
  const fontKey = (txt) => {
    if (fontOk[txt]) return 'f';
    try { if (document.fonts && document.fonts.check('32px "Ma Shan Zheng"', txt)) { fontOk[txt] = 1; return 'f'; } } catch (e) { /* 无字体接口 */ }
    return 'n';
  };
  try { if (document.fonts && document.fonts.load) document.fonts.load('64px "Ma Shan Zheng"', '逍遥叹不见散乙酉年春风送客帆远').catch(() => {}); } catch (e) { /* 无字体接口 */ }
  // 大块静态层：贴的时候关掉插值（软件渲染下快好几倍）
  function blitN(g, img, x, y, w, h) {
    const sm = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(img, x, y, w == null ? img.lw : w, h == null ? img.lh : h);
    g.imageSmoothingEnabled = sm;
  }
  // 屏幕空间整体调色：纯色 multiply + screen 两遍
  function tone(g, mul, mulA, scr, scrA) {
    const cw = g.canvas.width, ch = g.canvas.height, GA = g.globalAlpha;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (mulA > 0.004) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = GA * clamp(mulA); g.fillStyle = mul; g.fillRect(0, 0, cw, ch); }
    if (scrA > 0.004) { g.globalCompositeOperation = 'screen'; g.globalAlpha = GA * clamp(scrA); g.fillStyle = scr; g.fillRect(0, 0, cw, ch); }
    g.restore();
  }
  // 折线插值：pts 为 [x, y]，按 x 求 y
  function polyY(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return lerp(y0, y1, (x - x0) / (x1 - x0)); }
    return pts[pts.length - 1][1];
  }
  // 平滑曲线（Catmull-Rom）穿过 pts，返回采样点
  function spline(pts, n) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let k = 0; k < n; k++) {
        const u = k / n, u2 = u * u, u3 = u2 * u;
        out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  function smoothPath(q, pts) {
    q.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; q.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    const L = pts[pts.length - 1]; q.lineTo(L[0], L[1]);
  }

  // ======================================================================
  // 桃花：工笔小花贴图（五瓣带凹口、花心深、细蕊点金），侧面半开与花苞
  // ======================================================================
  const BLC = [
    ['#fff7f6', '#f7c9d3', '#c9536f'],
    ['#fde4ea', '#f1a3b6', '#bf4262'],
    ['#fbd2dc', '#ea84a0', '#ad3554'],
    ['#fffaf8', '#f9dbe1', '#d26b82'],
  ];
  // rb：旋转档位（正面花按五瓣对称分 6 档，侧面与花苞在 ±60° 内分 5 档），转角烘进贴图，贴的时候只平移缩放
  const blRot = (v, rb) => (v < 4 ? (rb * TAU) / 30 : (rb - 2) * 0.5);
  function blossomTex(v, rb, lo) {
    return K.cache('g14bl|' + v + '|' + rb + (lo ? 'L' : ''), 40, 40, lo ? 0.55 : 2, (q) => {
      const [c1, c2, ce] = BLC[v % 4];
      q.translate(20, 20); q.rotate(blRot(v, rb));
      q.lineJoin = 'round';
      if (v < 4) {
        for (let k = 0; k < 5; k++) {
          const a = k * TAU / 5 + 0.15 * (h2(v, k) - 0.5);
          q.save(); q.rotate(a);
          const gr = q.createRadialGradient(0, 0, 1, 0, -8, 12);
          gr.addColorStop(0, ce); gr.addColorStop(0.32, c2); gr.addColorStop(1, c1);
          q.fillStyle = gr;
          q.beginPath(); q.moveTo(0, 0); q.bezierCurveTo(-8.5, -3, -10.5, -14, -3.6, -17); q.lineTo(0, -14.6); q.lineTo(3.6, -17); q.bezierCurveTo(10.5, -14, 8.5, -3, 0, 0); q.fill();
          q.strokeStyle = rgba(ce, 0.35); q.lineWidth = 0.5; q.stroke();
          q.strokeStyle = 'rgba(255,255,255,0.5)'; q.lineWidth = 0.8;
          q.beginPath(); q.moveTo(-1, -2); q.quadraticCurveTo(-6, -8, -4, -14); q.stroke();
          q.restore();
        }
        q.fillStyle = ce; q.beginPath(); q.arc(0, 0, 2.6, 0, TAU); q.fill();
        q.strokeStyle = rgba(ce, 0.85); q.lineWidth = 0.55;
        for (let k = 0; k < 11; k++) {
          const a = k * TAU / 11 + 0.2, l = 5 + (k % 3) * 1.3;
          q.beginPath(); q.moveTo(Math.cos(a) * 1.6, Math.sin(a) * 1.6); q.lineTo(Math.cos(a) * l, Math.sin(a) * l); q.stroke();
        }
        q.fillStyle = '#f5d468';
        for (let k = 0; k < 11; k++) { const a = k * TAU / 11 + 0.2, l = 5 + (k % 3) * 1.3; q.beginPath(); q.arc(Math.cos(a) * l, Math.sin(a) * l, 0.85, 0, TAU); q.fill(); }
      } else if (v < 6) {
        // 侧面半开：三瓣合成小杯，底下一点花萼
        const [p1, p2, pe] = BLC[v - 4 + 1];
        q.fillStyle = '#7a3a2a'; q.beginPath(); q.ellipse(0, 6, 3.4, 2.4, 0, 0, TAU); q.fill();
        for (const [dx, rot, sc] of [[-5, -0.5, 0.9], [5, 0.5, 0.9], [0, 0, 1]]) {
          q.save(); q.translate(dx * 0.6, 5); q.rotate(rot); q.scale(sc, sc);
          const gr = q.createLinearGradient(0, 2, 0, -14);
          gr.addColorStop(0, pe); gr.addColorStop(0.4, p2); gr.addColorStop(1, p1);
          q.fillStyle = gr;
          q.beginPath(); q.moveTo(0, 0); q.bezierCurveTo(-7, -2, -8, -11, -2.5, -14); q.lineTo(0, -12.4); q.lineTo(2.5, -14); q.bezierCurveTo(8, -11, 7, -2, 0, 0); q.fill();
          q.strokeStyle = rgba(pe, 0.35); q.lineWidth = 0.5; q.stroke();
          q.restore();
        }
      } else {
        // 花苞
        q.fillStyle = '#6e3426'; q.beginPath(); q.ellipse(0, 4, 2.6, 2, 0, 0, TAU); q.fill();
        const gr = q.createLinearGradient(0, 4, 0, -8);
        gr.addColorStop(0, '#c23e5c'); gr.addColorStop(1, '#f6a8ba');
        q.fillStyle = gr; q.beginPath(); q.ellipse(0, -1.5, 4, 6, 0, 0, TAU); q.fill();
        q.strokeStyle = 'rgba(255,255,255,0.45)'; q.lineWidth = 0.7; q.beginPath(); q.arc(-1, -2, 3, 3.6, 4.6); q.stroke();
      }
    });
  }

  // ======================================================================
  // 桃树：枝干折枝（墨色，迎光一侧淡赭提亮），花按枝梢成簇；根在 (0,0)，向上为负 y
  // o: trunk 主干高, lean 主干斜, dir 主枝偏向, len 主枝长, w 主枝粗, n 主枝数, fs 花大小, dens 花量
  // ======================================================================
  const trees = {};
  function treeGeo(seed, o) {
    const key = 'tg' + seed;
    if (trees[key]) return trees[key];
    const r = rng(seed * 7 + 3), segs = [], fl = [];
    const th = o.trunk ?? 150, lean = o.lean ?? 0, dir = o.dir ?? 0, fs = o.fs ?? 1, dens = o.dens ?? 1;
    const top = [lean * th, -th];
    const cluster = (x, y, gen) => {
      if (r() > dens) return;
      const m = 1 + Math.floor(r() * 3);
      for (let k = 0; k < m; k++) {
        const rv = r();
        const v = rv < 0.1 ? 6 : rv < 0.24 ? 4 + Math.floor(r() * 2) : Math.floor(r() * 4);
        const rot = r();
        fl.push({ x: x + (r() - 0.5) * 20, y: y + (r() - 0.5) * 16, s: (5.6 + r() * 3.8) * fs * (v === 6 ? 0.7 : 1), rot: rot * TAU, rb: Math.floor(rot * (v < 4 ? 6 : 5)), v, h: r() });
      }
    };
    const limb = (x, y, a, len, w, depth, gen) => {
      const steps = Math.max(3, Math.round(len / 11));
      let cx = x, cy = y, ca = a;
      for (let i = 0; i < steps; i++) {
        const nx = cx + (Math.cos(ca) * len) / steps, ny = cy + (Math.sin(ca) * len) / steps;
        const w0 = w * (1 - (i / steps) * 0.5), w1 = w * (1 - ((i + 1) / steps) * 0.5);
        segs.push([cx, cy, nx, ny, Math.max(0.7, w0), Math.max(0.6, w1)]);
        cx = nx; cy = ny;
        // 折枝：每段拐一下，略往上收
        ca += (r() - 0.5) * 0.62 + ((o.aim ?? -PI / 2 + dir * 0.5) - ca) * (o.pull ?? 0.06);
        if (depth > 0 && r() < 0.38) limb(cx, cy, ca + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.6), len * (0.4 + r() * 0.32), w1 * 0.66, depth - 1, gen + 1);
        if (w1 < 4.6 && r() < (o.cl ?? 0.15)) cluster(cx, cy, gen);
      }
      cluster(cx, cy, gen + 1);
    };
    const n = o.n ?? 5, L = o.len ?? 140, w = o.w ?? 9;
    for (let k = 0; k < n; k++) {
      const a = o.angles ? o.angles[k] : -PI / 2 + dir * 0.32 + (k / (n - 1) - 0.5) * (o.spread ?? 2.3) + (r() - 0.5) * 0.25;
      limb(top[0], top[1], a, L * (0.75 + r() * 0.45), w * (0.8 + r() * 0.3), 3, 0);
    }
    // 主干下段斜出的一两枝
    for (let k = 0; k < (o.low ?? 2); k++) {
      const u = 0.45 + r() * 0.3, sd = k % 2 ? -1 : 1;
      limb(top[0] * u, top[1] * u, -PI / 2 + sd * (0.9 + r() * 0.4) + dir * 0.2, L * (0.45 + r() * 0.3), w * 0.6, 2, 1);
    }
    let x0 = -30, y0 = -th - 20, x1 = 30, y1 = 10;
    for (const s of segs) { x0 = Math.min(x0, s[0], s[2]); x1 = Math.max(x1, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]); }
    for (const f of fl) { x0 = Math.min(x0, f.x - 14); x1 = Math.max(x1, f.x + 14); y0 = Math.min(y0, f.y - 14); y1 = Math.max(y1, f.y + 14); }
    x0 = Math.floor(x0 - 26); y0 = Math.floor(y0 - 26); x1 = Math.ceil(x1 + 26); y1 = Math.ceil(y1 + 6);
    // 开花延迟：离根越远越晚一点（同一拍里由内向外绽开）
    let R = 1;
    for (const f of fl) R = Math.max(R, Math.hypot(f.x, f.y + th * 0.6));
    for (const f of fl) f.d = 0.12 * (Math.hypot(f.x, f.y + th * 0.6) / R) + 0.04 * f.h;
    // 树冠中心（花的平均位置）：开花那一下花瓣从这里向外迸散
    let cx = 0, cy = 0;
    for (const f of fl) { cx += f.x; cy += f.y; }
    const T = { seed, segs, fl, box: [x0, y0, x1 - x0, y1 - y0], top, th, o, crown: fl.length ? [cx / fl.length, cy / fl.length] : [0, -th] };
    trees[key] = T;
    return T;
  }
  function trunkPath(q, T, k) {
    const [tx, ty] = T.top, bw = (T.o.base ?? 13) * k, tw = (T.o.w ?? 9) * 0.75 * k;
    q.beginPath();
    if (!T.th) return;
    q.moveTo(-bw * 1.5, 2);
    q.bezierCurveTo(-bw * 0.8, -T.th * 0.3, tx - tw - 6, ty + T.th * 0.4, tx - tw, ty);
    q.lineTo(tx + tw, ty);
    q.bezierCurveTo(tx + tw + 8, ty + T.th * 0.45, bw * 0.7, -T.th * 0.25, bw * 1.6, 2);
    q.closePath();
  }
  // rim：[x, y] 指向太阳的方向，枝干迎光一侧勾一道 1 像素金线（null 不画）
  const rimKey = (rim) => (rim ? rim[0].toFixed(2) + ',' + rim[1].toFixed(2) : '-');
  function treeBare(T, ink, rim) {
    const [bx, by, bw, bh] = T.box;
    return K.cache('g14tree|' + T.seed + '|bare|' + ink + rimKey(rim), bw, bh, T.o.res ?? 1.25, (q) => {
      q.translate(-bx, -by);
      q.lineCap = 'round'; q.lineJoin = 'round';
      // 主干：墨色由下而上渐淡，迎光一侧淡赭
      trunkPath(q, T, 1);
      q.fillStyle = K.lin(q, -20, 0, 20, 0, [[0, mix(ink, '#000000', 0.25)], [0.6, ink], [1, mix(ink, '#9a7c64', 0.45)]]); q.fill();
      const r = rng(T.seed + 11);
      q.strokeStyle = 'rgba(200,170,140,0.28)';
      for (let i = 0; i < 9; i++) { const u = r(); q.lineWidth = 0.8 + r() * 1.5; q.beginPath(); q.moveTo(lerp(-8, T.top[0], u) + (r() - 0.3) * 8, -T.th * u); q.quadraticCurveTo(lerp(-6, T.top[0], u + 0.1) + 6, -T.th * (u + 0.08), lerp(-4, T.top[0], u + 0.2) + (r() - 0.5) * 6, -T.th * (u + 0.18)); q.stroke(); }
      for (const s of T.segs) {
        q.strokeStyle = ink; q.lineWidth = (s[4] + s[5]) / 2;
        q.beginPath(); q.moveTo(s[0], s[1]); q.lineTo(s[2], s[3]); q.stroke();
      }
      q.strokeStyle = 'rgba(176,140,112,0.42)';
      for (const s of T.segs) {
        if (s[4] < 1.8) continue;
        q.lineWidth = s[4] * 0.3;
        q.beginPath(); q.moveTo(s[0] + s[4] * 0.22, s[1] - s[4] * 0.18); q.lineTo(s[2] + s[5] * 0.22, s[3] - s[5] * 0.18); q.stroke();
      }
      // 迎光金边：枝干朝太阳的一侧
      if (rim) {
        const [rx, ry] = rim;
        q.strokeStyle = '#ffd88c'; q.lineWidth = 1;
        for (const s of T.segs) {
          if (s[4] < 1.3) continue;
          const dx = s[2] - s[0], dy = s[3] - s[1], l = Math.hypot(dx, dy) || 1;
          let nx = -dy / l, ny = dx / l, d = nx * rx + ny * ry;
          if (d < 0) { nx = -nx; ny = -ny; d = -d; }
          if (d < 0.2) continue;
          q.globalAlpha = 0.35 + 0.55 * d;
          q.beginPath(); q.moveTo(s[0] + nx * s[4] * 0.42, s[1] + ny * s[4] * 0.42); q.lineTo(s[2] + nx * s[5] * 0.42, s[3] + ny * s[5] * 0.42); q.stroke();
        }
        q.globalAlpha = 1;
        q.save(); trunkPath(q, T, 1); q.clip();
        q.translate(-rx * 2, -ry * 2); trunkPath(q, T, 1);
        q.strokeStyle = 'rgba(255,214,140,0.85)'; q.lineWidth = 2.2; q.stroke();
        q.restore();
      }
      // 苔点
      q.fillStyle = mix(ink, '#000000', 0.3);
      for (let i = 0; i < 26; i++) { const s = T.segs[Math.floor(r() * T.segs.length)]; if (s[4] < 2.5) continue; q.beginPath(); q.ellipse(s[0] + (r() - 0.5) * 4, s[1] - s[4] * 0.4, 1.4 + r() * 1.4, 0.9 + r(), r(), 0, TAU); q.fill(); }
      // 冬末的小花苞
      q.fillStyle = '#9a4256';
      for (const f of T.fl) if (f.h < 0.55) { q.beginPath(); q.ellipse(f.x, f.y, 1.3 * (T.o.fs ?? 1), 1.8 * (T.o.fs ?? 1), f.rot, 0, TAU); q.fill(); }
    });
  }
  function treeSnow(T) {
    const [bx, by, bw, bh] = T.box;
    return K.cache('g14tree|' + T.seed + '|snow', bw, bh, T.o.res ?? 1.25, (q) => {
      q.translate(-bx, -by);
      q.lineCap = 'round';
      const r = rng(T.seed + 21);
      for (const s of T.segs) {
        const dx = s[2] - s[0], dy = s[3] - s[1];
        if (Math.abs(dy) > Math.abs(dx) * 1.6 || s[4] < 1.1) continue;
        const w = s[4];
        // 枝上积雪：上沿亮白、下沿一线淡青灰
        q.strokeStyle = '#c4d2de'; q.lineWidth = w * 0.75 + 1.8;
        q.beginPath(); q.moveTo(s[0], s[1] - w * 0.45); q.lineTo(s[2], s[3] - s[5] * 0.45); q.stroke();
        q.strokeStyle = r() < 0.5 ? '#fbfcfd' : '#eef3f7'; q.lineWidth = w * 0.75 + 1.1;
        q.beginPath(); q.moveTo(s[0], s[1] - w * 0.62); q.lineTo(s[2], s[3] - s[5] * 0.62); q.stroke();
        if (r() < 0.25) { q.fillStyle = '#f7fafc'; q.beginPath(); q.ellipse(s[2], s[3] - w * 0.6, w * 1.2 + 1.5, w * 0.6 + 1, Math.atan2(dy, dx), 0, TAU); q.fill(); }
      }
      // 主干迎雪一侧
      q.save(); trunkPath(q, T, 1); q.clip();
      q.strokeStyle = 'rgba(246,249,252,0.85)'; q.lineWidth = 4;
      q.beginPath(); q.moveTo(-T.o.base * 1.4, -4); q.bezierCurveTo(-T.o.base * 0.8, -T.th * 0.3, T.top[0] - 10, T.top[1] + T.th * 0.4, T.top[0] - 6, T.top[1]); q.stroke();
      q.restore();
    });
  }
  function treeHaze(T) {
    const [bx, by, bw, bh] = T.box;
    return K.cache('g14tree|' + T.seed + '|haze', bw, bh, 0.5, (q) => {
      q.translate(-bx, -by);
      for (let i = 0; i < T.fl.length; i += 3) { const f = T.fl[i]; A.softBlob(q, f.x, f.y, 26 * (T.o.fs ?? 1), 0.13, '#f6b6c6'); }
    });
  }
  function blossomPut(g, f, k) {
    if (k <= 0.01) return;
    const d = f.s * k * (40 / 17);
    g.drawImage(blossomTex(f.v, f.rb), f.x - d / 2, f.y - d / 2, d, d);
  }
  // 开花分四档预先画好（每档每朵花按各自的延迟胀到不同大小），逐帧只在相邻两档之间交叉淡化
  const BL_A = [0.05, 0.11, 0.19, 0.3], BL_END = 0.44, BL_GROW = 0.26;
  function treeStage(T, ink, rim, j) {
    const [bx, by, bw, bh] = T.box, a = j < 4 ? BL_A[j] : 9;
    return K.cache('g14tree|' + T.seed + '|st' + j + '|' + ink + rimKey(rim), bw, bh, T.o.res ?? 1.25, (q) => {
      q.globalAlpha = clamp(a / 0.5); q.drawImage(treeHaze(T), 0, 0, bw, bh); q.globalAlpha = 1;
      q.drawImage(treeBare(T, ink, rim), 0, 0, bw, bh);
      q.translate(-bx, -by);
      for (const f of T.fl) blossomPut(q, f, j < 4 ? backOut((a - f.d) / BL_GROW) : 1);
    });
  }
  // 开满花后的整树（花雾 + 枝 + 花）
  const treeFull = (T, ink, rim) => treeStage(T, ink, rim || null, 4);
  // 冬末的枝：枝干 + 第 k 层的积雪合成一张（雪退一层换一张）
  const TREE_SNOW = [1, 0.6, 0.22, 0, 0];
  function treeWinter(T, ink, rim, k) {
    if (TREE_SNOW[k] <= 0) return treeBare(T, ink, rim);
    const [, , bw, bh] = T.box;
    return K.cache('g14tree|' + T.seed + '|w' + k + '|' + ink + rimKey(rim), bw, bh, T.o.res ?? 1.25, (q) => {
      q.drawImage(treeBare(T, ink, rim), 0, 0, bw, bh);
      q.globalAlpha = TREE_SNOW[k]; q.drawImage(treeSnow(T), 0, 0, bw, bh);
    });
  }
  // 画一棵树：bloomAt 开花起点（歌曲时间），snowSt 雪退的层数（0..4，按层换图），sway 摆角，rim 迎光金边方向
  function drawTree(g, T, x, y, s, t, o) {
    const [bx, by, bw, bh] = T.box, ink = o.ink || '#2f2420', rim = o.rim || null;
    const age = o.bloomAt == null ? -1 : t - o.bloomAt, GA = o.alpha ?? 1, sst = o.snowSt ?? 4;
    const sk = Math.min(4, Math.floor(sst)), sf = sst - sk, snowA = lerp(TREE_SNOW[sk], TREE_SNOW[Math.min(4, sk + 1)], sf);
    g.save(); g.translate(x, y); g.rotate(o.sway || 0); g.scale(s, s);
    if (o.nn) g.imageSmoothingEnabled = false;
    const put = (img, a) => { if (a <= 0.003) return; g.globalAlpha = Math.min(1, a) * GA; g.drawImage(img, bx, by, bw, bh); };
    if (age >= BL_END) put(treeFull(T, ink, rim), 1);
    else if (age < 0) { put(treeWinter(T, ink, rim, sk), 1); if (sk < 4 && sf > 0.01) put(treeWinter(T, ink, rim, sk + 1), sf); }
    else if (age < BL_A[0]) { put(treeBare(T, ink, rim), 1); put(treeStage(T, ink, rim, 0), age / BL_A[0]); }
    else {
      let j = 0;
      while (j < 3 && age >= BL_A[j + 1]) j++;
      const a0 = BL_A[j], a1 = j < 3 ? BL_A[j + 1] : BL_END;
      put(treeStage(T, ink, rim, j), 1);
      put(treeStage(T, ink, rim, j + 1), (age - a0) / (a1 - a0));
    }
    if (age >= 0 && snowA > 0.01) put(treeSnow(T), snowA);
    g.globalAlpha = 1; g.imageSmoothingEnabled = true;
    g.restore();
  }
  // 桃瓣贴图（借工具包的花瓣）
  const petalImg = (ci) => V.util.petalTex('peach', ci);
  // 预先转好角度的小花瓣（16 档），逐片只平移缩放、不改变换（大量花瓣时省一半时间）
  const PR_N = 16;
  const petalRot = (ci, rot) => {
    const b = ((Math.round((rot / PI) * PR_N) % PR_N) + PR_N) % PR_N;
    return K.cache('g14pr|' + ci + '|' + b, 34, 34, 1.5, (q) => { q.translate(17, 17); q.rotate((b / PR_N) * PI); q.drawImage(petalImg(ci), -14, -14, 28, 28); });
  };
  // 一片花瓣：sz 大小，rot 转角，fx 翻面（-1..1，按宽度压扁），sy 纵向压扁（水面上的透视）
  function putPetal(g, ci, x, y, sz, rot, fx, sy) {
    const k = Math.max(0.15, Math.abs(fx)), w = sz * (34 / 28) * k, h = sz * (34 / 28) * (sy || 1);
    g.drawImage(petalRot(ci, rot), x - w / 2, y - h / 2, w, h);
  }
  // 一阵春风把花瓣从树上吹落：从花位出发，顺风飘向 dir 一侧，边飘边翻
  function petalGust(g, T, x, y, s, t, tB, o) {
    const n = o.n || 60, seed = o.seed || 1, dir = o.dir || 1, life = o.life || 5;
    for (let j = 0; j < n; j++) {
      const f = T.fl[Math.floor(h2(j, seed) * T.fl.length)];
      const te = tB + f.d + 0.35 + Math.pow(h2(j, seed + 1), 0.8) * (o.spread || 2.4), age = t - te;
      if (age < 0 || age > life) continue;
      const z = h2(j, seed + 2), vx = (60 + 120 * h2(j, seed + 3)) * dir * (0.6 + 0.6 * z), vy = 22 + 30 * h2(j, seed + 4);
      const ph = h2(j, seed + 5) * TAU;
      const px = x + f.x * s + vx * age * (1 - 0.18 * Math.min(1, age / 3)) + Math.sin(age * 1.8 + ph) * 16;
      const py = y + f.y * s + vy * age - 26 * (1 - Math.exp(-age * 1.6)) + Math.sin(age * 2.6 + ph) * 7;
      if (px < -40 || px > W + 40 || py > H + 30) continue;
      const sz = (o.size || 13) * (0.55 + 0.75 * z), spin = age * (1.5 + 2 * h2(j, seed + 6)) + ph;
      const fx = Math.cos(age * (2.4 + h2(j, seed + 7) * 2) + ph);
      g.globalAlpha = (o.alpha ?? 1) * ss(0, 0.15, age) * (1 - ss(life - 0.8, life, age));
      putPetal(g, j % 3, px, py, sz, spin, fx);
    }
    g.globalAlpha = 1;
  }

  // ======================================================================
  // o1_spring 雪融春回：仙灵岛延时——承接满屏红：红瓣在一拍内化成金色光尘、日轮留在原处；
  // 每拍雪退一层、溪水涨一段、冰面化开；4:57.33 强拍两岸桃树一齐开花，第一阵春风把花瓣吹过溪面；溪面随拍起涟漪
  // ======================================================================
  const O1 = { hz: 396, pan: 64, sx: 900, sy: 262, sr: 50 };
  // 溪流中线（地面层坐标），从左上远处弯到右下近处
  const O1S = spline([[318, 401], [400, 409], [520, 420], [640, 436], [692, 456], [646, 480], [548, 505], [474, 536], [494, 576], [604, 616], [764, 662], [906, 716], [990, 790]], 10);
  (function () {
    let L = 0; O1S[0].push(0);
    for (let i = 1; i < O1S.length; i++) { L += Math.hypot(O1S[i][0] - O1S[i - 1][0], O1S[i][1] - O1S[i - 1][1]); O1S[i].push(L); }
    for (const p of O1S) p[2] /= L;
  })();
  const o1W = (y, rise) => (Math.max(0, y - O1.hz + 4) * 0.7 + 2) * rise * 0.5;   // 半宽
  function o1AtRaw(u) {
    const n = O1S.length - 1;
    let i = 0;
    while (i < n - 1 && O1S[i + 1][2] < u) i++;
    const a = O1S[i], b = O1S[i + 1], k = clamp((u - a[2]) / Math.max(1e-6, b[2] - a[2]));
    const x = lerp(a[0], b[0], k), y = lerp(a[1], b[1], k), dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
    return [x, y, dx / dl, dy / dl];
  }
  // 查表（2048 段线性插值），逐帧几百次取点不再逐段搜索
  const O1LUT = (() => { const N = 2048, a = new Float32Array((N + 1) * 4); for (let i = 0; i <= N; i++) { const p = o1AtRaw(i / N); a.set(p, i * 4); } return a; })();
  function o1At(u) {
    const f = clamp(u) * 2048, i = Math.min(2047, Math.floor(f)), k = f - i, o = i * 4;
    return [O1LUT[o] + (O1LUT[o + 4] - O1LUT[o]) * k, O1LUT[o + 1] + (O1LUT[o + 5] - O1LUT[o + 1]) * k, O1LUT[o + 2], O1LUT[o + 3]];
  }
  // 岸线起伏（静态，按 u 取）：宽窄不一，有回湾也有窄口
  const o1Wob = (u, sd) => 1 + 0.25 * Math.sin(u * 17 + sd) + 0.12 * Math.sin(u * 43 + sd * 2);
  // 岸上一点：side -1 左岸、1 右岸，ex 再往岸上让出的距离
  function o1Bank(u, side, ex, rise) {
    const [x, y, tx, ty] = o1At(u), w = o1W(y, rise ?? 1) * o1Wob(u, side < 0 ? 1 : 4) + (ex || 0);
    return side < 0 ? [x - ty * w, y + tx * w * 0.5, y] : [x + ty * w, y - tx * w * 0.5, y];
  }
  // 两侧青绿山：后排高、前排低
  const O1HILLS = [
    { pts: [[-130, 336], [-50, 302], [30, 284], [110, 288], [190, 312], [250, 344], [306, 376], [356, 396], [410, 408]], bot: 470, sd: 5, c: ['#4a9a8e', '#79b79a', '#c4c592'] },
    { pts: [[690, 446], [760, 420], [850, 390], [940, 360], [1020, 336], [1100, 320], [1170, 322], [1250, 338], [1410, 366]], bot: 486, sd: 9, c: ['#4a9a8e', '#79b79a', '#c4c592'] },
    { pts: [[-130, 392], [-30, 372], [70, 370], [160, 384], [240, 404], [300, 418]], bot: 480, sd: 13, c: ['#3f8c80', '#6aaa8e', '#b8bf8a'] },
    { pts: [[860, 448], [950, 424], [1050, 408], [1150, 404], [1260, 412], [1410, 424]], bot: 490, sd: 17, c: ['#3f8c80', '#6aaa8e', '#b8bf8a'] },
  ];
  // 谷中两排更近的青绿小丘（石青顶、金线勾），夹着溪流一层层往远处退
  const O1BANKS = [
    { pts: [[-130, 500], [-40, 478], [50, 468], [130, 476], [200, 466], [276, 474], [340, 490], [392, 508], [430, 532]], bot: 600, sd: 23, c: ['#2f817c', '#5ea488', '#aab77e'] },
    { pts: [[748, 522], [800, 498], [866, 482], [940, 470], [1010, 476], [1080, 466], [1160, 460], [1250, 470], [1410, 486]], bot: 610, sd: 29, c: ['#2f817c', '#5ea488', '#aab77e'] },
  ];
  const o1Top = (x) => {
    let y = O1.hz;
    for (const h of O1HILLS) if (x >= h.pts[0][0] && x <= h.pts[h.pts.length - 1][0]) y = Math.min(y, polyY(h.pts, x));
    return y;
  };
  const O1G = { x0: -120, y0: 270, w: W + 240, h: 450 };
  // 天：青白天顶、金色天边，日晕，几缕受光的薄云（不含山，日轮夹在天与山之间）
  function o1Sky() {
    return K.cache('g14o1sky', W + 160, O1.hz + 24, 1, (q) => {
      q.translate(80, 0);
      E.sky(q, { stops: [[0, '#d6e6e4'], [0.38, '#ebeedd'], [0.72, '#f8e4b6'], [1, '#f7d79c']], y1: O1.hz + 22, haze: '#fbe0a8', hazeY: O1.hz, hazeA: 0.55 });
      A.softBlob(q, O1.sx, O1.sy + 20, 680, 0.4, '#ffd48a');
      A.softBlob(q, O1.sx, O1.sy, 260, 0.32, '#ffe8b8');
      const r = rng(41);
      for (let i = 0; i < 7; i++) { const x = 600 + r() * 700, y = 110 + r() * 170; E.util.streak(q, x, y, 140 + r() * 240, 4 + r() * 6, '#fff7e6', 0.4 + r() * 0.25, -0.05 + r() * 0.04); E.util.streak(q, x + 10, y + 5, 120 + r() * 160, 2 + r() * 2, '#f0c27a', 0.22, -0.05); }
      for (let i = 0; i < 5; i++) E.util.streak(q, 60 + r() * 500, 120 + r() * 120, 100 + r() * 160, 3 + r() * 5, '#f6f4ea', 0.3, -0.04);
    });
  }
  // 远山：青绿远山、石林，日轮右半边藏在一根石笋后面
  function o1Mtn() {
    return K.cache('g14o1mtn', W + 160, O1.hz + 24, 1, (q) => {
      q.translate(80, 0);
      E.mountains(q, { t: 0, lightDir: 1, fog: '#eef0e2', fogA: 0.6, layers: [
        { kind: 'far', color: '#bcd2cf', light: '#f8e6bc', litA: 0.6, y: O1.hz + 4, scaleY: 0.5, seed: 61, offset: 420, speed: 0, fogH: 90, fogY: 10 },
        { kind: 'karst', color: '#a6c4be', light: '#f3dca6', litA: 0.55, y: O1.hz + 8, scaleY: 0.42, seed: 23, offset: 1220, speed: 0, fogH: 70, fogY: 8 },
      ] });
      // 日轮前的几根远石笋：淡青剪影没在雾里，迎日一侧一线金（日轮右半边藏在后面）
      for (const [x, h, w, sd, a] of [[858, 86, 34, 3, 0.75], [1004, 112, 40, 7, 0.85], [926, 168, 54, 5, 1]]) o1Karst(q, x, O1.hz + 8, h, w, sd, a);
      q.fillStyle = K.lin(q, 0, O1.hz - 60, 0, O1.hz + 20, [[0, 'rgba(246,238,214,0)'], [1, 'rgba(246,238,214,0.7)']]); q.fillRect(-80, O1.hz - 60, W + 160, 84);
    });
  }
  // 远石笋：圆顶、腰身略有起伏，上青下白没进雾里；迎日一侧（左）勾一线金，几笔竖皴
  function o1Karst(q, x, base, h, w, sd, a) {
    const r = rng(sd * 17 + 3), N = 14, Lp = [], Rp = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, y = base - h * u, bulge = 1 - Math.pow(u, 6) * 0.55 + 0.08 * Math.sin(u * 9 + sd);
      Lp.push([x - (w / 2) * bulge * (0.9 + 0.2 * r()), y]); Rp.push([x + (w / 2) * bulge * (0.9 + 0.2 * r()), y]);
    }
    const path = () => { q.beginPath(); q.moveTo(Lp[0][0], Lp[0][1]); for (const p of Lp) q.lineTo(p[0], p[1]); q.quadraticCurveTo(x, base - h - w * 0.28, Rp[N][0], Rp[N][1]); for (let i = N; i >= 0; i--) q.lineTo(Rp[i][0], Rp[i][1]); q.closePath(); };
    q.globalAlpha = a;
    path(); q.fillStyle = K.lin(q, 0, base - h, 0, base, [[0, '#9fbdb8'], [0.55, '#b8cfc8'], [1, '#eef0e2']]); q.fill();
    q.save(); path(); q.clip();
    q.strokeStyle = 'rgba(70,110,104,0.25)'; q.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const xx = x + (r() - 0.4) * w * 0.8, y0 = base - h * (0.5 + 0.45 * r()); q.beginPath(); q.moveTo(xx, y0); q.quadraticCurveTo(xx + 2, y0 + 16, xx - 1, y0 + 30 + r() * 20); q.stroke(); }
    q.fillStyle = K.lin(q, x - w / 2, 0, x + w / 2, 0, [[0, 'rgba(255,232,180,0.35)'], [0.35, 'rgba(255,232,180,0)'], [1, 'rgba(60,90,90,0.12)']]); q.fillRect(x - w, base - h - w, w * 2, h + w);
    q.restore();
    q.strokeStyle = 'rgba(255,222,150,0.9)'; q.lineWidth = 1.4; q.beginPath();
    for (let i = 3; i <= N; i++) i === 3 ? q.moveTo(Lp[i][0] + 0.6, Lp[i][1]) : q.lineTo(Lp[i][0] + 0.6, Lp[i][1]);
    q.quadraticCurveTo(x - w * 0.15, base - h - w * 0.22, x + w * 0.1, base - h - w * 0.2); q.stroke();
    q.fillStyle = 'rgba(70,104,92,0.7)';
    for (let i = 0; i < 5; i++) { q.beginPath(); q.ellipse(x + (r() - 0.5) * w * 0.5, base - h - w * 0.12 + r() * 4, 2 + r() * 2, 1.4 + r(), 0, 0, TAU); q.fill(); }
    q.globalAlpha = 1;
  }
  // 天 + 日轮 + 远山一张贴图（日轮半藏在石笋后）
  function o1SkyAll() {
    return K.cache('g14o1skyall', W + 160, O1.hz + 24, 1, (q) => {
      q.drawImage(o1Sky(), 0, 0, W + 160, O1.hz + 24);
      const sx = O1.sx + 80, sy = O1.sy;
      q.globalCompositeOperation = 'lighter'; A.glow(q, sx, sy, 260, '#ffb850', 0.32); A.glow(q, sx, sy, 90, '#ffe0a0', 0.25); q.globalCompositeOperation = 'source-over';
      q.fillStyle = K.rad(q, sx, sy, 0, O1.sr, [[0, '#fff8e2'], [0.55, '#ffe6a6'], [0.85, '#ffcc6a'], [1, '#f6b450']]);
      q.beginPath(); q.arc(sx, sy, O1.sr, 0, TAU); q.fill();
      q.drawImage(o1Mtn(), 0, 0, W + 160, O1.hz + 24);
    });
  }
  // 天与远山的倒影：上下翻转、糊开（溪面映的天光）
  function o1SkyRefl() {
    return K.cache('g14o1skyr', W + 160, O1.hz + 24, 0.35, (q) => {
      if ('filter' in q) q.filter = `blur(${(4 * 0.35 * SC()).toFixed(2)}px)`;
      q.translate(0, O1.hz + 24); q.scale(1, -1);
      q.drawImage(o1Sky(), 0, 0, W + 160, O1.hz + 24); q.drawImage(o1Mtn(), 0, 0, W + 160, O1.hz + 24);
      q.filter = 'none';
    });
  }
  // 青绿小山：石青山头、石绿山腰、赭石山脚，披麻皴、横雾、受光
  function o1Hill(q, h, light) {
    const pts = h.pts, bottom = h.bot, sd = h.sd;
    q.beginPath(); smoothPath(q, pts); q.lineTo(pts[pts.length - 1][0], bottom); q.lineTo(pts[0][0], bottom); q.closePath();
    const ymin = Math.min(...pts.map((p) => p[1]));
    q.fillStyle = K.lin(q, 0, ymin, 0, bottom, [[0, h.c[0]], [0.4, h.c[1]], [0.78, h.c[2]], [1, 'rgba(206,196,146,0)']]);
    q.fill();
    q.save(); q.clip();
    const rr = rng(sd);
    q.save(); q.translate(0, 10); q.beginPath(); smoothPath(q, pts); q.restore();
    q.strokeStyle = 'rgba(30,110,108,0.38)'; q.lineWidth = 26; q.stroke();
    for (let i = 0; i < 130; i++) {
      const x = lerp(pts[0][0], pts[pts.length - 1][0], rr()), y0 = polyY(pts, x) + 2 + Math.pow(rr(), 2) * 46, l = 5 + rr() * 13;
      const sl = (polyY(pts, x + 4) - polyY(pts, x - 4)) / 8;
      q.strokeStyle = rr() < 0.75 ? `rgba(30,88,80,${0.08 + rr() * 0.12})` : `rgba(240,236,196,${0.1 + rr() * 0.12})`; q.lineWidth = 0.7 + rr() * 1.1;
      q.beginPath(); q.moveTo(x, y0); q.quadraticCurveTo(x + sl * 6 - 2, y0 + l * 0.5, x + sl * 10 - 3 + (rr() - 0.5) * 4, y0 + l); q.stroke();
    }
    for (let i = 0; i < 2; i++) {
      const x = lerp(pts[1][0], pts[pts.length - 2][0], 0.3 + 0.4 * rr()), y = polyY(pts, x) + 30 + rr() * 24;
      A.softBlob(q, x, y, 120, 0.25, '#f0f2e8'); A.softBlob(q, x + 110, y + 6, 90, 0.22, '#f0f2e8');
    }
    // 受光：太阳在 x≈900，朝日一侧暖
    q.fillStyle = K.rad(q, O1.sx, O1.sy, 60, 760, [[0, `rgba(255,226,170,${light})`], [1, 'rgba(255,226,170,0)']]);
    q.fillRect(pts[0][0], ymin, pts[pts.length - 1][0] - pts[0][0], bottom - ymin);
    q.restore();
    for (let i = 0; i < 22; i++) {
      const x = lerp(pts[1][0], pts[pts.length - 2][0], rr()), y = polyY(pts, x) + 3 + rr() * 8, s = 2 + rr() * 2.5;
      q.fillStyle = `rgba(28,70,60,${0.5 + rr() * 0.3})`;
      for (let k = 0; k < 4; k++) { q.beginPath(); q.ellipse(x + (rr() - 0.5) * s * 2, y - s * (0.6 + rr()), s * 0.8, s * 0.6, 0, 0, TAU); q.fill(); }
      q.fillStyle = 'rgba(40,50,40,0.6)'; q.fillRect(x - 0.5, y - s, 1, s + 1);
    }
  }
  // 地面（谷地、两侧青绿山、谷中小丘、远处水月宫）：春版；冬版由它去饱和得来
  function o1Ground() {
    return K.cache('g14o1gnd|spring', O1G.w, O1G.h, 1, (q) => {
      q.translate(-O1G.x0, -O1G.y0);
      const hz = O1.hz;
      q.fillStyle = K.lin(q, 0, hz, 0, H, [[0, '#dce7d4'], [0.25, '#bcd8b6'], [0.6, '#99c6a0'], [1, '#7cb28f']]);
      q.fillRect(O1G.x0, hz - 2, O1G.w, H - hz + 4);
      const r = rng(77);
      for (let i = 0; i < 260; i++) {
        const u = Math.pow(r(), 0.8), y = hz + 6 + u * (H - hz), x = O1G.x0 + r() * O1G.w, l = (10 + r() * 50) * (0.3 + u * 1.6);
        q.strokeStyle = r() < 0.5 ? `rgba(70,120,90,${0.08 + r() * 0.1})` : `rgba(240,236,200,${0.1 + r() * 0.12})`;
        q.lineWidth = 0.6 + u * 2; q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y + (r() - 0.5) * 2); q.stroke();
      }
      for (let i = 0; i < 90; i++) {
        const u = Math.pow(r(), 0.6), y = hz + 14 + u * (H - hz), x = O1G.x0 + r() * O1G.w, s = 0.4 + u * 1.6;
        q.fillStyle = `rgba(52,100,72,${0.1 + r() * 0.14})`;
        const m = 3 + Math.floor(r() * 3);
        for (let k = 0; k < m; k++) {
          const a = -PI / 2 + (k / (m - 1) - 0.5) * 1.4 + (r() - 0.5) * 0.3, l = (5 + r() * 5) * s;
          q.beginPath(); q.moveTo(x - 0.8 * s, y); q.quadraticCurveTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); q.lineTo(x + 0.8 * s, y); q.fill();
        }
      }
      o1Hill(q, O1HILLS[0], 0.12); o1Hill(q, O1HILLS[1], 0.3);
      // 水月宫：在右边远岭上、日边的雾里（离开溪流的轴线）
      E.palace(q, { x: 1112, y: 326, s: 0.15, t: 0, lit: 0, wind: 0, gauze: false, mist: false, haze: '#eae8d8', hazeA: 0.5 });
      A.softBlob(q, 1112, 330, 70, 0.5, '#f4eedc'); A.softBlob(q, 1060, 336, 60, 0.4, '#f4eedc');
      o1Hill(q, O1HILLS[2], 0.14); o1Hill(q, O1HILLS[3], 0.28);
      // 山脚雾
      q.fillStyle = K.lin(q, 0, 410, 0, 470, [[0, 'rgba(232,238,224,0)'], [0.5, 'rgba(232,238,224,0.6)'], [1, 'rgba(232,238,224,0)']]);
      q.fillRect(O1G.x0, 410, O1G.w, 60);
      for (const b of O1BANKS) o1Hill(q, b, 0.22);
      q.fillStyle = K.lin(q, 0, 500, 0, 600, [[0, 'rgba(232,238,224,0)'], [0.5, 'rgba(232,238,224,0.35)'], [1, 'rgba(232,238,224,0)']]);
      q.fillRect(O1G.x0, 500, O1G.w, 100);
      q.drawImage(o1Ridges(), O1G.x0, O1G.y0, O1G.w, 300);
    });
  }
  // 冬版：同一张图去饱和、偏枯黄，只改原有不透明处
  function wintry(key, src, w, h) {
    return K.cache(key, w, h, 1, (q) => {
      q.drawImage(src, 0, 0, w, h);
      q.globalCompositeOperation = 'saturation'; q.fillStyle = 'rgba(128,128,128,0.72)'; q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'multiply'; q.fillStyle = '#ecd2ae'; q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'destination-in'; q.drawImage(src, 0, 0, w, h);
      q.globalCompositeOperation = 'source-over';
    });
  }
  const o1GroundW = () => wintry('g14o1gndW', o1Ground(), O1G.w, O1G.h);
  // 山脊的墨线与金线：压在雪上，冬春都在（金碧山水的勾勒）
  function o1Ridges() {
    return K.cache('g14o1ridge', O1G.w, 300, 1, (q) => {
      q.translate(-O1G.x0, -O1G.y0);
      q.lineCap = 'round'; q.lineJoin = 'round';
      for (const h of O1HILLS.concat(O1BANKS)) {
        const pts = h.pts, near = h.bot >= 600;
        q.beginPath(); smoothPath(q, pts);
        q.strokeStyle = near ? 'rgba(36,66,58,0.7)' : 'rgba(48,74,66,0.6)'; q.lineWidth = near ? 1.9 : 1.6; q.stroke();
        q.save(); q.translate(0, near ? 2 : 1.6); q.beginPath(); smoothPath(q, pts); q.strokeStyle = near ? 'rgba(236,198,104,0.85)' : 'rgba(232,196,106,0.75)'; q.lineWidth = near ? 1.5 : 1.2; q.stroke(); q.restore();
        const r = rng(pts.length * 13 + h.sd);
        q.fillStyle = 'rgba(30,52,46,0.7)';
        for (let i = 0; i < 26; i++) { const x = lerp(pts[1][0], pts[pts.length - 2][0], r()), y = polyY(pts, x) + 2 + r() * 6; q.beginPath(); q.ellipse(x, y, 1.4 + r() * 1.6, 0.9 + r() * 0.9, 0, 0, TAU); q.fill(); }
      }
    });
  }
  // ---------- 雪 ----------
  // 分形噪声与扭曲：雪块边缘不规则、像化开的样子（不是方块）
  const fbm = (x, y, sd, oc) => { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oc; o++) { s += a * noise2(x * f, y * f, sd + o * 13); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  const warpN = (x, y, sd) => fbm(x + 1.7 * (fbm(x + 3.1, y + 7.7, sd + 1, 2) - 0.5), y + 1.7 * (fbm(x + 8.3, y + 2.9, sd + 2, 2) - 0.5), sd, 4);
  // 树影：雪在树的背阴面（树根左侧）留得最久
  const O1SHADE = [[90, 590, 1.1], [1168, 652, 0.9]];
  const shadeB = (x, y) => { let b = 0; for (const [tx, ty, s] of O1SHADE) { const dx = (x - (tx - 70 * s)) / (95 * s), dy = (y - (ty + 4)) / (22 * s); b += Math.exp(-dx * dx - dy * dy); } return b; };
  // 按“融化先后值”分层：近水、向阳先化，山头、树荫后化；每层一张贴图，逐拍切换
  let o1VMap = null;
  function o1Value() {
    if (o1VMap) return o1VMap;
    const st = 2, nw = Math.ceil(O1G.w / st), nh = Math.ceil(O1G.h / st), v = new Float32Array(nw * nh), nn = new Float32Array(nw * nh);
    const S = O1S.filter((p, i) => i % 2 === 0);
    for (let j = 0; j < nh; j++) {
      const y = O1G.y0 + j * st;
      for (let i = 0; i < nw; i++) {
        const x = O1G.x0 + i * st, top = o1Top(x);
        if (y < top - 1) { v[j * nw + i] = -1; continue; }
        let n;
        // 山坡上按屏幕取（横向拉长两倍），谷地按地面透视取（远处扁、近处大）
        if (y < O1.hz + 2) n = warpN(x * 0.008, y * 0.016, 3);
        else { const z = 1 / (y - O1.hz + 18); n = warpN((x - 640) * z * 15 * 0.07 * 0.6, 9000 * z * 0.07, 5); }
        let dmin = 1e9;
        for (const p of S) { const den = o1W(p[1], 1) + 6; if (Math.abs(p[1] - y) > dmin * den) continue; const d = Math.hypot((p[0] - x) * 0.8, p[1] - y) / den; if (d < dmin) dmin = d; }
        const hillB = 0.12 * ss(450, 330, y);
        nn[j * nw + i] = n;
        v[j * nw + i] = n - 0.2 * Math.exp(-dmin / 1.6) + hillB - 0.05 * (x / W) + 0.12 * shadeB(x, y);
      }
    }
    // 各层雪的覆盖率：九成、六成半、四成、一成半
    const samp = [];
    for (let i = 0; i < v.length; i += 7) if (v[i] > -0.5) samp.push(v[i]);
    samp.sort((a, b) => a - b);
    const thr = [0.92, 0.64, 0.4, 0.15].map((cov) => samp[Math.floor((1 - cov) * (samp.length - 1))]);
    o1VMap = { v, nn, nw, nh, st, thr };
    return o1VMap;
  }
  // 雪面闪光点：取在雪厚处，雪退到哪层就灭到哪层
  let o1Gl = null;
  function o1Glints() {
    if (o1Gl) return o1Gl;
    const M = o1Value(), r = rng(808), out = [];
    for (let k = 0; k < 4000 && out.length < 70; k++) {
      const i = Math.floor(r() * M.nw), j = Math.floor(r() * M.nh), v = M.v[j * M.nw + i];
      if (v > M.thr[0] + 0.03) out.push([O1G.x0 + i * M.st, O1G.y0 + j * M.st, v, r()]);
    }
    return (o1Gl = out);
  }
  // 把一张“融化先后值”图按阈值画成雪：软边、上沿暖白、下沿一线青灰（雪的厚度）、边外一圈湿土
  const SNOW_RAMP = 0.05;
  function snowPixels(d, nw, nh, vAt, nAt, thr, warmX) {
    const aAt = (i, j) => { if (j < 0 || j >= nh) return 0; const vv = vAt(i, j); return vv < -0.5 ? 0 : smooth((vv - thr) / SNOW_RAMP); };
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const vv = vAt(i, j), o = (j * nw + i) * 4;
      if (vv < -0.5) continue;
      const a = smooth((vv - thr) / SNOW_RAMP);
      if (a > 0.002) {
        const n = nAt(i, j), sh = clamp((0.56 - n) * 2.2), dn = clamp(a - Math.min(aAt(i, j + 1), aAt(i, j + 2)) * 1.1), up = clamp(a - aAt(i, j - 2));
        const wm = warmX ? warmX(i) : 0;
        let r = lerp(250, 214, sh), gg = lerp(250, 224, sh), b = lerp(246, 236, sh);
        r = lerp(r, 255, wm * (1 - sh)); gg = lerp(gg, 244, wm * (1 - sh)); b = lerp(b, 222, wm * (1 - sh));
        // 下沿：雪的侧面，青灰
        r = lerp(r, 0xb0, dn * 0.95); gg = lerp(gg, 0xc0, dn * 0.95); b = lerp(b, 0xcf, dn * 0.95);
        // 上沿：受光一线暖白
        r = lerp(r, 255, up * 0.8); gg = lerp(gg, 246, up * 0.8); b = lerp(b, 222, up * 0.8);
        d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255 * a;
      } else if (vv > thr - 0.05) {
        const k = Math.sin(((vv - (thr - 0.05)) / 0.05) * PI * 0.5);
        d[o] = 58; d[o + 1] = 74; d[o + 2] = 58; d[o + 3] = 255 * 0.2 * k;
      }
    }
  }
  function o1SnowLo(k) {
    const M = o1Value();
    return K.cache('g14o1snowlo|' + k, M.nw, M.nh, 1 / SC(), (q) => {
      const cv = q.canvas, img = q.createImageData(cv.width, cv.height), d = img.data;
      if (cv.width === M.nw) snowPixels(d, M.nw, M.nh, (i, j) => M.v[j * M.nw + i], (i, j) => M.nn[j * M.nw + i], M.thr[k], (i) => 0.35 * i / M.nw);
      q.putImageData(img, 0, 0);
    });
  }
  function o1Snow(k) {
    return K.cache('g14o1snow|' + k, O1G.w, O1G.h, 1, (q) => {
      q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high';
      const lo = o1SnowLo(k), M = o1Value();
      if ('filter' in q) q.filter = `blur(${(1.6 * SC()).toFixed(2)}px)`;
      q.drawImage(lo, 0, 0, lo.width, lo.height, 0, 0, M.nw * M.st, M.nh * M.st);
      q.filter = 'none';
      // 雪上仍见山脊勾线：只在有雪处补画
      q.globalCompositeOperation = 'source-atop'; q.drawImage(o1Ridges(), 0, 0, O1G.w, 300); q.globalCompositeOperation = 'source-over';
    });
  }
  // 青绿山石：圆润的卵石形，墨线勾边，顶面石青、侧面墨绿，迎光一侧一道金线，几笔斧劈皴与苔点
  function stone(q, cx, cy, w, h, sd) {
    const r = rng(sd * 31 + 7), P = [];
    const n = 9;
    for (let i = 0; i < n; i++) { const a = PI + (i / (n - 1)) * PI; P.push([cx + Math.cos(a) * w * (0.85 + r() * 0.25), cy + Math.sin(a) * h * (0.75 + r() * 0.35)]); }
    const path = () => { q.beginPath(); q.moveTo(cx - w, cy + h * 0.18); smoothPath(q, P); q.lineTo(cx + w, cy + h * 0.18); q.quadraticCurveTo(cx, cy + h * 0.32, cx - w, cy + h * 0.18); q.closePath(); };
    q.fillStyle = 'rgba(30,50,40,0.25)'; q.beginPath(); q.ellipse(cx + 4, cy + h * 0.24, w * 1.05, h * 0.2, 0, 0, TAU); q.fill();
    path(); q.fillStyle = K.lin(q, 0, cy - h, 0, cy + h * 0.3, [[0, '#6db3a2'], [0.4, '#4f8f82'], [1, '#2d4a44']]); q.fill();
    q.save(); path(); q.clip();
    A.softBlob(q, cx + w * 0.3, cy - h * 0.7, w * 0.8, 0.45, '#a7d8b8');
    q.strokeStyle = 'rgba(24,40,34,0.5)'; q.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) { const x = cx + (r() - 0.6) * w * 1.4, y = cy - h * (0.3 + r() * 0.5); q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x - 4, y + h * 0.3, x - 8 - r() * 4, y + h * 0.6); q.stroke(); }
    q.restore();
    path(); q.strokeStyle = 'rgba(22,30,28,0.85)'; q.lineWidth = 1.7; q.stroke();
    q.strokeStyle = 'rgba(232,200,112,0.75)'; q.lineWidth = 1.1;
    q.beginPath(); smoothPath(q, P.slice(4, 8).map((p) => [p[0] - 1, p[1] + 2])); q.stroke();
    q.fillStyle = 'rgba(30,60,44,0.8)';
    for (let i = 0; i < 6; i++) { const p = P[1 + Math.floor(r() * (n - 2))]; q.beginPath(); q.ellipse(p[0] + (r() - 0.5) * 4, p[1] + 1.5, 1.6, 1, 0, 0, TAU); q.fill(); }
  }
  // 近景两块草坡（左坡立大桃树，右坡立小一点的桃树），坡边是金碧勾勒的山石
  const O1ML = [[-80, 590], [20, 578], [130, 590], [240, 602], [340, 618], [430, 642], [500, 676], [540, 716], [556, 760]];
  const O1MR = [[978, 760], [1000, 712], [1046, 680], [1120, 660], [1210, 646], [1300, 640], [1400, 636]];
  function moundBox(side) {
    const pts = side < 0 ? O1ML : O1MR;
    const x0 = pts[0][0] - 20, x1 = pts[pts.length - 1][0] + 20, y0 = Math.min(...pts.map((p) => p[1])) - 40;
    return [x0, y0, x1 - x0, 770 - y0];
  }
  function o1Mound(side, kind) {
    const pts = side < 0 ? O1ML : O1MR, [x0, y0, mw, mh] = moundBox(side), x1 = x0 + mw;
    if (kind === 'winter') return wintry('g14o1moundW|' + side, o1Mound(side, 'spring'), mw, mh);
    return K.cache('g14o1mound|' + side, mw, mh, 1, (q) => {
      q.translate(-x0, -y0);
      q.beginPath(); smoothPath(q, pts); q.lineTo(pts[pts.length - 1][0], 770); q.lineTo(pts[0][0], 770); q.closePath();
      q.fillStyle = K.lin(q, 0, y0 + 30, 0, 760, [[0, '#86bc8e'], [0.35, '#5f9c78'], [1, '#3f7660']]); q.fill();
      q.save(); q.clip();
      const r = rng(side < 0 ? 5 : 8);
      for (let i = 0; i < 180; i++) {
        const x = lerp(x0, x1, r()), yt = polyY(pts, x), y = yt + 4 + r() * (760 - yt), l = 6 + r() * 16;
        q.strokeStyle = r() < 0.55 ? `rgba(30,70,52,${0.12 + r() * 0.16})` : `rgba(210,232,170,${0.12 + r() * 0.16})`;
        q.lineWidth = 1 + r() * 1.6; q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + (r() - 0.5) * 6, y - l * 0.6, x + (r() - 0.5) * 8, y - l); q.stroke();
      }
      q.restore();
      q.lineCap = 'round';
      q.beginPath(); smoothPath(q, pts); q.strokeStyle = 'rgba(34,62,48,0.55)'; q.lineWidth = 2.2; q.stroke();
      q.save(); q.translate(0, 3); q.beginPath(); smoothPath(q, pts); q.strokeStyle = 'rgba(196,230,170,0.55)'; q.lineWidth = 1.6; q.stroke(); q.restore();
      if (side < 0) { stone(q, 486, 690, 40, 30, 3); stone(q, 532, 724, 30, 20, 4); stone(q, 420, 668, 18, 11, 6); }
      else { stone(q, 1042, 714, 38, 26, 7); stone(q, 1096, 690, 20, 12, 9); }
    });
  }
  // 坡上的雪：屏幕噪声（横向拉长），近水与向阳面先化，坡的背阴面（左半）和树荫最后化
  const moundV = {};
  function o1MoundVal(side) {
    if (moundV[side]) return moundV[side];
    const pts = side < 0 ? O1ML : O1MR, [x0, y0, lw, lh] = moundBox(side);
    const st = 2, nw = Math.ceil(lw / st), nh = Math.ceil(lh / st), v = new Float32Array(nw * nh), nn = new Float32Array(nw * nh), samp = [];
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
      const x = x0 + i * st, y = y0 + j * st, top = polyY(pts, x);
      if (y < top + 1.5) { v[j * nw + i] = -1; continue; }
      const n = warpN(x * 0.006, y * 0.012, 11 + side);
      const nearW = side < 0 ? ss(300, 560, x) : ss(1180, 990, x), back = side < 0 ? ss(200, -60, x) : ss(1180, 1360, x);
      nn[j * nw + i] = n;
      const vv = n - 0.16 * nearW + 0.1 * back + 0.06 * ss(top + 30, top + 4, y) + 0.12 * shadeB(x, y);
      v[j * nw + i] = vv;
      if ((i + j * 3) % 7 === 0) samp.push(vv);
    }
    samp.sort((a, b) => a - b);
    const thr = [0.92, 0.64, 0.4, 0.15].map((cov) => samp[Math.floor((1 - cov) * (samp.length - 1))]);
    return (moundV[side] = { v, nn, nw, nh, st, thr });
  }
  function o1MoundSnow(side, k) {
    const [, , lw, lh] = moundBox(side);
    return K.cache('g14o1msnow|' + side + k, lw, lh, 1, (q) => {
      const M = o1MoundVal(side), lo = document.createElement('canvas'); lo.width = M.nw; lo.height = M.nh;
      const lg = lo.getContext('2d'), img = lg.createImageData(M.nw, M.nh);
      snowPixels(img.data, M.nw, M.nh, (i, j) => M.v[j * M.nw + i], (i, j) => M.nn[j * M.nw + i], M.thr[k], null);
      lg.putImageData(img, 0, 0);
      q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high';
      if ('filter' in q) q.filter = `blur(${(1.6 * SC()).toFixed(2)}px)`;
      q.drawImage(lo, 0, 0, M.nw, M.nh, 0, 0, M.nw * M.st, M.nh * M.st);
      q.filter = 'none';
    });
  }
  // 每一层“雪退到第 k 层”的合成一张（冬春混色 + 该层的雪），逐拍只在相邻两张之间交叉淡化
  const O1GREEN = [0, 0.25, 0.6, 0.9, 1];
  function stageComp(key, w, h, winter, spring, snowK, k) {
    return K.cache(key + '|stage' + k, w, h, 1, (q) => {
      const gk = O1GREEN[k];
      if (gk < 1) q.drawImage(winter(), 0, 0, w, h);
      if (gk > 0) { q.globalAlpha = gk; q.drawImage(spring(), 0, 0, w, h); q.globalAlpha = 1; }
      if (k < 4) q.drawImage(snowK(k), 0, 0, w, h);
    });
  }
  const o1GroundStage = (k) => stageComp('g14o1g', O1G.w, O1G.h, o1GroundW, o1Ground, o1Snow, k);
  function o1MoundStage(side, k) {
    const [, , mw, mh] = moundBox(side);
    return stageComp('g14o1m' + side, mw, mh, () => o1Mound(side, 'winter'), () => o1Mound(side, 'spring'), (j) => o1MoundSnow(side, j), k);
  }
  // ---------- 溪岸小桃树（十四株，近大远小），雪与花按层烘进贴图 ----------
  const O1SM = [[0.03, 1, 8, 0.09], [0.08, -1, 6, 0.1], [0.13, 1, 12, 0.11], [0.19, -1, 10, 0.12], [0.245, 1, 9, 0.13], [0.285, 1, 14, 0.14], [0.345, 1, 14, 0.155], [0.405, -1, 12, 0.17],
    [0.46, 1, 18, 0.19], [0.515, -1, 26, 0.2], [0.6, 1, 22, 0.22], [0.655, -1, 34, 0.23], [0.72, 1, 30, 0.25], [0.78, -1, 40, 0.26]];
  let o1SmL = null;
  function o1Smalls() {
    if (o1SmL) return o1SmL;
    o1SmL = O1SM.map(([u, side, ex, s], i) => {
      const [x, y, cy] = o1Bank(u, side, ex), sd = 301 + i;
      const T2 = treeGeo(sd, { trunk: 120, lean: (h2(sd, 1) - 0.5) * 0.3, dir: (h2(sd, 2) - 0.5) * 1.2, len: 110, w: 7, base: 9, n: 5, fs: 1.6, dens: 0.9, low: 1, res: 0.55 });
      return { x, y, s, T: T2, up: y < cy, sd };
    });
    return o1SmL;
  }
  const O1SB = { x: 250, y: 300, w: 820, h: 440 };
  const SM_SNOW = [1, 0.55, 0, 0, 0], SM_BLOOM = [0, 0, 0, 0.5, 1];
  function o1SmallLayer(k) {
    return K.cache('g14o1sm|' + k, O1SB.w, O1SB.h, 1, (q) => {
      q.translate(-O1SB.x, -O1SB.y);
      const put = (x, y, s, img, T2, a) => { if (a <= 0) return; q.globalAlpha = a; q.save(); q.translate(x, y); q.scale(s, s); q.drawImage(img, T2.box[0], T2.box[1], T2.box[2], T2.box[3]); q.restore(); q.globalAlpha = 1; };
      for (const m of o1Smalls()) {
        q.fillStyle = 'rgba(40,60,44,0.22)'; q.beginPath(); q.ellipse(m.x - 8 * m.s * 10, m.y + 1, 26 * m.s * 10 * 0.5, 4 * m.s * 10 * 0.5, 0, 0, TAU); q.fill();
        put(m.x, m.y, m.s, treeBare(m.T, '#4a4038', null), m.T, 1);
        put(m.x, m.y, m.s, treeSnow(m.T), m.T, SM_SNOW[k]);
        put(m.x, m.y, m.s, treeFull(m.T, '#4a4038'), m.T, SM_BLOOM[k]);
      }
      // 远山脚下〔第8句第5–7字〕桃林：枯点 → 粉色花团
      const r = rng(4141);
      for (let i = 0; i < 46; i++) {
        const hl = i < 20, pts = hl ? O1HILLS[2].pts : O1HILLS[3].pts, x = hl ? lerp(-60, 290, r()) : lerp(870, 1340, r());
        const y = polyY(pts, x) + 8 + r() * 26, rr = 4 + 6 * r(), pk = r() < 0.4;
        if (y > O1.hz + 44 || x < O1SB.x || x > O1SB.x + O1SB.w) continue;
        if (SM_BLOOM[k] < 1) { q.fillStyle = rgba('#6e6a5c', 0.35 * (1 - SM_BLOOM[k])); q.beginPath(); q.ellipse(x, y, rr * 0.8, rr * 0.5, 0, 0, TAU); q.fill(); }
        if (SM_BLOOM[k] > 0) A.softBlob(q, x, y - 2, rr * 1.8, 0.55 * SM_BLOOM[k], pk ? '#fbe2e8' : '#f3b4c4');
      }
    });
  }
  // 远处山脚的桃林（小树层框外的两侧）
  function o1Grove(k) {
    return K.cache('g14o1grove|' + k, W + 240, 120, 1, (q) => {
      q.translate(120, -340);
      const r = rng(4141);
      for (let i = 0; i < 46; i++) {
        const hl = i < 20, pts = hl ? O1HILLS[2].pts : O1HILLS[3].pts, x = hl ? lerp(-60, 290, r()) : lerp(870, 1340, r());
        const y = polyY(pts, x) + 8 + r() * 26, rr = 4 + 6 * r(), pk = r() < 0.4;
        if (y > O1.hz + 44 || (x >= O1SB.x && x <= O1SB.x + O1SB.w)) continue;
        if (SM_BLOOM[k] < 1) { q.fillStyle = rgba('#6e6a5c', 0.35 * (1 - SM_BLOOM[k])); q.beginPath(); q.ellipse(x, y, rr * 0.8, rr * 0.5, 0, 0, TAU); q.fill(); }
        if (SM_BLOOM[k] > 0) A.softBlob(q, x, y - 2, rr * 1.8, 0.55 * SM_BLOOM[k], pk ? '#fbe2e8' : '#f3b4c4');
      }
    });
  }
  // 花开后对岸桃树映在水里（翻过来、糊开，只留在水面里）
  function o1TreeRefl() {
    return K.cache('g14o1trefl', O1SB.w, O1SB.h, 0.5, (q) => {
      q.translate(-O1SB.x, -O1SB.y);
      const E2 = o1Edges(1);
      q.save(); bandPath(q, E2.L, E2.R); q.clip();
      if ('filter' in q) q.filter = `blur(${(1.5 * 0.5 * SC()).toFixed(2)}px)`;
      for (const m of o1Smalls()) {
        if (!m.up) continue;
        q.globalAlpha = 0.5; q.save(); q.translate(m.x, m.y + 2); q.scale(m.s, -m.s * 0.9);
        q.drawImage(treeFull(m.T, '#4a4038'), m.T.box[0], m.T.box[1], m.T.box[2], m.T.box[3]); q.restore();
      }
      q.filter = 'none'; q.globalAlpha = 1;
      q.restore();
    });
  }
  // 远中近三束光：从日轮往左下斜照，柔边（只在建图时糊一次）
  function o1Rays() {
    return K.cache('g14o1rays', 1240, 780, 0.5, (q) => {
      if ('filter' in q) q.filter = `blur(${(10 * SC() * 0.5).toFixed(2)}px)`;
      const ox = 1180, oy = 40, r = rng(14);
      for (let i = 0; i < 6; i++) {
        const a = 2.4 + (r() - 0.5) * 0.9, L = 900 + r() * 400, w0 = 6 + r() * 10, w1 = 60 + r() * 120;
        const ex = ox + Math.cos(a) * L, ey = oy + Math.sin(a) * L, nx = -Math.sin(a), ny = Math.cos(a);
        const gr = q.createLinearGradient(ox, oy, ex, ey);
        gr.addColorStop(0, 'rgba(255,220,150,0)'); gr.addColorStop(0.08, 'rgba(255,220,150,0.5)'); gr.addColorStop(0.5, 'rgba(255,224,160,0.22)'); gr.addColorStop(1, 'rgba(255,224,160,0)');
        q.fillStyle = gr; q.globalAlpha = 0.5 + r() * 0.5;
        q.beginPath(); q.moveTo(ox + nx * w0, oy + ny * w0); q.lineTo(ex + nx * w1, ey + ny * w1); q.lineTo(ex - nx * w1, ey - ny * w1); q.lineTo(ox - nx * w0, oy - ny * w0); q.closePath(); q.fill();
      }
      q.globalAlpha = 1; q.filter = 'none';
    });
  }
  // 节拍事件
  function o1Times(c) {
    const ts = ts0(c), tB = nearD(c, ts + 1.48), i0 = beatI(c, tB);
    // 雪退四层：花开前两拍、前一拍，花开那拍化尽最后两层
    return { ts, tB, melt: [c.grid.time(i0 - 2), c.grid.time(i0 - 1), tB, tB], i0 };
  }
  // 雪退进度 0..4（每拍跳一层，0.42 s 内过渡完）
  const o1Stage = (T, t) => T.melt.reduce((s, tk) => s + easeOut(clamp((t - tk) / 0.42)), 0);

  // ---------- 溪：水面、冰、流纹、浮冰、汀步、涟漪、落瓣 ----------
  // 溪的轮廓（随水位 rise 变宽）：两岸线、内岸水沫线
  function o1Edges(rise) {
    const N = 72, L = [], R = [], Lf = [], Rf = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, [x, y, tx, ty] = o1At(u), w = o1W(y, rise), wl = w * o1Wob(u, 1), wr = w * o1Wob(u, 4), f = Math.min(3, w * 0.3);
      L.push([x - ty * wl, y + tx * wl * 0.5]); R.push([x + ty * wr, y - tx * wr * 0.5]);
      Lf.push([x - ty * (wl - f), y + tx * (wl - f) * 0.5]); Rf.push([x + ty * (wr - f), y - tx * (wr - f) * 0.5]);
    }
    return { L, R, Lf, Rf };
  }
  function bandPath(g, A1, B1) { g.beginPath(); smoothPath(g, A1); const Rr = B1.slice().reverse(); g.lineTo(Rr[0][0], Rr[0][1]); for (let i = 1; i < Rr.length - 1; i++) { const mx = (Rr[i][0] + Rr[i + 1][0]) / 2, my = (Rr[i][1] + Rr[i + 1][1]) / 2; g.quadraticCurveTo(Rr[i][0], Rr[i][1], mx, my); } g.closePath(); }
  // 水面底层：岸边湿土一圈暗、映着天光（远处金、近处青）、天与远山的倒影、内岸一线水沫（不勾硬边）
  function o1WaterBase(g, E2) {
    const { L, R, Lf, Rf } = E2;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); smoothPath(g, L); smoothPath(g, R);
    g.strokeStyle = 'rgba(46,80,60,0.1)'; g.lineWidth = 22; g.stroke();
    g.strokeStyle = 'rgba(46,80,60,0.15)'; g.lineWidth = 10; g.stroke();
    bandPath(g, L, R);
    g.fillStyle = K.lin(g, 0, O1.hz, 0, H, [[0, '#f8e2ae'], [0.16, '#e6e2bc'], [0.42, '#a8d0c4'], [1, '#5aa29c']]);
    g.fill();
    g.save(); bandPath(g, L, R); g.clip();
    g.globalAlpha = 0.55; g.drawImage(o1SkyRefl(), -80, O1.hz - 24, W + 160, O1.hz + 24); g.globalAlpha = 1;
    // 近处水深：往下渐青
    g.fillStyle = K.lin(g, 0, 500, 0, H, [[0, 'rgba(50,128,126,0)'], [1, 'rgba(50,128,126,0.42)']]); g.fillRect(200, 500, 900, 240);
    // 岸草在水里的倒影：把岸线往下挪一点再描粗，只有“上岸”下方落在水里
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.translate(0, 6); g.beginPath(); smoothPath(g, L); smoothPath(g, R);
    g.strokeStyle = 'rgba(44,96,78,0.16)'; g.lineWidth = 18; g.stroke();
    g.strokeStyle = 'rgba(40,86,70,0.22)'; g.lineWidth = 8; g.stroke();
    g.translate(0, -9); g.beginPath(); smoothPath(g, Lf); smoothPath(g, Rf);
    g.strokeStyle = 'rgba(255,255,250,0.55)'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }
  const O1WB = { x: 200, y: 370, w: 960, h: 360 };
  const o1Rise = (st) => lerp(0.42, 1, clamp(st / 3.2));
  function o1WaterLevel(k) {
    return K.cache('g14o1water|' + k, O1WB.w, O1WB.h, 1, (q) => {
      q.translate(-O1WB.x, -O1WB.y);
      const rise = o1Rise(k), ice = 1 - clamp(k / 2.4);
      o1WaterBase(q, o1Edges(rise));
      if (ice > 0.01) o1Ice(q, rise, ice);
      if (k >= 4) q.drawImage(o1TreeRefl(), O1SB.x, O1SB.y, O1SB.w, O1SB.h);
    });
  }
  // 冰：两岸各一片岸冰（半透明、内沿一线青影是冰的厚度），中间一道水缝；化的时候岸冰收窄、内沿碎成锯齿
  function o1Ice(g, rise, ice) {
    const N = 64, f = 0.47 * Math.pow(ice, 0.8);
    const side = (sd) => {
      const out = [], inner = [];
      for (let i = 0; i <= N; i++) {
        const u = 0.004 + 0.99 * (i / N), [x, y, tx, ty] = o1At(u), w = o1W(y, rise) * o1Wob(u, sd < 0 ? 1 : 4) * 0.99;
        const jag = 0.7 + 0.6 * noise1(u * 34 + (sd < 0 ? 3 : 11), 5) + 0.25 * (noise1(u * 140 + sd, 7) - 0.5);
        const v = sd * (1 - 2 * clamp(f * jag, 0, 0.62));
        out.push([x + ty * w * sd, y - tx * w * sd * 0.5]);
        inner.push([x + ty * w * v, y - tx * w * v * 0.5]);
      }
      return [out, inner];
    };
    g.lineJoin = 'round';
    // 冬天的水色深：冰缝里黑青的流水
    { const E2 = o1Edges(rise); bandPath(g, E2.L, E2.R); g.globalAlpha = 0.6 * clamp(ice * 1.5); g.fillStyle = K.lin(g, 0, O1.hz, 0, H, [[0, '#6f8f8c'], [1, '#2f5e62']]); g.fill(); g.globalAlpha = 1; }
    for (const sd of [-1, 1]) {
      const [out, inner] = side(sd);
      const path = (dy) => { g.beginPath(); g.moveTo(out[0][0], out[0][1] + dy); for (const p of out) g.lineTo(p[0], p[1] + dy); for (let i = inner.length - 1; i >= 0; i--) g.lineTo(inner[i][0], inner[i][1] + dy); g.closePath(); };
      g.globalAlpha = clamp(ice * 2) * 0.5; path(2.2); g.fillStyle = '#7d9db3'; g.fill();
      g.globalAlpha = clamp(ice * 2) * 0.82; path(0); g.fillStyle = K.lin(g, 0, O1.hz, 0, H, [[0, '#eef3f2'], [1, '#c9dce4']]); g.fill();
      g.globalAlpha = clamp(ice * 2) * 0.7; g.strokeStyle = '#ffffff'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(inner[0][0], inner[0][1] - 0.6); for (const p of inner) g.lineTo(p[0], p[1] - 0.6); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // 汀步：溪中五块踏石（冬天顶着雪帽），水流绕石起一圈白沫
  function o1StepTex(i) {
    return K.cache('g14o1step|' + i, 44, 30, 2, (q) => {
      const r = rng(611 + i), w = 15 + 4 * r(), h = 6.5 + 2 * r();
      q.translate(22, 16);
      q.fillStyle = 'rgba(30,60,56,0.55)'; q.beginPath(); q.ellipse(0, 4, w + 2, h * 0.7, 0, 0, TAU); q.fill();
      q.beginPath(); q.moveTo(-w, 2); q.bezierCurveTo(-w, -h * 1.1, w, -h * 1.2, w, 1.5); q.quadraticCurveTo(w * 0.2, h * 0.9, -w, 2); q.closePath();
      q.fillStyle = K.lin(q, 0, -h, 0, h, [[0, '#9cc4b4'], [0.45, '#5f8e84'], [1, '#2e4a46']]); q.fill();
      q.strokeStyle = 'rgba(24,34,30,0.7)'; q.lineWidth = 1; q.stroke();
      q.strokeStyle = 'rgba(240,206,120,0.7)'; q.lineWidth = 0.9; q.beginPath(); q.moveTo(-w * 0.2, -h * 0.85); q.quadraticCurveTo(w * 0.5, -h * 0.9, w * 0.85, -h * 0.2); q.stroke();
    });
  }
  function o1StepSnow(i) {
    return K.cache('g14o1stepS|' + i, 44, 30, 2, (q) => {
      const r = rng(611 + i), w = 15 + 4 * r(), h = 6.5 + 2 * r();
      q.translate(22, 16);
      q.fillStyle = '#bccbd6'; q.beginPath(); q.ellipse(0, -h * 0.35, w * 0.86, h * 0.72, 0, 0, TAU); q.fill();
      q.fillStyle = '#fbfcfb'; q.beginPath(); q.ellipse(-1, -h * 0.55, w * 0.8, h * 0.6, 0, 0, TAU); q.fill();
    });
  }
  const O1STEP = [-0.78, -0.4, -0.02, 0.37, 0.75];
  function o1Steps(g, t, rise, snow, open) {
    for (let i = 0; i < O1STEP.length; i++) {
      const u = 0.552 + (h2(i, 621) - 0.5) * 0.01, v = O1STEP[i], [x, y, tx, ty] = o1At(u), w = o1W(y, 1) * (v < 0 ? o1Wob(u, 1) : o1Wob(u, 4));
      const px = x + ty * w * v, py = y - tx * w * v * 0.5, s = 1.15;
      // 水绕石：上游一侧白沫一弯，下游一道拖尾
      if (open > 0.05 && Math.abs(v) * w < o1W(y, rise) * 0.98) {
        g.globalAlpha = open * (0.5 + 0.2 * Math.sin(t * 5 + i * 2));
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(px, py + 3, 20 * s, 6 * s, 0, PI * 1.05, PI * 1.95); g.stroke();
        g.globalAlpha = open * 0.3; g.beginPath(); g.moveTo(px + 10 * s, py + 5); g.quadraticCurveTo(px + 22 * s + tx * 10, py + 7 + ty * 10, px + 34 * s + tx * 16, py + 6 + ty * 16); g.stroke();
        g.globalAlpha = 1;
      }
      g.drawImage(o1StepTex(i), px - 22 * s, py - 16 * s, 44 * s, 30 * s);
      if (snow > 0.01) { g.globalAlpha = snow; g.drawImage(o1StepSnow(i), px - 22 * s, py - 16 * s, 44 * s, 30 * s); g.globalAlpha = 1; }
    }
  }
  function o1Stream(g, c, T, st, bloomK) {
    const t = c.t, rise = o1Rise(st), open = clamp(st / 2.4), sk = Math.min(4, Math.floor(st)), sf = st - sk;
    // 水面与冰（按层换图）
    blitN(g, o1WaterLevel(sk), O1WB.x, O1WB.y, O1WB.w, O1WB.h);
    if (sk < 4 && sf > 0.01) { g.globalAlpha = sf; blitN(g, o1WaterLevel(sk + 1), O1WB.x, O1WB.y, O1WB.w, O1WB.h); g.globalAlpha = 1; }
    g.save();
    // 水纹：横向的短亮线，慢慢顺流（水墨的水纹，不沿流向排成一行行）
    if (open > 0.02) {
      g.strokeStyle = '#ffffff'; g.lineCap = 'round';
      for (let grp = 0; grp < 3; grp++) {
        g.beginPath();
        for (let k = grp; k < 60; k += 3) {
          const sp = 0.02 + 0.02 * h2(k, 81), u = (h2(k, 82) + t * sp) % 1, v = (h2(k, 83) - 0.5) * 1.5;
          const [x, y, tx, ty] = o1At(u), w = o1W(y, rise), len = (6 + 16 * h2(k, 84)) * (0.3 + w / 60), fade = ss(0, 0.06, u) * (1 - ss(0.94, 1, u));
          if (fade < 0.3) continue;
          const px = x + ty * w * v * 0.7, py = y - tx * w * v * 0.35 + Math.sin(t * 1.3 + k) * 1.2;
          g.moveTo(px - len / 2, py); g.quadraticCurveTo(px, py - 0.8 - w * 0.01, px + len / 2, py);
        }
        g.globalAlpha = open * [0.3, 0.45, 0.25][grp]; g.lineWidth = [0.8, 1.2, 2][grp];
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // 金色日影碎光（近处溪面，跳着闪）
    if (open > 0.05) withOp(g, 'lighter', () => {
      const spr = XYT.sprites.tint(XYT.sprites.glow, '#ffd88a');
      for (let k = 0; k < 30; k++) {
        const u = 0.45 + 0.55 * h2(k, 91), [x, y, tx, ty] = o1At(u), w = o1W(y, rise), f = noise1(t * 2.4 + k * 1.7, 9);
        if (f < 0.5) continue;
        const v = (h2(k, 92) - 0.5) * 1.3, px = x + ty * w * v * 0.6 + Math.sin(t * 1.4 + k) * 4, py = y - tx * w * v * 0.3, len = 10 + 26 * h2(k, 93) * (0.4 + w / 120);
        g.globalAlpha = open * (f - 0.5) * 1.4;
        g.drawImage(spr, px - len / 2, py - 2, len, 4);
      }
      g.globalAlpha = 1;
    });
    // 浮冰：开化中顺流而下，边漂边化
    const floe = clamp(open * 2) * (1 - ss(2.4, 3.6, st));
    if (floe > 0.01) {
      for (let k = 0; k < 14; k++) {
        const u = (h2(k, 101) + t * 0.03) % 1, [x, y, tx, ty] = o1At(u), w = o1W(y, rise), v = (h2(k, 102) - 0.5) * 1.1;
        const px = x + ty * w * v * 0.5, py = y - tx * w * v * 0.25, sz = w * (0.12 + 0.14 * h2(k, 103)) * (1 - 0.6 * clamp(st / 3));
        g.globalAlpha = floe * 0.92;
        g.fillStyle = 'rgba(126,159,182,0.6)'; g.beginPath(); g.ellipse(px, py + sz * 0.16, sz, sz * 0.36, 0, 0, TAU); g.fill();
        g.fillStyle = '#f4f8fa'; g.beginPath(); g.ellipse(px, py, sz, sz * 0.34, Math.atan2(ty, tx) * 0.3, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    // 涟漪：每拍几处同时扩开；开花那一拍一大片
    const bi = c.b.i;
    g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      const i = bi - k, t0 = c.grid.time(i), age = t - t0;
      if (age < 0 || age > 1.6 || t0 < T.melt[0] - 0.01) continue;
      const big = Math.abs(t0 - T.tB) < 0.05, nR = big ? 7 : 3;
      for (let j = 0; j < nR; j++) {
        const u = 0.3 + 0.66 * h2(i, j + 7), [x, y] = o1At(u), w = o1W(y, rise), sc = (0.3 + w / 70) * (big ? 1.3 : 1);
        const rr = (4 + age * 34) * sc, a = 0.55 * (1 - age / 1.6) * Math.max(open, 0.35);
        const px = x + (h2(i, j + 9) - 0.5) * w * 0.6;
        g.strokeStyle = rgba('#ffffff', a);
        g.beginPath(); g.ellipse(px, y, rr, rr * 0.3, 0, 0, TAU); g.stroke();
        if (age > 0.25) { g.strokeStyle = rgba('#ffffff', a * 0.6); g.beginPath(); g.ellipse(px, y, rr * 0.6, rr * 0.18, 0, 0, TAU); g.stroke(); }
      }
    }
    // 落在溪面上的花瓣，顺水漂下
    const tF = T.tB + 0.5;
    if (t > tF) {
      for (let k = 0; k < 54; k++) {
        const te = tF + h2(k, 111) * 2.6, age = t - te;
        if (age < 0) continue;
        const u = 0.28 + 0.55 * h2(k, 112) + age * 0.028;
        if (u > 1) continue;
        const [x, y, tx, ty] = o1At(u), w = o1W(y, rise), v = (h2(k, 113) - 0.5) * 1.5, sz = 6 + w * 0.12;
        g.globalAlpha = 0.95 * ss(0, 0.3, age);
        putPetal(g, k % 3, x + ty * w * v * 0.5, y - tx * w * v * 0.25, sz * 1.6, h2(k, 114) * TAU + age * 0.4, 1, 0.55);
      }
      g.globalAlpha = 1;
    }
    g.restore();
    o1Steps(g, t, rise, 1 - clamp(st / 2), open);
    // 源头：远山间一线细瀑，雪化了才亮起来
    const fa = clamp(st / 2.5);
    if (fa > 0.02) {
      const [sx, sy] = O1S[0];
      g.strokeStyle = rgba('#ffffff', 0.7 * fa); g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - 18, sy - 34); g.quadraticCurveTo(sx - 8, sy - 20, sx - 2, sy); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.35 * fa); g.lineWidth = 5; g.stroke();
      glow(g, sx, sy, 18, '#ffffff', 0.4 * fa);
    }
  }

  // ---------- 红瓣褪成金色光尘（承接上一镜的满屏红，同一种红瓣） ----------
  const o1RedTex = (k, gold) => K.cache('g14o1rp|' + k + (gold ? 'g' : ''), 36, 36, 1, (q) => {
    q.translate(18, 18);
    const col = gold ? ['#f2be45', '#f6c858', '#e8ae36'][k] : ['#e0142e', '#f22a3c', '#c00a26'][k];
    const shape = () => { q.beginPath(); q.moveTo(0, 15); q.bezierCurveTo(-13, 13, -16, -6, -7, -13); q.quadraticCurveTo(-3, -15, 0, -11); q.quadraticCurveTo(3, -15, 7, -13); q.bezierCurveTo(16, -6, 13, 13, 0, 15); q.closePath(); };
    q.fillStyle = K.rad(q, 0, 2, 1, 16, [[0, mix(col, gold ? '#fff2c0' : '#ff8a8a', 0.35)], [0.7, col], [1, mix(col, gold ? '#8a5a10' : '#6a0010', 0.3)]]); shape(); q.fill();
    q.strokeStyle = gold ? 'rgba(255,240,190,0.85)' : 'rgba(255,186,176,0.8)'; q.lineWidth = 1.2; shape(); q.stroke();
    q.strokeStyle = gold ? 'rgba(140,90,10,0.35)' : 'rgba(120,0,20,0.35)'; q.lineWidth = 0.8;
    for (const dx of [-5, 0, 5]) { q.beginPath(); q.moveTo(0, 13); q.quadraticCurveTo(dx * 0.6, 2, dx, -9); q.stroke(); }
    q.fillStyle = 'rgba(255,214,110,0.85)'; q.beginPath(); q.ellipse(0, 12, 3, 2, 0, 0, TAU); q.fill();
  });
  const o1RedRot = (k, gold, rot) => {
    const b = ((Math.round((rot / PI) * 12) % 12) + 12) % 12;
    return K.cache('g14o1rr|' + k + (gold ? 'g' : '') + b, 40, 40, 1, (q) => { q.translate(20, 20); q.rotate((b / 12) * PI); q.drawImage(o1RedTex(k, gold), -18, -18, 36, 36); });
  };
  function o1RedToGold(g, c) {
    const lt = c.lt;
    if (lt > 3.2) return;
    const mote = K.cache('g14o1mote', 48, 48, 1, (q) => { A.glow(q, 24, 24, 24, '#ffc850', 0.5); q.globalCompositeOperation = 'lighter'; A.glow(q, 24, 24, 7, '#fff3c0', 1); A.glow(q, 24, 24, 4, '#ffffff', 0.8); });
    const pos = (i, tt) => {
      const z = h2(i, 201), ph = h2(i, 202) * TAU, x0 = 60 + h2(i, 203) * 1180, y0 = 250 + Math.pow(h2(i, 204), 0.8) * 470;
      return [x0 - (24 + 50 * z) * tt + Math.sin(tt * 1.1 + ph) * (6 + 16 * z), y0 + (26 + 56 * z) * tt, z, ph];
    };
    // 红瓣：与上一镜同样往左下飘；化成光尘前 0.3 s 由红转金（预先转好角度的贴图，逐片不改变换）
    for (let i = 0; i < 90; i++) {
      const tc = 0.05 + 0.7 * h2(i, 205);
      if (lt >= tc) continue;
      const [x, y, z] = pos(i, lt), sz = lerp(12, 34, z), gk = ss(tc - 0.3, tc, lt), k = i % 3;
      const rot = c.t * (1 + h2(i, 206)) + i, fx = Math.cos(c.t * 2.2 * (0.6 + h2(i, 207)) + i), w = sz * Math.max(0.15, Math.abs(fx));
      if (gk < 0.99) { g.globalAlpha = (0.75 + 0.25 * z) * (1 - gk); g.drawImage(o1RedRot(k, false, rot), x - w / 2, y - sz / 2, w, sz); }
      if (gk > 0.01) { const s2 = 1 - 0.3 * gk; g.globalAlpha = (0.75 + 0.25 * z) * gk; g.drawImage(o1RedRot(k, true, rot), x - w * s2 / 2, y - sz * s2 / 2, w * s2, sz * s2); }
    }
    g.globalAlpha = 1;
    // 金色光尘：落在树与地上较暗处，加亮叠加，边闪边升向日轮
    withOp(g, 'lighter', () => {
      for (let i = 0; i < 90; i++) {
        const tc = 0.05 + 0.7 * h2(i, 205), age = lt - tc;
        if (age < -0.08 || age > 2.2) continue;
        const [x0, y0, z, ph] = pos(i, tc), sz = 7 + 13 * z;
        const pull = easeIn(clamp(age / 2.4)) * 0.35, rx = lerp(x0, O1.sx, pull) + Math.sin(age * 2.2 + ph) * 10, ry = lerp(y0, O1.sy, pull) - age * (18 + 22 * z);
        const k = ss(-0.08, 0.1, age) * (1 - ss(0.9, 2.2, age)) * (1 + 0.8 * Math.exp(-Math.max(0, age) / 0.15)), tw = 0.6 + 0.4 * Math.sin(age * 11 + ph);
        g.globalAlpha = Math.min(1, 0.9 * k * tw); g.drawImage(mote, rx - sz, ry - sz, sz * 2, sz * 2);
      }
      g.globalAlpha = 1;
    });
  }

  // 春燕：叉尾、弯翅
  function swallow(g, x, y, s, ph, dir, bank) {
    const f = Math.sin(ph), sweep = 0.5 + 0.5 * f;
    g.save(); g.translate(x, y); g.rotate(bank || 0); g.scale(s * dir, s);
    g.fillStyle = '#1e2430';
    g.beginPath(); g.ellipse(0, 0, 9, 3.2, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(8, -0.8, 3, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-6, 0); g.lineTo(-20, -4); g.lineTo(-12, 0.5); g.lineTo(-20, 5); g.closePath(); g.fill();
    for (const sd of [-1, 1]) {
      g.globalAlpha = sd < 0 ? 0.8 : 1;
      g.beginPath(); g.moveTo(3, 0);
      g.quadraticCurveTo(-2, sd * (-6 - 10 * sweep), -14 - 6 * sweep, sd * (-10 - 12 * sweep) * (sd < 0 ? 0.7 : 1));
      g.quadraticCurveTo(-4, sd * -4, -4, 1); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#c24a34'; g.beginPath(); g.arc(10, 0.6, 1.2, 0, TAU); g.fill();
    g.restore();
  }
  // 开花那一下：花瓣从树冠里向外迸散（外冲 250 px/s，很快慢下来，再随风飘）
  function petalBurst(g, T, x, y, s, t, tB, o) {
    const age = t - tB;
    if (age < 0 || age > 2.2) return;
    const n = o.n || 40, seed = o.seed || 1, [cx, cy] = T.crown, tau = 0.4;
    for (let j = 0; j < n; j++) {
      const f = T.fl[Math.floor(h2(j, seed) * T.fl.length)], ox = f.x - cx, oy = f.y - cy, ol = Math.hypot(ox, oy) || 1;
      const sp = 250 * (0.6 + 0.8 * h2(j, seed + 1)), d = sp * tau * (1 - Math.exp(-age / tau)), ph = h2(j, seed + 2) * TAU;
      const px = x + (f.x + (ox / ol) * d / s) * s + (o.wind || 30) * age * age * 0.5 + Math.sin(age * 3 + ph) * 6;
      const py = y + (f.y + (oy / ol) * d / s) * s + 26 * age * age;
      const sz = (o.size || 12) * (0.6 + 0.6 * h2(j, seed + 3)), a = ss(0, 0.04, age) * (1 - ss(1.4, 2.2, age));
      g.globalAlpha = a;
      putPetal(g, j % 3, px, py, sz, ph + age * 5, Math.cos(age * 7 + ph));
    }
    g.globalAlpha = 1;
  }
  // 树冠参数：左树根在 x≈90、树冠往右伸（让开上一镜左栏的字）；右树往左伸
  const O1TL = { seed: 141, trunk: 150, lean: 0.3, dir: 0.9, len: 165, w: 10, base: 14, n: 6, angles: [-1.95, -1.55, -1.2, -0.9, -0.6, -0.3], fs: 1.28, low: 2, res: 1.25, dens: 0.88, cl: 0.1 };
  const O1TR = { seed: 152, trunk: 140, lean: -0.22, dir: -0.6, len: 150, w: 9, base: 12, n: 6, spread: 2.9, fs: 1.22, low: 2, res: 1.25, dens: 0.85, cl: 0.1 };
  const O1FB = { seed: 171, trunk: 0, base: 0, w: 7, n: 3, len: 210, angles: [0.08, 0.36, -0.12], aim: 0.2, pull: 0.04, fs: 1.3, cl: 0.32, low: 0, res: 1 };
  // 预热：空闲时先把雪的融化值图算好（首帧不卡）
  try { if (window.requestIdleCallback) window.requestIdleCallback(() => { o1Value(); o1Glints(); o1MoundVal(-1); o1MoundVal(1); }, { timeout: 4000 }); } catch (e) { /* 无空闲回调 */ }

  XYT.registerShot('o1_spring', {
    name: '雪融春回', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(246,238,222,0.85)', accent: '#eacd76', bloom: 0.3,
    draw(g, c) {
      const t = c.t, lt = c.lt, T = o1Times(c), st = o1Stage(T, t), tB = T.tB;
      const bloomK = ss(tB, tB + 0.8, t), done = st >= 3.999;
      // 缓慢横移（右移），各层视差不同
      const pan = O1.pan * easeInOut(clamp((lt + 1.2) / (c.dur + 1.2)));
      const pX = (k) => -pan * k;
      // ---------- 天、日、远山 ----------
      blitN(g, o1SkyAll(), -80 + pX(0.12), 0, W + 160, O1.hz + 24);
      const sunX = O1.sx + pX(0.12), sunY = O1.sy, redK = 1 - ss(0, 0.75, lt);
      withOp(g, 'lighter', () => glow(g, sunX, sunY, 130, '#ffd890', 0.12 + 0.18 * c.be(0.5) + 0.25 * redK));
      // 延时里的流云：较快地横过天空
      for (let i = 0; i < 5; i++) {
        const x = ((h2(i, 31) * (W + 600) + t * (26 + 18 * h2(i, 32))) % (W + 600)) - 300, y = 70 + h2(i, 33) * 190;
        E.util.streak(g, x, y, 140 + 160 * h2(i, 34), 5 + 5 * h2(i, 35), '#fffaf0', 0.28, -0.04);
      }
      // ---------- 地面（冬→春）与雪 ----------
      g.save(); g.translate(pX(0.5), 0);
      const sk = Math.min(4, Math.floor(st)), sf = st - sk;
      blitN(g, o1GroundStage(sk), O1G.x0, O1G.y0, O1G.w, O1G.h);
      if (sk < 4 && sf > 0.01) { g.globalAlpha = sf; blitN(g, o1GroundStage(sk + 1), O1G.x0, O1G.y0, O1G.w, O1G.h); g.globalAlpha = 1; }
      // 雪面闪光：随拍一闪，雪化了就灭
      if (!done) {
        const M = o1Value(), sk2 = Math.min(3, Math.floor(st)), thr = lerp(M.thr[sk2], sk2 < 3 ? M.thr[sk2 + 1] : M.thr[3] + 0.2, st - sk2), be2 = c.be(0.35);
        g.fillStyle = '#ffffff';
        for (const [x, y, v, h] of o1Glints()) {
          if (v < thr + 0.02) continue;
          const tw = Math.pow(Math.max(0, Math.sin(t * (2 + 3 * h) + h * 40)), 8) + (h < 0.3 ? be2 : 0), sz = 2 + 4 * ((y - O1.hz) / 300);
          if (tw < 0.05) continue;
          g.globalAlpha = Math.min(1, tw);
          g.fillRect(x - sz * 1.5, y - 0.6, sz * 3, 1.2); g.fillRect(x - 0.6, y - sz, 1.2, sz * 2);
        }
        g.globalAlpha = 1;
      }
      blitN(g, o1Grove(sk), -120, 340, W + 240, 120);
      o1Stream(g, c, T, st, bloomK);
      // 溪岸小桃树
      blitN(g, o1SmallLayer(sk), O1SB.x, O1SB.y, O1SB.w, O1SB.h);
      if (sk < 4 && sf > 0.01) { g.globalAlpha = sf; blitN(g, o1SmallLayer(sk + 1), O1SB.x, O1SB.y, O1SB.w, O1SB.h); g.globalAlpha = 1; }
      g.restore();
      // 谷地晨雾：延时里流得快；谷中两道薄雾分开远近
      E.mist(g, { t, y: O1.hz + 14, h: 70, color: '#f6efdc', alpha: 0.5 - 0.15 * clamp(lt / 4), speed: 26, seed: 4 });
      E.mist(g, { t, y: 476, h: 56, color: '#f4f2e4', alpha: 0.35, speed: 18, seed: 6, offset: 300 });
      E.mist(g, { t, y: 546, h: 60, color: '#f2f2e6', alpha: 0.3, speed: -14, seed: 8, offset: 700 });
      // ---------- 近景草坡 ----------
      for (const side of [-1, 1]) {
        const [mx, my, mw, mh] = moundBox(side), off = pX(1);
        g.save(); g.translate(off, 0);
        blitN(g, o1MoundStage(side, sk), mx, my, mw, mh);
        if (sk < 4 && sf > 0.01) { g.globalAlpha = sf; blitN(g, o1MoundStage(side, sk + 1), mx, my, mw, mh); g.globalAlpha = 1; }
        // 新草抽芽：雪退一层长一截，风来时伏向右边
        const pts = side < 0 ? O1ML : O1MR, grow = ss(0.6, 3.4, st), gust = ss(tB + 0.2, tB + 0.9, t) * (0.7 + 0.3 * Math.sin(t * 2.2));
        if (grow > 0.02) {
          for (let i = 0; i < 46; i++) {
            const x = lerp(pts[0][0] + 30, pts[pts.length - 1][0] - 30, h2(i, side + 51)), y = polyY(pts, x) + 3 + h2(i, side + 52) * 12;
            const L = (8 + 18 * h2(i, side + 53)) * grow, bend = (Math.sin(t * 1.6 + i) * 0.15 + gust * 0.6) * L;
            g.fillStyle = h2(i, side + 54) < 0.5 ? '#6fae62' : '#9cc978';
            g.beginPath(); g.moveTo(x - 1.6, y); g.quadraticCurveTo(x + bend * 0.3, y - L * 0.6, x + bend, y - L); g.quadraticCurveTo(x + bend * 0.3 + 1, y - L * 0.6, x + 1.6, y); g.fill();
          }
          for (let i = 0; i < 16; i++) {
            const kb = backOut((t - tB - 0.15 - h2(i, side + 61) * 0.6) / 0.3);
            if (kb <= 0) continue;
            const x = lerp(pts[0][0] + 40, pts[pts.length - 1][0] - 40, h2(i, side + 62)), y = polyY(pts, x) + 8 + h2(i, side + 63) * 50;
            g.fillStyle = h2(i, side + 64) < 0.5 ? '#fffaf0' : '#f6d86a';
            for (let k = 0; k < 5; k++) { const a = (k * TAU) / 5; g.beginPath(); g.arc(x + Math.cos(a) * 2.2 * kb, y + Math.sin(a) * 2.2 * kb, 1.7 * kb, 0, TAU); g.fill(); }
            g.fillStyle = '#d88a2a'; g.beginPath(); g.arc(x, y, 1.1 * kb, 0, TAU); g.fill();
          }
        }
        g.restore();
      }
      // ---------- 近景两株桃树（迎光一侧金边） ----------
      const gustA = ss(tB + 0.25, tB + 1.0, t) * (1 - 0.5 * ss(tB + 2.5, tB + 4, t));
      const TL = treeGeo(O1TL.seed, O1TL), TR = treeGeo(O1TR.seed, O1TR);
      const swL = Math.sin(t * 0.9) * 0.006 + gustA * (0.018 + 0.008 * Math.sin(t * 3.1)), swR = Math.sin(t * 0.8 + 1) * 0.006 + gustA * (0.014 + 0.007 * Math.sin(t * 2.7 + 1));
      const xL = 90 + pX(1.25), yL = 592, xR = 1168 + pX(1.25), yR = 652;
      drawTree(g, TL, xL, yL, 1.04, t, { bloomAt: tB, snowSt: st, sway: swL, nn: true, rim: [0.78, -0.62] });
      drawTree(g, TR, xR, yR, 0.9, t, { bloomAt: tB + 0.02, snowSt: st, sway: swR, nn: true, rim: [-0.62, -0.78] });
      // 开花一刻：树冠里一下柔亮
      const flash = Math.exp(-Math.max(0, t - tB) / 0.2) * ss(tB - 0.03, tB + 0.04, t);
      if (flash > 0.06) withOp(g, 'lighter', () => {
        glow(g, xL + TL.crown[0] * 1.04, yL + TL.crown[1] * 1.04, 160, '#ffd0dc', 0.38 * flash);
        glow(g, xR + TR.crown[0] * 0.9, yR + TR.crown[1] * 0.9, 140, '#ffd0dc', 0.38 * flash);
      });
      petalBurst(g, TL, xL, yL, 1.04, t, tB, { n: 34, seed: 3, wind: 60, size: 13 });
      petalBurst(g, TR, xR, yR, 0.9, t, tB + 0.02, { n: 30, seed: 5, wind: -40, size: 12 });
      // 春风吹落的花瓣：成股吹过溪面
      petalGust(g, TL, xL, yL, 1.04, t, tB, { n: 116, seed: 7, dir: 1, size: 14, spread: 1.2 });
      petalGust(g, TR, xR, yR, 0.9, t, tB, { n: 60, seed: 9, dir: -0.6, size: 12, spread: 1.6 });
      if (bloomK > 0) { g.globalAlpha = bloomK; V.petals(g, c, { kind: 'peach', n: 44, seed: 31, wind: 34, fall: 30, gust: 30, area: [-60, -40, W + 60, H + 20] }); g.globalAlpha = 1; }
      // ---------- 左上角压角的近枝：清晰的深色剪影，花开后几朵在焦内，边上几个光斑 ----------
      {
        const TB = treeGeo(O1FB.seed, O1FB), sw = Math.sin(t * 1.3) * 0.01 + gustA * 0.025 * Math.sin(t * 2.6);
        drawTree(g, TB, -40 + pX(1.7), -30, 1.15, t, { bloomAt: tB + 0.04, snowSt: st, sway: sw, ink: '#1e1814', alpha: 0.88, nn: true });
        if (bloomK > 0.02) { g.globalAlpha = bloomK; V.bokeh(g, c, { n: 7, seed: 17, area: [0, 0, 560, 240], colors: ['#ffd2de', '#fff0d0'], size: [14, 40], alpha: 0.3, drift: 6, rise: 3 }); g.globalAlpha = 1; }
      }
      // 春燕两只：花开后从右边天上飞来，过了 x 900 才俯冲向溪面
      for (let k = 0; k < 2; k++) {
        const age = t - (tB + 0.9 + k * 0.45);
        if (age < 0 || age > 4) continue;
        const x = 1340 - age * (320 + 40 * k), dip = Math.max(0, 900 - x) * 0.36;
        const y = 236 + k * 26 + Math.sin(age * 1.6 + k) * 12 + dip;
        swallow(g, x, y, 1.0 - 0.18 * k, t * 14 + k, -1, Math.max(-0.2, Math.min(0.35, (900 - x) * 0.001)) + Math.cos(age * 1.6 + k) * 0.1);
      }
      // ---------- 光 ----------
      withOp(g, 'lighter', () => {
        g.globalAlpha = clamp((0.14 + 0.04 * bloomK) * (1 + 0.5 * c.be(0.45) + 0.3 * c.de(0.9)));
        blitN(g, o1Rays(), sunX - 1180, sunY - 40, 1240, 780);
        g.globalAlpha = 1;
      });
      V.dust(g, c, { n: 14, color: '#fff2c4', seed: 15, alpha: 0.8, blend: 'screen', light: { x: sunX, y: sunY, angle: 2.4, spread: 0.6, len: 900, start: 0.1 } });
      // 上一镜左栏的字还没散：交叉淡化时左边压一层淡雾，枝不压字
      const lh = 1 - ss(-0.1, 0.4, lt);
      if (lh > 0.01) { g.fillStyle = K.lin(g, 0, 0, 280, 0, [[0, `rgba(246,236,222,${0.5 * lh})`], [0.75, `rgba(246,236,222,${0.4 * lh})`], [1, 'rgba(246,236,222,0)']]); g.fillRect(-20, -20, 300, H + 40); }
      // 调色：承接满屏红 → 一拍内转金 → 金色晨光慢慢淡成春日柔光（始终留一点暖）
      const goldK = (1 - redK) * (1 - ss(0.9, 2.8, lt));
      if (redK + goldK > 0.02) tone(g, mix(mix('#ffe2a8', '#ffd890', goldK), '#e8545a', redK), 0.1 + 0.22 * goldK + 0.5 * redK, '#000000', 0);
      else { g.fillStyle = 'rgba(255,220,156,0.07)'; g.fillRect(-20, -20, W + 40, H + 40); }
      o1RedToGold(g, c);
    },
  });


  // ======================================================================
  // 共用：乌篷船（侧面，船头朝右；原点在船中水线）
  // ======================================================================
  function boatTex(col, canopy) {
    return K.cache('g14boat|' + col + canopy, 320, 120, 1.5, (q) => {
      q.translate(160, 92);
      const dk = mix(col, '#000000', 0.45), lt = mix(col, '#ffffff', 0.18);
      q.lineJoin = 'round';
      q.beginPath();
      q.moveTo(-150, -28); q.lineTo(-138, -26);
      q.quadraticCurveTo(-110, 8, -20, 10); q.quadraticCurveTo(90, 10, 152, -34);
      q.lineTo(146, -27); q.quadraticCurveTo(80, -8, 0, -8); q.quadraticCurveTo(-90, -8, -134, -17); q.lineTo(-146, -21);
      q.closePath();
      q.fillStyle = K.lin(q, 0, -34, 0, 12, [[0, lt], [0.5, col], [1, dk]]); q.fill();
      q.strokeStyle = 'rgba(20,16,12,0.6)'; q.lineWidth = 1.2; q.stroke();
      q.strokeStyle = rgba('#efe2c4', 0.35); q.lineWidth = 1.4;
      q.beginPath(); q.moveTo(-140, -23); q.quadraticCurveTo(-60, -9, 0, -9); q.quadraticCurveTo(80, -9, 146, -30); q.stroke();
      // 乌篷：一整段弯弯的竹篷（侧看是低低的半筒），篾条顺着弧弯下来，篷脊一线高光；朝船头一侧露出黑洞洞的篷口
      const a = -78, b = 34, hh = 40, top = (x) => -8 - hh - 4 * Math.sin(PI * clamp((x - a) / (b - a)));
      const path = () => {
        q.beginPath(); q.moveTo(a, -8); q.lineTo(a, -8 - hh * 0.55); q.quadraticCurveTo(a + 1, top(a + 8), a + 10, top(a + 10));
        for (let x = a + 10; x <= b - 10; x += 6) q.lineTo(x, top(x));
        q.quadraticCurveTo(b - 1, top(b - 8), b, -8 - hh * 0.55); q.lineTo(b, -8); q.closePath();
      };
      path(); q.fillStyle = K.lin(q, 0, -8 - hh - 4, 0, -8, [[0, mix(canopy, '#ffffff', 0.32)], [0.22, mix(canopy, '#ffffff', 0.08)], [0.6, canopy], [1, mix(canopy, '#000000', 0.4)]]); q.fill();
      q.save(); path(); q.clip();
      // 篾条：一根根顺着篷的弧度弯下
      q.strokeStyle = 'rgba(0,0,0,0.32)'; q.lineWidth = 1.1;
      for (let x = a + 6; x < b; x += 8) { const tt = top(x); q.beginPath(); q.moveTo(x + 2, tt); q.quadraticCurveTo(x - 1.5, tt + hh * 0.5, x + 1, -8); q.stroke(); }
      q.strokeStyle = 'rgba(236,224,196,0.13)'; q.lineWidth = 0.7;
      for (let k = 1; k < 7; k++) { q.beginPath(); for (let x = a; x <= b; x += 6) { const y = lerp(top(x), -8, k / 7); x === a ? q.moveTo(x, y) : q.lineTo(x, y); } q.stroke(); }
      // 两端的竹箍
      q.fillStyle = 'rgba(0,0,0,0.35)'; q.fillRect(a, -8 - hh - 4, 4, hh + 4); q.fillRect(b - 5, -8 - hh - 4, 5, hh + 4);
      q.restore();
      q.strokeStyle = 'rgba(250,240,214,0.6)'; q.lineWidth = 1.4;
      q.beginPath(); for (let x = a + 8; x <= b - 8; x += 6) x === a + 8 ? q.moveTo(x, top(x) + 1.2) : q.lineTo(x, top(x) + 1.2); q.stroke();
      q.strokeStyle = 'rgba(16,14,12,0.6)'; q.lineWidth = 1; path(); q.stroke();
      // 篷口（朝船头）：半个椭圆的暗口，口沿一线浅
      q.fillStyle = '#121010'; q.beginPath(); q.ellipse(b - 2, -8 - hh * 0.48, 7, hh * 0.46, 0, -PI / 2, PI / 2); q.fill();
      q.strokeStyle = rgba(mix(canopy, '#ffffff', 0.4), 0.7); q.lineWidth = 1.2; q.beginPath(); q.ellipse(b - 2, -8 - hh * 0.48, 7, hh * 0.46, 0, -PI / 2, PI / 2); q.stroke();
    });
  }
  function drawBoat(g, x, y, s, rot, col, canopy) {
    const img = boatTex(col, canopy);
    g.save(); g.translate(x, y); g.rotate(rot || 0); g.scale(s, s);
    g.drawImage(img, -160, -92, 320, 120);
    g.restore();
  }

  // ======================================================================
  // 共用：孩童（侧面，原创小人，头大身短；脚底 (x, y)，s=1 约 100 高）
  // o: facing, ph 步相位, run 0..1, top 上衣, pants, kind 'boy'|'girl', towel 抹布还搭在肩上, shade 手搭凉棚 0..1,
  //    reach 伸手 0..1, ribbon 发带色, wind 风 0..1, windDir 风向（世界坐标，-1 向左）, lean, tilt, dip
  // ======================================================================
  const KSKIN = '#efd2b8', KOUT = 'rgba(52,38,30,0.7)';
  function kid(g, x, y, s, t, o) {
    const f = o.facing || 1, run = o.run ?? 0, ph = o.ph || 0, girl = o.kind === 'girl';
    const bob = run * Math.abs(Math.sin(ph)) * 4 + (o.dip || 0);
    const lean = run * 0.22 + (o.lean || 0);
    g.save(); g.translate(x, y); g.scale(f * s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.fillStyle = 'rgba(30,36,40,0.18)'; g.beginPath(); g.ellipse(2, 1, 18 + run * 4, 3.4, 0, 0, TAU); g.fill();
    const hip = [0, -42 - bob];
    const sh = [hip[0] + Math.sin(lean) * 30, hip[1] - Math.cos(lean) * 30];
    const hc = [sh[0] + Math.sin(lean) * 4 + 1, sh[1] - 15];
    const legP = (side) => {
      const p = ph + (side ? PI : 0);
      const th = run * 0.8 * Math.sin(p) + (1 - run) * (side ? 0.06 : -0.04);
      const kn = run * (0.2 + 0.95 * Math.max(0, Math.sin(p + 1.5))) + (1 - run) * 0.04;
      const kp = [hip[0] + Math.sin(th) * 21, hip[1] + Math.cos(th) * 21];
      const ap = [kp[0] + Math.sin(th - kn) * 21, kp[1] + Math.cos(th - kn) * 21];
      return [kp, ap];
    };
    const pants = o.pants || '#4e4438', top = o.top || '#8a6a4a', topD = mix(top, '#1e1812', 0.3);
    const leg = (side, col) => {
      const [kp, ap] = legP(side);
      if (girl) { g.fillStyle = '#d8c8d8'; g.beginPath(); g.ellipse(ap[0] + 3, ap[1] + 0.5, 4.6, 2.4, 0, 0, TAU); g.fill(); return; }
      g.strokeStyle = KOUT; g.lineWidth = 9; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kp[0], kp[1]); g.lineTo(ap[0], ap[1]); g.stroke();
      g.strokeStyle = col; g.lineWidth = 7.2; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kp[0], kp[1]); g.lineTo(ap[0], ap[1]); g.stroke();
      g.fillStyle = '#2a2420'; g.beginPath(); g.ellipse(ap[0] + 3, ap[1] + 0.5, 5.6, 2.8, 0, 0, TAU); g.fill();
    };
    const armP = (side) => {
      const S = [sh[0] + (side ? -3 : 3), sh[1] + 3];
      let a1, a2;
      if (!side && o.shade) { a1 = lerp(0.1, 2.6, o.shade); a2 = lerp(0.3, 1.5, o.shade); }
      else if (!side && o.reach) { a1 = lerp(0.1, 1.9, o.reach); a2 = 0.15; }
      else { a1 = -run * 0.9 * Math.sin(ph + (side ? 0 : PI)) + (1 - run) * (side ? -0.12 : 0.08); a2 = 0.5 + run * 0.7; }
      const e = [S[0] + Math.sin(a1) * 14, S[1] + Math.cos(a1) * 14], hd = [e[0] + Math.sin(a1 + a2) * 13, e[1] + Math.cos(a1 + a2) * 13];
      return [S, e, hd];
    };
    const wind = o.wind ?? 0.4, wdl = -(o.windDir ?? 1);   // wdl：本地坐标里风往哪边吹（+1 向前）
    const arm = (side, col) => {
      const [S, e, hd] = armP(side);
      if (girl) {
        // 广袖：袖口垂下一片，随风轻摆
        const sw2 = Math.sin(t * 2.6 + side) * 1.5 + wdl * wind * 3;
        g.fillStyle = col; g.strokeStyle = KOUT; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(S[0] - 3, S[1] - 2); g.lineTo(e[0] - 2, e[1]); g.lineTo(hd[0] - 1, hd[1] - 2);
        g.quadraticCurveTo(hd[0] + 1 + sw2, hd[1] + 9, hd[0] - 6 + sw2, hd[1] + 12); g.quadraticCurveTo(e[0] - 2, e[1] + 9, S[0] + 3, S[1] + 6); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = KSKIN; g.beginPath(); g.arc(hd[0] + 1, hd[1], 2.5, 0, TAU); g.fill();
        return;
      }
      g.strokeStyle = KOUT; g.lineWidth = 7.2; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(e[0], e[1]); g.lineTo(hd[0], hd[1]); g.stroke();
      g.strokeStyle = col; g.lineWidth = 5.6; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(e[0], e[1]); g.lineTo(hd[0], hd[1]); g.stroke();
      g.fillStyle = KSKIN; g.beginPath(); g.arc(hd[0], hd[1], 2.9, 0, TAU); g.fill();
    };
    // 淡紫发带：两条长带从脑后顺风飘出（填充的渐细带子）
    const ribbonTail = () => {
      if (!o.ribbon) return;
      const ox = hc[0] - 8 + (o.ribbonLift ? 6 : 0), oy = hc[1] - 9 - (o.ribbonLift ? 5 : 0);
      const rl = o.ribbonLen || 1, rw = o.ribbonW || 1;
      for (const [len, w0, ph2, col] of [[66 * rl, 3.4 * rw, 0, o.ribbon], [54 * rl, 2.8 * rw, 1.9, mix(o.ribbon, '#ffffff', 0.25)]]) {
        const L = len * (0.6 + 0.55 * wind), pts = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          pts.push([ox + wdl * L * u * (0.5 + 0.5 * wind) - (1 - wind) * 4 * u, oy + L * u * (0.9 - 0.8 * wind - (o.ribbonLift || 0) * wind) + Math.sin(t * 4.6 + ph2 - u * 5.5) * 5 * u * (0.35 + wind)]);
        }
        const wid = (i) => w0 * (1 - (i / 12) * 0.7) * (0.6 + 0.4 * Math.abs(Math.cos(t * 3 + i * 0.6 + ph2)));
        const nrm = (i) => { const [x0, y0] = pts[i], [x1, y1] = pts[Math.min(12, i + 1)], a = Math.atan2(y1 - y0, x1 - x0) || 0; return [-Math.sin(a), Math.cos(a)]; };
        g.fillStyle = col; g.beginPath();
        for (let i = 0; i <= 12; i++) { const [nx, ny] = nrm(i), w = wid(i); i ? g.lineTo(pts[i][0] + nx * w, pts[i][1] + ny * w) : g.moveTo(pts[i][0] + nx * w, pts[i][1] + ny * w); }
        for (let i = 12; i >= 0; i--) { const [nx, ny] = nrm(i), w = wid(i); g.lineTo(pts[i][0] - nx * w, pts[i][1] - ny * w); }
        g.closePath(); g.fill();
      }
    };
    // 长发垂到腰后，发梢随风
    const hairBack = () => {
      const sw = wdl * wind * 7 + Math.sin(t * 2.2) * 1.5;
      g.fillStyle = '#1c1612';
      g.beginPath(); g.moveTo(hc[0] - 10, hc[1] - 2); g.quadraticCurveTo(hc[0] - 15, hc[1] + 20, hc[0] - 12 + sw, hc[1] + 42);
      g.quadraticCurveTo(hc[0] - 6 + sw * 0.6, hc[1] + 40, hc[0] - 3, hc[1] + 14); g.closePath(); g.fill();
    };
    if (girl) { ribbonTail(); hairBack(); }
    arm(1, girl ? mix(top, '#c8c0d0', 0.4) : topD);
    leg(1, mix(pants, '#000000', 0.2));
    // 衣身：男孩短打，女孩长裙到脚踝
    const lx = Math.sin(lean), ly = -Math.cos(lean), px = -ly, py = lx;
    const P = (u, w) => [hip[0] + lx * u + px * w, hip[1] + ly * u + py * w];
    if (girl) {
      // 白衣长裙：上窄下宽，裙摆顺风扬起；外罩一层更轻的纱
      const sw = wdl * (wind * 7 + Math.sin(t * 2.4) * 1.6), fl = Math.sin(t * 3.1) * 1.4;
      const dress = (ex) => {
        g.beginPath();
        const a = P(30, -7), b = P(30, 7);
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
        g.bezierCurveTo(P(16, 10)[0], P(16, 10)[1], 15 + ex + sw * 0.7, -10, 17 + ex + sw + fl, -1);
        g.quadraticCurveTo(4 + sw * 0.5, 2 + fl * 0.5, -15 - ex + sw * 0.4, -1 - fl * 0.6);
        g.bezierCurveTo(-14 - ex + sw * 0.2, -12, P(16, -11)[0], P(16, -11)[1], a[0], a[1]);
        g.closePath();
      };
      dress(4); g.globalAlpha = 0.45; g.fillStyle = o.hem || '#ece4f2'; g.fill(); g.globalAlpha = 1;
      dress(0); g.fillStyle = K.lin(g, 0, sh[1], 0, 0, [[0, top], [0.6, top], [1, mix(top, o.hem || '#e8dcef', 0.9)]]); g.fill();
      g.strokeStyle = KOUT; g.lineWidth = 0.9; g.stroke();
      g.strokeStyle = 'rgba(150,130,170,0.3)'; g.lineWidth = 0.8;
      for (const k of [-6, -1, 5]) { const m0 = P(14, k * 0.6); g.beginPath(); g.moveTo(m0[0], m0[1]); g.quadraticCurveTo(k * 1.2 + sw * 0.4, -12, k * 1.9 + sw * 0.8, -2); g.stroke(); }
      g.strokeStyle = o.sash || '#c8b8e0'; g.lineWidth = 2.6;
      const b1 = P(22, -8), b2 = P(22, 8); g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
      // 腰带垂下的带子
      g.lineWidth = 1.4; g.beginPath(); const bm = P(22, 6); g.moveTo(bm[0], bm[1]); g.quadraticCurveTo(bm[0] + sw * 0.6 + 2, bm[1] + 10, bm[0] + sw * 1.4 + 3, bm[1] + 20 + fl); g.stroke();
    } else {
      g.fillStyle = top; g.strokeStyle = KOUT; g.lineWidth = 1.1;
      g.beginPath();
      const p1 = P(-10, -13), p2 = P(30, -10), p4 = P(30, 9), p6 = P(-10, 14);
      g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.quadraticCurveTo(P(34, 0)[0], P(34, 0)[1], p4[0], p4[1]); g.lineTo(p6[0], p6[1]);
      g.quadraticCurveTo(P(-13, 0)[0], P(-13, 0)[1], p1[0], p1[1]); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#3a2e24'; g.lineWidth = 3; const b1 = P(2, -13), b2 = P(2, 14); g.beginPath(); g.moveTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.stroke();
      g.strokeStyle = 'rgba(255,240,210,0.35)'; g.lineWidth = 1; const c1 = P(28, 6), c2 = P(6, -9); g.beginPath(); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.stroke();
    }
    leg(0, pants);
    // 头：侧脸向前，头发盖住后半
    g.save(); g.translate(hc[0], hc[1]); g.rotate(o.tilt || 0);
    const face = () => {
      g.beginPath(); g.arc(0, 0, 11.5, PI * 0.62, PI * 1.82);
      g.quadraticCurveTo(10.6, -7.4, 11.1, -3.6); g.lineTo(13.4, -0.6); g.quadraticCurveTo(13.6, 0.6, 11.6, 1.2);
      g.lineTo(11.9, 2.8); g.quadraticCurveTo(11.6, 4.1, 10.6, 4.4); g.quadraticCurveTo(10.9, 7.4, 7.6, 9.2); g.quadraticCurveTo(3, 11.6, -4, 10.6); g.closePath();
    };
    face(); g.fillStyle = mix(o.skin || KSKIN, '#3a2a20', 0.25); g.fill();
    g.strokeStyle = KOUT; g.lineWidth = 0.9; g.stroke();
    g.strokeStyle = rgba(o.rimCol || '#ffe2b0', 0.95); g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(9.4, -8.2); g.quadraticCurveTo(10.6, -7.4, 11.1, -3.6); g.lineTo(13.4, -0.6); g.moveTo(11.9, 2.8); g.quadraticCurveTo(11.6, 4.1, 10.6, 4.4); g.quadraticCurveTo(10.9, 7.4, 7.6, 9.2); g.stroke();
    g.fillStyle = '#1c1612';
    g.beginPath(); g.arc(0, 0, 11.8, PI * 0.6, PI * 1.9); g.quadraticCurveTo(-1, -4, -8, 7); g.closePath(); g.fill();
    if (girl) {
      // 双丫髻 + 发带结 + 桃花簪
      for (const [bx, by] of [[-6, -11], [5, -12]]) { g.beginPath(); g.arc(bx, by, 4.8, 0, TAU); g.fill(); }
      g.beginPath(); g.moveTo(-11, -2); g.quadraticCurveTo(-15, 8, -12, 18); g.lineTo(-7, 8); g.closePath(); g.fill();
      if (o.ribbon) { g.strokeStyle = o.ribbon; g.lineWidth = 2.4; g.beginPath(); g.arc(-6, -11, 5, 2.2, 3.6); g.stroke(); g.beginPath(); g.arc(5, -12, 5, -0.6, 0.6); g.stroke(); }
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; g.fillStyle = '#f6a8bc'; g.beginPath(); g.arc(8 + Math.cos(a) * 2.2, -15 + Math.sin(a) * 2.2, 1.9, 0, TAU); g.fill(); }
      g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(8, -15, 1.1, 0, TAU); g.fill();
    } else {
      // 小发髻 + 布条
      g.beginPath(); g.ellipse(-3, -12, 5, 5.5, -0.3, 0, TAU); g.fill();
      g.strokeStyle = '#b89a6a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-7, -9); g.lineTo(1, -10); g.stroke();
      g.beginPath(); g.moveTo(-6, -9); g.quadraticCurveTo(-11 - run * 4, -6, -13 - run * 6, -2 + Math.sin(t * 9) * 2); g.stroke();
    }
    g.restore();
    // 抹布搭在肩上（前后各垂一截）
    if (o.towel > 0.01) {
      const k = o.towel, sx = sh[0] + 1, sy = sh[1] + 1, flap = Math.sin(t * 10) * run * 2;
      g.globalAlpha = Math.min(1, k * 1.5);
      g.fillStyle = '#efece2'; g.strokeStyle = 'rgba(60,60,60,0.5)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(sx - 6, sy - 2); g.lineTo(sx + 5, sy - 3);
      g.lineTo(sx + 6 + flap * 0.3, sy + 14 * k); g.lineTo(sx + 1, sy + 15 * k); g.lineTo(sx - 1, sy + 2);
      g.lineTo(sx - 8 - flap, sy + 13 * k); g.lineTo(sx - 13 - flap, sy + 12 * k); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#7397ab'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx + 1.5, sy + 11 * k); g.lineTo(sx + 6, sy + 10.5 * k); g.stroke();
      g.globalAlpha = 1;
    }
    arm(0, top);
    g.restore();
  }

  // 每帧重画的小画布（只当临时缓冲，不留状态）：人物先画进来，再整体着色、翻转、切条
  const scr = {};
  function scratch(id, w, h) {
    const S = SC(), cw = Math.ceil(w * S), ch = Math.ceil(h * S);
    let c = scr[id];
    if (!c || c.width !== cw || c.height !== ch) { c = scr[id] = document.createElement('canvas'); c.width = cw; c.height = ch; }
    const q = c.getContext('2d');
    q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1; q.globalCompositeOperation = 'source-over'; q.clearRect(0, 0, cw, ch);
    q.setTransform(S, 0, 0, S, 0, 0);
    c.lw = w; c.lh = h;
    return [c, q];
  }
  // 孩童画进缓冲：box 为脚底周围的逻辑范围 [左, 上, 宽, 高]，返回 [画布, 画布左上角相对脚底的偏移]
  function kidBuf(id, s, t, o, box) {
    const [bx, by, bw, bh] = box, [c, q] = scratch(id, bw, bh);
    kid(q, -bx, -by, s, t, o);
    return c;
  }
  // 同一缓冲染成一种颜色（轮廓光用）
  function tintBuf(id, src, col) {
    const [c, q] = scratch(id, src.lw, src.lh);
    q.setTransform(1, 0, 0, 1, 0, 0); q.drawImage(src, 0, 0);
    q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, c.width, c.height);
    q.globalCompositeOperation = 'source-over';
    return c;
  }

  // ======================================================================
  // 共用：白鹭（侧面，朝 dir 方向）。fly 0 立在桩上 → 0.5 起飞前半蹲展翅 → 1 飞行；ph 扇翅相位
  // ======================================================================
  function egret(g, x, y, s, dir, fly, ph) {
    g.save(); g.translate(x, y); g.scale(s * dir, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const W1 = '#fbfcfa', SH = '#cfd8dc', OUTL = 'rgba(70,80,86,0.55)';
    if (fly < 0.5) {
      // 立姿：长腿、S 形颈、喙朝前；起飞前半蹲、翅膀抬起
      const k = fly * 2, crouch = Math.sin(k * PI * 0.5) * 6;
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(-2, -14 + crouch); g.lineTo(-1, 0); g.moveTo(2, -14 + crouch); g.lineTo(4, 0); g.stroke();
      g.fillStyle = W1; g.strokeStyle = OUTL; g.lineWidth = 0.8;
      g.beginPath(); g.ellipse(0, -20 + crouch, 11, 6, -0.25 - k * 0.3, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-9, -18 + crouch); g.quadraticCurveTo(-18, -14 + crouch, -20, -12 + crouch); g.lineTo(-8, -20 + crouch); g.fill();
      g.strokeStyle = W1; g.lineWidth = 3.4;
      g.beginPath(); g.moveTo(7, -23 + crouch); g.bezierCurveTo(14, -30 + crouch, 4, -36 + crouch + k * 6, 10, -42 + crouch + k * 8); g.stroke();
      g.strokeStyle = OUTL; g.lineWidth = 0.6; g.stroke();
      g.fillStyle = W1; g.beginPath(); g.ellipse(11, -43 + crouch + k * 8, 3.6, 2.8, 0, 0, TAU); g.fill();
      g.strokeStyle = '#e8c04a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(14, -43 + crouch + k * 8); g.lineTo(24, -42 + crouch + k * 8); g.stroke();
      if (k > 0.3) { g.fillStyle = rgba(W1, 0.9); g.beginPath(); g.moveTo(-4, -22 + crouch); g.quadraticCurveTo(-10, -40 - 10 * k, -22, -42 - 14 * k); g.quadraticCurveTo(-12, -26, -6, -18 + crouch); g.fill(); }
    } else {
      // 飞姿：颈缩成 S、腿向后伸直，大翅缓缓上下
      const f = Math.sin(ph), wy = -f * 26;
      g.strokeStyle = 'rgba(50,50,48,0.8)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-9, 1); g.lineTo(-31, 3.5); g.moveTo(-9, 2); g.lineTo(-30, 5.5); g.stroke();
      g.strokeStyle = '#c8a040'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-31, 3.5); g.lineTo(-34, 3); g.moveTo(-30, 5.5); g.lineTo(-33, 6); g.stroke();
      const wing = (k, col, a) => {
        const tipY = wy * k, tipX = -4 - 6 * Math.abs(f);
        g.globalAlpha = a; g.fillStyle = K.lin(g, 0, 0, 0, tipY || 1, [[0, col], [1, mix(col, '#c4ced4', 0.5)]]); g.strokeStyle = 'rgba(120,132,140,0.35)'; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(6, -1.5);
        g.bezierCurveTo(4, tipY * 0.4 - 2 * Math.sign(tipY || -1), tipX + 6, tipY * 0.9, tipX, tipY);
        // 后缘羽片
        for (let i = 1; i <= 4; i++) { const u = i / 4; g.quadraticCurveTo(lerp(tipX, -16, u) - 2, lerp(tipY, 1, u) + (tipY < 0 ? 3 : -3), lerp(tipX, -16, u), lerp(tipY, 1, u) + (tipY < 0 ? 1 : -1) * (i < 4 ? 2 : 0)); }
        g.lineTo(-10, 1); g.closePath(); g.fill(); g.stroke(); g.globalAlpha = 1;
      };
      wing(0.85, SH, 0.9);
      g.fillStyle = W1; g.strokeStyle = OUTL; g.lineWidth = 0.7;
      g.beginPath(); g.ellipse(0, 0, 13, 4.6, 0.04, 0, TAU); g.fill(); g.stroke();
      // 缩起的颈与头、黄喙
      g.strokeStyle = W1; g.lineWidth = 4.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(9, -1); g.quadraticCurveTo(15, -2, 14, -6); g.quadraticCurveTo(13, -9, 17, -9); g.stroke();
      g.strokeStyle = OUTL; g.lineWidth = 0.5; g.stroke();
      g.fillStyle = W1; g.beginPath(); g.ellipse(18, -9, 3.6, 2.8, 0, 0, TAU); g.fill();
      g.fillStyle = '#e2b640'; g.beginPath(); g.moveTo(21, -10); g.lineTo(31, -8.6); g.lineTo(21, -7.8); g.closePath(); g.fill();
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(19.2, -9.6, 0.7, 0, TAU); g.fill();
      wing(1, W1, 1);
    }
    g.restore();
  }

  // ======================================================================
  // o2_depart 渡口反打：从客栈檐下望向河面（长焦）；乌篷船载着白发人向右驶进日下的金光里，每拍一篙；
  // 小店伙计从廊柱后跑上栈道，5:02.3 在尽头停下手搭凉棚，抹布从肩上滑落；船上的人回头看了一眼；桃瓣从左上随风飘过
  // ======================================================================
  const O2 = { hz: 384, sx: 1050, sy: 300 };
  function o2Far() {
    return K.cache('g14o2far', W + 80, O2.hz + 12, 1, (q) => {
      q.translate(40, 0);
      const hz = O2.hz, sx = O2.sx, sy = O2.sy;
      E.sky(q, { stops: [[0, '#cfdbe3'], [0.4, '#e2e8e6'], [0.75, '#f2e6d0'], [1, '#f2dcb8']], y1: hz + 10, haze: '#f6e4c4', hazeY: hz, hazeA: 0.5 });
      // 低低的春日：在对岸屋顶后，雾里一团暖光，日轮淡淡一圈
      A.softBlob(q, sx, sy + 20, 640, 0.5, '#f8d8a4');
      A.softBlob(q, sx, sy, 200, 0.55, '#ffe8c0');
      q.fillStyle = K.rad(q, sx, sy, 0, 30, [[0, '#fffbf0'], [0.6, '#fff2d2'], [0.9, '#ffe2a6'], [1, 'rgba(255,214,150,0)']]); q.beginPath(); q.arc(sx, sy, 30, 0, TAU); q.fill();
      const r = rng(19);
      for (let i = 0; i < 6; i++) E.util.streak(q, 300 + r() * 900, 90 + r() * 150, 140 + r() * 220, 4 + r() * 6, '#ffffff', 0.35, -0.03);
      for (let i = 0; i < 3; i++) E.util.streak(q, sx - 160 + r() * 260, sy - 30 + r() * 50, 160 + r() * 140, 3 + r() * 3, '#ffd9a0', 0.4, -0.02);
      E.mountains(q, { t: 0, lightDir: -1, fog: '#eef1f0', fogA: 0.6, layers: [
        { kind: 'far', color: '#cdd7de', light: '#f6f1e8', litA: 0.5, y: hz - 34, scaleY: 0.42, seed: 71, offset: 260, speed: 0, fogH: 80, fogY: 8 },
        { kind: 'mid', color: '#b6c4cd', light: '#eee8dc', litA: 0.45, y: hz - 18, scaleY: 0.3, seed: 33, offset: 900, speed: 0, fogH: 70, fogY: 6 },
      ] });
      // 远岸：最后一排更淡的屋脊；左段人家大而近、右段小而远，中间一大片柳与桃隔开
      E.jiangnanTown(q, { t: 0, y: hz - 12, x0: -40, x1: 1320, scale: 0.28, seed: 58, color: '#e9ebe8', roof: '#9aa2a8', haze: '#e6eaea', hazeA: 0.62, smoke: 0, bank: false });
      E.jiangnanTown(q, { t: 0, y: hz - 1, x0: -60, x1: 470, scale: 0.6, seed: 37, color: '#eceae2', roof: '#59626b', haze: '#dfe5e8', hazeA: 0.3, smoke: 0, bank: true, light: '#fff4e0', lightX: 1 });
      E.jiangnanTown(q, { t: 0, y: hz - 3, x0: 900, x1: 1340, scale: 0.38, seed: 44, color: '#ece7dc', roof: '#62686f', haze: '#ecdcc4', hazeA: 0.3, smoke: 0, bank: true });
      for (const [x, sd, sc] of [[506, 4, 0.36], [610, 11, 0.32], [742, 7, 0.34], [858, 15, 0.3], [180, 13, 0.26], [1250, 9, 0.28]]) E.willow(q, { x, y: hz + 2, s: sc, t: 0, wind: 0.25, color: '#a8c46c', ink: '#8a8a7c', seed: sd, alpha: 0.85, n: 64 });
      for (const [x, sc, sd] of [[560, 0.2, 401], [668, 0.22, 402], [800, 0.19, 403], [702, 0.15, 404]]) {
        const T2 = treeGeo(sd, { trunk: 110, lean: 0, dir: 0, len: 100, w: 6, base: 8, n: 5, fs: 1.8, cl: 0.25, res: 0.6 });
        q.globalAlpha = 0.85; q.save(); q.translate(x, hz + 2); q.scale(sc, sc); q.drawImage(treeFull(T2, '#5a5048'), T2.box[0], T2.box[1], T2.box[2], T2.box[3]); q.restore(); q.globalAlpha = 1;
      }
      E.archBridge(q, { x: 1120, y: hz + 1, s: 0.42, span: 180, color: '#b0aea6', haze: '#ecdcc4', hazeA: 0.45 });
      // 日光从屋后透过来：屋脊一圈被吃掉
      q.globalCompositeOperation = 'lighter'; A.glow(q, sx, sy + 20, 240, '#ffd8a0', 0.22); q.globalCompositeOperation = 'source-over';
      // 雾团：遮掉四成屋墙
      for (let i = 0; i < 26; i++) A.softBlob(q, r() * (W + 40), hz - 4 - r() * 34, 50 + r() * 90, 0.34 + r() * 0.24, '#f3f2ec');
      q.fillStyle = K.lin(q, 0, hz - 46, 0, hz + 10, [[0, 'rgba(242,240,234,0)'], [0.6, 'rgba(242,240,234,0.55)'], [1, 'rgba(242,240,234,0.85)']]); q.fillRect(-40, hz - 46, W + 80, 56);
    });
  }
  // 远岸倒影：翻过来、糊一点、越远离岸线越淡，底色是水
  function o2Refl() {
    const h = 340;
    return K.cache('g14o2refl', W + 80, h, 1, (q) => {
      if ('filter' in q) q.filter = `blur(${(1.4 * SC()).toFixed(2)}px)`;
      q.save(); q.translate(0, 2); q.scale(1, -1); q.drawImage(o2Far(), 0, -O2.hz - 12, W + 80, O2.hz + 12); q.restore();
      q.filter = 'none';
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, 'rgba(0,0,0,0.3)'], [0.4, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(0, 0, W + 80, h);
      q.globalCompositeOperation = 'destination-over';
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, '#ece6da'], [0.35, '#c8d4da'], [1, '#86a2b4']]); q.fillRect(0, 0, W + 80, h);
      q.globalCompositeOperation = 'source-over';
      // 日下水面一条暖色的光带（底色，碎光另画）
      q.fillStyle = K.lin(q, O2.sx + 40 - 280, 0, O2.sx + 40 + 280, 0, [[0, 'rgba(250,214,160,0)'], [0.5, 'rgba(250,214,160,0.5)'], [1, 'rgba(250,214,160,0)']]); q.fillRect(O2.sx + 40 - 280, 0, 560, h);
    });
  }
  // 栈道：从左下（客栈门口）伸向河心，近宽远窄；尽头拉近到 y≈600（孩子停在那里还看得清）
  const O2P = { nl: [-70, 772], nr: [300, 772], fr: [458, 598], fl: [384, 604] };
  const o2Deck = (u, v) => {   // u 0 近 1 远（屏幕插值参数），v 0 左 1 右
    const L = [lerp(O2P.nl[0], O2P.fl[0], u), lerp(O2P.nl[1], O2P.fl[1], u)], R = [lerp(O2P.nr[0], O2P.fr[0], u), lerp(O2P.nr[1], O2P.fr[1], u)];
    return [lerp(L[0], R[0], v), lerp(L[1], R[1], v)];
  };
  const o2Pu = (d) => (1 - 1 / (1 + 1.3 * d)) / (1 - 1 / 2.3);   // 深度 d 0..1 → 屏幕参数
  function o2Pier() {
    return K.cache('g14o2pier', 560, 300, 1, (q) => {
      q.translate(0, -500);
      for (let k = 0; k <= 7; k++) {
        const u = o2Pu(k / 7), [x, y] = o2Deck(u, 1), w = lerp(11, 5, u), hgt = lerp(44, 18, u);
        q.fillStyle = '#3e2e22'; q.fillRect(x - w, y, w, hgt);
        q.fillStyle = K.lin(q, 0, y + hgt, 0, y + hgt * 2.4, [[0, 'rgba(62,46,34,0.4)'], [1, 'rgba(62,46,34,0)']]); q.fillRect(x - w, y + hgt, w, hgt * 1.4);
        q.strokeStyle = 'rgba(255,255,250,0.45)'; q.lineWidth = 1; q.beginPath(); q.ellipse(x - w / 2, y + hgt, w * 1.4, w * 0.35, 0, 0, TAU); q.stroke();
      }
      q.beginPath();
      const [a0, a1] = [o2Deck(0, 1), o2Deck(1, 1)];
      q.moveTo(a0[0], a0[1]); q.lineTo(a1[0], a1[1]); q.lineTo(a1[0], a1[1] + 6); q.lineTo(a0[0], a0[1] + 18); q.closePath();
      q.fillStyle = '#4a3828'; q.fill();
      q.beginPath();
      const c = [o2Deck(0, 0), o2Deck(0, 1), o2Deck(1, 1), o2Deck(1, 0)];
      q.moveTo(c[0][0], c[0][1]); c.slice(1).forEach((p) => q.lineTo(p[0], p[1])); q.closePath();
      q.fillStyle = K.lin(q, 0, 772, 0, 598, [[0, '#a07e5c'], [1, '#c4aa86']]); q.fill();
      const r = rng(23);
      for (let i = 0; i <= 30; i++) {
        const u = o2Pu(i / 30), A0 = o2Deck(u, 0), B0 = o2Deck(u, 1);
        q.strokeStyle = `rgba(58,40,26,${0.55 - u * 0.25})`; q.lineWidth = lerp(1.8, 0.7, u);
        q.beginPath(); q.moveTo(A0[0], A0[1]); q.lineTo(B0[0], B0[1]); q.stroke();
        q.fillStyle = `rgba(255,240,214,${0.05 + r() * 0.08})`;
        const u2 = o2Pu((i + 0.5) / 30), A1 = o2Deck(u2, 0), B1 = o2Deck(u2, 1);
        q.beginPath(); q.moveTo(A0[0], A0[1]); q.lineTo(B0[0], B0[1]); q.lineTo(B1[0], B1[1]); q.lineTo(A1[0], A1[1]); q.closePath(); q.fill();
      }
      q.strokeStyle = 'rgba(70,50,32,0.18)'; q.lineWidth = 0.8;
      for (let i = 0; i < 9; i++) { const v = (i + 0.5) / 9, A0 = o2Deck(0, v), B0 = o2Deck(1, v); q.beginPath(); q.moveTo(A0[0], A0[1]); q.lineTo(B0[0], B0[1]); q.stroke(); }
      // 迎光的板沿：日在右前方，右沿一线暖
      q.strokeStyle = 'rgba(255,226,180,0.7)'; q.lineWidth = 1.4;
      const l0 = o2Deck(0, 1), l1 = o2Deck(1, 1); q.beginPath(); q.moveTo(l0[0], l0[1]); q.lineTo(l1[0], l1[1]); q.stroke();
      const e0 = o2Deck(1, 0), e1 = o2Deck(1, 1); q.strokeStyle = 'rgba(255,236,206,0.6)'; q.beginPath(); q.moveTo(e0[0], e0[1]); q.lineTo(e1[0], e1[1]); q.stroke();
      const m = o2Deck(1, 0.86); q.fillStyle = '#3a2c20'; q.fillRect(m[0] - 3, m[1] - 18, 6, 19); q.fillStyle = '#5a4634'; q.fillRect(m[0] - 3.8, m[1] - 20, 7.6, 3);
    });
  }
  // 近景：客栈檐角（檐底椽子、瓦当）、廊柱与褪色楹联（暗、实）
  function o2Front() {
    return K.cache('g14o2front|' + fontKey('风送客帆远'), 420, 720, 1, (q) => {
      const edge = (u) => [lerp(-10, 440, u), lerp(112, 50, u) - Math.pow(u, 5) * 30];
      q.beginPath(); q.moveTo(-10, -10); q.lineTo(420, -10);
      for (let i = 40; i >= 0; i--) { const [x, y] = edge(i / 40); q.lineTo(x, y); }
      q.closePath();
      q.fillStyle = K.lin(q, 0, 0, 0, 110, [[0, '#1c1714'], [1, '#2e2520']]); q.fill();
      q.save(); q.clip();
      for (let i = 0; i < 22; i++) { const [x, y] = edge((i + 0.5) / 22); q.strokeStyle = 'rgba(110,84,60,0.45)'; q.lineWidth = 5; q.beginPath(); q.moveTo(x, y - 6); q.lineTo(x - 50, y - 120); q.stroke(); }
      q.restore();
      for (let i = 0; i < 26; i++) { const [x, y] = edge((i + 0.5) / 26); q.fillStyle = '#231d19'; q.beginPath(); q.arc(x, y + 1, 6.5, 0, PI); q.fill(); q.strokeStyle = 'rgba(255,236,206,0.4)'; q.lineWidth = 1; q.beginPath(); q.arc(x, y + 1, 6.5, 0.3, PI - 0.3); q.stroke(); }
      q.strokeStyle = 'rgba(255,236,206,0.5)'; q.lineWidth = 1.5;
      q.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = edge(i / 40); i ? q.lineTo(x, y + 7) : q.moveTo(x, y + 7); } q.stroke();
      q.fillStyle = K.lin(q, 0, 0, 74, 0, [[0, '#15100c'], [0.65, '#3a2a20'], [1, '#22190f']]); q.fillRect(0, 60, 74, 700);
      q.fillStyle = 'rgba(255,228,190,0.25)'; q.fillRect(62, 60, 3, 700);
      q.fillStyle = '#a8442e'; q.fillRect(30, 170, 26, 330); q.fillStyle = 'rgba(30,20,14,0.28)'; q.fillRect(30, 170, 26, 330);
      q.fillStyle = 'rgba(30,22,16,0.72)'; q.font = `19px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      Array.from('风送客帆远').forEach((ch, i) => q.fillText(ch, 43, 200 + i * 62));
      q.fillStyle = '#2a211b'; q.fillRect(0, 96, 190, 14);
    });
  }
  // 檐角伸出的桃枝：挪到右边，让开灯笼
  const O2FB = { seed: 183, trunk: 0, base: 0, w: 6, n: 3, len: 150, angles: [0.18, 0.6, -0.15], aim: 0.35, pull: 0.04, fs: 1.15, cl: 0.32, low: 0, res: 1.25 };
  function o2Times(c) {
    const ts = ts0(c), i0 = beatI(c, ts);
    const beats = []; for (let k = -1; k < 7; k++) beats.push(c.grid.time(i0 + k));
    return { ts, beats, tStop: nearB(c, ts + 1.66) };
  }
  // 船：慢慢漂远，每一篙往前一冲（0.4 s 缓出）；越远越小
  function o2Boat(T, t) {
    let push = 0;
    for (const tb of T.beats) if (t > tb && tb >= T.ts - 0.9) push += 1 - Math.exp(-(t - tb) / 0.4);
    const x = 740 + 26 * (t - T.ts + 0.9) + 30 * push, k = clamp((x - 760) / 230, -0.2, 1.3);
    return { x, y: 470 - 20 * k, s: 1.15 - 0.25 * k };
  }
  // 抹布：一条软布（三段，边是弯的），飘的时候各段翻折、波动；落地后平铺，一道折痕
  function towelCloth(g, t, flut) {
    const seg = [], n = 3, L = 8.5;
    let x = -12, y = 0, a = 0;
    seg.push([x, y, a]);
    for (let i = 0; i < n; i++) { a += Math.sin(t * 12 + i * 2.1) * 0.55 * flut + (i === 1 ? 0.25 * flut : 0); x += Math.cos(a) * L; y += Math.sin(a) * L; seg.push([x, y, a]); }
    const hw = (i) => 4.6 * (1 - 0.12 * i) * (1 - 0.35 * flut * Math.abs(Math.sin(t * 9 + i)));
    const side = (sd) => seg.map(([px, py, pa], i) => [px - Math.sin(pa) * hw(i) * sd, py + Math.cos(pa) * hw(i) * sd]);
    const U = side(-1), D = side(1);
    g.beginPath(); g.moveTo(U[0][0], U[0][1]);
    for (let i = 1; i <= n; i++) { const mx = (U[i - 1][0] + U[i][0]) / 2, my = (U[i - 1][1] + U[i][1]) / 2 - 1.2 * flut; g.quadraticCurveTo(mx, my, U[i][0], U[i][1]); }
    g.lineTo(D[n][0], D[n][1]);
    for (let i = n - 1; i >= 0; i--) { const mx = (D[i + 1][0] + D[i][0]) / 2, my = (D[i + 1][1] + D[i][1]) / 2 + 1.2; g.quadraticCurveTo(mx, my, D[i][0], D[i][1]); }
    g.closePath();
    g.fillStyle = K.lin(g, -12, -5, 14, 5, [[0, '#f6f3ea'], [0.5, '#e6e1d4'], [1, '#f2eee4']]); g.fill();
    g.strokeStyle = 'rgba(80,74,66,0.5)'; g.lineWidth = 0.7; g.stroke();
    // 折痕与蓝边
    g.strokeStyle = 'rgba(120,112,100,0.45)'; g.lineWidth = 0.6;
    for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(U[i][0], U[i][1]); g.lineTo(D[i][0], D[i][1]); g.stroke(); }
    g.strokeStyle = '#7397ab'; g.lineWidth = 1; g.beginPath(); g.moveTo(D[0][0], D[0][1] - 1.4); for (let i = 1; i <= n; i++) g.lineTo(D[i][0], D[i][1] - 1.4); g.stroke();
  }
  XYT.registerShot('o2_depart', {
    name: '渡口反打', zone: 'top', night: false, text: '#1a2026', shadow: 'rgba(242,236,222,0.85)', accent: '#7397ab', bloom: 0.26,
    draw(g, c) {
      const t = c.t, lt = c.lt, T = o2Times(c), hz = O2.hz, sx = O2.sx, sy = O2.sy;
      // ---------- 远岸与低日 ----------
      blitN(g, o2Far(), -40, 0, W + 80, hz + 12);
      withOp(g, 'lighter', () => glow(g, sx, sy + 10, 170, '#ffe2b0', 0.22 + 0.1 * c.be(0.6)));
      E.mist(g, { t, y: hz - 22, h: 70, color: '#f3f1ea', alpha: 0.45, speed: 6, seed: 12 });
      // ---------- 河面：远岸倒影（分条错开成水波） ----------
      const R = o2Refl(), rows = 16, rh = 340, sm = g.imageSmoothingEnabled;
      g.imageSmoothingEnabled = false;
      for (let i = 0; i < rows; i++) {
        const v0 = Math.pow(i / rows, 1.5), v1 = Math.pow((i + 1) / rows, 1.5), ya = v0 * rh, yb = v1 * rh;
        const dx = Math.sin(i * 1.9 - t * 1.4) * (0.5 + 3 * v0) + Math.sin(i * 0.7 + t * 0.6) * 1.2 * v0;
        g.drawImage(R, 0, ya * (R.height / rh), R.width, (yb - ya) * (R.height / rh) + 0.5, -40 + dx, hz + ya, W + 80, yb - ya + 0.5);
      }
      g.imageSmoothingEnabled = sm;
      // 日下的金色碎光：一条光路从对岸铺到眼前，船正驶进去
      withOp(g, 'lighter', () => {
        const spr = XYT.sprites.tint(XYT.sprites.glow, '#ffc45c');
        for (let i = 0; i < 70; i++) {
          const u = Math.pow(h2(i, 71), 1.25), yy = hz + 6 + u * 330, f = noise1(t * 1.8 + i * 0.83, 6);
          if (f < 0.42) continue;
          const hw = 26 + u * 190, xx = sx + 40 + (h2(i, 72) - 0.5) * 2 * hw * (0.5 + 0.5 * h2(i, 73)) + Math.sin(t * 1.2 + i) * 4, len = 10 + u * 54;
          g.globalAlpha = Math.min(1, (f - 0.42) * 2.2 * (0.55 + 0.45 * (1 - u)));
          g.drawImage(spr, xx - len / 2, yy - 1.5 - u * 2, len, 3 + u * 4);
        }
        g.globalAlpha = 1;
      });
      // 水面细亮痕：慢慢横移
      g.strokeStyle = 'rgba(255,252,244,0.4)'; g.lineCap = 'round';
      for (let grp = 0; grp < 3; grp++) {
        g.beginPath();
        for (let i = grp; i < 36; i += 3) {
          const u = Math.pow(h2(i, 41), 1.3), yy = hz + 8 + u * 320, len = (14 + h2(i, 42) * 60) * (0.4 + u * 1.6);
          const x = ((h2(i, 43) * (W + 300) + t * (5 + 10 * u)) % (W + 300)) - 150;
          g.moveTo(x, yy); g.lineTo(x + len, yy);
        }
        g.lineWidth = 0.8 + grp * 0.7; g.globalAlpha = 0.6 - grp * 0.12; g.stroke();
      }
      g.globalAlpha = 1;
      // 水面漂着的落瓣，慢慢顺流
      for (let i = 0; i < 16; i++) {
        const u = h2(i, 61), yy = hz + 40 + u * u * 300, x = ((h2(i, 62) * (W + 100) + t * (4 + 8 * u)) % (W + 100)) - 50, sz = 3 + u * 6;
        g.fillStyle = rgba(i % 3 ? '#f4b8c6' : '#fbdde4', 0.85);
        g.beginPath(); g.ellipse(x, yy, sz, sz * 0.4, h2(i, 63) - 0.5, 0, TAU); g.fill();
      }
      // ---------- 船：倒影、尾迹、篙 ----------
      const B = o2Boat(T, t), bob = Math.sin(t * 1.3) * 1.8, by = B.y + bob, bs = B.s;
      const tb = c.grid.time(c.b.i), sinceB = t - tb, Bb = o2Boat(T, tb);
      const P = c.b.period || 0.83, ph = clamp(sinceB / P);
      const stern = B.x - 140 * bs, bow = B.x + 150 * bs;
      // 倒影
      g.save(); g.beginPath(); g.rect(-40, B.y + 2, W + 80, 200); g.clip();
      g.translate(0, 2 * B.y + 6); g.scale(1, -1); g.globalAlpha = 0.3;
      drawBoat(g, B.x, by, bs, 0, '#3b2f26', '#2c2a2e');
      g.restore();
      // 尾迹：船尾后一串短短的断弧，越远越开、越淡
      g.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const fr = ((k + (t * 1.1) % 1) / 7), d = fr * 330 * bs, a = 0.5 * (1 - fr), spread = 6 + fr * 46 * bs;
        for (const sd of [-1, 1]) {
          const x0 = stern - d, y0 = B.y + 5 + sd * spread * 0.32;
          g.strokeStyle = rgba('#ffffff', a * (sd > 0 ? 1 : 0.7)); g.lineWidth = 1.4 - fr * 0.6;
          g.beginPath(); g.moveTo(x0 + 8 * bs, y0 - sd * 1.5); g.quadraticCurveTo(x0, y0 + sd * 2, x0 - (12 + 10 * fr) * bs, y0 + sd * (2 + 3 * fr)); g.stroke();
        }
      }
      // 船头浪：每篙一冲，船头翻起一弯白
      const surge = Math.exp(-Math.max(0, sinceB) / 0.4);
      g.strokeStyle = rgba('#ffffff', 0.55 + 0.35 * surge); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(bow - 6 * bs, B.y + 3); g.quadraticCurveTo(bow + (8 + 14 * surge) * bs, B.y - 2 - 4 * surge, bow + (20 + 18 * surge) * bs, B.y + 5); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.3 + 0.3 * surge); g.lineWidth = 1;
      g.beginPath(); g.moveTo(bow - 20 * bs, B.y + 8); g.quadraticCurveTo(bow + 6 * bs, B.y + 10, bow + (26 + 20 * surge) * bs, B.y + 9); g.stroke();
      // 每拍篙点水：一圈涟漪、几点水花
      const strikeX = Bb.x - 118 * Bb.s - 26, wy = B.y + 6;
      for (let k = 0; k < 3; k++) {
        const ti = c.grid.time(c.b.i - k);
        if (ti < T.ts - 0.9 || t < ti) continue;
        const Bk = o2Boat(T, ti);
        E.ripples(g, { x: Bk.x - 118 * Bk.s - 26, y: Bk.y + 6, t, t0: ti, scale: 1.1, color: '#ffffff', alpha: 0.6, life: 2 });
      }
      if (sinceB >= 0 && sinceB < 0.6) {
        for (let i = 0; i < 5; i++) {
          const vx = (h2(c.b.i, i) - 0.5) * 60, vy = -(70 + 60 * h2(c.b.i, i + 7)), a2 = sinceB;
          const px = strikeX + vx * a2, py = wy + vy * a2 + 260 * a2 * a2;
          if (py > wy + 2) continue;
          g.fillStyle = rgba('#ffffff', 0.85 * (1 - a2 / 0.6)); g.beginPath(); g.ellipse(px, py, 1.8, 2.4, 0, 0, TAU); g.fill();
        }
      }
      // 船夫：船尾立着撑篙，每拍身子往前一压
      const man = { x: B.x - 112 * bs, y: by - 12 * bs };
      F.draw(g, 'villager', man.x, man.y, 0.5 * bs / 0.62, t, { facing: 1, variant: 0, pose: 'stand', lean: 0.1 + 0.16 * Math.sin(ph * PI), wind: 0.3, tone: 'silhouette', ink: '#3a3630' });
      {
        const hand = [man.x + 6 * bs, man.y - 72 * bs];
        let tip;
        if (ph < 0.62) tip = [strikeX, wy + 10];
        else { const u = (ph - 0.62) / 0.38, nx = B.x - 118 * bs - 26 + 30 * bs; tip = [lerp(strikeX, nx, easeInOut(u)), wy + 10 - Math.sin(u * PI) * 50 * bs]; }
        const dx = tip[0] - hand[0], dy = tip[1] - hand[1], dl = Math.hypot(dx, dy);
        g.strokeStyle = '#3a3329'; g.lineWidth = 2.6 * bs / 0.62; g.lineCap = 'round';
        g.beginPath(); g.moveTo(hand[0] - (dx / dl) * 70 * bs, hand[1] - (dy / dl) * 70 * bs); g.lineTo(tip[0], Math.min(tip[1], wy + 2)); g.stroke();
      }
      drawBoat(g, B.x, by, bs, Math.sin(t * 0.9) * 0.01, '#3b2f26', '#2c2a2e');
      // 船头坐着的白发人：素灰旧衫、白发、蓝发带，迎着日光一圈暖边；孩子停下那一拍，他回过身望一眼
      {
        const tS = T.tStop, turn = ss(tS, tS + 0.22, t) * (1 - ss(tS + 1.15, tS + 1.37, t)), fc = Math.cos(turn * PI), fx = (fc < 0 ? -1 : 1) * Math.max(0.38, Math.abs(fc));
        const px = B.x + 70 * bs, py = by - 12 * bs;
        g.save(); g.translate(px, 0); g.scale(fx, 1); g.translate(-px, 0);
        F.draw(g, 'xiaoyao', px, py, 0.5 * bs / 0.62, t, { stage: 'old', pose: 'sit', facing: 1, wind: 0.45, windDir: fx > 0 ? -1 : 1, tone: 'silhouette', ink: '#727c82', whiteHair: true, ribbon: '#4c8dae', accent: '#7397ab', rim: '#ffe2b0', light: [sx, sy], head: turn > 0.5 ? -0.05 : 0 });
        g.restore();
      }
      // ---------- 栈道与孩子 ----------
      blitN(g, o2Pier(), 0, 500, 560, 300);
      const tS = T.tStop, runK = clamp((t - T.ts) / (tS - T.ts)), d = 1 - Math.pow(1 - runK, 1.6);
      // 从廊柱后（x≈40）跑出，斜着跑到栈道尽头的中间
      const u = lerp(0.3, 1, d), [kx0, ky] = o2Deck(u, lerp(0.02, 0.5, Math.pow(d, 0.7))), kx = kx0 - (1 - d) * 40;
      const ks = lerp(1.25, 0.94, d), moving = t < tS, sinceStop = t - tS;
      const spd = moving ? 1 - 0.85 * ss(0.6, 1, runK) : 0;
      const ph2 = ((t - T.ts) * 3.2 * TAU) * (1 - 0.2 * runK);
      kid(g, kx, ky, ks, t, { facing: 1, run: spd, ph: ph2, towel: sinceStop < 0 ? 1 : 0, shade: ss(0.12, 0.45, sinceStop), lean: sinceStop > 0 ? 0.06 * Math.exp(-sinceStop / 0.3) * Math.sin(sinceStop * 12) : 0, dip: sinceStop > 0 ? 2 * Math.exp(-sinceStop / 0.25) : 0, top: '#8c6a48', pants: '#4a4036', rimCol: '#ffe6bc' });
      // 抹布滑落：先顺着背滑下，三折翻飞 0.6 s，平铺落在脚边的板上
      if (sinceStop > 0) {
        const fu = clamp(sinceStop / 0.75), shx = kx + 1 * ks, shy = ky - 71 * ks, lx = kx - 20 * ks, ly = ky - 1;
        const px = lerp(shx, lx, easeIn(fu)) - Math.sin(fu * PI) * 16 * ks, py = lerp(shy, ly, easeIn(Math.pow(fu, 0.85)));
        const flut = 1 - ss(0.75, 1, fu), rot = lerp(1.25, 0.1, ss(0.05, 1, fu)) + Math.sin(sinceStop * 9) * 0.35 * flut, sq = lerp(1, 0.38, ss(0.8, 1, fu));
        g.save(); g.translate(px, py); g.scale(ks, ks * sq); g.rotate(rot);
        towelCloth(g, t, flut);
        g.restore();
        if (fu >= 1) { g.fillStyle = 'rgba(40,30,20,0.18)'; g.beginPath(); g.ellipse(lx + 2, ly + 1.5, 11 * ks, 2.2 * ks, 0, 0, TAU); g.fill(); }
      }
      E.mist(g, { t, y: hz + 40, h: 60, color: '#f4f2ec', alpha: 0.22, speed: -8, seed: 14 });
      // 晨光：从低日斜斜穿过雾，照进檐下
      V.godRays(g, c, { x: sx, y: sy, angle: PI + 0.1, spread: 0.55, n: 5, len: 1300, width: 1.3, start: 0.08, color: '#fff0d2', alpha: 0.35, blend: 'screen', beat: 0.4, res: 0.08, seed: 21, source: false, motes: 12, moteColor: '#fff8e6' });
      // ---------- 近景：檐角、廊柱、灯笼、桃枝 ----------
      blitN(g, o2Front(), 0, 0, 420, 720);
      {
        const TB = treeGeo(O2FB.seed, O2FB), sw = Math.sin(t * 1.2) * 0.02 + 0.025 * c.be(0.5);
        drawTree(g, TB, 236, 60, 0.95, t, { bloomAt: -1e9, sway: sw, ink: '#2a201c' });
      }
      E.lantern(g, { x: 168, y: 96, s: 1.05, t, color: '#c8402e', lit: 0.3, swing: 0.08, cord: 14, seed: 3 });
      // 桃瓣：从左上随风飘过，随拍一阵一阵
      V.petals(g, c, { kind: 'peach', n: 22, seed: 43, wind: 52, fall: 24, gust: 34, size: [8, 24], area: [-40, -40, 1000, 620] });
    },
  });

  // ======================================================================
  // o3_jetty 渡头小女孩：仙灵岛春晨的雾，桃林边一截木渡头；白衣淡紫发带的小女孩立在渡头上张望；
  // 船从左边雾里每拍往前一冲、驶进日下的金光；5:07.35 强拍白鹭从桩头起飞，先陡升再向左滑向船；一阵风把她的发带扬起
  // ======================================================================
  const O3 = { hz: 440, end: [822, 540], shore: [1150, 530], sun: [330, 230], gx: 900 };
  const O3TF = { seed: 441, trunk: 190, lean: -0.12, dir: -0.6, len: 170, w: 10, base: 14, n: 6, spread: 2.6, fs: 1.3, cl: 0.13, res: 1.1 };
  function o3Far() {
    return K.cache('g14o3far', W + 80, O3.hz + 16, 1, (q) => {
      q.translate(40, 0);
      const hz = O3.hz, [sx, sy] = O3.sun;
      E.sky(q, { stops: [[0, '#cfe2e6'], [0.42, '#e4ece6'], [0.78, '#f2e8d4'], [1, '#f2e2c4']], y1: hz + 14, haze: '#f6e8cc', hazeY: hz, hazeA: 0.55 });
      // 日晕：金色、偏暖，不发白（让日轮自己亮出来）
      A.softBlob(q, sx, sy + 30, 560, 0.36, '#f2cc8c');
      A.softBlob(q, sx, sy, 180, 0.32, '#f6d49a');
      // 远处的仙岛石峰：青绿、金边，脚下没在雾里，很淡
      for (const [x, h, w, sd, a] of [[110, 210, 66, 3, 0.17], [196, 140, 50, 8, 0.13], [590, 120, 44, 5, 0.11], [980, 190, 60, 11, 0.16]]) {
        q.globalAlpha = a;
        E.stonePeak(q, { x, y: hz + 6, h, w, color: '#7fa9a2', light: '#efd8a0', haze: '#e4eeea', base: '#f3f1e6', mist: false, wisps: 0, seed: sd, lightDir: x < sx + 40 ? 1 : -1 });
      }
      q.globalAlpha = 1;
      // 雾里的日轮：暖白的盘、金边，前面横过两缕薄雾
      q.globalCompositeOperation = 'lighter'; A.glow(q, sx, sy, 230, '#e8963c', 0.22); q.globalCompositeOperation = 'source-over';
      q.fillStyle = K.rad(q, sx, sy, 0, 50, [[0, '#fff8e6'], [0.75, '#fff0cc'], [0.94, '#ffe2a8'], [1, 'rgba(255,220,160,0.6)']]); q.beginPath(); q.arc(sx, sy, 50, 0, TAU); q.fill();
      E.util.streak(q, sx + 20, sy + 16, 280, 7, '#f6eee0', 0.6, -0.02); E.util.streak(q, sx - 70, sy + 36, 220, 5, '#f6eee0', 0.5, -0.02);
      E.mountains(q, { t: 0, lightDir: -1, fog: '#f1f2e8', fogA: 0.7, layers: [{ kind: 'far', color: '#c8d9d6', light: '#f6ecd0', litA: 0.5, y: hz + 4, scaleY: 0.32, seed: 91, offset: 520, speed: 0, fogH: 70, fogY: 6 }] });
      q.fillStyle = K.lin(q, 0, hz - 70, 0, hz + 14, [[0, 'rgba(246,244,232,0)'], [1, 'rgba(246,244,232,0.9)']]); q.fillRect(-40, hz - 70, W + 80, 84);
    });
  }
  // 水面：天光与远峰、日轮的淡倒影；日下一条暖光带
  function o3Water() {
    return K.cache('g14o3water', W + 80, H - O3.hz + 20, 1, (q) => {
      const h = H - O3.hz + 20, sx = O3.sun[0] + 40;
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, '#f4f0e2'], [0.25, '#e2ece8'], [0.7, '#c8dcdc'], [1, '#b2ced2']]); q.fillRect(0, 0, W + 80, h);
      q.save(); q.translate(0, -2); q.scale(1, -1); q.globalAlpha = 0.45;
      if ('filter' in q) q.filter = `blur(${(2 * SC()).toFixed(2)}px)`;
      q.drawImage(o3Far(), 0, -O3.hz - 16, W + 80, O3.hz + 16);
      q.filter = 'none'; q.restore(); q.globalAlpha = 1;
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, 'rgba(232,240,238,0)'], [0.5, 'rgba(214,230,232,0.3)'], [1, 'rgba(178,206,212,0.75)']]); q.fillRect(0, 0, W + 80, h);
      q.fillStyle = K.lin(q, sx - 240, 0, sx + 240, 0, [[0, 'rgba(255,224,170,0)'], [0.5, 'rgba(255,224,170,0.42)'], [1, 'rgba(255,224,170,0)']]); q.fillRect(sx - 240, 0, 480, h);
    });
  }
  // 岛岸：后排一道青绿岸，女孩身后那一段压暗成树荫；岸上桃林没在雾里；前排青绿草坡、水线一道深墨、草丛与落花、大树的根
  const O3BK = [[860, 518], [960, 506], [1060, 498], [1160, 490], [1260, 484], [1340, 482]];
  const O3FT = [[960, 760], [990, 640], [1040, 578], [1110, 548], [1200, 534], [1290, 528], [1350, 526]];
  const O3IB = { x: 820, y: 170, w: 520, h: 590 };
  function o3Isle() {
    return K.cache('g14o3isle', O3IB.w, O3IB.h, 1, (q) => {
      q.translate(-O3IB.x, -O3IB.y);
      q.beginPath(); smoothPath(q, O3BK); q.lineTo(1340, 560); q.lineTo(860, 560); q.closePath();
      q.fillStyle = K.lin(q, 0, 480, 0, 540, [[0, '#8fb8a6'], [1, 'rgba(180,210,200,0.2)']]); q.fill();
      for (const [x, sc, sd, a] of [[930, 0.42, 431, 0.5], [1010, 0.5, 432, 0.6], [1120, 0.56, 433, 0.68], [1250, 0.5, 434, 0.62], [1320, 0.46, 435, 0.55]]) {
        const T2 = treeGeo(sd, { trunk: 140, lean: (h2(sd, 3) - 0.5) * 0.3, dir: (h2(sd, 4) - 0.5) * 0.8, len: 140, w: 8, base: 11, n: 6, spread: 2.7, fs: 1.35, cl: 0.17, res: 0.8 });
        q.globalAlpha = a; q.save(); q.translate(x, polyY(O3BK, x) + 4); q.scale(sc, sc);
        q.drawImage(treeFull(T2, '#4a3e36'), T2.box[0], T2.box[1], T2.box[2], T2.box[3]); q.restore(); q.globalAlpha = 1;
      }
      q.fillStyle = K.lin(q, 0, 430, 0, 530, [[0, 'rgba(246,244,236,0)'], [0.6, 'rgba(246,244,236,0.55)'], [1, 'rgba(246,244,236,0.15)']]); q.fillRect(O3IB.x, 430, O3IB.w, 100);
      // 女孩身后一段岸：树荫里暗一些，白衣衬得出来
      q.save(); q.beginPath(); smoothPath(q, O3BK); q.lineTo(1340, 560); q.lineTo(860, 560); q.closePath(); q.clip();
      q.fillStyle = K.rad(q, O3.gx, 506, 10, 150, [[0, 'rgba(46,92,80,0.55)'], [0.6, 'rgba(46,92,80,0.3)'], [1, 'rgba(46,92,80,0)']]); q.fillRect(740, 420, 320, 160);
      q.restore();
      q.beginPath(); smoothPath(q, O3FT); q.lineTo(1350, 760); q.closePath();
      q.fillStyle = K.lin(q, 0, 526, 0, 760, [[0, '#a8ccb2'], [0.35, '#84b49a'], [1, '#62947e']]); q.fill();
      q.save(); q.clip();
      q.fillStyle = K.lin(q, 960, 0, 1350, 0, [[0, 'rgba(60,100,86,0.3)'], [0.3, 'rgba(60,100,86,0)'], [1, 'rgba(60,100,86,0)']]); q.fillRect(960, 520, 400, 240);
      q.fillStyle = K.lin(q, 0, 520, 0, 760, [[0, 'rgba(246,244,236,0.4)'], [0.4, 'rgba(246,244,236,0.08)'], [1, 'rgba(246,244,236,0)']]); q.fillRect(960, 520, 400, 240);
      const r = rng(31);
      for (let i = 0; i < 26; i++) A.softBlob(q, 980 + r() * 380, 560 + r() * 200, 30 + r() * 50, 0.18, r() < 0.5 ? '#cfe6c4' : '#4f8a70');
      // 坡上披麻皴：顺坡往下的短弧
      for (let i = 0; i < 120; i++) { const x = 980 + r() * 380, y0 = polyY(O3FT, x) + 6 + Math.pow(r(), 1.4) * 200, l = 8 + r() * 18; q.strokeStyle = r() < 0.7 ? `rgba(30,80,62,${0.1 + r() * 0.12})` : `rgba(236,246,210,${0.12 + r() * 0.12})`; q.lineWidth = 0.8 + r() * 1.2; q.beginPath(); q.moveTo(x, y0); q.quadraticCurveTo(x - 4, y0 + l * 0.5, x - 7 - r() * 4, y0 + l); q.stroke(); }
      // 草丛（一簇几叶）
      for (let i = 0; i < 180; i++) { const x = 980 + r() * 380, y = polyY(O3FT, x) + 4 + r() * 200, l = 5 + r() * 12; q.strokeStyle = r() < 0.6 ? 'rgba(36,80,60,0.3)' : 'rgba(226,244,200,0.38)'; q.lineWidth = 1 + r(); q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x - 2, y - l * 0.6, x - 3 + r() * 6, y - l); q.stroke(); }
      q.restore();
      // 水线：一道深墨、外侧一线水沫
      q.lineCap = 'round';
      q.strokeStyle = 'rgba(28,56,46,0.6)'; q.lineWidth = 3; q.beginPath(); smoothPath(q, O3FT); q.stroke();
      q.save(); q.translate(-3, 5); q.strokeStyle = 'rgba(255,255,250,0.55)'; q.lineWidth = 1.2; q.beginPath(); smoothPath(q, O3FT.slice(1)); q.stroke(); q.restore();
      q.save(); q.translate(0, 3); q.beginPath(); smoothPath(q, O3FT); q.strokeStyle = 'rgba(232,246,200,0.55)'; q.lineWidth = 1.3; q.stroke(); q.restore();
      stone(q, 1008, 640, 30, 22, 21); stone(q, 1052, 590, 20, 13, 22); stone(q, 1290, 560, 24, 14, 23);
      // 大桃树的根：几条爬在坡上
      q.strokeStyle = '#3a2c24'; q.lineCap = 'round';
      for (const [dx, dy, w] of [[-46, 8, 5], [-26, 12, 4], [30, 10, 5], [52, 6, 3.4], [-62, 3, 3]]) { q.lineWidth = w; q.beginPath(); q.moveTo(1236, 576); q.quadraticCurveTo(1236 + dx * 0.4, 576 + dy * 0.2, 1236 + dx, 578 + dy); q.stroke(); }
      q.strokeStyle = 'rgba(230,206,160,0.45)'; q.lineWidth = 1; for (const [dx, dy] of [[-46, 8], [30, 10]]) { q.beginPath(); q.moveTo(1236, 574); q.quadraticCurveTo(1236 + dx * 0.4, 574 + dy * 0.2, 1236 + dx, 576 + dy); q.stroke(); }
      // 落花：草间一层
      for (let i = 0; i < 96; i++) { const x = 990 + r() * 360, y = polyY(O3FT, x) + 6 + r() * 180; q.fillStyle = r() < 0.5 ? 'rgba(248,190,206,0.92)' : 'rgba(255,234,240,0.92)'; q.beginPath(); q.ellipse(x, y, 2.6, 1.4, r() * 3, 0, TAU); q.fill(); }
    });
  }
  // 岛岸在水里的倒影（只取水线以上的部分，翻过来、糊开、渐淡）
  function o3IsleRefl() {
    const wl = 528, h = 220;
    return K.cache('g14o3isler', O3IB.w, h, 0.5, (q) => {
      if ('filter' in q) q.filter = `blur(${(0.75 * SC()).toFixed(2)}px)`;
      q.save(); q.scale(1, -1); q.drawImage(o3Isle(), 0, 0, O3IB.w, O3IB.h, 0, -(wl - O3IB.y), O3IB.w, O3IB.h); q.restore();
      q.filter = 'none';
      q.globalCompositeOperation = 'destination-out';
      q.fillStyle = K.lin(q, 0, 0, 0, h, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,1)']]); q.fillRect(0, 0, O3IB.w, h);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 木渡头：从岸边向左伸进水里，略带透视（看得见板面和 8 像素厚的板边），水线处木桩一圈水纹，桩上系着缆绳
  const o3DeckY = (x) => lerp(O3.end[1], O3.shore[1], (x - O3.end[0]) / (O3.shore[0] - O3.end[0]));
  const O3WL = 20;   // 板面到水线
  function o3Jetty() {
    return K.cache('g14o3jetty', 380, 140, 1.5, (q) => {
      q.translate(-800, -470);
      const [ex, ey] = O3.end, [sx, sy] = O3.shore;
      const far = (x) => o3DeckY(x) - 5, near = (x) => o3DeckY(x) + 3;
      for (let k = 0; k <= 7; k++) {
        const x = lerp(ex + 6, sx - 10, k / 7), y = near(x) + 8;
        q.fillStyle = '#463628'; q.fillRect(x - 2.8, y - 2, 5.6, O3WL - 9);
        q.strokeStyle = 'rgba(255,255,250,0.6)'; q.lineWidth = 0.8; q.beginPath(); q.ellipse(x, o3DeckY(x) + O3WL, 6, 1.4, 0, 0, TAU); q.stroke();
      }
      // 板面（远沿高、近沿低）与板边
      q.beginPath(); q.moveTo(ex, far(ex)); q.lineTo(sx, far(sx)); q.lineTo(sx, near(sx)); q.lineTo(ex, near(ex)); q.closePath();
      q.fillStyle = K.lin(q, 0, ey - 6, 0, ey + 3, [[0, '#e2cba4'], [1, '#bc9a70']]); q.fill();
      q.beginPath(); q.moveTo(ex, near(ex)); q.lineTo(sx, near(sx)); q.lineTo(sx, near(sx) + 8); q.lineTo(ex, near(ex) + 8); q.closePath();
      q.fillStyle = K.lin(q, 0, ey + 3, 0, ey + 11, [[0, '#6a5038'], [1, '#3a2a1e']]); q.fill();
      q.strokeStyle = 'rgba(60,44,30,0.55)'; q.lineWidth = 0.7;
      for (let x = ex + 7; x < sx; x += 8) { q.beginPath(); q.moveTo(x + 1.5, far(x)); q.lineTo(x - 1, near(x)); q.stroke(); }
      q.strokeStyle = 'rgba(255,240,214,0.7)'; q.lineWidth = 1; q.beginPath(); q.moveTo(ex, near(ex) + 0.5); q.lineTo(sx, near(sx) + 0.5); q.stroke();
      // 系船桩与缆绳
      q.fillStyle = '#3e3026'; q.fillRect(ex + 2, ey - 34, 6, 38 + O3WL - 6);
      q.fillStyle = '#6a5440'; q.fillRect(ex + 1.2, ey - 36, 7.6, 3);
      q.strokeStyle = 'rgba(240,226,200,0.5)'; q.lineWidth = 1; q.beginPath(); q.moveTo(ex + 7, ey - 34); q.lineTo(ex + 7, ey + 2); q.stroke();
      q.strokeStyle = '#a89070'; q.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) { q.beginPath(); q.ellipse(ex + 5, ey - 18 + k * 3, 4.2, 1.4, 0, 0, TAU); q.stroke(); }
      q.beginPath(); q.moveTo(ex + 2, ey - 14); q.bezierCurveTo(ex - 10, ey - 2, ex - 16, ey + 10, ex - 24, ey + O3WL + 1); q.stroke();
      q.strokeStyle = 'rgba(255,255,250,0.55)'; q.lineWidth = 0.8; q.beginPath(); q.ellipse(ex + 5, ey + O3WL, 7, 1.6, 0, 0, TAU); q.stroke(); q.beginPath(); q.ellipse(ex - 24, ey + O3WL + 1, 5, 1.2, 0, 0, TAU); q.stroke();
    });
  }
  function o3Times(c) {
    const ts = ts0(c), i0 = beatI(c, ts), beats = [];
    for (let k = 0; k < 10; k++) beats.push(c.grid.time(i0 + k));
    return { ts, beats, tE: nearD(c, ts + 3.36) };
  }
  // 船：每拍往前一冲（0.25 s 缓出），越近越大、越清楚
  function o3Boat(T, t) {
    let k = 0, sur = 0;
    for (const tb of T.beats) { const a = t - tb; if (a > 0) { k += easeOut(clamp(a / 0.25)); sur = Math.max(sur, Math.exp(-a / 0.3)); } }
    const u = clamp(k / 9);
    return { x: lerp(160, 440, u), y: lerp(O3.hz + 16, O3.hz + 34, u), s: lerp(0.22, 0.45, u), a: lerp(0.4, 0.86, u), u, sur };
  }
  // 女孩缓冲的范围（脚底周围）
  const O3KB = [-150, -122, 230, 136];
  XYT.registerShot('o3_jetty', {
    name: '渡头小女孩', zone: 'left', night: false, text: '#1a2026', shadow: 'rgba(246,242,232,0.85)', accent: '#b0a4e3', bloom: 0.4,
    draw(g, c) {
      const t = c.t, T = o3Times(c), hz = O3.hz, [sx, sy] = O3.sun;
      // ---------- 天、远峰、日、水 ----------
      blitN(g, o3Far(), -40, 0, W + 80, hz + 16);
      withOp(g, 'lighter', () => glow(g, sx, sy, 110, '#f0b060', 0.1 + 0.12 * c.be(0.6)));
      E.mist(g, { t, y: hz - 60, h: 110, color: '#f4eef0', alpha: 0.42, speed: 7, seed: 21 });
      blitN(g, o3Water(), -40, hz, W + 80, H - hz + 20);
      const B = o3Boat(T, t), bob = Math.sin(t * 1.2) * 1.2;
      // 日下金色碎光：从天边铺到船前
      withOp(g, 'lighter', () => {
        const spr = XYT.sprites.tint(XYT.sprites.glow, '#ffc456');
        for (let i = 0; i < 64; i++) {
          const u = i / 56, yy = hz + 4 + Math.pow(u, 1.4) * 280, f = noise1(t * 1.7 + i * 0.9, 4);
          if (f < 0.36) continue;
          const sp = 24 + u * 150, jx = (h2(i, 3) - 0.5) * 2 * sp + Math.sin(t * 1.1 + i) * 5, len = 14 + u * 64;
          g.globalAlpha = Math.min(1, (f - 0.36) * 2.8 * (1 - u * 0.45));
          g.drawImage(spr, sx + 40 + jx - len / 2, yy - 1.5 - u * 2, len, 3 + u * 4);
        }
        g.globalAlpha = 1;
      });
      // 水面的细亮痕
      g.strokeStyle = 'rgba(255,253,246,0.5)'; g.lineCap = 'round';
      for (let grp = 0; grp < 2; grp++) {
        g.beginPath();
        for (let i = grp; i < 30; i += 2) {
          const u = Math.pow(h2(i, 51), 1.4), yy = hz + 10 + u * 270, len = (20 + h2(i, 52) * 70) * (0.4 + u * 1.5);
          const x = ((h2(i, 53) * (W + 300) - t * (4 + 8 * u)) % (W + 300) + W + 300) % (W + 300) - 150;
          g.moveTo(x, yy); g.lineTo(x + len, yy);
        }
        g.lineWidth = 0.8 + grp; g.globalAlpha = 0.55 - grp * 0.15; g.stroke();
      }
      g.globalAlpha = 1;
      // ---------- 船：从左边雾里每拍往前一冲；白发人立在船头，船夫在船尾撑篙 ----------
      {
        const bx = B.x, byy = B.y + bob, bs = B.s;
        g.save(); g.globalAlpha = B.a * 0.28; g.translate(0, 2 * (B.y + 4)); g.scale(1, -1); drawBoat(g, bx, byy, bs, 0, '#5a5654', '#4a4a50'); g.restore();
        g.save(); g.globalAlpha = B.a;
        // 船夫与篙
        const mx = bx - 112 * bs, my = byy - 12 * bs, ph = clamp(c.b.since / (c.b.period || 0.83));
        F.draw(g, 'villager', mx, my, 0.5 * bs / 0.62, t, { facing: 1, variant: 0, pose: 'stand', lean: 0.1 + 0.14 * Math.sin(ph * PI), wind: 0.3, tone: 'silhouette', ink: '#5a5856' });
        g.strokeStyle = 'rgba(70,68,66,0.9)'; g.lineWidth = Math.max(1, 2.6 * bs / 0.62); g.lineCap = 'round';
        g.beginPath(); g.moveTo(mx + 6 * bs - 30 * bs, my - 120 * bs); g.lineTo(mx - 40 * bs - 30 * bs * (1 - ph), B.y + 4); g.stroke();
        drawBoat(g, bx, byy, bs, 0, '#5a5654', '#4a4a50');
        F.draw(g, 'xiaoyao', bx + 70 * bs, byy - 10 * bs, bs * 0.95, t, { stage: 'old', pose: 'stand', facing: 1, wind: 0.4, windDir: -1, tone: 'silhouette', ink: '#5e6266', whiteHair: true });
        g.restore();
        // 船头浪：每拍一冲翻起一弯白；一圈涟漪
        const bow = bx + 150 * bs;
        g.strokeStyle = rgba('#ffffff', (0.4 + 0.5 * B.sur) * B.a); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(bow - 8 * bs, B.y + 3); g.quadraticCurveTo(bow + (10 + 18 * B.sur) * bs, B.y - 1 - 3 * B.sur, bow + (26 + 20 * B.sur) * bs, B.y + 4); g.stroke();
        for (let k = 0; k < 2; k++) { const ti = c.grid.time(c.b.i - k); if (t >= ti) E.ripples(g, { x: bow - 10 * bs, y: B.y + 5, t, t0: ti, scale: 0.4 + B.s, color: '#ffffff', alpha: 0.4 * B.a, life: 2 }); }
      }
      // 雾带分层漂移（远）：船时隐时现，船近了雾也薄了
      E.mist(g, { t, y: hz + 14, h: 70, color: '#f7f5ec', alpha: lerp(0.6, 0.38, B.u), speed: 11, seed: 23 });
      // ---------- 岛岸倒影、岛岸、渡头 ----------
      g.globalAlpha = 0.5; g.drawImage(o3IsleRefl(), O3IB.x, 528, O3IB.w, 220); g.globalAlpha = 1;
      blitN(g, o3Isle(), O3IB.x, O3IB.y, O3IB.w, O3IB.h);
      g.save(); g.globalAlpha = 0.28; g.translate(0, 2 * (O3.end[1] + O3WL)); g.scale(1, -1); g.drawImage(o3Jetty(), 800, 470, 380, 140); g.restore();
      g.drawImage(o3Jetty(), 800, 470, 380, 140);
      E.ripples(g, { x: O3.end[0] + 5, y: O3.end[1] + O3WL, t, t0: c.grid.time(c.b.i), scale: 0.55, color: '#ffffff', alpha: 0.4, life: 1.6 });
      // ---------- 小女孩：白衣、淡紫发带、桃花簪，立在渡头上望向船；身后淡淡一团紫粉的雾光 ----------
      const tE = T.tE, gust = ss(tE - 0.2, tE + 0.5, t) * (1 - 0.45 * ss(tE + 1.6, tE + 3.2, t));
      const wind = 0.35 + 0.6 * gust + 0.08 * Math.sin(t * 1.7);
      const gx = O3.gx, gy = o3DeckY(gx) - 1, gs = 0.8;
      withOp(g, 'screen', () => glow(g, gx - 8, gy - 46, 120, '#e8d6f0', 0.4));
      const look = 0.04 + 0.05 * ss(tE, tE + 0.8, t);
      const girl = { kind: 'girl', facing: -1, top: '#fbfaf8', hem: '#ece4f2', pants: '#e8e2ee', ribbon: '#a898dc', sash: '#c4b6e6', wind, windDir: -1, lean: look, ribbonLen: 1.8, ribbonW: 1.75, ribbonLift: 0.3, rimCol: '#fff0d0',
        tilt: -0.08 * ss(tE, tE + 0.8, t), reach: 0.35 * ss(tE + 0.6, tE + 1.4, t) };
      const kb = kidBuf('o3girl', gs, t, girl, O3KB), [bx0, by0, bw, bh] = O3KB;
      // 倒影：水线处翻过来，往下很快淡掉，切成几条随波错开
      {
        const wl = o3DeckY(gx) + O3WL, rows = 7, rh = 54 / rows, S = SC();
        for (let i = 0; i < rows; i++) {
          const yA = (by0 + bh) - (i + 1) * rh, dx = Math.sin(t * 2.2 + i * 1.3) * (0.6 + i * 0.5);
          g.globalAlpha = 0.24 * (1 - i / rows);
          g.save(); g.translate(gx + bx0 + dx, 2 * wl - gy - (by0 + bh) + i * rh); g.scale(1, -1);
          g.drawImage(kb, 0, (yA - by0) * S, kb.width, rh * S, 0, -rh, bw, rh);
          g.restore();
        }
        g.globalAlpha = 1;
      }
      // 轮廓光：先画一层淡金紫的剪影往日那边错开一点，再画本身
      const rb = tintBuf('o3girlR', kb, '#f6e2c4');
      g.globalAlpha = 0.9; g.drawImage(rb, gx + bx0 - 1.6, gy + by0 - 0.6, bw, bh); g.globalAlpha = 1;
      g.drawImage(kb, gx + bx0, gy + by0, bw, bh);
      // ---------- 白鹭：立在桩头；强拍起飞，先陡升向左上，再滑向船 ----------
      const ex = O3.end[0] + 5, ey = O3.end[1] - 36, fage = t - tE;
      if (fage < 0) egret(g, ex, ey, 0.8, -1, fage > -0.35 ? ((fage + 0.35) / 0.35) * 0.49 : 0, 0);
      else {
        const k1 = clamp(fage / 0.4), p1 = [ex - 26, ey - 70];
        let px, py, sc;
        if (fage < 0.4) { px = lerp(ex, p1[0], easeOut(k1)); py = lerp(ey, p1[1], easeOut(k1)); sc = 0.8; }
        else {
          const u = clamp((fage - 0.4) / 2.6), tx = B.x + 40, ty = B.y - 60, cx = lerp(p1[0], tx, 0.4), cy = p1[1] - 30;
          const v = easeInOut(u);
          px = (1 - v) * (1 - v) * p1[0] + 2 * (1 - v) * v * cx + v * v * tx; py = (1 - v) * (1 - v) * p1[1] + 2 * (1 - v) * v * cy + v * v * ty; sc = lerp(0.8, 0.42, v);
        }
        const flap = fage < 0.4 ? fage * TAU * 3.2 : fage * TAU * 1.4 + 1.2;
        g.globalAlpha = 1 - 0.4 * clamp((fage - 1.5) / 1.5); egret(g, px, py, sc, -1, 1, flap); g.globalAlpha = 1;
        if (fage < 0.6) for (let i = 0; i < 6; i++) { const a = h2(i, 81) * TAU, d = fage * 40 * (0.5 + h2(i, 82)); g.fillStyle = rgba('#ffffff', 0.7 * (1 - fage / 0.6)); g.beginPath(); g.ellipse(ex + Math.cos(a) * d, ey + 10 + Math.sin(a) * d * 0.4, 2.2, 0.9, a, 0, TAU); g.fill(); }
      }
      // ---------- 右侧近景的大桃树（框住画面右边） ----------
      {
        const TF = treeGeo(O3TF.seed, O3TF), sw = Math.sin(t * 0.9) * 0.008 + gust * 0.012 * Math.sin(t * 2.4);
        drawTree(g, TF, 1236, 578, 1.0, t, { bloomAt: -1e9, sway: sw, nn: true, ink: '#2e2420' });
        petalGust(g, TF, 1236, 578, 1.0, t, tE - 0.6, { n: 40, seed: 13, dir: -1, size: 13, spread: 5, life: 5.5 });
      }
      // ---------- 近处的雾与花瓣、日影几束 ----------
      E.mist(g, { t, y: 600, h: 150, color: '#f6f4ec', alpha: 0.28, speed: -14, seed: 25 });
      V.petals(g, c, { kind: 'peach', n: 24, seed: 61, wind: -40 - 30 * gust, fall: 20, gust: 26, size: [7, 22], area: [300, 200, W + 60, H] });
      V.godRays(g, c, { x: sx, y: sy, angle: 0.55, spread: 0.32, n: 3, len: 760, width: 1.2, start: 0.1, color: '#fff2d0', alpha: 0.3, blend: 'screen', beat: 0.4, res: 0.08, seed: 33, source: false, motes: 10, moteColor: '#fffbe8' });
    },
  });

  // ======================================================================
  // o4_seal 落款钤印：上一幅画在墨晕里褪成水墨，强拍上整幅画收拢成一滴墨、退回纸面，留下一枝淡墨折枝；
  // 那滴墨就是“逍”字的第一点，“逍遥叹”自上而下逐字写出；5:12.3 钤一方残缺朱印“不见不散”，纸面一震；一片桃瓣落在印旁
  // ======================================================================
  const O4 = { tx: 1012, ty0: 212, step: 112, size: 104, seal: [944, 552], sealS: 76 };
  O4.drop = [O4.tx - 30, O4.ty0 - 35];
  // 宣纸：暖白、云状浓淡、长短纤维、细碎杂质、四边略深
  function o4Paper() {
    return K.cache('g14o4paper', W + 80, H + 80, 1, (q) => {
      q.translate(40, 40);
      q.fillStyle = '#f2ecde'; q.fillRect(-40, -40, W + 80, H + 80);
      const r = rng(2026);
      for (let i = 0; i < 60; i++) A.softBlob(q, r() * W, r() * H, 70 + r() * 170, 0.04 + r() * 0.03, r() < 0.5 ? '#ddd0b4' : '#ffffff');
      q.lineCap = 'round';
      for (let i = 0; i < 1000; i++) {
        const x = r() * (W + 60) - 30, y = r() * (H + 60) - 30, a = r() * TAU, l = 6 + r() * 44;
        q.strokeStyle = `rgba(${r() < 0.5 ? '140,120,90' : '255,255,255'},${0.05 + r() * 0.09})`; q.lineWidth = 0.4 + r() * 0.8;
        q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); q.stroke();
      }
      for (let i = 0; i < 240; i++) { q.fillStyle = `rgba(90,70,50,${0.05 + r() * 0.12})`; q.beginPath(); q.arc(r() * W, r() * H, 0.4 + r() * 1.1, 0, TAU); q.fill(); }
      const gr = q.createRadialGradient(W / 2, H / 2, 280, W / 2, H / 2, 840);
      gr.addColorStop(0, 'rgba(120,96,60,0)'); gr.addColorStop(1, 'rgba(120,96,60,0.24)');
      q.fillStyle = gr; q.fillRect(-40, -40, W + 80, H + 80);
    });
  }
  // 纸纹颗粒：每秒换 12 次（只有细暗点，画在墨与字之下）
  function o4Grain(g, t, a) {
    const k = Math.floor(t * 12);
    g.fillStyle = `rgba(70,56,36,${0.16 * a})`;
    for (let i = 0; i < 200; i++) { const sz = 0.7 + h2(i, k * 3 + 1) * 1.2; g.fillRect(h2(i, k * 3) * W, h2(i, k * 3 + 2) * H, sz, sz); }
  }
  function o4Char(ch, size, blur) {
    const fk = fontKey(ch);
    return K.cache('g14o4ch|' + ch + size + (blur || 0) + fk, size * 1.6, size * 1.6, 1, (q) => {
      if (blur && 'filter' in q) q.filter = `blur(${(blur * SC()).toFixed(2)}px)`;
      q.fillStyle = '#1a2026'; q.font = `${size}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillText(ch, size * 0.8, size * 0.8);
      if (blur) q.filter = 'none';
    });
  }
  // 残缺朱印（白文四字，二二排，右起竖读“不见不散”）：一角崩掉、边上一圈小缺口、印泥不匀、轻微重影
  function o4Seal(size) {
    const text = '不见不散', fk = fontKey(text);
    return K.cache('g14o4seal2|' + size + fk, size * 1.3, size * 1.3, 1.6, (q) => {
      const c0 = size * 0.65, r = rng(1512), hs = size / 2;
      q.translate(c0, c0);
      const body = (dx, dy) => {
        q.beginPath();
        const n = 44;
        for (let i = 0; i <= n; i++) {
          const u = i / n, side = Math.min(3, Math.floor(u * 4)), f = u * 4 - side;
          const P = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
          const [ax, ay] = P[side], [bx, by] = P[side + 1], j = (r() - 0.5) * size * 0.025;
          q.lineTo((ax + (bx - ax) * f) * hs + j + dx, (ay + (by - ay) * f) * hs + j + dy);
        }
        q.closePath();
      };
      // 重影：错开 2 像素淡淡一层
      q.globalAlpha = 0.2; q.fillStyle = '#c3202f'; body(2.2, 1.6); q.fill(); q.globalAlpha = 1;
      body(0, 0); q.fill();
      q.globalCompositeOperation = 'destination-out';
      // 白文：字比原先大，再描一圈 1 像素把笔画加粗
      q.font = `${size * 0.46}px ${XYT.FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.lineWidth = 1; q.strokeStyle = '#000'; q.lineJoin = 'round';
      const ch = Array.from(text), d = size * 0.225;
      for (const [k, x, y] of [[0, d, -d], [1, d, d], [2, -d, -d], [3, -d, d]]) { q.fillText(ch[k], x, y + 1); q.strokeText(ch[k], x, y + 1); }
      q.lineWidth = size * 0.03; q.strokeRect(-size * 0.44, -size * 0.44, size * 0.88, size * 0.88);
      // 右上角崩掉一块（约一成半）
      q.beginPath(); q.moveTo(hs * 0.52, -hs - 3); q.lineTo(hs + 3, -hs - 3); q.lineTo(hs + 3, -hs * 0.46); q.quadraticCurveTo(hs * 0.82, -hs * 0.62, hs * 0.74, -hs * 0.76); q.quadraticCurveTo(hs * 0.6, -hs * 0.8, hs * 0.52, -hs - 3); q.closePath(); q.fill();
      // 边上一圈 2–4 像素的小缺口
      for (let i = 0; i < 22; i++) {
        const side = i % 4, u = r() * 2 - 1, w = 1 + r() * 1.6, dep = 1 + r() * 2;
        const [x, y] = side === 0 ? [u * hs, -hs] : side === 1 ? [hs, u * hs] : side === 2 ? [u * hs, hs] : [-hs, u * hs];
        q.beginPath(); q.ellipse(x, y, side % 2 ? dep : w, side % 2 ? w : dep, 0, 0, TAU); q.fill();
      }
      // 印泥不匀：几团淡淡的缺墨
      for (let i = 0; i < 8; i++) { q.globalAlpha = 0.15 + 0.2 * r(); A.softBlob(q, (r() - 0.5) * size * 0.9, (r() - 0.5) * size * 0.9, size * (0.08 + 0.1 * r()), 1, '#000000'); }
      q.globalAlpha = 1;
      for (let i = 0; i < 70; i++) { q.globalAlpha = 0.25 + r() * 0.6; q.beginPath(); q.arc((r() - 0.5) * size, (r() - 0.5) * size, 0.4 + r() * 1.2, 0, TAU); q.fill(); }
      q.globalAlpha = 1;
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 印泥洇开的那一圈：同一方印糊开、略大
  function o4SealBleed(size) {
    const img = o4Seal(size);
    return K.cache('g14o4sealb|' + size, size * 1.3, size * 1.3, 0.8, (q) => {
      if ('filter' in q) q.filter = `blur(${(2.5 * 0.8 * SC()).toFixed(2)}px)`;
      const k = 1.08, w = size * 1.3;
      q.drawImage(img, (w - w * k) / 2, (w - w * k) / 2, w * k, w * k);
      q.filter = 'none';
    });
  }
  // 左下角一枝淡墨桃花折枝：主枝一笔、两根小枝、三点粉
  function o4Sprig() {
    return K.cache('g14o4sprig', 460, 300, 1.5, (q) => {
      q.lineCap = 'round';
      const r = rng(77);
      const stroke = (pts, w0, w1, a) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const u = i / (pts.length - 1);
          q.strokeStyle = `rgba(56,66,74,${a * (1 - 0.3 * u)})`; q.lineWidth = lerp(w0, w1, u);
          q.beginPath(); q.moveTo(pts[i][0], pts[i][1]); q.lineTo(pts[i + 1][0], pts[i + 1][1]); q.stroke();
        }
      };
      const main = spline([[10, 290], [90, 236], [170, 206], [262, 150], [330, 128], [410, 70]], 6);
      stroke(main, 7, 1.6, 0.5);
      stroke(spline([[170, 206], [196, 168], [236, 140], [252, 104]], 5), 3.4, 1, 0.42);
      stroke(spline([[262, 150], [300, 170], [344, 176]], 5), 2.6, 0.8, 0.4);
      // 干笔飞白
      q.strokeStyle = 'rgba(242,236,222,0.7)'; q.lineWidth = 1;
      for (let i = 0; i < 12; i++) { const p = main[Math.floor(r() * (main.length - 2))]; q.beginPath(); q.moveTo(p[0] - 4, p[1] + 1); q.lineTo(p[0] + 8, p[1] - 3); q.stroke(); }
      // 节上苔点
      q.fillStyle = 'rgba(40,48,54,0.55)';
      for (const [x, y] of [[92, 232], [174, 200], [266, 146], [334, 124]]) { q.beginPath(); q.ellipse(x, y - 3, 2.4, 1.6, 0.4, 0, TAU); q.fill(); }
      // 三朵淡粉（水色晕开）与两个花苞
      for (const [x, y, s] of [[252, 98, 1], [346, 172, 0.8], [412, 64, 0.9]]) {
        for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.3; A.softBlob(q, x + Math.cos(a) * 7 * s, y + Math.sin(a) * 7 * s, 9 * s, 0.5, '#eba6b8'); }
        A.softBlob(q, x, y, 6 * s, 0.6, '#d97890');
        q.fillStyle = 'rgba(200,150,60,0.8)'; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; q.beginPath(); q.arc(x + Math.cos(a) * 3.4 * s, y + Math.sin(a) * 3.4 * s, 0.9, 0, TAU); q.fill(); }
      }
      for (const [x, y] of [[198, 164], [304, 168]]) { A.softBlob(q, x, y, 5, 0.7, '#d98ca0'); }
    });
  }
  function o4Times(c) {
    const ts = ts0(c);
    return { ts, tC: nearB(c, ts + 0.82), tS: nearB(c, ts + 1.66) };
  }
  // 上一镜（渡头）的时间与镜头运动：从时间线取，取不到就按分镜的长度推
  function o4Prev(c) {
    let st = null;
    try { st = XYT.api && XYT.api.state && XYT.api.state().tl; } catch (e) { st = null; }
    const segs = st && st.segments, cur = c.seg;
    const prev = segs && cur && cur.idx > 0 ? segs[cur.idx - 1] : null;
    if (prev && prev.scene === 'o3_jetty') return { start: prev.start, dur: prev.end - prev.start, seg: prev };
    const ts = ts0(c);
    return { start: ts - 6.69, dur: 6.69, seg: null };
  }
  // 上一镜在本镜起点那一刻的水墨版：定格成一张贴图（按那一刻的拍点重建上下文，与何时建图无关）
  function o4InkStill(c, P) {
    const Tf = ts0(c), key = 'g14o4still|' + Tf.toFixed(3) + '|' + P.start.toFixed(3);
    return K.cache(key, W, H, 1, (q) => {
      const b = c.grid.info ? c.grid.info(Tf) : c.b;
      const cF = { t: Tf, lt: Tf - P.start, dur: P.dur, p: clamp((Tf - P.start) / P.dur), b, grid: c.grid, inten: 0.5, rms: 0.3, onset: 0, low: 0.3, high: 0.3, variant: 0, seed: 0,
        be: (d) => Math.exp(-Math.max(0, b.since) / d) * (0.4 + 0.6 * b.str), de: (d) => Math.exp(-Math.max(0, b.sinceDown) / d), charT: () => null, line: null, seg: P.seg || c.seg };
      if (P.seg) { const [z3, d3] = camOf(P.seg, Tf, cF); q.translate(W / 2 + d3, H / 2); q.scale(z3, z3); q.translate(-W / 2, -H / 2); }
      q.fillStyle = '#f2ecde'; q.fillRect(-20, -20, W + 40, H + 40);
      XYT.scenes.o3_jetty.draw(q, cF);
      q.setTransform(1, 0, 0, 1, 0, 0); q.globalAlpha = 1;
      q.globalCompositeOperation = 'color'; q.fillStyle = '#d8d0c2'; q.fillRect(0, 0, q.canvas.width, q.canvas.height);
      q.globalCompositeOperation = 'source-over';
    });
  }
  // 引擎的推拉：z、dx（与 render.js 的 drawScene 一致），用来让墨版与上一镜对齐
  const camOf = (seg, t, c) => {
    const p = clamp((t - seg.start) / Math.max(0.1, seg.end - seg.start)), dir = seg.idx % 2 ? 1 : -1;
    return [1.02 + 0.05 * p + (0.012 * c.be(0.18) + 0.02 * c.de(0.28)) * (0.5 + (seg.intensity ?? 0.6)), dir * 14 * (p - 0.5)];
  };
  // 把上一镜画成水墨（去色、压上纸色、加深），clip 由调用者先设好
  function o4InkScene(g, c, P, darken) {
    const sc = XYT.scenes.o3_jetty;
    if (!sc) return;
    const c3 = Object.assign({}, c, { lt: c.t - P.start, dur: P.dur, p: clamp((c.t - P.start) / P.dur), seg: P.seg || c.seg, line: null, charT: () => null });
    g.save();
    if (P.seg && c.seg) {
      const [z4, d4] = camOf(c.seg, c.t, c), [z3, d3] = camOf(P.seg, c.t, c);
      g.translate(W / 2, H / 2); g.scale(1 / z4, 1 / z4); g.translate(d3 - d4, 0); g.scale(z3, z3); g.translate(-W / 2, -H / 2);
    }
    sc.draw(g, c3);
    g.restore();
    // 一遍“颜色”混合：保留明暗、换成纸的色相（水墨）；收拢时再压深
    const cw = g.canvas.width, ch = g.canvas.height;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'color'; g.fillStyle = '#d8d0c2'; g.fillRect(0, 0, cw, ch);
    if (darken > 0.02) { g.globalCompositeOperation = 'multiply'; g.fillStyle = mix('#ffffff', '#4a4e54', darken); g.fillRect(0, 0, cw, ch); }
    g.restore();
  }
  XYT.registerShot('o4_seal', {
    name: '落款钤印', zone: 'right', night: false, text: '#1a2026', shadow: 'rgba(242,236,222,0.85)', accent: '#c91f37', bloom: 0.1,
    draw(g, c) {
      const t = c.t, lt = c.lt, T = o4Times(c), sinceS = t - T.tS, [dx0, dy0] = O4.drop;
      const shake = sinceS > 0 ? 4 * Math.exp(-sinceS / 0.09) * Math.sin(sinceS * 90) : 0;
      g.save(); g.translate(shake * 0.4, shake);
      const pre = lt < 0;
      if (!pre) { blitN(g, o4Paper(), -40, -40, W + 80, H + 80); o4Grain(g, t, 0.5); }
      // 洒金：随拍一闪
      const be = c.be(0.4);
      if (!pre) for (let i = 0; i < 40; i++) {
        const x = h2(i, 91) * W, y = h2(i, 92) * H, sz = 0.8 + h2(i, 93) * 2;
        const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (0.8 + h2(i, 94)) + i), 4) + (h2(i, 96) < 0.3 ? be : 0);
        g.fillStyle = rgba(tw > 0.6 ? '#e8c76e' : '#bf9a4c', 0.4 + 0.35 * Math.min(1, tw));
        g.save(); g.translate(x, y); g.rotate(h2(i, 95) * TAU); g.fillRect(-sz, -sz * 0.6, sz * 2, sz * 1.2); g.restore();
      }
      // 淡墨折枝：墨收走时留在纸上
      const spA = ss(0.25, 0.95, lt);
      if (spA > 0) { g.globalAlpha = spA; g.drawImage(o4Sprig(), 30, 400, 460, 300); g.globalAlpha = 1; }
      // ---------- 上一幅画褪成水墨，再整幅收拢成一滴 ----------
      const GU = 0.85, gu = clamp(lt / GU);
      // 收墨的边：圆润不规则（大半径时也是平滑曲线，不出折角）
      const blob = (x, y, R, sd) => {
        const n = 96, pts = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, rr = R * (1 + 0.16 * (noise1(a * 1.3 + sd, sd) - 0.5) * 2 + 0.05 * (noise1(a * 5 + sd, sd + 1) - 0.5) * 2) + Math.min(6, R * 0.2) * (noise1(a * 23 + sd, sd + 2) - 0.5);
          pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
        }
        g.beginPath(); g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
        for (let i = 0; i < n; i++) { const p = pts[i], q2 = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2); }
        g.closePath();
      };
      const drainAt = (k) => [12 + 1100 * Math.pow(1 - k, 1.6), lerp(640, dx0, Math.pow(k, 0.8)), lerp(360, dy0, Math.pow(k, 0.8))];
      const gs2 = smooth(gu);
      // 墨退过的地方留下几圈淡淡的水痕
      for (const kj of [0.3, 0.55, 0.78]) {
        if (gs2 < kj) continue;
        const [Rj, xj, yj] = drainAt(kj);
        g.strokeStyle = rgba('#50616d', 0.07 * (1 - ss(1.3, 2.4, lt))); g.lineWidth = 1.3; blob(xj, yj, Rj, 5); g.stroke();
      }
      if (lt < GU) {
        // 画不动，墨从四周往那一滴退：湿边一圈浓墨、外面一层洇开的淡墨，里面到最后才浓起来
        const P = o4Prev(c), [R, cx, cy] = drainAt(gs2);
        g.save();
        if (lt < 0) o4InkScene(g, c, P, 0);
        else {
          // 定格的墨画贴在屏幕坐标（抵掉本镜的推拉），只在收墨的范围里
          blob(cx, cy, R, 5); g.clip();
          const img = o4InkStill(c, P);
          g.save();
          if (c.seg) { const [z4, d4] = camOf(c.seg, t, c); g.translate(W / 2, H / 2); g.scale(1 / z4, 1 / z4); g.translate(-W / 2 - d4, -H / 2); }
          blitN(g, img, 0, 0, W, H);
          g.restore();
          const dk = 0.88 * ss(0.4, 1, gs2);
          if (dk > 0.02) { g.globalCompositeOperation = 'multiply'; g.fillStyle = mix('#ffffff', '#4a4e54', dk); g.fillRect(-20, -20, W + 40, H + 40); g.globalCompositeOperation = 'source-over'; }
        }
        g.restore();
        if (lt > 0) {
          blob(cx, cy, R, 5);
          g.strokeStyle = rgba('#5a6066', 0.05); g.lineWidth = 18; g.stroke();
          g.strokeStyle = rgba('#3a4046', 0.1); g.lineWidth = 8; g.stroke();
          g.strokeStyle = rgba('#1d2228', 0.5); g.lineWidth = 2.6; g.stroke();
        }
      }
      // 那一滴：落在“逍”字走之的第一点，字写出来时墨被吸进去
      const tC = T.tC, dotA = ss(GU - 0.15, GU, lt) * (1 - ss(tC + 0.02, tC + 0.14, t));
      if (dotA > 0.01) { g.fillStyle = rgba('#141a20', 0.92 * dotA); A.inkBlob(g, dx0, dy0, 9 + 3 * Math.sin(lt * 9) * (1 - dotA), 3, 0.25); g.fill(); }
      // ---------- 竖排题字“逍遥叹”：每字 0.27 s 自上而下写出，前沿带一点湿晕 ----------
      ['逍', '遥', '叹'].forEach((ch, k) => {
        const age = t - (tC + k * 0.27);
        if (age <= 0) return;
        const cy = O4.ty0 + k * O4.step, cx = O4.tx, sz = O4.size, w = sz * 1.6, pr = clamp(age / 0.27);
        const top = cy - w / 2 + w * 0.12, span = w * 0.76, yr = top + span * easeInOut(pr);
        g.save(); g.beginPath(); g.rect(cx - w / 2, cy - w / 2, w, yr - (cy - w / 2) + 6); g.clip();
        g.globalAlpha = 0.45 * (1 - 0.7 * ss(0.2, 1.2, age)); g.drawImage(o4Char(ch, sz, 6), cx - w / 2 - 2, cy - w / 2 - 2, w + 4, w + 4);
        g.restore();
        g.save(); g.beginPath(); g.rect(cx - w / 2, cy - w / 2, w, yr - (cy - w / 2)); g.clip();
        g.globalAlpha = 1; g.drawImage(o4Char(ch, sz, 0), cx - w / 2, cy - w / 2, w, w);
        g.restore();
      });
      // 落款小字：乙酉年春（题字左下）
      const la = ss(tC + 0.75, tC + 1.2, t);
      if (la > 0) {
        g.globalAlpha = 0.85 * la; g.fillStyle = '#3a4148'; g.font = `20px ${XYT.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        Array.from('乙酉年春').forEach((ch, i) => g.fillText(ch, O4.tx - 82, O4.ty0 + 150 + i * 24));
        g.globalAlpha = 1;
      }
      // ---------- 朱印：按下前先压出一片影子，落下一震，印泥往外洇开一点 ----------
      const [sx, sy] = O4.seal, S0 = O4.sealS;
      if (sinceS > -0.14 && sinceS < 0) {
        const k = 1 - (-sinceS / 0.14), s2 = lerp(1.3, 1.02, easeIn(k));
        // 软边的压影：三层由小到大、由浓到淡
        for (const [f, a] of [[1, 0.07], [1.1, 0.05], [1.22, 0.035]]) { const w = S0 * s2 * f; g.fillStyle = rgba('#2a1a14', a * k * 1.4); g.fillRect(sx - w / 2, sy - w / 2 + 3, w, w); }
      }
      if (sinceS > 0) {
        const q = easeOut(clamp(sinceS / 0.1)), sc = lerp(1.05, 1, q), img = o4Seal(S0), bl = o4SealBleed(S0);
        g.save(); g.translate(sx, sy); g.rotate(-0.04);
        g.globalAlpha = 0.28 * ss(0.05, 0.45, sinceS); g.drawImage(bl, -bl.lw / 2, -bl.lh / 2, bl.lw, bl.lh);
        g.scale(sc, sc); g.globalAlpha = 0.95;
        g.drawImage(img, -img.lw / 2, -img.lh / 2, img.lw, img.lh);
        g.restore(); g.globalAlpha = 1;
        if (sinceS < 0.6) for (let i = 0; i < 8; i++) {
          const a = h2(i, 71) * TAU, d = 50 + sinceS * 60 * h2(i, 72);
          g.fillStyle = rgba('#c3202f', 0.5 * (1 - sinceS / 0.6)); g.beginPath(); g.arc(sx + Math.cos(a) * d, sy + Math.sin(a) * d, 1 + h2(i, 73), 0, TAU); g.fill();
        }
      }
      // ---------- 一片桃瓣从左上飘下，平平落在印的左下角 ----------
      {
        const T0 = T.ts - 0.6, Tl = T.tS + 0.7, u = clamp((t - T0) / (Tl - T0)), lx = sx - S0 / 2 - 8, ly = sy + S0 / 2 + 4;
        const x = lerp(560, lx, easeInOut(u)) + Math.sin(u * 7) * 40 * (1 - u), y = lerp(-30, ly, u) + Math.sin(u * 11) * 6 * (1 - u);
        const landed = u >= 1, rot = landed ? 0.6 : u * 5 + Math.sin(u * 9) * 0.6, fx = landed ? 1 : Math.cos(u * 14) * (1 - u) + u, sz = lerp(30, 36, u);
        g.save(); g.translate(x, y); g.rotate(rot);
        if (landed) { g.fillStyle = 'rgba(110,70,50,0.14)'; g.beginPath(); g.ellipse(2, 3, sz * 0.36, sz * 0.24, 0, 0, TAU); g.fill(); }
        g.scale(Math.max(0.3, Math.abs(fx)) * (fx < 0 ? -1 : 1), landed ? 0.86 : 1);
        g.drawImage(petalImg(0), -sz / 2, -sz / 2, sz, sz);
        if (landed) { g.strokeStyle = 'rgba(190,80,110,0.4)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, sz * 0.32); g.quadraticCurveTo(-1, 0, 0, -sz * 0.3); g.stroke(); }
        g.restore();
      }
      g.restore();
      // 淡出：完整的落款停到最后，才缓缓沉入黑
      const fo = easeIn(clamp((lt - (c.dur - 0.45)) / 0.43));
      if (fo > 0) { g.fillStyle = `rgba(8,8,10,${fo})`; g.fillRect(-20, -20, W + 40, H + 40); }
    },
  });
})();
