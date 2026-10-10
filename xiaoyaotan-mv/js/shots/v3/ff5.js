/* 第三版镜头组 ff5：e5_inkrain, e6_peony, e7_fireflies */
(function () {
  'use strict';
  const A = XYT.art, K = XYT.kit, W = A.W, H = A.H, TAU = Math.PI * 2;
  const { clamp, lerp, smooth, easeInOut, h2, rgba, mix } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;
  const sstep = (a, b, x) => smooth((x - a) / (b - a));

  // ---------- 公用：值噪声与逐像素贴图 ----------
  function makeNoise(seed) {
    const N = 256, tab = new Float32Array(N * N), r = A.rng(seed);
    for (let i = 0; i < N * N; i++) tab[i] = r();
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const x0 = xi & 255, y0 = yi & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
      const a = tab[y0 * N + x0], b = tab[y0 * N + x1], c = tab[y1 * N + x0], d = tab[y1 * N + x1];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  // 在缓存画布上按设备像素逐点着色；fn(X, Y, out) 写入 out[0..3]
  function pixels(g, x0, y0, w, h, fn) {
    const sc = g.getTransform().a;
    const pw = Math.max(1, Math.round(w * sc)), ph = Math.max(1, Math.round(h * sc));
    const tmp = document.createElement('canvas'); tmp.width = pw; tmp.height = ph;
    const tg = tmp.getContext('2d'), id = tg.createImageData(pw, ph), d = id.data, o = [0, 0, 0, 255];
    for (let py = 0; py < ph; py++) {
      const Y = y0 + (py + 0.5) / sc;
      for (let px = 0; px < pw; px++) {
        o[3] = 255;
        fn(x0 + (px + 0.5) / sc, Y, o);
        const k = (py * pw + px) * 4;
        d[k] = o[0]; d[k + 1] = o[1]; d[k + 2] = o[2]; d[k + 3] = o[3];
      }
    }
    tg.putImageData(id, 0, 0);
    g.drawImage(tmp, x0, y0, w, h);
  }
  // 每帧复用的离屏画布（每次使用前整块清空，不保存帧间状态）
  const scratch = {};
  function scratchCanvas(name, w, h) {
    const sc = SS();
    let c = scratch[name];
    const pw = Math.round(w * sc), ph = Math.round(h * sc);
    if (!c) { c = scratch[name] = document.createElement('canvas'); }
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.setTransform(sc, 0, 0, sc, 0, 0);
    return { c, g };
  }

  // =====================================================================
  // e5_inkrain：雨夜摩崖，檐水把墨迹冲成墨流
  // =====================================================================
  const E5 = (function () {
    const FOOT = 540;                          // 壁脚线（倒影翻转轴）
    const BIGX = 884;                          // 最大一笔所在竖带
    const LX = -0.55, LY = -0.83;              // 主光方向（指向左上的远处微光）
    // 檐口：起伏的岩口，几处下垂的石牙（最大一笔正上方一处，水从那里汇下）
    const TEETH = [[300, 16, 26], [612, 12, 22], [884, 15, 18], [1012, 10, 16], [1160, 18, 30]];
    // 崖壁右端在 XC 处转折，转折面朝右后方退去（背光，口沿与壁脚向远处收拢）
    const XC = 1172;
    const lipY = (x) => {
      let y = 156 + 30 * (1 - x / W) + 20 * (A.noise1(x * 0.005, 3) - 0.5) + 9 * (A.noise1(x * 0.021, 5) - 0.5) + 3 * (A.noise1(x * 0.09, 7) - 0.5);
      y += 12 * (A.noise1(x * 0.0024, 8) - 0.5) + 0.26 * Math.max(0, x - XC);
      // 两处大的悬垂岩口（题字左侧与右侧），口沿不再是一条直线
      for (const [cx, w, a] of [[250, 170, 28], [1062, 104, 18]]) { const u = 1 - Math.abs(x - cx) / w; if (u > 0) y += a * u * u * (3 - 2 * u); }
      for (const [tx, a, w] of TEETH) { const u = 1 - Math.abs(x - tx) / w; if (u > 0) y += a * u * u * (3 - 2 * u); }
      return y;
    };
    // 壁脚：起伏不平，几处坍落的碎石堆；积水后面一段几乎是平的（倒影的翻转轴）
    const TALUS = [[318, 62, 17], [646, 44, 11], [176, 34, 8], [1236, 40, 9]];
    const footY = (x) => {
      const flat = 1 - 0.88 * sstep(690, 760, x) * (1 - sstep(1190, 1250, x));
      let y = FOOT + flat * (26 * (A.noise1(x * 0.007, 9) - 0.5) + 9 * (A.noise1(x * 0.03, 4) - 0.5)) + 2 * (A.noise1(x * 0.08, 6) - 0.5);
      for (const [tx, w, h] of TALUS) { const u = (x - tx) / w; if (Math.abs(u) < 1) y -= h * Math.pow(Math.cos(u * Math.PI / 2), 1.6) * (0.85 + 0.3 * A.noise1(x * 0.05, tx)); }
      return y - 0.2 * Math.max(0, x - XC);
    };
    const butX = (y) => 118 + 14 * Math.sin(y * 0.011 + 0.5) + 10 * (A.noise1(y * 0.03, 12) - 0.5) + 5 * (A.noise1(y * 0.11, 13) - 0.5);
    // 左侧岩柱与崖壁之间的一道缝（y≈304–492），从缝里望见远处夜色里的一点暖灯
    const cleftW = (y) => 27 * Math.pow(Math.max(0, 1 - ((y - 398) / 94) * ((y - 398) / 94)), 0.75) * (0.85 + 0.3 * A.noise1(y * 0.05, 14));
    const LAMP = { y: 418 };
    LAMP.x = butX(LAMP.y) + 0.5 * cleftW(LAMP.y);
    // 积水轮廓
    const POOL = { cx: 972, cy: 628, rx: 204, ry: 58 };
    const poolR = (a) => 1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.05 * Math.sin(a * 5 + 2.1) + 0.03 * Math.sin(a * 9 + 1);
    function poolPath(g) {
      g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU, r = poolR(a);
        const x = POOL.cx + Math.cos(a) * POOL.rx * r, y = POOL.cy + Math.sin(a) * POOL.ry * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    const POOL_TOP = POOL.cy - POOL.ry * 1.12, POOL_BOT = POOL.cy + POOL.ry * 1.12;

    // 维诺格（岩块节理）：返回到最近边界的距离与朝边界的方向
    function makeCells(seed, cw, ch, nx, ny) {
      const r = A.rng(seed), NX = nx + 3, NY = ny + 3;
      const SX = new Float32Array(NX * NY), SY = new Float32Array(NX * NY), T = new Float32Array(NX * NY);
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const k = j * NX + i;
        SX[k] = (i - 1 + 0.15 + 0.7 * r()) * cw; SY[k] = (j - 1 + 0.15 + 0.7 * r()) * ch; T[k] = r();
      }
      return function (X, Y, o) {
        const ci = Math.floor(X / cw) + 1, cj = Math.floor(Y / ch) + 1;
        let f1 = 1e12, f2 = 1e12, k1 = 0, k2 = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const j = cj + dj; if (j < 0 || j >= NY) continue;
          for (let di = -1; di <= 1; di++) {
            const i = ci + di; if (i < 0 || i >= NX) continue;
            const k = j * NX + i, dx = X - SX[k], dy = Y - SY[k], d = dx * dx + dy * dy;
            if (d < f1) { f2 = f1; k2 = k1; f1 = d; k1 = k; } else if (d < f2) { f2 = d; k2 = k; }
          }
        }
        const ux = SX[k2] - SX[k1], uy = SY[k2] - SY[k1], ul = Math.hypot(ux, uy) || 1;
        o.d = -((X - (SX[k1] + SX[k2]) / 2) * ux + (Y - (SY[k1] + SY[k2]) / 2) * uy) / ul;
        o.nx = ux / ul; o.ny = uy / ul; o.tone = T[k1]; o.tone2 = T[k2];
      };
    }
    // 明度 → 冷灰石色
    function rockCol(l, o, lich) {
      l = clamp(l, 0, 1);
      let r, gg, b;
      if (l < 0.45) { const u = l / 0.45; r = 14 + 46 * u; gg = 16 + 50 * u; b = 21 + 59 * u; }
      else { const u = (l - 0.45) / 0.55; r = 60 + 92 * u; gg = 66 + 94 * u; b = 80 + 92 * u; }
      if (lich) { r = lerp(r, r * 0.95 + 6, lich); gg = lerp(gg, gg * 1.06 + 6, lich); b = lerp(b, b * 0.88, lich); }
      o[0] = r; o[1] = gg; o[2] = b;
    }

    // ---------- 摩崖题字：用户指定的两行繁体字（XYT.TC_TEXT，书法楷体 XYT.FONT_TC），湿墨写在石面上 ----------
    const TCT = XYT.TC_TEXT || '撫琴為人無人知我樂';
    const TC_LINES = [TCT.slice(0, 4), TCT.slice(4)];
    const INS_CX = 690;
    const INS = [{ cy: 276, size: 90, pitch: 100 }, { cy: 398, size: 86, pitch: 97 }];
    // 字体是否就绪作为题字相关缓存键的一部分：字体加载完成后这些图层重建一次（每帧开头取一次）
    const CUR = { fk: 'p' };
    const fontKey = () => {
      try { return !document.fonts || document.fonts.check('64px "Yuji Syuku"', TCT) ? 'f' : 'p'; } catch (e) { return 'f'; }
    };
    // 每个字：位置略有参差、微倾；第一行蘸墨后渐干，第二行重新蘸墨，末字墨将尽（飞白最多）
    const GLY = [];
    TC_LINES.forEach((s, li) => {
      const L = INS[li], n = s.length, x0 = INS_CX - (L.pitch * (n - 1)) / 2;
      const dry = li ? [0.06, 0.16, 0.28, 0.4, 0.55] : [0.0, 0.1, 0.22, 0.34];
      for (let i = 0; i < n; i++) {
        GLY.push({
          ch: s[i], li, i, dry: dry[i] || 0.3,
          x: x0 + i * L.pitch + (h2(i, 41 + li) - 0.5) * 6, y: L.cy + (h2(i, 51 + li) - 0.5) * 7,
          size: L.size * (0.96 + 0.08 * h2(i, 61 + li)), rot: (h2(i, 71 + li) - 0.5) * 0.06,
        });
      }
    });
    function drawGlyphs(g, col) {
      g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      for (const q of GLY) {
        g.save(); g.translate(q.x, q.y); g.rotate(q.rot);
        g.font = `${q.size.toFixed(1)}px ${XYT.FONT_TC}`;
        g.fillText(q.ch, 0, q.size * 0.37);
        g.restore();
      }
      g.textAlign = 'start';
    }
    const dryAt = (X, Y) => {
      let best = 0, bd = 1e9;
      for (const q of GLY) { const d = Math.abs(X - q.x) + Math.abs(Y - q.y) * 1.5; if (d < bd) { bd = d; best = q.dry; } }
      return best;
    };
    // 1 倍分辨率的字形遮罩（用来找细流经过笔画的位置、笔画下缘的墨滴起点）
    let MASK = null;
    function maskData(fk) {
      if (MASK && MASK.fk === fk) return MASK;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      drawGlyphs(g, '#000');
      const d = g.getImageData(0, 0, W, H).data, a = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) a[i] = d[i * 4 + 3];
      return (MASK = { fk, a });
    }
    const IR = { x: 400, y: 206, w: 580, h: 262 };          // 题字所在的范围（含洇边）
    let LAYOUT = null;
    // 细流的路径：噪声游走约 ±3px（经过笔画时另加小折，见 layout）
    const xsOf = (x0) => (y) => x0 + 6 * (A.noise1(y * 0.016 + x0 * 0.37, 17) - 0.5) + 1.6 * (A.noise1(y * 0.06 + x0 * 0.11, 19) - 0.5);
    function layout() {
      const fk = CUR.fk;
      if (LAYOUT && LAYOUT.fk === fk) return LAYOUT;
      const a = maskData(fk).a;
      const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[y * W + x]);
      // 一条细流经过哪些笔画
      const crossings = (xs) => {
        const hit = new Uint8Array(H);
        for (let y = IR.y; y < IR.y + IR.h; y++) {
          const x = Math.round(xs(y));
          if (at(x, y) > 120 || at(x - 1, y) > 120 || at(x + 1, y) > 120) for (let d = -2; d <= 2; d++) hit[y + d] = 1;
        }
        const out = []; let a0 = -1;
        for (let y = 0; y < H; y++) {
          if (hit[y] && a0 < 0) a0 = y;
          if (!hit[y] && a0 >= 0) { if (y - a0 > 3) out.push([a0, y]); a0 = -1; }
        }
        return out;
      };
      // 檐水细流：挑六处经过笔画最多的竖线（彼此相隔 ≥48px，避开大股水的竖带），另有两道只是湿痕
      const cand = [];
      for (let x = 446; x <= 940; x += 2) {
        if (Math.abs(x - BIGX) < 54) continue;
        cand.push([x, crossings(xsOf(x)).reduce((acc, [ya, yb]) => acc + yb - ya, 0)]);
      }
      cand.sort((u, v) => v[1] - u[1] || u[0] - v[0]);
      const picks = [];
      for (const [x, s] of cand) { if (picks.length >= 6 || s < 10) break; if (picks.every((p) => Math.abs(p - x) >= 48)) picks.push(x); }
      const T0 = [0.26, 0.4, 0.55, 0.7, 0.86, 1.02];
      const riv = picks.map((x, k) => ({ x, t0: T0[k], v: 86 + 16 * h2(k, 5) }));
      riv.push({ x: 1140, t0: 1.5, v: 98 }, { x: 318, t0: 2.1, v: 90 });
      for (const r of riv) {
        r.y0 = lipY(r.x) + 3;
        // 水流出笔画下缘时被墨面带偏一点（±1–2.5px 的小折）
        const xs0 = xsOf(r.x), kinks = crossings(xs0).map(([, yb], i) => [yb, (h2(i, r.x | 0) < 0.5 ? -1 : 1) * (1 + 1.5 * h2(i + 9, r.x | 0))]);
        r.xs = (y) => { let x = xs0(y); for (const [yb, k] of kinks) x += k * smooth((y - yb + 2) / 9); return x; };
        r.cross = crossings(r.xs);
      }
      // 笔画下缘（下面就是石面）：湿墨受重力往下挂出细墨滴
      const bottoms = [];
      for (let x = IR.x; x < IR.x + IR.w; x++) {
        for (let y = IR.y + 5; y < IR.y + IR.h - 5; y++) {
          if (at(x, y) > 150 && at(x, y + 1) < 150 && at(x, y + 3) < 30 && at(x, y - 4) > 150) bottoms.push([x, y, h2(x, y * 7 + 3)]);
        }
      }
      bottoms.sort((u, v) => u[2] - v[2]);
      const sdrips = [], drips = [];
      for (const [x, y, hh] of bottoms) {
        if (sdrips.length >= 30) break;
        if (sdrips.some((d) => Math.abs(d.x - x) < 11 && Math.abs(d.y - y) < 10)) continue;
        const k = h2(x, y + 11);
        sdrips.push({ x, y, w: 1.1 + 1.3 * k, L: 3 + 9 * h2(x + 5, y) });
      }
      for (const [x, y] of bottoms) {
        if (drips.length >= 22) break;
        if (Math.abs(x - BIGX) < 40) continue;
        const wx = clamp((x - 600) / 340, 0, 1);
        if (h2(x + 3, y + 5) > 0.02 + 0.07 * wx) continue;
        if (drips.some((d) => Math.abs(d.x - x) < 14 && Math.abs(d.y - y) < 12) || sdrips.some((d) => Math.abs(d.x - x) < 5 && Math.abs(d.y - y) < 6)) continue;
        const r1 = h2(x, y + 21), r2 = h2(x + 9, y + 2), r3 = h2(x + 1, y + 30);
        drips.push({ x, y: y - 1, w: 1.3 + 1.3 * r1, L: 10 + 28 * r1 * (0.5 + wx), t0: lerp(2.4, 0.9, wx) + 2.2 * r2, tau: 0.9 + 1.4 * r3 });
      }
      return (LAYOUT = { fk, riv, drips, sdrips });
    }
    // 湿墨：字形遮罩 → 石纹与石孔不吃墨、边缘飞白（越干越多）、墨在边沿积得略浓、外缘洇开一圈淡墨、
    // 迎光（左上）一侧的边沿有一线湿亮；再挂上静止的短墨滴
    function inkLayer() {
      return K.cache('ff5_e5_ink' + CUR.fk, W, H, 1, (g) => {
        const sc = g.getTransform().a, pw = Math.round(IR.w * sc), ph = Math.round(IR.h * sc);
        const M = document.createElement('canvas'); M.width = pw; M.height = ph;
        const mg = M.getContext('2d');
        mg.setTransform(sc, 0, 0, sc, -IR.x * sc, -IR.y * sc);
        drawGlyphs(mg, '#000');
        const Bc = document.createElement('canvas'); Bc.width = pw; Bc.height = ph;
        const bg = Bc.getContext('2d');
        bg.filter = `blur(${(2.4 * sc).toFixed(2)}px)`; bg.drawImage(M, 0, 0); bg.filter = 'none';
        const md = mg.getImageData(0, 0, pw, ph).data, bd = bg.getImageData(0, 0, pw, ph).data;
        const samp = (d, X, Y) => {
          const px = Math.floor((X - IR.x) * sc), py = Math.floor((Y - IR.y) * sc);
          return px < 0 || py < 0 || px >= pw || py >= ph ? 0 : d[(py * pw + px) * 4 + 3] / 255;
        };
        const nG = makeNoise(4401), nM = makeNoise(4402), nS = makeNoise(4403);
        pixels(g, IR.x, IR.y, IR.w, IR.h, (X, Y, o) => {
          const m = samp(md, X, Y), b = samp(bd, X, Y);
          if (m < 0.004 && b < 0.004) { o[3] = 0; return; }
          const dry = dryAt(X, Y);
          const gr = 0.6 * nG(X * 0.45, Y * 0.45) + 0.4 * nG(X * 1.1 + 31, Y * 1.1 + 17), mm = nM(X * 0.07, Y * 0.07);
          const pore = sstep(0.74, 0.88, gr);
          // 飞白顺着笔势：由洇开遮罩的梯度估出笔画走向，丝纹沿笔走、横向细密
          let gx = samp(bd, X + 1.5, Y) - samp(bd, X - 1.5, Y), gy = samp(bd, X, Y + 1.5) - samp(bd, X, Y - 1.5);
          const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
          const su = -X * gy + Y * gx, sv = X * gx + Y * gy;
          const s = nS(su * 0.045 + 50, sv * 0.42 + 50);
          const hole = sstep(0.78 - 0.22 * dry, 0.9 - 0.22 * dry, s) * (1 - sstep(0.78, 0.96, b));
          const a = m * (0.9 + 0.1 * mm) * (1 - 0.35 * pore) * (1 - 0.85 * hole);
          const halo = 0.22 * b * (0.45 + 0.9 * mm) * (1 - m);
          const sheen = clamp(m - samp(md, X + LX * 1.8, Y + LY * 1.8), 0, 1) * (1 - pore) * (1 - hole);
          const pool = clamp((m - b) * 2, 0, 1);
          const v = 14 - 5 * pool;
          o[0] = v + 34 * sheen; o[1] = v + 1 + 38 * sheen; o[2] = v + 4 + 46 * sheen;
          o[3] = Math.round(255 * clamp(a + halo * (1 - a), 0, 1));
        });
        // 静止的短墨滴：从笔画下缘垂下，细而渐淡，末端一颗小墨珠
        for (const d of layout().sdrips) {
          const gr = g.createLinearGradient(0, d.y - 2, 0, d.y + d.L);
          gr.addColorStop(0, 'rgba(13,14,17,0.92)'); gr.addColorStop(0.7, 'rgba(13,14,17,0.55)'); gr.addColorStop(1, 'rgba(13,14,17,0.3)');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(d.x - d.w / 2, d.y - 2);
          g.quadraticCurveTo(d.x - d.w * 0.22, d.y + d.L * 0.5, d.x - d.w * 0.16, d.y + d.L);
          g.lineTo(d.x + d.w * 0.16, d.y + d.L);
          g.quadraticCurveTo(d.x + d.w * 0.22, d.y + d.L * 0.5, d.x + d.w / 2, d.y - 2);
          g.fill();
          g.fillStyle = 'rgba(13,14,17,0.5)';
          g.beginPath(); g.ellipse(d.x, d.y + d.L, d.w * 0.42, d.w * 0.56, 0, 0, TAU); g.fill();
        }
      });
    }
    // 大股水冲过的竖带（软边）：第二行末字的中竖与第一行末字捺尾都在其中
    const BAND = { x: BIGX - 46, y: 228, w: 92, h: 312 };
    function bandMaskTex() {
      return K.cache('ff5_e5_bandmask', BAND.w, BAND.h, 1, (g) => {
        const gr = g.createLinearGradient(0, 0, BAND.w, 0);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.2, 'rgba(0,0,0,1)');
        gr.addColorStop(0.8, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, BAND.w, BAND.h);
        g.globalCompositeOperation = 'destination-in';
        const gv = g.createLinearGradient(0, 0, 0, 9);
        gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gv; g.fillRect(0, 0, BAND.w, BAND.h);
      });
    }
    function bandMask(g) { g.drawImage(bandMaskTex(), BAND.x, BAND.y, BAND.w, BAND.h); }
    function bigLayer() {
      return K.cache('ff5_e5_big' + CUR.fk, BAND.w, BAND.h, 1, (g) => {
        g.translate(-BAND.x, -BAND.y);
        g.globalAlpha = 0.95;
        g.drawImage(inkLayer(), 0, 0, W, H);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'destination-in';
        bandMask(g);
        g.globalCompositeOperation = 'source-over';
      });
    }

    // ---------- 石壁、岩檐与地面（静态底层） ----------
    function wallLayer() {
      return K.cache('ff5_e5_wall', W, H, 1, (g) => {
        const nA = makeNoise(11), nB = makeNoise(23), nC = makeNoise(37), nD = makeNoise(51);
        const wallCells = makeCells(71, 132, 132, 11, 6), eaveCells = makeCells(83, 150, 90, 10, 5), gCells = makeCells(97, 120, 120, 12, 6);
        const lip = new Float32Array(W + 2), ft = new Float32Array(W + 2);
        for (let x = 0; x <= W + 1; x++) { lip[x] = lipY(x); ft[x] = footY(x); }
        const bx = new Float32Array(H + 2); for (let y = 0; y <= H + 1; y++) bx[y] = butX(y);
        const bump = (x, y) => 0.6 * nB(x * 0.03, y * 0.03) + 0.4 * nB(x * 0.07 + 7, y * 0.07 + 3);
        const hBig = (x, y) => 0.65 * nA(x * 0.0065 + 3, y * 0.0065 + 8) + 0.35 * nA(x * 0.016 + 1, y * 0.016 + 2);
        const vc = {};
        pixels(g, 0, 0, W, H, (X, Y, o) => {
          const xi = X | 0, yi = Y | 0, lp = lip[xi], fy = ft[xi];
          if (Y < lp) {
            // 岩檐：暗而稳，近口沿处略亮
            eaveCells(X, Y * 2.2 + 400, vc);
            const e = sstep(lp - 26, lp, Y);
            let l = 0.07 + 0.04 * (vc.tone - 0.5) + 0.05 * (nC(X * 0.03, Y * 0.06) - 0.5);
            l += e * (0.08 + 0.06 * Math.exp(-((X - 480) * (X - 480)) / 4e5));
            rockCol(l, o, 0);
            return;
          }
          const isBut = X < bx[yi] && Y < fy + 30, cw = cleftW(Y);
          if (!isBut && cw > 0.5 && X < bx[yi] + cw && Y < fy - 4) {
            // 缝里：远处的夜色与薄雾，越往下雾越亮；缝的两沿略暗
            const v = clamp((Y - 304) / 188, 0, 1), e = (X - bx[yi]) / cw, mist = 0.5 + 0.5 * nC(X * 0.05, Y * 0.02);
            const ed = 1 - 0.35 * sstep(0.7, 1, e) - 0.25 * sstep(0.25, 0, e);
            o[0] = (17 + 10 * v * mist) * ed; o[1] = (21 + 11 * v * mist) * ed; o[2] = (31 + 12 * v * mist) * ed;
            return;
          }
          if (Y < fy || isBut) {
            // 转折面上的纹理按透视横向压缩
            const Xs = X > XC ? XC + (X - XC) * 2.3 : X, side = sstep(XC - 1.5, XC + 2.5, X);
            // 节理：扭曲后的维诺格，只有部分边界显出裂缝
            const wx = Xs + 34 * (nC(Xs * 0.007, Y * 0.007) - 0.5), wy = Y + 34 * (nC(Xs * 0.007 + 50, Y * 0.007) - 0.5);
            wallCells(wx, wy * 0.62, vc);
            const dx = (X - 760) / 470, dy = (Y - 366) / 175;
            const flat = clamp(1.3 - Math.sqrt(dx * dx + dy * dy), 0, 1);
            const rough = 1 - 0.75 * flat;
            const cv = rough * sstep(0.5, 0.7, nD(Xs * 0.012 + 9, Y * 0.012));
            // 一片远处来的冷光落在书写面上，四周渐暗
            const lx = (X - 640) / 560, ly = (Y - 350) / 260;
            let l = 0.11 + Math.exp(-(lx * lx + ly * ly)) * 0.42;
            l -= sstep(lp + 90, lp, Y) * 0.13;
            // 岩檐下深一层的悬垂阴影（下缘参差）
            l -= sstep(lp + 24 + 18 * nC(X * 0.02, 5.5), lp, Y) * 0.17;
            l -= sstep(1080, 1290, X) * 0.06;
            // 右端转折面背光更暗，转折棱上一线受光
            l -= side * (0.08 + 0.05 * sstep(XC, W, X));
            l += 0.05 * Math.exp(-((X - XC - 1) * (X - XC - 1)) / 5) * sstep(lp, lp + 20, Y);
            // 石面小块面：各自微倾，交界处柔和过渡
            const fw = sstep(-4, 4, vc.d);
            l += (lerp((vc.tone + vc.tone2) / 2, vc.tone, fw) - 0.5) * 0.11 * (0.4 + 0.6 * rough);
            if (vc.d < 5) { const k = 1 - vc.d / 5; l += 0.05 * k * k * (vc.nx * LX + vc.ny * LY) * cv; }
            if (vc.d < 0.9) l -= 0.1 * cv * (1 - vc.d / 0.9);
            // 大起伏与细纹理的受光
            const sb = hBig(Xs - 3, Y - 4.5) - hBig(Xs + 3, Y + 4.5);
            l += sb * 1.0 * (0.6 + 0.4 * rough);
            const sh = bump(Xs - 1.2, Y - 1.8) - bump(Xs + 1.2, Y + 1.8);
            l += sh * (0.14 + 0.26 * rough);
            l += (0.6 * nD(Xs * 0.13, Y * 0.13) + 0.4 * nD(Xs * 0.35, Y * 0.35) - 0.5) * 0.035;
            // 檐下水痕：长短不一的竖向暗舌
            const tl = 30 + 230 * Math.pow(nA(Xs * 0.021, 3.3), 2.2);
            const st = (1 - clamp((Y - lp) / tl, 0, 1)) * (0.5 + 0.5 * nD(Xs * 0.35, Y * 0.004));
            l -= st * 0.07;
            // 湿面冷光：朝光的大起伏上一层柔亮
            l += sstep(0.01, 0.05, sb) * 0.05;
            l -= sstep(fy - 26, fy, Y) * 0.1;
            let lich = (rough + 0.4 * side) * sstep(0.54, 0.8, nA(Xs * 0.008 + 20, Y * 0.01)) * 0.62;
            if (isBut) {
              // 左侧前凸的岩柱：更近、更暗，右缘背光
              l = l * 0.7 - 0.02 - sstep(bx[yi] - 14, bx[yi], X) * 0.08;
              lich *= 1.4;
            } else if (X < bx[yi] + 70) {
              l -= 0.1 * (1 - (X - bx[yi]) / 70) * sstep(lp, lp + 30, Y);
              if (cw > 0.5) l -= 0.08 * (1 - clamp((X - bx[yi] - cw) / 10, 0, 1));
            }
            rockCol(l, o, clamp(lich, 0, 1));
            return;
          }
          // 壁脚以下：湿岩台地，纹理被透视压扁；近壁处有壁面的湿反光
          const d = clamp((Y - fy) / 180, 0, 1);
          let l = 0.12 + 0.07 * (nC(X * 0.012, Y * 0.06) - 0.5) + 0.05 * (nD(X * 0.05, Y * 0.25) - 0.5);
          l += 0.08 * (1 - d) * sstep(0.4, 0.7, nA(X * 0.01, Y * 0.05)) * (0.6 + 0.4 * nD(X * 0.2, Y * 0.02));
          l -= d * 0.04;
          l -= sstep(fy + 12, fy, Y) * 0.06;
          rockCol(l, o, 0.12);
        });
        // 左侧一道细长裂隙：暗线，迎光的右沿一线冷光
        const r = A.rng(808);
        const fis = [];
        for (let y = lipY(262) + 30, x = 262; y < FOOT - 40; y += 10 + r() * 16) { fis.push([x, y]); x += (r() - 0.5) * 9; }
        g.strokeStyle = 'rgba(10,11,14,0.7)'; g.lineWidth = 1.8;
        g.beginPath(); fis.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.strokeStyle = 'rgba(140,150,166,0.16)'; g.lineWidth = 1;
        g.beginPath(); fis.forEach(([x, y], i) => (i ? g.lineTo(x + 1.6, y) : g.moveTo(x + 1.6, y))); g.stroke();
        // 另两道裂隙（在题字左右两侧，避开题字）：暗线，迎光一沿一线冷光，缝边几片地衣
        for (const [cx0, y0, y1, sd] of [[1104, lipY(1104) + 14, 478, 809], [376, 296, 470, 810]]) {
          const rc = A.rng(sd), pts = [];
          for (let y = y0, x = cx0; y < y1; y += 8 + rc() * 14) { pts.push([x, y]); x += (rc() - 0.45) * 8; }
          g.strokeStyle = 'rgba(9,10,13,0.62)'; g.lineWidth = 1.6;
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
          g.strokeStyle = 'rgba(140,150,166,0.14)'; g.lineWidth = 1;
          g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + 1.5, y) : g.moveTo(x + 1.5, y))); g.stroke();
          for (let i = 0; i < 7; i++) { const [x, y] = pts[Math.floor(rc() * pts.length)]; A.glow(g, x + (rc() - 0.5) * 14, y, 6 + rc() * 10, '#5f6b55', 0.16); }
        }
        // 檐下与右端转折面上的地衣
        { const rl = A.rng(8181); for (let i = 0; i < 26; i++) { const x = rl() < 0.4 ? XC + rl() * 100 : 140 + rl() * 1020, y = lipY(x) + 8 + rl() * (rl() < 0.6 ? 40 : 300); if (x > 430 && x < 960 && y > 225 && y < 445) continue; A.glow(g, x, y, 5 + rl() * 12, rl() < 0.5 ? '#56634f' : '#6a7360', 0.14); } }
        // 岩柱右缘一线暗边
        g.strokeStyle = 'rgba(6,7,9,0.55)'; g.lineWidth = 2;
        g.beginPath();
        for (let y = lipY(120); y <= FOOT + 30; y += 4) { const x = butX(y); y === lipY(120) ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.stroke();
        // 壁脚接触暗线
        g.fillStyle = 'rgba(8,10,13,0.55)';
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 8) g.lineTo(x, footY(x) - 2);
        for (let x = W + 10; x >= -10; x -= 8) g.lineTo(x, footY(x) + 5);
        g.closePath(); g.fill();
        // 檐口：口沿立面受一点冷光（柔和的亮带），沿口一线断续的湿光
        g.save();
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 5) g.lineTo(x, lipY(x));
        for (let x = W + 10; x >= -10; x -= 5) g.lineTo(x, lipY(x) - 16);
        g.closePath(); g.clip();
        g.fillStyle = A.vgrad(g, 140, 220, [[0, 'rgba(120,132,150,0)'], [1, 'rgba(120,132,150,0.16)']]); g.fillRect(0, 130, W, 100);
        g.restore();
        // 沿口断续的湿光：长短不一、明暗不一
        {
          const rl = A.rng(7171);
          for (let x = -10; x < W + 10;) {
            const len = 8 + rl() * 54, gap = 6 + rl() * 70;
            if (rl() < 0.75) {
              g.strokeStyle = `rgba(150,162,178,${0.1 + 0.22 * rl()})`; g.lineWidth = 0.8 + rl() * 0.7;
              const off = -0.3 - rl() * 1.2;
              g.beginPath();
              for (let xx = x; xx <= x + len; xx += 3) { const yy = lipY(xx) + off; xx === x ? g.moveTo(xx, yy) : g.lineTo(xx, yy); }
              g.stroke();
            }
            x += len + gap;
          }
        }
        // 壁脚碎石与坍落的碎石堆：受左上光
        for (let i = 0; i < 22; i++) {
          const x = 160 + r() * 1100, y = footY(x) + 5 + r() * 12, rr = 2 + r() * 5;
          if (x > 740 && x < 1200) continue;
          stone(g, x, y, rr * 1.8, rr, i * 3.1);
        }
        for (const [tx, w, h] of TALUS) {
          const n = Math.round(w * 0.5);
          for (let i = 0; i < n; i++) {
            const u = (r() - 0.5) * 1.8, x = tx + u * w, top = footY(x), y = top + 2 + r() * (FOOT + 14 - top), rr = 1.6 + r() * (h * 0.22 + 2);
            stone(g, x, y, rr * (1.3 + r() * 0.8), rr, i * 1.9 + tx);
          }
        }
      });
    }
    function baseLayer() {
      return K.cache('ff5_e5_base' + CUR.fk, W, H, 1, (g) => {
        g.drawImage(wallLayer(), 0, 0, W, H);
        // 题字（大股水冲过的竖带除外；洇边已在墨层里），略透出石纹
        const tmp = document.createElement('canvas');
        const sc = g.getTransform().a;
        tmp.width = Math.round(W * sc); tmp.height = Math.round(H * sc);
        const tg = tmp.getContext('2d'); tg.scale(sc, sc);
        tg.drawImage(inkLayer(), 0, 0, W, H);
        tg.globalCompositeOperation = 'destination-out';
        bandMask(tg);
        g.globalAlpha = 0.95;
        g.drawImage(tmp, 0, 0, W, H);
        g.globalAlpha = 1;
      });
    }
    // 受左上光的扁石：暗部、顶面一线冷光、接触阴影
    function stone(g, x, y, rx, ry, seed) {
      g.fillStyle = 'rgba(5,6,8,0.55)';
      g.beginPath(); g.ellipse(x + rx * 0.12, y + ry * 0.55, rx * 1.12, ry * 0.32, 0, 0, TAU); g.fill();
      g.save(); g.translate(x, y); g.scale(rx / ry, 1);
      A.inkBlob(g, 0, 0, ry, seed, 0.2);
      const gr = g.createLinearGradient(0, -ry, 0, ry);
      gr.addColorStop(0, '#2e333c'); gr.addColorStop(0.4, '#1b1e24'); gr.addColorStop(1, '#0d0f12');
      g.fillStyle = gr; g.fill();
      g.restore();
      g.strokeStyle = 'rgba(150,162,180,0.2)'; g.lineWidth = 1;
      g.beginPath(); g.ellipse(x - rx * 0.12, y - ry * 0.25, rx * 0.62, ry * 0.5, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
    }
    // 积水边石与前景（画在水面之后）
    const FRONT_Y = 540;
    function frontLayer() {
      return K.cache('ff5_e5_front', W, H - FRONT_Y, 1, (g) => {
        g.translate(0, -FRONT_Y);
        const r = A.rng(6061);
        // 积水边十来块大小不一的石头，疏密不均，有几块半没在水里；墨流入水处留空
        for (let i = 0; i < 13; i++) {
          const a = (i / 13) * TAU + (r() - 0.5) * 0.5;
          // 只有远沿（水在石前看不到的一侧之外）的石头半没在水里；近沿的石头都在岸上
          const rr = poolR(a), sn = Math.sin(a), sub = r() < 0.38 && sn < 0.1, out = sub ? -7 - r() * 6 : 2 + r() * 8;
          const x = POOL.cx + Math.cos(a) * (POOL.rx + out) * rr, y = POOL.cy + sn * (POOL.ry + out * 0.3) * rr;
          const R = (3.5 + r() * 11) * (sn > 0 ? 1.25 : 0.75), ex = 1.3 + r() * 1.1, ey = 0.55 + r() * 0.4;
          if (Math.abs(x - BIGX) < 46 && sn < 0) continue;
          if (sub) {
            // 水线以上画石头；水线以下只在积水范围内透出一团更暗的石影，再留一线极淡的水线光
            const wl = y + R * 0.18;
            g.save(); g.beginPath(); g.rect(x - R * ex * 1.8, wl - R * 3, R * ex * 3.6, R * 3); g.clip();
            stone(g, x, y + R * 0.2, R * ex, R * ey, i * 1.7 + 3);
            g.restore();
            g.save(); poolPath(g); g.clip(); g.beginPath(); g.rect(x - R * ex * 1.8, wl, R * ex * 3.6, R * 2); g.clip();
            g.fillStyle = 'rgba(8,10,13,0.42)'; g.beginPath(); g.ellipse(x, y + R * 0.2, R * ex * 1.02, R * ey * 1.05, 0, 0, TAU); g.fill();
            g.restore();
            g.strokeStyle = 'rgba(170,184,200,0.16)'; g.lineWidth = 1;
            g.beginPath(); g.ellipse(x, wl, R * ex * 1.0, R * ey * 0.26, 0, 0.2, Math.PI - 0.2); g.stroke();
          } else stone(g, x, y + R * 0.2, R * ex, R * ey, i * 1.7 + 3);
        }
        // 左下前景巨石：近、暗，顶面受一点冷光，表面有湿亮的细纹
        const bpath = () => { g.beginPath(); g.moveTo(-20, 604); g.bezierCurveTo(50, 566, 160, 570, 232, 612); g.bezierCurveTo(282, 648, 300, 700, 312, 740); g.lineTo(-20, 740); g.closePath(); };
        const gr = g.createLinearGradient(60, 572, 150, 720);
        gr.addColorStop(0, '#2c313a'); gr.addColorStop(0.25, '#181b21'); gr.addColorStop(1, '#090a0c');
        bpath(); g.fillStyle = gr; g.fill();
        g.save(); bpath(); g.clip();
        for (let i = 0; i < 26; i++) {
          const x = r() * 290, y = 590 + r() * 120, l = 20 + r() * 60;
          g.strokeStyle = `rgba(${r() < 0.5 ? '150,162,180' : '5,6,8'},${0.06 + r() * 0.1})`; g.lineWidth = 1 + r() * 2;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l * 0.5, y - 4 + r() * 8, x + l, y + 6 + r() * 10); g.stroke();
        }
        g.restore();
        g.strokeStyle = 'rgba(160,172,190,0.28)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(6, 592); g.bezierCurveTo(60, 570, 150, 574, 214, 602); g.stroke();
        // 右下角前景石
        g.fillStyle = '#0e1013';
        g.beginPath(); g.moveTo(1186, 740); g.bezierCurveTo(1196, 690, 1236, 668, 1300, 662); g.lineTo(1300, 740); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(150,162,180,0.16)';
        g.beginPath(); g.moveTo(1200, 690); g.bezierCurveTo(1218, 674, 1250, 666, 1290, 664); g.stroke();
        // 蕨叶（顺风微倾向右）
        const fern = (x, y, len, ang, s) => {
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          const cx = x + Math.cos(ang - 0.4 * s) * len * 0.55, cy = y + Math.sin(ang - 0.4 * s) * len * 0.55;
          g.strokeStyle = '#141a16'; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
          g.fillStyle = '#172019';
          for (let k = 1; k < 16; k++) {
            const u = k / 16, it = 1 - u;
            const px = it * it * x + 2 * it * u * cx + u * u * ex, py = it * it * y + 2 * it * u * cy + u * u * ey;
            const tx = 2 * it * (cx - x) + 2 * u * (ex - cx), ty = 2 * it * (cy - y) + 2 * u * (ey - cy);
            const tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl, ll = len * 0.2 * (1 - u * 0.75);
            for (const sd of [-1, 1]) {
              const nx = -uy * sd, ny = ux * sd;
              const qx = px + nx * ll + ux * ll * 0.45, qy = py + ny * ll + uy * ll * 0.45 + 2;
              g.beginPath(); g.moveTo(px, py);
              g.quadraticCurveTo(px + nx * ll * 0.5 + ux * ll * 0.5, py + ny * ll * 0.5 + uy * ll * 0.5 - 1, qx, qy);
              g.quadraticCurveTo(px + nx * ll * 0.45 + ux * ll * 0.1, py + ny * ll * 0.45 + uy * ll * 0.1 + 2, px + ux * 2, py + uy * 2);
              g.fill();
            }
          }
          g.strokeStyle = 'rgba(150,170,180,0.12)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x, y - 1); g.quadraticCurveTo(cx, cy - 1, ex, ey - 1); g.stroke();
        };
        fern(70, 598, 124, -1.2, 1); fern(112, 596, 96, -0.72, 1); fern(42, 604, 92, -1.78, -1); fern(160, 600, 72, -0.42, 1);
        fern(1234, 668, 82, -1.38, 1); fern(1258, 670, 64, -0.88, 1);
      });
    }

    // ---------- 动态元素 ----------
    const VINES = [{ x: 46, len: 156, ph: 0.3 }, { x: 92, len: 100, ph: 1.7 }, { x: 1198, len: 160, ph: 2.6 }, { x: 1240, len: 112, ph: 4.1 }];
    function drawVines(g, t) {
      for (const v of VINES) {
        const y0 = lipY(v.x) - 2;
        const sway = (u) => Math.pow(u, 1.6) * (4.5 + 2 * Math.sin(t * TAU * 0.42 + v.ph) + 1 * Math.sin(t * TAU * 0.83 + v.ph * 2));
        const px = (u) => v.x + sway(u) + 3 * Math.sin(u * 4 + v.ph);
        g.strokeStyle = '#121714'; g.lineWidth = 1.5;
        g.beginPath();
        for (let k = 0; k <= 16; k++) { const u = k / 16; k ? g.lineTo(px(u), y0 + u * v.len) : g.moveTo(px(u), y0); }
        g.stroke();
        for (let k = 1; k <= 10; k++) {
          const u = k / 10.5, y = y0 + u * v.len, x = px(u), sd = k % 2 ? 1 : -1;
          const s = 7.5 * (1 - u * 0.35);
          g.save(); g.translate(x, y); g.rotate(sd * 0.85 + 0.12 + 0.08 * Math.sin(t * 2.6 + k));
          g.fillStyle = '#161e19';
          g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.9, s * 0.2, s * 0.7, s * 1.2, 0, s * 1.7); g.bezierCurveTo(-s * 0.7, s * 1.2, -s * 0.9, s * 0.2, 0, 0); g.fill();
          g.fillStyle = 'rgba(150,168,186,0.14)';
          g.beginPath(); g.ellipse(-s * 0.25, s * 0.55, s * 0.18, s * 0.42, 0.3, 0, TAU); g.fill();
          g.restore();
        }
      }
    }
    // 雨：三层，向右斜；檐上那段很淡（歌词区保持安静）
    let RAIN = null;
    function rainData() {
      if (RAIN) return RAIN;
      const r = A.rng(2024), mk = (n, v0, v1, len, w, a) => {
        const d = []; for (let i = 0; i < n; i++) d.push({ x: r() * (W + 200), u: r() * 900, v: v0 + r() * (v1 - v0), len: len * (0.8 + r() * 0.4), k: r() });
        return { d, w, a };
      };
      RAIN = [mk(280, 620, 760, 15, 1, 0.2), mk(110, 900, 1050, 26, 1.2, 0.24), mk(24, 1300, 1500, 60, 2.2, 0.12)];
      return RAIN;
    }
    const SLANT = 0.17;
    // 雨势加大时新增的雨丝从画外落入：按每根雨丝本轮的起落时刻判断是否出现
    function drawRain(g, t, amtAt) {
      const span = 900;
      g.lineCap = 'round';
      for (const L of rainData()) {
        for (let pass = 0; pass < 2; pass++) {
          g.beginPath();
          for (const d of L.d) {
            const u = (((d.u + d.v * t) % span) + span) % span, y = u - 80;
            if (d.k > amtAt(t - u / d.v)) continue;
            const x = ((((d.x + SLANT * u) % (W + 200)) + (W + 200)) % (W + 200)) - 100;
            const dim = y < lipY(clamp(x, 0, W)) + 8;
            if ((pass === 1) !== dim) continue;
            g.moveTo(x, y); g.lineTo(x - SLANT * d.len, y - d.len);
          }
          g.strokeStyle = `rgba(190,200,214,${pass ? L.a * 0.3 : L.a})`;
          g.lineWidth = L.w;
          g.stroke();
        }
      }
    }
    // 积水雨圈：按时间槽确定地生成
    function drawRings(g, t, rate) {
      const slot = 0.04, life = 1.0;
      g.lineWidth = 1;
      for (let j = Math.floor((t - life) / slot); j <= Math.floor(t / slot); j++) {
        const ts = j * slot, rr = rate(ts);
        for (let m = 0; m < 3; m++) {
          if (h2(j, 71 + m) > rr) continue;
          const age = t - ts - h2(j, 91 + m) * slot;
          if (age < 0 || age > life) continue;
          const a = h2(j, 31 + m) * TAU, d = Math.sqrt(h2(j, 51 + m)) * 0.9;
          const x = POOL.cx + Math.cos(a) * POOL.rx * d, y = POOL.cy + Math.sin(a) * POOL.ry * d;
          const R = 2 + 20 * Math.pow(age, 0.6);
          const al = 0.4 * Math.pow(1 - age / life, 1.6) * clamp(age / 0.05, 0, 1);
          g.strokeStyle = `rgba(178,190,206,${al})`;
          g.beginPath(); g.ellipse(x, y, R, R * 0.3, 0, 0, TAU); g.stroke();
          if (age < 0.35) { g.strokeStyle = `rgba(178,190,206,${al * 0.6})`; g.beginPath(); g.ellipse(x, y, R * 0.5, R * 0.15, 0, 0, TAU); g.stroke(); }
        }
      }
    }
    // 地面雨溅：细小的水冠与弹起的水珠（近大远小）
    function drawSplashes(g, t, rate) {
      const slot = 0.02, life = 0.24;
      g.lineWidth = 1;
      for (let j = Math.floor((t - life) / slot); j <= Math.floor(t / slot); j++) {
        const rr = rate(j * slot);
        for (let m = 0; m < 4; m++) {
          if (h2(j, 211 + m) > rr) continue;
          const age = t - j * slot - h2(j, 231 + m) * slot;
          if (age < 0 || age > life) continue;
          const x = h2(j, 251 + m) * W, y = 556 + h2(j, 271 + m) * 158;
          const dx = (x - POOL.cx) / (POOL.rx + 14), dy = (y - POOL.cy) / (POOL.ry + 10);
          if (dx * dx + dy * dy < 1) continue;
          if (x < 300 && y > 600 - (300 - x) * 0.1) continue;
          if (x > 1180 && y > 670) continue;
          const k = 0.6 + ((y - 556) / 158) * 0.9, u = age / life;
          const R = (1.5 + 6 * Math.sqrt(u)) * k, al = 0.32 * (1 - u) * clamp(age / 0.03, 0, 1);
          g.strokeStyle = `rgba(190,200,215,${al})`;
          g.beginPath(); g.ellipse(x, y, R, R * 0.28, 0, Math.PI, TAU); g.stroke();
          g.fillStyle = `rgba(200,210,225,${al * 1.2})`;
          for (let q = 0; q < 2; q++) {
            const vx = (q ? 1 : -1) * (12 + 18 * h2(j, 291 + m + q)) * k, vy = -(40 + 30 * h2(j, 301 + m + q)) * k;
            g.fillRect(x + vx * age - 0.6, y + vy * age + 0.5 * 900 * k * age * age - 0.6, 1.3, 1.3);
          }
        }
      }
    }
    // 岩檐一股水：按自由落体反推出水时刻，使水头在第一句第9字到达最大一笔顶端
    const G_PX = 588;                          // 壁高约 6 m ≈ 360 px，g ≈ 588 px/s²
    function gush(c) {
      const t0 = c.t - c.lt;
      const tHit = c.charT(8) != null ? c.charT(8) - t0 : 3.984;
      const yLip = lipY(BIGX) - 1, yTop = 240;
      const tFall = Math.sqrt((2 * (yTop - yLip)) / G_PX);
      const ts = tHit - tFall, v0 = G_PX * tFall, aw = G_PX * 0.5;
      const front = (t) => {
        const u = t - ts;
        if (u <= 0) return yLip;
        if (u < tFall) return yLip + 0.5 * G_PX * u * u;
        const w = u - tFall;
        return Math.min(FOOT + 26, yTop + v0 * w + 0.5 * aw * w * w);
      };
      const passT = (y) => {
        if (y <= yTop) return ts + Math.sqrt((2 * Math.max(0, y - yLip)) / G_PX);
        const d = y - yTop;
        return ts + tFall + (-v0 + Math.sqrt(v0 * v0 + 2 * aw * d)) / aw;
      };
      return { ts, tHit, yLip, yTop, front, passT, tFoot: passT(FOOT) };
    }
    function dripSprite() {
      return K.cache('ff5_e5_drip', 12, 80, 2, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 80);
        gr.addColorStop(0, 'rgba(15,16,19,0.85)'); gr.addColorStop(0.55, 'rgba(15,16,19,0.42)'); gr.addColorStop(1, 'rgba(15,16,19,0)');
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(1, 0); g.lineTo(11, 0); g.quadraticCurveTo(8, 40, 7, 78); g.lineTo(5, 78); g.quadraticCurveTo(4, 40, 1, 0); g.fill();
      });
    }
    // 竖向流纹（向下滚动表示水流），上下可无缝拼接
    function streakTex(kind) {
      return K.cache('ff5_e5_streak' + kind, 64, 256, 1, (g) => {
        const r = A.rng(3131 + kind * 7);
        const n = kind ? 46 : 80;
        for (let i = 0; i < n; i++) {
          const x = 3 + r() * 58, w = kind ? 0.6 + r() * 1.4 : 0.8 + r() * 3.4, y = r() * 256, l = 30 + r() * 150, a = kind ? 0.3 + r() * 0.6 : 0.12 + r() * 0.45;
          for (const oy of [-256, 0, 256]) {
            const gr = g.createLinearGradient(0, y + oy, 0, y + oy + l);
            gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.fillRect(x, y + oy, w, l);
          }
        }
      });
    }
    // 淡墨瀑痕贴图：最大一笔被冲下的淡墨，顺流拉长的灰色晕染，中间浓两边淡，越往下越宽，顺风略偏右；
    // 上面只叠几十根极淡的流丝（左右游移 ≤3px）；上缘 20px、下缘 46px 渐隐
    const TR = { x: BIGX - 60, y: 230, w: 150, h: 320 };
    const trC = (y) => BIGX + 9 * Math.pow(clamp((y - TR.y) / 300, 0, 1), 1.4);
    const trHW = (y, k) => 12 + 22 * clamp((y - TR.y) / 300, 0, 1) + 12 * (A.noise1(y * 0.018 + k * 7, 300 + k) - 0.5);
    function trailTex() {
      return K.cache('ff5_e5_trail', TR.w, TR.h, 1, (g) => {
        const nz = makeNoise(7400);
        const vfade = (Y) => sstep(TR.y, TR.y + 20, Y) * (1 - sstep(TR.y + TR.h - 46, TR.y + TR.h, Y));
        pixels(g, 0, 0, TR.w, TR.h, (x, y, o) => {
          const X = x + TR.x, Y = y + TR.y;
          const u = Math.abs(X - trC(Y)) / trHW(Y, 1);
          const env = 1 - sstep(0.45, 1.0 + 0.35 * (nz(Y * 0.035, 3.3) - 0.5) + 0.12 * (nz(X * 0.1, Y * 0.1) - 0.5), u);
          const streak = 0.55 * nz(X * 0.21, Y * 0.011) + 0.45 * nz(X * 0.52 + 20, Y * 0.028 + 7);
          const a = env * vfade(Y) * (0.3 + 0.44 * streak);
          o[0] = 40; o[1] = 44; o[2] = 52; o[3] = Math.round(255 * clamp(a, 0, 1));
        });
        g.translate(-TR.x, -TR.y);
        const r = A.rng(7373);
        g.lineCap = 'round';
        for (let i = 0; i < 40; i++) {
          const y0 = TR.y + 16 + Math.pow(r(), 1.5) * 200;
          const u = (r() - 0.5) * 1.5, x0 = trC(y0) + u * trHW(y0, 1);
          const len = 40 + Math.pow(r(), 0.8) * (TR.y + TR.h - y0 - 30);
          const w = 0.7 + r() * 1.3, a = 0.06 + r() * 0.14, sd = r() * 100;
          const gr = g.createLinearGradient(0, y0, 0, y0 + len);
          gr.addColorStop(0, 'rgba(36,40,48,0)'); gr.addColorStop(0.15, `rgba(36,40,48,${a})`); gr.addColorStop(0.6, `rgba(36,40,48,${a * 0.6})`); gr.addColorStop(1, 'rgba(36,40,48,0)');
          g.strokeStyle = gr; g.lineWidth = w;
          g.beginPath();
          for (let k = 0; k <= 12; k++) {
            const yy = y0 + (len * k) / 12;
            const x = x0 + (trC(yy) - trC(y0)) + u * (trHW(yy, 1) - trHW(y0, 1)) * 0.5 + 6 * (A.noise1(yy * 0.02 + sd, 400) - 0.5);
            k ? g.lineTo(x, yy) : g.moveTo(x, yy);
          }
          g.stroke();
        }
        // 题字所在的几行里瀑痕很淡（字仍要看得清），第二行字下方才是浓的淡墨流
        g.globalCompositeOperation = 'destination-in';
        const gw = g.createLinearGradient(0, TR.y, 0, TR.y + TR.h);
        gw.addColorStop(0, 'rgba(0,0,0,0.34)'); gw.addColorStop((436 - TR.y) / TR.h, 'rgba(0,0,0,0.34)');
        gw.addColorStop((462 - TR.y) / TR.h, 'rgba(0,0,0,1)'); gw.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gw; g.fillRect(TR.x, TR.y, TR.w, TR.h);
        g.globalCompositeOperation = 'destination-out';
        const gt = g.createLinearGradient(0, TR.y, 0, TR.y + 20);
        gt.addColorStop(0, 'rgba(0,0,0,1)'); gt.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gt; g.fillRect(TR.x, TR.y, TR.w, 20);
        const gb = g.createLinearGradient(0, TR.y + TR.h - 46, 0, TR.y + TR.h);
        gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gb; g.fillRect(TR.x, TR.y + TR.h - 46, TR.w, 46);
        g.globalCompositeOperation = 'source-over';
      });
    }
    // 水流的流纹贴图（冷灰着色）
    const gushTex = () => tinted('ff5_e5_gushtex', streakTex(1), '#b2bdcb');
    // 水冲过之后的字：墨被冲软、略晕开，并被水往下拖出几道淡影；字形仍清楚（约八成浓度）
    function ghostLayer() {
      return K.cache('ff5_e5_ghost' + CUR.fk, BAND.w, BAND.h, 1, (g) => {
        const sc = g.getTransform().a;
        g.translate(-BAND.x, -BAND.y);
        g.filter = `blur(${(1.3 * sc).toFixed(2)}px)`;
        for (const [dy, a] of [[11, 0.1], [6, 0.16], [2.5, 0.26]]) { g.globalAlpha = a; g.drawImage(inkLayer(), 0, dy, W, H); }
        g.globalAlpha = 0.8;
        g.drawImage(inkLayer(), 0, 0, W, H);
        g.filter = 'none'; g.globalAlpha = 1;
        g.globalCompositeOperation = 'destination-in'; bandMask(g); g.globalCompositeOperation = 'source-over';
      });
    }
    function tinted(key, src, col) {
      return K.cache(key, src.lw, src.lh, 1, (g) => {
        g.drawImage(src, 0, 0, src.lw, src.lh);
        g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, src.lw, src.lh);
      });
    }
    function inkCloudTex(k) {
      return K.cache('ff5_e5_cloud' + k, 256, 256, 1, (g) => {
        const nz = makeNoise(500 + k * 13);
        pixels(g, 0, 0, 256, 256, (X, Y, o) => {
          const dx = (X - 128) / 128, dy = (Y - 128) / 128, r = Math.sqrt(dx * dx + dy * dy);
          const ang = Math.atan2(dy, dx);
          const n = 0.5 * nz(X * 0.03, Y * 0.03) + 0.3 * nz(X * 0.07 + 9, Y * 0.07) + 0.2 * nz(X * 0.16, Y * 0.16 + 4);
          const tend = 0.5 + 0.5 * Math.sin(ang * 5 + n * 6);
          const edge = 1 - sstep(0.35 + 0.45 * n * (0.6 + 0.4 * tend), 1.0, r * 1.15);
          const a = clamp(edge * (0.45 + 0.75 * n), 0, 1);
          o[0] = 16; o[1] = 17; o[2] = 20; o[3] = Math.round(255 * a);
        });
      });
    }

    // 细流冲刷带：所有交叉段上的石面（无墨），中间实、两边羽化；每帧按冲刷进度取用
    function washLayer() {
      return K.cache('ff5_e5_wash' + CUR.fk, W, H, 1, (g) => {
        const wall = wallLayer();
        for (const r of layout().riv) {
          for (const [ya, yb] of r.cross) {
            for (const [hw, al] of [[3.8, 0.5], [2.1, 1]]) {
              g.save(); g.beginPath();
              for (let y = ya - 2; y < yb + 2; y += 2) g.lineTo(r.xs(y) - hw, y);
              g.lineTo(r.xs(yb + 2) - hw, yb + 2); g.lineTo(r.xs(yb + 2) + hw, yb + 2);
              for (let y = yb + 2; y >= ya - 2; y -= 2) g.lineTo(r.xs(y) + hw, y);
              g.closePath(); g.clip();
              g.globalAlpha = al; g.drawImage(wall, 0, 0, W, H);
              g.restore();
            }
          }
        }
      });
    }
    // 檐水细流：先冲淡流经的笔画（露出石面），再把墨拖成向下的墨痕；水流本身是一道深色湿痕，几点亮光顺流而下
    function drawTrickles(g, t, Lr, refl) {
      const wash = washLayer(), ws = wash.width / W;
      for (const r of Lr.riv) {
        if (t < r.t0) continue;
        const fy = footY(r.x), front = Math.min(fy + 2, r.y0 + r.v * (t - r.t0));
        if (!refl) {
          for (const [ya, yb] of r.cross) {
            const ta = r.t0 + (ya - r.y0) / r.v;
            if (t <= ta) continue;
            const yy = Math.min(front, yb + 2), k = 0.36 * smooth((t - ta) / 0.8), x0 = r.x - 9, h = yy - ya + 2;
            if (h <= 0) continue;
            g.globalAlpha = k;
            g.drawImage(wash, x0 * ws, (ya - 2) * ws, 18 * ws, h * ws, x0, ya - 2, 18, h);
          }
          g.globalAlpha = 1;
        }
        // 墨痕：交叉段下方，起点浓，向下按 Lk 变淡（Lk 随时间变长但有上限，墨被带走后整体变淡）
        const drags = [];
        for (const [ya, yb] of r.cross) {
          const tb = r.t0 + (yb - r.y0) / r.v;
          if (t <= tb || front - yb < 2) continue;
          const age = t - tb, Lk = 18 + 34 * Math.min(age, 2.5);
          drags.push([yb, Lk, Math.min(Math.min(front, fy) - yb, Lk * 2.2), 0.46 * (0.55 + 0.45 * Math.exp(-age / 2)) * smooth(age / 0.25)]);
        }
        const dragA = (y) => {
          let keep = 1;
          for (const [yb, Lk, span, a0] of drags) {
            const d = y - yb;
            if (d < 0 || d > span) continue;
            keep *= 1 - a0 * Math.exp(-d / Lk) * (1 - smooth((d - span * 0.8) / (span * 0.2 + 1e-3)));
          }
          return 1 - keep;
        };
        const N = Math.max(2, Math.ceil((front - r.y0) / 8)), wt = 2.5 + 1.5 * h2(r.x | 0, 3);
        const path = () => { g.beginPath(); for (let y = r.y0; y < front; y += 4) { const x = r.xs(y); y === r.y0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.lineTo(r.xs(front), front); };
        g.lineCap = 'round';
        if (refl) {
          if (!drags.length) continue;
          const gr = g.createLinearGradient(0, r.y0, 0, front + 1);
          for (let k = 0; k <= N; k++) gr.addColorStop(k / N, `rgba(15,16,19,${0.3 * dragA(lerp(r.y0, front, k / N))})`);
          g.strokeStyle = gr; g.lineWidth = 6; path(); g.stroke();
          continue;
        }
        // 湿痕：6–8px 的软边淡带（外 8px、内 4px 两层叠出软边），本身很淡；深色只来自笔画下方拖出的墨
        const go = g.createLinearGradient(0, r.y0, 0, front + 1), gi = g.createLinearGradient(0, r.y0, 0, front + 1);
        for (let k = 0; k <= N; k++) {
          const y = lerp(r.y0, front, k / N), wet = 0.07 + 0.05 * A.noise1(y * 0.03, r.x | 0), d = dragA(y);
          go.addColorStop(k / N, `rgba(13,14,17,${0.5 * wet + 0.42 * d})`);
          gi.addColorStop(k / N, `rgba(13,14,17,${0.55 * wet + 0.6 * d})`);
        }
        g.strokeStyle = go; g.lineWidth = 6.5; path(); g.stroke();
        g.strokeStyle = gi; g.lineWidth = 3.2; path(); g.stroke();
        if (front < fy) {
          g.fillStyle = 'rgba(10,12,15,0.22)'; g.beginPath(); g.ellipse(r.xs(front), front - 1, wt * 0.62, wt * 0.95, 0, 0, TAU); g.fill();
          g.fillStyle = 'rgba(200,210,224,0.26)'; g.fillRect(r.xs(front) - 0.6, front - 2.2, 1.1, 1.1);
        }
        for (let k = 0; k < 2; k++) {
          const P = 380, vg = 120 + 40 * h2(k, r.x | 0), yk = r.y0 + (((t - r.t0) * vg + k * 190) % P);
          if (yk > front - 2) continue;
          const al = 0.3 * Math.sin((Math.PI * (yk - r.y0)) / P) * smooth((front - yk) / 12);
          g.fillStyle = `rgba(214,224,238,${al})`; g.fillRect(r.xs(yk) - 0.6, yk - 1.2, 1.2, 2.4);
        }
      }
    }
    // 墙面上的动态墨流与水（倒影模式 refl 只画大件）
    function drawWallDynamics(g, t, Lr, gs, refl) {
      drawTrickles(g, t, Lr, refl);
      if (!refl) {
        const spr = dripSprite();
        g.globalAlpha = 0.85;
        for (const d of Lr.drips) {
          if (t < d.t0) continue;
          const L = d.L * (1 - Math.exp(-(t - d.t0) / d.tau));
          if (L < 0.6) continue;
          g.drawImage(spr, d.x - d.w / 2, d.y - 1, d.w, L + 2);
        }
        g.globalAlpha = 1;
      }
      // 大股水冲下的淡墨瀑痕：墨痕随水头向下延伸（前沿 24px 软过渡），墨痕本身不动，之后慢慢变淡
      if (t > gs.tHit - 0.02) {
        const f = gs.front(t), bot = Math.min(f, TR.y + TR.h);
        if (bot > TR.y) {
          const age = t - gs.tHit, kin = clamp(age / 0.2, 0, 1), fade = 0.8 + 0.4 * Math.exp(-age / 1.3);
          const tex = trailTex(), sc = tex.width / TR.w, A0 = (refl ? 0.65 : 1) * kin * fade;
          const hh = Math.min(TR.h, bot - TR.y), hs = Math.max(0, hh - 24);
          g.globalAlpha = A0;
          if (hs > 0) g.drawImage(tex, 0, 0, TR.w * sc, hs * sc, TR.x, TR.y, TR.w, hs);
          for (let k = 0; k < 4; k++) {
            const y0 = hs + k * 6; if (y0 >= hh) break;
            const h = Math.min(6, hh - y0);
            g.globalAlpha = A0 * (1 - (k + 0.5) / 4);
            g.drawImage(tex, 0, y0 * sc, TR.w * sc, h * sc, TR.x, TR.y + y0, TR.w, h);
          }
          g.globalAlpha = 1;
          // 最先冲下的一舌浓墨（边缘柔和）
          if (f < FOOT + 30) {
            const L = 90, cx = trC(f), hg = g.createLinearGradient(0, f - L, 0, f + 2);
            const a = (refl ? 0.2 : 0.34) * kin * clamp((FOOT + 30 - f) / 40, 0, 1);
            hg.addColorStop(0, 'rgba(13,14,17,0)'); hg.addColorStop(0.75, `rgba(13,14,17,${a})`); hg.addColorStop(1, `rgba(13,14,17,${a * 0.5})`);
            g.fillStyle = hg;
            g.beginPath();
            g.moveTo(cx - 18, f - L); g.quadraticCurveTo(cx - 21, f - 20, cx - 10, f + 2);
            g.quadraticCurveTo(cx + 1, f + 7, cx + 12, f + 2); g.quadraticCurveTo(cx + 22, f - 20, cx + 19, f - L);
            g.closePath(); g.fill();
          }
        }
        // 壁脚到积水之间的湿地上，墨水洇成几团软边的墨晕，0.6 s 内摊开、连成一片流进水里
        if (!refl && t > gs.tFoot) {
          const x0 = trC(FOOT);
          for (let j = 0; j < 4; j++) {
            const u = t - gs.tFoot - j * 0.12;
            if (u <= 0) continue;
            const k = smooth(u / 0.6), rx = (15 + 6 * j) * (0.5 + 0.5 * k) * (1 + 0.03 * Math.min(u, 3)), ry = rx * 0.4;
            const x = x0 + 1 + (j - 1.5) * 3 + 3 * h2(j, 77), y = FOOT + 5 + j * 8.5;
            g.save(); g.translate(x, y); g.rotate((h2(j, 79) - 0.5) * 0.3);
            g.globalAlpha = 0.42 * k * (0.78 + 0.22 * Math.exp(-u / 2));
            g.drawImage(inkCloudTex(j % 3), -rx, -ry, rx * 2, ry * 2);
            g.restore();
          }
          g.globalAlpha = 1;
        }
      }
      // 水：檐口到笔画顶端是一股自由下落的水柱（7→12px，越往下越宽），落到壁上后是贴壁流下的一片薄水；
      // 都用顺流滚动的流纹画成半透明，迎光（左）侧一线冷光；刚出水时略粗（涌），约 1 s 后稳定
      if (t > gs.ts) {
        const f = gs.front(t), sg = 1 + 0.16 * Math.exp(-Math.max(0, t - gs.tHit) / 1.1);
        const yc = Math.min(f, gs.yTop);
        const colHW = (y) => (3.5 + 2.5 * clamp((y - gs.yLip) / (gs.yTop - gs.yLip), 0, 1)) * sg;
        const colX = (y) => BIGX + 1 + 0.4 * Math.sin(y * 0.05 + t * 4);
        const front0 = f < gs.yTop ? 10 : 0;
        waterBand(g, gs, t, gs.yLip, yc - front0, colX, colHW, 4, 4, refl ? 0.5 : 1, 0.2, 0.34, 0.42, refl);
        if (f < gs.yTop) {
          // 水头碎成几颗水珠
          for (let j = 0; j < 3; j++) {
            const yb = f - j * 6.5, rb = 2.1 - 0.35 * j;
            if (yb < gs.yLip + 4) continue;
            g.fillStyle = `rgba(170,182,198,${(refl ? 0.15 : 0.32) * (1 - 0.2 * j)})`;
            g.beginPath(); g.ellipse(colX(yb) + (h2(j, 5) - 0.5) * 3, yb, rb, rb * 1.35, 0, 0, TAU); g.fill();
          }
        }
        if (f > gs.yTop) {
          const fb = Math.min(f, FOOT + 2);
          const half = (y) => (8 + 12 * clamp((y - gs.yTop) / 220, 0, 1)) * sg;
          const sx = (y) => trC(y) + 1;
          // 涌过之后水势收细成一层薄水，字透过水仍清楚
          const thin = 0.55 + 0.45 * Math.exp(-Math.max(0, t - gs.tHit) / 1.2);
          waterBand(g, gs, t, gs.yTop, fb, sx, half, 8, 4, (refl ? 0.5 : 1) * thin, 0.08, 0.2, 0.24, refl);
          // 顺流而下的几点碎光
          const span = 300;
          for (let k = 0; k < 10; k++) {
            const y = gs.yTop + ((k * 71.3 + h2(k, 16) * 40 + (t - gs.tHit) * (250 + 80 * h2(k, 15))) % span);
            if (y > fb - 4) continue;
            const x = sx(y) + (h2(k, 17) - 0.5) * 2 * half(y) * 0.7, l = 3 + 12 * h2(k, 18) * h2(k, 14);
            const al = (refl ? 0.12 : 0.3) * (0.5 + 0.5 * h2(k, 19)) * Math.sin((Math.PI * (y - gs.yTop)) / span) * smooth((fb - y) / 20);
            g.strokeStyle = `rgba(214,224,238,${al})`; g.lineWidth = 1;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke();
          }
          if (f < FOOT && !refl) A.glow(g, sx(f), f, 5, '#d8e2ee', 0.16);
        }
      }
    }
    // 软边的水带横截面（中间实、两边渐无）
    function bandProfile() {
      return K.cache('ff5_e5_bandprof', 64, 4, 1, (g) => {
        for (let x = 0; x < 64; x++) { const u = (x + 0.5) / 32 - 1; g.fillStyle = `rgba(154,166,182,${Math.pow(Math.max(0, 1 - u * u), 1.4)})`; g.fillRect(x, 0, 1, 4); }
      });
    }
    // 按行画一段水带：每行的流纹贴图坐标由水流经过该处的时刻决定（下落加速，流纹自然拉长、向下滚动）；
    // ns 股流纹并排、略有快慢；迎光一侧一线断续冷光随水下移；末端 24px 渐隐
    function waterBand(g, gs, t, yA, yB, cxF, hwF, rowH, ns, am, aBody, aStrand, aHi, refl) {
      if (yB <= yA + 0.5) return;
      const tex = gushTex(), tsc = tex.width / tex.lw, prof = bandProfile(), psc = prof.width / prof.lw, VREF = 240;
      let y0 = yA, y1 = yB;
      if (refl) { y0 = Math.max(y0, 2 * FOOT - POOL_BOT - 8); y1 = Math.min(y1, 2 * FOOT - POOL_TOP + 8); if (y1 <= y0) return; }
      const tcOf = (y, sp) => VREF * sp * (gs.passT(y) - t);
      for (let y = y0; y < y1; y += rowH) {
        const h = Math.min(rowH, y1 - y), ym = y + h / 2, cx = cxF(ym), hw = hwF(ym);
        const endF = smooth((yB - ym) / 24) * am;
        g.globalAlpha = aBody * endF;
        g.drawImage(prof, 0, 0, prof.width, prof.height, cx - hw, y, hw * 2, h);
        for (let j = 0; j < ns; j++) {
          const sp = 1 + 0.07 * (j - (ns - 1) / 2), c0 = tcOf(y, sp), c1 = tcOf(y + h, sp), hs = c1 - c0;
          if (hs <= 0.01) continue;
          const dx = cx - hw + (2 * hw * (j + 0.5)) / ns, dw = ((2 * hw) / ns) * 1.25;
          const sxx = (j * 61) % 48, a0 = ((c0 % 256) + 256) % 256;
          g.globalAlpha = aStrand * endF * (1 - 0.3 * Math.abs((j + 0.5) / ns * 2 - 1));
          if (a0 + hs <= 256) g.drawImage(tex, sxx * tsc, a0 * tsc, 16 * tsc, hs * tsc, dx - dw / 2, y, dw, h);
          else { const h1 = 256 - a0, fr = h1 / hs; g.drawImage(tex, sxx * tsc, a0 * tsc, 16 * tsc, h1 * tsc, dx - dw / 2, y, dw, h * fr); g.drawImage(tex, sxx * tsc, 0, 16 * tsc, (hs - h1) * tsc, dx - dw / 2, y + h * fr, dw, h * (1 - fr)); }
        }
        const hn = A.noise1(tcOf(ym, 1) * 0.045, 7);
        if (hn > 0.42) { g.globalAlpha = aHi * endF * smooth((hn - 0.42) / 0.2); g.fillStyle = '#ccd6e4'; g.fillRect(cx - hw * 0.62 - 0.5, y, 1, h); }
      }
      g.globalAlpha = 1;
    }
    // 冲击处的水雾：溅起后受重力回落、顺风向右散开
    function drawSpray(g, t, x, y, t0, n, seed) {
      if (t < t0) return;
      for (let i = 0; i < n; i++) {
        const born = t0 + Math.pow(h2(i, seed), 1.8) * 2.6, age = t - born;
        if (age < 0 || age > 1.0) continue;
        const vx = (h2(i, seed + 1) - 0.4) * 80, vy = -50 - h2(i, seed + 2) * 70;
        const px = x + vx * age + 16 * age * age, py = y + vy * age + 0.5 * 300 * age * age;
        A.glow(g, px, py, 2 + age * 6, '#c8d2e0', 0.22 * Math.sin(Math.PI * age));
      }
    }

    // 缝里远处的一点暖灯：只在缝内有光晕，轻微摇曳
    function drawLamp(g, t) {
      g.save();
      g.beginPath();
      for (let y = 304; y <= 492; y += 4) g.lineTo(butX(y) - 1, y);
      for (let y = 492; y >= 304; y -= 4) g.lineTo(butX(y) + cleftW(y), y);
      g.closePath(); g.clip();
      const fl = 1 + 0.05 * Math.sin(TAU * 1.7 * t) + 0.03 * Math.sin(TAU * 4.1 * t + 1);
      A.glow(g, LAMP.x, LAMP.y, 22, '#d99a52', 0.3 * fl);
      A.glow(g, LAMP.x, LAMP.y, 7, '#ffc77e', 0.75 * fl);
      g.fillStyle = 'rgba(255,226,170,0.95)'; g.beginPath(); g.arc(LAMP.x, LAMP.y, 1.5, 0, TAU); g.fill();
      g.restore();
    }
    // 右上壁面的湿亮：一层水膜映着远处微光，亮斑沿壁缓缓滑下（只在题字右侧的空壁上）
    function sheenTex() {
      return K.cache('ff5_e5_sheen', 90, 200, 1, (g) => {
        g.translate(45, 100); g.scale(1, 2.2);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 44);
        gr.addColorStop(0, 'rgba(176,192,214,0.9)'); gr.addColorStop(0.45, 'rgba(176,192,214,0.32)'); gr.addColorStop(1, 'rgba(176,192,214,0)');
        g.fillStyle = gr; g.fillRect(-45, -45, 90, 90);
      });
    }
    function drawSheen(g, t) {
      g.save();
      g.beginPath(); g.moveTo(958, lipY(958));
      for (let x = 958; x <= XC; x += 8) g.lineTo(x, lipY(x) + 4);
      g.lineTo(XC, 480); g.lineTo(958, 480); g.closePath(); g.clip();
      g.globalCompositeOperation = 'screen';
      const tex = sheenTex();
      for (let k = 0; k < 2; k++) {
        const P = 5.6, ph = ((((t + k * P / 2) % P) + P) % P) / P;
        const y = 196 + ph * 270, x = 1066 - 50 * ph + 26 * k;
        g.globalAlpha = 0.34 * Math.sin(Math.PI * ph);
        g.drawImage(tex, x - 60, y - 120, 120, 240);
      }
      g.restore();
    }
    // 左下角近处的竹叶（失焦、湿暗、迎光一沿冷亮），随风向右轻摆，叶尖挂水珠、按时滴落
    const FGA = { x: -6, y: 724 };
    const FGL = [[-1.05, 196, 27], [-0.78, 178, 26], [-0.52, 164, 24], [-1.3, 156, 22], [-0.28, 142, 20], [-1.52, 126, 18]];
    const fgTip = (k) => { const [a, L] = FGL[k], sx = 60 + 22 * k, sy = -70 - 26 * k; const d = a + 0.55; return [sx * 0.6 + Math.cos(d) * L, sy * 0.6 + Math.sin(d) * L + 0.12 * L]; };
    function fgLeafTex() {
      return K.cache('ff5_e5_fgleaf', 340, 260, 1, (g) => {
        const sc = g.getTransform().a;
        const tmp = document.createElement('canvas'); tmp.width = Math.round(340 * sc); tmp.height = Math.round(260 * sc);
        const t2 = tmp.getContext('2d'); t2.scale(sc, sc); t2.translate(30, 250);
        t2.strokeStyle = '#0b0f0d'; t2.lineWidth = 4; t2.lineCap = 'round';
        t2.beginPath(); t2.moveTo(0, 10); t2.quadraticCurveTo(70, -60, 150, -180); t2.stroke();
        FGL.forEach(([a, L, wd], k) => {
          const sx = 60 + 22 * k, sy = -70 - 26 * k, bx0 = sx * 0.6, by0 = sy * 0.6, d = a + 0.55;
          const ex = bx0 + Math.cos(d) * L, ey = by0 + Math.sin(d) * L + 0.12 * L;
          const nx = -Math.sin(d), ny = Math.cos(d), mx = (bx0 + ex) / 2 + nx * 6, my = (by0 + ey) / 2 + ny * 6 + 0.05 * L;
          const leaf = () => { t2.beginPath(); t2.moveTo(bx0, by0); t2.quadraticCurveTo(mx + nx * wd, my + ny * wd, ex, ey); t2.quadraticCurveTo(mx - nx * wd * 0.7, my - ny * wd * 0.7, bx0, by0); t2.closePath(); };
          leaf(); t2.fillStyle = k % 2 ? '#0c110f' : '#0e1412'; t2.fill();
          t2.strokeStyle = 'rgba(158,176,198,0.42)'; t2.lineWidth = 1.5;
          t2.beginPath(); t2.moveTo(bx0, by0); t2.quadraticCurveTo(mx - nx * wd * 0.7, my - ny * wd * 0.7, ex, ey); t2.stroke();
        });
        g.filter = `blur(${(1.6 * sc).toFixed(2)}px)`;
        g.drawImage(tmp, 0, 0, 340, 260);
        g.filter = 'none';
      });
    }
    function drawFgLeaves(g, t) {
      const rot = 0.012 * Math.sin(TAU * 0.33 * t) + 0.006 * Math.sin(TAU * 0.71 * t + 1);
      g.save(); g.translate(FGA.x, FGA.y); g.rotate(rot);
      g.drawImage(fgLeafTex(), -30, -250, 340, 260);
      const c = Math.cos(rot), s2 = Math.sin(rot);
      g.restore();
      for (const k of [0, 2]) {
        const [lx, ly] = fgTip(k), x = FGA.x + c * lx - s2 * ly, y = FGA.y + s2 * lx + c * ly;
        const P = 2.4 + 0.5 * k, ph = ((((t + 0.9 * k) % P) + P) % P), grow = P - 0.45;
        if (ph < grow) {
          const r = 1.2 + 1.6 * smooth(ph / grow);
          g.fillStyle = 'rgba(190,202,218,0.5)'; g.beginPath(); g.ellipse(x, y + r, r, r * 1.2, 0, 0, TAU); g.fill();
        } else {
          const u = ph - grow, yy = y + 3 + 0.5 * 900 * u * u;
          if (yy < H + 10) { g.strokeStyle = 'rgba(196,208,222,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, yy - Math.min(14, 900 * u * 0.03)); g.lineTo(x, yy); g.stroke(); }
        }
      }
    }
    // 拍点水滴的水冠：一圈细水珠向上抛起再落回（第一句第5字后才有）
    function drawCrowns(g, c, t0, tQ) {
      const b = c.b;
      for (let i = b.i - 1; i <= b.i; i++) {
        const tb = c.grid.time(i), age = c.t - tb;
        if (age < 0 || age > 0.42 || tb - t0 < tQ - 0.05) continue;
        for (let m = 0; m < 2; m++) {
          const a = h2(i, 7 + m) * TAU, d = 0.25 + 0.6 * h2(i, 9 + m);
          const x = POOL.cx + Math.cos(a) * POOL.rx * d, y = POOL.cy + Math.sin(a) * POOL.ry * d;
          const fade = 1 - age / 0.42;
          g.fillStyle = `rgba(206,216,230,${0.55 * fade})`;
          for (let q = 0; q < 10; q++) {
            const an = (q / 10) * TAU + h2(i, 13 + m) * 2, vh = 34 + 16 * h2(i * 10 + q, 17 + m), v0 = 70 + 30 * h2(i * 10 + q, 19 + m);
            const px = x + Math.cos(an) * vh * age, py = y + Math.sin(an) * vh * 0.3 * age - (v0 * age - 450 * age * age);
            if (py > y + Math.sin(an) * vh * 0.3 * age + 0.5) continue;
            g.fillRect(px - 0.7, py - 0.7, 1.4, 1.4);
          }
          if (age < 0.28) {
            const hj = 90 * age - 320 * age * age;
            if (hj > 0) { g.strokeStyle = `rgba(206,216,230,${0.5 * fade})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - hj); g.stroke(); }
          }
        }
      }
    }

    function draw(g, c) {
      CUR.fk = fontKey();
      const t = c.lt, Lr = layout(), gs = gush(c), t0 = c.t - c.lt;
      const base = baseLayer(), front = frontLayer(), big = bigLayer();
      // 雨势：第一句第5字加大
      const tQ = c.charT(4) != null ? c.charT(4) - t0 : 2.044;
      const amtAt = (ts) => 0.55 + 0.45 * sstep(tQ - 0.2, tQ + 0.6, ts);
      const z = 1 + 0.03 * easeInOut(clamp(t / c.dur, 0, 1));
      g.save();
      g.translate(880, 400); g.scale(z, z); g.translate(-880, -400);
      g.drawImage(base, 0, 0, W, H);
      // 最大一笔：水头经过后逐段被冲走，只留一层模糊的淡墨渍；冲刷前沿是约 0.6 s 的柔和过渡
      const S = scratchCanvas('e5big', BAND.w, BAND.h);
      if (t > gs.tHit - 0.05) {
        const wv = (y) => smooth((t - gs.passT(Math.max(y, gs.yTop)) + 0.05) / 0.6);
        const grW = S.g.createLinearGradient(0, 0, 0, BAND.h), grK = S.g.createLinearGradient(0, 0, 0, BAND.h);
        for (let k = 0; k <= 32; k++) { const w = wv(BAND.y + (BAND.h * k) / 32); grW.addColorStop(k / 32, `rgba(0,0,0,${w})`); grK.addColorStop(k / 32, `rgba(0,0,0,${1 - w})`); }
        S.g.drawImage(ghostLayer(), 0, 0, BAND.w, BAND.h);
        S.g.globalCompositeOperation = 'destination-in'; S.g.fillStyle = grW; S.g.fillRect(0, 0, BAND.w, BAND.h);
        const S2 = scratchCanvas('e5big2', BAND.w, BAND.h);
        S2.g.drawImage(big, 0, 0, BAND.w, BAND.h);
        S2.g.globalCompositeOperation = 'destination-in'; S2.g.fillStyle = grK; S2.g.fillRect(0, 0, BAND.w, BAND.h);
        S.g.globalCompositeOperation = 'source-over';
        S.g.drawImage(S2.c, 0, 0, BAND.w, BAND.h);
      } else S.g.drawImage(big, 0, 0, BAND.w, BAND.h);
      g.drawImage(S.c, BAND.x, BAND.y, BAND.w, BAND.h);
      drawLamp(g, t);
      drawSheen(g, t);
      drawWallDynamics(g, t, Lr, gs, false);
      // 檐口积水渐满：出水前口沿上一颗渐大的水珠，出水后 0.3 s 内隐去
      if (t > gs.ts - 0.9) {
        const k = clamp((t - (gs.ts - 0.9)) / 0.9, 0, 1), off = 1 - smooth((t - gs.ts) / 0.3);
        if (off > 0) A.glow(g, BIGX + 1, gs.yLip + 2, 4 + 3 * k, '#d6e0ee', 0.3 * k * off);
      }
      drawSpray(g, t, BIGX + 1, gs.yTop, gs.tHit, 34, 41);

     
      // ---------- 积水：壁下部倒影（以壁脚线翻转）、墨云、雨圈 ----------
      g.save();
      poolPath(g); g.clip();
      const sc = base.width / W;
      const xa = POOL.cx - POOL.rx * 1.12, xb = POOL.cx + POOL.rx * 1.12;
      for (let y = POOL_TOP - 2; y < POOL_BOT + 2; y += 3) {
        const ys = 2 * FOOT - y - 3;
        const dx = 0.75 * Math.sin(y * 0.21 + t * 2.3) + 0.4 * Math.sin(y * 0.071 - t * 1.6);
        g.drawImage(base, xa * sc, ys * sc, (xb - xa) * sc, 3 * sc, xa + dx, y, xb - xa, 3.2);
        if (ys >= BAND.y && ys < BAND.y + BAND.h) g.drawImage(S.c, 0, (ys - BAND.y) * sc, BAND.w * sc, 3 * sc, BAND.x + dx, y, BAND.w, 3.2);
      }
      g.save();
      g.translate(0, 2 * FOOT); g.scale(1, -1);
      drawWallDynamics(g, t, Lr, gs, true);
      g.restore();
      // 倒影比实物暗、偏冷
      g.fillStyle = 'rgba(10,14,22,0.2)';
      g.fillRect(xa - 10, POOL_TOP - 4, xb - xa + 20, POOL_BOT - POOL_TOP + 8);
      // 掠射角下水面更亮：远端一层冷银色的反光
      g.fillStyle = A.vgrad(g, POOL_TOP, POOL_BOT, [[0, 'rgba(150,164,184,0.16)'], [0.5, 'rgba(150,164,184,0.05)'], [1, 'rgba(150,164,184,0)']]);
      g.fillRect(xa - 10, POOL_TOP - 4, xb - xa + 20, POOL_BOT - POOL_TOP + 8);
      // 墨云：浓墨从入水处涌进积水，顺着水面向右（风向）铺开、化淡
      const tIn = gs.tFoot + 0.22;
      if (t > tIn) {
        const age = t - tIn;
        for (let k = 0; k < 3; k++) {
          const tex = inkCloudTex(k);
          const R = (30 + 64 * Math.sqrt(age) * (0.8 + 0.25 * k)) * (1 + 0.1 * k);
          const cx = trC(FOOT) + 4 + (10 + 30 * k) * Math.sqrt(age) + 24 * age, cy = POOL_TOP + 16 + 20 * Math.sqrt(age) + k * 4;
          const a = smooth(age / 0.25) * (1.0 - 0.15 * k) * (0.55 + 0.45 * Math.exp(-age / 3));
          g.save(); g.translate(cx, cy); g.scale(1, 0.38); g.rotate(0.2 * k + age * 0.06 * (k - 1));
          g.globalAlpha = a; g.drawImage(tex, -R, -R, R * 2, R * 2); g.restore();
        }
        g.globalAlpha = 1;
      }
      drawRings(g, t, (ts) => 0.2 + 0.5 * sstep(tQ - 0.2, tQ + 0.6, ts));
      // 拍点上的大水滴
      const b = c.b;
      for (let i = b.i - 2; i <= b.i; i++) {
        const tb = c.grid.time(i), age = c.t - tb;
        if (age < 0 || age > 1.3 || tb < t0 - 0.2) continue;
        for (let m = 0; m < 2; m++) {
          const a = h2(i, 7 + m) * TAU, d = 0.25 + 0.6 * h2(i, 9 + m);
          const x = POOL.cx + Math.cos(a) * POOL.rx * d, y = POOL.cy + Math.sin(a) * POOL.ry * d;
          for (let ring = 0; ring < 3; ring++) {
            const ag = age - ring * 0.12; if (ag <= 0) continue;
            const R = 3 + 38 * Math.pow(ag, 0.6), al = 0.36 * Math.pow(1 - ag / 1.3, 1.5) * (1 - ring * 0.25) * clamp(ag / 0.05, 0, 1);
            g.strokeStyle = `rgba(184,196,212,${al})`; g.lineWidth = 1.1;
            g.beginPath(); g.ellipse(x, y, R, R * 0.3, 0, 0, TAU); g.stroke();
          }
        }
      }
      // 入水处一圈圈小波
      if (t > gs.tFoot) {
        for (let k = 0; k < 4; k++) {
          const u = t - gs.tFoot - k * 0.3;
          if (u < 0) continue;
          const age = u % 1.2, R = 4 + 32 * Math.pow(age, 0.6), al = 0.3 * (1 - age / 1.2) * clamp(age / 0.08, 0, 1);
          g.strokeStyle = `rgba(184,196,212,${al})`; g.lineWidth = 1;
          g.beginPath(); g.ellipse(trC(FOOT) + 4, POOL_TOP + 14, R, R * 0.28, 0, 0, TAU); g.stroke();
        }
      }
      g.restore();
      drawCrowns(g, c, t0, tQ);
      drawSplashes(g, t, (ts) => 0.3 + 0.45 * sstep(tQ - 0.2, tQ + 0.6, ts));
      g.drawImage(front, 0, FRONT_Y, W, H - FRONT_Y);
      drawSpray(g, t, BIGX + 3, FOOT + 8, gs.tFoot, 16, 61);
      drawVines(g, t);
      drawRain(g, t, amtAt);
      drawFgLeaves(g, t);
      g.restore();
      // 潮湿空气：下部略亮的雨雾
      const hz = g.createLinearGradient(0, 300, 0, H);
      hz.addColorStop(0, 'rgba(126,138,154,0)'); hz.addColorStop(1, 'rgba(126,138,154,0.08)');
      g.fillStyle = hz; g.fillRect(0, 300, W, H - 300);
    }
    return { draw, warm: [inkLayer, wallLayer, washLayer, baseLayer, bigLayer, ghostLayer, frontLayer, trailTex, sheenTex, fgLeafTex, () => inkCloudTex(0), () => inkCloudTex(1), () => inkCloudTex(2), () => streakTex(0), () => streakTex(1), gushTex, bandProfile, bandMaskTex] };
  })();

  XYT.registerShot('e5_inkrain', {
    name: '墨尽雨洗', zone: 'top', night: true,
    text: '#e6e9ee', shadow: 'rgba(6,8,12,0.9)', accent: '#b9c7d8', bloom: 0.32,
    draw: E5.draw,
  });

  // =====================================================================
  // e6_peony 残红：暮春雨后的庭院，低垂的红牡丹，天光转灰，花瓣一齐松脱
  // 比例：花径约 15 cm ≈ 140 px，即约 10 px/cm；重力 ≈ 9800 px/s²
  // 镜头低（约 0.3 m），地平线 y≈266；花台斜放约 10°，往右远去，水平棱线汇向地平线上 x≈8900 的灭点
  // =====================================================================
  const E6 = (function () {
    const CAP = 336, BASE = 545, PX = 420, GP = 9800, HZ = 266, XV = 8900;
    // 左端参考高度 y0 的水平线在 x 处的透视位置；花台顶线、底线、立面上的横缝都用它
    const persp = (y0, x) => y0 + ((HZ - y0) * (x - PX)) / (XV - PX);
    const capY = (x) => persp(CAP, x), baseY = (x) => persp(BASE, x);
    const faceY = (x, yr) => capY(x) + ((yr - CAP) / (BASE - CAP)) * (baseY(x) - capY(x));
    // 地面上的反求：屏幕 (x, y) 落在哪条左端参考行上
    const unpersp = (x, y) => { const f = (x - PX) / (XV - PX); return (y - HZ * f) / (1 - f); };
    // 积水在花台脚下（花台立面距镜头约 1.45 m）；倒影以积水处的花台底线为轴
    const PUD = { cx: 786, cy: 575, rx: 192, ry: 21 };
    const AX = baseY(PUD.cx);
    const pudR = (a) => 1 + 0.06 * Math.sin(a * 3 + 1.1) + 0.05 * Math.sin(a * 5 + 0.3) + 0.03 * Math.sin(a * 8 + 2);
    function pudPath(g) {
      g.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * TAU, r = pudR(a);
        const x = PUD.cx + Math.cos(a) * PUD.rx * r, y = PUD.cy + Math.sin(a) * PUD.ry * r;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.closePath();
    }
    const inPud = (x, y, m = 0) => {
      const a = Math.atan2((y - PUD.cy) / PUD.ry, (x - PUD.cx) / PUD.rx), r = pudR(a);
      const dx = (x - PUD.cx) / (PUD.rx * r - m), dy = (y - PUD.cy) / (PUD.ry * r - m * 0.3);
      return dx * dx + dy * dy < 1;
    };

    // ---------- 背景：虚化的粉墙黛瓦、漏窗、竹丛（建缓存时模糊） ----------
    function bgLayer() {
      return K.cache('ff5_e6_bg', W, H, 1, (g) => {
        const sc = g.getTransform().a;
        const tmp = document.createElement('canvas'); tmp.width = Math.round(W * sc); tmp.height = Math.round(H * sc);
        const t = tmp.getContext('2d'); t.scale(sc, sc);
        const r = A.rng(6006);
        t.fillStyle = A.vgrad(t, 0, 100, [[0, '#e9ebea'], [1, '#dfe2e1']]); t.fillRect(-30, -30, W + 60, 130);
        // 墙外树冠
        for (let i = 0; i < 26; i++) { const x = r() * W, y = 20 + r() * 60; A.glow(t, x, y, 50 + r() * 70, r() < 0.5 ? '#76877b' : '#8e9c91', 0.5); }
        // 墙
        t.fillStyle = A.vgrad(t, 88, 480, [[0, '#d6d9d8'], [0.08, '#e2e4e3'], [0.7, '#d9dcdb'], [1, '#c3c9c5']]);
        t.fillRect(-30, 88, W + 60, 392);
        for (let i = 0; i < 40; i++) {
          const x = r() * W, l = 20 + r() * 120;
          t.fillStyle = `rgba(120,128,124,${0.05 + r() * 0.08})`; t.fillRect(x, 92, 3 + r() * 10, l);
        }
        for (let i = 0; i < 30; i++) A.glow(t, r() * W, 440 + r() * 40, 30 + r() * 40, '#8b9a8c', 0.22);
        // 黛瓦墙檐
        t.fillStyle = '#5d6261'; t.fillRect(0, 62, W, 26);
        t.fillStyle = '#7b807f'; t.fillRect(0, 58, W, 6);
        t.fillStyle = 'rgba(30,34,34,0.5)'; for (let x = 0; x < W; x += 13) t.fillRect(x, 66, 3, 22);
        t.fillStyle = 'rgba(60,64,64,0.35)'; t.fillRect(0, 88, W, 7);
        // 圆形漏窗：窗外竹影，窗格冰裂纹
        t.fillStyle = '#c4c8c5'; t.beginPath(); t.arc(500, 236, 74, 0, TAU); t.fill();
        t.fillStyle = '#5f7263'; t.beginPath(); t.arc(500, 236, 62, 0, TAU); t.fill();
        t.save(); t.beginPath(); t.arc(500, 236, 62, 0, TAU); t.clip();
        for (let i = 0; i < 8; i++) A.glow(t, 460 + r() * 90, 190 + r() * 90, 20 + r() * 20, '#46594a', 0.6);
        t.strokeStyle = '#d6dad7'; t.lineWidth = 5;
        for (let i = 0; i < 14; i++) { const a = r() * TAU, x0 = 500 + Math.cos(a) * 70, y0 = 236 + Math.sin(a) * 70; t.beginPath(); t.moveTo(x0, y0); t.lineTo(500 + (r() - 0.5) * 60, 236 + (r() - 0.5) * 60); t.stroke(); }
        t.restore();
        // 右侧竹丛
        for (let i = 0; i < 16; i++) { const x = 1060 + r() * 230; t.fillStyle = r() < 0.5 ? '#6c8070' : '#7f9283'; t.fillRect(x, 90 + r() * 60, 5 + r() * 4, 400); }
        for (let i = 0; i < 40; i++) A.glow(t, 1040 + r() * 260, 100 + r() * 300, 26 + r() * 30, r() < 0.5 ? '#5f7667' : '#7a8f7e', 0.45);
        // 远处湿石地面
        t.fillStyle = A.vgrad(t, 478, 640, [[0, '#a9afac'], [0.5, '#868c89'], [1, '#4c5250']]); t.fillRect(-30, 478, W + 60, 280);
        // 湿地面映着灰白天光与粉墙：近墙处柔亮，几道竖向的模糊反光
        t.fillStyle = A.vgrad(t, 478, 600, [[0, 'rgba(226,230,228,0.5)'], [1, 'rgba(226,230,228,0)']]); t.fillRect(-30, 478, W + 60, 122);
        for (let i = 0; i < 16; i++) { const x = r() * 520; t.fillStyle = `rgba(234,238,236,${0.07 + r() * 0.09})`; t.fillRect(x, 482, 10 + r() * 30, 50 + r() * 80); }
        t.fillStyle = 'rgba(60,66,64,0.4)'; t.fillRect(0, 476, W, 4);
        g.filter = 'blur(7px)';
        g.drawImage(tmp, -20, -20, W + 40, H + 40);
        g.filter = 'none';
      });
    }

    // ---------- 牡丹叶丛（在压顶石后面），整片缓存，随微风整体轻摆 ----------
    const LV = { x: 470, y: 90, w: 810, h: 270 };
    // 牡丹小叶：宽卵形，基部楔形，外三分之一有浅裂；没骨铺色，基部深，只留一线淡主脉；叶尖受重力微垂
    function leaflet(g, x, y, dir, len, col, dark, lobes, blur, seed, droop) {
      const r = A.rng(seed), wid = len * (0.26 + 0.05 * r());
      const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux;
      const nu = [0.6 + r() * 0.08, 0.62 + r() * 0.08], dep = [0.36 + r() * 0.14, 0.36 + r() * 0.14];
      const asym = 1 + (r() - 0.5) * 0.16, N = 30, side = [[], []];
      const at = (u, perp) => [x + ux * u * len + nx * perp, y + uy * u * len + ny * perp + droop * len * u * u];
      for (let sd = 0; sd < 2; sd++) {
        const sg = sd ? -1 : 1, has = lobes === 3 || (lobes === 2 && sd === 0);
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          let hw = wid * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.82) * (sd ? asym : 1 / asym);
          if (has) {
            const z = (u - nu[sd]) / 0.05;
            hw *= 1 - dep[sd] * Math.exp(-z * z) + 0.1 * Math.exp(-Math.pow((u - nu[sd] + 0.08) / 0.05, 2));
          }
          side[sd].push(at(u, sg * hw));
        }
      }
      const pts = side[0].concat(side[1].slice().reverse());
      const shape = () => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
        g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.closePath();
      };
      g.filter = `blur(${blur}px)`;
      shape(); g.fillStyle = col; g.globalAlpha = 0.92; g.fill();
      const [ex, ey] = at(0.65, 0);
      const gr = g.createLinearGradient(x, y, ex, ey); gr.addColorStop(0, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.45; g.fillStyle = gr; shape(); g.fill();
      g.filter = 'none'; g.globalAlpha = 1;
      if (blur < 1.5) {
        g.strokeStyle = 'rgba(28,44,38,0.2)'; g.lineWidth = 0.8;
        g.beginPath();
        for (let i = 0; i <= 12; i++) { const [px, py] = at(0.03 + 0.8 * i / 12, 0); i ? g.lineTo(px, py) : g.moveTo(px, py); }
        g.stroke();
      }
    }
    function leafLayer() {
      return K.cache('ff5_e6_leaves', LV.w, LV.h, 1, (g) => {
        g.translate(-LV.x, -LV.y);
        const r = A.rng(6262);
        // 二回三出复叶：叶柄从花台里伸出，顶生小叶三浅裂，两侧小叶一大一小、或二裂或全缘，叶尖下垂
        const group = (x, y, s, tone, blur, side, stem) => {
          const col = mix('#3e5c52', '#8fa49b', tone), dark = mix('#283c35', '#566a62', tone);
          const ra = (side > 0 ? 0 : Math.PI) + side * (-0.5 + r() * 0.75);   // 叶轴方向：向外、略向上或向下
          if (stem) {
            g.strokeStyle = mix('#4a6457', '#7f938a', tone); g.lineWidth = 1.8 * s;
            g.beginPath(); g.moveTo(x - side * 6, y + stem); g.quadraticCurveTo(x - side * 2, y + stem * 0.4, x, y); g.stroke();
          }
          const L0 = 64 * s * (0.9 + r() * 0.25);
          const jx = x + Math.cos(ra) * L0 * 0.16, jy = y + Math.sin(ra) * L0 * 0.16;
          g.strokeStyle = mix('#4a6457', '#7f938a', tone); g.lineWidth = 1.4 * s;
          g.beginPath(); g.moveTo(x, y); g.lineTo(jx, jy); g.stroke();
          const a1 = ra - side * (0.8 + r() * 0.35), a2 = ra + side * (0.75 + r() * 0.35);
          leaflet(g, x, y, a1, L0 * (0.68 + r() * 0.16), mix(col, '#9fb3a9', 0.08), dark, r() < 0.5 ? 2 : 1, blur, Math.floor(r() * 1e5), 0.18 + r() * 0.15);
          leaflet(g, x, y, a2, L0 * (0.62 + r() * 0.16), mix(col, '#2c443b', 0.15), dark, r() < 0.4 ? 2 : 1, blur, Math.floor(r() * 1e5), 0.25 + r() * 0.15);
          leaflet(g, jx, jy, ra, L0, col, dark, 3, blur, Math.floor(r() * 1e5), 0.16 + r() * 0.14);
        };
        // 远层（更虚）、中层、近层；位置、大小、朝向都不规则，彼此交叠
        for (let i = 0; i < 16; i++) group(700 + r() * 600, 140 + r() * 100, 0.8 + r() * 0.35, 0.6 + r() * 0.3, 2.4, r() < 0.5 ? -1 : 1, 0);
        for (let i = 0; i < 6; i++) group(840 + r() * 440, 190 + r() * 70, 0.9 + r() * 0.25, 0.36 + r() * 0.14, 1.2, r() < 0.45 ? -1 : 1, 50 + r() * 30);
        const front = [[1010, 240, 1.15, -1], [1150, 230, 1.2, 1], [915, 272, 0.98, -1], [1245, 262, 1.05, 1], [1078, 290, 1.0, 1], [872, 302, 0.82, 1], [662, 306, 0.74, -1], [1190, 300, 0.9, -1], [990, 304, 0.86, 1], [760, 300, 0.7, 1]];
        for (const [x, y, sz, sd] of front) group(x + (r() - 0.5) * 16, y + (r() - 0.5) * 10, sz * (0.92 + r() * 0.16), 0.2 + r() * 0.2, 0.6, sd, 36 + r() * 20);
        // 叶面上残留的雨珠（只落在叶面上）
        g.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 60; i++) { const x = 640 + r() * 640, y = 170 + r() * 160; g.fillStyle = 'rgba(240,244,242,0.55)'; g.beginPath(); g.arc(x, y, 0.8 + r() * 1.1, 0, TAU); g.fill(); }
        g.globalCompositeOperation = 'source-over';
      });
    }

    // ---------- 花台间的薄雾：在粉墙与花台之间，缓缓向左飘（歌词区内不画） ----------
    function mistTex() {
      return K.cache('ff5_e6_mist', W, 220, 1, (g) => {
        const r = A.rng(6707);
        for (let i = 0; i < 40; i++) {
          const x = r() * W, y = 80 + r() * 70, rx = 90 + r() * 150, a = 0.16 + r() * 0.18;
          for (const ox of [-W, 0, W]) { g.save(); g.translate(x + ox, y); g.scale(1, 0.3); A.glow(g, 0, 0, rx, '#f3f5f4', a); g.restore(); }
        }
      });
    }
    function drawMist(g, t) {
      const S = scratchCanvas('e6mist', W, 220), tex = mistTex();
      const off = (((t * 9) % W) + W) % W;
      S.g.drawImage(tex, -off, 0, W, 220); S.g.drawImage(tex, W - off, 0, W, 220);
      S.g.globalCompositeOperation = 'destination-in';
      const gr = S.g.createLinearGradient(330, 0, 480, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      S.g.fillStyle = gr; S.g.fillRect(0, 0, W, 220);
      S.g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.85; g.drawImage(S.c, 0, 240, W, 220); g.globalAlpha = 1;
    }

    // ---------- 花台与石面（清晰）：花台斜放，水平棱线都汇向地平线上同一灭点 ----------
    function stoneLayer() {
      return K.cache('ff5_e6_stone2', W, H, 1, (g) => {
        const nz = makeNoise(616), nz2 = makeNoise(626), dsc = g.getTransform().a;
        // 近处湿石面：大块石板（各块深浅略异，接缝与花台平行），左侧远端与背景地面柔和衔接；湿面映着灰白天光
        // 石板分块与画出来的接缝一致（竖缝略向两侧张开）
        const slab = (X, Yr) => {
          const row = Yr < 600 ? 0 : Yr < 672 ? 1 : 2, off = [30, 230, 70][row], wdt = [260, 300, 340][row];
          const v = clamp((Yr - [545, 600, 672][row]) / [55, 72, 48][row], 0, 1), x0 = (X + 640 * 0.04 * v) / (1 + 0.04 * v);
          return row * 31 + Math.floor((x0 + off) / wdt);
        };
        pixels(g, 0, 500, W, 220, (X, Y, o) => {
          const Yr = unpersp(X, Y), d = clamp((Yr - 545) / 175, 0, 1);
          let l = 0.19 + 0.05 * (h2(slab(X, Yr), 5) - 0.5) + 0.05 * (nz(X * 0.02, Yr * 0.05) - 0.5) + 0.035 * (nz2(X * 0.12, Yr * 0.3) - 0.5);
          l += 0.09 * sstep(0.55, 0.8, nz(X * 0.006 + 9, Yr * 0.02)) * (0.4 + 0.6 * d);
          l -= 0.05 * d;
          l += (0.08 * (1 - d) + 0.03) * sstep(0.35, 0.75, nz2(X * 0.008 + 3, Yr * 0.03 + 5));
          const v = 30 + 150 * l;
          o[0] = v * 0.96; o[1] = v; o[2] = v * 0.98;
          const fadeL = sstep(520, 640, Y), fadeR = clamp((Y - baseY(X) + 2) * dsc + 0.5, 0, 1);
          o[3] = Math.round(255 * (X >= PX ? fadeR : fadeL));
        });
        // 石板缝：横缝沿透视，竖缝略向两侧张开
        g.strokeStyle = 'rgba(14,16,16,0.36)';
        for (const [yr, w] of [[600, 1.4], [672, 1.8]]) { g.lineWidth = w; g.beginPath(); g.moveTo(0, persp(yr, 0)); g.lineTo(W, persp(yr, W)); g.stroke(); }
        g.lineWidth = 1.3; g.beginPath();
        for (const [x, y0, y1] of [[70, 600, 672], [370, 600, 672], [670, 600, 672], [970, 600, 672], [1270, 600, 672], [230, 545, 600], [490, 545, 600], [750, 545, 600], [1010, 545, 600], [270, 672, 720], [610, 672, 720], [950, 672, 720]]) {
          const x1 = x + (x - 640) * 0.04;
          g.moveTo(x, Math.max(persp(y0, x), x >= PX ? baseY(x) : 0)); g.lineTo(x1, persp(y1, x1));
        }
        g.stroke();
        // 花台石块：花岗岩纹理（按左端的参考行着色，透视里自然压缩）
        const PY0 = Math.floor(capY(W)) - 1;
        pixels(g, PX, PY0, W - PX, BASE - PY0, (X, Y, o) => {
          const c0 = capY(X), b0 = baseY(X);
          const cov = clamp((Y - c0) * dsc + 0.5, 0, 1) * clamp((b0 - Y) * dsc + 0.5, 0, 1);
          if (cov <= 0) { o[3] = 0; return; }
          const Yr = CAP + ((Y - c0) / (b0 - c0)) * (BASE - CAP);
          let l = 0.42 + 0.08 * (nz(X * 0.03, Yr * 0.03) - 0.5) + 0.07 * (nz2(X * 0.25, Yr * 0.25) - 0.5);
          if (nz2(X * 0.6, Yr * 0.6) > 0.82) l += 0.06;
          if (Yr < CAP + 12) l = 0.66 + 0.05 * (nz(X * 0.05, Yr * 0.2) - 0.5) - 0.06 * sstep(PX, W, X);   // 压顶石顶面受天光（远端略暗）
          else if (Yr < CAP + 32) l = 0.5 + 0.05 * (nz(X * 0.04, Yr * 0.1) - 0.5);                      // 压顶石立面
          else l -= 0.2 * sstep(CAP + 50, CAP + 32, Yr);                                                  // 檐下阴影
          l -= 0.16 * sstep(BASE - 90, BASE, Yr);                                                          // 下部返潮
          l -= 0.05 * sstep(PX + 100, W, X);                                                               // 往远处略暗
          const v = 26 + 170 * clamp(l, 0, 1);
          o[0] = v * 0.97; o[1] = v; o[2] = v * 0.98; o[3] = Math.round(255 * cov);
        });
        g.strokeStyle = 'rgba(20,24,22,0.6)'; g.lineWidth = 2;
        g.beginPath();
        for (const yr of [CAP + 12, CAP + 32, 456]) { g.moveTo(PX, faceY(PX, yr)); g.lineTo(W, faceY(W, yr)); }
        for (const x of [600, 830, 1060]) { g.moveTo(x, faceY(x, CAP + 32)); g.lineTo(x, faceY(x, 456)); }
        for (const x of [500, 720, 955, 1190]) { g.moveTo(x, faceY(x, 456)); g.lineTo(x, baseY(x)); }
        for (const x of [700, 1000]) { g.moveTo(x, capY(x)); g.lineTo(x, faceY(x, CAP + 32)); }
        g.stroke();
        const facePath = () => { g.beginPath(); g.moveTo(PX, faceY(PX, CAP + 32)); g.lineTo(W, faceY(W, CAP + 32)); g.lineTo(W, baseY(W)); g.lineTo(PX, BASE); g.closePath(); };
        // 雨后的水渍与斑驳：自压顶石下沿垂下的深色水痕、几片返潮的暗斑
        {
          const r2 = A.rng(6363);
          g.save(); facePath(); g.clip();
          g.filter = `blur(${(2 * dsc).toFixed(2)}px)`;
          for (let i = 0; i < 46; i++) {
            const x = PX + r2() * (W - PX), l = 20 + r2() * 110, w = 4 + r2() * 16, y0 = faceY(x, CAP + 32);
            const gr = g.createLinearGradient(0, y0, 0, y0 + l);
            gr.addColorStop(0, `rgba(30,36,34,${0.18 + r2() * 0.2})`); gr.addColorStop(1, 'rgba(30,36,34,0)');
            g.fillStyle = gr; g.fillRect(x, y0, w, l);
          }
          for (let i = 0; i < 18; i++) { const x = PX + r2() * (W - PX); A.glow(g, x, faceY(x, 400 + r2() * 140), 30 + r2() * 50, '#2c3431', 0.25); }
          g.filter = 'none';
          g.restore();
        }
        // 左端在镜头左侧，侧面朝外看不到，只在棱上留一线天光
        g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(PX - 1, CAP, 2, BASE - CAP);
        // 青苔：压顶石顶面与棱上一溜、石缝与墙脚几团；缝里的小草
        const r = A.rng(6262);
        for (let i = 0; i < 40; i++) { const x = PX + r() * (W - PX), y = r() < 0.5 ? faceY(x, 456) + (r() - 0.5) * 8 : faceY(x, BASE - r() * 30); A.glow(g, x, y, 8 + r() * 18, '#56704f', 0.35); }
        const rm = A.rng(6464);
        for (let i = 0; i < 70; i++) {
          const x = PX + 10 + rm() * (W - PX - 10);
          if (x > 700 && x < 900) continue;
          const y = capY(x) + 1 + rm() * 10;
          A.glow(g, x, y, 4 + rm() * 9, rm() < 0.5 ? '#4f6a46' : '#62794f', 0.4);
        }
        g.fillStyle = 'rgba(70,96,62,0.55)';
        for (let i = 0; i < 26; i++) {
          const x0 = PX + 10 + rm() * (W - PX - 20), w = 10 + rm() * 34;
          if (x0 > 690 && x0 < 900) continue;
          g.beginPath(); g.moveTo(x0, faceY(x0, CAP + 12));
          for (let k = 0; k <= 6; k++) { const x = x0 + (w * k) / 6; g.lineTo(x, faceY(x, CAP + 12) + 1.5 + 3 * Math.sin(k * 1.7 + i) * (k > 0 && k < 6 ? 1 : 0)); }
          g.lineTo(x0 + w, faceY(x0 + w, CAP + 12)); g.closePath(); g.fill();
        }
        g.strokeStyle = '#4f6b45'; g.lineWidth = 1.2;
        for (let i = 0; i < 70; i++) {
          const x = PX + r() * (W - PX), h = 6 + r() * 14, lean = -2 - r() * 4, yb = baseY(x) + 1;
          g.beginPath(); g.moveTo(x, yb); g.quadraticCurveTo(x + lean * 0.4, yb - h * 0.6, x + lean, yb - h); g.stroke();
        }
        // 接地暗线（沿花台底线）
        for (let x = PX; x < W; x += 16) {
          const yb = baseY(x + 8);
          g.fillStyle = A.vgrad(g, yb - 4, yb + 10, [[0, 'rgba(10,12,12,0.6)'], [1, 'rgba(10,12,12,0)']]); g.fillRect(x, yb - 4, 16.5, 14);
        }
      });
    }
    // 探出压顶石前沿垂下的几片牡丹叶（画在花台之上，远离花头）
    function spillLayer() {
      return K.cache('ff5_e6_spill', W, H, 1, (g) => {
        const r = A.rng(6868);
        for (const [x, n] of [[1012, 3], [1138, 2], [1236, 3], [604, 2]]) {
          const y = capY(x) + 2;
          for (let k = 0; k < n; k++) {
            const dir = Math.PI / 2 + (r() - 0.5) * 1.1 + (k - (n - 1) / 2) * 0.5, len = 34 + r() * 22;
            leaflet(g, x + (r() - 0.5) * 14, y, dir, len, mix('#3e5c52', '#7f948b', 0.25 + r() * 0.2), '#283c35', r() < 0.5 ? 3 : 1, 0.5, Math.floor(r() * 1e5), 0.12);
          }
        }
      });
    }
    // 湿石面上花台的模糊倒影：逐列以花台底线为轴翻转，很淡，离底线越远越淡
    function wetLayer() {
      return K.cache('ff5_e6_wet2', W, H, 1, (g) => {
        const st = stoneLayer(), sc = g.getTransform().a, ss = st.width / W;
        const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc); const t = c.getContext('2d'); t.scale(sc, sc); return [c, t]; };
        const [tmp, t2] = mk(), [msk, tm] = mk();
        for (let x = PX; x < W; x += 8) {
          const a = baseY(x + 4);
          t2.save(); t2.translate(0, 2 * a); t2.scale(1, -1);
          t2.drawImage(st, x * ss, (a - 130) * ss, 8 * ss, 130 * ss, x, a - 130, 8.4, 130);
          t2.restore();
          const gr = tm.createLinearGradient(0, a, 0, a + 120);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          tm.fillStyle = gr; tm.fillRect(x, a, 8.4, 122);
        }
        t2.setTransform(1, 0, 0, 1, 0, 0);
        t2.globalCompositeOperation = 'destination-in'; t2.drawImage(msk, 0, 0);
        g.filter = `blur(${(3 * sc).toFixed(2)}px)`; g.globalAlpha = 0.24;
        g.drawImage(tmp, 0, 0, W, H);
        g.filter = 'none'; g.globalAlpha = 1;
      });
    }
    // ---------- 近景：头顶回廊的檐口（失焦）、右下角失焦的牡丹叶 ----------
    function eaveLayer() {
      return K.cache('ff5_e6_eave', W, 80, 1, (g) => {
        const sc = g.getTransform().a;
        const tmp = document.createElement('canvas'); tmp.width = Math.round(W * sc); tmp.height = Math.round(80 * sc);
        const t2 = tmp.getContext('2d'); t2.scale(sc, sc);
        t2.fillStyle = '#2a2f30'; t2.fillRect(-30, -30, W + 60, 50);
        for (let x = -30; x < W + 60; x += 50) { t2.beginPath(); t2.arc(x, 20, 26, 0, Math.PI); t2.fill(); }
        t2.fillStyle = 'rgba(200,206,204,0.12)';
        for (let x = -30; x < W + 60; x += 50) { t2.beginPath(); t2.ellipse(x, 40, 14, 2.5, 0, 0, Math.PI); t2.fill(); }
        g.filter = `blur(${(8 * sc).toFixed(2)}px)`; g.drawImage(tmp, 0, 0, W, 80); g.filter = 'none';
      });
    }
    const FGO = { x: 1300, y: 760 };
    function fgLeafTex() {
      return K.cache('ff5_e6_fgleaf', 340, 260, 1, (g) => {
        const sc = g.getTransform().a;
        const tmp = document.createElement('canvas'); tmp.width = Math.round(340 * sc); tmp.height = Math.round(260 * sc);
        const t2 = tmp.getContext('2d'); t2.scale(sc, sc); t2.translate(320, 250);
        const r = A.rng(6969);
        for (const [dx, dy, dir, len] of [[0, 0, -2.6, 250], [-10, -6, -2.2, 225], [-4, 6, -2.95, 205], [-30, -10, -1.9, 170]]) {
          leaflet(t2, dx, dy, dir, len, mix('#0f1612', '#1a2520', r()), '#080c0a', 3, 0, Math.floor(r() * 1e5), 0.06);
        }
        g.filter = `blur(${(5 * sc).toFixed(2)}px)`; g.drawImage(tmp, 0, 0, 340, 260); g.filter = 'none';
      });
    }
    function drawForeground(g, t) {
      const rot = 0.008 * Math.sin(TAU * 0.3 * t) + 0.004 * Math.sin(TAU * 0.67 * t + 1.3);
      g.save(); g.translate(FGO.x, FGO.y); g.rotate(rot); g.drawImage(fgLeafTex(), -320, -250, 340, 260); g.restore();
      g.drawImage(eaveLayer(), 0, 0, W, 80);
    }
    // 檐口滴水（近、失焦）：水珠渐满后落下；时刻避开花瓣松脱那一段
    function drawEaveDrips(g, t) {
      for (const [x, P, ph] of [[566, 3.4, 0.35], [1206, 4.3, 2.65]]) {
        const u0 = (((t + ph) % P) + P) % P, grow = P - 0.45;
        if (u0 < grow) {
          const k = smooth(u0 / grow);
          A.glow(g, x, 33 + 3 * k, 4 + 4 * k, '#e9eeee', 0.32 * k);
        } else {
          const u = u0 - grow, y = 38 + 0.5 * 6000 * u * u, v = 6000 * u;
          if (y < H + 20) {
            g.strokeStyle = 'rgba(236,240,240,0.16)'; g.lineWidth = 7; g.lineCap = 'round';
            g.beginPath(); g.moveTo(x, y - Math.min(60, v * 0.022)); g.lineTo(x, y); g.stroke();
            A.glow(g, x, y, 8, '#f2f5f5', 0.3);
          }
        }
      }
    }
    // ---------- 花瓣贴图：没骨晕染，基部深、外缘浅而薄，边上积一道水线 ----------
    function petalSprite(k, dark) {
      return K.cache('ff5_e6_pet' + k + (dark ? 'd' : ''), 64, 72, 2, (g) => {
        const r = A.rng(700 + k * 11);
        const sc = [1, 0.9, 1.08, 0.95, 1.02, 0.86][k % 6];
        const pts = [];
        const n = 5 + (k % 3);
        for (let i = 0; i <= n; i++) pts.push([8 + (48 * i) / n + (r() - 0.5) * 3, 8 + r() * 6 + (i % 2) * 2]);
        const path = () => {
          g.beginPath(); g.moveTo(32, 70);
          g.bezierCurveTo(14 - 8 * sc, 58, 0, 26, pts[0][0], pts[0][1]);
          for (let i = 1; i <= n; i++) { const p0 = pts[i - 1], p1 = pts[i]; g.quadraticCurveTo((p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - 4, p1[0], p1[1]); }
          g.bezierCurveTo(64, 26, 50 + 8 * sc, 58, 32, 70); g.closePath();
        };
        const c0 = dark ? '#5a0d17' : '#7a121e', c1 = dark ? '#8f1824' : '#b3202d', c2 = dark ? '#c2414b' : '#e8565f';
        g.filter = 'blur(1.6px)';
        path();
        const gr = g.createRadialGradient(32, 72, 3, 32, 60, 70);
        gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c2);
        g.fillStyle = gr; g.globalAlpha = 0.86; g.fill();
        g.filter = 'blur(4px)'; g.globalAlpha = 0.5;
        g.fillStyle = c0; g.beginPath(); g.ellipse(32, 62, 12, 18, 0, 0, TAU); g.fill();
        g.globalAlpha = 1; g.filter = 'blur(0.7px)';
        path(); g.strokeStyle = dark ? 'rgba(90,8,18,0.5)' : 'rgba(150,18,34,0.45)'; g.lineWidth = 1.3; g.stroke();
        g.filter = 'none';
        g.save(); path(); g.clip();
        g.strokeStyle = 'rgba(255,210,210,0.06)'; g.lineWidth = 1;
        for (let i = 0; i < 3; i++) { const ex = 18 + i * 14 + (r() - 0.5) * 6; g.beginPath(); g.moveTo(32, 64); g.quadraticCurveTo((32 + ex) / 2, 38, ex, 16 + r() * 8); g.stroke(); }
        g.restore();
      });
    }

    // ---------- 花的姿态：枝顶节点、垂下的花颈方向（随风轻摆、第一句第9字后更沉，落瓣后回弹） ----------
    const N0 = { x: 838, y: 250 }, NECK = 50, CEN = 36;
    function headPose(t, tR, tRel) {
      const dro = easeInOut(clamp((t - tR) / 0.8, 0, 1));
      const u = t - tRel, reb = u > 0 ? (1 - Math.exp(-u / 0.45) * Math.cos(TAU * 1.3 * u)) : 0;
      const sway = 0.026 * Math.sin(TAU * 0.45 * t + 0.6) + 0.013 * Math.sin(TAU * 0.93 * t + 2.1);
      // 方向角：0 指向右，π/2 指向下；花颈原本朝左下，风向左
      const ang = 1.98 + 0.03 - dro * 0.26 + reb * 0.18 + sway;
      const nx = N0.x - 1.5 * Math.sin(TAU * 0.45 * t + 0.6) + reb * 2, ny = N0.y + dro * 7 - reb * 6;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return { nx, ny, ang, px: nx + ca * NECK, py: ny + sa * NECK, cx: nx + ca * (NECK + CEN), cy: ny + sa * (NECK + CEN) };
    }
    // 花瓣布局（花头局部坐标：+y 是花面朝向，即花颈延长方向；a 为相对花面轴的偏角）
    // 侧面看下垂的花：外瓣自花托张开成杯，内瓣皱缩，花心在杯口，前瓣遮住一部分
    let PET = null;
    function petals() {
      if (PET) return PET;
      const r = A.rng(6464), out = [];
      // grp：松脱的先后（0 前面的外瓣与杯口小瓣，1 后面与上方的外瓣，2 内瓣，3 反卷的护瓣）
      const add = (n, a0, a1, by, L, Wd, dark, ord, jb, grp) => {
        for (let i = 0; i < n; i++) {
          const a = lerp(a0, a1, n === 1 ? 0.5 : i / (n - 1)) + (r() - 0.5) * 0.18;
          out.push({ bx: (r() - 0.5) * jb, by: by + (r() - 0.5) * 6, a, L: L * (0.9 + r() * 0.2), Wd: Wd * (0.88 + r() * 0.24), spr: Math.floor(r() * 6), dark, ord: ord + r() * 0.5, grp });
        }
      };
      add(3, -2.3, 2.3, -28, 36, 40, true, 0, 10, 3);       // 反卷的护瓣
      add(9, -1.3, 1.3, -24, 78, 61, false, 1, 16, 1);      // 后面的外瓣（看到内侧），宽而松，牡丹的阔杯形
      add(4, -0.9, 0.9, -26, 70, 60, true, 1.6, 10, 1);     // 上方拱起的外瓣背面
      add(10, -0.85, 0.85, -12, 46, 40, true, 2, 34, 2);    // 皱缩的内瓣
      add(6, -0.95, 0.95, -18, 64, 52, false, 4, 30, 0);    // 前面的外瓣
      add(4, -0.5, 0.5, 6, 30, 34, true, 4.6, 26, 0);       // 杯口卷起的小瓣
      out.sort((a, b) => a.ord - b.ord);
      return (PET = out);
    }
    const local2w = (P, lx, ly) => { const R = P.ang - Math.PI / 2, c = Math.cos(R), s = Math.sin(R); return [P.cx + c * lx - s * ly, P.cy + s * lx + c * ly]; };
    function petalAttached(P, q) {
      const [bx, by] = local2w(P, q.bx, q.by);
      return { bx, by, th: P.ang - q.a, L: q.L };
    }
    // 落瓣：每瓣的松脱时刻、下落轨迹、落点（全部由常数推出）
    // 花头先沉沉低垂（第1句第9字起 0.8 s），低垂到一半起花瓣一瓣接一瓣松脱：前面的外瓣先落、内瓣在后、反卷的护瓣最后；
    // 每瓣带空气阻力：竖直速度在约 0.2 s 内趋近终速（约 150–220 px/s），一边左右摆荡（0.8–1.4 Hz，±9–15 px）
    // 一边被风带向左（20–110 px/s），翻转、缓慢倾侧，1.0–1.5 s 后落定
    let FALL = null;
    function fallPlan(tR) {
      if (FALL && FALL.tR === tR) return FALL;
      const ps = petals(), r = A.rng(6565), n = ps.length;
      // 落点：花下偏左（风向左）最密，向外渐疏，彼此少叠（近似泊松分布），一部分落进积水
      const tg = [];
      for (let guard = 0, md = 24; tg.length < n; guard++) {
        if (guard % 600 === 599) md *= 0.92;
        const x = 515 + r() * 410, y = 558 + r() * 58;
        const dx = (x - 705) / 165, dy = (y - 577) / 27;
        const dens = Math.exp(-dx * dx - dy * dy) * (0.7 + 0.6 * A.noise1(x * 0.02, 41));
        if (r() > dens) continue;
        if (tg.every(([a, b]) => Math.hypot(a - x, (b - y) * 2.6) > md)) tg.push([x, y]);
      }
      const order = ps.map((q, i) => ({ q, i, k: q.grp + r() * 0.9 })).sort((u, v) => u.k - v.k);
      const pre = order.map((o, rank) => {
        const tr = tR + 0.3 + 0.68 * Math.pow(rank / (n - 1), 0.9) + (r() - 0.5) * 0.05;
        const P = headPose(tr, tR, 99), a = petalAttached(P, o.q), half = (a.L * 34) / 72;
        return { q: o.q, i: o.i, tr, a, c0x: a.bx + Math.cos(a.th) * half, c0y: a.by + Math.sin(a.th) * half, key: r() };
      });
      // 左边的瓣落到左边：按起点 x 与落点 x 排序后配对（加一点扰动）
      const byX = pre.slice().sort((u, v) => (u.c0x + u.key * 40) - (v.c0x + v.key * 40));
      const tgs = tg.slice().sort((u, v) => u[0] - v[0]);
      byX.forEach((o, k) => { o.xt = tgs[k][0]; o.yl = tgs[k][1]; });
      const list = pre.map((o) => {
        const { q, i, tr, a, c0x, c0y, yl, xt } = o, drop = yl - c0y;
        const Td = Math.min(clamp(drop / (135 + 90 * r()) + 0.2, 0.9, 1.55), tR + 2.3 - tr);
        const tau = 0.2, Vt = drop / (Td - tau * (1 - Math.exp(-Td / tau)));
        const fy = (u) => c0y + Vt * (u - tau * (1 - Math.exp(-u / tau)));
        const Am = 10 + 8 * r(), fq = 0.8 + 0.6 * r(), ph = r() * TAU;
        const sway = (u) => Am * (1 - Math.exp(-u / 0.3)) * Math.sin(TAU * fq * u + ph);
        const tw = 0.3, Wk = (u) => u - tw * (1 - Math.exp(-u / tw));
        const vd = clamp((c0x + sway(Td) - xt) / Wk(Td), 20, 110);
        const fx = (u) => c0x - vd * Wk(u) + sway(u);
        const om = (r() < 0.5 ? -1 : 1) * (1.0 + 1.0 * r()), wob = 0.25 * r(), wph = r() * TAU;
        const fth = (u) => a.th + om * u + wob * Math.sin(TAU * 0.7 * u + wph) * (1 - Math.exp(-u / 0.3));
        const ff = 0.35 + 0.35 * r();
        const xl = fx(Td), th1 = fth(Td), thH = Math.round(th1 / Math.PI) * Math.PI + (h2(i, 613) - 0.5) * 1.0, thL = th1 + clamp(thH - th1, -0.6, 0.6);
        return { q, i, tr, L: a.L, sL: clamp(a.L * (0.42 + 0.12 * r()), 17, 34), sW: clamp(q.Wd * (0.46 + 0.12 * r()), 14, 30), fy, fx, fth, om, ff, tl: Td, xl, yl, wet: inPud(xl, yl, 6), thL, spr: i % 4, fph: r() * TAU };
      });
      FALL = { tR, list, tRel: Math.max(...list.map((f) => f.tr)) };
      return FALL;
    }
    // 散落的花瓣贴图：圆润的泪滴形（基部窄、外缘圆，没有尖角），半透明，湿边略深，基部深红向外渐浅
    function loosePetalSprite(k, dark) {
      return K.cache('ff5_e6_loose' + k + (dark ? 'd' : ''), 48, 60, 2, (g) => {
        const sc = g.getTransform().a, r = A.rng(900 + k * 17);
        const w = [0.95, 0.8, 1.0, 0.86][k % 4], top = 3 + r() * 2, wy = 24 + r() * 6;
        const path = () => {
          g.beginPath(); g.moveTo(24, 57);
          g.bezierCurveTo(24 - 16 * w, 50, 24 - 24 * w, wy + 6, 24 - 19 * w, 13);
          g.bezierCurveTo(24 - 15 * w, top + 1, 24 - 6 * w, top, 24, top);
          g.bezierCurveTo(24 + 6 * w, top, 24 + 15 * w, top + 1, 24 + 19 * w, 13);
          g.bezierCurveTo(24 + 24 * w, wy + 6, 24 + 16 * w, 50, 24, 57);
          g.closePath();
        };
        const c0 = dark ? '#5c0f18' : '#8e1823', c1 = dark ? '#7e1720' : '#b3202d', c2 = dark ? '#a8404a' : '#e8565f';
        g.filter = `blur(${(1.1 * sc).toFixed(2)}px)`;
        const gr = g.createRadialGradient(24, 58, 2, 24, 50, 58);
        gr.addColorStop(0, c0); gr.addColorStop(0.4, c1); gr.addColorStop(1, c2);
        path(); g.fillStyle = gr; g.globalAlpha = 0.86; g.fill();
        g.globalAlpha = 0.5; g.lineWidth = 1.4; g.strokeStyle = dark ? 'rgba(70,8,16,0.6)' : 'rgba(140,18,32,0.55)'; path(); g.stroke();
        g.filter = `blur(${(3 * sc).toFixed(2)}px)`; g.globalAlpha = 0.18;
        g.fillStyle = '#ffd2d2'; g.beginPath(); g.ellipse(24 - 3 * w, 20, 7 * w, 9, -0.2, 0, TAU); g.fill();
        g.filter = 'none'; g.globalAlpha = 1;
      });
    }
    function drawLoose(g, spr, x, y, th, sx, sq, Wd, L, al) {
      g.save(); g.translate(x, y); if (sq !== 1) g.scale(1, sq);
      g.rotate(th + Math.PI / 2); g.scale((sx * Wd) / 48, L / 60);
      g.globalAlpha = al; g.drawImage(spr, -24, -30, 48, 60); g.globalAlpha = 1;
      g.restore();
    }
    // sq：屏幕空间的纵向压扁（平躺在地上、水上时的透视），sx：沿花瓣自身横向的翻转
    function drawPetal(g, spr, x, y, th, sx, sy, Wd, L, pivot, sq) {
      g.save(); g.translate(x, y); if (sq != null) g.scale(1, sq);
      g.rotate(th + Math.PI / 2); g.scale(sx * Wd / 64, sy * L / 72);
      g.drawImage(spr, -32, pivot === 'base' ? -70 : -36, 64, 72);
      g.restore();
    }
    // 涟漪
    function ripple(g, x, y, age, big) {
      for (let k = 0; k < 2; k++) {
        const a = age - k * 0.16; if (a <= 0 || a > 1.6) continue;
        const R = (big ? 4 : 2) + (big ? 46 : 26) * Math.pow(a, 0.6);
        const al = (big ? 0.42 : 0.3) * Math.pow(1 - a / 1.6, 1.5) * clamp(a / 0.05, 0, 1) * (1 - k * 0.35);
        g.strokeStyle = `rgba(232,236,236,${al})`; g.lineWidth = 1.1;
        g.beginPath(); g.ellipse(x, y, R, R * 0.16, 0, 0, TAU); g.stroke();
      }
    }
    // 水珠：在瓣尖聚满、拉长、下落（加速）
    function drawBead(g, x, y, rad, stretch) {
      g.fillStyle = 'rgba(236,240,240,0.62)';
      g.beginPath(); g.ellipse(x, y, rad, rad * stretch, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,70,70,0.45)'; g.lineWidth = 0.8; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.35 * stretch, Math.max(0.6, rad * 0.28), 0, TAU); g.fill();
    }

    function draw(g, c) {
      const t = c.lt, t0 = c.t - c.lt;
      const ct = (k, d) => (c.charT(k) != null ? c.charT(k) - t0 : d);
      const tRen = ct(2, 0.96), tSan = ct(3, 1.48), tFa = ct(4, 2.18), tR = ct(8, 3.92);
      const FP = fallPlan(tR);
      const P = headPose(t, tR, FP.tRel);
      g.drawImage(bgLayer(), 0, 0, W, H);
      // 叶丛：整片以压顶石处为根轻摆（风向左：越高的叶子越往左偏）
      const sh = 0.008 * (0.6 + 0.4 * Math.sin(TAU * 0.4 * t)) + 0.003 * Math.sin(TAU * 0.83 * t + 1);
      g.save(); g.transform(1, 0, sh, 1, -sh * (CAP + 20), 0);
      g.drawImage(leafLayer(), LV.x, LV.y, LV.w, LV.h);
      g.restore();
      // 花枝：从叶丛里拱起，到节点后垂下；花颈与枝在节点处切线连续，末端顺着花头的朝向
      const c2x = 900, c2y = 206 + (P.ny - N0.y) * 0.5;
      let ux = P.nx - c2x, uy = P.ny - c2y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
      g.lineCap = 'round';
      g.strokeStyle = '#4b654c'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(952, capY(952) + 30);
      g.bezierCurveTo(944, 262, c2x, c2y, P.nx, P.ny);
      g.bezierCurveTo(P.nx + ux * NECK * 0.4, P.ny + uy * NECK * 0.4, P.px - ca * NECK * 0.35, P.py - sa * NECK * 0.35, P.px, P.py);
      g.stroke();
      g.strokeStyle = 'rgba(190,210,180,0.35)'; g.lineWidth = 1.2; g.stroke();
      drawMist(g, t);
      g.drawImage(stoneLayer(), 0, 0, W, H);
      g.drawImage(spillLayer(), 0, 0, W, H);
      g.drawImage(wetLayer(), 0, 0, W, H);
      // 积水：映出花台下部（以花台底线翻转），水面暗而亮滑；边缘柔和加深，只在远沿留断续的一线水光
      const st = stoneLayer(), ss = st.width / W;
      const px0 = PUD.cx - PUD.rx * 1.12, pw = PUD.rx * 2.24;
      g.save(); pudPath(g); g.clip();
      for (let y = PUD.cy - PUD.ry * 1.15; y < PUD.cy + PUD.ry * 1.15; y += 1.5) {
        const ys = 2 * AX - y - 1.5, dx = 0.7 * Math.sin(y * 0.5 + t * 2.1) + 0.4 * Math.sin(y * 0.17 - t * 1.3);
        g.drawImage(st, px0 * ss, ys * ss, pw * ss, 1.5 * ss, px0 + dx, y, pw, 1.7);
      }
      g.fillStyle = 'rgba(22,28,30,0.42)'; g.fillRect(px0 - 10, PUD.cy - PUD.ry * 1.3, pw + 20, PUD.ry * 2.6);
      g.save(); g.translate(PUD.cx, PUD.cy); g.scale(1, PUD.ry / PUD.rx);
      const ge = g.createRadialGradient(0, 0, PUD.rx * 0.55, 0, 0, PUD.rx * 1.12);
      ge.addColorStop(0, 'rgba(14,18,18,0)'); ge.addColorStop(0.7, 'rgba(14,18,18,0.16)'); ge.addColorStop(1, 'rgba(14,18,18,0.34)');
      g.fillStyle = ge; g.fillRect(-PUD.rx * 1.2, -PUD.rx * 1.2, PUD.rx * 2.4, PUD.rx * 2.4);
      g.restore();
      g.restore();
      g.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        if (h2(i, 913) < 0.45) continue;
        const a0 = Math.PI * (1.08 + 0.84 * (i + 0.3 * h2(i, 919)) / 26), a1 = a0 + Math.PI * 0.84 / 26 * (0.25 + 0.9 * h2(i, 917));
        g.strokeStyle = `rgba(228,232,232,${0.1 + 0.14 * h2(i, 921)})`;
        g.beginPath();
        for (let k = 0; k <= 4; k++) { const aa = lerp(a0, a1, k / 4), rr = pudR(aa); const x = PUD.cx + Math.cos(aa) * PUD.rx * rr, y = PUD.cy + Math.sin(aa) * PUD.ry * rr + 0.5; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
      }

      // 花托、萼片与蓇葖（绿色，随画面一起褪色）：花瓣在时被遮住，落尽后露出
      drawCalyx(g, P);
      // 近景（失焦）：檐口、右下角的叶子
      drawForeground(g, t);

      // ---------- 天光转灰：除牡丹外整体去饱和（第一句第5字起 1.5 s） ----------
      const kd = smooth((t - tFa) / 1.5);
      if (kd > 0) {
        g.globalCompositeOperation = 'saturation'; g.fillStyle = '#808080'; g.globalAlpha = 0.9 * kd; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'multiply'; g.fillStyle = '#d4d7d8'; g.globalAlpha = kd; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      }

      // ---------- 花与花瓣 ----------
      const ps = petals(), SQ = 0.36;
      const tipOf = (idx) => { const q = ps[idx], a = petalAttached(P, q); return [a.bx + Math.cos(a.th) * a.L * 0.95, a.by + Math.sin(a.th) * a.L * 0.95]; };
      const front = ps.map((q, i) => ({ q, i })).filter((o) => !o.q.dark && o.q.ord < 2);
      const lowY = (o) => { const a = petalAttached(P, o.q); return a.by + Math.sin(a.th) * o.q.L; };
      const idxA = front.reduce((bb, o) => (lowY(o) > lowY(bb) ? o : bb), front[0]).i;
      const idxB = front[(front.findIndex((o) => o.i === idxA) + 2) % front.length].i;
      const drops = [{ tl: tRen, idx: idxA, yw: 562, g0: -0.8 }, { tl: tSan, idx: idxB, yw: 567, g0: 0.3 }];
      // 每瓣此刻的状态：刚松脱的 0.35 s 内由花头上的瓣形渐变成卷起的散瓣；下落的最后 0.25 s 逐渐放平（纵向压扁、
      // 转向近水平），最低点不低于落点；落定后 0.3 s 内慢慢摊开，漂在水上的随水轻漾、慢慢漂向左
      const ext = (L, Wd, th, sx, sq) => sq * (Math.abs(Math.sin(th)) * L * 0.45 + Math.abs(Math.cos(th)) * Wd * sx * 0.48);
      const flipF = (f, u) => 1 - 0.42 * Math.abs(Math.sin(TAU * f.ff * u));
      const st8 = [];
      for (const f of FP.list) {
        if (t < f.tr) continue;
        const u = t - f.tr;
        if (u < f.tl) {
          const ka0 = smooth(u / 0.25), kb = smooth(1 - (f.tl - u) / 0.25);
          const sL = lerp(f.L, f.sL, ka0), sW = lerp(f.q.Wd, f.sW, ka0), sx = lerp(1, flipF(f, u), ka0);
          const th = lerp(f.fth(u), f.thL, kb), sq = lerp(1, SQ, kb), e = ext(sL, sW, th, sx, sq);
          st8.push({ f, fall: true, ka0, x: f.fx(u), y: Math.min(f.fy(u), f.yl + 2 - e), th, sx, sq, sL, sW });
        } else {
          const w = u - f.tl, k = smooth(w / 0.3);
          const sx = lerp(flipF(f, f.tl), 0.95, k);
          const th = f.thL + 0.1 * Math.sign(f.om) * (1 - Math.exp(-w / 0.5)), e = ext(f.sL, f.sW, th, sx, SQ);
          const drift = f.wet ? -8 * (1 - Math.exp(-w / 1.4)) : 0, bob = f.wet ? 0.4 * Math.sin(TAU * 0.8 * w + f.fph) * Math.min(1, w / 0.3) : 0;
          st8.push({ f, fall: false, k, x: f.xl + drift, y: Math.min(f.yl, f.yl + 2 - e) + bob, th, sx, sq: SQ, sL: f.sL, sW: f.sW, e });
        }
      }
      // 1) 积水里的倒影：下落将到水面的瓣以落点水面为轴翻转；漂着的瓣在自身正下方映出更暗的、随水纹微抖的倒影
      g.save(); pudPath(g); g.clip();
      for (const o of st8) {
        if (!o.f.wet) continue;
        const sprD = loosePetalSprite(o.f.spr, true);
        if (o.fall) {
          if (o.f.yl - o.y > 60) continue;
          g.save(); g.translate(0, 2 * (o.f.yl + 2)); g.scale(1, -1);
          drawLoose(g, sprD, o.x, o.y, o.th, o.sx, o.sq, o.sW, o.sL, 0.45 * o.ka0);
          g.restore();
        } else {
          const dx = 1.2 * Math.sin(t * 2.2 + o.x * 0.13);
          drawLoose(g, sprD, o.x + dx, o.y + 2 * o.e * 0.9 + 1, o.th, o.sx, -o.sq, o.sW, o.sL, 0.42);
        }
      }
      // 2) 涟漪（水珠、落瓣）画在漂浮的花瓣下面
      for (const d of drops) { const [tx] = tipOf(d.idx); if (t > d.tl) ripple(g, tx, d.yw, t - d.tl, false); }
      for (const f of FP.list) { if (!f.wet) continue; const age = t - f.tr - f.tl; if (age > 0) ripple(g, f.xl, f.yl, age, false); }
      g.restore();
      // 3) 落定的花瓣（远的先画；干石面上的有一圈淡淡的接触暗影），4) 正在下落的花瓣
      st8.filter((o) => !o.fall).sort((p1, p2) => p1.f.yl - p2.f.yl).forEach((o) => {
        if (!o.f.wet) { g.fillStyle = `rgba(22,18,18,${0.16 * o.k})`; g.beginPath(); g.ellipse(o.x, o.f.yl + 0.5, o.sL * 0.42, 2.4, 0, 0, TAU); g.fill(); }
        drawLoose(g, loosePetalSprite(o.f.spr, false), o.x, o.y, o.th, o.sx, o.sq, o.sW, o.sL, o.f.wet ? 0.9 : 0.95);
      });
      st8.filter((o) => o.fall).forEach((o) => {
        if (o.ka0 < 1) { g.globalAlpha = (1 - o.ka0) * 0.7; drawPetal(g, petalSprite(o.f.q.spr, o.f.q.dark), o.x, o.y, o.th, o.sx, 1, o.sW, o.sL, 'c', o.sq); g.globalAlpha = 1; }
        drawLoose(g, loosePetalSprite(o.f.spr, false), o.x, o.y, o.th, o.sx, o.sq, o.sW, o.sL, o.ka0);
      });
      // 5) 还在花头上的花瓣：先铺一层晕开的淡红（没骨晕染的水气），再画花瓣
      const fl = FP.list;
      const attached = (i) => t < fl.find((f) => f.i === i).tr;
      const left = ps.filter((qq, j) => attached(j)).length / ps.length, ka = clamp(left * 2.5, 0, 1);
      if (left > 0) {
        A.glow(g, P.cx, P.cy + 4, 100, '#d04452', 0.13 * left);
        A.glow(g, P.cx, P.cy, 64, '#a3202c', 0.12 * left);
      }
      ps.forEach((q, i) => {
        if (!attached(i)) return;
        const a = petalAttached(P, q);
        drawPetal(g, petalSprite(q.spr, q.dark), a.bx, a.by, a.th, 1, 1, q.Wd, a.L, 'base');
      });
      // 花心一点暖黄：从杯口露出的花蕊（随花瓣松脱一起散落）
      if (ka > 0) {
        const [mx, my] = local2w(P, 2, 34);
        A.glow(g, mx, my, 11, '#e2a640', 0.4 * ka);
        for (let m = 0; m < 9; m++) {
          const [sx0, sy0] = local2w(P, (h2(m, 3) - 0.5) * 16, 30 + h2(m, 5) * 8);
          g.fillStyle = `rgba(${236 + 14 * h2(m, 7) | 0},${196 + 30 * h2(m, 8) | 0},${90 + 40 * h2(m, 9) | 0},${0.9 * ka})`;
          g.beginPath(); g.arc(sx0, sy0, 1.1 + 0.7 * h2(m, 6), 0, TAU); g.fill();
        }
      }
      // 花瓣上两三颗雨珠，映着天光微微闪（随所在的花瓣一起落下）
      ps.map((q, i) => ({ q, i })).filter((o) => o.q.grp === 0 && !o.q.dark).slice(0, 3).forEach((o, j) => {
        if (!attached(o.i)) return;
        const a = petalAttached(P, o.q), d = 0.5 + 0.12 * j, off = (j - 1) * 0.12 * o.q.Wd;
        const x = a.bx + Math.cos(a.th) * a.L * d - Math.sin(a.th) * off, y = a.by + Math.sin(a.th) * a.L * d + Math.cos(a.th) * off;
        drawBead(g, x, y, 1.7 + 0.3 * j, 1.05);
        const tw = Math.pow(Math.max(0, Math.sin(TAU * 0.4 * t + j * 2.1)), 6);
        A.glow(g, x - 0.5, y - 0.6, 6, '#ffffff', 0.2 + 0.4 * tw);
      });
      // 6) 瓣尖水珠（第1句第3、4字时落进积水）
      for (const d of drops) {
        const [tx, ty] = tipOf(d.idx);
        const tf = Math.sqrt((2 * (d.yw - ty - 5)) / GP), td = d.tl - tf;
        if (t < td) {
          if (t > tR) continue;
          const k = clamp((t - d.g0) / (td - d.g0), 0, 1), rad = 1.8 + 3.4 * smooth(k);
          drawBead(g, tx, ty + rad * (1 + 0.4 * k), rad, 1 + 0.35 * k * k);
        } else if (t < d.tl) {
          const u = t - td, y = ty + 5 + 0.5 * GP * u * u;
          drawBead(g, tx, y, 3.8, 1 + Math.min(1.1, u * 6));
        } else if (t < tR) {
          const k = clamp((t - d.tl) / 1.4, 0, 1), rad = 1.2 + 1.6 * smooth(k);
          drawBead(g, tx, ty + rad, rad, 1);
        }
      }
      drawEaveDrips(g, t);
    }
    // 花托、萼片（反卷贴着花颈）与花心的几枚蓇葖
    function drawCalyx(g, P) {
      const leaf = (x0, y0, x1, y1, w, bend, col) => {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        g.fillStyle = col;
        g.beginPath(); g.moveTo(x0 + nx * w * 0.5, y0 + ny * w * 0.5);
        g.quadraticCurveTo(mx + nx * (w + bend), my + ny * (w + bend), x1, y1);
        g.quadraticCurveTo(mx + nx * (-w + bend), my + ny * (-w + bend), x0 - nx * w * 0.5, y0 - ny * w * 0.5);
        g.closePath(); g.fill();
      };
      // 萼片：短而宽，自花托生出，尖端贴着花颈反卷
      for (const [sd, ox, oy, w, bd] of [[-1, 9, -6, 5.5, -1.5], [1, 10, -5, 6, 1.5], [-1, 5, -11, 4, -1], [1, 4, -12, 3.8, 1]]) {
        const [x0, y0] = local2w(P, sd * 3, -CEN + 7), [x1, y1] = local2w(P, sd * ox, -CEN + oy);
        leaf(x0, y0, x1, y1, w, bd, sd > 0 ? '#4a6544' : '#557150');
      }
      // 花托：一小团略鼓的绿
      const [rx, ry] = local2w(P, 0, -CEN + 7);
      g.fillStyle = '#4f6b48'; g.beginPath(); g.ellipse(rx, ry, 7, 5.5, P.ang, 0, TAU); g.fill();
      // 蓇葖：三四枚黄绿色的小果，朝花面方向微微张开，带一点茸毛的亮边
      for (const [ang, len, ox] of [[-0.34, 10, -3.5], [0.03, 11.5, 0], [0.38, 10, 3.5], [0.16, 8, 1.5]]) {
        const [x0, y0] = local2w(P, ox, -CEN + 9);
        const d = P.ang + ang, x1 = x0 + Math.cos(d) * len, y1 = y0 + Math.sin(d) * len;
        leaf(x0, y0, x1, y1, 5.2, 0.6, '#a2ad46');
        leaf(x0 + Math.cos(d) * 2, y0 + Math.sin(d) * 2, x1, y1, 3, 0.4, 'rgba(200,198,118,0.55)');
      }
    }
    return { draw, warm: [bgLayer, leafLayer, mistTex, stoneLayer, spillLayer, wetLayer, eaveLayer, fgLeafTex, () => { for (let k = 0; k < 6; k++) { petalSprite(k, false); petalSprite(k, true); } for (let k = 0; k < 4; k++) { loosePetalSprite(k, false); loosePetalSprite(k, true); } }] };
  })();

  XYT.registerShot('e6_peony', {
    name: '残红', zone: 'left', night: false,
    text: '#2a2622', shadow: 'rgba(250,248,244,0.85)', accent: '#b3202d', bloom: 0.2,
    draw: E6.draw,
  });

  // =====================================================================
  // e7_fireflies 萤火消晨：雨后初夏夜将尽，山涧竹林萤火；东方日出第一线光，萤火一只只淡去
  // =====================================================================
  const E7 = (function () {
    const SUN = { x: 1064, y: 0 };
    const WSH = 0.3;                           // 涧水晨光的峰值强度
    const bankY = (x) => 474 + 6 * Math.sin(x * 0.006 + 0.8) + 3 * Math.sin(x * 0.021);
    const ridge = (k, x) => {
      // 三层远山的山脊线：远山峰峦起伏，中层缓丘，近处左侧一座小山
      if (k === 0) return 360 - 70 * Math.pow(A.noise1(x * 0.0042, 31), 1.6) - 18 * A.noise1(x * 0.014, 32) + 10 * sstep(900, 1280, x);
      if (k === 1) return 420 - 64 * Math.pow(A.noise1(x * 0.0036 + 4, 33), 1.8) - 9 * A.noise1(x * 0.016, 34) + 16 * sstep(700, 1280, x);
      return 474 - 92 * Math.pow(sstep(820, 200, x), 1.2) * (0.75 + 0.25 * A.noise1(x * 0.006, 35)) - 6 * A.noise1(x * 0.03, 36);
    };
    SUN.y = Math.max(ridge(0, SUN.x), ridge(1, SUN.x) - 400) + 2;      // 日轮上缘刚露出最远的山脊
    // 竹：远岸几丛（略亮，空气透视），太阳正对处留出空隙；右侧近景两竿最暗、最粗
    let BAM = null;
    function bamboo() {
      if (BAM) return BAM;
      const r = A.rng(7070), far = [], near = [];
      const xs = [770, 792, 846, 902, 918, 974, 1010, 1112, 1131, 1166, 1222, 1240];
      for (const x of xs) far.push({ x: x + (r() - 0.5) * 8, w: 5 + r() * 4, lean: (r() - 0.5) * 0.06, base: bankY(x) + 1, seed: Math.floor(r() * 1000) });
      for (const [x, w] of [[1192, 19], [1252, 25]]) near.push({ x, w, lean: (r() - 0.5) * 0.03, base: 760, seed: Math.floor(r() * 1000) });
      return (BAM = { far, near });
    }
    const stalkX = (s, y) => s.x + (s.base - y) * s.lean;
    // 竹竿：一节一节，节处略收、留一线空白，节上一道深环
    function drawStalk(g, s, col, top, nodeCol) {
      const r = A.rng(s.seed + 11);
      let y = s.base;
      g.fillStyle = col;
      while (y > top) {
        const seg = 52 + r() * 34, y1 = Math.max(top, y - seg);
        const w0 = s.w * (0.92 + 0.08 * (y - top) / (s.base - top + 1)), w1 = w0 * 0.97;
        g.beginPath();
        g.moveTo(stalkX(s, y) - w0 / 2, y - 1.5); g.lineTo(stalkX(s, y1) - w1 / 2, y1 + 1.5);
        g.lineTo(stalkX(s, y1) + w1 / 2, y1 + 1.5); g.lineTo(stalkX(s, y) + w0 / 2, y - 1.5); g.closePath(); g.fill();
        g.fillStyle = nodeCol; g.fillRect(stalkX(s, y1) - w1 * 0.62, y1 - 1, w1 * 1.24, 2.4);
        g.fillStyle = col;
        y = y1;
      }
    }
    // 竹叶：“个”“介”字形的一组三到五片，披针形，叶尖下垂
    function leafGroup(g, x, y, s, col, seed, dir) {
      const r = A.rng(seed);
      g.fillStyle = col;
      const n = 3 + Math.floor(r() * 3);
      const base = Math.PI / 2 + dir * (0.5 + r() * 0.5);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * (0.32 + r() * 0.12), L = (30 + r() * 22) * s, w = (3.6 + r() * 1.8) * s;
        g.save(); g.translate(x, y); g.rotate(a - Math.PI / 2);
        g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(w * 1.1, L * 0.25, w * 0.6, L * 0.7, 0, L); g.bezierCurveTo(-w * 0.5, L * 0.7, -w * 1.0, L * 0.25, 0, 0); g.fill();
        g.restore();
      }
    }
    function bambooLeaves(g, s, col, top, scale, seed) {
      const r = A.rng(seed);
      g.strokeStyle = col; g.lineWidth = 1.2 * scale;
      for (let k = 0; k < 7; k++) {
        const y = top + 30 + r() * (s.base > 700 ? 300 : 260), dir = r() < 0.5 ? -1 : 1;
        const x0 = stalkX(s, y), bx = x0 + dir * (24 + r() * 40) * scale, by = y - (10 + r() * 20) * scale;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + bx) / 2, y - 4, bx, by); g.stroke();
        leafGroup(g, bx, by, scale, col, seed + k * 13, dir);
        if (r() < 0.6) leafGroup(g, (x0 + bx) / 2, y - 3, scale * 0.8, col, seed + k * 17 + 5, dir);
      }
    }
    // 天空：夜将尽，东方天边一线鱼肚白
    function skyLayer() {
      return K.cache('ff5_e7_sky', W, 500, 1, (g) => {
        g.fillStyle = A.vgrad(g, 0, 500, [[0, '#0a1220'], [0.5, '#101d31'], [1, '#1d3046']]); g.fillRect(0, 0, W, 500);
        // 黎明前：东边（右侧四成）整片天已经泛起冷灰的微明
        const gl = g.createLinearGradient(700, 0, W, 0);
        gl.addColorStop(0, 'rgba(84,110,132,0)'); gl.addColorStop(0.45, 'rgba(84,110,132,0.12)'); gl.addColorStop(1, 'rgba(96,120,140,0.24)');
        g.fillStyle = gl; g.fillRect(700, 0, W - 700, 500);
        const gr = g.createRadialGradient(SUN.x, SUN.y + 40, 10, SUN.x, SUN.y + 40, 900);
        gr.addColorStop(0, 'rgba(112,138,152,0.78)'); gr.addColorStop(0.22, 'rgba(76,102,122,0.44)');
        gr.addColorStop(0.55, 'rgba(48,72,96,0.16)'); gr.addColorStop(1, 'rgba(36,56,79,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, 500);
        // 天边几缕极淡的云，下缘受东方微光
        g.filter = 'blur(3px)';
        for (let i = 0; i < 6; i++) {
          const x = 700 + i * 100 + (h2(i, 4) - 0.5) * 60, y = 262 + h2(i, 5) * 60;
          g.fillStyle = `rgba(84,110,130,${0.16 + 0.1 * h2(i, 6)})`;
          g.beginPath(); g.ellipse(x, y, 110 + 80 * h2(i, 7), 5 + 3 * h2(i, 8), -0.02, 0, TAU); g.fill();
        }
        g.filter = 'none';
      });
    }
    // 远山三层（山顶深、山脚没入雾里）、水面（含倒影）、远岸竹丛
    const MT = [{ top: '#2a4157', mist: '#4f6b80', y1: 432 }, { top: '#1a2b3f', mist: '#3a566a', y1: 462 }, { top: '#101c2b', mist: '#253a4d', y1: 480 }];
    function landLayer() {
      return K.cache('ff5_e7_land', W, H, 1, (g) => {
        const B = bamboo();
        const mtn = (gg, k, flip) => {
          gg.beginPath();
          for (let x = -10; x <= W + 10; x += 5) {
            const y = ridge(k, x), yy = flip ? 2 * bankY(x) - y : y;
            x < 0 ? gg.moveTo(x, yy) : gg.lineTo(x, yy);
          }
          gg.lineTo(W + 10, flip ? 470 : H); gg.lineTo(-10, flip ? 470 : H); gg.closePath();
        };
        MT.forEach((m, k) => {
          let ymin = 1e9; for (let x = 0; x <= W; x += 20) ymin = Math.min(ymin, ridge(k, x));
          g.filter = `blur(${[2.2, 1.4, 0.7][k]}px)`;
          mtn(g, k, false);
          g.fillStyle = A.vgrad(g, ymin, m.y1, [[0, m.top], [0.55, mix(m.top, m.mist, 0.45)], [1, m.mist]]); g.fill();
          g.filter = 'none';
          // 山脚雾带
          g.fillStyle = A.vgrad(g, m.y1 - 50, m.y1 + 10, [[0, 'rgba(111,140,156,0)'], [0.75, 'rgba(111,140,156,0.28)'], [1, 'rgba(111,140,156,0)']]);
          g.fillRect(0, m.y1 - 50, W, 60);
        });
        // 远岸竹丛
        const fc = '#152233', fn = '#0e1826';
        for (const s of B.far) drawStalk(g, s, fc, -20, fn);
        for (const s of B.far) bambooLeaves(g, s, fc, -20, 0.8, 7200 + s.seed);
        // 岸脚
        g.fillStyle = '#0b131e';
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, bankY(x) - 3 - 4 * A.noise1(x * 0.04, 3) * sstep(600, 800, x));
        for (let x = W + 10; x >= -10; x -= 6) g.lineTo(x, bankY(x) + 2);
        g.closePath(); g.fill();
        // 水面：天光倒影 + 远山、远竹倒影（以岸线翻转，暗一些）
        const wt = document.createElement('canvas'), sc = g.getTransform().a;
        wt.width = Math.round(W * sc); wt.height = Math.round(H * sc);
        const w = wt.getContext('2d'); w.scale(sc, sc);
        w.fillStyle = A.vgrad(w, 470, H, [[0, '#24374d'], [0.45, '#162438'], [1, '#0c1524']]); w.fillRect(0, 0, W, H);
        const gr = w.createRadialGradient(SUN.x, 540, 10, SUN.x, 540, 640);
        gr.addColorStop(0, 'rgba(100,128,144,0.46)'); gr.addColorStop(1, 'rgba(36,56,79,0)');
        w.fillStyle = gr; w.fillRect(0, 470, W, 250);
        MT.forEach((m, k) => { mtn(w, k, true); w.fillStyle = mix(m.top, '#0a1220', 0.3); w.fill(); });
        for (const s of B.far) { w.save(); w.translate(0, 2 * s.base); w.scale(1, -1); drawStalk(w, s, '#0d1623', -20, '#0a121d'); w.restore(); }
        // 水纹：细碎横纹（近处稍长）
        for (let i = 0; i < 300; i++) {
          const y = 478 + Math.pow(h2(i, 1), 1.3) * 240, x = h2(i, 2) * W, d = (y - 470) / 250, l = 14 + 70 * h2(i, 3) * d;
          w.fillStyle = h2(i, 4) < 0.55 ? `rgba(6,10,18,${0.25 + 0.2 * d})` : 'rgba(130,160,180,0.07)';
          w.fillRect(x, y, l, 0.8 + d * 1.2);
        }
        g.save();
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 6) g.lineTo(x, bankY(x));
        g.lineTo(W + 10, H); g.lineTo(-10, H); g.closePath(); g.clip();
        g.filter = 'blur(1.6px)';
        g.drawImage(wt, 0, 0, W, H);
        g.filter = 'none';
        g.restore();
      });
    }
    // 近景：右侧两竿近竹与垂叶、左下与右下岸石草丛
    function nearLayer() {
      return K.cache('ff5_e7_near', W, H, 1, (g) => {
        const B = bamboo(), r = A.rng(7272);
        for (const s of B.near) drawStalk(g, s, '#060a10', -30, '#03060a');
        for (const s of B.near) bambooLeaves(g, s, '#05080d', -40, 1.3, 7300 + s.seed);
        // 从画外垂进来的一枝竹叶
        g.strokeStyle = '#05080d'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(1290, 40); g.quadraticCurveTo(1180, 60, 1110, 120); g.stroke();
        for (let k = 0; k < 5; k++) leafGroup(g, 1290 - k * 40, 46 + k * 16, 1.35, '#05080d', 7400 + k, -1);
        // 左下岸石与草
        g.fillStyle = '#070b11';
        g.beginPath(); g.moveTo(-20, 646); g.bezierCurveTo(60, 622, 160, 630, 232, 664); g.bezierCurveTo(282, 688, 330, 704, 380, 740); g.lineTo(-20, 740); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(1010, 740); g.bezierCurveTo(1040, 672, 1120, 638, 1300, 628); g.lineTo(1300, 740); g.closePath(); g.fill();
        g.strokeStyle = '#070b11'; g.lineWidth = 1.5;
        for (let i = 0; i < 64; i++) {
          const left = i < 36, x = left ? r() * 330 : 1030 + r() * 260, y0 = left ? 656 + (x / 330) * 28 : 652 - (x - 1030) * 0.08;
          const h = 12 + r() * 34, lean = (r() - 0.5) * 14;
          g.beginPath(); g.moveTo(x, y0 + 6); g.quadraticCurveTo(x + lean * 0.3, y0 - h * 0.6, x + lean, y0 - h); g.stroke();
        }
        g.strokeStyle = 'rgba(93,122,138,0.22)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(10, 638); g.bezierCurveTo(70, 622, 150, 628, 214, 656); g.stroke();
        g.beginPath(); g.moveTo(1060, 666); g.bezierCurveTo(1110, 644, 1190, 634, 1290, 630); g.stroke();
      });
    }
    // 萤火：各自的平滑游动、呼吸闪烁、所在的地面深度（决定倒影）与淡去顺序
    // 两只同高并排会像一对眼睛：整镜逐 0.1 s 检查（含倒影），太近就重抽
    let FF = null;
    function flies() {
      if (FF) return FF;
      const r = A.rng(7777), out = [], P = [];
      const TS = []; for (let k = 0; k <= 73; k++) TS.push(-0.6 + k * 0.1);
      const mk = () => {
        const overWater = r() < 0.6;
        const yg = overWater ? 490 + Math.pow(r(), 0.8) * 190 : 430 + r() * 40;
        const depth = clamp((yg - 420) / 280, 0, 1);
        const x0 = 380 + r() * 860;
        const hgt = (overWater ? 18 + r() * 120 : 40 + r() * 230) * (0.6 + 0.6 * depth);
        return {
          x0, yg, hgt, s: 0.55 + 0.75 * depth,
          ax: [12 + r() * 14, 5 + r() * 5], wx: [0.2 + r() * 0.25, 0.6 + r() * 0.5], px: [r() * TAU, r() * TAU],
          ay: [8 + r() * 12, 4 + r() * 6], wy: [0.3 + r() * 0.4, 0.8 + r() * 0.7], py: [r() * TAU, r() * TAU],
          T: 1 + r() * 2, ph: r() * TAU,
        };
      };
      const path = (f) => TS.map((t) => { const [x, y] = flyPos(f, t); return [x, y, f.yg > bankY(x) + 3 ? 2 * f.yg - y : null]; });
      const near = (a, b) => {
        if (Math.abs(a[0] - b[0]) >= 42) return false;
        const ys = [[a[1], b[1]], [a[2], b[1]], [a[1], b[2]], [a[2], b[2]]];
        return ys.some(([u, v]) => u != null && v != null && Math.abs(u - v) < 13);
      };
      for (let guard = 0; out.length < 46 && guard < 4000; guard++) {
        const f = mk(), q = path(f);
        let ok = true;
        for (let j = 0; j < P.length && ok; j++) for (let k = 0; k < TS.length; k++) if (near(q[k], P[j][k])) { ok = false; break; }
        if (!ok) continue;
        // 邻近的萤火在最靠近的时刻闪烁相位错开至少 π/2
        for (let j = 0; j < P.length; j++) {
          let dm = 1e9, km = 0;
          for (let k = 0; k < TS.length; k++) { const d = Math.hypot(q[k][0] - P[j][k][0], q[k][1] - P[j][k][1]); if (d < dm) { dm = d; km = k; } }
          if (dm > 80) continue;
          const o = out[j], tk = TS[km];
          const dph = ((((TAU * tk) / f.T + f.ph) - ((TAU * tk) / o.T + o.ph)) % TAU + TAU) % TAU;
          if (dph < Math.PI / 2 || dph > TAU - Math.PI / 2) f.ph += Math.PI;
        }
        out.push(f); P.push(q);
      }
      // 离东方亮处越近越早被晨光淹没
      out.forEach((f) => { f.key = -f.x0 + (r() - 0.5) * 380; });
      const sorted = out.slice().sort((a, b) => a.key - b.key);
      sorted.forEach((f, k) => { f.order = k / (sorted.length - 1); });
      return (FF = out);
    }
    function flyPos(f, t) {
      const x = f.x0 + f.ax[0] * Math.sin(f.wx[0] * t + f.px[0]) + f.ax[1] * Math.sin(f.wx[1] * t + f.px[1]);
      const y = f.yg - f.hgt + f.ay[0] * Math.sin(f.wy[0] * t + f.py[0]) + f.ay[1] * Math.sin(f.wy[1] * t + f.py[1]);
      return [x, y];
    }

    function draw(g, c) {
      const t = c.lt, t0 = c.t - c.lt;
      const ct = (k, d) => (c.charT(k) != null ? c.charT(k) - t0 : d);
      const tYu = ct(4, 2.2), tTu = ct(8, 3.82);
      // 晨光：日轮上缘刚露出山脊，耀斑在约 1.6 s 内亮起；日轮露出的面积随升起增长，光持续变强（只在 x>600 一侧）
      const k1 = smooth((t - tYu) / 1.6), late = Math.pow(clamp((t - tYu - 1) / 4, 0, 1), 1.5);
      const kd = k1 * (0.8 + 0.5 * late), kc = Math.min(1, kd);
      // 天光的颜色：先是鱼肚白，约 2.6 s 内转成淡金
      const gold = smooth((t - tYu - 0.4) / 2.6);
      const mixc = (p, q, k) => [0, 1, 2].map((i) => Math.round(p[i] + (q[i] - p[i]) * clamp(k, 0, 1)));
      const FISH = [226, 230, 222], GOLD = [246, 216, 164], cs = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
      const cDawn = mixc(FISH, GOLD, gold);
      g.drawImage(skyLayer(), 0, 0, W, 500);
      if (kd > 0) {
        // 东天整片转亮：暖色天光由地平线向上、向两侧铺开（普通叠加，颜色趋向天光本色，不会加成死白）
        g.save(); g.translate(SUN.x, SUN.y + 20); g.scale(1.35, 1);
        const RS = 420 + 80 * late, gs = g.createRadialGradient(0, 0, 0, 0, 0, RS);
        for (let k = 0; k <= 16; k++) {
          const u = k / 16, f = Math.exp(-u * u * 4) * Math.pow(1 - u, 1.6);
          gs.addColorStop(u, cs(mixc(cDawn, [196, 170, 158], u * 0.9), 0.62 * Math.min(1, kd) * f));
        }
        const lx0 = Math.max(-RS, (-SUN.x) / 1.35), lx1 = Math.min(RS, (W - SUN.x) / 1.35), ly0 = Math.max(-RS, -SUN.y - 20), ly1 = Math.min(RS, 500 - SUN.y - 20);
        g.fillStyle = gs; g.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
        g.restore();
        // 日轮周围的耀光
        const R = 120 + 330 * kd;
        const gr = g.createRadialGradient(SUN.x, SUN.y, 4, SUN.x, SUN.y, R);
        gr.addColorStop(0, `rgba(250,236,204,${0.95 * kc})`); gr.addColorStop(0.08, cs(mixc(cDawn, [246, 214, 168], 0.6), 0.7 * kc));
        gr.addColorStop(0.35, cs(mixc(cDawn, [234, 190, 142], 0.7), 0.3 * kc)); gr.addColorStop(1, 'rgba(220,172,130,0)');
        g.fillStyle = gr; g.fillRect(SUN.x - R, Math.max(0, SUN.y - R), Math.min(2 * R, W - SUN.x + R), Math.min(500, SUN.y + R) - Math.max(0, SUN.y - R));
        // 天边一条横向的光带（鱼肚白→淡金）
        g.save(); g.translate(SUN.x - 40, SUN.y + 10); g.scale(2.6 + 0.6 * late, 1);
        const gb = g.createRadialGradient(0, 0, 0, 0, 0, 200);
        gb.addColorStop(0, cs(mixc(cDawn, GOLD, 0.3), 0.36 * kc)); gb.addColorStop(0.5, cs(cDawn, 0.14 * kc)); gb.addColorStop(1, cs(cDawn, 0));
        g.fillStyle = gb; g.fillRect(-200, -200, 400, 400);
        g.restore();
        // 天亮后东天整体再暖一层
        if (gold > 0) {
          g.save(); g.translate(SUN.x, SUN.y + 20); g.scale(1.5, 1);
          const gwm = g.createRadialGradient(0, 0, 0, 0, 0, 380);
          gwm.addColorStop(0, `rgba(233,185,138,${0.26 * gold * kc})`); gwm.addColorStop(0.6, `rgba(233,185,138,${0.1 * gold * kc})`); gwm.addColorStop(1, 'rgba(233,185,138,0)');
          g.fillStyle = gwm; g.fillRect(Math.max(-380, -SUN.x / 1.5), Math.max(-380, -SUN.y - 20), 760, Math.min(760, 500 - SUN.y + 360));
          g.restore();
        }
        A.glow(g, SUN.x, SUN.y + 3, 14 + 4 * late, '#fff1d4', kc);
        A.glow(g, SUN.x, SUN.y + 3, 5 + 2 * late, '#fff8ea', kc);
      }
      g.drawImage(landLayer(), 0, 0, W, H);
      // 远山山脊被晨光勾出一线暖边（仅在太阳附近）
      if (kd > 0) {
        for (let k = 0; k < 2; k++) {
          const span = k ? 180 : 280;
          const gr = g.createLinearGradient(SUN.x - span, 0, SUN.x + span, 0);
          const a = (k ? 0.2 : 0.45) * kd;
          gr.addColorStop(0, 'rgba(246,220,170,0)'); gr.addColorStop(0.5, `rgba(246,220,170,${a})`); gr.addColorStop(1, 'rgba(246,220,170,0)');
          g.strokeStyle = gr; g.lineWidth = 1.1;
          g.beginPath();
          for (let x = SUN.x - span; x <= SUN.x + span; x += 6) { const y = ridge(k, x) + 0.8; x === SUN.x - span ? g.moveTo(x, y) : g.lineTo(x, y); }
          g.stroke();
        }
      }
      // 薄雾：几乎静止的两道雾带（无风，只极慢地漂）
      for (const [y, h, a, sp] of [[440, 34, 0.16, 1.2], [480, 22, 0.14, -0.8]]) {
        const gr = g.createLinearGradient(0, y - h, 0, y + h);
        gr.addColorStop(0, 'rgba(150,176,190,0)'); gr.addColorStop(0.5, `rgba(150,176,190,${a})`); gr.addColorStop(1, 'rgba(150,176,190,0)');
        g.fillStyle = gr;
        g.beginPath();
        for (let x = -10; x <= W + 10; x += 20) g.lineTo(x, y - h + 8 * Math.sin(x * 0.006 + sp * t * 0.05 + y));
        for (let x = W + 10; x >= -10; x -= 20) g.lineTo(x, y + h + 8 * Math.sin(x * 0.005 + sp * t * 0.05 + y * 2));
        g.closePath(); g.fill();
      }
      if (kd > 0) {
        g.globalCompositeOperation = 'lighter';
        g.save(); g.translate(SUN.x, 455); g.scale(1, 0.32);
        const gr = g.createRadialGradient(0, 0, 10, 0, 0, 520);
        gr.addColorStop(0, `rgba(233,185,138,${0.45 * Math.min(1, kd)})`); gr.addColorStop(1, 'rgba(233,185,138,0)');
        g.fillStyle = gr; g.fillRect(-520, -520, 1040, 1040);
        g.restore();
        // 晨光漫进山涧：水面映出转亮的东天，一大片暖色柔光由日下向左、向近处铺开（x≈380 以左已为零，歌词区不变）
        const RW = 760;
        g.save(); g.translate(SUN.x - 20, 488); g.scale(1, 0.46);
        const gm = g.createRadialGradient(0, 0, 0, 0, 0, RW), cW = mixc([214, 208, 192], [238, 196, 146], gold);
        for (let k = 0; k <= 16; k++) { const u = k / 16, f = Math.exp(-2 * u * u) * (1 - u); gm.addColorStop(u, cs(cW, WSH * kc * (0.75 + 0.25 * gold) * f)); }
        g.fillStyle = gm; g.fillRect(-RW, 0, Math.min(2 * RW, W - SUN.x + 20 + RW), RW);
        g.restore();
        // 日光倒影是一道竖向柔光，再加碎金
        g.save(); g.translate(SUN.x, 476); g.scale(1, 3.2);
        const gw = g.createRadialGradient(0, 0, 2, 0, 0, 90 + 70 * kd);
        gw.addColorStop(0, `rgba(250,236,200,${0.5 * kd})`); gw.addColorStop(0.4, `rgba(240,214,170,${0.22 * kd})`); gw.addColorStop(1, 'rgba(233,185,138,0)');
        g.fillStyle = gw; g.fillRect(-180, 0, 360, 80);
        g.restore();
        const spread = (0.5 + 0.5 * k1) * (1 + 0.5 * late);
        for (let i = 0; i < 110; i++) {
          const y = 478 + Math.pow(h2(i, 61), 1.4) * 240, d = (y - 476) / 244;
          const x = SUN.x + (h2(i, 62) - 0.55) * (16 + 200 * d) * spread + 5 * Math.sin(t * 0.7 + i);
          const tw = 0.5 + 0.5 * Math.sin(t * (2 + 2 * h2(i, 63)) + i * 1.7);
          const edge = clamp(Math.abs(x - SUN.x) / ((16 + 200 * d) * spread * 0.62), 0, 1);
          const a = kd * tw * (1 - d * 0.6) * 0.5 * (1 - edge * edge) * (i < 90 ? 1 : late);
          if (a < 0.02) continue;
          g.fillStyle = `rgba(255,236,196,${a})`;
          g.fillRect(x, y, 4 + 18 * d * h2(i, 64), 0.8 + d);
        }
        g.globalCompositeOperation = 'source-over';
      }
      // 萤火与倒影
      const F = flies();
      const downFlare = t > tYu ? c.de(0.55) * smooth((t - tYu) / 0.6) : 0;
      g.globalCompositeOperation = 'lighter';
      for (const f of F) {
        const tf = tTu + f.order * 2.1, fade = 1 - smooth((t - tf) / (0.6 + 0.3 * h2(f.x0 | 0, 3)));
        if (fade <= 0) continue;
        const p = 0.5 + 0.5 * Math.sin((TAU * t) / f.T + f.ph);
        let b = (0.22 + 0.78 * p * p * p) * (1 + 0.45 * downFlare);
        b *= fade * (1 - 0.25 * kd);
        const [x, y] = flyPos(f, t);
        const s = f.s;
        A.glow(g, x, y, 24 * s, '#c8e86a', 0.34 * b);
        A.glow(g, x, y, 9 * s, '#d9f27a', 0.5 * b);
        A.glow(g, x, y, 4 * s, '#f4ffd0', 0.95 * b);
        if (f.yg > bankY(x) + 3) {
          const yr = 2 * f.yg - y, jx = 1.6 * Math.sin(t * 2.6 + yr * 0.08);
          if (yr < H + 20) {
            g.save(); g.translate(x + jx, yr); g.scale(1, 1.4);
            A.glow(g, 0, 0, 13 * s, '#b8d860', 0.2 * b);
            A.glow(g, 0, 0, 3.6 * s, '#dff59a', 0.55 * b);
            g.restore();
          }
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.drawImage(nearLayer(), 0, 0, W, H);
      // 近竹逆光的一线暖边（靠近太阳的那几竿）
      if (kd > 0) {
        const B = bamboo();
        for (const s of B.far.concat(B.near)) {
          const d = Math.abs(stalkX(s, SUN.y) - SUN.x);
          if (d > 260) continue;
          const a = kd * (1 - d / 260) * (s.base > 700 ? 0.55 : 0.35);
          const top = s.base > 700 ? -30 : -20;
          for (const sd of [-1, 1]) {
            const gr = g.createLinearGradient(0, top, 0, s.base);
            gr.addColorStop(0, 'rgba(246,220,170,0)'); gr.addColorStop(0.55, `rgba(246,220,170,${a})`); gr.addColorStop(1, 'rgba(246,220,170,0)');
            g.strokeStyle = gr; g.lineWidth = 1;
            g.beginPath(); g.moveTo(stalkX(s, s.base) + sd * (s.w / 2 - 0.5), s.base); g.lineTo(stalkX(s, top) + sd * (s.w / 2 * 0.85 - 0.5), top); g.stroke();
          }
        }
      }
    }
    return { draw, warm: [skyLayer, landLayer, nearLayer] };
  })();

  XYT.registerShot('e7_fireflies', {
    name: '萤火消晨', zone: 'left', night: true,
    text: '#eef0e2', shadow: 'rgba(6,10,18,0.9)', accent: '#d9f27a', bloom: 0.45,
    draw: E7.draw,
  });

  // 页面空闲时预建静态贴图（结果与第一帧现建完全相同）
  try {
    const jobs = [...E5.warm, ...E6.warm, ...E7.warm];
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 4000 }) : (f) => setTimeout(f, 200);
    let tries = 0;
    const start = () => {
      if (!(XYT.sprites && XYT.sprites.S)) { if (++tries < 120) setTimeout(start, 500); return; }
      const step = () => { if (!jobs.length) return; try { jobs.shift()(); } catch (e) { /* 忽略 */ } idle(step); };
      idle(step);
    };
    setTimeout(start, 1500);
  } catch (e) { /* 无定时器环境 */ }
})();
