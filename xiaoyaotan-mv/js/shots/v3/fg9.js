/* 第三版镜头组 fg9：f8_redplain。不含歌词。 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, h2, rgba, mix, noise1 } = A;
  // 第 off 句第 k 字的时间（相对镜头起点）；没有歌词时用分镜表的秒数
  const CT = (c, k, def, off) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? def : v - (c.t - c.lt);
  };
  // 镜头内的拍点（相对镜头起点）
  const beatsIn = (c, t0, t1) => {
    const out = [], s = c.t - c.lt, gr = c.grid;
    if (!gr || !gr.idx) return out;
    for (let i = gr.idx(s + t0) - 1; i <= gr.idx(s + t1) + 1; i++) {
      const bt = gr.time(i) - s;
      if (bt >= t0 && bt <= t1) out.push(bt);
    }
    return out;
  };
  // 建缓存时：先画到临时画布，再带模糊合成进缓存（ctx.filter 只在这里用）
  function blurInto(g, w, h, blur, fn, alpha) {
    const t = document.createElement('canvas');
    const sc = g.getTransform().a;
    t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc));
    const tg = t.getContext('2d'); tg.setTransform(g.getTransform());
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, 0, 0);
    g.restore();
  }
  // 给缓存加 ±amp 级的细噪点，打散大面积渐变的色带（只在建缓存时）
  function dither(g, amp) {
    const cv = g.canvas, w = cv.width, h = cv.height;
    const id = g.getImageData(0, 0, w, h), d = id.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      s = (Math.imul(s, 1103515245) + 12345) | 0;
      const n = (((s >>> 16) & 1023) / 1023 - 0.5) * 2 * amp;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(id, 0, 0);
  }
  // 仿射矩阵 [a, b, c, d, e, f]：p∘q（先 q 后 p）、绕点旋转、作用到点
  const mul = (p, q) => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
    p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
  const rotAbout = (th, x, y) => { const c = Math.cos(th), s = Math.sin(th); return [c, s, -s, c, x - c * x + s * y, y - s * x - c * y]; };
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  // 把局部矩阵接到画布的基准变换 B 上
  const setT = (g, B, m) => g.setTransform(
    B.a * m[0] + B.c * m[1], B.b * m[0] + B.d * m[1],
    B.a * m[2] + B.c * m[3], B.b * m[2] + B.d * m[3],
    B.a * m[4] + B.c * m[5] + B.e, B.b * m[4] + B.d * m[5] + B.f);
  // 局部矩阵：平移 (x, y)、旋转 a、缩放 (sx, sy)
  const trs = (x, y, a, sx, sy) => { const c = Math.cos(a), s = Math.sin(a); return [c * sx, s * sx, -s * sy, c * sy, x, y]; };
  const fmod = (v, m) => ((v % m) + m) % m;

  // ============================================================
  // f8_redplain：阴天黄昏的雪原，孤梅覆雪；阵风一次次摇落积雪，满树红梅显露，红瓣与雪向左漫天飞舞
  // ============================================================
  (function () {
    const HOR = 470, FH = 1160;                      // 地平线；焦距×机位高（人高 1.7 米 = 220 像素，机位约 1.16 米）
    const gyZ = (z) => HOR + FH / z;                 // 景深 z 米处地面的屏幕 y
    const MAN = { x: 760, y: 620, h: 220 };
    const ZMAN = FH / (MAN.y - HOR);                 // 约 7.7 米
    const ZTREE = FH / (606 - HOR);                  // 树根 y≈606，约 8.5 米
    const CAM = [600, 455];
    const GX = 590, GV = 2200;                       // 阵风前沿：x=GX 处正好在唱到的字上，向左每秒 2200 像素
    const GRAV = 1100, VTC = 520;                    // 树的景深处重力加速度（像素/秒²）、雪团终速
    const SPR = 1.0;                                 // 枝条贴图的采样倍率
    let PBUF = null;                                 // 雪粉暂存画布（每帧清空重画）
    const dl = (x) => (GX - x) / GV;                 // 阵风到达 x 处相对唱字的延迟

    // ---------------- 树：主枝手工定形，侧枝、新枝、花、积雪程序生成 ----------------
    const TRUNK = [[419, 618, 76], [414, 606, 58], [406, 584, 47], [401, 560, 42], [403, 536, 40], [411, 514, 38], [421, 494, 35], [430, 476, 31], [433, 464, 27]];
    const LIMBS = [
      { pts: [[424, 474, 19], [392, 455, 16], [356, 433, 13.5], [322, 426, 11.5], [290, 400, 9.5], [262, 375, 7.5], [232, 362, 5.5], [207, 344, 3]], cut: 4, f: [1.15, 1.9] },
      { pts: [[421, 466, 17], [409, 424, 14.5], [385, 392, 12.5], [379, 350, 10.5], [353, 310, 8.5], [345, 272, 6.5], [319, 240, 4.5], [307, 214, 2.6]], cut: 4, f: [1.25, 2.0] },
      { pts: [[433, 464, 15], [453, 422, 13.5], [447, 384, 11.5], [467, 344, 9.5], [459, 304, 7.5], [479, 266, 5.5], [475, 230, 3.8], [489, 204, 2.3]], cut: 4, f: [1.3, 2.1] },
      { pts: [[437, 476, 18], [477, 459, 16], [521, 449, 13.5], [561, 424, 11.5], [605, 414, 9.5], [641, 388, 7.5], [685, 376, 5.8], [717, 357, 4.2], [748, 349, 2.8]], cut: 4, f: [1.05, 1.7] },
      { pts: [[523, 448, 9.5], [541, 408, 8.5], [573, 382, 7.5], [589, 344, 6.2], [623, 316, 5], [641, 284, 3.8], [671, 266, 2.5]], cut: 3, f: [1.6, 2.3], from: 3 },
    ];
    const EARLY = [ // 第1句第4–7字：小团雪滑落的位置（目标点）与对应的字序
      { k: 3, def: 1.364, x: 662, y: 378 },
      { k: 4, def: 1.924, x: 356, y: 300 },
      { k: 5, def: 2.244, x: 468, y: 266 },
      { k: 6, def: 2.544, x: 268, y: 368 },
      { k: 6, def: 2.544, x: 618, y: 300, lag: 0.12 },
    ];
    const TREE = (() => {
      const r = A.rng(80817);
      const G = [];
      const grp = (o) => { Object.assign(o, { id: G.length, segs: [], blos: [], clumps: [], kids: [] }); G.push(o); if (o.parent >= 0) G[o.parent].kids.push(o.id); return o; };
      const topY = (x) => 194 + 0.00052 * (x - 470) * (x - 470);
      const inside = (x, y) => x > 198 && x < 764 && y > topY(x) && y < 476 && !(x > 694 && y > 360) && !(x < 340 && y > 438);
      const gnarl = (pts, amp) => {
        const out = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i];
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), k = (r() - 0.5) * 2 * amp;
          out.push([(x0 + x1) / 2 - dy / L * k, (y0 + y1) / 2 + dx / L * k, (w0 + w1) / 2]);
          out.push(pts[i]);
        }
        return out;
      };
      const walk = (pts, step, fn) => {
        let acc = step * (0.3 + 0.7 * r());
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i];
          const L = Math.hypot(x1 - x0, y1 - y0);
          if (L < 1e-3) continue;
          const a = Math.atan2(y1 - y0, x1 - x0);
          let s = acc;
          while (s < L) { const u = s / L; fn(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, a, w0 + (w1 - w0) * u); s += step; }
          acc = s - L;
        }
      };
      // 新枝：一年生的直条，大多朝上
      const shoot = (gp, x, y, a, len, w, dp) => {
        const pts = [[x, y, w]];
        for (let s = 1; s <= 2; s++) {
          a += (r() - 0.5) * 0.22;
          const nx = x + Math.cos(a) * len / 2, ny = y + Math.sin(a) * len / 2;
          if (!inside(nx, ny)) break;
          x = nx; y = ny; pts.push([x, y, Math.max(0.75, w * (1 - 0.45 * s / 2))]);
        }
        if (pts.length > 1) gp.segs.push({ pts, lvl: 2, drop: !!dp });
      };
      // 侧枝：转折硬朗（梅枝如铁），末端发新枝
      const branch = (gp, x, y, a, len, w, lvl, dp) => {
        const pts = [[x, y, w]];
        const n = 2 + (r() * 3 | 0);
        for (let s = 1; s <= n; s++) {
          const L = len / n * (0.7 + 0.6 * r());
          a += (r() - 0.5) * 0.9;
          a += (-Math.PI / 2 - a) * 0.1;
          const nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
          if (!inside(nx, ny)) break;
          x = nx; y = ny;
          pts.push([x, y, Math.max(1.0, w * (1 - 0.7 * s / n))]);
        }
        if (pts.length < 2) return;
        // 细而平的长枝（没有花、像一道杂线）不画；它的子枝也不画（随机序列照常消耗，树形不变）
        const ov = Math.atan2(y - pts[0][1], x - pts[0][0]), drop = !!dp || (w <= 1.5 && Math.abs(Math.sin(ov)) < 0.45);
        gp.segs.push({ pts, lvl, drop });
        walk(pts, 10, (px, py, pa, pw) => {
          if (r() > 0.6) return;
          const side = r() < 0.5 ? -1 : 1;
          const ta = -Math.PI / 2 + side * (0.18 + 0.5 * r()) + (pa + Math.PI / 2) * 0.2;
          if (lvl === 1 && pw > 2.4 && r() < 0.22) branch(gp, px, py, ta, 26 + 26 * r(), pw * 0.6, 1.5, drop);
          else shoot(gp, px, py, ta, 14 + 32 * r(), Math.min(1.5, pw * 0.7), drop);
        });
      };
      for (const L of LIMBS) {
        const parent = L.from != null ? LIMBS[L.from].gi : -1;
        const pts = gnarl(L.pts, 4);
        const cut = L.cut * 2;
        const inner = pts.slice(0, cut + 1), outer = pts.slice(cut);
        const p0 = inner[0], pc = pts[cut], pe = pts[pts.length - 1];
        const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
        const d1 = dir(p0, pe), d2 = dir(pc, pe);
        const gL = grp({ parent, px: p0[0], py: p0[1], f: L.f[0], zt: 0.17, kw: 0.010, kt: 0.005, kl: 0.008, uy: d1[1], sx: Math.sign(d1[0]) });
        const gS = grp({ parent: gL.id, px: pc[0], py: pc[1], f: L.f[1], zt: 0.13, kw: 0.03, kt: 0.018, kl: 0.022, uy: d2[1], sx: Math.sign(d2[0]) });
        L.gi = gL.id;
        gL.segs.push({ pts: inner, lvl: 0 });
        gS.segs.push({ pts: outer, lvl: 0 });
        for (const [gp, pp] of [[gL, inner], [gS, outer]]) {
          walk(pp, 24, (x, y, a, w) => {
            if (y > 444 || r() > 0.82) return;
            const c1 = a - (0.55 + 0.5 * r()), c2 = a + (0.55 + 0.5 * r());
            const up = Math.sin(c1) < Math.sin(c2) ? c1 : c2, dn = up === c1 ? c2 : c1;
            const ba = r() < 0.74 ? up : dn;
            if (w < 7 && r() < 0.35) { shoot(gp, x, y, -Math.PI / 2 + (ba + Math.PI / 2) * 0.4, 18 + 30 * r(), Math.min(1.6, w * 0.5)); return; }
            branch(gp, x, y, ba, (38 + 66 * r()) * (w > 6 ? 1 : 0.75), Math.max(1.2, w * 0.5), 1);
          });
        }
      }
      // 花：开放、侧开、花苞；贴着枝的两侧，新枝上最密
      for (const gp of G) for (const sg of gp.segs) {
        const step = sg.lvl === 2 ? 6.2 : sg.lvl === 0 ? 8.5 : 7.2;
        walk(sg.pts, step, (x, y, a, w) => {
          if (w > 7.5) return;
          const p = sg.lvl === 2 ? 0.7 : sg.lvl === 0 ? 0.3 : 0.5;
          if (r() > p) return;
          const side = r() < 0.5 ? -1 : 1;
          const nx = -Math.sin(a) * side, ny = Math.cos(a) * side;
          const u = r(), kind = u < 0.58 ? 0 : u < 0.78 ? 1 : 2;
          const rad = kind === 2 ? 1.5 + 0.7 * r() : 3.1 + 1.3 * r();
          const off = w / 2 + rad * (kind === 2 ? 0.5 : 0.42) + r() * 1.0;
          const bx = x + nx * off, by = y + ny * off;
          const pos = ny < -0.35 ? 0 : ny > 0.35 ? 2 : 1;      // 0 枝上 1 侧 2 枝下
          const o = { x: bx, y: by, rad, kind, rot: r() * TAU, pos, sq: 0.55 + 0.2 * r(), cov: -1, back: r() < 0.3, hue: r() };
          if (!sg.drop) gp.blos.push(o);
        });
        if (sg.lvl === 2) { // 枝梢一两个花苞
          const e = sg.pts[sg.pts.length - 1];
          const o = { x: e[0], y: e[1] - 1, rad: 1.6 + 0.5 * r(), kind: 2, rot: 0, pos: 0, sq: 1, cov: -1, back: false };
          if (!sg.drop) gp.blos.push(o);
        }
      }
      // 雪：枝背上的雪条（成串小雪团）
      const inClump = (cl, x, y, pad) => {
        const ca = Math.cos(cl.a), sa = Math.sin(cl.a), dx = x - cl.x, dy = y - cl.y;
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        return Math.abs(u) < 0.42 * cl.w - pad && v > -0.7 * cl.h + pad && v < 0.24 * cl.h;
      };
      for (const gp of G) for (const sg of gp.segs) {
        walk(sg.pts, 9, (x, y, a, w) => {
          const ca = Math.cos(a), sa = Math.sin(a), hz = Math.abs(ca);
          if (hz < 0.3 || w < 1.1) return;
          let ang = ca < 0 ? a + Math.PI : a;
          let nx = sa, ny = -ca;
          if (ny > 0) { nx = -nx; ny = -ny; }
          const cw = (10 + 1.4 * w + 3 * r()) * (0.55 + 0.45 * hz), ch = cw * (0.52 + 0.14 * r()), vv = (r() * 6) | 0;
          if (!sg.drop) gp.clumps.push({ x: x + nx * (w / 2 - 0.9), y: y + ny * (w / 2 - 0.9), a: ang, w: cw, h: ch, v: vv, early: -1 });
        });
      }
      // 第1句第4–7字滑落的小团：盖住一簇花，并替掉这里原来的雪条
      const allB = [];
      for (const gp of G) for (const b of gp.blos) allB.push([gp, b]);
      EARLY.forEach((E, ei) => {
        let best = null, bd = 1e9;
        for (const [gp, b] of allB) {
          if (b.pos === 2 || b.kind === 2 || b.cov >= 0) continue;
          let n = 0;
          for (const b2 of gp.blos) if (Math.hypot(b2.x - b.x, b2.y - b.y) < 12) n++;
          const d = Math.hypot(b.x - E.x, b.y - E.y) - Math.min(n, 6) * 3;
          if (d < bd) { bd = d; best = [gp, b]; }
        }
        const [gp, b] = best;
        const near = gp.blos.filter((b2) => Math.hypot(b2.x - b.x, b2.y - b.y) < 12);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const b2 of near) { x0 = Math.min(x0, b2.x - b2.rad); x1 = Math.max(x1, b2.x + b2.rad); y0 = Math.min(y0, b2.y - b2.rad); y1 = Math.max(y1, b2.y + b2.rad); }
        const cw = Math.max(15, x1 - x0 + 7), ch = Math.max(11, (y1 - y0) / 0.9 + 3);
        // 顺着最近那段枝的走向
        let ba = 0, bd2 = 1e9;
        for (const sg of gp.segs) if (!sg.drop) for (let i = 1; i < sg.pts.length; i++) {
          const p0 = sg.pts[i - 1], p1 = sg.pts[i], d = Math.hypot((p0[0] + p1[0]) / 2 - (x0 + x1) / 2, (p0[1] + p1[1]) / 2 - y1);
          if (d < bd2) { bd2 = d; ba = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); }
        }
        if (Math.cos(ba) < 0) ba += Math.PI;
        const cl = { x: (x0 + x1) / 2, y: y1 + 0.18 * ch - 2, a: clamp(ba, -0.6, 0.6), w: cw, h: ch, v: ei % 6, early: ei };
        gp.clumps = gp.clumps.filter((c2) => c2.early >= 0 || Math.hypot(c2.x - cl.x, c2.y - cl.y) > 0.5 * cw);
        gp.clumps.push(cl);
        for (const b2 of gp.blos) if (inClump(cl, b2.x, b2.y, 1)) { b2.cov = 1; b2.host = cl; }
      });
      // 花上的雪帽：枝上与侧面的花几乎都被盖住，枝下的花透出暗红
      for (const gp of G) {
        for (const b of gp.blos) {
          if (b.cov >= 0) continue;
          const hc = gp.clumps.find((cl) => inClump(cl, b.x, b.y, b.rad * 0.3));
          if (hc) { b.cov = 1; b.host = hc; continue; }
          if (b.pos === 2 && r() < 0.45) { b.under = true; continue; }
          // 挨得近的花合用一个雪帽
          let host = null;
          for (const cl of gp.clumps) if (cl.cap && cl.w < 22 && Math.hypot(cl.x - b.x, cl.y - 0.35 * cl.h - b.y) < 0.45 * cl.w) { host = cl; break; }
          if (host) {
            const x0 = Math.min(host.x - host.w / 2, b.x - b.rad - 1.8), x1 = Math.max(host.x + host.w / 2, b.x + b.rad + 1.8);
            host.y = Math.max(host.y, b.y + 0.72 * b.rad); host.x = (x0 + x1) / 2; host.w = x1 - x0; host.h = Math.max(host.h, host.w * 0.66);
            b.cov = 1; b.host = host; continue;
          }
          const cw = 2.7 * b.rad + 3 + 2.5 * r();
          const cl = { x: b.x, y: b.y + 0.72 * b.rad, a: (r() - 0.5) * 0.5, w: cw, h: cw * (0.72 + 0.15 * r()), v: (r() * 6) | 0, early: -1, cap: true };
          gp.clumps.push(cl);
          b.cov = 1; b.host = cl;
        }
        // 枝下没有雪帽的花：挂靠最近的雪团（同一处的枝被摇动时，花上的霜粉一起落掉）
        for (const b of gp.blos) {
          if (b.host) continue;
          let bd = 1e9;
          for (const cl of gp.clumps) { const d = Math.hypot(cl.x - b.x, cl.y - 0.3 * cl.h - b.y); if (d < bd) { bd = d; b.host = cl; } }
        }
        // 每个雪团挂着的花（树后一层、树前一层分开，便于按前后次序盖霜）
        for (const cl of gp.clumps) { cl.hbB = []; cl.hbF = []; }
        for (const b of gp.blos) if (b.host) (b.back ? b.host.hbB : b.host.hbF).push(b);
        // 雪团的序号、质量
        gp.clumps.forEach((cl) => { cl.m = cl.w * cl.h; });
      }
      // 每组的包围盒（不含雪团），给贴图用
      for (const gp of G) {
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const sg of gp.segs) if (!sg.drop) for (const p of sg.pts) { x0 = Math.min(x0, p[0] - p[2]); x1 = Math.max(x1, p[0] + p[2]); y0 = Math.min(y0, p[1] - p[2]); y1 = Math.max(y1, p[1] + p[2]); }
        for (const b of gp.blos) { x0 = Math.min(x0, b.x - b.rad); x1 = Math.max(x1, b.x + b.rad); y0 = Math.min(y0, b.y - b.rad); y1 = Math.max(y1, b.y + b.rad); }
        for (const cl of gp.clumps) { const rr = Math.max(cl.w, cl.h) * 0.6; x0 = Math.min(x0, cl.x - rr); x1 = Math.max(x1, cl.x + rr); y0 = Math.min(y0, cl.y - rr * 1.3); y1 = Math.max(y1, cl.y + rr); }
        gp.box = [Math.floor(x0 - 6), Math.floor(y0 - 6), Math.ceil(x1 - x0 + 12), Math.ceil(y1 - y0 + 12)];
        gp.cx = (x0 + x1) / 2;
      }
      // 全部雪团编号
      const CL = [];
      for (const gp of G) for (const cl of gp.clumps) { cl.g = gp.id; cl.i = CL.length; CL.push(cl); }
      return { G, CL };
    })();
    const G = TREE.G, CL = TREE.CL;
    // 组的绘制次序：父在前，右侧主枝在前
    const ORDER = (() => { const o = []; const add = (id) => { o.push(id); for (const k of G[id].kids) add(k); }; for (const gp of G) if (gp.parent < 0 && gp.id !== 6) add(gp.id); add(6); return o; })();

    // ---------------- 阵风与随时间变化的量（由唱字时间决定，按时间签名缓存）----------------
    const PNORM = 1 / 0.63, T1 = 0.12, T2 = 0.8, TC = 1 / (1 / T1 + 1 / T2);
    const pulse = (u) => (u > 0 ? (1 - Math.exp(-u / T1)) * Math.exp(-u / T2) * PNORM : 0);
    const pint = (u) => (u > 0 ? (T2 * (1 - Math.exp(-u / T2)) - TC * (1 - Math.exp(-u / TC))) * PNORM : 0);
    const T0 = -2, DT = 1 / 240, NS = Math.ceil((10 - T0) / DT);
    const MEMO = new Map();
    function events(c) {
      const e = {
        bai: CT(c, 7, 2.944), fei: CT(c, 10, 4.204),
        du: CT(c, 11, 4.924), cheng: CT(c, 12, 5.564), hong: CT(c, 13, 6.004),
        early: EARLY.map((E) => CT(c, E.k, E.def) + (E.lag || 0)),
      };
      e.beats = beatsIn(c, e.hong + 0.2, c.dur + 0.6);
      e.key = [e.du, e.cheng, e.hong, ...e.early, ...e.beats].map((v) => v.toFixed(3)).join(',');
      return e;
    }
    function build(e) {
      const gusts = [[e.du - 0.08, 0.75], [e.cheng - 0.08, 0.95], [e.hong - 0.1, 1.25]];
      for (const b of e.beats) gusts.push([b, 0.32]);
      const gw = (t) => { let s = 0; for (const [tk, a] of gusts) s += a * pulse(t - tk); return s; };
      const D = (t) => { let s = 0; for (const [tk, a] of gusts) s += a * pint(t - tk); return s; };
      // 人物衣发：更慢的风势包络
      const gwSlow = (t) => { let s = 0; for (const [tk, a] of gusts) { const u = t - tk; if (u > 0) s += a * (1 - Math.exp(-u / 0.35)) * Math.exp(-u / 1.4) * 1.75; } return s; };
      // 每个雪团的脱落时间
      for (const cl of CL) {
        const u = h2(cl.i, 11), u2 = h2(cl.i, 12), sp = Math.pow(h2(cl.i, 13), 1.5);
        if (cl.early >= 0) { cl.r = e.early[cl.early] + 0.05; cl.batch = 0; continue; }
        const x = cl.x;
        let tk;
        if (x > 560 ? u < 0.8 : x > 420 ? u < 0.25 : u < 0.06) { tk = e.du; cl.batch = 1; }
        else if (x > 380 ? u2 < 0.85 : u2 < 0.5) { tk = e.cheng; cl.batch = 2; }
        else { tk = e.hong; cl.batch = 3; }
        cl.r = tk + dl(x) - 0.04 + 0.18 * sp;
      }
      // 枝组贴图的切换：一批雪团开始动之前，把它们从贴图里拿出来，改为逐个画
      for (const gp of G) {
        const first = {};
        for (const cl of gp.clumps) { const k = cl.early >= 0 ? 'e' + cl.early : 'b' + cl.batch; first[k] = Math.min(first[k] == null ? 1e9 : first[k], cl.r - (cl.early >= 0 ? 0.3 : 0.03)); cl.bk = k; }
        for (const cl of gp.clumps) cl.sw = first[cl.bk];
        gp.sws = [...new Set(Object.values(first))].sort((a, b) => a - b);
      }
      // 每组（含子组）的积雪载荷随时间
      const load = G.map(() => new Float32Array(NS + 1));
      const tot = G.map(() => 0);
      const anc = (gid, fn) => { for (let k = gid; k >= 0; k = G[k].parent) fn(k); };
      for (const cl of CL) anc(cl.g, (k) => { tot[k] += cl.m; });
      for (const cl of CL) {
        const i0 = Math.max(0, Math.floor((cl.r - T0) / DT)), n = 24;
        anc(cl.g, (k) => { for (let j = 0; j < n && i0 + j <= NS; j++) load[k][i0 + j] += cl.m / n / tot[k]; });
      }
      for (const L of load) { let s = 0; for (let i = 0; i <= NS; i++) { s += L[i]; L[i] = Math.max(0, 1 - s); } }
      // 阻尼弹簧：阵风推、湍流摇、卸雪回弹
      const th = G.map(() => new Float32Array(NS + 1));
      G.forEach((gp, k) => {
        const w = TAU * gp.f, z = gp.zt, d = dl(gp.cx), sd = 17 + k * 7;
        let x = 0, v = 0;
        for (let i = 0; i <= NS; i++) {
          const t = T0 + i * DT, gg = gw(t - d);
          const turb = 2 * noise1(t * 2.7 + k * 3.1, sd) - 1;
          const breeze = 0.0015 * (2 * noise1(t * 0.55, sd + 1) - 1) * (gp.parent >= 0 ? 2 : 1);
          const eq = gg * (gp.kw * gp.uy + gp.kt * turb) - gp.kl * gp.sx * (1 - load[k][i]) + breeze;
          v += (w * w * (eq - x) - 2 * z * w * v) * DT;
          x += v * DT;
          th[k][i] = x;
        }
      });
      const thAt = (k, t) => { const f = clamp((t - T0) / DT, 0, NS - 1), i = Math.floor(f), u = f - i, a = th[k]; return a[i] + (a[i + 1] - a[i]) * u; };
      const mats = (t) => { const M = []; for (const gp of G) { const R = rotAbout(thAt(gp.id, t), gp.px, gp.py); M[gp.id] = gp.parent >= 0 ? mul(M[gp.parent], R) : R; } return M; };
      // 雪团脱落时的位置、速度与落地
      for (const cl of CL) {
        const ma = mats(cl.r - 0.004), mb = mats(cl.r + 0.004);
        let lx = cl.x, ly = cl.y, sl = [0, 0];
        if (cl.early >= 0) { // 滑落：沿枝的下坡方向加速 0.23 秒
          const sd = slideDir(cl);
          lx += sd[0] * 7; ly += sd[1] * 7;
          sl = [sd[0] * 61, sd[1] * 61];
        }
        const pa = apply(ma[cl.g], lx, ly), pb = apply(mb[cl.g], lx, ly), p = apply(mats(cl.r)[cl.g], lx, ly);
        const z = ZTREE + (h2(cl.i, 31) - 0.5) * 1.5;
        cl.fx = p[0]; cl.fy = p[1];
        const toss = cl.early >= 0 ? 0 : 1;
        cl.vx = (pb[0] - pa[0]) / 0.008 + sl[0] - toss * (40 + 90 * h2(cl.i, 32));
        cl.vy = (pb[1] - pa[1]) / 0.008 + sl[1] - toss * (25 * h2(cl.i, 33) - 8);
        cl.th0 = 0;
        for (let k = cl.g; k >= 0; k = G[k].parent) cl.th0 += thAt(k, cl.r);
        cl.yg = gyZ(z); cl.z = z;
        let tl = 3;
        for (let s = 0; s < 3; s += 0.005) { if (fallY(cl, s) >= cl.yg) { tl = s; break; } }
        cl.tl = tl;
        cl.spin = (h2(cl.i, 34) - 0.5) * 4;
      }
      // 成片抖落的雪粉：每组每批挑几个雪团当发射点
      const EM = [];
      for (const gp of G) {
        const by = {};
        for (const cl of gp.clumps) if (cl.early < 0) (by[cl.batch] = by[cl.batch] || []).push(cl);
        for (const k in by) {
          const L = by[k].sort((a, b) => a.x - b.x), n = Math.min(3, Math.ceil(L.length / 10));
          for (let j = 0; j < n; j++) {
            const cl = L[Math.floor((j + 0.5) / n * L.length)];
            let wsum = 0; for (const c2 of L) wsum += c2.w;
            EM.push({ cl, w: Math.min(36, wsum / n / 3 + 10), sd: cl.i });
          }
        }
      }
      // 花瓣：阵风撕下、拍点上成批、平时零星
      const blos = [];
      for (const gp of G) gp.blos.forEach((b, bi) => { if (b.kind !== 2) blos.push([gp.id, bi, b]); });
      const covT = (gid, b) => { // 这朵花上的雪什么时候走
        let t = -10;
        for (const cl of G[gid].clumps) if (Math.hypot(cl.x - b.x, cl.y - 0.3 * cl.h - b.y) < 0.5 * cl.w) t = Math.max(t, cl.r);
        if (b.host) t = Math.max(t, frostEnd(b.host));
        return t;
      };
      const P = [];
      const add = (n, t0, spread, seed, strong, wholeP = 0.24, liftP = 0) => {
        for (let j = 0; j < n; j++) {
          let pick = null;
          for (let tries = 0; tries < 8 && !pick; tries++) {
            const q = blos[Math.floor(h2(seed + j * 13 + tries, 41) * blos.length)];
            const bt = t0 + dl(q[2].x) + 0.1 + spread * h2(seed + j, 42);
            if (covT(q[0], q[2]) < bt - 0.08) pick = [q, bt];
          }
          if (!pick) continue;
          const [[gid, , b], bt] = pick;
          const sd = seed * 31 + j, u = h2(sd, 43), whole = h2(sd, 44) < wholeP;
          const z = ZTREE + (h2(sd, 45) - 0.5) * 2.4;
          P.push({
            g: gid, lx: b.x, ly: b.y, b: bt, whole, z, yg: gyZ(z),
            U0: whole ? 35 + 40 * u : 105 + 70 * u, U1: whole ? 80 : 170 + 80 * h2(sd, 46),
            vt: whole ? 160 + 60 * h2(sd, 47) : 40 + 32 * h2(sd, 47),
            L: (whole ? 10 + 25 * u : 30 + 95 * h2(sd, 48)) * strong * (h2(sd, 61) < liftP ? 1.5 : 1),
            ax: whole ? 2 : 5 + 8 * h2(sd, 49), wx: TAU * (0.5 + 0.6 * h2(sd, 50)), px: TAU * h2(sd, 51),
            ay: whole ? 2 : 4 + 7 * h2(sd, 52), wy: TAU * (0.8 + 0.8 * h2(sd, 53)), py: TAU * h2(sd, 54),
            spin: (h2(sd, 55) < 0.5 ? -1 : 1) * (whole ? 1 + 1.5 * u : 1.6 + 3.2 * u), rot: TAU * h2(sd, 56),
            wf: TAU * (0.7 + 1.1 * h2(sd, 57)), pf: TAU * h2(sd, 58),
            size: (whole ? 4.6 + 1.0 * u : 3.1 + 1.4 * h2(sd, 59)) * ZTREE / z,
            col: h2(sd, 60),
          });
        }
      };
      // 小团雪滑落时带下一两朵整花，先落在雪地上（第1句第4–7字）
      for (const cl of CL) {
        if (cl.early < 0) continue;
        const gb = G[cl.g].blos.filter((b) => b.kind !== 2 && Math.hypot(b.x - cl.x, b.y - (cl.y - 0.35 * cl.h)) < 0.6 * cl.w);
        for (let j = 0; j < Math.min(2, gb.length); j++) {
          const b = gb[Math.floor(h2(cl.i, 70 + j) * gb.length)], sd = 7000 + cl.i * 3 + j, z = ZTREE + (h2(sd, 45) - 0.5) * 1.6;
          P.push({ g: cl.g, lx: b.x, ly: b.y, b: cl.r + 0.04 + 0.12 * j, whole: true, z, yg: gyZ(z), U0: 18 + 20 * h2(sd, 43), U1: 60, vt: 170 + 40 * h2(sd, 47), L: 4,
            ax: 2, wx: TAU * 0.8, px: 0, ay: 2, wy: TAU * 1.1, py: 0, spin: 1.2, rot: TAU * h2(sd, 56), wf: TAU * 0.9, pf: TAU * h2(sd, 58), size: 5 * ZTREE / z, col: 0 });
        }
      }
      add(44, e.du, 0.6, 101, 0.8, 0.5);
      add(50, e.cheng, 0.6, 202, 1.0, 0.35);
      add(124, e.hong, 0.7, 303, 1.3, 0.24, 0.3);   // 第1句第14字：最大的一批，三成被托得更高，扫过左上的天空
      e.beats.forEach((bt, k) => add(14, bt, 0.35, 404 + k * 17, 0.6));
      for (let k = 0, t = e.du + 0.3; t < 8.6; k++, t += 0.12) add(1, t, 0.05, 900 + k, 0.45);
      // 花瓣出生位置与落地时间
      for (const p of P) {
        const m = mats(p.b)[p.g];
        const q = apply(m, p.lx, p.ly);
        p.x0 = q[0]; p.y0 = q[1]; p.dlb = dl(p.x0); p.Db = D(p.b - p.dlb);
        p.tl = 1e9;
        for (let s = 0.02; s < 12; s += 0.02) { if (petalY(p, s) >= p.yg) { p.tl = s; break; } }
        if (p.tl < 1e9) { let lo = p.tl - 0.02, hi = p.tl; for (let it = 0; it < 10; it++) { const m = (lo + hi) / 2; if (petalY(p, m) >= p.yg) hi = m; else lo = m; } p.tl = hi; }
        if (p.tl < 1e9) { const pp = petalPos(p, p.b + p.tl, D); p.lx2 = pp[0]; }
      }
      // 枝组各状态的贴图一次建好（实时预览时不在阵风中途卡顿）
      for (const gp of G) for (let k = 0; k <= gp.sws.length; k++) for (let part = 0; part < 3; part++) grpState(gp, k, e.key, part);
      return { gw, D, gwSlow, thAt, mats, P, EM };
    }
    function slideDir(cl) {
      let ca = Math.cos(cl.a), sa = Math.sin(cl.a);
      if (sa < 0 || (Math.abs(sa) < 0.05 && ca < 0)) { ca = -ca; sa = -sa; }
      if (Math.abs(sa) < 0.2) { sa = 0.2; ca = Math.sign(ca || 1) * Math.sqrt(1 - 0.04); }
      return [ca, sa];
    }
    // 雪团脱落后的下落（带空气阻力的落体）
    const TT = VTC / GRAV;
    function fallY(cl, s) { return cl.fy + VTC * s + (cl.vy - VTC) * TT * (1 - Math.exp(-s / TT)); }
    function fallX(cl, s) { return cl.fx + cl.vx * 0.55 * (1 - Math.exp(-s / 0.55)) - 80 * s * s; }
    // 雪团在空中存留的时长：滑落的小团一直落到地上；抖落的雪团在落地前散尽
    const lifeOf = (cl) => (cl.early >= 0 ? cl.tl : Math.min(0.35 + 0.3 * h2(cl.i, 35), 0.95 * cl.tl));
    const isChunk = (cl) => cl.early >= 0 || (cl.w >= 14 && h2(cl.i, 36) < 0.35);
    // 下落中的雪团：位置、转角、缩放、透明度
    const XR = 0.12;   // 离枝后这段时间里雪团仍按所在枝组的前后次序画一份（被前面的枝挡住的部分不会一下子跳到最前）
    function coreXf(cl, s) {
      const early = cl.early >= 0, u = s / lifeOf(cl);
      const tilt = early ? (slideDir(cl)[0] > 0 ? 0.5 : -0.5) : 0;
      const k = early ? 1 - 0.5 * smooth(s / cl.tl) : 1 - 0.65 * smooth(u);
      return [fallX(cl, s), fallY(cl, s), cl.a + cl.th0 + tilt + cl.spin * s, k, early ? 1 : 1 - smooth((u - 0.6) / 0.4)];
    }
    // 花瓣：水平速度随风、竖直有终速，阵风托起，带摆荡
    const TR = 0.3;
    function petalY(p, s) {
      const u = s / 0.7;
      return p.y0 + p.vt * (s - 0.25 * (1 - Math.exp(-s / 0.25))) - p.L * u * Math.exp(1 - u) * (1 - Math.exp(-s / 0.12))
        + p.ay * Math.sin(p.wy * s + p.py) * (1 - Math.exp(-s / 0.4));
    }
    function petalPos(p, t, D) {
      const s = t - p.b;
      const ramp = s - TR * (1 - Math.exp(-s / TR));
      const x = p.x0 - p.U0 * ramp - p.U1 * (D(t - p.dlb) - p.Db) * (1 - Math.exp(-s / TR))
        + p.ax * (Math.sin(p.wx * s + p.px) - Math.sin(p.px)) * (1 - Math.exp(-s / 0.5));
      return [x, petalY(p, s)];
    }
    const getM = (e) => { let m = MEMO.get(e.key); if (!m) { if (MEMO.size > 4) MEMO.clear(); m = build(e); MEMO.set(e.key, m); } return m; };

    // ---------------- 贴图 ----------------
    // 天空：阴天，左上略亮（光从左来）；歌词区只有平稳的渐变
    const skyLayer = () => K.cache('f8:sky', W + 120, 520, 0.5, (g) => {
      g.translate(60, 40);
      let gr = g.createLinearGradient(0, -40, 0, 480);
      gr.addColorStop(0, '#8e9aab'); gr.addColorStop(0.32, '#a3aebc'); gr.addColorStop(0.66, '#bec6d0'); gr.addColorStop(1, '#d4d9df');
      g.fillStyle = gr; g.fillRect(-60, -40, W + 120, 520);
      gr = g.createRadialGradient(-120, 60, 0, -120, 60, 980);
      gr.addColorStop(0, 'rgba(226,231,237,0.5)'); gr.addColorStop(0.5, 'rgba(214,220,228,0.18)'); gr.addColorStop(1, 'rgba(214,220,228,0)');
      g.fillStyle = gr; g.fillRect(-60, -40, W + 120, 520);
      gr = g.createRadialGradient(150, 480, 0, 150, 480, 760);
      gr.addColorStop(0, 'rgba(236,231,228,0.55)'); gr.addColorStop(0.45, 'rgba(228,226,226,0.2)'); gr.addColorStop(1, 'rgba(228,226,226,0)');
      g.fillStyle = gr; g.fillRect(-60, -40, W + 120, 520);
      // 低垂的云层：几团很淡、很虚的深浅（压在歌词区以下）
      blurInto(g, W + 120, 520, 34, (b) => {
        const r = A.rng(8801);
        for (let i = 0; i < 16; i++) {
          const x = r() * (W + 200) - 100, y = 170 + r() * 230, w = 180 + r() * 380;
          b.fillStyle = i % 3 ? 'rgba(126,138,154,0.06)' : 'rgba(222,227,233,0.1)';
          b.beginPath(); b.ellipse(x, y, w / 2, 16 + r() * 26, 0, 0, TAU); b.fill();
        }
      });
    });
    // 远景：地平线上低缓的远山、雾里的几棵远树
    const farLayer = () => K.cache('f8:far', W + 120, 200, 1, (g) => {
      g.translate(60, -(HOR - 150));
      // 山形：起伏的山脊线（几层噪声叠加）；朝左的坡受光略亮
      const range = (x0, x1, base, peaks, col, lit, blur, seed) => {
        blurInto(g, W + 120, 200, blur, (b) => {
          const H0 = base[1];
          const top = (x) => {
            const u = (x - x0) / (x1 - x0), env = Math.pow(Math.sin(Math.PI * clamp(u)), 0.6);
            let v = 0, a = 1, f = peaks / (x1 - x0), n = 0;
            for (let o = 0; o < 4; o++) { v += a * noise1(x * f + seed * 7.3, seed + o); n += a; a *= 0.45; f *= 2.3; }
            return env * Math.pow(v / n, 1.6) * 1.9;
          };
          b.fillStyle = col; b.beginPath(); b.moveTo(x0, base[0] + 10);
          for (let x = x0; x <= x1; x += 3) b.lineTo(x, base[0] - H0 * top(x));
          b.lineTo(x1, base[0] + 10); b.closePath(); b.fill();
          b.save(); b.clip();
          b.fillStyle = lit;
          for (let x = x0; x <= x1; x += 2) {
            const sl = (top(x + 3) - top(x - 3)) * H0 / 6;
            if (sl <= 0.05) continue;
            const yt = base[0] - H0 * top(x);
            b.globalAlpha = clamp(sl * 0.9);
            b.fillRect(x, yt, 2, (base[0] - yt) * 0.5);
          }
          b.restore();
        });
      };
      range(520, 1440, [HOR + 2, 120], 5, '#b5beca', 'rgba(208,215,224,0.6)', 2.4, 41);
      range(-120, 660, [HOR + 2, 70], 4, '#aeb7c2', 'rgba(206,213,222,0.55)', 1.8, 42);
      // 山脚的雪雾
      let gr = g.createLinearGradient(0, HOR - 70, 0, HOR + 6);
      gr.addColorStop(0, 'rgba(208,214,222,0)'); gr.addColorStop(1, 'rgba(212,218,225,0.85)');
      g.fillStyle = gr; g.fillRect(-60, HOR - 70, W + 120, 80);
      range(-120, 1440, [HOR + 3, 22], 9, '#a8b1bd', 'rgba(198,206,216,0.5)', 1.0, 43);
      // 坡上一线细小的远树
      const tree = (b, x, y, h, seed) => {
        const r = A.rng(seed);
        b.strokeStyle = 'rgba(128,138,152,0.8)'; b.lineCap = 'round';
        b.lineWidth = Math.max(0.7, h * 0.08);
        b.beginPath(); b.moveTo(x, y); b.lineTo(x + (r() - 0.5) * 1.5, y - h * 0.55); b.stroke();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (r() - 0.5) * 1.7, l = h * (0.3 + 0.35 * r()), y0 = y - h * (0.3 + 0.3 * r());
          b.lineWidth = Math.max(0.45, h * 0.035);
          b.beginPath(); b.moveTo(x, y0); b.lineTo(x + Math.cos(a) * l, y0 + Math.sin(a) * l); b.stroke();
        }
      };
      blurInto(g, W + 120, 200, 0.55, (b) => {
        const r = A.rng(4471);
        for (let i = 0; i < 26; i++) {
          const x = r() < 0.5 ? 20 + r() * 300 : 820 + r() * 440, h = 6 + r() * 10;
          tree(b, x, HOR + 2 - r() * 6, h, 500 + i);
        }
      });
      // 地平线雾带
      gr = g.createLinearGradient(0, HOR - 30, 0, HOR + 14);
      gr.addColorStop(0, 'rgba(214,219,226,0)'); gr.addColorStop(0.7, 'rgba(216,221,228,0.6)'); gr.addColorStop(1, 'rgba(218,223,229,0.3)');
      g.fillStyle = gr; g.fillRect(-60, HOR - 30, W + 120, 44);
    });
    // 天空与远景合成一张：都在极远处，镜头前推时不缩放
    const bgLayer = () => K.cache('f8:bg', W + 120, 560, 1, (g) => {
      g.translate(60, 40);
      g.drawImage(skyLayer(), -60, -40, W + 120, 520);
      g.drawImage(farLayer(), -60, HOR - 150, W + 120, 200);
      dither(g, 1.6);
    });
    // 雪地：远处略灰蓝，近处白；缓丘左亮右影（光从左来）；树下一片很淡的阴影
    const groundLayer = () => K.cache('f8:ground', W + 120, H - HOR + 60, 1, (g) => {
      g.translate(60, -(HOR - 6));
      let gr = g.createLinearGradient(0, HOR - 6, 0, H + 50);
      gr.addColorStop(0, '#d2d8df'); gr.addColorStop(0.18, '#dbe0e6'); gr.addColorStop(0.5, '#e4e8ec'); gr.addColorStop(1, '#eceff2');
      g.fillStyle = gr; g.fillRect(-60, HOR - 6, W + 120, H - HOR + 60);
      gr = g.createLinearGradient(0, HOR - 6, 0, HOR + 22);
      gr.addColorStop(0, 'rgba(208,214,222,0.9)'); gr.addColorStop(1, 'rgba(208,214,222,0)');
      g.fillStyle = gr; g.fillRect(-60, HOR - 6, W + 120, 28);
      blurInto(g, W + 120, H - HOR + 60, 6, (b) => {
        const r = A.rng(5521);
        for (let i = 0; i < 60; i++) {
          const z = 6 + Math.pow(r(), 1.6) * 70, y = gyZ(z), x = r() * (W + 200) - 100;
          const w = 9000 * (0.6 + r()) / (z * 10), hh = Math.max(1.2, 260 * (0.6 + r()) / (z * z) * 3);
          b.fillStyle = 'rgba(140,154,172,0.09)';
          b.beginPath(); b.ellipse(x + w * 0.22, y + hh * 0.3, w * 0.9, hh * 0.7, 0, 0, TAU); b.fill();
          b.fillStyle = 'rgba(246,248,250,0.22)';
          b.beginPath(); b.ellipse(x - w * 0.18, y - hh * 0.25, w * 0.55, hh * 0.8, 0, 0, TAU); b.fill();
        }
        // 树冠下的散射阴影（偏右一点）
        const g2 = b.createRadialGradient(0, 0, 0, 0, 0, 1);
        g2.addColorStop(0, 'rgba(128,140,158,0.26)'); g2.addColorStop(1, 'rgba(128,140,158,0)');
        b.save(); b.translate(486, 610); b.scale(250, 20); b.fillStyle = g2; b.beginPath(); b.arc(0, 0, 1, 0, TAU); b.fill(); b.restore();
      });
      // 风吹出的雪纹：几道极淡的横向细痕，近处宽
      g.strokeStyle = 'rgba(150,163,180,0.16)'; g.lineCap = 'round';
      const r = A.rng(5522);
      for (let i = 0; i < 26; i++) {
        const z = 5 + Math.pow(r(), 1.3) * 40, y = gyZ(z), x = r() * W, L = 900 / z * (0.6 + r());
        g.lineWidth = Math.max(0.6, 6 / z);
        g.beginPath(); g.moveTo(x - L / 2, y); g.quadraticCurveTo(x, y - 2 / z * 10, x + L / 2, y + 0.5); g.stroke();
      }
      // 雪中露头的枯草
      const tuft = (x, y, s, seed) => {
        const rr = A.rng(seed);
        g.strokeStyle = 'rgba(70,72,78,0.55)';
        for (let i = 0; i < 6; i++) {
          const h = s * (0.5 + rr()), lean = -0.35 - 0.3 * rr();
          g.lineWidth = Math.max(0.5, s * 0.06);
          g.beginPath(); g.moveTo(x + (rr() - 0.5) * s * 0.6, y);
          g.quadraticCurveTo(x + lean * h * 0.4, y - h * 0.6, x + lean * h, y - h); g.stroke();
        }
      };
      dither(g, 1.4);
    });
    // 树干（不动）：短粗、扭转的老干；左受光、右背光；几道拧着的筋、一个树瘤、一道裂洞；迎风的右侧贴着雪；根埋在雪堆里
    const trunkLayer = () => K.cache('f8:trunk', 220, 190, SPR, (g) => {
      g.translate(-320, -446);
      const r = A.rng(7101);
      const C = [];
      for (let i = 0; i < TRUNK.length - 1; i++) {
        const p0 = TRUNK[Math.max(0, i - 1)], p1 = TRUNK[i], p2 = TRUNK[i + 1], p3 = TRUNK[Math.min(TRUNK.length - 1, i + 2)];
        for (let k = 0; k < 10; k++) {
          const u = k / 10, u2 = u * u, u3 = u2 * u;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
          C.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]), w: lerp(p1[2], p2[2], u) });
        }
      }
      const e = TRUNK[TRUNK.length - 1];
      C.push({ x: e[0], y: e[1], w: e[2] });
      const n = C.length;
      for (let i = 0; i < n; i++) {
        const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        C[i].nx = dy / l; C[i].ny = -dx / l;                      // 指向画面左侧的法线
        if (i < 6) { const k = i / 6; C[i].nx = lerp(-1, C[i].nx, k); C[i].ny = lerp(0, C[i].ny, k); }
        C[i].wl = C[i].w / 2 * (1 + 0.1 * (2 * noise1(i * 0.2, 5) - 1));
        C[i].wr = C[i].w / 2 * (1 + 0.1 * (2 * noise1(i * 0.2, 9) - 1));
      }
      // q：-1 左缘 … +1 右缘
      const P = (i, q) => { const c = C[Math.max(0, Math.min(n - 1, Math.round(i)))], w = q < 0 ? c.wl : c.wr; return [c.x - c.nx * q * w, c.y - c.ny * q * w]; };
      const path = new Path2D();
      for (let i = 0; i < n; i++) { const p = P(i, -1); if (i) path.lineTo(p[0], p[1]); else path.moveTo(p[0], p[1]); }
      for (let i = n - 1; i >= 0; i--) { const p = P(i, 1); path.lineTo(p[0], p[1]); }
      path.closePath();
      // 根部两侧隆起（大半埋在雪里）
      path.moveTo(418, 612); path.ellipse(392, 610, 26, 9, 0.15, 0, TAU);
      path.moveTo(472, 612); path.ellipse(450, 610, 22, 8, -0.2, 0, TAU);
      // 根埋在雪堆里：雪堆以下的部分不画（雪堆下缘要和雪地柔和相接）
      g.save(); g.beginPath(); g.rect(300, 430, 260, 612 - 430); g.clip();
      let gr = g.createLinearGradient(378, 0, 462, 0);
      gr.addColorStop(0, '#6c7079'); gr.addColorStop(0.28, '#4b4e56'); gr.addColorStop(0.62, '#2f3137'); gr.addColorStop(1, '#202227');
      g.fillStyle = gr; g.fill(path);
      g.save(); g.clip(path);
      g.lineCap = 'round'; g.lineJoin = 'round';
      // 树皮：顺着树干的暗色皮块（虚边），几道蜿蜒的裂纹，受光一侧的飞白
      blurInto(g, 220, 190, 1.3, (b) => {
        for (let k = 0; k < 30; k++) {
          const i0 = 3 + h2(k, 21) * (n - 16), len = 8 + h2(k, 22) * 16, q0 = (h2(k, 23) - 0.5) * 1.6, wq = 0.12 + 0.22 * h2(k, 24);
          const L2 = [], R2 = [];
          for (let j = 0; j <= len; j += 1) {
            const u = j / len, q = q0 + 0.12 * Math.sin((i0 + j) * 0.12 + k), hw = wq * Math.sin(Math.PI * u);
            L2.push(P(i0 + j, clamp(q - hw, -1, 1))); R2.push(P(i0 + j, clamp(q + hw, -1, 1)));
          }
          b.fillStyle = q0 > 0 ? `rgba(16,17,22,${0.25 + 0.25 * h2(k, 25)})` : `rgba(28,30,36,${0.15 + 0.15 * h2(k, 25)})`;
          b.beginPath(); L2.forEach((p, j) => (j ? b.lineTo(p[0], p[1]) : b.moveTo(p[0], p[1]))); for (let j = R2.length - 1; j >= 0; j--) b.lineTo(R2[j][0], R2[j][1]); b.closePath(); b.fill();
        }
      });
      for (let k = 0; k < 6; k++) { // 裂纹：起伏、粗细渐收
        let q = (h2(k, 31) - 0.5) * 1.4;
        const i0 = 4 + h2(k, 32) * (n * 0.5), len = 20 + h2(k, 33) * 40;
        let pp = P(i0, q);
        for (let j = 1; j <= len; j++) {
          q = clamp(q + (noise1((i0 + j) * 0.15, 40 + k) - 0.5) * 0.12, -0.9, 0.9);
          const p = P(i0 + j, q);
          g.strokeStyle = `rgba(12,13,16,${0.7 * (1 - j / len) + 0.15})`; g.lineWidth = 0.6 + 1.8 * (1 - j / len) * h2(k, 34);
          g.beginPath(); g.moveTo(pp[0], pp[1]); g.lineTo(p[0], p[1]); g.stroke();
          pp = p;
        }
      }
      for (let i = 0; i < 80; i++) { // 飞白
        const i0 = 2 + r() * (n - 10), len = 3 + r() * 9, q = (r() - 0.5) * 1.9, lit = q < -0.15;
        g.beginPath();
        for (let s2 = 0; s2 <= len; s2 += 1) { const p = P(i0 + s2, q + 0.05 * Math.sin((i0 + s2) * 0.4 + i)); if (s2) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
        g.strokeStyle = lit ? `rgba(176,182,192,${0.1 + 0.2 * r()})` : `rgba(14,15,18,${0.12 + 0.22 * r()})`;
        g.lineWidth = 0.4 + 0.7 * r(); g.stroke();
      }
      // 裂洞
      const ho = P(n * 0.3, 0.18);
      g.save(); g.translate(ho[0], ho[1]); g.rotate(0.12);
      g.fillStyle = '#121316'; g.beginPath(); g.ellipse(0, 0, 4.6, 17, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(150,156,168,0.5)'; g.lineWidth = 1.1;
      g.beginPath(); g.ellipse(-0.6, 0, 5.6, 18, 0, Math.PI * 0.55, Math.PI * 1.45); g.stroke();
      g.restore();
      // 树瘤
      const bu = P(n * 0.58, -0.5);
      g.save(); g.translate(bu[0], bu[1]); g.rotate(-0.2);
      gr = g.createRadialGradient(-2.5, -2.5, 0, 0, 0, 9);
      gr.addColorStop(0, '#6e727b'); gr.addColorStop(1, '#3a3d44');
      g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 7.5, 9.5, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(16,17,20,0.6)'; g.lineWidth = 0.9;
      g.strokeStyle = 'rgba(16,17,20,0.4)';
      g.beginPath(); g.ellipse(0.8, 0.8, 7.5 * 0.6, 9.5 * 0.6, 0, Math.PI * 0.1, Math.PI * 1.3); g.stroke();
      g.fillStyle = '#eef1f4'; g.beginPath(); g.ellipse(-0.5, -8.2, 5.5, 2, 0, Math.PI, TAU); g.fill();
      g.restore();
      // 苔点：三五成簇
      for (let k = 0; k < 8; k++) {
        const c0 = P(4 + h2(k, 51) * (n - 12), (h2(k, 52) < 0.5 ? -1 : 1) * (0.5 + 0.4 * h2(k, 53)));
        for (let j = 0; j < 3 + (h2(k, 54) * 4 | 0); j++) {
          g.fillStyle = `rgba(12,13,16,${0.6 + 0.35 * h2(k * 9 + j, 55)})`;
          g.beginPath(); g.arc(c0[0] + (h2(k * 9 + j, 56) - 0.5) * 7, c0[1] + (h2(k * 9 + j, 57) - 0.5) * 9, 0.6 + 1.3 * h2(k * 9 + j, 58), 0, TAU); g.fill();
        }
      }
      g.restore();
      // 迎风的右侧贴着的雪（背光，偏蓝白）
      g.beginPath();
      for (let i = 8; i < n - 4; i++) { const p = P(i, 1); if (i === 8) g.moveTo(p[0] + 0.6, p[1]); else g.lineTo(p[0] + 0.6, p[1]); }
      for (let i = n - 5; i >= 8; i--) {
        const th = (1.2 + 3.6 * noise1(i * 0.31, 3)) * smooth((i - 8) / 6) * smooth((n - 4 - i) / 6);
        const c = C[i], p = P(i, 1); g.lineTo(p[0] + c.nx * th, p[1] + c.ny * th);
      }
      g.closePath(); g.fillStyle = '#d2d9e2'; g.fill();
      g.restore();
      // 树杈里的积雪
      gr = g.createLinearGradient(0, 452, 0, 470);
      gr.addColorStop(0, '#f7f9fa'); gr.addColorStop(1, '#c6cfda');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(431, 465, 15, 6, -0.06, 0, TAU); g.fill();
      // 根部雪堆：不规则的几个缓包，右侧背光；下缘渐隐进雪地（没有硬边）
      blurInto(g, 220, 190, 0.5, (b) => {
        const mound = new Path2D();
        mound.moveTo(330, 634); mound.lineTo(334, 624);
        const MP = [[356, 614], [378, 605], [398, 602], [410, 598], [426, 596], [440, 600], [458, 603], [482, 609], [506, 616], [522, 624]];
        let px = 334, py = 624;
        for (const [x, y] of MP) { mound.quadraticCurveTo(px + (x - px) * 0.5, Math.min(py, y) - 2.5, x, y); px = x; py = y; }
        mound.lineTo(526, 634); mound.closePath();
        let gm = b.createLinearGradient(0, 594, 0, 630);
        gm.addColorStop(0, '#f4f6f8'); gm.addColorStop(0.75, '#e3e7eb'); gm.addColorStop(1, '#e4e8ec');
        b.fillStyle = gm; b.fill(mound);
        gm = b.createLinearGradient(410, 0, 520, 0);
        gm.addColorStop(0, 'rgba(150,163,180,0)'); gm.addColorStop(1, 'rgba(150,163,180,0.34)');
        b.fillStyle = gm; b.fill(mound);
        b.strokeStyle = 'rgba(255,255,255,0.7)'; b.lineWidth = 1;
        b.beginPath(); b.moveTo(354, 617); b.quadraticCurveTo(378, 604, 404, 602); b.stroke();
        b.globalCompositeOperation = 'destination-in';
        gm = b.createLinearGradient(0, 612, 0, 632);
        gm.addColorStop(0, 'rgba(0,0,0,1)'); gm.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = gm; b.fillRect(300, 446, 260, 190);
        b.globalCompositeOperation = 'source-over';
      });
    });
    // 枝组贴图：枝、花、枝背上留下的一线薄雪（抖不掉的）
    function drawBlossom(b, o) {
      const dark = o.pos === 2, hue = o.hue == null ? 0.5 : o.hue;
      const base = dark ? mix('#8e1f2c', '#9c2a30', hue) : mix('#b8172b', '#d63434', hue);
      const hi = dark ? '#b2404a' : '#f47a62', deep = dark ? '#4c0c15' : '#6c0f1b';
      if (o.kind === 2) {
        b.fillStyle = deep; b.beginPath(); b.arc(o.x, o.y, o.rad + 0.45, 0, TAU); b.fill();
        b.fillStyle = base; b.beginPath(); b.arc(o.x - 0.15, o.y - 0.15, o.rad, 0, TAU); b.fill();
        b.fillStyle = hi; b.beginPath(); b.arc(o.x - o.rad * 0.35, o.y - o.rad * 0.35, o.rad * 0.38, 0, TAU); b.fill();
        return;
      }
      const sq = o.kind === 1 ? o.sq : 1, cr = Math.cos(o.rot), sr = Math.sin(o.rot);
      const P = (u, v) => [o.x + (u * cr - v * sq * sr), o.y + (u * sr + v * sq * cr)];
      // 五瓣：每瓣自带由里到外、左上偏亮的晕染，细勾深色瓣缘
      b.lineWidth = 0.45; b.strokeStyle = deep;
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5 + 0.3, [x, y] = P(Math.cos(a) * o.rad * 0.55, Math.sin(a) * o.rad * 0.55), pr = o.rad * 0.47;
        const gr = b.createRadialGradient(x - pr * 0.4, y - pr * 0.45, 0, x, y, pr * 1.05);
        gr.addColorStop(0, hi); gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, deep, 0.35));
        b.fillStyle = gr; b.beginPath(); b.ellipse(x, y, pr, pr * (o.kind === 1 ? Math.max(0.6, sq) : 1), a, 0, TAU); b.fill(); b.stroke();
      }
      b.fillStyle = deep; b.beginPath(); b.arc(o.x, o.y, o.rad * 0.3, 0, TAU); b.fill();
      b.fillStyle = dark ? '#c0a07c' : '#f6dcaa'; b.beginPath(); b.arc(o.x, o.y, o.rad * 0.17, 0, TAU); b.fill();
      for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + 0.9, [x, y] = P(Math.cos(a) * o.rad * 0.36, Math.sin(a) * o.rad * 0.36); b.beginPath(); b.arc(x, y, 0.4, 0, TAU); b.fill(); }
    }
    // 花上的霜：与花同形的一层冷色（雪帽下、侧面的花发白；枝下背光的花发暗），雪团离开时随之褪去
    const FROST = ['rgba(202,209,217,0.76)', 'rgba(88,84,96,0.55)'];
    function frostPath(o) {
      if (o.fp) return o.fp;
      const p = new Path2D();
      if (o.kind === 2) { p.arc(o.x, o.y, o.rad + 0.6, 0, TAU); return (o.fp = p); }
      const sq = o.kind === 1 ? o.sq : 1, cr = Math.cos(o.rot), sr = Math.sin(o.rot);
      for (let k = 0; k < 5; k++) {
        const a = k * TAU / 5 + 0.3, u = Math.cos(a) * o.rad * 0.55, v = Math.sin(a) * o.rad * 0.55;
        const x = o.x + (u * cr - v * sq * sr), y = o.y + (u * sr + v * sq * cr), pr = o.rad * 0.47 + 0.35;
        const ry = o.rad * 0.47 * (o.kind === 1 ? Math.max(0.6, sq) : 1) + 0.35;
        p.moveTo(x + pr * Math.cos(a), y + pr * Math.sin(a));
        p.ellipse(x, y, pr, ry, a, 0, TAU);
      }
      p.moveTo(o.x + o.rad * 0.4, o.y); p.arc(o.x, o.y, o.rad * 0.4, 0, TAU);
      return (o.fp = p);
    }
    const frostCol = (o) => FROST[o.under ? 1 : 0];
    function drawFrost(b, list) { for (const o of list) { b.fillStyle = frostCol(o); b.fill(frostPath(o)); } }
    function drawSegs(b, segs0) {
      const segs = segs0.filter((sg) => !sg.drop);
      for (const sg of segs) {
        const pts = sg.pts;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i];
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          b.fillStyle = sg.lvl === 2 ? '#3a3a40' : '#2e3037';
          b.beginPath();
          b.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); b.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
          b.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); b.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); b.closePath(); b.fill();
          b.beginPath(); b.arc(x1, y1, w1 / 2, 0, TAU); b.fill();
          if (i === 1) { b.beginPath(); b.arc(x0, y0, w0 / 2, 0, TAU); b.fill(); }
        }
      }
      // 受光（左上）一侧的淡边、苔点
      for (const sg of segs) {
        const pts = sg.pts;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i];
          if (w0 < 3) continue;
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
          let nx = -dy / L, ny = dx / L;
          if (nx + ny > 0) { nx = -nx; ny = -ny; }
          b.strokeStyle = 'rgba(122,128,140,0.55)'; b.lineWidth = Math.min(1.4, 0.15 * w0 + 0.4);
          b.beginPath(); b.moveTo(x0 + nx * (w0 / 2 - 0.8), y0 + ny * (w0 / 2 - 0.8)); b.lineTo(x1 + nx * (w1 / 2 - 0.8), y1 + ny * (w1 / 2 - 0.8)); b.stroke();
          if (w0 > 5 && h2(i * 7 + (x0 | 0), 3) < 0.5) {
            b.fillStyle = 'rgba(20,21,25,0.7)';
            b.beginPath(); b.arc(x0 - nx * w0 * 0.3, y0 - ny * w0 * 0.3, 0.7 + 0.6 * h2(i, 4), 0, TAU); b.fill();
          }
        }
      }
      // 抖不掉的一线薄雪：只在较平的枝背上
      for (const sg of segs) {
        const pts = sg.pts;
        for (let i = 1; i < pts.length; i++) {
          const [x0, y0, w0] = pts[i - 1], [x1, y1, w1] = pts[i];
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, hz = Math.abs(dx) / L;
          if (hz < 0.5 || w0 < 1.6) continue;
          let nx = -dy / L, ny = dx / L;
          if (ny > 0) { nx = -nx; ny = -ny; }
          b.strokeStyle = '#e8ecf1'; b.lineCap = 'round';
          b.lineWidth = (0.7 + 0.16 * w0) * hz;
          b.beginPath(); b.moveTo(x0 + nx * (w0 / 2 - 0.2), y0 + ny * (w0 / 2 - 0.2)); b.lineTo(x1 + nx * (w1 / 2 - 0.2), y1 + ny * (w1 / 2 - 0.2)); b.stroke();
        }
      }
    }
    // 枝组分两层：part 0 = 枝后的花；part 1 = 枝、枝前的花
    const grpBase = (gp, part) => K.cache('f8:grp' + part + ':' + gp.id, gp.box[2], gp.box[3], SPR, (b) => {
      if (part === 2) { b.drawImage(grpBase(gp, 0), 0, 0, gp.box[2], gp.box[3]); b.drawImage(grpBase(gp, 1), 0, 0, gp.box[2], gp.box[3]); return; }
      b.translate(-gp.box[0], -gp.box[1]);
      if (part === 0) { for (const o of gp.blos) if (o.back) drawBlossom(b, o); return; }
      drawSegs(b, gp.segs);
      for (const o of gp.blos) if (!o.back) drawBlossom(b, o);
    });
    // 第 k 个状态：底图 + 还没开始动的雪团盖着的花上的霜 + 这些雪团（part 2 = 两层合成一张，平时只画这一张）
    const grpState = (gp, k, key, part) => (k >= gp.sws.length ? grpBase(gp, part) : K.cache('f8:gs' + part + ':' + gp.id + ':' + k + ':' + key, gp.box[2], gp.box[3], SPR, (b) => {
      if (part === 2) { b.drawImage(grpState(gp, k, key, 0), 0, 0, gp.box[2], gp.box[3]); b.drawImage(grpState(gp, k, key, 1), 0, 0, gp.box[2], gp.box[3]); return; }
      b.drawImage(grpBase(gp, part), 0, 0, gp.box[2], gp.box[3]);
      b.translate(-gp.box[0], -gp.box[1]);
      const lim = k > 0 ? gp.sws[k - 1] : -1e9;
      for (const cl of gp.clumps) if (cl.sw > lim) drawFrost(b, part === 0 ? cl.hbB : cl.hbF);
      if (part === 0) return;
      for (const cl of gp.clumps) {
        if (cl.sw <= lim) continue;
        b.save(); b.translate(cl.x, cl.y); b.rotate(cl.a); b.scale(cl.w / 40, cl.h / 26);
        b.drawImage(clumpSpr(cl.v), -20, -19, 40, 26);
        b.restore();
      }
    }));
    // 霜褪去的时刻：滑落的小团在滑动中褪，抖落的雪团离枝即褪
    const frostA = (cl, t) => (cl.early >= 0 ? 1 - smooth((t - cl.r + 0.14) / 0.2) : 1 - smooth((t - cl.r + 0.02) / 0.12));
    const frostEnd = (cl) => (cl.early >= 0 ? cl.r + 0.06 : cl.r + 0.1);
    // 雪团：不规则的软团，上白下影，底缘一线冷灰
    const clumpSpr = (v) => K.cache('f8:clump' + v, 40, 26, 1.6, (g) => {
      const r = A.rng(6600 + v);
      const path = new Path2D();
      path.ellipse(20, 17.5, 16.5, 5.2, 0, 0, TAU);
      const n = 3 + (r() * 3 | 0);
      for (let i = 0; i < n; i++) { const x = 7 + 26 * (i + 0.5) / n + (r() - 0.5) * 4, rr = 4.5 + r() * 4; path.moveTo(x + rr, 15 - rr * 0.35); path.arc(x, 15 - rr * 0.35 + 2, rr, 0, TAU); }
      blurInto(g, 40, 26, 0.35, (b) => {
        let gr = b.createLinearGradient(0, 4, 0, 23);
        gr.addColorStop(0, '#fbfcfd'); gr.addColorStop(0.55, '#eef1f4'); gr.addColorStop(1, '#b9c3cf');
        b.fillStyle = gr; b.fill(path);
        b.save(); b.clip(path);
        gr = b.createLinearGradient(4, 0, 36, 0);
        gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(140,154,172,0.25)');
        b.fillStyle = gr; b.fillRect(0, 0, 40, 26);
        b.strokeStyle = 'rgba(130,144,162,0.55)'; b.lineWidth = 1.4;
        b.beginPath(); b.ellipse(20, 18.5, 16.5, 5.2, 0, 0.15 * Math.PI, 0.85 * Math.PI); b.stroke();
        b.restore();
      });
    });
    // 柔光圆点（雪片、雪粉）
    const dot = (col, core) => K.cache(`f8dot:${col}:${core}`, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(core, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    // 雪粉团：带一点冷灰的软雾
    const puff = () => K.cache('f8:puff', 96, 96, 1, (g) => {
      blurInto(g, 96, 96, 5, (b) => {
        const r = A.rng(6301);
        for (let i = 0; i < 9; i++) {
          const a = r() * TAU, d = r() * 18, rr = 14 + r() * 12;
          const gr = b.createRadialGradient(48 + Math.cos(a) * d, 48 + Math.sin(a) * d, 0, 48 + Math.cos(a) * d, 48 + Math.sin(a) * d, rr);
          gr.addColorStop(0, 'rgba(246,248,251,0.55)'); gr.addColorStop(1, 'rgba(236,240,245,0)');
          b.fillStyle = gr; b.fillRect(0, 0, 96, 96);
        }
      });
    });
    // 花瓣（单瓣）与整朵落花
    const petalSpr = (v) => K.cache('f8:petal' + v, 16, 16, 3, (g) => {
      const base = ['#c41f2f', '#d2333a', '#b3192b'][v], hi = ['#ff6a4a', '#f7826a', '#e8483c'][v];
      const gr = g.createRadialGradient(6, 6, 0, 8, 8, 7);
      gr.addColorStop(0, hi); gr.addColorStop(0.65, base); gr.addColorStop(1, mix(base, '#5a0e18', 0.4));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(8, 14.5);
      g.bezierCurveTo(1.5, 12, 1.5, 3.5, 6.2, 2); g.quadraticCurveTo(8, 3.4, 9.8, 2);
      g.bezierCurveTo(14.5, 3.5, 14.5, 12, 8, 14.5); g.fill();
    });
    const flowerSpr = () => K.cache('f8:flower', 20, 20, 3, (g) => drawBlossom(g, { x: 10, y: 10, rad: 7.2, kind: 0, rot: 0.3, pos: 0, sq: 1 }));
    // 前景：近处两道雪坎（略虚）
    const fgLayer = () => K.cache('f8:fg', W + 120, 140, 0.75, (g) => {
      g.translate(60, -600);
      blurInto(g, W + 120, 140, 1.6, (b) => {
        const mound = (pts, shadeX0, shadeX1) => {
          const p = new Path2D();
          p.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length - 1; i++) { const a = pts[i], c = pts[i + 1]; p.quadraticCurveTo(a[0], a[1], (a[0] + c[0]) / 2, (a[1] + c[1]) / 2); }
          p.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); p.lineTo(pts[pts.length - 1][0], 760); p.lineTo(pts[0][0], 760); p.closePath();
          let gr = b.createLinearGradient(0, 640, 0, 740);
          gr.addColorStop(0, '#f4f6f8'); gr.addColorStop(1, '#e4e8ed');
          b.fillStyle = gr; b.fill(p);
          gr = b.createLinearGradient(shadeX0, 0, shadeX1, 0);
          gr.addColorStop(0, 'rgba(150,163,182,0)'); gr.addColorStop(1, 'rgba(150,163,182,0.3)');
          b.fillStyle = gr; b.fill(p);
          b.strokeStyle = 'rgba(160,172,190,0.35)'; b.lineWidth = 1.2; b.stroke(p);
        };
        mound([[-70, 700], [20, 676], [110, 664], [196, 676], [262, 702], [330, 740]], 120, 300);
        mound([[930, 742], [1004, 706], [1096, 688], [1196, 690], [1290, 680], [1360, 690]], 1050, 1360);
      });
    });

    // 暖色罩：强度直接存在贴图的透明度里（约 0.07，带固定细噪），每帧只调 globalAlpha（0–1）。
    // globalAlpha 只有 8 位精度：强度若放在 globalAlpha 里，整幅会每隔几帧一起跳一级色阶
    const warmTex = () => K.cache('f8:warm', W, H, 1, (g) => {
      const cv = g.canvas, id = g.createImageData(cv.width, cv.height), d = id.data;
      let s = 97531;
      for (let i = 0; i < d.length; i += 4) {
        s = (Math.imul(s, 1103515245) + 12345) | 0;
        d[i] = 255; d[i + 1] = 196; d[i + 2] = 176; d[i + 3] = 15 + ((s >>> 16) % 6);
      }
      g.putImageData(id, 0, 0);
    });
    // ---------------- 每帧绘制的部件 ----------------
    // 雪：远处两层平铺的雪点贴图，中景粒子，近处少量大而虚的雪片
    // 远处的细雪：小块可平铺的雪点贴图，两层不同大小、不同速度。每块预先画出 2×4 个亚像素相位（x 半像素、y 四分之一像素），
    // 每帧按设备像素整数位置拷贝、按小数部分选相位：既平滑（误差 ≤ 1/8 像素）又省（不做全屏双线性重采样）
    const TILE = [[640, 360, 225], [704, 396, 302]];
    const snowTile = (k, px, py) => K.cache('f8:st' + k + ':' + px + ':' + py, TILE[k][0], TILE[k][1], 1, (g) => {
      const S = (XYT.sprites && XYT.sprites.S) || 1, [tw, th, n] = TILE[k];
      const dx = px / 2 / S, dy = py / 4 / S;
      const r = A.rng(5100 + k), r0 = [0.55, 0.7][k], r1 = [0.85, 1.05][k];
      for (let i = 0; i < n; i++) {
        const x = r() * tw + dx, y = r() * th + dy, rad = r0 + r() * r1, a = 0.35 + 0.55 * r();
        g.fillStyle = `rgba(248,250,252,${a.toFixed(3)})`;
        for (const ox of [-tw, 0, tw]) for (const oy of [-th, 0, th]) {
          const xx = x + ox, yy = y + oy;
          if (xx < -3 || xx > tw + 3 || yy < -3 || yy > th + 3) continue;
          g.beginPath(); g.arc(xx, yy, rad, 0, TAU); g.fill();
        }
      }
    });
    function farSnow(g, B, t, D, dens) {
      const Dg = D(t - dl(640)), S = (XYT.sprites && XYT.sprites.S) || 1;
      const exact = Math.abs(B.a - S) < 1e-6 && Math.abs(B.d - S) < 1e-6 && !B.b && !B.c;
      const sw = W * S, sh = H * S;
      // 层：水平速度、下落速度、阵风位移系数、透明度（第二层随“雪下密”加浓）
      const L = [[-30, 44, 60, 0.8], [-38, 57, 85, 0.4 + 0.5 * dens]];
      L.forEach(([vx, vy, kd, a], k) => {
        const [tw, th] = TILE[k];
        g.globalAlpha = a;
        if (!exact) { // 非常规变换时退回到按小数位置绘制
          g.setTransform(B);
          const ox = fmod(vx * (t + 30) - kd * Dg, tw), oy = fmod(vy * (t + 30), th), tex = snowTile(k, 0, 0);
          for (let X = ox - tw; X < W; X += tw) for (let Y = oy - th; Y < H; Y += th) g.drawImage(tex, X, Y, tw, th);
          return;
        }
        const t0 = snowTile(k, 0, 0), TWd = t0.width, THd = t0.height;
        const ox = fmod((vx * (t + 30) - kd * Dg) * S, TWd), oy = fmod(vy * (t + 30) * S, THd);
        let ix = Math.floor(ox), iy = Math.floor(oy), px = Math.round((ox - ix) * 2), py = Math.round((oy - iy) * 4);
        if (px === 2) { ix++; px = 0; }
        if (py === 4) { iy++; py = 0; }
        const tex = snowTile(k, px, py);
        g.setTransform(1, 0, 0, 1, Math.round(B.e), Math.round(B.f));
        for (let X = ix - TWd; X < sw; X += TWd) for (let Y = iy - THd; Y < sh; Y += THd) g.drawImage(tex, X, Y);
      });
      g.globalAlpha = 1; g.setTransform(B);
    }
    function midSnow(g, B, cam, t, D, dens, near, tDu) {
      setT(g, B, cam);
      const sp = dot('#f7f9fb', near ? 0.35 : 0.5);
      const n = near ? 18 : 110, span = H + 80, wid = W + 120;
      for (let i = 0; i < n; i++) {
        const sd = (near ? 5000 : 3000) + i;
        const boost = near ? i >= 13 : i >= 72;
        let a = near ? 0.4 + 0.2 * h2(sd, 1) : 0.62 + 0.35 * h2(sd, 1);
        if (boost) a *= smooth((dens - 0.6 * h2(sd, 9)) / 0.4);
        if (!near && i >= 72) a *= 1 - smooth((t - tDu - 0.3 * h2(sd, 10)) / 0.4);   // 第1句第12字后让出粒子名额给花瓣
        if (a < 0.01) continue;
        const vy = near ? 200 + 60 * h2(sd, 2) : 88 + 40 * h2(sd, 2), vx = near ? 160 + 50 * h2(sd, 3) : 70 + 32 * h2(sd, 3);
        const kd = near ? 300 : 170;
        const tt = t + 30;
        const x = fmod(h2(sd, 4) * wid - vx * tt - kd * D(t - dl(640)) + 7 * Math.sin(tt * (0.7 + 0.6 * h2(sd, 5)) + 6 * h2(sd, 6)), wid) - 60;
        const y = fmod(h2(sd, 7) * span + vy * tt, span) - 40;
        const rr = near ? 6 + 6 * h2(sd, 8) : 1.6 + 1.9 * h2(sd, 8);
        if (y < 140) a *= near ? 0.3 : 0.55;   // 歌词区里淡一些
        g.globalAlpha = a;
        g.drawImage(sp, x - rr, y - rr, rr * 2, rr * 2);
      }
      g.globalAlpha = 1;
    }
    // 前景的枯灌木：离镜头近而虚（建缓存时模糊），细枝硬折，枝背挂雪；整丛随风势斜切轻摆
    const grassSpr = (k) => K.cache('f8:grass2' + k, 240, 120, 1, (g) => {
      blurInto(g, 240, 120, 0.9, (b) => {
        const r = A.rng(7700 + k);
        b.lineCap = 'round'; b.lineJoin = 'round';
        // 先定枝形：硬折的细枝，根部粗、梢头细
        const segs = [];
        const twig = (x, y, a, len, w, d) => {
          let px = x, py = y;
          const n = 2 + (r() * 2 | 0);
          for (let i = 0; i < n; i++) {
            a += (r() - 0.5) * 0.7; a += (-Math.PI / 2 - 0.25 - a) * 0.2;
            const L = len / n, nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
            const w0 = Math.max(0.55, w * (1 - i / (n + 1))), w1 = Math.max(0.5, w * (1 - (i + 1) / (n + 1)));
            segs.push({ x0: px, y0: py, x1: nx, y1: ny, w0, w1, d, a });
            if (d < 2 && r() < 0.7) twig(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + 0.4 * r()), len * 0.55, w1 * 0.85, d + 1);
            px = nx; py = ny;
          }
        };
        const n = k ? 5 : 3;
        for (let i = 0; i < n; i++) twig(120 + (r() - 0.5) * 44, 114, -Math.PI / 2 + (r() - 0.6) * 1.0, (k ? 60 : 44) + 30 * r(), 3.0, 0);
        // 几茎枯草，顺风向左弯
        for (let i = 0; i < 9; i++) {
          const x = 120 + (r() - 0.5) * 70, h = 16 + 22 * r(), lean = -(0.25 + 0.35 * r());
          b.strokeStyle = `rgba(92,90,88,${0.45 + 0.25 * r()})`; b.lineWidth = 0.7 + 0.4 * r();
          b.beginPath(); b.moveTo(x, 114); b.quadraticCurveTo(x + lean * h * 0.3, 114 - h * 0.6, x + lean * h, 114 - h); b.stroke();
        }
        // 枝：墨色由根部的浓到梢头的淡；每段用梯形画出粗细渐变
        for (const sg of segs) {
          const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          b.fillStyle = sg.d === 0 ? '#383a42' : sg.d === 1 ? '#45474f' : '#53565e';
          b.beginPath();
          b.moveTo(sg.x0 + nx * sg.w0 / 2, sg.y0 + ny * sg.w0 / 2); b.lineTo(sg.x1 + nx * sg.w1 / 2, sg.y1 + ny * sg.w1 / 2);
          b.lineTo(sg.x1 - nx * sg.w1 / 2, sg.y1 - ny * sg.w1 / 2); b.lineTo(sg.x0 - nx * sg.w0 / 2, sg.y0 - ny * sg.w0 / 2); b.closePath(); b.fill();
          b.beginPath(); b.arc(sg.x1, sg.y1, sg.w1 / 2, 0, TAU); b.fill();
        }
        // 枝背上的雪：较平的枝上一道，枝杈处一小团
        for (const sg of segs) {
          const hz = Math.abs(Math.cos(sg.a));
          if (hz < 0.55 || sg.w1 < 0.6) continue;
          // 沿枝的上侧法线方向贴一道
          const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, L = Math.hypot(dx, dy) || 1;
          let nx = -dy / L, ny = dx / L;
          if (ny > 0) { nx = -nx; ny = -ny; }
          const o0 = sg.w0 / 2 + 0.5, o1 = sg.w1 / 2 + 0.4;
          b.strokeStyle = 'rgba(246,248,250,0.96)'; b.lineWidth = 0.9 + 1.1 * hz;
          b.beginPath(); b.moveTo(sg.x0 + nx * o0, sg.y0 + ny * o0); b.lineTo(sg.x1 + nx * o1, sg.y1 + ny * o1); b.stroke();
        }
        // 根部埋在一小堆雪里
        const gr = b.createLinearGradient(0, 106, 0, 119);
        gr.addColorStop(0, '#f7f9fa'); gr.addColorStop(0.6, '#eef1f4'); gr.addColorStop(1, 'rgba(234,238,242,0)');
        b.fillStyle = gr;
        b.beginPath(); b.ellipse(120, 113.5, 32, 6.5, 0, 0, TAU); b.fill();
        b.fillStyle = 'rgba(150,163,182,0.18)';
        b.beginPath(); b.ellipse(134, 113, 18, 3, 0, Math.PI * 1.05, Math.PI * 1.95); b.fill();
      });
    });
    function grass(g, B, cam, t, gw) {
      for (const [k, bx, by] of [[0, 112, 686], [1, 1150, 700]]) {
        const bend = 0.05 + 0.12 * gw(t - dl(bx)) + 0.025 * Math.sin(t * 1.3 + k * 2) + 0.012 * Math.sin(t * 2.9 + k);
        setT(g, B, mul(cam, [1, 0, bend, 1, -bend * by, 0]));
        g.drawImage(grassSpr(k), bx - 120, by - 114, 240, 120);
      }
    }

    XYT.registerShot('f8_redplain', {
      name: '天地皆红', zone: 'top', night: false, text: '#2a2024', shadow: 'rgba(240,236,234,0.82)', accent: '#c41f2f', bloom: 0.22,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        const e = events(c), M = getM(e), D = M.D;
        const B = g.getTransform();
        // 镜头：整镜 1.00 → 1.07 缓推；远景视差慢、近景快
        const Z = 1 + 0.07 * smooth((t + 0.7) / (dur + 0.7));
        const cam = (k) => { const z = 1 + (Z - 1) * k; return [z, 0, 0, z, CAM[0] * (1 - z), CAM[1] * (1 - z)]; };
        const C1 = cam(1);
        const dens = smooth((t - e.bai) / Math.max(0.5, e.fei - e.bai));
        // 天空与远景
        g.setTransform(B); g.drawImage(bgLayer(), -60, -40, W + 120, 560);
        farSnow(g, B, t, D, dens);
        setT(g, B, C1); g.drawImage(groundLayer(), -60, HOR - 6, W + 120, H - HOR + 60);
        const MS = M.mats(t);
        // 花瓣（按景深分三档：树后、树与人之间、人前）
        const petals = (zMin, zMax) => {
          const ps = petalSpr(0), fl = flowerSpr();
          for (let i = 0; i < M.P.length; i++) {
            const p = M.P[i];
            if (p.z <= zMin || p.z > zMax || t < p.b) continue;
            const s = t - p.b;
            let x, y, rot, sx, sy, a = smooth(s / 0.3);
            const flip = (v) => { const f = Math.cos(p.wf * v + p.pf); return Math.sign(f || 1) * Math.max(0.22, Math.abs(f)); };
            if (s >= p.tl) { // 落在雪上：0.18 秒里转平、贴地（地面透视压扁）
              const v = s - p.tl, u = smooth(v / 0.18), fL = flip(p.tl);
              x = p.lx2; y = p.yg;
              rot = p.rot + p.spin * p.tl + p.spin * 0.06 * (1 - Math.exp(-v / 0.06));
              sx = lerp(fL, Math.sign(fL), u); sy = 1 - 0.58 * u;
            } else {
              const q = petalPos(p, t, D); x = q[0]; y = q[1];
              rot = p.rot + p.spin * s;
              sx = flip(s); sy = 1;
            }
            if (x < -30 || x > W + 30 || y > H + 20) continue;
            if (y < 150) a *= 0.35 + 0.65 * smooth((y - 90) / 60);   // 歌词区里小而淡
            const sz = p.size * (y < 150 ? 0.8 : 1);
            g.globalAlpha = a;
            const Mg = mul(C1, trs(x, y, 0, 1, sy));
            if (p.whole) { setT(g, B, mul(Mg, trs(0, 0, rot, sz / 10 * sx, sz / 10))); g.drawImage(fl, -10, -10, 20, 20); }
            else { setT(g, B, mul(Mg, trs(0, 0, rot, sz / 7 * sx, sz / 7))); g.drawImage(p.col < 0.6 ? ps : petalSpr(p.col < 0.85 ? 1 : 2), -8, -8, 16, 16); }
          }
          g.globalAlpha = 1;
        };
        petals(ZTREE + 0.2, 99);
        // 树
        setT(g, B, C1); g.drawImage(trunkLayer(), 320, 446, 220, 190);
        for (const id of ORDER) {
          const gp = G[id], m = mul(C1, MS[id]);
          setT(g, B, m);
          let k = 0;
          while (k < gp.sws.length && gp.sws[k] <= t) k++;
          // 枝后的花正在褪霜时才分两层画（霜要在枝的后面）；否则画合成的一张
          let split = false;
          if (k > 0) for (const cl of gp.clumps) if (cl.hbB.length && cl.sw <= t && t < frostEnd(cl)) { split = true; break; }
          for (let part = split ? 0 : 1; part < 2; part++) {
            g.drawImage(grpState(gp, k, e.key, split ? part : 2), gp.box[0], gp.box[1], gp.box[2], gp.box[3]);
            // 已从贴图里拿出的雪团：它盖着的花上的霜逐渐褪去
            if (k > 0) for (const cl of gp.clumps) {
              if (cl.sw > t || t >= frostEnd(cl)) continue;
              const L = part === 0 ? cl.hbB : cl.hbF;
              if (!L.length) continue;
              g.globalAlpha = frostA(cl, t);
              if (g.globalAlpha > 0.003) drawFrost(g, L);
            }
            g.globalAlpha = 1;
          }
          // 已从贴图里拿出、还挂在枝上的雪团
          if (k > 0) for (const cl of gp.clumps) {
            if (t >= cl.r || cl.sw > t) continue;
            let x = cl.x, y = cl.y, a = cl.a;
            if (cl.early >= 0) {
              const ts = t - (cl.r - 0.23);
              if (ts > 0) { const sd = slideDir(cl), s = 0.5 * 265 * ts * ts; x += sd[0] * s; y += sd[1] * s; a += (sd[0] > 0 ? 1 : -1) * 0.5 * (ts / 0.23) * (ts / 0.23); }
            }
            setT(g, B, mul(m, trs(x, y, a, cl.w / 40, cl.h / 26)));
            g.drawImage(clumpSpr(cl.v), -20, -19, 40, 26);
          }
          // 刚离枝的雪团：在本组的次序里再画一小会儿（大团照常下落；小团就地散开、淡去，由雪粉接替）
          if (k > 0) for (const cl of gp.clumps) {
            const s = t - cl.r;
            if (s < 0 || s >= XR) continue;
            if (isChunk(cl)) {
              const [x, y, a, kk, al] = coreXf(cl, s);
              g.globalAlpha = al; setT(g, B, mul(C1, trs(x, y, a, cl.w / 40 * kk, cl.h / 26 * kk)));
            } else {
              const x = fallX(cl, Math.min(s, 0.1)) - 70 * s, y = fallY(cl, Math.min(s, 0.1)) + 30 * s, kk = 1 + 0.25 * smooth(s / XR);
              g.globalAlpha = 1 - smooth(s / XR); setT(g, B, mul(C1, trs(x, y, cl.a + cl.th0, cl.w / 40 * kk, cl.h / 26 * kk)));
            }
            g.drawImage(clumpSpr(cl.v), -20, -19, 40, 26);
          }
          g.globalAlpha = 1;
        }
        // 落下的雪团、雪粉：雪粉画进 1/3 分辨率的暂存画布（本来就是虚的），最后合成一次；雪团本体按原分辨率画在上面
        const pf = puff(), PS = 1 / 3;
        let pg = null, PBm = null, bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
        const pbeg = () => {
          if (pg) return pg;
          const w = Math.ceil(W * B.a * PS), h = Math.ceil(H * B.a * PS);
          if (!PBUF) PBUF = document.createElement('canvas');
          if (PBUF.width !== w || PBUF.height !== h) { PBUF.width = w; PBUF.height = h; }
          pg = PBUF.getContext('2d');
          pg.setTransform(1, 0, 0, 1, 0, 0); pg.globalAlpha = 1; pg.globalCompositeOperation = 'source-over'; pg.clearRect(0, 0, w, h);
          PBm = { a: w / W, b: 0, c: 0, d: w / W, e: 0, f: 0 };
          return pg;
        };
        const box = (x0, y0, x1, y1) => { if (x0 < bx0) bx0 = x0; if (y0 < by0) by0 = y0; if (x1 > bx1) bx1 = x1; if (y1 > by1) by1 = y1; };
        const puffAt = (x, y, rx, ry, a) => {
          if (a < 0.004) return;
          const q = pbeg(); setT(q, PBm, C1); q.globalAlpha = a;
          q.drawImage(pf, x - rx, y - ry, 2 * rx, 2 * ry); box(x - rx, y - ry, x + rx, y + ry);
        };
        const cores = [], shd = dot('#8c98aa', 0.45);
        // 成片的雪粉：随抖落的雪团下坠，很快被风带向左，散开、沉降、淡去
        for (const em of M.EM) {
          const cl = em.cl;
          for (let j = 0; j < 2; j++) {
            const d = [0, 0.2][j], age = t - cl.r - d;
            if (age < 0 || age > 1.45) continue;
            const xe = fallX(cl, d), ye = fallY(cl, d);
            const x = xe - 45 * age - 150 * (D(t - dl(xe)) - D(cl.r + d - dl(xe))) + 10 * (h2(em.sd, j) - 0.5) * age;
            const y = ye + 55 * age + (160 + GRAV * d) * 0.4 * (1 - Math.exp(-age / 0.4));
            const R = em.w * (0.6 + 0.3 * j) + 34 * Math.pow(age, 0.6);
            const st = 1 + 1.1 * Math.exp(-age / 0.4);
            puffAt(x, y, R, R * st, 0.24 * smooth(age / 0.12) * (1 - smooth((age - 0.2) / 1.2)));
          }
        }
        for (const cl of CL) {
          if (t < cl.r) continue;
          const s = t - cl.r;
          if (s > cl.tl + 1.4) continue;
          const early = cl.early >= 0, chunk = isChunk(cl);
          // 小雪团一离枝就散成一小团粉；大团下坠中渐渐散小
          const life = lifeOf(cl);
          if (!chunk) {
            if (s > 0.45) continue;
            // 离枝的一刻就是一团白，随即散开、变淡
            const x = fallX(cl, Math.min(s, 0.1)) - 70 * s, y = fallY(cl, Math.min(s, 0.1)) + 30 * s;
            const R = 0.55 * cl.w + 18 * Math.pow(s, 0.6);
            puffAt(x, y - 0.25 * cl.h, R, R * 0.8, 0.85 * smooth(s / 0.07) * (1 - smooth(s / 0.45)));
            continue;
          }
          // 雪团身后的一串雪粉
          const step = early ? 0.06 : 0.12, plife = early ? 1.1 : 0.6;
          for (let te = step; te <= Math.min(s, life); te += step) {
            const age = s - te;
            if (age > plife) continue;
            const x0 = fallX(cl, te), y0 = fallY(cl, te);
            const x = x0 - 60 * age - 120 * (D(t - dl(x0)) - D(cl.r + te - dl(x0)));
            const y = y0 + 90 * 0.18 * (1 - Math.exp(-age / 0.18)) + 18 * age;
            const R = 2 + 0.3 * cl.w + 26 * Math.pow(age, 0.7);
            puffAt(x, y, R, R, 0.3 * (1 - age / plife) * smooth(age / 0.06));
          }
          if (s < life || (early && s < cl.tl + 0.5)) cores.push(cl);
          if (early && s > cl.tl - 0.06 && s < cl.tl + 0.5) { // 快落地时地上渐显一小片冷影，落地后随雪团一起淡去
            const age = s - cl.tl, rx = 0.42 * cl.w + 4;
            const sa = 0.25 * smooth((age + 0.06) / 0.07) * (1 - smooth(age / 0.5));
            if (sa > 0.004) {
              const x0 = fallX(cl, Math.min(s, cl.tl)) - 9 * (1 - Math.exp(-Math.max(0, age) / 0.075));
              setT(g, B, C1); g.globalAlpha = sa;
              g.drawImage(shd, x0 - rx, cl.yg - 0.3 * rx + 0.5, 2 * rx, 0.6 * rx);
              g.globalAlpha = 1;
            }
          }
          if (early && s >= cl.tl) { // 落地：贴地扬起一小团雪粉
            const age = s - cl.tl, x = fallX(cl, cl.tl) - 50 * age, R = (0.5 * cl.w + 4) * (1 + 3 * Math.pow(age, 0.6));
            puffAt(x, cl.yg - 2, R, R * 0.42, 0.4 * (1 - age / 1.4) * smooth(age / 0.05));
          }
        }
        if (pg) { // 合成雪粉：只拷贝用到的那一块
          const X0 = clamp(C1[0] * bx0 + C1[4] - 4, 0, W), X1 = clamp(C1[0] * bx1 + C1[4] + 4, 0, W);
          const Y0 = clamp(C1[3] * by0 + C1[5] - 4, 0, H), Y1 = clamp(C1[3] * by1 + C1[5] + 4, 0, H);
          if (X1 > X0 && Y1 > Y0) {
            const k = PBUF.width / W;
            g.setTransform(B); g.globalAlpha = 1;
            g.drawImage(PBUF, X0 * k, Y0 * k, (X1 - X0) * k, (Y1 - Y0) * k, X0, Y0, X1 - X0, Y1 - Y0);
          }
        }
        for (const cl of cores) { // 雪团本体
          const s = t - cl.r, early = cl.early >= 0, life = lifeOf(cl);
          const tilt = early ? (slideDir(cl)[0] > 0 ? 0.5 : -0.5) : 0;
          if (early && s >= cl.tl) { // 落在雪上：压扁成一小团，滑出一点，慢慢和雪地融成一片
            const age = s - cl.tl, u = smooth(age / 0.08), kE = 0.5;
            const x = fallX(cl, cl.tl) - 9 * (1 - Math.exp(-age / 0.075));
            const rotL = cl.a + cl.th0 + tilt + cl.spin * cl.tl;
            g.globalAlpha = 1 - smooth((age - 0.04) / 0.42);
            if (g.globalAlpha < 0.004) continue;
            setT(g, B, mul(C1, mul(trs(x, cl.yg, 0, 1 + 0.3 * u, 1 - 0.5 * u), trs(0, 0, rotL, cl.w / 40 * kE, cl.h / 26 * kE))));
            g.drawImage(clumpSpr(cl.v), -20, -19, 40, 26);
            continue;
          }
          const [x, y, a, k, al] = coreXf(cl, s);
          g.globalAlpha = al * smooth(s / XR);   // 最前面这一份渐显；组内那一份保证没被挡住的地方始终不透明
          if (g.globalAlpha < 0.004) continue;
          setT(g, B, mul(C1, trs(x, y, a, cl.w / 40 * k, cl.h / 26 * k)));
          g.drawImage(clumpSpr(cl.v), -20, -19, 40, 26);
        }
        g.globalAlpha = 1;
        petals(ZMAN, ZTREE + 0.2);
        // 人物：雪地上的接触阴影，脚下微陷
        setT(g, B, C1);
        const shg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        shg.addColorStop(0, 'rgba(96,108,126,0.42)'); shg.addColorStop(0.6, 'rgba(110,122,140,0.16)'); shg.addColorStop(1, 'rgba(110,122,140,0)');
        g.save(); g.translate(MAN.x + 6, MAN.y + 1); g.scale(46, 7); g.fillStyle = shg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
        XYT.sil.draw(g, 'old', 'standBack', MAN.x, MAN.y, MAN.h, t + 40, {
          facing: 1, wind: clamp(0.5 + 0.2 * M.gwSlow(t - dl(MAN.x))), windDir: -1,
          body: '#3b3f4a', rim: '#eef2f6', rimSide: -1, snow: 0.5,
        });
        setT(g, B, C1);
        g.fillStyle = 'rgba(229,233,237,0.9)';
        g.beginPath(); g.ellipse(MAN.x, MAN.y + 1.2, 17, 1.7, 0, 0, TAU); g.fill();
        petals(-99, ZMAN);
        // 中景雪、前景、近处大雪片
        midSnow(g, B, C1, t, D, dens, false, e.du);
        setT(g, B, cam(1.25)); g.drawImage(fgLayer(), -60, 600, W + 120, 140);
        grass(g, B, cam(1.25), t, M.gw);
        midSnow(g, B, cam(1.3), t, D, dens, true, e.du);
        // 色调：开头冷灰，满树红梅露出后转暖一点
        g.setTransform(B);
        const warm = 0.35 * smooth((t - e.du) / 0.9) + 0.65 * smooth((t - e.hong) / 1.3);
        if (warm > 0.004) { g.globalAlpha = warm; g.drawImage(warmTex(), 0, 0, W, H); g.globalAlpha = 1; }
      },
    });
  })();
})();
