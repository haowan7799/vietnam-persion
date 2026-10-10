/* 第三版镜头组 ff1：i1_inkdawn, a1_pavilion, b1_bridge */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // 设备分辨率的临时画布：每次使用前清空，不在帧间保留内容
  const scratchMap = new Map();
  function scratch(key, w, h) {
    const S = SS();
    const pw = Math.max(1, Math.round((w || W) * S)), ph = Math.max(1, Math.round((h || H) * S));
    let c = scratchMap.get(key);
    if (!c) { c = document.createElement('canvas'); scratchMap.set(key, c); }
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.setTransform(S, 0, 0, S, 0, 0);
    return { c, g };
  }
  // 在缓存里画模糊层：先画到临时画布，再带滤镜贴回（ctx.filter 只在建缓存时用）
  function blurInto(g, w, h, blur, fn, alpha) {
    const t = document.createElement('canvas');
    const sc = g.getTransform().a;
    t.width = Math.round(w * sc); t.height = Math.round(h * sc);
    const tg = t.getContext('2d'); tg.scale(sc, sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, 0, 0);
    g.restore();
  }
  // 平滑噪声（多层）
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.1; }
    return s / n * 2;
  };
  let fontOK = false;
  const fontReady = () => {
    if (fontOK) return true;
    try { fontOK = !!(document.fonts && document.fonts.check('64px "Ma Shan Zheng"', '逍遥叹')); } catch (e) { fontOK = false; }
    return fontOK;
  };
  // 拍点上的“快起慢落”包络（无节拍信息时为 0）
  const beatEnv = (c, d) => (c.be ? c.be(d) : 0);

  // ============================================================
  // i1_inkdawn 墨晓：一滴墨化开成晨雾山河，片名与朱印
  // ============================================================
  (function () {
    const DROP = [420, 470];
    const WATER = 632;
    const PAPER = '#f1ebdd';
    const BY0 = 350, BH = 340; // 山层所在的横带（y 350–690），缓存与遮罩只覆盖这一段
    // 四层山（远→近）：[峰心 x, 峰顶 y, 左半宽, 右半宽, 形, 肩]
    // 形：0 尖峰（顶略圆）、1 圆顶、2 平脊；肩：[侧(−1左/1右), 位置, 高度, 宽度]，没有为 0
    const LAYERS = [
      { seed: 41, col: '#aab8c2', a: 0.6, depth: 150, rough: 0.45, dots: 0, blur: 2.6, start: 3.9,
        peaks: [[560, 402, 180, 230, 1, [1, 1.0, 0.72, 0.5]], [790, 428, 130, 170, 0, [-1, 0.9, 0.62, 0.42]], [330, 434, 150, 120, 1, 0],
          [118, 454, 140, 160, 0, [1, 0.95, 0.66, 0.45]], [1190, 560, 170, 210, 2, 0]] },
      { seed: 57, col: '#8a99a5', a: 0.68, depth: 150, rough: 0.6, dots: 0.4, blur: 2.0, start: 3.1,
        peaks: [[180, 434, 150, 120, 1, [1, 1.0, 0.6, 0.5]], [622, 462, 110, 160, 0, [1, 0.95, 0.68, 0.4]], [940, 514, 160, 180, 2, 0], [-40, 452, 120, 140, 0, 0]] },
      { seed: 73, col: '#65737f', a: 0.8, depth: 160, rough: 0.8, dots: 0.7, blur: 1.5, start: 2.3,
        peaks: [[60, 472, 130, 110, 1, 0], [292, 458, 96, 128, 0, [1, 0.85, 0.64, 0.38]], [705, 524, 130, 150, 1, [-1, 0.95, 0.66, 0.4]], [975, 582, 130, 170, 2, 0]] },
      { seed: 89, col: '#3c4650', a: 0.94, depth: 165, rough: 1.0, dots: 1, blur: 1.1, start: 1.5,
        peaks: [[170, 524, 125, 105, 1, 0], [-20, 504, 110, 120, 0, 0], [650, 574, 120, 140, 2, 0], [835, 612, 90, 150, 1, 0],
          [420, 440, 128, 180, 0, [1, 0.9, 0.7, 0.46]]] },
    ];
    const EXT = 2.4;
    // 单侧剖面：顶部按“形”压平或磨圆，山腰下凹；p 越大山腰越陡后缓
    const FORM = [
      { flat: 0, c: 0.2, pl: 1.45, pr: 1.9 },
      { flat: 0.12, c: 0.55, pl: 1.7, pr: 1.5 },
      { flat: 0.26, c: 0.34, pl: 1.6, pr: 2.0 },
    ];
    const profSide = (d, F, p) => {
      const dd = Math.max(0, Math.abs(d) - F.flat);
      const u = Math.sqrt(dd * dd + F.c * F.c) / EXT, u0 = F.c / EXT;
      return u >= 1 ? 0 : Math.pow((1 - u) / (1 - u0), p);
    };
    function peakProfile(pk, seed, rough) {
      const [xc, yt, wl, wr, form, sh] = pk;
      const F = FORM[form];
      const x0 = Math.floor(xc - wl * EXT), x1 = Math.ceil(xc + wr * EXT);
      const r = rng(seed);
      // 平脊略向一侧倾斜，免得像切平的台
      const tilt = form === 2 ? (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.06) : 0;
      const span = WATER - yt;
      const ys = [];
      for (let x = x0; x <= x1; x += 3) {
        const d = (x - xc) / (x < xc ? wl : wr);
        let f = profSide(d, F, d < 0 ? F.pl : F.pr);
        if (form === 2 && Math.abs(d) < F.flat + 0.3) f *= 1 + tilt * d;
        // 肩：山腰上一段圆缓的次峰，使左右不对称
        if (sh) {
          const [side, pos, hh, ww] = sh;
          if (d * side > 0) f = Math.max(f, hh * profSide((d - side * pos) / ww, FORM[1], 1.6));
        }
        f *= clamp((EXT - Math.abs(d)) / 0.6);
        const n = rough * (6 * fbm(x / 60, seed, 3) + 2.2 * fbm(x / 13, seed + 5, 2));
        const y = WATER - span * f + n * Math.min(1, f * 3) * (1 - Math.exp(-d * d * 16));
        ys.push(Math.min(WATER, y));
      }
      return { x0, x1, ys, xc, yt };
    }
    function tracePeak(g, P, close) {
      g.beginPath();
      g.moveTo(P.x0, P.ys[0]);
      for (let i = 1; i < P.ys.length; i++) g.lineTo(P.x0 + i * 3, P.ys[i]);
      if (close) { g.lineTo(P.x1, WATER + 2); g.lineTo(P.x0, WATER + 2); g.closePath(); }
    }
    // 建缓存用：只在一块区域里起临时画布，模糊后按指定合成方式贴回（与缓存像素严格对齐）
    function regionInto(g, x, y, w, h, blur, op, fn) {
      const m = g.getTransform(), sc = m.a, pad = Math.ceil(blur * sc * 3 + 2);
      const dx = Math.floor(m.e + x * sc) - pad, dy = Math.floor(m.f + y * sc) - pad;
      const t = document.createElement('canvas');
      t.width = Math.ceil(w * sc) + pad * 2 + 2; t.height = Math.ceil(h * sc) + pad * 2 + 2;
      const tg = t.getContext('2d');
      tg.setTransform(sc, 0, 0, sc, m.e - dx, m.f - dy);
      fn(tg);
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = op || 'source-over';
      if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
      g.drawImage(t, dx, dy);
      g.restore();
    }
    // 一座山的遮挡：逐列从该处山脊往下——上部实、向江面渐虚、山脚入雾全透；
    // 侧坡低处山脊已淡入雾，遮挡跟着减弱，免得远处的线断在看不见的边上
    function occFill(tg, P, amp) {
      const yb = WATER - 14, n = P.ys.length;
      tg.save(); tracePeak(tg, P, true); tg.clip();
      for (let i = 0; i < n; i++) {
        const fall = (P.ys[i] - P.yt) / (WATER - P.yt);
        const h = amp * clamp((0.74 - fall) / 0.22);
        const yr = Math.min(P.ys[i], P.ys[Math.max(0, i - 1)], P.ys[Math.min(n - 1, i + 1)]) - 2;
        if (h <= 0.003 || yr >= yb - 2) continue;
        const gr = tg.createLinearGradient(0, yr, 0, yb);
        gr.addColorStop(0, `rgba(0,0,0,${h.toFixed(3)})`);
        gr.addColorStop(0.55, `rgba(0,0,0,${h.toFixed(3)})`);
        gr.addColorStop(0.8, `rgba(0,0,0,${(h * 0.5).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        tg.fillStyle = gr; tg.fillRect(P.x0 + i * 3 - 1.6, yr, 3.2, yb - yr);
      }
      tg.restore();
    }
    function buildLayer(L, li) {
      return K.cache('ff1_i1_layer' + li, W, BH, 1, (g) => {
        g.translate(0, -BY0);
        const profs = L.peaks.map((pk, k) => peakProfile(pk, L.seed + k * 31, L.rough));
        const fadeEnd = (P) => Math.min(P.yt + L.depth, WATER - 14);
        const rd = rng(L.seed * 7 + 3);
        // 逐座画，数组后面的在前；每座先擦去同层被它挡住的部分、再垫纸色挡住更远层，然后才上墨
        profs.forEach((P, k) => {
          const ye = fadeEnd(P);
          const bx = P.x0 - 6, bw = P.x1 - P.x0 + 12, by = P.yt - 18, bh = WATER + 6 - by;
          const outline = (tg) => { tracePeak(tg, P, true); };
          // a) 擦去同层已画、被这座山挡住的部分
          regionInto(g, bx, by, bw, bh, L.blur, 'destination-out', (tg) => {
            occFill(tg, P, 1);
          });
          // b) 纸色垫底：取同一张宣纸贴图，遮住更远层的山脊，山脚的雾仍透
          regionInto(g, bx, by, bw, bh, L.blur, 'source-over', (tg) => {
            occFill(tg, P, 1);
            tg.globalCompositeOperation = 'source-in';
            tg.drawImage(paperTex(), 0, 0, W, H);
          });
          // c) 晕染体块：峰头浓、山脚淡入雾
          regionInto(g, bx, by, bw, bh, L.blur, 'source-over', (tg) => {
            const gr = tg.createLinearGradient(0, P.yt - 3, 0, ye);
            gr.addColorStop(0, rgba(L.col, L.a));
            gr.addColorStop(0.16, rgba(L.col, L.a * 0.8));
            gr.addColorStop(0.5, rgba(L.col, L.a * 0.3));
            gr.addColorStop(1, rgba(L.col, 0));
            tg.fillStyle = gr; outline(tg); tg.fill();
          });
          // d) 米点：沿山脊横向的淡墨点，表现林木与湿气
          if (L.dots > 0) {
            regionInto(g, bx, by, bw, bh, 0.7 + (3 - li) * 0.3, 'source-over', (tg) => {
              const r = rd;
              tg.save(); outline(tg); tg.clip();
              const n = Math.round((P.x1 - P.x0) * 0.55 * L.dots);
              for (let i = 0; i < n; i++) {
                const ii = Math.floor(r() * P.ys.length);
                const x = P.x0 + ii * 3 + (r() - 0.5) * 3;
                const dy = Math.pow(r(), 1.8) * 46;
                const y = P.ys[ii] + 2 + dy;
                const fall = (y - P.yt) / (WATER - P.yt);
                if (fall > 0.55) continue;
                const a = (0.1 + r() * 0.22) * L.dots * (1 - dy / 56) * (1 - fall * 1.3);
                if (a <= 0.01) continue;
                tg.fillStyle = rgba(li === 3 ? '#262d34' : L.col, a);
                tg.beginPath(); tg.ellipse(x, y, 2 + r() * 4 * (0.6 + li * 0.15), 1 + r() * 1.6, (r() - 0.5) * 0.3, 0, TAU); tg.fill();
              }
              tg.restore();
            });
          }
          // e) 山脊勾线：浓淡粗细起伏，偶有飞白
          regionInto(g, bx, by, bw, bh, 0.3 + (3 - li) * 0.35, 'source-over', (tg) => {
            tg.lineCap = 'round';
            const lw = 0.7 + L.dots * 1.4;
            for (let i = 1; i < P.ys.length; i++) {
              const x = P.x0 + i * 3;
              const fall = (P.ys[i] - P.yt) / (WATER - P.yt);
              if (fall > 0.7) continue;
              const brk = noise1(x / 12, L.seed + k * 3);
              if (brk < 0.24) continue;
              const a = (0.22 + 0.6 * L.a) * (1 - fall * 1.3) * clamp((brk - 0.24) * 4);
              if (a <= 0.01) continue;
              tg.strokeStyle = rgba(li === 3 ? '#1e242a' : mix(L.col, '#2a3038', 0.35), a);
              tg.lineWidth = lw * (0.55 + 0.9 * noise1(x / 25, L.seed + 9));
              tg.beginPath(); tg.moveTo(x - 3, P.ys[i - 1]); tg.lineTo(x, P.ys[i]); tg.stroke();
            }
            // 近山主峰肩上几株小树（远看只是一簇点与短线）
            if (li === 3 && k === profs.length - 1) {
              const r = rng(907);
              const spots = [[500, 3], [530, 2], [556, 3], [300, 2], [328, 2]];
              spots.forEach(([sx, n]) => {
                for (let j = 0; j < n; j++) {
                  const x = sx + j * 7 + (r() - 0.5) * 3;
                  const ii = Math.round((x - P.x0) / 3);
                  if (ii < 0 || ii >= P.ys.length) continue;
                  const y = P.ys[ii] + 1.5, h = 9 + r() * 6;
                  tg.strokeStyle = 'rgba(30,36,42,0.75)'; tg.lineWidth = 0.9;
                  tg.beginPath(); tg.moveTo(x, y); tg.lineTo(x + 0.6, y - h); tg.stroke();
                  for (let q = 0; q < 4; q++) {
                    const yy = y - h * (0.35 + q * 0.17), w = (4.2 - q) * 1.1;
                    tg.fillStyle = `rgba(28,34,40,${0.55 + r() * 0.2})`;
                    tg.beginPath(); tg.ellipse(x + 0.4, yy, w, 1.4, 0, 0, TAU); tg.fill();
                  }
                }
              });
            }
          });
        });
      });
    }
    function paperTex() {
      return K.cache('ff1_i1_paper', W, H, 0.5, (g) => {
        g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
        const r = rng(13);
        for (let i = 0; i < 70; i++) {
          const x = r() * W, y = r() * H, rr = 60 + r() * 200;
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          const tone = r() < 0.5 ? '#e7e0d0' : '#f7f2e7';
          gr.addColorStop(0, rgba(tone, 0.32)); gr.addColorStop(1, rgba(tone, 0));
          g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
        g.strokeStyle = 'rgba(140,120,90,0.07)'; g.lineWidth = 0.8;
        for (let i = 0; i < 260; i++) {
          const x = r() * W, y = r() * H, a = r() * TAU, l = 10 + r() * 40;
          g.beginPath(); g.moveTo(x, y);
          g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
          g.stroke();
        }
        // 黎明前的淡青：天际一抹冷色
        const sk = g.createLinearGradient(0, 260, 0, 560);
        sk.addColorStop(0, 'rgba(201,211,217,0)'); sk.addColorStop(0.7, 'rgba(201,211,217,0.22)'); sk.addColorStop(1, 'rgba(201,211,217,0)');
        g.fillStyle = sk; g.fillRect(0, 260, W, 300);
        // 四角轻暗角
        const vg = g.createRadialGradient(W / 2, H / 2, 320, W / 2, H / 2, 820);
        vg.addColorStop(0, 'rgba(90,80,60,0)'); vg.addColorStop(1, 'rgba(90,80,60,0.12)');
        g.fillStyle = vg; g.fillRect(0, 0, W, H);
      });
    }
    // 噪声湿边圆盘：mode 0 实心遮罩，1 湿边线，2 淡墨晕（带水痕边与毛边）
    const DISK_R = 220;
    const diskRad = (a) => DISK_R * (1 + 0.075 * fbm(a * 1.6, 7, 3) + 0.022 * fbm(a * 11, 9, 2));
    function diskPath(g, scale) {
      g.beginPath();
      for (let i = 0; i <= 240; i++) {
        const a = (i / 240) * TAU, rr = diskRad(a) * scale;
        const x = 256 + Math.cos(a) * rr, y = 256 + Math.sin(a) * rr;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    function diskTex(mode) {
      return K.cache('ff1_i1_disk' + mode, 512, 512, 1, (g) => {
        if (mode === 0) {
          blurInto(g, 512, 512, 8, (tg) => { tg.fillStyle = '#fff'; diskPath(tg, 0.96); tg.fill(); });
        } else if (mode === 1) {
          blurInto(g, 512, 512, 2.4, (tg) => { tg.strokeStyle = '#2a3038'; tg.lineWidth = 6; diskPath(tg, 0.96); tg.stroke(); });
        } else {
          blurInto(g, 512, 512, 3.2, (tg) => {
            // 墨心浓、向外渐淡，边缘一圈水痕略深（不是一块平涂的浅色圆盘）
            const gr = tg.createRadialGradient(256, 256, 0, 256, 256, DISK_R * 1.04);
            gr.addColorStop(0, rgba('#2c343d', 0.7));
            gr.addColorStop(0.06, rgba('#3b4651', 0.5));
            gr.addColorStop(0.17, rgba('#52606c', 0.3));
            gr.addColorStop(0.34, rgba('#64768a', 0.16));
            gr.addColorStop(0.6, rgba('#6f8190', 0.085));
            gr.addColorStop(0.8, rgba('#6f8190', 0.075));
            gr.addColorStop(0.9, rgba('#677a89', 0.1));
            gr.addColorStop(0.96, rgba('#5d6f7d', 0.15));
            gr.addColorStop(1, rgba('#5d6f7d', 0.12));
            tg.fillStyle = gr; diskPath(tg, 1); tg.fill();
            // 盘内深浅不匀：几团略浓、几团略淡的墨气，像水把墨推得不均
            tg.save(); diskPath(tg, 0.985); tg.clip();
            const rv = rng(37);
            for (let i = 0; i < 34; i++) {
              const a = rv() * TAU, d = Math.sqrt(rv()) * DISK_R * 0.95;
              const x = 256 + Math.cos(a) * d, y = 256 + Math.sin(a) * d;
              const rr = 22 + rv() * 64, dark = rv() < 0.5, al = 0.025 + rv() * 0.045;
              const bg = tg.createRadialGradient(x, y, 0, x, y, rr);
              if (dark) { bg.addColorStop(0, rgba('#3e4b57', al)); bg.addColorStop(1, rgba('#3e4b57', 0)); }
              else { bg.addColorStop(0, `rgba(0,0,0,${(al * 2.2).toFixed(3)})`); bg.addColorStop(1, 'rgba(0,0,0,0)'); }
              tg.globalCompositeOperation = dark ? 'source-over' : 'destination-out';
              tg.fillStyle = bg; tg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
            }
            tg.restore();
            tg.strokeStyle = rgba('#4a5864', 0.08); tg.lineWidth = 2.2; diskPath(tg, 0.993); tg.stroke();
            const r = rng(31);
            tg.lineWidth = 0.8;
            for (let i = 0; i < 420; i++) {
              const a = r() * TAU, r0 = diskRad(a) * 0.99, l = 3 + r() * 13;
              tg.strokeStyle = rgba('#5d6e7c', 0.05 + r() * 0.08);
              tg.beginPath(); tg.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
              const a2 = a + (r() - 0.5) * 0.05;
              tg.lineTo(256 + Math.cos(a2) * (r0 + l), 256 + Math.sin(a2) * (r0 + l));
              tg.stroke();
            }
          });
          // 水痕边：墨被水推到边缘积成一圈略深的边，内侧柔开、外缘随噪声起伏
          blurInto(g, 512, 512, 4, (tg) => {
            tg.strokeStyle = rgba('#3e4b56', 0.1); tg.lineWidth = 7; diskPath(tg, 0.972); tg.stroke();
          });
        }
      });
    }
    // 浓墨墨心
    function coreTex() {
      return K.cache('ff1_i1_core', 128, 128, 2, (g) => {
        blurInto(g, 128, 128, 1.4, (tg) => {
          tg.beginPath();
          for (let i = 0; i <= 120; i++) {
            const a = (i / 120) * TAU, rr = 40 * (1 + 0.09 * fbm(a * 2, 3, 3));
            const x = 64 + Math.cos(a) * rr, y = 64 + Math.sin(a) * rr;
            i ? tg.lineTo(x, y) : tg.moveTo(x, y);
          }
          tg.closePath();
          const gr = tg.createRadialGradient(62, 62, 0, 64, 64, 44);
          gr.addColorStop(0, 'rgba(22,24,28,0.98)'); gr.addColorStop(0.65, 'rgba(28,32,38,0.93)'); gr.addColorStop(1, 'rgba(40,46,54,0.6)');
          tg.fillStyle = gr; tg.fill();
        });
      });
    }
    // 化开中的墨：中心浓、四周柔
    function softInk() {
      return K.cache('ff1_i1_softink', 128, 128, 1, (g) => {
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(34,40,46,0.85)'); gr.addColorStop(0.3, 'rgba(44,52,60,0.55)'); gr.addColorStop(0.65, 'rgba(60,72,82,0.2)'); gr.addColorStop(1, 'rgba(70,84,96,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      });
    }
    // 自下而上的湿边：0 遮罩条（上透明下实），1 湿边线
    const edgeY = (x) => 100 + 30 * fbm(x / 120, 21, 3) + 10 * fbm(x / 25, 23, 2);
    function edgeTex(mode) {
      return K.cache('ff1_i1_edge' + mode, W + 200, 200, 0.5, (g) => {
        blurInto(g, W + 200, 200, mode ? 2 : 7, (tg) => {
          tg.beginPath(); tg.moveTo(0, edgeY(0));
          for (let x = 0; x <= W + 200; x += 4) tg.lineTo(x, edgeY(x));
          if (mode === 0) { tg.lineTo(W + 200, 230); tg.lineTo(0, 230); tg.closePath(); tg.fillStyle = '#fff'; tg.fill(); }
          else { tg.strokeStyle = '#2a3038'; tg.lineWidth = 5; tg.stroke(); }
        });
      });
    }
    // 近山用的宽羽化湿边（羽化约 ±38px）：贴图更高，模糊在底边造成的透明行远在实心区以下
    const NE_H = 360;
    function nearEdgeTex() {
      return K.cache('ff1_i1_nedge', W + 200, NE_H, 0.5, (g) => {
        blurInto(g, W + 200, NE_H, 19, (tg) => {
          tg.beginPath(); tg.moveTo(0, edgeY(0));
          for (let x = 0; x <= W + 200; x += 4) tg.lineTo(x, edgeY(x));
          tg.lineTo(W + 200, NE_H + 40); tg.lineTo(0, NE_H + 40); tg.closePath(); tg.fillStyle = '#fff'; tg.fill();
        });
      });
    }
    // 墨晕沉进近山与山脚雾带：墨晕只留在近山剪影（按该层已显出的 alpha）与雾带里，其余慢慢收干
    const ST_X = 120, ST_Y = 176, ST_W = 600, ST_H = 470;
    const bloomR = (td) => 260 * (1 - Math.exp(-td / 0.9));
    function mistBand(g, a) {
      const mg = g.createLinearGradient(0, 548, 0, WATER);
      mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(0.55, `rgba(0,0,0,${a.toFixed(3)})`); mg.addColorStop(1, `rgba(0,0,0,${(a * 0.8).toFixed(3)})`);
      g.fillStyle = mg; g.fillRect(ST_X, 548, ST_W, WATER - 548);
    }
    // 把墨晕（半径 R）画进 sg（已平移到画面坐标），s 为“沉进山里”的进度，near 为近山已显出的图层
    function stainInto(sg, R, s, near) {
      const k = R / DISK_R;
      sg.drawImage(diskTex(2), DROP[0] - 256 * k, DROP[1] - 256 * k, 512 * k, 512 * k);
      sg.globalCompositeOperation = 'destination-in';
      // 湿墨不过岸线：在岸线上方 36px 内柔和收住
      const mg = sg.createLinearGradient(0, WATER - 36, 0, WATER + 6);
      mg.addColorStop(0, '#000'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = mg; sg.fillRect(ST_X, ST_Y, ST_W, ST_H);
      if (s > 0.001) {
        const m = scratch('ff1_i1_smask', ST_W, ST_H), mg2 = m.g;
        mg2.translate(-ST_X, -ST_Y);
        if (s < 0.999) { mg2.fillStyle = `rgba(0,0,0,${(1 - s).toFixed(3)})`; mg2.fillRect(ST_X, ST_Y, ST_W, ST_H); }
        mg2.globalAlpha = s;
        if (near) mg2.drawImage(near, 0, BY0, W, BH);
        mistBand(mg2, 0.55);
        mg2.globalAlpha = 1;
        sg.drawImage(m.c, ST_X, ST_Y, ST_W, ST_H);
      }
      sg.globalCompositeOperation = 'source-over';
    }
    // 4.5s 以后墨晕已定（半径几乎不再变、近山早已全显）：缓存成一张
    const ST_T = 4.5;
    function stainFinal() {
      return K.cache('ff1_i1_stainF', ST_W, ST_H, 1, (g) => {
        g.translate(-ST_X, -ST_Y);
        stainInto(g, bloomR(ST_T - 0.5), 1, buildLayer(LAYERS[3], 3));
      });
    }
    // 两头尖的横笔（起笔略重、收笔细）
    function taper(g, x, y, l, w, bend) {
      const N = 14;
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N, hw = 0.5 * w * Math.pow(Math.sin(Math.PI * u), 0.7) * (1.15 - 0.4 * u);
        g.lineTo(x + l * u, y + bend * Math.sin(Math.PI * u) - hw);
      }
      for (let i = N; i >= 0; i--) {
        const u = i / N, hw = 0.5 * w * Math.pow(Math.sin(Math.PI * u), 0.7) * (1.15 - 0.4 * u);
        g.lineTo(x + l * u, y + bend * Math.sin(Math.PI * u) + hw);
      }
      g.closePath(); g.fill();
    }
    // 江面：山脚一线岸、几笔水纹（缓存 y 从 WATER−4 起）
    function waterTex() {
      return K.cache('ff1_i1_water', W, 100, 1, (g) => {
        // 江面一层极淡的冷色水汽
        const wg = g.createLinearGradient(0, 0, 0, 100);
        wg.addColorStop(0, 'rgba(183,196,204,0.0)'); wg.addColorStop(0.12, 'rgba(183,196,204,0.22)'); wg.addColorStop(0.6, 'rgba(190,201,208,0.1)'); wg.addColorStop(1, 'rgba(190,201,208,0)');
        g.fillStyle = wg; g.fillRect(0, 0, W, 100);
        // 晨光带所在的一段江水略偏冷（y 640–700），光带才显得亮
        const cg = g.createLinearGradient(0, 6, 0, 84);
        cg.addColorStop(0, 'rgba(150,165,175,0)'); cg.addColorStop(0.18, 'rgba(150,165,175,0.12)'); cg.addColorStop(0.7, 'rgba(150,165,175,0.12)'); cg.addColorStop(1, 'rgba(150,165,175,0)');
        g.fillStyle = cg; g.fillRect(0, 6, W, 78);
        blurInto(g, W, 100, 0.6, (tg) => {
          const r = rng(61);
          // 岸线：疏密不一、高低错落的尖头横笔，偶有小点
          const xs = [8, 120, 205, 330, 455, 560, 690, 790, 905, 1010, 1130];
          xs.forEach((x0) => {
            const x = x0 + (r() - 0.5) * 40, l = 24 + Math.pow(r(), 1.3) * 120, y = 5 + (r() - 0.5) * 12;
            tg.fillStyle = rgba('#3c4650', 0.22 + r() * 0.26);
            taper(tg, x, y, l, 1.4 + r() * 1.8, (r() - 0.5) * 2.5);
            if (r() < 0.55) {
              tg.fillStyle = rgba('#3c4650', 0.18 + r() * 0.16);
              taper(tg, x + l * (0.3 + r() * 0.5), y + 3 + r() * 4, 10 + r() * 30, 1 + r(), (r() - 0.5) * 1.5);
            }
            if (r() < 0.5) { tg.fillStyle = rgba('#3c4650', 0.3); tg.beginPath(); tg.ellipse(x - 6 - r() * 10, y + (r() - 0.5) * 3, 1.6, 1, 0, 0, TAU); tg.fill(); }
          });
          // 水纹：越近越长、越淡
          for (let i = 0; i < 16; i++) {
            const y = 16 + Math.pow(r(), 1.3) * 76;
            const x = 40 + r() * 1180, l = 30 + r() * 150 * (1 - y / 120);
            tg.fillStyle = rgba('#6f8190', (0.1 + r() * 0.14) * (1 - y / 130));
            taper(tg, x, y, l, 0.8 + r() * 0.9, (r() - 0.5) * 1.6);
          }
        });
      });
    }
    function glyph(k) {
      const ch = ['逍', '遥', '叹'][k];
      return K.cache('ff1_i1_glyph' + k + (fontReady() ? 'f' : 'n'), 130, 130, 2, (g) => {
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `94px ${XYT.FONT}`;
        g.fillStyle = rgba('#2a2622', 0.15); g.fillText(ch, 66, 66);
        g.fillStyle = '#2a2622'; g.fillText(ch, 65, 65);
      });
    }
    function sealTex() {
      return K.cache('ff1_i1_seal', 60, 60, 3, (g) => {
        const r = rng(19);
        g.fillStyle = '#b8322a';
        g.beginPath();
        [[6, 7], [54, 5], [55, 54], [5, 55]].forEach((p, i) => { const x = p[0] + (r() - 0.5) * 1.5, y = p[1] + (r() - 0.5) * 1.5; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.closePath(); g.fill();
        // 抽象白文笔画（不成字）
        g.strokeStyle = '#f3e6d6'; g.lineCap = 'square'; g.lineWidth = 3.2;
        g.strokeRect(10, 10, 40, 40);
        g.lineWidth = 3;
        const seg = [[16, 18, 30, 18], [30, 18, 30, 30], [16, 26, 24, 26], [16, 26, 16, 42], [16, 42, 30, 42], [36, 16, 36, 44], [36, 24, 44, 24], [44, 24, 44, 36], [36, 36, 44, 36], [22, 34, 30, 34]];
        g.beginPath(); seg.forEach((s) => { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); }); g.stroke();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.5})`; g.beginPath(); g.arc(r() * 60, r() * 60, 0.3 + r() * 1.1, 0, TAU); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 江面晨光带：暖色淡金的横向柔带（正常叠加，宣纸上才看得出）
    function lightBand() {
      return K.cache('ff1_i1_band', 1000, 60, 1, (g) => {
        blurInto(g, 1000, 60, 3.5, (tg) => {
          const band = (cy, hh, a) => {
            const gr = tg.createRadialGradient(500, cy, 0, 500, cy, 500);
            gr.addColorStop(0, `rgba(236,206,150,${a})`); gr.addColorStop(0.55, `rgba(236,206,150,${a * 0.6})`); gr.addColorStop(1, 'rgba(236,206,150,0)');
            tg.save(); tg.translate(500, cy); tg.scale(1, hh / 500); tg.translate(-500, -cy);
            tg.fillStyle = gr; tg.fillRect(0, cy - 500, 1000, 1000); tg.restore();
          };
          band(30, 28, 0.2);
          band(30, 15, 0.45);
          band(28, 6, 0.3);
        });
      });
    }
    // 光带里的细碎亮纹：位置固定，各自缓慢明灭
    const GLINTS = (() => {
      const r = rng(77), out = [];
      for (let i = 0; i < 22; i++) {
        const u = (r() - 0.5) * 2 * (0.25 + 0.75 * r());
        out.push({ x: 760 + u * 380, y: 655 + (r() - 0.5) * 14 * (1 - 0.5 * Math.abs(u)), l: (10 + r() * 44) * (1 - 0.5 * Math.abs(u)), a: 1 - Math.abs(u) * 0.85,
          f: 0.5 + r() * 0.7, ph: r() * TAU });
      }
      return out;
    })();

    XYT.registerShot('i1_inkdawn', {
      name: '墨晓', zone: 'bottom', night: false, text: '#2a2622', shadow: 'rgba(250,246,236,0.85)', accent: '#b8322a', bloom: 0.18,
      draw(g, c) {
        const t = Math.max(0, c.lt);
        // 四层山的缓存在黑场里先建好，免得各层开始显现时卡一帧
        if (t < 1.5) for (let li = 0; li < 4; li++) buildLayer(LAYERS[li], li);
        // 镜头：整镜 1.00→1.04 缓推
        const z = 1 + 0.04 * smooth(c.p);
        g.save();
        g.translate(600, 480); g.scale(z, z); g.translate(-600, -480);
        g.drawImage(paperTex(), 0, 0, W, H);
        // 8–10s 远山后方天际微亮（与江面晨光带同一光源）
        const dq = smooth((t - 7.6) / 2.4);
        if (dq > 0) {
          const gr = g.createRadialGradient(760, 470, 0, 760, 470, 460);
          gr.addColorStop(0, `rgba(240,217,176,${(0.36 * dq).toFixed(3)})`);
          gr.addColorStop(0.5, `rgba(240,217,176,${(0.18 * dq).toFixed(3)})`);
          gr.addColorStop(1, 'rgba(240,217,176,0)');
          g.save(); g.translate(760, 470); g.scale(1.3, 0.6); g.translate(-760, -470);
          g.fillStyle = gr; g.fillRect(300, 10, 920, 920); g.restore();
        }
        const td = t - 0.5;
        // 四层山：远层先画；显现中的层用遮罩合成
        let near = null;
        for (let li = 0; li < 4; li++) {
          const L = LAYERS[li];
          const q = (t - L.start) / 1.2;
          if (q <= 0) continue;
          const lay = buildLayer(L, li);
          if (q >= 1.12) { g.drawImage(lay, 0, BY0, W, BH); if (li === 3) near = lay; continue; }
          const sc = scratch(li === 3 ? 'ff1_i1_mask3' : 'ff1_i1_mask', W, BH);
          const sg = sc.g;
          sg.translate(0, -BY0);
          const lineA = 0.3 * (1 - smooth((q - 0.7) / 0.42)) * L.a * smooth(q / 0.3);
          if (li === 3) {
            // 近山：自下而上的宽羽化湿边擦显（p = smoothstep，1.5–2.7s），山脚先出、峰顶最后；
            // 第一帧只露出山脚雾里极淡的一线，没有整块突现
            const p = smooth(clamp(q));
            const yf = lerp(WATER + 80, 340, p);
            const nt = nearEdgeTex();
            sg.drawImage(nt, -37, yf - 100, W + 200, NE_H);
            sg.fillStyle = '#fff';
            sg.fillRect(0, yf + 200, W, BY0 + BH - (yf + 200));
            sg.globalCompositeOperation = 'source-in';
            sg.drawImage(lay, 0, BY0, W, BH);
            sg.globalCompositeOperation = 'source-atop';
            sg.globalAlpha = lineA;
            sg.drawImage(edgeTex(1), -37, yf - 100, W + 200, 200);
            near = sc.c;
          } else {
            // 自下而上的湿边擦显
            const top = Math.min(...L.peaks.map((p) => p[1]));
            const yf = lerp(WATER + 60, top - 70, easeInOut(clamp(q)));
            const off = (li * 137) % 200;
            sg.drawImage(edgeTex(0), -off, yf - 100, W + 200, 200);
            sg.fillStyle = '#fff'; // 湿边贴图底部几行因模糊会变透明：实心区从贴图中段（边线最低处之下）就接上，不留横缝
            sg.fillRect(0, yf + 64, W, BY0 + BH - yf);
            sg.globalCompositeOperation = 'source-in';
            sg.drawImage(lay, 0, BY0, W, BH);
            sg.globalCompositeOperation = 'source-atop';
            sg.globalAlpha = lineA;
            sg.drawImage(edgeTex(1), -off, yf - 100, W + 200, 200);
          }
          sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
          g.drawImage(sc.c, 0, BY0, W, BH);
        }
        // 淡墨晕：r = 260·(1−e^(−t/0.9))；1.5–2.7s 随近山擦显沉进近山剪影与山脚雾带（不整块消失），
        // 2.7–4.5s 墨色再收干到六成，之后作为山上的墨痕一直留着
        if (td > 0) {
          const wa = clamp(td / 0.12);
          const s = smooth((t - 1.5) / 1.2);
          const strength = 1 - 0.4 * smooth((t - 2.7) / (ST_T - 2.7));
          g.globalAlpha = wa * strength;
          if (t >= ST_T) g.drawImage(stainFinal(), ST_X, ST_Y, ST_W, ST_H);
          else {
            const sc = scratch('ff1_i1_stain', ST_W, ST_H), sg = sc.g;
            sg.translate(-ST_X, -ST_Y);
            stainInto(sg, bloomR(td), s, near);
            g.drawImage(sc.c, ST_X, ST_Y, ST_W, ST_H);
          }
          g.globalAlpha = 1;
        }
        // 浓墨墨心：0.5s 触纸，0.25s 由虚变实、长到约 13px；1.3–1.7s 化进墨晕：半径 13→40、浓度 1→0（smoothstep）
        if (td > 0 && t < 1.72) {
          const q = clamp(td / 0.25);
          const rc0 = 8 * easeOut(q) + 6 * (1 - Math.exp(-Math.max(0, td - 0.25) / 0.35));
          const v = clamp((t - 1.3) / 0.4), u = smooth(v);
          const rc = rc0 + (40 - rc0) * u;
          const A = (0.2 + 0.8 * q) * (1 - u);
          if (A > 0.002 && rc > 0.3) {
            const rr = rc * (1 + 0.7 * (1 - q));
            const b = smooth((t - 1.3) / 0.3); // 实心墨点渐换成柔边墨团
            if (b < 1) {
              g.globalAlpha = A * (1 - b);
              g.drawImage(coreTex(), DROP[0] - rr * 1.6, DROP[1] - rr * 1.6, rr * 3.2, rr * 3.2);
            }
            if (b > 0) {
              g.globalAlpha = A * b * 0.9;
              const r2 = rr * 1.9;
              g.drawImage(softInk(), DROP[0] - r2, DROP[1] - r2, r2 * 2, r2 * 2);
            }
            g.globalAlpha = 1;
          }
        }
        // 江面：一线岸与几笔水纹，随近山一同显出
        const wq = smooth((t - 2.0) / 1.6);
        if (wq > 0) {
          g.globalAlpha = wq;
          g.drawImage(waterTex(), 0, WATER - 4, W, 100);
          g.globalAlpha = 1;
        }
        // 8–10s 江面浮出淡淡晨光带：与天际暖光同在 x≈760，随拍轻微起伏
        const lq = smooth((t - 8) / 2);
        if (lq > 0) {
          const pulse = 1 + 0.08 * beatEnv(c, 0.5);
          const breathe = 1 + 0.05 * Math.sin(t * 1.3);
          const bw = lerp(760, 1000, lq);
          g.globalAlpha = clamp(lq * pulse * breathe);
          g.drawImage(lightBand(), 760 - bw / 2, 626, bw, 60);
          for (const G of GLINTS) {
            const tw = 0.6 + 0.4 * Math.sin(t * G.f * TAU * 0.5 + G.ph);
            const a = 0.6 * G.a * tw * lq * pulse;
            if (a < 0.01) continue;
            g.globalAlpha = a;
            g.fillStyle = 'rgb(255,250,235)';
            const x = 760 + (G.x - 760) * (bw / 1000);
            g.fillRect(x - G.l / 2, G.y, G.l, 1.4);
          }
          g.globalAlpha = 1;
        }
        // 片名：4.8s 起三字依次自上而下显出，每字 0.5s
        const tx = 1060, ty0 = 222, step = 104;
        for (let k = 0; k < 3; k++) {
          const q = (t - 4.8 - k * 0.5) / 0.5;
          if (q <= 0) continue;
          const gl = glyph(k);
          const x = tx - 65, y = ty0 + k * step - 65;
          if (q >= 1) { g.drawImage(gl, x, y, 130, 130); continue; }
          const sc = scratch('ff1_i1_glyph', 130, 130);
          sc.g.drawImage(gl, 0, 0, 130, 130);
          sc.g.globalCompositeOperation = 'destination-in';
          const f = lerp(-0.25, 1.25, q);
          const gr = sc.g.createLinearGradient(0, 0, 0, 130);
          gr.addColorStop(0, '#000');
          gr.addColorStop(clamp(f - 0.2), '#000');
          gr.addColorStop(clamp(f + 0.05, 0.001, 1), 'rgba(0,0,0,0)');
          gr.addColorStop(1, 'rgba(0,0,0,0)');
          sc.g.fillStyle = gr; sc.g.fillRect(0, 0, 130, 130);
          sc.g.globalCompositeOperation = 'source-over';
          g.drawImage(sc.c, x, y, 130, 130);
        }
        // 6.8s 朱印轻落（1.06→1.0，0.3s 缓出）
        const sq = (t - 6.8) / 0.3;
        if (sq > 0) {
          const s = 1.06 - 0.06 * easeOut(sq);
          const sz = 40 * s;
          g.globalAlpha = clamp(sq / 0.25);
          g.drawImage(sealTex(), tx - sz / 2, ty0 + 2 * step + 84 - sz / 2, sz, sz);
          g.globalAlpha = 1;
        }
        g.restore();
        // 黑场淡入
        if (t < 0.5) { g.fillStyle = `rgba(6,6,8,${(1 - smooth(t / 0.5)).toFixed(3)})`; g.fillRect(0, 0, W, H); }
      },
    });
  })();
  // ============================================================
  // a1_pavilion：逆光空亭、静止的风铃与光里浮尘；第2句起风，芦苇、风铃、浮尘随风
  // ============================================================
  (function () {
    // 第2句各字时间（无歌词信息时的后备值，秒，相对镜头起点）
    const FALLBACK2 = [3.483, 3.963, 4.343, 4.643, 5.063, 5.543];
    const HZ = 482;        // 对岸水线
    const NB = 606;        // 近岸水线（亭后）
    const GROUND = 630;    // 亭前地面
    const PX = [225, 655]; // 两柱中心
    const PW = 26;         // 柱径
    const IN = { x0: PX[0] + PW / 2, x1: PX[1] - PW / 2, y0: 250, y1: 600 }; // 柱间通透区
    const RIM = '#f2c47c', BODY = '#3b342e';
    const STONE = { x0: 768, x1: 826, yb: 664, h: 20 }; // 亭右前方的低条石（亭子坐标）
    const WIND_V = 320;    // 风前锋速度 px/s（自左向右）
    const BELL = [121, 146]; // 风铃悬挂点（左檐角下沿）

    function skyTex() {
      return K.cache('ff1_a1_sky', W + 60, 500, 0.5, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 500);
        gr.addColorStop(0, '#d8cbb0'); gr.addColorStop(0.55, '#e8dcc4'); gr.addColorStop(0.95, '#efe0c0'); gr.addColorStop(1, '#efe0c0');
        g.fillStyle = gr; g.fillRect(0, 0, W + 60, 500);
        // 右侧低处的斜阳：天空亮处在右
        const sg = g.createRadialGradient(1420, 330, 0, 1420, 330, 900);
        sg.addColorStop(0, 'rgba(252,230,180,1)'); sg.addColorStop(0.28, 'rgba(246,212,150,0.7)'); sg.addColorStop(1, 'rgba(244,214,160,0)');
        g.fillStyle = sg; g.fillRect(0, 0, W + 60, 500);
        const og = g.createRadialGradient(1400, 420, 0, 1400, 420, 520);
        og.addColorStop(0, 'rgba(216,135,58,0.4)'); og.addColorStop(1, 'rgba(216,135,58,0)');
        g.fillStyle = og; g.fillRect(0, 0, W + 60, 500);
        // 几缕淡云：下沿受光
        const r = rng(211);
        blurInto(g, W + 60, 500, 6, (tg) => {
          for (let i = 0; i < 9; i++) {
            const x = r() * (W + 60), y = 120 + r() * 230, w = 140 + r() * 260, h = 8 + r() * 10;
            tg.fillStyle = `rgba(214,198,170,${(0.25 + r() * 0.2).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x, y, w, h, 0, 0, TAU); tg.fill();
            tg.fillStyle = `rgba(252,232,190,${(0.3 + r() * 0.2).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.45, 0, 0, TAU); tg.fill();
          }
        });
      });
    }
    function farTex() {
      return K.cache('ff1_a1_far', W + 60, 120, 1, (g) => {
        g.translate(0, -(HZ - 100));
        blurInto(g, W + 60, 120, 1.5, (tg) => {
          tg.translate(0, -(HZ - 100));
          const layer = (seed, base, amp, col, a, x1) => {
            tg.beginPath(); tg.moveTo(-10, HZ + 2);
            for (let x = -10; x <= W + 70; x += 4) {
              const fade = clamp((x1 - x) / 500);
              const y = HZ - (base + amp * (0.5 + 0.5 * fbm(x / 160, seed, 3))) * (0.25 + 0.75 * fade);
              tg.lineTo(x, y);
            }
            tg.lineTo(W + 70, HZ + 2); tg.closePath();
            const gr = tg.createLinearGradient(0, HZ - base - amp, 0, HZ);
            gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, a * 0.55));
            tg.fillStyle = gr; tg.fill();
          };
          layer(5, 26, 34, '#a7aca6', 0.55, 900);
          layer(9, 10, 18, '#968f82', 0.6, 1000);
        });
        // 水线处的暖色薄雾
        const hz = g.createLinearGradient(0, HZ - 24, 0, HZ + 4);
        hz.addColorStop(0, 'rgba(240,222,190,0)'); hz.addColorStop(1, 'rgba(240,222,190,0.55)');
        g.fillStyle = hz; g.fillRect(0, HZ - 24, W + 60, 28);
      });
    }
    function waterTex() {
      return K.cache('ff1_a1_water', W + 60, 130, 1, (g) => {
        g.translate(0, -HZ);
        const gr = g.createLinearGradient(0, HZ, 0, HZ + 130);
        gr.addColorStop(0, '#d9cdb2'); gr.addColorStop(0.4, '#b9b5a2'); gr.addColorStop(1, '#a3a597');
        g.fillStyle = gr; g.fillRect(0, HZ, W + 60, 130);
        // 右侧近日处水面偏亮偏暖
        const sg = g.createRadialGradient(1420, HZ, 0, 1420, HZ, 700);
        sg.addColorStop(0, 'rgba(250,224,170,0.75)'); sg.addColorStop(1, 'rgba(250,224,170,0)');
        g.fillStyle = sg; g.fillRect(0, HZ, W + 60, 130);
        // 对岸山的倒影：以水线为轴翻转、更暗、横向波纹
        blurInto(g, W + 60, H, 1.2, (tg) => {
          tg.translate(0, -HZ + HZ);
          for (let y = HZ; y < HZ + 60; y += 2) {
            const k = (y - HZ) / 60;
            const dx = 3 * Math.sin(y * 0.9);
            for (let x = -10; x <= W + 70; x += 6) {
              const fade = clamp((900 - x) / 500);
              const hgt = (26 + 34 * (0.5 + 0.5 * fbm(x / 160, 5, 3))) * (0.25 + 0.75 * fade);
              if (y - HZ < hgt) { tg.fillStyle = `rgba(110,108,98,${(0.22 * (1 - k)).toFixed(3)})`; tg.fillRect(x + dx, y, 6, 2); }
            }
          }
        });
        // 细横波纹
        const r = rng(331);
        g.lineCap = 'round';
        for (let i = 0; i < 140; i++) {
          const y = HZ + 4 + Math.pow(r(), 0.8) * 120, x = r() * (W + 60), l = 8 + r() * 40 * (0.5 + (y - HZ) / 120);
          g.strokeStyle = r() < 0.5 ? `rgba(120,118,104,${(0.1 + r() * 0.12).toFixed(3)})` : `rgba(250,236,206,${(0.12 + r() * 0.15).toFixed(3)})`;
          g.lineWidth = 0.8 + r() * 0.8;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
        }
      });
    }
    // 水面受风的暗纹（风前锋以左为皱水）
    function ruffleTex() {
      return K.cache('ff1_a1_ruffle', 400, 130, 1, (g) => {
        const r = rng(441);
        g.lineCap = 'round';
        for (let i = 0; i < 520; i++) {
          const y = 4 + Math.pow(r(), 0.85) * 122, x = r() * 400, l = 3 + r() * 10 * (0.4 + y / 130);
          g.strokeStyle = `rgba(78,74,66,${(0.18 + r() * 0.2).toFixed(3)})`;
          g.lineWidth = 0.8 + r() * 0.7;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5)); g.stroke();
          if (r() < 0.25) { g.strokeStyle = `rgba(252,236,200,${(0.15 + r() * 0.15).toFixed(3)})`; g.beginPath(); g.moveTo(x + 1, y - 1.2); g.lineTo(x + l * 0.7, y - 1.2); g.stroke(); }
        }
      });
    }
    // 近岸地面与柱影
    function groundTex() {
      return K.cache('ff1_a1_ground', W + 60, H - NB + 10, 1, (g) => {
        const y0 = NB - 8;
        g.translate(0, -y0);
        const gr = g.createLinearGradient(0, NB, 0, H);
        gr.addColorStop(0, '#8a7458'); gr.addColorStop(0.25, '#7a6550'); gr.addColorStop(1, '#4e4136');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(-10, NB + 2);
        for (let x = -10; x <= W + 70; x += 6) g.lineTo(x, NB + 2 * fbm(x / 40, 3, 2));
        g.lineTo(W + 70, H + 5); g.lineTo(-10, H + 5); g.closePath(); g.fill();
        // 岸边受光的草梢（逆光金边）
        const r = rng(551);
        for (let i = 0; i < 260; i++) {
          const x = r() * (W + 60), y = NB + 1 + r() * 8, h = 3 + r() * 9;
          g.strokeStyle = `rgba(58,48,40,${(0.5 + r() * 0.4).toFixed(3)})`; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 1, y - h * 0.6, x + 1.5 + r() * 2, y - h); g.stroke();
          if (r() < 0.6) { g.strokeStyle = `rgba(242,196,124,${(0.35 + r() * 0.4).toFixed(3)})`; g.beginPath(); g.moveTo(x + 0.8, y - h * 0.3); g.lineTo(x + 1.8, y - h); g.stroke(); }
        }
        // 地面草纹：成片疏密（噪声决定密度），近大远小
        for (let i = 0; i < 700; i++) {
          const x = r() * (W + 60), y = GROUND - 10 + Math.pow(r(), 0.7) * (H - GROUND + 10);
          const dens = noise1(x / 70, 17) * noise1(y / 25 + x / 300, 19);
          if (r() > dens * 1.8) continue;
          const near = (y - GROUND) / (H - GROUND), l = (2.5 + r() * 5) * (0.7 + near * 0.9);
          g.strokeStyle = `rgba(${r() < 0.5 ? '52,44,36' : '150,124,88'},${(0.16 + r() * 0.2).toFixed(3)})`;
          g.lineWidth = 0.8 + near * 0.4;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.6 + r(), y - l); g.stroke();
        }
        // 土路：从亭前台阶向右沿岸延伸
        blurInto(g, W + 60, H, 2, (tg) => {
          tg.translate(0, -y0);
          tg.beginPath();
          const py = (x) => 652 - (x - 440) * 0.022 + 3 * Math.sin(x / 90);
          const pw = (x) => 26 - (x - 440) * 0.009;
          tg.moveTo(392, py(392));
          for (let x = 400; x <= W + 70; x += 10) tg.lineTo(x, py(x) - pw(x) / 2);
          for (let x = W + 70; x >= 400; x -= 10) tg.lineTo(x, py(x) + pw(x) / 2);
          tg.closePath();
          const pg = tg.createLinearGradient(392, 0, 520, 0);
          pg.addColorStop(0, 'rgba(184,158,116,0)'); pg.addColorStop(1, 'rgba(184,158,116,0.55)');
          tg.fillStyle = pg; tg.fill();
        });
        // 地面的浓淡斑
        blurInto(g, W + 60, H, 14, (tg) => {
          tg.translate(0, -y0);
          for (let i = 0; i < 26; i++) {
            const x = r() * (W + 60), y = GROUND + r() * 90, w = 60 + r() * 160;
            tg.fillStyle = r() < 0.6 ? `rgba(60,48,38,${(0.12 + r() * 0.12).toFixed(3)})` : `rgba(190,160,110,${(0.1 + r() * 0.1).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x, y, w, w * 0.12, 0, 0, TAU); tg.fill();
          }
        });
        // 秋草丛：沿岸与路边成簇，逆光，草梢镶金
        const clump = (x, y, sz) => {
          const n = 10 + Math.floor(r() * 8);
          for (let k = 0; k < n; k++) {
            const a = (r() - 0.5) * 1.3 + 0.12, l = sz * (0.4 + r() * 0.6);
            const bx = x + (r() - 0.5) * sz * 0.5;
            const ex = bx + Math.sin(a) * l, ey = y - Math.cos(a) * l;
            g.strokeStyle = `rgba(${48 + Math.floor(r() * 20)},40,32,0.85)`; g.lineWidth = 0.9 + r() * 0.6;
            g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + Math.sin(a) * l * 0.2, y - l * 0.65, ex, ey); g.stroke();
            if (r() < 0.7) { g.strokeStyle = `rgba(246,202,130,${(0.35 + r() * 0.35).toFixed(3)})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(bx + Math.sin(a) * l * 0.45 + 0.7, y - Math.cos(a) * l * 0.5); g.lineTo(ex + 0.7, ey); g.stroke(); }
          }
        };
        // 岸边草丛成簇：几处聚在一起、大小不一，中间留出空地
        for (const [cx0, n] of [[748, 4], [836, 2], [930, 5], [1034, 3], [1112, 2], [1188, 5], [1290, 3]]) {
          for (let k = 0; k < n; k++) clump(cx0 + (r() - 0.5) * 36, NB + 5 + r() * 7, 6 + Math.pow(r(), 1.5) * 16);
        }
        clump(742, 632, 18); clump(140, 634, 16);
        // 右前景：几丛逆光高草（下缘出画），影子拉向左
        blurInto(g, W + 60, H, 3, (tg) => {
          tg.translate(0, -y0);
          tg.fillStyle = 'rgba(34,27,22,0.32)';
          for (const [x, y, sz] of [[1010, 716, 44], [1088, 724, 58], [1166, 712, 36], [1236, 728, 62]]) {
            tg.beginPath(); tg.ellipse(x - sz * 0.9, y + 2, sz * 1.1, 4, 0, 0, TAU); tg.fill();
          }
        });
        const tallClump = (x, y, sz) => {
          const n = 16 + Math.floor(r() * 8);
          for (let k = 0; k < n; k++) {
            const a = (r() - 0.42) * 0.9, l = sz * (0.45 + r() * 0.55);
            const bx = x + (r() - 0.5) * sz * 0.35;
            const ex = bx + Math.sin(a) * l + l * 0.12, ey = y - Math.cos(a) * l;
            g.strokeStyle = `rgba(${40 + Math.floor(r() * 18)},33,27,0.9)`; g.lineWidth = 1.1 + r() * 0.9;
            g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + Math.sin(a) * l * 0.25, y - l * 0.6, ex, ey); g.stroke();
            if (r() < 0.8) {
              g.strokeStyle = `rgba(248,206,136,${(0.4 + r() * 0.35).toFixed(3)})`; g.lineWidth = 0.8;
              g.beginPath(); g.moveTo(bx + Math.sin(a) * l * 0.4 + 0.9, y - Math.cos(a) * l * 0.45); g.quadraticCurveTo(bx + Math.sin(a) * l * 0.6 + 1, y - l * 0.75, ex + 0.8, ey); g.stroke();
            }
          }
        };
        tallClump(1010, 724, 44); tallClump(1088, 730, 58); tallClump(1166, 720, 36); tallClump(1236, 734, 62);
        // 亭前受光与柱影：太阳在右后方低处，影子向左拉长（地面贴图比亭子贴图在画面上偏左 20px，这里按亭子坐标 +20 对齐）
        const AX = 20;
        blurInto(g, W + 60, H, 2.5, (tg) => {
          tg.translate(AX, -y0);
          tg.fillStyle = 'rgba(34,27,22,0.55)';
          for (const px of PX) {
            tg.beginPath();
            tg.moveTo(px - PW / 2 - 2, GROUND); tg.lineTo(px + PW / 2 + 2, GROUND);
            tg.lineTo(px + PW / 2 - 330, H + 6); tg.lineTo(px - PW / 2 - 352, H + 6); tg.closePath(); tg.fill();
          }
          // 台基（高 30）与台阶的影子：夕阳低，向左前方拉得很长
          tg.fillStyle = 'rgba(34,27,22,0.34)';
          tg.beginPath(); tg.moveTo(150, GROUND); tg.lineTo(730, GROUND); tg.lineTo(626, GROUND + 30); tg.lineTo(46, GROUND + 30); tg.closePath(); tg.fill();
          tg.beginPath(); tg.moveTo(372, GROUND + 12); tg.lineTo(508, GROUND + 12); tg.lineTo(462, GROUND + 25); tg.lineTo(326, GROUND + 25); tg.closePath(); tg.fill();
          // 亭右前方一块低矮的条石（拴马石）：影子向左拉长约四倍于石高
          tg.fillStyle = 'rgba(34,27,22,0.42)';
          tg.beginPath(); tg.moveTo(STONE.x0, STONE.yb); tg.lineTo(STONE.x1, STONE.yb); tg.lineTo(STONE.x1 - 84, STONE.yb + 22); tg.lineTo(STONE.x0 - 96, STONE.yb + 22); tg.closePath(); tg.fill();
        });
        // 一块低矮的卧石：顶面受光略亮、朝向镜头的一面背光暗，右上缘一线金边
        {
          g.save(); g.translate(AX, 0);
          const { x0, x1, yb, h } = STONE, w = x1 - x0, top = yb - h;
          const rock = new Path2D();
          rock.moveTo(x0, yb);
          rock.bezierCurveTo(x0 - 3, yb - h * 0.5, x0 + w * 0.12, top + 1, x0 + w * 0.38, top);
          rock.bezierCurveTo(x0 + w * 0.6, top - 2, x0 + w * 0.88, top + 2, x1 - 2, yb - h * 0.45);
          rock.bezierCurveTo(x1 + 2, yb - h * 0.2, x1, yb, x1 - 4, yb);
          rock.closePath();
          g.fillStyle = '#4a3e33'; g.fill(rock);
          g.save(); g.clip(rock);
          const tg2 = g.createLinearGradient(0, top, 0, top + h * 0.55);
          tg2.addColorStop(0, 'rgba(150,126,96,0.9)'); tg2.addColorStop(1, 'rgba(150,126,96,0)');
          g.fillStyle = tg2; g.fillRect(x0 - 4, top - 4, w + 8, h * 0.6);
          g.strokeStyle = 'rgba(40,32,26,0.45)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x0 + w * 0.3, top + 5); g.quadraticCurveTo(x0 + w * 0.36, yb - 6, x0 + w * 0.3, yb); g.stroke();
          g.restore();
          g.strokeStyle = 'rgba(242,196,124,0.85)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x0 + w * 0.45, top - 0.5); g.bezierCurveTo(x0 + w * 0.65, top - 1.5, x0 + w * 0.88, top + 2.5, x1 - 2.5, yb - h * 0.45); g.stroke();
          g.restore();
        }
      });
    }
    // 亭子正立面剪影（含逆光金边）
    function pavilionPath() {
      const p = new Path2D();
      // 台基与台阶
      p.rect(150, 600, 580, 30);
      p.rect(372, 630, 136, 12);
      // 柱础与柱
      for (const px of PX) {
        p.rect(px - 18, 586, 36, 14);
        p.rect(px - PW / 2, 226, PW, 362);
      }
      // 额枋、平板枋、斗拱带（实心）
      p.rect(194, 206, 492, 24);
      p.rect(184, 180, 512, 27);
      // 挂落外框
      p.rect(IN.x0, 228, IN.x1 - IN.x0, 4);
      p.rect(IN.x0, 246, IN.x1 - IN.x0, 3);
      // 雀替（柱头两侧的三角托）
      p.moveTo(IN.x0, 249); p.lineTo(IN.x0 + 38, 249); p.quadraticCurveTo(IN.x0 + 12, 254, IN.x0, 276); p.closePath();
      p.moveTo(IN.x1, 276); p.quadraticCurveTo(IN.x1 - 12, 254, IN.x1 - 38, 249); p.lineTo(IN.x1, 249); p.closePath();
      // 石凳：放在亭内略靠后（进深 0.9），凳脚立在亭内地面上
      p.rect(BENCH.x0, BENCH.y0, BENCH.x1 - BENCH.x0, BENCH.th);
      for (const lx of BENCH.legs) p.rect(lx, BENCH.y0 + BENCH.th, BENCH.lw, BENCH.yb - BENCH.y0 - BENCH.th);
      // 檐口：两端起翘
      // 屋面：自檐角内凹上收到正脊（与矩形同为顺时针，非零填充不留洞）
      p.moveTo(104, 124);
      p.quadraticCurveTo(204, 136, 276, 72);
      p.lineTo(604, 72);
      p.quadraticCurveTo(676, 136, 776, 124);
      for (let x = 772; x >= 108; x -= 4) p.lineTo(x, EAVE(x) + 0.5);
      p.closePath();
      // 正脊与两端吻兽（简化成上翘的卷尾）
      p.rect(268, 60, 344, 16);
      p.moveTo(268, 76); p.quadraticCurveTo(250, 66, 252, 40); p.quadraticCurveTo(266, 48, 278, 60); p.closePath();
      p.moveTo(602, 60); p.quadraticCurveTo(614, 48, 628, 40); p.quadraticCurveTo(630, 66, 612, 76); p.closePath();
      return p;
    }
    // 一点透视：视平线在对岸水线 HZ，灭点在亭中轴 x=440；k 为进深缩放（1 = 前檐柱所在的立面）
    const VPX = 440;
    const persp = (x, y, k) => [VPX + (x - VPX) * k, HZ + (y - HZ) * k];
    const BK = 0.7;        // 后檐柱所在立面的缩放
    const BENCH = (() => {
      const k = 0.9, P = (x, y) => persp(x, y, k);
      const [x0, y0] = P(300, 538), [x1] = P(580, 538), [, yb] = P(300, 600);
      return { x0, x1, y0, yb, th: 13 * k, lw: 24 * k, legs: [P(322, 0)[0], P(534, 0)[0]] };
    })();
    // 亭内进深：天花（屋面下侧）、后檐柱与后额枋、亭内地面；都在前立面剪影之后，逆光里偏亮偏淡
    function interiorTex(g) {
      const BKC = '#5c5148';
      const [bx0, by0] = persp(PX[0], 230, BK), [bx1] = persp(PX[1], 230, BK), [, byb] = persp(PX[0], 600, BK);
      const bpw = PW * BK;
      // 亭内地面：前沿就是台基上沿，后沿在后檐柱脚；逆光下石面带一层暖光
      const [fx0, fy0] = persp(150, 600, BK), [fx1] = persp(730, 600, BK);
      const fg = g.createLinearGradient(0, fy0, 0, 600);
      fg.addColorStop(0, '#9a8468'); fg.addColorStop(1, '#6e5c49');
      g.fillStyle = fg;
      g.beginPath(); g.moveTo(150, 600); g.lineTo(fx0, fy0); g.lineTo(fx1, fy0); g.lineTo(730, 600); g.closePath(); g.fill();
      // 铺地石缝：横缝渐密、竖缝指向灭点
      g.save(); g.clip();
      g.strokeStyle = 'rgba(60,50,40,0.28)'; g.lineWidth = 0.8;
      g.beginPath();
      for (const yy of [fy0 + 6, fy0 + 14, fy0 + 24]) { g.moveTo(100, yy); g.lineTo(780, yy); }
      for (let x = 150; x <= 730; x += 48) { const [ex, ey] = persp(x, 600, BK); g.moveTo(x, 600); g.lineTo(ex, ey); }
      g.stroke();
      // 后檐柱与石凳在地面上的影子：太阳在右后方低处，影子向左前方拉长
      g.fillStyle = 'rgba(40,32,26,0.32)';
      for (const xb of [bx0, bx1]) {
        g.beginPath(); g.moveTo(xb - bpw / 2, byb); g.lineTo(xb + bpw / 2, byb); g.lineTo(xb + bpw / 2 - 118, 600); g.lineTo(xb - bpw / 2 - 128, 600); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(40,32,26,0.26)';
      g.beginPath(); g.moveTo(BENCH.x0, BENCH.yb); g.lineTo(BENCH.x1, BENCH.yb); g.lineTo(BENCH.x1 - 40, 600); g.lineTo(BENCH.x0 - 46, 600); g.closePath(); g.fill();
      g.restore();
      // 天花：屋面下侧，前额枋下沿到后额枋上沿；暗、向后略亮，椽子指向灭点
      const [, bly0] = persp(0, 206, BK);
      const [lx0] = persp(194, 0, BK), [lx1] = persp(686, 0, BK);
      const cg = g.createLinearGradient(0, 249, 0, bly0);
      cg.addColorStop(0, '#2a241f'); cg.addColorStop(1, '#3f362e');
      g.fillStyle = cg;
      g.beginPath(); g.moveTo(IN.x0 - 4, 249); g.lineTo(IN.x1 + 4, 249); g.lineTo(lx1, bly0 + 0.5); g.lineTo(lx0, bly0 + 0.5); g.closePath(); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(20,16,13,0.5)'; g.lineWidth = 1;
      g.beginPath();
      for (let x = IN.x0 + 10; x < IN.x1; x += 18) { const [ex, ey] = persp(x, 249, BK); g.moveTo(x, 249); g.lineTo(ex, ey); }
      g.stroke();
      g.restore();
      // 后额枋与后挂落（浅一档）
      g.fillStyle = BKC; g.fillRect(lx0, bly0, lx1 - lx0, by0 - bly0);
      g.fillStyle = 'rgba(92,81,72,0.85)';
      const lat = new Path2D();
      for (let x = bx0; x < bx1 - 3; x += 22 * BK) lat.rect(x, by0, 1.8, 10);
      lat.rect(bx0, by0 + 9, bx1 - bx0, 1.8);
      g.fill(lat);
      // 后檐柱
      for (const xb of [bx0, bx1]) {
        g.fillStyle = BKC; g.fillRect(xb - bpw / 2, by0, bpw, byb - by0);
        g.fillStyle = 'rgba(242,196,124,0.55)'; g.fillRect(xb + bpw / 2 - 1.2, by0 + 4, 1.2, byb - by0 - 4);
        g.fillStyle = BKC; g.fillRect(xb - 13 * BK, byb - 10 * BK, 26 * BK, 10 * BK);
      }
    }
    // 檐口下沿：中段平直，两端起翘到檐角
    const EAVE = (x) => { const d = Math.max(0, Math.abs(x - 440) - 236) / 100; return 182 - 52 * Math.pow(Math.min(1, d), 2.3); };
    function pavilionTex() {
      return K.cache('ff1_a1_pav', 800, 660, 1, (g) => {
        const path = pavilionPath();
        // 亭内进深（在前立面之后）；柱间不再蒙一层暗/亮的方框，透过去看到的就是外面的天光水色
        interiorTex(g);
        // 挂落格心（镂空，透出后面的光）
        g.fillStyle = BODY;
        const lat = new Path2D();
        for (let x = IN.x0; x < IN.x1 - 4; x += 22) { lat.rect(x, 232, 2.5, 14); }
        for (let x = IN.x0 + 11; x < IN.x1 - 4; x += 22) { lat.rect(x - 6, 238, 12, 2.5); lat.rect(x - 1, 232, 2, 6); }
        g.fill(lat);
        // 金边：先整块填轮廓光色，再把向左下偏移的剪影用主色盖上（裁在原剪影内）
        g.save();
        g.clip(path);
        g.fillStyle = RIM; g.fillRect(0, 0, 800, 660);
        g.translate(-2.2, 1.2);
        g.fillStyle = BODY; g.fill(path);
        g.restore();
        // 屋面瓦垄与檐口瓦当：同色系的细微明暗
        g.save(); g.clip(path);
        g.strokeStyle = 'rgba(96,84,70,0.5)'; g.lineWidth = 1.3;
        for (let x = 140; x < 742; x += 9) {
          const x2 = x + (x - 440) * 0.16;
          g.beginPath(); g.moveTo(x, 80); g.quadraticCurveTo(x + (x - 440) * 0.05, 130, x2, EAVE(x2) - 10); g.stroke();
        }
        // 檐口：飞椽与瓦当一线
        g.fillStyle = 'rgba(22,18,15,0.6)';
        g.beginPath(); g.moveTo(106, 126); for (let x = 108; x <= 772; x += 4) g.lineTo(x, EAVE(x) - 7); g.lineTo(774, 127);
        for (let x = 772; x >= 108; x -= 4) g.lineTo(x, EAVE(x) - 3); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(96,84,70,0.55)'; g.lineWidth = 1;
        for (let x = 150; x < 732; x += 11) { const y = EAVE(x); g.beginPath(); g.arc(x, y - 1, 2.8, 0, Math.PI); g.stroke(); }
        // 斗拱：实心带上浅一档的拱块
        g.fillStyle = 'rgba(88,76,64,0.55)';
        for (let x = 196; x <= 676; x += 30) { g.fillRect(x, 184, 18, 7); g.fillRect(x + 4, 191, 10, 8); }
        g.fillStyle = 'rgba(20,16,14,0.45)'; g.fillRect(184, 199, 512, 2);
        // 柱身左暗右亮的圆柱感
        for (const px of PX) {
          const cg = g.createLinearGradient(px - PW / 2, 0, px + PW / 2, 0);
          cg.addColorStop(0, 'rgba(20,16,14,0.35)'); cg.addColorStop(0.7, 'rgba(70,58,48,0.15)'); cg.addColorStop(1, 'rgba(70,58,48,0)');
          g.fillStyle = cg; g.fillRect(px - PW / 2, 228, PW - 2, 358);
        }
        // 台基石缝
        g.strokeStyle = 'rgba(80,70,60,0.45)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(150, 615); g.lineTo(730, 615);
        for (let x = 190; x < 730; x += 64) { g.moveTo(x, 600); g.lineTo(x, 615); g.moveTo(x + 32, 615); g.lineTo(x + 32, 630); }
        g.stroke();
        // 匾额：深色木匾，只有边框，不写字
        g.fillStyle = '#2c2621'; g.fillRect(400, 186, 80, 32);
        g.strokeStyle = 'rgba(160,128,84,0.45)'; g.lineWidth = 1.5; g.strokeRect(403, 189, 74, 26);
        g.restore();
        // 屋面与檐角迎光（右）一侧再描一道 1–2px 暖色轮廓光（瓦垄、檐口细节画完后补上，不被盖掉）
        {
          const t2 = document.createElement('canvas'), sc = g.getTransform().a;
          t2.width = Math.round(800 * sc); t2.height = Math.round(200 * sc);
          const rg = t2.getContext('2d'); rg.scale(sc, sc);
          rg.fillStyle = '#f6cf8c'; rg.fill(path);
          rg.globalCompositeOperation = 'destination-out';
          rg.translate(-1.7, 1.1); rg.fill(path); rg.setTransform(sc, 0, 0, sc, 0, 0);
          rg.globalCompositeOperation = 'destination-in';
          const hg = rg.createLinearGradient(430, 0, 700, 0);
          hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.95)');
          rg.fillStyle = hg; rg.fillRect(0, 0, 800, 183);
          g.drawImage(t2, 0, 0, 800, 200);
        }
      });
    }
    // 合并的静态层：远景（天、对岸山、水）与近景（地面、亭）各一张，减少大图贴图次数
    function backTex() {
      return K.cache('ff1_a1_back', W + 60, NB + 6, 1, (g) => {
        g.drawImage(skyTex(), 0, 0, W + 60, 500);
        g.drawImage(waterTex(), 0, HZ, W + 60, 130);
        g.drawImage(farTex(), 0, HZ - 100, W + 60, 120);
      });
    }
    function frontTex() {
      return K.cache('ff1_a1_front', W + 60, H, 1, (g) => {
        g.drawImage(groundTex(), 0, NB - 8, W + 60, H - NB + 10);
        g.drawImage(pavilionTex(), 20, 0, 800, 660);
      });
    }
    // 光柱：低斜阳从亭后右侧檐下射进亭内，穿过前檐的开间，向左下一直落到亭前地面；不裁成方框，两端柔和收住
    const BX0 = 0, BY0b = 150, BW = 800, BHb = 570;
    const BEAMS = [
      { x: 604, y: 318, w: 52, a: 0.5 },
      { x: 540, y: 320, w: 30, a: 0.36 },
      { x: 640, y: 300, w: 40, a: 0.42 },
    ];
    const BLEN = 570;
    const BDIR = (() => { const dx = -0.78, dy = 0.63, n = Math.hypot(dx, dy); return [dx / n, dy / n]; })();
    const beamHalf = (b, along) => b.w * (0.5 + 0.45 * along / BLEN);
    function beamTex() {
      return K.cache('ff1_a1_beam2', BW, BHb, 1, (g) => {
        g.translate(-BX0, -BY0b);
        blurInto(g, BW, BHb, 10, (tg) => {
          tg.translate(-BX0, -BY0b);
          // 光进来的地方（后檐下右侧）空气最亮：压扁的柔光团
          tg.save(); tg.translate(610, 314); tg.scale(1, 0.55);
          const sg = tg.createRadialGradient(0, 0, 0, 0, 0, 170);
          sg.addColorStop(0, 'rgba(255,230,170,0.32)'); sg.addColorStop(1, 'rgba(255,230,170,0)');
          tg.fillStyle = sg; tg.fillRect(-170, -170, 340, 340); tg.restore();
          for (const b of BEAMS) {
            const ex = b.x + BDIR[0] * BLEN, ey = b.y + BDIR[1] * BLEN;
            const nx = -BDIR[1], ny = BDIR[0];
            const gr = tg.createLinearGradient(b.x, b.y, ex, ey);
            gr.addColorStop(0, 'rgba(255,222,156,0)');
            gr.addColorStop(0.07, `rgba(255,222,156,${b.a})`);
            gr.addColorStop(0.35, `rgba(255,216,146,${(b.a * 0.8).toFixed(3)})`);
            gr.addColorStop(0.68, `rgba(255,212,140,${(b.a * 0.5).toFixed(3)})`);
            gr.addColorStop(0.9, `rgba(255,212,140,${(b.a * 0.22).toFixed(3)})`);
            gr.addColorStop(1, 'rgba(255,212,140,0)');
            tg.fillStyle = gr;
            const h0 = beamHalf(b, 0), h1 = beamHalf(b, BLEN);
            tg.beginPath();
            tg.moveTo(b.x + nx * h0, b.y + ny * h0);
            tg.lineTo(ex + nx * h1, ey + ny * h1);
            tg.lineTo(ex - nx * h1, ey - ny * h1);
            tg.lineTo(b.x - nx * h0, b.y - ny * h0);
            tg.closePath(); tg.fill();
          }
        });
        // 光柱落到亭前地面：一片拉长的暖色光斑（在柱影之间，柔边）
        blurInto(g, BW, BHb, 9, (tg) => {
          tg.translate(-BX0, -BY0b);
          tg.save(); tg.translate(150, 668); tg.rotate(-0.16); tg.scale(1, 0.2);
          const pg = tg.createRadialGradient(0, 0, 0, 0, 0, 120);
          pg.addColorStop(0, 'rgba(255,214,150,0.26)'); pg.addColorStop(1, 'rgba(255,214,150,0)');
          tg.fillStyle = pg; tg.fillRect(-120, -120, 240, 240); tg.restore();
        });
        // 光柱经过柱、凳、台基前方时只剩一半亮（光在它们前面的空气里，不把实体洗白）
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fill(pavilionPath());
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 光柱强度（用来决定浮尘亮度）
    function beamAt(x, y) {
      // 光柱所在区域四边柔和收住（浮尘靠近边缘时淡出，不突然消失）
      const win = clamp((x - 30) / 30) * clamp((IN.x1 - 2 - x) / 16) * clamp((y - 296) / 24) * clamp((712 - y) / 40);
      if (win <= 0) return 0;
      let s = 0;
      for (const b of BEAMS) {
        const rx = x - b.x, ry = y - b.y;
        const along = rx * BDIR[0] + ry * BDIR[1];
        if (along < 0) continue;
        const across = Math.abs(rx * -BDIR[1] + ry * BDIR[0]);
        const half = beamHalf(b, along) + 8;
        const lon = clamp(along / 40) * clamp(1 - along / BLEN);
        s += b.a * lon * clamp(1 - across / half);
      }
      return Math.min(1, s * 2.2) * win;
    }
    // 浮尘贴图：实心亮核 + 柔光晕
    function moteTex() {
      return K.cache('ff1_a1_mote2', 16, 16, 3, (g) => {
        const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
        gr.addColorStop(0, 'rgba(255,250,232,1)'); gr.addColorStop(0.2, 'rgba(255,248,226,0.95)'); gr.addColorStop(0.3, 'rgba(255,238,200,0.45)');
        gr.addColorStop(0.6, 'rgba(255,232,186,0.12)'); gr.addColorStop(1, 'rgba(255,232,186,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
      });
    }
    const DEG0 = Math.PI / 180;
    // 平滑起步的风速积分：∫ smoothstep
    const sInt = (u) => (u <= 0 ? 0 : u < 1 ? u * u * u - u * u * u * u / 2 : u - 0.5);
    // 浮尘：大多撒在光柱里（沿光柱取位置），少量散在柱间
    const MOTES = (() => {
      const r = rng(771), out = [];
      for (let i = 0; i < 210; i++) {
        let x, y;
        if (i < 180) {
          const b = BEAMS[i % 3], along = 30 + Math.pow(r(), 1.2) * 470, half = beamHalf(b, along);
          const ac = (r() - 0.5) * 2 * half * 0.9;
          x = b.x + BDIR[0] * along - BDIR[1] * ac; y = b.y + BDIR[1] * along + BDIR[0] * ac;
        } else { x = IN.x0 + 10 + r() * (IN.x1 - IN.x0 - 20); y = IN.y0 + 20 + r() * (IN.y1 - IN.y0 - 40); }
        // 第2句第5字起的斜流：方向 −15°…−40°（向右上），速度 45–70 px/s
        const ang = -(15 + 25 * r()) * DEG0;
        out.push({ x, y, s: 6 + r() * 6, v: 20 + r() * 20, rise: 2 + r() * 4, ph: r() * TAU, f: 0.3 + r() * 0.5, b: 0.3 + 0.7 * Math.pow(r(), 1.6), d: r(),
          sv: 45 + r() * 25, sx: Math.cos(ang), sy: Math.sin(ang), tf: 1.2 + r() * 1.4 });
      }
      return out;
    })();
    // 芦苇（左下前景）：近处的高、深、从画框下方长出；远处的矮、淡
    const REEDS = (() => {
      const r = rng(881), out = [];
      for (let i = 0; i < 42; i++) {
        const near = i < 16;
        // 远处矮芦苇只长在台基左侧（背后是水面，茎看得清）
        const x = near ? -30 + r() * 300 : 4 + Math.pow(r(), 0.9) * 146;
        const y = near ? 724 + r() * 30 : 652 + r() * 40;
        const h = near ? 170 + r() * 110 - (x > 180 ? (x - 180) * 0.6 : 0) : 55 + r() * 70 - x * 0.08;
        out.push({ x, y, h, near: near ? 1 : 0.35 + r() * 0.3, w: near ? 1.8 + r() * 1 : 0.9 + r() * 0.6, lean: (r() - 0.45) * 0.16, curl: (r() - 0.5) * 0.12,
          ph: r() * TAU, plume: r() < 0.9, nl: near ? 3 : 2, ls: r() < 0.5 ? -1 : 1, seed: i, dr: r() });
      }
      out.sort((a, b) => a.near - b.near);
      return out;
    })();
    function drawReeds(g, t, front) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const R of REEDS) {
        // 风到之后：整体顺风弯下，叠加向右传播的波（波长约 180px）
        const arrive = smooth((front - R.x) / 160);
        const wave = 0.6 + 0.4 * Math.sin(TAU * (R.x - WIND_V * (t - 3.48)) / 180);
        const idle = 0.01 * Math.sin(t * 0.8 + R.ph) + 0.006 * Math.sin(t * 1.9 + R.ph * 2);
        const bend = R.lean + idle + arrive * (0.16 + 0.16 * wave) * (0.75 + 0.25 * R.near);
        const L = R.h;
        // 茎：越往上弯得越多
        const tx = R.x + Math.sin(bend + R.curl) * L, ty = R.y - Math.cos(bend + R.curl) * L * 0.98;
        const cx = R.x + Math.sin(bend * 0.3) * L * 0.5, cy = R.y - L * 0.52;
        const col = R.near >= 1 ? '#221c17' : R.near > 0.5 ? '#3a3029' : '#4a3d33';
        g.strokeStyle = col; g.lineWidth = R.w;
        g.beginPath(); g.moveTo(R.x, R.y); g.quadraticCurveTo(cx, cy, tx, ty); g.stroke();
        // 叶：带状、渐尖；从茎上斜出后受重力下弯，风大时整片转向下风（平滑转过，不打卷）
        g.fillStyle = col;
        g.beginPath();
        for (let k = 0; k < R.nl; k++) {
          const u = 0.3 + k * 0.2;
          const bx = (1 - u) * (1 - u) * R.x + 2 * u * (1 - u) * cx + u * u * tx;
          const by = (1 - u) * (1 - u) * R.y + 2 * u * (1 - u) * cy + u * u * ty;
          const side = (k % 2 ? -1 : 1) * R.ls;
          const ll = L * (0.28 + 0.06 * k);
          const wv = arrive * (0.5 + 0.3 * wave);
          const th0 = lerp(side * (0.5 + 0.12 * k) + bend * 0.8, 1.25, wv * 0.9);
          const th1 = th0 + 0.9 * Math.tanh(3 * th0) * (1 - 0.4 * wv) + 0.5 * wv;
          const p1x = bx + Math.sin(th0) * ll * 0.5, p1y = by - Math.cos(th0) * ll * 0.5;
          const p2x = p1x + Math.sin(th1) * ll * 0.5, p2y = p1y - Math.cos(th1) * ll * 0.5;
          const lw = R.w * 1.6 + 1;
          const NS = 8, lx = [], ly = [], nx = [], ny = [];
          for (let j = 0; j <= NS; j++) {
            const v = j / NS, iv = 1 - v;
            lx.push(iv * iv * bx + 2 * v * iv * p1x + v * v * p2x); ly.push(iv * iv * by + 2 * v * iv * p1y + v * v * p2y);
            const dx = 2 * iv * (p1x - bx) + 2 * v * (p2x - p1x), dy = 2 * iv * (p1y - by) + 2 * v * (p2y - p1y), dn = Math.hypot(dx, dy) || 1;
            nx.push(-dy / dn); ny.push(dx / dn);
          }
          const hw = (j) => 0.5 * lw * Math.min(1, (j / NS) * 5) * Math.pow(1 - j / NS, 0.8) + 0.3;
          g.moveTo(lx[0] + nx[0] * hw(0), ly[0] + ny[0] * hw(0));
          for (let j = 1; j <= NS; j++) g.lineTo(lx[j] + nx[j] * hw(j), ly[j] + ny[j] * hw(j));
          for (let j = NS; j >= 0; j--) g.lineTo(lx[j] - nx[j] * hw(j), ly[j] - ny[j] * hw(j));
          g.closePath();
        }
        g.fill();
        // 茎的迎光一侧（右）一线金边
        g.strokeStyle = R.near >= 1 ? 'rgba(242,196,124,0.32)' : 'rgba(242,196,124,0.42)'; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(R.x + R.w * 0.45, R.y); g.quadraticCurveTo(cx + R.w * 0.45, cy, tx + R.w * 0.4, ty); g.stroke();
        // 穗：下垂的羽状圆锥花序——穗轴从茎梢顺风弯下，细绒多在下侧与下风侧，向梢渐短
        if (R.plume) drawPlume(g, R, tx, ty, Math.atan2(tx - cx, cy - ty), L, arrive, wave, idle);
      }
    }
    // 芦花种子：风到后从几株近处芦苇的穗上脱落，随风向右飘过光柱（第2句起，共 5 粒）
    const reedTip = (R, t, front) => {
      const arrive = smooth((front - R.x) / 160);
      const wave = 0.6 + 0.4 * Math.sin(TAU * (R.x - WIND_V * (t - 3.48)) / 180);
      const idle = 0.01 * Math.sin(t * 0.8 + R.ph) + 0.006 * Math.sin(t * 1.9 + R.ph * 2);
      const bend = R.lean + idle + arrive * (0.16 + 0.16 * wave) * (0.75 + 0.25 * R.near);
      const tx = R.x + Math.sin(bend + R.curl) * R.h, ty = R.y - Math.cos(bend + R.curl) * R.h * 0.98;
      const pl = R.h * 0.23;
      return [tx + pl * 0.45, ty + pl * 0.3];
    };
    const SEEDS = (() => {
      const cand = REEDS.filter((R) => R.near >= 1 && R.plume && R.x > 40 && R.x < 260).sort((a, b) => a.x - b.x);
      const out = [];
      for (let k = 0; k < 5 && cand.length; k++) {
        const R = cand[Math.min(cand.length - 1, Math.floor((k + 0.5) * cand.length / 5))];
        out.push({ R, d: 0.15 + 0.32 * k + 0.12 * h2(k, 71), vw: 118 + 46 * h2(k, 72), rise: 6 + 12 * h2(k, 73),
          f: 2.2 + 1.6 * h2(k, 74), ph: TAU * h2(k, 75), sz: 5 + 2 * h2(k, 76), spin: (h2(k, 77) - 0.5) * 2.4 });
      }
      return out;
    })();
    function drawSeeds(g, t, tQiu, toBeam) {
      const mt = moteTex();
      for (const S of SEEDS) {
        const ts = tQiu + S.R.x / WIND_V + 0.25 + S.d;
        const tau = t - ts;
        if (tau <= 0) continue;
        const [x0, y0] = reedTip(S.R, ts, WIND_V * (ts - tQiu));
        const k = 0.35, ramp = 1 - Math.exp(-tau / 0.5);
        const x = x0 + S.vw * (tau - k * (1 - Math.exp(-tau / k))) + 3 * Math.sin(tau * S.f * 0.7 + S.ph * 2) * ramp;
        const y = y0 - S.rise * tau + 6 * Math.sin(tau * S.f + S.ph) * ramp;
        const a = smooth(tau / 0.4) * smooth((880 - x) / 90);
        if (a < 0.01) continue;
        const lit = toBeam ? toBeam(x, y) : 0;
        // 冠毛：细梗上一圈放射状细绒
        g.save(); g.translate(x, y); g.rotate(S.spin * tau + S.ph);
        g.strokeStyle = `rgba(252,240,214,${(a * (0.72 + 0.28 * lit)).toFixed(3)})`; g.lineWidth = 0.8;
        g.beginPath();
        for (let j = 0; j < 7; j++) { const an = -Math.PI * 0.85 + j * Math.PI * 0.28; g.moveTo(0, 0); g.lineTo(Math.cos(an) * S.sz, Math.sin(an) * S.sz); }
        g.moveTo(0, 0); g.lineTo(0, S.sz * 0.7);
        g.stroke();
        g.restore();
        {
          // 逆光里冠毛自带一圈淡淡的亮晕，进了光柱更亮
          const op = g.globalCompositeOperation; g.globalCompositeOperation = 'screen';
          g.globalAlpha = clamp((0.22 + 0.7 * lit) * a);
          const r = S.sz * 2.2;
          g.drawImage(mt, x - r, y - r, r * 2, r * 2);
          g.globalAlpha = 1; g.globalCompositeOperation = op;
        }
      }
    }
    const DEG = Math.PI / 180;
    function drawPlume(g, R, tx, ty, a0, L, arrive, wave, idle) {
      const near = R.near >= 1;
      const pl = L * (near ? 0.23 : 0.26);
      const wv = arrive * (0.55 + 0.45 * wave);
      // 梢端低于水平 35–50°，风到后再压低约 15°
      const aEnd = Math.PI / 2 + (35 + 15 * R.dr) * DEG + wv * 15 * DEG + idle * 3;
      const N = 8, ds = pl / N;
      const px = [tx], py = [ty], pa = [a0];
      let x = tx, y = ty;
      for (let k = 1; k <= N; k++) {
        const u = k / N, th = a0 + (aEnd - a0) * (1 - Math.pow(1 - u, 1.8));
        x += Math.sin(th) * ds; y -= Math.cos(th) * ds;
        px.push(x); py.push(y); pa.push(th);
      }
      const at = (u) => {
        const f = clamp(u) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i;
        return [lerp(px[i], px[i + 1], k), lerp(py[i], py[i + 1], k), lerp(pa[i], pa[i + 1], k)];
      };
      // 柔和的泪滴形穗体（偏下侧）
      const wid = (u) => pl * 0.12 * Math.sin(Math.PI * Math.pow(u, 0.7));
      g.fillStyle = near ? 'rgba(250,222,166,0.17)' : 'rgba(250,222,166,0.14)';
      g.beginPath();
      for (let k = 0; k <= N; k++) { const w = wid(k / N), th = pa[k]; g.lineTo(px[k] - Math.cos(th) * w * 0.6, py[k] - Math.sin(th) * w * 0.6); }
      for (let k = N; k >= 0; k--) { const w = wid(k / N), th = pa[k]; g.lineTo(px[k] + Math.cos(th) * w * 1.3, py[k] + Math.sin(th) * w * 1.3); }
      g.closePath(); g.fill();
      // 细绒：自穗轴向前斜出，下侧多、上侧少而短；略受重力下弯，风到后梢顺风
      const n = near ? 22 : 15;
      g.beginPath();
      for (let k = 0; k < n; k++) {
        const hk = R.seed * 41 + k;
        const u = clamp((k + 0.3 + 0.4 * h2(hk, 3)) / n);
        const [bx, by, th] = at(u);
        const side = h2(hk, 4) < 0.74 ? 1 : -1;
        const phi = (24 + 26 * h2(hk, 5)) * DEG;
        const fl = pl * (0.2 + 0.14 * h2(hk, 6)) * (1 - 0.62 * u) * (side < 0 ? 0.6 : 1);
        const dx = Math.sin(th), dy = -Math.cos(th), nx = Math.cos(th) * side, ny = Math.sin(th) * side;
        const hx = dx * Math.cos(phi) + nx * Math.sin(phi), hy = dy * Math.cos(phi) + ny * Math.sin(phi);
        const ex = bx + hx * fl + wv * fl * 0.3, ey = by + hy * fl + fl * 0.16;
        g.moveTo(bx, by); g.quadraticCurveTo(bx + hx * fl * 0.55, by + hy * fl * 0.55, ex, ey);
      }
      g.strokeStyle = near ? 'rgba(248,224,176,0.45)' : 'rgba(248,224,176,0.34)';
      g.lineWidth = near ? 0.8 : 0.6;
      g.stroke();
      // 穗轴与迎光一侧的 1px 亮边
      g.beginPath(); g.moveTo(px[0], py[0]); for (let k = 1; k <= N; k++) g.lineTo(px[k], py[k]);
      g.strokeStyle = 'rgba(112,90,66,0.7)'; g.lineWidth = near ? 0.8 : 0.6; g.stroke();
      g.beginPath(); g.moveTo(px[0] + 0.9, py[0] - 0.3); for (let k = 1; k <= N; k++) g.lineTo(px[k] + 0.9, py[k] - 0.4);
      g.strokeStyle = 'rgba(255,236,196,0.5)'; g.lineWidth = 0.8; g.stroke();
    }
    // 风铃：铜钟、钟舌、风摆，绕悬挂点摆动
    function drawBell(g, ang, ang2) {
      g.save();
      g.translate(BELL[0], BELL[1]);
      g.rotate(ang);
      g.scale(1.7, 1.7);
      g.strokeStyle = '#2c2621'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 9); g.stroke();
      // 钟身
      g.fillStyle = '#5e4f40';
      g.beginPath();
      g.moveTo(-3, 9); g.quadraticCurveTo(-7, 11, -7.5, 22); g.lineTo(-9, 27); g.lineTo(9, 27); g.lineTo(7.5, 22); g.quadraticCurveTo(7, 11, 3, 9); g.closePath();
      g.fill();
      g.fillStyle = 'rgba(242,196,124,0.75)';
      g.beginPath(); g.moveTo(5, 11); g.quadraticCurveTo(7.2, 14, 7.6, 22); g.lineTo(8.8, 26.5); g.lineTo(7.4, 26.5); g.lineTo(6.2, 22); g.quadraticCurveTo(6, 15, 4, 11); g.closePath(); g.fill();
      g.fillStyle = '#3b3129'; g.fillRect(-9, 26, 18, 2);
      // 钟舌与风摆（第二节摆，略滞后）
      g.translate(0, 24);
      g.rotate(ang2 - ang);
      g.strokeStyle = '#2c2621'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.stroke();
      g.fillStyle = '#3b3129'; g.beginPath(); g.arc(0, 6, 2, 0, TAU); g.fill();
      g.fillStyle = '#6a5845';
      g.beginPath(); g.moveTo(0, 15); g.quadraticCurveTo(7, 20, 4.5, 31); g.lineTo(0, 34); g.lineTo(-4.5, 31); g.quadraticCurveTo(-7, 20, 0, 15); g.closePath(); g.fill();
      g.fillStyle = 'rgba(242,196,124,0.6)';
      g.beginPath(); g.moveTo(1.5, 17); g.quadraticCurveTo(6, 21, 4, 30); g.lineTo(3, 30); g.quadraticCurveTo(4.5, 22, 1, 18); g.closePath(); g.fill();
      g.restore();
    }

    XYT.registerShot('a1_pavilion', {
      name: '\u957f\u4ead\u79cb\u98ce', zone: 'right', night: false, text: '#2a2622', shadow: 'rgba(252,242,222,0.9)', accent: '#b4541e', bloom: 0.26,
      draw(g, c) {
        const t = c.lt, tc = Math.max(0, t);
        const ct = (k) => { const v = c.charT ? c.charT(k, 1) : null; return v == null ? FALLBACK2[k] : v - (c.t - c.lt); };
        const tQiu = ct(0), tJuan = ct(3), tPiao = ct(4);
        // 镜头：第1句缓缓右移（≤20px/s），第2句静止；分层视差
        const cam = -40 * smooth(tc / 3.4);
        const front = WIND_V * (t - tQiu);  // 风前锋 x（世界坐标）
        const lay = (k) => cam * k;
        g.drawImage(backTex(), lay(0.3) - 20, 0, W + 60, NB + 6);
        // 风吹皱的水面：风前锋左侧变暗、起细纹；前缘柔和，远处（水线附近）淡
        if (front > -220) {
          const fx = front + lay(0.3);
          const op = clamp((t - tQiu) / 0.4);
          const sc = scratch('ff1_a1_ruf', W, 130), sg = sc.g;
          sg.translate(0, -HZ);
          sg.fillStyle = 'rgba(92,88,76,0.2)'; sg.fillRect(-10, HZ, fx + 10, 130);
          const rt = ruffleTex();
          const ph = ((t - tQiu) * 24) % 400;
          for (let x = -400 + ph; x < fx; x += 400) sg.drawImage(rt, x, HZ + 2, 400, 128);
          sg.globalCompositeOperation = 'destination-in';
          const hg = sg.createLinearGradient(fx - 200, 0, fx, 0);
          hg.addColorStop(0, '#000'); hg.addColorStop(1, 'rgba(0,0,0,0)');
          sg.fillStyle = hg; sg.fillRect(-10, HZ, W + 20, 130);
          const vg = sg.createLinearGradient(0, HZ, 0, HZ + 70);
          vg.addColorStop(0, 'rgba(0,0,0,0.1)'); vg.addColorStop(1, '#000');
          sg.fillStyle = vg; sg.fillRect(-10, HZ, W + 20, 130);
          g.globalAlpha = op;
          g.drawImage(sc.c, 0, HZ, W, 130);
          g.globalAlpha = 1;
        }
        // 近日处的水面碎光：只在歌词区下方，随时间缓慢闪烁（不突现）
        {
          const wx = lay(0.3);
          const op = g.globalCompositeOperation; g.globalCompositeOperation = 'screen';
          for (let i = 0; i < 46; i++) {
            const x = 880 + h2(i, 1) * 420 + wx, y = 530 + h2(i, 2) * 70;
            const tw = 0.5 + 0.5 * Math.sin(tc * (0.8 + h2(i, 3) * 1.4) + h2(i, 4) * TAU);
            const a = 0.32 * tw * tw * (0.5 + 0.5 * (x - 880) / 420) * (1 + 0.12 * beatEnv(c, 0.35));
            if (a < 0.01) continue;
            g.fillStyle = `rgba(255,236,190,${a.toFixed(3)})`;
            g.fillRect(x, y, 6 + h2(i, 5) * 14, 1.3);
          }
          g.globalCompositeOperation = op;
        }
        // 近岸地面（含柱影）
        g.drawImage(frontTex(), lay(1) - 20, 0, W + 60, H);
        // 亭子
        const px = lay(1);
        // 光柱（随拍亮度 ±8%）
        g.save();
        g.translate(px, 0);
        const op0 = g.globalCompositeOperation;
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = clamp(0.95 * (0.95 + 0.08 * beatEnv(c, 0.45) + 0.03 * Math.sin(tc * 0.7)));
        g.drawImage(beamTex(), BX0, BY0b, BW, BHb);
        g.globalAlpha = 1;
        // 浮尘：第1句缓缓上浮；风到之后向右漂；第2句第5字起被拉成斜向右上的流，飘出光柱即隐去
        const mt = moteTex();
        const beat = beatEnv(c, 0.4);
        for (const m of MOTES) {
          const ta = tQiu + (m.x - 0) / WIND_V;           // 风前锋到达此处
          const u1 = (t - ta) / 0.8;
          // 斜流：0.5s 内加速到 45–70 px/s，起步错开 ≤0.25s；叠加湍流
          const tb = tPiao + m.d * 0.25;
          const u2 = (t - tb) / 0.5;
          const r1 = smooth(u1), r2 = smooth(u2);
          const sd = m.sv * 0.5 * sInt(u2);
          const turb = 6 * r2;
          const x = m.x + 2.5 * Math.sin(t * m.f + m.ph) + m.v * 0.8 * sInt(u1) + 4 * Math.sin(t * 2.1 + m.ph * 3) * r1 + sd * m.sx
            + turb * Math.sin(t * m.tf * 2.2 + m.ph * 5);
          const y = m.y - m.rise * t + 2 * Math.sin(t * m.f * 1.3 + m.ph * 2) + 2.5 * Math.cos(t * 2.6 + m.ph) * r1 + sd * m.sy
            + turb * Math.cos(t * m.tf * 1.7 + m.ph * 3);
          const lit = beamAt(x, y);
          if (lit <= 0.02) continue;
          const tw = 0.8 + 0.2 * Math.sin(t * (1.5 + m.d) + m.ph);
          g.globalAlpha = clamp(0.92 * Math.sqrt(lit) * m.b * tw * (1 + 0.15 * beat * m.d) * clamp((t + 0.8) / 0.5));
          const s = m.s;
          g.drawImage(mt, x - s / 2, y - s / 2, s, s);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = op0;
        // 风铃：风到时先轻轻一偏；第2句第4字起明显摆动——平均偏角约 1s 内增到向右 7°，绕它 ±12° 摆，周期 1.6s；
        // 钟舌与风摆比钟身滞后 0.15s
        const DEG = Math.PI / 180;
        const tArr = tQiu + BELL[0] / WIND_V;
        const mean = 7 * DEG * smooth((t - (tJuan - 0.1)) / 1.0) + 0.8 * DEG * smooth((t - tArr) / 0.5);
        const amp = 12 * DEG * smooth((t - (tJuan - 0.05)) / 0.75) + 0.6 * DEG * smooth((t - tArr) / 0.5);
        const ph = (dt) => Math.sin(TAU * (t - tJuan - dt) / 1.6);
        const ang = -(mean + amp * ph(0)); // 向右偏：底端朝右
        const ang2 = -(mean * 1.1 + amp * 1.08 * ph(0.15));
        drawBell(g, ang, ang2);
        g.restore();
        // 前景芦苇（视差最快）
        g.save();
        g.translate(lay(1.3), 0);
        drawReeds(g, t, front - lay(1.3) + lay(1.3));
        drawSeeds(g, t, tQiu, (x, y) => beamAt(x + lay(1.3) - lay(1), y));
        g.restore();
        // 斜阳的暖色空气：右侧更亮
        const op1 = g.globalCompositeOperation;
        g.globalCompositeOperation = 'soft-light';
        const ag = g.createLinearGradient(0, 0, W, 0);
        ag.addColorStop(0, 'rgba(70,46,24,0.3)'); ag.addColorStop(0.6, 'rgba(200,150,90,0.18)'); ag.addColorStop(1, 'rgba(255,196,120,0.4)');
        g.fillStyle = ag; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = op1;
      },
    });
  })();
  // ============================================================
  // b1_bridge 伞落桥头：雨中石拱桥顶斜靠一把红伞；一阵风把它吹落河中，伞面朝上漂走
  // ============================================================
  (function () {
    const FALLBACK2 = [3.535, 3.915, 4.375, 4.735, 5.175, 5.555];
    const WL = 500;                 // 水面线（桥脚）
    const CX = 640, R = 170, RT = 22; // 拱心、拱半径、拱券厚
    const BANK = 476;               // 两岸街面
    const PH = 40;                  // 栏杆高（约齐腰）
    const SKY = '#c9cfd0', MID = '#8d989b', STONE = '#4d575c', DARK = '#2a3034', RED = '#c2372e';
    // 桥面：拱顶 y=300，向两岸下到街面
    const deck = (x) => { const u = Math.min(1, Math.abs(x - CX) / 340); return 300 + (BANK - 300) * Math.pow(u, 1.75); };
    const G_PX = 430;               // 有效重力（约 48px/m，略计空气阻力）
    // 伞：比原先大 12%（伞面直径约 54px，约 1.3 倍栏杆高——再大就和齐腰的栏杆比例不对了）
    const US = 1.12;
    const DEG1 = Math.PI / 180;
    // 局部坐标（伞面圆心为原点、伞轴向上）里的一点，按旋转角与缩放换到画面偏移
    const rotP = (px, py, th) => [(px * Math.cos(th) - py * Math.sin(th)) * US, (px * Math.sin(th) + py * Math.cos(th)) * US];
    // 伞的静靠：伞柄尖立在栏板下伸出的边石沿上（扶手下沿以下约 4px），伞向左斜 27°，
    // 伞柄贴着桥顶右侧那根望柱（x=735）的右棱，伞面压在栏杆与望柱头上；风从左来，正好把它从柱上掀开
    const POST_X = 735, POST_HW = 3.5;
    const ROT0 = -27 * DEG1;
    const U0 = (() => {
      const [ocx] = rotP(0, 8, ROT0), [otx, oty] = rotP(0, 34, ROT0);
      const cx = POST_X + POST_HW + 1.2 - ocx;           // 伞柄贴住望柱右棱
      const tipx = cx + otx, tipy = deck(tipx) + 4;      // 柄尖落在边石沿上
      const cy = tipy - oty;
      const [, ocy] = rotP(0, 8, ROT0);
      return { x: cx, y: cy, rot: ROT0, tipx, tipy, cy8: cy + ocy };
    })();
    function backTex() {
      return K.cache('ff1_b1_back', W, WL + 4, 1, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, WL);
        gr.addColorStop(0, '#b9c0c2'); gr.addColorStop(0.55, '#ccd2d2'); gr.addColorStop(1, '#d6dbda');
        g.fillStyle = gr; g.fillRect(0, 0, W, WL + 4);
        // 雨云：淡墨层
        blurInto(g, W, WL, 18, (tg) => {
          const r = rng(1201);
          for (let i = 0; i < 14; i++) {
            const x = r() * W, y = 30 + r() * 200, w = 160 + r() * 300;
            tg.fillStyle = `rgba(150,160,164,${(0.18 + r() * 0.16).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x, y, w, 26 + r() * 30, 0, 0, TAU); tg.fill();
          }
        });
        // 远山：两层极淡
        blurInto(g, W, WL, 3, (tg) => {
          const hill = (seed, base, amp, col, a) => {
            tg.beginPath(); tg.moveTo(0, WL);
            for (let x = 0; x <= W; x += 6) tg.lineTo(x, base - amp * (0.5 + 0.5 * fbm(x / 210, seed, 3)));
            tg.lineTo(W, WL); tg.closePath(); tg.fillStyle = rgba(col, a); tg.fill();
          };
          hill(31, 420, 70, '#a9b2b5', 0.5);
          hill(37, 452, 40, '#9aa4a8', 0.5);
        });
        // 远处临河人家：白墙黛瓦、马头墙，雨雾里很淡
        const house = (tg, x, base, w, h, hz) => {
          const wall = mix('#c4cacb', SKY, hz), roof = mix('#5a6468', SKY, hz);
          tg.fillStyle = wall; tg.fillRect(x, base - h, w, h);
          tg.fillStyle = roof;
          tg.fillRect(x - 2, base - h - 5, w + 4, 6);
          // 马头墙：两端阶梯状山墙
          const st = Math.max(6, w * 0.16);
          for (const sd of [0, 1]) {
            const ex = sd ? x + w - st : x;
            tg.fillStyle = wall; tg.fillRect(ex, base - h - 14, st, 14);
            tg.fillStyle = roof; tg.fillRect(ex - 1.5, base - h - 16, st + 3, 3);
          }
          tg.fillStyle = mix('#3d4549', SKY, hz);
          const nw = Math.floor(w / 18);
          for (let k = 0; k < nw; k++) tg.fillRect(x + 6 + k * 18, base - h * 0.62, 5, 7);
        };
        blurInto(g, W, WL, 1.2, (tg) => {
          const r = rng(1301);
          for (let row = 0; row < 2; row++) {
            const hz = row ? 0.72 : 0.55, base = row ? 462 : 476, s = row ? 0.62 : 1;
            for (const side of [-1, 1]) {
              let x = side < 0 ? 0 : 820;
              const xe = side < 0 ? 470 : W;
              while (x < xe) {
                const w = (34 + r() * 40) * s, h = (32 + r() * 26) * s;
                house(tg, x, base, w, h, hz);
                x += w + 2 + r() * 10;
              }
            }
          }
          // 拱洞里望去：更远的河道与人家
          for (let k = 0; k < 5; k++) {
            const x = 500 + k * 58 + r() * 20, w = 20 + r() * 16;
            house(tg, x, 468 + r() * 4, w, 14 + r() * 12, 0.86);
          }
        });
        // 水汽带
        const hz = g.createLinearGradient(0, 380, 0, WL);
        hz.addColorStop(0, 'rgba(214,219,218,0)'); hz.addColorStop(1, 'rgba(214,219,218,0.6)');
        g.fillStyle = hz; g.fillRect(0, 380, W, WL - 380 + 4);
      });
    }
    // 桥体正侧面（含拱券、石缝、栏杆、抱鼓石、薜荔）
    function bridgePath() {
      const p = new Path2D();
      p.moveTo(290, BANK);
      for (let x = 290; x <= 990; x += 5) p.lineTo(x, deck(x));
      p.lineTo(990, WL + 2); p.lineTo(CX + R, WL + 2);
      p.arc(CX, WL, R, 0, Math.PI, true);
      p.lineTo(290, WL + 2); p.closePath();
      return p;
    }
    function bridgeTex() {
      return K.cache('ff1_b1_bridge', W, WL + 4, 1, (g) => {
        // 两岸驳岸与街面
        const bankFill = (x0, x1) => {
          const gr = g.createLinearGradient(0, BANK, 0, WL);
          gr.addColorStop(0, '#5d686c'); gr.addColorStop(1, '#3a4347');
          g.fillStyle = gr; g.fillRect(x0, BANK, x1 - x0, WL - BANK + 4);
          g.fillStyle = 'rgba(214,220,220,0.5)'; g.fillRect(x0, BANK - 1, x1 - x0, 2.5); // 湿街沿映天光
          g.strokeStyle = 'rgba(30,36,40,0.4)'; g.lineWidth = 1;
          g.beginPath();
          for (let y = BANK + 8; y < WL; y += 8) { g.moveTo(x0, y); g.lineTo(x1, y); }
          for (let y = BANK; y < WL; y += 8) for (let x = x0 + ((y / 8) % 2) * 12; x < x1; x += 24) { g.moveTo(x, y); g.lineTo(x, y + 8); }
          g.stroke();
        };
        bankFill(0, 300); bankFill(980, W);
        const path = bridgePath();
        g.save(); g.clip(path);
        const gr = g.createLinearGradient(0, 290, 0, WL);
        gr.addColorStop(0, '#6a7579'); gr.addColorStop(0.5, '#5a6569'); gr.addColorStop(1, '#3d464a');
        g.fillStyle = gr; g.fillRect(280, 280, 720, 230);
        // 条石砌缝与石块色差
        const r = rng(1401);
        for (let y = 300; y < WL; y += 13) {
          let x = 290 - r() * 30;
          while (x < 990) {
            const w = 26 + r() * 30;
            g.fillStyle = `rgba(${r() < 0.5 ? '30,36,40' : '150,160,164'},${(0.04 + r() * 0.08).toFixed(3)})`;
            g.fillRect(x, y, w, 13);
            g.fillStyle = 'rgba(28,33,36,0.45)'; g.fillRect(x, y, 1, 13);
            x += w;
          }
          g.fillStyle = 'rgba(28,33,36,0.4)'; g.fillRect(280, y, 720, 1);
          g.fillStyle = 'rgba(190,198,200,0.12)'; g.fillRect(280, y + 1, 720, 1);
        }
        // 雨水冲刷的竖向水痕
        blurInto(g, W, WL + 4, 2, (tg) => {
          for (let i = 0; i < 40; i++) {
            const x = 300 + r() * 680, y0 = deck(x) + 8, l = 30 + r() * 120;
            tg.fillStyle = `rgba(30,36,40,${(0.08 + r() * 0.12).toFixed(3)})`;
            tg.fillRect(x, y0, 2 + r() * 5, l);
          }
          // 近水处的青苔
          for (let i = 0; i < 60; i++) {
            const x = 300 + r() * 680, y = WL - r() * 40;
            tg.fillStyle = `rgba(62,78,64,${(0.15 + r() * 0.2).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x, y, 6 + r() * 16, 3 + r() * 6, 0, 0, TAU); tg.fill();
          }
        });
        g.restore();
        // 拱券：放射状券石
        g.save();
        g.beginPath(); g.arc(CX, WL, R + RT, Math.PI, 0); g.arc(CX, WL, R, 0, Math.PI, true); g.closePath();
        g.fillStyle = '#626d71'; g.fill();
        g.clip();
        g.strokeStyle = 'rgba(28,33,36,0.6)'; g.lineWidth = 1.2;
        g.beginPath();
        for (let a = Math.PI; a <= TAU + 0.001; a += Math.PI / 26) {
          g.moveTo(CX + Math.cos(a) * R, WL + Math.sin(a) * R); g.lineTo(CX + Math.cos(a) * (R + RT), WL + Math.sin(a) * (R + RT));
        }
        g.stroke();
        g.strokeStyle = 'rgba(200,208,210,0.25)'; g.lineWidth = 1;
        g.beginPath(); g.arc(CX, WL, R + RT - 1, Math.PI, 0); g.stroke();
        g.restore();
        // 拱洞内侧的暗面（券底）
        g.save();
        g.beginPath(); g.arc(CX, WL, R, Math.PI, 0); g.closePath(); g.clip();
        const ig = g.createLinearGradient(0, WL - R, 0, WL - R + 26);
        ig.addColorStop(0, 'rgba(24,28,31,0.75)'); ig.addColorStop(1, 'rgba(24,28,31,0)');
        g.fillStyle = ig; g.fillRect(CX - R, WL - R, 2 * R, 30);
        g.restore();
        // 桥面边石
        g.beginPath();
        for (let x = 292; x <= 988; x += 5) { const y = deck(x); x === 292 ? g.moveTo(x, y) : g.lineTo(x, y); }
        for (let x = 988; x >= 292; x -= 5) g.lineTo(x, deck(x) + 9);
        g.closePath(); g.fillStyle = '#3e474b'; g.fill();
        // 栏板与望柱（顺着桥面起伏）
        const posts = [];
        for (let x = 312; x <= 970; x += 47) posts.push(x);
        for (let i = 0; i < posts.length - 1; i++) {
          const xa = posts[i] + 3.5, xb = posts[i + 1] - 3.5;
          g.beginPath();
          g.moveTo(xa, deck(xa) - PH + 6);
          for (let x = xa; x <= xb; x += 4) g.lineTo(x, deck(x) - PH + 6);
          g.lineTo(xb, deck(xb) - PH + 6);
          for (let x = xb; x >= xa; x -= 4) g.lineTo(x, deck(x));
          g.closePath();
          g.fillStyle = '#566165'; g.fill();
          // 栏板心：内框略亮
          g.beginPath();
          for (let x = xa + 5; x <= xb - 5; x += 4) g.lineTo(x, deck(x) - PH + 13);
          for (let x = xb - 5; x >= xa + 5; x -= 4) g.lineTo(x, deck(x) - 7);
          g.closePath();
          g.strokeStyle = 'rgba(170,180,182,0.35)'; g.lineWidth = 1; g.stroke();
          g.fillStyle = 'rgba(40,46,50,0.25)'; g.fill();
          // 扶手顶面映天光
          g.beginPath();
          for (let x = xa; x <= xb; x += 4) { const y = deck(x) - PH + 6; x === xa ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.strokeStyle = 'rgba(205,212,213,0.6)'; g.lineWidth = 1.6; g.stroke();
        }
        for (const x of posts) {
          const y = deck(x);
          g.fillStyle = '#4a5458'; g.fillRect(x - 3.5, y - PH - 2, 7, PH + 2);
          g.beginPath(); g.ellipse(x, y - PH - 3, 4.8, 4.2, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(205,212,213,0.55)'; g.fillRect(x - 3.5, y - PH - 6, 7, 1.4);
        }
        // 栏板下边石伸出的一道窄沿，湿面映天光
        g.beginPath();
        for (let x = 300; x <= 980; x += 4) { const y = deck(x) + 0.7; x === 300 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.strokeStyle = 'rgba(196,204,206,0.5)'; g.lineWidth = 1.3; g.stroke();
        // 抱鼓石
        for (const [x, d] of [[300, -1], [980, 1]]) {
          const y = deck(x);
          g.fillStyle = '#4a5458';
          g.beginPath(); g.arc(x + d * 8, y - 14, 13, 0, TAU); g.fill();
          g.fillRect(x - 6 + d * 2, y - 14, 14, 14);
          g.strokeStyle = 'rgba(190,198,200,0.35)'; g.beginPath(); g.arc(x + d * 8, y - 14, 8, 0, TAU); g.stroke();
        }
        // 薜荔：从栏杆下垂到拱肩的藤蔓
        blurInto(g, W, WL + 4, 0.6, (tg) => {
          const vine = (x0, len, seed) => {
            const rr = rng(seed);
            for (let k = 0; k < 9; k++) {
              const x = x0 + (rr() - 0.5) * 30, y = deck(x) + 6, l = len * (0.4 + rr() * 0.6);
              tg.strokeStyle = 'rgba(40,52,44,0.7)'; tg.lineWidth = 0.9;
              tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + (rr() - 0.5) * 8, y + l * 0.5, x + (rr() - 0.5) * 6, y + l); tg.stroke();
              for (let j = 0; j < l / 5; j++) {
                const yy = y + j * 5 + rr() * 3, xx = x + (rr() - 0.5) * 7;
                tg.fillStyle = `rgba(${52 + Math.floor(rr() * 20)},${70 + Math.floor(rr() * 20)},${56 + Math.floor(rr() * 10)},0.85)`;
                tg.beginPath(); tg.ellipse(xx, yy, 2.6, 1.7, rr() * 3, 0, TAU); tg.fill();
              }
            }
          };
          vine(452, 70, 21); vine(840, 56, 23); vine(360, 40, 25);
        });
      });
    }
    // 垂柳：树干、主枝与上部柳冠缓存；下垂的长柳条逐帧（根部系于固定锚点）
    const WILLOWS = [
      { x: 132, y: BANK, dir: 1, s: 1, seed: 51, x0: -30, x1: 318 },
      { x: 1156, y: BANK, dir: -1, s: 0.95, seed: 57, x0: 968, x1: 1320 },
    ];
    // 主枝：从干顶向上拱起再向外下垂的弧（二次曲线）
    function limbs(Wd) {
      const r = rng(Wd.seed);
      const top = [Wd.x + Wd.dir * 18 * Wd.s, Wd.y - 130 * Wd.s];
      const fork = [Wd.x + Wd.dir * 6 * Wd.s, Wd.y - 92 * Wd.s];
      const out = [];
      const spec = [[-1, 0.9, 1], [-0.45, 1.1, 0], [0.1, 1.2, 0], [0.55, 1.05, 0], [1, 0.85, 1], [-0.75, 0.7, 1], [0.8, 0.75, 0]];
      spec.forEach(([sp, len, low]) => {
        const base = low ? fork : top;
        const l = (95 + r() * 40) * len * Wd.s;
        const ex = base[0] + sp * l + Wd.dir * 14, ey = base[1] - (40 - Math.abs(sp) * 30) * Wd.s - r() * 16 + (low ? 10 : 0);
        const cx = base[0] + sp * l * 0.4 + (r() - 0.5) * 16, cy = base[1] - (70 + r() * 30) * Wd.s * (low ? 0.7 : 1);
        out.push({ sx: base[0], sy: base[1], cx, cy, ex, ey, w: (low ? 4.5 : 6) * (1 - Math.abs(sp) * 0.35) * Wd.s });
      });
      return { top, fork, list: out };
    }
    const qpt = (L, u) => [(1 - u) * (1 - u) * L.sx + 2 * u * (1 - u) * L.cx + u * u * L.ex, (1 - u) * (1 - u) * L.sy + 2 * u * (1 - u) * L.cy + u * u * L.ey];
    // 树干与主枝（静态）：主枝细、偏浅、断续，先画，之后被柳冠盖住大半
    function trunkTex(k) {
      const Wd = WILLOWS[k];
      return K.cache('ff1_b1_trunk' + k, 440, 380, 1, (g) => {
        const ox = Wd.x - 220, oy = Wd.y - 370;
        g.translate(-ox, -oy);
        const r = rng(Wd.seed + 11);
        const { top, fork, list } = limbs(Wd);
        g.lineCap = 'round'; g.lineJoin = 'round';
        // 主枝：沿弧线分段，段间有扭折与小缺口，越往梢越细
        for (const L of list) {
          let prev = qpt(L, 0);
          const nseg = 12;
          for (let j = 1; j <= nseg; j++) {
            const u = j / nseg;
            const [qx, qy] = qpt(L, u);
            const jx = qx + (r() - 0.5) * 3.2 * u, jy = qy + (r() - 0.5) * 2.4 * u;
            if (!(u > 0.45 && r() < 0.22)) {
              g.strokeStyle = rgba(mix(DARK, '#6b7578', 0.18 + 0.3 * u), 0.9 - 0.25 * u);
              g.lineWidth = Math.max(0.7, L.w * 0.55 * (1 - 0.7 * u));
              g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(jx, jy); g.stroke();
            }
            // 偶尔斜出一根下垂的细枝（藏在叶团里）
            if (u > 0.3 && r() < 0.28) {
              const a = Math.PI * (0.62 + r() * 0.3) * (r() < 0.5 ? -1 : 1), l = 8 + r() * 12;
              g.strokeStyle = rgba('#5c6669', 0.55); g.lineWidth = 0.7;
              g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx + Math.sin(a) * l, jy - Math.cos(a) * l); g.stroke();
            }
            prev = [jx, jy];
          }
        }
        // 树干：下粗上细，略扭，有疤节
        g.fillStyle = DARK;
        g.beginPath();
        g.moveTo(Wd.x - 9 * Wd.s, Wd.y + 1);
        g.bezierCurveTo(Wd.x - 6 * Wd.s - Wd.dir * 6, Wd.y - 50, fork[0] - 7 * Wd.s, fork[1] + 20, fork[0] - 5 * Wd.s, fork[1]);
        g.lineTo(top[0] - 3.5 * Wd.s, top[1]); g.lineTo(top[0] + 3.5 * Wd.s, top[1]);
        g.lineTo(fork[0] + 6 * Wd.s, fork[1]);
        g.bezierCurveTo(fork[0] + 7 * Wd.s, fork[1] + 24, Wd.x + 7 * Wd.s - Wd.dir * 4, Wd.y - 46, Wd.x + 10 * Wd.s, Wd.y + 1);
        g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,160,164,0.22)'; g.lineWidth = 1;
        g.beginPath();
        for (let j = 0; j < 6; j++) { const y = Wd.y - 12 - j * 14, x = Wd.x + (r() - 0.5) * 6; g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 5, x + (r() - 0.5) * 3, y - 10); }
        g.stroke();
        g.fillStyle = 'rgba(30,35,38,0.8)';
        g.beginPath(); g.ellipse(Wd.x + Wd.dir * 2, Wd.y - 62, 2.4, 3.4, 0, 0, TAU); g.fill();
      });
    }
    // 柳冠（每帧绘制，阵风时以干顶为轴略向下风切变）：叶团 + 密挂的短柳条
    function crownTex(k) {
      const Wd = WILLOWS[k];
      return K.cache('ff1_b1_crown' + k, 440, 380, 1, (g) => {
        const ox = Wd.x - 220, oy = Wd.y - 370;
        g.translate(-ox, -oy);
        const r = rng(Wd.seed + 3);
        const { list } = limbs(Wd);
        // 叶团：沿主枝上下的许多小团，后层深、前层浅，轮廓起伏不规则
        blurInto(g, 440, 380, 4, (tg) => {
          tg.translate(-ox, -oy);
          for (let pass = 0; pass < 2; pass++) {
            for (const L of list) for (let j = 0; j < 12; j++) {
              const u = 0.25 + r() * 0.75;
              const [x, y] = qpt(L, u);
              if (x < Wd.x0 || x > Wd.x1) continue;
              const rx = (7 + r() * 13) * Wd.s, ry = (6 + r() * 11) * Wd.s;
              tg.fillStyle = pass ? `rgba(116,136,120,${(0.12 + r() * 0.08).toFixed(3)})` : `rgba(78,96,86,${(0.14 + r() * 0.1).toFixed(3)})`;
              tg.beginPath(); tg.ellipse(x + (r() - 0.5) * 18, y - 8 + r() * 30 + pass * 5, rx, ry, 0, 0, TAU); tg.fill();
            }
          }
        });
        // 细碎叶点：沿主枝上缘的下垂小叶，让冠顶轮廓毛茸茸而不是光滑的弧
        blurInto(g, 440, 380, 0.5, (tg) => {
          tg.translate(-ox, -oy);
          for (const L of list) for (let j = 0; j < 70; j++) {
            const u = 0.18 + r() * 0.82;
            const [x, y] = qpt(L, u);
            if (x < Wd.x0 || x > Wd.x1) continue;
            const px = x + (r() - 0.5) * 20, py = y - 10 + r() * 22;
            tg.fillStyle = `rgba(${74 + Math.floor(r() * 36)},${96 + Math.floor(r() * 28)},${84 + Math.floor(r() * 16)},${(0.28 + r() * 0.3).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(px, py, 1.1 + r() * 0.8, 3 + r() * 2.5, (r() - 0.5) * 0.7, 0, TAU); tg.fill();
          }
        });
        // 短柳条：主枝上密挂，湿润的灰绿
        blurInto(g, 440, 380, 0.7, (tg) => {
          tg.translate(-ox, -oy);
          tg.lineCap = 'round';
          for (const L of list) {
            for (let j = 0; j < 46; j++) {
              const u = 0.22 + r() * 0.78;
              const [x, y] = qpt(L, u);
              if (x < Wd.x0 || x > Wd.x1) continue;
              const l = (20 + r() * 64) * Wd.s;
              const sx = x + (r() - 0.5) * 10, sy = y - 6 + r() * 10, up = 3 + r() * 6;
              tg.strokeStyle = `rgba(${80 + Math.floor(r() * 32)},${100 + Math.floor(r() * 26)},${88 + Math.floor(r() * 14)},${(0.22 + r() * 0.26).toFixed(3)})`;
              tg.lineWidth = 1.4 + r() * 2.2;
              const dx = (r() - 0.5) * 8;
              tg.beginPath(); tg.moveTo(sx, sy); tg.bezierCurveTo(sx + dx * 0.5, sy - up, sx + dx, sy + l * 0.35, sx + 3 + dx, sy + l); tg.stroke();
            }
          }
        });
        // 前层细柳条：深一档，盖住主枝的大半
        blurInto(g, 440, 380, 0.35, (tg) => {
          tg.translate(-ox, -oy);
          tg.lineCap = 'round';
          for (const L of list) {
            for (let j = 0; j < 20; j++) {
              const u = 0.15 + r() * 0.85;
              const [x, y] = qpt(L, u);
              if (x < Wd.x0 || x > Wd.x1) continue;
              const l = (16 + r() * 48) * Wd.s;
              tg.strokeStyle = `rgba(${66 + Math.floor(r() * 24)},${88 + Math.floor(r() * 22)},${76 + Math.floor(r() * 12)},${(0.45 + r() * 0.3).toFixed(3)})`;
              tg.lineWidth = 0.9 + r() * 0.8;
              tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + (r() - 0.5) * 4, y + l * 0.5, x + 2, y + l); tg.stroke();
            }
          }
        });
        // 雨雾：整体蒙一层冷灰
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(200,207,209,0.14)'; g.fillRect(ox, oy, 440, 380);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 柳冠倒影贴图：未翻转（绘制时翻转），按到水面的距离逐行加横向波纹，压暗偏冷
    function crownReflTex(k) {
      const Wd = WILLOWS[k];
      return K.cache('ff1_b1_crownR' + k, 440, 380, 1, (g) => {
        const oy = Wd.y - 370;
        const src = crownTex(k), S = src.width / 440;
        for (let y = 0; y < 380; y += 2) {
          const depth = WL - (oy + y), i = Math.round(depth / 2);
          const dep = clamp(depth / 120);
          const dx = (0.6 + 2 * dep) * (Math.sin(i * 0.31) * 0.7 + Math.sin(i * 0.13 + 1) * 0.5);
          g.drawImage(src, 0, y * S, src.width, 2 * S, dx, y, 440, 2);
        }
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(52,62,66,0.38)'; g.fillRect(0, 0, 440, 380);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 阵风时柳冠的切变：x' = x + k·(y干顶 − y)
    function drawCrown(g, k, shear, mirror) {
      const Wd = WILLOWS[k];
      const ox = Wd.x - 220, oy = Wd.y - 370, ytop = Wd.y - 130 * Wd.s;
      g.save();
      if (mirror) {
        g.beginPath(); g.rect(0, WL + 1, W, H - WL); g.clip();
        g.translate(0, 2 * WL); g.scale(1, -1);
      }
      g.transform(1, 0, -shear, 1, shear * ytop, 0);
      if (mirror) g.globalAlpha = 0.85;
      g.drawImage(mirror ? crownReflTex(k) : crownTex(k), ox, oy, 440, 380);
      g.restore();
    }
    // 长柳条：锚点在主枝上（固定），梢随风；阵风时整体偏右
    const STRANDS = WILLOWS.map((Wd, k) => {
      const r = rng(Wd.seed + 7), out = [];
      const { list } = limbs(Wd);
      for (let i = 0; i < 70; i++) {
        const L = list[i % list.length];
        const u = 0.35 + r() * 0.65;
        const [ax, ay] = qpt(L, u);
        if (ax < Wd.x0 || ax > Wd.x1) continue;
        const L0 = (90 + r() * 150) * Wd.s;
        out.push({ ax, ay, L: Math.min(L0, BANK - 10 - ay), bow: (r() - 0.5) * 10, ph: r() * TAU, f: 0.6 + r() * 0.5, k });
      }
      return out;
    });
    function strandPaths(g, t, gust, mirror) {
      g.beginPath();
      for (const list of STRANDS) for (let i = 0; i < list.length; i += mirror ? 2 : 1) {
        const s = list[i];
        const sway = 0.03 * Math.sin(t * s.f + s.ph) + 0.018 * Math.sin(t * 1.7 * s.f + s.ph * 2);
        const wv = 0.06 + 0.34 * gust * (0.82 + 0.18 * Math.sin(t * 2.3 + s.ph)) + sway;
        const ex = s.ax + wv * s.L, ey = s.ay + s.L * (1 - 0.5 * wv * wv);
        const cx = s.ax + s.bow + wv * s.L * 0.12, cy = s.ay + s.L * 0.55;
        if (!mirror) { g.moveTo(s.ax, s.ay); g.quadraticCurveTo(cx, cy, ex, ey); }
        else { g.moveTo(s.ax, 2 * WL - s.ay); g.quadraticCurveTo(cx, 2 * WL - cy, ex, 2 * WL - ey); }
      }
    }
    // 倒影：岸上景物（不含伞与柳条）沿水面线翻转、压暗、加横向波纹，缓存
    function reflTex() {
      return K.cache('ff1_b1_refl', W, H - WL, 1, (g) => {
        const S = g.getTransform().a;
        const src = document.createElement('canvas');
        src.width = Math.round(W * S); src.height = Math.round(WL * S);
        const sg = src.getContext('2d'); sg.scale(S, S);
        sg.drawImage(backTex(), 0, 0, W, WL + 4);
        sg.drawImage(bridgeTex(), 0, 0, W, WL + 4);
        WILLOWS.forEach((Wd, k) => sg.drawImage(trunkTex(k), Wd.x - 220, Wd.y - 370, 440, 380));
        // 水面底色：近处偏暗
        const wg = g.createLinearGradient(0, 0, 0, H - WL);
        wg.addColorStop(0, '#b4bcbe'); wg.addColorStop(1, '#7f8a8e');
        g.fillStyle = wg; g.fillRect(0, 0, W, H - WL);
        // 翻转并分行加波纹位移
        const rows = Math.ceil((H - WL) / 2);
        for (let i = 0; i < rows; i++) {
          const y = i * 2;            // 水面以下的距离
          const sy = WL - y - 2;      // 对应岸上的行
          if (sy < 0) break;
          const dep = clamp(y / 120);
          const dx = (0.6 + 2 * dep) * (Math.sin(i * 0.31) * 0.7 + Math.sin(i * 0.13 + 1) * 0.5);
          g.globalAlpha = 0.85;
          g.save(); g.translate(dx, y + 2); g.scale(1, -1);
          g.drawImage(src, 0, sy * S, src.width, 2 * S, 0, 0, W, 2);
          g.restore();
        }
        g.globalAlpha = 1;
        // 倒影比实物暗、偏冷
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = 'rgb(176,188,194)'; g.fillRect(0, 0, W, H - WL);
        g.globalCompositeOperation = 'source-over';
        // 近处水面映出更多天光
        const lg = g.createLinearGradient(0, 0, 0, H - WL);
        lg.addColorStop(0, 'rgba(200,208,210,0.05)'); lg.addColorStop(1, 'rgba(200,208,210,0.18)');
        g.fillStyle = lg; g.fillRect(0, 0, W, H - WL);
        // 静止的细水纹
        const r = rng(1501);
        for (let i = 0; i < 160; i++) {
          const y = Math.pow(r(), 1.4) * (H - WL), x = r() * W, l = 10 + r() * 50 * (0.4 + y / 220);
          g.fillStyle = r() < 0.5 ? `rgba(220,226,228,${(0.08 + r() * 0.1).toFixed(3)})` : `rgba(40,48,52,${(0.06 + r() * 0.08).toFixed(3)})`;
          g.fillRect(x, y, l, 1);
        }
      });
    }
    // 整张静态底图：天、远景、桥、岸、柳冠与倒影合成一张，每帧只贴一次
    function staticTex() {
      return K.cache('ff1_b1_static', W, H, 1, (g) => {
        g.drawImage(backTex(), 0, 0, W, WL + 4);
        g.drawImage(reflTex(), 0, WL, W, H - WL);
        g.drawImage(bridgeTex(), 0, 0, W, WL + 4);
        WILLOWS.forEach((Wd, k) => g.drawImage(trunkTex(k), Wd.x - 220, Wd.y - 370, 440, 380));
        // 贴着水面的一层雨雾（桥脚处最浓）
        blurInto(g, W, H, 10, (tg) => {
          const r = rng(1601);
          for (let i = 0; i < 12; i++) {
            const x = r() * W, y = WL - 4 + r() * 22, w = 70 + r() * 160;
            tg.fillStyle = `rgba(222,227,227,${(0.12 + r() * 0.14).toFixed(3)})`;
            tg.beginPath(); tg.ellipse(x, y, w, 7 + r() * 8, 0, 0, TAU); tg.fill();
          }
        });
        // 整体冷灰薄雾
        const mg = g.createLinearGradient(0, 0, 0, H);
        mg.addColorStop(0, 'rgba(200,207,209,0.12)'); mg.addColorStop(0.6, 'rgba(200,207,209,0.05)'); mg.addColorStop(1, 'rgba(160,170,174,0.1)');
        g.fillStyle = mg; g.fillRect(0, 0, W, H);
      });
    }
    // 伞（侧面轮廓）：原点在伞面圆心，轴向上为伞顶；lens 为能看到的伞内面高度
    function drawUmbrella(g, x, y, rot, lens, spin, alpha) {
      g.save();
      g.translate(x, y); g.rotate(rot); g.scale(US, US);
      g.globalAlpha *= alpha == null ? 1 : alpha;
      const RW = 24, DH = 12;
      // 伞柄（在伞面下方伸出）
      g.strokeStyle = '#3a2a22'; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -DH); g.lineTo(0, 34); g.stroke();
      g.lineWidth = 3.4; g.beginPath(); g.moveTo(0, 26); g.lineTo(0, 34); g.stroke();
      // 伞内面（凹面），带伞骨
      if (lens > 0.3) {
        g.fillStyle = '#8e2621';
        g.beginPath(); g.ellipse(0, 0, RW, lens, 0, 0, Math.PI); g.fill();
        g.strokeStyle = 'rgba(60,20,18,0.8)'; g.lineWidth = 0.8;
        g.beginPath();
        for (let k = 0; k < 8; k++) {
          const a = spin + (k / 8) * Math.PI;
          const ex = Math.cos(a) * RW, ey = Math.abs(Math.sin(a)) * lens;
          g.moveTo(0, 2 + lens * 0.3); g.lineTo(ex, ey);
        }
        g.stroke();
      }
      // 伞面（凸面）
      g.fillStyle = RED;
      g.beginPath();
      g.moveTo(-RW, 0);
      g.quadraticCurveTo(-RW * 0.55, -DH * 1.02, 0, -DH);
      g.quadraticCurveTo(RW * 0.55, -DH * 1.02, RW, 0);
      g.quadraticCurveTo(0, 2.5, -RW, 0);
      g.closePath(); g.fill();
      // 伞面上的骨线与受光（阴天顶光：上缘略亮）
      g.strokeStyle = 'rgba(110,26,22,0.55)'; g.lineWidth = 0.8;
      g.beginPath();
      for (let k = 1; k < 7; k++) {
        const a = spin * 0.5 + (k / 7) * Math.PI;
        const ex = -Math.cos(a) * RW;
        g.moveTo(0, -DH); g.quadraticCurveTo(ex * 0.55, -DH * (1 - Math.pow(Math.abs(ex) / RW, 2) * 0.4), ex, 0.5);
      }
      g.stroke();
      g.strokeStyle = 'rgba(236,150,130,0.45)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-RW * 0.8, -4); g.quadraticCurveTo(-RW * 0.4, -DH, 0, -DH); g.quadraticCurveTo(RW * 0.4, -DH, RW * 0.8, -4); g.stroke();
      // 伞顶
      g.fillStyle = '#3a2a22'; g.fillRect(-1.2, -DH - 4, 2.4, 4);
      g.restore();
    }
    // 伞的运动：返回 {x, y, rot, lens, spin, phase, wl, tau}
    // 飞行：重心先被阵风托起（向上的速度在 0.07s 内建立，0.25s 内升约 15px），随后重力接管成抛物线；
    // 横向被风带向风速 VW（一阶阻力，时间常数 KW）；伞绕重心在平面内转 160°（从静止起转）。
    // 重力按落点反解：第2句第4字那一刻，伞最低的一点正好碰到伞所在处的水面 YW。
    const VW = 110, KW = 0.35, VUP = 170, KU = 0.07, YW = 514, COM = 10;
    const windX = (tau) => VW * (tau - KW * (1 - Math.exp(-tau / KW)));
    const liftY = (tau) => VUP * (tau - KU * (1 - Math.exp(-tau / KU)));
    const SPINA = 160 * DEG1;
    const rho = (k) => k * k * (2 - k);
    const LOWP = [[24, 0], [-24, 0], [0, -16], [13, -11], [-13, -11], [0, 34], [17, -7], [-17, -7]];
    const lowest = (th) => { let m = -1e9, mx = 0; for (const [px, py] of LOWP) { const [ox, oy] = rotP(px, py, th); if (oy > m) { m = oy; mx = ox; } } return [mx, m]; };
    const comOff = (th) => rotP(0, COM, th);
    function flight(fly) {
      const rotL = ROT0 + SPINA;
      const [, lo] = lowest(rotL);
      const c0 = comOff(ROT0), cL = comOff(rotL);
      const com0 = [U0.x + c0[0], U0.y + c0[1]];
      const comYL = YW - lo + cL[1];
      const gg = 2 * (comYL - com0[1] + liftY(fly)) / (fly * fly);
      return { rotL, com0, gg };
    }
    function flyPose(tau, fly, F) {
      const rot = ROT0 + SPINA * rho(clamp(tau / fly));
      const co = comOff(rot);
      const x = F.com0[0] + windX(tau) - co[0];
      const y = F.com0[1] - liftY(tau) + 0.5 * F.gg * tau * tau - co[1];
      return { x, y, rot };
    }
    function umbrellaAt(t, T) {
      const tFly = T.hen, tLand = T.qi, tNuo = T.nuo;
      const fly = Math.max(0.3, tLand - tFly);
      if (t < tFly) {
        // 静靠：伞面随风极轻地颤（绕柄尖，幅度极小）
        const q = 0.004 * Math.sin(t * 2.1) * smooth((t - 3.0) / 0.5);
        return { x: U0.x, y: U0.y, rot: U0.rot + q, lens: 3.5, spin: 0, phase: 0, wl: WL, tau: 0 };
      }
      const F = flight(fly);
      if (t < tLand) {
        const tau = t - tFly, k = tau / fly;
        const P = flyPose(tau, fly, F);
        return { x: P.x, y: P.y, rot: P.rot, lens: lerp(3.5, 6, k), spin: tau * 2, phase: 1, wl: lerp(WL, YW, k), tau };
      }
      // 落水后：伞沿先入水，随即翻成碗口朝上漂着——转角、高度都从落水那一刻的位置与速度连续接上；
      // 先往下沉约 3px 再浮起、轻轻起伏；横向余速被水慢慢消去，第2句第6字起随水流右漂
      const tau = t - tLand;
      const L = flyPose(fly, fly, F);
      const dt = 0.01, Lp = flyPose(fly - dt, fly, F);
      const vx = (L.x - Lp.x) / dt;
      const w0 = SPINA * (4 - 3) / fly;                  // ρ′(1) = 1
      const A = F.rotL - Math.PI, kr = 0.22, B = w0 + A / kr;
      const rot = Math.PI + (A + B * tau) * Math.exp(-tau / kr) + 0.035 * Math.sin(TAU * tau / 3.6) * smooth(tau / 0.8);
      const yF = YW - 4.5;
      const Ay = L.y - yF, ky = 0.08, By = 420 + Ay / ky;
      const bob = 1.3 * Math.sin(TAU * tau / 3.8) * smooth(tau / 0.8) + 1.0 * Math.sin(TAU * tau / 0.6) * Math.exp(-tau / 0.3) * (1 - Math.exp(-tau / 0.05));
      const nq = smooth((t - tNuo) / 0.8);
      const glide = vx * 0.4 * (1 - Math.exp(-tau / 0.4));
      return { x: L.x + glide + 34 * nq, y: yF + (Ay + By * tau) * Math.exp(-tau / ky) + bob + 3 * nq, rot, lens: lerp(6, 9, smooth(tau / 0.6)), spin: 2.4 + tau * 0.5, phase: 2, wl: YW + 3 * nq, tau };
    }
    // 落水点：飞行结束那一刻伞最低的那一点（伞沿）
    function touchdown(T) {
      const fly = Math.max(0.3, T.qi - T.hen), F = flight(fly), L = flyPose(fly, fly, F);
      const [lx] = lowest(F.rotL);
      return [L.x + lx, YW];
    }
    // 落水水冠：以落水点为中心的一圈小水花，第一帧就立起（高度按 1−e^(−t/0.04) 长出）；half −1 画远半圈，1 画近半圈
    function splashCrown(g, xL, yL, tl, half) {
      if (tl <= 0 || tl >= 0.5) return;
      const cw = tl / 0.5;
      const hh = 20 * (1 - Math.exp(-tl / 0.04)) * (1 - smooth(cw)) * (half > 0 ? 0.8 : 1);
      g.strokeStyle = `rgba(236,240,242,${(0.8 * (1 - cw) * (half > 0 ? 0.6 : 1)).toFixed(3)})`;
      g.lineWidth = 1.2;
      g.beginPath();
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU + 0.13;
        if ((Math.sin(a) < 0) !== (half < 0)) continue;
        const rb = 8 + 18 * (1 - (1 - cw) * (1 - cw));
        const bx = xL + Math.cos(a) * rb, by = yL + Math.sin(a) * rb * 0.24;
        const lh = hh * (0.6 + 0.4 * h2(k, 44));
        g.moveTo(bx, by); g.quadraticCurveTo(bx + Math.cos(a) * 3, by - lh * 0.6, bx + Math.cos(a) * (5 + 6 * cw), by - lh);
      }
      g.stroke();
    }

    XYT.registerShot('b1_bridge', {
      name: '伞落桥头', zone: 'top', night: false, text: '#262c30', shadow: 'rgba(232,236,236,0.9)', accent: '#b02e26', bloom: 0.2,
      draw(g, c) {
        const t = c.lt, tc = Math.max(0, t);
        const ct = (k) => { const v = c.charT ? c.charT(k, 1) : null; return v == null ? FALLBACK2[k] : v - (c.t - c.lt); };
        const T = { hen: ct(0), qi: ct(3), nuo: ct(5) };
        // 阵风包络：第2句第1字起快起、慢慢减弱到稍强于原先
        const gust = smooth((t - T.hen) / 0.35) * (1 - 0.55 * smooth((t - T.hen - 1.1) / 1.6));
        // 镜头：整镜 1.00→1.08 缓推（峰值约 1.8%/s），推向伞所在的右半桥（中心约 800,400），不平移
        const z = 1 + 0.08 * smooth(clamp(c.p));
        g.save();
        g.translate(800, 400); g.scale(z, z); g.translate(-800, -400);
        g.drawImage(staticTex(), 0, 0, W, H);
        // 柳冠与倒影：平时几乎不动，阵风时以干顶为轴向下风切变（≤0.03）
        for (let k = 0; k < 2; k++) {
          const shear = 0.03 * gust + 0.0025 * Math.sin(0.55 * t + k * 1.7);
          drawCrown(g, k, shear, true);
          drawCrown(g, k, shear, false);
        }
        // 缓缓移动的水纹（风向右）
        {
          const op = g.globalCompositeOperation;
          for (let grp = 0; grp < 2; grp++) {
            g.beginPath();
            for (let i = grp; i < 40; i += 2) {
              const y = WL + 6 + Math.pow(h2(i, 11), 1.3) * (H - WL - 10);
              const near = (y - WL) / (H - WL);
              const x = ((h2(i, 12) * (W + 200) + tc * (8 + 10 * near) * (1 + gust)) % (W + 200)) - 100;
              g.rect(x, y, 24 + 60 * near, 1);
            }
            g.fillStyle = `rgba(222,228,230,${(0.1 + 0.06 * Math.sin(tc * 0.9 + grp * 2)).toFixed(3)})`;
            g.fill();
          }
          g.globalCompositeOperation = op;
        }
        // 柳条倒影（随风动，和实物一致）
        g.save();
        g.beginPath(); g.rect(0, WL + 1, W, H - WL); g.clip();
        g.strokeStyle = 'rgba(52,64,58,0.22)'; g.lineWidth = 1.6;
        strandPaths(g, t, gust, true); g.stroke();
        g.restore();
        // 伞
        const U = umbrellaAt(t, T);
        // 伞的倒影：以伞所在处的水面线翻转，压暗
        {
          const ry = 2 * U.wl - U.y;
          g.save();
          g.beginPath(); g.rect(0, U.wl + 0.5, W, H - U.wl); g.clip();
          g.translate(U.x, ry); g.scale(1, -1);
          drawUmbrella(g, 0, 0, U.rot, U.lens, U.spin, 0.32);
          g.restore();
        }
        // 雨圈：随机落点，从零扩散后淡出；拍点上多落几滴。内圈稍晚也从落点长出，不在中途冒出
        // 伞漂在水面时，伞身附近的雨圈改画进局部临时层，与伞激起的涟漪一起挖掉伞身占住的水面
        const floating = U.phase === 2;
        const nearHull = (x, y, rr) => floating && Math.abs(x - U.x) < rr + 32 * US && Math.abs(y - U.wl) < rr * 0.24 + 14;
        const RB = [[], [], [], [], [], [], [], [], [], []], NB = [];
        const ringQ = (x, y, age, life, rmax, a) => {
          if (age < 0 || age > life) return;
          const k = age / life;
          const al = a * (1 - k) * (1 - k);
          const q = Math.round(al / 0.6 * 10);
          if (q < 1) return;
          const rr = rmax * (1 - Math.pow(1 - k, 2)) + 0.5;
          const k2 = (k - 0.25) / 0.75, r2 = k2 > 0 ? rmax * 0.6 * (1 - Math.pow(1 - k2, 2)) + 0.5 : 0;
          if (nearHull(x, y, rr)) { NB.push(x, y, rr, r2, al); return; }
          RB[Math.min(9, q)].push(x, y, rr, r2);
        };
        g.lineWidth = 1;
        for (let i = 0; i < 70; i++) {
          const P = 1.1 + h2(i, 21) * 0.9, ph = h2(i, 22) * P;
          const cyc = Math.floor((tc + ph) / P), age = (tc + ph) - cyc * P;
          const yy = WL + 8 + Math.pow(h2(i * 31 + cyc, 23), 0.8) * (H - WL - 12);
          const near = (yy - WL) / (H - WL);
          ringQ(h2(i * 17 + cyc, 24) * W, yy, age, 0.9, 6 + 16 * near, 0.5);
        }
        if (c.b && c.grid) {
          for (let d = 0; d < 2; d++) {
            const bi = c.b.i - d, age = c.b.since + (d ? c.b.period : 0);
            for (let j = 0; j < 4; j++) {
              const yy = WL + 20 + h2(bi * 7 + j, 31) * (H - WL - 30);
              const near = (yy - WL) / (H - WL);
              ringQ(h2(bi * 13 + j, 32) * W, yy, age, 1.0, 8 + 20 * near, 0.55 * (0.5 + 0.5 * (c.b.str || 0.5)));
            }
          }
        }
        for (let q = 1; q < 10; q++) {
          const L = RB[q];
          if (!L.length) continue;
          g.beginPath();
          for (let i = 0; i < L.length; i += 4) {
            const x = L[i], y = L[i + 1], rr = L[i + 2], r2 = L[i + 3];
            g.moveTo(x + rr, y); g.ellipse(x, y, rr, rr * 0.24, 0, 0, TAU);
            if (r2 > 0) { g.moveTo(x + r2, y); g.ellipse(x, y, r2, r2 * 0.24, 0, 0, TAU); }
          }
          g.strokeStyle = `rgba(226,232,234,${(q / 10 * 0.6).toFixed(3)})`;
          g.stroke();
        }
        // 落水与漂浮激起的涟漪：第一圈在落水那一帧就从伞沿入水点长出；随后几圈从伞的吃水线（内半径 r0）起向外扩，
        // 中心取发出那一刻伞所在处（之后随水流一起漂）；漂浮起伏的小圈与伞同心
        const [xL, yT] = touchdown(T), yL = yT + 1;
        {
          const tl0 = t - T.qi;
          if (tl0 > -0.01) {
            const X0 = Math.floor(xL - 115), Y0 = WL + 1, RW_ = 320, RH_ = 50;
            const sc = scratch('ff1_b1_ring', RW_, RH_), sg = sc.g;
            sg.translate(-X0, -Y0);
            const nqAt = (tt) => 34 * smooth((tt - T.nuo) / 0.8);
            const ring = (x, y, age, life, r0, rmax, a) => {
              if (age < 0 || age > life) return;
              const k = age / life;
              const rr = r0 + (rmax - r0) * (1 - Math.pow(1 - k, 2));
              const al = a * (1 - k) * (1 - k) * (1 - Math.exp(-age / 0.025));
              sg.strokeStyle = `rgba(226,232,234,${al.toFixed(3)})`;
              sg.beginPath(); sg.ellipse(x, y, rr, rr * 0.24, 0, 0, TAU); sg.stroke();
              const k2 = (age - 0.3 * life) / (0.7 * life);
              if (k2 > 0) {
                const r2 = r0 + (rr - r0) * 0.55 * (1 - Math.pow(1 - k2, 2));
                sg.strokeStyle = `rgba(226,232,234,${(al * 0.8 * smooth(k2 / 0.15)).toFixed(3)})`;
                sg.beginPath(); sg.ellipse(x, y, r2, r2 * 0.24, 0, 0, TAU); sg.stroke();
              }
            };
            sg.lineWidth = 1.2;
            ring(xL + nqAt(t) - nqAt(T.qi), U.wl + 1, tl0, 2.4, 4, 58, 0.75);
            for (let k = 1; k < 4; k++) {
              const te = T.qi + k * 0.28;
              const xe = umbrellaAt(te, T).x + nqAt(t) - nqAt(te);
              ring(xe, U.wl + 1, tl0 - k * 0.28, 2.6, 27 * US, (60 + 14 * k) * US, 0.6);
            }
            for (let k = 0; k < 3; k++) ring(U.x, U.wl + 1, tl0 - 1.2 - k * 1.3, 1.6, 25 * US, 44 * US, 0.35);
            // 伞身附近的雨圈
            sg.lineWidth = 1;
            for (let i = 0; i < NB.length; i += 5) {
              const x = NB[i], y = NB[i + 1], rr = NB[i + 2], r2 = NB[i + 3];
              sg.strokeStyle = `rgba(226,232,234,${NB[i + 4].toFixed(3)})`;
              sg.beginPath(); sg.ellipse(x, y, rr, rr * 0.24, 0, 0, TAU);
              if (r2 > 0) { sg.moveTo(x + r2, y); sg.ellipse(x, y, r2, r2 * 0.24, 0, 0, TAU); }
              sg.stroke();
            }
            sg.globalCompositeOperation = 'destination-out';
            // 涟漪碰到远处岸脚即止：贴着水线 6px 内淡去
            const bg = sg.createLinearGradient(0, Y0, 0, Y0 + 6);
            bg.addColorStop(0, '#000'); bg.addColorStop(1, 'rgba(0,0,0,0)');
            sg.fillStyle = bg; sg.fillRect(X0, Y0, RW_, 6);
            // 挖掉伞身：吃水线处的水面椭圆 + 伞的实际轮廓（含没在水下的伞面）
            if (floating) {
              sg.fillStyle = '#000';
              sg.beginPath(); sg.ellipse(U.x, U.wl, 25 * US, 6.5 * US, 0, 0, TAU); sg.fill();
              drawUmbrella(sg, U.x, U.y, U.rot, U.lens, U.spin, 1);
              // 伞的倒影上涟漪减半，免得伞下的红影里叠着白圈
              sg.save(); sg.globalAlpha = 0.5;
              sg.translate(U.x, 2 * U.wl - U.y); sg.scale(1, -1);
              drawUmbrella(sg, 0, 0, U.rot, U.lens, U.spin, 1);
              sg.restore();
            }
            sg.globalCompositeOperation = 'source-over';
            g.drawImage(sc.c, X0, Y0, RW_, RH_);
          }
        }
        // 桥与两岸、柳树
        // 柳条：先浅色叶串，再深色细芯
        g.lineCap = 'round';
        strandPaths(g, t, gust, false);
        g.strokeStyle = 'rgba(98,120,104,0.32)'; g.lineWidth = 3.2; g.stroke();
        g.strokeStyle = 'rgba(52,66,58,0.7)'; g.lineWidth = 1; g.stroke();
        // 静靠时的接触：柄尖落在边石沿上的一点暗影；伞柄贴住望柱右棱处一道 1px 暗线（阴天无硬影；伞离开后 0.15s 内淡去）
        {
          const ca = U.phase === 0 ? 1 : U.phase === 1 ? 1 - smooth(U.tau / 0.15) : 0;
          if (ca > 0.01) {
            g.globalAlpha = ca;
            g.fillStyle = 'rgba(28,33,36,0.5)';
            g.beginPath(); g.ellipse(U0.tipx + 0.4, U0.tipy + 0.6, 3.2, 1.1, 0, 0, TAU); g.fill();
            g.fillStyle = 'rgba(24,28,31,0.7)';
            g.fillRect(POST_X + POST_HW - 0.2, U0.cy8 - 5, 1, 9);
            g.globalAlpha = 1;
          }
        }
        // 落水：水冠与水滴——伞沿远半圈的在伞后，近半圈的在伞前；水滴落回水面即消失
        const tl = t - T.qi;
        const drops = (half) => {
          g.fillStyle = 'rgba(232,238,240,0.75)';
          g.globalAlpha = clamp(1 - tl / 0.8);
          for (let k = 0; k < 14; k++) {
            const a = h2(k, 45) * TAU, rb = 5 + 7 * h2(k, 46);
            if ((Math.sin(a) < 0) !== (half < 0)) continue;
            const x0 = xL + Math.cos(a) * rb, y0 = yL + Math.sin(a) * rb * 0.24;
            const vx = Math.cos(a) * (40 + h2(k, 41) * 90), vy = -(110 + h2(k, 42) * 150);
            const x = x0 + vx * tl, y = y0 - 4 + vy * tl + 0.5 * G_PX * tl * tl;
            if (y > y0 && tl > 0.05) continue;
            const sz = 0.9 + h2(k, 43) * 1.0;
            g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        };
        if (tl > 0 && tl < 0.5) splashCrown(g, xL, yL, tl, -1);
        if (tl > 0 && tl < 0.8) drops(-1);
        if (U.phase < 2) {
          drawUmbrella(g, U.x, U.y, U.rot, U.lens, U.spin, 1);
        } else {
          // 漂浮：伞面凸底一部分没在水下，只隐约可见
          g.save(); g.beginPath(); g.rect(0, 0, W, U.wl + 1); g.clip();
          drawUmbrella(g, U.x, U.y, U.rot, U.lens, U.spin, 1);
          g.restore();
          g.save(); g.beginPath(); g.rect(0, U.wl + 1, W, 40); g.clip();
          drawUmbrella(g, U.x, U.y, U.rot, U.lens, U.spin, 0.3);
          g.restore();
        }
        // 水冠近半圈与近侧水滴在伞前
        if (tl > 0 && tl < 0.8) { splashCrown(g, xL, yL, tl, 1); drops(1); }
        g.restore();
        // 雨丝：两层（远细淡、近长），风向右，阵风时一起更斜
        let X = 50 * tc;
        const a0 = Math.max(0, tc - T.hen), steps = Math.min(60, Math.ceil(a0 / 0.05));
        for (let i = 0; i < steps; i++) {
          const tt = T.hen + (i + 0.5) * a0 / Math.max(1, steps);
          X += 170 * (smooth((tt - T.hen) / 0.35) * (1 - 0.55 * smooth((tt - T.hen - 1.1) / 1.6))) * a0 / Math.max(1, steps);
        }
        const vx = 50 + 170 * gust, VY = 760;
        const op = g.globalCompositeOperation;
        for (let layer = 0; layer < 2; layer++) {
          const n = layer ? 70 : 150, len = layer ? 30 : 16, sp = layer ? 1.25 : 0.8;
          const dx = vx / VY * len;
          g.strokeStyle = layer ? 'rgba(238,242,244,0.4)' : 'rgba(228,233,235,0.3)';
          g.lineWidth = layer ? 1.2 : 0.8;
          g.beginPath();
          for (let i = 0; i < n; i++) {
            const k = 0.85 + 0.3 * h2(i, 51 + layer);
            const yy = ((h2(i, 52 + layer) * (H + 80) + VY * sp * k * tc) % (H + 80)) - 40;
            const xx = ((h2(i, 53 + layer) * (W + 160) + X * sp * k + (yy / VY) * vx * 0) % (W + 160) + (W + 160)) % (W + 160) - 80;
            g.moveTo(xx, yy); g.lineTo(xx + dx, yy + len);
          }
          g.stroke();
        }
        // 第2句第1字：一阵斜雨帘自左向右扫过画面，前锋正好在伞被掀起那一刻经过伞（快起慢落的包络，粒子只在雨帘里显出）
        {
          const front = U0.x + (t - T.hen) * 1900;
          if (front > -260 && front < W + 360) {
            const env = smooth((t - T.hen + 0.55) / 0.25) * (1 - smooth((t - T.hen - 0.1) / 0.45));
            if (env > 0.01) {
              const gvx = 420, len = 46, dx = gvx / VY * len;
              g.lineWidth = 1.1;
              for (let grp = 0; grp < 3; grp++) {
                g.beginPath();
                for (let i = grp; i < 90; i += 3) {
                  const yy = ((h2(i, 61) * (H + 80) + VY * 1.4 * tc) % (H + 80)) - 40;
                  const xx = front - 300 * h2(i, 62) - (yy - 360) * 0.18;
                  g.moveTo(xx, yy); g.lineTo(xx + dx, yy + len);
                }
                // 雨帘前锋最密、向后渐疏
                g.strokeStyle = `rgba(240,244,246,${(0.42 * env * (1 - grp * 0.28)).toFixed(3)})`;
                g.stroke();
              }
            }
          }
        }
        // 结尾接圆形渐开（下一镜是夜里的灯）：最后 1.1s 先整体缓缓压暗到约 72%（smoothstep），亮→暗分摊到三十多帧；
        // 圆口还小的时候在它外缘铺一圈淡暗晕，读起来是“推开一扇暗窗”而不是冒出一个太阳——圆口变大前暗晕就收掉，不叠在最快的那几帧上
        // （圆形渐开本身在引擎里，这里只能从本镜一侧缓和）
        {
          const td = t - (c.dur - 1.1);
          if (td > 0) {
            g.fillStyle = `rgba(24,22,20,${(0.28 * smooth(td / 1.0)).toFixed(3)})`;
            g.fillRect(0, 0, W, H);
            const IRIS = 0.7, pi = (t - (c.dur - IRIS)) / IRIS;
            const ha = 0.4 * smooth(pi / 0.1) * (1 - smooth((pi - 0.25) / 0.2));
            if (pi > 0 && ha > 0.005) {
              const R0 = Math.hypot(640, 360) / 0.75 + 4;
              const r = easeInOut(pi) * R0 + 1, ri = r * 0.72, ro = r * 0.75 + 60 + 80 * smooth(pi * 3);
              const hg = g.createRadialGradient(640, 360, ri, 640, 360, ro);
              hg.addColorStop(0, `rgba(26,20,18,${ha.toFixed(3)})`);
              hg.addColorStop(0.45, `rgba(26,20,18,${(ha * 0.45).toFixed(3)})`);
              hg.addColorStop(1, 'rgba(26,20,18,0)');
              g.fillStyle = hg; g.fillRect(0, 0, W, H);
            }
          }
        }
      },
    });
  })();
})();
