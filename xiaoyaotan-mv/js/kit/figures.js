/* 逍遥叹 · 音乐动画 —— 工具包·人物：古风水墨剪影，衣袂、发丝、飘带随风而动，全部由时间算出 */
(function () {
  'use strict';
  const XYT = (window.XYT = window.XYT || {});
  const A = XYT.art;
  const { TAU, clamp, lerp } = A;
  const PI = Math.PI;

  // ---------- 颜色 ----------
  const cmemo = new Map();
  function parse(c) {
    let v = cmemo.get(c);
    if (v) return v;
    if (c[0] === '#') {
      let h = c.slice(1);
      if (h.length <= 4) h = h.split('').map((ch) => ch + ch).join('');
      const n = parseInt(h.slice(0, 6), 16);
      v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
    } else {
      const m = c.match(/[\d.]+/g) || [0, 0, 0];
      v = [+m[0], +m[1], +m[2], m[3] == null ? 1 : +m[3]];
    }
    cmemo.set(c, v);
    return v;
  }
  const css = (v, a = 1) => `rgba(${v[0] | 0},${v[1] | 0},${v[2] | 0},${+(v[3] * a).toFixed(3)})`;
  const ca = (c, a) => css(parse(c), a);
  function mixc(c1, c2, t, a = 1) {
    const p = parse(c1), q = parse(c2);
    return css([lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t), lerp(p[3], q[3], t)], a);
  }

  // ---------- 向量 ----------
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const ma = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const mid = (a, b, u = 0.5) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const perp = (a) => [-a[1], a[0]];
  const dirA = (ang) => [Math.sin(ang), Math.cos(ang)]; // 从竖直向下量起，正值转向前方
  const angOf = (v) => Math.atan2(v[1], v[0]);
  const pol = (ang) => [Math.cos(ang), Math.sin(ang)];
  const rotV = (v, ang) => { const s = Math.sin(ang), c = Math.cos(ang); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const corner = (p) => [p[0], p[1], 1];
  const fnorm = (a, b) => { const d = nrm(sub(b, a)); return [d[1], -d[0]]; }; // 肢段“前侧”法向

  // ---------- 路径 ----------
  // 开放平滑曲线：中点二次曲线
  function curve(g, pts, first) {
    const n = pts.length;
    if (first) g.moveTo(pts[0][0], pts[0][1]); else g.lineTo(pts[0][0], pts[0][1]);
    if (n === 2) { g.lineTo(pts[1][0], pts[1][1]); return; }
    for (let i = 1; i < n - 1; i++) {
      if (i === n - 2) g.quadraticCurveTo(pts[i][0], pts[i][1], pts[n - 1][0], pts[n - 1][1]);
      else { const m = mid(pts[i], pts[i + 1]); g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); }
    }
  }
  // 闭合形：带第三分量 1 的点是尖角，其余是平滑控制点
  function pathC(g, pts) {
    const n = pts.length, at = (i) => pts[((i % n) + n) % n];
    const p0 = at(0);
    const st = p0[2] ? p0 : at(-1)[2] ? at(-1) : mid(at(-1), p0);
    g.moveTo(st[0], st[1]);
    for (let i = 0; i < n; i++) {
      const p = at(i), q = at(i + 1);
      if (p[2]) { if (i > 0) g.lineTo(p[0], p[1]); continue; }
      const e = q[2] ? q : mid(p, q);
      g.quadraticCurveTo(p[0], p[1], e[0], e[1]);
    }
    g.closePath();
  }
  function fillC(g, pts, col) { g.beginPath(); pathC(g, pts); g.fillStyle = col; g.fill(); }
  // 闭合插值样条：曲线穿过每个点（Catmull-Rom），尖角点处切线断开
  function pathT(g, pts, k = 1) {
    const n = pts.length, at = (i) => pts[((i % n) + n) % n];
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p1 = at(i), p2 = at(i + 1);
      const p0 = p1[2] ? p1 : at(i - 1), p3 = p2[2] ? p2 : at(i + 2);
      g.bezierCurveTo(p1[0] + ((p2[0] - p0[0]) / 6) * k, p1[1] + ((p2[1] - p0[1]) / 6) * k,
        p2[0] - ((p3[0] - p1[0]) / 6) * k, p2[1] - ((p3[1] - p1[1]) / 6) * k, p2[0], p2[1]);
    }
    g.closePath();
  }
  // 凸包（单调链），用来给坐、跪、卧时的衣裳找外轮廓
  function hull(P) {
    const pts = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], hi = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
    lo.pop(); hi.pop();
    return lo.concat(hi);
  }
  // 中心线加宽度函数 → 渐细的条带
  function taper(g, pts, wf, col) {
    const n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const nn = perp(nrm(sub(b, a))), w = wf(i / (n - 1), i) / 2;
      L.push(ma(pts[i], nn, w)); R.push(ma(pts[i], nn, -w));
    }
    g.beginPath(); curve(g, L, true); curve(g, R.reverse(), false); g.closePath();
    if (col) g.fillStyle = col;
    g.fill();
  }
  // 随风条带中心线：从 p0 以屏幕角 a0 出发，逐渐转向 aim，叠加两道行波
  function flow(p0, a0, aim, L, n, k, amp, f, t, ph, wk = 5) {
    const da = Math.atan2(Math.sin(aim - a0), Math.cos(aim - a0));
    let x = p0[0], y = p0[1];
    const pts = [[x, y]], st = L / n;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const a = a0 + da * (1 - Math.pow(1 - u, k)) +
        amp * u * (Math.sin(t * f - u * wk + ph) + 0.45 * Math.sin(t * f * 1.73 - u * wk * 1.9 + ph * 2.1));
      x += Math.cos(a) * st; y += Math.sin(a) * st;
      pts.push([x, y]);
    }
    return pts;
  }
  // 丝带：宽度随扭转起伏，朝光的一面描一道亮线
  function silk(g, pts, w0, w1, col, hi, t, ph, tw = 2.4) {
    const tws = (u) => 0.28 + 0.72 * Math.abs(Math.cos(t * tw + u * 5.5 + ph));
    taper(g, pts, (u) => lerp(w0, w1, u) * tws(u), col);
    if (!hi) return;
    g.strokeStyle = hi; g.lineWidth = Math.max(0.5, w0 * 0.28);
    g.beginPath();
    let on = false;
    for (let i = 0; i < pts.length; i++) {
      const u = i / (pts.length - 1), c = Math.cos(t * tw + u * 5.5 + ph);
      if (c > 0.35) { on ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]); on = true; } else on = false;
    }
    g.stroke();
  }

  // ---------- 角色设定 ----------
  const BASE = {
    h: 180, sex: 'm', garment: 'robe', sleeve: 'mid', sd: 22, hair: 'hero', frac: 1, flare: 1,
    ink: '#1a2026', accent: '#a8d4d4', ribbon: '#3b6db3', tassel: '#c8322a', inner: '#eef0ea',
    chest: 10, waist: 8.5, stoop: 0, prop: 'none', swordAt: 'back', glow: 0,
  };
  const CHARS = {
    xiaoyao: { h: 180, prop: 'sword', lining: '#cfe6e2' },
    linger: {
      h: 166, sex: 'f', garment: 'dress', sleeve: 'wide', sd: 30, hair: 'linger', chest: 9, waist: 6.5,
      ink: '#231d29', accent: '#f2c4d6', accent2: '#cdb8e6', ribbon: '#d7c3ee', inner: '#f8eef3', gauze: '#f7e2ee',
      shawl: '#dcc8f0', flower: '#f9dbe6', heart: '#e27b9c', lining: '#f6d5e2', sheer: true,
    },
    yueru: {
      h: 168, sex: 'f', garment: 'jin', sleeve: 'cuff', hair: 'ponytail', frac: 0.74, chest: 9, waist: 6.5,
      ink: '#2b1416', accent: '#d8262c', ribbon: '#e2322f', tassel: '#e2322f', panel: '#8a1a1f', inner: '#f4e2d6',
      prop: 'sword', swordAt: 'hip',
    },
    anu: {
      h: 158, sex: 'f', garment: 'miao', sleeve: 'narrow', hair: 'miao', frac: 0.5, chest: 9, waist: 6.5,
      ink: '#201a24', accent: '#c9314a', accent2: '#2f7ab8', accent3: '#e9b740', silver: '#e2e6ee', inner: '#f2e8e0',
      ribbon: '#c9314a', bells: true,
    },
    tangyu: {
      h: 178, hair: 'tangyu', ink: '#14222a', accent: '#3c93ab', ribbon: '#2f86a2', tassel: '#2f86a2', lining: '#7cc0d0',
      prop: 'sword', swordAt: 'hip',
    },
    jiujianxian: {
      h: 176, hair: 'messy', sleeve: 'wide', sd: 27, ink: '#2b2520', accent: '#9a7550', ribbon: '#6b5a48', inner: '#58483a',
      hairCol: '#2c2824', beard: 'scruffy', prop: 'gourd', gourd: true, backSword: true, open: true, ragged: true, stoop: -0.03,
      lining: '#b08a62', tassel: '#9a3324',
    },
    laolao: {
      h: 164, sex: 'f', garment: 'gown', sleeve: 'wide', sd: 33, hair: 'highbun', chest: 9, waist: 7,
      ink: '#25262b', hairCol: '#e8e6e0', accent: '#d4dade', accent2: '#9fb0ba', ribbon: '#c8d0d6', inner: '#f2f2ee',
      gauze: '#e4eaee', shawl: '#c9d4dc', prop: 'staff', lining: '#dde4e8', sheer: true,
    },
    baiyue: {
      h: 190, garment: 'priest', sleeve: 'wide', sd: 34, hair: 'crown', ink: '#120f18', accent: '#6a38a0', accent2: '#9a74d0',
      moon: '#dfe2f6', inner: '#3a2c4c', prop: 'staff', cape: true, pads: true, chest: 11, waist: 9.5, lining: '#7d4cb8',
    },
    caiyi: {
      h: 165, sex: 'f', garment: 'dress', sleeve: 'wide', sd: 28, hair: 'caiyi', chest: 9, waist: 6.5,
      ink: '#2b2422', accent: '#f4d77c', accent2: '#f2a6bc', ribbon: '#f2a6bc', inner: '#fcf3dc', gauze: '#fbe7b0',
      shawl: '#f6c4d2', wings: true, lining: '#f8e3a0', sheer: true,
    },
    jinyuan: {
      h: 178, hair: 'scholar', sleeve: 'wide', sd: 28, ink: '#1c2427', accent: '#e4ede7', accent2: '#a9cfc5', ribbon: '#1c2427',
      inner: '#f4f6f1', prop: 'fan', lining: '#bfe0d6', chest: 9.5, waist: 7.5,
    },
    storyteller: {
      h: 170, garment: 'longgown', hair: 'cap', ink: '#27221e', accent: '#8e3b2b', hairCol: '#b9b4aa', beard: 'goatee',
      beardCol: '#dedad2', inner: '#e8e0d0', prop: 'fan', stoop: 0.06, lining: '#b65a44',
    },
    villager: { h: 172, garment: 'short', sleeve: 'narrow', hair: 'douli', ink: '#2a2826', accent: '#7c8c7a', frac: 0.44 },
  };
  const STAGES = {
    youth: { h: 176, garment: 'short', sleeve: 'rolled', hair: 'youth', frac: 0.44, ink: '#28241f', accent: '#8fa3b0', ribbon: '#8a7a62', towel: true, prop: 'none' },
    hero: {},
    old: { ink: '#25282b', accent: '#7f8c94', ribbon: '#5a7088', sd: 26, sleeve: 'wide', hairCol: '#e3dfd7', hairLoose: true, stoop: 0.07, lining: '#a0aab0' },
    wedding: { ink: '#4c1013', accent: '#dca846', ribbon: '#c41a20', inner: '#f0c66a', sleeve: 'wide', sd: 30, hair: 'wedding', flowerBall: true, prop: 'none', lining: '#e8b850' },
  };
  const VILLAGERS = [
    {},
    { sex: 'f', h: 160, garment: 'dress', sleeve: 'mid', sd: 18, hair: 'bunF', ink: '#2b2624', accent: '#a9765e', chest: 9, waist: 7, gauze: null },
    { hair: 'headcloth', ink: '#262a2c', accent: '#6f8394' },
    { garment: 'robe', sleeve: 'mid', hair: 'oldman', beard: 'goatee', beardCol: '#d8d4cc', hairCol: '#c8c4bc', stoop: 0.2, ink: '#2b2925', accent: '#8a7660', frac: 1, h: 166 },
  ];

  function spec(who, o) {
    const s = Object.assign({}, BASE, CHARS[who] || CHARS.villager);
    if (who === 'xiaoyao') Object.assign(s, STAGES[o.stage || 'hero'] || {});
    if (who === 'villager' || !CHARS[who]) Object.assign(s, VILLAGERS[((o.variant ?? o.seed ?? 0) | 0) % VILLAGERS.length]);
    if (who === 'linger' && o.form === 'nuwa') Object.assign(s, { nuwa: true, hairLoose: true, glow: 0.55, scale: '#bdeee9', tailInk: '#1f3a42' });
    if (o.hairLoose != null) s.hairLoose = o.hairLoose;
    s.who = who;
    return s;
  }

  // ---------- 骨架 ----------
  const LT = 46, LS = 44, LU = 30, LF = 27, LB = 54, ANK = 6;
  function limbA(R, a1, a2, L1, L2) { const M = ma(R, dirA(a1), L1); return [M, ma(M, dirA(a1 + a2), L2)]; }
  // 两节肢体反解：bend=1 关节偏向屏幕顺时针一侧
  function ik(S, T, L1, L2, bend) {
    const dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 0.001;
    const dm = clamp(d, Math.abs(L1 - L2) + 0.5, L1 + L2 - 0.05);
    const c = clamp((L1 * L1 + dm * dm - L2 * L2) / (2 * L1 * dm), -1, 1);
    const a = Math.atan2(dy, dx) + bend * Math.acos(c);
    return [[S[0] + Math.cos(a) * L1, S[1] + Math.sin(a) * L1], [S[0] + (dx * dm) / d, S[1] + (dy * dm) / d]];
  }

  const PTS = ['P', 'N', 'Sn', 'Sf', 'Hc', 'En', 'Wn', 'Ef', 'Wf', 'Kn', 'An', 'Kf', 'Af', 'Hn', 'Hf'];
  function solve(PS, q) {
    const J = { ground: !!PS.ground };
    const tor = PS.tor || 0;
    J.up = [Math.sin(tor), -Math.cos(tor)]; J.fw = [Math.cos(tor), Math.sin(tor)];
    J.P = (PS.pel || [0, -96]).slice();
    const legs = () => {
      J.Hn = ma(J.P, J.fw, 1.4); J.Hf = ma(J.P, J.fw, -1.4);
      const one = (sp, H) => sp.f ? ik(H, typeof sp.f === 'function' ? sp.f(J) : sp.f, LT, LS, sp.b ?? -1) : limbA(H, sp.a[0], -sp.a[1], LT, LS);
      [J.Kn, J.An] = one(PS.lN, J.Hn); [J.Kf, J.Af] = one(PS.lF, J.Hf);
    };
    legs();
    if (PS.ground) {
      // 行走时以支撑腿着地；摆动腿若擦地就多屈膝抬起
      let low = PS.stance ? J['A' + PS.stance][1] + ANK : Math.max(J.An[1], J.Af[1]) + ANK;
      if (PS.kneeGround) low = Math.max(low, J.Kn[1] + 4.5, J.Kf[1] + 4.5);
      J.P[1] -= low + (PS.lift || 0); legs();
      if (PS.stance) {
        const sw = PS.stance === 'n' ? 'f' : 'n', spec = PS['l' + (sw === 'n' ? 'N' : 'F')];
        for (let it = 0; it < 14 && J['A' + sw][1] > -ANK - (PS.clear || 0); it++) { spec.a[0] += 0.035; spec.a[1] += 0.055; legs(); }
      }
    }
    J.N = ma(J.P, J.up, LB + (q.breath || 0));
    J.Sn = ma(ma(J.N, J.up, -3.5), J.fw, 0.8); J.Sf = ma(ma(J.N, J.up, -3.5), J.fw, -2.4);
    const hp = PS.head || 0;
    J.hang = tor + hp;
    const nk = [Math.sin(tor + hp * 0.45), -Math.cos(tor + hp * 0.45)];
    const top = ma(J.N, nk, 5.2);
    J.Hc = ma(ma(top, [Math.sin(J.hang), -Math.cos(J.hang)], 9.8), [Math.cos(J.hang), Math.sin(J.hang)], 1.2);
    J.look = PS.look || 1;
    const arm = (sp, S) => sp.h ? ik(S, typeof sp.h === 'function' ? sp.h(J) : sp.h, LU, LF, sp.b ?? 1) : limbA(S, sp.a[0], sp.a[1], LU, LF);
    [J.En, J.Wn] = arm(PS.aN, J.Sn); [J.Ef, J.Wf] = arm(PS.aF, J.Sf);
    J.dn = rotV(nrm(sub(J.Wn, J.En)), PS.wN || 0); J.df = rotV(nrm(sub(J.Wf, J.Ef)), PS.wF || 0);
    if (PS.rot) {
      const r = PS.rot, c = J.P.slice();
      for (const k of PTS) J[k] = add(c, rotV(sub(J[k], c), r));
      J.up = rotV(J.up, r); J.fw = rotV(J.fw, r); J.dn = rotV(J.dn, r); J.df = rotV(J.df, r);
      J.hang += r;
    }
    return J;
  }

  // ---------- 姿势 ----------
  // 角度约定：从竖直向下量起，正值转向身前；臂 [肩, 肘屈]，腿 [髋, 膝屈]；h/f 为手脚目标点
  const up = (J, p, k) => ma(p, J.up, k), fwd = (J, p, k) => ma(p, J.fw, k);
  const at = (J, p, f, u) => ma(ma(p, J.fw, f), J.up, u);
  const POSES = {
    stand(q) {
      const br = Math.sin(q.t * 1.3 + q.ph);
      const f = q.sp.sex === 'f';
      return {
        ground: true, tor: (f ? -0.02 : 0.025) + 0.006 * br + q.sp.stoop, head: (f ? 0.16 : 0.08) + 0.02 * Math.sin(q.t * 0.7 + q.ph),
        lN: { a: f ? [0.12, 0.16] : [0.07, 0.03] }, lF: { a: [-0.06, 0.0] },
        aN: f ? (q.sp.garment === 'jin' ? { a: [0.06, 0.12] } : { a: [0.16 + 0.02 * br, 0.62] }) : { a: [0.08 + 0.02 * br, 0.22] },
        aF: f ? { a: [-0.1, 0.3] } : { a: [-0.32, 0.62] },
      };
    },
    walk(q) {
      const ph = TAU * q.t * 0.85 * (q.o.speed || 1) + (q.o.phase || 0);
      const amp = q.sp.sex === 'f' ? 0.3 : 0.36;
      // 髋角近似三角波：支撑期脚底匀速后移，配合 walkSpeed 不打滑；膝在摆动初期弯得最深
      const leg = (p) => {
        const w = Math.atan2(Math.sin(p), Math.cos(p));
        const tri = (2 / PI) * Math.asin(Math.sin(p));
        const c = Math.max(0, Math.cos((w + 0.9) * 1.2));
        return { a: [amp * (0.92 * tri + 0.08 * Math.sin(p)), 0.07 + 0.88 * c * c] };
      };
      const s = Math.sin(ph), stance = Math.cos(ph) < 0 ? 'n' : 'f';
      const swingC = Math.abs(Math.cos(ph));
      return {
        ground: true, tor: 0.06 + q.sp.stoop + 0.012 * Math.cos(ph * 2), head: 0.04,
        lN: leg(ph), lF: leg(ph + PI),
        aN: { a: [0.04 - 0.3 * s, 0.25 + 0.15 * Math.max(0, -s)] }, aF: { a: [0.04 + 0.3 * s, 0.3 + 0.15 * Math.max(0, s)] },
        walking: true, gait: ph, stance, clear: 3 * swingC,
      };
    },
    sit(q) {
      if (q.o.seat === 'ledge') {
        const k = 0.12 * Math.sin(q.t * 1.6 + q.ph);
        return {
          pel: [0, -7], tor: 0.04 + q.sp.stoop, head: 0.12,
          lN: { a: [1.45, 1.35 - k] }, lF: { a: [1.38, 1.5 + k] },
          aN: { h: (J) => [J.P[0] + 10, J.P[1] + 4], b: 1 }, aF: { h: (J) => [J.P[0] - 6, J.P[1] + 5], b: 1 }, seated: true, ledge: true,
        };
      }
      return {
        pel: [0, -15], tor: 0.08 + q.sp.stoop, head: 0.14,
        lN: { a: [2.28, 2.42] }, lF: { a: [1.52, 2.98] },
        aN: { h: (J) => add(J.Kn, [2, 7]), b: 1 }, aF: { h: (J) => at(J, J.P, 20, 6), b: 1 }, seated: true, floor: true,
      };
    },
    kneel(q) {
      const cr = q.o.cradle;
      const P = {
        pel: [-4, -52], tor: cr ? 0.42 : 0.14 + q.sp.stoop, head: cr ? 0.72 : 0.42, ground: true, kneeGround: true,
        lN: { a: [1.48, 1.5] }, lF: { a: [-0.1, 1.6] },
        aN: { h: (J) => add(J.Kn, [-2, -6]), b: 1 }, aF: { a: [0.15, 0.25] }, kneeling: true, floor: true,
      };
      if (cr) {
        // 双膝跪坐，上身前倾，双臂向前托住怀中人
        P.pel = [-4, -40]; P.lN = { a: [0.8, 2.25] }; P.lF = { a: [0.72, 2.18] };
        P.aN = { h: (J) => [J.P[0] + 60, -40], b: 1 }; P.aF = { h: (J) => [J.P[0] + 52, -31], b: 1 }; P.tor = 0.55; P.head = 0.62; P.sleeveK = 0.6;
      }
      else if (q.sword) { P.aN = { h: (J) => [J.Kn[0] + 12, -70], b: 1 }; P.aF = { h: (J) => [J.Kn[0] + 11, -64], b: 1 }; P.tor = 0.12; P.head = 0.5; }
      return P;
    },
    lie(q) {
      if (q.o.flat) {
        const lp = q.o.limp;
        return {
          pel: [0, -9], tor: lp ? -0.82 : -1.5, head: lp ? -0.85 : 0.25,
          lN: { a: [1.5, 0.05] }, lF: { a: lp ? [1.85, 1.45] : [1.42, 0.32] },
          aN: lp ? { h: (J) => [J.Sn[0] + 4, -2], b: 1 } : { a: [0.02, 0.05] }, aF: lp ? { h: (J) => at(J, J.P, 12, 14), b: 1 } : { a: [-0.5, 1.0] },
          lying: true, floor: true, limp: lp,
        };
      }
      const g = q.prop === 'gourd';
      return {
        pel: [0, -11], tor: -1.12, head: g ? 0.55 : 0.9,
        lN: { a: [1.52, 0.06] }, lF: { a: [2.3, 2.55] },
        aF: { a: [0.05, 1.5] },
        aN: g ? { h: (J) => add(J.Hc, [13, -20]), b: -1 } : { h: (J) => add(J.Kf, [-2, -3]), b: 1 },
        lying: true, floor: true,
      };
    },
    drink(q) {
      return {
        ground: true, tor: -0.12, head: -0.72, lN: { a: [0.17, 0.05] }, lF: { a: [-0.16, 0.0] },
        aN: { h: (J) => add(J.Hc, [7, -15]), b: 1 }, aF: { a: [-0.42, 0.75] }, drinking: true,
      };
    },
    swordUp(q) {
      return {
        ground: true, tor: -0.05, head: -0.3, lN: { a: [0.24, 0.12] }, lF: { a: [-0.22, 0.0] },
        aN: { a: [3.02, 0.04] }, aF: { h: (J) => at(J, J.N, 22, -16), b: 1 }, handF: 'point', windMin: 0.55,
      };
    },
    swordPoint(q) {
      return {
        ground: true, tor: 0.16, head: 0.02, lN: { a: [0.85, 0.95] }, lF: { a: [-0.62, 0.02] },
        aN: { a: [1.56, 0.0] }, aF: { a: [-2.15, -0.85] }, handF: 'point', windMin: 0.45,
      };
    },
    flySword(q) {
      return {
        ground: true, tor: 0.16, head: -0.04, lN: { a: [0.22, 0.12] }, lF: { a: [-0.26, 0.08] },
        aN: { h: (J) => at(J, J.N, 17, -15), b: 1 }, aF: { a: [-0.95, 0.3] }, handN: 'point', windMin: 0.95, flying: true, flare: 1.5,
      };
    },
    lookBack(q) {
      return {
        ground: true, tor: 0.04 + q.sp.stoop, head: -0.08, look: -1,
        lN: { a: [0.24, 0.05] }, lF: { a: [-0.22, 0.32] },
        aN: { a: [-0.18, 0.18] }, aF: { a: [0.22, 0.3] },
      };
    },
    reach(q) {
      return {
        ground: true, tor: 0.2, head: -0.05, lN: { a: [0.34, 0.12] }, lF: { a: [-0.44, 0.38] },
        aN: { a: [1.98, 0.02] }, aF: { a: [-0.6, 0.3] }, handN: 'open',
      };
    },
    whisper(q) {
      const f = q.sp.sex === 'f';
      return {
        ground: true, tor: f ? 0.14 : 0.2, head: f ? -0.12 : 0.3, lN: { a: [0.05, 0.02] }, lF: { a: [-0.22, 0.12] }, lift: f ? 4.5 : 0,
        aN: { h: (J) => add(J.Hc, [9, 9]), b: 1 }, aF: f ? { h: (J) => at(J, J.N, 24, -26), b: 1 } : { a: [0.18, 0.45] }, handN: 'open',
      };
    },
    embrace(q) {
      const f = q.sp.sex === 'f';
      return {
        ground: true, tor: f ? 0.15 : 0.08, head: f ? 0.5 : 0.48, lN: { a: [0.09, 0.04] }, lF: { a: [-0.05, 0.0] },
        aN: { h: (J) => at(J, J.N, f ? 38 : 42, f ? -36 : -24), b: 1 }, aF: { h: (J) => at(J, J.N, f ? 34 : 38, f ? -42 : -32), b: 1 },
      };
    },
    fall(q) {
      return {
        pel: [0, -96], rot: -0.95, tor: -0.12, head: -0.35,
        lN: { a: [0.55, 0.7] }, lF: { a: [0.12, 0.35] }, aN: { a: [2.55, 0.25] }, aF: { a: [2.15, 0.45] },
        grav: [0.25, -1], windMin: 0.85, falling: true,
      };
    },
    dance(q) {
      const ph = TAU * q.t * 0.21 + q.ph;
      const s = Math.sin(ph);
      return {
        ground: true, tor: -0.05 + 0.05 * s, head: -0.15 + 0.12 * Math.sin(ph + 0.6),
        lN: { a: [0.05, 0.03] }, lF: { a: [-0.48, 1.05 + 0.18 * s] },
        aN: { a: [2.45 + 0.28 * s, 0.4 + 0.2 * Math.sin(ph + 1)] }, aF: { a: [-1.35 + 0.3 * Math.sin(ph + 2), -0.25] },
        dancing: true, flare: 1.6, windMin: 0.45, handN: 'open', handF: 'open',
      };
    },
    summon(q) {
      const s = Math.sin(q.t * 1.1 + q.ph);
      return {
        ground: true, tor: -0.08, head: -0.32, lN: { a: [0.2, 0.05] }, lF: { a: [-0.18, 0.0] },
        aN: { a: [2.35 + 0.06 * s, 0.25] }, aF: { a: [-2.2 - 0.06 * s, -0.25] }, handN: 'open', handF: 'open', windMin: 0.5,
      };
    },
    pray(q) {
      return {
        ground: true, tor: 0.06, head: 0.28, lN: { a: [0.06, 0.03] }, lF: { a: [-0.05, 0.0] },
        aN: { h: (J) => at(J, J.N, 15, -22), b: 1 }, aF: { h: (J) => at(J, J.N, 13, -20), b: 1 }, wN: -1.2, wF: -1.2, handN: 'open', handF: 'open',
      };
    },
    laugh(q) {
      const sh = 0.012 * Math.sin(q.t * 15) * (0.6 + 0.4 * Math.sin(q.t * 1.3));
      return {
        ground: true, tor: -0.15 + sh, head: -0.68 + sh * 2, lN: { a: [0.2, 0.04] }, lF: { a: [-0.17, 0.0] },
        aN: { a: [0.62, 0.18] }, aF: { a: [-0.62, 0.15] }, handN: 'open', handF: 'open',
      };
    },
  };
  const CARRY = { stand: 1, walk: 1, lookBack: 1, laugh: 0, whisper: 0 };

  // 道具改写手臂
  function carry(q, P, pose) {
    if (!CARRY[pose]) return;
    const pr = q.prop;
    if (pr === 'umbrella') { P.aN = { h: (J) => at(J, J.N, 13, 2), b: 1 }; P.handN = 'fist'; }
    else if (pr === 'lantern') { P.aN = { h: (J) => at(J, J.P, 24, 20), b: 1 }; P.handN = 'fist'; }
    else if (pr === 'staff') { P.aN = { h: (J) => at(J, J.N, 21, -24), b: 1 }; P.handN = 'fist'; }
    else if (pr === 'fan') { P.aN = { h: (J) => at(J, J.N, 17, -19), b: 1 }; P.handN = 'fist'; }
    else if (pr === 'whip') { P.aN = { a: [0.25, 0.35] }; P.handN = 'fist'; }
    else if (pr === 'gourd' && q.sp.who === 'jiujianxian') { P.aN = { a: [0.12, 0.12] }; P.handN = 'fist'; }
  }

  // ---------- 局部工具 ----------
  // 贴地姿势：飘带、发丝、袖子不穿过地面
  function floorC(F, pts) {
    if (!F.PS.floor) return pts;
    for (const p of pts) if (p[1] > -0.4) p[1] = -0.4;
    return pts;
  }
  function aimAng(F, ww) { return angOf(nrm(add(mul(F.grav, 1 - ww), mul(F.T, ww)))); }
  function thin(F, w) { return Math.max(w, F.px * 0.9); }
  function headTf(F) {
    const J = F.J, c = Math.cos(J.hang), s = Math.sin(J.hang), lk = J.look;
    return {
      p: (x, y) => [J.Hc[0] + x * lk * c - y * s, J.Hc[1] + x * lk * s + y * c],
      d: (x, y) => [x * lk * c - y * s, x * lk * s + y * c],
    };
  }
  function inHead(g, F, fn) {
    const J = F.J;
    g.save(); g.translate(J.Hc[0], J.Hc[1]); g.rotate(J.hang); g.scale(J.look, 1); fn(); g.restore();
  }
  function footDir(F, K, A) {
    const fn = fnorm(K, A);
    if (F.J.ground && A[1] > -ANK - 2.5) return [1, 0];
    return rotV(fn, 0.3);
  }

  // ---------- 部件：手、臂、袖 ----------
  function hand(g, F, W, d, kind, col) {
    const n = perp(d);
    g.fillStyle = col;
    if (kind === 'fist') { g.beginPath(); g.arc(W[0] + d[0] * 3, W[1] + d[1] * 3, 3.3, 0, TAU); g.fill(); return; }
    if (kind === 'point') {
      fillC(g, [ma(W, n, 2.3), ma(ma(W, d, 5), n, 2.2), ma(ma(W, d, 6.5), n, -1.4), ma(W, n, -2.4)], col);
      taper(g, [ma(ma(W, d, 4.5), n, 0.9), ma(ma(W, d, 8.5), n, 0.8), ma(ma(W, d, 12), n, 0.7)], (u) => thin(F, lerp(2.1, 1.2, u)), col);
      return;
    }
    fillC(g, [ma(W, n, 2.2), ma(ma(W, d, 5), n, 2.3), ma(ma(W, d, 8.4), n, 1), corner(ma(ma(W, d, 9.2), n, -0.2)), ma(ma(W, d, 6.2), n, -1.9),
      ma(ma(W, d, 3.4), n, -2.9), ma(W, n, -2.1)], col);
  }

  function limb(g, pts, ws, col) {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], n = perp(nrm(sub(b, a)));
      const p0 = ma(a, n, ws[i] / 2), p1 = ma(b, n, ws[i + 1] / 2), p2 = ma(b, n, -ws[i + 1] / 2), p3 = ma(a, n, -ws[i] / 2);
      g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.closePath();
    }
    g.fill('nonzero');
    for (let i = 1; i < pts.length - 1; i++) { g.beginPath(); g.arc(pts[i][0], pts[i][1], ws[i] / 2, 0, TAU); g.fill(); }
  }

  function arm(g, F, side) {
    const { J, sp, pal } = F;
    const S = J['S' + side], E = J['E' + side], W = J['W' + side], d = side === 'n' ? J.dn : J.df;
    const col = side === 'n' ? pal.ink : pal.far;
    const kind = F.PS['hand' + side.toUpperCase()] || (F.holds[side] ? 'fist' : 'open');
    const sl = F.PS.dancing && sp.sleeve === 'cuff' ? 'cuff' : sp.sleeve;
    if (sl === 'narrow' || sl === 'cuff' || sl === 'rolled') {
      const ws = sp.sex === 'f' ? [8.5, 6.8, 5.2] : [10, 7.8, 6];
      limb(g, [S, E, W], ws, sl === 'rolled' ? pal.ink : col);
      if (sl === 'cuff') { g.strokeStyle = mixc(pal.accent, '#000000', 0.15); g.lineWidth = 6.4; g.lineCap = 'butt'; g.beginPath(); const c0 = mid(E, W, 0.62), c1 = mid(E, W, 0.96); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke(); g.lineCap = 'round'; }
      if (sl === 'rolled') { g.strokeStyle = pal.accent; g.lineWidth = 7.4; g.beginPath(); const c0 = mid(E, W, 0.12), c1 = mid(E, W, 0.3); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke(); }
      if (sp.garment === 'miao') { g.strokeStyle = pal.accent; g.lineWidth = 5; g.lineCap = 'butt'; g.beginPath(); const c0 = mid(E, W, 0.6), c1 = mid(E, W, 0.82); g.moveTo(c0[0], c0[1]); g.lineTo(c1[0], c1[1]); g.stroke(); g.strokeStyle = pal.accent3; g.lineWidth = 1.8; g.beginPath(); const c2 = mid(E, W, 0.88); g.moveTo(c1[0], c1[1]); g.lineTo(c2[0], c2[1]); g.stroke(); g.lineCap = 'round'; }
      hand(g, F, W, d, kind, col);
      return;
    }
    // 广袖：袖兜朝重力一侧下垂，前臂竖起时袖口滑向肘部
    const D = sp.sd * (F.PS.sleeveK || 1);
    const grav = F.grav, T = F.T, wind = F.wind, t = F.t;
    const fd = nrm(sub(W, E));
    const slide = clamp((-dot(fd, grav) - 0.2) * 1.1, 0, 0.72);
    const C = mid(W, E, slide);
    let n = perp(fd); if (dot(n, grav) < 0) n = mul(n, -1);
    const par = Math.abs(dot(fd, grav));
    n = nrm(add(mul(n, 1 - par * 0.85), mul(nrm([T[0], 0.35]), par * 0.85)));
    const ph = (side === 'n' ? 0 : 1.9) + F.ph;
    const fl = (0.25 + wind) * Math.sin(t * 2.4 + ph), fl2 = (0.25 + wind) * Math.sin(t * 3.1 + ph + 1.1);
    const tw = mul(T, wind * D * 0.5);
    const o = mul(n, -1);
    // 袖口一线、袖角最低点、袖腹：手臂越竖直，袖兜越收窄
    const Dw = D * lerp(0.66, 0.46, par) * (1 - 0.35 * slide);
    const cuffT = ma(C, o, 4.4);
    const cuffB = add(ma(ma(ma(C, n, Dw), grav, D * 0.16), fd, 3), mul(tw, 0.55));
    const cuffM = add(mid(cuffT, cuffB, 0.5), add(mul(fd, 2.4), mul(tw, 0.2)));
    const tip = add(add(ma(ma(cuffB, grav, D * 0.3), fd, -D * 0.16), mul(tw, 0.5)), mul(perp(T), fl * 2.2));
    const belly = add(ma(ma(mid(E, C, 0.38), n, Dw * 0.86), grav, D * 0.2), add(mul(tw, 0.55), mul(perp(T), fl2 * 1.4)));
    const pit = ma(ma(S, grav, 11), J.fw, -1.5);
    const cap = ma(ma(S, J.up, 3.4), J.fw, side === 'n' ? -1 : -3);
    const pts = floorC(F, [cap, ma(S, o, 6.2), ma(E, o, 5.2), corner(cuffT), cuffM, corner(cuffB), tip, belly, pit]);
    if (sp.ragged) pts.splice(7, 0, corner(ma(mid(tip, belly, 0.3), n, -3)), corner(mid(tip, belly, 0.55)));
    g.beginPath(); pathC(g, pts);
    if (sp.sheer) {
      const gr = g.createLinearGradient(E[0], E[1], tip[0], tip[1]);
      gr.addColorStop(0, col); gr.addColorStop(1, mixc(col, pal.accent, 0.2));
      g.fillStyle = gr;
    } else g.fillStyle = col;
    g.fill();
    // 中衣袖口与里衬
    const ia = ma(C, o, 3.8), ib = ma(ma(C, n, D * 0.22), fd, 2.6);
    g.strokeStyle = ca(pal.inner, side === 'n' ? 0.4 : 0.25); g.lineWidth = thin(F, 1.7); g.lineCap = 'butt';
    g.beginPath(); g.moveTo(ia[0], ia[1]); g.lineTo(ib[0], ib[1]); g.stroke(); g.lineCap = 'round';
    g.strokeStyle = ca(pal.lining, side === 'n' ? 0.8 : 0.5); g.lineWidth = thin(F, 1.3);
    g.beginPath(); g.moveTo(cuffT[0], cuffT[1]); g.quadraticCurveTo(cuffM[0], cuffM[1], mid(cuffM, cuffB, 0.6)[0], mid(cuffM, cuffB, 0.6)[1]); g.stroke();
    if (slide > 0.05) limb(g, [C, W], [5.6, 5.2], col);
    // 水袖：舞姿时从袖口甩出长绢
    if (F.PS.dancing && (sp.sex === 'f')) {
      const a0 = angOf(fd), aim = aimAng(F, 0.55);
      const pts2 = flow(C, a0, aim, 84, 12, 0.8, 0.5, 1.6, t, ph + 0.7, 3.2);
      g.globalAlpha *= 0.7; silk(g, pts2, 9, 4, ca(pal.gauze || pal.accent, 1), null, t, ph, 1.2); g.globalAlpha /= 0.7;
    }
    hand(g, F, W, d, kind, col);
  }

  // ---------- 部件：腿、脚 ----------
  function foot(g, F, K, A, col, boot) {
    const fd = footDir(F, K, A), fn = perp(fd);
    const pts = [ma(A, fd, -3.6), corner(ma(ma(A, fd, -4.2), fn, ANK * 0.95)), ma(ma(A, fd, 10.5), fn, ANK),
      corner(ma(ma(A, fd, 13.2), fn, ANK * 0.55)), ma(ma(A, fd, 7), fn, 1.4), ma(A, fd, 3.2)];
    fillC(g, pts, col);
    if (boot) limb(g, [mid(K, A, 0.62), A], [8.6, 8], col);
  }
  function leg(g, F, H, K, A, col, opt = {}) {
    const ws = opt.ws || [15, 10.5, 8.4];
    limb(g, [H, K, A], ws, col);
    foot(g, F, K, A, col, opt.boot);
    if (opt.band) { g.strokeStyle = opt.band; g.lineWidth = 2; g.beginPath(); const b0 = ma(mid(K, A, 0.86), fnorm(K, A), 4.6), b1 = ma(mid(K, A, 0.86), fnorm(K, A), -4.6); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke(); }
  }
  // 沿腿（髋→膝→踝）按长度比例取点
  function alongLeg(H, K, A, f) {
    const L = LT + LS + ANK * 0.6, d = f * L;
    if (d <= LT) return mid(H, K, d / LT);
    if (d <= LT + LS) return mid(K, A, (d - LT) / LS);
    return ma(A, nrm(sub(A, K)), d - LT - LS);
  }

  // ---------- 下裳 ----------
  // 一整片：前缘贴前腿，后缘随风外扬；两腿分开时侧衩自然张开，露出裤腿
  function lowerGarment(g, F) {
    const { J, sp, pal, T, wind, t } = F;
    const g0 = sp.garment;
    const nearFront = J.Kn[0] + J.An[0] >= J.Kf[0] + J.Af[0];
    const fk = nearFront ? 'n' : 'f', bk = nearFront ? 'f' : 'n';
    const FH = J['H' + fk], FK = J['K' + fk], FA = J['A' + fk], BH = J['H' + bk], BK = J['K' + bk], BA = J['A' + bk];
    const frac = sp.nuwa ? 0.3 : sp.frac;
    const long = frac > 0.9;
    const dressy = g0 === 'dress' || g0 === 'gown' || g0 === 'priest' || g0 === 'longgown';
    const fl = (F.PS.flare || 1) * sp.flare;
    const wv = wind + (F.PS.walking ? 0.2 : 0);
    const grounded = J.ground && !F.PS.falling;
    const flare = (p, u, k = 1) => {
      const r = Math.sin(t * 2.5 - u * 2.4 + F.ph) * (0.5 + wv) * 2.6 * u;
      const q = add(add(p, mul(T, k * fl * wv * 26 * Math.pow(u, dressy ? 3.2 : 2.1))), mul(perp(T), r * k));
      if (grounded && q[1] > 0) q[1] = 0;
      return q;
    };
    const hemAt = (H, K, A, side, f, off) => {
      const p = alongLeg(H, K, A, f);
      const q = ma(p, f > 0.5 ? fnorm(K, A) : fnorm(H, K), side * off);
      if (grounded && dressy && long) q[1] = Math.max(q[1], -0.5);
      return q;
    };
    const highW = sp.sex === 'f' && (g0 === 'dress' || g0 === 'gown');
    const WF = highW ? at(J, J.N, sp.chest - 0.5, -19) : at(J, J.P, sp.waist + 0.5, 15);
    const WB = highW ? at(J, J.N, -sp.chest + 0.5, -19) : at(J, J.P, -sp.waist - 1, 15);
    const wide = dressy ? (g0 === 'longgown' ? 9 : 12) : 8;
    const hipF = fwd(J, J.P, highW ? 10 : 10.5), hipB = fwd(J, J.P, -12);
    const hemF = add(hemAt(FH, FK, FA, 1, frac, wide), mul(T, wv * 3));
    let hemB = flare(hemAt(BH, BK, BA, -1, frac, dressy ? wide - 1 : wide + 3), 1, 1.1);
    if (g0 === 'gown' || g0 === 'priest') hemB = add(hemB, [-14 - 12 * wind, 0]);
    if (grounded && dressy && long) hemB[1] = clamp(hemB[1], -2 - wv * 7, 0);
    const useKnee = frac > 0.62;
    const kneeF = add(ma(FK, fnorm(FH, FA), dressy ? 9 : 7.5), mul(T, wv * 2.5));
    const kneeB = flare(ma(BK, fnorm(BH, BA), dressy ? -10 : -9), 0.6);
    const shinB = flare(ma(alongLeg(BH, BK, BA, frac * 0.8), fnorm(BK, BA), dressy ? -10.5 : -9), 0.82);
    // 内侧下摆点与开衩
    const hfIn = add(hemAt(FH, FK, FA, -1, frac, 5.5), mul(T, wv * 4));
    const hbIn = flare(hemAt(BH, BK, BA, 1, frac, 5.5), 0.85, 0.6);
    const sep = Math.hypot(hfIn[0] - hbIn[0], hfIn[1] - hbIn[1]);
    const slit = dressy ? 0 : clamp((sep - 6) / 34, 0, 1);
    const crotch = up(J, J.P, -(frac > 0.6 ? 24 : 8));
    const apex = mid(mid(hfIn, hbIn), crotch, slit * 0.82);
    const waveL = (a, b, k, kf) => {
      const out = [];
      for (let i = 1; i <= 2; i++) {
        const p = mid(a, b, i / 3);
        const q = [p[0], p[1] - k * (1 + 1.4 * Math.sin(t * 2.1 + i * 2.3 + F.ph)) * (i % 2 ? 1 : -0.5)];
        out.push(kf ? flare(q, kf, 0.5) : q);
      }
      return out;
    };
    // 裤腿与靴
    if (!dressy && !sp.nuwa) {
      const opt = { boot: g0 !== 'short' && g0 !== 'miao', band: g0 === 'short' ? mixc(pal.ink, '#ffffff', 0.25) : g0 === 'miao' ? pal.silver : null,
        ws: sp.sex === 'f' ? [13, 9, 7] : [15, 10.5, 8.4] };
      leg(g, F, J.Hf, J.Kf, J.Af, mixc(pal.leg, '#ffffff', 0.05), opt);
      leg(g, F, J.Hn, J.Kn, J.An, pal.leg, opt);
    } else if (!sp.nuwa && (g0 === 'longgown' || F.PS.walking || F.PS.seated || F.PS.kneeling)) {
      foot(g, F, J.Kf, J.Af, pal.far); foot(g, F, J.Kn, J.An, pal.ink);
    }
    // 坐、跪、卧：取髋、膝、踝外扩点的凸包作衣裳外形，贴地处压平
    if (F.PS.seated || F.PS.kneeling || F.PS.lying) {
      const pad = dressy ? 9.5 : 8;
      const base = [WF, WB, hipF, hipB, at(J, J.P, -10, -6), at(J, J.P, 8, -6)];
      if (F.PS.ledge) base.push(at(J, J.P, -12, -16), at(J, J.P, -4, -20));
      const path = new Path2D();
      // 每条腿各取一个凸包，两腿之间保留衣裳的凹陷
      for (const k of ['n', 'f']) {
        const H = J['H' + k], K = J['K' + k], Aa = J['A' + k];
        const e = long || dressy ? Aa : alongLeg(H, K, Aa, frac);
        const P0 = base.slice();
        for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; P0.push(add(K, mul(pol(a), pad)), add(e, mul(pol(a), pad * (long ? 0.85 : 0.7)))); }
        if (frac > 0.5) P0.push(add(mid(K, e, 0.5), mul(fnorm(K, e), pad)));
        let hl = hull(P0);
        if (F.PS.floor) hl = hl.map((p) => [p[0], Math.min(p[1], -0.4)]);
        // 背风一侧随风轻扬
        hl = hl.map((p) => { const d = dot(sub(p, J.P), T); return d > 6 ? add(p, mul(T, wv * 6 * clamp((d - 6) / 40))) : p; });
        pathT(path, hl, 0.9);
      }
      const gr = g.createLinearGradient(J.P[0] - 20, 0, J.P[0] + 100, 0);
      gr.addColorStop(0, pal.panel); gr.addColorStop(1, mixc(pal.panel, pal.accent, dressy ? 0.12 : 0.06));
      g.fillStyle = gr; g.fill(path);
      if (pal.gauze && dressy) { g.fillStyle = ca(pal.gauze, 0.16); g.fill(path); }
      g.strokeStyle = ca(pal.fold, 0.24); g.lineWidth = thin(F, 0.75);
      const a1 = fwd(J, J.P, 2), b1 = mid(J.Kn, J.An, 0.6);
      g.beginPath(); g.moveTo(a1[0], a1[1]); g.quadraticCurveTo(J.Kn[0], J.Kn[1] - 4, b1[0], b1[1]); g.stroke();
      return;
    }
    const shape = [corner(WF), highW ? at(J, J.P, 10, 6) : hipF];
    if (useKnee) shape.push(kneeF);
    shape.push(corner(hemF), ...waveL(hemF, hfIn, 0.8));
    if (dressy) shape.push(...waveL(hfIn, hemB, 1.2, 0.9));
    else shape.push(corner(hfIn), slit > 0.05 ? corner(apex) : apex, corner(hbIn), ...waveL(hbIn, hemB, 1, 0.95));
    shape.push(corner(hemB));
    if (useKnee) shape.push(shinB, kneeB);
    shape.push(flare(highW ? at(J, J.P, -12, 6) : hipB, 0.25), corner(WB));
    const path = new Path2D(); pathC(path, shape);
    const y0 = useKnee ? FK[1] : J.P[1], y1 = Math.max(hemF[1], hemB[1]);
    const gr = g.createLinearGradient(0, y0, 0, y1 + 2);
    gr.addColorStop(0, pal.panel); gr.addColorStop(1, mixc(pal.panel, pal.accent, dressy ? 0.1 : 0.06));
    g.fillStyle = gr; g.fill(path);
    if (g0 === 'miao') {
      g.save(); g.clip(path);
      g.strokeStyle = ca(pal.fold, 0.5); g.lineWidth = thin(F, 0.7);
      for (let i = 1; i <= 6; i++) { const a = mid(WF, WB, i / 7), b = mid(hemF, hemB, i / 7); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      [[pal.accent, 2.4], [pal.accent3, 1.3], [pal.accent2, 2]].forEach(([c, w], k) => {
        g.strokeStyle = c; g.lineWidth = w; g.beginPath();
        [hemF, hfIn, hbIn, hemB].forEach((p, i) => { const q = up(J, p, 2 + k * 3.2); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
        g.stroke();
      });
      g.restore();
    } else {
      // 衣褶：两三道淡墨线随裙摆走
      g.strokeStyle = ca(pal.fold, dressy ? 0.32 : 0.26); g.lineWidth = thin(F, 0.75);
      const tops = [mid(WF, WB, 0.35), mid(WF, WB, 0.7)], bots = [mid(hemF, hfIn, 0.6), dressy ? mid(hfIn, hemB, 0.55) : mid(hbIn, hemB, 0.5)];
      for (let i = 0; i < 2; i++) {
        const a = up(J, tops[i], -8), b = up(J, bots[i], 3);
        const c = add(mid(a, b, 0.55), mul(T, 2 + i * 2));
        g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]); g.stroke();
      }
    }
    // 轻纱罩裙：沿裙身外扩，越往下越飘越浓
    if (pal.gauze && (g0 === 'dress' || g0 === 'gown')) {
      const out = (p, u, k) => {
        const q = add(add(p, mul(T, (1.5 + 10 * u * u) * k * (0.4 + wv))), [0, -1.5 * u]);
        if (grounded && q[1] > -0.5) q[1] = -0.5;
        return add(q, mul(perp(T), Math.sin(t * 2 - u * 3 + F.ph + k) * 2 * u * (0.4 + wv)));
      };
      const gz = [corner(at(J, J.N, sp.chest + 0.5, -17)), at(J, J.P, 12.5, 4)];
      if (useKnee) gz.push(add(ma(kneeF, fnorm(FH, FA), 1.5), mul(T, -1)));
      gz.push(corner(add(hemF, [2.5, -0.8])));
      gz.push(...waveL(hemF, hemB, 1.8, 0).map((p, i) => out(p, 0.6 + i * 0.2, 1)));
      gz.push(corner(out(hemB, 1, 1.15)), out(add(hemB, [3, -10]), 0.92, 1.25));
      if (useKnee) gz.push(out(shinB, 0.75, 1.2), out(kneeB, 0.55, 1.2));
      gz.push(out(highW ? at(J, J.P, -12, 6) : hipB, 0.3, 1), corner(at(J, J.N, -sp.chest - 0.5, -17)));
      g.beginPath(); pathC(g, gz);
      const gg = g.createLinearGradient(0, J.N[1] - 17, 0, y1);
      gg.addColorStop(0, ca(pal.gauze, 0.05)); gg.addColorStop(0.55, ca(pal.gauze, 0.14)); gg.addColorStop(1, ca(pal.gauze, 0.3));
      g.fillStyle = gg; g.fill();
      g.strokeStyle = ca(pal.gauze, 0.3); g.lineWidth = thin(F, 0.6); g.stroke();
    }
  }

  // ---------- 女娲蛇尾 ----------
  function tail(g, F) {
    const { J, pal, t, wind } = F;
    const P = J.P, ph = F.ph;
    const base = [[0, 0], [-3, 24], [10, 52], [30, 76], [24, 94], [-6, 101], [-44, 99], [-74, 86], [-94, 62], [-90, 40], [-78, 34]];
    const cp = base.map(([x, y], i) => {
      const k = i / (base.length - 1), a = 2 + 9 * k * k;
      return [P[0] + x + Math.sin(t * 1.15 - i * 0.75 + ph) * a * (k > 0.4 ? 1 : 0.4), P[1] + y + Math.cos(t * 0.9 - i * 0.6 + ph) * a * 0.55 * (i < 5 ? 0.2 : 1)];
    });
    // Catmull-Rom 采样
    const pts = [];
    for (let i = 0; i < cp.length - 1; i++) {
      const p0 = cp[Math.max(0, i - 1)], p1 = cp[i], p2 = cp[i + 1], p3 = cp[Math.min(cp.length - 1, i + 2)];
      for (let s = 0; s < 5; s++) {
        const u = s / 5, u2 = u * u, u3 = u2 * u;
        pts.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
      }
    }
    pts.push(cp[cp.length - 1]);
    const wf = (u) => (u < 0.08 ? lerp(19, 23, u / 0.08) : 23 * Math.pow(1 - (u - 0.08) / 0.92, 0.85) + 0.8);
    const gr = g.createLinearGradient(P[0] - 60, P[1], P[0] + 30, P[1] + 100);
    gr.addColorStop(0, pal.tail); gr.addColorStop(1, mixc(pal.tail, pal.scale, 0.28));
    taper(g, pts, wf, gr);
    // 腹鳞亮带与鳞纹
    const n = pts.length;
    g.strokeStyle = ca(pal.scale, 0.3); g.lineWidth = 2.2;
    g.beginPath();
    for (let i = 2; i < n; i++) { const u = i / (n - 1), d = nrm(sub(pts[i], pts[i - 1])), q = ma(pts[i], perp(d), -wf(u) * 0.32); i > 2 ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    g.stroke();
    g.lineWidth = Math.max(0.6, F.px);
    for (let i = 2; i < n - 2; i++) {
      const u = i / (n - 1), d = nrm(sub(pts[i + 1], pts[i - 1])), nn = perp(d), w = wf(u);
      const sh = 0.5 + 0.5 * Math.sin(t * 2.2 - i * 0.5);
      g.strokeStyle = ca(pal.scale, 0.18 + 0.32 * sh);
      for (let r = -1; r <= 1; r += 2) {
        const c = ma(pts[i], nn, r * w * 0.18 + (i % 2) * w * 0.08), a = angOf(d);
        g.beginPath(); g.arc(c[0], c[1], w * 0.2, a + PI * 0.55, a + PI * 1.45); g.stroke();
      }
    }
  }

  // ---------- 上身 ----------
  function torso(g, F) {
    const { J, sp, pal } = F;
    const ch = sp.chest, wa = sp.waist;
    const f = sp.sex === 'f';
    const pts = [
      at(J, J.N, -4.6, 2.2), at(J, J.N, 4.2, 2.4), at(J, J.N, ch - 1.5, -3.5), at(J, J.N, ch, -13), at(J, J.P, wa, 16), at(J, J.P, 9.5, 0),
      at(J, J.P, -11, 0), at(J, J.P, -wa - 1.5, 16), at(J, J.N, -9.8, -14), at(J, J.N, -8.6, -2.5),
    ];
    if (f) pts.splice(4, 0, at(J, J.N, ch + 0.8, -17.5));
    fillC(g, pts, sp.garment === 'miao' || sp.garment === 'jin' ? pal.ink : pal.panelTop);
    // 交领：浅色中衣领口斜下
    // 交领：自颈前斜下，掩向腋下
    const nf = at(J, J.N, 3.4, 2.2), c1 = at(J, J.N, 6.8, -8), c2 = at(J, J.N, 1, -21);
    g.strokeStyle = ca(pal.inner, sp.open ? 0.3 : 0.8); g.lineWidth = thin(F, 1.7);
    g.beginPath(); g.moveTo(nf[0], nf[1]); g.quadraticCurveTo(c1[0], c1[1], c2[0], c2[1]); g.stroke();
    const n2 = at(J, J.N, -1.2, 2.4), d1 = at(J, J.N, 2.6, -5), d2 = at(J, J.N, -1.5, -14);
    g.strokeStyle = ca(pal.inner, sp.open ? 0.2 : 0.45); g.lineWidth = thin(F, 1);
    g.beginPath(); g.moveTo(n2[0], n2[1]); g.quadraticCurveTo(d1[0], d1[1], d2[0], d2[1]); g.stroke();
    if (sp.open) fillC(g, [at(J, J.N, 4, 0.5), at(J, J.N, ch - 0.5, -12), at(J, J.N, ch - 1, -22), corner(at(J, J.N, ch - 4, -26)), at(J, J.N, 3, -12)], pal.innerTone);
    if (sp.towel) {
      const s0 = at(J, J.N, 0, -2), sw = 0.6 * Math.sin(F.t * 2 + F.ph);
      taper(g, [at(J, J.N, -7, 0), s0, at(J, J.N, 6, -9), at(J, J.N, 8 + sw, -26)], (u) => lerp(6.5, 5.5, u), '#e6dfcf');
      taper(g, [s0, at(J, J.N, -9, -6), at(J, J.N, -11 - sw, -22)], (u) => lerp(6, 5, u), '#d8d0be');
    }
    if (sp.flowerBall) {
      g.strokeStyle = pal.ribbon; g.lineWidth = 3.6;
      const a = at(J, J.N, -6, -2), b = at(J, J.P, 9, 18);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      const c = at(J, J.N, ch - 1, -20);
      for (let i = 0; i < 6; i++) { const q = add(c, pol(i * 1.05 + 0.3)); g.fillStyle = i % 2 ? '#d8242a' : '#ee4a46'; g.beginPath(); g.arc(q[0] + Math.cos(i) * 2.4, q[1] + Math.sin(i) * 2.4, 3.6, 0, TAU); g.fill(); }
      g.fillStyle = '#f6c45a'; g.beginPath(); g.arc(c[0], c[1], 1.6, 0, TAU); g.fill();
    }
    if (sp.pads) {
      const S = J.Sn;
      fillC(g, [corner(at(J, S, 12, -2)), at(J, S, 4, 7), corner(at(J, S, -18, 9)), at(J, S, -14, -3), at(J, S, -2, -6)], pal.ink);
      g.strokeStyle = ca(pal.accent2, 0.7); g.lineWidth = thin(F, 1);
      g.beginPath(); const p1 = at(J, S, 11, -2), p2 = at(J, S, -17, 8.5); g.moveTo(p1[0], p1[1]); g.quadraticCurveTo(at(J, S, -2, 8)[0], at(J, S, -2, 8)[1], p2[0], p2[1]); g.stroke();
      // 月牙图腾
      const m = at(J, J.N, ch - 3, -19);
      g.fillStyle = pal.moon; g.beginPath(); g.arc(m[0], m[1], 4.8, -1.2, 1.9); g.arc(m[0] + 2, m[1] - 0.8, 3.9, 1.7, -1.0, true); g.closePath(); g.fill();
    }
    if (sp.garment === 'miao') {
      // 苗银项圈
      const c = at(J, J.N, 1.5, -2.5);
      g.strokeStyle = pal.silver; g.lineWidth = 1.7;
      g.beginPath(); g.ellipse(c[0], c[1], 5.6, 1.8, J.hang * 0.5, 0.15, PI * 0.85); g.stroke();
      g.lineWidth = 1; g.beginPath(); g.ellipse(c[0] + 0.5, c[1] + 2.6, 7, 2.6, J.hang * 0.5, 0.2, PI * 0.8); g.stroke();
      // 衣襟刺绣
      g.strokeStyle = pal.accent; g.lineWidth = 1.8;
      g.beginPath(); const p1 = at(J, J.N, ch - 0.5, -10), p2 = at(J, J.P, wa + 0.5, 12); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.stroke();
    }
  }

  // 腰带、结与垂带
  function sash(g, F, layer) {
    const { J, sp, pal, t } = F;
    const highW = sp.sex === 'f' && (sp.garment === 'dress' || sp.garment === 'gown');
    const y = highW ? -19 : 15, base = highW ? J.N : J.P;
    const a = at(J, base, -(highW ? sp.chest : sp.waist + 1.2), y), b = at(J, base, (highW ? sp.chest : sp.waist + 0.5) + 0.3, y);
    if (layer === 'band') {
      g.strokeStyle = pal.sash; g.lineWidth = highW ? 3.2 : 4.4; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.lineCap = 'round';
      return;
    }
    const k = mid(a, b, 0.86);
    const aim = aimAng(F, 0.2 + 0.6 * F.wind);
    const L = highW ? 58 : sp.garment === 'short' ? 22 : 36;
    for (let i = 0; i < 2; i++) {
      const pts = floorC(F, flow(k, PI / 2 + 0.15 * i, aim, L * (1 - i * 0.18), 9, 1.1, 0.28 * (0.4 + F.wind), 2.6, t, F.ph + i * 1.7));
      silk(g, pts, highW ? 2.8 : 3.4, 1.6, pal.sash, pal.sashHi, t, F.ph + i, 2.1);
    }
    g.fillStyle = pal.sash; g.beginPath(); g.ellipse(k[0], k[1], 2.6, 2, 0, 0, TAU); g.fill();
  }

  // ---------- 头与发 ----------
  const FACE_M = [[-1, -12.3], [-7.6, -11.4], [-11.3, -6], [-11.5, 0.4], [-9, 6.4], corner([-5.6, 9.4]), [-1.5, 9.8], [3.8, 11.7],
    [6.8, 10.8], corner([7.6, 8.6]), [7.3, 7.4], corner([8.6, 6.2]), [8.1, 5.1], corner([8.8, 4.1]), corner([11.1, 1.7]), [8.9, -2.3], [9.5, -4.3], [8.4, -8.6], [4.6, -11.7]];
  const FACE_F = [[-1, -12], [-7.4, -11.2], [-11, -6], [-11.2, 0.4], [-8.8, 6.2], corner([-5.4, 9]), [-1.2, 9.6], [3.4, 11],
    [6.2, 10.2], corner([7, 8.3]), [6.9, 7.3], corner([7.9, 6.3]), [7.5, 5.3], corner([8.1, 4.4]), corner([9.9, 2.1]), [8.3, -1.9], [8.9, -4.1], [7.9, -8.5], [4.4, -11.4]];

  function headBlock(g, F) {
    const { J, sp, pal } = F;
    const H = headTf(F);
    // 颈
    const f = sp.sex === 'f';
    fillC(g, [corner(H.p(-5.4, 6.5)), corner(H.p(f ? 2 : 3, 9.5)), corner(at(J, J.N, f ? 4 : 4.8, 0)), corner(at(J, J.N, f ? -3.8 : -4.6, 0))], pal.ink);
    inHead(g, F, () => fillC(g, f ? FACE_F : FACE_M, pal.ink));
  }

  // 飘发：一绺主发加若干细丝
  function hairFlow(g, F, anchor, a0, L, w0, nStr, k = 1) {
    const { t, pal } = F;
    const ww = clamp(0.05 + 0.5 * F.wind * k, 0, 0.85);
    const aim = aimAng(F, ww);
    const amp = 0.09 * (0.45 + F.wind) * k;
    const pts = floorC(F, flow(anchor, a0, aim, L, 12, 0.85, amp, 1.7, t, F.ph, 3.2));
    taper(g, pts, (u) => (u < 0.22 ? lerp(w0 * 0.75, w0, u / 0.22) : lerp(w0, 1.1, Math.pow((u - 0.22) / 0.78, 1.25))), pal.hair);
    for (let i = 0; i < nStr; i++) {
      const r = A.h2(i, 31), off = (r - 0.5) * w0 * 0.5;
      const an = add(pts[2], mul(perp(pol(a0)), off));
      const ps = floorC(F, flow(an, a0 + (r - 0.5) * 0.2, aimAng(F, clamp(ww + 0.1 + 0.15 * r, 0, 0.9)), L * (0.55 + 0.3 * A.h2(i, 9)), 10, 0.9, amp * 2.4, 2.1 + r, t, F.ph + i * 1.9, 3.6));
      taper(g, ps, (u) => thin(F, lerp(1.1, 0.2, u)), pal.hair);
    }
  }

  function hairStyles(g, F, layer) {
    const { J, sp, pal, t } = F;
    const H = headTf(F);
    const hairA = (ax, ay) => angOf(H.d(ax, ay));
    const cap = (pts) => inHead(g, F, () => fillC(g, pts, pal.hair));
    const capStd = [[7.4, -8.6], [4.5, -12.6], [-2, -13.6], [-8.4, -11.8], [-12, -5.6], [-12.2, 1.5], corner([-8.6, 7.6]), [-6.2, 2], [-3.4, -2.8], [1.6, -6.2], corner([7.6, -6.8])];
    const ribbonTails = (p, L, w, col, n = 2) => {
      for (let i = 0; i < n; i++) {
        const pts = flow(p, hairA(-1, 0.9 + i * 0.5), aimAng(F, 0.22 + 0.62 * F.wind), L * (1 - i * 0.22), 11, 1.1, 0.42 * (0.35 + F.wind), 2.6, t, F.ph + 0.6 + i * 1.4, 4);
        silk(g, pts, w, w * 0.45, col, mixc(col, '#ffffff', 0.35), t, F.ph + i * 2, 2.2);
      }
    };
    const hs = sp.hair;
    const loose = sp.hairLoose;
    if (layer === 'back') {
      // 头后飘带（被头遮住根部）
      if (hs === 'hero' && !loose) ribbonTails(H.p(-5, -14), 48, 3.2, pal.ribbon);
      if (hs === 'hero' && loose) ribbonTails(H.p(-9, -9), 36, 2.6, pal.ribbon);
      if (hs === 'youth') ribbonTails(H.p(-7, -12), 22, 3, pal.ribbon);
      if (hs === 'tangyu') ribbonTails(H.p(-3, -15), 40, 2.8, pal.ribbon);
      if (hs === 'ponytail') ribbonTails(H.p(-7, -12.5), 28, 2.6, pal.ribbon);
      if (hs === 'linger' && !loose) { ribbonTails(H.p(-7, -14), 34, 2, pal.ribbon); }
      if (hs === 'caiyi') ribbonTails(H.p(-9, -6), 40, 2.4, pal.ribbon);
      if (hs === 'scholar') ribbonTails(H.p(-9, -9), 42, 3.2, mixc(pal.ink, '#000000', 0.2), 2);
      if (hs === 'wedding') ribbonTails(H.p(-5, -16), 36, 3, pal.ribbon);
      if (hs === 'crown') {
        // 冠后垂纱
        const pts = flow(H.p(-10, -8), hairA(-0.25, 1), aimAng(F, 0.12 + 0.35 * F.wind), 46, 10, 0.8, 0.12 * (0.5 + F.wind), 1.8, t, F.ph, 3);
        taper(g, pts, (u) => lerp(7, 3.5, u), ca(pal.accent, 0.5));
      }
      return;
    }
    if (layer === 'long') {
      // 披在背上的长发（在头之前画）
      if (loose) hairFlow(g, F, H.p(-8.5, -3), hairA(-0.3, 1), sp.nuwa ? 96 : sp.sex === 'f' ? 82 : 62, 13, 4, sp.nuwa ? 1.6 : 1.1);
      else if (hs === 'hero') hairFlow(g, F, H.p(-9.2, -1), hairA(-0.12, 1), 50, 9.5, 2);
      else if (hs === 'linger') hairFlow(g, F, H.p(-9.2, -1), hairA(-0.1, 1), 82, 11, 2);
      else if (hs === 'caiyi') hairFlow(g, F, H.p(-9.2, 0), hairA(-0.08, 1), 64, 10, 2);
      else if (hs === 'messy') hairFlow(g, F, H.p(-9.6, -4), hairA(-0.45, 1), 34, 11, 4, 1.4);
      else if (hs === 'miao') hairFlow(g, F, H.p(-9, 1), hairA(-0.2, 1), 42, 6, 1, 0.7);
      else if (hs === 'tangyu') hairFlow(g, F, H.p(-5, -14), hairA(-1, 0.5), 40, 7, 2, 1.1);
      else if (hs === 'ponytail') {
        const sw = 0.14 * Math.sin(t * 2.3 + F.ph) + (F.PS.walking ? 0.12 * Math.sin(F.PS.gait * 2) : 0);
        const a0 = hairA(-1, -0.4) + sw, aim = aimAng(F, 0.08 + 0.45 * F.wind);
        const pts = flow(H.p(-7.5, -12), a0, aim, 52, 12, 2.4, 0.14 * (0.5 + F.wind), 2.2, t, F.ph, 3.4);
        taper(g, pts, (u) => lerp(5, 1, Math.pow(u, 0.9)) * (1 + 0.45 * Math.sin(Math.min(1, u * 1.8) * PI)), pal.hair);
        for (let i = 0; i < 2; i++) {
          const ps = flow(H.p(-7.5, -12), a0 + 0.08 * i, aimAng(F, 0.18 + 0.55 * F.wind) + 0.1 * i, 46 - i * 6, 11, 2, 0.3 * (0.5 + F.wind), 2.6, t, F.ph + i * 2, 4);
          taper(g, ps, (u) => thin(F, lerp(1.2, 0.25, u)), pal.hair);
        }
      }
      return;
    }
    // 头上发型与头饰
    if (hs === 'hero' || hs === 'tangyu' || hs === 'wedding') {
      cap(capStd);
      if (hs === 'hero' && !loose) inHead(g, F, () => {
        g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-3, -14.6, 5.4, 4.4, -0.35, 0, TAU); g.fill();
        g.fillStyle = pal.ribbon; g.fillRect(-7.4, -13.2, 8.6, 2.4);
      });
      if (hs === 'hero' && loose) inHead(g, F, () => { g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-4, -12.6, 4.6, 3.4, -0.4, 0, TAU); g.fill(); g.fillStyle = pal.ribbon; g.fillRect(-8.5, -11.8, 6, 1.8); });
      if (hs === 'tangyu') inHead(g, F, () => {
        g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-2.5, -14, 4.4, 3.8, -0.3, 0, TAU); g.fill();
        fillC(g, [corner([-6, -14.6]), corner([-5.2, -19.4]), corner([1.6, -19.8]), corner([2.2, -14.2])], pal.crown);
        g.strokeStyle = pal.crown; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9.5, -17.4); g.lineTo(5.5, -17.8); g.stroke();
      });
      if (hs === 'wedding') inHead(g, F, () => {
        g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-2.5, -14, 5, 4.2, -0.3, 0, TAU); g.fill();
        fillC(g, [corner([-8, -13.5]), [-8.6, -19], corner([-5, -23]), [-2.5, -18.5], corner([0.5, -23.6]), [2.4, -18.5], corner([5.4, -21]), [4.6, -15], corner([3.2, -12.6])], pal.accent);
        g.fillStyle = '#d8242a'; g.beginPath(); g.arc(-2.2, -17.2, 1.6, 0, TAU); g.fill();
      });
      // 鬓发
      const pts = flow(H.p(5, -7.5), hairA(0.25, 1), aimAng(F, 0.12 + 0.3 * F.wind), hs === 'tangyu' ? 18 : 26, 7, 1.2, 0.12 * (0.4 + F.wind), 2.4, t, F.ph + 3, 4);
      taper(g, pts, (u) => thin(F, lerp(1.7, 0.35, u)), pal.hair);
      return;
    }
    if (hs === 'youth') {
      cap([[7.4, -8.4], corner([8.8, -5.8]), [6, -9.6], corner([6.4, -6.8]), [4, -11.8], [-2, -13.6], [-8.6, -11.6], [-12, -5.4], [-11.8, 2], corner([-8.6, 7.2]), [-5.6, 1], [-2.4, -3.6], [2.4, -6.4], corner([7.2, -6.2])]);
      inHead(g, F, () => {
        g.fillStyle = pal.ribbon; g.beginPath(); g.ellipse(-5.2, -14.2, 4.4, 3.8, -0.5, 0, TAU); g.fill();
        g.strokeStyle = mixc(pal.ribbon, '#000000', 0.25); g.lineWidth = 1.6; g.beginPath(); g.moveTo(6.6, -10.4); g.quadraticCurveTo(-1, -13.6, -11.2, -7.6); g.stroke();
      });
      return;
    }
    if (hs === 'linger' || hs === 'caiyi') {
      cap([[7, -8.2], [4.4, -12.4], [-2, -13.4], [-8.4, -11.6], [-12, -5.4], [-12, 2], corner([-8.6, 7.6]), [-6, 2], [-3, -3], [1.6, -6.2], corner([7.3, -6.6])]);
      if (hs === 'linger' && !loose) {
        inHead(g, F, () => {
          g.fillStyle = pal.hair;
          g.beginPath(); g.ellipse(-1.4, -15.6, 4.4, 5.4, 0.45, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(-8.2, -13.4, 4.2, 5.2, -0.6, 0, TAU); g.fill();
          g.fillStyle = mixc(pal.hair, '#000000', 0.5, 0.7);
          g.beginPath(); g.ellipse(-1.2, -15.8, 1.5, 2.3, 0.45, 0, TAU); g.fill();
          g.beginPath(); g.ellipse(-8.4, -13.6, 1.4, 2.2, -0.6, 0, TAU); g.fill();
        });
        flower(g, H.p(-4.8, -18.2), 2.9, pal.flower, pal.heart, t * 0.2);
        flower(g, H.p(-10.6, -9.4), 2.2, pal.flower, pal.heart, 1.3);
        // 步摇
        const b0 = H.p(1.5, -13.5), sw = 0.35 * Math.sin(t * 2.6 + F.ph) * (0.4 + F.wind);
        const b1 = add(b0, mul(pol(PI / 2 + sw), 7));
        g.strokeStyle = ca(pal.flower, 0.8); g.lineWidth = thin(F, 0.6); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
        g.fillStyle = pal.flower; g.beginPath(); g.arc(b1[0], b1[1], 1.2, 0, TAU); g.fill();
      } else if (hs === 'linger') {
        flower(g, H.p(-6, -12), 2.6, pal.flower, pal.heart, 0.5);
      }
      if (hs === 'caiyi') {
        inHead(g, F, () => { g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-8.6, -8, 5.2, 4.6, -0.4, 0, TAU); g.fill(); });
        const bp = H.p(-3, -14.5);
        A.butterfly(g, bp[0], bp[1], 0.42, t * 5 + F.ph, pal.accent2, J.hang - 0.3);
      }
      const pts = flow(H.p(4.8, -7), hairA(0.2, 1), aimAng(F, 0.12 + 0.3 * F.wind), loose ? 40 : 32, 8, 1.2, 0.12 * (0.4 + F.wind), 2.2, t, F.ph + 2.4, 4);
      taper(g, pts, (u) => thin(F, lerp(1.6, 0.3, u)), pal.hair);
      return;
    }
    if (hs === 'ponytail') {
      cap([[7.2, -8.2], [4.4, -12.6], [-2, -13.6], [-8.6, -11.4], [-11.8, -5.4], [-11.4, 1.5], corner([-8.6, 7]), [-6, 1.6], [-3, -3], [1.6, -6.2], corner([7.5, -6.6])]);
      inHead(g, F, () => {
        g.fillStyle = pal.ribbon; g.beginPath(); g.ellipse(-7.2, -12.2, 2.4, 3.2, -0.6, 0, TAU); g.fill();
        g.fillStyle = pal.hair; fillC(g, [[8, -7.4], corner([9.4, -4.6]), [6, -8], corner([6.4, -5.4]), [3.4, -8.6], corner([7.6, -9.4])], pal.hair);
      });
      return;
    }
    if (hs === 'miao') {
      cap(capStd);
      inHead(g, F, () => {
        const S = pal.silver, sw = 0.5 * Math.sin(t * 3.2 + F.ph);
        // 银角：两道弯月形高高翘起
        fillC(g, [corner([-1, -13]), [-6, -22], [-14, -28], corner([-22, -27.5]), [-13, -25], [-5.5, -18.5], corner([-4.2, -12.6])], S);
        fillC(g, [corner([1.5, -12.8]), [5, -21], [11, -27.5], corner([18.5, -28.5]), [10.5, -24.5], [4.8, -17.5], corner([4.6, -12])], mixc(S, '#9aa2b0', 0.25));
        g.fillStyle = S; g.beginPath(); g.ellipse(0, -12.4, 9.6, 3, -0.08, 0, TAU); g.fill();
        g.fillStyle = mixc(S, '#ffffff', 0.5); g.beginPath(); g.ellipse(1, -13.2, 5, 0.9, -0.08, 0, TAU); g.fill();
        g.fillStyle = S;
        for (let i = 0; i < 5; i++) { const x = -8 + i * 4, l = 3 + (i % 2) * 2; g.fillRect(x - 0.35, -10.5, 0.7, l); g.beginPath(); g.arc(x + sw * 0.6, -10.2 + l, 1, 0, TAU); g.fill(); }
        g.fillStyle = pal.accent; g.beginPath(); g.arc(2.6, -14.6, 1.3, 0, TAU); g.fill();
      });
      return;
    }
    if (hs === 'messy') {
      cap([[7.4, -8.2], corner([10, -10.6]), [5.6, -12.6], corner([4, -17.2]), [-0.4, -14], corner([-5.4, -18.6]), [-6.4, -13.6], corner([-13.8, -13]), [-11.4, -8.6], corner([-15.4, -3]), [-12, -0.6], corner([-13, 5.2]), [-8.6, 6], [-6, 1.6], [-2.4, -3.6], [2, -6], corner([7.3, -6.4])]);
      inHead(g, F, () => { g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-2.8, -15, 4.6, 3.6, -0.5, 0, TAU); g.fill(); g.strokeStyle = pal.ribbon; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-6.6, -13.2); g.lineTo(0.8, -14.8); g.stroke(); });
      for (let i = 0; i < 4; i++) {
        const ps = flow(H.p(-6 + i * 3.2, -13 + (i % 2) * 2), hairA(-0.9 + i * 0.3, -1 + i * 0.25), aimAng(F, 0.5 + 0.4 * F.wind), 9 + i * 2.5, 5, 1.2, 0.3, 3, t, F.ph + i, 3);
        taper(g, ps, (u) => thin(F, lerp(1.4, 0.3, u)), pal.hair);
      }
      return;
    }
    if (hs === 'highbun') {
      cap([[7, -8.4], [4.4, -12.2], [-2, -13.2], [-8.4, -11.4], [-11.8, -5.4], [-11.6, 1.6], corner([-8.4, 7]), [-5.6, 1.6], [-2.6, -3], [1.6, -6.2], corner([7.3, -6.6])]);
      inHead(g, F, () => {
        fillC(g, [[-6.8, -11], [-8.4, -18], [-6, -25.6], [-1.6, -27.4], [1.2, -23], [0.4, -16.6], [3.4, -12]], pal.hair);
        g.fillStyle = mixc(pal.hair, '#8a8780', 0.35); g.beginPath(); g.ellipse(-3.6, -19.4, 1.4, 4.6, 0.12, 0, TAU); g.fill();
        g.strokeStyle = pal.pin; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(-11.5, -16.5); g.lineTo(5, -21.5); g.stroke();
        g.beginPath(); g.moveTo(-10.5, -22.4); g.lineTo(4.4, -14.6); g.stroke();
        g.fillStyle = pal.pin; fillC(g, [corner([0.6, -15.2]), [3, -18.6], corner([5.2, -15.4]), [3, -14]], pal.pin);
      });
      const b0 = H.p(5, -21.5), sw = 0.4 * Math.sin(t * 2.2 + F.ph);
      for (let i = 0; i < 2; i++) { const b1 = add(b0, mul(pol(PI / 2 + sw + i * 0.25), 5 + i * 3)); g.strokeStyle = ca(pal.pin, 0.8); g.lineWidth = thin(F, 0.5); g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke(); g.fillStyle = i ? '#8fd0b8' : pal.pin; g.beginPath(); g.arc(b1[0], b1[1], 1, 0, TAU); g.fill(); }
      return;
    }
    if (hs === 'crown') {
      cap(capStd);
      inHead(g, F, () => {
        fillC(g, [corner([-9.5, -8]), [-11.4, -14], corner([-8.6, -26]), [-4, -24.5], corner([0.4, -30.4]), [3.4, -24], corner([7.8, -25.4]), [6.8, -15], corner([7, -9])], pal.ink);
        g.strokeStyle = pal.accent2; g.lineWidth = 1; g.beginPath(); g.moveTo(-10, -10.5); g.lineTo(7, -11); g.stroke();
        g.fillStyle = pal.moon;
        g.beginPath(); g.arc(0.8, -36, 6.4, 0.5, PI * 2 - 0.5 + 0.0); g.arc(3.4, -37.4, 5.3, PI * 2 - 0.75, 0.75, true); g.closePath(); g.fill();
        g.fillStyle = pal.accent; g.beginPath(); g.arc(-1.2, -16, 1.8, 0, TAU); g.fill();
      });
      return;
    }
    if (hs === 'scholar') {
      cap(capStd);
      inHead(g, F, () => fillC(g, [corner([8, -6.4]), [7.4, -12.6], corner([3.6, -16]), [-4, -16.8], corner([-10.6, -15]), [-12.2, -8], corner([-11.8, -4.6]), [-2, -8.6]], mixc(pal.ink, '#000000', 0.2)));
      const pts = flow(H.p(5, -6), hairA(0.2, 1), aimAng(F, 0.1 + 0.3 * F.wind), 16, 6, 1.2, 0.1, 2.4, t, F.ph + 3, 4);
      taper(g, pts, (u) => thin(F, lerp(1.4, 0.3, u)), pal.hair);
      return;
    }
    if (hs === 'cap' || hs === 'oldman') {
      cap([[7.2, -8], [4.4, -12], [-2, -13], [-8.4, -11.2], [-11.6, -5.4], [-11.2, 1.5], corner([-8.4, 6.6]), [-5.6, 1], [-2.6, -3], [1.6, -6], corner([7.3, -6.4])]);
      if (hs === 'cap') inHead(g, F, () => {
        fillC(g, [corner([8.4, -8]), [7, -14.6], [-1, -17.2], [-9.4, -14.4], corner([-11.6, -7.4])], mixc(pal.ink, '#000000', 0.25));
        g.fillStyle = pal.accent; g.beginPath(); g.arc(-1.4, -17.4, 1.5, 0, TAU); g.fill();
        g.strokeStyle = ca(pal.accent, 0.8); g.lineWidth = 1; g.beginPath(); g.moveTo(8.2, -8.6); g.lineTo(-11.4, -8); g.stroke();
      });
      else inHead(g, F, () => { g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-5, -12.4, 3.4, 2.8, -0.4, 0, TAU); g.fill(); });
      return;
    }
    if (hs === 'douli') {
      cap(capStd);
      inHead(g, F, () => {
        fillC(g, [corner([-23, -5.6]), [-6, -13], corner([0, -22]), [6, -13], corner([23, -6.2]), [0, -8.8]], pal.straw);
        g.strokeStyle = ca('#000000', 0.25); g.lineWidth = 0.8; g.beginPath(); g.moveTo(-12, -9); g.lineTo(0, -21); g.lineTo(12, -9.4); g.stroke();
      });
      return;
    }
    if (hs === 'headcloth') {
      cap(capStd);
      inHead(g, F, () => fillC(g, [corner([8.2, -7.6]), [7, -14], [-2, -16.4], [-10.6, -12.8], corner([-12, -5]), [-1, -8.6]], pal.accent));
      const pts = flow(H.p(-11, -7), hairA(-1, 0.6), aimAng(F, 0.4 + 0.5 * F.wind), 12, 5, 1.2, 0.3, 3, t, F.ph, 3);
      taper(g, pts, (u) => lerp(3, 1.4, u), pal.accent);
      return;
    }
    if (hs === 'bunF') {
      cap([[7, -8.2], [4.4, -12.4], [-2, -13.4], [-8.4, -11.6], [-12, -5.4], [-12, 2], corner([-8.6, 7.6]), [-6, 2], [-3, -3], [1.6, -6.2], corner([7.3, -6.6])]);
      inHead(g, F, () => { g.fillStyle = pal.hair; g.beginPath(); g.ellipse(-9.4, -6, 5, 5.4, -0.2, 0, TAU); g.fill(); g.strokeStyle = '#c9a25a'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-15, -8.6); g.lineTo(-4, -3.6); g.stroke(); });
    }
  }

  function flower(g, p, r, col, heart, rot) {
    g.fillStyle = col;
    for (let k = 0; k < 5; k++) { const a = rot + (k * TAU) / 5; g.beginPath(); g.ellipse(p[0] + Math.cos(a) * r * 0.55, p[1] + Math.sin(a) * r * 0.55, r * 0.55, r * 0.38, a, 0, TAU); g.fill(); }
    g.fillStyle = heart; g.beginPath(); g.arc(p[0], p[1], r * 0.3, 0, TAU); g.fill();
  }

  function beard(g, F) {
    const { sp, pal, t } = F;
    if (!sp.beard) return;
    const col = sp.beardCol || pal.hair;
    const H = headTf(F);
    const sw = 0.6 * Math.sin(t * 2 + F.ph) * (0.3 + F.wind);
    if (sp.beard === 'scruffy') {
      inHead(g, F, () => fillC(g, [[-4.6, 4], [0, 9.4], [4.6, 11.4], corner([8, 9.6]), corner([8.6, 5.6]), [9.4, 7.4], corner([7.6, 13]), corner([6.4, 18 + sw]), [4.4, 14.4], corner([2.2, 19 + sw]), [0.6, 13.4], corner([-2.6, 14]), [-3.6, 9.4]], col));
    } else {
      inHead(g, F, () => fillC(g, [corner([6.4, 9.6]), corner([8.8, 5.6]), [9.8, 8.2], [7.2, 12.6], corner([5.4 + sw, 25]), [4.2, 14], [3.4, 11.2]], col));
      const p = H.p(8.4, 5.6), d = H.d(0.4, 1);
      taper(g, [p, ma(p, d, 5), ma(ma(p, d, 9), H.d(-1, 0), 2 + sw)], (u) => thin(F, lerp(1.6, 0.4, u)), col);
    }
  }

  // ---------- 背后之物 ----------
  function backSword(g, F) {
    const { J, pal, t } = F;
    const top = at(J, J.N, -8, 8), dir = nrm(add(mul(J.up, -1), mul(J.fw, -0.17)));
    const tipP = ma(top, dir, 70);
    g.strokeStyle = pal.scabbard; g.lineWidth = 3.6; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(tipP[0], tipP[1]); g.stroke();
    g.strokeStyle = pal.metal; g.lineWidth = 3.8; g.lineCap = 'butt'; const t0 = ma(tipP, dir, -6); g.beginPath(); g.moveTo(t0[0], t0[1]); g.lineTo(tipP[0], tipP[1]); g.stroke(); g.lineCap = 'round';
    g.strokeStyle = pal.metal; g.lineWidth = 4.6; g.lineCap = 'butt';
    const r1 = ma(top, dir, 30), r2 = ma(top, dir, 32.5);
    g.beginPath(); g.moveTo(r1[0], r1[1]); g.lineTo(r2[0], r2[1]); g.stroke(); g.lineCap = 'round';
    const grip = ma(top, dir, -12);
    g.strokeStyle = pal.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(grip[0], grip[1]); g.stroke();
    const gn = perp(dir);
    g.strokeStyle = pal.metal; g.lineWidth = 2.4; g.beginPath(); const q1 = ma(top, gn, 5), q2 = ma(top, gn, -5); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    tassel(g, F, ma(grip, dir, -1.5), angOf(mul(dir, -1)), 26);
  }
  function tassel(g, F, p, a0, L) {
    const pts = flow(p, a0, aimAng(F, 0.3 + 0.6 * F.wind), L, 8, 1.6, 0.32 * (0.4 + F.wind), 3.2, F.t, F.ph + 4, 4);
    g.fillStyle = F.pal.tassel; g.beginPath(); g.arc(p[0], p[1], 1.6, 0, TAU); g.fill();
    taper(g, pts, (u) => thin(F, u < 0.25 ? 1.6 : lerp(2.6, 0.8, (u - 0.25) / 0.75)), F.pal.tassel);
  }
  function hipSword(g, F) {
    const { J, pal } = F;
    const top = at(J, J.P, 3, 14), dir = nrm(add(mul(J.fw, -0.55), mul(J.up, -0.84)));
    const tipP = ma(top, dir, 56);
    g.strokeStyle = pal.scabbard; g.lineWidth = 3.6; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(tipP[0], tipP[1]); g.stroke();
    const grip = ma(top, dir, -13);
    g.strokeStyle = pal.metal; g.lineWidth = 2.2; const gn = perp(dir), q1 = ma(top, gn, 4.5), q2 = ma(top, gn, -4.5);
    g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    g.strokeStyle = pal.ink; g.lineWidth = 2.8; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(grip[0], grip[1]); g.stroke();
    tassel(g, F, grip, angOf(mul(dir, -1)) + 0.4, 20);
  }
  function cape(g, F) {
    const { J, pal, T, wind, t } = F;
    const wv = wind + (F.PS.walking ? 0.2 : 0);
    const s0 = at(J, J.N, -6, -1), s1 = at(J, J.N, 7, -3);
    const yb = J.ground ? -1 : J.P[1] + 96;
    const fl = (u, k) => add(mul(T, wv * 34 * Math.pow(u, 1.3) * k), [0, Math.sin(t * 2.2 - u * 3 + F.ph) * 3 * u * (0.5 + wv)]);
    const hb = add([J.P[0] - 34, yb], fl(1, 1)), hm = add([J.P[0] - 10, yb], fl(1, 0.5));
    hb[1] = Math.min(hb[1], yb); hm[1] = Math.min(hm[1], yb);
    const back = [corner(s1), s0, add(at(J, J.P, -18, 30), fl(0.5, 0.8)), corner(hb), add(mid(hb, hm, 0.5), [0, -2]), corner(hm), add(at(J, J.P, -6, 10), fl(0.6, 0.3))];
    fillC(g, back.map((p) => add(p, [0, 0])), pal.capeLining);
    const front = back.map((p, i) => (i === 0 || i === 1 ? p : add(p, mul(T, -3.5))));
    fillC(g, front, pal.ink);
  }
  function wings(g, F) {
    const { J, pal, t } = F;
    const c = at(J, J.N, -7, -12);
    const flap = 0.62 + 0.38 * Math.abs(Math.sin(t * 1.4 + F.ph));
    const base = angOf(nrm(add(mul(J.fw, -1), mul(J.up, 0.25))));
    g.save(); g.translate(c[0], c[1]); g.rotate(base); g.scale(1, flap);
    const gr = g.createLinearGradient(0, -40, 46, 30);
    gr.addColorStop(0, ca(pal.accent, 0.55)); gr.addColorStop(1, ca(pal.accent2, 0.5));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(10, -46, 52, -48, 50, -18); g.bezierCurveTo(48, -6, 22, -2, 0, 0); g.fill();
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(16, 6, 40, 14, 34, 32); g.bezierCurveTo(26, 42, 6, 22, 0, 0); g.fill();
    g.strokeStyle = ca('#ffffff', 0.35); g.lineWidth = 0.7;
    for (const [x, y] of [[40, -30], [46, -16], [28, -36], [30, 24], [22, 28]]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(x * 0.5, y * 0.4, x, y); g.stroke(); }
    g.fillStyle = ca('#ffffff', 0.45); g.beginPath(); g.arc(38, -24, 3, 0, TAU); g.fill(); g.beginPath(); g.arc(26, 20, 2.2, 0, TAU); g.fill();
    g.restore();
  }
  function shawl(g, F, layer) {
    const { J, pal, t } = F;
    const col = ca(pal.shawl, 0.8), hi = ca('#ffffff', 0.38);
    const wk = 0.4 + F.wind;
    if (layer === 'back') {
      // 自肩后垂下，再被风托起
      const p = at(J, J.N, -8, -6);
      const pts = floorC(F, flow(p, angOf(nrm(add(mul(J.fw, -0.35), [0, 1]))), aimAng(F, 0.25 + 0.6 * F.wind), 82, 14, 0.75, 0.42 * wk, 1.6, t, F.ph + 0.3, 3));
      silk(g, pts, 4.4, 3.2, col, hi, t, F.ph, 1.5);
    } else {
      // 搭在近侧小臂上，下垂过膝后飘向身后
      const p = mid(J.En, J.Wn, 0.55);
      const pts = floorC(F, flow(p, PI / 2 + 0.1, aimAng(F, 0.18 + 0.55 * F.wind), 66, 13, 0.7, 0.4 * wk, 1.9, t, F.ph + 1.4, 3.2));
      silk(g, pts, 4, 2.8, col, hi, t, F.ph + 2, 1.7);
    }
  }
  function bells(g, F) {
    const { J, pal, t } = F;
    const a = at(J, J.P, -8, 15), b = at(J, J.P, 8, 15);
    for (let i = 0; i < 4; i++) {
      const p = mid(a, b, (i + 0.5) / 4), sw = 0.45 * Math.sin(t * 7.5 + i * 1.7 + F.ph) * (0.5 + F.wind) + (F.PS.walking ? 0.5 * Math.sin(F.PS.gait * 2 + i) : 0);
      const L = 5 + (i % 2) * 3, q = add(p, mul(pol(PI / 2 + sw * 0.6), L));
      g.strokeStyle = ca(pal.silver, 0.8); g.lineWidth = thin(F, 0.5); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      g.fillStyle = pal.silver; g.beginPath(); g.arc(q[0], q[1], 1.7, 0, TAU); g.fill();
    }
  }

  // ---------- 道具 ----------
  function swordBlade(g, F, grip, dir, L = 94) {
    const { pal } = F;
    const n = perp(dir);
    const guard = ma(grip, dir, 6), tip = ma(guard, dir, L);
    const gr = g.createLinearGradient(guard[0], guard[1], tip[0], tip[1]);
    gr.addColorStop(0, pal.blade); gr.addColorStop(1, pal.bladeTip);
    g.fillStyle = gr;
    const bw = Math.max(1.4, thin(F, 1.4));
    g.beginPath(); const b0 = ma(guard, n, bw), b1 = ma(ma(tip, dir, -7), n, bw * 0.85), b2 = ma(ma(tip, dir, -7), n, -bw * 0.85), b3 = ma(guard, n, -bw);
    g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.lineTo(tip[0], tip[1]); g.lineTo(b2[0], b2[1]); g.lineTo(b3[0], b3[1]); g.closePath(); g.fill();
    g.strokeStyle = pal.ink; g.lineWidth = 3; g.beginPath(); const p0 = ma(grip, dir, -7); g.moveTo(p0[0], p0[1]); g.lineTo(guard[0], guard[1]); g.stroke();
    g.strokeStyle = pal.metal; g.lineWidth = 2.4; const q1 = ma(guard, n, 5.2), q2 = ma(guard, n, -5.2); g.beginPath(); g.moveTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.stroke();
    g.fillStyle = pal.metal; g.beginPath(); g.arc(p0[0], p0[1], 1.8, 0, TAU); g.fill();
    tassel(g, F, ma(p0, dir, -1), angOf(mul(dir, -1)), 22);
    return tip;
  }
  function gourdAt(g, F, p, ang, s = 1) {
    const { pal } = F;
    g.save(); g.translate(p[0], p[1]); g.rotate(ang); g.scale(s, s);
    g.fillStyle = pal.gourd;
    g.beginPath(); g.arc(0, 4.6, 4.2, 0, TAU); g.fill();
    g.beginPath(); g.arc(0, 13.6, 6.8, 0, TAU); g.fill();
    g.fillRect(-1.6, -1.6, 3.2, 3.6);
    g.fillStyle = ca('#ffe8c8', 0.3); g.beginPath(); g.ellipse(-2.4, 11.6, 1.6, 3, 0.3, 0, TAU); g.fill();
    g.strokeStyle = pal.tassel; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3.6, 8.6); g.lineTo(3.6, 8.6); g.stroke();
    g.restore();
  }
  function heldProp(g, F) {
    const { J, pal, t, sp } = F;
    const W = J.Wn, d = J.dn;
    const pr = F.prop, pose = F.pose;
    if (F.swordMode === 'hand') F.swordTip = swordBlade(g, F, ma(W, d, 3), pose === 'swordUp' ? nrm(add(d, [0.02, -0.2])) : d);
    if (F.gourdMode === 'hand') {
      if (pose === 'drink') {
        const mouth = headTf(F).p(9, 6);
        const gp = ma(W, d, 2), ang = angOf(sub(mouth, gp)) - PI / 2 + PI;
        gourdAt(g, F, gp, ang + PI, 1);
        const lip = ma(gp, nrm(sub(mouth, gp)), 2);
        g.strokeStyle = ca('#f3e6c4', 0.65); g.lineWidth = thin(F, 0.9);
        g.beginPath(); g.moveTo(lip[0], lip[1]); g.quadraticCurveTo(lerp(lip[0], mouth[0], 0.5) + 1.5, lerp(lip[1], mouth[1], 0.5), mouth[0], mouth[1]); g.stroke();
      } else if (pose === 'lie') gourdAt(g, F, ma(W, d, 2), 2.6, 1);
      else gourdAt(g, F, ma(W, d, 3), 0.15 * Math.sin(t * 1.8 + F.ph), 1.1);
    }
    if (pose === 'drink' && F.gourdMode !== 'hand') {
      // 没有葫芦就举一只酒杯
      const c = ma(W, d, 4), n = perp(d);
      fillC(g, [corner(ma(c, n, 3.2)), corner(ma(ma(c, n, 2), d, 6)), corner(ma(ma(c, n, -2), d, 6)), corner(ma(c, n, -3.2))], pal.metal);
    }
    if (F.holds.n !== 'prop') return;
    if (pr === 'umbrella') {
      const top = [W[0] + 2, W[1] - 64];
      g.strokeStyle = pal.wood; g.lineWidth = 1.8; g.beginPath(); g.moveTo(W[0], W[1] + 10); g.lineTo(top[0], top[1]); g.stroke();
      const c = F.o.umbrellaColor || pal.umbrella;
      const gr = g.createLinearGradient(top[0] - 50, 0, top[0] + 50, 0);
      gr.addColorStop(0, mixc(c, '#000000', 0.25)); gr.addColorStop(0.55, mixc(c, '#ffffff', 0.15)); gr.addColorStop(1, mixc(c, '#000000', 0.3));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(top[0] - 54, top[1] + 20); g.quadraticCurveTo(top[0] - 44, top[1] - 4, top[0], top[1] - 6);
      g.quadraticCurveTo(top[0] + 44, top[1] - 4, top[0] + 54, top[1] + 20);
      for (let k = 6; k >= -6; k--) g.lineTo(top[0] + k * 9, top[1] + 20 + (k % 2 ? 3 : 0));
      g.closePath(); g.fill();
      g.strokeStyle = ca('#2a1010', 0.3); g.lineWidth = 0.8;
      for (let k = -5; k <= 5; k++) { g.beginPath(); g.moveTo(top[0], top[1] - 6); g.quadraticCurveTo(top[0] + k * 6, top[1] + 4, top[0] + k * 9, top[1] + 20); g.stroke(); }
    } else if (pr === 'lantern') {
      const sw = 0.12 * Math.sin(t * 1.7 + F.ph);
      const tip2 = add(W, [8, -4]);
      g.strokeStyle = pal.wood; g.lineWidth = 1.4; g.beginPath(); g.moveTo(W[0], W[1]); g.lineTo(tip2[0], tip2[1]); g.stroke();
      const c = add(tip2, mul(pol(PI / 2 + sw), 14));
      g.strokeStyle = ca(pal.ink, 0.8); g.lineWidth = 0.7; g.beginPath(); g.moveTo(tip2[0], tip2[1]); g.lineTo(c[0], c[1] - 7); g.stroke();
      const gr = g.createLinearGradient(0, c[1] - 8, 0, c[1] + 8);
      gr.addColorStop(0, '#ffd894'); gr.addColorStop(1, '#d8582e');
      g.fillStyle = gr; g.beginPath(); g.ellipse(c[0], c[1], 6.2, 8, sw, 0, TAU); g.fill();
      g.fillStyle = pal.ink; g.fillRect(c[0] - 3, c[1] - 9.4, 6, 2); g.fillRect(c[0] - 3, c[1] + 7.6, 6, 2);
      F.lanternAt = c;
    } else if (pr === 'staff') {
      const top = [W[0] + 1.5, -(sp.who === 'baiyue' ? 196 : 176) / (sp.h / 180)];
      const bot = [W[0] - 1.5, J.ground ? 0 : W[1] + 100];
      g.strokeStyle = pal.wood; g.lineWidth = 2.8; g.beginPath(); g.moveTo(bot[0], bot[1]); g.lineTo(top[0], top[1]); g.stroke();
      if (sp.who === 'baiyue') {
        g.fillStyle = pal.moon;
        g.beginPath(); g.arc(top[0], top[1] - 10, 11, 0.35, PI * 2 - 0.35 + 0.0); g.arc(top[0] + 4.5, top[1] - 12, 9.4, PI * 2 - 0.65, 0.65, true); g.closePath(); g.fill();
        g.fillStyle = pal.accent2; g.beginPath(); g.arc(top[0], top[1] - 1, 2.6, 0, TAU); g.fill();
        F.staffTop = [top[0], top[1] - 10];
      } else {
        g.strokeStyle = pal.wood; g.lineWidth = 2.6; g.beginPath(); g.moveTo(top[0], top[1]); g.quadraticCurveTo(top[0] + 9, top[1] - 8, top[0] + 3, top[1] - 13); g.quadraticCurveTo(top[0] - 4, top[1] - 12, top[0] - 1, top[1] - 6); g.stroke();
        g.fillStyle = '#8fd0b8'; g.beginPath(); g.arc(top[0] + 1.5, top[1] - 7.5, 2.3, 0, TAU); g.fill();
        const tp = flow([top[0] - 1, top[1] + 2], PI / 2, aimAng(F, 0.4 + 0.5 * F.wind), 16, 6, 1.4, 0.3, 2.6, t, F.ph, 3);
        taper(g, tp, (u) => thin(F, lerp(1.4, 0.4, u)), '#c84a3a');
        F.staffTop = [top[0] + 1.5, top[1] - 7.5];
      }
    } else if (pr === 'fan') {
      const c = ma(W, d, 2), a0 = -PI / 2 - 0.15 + 0.08 * Math.sin(t * 2.2 + F.ph);
      g.fillStyle = pal.paper; g.beginPath(); g.moveTo(c[0], c[1]); g.arc(c[0], c[1], 17, a0 - 0.95, a0 + 0.95); g.closePath(); g.fill();
      g.fillStyle = ca(pal.ink, 0.25); g.beginPath(); g.arc(c[0], c[1], 17, a0 - 0.95, a0 + 0.95); g.arc(c[0], c[1], 6, a0 + 0.95, a0 - 0.95, true); g.closePath(); g.fill();
      g.fillStyle = pal.paper; g.beginPath(); g.arc(c[0], c[1], 16, a0 - 0.95, a0 + 0.95); g.arc(c[0], c[1], 7, a0 + 0.95, a0 - 0.95, true); g.closePath(); g.fill();
      g.strokeStyle = ca(pal.ink, 0.45); g.lineWidth = thin(F, 0.5);
      for (let k = 0; k <= 8; k++) { const a = a0 - 0.95 + (k * 1.9) / 8; g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(c[0] + Math.cos(a) * 16.5, c[1] + Math.sin(a) * 16.5); g.stroke(); }
      g.strokeStyle = ca(pal.ink, 0.55); g.lineWidth = thin(F, 0.8); g.beginPath(); g.moveTo(c[0] + 4, c[1] - 11); g.quadraticCurveTo(c[0] - 2, c[1] - 9, c[0] - 5, c[1] - 12); g.stroke();
    } else if (pr === 'whip') {
      const h1 = ma(W, d, 11);
      g.strokeStyle = pal.wood; g.lineWidth = 2.4; g.beginPath(); g.moveTo(W[0], W[1]); g.lineTo(h1[0], h1[1]); g.stroke();
      const lash = F.pose === 'swordPoint' || F.pose === 'reach';
      const pts = lash ? flow(h1, angOf(d), angOf(d) + 0.4, 120, 14, 1, 0.5, 2.6, t, F.ph, 3.5) : flow(h1, angOf(d), PI / 2 - 0.4, 46, 10, 1, 0.45, 2.1, t, F.ph, 5);
      taper(g, pts, (u) => thin(F, lerp(1.8, 0.5, u)), pal.whip);
    }
  }
  function plantedSword(g, F) {
    const { J } = F;
    const x = J.Kn[0] + 12, grip = [x, -64];
    swordBlade(g, F, grip, [0.0, 1], 60);
  }
  function feetSword(g, F) {
    const { J } = F;
    const y = J.ground ? 3.2 : J.P[1] + 99;
    const x0 = Math.min(J.An[0], J.Af[0]) - 26;
    F.swordTip = swordBlade(g, F, [x0, y], [1, 0.0], 92);
    F.swordHilt = [x0, y];
  }

  // ---------- 整体 ----------
  function body(g, F) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (F.part !== 'front') bodyBack(g, F);
    if (F.part !== 'back') bodyFront(g, F);
  }
  function bodyBack(g, F) {
    const { sp, pal } = F;
    if (sp.wings) wings(g, F);
    if (sp.cape) cape(g, F);
    if (F.swordMode === 'back') backSword(g, F);
    if (sp.shawl) shawl(g, F, 'back');
    hairStyles(g, F, 'back');
    if (F.swordMode === 'hip') hipSword(g, F);
    arm(g, F, 'f');
    if (F.swordMode === 'planted') plantedSword(g, F);
    if (sp.nuwa) tail(g, F);
    lowerGarment(g, F);
    torso(g, F);
    sash(g, F, 'band');
    if (F.gourdMode === 'waist') {
      const p = at(F.J, F.J.P, 5, 13), sw = 0.18 * Math.sin(F.t * 1.9 + F.ph) + (F.PS.walking ? 0.2 * Math.sin(F.PS.gait) : 0);
      g.strokeStyle = pal.tassel; g.lineWidth = 0.9; const q = add(p, mul(pol(PI / 2 + sw), 5)); g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      gourdAt(g, F, q, -sw, 0.95);
    }
    if (sp.bells) bells(g, F);
    hairStyles(g, F, 'long');
    headBlock(g, F);
    beard(g, F);
    hairStyles(g, F, 'top');
    if (F.swordMode === 'feet') feetSword(g, F);
  }
  function bodyFront(g, F) {
    const { sp } = F;
    if (F.prop === 'staff' && F.holds.n === 'prop') heldProp(g, F);
    arm(g, F, 'n');
    if (F.prop !== 'staff' || F.holds.n !== 'prop') heldProp(g, F);
    if (!sp.nuwa) sash(g, F, 'tails');
    if (sp.shawl) shawl(g, F, 'front');
  }

  // 光与特效（直接画在主画布上，用加色）
  function fxBack(g, F, x, y, S) {
    const gl = F.glow;
    if (gl <= 0) return;
    const col = F.glowColor;
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    const cy = y - 95 * S;
    A.glow(g, x, cy, 150 * S, col, 0.35 * gl * F.alpha);
    A.glow(g, x, cy - 20 * S, 70 * S, '#ffffff', 0.18 * gl * F.alpha);
    if (F.sp.nuwa) {
      for (let i = 0; i < 9; i++) {
        const a = F.t * 0.6 + (i * TAU) / 9, r = (70 + 20 * Math.sin(F.t + i)) * S;
        A.glow(g, x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, 9 * S, col, (0.35 + 0.3 * Math.sin(F.t * 2 + i)) * gl * F.alpha);
      }
    }
    g.globalCompositeOperation = op;
  }
  function fxFront(g, F, x, y, S, f) {
    const op = g.globalCompositeOperation;
    const W = (p) => [x + p[0] * S * f, y + p[1] * S];
    g.globalCompositeOperation = 'lighter';
    if (F.swordMode === 'feet' && F.swordHilt) {
      const h = W(F.swordHilt), tp = W(F.swordTip);
      const len = Math.abs(tp[0] - h[0]);
      const gr = g.createLinearGradient(h[0] - len * 1.6 * f, 0, tp[0], 0);
      gr.addColorStop(0, 'rgba(160,220,255,0)'); gr.addColorStop(0.7, `rgba(170,225,255,${0.35 * F.alpha})`); gr.addColorStop(1, `rgba(230,250,255,${0.6 * F.alpha})`);
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(h[0] - len * 1.6 * f, h[1] - 7 * S); g.lineTo(h[0] - len * 1.6 * f, h[1] + 9 * S); g.closePath(); g.fill();
      A.glow(g, tp[0], tp[1], 22 * S, '#bfe8ff', 0.55 * F.alpha);
    }
    const fx = (F.o.fx ?? 1) * F.alpha;
    if (F.swordTip && F.swordMode === 'hand') A.glow(g, W(F.swordTip)[0], W(F.swordTip)[1], 14 * S, '#d8f0ff', 0.3 * fx);
    if (F.lanternAt) { const c = W(F.lanternAt); A.glow(g, c[0], c[1], 44 * S, '#ffb35c', 0.55 * fx); A.glow(g, c[0], c[1], 12 * S, '#fff0c8', 0.55 * fx); }
    if (F.staffTop && F.sp.who === 'baiyue') { const c = W(F.staffTop); A.glow(g, c[0], c[1], 20 * S, '#b9a8ff', 0.28 * fx); }
    g.globalCompositeOperation = op;
  }

  // ---------- 准备 ----------
  function prepare(who, s, t, o) {
    const sp = spec(who, o);
    const pose = POSES[o.pose] ? o.pose : 'stand';
    const facing = o.facing < 0 ? -1 : 1;
    const ph = (o.seed ?? 0) * 1.37 + (who.length * 0.7);
    let prop = o.prop || sp.prop;
    if (prop === 'none') prop = null;
    const q = { t, o, sp, ph, prop, sword: prop === 'sword' };
    const PS = POSES[pose](q);
    carry(q, PS, pose);
    if (o.lean) PS.tor = (PS.tor || 0) + o.lean;
    if (o.head) PS.head = (PS.head || 0) + o.head;
    if (sp.nuwa) {
      PS.pel = [0, -104]; PS.ground = false;
      PS.lN = { a: [0.04, 0] }; PS.lF = { a: [-0.04, 0] };
      if (pose === 'stand') { PS.aN = { h: (J) => at(J, J.N, 13, -22), b: 1 }; PS.aF = { h: (J) => at(J, J.N, 11, -18), b: 1 }; PS.head = -0.1; }
    }
    const breath = 0.45 * Math.sin(t * 1.5 + ph);
    const J = solve(PS, { breath });
    const wind = clamp(Math.max(o.wind ?? 0.35, PS.windMin || 0) * (0.86 + 0.28 * A.noise1(t * 0.45 + ph, 3)), 0, 1.2);
    const wdir = (o.windDir ?? -facing) * facing;
    const T = nrm([wdir < 0 ? -1 : 1, -0.16 - 0.08 * Math.sin(t * 0.7 + ph) - (PS.flying ? 0.12 : 0)]);
    const grav = PS.grav ? nrm(PS.grav) : [0, 1];
    // 剑与葫芦放在哪
    const swordPose = pose === 'swordUp' || pose === 'swordPoint';
    let swordMode = null;
    const hasSword = prop === 'sword' || sp.backSword;
    if (pose === 'flySword') swordMode = 'feet';
    else if (swordPose && (prop === 'sword' || sp.backSword)) swordMode = 'hand';
    else if (pose === 'kneel' && prop === 'sword' && !o.cradle) swordMode = 'planted';
    else if (hasSword && pose !== 'lie') swordMode = sp.swordAt;
    let gourdMode = null;
    if (prop === 'gourd' || sp.gourd) {
      if (pose === 'drink' || (pose === 'lie' && prop === 'gourd') || (prop === 'gourd' && sp.who === 'jiujianxian' && CARRY[pose])) gourdMode = 'hand';
      else gourdMode = 'waist';
      if (swordMode === 'hand') gourdMode = 'waist';
    }
    const holds = { n: null, f: null };
    if (swordMode === 'hand' || gourdMode === 'hand' || pose === 'drink') holds.n = 'held';
    else if (prop && ['umbrella', 'lantern', 'staff', 'fan', 'whip'].includes(prop) && pose !== 'fall') holds.n = 'prop';
    if (swordMode === 'planted') holds.f = 'held';
    const ink = o.ink || sp.ink, accent = o.accent || sp.accent;
    const pal = {
      ink, accent, far: mixc(ink, '#ffffff', 0.07), leg: mixc(ink, '#000000', 0.15),
      panel: o.ink ? ink : sp.panel || ink, panelTop: o.ink ? ink : sp.panelTop || ink,
      hair: o.whiteHair ? '#e6e2da' : o.ink && !sp.hairCol ? mixc(ink, '#000000', 0.2) : sp.hairCol || mixc(ink, '#000000', 0.28),
      ribbon: o.ribbon || sp.ribbon, tassel: o.tassel || sp.tassel, inner: sp.inner, accent2: sp.accent2 || accent, accent3: sp.accent3 || accent,
      lining: sp.lining || accent, sash: o.sash || (sp.garment === 'jin' ? sp.accent : accent),
      fold: mixc(ink, '#ffffff', 0.32), innerTone: mixc(ink, '#c8a888', 0.28),
      gauze: sp.gauze === null ? null : sp.gauze, shawl: sp.shawl || accent, flower: sp.flower || '#f6dce6', heart: sp.heart || '#d8708e',
      silver: sp.silver || '#dfe3ea', moon: sp.moon || '#dfe2f6', crown: '#c8d2d8', pin: '#d8b25e',
      blade: '#e8eef0', bladeTip: '#aab8c0', metal: '#b89a5a', scabbard: mixc(ink, '#3a2a20', 0.4),
      gourd: '#a8602c', wood: '#3a2a1e', paper: '#efe5cf', umbrella: '#b8322a', whip: '#5a1c1a', straw: '#7a6a4c',
      tail: sp.tailInk ? (o.ink ? ink : sp.tailInk) : ink, scale: sp.scale || '#bdeee9', capeLining: sp.accent || '#5d3290',
    };
    pal.sashHi = mixc(pal.sash, '#ffffff', 0.4);
    if (o.whiteHair && sp.beard) sp.beardCol = '#e6e2da';
    const glow = o.glow ?? sp.glow;
    const rim = o.rim === true ? '#ffe9c4' : o.rim || null;
    const F = {
      sp, pal, J, PS, t, o, pose, prop, facing, ph, wind, T, grav, swordMode, gourdMode, holds,
      alpha: o.alpha ?? 1, part: o.part || 'all', glow, glowColor: o.glowColor || rim || (sp.nuwa ? '#bff3ee' : pal.accent), rim, px: 1,
    };
    return F;
  }

  // 局部包围盒（未翻转）：骨架外扩，再并上道具与飘带可能到达的范围
  function bbox(F) {
    const J = F.J;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const inc = (p, m = 0) => { x0 = Math.min(x0, p[0] - m); x1 = Math.max(x1, p[0] + m); y0 = Math.min(y0, p[1] - m); y1 = Math.max(y1, p[1] + m); };
    for (const k of PTS) inc(J[k]);
    const mx = 62 + 46 * F.wind + (F.PS.dancing ? 60 : 0) + (F.sp.cape || F.sp.wings ? 30 : 0) + (F.sp.shawl ? 20 : 0);
    x0 -= mx; x1 += mx; y0 -= 52; y1 += 14;
    if (F.swordMode === 'hand') { inc(ma(J.Wn, J.dn, 110), 8); inc(ma(J.Wn, J.dn, -40), 8); }
    if (F.swordMode === 'feet') { x0 = Math.min(x0, -80); x1 = Math.max(x1, 80); }
    if (F.prop === 'staff' || F.prop === 'umbrella') { inc([J.Wn[0], -215], 70); }
    if (F.sp.nuwa) { inc(add(J.P, [-120, 112])); inc(add(J.P, [50, 112])); }
    if (F.PS.dancing) y0 -= 40;
    return [x0, x1, y0, y1];
  }

  // ---------- 离屏合成（透明度与轮廓光） ----------
  let bufA = null, bufB = null, bufC = null;
  function buf(c, w, h) {
    if (!c) c = document.createElement('canvas');
    if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
    return c;
  }

  const fig = (XYT.fig = XYT.fig || {});
  fig.draw = function (g, who, x, y, s, t, opts) {
    const o = opts || {};
    const F = prepare(who, s, t, o);
    if (F.alpha <= 0.004 || s <= 0) return;
    const S = s * F.sp.h / 180, f = F.facing;
    const m = g.getTransform(), dev = Math.hypot(m.a, m.b) || 1;
    F.px = 1 / (S * dev);
    if (F.part !== 'front') fxBack(g, F, x, y, S);
    if (!F.rim && F.alpha >= 0.999) {
      g.save(); g.translate(x, y); g.scale(S * f, S);
      body(g, F);
      g.restore();
    } else {
      const [bx0, bx1, by0, by1] = bbox(F);
      const X0 = f > 0 ? bx0 : -bx1, X1 = f > 0 ? bx1 : -bx0;
      let k = S * dev;
      const maxPx = 2600;
      k = Math.min(k, maxPx / (X1 - X0), maxPx / (by1 - by0));
      const pw = Math.ceil((X1 - X0) * k), ph = Math.ceil((by1 - by0) * k);
      bufA = buf(bufA, pw, ph);
      const a = bufA.getContext('2d');
      a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1;
      a.clearRect(0, 0, pw + 2, ph + 2);
      a.setTransform(k * f, 0, 0, k, -X0 * k, -by0 * k);
      F.px = 1 / k;
      body(a, F);
      if (F.rim) {
        // 轮廓光：半分辨率求“朝光一侧的边”，放大后只留在剪影之内，边缘自然柔和
        const dq = 2, hw = Math.ceil(pw / dq), hh = Math.ceil(ph / dq);
        bufB = buf(bufB, hw, hh); bufC = buf(bufC, hw, hh);
        const b = bufB.getContext('2d'), c2 = bufC.getContext('2d');
        c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalCompositeOperation = 'copy'; c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
        c2.drawImage(bufA, 0, 0, pw, ph, 0, 0, hw, hh);
        const rd = o.rimDir || [-f * 0.8, -0.6], rl = Math.hypot(rd[0], rd[1]) || 1;
        const rw = clamp((1.55 * k * (o.rimWidth || 1)) / dq, 0.3, 6);
        b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1;
        b.globalCompositeOperation = 'copy'; b.drawImage(bufC, 0, 0, hw, hh, 0, 0, hw, hh);
        b.globalCompositeOperation = 'source-in'; b.fillStyle = F.rim; b.fillRect(0, 0, hw, hh);
        b.globalCompositeOperation = 'destination-out'; b.drawImage(bufC, 0, 0, hw, hh, (-rd[0] / rl) * rw, (-rd[1] / rl) * rw, hw, hh);
        a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-atop'; a.globalAlpha = (o.rimAlpha ?? 0.95) * clamp(0.45 + k * 0.7, 0.5, 1);
        a.imageSmoothingEnabled = true; a.imageSmoothingQuality = 'medium';
        a.drawImage(bufB, 0, 0, hw, hh, 0, 0, pw, ph);
        a.globalAlpha = 1; a.globalCompositeOperation = 'source-over';
      }
      const ga = g.globalAlpha;
      g.globalAlpha = ga * F.alpha;
      g.drawImage(bufA, 0, 0, pw, ph, x + X0 * S, y + by0 * S, pw / k * S, ph / k * S);
      g.globalAlpha = ga;
    }
    if (F.part !== 'back') fxFront(g, F, x, y, S, f);
  };
  // 两人相拥：先画甲（不含近侧手臂），再画乙，最后补上甲搭在乙背上的手臂
  fig.pair = function (g, a, b) {
    const A0 = Array.isArray(a) ? a : [a.who, a.x, a.y, a.s, a.t, a.opts];
    const B0 = Array.isArray(b) ? b : [b.who, b.x, b.y, b.s, b.t, b.opts];
    fig.draw(g, A0[0], A0[1], A0[2], A0[3], A0[4], Object.assign({}, A0[5], { part: 'back' }));
    fig.draw(g, B0[0], B0[1], B0[2], B0[3], B0[4], B0[5]);
    fig.draw(g, A0[0], A0[1], A0[2], A0[3], A0[4], Object.assign({}, A0[5], { part: 'front' }));
  };

  // 关键点（世界坐标），用于挂特效：头、双手、剑尖、腰、头顶
  fig.points = function (who, x, y, s, t, opts) {
    const o = opts || {};
    const F = prepare(who, s, t, o);
    const S = s * F.sp.h / 180, f = F.facing, J = F.J;
    const W = (p) => [x + p[0] * S * f, y + p[1] * S];
    const H = headTf(F);
    const out = { head: W(J.Hc), top: W(H.p(0, -14)), mouth: W(H.p(9, 6)), handN: W(ma(J.Wn, J.dn, 5)), handF: W(ma(J.Wf, J.df, 5)), waist: W(at(J, J.P, 0, 15)), pelvis: W(J.P), chest: W(at(J, J.N, 4, -14)),
      footN: W(add(J.An, [4, ANK])), footF: W(add(J.Af, [4, ANK])) };
    if (F.swordMode === 'hand') out.swordTip = W(ma(ma(J.Wn, J.dn, 9), F.pose === 'swordUp' ? nrm(add(J.dn, [0.02, -0.2])) : J.dn, 94));
    return out;
  };
  // 步行时脚下不打滑的前进速度（逻辑像素/秒）
  fig.walkSpeed = function (who, s, opts) {
    const o = opts || {}, sp = spec(who, o);
    const amp = sp.sex === 'f' ? 0.3 : 0.36;
    return 4 * (LT + LS) * Math.sin(amp) * 0.85 * (o.speed || 1) * s * sp.h / 180;
  };
  fig.height = (who, opts) => spec(who, opts || {}).h;
  fig.who = Object.keys(CHARS);
  fig.poses = Object.keys(POSES);
  fig.stages = Object.keys(STAGES);

  // ---------- 预览画廊 ----------
  function galleryBg(g, c) {
    const { W, H } = A;
    A.fillV(g, 0, H / 2, [[0, '#efe7d6'], [1, '#e2d7c1']]);
    g.fillStyle = 'rgba(80,60,40,0.10)'; g.fillRect(0, 332, W, 2);
    A.fillV(g, H / 2, H, [[0, '#0b1226'], [1, '#1c2747']]);
    A.glow(g, 1120, 410, 120, '#f3e3b6', 0.35);
    g.fillStyle = '#f6ecc8'; g.beginPath(); g.arc(1120, 410, 22, 0, TAU); g.fill();
    g.fillStyle = 'rgba(200,220,255,0.12)'; g.fillRect(0, 692, W, 2);
  }
  function label(g, x, y, s, night) {
    g.font = '13px "Noto Serif SC", serif'; g.textAlign = 'center';
    g.fillStyle = night ? 'rgba(230,236,255,0.7)' : 'rgba(40,30,20,0.7)';
    g.fillText(s, x, y);
  }
  function shadow(g, x, y, w, night) {
    g.fillStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,20,0.16)';
    g.beginPath(); g.ellipse(x, y + 1, w, 4, 0, 0, TAU); g.fill();
  }
  function gallery(id, name, items) {
    XYT.registerShot(id, {
      name, zone: 'bottom', night: false, text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6', bloom: 0.15,
      draw(g, c) {
        galleryBg(g, c);
        const n = items.length, dx = 1280 / n;
        items.forEach((it, i) => {
          for (const night of [false, true]) {
            const x = dx * (i + 0.5) + (it.dx || 0), y = night ? 692 : 332;
            const o = Object.assign({ wind: 0.45, seed: i }, it.o, night ? Object.assign({ rim: '#ffe2b0' }, it.night || {}) : {});
            if (!it.noShadow) shadow(g, x, y, 34 * (it.s || 1), night);
            if (it.pre) it.pre(g, x, y, c.t, night);
            fig.draw(g, it.who, x, y, it.s || 1, c.t, o);
            if (it.post) it.post(g, x, y, c.t, night, o);
            label(g, dx * (i + 0.5), y + 22, it.label, night);
          }
        });
      },
    });
  }
  if (XYT.registerShot) {
    gallery('kit_figures_xiaoyao', '人物·李逍遥', [
      { who: 'xiaoyao', label: '店小二·立', o: { stage: 'youth' } },
      { who: 'xiaoyao', label: '店小二·行', o: { stage: 'youth', pose: 'walk' } },
      { who: 'xiaoyao', label: '侠客·立', o: {} },
      { who: 'xiaoyao', label: '侠客·指剑', o: { pose: 'swordPoint' }, dx: -30 },
      { who: 'xiaoyao', label: '侠客·举剑', s: 0.86, o: { pose: 'swordUp' } },
      { who: 'xiaoyao', label: '白发·回望', o: { stage: 'old', pose: 'lookBack' } },
      { who: 'xiaoyao', label: '婚服', o: { stage: 'wedding' } },
    ]);
    gallery('kit_figures_women', '人物·女角', [
      { who: 'linger', label: '灵儿·立', o: {} },
      { who: 'linger', label: '灵儿·舞', o: { pose: 'dance' } },
      { who: 'linger', label: '女娲', o: { form: 'nuwa' }, night: { rim: '#c8fff6' } },
      { who: 'yueru', label: '月如·指剑', o: { pose: 'swordPoint' }, dx: -30 },
      { who: 'anu', label: '阿奴', o: { pose: 'walk' } },
      { who: 'caiyi', label: '彩依', o: { pose: 'reach' } },
      { who: 'laolao', label: '姥姥', o: {} },
    ]);
    gallery('kit_figures_others', '人物·男角与路人', [
      { who: 'tangyu', label: '唐钰', o: { pose: 'walk' } },
      { who: 'jiujianxian', label: '酒剑仙·饮', o: { pose: 'drink' } },
      { who: 'jiujianxian', label: '酒剑仙·笑', o: { pose: 'laugh' } },
      { who: 'baiyue', label: '拜月教主', s: 0.95, o: {} },
      { who: 'jinyuan', label: '刘晋元', o: {} },
      { who: 'storyteller', label: '说书人', o: {} },
      { who: 'villager', label: '路人×4', noShadow: true, s: 0.7, dx: -28, o: { pose: 'walk' },
        pre(g, x, y, t, night) { [1, 2].forEach((v, k) => fig.draw(g, 'villager', x - 50 + k * 30, y - 6, 0.55, t, { variant: v, pose: k ? 'stand' : 'walk', seed: v, rim: night ? '#ffe2b0' : null, facing: k ? -1 : 1 })); },
        post(g, x, y, t, night) { fig.draw(g, 'villager', x + 50, y, 0.65, t, { variant: 3, seed: 3, pose: 'walk', facing: -1, rim: night ? '#ffe2b0' : null }); } },
    ]);
    const XO = { stage: 'hero' };
    gallery('kit_figures_poses', '人物·姿势（一）', [
      { who: 'xiaoyao', label: 'walk', o: Object.assign({ pose: 'walk' }, XO) },
      { who: 'xiaoyao', label: 'sit', o: { pose: 'sit' } },
      { who: 'xiaoyao', label: 'sit 墙头', o: { pose: 'sit', seat: 'ledge' }, pre(g, x, y, t, n) { g.fillStyle = n ? '#2a3350' : '#cbbfa8'; g.fillRect(x - 60, y, 120, 26); } },
      { who: 'xiaoyao', label: 'kneel', o: { pose: 'kneel' } },
      { who: 'xiaoyao', label: 'flySword', o: { pose: 'flySword' } },
      { who: 'xiaoyao', label: 'reach', o: { pose: 'reach' } },
      { who: 'xiaoyao', label: 'fall', s: 0.8, o: { pose: 'fall' } },
    ]);
    gallery('kit_figures_poses2', '人物·姿势（二）', [
      { who: 'xiaoyao', label: 'drink', o: { pose: 'drink', prop: 'gourd' } },
      { who: 'xiaoyao', label: 'laugh', o: { pose: 'laugh' } },
      { who: 'jiujianxian', label: 'lie', o: { pose: 'lie' }, dx: 20 },
      { who: 'linger', label: 'lookBack', o: { pose: 'lookBack' } },
      { who: 'linger', label: 'whisper', o: { pose: 'whisper' } },
      { who: 'linger', label: 'umbrella', o: { pose: 'walk', prop: 'umbrella' } },
      { who: 'linger', label: 'lantern', o: { pose: 'stand', prop: 'lantern' } },
    ]);
    gallery('kit_figures_poses3', '人物·姿势（三）与道具', [
      { who: 'baiyue', label: 'summon 召唤', s: 0.92, o: { pose: 'summon' }, night: { rim: '#c8b8ff', glow: 0.5, glowColor: '#8a6cff' } },
      { who: 'anu', label: 'pray 许愿', o: { pose: 'pray' }, night: { glow: 0.35, glowColor: '#ffd27a' } },
      { who: 'yueru', label: 'whip', o: { pose: 'reach', prop: 'whip' } },
      { who: 'storyteller', label: 'fan', o: { pose: 'walk' } },
      { who: 'laolao', label: 'staff·walk', o: { pose: 'walk' } },
      { who: 'linger', label: '虚影 ink+alpha', o: { pose: 'lookBack', ink: '#e9eef3', alpha: 0.55, glow: 0.35, glowColor: '#cfe4ff' }, night: { rim: null } },
      { who: 'xiaoyao', label: 'old·drink', o: { stage: 'old', pose: 'drink' } },
    ]);
    // 双人：相拥、耳语、怀抱
    XYT.registerShot('kit_figures_pairs', {
      name: '人物·双人', zone: 'bottom', night: false, text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6', bloom: 0.15,
      draw(g, c) {
        galleryBg(g, c);
        const t = c.t;
        for (const night of [false, true]) {
          const y = night ? 692 : 332, r = night ? '#ffe2b0' : null, w = 0.4;
          shadow(g, 165, y, 48, night);
          fig.pair(g, ['xiaoyao', 152, y, 1, t, { pose: 'embrace', rim: r, wind: w }], ['linger', 178, y, 1, t, { pose: 'embrace', facing: -1, rim: r, wind: w, windDir: -1 }]);
          label(g, 165, y + 22, '相拥 fig.pair', night);
          shadow(g, 440, y, 50, night);
          fig.draw(g, 'xiaoyao', 466, y, 1, t, { pose: 'whisper', facing: -1, rim: r, wind: w, windDir: -1, head: 0.1, lean: -0.12 });
          fig.draw(g, 'linger', 424, y, 1, t, { pose: 'whisper', rim: r, wind: w, windDir: -1 });
          label(g, 450, y + 22, '耳语', night);
          shadow(g, 760, y, 80, night);
          // 怀抱：让灵儿的头落在逍遥双手之间
          const xo = { pose: 'kneel', cradle: true, rim: r, wind: w };
          const hp = fig.points('xiaoyao', 700, y, 1, t, xo);
          const lo = { pose: 'lie', flat: true, limp: true, rim: r, wind: 0.2, windDir: -1 };
          const lp = fig.points('linger', 0, 0, 1, t, lo);
          const tx = hp.handN[0] - lp.head[0] - 4;
          fig.pair(g, ['xiaoyao', 700, y, 1, t, xo], ['linger', tx, y, 1, t, lo]);
          label(g, 760, y + 22, '怀抱（kneel cradle + lie flat）', night);
          shadow(g, 1040, y, 60, night);
          fig.draw(g, 'anu', 1010, y, 1, t, { pose: 'stand', rim: r, wind: w });
          fig.draw(g, 'tangyu', 1060, y, 1, t, { pose: 'stand', facing: -1, rim: r, wind: w, windDir: 1 });
          label(g, 1035, y + 22, '阿奴 · 唐钰', night);
        }
      },
    });
    // 远景小人：40–60 像素
    XYT.registerShot('kit_figures_far', {
      name: '人物·远景', zone: 'bottom', night: false, text: '#fff', shadow: 'rgba(0,0,0,.8)', accent: '#fc6', bloom: 0.15,
      draw(g, c) {
        galleryBg(g, c);
        const t = c.t;
        const list = [['xiaoyao', 'walk'], ['xiaoyao', 'flySword'], ['xiaoyao', 'swordUp'], ['linger', 'walk'], ['linger', 'dance'], ['yueru', 'swordPoint'],
          ['jiujianxian', 'drink'], ['baiyue', 'stand'], ['xiaoyao', 'kneel'], ['linger', 'lookBack'], ['xiaoyao', 'reach'], ['caiyi', 'stand'], ['laolao', 'walk'], ['villager', 'walk']];
        for (const night of [false, true]) {
          list.forEach(([w, p], i) => {
            const row = i % 2, x = 60 + i * 86, y = (night ? 692 : 332) - 40 - row * 0;
            const s = row ? 0.25 : 0.33;
            fig.draw(g, w, x, y, s, t, { pose: p, wind: 0.5, seed: i, rim: night ? '#ffe2b0' : null });
            g.font = '11px sans-serif'; g.textAlign = 'center'; g.fillStyle = night ? 'rgba(230,236,255,0.6)' : 'rgba(40,30,20,0.6)';
            g.fillText(`${p} ${Math.round(s * 180)}px`, x, y + 18);
          });
        }
      },
    });
  }
})();
