/* 第三版镜头组 ff4：d1_gate（灯熄门掩）、d2_weiqi（雪落棋局）、e2_ropebridge（断桥）。画面只由时间决定，不含歌词。 */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeOut, easeInOut, h2, rgba, mix, noise1, noise2, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // ---------- 公用工具 ----------
  // 在缓存里画模糊层：先画到临时画布，再带滤镜贴回（ctx.filter 只在建缓存时用）
  function blurInto(g, w, h, blur, fn, alpha, op) {
    const t = document.createElement('canvas');
    const sc = g.getTransform().a;
    t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc));
    const tg = t.getContext('2d'); tg.scale(sc, sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (op) g.globalCompositeOperation = op;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, 0, 0);
    g.restore();
  }
  // 多层平滑噪声，返回约 -1..1
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.07; }
    return s / n * 2;
  };
  // 颜色明度缩放
  function shade(hex, f) {
    const v = parseInt(hex.slice(1), 16);
    const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.max(0, Math.min(255, Math.round(x * f))));
    return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  // 柔光点贴图（白色，按需着色）
  function dotSprite(key, hard) {
    return K.cache('ff4_dot_' + key, 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(hard, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  function tinted(key, src, color) {
    return K.cache('ff4_tint_' + key + color, src.lw, src.lh, 1, (g) => {
      g.drawImage(src, 0, 0, src.lw, src.lh);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = color; g.fillRect(0, 0, src.lw, src.lh);
    });
  }
  // 低频斑驳：小画布随机灰度放大后正片叠底
  function mottle(g, seed, alpha, cw, ch) {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const cg = c.getContext('2d'), img = cg.createImageData(cw, ch), r = rng(seed);
    for (let i = 0; i < cw * ch; i++) { const v = 255 - Math.round(r() * r() * 150); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    cg.putImageData(img, 0, 0);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, W, H);
    g.restore();
  }
  // 预计算积分表：F(t) = ∫ f dt（确定性，加载后只读）
  function integTable(f, t0, t1, dt) {
    const n = Math.ceil((t1 - t0) / dt) + 1, F = new Float64Array(n);
    let acc = 0, prev = f(t0);
    for (let i = 1; i < n; i++) { const v = f(t0 + i * dt); acc += 0.5 * (prev + v) * dt; F[i] = acc; prev = v; }
    return (t) => {
      const u = (t - t0) / dt;
      if (u <= 0) return F[0] + (t - t0) * f(t0);
      if (u >= n - 1) return F[n - 1] + (t - t1) * f(t1);
      const i = Math.floor(u), k = u - i;
      return F[i] + (F[i + 1] - F[i]) * k;
    };
  }
  // 阻尼单摆对驱动角 eq(t) 的响应，预先数值积分成表
  function pendulumTable(eq, T, zeta, t0, t1) {
    const dt = 1 / 600, n = Math.ceil((t1 - t0) / dt) + 1, th = new Float64Array(n);
    const w = TAU / T;
    let x = eq(t0), v = 0;
    th[0] = x;
    for (let i = 1; i < n; i++) {
      const t = t0 + (i - 1) * dt;
      // 半隐式欧拉，小步长足够稳定
      const acc = -w * w * (x - eq(t)) - 2 * zeta * w * v;
      v += acc * dt; x += v * dt;
      th[i] = x;
    }
    return (t) => {
      const u = clamp((t - t0) / dt, 0, n - 1.001);
      const i = Math.floor(u), k = u - i;
      return th[i] + (th[i + 1] - th[i]) * k;
    };
  }
  // 每帧重画的临时画布（只做中间合成，用前整块清空，不在帧间保留内容）
  const SCR = new Map();
  function scratch(key, pw, ph) {
    let c = SCR.get(key);
    if (!c || c.width !== pw || c.height !== ph) { c = document.createElement('canvas'); c.width = pw; c.height = ph; SCR.set(key, c); }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    return [c, g];
  }
  // 镜头内第 off 句第 k 字的时间（相对镜头起点）；无歌词时用分镜里的秒数
  function charLT(c, k, off, fb) {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb : v - (c.t - c.lt);
  }

  // ============================================================
  // d1_gate 灯熄门掩：雪夜院门，左灯燃尽熄灭，半开的门被穿堂风慢慢合上
  // ============================================================
  (function () {
    const FB1 = [0.354, 0.634, 1.014, 1.494, 1.754, 2.274];
    const FB2 = [3.574, 3.974, 4.374, 4.774, 5.174, 5.674];
    // 透视：视平线与相机距离（门所在立面为基准平面）
    const CX = 640, CY = 420, DCAM = 1600;
    // 门洞与门扇
    const DX0 = 476, DX1 = 804, DY0 = 300, DY1 = 594, DMID = 640, LEAF = 164;
    const LANT = [{ x: 330, hook: 200, top: 262 }, { x: 950, hook: 200, top: 262 }];
    const LW = 76, LH = 86;
    const THETA0 = 32 * Math.PI / 180;

    // 风：第26句第1字起穿堂风从左向右，之后缓慢减弱
    const GUST_T = FB2[0];
    const gustAt = (t, t0) => smooth((t - t0) / 0.55) * (0.62 + 0.38 * Math.exp(-Math.max(0, t - t0 - 0.6) / 1.4));
    const windV = (t) => 7 + 120 * gustAt(t, GUST_T);
    const windX = integTable(windV, -2, 9, 1 / 240);
    // 灯笼摆动：平衡角随风，摆长约 0.7 m → 周期约 1.6 s
    const eqL = (t) => 0.041 * gustAt(t, GUST_T - 0.08) + 0.006 * gustAt(t, GUST_T) * Math.sin(t * 5.1 + 1.3);
    const eqR = (t) => 0.039 * gustAt(t, GUST_T + 0.04) + 0.006 * gustAt(t, GUST_T) * Math.sin(t * 4.7 + 0.2);
    const swingL = pendulumTable(eqL, 1.62, 0.1, -2, 9);
    const swingR = pendulumTable(eqR, 1.58, 0.1, -2, 9);
    const tasL = pendulumTable((t) => swingL(t) * 1.15 + 0.08 * gustAt(t, GUST_T - 0.08), 0.75, 0.25, -2, 9);
    const tasR = pendulumTable((t) => swingR(t) * 1.15 + 0.08 * gustAt(t, GUST_T + 0.04), 0.72, 0.25, -2, 9);

    const AMB = {
      sky0: '#0b0d15', sky1: '#1a1f2d', farRoof: '#11131a', farSnow: '#4e586a', branch: '#0e0f13', bSnow: '#434c5e', bloom: '#4a1e26',
      capTile: '#14161c', capSnow: '#727e90', wall: '#343b48', wallBase: '#22262d', groundSnow: '#64718a', groundSnow2: '#73809a',
      roofSnow: '#4b5568', roofTile: '#11131a', lip: '#7d8aa0', tileEnd: '#121317', soffit: '#0c0d11', rafter: '#15161b',
      beam: '#1b1719', beamPanel: '#211b1c', pin: '#18141a', pier: '#262a33', pierTop: '#20232b', panel: '#2a303b', panelLow: '#23272f',
      frame: '#1d1516', leaf: '#21181a', leafLine: '#170f11', knock: '#262628', thresh: '#1b1514', threshTop: '#2a221f',
      plat: '#262a32', platSnow: '#5f6b80', riser: '#1d2128', treadSnow: '#6a778d', drum: '#2b2f37', drumTop: '#343944',
    };
    const LIT = {
      sky0: '#000000', sky1: '#000000', farRoof: '#000000', farSnow: '#000000', branch: '#2a1e18', bSnow: '#a0948a', bloom: '#f06a74',
      capTile: '#2a2420', capSnow: '#a49a8e', wall: '#a89c8c', wallBase: '#4a4038', groundSnow: '#c8beb2', groundSnow2: '#d4cabe',
      roofSnow: '#000000', roofTile: '#000000', lip: '#3a3430', tileEnd: '#5a4a3e', soffit: '#4e3e32', rafter: '#7a6050',
      beam: '#6a4434', beamPanel: '#7a5040', pin: '#86583c', pier: '#7a6a5a', pierTop: '#8a7864', panel: '#c8b8a2', panelLow: '#968a7c',
      frame: '#6a3828', leaf: '#7c4230', leafLine: '#4a2418', knock: '#9a7a4a', thresh: '#6a4634', threshTop: '#8a6a50',
      plat: '#7a7064', platSnow: '#d8ccbc', riser: '#4e4842', treadSnow: '#e2d6c6', drum: '#8a8070', drumTop: '#9a9080',
    };

    // 台阶与地面（透视推算的屏幕坐标）
    const STEP = { platTop: 606, platFront: 626, r1b: 648, t1f: 656, r2b: 680 };
    const platX = (y) => { // 平台/台阶左右边界随深度略向外扩
      if (y <= 626) return [400 - (y - 606) * 0.7, 880 + (y - 606) * 0.7];
      if (y <= 656) return [378 - (y - 626) * 0.5, 902 + (y - 626) * 0.5];
      return [356 - (y - 656) * 0.4, 924 + (y - 656) * 0.4];
    };

    // 整个院门的静态绘制；P 为颜色表（环境光或灯光响应）
    function paintGate(g, P, lit) {
      const r = rng(2511);
      // 天空
      let gr = g.createLinearGradient(0, 0, 0, 380);
      gr.addColorStop(0, P.sky0); gr.addColorStop(1, P.sky1);
      g.fillStyle = gr; g.fillRect(0, 0, W, 400);
      // 天空里极淡的雪云
      for (let k = 0; k < 7; k++) {
        const x = 80 + k * 190 + r() * 60, y = 40 + r() * 160, rr = 160 + r() * 140;
        const gg = g.createRadialGradient(x, y, 0, x, y, rr);
        gg.addColorStop(0, rgba(shade(P.sky1, 1.25), 0.35)); gg.addColorStop(1, rgba(shade(P.sky1, 1.25), 0));
        g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      // 院内远处屋顶（墙后）：积雪屋面 + 屋脊
      const farRoof = (x0, x1, yr, ye) => {
        g.fillStyle = P.farSnow;
        g.beginPath(); g.moveTo(x0, ye); g.lineTo(x0 + 26, yr); g.lineTo(x1 - 26, yr); g.lineTo(x1, ye); g.closePath(); g.fill();
        g.strokeStyle = rgba(shade(P.farSnow, 0.7), 0.6); g.lineWidth = 1.4;
        for (let x = x0 + 30; x < x1 - 20; x += 11) { g.beginPath(); g.moveTo(x, yr + 3); g.lineTo(x + (x - (x0 + x1) / 2) * 0.12, ye - 2); g.stroke(); }
        g.fillStyle = P.farRoof; g.fillRect(x0 + 18, yr - 6, x1 - x0 - 36, 8);
        g.fillStyle = shade(P.farSnow, 1.1); g.fillRect(x0 + 18, yr - 8, x1 - x0 - 36, 3);
        g.fillStyle = P.farRoof; g.fillRect(x0 - 6, ye - 2, x1 - x0 + 12, 6);
        g.fillStyle = shade(P.farRoof, 1.1); g.fillRect(x0 - 6, ye + 4, x1 - x0 + 12, 60);
      };
      farRoof(-80, 200, 282, 318);
      farRoof(1080, 1380, 276, 316);
      // 墙后一株老梅（左）：枝干朝上一侧积雪，疏花
      const plum = (x0, y0, ang, len, w, depth, seed) => {
        const rr = rng(seed);
        let x = x0, y = y0, a = ang;
        const pts = [[x, y]];
        const n = 5;
        for (let i = 0; i < n; i++) {
          a += (rr() - 0.5) * 0.7;
          x += Math.cos(a) * len / n; y += Math.sin(a) * len / n;
          pts.push([x, y]);
        }
        for (let i = 1; i < pts.length; i++) {
          const ww = w * (1 - (i - 1) / pts.length * 0.7);
          g.lineCap = 'round';
          g.strokeStyle = P.branch; g.lineWidth = ww;
          g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
          const dx = pts[i][0] - pts[i - 1][0];
          if (Math.abs(dx) > 2.5 && ww > 2.2) { // 斜枝上沿一线薄雪
            g.strokeStyle = P.bSnow; g.lineWidth = Math.max(0.9, ww * 0.3);
            g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1] - ww * 0.42); g.lineTo(pts[i][0], pts[i][1] - ww * 0.42); g.stroke();
          }
        }
        if (depth > 0) {
          const kids = depth > 1 ? 2 : 3;
          for (let k = 0; k < kids; k++) {
            const j = 2 + Math.floor(rr() * (pts.length - 2));
            const sgn = k % 2 ? 1 : -1;
            plum(pts[j][0], pts[j][1], a + sgn * (0.5 + rr() * 0.5), len * (0.5 + rr() * 0.2), w * 0.55, depth - 1, seed * 7 + k + 3);
          }
        } else {
          // 梢头与枝上的花
          for (let k = 1; k < pts.length; k++) {
            if ((k + seed) % 3 === 0) continue;
            const [bx, by] = pts[k];
            g.fillStyle = P.bloom;
            for (let q = 0; q < 5; q++) { const qa = q / 5 * TAU + seed; g.beginPath(); g.arc(bx + Math.cos(qa) * 1.9, by + Math.sin(qa) * 1.9, 1.7, 0, TAU); g.fill(); }
            g.fillStyle = shade(P.bloom, 1.5); g.beginPath(); g.arc(bx, by, 0.9, 0, TAU); g.fill();
          }
        }
      };
      plum(40, 370, -1.25, 150, 10, 2, 31);
      plum(110, 368, -0.8, 110, 7, 2, 57);
      // 两侧院墙
      const sideWall = (x0, x1) => {
        g.fillStyle = P.wall; g.fillRect(x0, 372, x1 - x0, 650 - 372);
        // 墙面斑驳水渍
        for (let k = 0; k < 14; k++) {
          const x = x0 + r() * (x1 - x0), y = 380 + r() * 220, rr = 20 + r() * 50;
          const gg = g.createRadialGradient(x, y, 0, x, y, rr);
          gg.addColorStop(0, rgba(shade(P.wall, 0.85), 0.5)); gg.addColorStop(1, rgba(shade(P.wall, 0.85), 0));
          g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
        g.fillStyle = P.wallBase; g.fillRect(x0, 612, x1 - x0, 38);
        g.strokeStyle = rgba(shade(P.wallBase, 0.7), 0.8); g.lineWidth = 1;
        for (let y = 624; y < 650; y += 13) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
        // 墙帽瓦与积雪
        g.fillStyle = P.capTile; g.fillRect(x0 - 6, 360, x1 - x0 + 12, 16);
        g.fillStyle = shade(P.capTile, 0.7);
        for (let x = x0 - 4; x < x1 + 6; x += 9) { g.beginPath(); g.arc(x, 376, 3.6, 0, Math.PI); g.fill(); }
        g.fillStyle = P.capSnow;
        g.beginPath(); g.moveTo(x0 - 8, 364);
        for (let x = x0 - 8; x <= x1 + 8; x += 8) g.lineTo(x, 354 - 2.5 * noise1(x / 22, 7) - (x === x0 - 8 || x > x1 ? 0 : 1));
        g.lineTo(x1 + 8, 364); g.quadraticCurveTo((x0 + x1) / 2, 368, x0 - 8, 364); g.closePath(); g.fill();
      };
      sideWall(-10, 176);
      sideWall(1104, 1290);
      // 地面积雪（门前与两侧），近处略亮
      gr = g.createLinearGradient(0, 646, 0, H);
      gr.addColorStop(0, P.groundSnow); gr.addColorStop(1, P.groundSnow2);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(-10, 648);
      for (let x = -10; x <= W + 10; x += 16) g.lineTo(x, 647 - 2.5 * noise1(x / 40, 3));
      g.lineTo(W + 10, H + 5); g.lineTo(-10, H + 5); g.closePath(); g.fill();
      // 墙根积雪略堆起
      g.fillStyle = shade(P.groundSnow, 1.04);
      [[-10, 176], [1104, 1290]].forEach(([a, b]) => {
        g.beginPath(); g.moveTo(a, 652);
        for (let x = a; x <= b; x += 10) g.lineTo(x, 641 - 3 * noise1(x / 18, 9));
        g.lineTo(b, 655); g.closePath(); g.fill();
      });
      // 雪面细微起伏的暗纹
      g.strokeStyle = rgba(shade(P.groundSnow, 0.82), 0.35); g.lineWidth = 1.4;
      for (let k = 0; k < 9; k++) {
        const y = 666 + k * 6.5, x0 = r() * 300, x1 = x0 + 120 + r() * 300;
        if (x1 > 360 && x0 < 920 && y < 690) continue;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y - 2, x1, y + 1); g.stroke();
        g.beginPath(); g.moveTo(W - x0, y + 3); g.quadraticCurveTo(W - (x0 + x1) / 2, y + 1, W - x1, y + 4); g.stroke();
      }

      // ---- 门楼 ----
      // 两侧墀头（砖垛）
      const pier = (x0, x1) => {
        g.fillStyle = P.pier; g.fillRect(x0, 196, x1 - x0, 650 - 196);
        g.strokeStyle = rgba(shade(P.pier, 0.72), 0.9); g.lineWidth = 1;
        for (let y = 250, k = 0; y < 612; y += 9, k++) {
          g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
          const off = k % 2 ? 0 : 14;
          for (let x = x0 + off; x < x1; x += 28) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); }
        }
        g.fillStyle = P.pierTop; g.fillRect(x0 - 6, 196, x1 - x0 + 12, 54);
        g.fillStyle = shade(P.pierTop, 1.15); g.fillRect(x0 - 8, 236, x1 - x0 + 16, 7);
        g.fillStyle = shade(P.pierTop, 0.8); g.fillRect(x0 - 3, 212, x1 - x0 + 6, 18);
        g.fillStyle = shade(P.wallBase, 1.0); g.fillRect(x0 - 2, 600, x1 - x0 + 4, 50);
      };
      // 门两侧墙心（灰泥）
      const panel = (x0, x1) => {
        g.fillStyle = P.panel; g.fillRect(x0, 246, x1 - x0, 610 - 246);
        for (let k = 0; k < 8; k++) {
          const x = x0 + r() * (x1 - x0), y = 300 + r() * 250, rr = 18 + r() * 40;
          const gg = g.createRadialGradient(x, y, 0, x, y, rr);
          gg.addColorStop(0, rgba(shade(P.panel, 0.88), 0.55)); gg.addColorStop(1, rgba(shade(P.panel, 0.88), 0));
          g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        }
        // 墙心框线
        // 墙心框：砖砌细线，淡
        g.strokeStyle = rgba(shade(P.panel, 0.78), 0.4); g.lineWidth = 3;
        g.strokeRect(x0 + 16, 268, x1 - x0 - 32, 262);
        g.strokeStyle = rgba(shade(P.panel, 1.08), 0.35); g.lineWidth = 1;
        g.strokeRect(x0 + 19, 271, x1 - x0 - 38, 256);
        g.fillStyle = P.panelLow; g.fillRect(x0, 548, x1 - x0, 104);
        g.strokeStyle = rgba(shade(P.panelLow, 0.7), 0.8); g.lineWidth = 1;
        for (let y = 560; y < 650; y += 12) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      };
      panel(230, 454);
      panel(826, 1050);
      pier(176, 232);
      pier(1048, 1104);
      // 额枋
      g.fillStyle = P.beam; g.fillRect(170, 206, 940, 40);
      g.fillStyle = P.beamPanel; g.fillRect(420, 212, 440, 28);
      g.strokeStyle = rgba(shade(P.beam, 0.7), 0.6); g.lineWidth = 1.5;
      g.strokeRect(420, 212, 440, 28);
      g.strokeStyle = rgba(shade(P.beamPanel, 1.25), 0.35); g.lineWidth = 1;
      for (let k = 0; k < 5; k++) { // 褪色彩画的卷草纹（抽象笔触）
        const x = 450 + k * 90;
        g.beginPath(); g.moveTo(x, 232); g.bezierCurveTo(x + 14, 214, x + 34, 238, x + 46, 222); g.stroke();
      }
      g.fillStyle = shade(P.beam, 0.75); g.fillRect(170, 242, 940, 4);
      // 门上走马板与门簪
      g.fillStyle = shade(P.frame, 0.9); g.fillRect(454, 246, 372, 38);
      [560, 720].forEach((x) => {
        g.fillStyle = P.pin;
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(x + Math.cos(a) * 15, 265 + Math.sin(a) * 15); }
        g.closePath(); g.fill();
        g.strokeStyle = rgba(shade(P.pin, 1.3), 0.6); g.lineWidth = 1.2;
        g.beginPath(); g.arc(x, 265, 8, 0, TAU); g.stroke();
      });
      // 门框
      g.fillStyle = P.frame;
      g.fillRect(452, 246, 24, 362); g.fillRect(804, 246, 24, 362); g.fillRect(452, 282, 376, 18);
      g.fillStyle = rgba(shade(P.frame, 1.3), 0.5);
      g.fillRect(452, 246, 3, 362); g.fillRect(825, 246, 3, 362);
      // 左门扇（静止关闭）；右门扇在缓存里也画成关闭，用来截取它的贴图
      paintLeaf(g, P, DX0, true);
      paintLeaf(g, P, DMID, false);
      // 门槛
      g.fillStyle = P.thresh; g.fillRect(470, 584, 340, 22);
      g.fillStyle = P.threshTop; g.fillRect(470, 584, 340, 4);
      // 抱鼓石
      const drum = (x) => {
        g.fillStyle = P.drum; g.fillRect(x - 22, 578, 44, 28);
        g.fillStyle = shade(P.drum, 0.8); g.fillRect(x - 22, 600, 44, 6);
        g.fillStyle = P.drum; g.beginPath(); g.arc(x, 552, 24, 0, TAU); g.fill();
        g.strokeStyle = rgba(shade(P.drum, 0.7), 0.9); g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, 552, 17, 0, TAU); g.stroke();
        g.fillStyle = P.drumTop; g.beginPath(); g.arc(x, 552, 24, Math.PI * 1.1, Math.PI * 1.9); g.arc(x, 552, 21, Math.PI * 1.9, Math.PI * 1.1, true); g.fill();
      };
      drum(430); drum(850);
      // 平台
      const [px0, px1] = [400, 880];
      g.fillStyle = P.plat;
      g.beginPath(); g.moveTo(px0, STEP.platTop); g.lineTo(px1, STEP.platTop); g.lineTo(px1 + 14, STEP.platFront); g.lineTo(px0 - 14, STEP.platFront); g.closePath(); g.fill();
      // 平台前沿在檐外，落了雪（向后渐薄）
      gr = g.createLinearGradient(0, 612, 0, 626);
      gr.addColorStop(0, rgba(P.platSnow, 0)); gr.addColorStop(1, P.platSnow);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(px0 - 6, 612); g.lineTo(px1 + 6, 612); g.lineTo(px1 + 14, STEP.platFront); g.lineTo(px0 - 14, STEP.platFront); g.closePath(); g.fill();
      // 第一级踏步立面
      const riser = (ya, yb, xa0, xa1) => {
        g.fillStyle = P.riser; g.fillRect(xa0, ya, xa1 - xa0, yb - ya);
        g.strokeStyle = rgba(shade(P.riser, 0.7), 0.9); g.lineWidth = 1;
        for (let x = xa0 + 60 + r() * 30; x < xa1 - 20; x += 90 + r() * 50) { g.beginPath(); g.moveTo(x, ya + 3); g.lineTo(x, yb); g.stroke(); }
        // 雪沿（踏面雪垂到立面上一点）
        g.fillStyle = P.treadSnow;
        g.beginPath(); g.moveTo(xa0, ya);
        for (let x = xa0; x <= xa1; x += 8) g.lineTo(x, ya + 2 + 1.6 * noise1(x / 14, ya));
        g.lineTo(xa1, ya); g.closePath(); g.fill();
      };
      riser(STEP.platFront, STEP.r1b, 386, 894);
      // 第一级踏面（雪）
      g.fillStyle = P.treadSnow;
      g.beginPath(); g.moveTo(380, STEP.r1b); g.lineTo(900, STEP.r1b); g.lineTo(906, STEP.t1f); g.lineTo(374, STEP.t1f); g.closePath(); g.fill();
      riser(STEP.t1f, STEP.r2b, 368, 912);
      // 台阶两侧端面
      g.fillStyle = shade(P.riser, 0.8);
      g.beginPath(); g.moveTo(386, 626); g.lineTo(380, 648); g.lineTo(374, 656); g.lineTo(368, 680); g.lineTo(360, 680); g.lineTo(366, 650); g.lineTo(378, 622); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(894, 626); g.lineTo(900, 648); g.lineTo(906, 656); g.lineTo(912, 680); g.lineTo(920, 680); g.lineTo(914, 650); g.lineTo(902, 622); g.closePath(); g.fill();
      // 台阶脚下的雪
      g.fillStyle = P.groundSnow2;
      g.beginPath(); g.moveTo(350, 684);
      for (let x = 350; x <= 930; x += 10) g.lineTo(x, 678 + 1.5 * noise1(x / 12, 21));
      g.lineTo(930, 690); g.lineTo(350, 690); g.closePath(); g.fill();

      // ---- 屋顶（从下往上看：檐下暗、屋面积雪只露一窄条）----
      const eaveY = (x) => 183 - 15 * Math.pow(clamp(Math.abs(x - 640) / 500), 4);
      g.fillStyle = P.roofSnow;
      g.beginPath(); g.moveTo(140, eaveY(140));
      for (let x = 140; x <= 1140; x += 10) g.lineTo(x, eaveY(x));
      g.lineTo(1100, 150); g.lineTo(180, 150); g.closePath(); g.fill();
      // 瓦垄在雪下的起伏
      for (let x = 196; x < 1090; x += 13) {
        const sx = x + (x - 640) * 0.03;
        g.strokeStyle = rgba(shade(P.roofSnow, 0.78), 0.55); g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(x, 152); g.lineTo(sx, eaveY(sx) - 3); g.stroke();
      }
      // 正脊
      g.fillStyle = P.roofTile; g.fillRect(186, 138, 908, 14);
      g.fillStyle = shade(P.roofSnow, 1.08);
      g.beginPath(); g.moveTo(186, 140);
      for (let x = 186; x <= 1094; x += 12) g.lineTo(x, 136 - 1.6 * noise1(x / 30, 5));
      g.lineTo(1094, 140); g.closePath(); g.fill();
      // 脊端微翘
      [[186, -1], [1094, 1]].forEach(([x, s]) => {
        g.fillStyle = P.roofTile;
        g.beginPath(); g.moveTo(x, 152); g.lineTo(x, 138); g.quadraticCurveTo(x - s * 4, 128, x - s * 16, 127);
        g.quadraticCurveTo(x - s * 8, 133, x - s * 10, 140); g.lineTo(x - s * 14, 152); g.closePath(); g.fill();
      });
      // 檐口雪沿
      g.fillStyle = P.lip;
      g.beginPath(); g.moveTo(136, eaveY(136) - 3);
      for (let x = 136; x <= 1144; x += 7) g.lineTo(x, eaveY(x) - 3 + 1.2 * noise1(x / 9, 31));
      for (let x = 1144; x >= 136; x -= 7) g.lineTo(x, eaveY(x) + 4.5 + 2.2 * noise1(x / 11, 37));
      g.closePath(); g.fill();
      // 滴水瓦当一排
      g.fillStyle = P.tileEnd;
      for (let x = 146; x < 1136; x += 11) { const y = eaveY(x) + 5; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x + 5, y); g.lineTo(x, y + 7); g.closePath(); g.fill(); }
      // 檐下：椽头两排
      g.fillStyle = P.soffit;
      g.beginPath(); g.moveTo(150, eaveY(150) + 8);
      for (let x = 150; x <= 1130; x += 10) g.lineTo(x, eaveY(x) + 8);
      g.lineTo(1110, 207); g.lineTo(170, 207); g.closePath(); g.fill();
      for (let x = 160; x < 1124; x += 12) {
        const y = eaveY(x) + 11;
        g.fillStyle = P.rafter; g.fillRect(x - 3.5, y, 7, 5);
        g.fillStyle = shade(P.rafter, 0.85); g.beginPath(); g.arc(x + 6, y + 13, 3.6, 0, TAU); g.fill();
      }
      // 灯笼挂钩
      LANT.forEach((L) => { g.fillStyle = shade(P.rafter, 0.9); g.fillRect(L.x - 2, 196, 4, 8); });
      // 旧宅的斑驳：低频墨色不匀，屋面以下才有
      g.save(); g.beginPath(); g.rect(0, 186, W, H - 186); g.clip();
      mottle(g, 4401, 0.22, 64, 36);
      mottle(g, 4402, 0.14, 200, 112);
      g.restore();
    }

    // 门扇（x0 起宽 LEAF）：木板缝、铁箍、门环
    function paintLeaf(g, P, x0, isLeft) {
      g.fillStyle = P.leaf; g.fillRect(x0, DY0, LEAF, DY1 - DY0);
      g.strokeStyle = rgba(P.leafLine, 0.9); g.lineWidth = 1.2;
      for (let x = x0 + 27; x < x0 + LEAF - 5; x += 27) { g.beginPath(); g.moveTo(x, DY0); g.lineTo(x, DY1); g.stroke(); }
      const r = rng(isLeft ? 77 : 78);
      g.strokeStyle = rgba(shade(P.leaf, 1.18), 0.25); g.lineWidth = 1;
      for (let k = 0; k < 18; k++) {
        const x = x0 + 4 + r() * (LEAF - 8), y = DY0 + r() * 260;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y + 20 + r() * 40); g.stroke();
      }
      // 上下铁箍与门钉
      g.fillStyle = shade(P.knock, 0.8);
      [DY0 + 34, DY1 - 46].forEach((y) => {
        g.fillRect(x0 + 6, y, LEAF - 12, 5);
        for (let x = x0 + 16; x < x0 + LEAF - 8; x += 24) { g.beginPath(); g.arc(x, y + 2.5, 3, 0, TAU); g.fill(); }
      });
      // 门环（铺首衔环）：靠门缝一侧
      const kx = isLeft ? x0 + LEAF - 30 : x0 + 30, ky = 452;
      g.fillStyle = P.knock;
      g.beginPath(); g.arc(kx, ky - 12, 9, 0, TAU); g.fill();
      g.strokeStyle = P.knock; g.lineWidth = 3;
      g.beginPath(); g.arc(kx, ky + 6, 12, 0, TAU); g.stroke();
      g.strokeStyle = rgba(shade(P.knock, 1.4), 0.5); g.lineWidth = 1;
      g.beginPath(); g.arc(kx, ky + 6, 12, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
      // 门缝边的阴影
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(isLeft ? x0 + LEAF - 2 : x0, DY0, 2, DY1 - DY0);
    }

    function warmLightLayer(src, L, key) {
      return K.cache('ff4_d1_light' + key, W, H, 1, (g) => {
        g.drawImage(src, 0, 0, W, H);
        g.globalCompositeOperation = 'multiply';
        const cx = L.x, cy = L.top + LH * 0.5, r0 = 150;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 640);
        for (let i = 0; i <= 16; i++) {
          const u = i / 16, rr = u * 640;
          const k = 1 / (1 + (rr / r0) * (rr / r0)) * (1 - u * u);
          gr.addColorStop(u, `rgba(${Math.round(255 * k)},${Math.round(178 * k)},${Math.round(104 * k)},1)`);
        }
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        // 灯正下方的雪地受光最正：压扁的暖光池
        g.globalCompositeOperation = 'lighter';
        g.save(); g.beginPath(); g.rect(0, 646, W, H - 646); g.clip();
        g.translate(cx, 662); g.scale(1, 0.16);
        const pool = g.createRadialGradient(0, 0, 0, 0, 0, 230);
        pool.addColorStop(0, 'rgba(120,78,44,1)'); pool.addColorStop(0.5, 'rgba(60,38,20,1)'); pool.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = pool; g.fillRect(-240, -240, 480, 480);
        g.restore();
        // 灯笼顶盖挡住正上方：顶上的檐板受光略弱
        g.globalCompositeOperation = 'multiply';
        const sh = g.createRadialGradient(cx, L.top - 10, 0, cx, L.top - 10, 70);
        sh.addColorStop(0, 'rgba(120,120,120,1)'); sh.addColorStop(1, 'rgba(255,255,255,1)');
        g.fillStyle = sh; g.fillRect(cx - 80, L.top - 90, 160, 90);
      });
    }
    function layers() {
      const base = K.cache('ff4_d1_base', W, H, 1, (g) => paintGate(g, AMB, false));
      const litSrc = K.cache('ff4_d1_litsrc', W, H, 1, (g) => paintGate(g, LIT, true));
      const lightL = warmLightLayer(litSrc, LANT[0], 'L');
      const lightR = warmLightLayer(litSrc, LANT[1], 'R');
      // 画面用的灯光层：右门扇区域留黑（门扇的受光单独按角度算）
      const mask = (src, key) => K.cache('ff4_d1_lm' + key, W, H, 1, (g) => {
        g.drawImage(src, 0, 0, W, H);
        g.fillStyle = '#000'; g.fillRect(DMID, DY0, DX1 - DMID, DY1 - DY0);
      });
      return { base, lightL, lightR, lightLm: mask(lightL, 'L'), lightRm: mask(lightR, 'R') };
    }
    // 右门扇贴图：从三张图层里截取关闭状态的右扇
    function leafTex(src, key) {
      return K.cache('ff4_d1_leaf' + key, LEAF + 8, DY1 - DY0, 1, (g) => {
        const S = src.width / W;
        g.drawImage(src, DMID * S, DY0 * S, (LEAF + 8) * S, (DY1 - DY0) * S, 0, 0, LEAF + 8, DY1 - DY0);
      });
    }
    // 门内院景：暖光、雪地、远处一扇亮窗
    function interiorTex() {
      return K.cache('ff4_d1_inner', DX1 - DMID, DY1 - DY0, 1, (g) => {
        g.translate(-DMID, -DY0);
        let gr = g.createLinearGradient(0, DY0, 0, DY1);
        gr.addColorStop(0, '#1a110d'); gr.addColorStop(0.45, '#3a2416'); gr.addColorStop(0.72, '#5a3a22'); gr.addColorStop(1, '#8a6040');
        g.fillStyle = gr; g.fillRect(DMID, DY0, DX1 - DMID, DY1 - DY0);
        // 远处亮窗（窗纸透暖光，有窗棂）
        const wx = 622, wy = 410, ww = 74, wh = 66;
        const glow = g.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, 120);
        glow.addColorStop(0, 'rgba(255,190,110,0.55)'); glow.addColorStop(1, 'rgba(255,170,90,0)');
        g.fillStyle = glow; g.fillRect(DMID, DY0, DX1 - DMID, DY1 - DY0);
        g.fillStyle = '#f6c478'; g.fillRect(wx, wy, ww, wh);
        g.strokeStyle = 'rgba(90,50,24,0.8)'; g.lineWidth = 2;
        for (let x = wx + 12; x < wx + ww; x += 12) { g.beginPath(); g.moveTo(x, wy); g.lineTo(x, wy + wh); g.stroke(); }
        for (let y = wy + 13; y < wy + wh; y += 13) { g.beginPath(); g.moveTo(wx, y); g.lineTo(wx + ww, y); g.stroke(); }
        // 院中雪地（受窗光）
        gr = g.createLinearGradient(0, 500, 0, DY1);
        gr.addColorStop(0, '#b08860'); gr.addColorStop(1, '#d8b088');
        g.fillStyle = gr; g.fillRect(DMID, 505, DX1 - DMID, DY1 - 505);
        g.fillStyle = 'rgba(40,24,14,0.6)'; g.fillRect(DMID, 498, DX1 - DMID, 8);
      });
    }
    // 灯笼贴图：亮（纸透光）与暗两种
    function lanternTex(lit) {
      return K.cache('ff4_d1_lant' + (lit ? 'on' : 'off'), LW + 20, LH + 30, 2, (g) => {
        const cx = LW / 2 + 10, y0 = 14, cy = y0 + LH / 2;
        // 灯身
        const body = () => { g.beginPath(); g.ellipse(cx, cy, LW / 2, LH / 2, 0, 0, TAU); };
        if (lit) {
          const gr = g.createRadialGradient(cx, cy + 6, 4, cx, cy, LW * 0.62);
          gr.addColorStop(0, '#ffe2a0'); gr.addColorStop(0.35, '#ff9a48'); gr.addColorStop(0.75, '#e0442a'); gr.addColorStop(1, '#8e1a1a');
          g.fillStyle = gr;
        } else {
          const gr = g.createRadialGradient(cx - 10, cy - 8, 4, cx, cy, LW * 0.6);
          gr.addColorStop(0, '#3e1618'); gr.addColorStop(1, '#1e0c0e');
          g.fillStyle = gr;
        }
        body(); g.fill();
        // 竹骨（经线）
        g.save(); body(); g.clip();
        g.strokeStyle = lit ? 'rgba(120,24,14,0.55)' : 'rgba(10,4,6,0.6)'; g.lineWidth = 1.3;
        for (let k = -3; k <= 3; k++) {
          const ex = (LW / 2) * Math.sin(k / 3.6 * Math.PI / 2) ;
          g.beginPath(); g.ellipse(cx, cy, Math.abs(ex) + 0.01, LH / 2, 0, 0, TAU); g.stroke();
        }
        // 纬向细线
        g.strokeStyle = lit ? 'rgba(150,40,20,0.25)' : 'rgba(10,4,6,0.35)'; g.lineWidth = 1;
        for (let k = -4; k <= 4; k++) { const y = cy + k * LH / 10; g.beginPath(); g.moveTo(cx - LW, y); g.lineTo(cx + LW, y); g.stroke(); }
        // 边缘压暗，显出球面
        const rim = g.createRadialGradient(cx, cy, LW * 0.3, cx, cy, LW * 0.56);
        rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, lit ? 'rgba(80,6,8,0.45)' : 'rgba(0,0,0,0.4)');
        g.fillStyle = rim; g.fillRect(0, 0, LW + 20, LH + 30);
        g.restore();
        // 上下盖（木圈）
        const cap = (y, w, h) => {
          g.fillStyle = lit ? '#2a1610' : '#140c0a';
          g.beginPath(); g.ellipse(cx, y, w, h, 0, 0, TAU); g.fill();
          g.fillStyle = lit ? 'rgba(255,190,110,0.35)' : 'rgba(60,40,30,0.3)';
          g.beginPath(); g.ellipse(cx, y - h * 0.3, w * 0.9, h * 0.5, 0, 0, TAU); g.fill();
        };
        g.fillStyle = lit ? '#2a1610' : '#140c0a';
        g.fillRect(cx - 15, y0 - 6, 30, 10); g.fillRect(cx - 13, y0 + LH - 4, 26, 9);
        cap(y0 + 3, 16, 4); cap(y0 + LH + 4, 14, 3.5);
      });
    }
    // 灯笼（含穗子）：绕挂点旋转
    function drawLantern(g, L, ang, tasA, I, t, idx) {
      const lenCord = L.top - L.hook;
      g.save();
      g.translate(L.x, L.hook);
      g.rotate(-ang); // 正角 = 向右摆（屏幕坐标里逆时针为负）
      g.strokeStyle = '#0c0a0a'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, lenCord - 6); g.stroke();
      const off = lanternTex(false), on = lanternTex(true);
      const ox = -(LW / 2 + 10), oy = lenCord - 14;
      g.drawImage(off, ox, oy, off.lw, off.lh);
      if (I > 0.003) { g.globalAlpha = clamp(I); g.drawImage(on, ox, oy, on.lw, on.lh); g.globalAlpha = 1; }
      // 穗子：结 + 丝线，跟着灯笼并稍有滞后
      const ty = lenCord + LH + 6;
      g.translate(0, ty);
      g.rotate(-(tasA - ang));
      const tc = I > 0.05 ? mix('#3a0e10', '#d2463a', clamp(I)) : '#3a0e10';
      g.fillStyle = tc;
      g.beginPath(); g.arc(0, 4, 3.4, 0, TAU); g.fill();
      g.strokeStyle = tc; g.lineWidth = 1.1;
      for (let k = -4; k <= 4; k++) {
        const sway = 0.8 * Math.sin(t * 1.3 + k * 0.7 + idx);
        g.beginPath(); g.moveTo(k * 0.8, 6); g.quadraticCurveTo(k * 1.4 + sway * 0.5, 22, k * 1.9 + sway, 40 - Math.abs(k) * 1.2); g.stroke();
      }
      g.restore();
    }
    // 雪花三层：远（只在天空里）、中、近（虚化）
    const FLAKES = (() => {
      const r = rng(9091), out = [];
      for (let i = 0; i < 220; i++) {
        const layer = i < 70 ? 0 : i < 196 ? 1 : 2;
        out.push({
          layer, x0: r() * (W + 80), y0: r() * (H + 60),
          v: layer === 0 ? 30 + r() * 16 : layer === 1 ? 58 + r() * 30 : 140 + r() * 50,
          rad: layer === 0 ? 0.7 + r() * 0.6 : layer === 1 ? 1.1 + r() * 1.1 : 3.5 + r() * 2.5,
          sw: layer === 0 ? 4 : layer === 1 ? 6 + r() * 6 : 12 + r() * 8,
          f: 0.35 + r() * 0.6, ph: r() * TAU, a: layer === 0 ? 0.35 + r() * 0.25 : layer === 1 ? 0.5 + r() * 0.4 : 0.22 + r() * 0.16,
          wk: layer === 0 ? 0.45 : layer === 1 ? 1 : 1.9,
        });
      }
      return out;
    })();
    // 贴地薄雾（雪夜的冷雾，随风缓移）与画面下角虚化的近景雪堆
    function mistTex() {
      return K.cache('ff4_d1_mist', W, 160, 0.5, (g) => {
        const r = rng(616);
        blurInto(g, W, 160, 14, (tg) => {
          for (let k = 0; k < 26; k++) {
            const x = r() * W, y = 60 + r() * 70, rx = 90 + r() * 160, ry = 14 + r() * 18;
            tg.fillStyle = `rgba(150,164,186,${0.12 + r() * 0.12})`;
            tg.beginPath(); tg.ellipse(x, y, rx, ry, 0, 0, TAU); tg.fill();
            tg.beginPath(); tg.ellipse(x + (x < W / 2 ? W : -W), y, rx, ry, 0, 0, TAU); tg.fill();
          }
        });
      });
    }
    function bankTex() {
      return K.cache('ff4_d1_bank', W, 120, 1, (g) => {
        g.translate(0, -600);
        blurInto(g, W, 120, 5, (tg) => {
          tg.translate(0, -600);
          const bank = (pts, col, top) => {
            tg.fillStyle = col;
            tg.beginPath(); tg.moveTo(pts[0][0], 730);
            pts.forEach(([x, y]) => tg.lineTo(x, y));
            tg.lineTo(pts[pts.length - 1][0], 730); tg.closePath(); tg.fill();
            tg.strokeStyle = top; tg.lineWidth = 3;
            tg.beginPath(); pts.forEach(([x, y], i) => (i ? tg.lineTo(x, y + 2) : tg.moveTo(x, y + 2))); tg.stroke();
          };
          // 近景雪堆：雪色（背光一侧稍暗），顶沿一线柔和的亮边
          const bankG = tg.createLinearGradient(0, 668, 0, 730);
          bankG.addColorStop(0, '#6a7690'); bankG.addColorStop(1, '#56627a');
          bank([[-20, 668], [60, 676], [150, 694], [240, 712], [300, 730]], bankG, 'rgba(170,182,202,0.55)');
          bank([[980, 730], [1060, 706], [1150, 688], [1230, 678], [1300, 672]], bankG, 'rgba(196,186,176,0.5)');
        });
      });
    }
    function drawSnow(g, t, IL, IR, layerSel) {
      const dot = dotSprite('soft', 0.35), dotH = dotSprite('hard', 0.6);
      const wx = windX(t);
      for (const f of FLAKES) {
        if (f.layer !== layerSel) continue;
        const m = 40;
        let y = ((f.y0 + f.v * t) % (H + 2 * m) + (H + 2 * m)) % (H + 2 * m) - m;
        let x = f.x0 + wx * f.wk + f.sw * Math.sin(f.f * TAU * t + f.ph) + f.sw * 0.4 * Math.sin(f.f * 2.3 * TAU * t + f.ph * 1.7);
        x = ((x % (W + 2 * m)) + (W + 2 * m)) % (W + 2 * m) - m;
        // 近灯笼的雪片受暖光
        let warm = 0;
        if (f.layer > 0) {
          const dL = Math.hypot(x - 330, y - 306), dR = Math.hypot(x - 950, y - 306);
          warm = IL / (1 + (dL / 130) * (dL / 130)) + IR / (1 + (dR / 130) * (dR / 130));
        }
        const wq = Math.round(clamp(warm * 1.4) * 8) / 8;
        const col = mix('#c4cede', '#ffd2a0', wq);
        const a = f.a * (0.8 + 0.5 * clamp(warm));
        const s = f.rad * (f.layer === 2 ? 2.4 : 2.2);
        g.globalAlpha = clamp(a);
        g.drawImage(tinted(f.layer === 2 ? 'snowS' : 'snowH', f.layer === 2 ? dot : dotH, col), x - s, y - s, s * 2, s * 2);
      }
      g.globalAlpha = 1;
    }

    // 门槛顶面的薄雪线：x 方向分列，每列厚度固定（噪声），缝前一段随气流吹走
    const SILL_X0 = 512, SILL_X1 = 772;
    const sillH = (x) => {
      const e = smooth((x - SILL_X0) / 40) * smooth((SILL_X1 - x) / 40);
      return e * (1.6 + 1.1 * noise1(x / 9, 41) + 0.5 * noise1(x / 3.1, 42));
    };
    // 被吹落的雪粒（确定性）：离缝越近越早起飞
    const GRAINS = Array.from({ length: 18 }, (_, i) => {
      const side = i % 2 ? 1 : -1, d = 1 + 11 * h2(i, 71);
      return { x0: DMID + side * d, d, vx: side * (4 + 34 * h2(i, 72)) + 8, vy: 10 + 44 * h2(i, 73), r: 0.55 + 0.5 * h2(i, 74), dl: 0.08 * h2(i, 75) };
    });
    function drawSill(g, t, IL, IR, tHen, tNuo) {
      // 吹雪进度：门缝窄到约 5 像素后开始，门合上后 0.1 s 结束
      const tb0 = tHen + 0.7 * (tNuo - tHen), tb1 = tNuo + 0.1;
      const blow = clamp((t - tb0) / (tb1 - tb0));
      const lit = (x) => { // 两盏灯对门槛处的暖光（左灯熄后只剩右灯）
        const wl = Math.exp(-Math.pow((x - 330) / 360, 2)), wr = Math.exp(-Math.pow((x - 950) / 360, 2));
        return clamp(0.55 * IL * wl + 0.6 * IR * wr);
      };
      for (let x = SILL_X0; x < SILL_X1; x += 2) {
        const h = sillH(x + 1);
        if (h < 0.25) continue;
        const dd = Math.abs(x + 1 - DMID);
        const gone = smooth((blow * 1.35 - dd / 12) / 0.35); // 这一列已被吹走的比例
        const a = 1 - gone;
        if (a < 0.01) continue;
        const w = lit(x);
        g.fillStyle = mix('#3f485a', '#9a8070', w);
        g.globalAlpha = 0.92 * a;
        g.fillRect(x, 587.6 - h, 2, h + 0.6);
        g.fillStyle = mix('#58637a', '#c8a888', w); // 雪线上沿略亮
        g.globalAlpha = 0.7 * a;
        g.fillRect(x, 587.6 - h, 2, Math.min(0.9, h));
      }
      g.globalAlpha = 1;
      if (blow <= 0 || t > tb1 + 1.2) return;
      // 雪粒：先被气流向前推出门槛顶面，再受阻力缓慢落到平台上，落定后渐隐融入平台积雪
      for (const p of GRAINS) {
        const tr = tb0 + (tb1 - tb0) * (p.d / 12 + 0.12) / 1.35 + p.dl;
        const tau = t - tr;
        if (tau <= 0) continue;
        const tc = 0.08, vt = 70; // 阻力时间常数、终速（像素/秒）
        const x = p.x0 + p.vx * 0.12 * (1 - Math.exp(-tau / 0.12)) + 14 * tau;
        const fall = vt * (tau - tc * (1 - Math.exp(-tau / tc)));
        const y = Math.min(609, 586.5 + p.vy * 0.1 * (1 - Math.exp(-tau / 0.1)) + fall);
        const landed = Math.max(0, tau - (609 - 586.5) / vt - 0.05);
        const a = clamp(tau / 0.3) * (1 - smooth(landed / 0.4));
        if (a < 0.01) continue;
        g.globalAlpha = 0.75 * a;
        g.fillStyle = mix('#7c869a', '#d0b090', lit(x) * 0.6);
        g.beginPath(); g.arc(x, y, p.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }

    XYT.registerShot('d1_gate', {
      name: '灯熄门掩', zone: 'top', night: true, text: '#f3e8d2', shadow: 'rgba(6,6,12,0.88)', accent: '#f3b45c', bloom: 0.34,
      draw(g, c) {
        const t = c.lt;
        const tDao = charLT(c, 3, 0, FB1[3]), tTou = charLT(c, 5, 0, FB1[5]);
        const tHen = charLT(c, 0, 1, FB2[0]), tNuo = charLT(c, 5, 1, FB2[5]);
        const L = layers();
        // ---- 灯光强度 ----
        const be = c.be ? c.be(0.28) : 0;
        // 左灯：第25句第4字起烛火摇曳（烛将燃尽），第6字起 0.8 s 熄灭
        const gutter = smooth((t - tDao) / 0.5);
        const flick = noise1(t * 4.6, 11) * 0.7 + noise1(t * 8.3, 12) * 0.3;
        const out = smooth((t - tTou) / 0.8);
        let IL = (0.95 + 0.04 * be + 0.02 * (noise1(t * 2.1, 3) - 0.5)) * (1 - gutter * 0.45 * flick) * (1 - out);
        IL = Math.max(0, IL);
        const ember = clamp((t - tTou) / 0.3) * Math.exp(-Math.max(0, t - tTou - 0.5) / 0.9);
        // 右灯：穿堂风压低火焰（不灭），之后回稳
        const dip = smooth((t - tHen - 0.05) / 0.25) * (1 - smooth((t - tHen - 0.7) / 1.2));
        const IR = Math.max(0, (0.95 + 0.04 * be + 0.02 * (noise1(t * 2.3, 5) - 0.5)) * (1 - 0.3 * dip * (0.7 + 0.3 * noise1(t * 9.7, 6))));
        // ---- 摆角 ----
        const aL = swingL(t) + 0.008 * Math.sin(TAU * t / 1.62 + 0.4) * (1 - gustAt(t, GUST_T));
        const aR = swingR(t) + 0.008 * Math.sin(TAU * t / 1.58 + 2.1) * (1 - gustAt(t, GUST_T));
        const pend = (L0, a) => ({ dx: (L0.top - L0.hook + LH / 2) * Math.sin(a), dy: 0 });
        const pL = pend(LANT[0], aL), pR = pend(LANT[1], aR);
        // ---- 门扇角度：第26句第1字起合拢，第6字合上 ----
        // 正面看到的门缝宽约与 1-cosθ 成正比：由门缝宽度的缓动反推角度，门缝先慢、后快、再缓，恰在第6字消失
        const u = clamp((t - tHen) / Math.max(0.5, tNuo - tHen));
        const th = Math.acos(1 - (1 - Math.cos(THETA0)) * (1 - smooth(u)));

        // 1) 环境光底图
        g.drawImage(L.base, 0, 0, W, H);
        // 远层雪（只在天空与墙后）
        g.save();
        g.beginPath(); g.rect(0, 0, W, 134); g.rect(0, 0, 176, 356); g.rect(1104, 0, 176, 356); g.clip();
        drawSnow(g, t, IL, IR, 0);
        g.restore();
        // 2) 门内院景 + 右门扇
        const cs = Math.cos(th), sn = Math.sin(th);
        const proj = (X, Y, Z) => { const s = DCAM / (DCAM + Z); return [CX + (X - CX) * s, CY + (Y - CY) * s]; };
        const freeX = DX1 - LEAF * cs, freeZ = LEAF * sn;
        const [fxT, fyT] = proj(freeX, DY0, freeZ), [, fyB] = proj(freeX, DY1, freeZ);
        const gapW = Math.max(0, fxT - DMID);
        if (gapW > 0.05) {
          g.save(); g.beginPath(); g.rect(DMID, DY0, DX1 - DMID, DY1 - DY0); g.clip();
          g.drawImage(interiorTex(), DMID, DY0);
          g.restore();
        }
        // 右门扇：竖条切片做透视
        const tA = leafTex(L.base, 'A'), tLr = leafTex(L.lightR, 'R'), tLl = leafTex(L.lightL, 'L');
        const nx = -sn, nz = cs; // 门扇法线
        const lam = (lx, lz) => { const d = Math.hypot(lx, lz); return Math.max(0, (nx * lx + nz * lz) / d); };
        const fR0 = Math.max(1e-3, (60) / Math.hypot(228, 60));
        const fRr = lam(228, 60) / fR0;
        const fL0 = Math.max(1e-3, 60 / Math.hypot(392, 60));
        const fLr = lam(330 - 722, 60) / fL0;
        const NS = 18, SW = LEAF / NS, TH = DY1 - DY0;
        // 先把门扇的环境光与两盏灯的受光平铺合成一张，再一次切片做透视（切片间的细小重叠不会被加亮两次）
        const [lc, lg] = scratch('d1leaf', tA.width, tA.height);
        lg.drawImage(tA, 0, 0);
        lg.globalCompositeOperation = 'lighter';
        const addLit = (tex, a) => {
          for (let k = 0; k < 2 && a > 0.002; k++, a -= 1) { lg.globalAlpha = clamp(a); lg.drawImage(tex, 0, 0); }
        };
        addLit(tLr, IR * fRr);
        addLit(tLl, IL * fLr);
        lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
        lc.lw = tA.lw; lc.lh = tA.lh;
        const slices = (tex, alpha) => {
          if (alpha <= 0.002) return;
          g.globalAlpha = clamp(alpha);
          const S = tex.width / tex.lw;
          for (let i = 0; i < NS; i++) {
            const ua = i / NS, ub = (i + 1) / NS; // 从门轴（右）向门缝（左）
            const Xa = DX1 - ua * LEAF * cs, Za = ua * LEAF * sn, Xb = DX1 - ub * LEAF * cs, Zb = ub * LEAF * sn;
            const [xa, ya0] = proj(Xa, DY0, Za), [, ya1] = proj(Xa, DY1, Za);
            const [xb, yb0] = proj(Xb, DY0, Zb), [, yb1] = proj(Xb, DY1, Zb);
            const sx = LEAF - ub * LEAF; // 贴图列：0 在门缝侧
            const y0 = (ya0 + yb0) / 2, y1 = (ya1 + yb1) / 2;
            g.drawImage(tex, sx * S, 0, SW * S, TH * S, xb, y0, xa - xb + 0.6, y1 - y0);
          }
          g.globalAlpha = 1;
        };
        slices(lc, 1);
        // 门扇自身的阴面（转开后受环境光更少）
        if (th > 0.001) {
          g.fillStyle = `rgba(6,4,6,${0.35 * sn})`;
          g.beginPath(); g.moveTo(DX1, DY0); g.lineTo(fxT, fyT); g.lineTo(fxT, fyB); g.lineTo(DX1, DY1); g.closePath(); g.fill();
          // 门缝边（门板厚度）迎着院内暖光
          const ew = Math.max(0, 7 * sn * 0.95);
          g.fillStyle = 'rgba(214,150,90,0.85)';
          g.fillRect(fxT - ew, fyT, ew, fyB - fyT);
        }
        // 门槛压在门扇下沿之前
        g.drawImage(L.base, 470, 584, 340, 22, 470, 584, 340, 22);
        // 3) 灯光（加色）
        g.globalCompositeOperation = 'lighter';
        // 注意：globalAlpha 超过 1 会被画布忽略，必须先夹到 0..1
        // 灯光层固定不动（摆动由灯笼、光晕与亮度变化体现，墙面纹理不能跟着滑）
        if (IL > 0.003) { g.globalAlpha = clamp(IL); g.drawImage(L.lightLm, 0, 0, W, H); }
        if (IR > 0.003) { g.globalAlpha = clamp(IR); g.drawImage(L.lightRm, 0, 0, W, H); }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        // 门槛顶上被风吹进来的一线薄雪；门扇将合时，从门缝挤出的一股气把缝前一小段雪吹落
        drawSill(g, t, IL, IR, tHen, tNuo);
        g.globalCompositeOperation = 'lighter';
        // 门缝透出的光：门槛顶面、平台、踏步上的细长光带
        if (gapW > 0.3) {
          const k = clamp(gapW / 20);
          const bands = [[584, 588, 1.0, 1.0], [612, 626, 1.08, 0.75], [648, 656, 1.2, 0.6], [680, 690, 1.3, 0.45]];
          bands.forEach(([ya, yb, spread, a]) => {
            const xa = DMID - 1 - (spread - 1) * 30, xb = DMID + gapW * spread + (spread - 1) * 12;
            const gr = g.createLinearGradient(xa, 0, xb, 0);
            gr.addColorStop(0, 'rgba(255,170,90,0)'); gr.addColorStop(0.3, `rgba(255,176,96,${0.45 * a * k})`);
            gr.addColorStop(0.7, `rgba(255,176,96,${0.45 * a * k})`); gr.addColorStop(1, 'rgba(255,170,90,0)');
            g.fillStyle = gr; g.fillRect(xa, ya, xb - xa, yb - ya);
          });
          // 门缝本身的柔光
          const gl = g.createLinearGradient(DMID - 40, 0, DMID + gapW + 40, 0);
          gl.addColorStop(0, 'rgba(255,160,80,0)'); gl.addColorStop(0.5, `rgba(255,160,80,${0.16 * k})`); gl.addColorStop(1, 'rgba(255,160,80,0)');
          g.fillStyle = gl; g.fillRect(DMID - 40, DY0, gapW + 80, DY1 - DY0);
        }
        g.globalCompositeOperation = 'source-over';
        // 贴地冷雾
        const mx = ((windX(t) * 0.12) % W + W) % W;
        g.globalAlpha = 0.55;
        g.drawImage(mistTex(), mx - W, 560, W, 160); g.drawImage(mistTex(), mx, 560, W, 160);
        g.globalAlpha = 1;
        // 4) 灯笼
        drawLantern(g, LANT[0], aL, tasL(t), IL, t, 0);
        drawLantern(g, LANT[1], aR, tasR(t), IR, t, 1);
        // 烛芯余烬（左灯熄后）
        if (ember > 0.01) {
          const ex = LANT[0].x + pL.dx * 1.15, ey = LANT[0].top + LH * 0.66;
          g.globalCompositeOperation = 'lighter';
          A.glow(g, ex, ey, 7, '#ff7a30', 0.5 * ember);
          g.globalCompositeOperation = 'source-over';
        }
        // 光晕
        g.globalCompositeOperation = 'lighter';
        [[LANT[0], pL, IL], [LANT[1], pR, IR]].forEach(([L0, p, I]) => {
          if (I < 0.01) return;
          const x = L0.x + p.dx, y = L0.top + LH * 0.52;
          A.glow(g, x, y, 70, '#ff8a48', 0.32 * I);
          A.glow(g, x, y + 4, 26, '#ffd890', 0.4 * I);
          A.glow(g, x, y, 210, '#ff7a3a', 0.08 * I);
        });
        g.globalCompositeOperation = 'source-over';
        // 5) 熄灯后的一缕细烟：上升，碰到檐板后贴着檐下散开，风起后被吹向右
        const s0 = tTou + 0.25;
        if (t > s0) {
          const topX = LANT[0].x + Math.sin(aL) * (LANT[0].top - LANT[0].hook), topY = LANT[0].top - 3;
          const CEIL = 214; // 檐下
          const life = 3.4, n = 56, dA = life / n;
          const fadeAll = 1 - smooth((t - s0 - 3.0) / 1.2);
          const puff = tinted('smoke2', dotSprite('soft', 0.2), '#aab2c0');
          // 先算出整条烟的位置，再按相邻两团的间距折算每团的透明度：烟变慢、变粗的地方不会越叠越亮
          const P = [];
          for (let i = 0; i <= n; i++) {
            const age = i * dA, te = t - age; // te：这一段烟离开灯口的时刻
            if (te < s0) break;
            const rise = 52 * (1 - Math.exp(-age / 0.7));
            const yFree = topY - rise;
            const under = smooth((CEIL + 16 - yFree) / 16); // 贴近檐板后改为横向铺开
            const gustDx = (windX(t) - windX(te)) * 0.5;
            const x = topX + 3.5 * Math.sin(age * 3.3 + te * 1.1) * Math.min(1, age) + under * age * 30 + gustDx;
            const y = Math.max(yFree, CEIL + 3) + under * age * 4;
            const rad = 2 + age * 4.5 + under * age * 6;
            P.push({ age, te, x, y, rad, under });
          }
          for (let i = P.length - 1; i >= 0; i--) {
            const p = P[i], q = P[Math.max(0, i - 1)], r2 = P[Math.min(P.length - 1, i + 1)];
            const gap = Math.max(0.6, Math.hypot(r2.x - q.x, r2.y - q.y) / Math.max(1, Math.min(P.length - 1, i + 1) - Math.max(0, i - 1)));
            const overlap = Math.max(1, 1.6 * p.rad / gap);
            const src = smooth((p.te - s0) / 0.2) * (1 - smooth((p.te - s0 - 1.4) / 1.4)); // 灯芯冒烟渐起、渐少
            const look = Math.min(0.2, 0.24 * Math.pow(2.2 / p.rad, 0.6)) * (1 - 0.5 * p.under); // 这一处烟的目视浓度
            const a = look / overlap * src * fadeAll * (1 - p.age / life) * clamp(p.age / 0.12);
            if (a < 0.002) continue;
            const rx = p.rad * (1 + 1.2 * p.under), ry = p.rad * (1 - 0.35 * p.under);
            g.globalAlpha = a;
            g.drawImage(puff, p.x - rx, p.y - ry, rx * 2, ry * 2);
          }
          g.globalAlpha = 1;
        }
        // 6) 中层雪、近景雪堆、近层虚化雪片
        drawSnow(g, t, IL, IR, 1);
        g.drawImage(bankTex(), 0, 600, W, 120);
        drawSnow(g, t, IL, IR, 2);
      },
    });
  })();
  // ============================================================
  // d2_weiqi 雪落棋局：崖边石桌上一盘未下完的棋，雪花落在空点像替人落子，雪渐密，整盘皆白
  // ============================================================
  (function () {
    const FB1 = [0.199, 0.619, 1.019, 1.439, 1.859, 2.239];
    const FB2 = [2.719, 3.159, 3.599, 3.939, 4.359, 4.879, 5.179, 5.639];
    // 透视相机：俯角 35°，盘面半宽 = 1（单位约 21 cm）
    const ALPHA = 35 * Math.PI / 180, SA = Math.sin(ALPHA), CA = Math.cos(ALPHA);
    const R = 4.5, F = 1178, CX = 640, CY = 430;
    const ROT = 5 * Math.PI / 180, CR = Math.cos(ROT), SR = Math.sin(ROT);
    const BH = 1.09, BT = 0.09, GRID = 1, STEP = 2 / 18;
    const TABLE_R = 1.78;
    // 世界坐标（X 右，Y 上，Z 远）→ 屏幕
    function P3(X, Y, Z) {
      const depth = R + Z * CA - Y * SA;
      return [CX + F * X / depth, CY - F * (Y * CA + Z * SA) / depth, depth];
    }
    // 棋盘坐标（u 右，v 远，盘面中心为原点）→ 世界（盘面略转 5°）
    const B2W = (u, v) => [u * CR - v * SR, u * SR + v * CR];
    const PB = (u, v, Y) => { const [X, Z] = B2W(u, v); return P3(X, Y || 0, Z); };
    // 交叉点 (col,row)：row 0 在远端
    const PT = (c, r) => [-GRID + c * STEP, GRID - r * STEP];
    const STONE_R = 0.05, STONE_H = 0.04;
    // 水平圆在屏幕上的椭圆：[中心 x, 中心 y, 半宽, 半高]
    function ell(X, Y, Z, r) {
      const [xl] = P3(X - r, Y, Z), [xr] = P3(X + r, Y, Z), [, yn] = P3(X, Y, Z - r), [, yf] = P3(X, Y, Z + r);
      return [(xl + xr) / 2, (yn + yf) / 2, (xr - xl) / 2, (yn - yf) / 2];
    }

    const BLACK = [[3, 15], [2, 13], [3, 12], [4, 15], [5, 16], [15, 3], [16, 5], [14, 2], [13, 3], [9, 9], [10, 10], [8, 10], [15, 15], [14, 16], [16, 13], [3, 3], [4, 2], [2, 5], [6, 3], [11, 15], [12, 14], [10, 6], [7, 13]];
    const WHITE = [[15, 16], [16, 15], [16, 16], [13, 16], [15, 14], [3, 16], [4, 16], [2, 16], [16, 3], [16, 2], [17, 4], [14, 4], [5, 3], [3, 5], [2, 3], [9, 10], [10, 9], [11, 10], [8, 9], [12, 15], [6, 14], [9, 13]];
    const KEY = [[12, 8], [6, 11], [13, 12]];
    const occupied = new Set([...BLACK, ...WHITE].map(([c, r]) => c * 19 + r));
    // 黑子覆白的先后：五颗落在第28句的字上，其余穿插
    const CAPS = (() => {
      const r = rng(5150);
      const order = BLACK.map((s, i) => ({ s, i, k: r() })).sort((a, b) => a.k - b.k);
      return order.map((o, j) => ({ s: o.s, j }));
    })();

    // ---------- 棋罐：旋转体，按高度切片（自下而上叠画即得轮廓与明暗） ----------
    const BOWLS = [[-1.40, -0.55], [1.36, 0.60]];
    const BOWL_TOP = 0.235, LID_RIM = 0.016, LID_DOME = 0.046, LID_R = 0.172;
    const BOWL_SL = (() => {
      const prof = (y) => {
        if (y < 0.012) return 0.125;                                                   // 圈足
        if (y < 0.095) return 0.14 + 0.08 * Math.sin(Math.PI / 2 * (y - 0.012) / 0.083); // 下腹外鼓
        return 0.165 + 0.055 * Math.cos(Math.PI / 2 * (y - 0.095) / (BOWL_TOP - 0.095)); // 上腹收口
      };
      const out = [], n = 100;
      for (let i = 0; i <= n; i++) { // 罐身：按高度等分
        const y = i / n * BOWL_TOP, e = 0.002;
        const dr = (prof(Math.min(BOWL_TOP, y + e)) - prof(Math.max(0, y - e))) / (2 * e);
        out.push({ y, r: prof(y), up: -dr / Math.hypot(1, dr), lid: false });
      }
      for (let i = 1; i <= 5; i++) out.push({ y: BOWL_TOP + i / 5 * LID_RIM, r: LID_R, up: i === 1 ? -0.6 : 0, lid: true }); // 盖沿（最下一层是盖与罐口的缝）
      for (let i = 1; i <= 56; i++) { // 盖面微拱：按角度等分，顶上不出环纹
        const ph = i / 56 * Math.PI / 2, cs = Math.cos(ph), sn = Math.sin(ph);
        const nu = sn / LID_DOME, nr = cs / LID_R;
        out.push({ y: BOWL_TOP + LID_RIM + LID_DOME * sn, r: LID_R * cs, up: nu / Math.hypot(nu, nr), lid: true });
      }
      return out;
    })();
    const WOOD_D = '#3a2716', WOOD_L = '#b8915f';
    function drawBowl(tg, X, Z) {
      // 罐底接触阴影（压扁的柔影）
      const [sx, sy, srx, sry] = ell(X, 0, Z, 0.17);
      const gg = tg.createRadialGradient(0, 0, 0, 0, 0, 1);
      gg.addColorStop(0, 'rgba(26,30,34,0.55)'); gg.addColorStop(0.55, 'rgba(26,30,34,0.28)'); gg.addColorStop(1, 'rgba(26,30,34,0)');
      tg.save(); tg.translate(sx, sy + 1.5); tg.scale(srx * 1.45, sry * 1.6);
      tg.fillStyle = gg; tg.beginPath(); tg.arc(0, 0, 1, 0, TAU); tg.fill(); tg.restore();
      // 切片：朝上的面受阴天天光更亮，朝下与贴桌处暗；两侧轮廓处转暗
      for (const s of BOWL_SL) {
        if (s.r <= 0.002) continue;
        const [ex, ey, rx, ry] = ell(X, s.y, Z, s.r);
        let L = 0.5 + 0.42 * s.up;
        if (s.y < 0.035) L *= 0.55 + 0.45 * s.y / 0.035;
        if (s.lid) L += 0.05;
        L = clamp(L, 0.08, 0.98);
        const cMid = mix(WOOD_D, WOOD_L, L), cEdge = mix(WOOD_D, WOOD_L, L * lerp(0.42, 0.97, Math.max(0, s.up) * Math.max(0, s.up)));
        const gr = tg.createLinearGradient(ex - rx, 0, ex + rx, 0);
        gr.addColorStop(0, cEdge); gr.addColorStop(0.36, cMid); gr.addColorStop(0.6, cMid); gr.addColorStop(1, cEdge);
        tg.fillStyle = gr; tg.beginPath(); tg.ellipse(ex, ey, rx, ry, 0, 0, TAU); tg.fill();
      }
      // 车旋的细纹：前半圈两道极淡的环线
      tg.strokeStyle = 'rgba(46,30,16,0.18)'; tg.lineWidth = 0.8;
      [0.06, 0.17].forEach((y) => {
        const s = BOWL_SL.reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));
        const [ex, ey, rx, ry] = ell(X, s.y, Z, s.r * 1.002);
        tg.beginPath(); tg.ellipse(ex, ey, rx, ry, 0, 0.12, Math.PI - 0.12); tg.stroke();
      });
    }
    // 棋罐整体轮廓（用来从桌面积雪里挖掉）
    function bowlSil(tg, X, Z) {
      tg.beginPath();
      for (const s of BOWL_SL) { if (s.r > 0.002) { const [ex, ey, rx, ry] = ell(X, s.y, Z, s.r); tg.moveTo(ex + rx, ey); tg.ellipse(ex, ey, rx, ry, 0, 0, TAU); } }
      tg.fill('nonzero');
    }
    const BOWL_BOX = BOWLS.map(([X, Z]) => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const s of BOWL_SL) { const [ex, ey, rx, ry] = ell(X, s.y, Z, s.r); x0 = Math.min(x0, ex - rx); x1 = Math.max(x1, ex + rx); y0 = Math.min(y0, ey - ry); y1 = Math.max(y1, ey + ry); }
      return [x0, y0, x1, y1];
    });
    // 盖面上的雪顶所在椭圆
    const lidTop = (X, Z, k) => ell(X, BOWL_TOP + LID_RIM + LID_DOME * 0.5, Z, 0.152 * (k || 1));

    // ---------- 棋盘的屏幕轮廓 ----------
    const BC = [[-BH, -BH], [BH, -BH], [BH, BH], [-BH, BH]];
    const quadAt = (Y) => BC.map(([u, v]) => PB(u, v, Y));
    const BOARD_HULL = (() => { // 盘顶与盘底八个角的凸包
      const pts = [...quadAt(BT), ...quadAt(0)].map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const lo = [], up = [];
      for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
      for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
      return lo.slice(0, -1).concat(up.slice(0, -1));
    })();
    const inPoly = (poly, x, y) => {
      let ins = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
      }
      return ins;
    };
    // 屏幕点到多边形边界的最短距离
    const distPoly = (poly, x, y) => {
      let m = 1e9;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j], [bx, by] = poly[i], dx = bx - ax, dy = by - ay;
        const k = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1));
        m = Math.min(m, Math.hypot(x - ax - k * dx, y - ay - k * dy));
      }
      return m;
    };
    const polyPath = (tg, pts) => { tg.beginPath(); pts.forEach((p, i) => (i ? tg.lineTo(p[0], p[1]) : tg.moveTo(p[0], p[1]))); tg.closePath(); };
    // 桌面圆在高度 Y 的轮廓
    const topPath = (tg, Y, s) => {
      tg.beginPath();
      for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; const [x, y] = P3(TABLE_R * (s || 1) * Math.cos(a), Y, TABLE_R * (s || 1) * Math.sin(a)); i ? tg.lineTo(x, y) : tg.moveTo(x, y); }
      tg.closePath();
    };
    // 桌面积雪层只占这一块（含桌沿以下几像素）
    const TB = (() => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9;
      for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; const [x, y] = P3(TABLE_R * Math.cos(a), 0.01, TABLE_R * Math.sin(a)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
      x0 = Math.max(0, Math.floor(x0 - 8)); x1 = Math.min(W, Math.ceil(x1 + 8)); y0 = Math.floor(y0 - 10);
      return [x0, y0, x1 - x0, H + 14 - y0];
    })();
    function blitTB(g, tex) { g.drawImage(tex, TB[0], TB[1], TB[2], TB[3]); }

    // 下落速度（世界单位/秒）：大片雪约 0.5 m/s
    const VF = 2.4;
    // 着陆的中层雪片：确定性排程（按密度函数逆采样）；不落在棋子、棋罐上，也不落在被棋盘、棋罐挡住的桌面上
    function makeLanders(seed, rate, t0) {
      const out = [], r = rng(seed);
      let t = t0;
      while (t < 7.2) {
        t += (0.6 + 0.8 * r()) / rate(t);
        let X, Z, onBoard = false, ok = false;
        for (let tries = 0; tries < 8 && !ok; tries++) {
          X = -1.75 + r() * 3.5; Z = -1.45 + r() * 2.9;
          const u = X * CR + Z * SR, v = -X * SR + Z * CR;
          onBoard = Math.abs(u) < BH && Math.abs(v) < BH;
          ok = true;
          if (Math.hypot(X, Z) > TABLE_R - 0.05) ok = false;
          if (onBoard) { // 不落在棋子上（棋子上的雪另算）
            const c = Math.round((u + GRID) / STEP), rr = Math.round((GRID - v) / STEP);
            const [pu, pv] = PT(c, rr);
            if (occupied.has(c * 19 + rr) && Math.hypot(u - pu, v - pv) < STONE_R * 1.3) ok = false;
            if (KEY.some(([kc, kr]) => { const [ku, kv] = PT(kc, kr); return Math.hypot(u - ku, v - kv) < STONE_R * 1.4; })) ok = false;
          } else {
            const [sx, sy] = P3(X, 0.006, Z);
            if (inPoly(BOARD_HULL, sx, sy)) ok = false;
            BOWL_BOX.forEach(([bx0, by0, bx1, by1]) => { if (sx > bx0 - 3 && sx < bx1 + 3 && sy > by0 - 3 && sy < by1 + 3) ok = false; });
          }
        }
        if (!ok) continue;
        out.push({ T: t, X, Z, onBoard, rad: (0.011 + r() * 0.014) * (t > FB2[0] ? 1.25 : 1), ph: r() * TAU, f: 0.5 + r() * 0.7, sw: 0.02 + r() * 0.03 });
      }
      // 排程之后再剔除（随机序列不变）：盘边雪沿一带、紧贴盘身轮廓的桌面、棋罐脚下的柔影里都不留落雪，免得骑在边线上成亮点
      return out.filter((L) => {
        if (L.onBoard) {
          const u = L.X * CR + L.Z * SR, v = -L.X * SR + L.Z * CR;
          return BH - Math.max(Math.abs(u), Math.abs(v)) > L.rad * 0.8 + 0.03;
        }
        const [sx, sy, d] = P3(L.X, 0.006, L.Z), sp = L.rad * 0.9 * F / d;
        if (distPoly(BOARD_HULL, sx, sy) < sp + 1.5) return false;
        return BOWLS.every(([X, Z]) => {
          const [ex, ey, rx, ry] = ell(X, 0.008, Z, 0.275), dx = (sx - ex) / (rx + sp), dy = (sy - ey - 1.5) / (ry * 1.1 + sp);
          return dx * dx + dy * dy > 1;
        });
      });
    }
    const LANDERS = makeLanders(7311, (t) => 5 + 40 * smooth((t - FB2[0] + 0.3) / 0.7), -1.2);
    // 第28句雪下密的那几秒另加一批（整盘转白要有相称的雪量），第8字后渐稀
    const LANDERS2 = makeLanders(7377, (t) => 0.4 + 75 * smooth((t - FB2[0]) / 0.8) * (1 - smooth((t - FB2[7] - 0.2) / 0.8)), FB2[0] - 0.6);
    // 远景雪片（桌后虚处）与近景虚化雪片
    const FAR = (() => { const r = rng(808), o = []; for (let i = 0; i < 270; i++) o.push({ x0: r() * (W + 60), y0: r() * (H + 40), v: 50 + r() * 40, rad: 0.9 + r() * 1.3, ph: r() * TAU, f: 0.4 + r() * 0.5, act: i < 60 ? -99 : i < 150 ? FB2[0] - 1.4 + r() * 1.4 : FB2[0] - 0.6 + r() * 1.0 }); return o; })();
    const NEAR = (() => { const r = rng(909), o = []; for (let i = 0; i < 70; i++) o.push({ x0: r() * (W + 120), y0: r() * (H + 160), v: 300 + r() * 220, rad: 6 + r() * 10, ph: r() * TAU, f: 0.3 + r() * 0.4, a: 0.26 + r() * 0.18, act: i < 14 ? -99 : FB2[0] - 0.5 + r() * 1.4 }); return o; })();

    // ---------- 浅景深：清晰与模糊两遍按屏幕高度线性混合（远处与画面下沿虚） ----------
    function dofMask(tg, keepSharp) {
      const m = tg.createLinearGradient(0, 0, 0, H);
      [[0, 1], [0.36, 0.6], [0.45, 0], [0.86, 0], [1, 1]].forEach(([o, v]) => m.addColorStop(o, `rgba(0,0,0,${keepSharp ? 1 - v : v})`));
      tg.save(); tg.globalCompositeOperation = 'destination-in';
      tg.fillStyle = m; tg.fillRect(-20, -20, W + 40, H + 60);
      tg.restore();
    }
    // box = 目标画布对应的逻辑区域 [x, y, w, h]；draw(tg) 用逻辑坐标作画
    function dofInto(g, box, blur, draw) {
      const [ox, oy, w, h] = box, sc = g.getTransform().a;
      const pw = Math.max(1, Math.round(w * sc)), ph = Math.max(1, Math.round(h * sc));
      const mk = () => { const c = document.createElement('canvas'); c.width = pw; c.height = ph; const cg = c.getContext('2d'); cg.setTransform(sc, 0, 0, sc, -ox * sc, -oy * sc); return [c, cg]; };
      const [a, ag] = mk(); draw(ag); dofMask(ag, true);
      const [b0, bg0] = mk(); draw(bg0);
      const [b, bg] = mk();
      bg.save(); bg.setTransform(1, 0, 0, 1, 0, 0); bg.filter = `blur(${(blur * sc).toFixed(2)}px)`; bg.drawImage(b0, 0, 0); bg.restore();
      dofMask(bg, false);
      ag.save(); ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalCompositeOperation = 'lighter'; ag.drawImage(b, 0, 0); ag.restore();
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(a, 0, 0); g.restore();
    }

    // ---------- 静态层 ----------
    // 背景：雾中深谷、远处小山亭、崖边、右侧雪松（全部虚化）
    function bgTex() {
      return K.cache('ff4_d2_bg', W, H, 1, (g) => {
        let gr = g.createLinearGradient(0, 0, 0, 300);
        gr.addColorStop(0, '#dfe3e6'); gr.addColorStop(0.6, '#e8ebed'); gr.addColorStop(1, '#eceef0');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        blurInto(g, W, H, 7, (tg) => {
          // 远山（谷对面）淡影
          const ridge = (y0, amp, col, a, seed) => {
            tg.fillStyle = rgba(col, a);
            tg.beginPath(); tg.moveTo(0, 330);
            for (let x = 0; x <= W; x += 8) tg.lineTo(x, y0 - amp * (0.5 + 0.5 * fbm(x / 260, seed, 3)) - amp * 0.6 * Math.max(0, fbm(x / 90, seed + 3, 2)));
            tg.lineTo(W, 330); tg.closePath(); tg.fill();
          };
          ridge(150, 60, '#b0b9c0', 0.42, 21);
          ridge(205, 50, '#9ea8b1', 0.5, 33);
          // 小山亭在左侧远岭上
          const px = 236, py = 176;
          tg.fillStyle = 'rgba(96,106,114,0.7)';
          tg.beginPath(); tg.moveTo(px - 46, py - 26); tg.quadraticCurveTo(px, py - 34, px + 46, py - 26); tg.lineTo(px + 52, py - 20);
          tg.lineTo(px + 30, py - 22); tg.lineTo(px, py - 50); tg.lineTo(px - 30, py - 22); tg.lineTo(px - 52, py - 20); tg.closePath(); tg.fill();
          tg.fillRect(px - 34, py - 22, 4, 26); tg.fillRect(px + 30, py - 22, 4, 26); tg.fillRect(px - 2, py - 22, 4, 26);
          tg.fillStyle = 'rgba(235,238,240,0.7)'; // 亭顶积雪
          tg.beginPath(); tg.moveTo(px - 26, py - 26); tg.lineTo(px, py - 48); tg.lineTo(px + 26, py - 26); tg.closePath(); tg.fill();
          tg.fillStyle = 'rgba(150,158,165,0.35)';
          tg.beginPath(); tg.moveTo(80, 230); tg.quadraticCurveTo(200, 168, 330, 186); tg.quadraticCurveTo(420, 200, 470, 236); tg.lineTo(470, 260); tg.lineTo(80, 260); tg.closePath(); tg.fill();
          // 谷中雾
          gr = tg.createLinearGradient(0, 170, 0, 260);
          gr.addColorStop(0, 'rgba(236,239,241,0)'); gr.addColorStop(1, 'rgba(236,239,241,0.9)');
          tg.fillStyle = gr; tg.fillRect(0, 170, W, 90);
        });
        // 崖顶雪地（桌后与两侧），略低于桌面，虚化
        blurInto(g, W, H, 5, (tg) => {
          tg.fillStyle = '#e4e7ea';
          tg.beginPath(); tg.moveTo(0, 252);
          for (let x = 0; x <= W; x += 10) tg.lineTo(x, 236 + 8 * fbm(x / 120, 61, 3));
          tg.lineTo(W, H); tg.lineTo(0, H); tg.closePath(); tg.fill();
          // 崖沿露出的石与枯草
          const r = rng(4242);
          for (let k = 0; k < 18; k++) {
            const x = r() * W, y = 234 + 8 * fbm(x / 120, 61, 3) + r() * 8;
            tg.fillStyle = `rgba(90,98,104,${0.25 + r() * 0.3})`;
            tg.beginPath(); tg.ellipse(x, y, 8 + r() * 18, 3 + r() * 3, 0, 0, TAU); tg.fill();
          }
          tg.strokeStyle = 'rgba(120,110,90,0.4)'; tg.lineWidth = 1.2;
          for (let k = 0; k < 40; k++) { const x = r() * W, y = 240 + r() * 12; tg.beginPath(); tg.moveTo(x, y); tg.lineTo(x + (r() - 0.3) * 6, y - 6 - r() * 8); tg.stroke(); }
          gr = tg.createLinearGradient(0, 240, 0, H);
          gr.addColorStop(0, 'rgba(200,206,212,0)'); gr.addColorStop(1, 'rgba(176,184,192,0.5)');
          tg.fillStyle = gr; tg.fillRect(0, 240, W, H - 240);
        });
        // 右侧雪松（中景，虚化）：斜出的老干，枝头一团团针叶，簇顶积雪
        blurInto(g, W, H, 4.5, (tg) => {
          const r = rng(7171);
          tg.fillStyle = '#3e3a32';
          tg.beginPath(); tg.moveTo(1250, 340); tg.bezierCurveTo(1230, 250, 1200, 170, 1150, 60);
          tg.lineTo(1136, 66); tg.bezierCurveTo(1184, 176, 1212, 256, 1228, 340); tg.closePath(); tg.fill();
          const tuft = (x, y, w, h) => {
            tg.fillStyle = `rgb(${40 + r() * 10},${52 + r() * 10},${46 + r() * 8})`;
            tg.beginPath(); tg.ellipse(x, y, w, h, (r() - 0.5) * 0.25, 0, TAU); tg.fill();
            tg.fillStyle = 'rgba(241,243,244,0.96)';
            tg.beginPath(); tg.ellipse(x - w * 0.04, y - h * 0.42, w * 0.86, h * 0.5, (r() - 0.5) * 0.2, Math.PI, TAU); tg.fill();
          };
          const limbs = [[1160, 84, -160, -10], [1176, 124, -120, 18], [1196, 170, -170, 30], [1210, 214, -110, 26], [1150, 70, 60, -30], [1222, 260, -80, 20], [1170, 100, 110, 6]];
          limbs.forEach(([x0, y0, dx, dy]) => {
            tg.strokeStyle = '#3e3a32'; tg.lineWidth = 4;
            tg.beginPath(); tg.moveTo(x0, y0); tg.quadraticCurveTo(x0 + dx * 0.5, y0 + dy * 0.2 - 8, x0 + dx, y0 + dy); tg.stroke();
            const cx = x0 + dx, cy = y0 + dy, n = 7 + Math.floor(r() * 4);
            for (let k = 0; k < n; k++) {
              const u = k / n;
              tuft(lerp(x0 + dx * 0.35, cx, u) + (r() - 0.5) * 30, lerp(y0 + dy * 0.3, cy, u) + (r() - 0.6) * 14 - 6, 24 + r() * 22, 9 + r() * 5);
            }
            tuft(cx, cy - 4, 40 + r() * 16, 12);
          });
        });
      });
    }
    // 石桌（石面不积厚雪，只有和棋盘一样的薄屑，屑另画）、棋盘、棋罐
    function drawTable(tg) {
      const TH = 0.13;
      // 石板侧面（近半圈）
      tg.beginPath();
      for (let i = 0; i <= 48; i++) { const a = Math.PI + i / 48 * Math.PI; const [x, y] = P3(TABLE_R * Math.cos(a), 0, TABLE_R * Math.sin(a)); i ? tg.lineTo(x, y) : tg.moveTo(x, y); }
      for (let i = 48; i >= 0; i--) { const a = Math.PI + i / 48 * Math.PI; const [x, y] = P3(TABLE_R * Math.cos(a), -TH, TABLE_R * Math.sin(a)); tg.lineTo(x, y); }
      tg.closePath();
      let gr = tg.createLinearGradient(0, 380, 0, H);
      gr.addColorStop(0, '#7a8288'); gr.addColorStop(1, '#5a6268');
      tg.fillStyle = gr; tg.fill();
      const rq = rng(808);
      tg.strokeStyle = 'rgba(60,66,72,0.35)'; tg.lineWidth = 1;
      for (let k = 0; k < 40; k++) { // 凿痕
        const a = Math.PI + rq() * Math.PI, [x0, y0] = P3(TABLE_R * Math.cos(a), -0.02, TABLE_R * Math.sin(a)), [x1, y1] = P3(TABLE_R * Math.cos(a), -TH + 0.02, TABLE_R * Math.sin(a));
        tg.beginPath(); tg.moveTo(x0, y0); tg.lineTo(lerp(x0, x1, 0.4 + rq() * 0.6), lerp(y0, y1, 0.4 + rq() * 0.6)); tg.stroke();
      }
      // 石面：灰石，远处受天光略亮
      topPath(tg, 0, 1);
      gr = tg.createLinearGradient(0, 228, 0, H);
      gr.addColorStop(0, '#a2aab0'); gr.addColorStop(0.45, '#8e969c'); gr.addColorStop(1, '#868e94');
      tg.fillStyle = gr; tg.fill();
      tg.save(); tg.clip();
      const r = rng(3131);
      for (let k = 0; k < 110; k++) { // 石面的斑驳
        const q = Math.sqrt(r()) * TABLE_R, a = r() * TAU, [x, y, d] = P3(q * Math.cos(a), 0, q * Math.sin(a));
        const rr = (0.08 + r() * 0.26) * F / d, dark = r() < 0.55;
        const gg = tg.createRadialGradient(0, 0, 0, 0, 0, 1);
        const col = dark ? `rgba(66,74,80,${0.1 + r() * 0.12})` : `rgba(184,192,198,${0.12 + r() * 0.14})`;
        gg.addColorStop(0, col); gg.addColorStop(1, dark ? 'rgba(66,74,80,0)' : 'rgba(184,192,198,0)');
        tg.save(); tg.translate(x, y); tg.scale(rr, rr * 0.56); tg.fillStyle = gg; tg.beginPath(); tg.arc(0, 0, 1, 0, TAU); tg.fill(); tg.restore();
      }
      for (let k = 0; k < 1600; k++) { // 麻点
        const q = Math.sqrt(r()) * TABLE_R, a = r() * TAU, [x, y, d] = P3(q * Math.cos(a), 0, q * Math.sin(a));
        const s = (0.4 + r() * 0.8) * 4.5 / d;
        tg.fillStyle = r() < 0.6 ? 'rgba(58,64,70,0.3)' : 'rgba(196,202,206,0.35)';
        tg.fillRect(x - s / 2, y - s * 0.3, s, s * 0.6);
      }
      tg.strokeStyle = 'rgba(62,68,74,0.3)'; tg.lineWidth = 0.9; // 两道细裂纹
      [[-1.5, -0.2, 7], [0.9, 1.2, 11]].forEach(([X0, Z0, seed]) => {
        const rr = rng(seed); let X = X0, Z = Z0;
        tg.beginPath(); tg.moveTo(...P3(X, 0, Z).slice(0, 2));
        for (let i = 0; i < 9; i++) { X += 0.05 + rr() * 0.05; Z += (rr() - 0.5) * 0.09; tg.lineTo(...P3(X, 0, Z).slice(0, 2)); }
        tg.stroke();
      });
      tg.restore();
      // 石面近沿一线柔和的亮棱
      tg.strokeStyle = 'rgba(196,204,210,0.55)'; tg.lineWidth = 1.2;
      tg.beginPath();
      for (let i = 0; i <= 48; i++) { const a = Math.PI + i / 48 * Math.PI; const [x, y] = P3(TABLE_R * 0.995 * Math.cos(a), 0, TABLE_R * 0.995 * Math.sin(a)); i ? tg.lineTo(x, y) : tg.moveTo(x, y); }
      tg.stroke();
      // 棋盘落在石面上：一圈柔和的接触暗影
      for (let k = 0; k < 3; k++) {
        tg.fillStyle = 'rgba(40,46,52,0.1)';
        polyPath(tg, BC.map(([u, v]) => PB(u * (1.012 + k * 0.012), v * (1.012 + k * 0.012), 0))); tg.fill();
      }
      // 棋盘：先画露出的侧面，再画盘面
      const top = quadAt(BT), bot = quadAt(0);
      const side = (i, j, col) => {
        tg.fillStyle = col;
        tg.beginPath(); tg.moveTo(top[i][0], top[i][1]); tg.lineTo(top[j][0], top[j][1]); tg.lineTo(bot[j][0], bot[j][1]); tg.lineTo(bot[i][0], bot[i][1]); tg.closePath(); tg.fill();
      };
      side(0, 1, '#6e5434'); // 近侧
      side(1, 2, '#5e4830'); // 右侧（略可见）
      tg.strokeStyle = 'rgba(60,40,22,0.35)'; tg.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        const y0 = lerp(top[0][1], bot[0][1], k / 4), y1 = lerp(top[1][1], bot[1][1], k / 4);
        tg.beginPath(); tg.moveTo(top[0][0], y0); tg.lineTo(top[1][0], y1); tg.stroke();
      }
      polyPath(tg, top);
      gr = tg.createLinearGradient(0, top[3][1], 0, top[0][1]);
      gr.addColorStop(0, '#b29466'); gr.addColorStop(0.5, '#a1825a'); gr.addColorStop(1, '#93754f');
      tg.fillStyle = gr; tg.fill();
      tg.save(); tg.clip();
      const rr = rng(9917);
      for (let k = 0; k < 70; k++) { // 木纹
        const v = -BH + rr() * 2 * BH, w = 0.004 + rr() * 0.01;
        tg.strokeStyle = `rgba(${rr() < 0.5 ? '120,92,58' : '186,160,118'},${0.16 + rr() * 0.18})`;
        tg.lineWidth = Math.max(0.6, w * 300 / 4.5);
        tg.beginPath();
        for (let s = 0; s <= 20; s++) { const u = -BH + s / 20 * 2 * BH; const [x, y] = PB(u, v + 0.012 * Math.sin(u * 7 + k), BT); s ? tg.lineTo(x, y) : tg.moveTo(x, y); }
        tg.stroke();
      }
      tg.strokeStyle = 'rgba(34,24,16,0.82)'; // 网格
      for (let i = 0; i < 19; i++) {
        const a = -GRID + i * STEP;
        let [x0, y0, d0] = PB(a, -GRID, BT), [x1, y1] = PB(a, GRID, BT);
        tg.lineWidth = i === 0 || i === 18 ? 1.8 : 1.1;
        tg.beginPath(); tg.moveTo(x0, y0); tg.lineTo(x1, y1); tg.stroke();
        [x0, y0, d0] = PB(-GRID, a, BT); [x1, y1] = PB(GRID, a, BT);
        tg.lineWidth = (i === 0 || i === 18 ? 1.8 : 1.15) * 4.5 / d0;
        tg.beginPath(); tg.moveTo(x0, y0); tg.lineTo(x1, y1); tg.stroke();
      }
      tg.fillStyle = 'rgba(34,24,16,0.9)';
      [3, 9, 15].forEach((c) => [3, 9, 15].forEach((r0) => {
        const [u, v] = PT(c, r0), [x, y, d] = PB(u, v, BT), s = 2.6 * 4.5 / d;
        tg.beginPath(); tg.ellipse(x, y, s, s * SA * 1.1, 0, 0, TAU); tg.fill();
      }));
      tg.restore();
      tg.strokeStyle = 'rgba(230,214,180,0.5)'; tg.lineWidth = 1.2; // 盘边受天光的一线亮边
      tg.beginPath(); tg.moveTo(top[0][0], top[0][1]); tg.lineTo(top[1][0], top[1][1]); tg.stroke();
      // 棋罐：先远后近
      [...BOWLS].sort((a, b) => b[1] - a[1]).forEach(([X, Z]) => drawBowl(tg, X, Z));
    }
    function tableTex() {
      return K.cache('ff4_d2_table2', W, H + 16, 1, (g) => dofInto(g, [0, 0, W, H + 16], 3.2, drawTable));
    }
    // 从桌面积雪里挖掉棋盘与棋罐占的地方
    function cutFootprints(tg) {
      tg.save(); tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = '#000';
      polyPath(tg, BOARD_HULL); tg.fill();
      BOWLS.forEach(([X, Z]) => bowlSil(tg, X, Z));
      tg.restore();
    }
    // 薄屑两层：桌面、盘面、罐盖同一场雪
    function dustTex(k) {
      return K.cache('ff4_d2_dust2_' + k, TB[2], TB[3], 1, (g) => dofInto(g, TB, 3.2, (tg) => {
        const r = rng(1000 + k * 77);
        const speck = (x, y, d, big) => {
          const s = (0.5 + r() * (big ? 1.4 : 1.0)) * 4.5 / d;
          tg.fillStyle = `rgba(250,251,252,${0.35 + r() * 0.5})`;
          tg.beginPath(); tg.ellipse(x, y, s, s * 0.6, 0, 0, TAU); tg.fill();
        };
        tg.save(); topPath(tg, 0.004, 1); tg.clip();
        for (let i = 0, n = k ? 11000 : 5500; i < n; i++) {
          const q = Math.sqrt(r()) * TABLE_R, a = r() * TAU, [x, y, d] = P3(q * Math.cos(a), 0.004, q * Math.sin(a));
          speck(x, y, d, k);
        }
        tg.restore();
        cutFootprints(tg);
        tg.save(); polyPath(tg, quadAt(BT)); tg.clip();
        for (let i = 0, n = k ? 5200 : 2600; i < n; i++) {
          const u = -BH + r() * 2 * BH, v = -BH + r() * 2 * BH, [x, y, d] = PB(u, v, BT);
          speck(x, y, d, k);
        }
        tg.restore();
        BOWLS.forEach(([X, Z]) => {
          const [ex, ey, rx, ry] = lidTop(X, Z, 0.95);
          tg.save(); tg.beginPath(); tg.ellipse(ex, ey, rx, ry, 0, 0, TAU); tg.clip();
          for (let i = 0, n = k ? 110 : 55; i < n; i++) { const a = r() * TAU, q = Math.sqrt(r()); speck(ex + Math.cos(a) * rx * q, ey + Math.sin(a) * ry * q, 4.5, k); }
          tg.restore();
        });
      }));
    }
    // 积雪的薄膜：一张均匀的雪面，乘上细颗粒遮罩逐级变厚（颗粒远小于棋格，像越落越密的雪粉，不成片、不成岛）
    // 第 k 级的平均覆盖约为 k/NL；雪沿与接触暗影另成两层
    const NL = 7, FILM_B = 0.82, FILM_E = 0.35;
    // 屏幕点反投到高度 Y0 的水平面
    function unproj(x, y, Y0) {
      const v = CY - y, Z = (F * Y0 * CA - v * (R - Y0 * SA)) / (v * CA - F * SA);
      return [(x - CX) * (R + Z * CA - Y0 * SA) / F, Z];
    }
    // 梯度噪声（平滑、无方格痕）
    const GRAD = (() => { const a = new Float32Array(512); for (let i = 0; i < 256; i++) { const t = h2(i, 977) * TAU; a[i * 2] = Math.cos(t); a[i * 2 + 1] = Math.sin(t); } return a; })();
    function gnoise(x, y, seed) {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const gi = (a, b) => (Math.floor(h2(a + seed * 7919, b) * 256) & 255) * 2;
      const d = (a, b, dx, dy) => { const k = gi(a, b); return GRAD[k] * dx + GRAD[k + 1] * dy; };
      const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      return lerp(lerp(d(i, j, fx, fy), d(i + 1, j, fx - 1, fy), ux), lerp(d(i, j + 1, fx, fy - 1), d(i + 1, j + 1, fx - 1, fy - 1), ux), uy);
    }
    const devS = () => (XYT.sprites && XYT.sprites.S) || 1;
    // 颗粒场：每个设备像素一个值，换成 0..1 的名次（直方图均衡），只算一次
    let FIELD = null;
    function filmField() {
      const S = devS();
      if (FIELD && FIELD.S === S) return FIELD;
      const [x0, y0] = TB, w = Math.round(TB[2] * S), h = Math.round(TB[3] * S), n = new Float32Array(w * h), bq = quadAt(BT);
      const RC = Math.cos(0.65), RS = Math.sin(0.65); // 噪声坐标转约 37°，避开棋格方向
      const NB = 1024, hist = new Float64Array(NB);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = x0 + (i + 0.5) / S, y = y0 + (j + 0.5) / S, onB = inPoly(bq, x, y);
        const [X, Z] = unproj(x, y, onB ? BT : 0);
        const a = X * RC - Z * RS, b = X * RS + Z * RC;
        const v = 0.7 * gnoise(a * 170, b * 170, 3) + 0.3 * gnoise(a * 95 + 17, b * 95, 4);
        const q = Math.min(NB - 1, Math.max(0, Math.floor((v * 0.9 + 0.5) * NB)));
        n[j * w + i] = q; hist[q]++;
      }
      const cdf = new Float32Array(NB); let acc = 0;
      for (let b = 0; b < NB; b++) { acc += hist[b]; cdf[b] = acc / (w * h); }
      for (let k = 0; k < w * h; k++) n[k] = cdf[n[k]];
      FIELD = { n, w, h, S };
      return FIELD;
    }
    // 第 s 级遮罩：一层随厚度变浓的雪纱（FILM_B），加上颗粒按名次逐渐填满（软边 FILM_E）
    function filmMask(s) {
      const { n, w, h } = filmField(), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cg = cv.getContext('2d'), img = cg.createImageData(w, h), A = s / NL, base = FILM_B * A;
      for (let i = 0; i < w * h; i++) {
        const gr = clamp((A * (1 + FILM_E) - n[i]) / FILM_E);
        img.data[i * 4 + 3] = Math.round((base + (1 - base) * gr) * 255);
      }
      cg.putImageData(img, 0, 0);
      return cv;
    }
    // 更密的雪屑（接在两层薄屑之后）：每级只含新增的雪屑，已出现的各级一直保留，覆盖只增不减
    const SPK_D = [1500, 3000, 5000, 7500]; // 每级累计密度（每平方单位）
    let SPK = null;
    function speckRaw() {
      const S = devS();
      if (SPK && SPK.S === S) return SPK;
      const [x0, y0] = TB, w = Math.round(TB[2] * S), h = Math.round(TB[3] * S);
      // 棋盘、棋罐挡住的桌面
      const fc = document.createElement('canvas'); fc.width = w; fc.height = h;
      const fg = fc.getContext('2d'); fg.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); fg.fillStyle = '#000';
      polyPath(fg, BOARD_HULL); fg.fill(); BOWLS.forEach(([X, Z]) => bowlSil(fg, X, Z));
      const foot = fg.getImageData(0, 0, w, h).data;
      const buf = new Float32Array(w * h), r = rng(4711), lv = [];
      const splat = (x, y, d) => {
        const px = (x - x0) * S, py = (y - y0) * S;
        const sx = (0.7 + r() * 1.0) * 4.5 / d * S, sy = sx * 0.62, a = 0.6 + r() * 0.35;
        const ex = sx + 0.5, ey = sy + 0.5, pk = a * Math.min(1, (sx * sy) / (ex * ey) * 1.6);
        const ia = Math.max(0, Math.floor(px - ex)), ib = Math.min(w - 1, Math.floor(px + ex));
        const ja = Math.max(0, Math.floor(py - ey)), jb = Math.min(h - 1, Math.floor(py + ey));
        for (let j = ja; j <= jb; j++) for (let i = ia; i <= ib; i++) {
          const dx = (i + 0.5 - px) / ex, dy = (j + 0.5 - py) / ey, q = dx * dx + dy * dy;
          if (q >= 1) continue;
          const v = pk * (1 - q) * (1 - q), k = j * w + i;
          buf[k] = 1 - (1 - buf[k]) * (1 - v);
        }
      };
      let prev = 0;
      for (const D of SPK_D) {
        const dn = D - prev; prev = D;
        const nT = Math.round(dn * Math.PI * TABLE_R * TABLE_R), nB = Math.round(dn * 4 * BH * BH), nL = Math.round(dn * Math.PI * 0.152 * 0.152);
        for (let i = 0; i < nT; i++) {
          const q = Math.sqrt(r()) * TABLE_R, a = r() * TAU, [x, y, d] = P3(q * Math.cos(a), 0.004, q * Math.sin(a));
          const fi = (Math.floor((y - y0) * S) * w + Math.floor((x - x0) * S)) * 4 + 3;
          if (foot[fi] > 8) { r(); r(); continue; }
          splat(x, y, d);
        }
        for (let i = 0; i < nB; i++) { const [x, y, d] = PB(-BH + r() * 2 * BH, -BH + r() * 2 * BH, BT); splat(x, y, d); }
        BOWLS.forEach(([X, Z]) => {
          const [ex, ey, rx, ry] = lidTop(X, Z, 0.95);
          for (let i = 0; i < nL; i++) { const a = r() * TAU, q = Math.sqrt(r()); splat(ex + Math.cos(a) * rx * q, ey + Math.sin(a) * ry * q, 4.5); }
        });
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cg = cv.getContext('2d'), img = cg.createImageData(w, h);
        for (let k = 0; k < w * h; k++) { const o = k * 4; img.data[o] = 251; img.data[o + 1] = 252; img.data[o + 2] = 253; img.data[o + 3] = Math.round(clamp(buf[k]) * 255); }
        cg.putImageData(img, 0, 0);
        lv.push(cv);
        buf.fill(0);
      }
      SPK = { lv, S };
      return SPK;
    }
    function speckTex(k) {
      return K.cache('ff4_d2_spk2_' + k, TB[2], TB[3], 1, (g) => {
        const raw = speckRaw().lv[k];
        dofInto(g, TB, 3.2, (tg) => { tg.imageSmoothingEnabled = false; tg.drawImage(raw, TB[0], TB[1], TB[2], TB[3]); });
      });
    }
    // 两层薄屑都到了终值后合成一张（与分开叠画的像素相同）
    function dustBoth() {
      return K.cache('ff4_d2_dustb', TB[2], TB[3], 1, (g) => {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 0.8; g.drawImage(dustTex(0), 0, 0); g.globalAlpha = 1; g.drawImage(dustTex(1), 0, 0);
        g.restore();
      });
    }
    // 薄屑与全部雪屑的合成（雪屑全到之后每帧只贴这一张）
    function dustSpkAll() {
      return K.cache('ff4_d2_dspk', TB[2], TB[3], 1, (g) => {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(dustBoth(), 0, 0); g.drawImage(speckCum(SPK_D.length), 0, 0); g.restore();
      });
    }
    // 前 k 级雪屑依次叠好的合成（与逐级叠画的像素完全相同，每帧少贴几张大图）
    function speckCum(k) {
      if (k <= 1) return speckTex(0);
      return K.cache('ff4_d2_spkc_' + k, TB[2], TB[3], 1, (g) => {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < k; i++) g.drawImage(speckTex(i), 0, 0);
        g.restore();
        if (k === SPK_D.length) SPK = null; // 各级都已缓存，原始像素可以释放
      });
    }
    // 雪面极淡的起伏
    function ripples(tg, seed, n, Y, inBoard) {
      const r = rng(seed);
      for (let k = 0; k < n; k++) {
        let X, Z;
        if (inBoard) { const u = (r() * 2 - 1) * BH, v = (r() * 2 - 1) * BH; [X, Z] = B2W(u, v); } else { const q = Math.sqrt(r()) * TABLE_R, a = r() * TAU; X = q * Math.cos(a); Z = q * Math.sin(a); }
        const [x, y, d] = P3(X, Y, Z), rr = (0.15 + r() * 0.3) * F / d;
        const gg = tg.createRadialGradient(0, 0, 0, 0, 0, 1);
        const tone = r() < 0.5 ? 'rgba(196,204,212,0.3)' : 'rgba(255,255,255,0.45)';
        gg.addColorStop(0, tone); gg.addColorStop(1, 'rgba(240,242,244,0)');
        tg.save(); tg.translate(x, y); tg.scale(rr, rr * 0.5); tg.fillStyle = gg; tg.beginPath(); tg.arc(0, 0, 1, 0, TAU); tg.fill(); tg.restore();
      }
    }
    // 圆桌边或盘边的一条带（arcs: 屏幕点列，按高度 Y0/Y1 取两条）
    function rimBand(tg, ptAt, n, Y0, Y1) {
      tg.beginPath();
      for (let i = 0; i <= n; i++) { const [x, y] = ptAt(i / n, Y0); i ? tg.lineTo(x, y) : tg.moveTo(x, y); }
      for (let i = n; i >= 0; i--) { const [x, y] = ptAt(i / n, Y1); tg.lineTo(x, y); }
      tg.closePath();
    }
    const tableRimAt = (s, Y) => { const a = Math.PI + s * Math.PI; return P3(TABLE_R * Math.cos(a), Y, TABLE_R * Math.sin(a)); };
    const nearRimAt = (s, Y) => PB(lerp(-BH, BH, s), -BH, Y); // 近侧盘边（侧面朝镜头）
    // 左、右、远三条盘边的侧面都背向镜头，看到的只是盘面雪的轮廓；w = 从轮廓往盘内的距离
    const CONTOURS = [
      (s, w) => PB(-BH + w, lerp(-BH, BH, s), BT + 0.006),
      (s, w) => PB(BH - w, lerp(-BH, BH, s), BT + 0.006),
      (s, w) => PB(lerp(-BH, BH, s), BH - w, BT + 0.006),
    ];
    // 雪面本身（颗粒遮罩只作用于这一层；雪沿、接触暗影各成一层，不随遮罩时隐时现）
    function snowSurface(tg) {
      // 桌面
      tg.save(); topPath(tg, 0.008, 1); tg.clip();
      let gr = tg.createLinearGradient(0, 228, 0, H);
      gr.addColorStop(0, '#f4f6f7'); gr.addColorStop(1, '#e6eaed');
      tg.fillStyle = gr; tg.fillRect(0, 200, W, H);
      ripples(tg, 3132, 70, 0.008, false);
      tg.restore();
      cutFootprints(tg);
      // 盘面
      tg.save(); polyPath(tg, quadAt(BT + 0.006)); tg.clip();
      gr = tg.createLinearGradient(0, quadAt(BT)[3][1], 0, quadAt(BT)[0][1]);
      gr.addColorStop(0, '#f5f7f8'); gr.addColorStop(1, '#e9edf0');
      tg.fillStyle = gr; tg.fillRect(0, 200, W, H);
      ripples(tg, 3133, 40, BT + 0.006, true);
      tg.restore();
      // 罐盖雪顶：微拱，上亮下灰，前沿略厚
      BOWLS.forEach(([X, Z]) => {
        const [ex, ey, rx, ry] = lidTop(X, Z);
        gr = tg.createLinearGradient(0, ey - ry - 3, 0, ey + ry + 2);
        gr.addColorStop(0, '#f7f9fa'); gr.addColorStop(0.55, '#edf0f3'); gr.addColorStop(1, '#c9d0d6');
        tg.fillStyle = gr; tg.beginPath(); tg.ellipse(ex, ey - 1.5, rx, ry + 1.8, 0, 0, TAU); tg.fill();
        tg.fillStyle = 'rgba(255,255,255,0.6)'; tg.beginPath(); tg.ellipse(ex - rx * 0.1, ey - ry * 0.35 - 1.5, rx * 0.55, ry * 0.4, 0, 0, TAU); tg.fill();
      });
    }
    // s = 1..NL-1：颗粒遮罩下的雪面；s = NL：整片
    function filmTex(s) {
      return K.cache('ff4_d2_film4_' + s, TB[2], TB[3], 1, (g) => {
        const mask = s < NL ? filmMask(s) : null;
        dofInto(g, TB, 3.2, (tg) => {
          snowSurface(tg);
          if (mask) {
            tg.save(); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = false;
            tg.drawImage(mask, 0, 0); tg.restore();
          }
        });
      });
    }
    // 盘身四周桌面雪的环境遮蔽：一圈圈外扩的圆角框叠出由深到浅，再整体柔化（只在建缓存时用滤镜）
    function boardAO() {
      return K.cache('ff4_d2_ao', TB[2], TB[3], 1, (g) => {
        const sc = g.getTransform().a, t = document.createElement('canvas');
        t.width = Math.round(TB[2] * sc); t.height = Math.round(TB[3] * sc);
        const tg = t.getContext('2d'); tg.setTransform(sc, 0, 0, sc, -TB[0] * sc, -TB[1] * sc);
        tg.fillStyle = 'rgb(100,110,124)'; tg.globalAlpha = 0.022;
        for (let k = 1; k <= 16; k++) {
          const dd = 0.24 * Math.pow(k / 16, 1.6);
          tg.beginPath();
          [[1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([su, sv], ci) => { // 四角各一段圆弧
            const a0 = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][ci];
            for (let i = 0; i <= 6; i++) {
              const a = a0 + i / 6 * Math.PI / 2, [x, y] = PB(su * BH + dd * Math.cos(a), sv * BH + dd * Math.sin(a), 0.008);
              (ci || i) ? tg.lineTo(x, y) : tg.moveTo(x, y);
            }
          });
          tg.closePath(); tg.fill();
        }
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${(2.5 * sc).toFixed(2)}px)`; g.drawImage(t, 0, 0); g.restore();
      });
    }
    // 接触暗影层：棋罐脚下与盘身四周桌面雪的柔影（平滑，不受颗粒遮罩影响），盖在雪膜、雪屑之上
    function contactTex() {
      return K.cache('ff4_d2_contact', TB[2], TB[3], 1, (g) => dofInto(g, TB, 3.2, (tg) => {
        tg.save(); topPath(tg, 0.008, 1); tg.clip();
        tg.drawImage(boardAO(), TB[0], TB[1], TB[2], TB[3]);
        BOWLS.forEach(([X, Z]) => { // 罐身挡住中间，只露出一圈，近侧略重
          const [sx, sy, srx, sry] = ell(X, 0.008, Z, 0.275);
          const gg = tg.createRadialGradient(0, 0, 0, 0, 0, 1);
          gg.addColorStop(0, 'rgba(70,78,88,0.5)'); gg.addColorStop(0.76, 'rgba(70,78,88,0.4)'); gg.addColorStop(0.88, 'rgba(70,78,88,0.16)'); gg.addColorStop(1, 'rgba(70,78,88,0)');
          tg.save(); tg.translate(sx, sy + 1.5); tg.scale(srx, sry * 1.1);
          tg.fillStyle = gg; tg.beginPath(); tg.arc(0, 0, 1, 0, TAU); tg.fill(); tg.restore();
        });
        tg.restore();
        cutFootprints(tg);
        tg.save(); tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = '#000';
        polyPath(tg, quadAt(BT + 0.006)); tg.fill(); // 盘面雪（比盘顶略高）也挡住身后的桌面
        tg.restore();
      }));
    }
    // 雪沿层：桌沿与近侧盘边的雪沿（圆转向下的灰带、受天光的亮线、沿下侧壁的暗影），三条背向镜头的盘边只画雪面在轮廓处圆转的灰带
    function rimTex() {
      return K.cache('ff4_d2_rim', TB[2], TB[3], 1, (g) => dofInto(g, TB, 3.2, (tg) => {
        for (let k = 0; k < 4; k++) { tg.fillStyle = `rgba(30,36,42,${[0.26, 0.17, 0.1, 0.04][k]})`; rimBand(tg, tableRimAt, 64, -0.01 - k * 0.01, -0.02 - k * 0.01); tg.fill(); }
        tg.fillStyle = '#dde3e8'; rimBand(tg, tableRimAt, 64, 0.008, -0.01); tg.fill();
        tg.fillStyle = 'rgba(250,251,252,0.7)'; rimBand(tg, tableRimAt, 64, 0.009, 0.002); tg.fill();
        tg.save(); tg.globalCompositeOperation = 'destination-out'; tg.fillStyle = '#000';
        BOWLS.forEach(([X, Z]) => bowlSil(tg, X, Z));
        tg.restore();
        for (let k = 0; k < 3; k++) { tg.fillStyle = `rgba(36,24,12,${[0.3, 0.18, 0.08][k]})`; rimBand(tg, nearRimAt, 24, BT - 0.008 - k * 0.01, BT - 0.018 - k * 0.01); tg.fill(); }
        tg.fillStyle = '#dde3e8'; rimBand(tg, nearRimAt, 24, BT + 0.006, BT - 0.008); tg.fill();
        tg.fillStyle = 'rgba(250,251,252,0.7)'; rimBand(tg, nearRimAt, 24, BT + 0.007, BT + 0.001); tg.fill();
        CONTOURS.forEach((at) => {
          [[0, 0.004, 0.2], [0.004, 0.008, 0.13], [0.008, 0.012, 0.075], [0.012, 0.017, 0.035]].forEach(([w0, w1, a]) => {
            tg.fillStyle = `rgba(108,118,132,${a})`; rimBand(tg, at, 24, w0, w1); tg.fill();
          });
          tg.fillStyle = 'rgba(255,255,255,0.4)'; rimBand(tg, at, 24, 0.019, 0.027); tg.fill();
        });
      }));
    }
    // 两层都到终值后合成一张（少贴一张大图）
    function edgesTex() {
      return K.cache('ff4_d2_edges', TB[2], TB[3], 1, (g) => {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(contactTex(), 0, 0); g.drawImage(rimTex(), 0, 0); g.restore();
      });
    }
    // 积雪落满之后：雪面、接触暗影、雪沿合成一张
    function surfFinalTex() {
      return K.cache('ff4_d2_surf', TB[2], TB[3], 1, (g) => {
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(filmTex(NL), 0, 0); g.drawImage(edgesTex(), 0, 0); g.restore();
      });
    }
    // 一颗棋子（含接触阴影）
    function stoneGeo(u, v) {
      const [x, y, d] = PB(u, v, BT);
      const rx = STONE_R * F / d, ry = rx * (SA + 0.18);
      return { x, y, d, rx, ry, cy: y - STONE_H * CA * F / d * 0.5 };
    }
    function drawStone(g, u, v, black, shadowOnly, flat) {
      const { x, y, d, rx, ry, cy } = stoneGeo(u, v), k = 4.5 / d;
      let gr;
      if (shadowOnly) { // 接触阴影（阴天：柔、稍偏近侧）；积雪连片后被盖住
        gr = g.createRadialGradient(x, y + 1.5 * k, 0, x, y + 1.5 * k, rx * 1.25);
        gr.addColorStop(0, 'rgba(40,30,20,0.45)'); gr.addColorStop(0.7, 'rgba(40,30,20,0.18)'); gr.addColorStop(1, 'rgba(40,30,20,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y + 1.5 * k, rx * 1.25, ry * 1.1, 0, 0, TAU); g.fill();
        return;
      }
      if (black) {
        gr = g.createRadialGradient(x - rx * 0.1, cy - ry * 0.45, rx * 0.05, x, cy, rx * 1.05);
        gr.addColorStop(0, '#5c6268'); gr.addColorStop(0.35, '#2a2d31'); gr.addColorStop(1, '#141618');
      } else {
        gr = g.createRadialGradient(x - rx * 0.1, cy - ry * 0.4, rx * 0.05, x, cy, rx * 1.05);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#eeeeea'); gr.addColorStop(1, flat ? '#e6eaed' : '#b9bdbf');
      }
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, cy, rx, ry, 0, 0, TAU); g.fill();
      if (flat && !black) return; // 被雪埋住的白子：不再画侧面的灰影与高光（免得在雪里像透明的珠子）
      // 下半部的侧面更暗：竖直渐变，裁在棋子轮廓内（没有硬分界）
      g.save(); g.beginPath(); g.ellipse(x, cy, rx, ry, 0, 0, TAU); g.clip();
      const sg = g.createLinearGradient(0, cy - ry * 0.1, 0, cy + ry);
      const tint = black ? '0,0,0' : '112,120,128';
      sg.addColorStop(0, `rgba(${tint},0)`); sg.addColorStop(1, `rgba(${tint},${black ? 0.42 : 0.34})`);
      g.fillStyle = sg; g.fillRect(x - rx - 1, cy - ry - 1, rx * 2 + 2, ry * 2 + 2);
      g.restore();
      // 天光高光（远侧上沿的柔光）
      g.fillStyle = black ? 'rgba(200,210,220,0.35)' : 'rgba(255,255,255,0.6)';
      g.beginPath(); g.ellipse(x - rx * 0.1, cy - ry * 0.5, rx * 0.45, ry * 0.22, 0, 0, TAU); g.fill();
    }
    // sh：只画接触阴影；flat：白子去掉侧面灰影
    function stonesTex(sh, flat) {
      return K.cache('ff4_d2_stones3' + (sh ? 's' : '') + (flat ? 'f' : ''), W, H, 1, (g) => {
        const all = [...BLACK.map((s) => [s, 1]), ...WHITE.map((s) => [s, 0])];
        all.sort((a, b) => a[0][1] - b[0][1]); // 先远后近
        all.forEach(([[c, r], bl]) => { const [u, v] = PT(c, r); drawStone(g, u, v, bl, sh, flat); });
      });
    }
    // 黑子顶上的雪屑（第27句渐显）
    function stoneDustTex() {
      return K.cache('ff4_d2_sdust', W, H, 1, (g) => {
        const r = rng(626);
        BLACK.forEach(([c, rr]) => {
          const [u, v] = PT(c, rr), { x, rx, ry, cy } = stoneGeo(u, v);
          for (let k = 0; k < 9; k++) {
            const a = r() * TAU, q = Math.sqrt(r()) * 0.7;
            g.fillStyle = `rgba(248,249,250,${0.5 + r() * 0.4})`;
            g.beginPath(); g.ellipse(x + Math.cos(a) * rx * q, cy - ry * 0.25 + Math.sin(a) * ry * q * 0.7, 0.7 + r() * 0.9, 0.5 + r() * 0.5, 0, 0, TAU); g.fill();
          }
        });
      });
    }
    // 背景与石桌合成一张（每帧少一次整屏缩放贴图）
    function sceneTex() {
      return K.cache('ff4_d2_scene2', W, H, 1, (g) => { g.drawImage(bgTex(), 0, 0, W, H); g.drawImage(tableTex(), 0, 0, W, H + 16); });
    }
    // 盘面所在的矩形：棋子层只贴这一块
    const BOX = (() => {
      const pts = quadAt(BT);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.floor(Math.min(...xs) - 24), y0 = Math.floor(Math.min(...ys) - 30), x1 = Math.ceil(Math.max(...xs) + 24), y1 = Math.ceil(Math.max(...ys) + 24);
      return [x0, y0, x1 - x0, y1 - y0];
    })();
    function blitBox(g, tex) {
      const S = tex.width / tex.lw, [x, y, w, h] = BOX;
      g.drawImage(tex, x * S, y * S, w * S, h * S, x, y, w, h);
    }
    // 远景雪的可见区：画面上部减去桌面
    const FAR_CLIP = (() => {
      const p = new Path2D();
      p.rect(-50, -50, W + 100, 360);
      for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; const [x, y] = P3(TABLE_R * Math.cos(a), 0.012, TABLE_R * Math.sin(a)); i ? p.lineTo(x, y - 3) : p.moveTo(x, y - 3); }
      p.closePath();
      return p;
    })();
    // 雪花落定后的形状：略压扁、边缘柔
    function flakeSprite() {
      return K.cache('ff4_d2_flake', 32, 32, 2, (g) => {
        const r = rng(55);
        for (let k = 0; k < 6; k++) {
          const x = 16 + (r() - 0.5) * 8, y = 16 + (r() - 0.5) * 8, rr = 5 + r() * 5;
          const gr = g.createRadialGradient(x, y, 0, x, y, rr);
          gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
      });
    }

    // 空中的雪片：淡灰外晕 + 白芯，亮天与暗盘上都看得清；临落地时外晕淡去
    function airFlake(g, x, y, s, a, halo) {
      const hk = halo == null ? 1 : halo;
      if (hk > 0.01) { g.globalAlpha = 0.28 * a * hk; g.drawImage(tinted('d2h', dotSprite('soft', 0.35), '#9aa4ae'), x - s * 1.5, y - s * 1.5, s * 3, s * 3); }
      g.globalAlpha = a; g.drawImage(flakeSprite(), x - s, y - s, s * 2, s * 2);
      g.globalAlpha = 1;
    }
    // 单个下落/落定的雪花（世界坐标落点 X,Z，落定时刻 T）
    function flakeAt(L, t, onTop) {
      const dt = L.T - t; // >0 还在空中
      const Y0 = onTop || 0;
      if (dt > 0) {
        const Y = Y0 + VF * dt;
        const damp = clamp(dt / 0.35);
        const X = L.X + L.sw * Math.sin(L.f * TAU * t + L.ph) * damp, Z = L.Z + L.sw * 0.5 * Math.cos(L.f * 1.7 * TAU * t + L.ph) * damp;
        const [x, y, d] = P3(X, Y, Z);
        return { x, y, s: L.rad * F / d, air: true, dt };
      }
      const [x, y, d] = P3(L.X, Y0, L.Z);
      return { x, y, s: L.rad * F / d, air: false, age: -dt };
    }
    // 棋子顶上的雪丘：一整团圆顶，从落下的那片雪（或一粒雪屑）平滑长大，偏向远侧（顶面），近下沿留一线棋子本色
    // 局部雪面颜色（与雪面渐变一致），用于周围积雪漫上棋子的那一圈
    const BQ = quadAt(BT), BY0 = BQ[3][1], BY1 = BQ[0][1];
    const snowAt = (y) => mix('#f5f7f8', '#e9edf0', clamp((y - BY0) / (BY1 - BY0)));
    // 圆顶雪团贴图：上亮下灰，四周软边（单位椭圆铺满贴图）
    function domeSprite() {
      return K.cache('ff4_d2_dome', 128, 96, 1, (g) => {
        let gr = g.createLinearGradient(0, 0, 0, 96);
        gr.addColorStop(0, '#fafbfb'); gr.addColorStop(0.45, '#f2f4f6'); gr.addColorStop(1, '#dce1e5');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 96);
        gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.save(); g.translate(58, 30); g.scale(44, 20); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
        g.save(); g.globalCompositeOperation = 'destination-in';
        gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, '#000'); gr.addColorStop(0.8, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.translate(64, 48); g.scale(64, 48); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
      });
    }
    // 埋住的棋子：整颗成一个与雪面相融的小雪包（贴图框：x ±1.2 rx，y −1.7..1.1 ry，以棋子中心为原点）
    const MD = { x0: -1.2, x1: 1.2, y0: -1.7, y1: 1.1, cy: -0.3, rx: 1.15, ry: 1.36 };
    function moundSprite() {
      return K.cache('ff4_d2_mound', 120, 140, 1, (g) => {
        const sx = 120 / (MD.x1 - MD.x0), sy = 140 / (MD.y1 - MD.y0), Y = (v) => (v - MD.y0) * sy;
        const cx = -MD.x0 * sx, cy = Y(MD.cy);
        let gr = g.createLinearGradient(0, Y(MD.cy - MD.ry), 0, Y(MD.cy + MD.ry));
        gr.addColorStop(0, '#f4f6f7'); gr.addColorStop(0.32, '#f8f9fa'); gr.addColorStop(0.68, '#eef1f3'); gr.addColorStop(0.9, '#e3e7ea'); gr.addColorStop(1, '#d9dee2');
        g.fillStyle = gr; g.fillRect(0, 0, 120, 140);
        // 两侧与下半朝向镜头的面略暗
        gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, 'rgba(130,140,150,0)'); gr.addColorStop(0.7, 'rgba(130,140,150,0)'); gr.addColorStop(1, 'rgba(130,140,150,0.14)');
        g.save(); g.translate(cx, Y(MD.cy - 0.35)); g.scale(MD.rx * sx * 1.05, MD.ry * sy * 1.05); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
        g.save(); g.globalCompositeOperation = 'destination-in';
        gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        gr.addColorStop(0, '#000'); gr.addColorStop(0.86, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.translate(cx, cy); g.scale(MD.rx * sx, MD.ry * sy); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
      });
    }
    // skirt：周围雪面漫上棋子下沿的程度；bury：整颗化成雪包的程度
    function drawCap(g, geo, k, land, skirt, bury) {
      const { x, cy, rx, ry } = geo;
      if (skirt > 0.01) { // 周围雪面积厚，从下往上漫过棋子近侧的下沿（边界是棋子轮廓上移后的弧，带一像素软边）
        g.save();
        g.beginPath(); g.ellipse(x, cy, rx + 0.7, ry + 0.7, 0, 0, TAU); g.clip();
        g.fillStyle = snowAt(cy + ry);
        [[1.3, 0.45], [0, 1]].forEach(([dy, a]) => {
          g.globalAlpha = a;
          g.beginPath(); g.rect(x - rx - 2, cy - ry - 2, rx * 2 + 4, ry * 2 + 4);
          g.ellipse(x, cy - skirt * 0.72 * ry - dy, rx + 0.7, ry + 0.7, 0, 0, TAU);
          g.fill('evenodd');
        });
        g.restore();
      }
      const m = smooth(k);
      // 圆丘：宽度由起始雪团长到 1.1 倍棋子半宽；中心随厚度上移；起始雪团约在 0.3 进度内并入圆丘（始终只有一团）
      const s0 = land ? land.s * 0.58 : 0; // 雪花贴图里看得见的雪团约占贴图半径的六成
      const g0 = smooth(k / 0.3);
      const sx0 = land ? land.x : x, sy0 = land ? land.y : cy - ry * 0.3, hr0 = land ? lerp(1, 0.68, land.settle) : 0.7;
      // 圆丘贴着棋子远侧（顶面）的上沿长：先铺满顶面变宽，再变厚；不会成为黑圈里的一个白点
      // 周围积雪漫上来时，圆丘也顺着棋子侧面往下铺，两边的雪很快接上（中间只短暂留一线黑）
      const sk = skirt * m, mw = smooth(Math.min(1, k * 1.6));
      const erx = lerp(s0, rx * 1.1, mw);
      const ery = lerp(s0 * hr0, ry * 1.07, m) + sk * 0.18 * ry;
      const ex = lerp(sx0, x, g0), ey = lerp(sy0, cy - ry * (1 + 0.55 * m) + ery, g0);
      if (erx > 0.3 && bury < 0.999) {
        const f = 1.12; // 贴图的软边在单位椭圆外，略放大使实心部分等于圆丘
        g.drawImage(domeSprite(), ex - erx * f, ey - ery * f, erx * 2 * f, ery * 2 * f);
      }
      if (bury > 0.003) {
        g.globalAlpha = bury;
        g.drawImage(moundSprite(), x + MD.x0 * rx, cy + MD.y0 * ry, (MD.x1 - MD.x0) * rx, (MD.y1 - MD.y0) * ry);
        g.globalAlpha = 1;
      }
    }
    // 全部埋好的终态（雪包、脚边淡影、棋子与雪屑），与逐帧画法的终值相同
    function stonesFinalTex() {
      return K.cache('ff4_d2_sfin', W, H, 1, (g) => {
        const geos = [...BLACK, ...WHITE].map(([cc, rr]) => { const [u, v] = PT(cc, rr); return stoneGeo(u, v); });
        geos.forEach((geo) => moundHalo(g, geo, 0.12));
        g.drawImage(stonesTex(false), 0, 0, W, H);
        g.drawImage(stonesTex(false, true), 0, 0, W, H);
        g.globalAlpha = 0.85; g.drawImage(stoneDustTex(), 0, 0, W, H); g.globalAlpha = 1;
        geos.slice().sort((a, b) => a.y - b.y).forEach((geo) => drawCap(g, geo, 1, null, 1, 1));
      });
    }
    // 雪包脚下近侧雪面上的一抹淡影（让雪包像实心的雪，而不是玻璃珠）
    function moundHalo(g, geo, a) {
      const { x, cy, rx, ry } = geo;
      const gg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      gg.addColorStop(0, `rgba(110,120,132,${a})`); gg.addColorStop(0.5, `rgba(110,120,132,${a * 0.6})`); gg.addColorStop(1, 'rgba(110,120,132,0)');
      g.save(); g.translate(x, cy + ry * 0.97); g.scale(rx * 1.1, ry * 0.4);
      g.fillStyle = gg; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
    }

    XYT.registerShot('d2_weiqi', {
      name: '雪落棋局', zone: 'top', night: false, text: '#26292d', shadow: 'rgba(244,246,248,0.92)', accent: '#7a5a34', bloom: 0.16,
      draw(g, c) {
        const t = c.lt;
        const tKey = [charLT(c, 0, 0, FB1[0]), charLT(c, 2, 0, FB1[2]), charLT(c, 4, 0, FB1[4])];
        const tXiang = charLT(c, 0, 1, FB2[0]), tDuo = charLT(c, 3, 1, FB2[3]), tWo = charLT(c, 7, 1, FB2[7]);
        const capT = [charLT(c, 3, 1, FB2[3]), charLT(c, 4, 1, FB2[4]), charLT(c, 5, 1, FB2[5])];
        // 镜头：整镜 1.00→1.03
        const z = 1 + 0.03 * smooth(c.p);
        g.save();
        g.translate(640, 440); g.scale(z, z); g.translate(-640, -440);
        g.drawImage(sceneTex(), 0, 0, W, H);
        // 远景雪（桌后虚处）：只在桌面以外的背景里
        const dot = dotSprite('soft', 0.35);
        const snowW = tinted('d2w', dot, '#ffffff');
        g.save(); g.clip(FAR_CLIP, 'evenodd');
        for (const f of FAR) {
          const m = 30, span = H + 2 * m;
          const yy = f.y0 + f.v * t, k = Math.floor(yy / span);
          if ((k * span - f.y0) / f.v < f.act) continue; // 这一轮在加密之前就已开始：不画（从画外进入）
          const y = yy - k * span - m;
          if (y > 300) continue;
          const x = ((f.x0 + 5 * Math.sin(f.f * TAU * t + f.ph)) % (W + 60)) - 30;
          g.globalAlpha = 0.7; const s = f.rad * 2;
          g.drawImage(snowW, x - s, y - s, s * 2, s * 2);
        }
        g.globalAlpha = 1;
        g.restore();
        // 积雪（桌面、盘面、罐盖同一场雪）：第27句薄屑；第28句第1字起雪屑逐级加密，其下一层细颗粒雪膜渐厚，第8字前整片皆白
        const tBu = charLT(c, 5, 1, FB2[5]);
        const d0 = 0.25 + 0.55 * smooth((t - 0.1) / 2.6);
        const d1 = smooth((t - tXiang) / 1.5);
        // 雪膜厚度：第28句第1字起，第4字约 0.17，第6字约 0.44，第7字约 0.66，第8字前 0.1 秒满
        const tDe = charLT(c, 6, 1, FB2[6]);
        const Aof = (tt) => (tt < tDuo ? 0.17 * Math.pow(clamp((tt - tXiang) / Math.max(0.3, tDuo - tXiang)), 1.5)
          : tt < tBu ? lerp(0.17, 0.44, (tt - tDuo) / Math.max(0.2, tBu - tDuo))
            : tt < tDe ? lerp(0.44, 0.66, (tt - tBu) / Math.max(0.1, tDe - tBu))
              : lerp(0.66, 1, clamp((tt - tDe) / Math.max(0.1, tWo - 0.1 - tDe))));
        const A = Aof(t);
        // 落定的雪片被后来的雪埋住：要等落定后又积了一层、且四周已近全白，才与雪面融为一体
        const buried = (T) => smooth((A - Aof(T)) / 0.3) * smooth((A - 0.55) / 0.45);
        const P = 4 * smooth((t - tXiang - 0.2) / Math.max(0.6, tDe - tXiang - 0.2));
        const fin = smooth((t - tWo + 0.1) / 0.3); // 雪屑淡去，只剩平整的雪面（只换质感，不换形状）
        if (fin >= 1) blitTB(g, surfFinalTex()); else {
          const q = A * NL, s0 = Math.min(NL, Math.floor(q)), fq = q - s0;
          if (s0 < NL && fq > 0.002) {
            // 相邻两级按透明度线性插值（加色合成两张同色的雪面），避免两级叠加时在换级处跳变
            const hi = filmTex(s0 + 1), [sc, sg] = scratch('d2film', hi.width, hi.height);
            if (s0 >= 1 && fq < 0.998) { sg.globalAlpha = 1 - fq; sg.drawImage(filmTex(s0), 0, 0); }
            sg.globalCompositeOperation = 'lighter'; sg.globalAlpha = clamp(fq); sg.drawImage(hi, 0, 0);
            sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
            blitTB(g, sc);
          } else if (s0 >= 1) blitTB(g, filmTex(s0));
          const ka = 1 - fin;
          const pi = Math.min(4, Math.floor(P)), pf = P - pi;
          if (pi === 4 && d1 >= 1 && d0 >= 0.8) { g.globalAlpha = ka; blitTB(g, dustSpkAll()); } else {
            if (d1 >= 1 && d0 >= 0.8) { g.globalAlpha = ka; blitTB(g, dustBoth()); } else {
              g.globalAlpha = clamp(d0 * ka); blitTB(g, dustTex(0));
              if (d1 > 0.003) { g.globalAlpha = clamp(d1 * ka); blitTB(g, dustTex(1)); }
            }
            if (pi >= 1) { g.globalAlpha = ka; blitTB(g, speckCum(pi)); }
            if (pi < 4 && pf > 0.002) { g.globalAlpha = clamp(pf * ka); blitTB(g, speckTex(pi)); }
          }
          // 接触暗影与雪沿各自一层，随雪厚渐显，从不消失
          const cA = smooth((A - 0.2) / 0.5), rA = smooth((A - 0.35) / 0.4);
          if (cA >= 1 && rA >= 1) { g.globalAlpha = 1; blitTB(g, edgesTex()); } else {
            if (cA > 0.003) { g.globalAlpha = cA; blitTB(g, contactTex()); }
            if (rA > 0.003) { g.globalAlpha = rA; blitTB(g, rimTex()); }
          }
          g.globalAlpha = 1;
        }
        // 棋子：接触阴影随雪厚变淡；雪埋到棋子脚下后，雪丘脚边一圈淡影
        const skirt = smooth((A - 0.62) / 0.28), bury = smooth((A - 0.85) / 0.15);
        const shA = (1 - 0.8 * smooth(A / 0.75)) * (1 - fin);
        if (shA > 0.003) { g.globalAlpha = shA; blitBox(g, stonesTex(true)); g.globalAlpha = 1; }
        const done = t > tBu + 0.92 && fin >= 1 && bury >= 1 && skirt >= 1 && t > 3.6; // 全部埋好后不再变化：贴缓存
        if (done) blitBox(g, stonesFinalTex());
        const geos = done ? [] : [...BLACK.map(([cc, rr], j) => ({ bl: 1, j, cc, rr })), ...WHITE.map(([cc, rr], j) => ({ bl: 0, j, cc, rr }))];
        geos.forEach((o) => { const [u, v] = PT(o.cc, o.rr); o.u = u; o.v = v; o.geo = stoneGeo(u, v); });
        if (!done) {
        if (bury > 0.003) geos.forEach((o) => moundHalo(g, o.geo, 0.12 * bury));
        blitBox(g, stonesTex(false));
        if (skirt > 0.003) { g.globalAlpha = skirt; blitBox(g, stonesTex(false, true)); g.globalAlpha = 1; }
        // 黑子顶上的雪屑
        const sd = smooth((t - 0.3) / 3.2) * 0.85;
        if (sd > 0.003) { g.globalAlpha = sd; blitBox(g, stoneDustTex()); g.globalAlpha = 1; }
        // 雪丘：黑子先落上一朵大雪花再长成圆丘，白子第28句第4字起也积成同样的圆丘；先远后近
        const capOf = new Map(CAPS.map((cp, j) => [cp.s[0] * 19 + cp.s[1], j]));
        const airs = [], caps = [];
        geos.forEach((o) => {
          if (o.bl) {
            const j = capOf.get(o.cc * 19 + o.rr);
            const T = j < capT.length ? capT[j] : lerp(tDuo + 0.1, tBu - 0.05, (j - capT.length + 0.5) / (CAPS.length - capT.length));
            const [X, Z] = B2W(o.u, o.v);
            const f = flakeAt({ T, X, Z, rad: 0.03, sw: 0.02, f: 0.6, ph: j }, t, BT + STONE_H);
            if (f.air) { if (f.y > -20) airs.push(f); if (skirt > 0.01) caps.push({ o, k: 0, land: null }); return; }
            const kx = clamp((t - T) / 0.9), k = 1 - (1 - kx) * (1 - kx); // 约 0.9 s 长成圆丘
            caps.push({ o, k, land: { x: f.x, y: f.y, s: f.s * 1.3, settle: smooth(f.age / 0.18) } });
          } else {
            const T0 = lerp(tDuo - 0.1, tBu, h2(o.j, 404));
            const kx = clamp((t - T0) / 0.9), k = 1 - (1 - kx) * (1 - kx);
            if (k > 0 || skirt > 0.01) caps.push({ o, k, land: null });
          }
        });
        caps.sort((a, b) => a.o.geo.y - b.o.geo.y).forEach((cp) => drawCap(g, cp.o.geo, cp.k, cp.land, skirt, bury));
        airs.forEach((f) => airFlake(g, f.x, f.y, f.s * 1.3, 0.95, clamp(f.dt / 0.15)));
        }
        const fs = flakeSprite();
        // 三片大雪落在空点上，像替人落子（停住不动、不弹跳）
        KEY.forEach(([cc, rr], j) => {
          const [u, v] = PT(cc, rr), [X, Z] = B2W(u, v);
          const L = { T: tKey[j], X, Z, rad: 0.045, sw: 0.05, f: 0.45, ph: j * 2.1 };
          const f = flakeAt(L, t, BT);
          if (f.air && f.y < -30) return;
          const s = f.s * (f.air ? 1.25 : 1.15 + 0.1 * smooth(f.age / 0.2));
          const sy = f.air ? s : s * lerp(1, 0.68, smooth(f.age / 0.2));
          if (!f.air) { // 落点下的一圈浅影（被后来的积雪盖住）
            const sa = 0.22 * (1 - A) * smooth(f.age / 0.2);
            if (sa > 0.005) { g.fillStyle = `rgba(80,66,48,${sa})`; g.beginPath(); g.ellipse(f.x, f.y + 1, s * 0.9, s * 0.45, 0, 0, TAU); g.fill(); }
            const ka = 1 - buried(tKey[j]);
            if (ka > 0.003) { g.globalAlpha = ka; g.drawImage(fs, f.x - s, f.y - sy, s * 2, sy * 2); g.globalAlpha = 1; }
          } else airFlake(g, f.x, f.y, s, 1, clamp(f.dt / 0.15));
        });
        // 中层着陆雪片（落定后不动）
        for (const Ls of [LANDERS, LANDERS2]) for (const L of Ls) {
          if (t < L.T - 1.1) continue;
          const f = flakeAt(L, t, L.onBoard ? BT : 0.006);
          if (f.air) {
            if (f.y < -20) continue;
            airFlake(g, f.x, f.y, f.s * 1.2, 0.9, clamp(f.dt / 0.12));
            continue;
          }
          const la = 0.9 * (1 - buried(L.T));
          if (la < 0.003) continue;
          g.globalAlpha = la;
          const s = f.s * 1.2, sq = lerp(1, 0.62, smooth(f.age / 0.15));
          g.drawImage(fs, f.x - s, f.y - s * sq, s * 2, s * 2 * sq);
        }
        g.globalAlpha = 1;
        // 近景虚化大雪片
        const snowS = tinted('d2s', dotSprite('soft2', 0.15), '#ffffff');
        const snowG = tinted('d2g', dotSprite('soft2', 0.15), '#aeb7bf');
        for (const f of NEAR) {
          const m = 80, span = H + 2 * m;
          const yy = f.y0 + f.v * t, k = Math.floor(yy / span);
          if ((k * span - f.y0) / f.v < f.act) continue;
          const y = yy - k * span - m;
          const x = ((f.x0 + 18 * Math.sin(f.f * TAU * t + f.ph)) % (W + 120)) - 60;
          const s = f.rad * 1.6;
          g.globalAlpha = f.a * 0.55; g.drawImage(snowG, x - s * 1.1, y - s * 1.1, s * 2.2, s * 2.2);
          g.globalAlpha = f.a; g.drawImage(snowS, x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
        }
        g.globalAlpha = 1;
        g.restore();
        // 雪密之后空气发白（大雪的纱），第28句第8字时最浓
        const veil = 0.24 * smooth((t - tXiang) / Math.max(0.5, tWo - tXiang));
        if (veil > 0.002) {
          const gr = g.createLinearGradient(0, 0, 0, H);
          gr.addColorStop(0, `rgba(242,244,246,${veil * 0.7})`); gr.addColorStop(0.5, `rgba(242,244,246,${veil})`); gr.addColorStop(1, `rgba(242,244,246,${veil * 0.8})`);
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
        }
      },
    });
    // 积雪各级缓存较重，首次实时播放时现建会卡顿：页面空闲时按需要的先后预先建好（只改建缓存的时机，画面不变）
    const WARM = [sceneTex, () => dustTex(0), () => dustTex(1)];
    for (let s = 1; s <= NL; s++) WARM.push(() => filmTex(s));
    SPK_D.forEach((_, k) => WARM.push(() => speckTex(k)));
    for (let k = 2; k <= SPK_D.length; k++) WARM.push(() => speckCum(k));
    WARM.push(dustBoth, dustSpkAll, contactTex, rimTex, edgesTex, surfFinalTex, () => stonesTex(true), () => stonesTex(false), () => stonesTex(false, true), stoneDustTex, stonesFinalTex);
    if (typeof requestIdleCallback === 'function') {
      let wi = 0, wS = 0;
      const step = (dl) => {
        const S = XYT.sprites && XYT.sprites.S;
        if (!S) { setTimeout(() => requestIdleCallback(step), 1500); return; }
        if (S !== wS) { wS = S; wi = 0; } // 换了分辨率就按新倍率重来（已建的缓存直接命中，不会重画）
        while (wi < WARM.length && (dl.didTimeout || dl.timeRemaining() > 6)) WARM[wi++]();
        if (wi < WARM.length) requestIdleCallback(step);
      };
      setTimeout(() => requestIdleCallback(step), 2000);
    }
  })();
  // ============================================================
  // e2_ropebridge 断桥：风雨峡谷里的吊桥起伏扭转，近侧底绳先断、木板成串滑落，其余绳索崩断，两半甩向崖壁，最后一块木板坠入翻涌的云雾
  // ============================================================
  (function () {
    const FB = [0.337, 0.617, 0.957, 1.597, 1.987, 2.377, 3.117, 3.477, 3.857, 4.297, 4.747];
    const AL = [120, 330], AR = [1160, 330], SPAN = AR[0] - AL[0], SAG = 80;
    const ES = 0.2, EC = Math.sqrt(1 - ES * ES); // 相机略俯视：深度方向在屏幕上的投影
    const WD = 48, HR = 38;           // 桥面宽、扶手绳高
    const GPX = 460;                  // 重力（像素/秒²，约 45 px/m：扶手高约 0.85 m，桥面宽约 1.1 m）
    const NPL = 92;
    const GAPU = 0.18;                // 近侧底绳断后，中段 |u-0.5|<GAPU 的木板滑落
    const WALL = 0.1;                 // 崖壁向峡谷略倾：x = 锚点 ± 0.1·(y-330)
    const JOLT = 12;                  // 近侧底绳断后，其余绳索多承重，整桥下沉量
    const PL = [];
    for (let k = 0; k < NPL; k++) {
      const u = (k + 0.5) / NPL;
      const miss = h2(k, 313) < 0.06 && Math.abs(u - 0.5) > 0.22; // 旧桥本就缺几块
      PL.push({ k, u, miss, mid: Math.abs(u - 0.5) < GAPU, wid: 7.2 });
    }
    // 两块绑在一起的大木板（最后坠落的那块），从一开始就画成双宽
    PL[11].miss = true; PL[10].u = (PL[10].u + PL[11].u) / 2; PL[10].wid = 14; PL[10].big = true;
    const tipMulOf = (P) => 0.86 + 0.28 * h2(P.k, 17); // 各块绑绳松紧不一，翻倾角略有参差
    const parY = (u) => AL[1] + SAG * 4 * u * (1 - u);
    const SU = (u) => Math.sin(Math.PI * u);
    // 断绳后的一震：阻尼回弹到 JOLT
    const joltK = (ts) => (ts > 0 ? 1 - Math.exp(-ts / 0.12) * Math.cos(ts * 9) : 0);
    // 倾翻量沿桥的分布：中间最大，锚点处为 0
    const profU = (u) => (0.2 + 0.8 * Math.pow(SU(u), 1.5)) * smooth(Math.min(u, 1 - u) / 0.035);
    // 倾翻角：断后约 0.25 s 翻到约 60°，略有回摆
    const tipAt = (ts) => {
      if (ts <= 0) return 0;
      const w = TAU / 0.9, z = 0.55, wd = w * Math.sqrt(1 - z * z);
      return 1.05 * (1 - Math.exp(-z * w * ts) * (Math.cos(wd * ts) + z / Math.sqrt(1 - z * z) * Math.sin(wd * ts)));
    };
    // 下沉稳定后的桥形（左半：锚点→中点）的弧长表
    const ARC = (() => {
      const n = 600, s = new Float64Array(n + 1);
      let px = AL[0], py = parY(0);
      for (let i = 1; i <= n; i++) { const u = 0.5 * i / n, x = AL[0] + SPAN * u, y = parY(u) + JOLT * SU(u); s[i] = s[i - 1] + Math.hypot(x - px, y - py); px = x; py = y; }
      return { n, s, L: s[n] };
    })();
    const arcAtU = (u) => { const q = clamp(Math.min(u, 1 - u) / 0.5) * ARC.n, i = Math.min(ARC.n - 1, Math.floor(q)); return lerp(ARC.s[i], ARC.s[i + 1], q - i); };
    const uAtArc = (s) => {
      let lo = 0, hi = ARC.n; const v = clamp(s, 0, ARC.L);
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARC.s[m] < v) lo = m; else hi = m; }
      return 0.5 * (lo + (v - ARC.s[lo]) / Math.max(1e-9, ARC.s[hi] - ARC.s[lo])) / ARC.n;
    };
    const LH = ARC.L; // 半边长度

    // ---------- 全断后的一半：锚点固定的链，按重力下坠、甩向崖壁、贴壁垂挂（加载后首次用到时数值积分成表） ----------
    const NN = 48, SEG = LH / NN, SIM_HZ = 120, SIM_T = 3.8, NF = Math.ceil(SIM_T * SIM_HZ) + 1;
    const NODE_U = Array.from({ length: NN + 1 }, (_, i) => uAtArc(i * SEG));
    let SIMS = null;
    function runChain(drag) {
      const dt = 1 / 480, sub = 480 / SIM_HZ;
      const X = new Float64Array(NN + 1), Y = new Float64Array(NN + 1), OX = new Float64Array(NN + 1), OY = new Float64Array(NN + 1);
      for (let i = 0; i <= NN; i++) { const u = NODE_U[i]; X[i] = OX[i] = AL[0] + SPAN * u; Y[i] = OY[i] = parY(u) + JOLT * SU(u); }
      const out = new Float32Array(NF * (NN + 1) * 2);
      const put = (f) => { for (let i = 0; i <= NN; i++) { out[(f * (NN + 1) + i) * 2] = X[i]; out[(f * (NN + 1) + i) * 2 + 1] = Y[i]; } };
      put(0);
      const wx = (y) => AL[0] + Math.max(0, y - 330) * WALL + 4;
      const nl = Math.hypot(1, WALL), nx = 1 / nl, ny = -WALL / nl;
      for (let step = 1, f = 0; f < NF - 1; step++) {
        for (let i = 1; i <= NN; i++) { // Verlet + 空气阻力
          const vx = (X[i] - OX[i]) * (1 - drag * dt), vy = (Y[i] - OY[i]) * (1 - drag * dt);
          OX[i] = X[i]; OY[i] = Y[i]; X[i] += vx; Y[i] += vy + GPX * dt * dt;
        }
        for (let it = 0; it < 40; it++) {
          for (let i = 0; i < NN; i++) { // 不可伸长
            const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i], d = Math.hypot(dx, dy) || 1e-9, df = (d - SEG) / d;
            if (i === 0) { X[1] -= dx * df; Y[1] -= dy * df; } else { X[i] += dx * df * 0.5; Y[i] += dy * df * 0.5; X[i + 1] -= dx * df * 0.5; Y[i + 1] -= dy * df * 0.5; }
          }
          for (let i = 0; i < NN - 1; i++) { // 不折死角
            const dx = X[i + 2] - X[i], dy = Y[i + 2] - Y[i], d = Math.hypot(dx, dy) || 1e-9, mn = SEG * 1.75;
            if (d < mn) { const k = (d - mn) / d * 0.25; if (i > 0) { X[i] += dx * k; Y[i] += dy * k; } X[i + 2] -= dx * k; Y[i + 2] -= dy * k; }
          }
          for (let i = 1; i <= NN; i++) if (Y[i] > 330 && X[i] < wx(Y[i])) X[i] = wx(Y[i]); // 崖壁
        }
        for (let i = 1; i <= NN; i++) { // 撞壁：法向小回弹，切向摩擦
          if (Y[i] > 330 && X[i] <= wx(Y[i]) + 0.01) {
            let vx = X[i] - OX[i], vy = Y[i] - OY[i];
            const vn = vx * nx + vy * ny; if (vn < 0) { vx -= 1.15 * vn * nx; vy -= 1.15 * vn * ny; }
            const vt = -vx * ny + vy * nx, vn2 = vx * nx + vy * ny;
            vx = vn2 * nx - vt * 0.9 * ny; vy = vn2 * ny + vt * 0.9 * nx;
            OX[i] = X[i] - vx; OY[i] = Y[i] - vy;
          }
        }
        if (step % sub === 0) put(++f);
      }
      return out;
    }
    function sims() {
      if (SIMS) return SIMS;
      SIMS = [runChain(0.25), runChain(0.33)].map((out, k) => { // k=0 左半，k=1 右半（左右镜像，阻尼略不同）
        const th0 = new Float64Array(NN + 1), xs = (i) => (k ? W - out[i * 2] : out[i * 2]);
        for (let i = 0; i <= NN; i++) { const a = Math.max(0, i - 1), b = Math.min(NN, i + 1); th0[i] = Math.atan2(out[b * 2 + 1] - out[a * 2 + 1], xs(b) - xs(a)); }
        return { out, th0, mir: k === 1 };
      });
      return SIMS;
    }
    // 某一半在 τ 时的节点、各节点相对断开瞬间的转角；corr[i]：断开瞬间实际桥形与积分初值在各节点的差（只有几百分之一像素）
    function halfState(side, tau, corr) {
      const S = sims()[side < 0 ? 0 : 1], q = clamp(tau * SIM_HZ, 0, NF - 1.001), f0 = Math.floor(q), fr = q - f0;
      const X = new Float64Array(NN + 1), Y = new Float64Array(NN + 1), A = new Float64Array(NN + 1);
      for (let i = 0; i <= NN; i++) {
        const o0 = (f0 * (NN + 1) + i) * 2, o1 = o0 + (NN + 1) * 2;
        const x = lerp(S.out[o0], S.out[o1], fr), y = lerp(S.out[o0 + 1], S.out[o1 + 1], fr);
        X[i] = S.mir ? W - x : x; Y[i] = y + corr[i];
      }
      for (let i = 0; i <= NN; i++) {
        const a = Math.max(0, i - 1), b = Math.min(NN, i + 1);
        let d = Math.atan2(Y[b] - Y[a], X[b] - X[a]) - S.th0[i];
        while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        A[i] = d;
      }
      const at = (s) => {
        const q2 = clamp(s / SEG, 0, NN - 1e-6), i = Math.floor(q2), f = q2 - i;
        return { x: lerp(X[i], X[i + 1], f), y: lerp(Y[i], Y[i + 1], f), a: lerp(A[i], A[i + 1], f) };
      };
      return { at };
    }
    // 近侧底绳断头：松掉的一段先猛地弹回（0.1 s 约 65 px），再下坠、垂成短摆（相对断口内侧的绑点，左半；右半镜像）
    const LOOSE = Math.hypot(GAPU * SPAN, parY(0.5) - parY(0.5 - GAPU)); // 断开瞬间正好绷直
    const LPATH = (() => {
      const dt = 1 / 480, n = Math.ceil(4.6 / dt), out = new Float32Array((Math.floor(n / 4) + 2) * 2);
      let x = GAPU * SPAN, y = parY(0.5) - parY(0.5 - GAPU), vx = -1100, vy = -40;
      out[0] = x; out[1] = y;
      for (let i = 1, f = 1; i <= n; i++) {
        const ts = i * dt, k = ts < 0.1 ? 12 : 3 - 1.8 * smooth((ts - 0.1) / 0.6);
        vx -= k * vx * dt; vy -= k * vy * dt; vy += GPX * dt;
        x += vx * dt; y += vy * dt;
        const d = Math.hypot(x, y);
        if (d > LOOSE) { x *= LOOSE / d; y *= LOOSE / d; const nx = x / LOOSE, ny = y / LOOSE, vr = vx * nx + vy * ny; if (vr > 0) { vx -= vr * nx; vy -= vr * ny; } }
        if (i % 4 === 0) { out[f * 2] = x; out[f * 2 + 1] = y; f++; }
      }
      return out;
    })();
    const looseAt = (ts) => { const q = clamp(ts * 120, 0, LPATH.length / 2 - 2.001), i = Math.floor(q), f = q - i; return [lerp(LPATH[i * 2], LPATH[i * 2 + 2], f), lerp(LPATH[i * 2 + 1], LPATH[i * 2 + 3], f)]; };
    const wallX = (side, y) => (side < 0 ? AL[0] + Math.max(0, y - 330) * WALL + 4 : AR[0] - Math.max(0, y - 330) * WALL - 4);

    // ---------- 静态层 ----------
    function skyTex() {
      return K.cache('ff4_e2_sky', W, H, 1, (g) => {
        let gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, '#141922'); gr.addColorStop(0.24, '#232c39'); gr.addColorStop(0.4, '#3e4a5a'); gr.addColorStop(0.5, '#6e7b8e'); gr.addColorStop(0.7, MIST); gr.addColorStop(1, MIST);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        // 峡谷深处的天光（全镜唯一亮处）
        gr = g.createRadialGradient(640, 300, 10, 640, 300, 420);
        gr.addColorStop(0, 'rgba(200,210,224,0.75)'); gr.addColorStop(0.35, 'rgba(170,184,202,0.35)'); gr.addColorStop(1, 'rgba(120,136,156,0)');
        g.save(); g.translate(640, 300); g.scale(1, 0.55); g.translate(-640, -300);
        g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
        // 低垂的乌云：厚重、平稳
        blurInto(g, W, H, 10, (tg) => {
          const r = rng(2201);
          for (let k = 0; k < 70; k++) {
            const x = r() * W, y = 20 + r() * 150, rx = 90 + r() * 200, ry = 26 + r() * 40;
            tg.fillStyle = r() < 0.6 ? `rgba(18,22,30,${0.35 + r() * 0.3})` : `rgba(52,62,76,${0.25 + r() * 0.25})`;
            tg.beginPath(); tg.ellipse(x, y, rx, ry, 0, 0, TAU); tg.fill();
          }
          // 云底的破絮，偏亮的边
          for (let k = 0; k < 26; k++) {
            const x = r() * W, y = 175 + r() * 60, rx = 60 + r() * 120, ry = 10 + r() * 16;
            tg.fillStyle = `rgba(70,82,98,${0.25 + r() * 0.25})`;
            tg.beginPath(); tg.ellipse(x, y, rx, ry, 0, 0, TAU); tg.fill();
          }
        });
      });
    }
    // 峡谷两侧层层后退的崖壁（远淡近深、越远越接近雾色）
    // 峡谷两侧层层后退的崖壁（远淡近深、越远越接近雾色）
    const MIST = '#748194';
    function rockWall(tg, side, edge, top, rise, col, seed, detail) {
      // 一块崖体：外高内低，脊线上有起伏的峰头；内侧是带台阶、略有进退的陡壁；顶部墨重，向下渐淡没入雾中
      const outer = side < 0 ? -60 : W + 60, r = rng(seed);
      const peaks = [];
      for (let k = 0; k < 3; k++) peaks.push([0.15 + 0.7 * r(), 20 + 40 * r(), 0.05 + 0.1 * r()]);
      const pts = [[outer, 740], [outer, top - rise]];
      for (let i = 1; i <= 40; i++) {
        const u = i / 40, x = lerp(outer, edge, u);
        const sh = Math.pow(1 - u, 1.6);
        let y = top - rise * sh + rise * 0.1 * fbm(x / 70, seed, 3) * (0.4 + sh) + 4 * fbm(x / 14, seed + 2, 2) * (1 - u * 0.5);
        for (const [uc, amp, w] of peaks) y -= amp * Math.exp(-((u - uc) / w) * ((u - uc) / w)) * (0.5 + 0.5 * (1 - u));
        pts.push([x, y]);
      }
      // 内侧陡壁：台阶状、每级进退不一，下部略向外收
      const lean = 0.03 + 0.08 * r();
      for (let y = top + 6; y <= 740; y += 8) {
        const step = Math.floor((y - top) / 30);
        pts.push([edge - side * (16 * h2(step, seed) + 7 * fbm(y / 22, seed + 7, 2) + (y - top) * lean), y]);
      }
      tg.save();
      tg.beginPath(); pts.forEach(([x, y], i) => (i ? tg.lineTo(x, y) : tg.moveTo(x, y))); tg.closePath();
      tg.fillStyle = col; tg.fill();
      tg.clip();
      // 顶部墨重：沿脊线一道深色干笔
      tg.lineJoin = 'round';
      for (let pass = 0; pass < 3; pass++) {
        tg.strokeStyle = rgba(shade(col, 0.7), 0.35 - pass * 0.08); tg.lineWidth = 10 + pass * 14;
        tg.beginPath(); pts.slice(1, 42).forEach(([x, y], i) => (i ? tg.lineTo(x, y + 4 + pass * 6) : tg.moveTo(x, y + 4))); tg.stroke();
      }
      // 竖向皴：自脊线向下的短笔
      for (let k = 0; k < 24 + detail * 40; k++) {
        const i = 1 + Math.floor(r() * 40), [x, y] = pts[i + 1], len = 14 + r() * (30 + detail * 40);
        tg.strokeStyle = rgba(shade(col, 0.68), 0.2 + r() * 0.25); tg.lineWidth = 0.8 + r() * (0.8 + detail);
        tg.beginPath(); tg.moveTo(x + (r() - 0.5) * 6, y + 2); tg.quadraticCurveTo(x + (r() - 0.5) * 10, y + len * 0.5, x + (r() - 0.5) * 8, y + len); tg.stroke();
      }
      // 内壁的墨色：贴着壁沿一道背光的暗带，壁面上横向的岩层与竖向裂隙
      const face = pts.slice(42);
      tg.strokeStyle = rgba(shade(col, 0.62), 0.32); tg.lineWidth = 9;
      tg.beginPath(); face.forEach(([x, y], i) => (i ? tg.lineTo(x + side * 3, y) : tg.moveTo(x + side * 3, y))); tg.stroke();
      for (let k = 0; k < 10 + detail * 16; k++) {
        const fp = face[Math.floor(r() * Math.min(face.length, 30))], [fx, fy] = fp, len = 10 + r() * 30;
        tg.strokeStyle = rgba(shade(col, 0.66), 0.18 + r() * 0.2); tg.lineWidth = 0.8 + r() * 1.2;
        tg.beginPath(); tg.moveTo(fx + side * 2, fy); tg.lineTo(fx + side * (2 + len), fy + (r() - 0.5) * 4); tg.stroke();
        if (r() < 0.5) { tg.beginPath(); tg.moveTo(fx + side * (4 + r() * 10), fy); tg.lineTo(fx + side * (4 + r() * 12), fy + 14 + r() * 26); tg.stroke(); }
      }
      // 向下没入雾中
      const yTop = top - 10;
      const mg = tg.createLinearGradient(0, yTop, 0, yTop + 200);
      mg.addColorStop(0, rgba(MIST, 0)); mg.addColorStop(0.5, rgba(MIST, 0.55)); mg.addColorStop(1, rgba(MIST, 1));
      tg.fillStyle = mg; tg.fillRect(-80, yTop, W + 160, 760);
      tg.restore();
      // 脊线一丝冷光（天光在峡谷深处）
      tg.strokeStyle = rgba(shade(col, 1.6), 0.18 + detail * 0.12); tg.lineWidth = 1;
      tg.beginPath(); pts.slice(1, 42).forEach(([x, y], i) => (i ? tg.lineTo(x, y) : tg.moveTo(x, y))); tg.stroke();
      // 近层脊上的小松
      if (detail > 0.5) {
        for (let k = 0; k < 6; k++) {
          const i = 4 + Math.floor(r() * 28), [x, y] = pts[i + 1], hgt = 6 + r() * 9 * detail;
          tg.fillStyle = shade(col, 0.6);
          for (let q = 0; q < 3; q++) { const yy = y - hgt * (0.3 + q * 0.3), ww = hgt * (0.45 - q * 0.12); tg.beginPath(); tg.ellipse(x, yy, ww, hgt * 0.14, 0, 0, TAU); tg.fill(); }
          tg.fillRect(x - 0.5, y - hgt, 1, hgt);
        }
      }
    }
    function gorgeTex() {
      return K.cache('ff4_e2_gorge2', W, H, 1, (g) => {
        // 五层：内沿高度各不相同（远处更接近视平线），左右也不对称
        const layers = [
          { e: 592, top: 302, rise: 40, col: '#7e8a9e', blur: 1.6, dr: -8 },
          { e: 548, top: 286, rise: 72, col: '#6c788e', blur: 1.3, dr: 14 },
          { e: 482, top: 300, rise: 104, col: '#5a667c', blur: 1.0, dr: -16 },
          { e: 392, top: 278, rise: 150, col: '#48536a', blur: 0.7, dr: 18 },
          { e: 268, top: 292, rise: 186, col: '#373f52', blur: 0.4, dr: -10 },
        ];
        layers.forEach((L, li) => {
          blurInto(g, W, H, L.blur, (tg) => {
            rockWall(tg, -1, L.e, L.top, L.rise, L.col, 600 + li * 11, li / 4);
            rockWall(tg, 1, W - L.e + (li % 2 ? 6 : -4), L.top + L.dr, L.rise * 1.06, L.col, 640 + li * 13, li / 4);
            // 层间雾带
            const r = rng(700 + li);
            for (let k = 0; k < 10; k++) {
              const x = r() * W, y = 470 + r() * 120 - li * 6, rx = 120 + r() * 200, ry = 18 + r() * 22;
              const gg = tg.createRadialGradient(x, y, 0, x, y, rx);
              gg.addColorStop(0, rgba(MIST, 0.28)); gg.addColorStop(1, rgba(MIST, 0));
              tg.save(); tg.translate(x, y); tg.scale(1, ry / rx); tg.translate(-x, -y);
              tg.fillStyle = gg; tg.fillRect(x - rx, y - rx, rx * 2, rx * 2); tg.restore();
            }
          });
        });
      });
    }
    function cliffTop(side, x) {
      const ax = side < 0 ? AL[0] : AR[0], u = clamp(Math.abs(x - ax) / 160);
      return 328 - 70 * Math.pow(u, 1.8) + 5 * fbm(x / 22, side + 9, 2) - 10 * Math.max(0, fbm(x / 9, side + 3, 2)) * u;
    }
    function backTex() {
      return K.cache('ff4_e2_back', W, H, 1, (g) => { g.drawImage(skyTex(), 0, 0, W, H); g.drawImage(gorgeTex(), 0, 0, W, H); });
    }
    // 吊桥所在的两侧近崖（锚点在崖顶，崖壁向峡谷略倾）
    function cliffTex() {
      return K.cache('ff4_e2_cliff', W, H, 1, (g) => {
        const cliff = (side) => {
          const ax = side < 0 ? AL[0] : AR[0], outer = side < 0 ? -40 : W + 40, r = rng(side < 0 ? 71 : 73);
          const wallX = (y) => ax - side * (y - 330) * WALL + 2.5 * fbm(y / 18, side + 4, 2);
          // 崖体
          const topY = (x) => cliffTop(side, x);
          g.beginPath(); g.moveTo(outer, topY(outer));
          for (let i = 0; i <= 24; i++) { const x = lerp(outer, ax - side * 4, i / 24); g.lineTo(x, topY(x)); }
          g.lineTo(ax + side * 1, 333);
          for (let y = 334; y <= 730; y += 8) g.lineTo(wallX(y), y);
          g.lineTo(outer, 730); g.closePath();
          const gr = g.createLinearGradient(0, 250, 0, 700);
          gr.addColorStop(0, '#262d38'); gr.addColorStop(1, '#1a2029');
          g.fillStyle = gr; g.fill();
          g.save(); g.clip();
          // 迎光崖面
          const lg = g.createLinearGradient(ax, 0, ax - side * 46, 0);
          lg.addColorStop(0, 'rgba(110,124,144,0.42)'); lg.addColorStop(1, 'rgba(110,124,144,0)');
          g.fillStyle = lg; g.fillRect(Math.min(ax, ax - side * 60) - 20, 330, 120, 400);
          // 皴纹
          g.lineCap = 'round';
          for (let k = 0; k < 46; k++) {
            const x = ax - side * Math.pow(r(), 1.5) * 130, y0 = 336 + r() * 330, len = 30 + r() * 90;
            g.strokeStyle = `rgba(8,10,14,${0.3 + r() * 0.35})`; g.lineWidth = 0.8 + r() * 1.8;
            g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (r() - 0.5) * 8, y0 + len / 2, x + (r() - 0.5) * 6, y0 + len); g.stroke();
          }
          for (let k = 0; k < 14; k++) {
            const y = 345 + r() * 300, x = wallX(y) + side * (3 + r() * 10);
            g.strokeStyle = `rgba(130,144,162,${0.15 + r() * 0.2})`; g.lineWidth = 1;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * (6 + r() * 16), y + (r() - 0.5) * 3); g.stroke();
          }
          g.restore();
          // 崖顶与崖边的冷亮线
          g.strokeStyle = 'rgba(150,164,182,0.5)'; g.lineWidth = 1.4;
          g.beginPath(); for (let i = 0; i <= 24; i++) { const x = lerp(outer, ax - side * 4, i / 24); i ? g.lineTo(x, topY(x)) : g.moveTo(x, topY(x)); } g.stroke();
          g.strokeStyle = 'rgba(140,154,172,0.4)'; g.lineWidth = 1.2;
          g.beginPath(); for (let y = 334; y <= 640; y += 8) (y === 334 ? g.moveTo(wallX(y), y) : g.lineTo(wallX(y), y)); g.stroke();
          // 崖脚没入谷底雾气
          g.save(); g.globalCompositeOperation = 'source-atop';
          const mg = g.createLinearGradient(0, 470, 0, 690);
          mg.addColorStop(0, rgba(MIST, 0)); mg.addColorStop(0.6, rgba(MIST, 0.7)); mg.addColorStop(1, rgba(MIST, 1));
          g.fillStyle = mg; g.fillRect(side < 0 ? -40 : ax - 120, 470, 180 + (side < 0 ? ax : W - ax), 260);
          g.restore();
        };
        cliff(-1); cliff(1);
      });
    }
    // 雾：带状（上下都软）与谷底云海（团雾顶面受天光、底部暗，下方实）
    // 雾：带状（上下都软）与谷底云海（团雾顶面受天光、底部暗，下方实）。
    // 先在三倍宽的画布上画（每团雾左右各复制一份），模糊后取中间一段，左右边缘就能无缝平铺
    function fogTex(k) {
      return K.cache('ff4_e2_fog2_' + k, W, 300, 0.5, (g) => {
        const r = rng(9300 + k);
        const floor = k === 0;
        const sc = g.getTransform().a;
        const big = document.createElement('canvas'); big.width = Math.round(3 * W * sc); big.height = Math.round(300 * sc);
        const bg = big.getContext('2d'); bg.scale(sc, sc);
        blurInto(bg, 3 * W, 300, floor ? 11 : 14, (tg) => {
          if (floor) {
            const gr = tg.createLinearGradient(0, 120, 0, 300);
            gr.addColorStop(0, 'rgba(92,104,120,0)'); gr.addColorStop(0.3, 'rgba(92,104,120,0.9)'); gr.addColorStop(1, 'rgba(84,96,112,1)');
            tg.fillStyle = gr; tg.fillRect(0, 120, 3 * W, 180);
          }
          const n = floor ? 60 : 40;
          for (let i = 0; i < n; i++) {
            const x = r() * W, y = (floor ? 80 : 90) + r() * 120, rx = 70 + r() * (floor ? 130 : 170), ry = rx * (0.24 + r() * 0.1);
            const L = r(), a1 = 0.5 + r() * 0.3, a2 = 0.3 + r() * 0.3, a3 = 0.16 + r() * 0.22;
            for (const dx of [0, W, 2 * W]) {
              if (floor) {
                tg.fillStyle = `rgba(80,92,108,${a1})`;
                tg.beginPath(); tg.ellipse(x + dx, y + ry * 0.3, rx, ry, 0, 0, TAU); tg.fill();
                const c0 = Math.round(132 + L * 26);
                tg.fillStyle = `rgba(${c0},${c0 + 10},${c0 + 24},${a2})`;
                tg.beginPath(); tg.ellipse(x + dx - rx * 0.06, y - ry * 0.12, rx * 0.78, ry * 0.6, 0, 0, TAU); tg.fill();
              } else {
                const c0 = Math.round(128 + L * 28);
                tg.fillStyle = `rgba(${c0},${c0 + 10},${c0 + 24},${a3})`;
                tg.beginPath(); tg.ellipse(x + dx, y, rx, ry, 0, 0, TAU); tg.fill();
              }
            }
          }
        });
        g.drawImage(big, W * sc, 0, W * sc, 300 * sc, 0, 0, W, 300);
        if (floor) {
          const gr = g.createLinearGradient(0, 220, 0, 300);
          gr.addColorStop(0, 'rgba(84,96,112,0)'); gr.addColorStop(0.6, 'rgba(84,96,112,1)'); gr.addColorStop(1, 'rgba(84,96,112,1)');
          g.fillStyle = gr; g.fillRect(0, 220, W, 80);
        }
      });
    }
    const RAIN = (() => {
      const r = rng(4777), o = [];
      for (let i = 0; i < 260; i++) {
        const layer = i < 110 ? 0 : i < 210 ? 1 : 2;
        o.push({ layer, x0: r() * (W + 400), y0: r() * (H + 200), v: [700, 1000, 1400][layer] * (0.85 + r() * 0.3), len: [14, 22, 36][layer] * (0.8 + r() * 0.4), a: [0.13, 0.2, 0.26][layer] * (0.7 + r() * 0.6), w: [0.8, 1.1, 1.6][layer] });
      }
      return o;
    })();
    const RA = 0.28, RS = Math.sin(RA), RC = Math.cos(RA);
    // 雨幕：成片的斜向浅色带，随风雨扫过峡谷（可平铺：先在大画布上画好再取中间一块，边缘不被模糊淡掉）
    function sheetTex() {
      return K.cache('ff4_e2_sheet', 640, 640, 0.5, (g) => {
        const r = rng(1212);
        const big = document.createElement('canvas'), sc = g.getTransform().a;
        big.width = Math.round(1280 * sc); big.height = Math.round(1280 * sc);
        const bg = big.getContext('2d'); bg.scale(sc, sc);
        blurInto(bg, 1280, 1280, 18, (tg) => {
          tg.translate(320, 320);
          // 斜带沿雨的方向；水平方向按 640 周期重复，竖直方向沿带不变，所以整块可平铺
          for (let k = 0; k < 9; k++) {
            const x = r() * 640, w = 30 + r() * 70, a = 0.25 + r() * 0.35;
            tg.fillStyle = `rgba(200,210,224,${a})`;
            for (let rep = -2; rep <= 2; rep++) {
              const x0 = x + rep * 640;
              tg.beginPath();
              tg.moveTo(x0 - w / 2 - 400 * RS / RC, -400); tg.lineTo(x0 + w / 2 - 400 * RS / RC, -400);
              tg.lineTo(x0 + w / 2 + 1040 * RS / RC, 1040); tg.lineTo(x0 - w / 2 + 1040 * RS / RC, 1040); tg.closePath(); tg.fill();
            }
          }
        });
        g.drawImage(big, 320 * sc, 320 * sc, 640 * sc, 640 * sc, 0, 0, 640, 640);
      });
    }
    function sheetTopTex() {
      return K.cache('ff4_e2_sheetTop', 640, 640, 0.5, (g) => {
        g.drawImage(sheetTex(), 0, 0, 640, 640);
        g.globalCompositeOperation = 'destination-in';
        const m = g.createLinearGradient(0, 0, 0, 120);
        m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
        g.fillStyle = m; g.fillRect(0, 0, 640, 640);
      });
    }
    function drawSheets(g, t, boost) {
      // 雨幕沿雨的方向平移；斜带沿自身方向不变，所以只需横移一行贴图（从云底 y=180 起，顶部已渐隐）
      const tex = sheetTopTex(), sp = 260;
      const ox = ((t * sp * RS / RC) % 640 + 640) % 640;
      g.save();
      g.globalCompositeOperation = 'screen';
      g.globalAlpha = clamp(0.12 * (1 + boost));
      for (let x = ox - 640; x < W; x += 640) g.drawImage(tex, x, 180, 640, 640);
      g.restore();
    }
    function drawRain(g, t, layer, boost) {
      g.lineCap = 'round';
      const NB = 5, paths = [];
      for (let i = 0; i < NB; i++) paths.push(new Path2D());
      let w = 1, amax = 0;
      for (const d of RAIN) {
        if (d.layer !== layer) continue;
        w = d.w;
        const span = H + 200, dist = d.y0 + d.v * t;
        const yy = (dist % span + span) % span - 100;
        const xx = ((d.x0 + RS / RC * (dist)) % (W + 400) + (W + 400)) % (W + 400) - 200;
        const fade = clamp((yy - 110) / 110); // 雨从云底下面才看得清
        const a = d.a * fade;
        if (a < 0.01) continue;
        const bkt = Math.min(NB - 1, Math.floor(a / 0.34 * NB));
        paths[bkt].moveTo(xx, yy); paths[bkt].lineTo(xx - RS * d.len, yy - RC * d.len);
      }
      g.lineWidth = w;
      for (let i = 0; i < NB; i++) {
        g.strokeStyle = `rgba(200,210,224,${clamp((i + 0.5) / NB * 0.34 * (1 + boost))})`;
        g.stroke(paths[i]);
      }
    }
    // 崖顶被风吹向右的灌草
    function drawShrubs(g, t) {
      const list = [[44, -1, 26], [78, -1, 20], [100, -1, 14], [1182, 1, 15], [1210, 1, 22], [1246, 1, 26]];
      list.forEach(([x, side, hgt], i) => {
        const y = cliffTop(side, x) + 2;
        const sway = 0.38 + 0.12 * Math.sin(t * 2.3 + i * 1.7) + 0.06 * Math.sin(t * 5.1 + i);
        g.strokeStyle = '#11151b'; g.lineCap = 'round';
        for (let k = -3; k <= 3; k++) {
          const a = k * 0.18 + sway, len = hgt * (1 - Math.abs(k) * 0.12);
          g.lineWidth = 2.2 - Math.abs(k) * 0.2;
          g.beginPath(); g.moveTo(x + k * 2, y); g.quadraticCurveTo(x + k * 2 + Math.sin(a) * len * 0.4, y - len * 0.6, x + k * 2 + Math.sin(a) * len, y - Math.cos(a) * len * 0.9); g.stroke();
        }
      });
    }

    // ---------- 桥的几何 ----------
    // 断前（或近侧底绳断后、全断前）某处横截面的四个绳点；st = { tDuan, tipA, tipF }
    function cross(u, t, st, tipMul) {
      const x = AL[0] + SPAN * u, su = SU(u);
      const env = 0.55 + 0.45 * smooth(t / 0.34);
      const calm = 1 - smooth((t - st.tDuan) / 0.4);
      const heave = (8 * Math.sin(TAU * t / 2.6 + 0.4) + Math.sin(TAU * t / 1.3 + 1.1)) * su * env * calm;
      const yc = parY(u) + heave + JOLT * su * joltK(t - st.tDuan);
      const tw = 0.085 * su * Math.sin(TAU * t / 2.6 + 1.3) * env * calm;
      const pr = profU(u);
      const tip = -st.tipA * pr * (tipMul || 1); // 倾翻角（绕远侧底绳）
      const proj = (up, dep) => yc - up * EC - dep * ES;
      const rot = (up, dep, a) => [up * Math.cos(a) - dep * Math.sin(a), up * Math.sin(a) + dep * Math.cos(a)];
      const [fu, fd] = rot(0, WD / 2, tw);
      const [nu0, nd0] = rot(0, -WD / 2, tw);
      const [ru, rd] = rot(nu0 - fu, nd0 - fd, tip); // 近侧底边绕远侧底绳转
      const nu = fu + ru, nd = fd + rd;
      const droop = 12 * st.tipF * pr;
      const [hnu, hnd] = rot(HR - droop, -WD / 2, tw), [hfu, hfd] = rot(HR, WD / 2, tw);
      return { x, yc, a: 0, bf: [x, proj(fu, fd)], bn: [x, proj(nu, nd)], hn: [x, proj(hnu, hnd)], hf: [x, proj(hfu, hfd)], tip };
    }
    // 全断后某一半上弧长 s 处的横截面：与断开瞬间的横截面完全一致，之后整体随链转动；翻倾在 0.7 s 内收平，扶手绳失去张力后垂向桥面
    function halfCross(Hs, side, s, tau, tipMul, K0) {
      const c = Hs.at(s), u0 = uAtArc(s), u = side < 0 ? u0 : 1 - u0, pr = profU(u);
      const tip = -K0.tipA * pr * (tipMul || 1) * (1 - smooth(tau / 0.7));
      const droop = 12 * K0.tipF * pr, hk = smooth(tau / 0.9), bl = smooth(s / 70);
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      const off = (up, dep) => [c.x + up * EC * sa, c.y - up * EC * ca - dep * ES];
      const offH = (h0, dep) => { // 扶手绳：近锚点处仍系在桩顶，往外渐变为沿桥面法线的偏移
        const r = off(lerp(h0, 9, hk), dep), v = [c.x, c.y - h0 * EC - dep * ES];
        return [lerp(v[0], r[0], bl), lerp(v[1], r[1], bl)];
      };
      const nu = WD * Math.sin(tip), nd = WD / 2 - WD * Math.cos(tip);
      return { x: c.x, y: c.y, a: c.a, tip, bf: off(0, WD / 2), bn: off(nu, nd), hf: offH(HR, WD / 2), hn: offH(HR - droop, -WD / 2) };
    }
    // 某处木板（四角）：沿 (tx,ty) 方向宽 w
    function plankQuad(n, f, tx, ty, w) {
      const hx = tx * w / 2, hy = ty * w / 2;
      return [[n[0] - hx, n[1] - hy], [n[0] + hx, n[1] + hy], [f[0] + hx, f[1] + hy], [f[0] - hx, f[1] - hy]];
    }
    function fillQuad(g, q, col) { g.fillStyle = col; g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); g.fill(); }
    const plankCol = (lit) => mix('#2e261f', '#6e5842', clamp(lit));
    // 桥面上的木板颜色：断前断后同一公式（翻得越陡越暗）
    const deckCol = (P, tip) => plankCol((0.62 + 0.25 * h2(P.k, 9)) - 0.65 * clamp(-tip));
    function deckPlank(g, p, P) {
      const ca = Math.cos(p.a), sa = Math.sin(p.a), th = P.big ? 3.4 : 2.2;
      const q = plankQuad(p.bn, p.bf, ca, sa, P.wid);
      fillQuad(g, q.map(([x, y]) => [x - th * sa, y + th * ca]), '#211a14'); // 厚度：朝下一侧
      fillQuad(g, q, deckCol(P, p.tip));
    }
    // 坠落的木板：三维小长方体，翻滚、受重力，侧视尺寸不变；blend：离开桥面后 0.15 s 内由桥面颜色过渡到自身明暗
    function drawPlank3D(g, x, y, a1, a2, len, wid, thk, lit, blend) {
      const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
      // 局部轴：长(深度)、宽(x)、厚(上)；先绕桥轴 x 转 a1，再在画面内转 a2
      const P = [];
      for (const sl of [-1, 1]) for (const sw of [-1, 1]) for (const st of [-1, 1]) {
        const X = sw * wid / 2, U = st * thk / 2, D = sl * len / 2;
        const U1 = U * c1 - D * s1, D1 = U * s1 + D * c1;
        const X2 = X * c2 - U1 * s2, U2 = X * s2 + U1 * c2;
        P.push([x + X2, y - U2 * EC - D1 * ES]);
      }
      const hull = []; let start = 0; // 凸包（礼品包装）
      for (let i = 1; i < 8; i++) if (P[i][0] < P[start][0]) start = i;
      let p = start;
      do {
        hull.push(P[p]); let q = (p + 1) % 8;
        for (let r = 0; r < 8; r++) { const cr = (P[q][0] - P[p][0]) * (P[r][1] - P[p][1]) - (P[q][1] - P[p][1]) * (P[r][0] - P[p][0]); if (cr < 0) q = r; }
        p = q;
      } while (p !== start && hull.length < 9);
      g.fillStyle = '#211a14';
      g.beginPath(); hull.forEach(([hx, hy], i) => (i ? g.lineTo(hx, hy) : g.moveTo(hx, hy))); g.closePath(); g.fill();
      // 朝相机的大面（木色，朝上越多越亮）
      const nU = c1 * c2, nD = s1;
      const facing = nU * ES - nD * EC;
      const sgn = facing >= 0 ? 1 : -1;
      const face = P.filter((_, i) => ((i & 1) ? 1 : -1) === sgn);
      const br = 0.5 + 0.5 * clamp(Math.abs(nU));
      let col = mix('#2e261f', lit || '#6e5842', br * (facing >= 0 ? 1 : 0.7));
      if (blend && blend.k < 1) col = mix(blend.col, col, blend.k);
      g.fillStyle = col;
      g.beginPath(); g.moveTo(face[0][0], face[0][1]); g.lineTo(face[1][0], face[1][1]); g.lineTo(face[3][0], face[3][1]); g.lineTo(face[2][0], face[2][1]); g.closePath(); g.fill();
    }
    // 断开瞬间的实际桥形与积分初值在各节点的差（左右对称，按节点存一张表）
    const corrAt = (tYi, K0) => NODE_U.map((u) => cross(u, tYi, K0).yc - (parY(u) + JOLT * SU(u)));
    // 中段木板依次脱落的时刻：从断口向两侧剥落（左侧稍快），块与块略有参差
    const relT = (P, tDuan) => tDuan + 0.045 + 0.28 * Math.pow(Math.abs(P.u - 0.5) / GAPU, 0.85) * (P.u < 0.5 ? 1 : 1.12) + 0.03 * (h2(P.k, 41) - 0.5);

    XYT.registerShot('e2_ropebridge', {
      name: '断桥', zone: 'top', night: false, text: '#e8edf4', shadow: 'rgba(10,14,20,0.85)', accent: '#c8d2e0', bloom: 0.22,
      draw(g, c) {
        const t = Math.max(0, c.lt);
        const ct = (k) => charLT(c, k, 0, FB[k]);
        const tDuan = ct(5), tYi = ct(6), tPo = ct(10);
        sims(); // 首帧建表
        const stAt = (tt) => { const a = tipAt(tt - tDuan); return { tDuan, tipA: a, tipF: a / 1.05 }; };
        const st = stAt(t), ts = t - tDuan;
        const be = c.be ? c.be(0.3) : 0;
        g.drawImage(backTex(), 0, 0, W, H);
        // 远雾缓移
        const fx = (t * 9) % W;
        g.globalAlpha = 0.45; g.drawImage(fogTex(1), fx - W, 300, W, 300); g.drawImage(fogTex(1), fx, 300, W, 300); g.globalAlpha = 1;
        drawRain(g, t, 0, 0.2 * be);
        drawSheets(g, t, 0.3 * be);
        { const ctx = cliffTex(), S = ctx.width / ctx.lw; g.drawImage(ctx, 0, 0, 300 * S, H * S, 0, 0, 300, H); g.drawImage(ctx, 980 * S, 0, 300 * S, H * S, 980, 0, 300, H); }
        drawShrubs(g, t);
        // ---- 桥 ----
        const ROPE = '#2a251f', ROPE_F = '#3a3630';
        const strokePts = (pts, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
        const fibers = (x, y, dirx, diry, seed, k) => { // 断口纤维散开
          for (let i = 0; i < 6; i++) {
            const a = Math.atan2(diry, dirx) + (h2(seed, i) - 0.5) * 1.3 + 0.15 * Math.sin(t * 7 + i + seed);
            const len = (5 + h2(seed, i + 9) * 9) * k;
            g.strokeStyle = 'rgba(70,60,46,0.9)'; g.lineWidth = 0.8;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * len * 0.6, y + Math.sin(a) * len * 0.6 + 2, x + Math.cos(a) * len, y + Math.sin(a) * len + 3); g.stroke();
          }
        };
        // 近侧底绳松掉的一段：绑点 pa 到断头；没绷直时，先是弹回的 S 形波，随后在重力下成为下垂的弧
        const looseRope = (pa, side) => {
          const rel = looseAt(ts), E = [pa[0] + (side < 0 ? rel[0] : -rel[0]), pa[1] + rel[1]];
          const dx = E[0] - pa[0], dy = E[1] - pa[1], ch = Math.hypot(dx, dy) || 1, sl = Math.max(0, LOOSE - ch);
          let px = -dy / ch, py = dx / ch; if (py < 0) { px = -px; py = -py; }
          // 余出来的绳长：先变成向下的弧（下垂不快于自由落体），剩下的在断头一侧皱成小波
          const aS = Math.min(Math.sqrt(0.375 * ch * sl), 0.5 * GPX * ts * ts);
          const sl2 = Math.max(0, sl - 8 / 3 * aS * aS / ch), aW = Math.min(6, Math.sqrt(ch * sl2) / Math.PI * 0.8);
          const pts = [];
          for (let k = 0; k <= 16; k++) {
            const s = k / 16, d = aW * Math.sin(Math.PI * 2.5 * s) * s + 4 * aS * s * (1 - s);
            let x = pa[0] + dx * s + px * d, y = pa[1] + dy * s + py * d;
            if (side < 0) x = Math.max(x, wallX(-1, y)); else x = Math.min(x, wallX(1, y)); // 贴壁时不穿进岩石
            pts.push([x, y]);
          }
          strokePts(pts, ROPE, 2.1);
          const e = pts[16], e2 = pts[14];
          fibers(e[0], e[1], e[0] - e2[0], e[1] - e2[1], side < 0 ? 11 : 12, 1);
        };
        // 锚桩（每侧近、远两根）
        const posts = () => {
          [AL[0], AR[0]].forEach((x) => {
            g.fillStyle = '#1e1b17'; g.fillRect(x - 3, AL[1] - 9.6 - HR - 6, 6, HR + 14);
            g.fillStyle = '#2a251f'; g.fillRect(x - 3.5, AL[1] - HR - 6, 7, HR + 10);
            g.fillStyle = 'rgba(150,160,176,0.35)'; g.fillRect(x - 3.5, AL[1] - HR - 6, 1.5, HR + 10);
          });
        };
        const N = 64;
        if (t < tYi) {
          const C = [];
          for (let i = 0; i <= N; i++) C.push(cross(i / N, t, st));
          strokePts(C.map((p) => p.hf), ROPE_F, 1.5); // 远侧扶手绳
          strokePts(C.map((p) => p.bf), ROPE_F, 1.8); // 远侧底绳
          g.strokeStyle = 'rgba(42,37,31,0.7)'; g.lineWidth = 0.9; // 远侧吊索
          for (let i = 1; i < N; i += 2) { const p = C[i]; g.beginPath(); g.moveTo(p.hf[0], p.hf[1]); g.lineTo(p.bf[0], p.bf[1]); g.stroke(); }
          for (const P of PL) { // 木板
            if (P.miss) continue;
            if (P.mid && ts > 0 && t >= relT(P, tDuan)) continue; // 已滑落（另画）
            deckPlank(g, cross(P.u, t, st, tipMulOf(P)), P);
          }
          // 近侧底绳：未断时整根；断后两段，内侧松头弹回、垂下
          if (ts <= 0) strokePts(C.map((p) => p.bn), ROPE, 2.2);
          else {
            for (const side of [-1, 1]) {
              const ua = 0.5 + side * GAPU, pts = [];
              for (let i = 0; i <= N; i++) { const u = i / N; if ((side < 0 && u <= ua) || (side > 0 && u >= ua)) pts.push(C[i].bn); }
              const pa = cross(ua, t, st).bn;
              if (side < 0) pts.push(pa); else pts.unshift(pa);
              strokePts(pts, ROPE, 2.2);
              looseRope(pa, side);
            }
          }
          strokePts(C.map((p) => p.hn), ROPE, 1.9); // 近侧扶手绳与吊索
          g.strokeStyle = 'rgba(30,26,22,0.85)'; g.lineWidth = 1;
          for (let i = 1; i < N; i += 2) {
            const p = C[i], u = i / N;
            g.beginPath(); g.moveTo(p.hn[0], p.hn[1]);
            if (ts > 0 && Math.abs(u - 0.5) < GAPU) g.lineTo(p.hn[0] + 1.5, p.hn[1] + 18); // 下面空了，只剩吊索垂着
            else g.lineTo(p.bn[0], p.bn[1]);
            g.stroke();
          }
        } else {
          // ---- 全断：两半先自由下坠，再甩向各自的崖壁，贴壁垂挂 ----
          const tau = t - tYi, K0 = stAt(tYi), corr = corrAt(tYi, K0);
          for (const side of [-1, 1]) {
            const Hs = halfState(side, tau, corr), C = [];
            for (let j = 0; j <= N / 2; j++) C.push(halfCross(Hs, side, arcAtU(j / N), tau, 1, K0));
            strokePts(C.map((p) => p.hf), ROPE_F, 1.5);
            strokePts(C.map((p) => p.bf), ROPE_F, 1.8);
            g.strokeStyle = 'rgba(42,37,31,0.7)'; g.lineWidth = 0.9;
            for (let j = 1; j < N / 2; j += 2) { const p = C[j]; g.beginPath(); g.moveTo(p.hf[0], p.hf[1]); g.lineTo(p.bf[0], p.bf[1]); g.stroke(); }
            for (const P of PL) { // 半边上剩下的木板
              if (P.miss || P.mid || (side < 0) !== (P.u < 0.5)) continue;
              const fl = FLUNG.find((f) => f.k === P.k);
              if (fl && t >= fl.t0(c)) continue;
              deckPlank(g, halfCross(Hs, side, arcAtU(P.u), tau, tipMulOf(P), K0), P);
            }
            // 近侧底绳：只剩锚点到断口内侧绑点这一段，松头仍系在绑点上
            const ja = Math.floor(N * (0.5 - GAPU)), pts = C.slice(0, ja + 1).map((p) => p.bn);
            const pa = halfCross(Hs, side, arcAtU(0.5 - GAPU), tau, 1, K0).bn;
            pts.push(pa);
            strokePts(pts, ROPE, 2.2);
            looseRope(pa, side);
            strokePts(C.map((p) => p.hn), ROPE, 1.9);
            g.strokeStyle = 'rgba(30,26,22,0.85)'; g.lineWidth = 1;
            for (let j = 1; j < N / 2; j += 2) {
              const p = C[j], u = j / N;
              g.beginPath(); g.moveTo(p.hn[0], p.hn[1]);
              if (Math.abs(u - 0.5) < GAPU) g.lineTo(p.hn[0] + 1.5, p.hn[1] + 18);
              else g.lineTo(p.bn[0], p.bn[1]);
              g.stroke();
            }
            // 断头纤维
            const e = C[N / 2], e2 = C[N / 2 - 1];
            fibers(e.bf[0], e.bf[1], e.bf[0] - e2.bf[0], e.bf[1] - e2.bf[1], side < 0 ? 31 : 37, 1.2);
            fibers(e.hf[0], e.hf[1], e.hf[0] - e2.hf[0], e.hf[1] - e2.hf[1], side < 0 ? 41 : 47, 1);
            fibers(e.hn[0], e.hn[1], e.hn[0] - e2.hn[0], e.hn[1] - e2.hn[1], side < 0 ? 51 : 57, 1);
          }
        }
        posts();
        // ---- 坠落的木板 ----
        if (ts > 0) {
          for (const P of PL) { // 中段：从倾斜的桥面上顺坡滑下，接着自由下落（起点、角度、颜色都接上桥面上那一块）
            if (P.miss || !P.mid) continue;
            const tr = relT(P, tDuan), tf = t - tr;
            if (tf < 0) continue;
            const tm = tipMulOf(P), dtq = 1 / 240;
            const p0 = cross(P.u, tr, stAt(tr), tm), pA = cross(P.u, tr - dtq, stAt(tr - dtq), tm), pB = cross(P.u, tr + dtq, stAt(tr + dtq), tm);
            const mid = (p) => [(p.bn[0] + p.bf[0]) / 2, (p.bn[1] + p.bf[1]) / 2];
            const [x0, y0] = mid(p0), [xa, ya] = mid(pA), [xb, yb] = mid(pB);
            const sx = p0.bn[0] - p0.bf[0], sy = p0.bn[1] - p0.bf[1], sd = Math.hypot(sx, sy) || 1;
            const vx = (xb - xa) / (2 * dtq) + sx / sd * 80 + (h2(P.k, 73) - 0.5) * 40, vy = (yb - ya) / (2 * dtq) + sy / sd * 80;
            const w1 = 0.5 * (pB.tip - pA.tip) / (2 * dtq) + (h2(P.k, 71) - 0.5) * 2.4, w2 = (h2(P.k, 72) - 0.5) * 3.2;
            const x = x0 + vx * tf + 15 * tf * tf, y = y0 + vy * tf + 0.5 * GPX * tf * tf;
            if (y > 780) continue;
            drawPlank3D(g, x, y, p0.tip + w1 * tf, w2 * tf, WD, P.wid, 2.25, null, { col: deckCol(P, p0.tip), k: smooth(tf / 0.15) });
          }
        }
        if (t >= tYi) {
          const K0 = stAt(tYi), corr = corrAt(tYi, K0);
          for (const fl of FLUNG) { // 甩动中脱落的几块与最后一块大木板
            const t0 = fl.t0(c);
            if (t < t0) continue;
            const side = fl.side, P = PL[fl.k], s = arcAtU(P.u), tau0 = t0 - tYi, dtq = 1 / 240, tm = tipMulOf(P);
            const at = (tt) => halfCross(halfState(side, Math.max(0, tt), corr), side, s, Math.max(0, tt), tm, K0);
            const p0 = at(tau0), pA = at(tau0 - dtq), pB = at(tau0 + dtq);
            const mid = (p) => [(p.bn[0] + p.bf[0]) / 2, (p.bn[1] + p.bf[1]) / 2];
            const [mx, my] = mid(p0), [ax, ay] = mid(pA), [bx, by] = mid(pB);
            // 逐步积分：重力、风，碰到崖壁就弹开（恢复系数 0.3）并加一点转动
            let x = mx, y = my, ux = (bx - ax) / (2 * dtq), uy = (by - ay) / (2 * dtq), kick = 0, tb = -1;
            const tf = t - t0, dt = 1 / 240;
            for (let q = 0; q * dt < tf && y < 780; q++) {
              const h = Math.min(dt, tf - q * dt);
              ux += 30 * h; uy += GPX * h; x += ux * h; y += uy * h;
              const xw = side < 0 ? AL[0] + (y - 330) * WALL + 8 : AR[0] - (y - 330) * WALL - 8;
              if ((side < 0 && x < xw) || (side > 0 && x > xw)) {
                x = xw;
                if (ux * side > 0) { ux = -ux * 0.3 - side * 20; uy *= 0.85; if (tb < 0) { tb = q * dt; kick = -side * 4; } }
              }
            }
            if (y < 780) drawPlank3D(g, x, y, p0.tip + fl.w1 * tf + (tb >= 0 ? kick * (tf - tb) : 0), -p0.a + fl.w2 * tf, WD, P.wid, P.big ? 3.6 : 2.25, P.big ? '#86684a' : null, { col: deckCol(P, p0.tip), k: smooth(tf / 0.15) });
          }
        }
        // ---- 谷底云雾，第34句第11字时翻涌上来 ----
        const up = t > tPo ? 100 * easeOut((t - tPo) / 1.1) - 25 * smooth((t - tPo - 1.1) / 1.6) : 0;
        const fy = 612 - up;
        const fo2 = (t * 22 + 400) % W;
        g.globalAlpha = 0.4; g.drawImage(fogTex(1), fo2 - W, fy - 170 + up * 0.3, W, 300); g.drawImage(fogTex(1), fo2, fy - 170 + up * 0.3, W, 300);
        const fo = (t * 14) % W;
        g.globalAlpha = 1; g.drawImage(fogTex(0), fo - W, fy - 110, W, 300); g.drawImage(fogTex(0), fo, fy - 110, W, 300);
        if (fy + 189 < H) { g.fillStyle = 'rgb(84,96,112)'; g.fillRect(0, fy + 189, W, H); }
        // 翻涌的团雾：从下方涌起，淡入
        if (t > tPo - 0.1) {
          const puff = tinted('e2fog', dotSprite('soft3', 0.25), '#8c99aa');
          for (let i = 0; i < 12; i++) {
            const t0 = tPo + h2(i, 501) * 0.35, tf = t - t0;
            if (tf <= 0) continue;
            const x = 140 + i * 90 + (h2(i, 502) - 0.5) * 60 + tf * 18;
            const y = 690 - (150 + h2(i, 503) * 90) * easeOut(tf / 1.3);
            const rr = 70 + h2(i, 504) * 60 + tf * 20;
            g.globalAlpha = 0.55 * clamp(tf / 0.35) * (1 - 0.35 * smooth((tf - 1.4) / 1.5));
            g.drawImage(puff, x - rr, y - rr * 0.7, rr * 2, rr * 1.4);
          }
          g.globalAlpha = 1;
        }
        // ---- 近处的雨 ----
        drawRain(g, t, 1, 0.25 * be);
        drawRain(g, t, 2, 0.3 * be);
      },
    });
    // 甩动中脱落的几块木板（都在第34句第9字之前）；最后一块大木板在第9字脱落
    const FLUNG = [
      { k: 22, side: -1, w1: 5.5, w2: 1.2, t0: (c) => charLT(c, 6, 0, FB[6]) + 0.28 },
      { k: 70, side: 1, w1: -6.2, w2: -0.8, t0: (c) => charLT(c, 6, 0, FB[6]) + 0.36 },
      { k: 26, side: -1, w1: -4.8, w2: 1.6, t0: (c) => charLT(c, 7, 0, FB[7]) },
      { k: 64, side: 1, w1: 6.8, w2: -1.4, t0: (c) => charLT(c, 7, 0, FB[7]) + 0.12 },
      { k: 10, side: -1, w1: 3.6, w2: 0.8, t0: (c) => charLT(c, 8, 0, FB[8]) },
    ];
    FLUNG.forEach((f) => { PL[f.k].miss = false; });
  })();
})();
