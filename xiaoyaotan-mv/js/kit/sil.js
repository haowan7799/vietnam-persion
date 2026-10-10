/* 剪影人物（第三版）XYT.sil —— 接口见 docs/sil-spec.md
 *
 * 每个姿势是一整块设计好的闭合剪影（单位坐标：站立身高 = 100，原点是着地点，x 朝人物面向的一侧，y 向下），不做关节骨架。
 * 绘制：有厚度的主体部件用实色画进一张离屏剪影（同色重叠不出缝；手臂压在身上、剑压在背上这类重叠处，用载入时算好的
 *       淡色细带分开）→ 积雪 → 轮廓光 → 合成到画面；发丝、发带、剑穗、簪、草穗这类细件（cls 'thin'）和背光一侧的
 *       远侧手臂、斗篷（cls 'shade'）不进离屏剪影，按前后次序直接画在目标画布上，不描轮廓光。
 *       轮廓光 = 剪影 − 剪影向光平移 rimW；另外按“边”判定哪些边不亮（rimAnalyze：对着窄缝的边、细窄的尖梢、
 *       贴着细件的边，一条边要么整条亮、要么整条渐隐，不会出现亮线内缩、外侧留暗线）。判定用的低分辨率覆盖度
 *       直接由轮廓多边形在 JS 里扫描得到，不读回离屏画布；合成全部是整像素平移（见 rimPass、settle）。
 *       无旋转、等比缩放时对齐到整像素；半透明时篙、钓竿、剑身与剪影先叠好再整体淡入淡出。
 * 会动的只有挂在固定锚点上的头发、发带、袖口、下摆、披帛、斗篷边，用 2–3 个正弦叠加；wind = 0 时只剩呼吸。
 * 接口补充：
 *   - opts.hat：老者 standSide / walkSide / sitSide 戴斗笠；
 *   - opts.boat：boat() 的返回值，人画在船板上并随船起伏（镜头不必再自己套船的变换）；
 *   - opts.waterDepth：船板（或坐面）到水面的像素距离，篙和钓线在水面处截断；opts.lineTo：钓线末端（单位身高/100）；
 *   - boat(g, x, y, len, t, { layer: 'back' | 'front' })：'back' 只画乌篷，'front' 只画船身——先画 back、再画人、
 *     最后画 front，船舷就能挡住坐着、躺着的人的下半身；
 *   - bounds(who, pose, h, facing | opts)：opts 里的 facing、hat、waterDepth / boat（篙与钓线算到水面）都会考虑；
 *   - opts.line：'skip' 不画钓线，'only' 只画钓线——人坐在船上垂钓时，先 draw(..., {line:'skip'})、再画船身前层、
 *     最后 draw(..., {line:'only'})，钓线就不会被船舷挡住；
 *   - _debug = true 时，离屏画布边缘有像素（飘动件被裁掉）会记进 _clip。
 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const TAU = Math.PI * 2;
  const U = 100;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  // 确定性散列（0..1），只用于造型的固定变化，不随时间
  function hash01(n) {
    n = (n | 0) ^ 0x9e3779b9;
    n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------------- 颜色 ----------------
  const rgbCache = new Map();
  function rgb(c) {
    let v = rgbCache.get(c);
    if (v) return v;
    if (c[0] === '#') {
      let s = c.slice(1);
      if (s.length === 3) s = s.replace(/./g, (m) => m + m);
      v = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
    } else {
      const m = c.match(/[\d.]+/g) || [0, 0, 0];
      v = [+m[0], +m[1], +m[2]];
    }
    rgbCache.set(c, v);
    return v;
  }
  const mixCache = new Map();
  function mix(a, b, t) {
    const k = a + '|' + b + '|' + t;
    let v = mixCache.get(k);
    if (v) return v;
    const A = rgb(a), B = rgb(b);
    v = `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
    if (mixCache.size > 4000) mixCache.clear();
    mixCache.set(k, v);
    return v;
  }
  const rgba = (c, a) => { const A = rgb(c); return `rgba(${A[0]},${A[1]},${A[2]},${a})`; };

  // ---------------- 平滑曲线：向心 Catmull–Rom → 三次贝塞尔 ----------------
  // 点格式 [x, y, corner?, flutterWeight?, seed?]；corner 为真时在该点形成干净的转角
  function area(pts) {
    let s = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      s += p[0] * q[1] - q[0] * p[1];
    }
    return s / 2;
  }
  // 曲线自己按折线展平（不交给画布的 bezierCurveTo）：画布按设备像素决定每段三次曲线切几刀，比例、呼吸稍一变化，刀数就跳一档，
  // 长而缓的边（膝头、笠沿、钓竿）会整条挪动约 0.3 像素，轮廓光随之一帧一帧地“爬”。这里按二阶差分估算误差，使折线与曲线的
  // 偏差不超过 FLAT_TOL 像素：静态轮廓按参考比例 FLAT_REF（每单位 8 像素，约 h = 800）预建一次，之后放大缩小都不再变；
  // 每帧现算的部件按本帧实际比例 flatS 展平（刀数变化时折线只差零点零几像素，看不出跳动）
  const FLAT_TOL = 0.1, FLAT_REF = 8;
  let flatS = FLAT_REF;
  function addSmooth(P2, pts, closed) {
    const n = pts.length;
    if (n < 2) return;
    if (closed && area(pts) < 0) pts = pts.slice().reverse();
    const get = closed ? (i) => pts[((i % n) + n) % n] : (i) => pts[i < 0 ? 0 : i >= n ? n - 1 : i];
    const kq = (0.75 * flatS) / FLAT_TOL;
    P2.moveTo(pts[0][0], pts[0][1]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const D1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const D2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1e-6;
      const D3 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      const s1 = Math.sqrt(D1), s2 = Math.sqrt(D2), s3 = Math.sqrt(D3);
      let c1x, c1y, c2x, c2y;
      if (p1[2] || D1 < 1e-5) { c1x = p1[0] + (p2[0] - p1[0]) / 3; c1y = p1[1] + (p2[1] - p1[1]) / 3; }
      else {
        const k = 3 * s1 * (s1 + s2), m = 2 * D1 + 3 * s1 * s2 + D2;
        c1x = (p2[0] * D1 - p0[0] * D2 + p1[0] * m) / k;
        c1y = (p2[1] * D1 - p0[1] * D2 + p1[1] * m) / k;
      }
      if (p2[2] || D3 < 1e-5) { c2x = p2[0] + (p1[0] - p2[0]) / 3; c2y = p2[1] + (p1[1] - p2[1]) / 3; }
      else {
        const k = 3 * s3 * (s3 + s2), m = 2 * D3 + 3 * s3 * s2 + D2;
        c2x = (p1[0] * D3 - p3[0] * D2 + p2[0] * m) / k;
        c2y = (p1[1] * D3 - p3[1] * D2 + p2[1] * m) / k;
      }
      const ax = p1[0] - 2 * c1x + c2x, ay = p1[1] - 2 * c1y + c2y, bx = c1x - 2 * c2x + p2[0], by = c1y - 2 * c2y + p2[1];
      const d2 = Math.sqrt(Math.max(ax * ax + ay * ay, bx * bx + by * by));
      const m = d2 > 0 ? Math.min(32, Math.ceil(Math.sqrt(kq * d2))) : 1;
      for (let k = 1; k < m; k++) {
        const t = k / m, mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
        P2.lineTo(a * p1[0] + b * c1x + c * c2x + d * p2[0], a * p1[1] + b * c1y + c * c2y + d * p2[1]);
      }
      P2.lineTo(p2[0], p2[1]);
    }
    if (closed) P2.closePath();
  }

  // ---------------- 形状助手 ----------------
  function ell(cx, cy, rx, ry, rot, n) {
    n = n || 10;
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0), out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  // 由“右半边”（从顶部中线到底部中线）镜像出左右对称的闭合轮廓
  function sym(half) {
    const out = half.slice();
    for (let i = half.length - 1; i >= 0; i--) {
      const p = half[i];
      if (Math.abs(p[0]) < 1e-6) continue;
      const q = p.slice(); q[0] = -p[0];
      if (q[4] != null) q[4] = q[4] + 1.7;
      out.push(q);
    }
    return out;
  }
  const mirror = (pts) => pts.map((p) => { const q = p.slice(); q[0] = -p[0]; return q; });
  const shift = (pts, dx, dy, s) => pts.map((p) => { const q = p.slice(); q[0] = p[0] * (s || 1) + dx; q[1] = p[1] * (s || 1) + dy; return q; });
  function rot(pts, cx, cy, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return pts.map((p) => { const q = p.slice(), x = p[0] - cx, y = p[1] - cy; q[0] = cx + x * c - y * s; q[1] = cy + x * s + y * c; return q; });
  }
  const rotP = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy; return [cx + dx * c - dy * s, cy + dx * s + dy * c]; };
  // 中心线 → 渐细带状轮廓；prof(s) 给出 s∈[0,1] 处的宽度；tip: 'point' | 'cut' | 'round'
  function taper(c, prof, tip, cutAng) {
    const n = c.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const p = c[i], a = c[i > 0 ? i - 1 : 0], b = c[i < n - 1 ? i + 1 : n - 1];
      let tx = b[0] - a[0], ty = b[1] - a[1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const w = prof(i / (n - 1)) / 2;
      L.push([p[0] - ty * w, p[1] + tx * w]);
      R.push([p[0] + ty * w, p[1] - tx * w]);
    }
    L[0][2] = 1; R[0][2] = 1;
    const out = L.slice();
    if (tip === 'point') {
      out.pop(); R.pop();
      const e = c[n - 1];
      out.push([e[0], e[1], 1]);
    } else if (tip === 'cut') {
      const ca = cutAng || 0.35;
      const e = out[out.length - 1], f = R[n - 1];
      const dx = c[n - 1][0] - c[n - 2][0], dy = c[n - 1][1] - c[n - 2][1], dl = Math.hypot(dx, dy) || 1;
      const w2 = Math.hypot(e[0] - f[0], e[1] - f[1]);
      e[0] += (dx / dl) * w2 * ca; e[1] += (dy / dl) * w2 * ca; e[2] = 1; f[2] = 1;
    } else {
      const e = c[n - 1], dx = c[n - 1][0] - c[n - 2][0], dy = c[n - 1][1] - c[n - 2][1], dl = Math.hypot(dx, dy) || 1;
      const w2 = prof(1) * 0.45;
      out.push([e[0] + (dx / dl) * w2, e[1] + (dy / dl) * w2]);
    }
    for (let i = R.length - 1; i >= 0; i--) out.push(R[i]);
    return out;
  }
  // 圆头细带（剑柄、钓线、发带结）
  const band = (pts, w) => taper(pts, () => w, 'round');
  // 两头都是圆头的渐细肢体（小臂）：起点也用一个圆帽收口，不留方角
  function limb(c, prof) {
    const out = taper(c, prof, 'round');
    out[0] = out[0].slice(0, 2); out[out.length - 1] = out[out.length - 1].slice(0, 2);
    const a = c[0], b = c[1], dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, w = prof(0) * 0.45;
    out.push([a[0] - ((b[0] - a[0]) / dl) * w, a[1] - ((b[1] - a[1]) / dl) * w]);
    return out;
  }
  // 链：从根部 (x,y) 起，ang(s) 给出各段方向（0 = 竖直向下，正 = 朝 +x）
  function chain(x, y, len, n, ang) {
    const pts = [[x, y]], dl = len / n;
    for (let i = 1; i <= n; i++) {
      const a = ang((i - 0.5) / n);
      x += Math.sin(a) * dl; y += Math.cos(a) * dl;
      pts.push([x, y]);
    }
    return pts;
  }
  // 摆动：三个频率叠加，相位沿部件向末端传播；wind=0 时只剩很小的余动
  function sway(env, s, seed, f) {
    const t = env.t;
    f = f || 0.42;
    return (0.6 * Math.sin(TAU * f * t - 2.4 * s + seed) +
      0.28 * Math.sin(TAU * f * 1.62 * t - 3.3 * s + 1.7 * seed) +
      0.12 * Math.sin(TAU * f * 2.55 * t - 4.4 * s + 2.9 * seed)) * (0.12 + 0.88 * env.wa);
  }
  const gust = (env, seed) => 1 + 0.18 * Math.sin(TAU * 0.23 * env.t + seed) + 0.08 * Math.sin(TAU * 0.61 * env.t + 2 * seed);
  // 飘带/发束：o = {x,y,len,n,a0,curl,wave,lift,amp,f,seed,w0,w1,tip,amin,amax,twist,back,backK,floor}
  //   back：部件挂在身体哪一侧；风朝身体一侧吹时风的作用乘 backK（默认 0.3），amin/amax 限定各段方向
  function strand(env, o) {
    const wl = env.w * gust(env, o.seed || 0);
    const lift = o.lift == null ? 0.5 : o.lift;
    const target = (wl >= 0 ? 1 : -1) * Math.PI * 0.5;
    const back = o.back || 0; // 部件所在的一侧：-1 后、+1 前；风朝身体一侧吹时减弱
    let wk = Math.abs(wl) * lift;
    if (back && Math.sign(wl) !== back) wk *= o.backK == null ? 0.3 : o.backK;
    const a0 = o.a0 || 0, curl = o.curl || 0, wave = o.wave || 0, amp = o.amp == null ? 0.25 : o.amp;
    const pw = o.pw || 1.4;
    const da = o.da || 0; // 头部转角：只有根部跟着头转，越往末端越回到自然下垂
    const c = chain(o.x, o.y, o.len, o.n || 8, (s) => {
      let a = a0 + da * (1 - s) * (1 - s) + curl * (o.cp ? 1 - Math.pow(1 - s, o.cp) : s) + wave * Math.sin(TAU * s);
      a += (target - a) * clamp(wk * Math.pow(s, o.wp || 0.6), 0, 0.95);
      a += amp * Math.pow(s, pw) * sway(env, s, o.seed || 0, o.f);
      if (o.amin != null && a < o.amin) a = o.amin;
      if (o.amax != null && a > o.amax) a = o.amax;
      return a;
    });
    if (o.floor != null) for (const p of c) if (p[1] > o.floor) p[1] = o.floor;
    const w0 = o.w0, w1 = o.w1 == null ? o.w0 * 0.5 : o.w1;
    const tw = o.twist || 0;
    const prof = o.prof || ((s) => {
      let w = w0 + (w1 - w0) * s;
      if (tw) w *= 1 - tw * 0.5 * (1 - Math.cos(TAU * (s * 1.3 + 0.15 * Math.sin(TAU * 0.3 * env.t + (o.seed || 0)))));
      return w;
    });
    return taper(c, prof, o.tip || 'point', o.cutAng);
  }
  // 方案 B 的链（披帛、斗篷肋、仰卧时铺在船板上的发带）：rest 方向从 a0 过渡到 a1，风把它吹起 lift 弧度
  function bsw(t, ph) {
    return 0.55 * Math.sin(TAU * 0.53 * t + ph) + 0.3 * Math.sin(TAU * 0.89 * t + 1.7 * ph + 0.5) + 0.15 * Math.sin(TAU * 1.17 * t + 2.3 * ph + 1.1);
  }
  function bchain(env, x, y, len, n, o) {
    const pts = [[x, y]];
    const wl = o.wl == null ? env.w : o.wl, t = env.t, aw = clamp(wl, -1, 1) * (o.lift == null ? 1.1 : o.lift);
    const gr = o.grav == null ? 1 : o.grav, a0 = o.a0 || 0, a1 = o.a1 || 0;
    let px = x, py = y;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const rest = a0 + (a1 - a0) * Math.pow(u, o.rp || 0.7) * gr;
      const blow = aw * smooth01(Math.min(1, u * 1.6 + 0.15));
      const amp = (o.amp == null ? 0.35 : o.amp) * ((o.fw == null ? Math.abs(wl) : o.fw) + (o.idle || 0)) * u;
      let a = rest + blow + amp * bsw(t * (o.fq || 1) - u * (o.lag == null ? 0.55 : o.lag), o.ph || 0) + (o.curl || 0) * u + (o.rot || 0);
      // 软限幅：吹得再猛也只渐渐逼近 ±lim（布不会翻过水平线）
      if (o.lim) { const k = o.lim + ((o.limEnd == null ? o.lim : o.limEnd) - o.lim) * u - 0.35; if (a < -k) a = -k - 0.35 * Math.tanh((-k - a) / 0.35); else if (a > k) a = k + 0.35 * Math.tanh((a - k) / 0.35); }
      px += (Math.sin(a) * len) / n; py += (Math.cos(a) * len) / n;
      pts.push([px, py]);
    }
    return pts;
  }
  // 披帛垂端：根部固定；风把整条带子向下风方向偏（风力 0.6 时约 20–25°，最大不过 35°），叠一道沿带子向下传的柔和行波
  // （1–2 个 S 弯），带宽随“翻面”略有起伏，末端圆收。o.side：带子挂在身体哪一侧（+1 在 +x 外侧，-1 在 -x 外侧）——
  // 风往身体一侧吹时只偏 towardK（默认 0.15）那么多，并且每一段都不越过根部所在的竖线；o.rest：静止时从 a0 回到竖直的比例
  function shawlTail(env, x, y, len, o) {
    const n = o.n || 14, seed = o.seed || 0, side = o.side || 0;
    const wl = env.w * gust(env, seed);
    let lean = 0.61 * Math.tanh((wl * (o.lift == null ? 0.7 : o.lift)) / 0.61);
    if (side && wl * side < 0) lean *= o.towardK == null ? 0.15 : o.towardK;
    const wa = 0.035 + 0.17 * Math.min(1, Math.abs(wl));
    const a0 = o.a0 || 0, rest = o.rest || 0;
    const pts = [[x, y]];
    let px = x, py = y;
    for (let i = 1; i <= n; i++) {
      const u = (i - 0.5) / n;
      let a = a0 * (1 - rest * u) + lean * Math.pow(u, 0.6) +
        wa * Math.pow(u, 0.8) * (0.8 * Math.sin(TAU * (1.2 * u - 0.5 * env.t) + seed) + 0.2 * Math.sin(TAU * (2.1 * u - 0.83 * env.t) + 1.7 * seed));
      if (side < 0) a = smin(a, 0.05, 0.03); else if (side > 0) a = smax(a, -0.05, 0.03);
      px += (Math.sin(a) * len) / n; py += (Math.cos(a) * len) / n;
      pts.push([px, py]);
    }
    const w0 = o.w0 || 2.2, w1 = o.w1 == null ? w0 * 0.75 : o.w1;
    return taper(pts, (u) => (w0 + (w1 - w0) * u) * (1 - 0.2 * (0.5 - 0.5 * Math.cos(TAU * (0.9 * u - 0.4 * env.t) + seed)) * Math.min(1, u * 3)), 'round');
  }
  // 布边颤动：权重 w 的点随风偏移并有小幅波动（根部 w=0 固定）；fa 为整体幅度，lift 为风把布边掀起的高度
  function flutter(env, pts, fa, lift) {
    const t = env.t, out = new Array(pts.length);
    fa = fa || 1; lift = lift || 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], w = p[3];
      if (!w) { out[i] = p; continue; }
      const sd = p[4] || 0;
      const a = 0.12 + 0.88 * env.wa;
      const s1 = Math.sin(TAU * 0.47 * t + p[1] * 0.19 + p[0] * 0.23 + sd);
      const s2 = Math.sin(TAU * 0.79 * t + p[0] * 0.37 + 1.3 * sd);
      const s3 = Math.sin(TAU * 1.13 * t + p[1] * 0.41 + 2.1 * sd);
      let dx = w * fa * (0.75 * env.w * gust(env, sd) + 0.55 * a * (0.6 * s1 + 0.28 * s2 + 0.12 * s3));
      if (env.isWalk) dx += w * 0.45 * Math.sin(TAU * 2 * env.ws.phA - 0.9 - p[1] * 0.04);
      const dy = w * fa * 0.22 * a * (0.6 * s2 + 0.4 * s3) - w * lift * env.wa * (0.75 + 0.25 * s1);
      out[i] = [p[0] + dx, p[1] + dy, p[2]];
    }
    return out;
  }
  // 细长物件（剑鞘、钓竿、篙）：从 A 到 B，宽 wa→wb
  function rod(A, B, wa, wb, tipA, tipB) {
    const dx = B[0] - A[0], dy = B[1] - A[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, ux = dx / l, uy = dy / l;
    // 侧边点一律是转角，长边保持笔直；只有端头是圆的
    const out = [[A[0] + nx * wa / 2, A[1] + ny * wa / 2, 1], [B[0] + nx * wb / 2, B[1] + ny * wb / 2, 1]];
    if (tipB) out.push([B[0] + nx * wb * 0.3 + ux * wb * 0.42, B[1] + ny * wb * 0.3 + uy * wb * 0.42], [B[0] + ux * wb * 0.55, B[1] + uy * wb * 0.55], [B[0] - nx * wb * 0.3 + ux * wb * 0.42, B[1] - ny * wb * 0.3 + uy * wb * 0.42]);
    out.push([B[0] - nx * wb / 2, B[1] - ny * wb / 2, 1], [A[0] - nx * wa / 2, A[1] - ny * wa / 2, 1]);
    if (tipA) out.push([A[0] - nx * wa * 0.3 - ux * wa * 0.42, A[1] - ny * wa * 0.3 - uy * wa * 0.42], [A[0] - ux * wa * 0.55, A[1] - uy * wa * 0.55], [A[0] + nx * wa * 0.3 - ux * wa * 0.42, A[1] + ny * wa * 0.3 - uy * wa * 0.42]);
    return out;
  }
  // 背剑：P 剑首，G 护手，T 鞘尖；返回部件。opt.c 颜色（默认略浅的 obj），opt.sep 与身体之间的分隔细线宽
  function sword(P, G, T, z, opt) {
    opt = opt || {};
    const ws = opt.ws || 2.1, wt = opt.wt || 1.7, c = opt.c || 'obj', sep = opt.sep || 0;
    const dx = T[0] - G[0], dy = T[1] - G[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
    const parts = [];
    parts.push({ z, c, sep, pts: rod([G[0] + ux * 0.6, G[1] + uy * 0.6], T, ws, wt, false, true) });
    const ga = Math.atan2(uy, ux);
    // 护手、剑柄、剑首是细件：不描轮廓光
    parts.push({ z, c, cls: 'thin', pts: ell(G[0], G[1], 0.75, (opt.guard || 2.0), ga, 10) });
    parts.push({ z, c, cls: 'thin', pts: rod(G, P, 1.25, 1.15, false, false) });
    parts.push({ z, c, cls: 'thin', pts: ell(P[0], P[1], 0.9, 0.8, ga, 8) });
    return parts;
  }

  // 葫芦：(cx,cy) 为顶端系绳处，ang=0 时竖直下垂（ang=π 时立着，顶端朝上），s 缩放（s=1 时长约 9.8）
  const GOURD = [[0.42, 0, 1], [0.5, 0.6], [1.3, 1.1], [1.82, 2.25], [1.6, 3.45], [1.02, 4.3], [1.85, 5.0], [2.6, 6.15], [2.75, 7.25], [2.4, 8.6], [1.45, 9.45], [0, 9.78]];
  const GOURD_FULL = GOURD.concat(GOURD.slice(0, -1).reverse().map((p) => [-p[0], p[1], p[2]]));
  function gourd(cx, cy, s, ang) {
    const c = Math.cos(ang || 0), sn = Math.sin(ang || 0);
    return GOURD_FULL.map((p) => { const x = p[0] * s, y = p[1] * s; return [cx + x * c - y * sn, cy + x * sn + y * c, p[2]]; });
  }
  // 葫芦腰上的系绳（细带，身体色）
  function gourdTie(cx, cy, s, ang) {
    const c = Math.cos(ang || 0), sn = Math.sin(ang || 0);
    const pts = [[-1.25, 4.05], [1.25, 4.05], [1.3, 4.6], [-1.3, 4.6]];
    return pts.map((p) => { const x = p[0] * s, y = p[1] * s; return [cx + x * c - y * sn, cy + x * sn + y * c]; });
  }
  // 立着的葫芦：底部落在 (x, y)
  const gourdStand = (x, y, s) => gourd(x, y - 9.78 * s, s, 0);
  const gourdStandTie = (x, y, s) => gourdTie(x, y - 9.78 * s, s, 0);

  // ---------------- 长衫步 ----------------
  // 步频 1.3 步/秒，步幅 = 0.42/1.3 ≈ 0.323 身高；支撑脚在世界中固定，摆动脚藏在下摆里
  const WALK = { f: 1.3, beta: 0.58, v: 42, lift: 2.2, toe: 7.6, heel: 3.4, th0: 0.42, th1: -0.28 };
  WALK.P = 2 / WALK.f;
  WALK.a = (WALK.v * WALK.beta * WALK.P) / 2;
  // 每只脚：x 为脚踝在地面的投影（相对身体），鞋的变换 = 平移 (ox, oy) + 绕 (ox, oy) 旋转 th
  // 支撑末段绕鞋尖抬脚跟、落地初段绕脚跟放下鞋尖，转轴在世界中固定，所以不滑
  function walkState(env) {
    const P = WALK.P, a = WALK.a, be = WALK.beta, v = WALK.v, TO = WALK.toe, HE = WALK.heel;
    const T = env.walkT;
    const feet = [];
    for (const off of [0, 0.5]) {
      const ph = (((T / P + off) % 1) + 1) % 1;
      let x, y = 0, u = 0, ox, oy, th, planted = ph < be;
      if (planted) {
        x = a - (ph / be) * 2 * a;
        const kOff = sstep(be - 0.14, be, ph), kOn = 1 - sstep(0, 0.1, ph);
        if (kOff > 0) { th = WALK.th0 * kOff; ox = x + TO * (1 - Math.cos(th)); oy = -TO * Math.sin(th); }
        else if (kOn > 0) { th = WALK.th1 * kOn; ox = x - HE * (1 - Math.cos(th)); oy = HE * Math.sin(th); }
        else { th = 0; ox = x; oy = 0; }
      } else {
        u = (ph - be) / (1 - be);
        const u2 = u * u, u3 = u2 * u;
        const m = -v * (1 - be) * P;
        x = (2 * u3 - 3 * u2 + 1) * -a + (u3 - 2 * u2 + u) * m + (-2 * u3 + 3 * u2) * a + (u3 - u2) * m;
        const sl = Math.sin(Math.PI * u);
        y = -WALK.lift * sl * sl;
        const k = u * u * (3 - 2 * u);
        const t0 = WALK.th0, t1 = WALK.th1;
        th = t0 + (t1 - t0) * k;
        ox = x + TO * (1 - Math.cos(t0)) * (1 - k) - HE * (1 - Math.cos(t1)) * k;
        oy = y - TO * Math.sin(t0) * (1 - k) + HE * Math.sin(t1) * k;
      }
      feet.push({ x, y, ph, u, planted, ox, oy, th });
    }
    const phA = feet[0].ph;
    const bob = -0.24 * Math.cos(TAU * (2 * phA - be));
    return { feet, bob, phA };
  }
  const smax = (a, b, k) => { const m = Math.max(a, b); return m + k * Math.log(Math.exp((a - m) / k) + Math.exp((b - m) / k)); };
  const smin = (a, b, k) => -smax(-a, -b, k);
  // 走路用的布鞋：鞋面上带一小截裤脚（脚踝），被下摆盖住，只有前脚尖、后脚跟交替露出时才看得见
  const WALK_SHOE = [[-2.2, -5.0], [-0.4, -5.9], [1.4, -5.0], [1.9, -3.2], [4.9, -2.3], [7.2, -1.3], [7.9, -0.4], [7.6, 0, 1], [-3.3, 0, 1], [-3.7, -1.2], [-2.9, -3.0]];

  // 长衫下摆：前缘被前腿推出、后缘拖在后腿脚踝处；跨步时的张开比腿的实际跨度收窄约 25%，
  // 上半段（臀到膝）几乎垂直，张开集中在膝下，所以是钟形而不是从腰起的三角形
  function robeWalk(env, out, o) {
    const ws = env.ws, f = ws.feet;
    const cov = (ft) => ft.x + o.frontGap + (ft.planted ? 0 : o.swingCover * sstep(0, 0.25, ft.u) * (1 - sstep(0.74, 1, ft.u)));
    const lead = smax(cov(f[0]), cov(f[1]), 2.0), rear = smin(f[0].x, f[1].x, 2.0);
    const xF = o.restF + 0.8 * (smax(o.restF, lead, 1.2) - o.restF);
    const xB = o.restB + 0.7 * (smin(o.restB, rear - o.backGap, 1.2) - o.restB);
    const spread = clamp((xF - xB - (o.restF - o.restB)) / 22, 0, 1);
    const hy = o.hemY, bob = ws.bob;
    const yMid = hy + 0.25 - 1.6 * spread;
    const wf = o.waistF, wb = o.waistB;
    const kneeF = 1.2 * spread;
    const hf = hy - 1.1 * spread;
    const pts = [
      [wf[0], wf[1]],
      [L3(wf[0], o.restF, xF, -44), -44],
      [L3(wf[0], o.restF, xF, -27) + kneeF, -27, 0, 0.25, 0.3],
      [L3(wf[0], o.restF, xF, -11) + kneeF * 0.35, -11, 0, 0.5, 0.6],
      [xF + 0.3, hf - 1.0 - bob, 0, 0.6, 0.9],
      [xF - 1.6, hf + 0.3 - bob, 0, 0.7, 1.2],
      [(xF + xB) / 2, yMid - bob, 0, 0.8, 1.5],
      [xB + 2.4, hy + 0.3 - 0.6 * spread - bob, 0, 0.9, 1.8],
      [xB, hy - 0.5 - 1.2 * spread - bob, 1, 1.0, 2.1],
      [L3(wb[0], o.restB, xB, -11), -12, 0, 0.7, 2.4],
      [L3(wb[0], o.restB, xB, -27), -27, 0, 0.4, 2.7],
      [L3(wb[0], o.restB, xB, -44), -44, 0, 0.1],
      [wb[0], wb[1]],
      [wb[0] + 1, wb[1] - 6],
      [wf[0] - 0.4, wf[1] - 6],
    ];
    out.push({ z: o.z || 2, c: 'body', pts, fl: 1 });
    // 鞋：支撑脚贴地（世界坐标固定），摆动脚抬起藏在下摆里；画在下摆后面
    const shoe = o.shoe || WALK_SHOE;
    for (const ft of f) out.push({ z: (o.z || 2) - 0.05, c: 'body', pts: rot(shift(shoe, ft.ox, ft.oy - bob), ft.ox, ft.oy - bob, ft.th) });
  }
  // 下摆轮廓在高度 y 处的 x：腰 → 静止下摆位置 → 实际下摆位置，越往下越受腿推动
  function L3(w, rest, hem, y) {
    const k = clamp((-y - 0) / 50, 0, 1); // 1 在腰、0 在地
    const base = lerp(rest, w, Math.pow(k, 1.6));
    const push = (hem - rest) * Math.pow(1 - k, 1.35);
    return base + push;
  }

  // ---------------- 人物库 ----------------
  // 部件：{ z 叠放次序, c 颜色名, pts 闭合轮廓, dyn 布边颤动, fa 颤动幅度, sep 与下面已画部件之间的淡色分隔线宽 }
  // 衣褶：{ pts 中心线, w 宽, flat 等宽（腰带）, z, c }，只画在已有剪影上
  const DEF = {};
  const ACCENT = {};
  function def(who, pose, build) { (DEF[who] = DEF[who] || {})[pose] = build; }

  // 默认颜色
  const COL = {
    body: '#1d2128',
    hair: '#c9c6bf',
    blue: '#4a76a6',
    blueOld: '#5d7894',
    pink: '#e8b7c3',
    gourd: '#93693a',
    gourdHi: '#ad8048',
    snow: '#eef2f6',
    straw: '#3a3428',
    gold: '#c9a35a',
  };

  // ======================================================================
  // 少年侠客 youth：黑发高束、蓝发带两条长尾、挺拔、窄袖劲装外罩长衫、背剑（约 7.6 头身）
  // ======================================================================
  ACCENT.youth = 'blue';
  const Y = {};
  // 侧脸（以头颈连接点为原点，朝右）：额、眉骨、鼻、唇、下巴，没有眼睛
  Y.head = [
    [-2.9, -0.4], [-4.5, -3.2], [-5.0, -6.2], [-4.4, -9.0], [-2.5, -10.8], [0.3, -11.45], [2.9, -10.85],
    [4.55, -9.0], [5.25, -6.95], [5.55, -5.8], [5.3, -5.15], [5.85, -3.85], [6.55, -2.85, 1], [5.85, -2.35],
    [5.95, -1.65], [5.6, -1.25], [5.75, -0.8], [5.3, -0.25], [5.5, 0.45], [5.05, 1.25], [3.6, 1.5], [2.3, 1.8],
    [1.9, 3.2], [-2.9, 3.0],
  ];
  // 大笑：下颌微张
  Y.headLaugh = [
    [-2.9, -0.4], [-4.5, -3.2], [-5.0, -6.2], [-4.4, -9.0], [-2.5, -10.8], [0.3, -11.45], [2.9, -10.85],
    [4.55, -9.0], [5.25, -6.95], [5.55, -5.8], [5.3, -5.15], [5.85, -3.85], [6.55, -2.85, 1], [5.85, -2.35],
    [5.95, -1.65], [5.0, -1.0, 1], [5.45, -0.2], [5.15, 0.45], [5.3, 1.15], [4.85, 1.9], [3.5, 2.1], [2.3, 2.2],
    [1.9, 3.4], [-2.9, 3.0],
  ];
  Y.HO = [-0.25, -88.4]; // 头颈连接点
  // 头发（相对头颈点）：额顶到后脑多出一层发量
  Y.cap = [[3.55, -10.2], [2.4, -11.55], [0.65, -12.2], [-2.35, -11.7], [-4.55, -9.6], [-5.5, -6.4], [-4.95, -3.4], [-3.35, -4.2], [-0.25, -9.0], [1.9, -10.3]];
  // 侧影身体：挺拔，长衫及踝，下摆略外扩；颈宽约头宽的 0.45
  Y.sideBody = [
    [1.6, -86.4], [2.6, -83.9], [4.3, -82.0], [6.0, -78.8], [6.5, -74.0], [5.7, -68.2], [5.0, -63.6],
    [5.6, -59.0], [6.2, -50, 0, 0.05], [6.8, -36, 0, 0.18], [7.6, -21, 0, 0.45], [8.6, -5.2, 1, 0.9],
    [0.2, -4.4, 0, 1.0], [-8.8, -4.6, 1, 1.1], [-8.4, -18, 0, 0.7], [-7.6, -33, 0, 0.35], [-7.1, -45, 0, 0.12], [-7.2, -52.5],
    [-5.9, -60.6], [-5.5, -66.5], [-5.9, -73.5], [-5.6, -79.6], [-4.8, -83.4], [-3.9, -86.2], [-3.3, -88.6],
  ];
  // 近侧手臂：窄袖笔直下垂，到腕部收细；手一半藏在袖口里
  Y.arm = [
    [-3.8, -83.2], [-0.6, -84.4], [2.6, -83.0], [3.9, -79.0], [3.7, -71.0], [3.6, -65.6], [4.8, -59.5],
    [6.4, -53.6, 1], [3.6, -51.8], [0.4, -51.0, 1], [-0.8, -55.5], [-2.8, -62.5], [-3.9, -69], [-4.4, -77.0],
  ];
  Y.hand = [[1.8, -52.6], [5.4, -53.2], [6.2, -50.2], [6.0, -47.4], [5.2, -45.2], [4.2, -44.5], [3.3, -45.5], [2.4, -48.2]];
  // 侧面靴（比原稿短约 20%）
  Y.boot = [[-2.8, -5.6], [1.9, -5.6], [2.6, -3.7], [6.2, -2.3], [7.6, -1.2], [7.7, -0.2, 1], [-3.9, 0, 1], [-4.2, -2.2]];
  // 腰带：两端正好落在前后腰线以内（腰带端头伸出轮廓会在剪影边上多出一个方台阶）
  Y.sideFolds = [
    { pts: [[-5.5, -63.6], [4.95, -63.6]], w: 2.0, flat: 1 },
    { pts: [[1.0, -58], [1.6, -30], [2.2, -12], [2.4, -6]], w: 0.6 },
    { pts: [[-4.2, -56], [-4.8, -28], [-5.4, -10]], w: 0.6 },
    { pts: [[4.0, -80.5], [5.0, -75.0], [4.6, -69.0]], w: 0.45 },
  ];
  const HTF = (tilt) => (pts) => rot(shift(pts, Y.HO[0], Y.HO[1]), Y.HO[0], Y.HO[1], tilt || 0);
  // 头、发、髻、发带结（H：头部点变换）
  function youthSideHead(parts, folds, H, laugh) {
    parts.push({ z: 2.2, c: 'body', pts: H(laugh ? Y.headLaugh : Y.head) });
    parts.push({ z: 2.3, c: 'hairD', pts: H(Y.cap) }, { z: 2.3, c: 'hairD', pts: H(ell(-2.25, -12.7, 1.95, 1.55, -0.35, 10)) });
    parts.push({ z: 2.35, c: 'blue', pts: H(band([[-3.75, -12.0], [-2.4, -12.65], [-1.0, -13.35]], 1.0)) });
    folds.push({ z: 2.3, c: 'hairD', pts: H([[2.2, -11.1], [-0.6, -11.4], [-3.4, -9.6], [-4.6, -6.6]]), w: 0.35 });
  }
  // 马尾与两条发带尾：根部在发髻后侧，始终在头后（顺风时最多垂到竖直，不会翻到脸前）
  function youthSideHair(env, out, H, da) {
    da = da || 0;
    const r0 = H([[-2.9, -12.8]])[0], r1 = H([[-3.9, -12.5]])[0], r2 = H([[-3.6, -12.1]])[0];
    // 马尾从髻后先向后探出，很快在重力下垂落；发带从结上几乎直垂，有风才被吹起
    // 风从背后来（吹向面朝的一侧）时：发带梢前倾到约 0.35 弧度、马尾到约 0.2 弧度，压向后颈（画在身体后面，越过后颈的部分被挡住）
    out.push({ z: 1.8, c: 'hairD', pts: strand(env, { x: r0[0], y: r0[1], len: 19.5, n: 9, a0: -0.62, da, curl: 0.56, cp: 2.4, wp: 1.0, lift: 0.3, amp: 0.14, seed: 1.1, w0: 2.7, w1: 0.6, tip: 'point', back: -1, backK: 0.45, amax: 0.2, f: 0.38 }) });
    out.push({ z: 0.7, c: 'blue', pts: strand(env, { x: r1[0], y: r1[1], len: 24, n: 10, a0: -0.42, da, curl: 0.34, cp: 2, wp: 0.8, lift: 0.95, amp: 0.34, seed: 0.3, w0: 1.4, w1: 1.15, tip: 'cut', twist: 0.55, back: -1, backK: 0.6, amax: 0.35, f: 0.46, pw: 1.2 }) });
    out.push({ z: 0.7, c: 'blue', pts: strand(env, { x: r2[0], y: r2[1], len: 20, n: 9, a0: -0.3, da, curl: 0.24, cp: 2, wp: 0.8, lift: 0.9, amp: 0.32, seed: 2.2, w0: 1.4, w1: 1.1, tip: 'cut', twist: 0.55, back: -1, backK: 0.6, amax: 0.35, f: 0.53, pw: 1.2 }) });
  }
  const Y_SIDE_SNOW = [{ pts: [[-5.0, -98.2], [-2.6, -100.6], [0.4, -100.9], [2.7, -100.0]], th: 1.2 }, { pts: [[-4.6, -83.6], [-2.0, -84.6], [1.2, -84.3], [3.6, -82.6]], th: 1.3 }];

  // 侧影背剑：与老者同样的斜角——剑柄从肩后、后脑之外探出，剑鞘斜过后背到腰臀（画在身体和手臂之间）
  const SW_P = [-10.5, -95.0], SW_G = [-8.6, -86.5], SW_T = [-3.5, -50.0];
  def('youth', 'standBack', () => youthBackBuild());
  def('youth', 'standSide', () => {
    const parts = [], folds = Y.sideFolds.slice();
    const H = HTF(0);
    youthSideHead(parts, folds, H);
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 1.4, pts: Y.sideBody });
    parts.push({ z: 3, c: 'body', sep: 0.7, pts: Y.arm }, { z: 3, c: 'body', pts: Y.hand });
    parts.push({ z: 2, c: 'body', pts: Y.boot });
    // 背剑：剑鞘贴着后背轮廓（约一半宽压在背上，用衣褶色细线分开，不留透底的缝），护手在后颈、鞘尾在臀后
    parts.push(...sword(SW_P, SW_G, SW_T, 2.05, { sep: 0.6, ws: 2.4, wt: 2.0 }));
    folds.push({ z: 3, pts: [[0.6, -79.5], [1.0, -70.0], [2.2, -61.0]], w: 0.45 });
    return {
      parts, folds, snow: Y_SIDE_SNOW,
      dyn(env, out) {
        youthSideHair(env, out, H);
        // 剑穗：系在护手靠后的一端，顺着剑鞘外缘垂下（压在鞘上，不与鞘之间留窄缝）；有风时向身后飘
        out.push({ z: 2.1, c: 'blue', pts: strand(env, { x: SW_G[0] - 1.4, y: SW_G[1] + 0.1, len: 7.5, n: 6, a0: -0.03, lift: 0.5, amp: 0.35, seed: 3.7, w0: 0.85, w1: 0.55, tip: 'round', back: -1, amax: 0.05, f: 0.6 }) });
      },
    };
  });

  // ---- 背影：宽肩窄腰，双臂垂在身侧（臂与腰之间不留碎缝，用淡色细线分开），长衫下摆略外扩；能看见一截后颈 ----
  Y.backHead = sym([[0, -100.4], [3.0, -99.6], [4.7, -97.2], [5.15, -94.2], [5.45, -92.6], [5.15, -90.9], [4.1, -89.9], [2.75, -89.15], [0, -88.85]]);
  Y.backBody = sym([
    [0, -90.6], [2.35, -90.4], [2.5, -87.6], [3.3, -85.8], [5.8, -84.6], [9.4, -83.3], [11.8, -82.0], [12.9, -79.6],
    [13.1, -74.5], [12.8, -68.0], [12.5, -62.5], [12.4, -57.0], [12.9, -52.6, 1], [10.5, -51.6, 1], [10.4, -49.6, 0, 0.1],
    [11.1, -42, 0, 0.22], [12.5, -24, 0, 0.55], [13.9, -5.0, 1, 0.95], [7.0, -4.3, 0, 1.0], [0, -4.6, 0, 1.0],
  ]);
  Y.backHand = [[10.2, -53.4], [12.75, -53.4], [12.9, -52.4], [12.8, -50.0], [12.45, -47.0], [11.7, -45.0], [10.8, -45.3], [10.3, -48.2]];
  Y.backBoot = [[2.2, -6.0], [6.0, -6.0], [6.3, -2.4], [6.5, 0, 1], [1.7, 0, 1], [1.9, -2.0]];
  Y.backFolds = [
    { pts: [[-11.0, -64.6], [11.0, -64.6]], w: 2.0, flat: 1 },
    { pts: [[0, -82], [0, -66]], w: 0.5 },
    { pts: [[-3.2, -60], [-4.4, -34], [-5.6, -6]], w: 0.6 },
    { pts: [[3.0, -60], [4.2, -34], [5.4, -6]], w: 0.6 },
    { pts: [[-8.6, -46], [-10.4, -20]], w: 0.5 },
    { pts: [[8.6, -46], [10.2, -20]], w: 0.5 },
    // 手臂内侧与腰之间的分界
    { pts: [[9.7, -76.0], [10.1, -68.0], [10.3, -60.0], [10.5, -53.0]], w: 0.55 },
    { pts: [[-9.7, -76.0], [-10.1, -68.0], [-10.3, -60.0], [-10.5, -53.0]], w: 0.55 },
    { pts: [[6.2, -82.0], [8.4, -78.0], [8.8, -72.0]], w: 0.45 },
    { pts: [[-6.2, -82.0], [-8.4, -78.0], [-8.8, -72.0]], w: 0.45 },
  ];
  const Y_BACK_SNOW = [{ pts: [[-12.8, -80.0], [-9.6, -83.4], [-6, -84.8], [-3.4, -85.9]], th: 1.6 }, { pts: [[3.4, -85.9], [6, -84.8], [9.6, -83.4], [12.8, -80.0]], th: 1.6 }, { pts: [[-4.8, -97.3], [-3.0, -99.7], [-1.4, -100.4]], th: 1.1 }, { pts: [[1.4, -100.4], [3.0, -99.7], [4.8, -97.3]], th: 1.1 }, { pts: [[-2.0, -102.8], [0, -103.3], [2.0, -102.8]], th: 0.9 }];
  function youthBackBuild() {
    const parts = [];
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 1.3, pts: Y.backBody });
    parts.push({ z: 2, c: 'body', pts: Y.backHand }, { z: 2, c: 'body', pts: mirror(Y.backHand) });
    parts.push({ z: 1.9, c: 'body', pts: Y.backBoot }, { z: 1.9, c: 'body', pts: mirror(Y.backBoot) });
    // 背上的剑：剑柄从右肩后探出，剑鞘斜过后背；与身体之间用淡色细线分开。护手正好落在肩线上（剑鞘不在肩上冒出一截，
    // 肩头的轮廓光不会在剑鞘与护手之间绕出锯齿），肩线以上只有细的护手和剑柄
    parts.push(...sword([13.1, -92.9], [8.9, -84.4], [-11.4, -44.6], 3, { c: 'body', sep: 0.8 }));
    parts.push({ z: 4, c: 'hairD', pts: Y.backHead });
    parts.push({ z: 4, c: 'hairD', pts: ell(0, -101.3, 2.15, 1.75, 0, 10) });
    parts.push({ z: 5, c: 'blue', pts: band([[-2.2, -100.5], [0, -100.05], [2.2, -100.5]], 1.0) });
    const folds = Y.backFolds.slice();
    folds.push({ z: 4, c: 'hairD', pts: [[-2.8, -89.6], [-3.6, -94.0], [-2.2, -98.6]], w: 0.35 }, { z: 4, c: 'hairD', pts: [[2.8, -89.6], [3.6, -94.0], [2.2, -98.6]], w: 0.35 });
    return {
      parts, folds, snow: Y_BACK_SNOW,
      dyn(env, out) {
        // 马尾垂在后颈，发带两尾顺风飘（与侧影同样的风吹出同样的弯度）
        out.push({ z: 4.1, c: 'hairD', pts: strand(env, { x: 0, y: -101.0, len: 18, n: 8, a0: 0, lift: 0.3, amp: 0.12, seed: 1.1, w0: 3.2, w1: 0.8, tip: 'point', f: 0.38 }) });
        out.push({ z: 5, c: 'blue', pts: strand(env, { x: -0.8, y: -100.2, len: 23, n: 10, a0: -0.12, wp: 0.8, lift: 1.0, amp: 0.34, seed: 0.3, w0: 1.4, w1: 1.15, tip: 'cut', twist: 0.55, f: 0.46, pw: 1.2 }) });
        out.push({ z: 5, c: 'blue', pts: strand(env, { x: 0.9, y: -100.2, len: 19, n: 9, a0: 0.12, wp: 0.8, lift: 0.95, amp: 0.34, seed: 2.2, w0: 1.4, w1: 1.1, tip: 'cut', twist: 0.55, f: 0.53, pw: 1.2 }) });
        // 剑穗：系在剑首，在身后
        out.push({ z: 1.5, c: 'blue', pts: strand(env, { x: 13.4, y: -93.3, len: 7.5, n: 6, a0: 0.15, lift: 0.6, amp: 0.35, seed: 3.7, w0: 0.85, w1: 0.55, tip: 'round', f: 0.6 }) });
      },
    };
  }

  // ---- 侧影举剑指天：上臂前举、小臂竖起，剑在面前直指天空；头微仰看剑。侧脸的额、鼻、唇、下巴都在臂后露出；
  //      外衫的宽袖从肘下垂成一道弧；背上只剩剑鞘 ----
  Y.upArm = [
    [-3.4, -79.6], [-2.6, -82.4], [2.6, -86.0], [7.6, -89.4], [10.8, -91.8], [12.2, -95.6], [13.0, -100.0], [13.7, -104.6],
    [16.6, -104.4], [16.1, -99.6], [15.5, -94.2], [15.4, -90.2], [14.6, -88.6], [12.0, -87.4], [7.0, -84.0], [2.4, -80.6], [0.0, -78.0],
  ];
  Y.upDrape = [[14.6, -88.6], [14.0, -85.8, 0, 0.4], [12.4, -82.8, 0, 0.8], [9.8, -81.4, 0, 0.9], [6.8, -81.0, 0, 0.6], [3.8, -80.8, 0, 0.2], [2.0, -81.0], [7.0, -84.2], [12.0, -87.6]];
  Y.upFist = [[13.4, -104.9], [16.8, -104.6], [17.7, -106.6], [17.5, -109.2], [15.9, -110.2], [13.9, -109.9], [13.1, -108.0]];
  // 远侧手臂垂在身后
  Y.upFar = [[-3.6, -80.6], [-0.6, -80.8], [-1.4, -70.0], [-3.2, -60.0], [-5.4, -52.8], [-6.6, -48.0], [-8.4, -47.4], [-8.6, -51.6], [-6.8, -60.0], [-5.2, -70.0]];
  def('youth', 'swordUp', () => {
    const parts = [], folds = Y.sideFolds.slice(0, 3);
    const tilt = -0.28, H = HTF(tilt);
    youthSideHead(parts, folds, H);
    parts.push({ z: 1.5, c: 'body', cls: 'shade', sh: 1, pts: Y.upFar });
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 1.4, pts: Y.sideBody });
    parts.push({ z: 2, c: 'body', pts: Y.boot });
    // 举起的手臂压在胸前（淡色细线分开），宽袖从肘下垂
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: Y.upDrape });
    parts.push({ z: 3.1, c: 'body', sep: 0.6, pts: Y.upArm }, { z: 3.1, c: 'body', pts: Y.upFist });
    // 剑：护手在拳上，剑身略前倾指天
    const gx = 15.9, gy = -110.5, ux = 0.1, uy = -0.995, L = 38;
    parts.push({ z: 3.05, c: 'body', pts: ell(gx, gy, 2.2, 0.72, 0.1, 10) });
    parts.push({ z: 2.5, c: 'blade', pts: [[gx - 0.62, gy, 1], [gx + 0.62, gy + 0.06, 1], [gx + ux * L + 0.32, gy + uy * L + 2.2], [gx + ux * L, gy + uy * L, 1], [gx + ux * L - 0.36, gy + uy * L + 2.2]] });
    // 背上空鞘：中线贴在后背轮廓上，一半宽压在背上，用细线分开
    parts.push({ z: 2.05, c: 'obj', sep: 0.6, pts: rod([-4.4, -84.0], [-8.0, -48.0], 2.1, 1.7, false, true) });
    parts.push({ z: 2.05, c: 'obj', sep: 0.6, pts: ell(-4.35, -84.5, 1.4, 0.8, -0.1, 8) });
    folds.push({ z: 3.1, pts: [[1.0, -82.6], [6.6, -86.4], [11.4, -89.6]], w: 0.4 }, { z: 3, pts: [[13.2, -86.0], [10.6, -83.0], [6.6, -82.0]], w: 0.4 });
    return {
      parts, folds,
      snow: [{ pts: H([[-4.6, -9.8], [-2.3, -11.8], [0.7, -12.2], [2.9, -11.5]]), th: 1.0 }, { pts: [[-6.2, -82.4], [-4.8, -83.4], [-3.2, -84.0]], th: 1.0 }],
      dyn(env, out) {
        youthSideHair(env, out, H, tilt);
        // 剑穗：系在拳下剑首上，顺着小臂内侧垂在小臂前面（不贴着小臂外缘，免得和轮廓光挤在一起）
        out.push({ z: 3.2, c: 'blue', pts: strand(env, { x: 14.9, y: -104.4, len: 7.5, n: 6, a0: -0.16, lift: 0.4, amp: 0.3, seed: 3.7, w0: 0.9, w1: 0.55, tip: 'round', f: 0.6, amin: -0.5, amax: 0.05 }) });
      },
    };
  });

  // ---- 侧影仰头大笑：头后仰，双臂向两侧微张，斗篷从肩头被风扯向身后 ----
  // 近侧臂向前下方；腋下用圆弧收口，不留尖缝
  Y.laughArmN = [
    [-2.0, -82.6], [3.0, -83.0], [8.4, -73.6], [12.6, -66.0], [16.0, -59.4], [17.6, -57.0], [17.2, -54.8],
    [15.6, -53.8, 0, 0.12], [13.4, -54.8, 0, 0.55], [11.4, -57.4, 0, 0.7], [9.8, -60.2, 0, 0.3], [8.4, -62.2], [7.0, -63.6], [5.5, -64.3], [4.3, -65.6], [3.4, -70.0], [3.2, -74.6], [1.0, -77.2],
  ];
  Y.laughHandN = [[15.0, -57.6], [17.8, -58.6], [19.5, -57.0], [20.2, -54.4], [19.8, -51.9], [18.6, -50.8], [17.2, -51.2], [16.0, -52.6], [14.6, -54.4]];
  // 远侧臂向后下方（在身后）
  Y.laughArmF = [
    [-1.4, -83.4], [-4.8, -81.6], [-7.6, -76.0], [-11.0, -68.6], [-14.0, -61.8], [-15.6, -58.0], [-14.8, -55.6],
    [-13.4, -55.0, 0, 0.6], [-11.6, -57.2, 0, 1], [-10.0, -61.4, 0, 0.5], [-7.4, -64.6], [-5.3, -67.6], [-4.8, -70.4], [-4.5, -73.6], [-4.3, -77.0],
  ];
  Y.laughHandF = [[-14.4, -58.0], [-17.0, -58.8], [-18.7, -57.2], [-19.4, -54.6], [-19.0, -52.1], [-17.8, -51.1], [-16.4, -51.6], [-15.2, -53.0], [-13.8, -54.8]];
  // 斗篷：若干根“布肋”从肩头的固定锚点垂下，各自受风吹起并带相位差地起伏；无风时贴着后背垂下（只比后背多出一点厚度），
  // 风越大掀得越高（上沿在风力 0.6 时约 50–60°），下沿是穿过各肋末端、向外微鼓的圆弧，肋间只有很浅的褶波，没有尖角
  function cloak(env, out, roots, lens, o) {
    const n = roots.length, sh = o.sh || 0;
    const gu = gust(env, 0.4), wl = o.wl * gu, fw = o.fw == null ? null : o.fw * gu;
    const ribs = roots.map((r, i) => {
      const u = i / (n - 1);
      return bchain(env, r[0], r[1], lens[i], 10, {
        wl, fw, a0: lerp(o.a0top, o.a0bot, u), a1: lerp(o.a1top, o.a1bot, u), lift: lerp(o.liftTop, o.liftBot, u),
        amp: o.amp, ph: o.ph + u * 1.1, idle: 0.025, lag: 0.7, fq: 1.0, lim: 1.4, limEnd: 1.15, rp: o.rp,
      });
    });
    let cx = 0, cy = 0;
    for (const r of roots) { cx += r[0] / n; cy += r[1] / n; }
    const hem = [];
    for (let i = 0; i < n - 1; i++) {
      const A = ribs[i][10], B = ribs[i + 1][10];
      if (i > 0) hem.push([A[0], A[1]]);
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      let nx = B[1] - A[1], ny = A[0] - B[0];
      if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
      const bulge = 0.07 + 0.025 * Math.sin(TAU * 0.31 * env.t + i * 1.7);
      hem.push([mx + nx * bulge, my + ny * bulge]);
    }
    const top = ribs[0], bot = ribs[n - 1];
    const pts = top.map((q, i) => [q[0], q[1], i === 0 ? 1 : 0]).concat(hem, bot.slice().reverse().map((q, i, arr) => [q[0], q[1], i === arr.length - 1 ? 1 : 0]));
    out.push({ z: o.z, c: 'body', cls: 'shade', sh, pts });
    out.push({ fold: 1, z: o.z, c: 'body', cls: 'shade', sh, pts: ribs[1].slice(4, 10), w: 0.45 }, { fold: 1, z: o.z, c: 'body', cls: 'shade', sh, pts: ribs[n - 2].slice(3, 10), w: 0.45 });
  }
  def('youth', 'laughSide', () => {
    const parts = [], folds = Y.sideFolds.slice(0, 3);
    const tilt = -0.45, H = HTF(tilt);
    youthSideHead(parts, folds, H, true);
    // 远侧臂伸向身后，被斗篷的近侧一半挡住（只在斗篷外缘露出）
    parts.push({ z: 0.4, c: 'body', cls: 'shade', sh: 1, dyn: 1, pts: Y.laughArmF }, { z: 0.4, c: 'body', cls: 'shade', sh: 1, pts: Y.laughHandF });
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 1.4, pts: Y.sideBody });
    parts.push({ z: 2, c: 'body', pts: Y.boot });
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: Y.laughArmN }, { z: 3, c: 'body', pts: Y.laughHandN });
    folds.push({ z: 3, pts: [[1.4, -79.6], [6.2, -71.0], [11.0, -62.4]], w: 0.45 });
    return {
      parts, folds,
      snow: [{ pts: H([[-4.6, -9.8], [-2.3, -11.8], [0.7, -12.2], [2.9, -11.5]]), th: 1.1 }, { pts: [[-4.8, -83.8], [-2.0, -85.0], [1.6, -84.6]], th: 1.3 }],
      dyn(env, out) {
        // 斗篷（在身后）：风从背后来时被压向后背（只前倾一点点，不翻到身前，也不整片藏进身体轮廓），但下摆随风抖动，
        // 抖动幅度跟风力走；上沿从领口越过肩头向后、很快转成下垂；内沿（最后一根肋）藏在后背轮廓里，无风时斗篷外缘离后背 3–5 个单位
        const wb = Math.max(env.w, 0);
        cloak(env, out, [[0.6, -86.0], [-0.4, -85.6], [-1.2, -85.0], [-1.9, -84.2], [-2.5, -83.0]], [62, 59, 56, 53, 50], {
          z: 0.5, sh: 1, wl: env.w < 0 ? env.w : 0.04 * wb, fw: env.w < 0 ? null : 0.5 * wb, a0top: -0.9, a0bot: -0.05, a1top: -0.03, a1bot: 0.04, rp: 0.4, liftTop: 1.2, liftBot: 0.6, amp: 0.2, ph: 0.4,
        });
        youthSideHair(env, out, H, tilt);
      },
    };
  });

  // ---- 船上仰卧：头朝人物前方，草帽盖在脸上；近侧腿屈膝立起（长衫从膝头垂下），远侧腿伸直；
  //      一臂枕在脑后，一手扶着立在胸口的葫芦；马尾和发带铺在船板上。原点是臀下船板面 ----
  Y.lieBody = [
    [36.0, -5.2], [34.0, -11.6], [28.0, -13.4], [20.0, -13.2], [13.0, -11.6], [6.0, -10.4], [0, -9.8], [-10.0, -8.8],
    [-20.0, -7.6], [-30.0, -6.4], [-38.0, -5.6], [-42.0, -5.0], [-42.4, -0.2, 1], [-20, 0], [0, 0], [20, 0], [40.0, -0.2, 1],
  ];
  Y.lieLeg = [
    [6.0, -10.4], [-4.0, -16.6], [-12.4, -22.8], [-16.0, -25.0], [-19.6, -23.4], [-23.4, -14.0], [-26.0, -5.2, 1],
    [-24.0, -2.8, 0, 0.3], [-21.0, -0.4, 1, 0.4], [-12.0, -0.6, 0, 0.6], [-4.0, -0.4], [4.0, -0.4],
  ];
  // 伸直那条腿的脚：脚跟着船板，脚尖朝上并微微外撇（约 12 个单位高）
  Y.lieFootF = [[-41.2, -5.0], [-42.4, -6.6], [-43.5, -9.0], [-44.5, -11.2], [-45.6, -12.3], [-46.9, -12.0], [-47.6, -10.4], [-47.7, -6.2], [-47.4, -2.6], [-46.4, 0, 1], [-41.0, 0, 1]];
  Y.lieShoe = [[-21.6, -5.6], [-25.8, -5.4], [-27.2, -3.6], [-31.8, -2.2], [-33.2, -1.0], [-33.4, -0.1, 1], [-20.6, 0, 1], [-20.4, -2.6]];
  Y.lieNeck = [[32.0, -12.8], [36.4, -11.6], [39.6, -10.6], [40.4, -4.0], [42.0, -0.6], [45.0, -0.1, 1], [32.0, 0, 1]];
  Y.strawHat = [
    [-12.6, 0.6, 1], [-9.6, -0.5], [-6.2, -1.3], [-5.8, -4.4], [-4.2, -6.6], [-1.4, -7.6], [1.6, -7.6], [4.4, -6.6], [6.0, -4.4], [6.4, -1.3],
    [9.8, -0.5], [12.6, 0.6, 1], [9.6, 1.0], [0, 1.3], [-9.6, 1.0],
  ];
  def('youth', 'lieBoat', () => {
    const parts = [], folds = [];
    const HT = (pts) => shift(rot(pts, 0, 0, -0.06), 42.6, -10.8);
    parts.push({ z: 1, c: 'body', pts: Y.lieFootF });
    parts.push({ z: 1.2, c: 'body', pts: Y.lieBody });
    parts.push({ z: 1.3, c: 'body', pts: Y.lieNeck }, { z: 1.3, c: 'body', pts: ell(44.6, -5.4, 7.0, 5.4, 0, 14) });
    parts.push({ z: 1.4, c: 'hairD', pts: ell(50.6, -4.4, 1.9, 1.7, 0, 10) });
    // 枕在脑后的手臂：上臂向头顶方向抬起，肘尖翘在头后
    parts.push({ z: 1.5, c: 'body', pts: taper([[31.0, -9.0], [42.0, -12.2], [52.4, -13.6]], (u) => 4.8 - u * 1.0, 'round') });
    parts.push({ z: 1.5, c: 'body', pts: taper([[52.4, -13.6], [50.6, -7.8], [46.6, -2.4]], (u) => 3.8 - u * 0.6, 'round') });
    parts.push({ z: 1.5, c: 'body', pts: ell(52.2, -13.4, 2.0, 1.9, 0, 10) }, { z: 1.5, c: 'body', pts: ell(50.4, -10.2, 2.6, 2.4, 0, 10) });
    // 草帽盖在脸上
    parts.push({ z: 1.8, c: 'straw', pts: HT(Y.strawHat) });
    folds.push({ z: 1.8, c: 'straw', pts: HT([[-6.0, -1.6], [0, -2.8], [6.2, -1.6]]), w: 0.4 }, { z: 1.8, c: 'straw', pts: HT([[-5.4, -4.6], [0, -5.8], [5.6, -4.6]]), w: 0.4 });
    // 屈起的腿：长衫从膝头垂下
    parts.push({ z: 2, c: 'body', pts: Y.lieShoe });
    parts.push({ z: 2.1, c: 'body', dyn: 1, sep: 0.6, pts: Y.lieLeg });
    // 扶葫芦的手臂与胸口的葫芦
    parts.push({ z: 2.4, c: 'body', sep: 0.6, pts: taper([[32.0, -6.0], [24.6, -3.4], [22.4, -6.0], [24.8, -15.0]], (u) => 3.6 - u * 0.6, 'round') });
    const gs = 1.2, LIE_HAND = [[23.2, -16.6], [25.8, -17.4], [26.9, -15.2], [25.6, -13.2], [23.4, -13.5]];
    folds.push({ z: 1.2, pts: [[30, -6.4], [16, -6.0], [4, -5.6]], w: 0.5 }, { z: 2.1, pts: [[-2, -14.0], [-8, -17.4], [-13, -21.6]], w: 0.5 }, { z: 2.1, pts: [[-14, -3.2], [-6, -2.6]], w: 0.45 });
    return {
      parts, folds, breathPh: 1.9, breathA: 0,
      snow: [{ pts: HT([[-5.8, -4.6], [-4.2, -6.8], [-1.4, -7.8], [1.6, -7.8], [4.4, -6.8], [6.0, -4.6]]), th: 1.0 }, { pts: [[-12.4, -23.0], [-16.0, -25.2], [-19.6, -23.6]], th: 1.0 }, { pts: [[6, -10.6], [13, -11.8], [20, -13.4]], th: 0.9 }],
      dyn(env, out) {
        // 躺着不做整体的呼吸缩放：胸口的葫芦和扶着它的手随呼吸轻轻起落（约 0.3 个单位，周期 3.6 秒）
        const by = -0.3 * (0.5 + 0.5 * Math.sin((TAU * env.t) / 3.6 + 1.9));
        out.push({ z: 2.5, c: 'gourd', pts: gourdStand(26.2, -13.0 + by, gs) }, { z: 2.6, c: 'body', pts: gourdStandTie(26.2, -13.0 + by, gs) });
        out.push({ z: 2.7, c: 'body', pts: shift(LIE_HAND, 0, by) });
        // 马尾和发带顺着船板向头顶方向铺开（压在船板上，不会钻到板下）
        const flat = (pts) => pts.map((q) => [q[0], Math.min(q[1], -0.5)]);
        const tail = flat(bchain(env, 50.0, -4.2, 15, 7, { a0: 1.2, a1: 1.9, lift: 0.3, amp: 0.1, ph: 0.3, idle: 0.02 }));
        out.push({ z: 0.5, c: 'hairD', cls: 'thin', pts: taper(tail, (u) => 3.0 * (1 - u) + 0.6, 'round') });
        const r1 = flat(bchain(env, 50.4, -5.0, 16, 7, { a0: 1.0, a1: 1.7, lift: 0.6, amp: 0.3, ph: 1.4, idle: 0.04 }));
        out.push({ z: 0.6, c: 'blue', pts: taper(r1, (u) => 1.25 - u * 0.3, 'round') });
        const r2 = flat(bchain(env, 50.0, -3.6, 13, 6, { a0: 1.15, a1: 1.8, lift: 0.55, amp: 0.3, ph: 3.0, idle: 0.04 }));
        out.push({ z: 0.6, c: 'blue', pts: taper(r2, (u) => 1.15 - u * 0.25, 'round') });
      },
    };
  });

  // ======================================================================
  // 白发老者 old：白发挽髻、几缕散发、蓝色旧发带、微驼、长衫、背剑、腰挂葫芦（约 7 头身）
  // ======================================================================
  ACCENT.old = 'blue';
  const O = {};
  // ---- 背影 ----
  O.headBack = sym([[0, -98.3], [3.4, -97.6], [5.35, -95.3], [5.85, -92.2], [6.2, -90.9], [6.05, -89.2], [5.45, -88.4], [4.5, -86.4], [2.6, -85.2], [0, -84.9]]);
  O.torsoBack = sym([[0, -86.6], [3.6, -86.3], [6.9, -85.2], [9.6, -83.5], [11.5, -81.3], [12.4, -78.6], [11.6, -74], [10.8, -68], [10.1, -62.5], [10.2, -58.5], [10.55, -50, 0, 0.1], [11.0, -38, 0, 0.25], [11.5, -24, 0, 0.5], [12.0, -11, 0, 0.8, 0.3], [12.4, -1.8, 1, 1.0, 0.6], [9.4, -1.0, 0, 1.0, 1.0], [4.8, -1.35, 0, 0.9, 1.4], [0, -1.0, 0, 0.8, 1.9]]);
  O.shoeBack = [[2.0, -2.6], [6.6, -2.6], [6.8, -0.7], [6.5, 0, 1], [2.4, 0, 1], [2.1, -0.7]];
  // 背手：两袖在腰后相握，袖口下垂成两片，V 形袖口低于腰带
  // 袖子的外缘接着肩线的斜度往下走（袖顶压在肩线以内），肩与上臂之间没有凸起的台阶
  O.armsBack = sym([[0, -61.2], [4.8, -61.7], [9.9, -63.3, 1], [10.4, -68.5], [10.2, -75.5], [10.6, -79.8], [11.2, -81.4], [12.6, -79.7], [13.7, -77.2], [14.4, -71.2], [14.3, -65.6], [13.6, -61.8], [11.4, -59.2], [8.6, -57.6], [7.3, -55.4, 0, 0.3, 0.2], [6.0, -52.8, 0, 0.5, 0.6], [3.6, -51.0, 0, 0.7, 1.0], [1.4, -50.2, 0, 0.8, 1.4], [0, -49.5, 1, 0.8, 1.7]]);
  O.hairBackFolds = [
    { z: 4, c: 'hair', pts: [[-3.9, -86.6], [-3.1, -91.5], [-1.3, -97.0]], w: 0.45 },
    { z: 4, c: 'hair', pts: [[0, -85.6], [0, -91], [0, -97.2]], w: 0.4 },
    { z: 4, c: 'hair', pts: [[3.9, -86.6], [3.1, -91.5], [1.3, -97.0]], w: 0.45 },
    { z: 4, c: 'hair', pts: [[-5.5, -90.5], [-4.6, -94.3], [-2.6, -97.2]], w: 0.4 },
    { z: 4, c: 'hair', pts: [[5.5, -90.5], [4.6, -94.3], [2.6, -97.2]], w: 0.4 },
  ];
  // 散发：耳后两侧各垂下一两缕短而软的发丝，根部压在头部轮廓上（不从后颈中间垂到深色的背上），末端圆收
  O.hairStrandsBack = (env, out, dx, dy) => {
    dx = dx || 0; dy = dy || 0;
    out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: -5.3 + dx, y: -89.4 + dy, len: 4.6, n: 6, a0: 0.06, wave: 0.16, lift: 0.4, amp: 0.25, seed: 0.7, w0: 0.85, w1: 0.45, tip: 'round', f: 0.5 }) });
    out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: -4.7 + dx, y: -88.0 + dy, len: 3.5, n: 5, a0: 0.12, wave: -0.12, lift: 0.4, amp: 0.25, seed: 3.3, w0: 0.7, w1: 0.4, tip: 'round', f: 0.47 }) });
    out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: 5.3 + dx, y: -89.2 + dy, len: 4.0, n: 6, a0: -0.06, wave: -0.16, lift: 0.4, amp: 0.25, seed: 1.9, w0: 0.8, w1: 0.42, tip: 'round', f: 0.56 }) });
  };
  O.bandBack = [[-2.95, -98.7], [0, -99.05], [2.95, -98.7], [2.85, -97.55], [0, -97.25], [-2.85, -97.55]];
  // 葫芦：挂在胯侧，绕系绳点小幅摆动
  function hangGourd(env, out, ax, ay, gx, gy, s, z, seed) {
    const a = -0.07 * env.w + 0.035 * sway(env, 1, seed || 0, 0.55);
    const c = Math.cos(a), sn = Math.sin(a);
    const R = (x, y) => [ax + (x - ax) * c - (y - ay) * sn, ay + (x - ax) * sn + (y - ay) * c];
    const g0 = R(gx, gy);
    out.push({ z, c: 'gourd', pts: gourd(g0[0], g0[1], s, a) });
    out.push({ z: z + 0.1, c: 'body', pts: gourdTie(g0[0], g0[1], s, a) });
    out.push({ z: z + 0.1, c: 'body', cls: 'thin', pts: rod([ax, ay], [g0[0], g0[1] + 0.3], 0.55, 0.5) });
  }

  def('old', 'standBack', () => {
    const parts = [];
    parts.push({ z: 2, c: 'body', dyn: 1, pts: O.torsoBack });
    parts.push({ z: 1.9, c: 'body', pts: O.shoeBack }, { z: 1.9, c: 'body', pts: shift(mirror(O.shoeBack), 0.4, 0) });
    // 护手落在肩线上：肩线以上只有细的护手和剑柄
    parts.push(...sword([12.1, -93.5], [8.6, -84.8], [-11.8, -47.0], 2.5, { c: 'body', sep: 0.8 }));
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.8, pts: O.armsBack });
    parts.push({ z: 4, c: 'hair', pts: O.headBack }, { z: 4, c: 'hair', pts: ell(0, -99.3, 2.9, 2.3, 0, 10) });
    parts.push({ z: 5, c: 'blue', pts: O.bandBack });
    const folds = O.hairBackFolds.concat([
      { pts: [[0, -84], [0.2, -74], [0, -64]], w: 0.5 },
      { pts: [[3.6, -56], [4.4, -38], [5.2, -20], [5.6, -3]], w: 0.8 },
      { pts: [[-3.8, -56], [-4.6, -38], [-5.8, -3]], w: 0.8 },
      { pts: [[8.8, -56], [9.8, -36], [11.2, -4]], w: 0.65 },
      { pts: [[-8.8, -56], [-9.8, -36], [-11.2, -4]], w: 0.65 },
      { pts: [[5.5, -83.5], [7.8, -79], [8.2, -71]], w: 0.55 },
      { pts: [[-5.5, -83.5], [-7.8, -79], [-8.2, -71]], w: 0.55 },
      { z: 3, pts: [[12.4, -79], [12.8, -71], [12.4, -63.5]], w: 0.45 },
      { z: 3, pts: [[-12.4, -79], [-12.8, -71], [-12.4, -63.5]], w: 0.45 },
      { z: 3, pts: [[0.2, -59.6], [0.1, -55.0], [0.0, -50.6]], w: 0.45 },
      { z: 3, pts: [[4.6, -57.8], [3.6, -54.6], [2.4, -51.6]], w: 0.4 },
      { z: 3, pts: [[-4.6, -57.8], [-3.6, -54.6], [-2.4, -51.6]], w: 0.4 },
    ]);
    return {
      parts, folds,
      snow: [{ pts: [[-12.0, -80.0], [-9.6, -83.4], [-6.0, -85.3], [-3.0, -86.2]], th: 1.7 }, { pts: [[3.0, -86.2], [6.0, -85.3], [9.6, -83.4], [12.0, -80.0]], th: 1.7 }, { pts: [[-5.3, -95.2], [-3.4, -97.6], [-1.6, -98.2]], th: 1.1 }, { pts: [[1.6, -98.2], [3.4, -97.6], [5.3, -95.2]], th: 1.1 }, { pts: [[-2.6, -100.6], [0, -101.6], [2.6, -100.6]], th: 0.9 }],
      dyn(env, out) {
        O.hairStrandsBack(env, out);
        // 系在肘下袖缘（腰带位置），绳子自然下垂
        hangGourd(env, out, 12.5, -60.4, 12.5, -57.3, 0.95, 6, 0.4);
      },
    };
  });

  // ---- 侧影（朝右）----
  O.headSide = [[-3.6, -87.0], [-4.4, -90.6], [-3.6, -94.8], [-1.2, -97.8], [2.0, -98.6], [5.0, -97.2], [7.0, -94.6], [7.65, -92.2], [7.55, -91.1], [9.0, -88.9, 1], [8.05, -88.2], [8.35, -87.35], [7.95, -86.7], [8.15, -86.0], [7.6, -84.9], [5.8, -83.9], [3.8, -83.7], [3.2, -82.6]];
  O.neckSide = [[5.0, -83.6], [4.2, -81.4], [3.0, -79.6], [-4.6, -81.2], [-2.6, -84.2], [-1.6, -86.8]];
  O.hairCap = [[6.15, -96.0], [4.4, -97.95], [1.8, -99.0], [-1.5, -98.25], [-4.0, -95.4], [-4.85, -91.4], [-4.35, -88.1], [-3.0, -86.4, 1], [-2.0, -88.6], [-0.5, -90.2], [0.9, -91.3], [2.3, -93.4], [3.9, -94.7], [5.7, -95.1]];
  // 白须：末端是软的圆梢（不是尖角）
  O.beard = [[4.6, -84.6], [6.2, -84.35], [7.6, -84.95], [8.15, -85.9], [8.35, -84.5], [8.2, -82.3], [7.8, -80.0], [7.35, -78.55], [6.9, -77.95], [6.45, -78.5], [6.05, -80.0], [5.3, -82.2]];
  O.moustache = [[7.25, -88.05], [8.1, -88.2], [8.7, -87.65], [8.95, -86.6], [8.5, -86.35], [7.8, -87.0]];
  O.torsoUpperSide = [[2.6, -81.2], [3.9, -79.4], [4.7, -75.8], [5.0, -71.0], [5.1, -65.5], [5.35, -60.5], [5.75, -55.5], [5.95, -50], [-7.6, -50], [-7.5, -53], [-6.9, -60], [-7.6, -65.0], [-8.5, -70.5], [-8.8, -75.5], [-8.0, -79.6], [-6.0, -82.6], [-4.6, -83.4]];
  O.robeSide = [[5.95, -50, 0, 0.05], [6.4, -36, 0, 0.25], [6.95, -22, 0, 0.5], [7.45, -10, 0, 0.7, 0.3], [7.75, -2.2, 1, 0.9, 0.6], [3.5, -1.3, 0, 0.9, 1.0], [-1.5, -1.0, 0, 0.9, 1.4], [-6.0, -1.3, 0, 1.0, 1.8], [-9.3, -2.0, 1, 1.0, 2.2], [-9.0, -12, 0, 0.7, 2.5], [-8.6, -24, 0, 0.4], [-8.1, -38, 0, 0.15], [-7.7, -48], [-7.4, -56], [5.5, -56]];
  // 背手：上臂向后下，肘部只比背线略凸（≤ 0.025 身高），手在腰后，袖口垂在手下
  O.armSide = [[1.2, -80.6], [0.6, -82.6], [-2.4, -83.0], [-5.4, -81.4], [-7.8, -77.2], [-9.1, -71.6], [-9.5, -66.4], [-9.3, -62.0], [-9.0, -58.4, 0, 0.3, 0.4], [-8.5, -54.6, 0, 0.6, 0.8], [-7.4, -53.0, 0, 0.7, 1.2], [-6.2, -54.0, 0, 0.5, 1.5], [-5.4, -57.2, 0, 0.2], [-4.5, -59.6], [-5.0, -62.0], [-6.3, -63.6], [-6.8, -65.8], [-5.4, -70.5], [-2.4, -75.5], [0.4, -77.6]];
  O.shoeFront = [[0.5, -2.6], [5.5, -2.6], [8.4, -1.6], [9.9, -0.6], [9.9, 0, 1], [0.0, 0, 1], [-0.2, -1.2]];
  // 斗笠（侧面，帽檐中点为原点）：竹篾的放射纹用极淡亮线
  const HAT_SIDE = [
    [-15.2, 0.5, 1], [-12.8, -0.7], [-8.4, -2.9], [-4.2, -5.0], [-1.5, -6.6], [0, -7.2], [1.5, -6.6], [4.2, -5.0],
    [8.4, -2.9], [12.8, -0.7], [15.2, 0.5, 1], [12.8, 1.0], [7.0, 0.8], [0, 0.9], [-7.0, 0.8], [-12.8, 1.0],
  ];
  const HAT_RIBS = [-10.5, -6.5, -2.8, 2.8, 6.5, 10.5].map((x) => [[0, -6.4], [x * 0.5, -3.4], [x, -0.1]]);
  // 老者驼背：头整体前探、略低头
  const HX = (pts) => rot(shift(pts, 1.6, 0.7), 4.6, -83.4, 0.07);
  const ID = (p) => p;
  // 头、须、发、手臂、剑（站立、行走、坐姿共用）；T 为整体点变换，opt.arm=false 时不画背手，opt.hat 戴斗笠
  function oldSideUpper(parts, folds, T, opt) {
    T = T || ID; opt = opt || {};
    const H = opt.H || ID; // 头部附加变换（垂头睡）
    const TH = (pts) => T(H(HX(pts)));
    parts.push({ z: 2, c: 'body', pts: TH(O.headSide) }, { z: 2, c: 'body', pts: T(opt.neck || O.neckSide) });
    if (opt.torso !== false) parts.push({ z: 2, c: 'body', pts: T(O.torsoUpperSide) });
    if (opt.sword !== false) parts.push(...sword(...T([[-10.8, -91.6], [-9.0, -82.3], [-3.2, -47.5]]), 1.5));
    if (opt.arm !== false) parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: T(O.armSide) });
    parts.push({ z: 4, c: 'hair', pts: TH(O.hairCap) }, { z: 4, c: 'hair', pts: TH(O.moustache) });
    if (opt.hat) {
      const HT = (pts) => TH(rot(shift(pts, 1.6, -94.4), 1.6, -94.4, -0.04));
      parts.push({ z: 5.5, c: 'straw', pts: HT(HAT_SIDE) }, { z: 5.5, c: 'straw', pts: HT(ell(0, -7.3, 0.9, 0.7, 0, 8)) });
      for (const r of HAT_RIBS) folds.push({ z: 5.5, c: 'straw', pts: HT(r), w: 0.32 });
    } else {
      parts.push({ z: 4, c: 'hair', pts: TH(ell(-0.9, -99.7, 2.85, 2.25, -0.45, 10)) });
      parts.push({ z: 5, c: 'blue', pts: TH(rot([[-3.9, -99.6], [-0.9, -100.05], [2.1, -99.6], [2.0, -98.45], [-0.9, -98.05], [-3.8, -98.45]], -0.9, -99.2, -0.45)) });
      folds.push(
        { z: 4, c: 'hair', pts: TH([[5.0, -96.6], [1.5, -97.6], [-1.8, -96.2], [-3.6, -92.5]]), w: 0.4 },
        { z: 4, c: 'hair', pts: TH([[3.6, -95.0], [0.5, -95.2], [-2.4, -92.2], [-3.4, -89.0]]), w: 0.4 },
      );
    }
    if (opt.torso !== false) folds.push(
      { pts: T([[-7.0, -60.4], [-1, -60.2], [5.3, -60.4]]), w: 0.85 },
      { pts: T([[3.2, -79], [4.0, -73], [3.6, -66]]), w: 0.5 },
    );
    if (opt.robeFolds !== false) folds.push(
      { pts: T([[2.6, -56], [3.3, -36], [4.2, -4]]), w: 0.75 },
      { pts: T([[-4.0, -55], [-5.2, -36], [-6.2, -4]]), w: 0.75 },
    );
    if (opt.arm !== false) folds.push(
      { z: 3, pts: T([[-2.0, -80.5], [-5.6, -74.5], [-8.2, -67.5]]), w: 0.5 },
      { z: 3, pts: T([[-8.8, -60.5], [-8.0, -56.4], [-7.6, -54.2]]), w: 0.4 },
    );
  }
  function oldSideDyn(env, out, T, opt) {
    T = T || ID; opt = opt || {};
    const H = opt.H || ID;
    const TP = (x, y) => T(H(HX([[x, y]])))[0];
    // 胡须末端随风轻摆（根部固定在下巴）
    // opt.beardDa：头部转过一个角度时，胡须末端在重力下回垂的角度（垂头睡时胡须顺着胸口垂下，不斜插进胸口）
    const ba = 0.05 * sway(env, 1, 0.9, 0.5) - 0.05 * env.w + (opt.beardDa || 0);
    const bp = TP(6.6, -84.8), r1 = TP(-3.7, -89.4), r2 = TP(-3.1, -92.2);
    const da = opt.da || 0; // 头部转角（让散发依旧下垂）
    out.push({ z: 4, c: 'hair', pts: rot(T(H(HX(O.beard))), bp[0], bp[1], ba) });
    // 耳后两缕散发：细、软、S 形，末端圆收
    out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: r1[0], y: r1[1], len: 7.2, n: 8, a0: -0.18 - da * 0.3, wave: 0.26, lift: 0.4, amp: 0.3, seed: 0.7, w0: 0.9, w1: 0.38, tip: 'round', back: -1, amax: 0.25, f: 0.5 }) });
    out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: r2[0], y: r2[1], len: 5.6, n: 7, a0: -0.42 - da * 0.3, wave: -0.22, lift: 0.4, amp: 0.3, seed: 1.9, w0: 0.8, w1: 0.34, tip: 'round', back: -1, amax: 0.2, f: 0.56 }) });
    if (opt.gourd !== false) { const a = T([[5.0, -59.8], [5.0, -56.9]]); hangGourd(env, out, a[0][0], a[0][1], a[1][0], a[1][1], 0.92, 6, 1.3); }
  }
  const OLD_SIDE_SNOW = [{ pts: HX([[-4.0, -95.4], [-1.5, -98.3], [1.8, -99.1], [4.4, -98.0], [6.1, -96.1]]), th: 1.3 }, { pts: [[-7.8, -79.8], [-6.0, -82.7], [-3.0, -83.6], [0.6, -82.8]], th: 1.4 }, { pts: HX([[-3.2, -101.2], [-0.9, -102.0], [1.4, -101.4]]), th: 0.8 }];
  const OLD_HAT_SNOW = [{ pts: HX(rot(shift([[-14.8, 0.2], [-8.4, -3.1], [-1.5, -6.8], [0, -7.4]], 1.6, -94.4), 1.6, -94.4, -0.04)), th: 1.3 }, { pts: HX(rot(shift([[0, -7.4], [1.5, -6.8], [8.4, -3.1], [14.8, 0.2]], 1.6, -94.4), 1.6, -94.4, -0.04)), th: 1.3 }, { pts: [[-7.8, -79.8], [-6.0, -82.7], [-3.0, -83.6], [0.6, -82.8]], th: 1.4 }];
  def('old', 'standSide', (v) => {
    const parts = [], folds = [];
    oldSideUpper(parts, folds, ID, { hat: v.hat });
    parts.push({ z: 2, c: 'body', dyn: 1, pts: O.robeSide });
    parts.push({ z: 2, c: 'body', pts: O.shoeFront });
    return { parts, folds, snow: v.hat ? OLD_HAT_SNOW : OLD_SIDE_SNOW, dyn: oldSideDyn };
  });

  def('old', 'walkSide', (v) => {
    const parts = [], folds = [];
    oldSideUpper(parts, folds, ID, { hat: v.hat });
    return {
      parts, folds, walk: 1, snow: v.hat ? OLD_HAT_SNOW : OLD_SIDE_SNOW,
      dyn(env, out) {
        oldSideDyn(env, out);
        robeWalk(env, out, { restF: 7.2, restB: -9.0, frontGap: 1.2, swingCover: 6.0, backGap: 0.6, hemY: -1.8, waistF: [5.6, -54], waistB: [-7.5, -53] });
      },
    };
  });

  // ---- 侧坐（石凳/台阶）：原点为臀下坐面，脚落在坐面下约 0.25 身高；葫芦立在凳面上、身后 ----
  const SEAT = (pts) => shift(rot(pts, -1, -50, 0.05), 1.0, 45.0);
  def('old', 'sitSide', (v) => {
    const parts = [], folds = [];
    oldSideUpper(parts, folds, SEAT, { arm: false, robeFolds: false, hat: v.hat });
    // 臀、大腿（衣摆覆盖）
    parts.push({ z: 2, c: 'body', pts: [[-6.4, -10], [-6.9, -4.8], [-5.6, -1.0], [-3.0, 0, 1], [10, 0], [17.0, -0.4], [21.4, -1.5], [24.3, -4.8], [24.2, -8.4], [22.2, -10.6], [14, -11.4], [8.8, -12.4], [6.6, -15.5], [0, -16]] });
    // 膝下垂落的前襟
    parts.push({ z: 2, c: 'body', dyn: 1, pts: [[20.6, -3.0], [24.2, -6.4], [25.0, 2], [25.35, 10, 0, 0.3], [25.6, 18.4, 1, 0.6, 0.3], [22.5, 19.1, 0, 0.7, 0.8], [19.3, 18.6, 1, 0.6, 1.2], [18.8, 10, 0, 0.3], [18.4, 1]] });
    // 小腿与鞋（远侧鞋略靠前）
    parts.push({ z: 2, c: 'body', pts: [[19.6, 15], [24.2, 15], [24.0, 21.5], [23.9, 22.6], [19.8, 22.6], [19.9, 21.0]] });
    const shoe = [[18.6, 22.0], [23.6, 21.8], [27.6, 23.0], [30.6, 24.2], [31.0, 25, 1], [18.2, 25, 1], [18.0, 23.6]];
    parts.push({ z: 2, c: 'body', pts: shoe }, { z: 1.9, c: 'body', pts: shift(shoe, 2.4, 0) });
    // 近侧手臂：手搭在膝上
    parts.push({ z: 3, c: 'body', sep: 0.7, pts: [[-3.4, -36.4], [0.6, -37.4], [3.0, -34.8], [3.4, -29], [3.8, -23.4], [5.8, -20.6], [12, -17.2], [18.4, -14.6], [20.8, -14.7], [23.2, -13.7], [25.0, -11.1], [25.3, -8.1], [23.8, -7.6], [22.8, -10.0], [20.4, -10.6], [18.0, -10.8], [12.0, -12.0], [6.8, -13.2], [2.8, -15.2], [-1.2, -19.6], [-2.6, -25], [-3.6, -31]] });
    // 葫芦立在凳面上，在身后
    parts.push({ z: 1.8, c: 'gourd', pts: gourdStand(-11.8, 0, 0.95) }, { z: 1.85, c: 'body', pts: gourdStandTie(-11.8, 0, 0.95) });
    folds.push(
      { z: 3, pts: [[-1.0, -33.5], [0.6, -26], [2.6, -19.6], [8, -16.2], [16, -13.6]], w: 0.5 },
      { pts: [[9, -9.8], [15, -9.4], [21, -8.6]], w: 0.55 },
      { pts: [[8, -4.6], [14, -4.2], [19.6, -3.6]], w: 0.5 },
      { pts: [[21.4, -2], [21.9, 8], [22.3, 17.5]], w: 0.6 },
      { pts: [[-5.0, -13.6], [-4.2, -9], [-3.6, -3]], w: 0.5 },
    );
    return {
      parts, folds, breathPh: 0.7, breathA: 0.0025,
      snow: (v.hat ? OLD_HAT_SNOW : OLD_SIDE_SNOW).map((c) => ({ pts: SEAT(c.pts), th: c.th })).concat([{ pts: [[9, -12.6], [14, -11.7], [19, -11.2], [22.6, -10.6]], th: 1.2 }]),
      dyn(env, out) { oldSideDyn(env, out, SEAT, { gourd: false }); },
    };
  });

  // ---- 背影坐地（盘腿）：原点为臀下地面 ----
  const SB = 46;
  O.seatTorsoBack = sym([[0, -40.6], [3.6, -40.3], [6.9, -39.2], [9.6, -37.5], [11.5, -35.3], [12.4, -32.6], [11.6, -28], [10.8, -22], [10.1, -16.5], [10.3, -12.6], [13.0, -9.8], [17.0, -8.2], [20.4, -7.7], [22.9, -5.9], [24.0, -2.9], [23.4, -0.3], [18, 0.2, 0, 0.3, 0.8], [10, -0.1, 0, 0.35, 1.3], [0, 0.2, 0, 0.35, 1.7]]);
  // 手臂连同垂下的宽袖：外缘到膝上的手，内缘压进躯干和大腿约 1 个单位（不随风动），袖与身体之间只靠淡色细线分开，不留透底的缝
  O.seatArmBack = [[11.0, -36.0], [12.9, -35.3], [14.3, -32.6], [15.4, -28.5], [16.8, -24.0], [18.0, -20.2], [19.7, -16.4], [21.5, -12.6], [22.9, -9.7, 0, 0.3, 0.4], [21.6, -7.4, 0, 0.4, 0.8], [19.4, -7.6, 0, 0.3, 1.2], [17.4, -7.6], [15.0, -8.0], [12.4, -9.3], [9.6, -12.6], [9.2, -18.0], [9.8, -24.0], [10.7, -30.0]];
  O.seatHandBack = [[19.4, -9.2], [22.0, -9.6], [23.2, -7.6], [22.6, -5.3], [20.8, -4.8], [19.6, -6.5]];
  function oldSeatBackBase(parts, folds, opt) {
    opt = opt || {};
    parts.push({ z: 2, c: 'body', dyn: 1, pts: O.seatTorsoBack });
    // 剑柄默认从右肩后探出；举葫芦饮酒（右手在嘴边）时改从左肩后探出，剑柄不会穿过握葫芦的手
    if (opt.swordLeft) parts.push(...sword([-12.1, -93.5 + SB], [-8.6, -84.8 + SB], [11.6, -48.0 + SB], 2.5, { c: 'body', sep: 0.8 }));
    else parts.push(...sword([12.1, -93.5 + SB], [8.6, -84.8 + SB], [-11.6, -48.0 + SB], 2.5, { c: 'body', sep: 0.8 }));
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: mirror(O.seatArmBack).map((p) => { if (p[4] != null) p[4] += 2; return p; }) }, { z: 3, c: 'body', pts: mirror(O.seatHandBack) });
    if (!opt.drink) parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: O.seatArmBack }, { z: 3, c: 'body', pts: O.seatHandBack });
    const hd = opt.headDy || 0;
    parts.push({ z: 4, c: 'hair', pts: shift(O.headBack, 0, SB) }, { z: 4, c: 'hair', pts: ell(0, -99.3 + SB + hd, 2.9, 2.3, 0, 10) });
    parts.push({ z: 5, c: 'blue', pts: shift(O.bandBack, 0, SB + hd) });
    folds.push(...O.hairBackFolds.map((f) => ({ z: f.z, c: f.c, w: f.w, pts: shift(f.pts, 0, SB) })));
    folds.push(
      { pts: [[0, -38], [0.2, -28], [0, -18]], w: 0.5 },
      { pts: [[-9.6, -14.2], [0, -14.0], [9.6, -14.2]], w: 0.8 },
      { pts: [[5.5, -37.5], [7.8, -33], [8.2, -25]], w: 0.55 },
      { pts: [[-5.5, -37.5], [-7.8, -33], [-8.2, -25]], w: 0.55 },
      { pts: [[11, -6.2], [16, -5.4], [21, -3.2]], w: 0.55 },
      { pts: [[-11, -6.2], [-16, -5.4], [-21, -3.2]], w: 0.55 },
      { pts: [[4, -11], [5, -5], [5.4, -0.8]], w: 0.5 },
      { pts: [[-4, -11], [-5, -5], [-5.4, -0.8]], w: 0.5 },
    );
  }
  const OLD_SEAT_SNOW = [{ pts: [[-12.0, -34.0], [-9.6, -37.4], [-6.0, -39.3], [-3.0, -40.2]], th: 1.7 }, { pts: [[3.0, -40.2], [6.0, -39.3], [9.6, -37.4], [12.0, -34.0]], th: 1.7 }, { pts: [[-5.3, -49.2], [-3.4, -51.6], [-1.6, -52.2]], th: 1.1 }, { pts: [[1.6, -52.2], [3.4, -51.6], [5.3, -49.2]], th: 1.1 }, { pts: [[-23.4, -4.0], [-21, -7.6], [-17, -8.4], [-13, -9.8]], th: 1.2 }, { pts: [[13, -9.8], [17, -8.4], [21, -7.6], [23.4, -4.0]], th: 1.2 }];
  def('old', 'sitBack', () => {
    const parts = [], folds = [];
    oldSeatBackBase(parts, folds);
    parts.push({ z: 6, c: 'gourd', pts: gourd(27.6, -9.45, 0.97, 0) }, { z: 6.1, c: 'body', pts: gourdTie(27.6, -9.45, 0.97, 0) });
    return {
      parts, folds, breathPh: 1.4, breathA: 0.0025,
      snow: OLD_SEAT_SNOW.concat([{ pts: [[25.6, -7.2], [27.6, -8.4], [29.6, -7.2]], th: 0.8 }]),
      dyn(env, out) { O.hairStrandsBack(env, out, 0, SB); },
    };
  });

  // ---- 背影坐船：盘坐，右手举葫芦饮酒；宽袖从上臂到肘兜成一道弧 ----
  def('old', 'sitBoat', () => {
    const parts = [], folds = [];
    oldSeatBackBase(parts, folds, { drink: 1, headDy: 1.2, swordLeft: 1 });
    // 右上臂外展、前臂回举至嘴边；袖子在上臂下垂成弧，最低处靠近肘
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: [[10.8, -32.6], [12.8, -32.0, 0, 0.1], [15.0, -30.4, 0, 0.3, 0.2], [17.2, -28.6, 0, 0.55, 0.6], [19.2, -27.9, 0, 0.75, 1.0], [20.9, -29.4, 0, 0.6, 1.3], [21.5, -32.6, 0, 0.25], [21.3, -35.6], [20.5, -39.2], [17.0, -42.8], [13.0, -46.2], [10.4, -48.2], [8.4, -47.4], [8.7, -45.2], [11.6, -43.0], [15.2, -40.4], [15.9, -39.0, 1], [13.2, -38.7], [10.6, -38.1]] });
    const ga = -2.32;
    parts.push({ z: 2.8, c: 'gourd', pts: gourd(7.6, -46.4, 0.95, ga) }, { z: 2.9, c: 'body', pts: gourdTie(7.6, -46.4, 0.95, ga) });
    parts.push({ z: 3.1, c: 'body', pts: [[7.8, -48.4], [10.0, -48.9], [11.2, -47.0], [10.2, -45.0], [8.2, -45.0]] });
    folds.push({ z: 3, pts: [[12.6, -34.0], [16.2, -32.2], [19.4, -31.4]], w: 0.45 }, { z: 3, pts: [[17.6, -36.6], [17.0, -33.4], [18.2, -30.0]], w: 0.4 });
    return {
      parts, folds, breathPh: 2.1, breathA: 0.0025,
      snow: OLD_SEAT_SNOW.slice(0, 1).concat(OLD_SEAT_SNOW.slice(2)),
      dyn(env, out) { O.hairStrandsBack(env, out, 0, SB); },
    };
  });

  // ---- 倚墙垂头睡（侧）：原点为臀下地面，墙在身后（-x 侧约 -9.5）----
  const SL_H = (pts) => rot(shift(pts, -1.1, 47.3), -0.6, -35.2, 0.62);
  def('old', 'sitSleep', () => {
    const parts = [], folds = [];
    const neck = [[5.0, -83.6], [4.2, -81.4], [3.0, -79.6], [-4.6, -81.2], [-2.6, -84.2], [-1.6, -86.8]];
    oldSideUpper(parts, folds, ID, { arm: false, torso: false, robeFolds: false, sword: false, H: SL_H, neck: rot(shift(neck, -1.1, 47.3), -0.6, -35.2, 0.36) });
    // 躯干倚墙
    parts.push({ z: 2, c: 'body', pts: [[-2.6, -36.4], [-6.4, -34.8], [-8.4, -31.0], [-8.7, -24], [-8.1, -16], [-7.5, -8], [-7.0, -2.0], [-5.2, -0.2], [-2, 0, 1], [6, 0], [7.6, -8.0], [6.6, -14], [5.8, -20], [5.0, -26], [3.6, -31.6], [1.4, -34.8]] });
    // 远侧腿平伸，鞋尖朝上
    parts.push({ z: 1.9, c: 'body', pts: [[4, 0], [4, -7.6], [14, -7.3], [24, -6.2], [31.0, -5.7], [33.6, -5.9], [34.7, -5.0], [36.4, -4.5], [38.4, -5.0], [39.8, -6.6], [41.0, -9.6], [42.4, -12.0], [44.2, -12.6], [45.6, -11.4], [45.4, -8.0], [44.6, -4.0], [43.6, -1.2], [41.8, 0, 1]] });
    // 近侧腿屈膝，衣襟从膝头垂下
    parts.push({ z: 2, c: 'body', pts: [[2, -4], [8, -12], [13.6, -20.4], [16.4, -23.4], [19.2, -22.8], [20.6, -19.6], [21.0, -12], [21.2, -4.6], [23.8, -2.9], [27.8, -1.2], [28.2, 0, 1], [17.6, 0, 1], [17.2, -2.6], [16.8, -9.6], [13, -7], [7, -0.5]] });
    parts.push({ z: 2, c: 'body', dyn: 1, pts: [[18.6, -23.0], [21.2, -18.6], [21.8, -10, 0, 0.2], [22.2, -3.4, 1, 0.45, 0.4], [19.6, -2.8, 0, 0.45, 0.9], [17.2, -3.2, 1, 0.35, 1.3], [16.4, -10], [15.6, -17]] });
    // 近侧手臂搭在膝上，手自然垂下
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.7, pts: [[-4.0, -33.6], [-1.2, -34.9], [2.6, -32.2], [7.6, -28.6], [12.8, -27.4], [18.6, -27.6], [22.4, -26.2], [24.6, -24.4], [25.9, -21.4], [26.4, -17.6], [26.0, -14.4], [25.0, -13.6], [24.3, -15.8], [24.0, -19.0], [22.6, -21.6, 0, 0.1], [21.2, -18.2, 0, 0.45, 0.5], [19.4, -17.6, 0, 0.5, 1.0], [18.4, -21.6, 0, 0.1], [12.4, -21.4], [7.4, -22.6], [1.8, -25.4], [-2.6, -28.4]] });
    // 怀中葫芦
    parts.push({ z: 6, c: 'gourd', pts: gourd(4.2, -16.6, 0.88, -1.05) }, { z: 6.1, c: 'body', pts: gourdTie(4.2, -16.6, 0.88, -1.05) });
    // 剑倚墙：刚体道具（c 'prop'），不进剪影，在人身后单独画，迎光一侧描一道均匀的轮廓光
    parts.push(...sword([-9.9, -47.8], [-10.4, -38.2], [-12.2, -0.6], 1, { c: 'prop' }));
    folds.push(
      { pts: [[-6.0, -30], [-5.4, -20], [-5.0, -8]], w: 0.55 },
      { pts: [[1.0, -30], [3.0, -22], [3.8, -12]], w: 0.5 },
      { pts: [[9, -3.8], [20, -3.6], [31, -3.2]], w: 0.5 },
      { pts: [[8, -9.4], [13, -15], [16.6, -20.4]], w: 0.5 },
      { pts: [[19.2, -18], [19.4, -10], [19.6, -4.6]], w: 0.5 },
      { z: 3, pts: [[2, -29.2], [8, -24.4], [14, -23.6], [22, -22.6]], w: 0.45 },
    );
    return {
      parts, folds, breathPh: 0.3, breathA: 0.0025,
      snow: [{ pts: [[-8.2, -31.2], [-6.4, -35.0], [-3.0, -36.6]], th: 1.4 }, { pts: [[13.8, -21.0], [16.4, -23.6], [19.2, -23.0]], th: 1.1 }, { pts: SL_H(HX([[-4.0, -95.4], [-1.5, -98.3], [1.8, -99.1], [4.4, -98.0]])), th: 1.1 }, { pts: [[6, -27.6], [12.8, -26.9], [19, -27.3], [24, -25]], th: 0.9 }],
      dyn(env, out) { oldSideDyn(env, out, ID, { H: SL_H, gourd: false, da: 0.62, beardDa: -0.45 }); },
    };
  });

  // ---- 披蓑戴笠侧坐垂钓：原点为坐面；钓竿前伸，钓线垂到水面（opts.waterDepth / 船的水线，或 opts.lineTo 单位身高/100）----
  O.coatFish = [[-1.0, -41.6], [-5.4, -39.2], [-9.4, -33.0], [-12.6, -23.0], [-14.8, -13.0], [-16.4, -4.0], [-16.8, -2.0, 1], [-12, -2.6], [-6, -3.8], [0, -5.4], [6, -8.2], [11.4, -11.8], [15.6, -15.8, 1], [17.0, -20.4], [15.4, -25.4], [12.0, -30.8], [8.2, -34.4], [3.0, -36.8]];
  O.coatFishBottom = [[-16.6, -2.4], [-12, -2.9], [-6, -4.1], [0, -5.7], [6, -8.5], [11.4, -12.1], [15.4, -16.0]];
  def('old', 'fishSit', () => {
    const parts = [], folds = [];
    // 头（笠下侧脸）与白须、后颈白发
    parts.push({ z: 2, c: 'body', pts: [[-1.4, -35.8], [-2.4, -40.8], [-0.4, -45.0], [4.8, -45.8], [8.4, -43.6], [9.3, -41.6], [10.75, -39.5, 1], [9.75, -38.85], [9.95, -37.95], [9.55, -37.35], [9.65, -36.75], [9.05, -35.75], [6.6, -34.6], [3.8, -34.0]] });
    // 白须：唇上一小撮，圆润，贴着侧脸轮廓
    parts.push({ z: 4, c: 'hair', pts: [[8.0, -38.65], [8.75, -39.15], [9.6, -39.05], [10.2, -38.45], [10.25, -37.7], [9.75, -37.25], [9.0, -37.4], [8.4, -37.9]] });
    // 腿：屈膝坐，前襟盖到小腿
    parts.push({ z: 2, c: 'body', dyn: 1, pts: [[2, -6], [10, -10], [16.4, -16.6], [18.6, -24.6], [21.0, -26.0], [23.4, -24.0], [23.8, -16], [24.2, -5.2, 1, 0.4, 0.3], [21.6, -4.4, 0, 0.45, 0.8], [19.0, -5.0, 1, 0.35, 1.2], [15, -3.2], [9, -0.6], [2, 0, 1], [-3, -1.0]] });
    parts.push({ z: 2, c: 'body', pts: [[19.4, -6.4], [23.6, -6.4], [23.5, -3.6], [26.2, -2.6], [29.8, -1.0], [30.1, 0, 1], [19.0, 0, 1], [18.8, -2.6]] });
    // 袖口与手（握竿）
    parts.push({ z: 3.5, c: 'body', sep: 0.6, pts: [[12.2, -27.8], [17.6, -27.0], [18.8, -22.0], [13.4, -21.2]] });
    parts.push({ z: 3.6, c: 'body', pts: [[16.8, -25.2], [20.0, -26.6], [22.7, -25.6], [23.3, -23.2], [21.6, -21.6], [18.4, -21.9]] });
    // 蓑衣与斗笠
    parts.push({ z: 3, c: 'straw', pts: O.coatFish });
    parts.push({ z: 5, c: 'straw', pts: [[-15.2, -43.6, 1], [-8.4, -46.6], [-1.0, -48.8], [2.0, -52.2], [3.5, -55.0, 1], [5.2, -52.0], [8.0, -48.8], [14.0, -45.6], [19.6, -42.6, 1], [13.8, -43.4], [6.0, -44.4], [-2.0, -44.0], [-9.0, -43.2]] });
    folds.push(
      { z: 5, c: 'straw', pts: [[3.4, -53.6], [-2, -47.6], [-10, -44.6]], w: 0.4 },
      { z: 5, c: 'straw', pts: [[3.6, -53.6], [3.0, -48.6], [2.0, -44.6]], w: 0.4 },
      { z: 5, c: 'straw', pts: [[3.8, -53.6], [9.0, -48.2], [15.0, -44.2]], w: 0.4 },
      { z: 3, c: 'straw', pts: [[-4.4, -38.0], [-1, -35.8], [4, -34.2]], w: 0.5 },
      { z: 3, c: 'straw', pts: [[-8.8, -31.6], [-2, -28.6], [6, -27.6], [12, -28.8]], w: 0.55 },
      { z: 3, c: 'straw', pts: [[-12.0, -22.0], [-4, -18.6], [5, -17.4], [13, -19.4]], w: 0.55 },
      { z: 3, c: 'straw', pts: [[-14.4, -12.0], [-6, -9.6], [3, -9.0], [10, -11.0]], w: 0.55 },
      { pts: [[20.2, -23], [20.8, -14], [21.4, -6]], w: 0.5 },
    );
    return {
      parts, folds, breathPh: 2.6, breathA: 0.0025,
      snow: [{ pts: [[-15.0, -43.8], [-8.4, -46.8], [-1.0, -49.0], [2.0, -52.4], [3.4, -55.2]], th: 1.3 }, { pts: [[3.6, -55.2], [5.2, -52.2], [8.0, -49.0], [14.0, -45.8], [19.4, -42.8]], th: 1.3 }, { pts: [[18.6, -24.8], [21.0, -26.2], [23.4, -24.2]], th: 0.8 }],
      dyn(env, out) {
        const o = env.o;
        // 下巴下的白须：根部固定在下巴，末端随风轻摆
        const ba = 0.06 * sway(env, 1, 0.9, 0.5) - 0.06 * env.w;
        out.push({ z: 4, c: 'hair', pts: rot([[7.6, -36.6], [8.9, -36.5], [9.7, -36.0], [9.8, -34.6], [9.5, -33.0], [9.0, -32.0], [8.5, -31.8], [8.1, -32.6], [7.7, -34.4]], 8.6, -36.4, ba) });
        // 笠沿下、后脑垂下的两三缕短发：细、软、圆梢，搭在蓑衣领上
        out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: -2.2, y: -43.3, len: 3.8, n: 5, a0: -0.18, wave: 0.14, lift: 0.4, amp: 0.25, seed: 0.7, w0: 0.8, w1: 0.45, tip: 'round', f: 0.5 }) });
        out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: -1.4, y: -43.6, len: 3.2, n: 5, a0: -0.05, wave: -0.12, lift: 0.4, amp: 0.25, seed: 1.9, w0: 0.75, w1: 0.42, tip: 'round', f: 0.56 }) });
        out.push({ z: 4, c: 'hair', cls: 'thin', pts: strand(env, { x: -2.7, y: -42.8, len: 3.4, n: 5, a0: -0.32, wave: 0.12, lift: 0.4, amp: 0.25, seed: 3.3, w0: 0.7, w1: 0.4, tip: 'round', f: 0.47 }) });
        // 蓑衣下缘草穗：每簇的长短、粗细、倾斜各不相同，末端圆收，不低于坐面
        const B = O.coatFishBottom;
        for (let i = 0; i < 15; i++) {
          const s = (i + 0.7 * hash01(i * 7 + 3)) / 15, k = s * (B.length - 1), j = Math.min(B.length - 2, Math.floor(k)), f = k - j;
          const x = B[j][0] + (B[j + 1][0] - B[j][0]) * f, y = B[j][1] + (B[j + 1][1] - B[j][1]) * f;
          const r = hash01(i * 13 + 1), r2 = hash01(i * 29 + 11), r3 = hash01(i * 5 + 9);
          const y0 = y - 1.0 - 0.5 * r2;
          out.push({ z: 3, c: 'straw', pts: strand(env, { x, y: y0, len: Math.min(2.2 + 3.8 * r * r + 0.8 * r3, -0.5 - y0), n: 4, a0: -0.3 + 0.32 * s + 0.5 * (r3 - 0.5), curl: 0.1 + 0.25 * (r2 - 0.5), lift: 0.3, amp: 0.35, seed: i * 1.7, w0: 1.15 + 1.1 * r2, w1: 0.16 + 0.12 * r, tip: 'round', f: 0.55 + 0.2 * r, floor: -0.3 }) });
        }
        // 钓竿：从手中伸出，末端因线重微弯并随风轻颤
        const bx = 4.4, by = -16.4, hx = 20.0, hy = -23.6, L = 112;
        const ux = (hx - bx), uy = (hy - by), ul = Math.hypot(ux, uy), dx = ux / ul, dy = uy / ul;
        const tip = 0.9 * sway(env, 1, 4.1, 0.45) * (0.4 + env.wa);
        const c = [];
        for (let i = 0; i <= 10; i++) {
          const s = i / 10, d = s * (L + ul);
          const sag = 4.2 * s * s + tip * s * s * s;
          c.push([bx + dx * d, by + dy * d + sag]);
        }
        out.push({ z: 7, c: 'rod', pts: taper(c, (s) => 1.15 - 0.85 * s, 'round') });
        // 钓线：自竿梢垂到水面（不进离屏剪影，直接画在画面上，长度不受包围盒限制）
        const e = c[c.length - 1];
        const ly = (o && o.lineTo != null) ? o.lineTo : (env.waterU != null ? env.waterU : 9);
        const ln = [], drop = ly - e[1];
        const lw = 1.6 * env.w + 0.8 * sway(env, 0.7, 5.3, 0.4);
        for (let i = 0; i <= 8; i++) { const s = i / 8; ln.push([e[0] + lw * s * s + 0.6 * Math.sin(Math.PI * s), e[1] + drop * s]); }
        out.push({ z: 7.1, c: 'line', pts: taper(ln, () => 0.22, 'round') });
      },
    };
  });

  // ======================================================================
  // 伊人 heroine：长发及腰、发间小簪、广袖长裙、淡粉披帛两端长垂（约 7.8 头身）
  // ======================================================================
  ACCENT.heroine = 'pink';
  ACCENT.pair = 'blue';
  const R = {};
  // ---- 背影：三瓣发髻插簪垂坠；长发从后颈向腰间渐宽；高腰带、宽裙摆；广袖在身侧垂成两片大弧；披帛在背后兜成一道弧，两端在袖外长垂 ----
  R.backBody = [
    [0, -86.0], [2.2, -86.0], [2.5, -84.6], [5.2, -83.2], [8.0, -81.8], [9.3, -80.0], [9.8, -76.6],
    [10.0, -71.0], [9.9, -66.5], [9.5, -64.5, 1], [8.0, -62.0], [8.6, -54.0, 0, 0.05], [10.0, -40, 0, 0.2],
    [12.0, -22, 0, 0.5], [14.6, -4, 0, 0.85], [15.4, 0, 1, 0.9], [7.0, 0.2, 0, 0.95], [0, 0.6, 0, 1], [-7.0, 0.2, 0, 0.95], [-15.4, 0, 1, 0.9], [-14.6, -4, 0, 0.85],
    [-12.0, -22, 0, 0.5], [-10.0, -40, 0, 0.2], [-8.6, -54.0, 0, 0.05], [-8.0, -62.0], [-9.5, -64.5, 1], [-9.9, -66.5],
    [-10.0, -71.0], [-9.8, -76.6], [-9.3, -80.0], [-8.0, -81.8], [-5.2, -83.2], [-2.5, -84.6], [-2.2, -86.0],
  ];
  // 广袖：肩头约 5 个单位宽，向下张开到袖口约 9.5 个单位；外缘一路向外斜下，外角最低（略圆），下缘是一道深弧，
  // 从外角斜上收进身侧；内缘压在身侧（淡色细线分开）。只有下面约三成随风摆
  R.backSleeve = [
    [9.0, -80.4, 1], [11.4, -77.8], [12.7, -72.5], [13.4, -66.0], [14.2, -58.5], [15.2, -50.0, 0, 0.1, 0.3], [16.2, -42.0, 0, 0.4, 0.6],
    [16.85, -36.2, 0, 0.75, 0.9], [16.6, -33.6, 0, 0.95, 1.2], [14.8, -33.7, 0, 0.95, 1.5], [12.3, -35.2, 0, 0.85, 1.8], [9.9, -37.7, 0, 0.6, 2.1],
    [8.1, -40.7, 0, 0.35, 2.4], [7.3, -44.0, 1, 0.15], [7.4, -50.0], [7.8, -57.0], [8.2, -64.0], [8.5, -71.0],
  ];
  // 头：头顶圆、耳际最宽（颅骨的弧线），到后颈收窄
  R.backHead = [
    [0, -100.8], [2.7, -100.2], [4.5, -98.6], [5.3, -96.1], [5.4, -93.4], [4.9, -90.9], [3.7, -89.1], [2.3, -88.0],
    [-2.3, -88.0], [-3.7, -89.1], [-4.9, -90.9], [-5.4, -93.4], [-5.3, -96.1], [-4.5, -98.6], [-2.7, -100.2],
  ];
  // 长发：贴着后脑的弧线下来，在后颈收进，再沿后背渐宽到腰；发梢圆收，末端落在披帛弧带的宽度之内（被弧带盖住）
  R.backHair = [
    [0, -98.0], [4.0, -97.2], [5.4, -94.2], [5.2, -91.0], [4.2, -88.2, 0, 0.02], [4.0, -85.0, 0, 0.08], [4.8, -80.0, 0, 0.18], [5.7, -74.0, 0, 0.32], [6.3, -68.0, 0, 0.55],
    [6.0, -62.0, 0, 0.8], [5.0, -59.2, 0, 0.95], [2.5, -57.7, 0, 1], [0, -57.2, 0, 1], [-2.5, -57.7, 0, 1], [-5.0, -59.2, 0, 0.95],
    [-6.0, -62.0, 0, 0.8], [-6.3, -68.0, 0, 0.55], [-5.7, -74.0, 0, 0.32], [-4.8, -80.0, 0, 0.18], [-4.0, -85.0, 0, 0.08], [-4.2, -88.2, 0, 0.02], [-5.2, -91.0], [-5.4, -94.2], [-4.0, -97.2],
  ];
  // 头随 tilt 绕颈根转；长发上端跟着转、下端仍垂直
  function heroineBack(tilt, opt) {
    opt = opt || {};
    const pv = [0, -87.0];
    const TW = (pts, full) => pts.map((q) => {
      const k = full ? 1 : clamp((-80 - q[1]) / 14, 0, 1);
      const r = rotP(q[0], q[1], pv[0], pv[1], tilt * k);
      const o = q.slice(); o[0] = r[0]; o[1] = r[1];
      return o;
    });
    const TP = (x, y) => rotP(x, y, pv[0], pv[1], tilt);
    const parts = [], folds = [];
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 1.2, pts: R.backBody });
    parts.push({ z: 2.2, c: 'body', dyn: 1, sep: 0.6, pts: R.backSleeve }, { z: 2.2, c: 'body', dyn: 1, pts: mirror(R.backSleeve).map((p) => { p[4] = 1.9; return p; }) });
    folds.push(
      { pts: [[-9.6, -72.5], [9.6, -72.5]], w: 2.2, flat: 1 },
      { pts: [[-2.4, -60], [-3.8, -32], [-5.2, -4]], w: 0.6 }, { pts: [[2.4, -60], [3.8, -32], [5.2, -4]], w: 0.6 },
      { pts: [[-7.6, -48], [-9.8, -22]], w: 0.55 }, { pts: [[7.6, -48], [9.8, -22]], w: 0.55 },
      { z: 2.2, pts: [[10.8, -72], [12.0, -58], [13.4, -44], [14.2, -37]], w: 0.45 }, { z: 2.2, pts: [[-10.8, -72], [-12.0, -58], [-13.4, -44], [-14.2, -37]], w: 0.45 },
      { z: 2.2, pts: [[9.6, -60], [10.2, -48], [10.8, -40]], w: 0.4 }, { z: 2.2, pts: [[-9.6, -60], [-10.2, -48], [-10.8, -40]], w: 0.4 },
    );
    // 披帛两端与背后弧带的连接（固定；披帛的这几段有厚度，算主体，排在长发后面）
    parts.push({ z: 3, c: 'pink', cls: '', pts: taper([[11.0, -67.4], [12.8, -66.0], [13.9, -63.6]], () => 2.2, 'round') });
    parts.push({ z: 3, c: 'pink', cls: '', pts: taper([[-11.0, -67.4], [-12.8, -66.0], [-13.9, -63.6]], () => 2.2, 'round') });
    // 头、发髻、簪
    parts.push({ z: 4, c: 'hairD', dyn: 1, pts: TW(R.backHair, false) });
    parts.push({ z: 4.1, c: 'hairD', pts: TW(R.backHead, true) });
    // 发髻：头顶偏后挽起的三瓣髻，中瓣高出头顶约 3 个单位，剪影里一眼看得出；簪子几乎水平地横穿发髻，簪头只在左侧
    // （并肩背影里离少年远的一侧）探出一点
    const b0 = TP(0, -101.3), b1 = TP(-2.25, -100.5), b2 = TP(2.25, -100.5);
    parts.push({ z: 4.2, c: 'hairD', pts: ell(b0[0], b0[1], 3.1, 2.5, tilt, 14) }, { z: 4.2, c: 'hairD', pts: ell(b1[0], b1[1], 1.85, 1.5, tilt - 0.45, 10) }, { z: 4.2, c: 'hairD', pts: ell(b2[0], b2[1], 1.85, 1.5, tilt + 0.45, 10) });
    folds.push({ z: 4.2, c: 'hairD', pts: [TP(-1.3, -99.6), TP(-1.75, -101.4), TP(-1.2, -102.9)], w: 0.32 }, { z: 4.2, c: 'hairD', pts: [TP(1.3, -99.6), TP(1.75, -101.4), TP(1.2, -102.9)], w: 0.32 });
    const p0 = TP(0.9, -101.75), p1 = TP(-4.75, -102.45);
    parts.push({ z: 4.4, c: 'gold', pts: band([p0, p1], 0.46) }, { z: 4.4, c: 'gold', pts: ell(p1[0], p1[1], 0.62, 0.55, tilt, 8) });
    folds.push({ z: 4, c: 'hairD', pts: TW([[-2.0, -94], [-2.6, -80], [-2.0, -62]], false), w: 0.4 }, { z: 4, c: 'hairD', pts: TW([[2.0, -94], [2.6, -80], [2.0, -62]], false), w: 0.4 });
    const snow = [{ pts: [[-9.6, -78.0], [-7.8, -82.0], [-5.2, -83.6], [-2.6, -84.8]], th: 1.4 }, { pts: [[2.6, -84.8], [5.2, -83.6], [7.8, -82.0], [9.6, -78.0]], th: 1.4 }, { pts: [TP(-3.4, -101.3), TP(-1.7, -103.2), TP(0, -103.8), TP(1.7, -103.2), TP(3.4, -101.3)], th: 0.9 }];
    function dyn(env, out) {
      // 披帛两端：从肘外侧搭下，压在广袖外侧垂过袖口；风往身体一侧吹时只偏一点，而且不越过根部的竖线（不会横到身上）。
      // 并肩背影里她右侧整个被少年挡住，右端不画（否则下梢会在两人之间的膝盖高度时隐时现）
      if (!opt.pair) out.push({ z: 2.3, c: 'pink', cls: 'norim', pts: shawlTail(env, 13.6, -63.4, 50, { side: 1, a0: 0.02, seed: 0.6, w0: 2.3, w1: 1.8 }) });
      out.push({ z: 2.3, c: 'pink', cls: 'norim', pts: shawlTail(env, -13.6, -63.4, 50, { side: -1, a0: -0.02, seed: 2.3, w0: 2.3, w1: 1.8 }) });
      // 背后兜成的弧带：中点随风轻轻起伏；挂在肘间、离开后背，所以盖在长发梢上面
      const sag = 0.8 * env.w * bsw(env.t, 0.8);
      out.push({ z: 4.05, c: 'pink', cls: '', pts: taper([[-11.4, -66.8], [-7.6, -60.4], [0, -57.0 + sag], [7.6, -60.4], [11.4, -66.8]], (u) => 2.2 + 0.5 * Math.sin(u * Math.PI), 'round') });
      // 簪头垂坠：短（含坠珠不到 2 个单位）
      const d = bchain(env, p1[0], p1[1] + 0.45, 1.25, 3, { a0: 0, lift: 0.8, amp: 0.4, ph: 0.4, idle: 0.1 });
      out.push({ z: 4.5, c: 'gold', pts: band(d, 0.22) }, { z: 4.5, c: 'gold', pts: ell(d[3][0], d[3][1] + 0.25, 0.4, 0.5, 0, 8) });
    }
    // 不描轮廓光的区域：背光一侧广袖袖口的下缘向上斜收、对着裙身（中间隔着一道比窄缝宽的空），光被身体挡住，不该亮。
    // sh = 1：光从 +x 来时作用于 -x 侧的袖口；sh = -1 反之（区域的边界都落在没有亮边的地方，硬边也看不出来）
    // 另外，迎光一侧的裙边紧贴在广袖袖口下面那一小段（披帛垂端就在它外侧不远）被袖口挡住，也不亮，在 y = -25 到 -16 之间渐渐亮起来
    //（fade：从 y0 处完全不亮渐变到 y1 处不影响），不会在袖口下冒出一截时有时无的短亮线
    const nrz = [
      { sh: 1, pts: [[-20.5, -47.0, 1], [-6.6, -47.0, 1], [-6.6, -28.5, 1], [-20.5, -28.5, 1]] },
      { sh: -1, pts: [[6.6, -47.0, 1], [20.5, -47.0, 1], [20.5, -28.5, 1], [6.6, -28.5, 1]] },
      { sh: 1, fade: [-25, -16], pts: [[7.8, -47.0, 1], [13.6, -47.0, 1], [13.6, -16.0, 1], [7.8, -16.0, 1]] },
      { sh: -1, fade: [-25, -16], pts: [[-13.6, -47.0, 1], [-7.8, -47.0, 1], [-7.8, -16.0, 1], [-13.6, -16.0, 1]] },
    ];
    return { parts, folds, snow, dyn, nrz };
  }
  def('heroine', 'standBack', () => {
    const H = heroineBack(0);
    return { parts: H.parts, folds: H.folds, snow: H.snow, breathPh: 0.9, dyn: H.dyn, nrz: H.nrz };
  });

  // ---- 侧影（朝右）：双手交握于腰前，藏在下垂的广袖里；披帛一端在臂前垂落，一端在身后飘 ----
  R.sideHead = [[-3.0, -87.6], [-5.2, -90.0], [-5.9, -93.6], [-5.0, -97.6], [-2.2, -99.9], [1.2, -100.1], [3.7, -98.6], [4.75, -96.2], [4.95, -94.4], [4.85, -93.5], [5.85, -91.65, 1], [5.2, -91.1], [5.32, -90.3], [5.0, -89.85], [5.15, -89.35], [4.7, -88.3], [3.4, -87.55], [2.1, -87.5], [2.0, -86.2]];
  R.sideNeck = [[2.0, -87.6], [2.3, -84.8], [3.0, -83.0], [-3.0, -83.2], [-2.6, -85.6], [-2.6, -88.0]];
  R.sideTorso = [[2.8, -83.6], [3.9, -82.0], [5.0, -79.0], [5.3, -76.0], [4.8, -72.0], [4.3, -67.6], [4.5, -64.8], [5.2, -57, 0, 0.1], [6.2, -44, 0, 0.25], [7.4, -30, 0, 0.45], [8.8, -16, 0, 0.7, 0.3], [10.2, -5, 0, 0.85, 0.6], [11.4, -0.6, 1, 0.9, 0.9], [6.0, 0.1, 0, 0.9, 1.2], [0, 0.1, 0, 0.9, 1.5], [-6.0, 0.0, 0, 1.0, 1.8], [-11.6, -0.4, 1, 1.1, 2.1], [-10.0, -6, 0, 1.0, 2.4], [-8.4, -16, 0, 0.75], [-6.9, -30, 0, 0.45], [-5.8, -44, 0, 0.2], [-5.2, -54], [-4.4, -64.6], [-4.7, -70.0], [-5.1, -75.0], [-4.9, -79.6], [-3.4, -83.0]];
  R.sideHairCap = [[4.4, -97.3], [2.6, -99.3], [-0.4, -100.4], [-3.4, -99.4], [-5.5, -96.6], [-6.2, -92.6], [-5.6, -88.4], [-3.6, -85.6, 1], [-2.4, -88.2], [-1.0, -90.6], [0.2, -93.0], [1.6, -95.0], [3.2, -96.4]];
  // 长发：前缘压进后颈与后背轮廓约 0.8 个单位且不随风动（发与颈之间不露缝），只有发梢一段飘
  R.sideHair = [[-2.6, -92.0], [-5.6, -90.0], [-6.4, -85.0], [-6.6, -80.0, 0, 0.1], [-6.5, -74.0, 0, 0.25], [-6.4, -68.0, 0, 0.45], [-6.6, -63.0, 0, 0.7, 0.4], [-6.4, -60.0, 0, 0.85, 0.8], [-5.6, -58.3, 0, 0.95, 1.0], [-4.6, -58.9, 0, 0.8, 1.2], [-4.0, -61.2, 0, 0.45, 1.4], [-3.6, -66.0, 0, 0.15], [-3.8, -72.0], [-4.1, -78.0], [-2.5, -83.2], [-1.8, -86.2], [-1.9, -89.0]];
  // 广袖：上沿顺着小臂到腰前，双手藏在袖口里，下沿是一道饱满的弧
  R.sideSleeve = [[-2.2, -81.6], [0.8, -82.2], [2.4, -79.6], [2.0, -74.0], [1.6, -68.0], [3.4, -64.6], [6.2, -63.4], [8.4, -63.0], [9.5, -61.2], [9.3, -58.2], [9.0, -54.0, 0, 0.2, 0.3], [8.8, -49.0, 0, 0.45, 0.6], [8.0, -44.6, 0, 0.7, 0.9], [5.8, -42.6, 0, 0.85, 1.2], [3.2, -43.6, 0, 0.75, 1.5], [1.4, -47.6, 0, 0.5, 1.8], [0.2, -53.0, 0, 0.2], [-1.6, -60.4], [-2.8, -66.0], [-3.2, -72.0], [-3.2, -77.6]];
  R.pin = [[-5.0, -102.0, 1], [-4.75, -102.35], [2.2, -99.75, 1], [2.05, -99.35], [-4.85, -101.7]];
  R.pinGem = [[-5.3, -101.6], [-5.6, -102.6], [-5.0, -103.3], [-4.4, -102.7], [-4.6, -101.8]];
  def('heroine', 'standSide', () => {
    const parts = [], folds = [];
    parts.push({ z: 2, c: 'body', pts: R.sideHead }, { z: 2, c: 'body', pts: R.sideNeck });
    parts.push({ z: 2, c: 'body', dyn: 1, pts: R.sideTorso });
    parts.push({ z: 1.9, c: 'body', dyn: 1, pts: R.sideHair });
    parts.push({ z: 3, c: 'body', dyn: 1, sep: 0.6, pts: R.sideSleeve });
    parts.push({ z: 4, c: 'hairD', pts: R.sideHairCap });
    parts.push({ z: 4, c: 'hairD', pts: [[-6.4, -97.4], [-5.8, -100.0], [-3.8, -101.8], [-1.4, -102.0], [0.4, -100.6], [-0.4, -98.4], [-2.8, -97.0], [-5.2, -96.4]] });
    parts.push({ z: 4.5, c: 'gold', pts: rot(R.pin, -2.6, -99.6, 0.25).map((p) => [p[0] - 1.2, p[1] + 0.2, p[2]]) }, { z: 4.5, c: 'gold', pts: shift(rot(R.pinGem, -2.6, -99.6, 0.25), -1.2, 0.2) });
    folds.push(
      { pts: [[-4.2, -64.8], [0, -64.6], [4.3, -64.8]], w: 0.8 },
      { pts: [[2.6, -60], [3.8, -40], [5.6, -16], [6.6, -2]], w: 0.7 },
      { pts: [[-2.6, -60], [-3.6, -40], [-5.2, -16], [-6.8, -2]], w: 0.7 },
      { z: 3, pts: [[0.2, -79.0], [-0.4, -70.0], [0.6, -64.6]], w: 0.45 },
      { z: 3, pts: [[5.6, -60.4], [5.4, -52.0], [4.8, -45.6]], w: 0.45 },
      { z: 4, c: 'hairD', pts: [[3.4, -97.6], [0.4, -98.6], [-3.0, -97.4], [-5.0, -93.6]], w: 0.35 },
    );
    return {
      parts, folds, breathPh: 1.6,
      snow: [{ pts: [[-5.4, -96.8], [-3.4, -99.6], [-0.4, -100.6], [2.6, -99.5], [4.4, -97.4]], th: 1.1 }, { pts: [[-4.8, -79.8], [-2.6, -82.4], [0.8, -82.4], [2.6, -80.0]], th: 1.2 }],
      dyn(env, out) {
        // 披帛横过上臂（固定），前端自袖口前垂下、后端在身后飘
        out.push({ z: 5, c: 'pink', fl: 1, pts: [[-4.6, -78.6], [-1.0, -77.2], [2.6, -73.6], [5.6, -66.4], [8.4, -62.6], [8.4, -60.2], [5.2, -63.2], [1.6, -70.6], [-1.6, -74.4], [-4.8, -75.6]] });
        out.push({ z: 5, c: 'pink', pts: shawlTail(env, 8.0, -61.0, 42, { side: 1, towardK: 0.3, a0: 0.04, seed: 0.6, w0: 2.2, w1: 1.7 }) });
        out.push({ z: 0, c: 'pink', pts: shawlTail(env, -4.6, -71.0, 46, { side: -1, a0: -0.15, rest: 0.6, seed: 2.4, w0: 2.2, w1: 1.7 }) });
      },
    };
  });

  // ======================================================================
  // 少年与伊人 pair：并肩背影，她在他左侧稍后，头微偏向他的肩；两人之间留一道淡色分隔线
  // ======================================================================
  def('pair', 'standBack', () => {
    const her = heroineBack(0.24, { pair: 1 });
    const yb = youthBackBuild();
    const HS = 0.94, HX0 = -9.6, YX0 = 8.4;
    const toH = (pts) => shift(pts, HX0, 0, HS);
    const parts = [];
    for (const p of her.parts) parts.push(Object.assign({}, p, { z: p.z - 10, pts: toH(p.pts) }));
    for (const p of yb.parts) parts.push(Object.assign({}, p, { pts: shift(p.pts, YX0, 0), sep: p.z === 2 && p.dyn ? 0.9 : p.sep }));
    const folds = her.folds.map((f) => Object.assign({}, f, { z: (f.z == null ? 2 : f.z) - 10, w: f.w * HS, pts: toH(f.pts) }))
      .concat(yb.folds.map((f) => Object.assign({}, f, { pts: shift(f.pts, YX0, 0) })));
    return {
      parts, folds, nrz: her.nrz.filter((z) => z.pts[0][0] < 0).map((z) => ({ sh: z.sh, fade: z.fade, pts: toH(z.pts) })),
      snow: her.snow.map((c) => ({ pts: toH(c.pts), th: c.th * HS })).concat(yb.snow.map((c) => ({ pts: shift(c.pts, YX0, 0), th: c.th }))),
      dyn(env, out) {
        const a = [];
        her.dyn(env, a);
        for (const p of a) out.push(Object.assign({}, p, { z: p.z - 10, w: p.w != null ? p.w * HS : p.w, pts: toH(p.pts) }));
        const b = [];
        yb.dyn(env, b);
        for (const p of b) out.push(Object.assign({}, p, { pts: shift(p.pts, YX0, 0) }));
      },
    };
  });

  // ======================================================================
  // 行路人 traveler：宽沿斗笠、蓑衣（边缘草穗）、长衫下摆
  // ======================================================================
  ACCENT.traveler = 'blue';
  const T = {};
  T.head = [[-4.6, -88.0], [-5.6, -91.6], [-4.8, -95.0], [0, -96.4], [4.2, -95.0], [5.2, -93.2], [6.3, -91.2, 1], [5.6, -90.6], [5.75, -89.7], [5.4, -89.2], [5.6, -88.6], [5.1, -87.4], [3.6, -86.6], [2.2, -86.4], [1.8, -84.6], [-3.8, -84.6]];
  T.hat = [[-17.2, -91.4, 1], [-10.0, -94.3], [-3.0, -97.4], [0.5, -101.4], [1.8, -104.2, 1], [3.2, -101.4], [6.8, -97.4], [13.0, -94.3], [19.2, -92.0, 1], [12.0, -91.7], [4.0, -92.2], [-4.0, -92.0], [-11.0, -91.4]];
  T.hatFolds = [
    { z: 5, c: 'straw', pts: [[1.7, -103.0], [-4.0, -96.6], [-13.0, -92.6]], w: 0.4 },
    { z: 5, c: 'straw', pts: [[1.8, -103.0], [0.6, -97.6], [-1.6, -92.8]], w: 0.4 },
    { z: 5, c: 'straw', pts: [[1.9, -103.0], [4.6, -97.6], [7.6, -93.0]], w: 0.4 },
    { z: 5, c: 'straw', pts: [[2.0, -103.0], [8.0, -97.0], [15.6, -92.8]], w: 0.4 },
  ];
  T.coat = [[3.6, -86.0], [-1.0, -86.8], [-4.6, -85.6], [-7.6, -81.2], [-10.0, -73.8, 0, 0.1], [-11.8, -64.0, 0, 0.2], [-13.2, -54.0, 0, 0.35], [-14.2, -46.0, 0, 0.5, 0.4], [-14.6, -42.4, 1, 0.6, 0.8], [-9.0, -42.7, 0, 0.6, 1.1], [-3.0, -43.4, 0, 0.55, 1.4], [3.0, -43.6, 0, 0.5, 1.7], [8.0, -43.0, 0, 0.45, 2.0], [11.6, -42.0, 1, 0.4, 2.3], [11.4, -46.0, 0, 0.3], [10.6, -54.0, 0, 0.15], [9.4, -63.0], [8.2, -71.0], [6.8, -78.0], [5.4, -83.4]];
  T.coatBottom = [[-14.4, -42.6], [-9.0, -42.9], [-3.0, -43.6], [3.0, -43.8], [8.0, -43.2], [11.4, -42.2]];
  T.coatBack = [[-7.6, -81.2], [-10.0, -73.8], [-11.8, -64.0], [-13.2, -54.0], [-14.2, -46.0]];
  // 蓑衣分层：每层一排短草穗（静态的浅色短笔）
  // 每层蓑草：一道微微下垂、带起伏的层沿亮线，下面稀疏几根短草茎（比一根根画省很多笔）
  function strawRows(rows) {
    const out = [];
    for (const r of rows) {
      const [x0, x1, y0, y1, n, len] = r;
      const edge = [];
      for (let i = 0; i <= 6; i++) {
        const s = i / 6, x = x0 + (x1 - x0) * s;
        edge.push([x, y0 + (y1 - y0) * s + 0.9 * Math.sin(Math.PI * s) + 0.35 * Math.sin(i * 2.3 + y0)]);
      }
      out.push({ z: 3, c: 'straw', pts: edge, w: 0.5 });
      const k = Math.ceil(n / 4);
      for (let i = 0; i < k; i++) {
        const s = (i + 0.5 + 0.3 * (hash01(i * 17 + Math.round(y0 * 3)) - 0.5)) / k, x = x0 + (x1 - x0) * s;
        const y = y0 + (y1 - y0) * s + 0.9 * Math.sin(Math.PI * s) + 0.6;
        const l = len * (0.7 + 0.4 * hash01(i * 31 + Math.round(y0 * 7)));
        out.push({ z: 3, c: 'straw', pts: [[x, y], [x - 0.15, y + l * 0.5], [x - 0.35, y + l]], w: 0.5 });
      }
    }
    return out;
  }
  T.rows = strawRows([[-6.2, 6.0, -79.5, -79.0, 7, 4.2], [-9.4, 8.4, -69.5, -69.0, 9, 4.6], [-11.6, 9.6, -59.0, -58.6, 10, 4.8], [-13.2, 10.6, -49.6, -49.4, 11, 4.4]]);
  T.robe = [[8.6, -46.0], [8.1, -30.0, 0, 0.2], [8.3, -16.0, 0, 0.45], [8.6, -3.0, 1, 0.8, 0.3], [3.0, -2.2, 0, 0.85, 0.7], [-3.0, -2.0, 0, 0.9, 1.1], [-8.4, -2.6, 1, 1.0, 1.5], [-9.2, -16.0, 0, 0.6], [-9.4, -30.0, 0, 0.3], [-9.6, -46.0]];
  T.shoe = [[0.4, -3.0], [5.4, -3.0], [8.4, -1.8], [10.0, -0.6], [10.0, 0, 1], [0.0, 0, 1], [-0.2, -1.4]];
  // 蓑衣下缘草穗：只在下缘挂一排，末端圆收，随风轻摆
  function travelerFringe(env, out, X) {
    X = X || ID;
    const B = X(T.coatBottom);
    for (let i = 0; i < 13; i++) {
      const s = (i + 0.5 * hash01(i * 7 + 5)) / 13, k = s * (B.length - 1), j = Math.min(B.length - 2, Math.floor(k)), f = k - j;
      const x = B[j][0] + (B[j + 1][0] - B[j][0]) * f, y = B[j][1] + (B[j + 1][1] - B[j][1]) * f;
      const r = hash01(i * 13 + 2);
      out.push({ z: 2.9, c: 'fringe', pts: strand(env, { x, y: y - 1.0, len: 3.0 + 2.4 * r, n: 4, a0: -0.12 + 0.12 * s + 0.3 * (hash01(i * 3 + 1) - 0.5), lift: 0.35, amp: 0.4, seed: i * 1.3, w0: 1.5 + 0.6 * r, w1: 0.14, tip: 'round', f: 0.55 + 0.2 * r }) });
    }
    const K = X(T.coatBack);
    for (let i = 0; i < 4; i++) {
      const s = (i + 0.6) / 4.4, k = s * (K.length - 1), j = Math.min(K.length - 2, Math.floor(k)), f = k - j;
      const x = K[j][0] + (K[j + 1][0] - K[j][0]) * f, y = K[j][1] + (K[j + 1][1] - K[j][1]) * f;
      out.push({ z: 2.9, c: 'fringe', pts: strand(env, { x: x + 0.8, y, len: 2.0 + 0.6 * hash01(i + 40), n: 3, a0: -0.45, lift: 0.4, amp: 0.35, seed: i * 2.1 + 9, w0: 1.3, w1: 0.4, tip: 'round', back: -1, f: 0.6 }) });
    }
  }
  const TRAV_SNOW = [{ pts: [[-17.0, -91.6], [-10.0, -94.5], [-3.0, -97.6], [0.5, -101.6], [1.8, -104.4]], th: 1.4 }, { pts: [[1.8, -104.4], [3.2, -101.6], [6.8, -97.6], [13.0, -94.5], [19.0, -92.2]], th: 1.4 }];
  // opt.hat：斗笠的附加变换；opt.fa / opt.lift：蓑衣颤动幅度、被风掀起的高度
  function travelerUpper(parts, folds, X, opt) {
    X = X || ID; opt = opt || {};
    const XH = opt.hat ? (pts) => X(opt.hat(pts)) : X;
    parts.push({ z: 2, c: 'body', pts: X(T.head) });
    parts.push({ z: 3, c: 'straw', dyn: 1, fa: opt.fa || 1, lift: opt.lift || 0, pts: X(T.coat) });
    parts.push({ z: 5, c: 'straw', pts: XH(T.hat) });
    folds.push(...T.hatFolds.map((f) => ({ z: f.z, c: f.c, w: f.w, pts: XH(f.pts) })));
    folds.push(...T.rows.map((f) => ({ z: f.z, c: f.c, w: f.w, pts: X(f.pts) })));
  }

  def('traveler', 'standSide', () => {
    const parts = [], folds = [];
    travelerUpper(parts, folds);
    parts.push({ z: 2, c: 'body', dyn: 1, pts: T.robe }, { z: 2, c: 'body', pts: T.shoe });
    folds.push({ pts: [[2.6, -40], [3.2, -22], [3.8, -4]], w: 0.7 }, { pts: [[-4.2, -40], [-5.0, -22], [-5.6, -4]], w: 0.7 });
    return { parts, folds, snow: TRAV_SNOW, breathPh: 0.4, dyn(env, out) { travelerFringe(env, out); } };
  });

  def('traveler', 'walkSide', () => {
    const parts = [], folds = [];
    travelerUpper(parts, folds);
    return {
      parts, folds, walk: 1, snow: TRAV_SNOW, breathPh: 0.4,
      dyn(env, out) {
        travelerFringe(env, out);
        robeWalk(env, out, { restF: 8.4, restB: -9.4, frontGap: 1.2, swingCover: 6.0, backGap: 0.6, hemY: -2.4, waistF: [8.6, -48], waistB: [-9.6, -48] });
      },
    };
  });

  // ---- 顶风前倾站：上身前倾约 13°，前手压住被风掀斜的笠沿；前腿弓、后腿蹬；风一律从正面来，
  //      蓑衣与后摆被吹向身后，前摆贴在腿上显出膝盖 ----
  const LEAN = (pts) => rot(pts, 1.0, -49.0, 0.23);
  const LEAN_HAT = (pts) => rot(pts, 1.8, -96.0, 0.1);
  // 按笠的手臂：上臂从蓑衣前襟伸出，小臂约 4 个单位粗；袖子滑到肘部，袖口在小臂下垂成一兜
  T.leanArm = taper([[4.4, -80.6], [9.0, -79.4], [11.2, -85.6], [12.9, -91.4]], (u) => 4.8 - 0.9 * u, 'round');
  T.leanCuff = [[9.8, -84.6], [12.6, -86.4], [13.9, -84.2, 0, 0.25], [14.2, -80.8, 0, 0.6], [13.0, -77.8, 0, 0.9], [10.6, -77.0, 0, 0.8], [8.4, -77.8, 0, 0.3], [7.8, -80.6]];
  T.leanHand = [[11.4, -94.6], [14.0, -95.2], [15.4, -93.6], [14.6, -91.6], [12.2, -91.4]];
  // 下摆：前摆贴腿、后摆被风吹向身后；后腿脚踝上方的下摆最多掀起约 1 个单位
  T.leanLegs = [
    [-1.6, -50.0], [6.4, -50.4], [9.6, -40.0], [12.0, -30.0], [13.2, -22.0], [14.4, -12.0], [15.4, -5.4, 1, 0.08],
    [6.0, -4.1, 0, 0.25], [-4.0, -4.8, 0, 0.35], [-11.6, -6.0, 0, 0.4], [-17.0, -8.5, 1, 1], [-14.6, -18.0, 0, 0.75], [-12.0, -30.0, 0, 0.45],
    [-9.6, -40.0, 0, 0.2], [-7.6, -49.0, 0, 0.05],
  ];
  // 裤腿与脚踝：从下摆里一直连到鞋面（下摆被风掀起时露出的是裤腿，不是空隙）
  T.leanShinB = taper([[-8.0, -24.0], [-10.2, -14.0], [-11.9, -4.6]], (u) => 4.2 - 1.2 * u, 'cut', 0.01);
  T.leanShinF = taper([[11.3, -13.0], [11.25, -8.5], [11.2, -4.4]], (u) => 3.6 - 0.4 * u, 'cut', 0.01);
  def('traveler', 'leanSide', () => {
    const parts = [], folds = [];
    travelerUpper(parts, folds, LEAN, { hat: LEAN_HAT, fa: 2.6, lift: 1.4 });
    // 按笠的手臂（从蓑衣前襟伸出）、垂下的袖口与手
    parts.push({ z: 3.2, c: 'body', sep: 0.6, pts: LEAN(T.leanArm) });
    parts.push({ z: 3.25, c: 'body', dyn: 1, fa: 0.7, pts: LEAN(T.leanCuff) });
    parts.push({ z: 5.5, c: 'body', pts: LEAN(T.leanHand) });
    // 下身不前倾：下摆、裤腿、两只布鞋（后脚整只踩实，鞋尖朝前）
    parts.push({ z: 2, c: 'body', dyn: 1, fa: 2.0, lift: 0.3, pts: T.leanLegs });
    parts.push({ z: 1.95, c: 'body', pts: T.leanShinB }, { z: 1.95, c: 'body', pts: T.leanShinF });
    parts.push({ z: 1.9, c: 'body', pts: shift(WALK_SHOE, 11.6, 0) }, { z: 1.9, c: 'body', pts: shift(WALK_SHOE, -11.6, 0) });
    folds.push({ pts: [[3.0, -44], [6.6, -26], [10.6, -8]], w: 0.7 }, { pts: [[-4.0, -44], [-7.6, -24], [-11.6, -10]], w: 0.7 }, { pts: [[9.6, -34], [11.6, -26]], w: 0.5 });
    return {
      parts, folds, breathPh: 1.1,
      // 顶风：不论 windDir，风都从人物正面吹来
      envFn(env) { const w = -Math.max(Math.abs(env.w), 0.75); env.w = w; env.wa = -w; },
      snow: TRAV_SNOW.map((c) => ({ pts: LEAN(LEAN_HAT(c.pts)), th: c.th })),
      dyn(env, out) { travelerFringe(env, out, LEAN); },
    };
  });

  // ======================================================================
  // 船夫 boatman：斗笠、短打、长篙；撑篙循环每 2 秒一次（篙入水 → 前倾推篙 → 收回）
  // ======================================================================
  ACCENT.boatman = 'blue';
  const BM = {};
  // 周期关键帧（余弦缓动，首尾相接）
  function keys(p, K) {
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (p >= a[0] && p <= b[0]) { const u = (p - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(Math.PI * u)); }
    }
    return K[0][1];
  }
  BM.cycle = (t) => {
    const p = (((t / 2) % 1) + 1) % 1;
    return {
      th: keys(p, [[0, 0.22], [0.62, 0.58], [1, 0.22]]),
      lean: keys(p, [[0, 0.04], [0.15, 0.08], [0.6, 0.3], [0.85, 0.08], [1, 0.04]]),
      slide: keys(p, [[0, 70], [0.15, 90], [0.62, 90], [0.84, 46], [1, 70]]),
    };
  };
  BM.hip = [-0.5, -50];
  BM.legs = [
    [[-3.0, -52], [5.0, -52.4], [8.0, -44], [10.6, -35], [12.4, -27.6], [12.6, -23.8], [11.0, -22.4], [10.6, -15], [10.2, -5.0], [12.2, -2.8], [15.6, -1.2], [16.0, 0, 1], [6.4, 0, 1], [6.2, -2.6], [6.8, -10], [6.6, -18], [6.2, -22.0], [4.6, -23.6], [3.0, -30], [0.4, -38], [-2.0, -46]],
    [[-5.0, -52], [2.4, -50.4], [0.6, -42], [-2.4, -33], [-4.6, -26.4], [-6.0, -23.2], [-7.4, -16], [-8.8, -6.0], [-6.6, -2.8], [-3.4, -1.2], [-3.0, 0, 1], [-13.0, 0, 1], [-13.2, -2.6], [-12.4, -8], [-11.0, -17], [-10.6, -22.4], [-11.0, -24.6], [-9.4, -30], [-7.8, -38], [-7.0, -46]],
  ];
  BM.torso = [[3.0, -83.2], [4.6, -81.4], [6.0, -77.6], [6.4, -72.0], [5.8, -66.0], [5.6, -60.0], [6.4, -52.0], [7.0, -45.6, 1, 0.35, 0.3], [0, -44.4, 0, 0.45, 0.8], [-7.2, -45.4, 1, 0.55, 1.3], [-7.0, -52.0], [-6.0, -60.0], [-6.6, -68.0], [-7.2, -74.0], [-6.4, -79.6], [-4.0, -83.2]];
  BM.head = [[-3.2, -87.2], [-5.4, -89.7], [-6.0, -93.4], [-4.8, -96.4], [0, -97.6], [3.8, -96.4], [5.05, -94.6], [5.35, -93.6], [6.45, -91.45, 1], [5.85, -90.8], [6.0, -89.95], [5.62, -89.4], [5.85, -88.85], [5.35, -87.65], [3.85, -86.8], [2.4, -86.6], [2.6, -83.0], [-3.8, -83.0]];
  BM.hat = [[-11.8, -92.6, 1], [-6.4, -95.0], [-1.4, -98.2], [0.6, -101.0], [1.6, -102.8, 1], [2.6, -101.0], [4.8, -98.2], [9.4, -95.0], [14.0, -93.0, 1], [8.6, -92.6], [2.0, -93.0], [-4.6, -92.6]];
  BM.arm = [[-2.6, -81.0], [1.6, -82.6], [4.2, -79.0], [6.4, -73.0], [7.8, -69.8], [10.0, -72.2], [11.4, -75.2], [13.6, -74.0], [12.6, -70.8], [9.2, -66.2], [6.6, -63.8], [4.6, -64.0], [2.2, -68.0], [-1.4, -74.0], [-3.0, -78.0]];
  BM.farUpper = [[-1.2, -82.0], [1.6, -80.4], [0.4, -72.0], [-1.4, -64.6], [-4.8, -63.4], [-5.4, -66.0], [-4.6, -73.0], [-3.8, -79.0]];
  BM.hu = [12.6, -74.4];
  BM.elbow = [-3.2, -64.6];
  BM.fist = [[-1.7, -1.6], [1.6, -1.8], [2.2, 0.4], [1.4, 2.0], [-1.4, 2.0], [-2.0, 0.2]];
  function boatmanState(env) {
    const c = BM.cycle(env.t);
    const Rr = (pts) => rot(pts, BM.hip[0], BM.hip[1], c.lean);
    const hu = Rr([BM.hu])[0];
    const dx = -Math.sin(c.th), dy = Math.cos(c.th);
    const hl = [hu[0] + 15 * dx, hu[1] + 15 * dy];
    const tip = [hl[0] + c.slide * dx, hl[1] + c.slide * dy];
    const top = [tip[0] - 170 * dx, tip[1] - 170 * dy];
    return { c, R: Rr, hu, hl, tip, top };
  }
  def('boatman', 'pole', () => {
    const parts = [], folds = [];
    parts.push({ z: 2, c: 'body', pts: BM.legs[0] }, { z: 1.9, c: 'body', pts: BM.legs[1] });
    folds.push({ pts: [[5.0, -24.6], [12.0, -25.2]], w: 0.5 }, { pts: [[-10.6, -25.0], [-4.8, -24.4]], w: 0.5 }, { pts: [[2.6, -46], [6.0, -36], [8.6, -28]], w: 0.5 });
    return {
      parts, folds, breathPh: 0.5,
      snowFn(env) {
        const Rr = boatmanState(env).R;
        return [{ pts: Rr([[-11.6, -92.8], [-6.4, -95.2], [-1.4, -98.4], [0.6, -101.2], [1.6, -103.0]]), th: 1.2 }, { pts: Rr([[1.6, -103.0], [2.6, -101.2], [4.8, -98.4], [9.4, -95.2], [13.8, -93.2]]), th: 1.2 }];
      },
      dyn(env, out) {
        const S = boatmanState(env), Rr = S.R;
        out.push({ z: 2, c: 'body', pts: Rr(BM.torso), fl: 1 });
        out.push({ z: 2, c: 'body', pts: Rr(BM.head) });
        out.push({ z: 5, c: 'straw', pts: Rr(BM.hat) });
        out.push({ z: 1.5, c: 'body', cls: 'shade', sh: 1, pts: Rr(BM.farUpper) });
        // 远侧小臂横过胸前握住下手：肘端圆收；与身体同色，只沿上缘留一道细褶线把它和躯干分开（不描整圈分隔线）
        const el = Rr([BM.elbow])[0], hl = S.hl;
        const fw = (s) => 4.4 - 1.6 * s;
        out.push({ z: 2.6, c: 'body', pts: limb([el, [(el[0] + hl[0]) / 2, (el[1] + hl[1]) / 2 + 0.6], hl], fw) });
        {
          const ux = hl[0] - el[0], uy = hl[1] - el[1], ul = Math.hypot(ux, uy) || 1;
          let nx = -uy / ul, ny = ux / ul;
          if (ny > 0) { nx = -nx; ny = -ny; }
          const fp = [];
          for (const s of [0.04, 0.3, 0.55, 0.8]) {
            const k = fw(s) / 2 - 0.55, cy = s * (1 - s) * 4 * 0.6;
            fp.push([el[0] + ux * s + nx * k, el[1] + uy * s + cy + ny * k]);
          }
          out.push({ fold: 1, z: 2.6, c: 'body', pts: fp, w: 0.42 });
        }
        out.push({ z: 2.6, c: 'body', pts: Rr(BM.arm) });
        // 篙：撑在身体远侧（画在人身后，双手握在篙上），水面以下裁掉
        out.push({ z: 3, c: 'pole', pts: rod(S.top, S.tip, 1.35, 1.6, true, true) });
        out.push({ z: 3.5, c: 'body', pts: rot(shift(BM.fist, S.hu[0], S.hu[1]), S.hu[0], S.hu[1], -S.c.th) });
        out.push({ z: 3.5, c: 'body', pts: rot(shift(BM.fist, S.hl[0], S.hl[1]), S.hl[0], S.hl[1], -S.c.th) });
      },
    };
  });

  // ======================================================================
  // 编译与绘制
  // ======================================================================
  const CACHE = {};
  const HAT_POSES = { standSide: 1, walkSide: 1, sitSide: 1 };
  const variantOf = (who, pose, o) => (o && o.hat && who === 'old' && HAT_POSES[pose] ? 'hat' : '');
  // 部件类别（pt.cls）：
  //   'thin'  细件（发丝、发带、剑穗、簪、草穗、剑柄、系绳……）：不描轮廓光，也不参与轮廓光的判定；
  //   'shade' 在身体背光一侧的部件（远侧手臂、身后的斗篷）：pt.sh = 1 表示光从单位坐标 +x 侧（人物面向的一侧）来时
  //           它被身体挡住，这时不描轮廓光；光从另一侧来时它是普通部件。
  //   'norim' 按前后次序画进剪影、参与判定，但自身不描轮廓光（压在袖上的披帛垂端）；
  //   默认（''）是有厚度的主体。点缀色（发带、披帛、簪、草穗）默认算细件，可用 cls: '' 改回主体。
  const AUTO_THIN = { blue: 1, pink: 1, gold: 1, fringe: 1 };
  const clsOf = (pt) => (pt.cls != null ? pt.cls : AUTO_THIN[pt.c] ? 'thin' : '');
  const lkey = (z, c, cls, sh) => z + '|' + c + '|' + (cls || '') + (cls === 'shade' ? (sh > 0 ? '+' : '-') : '');
  function addFold(fp, f) {
    const prof = f.flat ? () => f.w : (s) => f.w * Math.pow(Math.sin(Math.PI * clamp(s, 0, 1)), 0.7) + 0.02;
    addSmooth(fp, taper(f.pts, prof, f.flat ? 'cut' : 'round', f.flat ? 1e-4 : undefined), true);
  }
  // 与 addSmooth 同样的曲线，按弧长约 step 取样，返回 [x, y, 布边颤动权重]（只在载入时用）
  function sampleSmooth(pts, step) {
    const n = pts.length, out = [];
    if (area(pts) < 0) pts = pts.slice().reverse();
    const get = (i) => pts[((i % n) + n) % n];
    for (let i = 0; i < n; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      const D1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const D2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1e-6;
      const D3 = Math.hypot(p3[0] - p2[0], p3[1] - p2[1]);
      const s1 = Math.sqrt(D1), s2 = Math.sqrt(D2), s3 = Math.sqrt(D3);
      let c1x, c1y, c2x, c2y;
      if (p1[2] || D1 < 1e-5) { c1x = p1[0] + (p2[0] - p1[0]) / 3; c1y = p1[1] + (p2[1] - p1[1]) / 3; }
      else { const k = 3 * s1 * (s1 + s2), m = 2 * D1 + 3 * s1 * s2 + D2; c1x = (p2[0] * D1 - p0[0] * D2 + p1[0] * m) / k; c1y = (p2[1] * D1 - p0[1] * D2 + p1[1] * m) / k; }
      if (p2[2] || D3 < 1e-5) { c2x = p2[0] + (p1[0] - p2[0]) / 3; c2y = p2[1] + (p1[1] - p2[1]) / 3; }
      else { const k = 3 * s3 * (s3 + s2), m = 2 * D3 + 3 * s3 * s2 + D2; c2x = (p1[0] * D3 - p3[0] * D2 + p2[0] * m) / k; c2y = (p1[1] * D3 - p3[1] * D2 + p2[1] * m) / k; }
      const steps = Math.max(1, Math.ceil(D2 / step)), w1 = p1[3] || 0, w2 = p2[3] || 0;
      for (let k = 0; k < steps; k++) {
        const t = k / steps, mt = 1 - t;
        const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
        out.push([a * p1[0] + b * c1x + c * c2x + d * p2[0], a * p1[1] + b * c1y + c * c2y + d * p2[1], w1 + (w2 - w1) * t]);
      }
    }
    return out;
  }
  const pipCtx = (() => { try { const cv = document.createElement('canvas'); cv.width = cv.height = 1; return cv.getContext('2d'); } catch (e) { return null; } })();
  // 分隔细线：上层部件（手臂、袖、剑）压在下层主体上的那一段轮廓，载入时算好，画成贴着轮廓的细带（一半在上层部件外、
  // 落在下层主体上，另一半被上层部件盖住）。只取下层主体确实在下面、且布边几乎不动的那几段，所以不会画到背景上
  function buildSeps(P) {
    if (!pipCtx) return;
    for (const L of P.layers) {
      if (!L.sep || L.cls || EXT[L.c]) continue;
      const lower = new Path2D();
      let any = false;
      for (const pt of P.extra.parts) {
        if (pt.z >= L.z || EXT[pt.c] || clsOf(pt)) continue;
        addSmooth(lower, pt.pts, true); any = true;
      }
      if (!any) continue;
      const sp = new Path2D(), sep = L.sep, step = 0.45, o1 = sep * 0.5 + 0.3, o2 = sep * 0.5 + 0.8;
      const trim = Math.ceil((sep * 0.7) / step);
      let nb = 0;
      const emit = (run) => {
        if (run.length <= 2 * trim + 2) return;
        const r = run.slice(trim, run.length - trim), pts = [];
        // 带子的中线隔 ~1.35 个单位取一个点（判定是逐 0.45 个单位做的），少画一些曲线段
        for (let i = 0; i < r.length; i += 3) pts.push([r[i][0], r[i][1]]);
        if ((r.length - 1) % 3) pts.push([r[r.length - 1][0], r[r.length - 1][1]]);
        if (pts.length < 2) return;
        addSmooth(sp, taper(pts, () => sep, 'round'), true);
        nb++;
      };
      for (const pt of L.parts) {
        const self = new Path2D(); addSmooth(self, pt.pts, true);
        const S = sampleSmooth(pt.pts, step), n = S.length, ok = new Uint8Array(n);
        for (let k = 0; k < n; k++) {
          const a = S[(k - 1 + n) % n], b = S[(k + 1) % n], p = S[k];
          let tx = b[0] - a[0], ty = b[1] - a[1];
          const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          let nx = -ty, ny = tx;
          if (pipCtx.isPointInPath(self, p[0] + nx * 0.3, p[1] + ny * 0.3)) { nx = -nx; ny = -ny; }
          ok[k] = p[2] < 0.05 && !pipCtx.isPointInPath(self, p[0] + nx * o1, p[1] + ny * o1) &&
            pipCtx.isPointInPath(lower, p[0] + nx * o1, p[1] + ny * o1) && pipCtx.isPointInPath(lower, p[0] + nx * o2, p[1] + ny * o2) ? 1 : 0;
        }
        let st = -1;
        for (let k = 0; k < n; k++) if (!ok[k]) { st = k; break; }
        if (st < 0) { emit(S.concat([S[0]])); continue; }
        let run = [];
        for (let m = 1; m <= n; m++) {
          const idx = (st + m) % n;
          if (ok[idx]) run.push(S[idx]);
          else { emit(run); run = []; }
        }
        emit(run);
      }
      if (nb) L.sepPath = sp;
    }
  }
  function getPose(who, pose, vk) {
    vk = vk || '';
    const key = who + '/' + pose + '/' + vk;
    let P = CACHE[key];
    if (P) return P;
    const b = DEF[who] && DEF[who][pose];
    if (!b) return null;
    const d = b({ hat: vk === 'hat' });
    P = { who, pose, key, layers: [], dyn: d.dyn || null, snow: d.snow || [], walk: d.walk || null, extra: d, accent: ACCENT[who] || 'blue' };
    // 不描轮廓光的区域（nrz）：按光从哪一侧来分成两组路径
    P.nrz = {};
    for (const z of d.nrz || []) { const k = z.sh > 0 ? 1 : -1, path = new Path2D(); addSmooth(path, z.pts, true); (P.nrz[k] = P.nrz[k] || []).push({ path, fade: z.fade || null }); }
    const lmap = new Map();
    const layer = (z, c, cls, sh) => {
      const k = lkey(z, c, cls, sh);
      let L = lmap.get(k);
      if (!L) { L = { z, c, k, cls: cls || '', sh: sh > 0 ? 1 : sh < 0 ? -1 : 0, path: new Path2D(), n: 0, dyn: [], sep: 0, parts: [], bb: null, spolys: [] }; lmap.set(k, L); P.layers.push(L); }
      return L;
    };
    for (const pt of d.parts) {
      const L = layer(pt.z, pt.c, clsOf(pt), pt.sh);
      L.parts.push(pt);
      if (pt.sep) L.sep = Math.max(L.sep, pt.sep);
      if (pt.dyn) L.dyn.push(pt); else {
        addSmooth(L.path, pt.pts, true); L.n++;
        if (EXT[pt.c]) L.xpts = (L.xpts || []).concat(pt.pts);
        else { L.spolys.push(pt.pts); const b = L.bb || (L.bb = [1e9, -1e9, 1e9, -1e9]); for (const q of pt.pts) { if (q[0] < b[0]) b[0] = q[0]; if (q[0] > b[1]) b[1] = q[0]; if (q[1] < b[2]) b[2] = q[1]; if (q[1] > b[3]) b[3] = q[1]; } }
      }
    }
    // 衣褶：渐细的带状形（腰带为等宽），静态预建；默认画在 z=2 的身体层上，也可指定 {z, c, cls}
    P.folds = new Map();
    for (const f of d.folds || []) {
      const k = lkey(f.z == null ? 2 : f.z, f.c || 'body', f.cls, f.sh);
      let fp = P.folds.get(k);
      if (!fp) { fp = new Path2D(); P.folds.set(k, fp); }
      addFold(fp, f);
    }
    P.layers.sort((a, b) => a.z - b.z);
    P.lkeys = new Set(P.layers.map((L) => L.k));
    // 静态部件的范围（不含篙、钓竿、剑身这类外挂件）
    P.sbox = [1e9, -1e9, 1e9, -1e9];
    for (const pt of d.parts) if (!pt.dyn && !EXT[pt.c]) for (const q of pt.pts) { if (q[0] < P.sbox[0]) P.sbox[0] = q[0]; if (q[0] > P.sbox[1]) P.sbox[1] = q[0]; if (q[1] < P.sbox[2]) P.sbox[2] = q[1]; if (q[1] > P.sbox[3]) P.sbox[3] = q[1]; }
    buildSeps(P);
    CACHE[key] = P;
    P.box = computeBox(P);
    return P;
  }

  function colorOf(c, o, P) {
    const body = o.body || COL.body;
    switch (c) {
      case 'body': case 'rod': return body;
      case 'hairD': return mix(body, '#000000', 0.32);
      case 'obj': case 'prop': return mix(body, '#6d7686', 0.16);
      case 'hair': return COL.hair;
      case 'blue': return (P.accent === 'blue' && o.accent) || (P.who === 'old' ? COL.blueOld : COL.blue);
      case 'pink': return (P.accent === 'pink' && o.accent) || COL.pink;
      case 'gourd': return COL.gourd;
      case 'straw': case 'fringe': return mix(body, COL.straw, 0.55);
      case 'blade': return mix(body, '#aeb9c6', 0.55);
      case 'gold': return COL.gold;
      case 'pole': return mix(body, '#5a4632', 0.35);
      default: return body;
    }
  }
  function foldColorOf(c, col, body) {
    switch (c) {
      case 'hair': return mix(COL.hair, '#5f5b55', 0.32);
      case 'straw': case 'fringe': return mix(col, '#c8a870', 0.16);
      case 'pink': return mix(col, '#b06a80', 0.3);
      case 'hairD': return mix(col, '#a9b3c4', 0.09);
      case 'gourd': return mix(col, '#c99a5a', 0.35);
      default: return mix(body, '#a9b3c4', 0.085);
    }
  }
  // 周身柔光的色调直接混进各部件颜色（不再多一遍整张合成）
  const tint = (col, o, gq) => (gq > 0 ? mix(col, o.rim || '#fff1d2', Math.round(0.12 * gq * 1000) / 1000) : col);

  function makeEnv(t, o, facing, P) {
    const wind = o.wind == null ? 0.25 : clamp(o.wind, 0, 1);
    const wdir = o.windDir == null ? 1 : (o.windDir < 0 ? -1 : 1);
    const w = wind * wdir * facing;
    const env = { t, w, wa: Math.abs(w), facing, walkT: t + (o.walkPhase || 0), o };
    if (P && P.extra.envFn) P.extra.envFn(env);
    env.ws = walkState(env);
    env.isWalk = !!(P && P.walk);
    return env;
  }

  // 返回本帧的图层 [{z, c, cls, sh, path, sepPath, sepLive, fold}]：静态路径 + 本帧动态部件；动态衣褶并进对应图层。
  // 同时记下本帧动态部件的范围（res.box），离屏画布只开到本帧实际需要的大小
  function collect(P, env) {
    const dynOut = [];
    if (P.dyn) P.dyn(env, dynOut);
    const bb = P.sbox.slice();
    let xb = null; // 外挂件（篙、钓竿、钓线、剑身）本帧的范围，篙和钓竿算到水面为止
    const xacc = (pts, c) => {
      if (!xb) xb = [1e9, -1e9, 1e9, -1e9];
      const wy = c !== 'line' && env.waterU != null ? env.waterU : 1e9;
      for (const q of pts) { const y = Math.min(q[1], wy); if (q[0] < xb[0]) xb[0] = q[0]; if (q[0] > xb[1]) xb[1] = q[0]; if (y < xb[2]) xb[2] = y; if (y > xb[3]) xb[3] = y; }
    };
    let lb = null, lp = null; // 当前图层本帧的范围、轮廓点列（给轮廓光判定用）
    const add = (p, pts, ext, c) => {
      if (!ext) { lp.push(pts); for (const q of pts) { if (q[0] < lb[0]) lb[0] = q[0]; if (q[0] > lb[1]) lb[1] = q[0]; if (q[1] < lb[2]) lb[2] = q[1]; if (q[1] > lb[3]) lb[3] = q[1]; } }
      else xacc(pts, c);
      addSmooth(p, pts, true);
    };
    const extra = new Map(), dfold = new Map();
    for (const pt of dynOut) {
      const k = lkey(pt.z, pt.c, clsOf(pt), pt.sh);
      const m = pt.fold ? dfold : extra;
      let a = m.get(k);
      if (!a) { a = []; m.set(k, a); }
      a.push(pt);
    }
    const res = [];
    for (const L of P.layers) {
      const ex = extra.get(L.k);
      if (!L.dyn.length && !ex) { res.push({ z: L.z, c: L.c, k: L.k, cls: L.cls, sh: L.sh, path: L.path, sepPath: L.sepPath, sepLive: 0, bb: L.bb, polys: L.spolys }); continue; }
      const p = new Path2D(), xt = !!EXT[L.c];
      let live = 0;
      lb = L.bb ? L.bb.slice() : [1e9, -1e9, 1e9, -1e9]; lp = L.spolys.slice();
      if (L.n) p.addPath(L.path);
      if (L.n && xt) xacc(L.xpts, L.c);
      for (const pt of L.dyn) add(p, flutter(env, pt.pts, pt.fa, pt.lift), xt, L.c);
      if (ex) for (const pt of ex) { add(p, pt.fl ? flutter(env, pt.pts, pt.fa, pt.lift) : pt.pts, xt, L.c); if (pt.sep) live = Math.max(live, pt.sep); }
      res.push({ z: L.z, c: L.c, k: L.k, cls: L.cls, sh: L.sh, path: p, sepPath: L.sepPath, sepLive: live, bb: xt ? null : lb, polys: lp });
    }
    for (const [k, arr] of extra) {
      if (P.lkeys.has(k)) continue;
      const p = new Path2D(), a0 = arr[0], xt = !!EXT[a0.c];
      let live = 0;
      lb = [1e9, -1e9, 1e9, -1e9]; lp = [];
      for (const pt of arr) { add(p, pt.fl ? flutter(env, pt.pts, pt.fa, pt.lift) : pt.pts, xt, a0.c); if (pt.sep) live = Math.max(live, pt.sep); }
      const cls = clsOf(a0);
      res.push({ z: a0.z, c: a0.c, k, cls, sh: a0.sh > 0 ? 1 : a0.sh < 0 ? -1 : 0, path: p, sepPath: null, sepLive: live, bb: xt ? null : lb, polys: lp });
    }
    for (const r of res) {
      const sf = P.folds.get(r.k), df = dfold.get(r.k);
      if (df) { const fp = new Path2D(); if (sf) fp.addPath(sf); for (const f of df) addFold(fp, f); r.fold = fp; } else r.fold = sf || null;
    }
    // 静态的外挂件（举起的剑身）不经过上面的 add，单独并进范围
    for (const L of P.layers) if (EXT[L.c] && L.n && !extra.get(L.k) && !L.dyn.length) xacc(L.xpts, L.c);
    res.sort((a, b) => a.z - b.z);
    for (const r of res) if (r.bb) { const b = r.bb; if (b[0] < bb[0]) bb[0] = b[0]; if (b[1] > bb[1]) bb[1] = b[1]; if (b[2] < bb[2]) bb[2] = b[2]; if (b[3] > bb[3]) bb[3] = b[3]; }
    res.box = bb;
    res.xbox = xb;
    return res;
  }

  function snowPath(caps, amt) {
    const p = new Path2D();
    for (const cap of caps) {
      const pts = cap.pts, n = pts.length;
      if (n < 2) continue;
      // 沿顶面向上加厚（中间厚、两端薄），底边略压进身体
      const top = [], bot = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        let nx = ty, ny = -tx; // 左手法线
        if (ny > 0) { nx = -nx; ny = -ny; }
        const s = i / (n - 1), prof = Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * s)), 0.6);
        const th = cap.th * 1.45 * amt * prof;
        top.push([pts[i][0] + nx * th, pts[i][1] + ny * th]);
        bot.push([pts[i][0] - nx * 0.25, pts[i][1] - ny * 0.25]);
      }
      top[0][2] = 1; top[n - 1][2] = 1;
      addSmooth(p, top.concat(bot.reverse()), true);
    }
    return p;
  }

  // 细长的外挂件不进离屏剪影（否则离屏画布会被拉得很大）：篙、倚墙的剑（prop）画在人身后，钓竿、钓线、举起的剑身画在人前面；
  // 篙与钓竿、钓线在水面处截断；篙、钓竿、剑身、倚墙的剑作为独立刚体在迎光一侧描自己的一道均匀轮廓光
  const EXT = { pole: 'back', rod: 'front', line: 'front', blade: 'front', prop: 'back' };
  function paintExt(g, L, P, env, x, y, h, o, gq) {
    const u = h / U, facing = env.facing;
    const body = o.body || COL.body;
    g.save();
    g.translate(x, y); g.scale(facing * u, u * env.breath);
    if (P.walk) g.translate(0, env.ws.bob);
    if (L.c !== 'line' && env.waterU != null) { g.beginPath(); g.rect(-2000, -2000, 4000, 2000 + env.waterU); g.clip(); }
    if (L.c === 'line') {
      g.fillStyle = tint(o.rim ? mix(o.rim, body, 0.55) : body, o, gq);
      g.fill(L.path);
    } else {
      const col = tint(colorOf(L.c, o, P), o, gq);
      if (o.rim) {
        // 细长物件的轮廓光：先用轮廓光色填，再把同一形状向背光一侧挪半个亮边宽用本色填（不用裁切，背光侧只多出不到 1 像素）
        const rwu = 0.5 * (o.rimWidth || Math.max(1, h / 120)) / u, side = o.rimSide == null ? 1 : (o.rimSide < 0 ? -1 : 1);
        g.fillStyle = o.rim; g.fill(L.path);
        g.translate(-side * facing * rwu, 0.35 * rwu); g.fillStyle = col; g.fill(L.path);
      } else { g.fillStyle = col; g.fill(L.path); }
    }
    g.restore();
  }

  // 按次序画图层（单位坐标）：分隔细线（预建的细带，或本帧动态部件的描边）→ 填色 → 衣褶。全部 source-over，
  // 只有本帧才生成的动态部件的分隔线需要 source-atop（只落在已画的部分上）
  function paintLayers(c, list, o, P, gq) {
    const body = o.body || COL.body;
    const sepCol = tint(mix(body, '#a9b3c4', 0.12), o, gq);
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const L of list) {
      if (EXT[L.c]) continue;
      if (L.sepPath) { c.fillStyle = sepCol; c.fill(L.sepPath); }
      if (L.sepLive) {
        c.globalCompositeOperation = 'source-atop';
        c.strokeStyle = sepCol; c.lineWidth = L.sepLive; c.stroke(L.path);
        c.globalCompositeOperation = 'source-over';
      }
      const col = colorOf(L.c, o, P);
      c.fillStyle = tint(col, o, gq); c.fill(L.path);
      if (L.fold) { c.fillStyle = tint(foldColorOf(L.c, col, body), o, gq); c.fill(L.fold); }
    }
  }
  // 积雪：设计好的雪帽（斗笠顶、肩、头顶），亮色压在上沿，在轮廓光之前画进剪影
  function paintSnow(c, P, env, o, gq) {
    const snow = o.snow ? clamp(o.snow, 0, 1) : 0;
    if (snow <= 0.01) return null;
    const caps = P.extra.snowFn ? P.extra.snowFn(env) : P.snow;
    if (!caps.length) return null;
    const sp = snowPath(caps, snow);
    c.save(); c.translate(0, -0.4); c.fillStyle = tint('#f4f7fa', o, gq); c.fill(sp); c.restore();
    c.fillStyle = tint('#dce3eb', o, gq); c.fill(sp);
    return sp;
  }

  // ---------------- 离屏画布：按尺寸分档复用，画布只比需要的大一点 ----------------
  // 直接画到调用方画布上的离屏画布（剪影、半透明时的合成画布）按尺寸各轮换 RING 张：调用方画布还没执行完上一次的绘制时，
  // 下一次绘制写的是另一张，浏览器不必先整张复制一份（写时复制），也就不需要每画一个人就读回一次像素来强制执行
  const pool = new Map(), RING = 2, ringAt = {};
  const ladder = (v) => { let s = 16; while (s < v) s = s % 3 === 0 ? (s / 3) * 4 : (s / 2) * 3; return s; };
  function buf(i, w, h, noClear, rf, ring) {
    const bw = ladder(w), bh = ladder(h);
    let key = (rf ? 'r' : '') + i + ':' + bw + 'x' + bh;
    if (ring) { const r = ringAt[key] = ((ringAt[key] || 0) + 1) % RING; key += '#' + r; }
    let b = pool.get(key);
    if (!b) {
      const cv = document.createElement('canvas');
      cv.width = bw; cv.height = bh;
      b = { cv, c: cv.getContext('2d', rf ? { willReadFrequently: true } : undefined) };
      if (pool.size > 72) pool.delete(pool.keys().next().value);
    } else pool.delete(key);
    pool.set(key, b); // 最近使用的放到最后
    b.c.setTransform(1, 0, 0, 1, 0, 0);
    b.c.globalCompositeOperation = 'source-over';
    b.c.globalAlpha = 1;
    b.c.imageSmoothingEnabled = true;
    if (!noClear) b.c.clearRect(0, 0, w, h);
    return b;
  }
  const kdPool = new Map();
  let covA = new Uint8ClampedArray(4096), covT = new Uint8ClampedArray(4096), kgrid = new Uint8Array(4096), colU = new Int32Array(256), rowM = new Uint8Array(4096);

  // 周身柔光：画在人物身后（主画布上），圆心与半径取自包围盒；径向渐变预先画成小图再缩放
  const glowSprites = new Map();
  function glowSprite(col) {
    let s = glowSprites.get(col);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 128;
    const gg = s.getContext('2d'), gc = rgb(col);
    const gr = gg.createRadialGradient(64, 64, 0.5, 64, 64, 64);
    gr.addColorStop(0, `rgba(${gc[0]},${gc[1]},${gc[2]},0.42)`);
    gr.addColorStop(0.45, `rgba(${gc[0]},${gc[1]},${gc[2]},0.16)`);
    gr.addColorStop(1, `rgba(${gc[0]},${gc[1]},${gc[2]},0)`);
    gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128);
    if (glowSprites.size > 16) glowSprites.clear();
    glowSprites.set(col, s);
    return s;
  }
  // 柔光是贴着身形的椭圆（站姿竖长、卧姿横长），比外接圆少画四成以上的像素；柔光图按实际像素大小缓存（半径取整到
  // 4 像素一档），整像素位置直接贴上，不做缩放取样
  function paintGlow(g, P, o, glow, x, y, u, facing) {
    const b = P.box;
    const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2, bw = b.r - b.l, bh = b.b - b.t;
    const T = g.getTransform(), S = Math.hypot(T.a, T.b) || 1;
    const rq = (v) => Math.max(8, Math.round(((0.62 * v + 12) * u * S) / 4) * 4);
    const rx = rq(Math.max(bw, 0.55 * bh)), ry = rq(Math.max(bh, 0.55 * bw));
    const col = o.rim || '#fff1d2', key = col + '|' + rx + 'x' + ry;
    let sp = glowSprites.get(key);
    if (!sp) {
      sp = document.createElement('canvas'); sp.width = 2 * rx; sp.height = 2 * ry;
      const gg = sp.getContext('2d');
      gg.drawImage(glowSprite(col), 0, 0, 128, 128, 0, 0, 2 * rx, 2 * ry);
      if (glowSprites.size > 16) glowSprites.clear();
      glowSprites.set(key, sp);
    }
    g.save();
    g.globalAlpha *= glow;
    const px = x + facing * cx * u, py = y + cy * u;
    if (Math.abs(T.b) < 1e-9 && Math.abs(T.c) < 1e-9) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(sp, Math.round(T.a * px + T.e - rx), Math.round(T.d * py + T.f - ry));
    } else g.drawImage(sp, px - rx / S, py - ry / S, (2 * rx) / S, (2 * ry) / S);
    g.restore();
  }

  // 轮廓光的判定（低分辨率，逐行）：A 是缩小 f 倍的剪影不透明度（只含主体，不含细件），在 K 里标出不该亮的地方：
  //   1) 细的一段：一串连续有料的像素，总宽不到 2.2·rimW（尖梢、细窄的边角），整段不亮；
  //   2) 迎光边对着窄缝：从实心段迎光一端往光的方向扫，到下一块主体之前的空隙不到 3·rimW（缝后面还是身体，
  //      光照不进来），就把这条边整条（迎光端往里 rimW 再多一点）标掉。按“边”判定而不是逐像素判定，
  //      所以一条边要么整条亮、要么整条不亮，不会出现亮线往里缩、外侧留一道暗线的情况；
  //      部分透明的像素（缩小后的窄缝、抗锯齿边）按 (1 - 不透明度) 计入缝宽。
  function rimAnalyze(A, K, w, h, f, rimW, side, Tn) {
    const G = 3.0 * rimW, T = 2.2 * rimW, kd = Math.ceil(rimW / f) + 2, kb = Math.ceil(rimW / f) + 1;
    const n = w * h;
    if (kgrid.length < n) kgrid = new Uint8Array(n * 2);
    const kg = kgrid;
    kg.fill(0, 0, n);
    const G125 = 1.1 * G, G075 = 0.9 * G, T125 = 1.25 * T, T08 = 0.8 * T, fa = f / 255;
    const d4 = side > 0 ? 1 : -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      // i 沿光的方向递增；A（主体覆盖度）、Tn（细件覆盖度）中第 i 个格子的下标 = a0 + i * d4
      const a0 = row + (side > 0 ? 0 : w - 1), t0 = a0;
      const kx0 = side > 0 ? row : row + w - 1, kdx = side > 0 ? 1 : -1;
      let i = 0;
      while (i < w) {
        if (A[a0 + i * d4] >= 64) {
          let j = i, s = 0;
          while (j < w) { const v = A[a0 + j * d4]; if (v < 64) break; s += v; j++; }
          const wpx = s * fa;
          // 近乎水平的边（头顶、笠顶、膝头的缓坡）在某一行里只切到薄薄一片：上一行或下一行在这片的两头外侧都还是实的，
          // 说明它是一大块主体的边，不是细窄的尖梢，不能整段标掉（否则边一挪动，这一行的亮边就时有时无）
          let sliver = false;
          if (wpx < T125) for (const dy of [-1, 1]) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            const b0 = yy * w + (side > 0 ? 0 : w - 1);
            const la = i > 0 ? A[b0 + (i - 1) * d4] : 255, ra = j < w ? A[b0 + j * d4] : 255;
            if (la >= 128 && ra >= 128) { sliver = true; break; }
          }
          if (wpx < T125 && !sliver) {
            const kv = Math.round(255 * sstep(T125, T08, wpx));
            const q0 = i > 1 ? i - 2 : 0, q1 = j + 1 < w ? j + 1 : w - 1;
            for (let q = q0; q <= q1; q++) { const kk = kx0 + q * kdx; if (kg[kk] < kv) kg[kk] = kv; }
          }
          i = j;
        } else i++;
      }
      i = 0;
      while (i < w) {
        if (A[a0 + i * d4] >= 230) {
          let j = i;
          while (j < w && A[a0 + j * d4] >= 230) j++;
          // 往光的方向扫：紧挨实心段的第一个格子里是这条边自己的抗锯齿，只计它空的部分；之后每个格子的空、实按覆盖度
          // 累加，实的累计到半格就算碰到了下一块主体，缝宽 = 一路累计的空。窗口是 1.1G，缝宽到 1.1G 时压暗为 0，
          // 所以有东西从远处靠近、或者边慢慢移动时，压暗的程度是连续变化的，不会一帧一帧地跳
          // 只有覆盖度比途中最低处回升的部分才算“实”（另一块主体的边）：单调变淡的一段是这条边自己斜着穿过格子留下的坡，
          // 缓坡的边（膝头、笠沿、钓竿）不会被当成窄缝
          let gap = j < w ? (255 - A[a0 + j * d4]) * fa : 0, mat = 0, k = j + 1, stop = false, mn = j < w ? A[a0 + j * d4] : 0;
          while (k < w && gap < G125) {
            const ak = A[a0 + k * d4];
            if (ak < mn) mn = ak;
            gap += (255 - ak) * fa;
            const rise = ak - mn - 16;
            if (rise > 0) { mat += rise * fa; if (mat >= 0.5 * f) { stop = true; break; } }
            k++;
          }
          let kv = stop && gap < G125 ? 255 * sstep(G125, G075, gap) : 0;
          // 细件（发带、剑穗、披帛、发丝）压在亮带上或在亮边外侧：按它离这条边的距离连续地压暗
          if (Tn && kv < 255) {
            const q1 = k < w ? k : w - 1;
            for (let q = j > kb ? j - kb : 0; q <= q1; q++) {
              const v = Tn[t0 + q * d4];
              if (!v) continue;
              const dist = q <= j ? 0 : (q - j) * f;
              const tv = Math.min(255, v * 3.3) * (dist ? sstep(G125, G075, dist) : 1);
              if (tv > kv) kv = tv;
            }
          }
          if (kv >= 1) {
            kv = Math.round(kv);
            const q0 = j - 1 - kd > 0 ? j - 1 - kd : 0, q1 = j + 1 < w ? j + 1 : w - 1;
            for (let q = q0; q <= q1; q++) { const kk = kx0 + q * kdx; if (kg[kk] < kv) kg[kk] = kv; }
          }
          i = j;
        } else i++;
      }
    }
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (let y = 0, r = 0; y < h; y++, r += w) for (let x = 0; x < w; x++) {
      const v = kg[r + x];
      if (v) { K[(r + x) * 4 + 3] = v; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? null : [x0, x1, y0, y1];
  }
  // 轮廓光：亮带 = 剪影 − 剪影向光的方向平移 rimW（小数平移用双线性取样，宽度随 h 连续变化）− 低分辨率判定标掉的部分；
  // 亮带本身不乘剪影的覆盖度，最后 source-atop 盖到剪影上，外缘抗锯齿不变。只有两遍整张的非 source-over 合成
  // 判定用的低分辨率覆盖度直接在 JS 里由轮廓多边形（控制点连成的折线）扫描得到：每行在格子中线处求交点，同一多边形内按奇偶
  // 填充，不同多边形的覆盖度相加（封顶 255）。不读回画布，不打断绘制流水线
  let crossX = new Float32Array(4096), crossN = new Uint16Array(512);
  const MAXC = 10;
  function covRaster(cov, w, h, polys, ax, bx, ay, by) {
    if (crossN.length < h) crossN = new Uint16Array(h * 2);
    if (crossX.length < h * MAXC) crossX = new Float32Array(h * MAXC * 2);
    const CX = crossX, CN = crossN;
    for (const pts of polys) {
      const n = pts.length;
      if (n < 3) continue;
      let ymin = 1e9, ymax = -1e9;
      for (let i = 0; i < n; i++) { const Y = ay * pts[i][1] + by; if (Y < ymin) ymin = Y; if (Y > ymax) ymax = Y; }
      const r0 = Math.max(0, Math.ceil(ymin - 0.5)), r1 = Math.min(h - 1, Math.ceil(ymax - 0.5) - 1);
      if (r1 < r0) continue;
      for (let r = r0; r <= r1; r++) CN[r] = 0;
      let px0 = ax * pts[n - 1][0] + bx, py0 = ay * pts[n - 1][1] + by;
      for (let i = 0; i < n; i++) {
        const qx = ax * pts[i][0] + bx, qy = ay * pts[i][1] + by;
        if (qy !== py0) {
          const ylo = qy < py0 ? qy : py0, yhi = qy < py0 ? py0 : qy, k = (qx - px0) / (qy - py0);
          let ra = Math.ceil(ylo - 0.5), rb = Math.ceil(yhi - 0.5) - 1;
          if (ra < r0) ra = r0; if (rb > r1) rb = r1;
          for (let r = ra; r <= rb; r++) { const c = CN[r]; if (c < MAXC) { CX[r * MAXC + c] = px0 + (r + 0.5 - py0) * k; CN[r] = c + 1; } }
        }
        px0 = qx; py0 = qy;
      }
      for (let r = r0; r <= r1; r++) {
        const c = CN[r];
        if (c < 2) continue;
        const b0 = r * MAXC;
        for (let i = 1; i < c; i++) { const v = CX[b0 + i]; let j = i - 1; while (j >= 0 && CX[b0 + j] > v) { CX[b0 + j + 1] = CX[b0 + j]; j--; } CX[b0 + j + 1] = v; }
        const ro = r * w;
        for (let q = 0; q + 1 < c; q += 2) {
          let xa = CX[b0 + q], xb = CX[b0 + q + 1];
          if (xb <= 0 || xa >= w) continue;
          if (xa < 0) xa = 0; if (xb > w) xb = w;
          const ia = xa | 0, ib = xb | 0;
          if (ia === ib) { cov[ro + ia] += (xb - xa) * 255; continue; }
          cov[ro + ia] += (ia + 1 - xa) * 255;
          for (let i = ia + 1; i < ib; i++) cov[ro + i] = 255;
          if (ib < w) cov[ro + ib] += (xb - ib) * 255;
        }
      }
    }
  }
  // tf = [ax, bx, ay, by]：单位坐标 → 离屏画布像素；thick / thin：主体与细件的轮廓多边形
  function rimPass(M, W, H, rimW, side, rimCol, killFn, tf, thick, thin) {
    const f = rimW < 1.5 ? 1 : rimW < 3 ? 2 : 4;
    const sw = W / f, sh = H / f, n = sw * sh;
    if (covA.length < n) { covA = new Uint8ClampedArray(n * 2); covT = new Uint8ClampedArray(n * 2); }
    covA.fill(0, 0, n);
    covRaster(covA, sw, sh, thick, tf[0] / f, tf[1] / f, tf[2] / f, tf[3] / f);
    if (thin) { covT.fill(0, 0, n); covRaster(covT, sw, sh, thin, tf[0] / f, tf[1] / f, tf[2] / f, tf[3] / f); }
    const kk = sw + 'x' + sh;
    let KD = kdPool.get(kk);
    if (!KD) { KD = new ImageData(sw, sh); if (kdPool.size > 24) kdPool.clear(); kdPool.set(kk, KD); } else KD.data.fill(0);
    const kb = rimAnalyze(covA, KD.data, sw, sh, f, rimW, side, thin ? covT : null);
    // 非 source-over 的合成（destination-out、source-atop）每个像素要贵五倍以上，所以只用两遍：遮罩 Kb（平移的剪影 ∪ 标掉的部分
    // ∪ 不描轮廓光的部件）全部用 source-over 拼；亮带 = 轮廓光色 destination-out 遮罩；再 source-atop 盖到剪影上。
    // 平移全部是整像素、最近邻取样（双线性的小数平移和放大要贵十倍）：亮带宽度的小数部分用相邻两个整像素偏移按权重叠出来
    const Kb = buf(3, W, H), kc = Kb.c;
    const ax = Math.floor(rimW), af = rimW - ax, ey = Math.round(0.35 * rimW);
    kc.imageSmoothingEnabled = false;
    if (af > 0.88 || ax === 0) kc.drawImage(M.cv, 0, 0, W, H, -side * (ax + 1), ey, W, H);
    else if (af < 0.12) kc.drawImage(M.cv, 0, 0, W, H, -side * ax, ey, W, H);
    else { kc.drawImage(M.cv, 0, 0, W, H, -side * (ax + 1), ey, W, H); kc.globalAlpha = 1 - af; kc.drawImage(M.cv, 0, 0, W, H, -side * ax, ey, W, H); kc.globalAlpha = 1; }
    if (kb) {
      // 标掉的格子放大回原尺寸：先双线性放大 2 倍（只在标掉的范围里），再最近邻放大到原尺寸，边界是软的，没有方块台阶
      const x0 = Math.max(0, kb[0] - 1), y0 = Math.max(0, kb[2] - 1), bw = Math.min(sw - 1, kb[1] + 1) - x0 + 1, bh = Math.min(sh - 1, kb[3] + 1) - y0 + 1;
      const KL = buf(1, sw, sh, false, true);
      KL.c.putImageData(KD, 0, 0, x0, y0, bw, bh);
      if (f === 1) kc.drawImage(KL.cv, x0, y0, bw, bh, x0, y0, bw, bh);
      else {
        const K2 = buf(6, 2 * bw, 2 * bh);
        K2.c.drawImage(KL.cv, x0, y0, bw, bh, 0, 0, 2 * bw, 2 * bh);
        kc.drawImage(K2.cv, 0, 0, 2 * bw, 2 * bh, x0 * f, y0 * f, bw * f, bh * f);
      }
    }
    if (killFn) killFn(kc);
    const Rb = buf(4, W, H, true), rc = Rb.c;
    rc.fillStyle = rimCol; rc.fillRect(0, 0, W, H);
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(Kb.cv, 0, 0, W, H, 0, 0, W, H);
    rc.globalCompositeOperation = 'source-over';
    const c = M.c;
    c.globalCompositeOperation = 'source-atop';
    c.drawImage(Rb.cv, 0, 0, W, H, 0, 0, W, H);
    c.globalCompositeOperation = 'source-over';
  }

  function render(g, P, env, x, y, h, o, alpha) {
    const T = g.getTransform();
    const aligned = Math.abs(T.b) < 1e-9 && Math.abs(T.c) < 1e-9 && T.a > 0 && Math.abs(T.a - T.d) < 1e-6;
    const S = aligned ? T.a : (Math.max(Math.hypot(T.a, T.b), Math.hypot(T.c, T.d)) || 1);
    const facing = env.facing, u = h / U, px = u * S, breath = env.breath;
    const rimW = (o.rimWidth || Math.max(1, h / 120)) * S;
    // 本帧范围：静态部件 ∪ 本帧动态部件，外加曲线外凸、积雪、轮廓光的余量
    flatS = Math.max(0.25, px); // 本帧现算的路径按实际比例展平（render 结束时由 draw 复原）
    const layers = collect(P, env);
    if (o.line === 'only') { // 钓线单独一遍（画在船身前层之后，钓线不会被船舷挡住）
      const ga0 = g.globalAlpha; g.globalAlpha = ga0 * alpha;
      for (const L of layers) if (L.c === 'line') paintExt(g, L, P, env, x, y, h, o, 0);
      g.globalAlpha = ga0;
      return;
    }
    const side = o.rimSide == null ? 1 : (o.rimSide < 0 ? -1 : 1);
    const lightU = side * facing; // 光在单位坐标里来自哪一侧
    // 有轮廓光时先只画主体（细件、背光侧的部件除外），在主体上做轮廓光，细件按前后次序直接画到目标画布上；
    // 离屏画布只开到主体的范围
    let inbuf = layers, under = null, front = null, norim = null, ex = null;
    if (o.rim) {
      inbuf = [];
      for (const L of layers) {
        if (EXT[L.c]) continue;
        if (L.cls === 'thin' || (L.cls === 'shade' && L.sh === lightU)) (ex = ex || []).push(L);
        else { inbuf.push(L); if (L.cls === 'norim') (norim = norim || []).push(L); }
      }
      // 细件画在剪影前面还是后面：与它范围相交的主体都在它上面 → 剪影后（under）；都在它下面 → 剪影前（front）；
      // 两样都有（夹在中间，如斗篷与身体之间的发带、剑鞘与身体之间的剑柄、蓑衣与长衫之间的草穗）→ 也画在剪影前，
      // 再把压在它上面的主体从离屏剪影原样补画回来（E.hi：范围相交、更靠前的主体），前后次序完全正确
      if (ex) for (const E of ex) {
        let below = false, above = false, hi = null;
        const e = E.bb;
        if (e) for (const L of inbuf) {
          const b = L.bb;
          if (!b || b[0] > e[1] || b[1] < e[0] || b[2] > e[3] || b[3] < e[2]) continue;
          if (L.z <= E.z) below = true; else { above = true; (hi = hi || []).push(L); }
        }
        if (above && !below) (under = under || []).push(E);
        else { if (above) E.hi = hi; (front = front || []).push(E); }
      }
    }
    const fb = [1e9, -1e9, 1e9, -1e9], mg = 1.0;
    for (const L of inbuf) if (L.bb) { const b = L.bb; if (b[0] < fb[0]) fb[0] = b[0]; if (b[1] > fb[1]) fb[1] = b[1]; if (b[2] < fb[2]) fb[2] = b[2]; if (b[3] > fb[3]) fb[3] = b[3]; }
    if (fb[0] > fb[1]) { fb[0] = layers.box[0]; fb[1] = layers.box[1]; fb[2] = layers.box[2]; fb[3] = layers.box[3]; }
    let bt = fb[2] - mg;
    if (o.snow > 0.01) bt -= 2.8;
    if (P.walk) bt -= 0.5;
    const top = bt * 1.006, bot = fb[3] + mg + (P.walk ? 0.5 : 0);
    const bl = facing > 0 ? fb[0] - mg : -(fb[1] + mg), br = facing > 0 ? fb[1] + mg : -(fb[0] - mg);
    const pad = Math.ceil(2 + 1.2 * rimW);
    const dx = aligned ? T.a * x + T.e : x * S, dy = aligned ? T.d * y + T.f : y * S;
    const fx = dx - Math.floor(dx), fy = dy - Math.floor(dy);
    const offX = Math.ceil(-bl * px) + pad, offY = Math.ceil(-top * px) + pad;
    let W = Math.ceil((br - bl) * px) + 2 * pad + 2, H = Math.ceil((bot - top) * px) + 2 * pad + 2;
    W = (W + 7) & ~7; H = (H + 7) & ~7;
    if (W > 8192 || H > 8192) return;
    const glow = o.glow ? clamp(o.glow, 0, 1) : 0;
    const gq = glow > 0.001 ? Math.round(glow * 64) / 64 : 0;
    const M = buf(0, W, H, false, false, true), c = M.c;
    const begin = (cc) => { cc.save(); cc.setTransform(px * facing, 0, 0, px * breath, offX + fx, offY + fy); if (P.walk) cc.translate(0, env.ws.bob); };
    begin(c);
    paintLayers(c, inbuf, o, P, gq);
    const snowP = paintSnow(c, P, env, o, gq);
    c.restore();
    if (API._debug) { // 调试：离屏画布边缘有像素说明包围盒太小，飘动件被裁掉了
      const e = c.getImageData(0, 0, W, H).data;
      let hit = 0;
      for (let xx = 0; xx < W; xx++) { if (e[xx * 4 + 3] || e[(xx + (H - 1) * W) * 4 + 3]) hit++; }
      for (let yy = 0; yy < H; yy++) { if (e[yy * W * 4 + 3] || e[(W - 1 + yy * W) * 4 + 3]) hit++; }
      if (hit) API._clip.push(P.key + ' wind' + (o.wind == null ? '-' : o.wind) + ' dir' + (o.windDir || 1) + ' f' + facing + ' t' + env.t.toFixed(2) + ' px' + hit);
    }
    // 细件不进剪影（或进了剪影但不描轮廓光），但在低分辨率判定里算作“有料”：贴着亮边的发带、剑穗、披帛会让那一段边
    // 按窄缝处理（不亮），不会出现“亮线外侧又贴一道暗细线”
    if (o.rim) {
      const tk = [], tn = ex ? [] : null;
      for (const L of inbuf) if (L.polys) for (const q of L.polys) tk.push(q);
      if (ex) for (const L of ex) if (L.polys) for (const q of L.polys) tn.push(q);
      const nz = P.nrz[lightU];
      rimPass(M, W, H, rimW, side, o.rim,
        (norim || nz) && ((kc) => {
          begin(kc); kc.fillStyle = '#000';
          if (norim) for (const L of norim) kc.fill(L.path);
          if (nz) for (const z of nz) {
            if (z.fade) { const gr = kc.createLinearGradient(0, z.fade[0], 0, z.fade[1]); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); kc.fillStyle = gr; } else kc.fillStyle = '#000';
            kc.fill(z.path);
          }
          kc.restore();
        }),
        [px * facing, offX + fx, px * breath, offY + fy + (P.walk ? env.ws.bob * px * breath : 0)], tk, tn);
    }
    const F = M;
    // 细件直接画在目标画布上（身后的先画、剪影、身前的后画），不再多一遍整张合成；单位坐标的变换与离屏剪影一致，
    // (ox, oy) 是人物着地点在 gg 当前坐标系里的位置
    const unitT = (gg, ox, oy) => { gg.translate(ox, oy); gg.scale(facing * u, u * breath); if (P.walk) gg.translate(0, env.ws.bob); };
    const exPaint = (gg, list, ox, oy) => { gg.save(); unitT(gg, ox, oy); paintLayers(gg, list, o, P, gq); gg.restore(); };
    // 剪影前的细件按前后次序逐个画；夹在中间的细件画完后，把压在它上面的主体从离屏剪影补画回来（裁成这些主体的形状）
    const topPaint = (gg, ox, oy, putM) => {
      for (const E of front) {
        exPaint(gg, [E], ox, oy);
        if (!E.hi) continue;
        // 先裁到细件的范围（外扩 1 个单位），再裁成上层主体的形状：补画只落在细件那一小块里
        const hp = new Path2D(), e = E.bb;
        for (const L of E.hi) hp.addPath(L.path);
        gg.save(); unitT(gg, ox, oy);
        gg.beginPath(); gg.rect(e[0] - 1, e[2] - 1, e[1] - e[0] + 2, e[3] - e[2] + 2); gg.clip();
        gg.clip(hp); putM(gg); gg.restore();
      }
    };
    const ga = g.globalAlpha;
    if (glow > 0.001) {
      g.save(); g.globalAlpha = ga * alpha; paintGlow(g, P, o, glow, x, y, u, facing); g.restore();
    }
    // 半透明（淡入淡出）时：剪影外的东西（篙、钓竿、剑身、细件）和剪影先在一张离屏画布上按原样叠好，再整体按 alpha 画一次，
    // 否则藏在身后的篙会透过身体露出来，发带、钓竿与身体重叠处会叠暗
    if (alpha < 0.999 && (layers.xbox || under || front)) {
      let xb = layers.xbox ? layers.xbox.slice() : null;
      for (const list of [under, front]) if (list) for (const E of list) if (E.bb) {
        const b = E.bb;
        if (!xb) xb = b.slice(); else { if (b[0] < xb[0]) xb[0] = b[0]; if (b[1] > xb[1]) xb[1] = b[1]; if (b[2] < xb[2]) xb[2] = b[2]; if (b[3] > xb[3]) xb[3] = b[3]; }
      }
      if (!xb) xb = [0, 0, 0, 0];
      const bob = P.walk ? env.ws.bob : 0;
      const ux = facing * px, uy = px * breath;
      const ex0 = Math.min(xb[0] * ux, xb[1] * ux), ex1 = Math.max(xb[0] * ux, xb[1] * ux);
      const ey0 = (xb[2] + bob) * uy, ey1 = (xb[3] + bob) * uy;
      const ep = Math.ceil(3 + rimW + 2 * px);
      const GX0 = Math.floor(Math.min(-(offX + fx), ex0 - ep)), GY0 = Math.floor(Math.min(-(offY + fy), ey0 - ep));
      const GX1 = Math.ceil(Math.max(W - (offX + fx), ex1 + ep)), GY1 = Math.ceil(Math.max(H - (offY + fy), ey1 + ep));
      const GW = GX1 - GX0 + 2, GH = GY1 - GY0 + 2, OX = -GX0, OY = -GY0;
      if (GW <= 4096 && GH <= 4096) {
        const Gb = buf(2, GW, GH, false, false, true), gc = Gb.c;
        const putG = (gg) => { gg.setTransform(1, 0, 0, 1, 0, 0); gg.drawImage(F.cv, 0, 0, W, H, OX - offX, OY - offY, W, H); };
        gc.setTransform(S, 0, 0, S, OX + fx, OY + fy);
        for (const L of layers) if (EXT[L.c] === 'back') paintExt(gc, L, P, env, 0, 0, h, o, gq);
        if (under) exPaint(gc, under, 0, 0);
        gc.save(); putG(gc); gc.restore();
        if (front) topPaint(gc, 0, 0, putG);
        for (const L of layers) if (EXT[L.c] === 'front' && !(L.c === 'line' && o.line === 'skip')) paintExt(gc, L, P, env, 0, 0, h, o, gq);
        g.globalAlpha = ga * alpha;
        if (aligned) {
          g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
          g.drawImage(Gb.cv, 0, 0, GW, GH, Math.floor(dx) - OX, Math.floor(dy) - OY, GW, GH);
          g.restore();
        } else {
          g.drawImage(Gb.cv, 0, 0, GW, GH, x - (OX + fx) / S, y - (OY + fy) / S, GW / S, GH / S);
        }
        g.globalAlpha = ga;
        if (o.settle) settle(g);
        return;
      }
    }
    const putF = aligned
      ? (gg) => { gg.setTransform(1, 0, 0, 1, 0, 0); gg.drawImage(F.cv, 0, 0, W, H, Math.floor(dx) - offX, Math.floor(dy) - offY, W, H); }
      : (gg) => { gg.setTransform(T); gg.drawImage(F.cv, 0, 0, W, H, x - (offX + fx) / S, y - (offY + fy) / S, W / S, H / S); };
    g.globalAlpha = ga * alpha;
    for (const L of layers) if (EXT[L.c] === 'back') paintExt(g, L, P, env, x, y, h, o, gq);
    if (under) exPaint(g, under, x, y);
    g.save(); putF(g); g.restore();
    if (front) topPaint(g, x, y, putF);
    for (const L of layers) if (EXT[L.c] === 'front' && !(L.c === 'line' && o.line === 'skip')) paintExt(g, L, P, env, x, y, h, o, gq);
    g.globalAlpha = ga;
    if (o.settle) settle(g);
  }
  // opts.settle = true（或镜头每帧调用一次 XYT.sil.settle(g)）：画完让目标画布立刻把挂起的绘制执行掉（读 1 个像素）。
  // 默认不读：离屏画布已按尺寸轮换，不靠读回来避免写时复制；读回会让开了 GPU 加速的预览画布被浏览器降成软件绘制。
  // 画布被跨域图片污染时读像素会抛异常，忽略即可
  function settle(g) { try { g.getImageData(0, 0, 1, 1); } catch (e) { /* 忽略 */ } }

  function draw(g, who, pose, x, y, h, t, opts) {
    const o = opts || {};
    const P = getPose(who, pose, variantOf(who, pose, o));
    if (!P || !(h > 0)) return;
    const alpha = o.alpha == null ? 1 : clamp(o.alpha, 0, 1);
    if (alpha <= 0.001) return;
    t = t || 0;
    const facing = o.facing === -1 ? -1 : 1;
    const env = makeEnv(t, o, facing, P);
    // 呼吸：站姿 ±0.4% 身高，走路 ±0.1%，坐姿 ±0.25%（绕坐面缩放），卧姿不缩放（躺着时整个人上下伸缩不合常理，
    // 而且长而平的轮廓随缩放每挪四分之一像素就会整条闪一下）
    const bA = P.extra.breathA != null ? P.extra.breathA : P.walk ? 0.001 : 0.004;
    env.breath = 1 + bA * Math.sin((TAU * t) / 3.6 + (P.extra.breathPh || 0));
    // 水面：船板（或坐面）下 waterDepth 像素；默认取船的干舷或 0.09 身高
    const fb = o.waterDepth != null ? o.waterDepth : (o.boat && o.boat.freeboard != null ? o.boat.freeboard : 0.09 * h);
    env.waterU = (fb * U) / h;
    g.save();
    if (o.boat) applyBoat(g, o.boat);
    try { render(g, P, env, x, y, h, o, alpha); } finally { flatS = FLAT_REF; }
    g.restore();
  }

  // ---------------- 包围盒（含各种风力下的飘动件与积雪）----------------
  // P.box：离屏剪影的范围（不含篙、钓竿、钓线）；P.full：bounds() 给镜头排版用的整体范围（含篙与钓竿，篙算到水面为止）
  function computeBox(P) {
    const d = P.extra;
    const B = [1e9, -1e9, 1e9, -1e9], F = [1e9, -1e9, 1e9, -1e9];
    const acc = (b, pts) => { for (const p of pts) { if (p[0] < b[0]) b[0] = p[0]; if (p[0] > b[1]) b[1] = p[0]; if (p[1] < b[2]) b[2] = p[1]; if (p[1] > b[3]) b[3] = p[1]; } };
    const both = (pts) => { acc(B, pts); acc(F, pts); };
    for (const pt of d.parts) both(pt.pts);
    for (const wind of [0, 0.5, 1]) for (const wd of [-1, 1]) for (let k = 0; k < 14; k++) {
      const env = makeEnv(k * 0.29, { wind, windDir: wd }, 1, P);
      env.waterU = 9;
      const out = [];
      if (d.dyn) d.dyn(env, out);
      for (const pt of out) {
        if (pt.fold) continue;
        const pts = pt.fl ? flutter(env, pt.pts, pt.fa, pt.lift) : pt.pts;
        if (pt.c === 'line' || pt.c === 'pole') P.hasWater = true;
        if (EXT[pt.c]) acc(F, pt.c === 'pole' || pt.c === 'line' ? pts.map((p) => [p[0], Math.min(p[1], 9)]) : pts);
        else both(pts);
      }
      for (const pt of d.parts) if (pt.dyn) both(flutter(env, pt.pts, pt.fa, pt.lift));
      if (d.snowFn) for (const cap of d.snowFn(env)) both(cap.pts.map((p) => [p[0], p[1] - 3]));
    }
    for (const cap of P.snow) both(cap.pts.map((p) => [p[0], p[1] - 3]));
    const m = 2.5;
    P.full = { l: F[0] - m, r: F[1] + m, t: F[2] - m - 0.5, b: F[3] + m };
    return { l: B[0] - m, r: B[1] + m, t: B[2] - m - 0.5, b: B[3] + m };
  }
  function bounds(who, pose, h, arg) {
    const o = typeof arg === 'number' ? { facing: arg } : (arg || {});
    const P = getPose(who, pose, variantOf(who, pose, o));
    if (!P) return { left: 0, right: 0, top: 0, bottom: 0 };
    const b = P.full, k = h / U;
    // 篙、钓线算到水面：默认水面在 0.09 身高处；给了 waterDepth（或 boat）时按实际水面
    const wd = o.waterDepth != null ? o.waterDepth : (o.boat && o.boat.freeboard != null ? o.boat.freeboard : null);
    if (P.hasWater && wd != null) { const bb = Math.max(b.b * k, wd + 2); return o.facing === -1 ? { left: -b.r * k, right: -b.l * k, top: b.t * k, bottom: bb } : { left: b.l * k, right: b.r * k, top: b.t * k, bottom: bb }; }
    return o.facing === -1 ? { left: -b.r * k, right: -b.l * k, top: b.t * k, bottom: b.b * k } : { left: b.l * k, right: b.r * k, top: b.t * k, bottom: b.b * k };
  }

  // ---------------- 船 ----------------
  function applyBoat(g, m) {
    if (!m) return;
    g.translate(m.px, m.py + m.dy);
    g.rotate(m.rot);
    g.translate(-m.px, -m.py);
  }
  // 船随水起伏：±2 像素、周期约 4 秒，摇摆 ≤ 0.85°
  function boatMotion(x, y, len, t, o) {
    const ph = (o && o.phase) || 0;
    const dy = 2.0 * (0.7 * Math.sin((TAU * t) / 4.1 + ph) + 0.3 * Math.sin((TAU * t) / 2.9 + 1.3 + ph));
    const rot = (0.85 * Math.PI / 180) * (0.75 * Math.sin((TAU * t) / 3.7 + 0.8 + ph) + 0.25 * Math.sin((TAU * t) / 2.3 + ph));
    return { px: x, py: y, dy, rot };
  }
  // 船体（单位：船长 = 1，原点在船板中点，y 向下）：船头 +x 高翘，船尾略翘。船舷上沿比船板高约 0.022 船长（船长约 3.3 倍身高时
  // 约 0.07 身高），先画人、再画船身前层（layer: 'front'）时，船舷挡住坐、卧的人的下半身和站着的人的脚
  const HULL = [[-0.5, -0.066, 1], [-0.44, -0.042], [-0.36, -0.03], [-0.2, -0.023], [0, -0.022], [0.2, -0.024], [0.34, -0.034], [0.43, -0.054], [0.5, -0.088, 1],
    [0.475, -0.064], [0.43, -0.016], [0.35, 0.03], [0.2, 0.05], [0, 0.056], [-0.2, 0.052], [-0.34, 0.038], [-0.43, 0.012], [-0.48, -0.036]];
  flatS = 1200; // 船的路径以船长 = 1 预建，按船长约 1200 像素展平
  const HULL_PATH = (() => { const p = new Path2D(); addSmooth(p, HULL, true); return p; })();
  const PLANKS = (() => {
    const p = new Path2D();
    const rows = [[[-0.48, -0.05], [-0.36, -0.021], [-0.2, -0.014], [0, -0.013], [0.2, -0.015], [0.34, -0.025], [0.465, -0.066]], [[-0.47, -0.03], [-0.36, -0.002], [-0.2, 0.006], [0, 0.007], [0.2, 0.005], [0.34, -0.004], [0.455, -0.038]], [[-0.45, -0.012], [-0.34, 0.014], [-0.2, 0.021], [0, 0.023], [0.2, 0.021], [0.34, 0.012], [0.44, -0.012]], [[-0.4, 0.012], [-0.3, 0.03], [-0.15, 0.037], [0.05, 0.039], [0.22, 0.035], [0.33, 0.026], [0.41, 0.006]]];
    for (const r of rows) addSmooth(p, taper(r, (s) => 0.0024 * Math.pow(Math.sin(Math.PI * s), 0.4) + 0.0004, 'round'), true);
    return p;
  })();
  // 乌篷：船中部略偏后的拱形竹篷；篷高约 0.19 船长（船长约 3.3 倍身高时约 0.62 身高，盘坐的人坐得进去）
  const AWN_H = 1.25;
  const AWN = [[-0.285, 0.0, 1], [-0.276, -0.052], [-0.252, -0.1], [-0.205, -0.133], [-0.13, -0.149], [-0.05, -0.146], [0.02, -0.131], [0.07, -0.098], [0.094, -0.05], [0.1, 0.0, 1]].map((p) => [p[0], p[1] * AWN_H, p[2]]);
  const AWN_PATH = (() => { const p = new Path2D(); addSmooth(p, AWN, true); return p; })();
  // 篷里面：比外框小一圈的拱（两头敞开，看得见篷里的竹席），颜色比人物剪影亮 15–20% 以上，篷下的人看得清
  const AWN_IN = AWN.map((p) => [-0.093 + (p[0] + 0.093) * 0.93, p[1] * 0.9 + 0.001, p[2]]);
  const AWN_IN_PATH = (() => { const p = new Path2D(); addSmooth(p, AWN_IN, true); return p; })();
  const AWN_RIBS = (() => {
    const p = new Path2D();
    for (let i = 1; i < 8; i++) {
      const x = -0.285 + (0.385 * i) / 8;
      const top = (-0.149 * Math.sqrt(Math.max(0, 1 - Math.pow((x + 0.093) / 0.195, 2))) + 0.008) * AWN_H;
      addSmooth(p, taper([[x, top + 0.004], [x + 0.001, top * 0.5], [x, -0.004]], (s) => 0.0028 * Math.pow(Math.sin(Math.PI * s), 0.5) + 0.0003, 'round'), true);
    }
    addSmooth(p, taper([[-0.27, -0.05], [-0.2, -0.126], [-0.13, -0.141], [-0.05, -0.138], [0.02, -0.124], [0.086, -0.05]].map((q) => [q[0], q[1] * AWN_H]), (s) => 0.003 * Math.pow(Math.sin(Math.PI * s), 0.5) + 0.0004, 'round'), true);
    return p;
  })();
  flatS = FLAT_REF;
  // 船是刚体，篷与船身各是独立的外轮廓：各自在迎光一侧描轮廓光
  function paintRigid(g, path, col, rim, dx, foldPath, foldCol) {
    if (rim) {
      g.fillStyle = rim; g.fill(path);
      g.save(); g.clip(path); g.translate(dx, 0);
      g.fillStyle = col; g.fill(path);
      if (foldPath) { g.fillStyle = foldCol; g.fill(foldPath); }
      g.restore();
    } else {
      g.fillStyle = col; g.fill(path);
      if (foldPath) { g.save(); g.clip(path); g.fillStyle = foldCol; g.fill(foldPath); g.restore(); }
    }
  }
  // opts.layer：'back' 只画乌篷、'front' 只画船身（先 back、再画人、最后 front，船舷挡住人的下半身）；默认全画
  function boat(g, x, y, len, t, opts) {
    const o = opts || {};
    const m = boatMotion(x, y, len, t || 0, o);
    m.len = len;
    m.freeboard = len * 0.03; // 船板到水线（像素）
    const layer = o.layer || 'all';
    const body = o.body || '#262019';
    const rim = o.rim || null;
    const rs = o.rimSide == null ? 1 : (o.rimSide < 0 ? -1 : 1);
    const rw = (o.rimWidth || Math.max(1, len / 360)) / len;
    const fl = o.facing === -1 ? -1 : 1;
    g.save();
    if (o.alpha != null) g.globalAlpha *= clamp(o.alpha, 0, 1);
    applyBoat(g, m);
    g.translate(x, y);
    g.scale(len * fl, len);
    if (o.awning && layer !== 'front') {
      // 深色外框（篷顶的竹骨与两端的拱），里面是亮一些的篷内，竹骨细线画在篷内
      paintRigid(g, AWN_PATH, mix(body, '#101216', 0.3), rim, -rs * fl * rw);
      g.fillStyle = mix(body, '#9a8a70', 0.24); g.fill(AWN_IN_PATH);
      g.save(); g.clip(AWN_IN_PATH); g.fillStyle = mix(body, '#9a8a70', 0.4); g.fill(AWN_RIBS); g.restore();
    }
    if (layer !== 'back') {
      paintRigid(g, HULL_PATH, body, rim, -rs * fl * rw, PLANKS, mix(body, '#c4a77a', 0.12));
      // 水线以下渐隐，像浸在水里
      g.save();
      g.clip(HULL_PATH);
      const wl = 0.03;
      const gr = g.createLinearGradient(0, wl - 0.004, 0, 0.06);
      gr.addColorStop(0, 'rgba(20,24,30,0.0)');
      gr.addColorStop(0.12, 'rgba(20,24,30,0.35)');
      gr.addColorStop(1, 'rgba(20,24,30,0.6)');
      g.fillStyle = gr;
      g.fillRect(-0.6, wl - 0.004, 1.2, 0.1);
      g.restore();
    }
    g.restore();
    return m;
  }

  function parts(who, pose, t, opts) {
    const o = opts || {};
    const P = getPose(who, pose, variantOf(who, pose, o));
    if (!P) return [];
    const env = makeEnv(t || 0, o, 1, P);
    env.waterU = 9;
    const out = [];
    for (const pt of P.extra.parts) out.push({ c: pt.c, pts: pt.dyn ? flutter(env, pt.pts, pt.fa, pt.lift) : pt.pts });
    const dd = [];
    if (P.dyn) P.dyn(env, dd);
    for (const pt of dd) if (!pt.fold) out.push({ c: pt.c, pts: pt.fl ? flutter(env, pt.pts, pt.fa, pt.lift) : pt.pts });
    return out;
  }

  const poses = {};
  for (const w of Object.keys(DEF)) poses[w] = Object.keys(DEF[w]);
  const API = {
    draw, poses, bounds, boat, boatMotion, settle,
    walkSpeed: (h) => (WALK.v / U) * h,
    _parts: parts, _debug: false, _clip: [],
  };
  // 载入时预建全部静态轮廓与包围盒，并在小画布上各画一次预热，第一帧不卡
  for (const w of Object.keys(DEF)) for (const p of poses[w]) for (const vk of (w === 'old' && HAT_POSES[p] ? ['', 'hat'] : [''])) getPose(w, p, vk);
  try {
    const wc = document.createElement('canvas');
    wc.width = 48; wc.height = 48;
    const wg = wc.getContext('2d');
    for (const w of Object.keys(DEF)) for (const p of poses[w]) draw(wg, w, p, 24, 44, 40, 0.5, { wind: 0.5, rim: '#ffffff', snow: 0.5 });
  } catch (e) { /* 无画布环境时跳过预热 */ }

  XYT.sil = API;
})();
