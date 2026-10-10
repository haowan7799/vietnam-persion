/* 第三版镜头组 ff6：e8_reeds（芦花残阳）、f2_icicle（冰棱断）、f6_jetty（残荷空渡）。不含歌词。 */
(function () {
  'use strict';
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, easeOut, h2, rgba, mix } = A;
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  // 第 k 个字的时间（相对镜头起点，与分镜表 charTimes 同一基准）；没有歌词时用分镜表里的秒数
  const CT = (c, k, def, off) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? def : v - (c.t - c.lt);
  };
  // 柔和圆点贴图
  function dot(key, col, core) {
    return K.cache('ff6dot_' + key, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(core, rgba(col, 0.6)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  // 在离屏画布上画完再整体模糊（只在建缓存时用滤镜）
  function blurred(w, h, px, fn) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * S)); c.height = Math.max(1, Math.round(h * S));
    const g = c.getContext('2d'); g.scale(S, S); fn(g);
    return { c, px };
  }
  // 滤镜的模糊半径按设备像素算，这里换算成逻辑像素
  function putBlur(g, b, x, y, w, h) {
    const S = (XYT.sprites && XYT.sprites.S) || 1;
    g.save(); g.filter = `blur(${(b.px * S).toFixed(2)}px)`; g.drawImage(b.c, x, y, w, h); g.restore();
  }
  // 贴图里不透明部分的外框（建好贴图后只量一次）；按外框裁着画，省去大片透明像素的混合
  function bbox(cv) {
    if (cv.bb) return cv.bb;
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 1) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 < 0) { x0 = y0 = x1 = y1 = 0; }
    const k = w / cv.lw;
    return (cv.bb = { sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1, x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k });
  }
  const blitBB = (g, cv, ox, oy) => { const b = bbox(cv); g.drawImage(cv, b.sx, b.sy, b.sw, b.sh, ox + b.x, oy + b.y, b.w, b.h); };
  // 沿中心线生成一片细长叶（或任何带宽度的曲线条）：pts 为中心线点列，w(s) 为宽度
  function blade(g, pts, w, cont) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const ww = w(i / (n - 1)) / 2;
      L.push([pts[i][0] + nx * ww, pts[i][1] + ny * ww]); R.push([pts[i][0] - nx * ww, pts[i][1] - ny * ww]);
    }
    if (!cont) g.beginPath();
    g.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
    g.closePath();
  }



  // ======================= e8 芦花残阳 =======================
  (function () {
    const HY = 422;                       // 地平线
    const GX = 840, GY = 150;             // 云缝中心（跟随上层云漂移）
    const SUNX = 1400, SUNY = -430;       // 云后太阳的虚位置：光束由此经云缝向左下散开
    const DECK_V = 3.2, SCUD_V = 7.5;     // 云向右漂（风向 +1）
    const B0 = 738, B1 = 1300;            // 中景苇岸：由中部地平线弯向右下
    const bankY = (x) => { const u = clamp((x - B0) / (B1 - B0)); return HY + 4 + 112 * Math.pow(u, 1.45) + 2.5 * (A.noise1(x / 37, 21) - 0.5); };

    // ---- 天空底色 + 远云（静态）：右侧地平线下透出一点暖光，太阳在右上云后 ----
    const sky = () => K.cache('ff6_e8_sky', 1700, 440, 1, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 432);
      gr.addColorStop(0, '#292e37'); gr.addColorStop(0.42, '#3b404a'); gr.addColorStop(0.74, '#575b64');
      gr.addColorStop(0.9, '#7a7a7c'); gr.addColorStop(0.97, '#97928b'); gr.addColorStop(1, '#a29b92');
      g.fillStyle = gr; g.fillRect(0, 0, 1700, 440);
      g.save(); g.translate(1060 + 180, 425); g.scale(1, 0.16);
      const wg = g.createRadialGradient(0, 0, 0, 0, 0, 620);
      wg.addColorStop(0, 'rgba(196,160,128,0.55)'); wg.addColorStop(0.5, 'rgba(170,140,118,0.22)'); wg.addColorStop(1, 'rgba(160,130,110,0)');
      g.fillStyle = wg; g.fillRect(-700, -700, 1400, 1400); g.restore();
      const r = A.rng(811);
      const b = blurred(1700, 440, 9, (q) => {
        for (let i = 0; i < 90; i++) {
          const y = 240 + Math.pow(r(), 0.7) * 175, x = r() * 1700, k = (y - 240) / 175, rx = 70 + r() * 230 * (1 - k * 0.6), ry = 3 + r() * 9 * (1 - k * 0.7);
          q.fillStyle = rgba(r() < 0.6 ? '#474b55' : '#8a8784', 0.16 + r() * 0.2);
          q.beginPath(); q.ellipse(x, y, rx, ry, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, b, 0, 0, 1700, 440);
    });
    // ---- 上层雨云（宽贴图，向右慢漂） ----
    // 用分形噪声按透视铺出雨云层：近处（上方）云块大，远处（近地平线）云块小而扁
    const fbm = (x, y) => {
      let v = 0, a = 0.5, f = 1;
      for (let o = 0; o < 5; o++) {
        const c = Math.cos(0.7 * o + 0.3), sn = Math.sin(0.7 * o + 0.3);
        v += a * A.noise2((x * c - y * sn) * f + o * 17.3, (x * sn + y * c) * f - o * 9.1, 7 + o); a *= 0.5; f *= 2.03;
      }
      return v;
    };
    // 云层贴图坐标 (x, y) 处的云量与云心（云缝的边和云边受光都按它来）
    const deckAt = (x, y) => {
      const z = 1 / Math.max(24, 455 - y);      // 深度
      const X = (x - 820) * z * 2.2, Y = z * 900;
      const n = fbm(X * 1.1 + 3, Y * 2.3);
      const m = A.noise2(X * 0.29 + Y * 0.21 + 9, Y * 0.7 - X * 0.12, 3);
      let dens = smooth((n - 0.36 + 0.18 * (m - 0.5)) / 0.26);
      dens *= 0.55 + 0.45 * (1 - smooth((y - 250) / 80));    // 近地平线处变薄
      return [dens, smooth((n - 0.55) / 0.2)];
    };
    const deck = () => K.cache('ff6_e8_deck', 1700, 330, 1, (g) => {
      const sc = 0.5, cw = Math.round(1700 * sc), ch = Math.round(330 * sc);
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const q = cv.getContext('2d'), img = q.createImageData(cw, ch), D = img.data;
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const [dens, core] = deckAt(i / sc, j / sc);
          const k = (j * cw + i) * 4;
          // 云体深灰，云心更暗，边缘略亮
          const base = 44 - 14 * core + 10 * (1 - dens);
          D[k] = base; D[k + 1] = base + 4; D[k + 2] = base + 12;
          D[k + 3] = Math.round(255 * clamp(dens * 0.92));
        }
      }
      q.putImageData(img, 0, 0);
      g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      g.filter = `blur(${(1.5 * S).toFixed(2)}px)`;
      g.drawImage(cv, 0, 0, 1700, 330); g.restore();
    });
    const skyDeck = () => K.cache('ff6_e8_skydeck', 1700, 440, 1, (g) => {
      g.drawImage(sky(), 0, 0, 1700, 440);
      g.drawImage(deck(), 0, 0, 1700, 330);
    });
    // ---- 低层碎云（近地平线，偏亮，漂得快一点） ----
    const scud = () => K.cache('ff6_e8_scud', 1700, 140, 1, (g) => {
      const r = A.rng(8177);
      const b = blurred(1700, 140, 5, (q) => {
        for (let i = 0; i < 90; i++) {
          const y = 20 + Math.pow(r(), 0.8) * 100, x = r() * 1700;
          const k = (y - 20) / 100, rx = (60 + r() * 120) * (1 - k * 0.5), ry = (5 + r() * 9) * (1 - k * 0.6);
          q.fillStyle = rgba(r() < 0.55 ? '#454953' : '#6c6d72', 0.2 + r() * 0.25);
          q.beginPath(); q.ellipse(x, y, rx, ry, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, b, 0, 0, 1700, 140);
    });

    const glowTex = (key, stops) => K.cache('ff6_e8_glow' + key, 256, 64, 1, (g) => {
      g.save(); g.translate(128, 32); g.scale(1, 0.25);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 128);
      stops.forEach(([o, c]) => gr.addColorStop(o, c));
      g.fillStyle = gr; g.fillRect(-128, -128, 256, 256); g.restore();
    });
    const halo = () => glowTex('H', [[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
    const haloT = (col) => K.cache('ff6_e8_halo' + col, 256, 64, 1, (g) => {
      g.drawImage(halo(), 0, 0, 256, 64);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, 256, 64);
    });
    // ---- 云缝：一道又长又不齐的裂口，右段（近日一侧）宽而亮，向左拖成暗红的细丝 ----
    const HL = 390, UP = 0.3;                 // 半长；最宽处偏右
    const GSTEP = 5, GN = Math.round((2 * HL) / GSTEP) + 1;
    // 起伏以大的云团为主，细碎的两层噪声合计不超过 8%
    const nz = (x, s, a1) => a1 * (A.noise1(x / 110, s) - 0.5) + a1 * 0.5 * (A.noise1(x / 41, s + 1) - 0.5) + a1 * 0.06 * (A.noise1(x / 13, s + 2) - 0.5) + a1 * 0.02 * (A.noise1(x / 5, s + 3) - 0.5);
    const GAPK = (() => {
      const out = [];
      let phT = 0.3, phB = 0.75;
      for (let i = 0; i < GN; i++) {
        const x = -HL + i * GSTEP, u = x / HL;
        const t = u >= UP ? (u - UP) / (1 - UP) : (UP - u) / (1 + UP);
        // 近日的右段缓缓收窄，末端是圆头（末 10% 以 √ 收口）；左段尖细地拖进云里
        const prof = u >= UP ? (1 - 0.6 * Math.pow(t, 1.6)) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 6))) : Math.max(0, 1 - Math.pow(t, 1.15));
        const mod = 0.7 + 0.6 * A.noise1(x / 95 + 3.3, 61);
        // 一道云桥从上唇垂下，把暗红的细尾隔开（不对称：上边压下来得多）
        const bk = Math.exp(-Math.pow((u + 0.36) / 0.07, 2)), bridge = Math.max(0, 1 - 0.62 * bk);
        out.push({
          x, u, prof: prof * mod * bridge, bsh: bk * prof * mod,
          c: 14 * u - 10 * u * u + nz(x, 63, 16),               // 中线起伏
          th: nz(x, 67, 14),                                     // 宽度噪声
          eT: nz(x * 1.7, 71, 3), eB: nz(x * 1.7, 73, 3),        // 上下边各自的小起伏
          // 云底一团团鼓进裂口（圆弧状的云团，宽 55–135 px）
          oT: Math.pow(Math.abs(Math.sin(Math.PI * phT)), 0.6), oB: Math.pow(Math.abs(Math.sin(Math.PI * phB)), 0.6),
          aT: 0.08 + 0.26 * A.noise1(x / 70, 91), aB: 0.06 + 0.2 * A.noise1(x / 60, 93),
        });
        phT += GSTEP / (55 + 80 * A.noise1(x / 120, 95)); phB += GSTEP / (60 + 70 * A.noise1(x / 100, 97));
      }
      return out;
    })();
    // 开口距离 d 时各点的上下边（相对云缝中心）
    function gapEdges(d) {
      const T = new Float32Array(GN), B = new Float32Array(GN), O = new Float32Array(GN);
      const nk = Math.min(1, d / 30);
      for (let i = 0; i < GN; i++) {
        const k = GAPK[i];
        const th = Math.max(0, 1.12 * d * k.prof + k.th * nk * (0.3 + 0.7 * k.prof));
        O[i] = th;
        const cc = k.c + 0.35 * d * k.bsh;
        T[i] = cc - th * 0.55 + (th > 0.5 ? k.eT * Math.min(1, th / 12) : 0) + th * k.aT * k.oT;
        B[i] = cc + th * 0.45 + (th > 0.5 ? k.eB * Math.min(1, th / 12) : 0) - th * k.aB * k.oB;
        if (B[i] < T[i]) { const m = (T[i] + B[i]) / 2; T[i] = m; B[i] = m; }
      }
      return { T, B, O };
    }
    // 云缝里的天色：近日的右端最亮，向左渐成暗红（未撕开 / 撕开后两套）
    const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const stops = (L) => L.map(([u, c]) => [u, hx(c)]);
    const SKY0 = stops([[-1, '#4a160f'], [-0.72, '#6a2216'], [-0.42, '#923826'], [-0.12, '#b65034'], [0.35, '#a8442c'], [0.7, '#b4502f'], [1, '#b85834']]);
    const SKY1 = stops([[-1, '#5a1c14'], [-0.6, '#a03a22'], [-0.12, '#e07034'], [0.3, '#f59a52'], [0.62, '#ffbd76'], [0.86, '#ffd29a'], [1, '#ffca92']]);
    const colAt = (S, u) => {
      let i = 0; while (i < S.length - 2 && S[i + 1][0] < u) i++;
      const t = clamp((u - S[i][0]) / (S[i + 1][0] - S[i][0]));
      return [lerp(S[i][1][0], S[i + 1][1][0], t), lerp(S[i][1][1], S[i + 1][1][1], t), lerp(S[i][1][2], S[i + 1][1][2], t)];
    };
    // 预烘贴图范围（相对云缝中心）与开口档位
    const PX0 = HL + 50, PW = 2 * HL + 100, PY0 = 100, PH = 200;
    const MX0 = PX0 + 70, MW = PW + 140, MY0 = PY0 + 50, MH = PH + 100;     // 连光晕在内的整张贴图
    const DLV = [0, 7, 14, 21, 28, 36, 43, 50], DLIT = [50, 65];            // 未撕开各档；撕开后的亮版两档
    let GF = null;
    // 二维纹理（只算一次）：dn/cr 是这块云层本身的云量与云心（云缝贴图 (i,j) 对应云层贴图 (GX+180-PX0+i, GY+12-PY0+j)），
    // na 扰动边缘，nt 云边细纹，ns 边缘软硬，nv 远处薄云纱
    function gapField() {
      if (GF) return GF;
      const n = PW * PH, na = new Float32Array(n), nt = new Float32Array(n), ns = new Float32Array(n), nv = new Float32Array(n), dn = new Float32Array(n), cr = new Float32Array(n);
      for (let j = 0; j < PH; j++) {
        for (let i = 0; i < PW; i++) {
          const x = i - PX0, y = j - PY0, k = j * PW + i;
          const xr = x * 0.94 + y * 0.34, yr = y * 0.94 - x * 0.34;      // 斜一点，避开值噪声的横竖格
          na[k] = 0.62 * A.noise2(xr / 46, yr / 24, 5) + 0.3 * A.noise2(xr / 19 + 7.3, yr / 11, 6) + 0.08 * A.noise2(xr / 7, yr / 5, 7);
          nt[k] = 0.62 * A.noise2(xr / 13 + 3.1, yr / 8, 8) + 0.38 * A.noise2(xr / 6, yr / 4, 9);
          ns[k] = A.noise2(x / 70 + 1.7, y / 34, 10);
          nv[k] = 0.65 * A.noise2(x / 120 + y / 40, y / 6, 11) + 0.35 * A.noise2(x / 45, y / 3.5, 12);
          const dc = deckAt(GX + 180 + x, GY + 12 + y); dn[k] = dc[0]; cr[k] = dc[1];
        }
      }
      return (GF = { na, nt, ns, nv, dn, cr });
    }
    // 可分离的方框模糊（三遍近似高斯），只在建缓存时用
    function boxBlur(src, w, h, r) {
      let a = src, b = new Float32Array(w * h);
      for (let pass = 0; pass < 3; pass++) {
        for (let j = 0; j < h; j++) {
          let acc = 0; const o = j * w;
          for (let i = -r; i <= r; i++) acc += a[o + clamp(i, 0, w - 1)];
          for (let i = 0; i < w; i++) { b[o + i] = acc / (2 * r + 1); acc += a[o + Math.min(w - 1, i + r + 1)] - a[o + Math.max(0, i - r)]; }
        }
        const c = new Float32Array(w * h);
        for (let i = 0; i < w; i++) {
          let acc = 0;
          for (let j = -r; j <= r; j++) acc += b[clamp(j, 0, h - 1) * w + i];
          for (let j = 0; j < h; j++) { c[j * w + i] = acc / (2 * r + 1); acc += b[Math.min(h - 1, j + r + 1) * w + i] - b[Math.max(0, j - r) * w + i]; }
        }
        a = c;
      }
      return a;
    }
    // 逐像素画一档：开口顺着云层薄处张开；边缘软硬不一；上暗下亮的天色、远处的薄云纱、两缕淡云丝；
    // 缝边的云就是这片云层本身（按开口模糊后的距离取一圈），薄处透红、朝光的下唇和近日的右段受光
    function bakeGap(k, lit) {
      const F = gapField(), d = (lit ? DLIT : DLV)[k], E = gapEdges(d), nk = Math.min(1, d / 30), N = PW * PH;
      const mk = () => { const c = document.createElement('canvas'); c.width = PW; c.height = PH; return c; };
      const cv = mk(), ov = mk(), q = cv.getContext('2d'), oq = ov.getContext('2d');
      const img = q.createImageData(PW, PH), oimg = oq.createImageData(PW, PH), D = img.data, OD = oimg.data;
      const SK = lit ? SKY1 : SKY0;
      const lipC = hx(lit ? '#f0985a' : '#a4482e'), linC = hx(lit ? '#ffdcaa' : '#cf6a44');
      const wC = hx(lit ? '#8a5444' : '#5a2c26'), topC = hx(lit ? '#b0503e' : '#6e2c2c'), vC = hx(lit ? '#c0604a' : '#6a3030'), edC = hx(lit ? '#d0502a' : '#8a2a1c');
      const AA = new Float32Array(N), SR = new Float32Array(N), SG = new Float32Array(N), SB = new Float32Array(N);
      const CC = new Float32Array(PW), XK = new Float32Array(PW), LN = new Float32Array(PW);
      for (let i = 0; i < PW; i++) {
        const x = i - PX0, fi = (x + HL) / GSTEP, u = x / HL;
        XK[i] = 0.3 + 0.7 * smooth((u + 0.5) / 1.1);                         // 越近日越亮
        LN[i] = smooth((A.noise1(x / 23, 77) - 0.3) / 0.4);                   // 衬里断续
        if (fi < 0 || fi > GN - 1) { CC[i] = 0; continue; }
        const i0 = Math.min(GN - 2, Math.floor(fi)), t = fi - i0;
        const T = lerp(E.T[i0], E.T[i0 + 1], t), B = lerp(E.B[i0], E.B[i0 + 1], t), O = lerp(E.O[i0], E.O[i0 + 1], t);
        const cc = (T + B) / 2; CC[i] = cc;
        if (O < 0.05) continue;
        const sky = colAt(SK, u);
        const amp = 0.3 * Math.min(O, 30) + 1.5 * nk, oa = smooth(O / 3), dk = Math.min(1, O / 14) * 10;
        const tip = 1 - smooth((Math.min(1, 1.25 - Math.abs(u + 0.05) * 1.2)) / 0.35);   // 两端渐渐化进云里
        // 两缕淡云丝：各占一段、互不相交
        let w1 = 0, w2 = 0, y1 = 0, y2 = 0, t1 = 1, t2 = 1;
        if (u > 0.14 && u < 0.8) { const v = (u - 0.14) / 0.66; w1 = Math.pow(Math.sin(Math.PI * v), 0.8) * (0.6 + 0.4 * A.noise1(x / 30, 83)); y1 = cc - 0.14 * O + 0.035 * (x - 0.47 * HL); t1 = 2.2 + 3.2 * w1; }
        if (u > -0.3 && u < 0.06) { const v = (u + 0.3) / 0.36; w2 = Math.pow(Math.sin(Math.PI * v), 0.8) * (0.6 + 0.4 * A.noise1(x / 26, 85)); y2 = cc + 0.12 * O + 0.025 * (x + 0.12 * HL); t2 = 1.8 + 2.4 * w2; }
        for (let j = 0; j < PH; j++) {
          const y = j - PY0, kk = j * PW + i;
          let f = Math.min(y - T, B - y);
          if (f < -30) continue;
          f += amp * (F.na[kk] - 0.5) * 2 + dk * (0.55 - F.dn[kk]);           // 云薄处开得多，云厚处收回
          // 厚云处边缘清楚（≥2 px），薄云处向外渐隐 8–12 px
          const s = Math.min(2 + 9 * Math.pow(smooth((F.ns[kk] - 0.4) / 0.4), 1.5) * (1.2 - F.dn[kk]) + 7 * tip, 0.6 + 0.6 * O);
          const a = smooth((f + s) / (1.3 * s)) * oa;
          if (a <= 0) continue;
          const vv = clamp((y - T) / Math.max(4, B - T));                    // 0 上唇 → 1 下唇
          const ib = (0.86 + 0.14 * smooth(f / 18)) * (0.8 + 0.34 * vv * vv);   // 越近下唇（越近地平线）越亮
          let sr = sky[0] * ib, sg = sky[1] * ib, sb = sky[2] * ib;
          const ek = 0.3 * (1 - smooth(f / 12));                             // 贴着云边更红
          sr += (edC[0] - sr) * ek; sg += (edC[1] - sg) * ek; sb += (edC[2] - sb) * ek;
          const tk = 0.5 * (1 - vv) * (1 - vv);                               // 上唇下面偏暗紫
          sr += (topC[0] - sr) * tk; sg += (topC[1] - sg) * tk; sb += (topC[2] - sb) * tk;
          const va = 0.5 * smooth((F.nv[kk] - 0.48) / 0.2) * (0.4 + 0.6 * vv);   // 远处一层层横向的薄云
          sr += (vC[0] - sr) * va; sg += (vC[1] - sg) * va; sb += (vC[2] - sb) * va;
          let wa = 0;
          if (w1 > 0) wa += 0.13 * w1 * Math.exp(-Math.pow((y - y1) / t1, 2));
          if (w2 > 0) wa += 0.12 * w2 * Math.exp(-Math.pow((y - y2) / t2, 2));
          sr += (wC[0] - sr) * wa; sg += (wC[1] - sg) * wa; sb += (wC[2] - sb) * wa;
          AA[kk] = a; SR[kk] = sr; SG[kk] = sg; SB[kk] = sb;
        }
      }
      // 到开口的“距离”：开口遮罩模糊后的值（宽一圈做云边，窄一圈做衬里）
      const G1 = boxBlur(AA, PW, PH, 5), G2 = boxBlur(AA, PW, PH, 2);
      for (let j = 0; j < PH; j++) {
        const y = j - PY0;
        for (let i = 0; i < PW; i++) {
          const kk = j * PW + i, a = AA[kk];
          let pr = 0, pg = 0, pb = 0, pa = 0;
          if (a > 0) {
            pr = SR[kk] * a; pg = SG[kk] * a; pb = SB[kk] * a; pa = a;
            const o = kk * 4; OD[o] = SR[kk]; OD[o + 1] = SG[kk]; OD[o + 2] = SB[kk]; OD[o + 3] = 255 * a;
          }
          const g1 = G1[kk];
          if (g1 > 0.004 && a < 0.999) {
            const dn = F.dn[kk], cr = F.cr[kk], tex = F.nt[kk];
            const band = Math.min(1, g1 * 2.4), side = y > CC[i] ? 1 : 0.18, thin = (1 - cr) * (1.1 - dn), xk = XK[i];
            const gl = Math.min(1, band * thin * side * xk * 1.6 + 0.12 * band * thin);
            // 衬里只在朝光的下唇：宽 3–6 px 的柔和亮带，按噪声断续、浓淡不一
            const ln = (y > CC[i] ? 1 : 0) * Math.min(1, G2[kk] * 1.6) * Math.pow(xk, 1.5) * LN[i] * (0.3 + 0.7 * (1 - cr)) * (0.5 + 0.5 * tex) * (lit ? 0.9 : 0.45);
            const la = clamp(0.6 * band + 0.7 * ln) * (1 - a);
            if (la > 0.003) {
              // 与云层贴图同一算法的颜色，叠在同样的天色上（这里的天色约 #3b404a）
              const base = 44 - 14 * cr + 10 * (1 - dn) + 8 * (tex - 0.5), dv = dn * 0.92;
              let r = lerp(59, base, dv), gg = lerp(64, base + 4, dv), b = lerp(74, base + 12, dv);
              r += (lipC[0] - r) * gl; gg += (lipC[1] - gg) * gl; b += (lipC[2] - b) * gl;
              const lk = Math.min(1, ln * 1.2);
              r += (linC[0] - r) * lk; gg += (linC[1] - gg) * lk; b += (linC[2] - b) * lk;
              pr += r * la; pg += gg * la; pb += b * la; pa += la;
            }
          }
          if (pa > 0.002) { const o = kk * 4; D[o] = pr / pa; D[o + 1] = pg / pa; D[o + 2] = pb / pa; D[o + 3] = 255 * Math.min(1, pa); }
        }
      }
      q.putImageData(img, 0, 0); oq.putImageData(oimg, 0, 0);
      return { main: cv, open: ov };
    }
    // 云量遮罩（整张贴图范围，四分之一分辨率）：只有云量 > 0.3 的云底才接得住缝里漏下的暖光
    let DM = null;
    function densMask() {
      if (DM) return DM;
      const s = 0.25, w = Math.round(MW * s), h = Math.round(MH * s);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const q = cv.getContext('2d'), img = q.createImageData(w, h), D = img.data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = (i + 0.5) / s - MX0, y = (j + 0.5) / s - MY0, o = (j * w + i) * 4;
        D[o] = D[o + 1] = D[o + 2] = 255; D[o + 3] = 255 * smooth((deckAt(GX + 180 + x, GY + 12 + y)[0] - 0.15) / 0.3);   // 云量 0.3 处取一半，柔和过渡
      }
      q.putImageData(img, 0, 0);
      return (DM = cv);
    }
    // 一档贴图：外圈宽光晕（σ 30）+ 近光晕（σ 14）+ 缝周 20–80 px 云底的暖色反光 + 开口与缝边（滤镜只在建缓存时用）
    const gapLv = (k, lit) => K.cache('ff6_e8_gl' + k + (lit ? 'L' : ''), MW, MH, 1, (g) => {
      const R = bakeGap(k, lit), S = (XYT.sprites && XYT.sprites.S) || 1, ox = MX0 - PX0, oy = MY0 - PY0;
      g.save();
      g.filter = `blur(${(30 * S).toFixed(2)}px)`; g.globalAlpha = lit ? 0.26 : 0.18; g.drawImage(R.open, ox, oy, PW, PH);
      g.filter = `blur(${(14 * S).toFixed(2)}px)`; g.globalAlpha = lit ? 0.5 : 0.34; g.drawImage(R.open, ox, oy, PW, PH);
      g.restore();
      const d = (lit ? DLIT : DLV)[k], ga = lit ? 0.45 : 0.25 * Math.min(1, d / 50);
      if (ga > 0.003) {
        const gc = document.createElement('canvas'); gc.width = Math.round(MW * S); gc.height = Math.round(MH * S);
        const q = gc.getContext('2d'); q.scale(S, S);
        q.filter = `blur(${(34 * S).toFixed(2)}px)`; q.globalCompositeOperation = 'lighter';
        q.drawImage(R.open, ox, oy, PW, PH); q.drawImage(R.open, ox, oy, PW, PH);
        q.filter = 'none'; q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high';
        q.globalCompositeOperation = 'destination-in'; q.filter = `blur(${(5 * S).toFixed(2)}px)`; q.drawImage(densMask(), 0, 0, MW, MH); q.filter = 'none';
        q.globalCompositeOperation = 'source-in'; q.fillStyle = 'rgb(190,80,45)'; q.fillRect(0, 0, MW, MH);
        g.globalAlpha = ga; g.drawImage(gc, 0, 0, MW, MH); g.globalAlpha = 1;
      }
      g.drawImage(R.main, ox, oy, PW, PH);
    });
    // 两档之间的精确交叉淡化：在一张复用的临时画布上合成（只合成两档外框的并集，每次整块覆盖，只画这一块）
    let SCR = null;
    function mixLv(a, b, f) {
      if (f <= 0.002) return a;
      if (f >= 0.998) return b;
      if (!SCR || SCR.width !== a.width || SCR.height !== a.height) { SCR = document.createElement('canvas'); SCR.width = a.width; SCR.height = a.height; SCR.lw = a.lw; SCR.lh = a.lh; }
      const P = bbox(a), Q = bbox(b), k = a.width / a.lw;
      const sx = Math.min(P.sx, Q.sx), sy = Math.min(P.sy, Q.sy), sw = Math.max(P.sx + P.sw, Q.sx + Q.sw) - sx, sh = Math.max(P.sy + P.sh, Q.sy + Q.sh) - sy;
      const q = SCR.getContext('2d');
      q.setTransform(1, 0, 0, 1, 0, 0);
      q.globalCompositeOperation = 'copy'; q.globalAlpha = 1 - f; q.drawImage(a, sx, sy, sw, sh, sx, sy, sw, sh);
      q.globalCompositeOperation = 'lighter'; q.globalAlpha = f; q.drawImage(b, sx, sy, sw, sh, sx, sy, sw, sh);
      q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1;
      SCR.bb = { sx, sy, sw, sh, x: sx / k, y: sy / k, w: sw / k, h: sh / k };
      return SCR;
    }
    // 每帧：未撕开时在相邻两档间淡化；撕开后叠亮版（亮版完全盖住后底下的暗红档就不画）
    function drawGap(g, gx, gy, d, open, lit) {
      const x0 = gx - MX0, y0 = gy - MY0;
      const uo = open * (1 - smooth((lit - 0.5) / 0.5));
      if (uo > 0.002) {
        let k = 0; while (k < DLV.length - 2 && DLV[k + 1] <= d) k++;
        const f = clamp((d - DLV[k]) / (DLV[k + 1] - DLV[k]));
        if (k === 0) { if (f > 0.002) { g.globalAlpha = uo * f; blitBB(g, gapLv(1, false), x0, y0); } }
        else { g.globalAlpha = uo; blitBB(g, mixLv(gapLv(k, false), gapLv(k + 1, false), f), x0, y0); }
      }
      if (lit > 0.002) {
        // 亮版两档直接叠画（省一次整张合成）：窄档按 1−f² 退场、宽档按 f 进场，两端都与单档完全一致
        const L = Math.min(1, lit), f = clamp((d - DLIT[0]) / (DLIT[1] - DLIT[0])), a0 = L * (1 - f * f);
        if (a0 > 0.002) { g.globalAlpha = a0; blitBB(g, gapLv(0, true), x0, y0); }
        if (f > 0.002) { g.globalAlpha = L * f; blitBB(g, gapLv(1, true), x0, y0); }
      }
      g.globalAlpha = 1;
    }
    // ---- 远岸：低平的树丛与苇岸，带倒影 ----
    const shore = () => K.cache('ff6_e8_shore', W, 90, 1, (g) => {
      const top = (x) => 34 + 5 * A.noise1(x / 70, 3) + 4 * A.noise1(x / 19, 5) + 2 * A.noise1(x / 6, 9) - 9 * Math.pow(A.noise1(x / 120, 7), 2) * clamp((x - 360) / 300);
      const b = blurred(W, 90, 1.1, (q) => {
        q.fillStyle = '#5c5f67';
        q.beginPath(); q.moveTo(0, 47);
        for (let x = 0; x <= W; x += 4) q.lineTo(x, top(x));
        q.lineTo(W, 47); q.closePath(); q.fill();
        q.fillStyle = '#676a71';
        q.fillRect(0, 44, W, 3);
        q.save(); q.translate(0, 92); q.scale(1, -1);
        q.globalAlpha = 0.5; q.fillStyle = '#4b4e56';
        q.beginPath(); q.moveTo(0, 46);
        for (let x = 0; x <= W; x += 4) q.lineTo(x, 46 - (46 - top(x)) * 0.55);
        q.lineTo(W, 46); q.closePath(); q.fill();
        q.restore();
      });
      putBlur(g, b, 0, 0, W, 90);
    });
    // ---- 江面底色：天空的倒影（上亮下暗）+ 风吹的细纹 ----
    const water = () => K.cache('ff6_e8_water', W, H - HY + 4, 1, (g) => {
      const h = H - HY + 4;
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#8f8a83'); gr.addColorStop(0.07, '#75767a'); gr.addColorStop(0.3, '#55585f');
      gr.addColorStop(0.65, '#3c3f47'); gr.addColorStop(1, '#2b2e35');
      g.fillStyle = gr; g.fillRect(0, 0, W, h);
      // 右侧暖色地平光的倒影
      g.save(); g.translate(1060, 4); g.scale(1, 0.12);
      const wg = g.createRadialGradient(0, 0, 0, 0, 0, 560);
      wg.addColorStop(0, 'rgba(190,156,124,0.4)'); wg.addColorStop(1, 'rgba(160,130,110,0)');
      g.fillStyle = wg; g.fillRect(-600, -600, 1200, 1200); g.restore();
      const r = A.rng(8301);
      for (let i = 0; i < 460; i++) {
        const v = Math.pow(r(), 1.6), y = 3 + v * (h - 6), len = 16 + v * 150 + r() * 60, x = r() * W;
        const light = r() < 0.5;
        g.strokeStyle = rgba(light ? '#a29e97' : '#262930', (0.05 + r() * 0.09) * (1 - v * 0.4));
        g.lineWidth = 0.5 + v * 1.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
      }
    });

    // ---- 光束：从裂口右段（近日一侧）受光的下唇射下，宽窄不一、有断有续，到远处江面（地平线）为止 ----
    const DF = 65;                                         // 撕开后的开口
    const BEAMS = (() => {
      const r = A.rng(8602), E = gapEdges(DF), out = [];
      for (let i = 0; i < 16; i++) {
        const u = -0.1 + (0.95 * (i + r() * 0.7)) / 16, k = clamp(Math.round((u * HL + HL) / GSTEP), 0, GN - 1);
        const w = 5 + r() * 34, a = (0.16 + r() * 0.3) * (0.5 + 0.5 * clamp(GAPK[k].prof * 1.4)), col = r() < 0.5 ? '#ffd29a' : '#f59a5a';
        if (E.O[k] < 4 || r() < 0.22) continue;
        const sx = GX + u * HL, sy = GY + E.B[k] - 2;
        const land = (x) => x + ((HY + 5 - sy) * (x - SUNX)) / (sy - SUNY);
        out.push({ sx, sy, w, a, col, l0: land(sx - w / 2), l1: land(sx + w / 2) });
      }
      return out;
    })();
    const RX0 = Math.floor(Math.min(...BEAMS.map((b) => b.l0)) - 40), RY0 = GY - 30, RW = Math.ceil(Math.max(...BEAMS.map((b) => b.sx + b.w)) + 30 - RX0), RH = HY + 20 - RY0;
    const rays = () => K.cache('ff6_e8_rays2', RW, RH, 0.5, (g) => {
      g.translate(-RX0, -RY0);
      const b = blurred(RW + RX0 + 40, RH + RY0, 5, (q) => {   // 画在绝对坐标里，再整体模糊
        q.globalCompositeOperation = 'lighter';
        const quad = (x0, x1, y, l0, l1, a, col) => {
          const mx = (x0 + x1) / 2, ml = (l0 + l1) / 2;
          const gr = q.createLinearGradient(mx, y, ml, HY + 5);
          gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.25, rgba(col, a * 0.8)); gr.addColorStop(0.75, rgba(col, a * 0.35)); gr.addColorStop(1, rgba(col, 0));
          q.fillStyle = gr; q.beginPath(); q.moveTo(x0, y); q.lineTo(x1, y); q.lineTo(l1, HY + 5); q.lineTo(l0, HY + 5); q.closePath(); q.fill();
        };
        // 底层一片淡淡的光雾
        const lo = BEAMS[0], hi = BEAMS[BEAMS.length - 1];
        quad(lo.sx - lo.w, hi.sx + hi.w, (lo.sy + hi.sy) / 2, lo.l0 - 20, hi.l1, 0.1, '#f0a060');
        for (const bm of BEAMS) quad(bm.sx - bm.w / 2, bm.sx + bm.w / 2, bm.sy, bm.l0, bm.l1, bm.a, bm.col);
      });
      putBlur(g, b, 0, 0, RW + RX0 + 40, RH + RY0);
    });

    // ---- 中景苇岸 + 倒影：远处一片柔密的苇丛；前面是一簇簇高矮不一的苇，越远越稀越小 ----
    const dd = (x) => clamp((bankY(x) - HY) / 112);
    const bank = () => K.cache('ff6_e8_bank2', W, 300, 1, (g) => {
      const oy = 300;
      const r = A.rng(8407);
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      const hAt = (x) => { const d = dd(x); return (6 + 92 * d) * (0.3 + 0.95 * Math.pow(A.noise1(x / (12 + 40 * d), 61), 1.3)); };
      const back = [];
      for (let x = B0 - 14; x < W + 12; x += 0.5 + 2.0 * dd(x)) back.push({ x: x + r() * 1.5, hh: hAt(x) * (0.55 + 0.35 * r()), d: dd(x), lean: 0.08 + r() * 0.08, pr: r() });
      const clumps = [];
      for (let x = B0 + 24; x < W + 10;) {
        const d = dd(x);
        if (r() > 0.12 + 0.88 * d * d) { x += 8 + 30 * d; continue; }        // 越远越稀
        const n = 3 + ((r() * 5) | 0), hc = (5 + 82 * d) * (0.6 + 0.5 * r()), st = [];
        for (let k = 0; k < n; k++) st.push({ x: x + (r() - 0.5) * (3 + 12 * d), hh: hc * (0.55 + 0.6 * r()), lean: 0.1 + 0.14 * r(), d, tuft: r() < 0.6, tl: 0.5 + 0.5 * r() });
        clumps.push(st);
        x += (14 + 46 * d) * (0.6 + 0.9 * r());
      }
      const stalk = (q, s, col, a, wy) => {
        q.strokeStyle = rgba(col, a); q.lineWidth = 0.45 + s.d * 1.1; q.lineCap = 'round';
        const lx = s.hh * s.lean;
        q.beginPath(); q.moveTo(s.x, wy); q.quadraticCurveTo(s.x + lx * 0.15, wy - s.hh * 0.6, s.x + lx, wy - s.hh); q.stroke();
      };
      const plume = (q, s, col, a, wy) => {
        const px = s.x + s.hh * s.lean, py = wy - s.hh, pl = 2.5 + s.d * 14;
        q.strokeStyle = rgba(col, a); q.lineWidth = 0.8 + s.d * 3; q.lineCap = 'round';
        q.beginPath(); q.moveTo(px, py); q.quadraticCurveTo(px + pl * 0.5, py - pl * 0.05, px + pl, py + pl * 0.55); q.stroke();
      };
      // 簇苇的穗：柔软、顺风下垂的一小团
      const tuft = (q, s, wy) => {
        const px = s.x + s.hh * s.lean, py = wy - s.hh, pl = (3 + 13 * s.d) * s.tl;
        q.lineCap = 'round';
        q.strokeStyle = rgba('#b3ac9f', 0.42); q.lineWidth = 0.7 + 2.0 * s.d;
        q.beginPath(); q.moveTo(px, py); q.quadraticCurveTo(px + pl * 0.55, py - pl * 0.1, px + pl, py + pl * 0.65); q.stroke();
        q.strokeStyle = rgba('#d8d1c4', 0.3); q.lineWidth = 0.4 + 1.1 * s.d;
        q.beginPath(); q.moveTo(px, py - 0.5); q.quadraticCurveTo(px + pl * 0.5, py - pl * 0.22, px + pl * 0.92, py + pl * 0.4); q.stroke();
      };
      // 倒影（模糊、更暗、被水纹打断）
      const rb = blurred(W, 300, 2.6, (q) => {
        q.translate(0, -oy);
        for (const s of back) { if (s.pr > 0.5) continue; const wy = bankY(s.x); q.save(); q.translate(0, 2 * wy); q.scale(1, -1); stalk(q, s, mix('#4c4e54', '#2e2723', s.d), 0.45, wy); q.restore(); }
        for (const st of clumps) for (const s of st) { const wy = bankY(s.x); q.save(); q.translate(0, 2 * wy); q.scale(1, -1); stalk(q, s, mix('#4c4e54', '#2e2723', s.d), 0.5, wy); q.restore(); }
      });
      g.translate(0, -oy);
      g.save(); g.filter = `blur(${(2.6 * S).toFixed(2)}px)`; g.drawImage(rb.c, 0, oy, W, 300); g.restore();
      for (let i = 0; i < 110; i++) {
        const x = B0 + r() * (W - B0), y = bankY(x) + 2 + r() * 90;
        g.strokeStyle = rgba(r() < 0.5 ? '#76777b' : '#3a3c42', 0.25); g.lineWidth = 0.6 + r() * 0.6;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16 + r() * 50, y); g.stroke();
      }
      // 远处的苇丛：密而柔的一片（轻微模糊，空气透视）
      const bb = blurred(W, 300, 0.9, (q) => {
        q.translate(0, -oy);
        for (const s of back) stalk(q, s, mix('#696a70', '#3b332e', s.d), 0.6 + 0.3 * s.d, bankY(s.x) - 2 * s.d);
        for (const s of back) if (s.pr < 0.7) plume(q, s, mix('#8f8c87', '#bdb6a9', s.d * (0.5 + 0.5 * s.pr)), 0.4 + 0.2 * s.d, bankY(s.x) - 2 * s.d);
        q.strokeStyle = '#34302d';
        for (let x = B0; x < W; x += 5) { const d = dd(x); q.lineWidth = 1 + d * 9; q.beginPath(); q.moveTo(x, bankY(x) - d * 4); q.lineTo(x + 5, bankY(x + 5) - d * 4); q.stroke(); }
      });
      g.save(); g.filter = `blur(${(0.9 * S).toFixed(2)}px)`; g.drawImage(bb.c, 0, oy, W, 300); g.restore();
      // 前面的一簇簇
      for (const st of clumps) for (const s of st) stalk(g, s, mix('#77777c', '#2a221e', s.d), 0.45 + 0.45 * s.d, bankY(s.x));
      const tb = blurred(W, 300, 0.6, (q) => { q.translate(0, -oy); for (const st of clumps) for (const s of st) if (s.tuft) tuft(q, s, bankY(s.x)); });
      g.save(); g.filter = `blur(${(0.6 * S).toFixed(2)}px)`; g.drawImage(tb.c, 0, oy, W, 300); g.restore();
      g.strokeStyle = rgba('#8b8782', 0.4); g.lineWidth = 0.8;
      g.beginPath(); for (let x = B0 + 10; x <= W; x += 6) g.lineTo(x, bankY(x) + 1); g.stroke();
    });
    // 江面 + 远岸 + 中景苇岸合成一张（画面 y = 贴图 y + 370）
    const lower = () => K.cache('ff6_e8_lower2', W, 350, 1, (g) => {
      g.drawImage(water(), 0, HY - 2 - 370, W, H - HY + 4);
      g.drawImage(shore(), 0, HY - 46 - 370, W, 90);
      g.drawImage(bank(), 0, 300 - 370, W, 300);
    });
    // 远处的飞絮：成片时只是一层淡淡的白雾
    const haze = () => K.cache('ff6_e8_haze', 700, 150, 0.5, (g) => {
      const r = A.rng(8931);
      const b = blurred(700, 150, 7, (q) => {
        for (let i = 0; i < 70; i++) {
          const x = 30 + r() * 640, wx = x + 720, y = bankY(Math.min(1290, wx)) - 330 - 8 - r() * (10 + 40 * dd(wx));
          q.fillStyle = rgba('#f2eee6', 0.05 + r() * 0.07);
          q.beginPath(); q.ellipse(x, y, 25 + r() * 60, 3 + r() * 6, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, b, 0, 0, 700, 150);
    });

    // ---- 芦穗按受光程度预先调好 12 档颜色（每根每帧只画一张） ----
    const PLV = 12;
    const plumeLv = (v, lv) => K.cache('ff6_e8_plv' + v + '_' + lv, 120, 48, 1.25, (g) => {
      g.drawImage(plumeTex(v, false), 0, 0, 120, 48);
      if (lv > 0) { g.globalAlpha = lv / (PLV - 1); g.drawImage(plumeTex(v, true), 0, 0, 120, 48); }
    });

    // ---- 前景芦苇数据（常量，按种子生成） ----
    const reeds = (() => {
      const r = A.rng(8801), out = [];
      const add = (bx, tipY, w, kind) => {
        const lv = [], nl = kind === 1 ? 2 + ((r() * 2) | 0) : kind === 0 ? 1 + ((r() * 3) | 0) : 2 + ((r() * 3) | 0);
        const wb = kind === 2 ? 11 + r() * 3 : kind === 0 ? 8 + r() * 3 : 6 + r() * 3;
        for (let k = 0; k < nl; k++) lv.push({ u: 0.12 + ((k + r() * 0.8) / nl) * 0.62, len: (55 + r() * 60) * (kind === 2 ? 1.5 : kind === 0 ? 1.15 : 1), side: r() < 0.85 ? 1 : -1, dr: r(), ph: r() * TAU, w: wb * (0.8 + 0.3 * r()) });
        out.push({ bx, by: 770, tipY, w, kind, lean0: 0.05 + r() * 0.025, f1: 0.3 + r() * 0.22, f2: 0.7 + r() * 0.35, p1: bx * 0.005 + r() * 0.6, p2: r() * TAU, plume: kind !== 2 && r() < 0.9, pv: (r() * 6) | 0, lv, shade: r() });
      };
      for (let i = 0; i < 14; i++) add(1100 + i * 14 + r() * 10, 205 + r() * 175, 2.4 + r() * 1.5, 0);    // 右侧一丛
      for (let x = 392; x < 1110; x += 25 + r() * 27) {                                                 // 底部一排
        if (x > 880 && x < 1050 && r() < 0.65) continue;
        add(x, (r() < 0.25 ? 470 : 560) + r() * 120, 1.7 + r() * 1.3, 1);
      }
      for (let i = 0; i < 5; i++) add(1020 + i * 55 + r() * 30, 600 + r() * 60, 4.5 + r() * 2, 2);     // 最近处几根粗苇（无穗）
      return out.sort((a, b) => (a.kind === 2) - (b.kind === 2) || b.tipY - a.tipY);
    })();
    // ---- 芦花（蓬松的穗）贴图：沿穗轴顺风流动的细绒 ----
    const plumeTex = (v, lit) => K.cache('ff6_e8_plume' + v + (lit ? 'L' : ''), 120, 48, 2, (g) => {
      const r = A.rng(8700 + v * 13);
      const len = 62 + v * 5, droop = 10 + v * 2.5;
      const ax = (u) => 8 + u * len, ay = (u) => 20 + droop * u * u;
      const b = blurred(120, 48, 0.35, (q) => {
        for (let i = 0; i < 300; i++) {
          const u = Math.pow(r(), 0.9) * 0.95, env = Math.sin(Math.PI * Math.min(1, 0.12 + u * 0.95)) * (1 - 0.3 * u);
          const x = ax(u), y = ay(u), side = r() < 0.5 ? -1 : 1;
          const base = Math.atan2(2 * droop * u, len);
          const ang = base + side * (0.15 + r() * 0.75);
          const hl = (5 + r() * 13) * env;
          const ex = x + Math.cos(ang) * hl, ey = y + Math.sin(ang) * hl + hl * 0.12;
          const top = side < 0;
          const col = lit ? (top ? rgba('#ffc890', 0.45 + r() * 0.4) : rgba('#d4603a', 0.3 + r() * 0.3))
            : rgba(top ? '#cdc6b9' : '#8a8378', 0.2 + r() * 0.3);
          q.strokeStyle = col; q.lineWidth = 0.5 + r() * 0.55;
          q.beginPath(); q.moveTo(x, y); q.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - side * 1.2, ex, ey); q.stroke();
        }
        q.strokeStyle = lit ? rgba('#7a2a18', 0.7) : rgba('#5a5249', 0.7); q.lineWidth = 1;
        q.beginPath(); q.moveTo(ax(0), ay(0));
        for (let i = 1; i <= 10; i++) q.lineTo(ax(i / 10 * 0.8), ay(i / 10 * 0.8));
        q.stroke();
      });
      putBlur(g, b, 0, 0, 120, 48);
    });

    // 底部苇丛的密实根部：静态贴图，整体轻微剪切摆动
    const bed = () => K.cache('ff6_e8_bed', 940, 150, 1, (g) => {
      const r = A.rng(8850);
      // 贴图 x = 画面 x - 350；贴图底边 = 画面 y 740
      for (let i = 0; i < 520; i++) {
        const x = r() * 940, k = clamp((x - 10) / 160);       // 左端渐稀
        if (r() > k) continue;
        const hh = (40 + r() * 80) * (0.5 + 0.5 * k), lean = 0.25 + r() * 0.5;
        const bx = x, by = 150 + r() * 6, w = 2 + r() * 3.5;
        const ex = bx + hh * lean, ey = by - hh * (0.75 + r() * 0.2);
        const mx = bx + hh * lean * 0.15, my = by - hh * 0.65;
        g.fillStyle = mix('#1d130e', '#3a2a22', r() * 0.8);
        blade(g, [[bx, by], [lerp(bx, mx, 0.5), lerp(by, my, 0.5)], [mx, my], [lerp(mx, ex, 0.5), lerp(my, ey, 0.5) - 3], [ex, ey + 4]], (v) => w * Math.pow(1 - v, 0.8));
        g.fill();
      }
    });

    // 苇秆中线：弯曲集中在上部（偏移随高度平方增长）
    const stemXY = (rd, L, lean, v) => [rd.bx + L * lean * v * v, rd.by - L * v * (1 - 0.45 * lean * lean * v * v)];
    function drawReeds(g, t, gust, lit, redK, BT) {
      const plv = Math.round(clamp(0.45 * lit) * (PLV - 1));       // 近处只受云缝天光，与飞絮同一档
      // 同色的叶与秆合成一条路径一次填充（3 档深浅 + 最近处一档）
      const cols = [0, 0.5, 1].map((sh) => mix(mix('#2a1c16', '#3b2e28', sh * 0.7), '#3e1810', redK * 0.55)).concat([mix('#1c120e', '#2a0e0a', redK * 0.6)]);
      const paths = cols.map(() => new Path2D()), rim = new Path2D(), tips = [];
      for (const rd of reeds) {
        const L = rd.by - rd.tipY;
        const sway = (0.012 + 0.03 * gust) * (0.7 * Math.sin(TAU * rd.f1 * t + rd.p1) + 0.3 * Math.sin(TAU * rd.f2 * t + rd.p2));
        const lean = rd.lean0 + 0.16 * gust + sway;            // 梢头偏移（占秆长）
        const near = rd.kind === 2, pth = paths[near ? 3 : Math.round(rd.shade * 2)];
        // 叶：扁平的叶片，先斜向上伸出，再顺风（向右）弯下；背风一侧的叶也被吹向右边
        for (const lf of rd.lv) {
          const [px, py] = stemXY(rd, L, lean, lf.u);
          const fl = 0.035 * Math.sin(TAU * (0.55 + 0.35 * lf.dr) * t + lf.ph) * (0.4 + gust), len = lf.len;
          const c1x = px + len * (lf.side > 0 ? 0.3 + 0.12 * gust : 0.02 + 0.16 * gust), c1y = py - len * (lf.side > 0 ? 0.5 - 0.15 * gust : 0.6 - 0.15 * gust);
          const ex = px + len * (0.6 + 0.25 * gust + fl + (lf.side > 0 ? 0.12 : -0.1)), ey = py + len * (0.06 + 0.3 * lf.dr - 0.16 * gust + fl * 0.5);
          const pts = [];
          for (let i = 0; i <= 6; i++) { const v = i / 6, m = 1 - v; pts.push([m * m * px + 2 * m * v * c1x + v * v * ex, m * m * py + 2 * m * v * c1y + v * v * ey]); }
          blade(pth, pts, (v) => lf.w * (0.55 + 0.45 * Math.min(1, v * 4)) * Math.pow(1 - v, 0.9), true);
        }
        // 秆：由粗到细（1.0→0.35），弯曲集中在上部
        const sp = [];
        for (let i = 0; i <= 8; i++) sp.push(stemXY(rd, L, lean, i / 8));
        blade(pth, sp, (v) => rd.w * (1 - 0.65 * v), true);
        // 雨后湿秆：迎光一侧（右上）细亮线
        if (!near) for (let i = 1; i <= 8; i++) { const p = sp[i], o = rd.w * (1 - 0.65 * (i / 8)) * 0.42; i > 1 ? rim.lineTo(p[0] + o, p[1]) : rim.moveTo(p[0] + o, p[1]); }
        if (rd.plume) tips.push([rd, sp[8], 2 * L * lean, -L]);
      }
      for (let k = 0; k < 3; k++) { g.fillStyle = cols[k]; g.fill(paths[k]); }
      if (lit > 0.02) { g.strokeStyle = rgba('#ff9d5e', 0.6 * 0.45 * lit); g.lineWidth = 0.8; g.stroke(rim); }
      const M = g.getTransform();
      for (const [rd, tip, tx, ty] of tips) {
        const ang = Math.atan2(ty, tx) + 1.85 - 0.25 * gust + 0.7 * (rd.shade - 0.5) + 0.04 * Math.sin(TAU * rd.f1 * t + rd.p1 + 0.8);
        // 絮被吹走多少，穗就瘦多少（短 0.5·S、细 S，S = 15–25%）
        let sh = 0;
        if (BT && rd.tufts.length) { for (const f of rd.tufts) sh += smooth((t - BT[f.batch] - f.off) / 0.4); sh = sh / rd.tufts.length * rd.shr; }
        const sc = (rd.kind === 0 ? 0.95 : 0.62) * (0.8 + 0.35 * rd.shade), sx = sc * (1 + 0.35 * gust) * (1 - 0.5 * sh), sy = sc * (1 - 0.25 * gust) * (1 - sh);
        const ca = Math.cos(ang), sa = Math.sin(ang), la = ca * sx, lb = sa * sx, lc = -sa * sy, ld = ca * sy, x = tip[0], y = tip[1];
        g.setTransform(M.a * la + M.c * lb, M.b * la + M.d * lb, M.a * lc + M.c * ld, M.b * lc + M.d * ld, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
        blitBB(g, plumeLv(rd.pv, plv), -8, -20);
      }
      g.setTransform(M);
      g.fillStyle = cols[3]; g.fill(paths[3]);
    }

    // ---- 芦花飞絮：软芯带 5–9 根细丝，顺着运动方向拉长、慢慢转 ----
    // soft：无芯的版本（只留柔光与细丝），成团的絮用它，免得一团里亮出一颗颗硬点
    const tuftTex = (v, warm, soft) => K.cache('ff6_e8_tuft' + v + (warm ? 'W' : '') + (soft ? 'S' : ''), 40, 24, 2, (g) => {
      const r = A.rng(8960 + v * 17), cx = 25, cy = 12;
      // 一团极细的绒丝：小而淡的芯，丝向后（运动方向为 +x）散开成羽状
      g.save(); g.translate(cx - 5, cy); g.scale(2.2, 1);
      const hz = g.createRadialGradient(0, 0, 0, 0, 0, 5);
      hz.addColorStop(0, rgba(warm ? '#ffcfa0' : '#f2eee6', 0.42)); hz.addColorStop(1, rgba(warm ? '#ffb07a' : '#ece6da', 0));
      g.fillStyle = hz; g.fillRect(-6, -6, 12, 12); g.restore();
      if (!soft) {
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 2.4);
        gr.addColorStop(0, rgba(warm ? '#ffe0b8' : '#faf7f0', 0.9)); gr.addColorStop(1, rgba(warm ? '#ffb47c' : '#efe9de', 0));
        g.fillStyle = gr; g.fillRect(cx - 3, cy - 3, 6, 6);
      }
      const n = 12 + ((r() * 5) | 0);
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (r() - 0.5) * 1.6, l = 5 + r() * 11;
        const ex = cx + Math.cos(a) * l, ey = cy + Math.sin(a) * l * 0.85, mx = (cx + ex) / 2, my = (cy + ey) / 2 + (r() - 0.5) * 2;
        g.strokeStyle = rgba(warm ? '#ffe4c4' : '#f6f2ea', 0.18 + r() * 0.26); g.lineWidth = 0.3 + r() * 0.3;
        g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
      }
      if (warm) { const hg = g.createRadialGradient(cx - 3, cy, 0, cx - 3, cy, 10); hg.addColorStop(0, 'rgba(255,170,110,0.26)'); hg.addColorStop(1, 'rgba(255,150,90,0)'); g.fillStyle = hg; g.fillRect(cx - 14, cy - 11, 24, 22); }
    });
    const FLV = 12;
    const tuftLv = (v, lv, soft) => K.cache('ff6_e8_tlv' + v + '_' + lv + (soft ? 'S' : ''), 40, 24, 1.5, (g) => {
      g.drawImage(tuftTex(v, false, soft), 0, 0, 40, 24);
      if (lv > 0) { g.globalAlpha = lv / (FLV - 1); g.drawImage(tuftTex(v, true, soft), 0, 0, 40, 24); }
    });
    // 近镜头的絮：在景深外，建缓存时整体模糊（贴图四周留 4 px 给模糊）
    const tuftBlurLv = (v, lv) => K.cache('ff6_e8_tbl' + v + '_' + lv, 48, 32, 1.5, (g) => {
      const S = ((XYT.sprites && XYT.sprites.S) || 1) * 1.5;
      g.filter = `blur(${(1.1 * S).toFixed(2)}px)`;
      g.drawImage(tuftLv(v, lv), 4, 4, 40, 24); g.drawImage(tuftLv(v, lv), 4, 4, 40, 24);   // 叠两遍：糊开后仍是一团亮白，而不是灰斑
    });
    // 一小团絮（7–11 根挤成一朵棉絮，被吹散前的样子）：一层柔和的底，上面是无芯的绒，细丝都拖在背风的左边
    const clumpLv = (v, lv) => K.cache('ff6_e8_clump2_' + v + '_' + lv, 72, 40, 1.5, (g) => {
      const r = A.rng(8990 + v * 31), n = 7 + ((r() * 5) | 0);
      g.save(); g.translate(40, 20); g.scale(12, 5);
      const bg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      bg.addColorStop(0, rgba(SPECK[lv], 0.35)); bg.addColorStop(0.55, rgba(SPECK[lv], 0.18)); bg.addColorStop(1, rgba(SPECK[lv], 0));
      g.fillStyle = bg; g.fillRect(-1, -1, 2, 2); g.restore();
      for (let i = 0; i < n; i++) {
        const x = 40 + (r() - 0.5) * 24, y = 20 + (r() - 0.5) * 10, sc = 0.4 + 0.28 * r();
        g.save(); g.translate(x, y); g.rotate((r() - 0.5) * 0.5); g.scale(sc * 1.2, sc); g.globalAlpha = 0.6 + 0.3 * r();
        g.drawImage(tuftLv((i + v) % 4, lv, true), -26, -12, 40, 24); g.restore();
      }
      // 背风一侧拖出的长丝，让整朵絮有一条毛茸茸的尾边
      const fc = SPECK[lv];
      for (let i = 0; i < 9; i++) {
        const sx = 32 + r() * 10, sy = 20 + (r() - 0.5) * 7, l = 9 + r() * 13, ey = sy + (r() - 0.5) * 9;
        g.strokeStyle = rgba(fc, 0.14 + 0.18 * r()); g.lineWidth = 0.3 + 0.25 * r();
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx - l * 0.5, (sy + ey) / 2 + (r() - 0.5) * 3, sx - l, ey); g.stroke();
      }
    });
    // ---- 飞絮：远岸一层；苇梢一层（多半从看得见的穗上被吹起）；近处一层（含几团大絮从画外掠过） ----
    // 按拍成批放出：第一批在第8字，之后每个拍点一批，密度在第9–11字最高
    const BW = [0.34, 0.38, 0.17, 0.11];
    const plumed = reeds.filter((d) => d.plume);
    // 穗的位置与朝向（风约 0.8 时），飞絮从穗上 20–90% 处脱出
    const plumeGeo = (rd, gust) => {
      const L = rd.by - rd.tipY, lean = rd.lean0 + 0.16 * gust, tip = stemXY(rd, L, lean, 1);
      const ang = Math.atan2(-L, 2 * L * lean) + 1.85 - 0.25 * gust + 0.7 * (rd.shade - 0.5);
      const sc = (rd.kind === 0 ? 0.95 : 0.62) * (0.8 + 0.35 * rd.shade);
      return { tip, ang, sx: sc * (1 + 0.35 * gust), sy: sc * (1 - 0.25 * gust), len: 62 + rd.pv * 5, droop: 10 + rd.pv * 2.5 };
    };
    const fluff = (() => {
      const r = A.rng(8902), out = [];
      const pickB = () => { let x = r(), k = 0; while (k < 3 && x > BW[k]) { x -= BW[k]; k++; } return k; };
      const order = plumed.map((d, i) => [h2(i, 8911), d]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
      const orderLow = order.filter((d) => d.kind === 1 && d.tipY < 620);   // 底部一排里较高的穗（被托起的絮从这里起飞，才来得及升进天空）
      let pk = 0, pl = 0;
      for (const rd of plumed) { rd.tufts = []; rd.shr = 0.15 + 0.1 * rd.shade; }
      const fromPlume = (f, low) => {
        const rd = low ? orderLow[pl++ % orderLow.length] : order[pk++ % order.length], G = plumeGeo(rd, 0.8), u = 0.2 + 0.7 * r();
        const lx = u * G.len * G.sx, ly = G.droop * u * u * G.sy, ca = Math.cos(G.ang), sa = Math.sin(G.ang);
        f.x0 = G.tip[0] + ca * lx - sa * ly; f.y0 = G.tip[1] + sa * lx + ca * ly; f.src = rd; rd.tufts.push(f);
      };
      const mk = (L, size) => ({
        L, size, kind: 0, x0: 0, y0: 0, batch: pickB(), off: 0.55 * Math.pow(r(), 1.4), v: (r() * 4) | 0, src: null,
        V: (L === 1 ? 135 : 230) * (0.75 + r() * 0.5), up: (L === 1 ? 50 : 70) * (0.5 + r()),
        sink: (L === 1 ? 12 : 20) * (0.5 + r()), sw: (L === 1 ? 5 : 9) * (0.5 + r()), f: 0.35 + r() * 0.5, ph: r() * TAU,
        a: (L === 1 ? 0.85 : 0.8) * (0.75 + r() * 0.25), turn: (r() - 0.5) * 1.2, tph: r() * TAU,
      });
      // 远岸
      for (let i = 0; i < 70; i++) {
        const x0 = 760 + r() * 530, dk = dd(x0);
        out.push({
          L: 0, kind: 0, x0, y0: bankY(x0) - 4 - r() * (4 + 46 * dk), batch: pickB(), off: 0.6 * r(), v: (r() * 4) | 0, src: null,
          V: (12 + 55 * dk) * (0.75 + r() * 0.5), up: (3 + 16 * dk) * (0.5 + r()), sink: (1 + 4 * dk) * (0.5 + r()), sw: (0.6 + 1.6 * dk) * (0.5 + r()),
          f: 0.35 + r() * 0.5, ph: r() * TAU, size: (0.2 + 0.36 * dk) * (0.8 + r() * 0.4), a: (0.3 + 0.4 * dk) * (0.7 + r() * 0.3), turn: 0, tph: 0,
        });
      }
      // 苇梢一层：2/3 从穗上（其中八成被上升的风托起，斜着升进天空，其余贴着苇梢缓缓上飘），其余从左边画外随风进来、一路缓升
      for (let i = 0; i < 180; i++) {
        const f = mk(1, 0.45 + 0.5 * r());
        f.clump = r() < 0.7;
        if (r() < 0.66) {
          const lift = r() < 0.8;
          fromPlume(f, lift);
          if (lift) { f.Vy = 240 + 140 * r(); f.V = 150 + 100 * r(); } else f.Vy = 25 + 35 * r();
        } else { f.kind = 1; f.y0 = 330 + 370 * Math.pow(r(), 0.85); f.rr = (40 + 40 * r()) / 3.2; }
        out.push(f);
      }
      // 近处一层：镜头前的絮（在景深外、模糊、更快），从画面下方升起或从左边掠过——来自画外更近处的苇
      for (let i = 0; i < 32; i++) {
        const f = mk(2, 1.6 + 1.2 * r());
        f.blur = true; f.a *= 0.7; f.V = 280 + 140 * r();
        if (r() < 0.6) { f.kind = 2; f.x0 = 260 + 760 * r(); f.up = 350 + 400 * r(); }
        else { f.kind = 1; f.y0 = 400 + 300 * r(); f.rr = (40 + 40 * r()) / 3.2; }
        out.push(f);
      }
      for (const f of out) {
        f.m = 10 + (f.clump ? 58 : f.blur ? 46 : 34) * f.size;                       // 贴图半径（出画判断用）
        if (f.kind === 1) f.x0 = -f.m;                              // 从左边画外进来
        if (f.kind === 2) f.y0 = H + f.m;                           // 从画面下方升起
      }
      return out;
    })();
    function fluffPos(f, u) {
      let x, y;
      if (f.kind === 1) { x = f.x0 + f.V * u; y = f.y0 - f.rr * u; }                    // 随风横飘、匀速缓升
      else if (f.kind === 2) { x = f.x0 + f.V * u; y = f.y0 - f.up * (1 - Math.exp(-u / 1.3)) + f.sink * u * 0.3; }
      else if (f.Vy != null) {
        // 从穗上脱出：横向从静止加速到风速；上升气流先加速（0.2 s）再随高度减弱（1.5 s），轨迹先斜升、后渐平
        const Tx = 0.35;
        x = f.x0 + f.V * (u - Tx * (1 - Math.exp(-u / Tx)));
        y = f.y0 - f.Vy * (1.5 * (1 - Math.exp(-u / 1.5)) - 0.2 * (1 - Math.exp(-u / 0.2)));
      } else {
        const Tx = 0.55, Ty = 0.7;
        x = f.x0 + f.V * (u - Tx * (1 - Math.exp(-u / Tx)));
        y = f.y0 - f.up * Ty * 2.2 * (1 - Math.exp(-u / Ty)) + f.sink * (u - 0.8 * (1 - Math.exp(-u / 0.8))) * 0.6;
      }
      const sw = f.sw * Math.sin(TAU * f.f * u + f.ph) * (1 - Math.exp(-u / 0.6));
      return [x + sw * 0.3, y + sw];
    }
    // 各批的放出时刻：第一批在第8字，之后取其后的拍点
    function batchTimes(c, tWhite) {
      const st = c.t - c.lt, per = c.b.period || 0.836, out = [tWhite];
      if (c.grid && c.grid.time && c.b && c.b.i != null) {
        let i = c.b.i;
        while (i > 0 && c.grid.time(i) - st > tWhite + 0.3) i--;
        while (c.grid.time(i) - st <= tWhite + 0.3) i++;
        for (let k = 0; k < 3; k++) out.push(c.grid.time(i + k) - st);
      } else for (let k = 1; k < 4; k++) out.push(tWhite + 0.67 + (k - 1) * per);
      return out;
    }
    const SPECK = Array.from({ length: FLV }, (_, k) => mix('#f2eee6', '#ffc48c', k / (FLV - 1)));
    function drawFluff(g, c, BT, lit, gx) {
      const lt = c.lt;
      if (lt < BT[0] - 0.5) return;
      // 光束范围（从太阳虚位置看，夹在受光那段裂口两端之间；到地平线为止）
      const aL = Math.atan2(GY - SUNY, gx - 0.1 * HL - SUNX), aR = Math.atan2(GY - SUNY, gx + 0.85 * HL - SUNX);
      const amb = 0.45 * lit;                                      // 云缝的天光照到近处：与芦穗同一档
      const M = g.getTransform();
      for (const f of fluff) {
        const u = lt - (BT[f.batch] + f.off);
        if (u < 0) continue;
        const [x, y] = fluffPos(f, u), m = f.m;
        if (x > W + m || y < -m || y > H + m || x < -m) continue;
        const fadeIn = f.kind ? 1 : smooth(u / 0.4);
        const zoneK = 1 - 0.7 * smooth((360 - x) / 40);                         // 歌词区（左侧整列）里淡一些（连续过渡）
        const a = f.a * fadeIn * zoneK;
        if (a < 0.01) continue;
        let inRay = 0;
        if (lit > 0.01 && y > GY && y < HY + 12) {
          const ang = Math.atan2(y - SUNY, x - SUNX);
          inRay = smooth((ang - aR) / 0.05) * smooth((aL - ang) / 0.05) * (1 - smooth((y - HY) / 12)) * lit;
        }
        const tl = Math.max(inRay, amb), lv = Math.round(tl * (FLV - 1));
        if (f.L === 0 && inRay < 0.05) {
          // 远处的飞絮只是一点小白斑
          const r0 = 0.6 + 1.6 * f.size;
          g.globalAlpha = a * 0.8; g.fillStyle = SPECK[lv]; g.fillRect(x - r0, y - r0 * 0.45, r0 * 2, r0 * 0.9);
          continue;
        }
        g.globalAlpha = Math.min(1, a * (1 + 0.6 * inRay));
        if (f.blur) {
          // 镜头前的絮：模糊的大絮（在景深外，朝向看不出，不必旋转）
          const sx = f.size * 1.2, sy = f.size;
          g.setTransform(M.a * sx, M.b * sx, M.c * sy, M.d * sy, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
          blitBB(g, tuftBlurLv(f.v, lv), -30, -16);
        } else if (f.clump) {
          // 成团的絮随飞随散：越飞越松（放大）、略淡；顺风横飘，不必旋转
          const sp = 1 - Math.exp(-u / 1.6), k = f.size * (0.8 + 0.35 * sp);
          g.globalAlpha *= 1 - 0.25 * sp;
          g.setTransform(M.a * k * 1.2, M.b * k, M.c * k * 1.2, M.d * k, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
          blitBB(g, clumpLv(f.v, lv), -40, -20);
        } else {
          const sx = f.size * 1.2, sy = f.size;
          g.setTransform(M.a * sx, M.b * sx, M.c * sy, M.d * sy, M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f);
          blitBB(g, tuftLv(f.v, lv), -26, -12);
        }
      }
      g.setTransform(M);
      g.globalAlpha = 1;
    }
    // 染红：横向渐变预先画好，按强度用 multiply 叠上
    const STREAK = Array.from({ length: 16 }, (_, k) => mix('#c2532e', '#ffcf94', k / 15));
    const redTex = () => K.cache('ff6_e8_red', W, H, 1, (g) => {
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, mix('#ffffff', '#ffa890', 0.5)); gr.addColorStop(0.32, mix('#ffffff', '#ff8e6c', 0.8)); gr.addColorStop(1, mix('#ffffff', '#ff7c58', 0.95));
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    });

    XYT.registerShot('e8_reeds', {
      name: '芦花残阳', zone: 'left', night: false,
      text: '#f6efe4', shadow: 'rgba(22,18,20,0.88)', accent: '#f08a4a', bloom: 0.32,
      draw(g, c) {
        const lt = c.lt;
        const tO0 = CT(c, 0, 0.28), tO1 = CT(c, 6, 2.5), tWhite = CT(c, 7, 3.08), tTear = CT(c, 11, 4.94);
        const open1 = easeInOut(ramp(lt, tO0, tO1));
        const tear = easeOut(ramp(lt, tTear - 0.04, tTear + 0.8));
        const redK = smooth(ramp(lt, tTear + 0.1, CT(c, 12, 5.56)));   // 第13字时已全红，然后保持（出场的白雾之前看得清）
        const BT = batchTimes(c, tWhite);
        const gust = smooth(ramp(lt, tWhite - 0.4, tWhite + 0.7));
        const beat = c.be(0.32);
        const lit = tear;                                        // 拍点只让光晕与光束微微起伏
        const z = 1 + 0.04 * easeInOut(c.p);
        g.save();
        g.translate(820, 380); g.scale(z, z); g.translate(-820, -380);

        // 天空与云层
        const dDeck = DECK_V * lt, dScud = SCUD_V * lt;
        g.drawImage(skyDeck(), -180 + dDeck, -12, 1700, 440);
        const gx = GX + dDeck, gy = GY;
        const d = 50 * open1 + 15 * tear;                      // 开口：第1–7字裂到 50 px，第12字再撕开 30%
        if (open1 > 0.001) drawGap(g, gx, gy, d, clamp(open1 * 1.4), lit);
        g.drawImage(scud(), -220 + dScud, 286, 1700, 140);

        // 江面
        g.drawImage(lower(), 0, 370, W, 350);
        // 云缝在江面的倒影：以地平线为轴翻转，被风纹拉成竖向一列碎光（中心在亮段之下）
        if (open1 > 0.001) {
          const ry = 2 * HY - gy, amt = 0.5 * open1 * (1 - tear) + 1.0 * tear, cx = gx + 0.32 * HL, hw = 150 * open1 + 40 * tear;
          K.lighter(g, () => {
            const hwid = 80 + hw * 1.6;
            g.globalAlpha = 0.2 * amt * (1 - tear); g.drawImage(haloT('#7a2818'), cx - hwid / 2, ry - 70, hwid, 140);
            g.globalAlpha = 0.22 * amt * tear; g.drawImage(haloT('#e0703a'), cx - hwid / 2, ry - 70, hwid, 140);
            g.globalAlpha = 1;
          });
          for (let i = 0; i < 26; i++) {
            const v = (i + 0.5) / 26, yy = ry - 95 + v * 125 + 1.5 * Math.sin(lt * 1.1 + i * 1.9);
            const k = Math.exp(-Math.pow((yy - ry) / 48, 2));
            const ww = (14 + hw * 0.9 * k) * (0.35 + 0.65 * h2(i, 31)) * (0.75 + 0.25 * Math.sin(lt * (0.9 + h2(i, 33)) + i * 1.7));
            const xx = cx + (h2(i, 35) - 0.5) * hw * 0.7 * (1 - 0.5 * k) + 6 * Math.sin(lt * 0.7 + i * 2.3);
            g.fillStyle = tear > 0.02 ? STREAK[Math.round(k * tear * 15)] : '#9a3420';
            g.globalAlpha = (0.1 + 0.5 * k) * amt * (0.7 + 0.3 * Math.sin(lt * 1.6 + i));
            g.fillRect(xx - ww / 2, yy, ww, 1.2 + 1.8 * k);
          }
          g.globalAlpha = 1;
        }

        // 光束倾泻（止于地平线），以及光落在远处江面上的一条碎金
        if (tear > 0.001) {
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = clamp(tear * 0.9 * (0.88 + 0.12 * beat));
          blitBB(g, rays(), RX0 + dDeck, RY0);
          g.globalAlpha = 1;
          for (let i = 0; i < 46; i++) {
            const bm = BEAMS[i % BEAMS.length], x = lerp(bm.l0, bm.l1, h2(i, 91)) + dDeck + (h2(i, 92) - 0.5) * 30;
            if (x < 500 || x > 790) continue;
            const yv = h2(i, 93), y = HY + 1.5 + yv * 10, len = 2.5 + yv * 6 + h2(i, 94) * 4;
            const a = tear * bm.a * 1.5 * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(lt * (1.4 + 2 * h2(i, 95)) + i * 1.7)));
            g.fillStyle = rgba('#ffd8a8', Math.min(1, a)); g.fillRect(x - len / 2, y, len, 0.7 + yv * 0.5);
          }
          g.restore();
        }
        // 远处成片的飞絮：一层淡白的雾，随风右移
        if (gust > 0.01) { g.globalAlpha = 0.9 * gust; blitBB(g, haze(), 720 + 14 * Math.max(0, lt - tWhite + 0.4), 330); g.globalAlpha = 1; }

        // 苇丛根部（剪切摆动，顶部位移约 1–2 px）
        {
          const sh = 0.012 * Math.sin(TAU * 0.42 * lt + 0.6) + 0.006 * Math.sin(TAU * 0.9 * lt) + 0.02 * gust;
          g.save(); g.transform(1, 0, -sh, 1, sh * 740, 0);
          g.drawImage(bed(), 350, 590, 940, 150);
          g.restore();
        }
        drawReeds(g, lt, gust, lit, redK, BT);
        drawFluff(g, c, BT, lit, gx);
        g.restore();

        // 染红：红通道保留、青绿压低（左侧歌词区较轻，明度基本不变）
        if (redK > 0.001) {
          g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = redK;
          g.drawImage(redTex(), 0, 0, W, H);
          g.restore();
        }
      },
    });
  })();

  // ======================= f2 冰棱断 =======================
  (function () {
    // 近景仰角：檐口与阶沿石都略向右远去（灭点在画外右侧），越右越远越小
    const eaveY = (x) => 92 + (30 * (x - 300)) / 980;          // 滴水瓦尖（冰棱根）所在的线
    const slabY = (x) => 664 - (26 * (x - 300)) / 980;         // 阶沿石前缘
    const dep = (x) => 1.06 - (0.14 * (x - 300)) / 980;        // 近大远小
    const PXM = 280;                                           // 该纵深 1 m ≈ 280 px（冰棱最长约 1 m）
    const ice = (() => {
      const r = A.rng(2207), out = [];
      const base = [70, 40, 118, 56, 150, 84, 160, 280, 130, 66, 170, 46, 104, 60, 36, 80, 28, 50];
      let x = 338, k = 0;
      while (x < 1290) {
        const s = dep(x), L = base[k % base.length] * s * (0.94 + r() * 0.12);
        const ey = eaveY(x);
        out.push({ k, x, s, ey, L, w: (8 + 0.1 * L / s) * s, ph: r() * TAU, rip: (8 + r() * 6) * s, lean: (r() - 0.5) * 0.015, hit: slabY(x) + 14 * s, G: 9.8 * PXM * s });
        x += 62 * s; k++;
      }
      return out;
    })();
    const MAIN = 7, M = ice[MAIN];

    // ---- 背景：冬日晨空、远处雪院、阶沿石、左侧暗墙 ----
    const bg = () => K.cache('ff6_f2_bg', W, H, 1, (g) => {
      const r = A.rng(2211);
      g.fillStyle = '#e8eef3'; g.fillRect(0, 0, W, H);      // 不透明底，避免上一帧透出来
      const sk = g.createLinearGradient(0, 0, 0, 560);
      sk.addColorStop(0, '#7896b4'); sk.addColorStop(0.4, '#a3bcd3'); sk.addColorStop(0.8, '#d6e3ee'); sk.addColorStop(1, '#e6eef4');
      g.fillStyle = sk; g.fillRect(0, 0, W, 600);
      g.save(); g.translate(250, 430); g.scale(1, 0.8);
      const sun = g.createRadialGradient(0, 0, 0, 0, 0, 700);
      sun.addColorStop(0, 'rgba(255,244,222,0.95)'); sun.addColorStop(0.22, 'rgba(252,236,208,0.6)'); sun.addColorStop(0.55, 'rgba(236,228,214,0.2)'); sun.addColorStop(1, 'rgba(230,236,240,0)');
      g.fillStyle = sun; g.fillRect(-800, -800, 1600, 1600); g.restore();
      // 远景（在景深外，整体模糊）
      const far = blurred(W, 660, 3.4, (q) => {
        q.fillStyle = '#9db0c4';
        q.beginPath(); q.moveTo(300, 560);
        for (let x = 300; x <= W; x += 10) q.lineTo(x, 470 - 30 * A.noise1(x / 170, 3) - 14 * A.noise1(x / 55, 4));
        q.lineTo(W, 560); q.closePath(); q.fill();
        // 对面的厅堂：雪覆的屋面、飞檐、檐下暗影（给冰棱作深色衬底）
        const rx0 = 470, rx1 = 1190, ry = 352, re = 428;
        const eaveC = (x) => re - 16 * Math.pow(Math.abs((x - (rx0 + rx1) / 2) / ((rx1 - rx0) / 2)), 3);
        q.fillStyle = '#56626e';                               // 檐下与门窗（阴影，隔着冷空气偏淡）
        q.fillRect(rx0 + 30, re - 4, rx1 - rx0 - 60, 100);
        q.fillStyle = 'rgba(140,155,170,0.35)';
        for (let x = rx0 + 60; x < rx1 - 50; x += 46) q.fillRect(x, re + 6, 5, 90);
        q.fillStyle = 'rgba(110,124,140,0.5)';
        for (let x = rx0 + 70; x < rx1 - 60; x += 46) q.fillRect(x + 10, re + 20, 26, 60);
        q.fillStyle = '#48525d';                               // 瓦口暗边
        q.beginPath(); q.moveTo(rx0 - 20, eaveC(rx0) - 8);
        for (let x = rx0; x <= rx1; x += 8) q.lineTo(x, eaveC(x) - 2);
        q.lineTo(rx1 + 20, eaveC(rx1) - 8); q.lineTo(rx1 + 20, eaveC(rx1) + 6);
        for (let x = rx1; x >= rx0; x -= 8) q.lineTo(x, eaveC(x) + 8);
        q.closePath(); q.fill();
        const rg = q.createLinearGradient(0, ry, 0, re);           // 屋面积雪：上亮下略冷
        rg.addColorStop(0, '#f6f4ee'); rg.addColorStop(1, '#d2dde8');
        q.fillStyle = rg;
        q.beginPath(); q.moveTo(rx0 + 90, ry); q.lineTo(rx1 - 90, ry);
        for (let x = rx1 + 10; x >= rx0 - 10; x -= 8) q.lineTo(x, eaveC(x) - 3);
        q.closePath(); q.fill();
        q.fillStyle = '#66707a'; q.fillRect(rx0 + 86, ry - 7, rx1 - rx0 - 172, 8);   // 屋脊
        q.fillStyle = '#f3f2ec'; q.fillRect(rx0 + 86, ry - 10, rx1 - rx0 - 172, 4);
        // 枯树枝
        q.strokeStyle = 'rgba(96,108,124,0.7)'; q.lineCap = 'round';
        const tree = (x, y, len, ang, w, d) => {
          if (d > 6 || len < 6) return;
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.lineTo(ex, ey); q.stroke();
          tree(ex, ey, len * 0.72, ang - 0.32 - r() * 0.3, w * 0.7, d + 1);
          tree(ex, ey, len * 0.68, ang + 0.28 + r() * 0.3, w * 0.7, d + 1);
        };
        tree(1130, 540, 80, -1.62, 8, 0); tree(420, 548, 46, -1.5, 5, 0);
        // 院墙（墙头瓦与积雪）
        q.fillStyle = '#8796a7'; q.fillRect(300, 512, W - 300, 46);
        q.fillStyle = '#56616d'; q.fillRect(300, 504, W - 300, 10);
        q.fillStyle = '#f3f6f9';
        q.beginPath(); q.moveTo(300, 506);
        for (let x = 300; x <= W; x += 8) q.lineTo(x, 499 - 3 * A.noise1(x / 30, 8));
        q.lineTo(W, 507); q.lineTo(300, 507); q.closePath(); q.fill();
        // 院中雪地：受光偏暖，树影向右拖长
        const sn = q.createLinearGradient(300, 0, W, 0);
        sn.addColorStop(0, '#fcf6ea'); sn.addColorStop(1, '#e3ecf3');
        q.fillStyle = sn; q.fillRect(300, 556, W - 300, 110);
        q.fillStyle = 'rgba(120,150,185,0.3)'; q.fillRect(300, 556, W - 300, 6);
        for (const [tx, len] of [[1130, 260], [420, 160]]) {
          q.fillStyle = 'rgba(120,150,185,0.28)';
          q.beginPath(); q.moveTo(tx, 600); q.lineTo(tx + len, 604); q.lineTo(tx + len, 606); q.lineTo(tx, 604); q.closePath(); q.fill();
        }
        for (let i = 0; i < 14; i++) {
          const x = 320 + r() * 940, y = 570 + r() * 70;
          q.fillStyle = 'rgba(140,165,195,0.16)'; q.beginPath(); q.ellipse(x, y, 30 + r() * 60, 2 + r() * 3, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, far, 0, 0, W, 660);
      // 阶沿石（檐影里偏蓝；前缘一线亮棱）
      g.beginPath(); g.moveTo(0, slabY(0)); g.lineTo(W, slabY(W)); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      const sl = g.createLinearGradient(0, 640, 0, H);
      sl.addColorStop(0, '#8994a0'); sl.addColorStop(0.25, '#6b7784'); sl.addColorStop(1, '#46505b');
      g.fillStyle = sl; g.fill();
      g.save(); g.clip();
      for (let i = 0; i < 900; i++) {
        const x = r() * W, y = 630 + Math.pow(r(), 0.8) * 90;
        g.fillStyle = r() < 0.5 ? 'rgba(30,38,48,0.12)' : 'rgba(220,228,236,0.08)';
        g.fillRect(x, y, 1 + r() * 2, 1);
      }
      g.strokeStyle = 'rgba(30,36,44,0.35)'; g.lineWidth = 1.2;
      for (const sx of [560, 1040]) { g.beginPath(); g.moveTo(sx, slabY(sx) + 2); g.lineTo(sx - 30, H); g.stroke(); }
      // 低角度阳光从左斜照进檐下：右侧一片暖光，左侧被山墙挡住
      g.beginPath(); g.moveTo(360, 600); g.lineTo(W, 600); g.lineTo(W, H); g.lineTo(250, H); g.closePath(); g.clip();
      const lg = g.createLinearGradient(0, 630, 0, H);
      lg.addColorStop(0, 'rgba(255,226,180,0.3)'); lg.addColorStop(0.6, 'rgba(255,220,170,0.1)'); lg.addColorStop(1, 'rgba(255,220,170,0)');
      g.fillStyle = lg; g.fillRect(0, 600, W, 120);
      g.restore();
      g.strokeStyle = '#d2d8dd'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(0, slabY(0)); g.lineTo(W, slabY(W)); g.stroke();
      g.strokeStyle = 'rgba(40,48,58,0.28)'; g.lineWidth = 4;   // 檐下滴水冲出的一道浅槽
      g.beginPath(); g.moveTo(330, slabY(330) + 15); g.lineTo(W, slabY(W) + 13); g.stroke();
      // 左侧：山墙在阴影里（歌词区，暗而平稳）
      const wl = g.createLinearGradient(0, 0, 306, 0);
      wl.addColorStop(0, '#1a1f27'); wl.addColorStop(0.8, '#222932'); wl.addColorStop(1, '#29313b');
      g.fillStyle = wl; g.fillRect(0, 0, 306, H);
      g.strokeStyle = 'rgba(255,255,255,0.022)'; g.lineWidth = 1;
      for (let y = 30; y < H; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(262, y); g.stroke(); }
      const pc = g.createLinearGradient(258, 0, 318, 0);
      pc.addColorStop(0, '#2a2420'); pc.addColorStop(0.7, '#3a302a'); pc.addColorStop(1, '#2b2522');
      g.fillStyle = pc; g.fillRect(262, 0, 54, H);
      // 柱础：低矮的鼓形石墩，在檐影里偏暗，只有左上一抹柔光
      {
        const bx = 289, by = 706, rw = 46, rh = 8;
        const dg = g.createLinearGradient(bx - rw, 0, bx + rw, 0);
        dg.addColorStop(0, '#323944'); dg.addColorStop(0.35, '#2b313a'); dg.addColorStop(1, '#1d2229');
        g.fillStyle = dg;
        g.beginPath(); g.moveTo(bx - rw, by); g.bezierCurveTo(bx - rw - 3, by + 7, bx - rw - 2, H - 2, bx - rw + 2, H + 2);
        g.lineTo(bx + rw - 2, H + 2); g.bezierCurveTo(bx + rw + 2, H - 2, bx + rw + 3, by + 7, bx + rw, by); g.closePath(); g.fill();
        g.fillStyle = '#2f3640'; g.beginPath(); g.ellipse(bx, by, rw, rh, 0, 0, TAU); g.fill();
        const hl = g.createRadialGradient(bx - rw * 0.45, by - 1, 0, bx - rw * 0.45, by - 1, rw * 0.7);
        hl.addColorStop(0, 'rgba(150,165,182,0.22)'); hl.addColorStop(1, 'rgba(150,165,182,0)');
        g.fillStyle = hl; g.beginPath(); g.ellipse(bx, by, rw, rh, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(20,24,30,0.5)'; g.fillRect(bx - 27, by - rh - 1, 54, 2);   // 柱脚压在础上的一线暗影
      }
      g.fillStyle = 'rgba(170,195,220,0.32)'; g.fillRect(314, 0, 2, H);
    });

    // ---- 檐口：檐底椽子、檐枋、厚厚的雪檐、瓦当与滴水、冰脊 ----
    const eave = () => K.cache('ff6_f2_eave', W, 170, 1, (g) => {
      // 檐底：阴影里的椽子（随檐口线向右收）
      g.fillStyle = '#1f242c';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, eaveY(W) - 40); g.lineTo(0, eaveY(0) - 40); g.closePath(); g.fill();
      for (let x = -30; x < W + 40; x += 38 * dep(Math.max(300, x))) {
        const s = dep(Math.max(300, x)), y1 = eaveY(x) - 44;
        g.fillStyle = '#2a3039';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22 * s, 0); g.lineTo(x + 18 * s, y1); g.lineTo(x + 3 * s, y1); g.closePath(); g.fill();
        g.fillStyle = 'rgba(190,205,220,0.045)'; g.fillRect(x + 16 * s, 4, 2, y1 - 8);
        // 椽头（圆）
        g.fillStyle = '#3a3530'; g.beginPath(); g.ellipse(x + 10.5 * s, y1 - 2, 9 * s, 7 * s, 0, 0, TAU); g.fill();
      }
      // 檐枋
      g.fillStyle = '#2b2520';
      g.beginPath(); g.moveTo(0, eaveY(0) - 40); g.lineTo(W, eaveY(W) - 40); g.lineTo(W, eaveY(W) - 26); g.lineTo(0, eaveY(0) - 26); g.closePath(); g.fill();
      // 雪檐：厚而圆的一道，顶面受左侧低光照暖，下沿一团团鼓出、带冷蓝阴影
      const top = (x) => eaveY(x) - 40 * dep(Math.max(300, x)) - 6 * A.noise1(x / 46, 3) - 3 * A.noise1(x / 14, 4);
      const bot = (x) => eaveY(x) - 12 * dep(Math.max(300, x)) + 4 * Math.pow(A.noise1(x / 24, 5), 2);
      const snow = blurred(W, 170, 0.8, (q) => {
        q.beginPath(); q.moveTo(0, top(0));
        for (let x = 0; x <= W; x += 4) q.lineTo(x, top(x));
        for (let x = W; x >= 0; x -= 4) q.lineTo(x, bot(x));
        q.closePath();
        const sg = q.createLinearGradient(0, 40, 0, 112);
        sg.addColorStop(0, '#fffaf0'); sg.addColorStop(0.45, '#eef2f5'); sg.addColorStop(0.8, '#c3d2e0'); sg.addColorStop(1, '#93a9bf');
        q.fillStyle = sg; q.fill();
        // 下沿一团团鼓包：受光的左上半圈亮、右下半圈冷
        for (let x = 10; x < W; x += 30 + 34 * A.hash(Math.round(x))) {
          const s = dep(Math.max(300, x)), rr = (8 + 9 * A.hash(Math.round(x) + 3)) * s, cy = bot(x) - rr * 0.7, sq = 0.55 + 0.25 * A.hash(Math.round(x) + 7);
          q.save(); q.translate(x, cy); q.scale(1.6, sq);
          q.fillStyle = 'rgba(160,182,204,0.4)'; q.beginPath(); q.arc(1.2, 1.6, rr, 0, TAU); q.fill();
          q.fillStyle = 'rgba(232,239,245,0.9)'; q.beginPath(); q.arc(0, 0, rr * 0.94, 0, TAU); q.fill();
          q.fillStyle = 'rgba(255,247,232,0.6)'; q.beginPath(); q.arc(-rr * 0.3, -rr * 0.35, rr * 0.5, 0, TAU); q.fill();
          q.restore();
        }
        q.strokeStyle = 'rgba(255,234,200,0.95)'; q.lineWidth = 1.8;
        q.beginPath(); for (let x = 0; x <= W; x += 4) q.lineTo(x, top(x) + 1); q.stroke();
      });
      putBlur(g, snow, 0, 0, W, 170);
      // 瓦当与滴水（暗）
      g.fillStyle = '#272b33';
      g.beginPath(); g.moveTo(0, eaveY(0) - 14); for (let x = 0; x <= W; x += 10) g.lineTo(x, eaveY(x) - 14); g.lineTo(W, eaveY(W) - 7); g.lineTo(0, eaveY(0) - 7); g.closePath(); g.fill();
      const tiles = ice.map((ic) => ic.x);
      for (let k = -6; k < 0; k++) tiles.unshift(ice[0].x + k * 62 * 1.08);
      for (const x of tiles) {
        const s = dep(Math.max(300, x)), y = eaveY(x);
        g.fillStyle = '#272b33';
        g.beginPath(); g.arc(x - 31 * s, y - 8, 10 * s, 0, Math.PI); g.fill();
        g.beginPath(); g.moveTo(x - 17 * s, y - 10); g.quadraticCurveTo(x - 10 * s, y - 2, x, y + 2); g.quadraticCurveTo(x + 10 * s, y - 2, x + 17 * s, y - 10); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,226,186,0.32)';
        g.beginPath(); g.moveTo(x - 17 * s, y - 10); g.quadraticCurveTo(x - 10 * s, y - 2, x - 1, y + 1); g.lineTo(x - 3, y - 1); g.quadraticCurveTo(x - 11 * s, y - 4, x - 15 * s, y - 9); g.closePath(); g.fill();
      }
      // 瓦口间的细小冰溜（静态）
      for (let i = 0; i < ice.length - 1; i++) {
        const a = ice[i], b = ice[i + 1];
        for (let m = 0; m < 2; m++) {
          if (A.hash(i * 7 + m) < 0.45) continue;
          const x = lerp(a.x, b.x, 0.3 + 0.4 * A.hash(i * 3 + m + 11)), s = dep(x), y = eaveY(x) - 4, L = (8 + 22 * A.hash(i * 5 + m)) * s, w = (2.5 + 2 * A.hash(i + m * 9)) * s;
          const gr = g.createLinearGradient(x - w, 0, x + w, 0);
          gr.addColorStop(0, 'rgba(255,248,230,0.95)'); gr.addColorStop(0.5, 'rgba(170,195,220,0.6)'); gr.addColorStop(1, 'rgba(90,120,155,0.8)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.4, y + L * 0.6, x, y + L); g.quadraticCurveTo(x + w * 0.4, y + L * 0.6, x + w, y); g.closePath(); g.fill();
        }
      }
      // 冰脊：沿瓦口一条薄冰，连着各根冰棱
      const ib = blurred(W, 170, 0.6, (q) => {
        for (const ic of ice) {
          q.fillStyle = 'rgba(214,232,246,0.8)'; q.beginPath(); q.ellipse(ic.x, ic.ey - 1, ic.w * 0.8, 5 * ic.s, 0, 0, TAU); q.fill();
          q.fillStyle = 'rgba(255,252,240,0.95)'; q.beginPath(); q.ellipse(ic.x - ic.w * 0.38, ic.ey - 3, ic.w * 0.28, 1.6, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, ib, 0, 0, W, 170);
    });

    // ---- 冰棱贴图：透亮的冰，左缘受光，中间折射出背景的暗带，右侧冷蓝 ----
    // 冰棱半宽（s：从根到尖 0..1）
    const icRad = (ic, s) => (ic.w / 2) * Math.pow(1 - s, 0.82) * (1 + 0.06 * Math.sin((s * ic.L) / ic.rip + ic.ph) + 0.05 * Math.sin((s * ic.L) / (ic.rip * 2.7) + ic.ph * 2) + 0.18 * Math.exp(-s * 14)) + 0.35;
    // 化钝后的尖：在半径 1.6–2.5 px 处截住，接一个同半径的圆头（se 为截处的相对长度，rc 为圆头半径）
    const icEnd = (ic) => {
      if (ic.end) return ic.end;
      const r = (1.6 + 0.9 * A.hash(ic.k * 31 + 7)) * ic.s;
      let se = 1; while (se > 0.5 && icRad(ic, se) < r) se -= 0.002;
      return (ic.end = { se, rc: icRad(ic, se) });
    };
    // 冰棱外形路径；blunt 时尖端换成圆头
    const icPath = (g, ic, blunt) => {
      const cx = ic.w / 2 + 8, L = ic.L, rad = (s) => icRad(ic, s), se = blunt ? icEnd(ic).se : 1;
      g.beginPath(); g.moveTo(cx - rad(0), 0);
      for (let i = 1; i <= 40; i++) { const s = (i / 40) * se; g.lineTo(cx - rad(s) + ic.lean * s * L, s * L); }
      if (blunt) g.arc(cx + ic.lean * se * L, se * L, rad(se), Math.PI, 0, true);
      for (let i = 40; i >= 0; i--) { const s = (i / 40) * se; g.lineTo(cx + rad(s) + ic.lean * s * L, s * L); }
      g.closePath();
    };
    const icTex = (ic, blunt) => K.cache('ff6_f2_ic' + ic.k + (blunt ? 'B' : ''), ic.w + 16, ic.L + 14, 2, (g) => {
      const cx = ic.w / 2 + 8, L = ic.L, w = ic.w;
      const rad = (s) => icRad(ic, s), sMax = blunt ? icEnd(ic).se - (0.6 * icEnd(ic).rc) / L : 1;
      const path = () => icPath(g, ic, blunt);
      path();
      const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,250,236,0.97)'); gr.addColorStop(0.14, 'rgba(240,246,250,0.8)'); gr.addColorStop(0.32, 'rgba(150,175,200,0.6)');
      gr.addColorStop(0.5, 'rgba(110,140,170,0.62)'); gr.addColorStop(0.68, 'rgba(190,212,230,0.6)'); gr.addColorStop(0.88, 'rgba(120,150,182,0.7)'); gr.addColorStop(1, 'rgba(70,100,138,0.82)');
      g.fillStyle = gr; g.fill();
      g.save(); path(); g.clip();
      // 环纹：2–5 道，间距不等；仰视时环向上拱，贴着冰面弯
      {
        const nR = 2 + Math.floor(A.hash(ic.k * 13 + 1) * 4);
        for (let i = 0; i < nR; i++) {
          const s = 0.08 + 0.7 * (i + 0.2 + 0.6 * A.hash(ic.k * 17 + i * 5)) / nR, y = s * L, rr = rad(s), ax = cx + ic.lean * y;
          const a = 0.03 + 0.05 * A.hash(ic.k * 19 + i), sag = rr * (0.18 + 0.12 * A.hash(ic.k * 23 + i));
          g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 0.6 + 0.7 * A.hash(ic.k * 29 + i);
          g.beginPath(); g.moveTo(ax - rr, y + sag * 0.3); g.quadraticCurveTo(ax + rr * 0.1, y - sag * 1.6, ax + rr, y + sag * 0.2 + (A.hash(ic.k + i * 7) - 0.5)); g.stroke();
        }
      }
      // 亮芯与细气泡线
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = Math.max(1, w * 0.06);
      g.beginPath(); g.moveTo(cx - w * 0.2, 3); g.lineTo(cx - w * 0.06 + ic.lean * L, L * Math.min(0.9, sMax)); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(cx + w * 0.18, 4); g.lineTo(cx + w * 0.04 + ic.lean * L, L * Math.min(0.7, sMax)); g.stroke();
      g.restore();
      // 左缘高光（太阳在左）
      g.strokeStyle = 'rgba(255,246,222,1)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(cx - rad(0) + 1, 1);
      for (let i = 1; i <= 36; i++) { const s = Math.min(i / 40, sMax); g.lineTo(cx - rad(s) + 0.8 + ic.lean * s * L, s * L); }
      g.stroke();
      // 右缘冷色细边
      g.strokeStyle = 'rgba(60,90,128,0.6)'; g.lineWidth = 0.8;
      g.beginPath(); for (let i = 0; i <= 36; i++) { const s = Math.min(i / 40, sMax); g.lineTo(cx + rad(s) - 0.5 + ic.lean * s * L, s * L); } g.stroke();
    });
    // 原来的细尖减去圆头外形，只剩将化掉的那一截（与圆头版叠画：f = 0 时拼回原样，f = 1 时只剩圆头）
    const icNeedle = (ic) => K.cache('ff6_f2_icN' + ic.k, ic.w + 16, ic.L + 14, 2, (g) => {
      g.drawImage(icTex(ic), 0, 0, ic.w + 16, ic.L + 14);
      g.globalCompositeOperation = 'destination-out'; icPath(g, ic, true); g.fill();
    });
    // 画一根冰棱（顶边在 y0，竖向缩放 sc），尖端按 mb（0→1）由细尖化成圆头
    function drawIce(g, ic, x0, y0, sc, mb) {
      const tw = ic.w + 16, th = ic.L + 14;
      g.drawImage(icTex(ic, true), x0, y0, tw, th * sc);
      if (mb < 0.999) {
        const nt = icNeedle(ic), k = nt.width / tw, yc = Math.max(0, icEnd(ic).se * ic.L - 3);
        g.globalAlpha = 1 - mb;
        g.drawImage(nt, 0, yc * k, nt.width, (th - yc) * k, x0, y0 + yc * sc, tw, (th - yc) * sc);
        g.globalAlpha = 1;
      }
    }
    const dropTex = () => K.cache('ff6_f2_drop', 16, 20, 3, (g) => {
      g.fillStyle = 'rgba(214,232,246,0.88)';
      g.beginPath(); g.moveTo(8, 1); g.quadraticCurveTo(14, 11, 12, 14); g.arc(8, 14, 4.4, 0, Math.PI); g.quadraticCurveTo(2, 11, 8, 1); g.fill();
      g.fillStyle = 'rgba(70,100,130,0.5)'; g.beginPath(); g.arc(9.5, 15.5, 2.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.arc(6.2, 12.5, 1.4, 0, TAU); g.fill();
    });
    // 柔和的小闪光：亮芯加极淡的十字细芒（不做星形贴花）
    const glint = () => K.cache('ff6_f2_glint', 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,251,240,1)'); gr.addColorStop(0.12, 'rgba(255,246,226,0.7)'); gr.addColorStop(0.4, 'rgba(255,240,214,0.16)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const lh = g.createLinearGradient(4, 0, 60, 0);
      lh.addColorStop(0, 'rgba(255,250,236,0)'); lh.addColorStop(0.5, 'rgba(255,250,236,0.4)'); lh.addColorStop(1, 'rgba(255,250,236,0)');
      g.fillStyle = lh; g.fillRect(4, 31.4, 56, 1.2);
      const lv = g.createLinearGradient(0, 12, 0, 52);
      lv.addColorStop(0, 'rgba(255,250,236,0)'); lv.addColorStop(0.5, 'rgba(255,250,236,0.25)'); lv.addColorStop(1, 'rgba(255,250,236,0)');
      g.fillStyle = lv; g.fillRect(31.4, 12, 1.2, 40);
    });

    // ---- 滴水：第42句第1–4字各从一根冰棱尖滴下 ----
    const drips = (c) => [
      { k: 4, t: CT(c, 0, 0.246) }, { k: 10, t: CT(c, 1, 0.586) }, { k: 2, t: CT(c, 2, 0.986) }, { k: 6, t: CT(c, 3, 1.426) },
      { k: 12, t: CT(c, 9, 4.226) + 0.5 }, { k: 8, t: CT(c, 10, 4.676) + 0.7 },
    ];

    // ---- 最长那根：一条锯齿裂纹把它分成残根与坠落段 ----
    const GM = M.G, SM = M.s, HY0 = M.hit;
    const TOFF = M.ey - 1;                               // 冰棱贴图顶边的画面 y
    const CY = TOFF + 12;                                // 裂纹高度
    const axX = (y) => M.x + M.lean * (y - TOFF);        // 静止时轴线 x
    const LP = M.L - 12;                                 // 裂纹以下的长度（到尖）
    // 一条横过冰棱的锯齿线：2–5 px 一段、±2 px 起伏、略斜；两端各延出 6 px 作裁切用
    const jag = (s, seed, slant) => {
      const r = A.rng(seed), y0 = CY + s, hw = icRad(M, (12 + s) / M.L), xc = axX(y0), x0 = xc - hw, x1 = xc + hw, pts = [[x0, y0 - hw * slant]];
      let x = x0;
      while (x < x1 - 0.01) { x = Math.min(x1, x + 2 + r() * 3); pts.push([x, y0 + (x - xc) * slant + (x < x1 ? (r() - 0.5) * 4 : 0)]); }
      return pts;
    };
    const CRACK = jag(0, 2241, 0.1), S1 = 108, S2 = 172;
    const CUT1 = jag(S1, 2243, -0.12), CUT2 = jag(S2, 2247, 0.15);
    const crackAt = (f) => {
      const x = lerp(CRACK[0][0], CRACK[CRACK.length - 1][0], f);
      for (let i = 1; i < CRACK.length; i++) if (CRACK[i][0] >= x - 1e-6) { const a = CRACK[i - 1], b = CRACK[i], u = (x - a[0]) / Math.max(1e-6, b[0] - a[0]); return [x, lerp(a[1], b[1], u)]; }
      return CRACK[CRACK.length - 1];
    };
    function linePath(g, pts, f, dx, dy) {
      const xe = lerp(pts[0][0], pts[pts.length - 1][0], f);
      g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy);
      for (let i = 1; i < pts.length && pts[i][0] <= xe; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy);
      if (f < 1) { const e = crackAt(f); g.lineTo(e[0] + dx, e[1] + dy); }
    }
    // 两条短分叉：裂纹走过它们的根部后才长出来
    const BR = [[0.32, [[-1.2, 2.4], [-0.6, 5]]], [0.7, [[1.7, -1.6], [3.6, -2.4]]]];
    function drawCrack(g, f) {
      linePath(g, CRACK, f, 0.5, 1.3); g.strokeStyle = 'rgba(40,64,92,0.3)'; g.lineWidth = 0.9; g.lineJoin = 'miter'; g.stroke();
      linePath(g, CRACK, f, 0, 0); g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 0.75; g.stroke();
      for (const [bf, seg] of BR) {
        const k = clamp((f - bf) / 0.2); if (k <= 0) continue;
        const o = crackAt(bf), k1 = Math.min(1, k * 2), k2 = clamp(k * 2 - 1);
        g.beginPath(); g.moveTo(o[0], o[1]);
        g.lineTo(o[0] + seg[0][0] * k1, o[1] + seg[0][1] * k1);
        if (k2 > 0) g.lineTo(o[0] + lerp(seg[0][0], seg[1][0], k2), o[1] + lerp(seg[0][1], seg[1][1], k2));
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 0.6; g.stroke();
      }
    }
    // 裁切：上下两条锯齿线之间（bot 为 null 时一直到尖）
    function clipBetween(g, top, bot) {
      g.beginPath();
      g.moveTo(top[0][0] - 8, top[0][1]); for (const p of top) g.lineTo(p[0], p[1]); g.lineTo(top[top.length - 1][0] + 8, top[top.length - 1][1]);
      if (bot) { g.lineTo(bot[bot.length - 1][0] + 8, bot[bot.length - 1][1]); for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.lineTo(bot[0][0] - 8, bot[0][1]); }
      else { g.lineTo(M.x + 30, TOFF + M.L + 30); g.lineTo(M.x - 30, TOFF + M.L + 30); }
      g.closePath(); g.clip();
    }
    function clipAbove(g) {
      g.beginPath();
      g.moveTo(CRACK[0][0] - 8, TOFF - 30); g.lineTo(CRACK[CRACK.length - 1][0] + 8, TOFF - 30);
      g.lineTo(CRACK[CRACK.length - 1][0] + 8, CRACK[CRACK.length - 1][1]);
      for (let i = CRACK.length - 1; i >= 0; i--) g.lineTo(CRACK[i][0], CRACK[i][1]);
      g.lineTo(CRACK[0][0] - 8, CRACK[0][1]); g.closePath(); g.clip();
    }
    // 脆断：绕右端那丝冰偏 4°（重心在铰点左下，所以尖端向右摆）、下坠 3 px；脱落后继续慢转、自由落体
    const PIV = { x: CRACK[CRACK.length - 1][0] - 1.2, y: CRACK[CRACK.length - 1][1] };
    const ROT0 = (-4 * Math.PI) / 180, SPIN = -0.42;
    const AX = (s) => [axX(CY + s), CY + s];
    // 坠落段上一点（局部 p）在脱落后 u 秒的画面位置
    const fallPt = (p, u) => {
      const th = ROT0 + SPIN * u, dx = p[0] - PIV.x, dy = p[1] - PIV.y;
      return [PIV.x + dx * Math.cos(th) - dy * Math.sin(th), PIV.y + 3 + 0.5 * GM * u * u + dx * Math.sin(th) + dy * Math.cos(th)];
    };
    const solveHit = (p) => { let a = 0, b = 2; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (fallPt(p, m)[1] < HY0) a = m; else b = m; } return (a + b) / 2; };
    const fallT = solveHit(AX(LP));                      // 尖端落到石面所需时间（约 0.46 s）
    const HITX = fallPt(AX(LP), fallT)[0];
    // 两块像短棍一样的大冰段：中段（约 64 px）、根段（约 108 px）；各在下端触地时脱离，低弹、翻倒、平躺、滑行后停下
    const chunks = [
      { sa: S1, sb: S2, top: CUT1, bot: CUT2, e: 0.22, vx: 150, vz: 48, phE: Math.PI / 2 - 0.12 },     // 中段被弹向右前方，顺时针翻倒
      { sa: 0, sb: S1, top: CRACK, bot: CUT1, pin: true, w0: -2.6, vb: 14, vx: -70, vz: 10, phE: -Math.PI / 2 - 0.05 },  // 根段下端着地、顺着倾斜向左翻倒
    ].map((ch) => {
      const uAbs = solveHit(AX(ch.sb)), u = uAbs - fallT;            // 相对落地时刻
      const sm = (ch.sa + ch.sb) / 2, c0 = fallPt(AX(sm), uAbs), th0 = ROT0 + SPIN * uAbs;
      const r = icRad(M, (12 + sm) / M.L) * 0.85, v = GM * uAbs, vy = -ch.e * v;
      let tL = (-vy + Math.sqrt(vy * vy + 2 * GM * Math.max(1, HY0 - r - c0[1]))) / GM;
      if (ch.pin) {
        // 绕着地的下端翻倒：初角速度来自撞击，重力力矩让它越倒越快
        ch.p0 = fallPt(AX(ch.sb), uAbs); ch.al = -1.2 * GM / (ch.sb - ch.sa);
        const dphi = Math.abs(ch.phE - th0), w = Math.abs(ch.w0), al = Math.abs(ch.al);
        tL = (-w + Math.sqrt(w * w + 2 * al * dphi)) / al;
      }
      const ts = Math.max(0.08, 4.45 - 3.886 - u - tL);             // 滑行到第11字前停下
      return Object.assign(ch, { u, sm, c0, th0, r, vy, tL, ts, len: ch.sb - ch.sa });
    });
    const chunkAt = (ch, tau) => {
      if (ch.pin) {
        const hl = (ch.sb - ch.sa) / 2, tt = Math.min(tau, ch.tL);
        const ph = tau < ch.tL ? ch.th0 + ch.w0 * tt + 0.5 * ch.al * tt * tt : ch.phE;
        const ts2 = Math.min(Math.max(0, tau - ch.tL), ch.ts), f = ts2 - (ts2 * ts2) / (2 * ch.ts);
        const px = ch.p0[0] + ch.vb * tt + ch.vx * f, yg = HY0 + ch.vz * (tt / ch.tL) * 0.6 + ch.vz * f;
        const lift = ch.r * Math.abs(Math.sin(ph));
        return { x: px + hl * Math.sin(ph), y: yg - hl * Math.cos(ph) - lift, yg, ph, h: Math.max(0, hl * Math.cos(ph) * 0.3) };
      }
      if (tau < ch.tL) {
        const h = (HY0 - ch.r - ch.c0[1]) - ch.vy * tau - 0.5 * GM * tau * tau;     // 中心离地高度（含半径）
        const yg = HY0 + ch.vz * tau;
        return { x: ch.c0[0] + ch.vx * tau, y: yg - ch.r - h, yg, ph: lerp(ch.th0, ch.phE, tau / ch.tL), h };
      }
      const tt = Math.min(tau - ch.tL, ch.ts), f = tt - (tt * tt) / (2 * ch.ts);
      const yg = HY0 + ch.vz * (ch.tL + f);
      return { x: ch.c0[0] + ch.vx * (ch.tL + f), y: yg - ch.r, yg, ph: ch.phE, h: 0 };
    };
    // 细碎冰碴：5–7 个角、透明，左侧受光右侧偏蓝；只有它们落地后压扁
    const chips = (() => {
      const r = A.rng(2231), out = [];
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1, n = 5 + ((r() * 3) | 0), sz = (2.6 + r() * 4.2) * SM, pts = [];
        for (let k = 0; k < n; k++) { const a = (k / n) * TAU + (r() - 0.5) * 0.7, rr = sz * (0.55 + r() * 0.5); pts.push([Math.cos(a) * rr * 1.25, Math.sin(a) * rr]); }
        const ch = { d: r() * 0.09, vx: side * (50 + r() * 230), vy: -(130 + r() * 300), vz: (r() - 0.35) * 70, spin: (r() - 0.5) * 18, a0: r() * TAU, pts, sz, e: 0.24 + r() * 0.1, mu: 620 + r() * 300, x0: (r() - 0.5) * 10 };
        // 保证第11字前全部落定
        for (let k = 0; k < 20 && ch.d + chipRest(ch) > 0.56; k++) { ch.vy *= 0.92; ch.vx *= 0.9; ch.vz *= 0.9; }
        out.push(ch);
      }
      return out;
    })();
    function chipRest(s) {
      let T = 0, vx = s.vx, vz = s.vz;
      for (let b = 0; b < 3; b++) { T += (-2 * s.vy * Math.pow(s.e, b)) / GM; vx *= 0.6; vz *= 0.6; }
      return T + Math.hypot(vx, vz) / s.mu;
    }
    function chipAt(s, u) {
      let t = u, x = s.x0, z = 0, vx = s.vx, vz = s.vz, ang = s.a0, spin = s.spin;
      for (let b = 0; b < 3; b++) {
        const vy = s.vy * Math.pow(s.e, b);
        const tf = (-2 * vy) / GM;
        if (t < tf) { const h = -(vy * t + 0.5 * GM * t * t); return { x: x + vx * t, z: z + vz * t, h, ang: ang + spin * t }; }
        x += vx * tf; z += vz * tf; ang += spin * tf; t -= tf;
        vx *= 0.6; vz *= 0.6; spin *= 0.45;
      }
      const sp = Math.hypot(vx, vz), ts = sp / s.mu, tt = Math.min(t, ts);
      const f = sp > 0 ? tt - (0.5 * s.mu * tt * tt) / sp : 0;
      return { x: x + vx * f, z: z + vz * f, h: 0, ang: ang + spin * (tt - (tt * tt) / (2 * ts + 1e-6)) };
    }
    const tipPos = (ic, sc, mb) => { const e = icEnd(ic), tl = lerp(ic.L, e.se * ic.L + e.rc, mb); return [ic.x + ic.lean * tl * sc, ic.ey - 1 + tl * sc]; };

    // 大冰段：按当前朝向重新打光（亮面始终朝向左上方的低角度阳光），刚脱离时与贴图交叉淡变
    function drawChunk(g, ch, p, k0, tex, tx0, tw, th) {
      const a = AX(ch.sm);
      g.save(); g.translate(p.x, p.y); g.rotate(p.ph); g.translate(-a[0], -a[1]);
      g.save(); clipBetween(g, ch.top, ch.bot);
      const y0 = CY + ch.sa - 6, y1 = CY + ch.sb + 6;
      g.beginPath();
      for (let i = 0; i <= 14; i++) { const y = lerp(y0, y1, i / 14); g.lineTo(axX(y) - icRad(M, clamp((y - TOFF) / M.L)), y); }
      for (let i = 14; i >= 0; i--) { const y = lerp(y0, y1, i / 14); g.lineTo(axX(y) + icRad(M, clamp((y - TOFF) / M.L)), y); }
      g.closePath();
      const dl = 0.9 * Math.cos(p.ph) + 0.45 * Math.sin(p.ph), kL = smooth((dl + 0.3) / 0.6);   // 1：局部左侧朝光
      const R = icRad(M, (12 + ch.sm) / M.L), ax = axX(CY + ch.sm);
      const gr = g.createLinearGradient(ax - R, 0, ax + R, 0);
      gr.addColorStop(0, rgba(mix('#4e6c92', '#fffaee', kL), 0.9)); gr.addColorStop(0.16, rgba(mix('#9fb8d0', '#eef4f9', kL), 0.78));
      gr.addColorStop(0.5, rgba('#88a6c2', 0.6)); gr.addColorStop(0.84, rgba(mix('#eef4f9', '#9fb8d0', kL), 0.72)); gr.addColorStop(1, rgba(mix('#fffaee', '#4e6c92', kL), 0.9));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = Math.max(1, R * 0.12);
      g.beginPath(); g.moveTo(ax - R * 0.25 * (2 * kL - 1), y0 + 4); g.lineTo(ax - R * 0.2 * (2 * kL - 1), y1 - 4); g.stroke();
      if (k0 > 0.01) { g.globalAlpha = k0; g.drawImage(tex, tx0, TOFF, tw, th); g.globalAlpha = 1; }
      g.restore();
      g.lineWidth = 0.9; g.strokeStyle = 'rgba(255,250,240,0.8)';
      linePath(g, ch.top, 1, 0, 0.4); g.stroke(); linePath(g, ch.bot, 1, 0, -0.4); g.stroke();
      g.restore();
    }
    function drawChip(g, s, p, hx) {
      const gx = hx + p.x, gy = HY0 + p.z * 0.35, y = gy - p.h - s.sz * 0.3;
      const fl = lerp(0.42, 1, clamp(p.h / 14));
      g.fillStyle = rgba('#26323e', 0.2 * clamp(1 - p.h / 90));
      g.beginPath(); g.ellipse(gx + 1.5, gy + 1, s.sz * 1.1, 1.3, 0, 0, TAU); g.fill();
      const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
      g.beginPath();
      s.pts.forEach((q, i) => { const X = gx + q[0] * ca - q[1] * sa, Y = y + (q[0] * sa + q[1] * ca) * fl; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.closePath();
      const gr = g.createLinearGradient(gx - s.sz * 1.2, 0, gx + s.sz * 1.2, 0);
      gr.addColorStop(0, 'rgba(255,250,238,0.9)'); gr.addColorStop(0.45, 'rgba(176,200,224,0.55)'); gr.addColorStop(1, 'rgba(78,108,146,0.75)');
      g.fillStyle = gr; g.fill();
    }

    XYT.registerShot('f2_icicle', {
      name: '冰棱断', zone: 'left', night: false,
      text: '#f4f8fb', shadow: 'rgba(14,20,28,0.88)', accent: '#ffd9a0', bloom: 0.3,
      draw(g, c) {
        const lt = c.lt;
        const tCrack = CT(c, 4, 1.946), tSnap = CT(c, 5, 2.466), tHit = CT(c, 8, 3.886);
        const tFall = tHit - fallT;                       // 完全脱落（约 3.4 s）
        const sd = Math.max(0, c.b.sinceDown || 0);
        const sunK = 1 + 0.06 * (1 - Math.exp(-sd / 0.07)) * Math.exp(-sd / 0.7);   // 强拍阳光 +6%（约 0.15 s 升起、慢慢回落）
        const z = 1 + 0.02 * easeInOut(c.p);
        g.save();
        g.translate(M.x, 330); g.scale(z, z); g.translate(-M.x, -330);
        g.drawImage(bg(), 0, 0, W, H);
        // 强拍时阳光略亮：只照进檐外的亮处，阴影里的山墙（歌词区）不变
        if (sunK > 1.001) {
          g.save(); g.beginPath(); g.rect(316, 0, W - 316, H); g.clip();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = (sunK - 1) * 2.4; g.drawImage(dot('f2sun', '#fff2dc', 0.2), 340 - 560, 430 - 440, 1120, 880);
          g.restore();
        }
        // 水滴落在石面上的深色湿印，慢慢淡去
        const D = drips(c);
        const mk = smooth(ramp(lt, CT(c, 0, 0.246) - 0.3, CT(c, 3, 1.426) + 1.2));   // 冰尖化短的进度
        const mb = smooth(ramp(lt, CT(c, 0, 0.246), CT(c, 3, 1.426) + 0.25));           // 冰尖变圆变钝（第1字起、第4字后不久完成）
        for (const dr of D) {
          const ic = ice[dr.k], sc = 1 - (3.5 * mk * ic.s) / ic.L, [tx, ty] = tipPos(ic, sc, mb);
          const th = dr.t + Math.sqrt((2 * (ic.hit - ty)) / ic.G), u = lt - th;
          if (u < 0 || u > 3) continue;
          const a = 0.3 * smooth(u / 0.08) * (1 - smooth((u - 0.6) / 2.4));
          g.fillStyle = rgba('#2c3844', a);
          g.beginPath(); g.ellipse(tx, ic.hit + 1, (6 + 5 * smooth(u / 0.3)) * ic.s, (1.8 + 1.2 * smooth(u / 0.3)) * ic.s, 0, 0, TAU); g.fill();
        }
        g.drawImage(eave(), 0, 0, W, 170);

        // 其余冰棱：尖端在第1字到第4字之间缩短一点（水滴只在将滴的那几根尖上鼓起）
        for (const ic of ice) {
          if (ic.k === MAIN) continue;
          const sc = 1 - (3.5 * mk * ic.s) / ic.L;
          drawIce(g, ic, ic.x - ic.w / 2 - 8, ic.ey - 1, sc, mb);
        }
        // 最长的一根
        const tex = icTex(M, true), tx0 = M.x - M.w / 2 - 8, tw = M.w + 16, th = M.L + 14;   // 断之前尖已化圆
        const snapU = lt - tSnap, fallU = lt - tFall, hu = lt - tHit;
        if (snapU <= 0) {
          drawIce(g, M, tx0, TOFF, 1, mb);
          const ck = smooth(ramp(lt, tCrack, tCrack + 0.5));      // 裂纹 0.5 s 内从左向右走过去
          if (ck > 0) drawCrack(g, ck);
        } else {
          const dy = 3 * (1 - Math.exp(-snapU / 0.035) * Math.cos(snapU * 38));
          const rot = ROT0 * (1 - Math.exp(-snapU / 0.05) * Math.cos(snapU * 30));
          // 残根：留在瓦口，不动；底下露出一窄条受光的断面
          g.save(); clipAbove(g); g.drawImage(tex, tx0, TOFF, tw, th); g.restore();
          linePath(g, CRACK, 1, 0, 0.9); g.strokeStyle = 'rgba(214,230,244,0.75)'; g.lineWidth = 1.5; g.stroke();
          linePath(g, CRACK, 1, 0, 0.2); g.strokeStyle = 'rgba(255,252,244,0.9)'; g.lineWidth = 0.7; g.stroke();
          // 连着的那丝冰：两半各属一边，脱落时自然分开
          g.strokeStyle = 'rgba(226,238,248,0.85)'; g.lineWidth = 1.5; g.lineCap = 'round';
          g.beginPath(); g.moveTo(PIV.x - 0.6, PIV.y - 0.5); g.lineTo(PIV.x - 0.6, PIV.y + Math.min(dy, 3) * 0.5); g.stroke();
          // 坠落段（着地后低于石面的部分已经碎掉；中段、根段在下端触地时各自脱离）
          const ch0 = chunks[0], ch1 = chunks[1];
          const live = hu < ch0.u ? null : hu < ch1.u ? CUT1 : false;
          if (live !== false) {
            let fy = 0, frot = 0;
            if (fallU > 0) { fy = 0.5 * GM * fallU * fallU; frot = SPIN * fallU; }
            g.save();
            if (hu >= 0) { g.beginPath(); g.rect(0, 0, W, HY0); g.clip(); }
            g.translate(PIV.x, PIV.y + dy + fy); g.rotate(rot + frot); g.translate(-PIV.x, -PIV.y);
            g.strokeStyle = 'rgba(226,238,248,0.85)'; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(PIV.x - 0.6, PIV.y - 1.5); g.lineTo(PIV.x - 0.6, PIV.y + 0.5); g.stroke();
            g.save(); clipBetween(g, CRACK, live); g.drawImage(tex, tx0, TOFF, tw, th); g.restore();
            linePath(g, CRACK, 1, 0, 0.4); g.strokeStyle = 'rgba(255,250,238,0.85)'; g.lineWidth = 0.9; g.stroke();
            g.restore();
          }
        }

        // 水滴：在冰尖慢慢鼓起，离开后加速下落，落地溅开
        const dt = dropTex();
        for (const dr of D) {
          const ic = ice[dr.k], sc = 1 - (3.5 * mk * ic.s) / ic.L, [tx, ty] = tipPos(ic, sc, mb);
          const grow = smooth(ramp(lt, dr.t - 0.9, dr.t)), u = lt - dr.t, s = ic.s;
          if (u < 0) {
            if (grow > 0.01) { const q = (0.35 + 0.65 * grow) * 0.62 * s; g.globalAlpha = grow; g.drawImage(dt, tx - 8 * q, ty - 2, 16 * q, 20 * q); g.globalAlpha = 1; }
            continue;
          }
          const yy = ty + 0.5 * ic.G * u * u, tLand = Math.sqrt((2 * (ic.hit - ty)) / ic.G);
          if (u < tLand) {
            const st = Math.min(1.7, 1 + u * 1.2);
            g.drawImage(dt, tx - 4.8 * s, yy - 2, 9.6 * s, 12 * s * st);
            if (u < 0.5) { g.globalAlpha = 0.5 * (1 - u / 0.5); g.drawImage(glint(), tx - 7, yy + 3, 14, 14); g.globalAlpha = 1; }
          } else {
            const uh = u - tLand;
            if (uh < 0.3) {
              g.fillStyle = rgba('#eef5fb', 0.9 * (1 - uh / 0.3));
              for (let q = 0; q < 4; q++) {
                const vx = (q - 1.5) * 40 * s, vy = -(120 + 30 * (q % 2)) * s;
                g.beginPath(); g.arc(tx + vx * uh, ic.hit + vy * uh + 0.5 * ic.G * uh * uh, 1.2 * s, 0, TAU); g.fill();
              }
            }
          }
        }

        // 第9字：砸上石阶碎裂
        if (hu >= 0) {
          const hx = HITX;
          // 冰粉：一团白雾扬起、扩散，慢慢落下淡去
          const pk = smooth(hu / 0.1) * (1 - smooth((hu - 0.35) / 1.9));
          if (pk > 0.01) {
            const pr = (26 + 70 * easeOut(Math.min(1, hu / 0.9))) * SM;
            const lift = 12 * easeOut(Math.min(1, hu / 0.6)) - 10 * smooth((hu - 0.6) / 1.6);
            g.globalAlpha = 0.6 * pk;
            g.drawImage(dot('f2powder', '#f6f9fc', 0.35), hx - pr * 1.3, HY0 - pr * 0.6 - lift, pr * 2.6, pr * 1.0);
            g.globalAlpha = 1;
          }
          // 大冰段与冰碴按远近（着地点的 y）排序后再画
          const tex2 = icTex(M, true), items = [];
          for (const ch of chunks) { const tau = hu - ch.u; if (tau >= 0) { const p = chunkAt(ch, tau); items.push([p.yg, ch, p]); } }
          for (const s of chips) { const u = hu - s.d; if (u >= 0) { const p = chipAt(s, u); items.push([HY0 + p.z * 0.35, s, p]); } }
          items.sort((a, b) => a[0] - b[0]);
          for (const [, it, p] of items) {
            if (it.pts) { drawChip(g, it, p, hx); continue; }
            const ch = it;
            const ext = (ch.len / 2) * Math.abs(Math.sin(p.ph)) + ch.r;
            g.fillStyle = rgba('#26323e', 0.24 * clamp(1 - p.h / 70));
            g.beginPath(); g.ellipse(p.x + 2, p.yg + 1.5, ext * 0.95, 2.4, 0, 0, TAU); g.fill();
            drawChunk(g, ch, p, 1 - smooth((hu - ch.u) / 0.15), tex2, tx0, tw, th);
          }
          // 撞击瞬间一点柔和的闪光（≤24 px，约 0.1 s）
          if (hu < 0.12) { g.globalAlpha = 0.8 * (1 - hu / 0.12); g.drawImage(glint(), hx - 12, HY0 - 14, 24, 24); g.globalAlpha = 1; }
          // 阳光里闪烁的冰屑：抛起后受阻力缓缓落下，0.9 s 内淡去
          for (let i = 0; i < 22; i++) {
            const vx = (h2(i, 71) - 0.5) * 300, vy = -(80 + h2(i, 72) * 220), drag = 2.4;
            const ex = (1 - Math.exp(-drag * hu)) / drag;
            const x = hx + vx * ex, y = HY0 - 4 + vy * ex + 150 * (hu - ex);
            if (y > HY0 + 20 * h2(i, 73)) continue;
            const a = (1 - smooth((hu - 0.3) / 0.9)) * (0.5 + 0.4 * Math.sin(hu * 9 + i)) * smooth(hu / 0.05);
            if (a < 0.02) continue;
            g.globalAlpha = a; g.drawImage(glint(), x - 4, y - 4, 8, 8); g.globalAlpha = 1;
          }
        }

        // 冰棱上的闪光点（低角度阳光，强拍略亮）
        for (let i = 0; i < 6; i++) {
          const ic = ice[[2, 4, 6, 10, 12, 1][i]];
          const a = (0.4 + 0.35 * Math.sin(lt * (1.1 + 0.3 * i) + i * 2)) * sunK;
          const yy = ic.ey + ic.L * (0.22 + 0.14 * (i % 3)), sz = 18 * ic.s;
          g.globalAlpha = clamp(a); g.drawImage(glint(), ic.x - ic.w * 0.36 - sz / 2, yy - sz / 2, sz, sz); g.globalAlpha = 1;
        }
        g.restore();
      },
    });
  })();

  // ======================= f6 残荷空渡 =======================
  (function () {
    // 平视透视：相机离水面 1.4 m，地平线 y=276；水面上的点 (X, Y, Z) 投影到画面
    const F = 900, HC = 1.4, Y0 = 276;
    const P = (X, Y, Z) => [640 + (F * X) / Z, Y0 + (F * (HC - Y)) / Z];
    const ZB = 60;                                  // 远岸
    // 栈桥：从右侧近岸 A 伸到近处 B（桥头），宽 1.3 m；木桩在桥头靠镜头一侧
    const JA = [1.6, 16.8], JB = [3.5, 6.4];        // 小栈桥约 10 m，从右侧近岸伸出
    const jd = [JB[0] - JA[0], JB[1] - JA[1]], jl = Math.hypot(jd[0], jd[1]);
    const JN = [-jd[1] / jl, jd[0] / jl];           // 桥面横向（指向右）
    // 右侧近岸的岸线（X, Z）：栈桥从这里伸进池中
    const SHORE = [[-0.4, 24], [0.6, 20], [1.6, 16.8], [3.2, 15.4], [5.5, 14.4], [9, 13.6], [16, 13]];
    const shoreZ = (X) => {
      if (X < SHORE[0][0]) return ZB;
      for (let i = 0; i < SHORE.length - 1; i++) { const a = SHORE[i], b = SHORE[i + 1]; if (X <= b[0]) return lerp(a[1], b[1], (X - a[0]) / (b[0] - a[0])); }
      return SHORE[SHORE.length - 1][1];
    };
    const JW = 0.65;
    const POST = [JB[0] - JN[0] * (JW - 0.08), JB[1] - JN[1] * (JW - 0.08)], POSTH = 1.5;   // 桥头木桩高出水面 1.5 m
    // 前景挂丝巾的枯荷梗：离镜头 4 m（水面线 y≈591），节点离水 0.35 m，上段 0.7 m
    const SX = -1.55, SZ = 4.0, NODE = 0.35, UL = 0.7;
    const STEM = '#3b322c', HAZE = '#c3c9cc';
    const stemCol = (Z) => mix(STEM, HAZE, Math.pow(clamp((Z - 5) / 50), 0.7) * 0.78);
    const MARGIN = 60;                               // 离画框左右边 60 px 以内不放枯梗

    // ---- 枯荷：折梗、各种倾角的莲蓬、残破卷叶、断桩（三维折线，倒影把 Y 取反即可） ----
    const lotus = (() => {
      const r = A.rng(4613), out = [];
      const nearJetty = (X, Z) => {
        const t = clamp(((X - JA[0]) * jd[0] + (Z - JA[1]) * jd[1]) / (jl * jl));
        return Math.hypot(X - (JA[0] + jd[0] * t), Z - (JA[1] + jd[1] * t)) < 1.3;
      };
      const behindJetty = (X, Z) => {
        const ax = JA[0], az = JA[1], bx = JB[0], bz = JB[1];
        const d = X * (bz - az) - Z * (bx - ax);
        if (Math.abs(d) < 1e-6) return false;
        const t = (ax * (bz - az) - az * (bx - ax)) / d;
        const u = (t * Z - az) / (bz - az);
        return t > 0 && t < 1 && u >= -0.05 && u <= 1.05;
      };
      const make = (X, Z, kind, H, o = {}) => {
        const lean = o.lean != null ? o.lean : (r() - 0.5) * 0.3, bow = (r() - 0.5) * 0.05;
        const tx = X + lean * H;
        const pts = [[X, 0, Z], [X + lean * H * 0.5 + bow, H * 0.5, Z], [tx, H, Z]];
        const it = { Z, kind, pts, w: o.w || 0.014 + r() * 0.007, seed: 1 + ((r() * 99991) | 0) };
        const side = o.side || (r() < 0.5 ? -1 : 1);
        if (kind === 'pod') {
          // 莲蓬：颈部在梗顶急折，倾角 20–160°，多数低头
          const q = r(), psi = (o.psi != null ? o.psi : q < 0.28 ? 20 + r() * 40 : q < 0.55 ? 60 + r() * 60 : 120 + r() * 40) * Math.PI / 180;
          const nk = o.nk || 0.03 + r() * 0.13;
          pts.push([tx + side * Math.sin(psi) * nk, H + Math.cos(psi) * nk, Z]);
          it.pod = { psi, side, rf: 0.024 + r() * 0.012, lp: 0.028 + r() * 0.014 };
        } else if (kind === 'broken') {
          // 折断：上段斜挂；不再插回水里，也不折成直角
          const L2 = o.L2 || H * (0.35 + r() * 0.4), ang = (o.ang != null ? o.ang : r() < 0.7 ? 125 + r() * 40 : 32 + r() * 26) * Math.PI / 180;
          const ey = H + Math.cos(ang) * L2;
          if (ey < 0.12) return null;
          pts.push([tx + side * Math.sin(ang) * L2, ey, Z]);
        } else if (kind === 'leaf') it.leaf = { s: o.s || 0.09 + r() * 0.11, side, droop: 0.4 + r() * 0.5 };
        it.behind = behindJetty(X, Z);
        for (const p of pts) { const sx = P(p[0], p[1], p[2])[0]; if (sx < MARGIN || sx > W - MARGIN) return null; }
        return it;
      };
      let tries = 0;
      while (out.length < 32 && tries++ < 4000) {
        const Z = 6.5 + Math.pow(r(), 1.2) * 28, X = (r() - 0.5) * Z * 1.35;
        const [sx] = P(X, 0, Z);
        if (sx < MARGIN || sx > W - MARGIN || nearJetty(X, Z) || Z > shoreZ(X) - 0.8) continue;
        if (sx < 250 && Z < 9) continue;                // 左边留给垂柳
        if (Z < 7.5 && sx > 250 && sx < 470) continue;  // 丝巾那根梗周围留白
        const q = r(), kind = q < 0.4 ? 'pod' : q < 0.6 ? 'broken' : q < 0.8 ? 'leaf' : 'stub';
        const H = kind === 'stub' ? 0.1 + r() * 0.22 : 0.35 + r() * 0.75;
        const it = make(X, Z, kind, H);
        if (it) out.push(it);
      }
      // 几根经过安排的近景枯梗（在丝巾与栈桥之间）
      const at = (x, Z) => ((x - 640) * Z) / F;
      const fixed = [
        make(at(520, 5.4), 5.4, 'broken', 0.74, { side: 1, ang: 138, L2: 0.42, lean: -0.04, w: 0.02 }),
        make(at(590, 6.6), 6.6, 'pod', 0.9, { side: -1, psi: 128, nk: 0.14, lean: 0.03, w: 0.019 }),
        make(at(760, 5.7), 5.7, 'leaf', 0.62, { side: 1, s: 0.2, lean: 0.05, w: 0.019 }),
        make(at(892, 4.9), 4.9, 'pod', 0.48, { side: -1, psi: 62, nk: 0.06, lean: 0.06, w: 0.021 }),
        make(at(845, 7.4), 7.4, 'pod', 1.02, { side: 1, psi: 150, nk: 0.1, lean: -0.03 }),
      ];
      for (const it of fixed) if (it) out.push(it);
      return out.sort((a, b) => b.Z - a.Z);
    })();

    function drawStem(g, it, mirror) {
      const sgn = mirror ? -1 : 1, Z = it.Z, k = F / Z;
      const col = stemCol(Z);
      const pp = it.pts.map((p) => P(p[0], sgn * p[1], p[2]));
      const w0 = Math.max(0.7, it.w * k);
      // 水面接触：一圈淡淡的暗环（实物一侧画）
      if (!mirror && Z < 24 && !it.noBase) { const b = pp[0], ww = w0 * 1.6 + 1; g.fillStyle = 'rgba(16,18,20,0.3)'; g.beginPath(); g.ellipse(b[0], b[1] + 0.4, ww * 1.5, Math.max(0.6, ww * 0.22), 0, 0, TAU); g.fill(); }
      // 梗：粗细沿长度 ±30% 起伏，平头
      g.strokeStyle = col; g.lineCap = 'butt';
      for (let i = 0; i < pp.length - 1; i++) {
        const a = pp[i], b = pp[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.max(2, Math.min(12, Math.round(len / 5)));
        const neck = it.pod && i === pp.length - 2 ? 0.8 : 1;
        for (let j = 0; j < n; j++) {
          const u0 = j / n, u1 = Math.min(1, (j + 1) / n + 0.03);
          g.lineWidth = w0 * neck * (1 + 0.3 * (2 * A.noise1(it.seed * 0.013 + i * 2.7 + ((j + 0.5) / n) * len / 14, 71) - 1));
          g.beginPath(); g.moveTo(lerp(a[0], b[0], u0), lerp(a[1], b[1], u0)); g.lineTo(lerp(a[0], b[0], u1), lerp(a[1], b[1], u1)); g.stroke();
        }
        if (i > 0) { g.fillStyle = col; g.beginPath(); g.arc(a[0], a[1], w0 * 0.5, 0, TAU); g.fill(); }
      }
      if (!mirror && Z < 24 && !it.noBase) { const b = pp[0], ww = w0 * 1.1 + 0.6; g.strokeStyle = 'rgba(206,212,215,0.32)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(b[0] - ww, b[1]); g.lineTo(b[0] + ww, b[1]); g.stroke(); }
      const top = it.pts[it.pts.length - 1];
      if (it.pod) {
        // 莲蓬：倒圆锥，口沿参差；雪只落在朝天的那一面（倒影里看不见）
        const [tx, ty] = P(top[0], sgn * top[1], top[2]);
        const { psi, side, rf, lp } = it.pod, rr = A.rng(it.seed);
        const ax = side * Math.sin(psi), ay = Math.cos(psi) * sgn, phi = Math.atan2(ax, ay);
        const RF = rf * k, LPp = lp * k, RN = Math.max(0.5, 0.008 * k);
        g.save(); g.translate(tx, ty); g.rotate(phi);
        g.beginPath(); g.moveTo(-RN, 0);
        g.quadraticCurveTo(-RF * 0.75, -LPp * 0.4, -RF, -LPp);
        const nT = 7;
        for (let i = 1; i <= nT; i++) { const x = -RF + (2 * RF * i) / nT; g.lineTo(x - RF / nT, -LPp - (0.04 + rr() * 0.14) * LPp); g.lineTo(x, -LPp + rr() * 0.06 * LPp); }
        g.quadraticCurveTo(RF * 0.75, -LPp * 0.4, RN, 0); g.closePath();
        g.fillStyle = mix(col, '#1d1f21', 0.2); g.fill();
        if (!mirror && RF > 1.2) {
          g.fillStyle = 'rgba(238,241,242,0.92)';
          if (Math.cos(psi) > 0.3) {
            // 口面朝上：几团大小不一的雪，不连成一片
            for (let i = 0; i < 4; i++) { if (rr() < 0.3) continue; const x = -RF * 0.85 + rr() * RF * 1.7; g.beginPath(); g.ellipse(x, -LPp - 0.6, RF * (0.12 + rr() * 0.22), Math.max(0.5, LPp * (0.05 + rr() * 0.08)), 0, 0, TAU); g.fill(); }
          } else {
            // 口面朝下或朝侧：雪落在锥背朝上的一侧
            const up = -Math.sin(phi) >= 0 ? 1 : -1;
            for (let i = 0; i < 4; i++) { if (rr() < 0.35) continue; const t = 0.25 + rr() * 0.65, x = up * lerp(RN, RF, t) * 0.92, y = -LPp * t; g.beginPath(); g.ellipse(x, y, Math.max(0.6, RF * (0.1 + rr() * 0.15)), Math.max(0.5, RF * (0.06 + rr() * 0.08)), phi, 0, TAU); g.fill(); }
          }
        }
        g.restore();
      }
      if (it.leaf) {
        // 残破的枯叶：多裂片、带撕口的一团，从梗顶垂向一侧；只在上缘落几点薄雪
        const [tx, ty] = P(top[0], sgn * top[1], top[2]);
        const { s, side, droop } = it.leaf, S = s * k, rr = A.rng(it.seed + 7);
        // 叶团垂在梗顶下方、偏向一侧，竖长；边缘是成片的皱褶和两三道撕口
        const cx = S * (0.12 + 0.12 * droop), cy = S * (0.42 + 0.25 * droop), n = 22;
        const t1 = (rr() * n) | 0, t2 = (t1 + 6 + ((rr() * 7) | 0)) % n;
        const ao = Math.atan2(-cy, -cx), per = [];
        for (let i = 0; i < n; i++) {
          const a = ao + 0.45 + ((TAU - 0.9) * i) / (n - 1);
          const lobe = 0.72 + 0.32 * (A.noise1(i * 0.55 + it.seed * 0.01, 33) - 0.5) + 0.12 * (rr() - 0.5);
          const tear = i === t1 || i === t2 ? 0.55 + rr() * 0.15 : 1;
          const rad = S * 0.5 * lobe * tear;
          per.push([cx + Math.cos(a) * rad * 0.8, cy + Math.sin(a) * rad * 1.05, a]);
        }
        g.save(); g.translate(tx, ty); g.scale(side, sgn);
        g.beginPath(); g.moveTo(0, 0);
        for (const p of per) g.lineTo(p[0], p[1]);
        g.closePath();
        g.fillStyle = mix(col, '#1d1f21', 0.12); g.fill();
        g.strokeStyle = rgba(mix(col, '#121314', 0.5), 0.8); g.lineWidth = Math.max(0.5, S * 0.025);
        g.beginPath();
        for (let i = 0; i < 4; i++) { const p = per[(3 + i * 4 + ((rr() * 3) | 0)) % n]; g.moveTo(cx * 0.3, cy * 0.3); g.quadraticCurveTo(lerp(cx * 0.3, p[0], 0.5) + (rr() - 0.5) * S * 0.15, lerp(cy * 0.3, p[1], 0.5), p[0] * 0.92 + cx * 0.08, p[1] * 0.92 + cy * 0.08); }
        g.stroke();
        if (!mirror) {
          g.fillStyle = 'rgba(238,241,242,0.9)';
          for (const p of per) {
            if (Math.sin(p[2]) > -0.35 || rr() < 0.45) continue;
            g.beginPath(); g.ellipse(p[0] * 0.95 + cx * 0.05, p[1] + 0.4, Math.max(0.5, S * (0.02 + rr() * 0.05)), Math.max(0.4, S * (0.012 + rr() * 0.02)), (rr() - 0.5) * 0.6, 0, TAU); g.fill();
          }
        }
        g.restore();
      }
    }

    // ---- 栈桥（3D 盒子投影）、木桩、琵琶、缆绳 ----
    const jp = (u, side, Y) => { const X = JA[0] + jd[0] * u + JN[0] * JW * side, Z = JA[1] + jd[1] * u + JN[1] * JW * side; return P(X, Y, Z); };
    const jZ = (u) => JA[1] + jd[1] * u;
    const JU0 = -1.2 / jl, JUA = 0.03;                 // 桥面伸上岸 1.2 m；桥台临水一面在 u = 0.03
    function drawJetty(g, mirror) {
      const s = mirror ? -1 : 1;
      const wood = '#4a3c32', woodDk = '#2c2420';
      // 桩（每 2.2 m 一对）
      const nP = Math.floor(jl / 2.2);
      for (let i = 1; i <= nP; i++) {                     // 岸边那一对由桥台代替
        const u = i / nP;
        for (const side of [-1, 1]) {
          if (side < 0 && u > 0.95) continue;               // 桥头靠镜头的角由木桩撑着（实物和倒影都不画这根）
          const a = jp(u, side, s * 0.4), b = jp(u, side, 0), Z = jZ(u), lw = Math.max(0.6, (F * 0.1) / Z);
          if (!mirror) { g.fillStyle = 'rgba(16,18,20,0.3)'; g.beginPath(); g.ellipse(b[0], b[1] + 0.4, lw * 1.1, Math.max(0.6, lw * 0.18), 0, 0, TAU); g.fill(); }
          g.strokeStyle = mix(woodDk, HAZE, Math.pow(clamp((Z - 5) / 55), 0.7) * 0.7);
          g.lineWidth = lw; g.lineCap = 'butt';
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
          if (!mirror) { g.strokeStyle = 'rgba(206,212,215,0.45)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(b[0] - lw * 0.75, b[1]); g.lineTo(b[0] + lw * 0.75, b[1]); g.stroke(); }
        }
      }
      // 桥台：岸边一块石砌的台子，桥面最后 1.2 m 搁在上面（台顶 0.34 m，岸顶 0.22 m）
      {
        const sd = -1 - 0.06 / JW, sd2 = 1 + 0.06 / JW, st = mix('#4f4a45', HAZE, 0.25), stDk = mix('#3b3835', HAZE, 0.22);
        const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill(); };
        poly([jp(JU0, sd, s * 0.34), jp(JUA, sd, s * 0.34), jp(JUA, sd, 0), jp(0, sd, 0), jp(0, sd, s * 0.22), jp(JU0, sd, s * 0.22)], st);
        poly([jp(JUA, sd, s * 0.34), jp(JUA, sd2, s * 0.34), jp(JUA, sd2, 0), jp(JUA, sd, 0)], stDk);
        // 石缝两道
        g.strokeStyle = rgba('#2a2826', 0.35); g.lineWidth = 0.6;
        g.beginPath(); { const a = jp(JU0, sd, s * 0.28), b = jp(JUA, sd, s * 0.28); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
        if (!mirror) {
          // 岸上的雪堆在桥台脚下
          g.strokeStyle = '#eef0f1'; g.lineWidth = 1.6;
          g.beginPath(); { const a = jp(JU0, sd, 0.235), b = jp(0, sd, 0.235); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
          g.strokeStyle = 'rgba(206,212,215,0.45)'; g.lineWidth = 0.9;
          const a1 = jp(JUA, sd, 0), a2 = jp(JUA, sd2, 0); g.beginPath(); g.moveTo(a1[0], a1[1]); g.lineTo(a2[0], a2[1]); g.stroke();
        }
      }
      // 桥面侧板（迎镜头一侧）
      const N = 24, uN = (i) => lerp(JU0, 1, i / N);
      g.beginPath();
      for (let i = 0; i <= N; i++) { const q = jp(uN(i), -1, s * 0.47); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      for (let i = N; i >= 0; i--) { const q = jp(uN(i), -1, s * 0.34); g.lineTo(q[0], q[1]); }
      g.closePath();
      const gs = g.createLinearGradient(...jp(0, -1, 0.4), ...jp(1, -1, 0.4));
      gs.addColorStop(0, mix(wood, HAZE, 0.7)); gs.addColorStop(1, wood);
      g.fillStyle = gs; g.fill();
      // 桥头端面
      { const a = jp(1, -1, s * 0.47), b = jp(1, 1, s * 0.47), c2 = jp(1, 1, s * 0.34), d = jp(1, -1, s * 0.34);
        g.fillStyle = woodDk; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fill(); }
      // 桥面积雪（顶面）
      if (!mirror) {
        g.beginPath();
        for (let i = 0; i <= N; i++) { const q = jp(uN(i), -1, 0.52); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
        for (let i = N; i >= 0; i--) { const q = jp(uN(i), 1, 0.52); g.lineTo(q[0], q[1]); }
        g.closePath();
        g.fillStyle = '#e7eaec'; g.fill();
        // 雪沿：靠镜头一侧圆润地鼓出一线
        g.strokeStyle = '#f4f6f7'; g.lineWidth = 1.2;
        g.beginPath(); for (let i = 0; i <= N; i++) { const q = jp(uN(i), -1, 0.5); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
        // 雪面上隐约的木板缝
        g.strokeStyle = 'rgba(150,158,164,0.35)'; g.lineWidth = 0.7;
        for (let i = 1; i < 30; i++) {
          const u = lerp(JU0, 1, Math.pow(i / 30, 0.7)), a = jp(u, -1, 0.52), b = jp(u, 1, 0.52);
          g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        }
      }
    }
    // 桥头木桩（含积雪帽）
    function drawPost(g, mirror) {
      const s = mirror ? -1 : 1, [X, Z] = POST, k = F / Z;
      const top = P(X, s * POSTH, Z), bot = P(X, 0, Z), w = 0.15 * k;
      if (!mirror) { g.fillStyle = 'rgba(16,18,20,0.32)'; g.beginPath(); g.ellipse(bot[0], bot[1] + 0.5, w * 0.8, Math.max(0.8, w * 0.12), 0, 0, TAU); g.fill(); }
      const gr = g.createLinearGradient(top[0] - w / 2, 0, top[0] + w / 2, 0);
      gr.addColorStop(0, '#5a4a3c'); gr.addColorStop(0.5, '#4a3c31'); gr.addColorStop(1, '#2e2621');
      g.fillStyle = gr;
      g.fillRect(top[0] - w / 2, Math.min(top[1], bot[1]), w, Math.abs(bot[1] - top[1]));
      // 缠绳的几圈
      const ry = P(X, s * 0.95, Z)[1];
      g.fillStyle = '#7a6a56';
      for (let i = 0; i < 3; i++) g.fillRect(top[0] - w / 2 - 1, ry + (i * 4 - 4) * s, w + 2, 2.2);
      if (!mirror) {
        g.fillStyle = '#eef1f2';
        g.beginPath(); g.ellipse(top[0], top[1], w * 0.62, w * 0.22, 0, Math.PI, TAU); g.fill();
        g.beginPath(); g.ellipse(top[0], top[1] + 1, w * 0.55, w * 0.14, 0, 0, Math.PI); g.fill();
        // 水线：一道淡亮的弯月面
        g.strokeStyle = 'rgba(206,212,215,0.55)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(bot[0] - w * 0.62, bot[1]); g.lineTo(bot[0] + w * 0.62, bot[1]); g.stroke();
      }
    }
    // 琵琶：斜靠木桩，底端立在桥面雪上；朝天的一侧积了一线雪
    const pipa = () => K.cache('ff6_f6_pipa', 70, 150, 2, (g) => {
      // 贴图坐标：底端在 (35, 146)，头在上；贴图长 140 px，按实长约 0.94 m 缩放
      const cx = 35;
      // 音箱（梨形）
      g.beginPath();
      g.moveTo(cx, 146);
      g.bezierCurveTo(cx - 27, 145, cx - 30, 118, cx - 25, 100);
      g.bezierCurveTo(cx - 20, 82, cx - 9, 70, cx - 5, 58);
      g.lineTo(cx + 5, 58);
      g.bezierCurveTo(cx + 9, 70, cx + 20, 82, cx + 25, 100);
      g.bezierCurveTo(cx + 30, 118, cx + 27, 145, cx, 146);
      g.closePath();
      const gb = g.createLinearGradient(cx - 28, 0, cx + 28, 0);
      gb.addColorStop(0, '#b49a78'); gb.addColorStop(0.55, '#9c8262'); gb.addColorStop(1, '#6e5a44');
      g.fillStyle = gb; g.fill();
      g.strokeStyle = '#4a3a2c'; g.lineWidth = 1.2; g.stroke();
      // 覆手与音孔
      g.fillStyle = '#3e3026'; g.fillRect(cx - 9, 126, 18, 4);
      // 颈与相品
      g.fillStyle = '#6e5a44'; g.fillRect(cx - 4.5, 16, 9, 44);
      g.fillStyle = '#d8ccb8';
      for (let i = 0; i < 4; i++) g.fillRect(cx - 5.5, 20 + i * 8, 11, 2.2);
      for (let i = 0; i < 4; i++) g.fillRect(cx - 4, 62 + i * 9 + i * i, 8, 1.2);
      // 琴头（向后弯）与四个轸子
      g.fillStyle = '#4a3a2c';
      g.beginPath(); g.moveTo(cx - 4.5, 17); g.quadraticCurveTo(cx - 6, 6, cx - 1, 1); g.lineTo(cx + 4, 3); g.quadraticCurveTo(cx + 2, 9, cx + 4.5, 17); g.closePath(); g.fill();
      g.fillStyle = '#5a4634';
      for (const [y, sd] of [[6, -1], [12, -1], [8, 1], [14, 1]]) { g.beginPath(); g.ellipse(cx + sd * 8, y, 4, 1.8, 0, 0, TAU); g.fill(); }
      // 弦
      g.strokeStyle = 'rgba(230,224,210,0.55)'; g.lineWidth = 0.5;
      for (let i = -1.5; i <= 1.5; i++) { g.beginPath(); g.moveTo(cx + i * 1.6, 17); g.lineTo(cx + i * 2.2, 127); g.stroke(); }
    });
    // 琵琶上朝天一侧的积雪（随倾角画在贴图之外，保证落在“上沿”）
    // mirror：倒影——以琴底正下方的水面线为轴上下翻转（只画琴身，不画雪）
    function drawPipa(g, mirror) {
      const [X, Z] = POST, k = F / Z;
      const b = P(X - 0.28, 0.53, Z - 0.05), t = P(X - 0.05, 1.42, Z - 0.02);
      const ang = Math.atan2(t[0] - b[0], b[1] - t[1]);
      const len = Math.hypot(t[0] - b[0], t[1] - b[1]), sc = len / 140;
      if (mirror) {
        const yw = P(X - 0.2, 0, Z - 0.035)[1];
        g.save(); g.translate(0, 2 * yw); g.scale(1, -1);
        g.translate(b[0], b[1]); g.rotate(ang); g.scale(sc, sc);
        g.drawImage(pipa(), -35, -146, 70, 150);
        g.restore();
        return;
      }
      g.save(); g.translate(b[0], b[1]); g.rotate(ang); g.scale(sc, sc);
      g.drawImage(pipa(), -35, -146, 70, 150);
      // 雪：琴身左肩、颈的左缘、琴头顶
      g.fillStyle = '#f1f3f4';
      g.beginPath(); g.moveTo(-26, -40); g.bezierCurveTo(-22, -62, -12, -76, -6, -88); g.lineTo(-3, -86); g.bezierCurveTo(-10, -72, -18, -58, -22, -40); g.closePath(); g.fill();
      g.fillRect(-6.5, -128, 3, 40);
      g.beginPath(); g.ellipse(-2, -145, 5, 2, -0.3, 0, TAU); g.fill();
      g.restore();
      // 琴底的一小堆雪
      g.fillStyle = '#f1f3f4';
      g.beginPath(); g.ellipse(b[0], b[1] + 1, 0.16 * k, 0.03 * k, 0, Math.PI, TAU); g.fill();
    }
    // 缆绳：从木桩垂进水里，水下那段渐隐；那一头已经没有船
    function drawRope(g, mirror) {
      const s = mirror ? -1 : 1;
      const p0 = [POST[0] + 0.07, 0.95, POST[1] - 0.04], p1 = [POST[0] + 0.16, 0.05, POST[1] - 0.12], p2 = [POST[0] + 0.32, -0.2, POST[1] - 0.42];
      g.lineCap = 'round';
      let prev = null;
      for (let i = 0; i <= 24; i++) {
        const u = i / 24, m = 1 - u;
        const X = m * m * p0[0] + 2 * m * u * p1[0] + u * u * p2[0], Y = m * m * p0[1] + 2 * m * u * p1[1] + u * u * p2[1], Z = m * m * p0[2] + 2 * m * u * p1[2] + u * u * p2[2];
        if (mirror && Y < 0) break;
        const q = P(X, s * Y, Z);
        if (prev) {
          const under = Y < 0 ? clamp(-Y / 0.04) : 0;
          if (under >= 0.999) break;
          g.strokeStyle = rgba('#8a7a64', mirror ? 0.8 : 1 - 0.92 * under); g.lineWidth = Math.max(0.8, (F * 0.016) / Z);
          g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(q[0], q[1]); g.stroke();
        }
        prev = q;
      }
      if (!mirror) {
        // 缆绳入水处：淡亮水线与暗环
        let u = 0.5; for (let i = 0; i < 30; i++) { const m = 1 - u, Y = m * m * p0[1] + 2 * m * u * p1[1] + u * u * p2[1]; if (Y > 0) u += 0.5 / (2 << i); else u -= 0.5 / (2 << i); }
        const m = 1 - u, cx = m * m * p0[0] + 2 * m * u * p1[0] + u * u * p2[0], cz = m * m * p0[2] + 2 * m * u * p1[2] + u * u * p2[2], q = P(cx, 0, cz);
        g.fillStyle = 'rgba(16,18,20,0.3)'; g.beginPath(); g.ellipse(q[0], q[1] + 0.4, 4, 0.9, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(206,212,215,0.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(q[0] - 2.5, q[1]); g.lineTo(q[0] + 2.5, q[1]); g.stroke();
      }
    }

    // ---- 右侧近岸：雪覆的土岸、岸边枯苇与矮丛（只到齐腰高，避开歌词区） ----
    const bankReeds = (() => {
      const r = A.rng(4633), out = [];
      for (let X0 = -0.2; X0 < 16; X0 += 0.35 + r() * 1.1) {
        const n = 3 + ((r() * 7) | 0), hc = 0.35 + r() * 0.7, lc = (r() - 0.5) * 0.25;
        for (let k = 0; k < n; k++) out.push({ X: X0 + (r() - 0.5) * 0.3, h: hc * (0.6 + r() * 0.6), lean: lc + (r() - 0.5) * 0.15, d: r() * 0.6, plume: r() < 0.6 });
      }
      return out;
    })();
    function drawBank(g, mirror) {
      const s = mirror ? -1 : 1, wy = P(0, 0, ZB)[1];
      const edge = [];
      // 岸的左端向远处退去：从远岸 (X0−1.5, ZB) 到 SHORE[0] 也有一段湿土岸脚
      for (let i = 0; i < 12; i++) { const v = i / 12; edge.push([lerp(SHORE[0][0] - 1.5, SHORE[0][0], v), lerp(ZB, SHORE[0][1], Math.pow(v, 0.5))]); }
      for (let X = SHORE[0][0]; X <= 16; X += 0.25) edge.push([X, shoreZ(X)]);
      if (!mirror) {
        // 岸面积雪
        g.beginPath(); g.moveTo(...P(SHORE[0][0] - 1.5, 0.22, ZB));
        for (const [X, Z] of edge) g.lineTo(...P(X, 0.22, Z));
        g.lineTo(W + 20, P(16, 0.22, 13)[1]); g.lineTo(W + 20, wy - 2); g.closePath();
        const sg = g.createLinearGradient(0, wy, 0, 380);
        sg.addColorStop(0, '#e5e8ea'); sg.addColorStop(1, '#eef0f1');
        g.fillStyle = sg; g.fill();
      }
      // 岸脚：湿黑的土，上面一线雪沿
      g.beginPath();
      edge.forEach(([X, Z], i) => { const q = P(X, s * 0.22, Z); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
      for (let i = edge.length - 1; i >= 0; i--) g.lineTo(...P(edge[i][0], 0, edge[i][1]));
      g.closePath(); g.fillStyle = mirror ? '#3a3e41' : '#4a4642'; g.fill();
      g.strokeStyle = mirror ? 'rgba(190,196,200,0.8)' : '#f2f4f5'; g.lineWidth = 1.4;
      g.beginPath(); edge.forEach(([X, Z], i) => { const q = P(X, s * 0.24, Z); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.stroke();
      // 岸边枯苇
      for (const rd of bankReeds) {
        const Z = shoreZ(rd.X) + rd.d, b = P(rd.X, s * 0.2, Z), t = P(rd.X + rd.lean, s * (0.2 + rd.h), Z);
        if (b[0] < 600 || b[0] > W + 10) continue;
        g.strokeStyle = mix('#5e5650', HAZE, 0.5); g.lineWidth = Math.max(0.5, (F * 0.007) / Z);
        g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(t[0], t[1]); g.stroke();
        if (rd.plume) {
          // 枯穗：无风，从秆顶软软地垂下一小绺（中段略鼓、两头收尖，贴着秆垂下），不是一面小旗
          const lw = Math.max(0.7, (F * 0.011) / Z), pts = [];
          for (let i = 0; i <= 6; i++) { const v = i / 6, m = 1 - v; pts.push([t[0] + 2 * m * v * 1.5 + v * v * 1.7, t[1] + (2 * m * v * 0.4 + v * v * 6) * s]); }
          g.fillStyle = mix('#958b82', HAZE, 0.35);
          blade(g, pts, (v) => lw * 1.7 * Math.min(1, 0.35 + v * 3) * Math.pow(1 - v, 0.7)); g.fill();
        }
      }
    }

    // ---- 静态大图：天、远岸、水面、全部倒影、残荷、栈桥 ----
    const scene = () => K.cache('ff6_f6_scene', W, H, 1, (g) => {
      const r = A.rng(4627);
      const wy = P(0, 0, ZB)[1];
      // 天：平稳的灰白
      const sk = g.createLinearGradient(0, 0, 0, wy);
      sk.addColorStop(0, '#d4d9dc'); sk.addColorStop(0.7, '#dde1e3'); sk.addColorStop(1, '#e2e5e6');
      g.fillStyle = sk; g.fillRect(0, 0, W, wy + 2);
      // 远岸：雪堤与淡墨枯树（矮，避开歌词区）
      const far = blurred(W, 320, 1.6, (q) => {
        for (let i = 0; i < 26; i++) {
          const x = r() * W, h = 30 + r() * 55, base = wy - 6;
          q.strokeStyle = 'rgba(150,158,163,0.55)'; q.lineCap = 'round';
          const br = (x0, y0, len, ang, w, d) => {
            if (d > 4 || len < 4) return;
            const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len;
            q.lineWidth = w; q.beginPath(); q.moveTo(x0, y0); q.lineTo(ex, ey); q.stroke();
            br(ex, ey, len * 0.7, ang - 0.4 - r() * 0.3, w * 0.7, d + 1); br(ex, ey, len * 0.66, ang + 0.35 + r() * 0.3, w * 0.7, d + 1);
          };
          br(x, base, h * 0.45, -1.57 + (r() - 0.5) * 0.2, 2.2, 0);
        }
        q.fillStyle = 'rgba(170,177,181,0.5)';
        for (let i = 0; i < 60; i++) { const x = r() * W; q.fillRect(x, wy - 10 - r() * 8, 0.8, 10 + r() * 8); }
        q.fillStyle = '#eceff0';
        q.beginPath(); q.moveTo(0, wy + 1);
        for (let x = 0; x <= W; x += 8) q.lineTo(x, wy - 5 - 2.5 * A.noise1(x / 60, 5));
        q.lineTo(W, wy + 1); q.closePath(); q.fill();
        q.fillStyle = 'rgba(120,128,134,0.6)'; q.fillRect(0, wy - 0.5, W, 1.5);
      });
      putBlur(g, far, 0, 0, W, 320);
      // 水：近远岸处映着天光偏亮，越近越黑
      const wg = g.createLinearGradient(0, wy, 0, H);
      wg.addColorStop(0, '#adb4b8'); wg.addColorStop(0.15, '#8c9397'); wg.addColorStop(0.36, '#5a6064'); wg.addColorStop(0.62, '#2b2f32'); wg.addColorStop(1, '#151718');
      g.fillStyle = wg; g.fillRect(0, wy, W, H - wy);
      // 倒影层：Y 取反画一遍，再整体压暗、偏冷、略模糊，加极细的横向波纹错位
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      const rc = document.createElement('canvas'); rc.width = Math.round(W * S); rc.height = Math.round(H * S);
      const q = rc.getContext('2d'); q.scale(S, S);
      // 远岸倒影
      q.fillStyle = 'rgba(200,205,208,0.9)'; q.fillRect(0, wy, W, 5);
      drawBank(q, true);
      for (const it of lotus) if (it.behind) drawStem(q, it, true);
      drawJetty(q, true); drawPost(q, true); drawPipa(q, true); drawRope(q, true);
      for (const it of lotus) if (!it.behind) drawStem(q, it, true);
      q.globalCompositeOperation = 'source-atop'; q.fillStyle = 'rgba(28,34,40,0.38)'; q.fillRect(0, 0, W, H);
      q.globalCompositeOperation = 'source-over';
      g.save(); g.beginPath(); g.rect(0, wy, W, H - wy); g.clip();
      g.filter = `blur(${(0.7 * S).toFixed(2)}px)`;
      for (let y = wy; y < H; y += 3) {
        const dx = 0.6 * Math.sin(y * 0.21) + 0.4 * Math.sin(y * 0.057);
        g.drawImage(rc, 0, y * S, W * S, 3 * S, dx, y, W, 3);
      }
      g.filter = 'none';
      g.restore();
      // 水面极淡的几道静水光纹
      for (let i = 0; i < 40; i++) {
        const y = wy + 6 + Math.pow(r(), 1.8) * 300, x = r() * W;
        g.strokeStyle = rgba('#c8ced1', 0.05 + 0.06 * (1 - (y - wy) / 300)); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + r() * 120, y); g.stroke();
      }
      // 实物：右岸 → 栈桥后面的残荷 → 栈桥 → 前面的残荷
      drawBank(g, false);
      for (const it of lotus) if (it.behind) drawStem(g, it, false);
      drawJetty(g, false); drawRope(g, false); drawPost(g, false); drawPipa(g, false);
      for (const it of lotus) if (!it.behind) drawStem(g, it, false);
      // 近岸一角（镜头所在的岸，柳树就长在画外左侧）：雪与几茎枯草
      g.beginPath(); g.moveTo(-10, 676); g.bezierCurveTo(160, 680, 330, 694, 470, 722); g.lineTo(-10, 722); g.closePath();
      g.fillStyle = '#3a3633'; g.fill();
      g.beginPath(); g.moveTo(-10, 680); g.bezierCurveTo(160, 684, 320, 698, 452, 722); g.lineTo(-10, 722); g.closePath();
      const ng = g.createLinearGradient(0, 680, 0, 720); ng.addColorStop(0, '#eef0f1'); ng.addColorStop(1, '#d9dee1');
      g.fillStyle = ng; g.fill();
      for (let i = 0; i < 26; i++) {
        const x = 10 + r() * 380, y = 682 + (x / 452) * 30 + r() * 6, h = 18 + r() * 40, lean = (r() - 0.3) * 10;
        g.strokeStyle = 'rgba(70,62,56,0.85)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); g.stroke();
      }
    });

    // ---- 垂柳：几根主枝从画外左侧伸入，垂丝无风直垂，枝上挂薄雪 ----
    const LIMBS = [
      { p: [[-24, 198], [60, 186], [150, 204], [228, 262]], w: 3.6 },
      { p: [[-24, 236], [40, 226], [112, 240], [172, 286]], w: 3.0 },
      { p: [[-24, 268], [24, 262], [70, 272], [116, 304]], w: 2.4 },
      { p: [[-24, 214], [84, 206], [196, 236], [258, 304]], w: 1.9 },
    ];
    const bz2 = (q, u) => { const m = 1 - u; return [m * m * m * q[0][0] + 3 * m * m * u * q[1][0] + 3 * m * u * u * q[2][0] + u * u * u * q[3][0], m * m * m * q[0][1] + 3 * m * m * u * q[1][1] + 3 * m * u * u * q[2][1] + u * u * u * q[3][1]]; };
    // 垂丝成簇：每根主枝 4–6 簇，簇内疏密、长短不一，夹几根斜出的短枝
    const STRANDS = (() => {
      const r = A.rng(4641), out = [];
      LIMBS.forEach((lb, li) => {
        const nc = 4 + ((r() * 3) | 0);
        for (let c = 0; c < nc; c++) {
          const uc = 0.16 + 0.8 * ((c + 0.2 + 0.6 * r()) / nc), Lc = (90 + Math.pow(r(), 0.7) * 220) * (0.55 + 0.45 * uc), n = 3 + ((r() * 8) | 0);
          for (let k = 0; k < n; k++) {
            const u = clamp(uc + (r() - 0.5) * 0.06, 0.1, 1), [x0, y0] = bz2(lb.p, u), [x1, y1] = bz2(lb.p, Math.min(1, u + 0.02));
            const L = Math.min(565 - y0, Lc * (0.55 + 0.6 * r()));
            out.push({ li, x0, y0, tx: x1 - x0, ty: y1 - y0, L, sw: (r() - 0.5) * 14, bow: (r() - 0.5) * 8, a: 0.35 + r() * 0.45, w: 0.55 + r() * 0.45, sn: r() < 0.35 });
          }
          if (r() < 0.7) {   // 斜出的短枝
            const u = clamp(uc + (r() - 0.5) * 0.08, 0.1, 1), [x0, y0] = bz2(lb.p, u);
            out.push({ li, x0, y0, twig: true, L: 16 + r() * 34, ang: 0.35 + r() * 0.6, bow: (r() - 0.5) * 6, a: 0.5 + r() * 0.3, w: 0.7 + r() * 0.4, sn: r() < 0.5 });
          }
        }
      });
      return out;
    })();
    // 会抖雪的四根垂丝：各取一根主枝上最长的一根
    const SHED = [0, 1, 2, 3].map((li) => { let best = -1; STRANDS.forEach((st, i) => { if (st.li === li && !st.twig && (best < 0 || st.L > STRANDS[best].L)) best = i; }); return best; });
    function strand(g, st, lift) {
      if (st.twig) {
        const ex = st.x0 + Math.sin(st.ang) * st.L, ey = st.y0 + Math.cos(st.ang) * st.L;
        g.strokeStyle = rgba('#2e2925', st.a); g.lineWidth = st.w;
        g.beginPath(); g.moveTo(st.x0, st.y0); g.quadraticCurveTo((st.x0 + ex) / 2 + st.bow, (st.y0 + ey) / 2 - Math.abs(st.bow) * 0.5, ex, ey); g.stroke();
        if (st.sn) { g.fillStyle = 'rgba(240,243,244,0.85)'; g.fillRect(lerp(st.x0, ex, 0.4) - 0.7, lerp(st.y0, ey, 0.4) - 1.6, 1.6, 1.2); }
        return;
      }
      const l = Math.hypot(st.tx, st.ty) || 1, ux = st.tx / l, uy = st.ty / l;
      const y1 = st.y0 + st.L - lift, x1 = st.x0 + 6 * ux + st.sw;
      g.strokeStyle = rgba('#2e2925', st.a); g.lineWidth = st.w;
      g.beginPath(); g.moveTo(st.x0, st.y0); g.bezierCurveTo(st.x0 + ux * 9 + st.bow, st.y0 + uy * 9 + 4, x1 - st.sw * 0.2 - st.bow, st.y0 + st.L * 0.45, x1, y1); g.stroke();
      if (st.sn) { g.fillStyle = 'rgba(240,243,244,0.8)'; for (let m = 1; m < 4; m++) { const v = m / 4.5; g.fillRect(lerp(st.x0 + ux * 6, x1, v) - 0.6, st.y0 + (y1 - st.y0) * v * v, 1.3, 1.3); } }
    }
    const willowTex = () => K.cache('ff6_f6_willow', 300, 600, 1, (g) => {
      const b = blurred(300, 600, 0.35, (q) => {
        STRANDS.forEach((st, i) => { if (!SHED.includes(i)) strand(q, st, 0); });
        for (const lb of LIMBS) {
          q.lineCap = 'round';
          for (let i = 0; i < 20; i++) {
            const a = bz2(lb.p, i / 20), c2 = bz2(lb.p, (i + 1) / 20);
            q.strokeStyle = '#2b2724'; q.lineWidth = lb.w * (1 - 0.72 * (i / 20));
            q.beginPath(); q.moveTo(a[0], a[1]); q.lineTo(c2[0], c2[1]); q.stroke();
          }
          q.strokeStyle = 'rgba(242,244,245,0.92)'; q.lineWidth = Math.max(0.8, lb.w * 0.45);
          q.beginPath();
          for (let i = 0; i <= 14; i++) { const [x, y] = bz2(lb.p, i / 20); i ? q.lineTo(x, y - lb.w * 0.5) : q.moveTo(x, y - lb.w * 0.5); }
          q.stroke();
        }
      });
      putBlur(g, b, 0, 0, 300, 600);
    });
    // 抖雪：第46句第5–8字，柳梢各抖落一点雪粉
    const sheds = (c) => [[SHED[0], CT(c, 4, 2.224)], [SHED[1], CT(c, 5, 2.684)], [SHED[2], CT(c, 6, 3.094)], [SHED[3], CT(c, 7, 3.504)]];

    function drawWillow(g, c, lt) {
      const SH = sheds(c);
      g.drawImage(willowTex(), 0, 0, 300, 600);
      // 抖雪的那几根：雪粉落下后梢头轻轻回弹
      g.lineCap = 'round';
      for (const [idx, t0] of SH) {
        let lift = 0;
        if (lt > t0) { const u = lt - t0; lift = 4 * (1 - Math.exp(-u / 0.08)) * Math.exp(-u / 0.8) * Math.cos(u * 7) + 1.5 * (1 - Math.exp(-u / 0.3)); }
        strand(g, STRANDS[idx], lift);
      }
      // 抖落的雪粉：一团柔软的雪雾（半径 6→20 px，受阻力约 0.6 m/s 下落，1.2 s 内散尽）+ 几粒细雪，横向越散越开
      const puff = dot('f6puff', '#f2f5f6', 0.25), grain = dot('f6grain', '#f6f8f9', 0.5);
      for (const [idx, t0] of SH) {
        const u = lt - t0; if (u < 0 || u > 2.2) continue;
        const st = STRANDS[idx], x0 = st.x0 + st.sw * 0.5 + 2, yT = st.y0 + st.L * 0.55, sb = idx * 7;
        const fall = (vt, tau) => vt * (u - tau * (1 - Math.exp(-u / tau)));
        // 雪雾：渐大、渐淡
        const pr = 6 + 14 * (1 - Math.exp(-u / 0.5)), pa = 0.5 * smooth(u / 0.12) * (1 - smooth(u / 1.2));
        if (pa > 0.01) { g.globalAlpha = pa; g.drawImage(puff, x0 - pr, yT + fall(140, 0.3) - pr, 2 * pr, 2 * pr); }
        // 细雪粒：≤1 px，alpha ≤ 0.5，左右散开到 ±15 px
        for (let i = 0; i < 5; i++) {
          const vt = 120 + 50 * h2(i, sb + 1), y = yT + fall(vt, 0.28) + 4 * (h2(i, sb + 3) - 0.5);
          const x = x0 + (h2(i, sb + 5) - 0.5) * 30 * (1 - Math.exp(-u / 0.6)) + 1.5 * Math.sin(u * 2.2 + i * 1.7);
          const a = 0.5 * smooth(u / 0.15) * (1 - smooth((u - 0.9) / 0.8)) * (1 - smooth((y - 520) / 30));
          if (a < 0.02) continue;
          const r0 = 0.7 + 0.3 * h2(i, sb + 9);
          g.globalAlpha = a; g.drawImage(grain, x - r0 * 1.6, y - r0 * 1.6, r0 * 3.2, r0 * 3.2);
        }
      }
      g.globalAlpha = 1;
    }

    // ---- 丝巾那根荷梗：上段已经低垂成弧；第46句第9字起被积雪压得继续弯下，丝巾顺弧滑落，离梢后落进水里 ----
    // 上段弧：θ(σ) = th0 + b·(σ/UL)²（度，自竖直向右量），越近梢头越弯
    // 静止时：自节点斜向上 40°，在 0.79 处拱到最高，梢头已朝右下（120°）；压弯后节点处折成水平，梢头近乎朝下
    const TH0A = 40, BA = 80, TH0B = 90, NS = 24;
    function arcAt(e, s) {
      const th0 = lerp(TH0A, TH0B, e), b = lerp(BA, BB, e), n = Math.max(1, Math.ceil((s / UL) * NS));
      let X = SX + 0.015, Y = NODE;
      for (let i = 0; i < n; i++) { const ss = (((i + 0.5) / n) * s) / UL, th = ((th0 + b * ss * ss) * Math.PI) / 180; X += (Math.sin(th) * s) / n; Y += (Math.cos(th) * s) / n; }
      return [X, Y, ((th0 + b * (s / UL) * (s / UL)) * Math.PI) / 180];
    }
    let BB = 90;
    { let lo = 30, hi = 130; for (let i = 0; i < 40; i++) { BB = (lo + hi) / 2; if (arcAt(1, UL)[1] > 0.085) lo = BB; else hi = BB; } }   // 弯到底时梢头离水约 8.5 cm
    // 弯曲进度：从静止起步（先慢后快），略过头再回稳（欠阻尼弹簧）
    const ZETA = 0.75, OMG = 4.2, OMD = OMG * Math.sqrt(1 - ZETA * ZETA), TPK = Math.PI / OMD;
    const bendE = (t) => (t <= 0 ? 0 : 1 - Math.exp(-ZETA * OMG * t) * (Math.cos(OMD * t) + ((ZETA * OMG) / OMD) * Math.sin(OMD * t)));
    const bendMax = (t) => bendE(Math.min(t, TPK));                  // 到目前为止弯得最深的程度（积雪只掉不回）
    const thAt = (s, e) => ((lerp(TH0A, TH0B, e) + lerp(BA, BB, e) * (s / UL) * (s / UL)) * Math.PI) / 180;
    // 丝巾沿弧滑动：重力沿切向分量减去动摩擦；静摩擦 0.32、动摩擦 0.2
    const MU = 0.2, MUS = 0.32, G9 = 9.8;
    function slide(s0, tEnd) {
      let s = s0, v = 0, moving = false;
      const dt = 0.002;
      for (let t = 0; t < tEnd && t < 2.5; t += dt) {
        const a = thAt(s, bendE(t)), along = -Math.cos(a), nrm = Math.abs(Math.sin(a));
        if (!moving && along > MUS * nrm) moving = true;
        if (moving) { v = Math.max(0, v + G9 * (along - MU * nrm) * dt); s += v * dt; }
        if (s >= UL) return { s: UL, v, tLv: t };
      }
      return { s, v, tLv: null };
    }
    // 离梢后的抛体：返回入水时刻（相对弯曲起点）
    function leaveOf(st) {
      const e = bendE(st.tLv), tp = arcAt(e, UL), vx = st.v * Math.sin(tp[2]), vy = st.v * Math.cos(tp[2]);
      const tf = (vy + Math.sqrt(vy * vy + 2 * G9 * tp[1])) / G9;
      return { x0: tp[0], y0: tp[1], vx, vy, tIn: st.tLv + tf };
    }
    // 起始挂点：二分求出使丝巾正好在第11字入水的位置（纯函数，按目标时长缓存）
    const calib = new Map();
    function scarfCal(dT) {
      const key = Math.round(dT * 1000);
      if (calib.has(key)) return calib.get(key);
      let lo = 0.3, hi = 0.62, best = null;
      for (let i = 0; i < 26; i++) {
        const m = (lo + hi) / 2, st = slide(m, 2.5);
        if (st.tLv == null) { lo = m; continue; }
        const lv = leaveOf(st);
        if (lv.tIn > dT) lo = m; else hi = m;
        best = m;
      }
      const s0 = best == null ? 0.5 : (lo + hi) / 2, st = slide(s0, 2.5), lv = st.tLv == null ? null : leaveOf(st);
      const out = { s0, tLv: st.tLv, lv };
      calib.set(key, out);
      return out;
    }
    // 第 tr 秒（相对弯曲起点）丝巾搭在梗上的那一点 D（世界坐标）
    function drapeAt(cal, tr) {
      if (tr <= 0) return { D: arcAt(0, cal.s0), on: true };
      if (cal.tLv == null || tr < cal.tLv) { const st = slide(cal.s0, tr); return { D: arcAt(bendE(tr), st.s), on: true }; }
      const lv = cal.lv, tau = Math.min(tr, lv.tIn) - cal.tLv;
      return { D: [lv.x0 + lv.vx * tau, Math.max(0, lv.y0 + lv.vy * tau - 0.5 * G9 * tau * tau), 0], on: false };
    }
    // 两条丝巾尾：从搭点垂下；触到水面的部分平铺在水上、向外摊开
    // 后面一条（先画、偏暗）与前面一条大部分重叠，像一块布搭在梗上垂下的两端
    // 两条尾落到水面的部分都顺着丝巾滑落的方向（向右）皱缩着铺开，不向两边张成一圈
    const TAILS = [
      { len: 0.24, off: 0.011, drift: 0.022, dir: [0.93, 0.36], w: 0.05, back: true, ph: 1.3 },
      { len: 0.3, off: -0.004, drift: -0.012, dir: [0.8, -0.6], w: 0.056, back: false, ph: 0.2 },
    ];
    const BEND = 0.035;                                  // 贴近水面的一段布顺势弯向铺开的方向（圆角，不是直角）
    function tailPts(D, T, delta) {
      const hx = Math.sin(delta), hy = Math.cos(delta), lc = D[1] > 0 ? D[1] / hy : 0, pts = [];
      const sway = (l) => 0.006 * Math.sin((l / T.len) * 3.2 + T.ph) * (l / T.len);   // 布面轻微的 S 形
      const bend = (l) => { const b = Math.min(BEND, lc), q = l - (lc - b); return q > 0 && b > 1e-4 ? (0.5 * q * q) / b : 0; };
      const at = (l) => {
        if (l <= lc) { const bb = bend(l); return [D[0] + T.off + hx * l + T.drift * (l / T.len) + sway(l) + T.dir[0] * bb, D[1] - hy * l, SZ + T.dir[1] * bb, -1, l / T.len]; }
        // 落到水面的部分皱缩着摊开（不拉成直条）
        const bl = 0.5 * Math.min(BEND, lc);
        const cx = D[0] + T.off + hx * lc + T.drift * (lc / T.len) + sway(lc) + T.dir[0] * bl, cz = SZ + T.dir[1] * bl, e = l - lc, ee = e * 0.42, zz = 0.012 * Math.sin(e * 38 + T.ph);
        return [cx + T.dir[0] * ee - T.dir[1] * zz, 0, cz + T.dir[1] * ee + T.dir[0] * zz, e, l / T.len];
      };
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const l = (T.len * i) / n, lp = (T.len * (i - 1)) / n;
        if (i > 0 && lc > lp && lc < l) { if (lc - BEND > lp) pts.push(at(lc - BEND * 0.5)); pts.push(at(lc)); }
        pts.push(at(l));
      }
      return pts;
    }
    // 画一条丝巾尾（mirror：只画悬空部分的倒影）
    function drawTail(g, T, pts, wetAll, mirror, alpha, dy, pinch) {
      const red = '#b52a34';
      const E = pts.map((p, i) => {
        // 搭点处收拢，往下渐宽；离开梢头下落时上端揪成一团
        const lying = p[3] >= 0, fl = ((pinch ? 0.25 : 0.72) + (pinch ? 0.83 : 0.36) * Math.min(1, p[4])) * (lying ? 1.1 : 1);
        const wv = lying ? [-T.dir[1] * T.w * 0.5 * fl, T.dir[0] * T.w * 0.5 * fl] : [T.w * 0.5 * fl, 0];
        const Y = mirror ? -p[1] : p[1];
        const a = P(p[0] + wv[0], Y, p[2] + (lying ? wv[1] : 0)), b = P(p[0] - wv[0], Y, p[2] - (lying ? wv[1] : 0));
        a[1] += dy; b[1] += dy;
        return [a, b, lying ? 0.55 * smooth(p[3] / 0.22) : 0, lying];
      });
      for (let i = 0; i < E.length - 1; i++) {
        const A0 = E[i], B0 = E[i + 1];
        if (mirror && (A0[3] || B0[3])) break;
        const d = Math.max(A0[2], B0[2]) * (1 - wetAll) + wetAll;
        const col = mirror ? mix(mix(red, '#2a2224', 0.5), '#4a1016', d) : mix(T.back ? '#8e1f29' : red, '#4a1016', d * 0.85);
        const ext = (q, r) => [q[0] + (q[0] - r[0]) * 0.08, q[1] + (q[1] - r[1]) * 0.08];
        g.fillStyle = rgba(col, alpha);
        g.beginPath(); g.moveTo(A0[0][0], A0[0][1]); g.lineTo(...ext(B0[0], A0[0])); g.lineTo(...ext(B0[1], A0[1])); g.lineTo(A0[1][0], A0[1][1]); g.closePath(); g.fill();
      }
      if (!mirror) {
        // 中间一道浅褶与末端流苏
        g.strokeStyle = rgba('#6e141c', 0.45 * alpha); g.lineWidth = 0.9;
        g.beginPath(); E.forEach((e, i) => { const x = lerp(e[0][0], e[1][0], 0.62), y = lerp(e[0][1], e[1][1], 0.62); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        const a = E[E.length - 1], b = E[E.length - 2], dx = a[0][0] - b[0][0], dyy = a[0][1] - b[0][1], l = Math.hypot(dx, dyy) || 1;
        g.strokeStyle = rgba(mix(red, '#4a1016', a[3] ? 0.5 + 0.5 * wetAll : 0), 0.8 * alpha); g.lineWidth = 0.7;
        for (let m = 0; m <= 3; m++) { const x = lerp(a[0][0], a[1][0], m / 3), y = lerp(a[0][1], a[1][1], m / 3); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (dx / l) * 3.5, y + (dyy / l) * 3.5); g.stroke(); }
      }
    }
    // 水面区域（近岸雪坡以上）
    function clipWater(g) {
      g.beginPath(); g.moveTo(-10, P(0, 0, ZB)[1]); g.lineTo(W + 10, P(0, 0, ZB)[1]); g.lineTo(W + 10, H + 10); g.lineTo(470, H + 10); g.lineTo(470, 722);
      g.bezierCurveTo(330, 694, 160, 680, -10, 676); g.closePath(); g.clip();
    }
    // 弧上积雪：θ < 100° 的地方积得住；更陡时成团滑落
    const SNOWSEG = (() => {
      const out = [];
      for (let j = 1; j <= NS; j++) {
        const s = (j / NS) * UL, thA = TH0A + BA * (s / UL) ** 2, thB = TH0B + BB * (s / UL) ** 2;
        if (thA >= 100) { out.push({ j, s, has: false }); continue; }
        const eR = (100 - thA) / (thB - thA);
        let tR = null;
        if (eR < bendE(TPK)) { let lo = 0, hi = TPK; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bendE(m) < eR) lo = m; else hi = m; } tR = (lo + hi) / 2; }
        out.push({ j, s, has: A.hash(j * 5 + 1) > 0.07, tR, sz: 0.8 + 1.3 * A.noise1(j / 3.1, 57) });
      }
      // 每三段一团：同一时刻离开弧面，落下的是一团雪
      for (let i = 0; i < out.length; i += 3) {
        const grp = out.slice(i, i + 3), mid = grp[Math.min(1, grp.length - 1)];
        for (const q of grp) { q.tR = mid.tR; q.lead = q === mid; }
        mid.csz = grp.reduce((a, q) => a + (q.has ? q.sz : 0), 0) * 0.75 + 0.6;
      }
      return out;
    })();

    function stemGeom(e) {
      const base = [SX, 0], node = [SX + 0.015, NODE], arc = [];
      for (let j = 0; j <= NS; j++) arc.push(arcAt(e, (j / NS) * UL));
      return { base, node, arc };
    }
    function drawStemFG(g, geo, mirror, col) {
      const sg = mirror ? -1 : 1;
      const pts = [P(geo.base[0], 0, SZ)];
      const n0 = P(geo.node[0], sg * geo.node[1], SZ);
      for (let i = 1; i <= 4; i++) pts.push([lerp(pts[0][0], n0[0], i / 4), lerp(pts[0][1], n0[1], i / 4)]);
      const nLow = pts.length;
      for (let j = 1; j <= NS; j++) { const a = geo.arc[j]; pts.push(P(a[0], sg * a[1], SZ)); }
      g.fillStyle = col;
      blade(g, pts, (v) => { const i = v * (pts.length - 1); return i < nLow ? 3.5 - 0.15 * (i / nLow) : lerp(3.2, 1.6, (i - nLow + 1) / (pts.length - nLow)); });
      g.fill();
      g.beginPath(); g.ellipse(n0[0], n0[1], 2.6, 2, 0, 0, TAU); g.fill();       // 节
    }

    function drawScarfStem(g, c, lt) {
      const tRed = CT(c, 8, 3.904), tMo = CT(c, 10, 4.744);
      const cal = scarfCal(tMo - tRed);
      const tr = lt - tRed, e = bendE(tr), eM = bendMax(tr);
      const geo = stemGeom(e), wy = P(SX, 0, SZ)[1];
      const dr = drapeAt(cal, tr), D = dr.D;
      if (!dr.on && cal.tLv != null) D[1] *= 1 - smooth((tr - cal.tLv) / 0.07);   // 离梢后悬着的那段 2–3 帧内塌进水面那团
      const tIn = cal.lv ? cal.lv.tIn : 99, u = tr - tIn;
      const dPrev = drapeAt(cal, tr - 0.04).D, vx = (D[0] - dPrev[0]) / 0.04;
      const delta = clamp(-0.3 * vx, -0.35, 0.35);
      const wetAll = u > 0 ? smooth(u / 0.7) : 0, sink = u > 0 ? smooth((u - 0.6) / 1.6) : 0, alpha = 1 - sink, sdy = 4 * sink;
      const land = cal.lv ? [cal.lv.x0 + cal.lv.vx * (tIn - cal.tLv), SZ] : [SX + 0.5, SZ];

      // 倒影（只在水面上）：梗与悬空的丝巾，偏暗
      g.save(); clipWater(g);
      g.globalAlpha = 0.7; drawStemFG(g, geo, true, '#262220'); g.globalAlpha = 1;
      if (u < 0) for (const T of TAILS) drawTail(g, T, tailPts(D, T, delta), 0, true, 0.45, 0);
      // 水面上的丝巾：摊开的一团（入水后）
      if (u >= 0 && alpha > 0.01) {
        const spread = smooth(u / 0.4), rr = 0.05 + 0.035 * spread, col = mix(mix('#b52a34', '#4a1016', wetAll * 0.85), '#1d1f21', sink * 0.5);
        g.fillStyle = rgba(col, alpha);
        g.beginPath();
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU, rad = rr * (0.6 + 0.55 * A.hash(i * 13 + 5)) * (1 + 0.06 * Math.sin(u * 1.3 + i));
          const q = P(land[0] + Math.cos(a) * rad * 1.2, 0, land[1] + Math.sin(a) * rad);
          i ? g.lineTo(q[0], q[1] + sdy) : g.moveTo(q[0], q[1] + sdy);
        }
        g.closePath(); g.fill();
        g.strokeStyle = rgba(mix(col, '#140608', 0.4), alpha * 0.6); g.lineWidth = 0.8;
        g.beginPath(); const q0 = P(land[0] - 0.03, 0, land[1] + 0.01), q1 = P(land[0] + 0.035, 0, land[1] - 0.01); g.moveTo(q0[0], q0[1] + sdy); g.lineTo(q1[0], q1[1] + sdy); g.stroke();
      }
      // 涟漪：一圈从入水点向外扩散、变淡
      if (u > 0 && u < 3.4) {
        const R = 0.04 + 0.22 * u, k = F / SZ, rx = k * R, ry = (k * R * HC) / SZ, [lx, ly] = P(land[0], 0, land[1]);
        const a = 0.34 * (1 - smooth(u / 3.0)) * smooth(u / 0.12);
        g.strokeStyle = rgba('#a4adb2', a * 0.5); g.lineWidth = 2.6;
        g.beginPath(); g.ellipse(lx, ly + 0.5, rx, ry, 0, 0, TAU); g.stroke();
        g.strokeStyle = rgba('#b8c0c4', a); g.lineWidth = 1;
        g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, 0, TAU); g.stroke();
        g.strokeStyle = rgba('#08090a', a * 0.7); g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(lx, ly + 2.2, rx * 0.97, ry * 0.92, 0, 0, TAU); g.stroke();
      }
      g.restore();

      // 梗入水处：暗环与淡亮水线
      { const b = P(SX, 0, SZ); g.fillStyle = 'rgba(16,18,20,0.35)'; g.beginPath(); g.ellipse(b[0], b[1] + 0.5, 6, 1.3, 0, 0, TAU); g.fill(); }
      drawStemFG(g, geo, false, '#4a3e35');
      { const b = P(SX, 0, SZ); g.strokeStyle = 'rgba(206,212,215,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(b[0] - 4, b[1]); g.lineTo(b[0] + 4, b[1]); g.stroke(); }
      // 弧上积雪（朝上的一侧）；更陡时成团滑落、碰水即化
      g.strokeStyle = 'rgba(241,243,244,0.95)'; g.lineCap = 'round';
      for (const sgm of SNOWSEG) {
        if (!sgm.has || (sgm.tR != null && tr >= sgm.tR)) continue;
        const a = geo.arc[sgm.j - 1], b = geo.arc[sgm.j], pa = P(a[0], a[1], SZ), pb = P(b[0], b[1], SZ);
        let nx = pb[1] - pa[1], ny = -(pb[0] - pa[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (ny > 0) { nx = -nx; ny = -ny; }
        const off = 1.6 + 0.4 * sgm.sz;
        g.lineWidth = sgm.sz;
        g.beginPath(); g.moveTo(pa[0] + nx * off, pa[1] + ny * off); g.lineTo(pb[0] + nx * off, pb[1] + ny * off); g.stroke();
      }
      g.fillStyle = 'rgba(241,243,244,0.95)';
      for (const sgm of SNOWSEG) {
        if (!sgm.lead || !sgm.csz || sgm.tR == null || tr < sgm.tR) continue;
        const tau = tr - sgm.tR, p0 = arcAt(bendE(sgm.tR), sgm.s), Y = p0[1] + 0.012 - 0.5 * G9 * tau * tau;
        if (Y < -0.005) continue;
        const a = clamp(Y / 0.02) * 0.95, q = P(p0[0] + 0.02 * tau, Y, SZ), r0 = Math.min(2.6, sgm.csz * 0.55);
        g.globalAlpha = a; g.beginPath(); g.ellipse(q[0], q[1], r0, r0 * 0.75, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
      }

      // 丝巾：两条尾 + 搭在梗上的一折
      if (alpha > 0.01) {
        for (const T of TAILS) drawTail(g, T, tailPts(D, T, delta), wetAll, false, alpha, u >= 0 ? sdy : 0, !dr.on);
        if (u < 0 && dr.on) {
          // 搭在梗上的一折：布顺着梗面拱起、两侧垂下（像毛巾搭在杆上），离开梢头就没有了
          const dp = P(D[0], D[1], SZ), th = arcAt(e, Math.min(UL, slide(cal.s0, Math.max(0, tr)).s))[2];
          const tx = Math.sin(th), ty = -Math.cos(th), nx = ty, ny = -tx, hw = 0.03 * (F / SZ), up = ny < 0 ? 1 : -1;
          const s1 = [dp[0] - tx * hw + nx * up * 1.2, dp[1] - ty * hw + ny * up * 1.2], s2 = [dp[0] + tx * hw + nx * up * 1.2, dp[1] + ty * hw + ny * up * 1.2];
          const top = [dp[0] + nx * up * 3.2, dp[1] + ny * up * 3.2], tw = 0.026 * (F / SZ);
          g.fillStyle = '#bd333c';
          g.beginPath(); g.moveTo(s1[0], s1[1]); g.quadraticCurveTo(top[0], top[1], s2[0], s2[1]);
          g.quadraticCurveTo(dp[0] + tw * 0.9, dp[1] + 2, dp[0] + tw * 0.75, dp[1] + 7);
          g.lineTo(dp[0] - tw * 0.85, dp[1] + 7); g.quadraticCurveTo(dp[0] - tw * 0.95, dp[1] + 2, s1[0], s1[1]); g.closePath(); g.fill();
          // 拱顶受天光的一线
          g.strokeStyle = 'rgba(226,116,118,0.55)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(s1[0], s1[1]); g.quadraticCurveTo(top[0], top[1], s2[0], s2[1]); g.stroke();
          // 搭在梗上那折顶上的薄雪：梗开始弯时滑落
          const sk = 1 - smooth((tr - 0.1) / 0.35);
          if (sk > 0.01) { g.fillStyle = rgba('#f1f3f4', 0.9 * sk); g.beginPath(); g.ellipse(top[0], top[1] + 0.6, hw * 0.55, 1.4, Math.atan2(ty, tx), 0, TAU); g.fill(); }
        }
      }
    }

    // ---- 小雪：无风，垂直慢落；落到水面（或桥面）就化掉 ----
    const flakes = (() => {
      const r = A.rng(4651), out = [];
      for (let i = 0; i < 120; i++) {
        const Z = 3 + Math.pow(r(), 1.3) * 40, X = (r() - 0.5) * Z * 1.5;
        const ytop = HC + (Y0 * Z) / F + 0.3;               // 画框上沿对应的高度
        const v = 0.7 + r() * 0.5;
        // 落点在桥面上 → 0.52 m 处化掉；视线穿过栈桥 → 被桥面挡住的那段不画
        const t = clamp(((X - JA[0]) * jd[0] + (Z - JA[1]) * jd[1]) / (jl * jl));
        const onDeck = Math.hypot(X - (JA[0] + jd[0] * t), Z - (JA[1] + jd[1] * t)) < JW;
        let occ = null;
        const d = X * jd[1] - Z * jd[0];
        if (Math.abs(d) > 1e-6) {
          const tt = (JA[0] * jd[1] - JA[1] * jd[0]) / d, u = (tt * Z - JA[1]) / jd[1];
          if (tt > 0 && tt < 1 && u > 0 && u < 1) { const cx = tt * X, cz = tt * Z; occ = [P(cx, 0.52, cz)[1], P(cx, 0.3, cz)[1], cx, cz]; }
        }
        out.push({ X, Z, ytop, v, ph: r() * 40, sw: r() * TAU, s: 0.011 + r() * 0.006, floor: onDeck ? 0.52 : 0, occ });
      }
      return out;
    })();
    // 木桩与琵琶在画面上占的地方：比它们远的雪花从后面经过时被挡住
    const OCC = (() => {
      const [X, Z] = POST, k = F / Z, top = P(X, POSTH + 0.05, Z), bot = P(X, 0, Z), w = 0.15 * k;
      const b = P(X - 0.28, 0.53, Z - 0.05), t = P(X - 0.05, 1.42, Z - 0.02), len = Math.hypot(t[0] - b[0], t[1] - b[1]);
      return { x0: top[0] - w / 2 - 1, x1: top[0] + w / 2 + 1, y0: top[1] - 3, y1: bot[1], b, t, len, Z: Z + 0.1 };
    })();
    const hidden = (x, y) => {
      if (x > OCC.x0 && x < OCC.x1 && y > OCC.y0 && y < OCC.y1) return true;
      const dx = OCC.t[0] - OCC.b[0], dy = OCC.t[1] - OCC.b[1], v = ((x - OCC.b[0]) * dx + (y - OCC.b[1]) * dy) / (OCC.len * OCC.len);
      if (v < -0.02 || v > 1.04) return false;
      const d = Math.abs((x - OCC.b[0]) * dy - (y - OCC.b[1]) * dx) / OCC.len;
      return d < OCC.len * (v < 0.62 ? 0.21 : 0.07);
    };
    function drawFlakes(g, lt, near) {
      const dotS = dot('f6flake', '#f6f8f9', 0.45);
      for (const f of flakes) {
        if ((f.Z < 12) !== near) continue;
        const range = f.ytop + 0.4, Y = f.ytop - ((f.v * (lt + f.ph)) % range);
        // 落在桥面上的雪在 0.5 m 处停住化掉
        const floor = f.floor;
        if (Y < floor) continue;
        const a = smooth((Y - floor) / 0.3) * smooth((f.ytop - Y) / 0.4);
        if (a < 0.02) continue;
        const X = f.X + 0.03 * Math.sin(lt * 1.3 + f.sw);
        const [x, y] = P(X, Y, f.Z);
        if (x < -10 || x > W + 10) continue;
        if (f.occ && y > f.occ[0] - 1 && y < f.occ[1] + 1) continue;
        if (f.Z > OCC.Z && hidden(x, y)) continue;
        const s = Math.max(1.4, (F * f.s) / f.Z) * 2.2;
        g.globalAlpha = a * (near ? 0.95 : 0.7);
        g.drawImage(dotS, x - s, y - s, 2 * s, 2 * s);
      }
      g.globalAlpha = 1;
    }

    XYT.registerShot('f6_jetty', {
      name: '残荷空渡', zone: 'top', night: false,
      text: '#26282a', shadow: 'rgba(238,241,243,0.85)', accent: '#b52a34', bloom: 0.18,
      draw(g, c) {
        const lt = c.lt;
        g.drawImage(scene(), 0, 0, W, H);
        drawFlakes(g, lt, false);
        drawScarfStem(g, c, lt);
        drawWillow(g, c, lt);
        drawFlakes(g, lt, true);
      },
    });
  })();
})();
