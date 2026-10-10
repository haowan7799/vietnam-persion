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
  function scratch(key, w, h) {
    const S = SS();
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
  // 建缓存用：在临时画布里画，再（可带模糊）贴回；ctx.filter 只在这里用
  function blurInto(g, w, h, blur, fn, op, alpha) {
    const sc = g.getTransform().a;
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc));
    const tg = t.getContext('2d'); tg.scale(sc, sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = op || 'source-over';
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
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
  function mistBand(key, P, h, seed, col, lumpy) {
    return K.cache(key, P, h, 0.5, (g) => {
      const sc = g.getTransform().a;
      const pw = Math.round(P * sc), ph = Math.round(h * sc);
      const img = g.createImageData(pw, ph), d = img.data;
      const [r0, g0, b0] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
      const cols = new Float32Array(pw), cen = new Float32Array(pw), wid = new Float32Array(pw);
      for (let px = 0; px < pw; px++) {
        const x = px / sc;
        cols[px] = clamp(0.62 + lumpy * 0.55 * pnoise(x, P, seed, 7));
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
    // 撑篙周期 2 秒：p∈[0.15,0.62] 篙尖钉在河床上推船，其余时间收篙、前送、再下篙
    const PA = 0.15, PB = 0.62, TB0 = 0.35;
    const V0 = 45, DV = 7;
    const X0 = 280;
    const BED = WY + 80; // 河床（篙尖着点）
    const LP = 158; // 篙长
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
      const phi = lerp(phE, phN, cosE(u));
      // 收篙：篙尖升到水面上约 3 像素（u≈0.52），再插回河床
      const um = 0.52, Hm = handW(te + um * (tn - te) - TB0), phM = lerp(phE, phN, cosE(um));
      const sMin = (WY - 3 - Hm[1]) / Math.cos(phM);
      const s = u < um ? lerp(sE, sMin, cosE(u / um)) : lerp(sMin, sN, cosE((u - um) / (1 - um)));
      return { H: Hh, phi, s, push: 0 };
    }
    const tipOf = (P) => [P.H[0] - P.s * Math.sin(P.phi), P.H[1] + P.s * Math.cos(P.phi)];
    // 第 n 个周期里篙尖出水、入水的时刻与位置（二分求解，确定性）
    function crossings(n) {
      const tb0 = n * 2 + PB * 2, tb1 = n * 2 + PA * 2 + 2;
      const f = (tb) => tipOf(poleAt(tb - TB0))[1] - WY;
      const tm = tb0 + 0.52 * (tb1 - tb0);
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
          for (let i = 0; i < 900 * L.dots; i++) {
            const x = -20 + r() * (W + 40), y0 = L.f(x);
            if (y0 > L.base - 26) continue;
            const dy = Math.pow(r(), 1.7) * (L.base - y0) * 0.55;
            const fall = dy / (L.base - y0 + 1);
            const a = (0.06 + r() * 0.16) * L.dots * (1 - fall * 1.5);
            if (a <= 0.01) continue;
            tg.fillStyle = rgba(mix(L.col, '#151b20', 0.45), a);
            tg.beginPath(); tg.ellipse(x, y0 + 2 + dy, 1.6 + r() * 3.2, 0.9 + r() * 1.3, (r() - 0.5) * 0.3, 0, TAU); tg.fill();
          }
          tg.restore();
        });
      }
      // 近岸树丛：疏密相间的几丛，树冠是横向错落的墨点，树干只露一点
      if (L.trees) {
        blurInto(g, W, H, 0.5, (tg) => {
          const r = rng(L.seed * 31 + 7);
          const groups = [[8, 3], [52, 2], [118, 3], [168, 1], [205, 2]];
          for (const [gx, nT] of groups) {
            for (let k = 0; k < nT; k++) {
              const x = gx + k * (5 + r() * 6), y = L.f(x) + 2.5;
              const s = 0.6 + r() * 0.6, lean = (r() - 0.5) * 2;
              tg.strokeStyle = rgba('#252d33', 0.75); tg.lineWidth = 0.8 * s; tg.lineCap = 'round';
              tg.beginPath(); tg.moveTo(x, y + 1); tg.lineTo(x + lean, y - 7 * s); tg.stroke();
              // 两三层横向的叶团
              const tiers = 2 + Math.floor(r() * 2);
              for (let tI = 0; tI < tiers; tI++) {
                const ty = y - (6 + tI * 3.4) * s, tw = (7.5 - tI * 1.6) * s;
                for (let q = 0; q < 7; q++) {
                  const cx = x + lean + (r() - 0.5) * tw * 1.6, cy = ty + (r() - 0.5) * 2 * s;
                  tg.fillStyle = rgba(r() < 0.6 ? '#1e262c' : '#34424a', 0.3 + r() * 0.3);
                  tg.beginPath(); tg.ellipse(cx, cy, (1.6 + r() * 1.6) * s, (0.8 + r() * 0.7) * s, (r() - 0.5) * 0.3, 0, TAU); tg.fill();
                }
              }
            }
          }
        });
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
        g.globalAlpha = 0.52;
        const rows = GY;
        for (let y = 0; y < rows; y += 2) {
          const k = y / rows;
          const dx = (0.4 + 3.2 * k) * Math.sin(y * 0.33 + lt * 2.1) + 0.8 * k * Math.sin(y * 0.11 - lt * 1.4);
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
              const a = 0.42 * e.k * smooth(ag / 0.12) * Math.pow(1 - ag / 2.8, 1.6) * (r ? 0.6 : 1);
              g.strokeStyle = `rgba(250,246,236,${a.toFixed(3)})`; g.lineWidth = 0.9;
              g.beginPath(); g.ellipse(e.x, WY + 0.5, rad, rad * 0.13, 0, 0, TAU); g.stroke();
              g.strokeStyle = `rgba(70,86,94,${(a * 0.45).toFixed(3)})`;
              g.beginPath(); g.ellipse(e.x, WY + 1.4, rad * 0.94, rad * 0.11, 0, 0, Math.PI); g.stroke();
            }
          }
        }
        // V 形尾波：由船头过去的位置生成，留在水里慢慢张开、淡去
        const bow = (tt) => boatX(tt) + 0.46 * LEN;
        for (const side of [-1, 1]) {
          let px = bow(lt), py = WY + 0.6;
          for (let i = 1; i <= 28; i++) {
            const tau = i * 0.12;
            const x = bow(lt - tau), y = WY + 0.6 + side * (0.6 + 1.7 * tau) * (side < 0 ? 0.8 : 1.15);
            const a = 0.34 * Math.pow(1 - tau / 3.4, 1.4);
            g.strokeStyle = `rgba(248,244,234,${a.toFixed(3)})`; g.lineWidth = 0.9;
            g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
            px = x; py = y;
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
})();
