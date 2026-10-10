/* 第三版镜头组 fg4：c1_steps, c1_ridge, c1_guqin */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // ---------- 共用工具 ----------
  // 建缓存时画模糊层（ctx.filter 只在这里和云影贴图 paintShadow 里用，都只在建缓存时）；临时画布只覆盖逻辑矩形 (bx, by, bw, bh)
  function blurBox(g, bx, by, bw, bh, blur, fn, alpha, op) {
    const m = g.getTransform(), sc = m.a;
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(bw * sc)); t.height = Math.max(1, Math.round(bh * sc));
    const tg = t.getContext('2d'); tg.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (op) g.globalCompositeOperation = op;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, Math.round(m.e + bx * sc), Math.round(m.f + by * sc));
    g.restore();
  }
  // 设备分辨率的临时画布：每次使用前清空，不在帧间保留内容
  const scratchMap = new Map();
  function scratch(key, w, h, k) {
    const S = SS() * (k || 1);
    const pw = Math.max(1, Math.round(w * S)), ph = Math.max(1, Math.round(h * S));
    let c = scratchMap.get(key);
    if (!c) { c = document.createElement('canvas'); scratchMap.set(key, c); }
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.setTransform(S, 0, 0, S, 0, 0);
    return { c, g, S };
  }
  // 第 off 句第 k 字唱出的时刻（相对镜头起点）；取不到时用分镜表里的秒数
  const charAt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  // 拍点包络：约 0.08 s 软起、指数慢落；叠加上一拍的尾巴，所以在拍点处连续
  const softBeat = (c, d, atk) => {
    if (!c.b) return 0;
    const a = atk || 0.08, s0 = Math.max(0, c.b.since), per = c.b.period || 0.83;
    const f = (s) => smooth(s / a) * Math.exp(-s / d);
    return (f(s0) + f(s0 + per)) * (0.4 + 0.6 * (c.b.str == null ? 0.6 : c.b.str));
  };
  // 单次事件的快起慢落包络
  const pulse = (dt, atk, dec) => (dt <= 0 ? 0 : smooth(dt / atk) * Math.exp(-Math.max(0, dt - atk) / dec));
  // 柔光贴图（白色径向渐变），按颜色缓存
  function softDot(col, hard) {
    const key = 'fg4dot|' + col + '|' + (hard || 0);
    return K.cache(key, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      const k = hard || 0;
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.35 + 0.4 * k, rgba(col, 0.75 + 0.2 * k));
      gr.addColorStop(0.7 + 0.2 * k, rgba(col, 0.22)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  // 以 (cx, cy) 为中心按 z 缩放整幅缓存层
  function zoomBlit(g, img, z, cx, cy) {
    if (Math.abs(z - 1) < 1e-4) { g.drawImage(img, 0, 0, W, H); return; }
    g.drawImage(img, cx - cx * z, cy - cy * z, W * z, H * z);
  }
  function poly(g, pts) {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.closePath();
  }

  // ============================================================
  // c1_steps 夏山古阶：深山高林里蜿蜒的古石阶，阶面磨出浅凹，光斑落进去一级级发亮；苔碑刻痕被一块光斑扫过又隐回树荫
  // ============================================================
  (function () {
    const FB = [0.239, 0.619, 1.019, 1.439, 2.259, 2.679, 3.119, 3.519, 3.939, 4.339, 4.879];
    // 透视：焦距 F，视平线 YH，相机高于阶底 HC 米
    const F = 1000, YH = 262, HC = 2.2, CX = 640;
    const proj = (X, Y, Z) => [CX + (F * X) / Z, YH + (F * (HC - Y)) / Z];
    // 路径平面（X 横、Z 纵深）三次贝塞尔，按弧长取点
    const BP = [[0.15, 3.4], [1.5, 11], [-2.9, 20], [-5.9, 30]];
    const bz = (u) => {
      const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
      return [a * BP[0][0] + b * BP[1][0] + c * BP[2][0] + d * BP[3][0], a * BP[0][1] + b * BP[1][1] + c * BP[2][1] + d * BP[3][1]];
    };
    const NS = 600, ARC = [0];
    { let p = bz(0); for (let i = 1; i <= NS; i++) { const q = bz(i / NS); ARC.push(ARC[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); p = q; } }
    const L = ARC[NS];
    function at(s) {
      s = clamp(s, 0, L);
      let lo = 0, hi = NS;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARC[m] <= s) lo = m; else hi = m; }
      const u = (lo + (s - ARC[lo]) / Math.max(1e-6, ARC[hi] - ARC[lo])) / NS;
      const p = bz(u), q = bz(Math.min(1, u + 0.002)), r = bz(Math.max(0, u - 0.002));
      const dx = q[0] - r[0], dz = q[1] - r[1], m = Math.hypot(dx, dz) || 1;
      return { X: p[0], Z: p[1], tx: dx / m, tz: dz / m };
    }
    // 台阶：三段梯段夹两处平台，顶上是牌坊所在的平台
    const RISE = 0.15;
    const STEPS = []; // { s, y0, y1 }
    {
      const fl = [[0.7, 7, 0.68], [8.8, 7, 0.62], [L - 5.6, 9, 0.56]];
      let y = 0;
      for (const [s0, n, run] of fl) for (let i = 0; i < n; i++) { STEPS.push({ s: s0 + i * run, y0: y, y1: y + RISE }); y += RISE; }
    }
    const YTOP = STEPS[STEPS.length - 1].y1;
    const S_ARCH = STEPS[STEPS.length - 1].s + 0.45;
    const width = (s) => lerp(2.5, 1.8, smooth(s / L));
    const yAt = (s) => { let y = 0; for (const st of STEPS) if (s >= st.s) y = st.y1; return y; };
    const ZS = []; for (let i = 0; i <= 200; i++) { const s = (i / 200) * L; ZS.push([at(s).Z, yAt(s)]); }
    const groundAt = (Z) => {
      if (Z <= ZS[0][0]) return 0;
      for (let i = 1; i < ZS.length; i++) if (ZS[i][0] >= Z) return ZS[i][1];
      return YTOP;
    };
    // 路面边缘（side = ±1）或中线（0）上的点
    const edge = (s, side, y) => { const p = at(s), w = width(s) * 0.5; return proj(p.X + side * p.tz * w, y, p.Z - side * p.tx * w); };
    const lateral = (s, off, y) => { const p = at(s); return proj(p.X + p.tz * off, y, p.Z - p.tx * off); };
    const TREADS = [];
    {
      const bounds = [0].concat(STEPS.map((s) => s.s), [L + 2]);
      for (let i = 0; i < bounds.length - 1; i++) {
        const s0 = bounds[i], s1 = bounds[i + 1], y = i === 0 ? 0 : STEPS[i - 1].y1;
        const n = Math.max(1, Math.ceil((s1 - s0) / 0.3));
        const Lp = [], Rp = [];
        for (let k = 0; k <= n; k++) { const s = s0 + ((s1 - s0) * k) / n; Lp.push(edge(s, -1, y)); Rp.push(edge(s, 1, y)); }
        TREADS.push({ i, s0, s1, y, Lp, Rp, vis: y < HC - 0.02 });
      }
    }
    const HAZE = '#dfe9c6', SUN = '#fff1c4';
    const hazeK = (Z) => 1 - Math.exp(-Math.max(0, Z - 4) / 24);
    // 浅凹：阶面中间偏一点，被踩得光滑发暗
    const hollowOf = (tr) => {
      const sm = tr.s0 + Math.min(0.36, (tr.s1 - tr.s0) * 0.5);
      const p = at(sm), off = (h2(tr.i, 5) - 0.5) * 0.22;
      return { s: sm, X: p.X + p.tz * off, Z: p.Z - p.tx * off, y: tr.y, rw: 0.42 * width(sm) / 2.5, rd: Math.min(0.2, (tr.s1 - tr.s0) * 0.32) };
    };
    // 一级级反光的四级台阶（由近到远，隔一级，像一步步走上去）
    const GLINT_STEPS = [2, 4, 6, 8];
    const ARCH = (() => { const p = at(S_ARCH), y = yAt(S_ARCH); return { p, y, base: proj(p.X, y, p.Z), k: F / p.Z }; })();
    // 石碑：路右侧，屏幕约 x≈840；离阶边至少 0.45 米
    const STELE = (() => {
      const Z = 9.2;
      let best = 0;
      for (let i = 0; i <= 400; i++) if (Math.abs(at((i / 400) * L).Z - Z) < Math.abs(at((best / 400) * L).Z - Z)) best = i;
      const s0 = (best / 400) * L, p = at(s0);
      const X = Math.max((815 - CX) * Z / F, p.X + width(s0) * 0.5 + 0.5);
      const y = groundAt(Z) + 0.04;
      return { X, Z, y, b: proj(X, y, Z), k: F / Z };
    })();
    // 树干（世界坐标）：[X, Z, 粗细]
    const TREES = [[-2.5, 5.6, 0.8], [-4.6, 9.8, 1.0], [-6.2, 12.5, 0.62], [-7.2, 15.5, 1.15], [-5.4, 21, 0.75], [-10.5, 24, 1.0], [-3.9, 27.5, 0.55],
      [5.2, 13.0, 0.9], [5.4, 18.5, 1.05], [1.9, 24.5, 0.6], [6.0, 27, 0.8], [0.9, 30.5, 0.45], [-9.5, 33, 0.6], [9.5, 22, 1.2], [3.6, 34, 0.5], [-12, 19, 1.0]];
    // 叶团：许多小叶片，迎光（左上）一侧亮
    function leafCluster(g, x, y, rx, ry, n, dark, light, seed, back) {
      const R = rng(seed);
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, rr = Math.sqrt(R());
        const px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr;
        const lit = clamp(0.5 - 0.5 * ((px - x) / rx * 0.6 + (py - y) / ry * 0.8) + (R() - 0.5) * 0.4);
        const sz = (0.1 + R() * 0.1) * Math.max(rx, ry);
        g.fillStyle = mix(dark, light, lit * (back ? 0.8 : 0.65));
        g.beginPath(); g.ellipse(px, py, sz, sz * 0.42, R() * TAU, 0, TAU); g.fill();
      }
    }
    // ---------- 远景：林间高处的亮雾与远树 ----------
    function buildFar(g) {
      const sk = g.createLinearGradient(0, 0, 0, H);
      sk.addColorStop(0, '#b7c99a'); sk.addColorStop(0.3, '#e4ebc8'); sk.addColorStop(0.55, '#d3e0b2'); sk.addColorStop(1, '#8aa676');
      g.fillStyle = sk; g.fillRect(0, 0, W, H);
      const ax = ARCH.base[0], ay = ARCH.base[1] - 50;
      let gr = g.createRadialGradient(ax, ay, 10, ax, ay, 460);
      gr.addColorStop(0, rgba('#fffbe4', 1)); gr.addColorStop(0.22, rgba('#f7f4d2', 0.75)); gr.addColorStop(0.55, rgba('#e6eec6', 0.25)); gr.addColorStop(1, rgba('#e6eec6', 0));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const R = rng(71);
      // 远树两层：更远的一层更淡、更细
      for (const layer of [0, 1]) {
        blurBox(g, -40, -40, W + 80, H + 80, layer ? 2 : 4, (tg) => {
          for (let i = 0; i < 40; i++) {
            const x = R() * W, wd = (layer ? 10 : 5) + R() * (layer ? 18 : 10);
            const away = clamp(Math.abs(x - ax) / 520);
            const col = mix(layer ? '#9db084' : '#bccb9e', '#e9efd2', (1 - away) * 0.7);
            tg.fillStyle = rgba(col, (layer ? 0.55 : 0.4) * (0.4 + 0.6 * away));
            tg.beginPath(); tg.moveTo(x - wd / 2, -20); tg.lineTo(x + wd / 2, -20); tg.lineTo(x + wd * 0.6, 340); tg.lineTo(x - wd * 0.6, 340); tg.closePath(); tg.fill();
          }
          // 远处树冠团（淡）
          for (let i = 0; i < 26; i++) {
            const x = R() * W, y = R() * 150 - 30, away = clamp(Math.abs(x - ax) / 520);
            leafCluster(tg, x, y, 70 + R() * 60, 40 + R() * 30, 40, mix('#8ea47a', '#dfe7c4', 1 - away), '#eef3d8', 900 + i + layer * 50, true);
          }
        }, layer ? 0.9 : 0.75);
      }
    }
    // ---------- 树干 ----------
    function trunk(g, X, Z, wd, seed) {
      const yb = proj(X, groundAt(Z), Z), k = F / Z, w = wd * k;
      const hz = hazeK(Z);
      const base = mix(mix('#2f3426', '#465238', h2(seed, 1) * 0.6), HAZE, hz * 0.88);
      const lit = mix('#9c9466', HAZE, hz * 0.6);
      const x = yb[0], y = yb[1], top = -40;
      const lean = (h2(seed, 2) - 0.5) * w * 0.4;
      g.save();
      g.beginPath();
      g.moveTo(x - w * 0.78, y + w * 0.05);
      g.quadraticCurveTo(x - w * 0.5, y - w * 0.22, x - w * 0.47, y - w * 0.85);
      g.lineTo(x - w * 0.4 + lean, top);
      g.lineTo(x + w * 0.4 + lean, top);
      g.lineTo(x + w * 0.47, y - w * 0.85);
      g.quadraticCurveTo(x + w * 0.5, y - w * 0.22, x + w * 0.8, y + w * 0.05);
      g.closePath();
      const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      gr.addColorStop(0, lit); gr.addColorStop(0.14, mix(base, lit, 0.45)); gr.addColorStop(0.5, base); gr.addColorStop(1, mix(base, '#141a12', 0.4 * (1 - hz)));
      g.fillStyle = gr; g.fill();
      g.clip();
      const R = rng(seed * 13 + 1);
      g.lineCap = 'round';
      for (let i = 0; i < 10 + w / 5; i++) {
        const xx = x + (R() - 0.5) * w * 0.95;
        g.strokeStyle = rgba(R() < 0.6 ? '#141810' : '#b8ae84', (0.1 + R() * 0.12) * (1 - hz * 0.75));
        g.lineWidth = 0.6 + R() * Math.max(1, w / 26);
        g.beginPath(); g.moveTo(xx, y + 4); g.bezierCurveTo(xx + (R() - 0.5) * 8, y * 0.6, xx + (R() - 0.5) * 8 + lean * 0.5, y * 0.3, xx + lean + (R() - 0.5) * 10, top); g.stroke();
      }
      // 根部苔与一侧的藤
      // 根部与迎光一侧的苔：许多小块，越往上越稀
      for (let i = 0; i < 40; i++) {
        const u = Math.pow(R(), 1.8), yy = y - u * w * 2.2, xx = x - w * 0.45 + R() * w * (0.5 + 0.6 * (1 - u));
        g.fillStyle = rgba(mix(R() < 0.6 ? '#4b7236' : '#6d9448', HAZE, hz * 0.8), 0.35 + R() * 0.3);
        g.beginPath(); g.ellipse(xx, yy, w * (0.03 + R() * 0.06), w * (0.015 + R() * 0.03), (R() - 0.5) * 0.6, 0, TAU); g.fill();
      }
      if (h2(seed, 7) < 0.6) {
        const ivy = mix('#3f6a32', HAZE, hz * 0.8);
        for (let i = 0; i < 26; i++) {
          const yy = y - R() * (y - top) * 0.8, xx = x - w * 0.35 + (R() - 0.5) * w * 0.3 + lean * (1 - yy / y) * 0.5;
          g.fillStyle = rgba(R() < 0.5 ? ivy : mix(ivy, '#9cc28a', 0.5), 0.8);
          g.beginPath(); g.ellipse(xx, yy, w * 0.07 + 1, w * 0.04 + 0.6, R() * 3, 0, TAU); g.fill();
        }
      }
      g.restore();
    }
    // ---------- 牌坊：一间二柱一楼，石造，顶上小庑殿顶 ----------
    function drawArch(g) {
      const { p, y } = ARCH;
      const P = (lx, ly) => proj(p.X + p.tz * lx, y + ly, p.Z - p.tx * lx);
      const half = 1.0, pw = 0.3, xo = half + pw;
      const col = '#55604a', dark = '#3a4232', rim = '#f6efcc';
      const rect = (x0, y0, x1, y1, c) => { poly(g, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]); g.fillStyle = c; g.fill(); };
      // 柱与夹杆石（抱住柱脚的高石块，顶上一道小帽）
      for (const sd of [-1, 1]) {
        const a = sd < 0 ? -xo : half, b = sd < 0 ? -half : xo;
        rect(a, 0, b, 3.0, col);
        rect(a - 0.16, 0, b + 0.16, 0.78, dark);
        rect(a - 0.19, 0.76, b + 0.19, 0.86, mix(dark, '#8a8a6a', 0.35));
        const e = P(a, 0.86), e2 = P(a, 2.3);
        g.strokeStyle = rgba(rim, 0.55); g.lineWidth = 1;
        g.beginPath(); g.moveTo(e[0] + 0.5, e[1]); g.lineTo(e2[0] + 0.5, e2[1]); g.stroke();
      }
      // 小额枋、字牌、大额枋：与柱外皮齐平
      rect(-xo, 2.12, xo, 2.32, col);
      rect(-xo, 2.66, xo, 2.9, col);
      rect(-0.62, 2.32, 0.62, 2.66, mix(col, '#2f3529', 0.25));
      rect(-0.54, 2.36, 0.54, 2.62, mix(col, '#1f241b', 0.45));
      // 雀替：小额枋下、柱内侧的弧形托木
      for (const sd of [-1, 1]) {
        const c0 = P(sd * half, 2.12), c1 = P(sd * (half - 0.42), 2.12), c2 = P(sd * half, 1.78);
        g.beginPath(); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]);
        g.quadraticCurveTo(lerp(c1[0], c2[0], 0.75), lerp(c1[1], c2[1], 0.2), c2[0], c2[1]);
        g.closePath(); g.fillStyle = col; g.fill();
      }
      // 斗栱一排（檐下的小方块）
      rect(-xo - 0.08, 2.9, xo + 0.08, 3.12, dark);
      g.fillStyle = mix(col, '#7a806a', 0.3);
      for (let i = 0; i <= 8; i++) { const lx = lerp(-xo, xo, i / 8); const q = P(lx - 0.06, 3.1), q2 = P(lx + 0.06, 2.95); g.fillRect(q[0], q[1], Math.max(1, q2[0] - q[0]), Math.max(1, q2[1] - q[1])); }
      // 庑殿顶：檐口两端明显起翘，正脊两端鸱吻上卷
      const e0 = P(-xo - 0.62, 3.12), e1 = P(xo + 0.62, 3.12);
      const r0 = P(-xo + 0.25, 3.62), r1 = P(xo - 0.25, 3.62);
      const lift = Math.max(3, ARCH.k * 0.16);
      g.beginPath();
      g.moveTo(e0[0] - lift * 0.5, e0[1] - lift);
      g.quadraticCurveTo(e0[0] + lift * 2, e0[1] + 1, (e0[0] + e1[0]) / 2, e0[1] + 1);
      g.quadraticCurveTo(e1[0] - lift * 2, e1[1] + 1, e1[0] + lift * 0.5, e1[1] - lift);
      g.quadraticCurveTo(r1[0] + lift, r1[1] + lift * 0.6, r1[0], r1[1]);
      g.lineTo(r0[0], r0[1]);
      g.quadraticCurveTo(r0[0] - lift, r0[1] + lift * 0.6, e0[0] - lift * 0.5, e0[1] - lift);
      g.closePath();
      g.fillStyle = '#353d30'; g.fill();
      g.strokeStyle = rgba('#20261b', 0.6); g.lineWidth = 0.7;
      for (let i = 1; i < 12; i++) {
        const f = i / 12, a = [lerp(e0[0], e1[0], f), e0[1] + 1 - Math.pow(Math.abs(f - 0.5) * 2, 3) * lift * 0.8], b = [lerp(r0[0], r1[0], f), r0[1]];
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      g.fillStyle = '#2a3024';
      g.beginPath(); g.moveTo(r0[0] - 2, r0[1] - 2.5); g.lineTo(r1[0] + 2, r1[1] - 2.5); g.lineTo(r1[0], r1[1] + 1); g.lineTo(r0[0], r0[1] + 1); g.closePath(); g.fill();
      for (const [q, sd] of [[r0, -1], [r1, 1]]) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[0] + sd * 1, q[1] - lift * 1.4, q[0] - sd * lift * 0.6, q[1] - lift * 1.2);
        g.lineTo(q[0] - sd * lift * 0.4, q[1] - 1); g.closePath(); g.fill();
      }
      // 受光（左上）的屋脊与左翼角
      g.strokeStyle = rgba(rim, 0.55); g.lineWidth = 1;
      g.beginPath(); g.moveTo(r0[0] - 2, r0[1] - 3); g.lineTo(r1[0] + 2, r1[1] - 3); g.stroke();
      g.beginPath(); g.moveTo(e0[0] - lift * 0.5, e0[1] - lift); g.quadraticCurveTo(r0[0] - lift, r0[1] + lift * 0.6, r0[0], r0[1]); g.stroke();
      // 苔与藤
      g.fillStyle = rgba('#5c7c40', 0.6);
      for (let i = 0; i < 22; i++) {
        const sd = h2(i, 1) < 0.5 ? -1 : 1;
        const q = P(sd * (half + pw * 0.5) + (h2(i, 6) - 0.5) * 0.3, 0.1 + Math.pow(h2(i, 2), 1.6) * 2.4);
        g.beginPath(); g.ellipse(q[0], q[1], 1.2 + h2(i, 4) * 2.2, 0.8 + h2(i, 5) * 1.2, 0, 0, TAU); g.fill();
      }
    }
    // ---------- 石碑 ----------
    function steleShape(g, b, k) {
      const w = 0.58 * k, h = 1.42 * k, x = b[0], y = b[1];
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w / 2 + 0.01 * k, y - h + w * 0.42);
      g.quadraticCurveTo(x - w / 2, y - h, x, y - h - 0.02 * k);
      g.quadraticCurveTo(x + w / 2, y - h, x + w / 2 - 0.01 * k, y - h + w * 0.42);
      g.lineTo(x + w / 2, y);
      g.closePath();
    }
    function steleGlyphs(g, b, k, lit) {
      // 抽象刻痕：三列被风雨磨平的短笔触（不成字）
      const w = 0.58 * k, h = 1.42 * k, x = b[0], y = b[1];
      const R = rng(44);
      for (let col = 0; col < 3; col++) {
        const cx = x - w * 0.24 + col * w * 0.24;
        let yy = y - h + w * 0.6;
        while (yy < y - 0.2 * k) {
          const len = (0.03 + R() * 0.06) * k, ang = [0, Math.PI / 2, 0.6, -0.6][(R() * 4) | 0];
          const ox = (R() - 0.5) * w * 0.12;
          const x0 = cx + ox - Math.cos(ang) * len / 2, y0 = yy - Math.sin(ang) * len / 2;
          const x1 = cx + ox + Math.cos(ang) * len / 2, y1 = yy + Math.sin(ang) * len / 2;
          const wear = R();
          if (wear > 0.25) {
            g.lineCap = 'round';
            g.strokeStyle = rgba('#262b20', (lit ? 0.75 : 0.1) * wear);
            g.lineWidth = Math.max(0.7, 0.013 * k);
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            if (lit) {
              g.strokeStyle = rgba('#fff6d6', 0.6 * wear);
              g.lineWidth = Math.max(0.5, 0.007 * k);
              g.beginPath(); g.moveTo(x0 + 0.007 * k, y0 + 0.007 * k); g.lineTo(x1 + 0.007 * k, y1 + 0.007 * k); g.stroke();
            }
          }
          yy += (0.075 + R() * 0.04) * k;
        }
      }
    }
    function steleBody(g, lit) {
      const { b, k } = STELE;
      const bb = [b[0], b[1] - 0.14 * k];
      g.save();
      g.translate(bb[0], bb[1]); g.rotate(-0.025); g.translate(-bb[0], -bb[1]);
      if (!lit) { steleShape(g, [bb[0] - 0.05 * k, bb[1]], k); g.fillStyle = '#8f8e6c'; g.fill(); }
      steleShape(g, bb, k);
      if (lit) { const gr = g.createLinearGradient(bb[0] - 0.3 * k, 0, bb[0] + 0.3 * k, 0); gr.addColorStop(0, '#d8d0a6'); gr.addColorStop(1, '#b9b28c'); g.fillStyle = gr; }
      else { const gr = g.createLinearGradient(bb[0] - 0.3 * k, 0, bb[0] + 0.3 * k, 0); gr.addColorStop(0, '#73765e'); gr.addColorStop(1, '#565b48'); g.fillStyle = gr; }
      g.fill();
      g.save(); steleShape(g, bb, k); g.clip();
      // 苔：不规则的成片苔垫，聚在碑顶与迎光的左缘、碑脚；刻面上只有零星地衣
      const R = rng(55);
      const clumps = [];
      for (let i = 0; i < 9; i++) {   // 碑顶
        const u = R();
        clumps.push([bb[0] + (u - 0.5) * 0.56 * k, bb[1] - (1.36 - 0.12 * Math.pow(Math.abs(u - 0.5) * 2, 2) - R() * 0.1) * k, (0.07 + R() * 0.06) * k]);
      }
      for (let i = 0; i < 7; i++) {   // 左缘，越往下越稀
        const v = Math.pow(R(), 1.4);
        clumps.push([bb[0] - (0.27 - R() * 0.05) * k, bb[1] - (1.2 - v * 1.0) * k, (0.04 + R() * 0.05) * k * (1 - v * 0.4)]);
      }
      for (let i = 0; i < 5; i++) clumps.push([bb[0] + (R() - 0.5) * 0.56 * k, bb[1] - (0.02 + R() * 0.07) * k, (0.05 + R() * 0.04) * k]); // 碑脚
      const mDark = lit ? '#6f8f3e' : '#3c5a2a', mMid = lit ? '#94b25a' : '#4f7036', mLit = lit ? '#c4d886' : '#6f8f4a';
      for (const [cx, cy, cr] of clumps) {
        // 每块苔垫 = 许多细小的团，外缘参差；下半偏暗，左上偏亮
        const n = 16 + ((R() * 10) | 0);
        for (let j = 0; j < n; j++) {
          const a = R() * TAU, rr = cr * Math.sqrt(R());
          const px = cx + Math.cos(a) * rr * 1.25, py = cy + Math.sin(a) * rr * 0.7;
          const sh = clamp(0.5 + ((py - cy) / cr) * 0.6 - ((px - cx) / cr) * 0.25 + (R() - 0.5) * 0.3);
          g.fillStyle = rgba(sh > 0.6 ? mDark : sh < 0.32 ? mLit : mMid, 0.5 + R() * 0.35);
          const s = cr * (0.12 + R() * 0.2);
          g.beginPath(); g.ellipse(px, py, s, s * (0.55 + R() * 0.3), R() * 3, 0, TAU); g.fill();
        }
      }
      // 刻面上的地衣：极小、淡、少
      for (let i = 0; i < 16; i++) {
        const x = bb[0] + (R() - 0.5) * 0.44 * k, y = bb[1] - (0.2 + R() * 0.9) * k;
        g.fillStyle = rgba(lit ? '#e6e0b0' : '#8e8e6c', 0.18 + R() * 0.2);
        const s = (0.006 + R() * 0.012) * k;
        g.beginPath(); g.ellipse(x, y, s * 1.4, s, R() * 3, 0, TAU); g.fill();
      }
      g.strokeStyle = rgba(lit ? '#55543c' : '#363b2e', lit ? 0.45 : 0.22); g.lineWidth = Math.max(0.6, 0.01 * k);
      g.strokeRect(bb[0] - 0.22 * k, bb[1] - 1.12 * k, 0.44 * k, 0.98 * k);
      steleGlyphs(g, bb, k, lit);
      g.restore();
      g.restore();
    }
    function drawStele(g) {
      const { b, k } = STELE;
      // 接触阴影（光从左后上方来，影子落向右前方）
      g.fillStyle = rgba('#1a2614', 0.35);
      g.beginPath(); g.ellipse(b[0] + 0.22 * k, b[1] + 0.05 * k, 0.6 * k, 0.08 * k, 0.04, 0, TAU); g.fill();
      // 碑座（半埋）
      g.fillStyle = '#454a3a';
      g.beginPath(); g.moveTo(b[0] - 0.44 * k, b[1] + 0.02 * k); g.lineTo(b[0] - 0.4 * k, b[1] - 0.15 * k); g.lineTo(b[0] + 0.4 * k, b[1] - 0.15 * k); g.lineTo(b[0] + 0.44 * k, b[1] + 0.02 * k); g.closePath(); g.fill();
      g.fillStyle = rgba('#a6a27e', 0.5); g.fillRect(b[0] - 0.4 * k, b[1] - 0.16 * k, 0.8 * k, 0.02 * k);
      steleBody(g, false);
      // 碑脚的草
      for (let i = 0; i < 5; i++) grassTuft(g, b[0] - 0.45 * k + i * 0.22 * k, b[1] + 0.03 * k, 0.22 * k, '#4c7438', 0.4, 600 + i);
    }
    function grassTuft(g, x, y, s, col, lean, seed) {
      const R = rng(seed);
      g.strokeStyle = col; g.lineCap = 'round';
      const n = 5 + ((R() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 1.3 + lean * 0.35, len = s * (0.5 + R() * 0.6);
        g.lineWidth = Math.max(0.5, s * 0.06);
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        g.beginPath(); g.moveTo(x + (R() - 0.5) * s * 0.3, y);
        g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.6, ex + lean * len * 0.25, ey + len * 0.12);
        g.stroke();
      }
    }
    function fern(g, x, y, s, ang, col, seed, col2) {
      const R = rng(seed);
      g.save(); g.translate(x, y); g.rotate(ang);
      g.strokeStyle = col; g.lineCap = 'round';
      g.lineWidth = Math.max(0.6, s * 0.02);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.15, -s * 0.5, s * 0.45, -s * 0.85); g.stroke();
      for (let i = 1; i < 15; i++) {
        const u = i / 15, px = s * (0.15 * 2 * u * (1 - u) + 0.45 * u * u), py = -s * (0.5 * 2 * u * (1 - u) + 0.85 * u * u);
        const ln = s * 0.22 * Math.sin(Math.PI * Math.min(1, u * 1.12)) * (0.8 + R() * 0.3);
        for (const sd of [-1, 1]) {
          g.fillStyle = col2 && sd < 0 ? col2 : col;
          g.beginPath(); g.ellipse(px + sd * ln * 0.45, py + ln * 0.12, ln * 0.5, ln * 0.13, sd * 0.35 - 0.2, 0, TAU); g.fill();
        }
      }
      g.restore();
    }
    function mossRock(g, x, y, r, hz, seed) {
      const R = rng(seed);
      g.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = Math.PI + (i / 14) * Math.PI, rr = r * (0.85 + R() * 0.3);
        const px = x + Math.cos(a) * rr * 1.2, py = y + Math.sin(a) * rr * 0.7;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
      const gr = g.createLinearGradient(x - r, y - r * 0.7, x + r, y);
      gr.addColorStop(0, mix('#8c8a6a', HAZE, hz * 0.8)); gr.addColorStop(1, mix('#3a4032', HAZE, hz * 0.85));
      g.fillStyle = gr; g.fill();
      g.fillStyle = rgba(mix('#5f8a3e', HAZE, hz * 0.8), 0.8);
      g.beginPath(); g.ellipse(x - r * 0.15, y - r * 0.55, r * 0.8, r * 0.2, -0.1, 0, TAU); g.fill();
    }
    // 牌坊后的亮雾：远树之前、牌坊之后
    function archGlow(g) {
      const ax = ARCH.base[0], ay = ARCH.base[1] - 45;
      const gr = g.createRadialGradient(ax, ay, 4, ax, ay, 230);
      gr.addColorStop(0, rgba('#fffbe6', 0.95)); gr.addColorStop(0.3, rgba('#f6f3d6', 0.55)); gr.addColorStop(1, rgba('#eef2d4', 0));
      g.fillStyle = gr; g.fillRect(ax - 240, ay - 240, 480, 480);
    }
    // 林下地面的蕨丛、草丛（避开石阶、石碑和牌坊前）
    const GPLANTS = [];
    {
      const R = rng(1201);
      for (let i = 0; i < 150; i++) {
        const s = 0.5 + Math.pow(R(), 0.9) * (L - 8), sd = R() < 0.5 ? -1 : 1;
        const p = at(s), off = sd * (width(s) * 0.5 + 0.9 + Math.pow(R(), 0.7) * 7);
        const X = p.X + p.tz * off, Z = p.Z - p.tx * off;
        if (Z < 4.6 || Math.hypot(X - STELE.X, Z - STELE.Z) < 1.2) continue;
        GPLANTS.push({ s, X, Z, kind: R() < 0.6 ? 'fern' : 'grass', size: 0.5 + R() * 0.5, seed: 1300 + i, gp: true });
      }
    }
    function groundPlant(g, it) {
      const q = proj(it.X, groundAt(it.Z), it.Z), k = F / it.Z, hz = hazeK(it.Z);
      const col = mix(it.seed % 3 ? '#3f6634' : '#55803e', HAZE, hz * 0.85), col2 = mix('#8cb468', HAZE, hz * 0.7);
      if (it.kind === 'fern') {
        const ff = it.size * 0.8 * k;
        for (let m = 0; m < 5; m++) fern(g, q[0] + (m - 2) * ff * 0.1, q[1], ff * (0.75 + h2(m, it.seed) * 0.45), (m - 2) * 0.48 + (h2(m, it.seed + 3) - 0.5) * 0.25, rgba(col, 0.95), it.seed * 7 + m, rgba(col2, 0.9));
      } else grassTuft(g, q[0], q[1], it.size * 0.35 * k, rgba(col, 0.9), 0.45, it.seed);
    }
    // ---------- 主层 A：山坡、远处树干、牌坊、石阶 ----------
    const CREST = [[-40, 300], [140, 262], [280, 236], [390, 222], [470, 218], [560, 224], [700, 240], [860, 256], [1040, 272], [1320, 290]];
    function buildMainA(g) {
      g.save();
      g.beginPath(); g.moveTo(-40, H + 40);
      CREST.forEach((p) => g.lineTo(p[0], p[1]));
      g.lineTo(1320, H + 40); g.closePath();
      const gg = g.createLinearGradient(0, 215, 0, H);
      gg.addColorStop(0, '#bccb9c'); gg.addColorStop(0.1, '#8aa36c'); gg.addColorStop(0.35, '#4f6e3e'); gg.addColorStop(1, '#22311d');
      g.fillStyle = gg; g.fill();
      g.clip();
      // 地面：落叶、苔、暗处，越近越大
      const R = rng(9);
      for (let i = 0; i < 700; i++) {
        const y = 222 + Math.pow(R(), 0.75) * 520, x = R() * W;
        const sz = clamp((y - 210) / 510);
        const c = R();
        g.fillStyle = rgba(c < 0.5 ? '#1c2a17' : (c < 0.8 ? '#6f9150' : '#a39a64'), (0.06 + R() * 0.14) * (0.5 + sz));
        g.beginPath(); g.ellipse(x, y, 3 + sz * 34 * R(), 1 + sz * 8 * R(), (R() - 0.5) * 0.4, 0, TAU); g.fill();
      }
      g.restore();
      const trees = TREES.slice().sort((a, b) => b[1] - a[1]);
      const farItems = [];
      for (const t of trees) if (t[1] > 17 && Math.abs(proj(t[0], 0, t[1])[0] - ARCH.base[0]) > 150) farItems.push({ Z: t[1], tree: t });
      for (const gp of GPLANTS) if (gp.Z > 17) farItems.push(gp);
      farItems.sort((a, b) => b.Z - a.Z);
      for (const it of farItems) { if (it.tree) trunk(g, it.tree[0], it.tree[1], it.tree[2], (it.tree[0] * 10 + it.tree[1]) | 0); else groundPlant(g, it); }
      archGlow(g);
      drawArch(g);
      for (let i = TREADS.length - 1; i >= 0; i--) drawTread(g, i);
      // 近处更暗（树荫更深），远处亮
      const vg = g.createLinearGradient(0, 380, 0, H);
      vg.addColorStop(0, 'rgba(20,32,18,0)'); vg.addColorStop(1, 'rgba(20,32,18,0.28)');
      g.fillStyle = vg; g.fillRect(0, 380, W, H - 380);
    }
    // 磨损的阶沿：中间被踩低（世界 Y 下沉 dip 米），返回从右到左的点
    function noseEdge(s, y, dip, rev) {
      const out = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10, f = rev ? 1 - u : u, off = (f - 0.5) * width(s);
        const d = dip * Math.pow(Math.sin(Math.PI * f), 2) * (0.8 + 0.4 * h2(s * 10 | 0, k));
        out.push(lateral(s, off, y - d));
      }
      return out;
    }
    function drawTread(g, i) {
      const tr = TREADS[i];
      const Zm = at((tr.s0 + tr.s1) / 2).Z, hz = hazeK(Zm), sc = F / Zm;
      const DIP = 0.025;
      if (tr.vis) {
        // 踏面：左缘（前→后）、右缘（后→前）、磨低的前缘（右→左）
        const pts = tr.Lp.concat(tr.Rp.slice().reverse(), i > 0 ? noseEdge(tr.s0, tr.y, DIP, true) : []);
        poly(g, pts);
        const ya = tr.Lp[tr.Lp.length - 1][1], yb2 = tr.Lp[0][1];
        const gr = g.createLinearGradient(0, ya, 0, yb2);
        const tone = h2(i, 2) * 0.14;
        gr.addColorStop(0, mix(mix('#94937a', '#7e8a6a', tone), HAZE, hz * 0.85)); gr.addColorStop(1, mix(mix('#9a967e', '#848d6e', tone), HAZE, hz * 0.8));
        g.fillStyle = gr; g.fill();
        g.save(); poly(g, pts); g.clip();
        const R = rng(100 + i);
        // 苔：沿两端与后缘的缝聚成小块
        for (let k = 0; k < 22; k++) {
          const s = lerp(tr.s0, tr.s1, Math.pow(R(), 0.6)), sd = R() < 0.5 ? -1 : 1;
          const off = sd * width(s) * 0.5 * (1 - Math.pow(R(), 3) * 0.55);
          const q = lateral(s, off, tr.y);
          g.fillStyle = rgba(mix(R() < 0.6 ? '#4f733a' : '#76954c', HAZE, hz * 0.8), 0.25 + R() * 0.3);
          const rx = (0.03 + R() * 0.1) * sc;
          g.beginPath(); g.ellipse(q[0], q[1], rx, Math.max(0.5, rx * 0.3 * (HC - tr.y) / Zm * 3), 0, 0, TAU); g.fill();
        }
        // 风化的斑点（地衣）
        for (let k = 0; k < 14; k++) {
          const s = lerp(tr.s0, tr.s1, R()), off = (R() - 0.5) * width(s) * 0.9;
          const q = lateral(s, off, tr.y);
          g.fillStyle = rgba(R() < 0.5 ? '#5d5c48' : '#c3bf9e', (0.12 + R() * 0.12) * (1 - hz));
          g.beginPath(); g.ellipse(q[0], q[1], (0.02 + R() * 0.04) * sc, Math.max(0.4, 0.01 * sc), 0, 0, TAU); g.fill();
        }
        if (tr.s1 - tr.s0 < 1.2) {
          g.strokeStyle = rgba('#4e4c3c', 0.28 * (1 - hz));
          g.lineWidth = Math.max(0.6, sc * 0.011);
          const nseam = 1 + ((h2(i, 3) * 2.5) | 0);
          for (let k = 1; k <= nseam; k++) {
            const f = k / (nseam + 1) + (h2(i, k) - 0.5) * 0.14;
            if (Math.abs(f - 0.5) < 0.14) continue;
            const a0 = lateral(tr.s0, (f - 0.5) * width(tr.s0), tr.y), a1 = lateral(tr.s1, (f - 0.5) * width(tr.s1), tr.y);
            g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke();
          }
        }
        // 浅凹：被踩得光滑，颜色略浅、略暖，边缘柔和；近侧内壁一线暗
        if (tr.s1 - tr.s0 < 1.3 && i > 0) {
          const ho = hollowOf(tr);
          const c0 = proj(ho.X, ho.y, ho.Z), k = F / ho.Z;
          const rx = ho.rw * k, ry = Math.max(1, ho.rd * k * ((HC - ho.y) / ho.Z));
          g.save(); g.translate(c0[0], c0[1]); g.scale(1, ry / rx);
          const hg = g.createRadialGradient(0, -rx * 0.15, 0, 0, 0, rx);
          hg.addColorStop(0, rgba('#c4bf9f', 0.5 * (1 - hz * 0.8))); hg.addColorStop(0.6, rgba('#b2ad8e', 0.3 * (1 - hz * 0.8))); hg.addColorStop(1, rgba('#b2ad8e', 0));
          g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill();
          const sh = g.createRadialGradient(0, rx * 0.55, 0, 0, rx * 0.55, rx * 0.7);
          sh.addColorStop(0, rgba('#4a4a3a', 0.22 * (1 - hz))); sh.addColorStop(1, rgba('#4a4a3a', 0));
          g.fillStyle = sh; g.beginPath(); g.arc(0, rx * 0.55, rx * 0.7, 0, TAU); g.fill();
          g.restore();
        }
        g.restore();
        if (i > 0) {
          // 阶沿：磨圆的前缘一道淡亮
          const ne = noseEdge(tr.s0, tr.y, DIP, false);
          g.strokeStyle = rgba('#ece6c6', 0.5 * (1 - hz * 0.6));
          g.lineWidth = Math.max(0.6, sc * 0.014);
          g.beginPath(); ne.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
        }
      }
      if (i > 0) {
        const st = STEPS[i - 1], zr = at(st.s).Z, sr = F / zr;
        const top = noseEdge(st.s, st.y1, DIP, false), c2 = edge(st.s, 1, st.y0), d = edge(st.s, -1, st.y0);
        const rp = top.concat([c2, d]);
        poly(g, rp);
        const rg = g.createLinearGradient(0, top[0][1], 0, d[1]);
        rg.addColorStop(0, mix(mix('#5f634e', '#4d5641', h2(i, 9)), HAZE, hz * 0.85)); rg.addColorStop(1, mix('#3c4333', HAZE, hz * 0.85));
        g.fillStyle = rg; g.fill();
        g.save(); poly(g, rp); g.clip();
        const R = rng(400 + i);
        for (let k = 0; k < 7; k++) {
          const f = R(), q = [lerp(d[0], c2[0], f), lerp(d[1], c2[1], f)];
          g.fillStyle = rgba(mix('#3d602e', HAZE, hz * 0.8), 0.35 + R() * 0.3);
          g.beginPath(); g.ellipse(q[0], q[1], (0.05 + R() * 0.12) * sr, (0.03 + R() * 0.05) * sr, 0, 0, TAU); g.fill();
        }
        g.restore();
      }
    }
    // ---------- 主层 B：阶边草蕨、灌丛、石碑、近处树干、树冠 ----------
    function buildMainB(g) {
      // 阶边与阶缝的草蕨（由远到近）
      const items = [];
      for (let s = 0.2; s < L - 0.5; s += 0.36) for (const sd of [-1, 1]) items.push({ s: s + h2(s * 10, sd + 3) * 0.3, sd });
      for (const st of STEPS) if (st.y1 < HC + 0.3) items.push({ s: st.s + 0.02, sd: 0, joint: true });
      // 灌丛：路两侧稍远处
      for (let s = 0.4; s < L - 7; s += 1.7) for (const sd of [-1, 1]) items.push({ s: s + h2(s * 7, sd) * 0.9, sd, bush: true, rock: h2(s * 5, sd + 9) < 0.55 });
      for (const gp of GPLANTS) if (gp.Z <= 17) items.push(gp);
      items.sort((a, b) => at(b.s).Z - at(a.s).Z);
      const Zst = STELE.Z;
      let steleDone = false;
      for (const it of items) {
        const p = at(it.s), Z = p.Z, k = F / Z, hz = hazeK(Z);
        if (!steleDone && Z < Zst) { drawStele(g); steleDone = true; }
        const y = yAt(it.s + 0.01);
        const col = mix(h2(it.s * 31, 2) < 0.5 ? '#46703a' : '#638a42', HAZE, hz * 0.85);
        const col2 = mix('#9cc28a', HAZE, hz * 0.7);
        if (it.gp) { groundPlant(g, it); continue; }
        if (it.joint) {
          for (const f of [-0.42, 0.4]) {
            const q = lateral(it.s, f * width(it.s), y);
            if (h2(it.s * 7, f * 10) < 0.6) grassTuft(g, q[0], q[1], 0.14 * k, rgba(col, 0.92), 0.45, (it.s * 100) | 0);
          }
          continue;
        }
        if (it.bush) {
          const off = it.sd * (width(it.s) * 0.5 + 0.9 + h2(it.s * 3, 4) * 2.2);
          const qx = p.X + p.tz * off, qz = Z - p.tx * off;
          if (Math.hypot(qx - STELE.X, qz - STELE.Z) < 1.8) continue;
          const q = proj(qx, groundAt(qz), qz), kk = F / qz, hq = hazeK(qz);
          if (it.rock) {
            // 地上的一丛蕨（三五片叶向外张开）
            const ff = (0.5 + h2(it.s, 8) * 0.4) * kk;
            for (let m = 0; m < 5; m++) fern(g, q[0] + (m - 2) * ff * 0.12, q[1], ff * (0.8 + h2(m, it.s * 9) * 0.4), (m - 2) * 0.45 + (h2(m, 3) - 0.5) * 0.2, rgba(mix(m % 2 ? '#3d6534' : '#55803e', HAZE, hq * 0.85), 0.95), (it.s * 77 + m) | 0, rgba(mix('#8fb86a', HAZE, hq * 0.7), 0.9));
            continue;
          }
          const r = (0.3 + h2(it.s, 8) * 0.45) * kk;
          leafCluster(g, q[0], q[1] - r * 0.42, r, r * 0.5, 70, mix('#1e3019', HAZE, hq * 0.88), mix('#94ba68', HAZE, hq * 0.6), (it.s * 91 + it.sd * 7) | 0);
          continue;
        }
        const w = width(it.s) * 0.5 + 0.04 + h2(it.s * 3, it.sd) * 0.16;
        const q = lateral(it.s, it.sd * w, y + 0.02);
        if (it.s > L - 7) { grassTuft(g, q[0], q[1], 0.22 * k, rgba(col, 0.9), 0.45, (it.s * 53) | 0); continue; }
        if (h2(it.s * 13, it.sd) < 0.55) fern(g, q[0], q[1], (0.45 + h2(it.s, 9) * 0.35) * k, it.sd * (0.5 + h2(it.s, 4) * 0.55) - 0.1, rgba(col, 0.95), (it.s * 37) | 0, rgba(col2, 0.9));
        else grassTuft(g, q[0], q[1], 0.3 * k, rgba(col, 0.92), 0.45, (it.s * 53) | 0);
      }
      if (!steleDone) drawStele(g);
      const trees = TREES.slice().sort((a, b) => b[1] - a[1]);
      for (const t of trees) if (t[1] <= 17) trunk(g, t[0], t[1], t[2], (t[0] * 10 + t[1]) | 0);
      // 树冠：画面上沿成片的叶，左上留出透光的缺口
      const R = rng(511);
      for (let i = 0; i < 34; i++) {
        const x = -60 + R() * (W + 120), y = -40 + R() * 90;
        const gap = Math.exp(-Math.pow((x - 330) / 170, 2));
        if (gap > 0.6 && R() < 0.8) continue;
        leafCluster(g, x, y, 80 + R() * 70, 34 + R() * 26, 120, '#1e2c1a', '#7da35a', 700 + i);
      }
      // 透光的嫩叶（亮黄绿，叶后有光）
      for (let i = 0; i < 10; i++) {
        const x = 180 + R() * 330, y = -10 + R() * 60;
        leafCluster(g, x, y, 34 + R() * 26, 16 + R() * 10, 40, '#6f9a48', '#d6e89a', 760 + i, true);
      }
      // 光柱：左上方树冠缺口射下（烘进本层，节拍只体现在光斑上）
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.85;
      buildRays(g);
      g.restore();
    }
    // 光斑照到石碑时的样子（单独缓存，用椭圆裁切叠上去）
    function buildSteleLit(g) { steleBody(g, true); }
    let treadPath = null;
    function treadMask() {
      if (treadPath) return treadPath;
      const p = new Path2D();
      for (const tr of TREADS) if (tr.vis) {
        const pts = tr.Lp.concat(tr.Rp.slice().reverse());
        pts.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])));
        p.closePath();
      }
      treadPath = p;
      return p;
    }
    // ---------- 近景：右侧虚化的大树干（歌词区背景）、左下虚化的蕨 ----------
    // 近景两块（只缓存各自所在的矩形）：右侧虚化的大树干（歌词区背景）、左下虚化的蕨
    const NEAR_R = [900, -60, 440, H + 120], NEAR_L = [-80, 400, 600, 400];
    function buildNearR(g) {
      g.translate(-NEAR_R[0], -NEAR_R[1]);
      blurBox(g, 900, -60, 440, H + 120, 7, (tg) => {
        // 受光边整镜留在第二列歌词左侧（推到头时约 x≤1045）
        const x0 = 995, gr = tg.createLinearGradient(x0, 0, W + 40, 0);
        gr.addColorStop(0, '#3a4430'); gr.addColorStop(0.07, '#283222'); gr.addColorStop(0.5, '#1c2419'); gr.addColorStop(1, '#171e14');
        tg.fillStyle = gr;
        tg.beginPath(); tg.moveTo(x0 + 10, -60); tg.bezierCurveTo(x0 - 4, 200, x0 + 2, 480, x0 - 24, H + 60); tg.lineTo(W + 60, H + 60); tg.lineTo(W + 60, -60); tg.closePath(); tg.fill();
        tg.strokeStyle = rgba('#b6ad78', 0.4); tg.lineWidth = 5;
        tg.beginPath(); tg.moveTo(x0 + 12, -60); tg.bezierCurveTo(x0 - 2, 200, x0 + 4, 480, x0 - 22, H + 60); tg.stroke();
        const R = rng(81);
        for (let i = 0; i < 30; i++) {
          const x = x0 + 30 + R() * 230;
          tg.strokeStyle = rgba(R() < 0.5 ? '#11160f' : '#344030', 0.22); tg.lineWidth = 3 + R() * 6;
          tg.beginPath(); tg.moveTo(x, -60); tg.lineTo(x + (R() - 0.5) * 20, H + 60); tg.stroke();
        }
      });
    }
    function buildNearL(g) {
      g.translate(-NEAR_L[0], -NEAR_L[1]);
      blurBox(g, -80, 400, 600, 400, 5, (tg) => {
        for (let i = 0; i < 8; i++) fern(tg, -40 + i * 38 + h2(i, 1) * 30, H + 40, 240 + h2(i, 2) * 120, -0.25 + i * 0.15 + h2(i, 3) * 0.2, i % 2 ? '#1d2c18' : '#283d21', 300 + i, i % 3 ? null : '#3d5a2c');
      });
    }
    // 光柱（左上方高处的阳光透过树冠缺口）
    const RAY_ANG = 1.12;
    function buildRays(g) {
      blurBox(g, -100, -100, W + 200, H + 200, 16, (tg) => {
        const beams = [[300, 0.2, 60], [380, 0.26, 40], [450, 0.16, 80], [560, 0.12, 36], [250, 0.1, 50]];
        for (const [x, a, w] of beams) {
          const dx = Math.cos(RAY_ANG), dy = Math.sin(RAY_ANG), len = 950;
          const x0 = x - 120, y0 = -40;
          const gr = tg.createLinearGradient(x0, y0, x0 + dx * len, y0 + dy * len);
          gr.addColorStop(0, rgba(SUN, a)); gr.addColorStop(0.5, rgba(SUN, a * 0.6)); gr.addColorStop(1, rgba(SUN, 0));
          tg.fillStyle = gr;
          const nx = -dy * w / 2, ny = dx * w / 2;
          tg.beginPath(); tg.moveTo(x0 - nx * 0.5, y0 - ny * 0.5); tg.lineTo(x0 + nx * 0.5, y0 + ny * 0.5);
          tg.lineTo(x0 + dx * len + nx * 1.8, y0 + dy * len + ny * 1.8); tg.lineTo(x0 + dx * len - nx * 1.8, y0 + dy * len - ny * 1.8); tg.closePath(); tg.fill();
        }
      });
    }
    // 光斑（世界坐标，随树叶缓慢游移，最近处 ≤15 px/s）：阶面上的裁在踏面里；路边地上的单独一组
    const DAPS = [], GDAPS = [];
    {
      const R = rng(303);
      for (let i = 0; i < 110; i++) {
        const s = Math.pow(R(), 1.15) * (L - 1.5);
        DAPS.push({ s, off: (R() - 0.5) * 1.7, r: 0.05 + R() * 0.13, ph: R() * TAU, fq: 0.1 + R() * 0.14, amp: 0.012 + R() * 0.012, seed: i });
      }
      for (let i = 0; i < 70; i++) {
        const s = Math.pow(R(), 1.1) * (L - 3), sd = R() < 0.5 ? -1 : 1;
        GDAPS.push({ s, off: sd * (1.4 + R() * 3.5), r: 0.08 + R() * 0.2, ph: R() * TAU, fq: 0.1 + R() * 0.14, amp: 0.012 + R() * 0.012, seed: 200 + i });
      }
    }
    function dapple(g, d, lt, dot, beat, ground) {
      const p = at(d.s);
      const sway = d.amp * Math.sin(TAU * d.fq * lt + d.ph) + 0.5 * d.amp * Math.sin(TAU * d.fq * 1.7 * lt + d.ph * 2);
      const off = d.off + sway, X = p.X + p.tz * off, Z = p.Z - p.tx * off;
      const y = ground ? groundAt(Z) : yAt(d.s);
      if (y >= HC - 0.05) return;
      const q = proj(X, y, Z), k = F / Z;
      // 树叶开合：光斑慢慢亮、慢慢暗
      const vis = smooth((noise1(lt * 0.3 + d.seed * 3.1, d.seed) - 0.22) / 0.5);
      if (vis < 0.02) return;
      const rx = d.r * k, ry = Math.max(0.6, rx * ((HC - y) / Z) * 1.15);
      g.globalAlpha = vis * (0.36 + 0.07 * beat) * (1 - hazeK(Z) * 0.55) * (ground ? 0.75 : 1);
      g.drawImage(dot, q[0] - rx, q[1] - ry, rx * 2, ry * 2);
    }
    function draw(g, c) {
      const lt = c.lt;
      const tPush = charAt(c, 4, 0, FB);
      // 第19句第5字起沿台阶缓推 1.00→1.06（smoothstep，峰值约 1.8%/s）
      const z = 1 + 0.06 * smooth((lt - tPush) / 5.0);
      const CXZ = 500, CYZ = 330;
      const far = K.cache('fg4steps-far', W, 330, 1, buildFar);
      const mainA = K.cache('fg4steps-mainA', W, H, 1, buildMainA);
      const mainB = K.cache('fg4steps-mainB', W, H, 1, buildMainB);
      const nR = K.cache('fg4steps-nearR', NEAR_R[2], NEAR_R[3], 1, buildNearR);
      const nL = K.cache('fg4steps-nearL', NEAR_L[2], NEAR_L[3], 1, buildNearL);
      const zf = 1 + (z - 1) * 0.6, zn = 1 + (z - 1) * 1.2;
      // 远景只在山脊以上露出
      g.drawImage(far, CXZ - CXZ * zf, CYZ - CYZ * zf, W * zf, 330 * zf);
      g.save();
      g.translate(CXZ - CXZ * z, CYZ - CYZ * z); g.scale(z, z);
      g.drawImage(mainA, 0, 0, W, H);
      const beat = softBeat(c, 0.5);
      const dot = softDot('#fff0c0', 0.35);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const d of GDAPS) dapple(g, d, lt, dot, beat, true);
      g.restore();
      // 阶面上的光斑与浅凹反光（第19句第5–8字逐字一级级亮）
      g.save();
      g.clip(treadMask());
      g.globalCompositeOperation = 'lighter';
      for (const d of DAPS) dapple(g, d, lt, dot, beat, false);
      for (let j = 0; j < GLINT_STEPS.length; j++) {
        const tr = TREADS[GLINT_STEPS[j]];
        if (!tr || !tr.vis) continue;
        const t0 = charAt(c, 4 + j, 0, FB);
        const e = pulse(lt - t0 + 0.03, 0.08, 0.8);
        // 光斑落进凹里之后留一会儿（树叶慢慢合上前）
        const stay = smooth((lt - t0) / 0.3) * (1 - smooth((lt - t0 - 1.6) / 1.2));
        if (e + stay < 0.005) continue;
        const ho = hollowOf(tr), q = proj(ho.X, ho.y, ho.Z), k = F / ho.Z;
        const rx = ho.rw * k * 1.05, ry = Math.max(1, ho.rd * k * ((HC - ho.y) / ho.Z) * 1.25);
        g.globalAlpha = clamp(0.32 * e + 0.2 * stay);
        g.drawImage(dot, q[0] - rx * 0.8, q[1] - ry * 0.8, rx * 1.6, ry * 1.6);
        g.globalAlpha = clamp(0.3 * e);
        g.drawImage(softDot('#fff6dc', 0.6), q[0] - rx * 0.35, q[1] - ry * 0.7, rx * 0.7, ry * 0.7);
      }
      g.restore();
      g.drawImage(mainB, 0, 0, W, H);
      // 石碑上的光斑：第19句第9字滑上刻痕，第11字时已移开
      const tIn = charAt(c, 8, 0, FB), tOut = charAt(c, 10, 0, FB);
      const fa = smooth((lt - tIn + 0.05) / 0.4) * (1 - smooth((lt - (tOut - 0.55)) / 0.55));
      if (fa > 0.003) {
        const lit = K.cache('fg4steps-stelelit', W, H, 1, buildSteleLit);
        const { b, k } = STELE;
        const u = clamp((lt - tIn + 0.05) / (tOut - tIn + 0.05));
        const cx = b[0] - 0.12 * k + u * 0.14 * k, cy = b[1] - 0.78 * k + u * 0.06 * k;
        const r = 0.2 * k;
        const bx = Math.floor(b[0] - 0.6 * k), by = Math.floor(b[1] - 1.8 * k), bw = Math.ceil(1.2 * k), bh = Math.ceil(1.9 * k);
        const sc = scratch('fg4steps-fleck', bw, bh);
        sc.g.save();
        // 缓存画布是逻辑尺寸 × 渲染倍率：源矩形要乘同一倍率
        const ls = lit.width / W;
        sc.g.drawImage(lit, bx * ls, by * ls, bw * ls, bh * ls, 0, 0, bw, bh);
        sc.g.globalCompositeOperation = 'destination-in';
        // 叶隙漏下的光：不规则、略横的一块（三团软光叠成），不是正圆
        const gap = K.cache('fg4steps-leafgap', 96, 64, 1, (lg) => {
          for (const [x, y, rx, ry, al] of [[40, 34, 30, 20, 1], [62, 28, 22, 15, 0.9], [30, 24, 16, 12, 0.75], [58, 42, 14, 10, 0.7]]) {
            const gr = lg.createRadialGradient(0, 0, 0, 0, 0, 1);
            gr.addColorStop(0, rgba('#ffffff', al)); gr.addColorStop(0.55, rgba('#ffffff', al * 0.8)); gr.addColorStop(1, rgba('#ffffff', 0));
            lg.save(); lg.translate(x, y); lg.scale(rx, ry); lg.fillStyle = gr; lg.beginPath(); lg.arc(0, 0, 1, 0, TAU); lg.fill(); lg.restore();
          }
        });
        sc.g.drawImage(gap, cx - bx - r * 1.5, cy - by - r * 1.05, r * 3.0, r * 2.0);
        sc.g.restore();
        g.globalAlpha = fa;
        g.drawImage(sc.c, bx, by, bw, bh);
        g.globalAlpha = 1;
      }
      // 少年：牌坊下静立（背影）
      const ab = ARCH.base, hY = 1.75 * ARCH.k;
      g.fillStyle = rgba('#2a3422', 0.4);
      g.beginPath(); g.ellipse(ab[0] + 1, ab[1] + 1.2, hY * 0.2, hY * 0.035, 0, 0, TAU); g.fill();
      XYT.sil.draw(g, 'youth', 'standBack', ab[0], ab[1] + 1, hY, lt + 3, { wind: 0.22, windDir: 1, body: '#262c22', rim: '#fff4d2', rimSide: -1, rimWidth: 1 });
      g.restore();
      motes(g, lt);
      // 近景（视差略大）
      const nb = (r, img) => { const x = CXZ + (r[0] - CXZ) * zn, y = CYZ + (r[1] - CYZ) * zn; g.drawImage(img, x, y, r[2] * zn, r[3] * zn); };
      nb(NEAR_R, nR); nb(NEAR_L, nL);
    }
    // 光里的浮尘：缓缓向右下飘，淡入淡出
    function motes(g, lt) {
      const dot = softDot('#fff6d8', 0.5);
      g.save(); g.globalCompositeOperation = 'lighter';
      const dx = Math.cos(RAY_ANG), dy = Math.sin(RAY_ANG);
      for (let i = 0; i < 50; i++) {
        const sp = 5 + h2(i, 1) * 8, life = 7 + h2(i, 2) * 5;
        const tt = lt + h2(i, 3) * life;
        const age = ((tt % life) + life) % life;
        const x0 = 120 + h2(i, 4) * 820, y0 = 40 + h2(i, 5) * 440;
        const x = x0 + age * sp + 6 * Math.sin(age * 0.9 + i), y = y0 + age * sp * 0.3 + 5 * Math.sin(age * 0.7 + i * 2);
        const a = smooth(age / 0.9) * smooth((life - age) / 0.9);
        // 只在光柱里亮：到光柱中线的距离
        const d = Math.abs((x - 280) * dy - (y + 40) * dx);
        const inBeam = 0.25 + 0.75 * Math.exp(-Math.pow(d / 150, 2));
        const r = 1.1 + h2(i, 6) * 1.7;
        g.globalAlpha = a * inBeam * 0.6;
        g.drawImage(dot, x - r, y - r, r * 2, r * 2);
      }
      g.restore();
    }
    XYT.registerShot('c1_steps', {
      name: '夏山古阶', zone: 'right', night: false,
      text: '#f6eed6', shadow: 'rgba(14,22,12,0.9)', accent: '#f2d58c', bloom: 0.22,
      draw,
    });
  })();
  // ============================================================
  // c1_ridge 夏岭望城：少年立在夏日高岭上眺望远城；积云的影子滚过平原；热浪升起，远城化进白茫茫的暑气
  // ============================================================
  (function () {
    const FB = [0.295, 0.575, 0.955, 1.455, 1.815, 2.175, 2.675, 3.135, 3.435, 3.895, 4.235, 4.685, 5.135, 5.535, 5.995];
    // 平原透视：视平线 YH，相机高出平原 HC（千米），焦距 F；平原点 (X, D) 千米
    const YH = 444, HC = 0.6, F = 1000, CX = 640;
    const pp = (X, D) => [CX + (F * X) / D, YH + (F * HC) / D];
    // 风向左；云与云影同一世界速度（千米/秒）
    const VW = 0.15;
    const WIND = -1;
    const SUNX = -120, SUNY = -80;
    // 岭：近处草坡的上沿（越过它就是陡坡）
    const RIDGE = [[-40, 584], [120, 580], [250, 578], [380, 583], [500, 592], [600, 606], [680, 630], [740, 668], [780, 720], [800, 760]];
    const RIDGE_BOX = [-40, 560, 860, 200];
    const ridgeY = (x) => {
      for (let i = 1; i < RIDGE.length; i++) if (x <= RIDGE[i][0]) { const a = RIDGE[i - 1], b = RIDGE[i]; return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0])); }
      return 2000;
    };
    const ridgeRight = (y) => { for (let i = 1; i < RIDGE.length; i++) if (RIDGE[i][1] >= y) { const a = RIDGE[i - 1], b = RIDGE[i]; return lerp(a[0], b[0], (y - a[1]) / Math.max(1e-6, b[1] - a[1])); } return 820; };
    // 歌词超过 14 字被引擎排到下方，人整体上移，脚底在歌词带上沿之上
    const YOUTH = { x: 320, y: 592, h: 205 };
    // 河：平面中线（X, D 千米），远处从右边地平线下来，近处向左
    const RIVER = [[12, 70], [7, 40], [8.5, 24], [3.6, 15], [0.6, 10.5], [-1.3, 7.6], [-0.3, 5.6], [-1.6, 4.2]];
    const RIVER_W = 0.2;
    function riverPts() {
      // 折线细分，按平面法向偏移
      const pts = [];
      for (let i = 0; i < RIVER.length - 1; i++) for (let k = 0; k < 8; k++) {
        const u = k / 8, a = RIVER[i], b = RIVER[i + 1];
        const a0 = RIVER[Math.max(0, i - 1)], b1 = RIVER[Math.min(RIVER.length - 1, i + 2)];
        // Catmull-Rom
        const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
        pts.push([cr(a0[0], a[0], b[0], b1[0]), cr(a0[1], a[1], b[1], b1[1])]);
      }
      pts.push(RIVER[RIVER.length - 1]);
      return pts;
    }
    const RP = riverPts();
    function riverPoly() {
      const L = [], R = [];
      for (let i = 0; i < RP.length; i++) {
        const p = RP[i], q = RP[Math.min(RP.length - 1, i + 1)], o = RP[Math.max(0, i - 1)];
        let dx = q[0] - o[0], dd = q[1] - o[1]; const m = Math.hypot(dx, dd) || 1; dx /= m; dd /= m;
        const w = RIVER_W * (0.8 + 0.4 * h2(i, 3)) * 0.5;
        L.push(pp(p[0] - dd * w, p[1] + dx * w)); R.push(pp(p[0] + dd * w, p[1] - dx * w));
      }
      return L.concat(R.reverse());
    }
    // 河面闪光：沿河随机撒点，另在河湾（右侧回弯的尖）多撒一簇细碎的亮点——那里水浅流急，碎光全河最亮
    let GLINT = null;
    const spurTop = (sp, x) => {
      const P = sp.pts; const lo = Math.min(P[0][0], P[P.length - 1][0]), hi = Math.max(P[0][0], P[P.length - 1][0]);
      if (x < lo || x > hi) return 1e9;
      for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if ((x - a[0]) * (x - b[0]) <= 0) return lerp(a[1], b[1], (x - a[0]) / ((b[0] - a[0]) || 1)); }
      return 1e9;
    };
    // 河湾的尖：回弯处画面上最靠右的一点
    const TIP = (() => { let best = null; for (let k = 40; k < RP.length; k++) { const q = pp(RP[k][0], RP[k][1]); if (q[1] > 530 && q[1] < 570 && (!best || q[0] > best.q[0])) best = { k, q }; } return best; })();
    // 远段：远处河段在闪光范围里最右的一截（x ≥ FAR_X）
    const FAR_X = 688;
    const FAR_K = (() => { for (let k = 0; k < RP.length - 1; k++) { const a = pp(RP[k][0], RP[k][1]), b = pp(RP[k + 1][0], RP[k + 1][1]); if (a[0] >= 700 && b[0] < 700) return k; } return 31; })();
    function glints() {
      if (GLINT) return GLINT;
      GLINT = [];
      const R = rng(808), cand = [];
      for (let k = 0; k < RP.length - 1; k++) {
        const q = pp(RP[k][0], RP[k][1]);
        if (q[0] > 380 && q[0] < 740 && q[1] > 470 && SPURS.every((sp) => q[1] < spurTop(sp, q[0]) - 4)) cand.push(k);
      }
      for (let i = 0; i < 90 && cand.length; i++) {
        const k = cand[Math.floor(R() * cand.length)];
        const p = RP[k], q = RP[k + 1], u = R();
        const X = lerp(p[0], q[0], u) + (R() - 0.5) * RIVER_W * 0.7, D = lerp(p[1], q[1], u);
        GLINT.push({ X, D, ph: R() * TAU, fq: 1.2 + R() * 2.2, sz: 0.6 + R() * 1.1, seed: i });
      }
      // 远段也有一小簇（远处那段河最右的一截）
      const R3 = rng(811);
      for (let i = 0; i < 6; i++) {
        const k = FAR_K, f = R3(), p = RP[k], q = RP[k + 1];
        GLINT.push({ X: lerp(p[0], q[0], f) + (R3() - 0.5) * 0.06, D: lerp(p[1], q[1], f), ph: R3() * TAU, fq: 1.4 + R3() * 2.2, sz: 0.5 + R3() * 0.5, seed: 120 + i, extra: true });
      }
      // 河湾一簇：尖的前后各一小段，横向散得窄
      const R2 = rng(809);
      for (let i = 0, n = 0; n < 14 && i < 200; i++) {
        const u = TIP.k - 1.2 + R2() * 2.2, k = Math.floor(u), f = u - k, p = RP[k], q = RP[k + 1];
        let dx = q[0] - p[0], dd = q[1] - p[1]; const m = Math.hypot(dx, dd) || 1; dx /= m; dd /= m;
        const o = (R2() - 0.5) * 0.12, X = lerp(p[0], q[0], f) + dd * o, D = lerp(p[1], q[1], f) - dx * o;
        const ph = R2() * TAU, fq = 1.6 + R2() * 2.4, sz = 0.45 + R2() * 0.45;
        if (pp(X, D)[0] < TIP.q[0] - 8) continue;   // 只留尖上最靠外的一小团
        GLINT.push({ X, D, ph, fq, sz, seed: 90 + n, extra: true }); n++;
      }
      GLINT.forEach((s, gi) => {
        s.gi = gi; s.q = pp(s.X, s.D);
        s.bend = s.q[0] >= TIP.q[0] - 30 && Math.abs(s.q[1] - TIP.q[1]) <= 10;   // 河湾：尖往回 30 像素以内
        s.far = s.q[1] <= 506 && s.q[0] >= FAR_X;                                   // 远段：远处那段河最右的一截
      });
      return GLINT;
    }
    // ---------- 云与云影 ----------
    // 太阳在左上方、前方的天上（画面 SUNX, SUNY）：离平原高 Hc 的点，影子落在 (X + KX·Hc, D − KD·Hc)，即画面上云的右下方
    const SUN_K = (YH - SUNY) / F, KX = (CX - SUNX) / F / SUN_K, KD = 1 / SUN_K;
    // 云：屏幕中心 x、底边 base、宽高；投影子的云，纵深由影子的纵深推出，位置由影子推出（见 cloudX）
    const CLOUDS = [
      { x: 450, base: 268, w: 470, h: 230, seed: 11 },
      { x: 870, base: 330, w: 300, h: 120, D: 11, seed: 12 },
      { x: 60, base: 220, w: 300, h: 130, D: 6.5, seed: 13 },     // 它的影子落在岭下，被岭挡住
      { x: 625, base: 366, w: 210, h: 66, seed: 17 },              // 远一些的小积云
      { x: 560, base: 402, w: 420, h: 30, D: 30, seed: 14, flat: true },
      { x: 880, base: 418, w: 260, h: 22, D: 45, seed: 15, flat: true },
      { x: 180, base: 410, w: 300, h: 26, D: 38, seed: 16, flat: true },
    ];
    // 云影：cl = 投它的云。团块 [dX, dD, rX, rD]（千米，相对影子中心；dD>0 更远），排成对应那朵云的样子（大云左中厚、右边一个小包）。
    // hit：第20句第几字时，影子 50% 边（与画出的软边同一条）碰到目标河段上的第一点闪光；之后与云同一世界速度 VW 向左
    const SHADOWS = [
      { cl: 0, D: 5.0, hit: 7, tgt: 'bend', blur: 9, vblur: 3.5, a: 0.7, seed: 21, lobes: [
        [-1.519, 1.204, 0.607, 1.527], [-2.319, 1.952, 0.428, 0.84], [-1.113, -0.418, 0.501, 1.683], [-0.367, -0.631, 0.414, 0.65], [-0.6, 0.5, 0.7, 1.0],
        [0.0, -0.5, 0.9, 1.0], [0.6, 0.8, 0.7, 1.0], [1.1, -0.2, 0.55, 0.8], [-0.3, -1.3, 0.6, 0.6], [0.5, 1.9, 0.5, 0.9]] },
      { cl: 3, D: 10.0, hit: 8, tgt: 'far', blur: 4.5, vblur: 2.2, a: 0.3, seed: 22, lobes: [
        [-0.9, 0.6, 0.6, 2.4], [-0.3, -0.4, 0.7, 2.0], [0.5, 0.5, 0.6, 2.2], [0.95, -0.6, 0.45, 1.6], [0.1, 1.5, 0.45, 1.6]] },
      { cl: 1, blur: 7, vblur: 3, a: 0.45, seed: 23, lobes: [
        [-0.7, 0.3, 0.5, 0.9], [-0.1, -0.2, 0.6, 1.0], [0.5, 0.4, 0.5, 0.8], [0.2, 0.9, 0.4, 0.7], [-0.3, -0.9, 0.45, 0.6], [0.9, -0.3, 0.4, 0.7]] },
    ];
    // 团块外形：极坐标半径带一点噪声
    const SH_N = 32;
    function setupShadow(s) {
      const cl = CLOUDS[s.cl], k = (YH - (cl.base - 0.15 * cl.h)) / F;   // 云的下部（投影的主体）
      cl.sh = s;
      if (s.hit != null) cl.D = (s.D + KD * HC) / (1 - KD * k);
      cl.Hc = HC + k * cl.D;
      if (s.hit == null) s.D = cl.D - KD * cl.Hc;
      s.cy = YH + (F * HC) / s.D; s.v = (F * VW) / s.D;
      s.L = s.lobes.map(([dX, dD, rX, rD], i) => {
        const Dl = s.D + dD, sd = s.seed * 17 + i, rr = [];
        for (let j = 0; j < SH_N; j++) { const a = (j / SH_N) * TAU; rr.push(1 + 0.13 * (noise1(a * 2 + sd, sd) - 0.5) * 2 + 0.07 * (noise1(a * 5 + sd, sd + 1) - 0.5) * 2); }
        return { lx: (F * dX) / Dl, ly: YH + (F * HC) / Dl - s.cy, rh: (F * rX) / Dl, rv: (F * HC * rD) / (Dl * Dl), rr };
      });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, fs = 0;
      for (const L of s.L) { x0 = Math.min(x0, L.lx - L.rh * 1.22); x1 = Math.max(x1, L.lx + L.rh * 1.22); y0 = Math.min(y0, L.ly - L.rv * 1.22); y1 = Math.max(y1, L.ly + L.rv * 1.22); fs += L.rv / L.rh; }
      s.f0 = fs / s.L.length;
      const px = 3 * s.blur, py = 3 * s.vblur + 2;
      s.ox = -x0 + px; s.oy = -y0 + py; s.sw = x1 - x0 + 2 * px; s.sh = y1 - y0 + 2 * py;
    }
    SHADOWS.forEach((s, si) => { s.si = si; setupShadow(s); });
    // 云影的浓度图：从缓存贴图读回一次（静态，按渲染倍率各一份）。闪光的明暗、碰河时刻都直接取这张图，与画出来的影子一致
    function alphaMap(s) {
      const spr = shadowSprite(s), cv = document.createElement('canvas');
      cv.width = spr.width; cv.height = spr.height;
      const cg = cv.getContext('2d'); cg.drawImage(spr, 0, 0);
      const d = cg.getImageData(0, 0, cv.width, cv.height).data, a = new Uint8Array(cv.width * cv.height);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      return { a, w: cv.width, h: cv.height, sc: spr.width / s.sw };
    }
    // 相对影子中心 (lx, ly) 处的浓度 0..1（双线性）
    function densAt(s, A, lx, ly) {
      const x = (lx + s.ox) * A.sc - 0.5, y = (ly + s.oy) * A.sc - 0.5;
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const at = (u, v) => (u < 0 || v < 0 || u >= A.w || v >= A.h ? 0 : A.a[v * A.w + u]);
      return lerp(lerp(at(i, j), at(i + 1, j), fx), lerp(at(i, j + 1), at(i + 1, j + 1), fx), fy) / 255;
    }
    // 这一行上影子 50% 边的最左点（相对中心；这一行没有影子则为 null）
    function frontAt(s, A, ly) {
      let prev = 0;
      for (let x = -s.ox; x < s.sw - s.ox; x += 1) {
        const d = densAt(s, A, x, ly);
        if (d >= 0.5) return x - (d - 0.5) / Math.max(1e-6, d - prev);
        prev = d;
      }
      return null;
    }
    // 每个渲染倍率一份：浓度图、每点闪光所在行的前缘、hit 影子的定位量
    const SHD = new Map();
    function shadeData() {
      const key = SS().toFixed(3);
      let D = SHD.get(key);
      if (D) return D;
      const G = glints(), A = SHADOWS.map(alphaMap);
      const front = G.map((gl) => SHADOWS.map((s, si) => frontAt(s, A[si], gl.q[1] - s.cy)));
      const hmax = SHADOWS.map((s, si) => {
        if (s.hit == null) return 0;
        let hm = -1e9;
        G.forEach((gl, gi) => { const f = front[gi][si]; if (gl[s.tgt] && f != null) hm = Math.max(hm, gl.q[0] - f); });
        return hm;
      });
      D = { A, front, hmax };
      SHD.set(key, D);
      return D;
    }
    // 影子中心的屏幕 x
    function shadowCX(s, lt, c) {
      if (s.hit != null) return s.v * (charAt(c, s.hit, 0, FB) - lt) + shadeData().hmax[s.si];
      const cl = CLOUDS[s.cl], Xc = ((cl.x - ((F * VW) / cl.D) * lt - CX) * cl.D) / F;
      return CX + (F * (Xc + KX * cl.Hc)) / s.D;
    }
    // 云的屏幕 x：投 hit 影子的云跟着影子走（同一世界速度），其余按自己的 x 漂
    function cloudX(cl, lt, c) {
      const s = cl.sh;
      if (!s || s.hit == null) return cl.x - ((F * VW) / cl.D) * lt;
      const Xs = ((shadowCX(s, lt, c) - CX) * s.D) / F;
      return CX + (F * (Xs - KX * cl.Hc)) / cl.D;
    }
    // 云影贴图：先在未压扁的画布里画团块、做 blur 像素的模糊（地面上的软边），再按透视压扁——横向边软、纵向边随透视变窄
    function shadowSprite(s) { return K.cache('fg4ridge-csh' + s.seed, s.sw, s.sh, 1, (g) => paintShadow(g, s)); }
    function paintShadow(g, s) {
      // 只在建缓存时调用（ctx.filter 只在这里和 blurBox 里用）
      const sc = g.getTransform().a, f0 = s.f0, uh = s.sh / f0;
      const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h)); return cv; };
      const a = mk(s.sw * sc, uh * sc), ag = a.getContext('2d');
      ag.setTransform(sc, 0, 0, sc, 0, 0);
      ag.fillStyle = '#3f5f50';
      for (const L of s.L) {
        ag.save(); ag.translate(s.ox + L.lx, (s.oy + L.ly) / f0); ag.scale(1, L.rv / L.rh / f0);
        ag.beginPath();
        for (let j = 0; j < SH_N; j++) { const t = (j / SH_N) * TAU, r = L.rh * L.rr[j]; j ? ag.lineTo(Math.cos(t) * r, Math.sin(t) * r) : ag.moveTo(Math.cos(t) * r, Math.sin(t) * r); }
        ag.closePath(); ag.fill(); ag.restore();
      }
      const b = mk(a.width, a.height), bg = b.getContext('2d');
      bg.filter = `blur(${(s.blur * sc).toFixed(2)}px)`; bg.drawImage(a, 0, 0);
      // 压扁后再整体柔一点（纵向边缘也有几像素的过渡，不成硬边的“水塘”）
      const pw = Math.round(s.sw * sc), ph = Math.round(s.sh * sc), d = mk(pw, ph), dg = d.getContext('2d');
      dg.imageSmoothingQuality = 'high'; dg.drawImage(b, 0, 0, pw, ph);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.filter = `blur(${(s.vblur * sc).toFixed(2)}px)`; g.drawImage(d, 0, 0);
      g.restore();
    }
    // ---------- 天空 ----------
    function buildSky(g) {
      const gr = g.createLinearGradient(0, 0, 0, YH + 20);
      gr.addColorStop(0, '#9cc2de'); gr.addColorStop(0.45, '#c6dcea'); gr.addColorStop(0.85, '#e8eee6'); gr.addColorStop(1, '#f4f1e2');
      g.fillStyle = gr; g.fillRect(0, 0, W, YH + 30);
      const sg = g.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, 760);
      sg.addColorStop(0, rgba('#fffbe8', 0.9)); sg.addColorStop(0.35, rgba('#fbf6e2', 0.45)); sg.addColorStop(1, rgba('#f4f1e2', 0));
      g.fillStyle = sg; g.fillRect(0, 0, W, YH + 30);
      // 高空极淡的卷云（静止，不进歌词区）
      blurBox(g, 0, 0, W, 240, 6, (tg) => {
        tg.strokeStyle = rgba('#ffffff', 0.35); tg.lineCap = 'round';
        const R = rng(3);
        for (let i = 0; i < 9; i++) {
          const x = 160 + R() * 640, y = 50 + R() * 110, l = 120 + R() * 180;
          tg.lineWidth = 4 + R() * 8;
          tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + l * 0.5, y - 10 - R() * 12, x + l, y + 4); tg.stroke();
        }
      });
    }
    // 积云：许多圆团，左上受光，底部平而偏灰
    function noisyPuff(g, x, y, r, seed) {
      g.beginPath();
      for (let i = 0; i <= 28; i++) {
        const a = (i / 28) * TAU, rr = r * (1 + 0.1 * (noise1(a * 2 + seed, seed) - 0.5) * 2 + 0.05 * (noise1(a * 6 + seed, seed + 1) - 0.5));
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath();
    }
    function buildCloud(cl) {
      const pad = 40;
      return K.cache('fg4ridge-cloud' + cl.seed, cl.w + pad * 2, cl.h + pad * 2, 1, (g) => {
        const R = rng(cl.seed * 31);
        const base = cl.h + pad;
        const puffs = [];
        if (cl.flat) {
          for (let i = 0; i < 40; i++) { const u = 0.04 + (i / 40) * 0.92; const r = cl.h * (0.45 + R() * 0.35) * Math.sin(Math.PI * (0.15 + u * 0.7)); puffs.push([pad + u * cl.w, base - r * 0.55 - R() * cl.h * 0.2, r, i]); }
        } else {
          const n = Math.round(30 + cl.w / 6);
          for (let i = 0; i < n; i++) {
            const u = 0.05 + R() * 0.9;
            // 中间偏左隆起成塔，两侧低
            const prof = Math.exp(-Math.pow((u - 0.42) / 0.28, 2)) * 0.85 + 0.25 * Math.exp(-Math.pow((u - 0.78) / 0.12, 2));
            const r = cl.h * (0.08 + R() * 0.12) * (0.7 + 0.8 * prof);
            const y = base - r * 0.75 - R() * Math.max(0, cl.h * prof * 1.05 - r * 1.2);
            puffs.push([pad + u * cl.w, y, r, i]);
          }
        }
        puffs.sort((a, b) => (a[1] - a[2]) - (b[1] - b[2]));
        const cw = cl.w + pad * 2, ch = cl.h + pad * 2;
        blurBox(g, 0, 0, cw, ch, cl.flat ? 6 : 2.2, (tg) => {
          // 整朵的外形
          tg.fillStyle = '#ffffff';
          for (const [x, y, r, i] of puffs) { noisyPuff(tg, x, Math.min(y, base - r * 0.55), r, i + cl.seed); tg.fill(); }
          tg.globalCompositeOperation = 'source-atop';
          // 整体受光：左上亮、右下暗
          const lg = tg.createLinearGradient(pad, base - cl.h, pad + cl.w * 0.9, base);
          lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.45, '#f4f7f8'); lg.addColorStop(1, '#c2cfdb');
          tg.fillStyle = lg; tg.fillRect(0, 0, cw, ch);
          // 云团的起伏：每团右下一抹柔和的暗、左上一抹亮（不描圆边）
          for (const [x, y, r] of puffs) {
            const yy = Math.min(y, base - r * 0.55);
            const sg = tg.createRadialGradient(x + r * 0.45, yy + r * 0.5, 0, x + r * 0.45, yy + r * 0.5, r * 0.9);
            sg.addColorStop(0, 'rgba(150,168,190,0.28)'); sg.addColorStop(1, 'rgba(150,168,190,0)');
            tg.fillStyle = sg; tg.fillRect(x - r, yy - r, r * 2.6, r * 2.6);
          }
          for (const [x, y, r] of puffs) {
            const yy = Math.min(y, base - r * 0.55);
            const hg = tg.createRadialGradient(x - r * 0.3, yy - r * 0.35, 0, x - r * 0.3, yy - r * 0.35, r * 0.75);
            hg.addColorStop(0, 'rgba(255,255,255,0.55)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
            tg.fillStyle = hg; tg.fillRect(x - r * 1.2, yy - r * 1.2, r * 2, r * 2);
          }
          // 平底，偏灰蓝
          const bg = tg.createLinearGradient(0, base - cl.h * 0.38, 0, base);
          bg.addColorStop(0, 'rgba(146,164,186,0)'); bg.addColorStop(1, 'rgba(136,156,180,0.6)');
          tg.fillStyle = bg; tg.fillRect(0, 0, cw, ch);
          tg.globalCompositeOperation = 'destination-out';
          tg.fillStyle = '#000'; tg.fillRect(0, base + 1, cw, pad);
          tg.globalCompositeOperation = 'source-over';
        }, cl.flat ? 0.75 : 1);
      });
    }
    // ---------- 远山与城（会被热浪扰动的一层）----------
    const FAR_Y0 = 360, FAR_H = 110;
    function buildFar(g) {
      g.translate(0, -FAR_Y0);
      // 两层远山
      blurBox(g, -20, FAR_Y0, W + 40, FAR_H, 1.2, (tg) => {
        for (const [col, amp, base, seed] of [['#b7c9d6', 26, YH + 1, 5], ['#a6bccb', 15, YH + 2, 9]]) {
          tg.fillStyle = col;
          tg.beginPath(); tg.moveTo(-20, base + 4);
          for (let x = -20; x <= W + 20; x += 6) {
            const n = noise1(x / 140, seed) * 0.65 + noise1(x / 47, seed + 3) * 0.35;
            const fall = x > 900 ? 1 - smooth((x - 900) / 380) * 0.75 : 1;
            tg.lineTo(x, base - amp * n * fall);
          }
          tg.lineTo(W + 20, base + 4); tg.closePath(); tg.fill();
        }
        // 城：城墙、城门楼、塔、屋顶（远、偏蓝灰）
        const cx = 700, by = 452;
        const wall = '#8ea3b4', lit = '#b7c6d1', dark = '#7d93a5';
        tg.fillStyle = wall; tg.fillRect(cx - 82, by - 7, 164, 7);
        tg.fillStyle = lit; tg.fillRect(cx - 82, by - 7, 164, 1.2);
        for (let x = cx - 82; x < cx + 82; x += 4) { tg.fillStyle = wall; tg.fillRect(x, by - 9, 2, 2); }
        // 城内屋顶
        const R = rng(17);
        for (let i = 0; i < 26; i++) {
          const x = cx - 74 + R() * 148, w = 5 + R() * 8, h = 3 + R() * 3;
          tg.fillStyle = R() < 0.5 ? dark : wall;
          tg.beginPath(); tg.moveTo(x - w / 2 - 1, by - 7 - h * 0.3); tg.lineTo(x, by - 7 - h); tg.lineTo(x + w / 2 + 1, by - 7 - h * 0.3); tg.closePath(); tg.fill();
        }
        // 城门楼（两重檐）
        const gx = cx - 8;
        tg.fillStyle = dark; tg.fillRect(gx - 9, by - 15, 18, 8);
        tg.beginPath(); tg.moveTo(gx - 15, by - 14); tg.quadraticCurveTo(gx, by - 17, gx + 15, by - 14); tg.lineTo(gx + 9, by - 20); tg.lineTo(gx - 9, by - 20); tg.closePath(); tg.fill();
        tg.fillRect(gx - 6, by - 24, 12, 4);
        tg.beginPath(); tg.moveTo(gx - 11, by - 23); tg.quadraticCurveTo(gx, by - 25.5, gx + 11, by - 23); tg.lineTo(gx + 5, by - 28); tg.lineTo(gx - 5, by - 28); tg.closePath(); tg.fill();
        tg.fillStyle = lit; tg.fillRect(gx - 9, by - 15, 1.2, 8);
        // 塔（七层）
        const tx = cx + 46;
        for (let k = 0; k < 7; k++) {
          const yb = by - 7 - k * 5, w = 9 - k * 0.9;
          tg.fillStyle = dark; tg.fillRect(tx - w * 0.35, yb - 4, w * 0.7, 4);
          tg.beginPath(); tg.moveTo(tx - w / 2 - 1, yb - 3.6); tg.lineTo(tx + w / 2 + 1, yb - 3.6); tg.lineTo(tx + w * 0.3, yb - 5.2); tg.lineTo(tx - w * 0.3, yb - 5.2); tg.closePath(); tg.fill();
          tg.fillStyle = lit; tg.fillRect(tx - w * 0.35, yb - 4, 0.9, 4);
        }
        tg.fillStyle = dark; tg.fillRect(tx - 0.5, by - 49, 1, 6);
      });
    }
    // ---------- 平原：田畴、树篱、村落、河 ----------
    const hazeD = (D) => clamp(1 - Math.exp(-(D - 3) / 10));
    function buildPlain(g) {
      const gr = g.createLinearGradient(0, YH, 0, H);
      gr.addColorStop(0, '#e4e9dc'); gr.addColorStop(0.06, '#c9d8b4'); gr.addColorStop(0.2, '#a4c088'); gr.addColorStop(0.5, '#86ad6e'); gr.addColorStop(1, '#6f9a5e');
      g.fillStyle = gr; g.fillRect(0, YH, W, H - YH);
      const R = rng(41);
      const cols = ['#9cc07e', '#b3ca86', '#8cb070', '#bfcd90', '#a6c48a', '#86aa68', '#c9d29a', '#96b978'];
      blurBox(g, -20, YH - 4, W + 40, H - YH + 8, 0.8, (tg) => {
        let D0 = 3.4;
        while (D0 < 60) {
          const D1 = D0 * (1.1 + R() * 0.1);
          let X0 = -1.1 * D0 - 1;
          while (X0 < 1.1 * D0 + 1) {
            const X1 = X0 + (0.25 + R() * 0.5) * (0.7 + D0 * 0.06);
            const hz = hazeD(D0);
            const c = mix(cols[(R() * cols.length) | 0], '#e3e9da', hz * 0.9);
            const sk = (R() - 0.5) * 0.08;
            const a = pp(X0, D0), b = pp(X1, D0), c2 = pp(X1 + sk, D1), d = pp(X0 + sk, D1);
            tg.fillStyle = rgba(c, 0.8);
            poly(tg, [a, b, c2, d]); tg.fill();
            if (D0 < 8 && R() < 0.5) {
              tg.strokeStyle = rgba(mix(c, '#5f8650', 0.35), 0.25); tg.lineWidth = 0.6;
              for (let k = 1; k < 6; k++) { const f = k / 6, p0 = [lerp(a[0], b[0], f), lerp(a[1], b[1], f)], p1 = [lerp(d[0], c2[0], f), lerp(d[1], c2[1], f)]; tg.beginPath(); tg.moveTo(p0[0], p0[1]); tg.lineTo(p1[0], p1[1]); tg.stroke(); }
            }
            // 田边树篱、小树丛（不规则）
            if (R() < 0.4) {
              const n = Math.max(3, Math.round((c2[0] - d[0]) / 4));
              for (let k = 0; k < n; k++) {
                if (R() < 0.25) continue;
                const f = k / n, x = lerp(d[0], c2[0], f), y = lerp(d[1], c2[1], f);
                const r = Math.max(0.6, (20 / D1) * (0.6 + R() * 0.8));
                tg.fillStyle = rgba(mix(R() < 0.5 ? '#4b7344' : '#5d8650', '#d2dccb', hz * 0.85), 0.85);
                tg.beginPath(); tg.ellipse(x, y - r * 0.5, r * 1.3, r * 0.9, 0, 0, TAU); tg.fill();
              }
            }
            X0 = X1;
          }
          D0 = D1;
        }
        // 大尺度的明暗起伏，打破棋盘感
        for (let i = 0; i < 40; i++) {
          const D = 4 + Math.pow(R(), 1.5) * 30, X = (R() - 0.5) * 2 * D, q = pp(X, D), rx = (F * (0.6 + R() * 1.4)) / D;
          tg.fillStyle = rgba(R() < 0.5 ? '#3f6a3a' : '#f0f0d8', 0.07 * (1 - hazeD(D)));
          tg.beginPath(); tg.ellipse(q[0], q[1], rx, Math.max(2, rx * HC / D * 2), 0, 0, TAU); tg.fill();
        }
        // 村落
        for (const [X, D, n] of [[-2.0, 5.6, 9], [3.6, 8.5, 8], [-5.2, 12, 6], [7.8, 17, 6], [1.4, 11.5, 6], [4.4, 5.2, 7]]) {
          const hz = hazeD(D);
          for (let k = 0; k < n; k++) {
            const q = pp(X + (R() - 0.5) * 0.45, D + (R() - 0.5) * 0.4), s = 44 / D;
            tg.fillStyle = mix('#eef0e6', '#e6eae0', hz); tg.fillRect(q[0] - s * 0.5, q[1] - s * 0.42, s, s * 0.42);
            tg.fillStyle = mix('#59636a', '#ccd5d6', hz * 0.85);
            tg.beginPath(); tg.moveTo(q[0] - s * 0.62, q[1] - s * 0.4); tg.lineTo(q[0], q[1] - s * 0.78); tg.lineTo(q[0] + s * 0.62, q[1] - s * 0.4); tg.closePath(); tg.fill();
          }
          // 村边一簇树
          for (let k = 0; k < 7; k++) { const q = pp(X + 0.3 + (R() - 0.5) * 0.4, D + (R() - 0.5) * 0.3), r = 14 / D; tg.fillStyle = mix('#4f7748', '#d0dacb', hz * 0.85); tg.beginPath(); tg.ellipse(q[0], q[1] - r * 0.6, r * 1.2, r, 0, 0, TAU); tg.fill(); }
        }
        // 河：岸边一线深绿，水面映天
        const rp = riverPoly();
        tg.strokeStyle = rgba('#557c4c', 0.5); tg.lineWidth = 2.2; poly(tg, rp); tg.stroke();
        poly(tg, rp);
        const wg = tg.createLinearGradient(0, YH, 0, 620);
        wg.addColorStop(0, '#f2f4ee'); wg.addColorStop(0.3, '#cadbe5'); wg.addColorStop(1, '#a0bccd');
        tg.fillStyle = wg; tg.fill();
      });
      // 地平线上的薄雾
      const hg = g.createLinearGradient(0, YH - 6, 0, YH + 70);
      hg.addColorStop(0, rgba('#f2f2e6', 0.95)); hg.addColorStop(1, rgba('#f2f2e6', 0));
      g.fillStyle = hg; g.fillRect(0, YH - 6, W, 76);
    }
    // ---------- 中景：右下的低丘（岭下）----------
    // 从两侧伸进平原的山脊（层层退远，越远越淡）
    const SPURS = [
      // 远处右侧伸进平原的山脊：脊尖落到平原上，下沿是斜的山脚线（不是竖直切口）
      { pts: [[1320, 500], [1230, 506], [1150, 498], [1080, 512], [1010, 518], [940, 534], [880, 540], [820, 560], [770, 584], [730, 612]],
        base: [[742, 622], [770, 634], [820, 646], [900, 658], [1020, 668], [1160, 676], [1340, 684]],
        col: '#8aa592', dark: '#61806f', mist: '#c9d7c2', fade: 105, tex: 0.7, ink: 1.0, tree: 1.7, seed: 3 },
      { pts: [[-60, 524], [60, 520], [170, 536], [280, 544], [400, 566], [520, 590], [600, 616]],
        col: '#83a07e', dark: '#5e7d61', mist: '#c3d2bb', fade: 100, tex: 0.8, ink: 1.1, tree: 1.9, seed: 5 },
      // 近处右下的山坡：脊上一排树、皴笔；歌词带（y>calmY）里只留平缓的明暗
      { pts: [[1320, 582], [1200, 586], [1080, 596], [960, 606], [860, 618], [780, 632], [700, 660], [640, 720], [620, 770]],
        col: '#5a874d', dark: '#33582f', mist: '#7aa068', fade: 150, tex: 1.2, ink: 1.7, tree: 4.2, seed: 7, near: true, calmY: 636 },
    ];
    function spurPath(g, sp) {
      const pts = [];
      for (let i = 0; i < sp.pts.length - 1; i++) {
        const a = sp.pts[i], b = sp.pts[i + 1];
        for (let k = 0; k < 10; k++) { const u = k / 10, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u) - 6 * sp.tex * (noise1(x / 24, sp.seed) - 0.5) - 2.5 * sp.tex * (noise1(x / 7, sp.seed + 2) - 0.5); pts.push([x, y]); }
      }
      pts.push(sp.pts[sp.pts.length - 1]);
      return pts;
    }
    const polyAt = (P, x) => { for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if ((x - a[0]) * (x - b[0]) <= 0) return lerp(a[1], b[1], (x - a[0]) / ((b[0] - a[0]) || 1)); } return null; };
    // 水墨的层山：一道清楚的墨色脊线，脊下一条深色的“阴面”，往下渐淡化进雾；脊上点苔或树丛，坡上几笔干皴
    function buildSpur(g, sp) {
      const pts = spurPath(g, sp);
      const p0 = pts[0], pn = pts[pts.length - 1];
      const x0 = Math.min(p0[0], pn[0]), x1 = Math.max(p0[0], pn[0]), top = Math.min(...pts.map((p) => p[1]));
      const calm = sp.calmY || 1e9;
      const baseAt = (x) => (sp.base ? (polyAt([pn].concat(sp.base), x) ?? H + 20) : H + 20);
      const body = (tg) => {
        tg.beginPath(); pts.forEach((p, i) => (i ? tg.lineTo(p[0], p[1]) : tg.moveTo(p[0], p[1])));
        if (sp.base) { sp.base.forEach((p) => tg.lineTo(p[0], p[1])); tg.lineTo(sp.base[sp.base.length - 1][0], p0[1]); }
        else { tg.lineTo(pn[0], H + 20); tg.lineTo(p0[0], H + 20); }
        tg.closePath();
      };
      const R = rng(sp.seed * 7);
      blurBox(g, x0 - 30, top - 30, x1 - x0 + 60, H - top + 60, sp.near ? 0.6 : 0.8, (tg) => {
        body(tg); tg.fillStyle = sp.mist; tg.fill();
        tg.save(); body(tg); tg.clip();
        // 按脊线逐列上色：脊下深、往下变浅（明暗台阶跟着脊线走）
        for (let x = x0 - 2; x <= x1 + 2; x += 2) {
          const yc = polyAt(pts, x); if (yc == null) continue;
          const yb = baseAt(x), f = Math.max(20, Math.min(sp.fade, yb - yc));
          const gr = tg.createLinearGradient(0, yc, 0, yc + f);
          gr.addColorStop(0, sp.dark); gr.addColorStop(0.1, sp.dark); gr.addColorStop(0.28, mix(sp.dark, sp.col, 0.7)); gr.addColorStop(0.5, sp.col); gr.addColorStop(1, sp.mist);
          tg.fillStyle = gr; tg.fillRect(x, yc - 3, 2.4, f + 3);
        }
        // 大块的坡面明暗：左上受光，右下的沟里暗一点
        for (let i = 0; i < 6; i++) {
          const k = Math.floor(R() * (pts.length - 1)), p = pts[k], yy = p[1] + 26 * sp.tex;
          if (yy > calm - 10) continue;
          const gg = tg.createRadialGradient(p[0] + 24, yy, 2, p[0] + 24, yy, 40 * sp.tex + 20);
          gg.addColorStop(0, rgba(sp.dark, 0.22)); gg.addColorStop(1, rgba(sp.dark, 0));
          tg.fillStyle = gg; tg.fillRect(p[0] - 80, yy - 80, 210, 170);
        }
        // 干皴：从脊下往坡下的短笔，越近脊越密
        tg.lineCap = 'round';
        const nS = Math.round((x1 - x0) / (sp.near ? 7 : 9));
        for (let i = 0; i < nS; i++) {
          const x = x0 + R() * (x1 - x0), yc = polyAt(pts, x); if (yc == null) continue;
          const y = yc + 3 + Math.pow(R(), 1.8) * sp.fade * 0.45, len = (6 + R() * 14) * sp.tex;
          if (y + len > calm) continue;
          const lean = -0.35 - R() * 0.3;
          tg.strokeStyle = rgba(sp.dark, 0.12 + R() * 0.16); tg.lineWidth = 0.6 + R() * 0.7 * sp.tex;
          tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + lean * len * 0.3, y + len * 0.5, x + lean * len * 0.5, y + len); tg.stroke();
        }
        tg.restore();
        // 脊线：干笔墨线，粗细与浓淡随噪声起伏，偶有飞白
        const ink = mix(sp.dark, '#1c2a20', 0.45);
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const n = noise1(i * 0.37, sp.seed + 11);
          if (n < 0.18) continue;
          const calmK = 1 - smooth((Math.max(a[1], b[1]) - calm + 8) / 16);
          tg.strokeStyle = rgba(ink, (0.35 + 0.4 * n) * (0.35 + 0.65 * calmK)); tg.lineWidth = sp.ink * (0.6 + 0.8 * n);
          tg.beginPath(); tg.moveTo(a[0], a[1]); tg.lineTo(b[0], b[1]); tg.stroke();
        }
        // 脊上的点苔（远）或树丛（近）：成簇、疏密不匀，受光在左上
        let x = x0 + R() * 20;
        while (x < x1 - 4) {
          const yc = polyAt(pts, x);
          const grp = noise1(x / 60, sp.seed + 5);
          if (yc != null && yc < calm - 6 && grp > 0.42) {
            const n = sp.near ? 1 + ((R() * 5) | 0) : 1 + ((R() * 2.4) | 0);
            const r0 = sp.tree * (0.7 + R() * 0.5);
            let bx = x;
            for (let j = 0; j < n; j++) {
              const r = r0 * (0.6 + R() * 0.7);
              const gy = polyAt(pts, bx) ?? yc;
              if (sp.near) {
                // 一棵树：几团叠在一起的树冠，高略大于宽；底部埋进脊下的阴面里
                const ht = r * (1.2 + R() * 0.6), by = gy + r * 0.25;
                tg.fillStyle = mix(ink, sp.dark, 0.35);
                for (let m = 0; m < 4; m++) {
                  const ox = (R() - 0.5) * r * 0.9, oy = -ht * (0.25 + 0.5 * (m / 3)) + (R() - 0.5) * r * 0.2, rr = r * (0.75 - m * 0.1 + R() * 0.15);
                  tg.beginPath(); tg.ellipse(bx + ox, by + oy, rr, rr * 0.9, 0, 0, TAU); tg.fill();
                }
                // 左上受光：一小片偏亮的叶色（很淡）
                tg.fillStyle = rgba(mix(sp.col, '#b9cf88', 0.3), 0.3);
                tg.beginPath(); tg.ellipse(bx - r * 0.35, by - ht * 0.62, r * 0.42, r * 0.32, -0.5, 0, TAU); tg.fill();
              } else {
                // 点苔：大小不一的墨点，偶尔两点上下叠
                tg.fillStyle = rgba(mix(ink, sp.dark, 0.3), 0.75 + R() * 0.25);
                tg.beginPath(); tg.ellipse(bx, gy - r * (0.35 + R() * 0.3), r * 1.05, r * (0.8 + R() * 0.3), (R() - 0.5) * 0.6, 0, TAU); tg.fill();
                if (R() < 0.3) { tg.beginPath(); tg.ellipse(bx + (R() - 0.5) * r, gy - r * 1.4, r * 0.7, r * 0.6, 0, 0, TAU); tg.fill(); }
              }
              bx += r * (0.8 + R() * 0.7);
            }
            x = bx + 3 + (sp.near ? R() * 26 : R() * R() * 34);
          } else x += 4 + R() * 10;
        }
        // 迎光（左上）的一线极淡的亮
        tg.strokeStyle = rgba('#f4f6e0', sp.near ? 0.1 : 0.2); tg.lineWidth = 1;
        tg.beginPath(); pts.forEach((p, i) => (i ? tg.lineTo(p[0], p[1] + 1.2) : tg.moveTo(p[0], p[1] + 1.2))); tg.stroke();
      });
      // 山脚线化进平原上的薄雾
      if (sp.base) {
        blurBox(g, x0 - 30, top, x1 - x0 + 60, H - top, 7, (tg) => {
          tg.strokeStyle = rgba(sp.mist, 0.75); tg.lineWidth = 12; tg.lineJoin = 'round';
          tg.beginPath(); tg.moveTo(pn[0] - 6, pn[1] + 2); sp.base.forEach((p) => tg.lineTo(p[0], p[1])); tg.stroke();
        });
      }
    }
    function buildSpursFar(g) { buildSpur(g, SPURS[0]); buildSpur(g, SPURS[1]); }
    const HILL_BOX = [580, 540, 700, 180];
    const CLOUDS_BY_D = CLOUDS.slice().sort((a, b) => b.D - a.D);   // 远的先画
    function buildHills(g) { buildSpur(g, SPURS[2]); }
    // ---------- 近处岭顶 ----------
    function buildRidge(g) {
      g.beginPath(); g.moveTo(-40, H + 40);
      RIDGE.forEach((p) => g.lineTo(p[0], p[1]));
      g.lineTo(820, H + 40); g.closePath();
      const gr = g.createLinearGradient(0, 576, 0, H);
      gr.addColorStop(0, '#9cbf6a'); gr.addColorStop(0.3, '#6f9c4f'); gr.addColorStop(1, '#3a6232');
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      const R = rng(77);
      for (let i = 0; i < 300; i++) {
        const x = R() * 820, y = 560 + Math.pow(R(), 0.8) * 180, s = (y - 540) / 180;
        g.fillStyle = rgba(R() < 0.5 ? '#2f5229' : '#b5cf7c', 0.08 + R() * 0.12);
        g.beginPath(); g.ellipse(x, y, 4 + s * 26 * R(), 1 + s * 5 * R(), 0, 0, TAU); g.fill();
      }
      g.restore();
    }
    // 草叶小块（直立绘制，绘制时按根部剪切成随风倾斜）
    const TILE_W = 120, TILE_M = 26;
    function grassTile(bh, seed, near) {
      const th = Math.ceil(bh * 1.25 + 8);
      return K.cache('fg4ridge-grass' + bh + '|' + seed + '|' + (near === true ? 1 : near === 2 ? 2 : 0), TILE_W + TILE_M * 2, th, 1, (g) => {
        const draw = (tg) => {
          const R = rng(seed);
          const n = Math.round(TILE_W / Math.max(2.2, bh * 0.09)) * (near === true ? 1 : 2);
          for (let i = 0; i < n; i++) {
            const x = TILE_M + R() * TILE_W, len = bh * (0.55 + R() * 0.5), lean = (R() - 0.5) * 0.5;
            const w = Math.max(0.8, bh * (0.03 + R() * 0.025));
            const lit = R();
            const col = near === true ? mix('#24401f', '#3c6230', lit) : near === 2 ? mix('#4a7638', '#77a050', lit * 0.8) : mix(mix('#4f7d3c', '#a8c870', lit * 0.8), '#d8e2a0', lit > 0.85 ? 0.4 : 0);
            const y0 = th - 2;
            const tx = x + lean * len * 0.6, ty = y0 - len;
            tg.fillStyle = col;
            tg.beginPath(); tg.moveTo(x - w, y0); tg.quadraticCurveTo(x - w * 0.6 + lean * len * 0.2, y0 - len * 0.55, tx, ty);
            tg.quadraticCurveTo(x + w * 0.6 + lean * len * 0.2, y0 - len * 0.55, x + w, y0); tg.closePath(); tg.fill();
            // 叶尖受光（左侧）
            if (near === false && lit > 0.5) { tg.strokeStyle = rgba('#e6efb8', 0.5); tg.lineWidth = 0.6; tg.beginPath(); tg.moveTo(tx, ty); tg.quadraticCurveTo(x - w * 0.6 + lean * len * 0.2, y0 - len * 0.55, x - w * 0.6, y0 - len * 0.3); tg.stroke(); }
          }
        };
        if (near === true) blurBox(g, 0, 0, TILE_W + TILE_M * 2, th, 3, draw); else draw(g);
      });
    }
    // 一行草：根部在 y，x 范围 [x0, x1]，叶高 bh；风向左，波由右往左传
    function grassRow(g, y, x0, x1, bh, lt, seed, near) {
      const th = Math.ceil(bh * 1.25 + 8);
      for (let x = x0; x < x1; x += TILE_W) {
        const img = grassTile(bh, seed + (((x / TILE_W) | 0) % 5), near);
        const ph = x * 0.012 + lt * 1.9 + seed;
        const sway = WIND * (0.16 + 0.07 * Math.sin(ph) + 0.03 * Math.sin(ph * 2.3 + 1.1)) * (near === true ? 0.8 : 1);
        g.save();
        g.translate(x, y + 2);
        g.transform(1, 0, sway, 1, 0, 0);
        g.drawImage(img, -TILE_M, -th, TILE_W + TILE_M * 2, th);
        g.restore();
      }
    }
    function draw(g, c) {
      const lt = c.lt;
      const tHot = charAt(c, 11, 0, FB), tGone = charAt(c, 14, 0, FB);
      // 整镜 1.00→1.05 缓推（smoothstep，峰值约 1.1%/s）
      const z = 1 + 0.05 * smooth(clamp(lt / c.dur));
      const CXZ = 500, CYZ = 480;
      const Z = (k) => 1 + (z - 1) * k;
      const layer = (k, fn) => { const zz = Z(k); g.save(); g.translate(CXZ - CXZ * zz, CYZ - CYZ * zz); g.scale(zz, zz); fn(); g.restore(); };
      const sky = K.cache('fg4ridge-sky', W, YH + 30, 1, buildSky);
      const plain = K.cache('fg4ridge-plain4', W, H, 1, (pg) => { buildPlain(pg); buildSpursFar(pg); });
      // 近处右下的山坡单独一层：画在云影之上（云影在它后面的平原上）
      const hill = K.cache('fg4ridge-hill', HILL_BOX[2], HILL_BOX[3], 1, (hg) => { hg.translate(-HILL_BOX[0], -HILL_BOX[1]); buildHills(hg); });
      const far = K.cache('fg4ridge-far', W, FAR_H, 1, buildFar);
      const ridge = K.cache('fg4ridge-ridge', RIDGE_BOX[2], RIDGE_BOX[3], 1, (rg) => { rg.translate(-RIDGE_BOX[0], -RIDGE_BOX[1]); buildRidge(rg); });
      const heat = smooth((lt - tHot) / 0.9);                // 热浪扰动
      const white = easeInOut((lt - tHot) / (tGone - tHot));  // 白茫茫的暑气，到第20句第15字城已不见
      // 天与云
      layer(0.4, () => {
        g.drawImage(sky, 0, 0, W, YH + 30);
        for (const cl of CLOUDS_BY_D) {
          const img = buildCloud(cl);
          const x = cloudX(cl, lt, c);
          g.drawImage(img, x - cl.w / 2 - 40, cl.base - cl.h - 40, cl.w + 80, cl.h + 80);
        }
      });
      // 平原、云影、河光
      layer(0.75, () => {
        // 缓存画布是逻辑尺寸 × 渲染倍率：源矩形要乘同一倍率
        const ps = plain.width / W;
        g.drawImage(plain, 0, YH * ps, plain.width, (H - YH) * ps, 0, YH, W, H - YH);
        // 云影：每朵云右下方的一块，团块状的软边，正片叠底压暗（田的纹理仍透出来）
        g.save();
        g.beginPath(); g.rect(0, YH + 1, W, H - YH); g.clip();
        g.globalCompositeOperation = 'multiply';
        for (const s of SHADOWS) {
          const x = shadowCX(s, lt, c) - s.ox;
          if (x > W + 60 || x + s.sw < -60) continue;
          g.globalAlpha = s.a;
          g.drawImage(shadowSprite(s), x, s.cy - s.oy, s.sw, s.sh);
        }
        g.restore();
        g.drawImage(hill, HILL_BOX[0], HILL_BOX[1], HILL_BOX[2], HILL_BOX[3]);
        drawFar(g, lt, heat);
        // 暑气：地平线一带泛白，城最先化掉
        if (white > 0.001) {
          const hg = g.createLinearGradient(0, YH - 90, 0, YH + 110);
          hg.addColorStop(0, rgba('#f7f5ea', 0)); hg.addColorStop(0.25, rgba('#f7f5ea', 0.7 * white)); hg.addColorStop(0.4, rgba('#f8f6ec', white));
          hg.addColorStop(0.6, rgba('#f8f6ec', white)); hg.addColorStop(0.8, rgba('#f5f3e6', 0.45 * white)); hg.addColorStop(1, rgba('#f5f3e6', 0));
          g.fillStyle = hg; g.fillRect(-40, YH - 90, W + 80, 200);
        }
        riverGlint(g, lt, c, white);
      });
      // 岭、草、人
      layer(1, () => {
        g.drawImage(ridge, RIDGE_BOX[0], RIDGE_BOX[1], RIDGE_BOX[2], RIDGE_BOX[3]);
        const rows = [[583, 10, 101], [589, 13, 102]];
        g.save();
        g.beginPath(); g.moveTo(-100, 0); g.lineTo(600, 0);
        for (let i = 5; i < RIDGE.length; i++) g.lineTo(RIDGE[i][0], RIDGE[i][1]);
        g.lineTo(-100, H + 60); g.closePath(); g.clip();
        for (const [y, bh, sd] of rows) grassRow(g, y, -60, ridgeRight(y) + 60, bh, lt, sd, false);
        g.restore();
        // 人影（太阳在左上，影子落在右下的草里）
        g.fillStyle = rgba('#2c4a22', 0.32);
        g.beginPath(); g.ellipse(YOUTH.x + 28, YOUTH.y + 2, 48, 6, 0.05, 0, TAU); g.fill();
        XYT.sil.draw(g, 'youth', 'standBack', YOUTH.x, YOUTH.y, YOUTH.h, lt + 1.7, { wind: 0.4, windDir: -1, rim: '#fff3d4', rimSide: -1, body: '#1f2622' });
        const front = [[598, 16, 104], [612, 20, 105], [632, 26, 106], [658, 34, 107], [690, 44, 108]];
        // 歌词带里的草：偏暗、叶尖不打亮，保持安静
        g.save();
        g.beginPath(); g.moveTo(-100, 0); g.lineTo(600, 0);
        for (let i = 5; i < RIDGE.length; i++) g.lineTo(RIDGE[i][0], RIDGE[i][1]);
        g.lineTo(-100, H + 60); g.closePath(); g.clip();
        for (const [y, bh, sd] of front) grassRow(g, y, -60, ridgeRight(y) + 80, bh, lt, sd, y > 604 ? 2 : false);
        g.restore();
      });
      fluff(g, lt, c);
      layer(1.25, () => { grassRow(g, H + 26, -80, 760, 90, lt, 120, true); });
    }
    // 远山与城：热浪起后做平滑的竖向扰动（±1.2 像素）。
    // 做法：上移、下移各一份，按随 x 平滑起伏、随时间流动的权重 v(x) 线性混合（预乘透明度下相加），
    // 等效于逐列的亚像素位移，没有切片的台阶，也只需几次整幅绘制
    // 远山与城只占远景层的 y 34–100 这一条（其余透明），只处理这一条
    const HB0 = 34, HBH = 66;
    function hazeMask(sg, lt, inv) {
      const gr = sg.createLinearGradient(0, 0, W, 0), N = 128;
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const w = (2.0 * Math.sin(x * 0.045 + lt * 5.1) * Math.sin(x * 0.011 - lt * 1.7) + 1.0 * Math.sin(x * 0.13 + lt * 7.3)) / 3;
        const v = 0.5 + 0.5 * clamp(w, -1, 1);
        gr.addColorStop(i / N, 'rgba(0,0,0,' + (inv ? 1 - v : v).toFixed(4) + ')');
      }
      sg.globalCompositeOperation = 'destination-in';
      sg.fillStyle = gr; sg.fillRect(0, 0, W, HBH);
      sg.globalCompositeOperation = 'source-over';
    }
    function drawFar(g, lt, heat) {
      const far = K.cache('fg4ridge-far', W, FAR_H, 1, buildFar);
      if (heat < 0.01) { g.drawImage(far, 0, FAR_Y0, W, FAR_H); return; }
      const A = 1.2 * heat;
      const up = scratch('fg4ridge-hazeU', W, HBH), dn = scratch('fg4ridge-hazeD', W, HBH);
      up.g.drawImage(far, 0, -HB0 - A, W, FAR_H); hazeMask(up.g, lt, true);
      dn.g.drawImage(far, 0, -HB0 + A, W, FAR_H); hazeMask(dn.g, lt, false);
      up.g.globalCompositeOperation = 'lighter';
      up.g.drawImage(dn.c, 0, 0, W, HBH);
      up.g.globalCompositeOperation = 'source-over';
      g.drawImage(up.c, 0, FAR_Y0 + HB0, W, HBH);
    }
    // 河面闪光：跟拍子轻轻起伏；被云影盖住的地方没有直射阳光——闪光乘 (1 − 影子浓度)，浓度直接取影子贴图本身
    // 近影这一镜里会扫到的闪光放大 1.6 倍（河湾那一簇最亮），远影扫到的放大 1.3 倍
    function glintShade(gl, lt, c, cxs) {
      const D = shadeData();
      let sh = 1;
      SHADOWS.forEach((s, si) => { sh *= 1 - 0.985 * densAt(s, D.A[si], gl.q[0] - cxs[si], gl.q[1] - s.cy); });
      return sh;
    }
    function riverGlint(g, lt, c, white) {
      const D = shadeData();
      const beat = softBeat(c, 0.45);
      const dot = softDot('#fffbe8', 0.55), halo = softDot('#fff6dc', 0.05);
      const cxs = SHADOWS.map((s) => shadowCX(s, lt, c));
      const cx0 = SHADOWS.map((s) => shadowCX(s, 0, c));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const s of glints()) {
        const q = s.q;
        // 这一镜里会被近影 / 远影扫到的（按 50% 边到达的时刻 tIn 平滑过渡，静态，不随帧变）
        let boost = 1;
        for (const [si, k] of [[0, 0.6], [1, 0.3]]) {
          const f = D.front[s.gi][si]; if (f == null) continue;
          const tIn = (cx0[si] - (q[0] - f)) / SHADOWS[si].v;
          boost = Math.max(boost, 1 + k * smooth((c.dur + 0.6 - tIn) / 1.2));
        }
        const fl = 0.5 + 0.5 * Math.sin(TAU * s.fq * lt + s.ph);
        // 先把本身的亮度封顶，再乘影子：影子边一到，闪光就按浓度成比例变暗（不会先被封顶吃掉）
        const a = clamp((0.25 + 0.55 * fl * fl) * boost * (s.extra ? 1.25 : 1)) * glintShade(s, lt, c, cxs) * (0.85 + 0.25 * beat) * (1 - 0.15 * white);
        const r = s.sz * (1.3 + 2.4 * fl) * Math.sqrt(boost);
        g.globalAlpha = clamp(a);
        g.drawImage(dot, q[0] - r * 1.6, q[1] - r * 0.45, r * 3.2, r * 0.9);
        // 河湾一簇的晕：许多碎光叠成一团眩光，被影子盖住时一起暗下去
        if (s.bend && s.extra) { g.globalAlpha = clamp(0.05 * a); g.drawImage(halo, q[0] - 18, q[1] - 5, 36, 10); }
      }
      g.restore();
    }
    // 草籽絮：从岭上的草里被风带起，向左飘，淡入淡出
    function fluff(g, lt, c) {
      const dot = softDot('#fffdf2', 0.5);
      const beat = softBeat(c, 0.6);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const life = 5 + h2(i, 1) * 3, tt = lt + h2(i, 2) * life, age = ((tt % life) + life) % life;
        const x0 = 300 + h2(i, 3) * 520, y0 = 520 + h2(i, 4) * 50;
        const x = x0 - age * (24 + h2(i, 5) * 16), y = y0 - age * (10 + h2(i, 6) * 10) + 6 * Math.sin(age * 1.7 + i);
        const a = smooth(age / 0.6) * smooth((life - age) / 0.8);
        const r = 1.6 + h2(i, 7) * 1.6;
        g.globalAlpha = a * (0.55 + 0.2 * beat);
        g.drawImage(dot, x - r, y - r, r * 2, r * 2);
      }
      g.restore();
    }
    XYT.registerShot('c1_ridge', {
      name: '夏岭望城', zone: 'right', night: false,
      text: '#26302a', shadow: 'rgba(250,248,236,0.9)', accent: '#2f5f9a', bloom: 0.2,
      draw,
    });
  })();
  // ============================================================
  // c1_guqin：夏夜宴罢，临水平台矮几上古琴余颤；月亮滑出薄云，银白月光漫过对面的水榭；栏边女子与倒影一同淡去
  // ============================================================
  (function () {
    const FB = [0.273, 0.613, 0.973, 1.613, 2.273, 2.633, 3.063, 3.493, 3.953, 4.273, 4.723];
    // 相机坐在水边平台上：眼高出水面 EY 米，视平线 YH；世界坐标 X 右、Y 离水面高、D 纵深（米）
    const F = 1000, YH = 360, EY = 1.15, CX = 640;
    const P = (X, Y, D) => [CX + (F * X) / D, YH + (F * (EY - Y)) / D];
    const D0 = 12;                       // 对面水榭前檐所在纵深
    const WL = P(0, 0, D0)[1];           // 水榭前沿的水线（倒影的镜像轴）
    const FLOOR = 0.7, BEAM = 3.2;
    const PIL = [-4.5, -1.5, 1.5, 4.5];
    const RAIL_END = 3.2;                // 栏杆到此为止，右边是下水的台阶口
    const LANT = [-3.4, -1.1, 1.1, 3.4]; // 檐下四盏灯笼
    const LANT_Y0 = 2.35, LANT_Y1 = 2.77;
    const HER = { X: 3.86, h: 137 };
    HER.p = P(HER.X, FLOOR, D0);
    const PAV_H = 520, NEAR_Y0 = 590;   // 水榭缓存的下界、近景缓存的上界（只缓存有内容的部分）
    const WOOD = '#3a2d27', WOOD_D = '#241c19', WOOD_L = '#5a4434';
    const MOON = '#c9d6e6', WARM = '#f2c27a';
    // 近处平台与矮几
    const DECK_Y = 0.15, TBL_Y = 0.5, TBL_D0 = 1.85, TBL_D1 = 2.4, TBL_X0 = -1.12, TBL_X1 = 0.42;
    const QIN = { X0: -0.98, X1: 0.24, D0: 2.08, D1: 2.27, Y: 0.565 };
    const qw = (u) => {
      let w = lerp(0.72, 0.84, smooth(u / 0.78)) - 0.05 * Math.exp(-Math.pow((u - 0.42) / 0.05, 2));
      w = lerp(w, 1.0, smooth((u - 0.74) / 0.08));
      w -= 0.14 * Math.exp(-Math.pow((u - 0.9) / 0.025, 2));
      if (u > 0.985) w *= 1 - smooth((u - 0.985) / 0.015) * 0.25;
      return w;
    };
    // 琴面上的点：u 由尾（0）到头（1），v 由近边（0）到远边（1），按宽度轮廓收放
    const tq = (u, v, dy) => P(lerp(QIN.X0, QIN.X1, u), QIN.Y + (dy || 0) + 0.006 * Math.sin(Math.PI * v), lerp(QIN.D0, QIN.D1, 0.5 + (v - 0.5) * qw(u)));

    // ---------- 夜空与远岸 ----------
    function buildSky(g) {
      const gr = g.createLinearGradient(0, 0, 0, YH + 10);
      gr.addColorStop(0, '#0e1019'); gr.addColorStop(0.6, '#171a27'); gr.addColorStop(1, '#262b3b');
      g.fillStyle = gr; g.fillRect(0, 0, W, YH + 10);
      // 疏星（只在离月亮远的左半边，很淡）
      const R = rng(5);
      for (let i = 0; i < 40; i++) {
        const x = R() * 620, y = R() * 300, a = 0.15 + R() * 0.35;
        g.fillStyle = rgba('#dfe6f2', a * (1 - x / 700));
        g.fillRect(x, y, 1 + (R() < 0.15 ? 0.6 : 0), 1);
      }
      // 远岸：一线垂柳与矮树的剪影
      blurBox(g, -20, YH - 60, W + 40, 80, 1.2, (tg) => {
        tg.fillStyle = '#121520';
        tg.beginPath(); tg.moveTo(-20, YH + 4);
        for (let x = -20; x <= W + 20; x += 5) tg.lineTo(x, YH - 6 - 22 * Math.pow(noise1(x / 60, 3), 2) - 8 * noise1(x / 13, 4));
        tg.lineTo(W + 20, YH + 4); tg.closePath(); tg.fill();
        tg.strokeStyle = '#121520'; tg.lineWidth = 1;
        for (let i = 0; i < 60; i++) { const x = R() * W, y = YH - 16 - R() * 22; tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + 3, y + 10, x + 1, y + 18 + R() * 8); tg.stroke(); }
      });
      // 远水（水榭两侧露出的水面）
      const wg = g.createLinearGradient(0, YH, 0, YH + 120);
      wg.addColorStop(0, '#20263a'); wg.addColorStop(1, '#141826');
      g.fillStyle = wg; g.fillRect(0, YH, W, 120);
    }
    // 月旁的薄云：向左缓移
    function buildCloud(g, lit) {
      blurBox(g, 0, 0, 700, 200, lit ? 4 : 6, (tg) => {
        const R = rng(lit ? 61 : 61);
        for (let i = 0; i < 22; i++) {
          const x = 60 + R() * 560, y = 60 + R() * 70, rx = 60 + R() * 90, ry = 10 + R() * 16;
          const gr = tg.createRadialGradient(x, y, 1, x, y, rx);
          if (lit) { gr.addColorStop(0, rgba('#dfe8f4', 0.0)); gr.addColorStop(0.75, rgba('#e6eef8', 0.5)); gr.addColorStop(1, rgba('#e6eef8', 0)); }
          else { gr.addColorStop(0, rgba('#5a6276', 0.55)); gr.addColorStop(1, rgba('#5a6276', 0)); }
          tg.fillStyle = gr; tg.save(); tg.translate(x, y); tg.scale(1, ry / rx); tg.translate(-x, -y);
          tg.beginPath(); tg.arc(x, y, rx, 0, TAU); tg.fill(); tg.restore();
        }
      });
    }
    // ---------- 水榭（前檐在 D0）----------
    const quad = (g, a, b, c, d) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); };
    const boxF = (g, x0, y0, x1, y1, D, col) => { quad(g, P(x0, y0, D), P(x1, y0, D), P(x1, y1, D), P(x0, y1, D)); g.fillStyle = col; g.fill(); };
    function lattice(g, x0, y0, x1, y1, D, col, cell) {
      // 几何格心：竖横细木条
      g.strokeStyle = col; g.lineWidth = Math.max(0.7, (F * 0.025) / D);
      const a = P(x0, y0, D), b = P(x1, y1, D);
      const nx = Math.max(2, Math.round((x1 - x0) / cell)), ny = Math.max(2, Math.round((y1 - y0) / cell));
      for (let i = 0; i <= nx; i++) { const x = lerp(a[0], b[0], i / nx); g.beginPath(); g.moveTo(x, a[1]); g.lineTo(x, b[1]); g.stroke(); }
      for (let j = 0; j <= ny; j++) { const y = lerp(a[1], b[1], j / ny); g.beginPath(); g.moveTo(a[0], y); g.lineTo(b[0], y); g.stroke(); }
    }
    // 台阶口：从地板下到水边的三级石阶（伸向镜头一侧），最下一级砌到水面（石墩），水线处一道湿痕
    const STEP_D = D0 - 3 * 0.28;          // 最下一级前沿的纵深（它自己的水线是倒影轴）
    const WLS = P(0, 0, STEP_D)[1];
    function drawSteps(g) {
      for (let k = 0; k < 3; k++) {
        const y = FLOOR - (k + 1) * 0.18, d = D0 - (k + 1) * 0.28;
        quad(g, P(RAIL_END + 0.1, y + 0.18, d + 0.28), P(4.4, y + 0.18, d + 0.28), P(4.4, y + 0.18, d), P(RAIL_END + 0.1, y + 0.18, d));
        g.fillStyle = '#4b4646'; g.fill();
        boxF(g, RAIL_END + 0.1, k === 2 ? 0 : y, 4.4, y + 0.18, d, '#2f2b2c');
      }
      // 石墩的砌缝与湿痕
      g.strokeStyle = 'rgba(20,18,20,0.6)'; g.lineWidth = 1;
      for (const yy of [0.12]) { const a = P(RAIL_END + 0.1, yy, STEP_D), b = P(4.4, yy, STEP_D); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      boxF(g, RAIL_END + 0.1, 0, 4.4, 0.06, STEP_D, '#1c1a1d');
    }
    function buildPavilion(g, noSteps) {
      const DB = D0 + 5;
      // 室内：后墙隔扇（纸面被灯光映暖）、天花、地板
      quad(g, P(-4.5, FLOOR, DB), P(4.5, FLOOR, DB), P(4.5, BEAM, DB), P(-4.5, BEAM, DB));
      const bw = g.createLinearGradient(0, P(0, BEAM, DB)[1], 0, P(0, FLOOR, DB)[1]);
      bw.addColorStop(0, '#3d2f28'); bw.addColorStop(0.5, '#6b4f36'); bw.addColorStop(1, '#4a3a2e');
      g.fillStyle = bw; g.fill();
      for (let i = 0; i < 8; i++) {
        const x0 = -4.4 + i * 1.1, x1 = x0 + 1.0;
        boxF(g, x0 + 0.08, FLOOR + 0.5, x1 - 0.08, BEAM - 0.25, DB, 'rgba(232,186,120,0.28)');
        lattice(g, x0 + 0.08, FLOOR + 0.5, x1 - 0.08, BEAM - 0.25, DB, 'rgba(40,28,22,0.75)', 0.22);
        boxF(g, x0 + 0.08, FLOOR + 0.05, x1 - 0.08, FLOOR + 0.45, DB, '#3a2c25');
      }
      // 两侧的内墙（透视），同样是隔扇
      for (const sd of [-1, 1]) {
        const X = sd * 4.5;
        quad(g, P(X, FLOOR, D0), P(X, FLOOR, DB), P(X, BEAM, DB), P(X, BEAM, D0));
        g.fillStyle = '#3a2c25'; g.fill();
        for (let k = 0; k < 4; k++) {
          const d0 = D0 + 0.2 + k * 1.2, d1 = d0 + 1.05;
          quad(g, P(X, FLOOR + 0.5, d0), P(X, FLOOR + 0.5, d1), P(X, BEAM - 0.25, d1), P(X, BEAM - 0.25, d0));
          g.fillStyle = 'rgba(220,170,108,0.2)'; g.fill();
        }
      }
      // 天花
      quad(g, P(-4.5, BEAM, D0), P(4.5, BEAM, D0), P(4.5, BEAM, DB), P(-4.5, BEAM, DB));
      g.fillStyle = '#1e1714'; g.fill();
      g.strokeStyle = 'rgba(80,60,44,0.6)'; g.lineWidth = 1;
      for (let k = 1; k < 6; k++) { const d = D0 + k * (DB - D0) / 6, a = P(-4.5, BEAM, d), b = P(4.5, BEAM, d); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      // 地板
      quad(g, P(-4.5, FLOOR, D0), P(4.5, FLOOR, D0), P(4.5, FLOOR, DB), P(-4.5, FLOOR, DB));
      const fg = g.createLinearGradient(0, P(0, FLOOR, DB)[1], 0, P(0, FLOOR, D0)[1]);
      fg.addColorStop(0, '#5a4231'); fg.addColorStop(1, '#3b2c24');
      g.fillStyle = fg; g.fill();
      // 室内的灯光：灯笼下暖光
      for (const lx of LANT) {
        const c0 = P(lx, LANT_Y0, D0 + 1.5);
        const gr = g.createRadialGradient(c0[0], c0[1] + 40, 4, c0[0], c0[1] + 40, 170);
        gr.addColorStop(0, 'rgba(255,196,120,0.28)'); gr.addColorStop(1, 'rgba(255,196,120,0)');
        g.fillStyle = gr; g.fillRect(c0[0] - 180, c0[1] - 140, 360, 340);
      }
      // 台基：地板前沿的木枋、水中的石柱
      boxF(g, -4.8, FLOOR - 0.16, 4.8, FLOOR, D0, WOOD_D);
      boxF(g, -4.8, FLOOR - 0.03, 4.8, FLOOR, D0, '#4a3a30');
      // 石柱只画到水面（水下看不见）；水线处一道湿痕；水面以下由倒影接上
      for (let i = 0; i < 7; i++) {
        const x = -4.5 + i * 1.5;
        boxF(g, x - 0.14, 0, x + 0.14, FLOOR - 0.16, D0, '#2a2526');
        boxF(g, x - 0.14, 0, x - 0.08, FLOOR - 0.16, D0, '#3a3436');
        boxF(g, x - 0.14, 0, x + 0.14, 0.07, D0, '#181619');
      }
      if (!noSteps) drawSteps(g);
      // 柱子
      for (const x of PIL) {
        boxF(g, x - 0.13, FLOOR, x + 0.13, BEAM, D0, WOOD);
        boxF(g, x + 0.06, FLOOR, x + 0.13, BEAM, D0, WOOD_D);
        // 柱础
        boxF(g, x - 0.19, FLOOR, x + 0.19, FLOOR + 0.14, D0, '#4a4444');
      }
      // 挂落：额枋下一圈镂空木格
      for (let i = 0; i < 3; i++) {
        const x0 = PIL[i] + 0.13, x1 = PIL[i + 1] - 0.13;
        boxF(g, x0, BEAM - 0.3, x1, BEAM - 0.26, D0, WOOD_D);
        lattice(g, x0, BEAM - 0.26, x1, BEAM, D0, WOOD_D, 0.16);
        // 两端的小雀替
        for (const [xx, sd] of [[x0, 1], [x1, -1]]) {
          const a = P(xx, BEAM - 0.3, D0), b = P(xx + sd * 0.45, BEAM - 0.3, D0), c = P(xx, BEAM - 0.62, D0);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.quadraticCurveTo(lerp(b[0], c[0], 0.8), lerp(b[1], c[1], 0.15), c[0], c[1]); g.closePath();
          g.fillStyle = WOOD_D; g.fill();
        }
      }
      // 额枋
      boxF(g, -4.85, BEAM, 4.85, BEAM + 0.24, D0, WOOD_D);
      boxF(g, -4.85, BEAM + 0.18, 4.85, BEAM + 0.24, D0, '#3f312b');
      // 檐下：椽子底面（从额枋伸到檐口）
      const EDGE_D = D0 - 1.05, EDGE_Y = 3.62;
      quad(g, P(-5.8, BEAM + 0.24, D0), P(5.8, BEAM + 0.24, D0), P(5.8, EDGE_Y, EDGE_D), P(-5.8, EDGE_Y, EDGE_D));
      g.fillStyle = '#1b1513'; g.fill();
      g.strokeStyle = 'rgba(70,52,40,0.7)'; g.lineWidth = 1.2;
      for (let x = -5.6; x <= 5.6; x += 0.3) { const a = P(x, BEAM + 0.24, D0), b = P(x * 1.0, EDGE_Y, EDGE_D); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      // 屋面：檐口两端起翘，往后升到正脊
      const lift = (x) => 0.55 * Math.pow(Math.max(0, (Math.abs(x) - 3.4) / 2.6), 2);
      const eave = [], ridge = [];
      for (let i = 0; i <= 40; i++) { const x = lerp(-6.2, 6.2, i / 40); eave.push(P(x, EDGE_Y + lift(x), EDGE_D)); }
      const RD = D0 + 3.6, RY = 5.75;
      for (let i = 0; i <= 20; i++) { const x = lerp(-3.4, 3.4, i / 20); ridge.push(P(x, RY, RD)); }
      g.beginPath();
      eave.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      // 右侧垂脊（略凹的弧）
      const er = eave[eave.length - 1], rr = ridge[ridge.length - 1], el = eave[0], rl = ridge[0];
      g.quadraticCurveTo(lerp(er[0], rr[0], 0.55) + 30, lerp(er[1], rr[1], 0.55) + 18, rr[0], rr[1]);
      for (let i = ridge.length - 1; i >= 0; i--) g.lineTo(ridge[i][0], ridge[i][1]);
      g.quadraticCurveTo(lerp(el[0], rl[0], 0.55) - 30, lerp(el[1], rl[1], 0.55) + 18, el[0], el[1]);
      g.closePath();
      const rg = g.createLinearGradient(0, rl[1], 0, el[1]);
      rg.addColorStop(0, '#1c1e27'); rg.addColorStop(1, '#262833');
      g.fillStyle = rg; g.fill();
      // 瓦垄（很淡，歌词压在上面）
      g.save(); g.clip();
      g.strokeStyle = 'rgba(10,10,14,0.35)'; g.lineWidth = 1;
      for (let i = 0; i <= 46; i++) {
        const u = i / 46, a = P(lerp(-6.0, 6.0, u), EDGE_Y + lift(lerp(-6.0, 6.0, u)), EDGE_D), b = P(lerp(-3.3, 3.3, u), RY, RD);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      g.restore();
      // 垂脊：正脊两端斜下到翼角
      g.strokeStyle = '#15161d'; g.lineWidth = 3;
      for (const [q, e] of [[rl, el], [rr, er]]) {
        g.beginPath(); g.moveTo(q[0], q[1] - 3);
        g.quadraticCurveTo(lerp(e[0], q[0], 0.45) + (e[0] < q[0] ? -24 : 24), lerp(e[1], q[1], 0.45) + 14, e[0], e[1] - 2); g.stroke();
      }
      // 檐口一线滴水瓦头
      g.strokeStyle = '#2f313c'; g.lineWidth = 2.2;
      g.beginPath(); eave.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      // 正脊与两端的鸱吻
      g.fillStyle = '#15161d';
      g.beginPath(); g.moveTo(rl[0], rl[1] + 1); g.lineTo(rr[0], rr[1] + 1); g.lineTo(rr[0], rr[1] - 7); g.lineTo(rl[0], rl[1] - 7); g.closePath(); g.fill();
      for (const [q, sd] of [[rl, -1], [rr, 1]]) {
        g.beginPath(); g.moveTo(q[0], q[1] - 6); g.quadraticCurveTo(q[0] + sd * 2, q[1] - 22, q[0] - sd * 10, q[1] - 18);
        g.quadraticCurveTo(q[0] - sd * 4, q[1] - 13, q[0] - sd * 6, q[1] - 6); g.closePath(); g.fill();
      }
      // 翼角上翘的尖
      for (const [q, sd] of [[el, -1], [er, 1]]) {
        g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[0] + sd * 10, q[1] - 2, q[0] + sd * 16, q[1] - 14); g.lineTo(q[0] + sd * 6, q[1] - 2); g.closePath();
        g.fillStyle = '#262833'; g.fill();
      }
      // 栏杆：寻杖栏杆，到台阶口为止
      const r0 = -4.5, r1 = RAIL_END;
      boxF(g, r0, FLOOR + 0.5, r1, FLOOR + 0.56, D0 - 0.05, WOOD);
      boxF(g, r0, FLOOR + 0.1, r1, FLOOR + 0.15, D0 - 0.05, WOOD_D);
      for (let x = r0; x <= r1 + 1e-6; x += 0.75) boxF(g, x - 0.05, FLOOR, x + 0.05, FLOOR + 0.62, D0 - 0.05, WOOD_D);
      for (let x = r0; x < r1 - 0.1; x += 0.75) {
        const x1 = Math.min(r1, x + 0.75);
        // 栏板上的简洁格子
        lattice(g, x + 0.12, FLOOR + 0.19, x1 - 0.12, FLOOR + 0.46, D0 - 0.05, 'rgba(36,27,23,0.9)', 0.13);
      }
      boxF(g, r1 - 0.06, FLOOR, r1 + 0.06, FLOOR + 0.72, D0 - 0.05, WOOD_D);
      // 灯笼的提绳（灯体每帧画）
      g.strokeStyle = 'rgba(20,16,14,0.9)'; g.lineWidth = 1;
      for (const lx of LANT) { const a = P(lx, BEAM, D0 - 0.2), b = P(lx, LANT_Y1 + 0.03, D0 - 0.2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    }
    // 月光照亮的边（右上方来的银光）：屋脊、右翼角、柱与栏杆右缘、台阶沿
    function buildPavMoon(g) {
      g.strokeStyle = rgba(MOON, 0.55); g.lineCap = 'round';
      const EDGE_D = D0 - 1.05, EDGE_Y = 3.62, RD = D0 + 3.6, RY = 5.75;
      const lift = (x) => 0.55 * Math.pow(Math.max(0, (Math.abs(x) - 3.4) / 2.6), 2);
      // 屋脊只亮右半段（左边是歌词）
      g.lineWidth = 1.3;
      let a = P(2.0, RY, RD), b = P(3.4, RY, RD); g.beginPath(); g.moveTo(a[0], a[1] - 7); g.lineTo(b[0], b[1] - 7); g.stroke();
      // 右侧檐口与翼角
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i <= 12; i++) { const x = lerp(3.0, 6.2, i / 12), q = P(x, EDGE_Y + lift(x), EDGE_D); i ? g.lineTo(q[0], q[1] - 1) : g.moveTo(q[0], q[1] - 1); }
      g.stroke();
      // 柱、栏杆的右缘
      g.lineWidth = 1;
      for (const x of PIL) { a = P(x + 0.13, FLOOR + 0.14, D0); b = P(x + 0.13, BEAM, D0); g.beginPath(); g.moveTo(a[0] - 0.5, a[1]); g.lineTo(b[0] - 0.5, b[1]); g.stroke(); }
      a = P(-4.5, FLOOR + 0.56, D0 - 0.05); b = P(RAIL_END, FLOOR + 0.56, D0 - 0.05);
      g.globalAlpha = 0.7; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      // 台阶沿与台基前沿
      for (let k = 0; k < 3; k++) { const y = FLOOR - k * 0.18, d = D0 - k * 0.28; a = P(RAIL_END + 0.1, y, d); b = P(4.4, y, d); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      a = P(-4.8, FLOOR, D0); b = P(4.8, FLOOR, D0); g.globalAlpha = 0.45; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.globalAlpha = 1;
    }
    // 倒影：整幅水榭以水线为轴翻转，压暗、偏冷、略糊
    // 每部分以它自己脚下的水线为轴：水榭以前檐水线 WL，伸出来的台阶以它自己的水线 WLS
    function buildReflect(g) {
      const pav = K.cache('fg4guqin-pavns', W, PAV_H, 1, (pg) => buildPavilion(pg, true));
      blurBox(g, 0, WL - 4, W, H - WL + 8, 1.6, (tg) => {
        tg.save(); tg.translate(0, 2 * WL); tg.scale(1, -1);
        tg.drawImage(pav, 0, 0, W, PAV_H);
        tg.restore();
        tg.save(); tg.translate(0, 2 * WLS); tg.scale(1, -1);
        drawSteps(tg);
        tg.restore();
        tg.globalCompositeOperation = 'source-atop';
        tg.fillStyle = 'rgba(16,20,34,0.5)'; tg.fillRect(0, WL, W, H - WL);
      });
    }
    // ---------- 近处：平台、矮几、古琴、倒下的酒杯、空坐垫 ----------
    function buildNear(g) {
      // 平台木板（画面最下沿一窄条）
      const d0 = P(0, DECK_Y, 3.0)[1];
      const dg = g.createLinearGradient(0, d0, 0, H);
      dg.addColorStop(0, '#2c2420'); dg.addColorStop(1, '#1a1513');
      g.fillStyle = dg; g.fillRect(0, d0, W, H - d0);
      g.strokeStyle = 'rgba(10,8,8,0.6)'; g.lineWidth = 1;
      for (let x = -3; x <= 3; x += 0.22) { const a = P(x, DECK_Y, 3.0), b = P(x, DECK_Y, 1.4); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      g.fillStyle = rgba('#6a5444', 0.5); g.fillRect(0, d0 - 1, W, 1.5);
      // 空坐垫（蒲团，直径 0.5 m、厚 0.09 m）：几案右边的平台上，整块在平台内（远沿 D 2.9 < 平台边 3.0），近半被画框下沿裁掉
      {
        const ct = cushionTop(), cb = cushionBase();
        // 侧面（只在最宽处以下露出两边一点）
        g.fillStyle = '#2e221e';
        g.beginPath(); g.ellipse(cb.x, cb.y, cb.rx, cb.ry, 0, 0, Math.PI); g.lineTo(ct.x - ct.rx, ct.y); g.ellipse(ct.x, ct.y, ct.rx, ct.ry, 0, Math.PI, 0, true); g.closePath(); g.fill();
        // 顶面：草编一圈圈的纹
        const tgc = g.createRadialGradient(ct.x - ct.rx * 0.2, ct.y - ct.ry * 0.3, 2, ct.x, ct.y, ct.rx);
        tgc.addColorStop(0, '#54402f'); tgc.addColorStop(1, '#3f2f28');
        g.fillStyle = tgc; g.beginPath(); g.ellipse(ct.x, ct.y, ct.rx, ct.ry, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(20,14,12,0.3)'; g.lineWidth = 1;
        for (let k = 1; k < 6; k++) { g.beginPath(); g.ellipse(ct.x, ct.y + ct.ry * 0.04 * k, ct.rx * k / 6, ct.ry * k / 6, 0, 0, TAU); g.stroke(); }
      }
      // 矮几：几面（深色木，前缘略亮）、几面前沿、两条腿
      const a = P(TBL_X0, TBL_Y, TBL_D0), b = P(TBL_X1, TBL_Y, TBL_D0), c = P(TBL_X1, TBL_Y, TBL_D1), d = P(TBL_X0, TBL_Y, TBL_D1);
      quad(g, a, b, c, d);
      const tg = g.createLinearGradient(0, d[1], 0, a[1]);
      tg.addColorStop(0, '#1d1513'); tg.addColorStop(1, '#2a1f1b');
      g.fillStyle = tg; g.fill();
      const a2 = P(TBL_X0, TBL_Y - 0.045, TBL_D0), b2 = P(TBL_X1, TBL_Y - 0.045, TBL_D0);
      quad(g, a, b, b2, a2); g.fillStyle = '#140f0d'; g.fill();
      g.strokeStyle = rgba('#a0704a', 0.45); g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      for (const x of [TBL_X0 + 0.08, TBL_X1 - 0.12]) {
        const l0 = P(x, TBL_Y - 0.045, TBL_D0 + 0.03), l1 = P(x + 0.06, DECK_Y, TBL_D0 + 0.03);
        g.fillStyle = '#1c1512'; g.fillRect(l0[0], l0[1], l1[0] - l0[0], H - l0[1]);
      }
      // 古琴：琴身（漆面）、岳山、龙龈、徽
      const body = (dy) => {
        g.beginPath();
        for (let i = 0; i <= 60; i++) { const p = tq(i / 60, 0, dy); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
        for (let i = 60; i >= 0; i--) { const p = tq(i / 60, 1, dy); g.lineTo(p[0], p[1]); }
        g.closePath();
      };
      // 琴侧（厚度）
      body(-0.05); g.fillStyle = '#0e0a09'; g.fill();
      body(-0.02); g.fillStyle = '#1a1210'; g.fill();
      body(0);
      const qg = g.createLinearGradient(0, tq(0, 1)[1], 0, tq(0, 0)[1]);
      qg.addColorStop(0, '#3c2a22'); qg.addColorStop(1, '#4a3329');
      g.fillStyle = qg; g.fill();
      // 漆面映着对岸灯光的一道暖光
      g.save(); body(0); g.clip();
      const sh = tq(0.55, 0.65);
      const sgr = g.createRadialGradient(sh[0], sh[1], 1, sh[0], sh[1], 260);
      sgr.addColorStop(0, rgba('#e0a060', 0.3)); sgr.addColorStop(1, rgba('#e0a060', 0));
      g.fillStyle = sgr; g.fillRect(sh[0] - 270, sh[1] - 40, 540, 80);
      g.restore();
      // 漆面上的断纹（极淡）
      g.save(); body(0); g.clip();
      // 漆面的断纹：零碎、不规则的细短纹（不能像品位）
      g.strokeStyle = 'rgba(12,8,8,0.22)'; g.lineWidth = 0.6;
      { const R = rng(29); for (let i = 0; i < 40; i++) { const u = 0.06 + R() * 0.88, v = 0.15 + R() * 0.7, p0 = tq(u, v), p1 = tq(u + (R() - 0.5) * 0.01, v + 0.08 + R() * 0.12); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); } }
      g.restore();
      // 岳山（右端）与龙龈（左端）
      let q0 = tq(0.955, 0.08), q1 = tq(0.955, 0.92);
      g.strokeStyle = '#120c0b'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke();
      q0 = tq(0.035, 0.18); q1 = tq(0.035, 0.82);
      g.lineWidth = 2; g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.stroke();
      // 十三徽：弹琴的人坐在镜头这一侧（琴头在他右手边），徽嵌在离他远的一侧边上、一弦之外
      for (let k = 1; k <= 13; k++) {
        const u = 0.955 - (0.92 * [0.125, 0.167, 0.2, 0.25, 0.333, 0.4, 0.5, 0.6, 0.667, 0.75, 0.8, 0.833, 0.875][k - 1]);
        const q = tq(u, 0.92);
        g.fillStyle = '#8d877c'; g.beginPath(); g.ellipse(q[0], q[1], k === 7 ? 1.8 : 1.3, 0.8, 0, 0, TAU); g.fill();
      }
      // 雁足下的琴轸穗子（右端垂下）
      g.strokeStyle = 'rgba(120,40,36,0.85)'; g.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const q = tq(0.985, 0.15 + k * 0.11, -0.05); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + 2, q[1] + 10 + (k % 2) * 3); g.stroke(); }
      // 倒下的酒杯：侧躺在几面右侧，杯口朝左前，洒出一小片酒
      const cp = P(0.36, TBL_Y, 2.04);
      g.fillStyle = 'rgba(70,40,34,0.55)';
      g.beginPath(); g.ellipse(cp[0] - 26, cp[1] + 3, 22, 3.5, 0, 0, TAU); g.fill();
      g.save(); g.translate(cp[0], cp[1] - 5); g.rotate(-0.1);
      const cg = g.createLinearGradient(0, -7, 0, 7);
      cg.addColorStop(0, '#c9d4cc'); cg.addColorStop(0.5, '#a9b8ae'); cg.addColorStop(1, '#5d6862');
      g.fillStyle = cg;
      g.beginPath(); g.moveTo(-9, -7); g.lineTo(7, -4); g.quadraticCurveTo(10, 0, 7, 4); g.lineTo(-9, 7); g.closePath(); g.fill();
      g.fillStyle = '#1a1614'; g.beginPath(); g.ellipse(-9, 0, 2.6, 7, 0, 0, TAU); g.fill();
      g.strokeStyle = '#d7e0da'; g.lineWidth = 0.9; g.beginPath(); g.ellipse(-9, 0, 2.6, 7, 0, 0, TAU); g.stroke();
      g.fillStyle = '#7d8a82'; g.fillRect(7.5, -2.6, 2, 5.2);
      g.restore();
    }
    // 坐垫顶面、底面的投影椭圆（由近、远两点的投影定中心与半轴）
    const CUSH = { X: 1.12, D: 2.65, r: 0.25, Y0: DECK_Y, Y1: DECK_Y + 0.09 };
    const cushEll = (Y) => { const n = P(CUSH.X, Y, CUSH.D - CUSH.r), f = P(CUSH.X, Y, CUSH.D + CUSH.r); return { x: P(CUSH.X, Y, CUSH.D)[0], y: (n[1] + f[1]) / 2, rx: (F * CUSH.r) / CUSH.D, ry: (n[1] - f[1]) / 2 }; };
    const cushionTop = () => cushEll(CUSH.Y1), cushionBase = () => cushEll(CUSH.Y0);
    // 月光落在近处：琴面与弦的银光、徽的反光、几沿、杯沿、坐垫右后沿
    function buildNearMoon(g) {
      { const ct = cushionTop(); g.strokeStyle = rgba(MOON, 0.45); g.lineWidth = 1.2; g.beginPath(); g.ellipse(ct.x, ct.y, ct.rx - 1, ct.ry - 1, 0, Math.PI * 1.55, Math.PI * 1.98); g.stroke(); }
      g.strokeStyle = rgba(MOON, 0.7); g.lineWidth = 1;
      const a = P(TBL_X0, TBL_Y, TBL_D0), b = P(TBL_X1, TBL_Y, TBL_D0);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      // 琴面右前方的一抹漆光
      const q = tq(0.75, 0.3);
      const gr = g.createRadialGradient(q[0], q[1], 1, q[0], q[1], 120);
      gr.addColorStop(0, rgba(MOON, 0.28)); gr.addColorStop(1, rgba(MOON, 0));
      g.save(); g.translate(q[0], q[1]); g.scale(1, 0.12); g.translate(-q[0], -q[1]);
      g.fillStyle = gr; g.fillRect(q[0] - 130, q[1] - 130, 260, 260);
      g.restore();
      for (let k = 1; k <= 13; k++) {
        const u = 0.955 - (0.92 * [0.125, 0.167, 0.2, 0.25, 0.333, 0.4, 0.5, 0.6, 0.667, 0.75, 0.8, 0.833, 0.875][k - 1]);
        const p = tq(u, 0.92);
        g.fillStyle = rgba('#eef4ff', 0.9); g.beginPath(); g.ellipse(p[0], p[1], 1.2, 0.7, 0, 0, TAU); g.fill();
      }
      const cp = P(0.36, TBL_Y, 2.04);
      g.strokeStyle = rgba('#f2f6ff', 0.8); g.beginPath(); g.moveTo(cp[0] - 10, cp[1] - 14); g.lineTo(cp[0] + 9, cp[1] - 11.5); g.stroke();
      g.fillStyle = rgba(MOON, 0.45); g.beginPath(); g.ellipse(cp[0] - 20, cp[1] + 2.5, 8, 1.4, 0, 0, TAU); g.fill();
    }
    // 弦：七根，从岳山到龙龈；ve = 每根的振动虚带宽度（像素）
    function strings(g, vib, moon) {
      for (let k = 0; k < 7; k++) {
        const v = 0.2 + k * 0.1;
        // 弦在岳山处高出琴面约 5 毫米，到龙龈几乎贴面
        const p0 = tq(0.955, v, 0.005), p1 = tq(0.035, 0.3 + k * 0.067, 0.0012);
        const w = vib[k] || 0;
        const base = mix('#a59a86', '#dfe7f2', moon);
        if (w > 0.05) {
          // 两端固定、中间最宽的虚带（纺锤形），半透明
          g.fillStyle = rgba(mix(base, '#fff6e8', 0.55), 0.45);
          g.beginPath();
          const n = 16;
          for (let i = 0; i <= n; i++) { const u = i / n, x = lerp(p0[0], p1[0], u), y = lerp(p0[1], p1[1], u) - w * Math.sin(Math.PI * u); i ? g.lineTo(x, y) : g.moveTo(x, y); }
          for (let i = n; i >= 0; i--) { const u = i / n, x = lerp(p0[0], p1[0], u), y = lerp(p0[1], p1[1], u) + w * Math.sin(Math.PI * u); g.lineTo(x, y); }
          g.closePath(); g.fill();
        }
        g.strokeStyle = rgba(base, 0.75 - Math.min(0.35, w * 0.15)); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
    }
    // 灯笼：纸面暖光（节拍上轻轻明暗）
    function lantern(g, lx, glow, moon) {
      const sv = (c) => mix(c, '#c9ccd4', 0.45 * moon);
      const t0 = P(lx, LANT_Y1, D0 - 0.2), b0 = P(lx, LANT_Y0, D0 - 0.2);
      const cx = t0[0], cy = (t0[1] + b0[1]) / 2, ry = (b0[1] - t0[1]) / 2, rx = ry * 0.82;
      // 光晕
      g.save(); g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * glow;
      g.drawImage(softDot('#ffb860', 0.1), cx - rx * 6, cy - ry * 5.5, rx * 12, ry * 11);
      if (moon > 0.002) { g.globalAlpha = 0.12 * glow * moon; g.drawImage(softDot('#c8d0de', 0.1), cx - rx * 6, cy - ry * 5.5, rx * 12, ry * 11); }
      g.restore();
      const gr = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.1, 1, cx, cy, rx * 1.05);
      gr.addColorStop(0, sv(mix('#fff0c8', '#ffe2a8', 1 - glow))); gr.addColorStop(0.6, sv('#f0b260')); gr.addColorStop(1, sv('#a8582e'));
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(120,60,30,0.5)'; g.lineWidth = 0.7;
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(cx, cy, rx * Math.abs(k) / 2.6, ry, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#2a1c16';
      g.fillRect(cx - rx * 0.45, t0[1] - 2, rx * 0.9, 3); g.fillRect(cx - rx * 0.45, b0[1] - 1, rx * 0.9, 3);
      g.strokeStyle = 'rgba(150,40,30,0.8)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(cx, b0[1] + 2); g.lineTo(cx, b0[1] + 9); g.stroke();
    }
    // 银白版本：建缓存时把暖色压成银白、偏冷（饱和度降低 + 冷色相），再叠上月光照亮的边；每帧只按月光强度交叉淡入
    function silverOf(key, w, h, src, extra) {
      return K.cache(key, w, h, 1, (g) => {
        g.drawImage(src, 0, 0, w, h);
        g.save();
        g.globalCompositeOperation = 'saturation'; g.globalAlpha = 0.45; g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'color'; g.globalAlpha = 0.32; g.fillStyle = '#7389b0'; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(src, 0, 0, w, h);
        g.restore();
        if (extra) extra(g);
      });
    }
    function draw(g, c) {
      const lt = c.lt;
      const tMoon = charAt(c, 4, 0, FB), tFade = charAt(c, 8, 0, FB), tGone = charAt(c, 10, 0, FB);
      // 第22句第5字起月亮滑出薄云，1.2 秒内银光漫过水榭
      // 缓入缓出里掺一点匀速：两端每帧仍有变化，整幅银光层的透明度不会隔几帧才跳一档（8 位量化）
      const mu = clamp((lt - tMoon) / 1.2), moon = 0.65 * mu + 0.35 * smooth(mu);
      const beat = softBeat(c, 0.5);
      // 交叉淡入的透明度封顶在 0.996：到 1 时浏览器改走不混合的直拷，整幅会有一档取整差
      const fade = (a, b) => { g.drawImage(a, 0, 0, a.lw, a.lh); if (moon > 0.002) { g.globalAlpha = Math.min(moon, 0.996); g.drawImage(b, 0, 0, b.lw, b.lh); g.globalAlpha = 1; } };
      // 镜头静止（分镜允许最多 1.00→1.02；静止时缓存层按整像素贴）
      const sky = K.cache('fg4guqin-sky', W, YH + 130, 1, buildSky);
      const sky0 = K.cache('fg4guqin-sky0', W, YH + 130, 1, (sg) => { sg.drawImage(sky, 0, 0, W, YH + 130); skyGlow(sg, 0.12); });
      const sky1 = silverOf('fg4guqin-sky1', W, YH + 130, sky, (sg) => skyGlow(sg, 0.62));
      fade(sky0, sky1);
      const cl0 = K.cache('fg4guqin-cloud0', 700, 200, 1, (cg) => buildCloud(cg, false));
      const cl1 = K.cache('fg4guqin-cloud1', 700, 200, 1, (cg) => buildCloud(cg, true));
      // 薄云只在右上角（月亮那边），不进歌词区
      const cx = 990 - 6 * lt;
      g.drawImage(cl0, cx, -50, 700, 200);
      if (moon > 0.002) { g.globalAlpha = moon; g.drawImage(cl1, cx, -50, 700, 200); g.globalAlpha = 1; }
      // 水面基色（水榭之下）
      const wg = g.createLinearGradient(0, WL - 100, 0, H);
      wg.addColorStop(0, '#1a1f30'); wg.addColorStop(1, '#0d1019');
      g.fillStyle = wg; g.fillRect(0, WL - 2, W, H - WL + 2);
      // 倒影：先合成当前月光下的倒影，再按横向细波切片贴上
      const refl = K.cache('fg4guqin-refl', W, H, 1, buildReflect);
      const reflS = silverOf('fg4guqin-reflS', W, H, refl);
      const sc = scratch('fg4guqin-reflnow', W, H - WL + 2);
      sc.g.drawImage(refl, 0, WL * SS(), refl.width, (H - WL + 2) * SS(), 0, 0, W, H - WL + 2);
      if (moon > 0.002) { sc.g.globalAlpha = Math.min(moon, 0.996); sc.g.drawImage(reflS, 0, WL * SS(), reflS.width, (H - WL + 2) * SS(), 0, 0, W, H - WL + 2); sc.g.globalAlpha = 1; }
      // 女子的倒影也进这张图，和水榭倒影一起被细波切片：先在半分辨率的小画布里正着画、压暗偏冷（同 buildReflect），再倒过来贴
      // 第22句第9字起与本人一同淡出（第11字时已不见）
      const fa = 1 - smooth((lt - tFade) / Math.max(0.6, tGone - tFade));
      if (fa > 0.003) {
        const hb = XYT.sil.bounds('heroine', 'standSide', HER.h, 1), pad = 6;
        const bw = hb.right - hb.left + 2 * pad, bh = hb.bottom - hb.top + 2 * pad, fx = pad - hb.left, fy = pad - hb.top;
        const hs = scratch('fg4guqin-herrefl', bw, bh, 0.5);
        XYT.sil.draw(hs.g, 'heroine', 'standSide', fx, fy, HER.h, lt + 0.8, { facing: 1, wind: 0, body: '#2a2a38', accent: '#8a6a78' });
        hs.g.globalCompositeOperation = 'source-atop';
        hs.g.fillStyle = 'rgba(16,20,34,0.5)'; hs.g.fillRect(0, 0, bw, bh);
        hs.g.globalCompositeOperation = 'source-over';
        sc.g.save();
        sc.g.translate(HER.p[0] - fx, WL - HER.p[1] + fy); sc.g.scale(1, -1);
        sc.g.globalAlpha = 0.42 * fa;
        sc.g.drawImage(hs.c, 0, 0, bw, bh);
        sc.g.restore();
      }
      const S = sc.S;
      for (let y = WL; y < H; y += 4) {
        const k = (y - WL) / (H - WL);
        const dx = (0.4 + 3.0 * k) * Math.sin(y * 0.23 + lt * 1.3) + (0.3 + 0.8 * k) * Math.sin(y * 0.61 - lt * 0.9);
        g.drawImage(sc.c, 0, (y - WL) * S, sc.c.width, 4 * S, dx, y, W, 4);
      }
      // 灯笼在水里的倒影：竖直拉长、随波抖动
      const lcol = mix('#ffc070', '#d9dde8', 0.5 * moon);
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = lcol;
      // 灯笼在檐下 D0-0.2 处，倒影以那里的水线为轴；逐像素行画，亮度被平滑的波纹调成断续的光（不是等距横条）
      const WLL = P(0, 0, D0 - 0.2)[1];
      for (const lx of LANT) {
        const t0 = P(lx, LANT_Y1, D0 - 0.2), b0 = P(lx, LANT_Y0, D0 - 0.2);
        const y0 = 2 * WLL - b0[1], y1 = 2 * WLL - t0[1], ym = (y0 + y1) / 2, sig = (y1 - y0) * 0.9 + 6;
        for (let y = Math.floor(y0 - 6); y < y1 + 26; y++) {
          const e = Math.exp(-Math.pow((y - ym) / sig, 2));
          const brk = 0.5 + 0.5 * Math.sin(y * 0.55 + lt * 2.3 + lx * 1.7) * Math.sin(y * 0.19 - lt * 1.1 + lx);
          const dx = 3 * Math.sin(y * 0.4 + lt * 2.1 + lx) + 1.0 * Math.sin(y * 0.8 - lt * 1.4);
          const a = 0.2 * e * (0.3 + 0.7 * brk) * (0.9 + 0.12 * beat) * (1 - 0.3 * moon);
          g.globalAlpha = a; g.fillRect(t0[0] - 4 + dx, y, 8, 1);
          g.globalAlpha = a * 0.45; g.fillRect(t0[0] - 7 + dx, y, 14, 1);
        }
      }
      g.restore();
      // 水面细波（月出后带银光）
      ripples(g, lt, moon, beat);
      // 水汽：水榭脚下贴水的一层薄雾
      const mist = K.cache('fg4guqin-mist', 1600, 120, 0.5, (mg) => {
        blurBox(mg, 0, 0, 1600, 120, 14, (tg) => {
          const R = rng(71);
          for (let i = 0; i < 26; i++) { const x = R() * 1600, y = 50 + R() * 30, rx = 80 + R() * 160; tg.fillStyle = rgba('#8e9ab4', 0.22 + R() * 0.18); tg.beginPath(); tg.ellipse(x, y, rx, 14 + R() * 10, 0, 0, TAU); tg.fill(); }
        });
      });
      const mx = -((lt * 6) % 1600);
      g.globalAlpha = 0.55 + 0.25 * moon;
      g.drawImage(mist, mx, WL - 70, 1600, 120); g.drawImage(mist, mx + 1600, WL - 70, 1600, 120);
      g.globalAlpha = 1;
      // 远处的荷叶
      g.drawImage(K.cache('fg4guqin-lotus', LOTUS_BOX[2], LOTUS_BOX[3], 1, (lg) => { lg.translate(-LOTUS_BOX[0], -LOTUS_BOX[1]); buildLotus(lg); }), LOTUS_BOX[0], LOTUS_BOX[1], LOTUS_BOX[2], LOTUS_BOX[3]);
      // 水榭
      const pav = K.cache('fg4guqin-pavc', W, PAV_H, 1, buildPavilion);
      fade(pav, silverOf('fg4guqin-pavS', W, PAV_H, pav, buildPavMoon));
      for (const lx of LANT) lantern(g, lx, 0.92 + 0.08 * beat, moon);
      if (fa > 0.003) {
        // 脚下极淡的接触影（地板几乎平视，压得很扁；月在右上，略偏左）
        g.fillStyle = rgba('#0c0b10', 0.4 * fa);
        g.beginPath(); g.ellipse(HER.p[0] - 3, HER.p[1] + 0.4, HER.h * 0.09, 1.6, 0, 0, TAU); g.fill();
        XYT.sil.draw(g, 'heroine', 'standSide', HER.p[0], HER.p[1], HER.h, lt + 0.8, { facing: 1, wind: 0, glow: 0.5, body: '#1c1c28', alpha: fa, rim: '#d6dfec', rimSide: 1, rimWidth: 1 });
        // 月出前只有灯笼的暖光，银边随月光一起亮起（0.25→1）：月光未满时用不带边的同一剪影按 (1−k) 盖住银边
        // （sil 的 rim 只收十六进制色，柔光也取它的颜色，所以不改 rim 的颜色，改为再盖一遍）
        const rimK = 0.25 + 0.75 * moon;
        if (rimK < 0.999) XYT.sil.draw(g, 'heroine', 'standSide', HER.p[0], HER.p[1], HER.h, lt + 0.8, { facing: 1, wind: 0, body: '#1c1c28', alpha: fa * (1 - rimK) });
      }
      // 近处：平台、矮几、古琴
      const near = K.cache('fg4guqin-nearc', W, H - NEAR_Y0, 1, (ng) => { ng.translate(0, -NEAR_Y0); buildNear(ng); });
      const nearS = silverOf('fg4guqin-nearS', W, H - NEAR_Y0, near, (ng) => { ng.translate(0, -NEAR_Y0); buildNearMoon(ng); });
      g.save(); g.translate(0, NEAR_Y0); fade(near, nearS); g.restore();
      // 余颤：最近拨过的两根弦，第22句第1字后 1.5 秒内从约 2 像素的虚带收成细线
      const tq0 = charAt(c, 0, 0, FB);
      const decay = 1 - smooth((lt - tq0) / 1.5);
      strings(g, [0, 0, 1.3 * decay, 0, 1.0 * decay, 0, 0], moon);
    }
    // 右上画外的月亮在天上的光晕（烘进天空缓存）
    function skyGlow(g, a) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a;
      g.drawImage(softDot('#a9b8d0', 0.05), 1340 - 700, -80 - 520, 1400, 1040);
      g.restore();
    }
    // 水面：横向细纹，缓慢漂移；月出后右侧一条碎银
    function ripples(g, lt, moon, beat) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const R = rng(91);
      for (let i = 0; i < 70; i++) {
        const y = WL + 6 + Math.pow(R(), 0.8) * (H - WL - 6), k = (y - WL) / (H - WL);
        const x = ((R() * W + lt * (6 + 10 * k) * (R() < 0.5 ? 1 : -1)) % (W + 200) + W + 200) % (W + 200) - 100;
        const len = 20 + k * 90 * (0.5 + R());
        g.globalAlpha = (0.05 + 0.06 * R()) * (1 + moon);
        g.fillStyle = mix('#7a86a0', '#a9b8d0', moon);
        g.fillRect(x, y, len, 1);
      }
      if (moon > 0.003) {
        // 月光碎银：月在右上画外，亮带落在右侧，越近越宽
        const dot = softDot('#eef3ff', 0.6);
        for (let i = 0; i < 80; i++) {
          const y = WL + 4 + Math.pow(h2(i, 1), 0.9) * (H - WL - 4), k = (y - WL) / (H - WL);
          const x = 1180 + (h2(i, 2) - 0.5) * (60 + 260 * k) + 8 * Math.sin(lt * 1.3 + i);
          const fl = 0.5 + 0.5 * Math.sin(lt * (1.1 + h2(i, 3) * 1.6) + i * 1.7);
          g.globalAlpha = moon * (0.35 + 0.45 * fl) * (0.92 + 0.12 * beat);
          const w = 4 + k * 14 * (0.5 + h2(i, 4));
          g.drawImage(dot, x - w, y - 1.2, w * 2, 2.4);
        }
      }
      g.restore();
    }
    const LOTUS_BOX = [0, 340, 520, 260];
    // 远处水面上的几片荷叶（夏）
    function buildLotus(g) {
      const R = rng(33);
      for (let i = 0; i < 9; i++) {
        const X = -6.2 + R() * 3.4, D = 6 + R() * 5, Y = 0.04;
        const q = P(X, Y, D), r = (F * (0.28 + R() * 0.2)) / D;
        g.fillStyle = mix('#111814', '#18211c', R());
        g.beginPath(); g.ellipse(q[0], q[1], r, r * (EY / D) * 1.1, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(60,76,70,0.3)'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(q[0], q[1], r * 0.98, r * (EY / D) * 1.05, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      }
      // 一枝荷苞
      const b = P(-4.6, 0.05, 7.5);
      g.strokeStyle = '#1b2620'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(b[0], b[1]); g.quadraticCurveTo(b[0] + 3, b[1] - 30, b[0] + 1, b[1] - 58); g.stroke();
      g.fillStyle = '#3a2a32';
      g.beginPath(); g.moveTo(b[0] + 1, b[1] - 74); g.quadraticCurveTo(b[0] + 9, b[1] - 62, b[0] + 1, b[1] - 56); g.quadraticCurveTo(b[0] - 7, b[1] - 62, b[0] + 1, b[1] - 74); g.fill();
    }
    XYT.registerShot('c1_guqin', {
      name: '\u66f2\u7ec8\u4eba\u6563', zone: 'top', night: true,
      text: '#f2e8d6', shadow: 'rgba(8,10,18,0.9)', accent: '#e7a6b8', bloom: 0.35,
      draw,
    });
  })();
})();
