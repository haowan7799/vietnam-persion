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
        // 另有两道较窄的云桥把亮段分成几截，裂口不是一整条梭形
        const bk = Math.exp(-Math.pow((u + 0.36) / 0.07, 2)), bk2 = Math.exp(-Math.pow((u - 0.12) / 0.04, 2)), bk3 = Math.exp(-Math.pow((u - 0.56) / 0.045, 2));
        const bridge = Math.max(0, 1 - 0.62 * bk) * (1 - 0.88 * bk2) * (1 - 0.7 * bk3);
        out.push({
          x, u, prof: prof * mod * bridge, bsh: bk * prof * mod,
          c: 14 * u - 10 * u * u + nz(x, 63, 16),               // 中线起伏
          th: nz(x, 67, 14),                                     // 宽度噪声
          eT: nz(x * 1.7, 71, 3), eB: nz(x * 1.7, 73, 3),        // 上下边各自的小起伏
          // 云底一团团鼓进裂口（圆弧状的云团，宽 55–135 px）
          oT: Math.pow(Math.abs(Math.sin(Math.PI * phT)), 0.6), oB: Math.pow(Math.abs(Math.sin(Math.PI * phB)), 0.6),
          aT: 0.12 + 0.36 * A.noise1(x / 70, 91), aB: 0.08 + 0.28 * A.noise1(x / 60, 93),
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
    const SKY1 = stops([[-1, '#6a2216'], [-0.6, '#b8482a'], [-0.12, '#f08a48'], [0.3, '#ffbc74'], [0.62, '#ffdca2'], [0.86, '#ffeec8'], [1, '#ffe4b4']]);   // 撕开后：近日一端亮到金白
    const colAt = (S, u) => {
      let i = 0; while (i < S.length - 2 && S[i + 1][0] < u) i++;
      const t = clamp((u - S[i][0]) / (S[i + 1][0] - S[i][0]));
      return [lerp(S[i][1][0], S[i + 1][1][0], t), lerp(S[i][1][1], S[i + 1][1][1], t), lerp(S[i][1][2], S[i + 1][1][2], t)];
    };
    // 预烘贴图范围（相对云缝中心）与开口档位
    const PX0 = HL + 50, PW = 2 * HL + 100, PY0 = 100, PH = 200;
    const MX0 = PX0 + 70, MW = PW + 140, MY0 = PY0 + 50, MH = PH + 100;     // 连光晕在内的整张贴图
    const DLV = [0, 3, 6, 9, 12, 15, 18, 21], DLIT = [21, 43, 65];        // 未撕开时只是一道窄缝（各档）；撕开后的亮版三档
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
    // 云缝那块天空与云层的原样像素（建缓存时从天空、云层贴图里读出，按画面逻辑像素取样；按渲染倍率各存一份）
    const BPX = new Map();
    function basePx() {
      const S = (XYT.sprites && XYT.sprites.S) || 1;
      if (BPX.has(S)) return BPX.get(S);
      const x0 = GX + 180 - PX0, y0 = GY + 12 - PY0;
      const grab = (cv) => {
        const W2 = Math.round(PW * S), H2 = Math.round(PH * S);
        const src = cv.getContext('2d').getImageData(Math.round(x0 * S), Math.round(y0 * S), W2, H2).data;
        const out = new Uint8ClampedArray(PW * PH * 4);
        for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
          const si = (Math.min(H2 - 1, Math.round(j * S)) * W2 + Math.min(W2 - 1, Math.round(i * S))) * 4, o = (j * PW + i) * 4;
          out[o] = src[si]; out[o + 1] = src[si + 1]; out[o + 2] = src[si + 2]; out[o + 3] = src[si + 3];
        }
        return out;
      };
      const r = { sky: grab(sky()), deck: grab(deck()) };
      BPX.set(S, r);
      return r;
    }
    // 逐像素画一档（整块不透明，直接盖在云层上）：裂口是把这片云层本身挖掉，露出后面的暖天——
    // 开口顺着云层薄处张开、边缘软硬不一；缝里上暗下亮，有远处的薄云纱和横过的碎云；
    // 缝边的云：薄处被身后的光透成暖色，朝光的下唇有 3–8 px 的亮边（上唇较弱），近日的右段更亮
    function bakeGap(k, lit) {
      const F = gapField(), d = (lit ? DLIT : DLV)[k], E = gapEdges(d), nk = Math.min(1, d / 30), N = PW * PH;
      const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
      const q = cv.getContext('2d'), img = q.createImageData(PW, PH), D = img.data;
      const SK = lit ? SKY1 : SKY0;
      const lipC = hx(lit ? '#f0985a' : '#a8503a'), linC = hx(lit ? '#ffe0b0' : '#e8905e'), glowC = hx(lit ? '#ff9a58' : '#9a4030');
      const wC = hx(lit ? '#6e3a30' : '#3e2220'), topC = hx(lit ? '#b0503e' : '#6e2c2c'), vC = hx(lit ? '#c0604a' : '#6a3030'), edC = hx(lit ? '#d0502a' : '#8a2a1c');
      const AA = new Float32Array(N), SR = new Float32Array(N), SG = new Float32Array(N), SB = new Float32Array(N);
      const CC = new Float32Array(PW), XK = new Float32Array(PW), LN = new Float32Array(PW), CS = new Float32Array(PW * 3);
      for (let i = 0; i < PW; i++) {
        const x = i - PX0, fi = (x + HL) / GSTEP, u = x / HL;
        XK[i] = 0.3 + 0.7 * smooth((u + 0.5) / 1.1);                         // 越近日越亮
        LN[i] = smooth((A.noise1(x / 23, 77) - 0.3) / 0.4);                   // 衬里断续
        const cs = colAt(SK, u); CS[i * 3] = cs[0] * 0.78; CS[i * 3 + 1] = cs[1] * 0.78; CS[i * 3 + 2] = cs[2] * 0.78;
        if (fi < 0 || fi > GN - 1) { CC[i] = 0; continue; }
        const i0 = Math.min(GN - 2, Math.floor(fi)), t = fi - i0;
        const T = lerp(E.T[i0], E.T[i0 + 1], t), B = lerp(E.B[i0], E.B[i0 + 1], t), O = lerp(E.O[i0], E.O[i0 + 1], t);
        const cc = (T + B) / 2; CC[i] = cc;
        if (O < 0.05) continue;
        const sky = colAt(SK, u);
        const tw = clamp((d - 21) / 44), amp = 0.4 * Math.min(O, 40) * (0.45 + 0.55 * tw) + 2 * nk, oa = smooth(O / 3), dk = Math.min(1, O / 14) * (5 + 17 * tw);   // 未撕开时是一道窄缝，撕开后边缘顺云层厚薄撕得更开   // 边缘按云层本身的厚薄撕开：薄处开得多、厚的云团留在缝里
        const tip = 1 - smooth((Math.min(1, 1.25 - Math.abs(u + 0.05) * 1.2)) / 0.35);   // 两端渐渐化进云里
        // 两缕淡云丝：各占一段、互不相交
        let w1 = 0, w2 = 0, y1 = 0, y2 = 0, t1 = 1, t2 = 1;
        if (u > 0.14 && u < 0.8) { const v = (u - 0.14) / 0.66; w1 = Math.pow(Math.sin(Math.PI * v), 0.8) * (0.6 + 0.4 * A.noise1(x / 30, 83)); y1 = cc - 0.14 * O + 0.035 * (x - 0.47 * HL); t1 = 2.2 + 3.2 * w1; }
        if (u > -0.3 && u < 0.06) { const v = (u + 0.3) / 0.36; w2 = Math.pow(Math.sin(Math.PI * v), 0.8) * (0.6 + 0.4 * A.noise1(x / 26, 85)); y2 = cc + 0.12 * O + 0.025 * (x + 0.12 * HL); t2 = 1.8 + 2.4 * w2; }
        for (let j = 0; j < PH; j++) {
          const y = j - PY0, kk = j * PW + i;
          let f = Math.min(y - T, B - y);
          if (f < -50) continue;
          f += amp * (F.na[kk] - 0.5) * 2 + dk * (0.55 - F.dn[kk]);           // 云薄处开得多，云厚处收回
          // 厚云处边缘清楚（≥2 px），薄云处向外渐隐 8–12 px
          // 上唇软而暗、下唇（朝光）清楚
          const s = Math.min(2 + 9 * Math.pow(smooth((F.ns[kk] - 0.4) / 0.4), 1.5) * (1.2 - F.dn[kk]) + 7 * tip, 0.6 + 0.6 * O) * (y < cc ? 1.7 : 0.65);
          const a = smooth((f + s) / (1.3 * s)) * oa;
          if (a <= 0) continue;
          const vv = clamp((y - T) / Math.max(4, B - T));                    // 0 上唇 → 1 下唇
          const ib = (0.8 + 0.2 * smooth(f / 18)) * (0.62 + 0.55 * Math.pow(vv, 1.5));   // 越近下唇（越近地平线）越亮：缝里有深度
          let sr = sky[0] * ib, sg = sky[1] * ib, sb = sky[2] * ib;
          const ek = 0.3 * (1 - smooth(f / 12));                             // 贴着云边更红
          sr += (edC[0] - sr) * ek; sg += (edC[1] - sg) * ek; sb += (edC[2] - sb) * ek;
          const tk = 0.4 * (1 - vv) * (1 - vv);                               // 上唇下面偏暗紫
          sr += (topC[0] - sr) * tk; sg += (topC[1] - sg) * tk; sb += (topC[2] - sb) * tk;
          const va = 0.5 * smooth((F.nv[kk] - 0.48) / 0.2) * (0.4 + 0.6 * vv);   // 远处一层层横向的薄云
          sr += (vC[0] - sr) * va; sg += (vC[1] - sg) * va; sb += (vC[2] - sb) * va;
          let wa = 0;
          // 横过裂口的两缕近处碎云：挡在亮天前面，暗、边缘被身后的光照透
          if (w1 > 0) wa += 0.3 * w1 * Math.exp(-Math.pow((y - y1) / t1, 2));
          if (w2 > 0) wa += 0.26 * w2 * Math.exp(-Math.pow((y - y2) / t2, 2));
          sr += (wC[0] - sr) * wa; sg += (wC[1] - sg) * wa; sb += (wC[2] - sb) * wa;
          AA[kk] = a; SR[kk] = sr; SG[kk] = sg; SB[kk] = sb;
        }
      }
      // 到开口的“距离”：开口遮罩模糊后的值（G1 一圈做云边受光，G2 窄一圈做衬里，G3 宽一圈是薄云后面透出的暖光）
      const G1 = boxBlur(AA, PW, PH, 5), G2 = boxBlur(AA, PW, PH, 2), G3 = boxBlur(AA, PW, PH, 9), G4 = boxBlur(AA, PW, PH, 16);
      const BP = basePx(), bs = BP.sky, bd = BP.deck;
      for (let j = 0; j < PH; j++) {
        const y = j - PY0;
        for (let i = 0; i < PW; i++) {
          const kk = j * PW + i, a = AA[kk], o = kk * 4;
          const dn = F.dn[kk], cr = F.cr[kk], tex = F.nt[kk], thin = clamp(1.15 - dn), g3 = G3[kk], xk = XK[i];
          // 底：天空原色；开口里、以及开口附近的薄云后面，换成缝里的暖天
          let sr = bs[o], sg = bs[o + 1], sb = bs[o + 2];
          const behind = Math.max(a, Math.min(1, g3 * 1.6) * thin * 0.8);
          if (behind > 0.002) {
            const m = a > 0 ? smooth(a / 0.3) : 0;
            const wr = lerp(CS[i * 3], SR[kk], m), wg = lerp(CS[i * 3 + 1], SG[kk], m), wb = lerp(CS[i * 3 + 2], SB[kk], m);
            sr += (wr - sr) * behind; sg += (wg - sg) * behind; sb += (wb - sb) * behind;
          }
          // 云：原样的云，开口处挖掉
          const cA = (bd[o + 3] / 255) * (1 - a);
          if (cA > 0.002) {
            let r = bd[o], gg = bd[o + 1], b = bd[o + 2];
            const band = Math.min(1, G1[kk] * 2.4), lower = y > CC[i];
            const gl = Math.min(1, band * thin * (lower ? 1 : 0.15) * xk * 1.4) * 0.85;
            r += (lipC[0] - r) * gl; gg += (lipC[1] - gg) * gl; b += (lipC[2] - b) * gl;
            const ln = Math.min(1, (lower ? 1 : 0.1) * Math.min(1, G2[kk] * 1.8) * Math.pow(xk, 1.2) * (0.35 + 0.65 * LN[i]) * (0.3 + 0.7 * (1 - cr)) * (0.5 + 0.5 * tex) * (lit ? 1.3 : 1));
            r += (linC[0] - r) * ln; gg += (linC[1] - gg) * ln; b += (linC[2] - b) * ln;
            // 缝周的云被缝里的光照亮：贴近的一圈较强（薄处更透），外面一大圈云底只染上 15–25% 的暖色
            const gw = Math.min(0.65, g3 * 1.6 * (0.35 + 0.65 * thin) * (0.4 + 0.6 * xk)) * (lit ? 0.85 : 0.55) * (lower ? 1 : 0.35) + Math.min(1, G4[kk] * 3) * (lower ? 0.24 : 0.1) * (lit ? 1 : 0.6);
            r += (glowC[0] - r) * Math.min(0.8, gw); gg += (glowC[1] - gg) * Math.min(0.8, gw); b += (glowC[2] - b) * Math.min(0.8, gw);
            sr = r * cA + sr * (1 - cA); sg = gg * cA + sg * (1 - cA); sb = b * cA + sb * (1 - cA);
          }
          D[o] = sr; D[o + 1] = sg; D[o + 2] = sb; D[o + 3] = 255;
        }
      }
      q.putImageData(img, 0, 0);
      return cv;
    }
    // 一档贴图：整块不透明的云缝补丁（放在整张贴图范围 MW×MH 的对应位置，外框由 bbox 裁出）
    const gapLv = (k, lit) => K.cache('ff6_e8_gl2_' + k + (lit ? 'L' : ''), MW, MH, 1, (g) => {
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(bakeGap(k, lit), MX0 - PX0, MY0 - PY0, PW, PH);
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
    // 每帧：未撕开时在相邻两档间精确淡化（补丁不透明，按开口程度盖在云层上）；撕开后亮版两档淡化后叠上
    function drawGap(g, gx, gy, d, open, lit) {
      const x0 = gx - MX0, y0 = gy - MY0, L = Math.min(1, lit);
      if (L < 0.998 && open > 0.002) {
        let k = 0; while (k < DLV.length - 2 && DLV[k + 1] <= d) k++;
        const f = clamp((d - DLV[k]) / (DLV[k + 1] - DLV[k]));
        if (k === 0) { if (f > 0.002) { g.globalAlpha = open * f; blitBB(g, gapLv(1, false), x0, y0); } }
        else { g.globalAlpha = open; blitBB(g, mixLv(gapLv(k, false), gapLv(k + 1, false), f), x0, y0); }
      }
      if (L > 0.002) {
        let k = 0; while (k < DLIT.length - 2 && DLIT[k + 1] <= d) k++;
        const f = clamp((d - DLIT[k]) / (DLIT[k + 1] - DLIT[k]));
        g.globalAlpha = L; blitBB(g, mixLv(gapLv(k, true), gapLv(k + 1, true), f), x0, y0);
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
        const sx = GX + u * HL, sy = GY + E.B[k] - 7;                // 从裂口里面（下唇之上）开始
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
          gr.addColorStop(0, rgba(col, a * 0.5)); gr.addColorStop(0.06, rgba(col, a)); gr.addColorStop(0.25, rgba(col, a * 0.8)); gr.addColorStop(0.75, rgba(col, a * 0.35)); gr.addColorStop(1, rgba(col, 0));
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
        const zoneK = smooth((x - 260) / 150);                                  // 进入歌词区（x < 330）之前淡尽（连续过渡）
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
    // ---- 江面上的云缝倒影：碎光贴图（x 对应云缝中心 ±400，y 从地平线往下 300）；近处长而粗、远处细而密，亮段之下最亮 ----
    const RW2 = 800, RH2 = 300;
    const glitBright = (u) => 0.12 + 0.88 * smooth((u + 0.25) / 0.65) * (1 - smooth((Math.abs(u) - 0.85) / 0.2));
    const glitTex = (k) => K.cache('ff6_e8_glit' + k, RW2, RH2, 1, (g) => {
      const r = A.rng(8721 + k * 101);
      // 底下一层柔和的暖色倒影
      const b = blurred(RW2, RH2, 6, (q) => {
        for (let i = 0; i < 70; i++) {
          const u = -0.9 + 1.8 * r(), v = Math.pow(r(), 0.8), x = RW2 / 2 + u * HL, y = 4 + v * (RH2 - 8);
          q.fillStyle = rgba('#e0703a', (0.05 + 0.1 * glitBright(u)) * (1 - 0.4 * v));
          q.beginPath(); q.ellipse(x, y, 30 + 50 * r(), 3 + 6 * v, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, b, 0, 0, RW2, RH2);
      for (let i = 0; i < 1300; i++) {
        const u = -1 + 2 * r(), br = glitBright(u);
        if (r() > br) continue;
        const v = Math.pow(r(), 1.25), y = 1 + v * (RH2 - 4);
        const x = RW2 / 2 + u * HL + (r() - 0.5) * 20;
        const len = (3 + 28 * v) * (0.5 + r()), th = 0.5 + 1.8 * v;
        const a = (0.35 + 0.65 * r()) * br * (0.6 + 0.4 * (1 - v));
        g.fillStyle = rgba(mix('#ff6a3a', '#ffb070', clamp(br * (0.4 + 0.6 * r()))), Math.min(1, a));
        g.fillRect(x - len / 2, y, len, th);
      }
    });
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
        // 第12字撕开后 0.45 s 内染到全红（第13字前 0.16 s），之后保持：下一镜的白雾转场从第14字前约 0.1 s 开始，全红至少清楚地停 0.45 s
        const redK = smooth(ramp(lt, tTear + 0.02, CT(c, 12, 5.56) - 0.16));
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
        const d = 21 * open1 + 44 * tear;                      // 开口：第1–7字裂开一道窄缝（21 px），第12字撕开到 65 px
        if (open1 > 0.001) {
          drawGap(g, gx, gy, d, clamp(open1 * 1.4), lit);
          // 缝里的光在空气里晕开一圈（加色，不受补丁边界限制）：未撕开时暗红、很淡，撕开后金红
          K.lighter(g, () => {
            const bw = 2 * HL * (0.75 + 0.2 * tear), bh = 90 + 70 * tear;
            g.globalAlpha = 0.1 * open1 * (1 - lit); g.drawImage(haloT('#8a2a16'), gx + 0.2 * HL - bw / 2, gy + 6 - bh / 2, bw, bh);
            g.globalAlpha = 0.3 * lit * (0.9 + 0.1 * beat); g.drawImage(haloT('#ff9a50'), gx + 0.3 * HL - bw / 2, gy + 8 - bh / 2, bw, bh);
            g.globalAlpha = 1;
          });
        }
        g.drawImage(scud(), -220 + dScud, 286, 1700, 140);

        // 江面
        g.drawImage(lower(), 0, 370, W, 350);
        // 云缝在江面的倒影：缝里的亮天被雨后的细浪拉成一竖列碎光，三张碎光贴图轮流淡入淡出（加色叠，总亮度不起伏）
        if (open1 > 0.001) {
          const amt = 0.22 * open1 * (1 - tear) + 0.6 * tear;
          const ph = lt / 0.9, i0 = Math.floor(ph) % 3, f = smooth(ph - Math.floor(ph));
          const ox = gx - RW2 / 2, oy = HY + 2;
          g.save(); g.beginPath(); g.rect(0, HY + 1, W, H - HY); g.clip();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = amt * (1 - f); g.drawImage(glitTex(i0), ox + 3 * Math.sin(lt * 0.8), oy, RW2, RH2);
          g.globalAlpha = amt * f; g.drawImage(glitTex((i0 + 1) % 3), ox + 3 * Math.sin(lt * 0.8 + 1.1), oy, RW2, RH2);
          g.restore(); g.globalAlpha = 1;
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
    const eaveY = (x) => 92 + (30 * (x - 300)) / 980;          // 滴水瓦尖（冰棱根）所在的线（檐口层局部坐标）
    const slabY = (x) => 664 - (26 * (x - 300)) / 980;         // 阶沿石后缘（画面坐标）
    const dep = (x) => 1.06 - (0.14 * (x - 300)) / 980;        // 近大远小
    // 推近：檐口、冰棱、坠落与碎裂这一层以最长那根为中心放大 ZI 倍（背景不跟着放大，景深拉开）
    const ZI = 1.28;
    const PXM = 190;                                           // 檐口层局部坐标里 1 m ≈ 190 px（最长那根约 1.5 m）
    const ice = (() => {
      const r = A.rng(2207), out = [];
      const base = [70, 40, 118, 56, 150, 84, 160, 280, 130, 66, 170, 46, 104, 60, 36, 80, 28, 50];
      let x = 338, k = 0;
      while (x < 1290) {
        const s = dep(x), L = base[k % base.length] * s * (0.94 + r() * 0.12);
        const ey = eaveY(x);
        out.push({
          k, x, s, ey, L, w: (9 + 0.1 * L / s) * s, ph: r() * TAU, rip: (8 + r() * 6) * s, lean: (r() - 0.5) * 0.015,
          // 不规则：2–4 个鼓包、1–2° 的弯
          bend: (A.hash(k * 41 + 3) - 0.5) * 0.05, bp: A.hash(k * 43 + 5) * TAU, bk: 2 + Math.floor(A.hash(k * 47 + 9) * 3),
        });
        x += 62 * s; k++;
      }
      return out;
    })();
    const MAIN = 7, M = ice[MAIN], MX = M.x;
    M.bend = 0.012;                                            // 最长那根直挺，像一柄倒悬的剑
    const sxOf = (x) => MX + (x - MX) * ZI;                    // 檐口层局部 x → 画面 x
    for (const ic of ice) {
      ic.xs = sxOf(ic.x);
      ic.vis = ic.xs - ic.w * ZI * 0.5 > 342;                  // 歌词区（x < 330）里只有檐下暗影
      ic.hit = (slabY(ic.xs) + 14 * ic.s) / ZI;                // 落点（局部 y）：阶沿石上檐下滴水冲出的浅槽
      ic.G = 9.8 * PXM * ic.s;
    }
    const axOff = (ic, yy) => ic.lean * yy + (ic.bend * yy * yy) / ic.L;   // 离根 yy 处轴线的横向偏移

    // ---- 背景：冬日晨空（左下低低的朝阳）、景深外的雪院与红梅、阶沿石（受光带 + 檐影 + 冰棱的长影）、左侧暗墙 ----
    const SHB = (x) => slabY(x) + 44;                          // 阶沿石上檐影的边（以下在檐影里）
    const bg = () => K.cache('ff6_f2_bg2', W, H, 1, (g) => {
      const r = A.rng(2211);
      g.fillStyle = '#e9e5dd'; g.fillRect(0, 0, W, H);      // 不透明底，避免上一帧透出来
      const sk = g.createLinearGradient(0, 0, 0, 560);
      sk.addColorStop(0, '#6c8cae'); sk.addColorStop(0.38, '#9db6cd'); sk.addColorStop(0.76, '#dfe2df'); sk.addColorStop(1, '#f1e5d0');
      g.fillStyle = sk; g.fillRect(0, 0, W, 600);
      // 朝阳在画左外、很低：一大片暖金色的天光
      g.save(); g.translate(300, 480); g.scale(1, 0.72);
      const sun = g.createRadialGradient(0, 0, 0, 0, 0, 780);
      sun.addColorStop(0, 'rgba(255,226,170,1)'); sun.addColorStop(0.15, 'rgba(250,214,158,0.78)'); sun.addColorStop(0.42, 'rgba(242,214,178,0.32)'); sun.addColorStop(1, 'rgba(232,226,218,0)');
      g.fillStyle = sun; g.fillRect(-900, -900, 1800, 1800); g.restore();
      // 远景（在景深外，整体模糊得更开）
      const far = blurred(W, 660, 6.5, (q) => {
        q.fillStyle = '#a7b3c1';
        q.beginPath(); q.moveTo(300, 560);
        for (let x = 300; x <= W; x += 10) q.lineTo(x, 470 - 30 * A.noise1(x / 170, 3) - 14 * A.noise1(x / 55, 4));
        q.lineTo(W, 560); q.closePath(); q.fill();
        // 对面的厅堂：雪覆的屋面（朝阳一侧偏暖）、飞檐、檐下暗影（隔着冷空气偏淡）
        const rx0 = 470, rx1 = 1190, ry = 352, re = 428;
        const eaveC = (x) => re - 16 * Math.pow(Math.abs((x - (rx0 + rx1) / 2) / ((rx1 - rx0) / 2)), 3);
        q.fillStyle = '#6c7886';
        q.fillRect(rx0 + 30, re - 4, rx1 - rx0 - 60, 100);
        q.fillStyle = 'rgba(150,162,176,0.35)';
        for (let x = rx0 + 60; x < rx1 - 50; x += 46) q.fillRect(x, re + 6, 5, 90);
        q.fillStyle = 'rgba(120,132,148,0.45)';
        for (let x = rx0 + 70; x < rx1 - 60; x += 46) q.fillRect(x + 10, re + 20, 26, 60);
        q.fillStyle = '#56606b';
        q.beginPath(); q.moveTo(rx0 - 20, eaveC(rx0) - 8);
        for (let x = rx0; x <= rx1; x += 8) q.lineTo(x, eaveC(x) - 2);
        q.lineTo(rx1 + 20, eaveC(rx1) - 8); q.lineTo(rx1 + 20, eaveC(rx1) + 6);
        for (let x = rx1; x >= rx0; x -= 8) q.lineTo(x, eaveC(x) + 8);
        q.closePath(); q.fill();
        const rg = q.createLinearGradient(rx0, ry, rx1, re);
        rg.addColorStop(0, '#fff3de'); rg.addColorStop(0.6, '#eef0ee'); rg.addColorStop(1, '#d4dde7');
        q.fillStyle = rg;
        q.beginPath(); q.moveTo(rx0 + 90, ry); q.lineTo(rx1 - 90, ry);
        for (let x = rx1 + 10; x >= rx0 - 10; x -= 8) q.lineTo(x, eaveC(x) - 3);
        q.closePath(); q.fill();
        q.fillStyle = '#6a737d'; q.fillRect(rx0 + 86, ry - 7, rx1 - rx0 - 172, 8);   // 屋脊
        q.fillStyle = '#fbf2e2'; q.fillRect(rx0 + 86, ry - 10, rx1 - rx0 - 172, 4);
        // 院墙（墙头瓦与积雪）
        q.fillStyle = '#929eab'; q.fillRect(300, 512, W - 300, 46);
        q.fillStyle = '#5c6670'; q.fillRect(300, 504, W - 300, 10);
        q.fillStyle = '#fbf4e8';
        q.beginPath(); q.moveTo(300, 506);
        for (let x = 300; x <= W; x += 8) q.lineTo(x, 499 - 3 * A.noise1(x / 30, 8));
        q.lineTo(W, 507); q.lineTo(300, 507); q.closePath(); q.fill();
        // 院中雪地：迎着朝阳一侧暖、远处偏冷；树与墙的影子向右拖得很长
        const sn = q.createLinearGradient(300, 0, W, 0);
        sn.addColorStop(0, '#fff2dc'); sn.addColorStop(0.55, '#f6efe4'); sn.addColorStop(1, '#e2eaf2');
        q.fillStyle = sn; q.fillRect(300, 556, W - 300, 110);
        q.fillStyle = 'rgba(110,140,180,0.3)'; q.fillRect(300, 556, W - 300, 7);
        for (const [tx, len] of [[1110, 300], [420, 200]]) {
          q.fillStyle = 'rgba(110,140,180,0.3)';
          q.beginPath(); q.moveTo(tx, 600); q.lineTo(tx + len, 605); q.lineTo(tx + len, 608); q.lineTo(tx, 604); q.closePath(); q.fill();
        }
        for (let i = 0; i < 14; i++) {
          const x = 320 + r() * 940, y = 570 + r() * 70;
          q.fillStyle = 'rgba(140,165,195,0.14)'; q.beginPath(); q.ellipse(x, y, 30 + r() * 60, 2 + r() * 3, 0, 0, TAU); q.fill();
        }
        // 左边一株枯树
        q.strokeStyle = 'rgba(96,104,118,0.7)'; q.lineCap = 'round';
        const tree = (x, y, len, ang, w, d) => {
          if (d > 6 || len < 6) return;
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          q.lineWidth = w; q.beginPath(); q.moveTo(x, y); q.lineTo(ex, ey); q.stroke();
          tree(ex, ey, len * 0.72, ang - 0.32 - r() * 0.3, w * 0.7, d + 1);
          tree(ex, ey, len * 0.68, ang + 0.28 + r() * 0.3, w * 0.7, d + 1);
        };
        tree(420, 548, 46, -1.5, 5, 0);
        // 院里一株红梅（全片冷调里唯一的一点暖红）：虬曲的老枝、枝上积雪、梢头一簇簇红花
        const tips = [];
        const plum = (x, y, len, ang, w, d) => {
          if (d > 5 || len < 7) { tips.push([x, y]); return; }
          const kx = x + Math.cos(ang + 0.25) * len * 0.5, ky = y + Math.sin(ang + 0.25) * len * 0.5;
          const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
          q.strokeStyle = 'rgba(74,58,56,0.9)'; q.lineWidth = w;
          q.beginPath(); q.moveTo(x, y); q.lineTo(kx, ky); q.lineTo(ex, ey); q.stroke();
          q.strokeStyle = 'rgba(252,246,236,0.85)'; q.lineWidth = Math.max(0.8, w * 0.4);
          q.beginPath(); q.moveTo(x, y - w * 0.45); q.lineTo(kx, ky - w * 0.45); q.stroke();
          if (d >= 2) tips.push([kx, ky]);
          plum(ex, ey, len * 0.74, ang - 0.38 - r() * 0.32, w * 0.68, d + 1);
          plum(ex, ey, len * 0.66, ang + 0.34 + r() * 0.36, w * 0.68, d + 1);
        };
        plum(1118, 553, 40, -1.66, 6, 0);
        for (const [x, y] of tips) {
          const n = 1 + ((r() * 3) | 0);
          for (let i = 0; i < n; i++) {
            const bx = x + (r() - 0.5) * 10, by = y + (r() - 0.5) * 8, rr = 1.4 + r() * 1.6;
            q.fillStyle = r() < 0.7 ? 'rgba(176,40,48,0.8)' : 'rgba(212,84,92,0.8)';
            q.beginPath(); q.arc(bx, by, rr, 0, TAU); q.fill();
          }
        }
      });
      putBlur(g, far, 0, 0, W, 660);
      // 阶沿石
      g.beginPath(); g.moveTo(0, slabY(0)); g.lineTo(W, slabY(W)); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
      const sl = g.createLinearGradient(0, 640, 0, H);
      sl.addColorStop(0, '#8b929b'); sl.addColorStop(0.25, '#6b7683'); sl.addColorStop(1, '#46505b');
      g.fillStyle = sl; g.fill();
      g.save(); g.clip();
      for (let i = 0; i < 900; i++) {
        const x = r() * W, y = 630 + Math.pow(r(), 0.8) * 90;
        g.fillStyle = r() < 0.5 ? 'rgba(30,38,48,0.12)' : 'rgba(220,228,236,0.08)';
        g.fillRect(x, y, 1 + r() * 2, 1);
      }
      g.strokeStyle = 'rgba(30,36,44,0.35)'; g.lineWidth = 1.2;
      for (const sx of [560, 1040]) { g.beginPath(); g.moveTo(sx, slabY(sx) + 2); g.lineTo(sx - 30, H); g.stroke(); }
      // 朝阳从左边低低地斜照：阶沿石靠院子的一条受光（暖），近处在檐影里；左端被山墙挡住
      g.beginPath(); g.moveTo(330, slabY(330)); g.lineTo(W, slabY(W)); g.lineTo(W, SHB(W)); g.lineTo(380, SHB(380)); g.closePath(); g.clip();
      const lg = g.createLinearGradient(0, 640, 0, 700);
      lg.addColorStop(0, 'rgba(255,224,168,0.5)'); lg.addColorStop(1, 'rgba(255,214,160,0.34)');
      g.fillStyle = lg; g.fillRect(300, 600, W, 120);
      // 冰棱的长影：从檐影的边伸进受光带，向右斜着拖长（最长那根的影子每帧单独画）
      const sh = blurred(W, H, 1.4, (q) => {
        q.fillStyle = 'rgba(58,82,118,0.32)';
        for (const ic of ice) {
          if (!ic.vis || ic.k === MAIN) continue;
          shadowFinger(q, ic.xs + 20 * ic.s, SHB(ic.xs), 0.5 * ic.L * ZI, 0.42 * ic.w * ZI);
        }
      });
      putBlur(g, sh, 0, 0, W, H);
      g.restore();
      // 受光带与檐影之间一道柔和的分界
      g.save(); g.beginPath(); g.moveTo(330, slabY(330)); g.lineTo(W, slabY(W)); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.clip();
      const eg = g.createLinearGradient(0, SHB(800) - 3, 0, SHB(800) + 10);
      eg.addColorStop(0, 'rgba(40,52,70,0)'); eg.addColorStop(1, 'rgba(40,52,70,0.16)');
      g.fillStyle = eg; g.fillRect(0, SHB(800) - 3, W, H);
      g.restore();
      g.strokeStyle = '#e4ddd2'; g.lineWidth = 2.4;
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
        g.fillStyle = 'rgba(20,24,30,0.5)'; g.fillRect(bx - 27, by - rh - 1, 54, 2);
      }
      // 柱子朝阳一侧的一线暖光
      g.fillStyle = 'rgba(236,206,160,0.3)'; g.fillRect(314, 0, 2, H);
    });
    // 一道冰棱的影子：自根 (x, y) 向右上斜伸、渐尖
    function shadowFinger(q, x, y, len, w) {
      const a = -0.26, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      q.beginPath(); q.moveTo(x + nx * w * 0.5, y + ny * w * 0.5);
      q.quadraticCurveTo(x + dx * len * 0.5 + nx * w * 0.38, y + dy * len * 0.5 + ny * w * 0.38, x + dx * len, y + dy * len);
      q.quadraticCurveTo(x + dx * len * 0.5 - nx * w * 0.38, y + dy * len * 0.5 - ny * w * 0.38, x - nx * w * 0.5, y - ny * w * 0.5);
      q.closePath(); q.fill();
    }

    // ---- 檐口：檐底椽子、檐枋、厚厚的雪檐、瓦当与滴水、冰脊（檐口层局部坐标） ----
    const eave = () => K.cache('ff6_f2_eave2', W, 170, 1, (g) => {
      g.fillStyle = '#1f242c';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, eaveY(W) - 40); g.lineTo(0, eaveY(0) - 40); g.closePath(); g.fill();
      for (let x = -30; x < W + 40; x += 38 * dep(Math.max(300, x))) {
        const s = dep(Math.max(300, x)), y1 = eaveY(x) - 44;
        g.fillStyle = '#2a3039';
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 22 * s, 0); g.lineTo(x + 18 * s, y1); g.lineTo(x + 3 * s, y1); g.closePath(); g.fill();
        g.fillStyle = 'rgba(200,190,170,0.05)'; g.fillRect(x + 3 * s, 4, 2, y1 - 8);
        g.fillStyle = '#3a3530'; g.beginPath(); g.ellipse(x + 10.5 * s, y1 - 2, 9 * s, 7 * s, 0, 0, TAU); g.fill();
      }
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
        sg.addColorStop(0, '#fff6e6'); sg.addColorStop(0.45, '#eef0f1'); sg.addColorStop(0.8, '#c3d1df'); sg.addColorStop(1, '#93a8be');
        q.fillStyle = sg; q.fill();
        for (let x = 10; x < W; x += 30 + 34 * A.hash(Math.round(x))) {
          const s = dep(Math.max(300, x)), rr = (8 + 9 * A.hash(Math.round(x) + 3)) * s, cy = bot(x) - rr * 0.7, sq = 0.55 + 0.25 * A.hash(Math.round(x) + 7);
          q.save(); q.translate(x, cy); q.scale(1.6, sq);
          q.fillStyle = 'rgba(160,182,204,0.4)'; q.beginPath(); q.arc(1.2, 1.6, rr, 0, TAU); q.fill();
          q.fillStyle = 'rgba(234,238,242,0.9)'; q.beginPath(); q.arc(0, 0, rr * 0.94, 0, TAU); q.fill();
          q.fillStyle = 'rgba(255,240,214,0.65)'; q.beginPath(); q.arc(-rr * 0.3, -rr * 0.35, rr * 0.5, 0, TAU); q.fill();
          q.restore();
        }
        q.strokeStyle = 'rgba(255,228,184,0.95)'; q.lineWidth = 1.8;
        q.beginPath(); for (let x = 0; x <= W; x += 4) q.lineTo(x, top(x) + 1); q.stroke();
      });
      putBlur(g, snow, 0, 0, W, 170);
      g.fillStyle = '#272b33';
      g.beginPath(); g.moveTo(0, eaveY(0) - 14); for (let x = 0; x <= W; x += 10) g.lineTo(x, eaveY(x) - 14); g.lineTo(W, eaveY(W) - 7); g.lineTo(0, eaveY(0) - 7); g.closePath(); g.fill();
      const tiles = ice.map((ic) => ic.x);
      for (let k = -6; k < 0; k++) tiles.unshift(ice[0].x + k * 62 * 1.08);
      for (const x of tiles) {
        const s = dep(Math.max(300, x)), y = eaveY(x);
        g.fillStyle = '#272b33';
        g.beginPath(); g.arc(x - 31 * s, y - 8, 10 * s, 0, Math.PI); g.fill();
        g.beginPath(); g.moveTo(x - 17 * s, y - 10); g.quadraticCurveTo(x - 10 * s, y - 2, x, y + 2); g.quadraticCurveTo(x + 10 * s, y - 2, x + 17 * s, y - 10); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,220,170,0.34)';
        g.beginPath(); g.moveTo(x - 17 * s, y - 10); g.quadraticCurveTo(x - 10 * s, y - 2, x - 1, y + 1); g.lineTo(x - 3, y - 1); g.quadraticCurveTo(x - 11 * s, y - 4, x - 15 * s, y - 9); g.closePath(); g.fill();
      }
      // 瓦口间的细小冰溜（静态；歌词区里不挂）
      for (let i = 0; i < ice.length - 1; i++) {
        const a = ice[i], b = ice[i + 1];
        for (let m = 0; m < 2; m++) {
          if (A.hash(i * 7 + m) < 0.45) continue;
          const x = lerp(a.x, b.x, 0.3 + 0.4 * A.hash(i * 3 + m + 11));
          if (sxOf(x) < 350) continue;
          const s = dep(x), y = eaveY(x) - 4, L = (8 + 22 * A.hash(i * 5 + m)) * s, w = (2.5 + 2 * A.hash(i + m * 9)) * s;
          const gr = g.createLinearGradient(x - w, 0, x + w, 0);
          gr.addColorStop(0, 'rgba(255,236,200,0.95)'); gr.addColorStop(0.5, 'rgba(170,192,216,0.6)'); gr.addColorStop(1, 'rgba(80,110,148,0.8)');
          g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.4, y + L * 0.6, x, y + L); g.quadraticCurveTo(x + w * 0.4, y + L * 0.6, x + w, y); g.closePath(); g.fill();
        }
      }
      // 冰脊：沿瓦口一条薄冰，连着各根冰棱
      const ib = blurred(W, 170, 0.6, (q) => {
        for (const ic of ice) {
          if (!ic.vis) continue;
          q.fillStyle = 'rgba(222,234,244,0.85)'; q.beginPath(); q.ellipse(ic.x, ic.ey - 1, ic.w * 0.8, 5 * ic.s, 0, 0, TAU); q.fill();
          q.fillStyle = 'rgba(255,240,212,0.95)'; q.beginPath(); q.ellipse(ic.x - ic.w * 0.38, ic.ey - 3, ic.w * 0.28, 1.6, 0, 0, TAU); q.fill();
        }
      });
      putBlur(g, ib, 0, 0, W, 170);
    });

    // ---- 冰棱：外形不规则（鼓包、微弯、根部霜白不透明）；左缘迎着朝阳透出暖金，背光一侧冷蓝 ----
    // 冰棱半宽（s：从根到尖 0..1）
    const icRad = (ic, s) => (ic.w / 2) * Math.pow(1 - s, ic.k === MAIN ? 0.62 : 0.72) *
      (1 + 0.12 * Math.sin(TAU * ic.bk * 0.75 * s + ic.bp) * Math.min(1, s * 5) + 0.04 * Math.sin((s * ic.L) / ic.rip + ic.ph) + 0.16 * Math.exp(-s * 14)) + 0.35;
    // 化钝后的尖：在半径 2.2–3 px 处截住，接一个同半径的圆头（se 为截处的相对长度，rc 为圆头半径）
    const icEnd = (ic) => {
      if (ic.end) return ic.end;
      const r = (2.2 + 0.8 * A.hash(ic.k * 31 + 7)) * ic.s;
      let se = 1; while (se > 0.5 && icRad(ic, se) < r) se -= 0.002;
      return (ic.end = { se, rc: icRad(ic, se) });
    };
    const icPath = (g, ic, blunt) => {
      const cx = ic.w / 2 + 8, L = ic.L, rad = (s) => icRad(ic, s), se = blunt ? icEnd(ic).se : 1;
      g.beginPath(); g.moveTo(cx - rad(0), 0);
      for (let i = 1; i <= 40; i++) { const s = (i / 40) * se; g.lineTo(cx - rad(s) + axOff(ic, s * L), s * L); }
      if (blunt) g.arc(cx + axOff(ic, se * L), se * L, rad(se), Math.PI, 0, true);
      for (let i = 40; i >= 0; i--) { const s = (i / 40) * se; g.lineTo(cx + rad(s) + axOff(ic, s * L), s * L); }
      g.closePath();
    };
    const icTex = (ic, blunt) => K.cache('ff6_f2_ic2_' + ic.k + (blunt ? 'B' : ''), ic.w + 16, ic.L + 14, 2, (g) => {
      const cx = ic.w / 2 + 8, L = ic.L, w = ic.w;
      const rad = (s) => icRad(ic, s), sMax = blunt ? icEnd(ic).se - (0.6 * icEnd(ic).rc) / L : 1;
      const path = () => icPath(g, ic, blunt);
      path();
      const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,230,180,0.95)'); gr.addColorStop(0.09, 'rgba(252,238,214,0.62)'); gr.addColorStop(0.28, 'rgba(206,220,232,0.34)');
      gr.addColorStop(0.52, 'rgba(126,156,188,0.42)'); gr.addColorStop(0.78, 'rgba(98,130,168,0.56)'); gr.addColorStop(1, 'rgba(58,88,130,0.85)');
      g.fillStyle = gr; g.fill();
      g.save(); path(); g.clip();
      // 根部一截霜白、不透明
      const fr = g.createLinearGradient(0, 0, 0, L * 0.18);
      fr.addColorStop(0, 'rgba(238,242,246,0.7)'); fr.addColorStop(0.5, 'rgba(230,236,243,0.3)'); fr.addColorStop(1, 'rgba(230,236,243,0)');
      g.fillStyle = fr; g.fillRect(0, 0, w + 16, L * 0.2);
      // 透进冰里的暖光：靠左三分之一处一道柔和的暖带
      g.strokeStyle = 'rgba(255,214,150,0.28)'; g.lineWidth = Math.max(1.2, w * 0.2);
      g.beginPath(); for (let i = 0; i <= 20; i++) { const s = (i / 20) * Math.min(0.92, sMax); const x = cx - rad(s) * 0.5 + axOff(ic, s * L); i ? g.lineTo(x, s * L) : g.moveTo(x, s * L); } g.stroke();
      // 环纹：2–5 道，间距不等；仰视时环向上拱，贴着冰面弯
      {
        const nR = 2 + Math.floor(A.hash(ic.k * 13 + 1) * 4);
        for (let i = 0; i < nR; i++) {
          const s = 0.1 + 0.7 * (i + 0.2 + 0.6 * A.hash(ic.k * 17 + i * 5)) / nR, y = s * L, rr = rad(s), ax = cx + axOff(ic, y);
          const a = 0.04 + 0.06 * A.hash(ic.k * 19 + i), sag = rr * (0.18 + 0.12 * A.hash(ic.k * 23 + i));
          g.strokeStyle = rgba('#ffffff', a); g.lineWidth = 0.6 + 0.7 * A.hash(ic.k * 29 + i);
          g.beginPath(); g.moveTo(ax - rr, y + sag * 0.3); g.quadraticCurveTo(ax + rr * 0.1, y - sag * 1.6, ax + rr, y + sag * 0.2 + (A.hash(ic.k + i * 7) - 0.5)); g.stroke();
        }
      }
      // 细气泡线
      g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 0.7;
      g.beginPath(); for (let i = 0; i <= 12; i++) { const s = 0.05 + (i / 12) * (Math.min(0.75, sMax) - 0.05); const x = cx + w * 0.08 * (1 - s) + axOff(ic, s * L); i ? g.lineTo(x, s * L) : g.moveTo(x, s * L); } g.stroke();
      g.restore();
      // 左缘高光（朝阳在左）：暖金色的细亮线；背光的右缘一线冷蓝暗边
      g.strokeStyle = 'rgba(255,226,160,1)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(cx - rad(0) + 1, 1);
      for (let i = 1; i <= 38; i++) { const s = Math.min(i / 40, sMax); g.lineTo(cx - rad(s) + 0.8 + axOff(ic, s * L), s * L); }
      g.stroke();
      g.strokeStyle = 'rgba(46,76,116,0.55)'; g.lineWidth = 0.8;
      g.beginPath(); for (let i = 0; i <= 38; i++) { const s = Math.min(i / 40, sMax); g.lineTo(cx + rad(s) - 0.5 + axOff(ic, s * L), s * L); } g.stroke();
    });
    // 原来的细尖减去圆头外形，只剩将化掉的那一截（与圆头版叠画：f = 0 时拼回原样，f = 1 时只剩圆头）
    const icNeedle = (ic) => K.cache('ff6_f2_icN2_' + ic.k, ic.w + 16, ic.L + 14, 2, (g) => {
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
    const dropTex = () => K.cache('ff6_f2_drop2', 16, 20, 3, (g) => {
      g.fillStyle = 'rgba(220,232,244,0.88)';
      g.beginPath(); g.moveTo(8, 1); g.quadraticCurveTo(14, 11, 12, 14); g.arc(8, 14, 4.4, 0, Math.PI); g.quadraticCurveTo(2, 11, 8, 1); g.fill();
      g.fillStyle = 'rgba(70,100,130,0.5)'; g.beginPath(); g.arc(9.5, 15.5, 2.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,236,196,1)'; g.beginPath(); g.arc(6.2, 12.5, 1.5, 0, TAU); g.fill();
    });
    // 柔和的小闪光：亮芯加极淡的十字细芒（暖金）
    const glint = () => K.cache('ff6_f2_glint2', 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,250,236,1)'); gr.addColorStop(0.12, 'rgba(255,238,200,0.72)'); gr.addColorStop(0.4, 'rgba(255,226,170,0.16)'); gr.addColorStop(1, 'rgba(255,226,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const lh = g.createLinearGradient(4, 0, 60, 0);
      lh.addColorStop(0, 'rgba(255,240,210,0)'); lh.addColorStop(0.5, 'rgba(255,240,210,0.4)'); lh.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = lh; g.fillRect(4, 31.4, 56, 1.2);
      const lv = g.createLinearGradient(0, 12, 0, 52);
      lv.addColorStop(0, 'rgba(255,240,210,0)'); lv.addColorStop(0.5, 'rgba(255,240,210,0.25)'); lv.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = lv; g.fillRect(31.4, 12, 1.2, 40);
    });

    // ---- 滴水：第42句第1–4字各从一根冰棱尖滴下 ----
    const drips = (c) => [
      { k: 4, t: CT(c, 0, 0.246) }, { k: 10, t: CT(c, 1, 0.586) }, { k: 2, t: CT(c, 2, 0.986) }, { k: 6, t: CT(c, 3, 1.426) },
      { k: 12, t: CT(c, 9, 4.226) + 0.5 }, { k: 8, t: CT(c, 10, 4.676) + 0.7 },
    ];

    // ---- 最长那根：一条锯齿裂纹把它分成残根与坠落段 ----
    const GM = M.G, HY0 = M.hit;
    const TOFF = M.ey - 1;                               // 冰棱贴图顶边的局部 y
    const CY = TOFF + 12;                                // 裂纹高度
    const axX = (y) => M.x + axOff(M, y - TOFF);         // 静止时轴线 x
    const LP = M.L - 12;                                 // 裂纹以下的长度（到尖）
    const RAD = (y) => icRad(M, clamp((y - TOFF) / M.L));
    // 横切口：第 0 道就是裂纹；其余把坠落段切成 8 截（上粗下细，梢头一截约 20 px）。切口是锯齿、略斜，按 13 个横向采样点取值
    const NU = 13, UJ = Array.from({ length: NU }, (_, j) => -1 + (2 * j) / (NU - 1));
    const CUTF = [0, 0.15, 0.29, 0.42, 0.55, 0.68, 0.8, 0.92];
    const CUTS = CUTF.map((f, i) => {
      const y0 = CY + f * LP, sl = i ? (A.hash(i * 7 + 1) < 0.5 ? -1 : 1) * (0.3 + 0.35 * A.hash(i * 11 + 2)) : 0.1, rr = A.rng(2241 + i * 13);
      const kn = [0, 1, 2, 3, 4, 5].map(() => (rr() - 0.5) * 4);
      return UJ.map((u, j) => {
        const q = ((u + 1) / 2) * 5, i0 = Math.min(4, Math.floor(q)), kv = lerp(kn[i0], kn[i0 + 1], q - i0);
        let y = y0 + sl * u * RAD(y0) + kv + (j > 0 && j < NU - 1 ? (A.hash(i * 31 + j * 5 + 3) - 0.5) * 2.6 : 0);
        return [axX(y) + u * RAD(y), y];
      });
    });
    const CRACK = CUTS[0];
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
    // 裂纹：一道 1.4 px 的亮白细线，外面一圈约 3 px 的柔光，0.5 s 内从左向右走过去
    function drawCrack(g, f) {
      linePath(g, CRACK, f, 0.5, 1.4); g.strokeStyle = 'rgba(40,64,92,0.3)'; g.lineWidth = 1; g.lineJoin = 'miter'; g.stroke();
      linePath(g, CRACK, f, 0, 0); g.strokeStyle = 'rgba(255,250,236,0.4)'; g.lineWidth = 3.4; g.lineJoin = 'round'; g.stroke();
      linePath(g, CRACK, f, 0, 0); g.strokeStyle = 'rgba(255,255,255,0.97)'; g.lineWidth = 1.4; g.stroke();
      for (const [bf, seg] of BR) {
        const k = clamp((f - bf) / 0.2); if (k <= 0) continue;
        const o = crackAt(bf), k1 = Math.min(1, k * 2), k2 = clamp(k * 2 - 1);
        g.beginPath(); g.moveTo(o[0], o[1]);
        g.lineTo(o[0] + seg[0][0] * k1, o[1] + seg[0][1] * k1);
        if (k2 > 0) g.lineTo(o[0] + lerp(seg[0][0], seg[1][0], k2), o[1] + lerp(seg[0][1], seg[1][1], k2));
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.8; g.stroke();
      }
      g.lineJoin = 'miter';
    }
    function clipBelow(g) {
      g.beginPath();
      g.moveTo(CRACK[0][0] - 8, CRACK[0][1]); for (const p of CRACK) g.lineTo(p[0], p[1]); g.lineTo(CRACK[CRACK.length - 1][0] + 8, CRACK[CRACK.length - 1][1]);
      g.lineTo(M.x + 40, TOFF + M.L + 30); g.lineTo(M.x - 40, TOFF + M.L + 30);
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
    const PIV = { x: CRACK[NU - 1][0] - 1.2, y: CRACK[NU - 1][1] };
    const ROT0 = (-4 * Math.PI) / 180, SPIN = -0.42;
    const AX = (s) => [axX(CY + s), CY + s];
    const fallPt = (p, u) => {
      const th = ROT0 + SPIN * u, dx = p[0] - PIV.x, dy = p[1] - PIV.y;
      return [PIV.x + dx * Math.cos(th) - dy * Math.sin(th), PIV.y + 3 + 0.5 * GM * u * u + dx * Math.sin(th) + dy * Math.cos(th)];
    };
    const TIPY = TOFF + icEnd(M).se * M.L + icEnd(M).rc;                 // 化钝后的尖
    const solveHit = (p) => { let a = 0, b = 2; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (fallPt(p, m)[1] < HY0) a = m; else b = m; } return (a + b) / 2; };
    const fallT = solveHit([axX(TIPY), TIPY]);                           // 尖端落到石面所需时间（约 0.4 s）
    const HITX = fallPt([axX(TIPY), TIPY], fallT)[0];

    // ---- 碎裂：坠落段按切口切成 8 截，较粗的几截再顺长劈成两三块（共约 15 块），梢头只剩一小截 ----
    // 落地瞬间整段同时碎开：每块带着坠落的速度继续往下，落到石面上弹一两下（恢复系数约 0.3）、旋转、再滑行减速，第11字前全部停住
    const T_REST = 0.74;
    const FRAGS = (() => {
      const r = A.rng(2261), out = [];
      const sideEdge = (yTop, yBot, u, n) => { const p = []; for (let i = 0; i <= n; i++) { const y = lerp(yTop, yBot, i / n); p.push([axX(y) + u * RAD(y), y]); } return p; };
      for (let k = 0; k < CUTS.length; k++) {
        const top = CUTS[k], bot = CUTS[k + 1] || null;
        const yMid = bot ? (top[6][1] + bot[6][1]) / 2 : (top[6][1] + TIPY) / 2, wMid = 2 * RAD(yMid);
        const nPc = bot ? (wMid > 26 ? 3 : wMid > 13 ? 2 : 1) : 1;
        // 纵向劈线：在上下切口上各取一个采样点，中间带一点抖动
        const splits = [];
        let ibPrev = 0;
        for (let m = 1; m < nPc; m++) {
          const it = Math.round((m / nPc) * (NU - 1) + (r() - 0.5) * 2), ib = clamp(Math.max(ibPrev + 2, it + (r() < 0.5 ? -1 : 1) * (2 + ((r() * 2) | 0))), 1, NU - 2);
          ibPrev = ib;
          const a = top[it], b = bot[ib], ln = [a];
          for (let q = 1; q < 4; q++) { const v = q / 4, y = lerp(a[1], b[1], v), u = lerp(UJ[it], UJ[ib], v) + (r() - 0.5) * 0.22; ln.push([axX(y) + u * RAD(y), y]); }
          ln.push(b); splits.push({ it, ib, ln });
        }
        const bounds = [{ it: 0, ib: 0, side: -1 }].concat(splits, [{ it: NU - 1, ib: NU - 1, side: 1 }]);
        for (let m = 0; m < bounds.length - 1; m++) {
          const L0 = bounds[m], R0 = bounds[m + 1], pts = [];
          for (let j = L0.it; j <= R0.it; j++) pts.push(top[j]);
          if (bot) {
            if (R0.side) pts.push(...sideEdge(top[NU - 1][1], bot[NU - 1][1], 1, 4).slice(1, -1)); else pts.push(...R0.ln.slice(1, -1));
            for (let j = R0.ib; j >= L0.ib; j--) pts.push(bot[j]);
            if (L0.side) pts.push(...sideEdge(bot[0][1], top[0][1], -1, 4).slice(1, -1)); else pts.push(...L0.ln.slice(1, -1).reverse());
          } else {
            // 梢头一截：两侧沿冰棱外缘收到化钝的圆头
            pts.push(...sideEdge(top[NU - 1][1], TIPY - 2, 1, 4).slice(1));
            pts.push([axX(TIPY), TIPY]);
            pts.push(...sideEdge(TIPY - 2, top[0][1], -1, 4).slice(0, -1));
          }
          out.push(pts);
        }
      }
      // 每块的初始状态与运动参数
      return out.map((pts, i) => {
        const Wp = pts.map((p) => fallPt(p, fallT));
        const c0 = Wp.reduce((a, p) => [a[0] + p[0] / Wp.length, a[1] + p[1] / Wp.length], [0, 0]);
        const off = Wp.map((p) => [p[0] - c0[0], p[1] - c0[1]]);
        let best = 0, phi = 0;
        for (const a of off) for (const b of off) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > best) { best = d; phi = Math.atan2(b[1] - a[1], b[0] - a[0]); } }
        const pl = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
        const p1 = fallPt(pl, fallT + 0.002), p0 = fallPt(pl, fallT - 0.002), v = [(p1[0] - p0[0]) / 0.004, (p1[1] - p0[1]) / 0.004];
        const kLow = clamp(1 - (HY0 - c0[1]) / LP), side = Math.abs(c0[0] - HITX) > 3 ? Math.sign(c0[0] - HITX) : r() < 0.5 ? -1 : 1;
        const f = {
          off, c0, len: best, phi, kLow,
          vx0: v[0] + side * (35 + 110 * r()) * (0.3 + 0.7 * kLow), vy0: v[1] * (0.84 + 0.14 * r()), vz0: (r() - 0.35) * 80 * (0.3 + 0.7 * kLow),
          w0: (r() < 0.5 ? -1 : 1) * (2.5 + 3 * r() + 5 * kLow * kLow),
          kick: side * (50 + 150 * r()), kz: (r() - 0.4) * 80, dw: (r() < 0.5 ? -1 : 1) * (5 + 6 * r()), gp: r() * TAU,
        };
        const ext = (th) => { let m = -1e9; const c = Math.cos(th), s = Math.sin(th); for (const o of off) m = Math.max(m, o[0] * s + o[1] * c); return m; };
        f.ext = ext;
        // 第一次触地：重心按抛体，最低点碰到石面（石面随纵深 z 下移）
        const gap = (t) => f.c0[1] + f.vy0 * t + 0.5 * GM * t * t + ext(f.w0 * t) - (HY0 + 0.35 * f.vz0 * t);
        let t1 = 0;
        if (gap(0) < 0) { let a = 0, b = 1; for (let q = 0; q < 34; q++) { const m = (a + b) / 2; if (gap(m) < 0) a = m; else b = m; } t1 = (a + b) / 2; }
        const vy1 = f.vy0 + GM * t1;
        let e = 0.3;
        // 弹跳太高就停不住：按剩余时间收小恢复系数
        e = Math.min(e, Math.max(0.08, ((T_REST - t1 - 0.08) * GM) / (2 * vy1 * 1.3)));
        const vb = e * vy1, tb = (2 * vb) / GM, vb2 = 0.3 * vb, tb2 = (2 * vb2) / GM;
        const vx1 = f.vx0 * 0.7 + f.kick, vz1 = f.vz0 * 0.7 + f.kz, w1 = f.w0 * 0.6 + f.dw;
        const vx2 = vx1 * 0.7, vz2 = vz1 * 0.7, sp = Math.hypot(vx2, vz2);
        const ts = Math.max(0.06, T_REST - t1 - tb - tb2), mu = sp / ts;
        const th1 = f.w0 * t1, ths2 = th1 + w1 * tb;
        // 停下时长轴放平：取离当前朝向最近、使长轴水平的角度
        const aim = ths2 + w1 * 0.3 * (tb2 + ts), cur = phi + aim, flat = aim - (cur - Math.round(cur / Math.PI) * Math.PI);
        Object.assign(f, { t1, e, vb, tb, vb2, tb2, vx1, vz1, w1, vx2, vz2, sp, ts, mu, th1, ths2, flat,
          x1: f.c0[0] + f.vx0 * t1, z1: f.vz0 * t1 });
        f.x2 = f.x1 + vx1 * (tb + tb2); f.z2 = f.z1 + vz1 * (tb + tb2);
        return f;
      });
    })();
    // 第 tau 秒（相对落地）一块碎冰的重心、纵深、转角、离地高度
    function fragAt(f, tau) {
      if (tau < f.t1) {
        const x = f.c0[0] + f.vx0 * tau, y = f.c0[1] + f.vy0 * tau + 0.5 * GM * tau * tau, z = f.vz0 * tau, th = f.w0 * tau;
        return { x, y, z, th, h: HY0 + 0.35 * z - (y + f.ext(th)) };
      }
      let t = tau - f.t1;
      if (t < f.tb) {
        const x = f.x1 + f.vx1 * t, z = f.z1 + f.vz1 * t, th = f.th1 + f.w1 * t, h = f.vb * t - 0.5 * GM * t * t;
        return { x, y: HY0 + 0.35 * z - f.ext(th) - h, z, th, h };
      }
      t -= f.tb;
      const D3 = f.tb2 + f.ts, th = f.ths2 + (f.flat - f.ths2) * smooth(t / D3);
      let x, z, h = 0;
      if (t < f.tb2) { x = f.x1 + f.vx1 * (f.tb + t); z = f.z1 + f.vz1 * (f.tb + t); h = f.vb2 * t - 0.5 * GM * t * t; }
      else {
        const s = Math.min(t - f.tb2, f.ts), d = f.sp * s - 0.5 * f.mu * s * s, k = f.sp > 1e-6 ? d / f.sp : 0;
        x = f.x2 + f.vx2 * k; z = f.z2 + f.vz2 * k;
      }
      return { x, y: HY0 + 0.35 * z - f.ext(th) - h, z, th, h };
    }
    function drawFrag(g, f, p, i) {
      const c = Math.cos(p.th), s = Math.sin(p.th), P2 = f.off.map((o) => [p.x + o[0] * c - o[1] * s, p.y + o[0] * s + o[1] * c]);
      let x0 = 1e9, x1 = -1e9;
      for (const q of P2) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); }
      // 接触阴影
      const gy = HY0 + 0.35 * p.z;
      g.fillStyle = rgba('#2a3646', 0.22 * clamp(1 - p.h / 40));
      g.beginPath(); g.ellipse((x0 + x1) / 2 + 2, gy + 0.8, Math.max(2, (x1 - x0) * 0.55), 1.6, 0, 0, TAU); g.fill();
      g.beginPath(); P2.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(255,236,200,0.92)'); gr.addColorStop(0.4, 'rgba(196,214,232,0.62)'); gr.addColorStop(1, 'rgba(70,102,142,0.8)');
      g.fillStyle = gr; g.fill();
      // 朝阳（左、上）一侧的边亮起来
      const cx = (x0 + x1) / 2, cy = P2.reduce((a, q) => a + q[1], 0) / P2.length;
      g.strokeStyle = 'rgba(255,238,204,0.95)'; g.lineWidth = 0.9; g.beginPath();
      for (let k = 0; k < P2.length; k++) {
        const a = P2[k], b = P2[(k + 1) % P2.length];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        if (nx * ((a[0] + b[0]) / 2 - cx) + ny * ((a[1] + b[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
        if (nx < -0.5) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      }
      g.stroke();
      return [cx, cy];
    }
    // 细碎冰碴：5–7 个角、透明，左侧受光右侧偏蓝；落地后压扁
    const chips = (() => {
      const r = A.rng(2231), out = [];
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1, n = 5 + ((r() * 3) | 0), sz = 1.6 + r() * 2.6, pts = [];
        for (let k = 0; k < n; k++) { const a = (k / n) * TAU + (r() - 0.5) * 0.7, rr = sz * (0.55 + r() * 0.5); pts.push([Math.cos(a) * rr * 1.25, Math.sin(a) * rr]); }
        const ch = { d: r() * 0.05, vx: side * (60 + r() * 200), vy: -(140 + r() * 260), vz: (r() - 0.35) * 70, spin: (r() - 0.5) * 18, a0: r() * TAU, pts, sz, e: 0.26 + r() * 0.1, mu: 620 + r() * 300, x0: (r() - 0.5) * 8 };
        for (let k = 0; k < 20 && ch.d + chipRest(ch) > T_REST; k++) { ch.vy *= 0.92; ch.vx *= 0.9; ch.vz *= 0.9; }
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
        const vy = s.vy * Math.pow(s.e, b), tf = (-2 * vy) / GM;
        if (t < tf) { const h = -(vy * t + 0.5 * GM * t * t); return { x: x + vx * t, z: z + vz * t, h, ang: ang + spin * t }; }
        x += vx * tf; z += vz * tf; ang += spin * tf; t -= tf;
        vx *= 0.6; vz *= 0.6; spin *= 0.45;
      }
      const sp = Math.hypot(vx, vz), ts = sp / s.mu, tt = Math.min(t, ts);
      const f = sp > 0 ? tt - (0.5 * s.mu * tt * tt) / sp : 0;
      return { x: x + vx * f, z: z + vz * f, h: 0, ang: ang + spin * (tt - (tt * tt) / (2 * ts + 1e-6)) };
    }
    function drawChip(g, s, p, hx) {
      const gx = hx + p.x, gy = HY0 + p.z * 0.35, y = gy - p.h - s.sz * 0.3;
      const fl = lerp(0.42, 1, clamp(p.h / 14));
      g.fillStyle = rgba('#26323e', 0.2 * clamp(1 - p.h / 90));
      g.beginPath(); g.ellipse(gx + 1.5, gy + 1, s.sz * 1.1, 1.1, 0, 0, TAU); g.fill();
      const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
      g.beginPath();
      s.pts.forEach((q, i) => { const X = gx + q[0] * ca - q[1] * sa, Y = y + (q[0] * sa + q[1] * ca) * fl; i ? g.lineTo(X, Y) : g.moveTo(X, Y); });
      g.closePath();
      const gr = g.createLinearGradient(gx - s.sz * 1.2, 0, gx + s.sz * 1.2, 0);
      gr.addColorStop(0, 'rgba(255,240,212,0.92)'); gr.addColorStop(0.45, 'rgba(180,202,226,0.55)'); gr.addColorStop(1, 'rgba(78,108,146,0.75)');
      g.fillStyle = gr; g.fill();
    }
    // 冰粉：50 颗柔白细粉从撞击点扬起 15–40 px、向两侧散开 20–80 px，再慢慢落下，约 0.7 s 淡尽
    const POWDER = Array.from({ length: 50 }, (_, i) => ({
      dx: (h2(i, 81) - 0.5) * 2 * (20 + 60 * h2(i, 82)), up: 15 + 25 * h2(i, 83), r: 1.3 + 2.2 * h2(i, 84), a: 0.45 + 0.35 * h2(i, 85), d: 0.04 * h2(i, 86), fall: 20 + 30 * h2(i, 87),
    }));
    const tipPos = (ic, sc, mb) => { const e = icEnd(ic), tl = lerp(ic.L, e.se * ic.L + e.rc, mb); return [ic.x + axOff(ic, tl * sc), ic.ey - 1 + tl * sc]; };

    XYT.registerShot('f2_icicle', {
      name: '冰棱断', zone: 'left', night: false,
      text: '#f4f8fb', shadow: 'rgba(14,20,28,0.88)', accent: '#ffd9a0', bloom: 0.32,
      draw(g, c) {
        const lt = c.lt;
        const tCrack = CT(c, 4, 1.946), tSnap = CT(c, 5, 2.466), tHit = CT(c, 8, 3.886);
        const tFall = tHit - fallT;                       // 完全脱落（约 3.5 s）
        const sd = Math.max(0, c.b.sinceDown || 0);
        const sunK = 1 + 0.06 * (1 - Math.exp(-sd / 0.07)) * Math.exp(-sd / 0.7);   // 强拍阳光 +6%（约 0.15 s 升起、慢慢回落）
        const z = 1 + 0.02 * easeInOut(c.p);
        const snapU = lt - tSnap, fallU = lt - tFall, hu = lt - tHit;
        g.save();
        g.translate(MX, 330); g.scale(z, z); g.translate(-MX, -330);
        g.drawImage(bg(), 0, 0, W, H);
        // 强拍时阳光略亮：只照进檐外的亮处，阴影里的山墙（歌词区）不变
        if (sunK > 1.001) {
          g.save(); g.beginPath(); g.rect(316, 0, W - 316, H); g.clip();
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = (sunK - 1) * 2.4; g.drawImage(dot('f2sun', '#fff0d4', 0.2), 330 - 560, 470 - 440, 1120, 880);
          g.restore();
        }
        // 最长那根的影子（画面坐标）：坠落时朝落点移过去、越来越短，落地时与冰相遇
        {
          const fk = fallU > 0 ? clamp(Math.min(1, 0.5 * GM * fallU * fallU / Math.max(1, HY0 - TIPY - 3))) : 0;
          if (fk < 0.999 && hu < 0) {
            const x0 = M.xs + 20 + (snapU > 0 ? 2 : 0), y0 = SHB(M.xs), hx = sxOf(HITX), hy = (HY0) * ZI;
            const x = lerp(x0, hx, fk), y = lerp(y0, hy, fk);
            g.save(); g.beginPath(); g.moveTo(330, slabY(330)); g.lineTo(W, slabY(W)); g.lineTo(W, SHB(W) + 2); g.lineTo(380, SHB(380) + 2); g.closePath(); g.clip();
            g.fillStyle = 'rgba(58,82,118,0.3)';
            shadowFinger(g, x, y, 0.5 * M.L * ZI * (1 - fk), 0.42 * M.w * ZI * (1 - 0.6 * fk));
            g.restore();
          }
        }

        // ===== 檐口层（推近 ZI 倍） =====
        g.save();
        g.translate(MX, 0); g.scale(ZI, ZI); g.translate(-MX, 0);
        // 水滴落在石面上的深色湿印，慢慢淡去
        const D = drips(c);
        const mk = smooth(ramp(lt, CT(c, 0, 0.246) - 0.3, CT(c, 3, 1.426) + 1.2));   // 冰尖化短的进度
        const mb = smooth(ramp(lt, CT(c, 0, 0.246), CT(c, 3, 1.426) + 0.25));           // 冰尖变圆变钝（第1字起、第4字后不久完成）
        const shorten = (ic) => 1 - (6 * mk * ic.s) / ic.L;                              // 化短 6 px
        for (const dr of D) {
          const ic = ice[dr.k], sc = shorten(ic), [tx, ty] = tipPos(ic, sc, mb);
          const th = dr.t + Math.sqrt((2 * (ic.hit - ty)) / ic.G), u = lt - th;
          if (u < 0 || u > 3) continue;
          const a = 0.3 * smooth(u / 0.08) * (1 - smooth((u - 0.6) / 2.4));
          g.fillStyle = rgba('#2c3844', a);
          g.beginPath(); g.ellipse(tx, ic.hit + 1, (6 + 5 * smooth(u / 0.3)) * ic.s, (1.8 + 1.2 * smooth(u / 0.3)) * ic.s, 0, 0, TAU); g.fill();
        }
        g.drawImage(eave(), 0, 0, W, 170);

        // 其余冰棱：尖端在第1字到第4字之间化短、化圆
        for (const ic of ice) {
          if (ic.k === MAIN || !ic.vis) continue;
          drawIce(g, ic, ic.x - ic.w / 2 - 8, ic.ey - 1, shorten(ic), mb);
        }
        // 最长的一根
        const tex = icTex(M, true), tx0 = M.x - M.w / 2 - 8, tw = M.w + 16, th = M.L + 14;   // 断之前尖已化圆
        if (snapU <= 0) {
          drawIce(g, M, tx0, TOFF, 1, mb);
          const ck = smooth(ramp(lt, tCrack, tCrack + 0.5));
          if (ck > 0) drawCrack(g, ck);
        } else {
          const dy = 3 * (1 - Math.exp(-snapU / 0.035) * Math.cos(snapU * 38));
          const rot = ROT0 * (1 - Math.exp(-snapU / 0.05) * Math.cos(snapU * 30));
          // 残根：留在瓦口，不动；底下露出一窄条受光的断面
          g.save(); clipAbove(g); g.drawImage(tex, tx0, TOFF, tw, th); g.restore();
          linePath(g, CRACK, 1, 0, 0.9); g.strokeStyle = 'rgba(220,232,244,0.75)'; g.lineWidth = 1.5; g.stroke();
          linePath(g, CRACK, 1, 0, 0.2); g.strokeStyle = 'rgba(255,248,232,0.95)'; g.lineWidth = 0.8; g.stroke();
          g.strokeStyle = 'rgba(226,238,248,0.85)'; g.lineWidth = 1.5; g.lineCap = 'round';
          g.beginPath(); g.moveTo(PIV.x - 0.6, PIV.y - 0.5); g.lineTo(PIV.x - 0.6, PIV.y + Math.min(dy, 3) * 0.5); g.stroke();
          // 坠落段：落地前整根；落地那一刻碎开（之后只画碎块）
          if (hu < 0) {
            let fy = 0, frot = 0;
            if (fallU > 0) { fy = 0.5 * GM * fallU * fallU; frot = SPIN * fallU; }
            g.save();
            g.translate(PIV.x, PIV.y + dy + fy); g.rotate(rot + frot); g.translate(-PIV.x, -PIV.y);
            g.strokeStyle = 'rgba(226,238,248,0.85)'; g.lineWidth = 1.5;
            if (fallU <= 0) { g.beginPath(); g.moveTo(PIV.x - 0.6, PIV.y - 1.5); g.lineTo(PIV.x - 0.6, PIV.y + 0.5); g.stroke(); }
            g.save(); clipBelow(g); g.drawImage(tex, tx0, TOFF, tw, th); g.restore();
            linePath(g, CRACK, 1, 0, 0.4); g.strokeStyle = 'rgba(255,248,232,0.85)'; g.lineWidth = 0.9; g.stroke();
            g.restore();
          }
        }

        // 水滴：在冰尖慢慢鼓起，离开后加速下落，落地溅开
        const dt = dropTex();
        for (const dr of D) {
          const ic = ice[dr.k], sc = shorten(ic), [tx, ty] = tipPos(ic, sc, mb);
          const grow = smooth(ramp(lt, dr.t - 0.9, dr.t)), u = lt - dr.t, s = ic.s;
          if (u < 0) {
            if (grow > 0.01) { const q = (0.35 + 0.65 * grow) * 0.62 * s; g.globalAlpha = grow; g.drawImage(dt, tx - 8 * q, ty - 2, 16 * q, 20 * q); g.globalAlpha = 1; }
            continue;
          }
          const yy = ty + 0.5 * ic.G * u * u, tLand = Math.sqrt((2 * (ic.hit - ty)) / ic.G);
          if (u < tLand) {
            const st = Math.min(1.7, 1 + u * 1.2);
            g.drawImage(dt, tx - 4.8 * s, yy - 2, 9.6 * s, 12 * s * st);
            if (u < 0.5) { g.globalAlpha = 0.6 * (1 - u / 0.5); g.drawImage(glint(), tx - 7, yy + 3, 14, 14); g.globalAlpha = 1; }
          } else {
            const uh = u - tLand;
            if (uh < 0.3) {
              g.fillStyle = rgba('#f4f0e6', 0.9 * (1 - uh / 0.3));
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
          // 一团淡淡的冰雾托底
          const pk = smooth(hu / 0.08) * (1 - smooth((hu - 0.25) / 1.2));
          if (pk > 0.01) {
            const pr = 24 + 60 * easeOut(Math.min(1, hu / 0.8));
            const lift = 10 * easeOut(Math.min(1, hu / 0.5)) - 8 * smooth((hu - 0.5) / 1.2);
            g.globalAlpha = 0.4 * pk;
            g.drawImage(dot('f2powder', '#f8f6f0', 0.35), hx - pr * 1.3, HY0 - pr * 0.6 - lift, pr * 2.6, pr * 1.0);
            g.globalAlpha = 1;
          }
          // 碎块与冰碴按远近（着地点的 y）排序后再画
          const items = [];
          FRAGS.forEach((f, i) => { const p = fragAt(f, hu); items.push([HY0 + 0.35 * p.z, 0, f, p, i]); });
          for (const s of chips) { const u = hu - s.d; if (u >= 0) { const p = chipAt(s, u); items.push([HY0 + p.z * 0.35, 1, s, p]); } }
          items.sort((a, b) => a[0] - b[0]);
          const glints = [];
          for (const it of items) {
            if (it[1]) { drawChip(g, it[2], it[3], hx); continue; }
            const f = it[2], p = it[3], cc = drawFrag(g, f, p, it[4]);
            // 翻滚时某个角度正好把朝阳反射进镜头：一闪
            if (hu < T_REST + 0.1) { const gk = Math.pow(Math.max(0, Math.cos(2 * p.th + f.gp)), 14) * (1 - smooth((hu - T_REST) / 0.1)); if (gk > 0.05) glints.push([cc[0] - 2, cc[1] - 1, gk, 8 + f.len * 0.25]); }
          }
          // 冰粉
          const pw = dot('f2pw', '#fbf8f2', 0.4);
          for (const q of POWDER) {
            const u = hu - q.d; if (u <= 0) continue;
            const a = q.a * smooth(u / 0.05) * (1 - smooth((u - 0.15) / 0.6));
            if (a < 0.01) continue;
            const x = hx + q.dx * (1 - Math.exp(-u / 0.18)), y = HY0 - 2 - q.up * (1 - Math.exp(-u / 0.14)) + q.fall * u * u;
            g.globalAlpha = a; g.drawImage(pw, x - q.r * 2, y - q.r * 2, q.r * 4, q.r * 4);
          }
          g.globalAlpha = 1;
          // 撞击瞬间一点柔和的闪光（约 0.1 s）
          if (hu < 0.12) { g.globalAlpha = 0.8 * (1 - hu / 0.12); g.drawImage(glint(), hx - 12, HY0 - 14, 24, 24); g.globalAlpha = 1; }
          for (const [x, y, a, s] of glints) { g.globalAlpha = Math.min(1, a); g.drawImage(glint(), x - s / 2, y - s / 2, s, s); }
          g.globalAlpha = 1;
        }

        // 冰棱上的闪光点（朝阳，强拍略亮）
        for (let i = 0; i < 6; i++) {
          const ic = ice[[2, 4, 6, 10, 12, 9][i]];
          const a = (0.4 + 0.35 * Math.sin(lt * (1.1 + 0.3 * i) + i * 2)) * sunK;
          const yy = ic.ey + ic.L * (0.22 + 0.14 * (i % 3)), sz = 18 * ic.s;
          g.globalAlpha = clamp(a); g.drawImage(glint(), ic.x - icRad(ic, 0.22 + 0.14 * (i % 3)) * 0.8 + axOff(ic, ic.L * (0.22 + 0.14 * (i % 3))) - sz / 2, yy - sz / 2, sz, sz); g.globalAlpha = 1;
        }
        g.restore();

        // 晨光里慢慢飘着的冰晶微尘：一闪一闪（每颗出现、消失都有 ≥ 0.8 s 的渐变），近日一侧多而亮
        for (let i = 0; i < 34; i++) {
          const per = 8 + 5 * h2(i, 301), ph = (((lt + h2(i, 302) * per) % per) + per) % per / per;
          const x = 380 + h2(i, 303) * 860 + 18 * Math.sin(lt * 0.35 + i * 1.3) + 26 * ph, y = 150 + h2(i, 304) * 430 + 60 * ph;
          const life = smooth(ph / 0.1) * (1 - smooth((ph - 0.88) / 0.12));
          const tw = Math.pow(0.5 + 0.5 * Math.sin(lt * (1.1 + 1.4 * h2(i, 305)) + i * 2.1), 5);
          const a = life * tw * 0.7 * (0.45 + 0.55 * (1 - clamp((x - 380) / 860)));
          if (a < 0.02) continue;
          const s = 6 + 5 * h2(i, 306);
          g.globalAlpha = a; g.drawImage(glint(), x - s / 2, y - s / 2, s, s);
        }
        g.globalAlpha = 1;
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
    // 前景挂丝巾的枯荷梗：离镜头 4 m（水面线 y≈591），节点离水 0.5 m，上段 0.7 m
    const SX = -1.55, SZ = 4.0, NODE = 0.5, UL = 0.7;
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
      gb.addColorStop(0, '#a89a88'); gb.addColorStop(0.55, '#8f8070'); gb.addColorStop(1, '#645a4e');
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
      // 暮色：整体压暗、偏冷（画面里只剩红丝巾一处彩色）；天顶略暗于地平线，过渡平稳
      g.globalCompositeOperation = 'multiply';
      const dk = g.createLinearGradient(0, 0, 0, H);
      dk.addColorStop(0, '#a9b3c2'); dk.addColorStop(0.38, '#b7c0cd'); dk.addColorStop(1, '#a8b1bf');
      g.fillStyle = dk; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
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
        if (st.sn) { g.fillStyle = 'rgba(176,185,197,0.85)'; g.fillRect(lerp(st.x0, ex, 0.4) - 0.7, lerp(st.y0, ey, 0.4) - 1.6, 1.6, 1.2); }
        return;
      }
      const l = Math.hypot(st.tx, st.ty) || 1, ux = st.tx / l, uy = st.ty / l;
      const y1 = st.y0 + st.L - lift, x1 = st.x0 + 6 * ux + st.sw;
      g.strokeStyle = rgba('#2e2925', st.a); g.lineWidth = st.w;
      g.beginPath(); g.moveTo(st.x0, st.y0); g.bezierCurveTo(st.x0 + ux * 9 + st.bow, st.y0 + uy * 9 + 4, x1 - st.sw * 0.2 - st.bow, st.y0 + st.L * 0.45, x1, y1); g.stroke();
      if (st.sn) { g.fillStyle = 'rgba(176,185,197,0.8)'; for (let m = 1; m < 4; m++) { const v = m / 4.5; g.fillRect(lerp(st.x0 + ux * 6, x1, v) - 0.6, st.y0 + (y1 - st.y0) * v * v, 1.3, 1.3); } }
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
          q.strokeStyle = 'rgba(178,187,199,0.92)'; q.lineWidth = Math.max(0.8, lb.w * 0.45);
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
      const puff = dot('f6puffN', '#b8c1cd', 0.25), grain = dot('f6grainN', '#c0c8d3', 0.5);
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

    // ---- 丝巾那根荷梗 ----
    // 下段从水里直立到节点（离水 0.5 m）；上段 0.7 m 是一道向右拱起、梢头已低垂的弧，丝巾搭在拱顶稍过一点、坡度约 16° 处（静摩擦挂得住）。
    // 第46句第3字后弧顶慢慢积雪。第9字起积雪压弯：上段绕节点向下转约 34°，同时越近梢头越弯（1.0 s 缓入缓出），弧上每一点都只往下转；
    // 丝巾处坡度过了 30° 才开始顺梗下滑（重力切向分量减动摩擦），过梢后落进水里；积雪在坡度过了 35° 的那一段成团滑落；
    // 丝巾和弧顶那团雪都离开后，梗略回弹（梢头约 6°，约 1.5 Hz，阻尼）。
    // 上段弧：θ(σ) = th0 + b·σ²（度，自竖直向右量，σ = s/UL），越近梢头越弯
    const TH0A = 60, BA = 80, TH0B = 94, BB = 84, NS = 24, TB = 1.0;
    const thDeg = (sg, e) => lerp(TH0A, TH0B, e) + lerp(BA, BB, e) * sg * sg;
    function arcAt(e, s) {
      const n = Math.max(1, Math.ceil((s / UL) * NS * 2));
      let X = SX + 0.015, Y = NODE;
      for (let i = 0; i < n; i++) { const th = (thDeg((((i + 0.5) / n) * s) / UL, e) * Math.PI) / 180; X += (Math.sin(th) * s) / n; Y += (Math.cos(th) * s) / n; }
      return [X, Y, (thDeg(s / UL, e) * Math.PI) / 180];
    }
    const thAt = (s, e) => (thDeg(s / UL, e) * Math.PI) / 180;
    const bendLoad = (t) => smooth(t / TB);                            // 压弯进度（只增不减）
    // 回弹：卸载后的阶跃响应（无初速度，过冲一次后停住）
    const ZS = 0.35, WD = TAU * 1.5, WN = WD / Math.sqrt(1 - ZS * ZS), KB = 0.16;
    const springStep = (u) => (u <= 0 ? 0 : 1 - Math.exp(-ZS * WN * u) * (Math.cos(WD * u) + ((ZS * WN) / WD) * Math.sin(WD * u)));
    // 丝巾沿弧滑动：坡度过 30°（静摩擦 0.58）才起步，动摩擦 0.28
    const MU = 0.28, MUS = 0.58, G9 = 9.8;
    function slide(s0, tEnd) {
      let s = s0, v = 0, moving = false, tS = null;
      const dt = 0.002;
      for (let t = 0; t < tEnd && t < 2.5; t += dt) {
        const a = thAt(s, bendLoad(t)), along = -Math.cos(a), nrm = Math.abs(Math.sin(a));
        if (!moving && along > MUS * nrm) { moving = true; tS = t; }
        if (moving) { v = Math.max(0, v + G9 * (along - MU * nrm) * dt); s += v * dt; }
        if (s >= UL) return { s: UL, v, tLv: t, tS };
      }
      return { s, v, tLv: null, tS };
    }
    // 离梢后的抛体：返回入水时刻（相对弯曲起点）
    function leaveOf(st) {
      const tp = arcAt(bendLoad(st.tLv), UL), vx = st.v * Math.sin(tp[2]), vy = st.v * Math.cos(tp[2]);
      const tf = (vy + Math.sqrt(vy * vy + 2 * G9 * tp[1])) / G9;
      return { x0: tp[0], y0: tp[1], vx, vy, tIn: st.tLv + tf };
    }
    // ---- 弧上积雪：按静止时的坡度积起（坡度 < 12° 最厚，> 38° 积不住），弧顶附近堆成一团；三段一组，坡度过 35° 时整组滑落 ----
    const SNOWSEG = (() => {
      const out = [];
      for (let j = 1; j <= NS; j++) {
        const sg = (j - 0.5) / NS, slope = Math.abs(thDeg(sg, 0) - 90);
        const flat = smooth((38 - slope) / 26);
        const cap = flat * (2.2 * (0.8 + 0.4 * A.noise1(j / 2.3, 57)) + 5.2 * Math.exp(-Math.pow((sg - 0.6) / 0.11, 2)));
        out.push({ j, sg, cap });
      }
      const groups = [];
      for (let i = 0; i < out.length; i += 3) {
        const grp = out.slice(i, i + 3), sg = grp[1].sg;
        // 本组滑落的时刻：这一段的坡度第一次超过 35°（压弯进度单调，二分即可）
        let tR = null;
        if (thDeg(sg, 1) - 90 > 35) { let lo = 0, hi = TB; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (thDeg(sg, bendLoad(m)) - 90 > 35) hi = m; else lo = m; } tR = (lo + hi) / 2; }
        const mass = grp.reduce((a, q) => a + q.cap, 0);
        for (const q of grp) q.g = groups.length;
        groups.push({ j0: grp[0].j, j1: grp[grp.length - 1].j, sg, tR, mass });
      }
      return { segs: out, groups };
    })();
    // 弧顶那团雪（最重的一组）离开的时刻：与丝巾离梢的时刻一起决定何时卸载回弹
    const LUMP = SNOWSEG.groups.reduce((a, q) => (q.mass > a.mass ? q : a), SNOWSEG.groups[0]);
    // 起始挂点：二分求出使丝巾在第11字前 0.03 s 入水的位置（纯函数，按目标时长缓存）
    const calib = new Map();
    function scarfCal(dT) {
      const key = Math.round(dT * 1000);
      if (calib.has(key)) return calib.get(key);
      let lo = 0.68 * UL, hi = 0.86 * UL;
      for (let i = 0; i < 26; i++) {
        const m = (lo + hi) / 2, st = slide(m, 2.5);
        if (st.tLv == null) { lo = m; continue; }
        if (leaveOf(st).tIn > dT - 0.03) lo = m; else hi = m;
      }
      const s0 = (lo + hi) / 2, st = slide(s0, 2.5), lv = st.tLv == null ? null : leaveOf(st);
      const tRel = Math.max(st.tLv == null ? TB : st.tLv, LUMP.tR == null ? 0 : LUMP.tR);
      const out = { s0, tLv: st.tLv, tS: st.tS, lv, tRel };
      calib.set(key, out);
      return out;
    }
    // 实际弯曲：压弯进度减去卸载后的回弹
    const bendAt = (cal, t) => bendLoad(t) - KB * springStep(t - cal.tRel);
    // 第 tr 秒（相对弯曲起点）丝巾搭在梗上的那一点 D（世界坐标）与它的速度
    function drapeAt(cal, tr) {
      if (tr <= 0) return { D: arcAt(0, cal.s0), on: true, s: cal.s0 };
      if (cal.tLv == null || tr < cal.tLv) { const st = slide(cal.s0, tr); return { D: arcAt(bendLoad(tr), st.s), on: true, s: st.s, v: st.v }; }
      const lv = cal.lv, tau = Math.min(tr, lv.tIn) - cal.tLv;
      return { D: [lv.x0 + lv.vx * tau, Math.max(0, lv.y0 + lv.vy * tau - 0.5 * G9 * tau * tau), 0], on: false, s: UL };
    }
    // 两条丝巾尾：从搭点垂下；触到水面的部分平铺在水上、皱缩着向外摊开
    // 后面一条（先画、偏暗）与前面一条大部分重叠，像一块布搭在梗上垂下的两端；落到水面的部分都顺着滑落的方向（向右）铺开
    const TAILS = [
      { len: 0.24, off: 0.011, drift: 0.022, dir: [0.93, 0.36], w: 0.05, back: true, ph: 1.3 },
      { len: 0.3, off: -0.004, drift: -0.012, dir: [0.8, -0.6], w: 0.056, back: false, ph: 0.2 },
    ];
    const BEND = 0.035;                                  // 贴近水面的一段布顺势弯向铺开的方向（圆角，不是直角）
    // mo：运动状态 { vx 搭点横向速度, sp 速率, t 时间, spread 入水后摊开程度 }
    function tailPts(D, T, delta, mo) {
      const hx = Math.sin(delta), hy = Math.cos(delta), lc = D[1] > 0 ? D[1] / hy : 0, pts = [];
      const sway = (l) => 0.006 * Math.sin((l / T.len) * 3.2 + T.ph) * (l / T.len);   // 布面轻微的 S 形
      // 运动时：下端落在后面（与速度成正比），并有 ±10° 以内、沿布向下传的抖动；静止时没有
      const fk = clamp(mo.sp / 1.4);
      const lag = (l) => -0.05 * clamp(mo.vx / 1.5, -1, 1) * (l / T.len) * (l / T.len) * (T.len / 0.3);
      const flut = (l) => 0.17 * l * fk * 0.5 * Math.sin(mo.t * 13 - (l / T.len) * 5 + T.ph * 3);
      // 离梢下落时：上端先落、下端已贴着水，中间的布向前（运动方向）鼓出一个弧，不是一根直条
      const bil = (l) => (mo.fall && lc > 1e-3 ? 0.032 * Math.sin(Math.PI * clamp(l / lc)) * (T.back ? 0.8 : 1) : 0);
      const bend = (l) => { const b = Math.min(BEND, lc), q = l - (lc - b); return q > 0 && b > 1e-4 ? (0.5 * q * q) / b : 0; };
      const comp = 0.42 + 0.22 * mo.spread;              // 入水后布吸了水慢慢舒开
      const at = (l) => {
        if (l <= lc) { const bb = bend(l); return [D[0] + T.off + hx * l + T.drift * (l / T.len) + sway(l) + lag(l) + flut(l) + bil(l) + T.dir[0] * bb, D[1] - hy * l, SZ + T.dir[1] * bb, -1, l / T.len]; }
        const bl = 0.5 * Math.min(BEND, lc);
        const cx = D[0] + T.off + hx * lc + T.drift * (lc / T.len) + sway(lc) + lag(lc) + flut(lc) + T.dir[0] * bl, cz = SZ + T.dir[1] * bl, e = l - lc, ee = e * comp, zz = 0.012 * Math.sin(e * 38 + T.ph);
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
    // 画一条丝巾尾（mirror：只画悬空部分的倒影）；tw：布面翻转（宽度随抖动收放）
    function drawTail(g, T, pts, wetAll, mirror, alpha, dy, pinch, tw) {
      const red = '#b52a34';
      const E = pts.map((p, i) => {
        // 搭点处收拢，往下渐宽；离开梢头下落时上端揪成一团
        const lying = p[3] >= 0, twk = lying ? 1 : 1 - tw * (0.5 - 0.5 * Math.cos(p[4] * 5 + T.ph * 2));
        const fl = ((pinch ? 0.45 : 0.72) + (pinch ? 0.6 : 0.36) * Math.min(1, p[4])) * (lying ? 1.1 : twk);
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

    function stemGeom(e) {
      const base = [SX, 0], node = [SX + 0.015, NODE], arc = [];
      for (let j = 0; j <= NS; j++) arc.push(arcAt(e, (j / NS) * UL));
      return { base, node, arc };
    }
    // 梗的中线（画面坐标）：下段 4 段直线 + 上段 NS 段弧；同一色、粗细从 3.6 渐到梢头 2.4 px
    function stemPts(geo, mirror) {
      const sg = mirror ? -1 : 1, pts = [P(geo.base[0], 0, SZ)];
      const n0 = P(geo.node[0], sg * geo.node[1], SZ);
      for (let i = 1; i <= 4; i++) pts.push([lerp(pts[0][0], n0[0], i / 4), lerp(pts[0][1], n0[1], i / 4)]);
      for (let j = 1; j <= NS; j++) { const a = geo.arc[j]; pts.push(P(a[0], sg * a[1], SZ)); }
      return pts;
    }
    const stemW = (i) => (i <= 4 ? 3.6 - 0.1 * i : lerp(3.2, 2.4, (i - 4) / NS));
    function drawStemFG(g, geo, mirror, col) {
      const pts = stemPts(geo, mirror), n = pts.length - 1;
      g.fillStyle = col;
      blade(g, pts, (v) => stemW(v * n));
      g.fill();
      const n0 = pts[4];
      g.beginPath(); g.ellipse(n0[0], n0[1], 2.6, 2, 0, 0, TAU); g.fill();       // 节
      if (!mirror) {
        // 朝天的一侧受一线天光：整根梗在暗水前都看得清
        g.strokeStyle = 'rgba(176,186,198,0.55)'; g.lineWidth = 0.8; g.lineCap = 'round';
        g.beginPath();
        for (let i = 4; i <= n; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
          let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (ny > 0) { nx = -nx; ny = -ny; }
          const o = stemW(i) * 0.5 - 0.3, x = pts[i][0] + nx * o, y = pts[i][1] + ny * o;
          i > 4 ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }
    // 弧上一段（j0..j1）积雪的外形：底边贴着梗的上缘，向上鼓起 cap·grow 厚
    function snowStrip(pts, j0, j1, grow, dx, dy) {
      const n = pts.length - 1, top = [], bot = [];
      for (let j = j0 - 1; j <= j1; j++) {
        const i = 4 + j, a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
        let nx = b[1] - a[1], ny = -(b[0] - a[0]); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (ny > 0) { nx = -nx; ny = -ny; }
        // 段与段之间的厚度取两侧平均，组两端收成零，外形是圆润的一条
        const c0 = j >= 1 ? SNOWSEG.segs[j - 1].cap : 0, c1 = j < NS ? SNOWSEG.segs[j].cap : 0;
        const edge = j === j0 - 1 || j === j1 ? 0.35 : 1, th = 0.5 * (c0 + c1) * grow * edge;
        const o = stemW(i) * 0.5 - 0.4;
        bot.push([pts[i][0] + nx * o + dx, pts[i][1] + ny * o + dy]);
        top.push([pts[i][0] + nx * (o + th) + dx, pts[i][1] + ny * (o + th) + dy]);
      }
      return { top, bot };
    }
    const SNOWC = '#aab3bf', SNOWHI = '#c6ced8';         // 暮色里的雪（偏冷、偏暗）

    function drawScarfStem(g, c, lt) {
      const tRed = CT(c, 8, 3.904), tMo = CT(c, 10, 4.744);
      const cal = scarfCal(tMo - tRed);
      const tr = lt - tRed, e = bendAt(cal, tr);
      const geo = stemGeom(e);
      const dr = drapeAt(cal, tr), D = dr.D;
      const tIn = cal.lv ? cal.lv.tIn : 99, u = tr - tIn;
      const dPrev = drapeAt(cal, tr - 0.04).D, vx = (D[0] - dPrev[0]) / 0.04, vy = (D[1] - dPrev[1]) / 0.04;
      const sp = u < 0 ? Math.hypot(vx, vy) : 0;
      const delta = clamp(-0.3 * vx, -0.35, 0.35);
      const wetAll = u > 0 ? smooth(u / 0.7) : 0, sink = u > 0 ? smooth((u - 0.6) / 1.6) : 0, alpha = 1 - sink, sdy = 4 * sink;
      const spread = u > 0 ? smooth(u / 0.6) : 0;
      const mo = { vx: u < 0 ? vx : 0, sp, t: lt, spread, fall: !dr.on && u < 0 };
      const land = cal.lv ? [cal.lv.x0 + cal.lv.vx * (tIn - cal.tLv), SZ] : [SX + 0.5, SZ];
      // 积雪：开场就有一层薄雪，第3字后慢慢积厚，第9字前积满
      const grow = 0.3 + 0.7 * smooth(ramp(lt, CT(c, 2, 0.964) + 0.6, tRed - 0.1));

      // 倒影（只在水面上）：梗与悬空的丝巾，偏暗
      g.save(); clipWater(g);
      g.globalAlpha = 0.7; drawStemFG(g, geo, true, '#211e1d'); g.globalAlpha = 1;
      if (u < 0) for (const T of TAILS) drawTail(g, T, tailPts(D, T, delta, mo), 0, true, 0.45, 0, false, 0);
      // 入水后：两条尾平铺在水上，中间搭过梗的那一折皱成一小团，随布吸水慢慢舒开
      if (u >= 0 && alpha > 0.01) {
        const col = mix(mix('#b52a34', '#4a1016', 0.3 + wetAll * 0.55), '#1d1f21', sink * 0.5);
        const rr = A.rng(4673), k0 = 0.6 + 0.4 * spread;
        g.fillStyle = rgba(col, alpha);
        g.beginPath();
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU, rad = (0.026 + 0.018 * rr()) * k0;
          const q = P(land[0] + 0.008 + Math.cos(a) * rad * 1.5, 0, land[1] + Math.sin(a) * rad * 0.9 - 0.004);
          i ? g.lineTo(q[0], q[1] + sdy) : g.moveTo(q[0], q[1] + sdy);
        }
        g.closePath(); g.fill();
        g.strokeStyle = rgba(mix(col, '#140608', 0.45), alpha * 0.7); g.lineWidth = 0.8;
        for (let m = 0; m < 3; m++) {
          const q0 = P(land[0] - 0.02 + 0.012 * m, 0, land[1] + 0.012 - 0.006 * m), q1 = P(land[0] + 0.012 + 0.014 * m, 0, land[1] - 0.004 * m);
          g.beginPath(); g.moveTo(q0[0], q0[1] + sdy); g.quadraticCurveTo((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 - 1 + sdy, q1[0], q1[1] + sdy); g.stroke();
        }
      }
      // 涟漪：一圈从入水点向外扩散、变淡
      if (u > 0 && u < 3.4) {
        const R = 0.04 + 0.22 * u, k = F / SZ, rx = k * R, ry = (k * R * HC) / SZ, [lx, ly] = P(land[0], 0, land[1]);
        const a = 0.34 * (1 - smooth(u / 3.0)) * smooth(u / 0.12);
        g.strokeStyle = rgba('#8a939c', a * 0.5); g.lineWidth = 2.6;
        g.beginPath(); g.ellipse(lx, ly + 0.5, rx, ry, 0, 0, TAU); g.stroke();
        g.strokeStyle = rgba('#9ea7b1', a); g.lineWidth = 1;
        g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, 0, TAU); g.stroke();
        g.strokeStyle = rgba('#08090a', a * 0.7); g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(lx, ly + 2.2, rx * 0.97, ry * 0.92, 0, 0, TAU); g.stroke();
      }
      g.restore();

      // 梗入水处：暗环与淡亮水线
      { const b = P(SX, 0, SZ); g.fillStyle = 'rgba(16,18,20,0.35)'; g.beginPath(); g.ellipse(b[0], b[1] + 0.5, 6, 1.3, 0, 0, TAU); g.fill(); }
      drawStemFG(g, geo, false, '#4a3e35');
      { const b = P(SX, 0, SZ); g.strokeStyle = 'rgba(160,170,180,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(b[0] - 4, b[1]); g.lineTo(b[0] + 4, b[1]); g.stroke(); }

      // 弧上积雪：还挂着的各组跟着梗走；坡度过 35° 的那组沿梗的切向滑出、受重力落下，碰水即化
      const pts = stemPts(geo, false);
      const fillStrip = (S, a) => {
        g.globalAlpha = a; g.fillStyle = SNOWC;
        g.beginPath(); S.bot.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
        for (let i = S.top.length - 1; i >= 0; i--) g.lineTo(S.top[i][0], S.top[i][1]);
        g.closePath(); g.fill();
        g.strokeStyle = SNOWHI; g.lineWidth = 0.7;
        g.beginPath(); S.top.forEach((p, i) => (i ? g.lineTo(p[0], p[1] - 0.2) : g.moveTo(p[0], p[1] - 0.2))); g.stroke();
        g.globalAlpha = 1;
      };
      for (const grp of SNOWSEG.groups) {
        if (grp.mass < 0.05) continue;
        if (grp.tR == null || tr < grp.tR) { fillStrip(snowStrip(pts, grp.j0, grp.j1, grow, 0, 0), 0.97); continue; }
        // 滑落：以脱离时刻的位置为起点，初速沿切向向下 0.35 m/s，之后受重力
        const tau = tr - grp.tR, e0 = bendLoad(grp.tR), p0 = arcAt(e0, grp.sg * UL), th = p0[2];
        const vX = 0.35 * Math.sin(th), vY = 0.35 * Math.cos(th);
        const dX = vX * tau, dY = vY * tau - 0.5 * G9 * tau * tau, Y = p0[1] + dY;
        if (Y < -0.01) continue;
        const k = F / SZ, gp = stemPts(stemGeom(e0), false);
        const S = snowStrip(gp, grp.j0, grp.j1, grow, dX * k, -dY * k);
        fillStrip(S, 0.97 * clamp((Y + 0.01) / 0.025));
      }
      // 搭在丝巾那一折顶上的薄雪：丝巾起步滑动时被抖落
      const foldTop = (dp, th) => { const tx = Math.sin(th), ty = -Math.cos(th), nx = ty, ny = -tx, up = ny < 0 ? 1 : -1; return [dp[0] + nx * up * 3.2, dp[1] + ny * up * 3.2, Math.atan2(ty, tx)]; };
      const tS = cal.tS == null ? 99 : cal.tS;
      if (tr >= tS) {
        const tau = tr - tS, d0 = drapeAt(cal, tS), f0 = foldTop(P(d0.D[0], d0.D[1], SZ), arcAt(bendLoad(tS), d0.s)[2]);
        const Y = d0.D[1] + 0.012 - 0.5 * G9 * tau * tau;
        if (Y > -0.005) {
          const q = [f0[0] + 0.15 * (F / SZ) * tau, f0[1] + 0.5 * G9 * tau * tau * (F / SZ)];
          g.globalAlpha = 0.95 * clamp((Y + 0.005) / 0.02); g.fillStyle = SNOWC;
          g.beginPath(); g.ellipse(q[0], q[1], 0.55 * 0.03 * (F / SZ) * grow, 1.6, f0[2], 0, TAU); g.fill(); g.globalAlpha = 1;
        }
      }

      // 丝巾：两条尾 + 搭在梗上的一折
      if (alpha > 0.01) {
        const tw = clamp(sp / 1.4) * 0.35;
        for (const T of TAILS) drawTail(g, T, tailPts(D, T, delta, mo), wetAll, false, alpha, u >= 0 ? sdy : 0, !dr.on, tw);
        if (u < 0 && dr.on) {
          // 搭在梗上的一折：布顺着梗面拱起、两侧垂下（像毛巾搭在杆上），离开梢头就没有了
          const dp = P(D[0], D[1], SZ), th = arcAt(bendLoad(Math.max(0, tr)), dr.s)[2];
          const tx = Math.sin(th), ty = -Math.cos(th), nx = ty, ny = -tx, hw = 0.03 * (F / SZ), up = ny < 0 ? 1 : -1;
          const s1 = [dp[0] - tx * hw + nx * up * 1.2, dp[1] - ty * hw + ny * up * 1.2], s2 = [dp[0] + tx * hw + nx * up * 1.2, dp[1] + ty * hw + ny * up * 1.2];
          const top = [dp[0] + nx * up * 3.2, dp[1] + ny * up * 3.2], tw2 = 0.026 * (F / SZ);
          g.fillStyle = '#bd333c';
          g.beginPath(); g.moveTo(s1[0], s1[1]); g.quadraticCurveTo(top[0], top[1], s2[0], s2[1]);
          g.quadraticCurveTo(dp[0] + tw2 * 0.9, dp[1] + 2, dp[0] + tw2 * 0.75, dp[1] + 7);
          g.lineTo(dp[0] - tw2 * 0.85, dp[1] + 7); g.quadraticCurveTo(dp[0] - tw2 * 0.95, dp[1] + 2, s1[0], s1[1]); g.closePath(); g.fill();
          // 拱顶受天光的一线
          g.strokeStyle = 'rgba(214,112,116,0.5)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(s1[0], s1[1]); g.quadraticCurveTo(top[0], top[1], s2[0], s2[1]); g.stroke();
          if (tr < tS) {
            const ft = foldTop(dp, th);
            g.fillStyle = rgba(SNOWC, 0.95); g.beginPath(); g.ellipse(ft[0], ft[1] + 0.4, hw * 0.55 * grow, 1.6, ft[2], 0, TAU); g.fill();
          }
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
      const dotS = dot('f6flakeN', '#c9d1db', 0.45);
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
      text: '#eef1f4', shadow: 'rgba(14,16,22,0.85)', accent: '#e2606a', bloom: 0.18,
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
