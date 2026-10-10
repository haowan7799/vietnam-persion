/* 第三版镜头组 fg5：c1_fireworks, x3_fishing, d3_pass */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // ---------------- 公用 ----------------
  // 设备像素的临时画布：尺寸按 64 像素取整，只由本帧需要的大小决定（不随渲染历史变化，光栅化路径一致，结果可复现）；
  // 用前清空，帧间不保留内容
  const canv = new Map();
  function rawCanvas(key, pw, ph) {
    let c = canv.get(key);
    if (!c) { c = document.createElement('canvas'); canv.set(key, c); }
    const cw = Math.ceil((pw + 2) / 64) * 64, ch = Math.ceil((ph + 2) / 64) * 64;
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, cw, ch);
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
      { k: 7, x: 655, y: 150, R: 178, n: 80, col: 'gold', kind: 'kamuro', rise: 1.35, pow: 0.75, seed: 53, x0: 712 },
      { k: 9, x: 868, y: 186, R: 150, n: 50, col: 'gold', kind: 'kamuro', rise: 1.3, pow: 0.6, seed: 67 },
      { k: 11, x: 640, y: 222, R: 210, n: 60, col: 'red', kind: 'peony', rise: 1.5, pow: 1.5, seed: 71, big: 1, x0: 718 },
      { k: 13, x: 640, y: 222, R: 150, n: 28, col: 'redHot', kind: 'peony', rise: 0, pow: 1.0, seed: 83, pistil: 1 },
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
      const rx = r();
      // 发射点略偏，升空轨迹是很缓的抛物线；正中的两朵从人物右后方升起，光尾不从两人头顶穿出
      B.x0 = B.x0 != null ? B.x0 : B.x - 10 + 20 * rx;
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
      return B.pow * smooth(tau / 0.09) * (0.38 * Math.exp(-tau / 0.32) + 0.62 * Math.exp(-tau / burnOf(B))) * Math.max(0, end);
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
      for (let i = 0; i < 170; i++) {
        const a = Math.PI + r() * Math.PI, rho = Math.sqrt(r()) * 0.88;
        const px = cx + Math.cos(a) * rx * rho, py = cy + Math.sin(a) * ry * rho + 12 * s;
        g.beginPath(); g.ellipse(px, py, (7 + 6 * r()) * s, (4 + 3 * r()) * s, (r() - 0.5) * 0.6, 0, TAU); g.fill();
      }
      // 柳丝
      for (let i = 0; i < 200; i++) {
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
        // 红光的环境染色：第24句第12字起铺开、第14字最浓，之后缓慢回落但不消失
        const tDu = T[6], tHong = T[7];
        const redAmb = clamp(0.75 * smooth((t - tDu) / 0.35) * (0.82 + 0.18 * Math.exp(-Math.max(0, t - tDu) / 0.5)) + 0.35 * smooth((t - tHong) / 0.25) * Math.exp(-Math.max(0, t - tHong) / 3.2), 0, 1.1);

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
        if (redAmb > 0.002) {
          // 红光先把夜空的蓝换成暗红（不叠成粉紫），再叠一层以烟花为中心的红晕
          const ra = Math.min(1, redAmb);
          const rb = sb.createRadialGradient(640, 230, 0, 640, 230, 950);
          rb.addColorStop(0, '#6e1a16'); rb.addColorStop(0.45, '#4a1013'); rb.addColorStop(1, '#22080d');
          sb.globalAlpha = 0.88 * ra; sb.fillStyle = rb; sb.fillRect(0, 0, W + 4, 486); sb.globalAlpha = 1;
          sb.globalCompositeOperation = 'lighter';
          const rg = sb.createRadialGradient(640, 230, 0, 640, 230, 760);
          rg.addColorStop(0, `rgba(196,40,26,${0.5 * ra})`); rg.addColorStop(0.45, `rgba(120,22,20,${0.28 * ra})`); rg.addColorStop(1, 'rgba(60,8,12,0)');
          sb.fillStyle = rg; sb.fillRect(0, 0, W + 4, 486);
        }
        sb.globalCompositeOperation = 'lighter';
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
            // 烟色：被红光照的比例越大越红（两层按比例叠加，连续过渡）
            const mr = isRed(B) ? 1 : (R + redAmb) / (R + redAmb + G + 1e-6);
            const sa0 = Math.min(1, 0.13 * sm * lit);
            for (const [st, w] of [[softTex('#8e8474'), 1 - mr], [softTex('#a3382a'), mr]]) {
              if (w < 0.004) continue;
              sb.globalAlpha = sa0 * w;
              for (const p of B.smoke) {
                const rr = B.R * p.s * (0.36 + 0.3 * smooth(tau / 3)) + 4 * tau;
                const x = B.x + p.ox * B.R + 2 * Math.sin(tau * 0.3 + p.ph), y = B.y + p.oy * B.R - 3 * tau;
                sb.drawImage(st, x - rr, y - rr, rr * 2, rr * 2);
              }
            }
          }
          if (L > 0.005) {
            // 「红」那朵的光晕保持原来的大小，不把绽开处整片冲淡
            const gr = (B.pistil ? 108 : B.R) * 2.2;
            sb.globalAlpha = Math.min(1, (B.pistil ? 0.24 : 0.32) * L);
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
        g.drawImage(farTex(), 0, 240, W, 240);
        if (redAmb > 0.01) { g.globalAlpha = Math.min(1, redAmb * 0.7); g.drawImage(farRedTex(), 0, 240, W, 240); g.globalAlpha = 1; }

        // ---- 湖面：底色 + 远景倒影（按远岸水线翻转、缩小模糊、横向波纹）----
        const m = g.getTransform();
        drawReflection(g, m, YW, 612, tt, 0.62);
        // 烟火在水面上的碎光：每朵烟花正下方一条闪烁的光路
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < SHELLS.length; i++) {
          const B = SHELLS[i], L = Ls[i];
          if (L < 0.01) continue;
          g.fillStyle = isRed(B) ? '#ff6a48' : '#ffe2a8';
          for (let k = 0; k < 26; k++) {
            const u = (k + 0.5) / 26, y = YW + 4 + u * 128;
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
        const mid = devLayer('fg5_fw_mid', m, 396, 330, 760, YP + 1);
        const mg = mid.g;
        const mRed = R / (R + G + 1e-6);
        const rimCol = mix('#ffe2b0', '#ff8a66', mRed);
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
        drawFore(g);
        for (let k = 0; k < 2; k++) {
          const x0 = LOT[k][0], w = LOT[k][1] - x0;
          g.drawImage(lotusTex(k), x0, 440, w, 200);
          if (LL > 0.02) {
            g.save(); g.globalCompositeOperation = 'lighter';
            const la = Math.min(0.7, LL * 0.55);
            if (mRed < 0.996) { g.globalAlpha = la * (1 - mRed); g.drawImage(lotusRimTex('#b8a27a', k), x0, 440, w, 200); }
            if (mRed > 0.004) { g.globalAlpha = la * mRed; g.drawImage(lotusRimTex('#c8503a', k), x0, 440, w, 200); }
            g.restore();
          }
        }
        g.restore();
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
      // 「红」那一朵画在已经染红的天上：用滤色（screen）叠加，比天亮却不会像加法那样冲成白色；光晕 #ff5a3c ≤ 0.6、星芯 #ff6a48、光尾 #ff4a2c
      const col = B.pistil ? '#ff4a2c' : COL[B.col];
      const gt = glowTex(B.pistil ? '#ff5a3c' : col), ct = glowTex(B.pistil ? '#ff6a48' : isRed(B) ? '#ffa48a' : '#fffaf0');
      const op = g.globalCompositeOperation;
      if (B.pistil) g.globalCompositeOperation = 'screen';
      const ka = B.pistil ? 0.6 : 1, kc = B.pistil ? 0.85 : 1;
      const beat = c.be ? c.be(0.3) : 0;
      const NB = 6, near = [], far = [];
      for (let k = 0; k < NB; k++) { near.push(new Path2D()); far.push(new Path2D()); }
      const used = new Array(NB).fill(false);
      const gs = (kam ? 7 : 10) * (B.big ? 1.3 : B.pistil ? 1.4 : 1), cs = kam ? 2.6 : B.pistil ? 4 : 3.2;
      for (const s of B.stars) {
        if (tau > s.life) continue;
        const u = tau / s.life;
        let a = smooth(tau / 0.12) * (1 - smooth((u - 0.55) / 0.45));
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
          const q = starPos(B, s, Math.max(0, tau - 0.14));
          near[bi].moveTo(q[0], q[1]); near[bi].lineTo(p[0], p[1]);
        }
        g.globalAlpha = Math.min(1, a * 0.75) * ka;
        g.drawImage(gt, p[0] - gs, p[1] - gs, gs * 2, gs * 2);
        g.globalAlpha = Math.min(1, a) * kc;
        g.drawImage(ct, p[0] - cs, p[1] - cs, cs * 2, cs * 2);
      }
      g.strokeStyle = col;
      for (let k = 0; k < NB; k++) {
        if (!used[k]) continue;
        const a = (k + 0.5) / NB;
        g.lineWidth = kam ? 1.0 : B.pistil ? 1.7 : 1.3;
        g.globalAlpha = a * (kam ? 0.4 : 0.6);
        g.stroke(near[k]);
        if (kam) { g.lineWidth = 0.8; g.globalAlpha = a * 0.16; g.stroke(far[k]); }
      }
      g.globalCompositeOperation = op;
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
      const strip = Math.max(1, Math.round(3 * m.d));
      for (let yd = 0; yd < hd; yd += strip) {
        const yl = yd / m.d;
        const amp = 0.5 + yl * 0.03;
        const off = amp * (0.6 * Math.sin(yl * 0.3 + tt * 1.5) + 0.4 * Math.sin(yl * 0.13 - tt * 1.05 + 2)) * m.a;
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
      const strip = Math.max(1, Math.round(3 * m.d));
      for (let yd = 0; yd < hd; yd += strip) {
        const yl = yd / m.d;
        const amp = 0.4 + yl * 0.03;
        const off = amp * (0.6 * Math.sin(yl * 0.32 + tt * 1.5) + 0.4 * Math.sin(yl * 0.13 - tt * 1.05 + 2)) * m.a;
        const sy = bot - yd - strip - mid.dy;
        if (sy < 0) break;
        g.drawImage(mid.c, 0, sy, mid.pw, strip, mid.dx + off, ypd - yd - strip, mid.pw, strip);
      }
      g.restore();
    }


    // 近景荷丛（左右两侧，歌词带之外）：立叶的剪影衬在湖面倒影上，夜里荷花闭合成花苞；浮叶贴水
    function lotusShapes(g, col, budCol, budHi) {
      // 石阶前沿（y 611）挡住更近处的水面：荷叶、叶柄都不越过它
      g.save(); g.beginPath(); g.rect(-200, 300, W + 400, 311); g.clip();
      const stand = (x, y, s, tilt, sx, seed) => {
        const r = rng(seed);
        g.fillStyle = col; g.strokeStyle = col;
        // 叶柄：从水面以下弯上来
        g.lineWidth = 2.4 * s; g.lineCap = 'round';
        g.beginPath(); g.moveTo(sx, 608); g.quadraticCurveTo(sx + (x - sx) * 0.2, (608 + y) / 2, x, y + 6 * s); g.stroke();
        // 叶：浅碗形，叶缘起伏，中心微凹
        g.save(); g.translate(x, y); g.rotate(tilt);
        const n = 40, rx = 44 * s, ry = 10 * s;
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = Math.PI + (i / n) * Math.PI; // 上半缘（远侧）
          const w = 1 + 0.06 * Math.sin(a * 7 + seed) + 0.04 * (r() - 0.5);
          const px = Math.cos(a) * rx * w, py = Math.sin(a) * ry * w;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        // 近侧叶缘略下卷，叶底收向叶柄
        g.quadraticCurveTo(rx * 0.92, ry * 0.9, rx * 0.5, ry * 0.9);
        g.quadraticCurveTo(rx * 0.12, ry * 1.1, 0, 6 * s);
        g.quadraticCurveTo(-rx * 0.12, ry * 1.1, -rx * 0.5, ry * 0.9);
        g.quadraticCurveTo(-rx * 0.92, ry * 0.9, -rx, 0);
        g.closePath(); g.fill();
        g.restore();
      };
      const bud = (x, y, s, sx) => {
        g.strokeStyle = col; g.lineWidth = 1.8 * s;
        g.beginPath(); g.moveTo(sx, 608); g.quadraticCurveTo(sx + (x - sx) * 0.3, (608 + y) / 2, x, y); g.stroke();
        g.save(); g.translate(x, y); g.scale(s, s);
        g.fillStyle = budCol; g.beginPath(); g.moveTo(0, -27); g.bezierCurveTo(9.5, -18, 10.5, -6, 0, 0); g.bezierCurveTo(-10.5, -6, -9.5, -18, 0, -27); g.fill();
        if (budHi) { g.fillStyle = budHi; g.beginPath(); g.moveTo(0, -26); g.bezierCurveTo(5, -19, 6, -9, 1, -2); g.bezierCurveTo(3, -11, 2, -19, 0, -26); g.fill(); }
        g.fillStyle = col; g.beginPath(); g.moveTo(-7.5, -3); g.quadraticCurveTo(-9.5, -10, -4, -12.5); g.quadraticCurveTo(-3, -5, 0, 0); g.quadraticCurveTo(3, -5, 4, -12.5); g.quadraticCurveTo(9.5, -10, 7.5, -3); g.quadraticCurveTo(0, 2, -7.5, -3); g.fill();
        g.restore();
      };
      const flat = (x, y, rx, ry) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0.14, TAU - 0.14); g.lineTo(x, y); g.closePath(); g.fill(); };
      // 左丛
      bud(122, 494, 0.95, 116);
      stand(74, 522, 1.1, 0.07, 92, 3);
      stand(176, 552, 0.82, -0.12, 168, 5);
      stand(18, 566, 0.7, 0.1, 30, 7);
      flat(60, 600, 50, 8); flat(150, 607, 40, 6.5); flat(232, 609, 26, 4.5);
      // 右丛
      bud(1158, 502, 0.85, 1166);
      stand(1210, 516, 1.05, -0.06, 1196, 11);
      stand(1108, 554, 0.8, 0.12, 1118, 13);
      stand(1270, 560, 0.72, -0.08, 1258, 17);
      flat(1214, 601, 48, 8); flat(1120, 607, 38, 6); flat(1052, 610, 24, 4);
      g.restore();
    }
    // 只缓存左右两丛所在的两块（左 0–270、右 1020–1280）
    const LOT = [[0, 270], [1020, 1280]];
    const lotusTex = (k) => K.cache('fg5_fw_lotus' + k, LOT[k][1] - LOT[k][0], 200, 1, (g) => { g.translate(-LOT[k][0], -440); lotusShapes(g, '#070b10', '#3a1a24', 'rgba(196,108,126,0.4)'); });
    // 立叶与花苞朝上的边被烟火照亮：剪影 − 下移 1.6 px 的剪影
    const lotusRimTex = (col, k) => K.cache('fg5_fw_lotusrim_' + col + k, LOT[k][1] - LOT[k][0], 200, 1, (g) => {
      g.translate(-LOT[k][0], -440);
      lotusShapes(g, col, col, null);
      g.globalCompositeOperation = 'destination-out';
      g.translate(0, 1.6);
      lotusShapes(g, '#000', '#000', null);
    });

    // 近景：湖面压暗、近岸石阶（直接填色，几笔就够，比贴整幅图快）
    const CRACKS = (() => { const out = []; for (const [y0, y1, y2] of [[612, 620, 650], [650, 657, 684], [684, 690, 730]]) { const r = rng(y0); for (let x = r() * 120; x < W; x += 110 + r() * 90) out.push([x, y1, y2 - y1]); } return out; })();
    function drawFore(g) {
      const dk = g.createLinearGradient(0, 560, 0, 616);
      dk.addColorStop(0, 'rgba(5,7,12,0)'); dk.addColorStop(1, 'rgba(5,7,12,0.85)');
      g.fillStyle = dk; g.fillRect(-60, 560, W + 120, 54);
      // 先铺一整块不透明底色：相邻色块的接缝是半覆盖的，不能让上一帧从缝里透出来
      g.fillStyle = '#0a0d15'; g.fillRect(-60, 611, W + 120, 160);
      for (const [y0, y1] of [[612, 620], [650, 657], [684, 690]]) {
        g.fillStyle = '#121620'; g.fillRect(-60, y0, W + 120, y1 - y0);
        g.fillStyle = 'rgba(40,48,66,0.5)'; g.fillRect(-60, y0, W + 120, 1);
      }
      g.fillStyle = 'rgba(4,5,9,0.8)';
      for (const [x, y, h] of CRACKS) g.fillRect(x, y, 1.4, h);
      g.fillStyle = 'rgba(70,84,110,0.25)'; g.fillRect(-60, 611, W + 120, 1);
    }
  })();

  // ============================================================
  // x3_fishing 寒江独钓：大雪的冬江，千山皆白，一叶乌篷小舟，披蓑戴笠的老人在船尾独自垂钓
  // ============================================================
  (function () {
    const BX = 520, BY = 470, BL = 320;      // 船板中点、船长
    const FREE = BL * 0.03;                  // 船板到水线
    const YWL = BY + FREE;                   // 水线
    const MX = BX + 0.36 * BL;               // 老人坐处（船尾三分之一，船头朝左）
    const MH = 100;
    const RIV0 = 428, RIV1 = 560;            // 江面上下沿
    const WIND = 0.28;

    // 镜头内的强拍（相对镜头起点）
    const downsIn = (c, t0, t1) => {
      const out = [], s = c.t - c.lt, gr = c.grid;
      if (!gr || !gr.idx) return out;
      for (let i = gr.idx(s + t0) - 1; i <= gr.idx(s + t1) + 1; i++) {
        const bt = gr.time(i) - s;
        if (bt >= t0 && bt <= t1 && gr.isDown(i)) out.push(bt);
      }
      return out;
    };

    // 雪峰：每座峰一条带锯齿的山脊；先填雪色，背光一面（右侧，柔光来自左上方的亮天）淡淡压灰，
    // 再顺着坡向画露出雪面的岩脊（细长渐尖的笔触，背光面多而深，迎光面少而淡），山脚入雾
    function snowPeak(g, P, T) {
      const r = rng(P.seed * 7717);
      const hgt = P.base - P.top;
      const hl = P.hw * (P.l || 1), hr = P.hw * (P.r || 1);
      const prof = (x) => {
        const d = x < P.cx ? (P.cx - x) / hl : (x - P.cx) / hr;
        if (d >= 1) return P.base;
        // 峰顶圆润一些（中国山水的峰，不是尖刀）
        let f = 0.55 * Math.pow(1 - d, 1.3) * (1 + 0.3 * d) + 0.45 * Math.pow(Math.max(0, 1 - d * d), 1.6);
        f += 0.07 * (noise1(x * 0.045, P.seed) - 0.5) + 0.03 * (noise1(x * 0.16, P.seed + 2) - 0.5);
        f += (P.sh || 0) * Math.exp(-Math.pow((d - 0.45) / 0.12, 2)) * (x > P.cx ? 1 : 0.6);
        return P.base - hgt * Math.max(0, Math.min(1.02, f));
      };
      const x0 = P.cx - hl, x1 = P.cx + hr, pts = [];
      for (let x = x0; x <= x1; x += 3) pts.push([x, prof(x)]);
      const sil = new Path2D();
      sil.moveTo(x0, P.base + 40);
      for (const q of pts) sil.lineTo(q[0], q[1]);
      sil.lineTo(x1, P.base + 40); sil.closePath();
      g.fillStyle = T.snow; g.fill(sil);
      g.save(); g.clip(sil);
      // 背光面：山脊线（主脊）从峰顶弯弯地落到山脚，右侧压一层淡灰
      const spine = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12; spine.push([P.cx + hr * 0.12 * u + 10 * (noise1(u * 3, P.seed + 5) - 0.5) * u, P.top + hgt * u + 2]); }
      const shade = new Path2D();
      shade.moveTo(spine[0][0], spine[0][1] - 4);
      for (const q of spine) shade.lineTo(q[0], q[1]);
      shade.lineTo(x1 + 4, P.base + 40); shade.lineTo(x1 + 4, P.top - 10); shade.closePath();
      const sg = g.createLinearGradient(0, P.top, 0, P.base);
      sg.addColorStop(0, rgba(T.shade, 0.75)); sg.addColorStop(0.6, rgba(T.shade, 0.35)); sg.addColorStop(1, rgba(T.shade, 0.1));
      g.fillStyle = sg; g.fill(shade);
      // 岩脊
      // 岩脊一笔：起笔沿坡向，越往下越趋于铅垂（略带弧度），由粗到细
      const rib = (sx, sy, dx, dy, L, w0, col, a, bend) => {
        const n = 8, left = [], right = [], a0 = Math.atan2(dx, dy);
        let cx = sx, cy = sy;
        for (let k = 0; k <= n; k++) {
          const u = k / n, aa = a0 * (1 - (bend || 0) * u);
          if (k) { const am = a0 * (1 - (bend || 0) * (u - 0.5 / n)); cx += Math.sin(am) * L / n; cy += Math.cos(am) * L / n; }
          const ex = Math.sin(aa), ey = Math.cos(aa);
          const wob = 2 * (noise1(sx * 0.1 + u * 2, P.seed + 9) - 0.5) * u;
          const x = cx + wob, y = cy;
          const w = w0 * Math.pow(1 - u, 0.8) + 0.15;
          left.push([x - w * ey, y + w * ex]); right.push([x + w * ey, y - w * ex]);
        }
        g.fillStyle = col; g.globalAlpha = a;
        g.beginPath(); g.moveTo(left[0][0], left[0][1]);
        for (const q of left) g.lineTo(q[0], q[1]);
        for (let k = right.length - 1; k >= 0; k--) g.lineTo(right[k][0], right[k][1]);
        g.closePath(); g.fill();
      };
      for (const q of pts) {
        const [x, y] = q;
        const side = x > P.cx ? 1 : -1;
        const dens = side > 0 ? 0.42 : 0.2;
        if (r() > dens) continue;
        const depth = P.base - y;
        if (depth < hgt * 0.08) continue;
        const L = depth * (0.18 + 0.4 * r());
        // 方向随离峰顶的远近平滑变化（近峰顶较陡、近山脚较斜），相邻两笔几乎平行，不会交叉
        const dd = Math.abs(x - P.cx) / (side > 0 ? hr : hl);
        const ang = side * (0.3 + 0.32 * dd + 0.08 * (r() - 0.5));
        const dx = Math.sin(ang), dy = Math.cos(ang);
        rib(x, y + 1.5, dx, dy, L, (0.7 + 1.6 * r()) * (P.k || 1), r() < 0.55 ? T.rib : T.rib2, side > 0 ? 0.45 + 0.4 * r() : 0.22 + 0.25 * r(), 0.28);
      }
      // 主脊上的岩石
      for (let k = 1; k < spine.length - 2; k++) {
        if (r() < 0.35) continue;
        const q = spine[k];
        rib(q[0], q[1], 0.3 + 0.3 * r(), 1, hgt * (0.08 + 0.12 * r()), (0.8 + 1.4 * r()) * (P.k || 1), T.rib2, 0.4 + 0.3 * r());
      }
      g.globalAlpha = 1;
      // 山脚入雾
      const mg = g.createLinearGradient(0, P.base - hgt * 0.5, 0, P.base);
      mg.addColorStop(0, rgba(T.haze, 0)); mg.addColorStop(1, rgba(T.haze, T.hazeA == null ? 0.95 : T.hazeA));
      g.fillStyle = mg; g.fillRect(x0 - 2, P.base - hgt * 0.5, x1 - x0 + 4, hgt * 0.5 + 42);
      g.restore();
    }
    // 远山、近山、远岸各自缓存（比画面宽，留出平移余量）
    const PADX = 140;
    const farTex = () => K.cache('fg5_x3_far', W + PADX, 330, 1, (g) => {
      g.translate(0, -140);
      const T = { snow: '#e4e8ea', shade: '#c3cbd0', rib: '#aab3b9', rib2: '#98a2a9', haze: '#eef0f0', hazeA: 0.95 };
      for (const P of [
        { cx: 250, top: 198, hw: 260, base: 440, seed: 1, k: 0.8 }, { cx: 560, top: 232, hw: 210, base: 440, seed: 2, k: 0.8, sh: 0.15 },
        { cx: 820, top: 176, hw: 250, base: 440, seed: 3, k: 0.8, l: 1.2 }, { cx: 1120, top: 214, hw: 230, base: 440, seed: 4, k: 0.8 },
        { cx: 1360, top: 240, hw: 200, base: 440, seed: 5, k: 0.8 },
      ]) snowPeak(g, P, T);
      // 大雪里远山隐约：整体再罩一层雪雾（只罩在山上，不留矩形边）
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(236,238,238,0.45)'; g.fillRect(0, 140, W + PADX, 310);
      g.globalCompositeOperation = 'source-over';
    });
    const midTex = () => K.cache('fg5_x3_mid', W + PADX, 300, 1, (g) => {
      g.translate(0, -160);
      const T = { snow: '#f2f3f3', shade: '#b9c2c8', rib: '#6f787e', rib2: '#4f585e', haze: '#f0f1f1', hazeA: 0.92 };
      for (const P of [
        { cx: 60, top: 236, hw: 230, base: 436, seed: 11, sh: 0.12 }, { cx: 300, top: 300, hw: 190, base: 436, seed: 12, l: 0.8 },
        { cx: 470, top: 352, hw: 130, base: 436, seed: 13 },
        { cx: 1010, top: 318, hw: 170, base: 436, seed: 14 }, { cx: 1220, top: 258, hw: 240, base: 436, seed: 15, sh: 0.1 },
        { cx: 1380, top: 300, hw: 160, base: 436, seed: 16 },
      ]) snowPeak(g, P, T);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(238,240,240,0.22)'; g.fillRect(0, 160, W + PADX, 300);
      g.globalCompositeOperation = 'source-over';
    });
    // 远岸：贴着江面的一道低矮雪岸，几簇枯树
    const shoreTex = () => K.cache('fg5_x3_shore', W + PADX, 40, 1, (g) => {
      g.translate(0, -404);
      const r = rng(5151);
      g.fillStyle = '#e8ebec';
      g.beginPath(); g.moveTo(-10, RIV0 + 2);
      for (let x = -10; x <= W + PADX + 10; x += 6) g.lineTo(x, RIV0 - 3 - 4 * noise1(x * 0.02, 3) - (x > 300 && x < 760 ? -2 : 0));
      g.lineTo(W + PADX + 10, RIV0 + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,128,134,0.55)';
      g.fillRect(-10, RIV0 - 0.5, W + PADX + 20, 1.2);
      g.strokeStyle = 'rgba(96,104,110,0.6)'; g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const x = i < 4 ? 40 + r() * 230 : 880 + r() * 420, h = 8 + 10 * r();
        g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, RIV0 - 3); g.lineTo(x + 0.6, RIV0 - 3 - h); g.stroke();
        for (let k = 0; k < 4; k++) { const yy = RIV0 - 3 - h * (0.4 + 0.15 * k), d = (r() < 0.5 ? -1 : 1) * (2 + 3 * r()); g.lineWidth = 0.6; g.beginPath(); g.moveTo(x + 0.3, yy); g.lineTo(x + d, yy - 2 - 2 * r()); g.stroke(); }
      }
    });
    // 近岸：雪坡、水边湿痕、左下几块积雪的石头与两丛枯苇（雪压弯，苇梢略向右），右侧几簇露出雪面的枯草
    // 近岸线：左高右低斜着走，江面往右下方展开
    const NEAR_EDGE = (x) => 566 + 0.06 * x + 8 * noise1(x * 0.006, 8) + 4 * noise1(x * 0.021, 9) - (x < 300 ? 14 * Math.pow(1 - x / 300, 1.5) : 0);
    const nearTex = () => K.cache('fg5_x3_near', W + 200, 290, 1, (g) => {
      g.translate(0, -440);
      const r = rng(6262);
      const p = new Path2D();
      p.moveTo(-10, 760);
      for (let x = -10; x <= W + 210; x += 5) p.lineTo(x, NEAR_EDGE(x));
      p.lineTo(W + 210, 760); p.closePath();
      const gr = g.createLinearGradient(0, 560, 0, 725);
      gr.addColorStop(0, '#dde1e3'); gr.addColorStop(0.12, '#eef0f0'); gr.addColorStop(0.5, '#f3f4f4'); gr.addColorStop(1, '#e8ebec');
      g.fillStyle = gr; g.fill(p);
      g.save(); g.clip(p);
      // 雪坡起伏：几道很宽很淡的横向阴影，边缘柔
      for (let i = 0; i < 4; i++) {
        const y = 610 + i * 28 + 10 * r(), x = r() * (W + 200);
        const sg = g.createRadialGradient(x, y, 0, x, y, 420);
        sg.addColorStop(0, 'rgba(176,186,193,0.13)'); sg.addColorStop(1, 'rgba(176,186,193,0)');
        g.save(); g.translate(x, y); g.scale(1, 0.06); g.translate(-x, -y);
        g.fillStyle = sg; g.fillRect(x - 420, y - 420, 840, 840); g.restore();
      }
      // 水边：一道深色湿痕
      g.strokeStyle = 'rgba(70,78,84,0.5)'; g.lineWidth = 1.6;
      g.beginPath();
      for (let x = -10; x <= W + 210; x += 5) { const y = NEAR_EDGE(x) + 0.8; x === -10 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
      g.restore();
      // 石头：半没在水边，顶上压着雪（雪只在朝上的面）
      const stone = (x, y, w, h, seed) => {
        const rr = rng(seed), pts = [];
        for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; const q = 0.85 + 0.25 * rr(); pts.push([x + Math.cos(a) * w / 2 * q, y + Math.sin(a) * h * q]); }
        const sp = new Path2D(); sp.moveTo(x - w / 2, y + 3); for (const q of pts) sp.lineTo(q[0], q[1]); sp.lineTo(x + w / 2, y + 3); sp.closePath();
        g.fillStyle = '#3a3f44'; g.fill(sp);
        g.save(); g.clip(sp);
        g.fillStyle = '#2b3034'; g.fillRect(x, y - h * 1.3, w, h * 1.4);
        g.fillStyle = '#f2f3f3';
        g.beginPath(); g.moveTo(x - w / 2 - 2, y - h * 0.45);
        for (let k = 0; k <= 8; k++) { const u = k / 8, xx = x - w / 2 + u * w; g.lineTo(xx, y - h * (0.42 + 0.12 * Math.sin(u * 9 + seed)) - h * 0.5 * Math.sin(Math.PI * u) * 0.35); }
        g.lineTo(x + w / 2 + 2, y - h * 1.4); g.lineTo(x - w / 2 - 2, y - h * 1.4); g.closePath(); g.fill();
        g.restore();
        // 雪顶比石头略鼓
        g.fillStyle = '#f4f5f5';
        g.beginPath(); g.ellipse(pts[5][0], pts[5][1] + 1, w * 0.36, 3.2, 0, Math.PI, TAU); g.fill();
      };
      stone(48, NEAR_EDGE(48) + 6, 64, 24, 1); stone(122, NEAR_EDGE(122) + 8, 38, 14, 2); stone(232, NEAR_EDGE(232) + 7, 30, 11, 3);
      // 枯苇：细茎顺风弯向右，几片下垂的窄叶，梢头残穗下垂；朝上的叶背与穗顶积一点雪
      const reed = (x, y, h, lean, seed) => {
        const rr = rng(seed);
        const tx = x + lean, ty = y - h;
        const col = rr() < 0.5 ? '#6f675b' : '#5c554b';
        g.strokeStyle = col; g.lineCap = 'round';
        g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.15, y - h * 0.55, tx, ty); g.stroke();
        const at = (u) => { const m = 1 - u; return [x * m * m + 2 * (x + lean * 0.15) * m * u + tx * u * u, y * m * m + 2 * (y - h * 0.55) * m * u + ty * u * u]; };
        const nl = 2 + ((rr() * 2) | 0);
        for (let k = 0; k < nl; k++) {
          const u = 0.25 + 0.5 * (k / nl) + 0.08 * rr(), p = at(u);
          const L = 16 + 16 * rr(), dir = rr() < 0.75 ? 1 : -1;
          const ex = p[0] + dir * L * 0.9, ey = p[1] + L * (0.25 + 0.3 * rr());
          g.fillStyle = col;
          g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + dir * L * 0.5, p[1] - L * 0.25, ex, ey);
          g.quadraticCurveTo(p[0] + dir * L * 0.45, p[1] - L * 0.12, p[0], p[1] + 1.6); g.fill();
          if (dir > 0 && rr() < 0.6) { g.strokeStyle = 'rgba(248,249,249,0.95)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(p[0] + dir * L * 0.2, p[1] - L * 0.08); g.quadraticCurveTo(p[0] + dir * L * 0.45, p[1] - L * 0.2, p[0] + dir * L * 0.62, p[1] - L * 0.12); g.stroke(); g.strokeStyle = col; }
        }
        // 残穗：几缕细丝从梢头顺风垂下
        g.strokeStyle = 'rgba(150,140,124,0.75)'; g.lineWidth = 0.7;
        for (let k = 0; k < 6; k++) { const L = 7 + 6 * rr(); g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + L * 0.6, ty - 1 + k * 0.4, tx + L * (0.7 + 0.2 * rr()), ty + L * (0.35 + 0.35 * rr())); g.stroke(); }
        g.fillStyle = 'rgba(248,249,249,0.95)'; g.beginPath(); g.ellipse(tx + 1.5, ty - 0.8, 2.6, 1.3, 0.25, 0, TAU); g.fill();
      };
      const clump = (cx, spread, n, h0, h1, seed) => {
        const rr = rng(seed);
        for (let i = 0; i < n; i++) { const x = cx + (rr() - 0.5) * spread; reed(x, NEAR_EDGE(x) + 22 + rr() * 14, lerp(h0, h1, rr()), 10 + 16 * rr(), seed * 100 + i); }
      };
      clump(46, 96, 22, 90, 170, 71);
      clump(182, 54, 11, 55, 110, 72);
      // 根部积雪
      g.fillStyle = '#f2f3f3';
      for (const [x, w] of [[22, 34], [62, 40], [100, 26], [170, 28], [196, 20]]) { const y = NEAR_EDGE(x) + 34; g.beginPath(); g.ellipse(x, y, w, 8, 0, Math.PI, TAU); g.fill(); }
      // 右侧露出雪面的枯草
      const tuft = (x, y, n, h, seed) => { const rr = rng(seed); g.strokeStyle = '#7a7266'; for (let i = 0; i < n; i++) { const a = -0.5 + rr() * 1.1 + 0.15, hh = h * (0.5 + 0.5 * rr()); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + (rr() - 0.5) * 6, y); g.quadraticCurveTo(x + Math.sin(a) * hh * 0.4, y - hh * 0.6, x + Math.sin(a) * hh + 3, y - hh); g.stroke(); } };
      tuft(1130, 672, 9, 16, 81); tuft(1210, 700, 7, 12, 82); tuft(1300, 684, 8, 14, 83);
    });

    // 乌篷顶的积雪：沿篷拱顶部，平处厚、两端陡处薄（船的单位坐标：船长 = 1，原点船板中点）
    const AWN_TOP = [[-0.285, 0.0], [-0.276, -0.052], [-0.252, -0.1], [-0.205, -0.133], [-0.13, -0.149], [-0.05, -0.146], [0.02, -0.131], [0.07, -0.098], [0.094, -0.05], [0.1, 0.0]].map((p) => [p[0], p[1] * 1.25]);
    const SNOW_CAP = (() => {
      const top = (x) => {
        for (let i = 0; i < AWN_TOP.length - 1; i++) {
          const a = AWN_TOP[i], b = AWN_TOP[i + 1];
          if (x >= a[0] && x <= b[0]) { const u = (x - a[0]) / (b[0] - a[0]), uu = u * u * (3 - 2 * u); return [a[1] + (b[1] - a[1]) * (0.5 * u + 0.5 * uu), (b[1] - a[1]) / (b[0] - a[0])]; }
        }
        return [0, 0];
      };
      const p = new Path2D(), topL = new Path2D(), up = [], dn = [];
      for (let x = -0.264; x <= 0.086; x += 0.003) {
        const [y, sl] = top(x);
        const th = 0.026 * Math.pow(Math.max(0, 1 - Math.abs(sl) / 1.3), 1.3) * (1 + 0.12 * Math.sin(x * 90) + 0.08 * Math.sin(x * 233 + 1.3)) + 0.002;
        up.push([x, y - th]); dn.push([x, y + 0.0018]);
      }
      // 篷顶两端的雪沿篷面往下挂一点，圆收
      smoothPath(p, up.concat(dn.slice().reverse()), true);
      smoothPath(topL, up, false);
      // 船舷上沿的积雪（露在篷外的两段，船头一段沿上翘的船舷收薄到船头）：4–5 px 厚，起伏
      const gun = [[-0.5, -0.066], [-0.44, -0.042], [-0.36, -0.03], [-0.2, -0.023], [0, -0.022], [0.2, -0.024], [0.34, -0.034], [0.43, -0.054], [0.5, -0.088]];
      const gy = (x) => { for (let i = 0; i < gun.length - 1; i++) { const a = gun[i], b = gun[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return 0; };
      for (const [x0, x1, k] of [[-0.48, -0.296, 0.8], [0.106, 0.488, 1]]) {
        const tp = [], bt = [];
        for (let x = x0; x <= x1 + 1e-9; x += 0.006) {
          const u = (x - x0) / (x1 - x0);
          const sl = Math.abs((gy(x + 0.004) - gy(x - 0.004)) / 0.008);
          const th = k * 0.0145 * Math.pow(Math.sin(Math.PI * clamp(u * 1.08 - 0.04)), 0.45) * Math.max(0.25, 1 - sl * 1.1) * (1 + 0.16 * Math.sin(x * 140 + k) + 0.1 * Math.sin(x * 310));
          tp.push([x, gy(x) - th - 0.0008]); bt.push([x, gy(x) + 0.0018]);
        }
        smoothPath(p, tp.concat(bt.reverse()), true);
        smoothPath(topL, tp, false);
      }
      return { body: p, top: topL };
    })();
    // 斗笠上的雪（人物坐标，坐面为原点，单位 = 身高/100，朝右）：顺着笠面，笠顶两侧厚约 3.5、到笠沿收薄
    const HAT_CAP = (() => {
      const crown = [[-15.0, -43.8], [-8.4, -46.8], [-1.0, -49.0], [2.0, -52.4], [3.45, -55.1], [5.2, -52.2], [8.0, -49.0], [14.0, -45.8], [19.4, -42.8]];
      const n = crown.length, tp = [], bt = [];
      for (let i = 0; i < n; i++) {
        const a = crown[Math.max(0, i - 1)], b = crown[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = ty, ny = -tx; if (ny > 0) { nx = -nx; ny = -ny; }
        const s = i / (n - 1), th = 0.5 + 3.2 * Math.pow(Math.sin(Math.PI * (0.04 + 0.92 * s)), 0.75) * (i === 4 ? 0.8 : 1) * (1 + 0.08 * Math.sin(i * 2.3));
        tp.push([crown[i][0] + nx * th, crown[i][1] + ny * th]); bt.push([crown[i][0] - nx * 0.5, crown[i][1] - ny * 0.5]);
      }
      return { body: smoothPath(new Path2D(), tp.concat(bt.reverse()), true), top: smoothPath(new Path2D(), tp, false) };
    })();

    // 大雪三层，风向右（约 11° 斜落，阵风让横向速度缓慢起伏）：
    //   远层：细小的灰色雪点——在亮的阴天里，远处的雪片逆着天光看是比天暗的灰点；落到远处江面前淡出
    //   中层：白色雪片带一圈很淡的灰边，亮天、白山、深色江面上都看得见
    //   近层：少量虚化的前景大雪片（白芯、淡灰晕），避开小舟与歌词带
    // 每片都从画面上方以外落入，到各自的“地面”前用约 0.5 秒淡出；同屏小粒子共 264 片
    const SNOW = [
      { n: 150, s0: 1.5, s1: 2.3, v0: 24, v1: 34, par: 0.35, a0: 0.42, a1: 0.66, land0: 430, land1: 478, seed: 1, kind: 'far' },
      { n: 96, s0: 2.6, s1: 4.2, v0: 46, v1: 64, par: 0.75, a0: 0.82, a1: 1, land0: 486, land1: 612, seed: 2, kind: 'mid' },
      { n: 18, s0: 6, s1: 9.5, v0: 86, v1: 112, par: 1.6, a0: 0.34, a1: 0.48, land0: 560, land1: 600, seed: 4, kind: 'near' },
    ];
    const DRIFT = 0.2;
    for (const L of SNOW) {
      const r = rng(L.seed * 4241);
      L.f = [];
      for (let i = 0; i < L.n; i++) L.f.push({ x: r(), y: r(), s: lerp(L.s0, L.s1, r()), v: lerp(L.v0, L.v1, r()), a: lerp(L.a0, L.a1, r()), land: lerp(L.land0, L.land1, r()), sw: 2 + 6 * r(), sf: 0.18 + 0.35 * r(), ph: r() * TAU });
    }
    // 前景虚化雪片：白芯、软边，外圈一道很淡的灰晕（亮天上读作淡灰的光斑，深色江面上读作白斑）
    const bokehTex = () => K.cache('fg5_x3_bokeh', 64, 64, 0.5, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(250,251,251,0.75)'); gr.addColorStop(0.68, 'rgba(176,184,190,0.42)');
      gr.addColorStop(0.86, 'rgba(150,158,165,0.16)'); gr.addColorStop(1, 'rgba(150,158,165,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    function drawSnow(g, L, t, camX) {
      const span = W + 80;
      const far = L.kind === 'far', near = L.kind === 'near';
      const bk = near ? bokehTex() : null;
      // 小舟所在的椭圆（画面坐标）：近层雪片在这里淡出，不糊在船和人上
      const bx = BX + 60 - camX, by = 440;
      for (const f of L.f) {
        const top = -24, range = f.land - top + 10;
        const yy = ((f.y * range + f.v * t) % range + range) % range + top;
        const dy = yy - top;
        const xw = f.x * span + DRIFT * f.v * t + f.sw * Math.sin(TAU * f.sf * t + f.ph) - camX * L.par;
        const x = ((xw % span) + span) % span - 40;
        let a = f.a * smooth(dy / 26) * (1 - smooth((yy - (f.land - 30)) / 30));
        if (near) {
          const e = Math.hypot((x - bx) / 250, (yy - by) / 85);
          a *= smooth((e - 1) / 0.45) * (1 - smooth((yy - 520) / 50));
        }
        if (a < 0.02) continue;
        g.globalAlpha = a;
        if (near) { g.drawImage(bk, x - f.s, yy - f.s, f.s * 2, f.s * 2); continue; }
        if (far) {
          // 远层：灰点；落进江口雾带、江面时渐渐转白（背景变暗，雪片相对变亮）
          const w = smooth((yy - 405) / 30);
          if (w < 0.98) { g.globalAlpha = a * (1 - w); g.fillStyle = '#8a949e'; g.beginPath(); g.arc(x, yy, f.s / 2, 0, TAU); g.fill(); }
          if (w > 0.02) { g.globalAlpha = a * w; g.fillStyle = '#e9edef'; g.beginPath(); g.arc(x, yy, f.s / 2, 0, TAU); g.fill(); }
          continue;
        }
        // 中层：先画淡灰外圈，再画白芯
        g.fillStyle = 'rgba(128,138,146,0.55)';
        g.beginPath(); g.arc(x, yy, f.s / 2 + 0.6, 0, TAU); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x, yy, f.s / 2, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }
    // 雪幕：远处更密的落雪，画成一张可无缝平铺的斜向细雪纹理，随风斜着往下滚动；只罩在远山与天上，很淡
    const VT = 256;
    const veilTex = () => K.cache('fg5_x3_veil', VT, VT, 1, (g) => {
      const r = rng(9393);
      g.lineCap = 'round';
      for (let i = 0; i < 300; i++) {
        const x = r() * VT, y = r() * VT, L = 2.5 + 4.5 * r(), w = 0.7 + 0.7 * r();
        const grey = r() < 0.62;
        g.strokeStyle = grey ? `rgba(126,136,144,${0.3 + 0.35 * r()})` : `rgba(255,255,255,${0.5 + 0.4 * r()})`;
        g.lineWidth = w;
        for (const ox of [-VT, 0, VT]) for (const oy of [-VT, 0, VT]) {
          const px = x + ox, py = y + oy;
          if (px < -10 || px > VT + 10 || py < -10 || py > VT + 10) continue;
          g.beginPath(); g.moveTo(px - DRIFT * L * 0.5, py - L * 0.5); g.lineTo(px + DRIFT * L * 0.5, py + L * 0.5); g.stroke();
        }
      }
    });
    function drawVeil(g, t, camX) {
      const S = SS(), q = 0.5, x0 = -20, y0 = 96, w = W + 40, h = 352;
      const pw = Math.ceil(w * S * q), ph = Math.ceil(h * S * q);
      const R = rawCanvas('fg5_x3_veilL', pw, ph);
      const vg = R.g;
      vg.setTransform(S * q, 0, 0, S * q, -x0 * S * q, -y0 * S * q);
      const tile = veilTex();
      // 两层：一层慢而淡、一层略快，错开平铺的接缝
      for (const [v, sc, al, ox0] of [[38, 1, 0.75, 0], [58, 1.35, 0.6, 97]]) {
        const T = VT * sc;
        const ox = ((ox0 + DRIFT * v * t - camX * 0.3) % T + T) % T, oy = ((v * t) % T + T) % T;
        vg.globalAlpha = al;
        for (let yy = y0 - T + oy; yy < y0 + h; yy += T) for (let xx = x0 - T + ox; xx < x0 + w; xx += T) vg.drawImage(tile, xx, yy, T, T);
      }
      vg.globalAlpha = 1;
      // 上（天上）淡、远山处最浓、到江口雾带收掉
      vg.globalCompositeOperation = 'destination-in';
      const m = vg.createLinearGradient(0, y0, 0, y0 + h);
      m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.22, 'rgba(0,0,0,0.55)'); m.addColorStop(0.6, 'rgba(0,0,0,1)'); m.addColorStop(0.86, 'rgba(0,0,0,0.8)'); m.addColorStop(1, 'rgba(0,0,0,0)');
      vg.fillStyle = m; vg.fillRect(x0, y0, w, h);
      vg.globalCompositeOperation = 'source-over';
      g.save(); g.globalAlpha = 0.5;
      g.drawImage(R.c, 0, 0, pw, ph, x0, y0, w, h);
      g.restore();
    }

    // 涟漪：江面上的椭圆环，从中心扩散、变淡
    function ripple(g, x, y, tau, k) {
      if (tau < 0 || tau > 3.2) return;
      for (let j = 0; j < 3; j++) {
        const u = tau - j * 0.32;
        if (u <= 0) continue;
        const rr = (5 + 30 * (1 - Math.exp(-u / 1.1))) * k;
        const a = 0.62 * smooth(u / 0.12) * Math.exp(-u / 1.1) * (1 - j * 0.25);
        if (a < 0.01) continue;
        g.lineWidth = 1.1;
        g.strokeStyle = `rgba(214,220,224,${a})`;
        g.beginPath(); g.ellipse(x, y, rr, rr * 0.2, 0, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(30,35,38,${a * 0.6})`;
        g.beginPath(); g.ellipse(x, y + 1.2, rr * 0.97, rr * 0.2, 0, 0, Math.PI); g.stroke();
      }
    }

    XYT.registerShot('x3_fishing', {
      name: '寒江独钓', zone: 'bottom', night: false, text: '#2a2f33', shadow: 'rgba(246,247,247,0.9)', accent: '#7d8a96', bloom: 0.18,
      draw(g, c) {
        const t = c.lt;
        // 镜头：极缓右移，全程（含淡入）约 68 px，缓入缓出，峰值约 15 px/s
        const camX = 68 * smooth((t + 1) / (c.dur + 1));
        // 天：阴天雪光，像一层极淡的灰墨渲染，上略暗下略亮（白山与白雪片衬在上面才看得出）
        const sky = g.createLinearGradient(0, 0, 0, RIV0);
        sky.addColorStop(0, '#d2d7da'); sky.addColorStop(0.55, '#e2e5e6'); sky.addColorStop(1, '#eff1f0');
        g.fillStyle = sky; g.fillRect(-20, -20, W + 40, RIV0 + 24);
        g.drawImage(farTex(), -camX * 0.22 - 20, 140, W + PADX, 330);
        g.drawImage(midTex(), -camX * 0.5 - 30, 160, W + PADX, 300);
        // 远处更密的雪幕
        drawVeil(g, t, camX);
        // 江口雾带：山脚与水线之间一条柔白的雾，乌篷的深色剪影衬在雾前
        const fog = g.createLinearGradient(0, 356, 0, 446);
        fog.addColorStop(0, 'rgba(243,244,243,0)'); fog.addColorStop(0.45, 'rgba(243,244,243,0.6)'); fog.addColorStop(0.78, 'rgba(243,244,243,0.94)'); fog.addColorStop(1, 'rgba(243,244,243,0.7)');
        g.fillStyle = fog; g.fillRect(-20, 356, W + 40, 90);

        // ---- 江面 ----
        const rv = g.createLinearGradient(0, RIV0, 0, 680);
        rv.addColorStop(0, '#a3aaae'); rv.addColorStop(0.1, '#7f888d'); rv.addColorStop(0.4, '#555d62'); rv.addColorStop(1, '#353b3f');
        g.fillStyle = rv; g.fillRect(-20, RIV0, W + 40, 700 - RIV0);
        // 远岸的淡倒影（压扁、很淡）
        g.save(); g.globalAlpha = 0.18;
        g.translate(0, 2 * RIV0); g.scale(1, -0.6);
        g.drawImage(shoreTex(), -camX * 0.78 - 30, RIV0 - 10, W + PADX, 30);
        g.restore();
        g.drawImage(shoreTex(), -camX * 0.78 - 30, 404, W + PADX, 40);
        // 水纹：随水流缓缓右移的淡色横线，越近越长越疏
        g.save();
        for (let i = 0; i < 46; i++) {
          const u = h2(i, 301), y = RIV0 + 6 + u * u * (650 - RIV0);
          const len = 18 + 90 * u * (0.5 + h2(i, 302));
          const x = ((h2(i, 303) * 1500 + 7 * t * (0.4 + u) - camX) % 1500 + 1500) % 1500 - 110;
          g.globalAlpha = 0.1 + 0.12 * (1 - u);
          g.fillStyle = h2(i, 304) < 0.6 ? '#d6dbde' : '#2c3236';
          g.fillRect(x, y, len, 0.8 + u * 0.8);
        }
        g.restore();
        // 远岸下的江面上沿还留一线薄雾
        const fog2 = g.createLinearGradient(0, RIV0, 0, RIV0 + 18);
        fog2.addColorStop(0, 'rgba(236,238,238,0.45)'); fog2.addColorStop(1, 'rgba(236,238,238,0)');
        g.fillStyle = fog2; g.fillRect(-20, RIV0, W + 40, 18);
        // 小舟四周的江水略深一些（约 8%），船的剪影更醒目
        {
          const cx = BX + 50 - camX, cy = YWL + 14;
          g.save(); g.translate(cx, cy); g.scale(1, 0.24);
          const dk = g.createRadialGradient(0, 0, 0, 0, 0, 330);
          dk.addColorStop(0, 'rgba(18,22,26,0.1)'); dk.addColorStop(0.55, 'rgba(18,22,26,0.06)'); dk.addColorStop(1, 'rgba(18,22,26,0)');
          g.fillStyle = dk; g.fillRect(-330, -330, 660, 660);
          g.restore();
        }
        // 远处的雪落进江面前淡出
        drawSnow(g, SNOW[0], t, camX);

        // ---- 船与人（设备坐标子层，翻转出倒影）----
        g.save();
        g.translate(-camX, 0);
        const m0 = g.getTransform();
        const L = devLayer('fg5_x3_boat', m0, BX - BL / 2 - 8, 380, MX + 150, YWL + 22);
        const lg = L.g;
        // 起伏减半：先抵消一半的升降与摇摆（船与人用同一个变换）
        const bm = XYT.sil.boatMotion(BX, BY, BL, t);
        lg.translate(bm.px, bm.py); lg.rotate(-bm.rot * 0.5); lg.translate(-bm.px, -bm.py);
        lg.translate(0, -bm.dy * 0.5);
        const body = '#2f2e2b';
        const mb = XYT.sil.boat(lg, BX, BY, BL, t, { awning: true, facing: -1, layer: 'back', body });
        const fo = { facing: 1, wind: WIND, windDir: 1, snow: 1, body: '#2a2d31', boat: mb, rim: null };
        XYT.sil.draw(lg, 'old', 'fishSit', MX, BY, MH, t, Object.assign({ line: 'skip' }, fo));
        XYT.sil.boat(lg, BX, BY, BL, t, { awning: true, facing: -1, layer: 'front', body });
        // 篷顶、船舷、船头与斗笠上的积雪（随船起伏）：厚而起伏的雪帽，底下一道淡灰的阴面，上沿一线淡墨勾边，衬在白雾前也读得出
        lg.save();
        lg.translate(mb.px, mb.py + mb.dy); lg.rotate(mb.rot); lg.translate(-mb.px, -mb.py);
        lg.save();
        lg.translate(BX, BY); lg.scale(-BL, BL);
        lg.fillStyle = '#aeb6bc'; lg.fill(SNOW_CAP.body);
        lg.translate(0, -0.0022);
        lg.fillStyle = '#f6f7f7'; lg.fill(SNOW_CAP.body);
        lg.strokeStyle = 'rgba(112,122,130,0.75)'; lg.lineWidth = 0.9 / BL; lg.lineJoin = 'round'; lg.stroke(SNOW_CAP.top);
        lg.restore();
        // 斗笠：沿笠面加一层 3–4 px 的雪（人物坐标：坐面为原点，单位 = 身高/100）
        lg.translate(MX, BY); lg.scale(MH / 100, MH / 100);
        lg.fillStyle = '#b8c0c5'; lg.fill(HAT_CAP.body);
        lg.translate(0, -0.35);
        lg.fillStyle = '#f6f7f7'; lg.fill(HAT_CAP.body);
        lg.strokeStyle = 'rgba(112,122,130,0.7)'; lg.lineWidth = 0.8; lg.lineJoin = 'round'; lg.stroke(HAT_CAP.top);
        lg.restore();
        XYT.sil.draw(lg, 'old', 'fishSit', MX, BY, MH, t, Object.assign({ line: 'only' }, fo));
        // 倒影：水线以上的部分按水线翻转，淡、偏冷、横向波纹
        reflectLayer(g, L, m0, YWL, t);
        // 船身与水面的接触线（一道很细的亮线）
        g.fillStyle = 'rgba(200,206,210,0.35)'; g.fillRect(BX - BL * 0.43, YWL + 0.5 - bm.dy * 0.5, BL * 0.86, 1);
        // 强拍：钓线入水处一圈小涟漪
        const lineX = MX + 121.7 * MH / 100 + 1.6 * WIND;
        for (const td of downsIn(c, -1.2, c.dur)) ripple(g, lineX, YWL + 0.5, t - td, 1.25);
        // 钓线入水处常有的一点细纹
        g.strokeStyle = 'rgba(210,216,220,0.25)'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(lineX, YWL + 0.5, 3 + 0.6 * Math.sin(t * 2.1), 0.7, 0, 0, TAU); g.stroke();
        putLayer(g, L);
        g.restore();

        // ---- 中层雪、近岸、近雪、前景大雪 ----
        drawSnow(g, SNOW[1], t, camX);
        g.drawImage(nearTex(), -camX * 1.3 - 40, 440, W + 200, 290);
        drawSnow(g, SNOW[2], t, camX);
        drawSnow(g, SNOW[3], t, camX);
      },
    });

    // 子层倒影：只取水线以上的行，按水线翻转；压暗、偏冷、横向波纹
    function reflectLayer(g, L, m, yw, t) {
      const ywd = m.d * yw + m.f;
      const hd = Math.floor(ywd - L.dy);
      if (hd <= 0) return;
      const R = rawCanvas('fg5_x3_refl', L.pw, hd);
      R.g.drawImage(L.c, 0, 0, L.pw, hd, 0, 0, L.pw, hd);
      R.g.globalCompositeOperation = 'source-atop';
      R.g.fillStyle = '#3a4248'; R.g.globalAlpha = 0.5; R.g.fillRect(0, 0, L.pw, hd);
      g.save();
      g.setTransform(1, 0, 0, -1, 0, 2 * ywd);
      g.globalAlpha = 0.3;
      const strip = Math.max(1, Math.round(2 * m.d));
      for (let yd = 0; yd < hd; yd += strip) {
        const yl = yd / m.d;
        const amp = 0.6 + yl * 0.05;
        const off = amp * (0.6 * Math.sin(yl * 0.42 + t * 1.7) + 0.4 * Math.sin(yl * 0.17 - t * 1.2 + 1)) * m.a;
        const sy = hd - yd - strip;
        if (sy < 0) break;
        g.globalAlpha = 0.3 * (1 - yl / 70);
        if (g.globalAlpha <= 0.01) break;
        g.drawImage(R.c, 0, sy, L.pw, strip, L.dx + off, ywd - yd - strip, L.pw, strip);
      }
      g.restore();
    }
  })();

  // ============================================================
  // d3_pass 雪关残旗：冬日日落后的蓝调，雪岭古关；余晖从低到高一根根退出空旗杆，最后只剩烽台残旗与老人
  // ============================================================
  (function () {
    const FB0 = [0.246, 0.666, 1.046, 1.366, 1.886, 2.266, 2.706];
    const FB1 = [3.606, 3.966, 4.346, 4.666, 5.246, 5.586, 6.086];
    const WARM = '#f2a65a', WARM2 = '#ffc98a';
    // 山脊（地面）与城墙：城墙沿山脊向右上爬到烽台
    const G = (x) => {
      if (x < 300) return 544 + (300 - x) * 0.15 + 4 * noise1(x * 0.02, 3);
      if (x <= 1000) return 544 - 200 * Math.pow((x - 300) / 700, 1.35);
      return 344 + 0.18 * (x - 1000) + 6 * noise1(x * 0.015, 5) * Math.min(1, (x - 1000) / 60);
    };
    const HW = (x) => 31 - 9 * clamp((x - 300) / 700);         // 墙高（近大远小）
    const WT = (x) => G(x) - HW(x);                              // 墙顶
    const WX0 = 286, WX1 = 962;                                  // 城墙两端
    const PLAT = { x0: 958, x1: 1042, top: 300 };                // 烽台
    const POLES = [340, 450, 560, 665, 765, 860].map((x, i) => ({ x, base: WT(x) + 1, h: i < 2 ? 2.77 * HW(x) : 76 - 10 * (x - 340) / 520 }));
    const FLAG = { x: 996, base: PLAT.top, h: 90 };
    // 老人站在旗杆左边，面朝西边的余晖；残旗向右（下风）垂，不会扫到他
    const MAN = { x: 976, y: PLAT.top + 1, h: 48 };
    // 雪坡上的岩石 [x, y, 宽, 高, 种子] 与石边的枯草丛 [x, y, 大小, 种子]
    const ROCKS = [[540, 652, 110, 34, 1], [642, 668, 46, 15, 2], [1150, 622, 80, 24, 3], [1236, 712, 150, 44, 4]];
    const TUFTS = [[480, 654, 1, 11], [597, 657, 0.9, 12], [626, 669, 0.7, 13], [667, 670, 0.75, 14], [1104, 624, 0.85, 15], [1197, 625, 0.8, 16], [1156, 713, 1.25, 17], [1318, 713, 1.1, 18]];
    // 地影线（画面 y，越小越高）：经过各杆梢的时刻由唱到的字决定；单调三次插值，速度连续
    function shadowY(c, t) {
      const ks = [[-0.8, 392], [0, 390], [charAt(c, 0, 1, FB1), POLES[3].base - POLES[3].h], [charAt(c, 2, 1, FB1), POLES[4].base - POLES[4].h],
        [charAt(c, 4, 1, FB1), POLES[5].base - POLES[5].h], [charAt(c, 6, 1, FB1), PLAT.top], [7.2, 296]];
      return monoCubic(ks, t);
    }
    function monoCubic(ks, t) {
      const n = ks.length;
      if (t <= ks[0][0]) return ks[0][1];
      if (t >= ks[n - 1][0]) return ks[n - 1][1];
      const d = [], m = [];
      for (let i = 0; i < n - 1; i++) d.push((ks[i + 1][1] - ks[i][1]) / (ks[i + 1][0] - ks[i][0]));
      // 端点用相邻斜率，内点用加权调和平均（Fritsch–Butland），保证单调、不过冲
      m.push(d[0]);
      for (let i = 1; i < n - 1; i++) {
        const h0 = ks[i][0] - ks[i - 1][0], h1 = ks[i + 1][0] - ks[i][0];
        m.push(d[i - 1] * d[i] <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]));
      }
      m.push(d[n - 2]);
      let i = 0;
      while (t > ks[i + 1][0]) i++;
      const h = ks[i + 1][0] - ks[i][0], u = (t - ks[i][0]) / h;
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
      return h00 * ks[i][1] + h10 * h * m[i] + h01 * ks[i + 1][1] + h11 * h * m[i + 1];
    }
    // 暖光遮罩：地影线以上为暖色，以下透明，交界羽化 ±f px
    const warmGrad = (g, ysh, col, a, f) => {
      const gr = g.createLinearGradient(0, ysh - f, 0, ysh + f);
      gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0));
      return gr;
    };

    // ---- 天空：顶部深蓝（歌词区，平稳），右侧（西）地平线上的余晖 ----
    const skyTex = () => K.cache('fg5_d3_sky', W, 480, 0.5, (g) => {
      const v = g.createLinearGradient(0, 0, 0, 480);
      v.addColorStop(0, '#1e2a44'); v.addColorStop(0.3, '#26365a'); v.addColorStop(0.62, '#3a4e72'); v.addColorStop(1, '#5a6e94');
      g.fillStyle = v; g.fillRect(0, 0, W, 480);
      // 余晖：右下方的椭圆暖光，往上渐变成淡紫再融进蓝
      g.save(); g.translate(1240, 470); g.scale(1, 0.42);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, 900);
      r.addColorStop(0, 'rgba(242,166,90,0.95)'); r.addColorStop(0.22, 'rgba(226,128,86,0.7)'); r.addColorStop(0.45, 'rgba(160,104,128,0.4)'); r.addColorStop(0.75, 'rgba(96,96,140,0.12)'); r.addColorStop(1, 'rgba(80,90,140,0)');
      g.fillStyle = r; g.fillRect(-1400, -1200, 2800, 2400);
      g.restore();
      // 歌词区（上 150）压回平稳的深蓝
      const top = g.createLinearGradient(0, 0, 0, 190);
      top.addColorStop(0, 'rgba(30,42,68,1)'); top.addColorStop(0.7, 'rgba(30,42,68,0.55)'); top.addColorStop(1, 'rgba(30,42,68,0)');
      g.fillStyle = top; g.fillRect(0, 0, W, 190);
    });

    // ---- 远山两层（蓝、雾）：西坡（右）迎着余晖的天光，东坡（左）背光 ----
    function peaksLayer(seed, base, tops, col, snow) {
      // 不带噪声的山形：用来求坡向
      const prof = (x) => {
        let y = base;
        for (const [cx, ty, hw] of tops) { const d = Math.abs(x - cx) / hw; if (d < 1) { const f = 0.55 * Math.pow(1 - d, 1.3) * (1 + 0.3 * d) + 0.45 * Math.pow(1 - d * d, 1.6); y = Math.min(y, base - (base - ty) * f); } }
        return y;
      };
      const pts = [];
      for (let x = -20; x <= W + 20; x += 4) pts.push([x, prof(x) + 3 * (noise1(x * 0.05, seed) - 0.5) + 1.5 * (noise1(x * 0.17, seed + 1) - 0.5)]);
      const path = new Path2D();
      path.moveTo(-20, 760); for (const q of pts) path.lineTo(q[0], q[1]); path.lineTo(W + 20, 760); path.closePath();
      // 受光边：只取朝西（往右下降）的坡段和峰顶，按坡度分三档，越朝西越亮；东坡没有
      const slope = (x) => (prof(x + 10) - prof(x - 10)) / 20;
      const rims = [new Path2D(), new Path2D(), new Path2D()];
      let prev = -1;
      for (let i = 0; i < pts.length - 1; i++) {
        const s = slope(pts[i][0] + 2);
        const lv = s > 0.2 ? 0 : s > 0.04 ? 1 : s > -0.1 ? 2 : -1;
        if (lv < 0) { prev = -1; continue; }
        if (lv !== prev) rims[lv].moveTo(pts[i][0], pts[i][1]);
        rims[lv].lineTo(pts[i + 1][0], pts[i + 1][1]);
        prev = lv;
      }
      const ridgeAt = (x) => { const f = (x + 20) / 4, i = clamp(Math.floor(f), 0, pts.length - 2), u = f - i; return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u; };
      return { path, rims, pts, prof, slope, ridgeAt, tops, base, col, snow, seed };
    }
    const FAR = [
      peaksLayer(31, 470, [[90, 318, 230], [330, 352, 200], [560, 376, 180], [1150, 330, 210], [1290, 356, 160]], '#4d6188', '#7d93b8'),
      peaksLayer(37, 520, [[-10, 368, 220], [220, 400, 190], [470, 430, 170], [1210, 380, 200]], '#3d5075', '#6e86ad'),
    ];
    // 由粗到细的一笔：二次曲线 P0→P1→P2，起笔宽 w0、收笔为 0
    function taper(g, P0, P1, P2, w0) {
      const L = [], R = [], n = 10;
      for (let i = 0; i <= n; i++) {
        const u = i / n, a = 1 - u;
        const x = a * a * P0[0] + 2 * a * u * P1[0] + u * u * P2[0], y = a * a * P0[1] + 2 * a * u * P1[1] + u * u * P2[1];
        let dx = 2 * a * (P1[0] - P0[0]) + 2 * u * (P2[0] - P1[0]), dy = 2 * a * (P1[1] - P0[1]) + 2 * u * (P2[1] - P1[1]);
        const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
        const hw = 0.5 * w0 * Math.pow(1 - u, 0.9) * (0.55 + 0.45 * smooth(u / 0.15));
        L.push([x - dy * hw, y + dx * hw]); R.push([x + dy * hw, y - dx * hw]);
      }
      g.beginPath(); g.moveTo(L[0][0], L[0][1]);
      for (const q of L) g.lineTo(q[0], q[1]);
      for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath(); g.fill();
    }
    // 只缓存看得见的一段：远层 y 290–520，次远层 y 350–630（再往下被山脊和城楼挡住）
    const FARY = [[290, 230], [350, 280]];
    const farTex = (k) => K.cache('fg5_d3_far' + k, W, FARY[k][1], 1, (g) => {
      g.translate(0, -FARY[k][0]);
      const L = FAR[k];
      g.fillStyle = L.col; g.fill(L.path);
      g.save(); g.clip(L.path);
      // 体积：每座峰西坡略亮、东坡一层柔和的暗面；分界是从峰顶往下略向左偏的脊线，羽化
      const bl = g.getTransform().a;
      for (const [cx, , hw] of L.tops) {
        let ax = cx, ay = L.prof(cx);
        for (let x = cx - 30; x <= cx + 30; x += 2) { const y = L.prof(x); if (y < ay) { ay = y; ax = x; } }
        const spine = (y) => ax - 0.2 * (y - ay) + 5 * (noise1(y * 0.03, L.seed + cx) - 0.5);
        const face = (side, colr, a0) => {
          const gr = g.createLinearGradient(ax, 0, ax + side * hw * 0.85, 0);
          gr.addColorStop(0, rgba(colr, a0)); gr.addColorStop(0.45, rgba(colr, a0 * 0.6)); gr.addColorStop(1, rgba(colr, 0));
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(ax, ay - 6);
          for (let y = ay; y <= L.base + 40; y += 8) g.lineTo(spine(y), y);
          g.lineTo(ax + side * hw, L.base + 40); g.lineTo(ax + side * hw, ay - 6); g.closePath(); g.fill();
        };
        g.filter = `blur(${(5.5 * bl).toFixed(1)}px)`;
        face(-1, '#1f2b48', k ? 0.24 : 0.26);
        face(1, L.snow, k ? 0.16 : 0.2);
        g.filter = 'none';
      }
      // 顺坡的冲沟：从脊线下 6 px 起笔，沿坡往下（峰左往左下、峰右往右下、鞍部和峰顶下近乎铅垂），
      // 方向随位置平滑变化、间距 10–14 px，所以互不交叉；冲沟左壁朝西，挨着一道淡淡的亮线
      const r = rng(900 + k);
      for (let x = -16 + 6 * r(); x < W + 16; x += 10 + 4 * r()) {
        const keep = r(), j0 = r(), j1 = r(), j2 = r(), j3 = r();
        if (keep < 0.28) continue;
        const ry = L.ridgeAt(x);
        if (ry > L.base - 30) continue;
        const s = L.slope(x), as = Math.abs(s), sd = s >= 0 ? 1 : -1;
        const w = 0.5 * smooth((as - 0.04) / 0.8);
        const n = Math.hypot(1, as), dx = sd / n, dy = as / n;
        const nv = (a, b) => { const m = Math.hypot(a, b); return [a / m, b / m]; };
        const d0 = nv(w * dx, 1 - w + w * dy), d1 = nv(0.4 * w * dx, 1 - 0.4 * w + 0.4 * w * dy);
        const len = (12 + 46 * Math.pow(j0, 1.4)) * (0.65 + 0.35 * clamp((L.base - ry) / 150));
        const P0 = [x, ry + 6 + 20 * j1 * j1];
        const P1 = [P0[0] + d0[0] * len * 0.5, P0[1] + d0[1] * len * 0.5];
        const P2 = [P1[0] + d1[0] * len * 0.5, P1[1] + d1[1] * len * 0.5];
        g.fillStyle = rgba('#1c2742', 0.15 + 0.15 * j2);
        taper(g, P0, P1, P2, 2.5);
        if (j3 < 0.7) {
          g.fillStyle = rgba(L.snow, 0.12 + 0.1 * j3);
          taper(g, [P0[0] - 1.8, P0[1] + 1], [P1[0] - 1.8, P1[1]], [P2[0] - 1.6, P2[1] - 2], 1.6);
        }
      }
      const mg = g.createLinearGradient(0, 360, 0, 560);
      mg.addColorStop(0, 'rgba(70,90,128,0)'); mg.addColorStop(1, 'rgba(70,90,128,0.75)');
      g.fillStyle = mg; g.fillRect(0, 360, W, 200);
      g.fillStyle = 'rgba(70,90,128,0.75)'; g.fillRect(0, 560, W, 200);
      g.restore();
    });

    // ---- 近处山脊 + 城墙 + 烽台（背光一面，蓝调）----
    const RIDGE = (() => {
      const p = new Path2D();
      p.moveTo(-30, 760);
      for (let x = -30; x <= W + 30; x += 4) p.lineTo(x, G(x));
      p.lineTo(W + 30, 760); p.closePath();
      // 城墙正面
      const wall = new Path2D();
      wall.moveTo(WX0, G(WX0) + 3);
      for (let x = WX0; x <= WX1; x += 4) wall.lineTo(x, WT(x));
      for (let x = WX1; x >= WX0; x -= 4) wall.lineTo(x, G(x) + 3);
      wall.closePath();
      // 垛口：沿墙顶，间距、大小随远近缩小
      const merl = new Path2D();
      for (let x = WX0 + 4; x < WX1 - 4;) {
        const s = HW(x) / 31, w = 5.5 * s, h = 6 * s, y = WT(x);
        merl.rect(x, y - h, w, h + 0.5);
        x += 12 * s;
      }
      // 烽台：梯形墩台，顶上一圈垛口
      const plat = new Path2D();
      plat.moveTo(PLAT.x0, G(PLAT.x0) + 4); plat.lineTo(PLAT.x0 + 6, PLAT.top); plat.lineTo(PLAT.x1 - 6, PLAT.top); plat.lineTo(PLAT.x1, G(PLAT.x1) + 4); plat.closePath();
      // 山脊（城墙之后的部分）、墙顶、烽台顶的暖光边
      const crestR = new Path2D();
      crestR.moveTo(PLAT.x1, G(PLAT.x1)); for (let x = PLAT.x1; x <= W + 30; x += 4) crestR.lineTo(x, G(x));
      const crestW = new Path2D();
      crestW.moveTo(WX0, WT(WX0)); for (let x = WX0; x <= WX1; x += 4) crestW.lineTo(x, WT(x) - 6 * HW(x) / 31);
      return { p, wall, merl, plat, crestR, crestW };
    })();
    const ridgeTex = () => K.cache('fg5_d3_ridge', W, 470, 1, (g) => {
      g.translate(0, -250);
      // 背光的雪坡：反射蓝天，近处更暗
      const gr = g.createLinearGradient(0, 330, 0, 720);
      gr.addColorStop(0, '#8196bb'); gr.addColorStop(0.3, '#6c82a9'); gr.addColorStop(1, '#3d4e73');
      g.fillStyle = gr; g.fill(RIDGE.p);
      g.save(); g.clip(RIDGE.p);
      const r = rng(4747);
      // 坡面的等高线族：v=0 贴着山脊，越往下（越近）越平
      // 山脊在烽台处有折角；往下的等高线先把山脊线按窗口平均磨圆（越往下越圆），再往平处过渡
      const Gs = (x, w) => { let a = 0, n = 0; for (let k = -w; k <= w; k += 6) { const q = 1 - Math.abs(k) / (w + 6); a += G(x + k) * q; n += q; } return a / n; };
      const CT = (x, v) => { const gs = Gs(x, Math.round(30 + 220 * v)); return gs + (770 - gs) * Math.pow(v, 1.15); };
      // 雪坡的起伏：几道顺着等高线的宽而淡的明暗（上亮下暗），像缓缓的坡坎；越近越平
      for (const [v, wdt] of [[0.22, 34], [0.48, 46], [0.78, 60]]) {
        g.save();
        g.filter = `blur(${(wdt * 0.35 * g.getTransform().a).toFixed(1)}px)`;
        g.lineWidth = wdt; g.strokeStyle = 'rgba(150,170,204,0.2)';
        g.beginPath(); for (let x = -30; x <= W + 30; x += 8) { const y = CT(x, v) - wdt * 0.25; x === -30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
        g.strokeStyle = 'rgba(30,42,68,0.18)';
        g.beginPath(); for (let x = -30; x <= W + 30; x += 8) { const y = CT(x, v) + wdt * 0.55; x === -30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
        g.restore();
      }
      const band = (A, B, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(A[0][0], A[0][1]); for (const q of A) g.lineTo(q[0], q[1]); for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]); g.closePath(); g.fill(); };
      // 风削出的雪棱：沿等高线的长弧，上沿一线亮、下面一道淡影；风往右吹，右段（下风）更厚，收尖处略往下垂
      const sast = (v, xa, xb, seed) => {
        const th = 3 + 2.4 * v, n = Math.max(8, Math.ceil((xb - xa) / 5));
        const top = [], bot = [], lit = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n, x = xa + (xb - xa) * u;
          const pr = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.8) * (0.55 + 0.45 * noise1(x * 0.018, seed + 5));
          const y = CT(x, v) + 7 * (noise1(x * 0.006, seed) - 0.5) + 3 * u * u;
          top.push([x, y]); bot.push([x, y + th * pr]); lit.push([x, y + (0.9 + 0.9 * pr) * pr]);
        }
        band(top, bot, 'rgba(47,63,98,0.12)');
        band(top, lit, 'rgba(159,178,210,0.25)');
      };
      for (const [v, xa, xb, sd] of [[0.1, 360, 640, 1], [0.15, 700, 1010, 2], [0.2, 1060, 1300, 3], [0.29, 330, 790, 4], [0.4, 840, 1250, 5],
        [0.5, 250, 470, 6], [0.62, 700, 1110, 7], [0.76, -20, 400, 8], [0.8, 760, 1080, 9]]) sast(v, xa, xb, sd);
      // 一行脚印：从城楼门口出来，贴着墙脚一路爬到烽台下；近大远小，左右脚交替
      {
        const cp = [[188, 652], [236, 660], [286, 648], [322, 618], [362, 582]];
        for (let x = 410; x <= 950; x += 60) cp.push([x, G(x) + 9.5]);
        const pl = [];
        for (let i = 0; i < cp.length - 1; i++) {
          const p0 = cp[Math.max(0, i - 1)], p1 = cp[i], p2 = cp[i + 1], p3 = cp[Math.min(cp.length - 1, i + 2)];
          for (let k = 0; k < 12; k++) {
            const u = k / 12, u2 = u * u, u3 = u2 * u;
            const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
            pl.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
          }
        }
        pl.push(cp[cp.length - 1]);
        const rf = rng(5151);
        let acc = 0, next = 0, foot = 0;
        for (let i = 1; i < pl.length; i++) {
          const [xa, ya] = pl[i - 1], [xb, yb] = pl[i], dl = Math.hypot(xb - xa, yb - ya);
          while (next <= acc + dl) {
            const u = (next - acc) / dl, x = xa + (xb - xa) * u, y = ya + (yb - ya) * u;
            const sc = 0.66 + 0.54 * clamp((y - 370) / 285);
            const tx = (xb - xa) / dl, ty = (yb - ya) / dl, sd = foot % 2 ? 1 : -1;
            const px = x - ty * sd * 1.1 * sc, py = y + tx * sd * 1.1 * sc, ang = Math.atan2(ty, tx);
            const a = 0.75 + 0.25 * rf();
            g.fillStyle = rgba('#b6c6de', 0.14 * a);
            g.beginPath(); g.ellipse(px, py + 0.9 * sc, 2 * sc, 0.75 * sc, ang, 0, TAU); g.fill();
            g.fillStyle = rgba('#26334f', 0.26 * a);
            g.beginPath(); g.ellipse(px, py, 1.9 * sc, 0.8 * sc, ang, 0, TAU); g.fill();
            foot++; next += 7.5 * sc;
          }
          acc += dl;
        }
      }
      // 露出雪面的几块岩石（顶上压雪），近处大、远处小；背风一侧（右）拖一条雪尾
      const rock = (x, y, w, h, seed) => {
        const rr = rng(seed), pts = [];
        for (let k = 0; k <= 9; k++) { const a = Math.PI + (k / 9) * Math.PI, q = 0.8 + 0.3 * rr(); pts.push([x + Math.cos(a) * w / 2 * q, y + Math.sin(a) * h * q]); }
        const rp = new Path2D(); rp.moveTo(x - w / 2, y + 4); for (const q of pts) rp.lineTo(q[0], q[1]); rp.lineTo(x + w / 2, y + 4); rp.closePath();
        // 雪尾（在石头后面先画）
        {
          const top = [], bot = [], lit = [], L = w * 1.7, n = 16;
          for (let i = 0; i <= n; i++) {
            const u = i / n, xx = x + w * 0.2 + L * u;
            const yy = y - h * 0.45 * Math.pow(1 - u, 1.6) + 4 * u;
            const th = h * 0.5 * Math.pow(1 - u, 0.9) + 1.5 * Math.sin(Math.PI * u);
            top.push([xx, yy]); bot.push([xx, yy + th]); lit.push([xx, yy + Math.min(th, 1.6)]);
          }
          band(top, bot, 'rgba(150,170,204,0.16)');
          band(bot.map((q) => [q[0], q[1] - 1]), bot.map((q, i) => [q[0], q[1] + 2.5 * (1 - i / n)]), 'rgba(47,63,98,0.1)');
          band(top, lit, 'rgba(176,194,222,0.3)');
        }
        g.fillStyle = '#26324e'; g.fill(rp);
        g.save(); g.clip(rp);
        g.fillStyle = '#b0c1db';
        g.beginPath(); g.moveTo(x - w / 2 - 2, y - h * 0.5);
        for (let k = 0; k <= 8; k++) { const u = k / 8; g.lineTo(x - w / 2 + u * w, y - h * (0.55 + 0.1 * Math.sin(u * 8 + seed)) - h * 0.35 * Math.sin(Math.PI * u)); }
        g.lineTo(x + w / 2 + 2, y - h * 1.5); g.lineTo(x - w / 2 - 2, y - h * 1.5); g.closePath(); g.fill();
        g.restore();
        // 石脚埋在雪里：一道与雪坡同色的雪堆盖住底边
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - w * 0.75, y + 6); g.quadraticCurveTo(x - w * 0.45, y - h * 0.32, x, y - h * 0.22); g.quadraticCurveTo(x + w * 0.45, y - h * 0.3, x + w * 0.8, y + 6); g.closePath(); g.fill();
      };
      for (const R of ROCKS) rock(...R);
      // 越近越暗
      const dk = g.createLinearGradient(0, 520, 0, 720);
      dk.addColorStop(0, 'rgba(24,34,58,0)'); dk.addColorStop(1, 'rgba(24,34,58,0.45)');
      g.fillStyle = dk; g.fillRect(0, 520, W, 200);
      g.restore();
      // 城墙
      g.fillStyle = '#2a3654'; g.fill(RIDGE.wall);
      g.save(); g.clip(RIDGE.wall);
      g.strokeStyle = 'rgba(70,86,118,0.45)'; g.lineWidth = 0.7;
      for (let k = 1; k < 5; k++) { g.beginPath(); for (let x = WX0; x <= WX1; x += 6) { const y = WT(x) + HW(x) * k / 5; x === WX0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      g.restore();
      g.fillStyle = '#2a3654'; g.fill(RIDGE.merl);
      // 墙顶与垛口顶的积雪（背光，偏蓝）
      g.strokeStyle = '#b4c4dc'; g.lineWidth = 1.6;
      g.beginPath(); for (let x = WX0; x <= WX1; x += 4) { const y = WT(x) - 0.2; x === WX0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
      g.fillStyle = '#b4c4dc';
      for (let x = WX0 + 4; x < WX1 - 4;) { const s = HW(x) / 31, w = 5.5 * s, h = 6 * s, y = WT(x); g.fillRect(x - 0.3, y - h - 1.4 * s, w + 0.6, 1.6 * s); x += 12 * s; }
      // 烽台
      g.fillStyle = '#28344f'; g.fill(RIDGE.plat);
    });

    // ---- 城楼（左，背光；窗格在第29句第3字亮灯）----
    const TOWER = (() => {
      const body = new Path2D();
      // 墩台
      body.moveTo(36, 640); body.lineTo(48, 470); body.lineTo(282, 470); body.lineTo(294, 640); body.closePath();
      for (let x = 50; x < 280; x += 13) body.rect(x, 459, 7, 11.5);
      // 楼身与两重檐
      body.rect(96, 404, 138, 56);
      const roof = (y, x0, x1, h) => {
        body.moveTo(x0 - 16, y + 2); body.quadraticCurveTo(x0 + 10, y + h * 0.15, x0 + 26, y - h * 0.7); body.lineTo(x1 - 26, y - h * 0.7); body.quadraticCurveTo(x1 - 10, y + h * 0.15, x1 + 16, y + 2);
        body.lineTo(x1 + 2, y + 8); body.lineTo(x0 - 2, y + 8); body.closePath();
      };
      roof(404, 82, 248, 26);
      body.rect(118, 352, 94, 40);
      roof(352, 100, 230, 28);
      body.rect(150, 324, 30, 6);
      // 拱门（墩台下部的门洞）
      const arch = new Path2D();
      arch.moveTo(140, 640); arch.lineTo(140, 584); arch.quadraticCurveTo(165, 548, 190, 584); arch.lineTo(190, 640); arch.closePath();
      // 屋檐与垛口上的雪
      const snow = new Path2D();
      const cap = (y, x0, x1, h) => { snow.moveTo(x0 - 14, y + 1); snow.quadraticCurveTo(x0 + 10, y - h * 0.05 - 3, x0 + 26, y - h * 0.7 - 2.5); snow.lineTo(x1 - 26, y - h * 0.7 - 2.5); snow.quadraticCurveTo(x1 - 10, y - h * 0.05 - 3, x1 + 14, y + 1); snow.quadraticCurveTo(x1 - 10, y - h * 0.05, x1 - 26, y - h * 0.7); snow.lineTo(x0 + 26, y - h * 0.7); snow.quadraticCurveTo(x0 + 10, y - h * 0.05, x0 - 14, y + 1); snow.closePath(); };
      cap(404, 82, 248, 26); cap(352, 100, 230, 28);
      for (let x = 50; x < 280; x += 13) snow.rect(x - 0.4, 457.6, 7.8, 2);
      const win = new Path2D(); win.rect(146, 412, 38, 32);
      const lat = new Path2D();
      for (let k = 1; k < 5; k++) lat.rect(146 + k * 7.6 - 0.6, 412, 1.2, 32);
      for (let k = 1; k < 4; k++) lat.rect(146, 412 + k * 8 - 0.6, 38, 1.2);
      return { body, arch, snow, win, lat };
    })();
    const towerTex = () => K.cache('fg5_d3_tower', 330, 340, 1, (g) => {
      g.translate(0, -310);
      g.fillStyle = '#1c2640'; g.fill(TOWER.body);
      g.save(); g.clip(TOWER.body);
      // 墩台的砖缝与楼身的柱
      g.strokeStyle = 'rgba(64,80,112,0.4)'; g.lineWidth = 0.7;
      for (let y = 486; y < 640; y += 12) { g.beginPath(); g.moveTo(30, y); g.lineTo(300, y); g.stroke(); }
      g.fillStyle = 'rgba(14,20,34,0.7)';
      for (const x of [102, 136, 194, 228]) g.fillRect(x - 2, 404, 4, 56);
      g.restore();
      g.fillStyle = '#0e1424'; g.fill(TOWER.arch);
      g.fillStyle = '#121a2c'; g.fill(TOWER.win);
      g.fillStyle = '#aebfd8'; g.fill(TOWER.snow);
      // 墩台脚下的积雪：风把雪推到墙根，盖住墩台平直的底边；两端落回坡面，门洞前被踩低
      const dTop = [];
      for (let x = 16; x <= 318; x += 4) {
        const e = smooth((x - 16) / 28) * smooth((318 - x) / 30);
        const door = 1 - 0.6 * Math.exp(-Math.pow((x - 165) / 24, 2));
        dTop.push([x, 646.5 - 11 * e * door - 2.4 * (noise1(x * 0.05, 71) - 0.5) * e]);
      }
      const dr = new Path2D();
      smoothPath(dr, dTop.concat([[318, 654], [16, 654]]), true);
      const topLine = smoothPath(new Path2D(), dTop, false);
      // 雪与墙交界处一道窄的暗缝
      g.save(); g.clip(TOWER.body); g.translate(0, -1.4);
      g.strokeStyle = 'rgba(8,12,24,0.45)'; g.lineWidth = 2.6; g.stroke(topLine);
      g.restore();
      // 雪堆本身就是雪坡：直接用山脊层同一处的像素填，接缝看不出来
      g.save(); g.clip(dr); g.drawImage(ridgeTex(), 0, 250, W, 470); g.restore();
      const hl = g.createLinearGradient(16, 0, 318, 0);
      hl.addColorStop(0, 'rgba(184,200,224,0)'); hl.addColorStop(0.1, 'rgba(184,200,224,0.4)'); hl.addColorStop(0.9, 'rgba(184,200,224,0.4)'); hl.addColorStop(1, 'rgba(184,200,224,0)');
      g.strokeStyle = hl; g.lineWidth = 1.2; g.stroke(topLine);
    });

    // 星：日落后西天先出来的一颗亮星（金星），低在余晖之上
    XYT.registerShot('d3_pass', {
      name: '雪关残旗', zone: 'top', night: true, text: '#eef2f8', shadow: 'rgba(12,18,34,0.9)', accent: '#f2a65a', bloom: 0.34,
      draw(g, c) {
        const t = c.lt;
        const ysh = shadowY(c, t);
        const tLing = charAt(c, 2, 0, FB0);
        // 镜头：整镜 1.00→1.04 缓推（含淡入）
        const z = 1 + 0.04 * smooth((t + 0.7) / (c.dur + 0.7));
        g.save();
        g.translate(820, 330); g.scale(z, z); g.translate(-820, -330);
        g.drawImage(skyTex(), -2, -2, W + 4, 482);
        // 余晖随时间极缓变暗
        g.fillStyle = 'rgba(30,42,68,1)'; g.globalAlpha = 0.12 * smooth((t + 0.7) / 7.4); g.fillRect(-10, 150, W + 20, 330); g.globalAlpha = 1;
        // 金星
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.85 + 0.1 * Math.sin(t * 2.3); g.drawImage(glowTex('#fff2d8'), 1128 - 7, 186 - 7, 14, 14);
        g.globalAlpha = 0.3; g.drawImage(glowTex('#ffd9a8'), 1128 - 16, 186 - 16, 32, 32);
        g.restore();
        for (let k = 0; k < 2; k++) {
          g.drawImage(farTex(k), 0, FARY[k][0], W, FARY[k][1]);
          // 远峰西坡与峰顶的暖光：只在地影线以上；一道柔的宽光托着一线细的亮边，读作光而不是描边
          g.save();
          g.lineJoin = 'round';
          const rc = k ? '#e8905a' : WARM, ra = k ? 0.8 : 1;
          for (let lv = 0; lv < 3; lv++) {
            const f = ra * [1, 0.6, 0.28][lv], R = FAR[k].rims[lv];
            g.strokeStyle = warmGrad(g, ysh, rc, 0.07 * f, 6); g.lineWidth = 6; g.stroke(R);
            g.strokeStyle = warmGrad(g, ysh, rc, 0.15 * f, 6); g.lineWidth = 3.2; g.stroke(R);
            g.strokeStyle = warmGrad(g, ysh, WARM2, 0.45 * f, 6); g.lineWidth = 1.1; g.stroke(R);
          }
          g.restore();
        }
        g.drawImage(ridgeTex(), 0, 250, W, 470);
        drawTufts(g, t);
        // 山脊与墙顶的暖光：只在地影线以上
        g.save();
        g.lineCap = 'round';
        g.strokeStyle = warmGrad(g, ysh, WARM2, 0.95, 5); g.lineWidth = 2; g.stroke(RIDGE.crestR); g.stroke(RIDGE.crestW);
        g.strokeStyle = warmGrad(g, ysh, WARM, 0.35, 8); g.lineWidth = 7; g.stroke(RIDGE.crestR);
        // 烽台西面（右侧）受光
        g.fillStyle = warmGrad(g, ysh, WARM, 0.75, 4);
        g.beginPath(); g.moveTo(PLAT.x1 - 6, PLAT.top); g.lineTo(PLAT.x1, G(PLAT.x1) + 4); g.lineTo(PLAT.x1 - 3, G(PLAT.x1) + 4); g.lineTo(PLAT.x1 - 8.5, PLAT.top); g.closePath(); g.fill();
        g.restore();
        // 空旗杆与冻硬的绳头
        for (let i = 0; i < POLES.length; i++) drawPole(g, POLES[i], ysh, t, i);
        // 烽台的残旗与老人
        drawPole(g, FLAG, ysh, t, 9, true);
        drawBanner(g, t);
        const lit = smooth((ysh - (MAN.y - MAN.h)) / (MAN.h * 0.9));
        XYT.sil.draw(g, 'old', 'standSide', MAN.x, MAN.y, MAN.h, Math.max(0, t) + 2, { facing: 1, wind: 0.3, windDir: 1, body: '#18203a', rim: lit > 0.02 ? WARM : null, rimSide: 1, alpha: 1 });
        // 烽台前沿的矮女墙与垛口：挡住老人的脚（他站在台面上、女墙后面）
        drawParapet(g, ysh);
        // 城楼
        g.drawImage(towerTex(), 0, 310, 330, 340);
        const wl = smooth((t - tLing) / 0.6);
        if (wl > 0.001) {
          g.save();
          g.globalAlpha = wl;
          const wg = g.createLinearGradient(0, 412, 0, 444);
          wg.addColorStop(0, '#ffd58e'); wg.addColorStop(1, '#f2a24e');
          g.fillStyle = wg; g.fill(TOWER.win);
          g.fillStyle = '#1c2640'; g.fill(TOWER.lat);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = wl * 0.55; g.drawImage(glowTex('#f2a65a'), 165 - 46, 428 - 40, 92, 80);
          g.globalAlpha = wl * 0.18; g.drawImage(glowTex('#f2a65a'), 165 - 110, 428 - 80, 220, 160);
          // 窗光落在下面墩台垛口的雪上
          g.globalAlpha = wl * 0.35;
          g.fillStyle = '#f2b46a'; g.fillRect(140, 457.6, 50, 2);
          g.restore();
        }
        // 零星细雪
        drawSnow(g, t);
        g.restore();
      },
    });

    // 烽台前沿的女墙（3 px 高，延到台面以下与正面相接）和其上的垛口；顶上的雪，地影线以上受暖光
    function drawParapet(g, ysh) {
      const x0 = PLAT.x0 + 6, x1 = PLAT.x1 - 6, yT = PLAT.top - 3;
      g.fillStyle = '#28344f';
      g.fillRect(x0, yT, x1 - x0, 5.6);
      const ms = [];
      for (let x = PLAT.x0 + 8; x < PLAT.x1 - 10; x += 9) ms.push(x);
      for (const x of ms) g.fillRect(x, yT - 4.5, 4.2, 4.6);
      g.fillStyle = '#b4c4dc';
      for (const x of ms) g.fillRect(x - 0.3, yT - 5.6, 4.8, 1.3);
      g.fillRect(x0, yT - 0.5, x1 - x0, 0.9);
      g.fillStyle = warmGrad(g, ysh, WARM, 0.75, 4);
      for (const x of ms) { g.fillRect(x - 0.3, yT - 5.6, 4.8, 0.9); g.fillRect(x + 3.2, yT - 4.6, 1, 4.6); }
      g.fillRect(x0, yT - 0.5, x1 - x0, 0.7);
      g.fillRect(x1 - 1.6, yT, 1.6, 3.2);
    }
    // 石边的枯草：细茎从根部散开，顺风（右）弯，微风里轻轻摆
    function drawTufts(g, t) {
      g.lineCap = 'round';
      for (const [x, y, s, sd] of TUFTS) {
        const r = rng(sd * 97);
        const n = 6 + Math.floor(4 * r());
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n - 0.5;
          const hgt = s * (8 + 8 * r()) * (1 - 0.45 * Math.abs(u));
          const lean = 0.3 + 0.25 * r();
          const sw = 0.05 * Math.sin(TAU * (0.4 + 0.12 * r()) * t + i * 0.9 + sd);
          const a = u * 0.9 + lean + sw;
          const bx = x + u * 6 * s, by = y + 1;
          const ex = bx + Math.sin(a) * hgt, ey = by - Math.cos(a) * hgt;
          const cx = bx + Math.sin(a * 0.4) * hgt * 0.55, cy = by - Math.cos(a * 0.4) * hgt * 0.6;
          g.strokeStyle = r() < 0.35 ? '#5a5668' : '#2b3350';
          g.lineWidth = 0.9 * s;
          g.globalAlpha = 0.65 + 0.3 * r();
          g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    // 旗杆：背光的深色杆身；地影线以上的一段右侧受暖光；杆梢垂一截冻硬的绳头（刚体小摆 ±4°，0.4 Hz，略偏向下风）
    function drawPole(g, P, ysh, t, i, flag) {
      const x = P.x, yb = P.base, yt = P.base - P.h;
      const w = flag ? 2.6 : 2.0 + 0.8 * (P.h - 66) / 10;
      g.fillStyle = '#1a2238';
      g.fillRect(x - w / 2, yt, w, yb - yt);
      // 杆顶小帽
      g.fillRect(x - w * 0.9, yt - 1.6, w * 1.8, 1.8);
      // 受光
      if (ysh > yt - 6) {
        g.fillStyle = warmGrad(g, ysh, WARM2, 1, 4);
        g.fillRect(x - w * 0.1, yt - 1.6, w * 0.65, Math.max(0, Math.min(yb, ysh + 6) - yt + 1.6));
        // 杆梢一点暖光（杆梢落进阴影时随之淡去）
        const k = smooth((ysh - yt + 3) / 8);
        if (k > 0.01) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.45 * k; g.drawImage(glowTex('#ffb26a'), x - 7, yt - 8, 14, 14); g.restore(); }
      }
      if (flag) return;
      // 绳头
      const L = 10 + 0.12 * P.h;
      const ang = (4 * Math.sin(TAU * 0.4 * t + i * 1.7) + 1.5) * Math.PI / 180;
      const ex = x + w * 0.6 + Math.sin(ang) * L, ey = yt + 1 + Math.cos(ang) * L;
      g.strokeStyle = '#1a2238'; g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + w * 0.6, yt + 1); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = '#1a2238'; g.beginPath(); g.arc(ex, ey, 1.1, 0, TAU); g.fill();
      if (ysh > yt) { g.strokeStyle = warmGrad(g, ysh, WARM2, 0.7, 4); g.beginPath(); g.moveTo(x + w * 0.6 + 0.6, yt + 1); g.lineTo(ex + 0.6, ey); g.stroke(); }
    }

    // 残旗：一边系在杆上，向右（下风）飘；平缓的行波，越往梢越大；破边与几个洞；褪色的红被余晖照成暖橙
    const BAN = (() => {
      const r = rng(616);
      const top = [], bot = [];
      const N = 14;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        top.push([u, 0]);
        let b = 1 - 0.18 * u;
        if (k > 1) b -= (r() < 0.5 ? 0.14 + 0.26 * r() : 0.04 * r()) * Math.pow(u, 0.6);
        top.length && k > N - 3 && (top[top.length - 1][1] = 0.06 * r() * u);
        bot.push([u, b]);
      }
      const holes = [[0.55, 0.45, 0.05], [0.78, 0.3, 0.035], [0.4, 0.7, 0.03]];
      return { top, bot, holes };
    })();
    function drawBanner(g, t) {
      // 微风（0.3）：旗面向右下斜垂约 40°，角度缓慢摆动；沿旗面传一道平缓的行波，越往梢越大
      const x0 = FLAG.x + 1.4, y0 = FLAG.base - FLAG.h + 3, Lw = 40, Hh = 27;
      const th = (38 + 5 * Math.sin(TAU * 0.27 * t) + 2 * Math.sin(TAU * 0.61 * t + 1)) * Math.PI / 180;
      const ca = Math.cos(th), sa = Math.sin(th);
      const P = (u, v) => {
        const wv = (0.6 + 2.6 * u) * u * Math.sin(TAU * 0.5 * t - u * 4.0) + 0.8 * u * Math.sin(TAU * 0.83 * t - u * 6.5 + 1.3);
        const ax = x0, ay = y0 + v * Hh;
        return [ax + u * Lw * ca - wv * sa * 0.8, ay + u * Lw * sa + wv * ca * 0.8];
      };
      const path = new Path2D();
      const a0 = P(0, 0); path.moveTo(a0[0], a0[1]);
      for (const [u, v] of BAN.top) { const q = P(u, v); path.lineTo(q[0], q[1]); }
      for (let k = BAN.bot.length - 1; k >= 0; k--) { const [u, v] = BAN.bot[k]; const q = P(u, v); path.lineTo(q[0], q[1]); }
      path.closePath();
      for (const [u, v, rr] of BAN.holes) { const q = P(u, v); path.moveTo(q[0] + rr * Lw, q[1]); path.ellipse(q[0], q[1], rr * Lw, rr * Hh * 1.1, th, 0, TAU); }
      // 褪色的旧红；余晖从右边照来，褶的迎光面亮（亮带随波移动）
      const ph = Math.sin(TAU * 0.5 * t);
      const e0 = P(0, 0.5), e1 = P(1, 0.5);
      const gr = g.createLinearGradient(e0[0], e0[1], e1[0], e1[1]);
      gr.addColorStop(0, '#6e3c36'); gr.addColorStop(0.3 + 0.08 * ph, '#a2583e'); gr.addColorStop(0.55 + 0.06 * ph, '#7a4236'); gr.addColorStop(0.8, '#b0663f'); gr.addColorStop(1, '#94503a');
      g.fillStyle = gr; g.fill(path, 'evenodd');
      // 旗边（褪了色的镶边）与上沿受光一线
      g.strokeStyle = 'rgba(214,170,120,0.55)'; g.lineWidth = 0.8;
      g.beginPath(); for (let k = 0; k <= 14; k++) { const q = P(k / 14, 0.06); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
      g.strokeStyle = 'rgba(255,201,138,0.8)'; g.lineWidth = 0.9;
      g.beginPath(); for (let k = 0; k <= 14; k++) { const q = P(k / 14, 0); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke();
    }

    const FLAKES = (() => { const r = rng(3131), out = []; for (let i = 0; i < 70; i++) out.push({ x: r(), y: r(), v: 18 + 16 * r(), s: 1.2 + 1.4 * r(), a: 0.45 + 0.4 * r(), sw: 2 + 4 * r(), f: 0.2 + 0.3 * r(), ph: r() * TAU }); return out; })();
    function drawSnow(g, t) {
      const span = W + 60, rangeY = 780;
      g.fillStyle = '#dfe8f6';
      for (const f of FLAKES) {
        const y = ((f.y * rangeY + f.v * t) % rangeY + rangeY) % rangeY - 30;
        const x = ((f.x * span + 0.35 * f.v * t + f.sw * Math.sin(TAU * f.f * t + f.ph)) % span + span) % span - 30;
        // 歌词区里的雪更淡
        const a = f.a * smooth((y + 30) / 30) * (0.35 + 0.65 * smooth((y - 120) / 60));
        if (a < 0.02) continue;
        g.globalAlpha = a;
        g.fillRect(x - f.s / 2, y - f.s / 2, f.s, f.s);
      }
      g.globalAlpha = 1;
    }
  })();
})();
