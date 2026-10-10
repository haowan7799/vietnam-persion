/* 第三版镜头组 fg5：c1_fireworks, x3_fishing, d3_pass */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // ---------------- 公用 ----------------
  // 设备像素的临时画布（只增不减，用前清空用到的区域），帧间不保留内容
  const canv = new Map();
  function rawCanvas(key, pw, ph) {
    let c = canv.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = 8; c.height = 8; canv.set(key, c); }
    if (c.width < pw || c.height < ph) { c.width = Math.max(c.width, pw); c.height = Math.max(c.height, ph); }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw + 2, ph + 2);
    return { c, g };
  }
  // 设备坐标子层：逻辑框在当前变换 m 下覆盖的设备像素；子层的变换与主画布一致，合成时整像素贴回
  function devLayer(key, m, x0, y0, x1, y1) {
    const dx = Math.floor(m.a * x0 + m.e), dy = Math.floor(m.d * y0 + m.f);
    const pw = Math.ceil(m.a * x1 + m.e) - dx + 1, ph = Math.ceil(m.d * y1 + m.f) - dy + 1;
    const r = rawCanvas(key, pw, ph);
    r.g.setTransform(m.a, 0, 0, m.d, m.e - dx, m.f - dy);
    return { c: r.c, g: r.g, dx, dy, pw, ph, m };
  }
  function putLayer(g, L, alpha, op) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    if (alpha != null) g.globalAlpha = alpha;
    if (op) g.globalCompositeOperation = op;
    g.drawImage(L.c, 0, 0, L.pw, L.ph, L.dx, L.dy, L.pw, L.ph);
    g.restore();
  }
  // 第 off 句第 k 字唱出的时刻（相对镜头起点）；取不到时用分镜表里的秒数
  const charAt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  // 柔光点贴图（白色，按颜色缓存）
  function glowTex(col) {
    return K.cache('fg5_glow_' + col, 64, 64, 0.5, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.18, rgba(col, 0.55)); gr.addColorStop(0.45, rgba(col, 0.16)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  function softTex(col) {
    return K.cache('fg5_soft_' + col, 64, 64, 0.5, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.5, rgba(col, 0.6)); gr.addColorStop(0.8, rgba(col, 0.18)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
  }
  // 路径的轮廓光：先用亮色填，再把同一路径向背光方向平移 w 用主色填（裁在原路径内）
  function rimFill(g, path, body, rimCol, rimA, dx, dy) {
    g.fillStyle = body; g.fill(path);
    if (!rimCol || rimA <= 0.003) return;
    g.save();
    g.clip(path);
    g.globalAlpha *= rimA;
    g.fillStyle = rimCol; g.fill(path);
    g.globalAlpha /= rimA;
    g.translate(dx, dy);
    g.fillStyle = body; g.fill(path);
    g.restore();
  }
  // 调试用分段计时（XYT.__fg5prof 存在时才生效）
  function prof(g, name) {
    const P = XYT.__fg5prof;
    if (!P) return;
    g.getImageData && g.getImageData(0, 0, 1, 1);
    const now = performance.now();
    if (P._last != null && P._name) P[P._name] = (P[P._name] || 0) + now - P._last;
    P._last = now; P._name = name;
  }
  // 平滑折线 → Path2D（二次曲线过中点）
  function smoothPath(p, pts, close) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      p.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    p.lineTo(l[0], l[1]);
    if (close) p.closePath();
    return p;
  }


  // ============================================================
  // c1_fireworks 烟火成红：夏夜湖上烟花，远岸水榭栏边一对背影；金白火花如雪，最后一朵红色大烟花染红天地
  // ============================================================
  (function () {
    const FB = [0.287, 0.587, 0.927, 1.387, 1.787, 2.187, 2.587, 3.087, 3.467, 3.887, 4.147, 5.027, 5.547, 6.007];
    const YW = 465;        // 远岸水线
    const YP = 483;        // 水榭木桩入水线
    const DECK = 470;      // 水榭平台面
    const PX = 652;        // 人物着地点 x
    const COL = { gold: '#f7d38a', white: '#f4f0e6', red: '#d8302f', redHot: '#ff7a5c' };
    const isRed = (B) => B.col === 'red' || B.col === 'redHot';
    // 烟花：k = 对应的字；x、y = 绽开点；R = 星点最终半径；n = 星数；kind：peony 牡丹（快散、重力下垂）/ kamuro 锦冠（金白长尾，缓缓飘落）
    const SHELLS = [
      { k: 0, x: 432, y: 236, R: 118, n: 36, col: 'gold', kind: 'peony', rise: 1.15, pow: 0.5, seed: 11 },
      { k: 2, x: 858, y: 204, R: 132, n: 38, col: 'white', kind: 'peony', rise: 1.2, pow: 0.5, seed: 23 },
      { k: 4, x: 548, y: 168, R: 128, n: 38, col: 'gold', kind: 'peony', rise: 1.25, pow: 0.55, seed: 37 },
      { k: 6, x: 968, y: 250, R: 112, n: 36, col: 'white', kind: 'peony', rise: 1.15, pow: 0.5, seed: 41 },
      { k: 7, x: 655, y: 150, R: 178, n: 80, col: 'gold', kind: 'kamuro', rise: 1.35, pow: 0.75, seed: 53 },
      { k: 9, x: 868, y: 186, R: 150, n: 50, col: 'gold', kind: 'kamuro', rise: 1.3, pow: 0.6, seed: 67 },
      { k: 11, x: 640, y: 222, R: 210, n: 60, col: 'red', kind: 'peony', rise: 1.5, pow: 1.5, seed: 71, big: 1 },
      { k: 13, x: 640, y: 222, R: 108, n: 28, col: 'redHot', kind: 'peony', rise: 0, pow: 1.0, seed: 83, pistil: 1 },
    ];
    for (const B of SHELLS) {
      const r = rng(B.seed * 7919);
      B.stars = [];
      const kam = B.kind === 'kamuro';
      B.drag = kam ? 3.0 : B.big ? 2.0 : 2.4;
      B.grav = kam ? 64 : 72;
      for (let i = 0; i < B.n; i++) {
        // 球面上均匀的方向投影到画面：边缘密、中心疏，像真的球形烟花
        const z = 2 * ((i + r()) / B.n) - 1, ph = TAU * r();
        const q = Math.sqrt(Math.max(0, 1 - z * z));
        B.stars.push({
          dx: q * Math.cos(ph), dy: q * Math.sin(ph), dz: z,
          sp: 0.9 + 0.18 * r(),
          life: kam ? 3.6 + 1.1 * r() : B.big ? 2.5 + 0.6 * r() : B.pistil ? 1.8 + 0.4 * r() : 1.45 + 0.6 * r(),
          ph: r() * 100, sw: 0.6 + 0.6 * r(),
        });
      }
      B.maxLife = Math.max(...B.stars.map((s) => s.life));
      B.x0 = B.x - 10 + 20 * r(); // 发射点略偏，升空轨迹是很缓的抛物线
      B.smoke = [];
      for (let i = 0; i < 5; i++) B.smoke.push({ ox: (r() - 0.5) * 0.7, oy: (r() - 0.5) * 0.5, s: 0.55 + 0.4 * r(), ph: r() * 10 });
    }
    // 线性阻力下的抛体：初速沿径向，速度指数衰减，重力把星点拉向终速 g/k
    const starPos = (B, s, tau) => {
      const e = 1 - Math.exp(-B.drag * tau), R = B.R * s.sp;
      let x = B.x + s.dx * R * e;
      if (B.kind === 'kamuro') x += 2.4 * s.sw * Math.sin(0.9 * tau + s.ph) * smooth((tau - 0.8) / 1.2);
      return [x, B.y + s.dy * R * e + (B.grav / B.drag) * (tau - e / B.drag)];
    };
    // 每朵烟花的光：闪光快起慢落 + 星点燃烧期的余光，星点燃尽时归零
    const burnOf = (B) => (B.kind === 'kamuro' ? 2.4 : B.big ? 4.2 : B.pistil ? 3.2 : 1.0);
    const lightOf = (B, tau) => {
      if (tau < 0) return 0;
      const end = 1 - smooth((tau - B.maxLife * 0.8) / (B.maxLife * 0.5));
      return B.pow * smooth(tau / 0.05) * (0.5 * Math.exp(-tau / 0.32) + 0.5 * Math.exp(-tau / burnOf(B))) * Math.max(0, end);
    };

    // ---- 远景：远山、城郭灯火、远岸、柳（静态缓存）----
    function farTex() {
      return K.cache('fg5_fw_far', W, 240, 1, (g) => {
        g.translate(0, -240);
        const r = rng(4242);
        const ridge = (y0, amp, f, seed, col) => {
          g.fillStyle = col; g.beginPath(); g.moveTo(-10, YW + 2);
          for (let x = -10; x <= W + 10; x += 8) {
            const y = y0 - amp * (0.55 * noise1(x * f, seed) + 0.3 * noise1(x * f * 2.3, seed + 5) + 0.15 * noise1(x * f * 5.1, seed + 9));
            g.lineTo(x, y);
          }
          g.lineTo(W + 10, YW + 2); g.closePath(); g.fill();
        };
        ridge(452, 62, 0.0042, 3, '#141c31');
        ridge(458, 34, 0.0068, 7, '#10172a');
        // 城郭：城墙、垛口、城楼、塔、屋顶
        g.fillStyle = '#0b111f';
        g.fillRect(-10, 449, W + 20, 18);
        for (let x = -10; x < W + 10; x += 7) g.fillRect(x, 446, 4, 3);
        for (let i = 0; i < 46; i++) {
          const x = r() * W, y = 441 + r() * 6, w = 14 + r() * 26;
          g.beginPath(); g.moveTo(x - w / 2, y + 6); g.quadraticCurveTo(x - w * 0.25, y + 1, x, y); g.quadraticCurveTo(x + w * 0.25, y + 1, x + w / 2, y + 6); g.lineTo(x + w / 2, 450); g.lineTo(x - w / 2, 450); g.fill();
        }
        const tower = (x, y, w) => {
          g.fillRect(x - w * 0.42, y + 16, w * 0.84, 450 - y - 16);
          for (const [yy, ww] of [[y + 14, w], [y + 4, w * 0.72]]) {
            g.beginPath(); g.moveTo(x - ww / 2 - 4, yy + 2); g.quadraticCurveTo(x - ww * 0.3, yy - 1, x - ww * 0.18, yy - 5); g.lineTo(x + ww * 0.18, yy - 5); g.quadraticCurveTo(x + ww * 0.3, yy - 1, x + ww / 2 + 4, yy + 2); g.lineTo(x + ww * 0.4, yy + 4); g.lineTo(x - ww * 0.4, yy + 4); g.closePath(); g.fill();
            g.fillRect(x - ww * 0.32, yy + 3, ww * 0.64, 7);
          }
        };
        tower(1018, 418, 46); tower(330, 428, 30);
        for (let i = 0; i < 7; i++) { const y = 446 - i * 7.5, w = 16 - i * 1.6; g.fillRect(782 - w * 0.3, y - 6, w * 0.6, 7); g.beginPath(); g.moveTo(782 - w / 2 - 2, y - 5); g.lineTo(782 + w / 2 + 2, y - 5); g.lineTo(782 + w * 0.3, y - 8); g.lineTo(782 - w * 0.3, y - 8); g.fill(); }
        g.fillRect(781.4, 384, 1.2, 10);
        // 灯火：暖色小点，城门与塔附近密一些
        for (let i = 0; i < 110; i++) {
          let x = r() * W;
          if (i < 26) x = 1018 + (r() - 0.5) * 120; else if (i < 38) x = 782 + (r() - 0.5) * 50;
          const y = 444 + r() * 18, s = 0.7 + r() * 0.9, a = 0.35 + 0.55 * r();
          g.fillStyle = rgba(r() < 0.8 ? '#f2b765' : '#f7d98f', a * 0.25); g.beginPath(); g.arc(x, y, s * 2.6, 0, TAU); g.fill();
          g.fillStyle = rgba('#ffd690', a); g.fillRect(x - s / 2, y - s / 2, s, s);
        }
        // 远岸
        g.fillStyle = '#090d17';
        g.beginPath(); g.moveTo(-10, YW + 1);
        for (let x = -10; x <= W + 10; x += 10) g.lineTo(x, 461 - 2.2 * noise1(x * 0.03, 12) - (x < 420 ? 3 * noise1(x * 0.011, 4) : 0));
        g.lineTo(W + 10, YW + 1); g.closePath(); g.fill();
        willow(g, 196, 464, 1, 91);
        willow(g, 1214, 465, 0.66, 92);
      });
    }
    // 垂柳：树干分出几根上扬的主枝，树冠是一团圆顶，长长的柳丝从树冠垂下，外侧最长
    function willow(g, x, y, s, seed) {
      const r = rng(seed * 131);
      const col = '#080b14';
      g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round';
      const fx = x + 4 * s, fy = y - 92 * s;
      g.beginPath(); g.moveTo(x - 8 * s, y); g.quadraticCurveTo(x - 3 * s, y - 50 * s, fx - 4 * s, fy); g.lineTo(fx + 5 * s, fy); g.quadraticCurveTo(x + 5 * s, y - 50 * s, x + 8 * s, y); g.closePath(); g.fill();
      const cx = x + 2 * s, cy = y - 158 * s, rx = 98 * s, ry = 58 * s;
      // 主枝
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i + 0.5) / 6 * Math.PI;
        const ex = cx + Math.cos(a) * rx * 0.75, ey = cy + Math.sin(a) * ry * 0.6;
        g.lineWidth = (4.2 - i % 2) * s;
        g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo((fx + ex) / 2 + Math.cos(a) * 10 * s, (fy + ey) / 2 - 14 * s, ex, ey); g.stroke();
      }
      // 树冠实心部分：许多小叶团
      for (let i = 0; i < 90; i++) {
        const a = Math.PI + r() * Math.PI, rho = Math.sqrt(r()) * 0.86;
        const px = cx + Math.cos(a) * rx * rho, py = cy + Math.sin(a) * ry * rho + 12 * s;
        g.beginPath(); g.ellipse(px, py, (7 + 6 * r()) * s, (4 + 3 * r()) * s, (r() - 0.5) * 0.6, 0, TAU); g.fill();
      }
      // 柳丝
      for (let i = 0; i < 150; i++) {
        const a = Math.PI + (0.04 + 0.92 * r()) * Math.PI, rho = 0.5 + 0.5 * Math.sqrt(r());
        const sx = cx + Math.cos(a) * rx * rho, sy = cy + Math.sin(a) * ry * rho + 10 * s;
        const out = Math.abs(Math.cos(a));
        const L = Math.min(y - 8 * s - sy, (40 + 120 * out * out + 40 * r()) * s);
        if (L < 10 * s) continue;
        const bend = Math.cos(a) * (6 + 10 * r()) * s;
        g.lineWidth = (0.7 + 0.4 * r()) * s;
        g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + bend, sy + L * 0.35, sx + bend * 0.8, sy + L); g.stroke();
        const n = (L / (4.2 * s)) | 0;
        for (let k = 2; k < n; k++) {
          const u = k / n, mt = 1 - u;
          const px = sx * mt * mt + 2 * (sx + bend) * mt * u + (sx + bend * 0.8) * u * u;
          const py = sy * mt * mt + 2 * (sy + L * 0.35) * mt * u + (sy + L) * u * u;
          const lw = (1.9 + 1.2 * r()) * s * (1 - 0.35 * u);
          g.beginPath(); g.ellipse(px + (k % 2 ? 0.9 : -0.9) * s, py, lw * 0.32, lw, k % 2 ? 0.45 : -0.45, 0, TAU); g.fill();
        }
      }
    }
    function farRedTex() {
      return K.cache('fg5_fw_farred', W, 240, 1, (g) => {
        g.drawImage(farTex(), 0, 0, W, 240);
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = '#3a1416'; g.fillRect(0, 0, W, 240);
      });
    }

    // ---- 薄云：几片稀疏的层云，暗色与受光两版（缓存）----
    function cloudShape(g, col) {
      const r = rng(777);
      const banks = [[150, 96, 380], [520, 70, 300], [880, 112, 420], [1180, 80, 300], [700, 150, 260]];
      for (const [bx, by, bw] of banks) {
        for (let i = 0; i < 16; i++) {
          const x = bx + (r() - 0.5) * bw, y = by + (r() - 0.5) * 18 + 0.02 * (x - bx);
          const w = 40 + r() * 110, h = 8 + r() * 14;
          g.save(); g.translate(x, y); g.scale(1, h / w);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
          const a = 0.18 + 0.2 * r();
          gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.55, rgba(col, a * 0.5)); gr.addColorStop(1, rgba(col, 0));
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w / 2, 0, TAU); g.fill();
          g.restore();
        }
      }
    }
    const cloudTex = (col) => K.cache('fg5_fw_cloud_' + col, W, 220, 0.5, (g) => cloudShape(g, col));

    // ---- 水榭：Path2D（每帧填色，轮廓光方向随烟火变化）----
    const PAV = (() => {
      const back = new Path2D(), front = new Path2D(), lat = new Path2D();
      back.rect(424, DECK - 1, 322, 6);
      for (let x = 430; x <= 742; x += 26) back.rect(x, DECK + 5, 3, YP - DECK - 5);
      for (const x of [436, 482, 530, 576]) back.rect(x - 2, 404, 4.2, DECK - 404);
      back.rect(426, 402, 162, 6);
      for (let x = 440; x < 580; x += 6) lat.rect(x, 408, 1, 6);
      lat.rect(436, 413, 144, 1.2);
      // 歇山顶（正面）：檐口两端起翘，屋面收到正脊，脊两端鸱吻
      smoothPath(back, [[404, 384], [412, 392], [426, 398], [470, 401], [508, 401.5], [546, 401], [590, 398], [604, 392], [612, 384],
        [606, 386], [592, 390], [578, 388], [566, 372], [556, 356], [548, 352], [468, 352], [460, 356], [450, 372], [438, 388], [424, 390], [410, 386]], true);
      back.rect(462, 347, 92, 6);
      back.moveTo(460, 353); back.quadraticCurveTo(456, 343, 461, 338); back.lineTo(465, 347); back.closePath();
      back.moveTo(556, 353); back.quadraticCurveTo(560, 343, 555, 338); back.lineTo(551, 347); back.closePath();
      // 前栏（美人靠）：横穿平台前沿，画在人物之前
      front.rect(424, 450, 322, 2.4);
      front.rect(424, 459, 322, 1.4);
      for (let x = 428; x <= 744; x += 14) front.rect(x, 450, 1.8, DECK - 450);
      front.rect(424, DECK - 2, 322, 3);
      const tiles = new Path2D();
      for (let x = 468; x <= 548; x += 5) { tiles.moveTo(x, 355); tiles.lineTo(x + (x - 508) * 0.55, 398); }
      return { back, front, lat, tiles };
    })();

    XYT.registerShot('c1_fireworks', {
      name: '烟火成红', zone: 'bottom', night: true, text: '#f6efe2', shadow: 'rgba(8,6,14,0.9)', accent: '#ff7a5c', bloom: 0.42,
      draw(g, c) {
        const t = c.lt, tt = Math.max(0, t);
        const T = SHELLS.map((B) => charAt(c, B.k, 0, FB));
        // 光：金白与红分别累加；方向取各朵烟花相对人物的加权方向
        let G = 0, R = 0, lx = 0, ly = 0, gx = 0, gy = 0;
        const Ls = SHELLS.map((B, i) => lightOf(B, t - T[i]));
        for (let i = 0; i < SHELLS.length; i++) {
          const B = SHELLS[i], L = Ls[i];
          if (L <= 0) continue;
          if (isRed(B)) R += L; else { G += L; gx += L * B.x; gy += L * B.y; }
          const dx = B.x - PX, dy = B.y - 440, d = Math.hypot(dx, dy);
          lx += L * dx / d; ly += L * dy / d;
        }
        const LL = G + R;
        let dl = Math.hypot(lx, ly);
        if (dl < 1e-4) { lx = 0; ly = -1; dl = 1; }
        lx /= dl; ly /= dl;
        // 红光的环境染色：「都」起铺开、「红」最浓，之后缓慢回落但不消失
        const tDu = T[6], tHong = T[7];
        const redAmb = clamp(0.75 * smooth((t - tDu) / 0.35) * (0.82 + 0.18 * Math.exp(-Math.max(0, t - tDu) / 0.5)) + 0.35 * smooth((t - tHong) / 0.25) * Math.exp(-Math.max(0, t - tHong) / 3.2), 0, 1.1);

        prof(g, 'sky');
        // 镜头：整镜 1.00→1.04 缓推
        const z = 1 + 0.04 * easeInOut(tt / c.dur);
        g.save();
        g.translate(640, 330); g.scale(z, z); g.translate(-640, -330);

        // ---- 天空（1/3 分辨率缓冲，柔和的东西都画在这里再一次放大贴回）：底色、暗云、红/金环境光、光晕、被照亮的烟与云底 ----
        const SB = rawCanvas('fg5_fw_sky', 428, 162);
        const sb = SB.g;
        sb.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0);
        const sky = sb.createLinearGradient(0, 0, 0, 480);
        sky.addColorStop(0, '#060914'); sky.addColorStop(0.53, '#0c1326'); sky.addColorStop(0.97, '#1b2640'); sky.addColorStop(1, '#1b2640');
        sb.fillStyle = sky; sb.fillRect(0, 0, W + 4, 486);
        sb.globalAlpha = 0.7; sb.drawImage(cloudTex('#141c2e'), 0, 0, W, 220); sb.globalAlpha = 1;
        sb.globalCompositeOperation = 'lighter';
        if (redAmb > 0.002) {
          const ra = Math.min(1, redAmb);
          const rg = sb.createRadialGradient(640, 230, 0, 640, 230, 900);
          rg.addColorStop(0, `rgba(215,50,32,${0.8 * ra})`); rg.addColorStop(0.4, `rgba(170,34,28,${0.55 * ra})`); rg.addColorStop(1, `rgba(96,16,20,${0.4 * ra})`);
          sb.fillStyle = rg; sb.fillRect(0, 0, W + 4, 486);
        }
        if (G > 0.01) {
          const cx = gx / G, cy = gy / G, ga = Math.min(0.6, G * 0.45);
          const gg = sb.createRadialGradient(cx, cy, 0, cx, cy, 760);
          gg.addColorStop(0, `rgba(150,124,86,${ga})`); gg.addColorStop(0.5, `rgba(70,60,48,${ga * 0.6})`); gg.addColorStop(1, 'rgba(30,26,22,0)');
          sb.fillStyle = gg; sb.fillRect(0, 0, W + 4, 486);
          sb.globalAlpha = Math.min(0.6, G * 0.5); sb.drawImage(cloudTex('#c9b48a'), 0, 0, W, 220);
        }
        if (R + redAmb > 0.01) { sb.globalAlpha = Math.min(0.8, R * 0.35 + redAmb * 0.4); sb.drawImage(cloudTex('#d0482e'), 0, 0, W, 220); }
        for (let i = 0; i < SHELLS.length; i++) {
          const B = SHELLS[i], tau = t - T[i];
          if (tau < 0) continue;
          const L = Ls[i];
          // 烟：绽开后慢慢出现、扩散、略上浮；被自己与别的烟火照亮时才看得见
          const sm = smooth(tau / 0.8) * (1 - 0.5 * smooth((tau - 3) / 5));
          const lit = Math.min(1.2, L * 0.9 + (isRed(B) ? 0 : G * 0.25) + R * 0.35 + redAmb * 0.3);
          if (sm > 0.01 && lit > 0.01) {
            const litCol = (isRed(B) || R + redAmb > G) ? '#c4442e' : '#bcac8c';
            sb.globalAlpha = Math.min(1, 0.2 * sm * lit);
            const st = softTex(litCol);
            for (const p of B.smoke) {
              const rr = B.R * p.s * (0.45 + 0.35 * smooth(tau / 3)) + 5 * tau;
              const x = B.x + p.ox * B.R + 2 * Math.sin(tau * 0.3 + p.ph), y = B.y + p.oy * B.R - 3 * tau;
              sb.drawImage(st, x - rr, y - rr, rr * 2, rr * 2);
            }
          }
          if (L > 0.005) {
            const gr = B.R * 2.5;
            sb.globalAlpha = Math.min(1, 0.4 * L);
            sb.drawImage(glowTex(isRed(B) ? '#ff4a30' : '#ffd9a0'), B.x - gr, B.y - gr, gr * 2, gr * 2);
          }
        }
        g.imageSmoothingEnabled = true;
        g.drawImage(SB.c, 0, 0, 427, 160, 0, 0, W + 1, 480);
        // 星：极淡，被烟火光冲淡
        {
          const sa = 0.55 * (1 - 0.7 * Math.min(1, LL)) * (1 - 0.85 * Math.min(1, redAmb));
          if (sa > 0.02) {
            g.fillStyle = '#dfe6f4';
            for (let i = 0; i < 70; i++) {
              const x = h2(i, 901) * W, y = h2(i, 902) * 300;
              g.globalAlpha = sa * (0.2 + 0.6 * h2(i, 903)) * (0.85 + 0.15 * Math.sin(tt * (0.8 + h2(i, 904)) + i));
              g.fillRect(x, y, 1.1, 1.1);
            }
            g.globalAlpha = 1;
          }
        }

        // ---- 升空光尾与星点 ----
        prof(g, 'stars');
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.lineCap = 'round';
        for (let i = 0; i < SHELLS.length; i++) {
          const B = SHELLS[i];
          if (B.rise > 0) drawRise(g, B, t - T[i]);
          drawStars(g, B, t - T[i], c);
        }
        g.restore();

        // ---- 远景（远山、城郭、远岸、柳）----
        prof(g, 'far');
        g.drawImage(farTex(), 0, 240, W, 240);
        if (redAmb > 0.01) { g.globalAlpha = Math.min(1, redAmb * 0.7); g.drawImage(farRedTex(), 0, 240, W, 240); g.globalAlpha = 1; }

        // ---- 湖面：底色 + 远景倒影（按远岸水线翻转、缩小模糊、横向波纹）----
        prof(g, 'refl');
        const m = g.getTransform();
        drawReflection(g, m, YW, 612, tt, 0.62);
        // 烟火在水面上的碎光：每朵烟花正下方一条闪烁的光路
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < SHELLS.length; i++) {
          const B = SHELLS[i], L = Ls[i];
          if (L < 0.01) continue;
          g.fillStyle = isRed(B) ? '#ff6a48' : '#ffe2a8';
          for (let k = 0; k < 34; k++) {
            const u = (k + 0.5) / 34, y = YW + 4 + u * 128;
            const spread = 6 + u * 46;
            const x = B.x + (h2(k, B.seed) - 0.5) * 2 * spread + 3 * Math.sin(tt * 1.3 + k);
            const a = L * (0.55 - 0.35 * u) * (0.5 + 0.5 * noise1(tt * 2.2 + k * 3.1, B.seed));
            if (a < 0.01) continue;
            g.globalAlpha = Math.min(1, a);
            const len = 3 + u * 16 * (0.6 + 0.4 * h2(k, B.seed + 1));
            g.fillRect(x - len / 2, y, len, 0.9 + u * 0.8);
          }
        }
        g.restore();

        // ---- 水榭与人物（设备坐标子层：清晰、可整体翻转出倒影）----
        prof(g, 'mid');
        const mid = devLayer('fg5_fw_mid', m, 396, 330, 760, YP + 1);
        const mg = mid.g;
        const rimCol = R > G ? '#ff8a66' : '#ffe2b0';
        const rimA = Math.min(0.95, LL * 0.9);
        const body = mix('#0b0e17', '#2a0d0f', Math.min(1, redAmb * 0.8));
        const rw = 1.3;
        rimFill(mg, PAV.back, body, rimCol, rimA, -lx * rw, -ly * rw);
        mg.fillStyle = rgba('#1a2234', 0.9); mg.fill(PAV.tiles);
        mg.fillStyle = body; mg.fill(PAV.lat);
        // 灯笼（左檐角下）：红绢、暖光
        mg.strokeStyle = '#0b0e17'; mg.lineWidth = 0.8; mg.beginPath(); mg.moveTo(431, 399); mg.lineTo(431, 409); mg.stroke();
        mg.fillStyle = '#c23a2a'; mg.beginPath(); mg.ellipse(431, 415, 4.2, 5.6, 0, 0, TAU); mg.fill();
        mg.fillStyle = '#ffb46a'; mg.globalAlpha = 0.6; mg.beginPath(); mg.ellipse(430.2, 414.2, 2, 3.4, 0, 0, TAU); mg.fill(); mg.globalAlpha = 1;
        mg.fillStyle = '#0b0e17'; mg.fillRect(429.4, 409, 3.2, 1.2); mg.fillRect(429.4, 420.4, 3.2, 1.2);
        drawPair(mg, mid, tt, lx, ly, rimCol, rimA);
        rimFill(mg, PAV.front, body, rimCol, rimA * 0.8, -lx * rw, -ly * rw);
        putLayer(g, mid);
        drawMidReflection(g, mid, m, tt);
        g.save(); g.globalCompositeOperation = 'lighter';
        const fl = 0.9 + 0.06 * Math.sin(tt * 5.1) + 0.04 * Math.sin(tt * 8.3);
        g.globalAlpha = 0.5 * fl; g.drawImage(glowTex('#ffb060'), 431 - 22, 415 - 22, 44, 44);
        g.globalAlpha = 0.2 * fl; g.drawImage(glowTex('#ff9a50'), 431 - 60, 415 - 60, 120, 120);
        g.fillStyle = '#ffb46a';
        for (let k = 0; k < 9; k++) {
          const y = 2 * YP - 415 + k * 5 - 8, a = 0.22 * (1 - k / 9) * (0.6 + 0.4 * noise1(tt * 2 + k * 1.7, 5));
          g.globalAlpha = a; g.fillRect(431 - 2 + 1.6 * Math.sin(tt * 1.4 + k), y, 4, 1.2);
        }
        g.restore();

        // ---- 近景：湖面压暗、近岸石阶与荷叶（亮度恒定，歌词区）----
        prof(g, 'fore');
        g.drawImage(foreTex(), 0, 540, W, 190);
        g.restore();
        prof(g, null);
      },
    });

    function drawRise(g, B, tau) {
      const T = B.rise;
      const tr = tau + T;
      if (tr <= 0) return;
      const yA = YW + 8;
      const posAt = (s) => { const u = clamp(s / T), q = (1 - u) * (1 - u); return [B.x + (B.x0 - B.x) * q, B.y + (yA - B.y) * q]; };
      const fade = tau > 0 ? 1 - smooth(tau / 0.25) : 1;
      if (fade <= 0) return;
      const head = Math.min(tr, T);
      const col = isRed(B) ? '#ffb090' : '#ffe6b8';
      g.strokeStyle = col;
      g.lineWidth = 1.1;
      for (const [a0, a1, al] of [[0.24, 0.15, 0.12], [0.15, 0.07, 0.28], [0.07, 0, 0.55]]) {
        const p0 = posAt(Math.max(0, head - a0)), p1 = posAt(Math.max(0, head - a1));
        g.globalAlpha = al * fade * smooth(tr / 0.2);
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
      if (tau < 0) {
        const p = posAt(head);
        g.globalAlpha = 0.7 * smooth(tr / 0.2);
        g.drawImage(glowTex(col), p[0] - 6, p[1] - 6, 12, 12);
      }
    }

    // 星点：光尾按亮度分 6 档合并成路径（少画几笔），光晕与亮核逐个画
    function drawStars(g, B, tau, c) {
      if (tau < 0 || tau > B.maxLife) return;
      const kam = B.kind === 'kamuro';
      const col = COL[B.col];
      const gt = glowTex(col), ct = glowTex(isRed(B) ? '#ffb39a' : '#fffaf0');
      const beat = c.be ? c.be(0.3) : 0;
      const NB = 6, near = [], far = [];
      for (let k = 0; k < NB; k++) { near.push(new Path2D()); far.push(new Path2D()); }
      const used = new Array(NB).fill(false);
      const gs = (kam ? 7 : 10) * (B.big ? 1.3 : 1), cs = kam ? 2.6 : 3.2;
      for (const s of B.stars) {
        if (tau > s.life) continue;
        const u = tau / s.life;
        let a = smooth(tau / 0.04) * (1 - smooth((u - 0.55) / 0.45));
        if (kam) a *= (0.55 + 0.45 * Math.exp(-tau / 0.7)) * (0.66 + 0.34 * noise1(tau * 6 + s.ph, B.seed)) * (1 + 0.12 * beat);
        else a *= 1 - 0.3 * smooth((u - 0.45) / 0.3) * (0.5 + 0.5 * Math.sin(tau * 9 + s.ph));
        a *= 0.78 + 0.22 * s.dz;
        if (a < 0.01) continue;
        const p = starPos(B, s, tau);
        const bi = Math.min(NB - 1, Math.floor(Math.min(1, a) * NB));
        used[bi] = true;
        if (kam) {
          // 锦冠：长尾像垂柳，后半段更淡
          const q1 = starPos(B, s, Math.max(0, tau - 0.3)), q2 = starPos(B, s, Math.max(0, tau - 0.85));
          near[bi].moveTo(q1[0], q1[1]); near[bi].lineTo(p[0], p[1]);
          far[bi].moveTo(q2[0], q2[1]); far[bi].lineTo(q1[0], q1[1]);
        } else {
          const q = starPos(B, s, Math.max(0, tau - 0.1));
          near[bi].moveTo(q[0], q[1]); near[bi].lineTo(p[0], p[1]);
        }
        g.globalAlpha = Math.min(1, a * 0.75);
        g.drawImage(gt, p[0] - gs, p[1] - gs, gs * 2, gs * 2);
        g.globalAlpha = Math.min(1, a);
        g.drawImage(ct, p[0] - cs, p[1] - cs, cs * 2, cs * 2);
      }
      g.strokeStyle = col;
      for (let k = 0; k < NB; k++) {
        if (!used[k]) continue;
        const a = (k + 0.5) / NB;
        g.lineWidth = kam ? 1.0 : 1.3;
        g.globalAlpha = a * (kam ? 0.4 : 0.6);
        g.stroke(near[k]);
        if (kam) { g.lineWidth = 0.8; g.globalAlpha = a * 0.16; g.stroke(far[k]); }
      }
    }

    function drawPair(mg, mid, tt, lx, ly, rimCol, rimA) {
      const h = 50;
      const b = XYT.sil.bounds('pair', 'standBack', h);
      const x0 = PX + b.left - 3, x1 = PX + b.right + 3, y0 = DECK + b.top - 3, y1 = DECK + b.bottom + 2;
      const Ap = devLayer('fg5_fw_pairA', mid.m, x0, y0, x1, y1);
      XYT.sil.draw(Ap.g, 'pair', 'standBack', PX, DECK, h, tt, { wind: 0.04, windDir: 1, body: '#10131c', rim: null });
      const ox = Ap.dx - mid.dx, oy = Ap.dy - mid.dy;
      mg.save(); mg.setTransform(1, 0, 0, 1, 0, 0);
      mg.drawImage(Ap.c, 0, 0, Ap.pw, Ap.ph, ox, oy, Ap.pw, Ap.ph);
      if (rimA > 0.01) {
        // 轮廓光 = 剪影 − 剪影向背光方向平移 w；光来自上方各朵烟花的加权方向
        const Bp = rawCanvas('fg5_fw_pairB', Ap.pw, Ap.ph);
        Bp.g.drawImage(Ap.c, 0, 0, Ap.pw, Ap.ph, 0, 0, Ap.pw, Ap.ph);
        Bp.g.globalCompositeOperation = 'source-in';
        Bp.g.fillStyle = rimCol; Bp.g.fillRect(0, 0, Ap.pw, Ap.ph);
        Bp.g.globalCompositeOperation = 'destination-out';
        const w = 1.1 * mid.m.a;
        Bp.g.drawImage(Ap.c, 0, 0, Ap.pw, Ap.ph, -lx * w, -ly * w, Ap.pw, Ap.ph);
        mg.globalAlpha = rimA;
        mg.drawImage(Bp.c, 0, 0, Ap.pw, Ap.ph, ox, oy, Ap.pw, Ap.ph);
      }
      mg.restore();
    }

    // 远景倒影：把水线以上一条（设备坐标）缩小拷贝，再按水线翻转、逐条横向错开画回
    function drawReflection(g, m, yW, y1, tt, alpha) {
      const cv = g.canvas;
      const yWd = m.d * yW + m.f, y1d = Math.min(cv.height, m.d * y1 + m.f);
      const hd = Math.ceil(y1d - yWd);
      const lk = g.createLinearGradient(0, yW, 0, y1);
      lk.addColorStop(0, '#111a2d'); lk.addColorStop(1, '#070a12');
      g.fillStyle = lk; g.fillRect(-60, yW, W + 120, y1 - yW + 2);
      if (hd <= 0) return;
      const q = 3;
      const rw = Math.ceil(cv.width / q), rh = Math.ceil(hd / q) + 1;
      const Rf = rawCanvas('fg5_refl', rw, rh);
      Rf.g.imageSmoothingEnabled = true;
      Rf.g.drawImage(cv, 0, yWd - hd, cv.width, hd, 0, 0, rw, hd / q);
      g.save();
      g.setTransform(1, 0, 0, -1, 0, 2 * yWd);
      g.globalAlpha = alpha;
      g.imageSmoothingEnabled = true;
      const strip = Math.max(1, Math.round(2 * m.d));
      for (let yd = 0; yd < hd; yd += strip) {
        const yl = yd / m.d;
        const amp = 0.5 + yl * 0.035;
        const off = amp * (0.6 * Math.sin(yl * 0.85 + tt * 1.5) + 0.4 * Math.sin(yl * 0.33 - tt * 1.05 + 2)) * m.a;
        const sy = (hd - yd - strip) / q;
        g.drawImage(Rf.c, 0, Math.max(0, sy), rw, strip / q, off, yWd - yd - strip, cv.width, strip);
      }
      g.restore();
      const dk = g.createLinearGradient(0, yW, 0, y1);
      dk.addColorStop(0, 'rgba(6,8,14,0)'); dk.addColorStop(0.55, 'rgba(6,8,14,0.25)'); dk.addColorStop(1, 'rgba(6,8,14,0.75)');
      g.fillStyle = dk; g.fillRect(-60, yW, W + 120, y1 - yW + 2);
    }

    // 水榭与人物的倒影：子层按入水线翻转，变暗，横向波纹
    function drawMidReflection(g, mid, m, tt) {
      const ypd = m.d * YP + m.f;
      const bot = ypd;
      const hd = Math.floor(bot - mid.dy);
      if (hd <= 0) return;
      g.save();
      g.setTransform(1, 0, 0, -1, 0, 2 * ypd);
      g.globalAlpha = 0.42;
      const strip = Math.max(1, Math.round(2 * m.d));
      for (let yd = 0; yd < hd; yd += strip) {
        const yl = yd / m.d;
        const amp = 0.4 + yl * 0.04;
        const off = amp * (0.6 * Math.sin(yl * 0.9 + tt * 1.5) + 0.4 * Math.sin(yl * 0.35 - tt * 1.05 + 2)) * m.a;
        const sy = bot - yd - strip - mid.dy;
        if (sy < 0) break;
        g.drawImage(mid.c, 0, sy, mid.pw, strip, mid.dx + off, ypd - yd - strip, mid.pw, strip);
      }
      g.restore();
    }

    // 近景：湖面压暗、近岸石阶、荷叶（静态缓存）
    function foreTex() {
      return K.cache('fg5_fw_fore', W, 190, 1, (g) => {
        g.translate(0, -540);
        const dk = g.createLinearGradient(0, 560, 0, 616);
        dk.addColorStop(0, 'rgba(5,7,12,0)'); dk.addColorStop(1, 'rgba(5,7,12,0.85)');
        g.fillStyle = dk; g.fillRect(0, 560, W, 60);
        const st = [[612, 620, 650], [650, 657, 684], [684, 690, 730]];
        for (const [y0, y1, y2] of st) {
          g.fillStyle = '#121620'; g.fillRect(0, y0, W, y1 - y0);
          g.fillStyle = '#0a0d15'; g.fillRect(0, y1, W, y2 - y1);
          g.fillStyle = 'rgba(40,48,66,0.5)'; g.fillRect(0, y0, W, 1);
          const r = rng(y0);
          g.fillStyle = 'rgba(4,5,9,0.8)';
          for (let x = r() * 120; x < W; x += 110 + r() * 90) g.fillRect(x, y1, 1.4, y2 - y1);
        }
        g.fillStyle = 'rgba(70,84,110,0.25)'; g.fillRect(0, 611, W, 1);
        const leaf = (x, y, rx, ry, rot, col, hi) => {
          g.save(); g.translate(x, y); g.rotate(rot);
          g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0.12, TAU - 0.12); g.lineTo(0, 0); g.closePath(); g.fill();
          g.strokeStyle = hi; g.lineWidth = 0.8;
          for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + 0.3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * rx * 0.85, Math.sin(a) * ry * 0.85); g.stroke(); }
          g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0.12, TAU - 0.12); g.stroke();
          g.restore();
        };
        const stand = (x, y, h, s, lean) => {
          g.strokeStyle = '#0a0f15'; g.lineWidth = 2.2 * s;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.4, y - h * 0.5, x + lean, y - h); g.stroke();
          g.save(); g.translate(x + lean, y - h); g.rotate(lean * 0.004);
          g.fillStyle = '#0c121a';
          g.beginPath(); g.moveTo(-34 * s, -6 * s); g.quadraticCurveTo(-30 * s, -18 * s, 0, -16 * s); g.quadraticCurveTo(30 * s, -18 * s, 36 * s, -5 * s); g.quadraticCurveTo(20 * s, 2 * s, 0, 3 * s); g.quadraticCurveTo(-22 * s, 2 * s, -34 * s, -6 * s); g.fill();
          g.strokeStyle = 'rgba(70,92,96,0.35)'; g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(-32 * s, -7 * s); g.quadraticCurveTo(-28 * s, -17 * s, 0, -15.5 * s); g.quadraticCurveTo(28 * s, -17 * s, 34 * s, -6 * s); g.stroke();
          g.restore();
        };
        leaf(70, 596, 46, 9, 0.02, '#0b1118', 'rgba(64,84,92,0.28)');
        leaf(160, 604, 38, 7.5, -0.03, '#0a1016', 'rgba(64,84,92,0.25)');
        leaf(28, 607, 30, 6, 0.04, '#0a0f15', 'rgba(64,84,92,0.22)');
        stand(118, 610, 66, 1.0, -8);
        stand(48, 612, 42, 0.8, 6);
        g.strokeStyle = '#0a0f15'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(196, 610); g.quadraticCurveTo(200, 580, 206, 552); g.stroke();
        g.fillStyle = '#5a2a34'; g.beginPath(); g.moveTo(206, 530); g.quadraticCurveTo(214, 544, 206, 554); g.quadraticCurveTo(198, 544, 206, 530); g.fill();
        g.fillStyle = 'rgba(214,120,130,0.35)'; g.beginPath(); g.moveTo(206, 531); g.quadraticCurveTo(211, 541, 207, 551); g.quadraticCurveTo(209, 541, 206, 531); g.fill();
        leaf(1210, 598, 44, 8.5, -0.02, '#0b1118', 'rgba(64,84,92,0.28)');
        leaf(1118, 606, 36, 7, 0.03, '#0a1016', 'rgba(64,84,92,0.25)');
        leaf(1260, 608, 28, 5.5, 0.0, '#0a0f15', 'rgba(64,84,92,0.22)');
        stand(1168, 610, 58, 0.9, 7);
        stand(1236, 612, 36, 0.7, -5);
      });
    }
  })();
})();
