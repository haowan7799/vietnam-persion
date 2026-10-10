/* 第三版镜头组 ff3：c1_noonlight, x1_frozen, x2_bell */
(function () {
  'use strict';
  const XYT = window.XYT;
  const A = XYT.art, K = XYT.kit;
  const { W, H, TAU, clamp, lerp, smooth, easeInOut, h2, rgba, mix, noise1, rng } = A;
  const SS = () => (XYT.sprites && XYT.sprites.S) || 1;

  // 设备分辨率的临时画布：每次使用前清空，不在帧间保留内容
  const scratchMap = new Map();
  function scratch(key, w, h) {
    const S = SS();
    const pw = Math.max(1, Math.round(w * S)), ph = Math.max(1, Math.round(h * S));
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
  // 建缓存时画模糊层（ctx.filter 只在这里用）；临时画布沿用目标的当前变换，w、h 为缓存的逻辑尺寸
  function blurInto(g, w, h, blur, fn, alpha, op) {
    const t = document.createElement('canvas');
    const sc = g.getTransform().a;
    t.width = Math.max(1, Math.round(w * sc)); t.height = Math.max(1, Math.round(h * sc));
    const tg = t.getContext('2d'); tg.setTransform(g.getTransform());
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (op) g.globalCompositeOperation = op;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, 0, 0);
    g.restore();
  }
  // 同 blurInto，但临时画布只覆盖逻辑矩形 (bx, by, bw, bh)，模糊的像素少得多；四周要留出 ≥2 倍模糊半径的余量
  function blurBox(g, bx, by, bw, bh, blur, fn, alpha, op) {
    const m = g.getTransform(), sc = m.a;
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(bw * sc)); t.height = Math.max(1, Math.round(bh * sc));
    const tg = t.getContext('2d'); tg.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc);
    fn(tg);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = alpha == null ? 1 : alpha;
    if (op) g.globalCompositeOperation = op;
    if (blur > 0) g.filter = `blur(${(blur * sc).toFixed(2)}px)`;
    g.drawImage(t, Math.round(m.e + bx * sc), Math.round(m.f + by * sc));
    g.restore();
  }
  const fbm = (x, seed, oct) => {
    let s = 0, a = 1, f = 1, n = 0;
    for (let i = 0; i < (oct || 3); i++) { s += a * (noise1(x * f, seed + i * 17) - 0.5); n += a; a *= 0.5; f *= 2.1; }
    return s / n * 2;
  };
  // 第 off 句第 k 字唱出的时刻（相对镜头起点）；取不到时用分镜表里的秒数
  const charAt = (c, k, off, fb) => {
    const v = c.charT ? c.charT(k, off || 0) : null;
    return v == null ? fb[k] : v - (c.t - c.lt);
  };
  // 镜头内的拍点（相对镜头起点）：返回 [{t, down, k}]，k 为小节内第几拍（0 = 强拍）
  const beatsIn = (c, t0, t1) => {
    const out = [], s = c.t - c.lt, gr = c.grid;
    if (!gr || !gr.idx) return out;
    for (let i = gr.idx(s + t0) - 1; i <= gr.idx(s + t1) + 1; i++) {
      const bt = gr.time(i) - s;
      if (bt < t0 || bt > t1) continue;
      out.push({ t: bt, down: gr.isDown(i), k: ((((i - gr.dp) % 4) + 4) % 4) });
    }
    return out;
  };
  // 离 lt 最近的强拍（相对镜头起点）
  const downNear = (c, lt) => {
    const s = c.t - c.lt;
    if (!c.grid || !c.grid.nearestDown) return lt;
    const d = c.grid.nearestDown(s + lt) - s;
    return Math.abs(d - lt) < 0.6 ? d : lt;
  };
  // 阻尼弹簧的阶跃响应：0 → 1，初速度为 0
  const springStep = (tau, f, z) => {
    if (tau <= 0) return 0;
    const w = TAU * f, q = Math.sqrt(1 - z * z), wd = w * q;
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z / q) * Math.sin(wd * tau));
  };
  // 阻尼振荡（冲击后的回弹），初值 0、初速度为正
  const ring = (tau, f, decay) => (tau <= 0 ? 0 : Math.sin(TAU * f * tau) * Math.exp(-tau / decay));
  // 拍点包络：约 0.08 s 软起、指数慢落；叠加上一拍的尾巴，所以在拍点处连续
  const softBeat = (c, d, atk) => {
    if (!c.b) return 0;
    const a = atk || 0.08, s0 = Math.max(0, c.b.since), per = c.b.period || 0.83;
    const f = (s) => smooth(s / a) * Math.exp(-s / d);
    return (f(s0) + f(s0 + per)) * (0.4 + 0.6 * (c.b.str == null ? 0.6 : c.b.str));
  };

  // ============================================================
  // c1_noonlight 白日残烛：正午逆光芭蕉前，廊下一截红烛燃尽
  // ============================================================
  (function () {
    const FB = [0.289, 0.609, 0.989, 1.409, 2.089, 2.689, 3.009, 3.509, 3.809, 4.309, 4.709];
    const CX = 700, CB = 470, CT = 380, CR = 13;   // 烛的设计坐标：中心 x、底、顶、半径（绘制时按 CS 放大）
    const RT = 518, RF = 540, RB = 592;             // 栏杆：顶面上沿、前沿、前面下沿（压在左侧歌词最下一字之下）
    const RAIL_Y0 = RT - 24;                         // 栏杆贴图的上沿
    const CS = 1.42, CBW = RT + 8;                   // 烛放大倍数（约 128 px 高）与它在画面上的着地 y
    const CTW = CBW - (CB - CT) * CS;                // 画面上的烛顶 y
    const toW = (x, y) => [CX + (x - CX) * CS, CBW + (y - CB) * CS];   // 烛设计坐标 → 画面坐标
    const SUN = [1030, 70];                          // 叶后的太阳（画外偏右上）

    // 一片芭蕉叶（叶柄基部在原点，主脉沿 +x）：叶片分成许多条“叶肉带”，部分叶脉处撕裂
    function bananaPath(o) {
      const L = o.L, Wd = o.Wd, bend = o.bend || 0.12, n = o.n || 26, du = 0.035;
      const r = rng(o.seed || 1);
      const P = (u) => [L * u, bend * L * u * u];
      const N = (u) => { const dx = L, dy = 2 * bend * L * u, m = Math.hypot(dx, dy); return [-dy / m, dx / m]; };
      const wd = (u) => {
        if (u <= 0 || u >= 1) return 0;
        let w = Wd * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * u)), 0.6) * (1 - 0.1 * u);
        if (u < 0.07) w *= Math.sqrt(u / 0.07);
        return w;
      };
      const Q = (u, rr, s) => { const uu = Math.min(0.999, u + du * rr), p = P(uu), nn = N(uu), w = wd(uu) * rr; return [p[0] + s * nn[0] * w, p[1] + s * nn[1] * w]; };
      const bounds = [];
      for (let k = 0; k <= n; k++) bounds.push(0.005 + (k / n) * (0.96 - 0.005));
      const tears = { '1': [], '-1': [] };
      for (const s of [1, -1]) for (let k = 1; k < n; k++) tears[s][k] = r() < (o.tear == null ? 0.3 : o.tear) ? 0.35 + r() * 0.6 : 0;
      const path = new Path2D();
      const veins = [];
      for (const s of [1, -1]) {
        for (let k = 0; k < n; k++) {
          const u0 = bounds[k], u1 = bounds[k + 1];
          const t0 = tears[s][k] || 0, t1 = tears[s][k + 1] || 0;
          const gap = (td, rr) => (td > 0 ? 0.006 * clamp((rr - (1 - td)) / td) : 0);
          const pts = [];
          for (let i = 0; i <= 5; i++) { const rr = i / 5; pts.push(Q(u0 + gap(t0, rr), rr, s)); }
          for (let i = 1; i < 3; i++) { const u = lerp(u0, u1, i / 3) + du; const p = P(Math.min(0.999, u)), nn = N(u), w = wd(Math.min(0.999, u)); pts.push([p[0] + s * nn[0] * w, p[1] + s * nn[1] * w]); }
          for (let i = 5; i >= 0; i--) { const rr = i / 5; pts.push(Q(u1 - gap(t1, rr), rr, s)); }
          path.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
          path.closePath();
          if (k > 0) { const v = []; for (let i = 0; i <= 5; i++) v.push(Q(u0, i / 5, s)); veins.push(v); }
        }
      }
      return { path, veins, P, wd, L, Wd };
    }
    // 画一片芭蕉叶：这个图层随后以“正片叠底”叠到亮背景上，所以白 = 透明、颜色越深越不透光
    function drawBanana(g, o) {
      const B = bananaPath(o);
      g.save();
      g.translate(o.x, o.y); g.rotate(o.ang || 0);
      if (o.sx) g.scale(o.sx, 1);
      // 叶柄
      if (o.stalk) {
        g.strokeStyle = o.stalkCol || '#a9c266'; g.lineCap = 'round';
        g.lineWidth = o.stalkW || 9;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-o.stalk * 0.5, o.stalk * 0.08, -o.stalk, o.stalk * (o.stalkDrop || 0.3)); g.stroke();
      }
      g.fillStyle = o.col;
      g.fill(B.path);
      g.save(); g.clip(B.path);
      // 中脉两侧略厚、透光少
      g.strokeStyle = rgba(o.shade || '#9fbd55', 0.35); g.lineWidth = B.Wd * 0.55; g.lineCap = 'round';
      g.beginPath(); for (let i = 0; i <= 20; i++) { const p = B.P(i / 20 * 0.95); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke();
      // 叶缘透光更多（略亮）
      g.strokeStyle = 'rgba(255,255,236,0.28)'; g.lineWidth = 10;
      g.stroke(B.path);
      // 侧脉：每条叶肉带的边界一条，中间两条细脉
      g.lineCap = 'butt';
      g.strokeStyle = rgba(o.vein || '#7f9f3e', o.veinA == null ? 0.5 : o.veinA); g.lineWidth = o.veinW || 0.9;
      g.beginPath();
      for (const v of B.veins) { g.moveTo(v[0][0], v[0][1]); for (let i = 1; i < v.length; i++) g.lineTo(v[i][0], v[i][1]); }
      g.stroke();
      g.restore();
      // 叶缘焦黄的细边（老叶）
      if (o.edge) { g.strokeStyle = rgba(o.edge, 0.45); g.lineWidth = 1.2; g.stroke(B.path); }
      // 中脉：粗、透出浅黄
      for (let i = 0; i < 24; i++) {
        const u0 = i / 24 * 0.97, u1 = (i + 1) / 24 * 0.97;
        const p0 = B.P(u0), p1 = B.P(u1);
        const w = (o.rib || 7) * (1 - u0 * 0.85);
        g.strokeStyle = o.ribEdge || '#93b14c'; g.lineWidth = w + 1.6;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
        g.strokeStyle = o.ribCol || '#eef1b4'; g.lineWidth = w * 0.7;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      }
      g.restore();
    }

    // 远景与中景芭蕉：远层大虚化，中层轻虚化
    const FAR = [
      { x: 1290, y: 180, ang: Math.PI + 0.25, L: 560, Wd: 190, bend: 0.1, seed: 11 },
      { x: 520, y: 720, ang: -1.25, L: 620, Wd: 200, bend: -0.12, seed: 12 },
      { x: 120, y: 520, ang: -0.55, L: 600, Wd: 190, bend: 0.1, seed: 13 },
      { x: 1180, y: 700, ang: -2.0, L: 560, Wd: 180, bend: 0.12, seed: 14 },
      { x: 860, y: -60, ang: 2.2, L: 520, Wd: 170, bend: -0.1, seed: 15 },
      { x: -40, y: 140, ang: 0.35, L: 640, Wd: 200, bend: 0.12, seed: 16 },
      { x: 760, y: 760, ang: -0.6, L: 600, Wd: 190, bend: -0.15, seed: 17 },
      { x: 400, y: -40, ang: 1.0, L: 540, Wd: 180, bend: 0.12, seed: 18 },
    ];
    // 中层静止叶（假茎在右，叶片向左上展开）
    const MID = [
      { x: 1120, y: 470, ang: -2.55, L: 520, Wd: 150, bend: -0.1, seed: 31, stalk: 120, stalkDrop: -0.5, tear: 0.45, edge: '#b49a4a' },
      { x: 340, y: 640, ang: -0.92, L: 560, Wd: 150, bend: 0.1, seed: 32, stalk: 90, stalkDrop: 0.6, tear: 0.35 },
      { x: 560, y: 790, ang: -0.42, L: 470, Wd: 130, bend: 0.16, seed: 33, tear: 0.4, col: '#a8c862', shade: '#86a646', vein: '#5f8030' },
      { x: 1290, y: 640, ang: -2.9, L: 380, Wd: 120, bend: -0.12, seed: 34, tear: 0.5, col: '#aecb68', shade: '#86a646', vein: '#5f8030', edge: '#9a8a40' },
    ];
    // 会被风摆开的那片叶：从画外上方垂下，叶尖在烛的左上方
    const SWING = { px: 965, py: -60, L: 360, Wd: 124, bend: -0.17, seed: 41, ang0: 1.66, tear: 0.5 };

    function bgTex() {
      return K.cache('ff3_c1_bg', W, H, 1, (g) => {
        // 叶后天光：右上最亮
        const gr = g.createRadialGradient(SUN[0], SUN[1], 10, SUN[0], SUN[1], 1100);
        gr.addColorStop(0, '#fffdf0'); gr.addColorStop(0.18, '#fbf3cc'); gr.addColorStop(0.5, '#eef6c8'); gr.addColorStop(1, '#d9e8a8');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
        // 远层叶（白底正片叠底后再虚化）
        blurInto(g, W, H, 9, (tg) => {
          tg.fillStyle = '#ffffff'; tg.fillRect(0, 0, W, H);
          tg.globalCompositeOperation = 'multiply';
          FAR.forEach((f) => drawBanana(tg, Object.assign({ col: '#d3e69a', shade: '#b8d27a', vein: '#a8c46c', veinA: 0.35, rib: 9, ribCol: '#f1f3c8', ribEdge: '#bcd486' }, f)));
        }, 1, 'multiply');
        // 下半部被上层叶遮住，透光少、偏深
        const sh = g.createLinearGradient(0, 300, 0, H);
        sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(180,205,130,0.55)'); sh.addColorStop(1, 'rgba(95,140,70,0.9)');
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = sh; g.fillRect(0, 300, W, H - 300);
        g.globalCompositeOperation = 'source-over';
        // 右侧芭蕉假茎（逆光暗影，右缘一线亮）
        blurInto(g, W, H, 2.2, (tg) => {
          const x0 = 1085, x1 = 1150;
          const tr = tg.createLinearGradient(x0, 0, x1, 0);
          tr.addColorStop(0, '#41622c'); tr.addColorStop(0.75, '#355424'); tr.addColorStop(0.92, '#7ea24a'); tr.addColorStop(1, '#c9de8a');
          tg.fillStyle = tr;
          tg.beginPath(); tg.moveTo(x0 + 4, RT + 12); tg.bezierCurveTo(x0, 590, x0 - 4, 660, x0 - 6, H + 10); tg.lineTo(x1 + 8, H + 10); tg.bezierCurveTo(x1 + 4, 650, x1, 590, x1 - 2, RT + 12); tg.closePath(); tg.fill();
          // 叶鞘的竖纹
          tg.strokeStyle = 'rgba(30,50,20,0.35)'; tg.lineWidth = 1.2;
          for (let k = 0; k < 4; k++) { const x = x0 + 12 + k * 13; tg.beginPath(); tg.moveTo(x, RT + 12); tg.lineTo(x - 3, H); tg.stroke(); }
        });
        // 太阳一侧偏暖金
        const wg = g.createRadialGradient(SUN[0], SUN[1], 0, SUN[0], SUN[1], 640);
        wg.addColorStop(0, 'rgba(246,224,168,0.55)'); wg.addColorStop(0.5, 'rgba(246,224,168,0.2)'); wg.addColorStop(1, 'rgba(246,224,168,0)');
        g.globalCompositeOperation = 'screen'; g.fillStyle = wg; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over';
        // 叶隙漏下的光斑（虚焦圆斑）与几道很淡的光束，都从右上的太阳来
        blurInto(g, W, H, 3, (tg) => {
          const r = rng(57);
          for (let i = 0; i < 16; i++) {
            const x = 760 + r() * 520, y = -10 + r() * 330, rr = 14 + r() * 30;
            const d = Math.hypot(x - SUN[0], y - SUN[1]);
            const a = (0.16 + r() * 0.2) * clamp(1.2 - d / 520);
            if (a < 0.03) continue;
            const bg2 = tg.createRadialGradient(x, y, rr * 0.6, x, y, rr);
            bg2.addColorStop(0, `rgba(255,252,226,${a})`); bg2.addColorStop(0.85, `rgba(255,250,215,${a * 1.25})`); bg2.addColorStop(1, 'rgba(255,250,215,0)');
            tg.fillStyle = bg2; tg.beginPath(); tg.arc(x, y, rr, 0, TAU); tg.fill();
          }
        }, 1, 'screen');
        blurInto(g, W, H, 10, (tg) => {
          [[2.05, 0.05, 0.13], [2.3, 0.035, 0.1], [2.62, 0.05, 0.09], [2.85, 0.03, 0.07]].forEach(([ang, wd, a]) => {
            const len = 1200;
            const gr2 = tg.createLinearGradient(SUN[0], SUN[1], SUN[0] + Math.cos(ang) * len * 0.8, SUN[1] + Math.sin(ang) * len * 0.8);
            gr2.addColorStop(0, `rgba(255,248,210,${a})`); gr2.addColorStop(1, 'rgba(255,248,210,0)');
            tg.fillStyle = gr2;
            tg.beginPath(); tg.moveTo(SUN[0], SUN[1]);
            tg.lineTo(SUN[0] + Math.cos(ang - wd) * len, SUN[1] + Math.sin(ang - wd) * len);
            tg.lineTo(SUN[0] + Math.cos(ang + wd) * len, SUN[1] + Math.sin(ang + wd) * len);
            tg.closePath(); tg.fill();
          });
        }, 1, 'screen');
      });
    }
    // 中层叶（白底，正片叠底叠上去；整层随微风极轻地摆）
    function midTex() {
      return K.cache('ff3_c1_mid', W, H, 1, (g) => {
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
        blurInto(g, W, H, 1.1, (tg) => {
          tg.fillStyle = '#ffffff'; tg.fillRect(0, 0, W, H);
          tg.globalCompositeOperation = 'multiply';
          MID.forEach((f) => drawBanana(tg, Object.assign({ col: '#c4dc7c', shade: '#9fbd55', vein: '#7f9f3e', veinA: 0.55, rib: 8 }, f)));
        });
      });
    }
    // 摆动叶的贴图（透明底，叶柄基部在贴图内 (40, 40)）
    function swingTex() {
      return K.cache('ff3_c1_swing', 620, 520, 1, (g) => {
        blurInto(g, 620, 520, 1.1, (tg) => {
          drawBanana(tg, { x: 40, y: 40, ang: 0.62, L: SWING.L, Wd: SWING.Wd, bend: SWING.bend, seed: SWING.seed, tear: SWING.tear,
            col: '#bcd772', shade: '#97b74c', vein: '#76973a', veinA: 0.6, rib: 8, stalk: 70, stalkDrop: -0.1, edge: '#a89040' });
        });
      });
    }
    // 栏杆：顶面受光，前面背光；下面是栏杆柱
    function railTex() {
      return K.cache('ff3_c1_rail2', W, H - RAIL_Y0, 1, (g) => {
        g.translate(0, -RAIL_Y0);
        // 栏杆柱（在横木之下）
        const posts = [440, 975, 1235];
        posts.forEach((x) => {
          const gr = g.createLinearGradient(x - 20, 0, x + 20, 0);
          gr.addColorStop(0, '#2c1d12'); gr.addColorStop(0.7, '#3d2818'); gr.addColorStop(0.93, '#6b4a2c'); gr.addColorStop(1, '#a07a4a');
          g.fillStyle = gr; g.fillRect(x - 20, RB - 2, 40, H - RB + 4);
        });
        // 前面
        const fr = g.createLinearGradient(0, RF, 0, RB);
        fr.addColorStop(0, '#6e4c2e'); fr.addColorStop(0.15, '#5a3d24'); fr.addColorStop(1, '#3a2716');
        g.fillStyle = fr; g.fillRect(-10, RF, W + 20, RB - RF);
        // 木纹
        const r = rng(71);
        for (let i = 0; i < 26; i++) {
          const y = RF + 4 + r() * (RB - RF - 6), x0 = r() * W, len = 120 + r() * 380;
          g.strokeStyle = `rgba(30,18,10,${0.12 + r() * 0.14})`; g.lineWidth = 0.8 + r() * 0.8;
          g.beginPath(); g.moveTo(x0, y); g.bezierCurveTo(x0 + len * 0.3, y + (r() - 0.5) * 3, x0 + len * 0.7, y + (r() - 0.5) * 3, x0 + len, y + (r() - 0.5) * 2); g.stroke();
        }
        // 前面底边的阴影线
        g.fillStyle = 'rgba(20,12,6,0.5)'; g.fillRect(-10, RB - 3, W + 20, 3);
        // 顶面：正午阳光直照，暖亮；夹着几块静止的叶影
        const tp = g.createLinearGradient(0, RT, 0, RF);
        tp.addColorStop(0, '#f0d49a'); tp.addColorStop(1, '#d8b27a');
        g.fillStyle = tp; g.fillRect(-10, RT, W + 20, RF - RT);
        for (let i = 0; i < 28; i++) {
          const y = RT + 2 + r() * (RF - RT - 3), x0 = r() * W, len = 60 + r() * 260;
          g.strokeStyle = `rgba(120,80,40,${0.1 + r() * 0.12})`; g.lineWidth = 0.7;
          g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + len, y + (r() - 0.5) * 1.5); g.stroke();
        }
        // 静止叶影（远处的叶，软边）
        blurInto(g, W, H - RAIL_Y0, 4, (tg) => {
          tg.fillStyle = 'rgba(96,74,44,0.4)';
          [[300, 130, 9], [512, 54, -7], [930, 120, 8], [1130, 70, -10], [1220, 60, 6]].forEach(([x, w, sk]) => {
            tg.beginPath(); tg.moveTo(x, RT); tg.lineTo(x + w, RT); tg.lineTo(x + w + sk, RF); tg.lineTo(x + sk, RF); tg.closePath(); tg.fill();
          });
        });
        // 顶面前沿的受光倒角
        g.fillStyle = 'rgba(255,240,200,0.75)'; g.fillRect(-10, RF - 1.2, W + 20, 1.6);
        g.fillStyle = 'rgba(40,25,12,0.35)'; g.fillRect(-10, RT - 1, W + 20, 1.2);
      });
    }
    // 前景左侧：贴近镜头、完全虚化的一片逆光芭蕉（歌词垫底，亮度平稳）
    function fgTex() {
      return K.cache('ff3_c1_fg', 520, H, 0.5, (g) => {
        blurInto(g, 520, H, 22, (tg) => {
          const gr = tg.createLinearGradient(0, 0, 420, 0);
          gr.addColorStop(0, 'rgba(206,228,140,0.97)'); gr.addColorStop(0.6, 'rgba(214,232,150,0.94)'); gr.addColorStop(1, 'rgba(220,236,160,0.0)');
          tg.fillStyle = gr;
          tg.beginPath(); tg.moveTo(-40, -40); tg.lineTo(330, -40); tg.bezierCurveTo(390, 200, 400, 420, 350, H + 40); tg.lineTo(-40, H + 40); tg.closePath(); tg.fill();
          // 虚化的叶脉：几条很淡的斜带
          tg.strokeStyle = 'rgba(150,180,90,0.22)'; tg.lineWidth = 14;
          for (let k = 0; k < 6; k++) { const y = 40 + k * 130; tg.beginPath(); tg.moveTo(-20, y + 60); tg.lineTo(330, y - 40); tg.stroke(); }
          tg.strokeStyle = 'rgba(245,248,200,0.5)'; tg.lineWidth = 26;
          tg.beginPath(); tg.moveTo(80, H + 30); tg.bezierCurveTo(120, 420, 150, 200, 190, -30); tg.stroke();
        });
      });
    }

    // 叶隙漏下、照到烛上的一道光束（软边，缓存）
    function beamTex() {
      return K.cache('ff3_c1_beam', 520, 560, 0.5, (g) => {
        blurInto(g, 520, 560, 16, (tg) => {
          const gr = tg.createLinearGradient(400, 0, 140, 520);
          gr.addColorStop(0, 'rgba(255,240,196,0.0)'); gr.addColorStop(0.15, 'rgba(255,240,196,0.9)'); gr.addColorStop(0.8, 'rgba(255,236,186,0.8)'); gr.addColorStop(1, 'rgba(255,236,186,0)');
          tg.fillStyle = gr;
          tg.beginPath(); tg.moveTo(330, 0); tg.lineTo(470, 0); tg.lineTo(190, 520); tg.lineTo(130, 520); tg.closePath(); tg.fill();
        });
      });
    }
    // 从叶脉间漏下的细光束：自右上的太阳向左下散开，细而淡，左侧歌词区之前就淡没（缓存）
    function raysTex() {
      return K.cache('ff3_c1_rays', W, H, 0.5, (g) => {
        blurInto(g, W, H, 4, (tg) => {
          const r = rng(97);
          for (let i = 0; i < 9; i++) {
            const ang = 1.92 + i * 0.105 + (r() - 0.5) * 0.05;
            const wd = 0.006 + r() * 0.01, a = 0.17 + r() * 0.14, len = 760 + r() * 260;
            const ex = SUN[0] + Math.cos(ang) * len, ey = SUN[1] + Math.sin(ang) * len;
            const gr = tg.createLinearGradient(SUN[0], SUN[1], ex, ey);
            gr.addColorStop(0, 'rgba(255,250,222,0)'); gr.addColorStop(0.18, `rgba(255,250,222,${a})`);
            gr.addColorStop(0.65, `rgba(255,246,210,${a * 0.7})`); gr.addColorStop(1, 'rgba(255,246,210,0)');
            tg.fillStyle = gr;
            tg.beginPath(); tg.moveTo(SUN[0], SUN[1]);
            tg.lineTo(SUN[0] + Math.cos(ang - wd) * len, SUN[1] + Math.sin(ang - wd) * len);
            tg.lineTo(SUN[0] + Math.cos(ang + wd) * len, SUN[1] + Math.sin(ang + wd) * len);
            tg.closePath(); tg.fill();
          }
          // 左侧歌词区与栏杆以下不留光束
          tg.globalCompositeOperation = 'destination-in';
          const mk = tg.createLinearGradient(330, 0, 560, 0);
          mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(1, 'rgba(0,0,0,1)');
          tg.fillStyle = mk; tg.fillRect(0, 0, W, H);
          const mv = tg.createLinearGradient(0, RT - 60, 0, RT);
          mv.addColorStop(0, 'rgba(0,0,0,1)'); mv.addColorStop(1, 'rgba(0,0,0,0)');
          tg.fillStyle = mv; tg.fillRect(0, 0, W, H);
        });
      });
    }
    // 烛身（设计坐标，调用方已放大到画面）：sun 0 = 在叶影里，1 = 全在阳光下；lit 火焰照亮熔池的程度；
    // melt 0→1：第1句第9字起烛沿缺口熔得更深，一道新蜡泪从缺口淌下；pulse 拍点上熔池反光轻闪
    function drawCandle(g, t, sun, lit, melt, pulse) {
      // 底座：几团蜡泪堆在一起，另有一道流到栏面上的薄蜡
      const lumps = [[CX + 10, CB + 3.2, 36, 3.2], [CX, CB - 0.5, 25, 6], [CX - 19, CB + 0.6, 10, 4.6], [CX + 17, CB - 0.4, 11, 5.2], [CX + 29, CB + 2, 7, 3.2], [CX - 30, CB + 2.4, 6, 2.6]];
      const pile = new Path2D();
      lumps.forEach(([x, y, rx, ry]) => { pile.moveTo(x + rx, y); pile.ellipse(x, y, rx, ry, 0, 0, TAU); });
      // 逆光：朝镜头的一面比受光时暗约两成
      const back = 0.2 * sun;
      let gr = g.createLinearGradient(0, CB - 7, 0, CB + 7);
      gr.addColorStop(0, mix(mix('#b8402e', '#e0603e', sun * 0.5), '#3a0c06', back)); gr.addColorStop(0.5, mix('#a3301f', '#3a0c06', back)); gr.addColorStop(1, mix('#7c2116', '#2a0804', back));
      g.fillStyle = gr; g.fill(pile);
      g.strokeStyle = `rgba(255,190,150,${0.3 + 0.45 * sun})`; g.lineWidth = 0.9;
      lumps.slice(1).forEach(([x, y, rx, ry]) => { g.beginPath(); g.ellipse(x, y, rx * 0.8, ry * 0.75, 0, -2.6, -0.5); g.stroke(); });
      // 烛身（顶边不齐：左后高、右前低，右前有一道熔开的缺口，第1句第9字起熔得更深）
      const nd = 3.2 + 2.6 * melt;
      const nc = CX + 6 - 1.6 * melt;
      const notch = (x) => nd * Math.exp(-(((x - nc) / (2.6 + 0.9 * melt)) ** 2));
      const top = (x) => CT + 2.4 * ((x - CX) / CR) + notch(x);
      const body = new Path2D();
      body.moveTo(CX - CR, CB - 4);
      body.lineTo(CX - CR + 0.4, top(CX - CR));
      for (let x = CX - CR; x <= CX + CR + 0.01; x += 1) body.lineTo(x, top(x) + 3.4 * Math.sqrt(Math.max(0, 1 - ((x - CX) / CR) ** 2)));
      body.lineTo(CX + CR, CB - 4);
      body.closePath();
      gr = g.createLinearGradient(CX - CR, 0, CX + CR, 0);
      gr.addColorStop(0, mix('#6a1911', '#2a0805', back)); gr.addColorStop(0.3, mix('#8f281b', '#2a0805', back));
      gr.addColorStop(0.72, mix('#a83222', '#2a0805', back)); gr.addColorStop(1, mix('#8a2619', '#2a0805', back));
      g.fillStyle = gr; g.fill(body);
      g.save(); g.clip(body);
      // 天光从上方：上半略亮
      const vg = g.createLinearGradient(0, CT, 0, CB);
      vg.addColorStop(0, 'rgba(255,200,170,0.1)'); vg.addColorStop(1, 'rgba(40,10,5,0.2)');
      g.fillStyle = vg; g.fillRect(CX - CR, CT - 6, CR * 2, CB - CT + 6);
      // 阳光从身后透过蜡：只在两侧边缘一窄条泛橙红（次表面透光），右侧更强；烛顶一段透亮
      if (sun > 0.01) {
        const sg = g.createLinearGradient(CX - CR, 0, CX + CR, 0);
        sg.addColorStop(0, `rgba(255,120,60,${0.42 * sun})`); sg.addColorStop(0.12, 'rgba(255,110,60,0)');
        sg.addColorStop(0.8, 'rgba(255,120,60,0)'); sg.addColorStop(1, `rgba(255,150,80,${0.62 * sun})`);
        g.fillStyle = sg; g.fillRect(CX - CR, CT - 6, CR * 2, CB - CT + 6);
        const tg2 = g.createLinearGradient(0, CT - 4, 0, CT + 22);
        tg2.addColorStop(0, `rgba(255,130,90,${0.38 * sun})`); tg2.addColorStop(1, 'rgba(255,140,90,0)');
        g.fillStyle = tg2; g.fillRect(CX - CR, CT - 6, CR * 2, 28);
      }
      g.restore();
      // 轮廓光：太阳在身后偏右上，两侧各一线暖光，右缘更亮
      const rimTop = (x) => top(x) + 3;
      g.lineWidth = 1.0;
      g.strokeStyle = `rgba(255,206,150,${0.18 + 0.5 * sun})`;
      g.beginPath(); g.moveTo(CX - CR + 0.5, rimTop(CX - CR)); g.lineTo(CX - CR + 0.5, CB - 6); g.stroke();
      g.strokeStyle = `rgba(255,222,176,${0.25 + 0.7 * sun})`;
      g.beginPath(); g.moveTo(CX + CR - 0.5, rimTop(CX + CR)); g.lineTo(CX + CR - 0.5, CB - 6); g.stroke();
      // 蜡泪：缺口下一道长的，另有几道短的；第1句第9字起缺口里溢出一道新蜡泪，先快后慢地往下淌（遇冷变稠）
      const drip = (x, y0, len, w, wob, col, hi) => {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(x - w / 2, y0);
        g.bezierCurveTo(x - w / 2 + wob, y0 + len * 0.45, x - w * 0.42 - wob, y0 + len - Math.min(5, len * 0.3), x - w * 0.6, y0 + len);
        g.arc(x, y0 + len, w * 0.6, Math.PI, 0, true);
        g.bezierCurveTo(x + w * 0.42 - wob, y0 + len - Math.min(5, len * 0.3), x + w / 2 + wob, y0 + len * 0.45, x + w / 2, y0);
        g.closePath(); g.fill();
        g.strokeStyle = `rgba(255,200,160,${hi})`; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x + w / 2 - 0.9, y0 + 2); g.quadraticCurveTo(x + w / 2 - 0.6 + wob, y0 + len * 0.5, x + w * 0.35, y0 + len + 1); g.stroke();
        g.fillStyle = `rgba(60,10,6,0.25)`;
        g.beginPath(); g.ellipse(x - w * 0.15, y0 + len + w * 0.55, w * 0.55, 0.8, 0, 0, TAU); g.fill();
      };
      [[6, 70, 4.6], [-7, 26, 3.8], [-1, 40, 3.2], [10.5, 18, 3.2]].forEach(([dx, len, w], i) => {
        const x = CX + dx;
        drip(x, top(x) + 2.5, len, w, i % 2 ? -0.6 : 0.6, mix(i === 0 ? '#c4432f' : '#b63a2a', '#3a0c06', back * 0.8), 0.3 + 0.5 * sun);
      });
      if (melt > 0.001) {
        // 新蜡泪：从加深的缺口溢出，挂在旧蜡泪左边；头部圆、带一点湿亮的反光
        const x = CX + 2.4, y0 = top(nc) + 1.5;
        const len = 2 + 44 * (1 - Math.exp(-melt * 2.4)) / (1 - Math.exp(-2.4));
        const w = 3.4 + 0.8 * Math.min(1, melt * 3);
        drip(x, y0, len, w, 0.4, mix('#d24a33', '#5a1408', back * 0.6), 0.45 + 0.4 * sun);
        g.fillStyle = `rgba(255,236,206,${0.5 + 0.3 * sun})`;
        g.beginPath(); g.ellipse(x + w * 0.18, y0 + len - w * 0.1, w * 0.18, w * 0.32, 0, 0, TAU); g.fill();
      }
      // 顶面：烛沿与熔蜡池（燃着时被火焰从里照亮），池面映着叶后的亮天，微微闪光
      g.fillStyle = mix(mix('#b2361f', '#e05a36', sun * 0.5), '#3a0c06', back * 0.6);
      g.beginPath(); g.ellipse(CX, CT + 0.6, CR - 0.3, 3.8, 0.09, 0, TAU); g.fill();
      const pg = g.createRadialGradient(CX, CT + 1, 0, CX, CT + 1, CR * 0.8);
      pg.addColorStop(0, mix('#c03c28', '#ffbf80', 0.6 * lit + 0.2 * sun));
      pg.addColorStop(1, mix('#922619', '#e8623c', 0.35 * lit + 0.3 * sun));
      g.fillStyle = pg;
      g.beginPath(); g.ellipse(CX, CT + 1.2 + 0.6 * melt, CR * 0.72, 2.5, 0.09, 0, TAU); g.fill();
      const tw = 0.75 + 0.15 * Math.sin(t * 2.7) + 0.1 * Math.sin(t * 6.1 + 1) + 0.15 * (pulse || 0);
      g.fillStyle = `rgba(255,252,232,${(0.25 + 0.5 * sun) * tw})`;
      g.beginPath(); g.ellipse(CX + 3.8, CT + 0.6 + 0.6 * melt, 4.2, 0.9, 0.09, 0, TAU); g.fill();
      // 熔池上的一点星芒（极小，随热气闪动）
      const gl = sun * tw * 0.85;
      if (gl > 0.02) {
        const gx = CX + 5.6, gy = CT + 0.5 + 0.6 * melt, s = 2.6 + 1.2 * tw;
        g.save(); g.globalCompositeOperation = 'screen';
        A.glow(g, gx, gy, 5, '#fff6d8', 0.6 * gl);
        g.strokeStyle = `rgba(255,250,228,${0.75 * gl})`; g.lineWidth = 0.45;
        g.beginPath(); g.moveTo(gx - s, gy); g.lineTo(gx + s, gy); g.moveTo(gx, gy - s * 0.7); g.lineTo(gx, gy + s * 0.7); g.stroke();
        g.restore();
      }
      const sil = new Path2D();
      sil.addPath(body); sil.addPath(pile);
      sil.ellipse(CX, CT + 0.6, CR, 4, 0.09, 0, TAU);
      return sil;
    }
    // 烛焰：vis 为可见度（强光下很低）；hk 为火焰高度比例；sun 阳光照到烛的程度
    // 强光下火焰几乎透明，但留一个淡黄的焰心和一圈很淡的暖色焰缘，让人看得出它还燃着
    function drawFlame(g, t, vis, hk, lean, sun) {
      if (vis <= 0.003 || hk <= 0.01) return;
      const h = 25 * hk * (1 + 0.05 * Math.sin(t * 7.3) + 0.03 * Math.sin(t * 12.1 + 1));
      const sway = (1.0 * Math.sin(t * 4.7) + 0.5 * Math.sin(t * 8.3 + 1.3)) * hk + lean * hk;
      const by = CT - 1 + (1 - hk) * 2.5, bx = CX + 0.8;
      const w = 5.4 * Math.sqrt(hk);
      const path = (k) => {
        const p = new Path2D();
        p.moveTo(bx, by + 2.4 * k);
        p.bezierCurveTo(bx - w * 1.15 * k, by - h * 0.04, bx - w * 0.95 * k, by - h * 0.55, bx + sway, by - h * (0.72 + 0.28 * k));
        p.bezierCurveTo(bx + w * 0.95 * k, by - h * 0.55, bx + w * 1.15 * k, by - h * 0.04, bx, by + 2.4 * k);
        return p;
      };
      g.save();
      g.globalCompositeOperation = 'screen';
      A.glow(g, bx, by - h * 0.45, 34 * hk + 8, '#ffc870', 0.5 * vis);
      g.restore();
      g.fillStyle = `rgba(255,168,60,${0.62 * vis})`; g.fill(path(1));
      g.fillStyle = `rgba(255,236,170,${0.85 * vis})`; g.fill(path(0.62));
      g.fillStyle = `rgba(255,252,236,${0.9 * vis})`; g.fill(path(0.32));
      const s = sun || 0;
      if (s > 0.01) {
        const ka = Math.min(1, hk * 2.2);
        g.strokeStyle = `rgba(214,118,40,${0.3 * s * ka})`; g.lineWidth = 0.7; g.stroke(path(0.95));
        g.fillStyle = `rgba(255,226,120,${0.3 * s * ka})`; g.fill(path(0.62));
        g.fillStyle = `rgba(255,244,190,${0.34 * s * ka})`; g.fill(path(0.36));
      }
      g.fillStyle = `rgba(80,120,210,${(0.35 * vis + 0.25 * s) * Math.min(1, hk * 2)})`;
      g.beginPath(); g.ellipse(bx, by + 0.5, w * 0.55, 2.2 * hk + 0.5, 0, 0, TAU); g.fill();
    }
    // 熄灭后的细烟：从烛芯连续冒出，每个烟点的位置只由冒出时刻和年龄决定
    // 画面坐标：(ox, oy) 为烛芯顶。烟是一条柔白的带子：越往上越宽（2→12 px）、越淡（0.5→0），边卷边向右飘
    function drawSmoke(g, t, t0, ox, oy) {
      if (t <= t0) return;
      const step = 0.03, emitDur = 3.2, life = 2.8;
      const k0 = Math.max(0, Math.ceil((t - life - t0) / step)), k1 = Math.floor((Math.min(t, t0 + emitDur) - t0) / step);
      if (k1 < k0) return;
      // 从最老（最高）到最新（烛芯）排列；最新一点补在烛芯上，带子始终连着烛芯直到停止冒烟
      const pts = [];
      const at = (a) => {
        const e = t - a - t0;
        const str = Math.pow(clamp(1 - e / emitDur), 0.8) * (0.75 + 0.25 * Math.exp(-e / 0.35));
        const rise = 92 * a - 8 * a * a;
        const x = ox + 0.6 + 24 * a * a + (0.6 + 9 * a) * Math.sin(e * 4.3 + a * 1.4) + (0.3 + 3.2 * a) * Math.sin(e * 11.3 + 2.1 + a);
        const al = 0.5 * str * Math.pow(clamp(1 - a / life), 1.1) * smooth(a / 0.08);
        return [x, oy - rise, a, al, 2 + 10 * clamp(a / (life * 0.75))];
      };
      for (let k = k0; k <= k1; k++) pts.push(at(t - (t0 + k * step)));
      if (t < t0 + emitDur) pts.push(at(0));
      if (pts.length < 2) return;
      // 带子的左右边（沿法线各偏半个宽度）
      const edge = (wk) => {
        const L = [], R = [];
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
          let dx = q[0] - o[0], dy = q[1] - o[1];
          const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
          const hw = p[4] * wk * 0.5;
          L.push([p[0] - dy * hw, p[1] + dx * hw]); R.push([p[0] + dy * hw, p[1] - dx * hw]);
        }
        const path = new Path2D();
        path.moveTo(L[0][0], L[0][1]);
        for (let i = 1; i < L.length; i++) path.lineTo(L[i][0], L[i][1]);
        for (let i = R.length - 1; i >= 0; i--) path.lineTo(R[i][0], R[i][1]);
        path.closePath();
        return path;
      };
      // 透明度随高度变化（烟点的高度随年龄单调升高），用竖直渐变表达
      const yTop = pts[0][1], yBot = pts[pts.length - 1][1];
      const span = Math.max(1, yBot - yTop);
      const grad = (rgb, k) => {
        const gr = g.createLinearGradient(0, yTop, 0, yBot);
        const n = Math.min(10, pts.length - 1);
        for (let j = 0; j <= n; j++) {
          const p = pts[Math.round((j / n) * (pts.length - 1))];
          gr.addColorStop(clamp((p[1] - yTop) / span), `rgba(${rgb},${(p[3] * k).toFixed(3)})`);
        }
        return gr;
      };
      g.save();
      g.lineJoin = 'round';
      // 背光一侧极淡的一抹灰，给烟一点体积，在亮背景上也看得出
      g.save(); g.translate(-1.2, 0.8);
      g.fillStyle = grad('118,126,116', 0.3); g.fill(edge(0.9));
      g.restore();
      g.fillStyle = grad('255,255,250', 0.4); g.fill(edge(2.2));
      g.fillStyle = grad('246,247,242', 0.6); g.fill(edge(1.4));
      g.fillStyle = grad('228,232,226', 0.95); g.fill(edge(0.75));
      g.restore();
    }

    XYT.registerShot('c1_noonlight', {
      name: '白日残烛', zone: 'left', night: false, text: '#1f3417', shadow: 'rgba(248,252,228,0.92)', accent: '#c0392b', bloom: 0.3,
      draw(g, c) {
        const t = c.lt;
        const T = { yu: charAt(c, 4, 0, FB), tu: charAt(c, 8, 0, FB), shou: charAt(c, 10, 0, FB) };
        // 摆开的叶：第5字起一阵风，阻尼弹簧摆到新平衡，之后微风轻摇
        const gust = springStep(t - T.yu, 0.62, 0.55);
        const sway = 0.012 * Math.sin(t * 2.3) + 0.007 * Math.sin(t * 3.7 + 1.1);
        const th = -0.24 * gust + sway * (1 + gust);
        // 叶影带随叶移动；烛被照亮的比例（烛在画面上半宽约 CR·CS）
        const sdx = -620 * (th - sway);
        const sL = 612 + sdx, sR = 806 + sdx;
        const sun = smooth((sL - CX + 10) / 52);
        // 第1句第9字起烛芯下沉、缺口熔开、新蜡泪淌下；第1句第11字熄灭
        const sink = smooth((t - T.tu) / (T.shou - T.tu));
        const melt = clamp((t - T.tu) / 1.6);
        const out = t >= T.shou ? 1 : 0;
        const hk = out ? Math.max(0, 1 - (t - T.shou) / 0.12) * 0.22 : 1 - 0.78 * sink;
        const heat = (out ? Math.max(0, 1 - (t - T.shou) / 0.6) * 0.25 : 1 - 0.75 * sink) * smooth((t + 0.6) / 0.3);
        const pulse = softBeat(c, 0.45);
        // 镜头：1.00→1.02 缓推，围绕烛
        const z = 1 + 0.02 * smooth(clamp((t + 0.6) / (c.dur + 0.6)));
        g.save();
        g.translate(CX, 440); g.scale(z, z); g.translate(-CX, -440);
        // 背景与叶先画进临时画布，热浪从这里取样
        const sc = scratch('ff3_c1_scene', W, H);
        const sg = sc.g;
        sg.drawImage(bgTex(), 0, 0, W, H);
        sg.globalCompositeOperation = 'multiply';
        const midAng = 0.0025 * Math.sin(t * 1.3 + 0.5) + 0.0015 * Math.sin(t * 2.1) + 0.004 * springStep(t - T.yu - 0.15, 0.5, 0.6);
        sg.save();
        sg.translate(700, 760); sg.rotate(midAng); sg.translate(-700, -760);
        sg.drawImage(midTex(), 0, 0, W, H);
        sg.restore();
        sg.save();
        sg.translate(SWING.px, SWING.py); sg.rotate(th + SWING.ang0);
        sg.drawImage(swingTex(), -40, -40, 620, 520);
        sg.restore();
        sg.globalCompositeOperation = 'source-over';
        g.drawImage(sc.c, 0, 0, W, H);
        // 热浪：焰上方一柱背景横向错动，向上传播，顺风略偏右
        if (heat > 0.01) {
          const y1 = Math.round(CTW - 16), y0 = 130, cw = 96, Hh = y1 - y0, LEAN = 14;
          const hs = scratch('ff3_c1_heat', cw, Hh);
          const S = hs.S;
          for (let y = y0; y < y1; y += 2) {
            const up = (y1 - y) / Hh;
            const amp = heat * 2.8 * Math.sin(Math.PI * Math.min(1, up * 1.6 + 0.08)) * (1 - 0.4 * up);
            const dx = amp * (Math.sin(y * 0.15 + t * 11) + 0.55 * Math.sin(y * 0.29 - t * 17 + 1.3));
            hs.g.drawImage(sc.c, (CX - cw / 2 - dx) * S, y * S, cw * S, 2 * S, 0, y - y0, cw, 2);
          }
          // 羽化：顺风略偏右的一柱，中间实、两侧与上端渐隐
          hs.g.globalCompositeOperation = 'destination-in';
          hs.g.save();
          hs.g.transform(1, 0, -LEAN / Hh, 1, LEAN, 0);
          const mk = hs.g.createLinearGradient(0, 0, cw, 0);
          mk.addColorStop(0, 'rgba(0,0,0,0)'); mk.addColorStop(0.32, 'rgba(0,0,0,1)'); mk.addColorStop(0.68, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,0)');
          hs.g.fillStyle = mk; hs.g.fillRect(-LEAN - 4, 0, cw + 2 * LEAN + 8, Hh);
          hs.g.restore();
          const mv = hs.g.createLinearGradient(0, 0, 0, Hh);
          mv.addColorStop(0, 'rgba(0,0,0,0)'); mv.addColorStop(0.35, 'rgba(0,0,0,1)'); mv.addColorStop(1, 'rgba(0,0,0,1)');
          hs.g.fillStyle = mv; hs.g.fillRect(0, 0, cw, Hh);
          g.drawImage(hs.c, CX - cw / 2, y0, cw, y1 - y0);
        }
        // 左侧歌词区：贴近镜头、完全虚化的逆光芭蕉，只盖背景的叶子（栏杆和烛画在它上面）
        g.drawImage(fgTex(), 0, 0, 520, H);
        // 叶后日光：拍点上亮度轻起慢落（不进入左侧歌词区）
        g.save();
        g.globalCompositeOperation = 'screen';
        A.glow(g, SUN[0], SUN[1], 520, '#fff6d8', 0.32 + 0.08 * pulse);
        // 叶脉间漏下的细光束：叶子摆开后更亮，缓慢呼吸，拍点上轻起
        g.globalAlpha = (0.45 + 0.55 * gust) * (0.85 + 0.1 * Math.sin(t * 0.9) + 0.1 * pulse);
        g.drawImage(raysTex(), 0, 0, W, H);
        g.restore();
        // 叶子摆开后（第1句第5字起），一道阳光从叶隙斜照到烛上
        if (sun > 0.01) {
          g.save();
          g.globalCompositeOperation = 'screen';
          g.globalAlpha = 0.62 * sun * (0.9 + 0.1 * pulse);
          g.drawImage(beamTex(), CX - 190 + sdx * 0.25, -40, 540, 582);
          g.restore();
        }
        // 栏杆（连到画框左缘）
        g.drawImage(railTex(), 0, RAIL_Y0, W, H - RAIL_Y0);
        // 移动的叶影：落在栏杆顶面和烛上（带一道撕裂叶缝漏下的细光）
        // 叶影带：暖褐的软边阴影，中间夹一道撕裂叶缝漏下的细光
        const band = (x0, x1, y0, y1, a) => {
          const sh = `rgb(${Math.round(255 - 112 * a)},${Math.round(255 - 122 * a)},${Math.round(255 - 140 * a)})`;
          const sh2 = `rgb(${Math.round(255 - 60 * a)},${Math.round(255 - 64 * a)},${Math.round(255 - 74 * a)})`;
          const x00 = x0 - 18, span = x1 - x0 + 36;
          const st = (x) => clamp((x - x00) / span);
          const gr = g.createLinearGradient(x00, 0, x00 + span, 0);
          gr.addColorStop(0, '#ffffff');
          gr.addColorStop(st(x0 + 18), sh);
          gr.addColorStop(st(x0 + 66), sh);
          gr.addColorStop(st(x0 + 74), sh2);
          gr.addColorStop(st(x0 + 82), sh);
          gr.addColorStop(st(x1 - 18), sh);
          gr.addColorStop(1, '#ffffff');
          g.fillStyle = gr; g.fillRect(x00, y0, span, y1 - y0);
        };
        g.save();
        g.globalCompositeOperation = 'multiply';
        band(sL, sR, RT, RF, 1.0);
        g.restore();
        // 接触阴影：日头高、在身后，影子短而软，略偏向镜头一侧（只落在栏杆顶面）
        g.save();
        g.beginPath(); g.rect(CX - 80, RT, 160, RF - RT - 0.5); g.clip();
        g.translate(CX + 3, CBW + 5); g.scale(1, 5 / 34);
        const csh = g.createRadialGradient(0, 0, 0, 0, 0, 34);
        csh.addColorStop(0, `rgba(60,34,16,${0.3 + 0.08 * sun})`); csh.addColorStop(0.6, `rgba(60,34,16,${0.2 + 0.05 * sun})`); csh.addColorStop(1, 'rgba(60,34,16,0)');
        g.fillStyle = csh; g.fillRect(-34, -34, 68, 68);
        g.restore();
        // 烛与烛焰（按 CS 放大）
        const lean = 1.2 + 2.2 * gust;
        g.save();
        g.translate(CX, CBW); g.scale(CS, CS); g.translate(-CX, -CB);
        const sil = drawCandle(g, t, sun, out ? Math.exp(-(t - T.shou) / 0.7) : 1, melt, pulse);
        // 烛上的叶影（与顶面同一条带，按画面坐标画）
        g.save();
        g.clip(sil);
        g.translate(CX, CB); g.scale(1 / CS, 1 / CS); g.translate(-CX, -CBW);
        g.globalCompositeOperation = 'multiply';
        band(sL, sR, CTW - 12, CBW + 12, 0.8);
        g.restore();
        drawFlame(g, t, lerp(1, 0.22, sun), hk, lean, sun);
        // 烛芯；熄灭后一点余烬慢慢冷却
        const wickH = 7 - 5 * sink;
        g.strokeStyle = '#2a1a12'; g.lineWidth = 1.4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(CX, CT + 1); g.quadraticCurveTo(CX + 0.5, CT - wickH * 0.6, CX + 1.6, CT + 1 - wickH); g.stroke();
        if (out) {
          const em = Math.exp(-(t - T.shou) / 0.5);
          g.fillStyle = `rgba(255,120,50,${0.9 * em})`;
          g.beginPath(); g.arc(CX + 1.6, CT + 1 - wickH, 1.4, 0, TAU); g.fill();
        }
        g.restore();
        // 熄灭的青烟（画面坐标，从烛芯顶升起）
        const wk = toW(CX + 1.6, CT + 1 - wickH);
        drawSmoke(g, t, T.shou, wk[0], wk[1] - 1);
        // 阳光里的微尘：顺风缓缓右飘，拍点上微闪；左侧歌词区淡出
        g.save();
        g.globalCompositeOperation = 'screen';
        for (let i = 0; i < 46; i++) {
          const sp = 6 + h2(i, 3) * 10;
          const span = W + 200;
          const x = ((h2(i, 1) * span + sp * t) % span) - 100;
          const y = 120 + h2(i, 2) * 400 + 14 * Math.sin(t * 0.4 + i);
          const fade = smooth((x - 360) / 160) * (0.5 + 0.5 * noise1(t * 0.5 + i * 3.1, 7));
          if (fade < 0.02) continue;
          const a = fade * (0.35 + 0.25 * pulse * h2(i, 5));
          g.fillStyle = `rgba(255,250,215,${a})`;
          g.beginPath(); g.arc(x, y, 0.8 + h2(i, 4) * 1.3, 0, TAU); g.fill();
        }
        g.restore();
        g.restore();
      },
    });
  })();

  // ============================================================
  // x1_frozen 冰湖孤灯：晴朗冬夜，月下冰湖，岸边一盏石灯笼独自亮着
  // ============================================================
  (function () {
    const YH = 380, KF = 340;              // 地平线；y = YH + KF / Z
    const ZL = KF / 90;                    // 石灯笼所在深度（岸线 y≈470）
    const FAR = 392;                       // 对岸线
    const LX0 = 410, LB = 448, WL = 472;   // 灯笼着地 x（镜头起点时）、底、灯前水线
    const MOON = [1060, 112, 24];
    const PAN = 110;                       // 灯笼深度上的总平移
    const WIND = 45;                       // 灯笼深度上的风速（px/s，向左）
    const dfac = (y) => (y - YH) / 90;     // 某深度相对灯笼深度的视差倍数
    // 地面坐标 → 屏幕（镜头起点）
    const FX = 900;
    const proj = (X, Z) => [640 + (FX * X) / Z, YH + KF / Z];
    const unproj = (x, y) => { const Z = KF / (y - YH); return [((x - 640) * Z) / FX, Z]; };

    function skyTex() {
      return K.cache('ff3_x1_sky', W, 420, 1, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 420);
        gr.addColorStop(0, '#08101d'); gr.addColorStop(0.45, '#0f1b2e'); gr.addColorStop(0.85, '#1f3149'); gr.addColorStop(1, '#2a3f58');
        g.fillStyle = gr; g.fillRect(0, 0, W, 420);
        // 月亮一侧的天光
        const mg = g.createRadialGradient(MOON[0], MOON[1], 0, MOON[0], MOON[1], 560);
        mg.addColorStop(0, 'rgba(142,166,191,0.32)'); mg.addColorStop(0.4, 'rgba(110,135,165,0.12)'); mg.addColorStop(1, 'rgba(110,135,165,0)');
        g.fillStyle = mg; g.fillRect(0, 0, W, 420);
        // 很淡的银河（斜贯左上）
        blurInto(g, W, 420, 18, (tg) => {
          tg.fillStyle = 'rgba(150,170,200,0.045)';
          tg.beginPath(); tg.moveTo(-50, 260); tg.bezierCurveTo(200, 150, 420, 60, 620, -40); tg.lineTo(760, -40); tg.bezierCurveTo(520, 90, 280, 200, -50, 340); tg.closePath(); tg.fill();
        });
      });
    }
    const STARS = (() => {
      const r = rng(902), out = [];
      for (let i = 0; i < 150; i++) {
        const x = r() * W, y = Math.pow(r(), 1.3) * 300;
        if (Math.hypot(x - MOON[0], y - MOON[1]) < 120) continue;
        const m = r();
        out.push([x, y, 0.4 + m * m * 1.2, 0.25 + r() * 0.6, 0.8 + r() * 2.2, r() * TAU]);
      }
      return out;
    })();
    // 远山：水墨干笔。每层一条自己的山脊线（圆润的山体 + 嶙峋的峰顶），山体里是顺坡而下的竖向皴笔：
    // 背月（左）坡墨重而密，迎月（右）坡少皴、多留白当作月下积雪；山脚没入寒雾
    const MTN = [
      { // 远层：高、淡、偏冷
        seed: 41, base: 404, step: 2.2,
        peaks: [[70, 118, 120, 170, 1.15], [300, 168, 150, 105, 1.2], [470, 104, 80, 105, 1.1], [690, 150, 190, 125, 1.2], [905, 176, 105, 160, 1.25], [1150, 128, 150, 105, 1.15], [1340, 158, 120, 140, 1.2]],
        crag: 1, body: '#34465c', mid: '#3e526b', snow: '#c9d6e4', ink: '#1a2638', mist: '#5a7392',
      },
      { // 近层：低、深
        seed: 57, base: 404, step: 1.8,
        peaks: [[150, 80, 150, 125, 1.2], [420, 104, 125, 175, 1.3], [690, 66, 135, 105, 1.15], [960, 94, 165, 140, 1.25], [1240, 76, 125, 155, 1.2]],
        crag: 0.7, body: '#1f2d3e', mid: '#27384c', snow: '#7f95ac', ink: '#0e1622', mist: '#46607e',
      },
    ];
    function mtnRidge(L) {
      // 山脊：取各峰的最大值（峰与峰之间有鞍部），再叠一层只在高处明显的嶙峋起伏
      return (x) => {
        let hm = 0;
        for (const [c, hgt, wl, wr, pw] of L.peaks) {
          // 峰顶圆缓（d≈0 时近似抛物线），山腰下凹：不是三角形
          const d = (x - c) / (x < c ? wl : wr), dr = Math.sqrt(d * d + 0.09) - 0.3;
          hm = Math.max(hm, hgt * Math.exp(-Math.pow(dr, pw)));
        }
        const hf = clamp(hm / 160);
        const crag = (9 * fbm(x / 46, L.seed, 3) + 5 * (Math.abs(noise1(x / 21, L.seed + 5) * 2 - 1) - 0.5) + 2.2 * fbm(x / 9, L.seed + 9, 2)) * (0.35 + 0.65 * hf) * L.crag;
        return L.base - 22 - hm + crag;
      };
    }
    function mtnTex(layer) {
      return K.cache('ff3_x1_inkmtn' + layer, W + 120, 260, 1, (g) => {
        g.translate(0, -160);
        const L = MTN[layer], r = rng(700 + layer * 19);
        const ridge = mtnRidge(L);
        const x0 = -12, x1 = W + 132;
        const slope = (x) => (ridge(x + 7) - ridge(x - 7)) / 14;
        blurInto(g, W + 120, 260, layer === 0 ? 0.7 : 0.45, (tg) => {
          const sil = new Path2D();
          sil.moveTo(x0, L.base + 20);
          for (let x = x0; x <= x1; x += 2) sil.lineTo(x, ridge(x));
          sil.lineTo(x1, L.base + 20); sil.closePath();
          // 底色：一层淡墨，越往下越淡入雾
          const bg = tg.createLinearGradient(0, L.base - 230, 0, L.base);
          bg.addColorStop(0, L.mid); bg.addColorStop(0.55, L.body); bg.addColorStop(1, L.mist);
          tg.fillStyle = bg; tg.fill(sil);
          tg.save(); tg.clip(sil);
          tg.lineCap = 'butt';
          // 一笔干笔：分成许多短段，段间留飞白，墨色由浓到枯
          const dry = (sx, sy, len, w, slant, col, a) => {
            tg.strokeStyle = col;
            let x = sx, y = sy;
            const n = Math.max(2, Math.round(len / 5));
            for (let k = 0; k < n; k++) {
              const u = k / n, sl = len / n * (0.7 + r() * 0.6);
              const nx = x + slant * sl + (r() - 0.5) * 0.5, ny = y + sl;
              if (r() > 0.16 + 0.3 * u) {
                tg.globalAlpha = a * (1 - 0.75 * u) * (0.55 + 0.45 * r());
                tg.lineWidth = w * (1 - 0.45 * u) * (0.7 + 0.3 * r());
                tg.beginPath(); tg.moveTo(x, y); tg.lineTo(nx, ny); tg.stroke();
              }
              x = nx; y = ny;
            }
          };
          // 坡面上某点 (x, y) 受不受月光：取它“上游”山脊处的坡向——明暗交界从峰顶斜着向右下延伸，
          // 交界线带噪声、并不笔直；再叠一层高频起伏，坡面上出现一道道受光的小山脊和背光的沟
          const litAt = (x, y, nk) => {
            const xs = x - 0.42 * Math.max(0, y - ridge(x)) + 14 * (noise1(y / 23 + x / 90, L.seed + 41) - 0.5);
            return smooth(slope(xs) * 1.5 + 0.15 + nk * (0.9 * (noise1(x / 16, L.seed + 21) - 0.5) + 0.4 * (noise1(x / 6, L.seed + 23) - 0.5)));
          };
          // 淡淡的底色：按整像素的小格铺满（格与格不重叠，不会出现网格纹），迎月面上部是月下积雪的亮，
          // 背月面是冷墨，都向山脚变淡；随后整层再轻轻虚化
          tg.globalAlpha = 1;
          for (let x = Math.floor(x0); x < x1; x += 2) {
            const yr = Math.floor(ridge(x + 1)) - 1, hgt = L.base - yr, wl = hgt * (0.5 + 0.3 * noise1(x / 30, L.seed + 31));
            for (let y = yr; y < yr + hgt * 0.75; y += 2) {
              const u = (y - yr) / Math.max(1, hgt), lt = litAt(x + 1, y + 1, 0.35);
              const sa = 0.44 * smooth((lt - 0.25) / 0.5) * clamp(1 - (y - yr) / wl);
              const ia = 0.22 * (1 - lt) * clamp(1 - u / 0.75);
              if (sa > 0.01) { tg.fillStyle = rgba(L.snow, sa); tg.fillRect(x, y, 2, 2); }
              if (ia > 0.01) { tg.fillStyle = rgba(L.ink, ia); tg.fillRect(x, y, 2, 2); }
            }
          }
          for (let x = x0; x <= x1; x += L.step * (0.7 + r() * 0.6)) {
            const yr = ridge(x), s = slope(x);
            const hgt = L.base - yr;
            const slant = clamp(s * 0.55, -0.6, 0.6);       // 皴笔顺着坡向
            // 迎月面上部：雪（亮笔），夹少量石纹
            const y1 = yr + r() * 3, lit1 = litAt(x, y1 + 6, 1);
            if (lit1 > 0.2) dry(x, y1, hgt * (0.15 + r() * 0.35) * lit1, 1.4 + r() * 1.6, slant, L.snow, (0.4 + 0.45 * r()) * lit1);
            // 皴笔：背月面又密又重，迎月面稀而淡
            const nInk = lit1 > 0.5 ? (r() < 0.45 ? 1 : 0) : 1 + (r() < 0.6 ? 1 : 0);
            for (let q = 0; q < nInk; q++) {
              const sy = yr + 2 + Math.pow(r(), 1.6) * hgt * 0.5, lq = litAt(x, sy + 10, 1);
              dry(x + (r() - 0.5) * 2, sy, (16 + r() * 60) * (0.5 + hgt / 200), 0.8 + r() * 1.4, slant, L.ink, (0.12 + 0.22 * r()) * (1 - 0.65 * lq));
            }
            // 背月面也有一点雪光（被天光照亮的冷灰）
            if (lit1 < 0.5 && r() < 0.35) dry(x, yr + r() * 6, hgt * (0.1 + r() * 0.2), 1 + r(), slant, L.snow, 0.16 * (1 - lit1));
          }
          tg.globalAlpha = 1;
          // 山脚没入寒雾
          const mg = tg.createLinearGradient(0, L.base - 70, 0, L.base - 8);
          mg.addColorStop(0, rgba(L.mist, 0)); mg.addColorStop(1, rgba(L.mist, 0.96));
          tg.fillStyle = mg; tg.fillRect(x0, L.base - 70, x1 - x0, 90);
          tg.restore();
          // 山脊线：背月一侧一道枯墨，迎月一侧一线雪光
          tg.lineJoin = 'round';
          for (let x = x0; x < x1; x += 3) {
            const s = slope(x), lit = smooth(s * 1.6 + 0.15);
            const ya = ridge(x), yb = ridge(x + 3);
            if (L.base - ya < 40) continue;
            tg.strokeStyle = lit > 0.5 ? rgba(L.snow, 0.6 * lit) : rgba(L.ink, (0.12 + 0.18 * r()) * (1 - lit));
            tg.lineWidth = lit > 0.5 ? 1.0 : 1.0 + r() * 1.2;
            tg.beginPath(); tg.moveTo(x, ya + 0.6); tg.lineTo(x + 3, yb + 0.6); tg.stroke();
          }
        });
      });
    }
    // 山脚的寒雾带：一层柔和的亮雾，加几团雾絮，可横向平铺（向左缓缓飘）
    function mistTex() {
      return K.cache('ff3_x1_mist', W, 80, 1, (g) => {
        g.translate(0, -340);
        const gr = g.createLinearGradient(0, 344, 0, 404);
        gr.addColorStop(0, 'rgba(112,134,162,0)'); gr.addColorStop(0.45, 'rgba(118,140,168,0.42)'); gr.addColorStop(0.8, 'rgba(110,132,160,0.5)'); gr.addColorStop(1, 'rgba(100,122,150,0.25)');
        g.fillStyle = gr; g.fillRect(0, 344, W, 60);
        blurInto(g, W, 80, 9, (tg) => {
          const r = rng(313);
          for (let i = 0; i < 16; i++) {
            const x = (i + r() * 0.8) / 16 * W, y = 366 + r() * 22, rx = 90 + r() * 160, ry = 5 + r() * 7;
            tg.fillStyle = `rgba(150,170,196,${0.16 + r() * 0.16})`;
            // 横向平铺：靠边的雾团在另一侧再画一次
            for (const o of [-W, 0, W]) { tg.beginPath(); tg.ellipse(x + o, y, rx, ry, 0, 0, TAU); tg.fill(); }
          }
        });
      });
    }
    // 对岸：低矮的雪松林
    function shoreTex() {
      return K.cache('ff3_x1_shore', W + 120, 60, 1, (g) => {
        g.translate(0, -350);
        const r = rng(61);
        blurInto(g, W + 120, 60, 0.7, (tg) => {
          tg.fillStyle = '#16233a';
          tg.beginPath(); tg.moveTo(0, FAR + 1);
          for (let x = 0; x <= W + 120; x += 6) tg.lineTo(x, FAR - 4 - 3 * noise1(x / 70, 5));
          tg.lineTo(W + 120, FAR + 1); tg.closePath(); tg.fill();
          for (let i = 0; i < 260; i++) {
            const x = r() * (W + 120);
            const dens = noise1(x / 90, 12);
            if (r() > dens * 1.4) continue;
            const h = (5 + r() * 11) * (0.6 + dens * 0.8), w = h * (0.3 + r() * 0.12);
            const y = FAR - 3 + r() * 1.5;
            tg.fillStyle = r() < 0.5 ? '#121d30' : '#17243a';
            tg.beginPath(); tg.moveTo(x, y - h); tg.lineTo(x + w, y); tg.lineTo(x - w, y); tg.closePath(); tg.fill();
            tg.fillStyle = 'rgba(200,215,232,0.5)';
            tg.beginPath(); tg.moveTo(x, y - h); tg.lineTo(x + w * 0.5, y - h * 0.5); tg.lineTo(x, y - h * 0.62); tg.closePath(); tg.fill();
          }
          tg.fillStyle = 'rgba(190,206,224,0.5)'; tg.fillRect(0, FAR - 1, W + 120, 1.6);
        });
      });
    }
    // 冰面（镜头起点时的屏幕坐标；横向留出平移余量）：反光、雪痕、细长裂纹
    const IW = W + 520, IY = FAR - 2, IH = H - IY;
    function crackPath(r, sx, sy, lenU, ang, branch) {
      const [X0, Z0] = unproj(sx, sy);
      let X = X0, Z = Z0, a = ang;
      const pts = [proj(X, Z)];
      const n = Math.round(lenU / 0.05);
      for (let i = 0; i < n; i++) {
        a += (r() - 0.5) * 0.12 + (r() < 0.06 ? (r() - 0.5) * 1.1 : 0);
        X += Math.cos(a) * 0.05; Z += Math.sin(a) * 0.05;
        if (Z < 1.02) { Z = 1.02; a = -a; }
        pts.push(proj(X, Z));
      }
      return pts;
    }
    const CRACKS = (() => {
      const r = rng(733), out = [];
      const seeds = [[300, 560, 6, 0.1], [760, 515, 7, -0.25], [1180, 620, 4, 0.3], [960, 470, 9, 0.05], [1420, 500, 8, 3.1], [620, 432, 14, 0.02], [1560, 650, 3, 2.9]];
      seeds.forEach(([x, y, L, a]) => {
        const main = crackPath(r, x, y, L * 0.4, a);
        out.push({ pts: main, w: 1 });
        for (let b = 0; b < 2; b++) {
          const p = main[Math.floor(r() * main.length)];
          if (p[1] <= YH + 8) continue;
          out.push({ pts: crackPath(r, p[0], p[1], 0.3 + r() * 0.6, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6)), w: 0.6 });
        }
      });
      return out;
    })();
    function strokeCrack(g, pts, frac, col, wMul, glow) {
      const n = Math.max(2, Math.round(pts.length * frac));
      for (let i = 1; i < n; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        const d = dfac((y0 + y1) / 2);
        g.lineWidth = Math.max(0.35, (glow ? 2.2 : 0.7) * Math.sqrt(d) * wMul);
        g.strokeStyle = col;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
    }
    function iceTex() {
      return K.cache('ff3_x1_ice', IW, IH, 1, (g) => {
        g.translate(0, -IY);
        const gr = g.createLinearGradient(0, IY, 0, H);
        gr.addColorStop(0, '#41597a'); gr.addColorStop(0.08, '#2c4260'); gr.addColorStop(0.35, '#1b2c44'); gr.addColorStop(1, '#101b2c');
        g.fillStyle = gr; g.fillRect(0, IY, IW, IH);
        // 对岸林的模糊倒影（冰面不是镜子：淡、糊）
        blurInto(g, IW, IH, 3, (tg) => {
          tg.fillStyle = 'rgba(12,20,34,0.45)';
          tg.fillRect(0, FAR, IW, 7);
          tg.fillStyle = 'rgba(160,180,205,0.1)'; tg.fillRect(0, FAR + 8, IW, 3);
        });
        // 风吹成的雪痕：沿风向拉长的浅色斑（地面上的椭圆投影）
        blurInto(g, IW, IH, 1.2, (tg) => {
          const r = rng(77);
          for (let i = 0; i < 46; i++) {
            const y = YH + 14 + Math.pow(r(), 0.8) * (H - YH - 14);
            const d = dfac(y);
            const x = r() * IW;
            const rx = (24 + r() * 90) * d, ry = (1.5 + r() * 3.5) * d * 0.45 + 0.6;
            const a = (0.06 + r() * 0.12) * (1.15 - 0.5 * clamp((y - 450) / 270));
            // 雪痕：一头钝一头尖，顺风拉长
            tg.fillStyle = `rgba(196,212,230,${a})`;
            tg.beginPath();
            tg.moveTo(x - rx, y);
            tg.bezierCurveTo(x - rx * 0.5, y - ry * 1.2, x + rx * 0.5, y - ry, x + rx, y + ry * 0.2);
            tg.bezierCurveTo(x + rx * 0.4, y + ry * 1.1, x - rx * 0.4, y + ry * 0.9, x - rx, y);
            tg.fill();
          }
        });
        // 细霜点
        const r2 = rng(78);
        for (let i = 0; i < 900; i++) {
          const y = YH + 12 + r2() * (H - YH - 12), d = dfac(y);
          g.fillStyle = `rgba(190,208,228,${0.05 + r2() * 0.12})`;
          g.fillRect(r2() * IW, y, 0.6 + d * 0.8, 0.5 + d * 0.25);
        }
        // 裂纹：暗缝 + 迎月的一线亮边
        g.lineCap = 'round';
        CRACKS.forEach((c) => {
          g.save(); g.translate(0.6, 0.8); strokeCrack(g, c.pts, 1, 'rgba(8,14,24,0.45)', c.w); g.restore();
          strokeCrack(g, c.pts, 1, `rgba(190,210,234,${c.w < 1 ? 0.18 : 0.28})`, c.w);
        });
      });
    }
    // 近岸：积雪的岩石小岬，灯笼立在上面
    const BANK_R = LX0 + 160;
    // 岸顶轮廓：右端是圆润的岩肩，落到水线
    const bankTop = (x) => {
      let y = 440 + 4 * fbm(x / 90, 31, 3) - 5 * Math.exp(-(((x - LX0) / 70) ** 2));
      const xs = LX0 + 92, R = 66;
      if (x > xs) { const u = clamp((x - xs) / R); y += (WL + 2 - y) * (1 - Math.sqrt(Math.max(0, 1 - u * u))); }
      return y;
    };
    const snowTh = (x) => 7.5 * (1 - 0.75 * smooth((x - LX0 - 80) / 80));
    function bankTex() {
      return K.cache('ff3_x1_bank', BANK_R + 260, 120, 1, (g) => {
        g.translate(200, -400);
        const x0 = -200, x1 = BANK_R + 30;
        // 岩体（前脸）
        const face = new Path2D();
        face.moveTo(x0, bankTop(x0));
        for (let x = x0; x <= x1; x += 4) face.lineTo(x, Math.min(WL + 2, bankTop(x)));
        face.lineTo(x1 + 10, WL + 3);
        for (let x = x1; x >= x0; x -= 6) face.lineTo(x, WL + 2 + 3 * noise1(x / 30, 9));
        face.closePath();
        // 岸坡：大部分被雪盖住，坡脚近水处偏暗偏冷
        const fg2 = g.createLinearGradient(0, 436, 0, WL + 2);
        fg2.addColorStop(0, '#9fb3c8'); fg2.addColorStop(0.55, '#6d84a0'); fg2.addColorStop(1, '#2c3c52');
        g.fillStyle = fg2; g.fill(face);
        g.save(); g.clip(face);
        // 半埋的岩石：大小不一、棱角分明，右上受月光，顶上一层薄雪
        const r = rng(91);
        const rocks = [[-160, 46, 13, 3], [-118, 20, 7, 4], [-40, 30, 9, -4], [24, 62, 17, 3], [70, 24, 8, 4], [150, 18, 6, -5], [220, 40, 12, 3], [262, 22, 9, 4], [330, 70, 19, 3], [LX0 - 18, 26, 9, -3], [LX0 + 46, 58, 18, 3], [LX0 + 86, 24, 9, 4], [LX0 + 128, 42, 14, 3]];
        rocks.forEach(([x, w, hh, dy]) => {
          const yb = WL + dy, yt = yb - hh - 3;
          const p = new Path2D();
          p.moveTo(x - w * 0.5, yb);
          p.lineTo(x - w * 0.46, yt + hh * 0.45);
          p.lineTo(x - w * 0.15, yt + r() * 3);
          p.lineTo(x + w * 0.22, yt + 1 + r() * 2);
          p.lineTo(x + w * 0.5, yt + hh * 0.5);
          p.lineTo(x + w * 0.52, yb);
          p.closePath();
          const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
          gr.addColorStop(0, '#141c28'); gr.addColorStop(0.6, '#1f2a3a'); gr.addColorStop(1, '#3a4a60');
          g.fillStyle = gr; g.fill(p);
          g.strokeStyle = 'rgba(150,172,200,0.5)'; g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(x + w * 0.22, yt + 2); g.lineTo(x + w * 0.5, yt + hh * 0.5); g.stroke();
          g.fillStyle = 'rgba(214,226,238,0.85)';
          g.beginPath(); g.moveTo(x - w * 0.4, yt + hh * 0.42); g.quadraticCurveTo(x - w * 0.1, yt - 2.5, x + w * 0.3, yt + 1); g.quadraticCurveTo(x, yt + 2.5, x - w * 0.4, yt + hh * 0.42); g.fill();
        });
        g.restore();
        // 雪面
        blurInto(g, BANK_R + 260, 120, 0.8, (tg) => {
          const sn = tg.createLinearGradient(0, 428, 0, 452);
          sn.addColorStop(0, '#d9e4ef'); sn.addColorStop(1, '#a9bccf');
          tg.fillStyle = sn;
          tg.beginPath(); tg.moveTo(x0, bankTop(x0) - snowTh(x0));
          for (let x = x0; x <= x1; x += 3) tg.lineTo(x, bankTop(x) - snowTh(x) - 1.5 * noise1(x / 20, 4));
          for (let x = x1; x >= x0; x -= 3) tg.lineTo(x, Math.min(WL - 1, bankTop(x) + 2 + 2.5 * noise1(x / 26, 6) * (1 - smooth((x - LX0 - 90) / 40))));
          tg.closePath(); tg.fill();
          // 雪檐下沿的冷影
          tg.strokeStyle = 'rgba(70,92,124,0.45)'; tg.lineWidth = 1.2;
          tg.beginPath();
          for (let x = x0; x <= x1; x += 3) { const y = Math.min(WL - 1, bankTop(x) + 2 + 2.5 * noise1(x / 26, 6) * (1 - smooth((x - LX0 - 90) / 40))); x === x0 ? tg.moveTo(x, y) : tg.lineTo(x, y); }
          tg.stroke();
        });
      });
    }
    // 石灯笼（春日式）：基座、竿、中台、火袋、笠、宝珠；顶面积雪；右侧受月光
    function lanternTex() {
      return K.cache('ff3_x1_lantern', 220, 290, 1, (g) => {
        g.translate(110, 280);            // 着地点在 (0,0)
        const stone = '#2a3442', stoneL = '#55657a', stoneD = '#1a212c';
        const box = (x0, y0, x1, y1, xb0, xb1) => {
          // 梯形石块：左暗右亮
          const p = new Path2D(); p.moveTo(xb0, y1); p.lineTo(x0, y0); p.lineTo(x1, y0); p.lineTo(xb1, y1); p.closePath();
          const gr = g.createLinearGradient(Math.min(x0, xb0), 0, Math.max(x1, xb1), 0);
          gr.addColorStop(0, stoneD); gr.addColorStop(0.55, stone); gr.addColorStop(0.92, stoneL); gr.addColorStop(1, '#8396ad');
          g.fillStyle = gr; g.fill(p);
          return p;
        };
        const snowCap = (x0, x1, y, th, over) => {
          const p = new Path2D();
          p.moveTo(x0 - over, y + 1.5);
          p.bezierCurveTo(x0 - over - 2, y - th * 0.7, x0 + (x1 - x0) * 0.2, y - th, (x0 + x1) / 2, y - th * 1.05);
          p.bezierCurveTo(x0 + (x1 - x0) * 0.8, y - th, x1 + over * 0.6, y - th * 0.6, x1 + over * 0.5, y + 1.5);
          p.bezierCurveTo(x1, y + 3, x0, y + 3, x0 - over, y + 1.5);
          const gr = g.createLinearGradient(x0, 0, x1, 0);
          gr.addColorStop(0, '#9fb2c8'); gr.addColorStop(0.6, '#d6e1ec'); gr.addColorStop(1, '#eef4fa');
          g.fillStyle = gr; g.fill(p);
          g.strokeStyle = 'rgba(80,100,130,0.45)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(x0 - over + 1, y + 1.5); g.bezierCurveTo(x0, y + 3.2, x1, y + 3.2, x1 + over * 0.5 - 1, y + 1.5); g.stroke();
        };
        // 基座
        box(-48, -22, 48, 0, -56, 56);
        g.fillStyle = 'rgba(10,14,20,0.5)'; g.fillRect(-56, -2, 112, 2);
        snowCap(-46, 46, -22, 7, 3);
        // 竿（中段一道节）
        box(-15, -112, 15, -22, -18, 18);
        box(-19, -72, 19, -64, -19, 19);
        // 中台
        box(-46, -136, 46, -112, -24, 24);
        snowCap(-46, 46, -136, 7, 4);
        // 火袋（窗留空，夜里由灯火填亮）
        const fb = box(-30, -190, 30, -138, -30, 30);
        void fb;
        g.fillStyle = '#0d0f12';
        g.fillRect(-12, -178, 24, 28);
        // 笠：六角笠，檐角上翘（蕨手）
        const roof = new Path2D();
        roof.moveTo(-74, -194); roof.quadraticCurveTo(-80, -200, -78, -206);
        roof.quadraticCurveTo(-40, -214, -12, -234); roof.lineTo(12, -234);
        roof.quadraticCurveTo(40, -214, 78, -206); roof.quadraticCurveTo(80, -200, 74, -194);
        roof.quadraticCurveTo(0, -186, -74, -194); roof.closePath();
        let gr = g.createLinearGradient(-80, 0, 80, 0);
        gr.addColorStop(0, stoneD); gr.addColorStop(0.55, stone); gr.addColorStop(0.95, stoneL); gr.addColorStop(1, '#8a9cb2');
        g.fillStyle = gr; g.fill(roof);
        g.fillStyle = 'rgba(8,10,14,0.55)';
        g.beginPath(); g.moveTo(-74, -194); g.quadraticCurveTo(0, -186, 74, -194); g.quadraticCurveTo(0, -190, -74, -194); g.fill();
        // 笠上厚雪（背风的左侧略多出一点雪檐）
        const sp = new Path2D();
        sp.moveTo(-84, -203);
        sp.bezierCurveTo(-86, -212, -60, -216, -40, -224);
        sp.bezierCurveTo(-24, -236, -14, -246, 0, -247);
        sp.bezierCurveTo(16, -246, 26, -236, 40, -224);
        sp.bezierCurveTo(58, -216, 80, -214, 79, -206);
        sp.bezierCurveTo(60, -207, 30, -214, 10, -230);
        sp.lineTo(-10, -230);
        sp.bezierCurveTo(-30, -214, -60, -206, -84, -203);
        sp.closePath();
        gr = g.createLinearGradient(-86, 0, 80, 0);
        gr.addColorStop(0, '#90a4bb'); gr.addColorStop(0.5, '#cfdbe8'); gr.addColorStop(0.85, '#eef4fa'); gr.addColorStop(1, '#f6f9fc');
        g.fillStyle = gr; g.fill(sp);
        g.strokeStyle = 'rgba(70,90,120,0.4)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(-84, -203); g.bezierCurveTo(-60, -206, -30, -214, -10, -230); g.stroke();
        // 宝珠与请花
        box(-11, -252, 11, -244, -9, 9);
        const jw = new Path2D();
        jw.moveTo(-10, -252); jw.bezierCurveTo(-14, -262, -6, -270, 0, -276); jw.bezierCurveTo(6, -270, 14, -262, 10, -252); jw.closePath();
        gr = g.createLinearGradient(-12, 0, 12, 0);
        gr.addColorStop(0, stoneD); gr.addColorStop(0.6, stone); gr.addColorStop(1, '#8396ad');
        g.fillStyle = gr; g.fill(jw);
        g.fillStyle = '#e4ecf5';
        g.beginPath(); g.moveTo(-7, -264); g.bezierCurveTo(-4, -272, 4, -272, 7, -264); g.quadraticCurveTo(0, -262, -7, -264); g.fill();
        // 笠顶与宝珠之间的雪
        snowCap(-11, 11, -252, 3, 1);
      });
    }
    // 倒影贴图：岸与灯笼合成一张，压暗偏冷再模糊（世界坐标 y 300–520，x 与 bankTex 对齐）
    function reflTex() {
      return K.cache('ff3_x1_refl', BANK_R + 260, 220, 1, (g) => {
        g.translate(0, -300);
        blurInto(g, BANK_R + 260, 220, 2.6, (tg) => {
          tg.drawImage(bankTex(), 0, 400, BANK_R + 260, 120);
          tg.drawImage(lanternTex(), LX0 + 200 - 110, LB - 280, 220, 290);
          tg.globalCompositeOperation = 'source-atop';
          tg.fillStyle = 'rgba(16,28,46,0.55)'; tg.fillRect(0, 300, BANK_R + 260, 220);
        });
      });
    }
    // 雪粉流的贴图：白色、软边、沿风向拉长
    function wispTex() {
      return K.cache('ff3_x1_wisp', 420, 60, 1, (g) => {
        blurInto(g, 420, 60, 5, (tg) => {
          const r = rng(5);
          for (let i = 0; i < 14; i++) {
            const x = 40 + r() * 340, y = 22 + r() * 16, rx = 30 + r() * 70, ry = 2 + r() * 5;
            tg.fillStyle = `rgba(230,238,246,${0.25 + r() * 0.35})`;
            tg.beginPath(); tg.ellipse(x, y, rx, ry, (r() - 0.5) * 0.05, 0, TAU); tg.fill();
          }
        });
      });
    }
    const WISPS = [[410, 0.0, 0.4], [420, 0.37, 0.36], [434, 0.61, 0.42], [456, 0.18, 0.38], [490, 0.83, 0.34], [534, 0.45, 0.3], [582, 0.7, 0.24]];
    // 芦苇（近岸左侧）
    const REEDS = (() => { const r = rng(55), out = []; for (let i = 0; i < 9; i++) out.push([LX0 - 160 + r() * 80, 54 + r() * 46, r() * TAU, 0.6 + r() * 0.5]); return out; })();

    // 软光柱贴图：每行一条横向高斯渐变；prof(y) 返回 [半宽, 亮度]
    function columnTex(key, w, y0, y1, col, prof) {
      return K.cache(key, w, y1 - y0, 1, (g) => {
        const [r0, g0, b0] = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)];
        for (let y = y0; y < y1; y += 1) {
          const [hw, a] = prof(y);
          if (a <= 0.002) continue;
          const gr = g.createLinearGradient(w / 2 - hw * 2, 0, w / 2 + hw * 2, 0);
          for (let k = 0; k <= 8; k++) { const u = k / 8, d = (u - 0.5) * 4; gr.addColorStop(u, `rgba(${r0},${g0},${b0},${(a * Math.exp(-d * d)).toFixed(4)})`); }
          g.fillStyle = gr; g.fillRect(w / 2 - hw * 2, y - y0, hw * 4, 1.05);
        }
      });
    }
    // 月光柱：对岸附近窄而亮，近处宽而淡
    const moonCol = () => columnTex('ff3_x1_mcol', 360, FAR, H, '#d2deee', (y) => {
      const u = (y - FAR) / (H - FAR);
      return [9 + u * 105, (0.34 * Math.exp(-u * 3.2) + 0.05) * smooth((y - FAR) / 4)];
    });
    // 灯窗倒影：水线附近淡，镜像点附近最亮，往下渐散
    const lampCol = () => columnTex('ff3_x1_lcol', 120, WL, H, '#f6c77e', (y) => {
      const ref = 2 * WL - (LB - 164);
      const a = (0.08 + 0.5 * Math.exp(-(((y - ref) / 55) ** 2))) * smooth((y - WL - 2) / 26);
      return [4.5 + (y - WL) * 0.06, a];
    });
    XYT.registerShot('x1_frozen', {
      name: '冰湖孤灯', zone: 'bottom', night: true, text: '#e9eff6', shadow: 'rgba(8,14,26,0.85)', accent: '#f2c37a', bloom: 0.42,
      draw(g, c) {
        const t = c.lt;
        // 镜头右移：灯笼深度上总共 PAN，缓入缓出
        const P = PAN * smooth((t + 1.2) / (c.dur + 1.2));
        g.drawImage(skyTex(), 0, 0, W, 420);
        // 星星：缓慢闪烁
        for (const [x, y, rr, a, f, ph] of STARS) {
          const tw = a * (0.7 + 0.3 * Math.sin(t * f + ph));
          g.fillStyle = `rgba(232,240,250,${tw})`;
          g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
        }
        // 上弦月：亮面朝右
        const [mx, my, mr] = MOON;
        g.save();
        g.globalCompositeOperation = 'screen';
        A.glow(g, mx, my, mr * 7, '#a9bdd6', 0.32);
        A.glow(g, mx, my, mr * 2.6, '#e3ecf3', 0.35);
        g.restore();
        g.fillStyle = 'rgba(60,78,104,0.55)';
        g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
        const mg = g.createLinearGradient(mx - mr * 0.2, my - mr, mx + mr, my + mr);
        mg.addColorStop(0, '#f6f9fc'); mg.addColorStop(1, '#d8e3ee');
        g.fillStyle = mg;
        g.beginPath(); g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2); g.ellipse(mx, my, mr * 0.12, mr, 0, Math.PI / 2, -Math.PI / 2, false); g.fill();
        // 远山（几乎不随镜头动）
        g.drawImage(mtnTex(0), -40 - P * 0.04, 160, W + 120, 260);
        g.drawImage(mtnTex(1), -40 - P * 0.08, 160, W + 120, 260);
        // 山脚与对岸之间的寒雾带（y≈350–400），向左缓缓飘，比山更慢于镜头
        {
          const off = ((t * 4 + P * 0.1) % W + W) % W;
          g.drawImage(mistTex(), -off, 340, W, 80);
          g.drawImage(mistTex(), W - off, 340, W, 80);
        }
        g.drawImage(shoreTex(), -40 - P * dfac(FAR - 4), 350, W + 120, 60);
        // 冰面：地平面的横移随深度线性增加（剪切变换）
        g.save();
        g.beginPath(); g.rect(0, IY, W, IH); g.clip();
        g.transform(1, 0, -P / 90, 1, (P * YH) / 90, 0);
        g.drawImage(iceTex(), 0, IY, IW, IH);
        // 强拍上冰层收缩：新裂纹 0.15 s 内延伸后停住，月光在裂口上一闪再暗
        // 裂纹时刻：镜头内的强拍，外加最后一小节的第三拍（较轻）
        let ev = beatsIn(c, 0.3, c.dur - 0.6).filter((b) => b.down).map((b) => [b.t, 1]);
        const third = beatsIn(c, 0.3, c.dur - 0.9).filter((b) => b.k === 2);
        if (third.length) ev.push([third[third.length - 1].t, 0.6]);
        if (!ev.length) ev = [[1.47, 1], [4.8, 1], [6.47, 0.6]];
        ev.sort((a, b) => a[0] - b[0]);
        for (let k = 0; k < ev.length && k < 3; k++) {
          const D = ev[k][0], str = ev[k][1];
          // 裂纹固定在冰面上：起点取“裂开那一刻”在屏幕上的位置换算回镜头起点坐标
          const PD = PAN * smooth((D + 1.2) / (c.dur + 1.2));
          const cy = [600, 540, 650][k];
          const pts = crackPath(rng(880 + k * 7), [560, 860, 700][k] + PD * dfac(cy), cy, [1.6, 2.6, 1.3][k] * (0.6 + 0.4 * str), [0.12, -0.15, 0.2][k]);
          if (t < D) continue;
          const u = t - D;
          const frac = 1 - Math.pow(1 - clamp(u / 0.15), 2);
          const flash = (u < 0.15 ? smooth(u / 0.05) : Math.exp(-(u - 0.15) / 0.4)) * str;
          g.lineCap = 'round';
          g.save(); g.translate(0.6, 0.8); strokeCrack(g, pts, frac, 'rgba(8,14,24,0.55)', 1); g.restore();
          strokeCrack(g, pts, frac, `rgba(205,222,242,${0.3 + 0.5 * flash})`, 1);
          if (flash > 0.01) {
            g.save(); g.globalCompositeOperation = 'screen';
            strokeCrack(g, pts, frac, `rgba(170,200,235,${0.22 * flash})`, 1, true);
            g.restore();
          }
        }
        g.restore();
        // 冰面上的月光：月亮正下方一条模糊的竖光带（屏幕上不动），冰面的细小晶面滑过时一明一灭
        g.save();
        g.globalCompositeOperation = 'screen';
        g.drawImage(moonCol(), mx - 180, FAR, 360, H - FAR);
        const gl = rng(515);
        for (let i = 0; i < 220; i++) {
          const y0 = FAR + 3 + Math.pow(gl(), 1.4) * (H - FAR - 3);
          const x0 = gl() * IW;
          const d = dfac(y0);
          const x = x0 - P * d;
          const wcol = 10 + d * 34;
          const k2 = Math.exp(-(((x - mx) / wcol) ** 2));
          const sz = gl();
          if (k2 < 0.03) continue;
          const a = k2 * (0.35 + 0.65 * sz) * (0.6 + 0.4 * Math.sin(t * 2.3 + i));
          g.fillStyle = `rgba(230,240,252,${Math.min(0.85, a)})`;
          g.beginPath(); g.ellipse(x, y0, (0.5 + 0.8 * sz) * d, 0.4 + 0.18 * d, 0, 0, TAU); g.fill();
        }
        g.restore();
        // 灯笼深度上的物体（随镜头平移 P）
        const lx = LX0 - P;
        const fl = 1 + 0.06 * Math.sin(t * 7.3) + 0.04 * Math.sin(t * 11.9 + 1.1) + 0.03 * Math.sin(t * 3.1);
        // 冰面上灯窗的倒影：水线下一道模糊的暖色竖光带；灯笼的暗影倒影
        const winY = LB - 164;
        const refY = 2 * WL - winY;
        g.save();
        g.beginPath(); g.rect(0, WL, W, H - WL); g.clip();
        g.translate(0, WL); g.scale(1, -1); g.translate(0, -WL);
        // 岸与灯笼的倒影：以水线为轴翻转，偏暗偏冷、模糊（冰面不是镜子）
        g.globalAlpha = 0.5;
        g.drawImage(reflTex(), lx - LX0 - 200, 300, BANK_R + 260, 220);
        g.restore();
        g.save();
        g.globalCompositeOperation = 'screen';
        g.globalAlpha = clamp(fl);
        g.drawImage(lampCol(), lx - 60, WL, 120, H - WL);
        g.globalAlpha = 1;
        A.glow(g, lx, refY, 30, '#f2c37a', 0.16 * fl);
        g.restore();
        // 近岸
        g.drawImage(bankTex(), lx - LX0 - 200, 400, BANK_R + 260, 120);
        // 灯笼的影子：月在右前上方，影子落向左前
        g.fillStyle = 'rgba(40,56,84,0.4)';
        g.beginPath(); g.moveTo(lx - 50, LB - 1); g.lineTo(lx + 30, LB - 1); g.lineTo(lx - 30, LB + 12); g.lineTo(lx - 150, LB + 14); g.closePath(); g.fill();
        // 暖光照亮附近一小片雪
        g.save();
        g.globalCompositeOperation = 'screen';
        g.translate(lx, LB - 2); g.scale(1, 0.22);
        A.glow(g, 0, 0, 130, '#f2c37a', 0.3 * fl);
        g.restore();
        // 芦苇：实心的淡灰茎秆，向左弯（风向左）轻摇；穗子是一片顺风垂向左下的实心羽穗，穗梢一点积雪
        for (const [rx0, rh, ph, f] of REEDS) {
          const x = rx0 - P, base = bankTop(rx0) - 3;
          const bend = -(12 + 5 * Math.sin(t * f * TAU * 0.4 + ph) + 2.5 * Math.sin(t * 1.3 + ph * 2));
          const tx = x + bend, ty = base - rh + Math.abs(bend) * 0.25;
          const cx = x + 1, cy = base - rh * 0.55;
          const Q = (u) => [(1 - u) * (1 - u) * x + 2 * (1 - u) * u * cx + u * u * tx, (1 - u) * (1 - u) * base + 2 * (1 - u) * u * cy + u * u * ty];
          // 茎：沿二次曲线的一条由粗到细的实心带
          const Lp = [], Rp = [];
          for (let k = 0; k <= 8; k++) {
            const u = k / 8, p0 = Q(Math.max(0, u - 0.02)), p1 = Q(Math.min(1, u + 0.02)), pm = Q(u);
            let dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
            const hw = (1.7 - 1.0 * u) * 0.5 * (0.8 + 0.4 * h2(rx0 | 0, 3));
            Lp.push([pm[0] + dy * hw, pm[1] - dx * hw]); Rp.push([pm[0] - dy * hw, pm[1] + dx * hw]);
          }
          g.fillStyle = '#7f8a98';
          g.beginPath(); g.moveTo(Lp[0][0], Lp[0][1]); Lp.forEach(([px, py]) => g.lineTo(px, py)); for (let k = Rp.length - 1; k >= 0; k--) g.lineTo(Rp[k][0], Rp[k][1]); g.closePath(); g.fill();
          // 迎月（右）一侧一线亮
          g.strokeStyle = 'rgba(206,216,228,0.55)'; g.lineWidth = 0.5;
          g.beginPath(); Rp.forEach(([px, py], k) => (k ? g.lineTo(px + 0.2, py) : g.moveTo(px + 0.2, py))); g.stroke();
          // 一片下垂的叶：从茎下部伸出，顺风弯向左下
          {
            const [lx, ly] = Q(0.3), lw = 3.4, ll = rh * 0.3;
            const ex = lx - ll * 0.8 + bend * 0.2, ey = ly + ll * 0.2;
            g.fillStyle = '#76818f';
            g.beginPath(); g.moveTo(lx, ly - lw * 0.5);
            g.quadraticCurveTo(lx - ll * 0.4, ly - ll * 0.35, ex, ey);
            g.quadraticCurveTo(lx - ll * 0.4, ly - ll * 0.22, lx, ly + lw * 0.5);
            g.closePath(); g.fill();
          }
          // 穗：从茎梢垂向下风的实心羽穗（柔和的淡灰），穗背一抹积雪
          const ang = Math.atan2(ty - cy, tx - cx);
          const da = 2.15 + 0.12 * Math.sin(t * 1.9 + ph) + 0.05 * Math.sin(t * 3.1 + ph * 1.7);   // 相对茎梢方向向下风弯
          const pa = ang - da, pl = 13 + rh * 0.08;
          const px1 = tx + Math.cos(pa) * pl, py1 = ty + Math.sin(pa) * pl;
          const nx = -Math.sin(pa), ny = Math.cos(pa);
          const pw = 3.2;
          const pg = g.createLinearGradient(tx, ty, px1, py1);
          pg.addColorStop(0, '#9ea8b5'); pg.addColorStop(1, '#7f8996');
          g.fillStyle = pg;
          g.beginPath(); g.moveTo(tx, ty);
          g.quadraticCurveTo(tx + Math.cos(pa) * pl * 0.45 + nx * pw, ty + Math.sin(pa) * pl * 0.45 + ny * pw, px1, py1);
          g.quadraticCurveTo(tx + Math.cos(pa) * pl * 0.45 - nx * pw * 0.7, ty + Math.sin(pa) * pl * 0.45 - ny * pw * 0.7, tx, ty);
          g.closePath(); g.fill();
          // 穗背朝天的一侧积着一点雪
          const sx = tx + Math.cos(pa) * pl * 0.3, sy = ty + Math.sin(pa) * pl * 0.3;
          const up = ny < 0 ? 1 : -1;
          g.fillStyle = 'rgba(232,239,246,0.85)';
          g.beginPath(); g.ellipse(sx + nx * up * 1.4, sy + ny * up * 1.4, pl * 0.17, 1.0, pa, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(tx, ty - 0.5, 1.2, 0.9, 0, 0, TAU); g.fill();
        }
        // 灯笼本体
        g.drawImage(lanternTex(), lx - 110, LB - 280, 220, 290);
        // 灯窗：暖光，灯火微摇
        const wy0 = LB - 178, wh = 28;
        const wg = g.createLinearGradient(0, wy0, 0, wy0 + wh);
        wg.addColorStop(0, '#f7cf86'); wg.addColorStop(0.6, '#ffe2a8'); wg.addColorStop(1, '#f2b866');
        g.globalAlpha = clamp(0.85 * fl);
        g.fillStyle = wg; g.fillRect(lx - 12, wy0, 24, wh);
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,246,220,0.85)';
        g.beginPath(); g.ellipse(lx + 0.5 * Math.sin(t * 5.1), wy0 + wh * 0.62, 3.2, 6 * fl, 0, 0, TAU); g.fill();
        g.save();
        g.globalCompositeOperation = 'screen';
        A.glow(g, lx, wy0 + wh / 2, 70, '#f2c37a', 0.42 * fl);
        A.glow(g, lx, wy0 + wh / 2, 26, '#ffe6b0', 0.5 * fl);
        // 窗下中台积雪被照暖
        g.fillStyle = `rgba(242,195,122,${0.3 * fl})`;
        g.beginPath(); g.ellipse(lx, LB - 140, 34, 4, 0, 0, TAU); g.fill();
        g.restore();
        // 风把笠顶积雪吹成细雪粉向左飘下（持续的阵风 + 拍点上成批扬起）
        g.fillStyle = '#e8eef6';
        const life = 3.2, dt = 1 / 24;
        const kk0 = Math.floor((t - life) / dt), kk1 = Math.floor(t / dt);
        for (let k = kk0; k <= kk1; k++) {
          const te = k * dt, a = t - te;
          if (a < 0 || a > life) continue;
          const gust = noise1(te * 0.6, 21);
          if (h2(k, 3) > 0.35 + 0.6 * gust) continue;
          const ex = -70 + h2(k, 1) * 120;
          const ey = LB - 206 - (1 - Math.abs(ex) / 80) * 34;
          const v = WIND * (0.8 + 0.6 * h2(k, 2));
          const x = lx + ex - v * a + (4 + 6 * a) * Math.sin(a * 1.6 + k);
          const y = ey - 4 * (1 - Math.exp(-a * 3)) + 11 * a + 4 * a * a + (2 + 4 * a) * Math.sin(a * 1.3 + k * 0.7) + (h2(k, 6) - 0.5) * 10 * a;
          const al = smooth(a / 0.3) * (1 - smooth((a - life * 0.5) / (life * 0.5))) * (0.22 + 0.3 * h2(k, 4));
          g.globalAlpha = al;
          const sz = 0.8 + h2(k, 5) * 0.9;
          g.fillRect(x, y, sz, sz);
        }
        if (c.b && c.grid) {
          for (let j = 0; j < 4; j++) {
            const bi = c.b.i - j, tb = c.grid.time(bi) - (c.t - c.lt);
            for (let q = 0; q < 18; q++) {
              const a = t - tb - h2(bi * 31 + q, 7) * 0.25;
              if (a < 0 || a > 2.6) continue;
              const ex = -80 + h2(bi * 31 + q, 8) * 60;
              const ey = LB - 205 + h2(bi * 31 + q, 9) * 6;
              const x = lx + ex - WIND * 1.2 * a - 14 * (1 - Math.exp(-a * 3));
              const y = ey - 6 * (1 - Math.exp(-a * 3)) + 10 * a + 4 * a * a;
              g.globalAlpha = smooth(a / 0.3) * (1 - smooth((a - 1.2) / 1.4)) * 0.4;
              g.fillRect(x + (h2(bi * 31 + q, 10) - 0.5) * 14 * a, y + (h2(bi * 31 + q, 11) - 0.5) * 8 * a, 1, 1);
            }
          }
        }
        g.globalAlpha = 1;
        // 贴着冰面从右向左滑过的雪粉流（随深度变快变大）
        for (let i = 0; i < WISPS.length; i++) {
          const [y, ph, a] = WISPS[i];
          const d = dfac(y);
          const len = 420 * Math.min(1.6, 0.5 + d * 0.6), hh = 60 * Math.min(1.4, 0.35 + d * 0.35);
          const span = W + len + 200;
          for (let j = 0; j < 2; j++) {
            const x = ((((ph + j * 0.43) * span - (WIND * (1 + 0.15 * j) * t + P) * d) % span) + span) % span - len - 100;
            g.globalAlpha = a * (j ? 0.6 : 1) * (0.7 + 0.3 * Math.sin(t * 0.7 + i + j));
            g.drawImage(wispTex(), x, y - hh * 0.5, len, hh);
          }
        }
        g.globalAlpha = 1;
      },
    });
  })();

  // ============================================================
  // x2_bell 寺钟雪晓：雪后清晨，山寺钟亭，撞木撞钟，钟声荡开，松枝积雪滑落
  // ============================================================
  (function () {
    const BX = 480, BTOP = 126, BSH = 154, BLIP = 422;     // 钟：中心 x、顶、肩、口
    // 钟的半宽轮廓：圆顶、略向下张开的钟身、口沿微微外翻
    const bw = (y) => (y < BSH ? 88 * Math.sqrt(Math.max(0, 1 - ((BSH - y) / (BSH - BTOP + 2)) ** 2))
      : y < BLIP - 18 ? 88 + 10 * Math.pow((y - BSH) / (BLIP - 18 - BSH), 1.5)
      : 98 + 9 * ((y - BLIP + 18) / 18) ** 2);
    const BEAM = 80;                                        // 横梁下沿
    const SY = 340, SL = 240, SR0 = 18;                     // 撞木：轴线 y、长度、半径
    const GAP = 27;                                         // 静止时撞木左端离钟面约 25 px（端头圆角再向左凸约 1.5 px）
    const SX0 = BX + bw(SY) + GAP;                          // 撞木静止时左端 x
    const ROPE_X = [SX0 + 54, SX0 + 184];                   // 两根吊绳的位置（约 655 / 785）
    const LP = SY - BEAM;                                   // 摆长
    const OMEGA = Math.sqrt(9.8 / (LP / 180));              // 按约 180 px/m 估算的角频率
    const TH_HIT = -Math.asin((GAP - 1.5) / LP);            // 撞到钟面时的摆角：摆过竖直位置一点才碰到钟
    const PULL_END = [1300, 452];                           // 拉绳伸出画外的一点（撞钟的僧人在画外右侧）
    const FLOOR = 640;
    const RING_C = [BX, 300];
    const G_PX = 1300;                                      // 松枝所在深度上的重力（px/s²）
    const BR = { x: 76, y: 132 };                           // 松枝根部（在左柱后面）

    // 天空与远山：内容全是柔的，按 0.6 倍分辨率缓存
    function skyTex() {
      return K.cache('ff3_x2_sky', W, 660, 0.6, (g) => {
        const gr = g.createLinearGradient(0, 0, 0, 640);
        gr.addColorStop(0, '#b4c4d3'); gr.addColorStop(0.45, '#d3dde6'); gr.addColorStop(0.8, '#ebe7df'); gr.addColorStop(1, '#f1e4d0');
        g.fillStyle = gr; g.fillRect(0, 0, W, 660);
        // 太阳在画外右侧低处：右边天际暖亮
        const sg = g.createRadialGradient(1400, 430, 0, 1400, 430, 950);
        sg.addColorStop(0, 'rgba(255,230,192,0.95)'); sg.addColorStop(0.35, 'rgba(250,224,186,0.4)'); sg.addColorStop(1, 'rgba(250,224,186,0)');
        g.fillStyle = sg; g.fillRect(0, 0, W, 660);
        // 高空几缕薄云，底边被低斜的朝阳染成淡金
        blurBox(g, 0, 80, W, 180, 6, (tg) => {
          [[300, 150, 360, 9, 0.5], [760, 118, 420, 7, 0.42], [1050, 190, 300, 6, 0.38], [520, 210, 220, 5, 0.3]].forEach(([x, y, w, h, a]) => {
            const cg = tg.createLinearGradient(0, y - h, 0, y + h);
            cg.addColorStop(0, `rgba(255,255,255,${a * 0.6})`); cg.addColorStop(0.6, `rgba(250,232,206,${a})`); cg.addColorStop(1, `rgba(243,217,178,${a * 0.5})`);
            tg.fillStyle = cg;
            tg.beginPath(); tg.ellipse(x, y, w / 2, h, -0.02, 0, TAU); tg.fill();
            tg.beginPath(); tg.ellipse(x + w * 0.22, y + h * 0.6, w * 0.3, h * 0.6, -0.02, 0, TAU); tg.fill();
          });
        });
        // 山：水墨晕染的长岭。轮廓 = 大尺度起伏 + 细碎笔触；背光面冷灰、向下渐隐入雾；
        // 受光面在棱线右侧，先在临时层画好、模糊后只叠在山体上，所以明暗交界是柔的、轮廓是清的
        const range = (o) => blurBox(g, ...o.box, o.blur, (tg) => {
          const body = new Path2D();
          body.moveTo(o.x0, o.foot + 60);
          for (let x = o.x0; x <= o.x1; x += 3) body.lineTo(x, o.fy(x));
          body.lineTo(o.x1, o.foot + 60); body.closePath();
          const gr = tg.createLinearGradient(0, o.top, 0, o.foot);
          gr.addColorStop(0, o.sh); gr.addColorStop(0.45, mix(o.sh, o.fog, 0.35)); gr.addColorStop(1, o.fog);
          tg.fillStyle = gr; tg.fill(body);
          // 一个面：沿一条起伏的棱线向下；wd = 0 时棱线右侧整片受光，否则是一条向下收窄的带（负值在棱线左侧）
          const facet = (lg, col, [x0, sl, wob, a, len, wd, sd]) => {
            const y0 = o.fy(x0) - 1, y1 = Math.min(o.foot + 30, y0 + len);
            const sp = (y) => x0 + (y - y0) * sl + wob * fbm((y - y0) / 70, sd, 2) * Math.min(1, (y - y0) / 50);
            const fg = lg.createLinearGradient(0, y0, 0, y1);
            fg.addColorStop(0, rgba(col, a)); fg.addColorStop(0.55, rgba(col, a * 0.55)); fg.addColorStop(1, rgba(col, 0));
            lg.fillStyle = fg;
            lg.beginPath();
            const pts = [];
            for (let y = y0; y <= y1; y += 4) pts.push([sp(y), y]);
            if (!wd) {
              lg.moveTo(x0, y0 - 40); pts.forEach(([x, y]) => lg.lineTo(x, y));
              lg.lineTo(pts[pts.length - 1][0] + 900, y1); lg.lineTo(x0 + 900, y0 - 40);
            } else {
              lg.moveTo(pts[0][0], pts[0][1]); pts.forEach(([x, y]) => lg.lineTo(x, y));
              for (let i = pts.length - 1; i >= 0; i--) lg.lineTo(pts[i][0] + wd * Math.pow(1 - (pts[i][1] - y0) / (y1 - y0 + 1), 0.7), pts[i][1]);
            }
            lg.closePath(); lg.fill();
          };
          // 大面（背光暗带 + 受光面）一层大模糊；细的雪棱与雪檐一层小模糊
          blurBox(tg, ...o.box, o.soft, (lg) => {
            if (o.shade) o.shade.forEach((f) => facet(lg, o.dark, f));
            o.faces.forEach((f) => facet(lg, o.lit, f));
          }, 1, 'source-atop');
          if (o.ribs || o.rim) blurBox(tg, ...o.box, 1.5, (lg) => {
            if (o.ribs) o.ribs.forEach((f) => facet(lg, o.lit, f));
            // 迎光的雪檐：棱线右侧一线暖白
            if (o.rim) {
              lg.strokeStyle = o.rim[2]; lg.lineWidth = 2.6; lg.lineJoin = 'round';
              lg.beginPath();
              for (let x = o.rim[0]; x <= o.rim[1]; x += 3) { const y = o.fy(x) + 1; x === o.rim[0] ? lg.moveTo(x, y) : lg.lineTo(x, y); }
              lg.stroke();
            }
          }, 1, 'source-atop');
        });
        // 雾带：一条柔和的横带，加几团更浓的雾絮
        const mistBand = (y0, y1, a, seed, n) => {
          const mg = g.createLinearGradient(0, y0, 0, y1);
          mg.addColorStop(0, 'rgba(240,238,234,0)'); mg.addColorStop(0.55, `rgba(242,239,233,${a})`); mg.addColorStop(1, `rgba(242,239,233,${a * 0.5})`);
          g.fillStyle = mg; g.fillRect(0, y0, W, y1 - y0);
          blurBox(g, -200, y0 - 50, W + 400, y1 - y0 + 100, 16, (tg) => {
            const r = rng(seed);
            for (let i = 0; i < n; i++) {
              const x = r() * (W + 300) - 150, y = lerp(y0, y1, 0.45 + r() * 0.4), rx = 140 + r() * 240, ry = 10 + r() * 16;
              tg.fillStyle = `rgba(246,243,238,${a * (0.45 + r() * 0.4)})`;
              tg.beginPath(); tg.ellipse(x, y, rx, ry, 0, 0, TAU); tg.fill();
            }
          });
        };
        // 最远的一道长岭：很淡，左侧一座远峰
        range({
          x0: -40, x1: W + 40, top: 300, foot: 470, blur: 3.4, soft: 10, box: [-60, 230, W + 120, 330],
          fy: (x) => 432 - 46 * noise1(x / 300, 11) - 26 * fbm(x / 120, 12, 3) - 5 * fbm(x / 24, 13, 2) - 92 * Math.exp(-Math.abs(x - 300) / 170) - 34 * Math.exp(-Math.abs(x - 650) / 110),
          sh: '#bcc6cf', lit: '#efe6da', fog: '#e4e7e9', dark: '#9aa6b2',
          faces: [[300, 0.62, 22, 0.75, 170, 0, 31], [650, 0.55, 16, 0.6, 120, 0, 32]],
        });
        mistBand(380, 480, 0.55, 51, 7);
        // 主峰：右侧一座迎着朝阳的雪峰，左肩缓缓没入雾里
        const mainBump = (x) => Math.exp(-Math.pow(Math.abs(x - 1010) / (x < 1010 ? 250 : 205), 1.12));
        const mainY = (x) => {
          const b = mainBump(x);
          return 478 - 275 * b - 70 * Math.exp(-(((x - 770) / 115) ** 2)) - 52 * Math.exp(-(((x - 1225) / 95) ** 2))
            + (0.4 + 0.6 * (1 - b)) * 24 * fbm(x / 120, 21, 3) + 4.5 * fbm(x / 22, 26, 2);
        };
        let sumX = 1010, sumY = 1e9;
        for (let x = 940; x <= 1080; x += 1) { const y = mainY(x); if (y < sumY) { sumY = y; sumX = x; } }
        range({
          x0: 440, x1: W + 40, top: sumY, foot: 480, blur: 1.6, soft: 9, box: [400, sumY - 40, W - 340, 600 - sumY],
          fy: mainY,
          sh: '#8b9aaa', lit: '#f7e1c2', fog: '#e2e5e8', dark: '#64768a',
          shade: [[sumX - 4, 0.34, 22, 0.42, 250, -70, 33]],
          faces: [[sumX, 0.34, 24, 1, 330, 0, 33], [770, 0.5, 16, 0.45, 110, 0, 34], [1225, 0.4, 14, 0.9, 170, 0, 35]],
          ribs: [[850, 0.62, 10, 0.42, 80, 9, 36], [895, 0.58, 9, 0.5, 100, 12, 37], [940, 0.5, 8, 0.55, 80, 10, 38], [700, 0.6, 8, 0.35, 60, 8, 39]],
          rim: [sumX - 2, W + 40, 'rgba(255,246,230,1)'],
        });
        mistBand(420, 520, 0.7, 52, 9);
        // 中景：左侧两座低缓的雪岭，青灰，脚下入雾
        range({
          x0: -40, x1: 900, top: 390, foot: 560, blur: 1.4, soft: 8, box: [-60, 340, 1000, 300],
          fy: (x) => 530 - 122 * Math.exp(-Math.pow(Math.abs(x - 235) / 170, 1.2)) - 74 * Math.exp(-Math.pow(Math.abs(x - 560) / 150, 1.2))
            + 18 * fbm(x / 110, 41, 3) + 4 * fbm(x / 20, 45, 2) + 60 * smooth((x - 760) / 140),
          sh: '#8f9eab', lit: '#e8dbc8', fog: '#dde2e5', dark: '#6f7f8d',
          faces: [[235, 0.55, 18, 0.85, 140, 0, 42], [560, 0.5, 14, 0.7, 100, 0, 43]],
          ribs: [[150, 0.7, 6, 0.4, 50, 8, 44], [470, 0.65, 6, 0.35, 40, 7, 45]],
        });
        mistBand(490, 600, 0.75, 53, 10);
      });
    }
    // 近处雪岭：右侧一道山坡，左侧低岭；松林成簇，有大有小、略有歪斜（全分辨率，贴图覆盖 y 400–660）
    function ridgeTex() {
      return K.cache('ff3_x2_ridge', W, 260, 1, (g) => {
        g.translate(0, -400);
        const ridgeY = (x) => 585 - 95 * smooth((x - 760) / 480) - 30 * Math.exp(-(((x - 120) / 180) ** 2)) + 8 * fbm(x / 70, 91, 3);
        blurBox(g, -20, 400, W + 40, 260, 0.8, (tg) => {
          const rg2 = tg.createLinearGradient(0, 470, 0, 640);
          rg2.addColorStop(0, '#e9ebec'); rg2.addColorStop(1, '#cfd6dc');
          tg.fillStyle = rg2;
          tg.beginPath(); tg.moveTo(0, 660); for (let x = 0; x <= W; x += 5) tg.lineTo(x, ridgeY(x)); tg.lineTo(W, 660); tg.closePath(); tg.fill();
          // 坡面受光：右上暖
          tg.strokeStyle = 'rgba(255,232,200,0.6)'; tg.lineWidth = 2;
          tg.beginPath(); for (let x = 760; x <= W; x += 5) { const y = ridgeY(x) + 1; x === 760 ? tg.moveTo(x, y) : tg.lineTo(x, y); } tg.stroke();
          // 雪坡的起伏：几道柔和的雪褶，褶顶迎光、褶下一抹冷影
          blurBox(tg, -60, 520, W + 120, 140, 5, (fg) => {
            [[-40, 520, 612, 0.24, 61], [380, 980, 598, 0.2, 62], [820, 1320, 562, 0.17, 63]].forEach(([xa, xb, y0, a, sd]) => {
              const fy = (x) => y0 + 10 * fbm(x / 160, sd, 2) - 14 * Math.sin(Math.PI * (x - xa) / (xb - xa));
              fg.fillStyle = `rgba(132,148,170,${a})`;
              fg.beginPath(); fg.moveTo(xa, fy(xa));
              for (let x = xa; x <= xb; x += 8) fg.lineTo(x, fy(x) + 2);
              for (let x = xb; x >= xa; x -= 8) fg.lineTo(x, fy(x) + 2 + 12 * Math.sin(Math.PI * (x - xa) / (xb - xa)));
              fg.closePath(); fg.fill();
              fg.strokeStyle = `rgba(255,246,232,${a * 3})`; fg.lineWidth = 1.6;
              fg.beginPath(); for (let x = xa; x <= xb; x += 8) { x === xa ? fg.moveTo(x, fy(x)) : fg.lineTo(x, fy(x)); } fg.stroke();
            });
          });
          // 一棵水墨松：微弯的干，几片平展的松针团（云片状），团顶积雪、右侧迎着朝阳偏暖；
          // 远的淡、近的浓；整层画完再轻轻虚化，像墨在纸上微微晕开
          const pine = (lg, x, y0, h, lean, fk, seed) => {
            const r = rng(seed);
            const ink = mix('#27312f', '#c6ced4', fk), ink2 = mix('#18201f', '#bfc8ce', fk);
            const snowC = mix('#e9ecee', '#e6eaed', fk), snowW = mix('#fff1de', '#eeece8', fk);
            // 雪地上的淡影（太阳在右，影子落向左）
            lg.fillStyle = `rgba(110,124,144,${0.22 * (1 - fk)})`;
            lg.beginPath(); lg.ellipse(x - h * 0.3, y0 + 1, h * 0.4, Math.max(1.2, h * 0.035), 0, 0, TAU); lg.fill();
            // 干：微微 S 形，下粗上细
            const ph = r() * TAU;
            const tX = (u) => x + lean * h * u + h * 0.05 * Math.sin(u * 3.4 + ph) * u;
            lg.strokeStyle = mix('#3a322b', '#c6ced4', fk); lg.lineCap = 'round';
            for (let i = 0; i < 8; i++) {
              const u0 = i / 8 * 0.95, u1 = (i + 1) / 8 * 0.95;
              lg.lineWidth = Math.max(0.7, h * (0.055 - 0.04 * u0));
              lg.beginPath(); lg.moveTo(tX(u0), y0 - h * u0); lg.lineTo(tX(u1), y0 - h * u1); lg.stroke();
            }
            // 松针团：从下往上，左右错开；顶上一团最小
            // 松冠：几片相互叠压的松针团，上部一片最宽最平（平顶的老松），整体看成一团有层次的墨块
            const n = h < 22 ? 3 : 3 + Math.floor(r() * 2.5);
            for (let k = 0; k < n; k++) {
              const f = 0.5 + 0.46 * (k / (n - 1)) + (r() - 0.5) * 0.05;
              const side = k === n - 1 ? (r() - 0.5) * 0.4 : (k % 2 ? 1 : -1) * (0.35 + 0.35 * r());
              const bx = tX(Math.min(0.95, f)), by = y0 - h * Math.min(0.97, f);
              const pw = h * (0.27 + 0.1 * r()) * (k === n - 1 ? 1.15 : 1.05 - 0.25 * f), phh = h * (0.08 + 0.03 * r()) + 1;
              const cx = bx + side * pw * 0.45, cy = by;
              // 枝
              lg.lineWidth = Math.max(0.6, h * 0.018);
              lg.beginPath(); lg.moveTo(bx, by + phh * 0.6); lg.quadraticCurveTo((bx + cx) / 2, by - phh * 0.2, cx, cy + phh * 0.2); lg.stroke();
              // 团：几只扁椭圆叠成，底边一道浓墨
              lg.fillStyle = ink;
              lg.beginPath();
              for (let q = 0; q < 6; q++) {
                const u = q / 5 * 2 - 1;
                const ex = cx + u * pw * 0.66, ey = cy + Math.abs(u) * phh * 0.4 + (r() - 0.5) * phh * 0.35;
                const rx = pw * (0.28 + 0.12 * r()), ry = phh * (0.7 + 0.3 * r()) * (1 - 0.3 * Math.abs(u));
                lg.moveTo(ex + rx, ey); lg.ellipse(ex, ey, rx, ry, (r() - 0.5) * 0.15, 0, TAU);
              }
              lg.fill();
              lg.fillStyle = rgba(ink2, 0.5);
              lg.beginPath(); lg.ellipse(cx, cy + phh * 0.55, pw * 0.85, phh * 0.42, 0, 0, Math.PI); lg.fill();
              // 团顶积雪：比团略窄，右侧暖
              const sg = lg.createLinearGradient(cx - pw, 0, cx + pw, 0);
              sg.addColorStop(0, snowC); sg.addColorStop(0.6, mix(snowC, snowW, 0.5)); sg.addColorStop(1, snowW);
              lg.fillStyle = sg;
              lg.beginPath();
              for (let q = 0; q < 3; q++) {
                const u = (q / 2) * 2 - 1;
                const ex = cx + u * pw * 0.42 + pw * 0.06, ey = cy - phh * 0.62 + Math.abs(u) * phh * 0.3;
                const rx = pw * (0.3 + 0.08 * r()), ry = phh * (0.3 + 0.1 * r());
                lg.moveTo(ex + rx, ey); lg.ellipse(ex, ey, rx, ry, 0, 0, TAU);
              }
              lg.fill();
            }
          };
          const r = rng(19);
          const items = [];
          // [中心 x, 散布, 棵数]
          [[150, 60, 3], [305, 30, 2], [480, 40, 2], [640, 22, 1], [860, 55, 3], [985, 50, 4], [1095, 55, 5], [1255, 40, 3]].forEach(([cx, sp, n], ci) => {
            for (let i = 0; i < n; i++) {
              const x = cx + ((r() + r() + r() - 1.5) / 1.5) * sp;
              const dp = r();                                   // 0 = 岭线上（靠后），1 = 坡面靠前
              const y0 = ridgeY(x) + 3 + dp * 16;
              const near = clamp((x - 650) / 550), core = Math.exp(-(((x - cx) / sp) ** 2));
              const h = (17 + r() * 13) * (0.8 + near * 1.3) * (0.75 + 0.5 * core) * (0.85 + 0.3 * dp);
              items.push([x, y0, h, (r() - 0.5) * 0.08, clamp(0.45 - near * 0.3 - dp * 0.12), ci * 31 + i + 7]);
            }
          });
          blurBox(tg, -20, 380, W + 40, 290, 0.9, (lg) => {
            items.sort((p, q) => p[1] - q[1]).forEach((it) => pine(lg, ...it));
          });
          const mg = tg.createLinearGradient(0, 560, 0, 650);
          mg.addColorStop(0, 'rgba(238,238,236,0)'); mg.addColorStop(1, 'rgba(238,238,236,0.7)');
          tg.fillStyle = mg; tg.fillRect(0, 560, W, 100);
        });
      });
    }
    // 钟亭：屋檐底、横梁、两根柱、石台地面（静态）
    function hallTex() {
      return K.cache('ff3_x2_hall', W, H, 1, (g) => {
        // 屋顶底面与椽子
        let gr = g.createLinearGradient(0, 0, 0, 52);
        gr.addColorStop(0, '#2c2620'); gr.addColorStop(1, '#3d342b');
        g.fillStyle = gr; g.fillRect(-20, 0, W + 40, 52);
        for (let x = -10; x < W + 20; x += 46) {
          const lg = g.createLinearGradient(x, 0, x + 22, 0);
          lg.addColorStop(0, '#241e19'); lg.addColorStop(0.7, '#3a3027'); lg.addColorStop(1, '#5a4836');
          g.fillStyle = lg; g.fillRect(x, 0, 22, 48);
        }
        // 横梁：下沿受地面雪光反射略亮，右侧被晨光照暖
        gr = g.createLinearGradient(0, 44, 0, BEAM);
        gr.addColorStop(0, '#4a3a2c'); gr.addColorStop(0.7, '#5a4634'); gr.addColorStop(1, '#7a6048');
        g.fillStyle = gr; g.fillRect(-20, 44, W + 40, BEAM - 44);
        const wg = g.createLinearGradient(700, 0, W, 0);
        wg.addColorStop(0, 'rgba(255,214,160,0)'); wg.addColorStop(1, 'rgba(255,214,160,0.25)');
        g.fillStyle = wg; g.fillRect(700, 44, W - 700, BEAM - 44);
        g.fillStyle = 'rgba(20,14,10,0.45)'; g.fillRect(-20, BEAM, W + 40, 3);
        // 石台地面：晨光从右边低照进来，暖；靠柱处积雪
        gr = g.createLinearGradient(0, FLOOR, 0, H);
        gr.addColorStop(0, '#b9b7b2'); gr.addColorStop(1, '#8f9298');
        g.fillStyle = gr; g.fillRect(-20, FLOOR, W + 40, H - FLOOR);
        const fl = g.createLinearGradient(W, 0, 300, 0);
        fl.addColorStop(0, 'rgba(255,224,180,0.45)'); fl.addColorStop(1, 'rgba(255,224,180,0)');
        g.fillStyle = fl; g.fillRect(-20, FLOOR, W + 40, H - FLOOR);
        // 石板接缝：正面看，纵缝收向画面中央地平线上的灭点；横缝按等深度间隔，越远越密
        const HZ = 420, kf = (H - HZ) / (FLOOR - HZ);
        g.strokeStyle = 'rgba(70,72,78,0.35)'; g.lineWidth = 1;
        g.beginPath();
        for (let x = -185; x <= W + 260; x += 150) { g.moveTo(x, FLOOR); g.lineTo(640 + (x - 640) * kf, H); }
        for (let n = 1; n <= 3; n++) { const y = HZ + 1 / (1 / (FLOOR - HZ) - n * 0.00033); g.moveTo(-20, y); g.lineTo(W + 20, y); }
        g.stroke();
        g.fillStyle = 'rgba(255,246,232,0.7)'; g.fillRect(-20, FLOOR - 1, W + 40, 2);
        // 台沿外侧薄雪
        blurInto(g, W, H, 1.2, (tg) => {
          tg.fillStyle = 'rgba(246,246,244,0.95)';
          tg.beginPath(); tg.moveTo(-20, FLOOR + 2);
          for (let x = -20; x <= 250; x += 10) tg.lineTo(x, FLOOR + 2 + 14 * Math.pow(1 - (x + 20) / 270, 1.5) * (0.8 + 0.2 * noise1(x / 20, 3)));
          tg.lineTo(250, FLOOR + 2); tg.closePath(); tg.fill();
          tg.beginPath(); tg.moveTo(W + 20, FLOOR + 2);
          for (let x = W + 20; x >= 1020; x -= 10) tg.lineTo(x, FLOOR + 2 + 12 * Math.pow((x - 1020) / 280, 1.5) * (0.8 + 0.2 * noise1(x / 20, 5)));
          tg.lineTo(1020, FLOOR + 2); tg.closePath(); tg.fill();
        });
        // 低斜的朝阳在右侧略靠后：柱影又长又斜，从柱脚向左、略向镜头一侧铺过整片石板；
        // 离柱脚越远越宽、越虚、越淡（半影）
        blurInto(g, W, H, 1.6, (tg) => {
          [[1218, 64], [76, 64]].forEach(([px, pw]) => {
            const steps = 24, x1 = px - 1100;
            const top = [], bot = [];
            for (let i = 0; i <= steps; i++) {
              const x = lerp(px - 4, x1, i / steps), d = px - x;
              const yc = FLOOR + 3 + 0.075 * d, th = pw * 0.2 + 0.018 * d;
              top.push([x, yc - th * 0.35]); bot.push([x, yc + th * 0.65]);
            }
            const gr2 = tg.createLinearGradient(px, 0, x1, 0);
            gr2.addColorStop(0, 'rgba(62,64,84,0.42)'); gr2.addColorStop(0.5, 'rgba(66,70,90,0.3)'); gr2.addColorStop(1, 'rgba(70,74,94,0.12)');
            tg.fillStyle = gr2;
            tg.beginPath(); tg.moveTo(top[0][0], top[0][1]); top.forEach(([x, y]) => tg.lineTo(x, y));
            for (let i = bot.length - 1; i >= 0; i--) tg.lineTo(bot[i][0], bot[i][1]);
            tg.closePath(); tg.fill();
          });
        });
        // 影子之间被朝阳照暖的石板
        const sunF = g.createLinearGradient(160, 0, 760, 0);
        sunF.addColorStop(0, 'rgba(255,214,160,0)'); sunF.addColorStop(1, 'rgba(255,214,160,0.14)');
        g.fillStyle = sunF; g.fillRect(160, FLOOR + 1, W - 160, H - FLOOR);
        // 柱：褪色朱漆木柱，右侧受晨光
        [[44, 108], [1186, 1250]].forEach(([x0, x1], i) => {
          const pg = g.createLinearGradient(x0, 0, x1, 0);
          pg.addColorStop(0, '#3a2219'); pg.addColorStop(0.55, '#5a3324'); pg.addColorStop(0.85, '#7a4630'); pg.addColorStop(1, i ? '#c08a5a' : '#b07a50');
          g.fillStyle = pg; g.fillRect(x0, BEAM, x1 - x0, FLOOR - BEAM + 4);
          // 木纹与剥落
          const r = rng(300 + i);
          for (let k = 0; k < 10; k++) {
            const x = x0 + 4 + r() * (x1 - x0 - 8);
            g.strokeStyle = `rgba(30,16,10,${0.15 + r() * 0.15})`; g.lineWidth = 0.8;
            g.beginPath(); g.moveTo(x, BEAM + r() * 200); g.lineTo(x + (r() - 0.5) * 2, BEAM + 200 + r() * 360); g.stroke();
          }
          // 柱础
          const bg = g.createLinearGradient(x0 - 12, 0, x1 + 12, 0);
          bg.addColorStop(0, '#6c6e72'); bg.addColorStop(0.7, '#9a9a98'); bg.addColorStop(1, '#d8d0c4');
          g.fillStyle = bg;
          g.beginPath(); g.moveTo(x0 - 12, FLOOR + 6); g.lineTo(x0 - 6, FLOOR - 18); g.lineTo(x1 + 6, FLOOR - 18); g.lineTo(x1 + 12, FLOOR + 6); g.closePath(); g.fill();
          g.fillStyle = 'rgba(250,250,248,0.9)';
          g.beginPath(); g.ellipse((x0 + x1) / 2, FLOOR - 18, (x1 - x0) / 2 + 8, 3, 0, Math.PI, 0); g.fill();
        });
      });
    }
    // 青铜钟（静态贴图：贴图 x 150 对应钟心，y 与世界坐标相差 60）
    function bellTex() {
      return K.cache('ff3_x2_bell', 300, 400, 1, (g) => {
        g.translate(150 - BX, -60);
        const body = new Path2D();
        body.moveTo(BX - bw(BLIP), BLIP);
        for (let y = BLIP; y >= BTOP; y -= 1) body.lineTo(BX - bw(y), y);
        for (let y = BTOP; y <= BLIP; y += 1) body.lineTo(BX + bw(y), y);
        body.closePath();
        // 圆柱明暗：背光一侧深铜色，右侧迎晨光一道暖金高光，最边缘略暗再一线反光
        let gr = g.createLinearGradient(BX - 108, 0, BX + 108, 0);
        gr.addColorStop(0, '#3a3a34'); gr.addColorStop(0.06, '#221f1a'); gr.addColorStop(0.3, '#302d25'); gr.addColorStop(0.52, '#433e31'); gr.addColorStop(0.68, '#5a4e37');
        gr.addColorStop(0.79, '#94754a'); gr.addColorStop(0.865, '#e2c48c'); gr.addColorStop(0.89, '#f3d9b2'); gr.addColorStop(0.925, '#a8875a'); gr.addColorStop(0.975, '#46392a'); gr.addColorStop(1, '#6e5a40');
        g.fillStyle = gr; g.fill(body);
        g.save(); g.clip(body);
        // 顶部受天光略亮，钟口附近略暗
        const vg = g.createLinearGradient(0, BTOP, 0, BLIP);
        vg.addColorStop(0, 'rgba(230,226,214,0.16)'); vg.addColorStop(0.2, 'rgba(230,226,214,0)'); vg.addColorStop(1, 'rgba(10,10,8,0.2)');
        g.fillStyle = vg; g.fillRect(BX - 120, BTOP, 240, BLIP - BTOP);
        // 迎光一侧的暖色光泽（竖向一道柔光）
        const sh0 = g.createLinearGradient(BX + 52, 0, BX + 104, 0);
        sh0.addColorStop(0, 'rgba(243,217,178,0)'); sh0.addColorStop(0.55, 'rgba(250,226,184,0.32)'); sh0.addColorStop(1, 'rgba(243,217,178,0)');
        g.fillStyle = sh0; g.fillRect(BX + 52, BTOP, 52, BLIP - BTOP);
        // 左缘：地面雪光的一线冷反光
        const sh1 = g.createLinearGradient(BX - 108, 0, BX - 90, 0);
        sh1.addColorStop(0, 'rgba(180,196,210,0.28)'); sh1.addColorStop(1, 'rgba(180,196,210,0)');
        g.fillStyle = sh1; g.fillRect(BX - 110, BTOP, 22, BLIP - BTOP);
        // 铜绿流痕（淡青灰）
        const r = rng(808);
        for (let i = 0; i < 46; i++) {
          const x = BX - 96 + r() * 180, y0 = BSH + r() * 220, len = 16 + r() * 70;
          g.strokeStyle = `rgba(${r() < 0.6 ? '104,134,118' : '28,30,26'},${0.08 + r() * 0.1})`; g.lineWidth = 1 + r() * 2.2;
          g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (r() - 0.5) * 2, y0 + len * 0.5, x + (r() - 0.5) * 3, y0 + len); g.stroke();
        }
        // 凸起的横带：上缘受光、下缘投影（右侧更亮）
        const hband = (y, h2w) => {
          const lg = g.createLinearGradient(BX - 110, 0, BX + 110, 0);
          lg.addColorStop(0, 'rgba(200,180,130,0.05)'); lg.addColorStop(0.85, 'rgba(240,214,160,0.55)'); lg.addColorStop(1, 'rgba(200,180,130,0.1)');
          g.fillStyle = 'rgba(12,12,10,0.4)'; g.fillRect(BX - 120, y + 1, 240, h2w);
          g.fillStyle = lg; g.fillRect(BX - 120, y - 1, 240, 1.6);
          g.fillStyle = 'rgba(60,56,44,0.35)'; g.fillRect(BX - 120, y + 0.6, 240, h2w * 0.5);
        };
        hband(BSH + 10, 5); hband(268, 6); hband(280, 4); hband(BLIP - 34, 7);
        // 竖带：把上下两区分成格（圆柱投影）
        const vx = (phi, y) => BX + Math.sin(phi) * bw(y) * 0.97;
        [-1.05, -0.35, 0.35, 1.05].forEach((phi) => {
          for (const [y0, y1] of [[BSH + 16, 266], [286, BLIP - 36]]) {
            const x0 = vx(phi, y0), x1 = vx(phi, y1), sc = Math.cos(phi);
            g.fillStyle = 'rgba(12,12,10,0.35)';
            g.beginPath(); g.moveTo(x0 + 1, y0); g.lineTo(x1 + 1, y1); g.lineTo(x1 + 1 + 3 * sc, y1); g.lineTo(x0 + 1 + 3 * sc, y0); g.closePath(); g.fill();
            g.fillStyle = phi > 0 ? 'rgba(240,214,160,0.4)' : 'rgba(200,190,160,0.12)';
            g.beginPath(); g.moveTo(x0 - 0.6, y0); g.lineTo(x1 - 0.6, y1); g.lineTo(x1 + 0.6, y1); g.lineTo(x0 + 0.6, y0); g.closePath(); g.fill();
          }
        });
        // 乳钉：上区三个格里各 3×3（右上受光）
        [[-0.7, 0], [0, 1], [0.7, 2]].forEach(([pc]) => {
          for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
            const phi = pc + (col - 1) * 0.17, y = BSH + 38 + row * 26;
            const x = vx(phi, y), sc = Math.cos(phi);
            g.fillStyle = 'rgba(10,10,8,0.5)'; g.beginPath(); g.ellipse(x + 1.4 * sc, y + 2, 4.6 * sc, 4, 0, 0, TAU); g.fill();
            const ng = g.createRadialGradient(x - 1 + phi * 2, y - 1.5, 0.5, x, y, 4.6);
            ng.addColorStop(0, phi > 0.3 ? '#f0d49a' : '#8a8064'); ng.addColorStop(1, phi > 0.3 ? '#6e5a3a' : '#3a372e');
            g.fillStyle = ng; g.beginPath(); g.ellipse(x, y, 4 * sc, 4, 0, 0, TAU); g.fill();
          }
        });
        // 撞座：右侧（撞木一侧）的莲瓣圆纹，只露出大半
        const px = vx(1.28, SY), sc2 = Math.cos(1.28);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          g.fillStyle = 'rgba(16,14,10,0.35)';
          g.beginPath(); g.ellipse(px + Math.cos(a) * 9 * sc2 + 1, SY + Math.sin(a) * 9 + 1, 5 * sc2, 4.5, a, 0, TAU); g.fill();
          g.fillStyle = 'rgba(236,206,150,0.45)';
          g.beginPath(); g.ellipse(px + Math.cos(a) * 9 * sc2, SY + Math.sin(a) * 9, 4 * sc2, 3.6, a, 0, TAU); g.fill();
        }
        g.fillStyle = 'rgba(240,214,160,0.55)'; g.beginPath(); g.ellipse(px, SY, 4 * sc2, 4, 0, 0, TAU); g.fill();
        // 铜锈：斑驳的青绿锈斑与暗色蚀点，下半与背光一侧多
        {
          const rp = rng(812);
          for (let i = 0; i < 240; i++) {
            const y = BSH + Math.pow(rp(), 0.7) * (BLIP - BSH);
            const side = rp() * 2 - 1, x = BX + side * bw(y) * 0.95;
            const rr = 3 + rp() * 12;
            const a = (0.04 + rp() * 0.09) * (1.1 - 0.5 * side) * (0.6 + 0.6 * (y - BSH) / (BLIP - BSH));
            const pg = g.createRadialGradient(x, y, 0, x, y, rr);
            const col = rp() < 0.7 ? '96,140,120' : '60,92,84';
            pg.addColorStop(0, `rgba(${col},${a})`); pg.addColorStop(1, `rgba(${col},0)`);
            g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, rr * Math.cos(side * 1.2) + 1, rr, 0, 0, TAU); g.fill();
          }
          for (let i = 0; i < 140; i++) {
            const y = BSH + rp() * (BLIP - BSH), x = BX + (rp() * 2 - 1) * bw(y) * 0.92;
            g.fillStyle = `rgba(20,18,14,${0.12 + rp() * 0.18})`;
            g.beginPath(); g.ellipse(x, y, 0.6 + rp() * 1.2, 0.5 + rp() * 0.9, 0, 0, TAU); g.fill();
          }
        }
        // 迎晨光的高光：一道顺着钟身轮廓的暖色亮带（钟口外翻处跟着张开），柔边
        blurBox(g, BX - 20, BTOP - 10, 150, BLIP - BTOP + 30, 1.8, (lg) => {
          const line = (k, w, col) => {
            lg.strokeStyle = col; lg.lineWidth = w; lg.lineJoin = 'round'; lg.lineCap = 'round';
            lg.beginPath();
            for (let y = BTOP + 18; y <= BLIP - 1; y += 2) {
              const x = BX + bw(y) * k;
              y === BTOP + 18 ? lg.moveTo(x, y) : lg.lineTo(x, y);
            }
            lg.stroke();
          };
          line(0.8, 10, 'rgba(250,214,150,0.4)');
          line(0.81, 3.4, 'rgba(255,240,206,0.95)');
          line(0.815, 1.4, 'rgba(255,250,232,1)');
        }, 1, 'screen');
        g.restore();
        // 钟口外翻处一点闪光
        {
          const gx = BX + bw(BLIP - 5) * 0.82, gy = BLIP - 5;
          A.glow(g, gx, gy, 12, '#fff2d0', 0.55);
          g.fillStyle = 'rgba(255,248,226,0.9)';
          g.beginPath(); g.ellipse(gx, gy, 3.2, 1.6, 0, 0, TAU); g.fill();
        }
        // 钟口：口沿厚边，口内暗
        g.fillStyle = '#0e0f0d';
        g.beginPath(); g.ellipse(BX, BLIP, bw(BLIP) - 2, 8, 0, 0, Math.PI); g.fill();
        gr = g.createLinearGradient(BX - 110, 0, BX + 110, 0);
        gr.addColorStop(0, '#2a2822'); gr.addColorStop(0.86, '#d8b878'); gr.addColorStop(1, '#6a5232');
        g.strokeStyle = gr; g.lineWidth = 3.2;
        g.beginPath(); g.ellipse(BX, BLIP, bw(BLIP) - 1, 8, 0, 0.02, Math.PI - 0.02); g.stroke();
        // 蒲牢钮：一道粗拱，表面一串鳞突，两端是伏在钟顶的兽首
        g.lineCap = 'round';
        const arch = (w) => { g.beginPath(); g.moveTo(BX - 30, BTOP + 6); g.bezierCurveTo(BX - 36, BTOP - 30, BX + 36, BTOP - 30, BX + 30, BTOP + 6); g.lineWidth = w; g.stroke(); };
        g.strokeStyle = '#24231e'; arch(15);
        g.strokeStyle = '#3e3a2e'; arch(9);
        g.strokeStyle = 'rgba(226,196,138,0.55)'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(BX + 2, BTOP - 21); g.bezierCurveTo(BX + 18, BTOP - 21, BX + 30, BTOP - 12, BX + 31, BTOP + 2); g.stroke();
        for (let k = 1; k < 10; k++) {
          const u = k / 10, mt = 1 - u;
          const x = mt * mt * mt * (BX - 30) + 3 * mt * mt * u * (BX - 36) + 3 * mt * u * u * (BX + 36) + u * u * u * (BX + 30);
          const y = mt * mt * mt * (BTOP + 6) + 3 * mt * mt * u * (BTOP - 30) + 3 * mt * u * u * (BTOP - 30) + u * u * u * (BTOP + 6);
          g.fillStyle = u > 0.5 ? 'rgba(200,170,110,0.5)' : 'rgba(110,100,80,0.45)';
          g.beginPath(); g.arc(x, y - 4, 2, 0, TAU); g.fill();
        }
        [[-1, '#2a2822'], [1, '#6a5a3c']].forEach(([sd, col]) => {
          g.fillStyle = col;
          g.beginPath(); g.ellipse(BX + sd * 33, BTOP + 4, 11, 7, sd * 0.3, 0, TAU); g.fill();
        });
      });
    }
    // 松枝贴图（剩余的薄雪画在贴图里；会滑落的雪团另画）。局部坐标：根部 (0,0)，向右伸
    const TUFTS = [[40, 0, 1.0], [84, 10, 1.25], [126, 4, 1.1], [160, 22, 1.45], [206, 30, 1.35], [246, 46, 1.2], [282, 60, 1.05], [312, 74, 0.9], [140, -26, 1.1], [190, 2, 1.0], [232, 80, 0.95], [100, 38, 0.95], [60, 28, 0.85], [270, 30, 0.85]];
    const CLUMPS = [[84, 10, 26, 11], [160, 22, 32, 13], [206, 30, 28, 12], [246, 46, 26, 10], [140, -26, 22, 9], [282, 60, 22, 9]];
    function branchTex() {
      return K.cache('ff3_x2_branch', 400, 220, 1, (g) => {
        g.translate(30, 100);
        blurInto(g, 400, 220, 0.45, (tg) => {
          tg.lineCap = 'round';
          const limb = (x0, y0, cx, cy, x1, y1, w0, w1) => {
            for (let i = 0; i < 14; i++) {
              const q = (u) => [(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1];
              const a2 = q(i / 14), b2 = q((i + 1) / 14);
              tg.strokeStyle = '#3a3029'; tg.lineWidth = lerp(w0, w1, i / 14);
              tg.beginPath(); tg.moveTo(a2[0], a2[1]); tg.lineTo(b2[0], b2[1]); tg.stroke();
              tg.strokeStyle = 'rgba(190,150,110,0.35)'; tg.lineWidth = Math.max(0.6, lerp(w0, w1, i / 14) * 0.25);
              tg.beginPath(); tg.moveTo(a2[0], a2[1] - lerp(w0, w1, i / 14) * 0.3); tg.lineTo(b2[0], b2[1] - lerp(w0, w1, i / 14) * 0.3); tg.stroke();
            }
          };
          limb(-40, -4, 150, -6, 316, 76, 13, 3);
          limb(40, 2, 52, 16, 60, 28, 3, 1.4);
          limb(250, 46, 262, 36, 270, 30, 2.6, 1.2);
          limb(120, 6, 140, -10, 150, -22, 4, 2);
          limb(190, 22, 215, 50, 236, 74, 3.5, 1.6);
          limb(70, 4, 86, 22, 96, 34, 3.5, 1.6);
          limb(170, 18, 188, 8, 200, 4, 3, 1.4);
          // 针叶：扇形放射的细笔，上半密、下半疏，两层深浅
          const r = rng(626);
          TUFTS.forEach(([x, y, s2]) => {
            for (let pass = 0; pass < 2; pass++) {
              for (let k = 0; k < 54; k++) {
                const up = k < 42;
                const a2 = up ? -Math.PI - 0.15 + (k / 41) * (Math.PI + 0.3) + (r() - 0.5) * 0.06 : 0.35 + r() * 2.4;
                const len = (up ? 17 + r() * 10 : 10 + r() * 8) * s2 * (pass ? 0.8 : 1);
                tg.strokeStyle = pass ? 'rgba(58,80,62,0.8)' : 'rgba(26,38,32,0.9)'; tg.lineWidth = pass ? 0.7 : 0.95;
                tg.beginPath(); tg.moveTo(x, y); tg.quadraticCurveTo(x + Math.cos(a2) * len * 0.5, y + Math.sin(a2) * len * 0.42 - 1, x + Math.cos(a2) * len, y + Math.sin(a2) * len * 0.78); tg.stroke();
              }
            }
          });
          // 薄雪：每簇针叶顶上不规则的一层（几团叠起），右上暖、左下冷；针尖从雪边露出
          TUFTS.forEach(([x, y, s2], k) => {
            const w = 17 * s2;
            const sg = tg.createLinearGradient(x - w, y - 18 * s2, x + w, y);
            sg.addColorStop(0, '#c2cbd4'); sg.addColorStop(0.55, '#f2f2ef'); sg.addColorStop(1, '#fdf0dc');
            tg.fillStyle = sg;
            tg.beginPath();
            for (let q = 0; q < 4; q++) {
              const u = (q + 0.5) / 4 * 2 - 1;
              const bx = x + u * w * 0.75, by = y - 11 * s2 + Math.abs(u) * 5 * s2;
              const rx = w * (0.32 + 0.12 * r()), ry = (4 + 2.5 * r()) * s2;
              tg.moveTo(bx + rx, by); tg.ellipse(bx, by, rx, ry, (r() - 0.5) * 0.3, 0, TAU);
            }
            tg.fill();
            tg.fillStyle = 'rgba(120,138,156,0.28)';
            tg.beginPath(); tg.ellipse(x - w * 0.15, y - 7 * s2, w * 0.8, 2.2 * s2, 0.05, 0, Math.PI); tg.fill();
          });
          tg.strokeStyle = 'rgba(246,244,240,0.9)'; tg.lineWidth = 2.6;
          tg.beginPath(); tg.moveTo(-30, -11); tg.quadraticCurveTo(150, -14, 300, 62); tg.stroke();
        });
      });
    }
    // 低斜的朝阳从右侧穿过柱间射进亭子：几道暖色光束自右向左略向下，右柱在光里留下一道斜的暗缝（缓存，带模糊）
    const SUN_DIR = [-1, 0.2];
    function beamTex() {
      return K.cache('ff3_x2_shafts', W, H, 0.5, (g) => {
        // 整体的晨光暖色：右侧更暖，到钟所在的左半边已很淡（不把暗铜色提灰）
        const wr = g.createRadialGradient(1420, 380, 0, 1420, 380, 1050);
        wr.addColorStop(0, 'rgba(255,200,136,0.26)'); wr.addColorStop(0.45, 'rgba(255,206,150,0.1)'); wr.addColorStop(0.85, 'rgba(255,210,156,0)');
        g.fillStyle = wr; g.fillRect(0, 0, W, H);
        blurInto(g, W, H, 9, (tg) => {
          // 光束：沿 SUN_DIR 的平行带，[右端起点 y, 宽, 亮度]
          [[140, 60, 0.4], [236, 34, 0.3], [310, 84, 0.42], [450, 56, 0.32], [548, 36, 0.22]].forEach(([y0, wd, a]) => {
            const L = 1100, ex = W + 40 + SUN_DIR[0] * L, ey = y0 + SUN_DIR[1] * L;
            const gr = tg.createLinearGradient(W + 40, y0, ex, ey);
            gr.addColorStop(0, `rgba(255,212,150,${a})`); gr.addColorStop(0.55, `rgba(255,218,160,${a * 0.75})`); gr.addColorStop(1, 'rgba(255,218,160,0)');
            tg.fillStyle = gr;
            tg.beginPath(); tg.moveTo(W + 40, y0 - wd / 2); tg.lineTo(ex, ey - wd * 0.8); tg.lineTo(ex, ey + wd * 0.8); tg.lineTo(W + 40, y0 + wd / 2); tg.closePath(); tg.fill();
          });
          // 光束是从柱与柱、柱与檐之间漏进来的，柱身本身不被光束盖亮
          tg.globalCompositeOperation = 'destination-out';
          tg.fillStyle = 'rgba(0,0,0,0.9)';
          tg.fillRect(1186, 80, 64, H - 80);
        });
      });
    }
    // 撞钟后从檐口滑落的一幕细雪粉（贴图：竖向的细条纹，上下两端渐隐）
    function curtainTex() {
      return K.cache('ff3_x2_curtain', W, 200, 0.5, (g) => {
        blurInto(g, W, 200, 3, (tg) => {
          const r = rng(424);
          for (let i = 0; i < 180; i++) {
            const x = r() * W, w = 2 + r() * 9, y0 = r() * 40, len = 60 + r() * 140, a = 0.12 + r() * 0.3;
            const gr = tg.createLinearGradient(0, y0, 0, y0 + len);
            gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,253,${a})`); gr.addColorStop(1, 'rgba(255,255,253,0)');
            tg.fillStyle = gr; tg.fillRect(x, y0, w, len);
          }
          // 两端（柱外）淡一些
          tg.globalCompositeOperation = 'destination-in';
          const mk = tg.createLinearGradient(0, 0, W, 0);
          mk.addColorStop(0, 'rgba(0,0,0,0.35)'); mk.addColorStop(0.12, 'rgba(0,0,0,1)'); mk.addColorStop(0.88, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,0.35)');
          tg.fillStyle = mk; tg.fillRect(0, 0, W, 200);
        });
      });
    }
    // 远处松林与近岭之间的一层薄雾（可横向平铺，缓存）
    function mistTex() {
      return K.cache('ff3_x2_mist', W, 140, 0.5, (g) => {
        g.translate(0, -460);
        blurInto(g, W, 140, 14, (tg) => {
          const r = rng(77);
          for (let i = 0; i < 14; i++) {
            const x = (i + r() * 0.7) / 14 * W, y = 520 + r() * 50, rx = 130 + r() * 200, ry = 12 + r() * 14;
            tg.fillStyle = `rgba(246,242,236,${0.28 + r() * 0.25})`;
            for (const o of [-W, 0, W]) { tg.beginPath(); tg.ellipse(x + o, y, rx, ry, 0, 0, TAU); tg.fill(); }
          }
        });
      });
    }
    // 一团雪：几个椭圆叠成的蓬松雪团（右上受暖光）
    function snowClump(g, x, y, w, h, a) {
      g.globalAlpha = a;
      const gr = g.createLinearGradient(x - w, y - h, x + w, y + h);
      gr.addColorStop(0, '#d0d8de'); gr.addColorStop(0.5, '#f4f4f1'); gr.addColorStop(1, '#fdf0de');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, w, h, 0.1, 0, TAU);
      g.ellipse(x - w * 0.45, y + h * 0.25, w * 0.55, h * 0.75, 0, 0, TAU);
      g.ellipse(x + w * 0.4, y - h * 0.2, w * 0.5, h * 0.8, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(150,165,180,0.35)';
      g.beginPath(); g.ellipse(x - w * 0.1, y + h * 0.6, w * 0.8, h * 0.35, 0.1, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }

    XYT.registerShot('x2_bell', {
      name: '寺钟雪晓', zone: 'bottom', night: false, text: '#2c3540', shadow: 'rgba(246,244,238,0.9)', accent: '#c9a35a', bloom: 0.26,
      draw(g, c) {
        const t = c.lt;
        // 两次撞钟落在强拍上
        const downs = beatsIn(c, 2.2, c.dur - 0.5).filter((b) => b.down).map((b) => b.t);
        const D1 = downs[0] != null ? downs[0] : 3.333, D2 = downs[1] != null ? downs[1] : 6.677;
        const TH1 = 0.30, TH2 = 0.15;
        const tau = (th) => Math.acos(clamp(TH_HIT / th, -1, 1)) / OMEGA;   // 从放手到撞上的时间
        const R1 = D1 - tau(TH1), R2 = D2 - tau(TH2);
        const P1 = 1.6, P2 = Math.max(D1 + 1.6, R2 - 1.0);
        // 撞后：撞木以恢复系数 E_REST 弹回，自由摆到最高点（此刻速度为零）；
        // 僧人在它到顶前收紧拉绳，之后由绳子带着阻尼回到静止
        const E_REST = 0.4;
        const kick = (th0) => {
          const A = E_REST * th0 * Math.sin(OMEGA * tau(th0));               // 弹回角速度 / OMEGA
          return { A, uc: (Math.PI - Math.atan(A / -TH_HIT)) / OMEGA, top: Math.hypot(TH_HIT, A) };
        };
        const K1 = kick(TH1), K2 = kick(TH2);
        const WB = 3.6, ZB = 0.85, WD = WB * Math.sqrt(1 - ZB * ZB);
        const afterHit = (u, k) => {
          if (u < k.uc) return TH_HIT * Math.cos(OMEGA * u) + k.A * Math.sin(OMEGA * u);
          const s = u - k.uc;
          return k.top * Math.exp(-ZB * WB * s) * (Math.cos(WD * s) + (ZB * WB / WD) * Math.sin(WD * s));
        };
        // 撞木摆角：拉 → 放（单摆）→ 撞 → 弹回、被绳接住 → 再拉（从当时的位置平滑接上）→ 放 → 撞 → 弹回、接住
        let th;
        if (t < P1) th = 0;
        else if (t < R1) th = TH1 * smooth((t - P1) / (R1 - P1));
        else if (t < D1) th = TH1 * Math.cos(OMEGA * (t - R1));
        else if (t < P2) th = afterHit(t - D1, K1);
        else if (t < R2) th = lerp(afterHit(t - D1, K1), TH2, smooth((t - P2) / (R2 - P2)));
        else if (t < D2) th = TH2 * Math.cos(OMEGA * (t - R2));
        else th = afterHit(t - D2, K2);
        // 拉绳张紧程度（1 = 绷直）：拉之前先收紧；放手后在重力下垂落（带一点回摆）；
        // 撞木弹回到顶前 0.3 s 起被重新拉紧，并一直保持到下一次放手
        const C1 = D1 + K1.uc - 0.3, C2 = D2 + K2.uc - 0.3;
        const drop = (u) => 1 - springStep(u, 0.95, 0.45);
        let tense;
        if (t < R1) tense = smooth((t - (P1 - 0.3)) / 0.3);
        else if (t < R2) { const s0 = drop(t - R1); tense = s0 + (1 - s0) * smooth((t - C1) / 0.3); }
        else { const s0 = drop(t - R2); tense = s0 + (1 - s0) * smooth((t - C2) / 0.3); }
        const sdx = LP * Math.sin(th), sdy = -LP * (1 - Math.cos(th));
        // 钟的振动与极轻的摆动
        const hit = (D, A) => (t >= D ? A * Math.sin(TAU * 11 * (t - D)) * Math.exp(-(t - D) / 0.3) : 0);
        const vib = hit(D1, 1.5) + hit(D2, 0.8);
        const swayB = (t >= D1 ? 0.0035 * Math.sin(TAU * 0.55 * (t - D1)) * Math.exp(-(t - D1) / 2.2) : 0) + (t >= D2 ? 0.0018 * Math.sin(TAU * 0.55 * (t - D2)) * Math.exp(-(t - D2) / 2.2) : 0);
        // 镜头：整镜 1.00→1.04
        const z = 1 + 0.04 * smooth(clamp((t + 1) / (c.dur + 1)));
        g.save();
        g.translate(560, 360); g.scale(z, z); g.translate(-560, -360);
        g.drawImage(skyTex(), 0, 0, W, 660);
        // 远山脚与近处雪岭之间一层薄雾，极慢地向左飘（无风，只是雾在走）
        {
          const off = ((t * 3) % W + W) % W;
          g.globalAlpha = 0.85;
          g.drawImage(mistTex(), -off, 460, W, 140);
          g.drawImage(mistTex(), W - off, 460, W, 140);
          g.globalAlpha = 1;
        }
        g.drawImage(ridgeTex(), 0, 400, W, 260);
        // 晨光里的微尘与冰晶（拍点上轻闪）
        const pulse = softBeat(c, 0.5);
        // 松枝：积雪滑落后向上回弹，阻尼振荡
        const rel = CLUMPS.map((cl, i) => {
          const wx = BR.x + cl[0], wy = BR.y + cl[1];
          const dist = Math.hypot(wx - RING_C[0], wy - RING_C[1]);
          return D1 + Math.max(0, (dist - 130) / 260) + 0.05 + h2(i, 9) * 0.12;
        });
        const liftAt = (tt) => {
          let l = 0;
          rel.forEach((tr) => { l += (8 / CLUMPS.length) * springStep(tt - tr, 2.3, 0.2); });
          return l + 2 * springStep(tt - (D2 + 0.9), 2.3, 0.2) - 2 * springStep(tt - (D2 + 1.25), 2.3, 0.2);
        };
        const bAng = -liftAt(t) / 300;
        const brPos = (lx, ly, ang) => [BR.x + lx * Math.cos(ang) - ly * Math.sin(ang), BR.y + lx * Math.sin(ang) + ly * Math.cos(ang)];
        g.save();
        g.translate(BR.x, BR.y); g.rotate(bAng);
        g.drawImage(branchTex(), -30, -100, 400, 220);
        g.restore();
        // 雪团：未落时贴在枝上；落下时先整团下坠，再碎成雪粉，雪粉受空气阻力慢慢飘落
        CLUMPS.forEach((cl, i) => {
          const tr = rel[i];
          const [lx0, ly0, w, h] = cl;
          if (t < tr) {
            const [x, y] = brPos(lx0, ly0 - 16 - h * 0.45, bAng);
            snowClump(g, x, y, w * 0.6, h * 0.6, 1);
            return;
          }
          const angR = -liftAt(tr) / 300;
          const [x0, y0] = brPos(lx0, ly0 - 16 - h * 0.45, angR);
          const u = t - tr;
          const tb = 0.28;                          // 整团下坠约 0.28 s 后开始碎裂
          const ub = Math.min(u, tb);
          const yc = y0 + 0.5 * G_PX * ub * ub + (u > tb ? (G_PX * tb * 0.45 + 30) * (u - tb) : 0);
          const xc = x0 + 5 * u;
          const core = 1 - smooth((u - tb * 0.8) / 0.3);
          if (core > 0.01) snowClump(g, xc, yc, w * 0.6 * (0.6 + 0.4 * core), h * 0.6 * (0.75 + 0.25 * core), core);
          if (u > tb * 0.8) {
            const v = u - tb * 0.8;
            const yb0 = y0 + 0.5 * G_PX * (tb * 0.8) ** 2;
            // 碎开的雪雾：一团柔白，扩散变淡
            const pr = 10 + 46 * (1 - Math.exp(-v / 0.5));
            const pa = 0.42 * smooth(v / 0.12) * (1 - smooth((v - 0.3) / 1.5));
            if (pa > 0.01) {
              const py = yb0 + 70 * (1 - Math.exp(-v / 0.4)) + 30 * v;
              const pg = g.createRadialGradient(xc, py, 0, xc, py, pr);
              pg.addColorStop(0, `rgba(255,255,252,${pa})`); pg.addColorStop(1, 'rgba(255,255,252,0)');
              g.fillStyle = pg; g.beginPath(); g.ellipse(xc, py, pr * 1.2, pr, 0, 0, TAU); g.fill();
            }
            g.fillStyle = '#ffffff';
            for (let q = 0; q < 20; q++) {
              const a = h2(i * 40 + q, 1) * TAU, sp = 30 + h2(i * 40 + q, 2) * 70;
              const spread = sp * (1 - Math.exp(-v / 0.3)) * 0.32;
              const fall = (G_PX * tb * 0.8) * 0.3 * (1 - Math.exp(-v / 0.3)) + (50 + 45 * h2(i * 40 + q, 3)) * v;
              const x = xc + Math.cos(a) * spread * 1.4 + 6 * Math.sin(v * 2 + q);
              const y = yb0 + Math.sin(a) * spread + fall;
              const al = smooth(v / 0.15) * (1 - smooth((v - 0.9) / 1.5)) * (0.6 + 0.4 * h2(i * 40 + q, 4));
              if (al < 0.01) continue;
              g.globalAlpha = al;
              const sz = 1.1 + h2(i * 40 + q, 5) * 1.7;
              g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
            }
            g.globalAlpha = 1;
          }
        });
        // 第二次轻撞：余雪抖落少许雪粉
        if (t > D2 + 0.8) {
          const v0 = t - (D2 + 0.8);
          g.fillStyle = '#f6f4f0';
          for (let q = 0; q < 40; q++) {
            const v = v0 - h2(q, 21) * 0.4;
            if (v < 0) continue;
            const lx = 90 + h2(q, 22) * 240, ly = 10 + (lx - 90) * 0.15;
            const [x0, y0] = brPos(lx, ly - 8, bAng);
            const x = x0 + 8 * Math.sin(v * 1.7 + q) + (h2(q, 23) - 0.5) * 20 * v;
            const y = y0 + 50 * v + 30 * v * v * 0.3;
            const al = smooth(v / 0.3) * (1 - smooth((v - 0.8) / 1.2)) * 0.6;
            if (al < 0.01) continue;
            g.globalAlpha = al; g.beginPath(); g.arc(x, y, 1 + h2(q, 24), 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        }
        // 声波环：从钟体荡开，暖金色、3–4 px 宽，向外扩散变淡（先于钟亭画，所以被柱、梁、钟挡住）
        g.save();
        const rings = (D, n, a0) => {
          for (let k = 0; k < n; k++) {
            const u = t - D - k * 0.24;
            if (u <= 0 || u > 1.9) continue;
            const rr = 118 + 270 * u;
            const a = a0 * Math.pow(1 - u / 1.9, 1.4) * smooth(u / 0.08);
            g.strokeStyle = `rgba(226,170,84,${a * 0.28})`; g.lineWidth = 11;
            g.beginPath(); g.ellipse(RING_C[0], RING_C[1], rr, rr * 0.94, 0, 0, TAU); g.stroke();
            g.strokeStyle = `rgba(214,156,66,${a})`; g.lineWidth = 3.6 - 0.8 * (u / 1.9);
            g.beginPath(); g.ellipse(RING_C[0], RING_C[1], rr, rr * 0.94, 0, 0, TAU); g.stroke();
            g.strokeStyle = `rgba(255,232,186,${a * 0.6})`; g.lineWidth = 1.2;
            g.beginPath(); g.ellipse(RING_C[0], RING_C[1], rr - 1, rr * 0.94 - 1, 0, 0, TAU); g.stroke();
          }
        };
        rings(D1, 3, 0.36); rings(D2, 2, 0.22);
        g.restore();
        // 拉绳：张紧时是直线，松开后下垂；画在钟亭之前，从右柱后面穿向画外（起点被撞木端头盖住）
        {
          const ax = SX0 + sdx + SL, ay = SY + sdy;
          const sag = 3 + 48 * (1 - tense);
          g.strokeStyle = '#6a5640'; g.lineWidth = 2.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(ax - 4, ay);
          g.quadraticCurveTo((ax + PULL_END[0]) / 2, (ay + PULL_END[1]) / 2 + sag * 1.6, PULL_END[0], PULL_END[1]);
          g.stroke();
        }
        // 钟亭
        g.drawImage(hallTex(), 0, 0, W, H);
        // 吊钟的铁钩
        // 吊钟的铁环：横梁上一块铁板，一节长环穿过蒲牢钮
        g.fillStyle = '#25211d'; g.fillRect(BX - 20, BEAM - 7, 40, 10);
        g.strokeStyle = '#1c1916'; g.lineWidth = 6; g.lineCap = 'round';
        g.beginPath(); g.ellipse(BX + vib * 0.5, (BEAM + BTOP - 20) / 2, 7, (BTOP - 20 - BEAM) / 2 + 4, 0, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(200,170,120,0.35)'; g.lineWidth = 1.2;
        g.beginPath(); g.ellipse(BX + vib * 0.5, (BEAM + BTOP - 20) / 2, 7, (BTOP - 20 - BEAM) / 2 + 4, 0, -1.2, 0.6); g.stroke();
        // 钟（带振动与微摆）
        g.save();
        g.translate(BX + vib, BTOP - 30); g.rotate(swayB); g.translate(-BX, -(BTOP - 30));
        g.drawImage(bellTex(), BX - 150, 60, 300, 400);
        // 撞木在钟面右侧投下的柔和横向暗带（随撞木移动；离得越远越虚、越淡）
        {
          const away = Math.max(0, sdx + GAP - 7);
          const cy = SY + sdy + 7, ry = 15 + away * 0.12, sa = 0.38 * (1 - clamp(away / 120) * 0.45);
          g.save();
          const bodyClip = new Path2D();
          bodyClip.moveTo(BX, BSH); for (let y = BSH; y <= BLIP; y += 4) bodyClip.lineTo(BX + bw(y), y); bodyClip.lineTo(BX, BLIP); bodyClip.closePath();
          g.clip(bodyClip);
          g.translate(BX + bw(SY), cy); g.scale(1, ry / 80);
          const sh = g.createRadialGradient(0, 0, 0, 0, 0, 80);
          sh.addColorStop(0, `rgba(18,16,12,${sa})`); sh.addColorStop(0.45, `rgba(18,16,12,${sa * 0.85})`); sh.addColorStop(1, 'rgba(18,16,12,0)');
          g.fillStyle = sh; g.fillRect(-80, -80, 160, 160);
          g.restore();
        }
        g.restore();
        // 撞木的两根吊绳（平行，摆动时一起倾斜）
        g.strokeStyle = '#5a4a38'; g.lineWidth = 2.6;
        ROPE_X.forEach((rx) => { g.beginPath(); g.moveTo(rx, BEAM); g.lineTo(rx + sdx, SY - SR0 + sdy); g.stroke(); });
        // 撞木：圆木，上面受天光、右端截面迎晨光；吊绳处缠两道绳箍
        const sx0 = SX0 + sdx, sy0 = SY + sdy;
        const lg = g.createLinearGradient(0, sy0 - SR0, 0, sy0 + SR0);
        lg.addColorStop(0, '#a98a60'); lg.addColorStop(0.3, '#8a6a46'); lg.addColorStop(0.75, '#5a4028'); lg.addColorStop(1, '#3a2818');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(sx0 + 10, sy0 - SR0); g.lineTo(sx0 + SL - 5, sy0 - SR0); g.ellipse(sx0 + SL - 5, sy0, 6, SR0, 0, -Math.PI / 2, Math.PI / 2); g.lineTo(sx0 + 10, sy0 + SR0);
        g.quadraticCurveTo(sx0 - 2, sy0 + SR0, sx0, sy0); g.quadraticCurveTo(sx0 - 2, sy0 - SR0, sx0 + 10, sy0 - SR0); g.closePath(); g.fill();
        const eg = g.createLinearGradient(sx0 + SL - 11, 0, sx0 + SL + 1, 0);
        eg.addColorStop(0, '#b08a5a'); eg.addColorStop(1, '#e6c48e');
        g.fillStyle = eg;
        g.beginPath(); g.ellipse(sx0 + SL - 5, sy0, 6, SR0, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(110,80,48,0.6)'; g.lineWidth = 0.8;
        g.beginPath(); g.ellipse(sx0 + SL - 5, sy0, 3.4, SR0 * 0.6, 0, 0, TAU); g.stroke();
        g.strokeStyle = 'rgba(40,28,18,0.3)'; g.lineWidth = 1;
        for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(sx0 + 18 + k * 42, sy0 - 8 + k * 3); g.quadraticCurveTo(sx0 + 40 + k * 42, sy0 - 9 + k * 3, sx0 + 62 + k * 42, sy0 - 7 + k * 3); g.stroke(); }
        ROPE_X.forEach((rx) => {
          const x = rx + sdx;
          g.fillStyle = '#6a5640'; g.fillRect(x - 5, sy0 - SR0 - 1, 10, SR0 * 2 + 2);
          g.strokeStyle = 'rgba(30,22,14,0.5)'; g.lineWidth = 0.8;
          for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - 5 + k * 3, sy0 - SR0 - 1); g.lineTo(x - 3 + k * 3, sy0 + SR0 + 1); g.stroke(); }
        });
        // 撞钟后檐口与横梁上的积雪被震落：一幕细雪粉从画面上方滑落，越往下越散越淡（y≈380 前就没了）
        const curtain = (D, str, n, seed) => {
          const u0 = t - D - 0.1;
          if (u0 <= 0 || u0 > 3.4) return;
          // 薄纱：整幕先快后慢地落下，淡入后慢慢散去
          const fall = (u) => 120 * (u - 0.3 * (1 - Math.exp(-u / 0.3)));
          const va = str * 0.7 * smooth(u0 / 0.25) * (1 - smooth((u0 - 0.6) / 2.2));
          if (va > 0.01) {
            g.save();
            g.globalAlpha = va;
            g.beginPath(); g.rect(0, BEAM, W, 330); g.clip();
            g.drawImage(curtainTex(), 0, BEAM - 40 + fall(u0), W, 200);
            g.restore();
          }
          // 粉粒：沿横梁从钟的位置向两边依次落下（声波传过去需要时间），受空气阻力慢慢飘
          g.fillStyle = '#fffdf8';
          for (let q = 0; q < n; q++) {
            const x0 = 30 + h2(q, seed) * 1220;
            const u = u0 - Math.abs(x0 - BX) / 1500 - h2(q, seed + 1) * 0.25;
            if (u <= 0) continue;
            const vt = 95 + 60 * h2(q, seed + 2);
            const y = BEAM + 2 + vt * (u - 0.3 * (1 - Math.exp(-u / 0.3)));
            const x = x0 + 7 * Math.sin(u * (1.3 + h2(q, seed + 3)) + q) * Math.min(1, u);
            const al = str * smooth(u / 0.2) * (1 - smooth((u - 0.8) / 1.6)) * (1 - smooth((y - 250) / 120)) * (0.55 + 0.45 * h2(q, seed + 4));
            if (al < 0.01) continue;
            g.globalAlpha = al;
            const sz = 0.9 + h2(q, seed + 5) * 1.3;
            g.beginPath(); g.arc(x, y, sz, 0, TAU); g.fill();
          }
          g.globalAlpha = 1;
        };
        curtain(D1, 1, 100, 61); curtain(D2, 0.55, 55, 67);
        // 晨光：整体右侧偏暖；斜射进亭子的光束（缓慢呼吸、拍点上轻起）与其中的冰晶
        g.save();
        // 晨光的暖色与光束（同一张缓存，正常混合）：在亮天上靠暖色显出来，在暗处也略提亮；缓慢呼吸、拍点上轻起
        g.globalAlpha = clamp(0.88 + 0.05 * Math.sin(t * 0.7) + 0.08 * pulse);
        g.drawImage(beamTex(), 0, 0, W, H);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'screen';
        for (let i = 0; i < 48; i++) {
          const ph = h2(i, 41);
          const x = 420 + ((h2(i, 42) * 820 + t * (6 + 8 * h2(i, 43))) % 820);
          const yb = 260 + (x - 420) * -0.2 + h2(i, 44) * 300 + 10 * Math.sin(t * 0.5 + i);
          const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + 2 * ph) + i * 1.7);
          const edge = smooth((x - 440) / 80) * smooth((1240 - x) / 80);
          const a = edge * (0.18 + 0.4 * tw * tw) * (0.7 + 0.5 * pulse);
          if (a < 0.02) continue;
          g.fillStyle = `rgba(255,246,226,${Math.min(0.85, a)})`;
          g.beginPath(); g.arc(x, yb, 0.8 + h2(i, 45) * 1.2, 0, TAU); g.fill();
        }
        g.restore();
        g.restore();
      },
    });
  })();
})();
