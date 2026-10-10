/* 第三版镜头组 fg1：i2_river, i3_whitehair, o2_depart（前奏两镜、尾声一镜，均无歌词） */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit, SIL = XYT.sil;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;
  const cosE = (u) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u));

  // ---------------- 通用工具 ----------------
  // 设备分辨率的临时画布：每次使用前清空，不在帧间保留内容
  const scratchMap = new Map();
  function scratch(key, w, h, k) {
    const S = SS() * (k || 1);
    const pw = Math.max(1, Math.ceil(w * S)), ph = Math.max(1, Math.ceil(h * S));
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
  // 建缓存用：在与目标同尺寸的临时画布里按目标当前的变换画，再（可带模糊）贴回；ctx.filter 只在这里用
  function blurInto(g, w, h, blur, fn, op, alpha) {
    const m = g.getTransform();
    const t = document.createElement('canvas');
    t.width = g.canvas.width; t.height = g.canvas.height;
    const tg = t.getContext('2d'); tg.setTransform(m);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = op || 'source-over';
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (blur > 0) g.filter = `blur(${(blur * m.a).toFixed(2)}px)`;
    g.drawImage(t, 0, 0);
    g.restore();
  }
  // 多层平滑噪声，范围约 −1..1
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.13; }
    return (s / n) * 2;
  };
  // 周期噪声（周期 P 像素，用整数频率正弦叠加），给可横向平铺的雾带
  function pnoise(x, P, seed, n) {
    let s = 0, tot = 0;
    for (let k = 1; k <= (n || 6); k++) {
      const a = 1 / Math.pow(k, 0.9);
      s += a * Math.sin((TAU * k * x) / P + h2(k, seed) * TAU);
      tot += a;
    }
    return s / tot;
  }
  // 圆缓的丘陵脊线：高斯峰取平滑最大，加细碎起伏
  function ridge(bumps, base, seed, rough) {
    return (x) => {
      // 各峰取 4 次幂范数：峰间平滑过渡，平地处高度为 0
      let s4 = 0;
      for (const b of bumps) { const u = (x - b[0]) / b[2], v = b[1] * Math.exp(-u * u); s4 += v * v * v * v; }
      let hh = Math.pow(s4, 0.25);
      hh += rough * (fbm(x / 70, seed, 3) * 3 + fbm(x / 17, seed + 9, 2) * 1.1) * Math.min(1, hh / 30);
      return base - Math.max(0, hh);
    };
  }
  function ridgePath(g, f, x0, x1, base, step) {
    g.beginPath();
    g.moveTo(x0, base);
    for (let x = x0; x <= x1; x += step || 3) g.lineTo(x, Math.min(base, f(x)));
    g.lineTo(x1, Math.min(base, f(x1))); g.lineTo(x1, base); g.closePath();
  }
  // 可横向平铺的雾带贴图：宽 P、高 h，竖向软边，横向团块
  function mistBand(key, P, h, seed, col, lumpy, base) {
    return K.cache(key, P, h, 0.5, (g) => {
      const sc = g.getTransform().a;
      const pw = Math.round(P * sc), ph = Math.round(h * sc);
      const img = g.createImageData(pw, ph), d = img.data;
      const [r0, g0, b0] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
      const cols = new Float32Array(pw), cen = new Float32Array(pw), wid = new Float32Array(pw);
      for (let px = 0; px < pw; px++) {
        const x = px / sc;
        cols[px] = clamp((base == null ? 0.62 : base) + lumpy * 0.55 * pnoise(x, P, seed, 7));
        cen[px] = 0.5 + 0.12 * pnoise(x, P, seed + 3, 4);
        wid[px] = 0.3 + 0.08 * pnoise(x, P, seed + 5, 5);
      }
      for (let py = 0; py < ph; py++) {
        const v = py / ph;
        for (let px = 0; px < pw; px++) {
          const u = (v - cen[px]) / wid[px];
          const a = cols[px] * Math.exp(-u * u * 1.6);
          const i = (py * pw + px) * 4;
          d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = Math.min(255, a * 255);
        }
      }
      g.putImageData(img, 0, 0);
    });
  }
  // 高空淡云：几道横向拉长的极淡水墨晕（建缓存时用，带模糊）
  function cloudWash(g, bands, seed, col) {
    blurInto(g, W, H, 9, (tg) => {
      const r = rng(seed);
      for (const [cx, cy, w, h, a] of bands) {
        for (let i = 0; i < 9; i++) {
          const x = cx + (r() - 0.5) * w * 0.8, y = cy + (r() - 0.5) * h * 0.6;
          const gr = tg.createRadialGradient(x, y, 0, x, y, w * (0.25 + r() * 0.2));
          gr.addColorStop(0, rgba(col, a * (0.5 + r() * 0.5))); gr.addColorStop(1, rgba(col, 0));
          tg.save(); tg.translate(x, y); tg.scale(1, (h / w) * (0.8 + r() * 0.6)); tg.translate(-x, -y);
          tg.fillStyle = gr; tg.fillRect(x - w, y - w, 2 * w, 2 * w); tg.restore();
        }
      }
    });
  }
  // 平铺雾带：向 dir 方向以 v 像素/秒漂移
  function drawBand(g, tex, P, y, h, t, v, dir, alpha) {
    if (alpha <= 0.003) return;
    let off = ((dir * v * t) % P + P) % P; // 0..P
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * alpha;
    for (let x = off - P; x < W; x += P) g.drawImage(tex, x, y, P, h);
    g.globalAlpha = a0;
  }

  // ============================================================
  // i2_river 一叶孤舟：晨雾大江，小舟自左向右，船尾船夫撑篙，船头坐着白发归人
  // ============================================================
  (function () {
    const WY = 552; // 船处水面线
    const HZ = 420; // 对岸水天交界
    const SUN = [1000, 300];
    const LEN = 150, FH = 46;
    const DECK = WY - LEN * 0.03; // 船板面（干舷 0.03 船长）
    const BMX = -0.355 * LEN, OLDX = 0.27 * LEN; // 船夫、老者在船上的位置（相对船中）
    const RIM = '#f7d9a6';
    const BODY = '#1f232a';
    // 撑篙周期 2 秒：p∈[0.23,0.62]（约 0.8 s）篙尖钉在河床上推船，其余时间收篙、前送、再下篙
    const PA = 0.23, PB = 0.62, TB0 = 0.35;
    const V0 = 45, DV = 7;
    const X0 = 280;
    const BED = WY + 32; // 河床（篙尖着点，水深约 1.2 m）
    const LP = 108; // 篙长（约 4 m，推到头时手上方还留一截）
    // 收篙：前 60% 把篙沿篙身抽到水面，篙身先拖在船后、30% 之后才向前摆
    const UM = 0.6, SWA = 0.3;
    const swing = (u) => cosE((u - SWA) / (1 - SWA));
    // 船速 = 45 ± 7：推送阶段余弦加速，滑行阶段余弦减速；位移是速度的解析积分，平均正好 45 px/s
    function boatX(lt) {
      const tb = lt + TB0, p = (((tb / 2) % 1) + 1) % 1;
      const q = p < PA ? p + 1 : p;
      let I;
      if (q < PB) { const T = (PB - PA) * 2, u = (q - PA) / (PB - PA); I = (-T * Math.sin(Math.PI * u)) / Math.PI; }
      else { const T = (PA + 1 - PB) * 2, u = (q - PB) / (PA + 1 - PB); I = (T * Math.sin(Math.PI * u)) / Math.PI; }
      return X0 + V0 * lt + DV * I;
    }
    // 与 XYT.sil 船夫撑篙循环一致的上手位置（单位坐标）与篙角
    const keys = (p, Kf) => {
      for (let i = 0; i < Kf.length - 1; i++) { const a = Kf[i], b = Kf[i + 1]; if (p >= a[0] && p <= b[0]) return a[1] + (b[1] - a[1]) * cosE((p - a[0]) / (b[0] - a[0])); }
      return Kf[0][1];
    };
    function bmCycle(tb) {
      const p = (((tb / 2) % 1) + 1) % 1;
      return { th: keys(p, [[0, 0.22], [0.62, 0.58], [1, 0.22]]), lean: keys(p, [[0, 0.04], [0.15, 0.08], [0.6, 0.3], [0.85, 0.08], [1, 0.04]]) };
    }
    // 上手的世界坐标（含船的起伏与摇摆）
    function handW(lt) {
      const tb = lt + TB0, c = bmCycle(tb);
      const x = 13.1, y = -24.4, co = Math.cos(c.lean), si = Math.sin(c.lean);
      const ux = -0.5 + x * co - y * si, uy = -50 + x * si + y * co;
      const u = FH / 100, br = 1 + 0.004 * Math.sin((TAU * tb) / 3.6 + 0.5);
      const bx = boatX(lt), m = SIL.boatMotion(bx, DECK, LEN, lt, {});
      const px = bx + BMX + ux * u, py = DECK + uy * u * br;
      const cr = Math.cos(m.rot), sr = Math.sin(m.rot);
      return [m.px + (px - m.px) * cr - (py - m.py) * sr, m.py + m.dy + (px - m.px) * sr + (py - m.py) * cr, c.th];
    }
    // 篙的状态：篙穿过上手，φ 为篙与竖直的夹角（篙尖在后），s 为上手到篙尖的距离
    function poleAt(lt) {
      const tb = lt + TB0;
      const n = Math.floor((tb - PA * 2) / 2);
      const tp = n * 2 + PA * 2, te = n * 2 + PB * 2, tn = tp + 2;
      const Hh = handW(lt);
      const plant = (tq) => { const Hq = handW(tq - TB0), ph = Hq[2]; return [Hq[0] - (BED - Hq[1]) * Math.tan(ph), BED]; };
      if (tb < te) {
        const T0 = plant(tp);
        const dx = Hh[0] - T0[0], dy = T0[1] - Hh[1];
        return { H: Hh, phi: Math.atan2(dx, dy), s: Math.hypot(dx, dy), push: 1 };
      }
      const T0 = plant(tp), He = handW(te - TB0);
      const phE = Math.atan2(He[0] - T0[0], T0[1] - He[1]), sE = Math.hypot(He[0] - T0[0], T0[1] - He[1]);
      const Hn = handW(tn - TB0), phN = Hn[2], sN = (BED - Hn[1]) / Math.cos(phN);
      const u = (tb - te) / (tn - te);
      const phi = lerp(phE, phN, swing(u));
      // 篙尖升到水面上约 3 像素（u=UM），再插回河床
      const Hm = handW(te + UM * (tn - te) - TB0), phM = lerp(phE, phN, swing(UM));
      const sMin = (WY - 3 - Hm[1]) / Math.cos(phM);
      const s = u < UM ? lerp(sE, sMin, cosE(u / UM)) : lerp(sMin, sN, cosE((u - UM) / (1 - UM)));
      return { H: Hh, phi, s, push: 0 };
    }
    const tipOf = (P) => [P.H[0] - P.s * Math.sin(P.phi), P.H[1] + P.s * Math.cos(P.phi)];
    // 第 n 个周期里篙尖出水、入水的时刻与位置（二分求解，确定性）
    function crossings(n) {
      const tb0 = n * 2 + PB * 2, tb1 = n * 2 + PA * 2 + 2;
      const f = (tb) => tipOf(poleAt(tb - TB0))[1] - WY;
      const tm = tb0 + UM * (tb1 - tb0);
      if (f(tm) >= 0) return [];
      const solve = (a, b) => { for (let i = 0; i < 16; i++) { const m = (a + b) / 2; if ((f(a) > 0) === (f(m) > 0)) a = m; else b = m; } return (a + b) / 2; };
      const out = [];
      const tx = solve(tb0, tm), ti = solve(tm, tb1);
      out.push({ t: tx - TB0, x: tipOf(poleAt(tx - TB0))[0], k: 0.55 });
      out.push({ t: ti - TB0, x: tipOf(poleAt(ti - TB0))[0], k: 1 });
      return out;
    }
    function drawPole(g, lt) {
      const P = poleAt(lt), tip = tipOf(P);
      const dx = -Math.sin(P.phi), dy = Math.cos(P.phi);
      const top = [tip[0] - LP * dx, tip[1] - LP * dy];
      g.save();
      g.beginPath(); g.rect(-50, -50, W + 100, WY + 50); g.clip();
      g.lineCap = 'round';
      g.strokeStyle = rgba(RIM, 0.75); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(top[0] + 0.5, top[1]); g.lineTo(tip[0] + 0.5, tip[1]); g.stroke();
      g.strokeStyle = mix(BODY, '#5a4632', 0.35); g.lineWidth = 1.25;
      g.beginPath(); g.moveTo(top[0] - 0.2, top[1]); g.lineTo(tip[0] - 0.2, tip[1]); g.stroke();
      g.restore();
    }
    // 船、篙、人：画进临时画布（只画一次），正像与倒影都从这里取
    const GX = 230, GY = 210, GW = LEN + 2 * GX, GH = GY + 16;
    function groupCanvas(lt) {
      const bx = boatX(lt);
      const ox = Math.floor(bx - GW / 2), oy = WY - GY;
      const sc = scratch('fg1_i2_grp', GW, GH);
      const g = sc.g;
      g.translate(-ox, -oy);
      const m = SIL.boat(g, bx, DECK, LEN, lt, { layer: 'back', body: '#29231c', rim: RIM, rimSide: 1 });
      drawPole(g, lt);
      SIL.draw(g, 'boatman', 'pole', bx + BMX, DECK, FH, lt + TB0, { facing: 1, boat: m, rim: RIM, rimSide: 1, wind: 0.25, windDir: -1, waterDepth: -10 * FH, body: BODY });
      SIL.draw(g, 'old', 'sitBoat', bx + OLDX, DECK, FH, lt + 1.7, { facing: 1, boat: m, rim: RIM, rimSide: 1, wind: 0.35, windDir: -1, body: BODY });
      SIL.boat(g, bx, DECK, LEN, lt, { layer: 'front', body: '#29231c', rim: RIM, rimSide: 1 });
      return { c: sc.c, S: sc.S, ox, oy };
    }

    // ---- 静态层 ----
    const SKY_STOPS = [[0, '#d9ddd9'], [0.45, '#e7e5dc'], [0.78, '#efe8d8'], [1, '#f1e9d8']];
    function paintSky(g) {
      g.fillStyle = A.vgrad(g, 0, HZ + 10, SKY_STOPS); g.fillRect(0, 0, W, HZ);
      // 日晕（静态部分）：暖色大晕 + 亮心
      let gr = g.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 420);
      gr.addColorStop(0, 'rgba(250,226,186,0.75)'); gr.addColorStop(0.18, 'rgba(246,214,166,0.42)');
      gr.addColorStop(0.5, 'rgba(240,206,160,0.14)'); gr.addColorStop(1, 'rgba(240,206,160,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, HZ);
      cloudWash(g, [[260, 120, 520, 46, 0.1], [700, 70, 600, 40, 0.08], [520, 210, 420, 30, 0.07]], 808, '#9aa6ab');
    }
    const LAYERS = [
      { key: 'f0', base: HZ, col: '#bcc7cb', a: 0.92, blur: 2.2, fade: 0.62, seed: 11, rough: 0.6,
        bumps: [[60, 104, 170], [320, 92, 200], [600, 118, 220], [835, 98, 160], [1010, 108, 150], [1205, 94, 190], [1360, 92, 150]] },
      { key: 'f1', base: HZ, col: '#9db0b7', a: 0.95, blur: 1.5, fade: 0.7, seed: 23, rough: 0.8,
        bumps: [[-40, 72, 150], [195, 58, 150], [430, 70, 170], [690, 44, 170], [890, 36, 140], [1150, 46, 170], [1330, 40, 120]] },
      { key: 'f2', base: HZ + 2, col: '#6c828b', a: 0.97, blur: 0.9, fade: 0.5, seed: 37, rough: 1.0, dots: 0.8,
        bumps: [[150, 128, 190], [345, 86, 140], [520, 38, 120], [1185, 30, 110], [1300, 40, 110]] },
      { key: 'f3', base: HZ + 16, col: '#33424b', a: 0.98, blur: 0.5, fade: 0.5, foot: 0.62, seed: 53, rough: 1.2, dots: 1, trees: 1,
        bumps: [[-60, 92, 180], [95, 62, 115]] },
    ];
    LAYERS.forEach((L) => { L.f = ridge(L.bumps, L.base, L.seed, L.rough); });
    function skyTex() { return K.cache('fg1_i2_sky', W, HZ + 40, 1, paintSky); }
    // 一层山：山体下部先垫天色（雾），再上墨色渐变（顶浓、脚入雾），米点与树
    function paintLayer(g, L) {
      let ymin = 1e9;
      for (let x = -20; x <= W + 20; x += 4) ymin = Math.min(ymin, L.f(x));
      blurInto(g, W, H, L.blur, (tg) => {
        ridgePath(tg, L.f, -20, W + 20, L.base, 2);
        tg.save(); tg.clip();
        tg.drawImage(skyTex(), 0, 0, W, HZ + 40);
        const gr = tg.createLinearGradient(0, ymin - 2, 0, L.base);
        gr.addColorStop(0, rgba(L.col, L.a));
        gr.addColorStop(0.25, rgba(L.col, L.a * 0.82));
        gr.addColorStop(1 - L.fade * 0.4, rgba(L.col, L.a * Math.max(0.35, L.foot || 0)));
        gr.addColorStop(1, rgba(L.col, L.a * (L.foot || 0)));
        tg.fillStyle = gr; tg.fillRect(-20, ymin - 4, W + 40, L.base - ymin + 8);
        // 向阳一侧的空气更亮更暖（逆光薄雾）
        const hz = tg.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 560);
        hz.addColorStop(0, 'rgba(246,222,184,0.55)'); hz.addColorStop(0.5, 'rgba(240,218,186,0.2)'); hz.addColorStop(1, 'rgba(240,218,186,0)');
        tg.fillStyle = hz; tg.fillRect(-20, ymin - 4, W + 40, L.base - ymin + 8);
        tg.restore();
      });
      // 脊线处积墨：沿脊线的一道淡深色
      if (L.dots) {
        blurInto(g, W, H, 1.6, (tg) => {
          tg.save(); ridgePath(tg, L.f, -20, W + 20, L.base, 2); tg.clip();
          tg.strokeStyle = rgba(mix(L.col, '#1c242a', 0.4), 0.2 * L.dots); tg.lineWidth = 7;
          tg.beginPath();
          let on = false;
          for (let x = -20; x <= W + 20; x += 3) {
            const y = L.f(x);
            if (y < L.base - 14) { if (!on) tg.moveTo(x, y + 2); else tg.lineTo(x, y + 2); on = true; } else on = false;
          }
          tg.stroke();
          tg.restore();
        });
        blurInto(g, W, H, 0.5, (tg) => {
          const r = rng(L.seed * 13 + 1);
          tg.save(); ridgePath(tg, L.f, -20, W + 20, L.base, 2); tg.clip();
          for (let i = 0; i < 520 * L.dots; i++) {
            const x = -20 + r() * (W + 40), y0 = L.f(x);
            if (y0 > L.base - 26) continue;
            const dy = Math.pow(r(), 2.6) * (L.base - y0) * 0.4;
            const fall = dy / (L.base - y0 + 1);
            const a = (0.06 + r() * 0.16) * L.dots * (1 - fall * 1.5);
            if (a <= 0.01) continue;
            tg.fillStyle = rgba(mix(L.col, '#151b20', 0.45), a);
            tg.beginPath(); tg.ellipse(x, y0 + 2 + dy, 1.6 + r() * 3.2, 0.9 + r() * 1.3, (r() - 0.5) * 0.3, 0, TAU); tg.fill();
          }
          tg.restore();
        });
      }
      if (L.trees) blurInto(g, W, H, 0.5, (tg) => drawTrees(tg, L, 0));
    }
    // 近岸树丛：疏密相间的几丛，树冠是横向错落的墨点，树干只露一点（dk>0：倒影用，偏冷偏淡）
    function drawTrees(tg, L, dk) {
      const r = rng(L.seed * 31 + 7);
      const cc = (c) => (dk ? mix(c, '#3a4a54', dk) : c), am = dk ? 0.62 : 1;
      const groups = [[8, 3], [52, 2], [118, 3], [168, 1], [205, 2]];
      for (const [gx, nT] of groups) {
        for (let k = 0; k < nT; k++) {
          const x = gx + k * (5 + r() * 6), y = L.f(x) + 2.5;
          const s = 0.6 + r() * 0.6, lean = (r() - 0.5) * 2;
          tg.strokeStyle = rgba(cc('#252d33'), 0.75 * am); tg.lineWidth = 0.8 * s; tg.lineCap = 'round';
          tg.beginPath(); tg.moveTo(x, y + 1); tg.lineTo(x + lean, y - 7 * s); tg.stroke();
          // 两三层横向的叶团
          const tiers = 2 + Math.floor(r() * 2);
          for (let tI = 0; tI < tiers; tI++) {
            const ty = y - (6 + tI * 3.4) * s, tw = (7.5 - tI * 1.6) * s;
            for (let q = 0; q < 7; q++) {
              const cx = x + lean + (r() - 0.5) * tw * 1.6, cy = ty + (r() - 0.5) * 2 * s;
              tg.fillStyle = rgba(cc(r() < 0.6 ? '#1e262c' : '#34424a'), (0.3 + r() * 0.3) * am);
              tg.beginPath(); tg.ellipse(cx, cy, (1.6 + r() * 1.6) * s, (0.8 + r() * 0.7) * s, (r() - 0.5) * 0.3, 0, TAU); tg.fill();
            }
          }
        }
      }
    }
    function bgTex() {
      return K.cache('fg1_i2_bg', W, HZ + 40, 1, (g) => {
        g.drawImage(skyTex(), 0, 0, W, HZ + 40);
        // 太阳：雾中的淡暖圆盘，下缘被远脊挡住
        blurInto(g, W, HZ + 40, 2.5, (tg) => {
          tg.fillStyle = 'rgba(255,244,222,0.92)';
          tg.beginPath(); tg.arc(SUN[0], SUN[1], 23, 0, TAU); tg.fill();
        });
        for (const L of LAYERS) paintLayer(g, L);
        // 近岸水线：一道淡淡的深色
        blurInto(g, W, HZ + 40, 1.2, (tg) => {
          const L3 = LAYERS[3];
          let xe = 0;
          while (xe < W && L3.f(xe) < L3.base - 0.8) xe += 2;
          const gr = tg.createLinearGradient(0, 0, xe + 20, 0);
          gr.addColorStop(0, 'rgba(30,40,46,0.5)'); gr.addColorStop(0.75, 'rgba(30,40,46,0.4)'); gr.addColorStop(1, 'rgba(30,40,46,0)');
          tg.fillStyle = gr;
          tg.beginPath(); tg.moveTo(-10, L3.base - 2.5); tg.quadraticCurveTo(xe * 0.6, L3.base - 2, xe + 20, L3.base - 0.4); tg.lineTo(xe + 20, L3.base + 0.6); tg.lineTo(-10, L3.base + 1.2); tg.closePath(); tg.fill();
        });
      });
    }
    // 水面底色与静态细纹
    function waterTex() {
      return K.cache('fg1_i2_water', W, H - HZ, 1, (g) => {
        g.translate(0, -HZ);
        g.fillStyle = A.vgrad(g, HZ, H, [[0, '#ece6d8'], [0.08, '#e3e0d6'], [0.45, '#cdd3d0'], [1, '#b2bec0']]);
        g.fillRect(0, HZ, W, H - HZ);
        // 日光在近水平处的暖色铺面
        const gr = g.createRadialGradient(SUN[0], HZ + 6, 0, SUN[0], HZ + 6, 520);
        gr.addColorStop(0, 'rgba(248,224,186,0.6)'); gr.addColorStop(0.4, 'rgba(240,216,182,0.22)'); gr.addColorStop(1, 'rgba(240,216,182,0)');
        g.save(); g.translate(SUN[0], HZ + 6); g.scale(1, 0.32); g.translate(-SUN[0], -(HZ + 6));
        g.fillStyle = gr; g.fillRect(0, HZ - 200, W, 900); g.restore();
        // 横向细纹：越近越宽越稀
        const r = rng(911);
        for (let i = 0; i < 520; i++) {
          const v = Math.pow(r(), 1.35), y = HZ + 3 + v * (H - HZ);
          const len = 8 + (y - HZ) * (0.25 + r() * 0.9);
          const x = r() * (W + 100) - 50;
          const light = r() < 0.55;
          const a = (light ? 0.1 : 0.07) * (0.5 + r());
          g.strokeStyle = light ? rgba('#f7f3ea', a) : rgba('#7f9198', a);
          g.lineWidth = 0.6 + v * 1.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (r() - 0.5) * 0.6); g.stroke();
        }
      });
    }
    // 山的倒影：以各自水线翻转，压暗偏冷，向近处渐淡
    function reflTex() {
      return K.cache('fg1_i2_refl', W, H - HZ, 1, (g) => {
        blurInto(g, W, H - HZ, 2.2, (tg) => {
          // 按层翻转画：y_倒 = 2·base − y
          for (const L of LAYERS) {
            tg.save();
            tg.translate(0, -HZ);
            tg.translate(0, 2 * L.base); tg.scale(1, -1);
            ridgePath(tg, L.f, -20, W + 20, L.base, 2);
            tg.clip();
            let ymin = 1e9;
            for (let x = -20; x <= W + 20; x += 4) ymin = Math.min(ymin, L.f(x));
            const gr = tg.createLinearGradient(0, ymin, 0, L.base);
            const dk = mix(L.col, '#2c3a44', 0.38);
            gr.addColorStop(0, rgba(dk, L.a * 0.62)); gr.addColorStop(0.3, rgba(dk, L.a * 0.5));
            gr.addColorStop(1 - L.fade * 0.4, rgba(dk, L.a * Math.max(0.24, (L.foot || 0) * 0.8))); gr.addColorStop(1, rgba(dk, L.a * (L.foot || 0) * 0.85));
            tg.fillStyle = gr; tg.fillRect(-20, ymin - 4, W + 40, L.base - ymin + 6);
            tg.restore();
            // 近岬上的树也一起倒过来（同一翻转，不裁到山形里）
            if (L.trees) {
              tg.save();
              tg.translate(0, -HZ); tg.translate(0, 2 * L.base); tg.scale(1, -1);
              drawTrees(tg, L, 0.3);
              tg.restore();
            }
          }
        });
        // 向近处渐淡
        g.save();
        g.globalCompositeOperation = 'destination-out';
        const gr = g.createLinearGradient(0, 0, 0, 200);
        gr.addColorStop(0, 'rgba(0,0,0,0.15)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H - HZ);
        g.restore();
      });
    }
    // 光柱：横向高斯、近水平处窄而亮，向近处展宽变淡
    function columnTex() {
      return K.cache('fg1_i2_col', 220, H - HZ, 0.5, (g) => {
        const hh = H - HZ;
        for (let y = 0; y < hh; y += 2) {
          const v = y / hh, w = 10 + v * 70, a = 0.34 * Math.pow(1 - v, 1.3) + 0.04;
          const gr = g.createLinearGradient(110 - w * 1.6, 0, 110 + w * 1.6, 0);
          gr.addColorStop(0, 'rgba(250,226,186,0)'); gr.addColorStop(0.5, `rgba(250,228,190,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(250,226,186,0)');
          g.fillStyle = gr; g.fillRect(0, y, 220, 2);
        }
      });
    }
    function flakeTex() {
      return K.cache('fg1_i2_flake', 32, 8, 1, (g) => {
        const gr = g.createRadialGradient(16, 4, 0, 16, 4, 16);
        gr.addColorStop(0, 'rgba(255,236,200,0.9)'); gr.addColorStop(0.4, 'rgba(250,220,170,0.45)'); gr.addColorStop(1, 'rgba(250,220,170,0)');
        g.save(); g.translate(16, 4); g.scale(1, 0.25); g.translate(-16, -4);
        g.fillStyle = gr; g.fillRect(0, -12, 32, 32); g.restore();
      });
    }
    const MP = 1600;
    const bands = () => [
      mistBand('fg1_i2_m1', MP, 120, 71, '#f4efe4', 0.7),
      mistBand('fg1_i2_m2', MP, 100, 83, '#f5f1e8', 0.6),
      mistBand('fg1_i2_m3', MP, 80, 97, '#f6f3ec', 0.8),
    ];

    XYT.registerShot('i2_river', {
      name: '一叶孤舟', zone: 'bottom', night: false,
      text: '#2a2622', shadow: 'rgba(250,246,236,0.85)', accent: '#c8452f', bloom: 0.3,
      draw(g, c) {
        const lt = c.lt;
        const B = bands();
        const S = SS();
        // 水面
        g.drawImage(waterTex(), 0, HZ, W, H - HZ);
        // 山的倒影：横向条带随水波轻轻错动
        const rf = reflTex();
        for (let y = 0; y < 220; y += 4) {
          const k = y / 220;
          const dx = (0.6 + 2.4 * k) * Math.sin(y * 0.21 + lt * 1.3) + (0.4 + 1.2 * k) * Math.sin(y * 0.077 - lt * 0.9 + 1.7);
          g.drawImage(rf, 0, y * S, rf.width, 4 * S, dx, HZ + y, W, 4);
        }
        // 天与山（近岬的山脚压在水上）
        g.drawImage(bgTex(), 0, 0, W, HZ + 40);
        // 远雾：最慢（0.05）
        drawBand(g, B[0], MP, 262, 120, lt, 2, -1, 0.62);
        // 日光柱：太阳正下方，柔和的暖色光带上碎着断续的光片
        const de = c.de ? c.de(0.6) : 0, be = c.be ? c.be(0.3) : 0;
        g.drawImage(columnTex(), SUN[0] - 110, HZ, 220, H - HZ);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const fl = flakeTex();
        for (let i = 0; i < 110; i++) {
          const v = Math.pow(h2(i, 3), 1.5), y = HZ + 1.5 + v * (H - HZ - 10);
          const spread = 5 + (y - HZ) * 0.16;
          const gx = (h2(i, 5) + h2(i, 6) + h2(i, 7) - 1.5) * spread * 1.3;
          const len = 4 + (y - HZ) * 0.1 * (0.5 + h2(i, 8));
          const sh = 0.5 + 0.5 * Math.sin(lt * (1.6 + 2.6 * h2(i, 9)) + h2(i, 10) * TAU);
          const a = (0.8 - 0.55 * v) * sh * sh * (1 + 0.15 * be);
          if (a < 0.02) continue;
          g.globalAlpha = Math.min(1, a);
          g.drawImage(fl, SUN[0] + gx - len / 2, y - 1.5 - v, len, 3 + 2 * v);
        }
        g.restore();
        // 船与倒影
        const grp = groupCanvas(lt);
        // 倒影：沿水面线翻转，条带错动，半透明
        g.save();
        g.beginPath(); g.rect(0, WY, W, H - WY); g.clip();
        const rows = GY;
        for (let y = 0; y < rows; y += 2) {
          const k = y / rows;
          g.globalAlpha = 0.54 * (1 - 0.55 * k);
          const dx = (0.25 + 1.5 * k) * Math.sin(y * 0.16 + lt * 2.1) + (0.15 + 0.7 * k) * Math.sin(y * 0.07 - lt * 1.4 + 1.1);
          const sy = GY - y - 2; // 源图里水面线以上第 y 行
          g.drawImage(grp.c, 0, Math.max(0, sy * S), grp.c.width, 2 * S, grp.ox + dx, WY + y, GW, 2);
        }
        g.restore();
        // 篙尖出入水的涟漪：钉在世界坐标里，原地扩散、淡去
        const tbNow = lt + TB0, nNow = Math.floor((tbNow - PA * 2) / 2);
        g.save();
        for (let n = nNow - 2; n <= nNow; n++) {
          for (const e of crossings(n)) {
            const age = lt - e.t;
            if (age < 0 || age > 2.8) continue;
            for (let r = 0; r < 2; r++) {
              const ag = age - r * 0.28;
              if (ag <= 0) continue;
              const rad = 2 + 30 * Math.pow(ag, 0.62);
              const a = 0.55 * e.k * smooth(ag / 0.12) * Math.pow(1 - ag / 2.8, 1.6) * (r ? 0.6 : 1);
              g.strokeStyle = `rgba(250,246,236,${a.toFixed(3)})`; g.lineWidth = 0.9;
              g.beginPath(); g.ellipse(e.x, WY + 0.5, rad, rad * 0.13, 0, 0, TAU); g.stroke();
              g.strokeStyle = `rgba(70,86,94,${(a * 0.45).toFixed(3)})`;
              g.beginPath(); g.ellipse(e.x, WY + 1.4, rad * 0.94, rad * 0.11, 0, 0, Math.PI); g.stroke();
            }
          }
        }
        // V 形尾波：每一点是船头 tau 秒前经过的位置，留在水里向两侧张开（透视压扁后近臂每秒约 1.9 px、远臂约 0.9 px），8 s 内淡去。
        // 每臂是一道亮线（波峰迎天光）下面贴一道暗线（波谷）；远臂在船身后方才露出来
        const bow = (tt) => boatX(tt) + 0.46 * LEN;
        const TW = 8, NW = 64;
        const wpt = (side, tau) => {
          const x = bow(lt - tau);
          const y = side > 0 ? WY + 1 + 1.9 * tau : WY - 0.5 - 0.9 * tau;
          return [x, y + 0.4 * Math.sin(x * 0.08 - lt * 1.5) * smooth(tau / 0.6)];
        };
        for (const side of [1, -1]) {
          let p0 = wpt(side, 0);
          for (let i = 1; i <= NW; i++) {
            const tau = (i * TW) / NW, p1 = wpt(side, tau);
            const a = 0.66 * Math.pow(1 - tau / TW, 1.1) * smooth(tau / 0.25) * (side > 0 ? 1 : 0.8);
            if (a > 0.004) {
              // 波峰朝镜头的一面映着高处较暗的天，所以以暗线为主，上缘一道亮线
              const lw = 1 + 0.6 * (tau / TW);
              g.lineWidth = lw;
              g.strokeStyle = `rgba(250,247,240,${(0.8 * a).toFixed(3)})`;
              g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
              g.strokeStyle = `rgba(78,94,102,${(0.55 * a).toFixed(3)})`;
              g.beginPath(); g.moveTo(p0[0], p0[1] + lw); g.lineTo(p1[0], p1[1] + lw); g.stroke();
            }
            p0 = p1;
          }
        }
        g.restore();
        // 正像
        g.drawImage(grp.c, grp.ox, grp.oy, GW, GH);
        // 低雾：岸边（0.15）与水上（0.3）
        drawBand(g, B[1], MP, 396, 74, lt, 6, -1, 0.5);
        drawBand(g, B[2], MP, 438, 80, lt, 12, -1, 0.34);
        // 日晕呼吸：强拍上微亮
        g.save();
        g.globalCompositeOperation = 'screen';
        const gl = g.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 300);
        const ga = 0.22 + 0.06 * de;
        gl.addColorStop(0, `rgba(255,236,200,${ga.toFixed(3)})`); gl.addColorStop(0.35, `rgba(250,220,170,${(ga * 0.45).toFixed(3)})`); gl.addColorStop(1, 'rgba(250,220,170,0)');
        g.fillStyle = gl; g.fillRect(SUN[0] - 300, SUN[1] - 300, 600, 600);
        g.restore();
      },
    });
  })();

  // ============================================================
  // i3_whitehair 白发归人：船头站着的白发人，望向雾里渐渐显出的江南小镇
  // ============================================================
  (function () {
    const HZ = 432; // 对岸水线
    const FX = 860, FY = 640, FH = 300;
    const SUNX = 1400, SUNY = 250; // 画外右侧低处
    const RIM = '#f3c48c';
    const DECK = '#2b2f36';
    const VP = [905, HZ]; // 船板缝的灭点（在地平线上）
    const FIGB = SIL.bounds('old', 'standBack', FH);

    function paintSky(g) {
      g.fillStyle = A.vgrad(g, 0, HZ, [[0, '#dcdcd4'], [0.5, '#e9e4d6'], [1, '#efe6d2']]);
      g.fillRect(0, 0, W, HZ);
      const gr = g.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, 760);
      gr.addColorStop(0, 'rgba(252,228,188,0.95)'); gr.addColorStop(0.25, 'rgba(246,214,168,0.5)');
      gr.addColorStop(0.6, 'rgba(240,210,170,0.14)'); gr.addColorStop(1, 'rgba(240,210,170,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, HZ);
      cloudWash(g, [[330, 110, 560, 50, 0.09], [820, 60, 520, 36, 0.07]], 909, '#9ea8aa');
    }
    function skyTex() { return K.cache('fg1_i3_sky', W, HZ, 1, paintSky); }
    // 远山：两层低丘
    const HILLS = [
      { base: HZ - 6, col: '#c4cccd', a: 0.85, blur: 2.4, seed: 5, rough: 0.5, bumps: [[120, 96, 210], [430, 120, 240], [760, 84, 200], [1050, 70, 210], [1290, 60, 160]] },
      { base: HZ - 2, col: '#a9b6b9', a: 0.9, blur: 1.6, seed: 9, rough: 0.7, bumps: [[-20, 66, 160], [300, 54, 170], [610, 72, 150], [930, 40, 170], [1230, 36, 150]] },
    ];
    HILLS.forEach((L) => { L.f = ridge(L.bumps, L.base, L.seed, L.rough); });
    function paintHills(g) {
      for (const L of HILLS) {
        let ymin = 1e9;
        for (let x = -20; x <= W + 20; x += 4) ymin = Math.min(ymin, L.f(x));
        blurInto(g, W, HZ + 10, L.blur, (tg) => {
          ridgePath(tg, L.f, -20, W + 20, L.base, 2);
          tg.save(); tg.clip();
          tg.drawImage(skyTex(), 0, 0, W, HZ);
          const gr = tg.createLinearGradient(0, ymin, 0, L.base);
          gr.addColorStop(0, rgba(L.col, L.a)); gr.addColorStop(0.35, rgba(L.col, L.a * 0.7)); gr.addColorStop(1, rgba(L.col, 0));
          tg.fillStyle = gr; tg.fillRect(-20, ymin - 4, W + 40, L.base - ymin + 6);
          const hz = tg.createRadialGradient(SUNX, SUNY, 0, SUNX, SUNY, 900);
          hz.addColorStop(0, 'rgba(248,224,186,0.6)'); hz.addColorStop(0.5, 'rgba(242,220,188,0.2)'); hz.addColorStop(1, 'rgba(242,220,188,0)');
          tg.fillStyle = hz; tg.fillRect(-20, ymin - 4, W + 40, L.base - ymin + 6);
          tg.restore();
        });
      }
    }
    // 江南小镇：白墙黛瓦、马头墙、临水石岸与柳；侧逆光（光从右来），白墙偏暖灰，右缘略亮
    const HOUSES = (() => {
      const r = rng(4242), out = [];
      // 后排（略高、略淡）
      let x = 250;
      while (x < 690) { const w = 34 + r() * 40; out.push({ x, w, h: 30 + r() * 18, row: 1, gable: 0, seed: out.length }); r(); r(); x += w * (0.72 + r() * 0.22); }
      // 前排（临水）
      x = 205;
      while (x < 700) { const w = 26 + r() * 40; out.push({ x, w, h: 22 + r() * 18, row: 0, gable: r() < 0.5 ? (r() < 0.5 ? 2 : 1) : 0, seed: out.length }); x += w + 4 + r() * 16; }
      return out;
    })();
    function drawHouse(g, hs, baseY) {
      const { x, w, h } = hs, r = rng(9000 + hs.seed);
      const wall = hs.row ? '#c9c3b8' : '#e5dccd';
      const roof = hs.row ? '#62686d' : '#464c52';
      const top = baseY - h;
      const wallFill = () => {
        const gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, mix(wall, '#b6afa3', 0.28)); gr.addColorStop(0.8, wall); gr.addColorStop(1, mix(wall, '#f7e9cf', 0.6));
        return gr;
      };
      // 瓦檐：一条深色的帽，两端微翘
      const cap = (x0, x1, y, th) => {
        g.fillStyle = roof;
        g.beginPath();
        g.moveTo(x0 - 2.2, y - th * 0.2 - 1.4);
        g.quadraticCurveTo(x0 - 0.5, y - th * 0.15, x0, y - th);
        g.lineTo(x1, y - th);
        g.quadraticCurveTo(x1 + 0.5, y - th * 0.15, x1 + 2.2, y - th * 0.2 - 1.4);
        g.lineTo(x1 + 1, y + 0.6); g.lineTo(x0 - 1, y + 0.6);
        g.closePath(); g.fill();
      };
      if (hs.gable) {
        // 山墙朝水：阶梯形的马头墙，中间最高，每一级盖一道黑瓦
        const n = hs.gable + 1, stepH = 5 + r() * 2, stepW = w / (2 * n);
        g.fillStyle = wallFill();
        g.beginPath();
        g.moveTo(x, baseY);
        for (let k = 0; k < n; k++) { const yy = top - k * stepH; g.lineTo(x + k * stepW, yy); g.lineTo(x + (k + 1) * stepW, yy); }
        for (let k = n - 1; k >= 0; k--) { const yy = top - k * stepH; g.lineTo(x + w - (k + 1) * stepW, yy); g.lineTo(x + w - k * stepW, yy); }
        g.lineTo(x + w, baseY); g.closePath(); g.fill();
        for (let k = 0; k < n; k++) {
          const yy = top - k * stepH;
          if (k < n - 1) { cap(x + k * stepW, x + (k + 1) * stepW, yy, 2.2); cap(x + w - (k + 1) * stepW, x + w - k * stepW, yy, 2.2); }
          else cap(x + k * stepW, x + w - k * stepW, yy, 2.4);
        }
      } else {
        // 檐墙朝水：白墙上一道坡屋面
        g.fillStyle = wallFill(); g.fillRect(x, top, w, h);
        const rh = 5 + w * 0.07;
        g.fillStyle = roof;
        g.beginPath();
        g.moveTo(x - 3, top + 1.2); g.quadraticCurveTo(x + w * 0.5, top - 0.6, x + w + 3, top + 1.2);
        g.lineTo(x + w + 1.2, top - 1.2); g.lineTo(x + w - 3, top - rh); g.lineTo(x + 3, top - rh); g.lineTo(x - 1.2, top - 1.2);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(70,70,70,0.22)'; g.fillRect(x, top + 1.2, w, 2);
      }
      // 墙脚水渍，左缘（背光）一道淡影
      g.fillStyle = 'rgba(96,98,94,0.2)'; g.fillRect(x, baseY - 3.5, w, 3.5);
      g.fillStyle = 'rgba(110,108,102,0.25)'; g.fillRect(x, top, 1.2, h);
      // 小窗、门
      const nw = Math.max(1, Math.floor(w / 16));
      for (let i = 0; i < nw; i++) {
        if (r() < 0.3) continue;
        const wx = x + (w / (nw + 1)) * (i + 1) - 2, wy = top + h * (0.25 + r() * 0.12);
        g.fillStyle = 'rgba(62,62,62,0.7)'; g.fillRect(wx, wy, 3.5 + r() * 1.5, 3.5 + r() * 2);
      }
      if (hs.row === 0 && r() < 0.65) { const dx = x + w * (0.3 + r() * 0.35); g.fillStyle = 'rgba(52,50,48,0.78)'; g.fillRect(dx, baseY - h * 0.42, 5.5, h * 0.42 - 3); }
    }
    function drawWillow(g, x, y, s, seed) {
      const r = rng(seed);
      g.strokeStyle = 'rgba(52,56,52,0.9)'; g.lineCap = 'round';
      g.lineWidth = 2.2 * s;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 3 * s, y - 20 * s, x - 2 * s, y - 38 * s); g.stroke();
      g.lineWidth = 1.2 * s;
      const crowns = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 1.8, L = (14 + r() * 12) * s;
        const bx = x - 2 * s + Math.cos(a) * L, by = y - 38 * s + Math.sin(a) * L * 0.7;
        g.beginPath(); g.moveTo(x - 2 * s, y - 34 * s); g.quadraticCurveTo((x + bx) / 2, by - 4 * s, bx, by); g.stroke();
        crowns.push([bx, by]);
      }
      // 垂丝：从枝头垂下，顺风（向左）略偏
      for (const [bx, by] of crowns) {
        for (let k = 0; k < 9; k++) {
          const sx = bx + (r() - 0.5) * 14 * s, sy = by + (r() - 0.5) * 6 * s, L = (18 + r() * 22) * s;
          g.strokeStyle = rgba(r() < 0.5 ? '#5d6a5c' : '#6f7c6b', 0.5 + r() * 0.3); g.lineWidth = 0.7 * s;
          g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx - 1 * s, sy + L * 0.5, sx - 3.5 * s, sy + L); g.stroke();
        }
        g.fillStyle = 'rgba(88,100,86,0.35)';
        g.beginPath(); g.ellipse(bx, by + 4 * s, 9 * s, 6 * s, 0, 0, TAU); g.fill();
      }
    }
    function paintTown(g) {
      // 后排
      blurInto(g, W, HZ + 10, 1.1, (tg) => {
        for (const hs of HOUSES) if (hs.row === 1) drawHouse(tg, hs, HZ - 12);
      });
      blurInto(g, W, HZ + 10, 0.7, (tg) => {
        // 石岸
        tg.fillStyle = '#9a9a92'; tg.fillRect(190, HZ - 7, 530, 7);
        tg.fillStyle = 'rgba(70,72,70,0.35)'; tg.fillRect(190, HZ - 2, 530, 2);
        for (let x = 196; x < 716; x += 11) { tg.fillStyle = 'rgba(80,80,76,0.25)'; tg.fillRect(x, HZ - 7, 0.8, 5); }
        // 前排
        for (const hs of HOUSES) if (hs.row === 0) drawHouse(tg, hs, HZ - 7);
        // 柳
        const wl = [[232, 0.9], [372, 1.05], [520, 0.85], [655, 1.0], [712, 0.8]];
        wl.forEach(([x, s], i) => drawWillow(tg, x, HZ - 5, s, 70 + i));
        // 小石桥（右端）
        tg.strokeStyle = '#8f8f88'; tg.lineWidth = 4;
        tg.beginPath(); tg.arc(745, HZ + 6, 22, Math.PI * 1.08, Math.PI * 1.92); tg.stroke();
        tg.fillStyle = '#9b9b93'; tg.fillRect(720, HZ - 12, 50, 3);
      });
      // 两端淡入雾
      g.save();
      g.globalCompositeOperation = 'destination-out';
      let gr = g.createLinearGradient(170, 0, 300, 0);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 280, 300, HZ - 270);
      gr = g.createLinearGradient(700, 0, 800, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = gr; g.fillRect(700, 280, 200, HZ - 270);
      g.restore();
    }
    function townTex() { return K.cache('fg1_i3_town', W, HZ + 10, 1, paintTown); }
    function bgTownTex() { return K.cache('fg1_i3_bgtown', W, HZ + 10, 1, (g) => { g.drawImage(bgTex(), 0, 0, W, HZ + 10); g.drawImage(townTex(), 0, 0, W, HZ + 10); }); }
    // 雾层：竖向软边的一整片（k=0 均匀；k=1 左浓右淡的斜坡，用来让右侧先散）
    const FOG_Y0 = 220, FOG_Y1 = 500;
    function fogTex(k) {
      return K.cache('fg1_i3_fog' + k, W, FOG_Y1 - FOG_Y0, 0.5, (g) => {
        const hh = FOG_Y1 - FOG_Y0;
        for (let y = 0; y < hh; y += 2) {
          const v = (y + 1) / hh, prof = smooth(v / 0.4) * (1 - smooth((v - 0.72) / 0.28));
          const gr = g.createLinearGradient(150, 0, 820, 0);
          if (k === 0) { gr.addColorStop(0, `rgba(238,232,220,${prof.toFixed(3)})`); gr.addColorStop(1, `rgba(242,231,212,${prof.toFixed(3)})`); }
          else { gr.addColorStop(0, `rgba(238,232,220,${prof.toFixed(3)})`); gr.addColorStop(1, 'rgba(242,231,212,0)'); }
          g.fillStyle = gr; g.fillRect(0, y, W, 2);
        }
      });
    }
    function bgTex() {
      // 整块不透明（天色一直铺到 HZ+10），水面贴图压在它上面，推镜时水天交界那一行不会透出上一帧
      return K.cache('fg1_i3_bg', W, HZ + 10, 1, (g) => { g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, HZ + 10); g.drawImage(skyTex(), 0, 0, W, HZ); paintHills(g); });
    }
    function waterTex() {
      return K.cache('fg1_i3_water', W, H - HZ, 1, (g) => {
        g.translate(0, -HZ);
        g.fillStyle = A.vgrad(g, HZ, H, [[0, '#e9e3d4'], [0.3, '#d6d9d3'], [1, '#bcc6c6']]);
        g.fillRect(0, HZ, W, H - HZ);
        const gr = g.createRadialGradient(1280, HZ + 10, 0, 1280, HZ + 10, 620);
        gr.addColorStop(0, 'rgba(250,226,186,0.65)'); gr.addColorStop(0.5, 'rgba(244,220,184,0.2)'); gr.addColorStop(1, 'rgba(244,220,184,0)');
        g.save(); g.translate(1280, HZ + 10); g.scale(1, 0.35); g.translate(-1280, -(HZ + 10));
        g.fillStyle = gr; g.fillRect(0, HZ - 400, W, 1600); g.restore();
        // 远山与小镇的倒影
        blurInto(g, W, H, 1.8, (tg) => {
          tg.save(); tg.translate(0, 2 * HZ); tg.scale(1, -1);
          tg.beginPath(); tg.rect(0, 0, W, HZ); tg.clip();
          tg.globalAlpha = 0.55; tg.drawImage(bgTex(), 0, 0, W, HZ + 10);
          tg.restore();
          tg.fillStyle = 'rgba(214,216,210,0.55)'; tg.fillRect(0, HZ, W, H - HZ);
        }, 'multiply');
        const r = rng(733);
        for (let i = 0; i < 380; i++) {
          const v = Math.pow(r(), 1.3), y = HZ + 2 + v * (H - HZ);
          const len = 10 + (y - HZ) * (0.3 + r() * 0.9), x = r() * (W + 100) - 50;
          const light = r() < 0.55;
          g.strokeStyle = light ? rgba('#f6f1e6', 0.08 + r() * 0.08) : rgba('#7c8d93', 0.05 + r() * 0.06);
          g.lineWidth = 0.6 + v * 1.4;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
        }
      });
    }
    function townReflTex() {
      return K.cache('fg1_i3_trefl', W, 120, 1, (g) => {
        blurInto(g, W, 120, 1.4, (tg) => {
          tg.translate(0, -HZ);
          tg.save(); tg.translate(0, 2 * HZ); tg.scale(1, -1);
          tg.drawImage(townTex(), 0, 0, W, HZ + 10);
          tg.restore();
        });
        g.save(); g.globalCompositeOperation = 'source-atop';
        g.fillStyle = 'rgba(70,80,86,0.38)'; g.fillRect(0, 0, W, 120);
        g.globalCompositeOperation = 'destination-out';
        const gr = g.createLinearGradient(0, 0, 0, 110);
        gr.addColorStop(0, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(0, 0, W, 120);
        g.restore();
      });
    }
    // 船头：小船的窄船头（与上一镜的小舟一致）。船板是梯形，两舷舷板高出船板约 0.15 m，前端一道挡板；
    // 透视按船尾在近处、船头在人脚前计算，两舷外是水面。光从右来：左舷内侧受光，右舷上沿亮边
    const DL = [[775, 636], [652, 720]], DR = [[945, 636], [1040, 720]];
    const ext = (P, Q, y) => P[0] + ((Q[0] - P[0]) * (y - P[1])) / (Q[1] - P[1]);
    const railH = (y) => 26 + (11 * (y - 636)) / 84;
    const YB = 820;
    function deckPath(g) {
      g.beginPath();
      g.moveTo(DL[0][0], 636); g.lineTo(DR[0][0], 636);
      g.lineTo(ext(DR[0], DR[1], YB), YB); g.lineTo(ext(DL[0], DL[1], YB), YB);
      g.closePath();
    }
    // 舷板上沿（外缘略外撇）
    const railTop = (side, y) => [(side < 0 ? ext(DL[0], DL[1], y) - 3 - (y - 636) * 0.03 : ext(DR[0], DR[1], y) + 3 + (y - 636) * 0.03), y - railH(y)];
    function railPath(g, side) {
      const D = side < 0 ? DL : DR;
      g.beginPath();
      g.moveTo(D[0][0], 636);
      g.lineTo(ext(D[0], D[1], YB), YB);
      const pb = railTop(side, YB), pt = railTop(side, 636);
      g.lineTo(pb[0], pb[1]);
      g.quadraticCurveTo((pb[0] + pt[0]) / 2 + side * 2, (pb[1] + pt[1]) / 2 - 1, pt[0], pt[1] - 3);
      g.closePath();
    }
    function boardPath(g) {
      const pl = railTop(-1, 636), pr = railTop(1, 636);
      g.beginPath();
      g.moveTo(DL[0][0], 636); g.lineTo(DR[0][0], 636);
      g.lineTo(pr[0], pr[1] - 3);
      g.quadraticCurveTo(860, pl[1] + 1.5, pl[0], pl[1] - 3);
      g.closePath();
    }
    function bowTex() {
      // 船头整体缓存在一块局部画布里（摇摆时整体变换）
      return K.cache('fg1_i3_bow', 760, 300, 1, (g) => {
        g.translate(-480, -560);
        // 船体在水面上的暗影（倒影与阴影），只在两舷外侧
        blurInto(g, 1760, 900, 6, (tg) => {
          tg.translate(0, 0);
          tg.fillStyle = 'rgba(40,48,54,0.45)';
          tg.beginPath();
          const l0 = railTop(-1, 636), l1 = railTop(-1, YB), r0 = railTop(1, 636), r1 = railTop(1, YB);
          tg.moveTo(l0[0] - 2, 612); tg.lineTo(r0[0] + 2, 612); tg.lineTo(r1[0] + 26, YB); tg.lineTo(l1[0] - 26, YB); tg.closePath();
          tg.fill();
        });
        // 船板
        deckPath(g);
        let gr = g.createLinearGradient(0, 636, 0, 760);
        gr.addColorStop(0, '#3d3f43'); gr.addColorStop(0.25, '#2f3237'); gr.addColorStop(1, '#1e2126');
        g.fillStyle = gr; g.fill();
        g.save(); deckPath(g); g.clip();
        const r = rng(5151);
        const VPd = [871, 570]; // 船板纵向线的汇聚点（船头收窄）
        for (let i = 0; i < 46; i++) {
          const u = r(), a = 0.04 + r() * 0.06;
          const xb = lerp(ext(DL[0], DL[1], YB), ext(DR[0], DR[1], YB), u);
          const s0 = 0.18 + r() * 0.5, s1 = Math.min(1, s0 + 0.12 + r() * 0.3);
          const P = (k) => [lerp(VPd[0], xb, k), lerp(VPd[1], YB, k)];
          const P0 = P(s0), P1 = P(s1);
          g.strokeStyle = r() < 0.5 ? `rgba(130,118,100,${a.toFixed(3)})` : `rgba(8,10,12,${(a * 1.4).toFixed(3)})`;
          g.lineWidth = 0.6 + r() * 0.7;
          g.beginPath(); g.moveTo(P0[0], P0[1]); g.lineTo(P1[0], P1[1]); g.stroke();
        }
        // 两三条板缝
        for (const u of [0.3, 0.62]) {
          const xb = lerp(ext(DL[0], DL[1], YB), ext(DR[0], DR[1], YB), u);
          const k0 = (636 - VPd[1]) / (YB - VPd[1]);
          const x0 = lerp(VPd[0], xb, k0);
          g.strokeStyle = 'rgba(12,14,17,0.65)'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(x0, 636); g.lineTo(xb, YB); g.stroke();
          g.strokeStyle = 'rgba(140,128,112,0.12)'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(x0 + 0.9, 636); g.lineTo(xb + 1.6, YB); g.stroke();
        }
        g.restore();
        // 挡板（内侧面背光）
        boardPath(g);
        gr = g.createLinearGradient(0, 606, 0, 636);
        gr.addColorStop(0, '#3a3a3d'); gr.addColorStop(1, '#26292e');
        g.fillStyle = gr; g.fill();
        // 左舷：内侧面朝右，受光偏暖
        railPath(g, -1);
        gr = g.createLinearGradient(560, 0, 780, 0);
        gr.addColorStop(0, '#3e3a36'); gr.addColorStop(1, '#4b4640');
        g.fillStyle = gr; g.fill();
        // 右舷：内侧面背光
        railPath(g, 1);
        g.fillStyle = '#25282d'; g.fill();
        // 上沿：天光淡亮线，右舷外缘一道暖色亮边
        const strokeTop = (side, col, w) => {
          g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
          g.beginPath();
          const pb = railTop(side, YB), pt = railTop(side, 636);
          g.moveTo(pb[0], pb[1]); g.quadraticCurveTo((pb[0] + pt[0]) / 2 + side * 2, (pb[1] + pt[1]) / 2 - 1, pt[0], pt[1] - 3);
          g.stroke();
        };
        strokeTop(-1, 'rgba(196,188,174,0.55)', 1.6);
        strokeTop(1, rgba(RIM, 0.9), 2);
        const pl = railTop(-1, 636), pr = railTop(1, 636);
        g.strokeStyle = 'rgba(206,198,184,0.5)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(pr[0], pr[1] - 3); g.quadraticCurveTo(860, pl[1] + 1.5, pl[0], pl[1] - 3); g.stroke();
        g.strokeStyle = rgba(RIM, 0.55); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(pr[0] - 1, pr[1] - 2.6); g.lineTo(pr[0] + 0.5, 634); g.stroke();
      });
    }
    function drawBow(g) { g.drawImage(bowTex(), 480, 560, 760, 300); }
    const MP = 1600;
    const bands = () => [
      mistBand('fg1_i3_m1', MP, 130, 141, '#f2ede2', 0.7),
      mistBand('fg1_i3_m2', MP, 110, 157, '#f3efe6', 0.75),
      mistBand('fg1_i3_m3', MP, 120, 173, '#f5f2ea', 1.5, 0.12),
    ];

    XYT.registerShot('i3_whitehair', {
      name: '白发归人', zone: 'left', night: false,
      text: '#2a2622', shadow: 'rgba(250,246,236,0.85)', accent: '#3d6fa8', bloom: 0.3,
      draw(g, c) {
        const lt = c.lt, S = SS();
        const B = bands();
        // 先铺一层不透明底色：画面每个像素都由本帧决定
        g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, W, H);
        // 镜头：整镜 1.00→1.06 缓推，以人物上身为中心
        const z = 1 + 0.06 * easeInOut(clamp(lt / c.dur));
        g.save();
        g.translate(FX, 470); g.scale(z, z); g.translate(-FX, -470);
        g.drawImage(bgTownTex(), 0, 0, W, HZ + 10);
        // 小镇：雾从 3.0 s 起渐散，6.0 s 散到 0.45
        const fogK = smooth((lt - 3.0) / 3.0);
        // 水面与倒影
        g.drawImage(waterTex(), 0, HZ, W, H - HZ + 2);
        const tr = townReflTex();
        g.save(); g.globalAlpha = 0.25 + 0.5 * fogK;
        for (let y = 0; y < 110; y += 3) {
          const k = y / 110, dx = (0.4 + 2.2 * k) * Math.sin(y * 0.19 + lt * 1.2) + 0.6 * k * Math.sin(y * 0.07 - lt * 0.8);
          g.drawImage(tr, 150 * S, y * S, 680 * S, 3 * S, 150 + dx, HZ + y, 680, 3);
        }
        g.restore();
        // 小镇上的雾层：整体 0.8→0.45，右侧（向阳）先薄；竖向软边，罩住远山、小镇与岸边水面
        {
          const kR = smooth((lt - 3.0) / 2.6), kL = smooth((lt - 3.4) / 2.6);
          const aL = lerp(0.8, 0.45, kL), aR = lerp(0.8, 0.45, kR);
          const a0 = g.globalAlpha;
          g.globalAlpha = a0 * aR; g.drawImage(fogTex(0), 0, FOG_Y0, W, FOG_Y1 - FOG_Y0);
          if (aL - aR > 0.003) { g.globalAlpha = a0 * (aL - aR); g.drawImage(fogTex(1), 0, FOG_Y0, W, FOG_Y1 - FOG_Y0); }
          g.globalAlpha = a0;
          drawBand(g, B[0], MP, 300, 130, lt, 2, -1, 0.7 * lerp(1, 0.55, fogK));
        }
        // 水上中层雾（0.12）
        drawBand(g, B[1], MP, 438, 110, lt, 4.8, -1, 0.42);
        // 右侧水面碎光（太阳在画外右侧）
        g.save();
        g.globalCompositeOperation = 'lighter';
        const be = c.be ? c.be(0.3) : 0;
        for (let i = 0; i < 60; i++) {
          const v = Math.pow(h2(i, 31), 1.4), y = HZ + 3 + v * 190;
          const x = 1060 + h2(i, 32) * 240 + v * 60;
          const len = 3 + v * 16 * (0.5 + h2(i, 33));
          const sh = 0.5 + 0.5 * Math.sin(lt * (1.5 + 2.5 * h2(i, 34)) + h2(i, 35) * TAU);
          const a = (0.34 - 0.2 * v) * sh * sh * (1 + 0.15 * be);
          if (a < 0.02) continue;
          g.fillStyle = `rgba(150,120,80,${a.toFixed(3)})`;
          g.fillRect(x, y, len, 0.8 + v);
        }
        g.restore();
        // 船头与人：同一个变换（起伏 ±2 px、摇摆 ±0.5°，绕脚下）
        const roll = (0.5 * Math.PI / 180) * Math.sin((TAU * lt) / 4);
        const bob = 2 * Math.sin((TAU * lt) / 4 + 1.1);
        g.save();
        g.translate(FX, FY + bob); g.rotate(roll); g.translate(-FX, -FY);
        drawBow(g);
        // 接触阴影与投影（光从右前方来，影子落向左下）
        g.save();
        g.translate(FX - 30, FY + 6); g.scale(1, 0.22); g.rotate(-0.35);
        let sg = g.createRadialGradient(0, 0, 0, 0, 0, 90);
        sg.addColorStop(0, 'rgba(10,12,14,0.45)'); sg.addColorStop(1, 'rgba(10,12,14,0)');
        g.fillStyle = sg; g.beginPath(); g.ellipse(-20, 0, 110, 40, 0, 0, TAU); g.fill();
        g.restore();
        sg = g.createRadialGradient(FX, FY + 1, 0, FX, FY + 1, 50);
        sg.addColorStop(0, 'rgba(8,9,11,0.55)'); sg.addColorStop(1, 'rgba(8,9,11,0)');
        g.save(); g.translate(FX, FY + 1); g.scale(1, 0.16); g.translate(-FX, -(FY + 1));
        g.fillStyle = sg; g.beginPath(); g.arc(FX, FY + 1, 50, 0, TAU); g.fill(); g.restore();
        // 人物先在不旋转的临时画布里画好（每帧整张清空），再随船头一起旋转贴上：
        // 直接在旋转后的画布上画时，XYT.sil 的离屏画布边缘会被双线性取样带进上一次留下的像素（见报告）
        {
          const zs = Math.min(z, 1.1);
          const ox = Math.floor(FX + FIGB.left - 40), oy = Math.floor(FY + FIGB.top - 24);
          const fs = scratch('fg1_i3_fig', FIGB.right - FIGB.left + 72, FIGB.bottom - FIGB.top + 36, zs);
          fs.g.translate(-ox, -oy);
          SIL.draw(fs.g, 'old', 'standBack', FX, FY, FH, lt + 3.1, { wind: 0.5, windDir: -1, rim: RIM, rimSide: 1, body: '#1d2128' });
          g.drawImage(fs.c, 0, 0, fs.c.width, fs.c.height, ox, oy, fs.c.width / fs.S, fs.c.height / fs.S);
        }
        // 脚下的接触暗部压在鞋尖上（鞋尖的亮边不至于像亮点）
        sg = g.createRadialGradient(FX, FY, 0, FX, FY, 40);
        sg.addColorStop(0, 'rgba(14,16,20,0.5)'); sg.addColorStop(1, 'rgba(14,16,20,0)');
        g.save(); g.translate(FX, FY); g.scale(1, 0.12); g.translate(-FX, -FY);
        g.fillStyle = sg; g.beginPath(); g.arc(FX, FY, 40, 0, TAU); g.fill(); g.restore();
        // 两只鞋尖：左脚在背光一侧、被右脚和下摆挡住，压暗；右脚只留一丝暖边
        // （鞋在 sil 里位于 ±(0.05..0.20)·h，亮边在每只鞋的右缘、下摆以下约 3 px 高）
        for (const [dx, k] of [[-5.4, 1], [19.4, 0.6]]) {
          const tx = FX + dx, ty = FY - 1.4;
          const tg = g.createRadialGradient(tx, ty, 0, tx, ty, 6);
          tg.addColorStop(0, `rgba(16,18,22,${k})`); tg.addColorStop(0.6, `rgba(16,18,22,${(k * 0.85).toFixed(3)})`); tg.addColorStop(1, 'rgba(16,18,22,0)');
          g.save(); g.translate(tx, ty); g.scale(1, 0.45); g.translate(-tx, -ty);
          g.fillStyle = tg; g.beginPath(); g.arc(tx, ty, 6, 0, TAU); g.fill(); g.restore();
        }
        g.restore();
        // 近处一缕薄雾（0.25），偶尔掠过下摆
        drawBand(g, B[2], MP, 548, 120, lt, 10, -1, 0.26);
        g.restore();
      },
    });
  })();

  // ============================================================
  // o2_depart 远去：春水上一叶小舟载着白发人的背影，顺流漂向远处的雾与暖光
  // 透视：相机高 3.1 m、焦距 1100 px、地平线 y=324；舟、花瓣都在同一个水平面上按真实透视投影
  // ============================================================
  (function () {
    const F = 1100, HC = 3.1, HY = 324, CX = 640;
    const proj = (X, Y, Z) => [CX + (F * X) / Z, HY + (F * (HC - Y)) / Z];
    const DUR = 6.69;
    const SEAT_Y = 0.2; // 船板高出水面
    // 老者坐点：lt=0 投影在 (380,560)，lt=DUR 投影在 (860,440)
    const zOf = (y) => (F * (HC - SEAT_Y)) / (y - HY);
    const S0 = [((380 - CX) * zOf(560)) / F, zOf(560)], S1 = [((860 - CX) * zOf(440)) / F, zOf(440)];
    const VEL = [(S1[0] - S0[0]) / DUR, (S1[1] - S0[1]) / DUR];
    const SPD = Math.hypot(VEL[0], VEL[1]);
    const DIR = [VEL[0] / SPD, VEL[1] / SPD]; // 水流与船头方向
    const LEFT = [-DIR[1], DIR[0]]; // 左舷方向
    const VPX = CX + (F * DIR[0]) / DIR[1]; // 河道灭点（画外右侧）
    const LB = 5.44, BB = 1.3; // 船长 3.2 倍身高、船宽
    const SEAT_U = -0.45;
    const GLOW = [985, 292];
    const HAZE = '#efe8e0';
    const seatAt = (lt) => [S0[0] + VEL[0] * lt, S0[1] + VEL[1] * lt];
    const fade = (lt) => 1 - smooth((lt - (DUR - 2)) / 2);
    // 船身横截：半宽与舷高（u：-1 船尾 … 1 船头）
    // 船尾是一块约 0.7 m 宽的方艄板（不是尖尾），船头收尖
    const halfB = (t) => (t > 0 ? (BB / 2) * Math.pow(Math.max(0, 1 - t * t), 0.5) : (BB / 2) * (0.55 + 0.45 * Math.pow(Math.max(0, 1 - t * t), 0.42)));
    const gunY = (t) => 0.27 + (t > 0 ? 0.24 * Math.pow(t, 4) : 0.18 * Math.pow(t, 4));
    // 岸线：远岸在船路左侧 40 m，近岸在右侧 9 m（都平行于水流）
    const FAR_W = 40, NEAR_W = -8.2;
    const bankPt = (w, s) => { const X = S0[0] + DIR[0] * s + LEFT[0] * w, Z = S0[1] + DIR[1] * s + LEFT[1] * w; return [X, Z]; };
    // 远岸线在画面里的 y（随 x）
    function farBankY(x) {
      // 解：投影 x 处远岸点的 Z
      // X = a + DIR0 s, Z = b + DIR1 s；(x-CX)/F = X/Z
      const a = S0[0] + LEFT[0] * FAR_W, b = S0[1] + LEFT[1] * FAR_W, k = (x - CX) / F;
      const sv = (k * b - a) / (DIR[0] - k * DIR[1]);
      const Z = b + DIR[1] * sv;
      return HY + (F * HC) / Z + (noise1(x / 46, 17) - 0.5) * 3.2 * clamp((VPX - x) / 900);
    }

    // ---- 树 ----
    // 递归长枝：返回线段与枝梢（花簇位置）
    function grow(r, x, y, len, ang, w, depth, segs, tips, spread) {
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      const cx = (x + x1) / 2 + Math.cos(ang + Math.PI / 2) * len * (r() - 0.5) * 0.25, cy = (y + y1) / 2 + Math.sin(ang + Math.PI / 2) * len * (r() - 0.5) * 0.25;
      segs.push({ x, y, cx, cy, x1, y1, w0: w, w1: w * 0.68, d: depth });
      if (depth <= 0 || len < 4) { tips.push([x1, y1, depth]); return; }
      const n = depth > 2 ? 2 + (r() < 0.4 ? 1 : 0) : 2;
      for (let i = 0; i < n; i++) {
        const da = (i - (n - 1) / 2) * spread * (0.7 + r() * 0.6) + (r() - 0.5) * 0.3;
        grow(r, x1, y1, len * (0.62 + r() * 0.2), ang + da, w * 0.68, depth - 1, segs, tips, spread);
      }
      if (depth <= 2) tips.push([x1, y1, depth]);
    }
    function strokeSegs(g, segs, col) {
      g.fillStyle = col;
      for (const sg of segs) {
        const dx = sg.x1 - sg.x, dy = sg.y1 - sg.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        g.beginPath();
        g.moveTo(sg.x + nx * sg.w0 / 2, sg.y + ny * sg.w0 / 2);
        g.quadraticCurveTo(sg.cx + nx * (sg.w0 + sg.w1) / 4, sg.cy + ny * (sg.w0 + sg.w1) / 4, sg.x1 + nx * sg.w1 / 2, sg.y1 + ny * sg.w1 / 2);
        g.lineTo(sg.x1 - nx * sg.w1 / 2, sg.y1 - ny * sg.w1 / 2);
        g.quadraticCurveTo(sg.cx - nx * (sg.w0 + sg.w1) / 4, sg.cy - ny * (sg.w0 + sg.w1) / 4, sg.x - nx * sg.w0 / 2, sg.y - ny * sg.w0 / 2);
        g.closePath(); g.fill();
      }
    }
    // 花簇：一团粉白小点（远）
    function blossomDabs(g, r, x, y, rad, n, cols, aMul) {
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * rad;
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;
        g.fillStyle = rgba(cols[Math.floor(r() * cols.length)], (0.35 + r() * 0.45) * aMul);
        const sz = rad * (0.12 + r() * 0.16);
        g.beginPath(); g.arc(px, py, sz, 0, TAU); g.fill();
      }
    }
    // 五瓣花（近）
    function flower(g, x, y, R, rot, col, core) {
      g.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        const a = rot + (k * TAU) / 5;
        g.beginPath(); g.ellipse(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.55, R * 0.4, a, 0, TAU); g.fill();
      }
      g.fillStyle = core; g.beginPath(); g.arc(x, y, R * 0.22, 0, TAU); g.fill();
    }
    const PINKS = ['#f6c9d2', '#f2b8c4', '#fbe3e8', '#eaa9b8', '#fff2f4'];
    // 一棵远处的桃树（底在 (x,y)，高 hpx），雾的浓度 hz：树冠是一团团粉色的花云，树干只露下半
    function farPeach(g, r, x, y, hpx, hz) {
      const trunkCol = mix('#4a3c38', HAZE, hz), cols = PINKS.map((c) => mix(c, HAZE, hz * 0.8));
      const segs = [], tips = [];
      grow(r, x, y, hpx * 0.34, -Math.PI / 2 + (r() - 0.5) * 0.25, Math.max(0.8, hpx * 0.05), 3, segs, tips, 0.55);
      strokeSegs(g, segs, trunkCol);
      g.fillStyle = rgba(cols[1], 0.3 * (1 - hz * 0.4));
      g.beginPath(); g.ellipse(x + (r() - 0.5) * hpx * 0.1, y - hpx * 0.68, hpx * 0.36, hpx * 0.28, 0, 0, TAU); g.fill();
      for (const [tx, ty] of tips) {
        const rad = hpx * (0.16 + r() * 0.08);
        g.fillStyle = rgba(cols[1], 0.32 * (1 - hz * 0.4));
        g.beginPath(); g.ellipse(tx, ty, rad, rad * 0.78, 0, 0, TAU); g.fill();
        blossomDabs(g, r, tx, ty, rad, 12, cols, 1 - hz * 0.45);
      }
    }
    // 远处的柳：嫩绿的一团垂丝（上圆下垂），树干只露一点
    function farWillow(g, r, x, y, hpx, hz) {
      const col = mix('#b4c793', HAZE, hz), dk = mix('#86a07a', HAZE, hz);
      g.strokeStyle = mix('#4a4038', HAZE, hz); g.lineWidth = Math.max(0.8, hpx * 0.04);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + hpx * 0.04, y - hpx * 0.35, x - hpx * 0.02, y - hpx * 0.6); g.stroke();
      const cy = y - hpx * 0.66;
      g.fillStyle = rgba(col, 0.55);
      g.beginPath(); g.ellipse(x, cy, hpx * 0.26, hpx * 0.2, 0, Math.PI, TAU); g.lineTo(x + hpx * 0.3, cy + hpx * 0.32); g.quadraticCurveTo(x, cy + hpx * 0.42, x - hpx * 0.3, cy + hpx * 0.32); g.closePath(); g.fill();
      for (let i = 0; i < 14; i++) {
        const sx = x + (r() - 0.5) * hpx * 0.5, sy = cy - hpx * 0.1 + r() * hpx * 0.12, L = hpx * (0.25 + r() * 0.25);
        g.strokeStyle = rgba(r() < 0.5 ? col : dk, 0.5 + r() * 0.3); g.lineWidth = Math.max(0.5, hpx * 0.025);
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + hpx * 0.02, sy + L * 0.5, sx + hpx * 0.04, sy + L); g.stroke();
      }
    }
    // 远岸的树：成丛（每丛 2–5 棵，丛间留空），退后岸线 1.5–7 m；桃多柳少
    const FAR_TREES = (() => {
      const r = rng(2024), out = [];
      let s = -60;
      while (s < 300) {
        const n = 2 + Math.floor(r() * 4), willow = r() < 0.28;
        for (let k = 0; k < n; k++) {
          const ss = s + k * (1.6 + r() * 2.4), back = 1.5 + r() * 5.5, [X, Z] = bankPt(FAR_W + back, ss);
          if (Z < 5) continue;
          out.push({ X, Z, ht: (willow ? 5 : 3.8) + r() * 2.4, kind: willow && k % 2 === 0 ? 'willow' : 'peach', seed: Math.floor(r() * 1e6) });
        }
        s += n * 2.4 + 3 + r() * 8;
      }
      out.sort((a, b) => b.Z - a.Z);
      return out;
    })();
    const hazeAt = (Z) => clamp(1 - Math.exp(-(Z - 18) / 70)) * 0.92;

    function paintSky(g) {
      g.fillStyle = A.vgrad(g, 0, HY + 40, [[0, '#e7e3de'], [0.55, '#f1ebe3'], [1, '#f6efe6']]);
      g.fillRect(0, 0, W, HY + 40);
      const gr = g.createRadialGradient(GLOW[0], GLOW[1], 0, GLOW[0], GLOW[1], 560);
      gr.addColorStop(0, 'rgba(250,230,200,0.9)'); gr.addColorStop(0.25, 'rgba(246,220,192,0.45)'); gr.addColorStop(0.6, 'rgba(240,216,196,0.12)'); gr.addColorStop(1, 'rgba(240,216,196,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, HY + 40);
    }
    function bgTex() {
      return K.cache('fg1_o2_bg', W, HY + 140, 1, (g) => {
        paintSky(g);
        // 远山：两道极淡的丘陵，向光的一侧隐入暖雾
        const mts = [
          { f: ridge([[140, 70, 200], [420, 88, 230], [700, 54, 200], [960, 40, 200]], HY + 2, 61, 0.5), col: '#c9d1cf', a: 0.55, blur: 2.6 },
          { f: ridge([[-30, 46, 160], [260, 52, 170], [540, 38, 160], [820, 26, 160]], HY + 4, 67, 0.6), col: '#b9c7c4', a: 0.6, blur: 1.8 },
        ];
        for (const M of mts) {
          blurInto(g, W, HY + 140, M.blur, (tg) => {
            ridgePath(tg, M.f, -20, W + 20, HY + 6, 3);
            tg.save(); tg.clip();
            const gr = tg.createLinearGradient(0, HY - 90, 0, HY + 6);
            gr.addColorStop(0, rgba(M.col, M.a)); gr.addColorStop(1, rgba(M.col, 0));
            tg.fillStyle = gr; tg.fillRect(-20, HY - 100, W + 40, 110);
            const hz = tg.createLinearGradient(500, 0, 1100, 0);
            hz.addColorStop(0, 'rgba(244,232,218,0)'); hz.addColorStop(1, 'rgba(246,230,212,0.85)');
            tg.fillStyle = hz; tg.fillRect(-20, HY - 100, W + 40, 110);
            tg.restore();
          });
        }
        // 远岸：一条草岸（近处宽、远处窄），岸上的树按远近画
        blurInto(g, W, HY + 140, 0.8, (tg) => {
          tg.beginPath();
          tg.moveTo(-20, farBankY(-20));
          for (let x = -20; x <= W + 20; x += 8) tg.lineTo(x, farBankY(x));
          for (let x = W + 20; x >= -20; x -= 8) { const yb = farBankY(x); tg.lineTo(x, yb - (yb - HY) * 0.55); }
          tg.closePath();
          const gr = tg.createLinearGradient(0, HY, 0, HY + 90);
          gr.addColorStop(0, mix('#9fae9a', HAZE, 0.8)); gr.addColorStop(1, mix('#8fa18d', HAZE, 0.35));
          tg.fillStyle = gr; tg.fill();
          // 岸边一道湿泥的深色
          tg.strokeStyle = rgba(mix('#5c6658', HAZE, 0.3), 0.5); tg.lineWidth = 1.2;
          tg.beginPath(); for (let x = -20; x <= W + 20; x += 8) { const y = farBankY(x) - 0.6; if (x === -20) tg.moveTo(x, y); else tg.lineTo(x, y); } tg.stroke();
          for (const T of FAR_TREES) {
            const [x, y] = proj(T.X, 0.3, T.Z);
            if (x < -120 || x > W + 120) continue;
            const hpx = (F * T.ht) / T.Z, hz = hazeAt(T.Z), r = rng(T.seed);
            if (T.kind === 'peach') farPeach(tg, r, x, y, hpx, hz); else farWillow(tg, r, x, y, hpx, hz);
          }
        });
        // 远处的雾：向灭点越来越浓
        const gr = g.createLinearGradient(0, 0, W, 0);
        gr.addColorStop(0, 'rgba(240,234,226,0.1)'); gr.addColorStop(0.6, 'rgba(242,232,222,0.35)'); gr.addColorStop(1, 'rgba(246,232,214,0.75)');
        g.fillStyle = gr;
        g.save(); g.beginPath();
        g.moveTo(0, HY - 120); g.lineTo(W, HY - 120); g.lineTo(W, HY + 100); g.lineTo(0, HY + 100); g.closePath(); g.clip();
        g.fillRect(0, HY - 120, W, 220);
        g.restore();
      });
    }
    // 水面：天光、暖色光带、远岸倒影（以岸线为轴翻转，压暗偏冷，向近处渐淡）
    function waterTex() {
      return K.cache('fg1_o2_water', W, H - HY, 1, (g) => {
        g.translate(0, -HY);
        g.fillStyle = A.vgrad(g, HY, H, [[0, '#f1ebe3'], [0.18, '#dfe2dc'], [0.6, '#c8d3cf'], [1, '#b6c4c0']]);
        g.fillRect(0, HY, W, H - HY);
        const gr = g.createRadialGradient(GLOW[0], HY + 8, 0, GLOW[0], HY + 8, 600);
        gr.addColorStop(0, 'rgba(250,228,198,0.65)'); gr.addColorStop(0.4, 'rgba(244,222,198,0.22)'); gr.addColorStop(1, 'rgba(244,222,198,0)');
        g.save(); g.translate(GLOW[0], HY + 8); g.scale(0.55, 1); g.translate(-GLOW[0], -(HY + 8));
        g.fillStyle = gr; g.fillRect(-400, HY, W + 800, H - HY); g.restore();
        // 远岸树的倒影
        blurInto(g, W, H, 1.8, (tg) => {
          tg.save();
          tg.beginPath(); tg.moveTo(-20, farBankY(-20)); for (let x = -20; x <= W + 20; x += 8) tg.lineTo(x, farBankY(x)); tg.lineTo(W + 20, H); tg.lineTo(-20, H); tg.closePath(); tg.clip();
          for (const T of FAR_TREES) {
            const [x, y] = proj(T.X, 0.3, T.Z);
            if (x < -120 || x > W + 120) continue;
            const hpx = (F * T.ht) / T.Z, hz = Math.min(1, hazeAt(T.Z) + 0.15), r = rng(T.seed);
            const yw = farBankY(x);
            tg.save(); tg.translate(0, 2 * yw); tg.scale(1, -1);
            tg.globalAlpha = 0.5;
            if (T.kind === 'peach') farPeach(tg, r, x, y, hpx, hz); else farWillow(tg, r, x, y, hpx, hz);
            tg.restore();
          }
          tg.restore();
        });
        // 细纹（顺水流方向的极淡横纹）
        const r = rng(4411);
        for (let i = 0; i < 300; i++) {
          const v = Math.pow(r(), 1.3), y = HY + 4 + v * (H - HY);
          const len = 8 + (y - HY) * (0.25 + r() * 0.8), x = r() * (W + 100) - 50;
          g.strokeStyle = r() < 0.55 ? rgba('#fbf6ee', 0.07 + r() * 0.07) : rgba('#8a9c98', 0.04 + r() * 0.05);
          g.lineWidth = 0.6 + v * 1.2;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
        }
      });
    }
    // 花云：一簇桃花（逆光：朝光的一侧边缘更亮）
    function blossomCloud(g, r, x, y, rad, aMul) {
      g.fillStyle = rgba('#f0b3c1', 0.28 * aMul);
      g.beginPath(); g.ellipse(x, y, rad, rad * 0.8, 0, 0, TAU); g.fill();
      for (let i = 0; i < 30; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * rad;
        const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;
        const lit = Math.cos(a + 0.6) > 0.35 && d > rad * 0.45; // 右上方的边缘受逆光
        g.fillStyle = rgba(lit ? (r() < 0.5 ? '#fff4f2' : '#fde3e6') : PINKS[Math.floor(r() * 4)], (0.4 + r() * 0.45) * aMul);
        g.beginPath(); g.arc(px, py, rad * (0.1 + r() * 0.12), 0, TAU); g.fill();
      }
      for (let i = 0; i < 6; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * rad * 0.7;
        g.fillStyle = rgba('#d98ba0', 0.25 * aMul);
        g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rad * 0.12, 0, TAU); g.fill();
      }
    }
    // 近岸（右下角一角草岸）与岸上的桃树（逆光，花缘透亮）
    const TREE_BASE = [1212, 604];
    function nearTex() {
      return K.cache('fg1_o2_near', W, H, 1, (g) => {
        const pA = proj(...(() => { const [X, Z] = bankPt(NEAR_W, -6); return [X, 0, Z]; })());
        const pB = [VPX, HY];
        const bankX = (y) => pA[0] + ((pB[0] - pA[0]) * (y - pA[1])) / (pB[1] - pA[1]);
        // 草岸：岸线略有起伏，岸脚一道湿泥；岸面受逆光，靠水一侧略亮
        // 岸线的弯曲按透视：世界里等距的缓弯，近处约 120 px 一个起伏、幅度 ±12 px，向远处变密变小
        const edgeX = (y) => {
          // 远处的细弯已小于一两个像素、又在雾里，幅度按距离平方收掉，免得采样出锯齿
          const d = Math.max(1, y - HY), k = (d / 396) * (d / 396);
          return bankX(y) - 4 + k * (12 * Math.sin(8211 / d + 0.7) + 3 * Math.sin((8211 / d) * 2.3 + 2.1)) + (noise1(y / 22, 5) - 0.5) * 6 * clamp((y - 400) / 220);
        };
        blurInto(g, W, H, 0.7, (tg) => {
          tg.beginPath();
          tg.moveTo(edgeX(H + 20), H + 20);
          for (let y = H + 20; y >= 370; y -= 2) tg.lineTo(edgeX(y), y);
          tg.lineTo(W + 40, 370); tg.lineTo(W + 40, H + 40); tg.closePath();
          tg.save(); tg.clip();
          let gr = tg.createLinearGradient(0, 380, 0, H);
          gr.addColorStop(0, '#b9c1a6'); gr.addColorStop(0.5, '#98a684'); gr.addColorStop(1, '#6f7f5e');
          tg.fillStyle = gr; tg.fillRect(900, 360, 420, 400);
          // 靠水边一道亮（逆光掠过草尖）
          tg.strokeStyle = 'rgba(232,230,206,0.45)'; tg.lineWidth = 10;
          tg.beginPath(); for (let y = H + 20; y >= 370; y -= 2) { const x = edgeX(y) + 8; if (y === H + 20) tg.moveTo(x, y); else tg.lineTo(x, y); } tg.stroke();
          // 草纹与花瓣
          const r = rng(31);
          for (let i = 0; i < 420; i++) {
            const y = 380 + Math.pow(r(), 0.8) * 360, x = edgeX(y) + 2 + r() * (W - edgeX(y) + 20);
            const k = (y - 360) / 360, hh = 3 + r() * 9 * k;
            tg.strokeStyle = rgba(r() < 0.5 ? '#6c7c58' : '#a5b28a', 0.5 + r() * 0.3); tg.lineWidth = 0.6 + k * 0.8;
            tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + 1.2, y - hh * 0.6, x + 2.5 + r() * 2, y - hh); tg.stroke();
          }
          for (let i = 0; i < 60; i++) {
            const y = 420 + r() * 300, x = edgeX(y) + 6 + r() * (W - edgeX(y));
            tg.fillStyle = rgba(PINKS[Math.floor(r() * 5)], 0.75);
            tg.beginPath(); tg.ellipse(x, y, 1.2 + (y - 400) / 160, 0.7 + (y - 400) / 300, 0, 0, TAU); tg.fill();
          }
          // 越远越淡：岸的远端罩一层雾色
          const hz = tg.createLinearGradient(0, 380, 0, 560);
          hz.addColorStop(0, rgba(HAZE, 0.75)); hz.addColorStop(1, rgba(HAZE, 0));
          tg.fillStyle = hz; tg.fillRect(900, 360, 420, 200);
          tg.restore();
          // 岸脚湿泥与几块石头
          tg.strokeStyle = 'rgba(70,70,56,0.55)'; tg.lineWidth = 2.2;
          tg.beginPath(); for (let y = H + 20; y >= 370; y -= 2) { const x = edgeX(y); if (y === H + 20) tg.moveTo(x, y); else tg.lineTo(x, y); } tg.stroke();
          for (const yy of [468, 540, 612, 690]) {
            const x = edgeX(yy), sz = (yy - 380) / 30;
            tg.fillStyle = '#8b8a7c'; tg.beginPath(); tg.ellipse(x + sz * 0.6, yy, sz * 1.3, sz * 0.7, -0.2, 0, TAU); tg.fill();
            tg.fillStyle = 'rgba(232,226,210,0.5)'; tg.beginPath(); tg.ellipse(x + sz * 0.9, yy - sz * 0.25, sz * 0.7, sz * 0.25, -0.2, 0, TAU); tg.fill();
          }
        });
        // 倒影：树冠在水面里的淡粉色影子（近岸水线为轴）
        const r = rng(778);
        const segs = [], tips = [];
        // 粗短的主干，向水面一侧微倾，再分枝
        segs.push({ x: TREE_BASE[0], y: TREE_BASE[1], cx: TREE_BASE[0] - 8, cy: TREE_BASE[1] - 70, x1: TREE_BASE[0] - 26, y1: TREE_BASE[1] - 150, w0: 15, w1: 11, d: 6 });
        grow(r, TREE_BASE[0] - 26, TREE_BASE[1] - 150, 84, -Math.PI / 2 - 0.4, 10, 4, segs, tips, 0.6);
        grow(r, TREE_BASE[0] - 26, TREE_BASE[1] - 150, 80, -Math.PI / 2 + 0.25, 9, 3, segs, tips, 0.6);
        grow(r, TREE_BASE[0] - 18, TREE_BASE[1] - 110, 52, -Math.PI / 2 - 0.85, 6, 3, segs, tips, 0.55);
        blurInto(g, W, H, 0.6, (tg) => { strokeSegs(tg, segs, '#43352f'); });
        blurInto(g, W, H, 0.45, (tg) => {
          for (const [tx, ty] of tips) blossomCloud(tg, r, tx, ty, 15 + r() * 12, 1);
        });
        // 树根处的影子
        g.save(); g.globalCompositeOperation = 'multiply';
        const sg = g.createRadialGradient(TREE_BASE[0] - 14, TREE_BASE[1] + 4, 0, TREE_BASE[0] - 14, TREE_BASE[1] + 4, 60);
        sg.addColorStop(0, 'rgba(96,100,86,0.55)'); sg.addColorStop(1, 'rgba(96,100,86,0)');
        g.translate(TREE_BASE[0] - 14, TREE_BASE[1] + 4); g.scale(1, 0.28); g.translate(-(TREE_BASE[0] - 14), -(TREE_BASE[1] + 4));
        g.fillStyle = sg; g.fillRect(TREE_BASE[0] - 90, TREE_BASE[1] - 60, 160, 130);
        g.restore();
      });
    }
    // 左上角近处虚化的大桃枝（焦外）：枝从画外伸进来，画布留足边距，模糊不会被裁成直边
    const BR_W = 820, BR_H = 460;
    function branchGrow() {
      const r = rng(5150), segs = [], tips = [];
      grow(r, -40, -30, 200, 0.36, 20, 4, segs, tips, 0.48);
      return { r, segs, tips: tips.filter((t) => t[0] < BR_W - 120 && t[1] < BR_H - 110) };
    }
    function branchTex() {
      return K.cache('fg1_o2_branch', BR_W, BR_H, 0.5, (g) => {
        const { r, segs, tips } = branchGrow();
        blurInto(g, BR_W, BR_H, 5, (tg) => {
          strokeSegs(tg, segs.filter((sg) => sg.x1 < BR_W - 100 && sg.y1 < BR_H - 90), '#4c3c38');
          for (const [tx, ty] of tips) {
            for (let k = 0; k < 6; k++) {
              const a = r() * TAU, d = Math.sqrt(r()) * 24;
              flower(tg, tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.8, 7 + r() * 5, r() * TAU, mix(PINKS[Math.floor(r() * 4)], '#f6efe8', 0.35), '#e3a0b0');
            }
          }
        });
      });
    }
    const BR_TIPS = branchGrow().tips.filter((t) => t[0] > 30 && t[1] > 10);

    // ---- 船 ----
    function boatW(lt, u, w, Y) {
      const st = seatAt(lt);
      const cx = st[0] - DIR[0] * SEAT_U, cz = st[1] - DIR[1] * SEAT_U;
      return [cx + DIR[0] * u + LEFT[0] * w, Y, cz + DIR[1] * u + LEFT[1] * w];
    }
    const NST = 16;
    // bob：整组（人、船）在画面里的起伏；水线点反向抵消，水线始终贴在水面上（船上浮时露出的干舷变高）
    function hullPts(lt, mirror, bob) {
      const sgn = mirror ? -1 : 1, wb = (mirror ? 1 : -1) * (bob || 0);
      const gp = [], gs = [], wp = [], ws = [];
      for (let i = 0; i <= NST; i++) {
        const t = -1 + (2 * i) / NST, u = (t * LB) / 2, b = halfB(t), gy = gunY(t);
        gp.push(proj(...boatW(lt, u, b, sgn * gy))); gs.push(proj(...boatW(lt, u, -b, sgn * gy)));
        // 水线两端内收（艄板、船头都向上外倾），水线处的半宽按水线所在的站位取；
        // 正像与倒影在水线处各多盖约 1 cm（不露缝），正像中段再低约 1.5 cm（船底的弧）
        const tw = t * (t < 0 ? 0.9 : 0.94), uw = (tw * LB) / 2, bw = halfB(tw) * 0.86;
        const wy = mirror ? 0.012 : -0.012 - 0.015 * (1 - t * t);
        const a = proj(...boatW(lt, uw, bw, wy)), b2 = proj(...boatW(lt, uw, -bw, wy));
        wp.push([a[0], a[1] + wb]); ws.push([b2[0], b2[1] + wb]);
      }
      return { gp, gs, wp, ws };
    }
    // 船的外轮廓：远舷上沿（船尾→船头）→ 近舷水线（船头→船尾）→ 艄板下沿
    function hullOutline(g, H, up) {
      g.beginPath();
      g.moveTo(H.gp[0][0], H.gp[0][1] - up);
      for (let i = 1; i <= NST; i++) g.lineTo(H.gp[i][0], H.gp[i][1] - up);
      for (let i = NST; i >= 0; i--) g.lineTo(H.ws[i][0], H.ws[i][1] + up);
      g.lineTo(H.wp[0][0], H.wp[0][1] + up);
      g.closePath();
    }
    const poly = (g, pts, cont) => { if (cont) g.lineTo(pts[0][0], pts[0][1]); else g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    function drawHull(g, lt, part, mirror, bob) {
      const HP = hullPts(lt, mirror, bob), { gp, gs, wp, ws } = HP;
      if (part === 'inner') {
        // 舱内：两舷上沿围成的面，裁在船的外轮廓里（远舷上沿的亮线留整宽）。左舷内侧迎着前方偏右的光，略暖；舱底偏暗、偏灰
        g.save();
        hullOutline(g, HP, 1.2); g.clip();
        g.beginPath(); poly(g, gp); poly(g, gs.slice().reverse(), 1); g.closePath();
        const a = gp[Math.floor(NST / 2)], b = gs[Math.floor(NST / 2)];
        const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
        gr.addColorStop(0, '#5e5046'); gr.addColorStop(0.4, '#4a4039'); gr.addColorStop(1, '#33302d');
        g.fillStyle = gr; g.fill();
        // 舱底顺长的几道板缝
        g.strokeStyle = 'rgba(28,25,23,0.32)'; g.lineWidth = 0.8;
        for (const f of [0.3, 0.52, 0.74]) {
          g.beginPath();
          for (let i = 0; i <= NST; i++) { const x = lerp(gp[i][0], gs[i][0], f), y = lerp(gp[i][1], gs[i][1], f); if (!i) g.moveTo(x, y); else g.lineTo(x, y); }
          g.stroke();
        }
        // 横撑（坐板）
        g.strokeStyle = 'rgba(36,32,29,0.75)'; g.lineWidth = 1.4;
        for (const k of [4, 9, 13]) { g.beginPath(); g.moveTo(gp[k][0], gp[k][1]); g.lineTo(gs[k][0], gs[k][1]); g.stroke(); }
        // 左舷上沿：一道受光的木色
        g.strokeStyle = 'rgba(196,174,150,0.5)'; g.lineWidth = 1.3;
        g.beginPath(); poly(g, gp); g.stroke();
        g.restore();
        return;
      }
      // 右舷外板：背光，上缘略亮、近水线处更深
      g.beginPath(); poly(g, gs); poly(g, ws.slice().reverse(), 1); g.closePath();
      const m = Math.floor(NST / 2);
      const gr = g.createLinearGradient(0, gs[m][1], 0, ws[m][1]);
      if (mirror) { gr.addColorStop(0, '#46504e'); gr.addColorStop(1, '#3b4543'); }
      else { gr.addColorStop(0, '#3c4644'); gr.addColorStop(1, '#262e2d'); }
      g.fillStyle = gr; g.fill();
      // 艄板：朝着镜头、背着光，最暗；上沿一道逆光亮边
      const tq = () => { g.beginPath(); g.moveTo(gs[0][0], gs[0][1]); g.lineTo(gp[0][0], gp[0][1]); g.lineTo(wp[0][0], wp[0][1]); g.lineTo(ws[0][0], ws[0][1]); g.closePath(); };
      tq(); g.fillStyle = mirror ? '#384240' : '#2a3231'; g.fill();
      // 艄板与右舷外板共用的棱：两块各自抗锯齿会在棱上透出一道浅缝，用艄板色描一笔盖住
      g.strokeStyle = g.fillStyle; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(gs[0][0], gs[0][1]); g.lineTo(ws[0][0], ws[0][1]); g.stroke();
      if (mirror) return;
      g.strokeStyle = 'rgba(16,20,20,0.35)'; g.lineWidth = 0.8; tq(); g.stroke();
      g.strokeStyle = 'rgba(248,230,204,0.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(gs[0][0], gs[0][1] - 0.5); g.lineTo(gp[0][0], gp[0][1] - 0.5); g.stroke();
      // 船板缝
      g.strokeStyle = 'rgba(140,146,136,0.2)'; g.lineWidth = 0.8;
      for (const f of [0.35, 0.68]) {
        g.beginPath();
        for (let i = 0; i <= NST; i++) { const p = [lerp(gs[i][0], ws[i][0], f), lerp(gs[i][1], ws[i][1], f)]; if (!i) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); }
        g.stroke();
      }
      // 舷上沿的木条与逆光亮边（光在前方偏右）
      g.strokeStyle = '#4d4842'; g.lineWidth = 2.2; g.lineJoin = 'round';
      g.beginPath(); poly(g, gs); g.stroke();
      g.strokeStyle = 'rgba(248,230,204,0.85)'; g.lineWidth = 1;
      g.beginPath(); poly(g, gs.map((p) => [p[0], p[1] - 0.9])); g.stroke();
    }
    // 船与人画进临时画布（正像、倒影各一张），再按雾的浓度与淡出合成
    const GW2 = 520, GH2 = 300;
    function groupBox(lt) {
      const st = seatAt(lt), sp = proj(st[0], SEAT_Y, st[1]);
      return [Math.floor(sp[0] - GW2 / 2), Math.floor(sp[1] - 200)];
    }
    function drawGroup(lt, mirror) {
      const st = seatAt(lt), Z = st[1];
      const [ox, oy] = groupBox(lt);
      const sc = scratch(mirror ? 'fg1_o2_gr' : 'fg1_o2_g', GW2, GH2), g = sc.g;
      g.translate(-ox, -oy);
      const bob = 1.0 * Math.sin((TAU * lt) / 3.8 + 0.6);
      g.translate(0, mirror ? -bob : bob);
      const hpx = (F * 1.7) / Z;
      const sp = proj(st[0], mirror ? -SEAT_Y : SEAT_Y, Z);
      const opts = { wind: 0.3, windDir: 1, rim: '#f6e2c4', rimSide: 1, body: '#262c2b' };
      if (!mirror) {
        drawHull(g, lt, 'inner', false, bob);
        SIL.draw(g, 'old', 'sitBoat', sp[0], sp[1], hpx, lt + 0.9, opts);
        drawHull(g, lt, 'outer', false, bob);
      } else {
        g.save(); g.translate(sp[0], sp[1]); g.scale(1, -1); g.translate(-sp[0], -sp[1]);
        SIL.draw(g, 'old', 'sitBoat', sp[0], sp[1], hpx, lt + 0.9, opts);
        g.restore();
        drawHull(g, lt, 'outer', true, bob);
      }
      // 远去：随距离偏向雾色
      const hz = clamp((Z - 13) / 40) * 0.55;
      if (hz > 0.01) { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = rgba(HAZE, hz); g.fillRect(0, 0, sc.c.width, sc.c.height); g.restore(); }
      return { c: sc.c, ox, oy, S: sc.S };
    }

    // ---- 水上花瓣：与船同向同速漂流（世界坐标），远小近大、远淡 ----
    const NPET = 340;
    const PET = (() => {
      const out = [];
      for (let i = 0; i < NPET; i++) out.push({ w: lerp(NEAR_W + 1.2, FAR_W - 3, Math.pow(h2(i, 401), 1.3)), s0: h2(i, 402), rot: h2(i, 403) * TAU, sz: 0.03 + 0.022 * h2(i, 404), c: Math.floor(h2(i, 405) * 5) });
      return out;
    })();
    function petalsOnWater(g, lt, zBoat, front) {
      const st = seatAt(lt);
      for (let i = 0; i < NPET; i++) {
        const P = PET[i];
        // 这一瓣的漂流路线：近端在 Z≈6（画外），远端在 Z≈80（看不见）
        const zw = S0[1] + LEFT[1] * P.w;
        const sMin = (6 - zw) / DIR[1], sMax = (52 - zw) / DIR[1], span = sMax - sMin;
        const sv = sMin + ((((P.s0 * span + SPD * (lt + 1.2)) % span) + span) % span);
        const X = S0[0] + DIR[0] * sv + LEFT[0] * P.w, Z = zw + DIR[1] * sv;
        if ((Z < zBoat) !== front) continue;
        // 船底下的花瓣不画（船与花瓣同速，相对位置不变）
        const du = (X - st[0]) * DIR[0] + (Z - st[1]) * DIR[1] - SEAT_U, dw = (X - st[0]) * LEFT[0] + (Z - st[1]) * LEFT[1];
        if (Math.abs(du) < LB / 2 && Math.abs(dw) < halfB((2 * du) / LB) + 0.1) continue;
        const [x, y] = proj(X, 0, Z);
        if (x < -10 || x > W + 10 || y > H + 6) continue;
        const rx = Math.max(0.8, (F * P.sz * 1.4) / Z), ry = Math.max(0.5, rx * (HC / Z) * 1.7);
        const a = clamp((52 - Z) / 14) * clamp(1.3 - Z / 60) * 0.9;
        if (a < 0.02) continue;
        g.fillStyle = rgba(PINKS[P.c], a);
        g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
      }
    }

    // ---- 拍点上从近枝落下的花瓣（离镜头约 4.5 m，焦外、偏大） ----
    // 花瓣贴图：瓣根略深、瓣尖偏白，尖端一个浅凹口；建缓存时模糊（缩小贴上后约 2 px 的焦外虚）
    const PET_SZ = 64, PET_LEN = 40;
    function petalTex() {
      return K.cache('fg1_o2_petal', PET_SZ, PET_SZ, 1, (g) => {
        blurInto(g, PET_SZ, PET_SZ, 4.5, (tg) => {
          const c = PET_SZ / 2, x0 = c - PET_LEN / 2, x1 = c + PET_LEN / 2;
          const gr = tg.createLinearGradient(x0, 0, x1, 0);
          gr.addColorStop(0, '#e59bad'); gr.addColorStop(0.4, '#f3c2cc'); gr.addColorStop(1, '#fcebee');
          tg.fillStyle = gr;
          tg.beginPath();
          tg.moveTo(x0, c);
          tg.bezierCurveTo(x0 + 9, c - 6, x1 - 16, c - 13.5, x1 - 2, c - 8);
          tg.quadraticCurveTo(x1 + 1, c - 6, x1 - 4, c);
          tg.quadraticCurveTo(x1 + 1, c + 6, x1 - 2, c + 8);
          tg.bezierCurveTo(x1 - 16, c + 13.5, x0 + 9, c + 6, x0, c);
          tg.closePath(); tg.fill();
          // 一道淡淡的中脉
          tg.strokeStyle = 'rgba(214,128,148,0.35)'; tg.lineWidth = 1.2;
          tg.beginPath(); tg.moveTo(x0 + 2, c); tg.quadraticCurveTo(c, c - 0.6, x1 - 8, c); tg.stroke();
        });
      });
    }
    function fallingPetals(g, c) {
      if (!c.grid || !c.b) return;
      const i0 = c.b.i;
      for (let k = 0; k < 13; k++) {
        const bi = i0 - k;
        const t0 = c.grid.time(bi);
        const age = c.t - t0;
        if (age < 0 || age > 9) continue; // 9 s 内一定已落出画面（最慢约 6.4 s）
        if (h2(bi, 77) < 0.35) continue; // 不是每拍都落
        const tip = BR_TIPS[Math.floor(h2(bi, 78) * BR_TIPS.length)];
        if (!tip) continue;
        // 风向右：水平漂 + 摆荡；下落有终速（先加速，0.4 s 后接近匀速）
        const vy = 125 + 40 * h2(bi, 79), vx = 70 + 40 * h2(bi, 80);
        const yy = tip[1] + vy * (age - 0.4 * (1 - Math.exp(-age / 0.4)));
        const xx = tip[0] + vx * age + 18 * Math.sin(age * 2.4 + h2(bi, 81) * TAU) * smooth(age / 0.6);
        if (yy > H + 30 || xx > W + 30) continue;
        const a = smooth(age / 0.35) * 0.9;
        // 翻转：薄片绕长轴翻（宽度按 |cos| 变），同时略绕短轴摆（长度微变）
        const flip = Math.cos(age * 3.1 + h2(bi, 82) * TAU), nod = Math.cos(age * 1.7 + h2(bi, 85) * TAU);
        const L = (1.9 * (7 + 3 * h2(bi, 84))) / PET_LEN; // 比枝上花瓣略大（13–19 px）
        g.save();
        g.globalAlpha = a;
        g.translate(xx, yy); g.rotate(age * 1.3 + h2(bi, 83) * TAU);
        g.scale(L * (0.72 + 0.28 * Math.abs(nod)), L * (0.22 + 0.78 * Math.abs(flip)));
        g.drawImage(petalTex(), -PET_SZ / 2, -PET_SZ / 2, PET_SZ, PET_SZ);
        g.restore();
      }
    }

    const MP = 1600;
    const bands = () => [mistBand('fg1_o2_m1', MP, 110, 311, '#f6f0e8', 0.7), mistBand('fg1_o2_m2', MP, 90, 323, '#f7f2ec', 0.9, 0.35)];

    XYT.registerShot('o2_depart', {
      name: '远去', zone: 'bottom', night: false,
      text: '#2a2622', shadow: 'rgba(250,246,236,0.85)', accent: '#d9667e', bloom: 0.3,
      draw(g, c) {
        const lt = c.lt, S = SS();
        const B = bands();
        g.drawImage(bgTex(), 0, 0, W, HY + 140);
        g.drawImage(waterTex(), 0, HY, W, H - HY);
        // 远岸水线以下重新压一次远岸（水面贴图从地平线开始，远岸在它上面）
        g.save();
        g.beginPath(); g.moveTo(-20, HY); for (let x = -20; x <= W + 20; x += 16) g.lineTo(x, farBankY(x) + 0.5); g.lineTo(W + 20, HY); g.closePath(); g.clip();
        g.drawImage(bgTex(), 0, 0, W, HY + 140);
        g.restore();
        // 远雾漂移（风向右）
        const de = c.de ? c.de(0.6) : 0;
        drawBand(g, B[0], MP, HY - 70, 110, lt, 3, 1, 0.55);
        const st = seatAt(lt), zB = st[1];
        // 船的倒影
        const al = fade(lt);
        if (al > 0.003) {
          const R = drawGroup(lt, true);
          const sp = proj(st[0], 0, zB);
          g.save();
          g.globalAlpha = 0.45 * al;
          for (let y = 0; y < GH2; y += 2) {
            const yy = R.oy + y;
            const k = clamp((yy - sp[1]) / 90);
            const dx = (0.3 + 1.6 * k) * Math.sin(yy * 0.17 + lt * 2.0) + 0.5 * k * Math.sin(yy * 0.06 - lt * 1.3);
            g.drawImage(R.c, 0, y * S, R.c.width, 2 * S, R.ox + dx, yy, GW2, 2);
          }
          g.restore();
        }
        petalsOnWater(g, lt, zB, false);
        if (al > 0.003) {
          // 船头分开水面的细纹：从船头水线端点起，贴着水线外侧向后张开，约 1.6 m 内淡去。
          // 两舷都画在船身之前：贴着船身的那一小段由船身盖住，船板上不会出现亮线
          const bowRipple = (sd) => {
            const NS = 16, L = 1.6, pts = [];
            for (let i = 0; i <= NS; i++) {
              const s = (L * i) / NS, u = (0.94 * LB) / 2 - s;
              pts.push(proj(...boatW(lt, u, sd * (0.86 * halfB((2 * u) / LB) + 0.02 + 0.18 * s), 0)));
            }
            const p0 = pts[0], p1 = pts[NS];
            const line = (dy) => { g.beginPath(); g.moveTo(p0[0], p0[1] + dy); for (let i = 1; i <= NS; i++) g.lineTo(pts[i][0], pts[i][1] + dy); g.stroke(); };
            const grad = (col, a) => {
              const gr = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
              for (const k of [0, 0.25, 0.5, 0.75, 1]) gr.addColorStop(k, rgba(col, a * Math.pow(1 - k, 1.3)));
              return gr;
            };
            g.save(); g.lineJoin = 'round';
            // 波谷（外侧一道暗线）与波峰（迎天光的亮线）
            g.strokeStyle = grad('#5a6c6a', 0.4 * al); g.lineWidth = 1.1; line(sd < 0 ? 1.2 : -1.2);
            g.strokeStyle = grad('#fdfbf7', 0.95 * al); g.lineWidth = 0.9; line(sd < 0 ? 0.25 : -0.25);
            g.restore();
          };
          bowRipple(1);
          bowRipple(-1);
          const G = drawGroup(lt, false);
          g.save(); g.globalAlpha = al;
          g.drawImage(G.c, G.ox, G.oy, GW2, GH2);
          g.restore();
        }
        petalsOnWater(g, lt, zB, true);
        // 近岸与桃树
        g.drawImage(nearTex(), 0, 0, W, H);
        // 低雾（风向右）
        drawBand(g, B[1], MP, HY + 10, 90, lt, 7, 1, 0.45);
        // 远处暖光：强拍上微亮
        g.save();
        g.globalCompositeOperation = 'screen';
        const gl = g.createRadialGradient(GLOW[0], GLOW[1], 0, GLOW[0], GLOW[1], 360);
        const ga = 0.16 + 0.05 * de;
        gl.addColorStop(0, `rgba(255,236,210,${ga.toFixed(3)})`); gl.addColorStop(1, 'rgba(255,236,210,0)');
        g.fillStyle = gl; g.fillRect(GLOW[0] - 360, GLOW[1] - 360, 720, 720);
        g.restore();
        // 左上角焦外桃枝（轻摆）与落瓣
        const sw = 0.006 * Math.sin((TAU * lt) / 5.2) + 0.003 * Math.sin((TAU * lt) / 2.9 + 1);
        g.save(); g.translate(-30, -20); g.rotate(sw); g.translate(30, 20);
        g.drawImage(branchTex(), 0, 0, BR_W, BR_H);
        g.restore();
        fallingPetals(g, c);
      },
    });
  })();
})();
