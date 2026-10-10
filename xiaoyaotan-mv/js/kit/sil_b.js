/* 剪影人物（第三版 · 方案 B）：XYT.silB
 *
 * 每个姿势是一整块设计好的闭合剪影，不做关节骨架。
 * 设计坐标（“单位空间”）：人物站立身高 = 100 单位，原点是着地点，x 朝人物面向的一侧，y 向下。
 * 绘制流程：所有部件用实色画进离屏画布（同色重叠不出缝）→ 可选积雪（由剪影朝上的边自动生成）
 *          → 轮廓光（整块剪影先填轮廓光色，再把剪影向背光方向偏移后用原色盖住，只剩迎光一侧的细边）→ 合成。
 * 会动的只有挂在固定锚点上的头发、发带、袖口、下摆、披帛、斗篷边，用 2–3 个正弦叠加，wind = 0 时只剩呼吸。
 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- 颜色
  const parsed = new Map();
  function parse(c) {
    let v = parsed.get(c);
    if (v) return v;
    let r = 0, g = 0, b = 0;
    if (c[0] === '#') {
      const s = c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1, 7);
      const n = parseInt(s, 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = c.match(/[\d.]+/g) || [0, 0, 0];
      r = +m[0]; g = +m[1]; b = +m[2];
    }
    v = [r, g, b];
    parsed.set(c, v);
    return v;
  }
  function mixc(a, b, k) {
    const A = parse(a), B = parse(b);
    return `rgb(${Math.round(lerp(A[0], B[0], k))},${Math.round(lerp(A[1], B[1], k))},${Math.round(lerp(A[2], B[2], k))})`;
  }
  function rgba(c, a) { const A = parse(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; }

  const palettes = new Map();
  function palette(body, accent) {
    const key = body + '|' + (accent || '');
    let p = palettes.get(key);
    if (p) return p;
    p = {
      body,
      fold: mixc(body, '#ffffff', 0.075), // 极淡衣褶亮面（同色系）
      deep: mixc(body, '#000000', 0.3),
      hair: mixc(body, '#e8e5dd', 0.52), // 白发：介于剪影和白之间，亮底暗底都能读出来
      hairHi: mixc(body, '#f4f2ec', 0.68),
      straw: mixc(body, '#8a7a55', 0.16), // 蓑衣、斗笠：略带草色
      ribbon: accent || '#3f6fa6', // 少年蓝发带
      ribbonOld: accent || '#5a7591', // 老者旧蓝发带
      shawl: accent || '#e8b6bf', // 伊人淡粉披帛
      gourd: '#9b6a33',
      gourdHi: '#b98546',
      pin: '#c9a96b',
      wood: mixc(body, '#5a4632', 0.35),
    };
    palettes.set(key, p);
    return p;
  }

  // ---------------------------------------------------------------- 曲线
  // 向心 Catmull-Rom 转三次贝塞尔：点 [x, y, corner?, flutterWeight?]；corner 为真时该点是尖角
  function spline(p, pts, closed) {
    const n = pts.length;
    if (n < 2) return;
    const at = (i) => (closed ? pts[(i + n) % n] : pts[i < 0 ? 0 : i > n - 1 ? n - 1 : i]);
    p.moveTo(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1e-6;
      const l3 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      const d2 = Math.sqrt(l2);
      let c1x, c1y, c2x, c2y;
      if (p1[2] || l1 < 1e-6 || (!closed && i === 0)) { c1x = p1[0] + (p2[0] - p1[0]) / 3; c1y = p1[1] + (p2[1] - p1[1]) / 3; }
      else {
        const d1 = Math.sqrt(l1), a = d1 * d1, b = d2 * d2, k = 3 * d1 * (d1 + d2);
        c1x = (a * p2[0] - b * p0[0] + (2 * a + 3 * d1 * d2 + b) * p1[0]) / k;
        c1y = (a * p2[1] - b * p0[1] + (2 * a + 3 * d1 * d2 + b) * p1[1]) / k;
      }
      if (p2[2] || l3 < 1e-6 || (!closed && i === segs - 1)) { c2x = p2[0] + (p1[0] - p2[0]) / 3; c2y = p2[1] + (p1[1] - p2[1]) / 3; }
      else {
        const d3 = Math.sqrt(l3), a = d3 * d3, b = d2 * d2, k = 3 * d3 * (d3 + d2);
        c2x = (a * p1[0] - b * p3[0] + (2 * a + 3 * d3 * d2 + b) * p2[0]) / k;
        c2y = (a * p1[1] - b * p3[1] + (2 * a + 3 * d3 * d2 + b) * p2[1]) / k;
      }
      p.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
    if (closed) p.closePath();
  }
  // 静态点列：建一次 Path2D 反复用
  const ST = (a) => { a._st = 1; return a; };
  const pcache = new WeakMap();
  function pathOf(pts, closed) {
    if (pts._st) {
      const e = pcache.get(pts);
      if (e && e.closed === closed) return e.p;
    }
    const p = new Path2D();
    spline(p, pts, closed);
    if (pts._st) pcache.set(pts, { p, closed });
    return p;
  }
  // 模板变换：先旋转 ang、缩放 s，再平移到 (ox, oy)；保留尖角标记与飘动权重
  function X(pts, ox, oy, s = 1, ang = 0, sx = 1) {
    const c = Math.cos(ang), n = Math.sin(ang);
    const r = pts.map((q) => { const x = q[0] * s * sx, y = q[1] * s; return [ox + x * c - y * n, oy + x * n + y * c, q[2], q[3]]; });
    if (pts._st) r._st = 1;
    return r;
  }
  const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };

  // ---------------------------------------------------------------- 二次运动
  // 2–3 个频率叠加的平滑摆动，值域约 [-1, 1]；频率 0.3–1.2 Hz
  function sw(t, ph) {
    return 0.55 * Math.sin(TAU * 0.53 * t + ph) + 0.3 * Math.sin(TAU * 0.89 * t + 1.7 * ph + 0.5) + 0.15 * Math.sin(TAU * 1.17 * t + 2.3 * ph + 1.1);
  }

  // ---------------------------------------------------------------- 离屏画布
  // 按尺寸分档复用：画布只比需要的大一点（把整张画布当图源时，浏览器会按画布实际大小做快照）
  const pool = new Map();
  function buf(i, w, h) {
    const bw = Math.ceil(w / 32) * 32, bh = Math.ceil(h / 32) * 32, key = i + ':' + bw + 'x' + bh;
    let b = pool.get(key);
    if (!b) {
      const cv = document.createElement('canvas');
      cv.width = bw; cv.height = bh;
      b = { cv, c: cv.getContext('2d') };
      if (pool.size > 48) pool.delete(pool.keys().next().value);
    } else pool.delete(key);
    pool.set(key, b); // 最近使用的放到最后
    b.c.setTransform(1, 0, 0, 1, 0, 0);
    b.c.globalCompositeOperation = 'source-over';
    b.c.globalAlpha = 1;
    b.c.clearRect(0, 0, bw, bh);
    return b;
  }

  // ---------------------------------------------------------------- 画笔
  // 每帧一个，部件都画到离屏剪影上；需要积雪时同步画进积雪遮罩
  function makePainter(c, sc, k) {
    const P = {
      c, sc, t: k.t, col: k.col, w: k.wind, wl: k.wl, px: k.px, h: k.h,
      fill(pts, col, snow = true) {
        const p = pathOf(pts, true);
        c.fillStyle = col || P.col.body; c.fill(p);
        if (snow && sc) sc.fill(p);
      },
      poly(pts, col, snow = true) {
        const p = new Path2D();
        p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
        p.closePath();
        c.fillStyle = col || P.col.body; c.fill(p);
        if (snow && sc) sc.fill(p);
      },
      ell(x, y, rx, ry, a, col, snow = true) {
        c.beginPath(); c.ellipse(x, y, rx, ry, a || 0, 0, TAU); c.fillStyle = col || P.col.body; c.fill();
        if (snow && sc) { sc.beginPath(); sc.ellipse(x, y, rx, ry, a || 0, 0, TAU); sc.fill(); }
      },
      // 圆头描边（竿、剑、细绳）；宽度不小于 0.8 设备像素
      line(pts, wd, col, snow = false, closed = false) {
        const p = pathOf(pts, closed);
        c.lineWidth = Math.max(wd, 0.8 / P.px); c.lineCap = 'round'; c.lineJoin = 'round';
        c.strokeStyle = col || P.col.body; c.stroke(p);
        if (snow && sc) { sc.lineWidth = c.lineWidth; sc.lineCap = 'round'; sc.stroke(p); }
      },
      seg(x0, y0, x1, y1, wd, col, snow = false) { P.line([[x0, y0], [x1, y1]], wd, col, snow); },
      // 变宽带子：中心线 cl，宽度函数 wf(u)；尾端圆收
      strip(cl, wf, col, snow = false) {
        const n = cl.length, L = [], R = [];
        for (let i = 0; i < n; i++) {
          const a = cl[Math.max(0, i - 1)], b = cl[Math.min(n - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1];
          const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          const w = Math.max(wf(i / (n - 1)), 0.45 / P.px) / 2;
          L.push([cl[i][0] - ty * w, cl[i][1] + tx * w, i === 0]);
          R.push([cl[i][0] + ty * w, cl[i][1] - tx * w, i === 0]);
        }
        const e = cl[n - 1], e0 = cl[n - 2];
        const ex = e[0] - e0[0], ey = e[1] - e0[1], el = Math.hypot(ex, ey) || 1;
        const wt = Math.max(wf(1), 0.45 / P.px) * 0.45;
        const tip = [e[0] + (ex / el) * wt, e[1] + (ey / el) * wt];
        P.fill(L.concat([tip], R.reverse()), col, snow);
      },
      // 同色系明暗：只画在已有剪影内
      shade(fn) {
        c.globalCompositeOperation = 'source-atop';
        fn(c);
        c.globalCompositeOperation = 'source-over';
      },
      group(tx, ty, a, fn, s = 1) {
        c.save(); c.translate(tx, ty); if (a) c.rotate(a); if (s !== 1) c.scale(s, s);
        if (sc) { sc.save(); sc.translate(tx, ty); if (a) sc.rotate(a); if (s !== 1) sc.scale(s, s); }
        fn();
        c.restore(); if (sc) sc.restore();
      },
      sw: (ph, tt) => sw(tt == null ? k.t : tt, ph),
      // 飘动：点的第 4 个分量是权重（根部 0，末端 1）；顺风偏移 + 正弦起伏
      flut(pts, amp, ph = 0, lift = 0) {
        if (!P.w) return pts;
        const wl = P.wl, t = P.t;
        return pts.map((q) => {
          const wg = q[3];
          if (!wg) return q;
          const s = sw(t - wg * 0.35, ph + q[1] * 0.045);
          const dx = wg * amp * wl * (0.62 + 0.38 * s);
          const dy = -wg * lift * Math.abs(wl) * (0.7 + 0.3 * s);
          return [q[0] + dx, q[1] + dy, q[2], wg];
        });
      },
      // 链条：发带、发尾、穗子。根 (x, y)，长 len，段数 n。
      // o.a0 根部方向（弧度，0 = 竖直向下，正 = 朝人物前方），o.lift 风把它吹起的最大角度，o.amp 摆幅（弧度），o.ph 相位，o.curl 自然弯
      chain(x, y, len, n, o) {
        const pts = [[x, y]];
        const wl = P.wl, t = P.t, aw = clamp(wl, -1, 1) * (o.lift == null ? 1.1 : o.lift);
        const g = o.grav == null ? 1 : o.grav;
        let px = x, py = y;
        for (let i = 1; i <= n; i++) {
          const u = i / n;
          const rest = lerp(o.a0 || 0, (o.a1 || 0), Math.pow(u, 0.7) * g);
          const blow = aw * smooth(Math.min(1, u * 1.6 + 0.15));
          const amp = (o.amp == null ? 0.35 : o.amp) * (Math.abs(wl) + (o.idle || 0)) * u;
          const a = rest + blow + amp * sw(t * (o.fq || 1) - u * (o.lag == null ? 0.55 : o.lag), (o.ph || 0)) + (o.curl || 0) * u + (o.rot || 0);
          px += (Math.sin(a) * len) / n; py += (Math.cos(a) * len) / n;
          pts.push([px, py]);
        }
        return pts;
      },
    };
    return P;
  }

  // ---------------------------------------------------------------- 姿势表
  const POSES = {}; // 'who.pose' -> { box: [l, t, r, b]（单位，面向右）, build(P, k) }
  const def = (who, pose, box, build, extra) => { POSES[who + '.' + pose] = Object.assign({ who, pose, box, build }, extra || {}); };

  // ================================================================ 头部模板（以头颈连接点为原点，面向右，单位同全身）
  // 少年侧脸：额、眉骨、鼻、唇、下巴，没有眼睛
  const HEAD_M = ST([
    [-2.9, -0.4], [-4.6, -3.2], [-5.25, -6.2], [-4.6, -9.0], [-2.6, -10.8], [0.3, -11.45], [2.9, -10.85],
    [4.55, -9.0], [5.25, -6.95], [5.55, -5.8], [5.3, -5.15], [5.85, -3.85], [6.55, -2.85, 1], [5.85, -2.35],
    [5.95, -1.65], [5.6, -1.25], [5.75, -0.8], [5.3, -0.25], [5.5, 0.45], [5.05, 1.25], [3.6, 1.5], [2.2, 1.8],
    [1.6, 3.2], [-2.6, 3.0],
  ]);

  // ================================================================ 少年侠客
  // 侧影站：挺拔，长衫及踝，背剑，高马尾与两条蓝发带
  const Y_SIDE_BODY = [
    [1.5, -86.4], [2.5, -83.9], [4.3, -82.0], [6.0, -78.8], [6.5, -74.0], [5.7, -68.2], [5.0, -63.6],
    [5.6, -59.0], [6.2, -50, 0, 0.05], [6.8, -36, 0, 0.16], [7.6, -21, 0, 0.4], [8.6, -5.2, 1, 0.8],
    [0.2, -4.4, 0, 0.9], [-8.8, -4.6, 1, 1], [-8.4, -18, 0, 0.6], [-7.6, -33, 0, 0.3], [-7.1, -45, 0, 0.1], [-7.2, -52.5],
    [-5.9, -60.6], [-5.5, -66.5], [-5.9, -73.5], [-5.6, -79.6], [-4.8, -83.4], [-3.7, -86.2], [-3.0, -88.6],
  ];
  const Y_SIDE_ARM = ST([
    [-3.8, -83.2], [-0.6, -84.4], [2.6, -83.0], [3.9, -79.0], [3.7, -71.0], [3.5, -65.6], [5.0, -59.5],
    [6.8, -53.4, 1], [3.6, -51.6], [0.2, -50.8, 1], [-1.0, -55.5], [-3.0, -62.5], [-4.0, -69], [-4.4, -77.0],
  ]);
  const Y_SIDE_HAND = ST([
    [1.6, -52.4], [5.6, -53.0], [6.6, -49.8], [6.4, -46.5], [5.5, -43.6], [4.3, -42.9], [3.4, -44.2], [2.4, -47.4],
  ]);
  const BOOT_SIDE = ST([
    [-3.2, -6.0], [2.4, -6.0], [3.2, -4.0], [7.6, -2.5], [9.4, -1.3], [9.5, -0.2, 1], [-3.9, 0, 1], [-4.2, -2.4],
  ]);

  // 背剑（侧面）：剑柄在头后上方，剑鞘贴着背斜下，鞘尾露在臀后
  function swordSide(P, x0, y0, x1, y1, tassel, empty) {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const gx = x0 + ux * 8.2, gy = y0 + uy * 8.2; // 护手
    if (empty) { // 剑已出鞘：只剩剑鞘，鞘口略宽
      P.strip([[gx, gy], [lerp(gx, x1, 0.5), lerp(gy, y1, 0.5)], [x1, y1]], (u) => 2.1 - u * 0.5);
      return;
    }
    if (tassel) {
      const cl = P.chain(x0 - ux * 0.6, y0 - uy * 0.6, 7.0, 6, { a0: -0.5, lift: 1.0, amp: 0.3, ph: 2.1, idle: 0.05 });
      P.line(cl, 0.35, P.col.ribbon);
      const e = cl[cl.length - 1], e2 = cl[cl.length - 3];
      P.strip([e2, e, [e[0] + (e[0] - e2[0]) * 0.8, e[1] + (e[1] - e2[1]) * 0.8]], (u) => 0.6 + u * 1.0, P.col.ribbon);
    }
    P.line([[x0, y0], [gx, gy]], 1.2);
    P.ell(x0, y0, 0.8, 0.8, 0);
    P.line([[gx - uy * 1.9, gy + ux * 1.9], [gx + uy * 1.9, gy - ux * 1.9]], 1.05);
    P.strip([[gx, gy], [lerp(gx, x1, 0.5), lerp(gy, y1, 0.5)], [x1, y1]], (u) => 1.9 - u * 0.3);
  }
  // 衣褶与手臂的内轮廓：极淡的同色亮线，只画在剪影内
  function folds(P, lines, wd) {
    P.shade((c) => {
      c.strokeStyle = P.col.fold; c.lineCap = 'round'; c.lineJoin = 'round';
      c.lineWidth = Math.max(wd || 0.45, 0.7 / P.px);
      for (const l of lines) c.stroke(pathOf(l, false));
    });
  }
  const Y_SIDE_FOLDS = [
    ST([[-3.6, -74], [-3.4, -66], [-2.0, -58.5], [-0.2, -51.6]]),
    ST([[1.0, -46], [1.6, -30], [2.2, -12], [2.4, -6]]),
    ST([[-4.2, -44], [-4.8, -28], [-5.4, -10]]),
  ];

  def('youth', 'standSide', [-26, -112, 22, 4], (P) => {
    const C = P.col;
    // 身后：发尾、发带
    const tail = P.chain(-3.3, -100.6, 19, 9, { a0: -1.6, a1: -0.1, lift: 0.85, amp: 0.22, ph: 0.3, idle: 0.04 });
    P.strip(tail, (u) => 3.6 * Math.sin(Math.PI * Math.min(1, 0.3 + u * 0.7)) + 0.5, C.deep);
    const r1 = P.chain(-2.4, -100.8, 22, 9, { a0: -1.2, a1: -0.15, lift: 1.2, amp: 0.4, ph: 1.4, idle: 0.04 });
    const r2 = P.chain(-2.6, -100.4, 18, 8, { a0: -0.9, a1: 0.05, lift: 1.1, amp: 0.45, ph: 3.0, idle: 0.04 });
    P.strip(r2, (u) => 1.2 - u * 0.3, C.ribbon);
    P.strip(r1, (u) => 1.3 - u * 0.3, C.ribbon);
    // 背剑
    swordSide(P, -6.3, -99.2, -9.4, -49.5, true);
    // 身体与头
    P.fill(P.flut(Y_SIDE_BODY, 6, 0.4, 0.8));
    P.fill(X(HEAD_M, -0.25, -88.4));
    // 头发：额顶到后脑多出一层发量，发髻在头顶偏后
    P.fill(ST([[2.7, -99.9], [0.4, -100.6], [-2.6, -100.1], [-4.8, -98.0], [-5.8, -94.8], [-5.2, -91.8], [-3.6, -92.6], [-0.5, -97.4]]), C.deep);
    P.ell(-2.5, -101.1, 1.9, 1.5, -0.35, C.deep);
    P.line([[-3.9, -100.3], [-2.6, -100.9], [-1.3, -101.6]], 1.0, C.ribbon);
    P.fill(Y_SIDE_ARM);
    P.fill(Y_SIDE_HAND);
    P.fill(BOOT_SIDE);
    // 腰带与衣褶
    P.shade((c) => { c.fillStyle = C.fold; c.fillRect(-7, -64.6, 14, 2.2); });
    folds(P, Y_SIDE_FOLDS);
  });

  // 背影（少年）：宽肩窄腰，双臂自然垂在身侧，手臂与腰之间留一道细缝；长衫下摆略外扩
  const Y_BACK_BODY = [
    [0, -88.4], [2.4, -88.2], [2.7, -85.9], [5.8, -84.6], [9.4, -83.3], [11.8, -82.0], [12.9, -79.6],
    [13.1, -74.5], [12.8, -68.0], [12.5, -62.5], [12.3, -57.0], [12.9, -52.6, 1], [10.5, -51.6, 1], [10.5, -56.5],
    [10.4, -63.0], [10.0, -70.5, 1], [9.0, -64.0], [9.7, -56.0, 0, 0.05], [11.1, -42, 0, 0.2], [12.5, -24, 0, 0.5], [13.9, -5.0, 1, 0.85],
    [7.0, -4.3, 0, 0.9], [0, -4.6, 0, 0.9], [-7.0, -4.3, 0, 0.9], [-13.9, -5.0, 1, 0.85], [-12.5, -24, 0, 0.5], [-11.1, -42, 0, 0.2], [-9.7, -56.0, 0, 0.05],
    [-9.0, -64.0], [-10.0, -70.5, 1], [-10.4, -63.0], [-10.5, -56.5], [-10.5, -51.6, 1], [-12.9, -52.6, 1], [-12.3, -57.0],
    [-12.5, -62.5], [-12.8, -68.0], [-13.1, -74.5], [-12.9, -79.6], [-11.8, -82.0], [-9.4, -83.3], [-5.8, -84.6], [-2.7, -85.9], [-2.4, -88.2],
  ];
  const Y_BACK_HEAD = ST([
    [0, -100.4], [3.0, -99.6], [4.7, -97.2], [5.15, -94.2], [5.45, -92.6], [5.15, -90.6], [4.2, -89.6], [3.0, -88.2],
    [-3.0, -88.2], [-4.2, -89.6], [-5.15, -90.6], [-5.45, -92.6], [-5.15, -94.2], [-4.7, -97.2], [-3.0, -99.6],
  ]);
  const Y_BACK_HANDS = [
    ST([[10.6, -52.6], [12.6, -52.8], [12.8, -49.4], [12.4, -46.2], [11.5, -43.9], [10.6, -44.6], [10.2, -48.0]]),
    ST([[-10.6, -52.6], [-12.6, -52.8], [-12.8, -49.4], [-12.4, -46.2], [-11.5, -43.9], [-10.6, -44.6], [-10.2, -48.0]]),
  ];
  const BOOTS_BACK = ST([[-6.0, -6.0], [-2.2, -6.0], [-1.9, -2.0], [-1.7, 0, 1], [-6.5, 0, 1], [-6.3, -2.4]]);
  const BOOTS_BACK2 = ST([[2.2, -6.0], [6.0, -6.0], [6.3, -2.4], [6.5, 0, 1], [1.7, 0, 1], [1.9, -2.0]]);
  const Y_BACK_FOLDS = [
    ST([[0, -82], [0, -64]]),
    ST([[-3.2, -60], [-4.4, -34], [-5.6, -6]]),
    ST([[3.0, -60], [4.2, -34], [5.4, -6]]),
    ST([[-8.6, -46], [-10.4, -20]]), ST([[8.6, -46], [10.2, -20]]),
  ];
  // 背剑（背面）：剑柄从右肩后探出，剑鞘斜过后背，鞘尾露在左臀外侧
  function swordBack(P, x0, y0, x1, y1, tassel, tone) {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    const gx = x0 + ux * 8.2, gy = y0 + uy * 8.2;
    if (tassel) {
      const cl = P.chain(x0 - ux * 0.6, y0 - uy * 0.6, 7.0, 6, { a0: 0.5, lift: 1.0, amp: 0.3, ph: 2.1, idle: 0.05 });
      P.line(cl, 0.35, P.col.ribbon);
      const e = cl[cl.length - 1], e2 = cl[cl.length - 3];
      P.strip([e2, e, [e[0] + (e[0] - e2[0]) * 0.8, e[1] + (e[1] - e2[1]) * 0.8]], (u) => 0.6 + u * 1.0, P.col.ribbon);
    }
    P.line([[x0, y0], [gx, gy]], 1.2);
    P.ell(x0, y0, 0.8, 0.8, 0);
    P.line([[gx - uy * 1.9, gy + ux * 1.9], [gx + uy * 1.9, gy - ux * 1.9]], 1.05);
    P.strip([[gx, gy], [lerp(gx, x1, 0.5), lerp(gy, y1, 0.5)], [x1, y1]], (u) => 1.9 - u * 0.3, tone);
  }

  // 少年背影的部件；pair 里复用（sl：剑柄在左肩）
  function youthBack(P, sl) {
    const C = P.col, m = sl ? -1 : 1;
    P.fill(BOOTS_BACK); P.fill(BOOTS_BACK2);
    P.fill(P.flut(Y_BACK_BODY, 4.5, 0.2, 0.6));
    P.fill(Y_BACK_HEAD, C.deep);
    for (const hnd of Y_BACK_HANDS) P.fill(hnd);
    // 背后的剑：剑鞘在背上用极淡的亮色勾出来
    swordBack(P, 7.6 * m, -99.6, -14.6 * m, -50.0, true);
    P.shade((c) => {
      c.fillStyle = C.fold; c.fillRect(-11, -64.8, 22, 2.2);
    });
    folds(P, Y_BACK_FOLDS);
    backScabbard(P, 5.9 * m, -90.6, -13.2 * m, -53.0);
    // 头顶发髻、马尾、发带：马尾垂在后颈与上背，发带两尾顺风飘
    P.ell(0, -101.3, 2.1, 1.7, 0, C.deep);
    const tail = P.chain(0, -101.0, 21, 9, { a0: 0.12, a1: 0.0, lift: 0.5, amp: 0.2, ph: 0.3, idle: 0.04 });
    P.strip(tail, (u) => 3.4 * Math.sin(Math.PI * Math.min(1, 0.32 + u * 0.68)) + 0.5, C.deep);
    const r1 = P.chain(-0.9, -101.2, 19, 9, { a0: -0.25, a1: -0.08, lift: 1.2, amp: 0.45, ph: 1.4, idle: 0.04 });
    const r2 = P.chain(0.9, -101.0, 15, 8, { a0: 0.3, a1: 0.1, lift: 1.1, amp: 0.5, ph: 3.0, idle: 0.04 });
    P.strip(r2, (u) => 1.2 - u * 0.3, C.ribbon);
    P.strip(r1, (u) => 1.3 - u * 0.3, C.ribbon);
    P.line([[-2.0, -100.4], [0, -100.0], [2.0, -100.4]], 1.0, C.ribbon);
  }
  def('youth', 'standBack', [-30, -112, 30, 4], (P) => youthBack(P, false));

  // ================================================================ 伊人
  // 侧脸：额头圆润、鼻小、唇略丰、下巴小巧
  const HEAD_F = ST([
    [-2.6, -0.2], [-4.3, -3.0], [-4.85, -6.1], [-4.25, -8.9], [-2.4, -10.6], [0.4, -11.2], [2.9, -10.55],
    [4.4, -8.7], [4.95, -6.7], [5.1, -5.65], [4.92, -5.05], [5.4, -3.95], [5.95, -3.05, 1], [5.3, -2.6],
    [5.5, -1.95], [5.2, -1.55], [5.35, -1.1], [4.95, -0.6], [5.05, 0.1], [4.45, 0.85], [3.2, 1.0], [2.0, 1.35],
    [1.4, 2.8], [-2.3, 2.8],
  ]);
  // 侧影：齐胸襦裙，高腰带在胸下，裙摆及地带小拖尾；双手交叠在腹前，广袖从小臂垂成大弧
  const F_SIDE_BODY = [
    [1.6, -85.6], [2.1, -83.4], [3.4, -81.4], [5.3, -77.8], [5.4, -74.6], [4.5, -72.4], [4.4, -69.6],
    [5.2, -62], [6.2, -46, 0, 0.1], [7.4, -27, 0, 0.35], [8.8, -9, 0, 0.7], [9.9, -1.4, 0, 0.85], [10.3, 0, 1, 0.9],
    [0, 0, 0, 0.9], [-11.2, 0, 0, 1], [-14.2, 0.1, 1, 1], [-12.0, -3.2, 0, 1], [-10.0, -16, 0, 0.7], [-8.6, -32, 0, 0.4], [-7.3, -47, 0, 0.15],
    [-6.6, -56], [-6.0, -64], [-4.6, -70.5], [-4.8, -76.5], [-4.7, -80.8], [-3.6, -84.4], [-2.3, -88.4],
  ];
  const F_SIDE_UPPERARM = ST([[-3.6, -82.4], [0.4, -83.0], [2.2, -80.0], [2.0, -73.0], [1.2, -66.5], [-2.0, -64.0], [-4.0, -67.0], [-4.3, -75.0]]);
  // 广袖：上沿顺着小臂，袖口在手前垂下，下沿是一道饱满的弧
  const F_SIDE_SLEEVE = [
    [-3.6, -68.6, 1], [0.5, -68.0], [4.8, -67.2], [8.4, -66.9], [9.6, -65.8, 1], [10.6, -60.5, 0, 0.3], [11.4, -53.5, 0, 0.6],
    [11.0, -47.4, 0, 0.85], [8.6, -43.6, 0, 1], [4.4, -42.6, 0, 1], [0.6, -44.0, 0, 0.9], [-2.6, -48.4, 0, 0.65], [-4.2, -55.0, 0, 0.35], [-4.6, -62.0, 0, 0.1],
  ];
  const F_SIDE_HANDS = ST([[7.4, -67.4], [9.6, -67.6], [10.6, -66.2], [10.4, -64.4], [9.0, -63.6], [7.2, -64.4]]);
  const F_SIDE_SHOE = ST([[7.6, -1.2], [10.6, -1.6], [12.2, -1.2], [12.9, -0.6, 1], [12.2, 0, 1], [7.6, 0, 1]]);
  const F_SIDE_FOLDS = [
    ST([[1.2, -68], [1.6, -56], [2.0, -46]]), ST([[2.2, -45], [3.0, -26], [3.6, -4]]),
    ST([[-2.4, -50], [-3.6, -30], [-5.0, -6]]), ST([[5.8, -42], [6.8, -22], [7.8, -4]]),
  ];

  def('heroine', 'standSide', [-40, -112, 26, 4], (P) => {
    const C = P.col;
    // 身后：披帛远端垂在背后、长发
    const sh2 = P.chain(-4.2, -62.0, 46, 11, { a0: -0.08, a1: 0.02, lift: 0.75, amp: 0.3, ph: 2.2, idle: 0.04, lag: 0.7 });
    P.strip(sh2, (u) => 2.3 - 0.5 * u + 0.5 * Math.sin(u * 9), C.shawl);
    const hair = P.flut([
      [0.8, -100.9], [-2.4, -100.3], [-4.9, -98.2], [-6.0, -94.6], [-6.0, -90.6, 0, 0.05], [-5.8, -86.0, 0, 0.12],
      [-6.9, -80.0, 0, 0.3], [-7.6, -72.0, 0, 0.6], [-7.6, -65.5, 0, 0.85], [-6.9, -60.8, 1, 1], [-5.8, -62.6, 0, 0.9],
      [-4.6, -66.0, 0, 0.6], [-4.3, -74.0, 0, 0.3], [-3.6, -82.0], [-2.0, -88.0], [0.2, -95.0], [2.4, -99.2],
    ], 5.5, 0.9, 1.2);
    P.fill(hair, C.deep);
    // 身体
    P.fill(P.flut(F_SIDE_BODY, 4.2, 0.4, 0.6));
    P.fill(X(HEAD_F, 0.35, -88.8));
    P.fill(ST([[2.8, -99.8], [0.6, -100.9], [-2.6, -100.4], [-4.8, -98.2], [-5.6, -94.6], [-5.1, -91.0], [-3.4, -92.2], [-0.8, -96.6], [1.6, -98.6]]), C.deep);
    // 发髻与发簪（簪头一点金色，垂一粒小坠）
    P.ell(-4.4, -97.4, 2.6, 2.1, -0.5, C.deep);
    P.line([[-2.4, -95.6], [-8.6, -101.2]], 0.42, C.pin);
    const dang = P.chain(-8.0, -100.7, 2.6, 3, { a0: 0, lift: 0.8, amp: 0.4, ph: 0.4, idle: 0.1 });
    P.line(dang, 0.22, C.pin);
    P.ell(dang[3][0], dang[3][1], 0.45, 0.6, 0, C.pin, false);
    P.fill(F_SIDE_SHOE);
    P.fill(F_SIDE_UPPERARM);
    P.fill(P.flut(F_SIDE_SLEEVE, 2.2, 1.7, 0.4));
    P.fill(F_SIDE_HANDS);
    // 披帛：从肩后绕过背、搭在小臂上，近端从手前垂下
    P.strip([[0.6, -84.0], [-1.6, -81.0], [-3.4, -75.0], [-4.0, -69.5], [-3.0, -66.4], [0.6, -67.2], [4.6, -68.4], [8.0, -68.2], [9.8, -66.8]],
      (u) => 1.7 + 0.7 * Math.sin(u * Math.PI), C.shawl);
    const sh1 = P.chain(10.0, -66.6, 46, 12, { a0: 0.08, a1: 0.03, lift: 0.3, amp: 0.2, ph: 0.6, idle: 0.04, lag: 0.7 });
    P.strip(sh1, (u) => 2.2 - 0.4 * u + 0.4 * Math.sin(u * 8 + 1), C.shawl);
    // 高腰带与衣褶
    P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-6, -72.6); c.lineTo(6, -73.4); c.lineTo(6, -71.0); c.lineTo(-6, -70.4); c.fill(); });
    folds(P, F_SIDE_FOLDS);
  });

  // 背影：长发及腰，发髻插簪；肩窄而斜；广袖在身侧垂成两片大弧；披帛在背后兜成一道弧，两端在袖外长垂
  const F_BACK_BODY = [
    [0, -86.0], [2.2, -86.0], [2.5, -84.6], [5.2, -83.2], [8.0, -81.8], [9.3, -80.0], [9.8, -76.6],
    [10.0, -71.0], [9.9, -66.5], [9.5, -64.5, 1], [8.0, -62.0], [8.6, -54.0, 0, 0.05], [10.0, -40, 0, 0.2],
    [12.0, -22, 0, 0.5], [14.6, -4, 0, 0.85], [15.4, 0, 1, 0.9], [7.0, 0.2, 0, 0.95], [0, 0.6, 0, 1], [-7.0, 0.2, 0, 0.95], [-15.4, 0, 1, 0.9], [-14.6, -4, 0, 0.85],
    [-12.0, -22, 0, 0.5], [-10.0, -40, 0, 0.2], [-8.6, -54.0, 0, 0.05], [-8.0, -62.0], [-9.8, -64.5, 1], [-10.6, -66.5],
    [-10.0, -71.0], [-9.8, -76.6], [-9.3, -80.0], [-8.0, -81.8], [-5.2, -83.2], [-2.5, -84.6], [-2.2, -86.0],
  ];
  // 广袖（右侧；左侧镜像）
  const F_BACK_SLEEVE = [
    [8.8, -72.0, 1], [10.6, -68.0], [12.6, -62.4, 0, 0.15], [14.6, -55.6, 0, 0.45], [15.6, -49.6, 0, 0.75], [15.0, -45.6, 0, 0.95],
    [12.6, -43.6, 0, 1], [10.0, -44.6, 0, 0.9], [8.4, -48.6, 0, 0.6], [7.8, -55.0, 0, 0.3], [8.2, -62.0],
  ];
  const mirror = (pts) => { const r = pts.map((q) => [-q[0], q[1], q[2], q[3]]); if (pts._st) r._st = 1; return r; };
  const F_BACK_SLEEVE_L = mirror(F_BACK_SLEEVE);
  const F_BACK_HEAD = ST([
    [0, -100.6], [2.8, -99.8], [4.4, -97.6], [4.8, -94.6], [4.6, -91.4], [3.6, -89.0], [2.4, -87.6],
    [-2.4, -87.6], [-3.6, -89.0], [-4.6, -91.4], [-4.8, -94.6], [-4.4, -97.6], [-2.8, -99.8],
  ]);
  const F_BACK_HAIR = [
    [0, -98.0], [3.8, -97.0], [5.0, -93.8], [5.1, -89.8, 0, 0.04], [5.5, -84.0, 0, 0.12], [6.1, -76.0, 0, 0.3], [6.4, -68.0, 0, 0.55],
    [6.0, -62.0, 0, 0.8], [4.6, -58.6, 0, 0.95], [2.2, -57.0, 1, 1], [0.6, -58.4, 0, 1], [-0.6, -57.4, 1, 1], [-2.6, -57.2, 0, 1], [-4.8, -58.8, 0, 0.95],
    [-6.0, -62.0, 0, 0.8], [-6.4, -68.0, 0, 0.55], [-6.1, -76.0, 0, 0.3], [-5.5, -84.0, 0, 0.12], [-5.1, -89.8, 0, 0.04], [-5.0, -93.8], [-3.8, -97.0],
  ];

  // 伊人背影的部件；pair 里复用（tilt：头向一侧微偏的角度）
  function heroineBack(P, tilt) {
    const C = P.col;
    // 披帛两端（在袖外）——先画，让它从袖后垂出
    const e1 = P.chain(13.2, -64.0, 50, 12, { a0: 0.1, a1: 0.03, lift: 0.7, amp: 0.3, ph: 0.6, idle: 0.04, lag: 0.7 });
    const e2 = P.chain(-13.2, -64.0, 50, 12, { a0: -0.1, a1: -0.03, lift: 0.7, amp: 0.3, ph: 2.3, idle: 0.04, lag: 0.7 });
    P.strip(e1, (u) => 2.4 - 0.4 * u + 0.45 * Math.sin(u * 8 + 1), C.shawl);
    P.strip(e2, (u) => 2.4 - 0.4 * u + 0.45 * Math.sin(u * 8 + 2), C.shawl);
    P.fill(P.flut(F_BACK_BODY, 3.6, 0.3, 0.5));
    P.fill(P.flut(F_BACK_SLEEVE, 2.0, 1.1, 0.4));
    P.fill(P.flut(F_BACK_SLEEVE_L, 2.0, 2.2, 0.4));
    P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-10, -73.6); c.lineTo(10, -73.6); c.lineTo(10, -71.4); c.lineTo(-10, -71.4); c.fill(); });
    folds(P, [ST([[-2.4, -60], [-3.8, -32], [-5.2, -4]]), ST([[2.4, -60], [3.8, -32], [5.2, -4]]), ST([[-7.6, -48], [-9.8, -22]]), ST([[7.6, -48], [9.8, -22]])]);
    // 披帛在背后兜成的弧
    const sag = 2.0 * P.w * P.sw(0.8) * 0.5;
    P.strip([[-11.4, -66.8], [-7.6, -60.4], [0, -57.0 + sag], [7.6, -60.4], [11.4, -66.8]], (u) => 2.2 + 0.5 * Math.sin(u * Math.PI), C.shawl);
    P.strip([[11.0, -67.4], [12.6, -66.2], [13.4, -63.8]], () => 2.2, C.shawl);
    P.strip([[-11.0, -67.4], [-12.6, -66.2], [-13.4, -63.8]], () => 2.2, C.shawl);
    // 头、发髻、长发：头部随 tilt 绕颈根转，发束上端跟着转、下端仍垂直
    const pv = [0, -87.0];
    const tw = (pts, full) => pts.map((q) => {
      const k = full ? 1 : clamp((-80 - q[1]) / 14);
      const r = rot(q[0], q[1], pv[0], pv[1], tilt * k);
      return [r[0], r[1], q[2], q[3]];
    });
    P.fill(tw(P.flut(F_BACK_HAIR, 3.4, 0.9, 0.5), false), C.deep);
    P.fill(tw(F_BACK_HEAD, true), C.deep);
    const bun = rot(0, -97.4, pv[0], pv[1], tilt), bun2 = rot(-1.6, -99.6, pv[0], pv[1], tilt), bun3 = rot(1.7, -99.4, pv[0], pv[1], tilt);
    P.ell(bun[0], bun[1], 3.6, 2.5, tilt, C.deep);
    P.ell(bun2[0], bun2[1], 2.0, 1.5, tilt - 0.4, C.deep);
    P.ell(bun3[0], bun3[1], 1.9, 1.4, tilt + 0.4, C.deep);
    const p0 = rot(-1.6, -96.0, pv[0], pv[1], tilt), p1 = rot(5.8, -101.4, pv[0], pv[1], tilt);
    P.line([p0, p1], 0.42, C.pin);
    const dang = P.chain(p1[0] - 0.6, p1[1] + 0.5, 2.6, 3, { a0: 0, lift: 0.8, amp: 0.4, ph: 0.4, idle: 0.1 });
    P.line(dang, 0.22, C.pin);
    P.ell(dang[3][0], dang[3][1], 0.45, 0.6, 0, C.pin, false);
  }
  def('heroine', 'standBack', [-44, -110, 44, 4], (P) => heroineBack(P, 0));

  // ================================================================ 长衫步
  // 步频 1.3 步/秒，步幅 0.323 倍身高，速度 0.42 倍身高/秒（= walkSpeed）。
  // 支撑期 60%：脚相对身体以 -v 后移（相对地面静止）；摆动期用两端速度为 -v 的 Hermite 曲线，所以脚离地、落地都不突变。
  // 落地后绕脚跟放平，离地前绕脚尖抬跟：接地点始终不动。
  const CAD = 1.3, TC = 2 / CAD, VU = 42, BETA = 0.6, A0 = (VU * BETA * TC) / 2;
  // 返回脚踝参考点 (x, y) 与脚的俯仰 pitch（正 = 脚尖翘起）。FT/FH 是脚尖、脚跟到参考点的距离
  const FT = 8.6, FH = 3.6;
  const heelPose = (gx, p) => ({ x: gx - FH + FH * Math.cos(p), y: -FH * Math.sin(p), pitch: p }); // 绕脚跟转
  const toePose = (gx, p) => ({ x: gx + FT - FT * Math.cos(p), y: FT * Math.sin(p), pitch: p }); // 绕脚尖转（p < 0 抬跟）
  const P_HS = 0.24, P_TO = -0.38;
  function footState(t, off) {
    let ph = (t / TC + off) % 1; if (ph < 0) ph += 1;
    if (ph < BETA) {
      const g = A0 - VU * ph * TC; // 脚掌放平时参考点的位置（相对身体，以 -v 后移 = 相对地面静止）
      const e = ph / BETA;
      if (e < 0.18) return heelPose(g, P_HS * (1 - smooth(e / 0.18)));
      if (e > 0.75) return toePose(g, P_TO * smooth((e - 0.75) / 0.25));
      return { x: g, y: 0, pitch: 0 };
    }
    const u = (ph - BETA) / (1 - BETA), Ts = (1 - BETA) * TC, m = -VU * Ts;
    const s0 = toePose(-A0, P_TO), s1 = heelPose(A0, P_HS);
    const u2 = u * u, u3 = u2 * u;
    const x = (2 * u3 - 3 * u2 + 1) * s0.x + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * s1.x + (u3 - u2) * m;
    const y = lerp(s0.y, s1.y, smooth(u)) - 2.0 * Math.pow(Math.sin(Math.PI * u), 1.4);
    return { x, y, pitch: lerp(P_TO, P_HS, smooth(u)) };
  }
  // 侧面布鞋：绕参考点转 pitch 后平移到 (f.x, f.y)
  function footSide(P, f, hgt) {
    const pts = [[-FH * 0.8, -hgt], [FT * 0.25, -hgt], [FT * 0.62, -hgt * 0.52], [FT * 0.95, -hgt * 0.25], [FT, -0.15, 1], [-FH, 0, 1], [-FH * 1.08, -hgt * 0.45]];
    const c = Math.cos(-f.pitch), s = Math.sin(-f.pitch);
    P.fill(pts.map((q) => [f.x + q[0] * c - q[1] * s, f.y + q[0] * s + q[1] * c, q[2]]));
  }
  // 长衫下摆：两腿位置推出前后摆角；返回下半身轮廓点（从前腰到后腰，经过下摆）
  function walkRobe(fa, fb, o) {
    const front = Math.max(fa.x, fb.x), back = Math.min(fa.x, fb.x);
    // 前摆被前腿小腿推出、后摆被后腿带出；布从膝部往下几乎垂直，所以是钟形而不是三角形
    const hf = Math.max(o.hemF, front + o.toeIn), hb = Math.min(o.hemB, back - o.heelIn);
    const sep = clamp((front - back) / (2 * A0));
    const kf = Math.max(o.kneeF, hf - 4.5), kb = Math.min(o.kneeB, hb + 4.0);
    const hy = o.hemY;
    const lf = 1.6 * clamp((hf - o.hemF) / 12), lb = 1.2 * clamp((o.hemB - hb) / 10); // 摆角被腿撑起时略微上提
    return [
      [o.hipF, o.hipY, 0, 0.05], [lerp(o.hipF, kf, 0.5), -40, 0, 0.15], [kf, -24, 0, 0.35],
      [lerp(kf, hf, 0.7), -12, 0, 0.6], [hf, hy - lf, 1, 0.8], [lerp(hf, hb, 0.3), hy + 0.4 - 1.2 * sep, 0, 0.85],
      [lerp(hf, hb, 0.7), hy + 0.4 - 1.2 * sep, 0, 0.9], [hb, hy - lb, 1, 1], [lerp(kb, hb, 0.7), -12, 0, 0.6], [kb, -24, 0, 0.35],
      [lerp(o.hipB, kb, 0.5), -40, 0, 0.15], [o.hipB, o.hipY - 1, 0, 0.05],
    ];
  }

  // ================================================================ 白发老者
  // 侧脸：额略后倾，眉骨稍显，鼻梁高、鼻尖微勾；嘴和下巴藏在胡子里
  const HEAD_O = ST([
    [-3.1, -0.4], [-4.9, -3.4], [-5.5, -6.6], [-4.9, -9.6], [-2.8, -11.5], [0.3, -12.2], [3.1, -11.6],
    [4.8, -9.7], [5.5, -7.6], [5.95, -6.35], [5.55, -5.6], [6.25, -4.3], [7.05, -3.05, 1], [6.15, -2.55],
    [5.8, -1.4], [5.4, 0.5], [4.8, 1.4], [2.5, 2.0], [1.8, 3.4], [-2.8, 3.2],
  ]);
  // 白发：头顶到后脑一层发量，前缘是发际线，下缘接到耳后鬓角
  const HAIR_O = ST([
    [3.4, -11.3], [0.3, -12.75], [-3.2, -11.95], [-5.45, -9.8], [-6.05, -6.6], [-5.55, -3.4], [-3.7, -0.3],
    [-2.7, -2.0], [-2.5, -4.6], [-1.7, -7.3], [0.3, -8.7], [2.2, -9.7],
  ]);
  // 胡子：上唇一抹短须连到下巴，须尖垂到下巴下约 5 单位，末端随风微摆
  const BEARD_O = [
    [5.2, -2.45], [6.1, -2.6], [6.6, -1.95], [6.25, -1.15], [6.05, 0.6, 0, 0.15], [5.5, 3.0, 0, 0.45], [4.5, 6.3, 1, 1],
    [3.5, 3.9, 0, 0.5], [2.6, 2.0, 0, 0.15], [2.1, 1.4], [3.6, 0.3], [4.6, -1.3],
  ];
  // 白发的梳痕：从发际、后颈向发髻收拢的几道极淡暗线，只画在头发上
  const O_SIDE_COMB = [
    ST([[2.6, -10.6], [0.6, -11.9], [-0.6, -12.4]]), ST([[-3.8, -1.6], [-4.8, -5.4], [-3.6, -9.6], [-1.6, -12.0]]),
    ST([[-2.4, -3.6], [-2.8, -7.4], [-1.4, -11.0]]),
  ];
  const O_BACK_COMB = [
    ST([[-3.4, -86.4], [-4.2, -90.6], [-3.0, -94.6], [-1.2, -96.4]]), ST([[3.4, -86.4], [4.2, -90.6], [3.0, -94.6], [1.2, -96.4]]),
    ST([[-1.0, -85.6], [-1.4, -90.6], [-0.6, -95.8]]), ST([[1.0, -85.6], [1.4, -90.6], [0.6, -95.8]]),
  ];
  function hairLines(P, lines) {
    P.shade((c) => {
      c.strokeStyle = rgba(P.col.body, 0.16); c.lineCap = 'round';
      c.lineWidth = Math.max(0.28, 0.7 / P.px);
      for (const l of lines) c.stroke(pathOf(l, false));
    });
  }
  function oldHead(P, px, py, ang, opt) {
    const C = P.col;
    opt = opt || {};
    P.group(px, py, ang, () => {
      // 几缕散发（在头后，挂在耳后）
      for (const [x0, y0, L, ph] of [[-2.6, -4.6, 7.0, 0.4], [-4.6, -6.8, 5.6, 1.9]]) {
        const cl = P.chain(x0, y0, L, 5, { a0: -0.15, lift: 0.9, amp: 0.4, ph, idle: 0.05, curl: 0.15, rot: ang });
        P.strip(cl, (u) => 0.75 * (1 - u) + 0.2, C.hair);
      }
      // 发带两尾
      if (!opt.hat) {
        const r1 = P.chain(-2.0, -13.0, 9.5, 6, { a0: -1.4, a1: -0.25, lift: 1.1, amp: 0.4, ph: 1.1, idle: 0.04, rot: ang });
        const r2 = P.chain(-2.2, -12.7, 7.5, 5, { a0: -1.0, a1: -0.05, lift: 1.0, amp: 0.45, ph: 2.8, idle: 0.04, rot: ang });
        P.strip(r2, (u) => 0.95 - u * 0.25, C.ribbonOld);
        P.strip(r1, (u) => 1.0 - u * 0.25, C.ribbonOld);
      }
      P.fill(HEAD_O);
      P.fill(HAIR_O, C.hair);
      hairLines(P, O_SIDE_COMB);
      P.fill(P.flut(BEARD_O, 1.6, 0.7, 0.2), C.hair);
      if (!opt.hat) {
        P.ell(-0.4, -13.75, 2.25, 1.7, -0.15, C.hair);
        P.ell(-0.2, -15.1, 1.1, 0.8, 0, C.hair);
        P.line([[-2.4, -12.9], [-0.4, -12.5], [1.6, -12.8]], 0.8, C.ribbonOld);
      } else {
        hatSide(P, 0.9, -9.6, -0.04, 1.0);
      }
    });
  }
  // 葫芦：挂绳根部固定在腰带上，整只像钟摆一样随风轻摆；stand 为真时立在地上（y 为地面）
  function gourd(P, x, y, s, phase, cord, stand) {
    const C = P.col;
    cord = cord == null ? 2.4 : cord;
    if (stand) {
      P.group(x, y, 0, () => {
        P.ell(0, -2.6 * s, 2.45 * s, 2.6 * s, 0, C.gourd, false);
        P.ell(0, -5.4 * s, 0.75 * s, 0.6 * s, 0, C.gourd, false);
        P.ell(0, -6.6 * s, 1.35 * s, 1.5 * s, 0, C.gourd, false);
        P.ell(-0.7 * s, -3.2 * s, 0.9 * s, 1.1 * s, -0.4, C.gourdHi, false);
        P.line([[0, -7.8 * s], [0, -8.8 * s]], 0.7 * s, C.gourd);
        P.line([[-0.8 * s, -5.6 * s], [0.8 * s, -5.6 * s]], 0.45 * s, C.ribbonOld);
      });
      return;
    }
    const a = (0.05 + 0.12 * Math.abs(P.wl)) * P.sw(phase || 0) + 0.1 * P.wl;
    P.group(x, y, -a, () => {
      P.line([[0, 0], [0.4, cord]], 0.35 * s, C.gourd);
      P.group(0.5, cord - 2.4 * s, 0, () => {
        P.ell(0, 3.4 * s, 1.35 * s, 1.5 * s, 0, C.gourd, false);
        P.ell(0, 4.6 * s, 0.75 * s, 0.6 * s, 0, C.gourd, false);
        P.ell(0, 7.4 * s, 2.45 * s, 2.6 * s, 0, C.gourd, false);
        P.ell(-0.7 * s, 6.8 * s, 0.9 * s, 1.1 * s, -0.4, C.gourdHi, false);
        P.line([[-0.8 * s, 2.0 * s], [0.8 * s, 2.0 * s]], 0.45 * s, C.ribbonOld);
      });
    });
  }
  // 斗笠（侧面）：以帽檐中点为原点，半宽 15 单位；竹篾的放射纹用极淡亮线
  const HAT_SIDE = ST([
    [-15.2, 0.5, 1], [-12.8, -0.7], [-8.4, -2.9], [-4.2, -5.0], [-1.5, -6.6], [0, -7.2], [1.5, -6.6], [4.2, -5.0],
    [8.4, -2.9], [12.8, -0.7], [15.2, 0.5, 1], [12.8, 1.0], [7.0, 0.8], [0, 0.9], [-7.0, 0.8], [-12.8, 1.0],
  ]);
  const HAT_RIBS = [-10.5, -6.5, -2.8, 2.8, 6.5, 10.5].map((x) => ST([[0, -6.6], [x, -0.2]]));
  function hatSide(P, x, y, ang, sc, col) {
    const C = P.col;
    P.group(x, y, ang, () => {
      P.fill(HAT_SIDE, col || C.straw);
      P.ell(0, -7.3, 0.9, 0.7, 0, col || C.straw);
      P.shade((c) => {
        c.strokeStyle = C.fold; c.lineWidth = Math.max(0.3, 0.6 / P.px / sc);
        for (const r of HAT_RIBS) c.stroke(pathOf(r, false));
      });
    }, sc);
  }
  // 侧影站（微驼，双手背在身后）
  const O_SIDE_TOP = [
    [6.9, -80.8], [7.2, -78.4], [7.9, -75.0], [7.6, -70.5], [6.8, -65.0], [6.1, -61.2],
  ];
  const O_SIDE_BACK = [
    [-7.6, -53.0], [-6.8, -61.0], [-7.4, -68.0], [-7.6, -74.8], [-6.2, -80.4], [-3.4, -83.4], [0.2, -84.6], [2.1, -84.0],
  ];
  const O_SIDE_LOWER = [
    [6.6, -52, 0, 0.05], [7.4, -36, 0, 0.18], [8.2, -20, 0, 0.45], [9.0, -4.2, 1, 0.8], [0.4, -3.4, 0, 0.9], [-9.4, -3.8, 1, 1],
    [-8.8, -18, 0, 0.55], [-8.0, -34, 0, 0.25], [-7.4, -46, 0, 0.08],
  ];
  const O_SIDE_BODY = ST(O_SIDE_TOP.concat(O_SIDE_LOWER, O_SIDE_BACK));
  // 背手：上臂向后下，手背在腰后，宽袖口垂在手下
  const O_SIDE_ARMS = [
    [-3.4, -81.6], [0.4, -82.4], [3.4, -80.4], [3.8, -74.0], [1.6, -68.0], [-1.8, -63.4], [-5.4, -60.2],
    [-8.6, -58.6], [-10.4, -56.6, 0, 0.3], [-11.2, -52.4, 0, 0.6], [-10.6, -48.2, 0, 0.9], [-8.8, -47.0, 1, 1], [-7.6, -50.4, 0, 0.5],
    [-6.8, -55.4], [-7.6, -63.0], [-7.6, -72.0],
  ];
  const O_FOLDS = [
    ST([[1.6, -60], [2.4, -40], [3.2, -20], [3.6, -5]]), ST([[-3.0, -48], [-4.0, -28], [-4.8, -6]]),
    ST([[-1.6, -78], [-4.0, -70], [-6.0, -63]]),
  ];
  const O_SHOE = ST([[-3.0, -5.0], [2.2, -5.0], [3.0, -3.4], [7.4, -2.2], [9.0, -1.4], [9.4, -0.2, 1], [-3.7, 0, 1], [-4.0, -2.2]]);

  function oldSideUpper(P, k, dy, armsPts) {
    const C = P.col;
    P.group(0, dy, 0, () => {
      swordSide(P, -2.2, -95.4, -10.2, -53.0, false);
    });
  }

  def('old', 'standSide', [-24, -112, 22, 4], (P, k) => {
    const C = P.col;
    swordSide(P, -2.2, -95.4, -10.2, -53.0, false);
    P.fill(P.flut(O_SIDE_BODY, 4.2, 0.4, 0.6));
    P.fill(O_SHOE);
    oldHead(P, 5.2, -83.6, -0.04, { hat: k.o.hat });
    P.fill(P.flut(O_SIDE_ARMS, 2.0, 1.3, 0.3));
    P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-7.4, -63.4); c.lineTo(6.6, -62.6); c.lineTo(6.6, -60.6); c.lineTo(-7.0, -61.4); c.fill(); });
    folds(P, O_FOLDS);
    gourd(P, 5.4, -61.4, 1, 0.5);
  }, { ph: 0.7 });

  def('old', 'walkSide', [-26, -112, 34, 4], (P, k) => {
    const C = P.col;
    const t = k.t + (k.o.walkPhase || 0);
    const fa = footState(t, 0), fb = footState(t, 0.5);
    // 身体起伏：双支撑最低，单支撑最高，幅度 ±0.3 单位（0.6% 身高）
    const ph = (t / TC) % 1;
    const bob = -0.3 * Math.cos(ph * 2 * TAU);
    // 脚画在长衫后面
    for (const f of fa.x < fb.x ? [fa, fb] : [fb, fa]) footSide(P, f, 4.6);
    const lower = walkRobe(fa, fb, { hemF: 8.8, hemB: -9.2, toeIn: 5.4, heelIn: 3.2, kneeF: 7.8, kneeB: -8.2, hipF: 6.6, hipB: -7.4, hipY: -52, hemY: -4.4 });
    P.group(0, bob, 0, () => {
      swordSide(P, -2.2, -95.4, -10.2, -53.0, false);
    });
    const body = O_SIDE_TOP.map((q) => [q[0], q[1] + bob, q[2], q[3]]).concat(
      P.flut(lower, 3.0, 0.4, 0.4),
      O_SIDE_BACK.map((q) => [q[0], q[1] + bob, q[2], q[3]])
    );
    P.fill(body);
    P.group(0, bob, 0, () => {
      oldHead(P, 5.2, -83.6, -0.04, { hat: k.o.hat });
      P.fill(P.flut(O_SIDE_ARMS, 2.0, 1.3, 0.3));
      P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-7.4, -63.4); c.lineTo(6.6, -62.6); c.lineTo(6.6, -60.6); c.lineTo(-7.0, -61.4); c.fill(); });
      // 葫芦随步子轻晃
      const sv = P.wl; P.wl = sv + 0.25 * Math.sin(ph * 2 * TAU + 0.8);
      gourd(P, 5.4, -61.4, 1, 0.5);
      P.wl = sv;
    });
  }, { ph: 0.7 });

  // 背影（老者）：白发后脑、发髻与旧蓝发带；驼背使后颈藏进肩背；双手背在腰后，肘部外撑，宽袖垂在手下
  const O_BACK_HEAD = ST([
    [0, -96.6], [3.2, -95.9], [4.7, -93.8], [5.1, -91.0], [5.45, -89.6], [5.2, -88.0], [4.2, -86.6], [2.4, -85.4],
    [0, -85.0], [-2.4, -85.4], [-4.2, -86.6], [-5.2, -88.0], [-5.45, -89.6], [-5.1, -91.0], [-4.7, -93.8], [-3.2, -95.9],
  ]);
  const O_BACK_TORSO = [
    [0, -86.6], [3.6, -86.2], [6.8, -84.4], [9.4, -82.0], [10.0, -79.0], [9.6, -74.0, 1], [8.4, -64.0], [9.0, -57.0],
    [9.9, -50, 0, 0.05], [11.2, -38, 0, 0.2], [12.4, -22, 0, 0.5], [13.4, -4.2, 1, 0.85], [6.5, -3.6, 0, 0.9], [0, -3.8, 0, 0.9],
    [-6.5, -3.6, 0, 0.9], [-13.4, -4.2, 1, 0.85], [-12.4, -22, 0, 0.5], [-11.2, -38, 0, 0.2], [-9.9, -50, 0, 0.05],
    [-9.0, -57.0], [-8.4, -64.0], [-9.6, -74.0, 1], [-10.0, -79.0], [-9.4, -82.0], [-6.8, -84.4], [-3.6, -86.2],
  ];
  const O_BACK_ARM = ST([
    [7.6, -83.6], [10.2, -82.0], [11.8, -79.0], [12.7, -73.4], [13.5, -67.2], [13.6, -64.4], [12.4, -62.2], [8.6, -59.8],
    [3.6, -57.8], [0.6, -57.2, 1], [0.6, -60.4, 1], [4.0, -61.2], [8.4, -63.2], [11.0, -66.4, 1], [10.2, -72.6], [9.6, -78.4],
  ]);
  const O_BACK_SLEEVE = [
    [13.4, -64.0, 1], [13.8, -59.6, 0, 0.2], [13.3, -54.4, 0, 0.5], [11.8, -50.2, 0, 0.85], [8.6, -48.8, 0, 1], [5.0, -49.8, 0, 0.9],
    [2.2, -52.2, 0, 0.6], [1.0, -55.4, 0, 0.3], [1.0, -58.4, 1], [6.0, -59.6], [10.4, -61.6],
  ];
  const O_BACK_ARM_L = mirror(O_BACK_ARM), O_BACK_SLEEVE_L = mirror(O_BACK_SLEEVE);
  const O_BACK_FOLDS = [
    ST([[0, -84], [0, -60]]), ST([[-2.8, -48], [-4.0, -26], [-5.0, -6]]), ST([[2.8, -48], [4.0, -26], [5.0, -6]]),
    ST([[-8.6, -42], [-10.4, -18]]), ST([[8.6, -42], [10.4, -18]]),
    ST([[11.6, -60], [9.4, -53.6], [6.6, -51.6]]), ST([[-11.6, -60], [-9.4, -53.6], [-6.6, -51.6]]),
  ];
  // 后脑、发髻、发带、散发（背面）；dy 为整体下移量，tilt 为头的侧偏角
  function oldBackHead(P, dy, tilt) {
    const C = P.col;
    P.group(0, -88.0 + dy, tilt || 0, () => {
      P.group(0, 88.0, 0, () => {
        for (const [x0, ph] of [[4.4, 0.4], [-4.5, 1.9]]) {
          const cl = P.chain(x0, -88.4, 4.6, 4, { a0: x0 > 0 ? 0.25 : -0.25, lift: 0.9, amp: 0.4, ph, idle: 0.05, curl: x0 > 0 ? 0.1 : -0.1 });
          P.strip(cl, (u) => 0.6 * (1 - u) + 0.18, C.hair);
        }
        P.fill(O_BACK_HEAD, C.hair);
        P.ell(0, -97.8, 2.7, 2.0, 0, C.hair);
        P.ell(0, -99.6, 1.3, 0.95, 0, C.hair);
        hairLines(P, O_BACK_COMB);
        const r1 = P.chain(1.8, -96.9, 7.6, 6, { a0: 1.1, a1: 0.35, lift: 1.3, amp: 0.45, ph: 1.1, idle: 0.04 });
        const r2 = P.chain(-1.8, -96.9, 6.4, 5, { a0: -1.1, a1: -0.35, lift: 1.3, amp: 0.5, ph: 2.8, idle: 0.04 });
        P.strip(r2, (u) => 0.95 - u * 0.25, C.ribbonOld);
        P.strip(r1, (u) => 1.0 - u * 0.25, C.ribbonOld);
        P.line([[-2.3, -96.8], [0, -96.2], [2.3, -96.8]], 0.8, C.ribbonOld);
      });
    });
  }
  // 背剑在背面：剑柄在肩外侧探出，剑鞘用极淡亮线斜过后背
  function backScabbard(P, x0, y0, x1, y1) {
    P.shade((c) => {
      c.lineCap = 'round';
      c.strokeStyle = P.col.fold; c.lineWidth = 2.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.strokeStyle = P.col.body; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    });
  }

  def('old', 'standBack', [-27, -112, 27, 4], (P) => {
    const C = P.col;
    P.fill(BOOTS_BACK); P.fill(BOOTS_BACK2);
    swordBack(P, 10.2, -95.4, -14.6, -47.4, false);
    gourd(P, 10.6, -58.4, 1.0, 0.5, 10.5);
    P.fill(P.flut(O_BACK_TORSO, 4.0, 0.2, 0.5));
    folds(P, O_BACK_FOLDS.slice(0, 5));
    backScabbard(P, 6.6, -88.0, -13.4, -49.6);
    P.fill(O_BACK_ARM); P.fill(O_BACK_ARM_L);
    P.fill(P.flut(O_BACK_SLEEVE, 2.0, 1.2, 0.3)); P.fill(P.flut(O_BACK_SLEEVE_L, 2.0, 2.3, 0.3));
    P.ell(0, -58.6, 2.3, 1.9);
    folds(P, O_BACK_FOLDS.slice(5));
    oldBackHead(P, 0, 0);
  }, { ph: 0.7 });

  // 侧坐（石凳 / 台阶）：原点是臀部着座点；大腿水平、小腿垂下，脚在座面下 26 单位
  const O_SITSIDE_BODY = [
    [9.4, -36.4], [10.6, -32.4], [10.4, -27.2], [9.2, -21.0], [8.4, -17.4], [8.0, -13.2], [14.0, -12.6], [21.4, -11.6],
    [24.8, -8.6], [25.4, -2.0, 0, 0.1], [25.9, 10.0, 0, 0.4], [26.3, 20.4, 1, 0.8], [21.0, 21.0, 0, 0.9], [16.0, 21.6, 1, 1],
    [14.8, 13.0, 0, 0.6], [12.4, 5.6, 0, 0.3], [8.8, 1.0], [4.0, 0, 1], [-6.0, 0, 1], [-8.6, -1.8], [-8.4, -6.0], [-7.6, -10.0],
    [-8.0, -18.0], [-7.8, -26.0], [-6.0, -32.6], [-2.6, -37.0], [1.2, -39.4], [4.5, -40.0],
  ];
  const O_SITSIDE_ARM = [
    [-1.6, -37.6], [2.6, -38.4], [6.2, -36.2], [7.0, -30.0], [6.6, -24.0], [7.8, -19.6], [13.0, -17.0], [18.2, -15.4],
    [18.8, -13.0, 1], [17.6, -8.4, 0, 0.5], [13.6, -5.6, 0, 1], [8.8, -6.8, 0, 0.8], [4.6, -10.8], [1.6, -15.6], [-0.8, -22.0], [-2.4, -30.0],
  ];
  const O_SITSIDE_HAND = ST([[18.2, -15.6], [21.4, -15.0], [23.6, -13.0], [24.6, -10.6], [23.8, -9.6], [21.6, -11.6], [18.6, -12.6]]);
  const O_SITSIDE_FOLDS = [
    ST([[9.0, -10.8], [15.0, -9.6], [21.0, -8.6]]), ST([[21.6, -4], [22.2, 8], [22.8, 19]]), ST([[17.8, 2], [18.4, 12], [19.2, 20]]),
    ST([[-2.2, -34], [1.6, -26], [3.6, -18.4]]),
  ];
  const O_SHOE_AT = (x, y) => X(O_SHOE, x, y);
  const O_SITSIDE_SHOE = O_SHOE_AT(21.6, 26.2);

  def('old', 'sitSide', [-22, -62, 40, 30], (P, k) => {
    const C = P.col;
    swordSide(P, -1.0, -50.6, -10.4, -7.4, false);
    P.fill(O_SITSIDE_SHOE);
    P.fill(P.flut(O_SITSIDE_BODY, 2.6, 0.4, 0.3));
    oldHead(P, 7.6, -39.6, 0.06, { hat: k.o.hat });
    P.fill(P.flut(O_SITSIDE_ARM, 1.4, 1.3, 0.2));
    P.fill(O_SITSIDE_HAND);
    P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-8.2, -19.6); c.lineTo(8.8, -18.6); c.lineTo(8.8, -16.6); c.lineTo(-8.0, -17.6); c.fill(); });
    folds(P, O_SITSIDE_FOLDS);
    gourd(P, 3.4, -17.2, 0.95, 0.5, 2.0);
  }, { ph: 0.3 });

  // 背影坐地（盘腿）：原点是臀下地面；膝在两侧鼓出，衣摆铺在地上
  const O_SITBACK_TORSO = [
    [0, -40.4], [3.6, -40.0], [6.8, -38.0], [9.2, -35.4], [9.6, -30.0], [9.0, -24.0], [8.6, -18.0], [9.2, -12.0], [10.6, -8.8],
    [14.4, -8.4], [18.0, -7.6], [20.4, -5.8], [21.4, -3.2], [20.8, -0.6], [19.2, 0.3, 1], [8.0, 0.5], [0, 0.6],
    [-8.0, 0.5], [-19.2, 0.3, 1], [-20.8, -0.6], [-21.4, -3.2], [-20.4, -5.8], [-18.0, -7.6], [-14.4, -8.4], [-10.6, -8.8],
    [-9.2, -12.0], [-8.6, -18.0], [-9.0, -24.0], [-9.6, -30.0], [-9.2, -35.4], [-6.8, -38.0], [-3.6, -40.0],
  ];
  const O_SITBACK_ARM = [
    [8.6, -37.2], [10.6, -35.0], [11.6, -31.6], [12.2, -26.0], [12.6, -20.4], [13.2, -15.6], [14.2, -11.2, 0, 0.3], [15.0, -8.6, 0, 0.5],
    [12.6, -8.2, 0, 0.3], [11.4, -11.6], [10.8, -17.6], [10.4, -23.4], [9.8, -28.8, 1], [9.0, -33.0],
  ];
  const O_SITBACK_ARM_L = mirror(O_SITBACK_ARM);
  const O_SITBACK_FOLDS = [ST([[0, -38], [0, -14]]), ST([[-14, -6.4], [-8, -4.4], [-2, -3.6]]), ST([[14, -6.4], [8, -4.4], [2, -3.6]])];

  def('old', 'sitBack', [-26, -60, 30, 4], (P) => {
    const C = P.col;
    swordBack(P, 10.6, -48.4, -17.0, -1.6, false);
    P.fill(O_SITBACK_TORSO);
    folds(P, O_SITBACK_FOLDS);
    backScabbard(P, 6.4, -41.2, -14.8, -5.4);
    P.fill(P.flut(O_SITBACK_ARM, 1.2, 1.0, 0.2)); P.fill(P.flut(O_SITBACK_ARM_L, 1.2, 2.0, 0.2));
    gourd(P, 24.4, 0, 1.0, 0, 0, true);
    oldBackHead(P, 46.4, 0);
  }, { ph: 1.1 });

  // 背影坐船：腰背稍直，右手把葫芦举在肩旁（饮到一半），头微偏向右；左臂搭在左膝上
  const O_BOAT_TORSO = [
    [0, -41.4], [3.6, -41.0], [6.8, -39.0], [9.2, -36.4], [9.6, -31.0], [9.0, -25.0], [8.6, -19.0], [9.4, -12.0], [11.0, -7.6],
    [13.6, -4.8], [14.8, -2.0], [14.2, 0.3, 1], [0, 0.6], [-14.2, 0.3, 1], [-14.8, -2.0], [-13.6, -4.8],
    [-11.0, -7.6], [-9.4, -12.0], [-8.6, -19.0], [-9.0, -25.0], [-9.6, -31.0], [-9.2, -36.4], [-6.8, -39.0], [-3.6, -41.0],
  ];
  // 右臂：上臂外展、肘在身侧，小臂上举；宽袖从小臂垂下兜住肘
  const O_BOAT_ARM_R = [
    [8.4, -38.6], [11.0, -37.0], [13.4, -34.4], [15.0, -33.0], [16.4, -35.2], [17.4, -37.8, 1], [19.6, -36.0, 0, 0.2],
    [20.8, -31.0, 0, 0.5], [20.6, -25.6, 0, 0.8], [18.4, -21.8, 0, 1], [14.8, -21.6, 0, 0.85], [11.8, -24.4, 0, 0.5], [10.2, -28.6, 0, 0.2], [9.4, -33.6],
  ];
  const O_BOAT_ARM_L = [
    [-8.6, -38.2], [-10.6, -36.0], [-11.8, -32.0], [-12.8, -26.4], [-13.8, -21.4], [-14.6, -16.6, 0, 0.3], [-15.4, -12.8, 0, 0.6],
    [-14.0, -10.4, 0, 0.5], [-12.2, -12.6], [-11.4, -18.0], [-10.6, -23.6], [-9.8, -29.4, 1], [-9.0, -34.0],
  ];
  def('old', 'sitBoat', [-24, -62, 28, 4], (P) => {
    const C = P.col;
    swordBack(P, -10.4, -49.6, 15.6, -4.0, false);
    P.fill(O_BOAT_TORSO);
    folds(P, [ST([[0, -39], [0, -14]]), ST([[-10, -4.6], [-4, -3.2]]), ST([[10, -4.6], [4, -3.2]])]);
    backScabbard(P, -6.0, -42.6, 13.8, -7.6);
    P.fill(P.flut(O_BOAT_ARM_L, 1.2, 2.0, 0.2));
    P.fill(P.flut(O_BOAT_ARM_R, 1.2, 1.0, 0.2));
    // 葫芦握在右手里，口朝向头
    P.group(18.0, -38.6, -0.55, () => {
      P.ell(0, -1.4, 1.35, 1.5, 0, C.gourd, false);
      P.ell(0, 0.0, 0.75, 0.6, 0, C.gourd, false);
      P.ell(0, 2.7, 2.45, 2.6, 0, C.gourd, false);
      P.ell(-0.7, 2.2, 0.9, 1.1, -0.4, C.gourdHi, false);
      P.line([[0, -2.6], [0, -3.6]], 0.7, C.gourd);
      P.line([[-0.8, -0.6], [0.8, -0.6]], 0.45, C.ribbonOld);
    });
    P.ell(17.6, -37.4, 1.7, 1.5, 0);
    oldBackHead(P, 45.4, 0.1);
  }, { ph: 0.5 });

  // 倚墙垂头睡（侧）：原点是臀下地面；背靠身后的墙（x ≈ -11），近侧膝立起、小臂搭在膝上，远侧腿伸直；剑斜倚肩头
  const O_SLEEP_TORSO = [
    [-4.0, -40.0], [-7.8, -37.6], [-10.4, -33.0], [-11.0, -26.0], [-10.6, -18.0], [-9.6, -10.0], [-8.6, -3.6], [-6.6, -0.2, 1],
    [6.0, 0, 1], [6.0, -8.0], [3.6, -14.8], [3.4, -20.0], [3.0, -28.4], [1.8, -34.4], [0, -38.2],
  ];
  const O_SLEEP_LEG_NEAR = [
    [0, -10.6], [5.6, -16.8], [10.6, -23.2], [13.8, -25.4], [16.4, -22.6], [17.6, -13.0, 0, 0.2], [18.6, -5.2, 1, 0.5],
    [14.4, -4.0, 1, 0.5], [11.0, -11.6], [6.2, -5.0], [2.0, -0.4],
  ];
  const O_SLEEP_LEG_FAR = [
    [0, -9.0], [8.0, -10.0], [18.0, -8.8], [28.0, -7.0], [36.8, -5.8, 0, 0.3], [37.6, -3.8, 1, 0.6], [37.0, -0.2, 1, 0.6], [20.0, 0, 1], [6, 0, 1],
  ];
  const O_SLEEP_FOOT_FAR = ST([[36.4, -5.6], [39.4, -6.4], [41.4, -9.4], [42.8, -9.0, 1], [42.6, -4.2], [41.6, -0.3, 1], [36.6, 0, 1]]);
  const O_SLEEP_FOOT_NEAR = X(O_SHOE, 17.2, 0);
  const O_SLEEP_ARM = [
    [-9.0, -35.0], [-5.4, -36.6], [-2.6, -33.4], [0.6, -27.6], [4.6, -24.2], [9.6, -26.0], [13.4, -27.0], [15.8, -26.4, 1],
    [15.2, -22.6, 0, 0.5], [12.6, -17.0, 0, 0.9], [9.0, -14.6, 0, 1], [5.6, -16.8, 0, 0.7], [2.2, -20.0], [-2.6, -24.6], [-6.8, -29.0],
  ];
  const O_SLEEP_HAND = ST([[14.8, -26.8], [17.0, -26.2], [18.4, -23.4], [19.2, -19.6], [18.2, -18.4], [16.6, -20.6], [15.0, -23.4]]);
  def('old', 'sitSleep', [-22, -62, 48, 4], (P) => {
    const C = P.col;
    P.fill(O_SLEEP_FOOT_FAR);
    P.fill(P.flut(O_SLEEP_LEG_FAR, 1.0, 0.3, 0.1));
    // 剑：剑柄靠在肩头，鞘尾拄地
    const sx0 = 8.6, sy0 = -47.6, sx1 = 27.8, sy1 = -0.4;
    swordSide(P, sx0, sy0, sx1, sy1, false);
    P.fill(O_SLEEP_TORSO);
    oldHead(P, -2.2, -37.6, 0.8);
    P.fill(O_SLEEP_FOOT_NEAR);
    P.fill(P.flut(O_SLEEP_LEG_NEAR, 1.0, 0.8, 0.1));
    P.fill(P.flut(O_SLEEP_ARM, 1.2, 1.4, 0.2));
    P.fill(O_SLEEP_HAND);
    folds(P, [ST([[2.6, -14.0], [8.0, -18.6], [12.4, -22.6]]), ST([[10, -6.0], [20, -6.0], [30, -4.6]]), ST([[-8.4, -30], [-4.6, -24], [0.4, -21.6]])]);
    gourd(P, 3.2, -15.8, 0.9, 0.5, 1.2);
  }, { ph: 2.0 });

  // 披蓑戴笠侧坐垂钓：原点是船板面；双膝立起，蓑衣从肩罩到膝，钓竿向前上方伸出，钓线垂入水中
  // 草穗：沿一条边挂一排细穗，末端圆收，随风轻摆
  function fringe(P, edge, len, n, ph, col, dir) {
    const t = P.t, wl = P.wl;
    const segs = [];
    let L = 0;
    for (let i = 1; i < edge.length; i++) { const d = Math.hypot(edge[i][0] - edge[i - 1][0], edge[i][1] - edge[i - 1][1]); segs.push(d); L += d; }
    for (let j = 0; j < n; j++) {
      let s = ((j + 0.5) / n) * L, i = 0;
      while (i < segs.length - 1 && s > segs[i]) { s -= segs[i]; i++; }
      const f = s / segs[i], a = edge[i], b = edge[i + 1];
      const x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f);
      const hh = (Math.sin(j * 12.9898 + ph * 7.1) * 43758.5453) % 1;
      const l = len * (0.75 + 0.4 * Math.abs(hh));
      const ang = (dir || 0) + 0.55 * wl + 0.12 * (Math.abs(wl) + 0.05) * sw(t * 1.3 - j * 0.15, ph + j);
      const w = 0.95 + 0.3 * Math.abs(hh);
      const ex = x + Math.sin(ang) * l, ey = y + Math.cos(ang) * l;
      P.fill([[x - w, y - 0.6, 1], [x + w, y - 0.6, 1], [lerp(x, ex, 0.6) + w * 0.45, lerp(y, ey, 0.6)], [ex, ey], [lerp(x, ex, 0.6) - w * 0.45, lerp(y, ey, 0.6)]], col, false);
    }
  }
  const O_FISH_CAPE = [
    [8.2, -35.6], [10.4, -31.6], [12.6, -26.4], [15.6, -22.4, 0, 0.1], [17.4, -20.2, 1, 0.2], [12.0, -15.4, 0, 0.3], [6.0, -10.6, 0, 0.4],
    [-2.0, -5.4, 0, 0.6], [-8.0, -2.4, 0, 0.8], [-12.4, -0.8, 1, 1], [-12.0, -8.0, 0, 0.7], [-10.6, -17.0, 0, 0.4], [-9.0, -26.0, 0, 0.15],
    [-6.6, -32.4], [-3.2, -36.6], [0.8, -38.8],
  ];
  const O_FISH_SHIN = ST([[11.0, -18.6], [16.6, -21.8], [18.4, -15.0], [20.0, -5.0, 1], [15.6, -4.4, 1], [14.6, -11.6]]);
  const O_FISH_SHOE = X(O_SHOE, 18.0, 0);
  const O_FISH_HANDS = [ST([[11.2, -22.6], [13.8, -23.4], [14.8, -21.6], [13.6, -19.8], [11.4, -20.2]]), ST([[16.2, -25.6], [18.8, -26.6], [19.8, -24.4], [18.6, -22.6], [16.4, -23.2]])];
  def('old', 'fishSit', [-20, -66, 90, 30], (P) => {
    const C = P.col;
    const t = P.t;
    // 竿：从竿尾经双手伸向前上方，竿梢因自重微垂，并随水面和风轻轻点动
    const bx = 5.6, by = -16.4, ang = 0.52 + 0.01 * Math.sin(TAU * 0.23 * t), L = 84;
    const dx = Math.cos(ang), dy = -Math.sin(ang);
    const bob = 0.7 * Math.sin(TAU * 0.41 * t + 0.6) + 0.5 * P.wl * (0.6 + 0.4 * P.sw(1.7));
    const rod = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      rod.push([bx + dx * L * u, by + dy * L * u + (5.0 + bob) * u * u]);
    }
    const tip = rod[8];
    // 钓线：从竿梢垂到船板下 24 单位（入水），被风吹出一点弧
    const lb = [tip[0] + 3.0 * P.wl + 0.8 * Math.sin(TAU * 0.2 * t), 24];
    const line = [];
    for (let i = 0; i <= 6; i++) { const u = i / 6; line.push([lerp(tip[0], lb[0], u * u) + 1.2 * P.wl * Math.sin(Math.PI * u), lerp(tip[1], lb[1], u)]); }
    P.line(line, 0.18, rgba(C.body, 0.75));
    P.strip(rod, (u) => 0.95 - 0.7 * u);
    P.fill(O_FISH_SHOE);
    P.fill(O_FISH_SHIN);
    // 头：白发从斗笠下露出一点，胡子尖在帽檐下
    P.group(5.6, -38.4, 0.12, () => {
      P.fill(HEAD_O);
      P.fill(ST([[-5.6, -7.4], [-6.0, -4.6], [-5.0, -1.8], [-3.2, 0.2], [-2.4, -2.6], [-2.6, -6.2]]), C.hair);
      P.fill(P.flut(BEARD_O, 1.4, 0.7, 0.2), C.hair);
    });
    const cape = P.flut(O_FISH_CAPE, 2.4, 0.5, 0.3);
    P.fill(cape, C.straw);
    fringe(P, cape.slice(4, 10), 2.8, 24, 0.3, C.straw);
    P.shade((c) => {
      c.strokeStyle = C.fold; c.lineWidth = Math.max(0.4, 0.7 / P.px);
      c.beginPath(); c.moveTo(-8.8, -24.4); c.quadraticCurveTo(0, -26.4, 11.6, -26.0); c.stroke();
      c.beginPath(); c.moveTo(-10.6, -13.0); c.quadraticCurveTo(0, -15.6, 9.6, -15.6); c.stroke();
    });
    for (const hnd of O_FISH_HANDS) P.fill(hnd);
    hatSide(P, 6.4, -47.6, 0.1, 1.0);
  }, { ph: 1.6 });

  // ================================================================ 行路人
  // 宽沿斗笠、蓑衣到膝（下缘草穗）、长衫下摆到踝；脸只露下巴
  const T_CAPE = [
    [3.0, -85.8], [6.6, -82.4], [8.6, -76.6], [10.0, -67.0, 0, 0.1], [11.6, -55.0, 0, 0.3], [12.8, -45.4, 1, 0.5],
    [5.0, -44.0, 0, 0.6], [-4.0, -43.6, 0, 0.7], [-13.6, -44.6, 1, 0.9], [-12.4, -54.0, 0, 0.6], [-10.6, -64.0, 0, 0.35],
    [-9.0, -73.0, 0, 0.12], [-7.2, -80.6], [-4.4, -85.0], [-1.6, -86.8],
  ];
  const T_ROBE_STAND = ST([
    [6.4, -47.0], [7.8, -26.0, 0, 0.3], [9.2, -5.4, 1, 0.75], [0, -4.8, 0, 0.85], [-9.6, -5.2, 1, 1], [-8.8, -26, 0, 0.4], [-7.6, -47.0],
  ]);
  function travelerTop(P, k, dx, dy, ang, opt) {
    const C = P.col;
    opt = opt || {};
    P.group(dx, dy, ang, () => {
      // 头与下巴（斗笠下）
      P.fill(X(HEAD_M, 0.8, -88.2, 1, 0.05));
      const cape = P.flut(T_CAPE, opt.capeAmp || 3.0, 0.6, opt.capeLift || 0.6);
      if (opt.arm) opt.arm();
      P.fill(cape, C.straw);
      fringe(P, cape.slice(5, 9), 3.4, 22, 0.8, C.straw);
      // 蓑衣分层：上层下缘一排极淡的短穗
      P.shade((c) => {
        c.strokeStyle = C.fold; c.lineWidth = Math.max(0.4, 0.7 / P.px);
        c.beginPath(); c.moveTo(-10.6, -63.6); c.quadraticCurveTo(0, -66.0, 10.6, -63.4); c.stroke();
        for (let i = 0; i < 12; i++) { const x = -9.6 + i * 1.8; c.beginPath(); c.moveTo(x, -64.6 + Math.abs(x) * 0.08); c.lineTo(x + 0.2, -61.6 + Math.abs(x) * 0.08); c.stroke(); }
        c.beginPath(); c.moveTo(-8.8, -76.0); c.quadraticCurveTo(0, -79.0, 9.0, -76.2); c.stroke();
      });
      if (opt.hand) opt.hand();
      hatSide(P, 1.6, -97.4, opt.hatAng == null ? 0.05 : opt.hatAng, 1.16);
    });
  }
  def('traveler', 'standSide', [-26, -112, 26, 4], (P, k) => {
    P.fill(BOOT_SIDE);
    P.fill(P.flut(T_ROBE_STAND, 3.0, 0.3, 0.4));
    travelerTop(P, k, 0, 0, 0);
  }, { ph: 0.9 });
  def('traveler', 'walkSide', [-28, -112, 34, 4], (P, k) => {
    const t = k.t + (k.o.walkPhase || 0);
    const fa = footState(t, 0), fb = footState(t, 0.5);
    const ph = (t / TC) % 1;
    const bob = -0.3 * Math.cos(ph * 2 * TAU);
    for (const f of fa.x < fb.x ? [fa, fb] : [fb, fa]) footSide(P, f, 4.8);
    const lower = walkRobe(fa, fb, { hemF: 8.4, hemB: -8.8, toeIn: 5.4, heelIn: 3.2, kneeF: 7.6, kneeB: -8.0, hipF: 6.8, hipB: -7.6, hipY: -48, hemY: -4.8 });
    P.fill(P.flut(lower.concat([[-7.6, -48 + bob], [6.8, -48 + bob]]), 2.4, 0.3, 0.3));
    // 蓑衣随步子轻轻晃（下缘的局部风）
    const sv = P.wl; P.wl = sv - 0.18 * (0.6 + 0.4 * Math.sin(ph * 2 * TAU));
    travelerTop(P, k, 0, bob, 0.02);
    P.wl = sv;
  }, { ph: 0.9 });
  // 顶风前倾站：身体前倾 13°，前腿弓、后腿蹬，前手压住斗笠；蓑衣与下摆被风大幅吹向身后
  // 前摆被风压在腿上（显出膝），后摆向身后拖出
  const T_LEAN_LEGS = [
    [-1.6, -50.0], [6.4, -50.4], [9.6, -40.0], [12.0, -30.0], [13.2, -22.0], [14.4, -12.0], [15.6, -5.6, 1, 0.1],
    [6.0, -5.0, 0, 0.35], [-4.0, -5.8, 0, 0.6], [-12.6, -7.4, 0, 0.85], [-17.4, -9.6, 1, 1], [-14.6, -18.0, 0, 0.75], [-12.0, -30.0, 0, 0.45],
    [-9.6, -40.0, 0, 0.2], [-7.6, -49.0, 0, 0.05],
  ];
  const T_LEAN_FOOT_F = X(BOOT_SIDE, 10.6, 0);
  const T_LEAN_FOOT_B = ST([[-13.8, -6.4], [-9.6, -5.2], [-6.2, -2.6], [-3.8, -0.8], [-3.6, 0, 1], [-15.2, 0, 1], [-15.4, -3.6]]);
  def('traveler', 'leanSide', [-46, -112, 30, 4], (P, k) => {
    const C = P.col;
    // 风从正面来：所有飘动件都吹向身后
    const sv = P.wl; P.wl = -Math.max(Math.abs(sv), 0.75);
    P.fill(T_LEAN_FOOT_B);
    P.fill(T_LEAN_FOOT_F);
    P.fill(P.flut(T_LEAN_LEGS, 3.6, 0.4, 0.8));
    const lean = 0.23;
    const hx = 1.0, hy = -49.0;
    const arm = () => {
      // 前臂从蓑衣前襟伸出，向上压住帽檐
      P.fill(ST([[6.6, -78.4], [10.0, -79.6], [12.6, -86.0], [14.0, -93.2], [12.6, -94.4], [10.4, -88.4], [7.2, -82.6]]));
    };
    const hand = () => P.fill(ST([[11.6, -95.6], [14.2, -96.4], [15.6, -94.6], [14.8, -92.6], [12.4, -92.4]]));
    P.group(hx, hy, lean, () => {
      P.group(-hx, -hy, 0, () => {
        travelerTop(P, k, 0, 0, 0, { capeAmp: 7.0, capeLift: 2.2, arm, hand, hatAng: 0.13 });
      });
    });
    P.wl = sv;
  }, { ph: 0.4 });

  // ================================================================ 船夫
  // 斗笠、短打、长篙；撑篙循环每 2 秒一次：篙入水 → 身体前倾推篙 → 抽篙回收。上身作为一整块绕髋部转动，腿不动
  function cyc(keys, p) {
    const n = keys.length - 1; // 最后一个与第一个同值（p = 1）
    let i = 0;
    while (i < n - 1 && p > keys[i + 1][0]) i++;
    const k0 = keys[i], k1 = keys[i + 1];
    const km = i > 0 ? keys[i - 1] : [keys[n - 1][0] - 1, keys[n - 1][1]];
    const kp = i + 2 <= n ? keys[i + 2] : [keys[1][0] + 1, keys[1][1]];
    const m0 = (k1[1] - km[1]) / (k1[0] - km[0]), m1 = (kp[1] - k0[1]) / (kp[0] - k0[0]);
    const h = k1[0] - k0[0], u = (p - k0[0]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * k0[1] + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * k1[1] + (u3 - u2) * h * m1;
  }
  const B_LEAN = [[0, 2], [0.25, 9], [0.5, 18], [0.65, 14], [0.82, 5], [1, 2]];
  const B_SLIDE = [[0, 118], [0.5, 118], [0.62, 98], [0.76, 80], [0.9, 100], [1, 118]];
  const B_DELTA = [[0, 0], [0.5, 4], [0.65, -2], [0.82, -8], [1, 0]];
  const B_JACKET = [
    [3.6, -85.0], [5.4, -82.2], [7.0, -77.4], [6.8, -70.6], [6.0, -64.4], [5.6, -61.4], [6.6, -52.0, 0, 0.1], [7.4, -43.4, 1, 0.4],
    [0, -42.4, 0, 0.5], [-7.6, -43.0, 1, 0.6], [-7.4, -52.0, 0, 0.2], [-6.8, -58.0], [-5.8, -63.0], [-6.6, -71.0], [-6.2, -79.0], [-4.4, -83.4], [-2.0, -86.2],
  ];
  const B_ARM_NEAR = ST([
    [-2.8, -82.6], [3.4, -81.4], [4.2, -74.0], [5.0, -67.4], [10.0, -72.8], [11.6, -73.0], [11.8, -69.4], [4.6, -63.4],
    [2.2, -61.4], [-1.0, -66.0], [-3.4, -74.0],
  ]);
  const B_ARM_FAR = ST([[-2.6, -62.0], [2.0, -60.4], [6.4, -59.4], [7.6, -59.0], [7.8, -55.4], [2.0, -55.6], [-2.2, -56.6]]);
  const B_HAND_U = ST([[10.0, -74.0], [12.6, -74.6], [13.4, -72.2], [12.6, -69.6], [10.4, -69.6]]);
  const B_HAND_D = ST([[6.0, -59.8], [8.6, -60.0], [9.2, -57.4], [8.2, -55.0], [6.0, -55.4]]);
  const B_LEGS = [
    ST([[-2.4, -50.0], [6.2, -50.8], [8.8, -40.0], [10.6, -29.0], [11.4, -21.8, 1], [5.8, -20.8, 1], [4.6, -29.0], [1.8, -39.0], [-1.8, -44.0]]),
    ST([[6.4, -22.6], [10.8, -22.6], [11.2, -14.0], [11.6, -5.0], [8.4, -4.2], [7.2, -13.0]]),
    ST([[-7.4, -50.8], [1.0, -50.0], [-0.6, -40.0], [-3.4, -30.0], [-5.8, -21.8, 1], [-11.6, -22.8, 1], [-10.4, -31.0], [-9.0, -41.0]]),
    ST([[-10.8, -23.0], [-6.4, -22.4], [-8.4, -13.0], [-10.2, -4.6], [-13.4, -5.2], [-12.6, -14.0]]),
    X(O_SHOE, 9.2, 0, 0.95), X(O_SHOE, -11.6, 0, 0.95),
  ];
  // 篙在躯干坐标里的两端（篙尖、篙尾）和身体前倾角；t 驱动
  const B_HX = 0, B_HY = -50, B_LP = 200;
  function boatPole(t) {
    const p = (((t / 2) % 1) + 1) % 1;
    const lean = (cyc(B_LEAN, p) * Math.PI) / 180;
    const slide = cyc(B_SLIDE, p);
    const del = (cyc(B_DELTA, p) * Math.PI) / 180;
    const Ux = 11.6, Uy = -71.8, Dx = 7.6, Dy = -57.4;
    let ddx = Dx - Ux, ddy = Dy - Uy; const dl = Math.hypot(ddx, ddy); ddx /= dl; ddy /= dl;
    const cs = Math.cos(del), sn = Math.sin(del);
    const ex = ddx * cs - ddy * sn, ey = ddx * sn + ddy * cs;
    const mx = (Ux + Dx) / 2, my = (Uy + Dy) / 2;
    return { lean, mx, my, tip: [mx + ex * slide, my + ey * slide], top: [mx - ex * (B_LP - slide), my - ey * (B_LP - slide)] };
  }
  const leanPt = (q, a) => rot(q[0], q[1], B_HX, B_HY, a);
  def('boatman', 'pole', [-22, -108, 22, 4], (P, k) => {
    const C = P.col;
    const bp = boatPole(k.t);
    for (const l of B_LEGS) P.fill(l);
    P.group(B_HX, B_HY, bp.lean, () => {
      P.group(-B_HX, -B_HY, 0, () => {
        // 腰带垂下的一截
        const sa = P.chain(-5.6, -61.6, 7.0, 4, { a0: -0.15, lift: 0.9, amp: 0.4, ph: 0.6, idle: 0.05 });
        P.strip(sa, (u) => 1.6 - 0.6 * u);
        P.fill(P.flut(B_JACKET, 1.6, 0.4, 0.2));
        P.fill(X(HEAD_M, 2.0, -88.2, 1, 0.06));
        P.fill(B_ARM_FAR);
        P.fill(B_ARM_NEAR);
        P.fill(B_HAND_U); P.fill(B_HAND_D);
        P.shade((c) => { c.fillStyle = C.fold; c.beginPath(); c.moveTo(-6.2, -63.0); c.lineTo(6.0, -62.4); c.lineTo(6.0, -60.4); c.lineTo(-6.4, -61.0); c.fill(); });
        hatSide(P, 2.8, -97.2, 0.08, 0.86);
      });
    });
  }, {
    ph: 0.2,
    tight: [-72, -190, 52, 60],
    // 篙很长：不进离屏画布，直接画在主画布上（在人身后，双手压在篙上），轮廓光按同样的规则画在迎光一侧
    pre(g, x, y, u, t, o, facing) {
      const bp = boatPole(t), a = leanPt(bp.tip, bp.lean), b = leanPt(bp.top, bp.lean);
      const A = [x + facing * a[0] * u, y + a[1] * u], B = [x + facing * b[0] * u, y + b[1] * u];
      const col = palette(o.body || '#1d2128', null).wood;
      let nx = B[1] - A[1], ny = A[0] - B[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const w0 = 1.7 * u, w1 = 2.3 * u; // 篙尖细、篙尾粗
      const quad = (k0, k1, off) => {
        g.beginPath();
        g.moveTo(A[0] + nx * w0 * k0 + off, A[1] + ny * w0 * k0); g.lineTo(B[0] + nx * w1 * k0 + off, B[1] + ny * w1 * k0);
        g.lineTo(B[0] + nx * w1 * k1 + off, B[1] + ny * w1 * k1); g.lineTo(A[0] + nx * w0 * k1 + off, A[1] + ny * w0 * k1);
        g.closePath(); g.fill();
      };
      g.fillStyle = col; quad(-0.5, 0.5, 0);
      if (o.rim) {
        const side = o.rimSide === -1 ? -1 : 1, rw = o.rimWidth || Math.max(1, (u * 100) / 120);
        const sgn = Math.sign(nx * side) || 1; // 法线中朝光的那一侧
        const k = Math.min(0.3, rw / w0);
        g.fillStyle = o.rim; quad(sgn * 0.5, sgn * (0.5 - k), 0);
      }
    },
  });

  // ================================================================ 少年：举剑、仰头笑、船上仰卧
  // 侧影举剑指天：近侧手臂向前上方举直，剑尖指天；头随之仰起；背上只剩剑鞘
  const Y_UP_ARM = [
    [-2.4, -80.8], [1.8, -88.8], [5.4, -96.4], [9.6, -105.8], [11.6, -110.2, 1], [14.0, -110.8, 1], [11.8, -103.6],
    [8.8, -95.0], [5.6, -86.6], [3.8, -81.4], [1.0, -76.4],
  ];
  // 外衫袖子滑到上臂，在臂下兜成一道垂弧
  const Y_UP_DRAPE = [[8.6, -96.4], [7.6, -92.6, 0, 0.5], [6.4, -88.0, 0, 0.9], [4.6, -83.2, 0, 0.7], [2.6, -79.6], [4.4, -84.8], [6.6, -91.4]];
  const Y_UP_FIST = ST([[11.0, -110.6], [13.6, -111.8], [15.2, -113.6], [15.0, -116.0], [12.8, -116.6], [11.2, -114.4]]);
  const Y_UP_FAR = ST([[-4.6, -80.6], [-1.6, -80.8], [-2.6, -70.0], [-4.6, -60.0], [-6.8, -52.6], [-8.4, -47.6], [-10.2, -48.0], [-9.8, -52.8], [-8.2, -60.0], [-6.8, -70.0]]);
  def('youth', 'swordUp', [-30, -162, 26, 4], (P) => {
    const C = P.col;
    const tail = P.chain(-4.6, -100.0, 19, 9, { a0: -1.8, a1: -0.25, lift: 0.85, amp: 0.22, ph: 0.3, idle: 0.04 });
    P.strip(tail, (u) => 3.6 * Math.sin(Math.PI * Math.min(1, 0.3 + u * 0.7)) + 0.5, C.deep);
    const r1 = P.chain(-3.9, -100.6, 22, 9, { a0: -1.5, a1: -0.25, lift: 1.2, amp: 0.4, ph: 1.4, idle: 0.04 });
    const r2 = P.chain(-4.1, -100.0, 18, 8, { a0: -1.2, a1: -0.05, lift: 1.1, amp: 0.45, ph: 3.0, idle: 0.04 });
    P.strip(r2, (u) => 1.2 - u * 0.3, C.ribbon);
    P.strip(r1, (u) => 1.3 - u * 0.3, C.ribbon);
    swordSide(P, -6.3, -99.2, -9.4, -49.5, false, true);
    P.fill(Y_UP_FAR);
    P.fill(P.flut(Y_SIDE_BODY, 7, 0.4, 0.9));
    P.fill(BOOT_SIDE);
    // 仰起的头：绕颈根转
    P.group(-0.25, -88.4, -0.34, () => {
      P.fill(HEAD_M);
      P.fill(ST([[2.95, -11.5], [0.65, -12.2], [-2.35, -11.7], [-4.55, -9.6], [-5.55, -6.4], [-4.95, -3.4], [-3.35, -4.2], [-0.25, -9.0]]), C.deep);
      P.ell(-2.15, -12.6, 1.9, 1.5, -0.35, C.deep);
      P.line([[-3.65, -11.9], [-2.35, -12.5], [-1.05, -13.2]], 1.0, C.ribbon);
    });
    P.fill(P.flut(Y_UP_DRAPE, 1.6, 0.9, 0.4));
    P.fill(Y_UP_ARM);
    // 剑：剑柄在拳中，剑身向上略前倾；剑穗垂在剑首下
    const bx = 0.17, by = -0.985;
    const gx = 13.9, gy = -116.2;
    const cl = P.chain(12.3, -109.4, 6.5, 5, { a0: -0.2, lift: 1.0, amp: 0.35, ph: 2.1, idle: 0.05 });
    P.line(cl, 0.35, C.ribbon);
    const e = cl[cl.length - 1];
    P.ell(e[0], e[1] + 0.6, 0.55, 1.1, 0, C.ribbon, false);
    P.line([[12.6, -109.6], [gx, gy]], 1.15);
    P.line([[gx - 2.0, gy - 0.35], [gx + 2.0, gy + 0.35]], 1.05);
    const tipx = gx + bx * 38, tipy = gy + by * 38;
    P.fill([[gx - 0.62, gy, 1], [gx + 0.62, gy + 0.1, 1], [tipx + 0.3, tipy + 2.2], [tipx, tipy, 1], [tipx - 0.36, tipy + 2.2]], null, false);
    P.fill(Y_UP_FIST);
    P.shade((c) => { c.fillStyle = C.fold; c.fillRect(-7, -64.6, 14, 2.2); });
    folds(P, [Y_SIDE_FOLDS[1], Y_SIDE_FOLDS[2]]);
  }, { ph: 0.6 });

  // 侧影仰头大笑：头后仰，双臂向两侧微张，斗篷从肩头被风扯向身后
  const Y_LAUGH_ARM_N = [
    [-2.0, -82.6], [3.0, -83.0], [8.4, -73.6], [12.6, -66.0], [16.4, -59.0], [17.8, -56.4, 1], [16.2, -54.6, 1],
    [14.2, -54.4, 0, 0.6], [12.0, -56.4, 0, 1], [9.8, -60.0, 0, 0.6], [8.4, -63.8], [4.4, -71.4], [1.4, -75.0],
  ];
  const Y_LAUGH_HAND_N = ST([[16.0, -57.4], [18.2, -57.6], [19.8, -55.6], [20.6, -52.6], [20.0, -50.2], [18.6, -50.2], [17.6, -52.4], [16.2, -54.4]]);
  const Y_LAUGH_ARM_F = [
    [-1.4, -83.4], [-4.8, -81.6], [-7.6, -76.0], [-11.0, -68.6], [-14.4, -61.4], [-16.2, -57.2, 1], [-15.0, -55.0, 1],
    [-13.6, -54.6, 0, 0.6], [-11.6, -57.0, 0, 1], [-10.0, -61.4, 0, 0.5], [-7.8, -67.4], [-5.0, -73.6], [-2.4, -77.4],
  ];
  const Y_LAUGH_HAND_F = ST([[-15.8, -57.0], [-17.8, -57.8], [-19.6, -56.0], [-20.4, -53.0], [-19.8, -50.6], [-18.4, -50.6], [-17.4, -52.8], [-16.0, -54.8]]);
  // 斗篷：若干根“布肋”从肩头的固定锚点垂下，各自受风吹起并带相位差地起伏；下摆在肋间做出布褶的波
  function cloak(P, roots, lens, o) {
    const n = roots.length;
    const ribs = roots.map((r, i) => {
      const u = i / (n - 1);
      return P.chain(r[0], r[1], lens[i], 10, {
        a0: lerp(o.a0top, o.a0bot, u), a1: lerp(o.a1top, o.a1bot, u), lift: lerp(o.liftTop, o.liftBot, u),
        amp: o.amp, ph: o.ph + u * 1.3, idle: 0.03, lag: 0.8, fq: 1.15, curl: (o.curl || 0) * (1 - u),
      });
    });
    const top = ribs[0], bot = ribs[n - 1];
    const hem = [];
    for (let i = 0; i < n - 1; i++) {
      const A = ribs[i][10], B = ribs[i + 1][10];
      if (i > 0) hem.push([A[0], A[1]]);
      // 肋间的下摆略向外鼓，形成柔和的褶波
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1];
      const bulge = 0.09 + 0.03 * Math.sin(P.t * 2.1 + i * 1.7);
      hem.push([mx + dy * bulge, my - dx * bulge]);
    }
    const pts = top.map((q, i) => [q[0], q[1], i === 0 ? 1 : 0]).concat(hem, bot.slice().reverse().map((q, i, arr) => [q[0], q[1], i === arr.length - 1 ? 1 : 0]));
    P.fill(pts, null, false);
    // 布褶：沿中间几根肋画极淡的亮线（只画下半段）
    const lines = [ribs[1].slice(5), ribs[n - 2].slice(4)];
    folds(P, lines, 0.45);
  }
  def('youth', 'laughSide', [-60, -112, 30, 4], (P) => {
    const C = P.col;
    // 斗篷（在身后）
    cloak(P, [[1.2, -85.6], [-0.4, -85.0], [-2.0, -84.0], [-3.4, -82.8], [-4.6, -81.2]], [50, 55, 59, 62, 64], {
      a0top: -1.25, a0bot: -0.3, a1top: -0.25, a1bot: -0.1, liftTop: 1.25, liftBot: 0.92, amp: 0.28, ph: 0.4, curl: 0.15,
    });
    const tail = P.chain(-5.6, -98.6, 19, 9, { a0: -1.9, a1: -0.3, lift: 0.85, amp: 0.25, ph: 0.3, idle: 0.04 });
    P.strip(tail, (u) => 3.6 * Math.sin(Math.PI * Math.min(1, 0.3 + u * 0.7)) + 0.5, C.deep);
    const r1 = P.chain(-5.0, -99.4, 22, 9, { a0: -1.6, a1: -0.3, lift: 1.2, amp: 0.45, ph: 1.4, idle: 0.04 });
    const r2 = P.chain(-5.2, -98.8, 18, 8, { a0: -1.3, a1: -0.1, lift: 1.1, amp: 0.5, ph: 3.0, idle: 0.04 });
    P.strip(r2, (u) => 1.2 - u * 0.3, C.ribbon);
    P.strip(r1, (u) => 1.3 - u * 0.3, C.ribbon);
    P.fill(P.flut(Y_LAUGH_ARM_F, 1.4, 2.0, 0.3));
    P.fill(Y_LAUGH_HAND_F);
    P.fill(P.flut(Y_SIDE_BODY, 7, 0.4, 0.9));
    P.fill(BOOT_SIDE);
    P.group(-0.25, -88.4, -0.48, () => {
      P.fill(HEAD_M);
      P.fill(ST([[2.95, -11.5], [0.65, -12.2], [-2.35, -11.7], [-4.55, -9.6], [-5.55, -6.4], [-4.95, -3.4], [-3.35, -4.2], [-0.25, -9.0]]), C.deep);
      P.ell(-2.15, -12.6, 1.9, 1.5, -0.35, C.deep);
      P.line([[-3.65, -11.9], [-2.35, -12.5], [-1.05, -13.2]], 1.0, C.ribbon);
    });
    P.fill(P.flut(Y_LAUGH_ARM_N, 1.4, 1.0, 0.3));
    P.fill(Y_LAUGH_HAND_N);
    P.shade((c) => { c.fillStyle = C.fold; c.fillRect(-7, -64.6, 14, 2.2); });
    folds(P, [Y_SIDE_FOLDS[1], Y_SIDE_FOLDS[2]]);
  }, { ph: 1.2 });

  // 船上仰卧：头朝人物前方（facing），草帽盖在脸上；近侧腿屈膝立起，远侧腿伸直；一臂枕在脑后，一手扶着胸前的葫芦。原点是臀下的船板面
  const Y_LIE_BODY = [
    [36.0, -5.2], [34.0, -11.6], [28.0, -13.4], [20.0, -13.2], [13.0, -11.6], [6.0, -10.4], [0, -9.8], [-10.0, -8.8],
    [-20.0, -7.6], [-30.0, -6.4], [-38.0, -5.6], [-42.0, -5.0], [-42.4, -0.2, 1], [-20, 0], [0, 0], [20, 0], [40.0, -0.2, 1],
  ];
  // 屈起的腿：长衫从膝头垂下，盖住腿下的空当，像一顶小帐篷
  const Y_LIE_LEG = [
    [6.0, -10.4], [-4.0, -16.6], [-12.4, -22.8], [-16.0, -25.0], [-19.6, -23.4], [-23.4, -14.0], [-26.0, -5.2, 1],
    [-24.0, -2.8, 0, 0.3], [-21.0, -0.4, 1, 0.4], [-12.0, -0.6, 0, 0.6], [-4.0, -0.4], [4.0, -0.4],
  ];
  const Y_LIE_FOOT_F = ST([[-41.6, -5.4], [-43.0, -9.8], [-44.6, -11.0, 1], [-46.4, -10.0], [-46.6, -3.0], [-45.6, 0, 1], [-41.0, 0, 1]]);
  const Y_LIE_SHOE = ST([[-21.6, -5.6], [-25.8, -5.4], [-27.2, -3.6], [-31.8, -2.2], [-33.2, -1.0], [-33.4, -0.1, 1], [-20.6, 0, 1], [-20.4, -2.6]]);
  const Y_LIE_HEAD = mirror(HEAD_M);
  const STRAW_HAT = ST([
    [-12.6, 0.6, 1], [-9.6, -0.5], [-6.2, -1.3], [-5.8, -4.4], [-4.2, -6.6], [-1.4, -7.6], [1.6, -7.6], [4.4, -6.6], [6.0, -4.4], [6.4, -1.3],
    [9.8, -0.5], [12.6, 0.6, 1], [9.6, 1.0], [0, 1.3], [-9.6, 1.0],
  ]);
  def('youth', 'lieBoat', [-50, -34, 62, 4], (P) => {
    const C = P.col;
    // 马尾和发带顺着船板向头顶方向铺开
    const flat = (pts) => pts.map((q) => [q[0], Math.min(q[1], -0.5)]);
    const tail = flat(P.chain(50.0, -4.2, 15, 7, { a0: 1.2, a1: 1.9, lift: 0.3, amp: 0.1, ph: 0.3, idle: 0.02 }));
    P.strip(tail, (u) => 3.0 * (1 - u) + 0.6, C.deep);
    const r1 = flat(P.chain(50.4, -5.0, 16, 7, { a0: 1.0, a1: 1.7, lift: 0.6, amp: 0.3, ph: 1.4, idle: 0.04 }));
    P.strip(r1, (u) => 1.25 - u * 0.3, C.ribbon);
    P.fill(Y_LIE_FOOT_F);
    P.fill(P.flut(Y_LIE_BODY, 0.8, 0.4, 0.1));
    // 头（仰面，头顶朝前）
    P.group(37.6, -5.4, Math.PI / 2, () => { P.fill(Y_LIE_HEAD); });
    P.ell(50.2, -4.6, 1.8, 1.6, 0, C.deep);
    // 枕在脑后的手臂：上臂向头顶方向抬起，肘尖翘在头后
    P.strip([[31.0, -9.0], [42.0, -12.2], [52.4, -13.6]], (u) => 4.8 - u * 1.0);
    P.strip([[52.4, -13.6], [50.6, -7.8], [46.6, -2.4]], (u) => 3.8 - u * 0.6);
    P.ell(52.2, -13.4, 2.0, 1.9, 0);
    // 草帽盖在脸上
    P.group(42.6, -10.8, -0.06, () => {
      P.fill(STRAW_HAT, C.straw);
      P.shade((c) => {
        c.strokeStyle = C.fold; c.lineWidth = Math.max(0.35, 0.6 / P.px);
        c.beginPath(); c.moveTo(-6.0, -1.6); c.quadraticCurveTo(0, -2.8, 6.2, -1.6); c.stroke();
        c.beginPath(); c.moveTo(-5.4, -4.6); c.quadraticCurveTo(0, -5.8, 5.6, -4.6); c.stroke();
      });
    });
    P.fill(Y_LIE_SHOE);
    P.fill(P.flut(Y_LIE_LEG, 0.8, 0.8, 0.1));
    // 扶葫芦的手臂与胸前的葫芦
    P.strip([[32.0, -6.0], [24.6, -3.4], [22.4, -6.0], [24.8, -15.0]], (u) => 3.6 - u * 0.6);
    P.group(26.2, -13.0, 0.08, () => {
      P.c.scale(1.25, 1.25); if (P.sc) P.sc.scale(1.25, 1.25);
      P.ell(0, -2.8, 2.6, 2.7, 0, C.gourd, false);
      P.ell(0, -5.8, 0.8, 0.65, 0, C.gourd, false);
      P.ell(0, -7.1, 1.45, 1.6, 0, C.gourd, false);
      P.ell(-0.8, -3.4, 0.95, 1.15, -0.4, C.gourdHi, false);
      P.line([[0, -8.4], [0, -9.4]], 0.75, C.gourd);
      P.line([[-0.9, -6.0], [0.9, -6.0]], 0.5, C.ribbon);
    });
    P.fill(ST([[23.4, -16.4], [26.0, -17.2], [27.0, -15.0], [25.6, -13.0], [23.4, -13.4]]));
    folds(P, [ST([[30, -6.4], [16, -6.0], [4, -5.6]]), ST([[-2, -14.0], [-8, -17.4], [-13, -21.6]])]);
  }, { ph: 2.4 });

  // ================================================================ 少年与伊人：并肩背影，她的头微偏向他的肩
  def('pair', 'standBack', [-50, -112, 52, 4], (P) => {
    // 先画她，再画他：她被风吹向他一侧的披帛从他身后飘出，不会横穿他的身体
    P.group(10.2, 0, 0, () => heroineBack(P, -0.2), 0.93);
    P.group(-10.6, 0, 0, () => youthBack(P, true));
  }, { ph: 0.8 });

  // ================================================================ 船
  // 侧面木船：100 单位 = 船长；y = 0 是船板面；船头在右（facing = -1 时船头在左）
  const BOAT_HULL = ST([
    [-50.0, -6.4], [-44.0, -3.6], [-30.0, -2.4], [0, -2.0], [30.0, -2.6], [42.0, -4.6], [50.6, -9.6, 1], [47.0, -5.0],
    [40.0, 2.0], [28.0, 7.0], [0, 8.8], [-28.0, 8.0], [-40.0, 4.2], [-47.0, -1.0], [-50.8, -5.4, 1],
  ]);
  // 乌篷：两节拱篷，后节高、前节低；篷节之间与篾片用极淡亮线
  const BOAT_AWN = [
    ST([[-16.4, -1.8, 1], [-16.6, -7.2], [-14.8, -11.6], [-10.6, -14.2], [-4.0, -15.1], [2.0, -14.5], [5.8, -12.2], [7.2, -7.6], [7.0, -1.8, 1]]),
    ST([[5.0, -1.8, 1], [5.0, -7.0], [6.6, -10.6], [10.4, -12.4], [13.6, -11.6], [15.4, -8.6], [15.8, -4.6], [15.6, -1.8, 1]]),
  ];
  const BOAT_DEF = {
    box: [-54, -20, 54, 12], rigid: true,
    build(P, k) {
      const C = P.col, layer = k.o.layer || 'all';
      if (k.o.awning && layer !== 'front') {
        P.fill(BOAT_AWN[0], C.deep);
        P.fill(BOAT_AWN[1], C.deep);
        P.shade((c) => {
          c.strokeStyle = C.fold; c.lineWidth = 0.45; c.lineCap = 'round';
          for (const x of [-10.5, -3.0]) { c.beginPath(); c.moveTo(x - 0.6, -2.2); c.quadraticCurveTo(x - 0.2, -12.0, x + 0.4, -14.4); c.stroke(); }
          c.beginPath(); c.moveTo(5.6, -2.2); c.quadraticCurveTo(5.4, -9.6, 7.0, -12.0); c.stroke();
        });
      }
      if (layer !== 'back') {
        P.fill(BOAT_HULL, C.wood);
        P.shade((c) => {
          c.strokeStyle = C.fold; c.lineWidth = 0.55;
          c.beginPath(); c.moveTo(-46, -2.0); c.quadraticCurveTo(0, 1.2, 46, -3.4); c.stroke();
          c.beginPath(); c.moveTo(-42, 2.6); c.quadraticCurveTo(0, 5.4, 40, 1.6); c.stroke();
        });
      }
    },
  };
  // 船的起伏：±2 像素、周期 4 秒，摇摆 ≤ 0.8°；人画在船上时用同一组 dy / ang
  function boatBob(t) { return { dy: 2 * Math.sin((TAU * t) / 4.0), ang: 0.014 * Math.sin((TAU * t) / 4.6 + 1.2) }; }
  function boat(g, x, y, len, t, o) {
    o = o || {};
    const b = boatBob(t);
    g.save();
    g.translate(x, y + b.dy); g.rotate(b.ang); g.translate(-x, -y);
    const oo = { body: o.body, rim: o.rim, rimSide: o.rimSide, awning: o.awning, alpha: o.alpha, facing: o.facing, rimWidth: o.rimWidth, snow: o.snow, layer: o.layer };
    render(g, BOAT_DEF, x, y, len, t, oo, Math.max(1, len / 360));
    g.restore();
    return b;
  }

  // ================================================================ 绘制入口
  function draw(g, who, pose, x, y, h, t, o) {
    o = o || {};
    const d = POSES[who + '.' + pose];
    if (!d || !(h > 0)) return;
    if (d.pre) {
      const ga = g.globalAlpha; g.globalAlpha = ga * (o.alpha == null ? 1 : o.alpha);
      d.pre(g, x, y, h / 100, t, o, o.facing === -1 ? -1 : 1);
      g.globalAlpha = ga;
    }
    render(g, d, x, y, h, t, o, Math.max(1, h / 120));
  }
  // 通用剪影渲染：h = 100 个设计单位对应的逻辑像素
  function render(g, d, x, y, h, t, o, rimDef) {
    const T = g.getTransform();
    const aligned = Math.abs(T.b) < 1e-9 && Math.abs(T.c) < 1e-9 && T.a > 0 && Math.abs(T.a - T.d) < 1e-6;
    const S = aligned ? T.a : Math.hypot(T.a, T.b) || 1;
    const facing = o.facing === -1 ? -1 : 1;
    const u = h / 100, px = u * S;
    const rimW = (o.rimWidth || rimDef) * S;
    const box = d.boxAt ? d.boxAt(t) : d.box;
    const bl = facing > 0 ? box[0] : -box[2], br = facing > 0 ? box[2] : -box[0];
    const pad = Math.ceil(3 + rimW);
    const dx = aligned ? T.a * x + T.e : x * S, dy = aligned ? T.d * y + T.f : y * S;
    const fx = dx - Math.floor(dx), fy = dy - Math.floor(dy);
    const offX = Math.ceil(-bl * px) + pad, offY = Math.ceil(-box[1] * px) + pad;
    const W = Math.ceil((br - bl) * px) + 2 * pad + 2, H = Math.ceil((box[3] - box[1]) * px) + 2 * pad + 2;
    const snow = clamp(o.snow || 0);
    const M = buf(0, W, H);
    const SN = snow > 0.002 ? buf(2, W, H) : null;
    const wind = clamp(o.wind == null ? 0 : o.wind);
    const k = {
      t, h, px, wind,
      wl: wind * (o.windDir === -1 ? -1 : 1) * facing, // 局部风向：正 = 吹向人物前方
      col: palette(o.body || '#1d2128', o.accent || null),
      o, facing,
    };
    const breath = d.rigid ? 1 : 1 + 0.004 * Math.sin((TAU * t) / 3.6 + (d.ph || 0));
    M.c.setTransform(px * facing, 0, 0, px * breath, offX + fx, offY + fy);
    if (SN) { SN.c.setTransform(px * facing, 0, 0, px * breath, offX + fx, offY + fy); SN.c.fillStyle = '#fff'; SN.c.strokeStyle = '#fff'; }
    const P = makePainter(M.c, SN && SN.c, k);
    d.build(P, k);
    M.c.setTransform(1, 0, 0, 1, 0, 0);
    let src = M;
    if (SN) {
      // 积雪：剪影朝上的边，向上长出 kk 厚、向内压 0.3kk 的白色带
      const kk = Math.max(0.8, snow * 2.6 * px);
      const B = buf(3, W, H), c = B.c;
      c.drawImage(SN.cv, 0, 0, W, H, 0, -kk, W, H);
      c.drawImage(SN.cv, 0, 0, W, H, -kk * 0.35, -kk * 0.75, W, H);
      c.drawImage(SN.cv, 0, 0, W, H, kk * 0.35, -kk * 0.75, W, H);
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(SN.cv, 0, 0, W, H, 0, kk * 0.3, W, H);
      c.globalCompositeOperation = 'source-in';
      const gr = c.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#f6f8fa'); gr.addColorStop(1, '#dfe6ee');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'source-over';
      M.c.globalAlpha = smooth(snow * 4);
      M.c.drawImage(B.cv, 0, 0, W, H, 0, 0, W, H);
      M.c.globalAlpha = 1;
    }
    const glow = clamp(o.glow || 0);
    if (o.rim || glow > 0) {
      const R = buf(1, W, H), c = R.c;
      c.drawImage(M.cv, 0, 0, W, H, 0, 0, W, H);
      if (o.rim) {
        const side = o.rimSide === -1 ? -1 : 1;
        c.globalCompositeOperation = 'source-in';
        c.fillStyle = o.rim; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-atop';
        c.drawImage(M.cv, 0, 0, W, H, -side * rimW, rimW * 0.35, W, H);
      }
      if (glow > 0) {
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = rgba(o.rim || '#fff4dc', 0.16 * glow); c.fillRect(0, 0, W, H);
      }
      c.globalCompositeOperation = 'source-over';
      src = R;
    }
    const ga = g.globalAlpha;
    if (glow > 0) {
      const cx = x + ((bl + br) / 2) * u, cy = y + ((box[1] + box[3]) / 2) * u, rr = Math.max(br - bl, box[3] - box[1]) * u * 0.75;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
      const gc = o.rim || '#fff4dc';
      gr.addColorStop(0, rgba(gc, 0.3 * glow)); gr.addColorStop(0.5, rgba(gc, 0.12 * glow)); gr.addColorStop(1, rgba(gc, 0));
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = ga * (o.alpha == null ? 1 : o.alpha);
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rr, rr * 1.1, 0, 0, TAU); g.fill();
      g.globalCompositeOperation = op;
    }
    g.globalAlpha = ga * (o.alpha == null ? 1 : o.alpha);
    if (aligned) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(src.cv, 0, 0, W, H, Math.floor(dx) - offX, Math.floor(dy) - offY, W, H);
      g.restore();
    } else {
      g.drawImage(src.cv, 0, 0, W, H, x - (offX + fx) / S, y - (offY + fy) / S, W / S, H / S);
    }
    g.globalAlpha = ga;
  }

  // ---------------------------------------------------------------- 其余接口
  function bounds(who, pose, h) {
    const d = POSES[who + '.' + pose];
    if (!d) return { left: 0, right: 0, top: 0, bottom: 0 };
    const b = d.tight || d.box, u = h / 100;
    return { left: b[0] * u, right: b[2] * u, top: b[1] * u, bottom: b[3] * u };
  }
  const poses = {};
  for (const k of Object.keys(POSES)) { const d = POSES[k]; (poses[d.who] = poses[d.who] || []).push(d.pose); }

  XYT.silB = { draw, poses, bounds, boat, boatBob, walkSpeed: (h) => 0.42 * h, _gait: { footState, FT, FH, VU } };
})();
