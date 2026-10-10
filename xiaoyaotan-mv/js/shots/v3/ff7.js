/* 第三版镜头组 ff7：o1_thaw, o3_seal */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, easeOut, h2, rgba, mix, noise1 } = A;

  // 建缓存时画模糊层（ctx.filter 只在这里用）
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
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.1; }
    return s / n * 2;
  };
  // 离 lt 最近的拍点（相对镜头起点），离得太远就用原值
  const beatNear = (c, lt, win) => {
    const s = c.t - c.lt;
    if (!c.grid || !c.grid.time || !c.grid.pos) return lt;
    const k = Math.round(c.grid.pos(s + lt));
    const d = c.grid.time(k) - s;
    return Math.abs(d - lt) < (win || 0.3) ? d : lt;
  };
  // 三次贝塞尔：点与切线
  const bez = (P, u) => {
    const v = 1 - u;
    const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]];
  };
  const bezT = (P, u) => {
    const v = 1 - u;
    const x = 3 * v * v * (P[1][0] - P[0][0]) + 6 * v * u * (P[2][0] - P[1][0]) + 3 * u * u * (P[3][0] - P[2][0]);
    const y = 3 * v * v * (P[1][1] - P[0][1]) + 6 * v * u * (P[2][1] - P[1][1]) + 3 * u * u * (P[3][1] - P[2][1]);
    const m = Math.hypot(x, y) || 1;
    return [x / m, y / m];
  };
  // 二维仿射矩阵 [a, b, c, d, e, f]（与 canvas transform 同序）
  const mMul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const mChain = (...ms) => ms.reduce(mMul);
  const mT = (x, y) => [1, 0, 0, 1, x, y];
  const mR = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, 0, 0]; };
  const mS = (x, y) => [x, 0, 0, y, 0, 0];
  const mInv = (m) => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
  const mApply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mLerp = (m, n, k) => m.map((v, i) => v + (n[i] - v) * k);

  // ============================================================
  // o1_thaw 春回：桃枝薄冰在晨光里化去，一滴融水落进河面
  // ============================================================
  (function () {
    // 场景几何：近景微距，像素约 0.35 mm；枝梢离水约 8 cm
    // 整组枝下移 DY：上一镜的顶部字幕淡出时不压在花上
    const DY = 90;
    const MAIN = [[1340, -10 + DY], [1150, 40 + DY], [850, 230 + DY], [560, 322 + DY]];
    const TWA = [[1012, 128 + DY], [994, 100 + DY], [962, 74 + DY], [926, 56 + DY]];       // 上伸小枝
    const WATER_Y = 548;                 // 枝下方（对焦平面）的水面线
    const HORIZON = 250;                 // 远岸水线（虚）
    const GPX = 28000;                   // 重力（像素/秒²）
    const CAM = [620, 400];
    const FLOW = 45;                     // 水流向右（像素/秒，约 1.6 cm/s）
    // 日晕在水面碎金带（x≈1050）的正上方
    const SUN = [1060, -90];

    const thMain = (u) => lerp(46, 8, Math.pow(u, 0.75));
    const thA = (u) => lerp(13, 4.5, u);

    // 花、苞、叶：长于枝上（u、哪一侧），精灵图绕挂点微颤
    const FLOWERS = [
      // 桃花几乎无梗，贴枝而生
      { id: 'f1', P: MAIN, th: thMain, u: 0.13, side: -1, L: 52, tilt: 0.84, rot: -0.5, spin: 0.3, stalk: 0.18, seed: 11 },
      { id: 'f2', P: MAIN, th: thMain, u: 0.24, side: 1, L: 47, tilt: 0.62, rot: 0.55, spin: 1.3, stalk: 0.2, seed: 12 },
      { id: 'f3', P: MAIN, th: thMain, u: 0.4, side: -1, L: 60, tilt: 0.95, rot: -0.2, spin: 0.9, stalk: 0.16, seed: 13 },
      { id: 'f4', P: MAIN, th: thMain, u: 0.56, side: 1, L: 50, tilt: 0.72, rot: 0.3, spin: 0.5, stalk: 0.19, seed: 14 },
      { id: 'f5', P: MAIN, th: thMain, u: 0.7, side: -1, L: 45, tilt: 0.6, rot: -0.15, spin: 0.15, stalk: 0.2, seed: 15 },
    ];
    const BUDS = [
      { id: 'b1', P: MAIN, th: thMain, u: 0.32, side: 1, L: 27, ang: -1.0, seed: 21 },
      { id: 'b2', P: MAIN, th: thMain, u: 0.49, side: -1, L: 22, ang: 1.9, seed: 22 },
      { id: 'b3', P: MAIN, th: thMain, u: 0.64, side: 1, L: 25, ang: -1.2, seed: 23 },
      { id: 'b4', P: MAIN, th: thMain, u: 0.8, side: 1, L: 22, ang: -1.5, seed: 24 },
      { id: 'b5', P: MAIN, th: thMain, u: 1.0, side: 0, L: 18, ang: 2.84, seed: 25 },
      { id: 'b6', P: TWA, th: thA, u: 1.0, side: 0, L: 22, ang: -2.6, seed: 26 },
      { id: 'b7', P: TWA, th: thA, u: 0.45, side: 1, L: 17, ang: -1.1, seed: 27 },
    ];
    const LEAVES = [
      { id: 'l1', P: MAIN, th: thMain, u: 0.915, side: 1, L: 46, ang: -2.75, seed: 31 },
      { id: 'l2', P: MAIN, th: thMain, u: 0.935, side: 1, L: 36, ang: -1.85, seed: 32 },
      { id: 'l3', P: TWA, th: thA, u: 0.86, side: -1, L: 30, ang: -2.95, seed: 33 },
    ];
    // 挂点：枝上 u 处、朝 side 侧（1 = 上侧，-1 = 下侧，0 = 枝端）
    function attach(it) {
      const p = bez(it.P, it.u), tg = bezT(it.P, it.u);
      let nx = tg[1], ny = -tg[0];             // 朝上的法向
      if (ny > 0) { nx = -nx; ny = -ny; }
      const off = it.side === 0 ? 0 : it.side * (it.th(it.u) * 0.5 - 1);
      return [p[0] + nx * off, p[1] + ny * off, tg, [nx, ny]];
    }
    FLOWERS.concat(BUDS, LEAVES).forEach((it) => { it.at = attach(it); });
    const pickPetal = (f) => {
      let best = 0, bv = -9;
      for (let k = 0; k < 5; k++) {
        const a = f.spin + k * TAU / 5 + (h2(f.seed, k) - 0.5) * 0.25 + f.rot;
        const v = Math.sin(a) + 0.6 * Math.cos(a);
        if (v > bv) { bv = v; best = k; }
      }
      return best;
    };
    // 飘落的那片：最低一朵花上朝右下的一瓣
    const PETAL_K = pickPetal(FLOWERS[4]);

    // ---------- 花瓣与花 ----------
    // 桃瓣：倒卵形，瓣端圆中带一点微尖（不开缺口）
    function petalPath(L, w) {
      const p = new Path2D();
      p.moveTo(0, 0);
      p.bezierCurveTo(L * 0.16, -w * 0.3, L * 0.46, -w * 0.6, L * 0.78, -w * 0.5);
      p.bezierCurveTo(L * 0.95, -w * 0.43, L * 1.03, -w * 0.2, L * 1.0, 0);
      p.bezierCurveTo(L * 1.03, w * 0.2, L * 0.95, w * 0.43, L * 0.78, w * 0.5);
      p.bezierCurveTo(L * 0.46, w * 0.6, L * 0.16, w * 0.3, 0, 0);
      p.closePath();
      return p;
    }
    const COLD = '#c3d0d8';
    const pc = (hex, mode) => (mode === 'cold' ? mix(hex, COLD, 0.5) : hex);
    // 花的几何：花心位置、各瓣角度（按前后排序）
    function flowerGeo(f) {
      const ang = Math.atan2(f.at[3][1], f.at[3][0]) * (f.side === 0 ? 0 : 1);
      const dir = f.side === 0 ? [Math.cos(f.rot - 1.2), Math.sin(f.rot - 1.2)] : [f.at[3][0] * f.side, f.at[3][1] * f.side];
      const cx = dir[0] * f.L * f.stalk, cy = dir[1] * f.L * f.stalk;
      const pet = [];
      for (let k = 0; k < 5; k++) {
        const a = f.spin + k * TAU / 5 + (h2(f.seed, k) - 0.5) * 0.25;
        pet.push({ k, a, Lk: f.L * (0.92 + 0.14 * h2(f.seed, k + 7)), wk: f.L * (0.74 + 0.1 * h2(f.seed, k + 13)) });
      }
      // 透视下：屏幕上偏上的瓣在后
      pet.sort((p1, p2) => Math.sin(p1.a + 0) - Math.sin(p2.a + 0));
      return { cx, cy, pet, ang };
    }
    // mode：warm 鲜润、cold 冰封（褪色加冰釉）、spec 冰壳高光
    // part：不给 = 整朵；'lo' = 飘落瓣之下的部分；'pk' = 只有飘落瓣；'hi' = 其上的瓣与花心
    function drawFlower(g, f, mode, part) {
      const G = flowerGeo(f), L = f.L;
      const ki = part ? G.pet.findIndex((q) => q.k === PETAL_K) : -1;
      const use = (j) => !part || (part === 'lo' ? j < ki : part === 'pk' ? j === ki : j > ki);
      const base = !part || part === 'lo', top = !part || part === 'hi';
      // 花梗（很短）
      if (mode !== 'spec' && base) {
        g.strokeStyle = pc('#5a3a30', mode); g.lineWidth = 2.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(G.cx * 0.9, G.cy * 0.9); g.stroke();
      }
      g.save();
      g.translate(G.cx, G.cy); g.rotate(f.rot); g.scale(1, f.tilt);
      // 萼片：在花后
      if (mode !== 'spec' && base) {
        g.fillStyle = pc('#8a3b36', mode);
        for (let k = 0; k < 5; k++) {
          const a = f.spin + 0.63 + k * TAU / 5;
          g.save(); g.rotate(a);
          g.beginPath(); g.moveTo(0, -L * 0.13); g.quadraticCurveTo(L * 0.3, -L * 0.12, L * 0.42, 0); g.quadraticCurveTo(L * 0.3, L * 0.12, 0, L * 0.13); g.closePath(); g.fill();
          g.restore();
        }
      }
      if (mode === 'cold') {
        // 冰壳：整朵花外面一层半透明的冰
        g.fillStyle = 'rgba(214,232,244,0.28)'; g.strokeStyle = 'rgba(214,232,244,0.28)'; g.lineWidth = 6; g.lineJoin = 'round';
        G.pet.forEach((p, j) => { if (!use(j)) return; g.save(); g.rotate(p.a); const pp = petalPath(p.Lk, p.wk); g.fill(pp); g.stroke(pp); g.restore(); });
      }
      for (let j = 0; j < G.pet.length; j++) {
        if (!use(j)) continue;
        const p = G.pet[j];
        const path = petalPath(p.Lk, p.wk);
        const front = Math.sin(p.a) > 0.35;
        g.save(); g.rotate(p.a);
        if (mode === 'spec') {
          // 只亮看得见的冰面：近处的瓣先擦掉被它挡住的后瓣冰边，再描自己的边
          g.globalCompositeOperation = 'destination-out'; g.fill(path); g.globalCompositeOperation = 'source-over';
          g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.2;
          g.stroke(path);
        } else {
          const gr = g.createLinearGradient(0, 0, p.Lk, 0);
          gr.addColorStop(0, pc(front ? '#c0436a' : '#c94d74', mode));
          gr.addColorStop(0.3, pc(front ? '#e8899f' : '#ee9cb0', mode));
          gr.addColorStop(0.75, pc(front ? '#f6c0cc' : '#f8cdd7', mode));
          gr.addColorStop(1, pc('#fbe2e7', mode));
          g.fillStyle = gr; g.globalAlpha = 0.96;
          g.fill(path);
          g.globalAlpha = 1;
          // 细脉
          g.strokeStyle = rgba(pc('#c75a7c', mode), 0.22); g.lineWidth = 0.55;
          for (let v = -2; v <= 2; v++) {
            g.beginPath(); g.moveTo(p.Lk * 0.08, 0);
            g.quadraticCurveTo(p.Lk * 0.5, v * p.wk * 0.1, p.Lk * 0.86, v * p.wk * 0.16); g.stroke();
          }
          // 勾边
          g.strokeStyle = rgba(pc('#b9607a', mode), 0.5); g.lineWidth = 0.8;
          g.stroke(path);
          if (mode === 'cold') {
            g.fillStyle = 'rgba(232,242,250,0.34)'; g.fill(path);
            g.strokeStyle = 'rgba(252,254,255,0.3)'; g.lineWidth = 0.8; g.stroke(path);
          }
        }
        g.restore();
      }
      // 花心：深胭脂的花托，长而密的雄蕊伸出瓣面一半以上
      if (mode !== 'spec' && top) {
        const cg = g.createRadialGradient(0, 0, 0, 0, 0, L * 0.3);
        cg.addColorStop(0, pc('#9c2a4a', mode)); cg.addColorStop(0.55, rgba(pc('#b8385e', mode), 0.75)); cg.addColorStop(1, rgba(pc('#c94d74', mode), 0));
        g.fillStyle = cg; g.beginPath(); g.arc(0, 0, L * 0.3, 0, TAU); g.fill();
        const ns = 30;
        for (let s = 0; s < ns; s++) {
          const a = s / ns * TAU + (h2(f.seed, s + 40) - 0.5) * 0.3, rr = L * (0.45 + 0.25 * h2(f.seed, s + 60));
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          g.strokeStyle = rgba(pc(s % 2 ? '#f8d3dc' : '#f1b9c7', mode), 0.9); g.lineWidth = 0.65;
          g.beginPath(); g.moveTo(Math.cos(a) * L * 0.1, Math.sin(a) * L * 0.1); g.quadraticCurveTo(Math.cos(a + 0.06) * rr * 0.6, Math.sin(a + 0.06) * rr * 0.6, x, y); g.stroke();
          g.fillStyle = pc(s % 3 ? '#e6ad40' : '#d68a32', mode);
          g.beginPath(); g.arc(x, y, 1.3, 0, TAU); g.fill();
        }
        g.fillStyle = pc('#c9d68a', mode);
        g.beginPath(); g.arc(0, 0, 1.6, 0, TAU); g.fill();
      }
      g.restore();
    }
    function drawBud(g, b, mode) {
      const L = b.L;
      g.save(); g.rotate(b.ang);
      if (mode !== 'spec') {
        // 苞片
        g.fillStyle = pc('#6e3a30', mode);
        g.beginPath(); g.ellipse(L * 0.18, 0, L * 0.22, L * 0.2, 0, 0, TAU); g.fill();
        const gr = g.createLinearGradient(0, 0, L, 0);
        gr.addColorStop(0, pc('#f3c3cd', mode)); gr.addColorStop(0.6, pc('#e98aa2', mode)); gr.addColorStop(1, pc('#cf5478', mode));
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(L * 0.2, -L * 0.24);
        g.bezierCurveTo(L * 0.55, -L * 0.36, L * 0.95, -L * 0.2, L * 1.0, 0);
        g.bezierCurveTo(L * 0.95, L * 0.2, L * 0.55, L * 0.36, L * 0.2, L * 0.24);
        g.closePath(); g.fill();
        g.strokeStyle = rgba(pc('#b04e6c', mode), 0.5); g.lineWidth = 0.8; g.stroke();
        g.strokeStyle = rgba(pc('#c45876', mode), 0.45); g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(L * 0.3, L * 0.12); g.quadraticCurveTo(L * 0.7, L * 0.06, L * 0.98, -L * 0.02); g.stroke();
        // 萼片包住底部
        g.fillStyle = pc('#7d3a34', mode);
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(L * 0.05, 0); g.quadraticCurveTo(L * 0.2, s * L * 0.3, L * 0.42, s * L * 0.18); g.quadraticCurveTo(L * 0.28, s * L * 0.08, L * 0.05, 0); g.fill();
        }
        if (mode === 'cold') {
          g.fillStyle = 'rgba(224,238,248,0.36)';
          g.beginPath(); g.ellipse(L * 0.55, 0, L * 0.52, L * 0.35, 0, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(250,253,255,0.5)'; g.lineWidth = 1; g.stroke();
        }
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(L * 0.55, 0, L * 0.5, L * 0.33, 0, 0, TAU); g.stroke();
      }
      g.restore();
    }
    function drawLeaf(g, l, mode) {
      const L = l.L, w = L * 0.24;
      g.save(); g.rotate(l.ang);
      const path = new Path2D();
      path.moveTo(0, 0);
      path.bezierCurveTo(L * 0.3, -w * 1.1, L * 0.75, -w * 0.9, L, -w * 0.1);
      path.bezierCurveTo(L * 0.72, w * 0.55, L * 0.3, w * 0.8, 0, 0);
      if (mode !== 'spec') {
        const gr = g.createLinearGradient(0, -w, 0, w);
        gr.addColorStop(0, pc('#b4d892', mode)); gr.addColorStop(0.5, pc('#86b873', mode)); gr.addColorStop(1, pc('#5f945e', mode));
        g.fillStyle = gr; g.fill(path);
        g.strokeStyle = rgba(pc('#4f7d4c', mode), 0.55); g.lineWidth = 0.7; g.stroke(path);
        g.strokeStyle = rgba(pc('#d9eec0', mode), 0.7); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(1, 0); g.quadraticCurveTo(L * 0.5, -w * 0.12, L * 0.96, -w * 0.1); g.stroke();
        if (mode === 'cold') { g.fillStyle = 'rgba(226,238,246,0.36)'; g.fill(path); g.strokeStyle = 'rgba(250,253,255,0.5)'; g.lineWidth = 1; g.stroke(path); }
      } else {
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 1.4; g.stroke(path);
      }
      g.restore();
    }
    // 精灵图：挂点在中心
    const SPR = (it, kind, mode, part) => {
      const R = Math.ceil(it.L * 1.75);
      return K.cache(`o1:${it.id}:${mode}:${part || ''}`, R * 2, R * 2, 1, (g) => {
        g.translate(R, R);
        if (kind === 'f') drawFlower(g, it, mode, part);
        else if (kind === 'b') drawBud(g, it, mode);
        else drawLeaf(g, it, mode);
        if (mode === 'spec') {
          // 只留朝光（右上）一侧的高光
          g.globalCompositeOperation = 'destination-in';
          const gr = g.createLinearGradient(R * 0.6, -R * 0.6, -R * 0.4, R * 0.4);
          gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = gr; g.fillRect(-R, -R, R * 2, R * 2);
        }
      });
    };

    // ---------- 枝 ----------
    function branchOutline(P, th, u0, nodes) {
      const N = 90, up = [], dn = [];
      for (let i = 0; i <= N; i++) {
        const u = u0 + (1 - u0) * i / N, p = bez(P, u), tg = bezT(P, u);
        let w = th(u) * 0.5;
        for (const nu of nodes) w += 1.3 * Math.exp(-Math.pow((u - nu) / 0.012, 2));
        w *= 1 + 0.05 * (noise1(u * 30, 5) - 0.5);
        let nx = tg[1], ny = -tg[0];
        if (ny > 0) { nx = -nx; ny = -ny; }
        up.push([p[0] + nx * w, p[1] + ny * w]);
        dn.push([p[0] - nx * w, p[1] - ny * w]);
      }
      const path = new Path2D();
      path.moveTo(up[0][0], up[0][1]);
      for (const q of up) path.lineTo(q[0], q[1]);
      const e = bez(P, 1), tg = bezT(P, 1), r = th(1) * 0.5;
      path.quadraticCurveTo(e[0] + tg[0] * r * 1.6, e[1] + tg[1] * r * 1.6, dn[N][0], dn[N][1]);
      for (let i = N; i >= 0; i--) path.lineTo(dn[i][0], dn[i][1]);
      path.closePath();
      return { path, up, dn };
    }
    const nodesOf = (P) => FLOWERS.concat(BUDS, LEAVES).filter((it) => it.P === P).map((it) => it.u);
    function drawTwig(g, P, th, u0, mode) {
      const O = branchOutline(P, th, u0, nodesOf(P));
      if (mode === 'bark') {
        g.fillStyle = '#4e3631'; g.fill(O.path);
        g.save(); g.clip(O.path);
        // 圆柱明暗：下侧背光更暗，上缘迎着右上方的晨光
        g.lineJoin = 'round'; g.lineCap = 'round';
        const line = (pts, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); };
        line(O.dn, 'rgba(24,14,12,0.6)', th(u0) * 0.6);
        line(O.dn, 'rgba(24,14,12,0.35)', th(u0) * 0.9);
        line(O.up, 'rgba(146,98,82,0.5)', th(u0) * 0.34);
        line(O.up, 'rgba(196,150,124,0.55)', th(u0) * 0.1);
        line(O.up, 'rgba(246,222,196,0.8)', 1.6);
        // 干笔纹（顺枝）
        for (let i = 0; i < 90; i++) {
          const u = u0 + (1 - u0) * h2(i, 3), p = bez(P, u), tg = bezT(P, u), w = th(u) * 0.5;
          const o = (h2(i, 4) - 0.5) * 1.6 * w, len = 10 + 26 * h2(i, 5);
          g.strokeStyle = h2(i, 6) < 0.65 ? 'rgba(26,16,14,0.22)' : 'rgba(176,132,110,0.18)'; g.lineWidth = 0.7 + 0.6 * h2(i, 7);
          g.beginPath(); g.moveTo(p[0] - tg[1] * o, p[1] + tg[0] * o); g.lineTo(p[0] - tg[1] * o + tg[0] * len, p[1] + tg[0] * o + tg[1] * len); g.stroke();
        }
        // 横向皮孔：稀疏、浅淡、长短不一
        for (let i = 0; i < 18; i++) {
          const u = u0 + (0.85 - u0) * (i + 0.8 * h2(i, 8)) / 18, p = bez(P, u), tg = bezT(P, u), w = th(u) * 0.5;
          const o = (h2(i, 9) - 0.5) * 0.9 * w, ln = w * (0.25 + 0.35 * h2(i, 10));
          g.strokeStyle = `rgba(200,166,144,${0.18 + 0.14 * h2(i, 11)})`; g.lineWidth = 1.4;
          const x = p[0] - tg[1] * o, y = p[1] + tg[0] * o;
          g.beginPath(); g.moveTo(x - tg[1] * ln * 0.5, y + tg[0] * ln * 0.5); g.lineTo(x + tg[1] * ln * 0.5, y - tg[0] * ln * 0.5); g.stroke();
        }
        g.restore();
        g.strokeStyle = 'rgba(30,20,18,0.6)'; g.lineWidth = 1; g.stroke(O.path);
      } else if (mode === 'iceShape') {
        // 冰壳轮廓（并集后统一上色）：比枝略粗、下侧更厚，下沿挂着短冰凌
        const I = branchOutline(P, (u) => th(u) + 6 + 3 * u, u0, []);
        g.fill(I.path);
        for (let i = 0; i < 14; i++) {
          const q = I.dn[Math.floor(10 + (I.dn.length - 16) * (i + 0.7 * h2(i, P[0][0])) / 14)];
          if (!q) continue;
          const r = 2.2 + 1.6 * h2(i, 2), len = 6 + 12 * h2(i, 3);
          g.beginPath(); g.moveTo(q[0] - r, q[1] - 2); g.quadraticCurveTo(q[0] - r * 0.3, q[1] + len * 0.6, q[0], q[1] + len); g.quadraticCurveTo(q[0] + r * 0.3, q[1] + len * 0.6, q[0] + r, q[1] - 2); g.fill();
        }
      } else if (mode === 'iceTips') {
        const I = branchOutline(P, (u) => th(u) + 6 + 3 * u, u0, []);
        for (let i = 0; i < 14; i++) {
          const q = I.dn[Math.floor(10 + (I.dn.length - 16) * (i + 0.7 * h2(i, P[0][0])) / 14)];
          if (!q) continue;
          const len = 6 + 12 * h2(i, 3);
          g.beginPath(); g.arc(q[0] + 0.3, q[1] + len - 1.2, 1.1, 0, TAU); g.fill();
        }
        g.strokeStyle = 'rgba(80,110,130,0.3)'; g.lineWidth = 1;
        g.beginPath(); I.dn.forEach((q, i) => (i ? g.lineTo(q[0], q[1] - 2.5) : g.moveTo(q[0], q[1] - 2.5))); g.stroke();
      } else {
        // 高光：迎光的上沿，断续的亮线
        const I = branchOutline(P, (u) => th(u) + 6 + 3 * u, u0, []);
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineCap = 'round';
        for (let i = 0; i + 3 < I.up.length; i += 3) {
          if (noise1(i * 0.21, P[0][1] | 0) < 0.42) continue;
          g.lineWidth = 1 + 1.2 * noise1(i * 0.37, 9);
          g.beginPath(); g.moveTo(I.up[i][0], I.up[i][1] + 1.2); g.lineTo(I.up[i + 3][0], I.up[i + 3][1] + 1.2); g.stroke();
        }
      }
    }
    const BX = 500, BW = W - BX, BH = 480;
    const branchLayer = (mode) => K.cache('o1:branch:' + mode, BW, BH, 1, (g) => {
      g.translate(-BX, 0);
      if (mode === 'ice') {
        // 冰壳：先画出并集轮廓，再整体着色，交接处不重叠
        const tmp = document.createElement('canvas'); tmp.width = g.canvas.width; tmp.height = g.canvas.height;
        const tg = tmp.getContext('2d'); tg.setTransform(g.getTransform());
        tg.fillStyle = '#000';
        drawTwig(tg, TWA, thA, 0, 'iceShape'); drawTwig(tg, MAIN, thMain, 0.03, 'iceShape');
        tg.globalCompositeOperation = 'source-in';
        tg.setTransform(1, 0, 0, 1, 0, 0);
        const gr = tg.createLinearGradient(0, 0, 0, tmp.height);
        gr.addColorStop(0, 'rgba(226,240,250,0.5)'); gr.addColorStop(1, 'rgba(200,222,238,0.42)');
        tg.fillStyle = gr; tg.fillRect(0, 0, tmp.width, tmp.height);
        g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(tmp, 0, 0); g.restore();
        g.fillStyle = 'rgba(250,253,255,0.85)';
        drawTwig(g, TWA, thA, 0, 'iceTips'); drawTwig(g, MAIN, thMain, 0.03, 'iceTips');
        return;
      }
      drawTwig(g, TWA, thA, 0, mode);
      drawTwig(g, MAIN, thMain, 0.03, mode);
    });

    // 半分辨率临时画布：每帧整张重画，不在帧间保留内容
    let halfBuf = null;
    const half = () => {
      const S = ((XYT.sprites && XYT.sprites.S) || 1) * 0.5;
      const w = Math.round(W * S), h = Math.round(H * S);
      if (!halfBuf) halfBuf = document.createElement('canvas');
      if (halfBuf.width !== w || halfBuf.height !== h) { halfBuf.width = w; halfBuf.height = h; }
      const g = halfBuf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      g.setTransform(S, 0, 0, S, 0, 0);
      return g;
    };

    // ---------- 背景：远岸、河面（整体重度虚化），冷暖两版 ----------
    const bgLayer = (warm) => K.cache('o1:bg:' + warm, W, H, 0.5, (g) => {
      const C = warm
        ? { s0: '#f6efdc', s1: '#eef1e0', glare: 'rgba(255,240,206,1)', bank: '#a8caa0', bank2: '#88b58a', bank3: '#6b977a', pink: '#f0b4c2',
            r0: '#7fa58c', w1: '#a9c7bd', w2: '#89aeb0', w3: '#6f979c', sun: 'rgba(255,240,208,0.95)' }
        : { s0: '#e4eaec', s1: '#e2e8e8', glare: 'rgba(250,252,255,0.8)', bank: '#a9b9b8', bank2: '#93a6a8', bank3: '#7f9497', pink: '#cdbcc4',
            r0: '#8fa2a8', w1: '#b3c4cb', w2: '#9bb0ba', w3: '#86a0ac', sun: 'rgba(246,250,255,0.55)' };
      const bank = (tg, k, col, y0, amp, sd) => {
        tg.fillStyle = col;
        tg.beginPath(); tg.moveTo(0, HORIZON + 4);
        for (let x = 0; x <= W; x += 8) tg.lineTo(x, y0 - amp * (fbm(x / 240 + k, sd, 4) + 0.5));
        tg.lineTo(W, HORIZON + 4); tg.closePath(); tg.fill();
      };
      // 不透明的底：模糊层的边缘会变透明，先垫一层同色渐变
      g.fillStyle = A.vgrad(g, 0, H, [[0, C.s0], [HORIZON / H, C.r0], [0.55, C.w2], [1, C.w3]]);
      g.fillRect(0, 0, W, H);
      blurInto(g, W, H, 26, (tg) => {
        // 天：右上最亮
        tg.fillStyle = A.vgrad(tg, 0, HORIZON, [[0, C.s0], [1, C.s1]]); tg.fillRect(0, 0, W, HORIZON + 4);
        // 远岸：三层树丛，左侧更暗
        bank(tg, 0, C.bank, HORIZON - 70, 70, 3);
        for (let i = 0; i < 12; i++) {
          const x = h2(i, 41) * W, y = HORIZON - 50 - 50 * h2(i, 42), r = 26 + 34 * h2(i, 43);
          tg.fillStyle = rgba(C.pink, 0.8);
          tg.beginPath(); tg.ellipse(x, y, r * 1.3, r, 0, 0, TAU); tg.fill();
        }
        bank(tg, 3, C.bank2, HORIZON - 30, 50, 7);
        const sh = tg.createLinearGradient(0, 0, W, 0);
        sh.addColorStop(0, rgba(C.bank3, 0.75)); sh.addColorStop(0.55, rgba(C.bank3, 0.2)); sh.addColorStop(1, rgba(C.bank3, 0));
        tg.fillStyle = sh; tg.fillRect(0, HORIZON - 110, W, 114);
        // 河面：上部是远岸倒影（暗绿），往下渐转青蓝
        tg.fillStyle = A.vgrad(tg, HORIZON, H, [[0, C.r0], [0.22, C.w1], [0.55, C.w2], [1, C.w3]]);
        tg.fillRect(0, HORIZON, W, H - HORIZON);
        tg.save(); tg.globalAlpha = 0.55; tg.translate(0, 2 * HORIZON); tg.scale(1, -1);
        bank(tg, 0, C.bank3, HORIZON - 70, 70, 3); bank(tg, 3, C.bank3, HORIZON - 30, 50, 7);
        tg.restore();
        tg.fillStyle = A.vgrad(tg, HORIZON, HORIZON + 160, [[0, 'rgba(0,0,0,0)'], [1, rgba(C.w1, 1)]]);
        tg.globalAlpha = 0.6; tg.fillRect(0, HORIZON, W, 160); tg.globalAlpha = 1;
        // 日光在水面拉出的碎金带：由许多横向亮片组成，近水线处最亮最窄，往近处变宽变淡
        tg.fillStyle = C.sun;
        for (let i = 0; i < 160; i++) {
          const v = Math.pow(h2(i, 131), 1.5), y = HORIZON + 4 + v * (H * 0.72 - HORIZON);
          const spread = 70 + 210 * v, x = 1050 + (h2(i, 132) + h2(i, 133) - 1) * spread;
          tg.globalAlpha = (0.75 - 0.6 * v) * (0.4 + 0.6 * h2(i, 134));
          tg.beginPath(); tg.ellipse(x, y, 16 + 50 * h2(i, 135) * (0.5 + v), 2 + 5 * v, 0, 0, TAU); tg.fill();
        }
        tg.globalAlpha = 0.8;
        tg.beginPath(); tg.ellipse(1050, HORIZON + 14, 190, 22, 0, 0, TAU); tg.fill();
        tg.globalAlpha = 1;
        // 近处水面：天光与远岸的大片柔和明暗
        for (let i = 0; i < 9; i++) {
          const x = h2(i, 141) * W, y = HORIZON + 140 + 300 * h2(i, 142);
          tg.fillStyle = h2(i, 143) < 0.5 ? rgba('#ffffff', 0.12) : rgba(C.bank3, 0.14);
          tg.beginPath(); tg.ellipse(x, y, 160 + 200 * h2(i, 144), 30 + 40 * h2(i, 145), 0, 0, TAU); tg.fill();
        }
        // 天上的日晕
        const sg = tg.createRadialGradient(SUN[0], SUN[1], 10, SUN[0], SUN[1], 760);
        sg.addColorStop(0, C.glare); sg.addColorStop(0.45, rgba('#ffffff', 0.25)); sg.addColorStop(1, 'rgba(255,255,255,0)');
        tg.fillStyle = sg; tg.fillRect(0, 0, W, H);
        // 远水的横纹
        for (let i = 0; i < 70; i++) {
          const v = h2(i, 61), y = HORIZON + 10 + Math.pow(v, 1.4) * (H - HORIZON);
          tg.fillStyle = h2(i, 64) < 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(40,70,80,0.08)';
          tg.beginPath(); tg.ellipse(h2(i, 63) * W, y, 120 + 300 * h2(i, 62), 3 + 8 * v, 0, 0, TAU); tg.fill();
        }
      });
    });
    // 对焦平面上的水纹（较清晰），可横向平铺，随水流右移
    const nearWater = () => K.cache('o1:nearwater', W, 180, 1, (g) => {
      for (let i = 0; i < 150; i++) {
        const v = h2(i, 71);
        const y = 6 + v * 168, x = h2(i, 73) * W;
        const len = 8 + 46 * Math.pow(h2(i, 72), 1.6) * (0.5 + v);
        const foc = Math.exp(-Math.pow((y - 90) / 52, 2));
        const light = h2(i, 74) < 0.6;
        const a = (0.15 + 0.85 * h2(i, 75)) * foc;
        for (const dx of [0, -W, W]) {
          g.strokeStyle = light ? `rgba(255,253,244,${0.32 * a})` : `rgba(48,84,92,${0.12 * a})`;
          g.lineWidth = (light ? 0.8 : 1.2) * (0.7 + 0.6 * v);
          g.beginPath(); g.moveTo(x + dx - len, y); g.quadraticCurveTo(x + dx, y - 1.5 - 1.5 * v, x + dx + len, y); g.stroke();
        }
      }
    });
    // 光斑精灵
    const bokehSpr = (warm) => K.cache('o1:bokeh:' + warm, 64, 64, 1, (g) => {
      const col = warm ? '255,240,206' : '236,244,255';
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
      gr.addColorStop(0, `rgba(${col},0.62)`); gr.addColorStop(0.7, `rgba(${col},0.66)`);
      gr.addColorStop(0.9, `rgba(${col},0.78)`); gr.addColorStop(0.97, `rgba(${col},0.3)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, TAU); g.fill();
    });
    const glowSpr = () => K.cache('o1:glow', 64, 64, 1, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,250,236,1)'); gr.addColorStop(0.3, 'rgba(255,244,220,0.45)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    // 前景虚化的桃枝（左上角，离镜头最近）：先画出枝与花的形，再整体虚化；缓存坐标 = 画面坐标 + (40, 50)
    const foreBlur = (mode) => K.cache('o1:fore:' + mode, 420, 300, 0.5, (g) => {
      blurInto(g, 420, 300, 10, (tg) => {
        tg.strokeStyle = rgba(pc('#48322c', mode), 0.9); tg.lineWidth = 15; tg.lineCap = 'round';
        tg.beginPath(); tg.moveTo(-10, 215); tg.quadraticCurveTo(120, 150, 290, 20); tg.stroke();
        const fl = (x, y, L, rot, tilt, sp) => {
          tg.save(); tg.translate(x, y); tg.rotate(rot); tg.scale(1, tilt);
          for (let k = 0; k < 5; k++) {
            tg.save(); tg.rotate(sp + k * TAU / 5);
            const gr = tg.createLinearGradient(0, 0, L, 0);
            gr.addColorStop(0, pc('#d7698b', mode)); gr.addColorStop(0.4, pc('#f0a9bb', mode)); gr.addColorStop(1, pc('#fbe3e9', mode));
            tg.fillStyle = gr; tg.fill(petalPath(L, L * 0.8));
            tg.restore();
          }
          tg.fillStyle = pc('#c55578', mode); tg.beginPath(); tg.arc(0, 0, L * 0.18, 0, TAU); tg.fill();
          tg.restore();
        };
        fl(118, 150, 66, 0.3, 0.82, 0.4);
        fl(232, 70, 48, -0.6, 0.72, 1.1);
        tg.fillStyle = pc('#e88aa4', mode);
        tg.beginPath(); tg.ellipse(44, 182, 15, 10, -0.9, 0, TAU); tg.fill();
      });
    });

    // 融水珠：位置（枝下沿）与出现时间
    const BEADS = [];
    for (let i = 0; i < 12; i++) {
      const u = 0.12 + 0.7 * (i + h2(i, 91) * 0.6) / 12;
      BEADS.push({ u, t0: 1.0 + 2.6 * h2(i, 92), r: 2.4 + 2.0 * h2(i, 93) });
    }
    // 瓣局部（瓣根为原点、瓣尖朝 +x）→ 花局部（挂点为原点）
    const petalMat = (f, p) => { const G = flowerGeo(f); return mChain(mT(G.cx, G.cy), mR(f.rot), mS(1, f.tilt), mR(p.a)); };
    // 花瓣上的融水珠：只放在前排的瓣上，记瓣局部坐标（飘落瓣上的随瓣一起走）
    const petalBeads = (f) => {
      const G = flowerGeo(f), out = [];
      G.pet.forEach((p, j) => {
        if (j < 2 || h2(f.seed, j + 90) > 0.5) return;
        const lx = p.Lk * (0.68 + 0.17 * h2(f.seed, j + 91)), ly = p.wk * (h2(f.seed, j + 92) - 0.5) * 0.4;
        const q = mApply(petalMat(f, p), lx, ly);
        out.push({ k: p.k, lx, ly, x: q[0], y: q[1], r: 2.2 + 1.6 * h2(f.seed, j + 93), t0: 2.0 + 1.8 * h2(f.seed, j + 94) });
      });
      return out;
    };
    FLOWERS.forEach((f) => { f.beads = petalBeads(f); });
    // 被花或下垂的苞挡住的枝下水珠不画
    const hiddenBead = (q) => FLOWERS.some((f) => { const G = flowerGeo(f); return Math.hypot(q[0] - f.at[0] - G.cx, q[1] - f.at[1] - G.cy) < f.L * 0.95; })
      || BUDS.some((b) => Math.hypot(q[0] - b.at[0] - Math.cos(b.ang) * b.L * 0.55, q[1] - b.at[1] - Math.sin(b.ang) * b.L * 0.55) < b.L * 0.62);
    const underside = (u, r) => {
      const p = bez(MAIN, u), tg = bezT(MAIN, u);
      let nx = tg[1], ny = -tg[0];
      if (ny > 0) { nx = -nx; ny = -ny; }
      const w = thMain(u) * 0.5 + r * 0.8;
      return [p[0] - nx * w, p[1] - ny * w];
    };
    BEADS.forEach((b) => { b.hid = hiddenBead(underside(b.u, b.r)); });
    // 冰上的闪光点：枝上沿的（被花苞挡住的不要，其余先于花画）与花瓣迎光边的（画在花上）
    const GLINTS_BR = [], GLINTS_PE = [];
    for (let i = 0; i < 7; i++) {
      const u = 0.12 + 0.8 * (i + 0.5 * h2(i, 120)) / 7, p = bez(MAIN, u), tg = bezT(MAIN, u);
      let nx = tg[1], ny = -tg[0]; if (ny > 0) { nx = -nx; ny = -ny; }
      const w = thMain(u) * 0.5 + 4, q = [p[0] + nx * w, p[1] + ny * w];
      if (!hiddenBead(q)) GLINTS_BR.push({ x: q[0], y: q[1], s: 5 + 5 * h2(i, 121), ph: h2(i, 122) });
    }
    FLOWERS.forEach((f, j) => {
      const G = flowerGeo(f);
      GLINTS_PE.push({ x: f.at[0] + G.cx + f.L * 0.55, y: f.at[1] + G.cy - f.L * 0.45 * f.tilt, s: 6 + 4 * h2(j, 123), ph: h2(j, 124) });
    });
    function bead(g, x, y, r, a, sy, glint) {
      if (r <= 0.05 || a <= 0.01) return;
      g.save(); g.translate(x, y); g.scale(1, sy || 1); g.globalAlpha = a;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(210,230,236,0.35)'); gr.addColorStop(1, 'rgba(90,110,120,0.55)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,246,226,0.85)';
      g.beginPath(); g.arc(-r * 0.15, r * 0.45, r * 0.32, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(r * 0.35, -r * 0.38, Math.max(0.6, r * 0.24), 0, TAU); g.fill();
      g.restore();
      if (glint > 0.01) {
        g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, glint);
        g.drawImage(glowSpr(), x + r * 0.35 - r * 3, y - r * 0.38 - r * 3, r * 6, r * 6);
        g.restore();
      }
    }

    // 涟漪：一圈圈从落点向外扩散并衰减（远侧亮、近侧暗）
    function rings(g, x, y, age, amp, n, sp, ratio) {
      for (let k = 0; k < n; k++) {
        const a2 = age - k * 0.08;
        if (a2 <= 0) continue;
        const r = 4 + sp * a2 * (1 - 0.22 * Math.min(a2, 1.5));
        const al = amp * Math.exp(-a2 / 0.7) * smooth(a2 / 0.05) * (1 - k * 0.25);
        if (al < 0.012) continue;
        g.lineWidth = 2.2 - k * 0.4;
        g.strokeStyle = `rgba(255,251,238,${0.7 * al})`;
        g.beginPath(); g.ellipse(x, y, r, r * ratio, 0, Math.PI * 1.04, Math.PI * 1.96); g.stroke();
        g.strokeStyle = `rgba(48,80,88,${0.32 * al})`;
        g.beginPath(); g.ellipse(x, y + 1.5, r * 0.98, r * ratio, 0, 0.12, Math.PI - 0.12); g.stroke();
      }
    }
    // 叶、苞、花随风轻颤（风向右）：时间的纯函数，冰化尽之前为零
    const tremAt = (tau) => smooth((tau - 3.6) / 1.8);
    // 强拍上的一阵风：0.15 s 缓起、1 s 回落（不是开关）
    const gustAt = (c, tau) => {
      if (!c.grid || !c.grid.info) return 0;
      const sd = c.grid.info(c.t - c.lt + tau).sinceDown;
      return sd > 0 ? smooth(sd / 0.15) * Math.exp(-sd / 1.0) : 0;
    };
    const swing = (c, i, kind, tau) => {
      const amp = kind === 'f' ? 0.045 : 0.03;
      return tremAt(tau) * amp * (0.55 * Math.sin(TAU * (0.62 + 0.2 * h2(i, 1)) * tau + 6 * h2(i, 2)) + 0.3 * Math.sin(TAU * (1.05 + 0.15 * h2(i, 3)) * tau + 6 * h2(i, 4)) + 0.3 + 0.3 * gustAt(c, tau));
    };
    // 飘落瓣：几何与时长
    const FB = FLOWERS[4];
    const PK = flowerGeo(FB).pet.find((q) => q.k === PETAL_K);
    const FK = petalMat(FB, PK), FKI = mInv(FK);
    const FALL = 0.55, DRIFT = 110, LAND = 0.15;
    // 浮在水面上的瓣（af = 触水后的秒数；可取负值，用于触水前的衔接）
    const floatMat = (px0, af) => mChain(mT(px0 + FLOW * af, WATER_Y + 4 + 0.6 * Math.sin(af * 2.6)), mS(1, 0.36), mR(0.35 + 0.1 * af), mT(-PK.Lk * 0.5, 0));
    // 飘落中的瓣：瓣局部 → 画面
    function fallMat(c, a, tPetal) {
      const M0 = mChain(mT(FB.at[0], FB.at[1]), mR(swing(c, 4, 'f', tPetal)), FK);
      const p0 = mApply(M0, PK.Lk * 0.5, 0);
      const lx0 = Math.hypot(M0[0], M0[1]);
      const th0 = Math.atan2(M0[1], M0[0]), sy0 = (M0[0] * M0[3] - M0[1] * M0[2]) / lx0;
      const k = clamp(a / FALL), tau = 0.035;
      // 竖直：空气阻力下很快到终速；水平：顺风漂移，末速度等于水流速度
      const dist = (x) => x - tau * (1 - Math.exp(-x / tau));
      const y = lerp(p0[1], WATER_Y + 4, dist(a) / dist(FALL));
      const m1 = FLOW * FALL / DRIFT;
      const hk = k * k * (3 - 2 * k) + m1 * (k * k * k - k * k);
      const land = smooth((a - (FALL - LAND)) / LAND), wob = 1 - land;
      const x = p0[0] + DRIFT * hk + 16 * Math.sin(TAU * 2.2 * a) * smooth(a / 0.12) * (1 - 0.5 * k) * wob;
      const th = lerp(th0, 0.25, smooth(a / 0.3)) + 0.35 * Math.sin(TAU * 2.2 * a) * wob;
      const sx = lerp(lx0, 1, smooth(a / 0.3));
      const sy = lerp(sy0, 0.62, smooth(a / 0.3)) * lerp(1, 0.78 + 0.22 * Math.cos(TAU * 1.4 * a), wob);
      let M = mChain(mT(x, y), mR(th), mS(sx, sy), mT(-PK.Lk * 0.5, 0));
      // 脱落：从花上的姿态平滑过渡；触水：平滑过渡到浮在水面的姿态
      M = mLerp(M0, M, smooth(a / 0.25));
      return mLerp(M, floatMat(p0[0] + DRIFT, a - FALL), land);
    }
    const touchX = (c, tPetal) => mApply(mChain(mT(FB.at[0], FB.at[1]), mR(swing(c, 4, 'f', tPetal)), FK), PK.Lk * 0.5, 0)[0] + DRIFT;
    // 画飘落瓣：用花上同一张瓣精灵（花局部坐标），保证脱落那一帧与花上一模一样
    const drawPk = (g, M) => {
      const sp = SPR(FB, 'f', 'warm', 'pk');
      g.save(); g.transform(...mMul(M, FKI));
      g.drawImage(sp, -sp.lw / 2, -sp.lh / 2, sp.lw, sp.lh);
      g.restore();
    };

    // ---------- 水珠（主画面与倒影共用） ----------
    // K：{ tDet 脱落, tLand 落水, dropX, hangY, shine }；gl = 0 时不加闪光（倒影里不要）
    // 主角水珠：在枝下沿聚起 → 沿枝滑到梢头 → 悬垂长大 → 脱落；落下后梢头又慢慢聚起一颗
    function hangingDrops(gx, t, K, gl) {
      const grow = smooth((t - 1.3) / 0.6);
      const slide = easeInOut((t - 1.9) / 1.45);
      let r = lerp(0, 4.6, grow), sy = 1, pos;
      if (t < 3.35) pos = underside(lerp(0.8, 0.985, slide), r);
      else {
        const hk = clamp((t - 3.35) / Math.max(0.1, K.tDet - 3.35));
        r = lerp(4.6, 6.3, hk); sy = 1 + 0.35 * hk * hk;
        const e2 = underside(0.985, 4.6), m = smooth((t - 3.35) / 0.35);
        pos = [lerp(e2[0], K.dropX, m), lerp(e2[1], K.hangY - 5, m) + (sy - 1) * r];
      }
      if (t < K.tDet && grow > 0) bead(gx, pos[0], pos[1], r, 0.95, sy, gl * (0.35 + 0.4 * K.shine * (0.5 + 0.5 * smooth((t - 3.1) / 0.4))));
      if (t > K.tLand + 0.6) {
        const k2 = smooth((t - K.tLand - 0.6) / 2.5);
        bead(gx, K.dropX, K.hangY - 6 + 3.6 * k2, 3.6 * k2, 0.9, 1.1, gl * 0.25 * k2);
      }
    }
    // 下落的水滴（约 0.1 s），带运动模糊
    function fallingDrop(gx, t, K) {
      if (t < K.tDet || t >= K.tLand) return;
      const a = t - K.tDet, y = K.hangY + 0.5 * GPX * a * a, v = GPX * a;
      const len = Math.min(70, 6 + v / 60);
      gx.save(); gx.lineCap = 'round';
      gx.strokeStyle = 'rgba(232,242,246,0.75)'; gx.lineWidth = 7;
      gx.beginPath(); gx.moveTo(K.dropX, y - len); gx.lineTo(K.dropX, y); gx.stroke();
      gx.strokeStyle = 'rgba(255,255,255,0.95)'; gx.lineWidth = 2.2;
      gx.beginPath(); gx.moveTo(K.dropX + 0.8, y - len); gx.lineTo(K.dropX + 0.8, y); gx.stroke();
      gx.restore();
    }
    // 落点弹起的小水柱
    function splash(gx, t, K, gl) {
      const a = t - K.tLand;
      if (a > 0 && a < 0.14) bead(gx, K.dropX, WATER_Y - 20 * Math.sin(Math.PI * a / 0.14), 2.8, 1 - a / 0.14 * 0.4, 1.2, gl * 0.4);
    }

    // ---------- 倒影 ----------
    // 只有枝梢一带离水够近：y > 2·WATER_Y − H 的部分，倒影 y' = 2·WATER_Y − y 才落进画面
    // 1/4 分辨率里镜像画出 → 逐行横向错动（水波）缩进 1/8 分辨率（虚像远在焦外，大片虚化）→ 压暗偏冷 → 叠到水面
    const RX0 = 470, RW = 560, RH = H + 8 - WATER_Y;
    const REFL_ITEMS = [];
    LEAVES.forEach((it, i) => { if (it.at[1] + it.L > 2 * WATER_Y - H - 8) REFL_ITEMS.push([it, 'l', i + 20]); });
    BUDS.forEach((it, i) => { if (it.at[1] + it.L > 2 * WATER_Y - H - 8) REFL_ITEMS.push([it, 'b', i + 10]); });
    const rBufs = [null, null];
    const rBuf = (k, sc) => {
      const w = Math.ceil(RW * sc), h = Math.ceil(RH * sc);
      if (!rBufs[k]) rBufs[k] = document.createElement('canvas');
      const cv = rBufs[k];
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const x = cv.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, w, h);
      return [cv, x];
    };
    // 缓存图层里只取倒影用得到的那一块（画面 y ∈ [2·WATER_Y − H − 8, BH]）
    const blitPart = (gx, img, ox, oy) => {
      const ps = img.width / img.lw, x0 = Math.max(RX0, ox), x1 = Math.min(RX0 + RW, ox + img.lw), y0 = WATER_Y - RH, y1 = Math.min(WATER_Y, oy + img.lh);
      if (x1 <= x0 || y1 <= y0) return;
      gx.drawImage(img, (x0 - ox) * ps, (y0 - oy) * ps, (x1 - x0) * ps, (y1 - y0) * ps, x0, y0, x1 - x0, y1 - y0);
    };
    function reflection(g, c, t, ice, K, Mfall, fallA) {
      const S = (XYT.sprites && XYT.sprites.S) || 1, sA = S * 0.25, sB = S * 0.125;
      const [ca, ga] = rBuf(0, sA);
      // 画面 → 镜像缓冲：x' = (x − RX0)·s，y' = (WATER_Y − y)·s
      ga.setTransform(sA, 0, 0, -sA, -RX0 * sA, WATER_Y * sA);
      blitPart(ga, branchLayer('bark'), BX, 0);
      if (ice > 0.003) { ga.globalAlpha = ice; blitPart(ga, branchLayer('ice'), BX, 0); ga.globalAlpha = 1; }
      for (const [it, kind, i] of REFL_ITEMS) {
        ga.save(); ga.translate(it.at[0], it.at[1]); ga.rotate(swing(c, i, kind, t));
        for (const [mode, a] of [['warm', 1], ['cold', ice]]) {
          if (a <= 0.003) continue;
          const sp = SPR(it, kind, mode); ga.globalAlpha = a; ga.drawImage(sp, -sp.lw / 2, -sp.lh / 2, sp.lw, sp.lh);
        }
        ga.restore(); ga.globalAlpha = 1;
      }
      hangingDrops(ga, t, K, 0);
      fallingDrop(ga, t, K);
      splash(ga, t, K, 0);
      // 飘落瓣：贴近水面时与倒影合一
      if (Mfall) { ga.globalAlpha = 1 - smooth((fallA - (FALL - LAND)) / LAND); drawPk(ga, Mfall); ga.globalAlpha = 1; }
      // 横向水波：每 4 px 一行错动，离水线越远（越近镜头）波越大；只有飘落瓣在时才用到右半边
      const [cb, gb] = rBuf(1, sB), rw = Mfall ? RW : 280;
      for (let y = 0; y < RH; y += 4) {
        const d = y + 2, amp = 2 + 0.04 * d;
        const dx = amp * (Math.sin(d * 0.23 - t * 2.1) + 0.5 * Math.sin(d * 0.09 + t * 1.3 + 1.7));
        gb.drawImage(ca, 0, y * sA, rw * sA, 4 * sA, dx * sB, y * sB, rw * sB, 4 * sB);
      }
      // 比实物暗约 35%，偏向水色
      gb.globalCompositeOperation = 'source-atop'; gb.fillStyle = 'rgba(30,54,62,0.38)'; gb.fillRect(0, 0, rw * sB, cb.height);
      g.save(); g.globalAlpha = 0.55; g.imageSmoothingEnabled = true;
      g.drawImage(cb, 0, 0, rw * sB, cb.height, RX0, WATER_Y, rw, RH);
      g.restore();
    }

    XYT.registerShot('o1_thaw', {
      name: '春回', zone: 'bottom', night: false, text: '#2c3a30', shadow: 'rgba(248,246,236,0.9)', accent: '#e88ca0', bloom: 0.3,
      draw(g, c) {
        const t = c.lt, dur = c.dur;
        // 光由冷转暖；冰先被照亮、再变薄；冰化后花才开始颤动
        const warm = smooth((t + 0.4) / 3.8);
        const shine = smooth((t + 0.2) / 1.6);
        const melt = smooth((t - 0.4) / 3.2);
        const ice = 1 - melt;
        const be = c.be ? c.be(0.45) : 0;
        // 关键时刻：融水在强拍落水（下落时间按自由落体），花瓣在下一个强拍脱落
        const tip = bez(MAIN, 1);
        const dropX = tip[0] - 1, hangY = tip[1] + 10;
        const tLand = beatNear(c, 3.98, 0.35);
        const tFall = Math.sqrt(2 * (WATER_Y - hangY) / GPX);
        const tDet = tLand - tFall;
        const tPetal = beatNear(c, 4.81, 0.35);
        const tTouch = tPetal + FALL;
        const KD = { tDet, tLand, dropX, hangY, shine };
        const falling = t >= tPetal && t < tTouch, split = t >= tPetal;
        const Mfall = falling ? fallMat(c, t - tPetal, tPetal) : null;

        // 镜头：整镜 1.00→1.05 缓推；远景只推 1.02
        const e = easeInOut((t + 1.2) / (dur + 1.2));
        const zB = 1 + 0.02 * e, zN = 1 + 0.05 * e;
        // 远景先在半分辨率里冷暖交叠、加光斑，再整体放大一次
        const hg = half();
        if (warm < 0.997) hg.drawImage(bgLayer(0), 0, 0, W, H);
        if (warm > 0.003) { hg.globalAlpha = warm; hg.drawImage(bgLayer(1), 0, 0, W, H); hg.globalAlpha = 1; }
        {
          // 水面光斑：在亮带里随机亮起又熄灭（平滑淡入淡出）
          hg.globalCompositeOperation = 'screen';
          const bs0 = bokehSpr(0), bs1 = bokehSpr(1);
          const bA = (0.45 + 0.55 * warm) * (1 + 0.12 * be);
          for (let i = 0; i < 22; i++) {
            const P = 2.6 + 2.6 * h2(i, 101), ph = h2(i, 102) * P;
            const s = (t + 2 + ph) / P, n = Math.floor(s), f = s - n;
            const a = Math.pow(Math.sin(Math.PI * f), 2);
            const q = i * 31 + n, v = h2(q, 103);
            const y = HORIZON + 10 + 250 * v * v;
            const x = 1050 + (h2(q, 104) + h2(q, 107) - 1) * (90 + 260 * v * v) + 2 * (t + 2);
            const r = 16 + 30 * h2(q, 105);
            const al = a * (0.18 + 0.4 * h2(q, 106)) * bA;
            if (al < 0.01) continue;
            if (warm < 0.997) { hg.globalAlpha = al * (1 - warm); hg.drawImage(bs0, x - r, y - r, r * 2, r * 2); }
            if (warm > 0.003) { hg.globalAlpha = al * warm; hg.drawImage(bs1, x - r, y - r, r * 2, r * 2); }
          }
          hg.globalAlpha = 1; hg.globalCompositeOperation = 'source-over';
        }
        g.save();
        g.translate(CAM[0], CAM[1]); g.scale(zB, zB); g.translate(-CAM[0], -CAM[1]);
        g.drawImage(halfBuf, 0, 0, W, H);
        g.restore();

        // 近景（与枝同一深度）
        g.save();
        g.translate(CAM[0], CAM[1]); g.scale(zN, zN); g.translate(-CAM[0], -CAM[1]);
        // 枝梢、水珠、飘落瓣在水面的倒影（先画，水纹的亮点压在倒影上）
        reflection(g, c, t, ice, KD, Mfall, t - tPetal);
        // 对焦处的水纹，随水流向右
        {
          const nw = nearWater(), off = ((t + 2) * FLOW) % W;
          g.globalAlpha = 0.5 + 0.5 * warm;
          g.drawImage(nw, -off, WATER_Y - 90, W, 180);
          g.drawImage(nw, W - off, WATER_Y - 90, W, 180);
          g.globalAlpha = 1;
        }
        // 融水落点的涟漪（随水流向右漂）与弹起的小水柱
        if (t > tLand) rings(g, dropX + FLOW * (t - tLand), WATER_Y, t - tLand, 1, 3, 420, 0.3);
        splash(g, t, KD, 1);
        // 落水后的花瓣：随水右漂，水面上有淡淡的影
        if (t >= tTouch) {
          const af = t - tTouch, px0 = touchX(c, tPetal);
          rings(g, px0 + FLOW * af, WATER_Y + 4, af, 0.45, 2, 260, 0.3);
          const Mf = floatMat(px0, af);
          g.save(); g.transform(...mMul(Mf, mT(PK.Lk * 0.5, 0)));
          g.globalAlpha = smooth(af / 0.3);
          g.fillStyle = 'rgba(50,80,88,0.16)'; g.beginPath(); g.ellipse(3, 8, PK.Lk * 0.5, PK.wk * 0.42, 0, 0, TAU); g.fill();
          g.restore();
          drawPk(g, Mf);
        }

        // 逆光的花瓣透亮：花后一层暖光（先于枝画，只在花周围的天光上显出）
        g.globalCompositeOperation = 'screen';
        for (const f of FLOWERS) {
          const G = flowerGeo(f), r = f.L * 1.7;
          g.globalAlpha = (0.12 + 0.2 * warm) * (1 + 0.1 * be);
          g.drawImage(glowSpr(), f.at[0] + G.cx - r + f.L * 0.15, f.at[1] + G.cy - r - f.L * 0.1, r * 2, r * 2);
        }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
        // 枝，冰壳
        g.drawImage(branchLayer('bark'), BX, 0, BW, BH);
        if (ice > 0.003) { g.globalAlpha = ice; g.drawImage(branchLayer('ice'), BX, 0, BW, BH); g.globalAlpha = 1; }
        // 枝下的融水珠：冰化成水，从无到有慢慢长出（被花挡住的不画）
        for (let i = 0; i < BEADS.length; i++) {
          const b = BEADS[i], k = smooth((t - b.t0) / 0.9);
          if (k <= 0 || b.hid) continue;
          const q = underside(b.u, b.r * k);
          bead(g, q[0], q[1], b.r * k, 0.9, 1.08, 0.3 * be * h2(i, 7));
        }
        // 枝上冰壳的高光与闪光点：先于叶、苞、花画，被花挡住
        const specA = ice * (0.3 + 0.7 * shine) * (1 + 0.2 * be);
        if (specA > 0.003) {
          g.globalCompositeOperation = 'lighter'; g.globalAlpha = ice * (0.3 + 0.7 * shine) * (1 + 0.15 * be);
          g.drawImage(branchLayer('spec'), BX, 0, BW, BH);
          g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
        }
        // 冰上的闪光：随晨光亮起，拍点上轻闪，冰化后消失
        const bt = c.be ? c.be(0.3) : 0;
        const glints = (list) => {
          if (ice <= 0.01) return;
          g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
          for (const q of list) {
            const tw = 0.45 + 0.35 * Math.sin(TAU * (0.4 + 0.3 * q.ph) * t + q.ph * 9) + 0.5 * bt * (0.4 + 0.6 * q.ph);
            const a = ice * shine * clamp(tw);
            if (a < 0.02) continue;
            const s2 = q.s * (0.8 + 0.3 * tw);
            g.globalAlpha = a;
            g.drawImage(glowSpr(), q.x - s2 * 1.6, q.y - s2 * 1.6, s2 * 3.2, s2 * 3.2);
            g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(q.x - s2, q.y); g.lineTo(q.x + s2, q.y); g.moveTo(q.x, q.y - s2 * 0.8); g.lineTo(q.x, q.y + s2 * 0.8); g.stroke();
          }
          g.restore();
        };
        glints(GLINTS_BR);
        // 叶、苞、花：冰封版随冰化渐隐，只改透明度与高光
        const spr = (it, kind, mode, a, part) => {
          if (a <= 0.003) return;
          const sp = SPR(it, kind, mode, part);
          g.globalAlpha = a; g.drawImage(sp, -sp.lw / 2, -sp.lh / 2, sp.lw, sp.lh);
        };
        const angs = {};
        const item = (it, kind, i) => {
          const ang = swing(c, i, kind, t);
          angs[it.id] = ang;
          const enter = () => { g.save(); g.translate(it.at[0], it.at[1]); g.rotate(ang); };
          enter();
          if (it === FB && split) {
            // 脱落后：瓣下的部分 → 飘落瓣 → 瓣上的部分与花心（同一层次顺序）
            spr(it, kind, 'warm', 1, 'lo');
            g.globalAlpha = 1; g.restore();
            if (falling) drawPk(g, Mfall);
            enter();
            spr(it, kind, 'warm', 1, 'hi');
          } else {
            spr(it, kind, 'warm', 1);
            spr(it, kind, 'cold', ice);
            if (specA > 0.003) { g.globalCompositeOperation = 'lighter'; spr(it, kind, 'spec', specA); g.globalCompositeOperation = 'source-over'; }
          }
          g.globalAlpha = 1;
          g.restore();
        };
        LEAVES.forEach((it, i) => item(it, 'l', i + 20));
        BUDS.forEach((it, i) => item(it, 'b', i + 10));
        FLOWERS.forEach((it, i) => item(it, 'f', i));
        // 花瓣上的融水珠：跟随各自的花颤动；飘落瓣上的随瓣走、0.3 s 内散去
        for (const f of FLOWERS) {
          const ang = angs[f.id], ca = Math.cos(ang), sa = Math.sin(ang);
          for (const q of f.beads) {
            let k = smooth((t - q.t0) / 0.8);
            if (k <= 0) continue;
            if (f === FB && q.k === PETAL_K && split) {
              if (!falling) continue;
              const fa = 1 - smooth((t - tPetal) / 0.3);
              if (fa <= 0) continue;
              const p = mApply(Mfall, q.lx, q.ly);
              bead(g, p[0], p[1], q.r * k, 0.85 * fa, 1, 0.35 * be * k * fa);
              continue;
            }
            bead(g, f.at[0] + ca * q.x - sa * q.y, f.at[1] + sa * q.x + ca * q.y, q.r * k, 0.85, 1, 0.35 * be * k);
          }
        }
        // 花瓣迎光边的闪光（在花上）
        glints(GLINTS_PE);
        // 主角水珠与下落的水滴
        hangingDrops(g, t, KD, 1);
        fallingDrop(g, t, KD);
        g.restore();

        // 前景虚化花（左上，离镜头最近，视差最大）
        {
          const zF = 1 + 0.08 * e;
          g.save();
          g.translate(CAM[0], CAM[1]); g.scale(zF, zF); g.translate(-CAM[0], -CAM[1]);
          // 冰封时同样褪色，随冰化转为鲜润
          g.globalAlpha = 0.82;
          g.drawImage(foreBlur('warm'), -40, -50, 420, 300);
          if (ice > 0.003) { g.globalAlpha = 0.82 * ice; g.drawImage(foreBlur('cold'), -40, -50, 420, 300); }
          g.restore();
          g.globalAlpha = 1;
        }
      },
    });
  })();

  // ============================================================
  // o3_seal 落款：宣纸上两字自上而下显现，落一方朱印，渐暗终
  // ============================================================
  (function () {
    const CH = ['逍', '遥'];
    const CX = 966, CY = [228, 420], FS = 192;
    // 朱印与字列同一中线（字列墨色重心实测在 x≈965）
    const SEAL = [CX, 562, 56];
    let fontOK = false;
    const fontReady = () => {
      if (fontOK) return true;
      try { fontOK = document.fonts.check(`64px "Ma Shan Zheng"`, CH.join('')); } catch (e) { fontOK = false; }
      return fontOK;
    };
    // 宣纸：均匀的暖白，极淡的云絮与纤维
    const paper = () => K.cache('o3:paper', W, H, 0.5, (g) => {
      g.fillStyle = '#f2ecdf'; g.fillRect(0, 0, W, H);
      blurInto(g, W, H, 40, (tg) => {
        for (let i = 0; i < 40; i++) {
          tg.fillStyle = h2(i, 1) < 0.5 ? 'rgba(228,218,198,0.18)' : 'rgba(252,249,241,0.3)';
          tg.beginPath(); tg.ellipse(h2(i, 2) * W, h2(i, 3) * H, 80 + 160 * h2(i, 4), 50 + 100 * h2(i, 5), h2(i, 6) * 3, 0, TAU); tg.fill();
        }
      });
      g.lineCap = 'round';
      for (let i = 0; i < 700; i++) {
        const x = h2(i, 11) * W, y = h2(i, 12) * H, a = h2(i, 13) * TAU, len = 6 + 26 * h2(i, 14);
        g.strokeStyle = h2(i, 15) < 0.5 ? 'rgba(200,186,158,0.14)' : 'rgba(255,253,247,0.4)';
        g.lineWidth = 0.6 + 0.8 * h2(i, 16);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.5, y + Math.sin(a + 0.5) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
      }
    });
    // 左下角淡墨桃枝（写意）：干湿浓淡的枝、没骨点染的花与苞
    const peach = () => K.cache('o3:peach', 560, 400, 1, (g) => {
      const OY = 400;   // 缓存底边 = 画面底边
      const curve = (P, n) => { const o = []; for (let i = 0; i <= n; i++) o.push(bez(P, i / n)); return o; };
      // 一笔：整笔是一块闭合的锥形墨面（不重叠、无接缝），边缘略浓，再用纸色细线擦出飞白
      const brush = (P, w0, w1, ink, seed, taper) => {
        const N = 60, L = [], R = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, p = bez(P, u), tg = bezT(P, u);
          const w = lerp(w0, w1, Math.pow(u, 0.8)) * 0.5 * (0.88 + 0.24 * noise1(u * 7, seed)) * (u > 0.94 ? Math.sqrt((1 - u) / 0.06) * 0.7 + 0.3 : 1) * (taper ? 0.55 + 0.45 * smooth(u / 0.08) : 1);
          L.push([p[0] - tg[1] * w, p[1] + tg[0] * w]); R.push([p[0] + tg[1] * w, p[1] - tg[0] * w]);
        }
        const path = new Path2D();
        path.moveTo(L[0][0], L[0][1]);
        L.forEach((q) => path.lineTo(q[0], q[1]));
        for (let i = N; i >= 0; i--) path.lineTo(R[i][0], R[i][1]);
        path.closePath();
        g.fillStyle = `rgba(78,70,64,${0.5 * ink})`; g.fill(path);
        g.save(); g.clip(path);
        const edge = (pts, a, lw) => { g.strokeStyle = `rgba(40,35,32,${a * ink})`; g.lineWidth = lw; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); };
        edge(L, 0.45, w0 * 0.3); edge(R, 0.3, w0 * 0.18);
        for (let i = 0; i < 30; i++) {
          const u = 0.03 + 0.8 * h2(seed, i), u2 = Math.min(1, u + 0.05 + 0.08 * h2(seed, i + 40));
          const w = lerp(w0, w1, u) * 0.5, o = (h2(seed, i + 80) - 0.5) * 1.5 * w;
          const p0 = bez(P, u), p1 = bez(P, u2), t0 = bezT(P, u), t1 = bezT(P, u2);
          g.strokeStyle = h2(seed, i + 60) < 0.6 ? 'rgba(244,238,226,0.6)' : `rgba(36,32,30,${0.35 * ink})`; g.lineWidth = 0.6 + 0.7 * h2(seed, i + 70);
          g.beginPath(); g.moveTo(p0[0] - t0[1] * o, p0[1] + t0[0] * o); g.lineTo(p1[0] - t1[1] * o, p1[1] + t1[0] * o); g.stroke();
        }
        g.restore();
        // 苔点（节）
        for (let i = 0; i < 3; i++) {
          const u = 0.2 + 0.25 * i + 0.08 * h2(seed, i + 120), p = bez(P, u), tg = bezT(P, u);
          const side = h2(seed, i + 130) < 0.5 ? -1 : 1, w = lerp(w0, w1, u) * 0.5;
          g.fillStyle = `rgba(34,30,28,${0.65 * ink})`;
          g.beginPath(); g.ellipse(p[0] - tg[1] * w * side, p[1] + tg[0] * w * side, 2.2, 1.4, Math.atan2(tg[1], tg[0]) + 0.6, 0, TAU); g.fill();
        }
      };
      const B0 = [[-30, OY + 20], [70, OY - 60], [150, OY - 120], [300, OY - 190]];
      // 小枝从主枝的中线上生出
      const B1 = [bez(B0, 0.52), [150, OY - 160], [168, OY - 210], [186, OY - 268]];
      const B2 = [bez(B0, 0.8), [292, OY - 166], [356, OY - 150], [418, OY - 126]];
      const B3 = [[300, OY - 190], [330, OY - 214], [356, OY - 236], [372, OY - 262]];
      // 叶：细长的淡墨绿叶（桃与梅之别），画在枝后
      const leaf = (x, y, len, ang, a) => {
        g.save(); g.translate(x, y); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, len, 0);
        gr.addColorStop(0, `rgba(96,122,92,${0.55 * a})`); gr.addColorStop(1, `rgba(128,152,116,${0.35 * a})`);
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -len * 0.2, len, 0); g.quadraticCurveTo(len * 0.45, len * 0.14, 0, 0); g.fill();
        g.strokeStyle = `rgba(70,84,66,${0.35 * a})`; g.lineWidth = 0.6;
        g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(len * 0.5, -len * 0.04, len * 0.92, 0); g.stroke();
        g.restore();
      };
      leaf(300, OY - 190, 56, -0.35, 1); leaf(296, OY - 186, 46, 0.55, 0.85);
      leaf(186, OY - 268, 48, -1.0, 0.9); leaf(146, OY - 146, 42, 2.7, 0.8);
      brush(B0, 20, 5, 1, 5);
      brush(B1, 8, 2.4, 0.9, 7, true);
      brush(B2, 7, 2.2, 0.85, 9, true);
      brush(B3, 5.5, 2, 0.8, 11, true);
      // 没骨花：淡粉五瓣，水色在瓣缘略积，花心胭脂一点，墨线蕊
      const flower = (x, y, r, rot, a, open) => {
        const op = open || 1;
        // 先用纸色垫底，枝不透过花瓣
        g.fillStyle = '#f2ecdf';
        for (let k = 0; k < 5; k++) {
          const ang = rot + k * TAU / 5 + 0.12 * (h2(k, Math.round(x + y)) - 0.5);
          g.beginPath(); g.ellipse(x + Math.cos(ang) * r * 0.58, y + Math.sin(ang) * r * 0.58 * op, r * 0.58, r * 0.5 * op, ang, 0, TAU); g.fill();
        }
        for (let k = 0; k < 5; k++) {
          const ang = rot + k * TAU / 5 + 0.12 * (h2(k, Math.round(x + y)) - 0.5);
          const px = x + Math.cos(ang) * r * 0.58, py = y + Math.sin(ang) * r * 0.58 * op;
          const gr = g.createRadialGradient(px, py, 0, px, py, r * 0.64);
          gr.addColorStop(0, `rgba(246,218,222,${0.5 * a})`); gr.addColorStop(0.7, `rgba(236,190,198,${0.62 * a})`);
          gr.addColorStop(0.92, `rgba(222,160,174,${0.55 * a})`); gr.addColorStop(1, `rgba(222,160,174,0)`);
          g.fillStyle = gr;
          g.beginPath(); g.ellipse(px, py, r * 0.64, r * 0.56 * op, ang, 0, TAU); g.fill();
        }
        const cg = g.createRadialGradient(x, y, 0, x, y, r * 0.42);
        cg.addColorStop(0, `rgba(196,96,120,${0.55 * a})`); cg.addColorStop(1, 'rgba(196,96,120,0)');
        g.fillStyle = cg; g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill();
        g.strokeStyle = `rgba(52,44,40,${0.55 * a})`; g.lineWidth = 0.6;
        for (let k = 0; k < 9; k++) {
          const ang = k / 9 * TAU + 0.2, l = r * (0.36 + 0.14 * h2(k, Math.round(x)));
          const ex = x + Math.cos(ang) * l, ey = y + Math.sin(ang) * l * op;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2 + 1, (y + ey) / 2 - 1, ex, ey); g.stroke();
          g.fillStyle = `rgba(52,44,40,${0.7 * a})`;
          g.beginPath(); g.arc(ex, ey, 1.1, 0, TAU); g.fill();
        }
      };
      const bud = (x, y, r, ang, a) => {
        g.save(); g.translate(x, y); g.rotate(ang);
        g.fillStyle = `rgba(226,160,174,${0.8 * a})`;
        g.beginPath(); g.ellipse(r * 0.5, 0, r * 0.7, r * 0.48, 0, 0, TAU); g.fill();
        g.fillStyle = `rgba(56,48,44,${0.6 * a})`;
        g.beginPath(); g.moveTo(-r * 0.2, 0); g.quadraticCurveTo(r * 0.1, -r * 0.5, r * 0.35, -r * 0.2); g.quadraticCurveTo(r * 0.1, 0, r * 0.35, r * 0.2); g.quadraticCurveTo(r * 0.1, r * 0.5, -r * 0.2, 0); g.fill();
        g.restore();
      };
      flower(188, OY - 276, 21, 0.4, 1, 1);
      flower(146, OY - 150, 18, 1.1, 0.95, 0.8);
      flower(304, OY - 200, 20, 0.2, 1, 0.9);
      flower(420, OY - 128, 16, 0.9, 0.9, 0.85);
      flower(66, OY - 46, 17, 0.6, 0.85, 0.75);
      flower(246, OY - 176, 12, 1.3, 0.8, 0.6);
      bud(372, OY - 264, 7, -1.2, 1); bud(356, OY - 152, 6, -0.6, 0.9); bud(176, OY - 214, 6, -2.2, 0.9);
      bud(108, OY - 88, 6, -2.6, 0.85); bud(328, OY - 214, 5, -2.0, 0.8);
    });
    // 两字：浓墨、边缘轻洇；墨色有不分方向的浓淡团块，笔画内缘积墨略深
    const glyph = (k) => K.cache(`o3:ch${k}:${fontReady() ? 1 : 0}`, 260, 260, 1, (g) => {
      const font = `${FS}px ${XYT.FONT}`;
      const sc = g.getTransform().a;
      const txt = (x, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font; x.fillStyle = col; x.fillText(CH[k], 130, 134); };
      const mk = () => {
        const c = document.createElement('canvas'); c.width = Math.round(260 * sc); c.height = Math.round(260 * sc);
        const x = c.getContext('2d'); x.scale(sc, sc); return [c, x];
      };
      // 洇开的淡墨
      blurInto(g, 260, 260, 3, (tg) => txt(tg, 'rgba(60,54,48,0.45)'));
      // 字芯
      const [cc, cx] = mk();
      txt(cx, '#332f2c');
      // 浓淡：模糊的圆团，只落在字内
      blurInto(cx, 260, 260, 6, (tg) => {
        for (let i = 0; i < 60; i++) {
          const q = i + k * 300, x = h2(q, 21) * 260, y = h2(q, 22) * 260, r = 6 + 16 * h2(q, 23);
          tg.fillStyle = h2(q, 24) < 0.5 ? 'rgba(120,112,104,0.32)' : 'rgba(8,8,8,0.4)';
          tg.beginPath(); tg.arc(x, y, r, 0, TAU); tg.fill();
        }
      }, 1, 'source-atop');
      // 内缘积墨：字形减去自身的模糊，剩下贴着边的一圈，再压深
      const [ec, ex] = mk();
      txt(ex, '#000');
      blurInto(ex, 260, 260, 2.5, (tg) => txt(tg, '#000'), 1, 'destination-out');
      cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.globalCompositeOperation = 'source-atop'; cx.globalAlpha = 0.55;
      cx.drawImage(ec, 0, 0);
      cx.restore();
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(cc, 0, 0); g.restore();
    });
    // 朱印：边缘略残、印面是抽象篆刻线
    const seal = () => K.cache('o3:seal', 80, 80, 2, (g) => {
      const s = SEAL[2];
      g.translate(40, 40);
      g.fillStyle = '#b8322a';
      g.beginPath();
      const n = 32;
      for (let i = 0; i <= n; i++) {
        const u = i / n, side = Math.min(3, Math.floor(u * 4)), f = u * 4 - side;
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]];
        const [ax, ay] = pts[side], [bx, by] = pts[side + 1];
        const j = (h2(i, 71) - 0.5) * 1.6;
        const px = (ax + (bx - ax) * f) * s / 2 + j, py = (ay + (by - ay) * f) * s / 2 + j * 0.7;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
      // 印面：白文，两列折线
      g.strokeStyle = '#f3e7d6'; g.lineCap = 'square'; g.lineWidth = 2.6;
      const m = s / 2 - 6;
      const col = (x0, seed) => {
        g.beginPath();
        g.moveTo(x0 - 8, -m + 4); g.lineTo(x0 + 8, -m + 4);
        g.moveTo(x0, -m + 4); g.lineTo(x0, -m + 14);
        g.moveTo(x0 - 9, -m + 14); g.lineTo(x0 + 9, -m + 14);
        g.moveTo(x0 - 9, -m + 14); g.lineTo(x0 - 9, 2);
        g.moveTo(x0 + 9, -m + 14); g.lineTo(x0 + 9, 2);
        g.moveTo(x0 - 5, -4 + 3 * h2(seed, 1)); g.lineTo(x0 + 5, -4 + 3 * h2(seed, 1));
        g.moveTo(x0 - 9, 8); g.lineTo(x0 + 9, 8);
        g.moveTo(x0 - 4, 8); g.lineTo(x0 - 4, m - 4);
        g.moveTo(x0 + 4, 8); g.lineTo(x0 + 4, m - 4);
        g.moveTo(x0 - 9, m - 4); g.lineTo(x0 + 9, m - 4);
        g.stroke();
      };
      col(-11, 3); col(11, 5);
      // 印泥不匀：细小的白点与缺口
      g.fillStyle = 'rgba(243,231,214,0.85)';
      for (let i = 0; i < 46; i++) {
        const x = (h2(i, 81) - 0.5) * s, y = (h2(i, 82) - 0.5) * s;
        g.beginPath(); g.arc(x, y, 0.4 + 0.9 * h2(i, 83), 0, TAU); g.fill();
      }
    });
    // 自上而下的羽化显现
    const reveal = (g, img, x, y, w, h, p) => {
      if (p <= 0) return;
      if (p >= 1) { g.drawImage(img, x, y, w, h); return; }
      const sc = revealBuf(img.width, img.height);
      const sg = sc.getContext('2d');
      sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
      sg.clearRect(0, 0, sc.width, sc.height);
      sg.drawImage(img, 0, 0);
      sg.globalCompositeOperation = 'destination-in';
      const edge = 0.22, yy = lerp(-edge, 1, p) * sc.height;
      const gr = sg.createLinearGradient(0, yy, 0, yy + edge * sc.height);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      sg.fillStyle = gr; sg.fillRect(0, 0, sc.width, sc.height);
      g.drawImage(sc, x, y, w, h);
    };
    let rb = null;
    const revealBuf = (w, h) => {
      if (!rb) rb = document.createElement('canvas');
      if (rb.width !== w || rb.height !== h) { rb.width = w; rb.height = h; }
      return rb;
    };

    XYT.registerShot('o3_seal', {
      name: '落款', zone: 'bottom', night: false, text: '#2a2a2a', shadow: 'rgba(241,235,221,0.9)', accent: '#b8322a', bloom: 0.28,
      draw(g, c) {
        const t = c.lt;
        g.drawImage(paper(), 0, 0, W, H);
        g.drawImage(peach(), 0, H - 400, 560, 400);
        // 两字：第一字 0.3–0.9 s，第二字 0.7–1.3 s
        const p0 = (t - 0.3) / 0.6, p1 = (t - 0.7) / 0.6;
        reveal(g, glyph(0), CX - 130, CY[0] - 130, 260, 260, clamp(p0));
        reveal(g, glyph(1), CX - 130, CY[1] - 130, 260, 260, clamp(p1));
        // 朱印：1.5 s 轻落，0.3 s 缓出
        const tS = 1.5;
        const q = clamp((t - tS) / 0.3);
        if (q > 0) {
          const e = easeOut(q);
          const s = 1 + 0.12 * (1 - e);
          g.save(); g.translate(SEAL[0], SEAL[1]); g.scale(s, s);
          g.globalAlpha = Math.min(1, q * 2.2) * 0.94;
          g.drawImage(seal(), -40, -40, 80, 80);
          g.restore(); g.globalAlpha = 1;
        }
        // 2.3–2.9 s 渐暗到黑
        const f = smooth((t - 2.3) / 0.6);
        if (f > 0) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
      },
    });
  })();
})();
