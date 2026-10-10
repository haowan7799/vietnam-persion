/* 第三版镜头组 fg4：c1_steps, c1_ridge, c1_guqin */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // ---------- 共用工具 ----------
  // 建缓存时画模糊层（ctx.filter 只在这里用）；临时画布只覆盖逻辑矩形 (bx, by, bw, bh)
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
  function scratch(key, w, h) {
    const S = SS();
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
    const F = 1000, YH = 280, HC = 2.1, CX = 640;
    const proj = (X, Y, Z) => [CX + (F * X) / Z, YH + (F * (HC - Y)) / Z];
    // 路径平面（X 横、Z 纵深）三次贝塞尔，按弧长取点
    const BP = [[0.1, 3.4], [0.75, 11], [-0.9, 20], [-6.3, 31.5]];
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
      const fl = [[0.7, 8, 0.66], [8.4, 9, 0.6], [16.6, 11, 0.55]];
      let y = 0;
      for (const [s0, n, run] of fl) for (let i = 0; i < n; i++) { STEPS.push({ s: s0 + i * run, y0: y, y1: y + RISE }); y += RISE; }
    }
    const YTOP = STEPS[STEPS.length - 1].y1;
    const S_ARCH = L - 1.2;
    const width = (s) => lerp(2.5, 1.75, smooth(s / L));
    // 某弧长处的阶面高度
    const yAt = (s) => { let y = 0; for (const st of STEPS) if (s >= st.s) y = st.y1; return y; };
    // 某纵深处的地面高度（取同纵深路面）
    const ZS = []; for (let i = 0; i <= 200; i++) { const s = (i / 200) * L; ZS.push([at(s).Z, yAt(s)]); }
    const groundAt = (Z) => {
      if (Z <= ZS[0][0]) return 0;
      for (let i = 1; i < ZS.length; i++) if (ZS[i][0] >= Z) return ZS[i][1];
      return YTOP;
    };
    const edge = (s, side, y) => { const p = at(s), w = width(s) * 0.5; return proj(p.X + side * p.tz * w, y, p.Z - side * p.tx * w); };
    // 阶面（踏面）：从本级踢面到下一级踢面之间的条带
    const TREADS = [];
    {
      const bounds = [0].concat(STEPS.map((s) => s.s), [L + 2]);
      for (let i = 0; i < bounds.length - 1; i++) {
        const s0 = bounds[i], s1 = Math.min(bounds[i + 1], L + 2), y = i === 0 ? 0 : STEPS[i - 1].y1;
        const n = Math.max(1, Math.ceil((s1 - s0) / 0.3));
        const Lp = [], Rp = [];
        for (let k = 0; k <= n; k++) { const s = s0 + ((s1 - s0) * k) / n; Lp.push(edge(s, -1, y)); Rp.push(edge(s, 1, y)); }
        TREADS.push({ i, s0, s1, y, Lp, Rp, vis: y < HC - 0.02 });
      }
    }
    const H_SKY = '#eef2d8', HAZE = '#dfe8c8', SUN = '#fff1c4';
    const hazeK = (Z) => 1 - Math.exp(-Math.max(0, Z - 3) / 26);
    // 浅凹：阶面中间偏一点，被踩得光滑发暗
    const hollowOf = (tr) => {
      const sm = tr.s0 + Math.min(0.42, (tr.s1 - tr.s0) * 0.5);
      const p = at(sm), off = (h2(tr.i, 5) - 0.5) * 0.25;
      return { s: sm, X: p.X + p.tz * off, Z: p.Z - p.tx * off, y: tr.y, rw: 0.38 * width(sm) / 2.5, rd: Math.min(0.2, (tr.s1 - tr.s0) * 0.32) };
    };
    // 一级级反光的四级台阶（由近到远）
    const GLINT_STEPS = [2, 4, 6, 8];
    // 牌坊
    const ARCH = (() => { const p = at(S_ARCH); return { p, y: yAt(S_ARCH), base: proj(p.X, yAt(S_ARCH), p.Z), k: F / p.Z }; })();
    // 石碑（路右侧）
    const STELE = (() => { const Z = 8.6, X = 1.95, y = groundAt(Z) + 0.05; const b = proj(X, y, Z); return { X, Z, y, b, k: F / Z }; })();
    // 树干（世界坐标）：[X, Z, 粗细]
    const TREES = [[-2.6, 5.6, 0.75], [-4.4, 9.5, 0.95], [-2.9, 14.5, 0.6], [-6.8, 15.5, 1.1], [-5.2, 21, 0.7], [-10.5, 24, 1.0], [-3.6, 27, 0.5],
      [3.0, 12.5, 0.85], [4.6, 18, 1.0], [2.0, 23.5, 0.55], [5.5, 27, 0.8], [0.9, 30, 0.45], [-9.5, 33, 0.6], [8.5, 22, 1.1], [3.4, 34, 0.5]];

    // 远景：林间高处的亮雾与远树
    function buildFar(g) {
      const sk = g.createLinearGradient(0, 0, 0, H);
      sk.addColorStop(0, '#cfdcae'); sk.addColorStop(0.35, H_SKY); sk.addColorStop(0.6, '#d6e2b8'); sk.addColorStop(1, '#9fb886');
      g.fillStyle = sk; g.fillRect(0, 0, W, H);
      // 牌坊后面的亮处
      const ax = ARCH.base[0], ay = ARCH.base[1] - 40;
      let gr = g.createRadialGradient(ax, ay, 10, ax, ay, 520);
      gr.addColorStop(0, rgba('#fffbe6', 0.95)); gr.addColorStop(0.25, rgba('#f8f4d4', 0.6)); gr.addColorStop(0.6, rgba('#e8efcc', 0.2)); gr.addColorStop(1, rgba('#e8efcc', 0));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // 远树：很淡的竖影，越远越淡
      const R = rng(71);
      blurBox(g, -40, -40, W + 80, H + 80, 3, (tg) => {
        for (let i = 0; i < 46; i++) {
          const x = R() * W, wd = 6 + R() * 16, d = 0.25 + R() * 0.75;
          const near = Math.abs(x - ax) / 640;
          tg.fillStyle = rgba(mix('#c3d2a4', '#8fa67c', d * 0.6), (0.18 + 0.35 * d) * (0.35 + 0.65 * clamp(near * 1.4)));
          tg.beginPath(); tg.moveTo(x - wd / 2, -20); tg.lineTo(x + wd / 2, -20); tg.lineTo(x + wd * 0.62, 330); tg.lineTo(x - wd * 0.62, 330); tg.closePath(); tg.fill();
        }
        // 远处树冠团
        for (let i = 0; i < 60; i++) {
          const x = R() * W, y = R() * 120 - 20, r = 40 + R() * 90;
          tg.fillStyle = rgba('#a9bd8c', 0.1 + R() * 0.12);
          tg.beginPath(); tg.ellipse(x, y, r, r * 0.6, 0, 0, TAU); tg.fill();
        }
      });
    }

    // 主层：山坡、石阶、苔碑、牌坊、树干
    function trunk(g, X, Z, wd, seed) {
      const yb = proj(X, groundAt(Z), Z), k = F / Z, w = wd * k;
      const hz = hazeK(Z);
      const base = mix(mix('#3b3a2e', '#58614a', h2(seed, 1) * 0.5), HAZE, hz * 0.9);
      const lit = mix('#a49a6e', HAZE, hz * 0.7);
      const x = yb[0], y = yb[1];
      const top = -30;
      g.save();
      // 树干轮廓：根部外张、往上微收
      g.beginPath();
      g.moveTo(x - w * 0.72, y + w * 0.06);
      g.quadraticCurveTo(x - w * 0.5, y - w * 0.25, x - w * 0.47, y - w * 0.8);
      g.lineTo(x - w * 0.4 + (h2(seed, 2) - 0.5) * w * 0.3, top);
      g.lineTo(x + w * 0.4 + (h2(seed, 3) - 0.5) * w * 0.3, top);
      g.lineTo(x + w * 0.47, y - w * 0.8);
      g.quadraticCurveTo(x + w * 0.5, y - w * 0.25, x + w * 0.75, y + w * 0.06);
      g.closePath();
      const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      gr.addColorStop(0, lit); gr.addColorStop(0.18, mix(base, lit, 0.35)); gr.addColorStop(0.55, base); gr.addColorStop(1, mix(base, '#1c2018', 0.35 * (1 - hz)));
      g.fillStyle = gr; g.fill();
      g.clip();
      // 树皮竖纹
      const R = rng(seed * 13 + 1);
      g.lineCap = 'round';
      for (let i = 0; i < 9 + w / 6; i++) {
        const xx = x + (R() - 0.5) * w * 0.9;
        g.strokeStyle = rgba(R() < 0.5 ? '#1e2219' : '#b7ae86', (0.08 + R() * 0.1) * (1 - hz * 0.7));
        g.lineWidth = 0.6 + R() * Math.max(1, w / 30);
        g.beginPath(); g.moveTo(xx, y); g.bezierCurveTo(xx + (R() - 0.5) * 8, y * 0.6, xx + (R() - 0.5) * 8, y * 0.3, xx + (R() - 0.5) * 10, top); g.stroke();
      }
      // 苔
      g.fillStyle = rgba(mix('#5e8040', HAZE, hz * 0.8), 0.35);
      g.beginPath(); g.ellipse(x - w * 0.2, y - w * 0.35, w * 0.45, w * 0.5, 0, 0, TAU); g.fill();
      g.restore();
    }
    function buildMain(g) {
      // 山坡地面
      g.save();
      const crest = [[-40, 330], [120, 286], [260, 250], [380, 228], [470, 222], [560, 228], [700, 246], [860, 262], [1040, 280], [1320, 300]];
      g.beginPath(); g.moveTo(-40, H + 40);
      crest.forEach((p) => g.lineTo(p[0], p[1]));
      g.lineTo(1320, H + 40); g.closePath();
      const gg = g.createLinearGradient(0, 220, 0, H);
      gg.addColorStop(0, '#b9c99a'); gg.addColorStop(0.12, '#8ea472'); gg.addColorStop(0.4, '#5d7a48'); gg.addColorStop(1, '#2f4128');
      g.fillStyle = gg; g.fill();
      g.clip();
      // 地面上的斑驳：苔、落叶、暗处
      const R = rng(9);
      for (let i = 0; i < 520; i++) {
        const y = 230 + Math.pow(R(), 0.8) * 520, x = R() * W;
        const sz = (y - 200) / 500;
        g.fillStyle = rgba(R() < 0.55 ? '#2a3a22' : (R() < 0.5 ? '#86a25e' : '#a3a46c'), 0.05 + R() * 0.12);
        g.beginPath(); g.ellipse(x, y, 6 + sz * 40 * R(), 2 + sz * 10 * R(), 0, 0, TAU); g.fill();
      }
      g.restore();
      // 远处树干（在石阶之前画，近处树干在石阶之后补）
      const trees = TREES.slice().sort((a, b) => b[1] - a[1]);
      for (const t of trees) if (t[1] > 16) trunk(g, t[0], t[1], t[2], (t[0] * 10) | 0);
      // 牌坊（台阶顶上，逆光）
      drawArch(g);
      // 石阶：由远到近
      for (let i = TREADS.length - 1; i >= 0; i--) {
        const tr = TREADS[i];
        const Zm = at((tr.s0 + tr.s1) / 2).Z, hz = hazeK(Zm);
        if (tr.vis) {
          const pts = tr.Lp.concat(tr.Rp.slice().reverse());
          poly(g, pts);
          const ya = tr.Lp[tr.Lp.length - 1][1], yb2 = tr.Lp[0][1];
          const gr = g.createLinearGradient(0, ya, 0, yb2);
          gr.addColorStop(0, mix('#b7b394', HAZE, hz * 0.85)); gr.addColorStop(1, mix('#a8a586', HAZE, hz * 0.8));
          g.fillStyle = gr; g.fill();
          // 阶面纹理：石缝、苔斑
          g.save(); poly(g, pts); g.clip();
          const R = rng(100 + i);
          const sc = F / Zm;
          for (let k = 0; k < 10; k++) {
            const u = R(), sd = R() < 0.5 ? -1 : 1;
            const s = lerp(tr.s0, tr.s1, R());
            const p = edge(s, sd, tr.y), q = edge(s, 0, tr.y);
            const px = lerp(p[0], q[0], Math.pow(u, 2.2) * 0.9), py = lerp(p[1], q[1], u * 0.9);
            g.fillStyle = rgba(mix('#61804a', HAZE, hz * 0.8), 0.25 + R() * 0.25);
            g.beginPath(); g.ellipse(px, py, (0.05 + R() * 0.16) * sc, (0.02 + R() * 0.04) * sc, 0, 0, TAU); g.fill();
          }
          // 石板接缝（纵向）
          g.strokeStyle = rgba('#5c5a48', 0.25 * (1 - hz));
          g.lineWidth = Math.max(0.6, sc * 0.012);
          const nseam = 2 + ((h2(i, 3) * 2) | 0);
          for (let k = 1; k <= nseam; k++) {
            const f = k / (nseam + 1) + (h2(i, k) - 0.5) * 0.12;
            const a0 = tr.Lp[0], b0 = tr.Rp[0], a1 = tr.Lp[tr.Lp.length - 1], b1 = tr.Rp[tr.Rp.length - 1];
            if (tr.s1 - tr.s0 > 1.2) continue;
            g.beginPath(); g.moveTo(lerp(a0[0], b0[0], f), lerp(a0[1], b0[1], f)); g.lineTo(lerp(a1[0], b1[0], f), lerp(a1[1], b1[1], f)); g.stroke();
          }
          // 浅凹：中间光滑、略暗，远侧内壁一道亮
          if (tr.s1 - tr.s0 < 1.3 && i > 0) {
            const ho = hollowOf(tr);
            const c0 = proj(ho.X, ho.y, ho.Z), k = F / ho.Z;
            const rx = ho.rw * k, ry = Math.max(1, ho.rd * k * ((HC - ho.y) / ho.Z));
            const hg = g.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], rx);
            hg.addColorStop(0, rgba('#6e6c56', 0.42 * (1 - hz * 0.8))); hg.addColorStop(0.6, rgba('#7a7860', 0.25 * (1 - hz * 0.8))); hg.addColorStop(1, rgba('#7a7860', 0));
            g.fillStyle = hg;
            g.save(); g.translate(c0[0], c0[1]); g.scale(1, ry / rx); g.translate(-c0[0], -c0[1]);
            g.beginPath(); g.arc(c0[0], c0[1], rx, 0, TAU); g.fill();
            g.restore();
            g.strokeStyle = rgba('#e6e2c4', 0.35 * (1 - hz * 0.7));
            g.lineWidth = Math.max(0.7, ry * 0.25);
            g.beginPath(); g.ellipse(c0[0], c0[1] + ry * 0.1, rx * 0.72, ry * 0.75, 0, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
          }
          g.restore();
          // 阶沿：磨圆的前缘一道淡亮
          g.strokeStyle = rgba('#ece6c8', 0.5 * (1 - hz * 0.6));
          g.lineWidth = Math.max(0.6, (F / Zm) * 0.012);
          g.beginPath(); g.moveTo(tr.Lp[0][0], tr.Lp[0][1]); g.lineTo(tr.Rp[0][0], tr.Rp[0][1]); g.stroke();
        }
        // 本级踢面（踏面前缘下方的竖面，背光）
        if (i > 0) {
          const st = STEPS[i - 1];
          const a = edge(st.s, -1, st.y1), b = edge(st.s, 1, st.y1), c2 = edge(st.s, 1, st.y0), d = edge(st.s, -1, st.y0);
          poly(g, [a, b, c2, d]);
          g.fillStyle = mix(mix('#5a5e4a', '#4a5240', h2(i, 9)), HAZE, hz * 0.85); g.fill();
          // 踢面顶缘中间被踩得下凹的弧
          g.strokeStyle = rgba('#2a2e22', 0.35 * (1 - hz));
          g.lineWidth = Math.max(0.5, (F / at(st.s).Z) * 0.01);
          g.beginPath(); g.moveTo(d[0], d[1]); g.lineTo(c2[0], c2[1]); g.stroke();
        }
      }
      // 阶缝与两侧的草、蕨（沿阶边）
      edgeGrowth(g);
      // 石碑
      drawStele(g, 0);
      // 近处树干
      for (const t of trees) if (t[1] <= 16) trunk(g, t[0], t[1], t[2], (t[0] * 10) | 0);
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
    function fern(g, x, y, s, ang, col, seed) {
      const R = rng(seed);
      g.save(); g.translate(x, y); g.rotate(ang);
      g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
      g.lineWidth = Math.max(0.6, s * 0.02);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.15, -s * 0.5, s * 0.45, -s * 0.85); g.stroke();
      for (let i = 1; i < 14; i++) {
        const u = i / 14, px = s * (0.15 * 2 * u * (1 - u) + 0.45 * u * u), py = -s * (0.5 * 2 * u * (1 - u) + 0.85 * u * u);
        const ln = s * 0.22 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.8 + R() * 0.3);
        for (const sd of [-1, 1]) {
          g.beginPath(); g.ellipse(px + sd * ln * 0.45, py + ln * 0.12, ln * 0.5, ln * 0.13, sd * 0.35 - 0.2, 0, TAU); g.fill();
        }
      }
      g.restore();
    }
    function edgeGrowth(g) {
      // 两侧阶边的草、蕨：按纵深由远到近
      const items = [];
      for (let s = 0.3; s < L - 0.5; s += 0.42) for (const sd of [-1, 1]) items.push({ s: s + h2(s * 10, sd + 3) * 0.3, sd });
      for (const st of STEPS) if (st.y1 < HC + 0.3) items.push({ s: st.s + 0.02, sd: 0, joint: true });
      items.sort((a, b) => at(b.s).Z - at(a.s).Z);
      for (const it of items) {
        const p = at(it.s), Z = p.Z, k = F / Z, hz = hazeK(Z);
        const y = yAt(it.s + 0.01);
        const col = mix(h2(it.s * 31, 2) < 0.5 ? '#4f7a3c' : '#6d8f44', HAZE, hz * 0.85);
        if (it.joint) {
          // 阶缝里的几丛小草：靠近两端
          for (const f of [-0.42, 0.38]) {
            const q = proj(p.X + p.tz * width(it.s) * 0.5 * f * 2 * 0.5 + p.tz * f * width(it.s) * 0.5, y, Z - p.tx * f * width(it.s));
            if (h2(it.s * 7, f * 10) < 0.55) grassTuft(g, q[0], q[1], 0.16 * k, rgba(col, 0.9), 0.4, (it.s * 100) | 0);
          }
          continue;
        }
        const w = width(it.s) * 0.5 + 0.05 + h2(it.s * 3, it.sd) * 0.18;
        const q = proj(p.X + it.sd * p.tz * w, y + 0.02, Z - it.sd * p.tx * w);
        if (h2(it.s * 13, it.sd) < 0.5) fern(g, q[0], q[1], (0.45 + h2(it.s, 9) * 0.3) * k, it.sd * (0.5 + h2(it.s, 4) * 0.5) - 0.1, rgba(col, 0.92), (it.s * 37) | 0);
        else grassTuft(g, q[0], q[1], 0.3 * k, rgba(col, 0.9), 0.4, (it.s * 53) | 0);
      }
    }
    function drawArch(g) {
      const { p, y, k } = ARCH;
      const half = 1.15, ph = 2.45, pw = 0.28, top = 3.25;
      const P = (lx, ly) => proj(p.X + p.tz * lx, y + ly, p.Z - p.tx * lx);
      const col = '#5d6450', rim = '#f3ecc8';
      g.save();
      // 两根石柱
      for (const sd of [-1, 1]) {
        const x0 = sd * half, x1 = sd * (half + pw);
        poly(g, [P(Math.min(x0, x1), 0), P(Math.max(x0, x1), 0), P(Math.max(x0, x1), top - 0.4), P(Math.min(x0, x1), top - 0.4)]);
        g.fillStyle = col; g.fill();
        // 迎光的左缘
        const e = P(Math.min(x0, x1), 0), e2 = P(Math.min(x0, x1), top - 0.4);
        g.strokeStyle = rgba(rim, 0.55); g.lineWidth = 1;
        g.beginPath(); g.moveTo(e[0] + 0.5, e[1]); g.lineTo(e2[0] + 0.5, e2[1]); g.stroke();
        // 柱础
        poly(g, [P(Math.min(x0, x1) - 0.06, 0), P(Math.max(x0, x1) + 0.06, 0), P(Math.max(x0, x1) + 0.06, 0.25), P(Math.min(x0, x1) - 0.06, 0.25)]);
        g.fillStyle = mix(col, '#2e3428', 0.25); g.fill();
      }
      // 额枋与顶盖
      poly(g, [P(-half - pw - 0.1, ph), P(half + pw + 0.1, ph), P(half + pw + 0.1, ph + 0.32), P(-half - pw - 0.1, ph + 0.32)]);
      g.fillStyle = col; g.fill();
      poly(g, [P(-half - pw - 0.05, ph + 0.42), P(half + pw + 0.05, ph + 0.42), P(half + pw + 0.05, top - 0.12), P(-half - pw - 0.05, top - 0.12)]);
      g.fillStyle = mix(col, '#40463a', 0.3); g.fill();
      // 顶上石檐，两端微翘
      const a = P(-half - pw - 0.42, top - 0.14), b = P(half + pw + 0.42, top - 0.14), c2 = P(half + pw + 0.2, top + 0.12), d = P(-half - pw - 0.2, top + 0.12);
      g.beginPath(); g.moveTo(a[0], a[1] - 2); g.quadraticCurveTo((a[0] + b[0]) / 2, a[1] + 2, b[0], b[1] - 2);
      g.lineTo(c2[0], c2[1]); g.quadraticCurveTo((c2[0] + d[0]) / 2, c2[1] - 2, d[0], d[1]); g.closePath();
      g.fillStyle = mix(col, '#3a4034', 0.4); g.fill();
      g.strokeStyle = rgba(rim, 0.5); g.lineWidth = 1;
      g.beginPath(); g.moveTo(d[0], d[1]); g.quadraticCurveTo((c2[0] + d[0]) / 2, c2[1] - 2, c2[0], c2[1]); g.stroke();
      // 柱上的藤蔓与苔
      g.fillStyle = rgba('#5f7d42', 0.55);
      for (let i = 0; i < 16; i++) {
        const q = P(-half - pw * 0.5 + (h2(i, 1) < 0.5 ? 0 : 2 * half + pw), 0.3 + h2(i, 2) * 2.4);
        g.beginPath(); g.ellipse(q[0] + (h2(i, 3) - 0.5) * 4, q[1], 1.5 + h2(i, 4) * 2.5, 1 + h2(i, 5) * 1.5, 0, 0, TAU); g.fill();
      }
      g.restore();
    }
    // 石碑：lit = 0 时刻痕几乎看不见；lit = 1 是光斑照亮时的样子（斜光显出浅浅的刻槽）
    function steleShape(g, b, k) {
      const w = 0.56 * k, h = 1.32 * k, x = b[0], y = b[1];
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.lineTo(x - w / 2 + 0.01 * k, y - h + w * 0.42);
      g.quadraticCurveTo(x - w / 2, y - h, x, y - h - 0.02 * k);
      g.quadraticCurveTo(x + w / 2, y - h, x + w / 2 - 0.01 * k, y - h + w * 0.42);
      g.lineTo(x + w / 2, y);
      g.closePath();
    }
    function steleGlyphs(g, b, k, lit) {
      // 抽象刻痕：三列被风雨磨平的短笔触
      const w = 0.56 * k, h = 1.32 * k, x = b[0], y = b[1];
      const R = rng(44);
      for (let col = 0; col < 3; col++) {
        const cx = x - w * 0.24 + col * w * 0.24;
        let yy = y - h + w * 0.55;
        while (yy < y - 0.18 * k) {
          const len = (0.03 + R() * 0.06) * k, ang = [0, Math.PI / 2, 0.6, -0.6][(R() * 4) | 0];
          const ox = (R() - 0.5) * w * 0.12;
          const x0 = cx + ox - Math.cos(ang) * len / 2, y0 = yy - Math.sin(ang) * len / 2;
          const x1 = cx + ox + Math.cos(ang) * len / 2, y1 = yy + Math.sin(ang) * len / 2;
          const wear = R();
          if (wear > 0.25) {
            g.lineCap = 'round';
            g.strokeStyle = rgba('#2b3026', (lit ? 0.5 : 0.12) * wear);
            g.lineWidth = Math.max(0.6, 0.012 * k);
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            if (lit) {
              g.strokeStyle = rgba('#fff4d0', 0.55 * wear);
              g.lineWidth = Math.max(0.5, 0.007 * k);
              g.beginPath(); g.moveTo(x0 + 0.006 * k, y0 + 0.006 * k); g.lineTo(x1 + 0.006 * k, y1 + 0.006 * k); g.stroke();
            }
          }
          yy += (0.07 + R() * 0.04) * k;
        }
      }
    }
    function drawStele(g) {
      const { b, k } = STELE;
      // 碑座（半埋）
      g.fillStyle = '#4a4e3e';
      g.beginPath(); g.ellipse(b[0], b[1] + 0.02 * k, 0.5 * k, 0.07 * k, 0, 0, TAU); g.fill();
      g.fillStyle = '#5c604c';
      g.fillRect(b[0] - 0.4 * k, b[1] - 0.12 * k, 0.8 * k, 0.14 * k);
      const bb = [b[0], b[1] - 0.12 * k];
      g.save();
      g.translate(bb[0], bb[1]); g.rotate(-0.025); g.translate(-bb[0], -bb[1]);
      // 侧面厚度（左侧迎光）
      steleShape(g, [bb[0] - 0.05 * k, bb[1]], k);
      g.fillStyle = '#9a9876'; g.fill();
      steleShape(g, bb, k);
      const gr = g.createLinearGradient(bb[0] - 0.3 * k, 0, bb[0] + 0.3 * k, 0);
      gr.addColorStop(0, '#7d7f66'); gr.addColorStop(1, '#5e6350');
      g.fillStyle = gr; g.fill();
      g.save(); steleShape(g, bb, k); g.clip();
      // 苔与地衣
      const R = rng(55);
      for (let i = 0; i < 60; i++) {
        const top = R() < 0.6;
        const x = bb[0] + (R() - 0.5) * 0.6 * k, y = top ? bb[1] - (1.1 + R() * 0.3) * k : bb[1] - R() * 1.3 * k;
        g.fillStyle = rgba(R() < 0.7 ? '#58783c' : '#a3a37a', 0.2 + R() * 0.35);
        g.beginPath(); g.ellipse(x, y, (0.02 + R() * 0.06) * k, (0.015 + R() * 0.04) * k, R() * 3, 0, TAU); g.fill();
      }
      // 碑框（磨损的阴刻边线）
      g.strokeStyle = rgba('#3b4032', 0.25); g.lineWidth = Math.max(0.6, 0.01 * k);
      g.strokeRect(bb[0] - 0.22 * k, bb[1] - 1.06 * k, 0.44 * k, 0.92 * k);
      steleGlyphs(g, bb, k, false);
      g.restore();
      g.restore();
      // 接触阴影（光从左后上方来，影子落向右前方）
      g.fillStyle = rgba('#1e2a18', 0.3);
      g.beginPath(); g.ellipse(b[0] + 0.25 * k, b[1] + 0.06 * k, 0.55 * k, 0.07 * k, 0.05, 0, TAU); g.fill();
    }
    // 光斑照到石碑时的样子（单独缓存，用椭圆裁切叠上去）
    function buildSteleLit(g) {
      const { b, k } = STELE;
      const bb = [b[0], b[1] - 0.12 * k];
      g.save();
      g.translate(bb[0], bb[1]); g.rotate(-0.025); g.translate(-bb[0], -bb[1]);
      steleShape(g, bb, k);
      g.fillStyle = '#c9c39a'; g.fill();
      g.save(); steleShape(g, bb, k); g.clip();
      const R = rng(55);
      for (let i = 0; i < 60; i++) {
        const top = R() < 0.6;
        const x = bb[0] + (R() - 0.5) * 0.6 * k, y = top ? bb[1] - (1.1 + R() * 0.3) * k : bb[1] - R() * 1.3 * k;
        g.fillStyle = rgba(R() < 0.7 ? '#8fae58' : '#e0dca8', 0.25 + R() * 0.35);
        g.beginPath(); g.ellipse(x, y, (0.02 + R() * 0.06) * k, (0.015 + R() * 0.04) * k, R() * 3, 0, TAU); g.fill();
      }
      g.strokeStyle = rgba('#5c5a40', 0.45); g.lineWidth = Math.max(0.6, 0.01 * k);
      g.strokeRect(bb[0] - 0.22 * k, bb[1] - 1.06 * k, 0.44 * k, 0.92 * k);
      steleGlyphs(g, bb, k, true);
      g.restore();
      g.restore();
    }
    // 阶面遮罩（只在受光的踏面上画光斑）
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
    // 近景：右侧虚化的大树干（歌词区背景）、左下虚化的蕨
    function buildNear(g) {
      blurBox(g, 900, -60, 440, H + 120, 7, (tg) => {
        const x0 = 1028, gr = tg.createLinearGradient(x0, 0, W + 40, 0);
        gr.addColorStop(0, '#3e4632'); gr.addColorStop(0.08, '#2c3424'); gr.addColorStop(0.5, '#1f271b'); gr.addColorStop(1, '#1a2117');
        tg.fillStyle = gr;
        tg.beginPath(); tg.moveTo(x0 + 14, -60); tg.bezierCurveTo(x0 - 6, 200, x0 + 4, 480, x0 - 40, H + 60); tg.lineTo(W + 60, H + 60); tg.lineTo(W + 60, -60); tg.closePath(); tg.fill();
        // 迎光的左缘一线暖光
        tg.strokeStyle = rgba('#b9b07a', 0.45); tg.lineWidth = 5;
        tg.beginPath(); tg.moveTo(x0 + 16, -60); tg.bezierCurveTo(x0 - 4, 200, x0 + 6, 480, x0 - 38, H + 60); tg.stroke();
        // 树皮极淡的竖纹
        const R = rng(81);
        for (let i = 0; i < 30; i++) {
          const x = x0 + 30 + R() * 230;
          tg.strokeStyle = rgba(R() < 0.5 ? '#141a12' : '#3a4430', 0.25); tg.lineWidth = 3 + R() * 6;
          tg.beginPath(); tg.moveTo(x, -60); tg.lineTo(x + (R() - 0.5) * 20, H + 60); tg.stroke();
        }
      });
      blurBox(g, -80, 420, 520, 380, 5, (tg) => {
        for (let i = 0; i < 7; i++) fern(tg, -30 + i * 40 + h2(i, 1) * 30, H + 30, 230 + h2(i, 2) * 120, -0.2 + i * 0.16 + h2(i, 3) * 0.2, i % 2 ? '#22331c' : '#2d4224', 300 + i);
      });
      // 左上角近处的枝叶（虚）
      blurBox(g, -80, -80, 520, 300, 6, (tg) => {
        const R = rng(17);
        tg.strokeStyle = '#2a3520'; tg.lineWidth = 6;
        tg.beginPath(); tg.moveTo(-60, 20); tg.quadraticCurveTo(140, 40, 330, 10); tg.stroke();
        for (let i = 0; i < 46; i++) {
          const u = R(), x = -60 + u * 390, y = 20 + 30 * Math.sin(u * 3) * 0.3 + (R() - 0.3) * 60;
          tg.fillStyle = rgba(R() < 0.5 ? '#2c3d22' : '#3d5a2c', 0.9);
          tg.beginPath(); tg.ellipse(x, y, 18 + R() * 16, 7 + R() * 5, R() * 3, 0, TAU); tg.fill();
        }
      });
    }
    // 光柱（左上方高处的阳光穿过树冠）
    function buildRays(g) {
      blurBox(g, -100, -100, W + 200, H + 200, 14, (tg) => {
        const beams = [[180, 0.18, 70], [330, 0.24, 46], [470, 0.15, 90], [610, 0.12, 40], [760, 0.1, 60]];
        const ang = 1.08; // 光线方向（从左上射向右下）
        for (const [x, a, w] of beams) {
          const dx = Math.cos(ang), dy = Math.sin(ang), len = 900;
          const x0 = x - 260, y0 = -60;
          const gr = tg.createLinearGradient(x0, y0, x0 + dx * len, y0 + dy * len);
          gr.addColorStop(0, rgba(SUN, a)); gr.addColorStop(0.55, rgba(SUN, a * 0.55)); gr.addColorStop(1, rgba(SUN, 0));
          tg.fillStyle = gr;
          const nx = -dy * w / 2, ny = dx * w / 2;
          tg.beginPath(); tg.moveTo(x0 - nx * 0.6, y0 - ny * 0.6); tg.lineTo(x0 + nx * 0.6, y0 + ny * 0.6);
          tg.lineTo(x0 + dx * len + nx * 1.6, y0 + dy * len + ny * 1.6); tg.lineTo(x0 + dx * len - nx * 1.6, y0 + dy * len - ny * 1.6); tg.closePath(); tg.fill();
        }
      });
    }
    // 阶面光斑（世界坐标，随树叶缓慢游移）
    const DAPS = [];
    {
      const R = rng(303);
      for (let i = 0; i < 90; i++) {
        const s = Math.pow(R(), 1.25) * (L - 1.5);
        DAPS.push({ s, off: (R() - 0.5) * 1.6, r: 0.08 + R() * 0.17, ph: R() * TAU, fq: 0.25 + R() * 0.35, amp: 0.03 + R() * 0.05, seed: i });
      }
    }
    function draw(g, c) {
      const lt = c.lt;
      const tPush = charAt(c, 4, 0, FB);
      const z = 1 + 0.06 * smooth((lt - tPush) / 5.0);
      const CXZ = 500, CYZ = 330;
      const S = SS();
      const far = K.cache('fg4steps-far', W, H, 1, buildFar);
      const main = K.cache('fg4steps-main', W, H, 1, buildMain);
      const near = K.cache('fg4steps-near', W, H, 1, buildNear);
      const rays = K.cache('fg4steps-rays', W, H, 0.5, buildRays);
      const zf = 1 + (z - 1) * 0.6, zn = 1 + (z - 1) * 1.45;
      zoomBlit(g, far, zf, CXZ, CYZ);
      g.save();
      g.translate(CXZ - CXZ * z, CYZ - CYZ * z); g.scale(z, z);
      g.drawImage(main, 0, 0, W, H);
      // 光斑：只在踏面上
      const beat = softBeat(c, 0.5);
      g.save();
      g.clip(treadMask());
      g.globalCompositeOperation = 'lighter';
      const dot = softDot('#fff0bf', 0.35);
      for (const d of DAPS) {
        const p = at(d.s);
        const sway = d.amp * Math.sin(TAU * d.fq * lt + d.ph) + 0.5 * d.amp * Math.sin(TAU * d.fq * 1.7 * lt + d.ph * 2);
        const X = p.X + p.tz * (d.off + sway), Z = p.Z - p.tx * (d.off + sway);
        const y = yAt(d.s);
        if (y >= HC - 0.05) continue;
        const q = proj(X, y, Z), k = F / Z;
        // 树叶开合：光斑慢慢亮、慢慢暗
        const vis = smooth((noise1(lt * 0.35 + d.seed * 3.1, d.seed) - 0.25) / 0.5);
        if (vis < 0.02) continue;
        const rx = d.r * k, ry = Math.max(0.6, rx * ((HC - y) / Z) * 1.1);
        g.globalAlpha = vis * (0.32 + 0.06 * beat) * (1 - hazeK(Z) * 0.6);
        g.drawImage(dot, q[0] - rx, q[1] - ry, rx * 2, ry * 2);
      }
      // 浅凹一级级反光：第二句「〔第19句第5–8字〕」逐字
      for (let j = 0; j < GLINT_STEPS.length; j++) {
        const tr = TREADS[GLINT_STEPS[j]];
        if (!tr || !tr.vis) continue;
        const e = pulse(lt - charAt(c, 4 + j, 0, FB), 0.07, 0.85);
        const base = lt > charAt(c, 4 + j, 0, FB) ? 0.12 : 0;
        if (e + base < 0.005) continue;
        const ho = hollowOf(tr), q = proj(ho.X, ho.y, ho.Z), k = F / ho.Z;
        const rx = ho.rw * k * 1.1, ry = Math.max(1, ho.rd * k * ((HC - ho.y) / ho.Z) * 1.2);
        g.globalAlpha = clamp(0.55 * e + base * 0.5);
        g.drawImage(dot, q[0] - rx, q[1] - ry, rx * 2, ry * 2);
        g.globalAlpha = clamp(0.5 * e);
        const sd = softDot('#ffffff', 0.6);
        g.drawImage(sd, q[0] - rx * 0.35, q[1] - ry * 0.55 - ry * 0.2, rx * 0.7, ry * 0.8);
      }
      g.restore();
      // 石碑上的光斑：「没」滑上刻痕，「懂」前移开
      const tIn = charAt(c, 8, 0, FB), tOut = charAt(c, 10, 0, FB);
      const fa = smooth((lt - tIn + 0.05) / 0.4) * (1 - smooth((lt - (tOut - 0.55)) / 0.55));
      if (fa > 0.003) {
        const lit = K.cache('fg4steps-stelelit', W, H, 1, buildSteleLit);
        const { b, k } = STELE;
        const u = clamp((lt - tIn) / (tOut - tIn));
        const cx = b[0] - 0.2 * k + u * 0.22 * k, cy = b[1] - 0.72 * k - u * 0.05 * k;
        const r = 0.2 * k;
        const sc = scratch('fg4steps-fleck', W, H);
        sc.g.save();
        sc.g.drawImage(lit, 0, 0, W, H);
        sc.g.globalCompositeOperation = 'destination-in';
        sc.g.drawImage(softDot('#ffffff', 0.55), cx - r * 1.05, cy - r * 1.25, r * 2.1, r * 2.5);
        sc.g.restore();
        g.globalAlpha = fa;
        g.drawImage(sc.c, 0, 0, W, H);
        g.globalAlpha = 1;
      }
      // 少年：牌坊下静立（背影）
      const ab = ARCH.base, hY = 1.75 * ARCH.k;
      g.fillStyle = rgba('#26301f', 0.35);
      g.beginPath(); g.ellipse(ab[0] + 1, ab[1] + 1.5, hY * 0.2, hY * 0.035, 0, 0, TAU); g.fill();
      XYT.sil.draw(g, 'youth', 'standBack', ab[0], ab[1] + 1, hY, lt + 3, { wind: 0.22, windDir: 1, body: '#262c22', rim: '#fff4d2', rimSide: -1, rimWidth: 1 });
      g.restore();
      // 光柱与浮尘
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = 0.8 + 0.08 * beat + 0.05 * Math.sin(lt * 0.7);
      zoomBlit(g, rays, 1 + (z - 1) * 0.8, CXZ, CYZ);
      g.restore();
      motes(g, c, lt, z);
      zoomBlit(g, near, zn, CXZ, CYZ);
    }
    // 光里的浮尘：缓缓向右下飘，进出画面或淡入淡出
    function motes(g, c, lt, z) {
      const dot = softDot('#fff6d8', 0.5);
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 46; i++) {
        const sp = 6 + h2(i, 1) * 10, life = 7 + h2(i, 2) * 5;
        const tt = lt + h2(i, 3) * life;
        const age = ((tt % life) + life) % life;
        const x0 = 80 + h2(i, 4) * 900, y0 = 60 + h2(i, 5) * 420;
        const x = x0 + age * sp + 6 * Math.sin(age * 0.9 + i), y = y0 + age * sp * 0.35 + 5 * Math.sin(age * 0.7 + i * 2);
        const a = smooth(age / 0.8) * smooth((life - age) / 0.8);
        // 只在光柱里亮
        const inBeam = 0.35 + 0.65 * Math.max(0, Math.sin((x - y * 0.48) / 70 + 1.3));
        const r = 1.2 + h2(i, 6) * 1.8;
        g.globalAlpha = a * inBeam * 0.55;
        g.drawImage(dot, x - r, y - r, r * 2, r * 2);
      }
      g.restore();
    }
    XYT.registerShot('c1_steps', {
      name: '夏山古阶', zone: 'right', night: false,
      text: '#f6eed6', shadow: 'rgba(14,22,12,0.9)', accent: '#f2d58c', bloom: 0.3,
      draw,
    });
  })();
})();
